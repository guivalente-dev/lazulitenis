import { NextResponse } from "next/server";
import { logAction, matchLabel } from "@/lib/audit";
import { ensureSchema, pool } from "@/lib/db";
import { requireRole } from "@/lib/session";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const who = await requireRole(req, "admin");
  if (who instanceof NextResponse) return who;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  await ensureSchema();
  const label = await matchLabel(id);
  const r = await pool().query("DELETE FROM matches WHERE id = $1", [id]);
  if (r.rowCount) await logAction(who, "jogo_apagado", label);
  return NextResponse.json({ ok: true });
}
