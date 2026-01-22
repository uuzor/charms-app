// Betslip types matching Rust smart contract

export type BetType = "Single" | "Parlay" | "SystemBet";

export type MatchResult = "Pending" | "HomeWin" | "AwayWin" | "Draw";

export interface SingleBet {
  match_id: string;
  prediction: MatchResult;
  odds: number; // Basis points (10000 = 1.0x)
}

// V2: Locked odds for matches (1.25x - 1.95x range)
export interface LockedOdds {
  home_odds: number; // e.g., 12500 = 1.25x
  away_odds: number; // e.g., 19500 = 1.95x
  draw_odds: number; // e.g., 15000 = 1.50x
  locked: boolean;
}

// V2: Bet allocation per match (odds-weighted)
export interface BetAllocation {
  match_id: string;
  allocation: number; // Amount allocated to this match
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
  // V2: Odds-weighted allocations
  allocations: BetAllocation[];
  locked_multiplier: number; // Capped parlay multiplier (10000-12500)
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
  // V2: LP share tracking
  total_shares: number;
}

// V2: LP Share token data
export interface LPShareData {
  share_id: string;
  lp_address: string;
  shares: number;
  initial_deposit: number;
  total_withdrawn: number;
  deposit_timestamp: number;
}

// V2: LP Position tracking
export interface LPPosition {
  lp_address: string;
  shares: number;
  initial_deposit: number;
  total_withdrawn: number;
  current_value: number;
  unrealized_profit: number; // Can be negative
  realized_profit: number;
  roi_bps: number; // Basis points
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
  // V2: Locked odds for guaranteed payouts
  locked_odds: LockedOdds | null;
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

// V2: Risk Management Constants
export const MAX_PAYOUT_PER_BET = 100_000;
export const MAX_ROUND_PAYOUTS = 500_000;
export const MAX_PARLAY_MULTIPLIER = 12500; // 1.25x
export const WITHDRAWAL_FEE_BPS = 50; // 0.5%
export const MINIMUM_LIQUIDITY_LOCK = 1000; // shares

// V2: Locked odds range (compressed)
export const MIN_LOCKED_ODDS = 12500; // 1.25x
export const MAX_LOCKED_ODDS = 19500; // 1.95x

// Helper functions for odds display
export function formatOdds(odds: number): string {
  return (odds / 10000).toFixed(2) + 'x';
}

export function formatCurrency(amount: number): string {
  return amount.toLocaleString() + ' LEAGUE';
}

export function calculateParlayMultiplier(numBets: number): number {
  if (numBets === 1) return 10000; // 1.0x
  if (numBets === 2) return 10500; // 1.05x
  if (numBets === 3) return 11000; // 1.10x
  if (numBets === 4) return 11300; // 1.13x
  if (numBets === 5) return 11600; // 1.16x
  if (numBets === 6) return 11900; // 1.19x
  if (numBets === 7) return 12100; // 1.21x
  if (numBets === 8) return 12300; // 1.23x
  if (numBets === 9) return 12400; // 1.24x
  return 12500; // 1.25x (max for 10+)
}
