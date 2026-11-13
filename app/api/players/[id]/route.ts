import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ensureSchema, pool } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const id = Number((await ctx.params).id);
  const b = await req.json().catch(() => null);
  const name = String(b?.name ?? "").replace(/\s+/g, " ").trim();
  if (!Number.isInteger(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  if (name.length < 2 || name.length > 60) {
    return NextResponse.json({ error: "Informe um nome entre 2 e 60 caracteres." }, { status: 400 });
  }
  await ensureSchema();
  try {
    const r = await pool().query("UPDATE players SET name = $1 WHERE id = $2", [name, id]);
    if (!r.rowCount) return NextResponse.json({ error: "Jogador não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "Já existe um jogador com esse nome." }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  await ensureSchema();
  const used = await pool().query(
    "SELECT 1 FROM matches WHERE winner_id = $1 OR loser_id = $1 LIMIT 1",
    [id],
  );
  if (used.rowCount) {
    return NextResponse.json(
      { error: "Esse jogador já tem jogos lançados. Exclua os jogos dele antes." },
      { status: 409 },
    );
  }
  await pool().query("DELETE FROM players WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
