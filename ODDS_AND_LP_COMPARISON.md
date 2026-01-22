# Technical Comparison: Odds Mechanism, Profit Calculation & LP Features

## Focus Areas
1. **Odds Mechanism** - When and how odds are calculated
2. **Profit Calculation** - Post-match payout mathematics
3. **LP Features** - How liquidity providers earn/lose

---

# 1. ODDS MECHANISM

## Solidity Implementation: LOCKED ODDS MODEL

### Concept: Fixed Odds at Seeding Time

**Key Innovation:** Odds are locked BEFORE any user bets, providing guaranteed payout certainty.

### Step-by-Step Flow:

**Step 1: Round Seeding (Before Any Bets)**
```solidity
function seedRoundPools(uint256 roundId) external onlyOwner {
    // Protocol seeds each match with differentiated amounts
    for (uint256 matchIndex = 0; matchIndex < 10; matchIndex++) {
        // Calculate seed amounts based on team matchup
        (uint256 homeSeed, uint256 awaySeed, uint256 drawSeed) =
            _calculateMatchSeeds(roundId, matchIndex);

        // Example: Manchester City (strong) vs Southampton (weak)
        // homeSeed = 1500 LEAGUE (50%)  - City is favorite
        // awaySeed = 600 LEAGUE (20%)   - Southampton is underdog
        // drawSeed = 900 LEAGUE (30%)   - Draw middle odds
        // Total = 3000 LEAGUE

        pool.homeWinPool = homeSeed;
        pool.awayWinPool = awaySeed;
        pool.drawPool = drawSeed;
    }

    // CRITICAL: Immediately lock odds based on seed ratios
    _lockRoundOddsFromSeeds(roundId, accounting);
}
```

**Step 2: Odds Locking Formula**
```solidity
function _lockRoundOddsFromSeeds(uint256 roundId) internal {
    for (uint256 i = 0; i < 10; i++) {
        MatchPool storage pool = accounting.matchPools[i];
        LockedOdds storage odds = accounting.lockedMatchOdds[i];

        // Raw parimutuel odds from seed ratios
        uint256 rawHomeOdds = (totalPool * 1e18) / pool.homeWinPool;
        // rawHomeOdds = (3000 * 1e18) / 1500 = 2.0e18 (2.0x)

        // Compress to target range: 1.3x - 1.7x
        odds.homeOdds = _compressOdds(rawHomeOdds);
        // homeOdds = 1.3e18 (1.3x) after compression

        odds.awayOdds = _compressOdds(rawAwayOdds);
        // awayOdds = 1.7e18 (1.7x) - underdog gets better odds

        odds.drawOdds = _compressOdds(rawDrawOdds);
        // drawOdds = 1.5e18 (1.5x) - middle odds

        odds.locked = true; // PERMANENT - never changes
    }
}

function _compressOdds(uint256 rawOdds) internal pure returns (uint256) {
    // Target range: 1.3x - 1.7x (safe profitable range for LP)
    // Raw range: 1.8x - 5.5x (from seed allocations)

    if (rawOdds < 18e17) return 13e17; // Min 1.3x
    if (rawOdds > 55e17) return 17e17; // Max 1.7x

    // Linear compression formula:
    // compressed = 1.3 + (raw - 1.8) × 0.108
    uint256 excess = rawOdds - 18e17;
    uint256 scaledExcess = (excess * 108) / 1000;
    return 13e17 + scaledExcess;
}
```

**Step 3: User Places Bet (Odds Already Locked)**
```solidity
function placeBet(
    uint256[] calldata matchIndices,
    uint8[] calldata outcomes,
    uint256 amount
) external {
    // User sees FIXED odds that will never change

    // Example: User bets 1000 LEAGUE on parlay:
    // Match 0: Home Win (locked at 1.3x)
    // Match 1: Away Win (locked at 1.7x)
    // Match 2: Draw (locked at 1.5x)

    // Calculate EXACT payout using locked odds
    uint256 basePayout = 1000 LEAGUE;
    basePayout = (basePayout * 1.3e18) / 1e18; // 1300 LEAGUE
    basePayout = (basePayout * 1.7e18) / 1e18; // 2210 LEAGUE
    basePayout = (basePayout * 1.5e18) / 1e18; // 3315 LEAGUE

    // Apply parlay multiplier (e.g., 1.05x for 3 matches)
    uint256 finalPayout = (basePayout * 1.05e18) / 1e18; // 3480.75 LEAGUE

    // User knows EXACTLY what they'll win: 3480.75 LEAGUE
    // This payout is GUARANTEED if all predictions correct

    // Store locked multiplier in bet
    bet.lockedMultiplier = 1.05e18;
}
```

**Step 4: Later Bets Have NO EFFECT on Odds**
```solidity
// 100 users bet on Home Win after first user
// Pool grows: homeWinPool = 1500 → 101,500 LEAGUE
// BUT odds stay locked at 1.3x for EVERYONE
// No advantage to betting early or late

// This is the KEY DIFFERENCE from parimutuel:
// In traditional parimutuel, odds change as pool grows
// In locked odds, everyone gets same odds regardless of timing
```

### Advantages of Locked Odds:
```
✅ Payout certainty (users know exact winnings)
✅ No timing advantage (fair for all bettors)
✅ Simpler accounting (fixed payout calculation)
✅ No odds manipulation (can't move odds by betting)
✅ Better UX (show guaranteed payout in UI)
```

### Disadvantages:
```
❌ LP takes more risk (can't adjust odds based on market)
❌ Requires large seed amounts (3000 LEAGUE per match)
❌ Odds compression limits profitability (1.3x-1.7x range)
❌ Protocol must fund seeding upfront
```

---

## BitcoinOS Charms Implementation: DYNAMIC PARIMUTUEL ODDS

### Concept: Traditional Parimutuel (Odds Update with Each Bet)

**Key Characteristic:** Odds recalculate dynamically based on current pool state.

### Step-by-Step Flow:

**Step 1: Initial Match Creation**
```rust
pub fn create_match(
    &mut self,
    season_id: String,
    turn: u64,
    match_id: u64,
    home_team: String,
    away_team: String,
    home_odds: u64,    // Initial odds in basis points
    away_odds: u64,    // e.g., 15000 = 1.5x
    draw_odds: u64,
) {
    // Odds are just initial suggestions
    // They DON'T determine payouts

    let match_data = MatchData {
        season_id,
        turn,
        match_id,
        home_team,
        away_team,
        home_odds,      // Initial: 15000 (1.5x)
        away_odds,      // Initial: 20000 (2.0x)
        draw_odds,      // Initial: 25000 (2.5x)
        result: MatchResult::Pending,
        total_home_bets: 0,  // Pool starts at 0
        total_away_bets: 0,
        total_draw_bets: 0,
    };
}
```

**Step 2: First User Bets**
```rust
// User 1 bets 1000 tokens on Home Win
pub fn create_betslip(&mut self, betslip: BetslipData) {
    // Add bet to pool
    match_data.total_home_bets += 1000;

    // Odds recalculate dynamically:
    let total_pool = total_home_bets + total_away_bets + total_draw_bets;
    // total_pool = 1000 + 0 + 0 = 1000

    let losing_pool = total_away_bets + total_draw_bets;
    // losing_pool = 0 + 0 = 0

    // Current odds for Home Win:
    // odds = 1.0 + (losing_pool / home_bets)
    // odds = 1.0 + (0 / 1000) = 1.0x (terrible odds!)

    // User 1 effectively has 1.0x odds (no profit if win)
}
```

**Step 3: More Users Bet on Different Outcomes**
```rust
// User 2 bets 500 tokens on Away Win
match_data.total_away_bets += 500;

// User 3 bets 300 tokens on Draw
match_data.total_draw_bets += 300;

// Now total_pool = 1000 + 500 + 300 = 1800
// For User 1 (Home Win bettor):
// losing_pool = 500 + 300 = 800
// odds = 1.0 + (800 / 1000) = 1.8x

// User 1's effective odds improved from 1.0x to 1.8x!
// But they don't know this until settlement
```

**Step 4: Payout Calculation (After Match)**
```rust
pub fn settle_betslip(&mut self, slip_id: String) -> Result<u64> {
    let betslip = self.get_betslip(&slip_id)?;

    // Check if all predictions correct
    let all_correct = self.check_all_predictions_correct(&betslip)?;
    if !all_correct {
        return Ok(0); // Lost bet
    }

    // Calculate payout using FINAL pool state
    let mut total_payout = 0;

    for bet in &betslip.bets {
        let match_data = self.get_match(&bet.match_id)?;

        // Get final pool sizes
        let winning_pool = match bet.prediction {
            MatchResult::HomeWin => match_data.total_home_bets,
            MatchResult::AwayWin => match_data.total_away_bets,
            MatchResult::Draw => match_data.total_draw_bets,
            _ => return Err("Invalid prediction"),
        };

        let total_pool = match_data.total_home_bets +
                        match_data.total_away_bets +
                        match_data.total_draw_bets;

        let losing_pool = total_pool - winning_pool;

        // Parimutuel payout formula
        let bet_share = bet.stake / winning_pool;
        let base_payout = bet_share * losing_pool;

        // Apply house edge (4%)
        let house_edge = base_payout * HOUSE_EDGE_BPS / 10000;
        let final_payout = base_payout - house_edge;

        // Apply badge bonus if user owns team NFT
        if betslip.badges.contains(&team_id) {
            let bonus = final_payout * BADGE_BONUS_BPS / 10000;
            final_payout += bonus;
        }

        total_payout += final_payout;
    }

    return Ok(total_payout);
}
```

### Example Calculation:

**Scenario: Manchester City vs Liverpool**
```
Initial State (no bets):
- Home pool: 0
- Away pool: 0
- Draw pool: 0

After Betting Closes:
- Home pool: 10,000 tokens (100 users bet on City)
- Away pool: 5,000 tokens (50 users bet on Liverpool)
- Draw pool: 3,000 tokens (30 users bet on Draw)
- Total pool: 18,000 tokens

Match Result: Home Win (City wins)

Payout for Home Win bettors:
- Winning pool: 10,000 tokens
- Losing pool: 5,000 + 3,000 = 8,000 tokens
- Each token bet on Home returns: 8,000 / 10,000 = 0.8 tokens
- Total return per token: 1.0 (stake) + 0.8 (profit) = 1.8x
- After 4% house edge: 1.8x * 0.96 = 1.728x final odds

User who bet 1000 tokens on Home Win:
- Base return: 1000 * 1.728 = 1728 tokens
- If has City badge NFT: +5% = 1728 * 1.05 = 1814.4 tokens
- Profit: 814.4 tokens (81.44% gain)
```

### Advantages of Dynamic Parimutuel:
```
✅ Market-driven odds (true price discovery)
✅ LP risk is lower (pools naturally balance)
✅ No seed funding required (users provide liquidity)
✅ Badge NFT bonuses (gamification)
✅ Higher potential payouts (no compression)
```

### Disadvantages:
```
❌ Payout uncertainty (odds change until betting closes)
❌ Timing matters (early bettors have information disadvantage)
❌ Can't show guaranteed payout in UI
❌ Complex for users to understand
❌ Potential for arbitrage/manipulation
```

---

# 2. PROFIT CALCULATION AFTER MATCH

## Solidity Implementation: LOCKED ODDS SETTLEMENT

### Settlement Flow:

**Step 1: Match Results from Oracle**
```solidity
function settleRound(uint256 roundId) external onlyOwner {
    require(gameEngine.isRoundSettled(roundId), "Not settled in engine");

    RoundAccounting storage accounting = roundAccounting[roundId];

    // Loop through 10 matches
    for (uint256 matchIndex = 0; matchIndex < 10; matchIndex++) {
        IGameEngine.Match memory matchResult = gameEngine.getMatch(roundId, matchIndex);
        MatchPool storage pool = accounting.matchPools[matchIndex];

        // Example Match 0: Home Win result
        // pool.homeWinPool = 50,000 LEAGUE (winning pool)
        // pool.awayWinPool = 30,000 LEAGUE (losing)
        // pool.drawPool = 20,000 LEAGUE (losing)

        if (matchResult.outcome == IGameEngine.MatchOutcome.HOME_WIN) {
            accounting.totalWinningPool += pool.homeWinPool; // +50,000
            accounting.totalLosingPool += pool.awayWinPool + pool.drawPool; // +50,000
        }
        // ... similar for other outcomes
    }

    // Calculate EXACT total owed to winners
    accounting.totalReservedForWinners = _calculateTotalWinningPayouts(roundId);

    accounting.settled = true;
}
```

**Step 2: Calculate Total Payouts (Using Locked Odds)**
```solidity
function _calculateTotalWinningPayouts(uint256 roundId)
    internal view returns (uint256 totalOwed)
{
    RoundAccounting storage accounting = roundAccounting[roundId];

    for (uint256 matchIndex = 0; matchIndex < 10; matchIndex++) {
        MatchPool storage pool = accounting.matchPools[matchIndex];
        LockedOdds storage odds = accounting.lockedMatchOdds[matchIndex];

        // Get winning outcome and pool
        uint8 winningOutcome = getWinningOutcome(roundId, matchIndex);
        uint256 winningPool = getWinningPoolAmount(pool, winningOutcome);

        // Get locked odds for winning outcome
        uint256 lockedOdds;
        if (winningOutcome == 1) lockedOdds = odds.homeOdds;      // e.g., 1.3e18
        else if (winningOutcome == 2) lockedOdds = odds.awayOdds; // e.g., 1.7e18
        else lockedOdds = odds.drawOdds;                           // e.g., 1.5e18

        // Total owed = winning pool × locked odds
        // Example: 50,000 LEAGUE × 1.3 = 65,000 LEAGUE owed
        uint256 matchPayout = (winningPool * lockedOdds) / 1e18;
        totalOwed += matchPayout;
    }

    // totalOwed might be 350,000 LEAGUE for entire round
    // This is GUARANTEED payout amount
    return totalOwed;
}
```

**Step 3: Individual User Claims**
```solidity
function claimWinnings(uint256 betId) external nonReentrant {
    Bet storage bet = bets[betId];
    require(!bet.claimed, "Already claimed");

    // Calculate user's specific payout
    (bool won, uint256 basePayout, uint256 finalPayout) = _calculateBetPayout(betId);

    if (won && finalPayout > 0) {
        bet.claimed = true;

        // Pay from LP pool
        liquidityPoolV2.payWinner(msg.sender, finalPayout);

        accounting.totalClaimed += finalPayout;
        accounting.totalPaidOut += finalPayout;
    }
}

function _calculateBetPayout(uint256 betId)
    internal view returns (bool won, uint256 basePayout, uint256 finalPayout)
{
    Bet storage bet = bets[betId];

    // Example Parlay Bet:
    // Match 0: Home Win (1.3x locked odds) ✓ Correct
    // Match 1: Away Win (1.7x locked odds) ✓ Correct
    // Match 2: Draw (1.5x locked odds) ✓ Correct

    uint256 totalBasePayout = 0;

    for (uint256 i = 0; i < bet.predictions.length; i++) {
        Prediction memory pred = bet.predictions[i];

        // Get LOCKED odds (stored at seeding time)
        LockedOdds storage odds = accounting.lockedMatchOdds[pred.matchIndex];

        uint256 lockedOdds;
        if (pred.predictedOutcome == 1) lockedOdds = odds.homeOdds; // 1.3e18
        else if (pred.predictedOutcome == 2) lockedOdds = odds.awayOdds; // 1.7e18
        else lockedOdds = odds.drawOdds; // 1.5e18

        // Simple multiplication: amount × locked odds
        uint256 matchPayout = (pred.amountInPool * lockedOdds) / 1e18;
        // Match 0: 333 * 1.3 = 433 LEAGUE
        // Match 1: 333 * 1.7 = 566 LEAGUE
        // Match 2: 333 * 1.5 = 500 LEAGUE

        totalBasePayout += matchPayout;
    }
    // totalBasePayout = 433 + 566 + 500 = 1499 LEAGUE

    // Apply LOCKED parlay multiplier (stored at bet time)
    uint256 parlayMultiplier = bet.lockedMultiplier; // 1.05e18 (stored)
    uint256 finalPayout = (totalBasePayout * parlayMultiplier) / 1e18;
    // finalPayout = 1499 * 1.05 = 1573.95 LEAGUE

    // User bet 1000 LEAGUE, wins 1573.95 LEAGUE
    // Profit: 573.95 LEAGUE (57.4% gain)

    return (true, totalBasePayout, finalPayout);
}
```

### Profit Calculation Summary:

**User Perspective:**
```
Bet Amount: 1000 LEAGUE
- Protocol Fee (5%): 50 LEAGUE (paid upfront)
- Amount in Pools: 950 LEAGUE

If Win (all 3 predictions correct):
- Base Payout: 1499 LEAGUE (using locked odds)
- Parlay Bonus: 1499 * 1.05 = 1573.95 LEAGUE
- Net Profit: 1573.95 - 1000 = 573.95 LEAGUE (57.4% gain)

If Lose (any prediction wrong):
- Payout: 0 LEAGUE
- Loss: 1000 LEAGUE (100% loss)
```

**LP Perspective:**
```
Round Starting Balance: 500,000 LEAGUE

Revenue IN:
+ Seed recovered: 30,000 LEAGUE
+ Losing bets: 200,000 LEAGUE
= Total IN: 230,000 LEAGUE

Costs OUT:
- Winning payouts: 150,000 LEAGUE
= Total OUT: 150,000 LEAGUE

Net Profit: 230,000 - 150,000 = 80,000 LEAGUE
LP pool grows: 500,000 → 580,000 LEAGUE (+16% for round)
```

---

## BitcoinOS Charms Implementation: PARIMUTUEL SETTLEMENT

### Settlement Flow:

**Step 1: Match Resolution**
```rust
pub fn resolve_match(
    &mut self,
    match_id: String,
    result: MatchResult,
) -> Result<()> {
    let mut match_data = self.get_match_mut(&match_id)?;

    // Set result using Bitcoin block hash for provable fairness
    match_data.result = result;
    match_data.random_seed = self.get_bitcoin_block_hash();

    // Pools are now frozen
    // total_home_bets = 10,000 tokens
    // total_away_bets = 5,000 tokens
    // total_draw_bets = 3,000 tokens

    Ok(())
}
```

**Step 2: Betslip Settlement (Per User)**
```rust
pub fn settle_betslip(&mut self, slip_id: String) -> Result<u64> {
    let betslip = self.get_betslip(&slip_id)?;

    if betslip.settled {
        return Err("Already settled");
    }

    // Check if user won (all predictions correct)
    let all_correct = self.check_all_predictions(&betslip)?;

    if !all_correct {
        // User lost - funds already in pool
        betslip.settled = true;
        betslip.payout_amount = 0;
        return Ok(0);
    }

    // User won - calculate payout
    let mut total_payout = 0;

    match betslip.bet_type {
        BetType::Single => {
            // Simple single bet calculation
            let bet = &betslip.bets[0];
            let payout = self.calculate_single_payout(bet, &betslip.badges)?;
            total_payout = payout;
        },

        BetType::Parlay => {
            // Multiplicative parlay (all must win)
            total_payout = self.calculate_parlay_payout(
                betslip.total_stake,
                &betslip.bets,
                &betslip.badges,
            )?;
        },

        BetType::SystemBet => {
            // Additive system bet (partial wins allowed)
            for bet in &betslip.bets {
                let match_data = self.get_match(&bet.match_id)?;
                if self.is_prediction_correct(bet, &match_data) {
                    let payout = self.calculate_single_payout(bet, &betslip.badges)?;
                    total_payout += payout;
                }
            }
        },
    }

    // Update betslip
    betslip.settled = true;
    betslip.payout_amount = total_payout;

    return Ok(total_payout);
}
```

**Step 3: Parlay Payout Calculation**
```rust
pub fn calculate_parlay_payout(
    stake: u64,
    bets: &[SingleBet],
    badges: &[u8],
) -> u64 {
    let mut combined_odds = 10000u64; // Start at 1.0x

    for bet in bets {
        let match_data = self.get_match(&bet.match_id)?;

        // Get final pool state
        let winning_pool = match bet.prediction {
            MatchResult::HomeWin => match_data.total_home_bets,
            MatchResult::AwayWin => match_data.total_away_bets,
            MatchResult::Draw => match_data.total_draw_bets,
        };

        let total_pool = match_data.total_home_bets +
                        match_data.total_away_bets +
                        match_data.total_draw_bets;

        let losing_pool = total_pool - winning_pool;

        // Parimutuel odds for this match
        // odds = total_pool / winning_pool
        let match_odds = (total_pool * 10000) / winning_pool;
        // Example: (18000 * 10000) / 10000 = 18000 (1.8x)

        // Apply badge bonus if user owns team NFT
        if !badges.is_empty() {
            let bonus = match_odds * BADGE_BONUS_BPS / 10000; // +5%
            match_odds += bonus; // 18000 + 900 = 18900 (1.89x)
        }

        // Multiply cumulative odds
        combined_odds = combined_odds.saturating_mul(match_odds) / 10000;
        // Round 1: 10000 * 18900 / 10000 = 18900 (1.89x)
        // Round 2: 18900 * 22000 / 10000 = 41580 (4.158x)
        // Round 3: 41580 * 15000 / 10000 = 62370 (6.237x)
    }

    // Apply house edge (4%)
    combined_odds = combined_odds - (combined_odds * HOUSE_EDGE_BPS / 10000);
    // 62370 - (62370 * 400 / 10000) = 62370 - 2495 = 59875 (5.9875x)

    // Calculate final payout
    let payout = stake.saturating_mul(combined_odds) / 10000;
    // 1000 * 59875 / 10000 = 5987.5 tokens

    return payout;
}

pub fn calculate_single_payout(
    bet: &SingleBet,
    badges: &[u8],
) -> u64 {
    let match_data = self.get_match(&bet.match_id)?;

    // Get final pool state
    let winning_pool = self.get_winning_pool(&match_data, &bet.prediction);
    let total_pool = match_data.total_home_bets +
                    match_data.total_away_bets +
                    match_data.total_draw_bets;
    let losing_pool = total_pool - winning_pool;

    // Parimutuel formula
    let bet_share = (bet.odds * 10000) / winning_pool;
    let base_payout = (bet_share * losing_pool) / 10000;

    // Apply house edge
    let after_edge = base_payout - (base_payout * HOUSE_EDGE_BPS / 10000);

    // Apply badge bonus
    if !badges.is_empty() {
        let bonus = after_edge * BADGE_BONUS_BPS / 10000;
        return after_edge + bonus;
    }

    return after_edge;
}
```

### Example Calculation:

**Scenario: 3-Match Parlay**
```
User bets 1000 tokens on:
- Match 1: Home Win
- Match 2: Away Win
- Match 3: Draw

Final Pool State (after all bets):
Match 1:
  Home: 10,000 tokens (winning pool)
  Away: 5,000 tokens
  Draw: 3,000 tokens
  Total: 18,000 tokens
  Odds: 18,000 / 10,000 = 1.8x

Match 2:
  Home: 6,000 tokens
  Away: 8,000 tokens (winning pool)
  Draw: 4,000 tokens
  Total: 18,000 tokens
  Odds: 18,000 / 8,000 = 2.25x

Match 3:
  Home: 7,000 tokens
  Away: 6,000 tokens
  Draw: 5,000 tokens (winning pool)
  Total: 18,000 tokens
  Odds: 18,000 / 5,000 = 3.6x

Parlay Calculation:
1. Combined odds: 1.8 × 2.25 × 3.6 = 14.58x
2. Apply house edge (4%): 14.58 × 0.96 = 14.0x
3. Apply badge bonus (5% if has NFT): 14.0 × 1.05 = 14.7x
4. Final payout: 1000 × 14.7 = 14,700 tokens

Profit: 14,700 - 1,000 = 13,700 tokens (1370% gain!)
```

### Profit Calculation Summary:

**User Perspective:**
```
Bet Amount: 1000 tokens

If Win (3-match parlay, all correct):
- Parimutuel Odds: 14.58x (market-driven)
- After House Edge: 14.0x
- With Badge Bonus: 14.7x
- Payout: 14,700 tokens
- Profit: 13,700 tokens (1370% gain)

If Partial Win (SystemBet, 2 of 3 correct):
- Match 1 payout: 333 × 1.8 = 599 tokens
- Match 2 payout: 333 × 2.25 = 749 tokens
- Match 3 payout: 0 (lost)
- Total: 1348 tokens
- Profit: 348 tokens (34.8% gain)

If Lose (any wrong in Parlay):
- Payout: 0 tokens
- Loss: 1000 tokens (100% loss)
```

**Protocol Perspective:**
```
Total Bets Collected: 1,000,000 tokens

Winning Payouts:
- Calculated from final pool ratios
- House keeps 4% of winnings
- Example: If 300,000 tokens in winning pools
  - Base payout needed: 300k × avg_odds
  - House edge revenue: payout × 4%

House Revenue:
- From winning payouts: ~40,000 tokens (varies)
- From losing bets: 700,000 tokens (all losers)
- Protocol share: 2% of house edge

Liquidity Pool:
- Starts with protocol-funded liquidity
- Grows with losing bets
- Shrinks with winning payouts
- Natural balancing (more bets on favorites = lower payouts)
```

---

# 3. LP (LIQUIDITY PROVIDER) FEATURES

## Solidity Implementation: ADVANCED LP MANAGEMENT

### Core Concept: AMM-Style LP Shares

**LP Share System:**
```solidity
// State variables
uint256 public totalLiquidity;           // Total LEAGUE in pool
uint256 public totalShares;              // Total LP shares issued
mapping(address => uint256) public lpShares; // LP shares per address

// Deposit tracking (NEW)
mapping(address => uint256) public lpInitialDeposit;
mapping(address => uint256) public lpTotalWithdrawn;
mapping(address => uint256) public lpDepositTimestamp;

// Risk tracking
uint256 public lockedLiquidity;          // Locked for pending bets
uint256 public borrowedForPoolBalancing; // Borrowed for odds allocation
```

### Feature 1: Deposit & Withdraw

**Adding Liquidity:**
```solidity
function addLiquidity(uint256 amount) external returns (uint256 shares) {
    // Transfer tokens
    leagueToken.safeTransferFrom(msg.sender, address(this), amount);

    if (totalShares == 0) {
        // First LP: shares = amount (minus minimum)
        shares = amount - MINIMUM_LIQUIDITY;
        lpShares[address(0)] = MINIMUM_LIQUIDITY; // Locked forever
        totalShares = amount;
        totalLiquidity = amount;
    } else {
        // Subsequent LPs: proportional shares
        // shares = (amount × totalShares) / totalLiquidity
        shares = (amount * totalShares) / totalLiquidity;

        lpShares[msg.sender] += shares;
        totalShares += shares;
        totalLiquidity += amount;
    }

    // Track deposit for P&L
    lpInitialDeposit[msg.sender] += amount;
    if (lpDepositTimestamp[msg.sender] == 0) {
        lpDepositTimestamp[msg.sender] = block.timestamp;
    }
}

// Example:
// Pool state: 100,000 LEAGUE, 100,000 shares
// Alice deposits 10,000 LEAGUE
// Alice receives: (10,000 × 100,000) / 100,000 = 10,000 shares (10%)
// New state: 110,000 LEAGUE, 110,000 shares
```

**Removing Liquidity:**
```solidity
function removeLiquidity(uint256 shares) external returns (uint256 amount) {
    require(lpShares[msg.sender] >= shares, "Insufficient shares");

    // Calculate amount to return
    // amount = (shares × totalLiquidity) / totalShares
    uint256 totalAmount = (shares * totalLiquidity) / totalShares;

    // Apply withdrawal fee (0.5%)
    uint256 fee = (totalAmount * WITHDRAWAL_FEE) / 10000; // 50 bps
    amount = totalAmount - fee;

    // Check available liquidity
    uint256 availableLiquidity = totalLiquidity - lockedLiquidity;
    require(amount <= availableLiquidity, "Insufficient liquidity");

    // Update state
    lpShares[msg.sender] -= shares;
    totalShares -= shares;
    totalLiquidity -= amount; // Fee stays in pool

    // Track withdrawal
    lpTotalWithdrawn[msg.sender] += amount;

    // Transfer tokens
    leagueToken.safeTransfer(msg.sender, amount);
}

// Example:
// Pool state: 110,000 LEAGUE, 110,000 shares
// Alice withdraws 10,000 shares (10%)
// Alice receives: (10,000 × 110,000) / 110,000 - 0.5% fee = 9,945 LEAGUE
// New state: 100,055 LEAGUE, 100,000 shares
// Fee (55 LEAGUE) benefits remaining LPs
```

### Feature 2: Real-Time Profit & Loss Tracking

**Comprehensive Position Tracking:**
```solidity
function getLPPositionDetailed(address lp)
    external view returns (
        uint256 initialDeposit,      // Total deposited
        uint256 totalWithdrawn,      // Total withdrawn
        uint256 currentValue,        // Current share value (optimistic)
        uint256 realizedValue,       // Current value (conservative)
        uint256 atRiskAmount,        // Locked in pending bets
        int256 profitLoss,           // Overall P&L
        int256 roiBPS                // ROI in basis points
    )
{
    initialDeposit = lpInitialDeposit[lp];
    totalWithdrawn = lpTotalWithdrawn[lp];
    uint256 shares = lpShares[lp];

    // Optimistic value: includes borrowed funds (will return)
    uint256 effectiveLiquidity = totalLiquidity + borrowedForPoolBalancing;
    currentValue = (shares * effectiveLiquidity) / totalShares;

    // Conservative value: excludes locked liquidity (at risk)
    uint256 availableLiquidity = totalLiquidity - lockedLiquidity;
    realizedValue = (shares * availableLiquidity) / totalShares;

    // Amount at risk in pending bets
    atRiskAmount = currentValue - realizedValue;

    // Calculate profit/loss
    uint256 totalReceived = currentValue + totalWithdrawn;
    if (totalReceived >= initialDeposit) {
        profitLoss = int256(totalReceived - initialDeposit);
    } else {
        profitLoss = -int256(initialDeposit - totalReceived);
    }

    // Calculate ROI in basis points
    if (initialDeposit > 0) {
        roiBPS = (profitLoss * 10000) / int256(initialDeposit);
    } else {
        roiBPS = 0;
    }
}

// Example Output:
// Alice's Position:
// initialDeposit: 100,000 LEAGUE
// totalWithdrawn: 20,000 LEAGUE
// currentValue: 105,000 LEAGUE (her 10% of pool)
// realizedValue: 95,000 LEAGUE (10% of unlocked)
// atRiskAmount: 10,000 LEAGUE (locked in pending bets)
// profitLoss: +25,000 LEAGUE (105k + 20k - 100k)
// roiBPS: +2500 (25% ROI)
```

**Simplified P&L View:**
```solidity
function getLPProfitLoss(address lp)
    external view returns (
        uint256 netDeposit,        // Currently at risk
        uint256 currentValue,      // Current share value
        int256 unrealizedPL,       // Unrealized profit/loss
        int256 realizedPL          // Realized profit/loss
    )
{
    uint256 initialDeposit = lpInitialDeposit[lp];
    uint256 totalWithdrawn = lpTotalWithdrawn[lp];

    // Net deposit = what's currently at risk
    if (initialDeposit >= totalWithdrawn) {
        netDeposit = initialDeposit - totalWithdrawn;
    } else {
        netDeposit = 0; // Withdrawn more than deposited
    }

    // Current value of shares
    uint256 effectiveLiquidity = totalLiquidity + borrowedForPoolBalancing;
    uint256 shares = lpShares[lp];
    currentValue = (shares * effectiveLiquidity) / totalShares;

    // Unrealized P/L = current value vs net deposit
    if (currentValue >= netDeposit) {
        unrealizedPL = int256(currentValue - netDeposit);
    } else {
        unrealizedPL = -int256(netDeposit - currentValue);
    }

    // Realized P/L = withdrawn vs initial risk
    if (totalWithdrawn >= initialDeposit) {
        realizedPL = int256(totalWithdrawn - initialDeposit);
    } else {
        realizedPL = 0; // Haven't withdrawn enough yet
    }
}
```

### Feature 3: Partial Withdrawals

**Withdraw What's Available:**
```solidity
function partialWithdrawal(uint256 shares)
    external returns (uint256 amount, uint256 sharesBurned)
{
    require(lpShares[msg.sender] >= shares, "Insufficient shares");

    uint256 availableLiquidity = totalLiquidity - lockedLiquidity;
    require(availableLiquidity > 0, "No liquidity available");

    // Calculate requested amount
    uint256 requestedAmount = (shares * totalLiquidity) / totalShares;
    uint256 fee = (requestedAmount * WITHDRAWAL_FEE) / 10000;
    uint256 requestedAfterFee = requestedAmount - fee;

    if (requestedAfterFee <= availableLiquidity) {
        // Can withdraw full amount
        sharesBurned = shares;
        amount = requestedAfterFee;
    } else {
        // Can only withdraw partial
        amount = availableLiquidity;

        // Calculate shares needed for this amount
        // Working backwards from amount
        uint256 totalNeeded = (amount * 10000) / (10000 - WITHDRAWAL_FEE);
        sharesBurned = (totalNeeded * totalShares) / totalLiquidity;

        // Don't burn more than requested
        if (sharesBurned > shares) {
            sharesBurned = shares;
            amount = requestedAfterFee;
        }
    }

    // Update state
    lpShares[msg.sender] -= sharesBurned;
    totalShares -= sharesBurned;
    totalLiquidity -= amount;
    lpTotalWithdrawn[msg.sender] += amount;

    leagueToken.safeTransfer(msg.sender, amount);
}

// Example:
// Pool: 100,000 LEAGUE, 50,000 locked
// Available: 50,000 LEAGUE
// Alice tries to withdraw 20,000 shares (worth 20k LEAGUE)
// If 20k > 50k available: withdraw only 50k, burn more shares
// Result: Alice gets 50k LEAGUE, burns more shares proportionally
```

### Feature 4: Revenue Distribution

**How LPs Earn:**
```solidity
function finalizeRoundRevenue(uint256 roundId) external {
    RoundAccounting storage accounting = roundAccounting[roundId];
    require(accounting.settled, "Not settled");

    // Check remaining balance in BettingPool
    uint256 remainingInContract = leagueToken.balanceOf(address(this));

    uint256 profitToLP = 0;
    uint256 seasonShare = 0;

    if (remainingInContract > 0) {
        // Season pool gets 2% of user deposits
        uint256 totalUserBets = accounting.totalUserDeposits +
                               accounting.protocolFeeCollected;
        seasonShare = (totalUserBets * 200) / 10000; // 2%

        // LP gets everything else
        profitToLP = remainingInContract - seasonShare;

        // Transfer LP's share back to LP pool
        if (profitToLP > 0) {
            leagueToken.safeTransfer(address(liquidityPoolV2), profitToLP);
            liquidityPoolV2.returnSeedFunds(profitToLP);
            // This increases totalLiquidity, benefiting all LPs
        }
    }

    accounting.lpRevenueShare = profitToLP;
    accounting.revenueDistributed = true;
}
```

**LP Earning Example:**
```
Round Start:
- LP pool: 500,000 LEAGUE
- LP seeds round: 30,000 LEAGUE
- LP pool temporarily: 470,000 LEAGUE

During Round:
- Users bet: 200,000 LEAGUE
- Protocol fee (5%): 10,000 LEAGUE (to treasury)
- Betting pool receives: 190,000 LEAGUE

Round End (60% loss rate):
- Winning bets paid: 80,000 LEAGUE (from LP pool)
- Losing bets: 120,000 LEAGUE (stays in betting pool)
- Seed returned: 30,000 LEAGUE
- Season pool (2%): 4,000 LEAGUE

LP receives:
- Seed: 30,000 LEAGUE
- Losing bets: 120,000 LEAGUE
- Minus winners paid: -80,000 LEAGUE
- Minus season pool: -4,000 LEAGUE
- Net profit: 66,000 LEAGUE

LP pool final: 470,000 + 66,000 = 536,000 LEAGUE (+7.2%)

Alice (10% share):
- Start value: 50,000 LEAGUE
- End value: 53,600 LEAGUE
- Profit: 3,600 LEAGUE (+7.2% for round)
```

### Feature 5: Risk Metrics

**Pool Utilization:**
```solidity
function getUtilizationRate() external view returns (uint256 utilizationBPS) {
    if (totalLiquidity == 0) return 0;
    return (lockedLiquidity * 10000) / totalLiquidity;
}

// Example:
// totalLiquidity: 500,000 LEAGUE
// lockedLiquidity: 150,000 LEAGUE (pending bets)
// Utilization: (150,000 × 10,000) / 500,000 = 3,000 bps (30%)
```

**Max Withdrawable:**
```solidity
function getMaxWithdrawableAmount(address lp)
    external view returns (uint256 maxWithdrawable, uint256 totalValue)
{
    uint256 shares = lpShares[lp];

    // Total value of shares
    totalValue = (shares * totalLiquidity) / totalShares;

    // Apply withdrawal fee
    uint256 amountAfterFee = totalValue - (totalValue * WITHDRAWAL_FEE / 10000);

    // Check available liquidity
    uint256 availableLiquidity = totalLiquidity - lockedLiquidity;

    // Max is lesser of LP's value and available liquidity
    maxWithdrawable = amountAfterFee > availableLiquidity
        ? availableLiquidity
        : amountAfterFee;
}
```

---

## BitcoinOS Charms Implementation: PROTOCOL-MANAGED LIQUIDITY

### Core Concept: No Public LP (Protocol Controls Pool)

**Current State:**
```rust
// LIQUIDITY_POOL_NFT (tag 16)
pub struct LiquidityPoolData {
    pub pool_id: String,
    pub total_liquidity: u64,        // Protocol-funded
    pub total_bets_in_play: u64,     // Currently locked
    pub total_paid_out: u64,         // Lifetime payouts
    pub total_collected: u64,        // Lifetime revenue
    pub protocol_revenue: u64,       // Protocol's share (2%)
    pub house_balance: u64,          // Available balance
    pub is_active: bool,             // Pool active?
    pub min_liquidity: u64,          // Minimum required
}
```

### Feature 1: Protocol Funding Only

**Initial Funding:**
```rust
pub fn create_liquidity_pool(
    &mut self,
    pool_id: String,
    initial_liquidity: u64,
) -> Result<()> {
    // Only protocol (HOUSE_NFT holder) can create pool
    require_house_nft(&tx)?;

    let pool_data = LiquidityPoolData {
        pool_id,
        total_liquidity: initial_liquidity,
        total_bets_in_play: 0,
        total_paid_out: 0,
        total_collected: 0,
        protocol_revenue: 0,
        house_balance: initial_liquidity,
        is_active: true,
        min_liquidity: initial_liquidity / 10, // 10% minimum
    };

    // Create LIQUIDITY_POOL_NFT charm
    create_charm(Tag::LiquidityPool, pool_data)?;

    Ok(())
}
```

**No Public Deposits:**
- Users cannot add liquidity
- No LP shares issued
- No withdrawal mechanism for users
- Protocol retains full control

### Feature 2: Basic Profit Tracking

**Pool State Updates:**
```rust
pub fn process_winning_bet(
    &mut self,
    payout_amount: u64,
) -> Result<()> {
    let mut pool = self.get_liquidity_pool_mut()?;

    // Check solvency
    require(
        pool.house_balance >= payout_amount,
        "Insufficient liquidity"
    );

    // Update pool state
    pool.house_balance -= payout_amount;
    pool.total_paid_out += payout_amount;
    pool.total_bets_in_play -= payout_amount; // Release lock

    // Check minimum liquidity threshold
    require(
        pool.house_balance >= pool.min_liquidity,
        "Pool below minimum threshold"
    );

    Ok(())
}

pub fn process_losing_bet(
    &mut self,
    bet_amount: u64,
) -> Result<()> {
    let mut pool = self.get_liquidity_pool_mut()?;

    // Funds stay in pool
    pool.house_balance += bet_amount;
    pool.total_collected += bet_amount;
    pool.total_bets_in_play -= bet_amount; // Release lock

    // Calculate protocol revenue (2% of house edge)
    let house_edge_amount = bet_amount * HOUSE_EDGE_BPS / 10000;
    let protocol_share = house_edge_amount * PROTOCOL_REVENUE_BPS / 10000;
    pool.protocol_revenue += protocol_share;

    Ok(())
}
```

**Simple Metrics:**
```rust
pub fn get_pool_profit(&self) -> i64 {
    let pool = self.get_liquidity_pool()?;

    // Simple calculation:
    // profit = collected - paid_out
    let collected = pool.total_collected as i64;
    let paid_out = pool.total_paid_out as i64;

    collected - paid_out
}

pub fn get_pool_roi(&self) -> f64 {
    let pool = self.get_liquidity_pool()?;

    let initial = pool.total_liquidity;
    let current = pool.house_balance;

    // ROI = (current - initial) / initial
    ((current as f64 - initial as f64) / initial as f64) * 100.0
}
```

### Feature 3: No Advanced LP Features

**Missing Features:**
```
❌ No LP shares
❌ No deposit/withdraw functions
❌ No real-time P&L tracking
❌ No partial withdrawals
❌ No utilization metrics for users
❌ No individual LP positions
❌ No withdrawal fees
❌ No profit distribution to users
```

**Why:**
- Protocol-controlled model
- Simpler architecture
- Less attack surface
- No LP rug pull risk
- But also: No yield opportunities for token holders

### Feature 4: Potential Enhancement (Not Implemented)

**How to Add LP Shares to Charms:**
```rust
// NEW: LP_SHARE_NFT (tag 17)
pub struct LPShareData {
    pub share_id: String,
    pub lp_address: String,
    pub shares: u64,
    pub initial_deposit: u64,
    pub deposit_timestamp: u64,
}

pub fn deposit_liquidity(
    &mut self,
    lp_address: String,
    amount: u64,
) -> Result<String> {
    // Get current pool state
    let pool = self.get_liquidity_pool()?;

    // Calculate shares (AMM formula)
    let total_shares = self.get_total_shares()?;
    let shares = if total_shares == 0 {
        amount // First LP
    } else {
        (amount * total_shares) / pool.total_liquidity
    };

    // Create LP_SHARE_NFT
    let share_data = LPShareData {
        share_id: generate_id(),
        lp_address: lp_address.clone(),
        shares,
        initial_deposit: amount,
        deposit_timestamp: get_timestamp(),
    };

    create_charm(Tag::LPShare, share_data)?;

    // Update pool
    pool.total_liquidity += amount;

    Ok(share_data.share_id)
}

pub fn withdraw_liquidity(
    &mut self,
    share_id: String,
) -> Result<u64> {
    let share_data = self.get_lp_share(&share_id)?;
    let pool = self.get_liquidity_pool()?;

    // Calculate withdrawal amount
    let total_shares = self.get_total_shares()?;
    let amount = (share_data.shares * pool.total_liquidity) / total_shares;

    // Check available liquidity
    let available = pool.house_balance - pool.total_bets_in_play;
    require(amount <= available, "Insufficient liquidity");

    // Burn LP_SHARE_NFT and return funds
    burn_charm(&share_id)?;
    pool.total_liquidity -= amount;

    Ok(amount)
}
```

---

# COMPARISON SUMMARY

## 1. Odds Mechanism

| Feature | Solidity (Locked) | Charms (Parimutuel) |
|---------|------------------|---------------------|
| **When Set** | At seeding (before bets) | At settlement (after bets) |
| **Stability** | Fixed forever | Changes with each bet |
| **User Experience** | ✅ Knows exact payout | ❌ Uncertain until close |
| **LP Risk** | ⚠️ Higher (can't adjust) | ✅ Lower (self-balancing) |
| **Manipulation** | ✅ Impossible | ⚠️ Possible (large bets) |
| **Fairness** | ✅ Same odds for all | ⚠️ Early bettor disadvantage |
| **Range** | 1.3x - 1.7x (compressed) | 1.0x - 20x+ (market-driven) |
| **Capital Required** | ⚠️ High (30k per round) | ✅ Low (user-funded) |

**Winner: Solidity** for user experience, **Charms** for capital efficiency

## 2. Profit Calculation

| Feature | Solidity | Charms |
|---------|----------|--------|
| **Formula** | Locked odds × parlay multiplier | Parimutuel × house edge × badges |
| **Complexity** | ✅ Simple (fixed math) | ⚠️ Complex (final pool state) |
| **Predictability** | ✅ Exact payout shown | ❌ Estimate only |
| **Parlay Bonus** | 1.05x - 1.25x (capped) | Unlimited (multiplicative) |
| **Max Payout** | Capped (100k per bet) | ⚠️ Uncapped (LP risk) |
| **House Edge** | 5% upfront fee | 4% from winnings |
| **Badge Bonus** | ❌ None | ✅ +5% with NFT |
| **Partial Wins** | ❌ All or nothing | ✅ SystemBet allows |

**Winner: Tie** - Solidity is predictable, Charms offers higher upside

## 3. LP Features

| Feature | Solidity | Charms |
|---------|----------|--------|
| **LP Shares** | ✅ AMM-style | ❌ None |
| **Public Deposits** | ✅ Anyone can LP | ❌ Protocol only |
| **Withdrawals** | ✅ Anytime (if liquid) | ❌ Not applicable |
| **Partial Withdrawals** | ✅ Supported | ❌ Not applicable |
| **P&L Tracking** | ✅ Real-time | ⚠️ Basic pool stats |
| **Individual Positions** | ✅ Per-LP tracking | ❌ None |
| **Withdrawal Fee** | ✅ 0.5% (benefits LPs) | ❌ None |
| **Risk Metrics** | ✅ Utilization, locked, etc. | ⚠️ Basic solvency |
| **Yield Opportunity** | ✅ Earn from losing bets | ❌ No yield for users |
| **Complexity** | ⚠️ High (300+ lines) | ✅ Low (simpler) |

**Winner: Solidity** (Clear winner - far more advanced LP features)

---

# FINAL RECOMMENDATION

## For Your Use Case:

**Use Solidity L2's Odds & LP Features + Charms' Security**

### Recommended Hybrid Approach:

**1. Adopt Locked Odds Model from Solidity**
```rust
// Add to your Charms implementation:
pub struct LockedOdds {
    pub home_odds: u64,
    pub away_odds: u64,
    pub draw_odds: u64,
    pub locked: bool,
}

// Lock odds at match creation (before any bets)
pub fn create_match_with_locked_odds(...) {
    // Calculate seed-based odds
    let odds = calculate_initial_odds(home_team, away_team);

    // Lock them permanently
    match_data.locked_odds = LockedOdds {
        home_odds: odds.home,
        away_odds: odds.away,
        draw_odds: odds.draw,
        locked: true,
    };
}
```

**Why:** Users need payout certainty for good UX

**2. Add LP Share System from Solidity**
```rust
// Add LP_SHARE_NFT charm type (tag 17)
// Implement deposit_liquidity() and withdraw_liquidity()
// Track per-LP profit/loss
```

**Why:** Token holders want yield opportunities

**3. Keep Charms' Badge Bonus & SystemBet**
```rust
// These are unique innovations:
- Badge NFT bonuses (+5% with team NFT)
- SystemBet (partial wins allowed)
- Bitcoin-native provably fair
```

**Why:** Competitive advantages over Solidity version

**4. Add Risk Management Caps from Solidity**
```rust
pub const MAX_BET_AMOUNT: u64 = 10_000;
pub const MAX_PAYOUT_PER_BET: u64 = 100_000;
pub const MAX_ROUND_PAYOUTS: u64 = 500_000;
```

**Why:** Protect LP from catastrophic losses

---

# Implementation Priority

**Week 1-2: Locked Odds** ⭐️ CRITICAL
- Lock odds at match creation
- Update betslip creation to use locked odds
- Add get_locked_odds() view function

**Week 3-4: LP Share System** ⭐️ HIGH
- Create LP_SHARE_NFT charm type
- Implement deposit/withdraw functions
- Add profit tracking per LP

**Week 5: Risk Management** ⭐️ MEDIUM
- Add MAX_BET caps
- Implement per-round payout limits
- Add solvency checks

**Week 6: Dashboard** ⭐️ MEDIUM
- Build LP dashboard with P&L
- Show locked odds in bet UI
- Display risk metrics

This hybrid approach gives you:
- ✅ Solidity's UX advantages (locked odds, LP features)
- ✅ Charms' security (Bitcoin-native, no MEV)
- ✅ Best of both worlds

The Solidity implementation is more sophisticated, but you can adopt its best concepts while keeping Charms' security model.
