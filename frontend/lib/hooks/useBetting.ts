import { useState } from "react";
import { extractCharmsForWallet } from "charms-js";
import { BetData, MatchData, MatchResult } from "../types";
import { calculatePayout } from "../utils";

export function useBetting() {
  const [userBets, setUserBets] = useState<BetData[]>([]);
  const [placingBet, setPlacingBet] = useState(false);

  const placeBet = async (
    match: MatchData,
    prediction: MatchResult,
    stake: number,
    hasBadge: boolean = false
  ) => {
    setPlacingBet(true);

    try {
      // Real implementation would:
      // 1. Get user's Bitcoin wallet (Leather, Unisat, etc.)
      // 2. Create a Bitcoin transaction with Charm spell
      // 3. Include bet data in the transaction witness
      // 4. Sign and broadcast the transaction
      //
      // Example flow:
      //
      // const wallet = await getConnectedWallet();
      // const utxos = await wallet.getUtxos();
      //
      // // Build transaction with Charm spell
      // const tx = new Transaction();
      //
      // // Add input with LEAGUE tokens
      // const leagueUtxo = findLeagueTokenUtxo(utxos, stake);
      // tx.addInput(leagueUtxo);
      //
      // // Add output with Bet NFT charm
      // const betCharm = {
      //   app: `11/${appId}/${appVk}`, // BET_NFT tag
      //   data: {
      //     match_id: `${match.seasonId}_${match.turn}_${match.matchId}`,
      //     prediction,
      //     stake,
      //     odds: getOddsForPrediction(match, prediction),
      //     bettor: wallet.address,
      //     has_badge: hasBadge,
      //     settled: false,
      //   },
      // };
      //
      // tx.addOutput({
      //   address: wallet.address,
      //   value: 546, // Dust limit
      //   charm: betCharm,
      // });
      //
      // // Add output sending LEAGUE tokens to house
      // tx.addOutput({
      //   address: houseAddress,
      //   charm: {
      //     app: `t/${appId}/${appVk}`, // TOKEN tag
      //     amount: stake,
      //   },
      // });
      //
      // // Sign and broadcast
      // const signedTx = await wallet.signTransaction(tx);
      // const txid = await broadcastTransaction(signedTx);
      //
      // // Extract charm from transaction
      // const txHex = signedTx.toHex();
      // const charms = await extractCharmsForWallet(
      //   txHex,
      //   txid,
      //   [wallet.address],
      //   "testnet4"
      // );

      // Simulate transaction for demo
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const odds =
        prediction === "HomeWin"
          ? match.homeOdds
          : prediction === "AwayWin"
          ? match.awayOdds
          : match.drawOdds;

      const newBet: BetData = {
        matchId: `${match.seasonId}_${match.turn}_${match.matchId}`,
        prediction,
        stake,
        odds,
        bettor: "tb1p...", // Would be actual wallet address
        hasBadge,
        settled: false,
      };

      setUserBets((prev) => [...prev, newBet]);
      return newBet;
    } catch (error) {
      console.error("Error placing bet:", error);
      throw error;
    } finally {
      setPlacingBet(false);
    }
  };

  const calculatePotentialWin = (
    stake: number,
    odds: number,
    hasBadge: boolean
  ) => {
    return calculatePayout(stake, odds, hasBadge);
  };

  // Fetch user's existing bets from Bitcoin transactions
  const fetchUserBets = async (walletAddress: string) => {
    try {
      // Real implementation:
      // 1. Query Bitcoin mempool/indexer for transactions to walletAddress
      // 2. Extract charms from those transactions
      // 3. Filter for Bet NFT charms (tag 11)
      // 4. Parse bet data
      //
      // const txs = await fetchWalletTransactions(walletAddress);
      // const bets: BetData[] = [];
      //
      // for (const tx of txs) {
      //   const txHex = await fetchTransactionHex(tx.txid);
      //   const charms = await extractCharmsForWallet(
      //     txHex,
      //     tx.txid,
      //     [walletAddress],
      //     "testnet4"
      //   );
      //
      //   const betCharms = charms.filter(c => c.app.startsWith("11/"));
      //   bets.push(...betCharms.map(c => parseBetCharm(c.data)));
      // }
      //
      // setUserBets(bets);

      console.log("Fetching bets for:", walletAddress);
    } catch (error) {
      console.error("Error fetching user bets:", error);
    }
  };

  return {
    userBets,
    placeBet,
    placingBet,
    calculatePotentialWin,
    fetchUserBets,
  };
}

// Helper to broadcast Bitcoin transaction
async function broadcastTransaction(txHex: string): Promise<string> {
  const response = await fetch("https://mempool.space/testnet4/api/tx", {
    method: "POST",
    body: txHex,
  });

  if (!response.ok) {
    throw new Error(`Failed to broadcast transaction: ${response.statusText}`);
  }

  return response.text(); // Returns txid
}
