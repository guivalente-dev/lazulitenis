import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE = "adm_session";
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 dias

function sha(text: string) {
  return crypto.createHash("sha256").update(text).digest();
}

function sign(payload: string): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  const key = sha(`tenis|${pw}|${process.env.SESSION_SECRET ?? ""}`);
  return crypto.createHmac("sha256", key).update(payload).digest("hex");
}

export function checkPassword(input: string): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || !input) return false;
  return crypto.timingSafeEqual(sha(input), sha(pw));
}

function verifyToken(token?: string): boolean {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  const expected = sign(exp ?? "");
  if (!exp || !sig || !expected || Number(exp) < Date.now()) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  return verifyToken(jar.get(COOKIE)?.value);
}

export async function startSession() {
  const exp = String(Date.now() + MAX_AGE_S * 1000);
  const jar = await cookies();
  jar.set(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** Retorna uma resposta de erro se a requisição não for de um admin; senão null. */
export async function requireAdmin(req: Request): Promise<NextResponse | null> {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  }
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Sessão de admin expirada. Entre novamente." }, { status: 401 });
  }
  return null;
}
