import { useState, useEffect } from "react";
import { extractCharmsForWallet } from "charms-js";

export interface CharmData {
  app: string;
  data: any;
  amount?: number;
}

export function useCharms(
  txHex?: string,
  txId?: string,
  walletOutpoints?: string[],
  network: "mainnet" | "testnet4" = "testnet4"
) {
  const [charms, setCharms] = useState<CharmData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!txHex || !txId || !walletOutpoints) return;

    const extractCharms = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await extractCharmsForWallet(
          txHex,
          txId,
          walletOutpoints,
          network
        );
        setCharms(result || []);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    extractCharms();
  }, [txHex, txId, walletOutpoints, network]);

  return { charms, loading, error };
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
