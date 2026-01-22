"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Clock, Trophy, Lock, Check } from "lucide-react";
import { Card } from "./ui/card";
import { MatchData, MatchResult } from "@/lib/types";
import { formatOdds, formatTokenAmount, cn } from "@/lib/utils";
import { useWallet } from "@/lib/hooks/useWallet";
import { SingleBet } from "@/lib/types/betslip";

interface MatchCardProps {
  match: MatchData;
  onAddToBetslip?: (bet: SingleBet) => void;
}

export function MatchCard({ match, onAddToBetslip }: MatchCardProps) {
  const [selectedPrediction, setSelectedPrediction] = useState<MatchResult | null>(null);
  const { hasBadge, connected } = useWallet();

  const hasHomeBadge = hasBadge(match.homeTeam);
  const hasAwayBadge = hasBadge(match.awayTeam);

  const handleAddToBetslip = (prediction: MatchResult) => {
    if (!onAddToBetslip) return;

    // V2: Use locked odds if available, otherwise fall back to dynamic odds
    let odds: number;
    if (match.lockedOdds && match.lockedOdds.locked) {
      odds =
        prediction === "HomeWin"
          ? match.lockedOdds.home_odds
          : prediction === "AwayWin"
          ? match.lockedOdds.away_odds
          : match.lockedOdds.draw_odds;
    } else {
      odds =
        prediction === "HomeWin"
          ? match.homeOdds
          : prediction === "AwayWin"
          ? match.awayOdds
          : match.drawOdds;
    }

    const bet: SingleBet = {
      match_id: `${match.seasonId}_${match.turn}_${match.matchId}`,
      prediction,
      odds,
    };

    onAddToBetslip(bet);
    setSelectedPrediction(prediction);
  };

  const getOddsDisplay = (prediction: MatchResult) => {
    // V2: Prioritize locked odds (1.25x-1.95x range)
    if (match.lockedOdds && match.lockedOdds.locked) {
      const lockedOdds =
        prediction === "HomeWin"
          ? match.lockedOdds.home_odds
          : prediction === "AwayWin"
          ? match.lockedOdds.away_odds
          : match.lockedOdds.draw_odds;
      return formatOdds(lockedOdds);
    }

    // Fallback to dynamic odds
    const odds =
      prediction === "HomeWin"
        ? match.homeOdds
        : prediction === "AwayWin"
        ? match.awayOdds
        : match.drawOdds;

    return formatOdds(odds);
  };

  // Check if odds are locked
  const hasLockedOdds = match.lockedOdds && match.lockedOdds.locked;

  return (
    <Card className="bg-white/5 border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-300 overflow-hidden">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <Clock className="h-3.5 w-3.5" />
              <span>Match {match.matchId + 1}</span>
            </div>
            {match.result === "Pending" && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-full">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                Live
              </span>
            )}
          </div>
          {/* V2: Locked odds indicator */}
          {hasLockedOdds && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs font-medium rounded-full">
              <Lock className="h-3 w-3" />
              <span>Locked</span>
            </div>
          )}
        </div>

        {/* Teams Row */}
        <div className="flex items-center justify-between mb-5">
          {/* Home Team */}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-white/40" />
              <div>
                <div className="text-base font-semibold text-white">{match.homeTeam}</div>
                {hasHomeBadge && (
                  <span className="text-xs text-green-400 font-medium">+5% Bonus</span>
                )}
              </div>
            </div>
          </div>

          {/* VS Badge */}
          <div className="px-4">
            <span className="text-white/20 font-bold text-sm">VS</span>
          </div>

          {/* Away Team */}
          <div className="flex-1 text-right">
            <div className="flex items-center gap-2 justify-end">
              <div>
                <div className="text-base font-semibold text-white">{match.awayTeam}</div>
                {hasAwayBadge && (
                  <span className="text-xs text-green-400 font-medium">+5% Bonus</span>
                )}
              </div>
              <Trophy className="h-4 w-4 text-white/40" />
            </div>
          </div>
        </div>

        {/* Odds Buttons Row */}
        <div className="grid grid-cols-3 gap-2">
          {/* Home Button */}
          <button
            onClick={() => handleAddToBetslip("HomeWin")}
            className={cn(
              "relative group px-4 py-3 rounded-lg font-medium transition-all duration-200",
              selectedPrediction === "HomeWin"
                ? "bg-gradient-to-br from-yellow-400 to-orange-500 text-black shadow-lg shadow-yellow-500/20 scale-[1.02]"
                : "bg-white/10 text-white hover:bg-white/20 border border-white/10 hover:border-yellow-400/50"
            )}
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs opacity-70">Home</span>
              <span className="text-lg font-bold">{getOddsDisplay("HomeWin")}</span>
              {selectedPrediction === "HomeWin" && (
                <Check className="w-4 h-4 absolute top-1 right-1" />
              )}
            </div>
          </button>

          {/* Draw Button */}
          <button
            onClick={() => handleAddToBetslip("Draw")}
            className={cn(
              "relative group px-4 py-3 rounded-lg font-medium transition-all duration-200",
              selectedPrediction === "Draw"
                ? "bg-gradient-to-br from-yellow-400 to-orange-500 text-black shadow-lg shadow-yellow-500/20 scale-[1.02]"
                : "bg-white/10 text-white hover:bg-white/20 border border-white/10 hover:border-yellow-400/50"
            )}
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs opacity-70">Draw</span>
              <span className="text-lg font-bold">{getOddsDisplay("Draw")}</span>
              {selectedPrediction === "Draw" && (
                <Check className="w-4 h-4 absolute top-1 right-1" />
              )}
            </div>
          </button>

          {/* Away Button */}
          <button
            onClick={() => handleAddToBetslip("AwayWin")}
            className={cn(
              "relative group px-4 py-3 rounded-lg font-medium transition-all duration-200",
              selectedPrediction === "AwayWin"
                ? "bg-gradient-to-br from-yellow-400 to-orange-500 text-black shadow-lg shadow-yellow-500/20 scale-[1.02]"
                : "bg-white/10 text-white hover:bg-white/20 border border-white/10 hover:border-yellow-400/50"
            )}
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs opacity-70">Away</span>
              <span className="text-lg font-bold">{getOddsDisplay("AwayWin")}</span>
              {selectedPrediction === "AwayWin" && (
                <Check className="w-4 h-4 absolute top-1 right-1" />
              )}
            </div>
          </button>
        </div>

        {/* Selected Success Message */}
        {selectedPrediction && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-3 flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded-lg"
          >
            <Check className="w-4 h-4 text-green-400" />
            <span className="text-sm text-green-400 font-medium">
              Added to betslip
            </span>
          </motion.div>
        )}
      </div>
    </Card>
  );
}
