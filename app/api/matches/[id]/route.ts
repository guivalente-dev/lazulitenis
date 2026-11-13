import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ensureSchema, pool } from "@/lib/db";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  await ensureSchema();
  await pool().query("DELETE FROM matches WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
