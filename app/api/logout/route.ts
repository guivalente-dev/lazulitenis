import { NextResponse } from "next/server";
import { endSession } from "@/lib/auth";
import { endUserSession } from "@/lib/userauth";

export async function POST() {
  await Promise.all([endSession(), endUserSession()]);
  return NextResponse.json({ ok: true });
}
