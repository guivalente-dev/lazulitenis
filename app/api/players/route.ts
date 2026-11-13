import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ensureSchema, pool } from "@/lib/db";

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const b = await req.json().catch(() => null);
  const name = String(b?.name ?? "").replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 60) {
    return NextResponse.json({ error: "Informe um nome entre 2 e 60 caracteres." }, { status: 400 });
  }
  await ensureSchema();
  try {
    const r = await pool().query("INSERT INTO players (name) VALUES ($1) RETURNING id, name", [name]);
    return NextResponse.json({ ok: true, player: r.rows[0] });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "Já existe um jogador com esse nome." }, { status: 409 });
    }
    throw e;
  }
}
