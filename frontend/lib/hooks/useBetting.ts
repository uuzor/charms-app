import { useState } from "react";
import { BetData, MatchData, MatchResult } from "../types";
import { calculatePayout } from "../utils";

export function useBetting() {
  const [userBets, setUserBets] = useState<BetData[]>([]);
  const [placingBet, setPlacingBet] = useState(false);

  const placeBet = async (
    match: MatchData,
    prediction: MatchResult,
    stake: number,
    hasBadge: boolean = false
  ) => {
    setPlacingBet(true);

    // Simulate transaction
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const odds =
      prediction === "HomeWin"
        ? match.homeOdds
        : prediction === "AwayWin"
        ? match.awayOdds
        : match.drawOdds;

    const newBet: BetData = {
      matchId: `${match.seasonId}_${match.turn}_${match.matchId}`,
      prediction,
      stake,
      odds,
      bettor: "user_address", // Would be actual wallet address
      hasBadge,
      settled: false,
    };

    setUserBets((prev) => [...prev, newBet]);
    setPlacingBet(false);

    return newBet;
  };

  const calculatePotentialWin = (
    stake: number,
    odds: number,
    hasBadge: boolean
  ) => {
    return calculatePayout(stake, odds, hasBadge);
  };

  return {
    userBets,
    placeBet,
    placingBet,
    calculatePotentialWin,
  };
}
