# Smart Contract Enhancements V2

## Overview
Implementing 5 critical features from Solidity analysis to improve the Charms smart contract.

---

## 1. LOCKED ODDS MECHANISM ⭐️ CRITICAL

### What It Does
Locks odds at match creation time (before any bets), providing guaranteed payout certainty.

### Implementation

**New Struct:**
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LockedOdds {
    pub home_odds: u64,      // e.g., 13000 = 1.3x
    pub away_odds: u64,      // e.g., 17000 = 1.7x
    pub draw_odds: u64,      // e.g., 15000 = 1.5x
    pub locked: bool,        // Odds are locked
}
```

**Updated MatchData:**
```rust
pub struct MatchData {
    // ... existing fields ...
    pub locked_odds: Option<LockedOdds>,  // NEW: Locked odds
}
```

**New Function:**
```rust
pub fn lock_match_odds(
    match_id: &str,
    home_seed: u64,
    away_seed: u64,
    draw_seed: u64,
) -> LockedOdds {
    let total_seed = home_seed + away_seed + draw_seed;

    // Calculate raw odds from seed ratios
    let raw_home = (total_seed * 10000) / home_seed;
    let raw_away = (total_seed * 10000) / away_seed;
    let raw_draw = (total_seed * 10000) / draw_seed;

    // Compress to 1.3x - 1.7x range
    LockedOdds {
        home_odds: compress_odds(raw_home),
        away_odds: compress_odds(raw_away),
        draw_odds: compress_odds(raw_draw),
        locked: true,
    }
}

fn compress_odds(raw_odds: u64) -> u64 {
    // Map raw 1.8x-5.5x to target 1.3x-1.7x
    if raw_odds < 18000 { return 13000; }  // Min 1.3x
    if raw_odds > 55000 { return 17000; }  // Max 1.7x

    // Linear compression: 1.3 + (raw - 1.8) × 0.108
    let excess = raw_odds - 18000;
    13000 + (excess * 108) / 1000
}
```

**Benefits:**
- ✅ Users know exact payout before betting
- ✅ No timing advantage (fair for all)
- ✅ Simpler accounting
- ✅ No odds manipulation possible

---

## 2. LP SHARE SYSTEM

### What It Does
Adds AMM-style LP shares so users can provide liquidity and earn yield.

### Implementation

**New Charm Tag:**
```rust
pub const LP_SHARE_NFT: char = '\u{11}'; // 17
```

**New Struct:**
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LPShareData {
    pub share_id: String,
    pub lp_address: String,
    pub shares: u64,               // LP shares owned
    pub initial_deposit: u64,       // Total deposited
    pub total_withdrawn: u64,       // Total withdrawn
    pub deposit_timestamp: u64,     // When LP joined
}
```

**Updated LiquidityPoolData:**
```rust
pub struct LiquidityPoolData {
    // ... existing fields ...
    pub total_shares: u64,            // NEW: Total LP shares issued
    pub minimum_liquidity: u64,       // NEW: Locked shares (1000)
}
```

**New Functions:**
```rust
pub fn deposit_liquidity(
    lp_address: String,
    amount: u64,
) -> Result<LPShareData, String> {
    // Get current pool state
    let pool = get_liquidity_pool()?;

    // Calculate shares (AMM formula)
    let shares = if pool.total_shares == 0 {
        // First LP
        amount - MINIMUM_LIQUIDITY
    } else {
        // Proportional shares
        (amount * pool.total_shares) / pool.total_liquidity
    };

    // Create LP_SHARE_NFT
    let share_data = LPShareData {
        share_id: generate_unique_id(),
        lp_address: lp_address.clone(),
        shares,
        initial_deposit: amount,
        total_withdrawn: 0,
        deposit_timestamp: get_timestamp(),
    };

    // Update pool
    pool.total_liquidity += amount;
    pool.total_shares += shares;

    Ok(share_data)
}

pub fn withdraw_liquidity(
    share_id: String,
    shares_to_burn: u64,
) -> Result<u64, String> {
    let share_data = get_lp_share(&share_id)?;
    let pool = get_liquidity_pool()?;

    // Check sufficient shares
    if share_data.shares < shares_to_burn {
        return Err("Insufficient shares".to_string());
    }

    // Calculate withdrawal amount
    let amount = (shares_to_burn * pool.total_liquidity) / pool.total_shares;

    // Apply 0.5% withdrawal fee
    let fee = (amount * 50) / 10000;
    let amount_after_fee = amount - fee;

    // Check available liquidity
    let available = pool.house_balance - pool.total_bets_in_play;
    if amount_after_fee > available {
        return Err("Insufficient liquidity".to_string());
    }

    // Update state
    share_data.shares -= shares_to_burn;
    share_data.total_withdrawn += amount_after_fee;
    pool.total_shares -= shares_to_burn;
    pool.total_liquidity -= amount_after_fee;
    // Fee stays in pool (benefits remaining LPs)

    Ok(amount_after_fee)
}
```

**Benefits:**
- ✅ Token holders can earn yield
- ✅ Decentralized liquidity provision
- ✅ AMM-style share accounting
- ✅ Withdrawal fee protects LP from drain

---

## 3. RISK MANAGEMENT CAPS

### What It Does
Adds multiple layers of caps to protect LP from catastrophic losses.

### Implementation

**New Constants:**
```rust
// RISK MANAGEMENT CAPS
pub const MAX_PAYOUT_PER_BET: u64 = 100_000;     // 100k LEAGUE max payout per bet
pub const MAX_ROUND_PAYOUTS: u64 = 500_000;      // 500k LEAGUE max per round
pub const MAX_PARLAY_MULTIPLIER: u64 = 12500;    // 1.25x max parlay bonus
```

**Updated Validation:**
```rust
pub fn validate_betslip_payout(
    betslip: &BetslipData,
    round_id: &str,
) -> Result<bool, String> {
    // 1. Check per-bet payout cap
    if betslip.potential_payout > MAX_PAYOUT_PER_BET {
        return Err(format!(
            "Payout {} exceeds maximum {} per bet",
            betslip.potential_payout,
            MAX_PAYOUT_PER_BET
        ));
    }

    // 2. Check round payout cap
    let round_payouts = get_round_total_payouts(round_id)?;
    if round_payouts + betslip.potential_payout > MAX_ROUND_PAYOUTS {
        return Err(format!(
            "Round payout limit reached: {} / {}",
            round_payouts,
            MAX_ROUND_PAYOUTS
        ));
    }

    // 3. Check LP can cover payout
    let pool = get_liquidity_pool()?;
    if betslip.potential_payout > pool.house_balance {
        return Err("Insufficient liquidity to cover bet".to_string());
    }

    Ok(true)
}

pub fn calculate_capped_parlay_multiplier(
    num_bets: usize,
) -> u64 {
    let base_multiplier = match num_bets {
        1 => 10000,  // 1.0x
        2 => 10500,  // 1.05x
        3 => 11000,  // 1.10x
        4 => 11300,  // 1.13x
        5 => 11600,  // 1.16x
        6 => 11900,  // 1.19x
        7 => 12100,  // 1.21x
        8 => 12300,  // 1.23x
        9 => 12400,  // 1.24x
        _ => 12500,  // 1.25x (max for 10+)
    };

    std::cmp::min(base_multiplier, MAX_PARLAY_MULTIPLIER)
}
```

**Benefits:**
- ✅ Protects LP from excessive payouts
- ✅ Multiple safety layers
- ✅ Prevents protocol insolvency
- ✅ Limits parlay explosion

---

## 4. ADVANCED PROFIT TRACKING

### What It Does
Provides real-time profit/loss tracking for individual LPs.

### Implementation

**New Structs:**
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LPPosition {
    pub lp_address: String,
    pub shares: u64,
    pub initial_deposit: u64,
    pub total_withdrawn: u64,
    pub current_value: u64,          // Current share value
    pub unrealized_profit: i64,       // Unrealized P&L
    pub realized_profit: i64,         // Realized P&L from withdrawals
    pub roi_bps: i64,                // ROI in basis points
    pub deposit_timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoundAccounting {
    pub round_id: String,
    pub total_bets_collected: u64,
    pub total_payouts: u64,
    pub lp_profit: i64,              // LP profit/loss for round
    pub protocol_revenue: u64,
    pub season_pool_contribution: u64,
    pub settled: bool,
}
```

**New Functions:**
```rust
pub fn get_lp_position(
    lp_address: &str,
) -> Result<LPPosition, String> {
    let share_data = get_lp_share_by_address(lp_address)?;
    let pool = get_liquidity_pool()?;

    // Calculate current value of shares
    // Include borrowed funds since they'll return
    let effective_liquidity = pool.total_liquidity + pool.total_bets_in_play;
    let current_value = (share_data.shares * effective_liquidity) / pool.total_shares;

    // Calculate unrealized profit
    let total_value = current_value + share_data.total_withdrawn;
    let unrealized_profit = if total_value >= share_data.initial_deposit {
        (total_value - share_data.initial_deposit) as i64
    } else {
        -((share_data.initial_deposit - total_value) as i64)
    };

    // Calculate realized profit (from withdrawals)
    let realized_profit = if share_data.total_withdrawn >= share_data.initial_deposit {
        (share_data.total_withdrawn - share_data.initial_deposit) as i64
    } else {
        0
    };

    // Calculate ROI in basis points
    let roi_bps = if share_data.initial_deposit > 0 {
        (unrealized_profit * 10000) / (share_data.initial_deposit as i64)
    } else {
        0
    };

    Ok(LPPosition {
        lp_address: lp_address.to_string(),
        shares: share_data.shares,
        initial_deposit: share_data.initial_deposit,
        total_withdrawn: share_data.total_withdrawn,
        current_value,
        unrealized_profit,
        realized_profit,
        roi_bps,
        deposit_timestamp: share_data.deposit_timestamp,
    })
}

pub fn get_round_lp_profit(
    round_id: &str,
) -> Result<RoundAccounting, String> {
    let accounting = get_round_accounting(round_id)?;

    // Calculate LP profit for this round
    // Profit = (bets collected - payouts - fees)
    let lp_profit = (accounting.total_bets_collected as i64)
        - (accounting.total_payouts as i64)
        - (accounting.protocol_revenue as i64)
        - (accounting.season_pool_contribution as i64);

    Ok(RoundAccounting {
        round_id: round_id.to_string(),
        total_bets_collected: accounting.total_bets_collected,
        total_payouts: accounting.total_payouts,
        lp_profit,
        protocol_revenue: accounting.protocol_revenue,
        season_pool_contribution: accounting.season_pool_contribution,
        settled: accounting.settled,
    })
}

pub fn get_lp_profit_summary(
    lp_address: &str,
) -> Result<(u64, u64, i64, i64), String> {
    // Returns: (net_deposit, current_value, unrealized_pl, realized_pl)
    let share_data = get_lp_share_by_address(lp_address)?;
    let pool = get_liquidity_pool()?;

    let net_deposit = if share_data.initial_deposit >= share_data.total_withdrawn {
        share_data.initial_deposit - share_data.total_withdrawn
    } else {
        0
    };

    let effective_liquidity = pool.total_liquidity + pool.total_bets_in_play;
    let current_value = (share_data.shares * effective_liquidity) / pool.total_shares;

    let unrealized_pl = if current_value >= net_deposit {
        (current_value - net_deposit) as i64
    } else {
        -((net_deposit - current_value) as i64)
    };

    let realized_pl = if share_data.total_withdrawn >= share_data.initial_deposit {
        (share_data.total_withdrawn - share_data.initial_deposit) as i64
    } else {
        0
    };

    Ok((net_deposit, current_value, unrealized_pl, realized_pl))
}
```

**Benefits:**
- ✅ Real-time P&L visibility
- ✅ Separate unrealized/realized profit
- ✅ ROI calculation in basis points
- ✅ Per-round accounting

---

## 5. ENHANCED BETSLIP SETTLEMENT

### What It Does
Updates settlement logic to use locked odds and proper LP accounting.

### Implementation

**Updated Settlement:**
```rust
pub fn settle_betslip_with_locked_odds(
    slip_id: String,
) -> Result<u64, String> {
    let betslip = get_betslip(&slip_id)?;

    if betslip.settled {
        return Err("Already settled".to_string());
    }

    // Check if all predictions correct
    let all_correct = check_all_predictions(&betslip)?;

    if !all_correct {
        // User lost - update LP accounting
        let pool = get_liquidity_pool_mut()?;
        pool.house_balance += betslip.total_stake;
        pool.total_collected += betslip.total_stake;
        pool.total_bets_in_play -= betslip.total_stake;

        betslip.settled = true;
        betslip.payout_amount = 0;

        return Ok(0);
    }

    // User won - calculate payout using LOCKED ODDS
    let mut total_payout = 0;

    match betslip.bet_type {
        BetType::Single => {
            let bet = &betslip.bets[0];
            let match_data = get_match(&bet.match_id)?;

            // Use locked odds (not dynamic odds)
            let locked_odds = match_data.locked_odds
                .ok_or("Odds not locked")?;

            let match_odds = match bet.prediction {
                MatchResult::HomeWin => locked_odds.home_odds,
                MatchResult::AwayWin => locked_odds.away_odds,
                MatchResult::Draw => locked_odds.draw_odds,
                _ => return Err("Invalid prediction".to_string()),
            };

            // Simple calculation: stake × locked odds
            let base_payout = (betslip.total_stake * match_odds) / 10000;

            // Apply house edge (4%)
            let after_edge = base_payout - (base_payout * HOUSE_EDGE_BPS / 10000);

            // Apply badge bonus if applicable
            total_payout = if !betslip.badges.is_empty() {
                after_edge + (after_edge * BADGE_BONUS_BPS / 10000)
            } else {
                after_edge
            };
        },

        BetType::Parlay => {
            let mut combined_odds = 10000u64; // Start at 1.0x

            for bet in &betslip.bets {
                let match_data = get_match(&bet.match_id)?;

                // Use locked odds
                let locked_odds = match_data.locked_odds
                    .ok_or("Odds not locked")?;

                let match_odds = match bet.prediction {
                    MatchResult::HomeWin => locked_odds.home_odds,
                    MatchResult::AwayWin => locked_odds.away_odds,
                    MatchResult::Draw => locked_odds.draw_odds,
                    _ => return Err("Invalid prediction".to_string()),
                };

                // Multiplicative odds
                combined_odds = (combined_odds * match_odds) / 10000;
            }

            // Apply CAPPED parlay multiplier
            let parlay_multiplier = calculate_capped_parlay_multiplier(betslip.bets.len());
            combined_odds = (combined_odds * parlay_multiplier) / 10000;

            // Apply house edge
            combined_odds = combined_odds - (combined_odds * HOUSE_EDGE_BPS / 10000);

            // Calculate payout
            let base_payout = (betslip.total_stake * combined_odds) / 10000;

            // Apply badge bonus
            total_payout = if !betslip.badges.is_empty() {
                base_payout + (base_payout * BADGE_BONUS_BPS / 10000)
            } else {
                base_payout
            };

            // Apply MAX_PAYOUT_PER_BET cap
            if total_payout > MAX_PAYOUT_PER_BET {
                total_payout = MAX_PAYOUT_PER_BET;
            }
        },

        BetType::SystemBet => {
            // Similar to parlay but allows partial wins
            // Implementation...
        },
    }

    // Update LP accounting
    let pool = get_liquidity_pool_mut()?;
    pool.house_balance -= total_payout;
    pool.total_paid_out += total_payout;
    pool.total_bets_in_play -= betslip.total_stake;

    // Update betslip
    betslip.settled = true;
    betslip.payout_amount = total_payout;

    Ok(total_payout)
}
```

**Benefits:**
- ✅ Uses locked odds for certainty
- ✅ Proper LP accounting
- ✅ Capped parlay multipliers
- ✅ Per-bet and per-round caps

---

## Implementation Timeline

**Week 1-2: Locked Odds (CRITICAL)**
- Add LockedOdds struct
- Implement lock_match_odds() and compress_odds()
- Update MatchData with locked_odds field
- Update betslip settlement to use locked odds
- Test with sample matches

**Week 3-4: LP Share System**
- Add LP_SHARE_NFT charm type (tag 17)
- Implement deposit_liquidity() and withdraw_liquidity()
- Add withdrawal fee mechanism (0.5%)
- Update liquidity pool contract
- Test deposit/withdraw flows

**Week 5: Risk Management**
- Add MAX_PAYOUT_PER_BET constant
- Add MAX_ROUND_PAYOUTS constant
- Add MAX_PARLAY_MULTIPLIER constant
- Implement validation in betslip creation
- Test edge cases (large bets, many parlays)

**Week 6: Advanced Profit Tracking**
- Add LPPosition and RoundAccounting structs
- Implement get_lp_position() function
- Implement get_round_lp_profit() function
- Add real-time P&L calculations
- Build frontend dashboard

**Week 7: Enhanced Settlement**
- Update settle_betslip() to use locked odds
- Add proper LP accounting hooks
- Test full settlement flow
- Verify accounting accuracy

---

## Testing Checklist

**Locked Odds:**
- [ ] Odds lock correctly at match creation
- [ ] Compression maps to 1.3x-1.7x range
- [ ] Odds don't change after bets placed
- [ ] Settlement uses locked odds

**LP Shares:**
- [ ] First LP gets correct shares
- [ ] Subsequent LPs get proportional shares
- [ ] Withdrawal calculates correct amount
- [ ] Withdrawal fee stays in pool
- [ ] Can't withdraw when liquidity locked

**Risk Management:**
- [ ] MAX_PAYOUT_PER_BET enforced
- [ ] MAX_ROUND_PAYOUTS enforced
- [ ] MAX_PARLAY_MULTIPLIER enforced
- [ ] Bets rejected when caps exceeded

**Profit Tracking:**
- [ ] LP position shows correct values
- [ ] Unrealized profit calculated correctly
- [ ] Realized profit from withdrawals accurate
- [ ] ROI in basis points correct
- [ ] Per-round accounting accurate

**Settlement:**
- [ ] Winning bets use locked odds
- [ ] Losing bets update LP correctly
- [ ] Caps applied to payouts
- [ ] LP balance updates accurately

---

## Breaking Changes

**1. MatchData Structure**
- Added `locked_odds: Option<LockedOdds>` field
- Existing matches need migration or default

**2. LiquidityPoolData Structure**
- Added `total_shares: u64` field
- Added `minimum_liquidity: u64` field
- Existing pools need initialization

**3. New Charm Type**
- LP_SHARE_NFT (tag 17) requires app contract update
- Spell files need creation

**4. Constants**
- MAX_PAYOUT_PER_BET, MAX_ROUND_PAYOUTS, MAX_PARLAY_MULTIPLIER
- Update any hardcoded values in tests

---

## Migration Guide

**For Existing Contracts:**

1. **Add locked_odds to existing matches:**
```rust
// For each existing match without locked_odds:
match_data.locked_odds = Some(LockedOdds {
    home_odds: match_data.home_odds,  // Use current odds
    away_odds: match_data.away_odds,
    draw_odds: match_data.draw_odds,
    locked: true,
});
```

2. **Initialize LP shares for existing pool:**
```rust
// For existing liquidity pool:
pool.total_shares = pool.total_liquidity;  // 1:1 initial ratio
pool.minimum_liquidity = 1000;  // Lock 1000 shares
```

3. **Update spell files:**
- Create 17-create-lp-share.yaml
- Create 18-deposit-liquidity.yaml
- Create 19-withdraw-liquidity.yaml

---

## Expected Improvements

**User Experience:**
- ✅ 100% payout certainty (locked odds)
- ✅ No timing disadvantage
- ✅ Clear max payout shown upfront

**LP Experience:**
- ✅ Can deposit and earn yield
- ✅ Real-time P&L visibility
- ✅ Withdrawal anytime (if liquid)
- ✅ Protected from catastrophic losses

**Protocol Health:**
- ✅ LP can't be drained by mega-payouts
- ✅ Per-round limits prevent insolvency
- ✅ Parlay multipliers capped at 1.25x
- ✅ Withdrawal fees prevent LP drain

**Competitiveness:**
- ✅ Matches Solidity feature parity
- ✅ Keeps Bitcoin-native advantages
- ✅ Adds unique features (badges, SystemBet)
- ✅ Best of both worlds

---

## Performance Impact

**Gas/Transaction Size:**
- Locked odds: +64 bytes per match
- LP shares: +128 bytes per LP
- Tracking fields: +64 bytes per round
- **Total: ~256 bytes overhead per round**

**Computation:**
- Odds compression: O(1) - trivial
- LP share calculation: O(1) - simple division
- Profit tracking: O(1) - direct lookup
- **Minimal performance impact**

**UTXO Impact:**
- Each LP share = 1 new UTXO
- 100 LPs = 100 UTXOs
- Manageable for Bitcoin

---

## Security Considerations

**Locked Odds:**
- ✅ No oracle manipulation (odds set upfront)
- ✅ No timing attacks
- ⚠️ Protocol must fund large seed amounts

**LP Shares:**
- ✅ Withdrawal fee prevents drain attacks
- ✅ Minimum liquidity locked forever
- ⚠️ First LP advantage (gets best ratio)

**Risk Caps:**
- ✅ Multiple safety layers
- ✅ Per-bet, per-round, per-multiplier
- ⚠️ Users might hit caps on large bets

**Profit Tracking:**
- ✅ Read-only (no state changes)
- ✅ Calculated on-demand
- ✅ No manipulation possible

---

## Next Steps

1. Review this plan with team
2. Get approval on breaking changes
3. Implement in feature branch
4. Write comprehensive tests
5. Audit new code paths
6. Deploy to testnet
7. Migrate existing data
8. Update documentation
9. Train frontend team
10. Production deployment

**Estimated Total Time: 7 weeks**
**Risk Level: Medium (breaking changes, but well-tested pattern)**
**Benefit Level: High (major UX and LP improvements)**
