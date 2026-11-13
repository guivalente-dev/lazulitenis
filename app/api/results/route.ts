import { NextResponse } from "next/server";
import { logAction, matchLabel } from "@/lib/audit";
import { submitResult } from "@/lib/matches";
import { requireRole } from "@/lib/session";

/** Resultado enviado por quem está logado (jogador com e-mail cadastrado, admin ou owner). */
export async function POST(req: Request) {
  const who = await requireRole(req, "player");
  if (who instanceof NextResponse) return who;

  const b = await req.json().catch(() => null);
  const r = await submitResult(b, who.email ?? "owner (senha)");
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  await logAction(who, "jogo_enviado", await matchLabel(r.id));
  return NextResponse.json({ ok: true, id: r.id, winner: r.winner, loser: r.loser, score: r.score });
}
