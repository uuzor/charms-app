import { useState, useCallback } from "react";
import { extractAndVerifySpell } from "charms-js";
import { fetchTransactionHex } from "./useCharms";
import {
  BetslipData,
  BetType,
  SingleBet,
  MatchResult,
  BetAllocation,
  MIN_BET,
  MAX_BET,
  MAX_BETS_PER_SLIP,
  MAX_PAYOUT_PER_BET,
  MAX_PARLAY_MULTIPLIER,
  HOUSE_EDGE_BPS,
  BADGE_BONUS_BPS,
  calculateParlayMultiplier,
} from "../types/betslip";

export function useBetslip() {
  const [betslip, setBetslip] = useState<SingleBet[]>([]);
  const [betType, setBetType] = useState<BetType>("Single");
  const [totalStake, setTotalStake] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  // Add a bet to the betslip
  const addBet = useCallback((bet: SingleBet) => {
    setBetslip((prev) => {
      // Check if bet already exists for this match
      const existingIndex = prev.findIndex((b) => b.match_id === bet.match_id);

      if (existingIndex >= 0) {
        // Update existing bet
        const updated = [...prev];
        updated[existingIndex] = bet;
        return updated;
      } else {
        // Add new bet (max 20)
        if (prev.length >= MAX_BETS_PER_SLIP) {
          alert(`Maximum ${MAX_BETS_PER_SLIP} bets per betslip`);
          return prev;
        }
        return [...prev, bet];
      }
    });

    // Auto-switch to parlay if multiple bets
    if (betslip.length >= 1) {
      setBetType("Parlay");
    }
  }, [betslip.length]);

  // Remove a bet from the betslip
  const removeBet = useCallback((match_id: string) => {
    setBetslip((prev) => {
      const updated = prev.filter((b) => b.match_id !== match_id);
      // Switch back to single if only one bet left
      if (updated.length === 1) {
        setBetType("Single");
      }
      return updated;
    });
  }, []);

  // Clear the entire betslip
  const clearBetslip = useCallback(() => {
    setBetslip([]);
    setTotalStake(0);
    setBetType("Single");
  }, []);

  // V2: Calculate odds-weighted allocations (Solidity logic)
  const calculateOddsWeightedAllocations = useCallback((
    totalStake: number,
    bets: SingleBet[],
    parlayMultiplier: number
  ): BetAllocation[] => {
    if (bets.length === 0) return [];

    // Calculate target final payout
    let combinedOdds = 10000;
    for (const bet of bets) {
      combinedOdds = Math.floor((combinedOdds * bet.odds) / 10000);
    }
    const targetPayout = Math.floor((totalStake * combinedOdds * parlayMultiplier) / 100000000);

    // Per-match contribution (equal split of target payout)
    const perMatchContribution = Math.floor(targetPayout / bets.length);

    // Calculate allocation for each match (working backwards from odds)
    const allocations: BetAllocation[] = [];
    for (const bet of bets) {
      const allocation = Math.floor((perMatchContribution * 10000) / bet.odds);
      allocations.push({
        match_id: bet.match_id,
        allocation,
      });
    }

    return allocations;
  }, []);

  // Calculate potential payout based on bet type
  const calculatePotentialPayout = useCallback((
    stake: number,
    badges: number[] = []
  ): number => {
    if (betslip.length === 0 || stake === 0) return 0;

    switch (betType) {
      case "Single": {
        const bet = betslip[0];
        let odds = bet.odds;

        // Apply badge bonus if applicable
        const hasBadge = badges.length > 0;
        if (hasBadge) {
          odds = odds + (odds * BADGE_BONUS_BPS / 10000);
        }

        // Apply house edge
        odds = odds - (odds * HOUSE_EDGE_BPS / 10000);

        return Math.floor((stake * odds) / 10000);
      }

      case "Parlay": {
        let combinedOdds = 10000; // Start at 1.0x

        for (const bet of betslip) {
          let betOdds = bet.odds;

          // Apply badge bonus
          const hasBadge = badges.length > 0;
          if (hasBadge) {
            betOdds = betOdds + (betOdds * BADGE_BONUS_BPS / 10000);
          }

          // Multiply odds
          combinedOdds = Math.floor((combinedOdds * betOdds) / 10000);
        }

        // Apply house edge to combined odds
        combinedOdds = combinedOdds - Math.floor((combinedOdds * HOUSE_EDGE_BPS) / 10000);

        // V2: Apply capped parlay multiplier
        const parlayMultiplier = calculateParlayMultiplier(betslip.length);
        const rawPayout = Math.floor((stake * combinedOdds) / 10000);
        const boostedPayout = Math.floor((rawPayout * parlayMultiplier) / 10000);

        // V2: Cap at MAX_PAYOUT_PER_BET
        return Math.min(boostedPayout, MAX_PAYOUT_PER_BET);
      }

      case "SystemBet": {
        const stakePerBet = Math.floor(stake / betslip.length);
        let totalPayout = 0;

        for (const bet of betslip) {
          let odds = bet.odds;

          // Apply badge bonus
          const hasBadge = badges.length > 0;
          if (hasBadge) {
            odds = odds + (odds * BADGE_BONUS_BPS / 10000);
          }

          // Apply house edge
          odds = odds - (odds * HOUSE_EDGE_BPS / 10000);

          totalPayout += Math.floor((stakePerBet * odds) / 10000);
        }

        return totalPayout;
      }

      default:
        return 0;
    }
  }, [betslip, betType]);

  // Submit betslip to blockchain
  const submitBetslip = useCallback(async (
    walletAddress: string,
    badges: number[] = [],
    onSuccess?: (txid: string) => void
  ) => {
    if (betslip.length === 0) {
      throw new Error("Betslip is empty");
    }

    if (totalStake < MIN_BET) {
      throw new Error(`Minimum bet is ${MIN_BET} LEAGUE tokens`);
    }

    if (totalStake > MAX_BET) {
      throw new Error(`Maximum bet is ${MAX_BET} LEAGUE tokens`);
    }

    setSubmitting(true);

    try {
      // Real implementation:
      // 1. Get connected wallet (Leather/Unisat)
      // 2. Build betslip spell YAML
      // 3. Submit transaction to Bitcoin
      // 4. Extract charms from confirmation

      // const wallet = await getConnectedWallet();
      // const slip_id = generateUUID();
      // const timestamp = Math.floor(Date.now() / 1000);
      //
      // // Build spell based on bet type
      // const spellFile = betType === "Single"
      //   ? "./spells/11-create-betslip-single.yaml"
      //   : betType === "Parlay"
      //   ? "./spells/12-create-betslip-parlay.yaml"
      //   : "./spells/13-create-betslip-system.yaml";
      //
      // // Prepare spell variables
      // const potential_payout = calculatePotentialPayout(totalStake, badges);
      // const stake_per_bet = betType === "SystemBet"
      //   ? Math.floor(totalStake / betslip.length)
      //   : 0;
      //
      // const spellData = {
      //   app_id: process.env.NEXT_PUBLIC_APP_ID,
      //   app_vk: process.env.NEXT_PUBLIC_APP_VK,
      //   bettor_token_utxo: wallet.getUtxo(),
      //   total_stake: totalStake,
      //   slip_id,
      //   bettor_address: walletAddress,
      //   match_id_1: betslip[0].match_id,
      //   prediction_1: betslip[0].prediction,
      //   odds_1: betslip[0].odds,
      //   // ... more matches for parlay/system
      //   potential_payout,
      //   stake_per_bet,
      //   badges_array: JSON.stringify(badges),
      //   timestamp,
      // };
      //
      // // Build and submit transaction
      // const txHex = await buildTransaction(spellFile, spellData);
      // const txid = await broadcastTransaction(txHex);
      //
      // // Extract charms for confirmation
      // const result = await extractAndVerifySpell(txHex, "testnet4");
      // if (!result.success) {
      //   throw new Error(result.error || "Failed to extract betslip charm");
      // }
      //
      // // Find betslip charm
      // const betslipCharm = result.charms.find(c =>
      //   c.appId.includes("15/") && c.app.slip_id === slip_id
      // );
      //
      // if (!betslipCharm) {
      //   throw new Error("Betslip charm not found in transaction");
      // }

      // Simulate for now
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const mockTxid = "mock_txid_" + Date.now();

      // Clear betslip after successful submission
      clearBetslip();

      if (onSuccess) {
        onSuccess(mockTxid);
      }

      return mockTxid;

    } catch (error) {
      console.error("Error submitting betslip:", error);
      throw error;
    } finally {
      setSubmitting(false);
    }
  }, [betslip, betType, totalStake, calculatePotentialPayout, clearBetslip]);

  // Fetch user's betslips from blockchain
  const fetchUserBetslips = useCallback(async (
    walletAddress: string
  ): Promise<BetslipData[]> => {
    try {
      // Real implementation:
      // 1. Query indexer for betslip transactions to this address
      // 2. Extract charms from each transaction
      // 3. Parse betslip data
      //
      // const txs = await fetch(`/api/betslips?address=${walletAddress}`);
      // const betslipTxs = await txs.json();
      //
      // const betslips: BetslipData[] = [];
      //
      // for (const tx of betslipTxs) {
      //   const txHex = await fetchTransactionHex(tx.txid, "testnet4");
      //   const result = await extractAndVerifySpell(txHex, "testnet4");
      //
      //   if (result.success) {
      //     // Filter for BETSLIP_NFT charms (tag 15)
      //     const betslipCharms = result.charms.filter(c =>
      //       c.appId.includes("15/") && c.address === walletAddress
      //     );
      //
      //     for (const charm of betslipCharms) {
      //       betslips.push({
      //         slip_id: charm.app.slip_id,
      //         bettor: charm.app.bettor,
      //         bet_type: charm.app.bet_type,
      //         bets: charm.app.bets,
      //         total_stake: charm.app.total_stake,
      //         stake_per_bet: charm.app.stake_per_bet,
      //         potential_payout: charm.app.potential_payout,
      //         badges: charm.app.badges,
      //         settled: charm.app.settled,
      //         payout_amount: charm.app.payout_amount,
      //         timestamp: charm.app.timestamp,
      //       });
      //     }
      //   }
      // }
      //
      // return betslips;

      // Mock for now
      return [];
    } catch (error) {
      console.error("Error fetching betslips:", error);
      return [];
    }
  }, []);

  return {
    betslip,
    betType,
    totalStake,
    submitting,
    addBet,
    removeBet,
    clearBetslip,
    setBetType,
    setTotalStake,
    calculatePotentialPayout,
    calculateOddsWeightedAllocations, // V2: For displaying allocations
    submitBetslip,
    fetchUserBetslips,
  };
}

// Helper to broadcast transaction
async function broadcastTransaction(txHex: string): Promise<string> {
  const response = await fetch("https://mempool.space/testnet4/api/tx", {
    method: "POST",
    body: txHex,
  });

  if (!response.ok) {
    throw new Error(`Failed to broadcast: ${response.statusText}`);
  }

  return response.text(); // Returns txid
}
