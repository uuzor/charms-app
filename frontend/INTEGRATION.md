# 🔗 Charms SDK Integration Guide

This document explains how to integrate the Premier League Betting frontend with real Bitcoin wallets and the Charms protocol.

## 📋 Current Status

The frontend is currently set up with:
- ✅ **Charms JS SDK installed** (`charms-js`)
- ✅ **WASM file in place** (`public/charms_lib_bg.wasm`)
- ✅ **Mock data for demo** (shows UI and functionality)
- ⏳ **Real integration** (requires Bitcoin wallet + transaction indexer)

## 🔌 Integration Steps

### 1. Bitcoin Wallet Integration

#### Option A: Leather Wallet (Recommended for Bitcoin)
```typescript
// lib/wallet/leather.ts
declare global {
  interface Window {
    LeatherProvider?: {
      request: (method: string, params?: any) => Promise<any>;
    };
  }
}

export async function connectLeatherWallet() {
  if (!window.LeatherProvider) {
    throw new Error("Leather wallet not installed");
  }

  const accounts = await window.LeatherProvider.request("getAccounts");
  const address = accounts[0];

  return {
    address,
    getUtxos: async () => {
      return window.LeatherProvider!.request("getUtxos");
    },
    signTransaction: async (tx: string) => {
      return window.LeatherProvider!.request("signTransaction", { tx });
    },
  };
}
```

#### Option B: Unisat Wallet
```typescript
// lib/wallet/unisat.ts
export async function connectUnisatWallet() {
  if (!window.unisat) {
    throw new Error("Unisat wallet not installed");
  }

  const accounts = await window.unisat.requestAccounts();
  const address = accounts[0];

  return {
    address,
    getUtxos: async () => {
      return window.unisat.getBitcoinUtxos();
    },
    signTransaction: async (txHex: string) => {
      return window.unisat.signPsbt(txHex);
    },
  };
}
```

### 2. Update useWallet Hook

```typescript
// lib/hooks/useWallet.ts
import { useState } from "react";
import { connectLeatherWallet } from "../wallet/leather";
import { extractCharmsForWallet } from "charms-js";

export function useWallet() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [wallet, setWallet] = useState<any>(null);

  const connect = async () => {
    try {
      const walletInstance = await connectLeatherWallet();
      setWallet(walletInstance);
      setAddress(walletInstance.address);
      setConnected(true);

      // Fetch user's charms
      await fetchUserCharms(walletInstance.address);
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      throw error;
    }
  };

  const fetchUserCharms = async (walletAddress: string) => {
    // 1. Get all transactions for this address
    const txs = await fetchAddressTransactions(walletAddress);

    // 2. Extract charms from each transaction
    for (const tx of txs) {
      const txHex = await fetchTransactionHex(tx.txid);
      const charms = await extractCharmsForWallet(
        txHex,
        tx.txid,
        [walletAddress],
        "testnet4"
      );

      // 3. Parse charms by type
      const leagueTokens = charms.filter(c => c.app.startsWith("t/"));
      const badges = charms.filter(c => c.app.startsWith("12/"));
      const bets = charms.filter(c => c.app.startsWith("11/"));

      // Update state with user's assets
      setBalance({
        league: leagueTokens.reduce((sum, t) => sum + t.amount, 0),
        badges: badges.map(b => parseBadgeCharm(b.data)),
        bets: bets.map(b => parseBetCharm(b.data)),
      });
    }
  };

  return {
    connected,
    address,
    wallet,
    connect,
    disconnect,
    fetchUserCharms,
  };
}
```

### 3. Transaction Building

#### Creating a Bet Transaction

```typescript
// lib/transactions/betting.ts
import * as bitcoin from "bitcoinjs-lib";
import { extractCharmsForWallet } from "charms-js";

export async function createBetTransaction(
  wallet: any,
  match: MatchData,
  prediction: MatchResult,
  stake: number,
  appId: string,
  appVk: string
) {
  // 1. Get UTXOs from wallet
  const utxos = await wallet.getUtxos();

  // 2. Find UTXO with LEAGUE tokens
  const leagueUtxo = findLeagueTokenUtxo(utxos, stake, appId, appVk);
  if (!leagueUtxo) {
    throw new Error("Insufficient LEAGUE tokens");
  }

  // 3. Build transaction
  const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet });

  // Add input with LEAGUE tokens
  psbt.addInput({
    hash: leagueUtxo.txid,
    index: leagueUtxo.vout,
    witnessUtxo: {
      script: Buffer.from(leagueUtxo.scriptPubKey, "hex"),
      value: leagueUtxo.value,
    },
  });

  // 4. Add outputs with Charms

  // Output 1: Bet NFT to user
  const betCharmData = {
    match_id: `${match.seasonId}_${match.turn}_${match.matchId}`,
    prediction,
    stake,
    odds: getOddsForPrediction(match, prediction),
    bettor: wallet.address,
    has_badge: false,
    settled: false,
  };

  psbt.addOutput({
    address: wallet.address,
    value: 546, // Dust limit
    // Charm witness data would go in tapscript
  });

  // Output 2: LEAGUE tokens to house
  const houseAddress = "tb1p..."; // House address
  psbt.addOutput({
    address: houseAddress,
    value: 546,
    // LEAGUE token charm in tapscript
  });

  // 5. Sign transaction
  const signedPsbt = await wallet.signTransaction(psbt.toHex());

  // 6. Broadcast
  const txHex = bitcoin.Psbt.fromHex(signedPsbt).extractTransaction().toHex();
  const txid = await broadcastTransaction(txHex);

  // 7. Extract and return charms
  const charms = await extractCharmsForWallet(
    txHex,
    txid,
    [wallet.address],
    "testnet4"
  );

  return {
    txid,
    charms,
  };
}

function findLeagueTokenUtxo(utxos: any[], requiredAmount: number, appId: string, appVk: string) {
  // Find UTXO with LEAGUE token charm that has sufficient balance
  for (const utxo of utxos) {
    if (utxo.charms) {
      const leagueCharm = utxo.charms.find((c: any) =>
        c.app === `t/${appId}/${appVk}` && c.amount >= requiredAmount
      );
      if (leagueCharm) return utxo;
    }
  }
  return null;
}
```

### 4. Indexer Integration

You'll need a service to index Charms transactions. Options:

#### Option A: Custom Indexer
Build a service that:
1. Watches Bitcoin mempool for Charms transactions
2. Extracts charms using `charms-js`
3. Stores in database (PostgreSQL recommended)
4. Provides REST API for frontend

#### Option B: Use Existing Indexer
```typescript
// lib/api/indexer.ts
const INDEXER_API = "https://your-charms-indexer.com/api";

export async function fetchMatches(seasonId: string, turn: number) {
  const response = await fetch(
    `${INDEXER_API}/matches?seasonId=${seasonId}&turn=${turn}`
  );
  return response.json();
}

export async function fetchUserBets(address: string) {
  const response = await fetch(`${INDEXER_API}/bets?address=${address}`);
  return response.json();
}

export async function fetchUserBadges(address: string) {
  const response = await fetch(`${INDEXER_API}/badges?address=${address}`);
  return response.json();
}
```

### 5. Update Hooks to Use Real Data

#### useMatches.ts
```typescript
export function useMatches(seasonId: string, turn: number) {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        // Fetch from indexer
        const data = await fetch(`/api/matches?season=${seasonId}&turn=${turn}`);
        const matchTxs = await data.json();

        // Extract charms from each transaction
        const matches: MatchData[] = [];
        for (const tx of matchTxs) {
          const txHex = await fetchTransactionHex(tx.txid);
          const charms = await extractCharmsForWallet(
            txHex,
            tx.txid,
            [], // Empty since we want all matches, not filtered by wallet
            "testnet4"
          );

          const matchCharms = charms
            .filter(c => c.app.startsWith("10/"))
            .map(c => parseMatchCharm(c.data));

          matches.push(...matchCharms);
        }

        setMatches(matches);
      } catch (error) {
        console.error("Error fetching matches:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, [seasonId, turn]);

  return { matches, loading };
}
```

## 🧪 Testing

### Testnet Setup

1. Get testnet4 Bitcoin from faucet:
   - https://mempool.space/testnet4/faucet

2. Deploy contract to testnet:
   ```bash
   cd ..  # Go to project root
   cargo build --release --target wasm32-wasip1
   charms app vk
   ```

3. Create test transactions:
   ```bash
   # Create season
   export season_id=$(uuidgen)
   cat spells/01-create-season.yaml | envsubst | charms spell check

   # Create matches
   cat spells/02-create-matches.yaml | envsubst | charms spell check
   ```

4. Test in frontend:
   ```bash
   cd frontend
   npm run dev
   ```

## 📚 Resources

- **Charms JS SDK**: https://github.com/CharmsDev/charms-js
- **Charms Docs**: https://docs.charms.dev
- **Bitcoin.js**: https://github.com/bitcoinjs/bitcoinjs-lib
- **Mempool API**: https://mempool.space/docs/api

## 🚀 Deployment

### Environment Variables

```env
# .env.local
NEXT_PUBLIC_NETWORK=testnet4
NEXT_PUBLIC_APP_ID=your_app_id
NEXT_PUBLIC_APP_VK=your_app_vk
NEXT_PUBLIC_HOUSE_ADDRESS=your_house_address
NEXT_PUBLIC_INDEXER_API=https://your-indexer.com/api
```

### Build for Production

```bash
npm run build
npm start
```

### Deploy to Vercel

```bash
vercel deploy
```

The WASM file in `public/` will be automatically served.

## 🔒 Security Considerations

1. **Never store private keys** in frontend
2. **Always use wallet providers** (Leather, Unisat)
3. **Validate all transaction data** before signing
4. **Use HTTPS** in production
5. **Rate limit API calls** to indexer
6. **Sanitize user inputs** to prevent injection attacks

## 📝 Next Steps

1. [ ] Integrate Bitcoin wallet (Leather or Unisat)
2. [ ] Set up transaction indexer service
3. [ ] Update hooks to fetch real data
4. [ ] Test on Bitcoin testnet4
5. [ ] Add wallet connection UI
6. [ ] Implement transaction signing
7. [ ] Deploy indexer and frontend
8. [ ] Launch on mainnet

## 💡 Need Help?

- Check the [Charms Discord](https://discord.gg/charms)
- Review [example transactions](../spells/)
- See [contract tests](../src/lib.rs)

---

Built for BitcoinOS Charms Hackathon 🏆
