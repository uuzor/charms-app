# Deployment Guide: Premier League Virtual Betting on Bitcoin Testnet4

This guide walks you through deploying your Premier League betting dApp to Bitcoin Testnet4 using the Charms Protocol.

## Prerequisites

- Rust toolchain installed (`rustup`)
- Bitcoin Core or compatible wallet with Testnet4 access
- Some testnet BTC for transaction fees
- Linux/macOS environment (WSL2 for Windows)

## Step 1: Install Charms CLI

```bash
# Set cargo target directory (important for dependency resolution)
export CARGO_TARGET_DIR=$(mktemp -d)/target

# Install Charms CLI v0.10.0
cargo install charms --version=0.10.0

# Navigate to your project
cd /path/to/charms-app
unset CARGO_TARGET_DIR
cargo update
```

## Step 2: Build Your Smart Contract

The WASM binary has already been compiled. Verify it exists:

```bash
# Check if WASM exists
ls -lh target/wasm32-unknown-unknown/release/premier_league_betting.wasm

# Output should show ~295KB file
```

If you need to rebuild:

```bash
cargo build --release --target wasm32-unknown-unknown
```

## Step 3: Get App Verification Key

```bash
# Build app and get verification key
app_bin=$(charms app build)
export app_vk=$(charms app vk "$app_bin")

echo "Your App Verification Key: $app_vk"
# Example output: 8e877d70518a5b28f5221e70bd7ff7692a603f3a26d7076a5253e21c304a354f
```

**IMPORTANT:** Save this `app_vk` - you'll need it for all transactions!

## Step 4: Create App ID from Genesis UTXO

```bash
# Get a UTXO from your wallet (you'll spend this to create the app)
bitcoin-cli -testnet4 listunspent

# Pick one UTXO and set it
export in_utxo_0="<txid>:<vout>"
# Example: export in_utxo_0="d8fa4cdade7ac3dff64047dc73b58591ebe638579881b200d4fea68fc84521f0:0"

# Generate app_id from this UTXO (deterministic)
export app_id=$(echo -n "${in_utxo_0}" | sha256sum | cut -d' ' -f1)

echo "Your App ID: $app_id"
```

**IMPORTANT:** The `app_id` is permanent for your app. All future transactions will reference this ID.

## Step 5: Deploy Season and Liquidity Pool

### 5.1 Deploy Season NFT

```bash
# Set your Bitcoin address
export addr_0="<your_testnet4_address>"
export house_address="<protocol_house_address>"

# Prepare season creation spell
export season_id="season_2024_25"
export current_turn=0
export team_scores_array="[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]"  # 20 teams
export total_bets_collected=0
export season_pool=0
export is_finished=false
export winner_team_id=null
export timestamp=$(date +%s)

# Substitute variables and check spell
cat ./spells/01-create-season.yaml | envsubst | charms spell check \
  --prev-txs=${prev_txs} \
  --app-bins=${app_bin}

# If check passes, broadcast transaction
cat ./spells/01-create-season.yaml | envsubst | charms spell build | \
  bitcoin-cli -testnet4 sendrawtransaction
```

### 5.2 Deploy Liquidity Pool

```bash
export pool_id="season_2024_25"
export total_liquidity=5000000  # 5M LEAGUE tokens
export total_bets_in_play=0
export total_paid_out=0
export total_collected=0
export protocol_revenue=0
export house_balance=5000000
export is_active=true
export min_liquidity=100000
export total_shares=5000000  # V2: Initial 1:1 ratio

# Check and broadcast liquidity pool
cat ./spells/10-create-liquidity-pool.yaml | envsubst | charms spell check \
  --prev-txs=${prev_txs} \
  --app-bins=${app_bin}

cat ./spells/10-create-liquidity-pool.yaml | envsubst | charms spell build | \
  bitcoin-cli -testnet4 sendrawtransaction
```

## Step 6: Deploy Match NFTs (Turn 1)

```bash
export season_id="season_2024_25"
export turn=1

# Create 10 matches for Turn 1
for i in {0..9}; do
  export match_id=$i
  export home_team="Team_$((i*2))"
  export away_team="Team_$((i*2+1))"

  # Seed values for odds (adjust for each match)
  export home_seed=$((1200 + RANDOM % 300))
  export away_seed=$((800 + RANDOM % 300))
  export draw_seed=$((600 + RANDOM % 200))

  # Calculate locked odds (V2 feature)
  # Odds will be compressed to 1.25x-1.95x range by smart contract
  export home_odds=$((home_seed * 10000 / (home_seed + away_seed + draw_seed)))
  export away_odds=$((away_seed * 10000 / (home_seed + away_seed + draw_seed)))
  export draw_odds=$((draw_seed * 10000 / (home_seed + away_seed + draw_seed)))

  export result="Pending"
  export random_seed=""
  export total_home_bets=0
  export total_away_bets=0
  export total_draw_bets=0

  # Create match
  cat ./spells/02-create-matches.yaml | envsubst | charms spell build | \
    bitcoin-cli -testnet4 sendrawtransaction

  echo "Match $i created"
done
```

## Step 7: Update Frontend Configuration

Update your `.env.local` in the `frontend/` directory:

```env
# App Configuration (from deployment)
NEXT_PUBLIC_APP_ID=<your_app_id_from_step4>
NEXT_PUBLIC_APP_VK=<your_app_vk_from_step3>

# Bitcoin Network
NEXT_PUBLIC_NETWORK=testnet4
NEXT_PUBLIC_MEMPOOL_API=https://mempool.space/testnet4/api

# Season Configuration
NEXT_PUBLIC_SEASON_ID=season_2024_25
NEXT_PUBLIC_CURRENT_TURN=1

# House Address
NEXT_PUBLIC_HOUSE_ADDRESS=<your_house_address>
```

## Step 8: Test User Flows

### 8.1 Place a Parlay Bet

```bash
# User variables
export bettor_address="<user_testnet4_address>"
export bettor_token_utxo="<user_utxo_with_tokens>"
export total_stake=1000  # 1000 LEAGUE tokens

# Betslip variables
export slip_id=$(uuidgen)
export timestamp=$(date +%s)

# Match selections (3-leg parlay)
export match_id_1="season_2024_25_1_0"
export prediction_1="HomeWin"
export odds_1=14500  # 1.45x (locked)

export match_id_2="season_2024_25_1_1"
export prediction_2="AwayWin"
export odds_2=19500  # 1.95x (locked)

export match_id_3="season_2024_25_1_2"
export prediction_3="Draw"
export odds_3=18000  # 1.80x (locked)

# V2: Calculate parlay multiplier (3 bets = 1.10x)
export locked_multiplier=11000

# V2: Calculate odds-weighted allocations
# allocation_i = (target_payout / num_bets) / odds_i * 10000
export allocation_1=334
export allocation_2=248
export allocation_3=269

# Calculate potential payout
# combined_odds = (1.45 * 1.95 * 1.80) = 5.0895
# with multiplier = 5.0895 * 1.10 = 5.59845
# payout = 1000 * 5.59845 = 5598 LEAGUE (after house edge)
export potential_payout=5598

export badges_array="[]"

# Liquidity pool current state
export pool_utxo="<current_pool_utxo>"
export current_total_liquidity=5000000
export current_bets_in_play=0
export current_paid_out=0
export current_collected=0
export current_protocol_revenue=0
export current_house_balance=5000000
export current_total_shares=5000000
export min_liquidity=100000
export new_bets_in_play=1000
export new_collected=1000

# Check and broadcast parlay betslip
cat ./spells/12-create-betslip-parlay.yaml | envsubst | charms spell check \
  --prev-txs=${prev_txs} \
  --app-bins=${app_bin}

cat ./spells/12-create-betslip-parlay.yaml | envsubst | charms spell build | \
  bitcoin-cli -testnet4 sendrawtransaction
```

### 8.2 LP Deposit

```bash
export lp_address="<lp_testnet4_address>"
export lp_token_utxo="<lp_utxo_with_tokens>"
export deposit_amount=100000  # 100k LEAGUE tokens
export share_id=$(uuidgen)

# Calculate shares to mint (AMM formula)
# shares = (deposit * total_shares) / total_liquidity
export shares_to_mint=$((deposit_amount * current_total_shares / current_total_liquidity))

export new_total_liquidity=$((current_total_liquidity + deposit_amount))
export new_house_balance=$((current_house_balance + deposit_amount))
export new_total_shares=$((current_total_shares + shares_to_mint))

# Check and broadcast LP deposit
cat ./spells/17-lp-deposit.yaml | envsubst | charms spell check \
  --prev-txs=${prev_txs} \
  --app-bins=${app_bin}

cat ./spells/17-lp-deposit.yaml | envsubst | charms spell build | \
  bitcoin-cli -testnet4 sendrawtransaction
```

## Step 9: Set Up Indexer API

Create a simple indexer API in `frontend/app/api/` to query Charms transactions:

### `frontend/app/api/matches/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const season = searchParams.get('season');
  const turn = searchParams.get('turn');

  // Query your indexer or mempool for match NFT transactions
  // Filter by app_id and tag 10 (MATCH_NFT)

  const matches = []; // Your indexed match transactions

  return NextResponse.json(matches);
}
```

### `frontend/app/api/lp-shares/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  const pool = searchParams.get('pool');

  // Query for LP_SHARE_NFT (tag 17) transactions to this address

  const shares = []; // Your indexed LP share transactions

  return NextResponse.json(shares);
}
```

## Step 10: Deploy Frontend

```bash
cd frontend

# Install dependencies
npm install

# Build for production
npm run build

# Run production server
npm start

# Or deploy to Vercel/Netlify
vercel --prod
```

## Testing Checklist

- [ ] Season NFT created on testnet
- [ ] Liquidity pool funded with tokens
- [ ] 10 matches created for Turn 1 with locked odds
- [ ] Test single bet placement
- [ ] Test parlay bet placement (3+ legs)
- [ ] Test system bet placement
- [ ] LP deposit and share minting
- [ ] LP withdrawal with fee deduction
- [ ] Match resolution and bet settlement
- [ ] Frontend connects to real chain data

## Troubleshooting

### Issue: "App contract not satisfied"

**Solution:** Ensure all input UTXOs and charm data match exactly. Check:
- Correct `app_id` and `app_vk`
- Valid input UTXO references
- Matching charm tags (10 for matches, 15 for betslips, etc.)

### Issue: "Insufficient funds"

**Solution:**
- Get testnet4 BTC from a faucet
- Ensure LEAGUE token UTXOs exist for users

### Issue: "Invalid charm structure"

**Solution:** Verify spell YAML syntax and all required fields in BetslipData, MatchData, etc.

## Production Deployment (Mainnet)

⚠️ **DO NOT deploy to mainnet without thorough testing!**

1. Audit smart contract thoroughly
2. Test extensively on testnet for at least 2 full seasons (76 turns)
3. Implement emergency pause mechanism
4. Set up monitoring and alerting
5. Conduct security review of LP withdrawal logic
6. Test with real Bitcoin (small amounts first)

## Support

- **Charms Documentation:** https://docs.charms.dev
- **BitcoinOS Discord:** https://discord.gg/bitcoinos
- **Repository Issues:** https://github.com/<your-repo>/issues

---

**Last Updated:** 2026-01-22
**Version:** V2 (with locked odds, LP shares, allocations)
**Contract Size:** 295KB WASM
**Test Coverage:** 23/23 tests passing
