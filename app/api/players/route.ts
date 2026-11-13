import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ensureSchema, pool } from "@/lib/db";
import { duplicateMessage, parsePlayerBody } from "@/lib/playerInput";

export const dynamic = "force-dynamic";

/** Lista para o admin, com e-mail (a API pública /api/data não expõe e-mails). */
export async function GET(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();
  const r = await pool().query("SELECT id, name, email FROM players ORDER BY lower(name)");
  return NextResponse.json({ players: r.rows }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const p = parsePlayerBody(await req.json().catch(() => null));
  if ("error" in p) return NextResponse.json({ error: p.error }, { status: 400 });
  await ensureSchema();
  try {
    const r = await pool().query("INSERT INTO players (name, email) VALUES ($1, $2) RETURNING id, name, email", [
      p.name,
      p.email,
    ]);
    return NextResponse.json({ ok: true, player: r.rows[0] });
  } catch (e) {
    const msg = duplicateMessage(e);
    if (msg) return NextResponse.json({ error: msg }, { status: 409 });
    throw e;
  }
}
