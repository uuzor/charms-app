import { useState, useEffect } from "react";
import { extractCharmsForWallet } from "charms-js";
import { MatchData } from "../types";
import { TEAMS } from "../utils";
import { parseMatchCharm } from "./useCharms";

// Fetch matches from Charms contract using Bitcoin transactions
export function useMatches(seasonId: string, turn: number) {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchMatches = async () => {
      setLoading(true);
      setError(null);

      try {
        // TODO: Fetch actual Bitcoin transactions containing Match NFTs
        // For now, use mock data until we have a transaction indexer
        // In production, this would fetch from:
        // 1. Bitcoin mempool API (mempool.space)
        // 2. Custom Charms indexer
        // 3. Or directly from Bitcoin Core RPC

        // Example of how it would work with real data:
        // const txHex = await fetchTransactionHex(matchTxId);
        // const charms = await extractCharmsForWallet(
        //   txHex,
        //   matchTxId,
        //   walletOutpoints,
        //   "testnet4"
        // );
        //
        // const matchCharms = charms
        //   .filter(charm => charm.app.startsWith("10/")) // MATCH_NFT tag
        //   .map(charm => parseMatchCharm(charm.data))
        //   .filter(Boolean);

        // Mock data for demo - replace with real Charms extraction
        const mockMatches: MatchData[] = [
        {
          seasonId,
          turn,
          matchId: 0,
          homeTeam: "Arsenal",
          awayTeam: "Liverpool",
          homeOdds: 18000,
          awayOdds: 22000,
          drawOdds: 32000,
          result: "Pending",
        },
        {
          seasonId,
          turn,
          matchId: 1,
          homeTeam: "Manchester City",
          awayTeam: "Manchester United",
          homeOdds: 15000,
          awayOdds: 27000,
          drawOdds: 35000,
          result: "Pending",
        },
        {
          seasonId,
          turn,
          matchId: 2,
          homeTeam: "Chelsea",
          awayTeam: "Tottenham",
          homeOdds: 19000,
          awayOdds: 21000,
          drawOdds: 33000,
          result: "Pending",
        },
        {
          seasonId,
          turn,
          matchId: 3,
          homeTeam: "Newcastle",
          awayTeam: "Aston Villa",
          homeOdds: 17000,
          awayOdds: 24000,
          drawOdds: 34000,
          result: "Pending",
        },
        {
          seasonId,
          turn,
          matchId: 4,
          homeTeam: "Brighton",
          awayTeam: "West Ham",
          homeOdds: 20000,
          awayOdds: 20000,
          drawOdds: 32000,
          result: "Pending",
        },
        {
          seasonId,
          turn,
          matchId: 5,
          homeTeam: "Wolves",
          awayTeam: "Nottingham Forest",
          homeOdds: 21000,
          awayOdds: 19000,
          drawOdds: 31000,
          result: "Pending",
        },
        {
          seasonId,
          turn,
          matchId: 6,
          homeTeam: "Brentford",
          awayTeam: "Fulham",
          homeOdds: 18500,
          awayOdds: 22500,
          drawOdds: 33000,
          result: "Pending",
        },
        {
          seasonId,
          turn,
          matchId: 7,
          homeTeam: "Crystal Palace",
          awayTeam: "Bournemouth",
          homeOdds: 19500,
          awayOdds: 20500,
          drawOdds: 32000,
          result: "Pending",
        },
        {
          seasonId,
          turn,
          matchId: 8,
          homeTeam: "Leicester City",
          awayTeam: "Ipswich Town",
          homeOdds: 16000,
          awayOdds: 25000,
          drawOdds: 35000,
          result: "Pending",
        },
        {
          seasonId,
          turn,
          matchId: 9,
          homeTeam: "Everton",
          awayTeam: "Southampton",
          homeOdds: 17500,
          awayOdds: 23500,
          drawOdds: 34000,
          result: "Pending",
        },
      ];

        setMatches(mockMatches);
      } catch (err) {
        console.error("Error fetching matches:", err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, [seasonId, turn]);

  return { matches, loading, error };
}

// Helper to fetch transaction hex from mempool.space API
export async function fetchTransactionHex(txid: string, network: "testnet4" | "mainnet" = "testnet4"): Promise<string> {
  const baseUrl = network === "testnet4"
    ? "https://mempool.space/testnet4/api"
    : "https://mempool.space/api";

  const response = await fetch(`${baseUrl}/tx/${txid}/hex`);
  if (!response.ok) {
    throw new Error(`Failed to fetch transaction: ${response.statusText}`);
  }
  return response.text();
}

export function useMatchCountdown() {
  const [timeUntilNext, setTimeUntilNext] = useState(15 * 60); // 15 minutes in seconds

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeUntilNext((prev) => {
        if (prev <= 1) return 15 * 60; // Reset to 15 minutes
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const minutes = Math.floor(timeUntilNext / 60);
  const seconds = timeUntilNext % 60;

  return { minutes, seconds, totalSeconds: timeUntilNext };
}
