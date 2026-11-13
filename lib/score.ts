/**
 * Placar no estilo "6x2 3x6 10x8": cada par é um set, escrito do ponto de vista
 * do jogador 1 (primeiro número = games do jogador 1).
 */
export type SetScore = { a: number; b: number };

export type ParsedScore =
  | {
      ok: true;
      sets: SetScore[];
      /** 1 = jogador 1 venceu, 2 = jogador 2 venceu */
      winnerSide: 1 | 2;
      setsA: number;
      setsB: number;
      /** Placar normalizado com o vencedor sempre na frente: "6x4 6x0" */
      normalized: string;
    }
  | { ok: false; error: string };

const SET_RE = /(\d{1,2})\s*[xX×]\s*(\d{1,2})/g;
const MAX_SETS = 5;

export function parseScore(input: string): ParsedScore {
  const text = (input ?? "").trim();
  if (!text) return { ok: false, error: "Informe o placar, ex: 6x2 3x6 10x8." };

  const sets: SetScore[] = [];
  let rest = text;
  for (const m of text.matchAll(SET_RE)) {
    sets.push({ a: Number(m[1]), b: Number(m[2]) });
    rest = rest.replace(m[0], " ");
  }
  if (sets.length === 0 || /[^\s,;/|-]/.test(rest)) {
    return { ok: false, error: "Placar inválido. Use o formato 6x2 3x6 10x8 (um par por set)." };
  }
  if (sets.length > MAX_SETS) {
    return { ok: false, error: `No máximo ${MAX_SETS} sets.` };
  }
  if (sets.some((s) => s.a === s.b)) {
    return { ok: false, error: "Nenhum set pode terminar empatado." };
  }

  const setsA = sets.filter((s) => s.a > s.b).length;
  const setsB = sets.length - setsA;
  if (setsA === setsB) {
    return { ok: false, error: "Placar empatado em sets: não dá para definir o vencedor." };
  }
  const winnerSide: 1 | 2 = setsA > setsB ? 1 : 2;
  const normalized = sets
    .map((s) => (winnerSide === 1 ? `${s.a}x${s.b}` : `${s.b}x${s.a}`))
    .join(" ");
  return { ok: true, sets, winnerSide, setsA, setsB, normalized };
}

/** Placar do WO: o vencedor leva 6x0 6x0. */
export const WO_SCORE = "6x0 6x0";

/** "6x4 3x6 10x8" -> "6 x 4 - 3 x 6 - 10 x 8" */
export function formatScore(score: string): string {
  return score
    .trim()
    .split(/\s+/)
    .map((s) => s.replace("x", " x "))
    .join(" - ");
}

/** Diferença total de games (vencedor − perdedor), usada para ordenar. */
export function scoreMargin(score: string): number {
  let diff = 0;
  for (const s of score.trim().split(/\s+/)) {
    const [w, l] = s.split("x").map(Number);
    if (Number.isFinite(w) && Number.isFinite(l)) diff += w - l;
  }
  return diff;
}

/** Sets ganhos pelo vencedor e pelo perdedor, a partir do placar normalizado (vencedor primeiro). */
export function countSets(score: string): { won: number; lost: number } {
  let won = 0;
  let lost = 0;
  for (const s of score.trim().split(/\s+/)) {
    const [w, l] = s.split("x").map(Number);
    if (w > l) won++;
    else if (l > w) lost++;
  }
  return { won, lost };
}
