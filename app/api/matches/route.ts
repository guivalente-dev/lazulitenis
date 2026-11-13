import { NextResponse } from "next/server";
import { logAction, matchLabel } from "@/lib/audit";
import { createMatch } from "@/lib/matches";
import { requireRole } from "@/lib/session";

export async function POST(req: Request) {
  const who = await requireRole(req, "admin");
  if (who instanceof NextResponse) return who;

  const b = await req.json().catch(() => null);
  const r = await createMatch(b);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  await logAction(who, "jogo_lancado", await matchLabel(r.id));
  return NextResponse.json({ ok: true, id: r.id, winner: r.winner, loser: r.loser, score: r.score });
}
