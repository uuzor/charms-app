import { useState, useEffect } from "react";
import { extractAndVerifySpell } from "charms-js";

export interface CharmData {
  txid: string;
  outputIndex: number;
  address: string;
  amount: number;
  appId: string;
  version: number;
  metadata?: {
    ticker?: string;
    name?: string;
    description?: string;
    image?: string;
  };
  app: Record<string, any>;
}

export function useCharms(
  txHex?: string,
  network: "mainnet" | "testnet4" = "testnet4"
) {
  const [charms, setCharms] = useState<CharmData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!txHex) return;

    const extractCharms = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await extractAndVerifySpell(txHex, network);

        if (!result.success) {
          throw new Error(result.error || "Failed to extract charms");
        }

        setCharms(result.charms || []);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    extractCharms();
  }, [txHex, network]);

  return { charms, loading, error };
}

// Fetch transaction hex from mempool.space
export async function fetchTransactionHex(
  txid: string,
  network: "mainnet" | "testnet4" = "testnet4"
): Promise<string> {
  const apiUrl =
    network === "mainnet"
      ? `https://mempool.space/api/tx/${txid}/hex`
      : `https://mempool.space/testnet4/api/tx/${txid}/hex`;

  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error("Transaction not found");
  }

  return response.text();
}

// Helper to parse match data from charm
export function parseMatchCharm(charmData: any) {
  try {
    return {
      seasonId: charmData.season_id,
      turn: charmData.turn,
      matchId: charmData.match_id,
      homeTeam: charmData.home_team,
      awayTeam: charmData.away_team,
      homeOdds: charmData.home_odds,
      awayOdds: charmData.away_odds,
      drawOdds: charmData.draw_odds,
      result: charmData.result,
      randomSeed: charmData.random_seed,
    };
  } catch {
    return null;
  }
}

// Helper to parse bet data from charm
export function parseBetCharm(charmData: any) {
  try {
    return {
      matchId: charmData.match_id,
      prediction: charmData.prediction,
      stake: charmData.stake,
      odds: charmData.odds,
      bettor: charmData.bettor,
      hasBadge: charmData.has_badge,
      settled: charmData.settled,
    };
  } catch {
    return null;
  }
}

// Helper to parse badge data from charm
export function parseBadgeCharm(charmData: any) {
  try {
    return {
      teamName: charmData.team_name,
      teamId: charmData.team_id,
      bonusBps: charmData.bonus_bps,
    };
  } catch {
    return null;
  }
}
