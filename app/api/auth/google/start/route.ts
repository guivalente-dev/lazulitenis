import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { cookieOpts, publicOrigin, STATE_COOKIE } from "@/lib/userauth";

export const dynamic = "force-dynamic";

/** Inicia o login com Google: redireciona para a tela de escolha de conta. */
export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/?acesso=indisponivel", publicOrigin(req)));
  }
  const state = crypto.randomBytes(16).toString("hex");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${publicOrigin(req)}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email",
    state,
    prompt: "select_account",
  }).toString();

  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, state, cookieOpts(60 * 10));
  return res;
}
