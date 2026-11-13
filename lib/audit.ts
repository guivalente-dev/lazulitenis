import { ensureSchema, pool } from "@/lib/db";
import type { Actor } from "@/lib/session";

/** Registra uma ação no log. Falha no log nunca derruba a operação principal. */
export async function logAction(actor: Actor | string, action: string, detail = "") {
  try {
    await ensureSchema();
    await pool().query("INSERT INTO audit_log (actor, action, detail) VALUES ($1, $2, $3)", [
      typeof actor === "string" ? actor : actor.label,
      action,
      detail,
    ]);
  } catch (e) {
    console.error("audit log", e);
  }
}

/** "Lucas venceu Daniel (6x4 3x6 10x8) em 13/11/26" */
export async function matchLabel(id: number): Promise<string> {
  const r = await pool().query(
    `SELECT w.name AS wn, l.name AS ln, m.score, m.wo, to_char(m.played_on, 'DD/MM/YY') AS d
       FROM matches m JOIN players w ON w.id = m.winner_id JOIN players l ON l.id = m.loser_id WHERE m.id = $1`,
    [id],
  );
  const m = r.rows[0];
  if (!m) return `jogo #${id}`;
  return `${m.wn} venceu ${m.ln} (${m.wo ? "WO" : m.score}) em ${m.d}`;
}
