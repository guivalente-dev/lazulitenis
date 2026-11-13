"use client";

import { useMemo, useState } from "react";
import type { Data } from "@/lib/types";
import { formatScore, parseScore } from "@/lib/score";
import { todayLocalISO } from "@/lib/format";

const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

export default function ResultModal({
  data,
  email,
  onClose,
  onChanged,
  onSessionExpired,
  onLogout,
}: {
  data: Data;
  email: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onSessionExpired: () => void;
  onLogout: () => void;
}) {
  const [date, setDate] = useState("");
  const [winner, setWinner] = useState("");
  const [loser, setLoser] = useState("");
  const [score, setScore] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const sorted = useMemo(
    () => [...data.players].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [data.players],
  );
  const played = useMemo(() => new Set(data.matches.map((m) => pairKey(m.winner_id, m.loser_id))), [data.matches]);
  const name = (id: string) => data.players.find((p) => String(p.id) === id)?.name ?? "";

  const alreadyPlayed = winner && loser && played.has(pairKey(Number(winner), Number(loser)));
  const isWo = /^wo$/i.test(score.trim());
  const parsed = score.trim() && !isWo ? parseScore(score) : null;
  // O placar é do ponto de vista do vencedor: o 1º número precisa ser dele
  const inverted = parsed?.ok === true && parsed.winnerSide !== 1;
  const scoreOk = isWo || (parsed?.ok === true && !inverted);
  const canSubmit = winner && loser && winner !== loser && !alreadyPlayed && scoreOk;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setOk("");
    setBusy(true);
    try {
      const res = await fetch("/api/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, winner: Number(winner), loser: Number(loser), score }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) return onSessionExpired();
      if (!res.ok) {
        setError(body.error ?? "Erro ao enviar.");
        if (res.status === 409) await onChanged(); // alguém pode ter lançado antes
        return;
      }
      const w = data.players.find((p) => p.id === body.winner)?.name;
      const l = data.players.find((p) => p.id === body.loser)?.name;
      setOk(`Resultado salvo: ${w} venceu ${l} (${formatScore(String(body.score))}). O ranking já foi atualizado.`);
      setWinner("");
      setLoser("");
      setScore("");
      setDate("");
      await onChanged(); // ranking e tabela de jogos atualizam na hora
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <h2>Enviar resultado</h2>
          <button className="x" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        <p className="muted who">
          Enviando como <strong>{email}</strong> ·{" "}
          <button type="button" className="link-btn" onClick={onLogout}>
            sair
          </button>
        </p>

        <form className="form" onSubmit={submit}>
          <label className="field">
            Data do jogo (opcional)
            <input type="date" value={date} max={todayLocalISO()} onChange={(e) => setDate(e.target.value)} />
            <small className="hint">Sem data, usa o dia do envio.</small>
          </label>

          <div className="row2">
            <label className="field">
              Vencedor
              <select value={winner} onChange={(e) => setWinner(e.target.value)}>
                <option value="">Selecione…</option>
                {sorted.map((p) => (
                  <option key={p.id} value={p.id} disabled={String(p.id) === loser}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Perdedor
              <select value={loser} onChange={(e) => setLoser(e.target.value)}>
                <option value="">Selecione…</option>
                {sorted.map((p) => {
                  const done = winner && played.has(pairKey(Number(winner), p.id));
                  return (
                    <option key={p.id} value={p.id} disabled={String(p.id) === winner || !!done}>
                      {p.name}
                      {done ? " (já jogaram)" : ""}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>

          <label className="field">
            Placar do jogo
            <input
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="6x2 3x6 10x8"
              inputMode="text"
              autoComplete="off"
            />
            <small className="hint">
              Escreva os sets no padrão <strong>6x2 3x6 10x8</strong>, sempre com os games do <strong>vencedor
              primeiro</strong> e um espaço entre os sets. Se o perdedor não compareceu, escreva apenas{" "}
              <strong>WO</strong>.
            </small>
            {isWo && <small className="hint good">WO: {name(winner) || "o vencedor"} vence por 6x0 6x0.</small>}
            {parsed &&
              (!parsed.ok ? (
                <small className="hint bad">{parsed.error}</small>
              ) : inverted ? (
                <small className="hint bad">
                  Esse placar indica que o vencedor perdeu. Escreva primeiro os games do vencedor.
                </small>
              ) : (
                <small className="hint good">
                  {Math.max(parsed.setsA, parsed.setsB)} sets a {Math.min(parsed.setsA, parsed.setsB)} · salvo como{" "}
                  {parsed.normalized}
                </small>
              ))}
          </label>

          {alreadyPlayed && <p className="notice error">Esse jogo já foi realizado.</p>}
          {error && <p className="notice error">{error}</p>}
          {ok && <p className="notice ok">{ok}</p>}

          <button className="btn primary" disabled={!canSubmit || busy}>
            {busy ? "Enviando…" : "Enviar resultado"}
          </button>
        </form>
      </div>
    </div>
  );
}
