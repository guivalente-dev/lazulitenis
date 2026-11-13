import { Pool, type PoolClient } from "pg";
import type { Data } from "./types";

/** Jogadores da planilha original (aba "Jogadores"). Só é usado na 1ª execução. */
const INITIAL_PLAYERS = [
  "Facco", "Masson", "Fabiano", "João Barata", "Gustavo", "Amilton", "Marcio", "Rafael",
  "Willian", "Marcos", "Anderson", "Skimo", "Filipe", "Lucas", "Victoria", "Mariane",
  "Guilherme", "Daniel", "Leandro", "Matheus", "Augusto", "Fabio",
];

type G = typeof globalThis & { __pool?: Pool; __schema?: Promise<void> };
const g = globalThis as G;

export class DbNotConfigured extends Error {
  constructor() {
    super("DATABASE_URL não configurada");
  }
}

export function pool(): Pool {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new DbNotConfigured();
  if (!g.__pool) {
    g.__pool = new Pool({ connectionString: url, max: 3, idleTimeoutMillis: 10_000 });
  }
  return g.__pool;
}

async function createSchema(): Promise<void> {
  const client: PoolClient = await pool().connect();
  try {
    await client.query("BEGIN");
    // Evita corrida entre várias instâncias subindo ao mesmo tempo
    await client.query("SELECT pg_advisory_xact_lock(727274)");
    await client.query(`
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS players_name_uq ON players (lower(name));
      CREATE TABLE IF NOT EXISTS matches (
        id SERIAL PRIMARY KEY,
        winner_id INT NOT NULL REFERENCES players(id),
        loser_id  INT NOT NULL REFERENCES players(id),
        score TEXT NOT NULL,
        wo BOOLEAN NOT NULL DEFAULT false,
        played_on DATE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CHECK (winner_id <> loser_id)
      );
      -- Um confronto só pode acontecer uma vez (independe de quem é o vencedor)
      CREATE UNIQUE INDEX IF NOT EXISTS matches_pair_uq
        ON matches (LEAST(winner_id, loser_id), GREATEST(winner_id, loser_id));
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
      -- Quem enviou o resultado (e-mail Google); nulo quando lançado pelo admin
      ALTER TABLE matches ADD COLUMN IF NOT EXISTS submitted_by TEXT;
      -- E-mails autorizados a enviar resultados pelo site
      CREATE TABLE IF NOT EXISTS allowed_emails (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        label TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS allowed_emails_uq ON allowed_emails (lower(email));
    `);
    const first = await client.query(
      "INSERT INTO meta (key, value) VALUES ('seeded', '1') ON CONFLICT DO NOTHING RETURNING key",
    );
    if (first.rowCount) {
      await client.query(
        "INSERT INTO players (name) SELECT unnest($1::text[]) ON CONFLICT DO NOTHING",
        [INITIAL_PLAYERS],
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Cria as tabelas (e cadastra os jogadores da planilha) na primeira chamada. */
export function ensureSchema(): Promise<void> {
  if (!g.__schema) {
    g.__schema = createSchema().catch((e) => {
      g.__schema = undefined; // tenta de novo na próxima requisição
      throw e;
    });
  }
  return g.__schema;
}

export async function getData(): Promise<Data> {
  await ensureSchema();
  const p = pool();
  const [players, matches] = await Promise.all([
    p.query("SELECT id, name FROM players ORDER BY lower(name)"),
    p.query(
      `SELECT id, winner_id, loser_id, score, wo, to_char(played_on, 'YYYY-MM-DD') AS played_on
         FROM matches ORDER BY played_on DESC, id DESC`,
    ),
  ]);
  return { players: players.rows, matches: matches.rows };
}
