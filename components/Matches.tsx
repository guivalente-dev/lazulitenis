"use client";

import { useMemo, useState } from "react";
import type { Match, Player } from "@/lib/types";
import type { Row } from "@/lib/stats";
import { compareText, POINTS } from "@/lib/stats";
import { formatDate } from "@/lib/format";
import { formatScore, scoreMargin } from "@/lib/score";

type Key = "date" | "wres" | "winner" | "score" | "loser" | "lres";

type Line = {
  id: number;
  date: string;
  wId: number;
  wName: string;
  lId: number;
  lName: string;
  score: string;
  wo: boolean;
  lPts: number;
};

const COLUMNS: { key: Key; label: string; text?: boolean; cls?: string }[] = [
  { key: "date", label: "Data", cls: "c-date" },
  { key: "wres", label: "Resultado", cls: "c-res" },
  { key: "winner", label: "Vencedor", text: true },
  { key: "score", label: "Parciais" },
  { key: "loser", label: "Perdedor", text: true },
  { key: "lres", label: "Resultado", cls: "c-res" },
];

function sortValue(l: Line, key: Key): number | string {
  switch (key) {
    case "date":
      return l.date;
    case "wres":
      return POINTS.win;
    case "winner":
      return l.wName;
    case "score":
      return scoreMargin(l.score);
    case "loser":
      return l.lName;
    case "lres":
      return l.lPts;
  }
}

export default function Matches({
  players,
  matches,
  selected,
  onClear,
  admin,
  onChanged,
  onSessionExpired,
}: {
  players: Player[];
  matches: Match[];
  selected: Row | null;
  onClear: () => void;
  admin: boolean;
  onChanged: () => Promise<void>;
  onSessionExpired: () => void;
}) {
  // Padrão: do mais novo para o mais antigo
  const [sort, setSort] = useState<{ key: Key; dir: "asc" | "desc" }>({ key: "date", dir: "desc" });
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const lines = useMemo<Line[]>(() => {
    const names = new Map(players.map((p) => [p.id, p.name]));
    return matches
      .filter((m) => !selected || m.winner_id === selected.id || m.loser_id === selected.id)
      .map((m) => ({
        id: m.id,
        date: m.played_on,
        wId: m.winner_id,
        wName: names.get(m.winner_id) ?? "?",
        lId: m.loser_id,
        lName: names.get(m.loser_id) ?? "?",
        score: m.score,
        wo: m.wo,
        lPts: m.wo ? POINTS.wo : POINTS.loss,
      }));
  }, [players, matches, selected]);

  const sorted = useMemo(() => {
    const mul = sort.dir === "asc" ? 1 : -1;
    return [...lines].sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      const c =
        typeof va === "string" && typeof vb === "string"
          ? sort.key === "date"
            ? va < vb
              ? -1
              : va > vb
                ? 1
                : 0
            : compareText(va, vb)
          : (va as number) - (vb as number);
      // empate: sempre o lançamento mais recente primeiro (ou último, se a ordem for ascendente)
      return c * mul || (a.id - b.id) * mul;
    });
  }, [lines, sort]);

  const toggle = (key: Key, text?: boolean) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: text ? "asc" : "desc" },
    );

  const remove = async (id: number) => {
    if (confirmId !== id) {
      setConfirmId(id);
      setTimeout(() => setConfirmId((c) => (c === id ? null : c)), 4000);
      return;
    }
    setConfirmId(null);
    setError("");
    const res = await fetch(`/api/matches/${id}`, { method: "DELETE" });
    if (res.status === 401) return onSessionExpired();
    if (!res.ok) return setError((await res.json().catch(() => null))?.error ?? "Erro ao excluir.");
    await onChanged();
  };

  return (
    <>
      {selected && (
        <div className="filterbar">
          <span>
            Jogos de <strong>{selected.name}</strong> ({lines.length})
          </span>
          <button className="btn small" onClick={onClear}>
            Limpar filtro ✕
          </button>
        </div>
      )}
      {error && <p className="notice error">{error}</p>}
      <div className="card">
        <div className="scroll matches-scroll">
          <table className="grid matches">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key + c.label}
                    className={c.cls}
                    onClick={() => toggle(c.key, c.text)}
                    aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <span>{c.label}</span>
                    <i className="arrow">{sort.key === c.key ? (sort.dir === "asc" ? "▲" : "▼") : ""}</i>
                  </th>
                ))}
                {admin && <th className="c-del" aria-label="Excluir" />}
              </tr>
            </thead>
            <tbody>
              {sorted.map((l) => (
                <tr key={l.id}>
                  <td className="c-date">{formatDate(l.date)}</td>
                  <td className="c-res res-win">Vitória (+{POINTS.win})</td>
                  <td className={selected?.id === l.wId ? "me" : undefined}>{l.wName}</td>
                  <td className="num">{formatScore(l.score)}</td>
                  <td className={selected?.id === l.lId ? "me" : undefined}>{l.lName}</td>
                  <td className={`c-res ${l.wo ? "res-wo" : "res-loss"}`}>
                    {l.wo ? `WO (+${l.lPts})` : `Derrota (+${l.lPts})`}
                  </td>
                  {admin && (
                    <td className="c-del">
                      <button
                        className={`link-danger ${confirmId === l.id ? "armed" : ""}`}
                        onClick={() => remove(l.id)}
                        title="Excluir este lançamento"
                      >
                        {confirmId === l.id ? "Confirmar?" : "Excluir"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={admin ? 7 : 6} className="empty">
                    {selected ? `Nenhum jogo de ${selected.name} ainda.` : "Nenhum jogo lançado ainda."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
