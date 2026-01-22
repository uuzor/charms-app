"use client";

import { useState } from "react";
import { Clock, Zap, ShoppingCart } from "lucide-react";
import { Header } from "@/components/header";
import { MatchCard } from "@/components/match-card";
import { BetslipPanel } from "@/components/betslip-panel";
import { useMatches, useMatchCountdown } from "@/lib/hooks/useMatches";
import { useBetslip } from "@/lib/hooks/useBetslip";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  const { matches, loading } = useMatches("season_2024_1", 1);
  const { minutes, seconds } = useMatchCountdown();
  const { betslip, addBet } = useBetslip();
  const [betslipOpen, setBetslipOpen] = useState(false);

  // Mock wallet address - replace with real wallet connection
  const walletAddress = undefined; // Will be from useWallet() when connected
  const userBadges: number[] = []; // Will be from wallet when connected

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <Header />

      {/* Floating Betslip Toggle Button */}
      <button
        onClick={() => setBetslipOpen(!betslipOpen)}
        className="fixed bottom-8 right-8 z-40 bg-gradient-to-r from-yellow-400 to-orange-500 text-black p-4 rounded-full shadow-2xl hover:shadow-yellow-500/50 transition-all hover:scale-110 group"
      >
        <div className="relative">
          <ShoppingCart className="w-6 h-6" />
          {betslip.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
              {betslip.length}
            </span>
          )}
        </div>
      </button>

      {/* Betslip Panel */}
      <BetslipPanel
        isOpen={betslipOpen}
        onClose={() => setBetslipOpen(false)}
        walletAddress={walletAddress}
        userBadges={userBadges}
      />

      <main className="container mx-auto px-4 py-8 pr-4">
        {/* Hero Section */}
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-bold tracking-tight mb-3 bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-400 bg-clip-text text-transparent">
            Premier League Virtual Betting
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Provably fair virtual betting powered by Bitcoin. Bet on your favorite teams
            with transparent odds and instant payouts.
          </p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/60 mb-1">Next Resolution</p>
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-yellow-400" />
                    <span className="text-2xl font-bold text-white">
                      {String(minutes).padStart(2, "0")}:
                      {String(seconds).padStart(2, "0")}
                    </span>
                  </div>
                </div>
                <Zap className="h-8 w-8 text-white/20" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/60 mb-1">Current Turn</p>
                  <span className="text-2xl font-bold text-white">1 / 36</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/60 mb-1">Active Matches</p>
                  <span className="text-2xl font-bold text-white">10</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Matches Section */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2 text-white">Live Matches</h2>
          <p className="text-gray-400">
            Click on odds to add bets to your betslip. Matches resolve in {minutes} minutes.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(10)].map((_, i) => (
              <Card key={i} className="h-40 animate-pulse bg-white/5 border-white/10" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {matches.map((match) => (
              <MatchCard
                key={`${match.seasonId}_${match.turn}_${match.matchId}`}
                match={match}
                onAddToBetslip={addBet}
              />
            ))}
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-16 pt-8 border-t border-white/10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
            <div>
              <h3 className="font-semibold mb-2 text-white">Provably Fair</h3>
              <p className="text-gray-400">
                All match results are generated from Bitcoin transaction hashes,
                ensuring complete transparency and fairness.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 text-white">Multi-Bet Betslips</h3>
              <p className="text-gray-400">
                Build parlays with up to 20 matches for higher payouts, or use system bets
                for safer partial wins.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 text-white">NFT Bonuses & Season Rewards</h3>
              <p className="text-gray-400">
                Hold team badge NFTs to get +5% better odds. Predict the season winner to earn
                from the 2% pool.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
