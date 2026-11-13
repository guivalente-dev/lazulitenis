import { NextResponse } from "next/server";
import { ensureSchema, pool } from "@/lib/db";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Log de ações: só o owner vê. */
export async function GET(req: Request) {
  const who = await requireRole(req, "owner");
  if (who instanceof NextResponse) return who;
  await ensureSchema();
  const r = await pool().query(
    `SELECT id, to_char(at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YY HH24:MI') AS quando, actor, action, detail
       FROM audit_log ORDER BY id DESC LIMIT 500`,
  );
  return NextResponse.json({ log: r.rows }, { headers: { "Cache-Control": "no-store" } });
}
