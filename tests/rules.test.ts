import { test } from "node:test";
import assert from "node:assert/strict";
import { parseScore, countSets, formatScore } from "../lib/score";
import { computeRanking } from "../lib/stats";
import type { Match, Player } from "../lib/types";

test("placar: jogador 1 vence", () => {
  const r = parseScore("6x2 3x6 10x8");
  assert.ok(r.ok);
  assert.equal(r.winnerSide, 1);
  assert.equal(r.normalized, "6x2 3x6 10x8");
});

test("placar: jogador 2 vence e o placar é normalizado com o vencedor na frente", () => {
  const r = parseScore("2x6 6x3 8x10");
  assert.ok(r.ok);
  assert.equal(r.winnerSide, 2);
  assert.equal(r.normalized, "6x2 3x6 10x8");
});

test("placar: entradas inválidas", () => {
  for (const bad of ["", "abc", "6x6", "6x4 3x6", "6x2 foo", "6x2 6x1 6x0 6x0 6x0 6x0", "6-2"]) {
    assert.equal(parseScore(bad).ok, false, bad);
  }
});

test("placar: separadores e maiúsculas", () => {
  const r = parseScore("6X4, 6x3");
  assert.ok(r.ok);
  assert.equal(r.normalized, "6x4 6x3");
  assert.equal(formatScore("6x4 3x6 10x8"), "6 x 4 - 3 x 6 - 10 x 8");
  assert.deepEqual(countSets("6x4 3x6 10x8"), { won: 2, lost: 1 });
});

const players: Player[] = ["Ana", "Bia", "Caio", "Davi"].map((name, i) => ({ id: i + 1, name }));
const [ANA, BIA, CAIO, DAVI] = [1, 2, 3, 4];
let id = 0;
const m = (w: number, l: number, score: string, wo = false, d = "2026-11-01"): Match => ({
  id: ++id, winner_id: w, loser_id: l, score, wo, played_on: d,
});
const names = (rows: { name: string }[]) => rows.map((r) => r.name);

test("pontos: vitória 5, derrota 2, WO 0", () => {
  id = 0;
  // Ana vence Bia; Caio vence Ana por WO (Ana não compareceu)
  const rows = computeRanking(players, [m(ANA, BIA, "6x0 6x0"), m(CAIO, ANA, "6x0 6x0", true)]);
  const by = Object.fromEntries(rows.map((r) => [r.name, r]));
  assert.equal(by.Ana.points, 5); // 5 (vitória) + 0 (WO)
  assert.equal(by.Ana.wins, 1);
  assert.equal(by.Ana.losses, 0);
  assert.equal(by.Ana.wo, 1);
  assert.equal(by.Ana.games, 2);
  assert.equal(by.Bia.points, 2);
  assert.equal(by.Caio.points, 5);
  assert.equal(by.Ana.last5.map((x) => x.r).join(""), "VW");
});

test("desempate 3: sets ganhos", () => {
  id = 0;
  // Todos terminam com 7 pontos e 1 vitória; Davi ganhou mais sets (2 + 1)
  const rows = computeRanking(players, [
    m(ANA, CAIO, "6x4 6x4"),
    m(DAVI, ANA, "6x1 6x1"),
    m(BIA, DAVI, "7x5 3x6 6x4"),
    m(CAIO, BIA, "6x0 6x0"),
  ]);
  assert.deepEqual(rows.map((r) => [r.points, r.wins, r.sets]), [[7, 1, 3], [7, 1, 2], [7, 1, 2], [7, 1, 2]]);
  assert.deepEqual(names(rows), ["Davi", "Ana", "Bia", "Caio"]);
});

test("desempate 4: menos WO concedidos (mesmo com nome depois no alfabeto)", () => {
  id = 0;
  // Ana e Bia: 5 pts, 1 vitória, 2 sets — Ana deu WO uma vez, Bia nenhuma
  const rows = computeRanking(players, [
    m(ANA, CAIO, "6x0 6x0"),
    m(DAVI, ANA, "6x0 6x0", true),
    m(BIA, DAVI, "6x0 6x0"),
  ]);
  const by = Object.fromEntries(rows.map((r) => [r.name, r]));
  assert.deepEqual([by.Ana.points, by.Ana.wins, by.Ana.sets], [by.Bia.points, by.Bia.wins, by.Bia.sets]);
  assert.deepEqual(names(rows), ["Davi", "Bia", "Ana", "Caio"]);
});

test("desempate 2: vitórias antes de sets", () => {
  id = 0;
  // Ana: 2 vitórias + 1 derrota = 12... Bia: 1 vitória + 3 derrotas = 11; Caio/Davi completam
  const rows = computeRanking(players, [
    m(ANA, BIA, "6x0 6x0"),
    m(ANA, CAIO, "6x0 6x0"),
    m(DAVI, ANA, "6x0 6x0"),
  ]);
  assert.equal(rows[0].name, "Ana"); // 12 pts
  assert.equal(rows[1].name, "Davi"); // 5 pts, 1 vitória, 2 sets
});

test("jogador sem jogos aparece com zeros", () => {
  const rows = computeRanking(players, []);
  assert.equal(rows.length, 4);
  assert.ok(rows.every((r) => r.points === 0 && r.pct === null));
});
