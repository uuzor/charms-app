import { useState, useEffect } from "react";
import { UserBalance, BadgeData } from "../types";

export function useWallet() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<UserBalance>({
    league: 100000, // Mock balance
    badges: [],
    bets: [],
  });
  const [connecting, setConnecting] = useState(false);

  const connect = async () => {
    setConnecting(true);
    // Simulate wallet connection
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setConnected(true);
    setAddress("tb1p3w06fgh64axkj3uphn4t258ehweccm367vkdhkvz8qzdagjctm8qaw2xyv");
    setConnecting(false);
  };

  const disconnect = () => {
    setConnected(false);
    setAddress(null);
  };

  const hasBadge = (teamName: string): boolean => {
    return balance.badges.some((badge) => badge.teamName === teamName);
  };

  const getBadgeBonus = (teamName: string): number => {
    const badge = balance.badges.find((b) => b.teamName === teamName);
    return badge?.bonusBps || 0;
  };

  return {
    connected,
    address,
    balance,
    connecting,
    connect,
    disconnect,
    hasBadge,
    getBadgeBonus,
  };
}
