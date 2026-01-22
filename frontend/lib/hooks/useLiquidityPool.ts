import { useState, useCallback, useEffect } from "react";
import { extractAndVerifySpell } from "charms-js";
import { fetchTransactionHex } from "./useCharms";
import {
  LiquidityPoolData,
  LPShareData,
  LPPosition,
  WITHDRAWAL_FEE_BPS,
  MINIMUM_LIQUIDITY_LOCK,
} from "../types/betslip";

export function useLiquidityPool(poolId: string = "season_2024_25") {
  const [poolData, setPoolData] = useState<LiquidityPoolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch liquidity pool data from blockchain
  useEffect(() => {
    const fetchPoolData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Real implementation:
        // 1. Query indexer for liquidity pool NFT transaction
        const response = await fetch(`/api/liquidity-pool?id=${poolId}`);

        if (!response.ok) {
          throw new Error("Failed to fetch pool data");
        }

        const poolTxId: string = await response.json();

        // 2. Extract charm from transaction
        const txHex = await fetchTransactionHex(poolTxId, "testnet4");
        const result = await extractAndVerifySpell(txHex, "testnet4");

        if (!result.success) {
          throw new Error(result.error || "Failed to extract pool charm");
        }

        // Filter for LIQUIDITY_POOL_NFT (tag 16)
        const poolCharm = result.charms.find(c =>
          c.appId.includes("16/") && c.app.pool_id === poolId
        );

        if (!poolCharm) {
          throw new Error("Pool charm not found");
        }

        setPoolData({
          pool_id: poolCharm.app.pool_id,
          total_liquidity: poolCharm.app.total_liquidity,
          total_bets_in_play: poolCharm.app.total_bets_in_play,
          total_paid_out: poolCharm.app.total_paid_out,
          total_collected: poolCharm.app.total_collected,
          protocol_revenue: poolCharm.app.protocol_revenue,
          house_balance: poolCharm.app.house_balance,
          is_active: poolCharm.app.is_active,
          min_liquidity: poolCharm.app.min_liquidity,
          total_shares: poolCharm.app.total_shares,
        });
      } catch (err) {
        console.error("Error fetching pool data:", err);

        // Fallback to demo data
        console.warn("Using fallback pool data");
        setPoolData({
          pool_id: poolId,
          total_liquidity: 5_000_000,
          total_bets_in_play: 250_000,
          total_paid_out: 1_200_000,
          total_collected: 1_800_000,
          protocol_revenue: 36_000,
          house_balance: 5_600_000,
          is_active: true,
          min_liquidity: 100_000,
          total_shares: 5_000_000, // V2: 1:1 ratio initially
        });
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchPoolData();
  }, [poolId]);

  // Deposit liquidity and receive LP shares
  const depositLiquidity = useCallback(async (
    walletAddress: string,
    amount: number,
    onSuccess?: (shareId: string) => void
  ): Promise<string> => {
    if (!poolData) {
      throw new Error("Pool data not loaded");
    }

    if (amount <= 0) {
      throw new Error("Deposit amount must be positive");
    }

    try {
      // Real implementation:
      // 1. Calculate shares to mint
      const sharesToMint = poolData.total_shares === 0
        ? amount // First deposit: 1:1 ratio
        : Math.floor((amount * poolData.total_shares) / poolData.total_liquidity);

      // 2. Build deposit spell
      // const shareId = generateUUID();
      // const spellData = {
      //   app_id: process.env.NEXT_PUBLIC_APP_ID,
      //   app_vk: process.env.NEXT_PUBLIC_APP_VK,
      //   pool_id: poolId,
      //   lp_address: walletAddress,
      //   deposit_amount: amount,
      //   shares_to_mint: sharesToMint,
      //   share_id: shareId,
      //   timestamp: Math.floor(Date.now() / 1000),
      // };

      // 3. Submit transaction
      // const txHex = await buildTransaction("./spells/17-lp-deposit.yaml", spellData);
      // const txid = await broadcastTransaction(txHex);

      // 4. Verify LP share charm created
      // const result = await extractAndVerifySpell(txHex, "testnet4");
      // if (!result.success) {
      //   throw new Error("Failed to create LP share");
      // }

      // Simulate for now
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const mockShareId = `share_${Date.now()}`;

      if (onSuccess) {
        onSuccess(mockShareId);
      }

      return mockShareId;
    } catch (error) {
      console.error("Error depositing liquidity:", error);
      throw error;
    }
  }, [poolData, poolId]);

  // Withdraw liquidity by burning LP shares
  const withdrawLiquidity = useCallback(async (
    shareId: string,
    sharesToBurn: number,
    onSuccess?: (amount: number) => void
  ): Promise<number> => {
    if (!poolData) {
      throw new Error("Pool data not loaded");
    }

    if (sharesToBurn < MINIMUM_LIQUIDITY_LOCK) {
      throw new Error(`Minimum ${MINIMUM_LIQUIDITY_LOCK} shares must remain locked`);
    }

    try {
      // Real implementation:
      // 1. Calculate withdrawal amount
      const withdrawalAmount = Math.floor(
        (sharesToBurn * poolData.total_liquidity) / poolData.total_shares
      );

      // 2. Apply withdrawal fee (0.5%)
      const fee = Math.floor((withdrawalAmount * WITHDRAWAL_FEE_BPS) / 10000);
      const netAmount = withdrawalAmount - fee;

      // 3. Build withdrawal spell
      // const spellData = {
      //   app_id: process.env.NEXT_PUBLIC_APP_ID,
      //   app_vk: process.env.NEXT_PUBLIC_APP_VK,
      //   pool_id: poolId,
      //   share_id: shareId,
      //   shares_to_burn: sharesToBurn,
      //   withdrawal_amount: withdrawalAmount,
      //   fee_amount: fee,
      //   net_amount: netAmount,
      //   timestamp: Math.floor(Date.now() / 1000),
      // };

      // 4. Submit transaction
      // const txHex = await buildTransaction("./spells/18-lp-withdraw.yaml", spellData);
      // const txid = await broadcastTransaction(txHex);

      // Simulate for now
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (onSuccess) {
        onSuccess(netAmount);
      }

      return netAmount;
    } catch (error) {
      console.error("Error withdrawing liquidity:", error);
      throw error;
    }
  }, [poolData, poolId]);

  // Fetch LP position for a wallet address
  const fetchLPPosition = useCallback(async (
    walletAddress: string
  ): Promise<LPPosition | null> => {
    try {
      // Real implementation:
      // 1. Query indexer for LP share NFTs owned by address
      const response = await fetch(`/api/lp-shares?address=${walletAddress}&pool=${poolId}`);

      if (!response.ok) {
        throw new Error("Failed to fetch LP shares");
      }

      const shareTxIds: string[] = await response.json();

      if (shareTxIds.length === 0) {
        return null; // No LP position
      }

      // 2. Extract and aggregate all shares
      let totalShares = 0;
      let totalInitialDeposit = 0;
      let totalWithdrawn = 0;

      for (const txid of shareTxIds) {
        const txHex = await fetchTransactionHex(txid, "testnet4");
        const result = await extractAndVerifySpell(txHex, "testnet4");

        if (result.success) {
          const shareCharms = result.charms.filter(c =>
            c.appId.includes("17/") && c.app.lp_address === walletAddress
          );

          for (const charm of shareCharms) {
            const shareData: LPShareData = {
              share_id: charm.app.share_id,
              lp_address: charm.app.lp_address,
              shares: charm.app.shares,
              initial_deposit: charm.app.initial_deposit,
              total_withdrawn: charm.app.total_withdrawn,
              deposit_timestamp: charm.app.deposit_timestamp,
            };

            totalShares += shareData.shares;
            totalInitialDeposit += shareData.initial_deposit;
            totalWithdrawn += shareData.total_withdrawn;
          }
        }
      }

      if (!poolData) {
        throw new Error("Pool data not available");
      }

      // 3. Calculate current value and profit/loss
      const currentValue = Math.floor(
        (totalShares * poolData.total_liquidity) / poolData.total_shares
      );

      const unrealizedProfit = currentValue - (totalInitialDeposit - totalWithdrawn);
      const realizedProfit = totalWithdrawn > 0
        ? totalWithdrawn - totalInitialDeposit
        : 0;

      const roiBps = totalInitialDeposit > 0
        ? Math.floor((unrealizedProfit * 10000) / totalInitialDeposit)
        : 0;

      return {
        lp_address: walletAddress,
        shares: totalShares,
        initial_deposit: totalInitialDeposit,
        total_withdrawn: totalWithdrawn,
        current_value: currentValue,
        unrealized_profit: unrealizedProfit,
        realized_profit: realizedProfit,
        roi_bps: roiBps,
      };
    } catch (error) {
      console.error("Error fetching LP position:", error);
      return null;
    }
  }, [poolData, poolId]);

  // Calculate APY based on historical performance
  const calculatePoolAPY = useCallback((): number => {
    if (!poolData) return 0;

    // Real implementation would track historical data
    // For now, calculate based on net profit
    const netProfit = poolData.total_collected - poolData.total_paid_out;
    const profitRate = poolData.total_liquidity > 0
      ? netProfit / poolData.total_liquidity
      : 0;

    // Annualize (assuming 38 turns per season, ~9 months)
    const annualizedRate = (profitRate * 365) / 270; // 270 days per season
    return Math.floor(annualizedRate * 10000); // Return in basis points
  }, [poolData]);

  return {
    poolData,
    loading,
    error,
    depositLiquidity,
    withdrawLiquidity,
    fetchLPPosition,
    calculatePoolAPY,
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
