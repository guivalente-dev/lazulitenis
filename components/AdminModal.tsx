"use client";

import { useEffect, useMemo, useState } from "react";
import type { Data } from "@/lib/types";
import { formatScore, parseScore } from "@/lib/score";
import { todayLocalISO } from "@/lib/format";
import DateInput from "./DateInput";

type Tab = "match" | "players";

const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

export default function AdminModal({
  data,
  onClose,
  onChanged,
  onSessionExpired,
}: {
  data: Data;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onSessionExpired: () => void;
}) {
  const [tab, setTab] = useState<Tab>("match");
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <h2>Painel admin</h2>
          <button className="x" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="tabs">
          <button className={tab === "match" ? "on" : ""} onClick={() => setTab("match")}>
            Lançar jogo
          </button>
          <button className={tab === "players" ? "on" : ""} onClick={() => setTab("players")}>
            Jogadores e acesso
          </button>
        </div>
        {tab === "match" ? (
          <MatchForm data={data} onChanged={onChanged} onSessionExpired={onSessionExpired} />
        ) : (
          <PlayersTab data={data} onChanged={onChanged} onSessionExpired={onSessionExpired} />
        )}
      </div>
    </div>
  );
}

type Props = { data: Data; onChanged: () => Promise<void>; onSessionExpired: () => void };

function MatchForm({ data, onChanged, onSessionExpired }: Props) {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [date, setDate] = useState(todayLocalISO());
  const [mode, setMode] = useState<"score" | "wo">("score");
  const [score, setScore] = useState("");
  const [woLoser, setWoLoser] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const played = useMemo(() => new Set(data.matches.map((m) => pairKey(m.winner_id, m.loser_id))), [data.matches]);
  const sorted = useMemo(
    () => [...data.players].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [data.players],
  );
  const name = (id: string) => data.players.find((p) => String(p.id) === id)?.name ?? "";

  const alreadyPlayed = p1 && p2 && played.has(pairKey(Number(p1), Number(p2)));
  const parsed = mode === "score" && score.trim() ? parseScore(score) : null;

  const reset = () => {
    setScore("");
    setWoLoser("");
    setP1("");
    setP2("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setOk("");
    setBusy(true);
    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p1: Number(p1),
          p2: Number(p2),
          date,
          ...(mode === "wo" ? { wo: true, woLoser: Number(woLoser) } : { score }),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) return onSessionExpired();
      if (!res.ok) {
        setError(body.error ?? "Erro ao salvar.");
        if (res.status === 409) await onChanged(); // outro admin pode ter lançado antes
        return;
      }
      const w = data.players.find((p) => p.id === body.winner)?.name;
      const l = data.players.find((p) => p.id === body.loser)?.name;
      setOk(`Salvo: ${w} venceu ${l} (${formatScore(String(body.score))})`);
      reset();
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  const canSubmit =
    p1 && p2 && p1 !== p2 && !alreadyPlayed && date && (mode === "wo" ? woLoser : parsed?.ok === true);

  return (
    <form className="form" onSubmit={submit}>
      <div className="row2">
        <label className="field">
          Jogador 1
          <select value={p1} onChange={(e) => (setP1(e.target.value), setWoLoser(""))}>
            <option value="">Selecione…</option>
            {sorted.map((p) => (
              <option key={p.id} value={p.id} disabled={String(p.id) === p2}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Jogador 2
          <select value={p2} onChange={(e) => (setP2(e.target.value), setWoLoser(""))}>
            <option value="">Selecione…</option>
            {sorted.map((p) => {
              const done = p1 && played.has(pairKey(Number(p1), p.id));
              return (
                <option key={p.id} value={p.id} disabled={String(p.id) === p1 || !!done}>
                  {p.name}
                  {done ? " (já jogaram)" : ""}
                </option>
              );
            })}
          </select>
        </label>
      </div>

      <label className="field">
        Data do jogo
        <DateInput value={date} onChange={setDate} max={todayLocalISO()} />
      </label>

      <div className="seg" role="tablist">
        <button type="button" className={mode === "score" ? "on" : ""} onClick={() => setMode("score")}>
          Placar
        </button>
        <button type="button" className={mode === "wo" ? "on" : ""} onClick={() => setMode("wo")}>
          WO
        </button>
      </div>

      {mode === "score" ? (
        <label className="field">
          Placar (na ordem Jogador 1 x Jogador 2, um par por set)
          <input
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="6x2 3x6 10x8"
            inputMode="text"
            autoComplete="off"
          />
          {parsed &&
            (parsed.ok ? (
              <small className="hint good">
                Vencedor: <strong>{name(parsed.winnerSide === 1 ? p1 : p2) || `Jogador ${parsed.winnerSide}`}</strong>{" "}
                ({Math.max(parsed.setsA, parsed.setsB)} sets a {Math.min(parsed.setsA, parsed.setsB)}) · salvo como{" "}
                {parsed.normalized}
              </small>
            ) : (
              <small className="hint bad">{parsed.error}</small>
            ))}
        </label>
      ) : (
        <label className="field">
          Quem deu WO (perde com 0 pontos)
          <select value={woLoser} onChange={(e) => setWoLoser(e.target.value)} disabled={!p1 || !p2}>
            <option value="">Selecione…</option>
            {p1 && <option value={p1}>{name(p1)}</option>}
            {p2 && <option value={p2}>{name(p2)}</option>}
          </select>
        </label>
      )}

      {alreadyPlayed && <p className="notice error">Esse jogo já foi realizado.</p>}
      {error && <p className="notice error">{error}</p>}
      {ok && <p className="notice ok">{ok}</p>}

      <button className="btn primary" disabled={!canSubmit || busy}>
        {busy ? "Salvando…" : "Salvar resultado"}
      </button>
    </form>
  );
}

type AdminPlayer = { id: number; name: string; email: string | null };

/** Jogadores: nome + e-mail Google. Jogador com e-mail pode entrar e enviar resultados. */
function PlayersTab({ data, onChanged, onSessionExpired }: Props) {
  const [items, setItems] = useState<AdminPlayer[] | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<AdminPlayer | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => {
    const c = new Map<number, number>();
    for (const m of data.matches) {
      c.set(m.winner_id, (c.get(m.winner_id) ?? 0) + 1);
      c.set(m.loser_id, (c.get(m.loser_id) ?? 0) + 1);
    }
    return c;
  }, [data.matches]);

  async function load() {
    const res = await fetch("/api/players", { cache: "no-store" });
    if (res.status === 401) return onSessionExpired();
    if (!res.ok) return setError("Não foi possível carregar a lista.");
    setItems((await res.json()).players);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function call(url: string, method: string, body?: unknown) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 401) {
        onSessionExpired();
        return false;
      }
      if (!res.ok) {
        setError((await res.json().catch(() => null))?.error ?? "Erro na operação.");
        return false;
      }
      await Promise.all([load(), onChanged()]);
      return true;
    } finally {
      setBusy(false);
    }
  }

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await call("/api/players", "POST", { name, email })) {
      setName("");
      setEmail("");
    }
  };

  return (
    <div className="form emails">
      <p className="muted">
        Cada jogador pode ter um e-mail Google. Quem tem e-mail cadastrado entra com a conta Google e envia resultados
        pelo botão “Enviar resultado”. Sem e-mail, o jogador só aparece no ranking. Apagar o e-mail bloqueia o acesso na
        hora.
      </p>
      <form className="addrow" onSubmit={add}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do jogador" maxLength={60} />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail Google (opcional)"
          autoComplete="off"
        />
        <button className="btn primary" disabled={busy || name.trim().length < 2}>
          Adicionar
        </button>
      </form>
      {error && <p className="notice error">{error}</p>}
      {items === null ? (
        <p className="muted">Carregando…</p>
      ) : (
        <ul className="plist">
          {items.map((p) => {
            const n = counts.get(p.id) ?? 0;
            return (
              <li key={p.id}>
                {editing?.id === p.id ? (
                  <form
                    className="addrow"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (await call(`/api/players/${p.id}`, "PATCH", { name: editing.name, email: editing.email ?? "" })) {
                        setEditing(null);
                      }
                    }}
                  >
                    <input
                      autoFocus
                      value={editing.name}
                      maxLength={60}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    />
                    <input
                      type="email"
                      value={editing.email ?? ""}
                      placeholder="E-mail Google (opcional)"
                      onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                    />
                    <button className="btn small primary" disabled={busy}>
                      Salvar
                    </button>
                    <button type="button" className="btn small" onClick={() => setEditing(null)}>
                      Cancelar
                    </button>
                  </form>
                ) : (
                  <>
                    <span className="pname">
                      <strong>{p.name}</strong>{" "}
                      {p.email ? <span className="muted">{p.email}</span> : <span className="muted">· sem acesso</span>}
                    </span>
                    <span className="muted">
                      {n} {n === 1 ? "jogo" : "jogos"}
                    </span>
                    <button className="btn small" onClick={() => setEditing(p)}>
                      Editar
                    </button>
                    {n === 0 && (
                      <button
                        className={`link-danger ${confirmId === p.id ? "armed" : ""}`}
                        onClick={async () => {
                          if (confirmId !== p.id) {
                            setConfirmId(p.id);
                            setTimeout(() => setConfirmId((c) => (c === p.id ? null : c)), 4000);
                            return;
                          }
                          setConfirmId(null);
                          await call(`/api/players/${p.id}`, "DELETE");
                        }}
                      >
                        {confirmId === p.id ? "Confirmar?" : "Excluir"}
                      </button>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
