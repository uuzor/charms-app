import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTokenAmount(amount: number): string {
  return new Intl.NumberFormat("en-US").format(amount);
}

export function formatOdds(oddsBps: number): string {
  return (oddsBps / 10000).toFixed(2) + "x";
}

export function calculatePayout(
  stake: number,
  odds: number,
  hasBadge: boolean = false,
  bonusBps: number = 500
): number {
  let finalOdds = odds;

  // Apply badge bonus
  if (hasBadge) {
    finalOdds = finalOdds + Math.floor((finalOdds * bonusBps) / 10000);
  }

  // Apply house edge (4%)
  const HOUSE_EDGE_BPS = 400;
  finalOdds = finalOdds - Math.floor((finalOdds * HOUSE_EDGE_BPS) / 10000);

  // Calculate payout
  return Math.floor((stake * finalOdds) / 10000);
}

export function generateMatchResult(
  randomSeed: string,
  matchId: number
): "HomeWin" | "AwayWin" | "Draw" {
  // Simple hash function (in production, use actual crypto hash)
  let hash = 0;
  const input = randomSeed + matchId.toString();
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  const value = Math.abs(hash) % 100;

  if (value < 45) return "HomeWin";
  if (value < 75) return "Draw";
  return "AwayWin";
}

export const TEAMS = [
  "Arsenal",
  "Aston Villa",
  "Bournemouth",
  "Brentford",
  "Brighton",
  "Chelsea",
  "Crystal Palace",
  "Everton",
  "Fulham",
  "Ipswich Town",
  "Leicester City",
  "Liverpool",
  "Manchester City",
  "Manchester United",
  "Newcastle",
  "Nottingham Forest",
  "Southampton",
  "Tottenham",
  "West Ham",
  "Wolves",
] as const;

export type Team = (typeof TEAMS)[number];

export const TEAM_COLORS: Record<string, string> = {
  Arsenal: "#EF0107",
  "Aston Villa": "#95BFE5",
  Bournemouth: "#DA291C",
  Brentford: "#F F0000",
  Brighton: "#0057B8",
  Chelsea: "#034694",
  "Crystal Palace": "#1B458F",
  Everton: "#003399",
  Fulham: "#000000",
  "Ipswich Town": "#0E63AD",
  "Leicester City": "#003090",
  Liverpool: "#C8102E",
  "Manchester City": "#6CABDD",
  "Manchester United": "#DA291C",
  Newcastle: "#241F20",
  "Nottingham Forest": "#DD0000",
  Southampton: "#D71920",
  Tottenham: "#132257",
  "West Ham": "#7A263A",
  Wolves: "#FDB913",
};
