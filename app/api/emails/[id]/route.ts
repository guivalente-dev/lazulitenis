import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ensureSchema, pool } from "@/lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

  const b = (await req.json().catch(() => null)) ?? {};
  const email = String(b.email ?? "").trim().toLowerCase();
  const label = String(b.label ?? "").replace(/\s+/g, " ").trim();
  if (!EMAIL_RE.test(email) || email.length > 120) {
    return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }
  if (label.length > 60) return NextResponse.json({ error: "O nome pode ter no máximo 60 caracteres." }, { status: 400 });

  await ensureSchema();
  try {
    const r = await pool().query(
      "UPDATE allowed_emails SET email = $2, label = NULLIF($3, '') WHERE id = $1 RETURNING id, email, label",
      [id, email, label],
    );
    if (!r.rowCount) return NextResponse.json({ error: "E-mail não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true, item: r.rows[0] });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "Esse e-mail já está na lista." }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  await ensureSchema();
  await pool().query("DELETE FROM allowed_emails WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
