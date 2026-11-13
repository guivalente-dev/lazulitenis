import { countSets } from "./score";
import type { Match, Player } from "./types";

export const POINTS = { win: 5, loss: 2, wo: 0 } as const;

export type LastResult = {
  /** V = vitória, D = derrota, W = derrota por WO */
  r: "V" | "D" | "W";
  opp: string;
  score: string;
  date: string;
};

export type Row = {
  id: number;
  name: string;
  points: number;
  games: number;
  wins: number;
  losses: number;
  wo: number;
  /** Sets ganhos em todas as partidas */
  sets: number;
  /** Aproveitamento de vitórias (0–1) ou null se ainda não jogou */
  pct: number | null;
  /** Até 5 jogos, do mais antigo para o mais recente */
  last5: LastResult[];
  rank: number;
};

const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

/** Ordem cronológica: data e depois id. */
export function byChrono(a: Match, b: Match) {
  return a.played_on === b.played_on ? a.id - b.id : a.played_on < b.played_on ? -1 : 1;
}

export function computeRanking(players: Player[], matches: Match[]): Row[] {
  const names = new Map(players.map((p) => [p.id, p.name]));
  const rows = new Map<number, Row>(
    players.map((p) => [
      p.id,
      { id: p.id, name: p.name, points: 0, games: 0, wins: 0, losses: 0, wo: 0, sets: 0, pct: null, last5: [], rank: 0 },
    ]),
  );

  for (const m of [...matches].sort(byChrono)) {
    const w = rows.get(m.winner_id);
    const l = rows.get(m.loser_id);
    if (!w || !l) continue;
    const sc = countSets(m.score);
    w.sets += sc.won;
    l.sets += sc.lost;
    w.wins++;
    w.games++;
    w.points += POINTS.win;
    w.last5.push({ r: "V", opp: names.get(l.id) ?? "?", score: m.score, date: m.played_on });
    l.games++;
    if (m.wo) {
      l.wo++;
      l.points += POINTS.wo;
    } else {
      l.losses++;
      l.points += POINTS.loss;
    }
    l.last5.push({ r: m.wo ? "W" : "D", opp: names.get(w.id) ?? "?", score: m.score, date: m.played_on });
  }

  const list = [...rows.values()];
  for (const r of list) {
    r.last5 = r.last5.slice(-5);
    r.pct = r.games > 0 ? r.wins / r.games : null;
  }

  // Desempate: mais pontos → mais vitórias → mais sets ganhos → menos WO concedidos
  // (último recurso, só para a ordem ficar estável: ordem alfabética)
  list.sort(
    (a, b) =>
      b.points - a.points ||
      b.wins - a.wins ||
      b.sets - a.sets ||
      a.wo - b.wo ||
      collator.compare(a.name, b.name),
  );
  list.forEach((r, i) => (r.rank = i + 1));
  return list;
}

export function compareText(a: string, b: string) {
  return collator.compare(a, b);
}
