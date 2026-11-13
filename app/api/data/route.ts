import { NextResponse } from "next/server";
import { DbNotConfigured, getData } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getData(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof DbNotConfigured) {
      return NextResponse.json({ error: "Banco de dados não configurado." }, { status: 503 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erro ao carregar os dados." }, { status: 500 });
  }
}
