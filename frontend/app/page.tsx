"use client";

import { Clock, Zap } from "lucide-react";
import { Header } from "@/components/header";
import { MatchCard } from "@/components/match-card";
import { useMatches, useMatchCountdown } from "@/lib/hooks/useMatches";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  const { matches, loading } = useMatches("season_2024_1", 1);
  const { minutes, seconds } = useMatchCountdown();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Premier League Virtual Betting
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl">
            Provably fair virtual betting powered by Bitcoin. Bet on your favorite teams
            with transparent odds and instant payouts.
          </p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Next Resolution</p>
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-gray-400" />
                    <span className="text-2xl font-bold">
                      {String(minutes).padStart(2, "0")}:
                      {String(seconds).padStart(2, "0")}
                    </span>
                  </div>
                </div>
                <Zap className="h-8 w-8 text-gray-200" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Current Turn</p>
                  <span className="text-2xl font-bold">1 / 36</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Active Matches</p>
                  <span className="text-2xl font-bold">10</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Matches Section */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Live Matches</h2>
          <p className="text-gray-600">
            Place your bets now. Matches resolve in {minutes} minutes.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="h-96 animate-pulse bg-gray-100" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {matches.map((match) => (
              <MatchCard
                key={`${match.seasonId}_${match.turn}_${match.matchId}`}
                match={match}
              />
            ))}
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-16 pt-8 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
            <div>
              <h3 className="font-semibold mb-2">Provably Fair</h3>
              <p className="text-gray-600">
                All match results are generated from Bitcoin transaction hashes,
                ensuring complete transparency and fairness.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">NFT Bonuses</h3>
              <p className="text-gray-600">
                Hold team badge NFTs to get +5% better odds when betting on
                your favorite teams.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Season Rewards</h3>
              <p className="text-gray-600">
                2% of all bets go to a season pool. Predict the winner to earn
                your share for free.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
