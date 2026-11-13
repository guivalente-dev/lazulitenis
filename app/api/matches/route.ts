import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createMatch } from "@/lib/matches";

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const b = await req.json().catch(() => null);
  const r = await createMatch(b);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, id: r.id, winner: r.winner, loser: r.loser, score: r.score });
}
