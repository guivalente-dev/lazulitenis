import { NextResponse } from "next/server";
import { submitResult } from "@/lib/matches";
import { requireUser } from "@/lib/userauth";

/** Resultado enviado por um participante logado com Google e autorizado pelo admin. */
export async function POST(req: Request) {
  const who = await requireUser(req);
  if (who instanceof NextResponse) return who;

  const b = await req.json().catch(() => null);
  const r = await submitResult(b, who.email);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, id: r.id, winner: r.winner, loser: r.loser, score: r.score });
}
