import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ensureSchema, pool } from "@/lib/db";

/**
 * Sessão dos participantes (login com Google). O cookie guarda só o e-mail verificado pelo Google,
 * assinado com HMAC. Quem pode enviar resultados é sempre conferido na lista do banco (allowed_emails),
 * então remover um e-mail da lista revoga o acesso na hora.
 */

export const USER_COOKIE = "usr_session";
export const STATE_COOKIE = "oauth_state";
export const USER_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 dias

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString("utf8");

function key(): Buffer | null {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) return null;
  return crypto.createHash("sha256").update(`tenis-user|${secret}|${process.env.SESSION_SECRET ?? ""}`).digest();
}

function sign(payload: string): string | null {
  const k = key();
  return k ? crypto.createHmac("sha256", k).update(payload).digest("hex") : null;
}

export function makeUserToken(email: string): string | null {
  const payload = `${b64(email)}.${Date.now() + USER_MAX_AGE_S * 1000}`;
  const sig = sign(payload);
  return sig ? `${payload}.${sig}` : null;
}

function emailFromToken(token?: string): string | null {
  if (!token) return null;
  const [e, exp, sig] = token.split(".");
  if (!e || !exp || !sig || Number(exp) < Date.now()) return null;
  const expected = sign(`${e}.${exp}`);
  if (!expected) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return unb64(e);
}

export async function isAllowedEmail(email: string): Promise<boolean> {
  await ensureSchema();
  const r = await pool().query("SELECT 1 FROM allowed_emails WHERE lower(email) = lower($1)", [email]);
  return (r.rowCount ?? 0) > 0;
}

/** E-mail do participante logado, se a sessão for válida e o e-mail ainda estiver na lista. */
export async function currentUser(): Promise<string | null> {
  const jar = await cookies();
  const email = emailFromToken(jar.get(USER_COOKIE)?.value);
  if (!email) return null;
  return (await isAllowedEmail(email)) ? email : null;
}

export async function endUserSession() {
  (await cookies()).delete(USER_COOKIE);
}

export const cookieOpts = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});

/** Origem pública do site (atrás do proxy da Vercel). Precisa bater com o redirect cadastrado no Google. */
export function publicOrigin(req: Request): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  const proto = req.headers.get("x-forwarded-proto") ?? (/^(localhost|127\.)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

/** Resposta de erro se a requisição não for de um participante autorizado; senão o e-mail. */
export async function requireUser(req: Request): Promise<{ email: string } | NextResponse> {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  }
  const email = await currentUser();
  if (!email) {
    return NextResponse.json(
      { error: "Sua sessão expirou ou seu e-mail não está autorizado. Entre com o Google novamente." },
      { status: 401 },
    );
  }
  return { email };
}
