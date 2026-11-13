"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { Data } from "@/lib/types";
import { computeRanking } from "@/lib/stats";
import Ranking from "./Ranking";
import Matches from "./Matches";
import LoginModal from "./LoginModal";
import AdminModal from "./AdminModal";

export default function App({ initial, initialAdmin }: { initial: Data; initialAdmin: boolean }) {
  const [data, setData] = useState<Data>(initial);
  const [admin, setAdmin] = useState(initialAdmin);
  const [modal, setModal] = useState<null | "login" | "admin">(null);
  const [selected, setSelected] = useState<number | null>(null);
  const matchesRef = useRef<HTMLElement>(null);

  const reload = useCallback(async () => {
    const res = await fetch("/api/data", { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, []);

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
    setAdmin(false);
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
        <div className="actions">
          {admin ? (
            <>
              <button className="btn" onClick={() => setModal("admin")}>
                Painel admin
              </button>
              <button className="btn ghost" onClick={logout}>
                Sair
              </button>
            </>
          ) : (
            <button className="btn ghost" onClick={() => setModal("login")}>
              Admin
            </button>
          )}
        </div>
      </div>

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
          onSessionExpired={() => setAdmin(false)}
        />
      </section>

      <p className="muted footer-stats">
        {data.matches.length} de {totalPossible} jogos ({pct}%)
      </p>

      {modal === "login" && (
        <LoginModal
          onClose={() => setModal(null)}
          onSuccess={() => {
            setAdmin(true);
            setModal("admin");
          }}
        />
      )}
      {modal === "admin" && admin && (
        <AdminModal
          data={data}
          onClose={() => setModal(null)}
          onChanged={reload}
          onSessionExpired={() => {
            setAdmin(false);
            setModal("login");
          }}
        />
      )}
    </main>
  );
}
