import { NextResponse } from "next/server";
import { checkPassword, startSession } from "@/lib/auth";
import { logAction } from "@/lib/audit";

/** Acesso de emergência do owner, por senha. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "ADMIN_PASSWORD não configurada no servidor." }, { status: 503 });
  }
  if (!checkPassword(String(body?.password ?? ""))) {
    await new Promise((r) => setTimeout(r, 600)); // freia tentativa em massa
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }
  await startSession();
  await logAction("Owner (senha)", "login_senha", "Entrou com a senha de emergência");
  return NextResponse.json({ ok: true });
}
