import { NextResponse } from "next/server";
import { logAction } from "@/lib/audit";
import { ensureSchema, pool } from "@/lib/db";
import { duplicateMessage, parsePlayerBody } from "@/lib/playerInput";
import { requireRole } from "@/lib/session";
import { ownerEmail } from "@/lib/userauth";

type Ctx = { params: Promise<{ id: string }> };
type Row = { name: string; email: string | null; is_admin: boolean };

const isOwnerRow = (r: Row) => !!r.email && !!ownerEmail() && r.email.toLowerCase() === ownerEmail();

export async function PATCH(req: Request, ctx: Ctx) {
  const who = await requireRole(req, "admin");
  if (who instanceof NextResponse) return who;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  const p = parsePlayerBody(await req.json().catch(() => null));
  if ("error" in p) return NextResponse.json({ error: p.error }, { status: 400 });
  await ensureSchema();

  const cur = (await pool().query("SELECT name, email, is_admin FROM players WHERE id = $1", [id])).rows[0] as
    | Row
    | undefined;
  if (!cur) return NextResponse.json({ error: "Jogador não encontrado." }, { status: 404 });
  // O owner não perde e-mail nem admin: só o nome pode mudar
  if (isOwnerRow(cur)) {
    p.email = cur.email;
    p.isAdmin = true;
  }

  try {
    await pool().query("UPDATE players SET name = $1, email = $2, is_admin = $3 WHERE id = $4", [
      p.name,
      p.email,
      p.isAdmin,
      id,
    ]);
  } catch (e) {
    const msg = duplicateMessage(e);
    if (msg) return NextResponse.json({ error: msg }, { status: 409 });
    throw e;
  }

  const changes: string[] = [];
  if (cur.name !== p.name) changes.push(`nome ${cur.name} → ${p.name}`);
  if ((cur.email ?? "") !== (p.email ?? "")) changes.push(`e-mail ${cur.email ?? "(nenhum)"} → ${p.email ?? "(nenhum)"}`);
  if (changes.length) await logAction(who, "jogador_editado", `${cur.name}: ${changes.join("; ")}`);
  if ((cur.is_admin || isOwnerRow(cur)) !== p.isAdmin) {
    await logAction(who, p.isAdmin ? "admin_concedido" : "admin_removido", `${p.name} (${p.email ?? cur.email ?? "sem e-mail"})`);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const who = await requireRole(req, "admin");
  if (who instanceof NextResponse) return who;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  await ensureSchema();
  const cur = (await pool().query("SELECT name, email, is_admin FROM players WHERE id = $1", [id])).rows[0] as
    | Row
    | undefined;
  if (!cur) return NextResponse.json({ ok: true });
  if (isOwnerRow(cur)) return NextResponse.json({ error: "O owner não pode ser excluído." }, { status: 403 });
  const used = await pool().query("SELECT 1 FROM matches WHERE winner_id = $1 OR loser_id = $1 LIMIT 1", [id]);
  if (used.rowCount) {
    return NextResponse.json(
      { error: "Esse jogador já tem jogos lançados. Exclua os jogos dele antes." },
      { status: 409 },
    );
  }
  await pool().query("DELETE FROM players WHERE id = $1", [id]);
  await logAction(who, "jogador_excluido", `${cur.name}${cur.email ? ` (${cur.email})` : ""}${cur.is_admin ? " · era admin" : ""}`);
  return NextResponse.json({ ok: true });
}
