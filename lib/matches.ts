import { ensureSchema, pool } from "@/lib/db";
import { parseScore, WO_SCORE } from "@/lib/score";

export type NewMatch = {
  p1: unknown;
  p2: unknown;
  date?: unknown;
  wo?: unknown;
  woLoser?: unknown;
  score?: unknown;
  /** E-mail de quem enviou (nulo quando lançado pelo admin) */
  submittedBy?: string | null;
};

export type MatchResult =
  | { ok: true; id: number; winner: number; loser: number; score: string }
  | { ok: false; status: number; error: string };

const fail = (error: string, status = 400): MatchResult => ({ ok: false, status, error });

/** Valida e grava um jogo. Usado pelo painel admin e pelo formulário do Google. */
export async function createMatch(b: NewMatch | null): Promise<MatchResult> {
  const p1 = Number(b?.p1);
  const p2 = Number(b?.p2);
  if (!Number.isInteger(p1) || !Number.isInteger(p2)) return fail("Selecione os dois jogadores.");
  if (p1 === p2) return fail("Os dois jogadores precisam ser diferentes.");

  const date = typeof b?.date === "string" ? b.date : "";
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)))) {
    return fail("Data inválida.");
  }

  let winner: number;
  let loser: number;
  let score: string;
  const wo = b?.wo === true;
  if (wo) {
    const woLoser = Number(b?.woLoser);
    if (woLoser !== p1 && woLoser !== p2) return fail("Informe quem deu WO.");
    loser = woLoser;
    winner = woLoser === p1 ? p2 : p1;
    score = WO_SCORE;
  } else {
    const parsed = parseScore(String(b?.score ?? ""));
    if (!parsed.ok) return fail(parsed.error);
    winner = parsed.winnerSide === 1 ? p1 : p2;
    loser = parsed.winnerSide === 1 ? p2 : p1;
    score = parsed.normalized;
  }

  await ensureSchema();
  const db = pool();

  const found = await db.query("SELECT id FROM players WHERE id = ANY($1::int[])", [[p1, p2]]);
  if (found.rowCount !== 2) return fail("Jogador não encontrado.", 404);

  // Validação: o confronto já aconteceu? (em qualquer ordem)
  const dup = await db.query(
    `SELECT m.id, to_char(m.played_on, 'DD/MM/YYYY') AS d, m.score, w.name AS wn, l.name AS ln
       FROM matches m JOIN players w ON w.id = m.winner_id JOIN players l ON l.id = m.loser_id
      WHERE LEAST(m.winner_id, m.loser_id) = LEAST($1::int, $2::int)
        AND GREATEST(m.winner_id, m.loser_id) = GREATEST($1::int, $2::int)`,
    [p1, p2],
  );
  if (dup.rowCount) {
    const r = dup.rows[0] as { wn: string; ln: string; d: string };
    return fail(
      `Esse jogo já foi realizado (${r.wn} venceu ${r.ln} em ${r.d}). Exclua o lançamento anterior se precisar corrigir.`,
      409,
    );
  }

  try {
    const ins = await db.query(
      `INSERT INTO matches (winner_id, loser_id, score, wo, played_on, submitted_by)
       VALUES ($1, $2, $3, $4, COALESCE(NULLIF($5, '')::date, (now() AT TIME ZONE 'America/Sao_Paulo')::date), $6)
       RETURNING id`,
      [winner, loser, score, wo, date, b?.submittedBy ?? null],
    );
    return { ok: true, id: ins.rows[0].id, winner, loser, score };
  } catch (e) {
    // Duas requisições simultâneas: o índice único barra a segunda
    if ((e as { code?: string }).code === "23505") return fail("Esse jogo já foi realizado.", 409);
    throw e;
  }
}

/**
 * Resultado enviado por um participante logado.
 * O placar é escrito do ponto de vista do vencedor (games do vencedor primeiro) ou apenas "WO".
 */
export async function submitResult(
  b: { winner?: unknown; loser?: unknown; score?: unknown; date?: unknown } | null,
  by: string,
): Promise<MatchResult> {
  const winner = Number(b?.winner);
  const loser = Number(b?.loser);
  if (!Number.isInteger(winner) || !Number.isInteger(loser)) return fail("Selecione o vencedor e o perdedor.");
  if (winner === loser) return fail("Vencedor e perdedor precisam ser diferentes.");

  const date = typeof b?.date === "string" ? b.date : "";
  if (date && Date.parse(date) > Date.now() + 36 * 3600 * 1000) return fail("A data do jogo não pode ser no futuro.");

  const score = String(b?.score ?? "").trim();
  const isWo = /^wo$/i.test(score);
  if (!isWo) {
    const parsed = parseScore(score);
    if (!parsed.ok) return fail(parsed.error);
    if (parsed.winnerSide !== 1) {
      return fail("O placar indica que o vencedor informado perdeu. Escreva primeiro os games do vencedor.");
    }
  }
  return createMatch({ p1: winner, p2: loser, date, wo: isWo, woLoser: loser, score, submittedBy: by });
}
