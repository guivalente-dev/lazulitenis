import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ensureSchema, pool } from "@/lib/db";
import { createMatch } from "@/lib/matches";
import { parseScore } from "@/lib/score";

/**
 * Recebe os resultados enviados pelo Google Form (Apps Script).
 * Autenticada por segredo compartilhado (FORM_SECRET) no cabeçalho x-form-secret.
 * Corpo: { winner: "Nome", loser: "Nome", score: "6x2 3x6 10x8" | "WO", date?: "YYYY-MM-DD" }
 * O placar é escrito do ponto de vista do vencedor (games do vencedor primeiro).
 */

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

function sameSecret(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const expected = process.env.FORM_SECRET;
  if (!expected) return fail("Recebimento por formulário não configurado.", 503);
  if (!sameSecret(req.headers.get("x-form-secret") ?? "", expected)) return fail("Não autorizado.", 401);

  const b = await req.json().catch(() => null);
  const winnerName = String(b?.winner ?? "").trim();
  const loserName = String(b?.loser ?? "").trim();
  const score = String(b?.score ?? "").trim();
  if (!winnerName || !loserName) return fail("Informe vencedor e perdedor.");

  await ensureSchema();
  const found = await pool().query(
    "SELECT id, name FROM players WHERE lower(name) = ANY($1::text[])",
    [[winnerName.toLowerCase(), loserName.toLowerCase()]],
  );
  const idOf = (name: string) => found.rows.find((r) => String(r.name).toLowerCase() === name.toLowerCase())?.id;
  const winnerId = idOf(winnerName);
  const loserId = idOf(loserName);
  if (!winnerId || !loserId) return fail("Jogador não encontrado.", 404);

  const isWo = /^wo$/i.test(score);
  if (!isWo) {
    const parsed = parseScore(score);
    if (!parsed.ok) return fail(parsed.error);
    // O placar é do ponto de vista do vencedor: se o 1º número perdeu, vencedor e placar não batem
    if (parsed.winnerSide !== 1) {
      return fail("O placar indica que o vencedor informado perdeu (games do vencedor devem vir primeiro).");
    }
  }

  const r = await createMatch({
    p1: winnerId,
    p2: loserId,
    date: typeof b?.date === "string" ? b.date : "",
    wo: isWo,
    woLoser: loserId,
    score,
  });
  if (!r.ok) return fail(r.error, r.status);
  return NextResponse.json({ ok: true, id: r.id, score: r.score });
}
