const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PlayerInput = { name: string; email: string | null; isAdmin: boolean };

/** Valida nome (obrigatório), e-mail Google (opcional) e flag de admin (exige e-mail). */
export function parsePlayerBody(b: unknown): PlayerInput | { error: string } {
  const o = (b ?? {}) as { name?: unknown; email?: unknown; isAdmin?: unknown };
  const name = String(o.name ?? "").replace(/\s+/g, " ").trim();
  const email = String(o.email ?? "").trim().toLowerCase();
  const isAdmin = o.isAdmin === true;
  if (name.length < 2 || name.length > 60) return { error: "Informe um nome entre 2 e 60 caracteres." };
  if (email && (!EMAIL_RE.test(email) || email.length > 120)) return { error: "Informe um e-mail válido." };
  if (isAdmin && !email) return { error: "Para ser admin, o jogador precisa ter um e-mail Google." };
  return { name, email: email || null, isAdmin };
}

/** Violação de índice único: diz se foi no nome ou no e-mail. */
export function duplicateMessage(e: unknown): string | null {
  const err = e as { code?: string; constraint?: string };
  if (err.code !== "23505") return null;
  return err.constraint === "players_email_uq"
    ? "Esse e-mail já está em uso por outro jogador."
    : "Já existe um jogador com esse nome.";
}
