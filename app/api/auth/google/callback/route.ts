import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { logAction } from "@/lib/audit";
import { cookieOpts, isAllowedEmail, makeUserToken, publicOrigin, STATE_COOKIE, USER_COOKIE, USER_MAX_AGE_S } from "@/lib/userauth";

export const dynamic = "force-dynamic";

function readCookie(req: Request, name: string): string {
  const m = (req.headers.get("cookie") ?? "").split(/;\s*/).find((c) => c.startsWith(`${name}=`));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : "";
}

/** Volta do Google: confere o state, troca o code por token, lê o e-mail verificado e abre a sessão. */
export async function GET(req: Request) {
  const origin = publicOrigin(req);
  const back = (q: string) => {
    const res = NextResponse.redirect(new URL(`/?${q}`, origin));
    res.cookies.delete(STATE_COOKIE);
    return res;
  };

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const saved = readCookie(req, STATE_COOKIE);
  const sameState =
    saved.length > 0 && saved.length === state.length && crypto.timingSafeEqual(Buffer.from(saved), Buffer.from(state));
  if (url.searchParams.get("error") || !code || !sameState) return back("acesso=cancelado");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return back("acesso=indisponivel");

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) return back("acesso=erro");
    const { access_token } = (await tokenRes.json()) as { access_token?: string };
    if (!access_token) return back("acesso=erro");

    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!infoRes.ok) return back("acesso=erro");
    const info = (await infoRes.json()) as { email?: string; email_verified?: boolean };
    if (!info.email || info.email_verified !== true) return back("acesso=erro");

    const email = info.email.trim().toLowerCase();
    if (!(await isAllowedEmail(email))) {
      await logAction(email, "login_negado", "E-mail não cadastrado");
      return back("acesso=negado");
    }

    const token = makeUserToken(email);
    if (!token) return back("acesso=indisponivel");
    await logAction(email, "login", "Entrou com o Google");
    const res = back("ok=1");
    res.cookies.set(USER_COOKIE, token, cookieOpts(USER_MAX_AGE_S));
    return res;
  } catch (e) {
    console.error(e);
    return back("acesso=erro");
  }
}
