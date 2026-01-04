// Betslip types matching Rust smart contract

export type BetType = "Single" | "Parlay" | "SystemBet";

export type MatchResult = "Pending" | "HomeWin" | "AwayWin" | "Draw";

export interface SingleBet {
  match_id: string;
  prediction: MatchResult;
  odds: number; // Basis points (10000 = 1.0x)
}

export interface BetslipData {
  slip_id: string;
  bettor: string;
  bet_type: BetType;
  bets: SingleBet[];
  total_stake: number;
  stake_per_bet: number;
  potential_payout: number;
  badges: number[]; // Team IDs (0-19)
  settled: boolean;
  payout_amount: number;
  timestamp: number;
}

export interface LiquidityPoolData {
  pool_id: string;
  total_liquidity: number;
  total_bets_in_play: number;
  total_paid_out: number;
  total_collected: number;
  protocol_revenue: number;
  house_balance: number;
  is_active: boolean;
  min_liquidity: number;
}

export interface MatchData {
  season_id: string;
  turn: number;
  match_id: number;
  home_team: string;
  away_team: string;
  home_odds: number;
  away_odds: number;
  draw_odds: number;
  result: MatchResult;
  random_seed: string | null;
  total_home_bets: number;
  total_away_bets: number;
  total_draw_bets: number;
}

export interface SeasonData {
  season_id: string;
  current_turn: number;
  team_scores: number[]; // 20 teams
  total_bets_collected: number;
  season_pool: number;
  is_finished: boolean;
  winner_team_id: number | null;
}

// Constants from smart contract
export const MIN_BET = 100;
export const MAX_BET = 1_000_000;
export const MAX_BETS_PER_SLIP = 20;
export const HOUSE_EDGE_BPS = 400; // 4%
export const BADGE_BONUS_BPS = 500; // 5%
export const PROTOCOL_REVENUE_BPS = 200; // 2%
