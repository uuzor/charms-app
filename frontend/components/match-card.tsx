"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Clock, TrendingUp, Plus, Lock } from "lucide-react";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Button } from "./ui/button";
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
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            <span>Match {match.matchId + 1}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* V2: Locked odds indicator */}
            {hasLockedOdds && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                <Lock className="h-3 w-3" />
                Locked Odds
              </span>
            )}
            {match.result === "Pending" && (
              <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                Live Betting
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Teams */}
        <div className="grid grid-cols-3 gap-4 items-center">
          <div className="text-center">
            <div className="text-lg font-semibold">{match.homeTeam}</div>
            {hasHomeBadge && (
              <span className="text-xs text-green-600">+5% Bonus</span>
            )}
          </div>
          <div className="text-center text-2xl font-bold text-gray-300">VS</div>
          <div className="text-center">
            <div className="text-lg font-semibold">{match.awayTeam}</div>
            {hasAwayBadge && (
              <span className="text-xs text-green-600">+5% Bonus</span>
            )}
          </div>
        </div>

        {/* Odds */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleAddToBetslip("HomeWin")}
            className={cn(
              "rounded-lg border p-3 transition-all hover:border-yellow-400 hover:shadow-md group",
              selectedPrediction === "HomeWin"
                ? "border-yellow-400 bg-gradient-to-br from-yellow-400 to-orange-500 text-black shadow-lg"
                : "border-gray-200 bg-white"
            )}
          >
            <div className="text-xs text-gray-500 group-hover:text-gray-700">Home</div>
            <div className="text-lg font-bold">{getOddsDisplay("HomeWin")}</div>
            <div className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Plus className="w-4 h-4 mx-auto" />
            </div>
          </button>

          <button
            onClick={() => handleAddToBetslip("Draw")}
            className={cn(
              "rounded-lg border p-3 transition-all hover:border-yellow-400 hover:shadow-md group",
              selectedPrediction === "Draw"
                ? "border-yellow-400 bg-gradient-to-br from-yellow-400 to-orange-500 text-black shadow-lg"
                : "border-gray-200 bg-white"
            )}
          >
            <div className="text-xs text-gray-500 group-hover:text-gray-700">Draw</div>
            <div className="text-lg font-bold">{getOddsDisplay("Draw")}</div>
            <div className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Plus className="w-4 h-4 mx-auto" />
            </div>
          </button>

          <button
            onClick={() => handleAddToBetslip("AwayWin")}
            className={cn(
              "rounded-lg border p-3 transition-all hover:border-yellow-400 hover:shadow-md group",
              selectedPrediction === "AwayWin"
                ? "border-yellow-400 bg-gradient-to-br from-yellow-400 to-orange-500 text-black shadow-lg"
                : "border-gray-200 bg-white"
            )}
          >
            <div className="text-xs text-gray-500 group-hover:text-gray-700">Away</div>
            <div className="text-lg font-bold">{getOddsDisplay("AwayWin")}</div>
            <div className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Plus className="w-4 h-4 mx-auto" />
            </div>
          </button>
        </div>

        {/* Selected Indicator */}
        {selectedPrediction && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200"
          >
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-green-700 font-medium">
              Added to betslip
            </span>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
