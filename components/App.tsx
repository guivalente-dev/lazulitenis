"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Data } from "@/lib/types";
import { computeRanking } from "@/lib/stats";
import Ranking from "./Ranking";
import Matches from "./Matches";
import LoginModal from "./LoginModal";
import AdminModal from "./AdminModal";
import ResultModal from "./ResultModal";
import LogModal from "./LogModal";

export type Me = { role: "owner" | "admin" | "player"; email: string | null };

const AVISOS: Record<string, string> = {
  negado: "Esse e-mail Google não está cadastrado. Peça a um administrador para incluir seu e-mail.",
  cancelado: "Login cancelado. Tente novamente.",
  erro: "Não foi possível entrar com o Google agora. Tente novamente.",
  indisponivel: "O login com Google ainda não está configurado.",
};

export default function App({ initial, initialMe }: { initial: Data; initialMe: Me | null }) {
  const [data, setData] = useState<Data>(initial);
  const [me, setMe] = useState<Me | null>(initialMe);
  const admin = me?.role === "admin" || me?.role === "owner";
  const owner = me?.role === "owner";
  const [aviso, setAviso] = useState("");
  const [modal, setModal] = useState<null | "login" | "admin" | "result" | "log">(null);
  const [selected, setSelected] = useState<number | null>(null);
  const matchesRef = useRef<HTMLElement>(null);

  const reload = useCallback(async () => {
    const res = await fetch("/api/data", { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, []);

  // ?acesso=... mostra o motivo de uma falha no login; ?owner=1 abre o acesso de emergência por senha
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (!q.has("acesso") && !q.has("ok") && !q.has("owner")) return;
    const motivo = q.get("acesso");
    if (motivo) setAviso(AVISOS[motivo] ?? AVISOS.erro);
    if (q.has("owner") && !initialMe) setModal("login");
    window.history.replaceState(null, "", window.location.pathname);
  }, [initialMe]);

  const sessionExpired = () => {
    setMe(null);
    setModal(null);
    setAviso("Sua sessão expirou ou seu acesso foi removido. Entre novamente.");
  };

  const rows = useMemo(() => computeRanking(data.players, data.matches), [data]);
  const selectedPlayer = rows.find((r) => r.id === selected) ?? null;

  const toggleSelected = (id: number) => {
    const next = selected === id ? null : id;
    setSelected(next);
    if (next !== null) {
      const el = matchesRef.current;
      if (el && el.getBoundingClientRect().top > window.innerHeight - 120) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    setMe(null);
    setModal(null);
  };

  const n = data.players.length;
  const totalPossible = (n * (n - 1)) / 2;
  const pct = (totalPossible ? (data.matches.length / totalPossible) * 100 : 0).toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  });

  return (
    <main className="wrap">
      <div className="topbar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/logo.webp" alt="1º Ranking Lazuli de Tênis" width={200} height={200} />
        <div className="actions">
          {!me ? (
            <a className="btn primary" href="/api/auth/google/start">
              Entrar com Google
            </a>
          ) : (
            <>
              <button className="btn primary" onClick={() => setModal("result")}>
                Enviar resultado
              </button>
              {admin && (
                <button className="btn" onClick={() => setModal("admin")}>
                  Admin
                </button>
              )}
              {owner && (
                <button className="btn" onClick={() => setModal("log")}>
                  Log
                </button>
              )}
              <button className="btn ghost" onClick={logout}>
                Sair
              </button>
            </>
          )}
        </div>
      </div>

      {aviso && (
        <p className="notice error aviso" role="alert">
          {aviso}{" "}
          <button className="link-btn" onClick={() => setAviso("")}>
            fechar
          </button>
        </p>
      )}

      <h1 className="title">Classificação</h1>
      <Ranking rows={rows} selected={selected} onSelect={toggleSelected} />

      <section ref={matchesRef} className="matches-section">
        <h1 className="title">Jogos</h1>
        <Matches
          players={data.players}
          matches={data.matches}
          selected={selectedPlayer}
          onClear={() => setSelected(null)}
          admin={admin}
          onChanged={reload}
          onSessionExpired={sessionExpired}
        />
      </section>

      <p className="muted footer-stats">
        {data.matches.length} de {totalPossible} jogos ({pct}%)
      </p>

      {modal === "login" && (
        <LoginModal
          onClose={() => setModal(null)}
          onSuccess={() => {
            setMe({ role: "owner", email: null });
            setModal("admin");
          }}
        />
      )}
      {modal === "result" && me && (
        <ResultModal
          data={data}
          email={me.email ?? "Owner"}
          onClose={() => setModal(null)}
          onChanged={reload}
          onSessionExpired={sessionExpired}
          onLogout={logout}
        />
      )}
      {modal === "admin" && admin && (
        <AdminModal data={data} onClose={() => setModal(null)} onChanged={reload} onSessionExpired={sessionExpired} />
      )}
      {modal === "log" && owner && <LogModal onClose={() => setModal(null)} onSessionExpired={sessionExpired} />}
    </main>
  );
}
