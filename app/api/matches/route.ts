import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ensureSchema, pool } from "@/lib/db";
import { parseScore, WO_SCORE } from "@/lib/score";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const b = await req.json().catch(() => null);
  const p1 = Number(b?.p1);
  const p2 = Number(b?.p2);
  if (!Number.isInteger(p1) || !Number.isInteger(p2)) return fail("Selecione os dois jogadores.");
  if (p1 === p2) return fail("Os dois jogadores precisam ser diferentes.");

  let date = typeof b?.date === "string" ? b.date : "";
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
  const dupMsg = (r: { wn: string; ln: string; d: string }) =>
    `Esse jogo já foi realizado (${r.wn} venceu ${r.ln} em ${r.d}). Exclua o lançamento anterior se precisar corrigir.`;
  if (dup.rowCount) return fail(dupMsg(dup.rows[0]), 409);

  try {
    const ins = await db.query(
      `INSERT INTO matches (winner_id, loser_id, score, wo, played_on)
       VALUES ($1, $2, $3, $4, COALESCE(NULLIF($5, '')::date, (now() AT TIME ZONE 'America/Sao_Paulo')::date))
       RETURNING id`,
      [winner, loser, score, wo, date],
    );
    return NextResponse.json({ ok: true, id: ins.rows[0].id, winner, loser, score });
  } catch (e) {
    // Duas requisições simultâneas: o índice único barra a segunda
    if ((e as { code?: string }).code === "23505") {
      return fail("Esse jogo já foi realizado.", 409);
    }
    throw e;
  }
}
