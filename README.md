# ⚽ Premier League Virtual Betting Game

A decentralized Premier League virtual betting game built on [BitcoinOS Charms](https://charms.dev) with provably fair randomness and NFT collectibles.

## 🎮 Game Overview

Experience fast-paced virtual Premier League betting with matches every 15 minutes! Bet on your favorite teams, collect NFT badges for bonuses, and compete for season prizes.

### Key Features

- **⚡ 10 Matches Every 15 Minutes** - Non-stop action with all 20 Premier League teams
- **🏆 Season Competition** - 36 turns per season (9 hours total)
- **💰 $LEAGUE Token** - Platform token for betting (30% airdrop to early users)
- **🎖️ NFT Team Badges** - Collect all 20 teams for betting bonuses
- **🎲 Provably Fair** - Randomness from Bitcoin transaction hashes
- **📊 Season Leaderboard** - Free predictions on season winner (2% pool distribution)

## 📋 Game Mechanics

### Match System
- **10 matches per turn** featuring random team pairings
- **New turn every 15 minutes** (automatic match resolution)
- **36 turns = 1 complete season**
- Each match has dynamic odds for Home Win / Draw / Away Win

### Betting
- **Match Bets**: Bet $LEAGUE tokens on individual match outcomes
- **House Edge**: 3-5% (industry standard)
- **Badge Bonuses**: Holding a team's NFT badge gives +5% better odds for that team
- **Instant Payouts**: Win and get paid immediately after match resolution

### Season Competition
- **Free Entry**: Predict which team will have the most points after 36 turns
- **Prize Pool**: 2% of all season bets distributed to winners
- **Team Scoring**: Win = 3 points, Draw = 1 point, Loss = 0 points

### NFT Team Badges
- **20 Unique Badges**: One for each Premier League team
- **Betting Bonuses**: +5% improved odds when betting on your badge's team
- **Tradeable**: Marketplace with 2.5% fee
- **Collectible**: Build your collection and dominate betting!

## 🏗️ Architecture

### Charm Types

| Tag | Type | Description |
|-----|------|-------------|
| `TOKEN` | LEAGUE Token | Platform fungible token for betting |
| `10` | Match NFT | Individual match data with teams, odds, results |
| `11` | Bet NFT | User bet records with predictions |
| `12` | Badge NFT | Team badge collectibles (20 total) |
| `13` | Season NFT | Season state with team scores and pool |
| `14` | House NFT | Administrative control NFT |

### Teams (All 20 Premier League Teams)

```
Arsenal, Aston Villa, Bournemouth, Brentford, Brighton,
Chelsea, Crystal Palace, Everton, Fulham, Ipswich Town,
Leicester City, Liverpool, Manchester City, Manchester United,
Newcastle, Nottingham Forest, Southampton, Tottenham, West Ham, Wolves
```

## 🚀 Getting Started

### Prerequisites

Install Rust with WASM support:
```bash
rustup target add wasm32-wasip1
```

Install the Charms CLI:
```bash
# Follow instructions at https://docs.charms.dev/guides/charms-apps/get-started/
```

### Build

```bash
# Update dependencies
cargo update

# Build the WASM binary
app_bin=$(charms app build)
```

The binary will be at: `./target/wasm32-wasip1/release/premier-league-betting.wasm`

### Get Verification Key

```bash
export app_vk=$(charms app vk $app_bin)
echo "App VK: $app_vk"
```

## 📖 Usage Examples

### 1. Create a New Season

```bash
export season_id=$(uuidgen)
export in_utxo_0="YOUR_UTXO"
export house_address="YOUR_ADDRESS"

cat ./spells/01-create-season.yaml | envsubst | charms spell check --app-bins=${app_bin}
```

### 2. Create Matches (Turn 1)

```bash
export turn_number=1
export match_address="YOUR_ADDRESS"

cat ./spells/02-create-matches.yaml | envsubst | charms spell check --app-bins=${app_bin}
```

### 3. Place a Bet

```bash
export bettor_utxo="YOUR_UTXO_WITH_LEAGUE_TOKENS"
export bettor_address="YOUR_ADDRESS"
export bet_amount=1000
export match_id="MATCH_IDENTITY"
export prediction="HomeWin"  # or "AwayWin" or "Draw"
export odds_at_bet_time=18000  # 1.8x in basis points
export has_team_badge=false

cat ./spells/03-place-bet.yaml | envsubst | charms spell check --app-bins=${app_bin}
```

### 4. Resolve a Match

After 15 minutes, matches are resolved using transaction hash randomness:

```bash
export match_utxo="PENDING_MATCH_UTXO"
export tx_hash="TRANSACTION_HASH_FOR_RANDOMNESS"

cat ./spells/04-resolve-match.yaml | envsubst | charms spell check --app-bins=${app_bin}
```

### 5. Mint Team Badge

```bash
export team_name="Arsenal"
export team_id=0
export recipient_address="YOUR_ADDRESS"

cat ./spells/06-mint-team-badge.yaml | envsubst | charms spell check --app-bins=${app_bin}
```

### 6. Predict Season Winner (Free!)

```bash
export predicted_team_id=0  # 0 = Arsenal, 1 = Aston Villa, etc.
export predictor_address="YOUR_ADDRESS"

cat ./spells/08-predict-season-winner.yaml | envsubst | charms spell check --app-bins=${app_bin}
```

## 🎲 Randomness & Fairness

### How Randomness Works

1. **Transaction Hash**: Each match resolution uses the Bitcoin transaction hash as a seed
2. **Deterministic**: Given the same seed, results are reproducible (provably fair)
3. **Unpredictable**: Transaction hashes cannot be predicted before submission
4. **Per-Match**: Each match gets unique randomness from hash + match_id

### Match Result Distribution

```rust
// Simplified odds (can be adjusted based on team strength)
45% - Home Win
30% - Draw
25% - Away Win
```

### Payout Calculation

```rust
final_odds = base_odds
if has_badge:
    final_odds += base_odds * 5%  // Badge bonus
final_odds -= final_odds * 4%     // House edge
payout = stake * final_odds
```

## 💎 Tokenomics

### $LEAGUE Token Distribution

- **30% Airdrop** - Early users and community
- **20% Liquidity** - DEX pools and trading
- **30% House Reserve** - Prize pools and operations
- **20% Team** - Development and maintenance

### Revenue Streams

1. **House Edge**: 3-5% on all bets
2. **Marketplace Fees**: 2.5% on badge trades
3. **Season Pool**: 2% of bets fund season winner prizes

## 🧪 Testing

Run the test suite:

```bash
cargo test
```

Key tests:
- ✅ All 20 teams loaded correctly
- ✅ Match result generation from randomness
- ✅ Payout calculations with house edge and bonuses
- ✅ Season constants (36 turns, 10 matches/turn)

## 📊 Game Statistics

- **Total Matches per Season**: 360 (36 turns × 10 matches)
- **Season Duration**: 9 hours (36 turns × 15 minutes)
- **Matches per Day**: ~53 matches (24 hours ÷ 15 min × 10)
- **Seasons per Day**: ~2.67 seasons

## 🛠️ Smart Contract Logic

### Match Lifecycle

1. **Created** - 10 matches minted with Pending result
2. **Betting Open** - Users place bets for 15 minutes
3. **Resolved** - Transaction hash determines winner
4. **Settled** - Payouts distributed to winners

### Season Lifecycle

1. **Start** - Season NFT created with all teams at 0 points
2. **Turns 1-36** - Matches played, scores updated (Win=3, Draw=1)
3. **End** - Season finalized, top team determined
4. **Distribution** - 2% pool split among correct predictors

## 📜 Spell Files

| Spell | Description |
|-------|-------------|
| `01-create-season.yaml` | Start a new season |
| `02-create-matches.yaml` | Create 10 matches for a turn |
| `03-place-bet.yaml` | Bet on a match outcome |
| `04-resolve-match.yaml` | Resolve match with randomness |
| `05-settle-bet.yaml` | Pay out winning bets |
| `06-mint-team-badge.yaml` | Mint NFT team badge |
| `07-trade-badge.yaml` | Trade badge on marketplace |
| `08-predict-season-winner.yaml` | Free season prediction |
| `09-mint-league-tokens.yaml` | Mint $LEAGUE tokens (house) |

## 🔐 Security Features

- **Provably Fair Randomness**: Uses Bitcoin transaction hashes
- **Immutable Odds**: Odds locked at bet placement
- **Transparent Contracts**: All logic open source and verifiable
- **NFT Ownership Verification**: Badge bonuses verified on-chain

## 🚧 Development Roadmap

- [x] Core betting mechanics with randomness
- [x] NFT team badges with bonuses
- [x] Season competition system
- [ ] Frontend web app
- [ ] Automated match resolution bot
- [ ] Advanced statistics and analytics
- [ ] Social features (leaderboards, achievements)
- [ ] Mobile app

## 📄 License

MIT License - See [LICENSE](LICENSE) file

## 🔗 Resources

- **Charms Documentation**: https://docs.charms.dev
- **BitcoinOS**: https://bitcoinos.build
- **Charms GitHub**: https://github.com/CharmsDev/charms

## 🤝 Contributing

Contributions welcome! This is a demo/template - feel free to fork and customize:

- Add more betting markets (correct score, over/under goals)
- Implement team strength ratings for dynamic odds
- Create automated match scheduler
- Build frontend interface
- Add more game modes

---

**Built with ❤️ on BitcoinOS Charms**

*Note: This is a demonstration project. Always bet responsibly and comply with local regulations.*
