import { isAdmin } from "@/lib/auth";
import { DbNotConfigured, getData } from "@/lib/db";
import type { Data } from "@/lib/types";
import App from "@/components/App";

export const dynamic = "force-dynamic";

export default async function Page() {
  let data: Data | null = null;
  let problem: string | null = null;
  try {
    data = await getData();
  } catch (e) {
    problem =
      e instanceof DbNotConfigured
        ? "O banco de dados ainda não foi configurado. Conecte um Postgres (Neon) ao projeto na Vercel e faça um novo deploy."
        : "Não foi possível carregar os dados agora. Tente novamente em instantes.";
    if (!(e instanceof DbNotConfigured)) console.error(e);
  }
  if (!data) {
    return (
      <main className="wrap">
        <h1 className="title">Campeonato de Tênis</h1>
        <p className="notice">{problem}</p>
      </main>
    );
  }
  return <App initial={data} initialAdmin={await isAdmin()} />;
}
