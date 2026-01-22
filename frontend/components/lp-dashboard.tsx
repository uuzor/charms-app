"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Droplet,
  DollarSign,
  Percent,
  AlertCircle,
  Lock,
  Unlock,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Button } from "./ui/button";
import { useLiquidityPool } from "@/lib/hooks/useLiquidityPool";
import { LPPosition } from "@/lib/types/betslip";
import { formatCurrency } from "@/lib/types/betslip";

interface LPDashboardProps {
  walletAddress?: string;
  poolId?: string;
}

export function LPDashboard({
  walletAddress,
  poolId = "season_2024_25",
}: LPDashboardProps) {
  const {
    poolData,
    loading,
    error,
    depositLiquidity,
    withdrawLiquidity,
    fetchLPPosition,
    calculatePoolAPY,
  } = useLiquidityPool(poolId);

  const [lpPosition, setLPPosition] = useState<LPPosition | null>(null);
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [withdrawShares, setWithdrawShares] = useState<string>("");
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  // Fetch LP position when wallet is connected
  useEffect(() => {
    if (walletAddress && poolData) {
      fetchLPPosition(walletAddress).then(setLPPosition);
    }
  }, [walletAddress, poolData, fetchLPPosition]);

  const handleDeposit = async () => {
    if (!walletAddress) {
      alert("Please connect your wallet first");
      return;
    }

    const amount = parseInt(depositAmount);
    if (!amount || amount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    setIsDepositing(true);
    try {
      await depositLiquidity(walletAddress, amount, (shareId) => {
        console.log("LP share created:", shareId);
        setDepositAmount("");
        setShowDeposit(false);
        // Refresh position
        fetchLPPosition(walletAddress).then(setLPPosition);
      });
    } catch (err: any) {
      alert(err.message || "Failed to deposit liquidity");
    } finally {
      setIsDepositing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!lpPosition) {
      alert("No LP position found");
      return;
    }

    const shares = parseInt(withdrawShares);
    if (!shares || shares <= 0) {
      alert("Please enter a valid number of shares");
      return;
    }

    if (shares > lpPosition.shares) {
      alert(`You only have ${lpPosition.shares.toLocaleString()} shares`);
      return;
    }

    setIsWithdrawing(true);
    try {
      await withdrawLiquidity("mock_share_id", shares, (netAmount) => {
        console.log("Withdrawn:", netAmount);
        setWithdrawShares("");
        setShowWithdraw(false);
        // Refresh position
        if (walletAddress) {
          fetchLPPosition(walletAddress).then(setLPPosition);
        }
      });
    } catch (err: any) {
      alert(err.message || "Failed to withdraw liquidity");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const poolAPY = poolData ? calculatePoolAPY() : 0;

  if (loading && !poolData) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-white/60">Loading pool data...</div>
      </div>
    );
  }

  if (error && !poolData) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-red-400">Failed to load pool data</div>
      </div>
    );
  }

  if (!poolData) {
    return null;
  }

  // Calculate pool utilization
  const utilization = poolData.total_liquidity > 0
    ? (poolData.total_bets_in_play * 100) / poolData.total_liquidity
    : 0;

  return (
    <div className="space-y-6">
      {/* Pool Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-black/40 border-white/10">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/60">Total Liquidity</span>
              <Droplet className="w-4 h-4 text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {poolData.total_liquidity.toLocaleString()}
            </div>
            <div className="text-xs text-white/40">LEAGUE</div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-white/10">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/60">Utilization</span>
              <Percent className="w-4 h-4 text-yellow-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {utilization.toFixed(1)}%
            </div>
            <div className="text-xs text-white/40">
              {poolData.total_bets_in_play.toLocaleString()} in play
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-white/10">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/60">Pool APY</span>
              <TrendingUp className="w-4 h-4 text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {(poolAPY / 100).toFixed(2)}%
            </div>
            <div className="text-xs text-white/40">Annualized</div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-white/10">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/60">Net Profit</span>
              <DollarSign className="w-4 h-4 text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {(poolData.total_collected - poolData.total_paid_out).toLocaleString()}
            </div>
            <div className="text-xs text-white/40">LEAGUE</div>
          </CardContent>
        </Card>
      </div>

      {/* LP Position */}
      {walletAddress && lpPosition && (
        <Card className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border-blue-400/30">
          <CardHeader>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Droplet className="w-5 h-5 text-blue-400" />
              Your LP Position
            </h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-white/60 mb-1">Shares</div>
                <div className="text-xl font-bold text-white">
                  {lpPosition.shares.toLocaleString()}
                </div>
              </div>

              <div>
                <div className="text-xs text-white/60 mb-1">Current Value</div>
                <div className="text-xl font-bold text-white">
                  {lpPosition.current_value.toLocaleString()}
                </div>
              </div>

              <div>
                <div className="text-xs text-white/60 mb-1">Unrealized P/L</div>
                <div
                  className={`text-xl font-bold ${
                    lpPosition.unrealized_profit >= 0
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {lpPosition.unrealized_profit >= 0 ? "+" : ""}
                  {lpPosition.unrealized_profit.toLocaleString()}
                </div>
              </div>

              <div>
                <div className="text-xs text-white/60 mb-1">ROI</div>
                <div
                  className={`text-xl font-bold flex items-center gap-1 ${
                    lpPosition.roi_bps >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {lpPosition.roi_bps >= 0 ? (
                    <TrendingUp className="w-5 h-5" />
                  ) : (
                    <TrendingDown className="w-5 h-5" />
                  )}
                  {(lpPosition.roi_bps / 100).toFixed(2)}%
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => setShowWithdraw(!showWithdraw)}
                className="flex-1"
                variant="outline"
              >
                <Unlock className="w-4 h-4 mr-2" />
                Withdraw
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deposit/Withdraw Forms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Deposit Form */}
        <Card className="bg-black/40 border-white/10">
          <CardHeader>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-green-400" />
              Deposit Liquidity
            </h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-2">
                Amount (LEAGUE)
              </label>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="Enter amount..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-green-400/50 transition-all"
              />
            </div>

            {depositAmount && poolData && (
              <div className="bg-white/5 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/60">You will receive:</span>
                  <span className="text-white font-medium">
                    ~{parseInt(depositAmount).toLocaleString()} shares
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Share price:</span>
                  <span className="text-white/40">1:1 (initial)</span>
                </div>
              </div>
            )}

            <Button
              onClick={handleDeposit}
              disabled={isDepositing || !walletAddress || !depositAmount}
              className="w-full"
            >
              {isDepositing ? "Depositing..." : "Deposit"}
            </Button>

            {!walletAddress && (
              <div className="flex items-center gap-2 text-xs text-yellow-400">
                <AlertCircle className="w-4 h-4" />
                <span>Connect wallet to deposit</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Withdraw Form */}
        <Card className="bg-black/40 border-white/10">
          <CardHeader>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Unlock className="w-5 h-5 text-orange-400" />
              Withdraw Liquidity
            </h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-2">
                Shares to Withdraw
              </label>
              <input
                type="number"
                value={withdrawShares}
                onChange={(e) => setWithdrawShares(e.target.value)}
                placeholder="Enter shares..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-orange-400/50 transition-all"
                disabled={!lpPosition}
              />
              {lpPosition && (
                <div className="text-xs text-white/40 mt-1">
                  Available: {lpPosition.shares.toLocaleString()} shares
                </div>
              )}
            </div>

            {withdrawShares && poolData && lpPosition && (
              <div className="bg-white/5 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/60">You will receive:</span>
                  <span className="text-white font-medium">
                    ~
                    {Math.floor(
                      (parseInt(withdrawShares) * poolData.total_liquidity) /
                        poolData.total_shares
                    ).toLocaleString()}{" "}
                    LEAGUE
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Withdrawal fee (0.5%):</span>
                  <span className="text-red-400">
                    ~
                    {Math.floor(
                      (parseInt(withdrawShares) *
                        poolData.total_liquidity *
                        50) /
                        poolData.total_shares /
                        10000
                    ).toLocaleString()}{" "}
                    LEAGUE
                  </span>
                </div>
              </div>
            )}

            <Button
              onClick={handleWithdraw}
              disabled={isWithdrawing || !lpPosition || !withdrawShares}
              className="w-full"
              variant="outline"
            >
              {isWithdrawing ? "Withdrawing..." : "Withdraw"}
            </Button>

            {!lpPosition && walletAddress && (
              <div className="flex items-center gap-2 text-xs text-yellow-400">
                <AlertCircle className="w-4 h-4" />
                <span>No LP position found</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pool Details */}
      <Card className="bg-black/40 border-white/10">
        <CardHeader>
          <h3 className="text-lg font-semibold text-white">Pool Details</h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-white/60 mb-1">Pool ID</div>
              <div className="text-white font-mono">{poolData.pool_id}</div>
            </div>

            <div>
              <div className="text-white/60 mb-1">Total Shares</div>
              <div className="text-white">
                {poolData.total_shares.toLocaleString()}
              </div>
            </div>

            <div>
              <div className="text-white/60 mb-1">Min Liquidity</div>
              <div className="text-white">
                {poolData.min_liquidity.toLocaleString()} LEAGUE
              </div>
            </div>

            <div>
              <div className="text-white/60 mb-1">Total Paid Out</div>
              <div className="text-white">
                {poolData.total_paid_out.toLocaleString()} LEAGUE
              </div>
            </div>

            <div>
              <div className="text-white/60 mb-1">Total Collected</div>
              <div className="text-white">
                {poolData.total_collected.toLocaleString()} LEAGUE
              </div>
            </div>

            <div>
              <div className="text-white/60 mb-1">Protocol Revenue</div>
              <div className="text-white">
                {poolData.protocol_revenue.toLocaleString()} LEAGUE
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
