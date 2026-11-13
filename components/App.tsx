"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Data } from "@/lib/types";
import { computeRanking } from "@/lib/stats";
import Ranking from "./Ranking";
import Matches from "./Matches";
import LoginModal from "./LoginModal";
import AdminModal from "./AdminModal";
import ResultModal from "./ResultModal";

const AVISOS: Record<string, string> = {
  negado: "Esse e-mail Google não está autorizado a enviar resultados. Peça ao organizador para cadastrá-lo.",
  cancelado: "Login cancelado. Tente novamente.",
  erro: "Não foi possível entrar com o Google agora. Tente novamente.",
  indisponivel: "O login com Google ainda não está configurado.",
};

export default function App({
  initial,
  initialAdmin,
  initialUser,
}: {
  initial: Data;
  initialAdmin: boolean;
  initialUser: string | null;
}) {
  const [data, setData] = useState<Data>(initial);
  const [admin, setAdmin] = useState(initialAdmin);
  const [user, setUser] = useState<string | null>(initialUser);
  const [aviso, setAviso] = useState("");
  const [modal, setModal] = useState<null | "login" | "admin" | "result">(null);
  const [selected, setSelected] = useState<number | null>(null);
  const matchesRef = useRef<HTMLElement>(null);

  const reload = useCallback(async () => {
    const res = await fetch("/api/data", { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, []);

  // Volta do login com Google: ?enviar=1 abre o formulário; ?acesso=... mostra o motivo da falha
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (!q.has("enviar") && !q.has("acesso")) return;
    if (q.get("enviar") && initialUser) setModal("result");
    const motivo = q.get("acesso");
    if (motivo) setAviso(AVISOS[motivo] ?? AVISOS.erro);
    window.history.replaceState(null, "", window.location.pathname);
  }, [initialUser]);

  const openResult = () => {
    if (user) setModal("result");
    else window.location.href = "/api/auth/google/start"; // login com Google
  };

  const userLogout = async () => {
    await fetch("/api/user/logout", { method: "POST" });
    setUser(null);
    setModal(null);
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/logo.webp" alt="1º Ranking Lazuli de Tênis" width={200} height={200} />
        <div className="actions">
          <button className="btn primary" onClick={openResult}>
            Enviar resultado
          </button>
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
      {modal === "result" && user && (
        <ResultModal
          data={data}
          email={user}
          onClose={() => setModal(null)}
          onChanged={reload}
          onSessionExpired={() => {
            setUser(null);
            setModal(null);
            setAviso("Sua sessão expirou ou seu e-mail não está mais autorizado. Entre com o Google novamente.");
          }}
          onLogout={userLogout}
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
