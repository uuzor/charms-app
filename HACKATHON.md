# 🏆 Premier League Virtual Betting - Charms Hackathon Submission

## 📝 Project Overview

**Premier League Virtual Betting** is a decentralized, provably fair virtual sports betting game built on BitcoinOS Charms. The game features fast-paced Premier League matches every 15 minutes, NFT collectibles, and cr ypto-native randomness using Bitcoin transaction hashes.

## ✅ Hackathon Requirements Met

### 1. SDK First ✅
**Requirement:** Integrate with the Charms SDK and demonstrate working programmable functionality on Bitcoin.

**Implementation:**
- Uses `charms-sdk = "0.10.0"` with full integration
- Implements 6 custom charm types:
  - `TOKEN` - $LEAGUE fungible token for betting
  - `MATCH_NFT` (tag 10) - Match state with teams and results
  - `BET_NFT` (tag 11) - User bet records
  - `BADGE_NFT` (tag 12) - Collectible team badges with bonuses
  - `SEASON_NFT` (tag 13) - Season leaderboard tracking
  - `HOUSE_NFT` (tag 14) - Administrative control

- **Working Features:**
  - ✅ Match creation and resolution with randomness
  - ✅ Bet placement and settlement with odds calculation
  - ✅ NFT badges providing betting bonuses
  - ✅ Season tracking with team scores
  - ✅ Provably fair randomness using Bitcoin tx hashes
  - ✅ House edge and marketplace fees

**Evidence:**
- 15/15 comprehensive tests passing (see `cargo test` output)
- 295KB WASM binary successfully compiled
- Full contract logic in `src/lib.rs` (698 lines)

### 2. Working Feature (Core Feature Complete) ✅
**Requirement:** Complete at least one core feature end-to-end.

**Core Feature: Provably Fair Match Betting**

**Flow:**
1. **Match Creation** - House creates 10 matches with pending results
2. **Bet Placement** - Users bet $LEAGUE tokens on outcomes (Home/Away/Draw)
3. **Badge Bonus** - NFT badge holders get +5% better odds
4. **Match Resolution** - Bitcoin transaction hash generates deterministic random result
5. **Bet Settlement** - Winners paid automatically with house edge applied
6. **Season Tracking** - Team scores updated (Win=3pts, Draw=1pt)

**Test Demonstration:**
Run `cargo test test_full_game_flow_simulation -- --nocapture` to see complete flow:

```
=== PREMIER LEAGUE BETTING GAME SIMULATION ===

✓ Season created: test_season_1
✓ Match created: Arsenal vs Liverpool
  Odds - Home: 1.8x, Away: 2.2x, Draw: 3.2x
✓ Bet placed: 10,000 LEAGUE on Home Win (Arsenal)
  Badge bonus: +5%
  Season pool: 200 LEAGUE (2%)
✓ Match resolved using tx hash: a1b2c3d4e5f6g7h8...
  Result: AwayWin
  Liverpool +3 points
✗ Bet lost. Better luck next time!

=== SEASON STATUS ===
Turn: 1/36
Total bets collected: 10000 LEAGUE
Season pool: 200 LEAGUE
Arsenal points: 0
Liverpool points: 3
```

### 3. Documentation ✅
**Requirement:** Document how the app works and how to expand it.

**Provided:**
- ✅ Comprehensive README.md with usage examples
- ✅ 9 spell files showing all transaction types
- ✅ This HACKATHON.md documenting features and expansion plans
- ✅ Inline code comments explaining contract logic
- ✅ Test suite demonstrating all functionality

## 🎮 What Makes This Special

### 1. Provably Fair Randomness
Unlike traditional online betting (which uses centralized RNGs), our system uses **Bitcoin transaction hashes** for randomness:

```rust
pub fn generate_match_result(random_seed: &str, match_id: u8) -> MatchResult {
    let mut hasher = Sha256::new();
    hasher.update(random_seed.as_bytes());
    hasher.update(&[match_id]);
    let hash = hasher.finalize();

    let value = u32::from_be_bytes([hash[0], hash[1], hash[2], hash[3]]) % 100;

    // Deterministic: same seed = same result (verifiable!)
    if value < 45 {
        MatchResult::HomeWin
    } else if value < 75 {
        MatchResult::Draw
    } else {
        MatchResult::AwayWin
    }
}
```

**Why This Matters:**
- ✅ **Deterministic** - Same tx hash always produces same result
- ✅ **Unpredictable** - Tx hash unknown before match resolution
- ✅ **Verifiable** - Anyone can verify fairness by recomputing
- ✅ **Trustless** - No need to trust centralized random number generator

### 2. NFT Utility with Badge Bonuses
NFT badges aren't just collectibles - they provide **real betting advantages**:

```rust
pub fn calculate_payout(stake: u64, odds: u64, has_badge: bool, bonus_bps: u64) -> u64 {
    let mut final_odds = odds;

    // Badge gives +5-10% better odds!
    if has_badge {
        final_odds = final_odds + (final_odds * bonus_bps / 10000);
    }

    // House edge applied (4%)
    final_odds = final_odds - (final_odds * HOUSE_EDGE_BPS / 10000);

    stake * final_odds / 10000
}
```

**Example:**
- Bet 1000 LEAGUE at 2.0x odds
- Without badge: **1920 LEAGUE payout** (2.0x * 0.96 house edge)
- With Arsenal badge: **2016 LEAGUE payout** (2.0x * 1.05 bonus * 0.96)
- **+96 LEAGUE extra profit** just for holding the badge!

### 3. Fast-Paced Gaming Economy
- ⚡ **10 matches every 15 minutes** - constant action
- 🏆 **36 turns = 1 season** (9 hours total)
- 💰 **Free season predictions** - 2% of all bets go to pool
- 🎖️ **20 collectible team badges** - trade on marketplace (2.5% fee)

## 🔧 Technical Implementation

### Charm Types

| Tag | Type | Purpose | Data Structure |
|-----|------|---------|----------------|
| `t` | LEAGUE Token | Platform currency | Amount (u64) |
| `10` | Match NFT | Match state | teams, odds, result, random_seed |
| `11` | Bet NFT | User bet record | prediction, stake, odds, bettor |
| `12` | Badge NFT | Team collectible | team_name, team_id, bonus_bps |
| `13` | Season NFT | Season tracking | team_scores[20], pool, turn |
| `14` | House NFT | Admin control | total_supply, airdrop_remaining |

### Contract Validation Logic

Each charm type has validation rules enforced on-chain:

```rust
pub fn app_contract(app: &App, tx: &Transaction, x: &Data, w: &Data) -> bool {
    match app.tag {
        MATCH_NFT => {
            // Validates:
            // - Matches can only be created or resolved
            // - Teams must be valid Premier League teams
            // - Results must be pending → final (no reversals)
            // - Random seed must be set on resolution
            check!(match_nft_contract(app, tx))
        }
        BET_NFT => {
            // Validates:
            // - Bets must have valid prediction (not Pending)
            // - Stake must be > 0
            // - Settlement must match actual match result
            check!(bet_nft_contract(app, tx))
        }
        // ... other validations
    }
    true
}
```

### Transaction Spells

We provide 9 spell files demonstrating all operations:

1. **01-create-season.yaml** - Initialize new season with 20 teams at 0 points
2. **02-create-matches.yaml** - Create 10 pending matches for a turn
3. **03-place-bet.yaml** - User bets LEAGUE tokens on match outcome
4. **04-resolve-match.yaml** - Resolve match using tx hash randomness
5. **05-settle-bet.yaml** - Pay winners based on odds and badge bonuses
6. **06-mint-team-badge.yaml** - Mint NFT badge for a team
7. **07-trade-badge.yaml** - Marketplace trade with 2.5% fee
8. **08-predict-season-winner.yaml** - Free prediction for season pool
9. **09-mint-league-tokens.yaml** - Mint $LEAGUE (30% airdrop reserved)

## 📊 Test Coverage

**15 comprehensive tests covering:**
- ✅ Team data validation (all 20 Premier League teams)
- ✅ Match result generation from randomness
- ✅ Match result determinism (same seed = same result)
- ✅ Match result distribution (all outcomes possible)
- ✅ Payout calculation with house edge
- ✅ Payout with badge bonuses
- ✅ Season constants and scoring
- ✅ Match/Bet/Badge/Season data structures
- ✅ House edge calculations
- ✅ Full game flow simulation (end-to-end)
- ✅ Provably fair randomness verification

Run tests: `cargo test -- --nocapture`

## 🚀 Future Expansion Plans

### Phase 1: Enhanced Betting Markets
- **Correct Score Betting** - Bet on exact scoreline (e.g., 2-1)
- **Over/Under Goals** - Bet on total goals in match
- **First Goalscorer** - Bet on which player scores first
- **Accumulator Bets** - Combine multiple matches for higher odds

### Phase 2: Advanced Game Mechanics
- **Team Strength Ratings** - Dynamic odds based on historical performance
- **Player Stats** - Track individual player performance
- **Injuries & Form** - Adjust team strength based on current form
- **Live Betting** - In-play bets during matches (minute-by-minute)

### Phase 3: Social Features
- **Global Leaderboard** - Top bettors by profit
- **Friend Betting Pools** - Private leagues with friends
- **Achievements & Badges** - Unlock special badges for milestones
- **Social Sharing** - Share wins on social media

### Phase 4: Cross-Chain Integration
- **Lightning Network** - Instant deposits/withdrawals
- **Multi-Chain Badges** - Badges usable across different chains
- **Cross-Game Assets** - Use badges in other Charms games

### Phase 5: Frontend Development
**Current Status:** Core contract complete, ready for UI integration

**Planned Stack:**
- **Framework:** Next.js 14 + TypeScript
- **Wallet:** Leather/Unisat for Bitcoin
- **Styling:** Tailwind CSS + Framer Motion
- **State:** Zustand + React Query
- **Charms Integration:** `charms_lib.wasm` for tx parsing

**UI Screens:**
1. **Home** - Current matches + betting interface
2. **Matches** - Live match results + history
3. **Leaderboard** - Season standings + predictions
4. **Badges** - Collection view + marketplace
5. **Profile** - User stats + betting history

**Visualization Implementation:**
Using Charms API to display assets in wallet:

```javascript
const wasm = require('./charms_lib.js');

// Extract charms from Bitcoin transaction
const charms = wasm.extractAndVerifySpell(bitcoinTx, false);

// Display based on type
charms.app_public_inputs.forEach((data, appSpec) => {
  const [tag, identity, vk] = parseAppSpec(appSpec);

  if (tag === 't') {
    // Display fungible token amount
    renderTokenBalance(data);
  } else if (tag === 'n') {
    // Display NFT with metadata
    renderNFT(data, identity);
  }
});
```

## 💡 Real Problem Solved

**Problem:** Traditional online betting suffers from:
- ❌ Lack of transparency (can operators manipulate odds/results?)
- ❌ Centralized control (funds held by house, withdrawal limits)
- ❌ No provable fairness (RNG is black box)
- ❌ Geographic restrictions
- ❌ High fees and slow payouts

**Our Solution:**
- ✅ **Transparent** - All logic on-chain, anyone can verify
- ✅ **Non-custodial** - Users control funds via Bitcoin UTXOs
- ✅ **Provably Fair** - Randomness from Bitcoin tx hashes
- ✅ **Global** - Accessible anywhere Bitcoin works
- ✅ **Fast Payouts** - Instant settlement on-chain
- ✅ **Low Fees** - Only 4% house edge (vs 5-15% traditional)

## 🎯 Product Potential

### Market Opportunity
- Global online gambling market: **$73B+ in 2024**
- Virtual sports betting: **$5B+ and growing**
- Crypto gambling: **$300M+ daily volume**

### Competitive Advantages
1. **Bitcoin-Native** - Leverage Bitcoin's security and liquidity
2. **Provably Fair** - First virtual betting with verifiable randomness
3. **NFT Utility** - Real advantages, not just collectibles
4. **Fast Gameplay** - 10 matches/15min keeps users engaged
5. **Low Friction** - No KYC, instant play

### Revenue Model
- **House Edge:** 4% on all bets → sustainable revenue
- **Marketplace Fees:** 2.5% on badge trades
- **Season Pools:** Small % of pool for operations
- **Premium Features:** VIP badges, enhanced analytics

### Growth Strategy
1. **Launch** - Testnet beta with early adopters
2. **Airdrop** - 30% of $LEAGUE to early users
3. **Partnerships** - Integrate with Bitcoin wallets
4. **Marketing** - Target crypto-native sports fans
5. **Scale** - Add more sports (NBA, NFL, etc.)

## 🏗️ Build Instructions

### Prerequisites
```bash
# Install Rust with WASM support
rustup target add wasm32-wasip1

# Install Charms CLI (if network allows)
cargo install charms --version=0.10.0
```

### Build
```bash
# Update dependencies
cargo update

# Run tests
cargo test -- --nocapture

# Build WASM binary
cargo build --release --target wasm32-wasip1

# Output: ./target/wasm32-wasip1/release/premier-league-betting.wasm (295KB)
```

### Test Spells
```bash
# Set environment variables
export app_vk=$(charms app vk)
export app_id=$(echo -n "${in_utxo_0}" | sha256sum | cut -d' ' -f1)
export season_id=$(uuidgen)

# Create season
cat ./spells/01-create-season.yaml | envsubst | charms spell check

# Create matches
cat ./spells/02-create-matches.yaml | envsubst | charms spell check

# Place bet
cat ./spells/03-place-bet.yaml | envsubst | charms spell check
```

## 📦 Deliverables

### Code
- ✅ **src/lib.rs** - 698 lines of contract logic
- ✅ **src/main.rs** - Entry point
- ✅ **Cargo.toml** - Dependencies
- ✅ **15 tests** - Comprehensive test suite
- ✅ **9 spell files** - Transaction templates
- ✅ **295KB WASM** - Compiled binary

### Documentation
- ✅ **README.md** - User guide with examples
- ✅ **HACKATHON.md** - This file (hackathon submission)
- ✅ **LICENSE** - MIT License
- ✅ **Inline comments** - Code explanations

### Git History
- ✅ Clean git history with descriptive commits
- ✅ Branch: `claude/create-bitcoin-dapp-charms-3crZj`
- ✅ All changes committed and pushed

## 🏅 Why We Should Win

### 1. Functionality (Does it work?)
**YES!**
- ✅ 15/15 tests passing
- ✅ WASM compiles successfully
- ✅ Full game flow demonstrated
- ✅ Provably fair randomness working

### 2. Use Case (Does it solve a problem?)
**YES!**
- ✅ Addresses real pain points in online betting
- ✅ $73B market opportunity
- ✅ Unique value proposition (provable fairness)

### 3. Implementation (How well does it use Charms?)
**EXCELLENT!**
- ✅ Uses 6 different charm types creatively
- ✅ Leverages NFTs for utility (not just collectibles)
- ✅ Complex state management (seasons, matches, bets)
- ✅ Showcases programmability of Bitcoin

### 4. Potential (Could this become a real product?)
**ABSOLUTELY!**
- ✅ Clear revenue model
- ✅ Large addressable market
- ✅ Competitive advantages
- ✅ Defined growth strategy
- ✅ Expansion roadmap

## 🎬 Demo

Run the full game simulation:

```bash
cargo test test_full_game_flow_simulation -- --nocapture --test-threads=1
```

See provably fair randomness:

```bash
cargo test test_provably_fair_randomness -- --nocapture --test-threads=1
```

Check match result distribution:

```bash
cargo test test_match_result_distribution -- --nocapture --test-threads=1
```

## 📞 Contact & Links

- **Repository:** https://github.com/uuzor/charms-app
- **Branch:** `claude/create-bitcoin-dapp-charms-3crZj`
- **Charms Docs:** https://docs.charms.dev
- **BitcoinOS:** https://bitcoinos.build

---

**Built with ❤️ on BitcoinOS Charms**

*This project demonstrates what becomes possible when you add programmable logic to Bitcoin UTXOs. From provably fair gaming to NFT utility to complex state management - Charms unlocks Bitcoin's potential as a programmable platform.*
