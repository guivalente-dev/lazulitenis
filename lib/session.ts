import { NextResponse } from "next/server";
import { hasPasswordSession, originOk } from "@/lib/auth";
import { ensureSchema, pool } from "@/lib/db";
import { ownerEmail, userEmailFromCookie } from "@/lib/userauth";

/**
 * Perfis: owner (e-mail em OWNER_EMAIL ou senha de emergência), admin (jogador com "É admin") e
 * player (jogador com e-mail cadastrado). Tudo é conferido no banco a cada requisição, então
 * remover e-mail ou admin vale na hora.
 */
export type Role = "owner" | "admin" | "player";
export type Actor = { role: Role; email: string | null; label: string };

const RANK: Record<Role, number> = { player: 1, admin: 2, owner: 3 };

export async function getActor(): Promise<Actor | null> {
  if (await hasPasswordSession()) return { role: "owner", email: null, label: "Owner (senha)" };
  const email = await userEmailFromCookie();
  if (!email) return null;
  const e = email.toLowerCase();
  if (e === ownerEmail()) return { role: "owner", email: e, label: `Owner ${e}` };
  await ensureSchema();
  const r = await pool().query(
    "SELECT name, is_admin FROM players WHERE email IS NOT NULL AND lower(email) = $1",
    [e],
  );
  if (!r.rowCount) return null;
  const { name, is_admin } = r.rows[0] as { name: string; is_admin: boolean };
  return { role: is_admin ? "admin" : "player", email: e, label: `${name} (${e})` };
}

/** Devolve o ator ou uma resposta de erro (403 origem, 401 sem sessão, 403 sem permissão). */
export async function requireRole(req: Request, min: Role): Promise<Actor | NextResponse> {
  if (!originOk(req)) return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  const actor = await getActor();
  if (!actor) {
    return NextResponse.json({ error: "Sua sessão expirou ou seu acesso foi removido. Entre novamente." }, { status: 401 });
  }
  if (RANK[actor.role] < RANK[min]) {
    return NextResponse.json({ error: "Você não tem permissão para isso." }, { status: 403 });
  }
  return actor;
}
