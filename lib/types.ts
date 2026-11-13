export type Player = { id: number; name: string };

export type Match = {
  id: number;
  winner_id: number;
  loser_id: number;
  /** Placar sempre do ponto de vista do vencedor, ex: "6x4 3x6 10x8" */
  score: string;
  wo: boolean;
  /** YYYY-MM-DD */
  played_on: string;
};

export type Data = { players: Player[]; matches: Match[] };
