"use client";

import { useEffect, useState } from "react";

type Entry = { id: number; quando: string; actor: string; action: string; detail: string };

const LABELS: Record<string, string> = {
  login: "Login",
  login_senha: "Login (senha)",
  login_negado: "Login negado",
  jogo_enviado: "Jogo enviado",
  jogo_lancado: "Jogo lançado",
  jogo_apagado: "Jogo apagado",
  jogador_criado: "Jogador criado",
  jogador_editado: "Jogador editado",
  jogador_excluido: "Jogador excluído",
  admin_concedido: "Admin concedido",
  admin_removido: "Admin removido",
};

/** Log de tudo que foi feito no site. Só o owner abre. */
export default function LogModal({ onClose, onSessionExpired }: { onClose: () => void; onSessionExpired: () => void }) {
  const [items, setItems] = useState<Entry[] | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const res = await fetch("/api/log", { cache: "no-store" });
    if (res.status === 401) return onSessionExpired();
    if (!res.ok) return setError("Não foi possível carregar o log.");
    setItems((await res.json()).log);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide">
        <div className="modal-head">
          <h2>Log de atividades</h2>
          <button className="x" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        <p className="muted">
          Últimas 500 ações, da mais recente para a mais antiga.{" "}
          <button type="button" className="link-btn" onClick={load}>
            atualizar
          </button>
        </p>
        {error && <p className="notice error">{error}</p>}
        {items === null ? (
          !error && <p className="muted">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="muted">Nada registrado ainda.</p>
        ) : (
          <div className="log-scroll">
            <table className="log">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Quem</th>
                  <th>Ação</th>
                  <th>Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => (
                  <tr key={e.id}>
                    <td className="nowrap">{e.quando}</td>
                    <td>{e.actor}</td>
                    <td className="nowrap">{LABELS[e.action] ?? e.action}</td>
                    <td>{e.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
