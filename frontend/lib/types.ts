export type MatchResult = "Pending" | "HomeWin" | "AwayWin" | "Draw";

// V2: Locked odds for guaranteed payouts (1.25x - 1.95x range)
export interface LockedOdds {
  home_odds: number; // e.g., 12500 = 1.25x
  away_odds: number; // e.g., 19500 = 1.95x
  draw_odds: number; // e.g., 15000 = 1.50x
  locked: boolean;
}

export interface MatchData {
  seasonId: string;
  turn: number;
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  homeOdds: number;
  awayOdds: number;
  drawOdds: number;
  result: MatchResult;
  randomSeed?: string;
  // V2: Locked odds for guaranteed payouts
  lockedOdds?: LockedOdds | null;
}

export interface BetData {
  matchId: string;
  prediction: MatchResult;
  stake: number;
  odds: number;
  bettor: string;
  hasBadge: boolean;
  settled: boolean;
}

export interface BadgeData {
  teamName: string;
  teamId: number;
  bonusBps: number;
}

export interface SeasonData {
  seasonId: string;
  currentTurn: number;
  teamScores: number[];
  totalBetsCollected: number;
  seasonPool: number;
  isFinished: boolean;
}

export interface UserBalance {
  league: number;
  badges: BadgeData[];
  bets: BetData[];
}
