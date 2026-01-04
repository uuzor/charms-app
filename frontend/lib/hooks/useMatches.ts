import { useState, useEffect } from "react";
import { extractAndVerifySpell } from "charms-js";
import { parseMatchCharm, fetchTransactionHex } from "./useCharms";
import { MatchData as MatchCharmData, MatchResult } from "../types/betslip";

// Convert lib/types format to old MatchData format (for backward compatibility)
interface MatchData {
  seasonId: string;
  turn: number;
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  homeOdds: number;
  awayOdds: number;
  drawOdds: number;
  result: MatchResult;
}

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
        // Real implementation:
        // 1. Query indexer API for match transactions
        const response = await fetch(`/api/matches?season=${seasonId}&turn=${turn}`);

        if (!response.ok) {
          throw new Error("Failed to fetch matches from indexer");
        }

        const matchTxIds: string[] = await response.json();

        // 2. Extract charms from each transaction
        const allMatches: MatchData[] = [];

        for (const txid of matchTxIds) {
          const txHex = await fetchTransactionHex(txid, "testnet4");
          const result = await extractAndVerifySpell(txHex, "testnet4");

          if (!result.success) {
            console.error(`Failed to extract charms from ${txid}:`, result.error);
            continue;
          }

          // Filter for Match NFT charms (tag 10 or appId includes "10/")
          const matchCharms = result.charms.filter(c =>
            c.appId.includes("10/") || c.app.match_data
          );

          for (const charm of matchCharms) {
            const matchData = parseMatchCharm(charm.app);

            if (!matchData) {
              console.error("Failed to parse match charm data");
              continue;
            }

            // Convert to UI format
            allMatches.push({
              seasonId: matchData.season_id,
              turn: matchData.turn,
              matchId: matchData.match_id,
              homeTeam: matchData.home_team,
              awayTeam: matchData.away_team,
              homeOdds: matchData.home_odds,
              awayOdds: matchData.away_odds,
              drawOdds: matchData.draw_odds,
              result: matchData.result,
            });
          }
        }

        setMatches(allMatches);
      } catch (err) {
        console.error("Error fetching matches:", err);

        // Fallback to demo data if indexer not available
        console.warn("Using fallback demo data - indexer not available");
        const fallbackMatches: MatchData[] = [
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

        setMatches(fallbackMatches);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, [seasonId, turn]);

  return { matches, loading, error };
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
