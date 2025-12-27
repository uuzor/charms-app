"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy, Wallet } from "lucide-react";
import { Button } from "./ui/button";
import { useWallet } from "@/lib/hooks/useWallet";
import { formatTokenAmount, cn } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();
  const { connected, address, balance, connect, connecting } = useWallet();

  const navLinks = [
    { href: "/", label: "Matches" },
    { href: "/leaderboard", label: "Leaderboard" },
    { href: "/badges", label: "Badges" },
    { href: "/my-bets", label: "My Bets" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-lg">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white">
              <Trophy className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold">PL Betting</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  pathname === link.href
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Wallet */}
          <div className="flex items-center gap-3">
            {connected ? (
              <>
                <div className="hidden sm:flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2">
                  <span className="text-sm font-medium">
                    {formatTokenAmount(balance.league)}
                  </span>
                  <span className="text-xs text-gray-500">LEAGUE</span>
                </div>
                <div className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </div>
              </>
            ) : (
              <Button
                onClick={connect}
                disabled={connecting}
                variant="primary"
                className="gap-2"
              >
                <Wallet className="h-4 w-4" />
                {connecting ? "Connecting..." : "Connect Wallet"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
