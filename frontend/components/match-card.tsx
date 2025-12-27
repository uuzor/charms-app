"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Clock, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Button } from "./ui/button";
import { MatchData, MatchResult } from "@/lib/types";
import { formatOdds, formatTokenAmount, cn } from "@/lib/utils";
import { useBetting } from "@/lib/hooks/useBetting";
import { useWallet } from "@/lib/hooks/useWallet";

interface MatchCardProps {
  match: MatchData;
}

export function MatchCard({ match }: MatchCardProps) {
  const [selectedPrediction, setSelectedPrediction] = useState<MatchResult | null>(null);
  const [betAmount, setBetAmount] = useState(1000);
  const { placeBet, placingBet, calculatePotentialWin } = useBetting();
  const { hasBadge, connected } = useWallet();

  const hasHomeBadge = hasBadge(match.homeTeam);
  const hasAwayBadge = hasBadge(match.awayTeam);

  const handlePlaceBet = async () => {
    if (!selectedPrediction || !connected) return;

    const hasBadgeBonus =
      (selectedPrediction === "HomeWin" && hasHomeBadge) ||
      (selectedPrediction === "AwayWin" && hasAwayBadge);

    await placeBet(match, selectedPrediction, betAmount, hasBadgeBonus);
    setSelectedPrediction(null);
    setBetAmount(1000);
  };

  const getPotentialWin = (prediction: MatchResult) => {
    const odds =
      prediction === "HomeWin"
        ? match.homeOdds
        : prediction === "AwayWin"
        ? match.awayOdds
        : match.drawOdds;

    const hasBadgeBonus =
      (prediction === "HomeWin" && hasHomeBadge) ||
      (prediction === "AwayWin" && hasAwayBadge);

    return calculatePotentialWin(betAmount, odds, hasBadgeBonus);
  };

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            <span>Match {match.matchId + 1}</span>
          </div>
          {match.result === "Pending" && (
            <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
              Live Betting
            </span>
          )}
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
            onClick={() => setSelectedPrediction("HomeWin")}
            className={cn(
              "rounded-lg border p-3 transition-all hover:border-black",
              selectedPrediction === "HomeWin"
                ? "border-black bg-black text-white"
                : "border-gray-200 bg-white"
            )}
          >
            <div className="text-xs text-gray-500">Home</div>
            <div className="text-lg font-bold">{formatOdds(match.homeOdds)}</div>
          </button>

          <button
            onClick={() => setSelectedPrediction("Draw")}
            className={cn(
              "rounded-lg border p-3 transition-all hover:border-black",
              selectedPrediction === "Draw"
                ? "border-black bg-black text-white"
                : "border-gray-200 bg-white"
            )}
          >
            <div className="text-xs text-gray-500">Draw</div>
            <div className="text-lg font-bold">{formatOdds(match.drawOdds)}</div>
          </button>

          <button
            onClick={() => setSelectedPrediction("AwayWin")}
            className={cn(
              "rounded-lg border p-3 transition-all hover:border-black",
              selectedPrediction === "AwayWin"
                ? "border-black bg-black text-white"
                : "border-gray-200 bg-white"
            )}
          >
            <div className="text-xs text-gray-500">Away</div>
            <div className="text-lg font-bold">{formatOdds(match.awayOdds)}</div>
          </button>
        </div>

        {/* Bet Input */}
        {selectedPrediction && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3 p-4 bg-gray-50 rounded-lg"
          >
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Bet Amount</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Number(e.target.value))}
                  className="w-32 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-right"
                  min={100}
                  step={100}
                />
                <span className="text-sm text-gray-500">LEAGUE</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Potential Win</span>
              <div className="flex items-center gap-1 font-semibold">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span>{formatTokenAmount(getPotentialWin(selectedPrediction))}</span>
                <span className="text-gray-500">LEAGUE</span>
              </div>
            </div>

            <Button
              onClick={handlePlaceBet}
              disabled={placingBet || !connected}
              className="w-full"
            >
              {placingBet ? "Placing Bet..." : "Place Bet"}
            </Button>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
