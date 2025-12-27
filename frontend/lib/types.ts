export type MatchResult = "Pending" | "HomeWin" | "AwayWin" | "Draw";

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
