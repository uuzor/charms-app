"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, TrendingUp, AlertCircle, Layers } from "lucide-react";
import { useBetslip } from "../lib/hooks/useBetslip";
import { BetType, MIN_BET, MAX_BET, calculateParlayMultiplier } from "../lib/types/betslip";

interface BetslipPanelProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress?: string;
  userBadges?: number[];
}

export function BetslipPanel({
  isOpen,
  onClose,
  walletAddress,
  userBadges = [],
}: BetslipPanelProps) {
  const {
    betslip,
    betType,
    totalStake,
    submitting,
    removeBet,
    clearBetslip,
    setBetType,
    setTotalStake,
    calculatePotentialPayout,
    calculateOddsWeightedAllocations, // V2: For odds-weighted allocation display
    submitBetslip,
  } = useBetslip();

  const [stake, setStake] = useState<string>("");
  const [success, setSuccess] = useState(false);

  const handleStakeChange = (value: string) => {
    setStake(value);
    const numValue = parseInt(value) || 0;
    setTotalStake(numValue);
  };

  const handleSubmit = async () => {
    if (!walletAddress) {
      alert("Please connect your wallet first");
      return;
    }

    try {
      const txid = await submitBetslip(walletAddress, userBadges, (txid) => {
        console.log("Betslip submitted:", txid);
        setSuccess(true);
        setStake("");
        setTimeout(() => setSuccess(false), 3000);
      });

      console.log("Transaction ID:", txid);
    } catch (error: any) {
      alert(error.message || "Failed to submit betslip");
    }
  };

  const potentialPayout = calculatePotentialPayout(
    totalStake,
    userBadges
  );

  const potentialProfit = potentialPayout - totalStake;

  // V2: Calculate parlay multiplier and allocations for display
  const parlayMultiplier = betType === "Parlay" && betslip.length > 1
    ? calculateParlayMultiplier(betslip.length)
    : 10000;

  const allocations = betType === "Parlay" && betslip.length > 1 && totalStake > 0
    ? calculateOddsWeightedAllocations(totalStake, betslip, parlayMultiplier)
    : [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-black/95 border-l border-white/10 backdrop-blur-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="text-lg font-semibold text-white">Betslip</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-white/60" />
        </button>
      </div>

      {/* Bet Type Selector */}
      {betslip.length > 1 && (
        <div className="p-4 border-b border-white/10">
          <div className="flex gap-2">
            <button
              onClick={() => setBetType("Parlay")}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                betType === "Parlay"
                  ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-black"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              Parlay
            </button>
            <button
              onClick={() => setBetType("SystemBet")}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                betType === "SystemBet"
                  ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-black"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              System
            </button>
          </div>

          <div className="mt-2 text-xs text-white/40">
            {betType === "Parlay" && "All bets must win. Higher payout!"}
            {betType === "SystemBet" && "Partial wins allowed. Safer option."}
          </div>
        </div>
      )}

      {/* Betslip Items */}
      <div className="flex-1 overflow-y-auto">
        {betslip.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <TrendingUp className="w-8 h-8 text-white/20" />
            </div>
            <p className="text-white/40 text-sm">
              Your betslip is empty
            </p>
            <p className="text-white/20 text-xs mt-2">
              Add bets from the matches above
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {betslip.map((bet, index) => {
              // Find allocation for this bet (V2)
              const allocation = allocations.find(a => a.match_id === bet.match_id);

              return (
                <motion.div
                  key={bet.match_id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 100 }}
                  className="bg-white/5 rounded-lg p-3 relative group"
                >
                  <button
                    onClick={() => removeBet(bet.match_id)}
                    className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded transition-all"
                  >
                    <X className="w-4 h-4 text-red-400" />
                  </button>

                  <div className="text-xs text-white/40 mb-1">
                    Match {bet.match_id}
                  </div>
                  <div className="text-sm font-medium text-white mb-2">
                    {bet.prediction}
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-white/40">Odds</span>
                      <span className="text-yellow-400 font-medium">
                        {(bet.odds / 10000).toFixed(2)}x
                      </span>
                    </div>

                    {/* V2: Show allocation for parlay bets */}
                    {allocation && betType === "Parlay" && (
                      <div className="flex justify-between items-center text-xs pt-1 border-t border-white/5">
                        <span className="text-white/40 flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          Allocation
                        </span>
                        <span className="text-blue-400 font-medium">
                          {allocation.allocation.toLocaleString()} LEAGUE
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stake Input & Summary */}
      {betslip.length > 0 && (
        <div className="border-t border-white/10 p-4 space-y-4">
          {/* Stake Input */}
          <div>
            <label className="block text-xs text-white/60 mb-2">
              Total Stake
            </label>
            <div className="relative">
              <input
                type="number"
                value={stake}
                onChange={(e) => handleStakeChange(e.target.value)}
                placeholder={`Min: ${MIN_BET} LEAGUE`}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-yellow-400/50 transition-all"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">
                LEAGUE
              </div>
            </div>

            {totalStake > 0 && totalStake < MIN_BET && (
              <div className="mt-2 flex items-center gap-2 text-xs text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span>Minimum bet is {MIN_BET} LEAGUE</span>
              </div>
            )}

            {totalStake > MAX_BET && (
              <div className="mt-2 flex items-center gap-2 text-xs text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span>Maximum bet is {MAX_BET} LEAGUE</span>
              </div>
            )}
          </div>

          {/* Summary */}
          {totalStake >= MIN_BET && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-white/60">
                <span>Stake</span>
                <span>{totalStake.toLocaleString()} LEAGUE</span>
              </div>

              {betType === "SystemBet" && betslip.length > 0 && (
                <div className="flex justify-between text-white/60">
                  <span>Per Bet</span>
                  <span>
                    {Math.floor(totalStake / betslip.length).toLocaleString()}{" "}
                    LEAGUE
                  </span>
                </div>
              )}

              {/* V2: Show parlay multiplier */}
              {betType === "Parlay" && betslip.length > 1 && (
                <div className="flex justify-between text-white/60">
                  <span>Parlay Boost</span>
                  <span className="text-blue-400 font-medium">
                    +{((parlayMultiplier - 10000) / 100).toFixed(0)}% ({(parlayMultiplier / 10000).toFixed(2)}x)
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center text-white font-semibold pt-2 border-t border-white/10">
                <span>Potential Win</span>
                <div className="text-right">
                  <div className="text-green-400">
                    {potentialPayout.toLocaleString()} LEAGUE
                  </div>
                  <div className="text-xs text-white/40">
                    +{potentialProfit.toLocaleString()} profit
                  </div>
                </div>
              </div>

              {userBadges.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-yellow-400">
                  <span>🏅 Badge bonus applied (+5%)</span>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={clearBetslip}
              className="px-4 py-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
            <button
              onClick={handleSubmit}
              disabled={
                submitting ||
                totalStake < MIN_BET ||
                totalStake > MAX_BET ||
                !walletAddress
              }
              className="flex-1 px-4 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-semibold rounded-lg hover:shadow-lg hover:shadow-yellow-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
            >
              {submitting ? "Submitting..." : "Place Betslip"}
            </button>
          </div>

          {/* Success Message */}
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm text-center"
              >
                ✅ Betslip submitted successfully!
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
