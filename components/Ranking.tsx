"use client";

import { useMemo, useState } from "react";
import { compareText, type Row } from "@/lib/stats";
import { formatDate } from "@/lib/format";
import { formatScore } from "@/lib/score";

type Key = "rank" | "name" | "points" | "games" | "wins" | "losses" | "wo" | "sets" | "pct" | "form";

const COLUMNS: { key: Key; label: string; short?: string; text?: boolean; cls?: string }[] = [
  { key: "rank", label: "Posição", short: "Pos", cls: "c-pos" },
  { key: "name", label: "Jogador", text: true, cls: "c-name" },
  { key: "points", label: "Pontos", short: "Pts" },
  { key: "games", label: "Total Jogos", short: "Jogos" },
  { key: "wins", label: "Vitórias", short: "V" },
  { key: "losses", label: "Derrotas", short: "D" },
  { key: "wo", label: "WO" },
  { key: "sets", label: "Sets Ganhos", short: "Sets" },
  { key: "pct", label: "Aprov. Vitórias", short: "%" },
  { key: "form", label: "Últ. 5 Jogos", short: "Últ. 5", cls: "c-form" },
];

const POSITIONS_HIGHLIGHT = 8;

function value(r: Row, key: Key): number | string {
  switch (key) {
    case "name":
      return r.name;
    case "pct":
      return r.pct ?? -1;
    case "form":
      return r.last5.filter((x) => x.r === "V").length;
    default:
      return r[key];
  }
}

function dotTitle(x: Row["last5"][number]) {
  const what = x.r === "V" ? "Vitória sobre" : x.r === "W" ? "WO contra" : "Derrota para";
  return `${what} ${x.opp} (${formatScore(x.score)}) · ${formatDate(x.date)}`;
}

export default function Ranking({
  rows,
  selected,
  onSelect,
}: {
  rows: Row[];
  selected: number | null;
  onSelect: (id: number) => void;
}) {
  const [sort, setSort] = useState<{ key: Key; dir: "asc" | "desc" }>({ key: "points", dir: "desc" });

  const sorted = useMemo(() => {
    const mul = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = value(a, sort.key);
      const vb = value(b, sort.key);
      const c =
        typeof va === "string" && typeof vb === "string" ? compareText(va, vb) : (va as number) - (vb as number);
      return c * mul || a.rank - b.rank; // empate: posição oficial
    });
  }, [rows, sort]);

  const toggle = (key: Key, text?: boolean) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: text || key === "rank" ? "asc" : "desc" },
    );

  return (
    <div className="card">
      <div className="scroll ranking-scroll">
        <table className="grid ranking">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className={c.cls}
                  onClick={() => toggle(c.key, c.text)}
                  aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                >
                  <span className="lg">{c.label}</span>
                  <span className="sm">{c.short ?? c.label}</span>
                  <i className="arrow">{sort.key === c.key ? (sort.dir === "asc" ? "▲" : "▼") : ""}</i>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr
                key={r.id}
                className={selected === r.id ? "selected" : undefined}
                onClick={() => onSelect(r.id)}
                title={selected === r.id ? "Clique para remover o filtro" : "Clique para filtrar os jogos"}
              >
                <td className={`c-pos ${r.rank <= POSITIONS_HIGHLIGHT && r.games > 0 ? "pos-top" : ""}`}>{r.rank}</td>
                <td className="c-name">{r.name}</td>
                <td className="num strong">{r.points}</td>
                <td className="num">{r.games}</td>
                <td className="num">{r.wins}</td>
                <td className="num">{r.losses}</td>
                <td className="num">{r.wo}</td>
                <td className="num">{r.sets}</td>
                <td className="num">{r.pct === null ? "—" : `${Math.round(r.pct * 100)}%`}</td>
                <td className="c-form">
                  <span className="dots">
                    {Array.from({ length: 5 }, (_, i) => {
                      const x = r.last5[i - (5 - r.last5.length)];
                      return x ? (
                        <span
                          key={i}
                          className={`dot ${x.r === "V" ? "win" : x.r === "D" ? "loss" : "wo"}`}
                          title={dotTitle(x)}
                        />
                      ) : (
                        <span key={i} className="dot empty" />
                      );
                    })}
                  </span>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="empty">
                  Nenhum jogador cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
