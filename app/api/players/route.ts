import { NextResponse } from "next/server";
import { logAction } from "@/lib/audit";
import { ensureSchema, pool } from "@/lib/db";
import { duplicateMessage, parsePlayerBody } from "@/lib/playerInput";
import { requireRole } from "@/lib/session";
import { ownerEmail } from "@/lib/userauth";

export const dynamic = "force-dynamic";

/** Lista para admins, com e-mail e flag de admin (a API pública /api/data não expõe e-mails). */
export async function GET(req: Request) {
  const who = await requireRole(req, "admin");
  if (who instanceof NextResponse) return who;
  await ensureSchema();
  const r = await pool().query("SELECT id, name, email, is_admin FROM players ORDER BY lower(name)");
  const owner = ownerEmail();
  const players = r.rows.map((p) => {
    const locked = !!owner && !!p.email && String(p.email).toLowerCase() === owner;
    return { id: p.id, name: p.name, email: p.email, isAdmin: p.is_admin || locked, locked };
  });
  return NextResponse.json({ players }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const who = await requireRole(req, "admin");
  if (who instanceof NextResponse) return who;
  const p = parsePlayerBody(await req.json().catch(() => null));
  if ("error" in p) return NextResponse.json({ error: p.error }, { status: 400 });
  await ensureSchema();
  try {
    const r = await pool().query(
      "INSERT INTO players (name, email, is_admin) VALUES ($1, $2, $3) RETURNING id, name, email, is_admin",
      [p.name, p.email, p.isAdmin],
    );
    await logAction(
      who,
      "jogador_criado",
      `${p.name}${p.email ? ` · e-mail ${p.email}` : " · sem e-mail"}${p.isAdmin ? " · admin" : ""}`,
    );
    if (p.isAdmin) await logAction(who, "admin_concedido", `${p.name} (${p.email})`);
    return NextResponse.json({ ok: true, player: r.rows[0] });
  } catch (e) {
    const msg = duplicateMessage(e);
    if (msg) return NextResponse.json({ error: msg }, { status: 409 });
    throw e;
  }
}
