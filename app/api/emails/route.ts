import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ensureSchema, pool } from "@/lib/db";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmailBody(b: unknown): { email: string; label: string } | { error: string } {
  const o = (b ?? {}) as { email?: unknown; label?: unknown };
  const email = String(o.email ?? "").trim().toLowerCase();
  const label = String(o.label ?? "").replace(/\s+/g, " ").trim();
  if (!EMAIL_RE.test(email) || email.length > 120) return { error: "Informe um e-mail válido." };
  if (label.length > 60) return { error: "O nome pode ter no máximo 60 caracteres." };
  return { email, label };
}

export async function GET(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();
  const r = await pool().query("SELECT id, email, label FROM allowed_emails ORDER BY lower(coalesce(label, email))");
  return NextResponse.json({ emails: r.rows }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const p = parseEmailBody(await req.json().catch(() => null));
  if ("error" in p) return NextResponse.json({ error: p.error }, { status: 400 });
  await ensureSchema();
  try {
    const r = await pool().query(
      "INSERT INTO allowed_emails (email, label) VALUES ($1, NULLIF($2, '')) RETURNING id, email, label",
      [p.email, p.label],
    );
    return NextResponse.json({ ok: true, item: r.rows[0] });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "Esse e-mail já está na lista." }, { status: 409 });
    }
    throw e;
  }
}
