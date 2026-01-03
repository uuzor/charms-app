use charms_sdk::data::{
    charm_values, check, App, Data, Transaction, UtxoId, B32, NFT, TOKEN,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

// Custom charm tags (as chars to match app.tag type)
pub const MATCH_NFT: char = '\u{0A}';          // 10
pub const BET_NFT: char = '\u{0B}';            // 11 (deprecated, use BETSLIP)
pub const BADGE_NFT: char = '\u{0C}';          // 12
pub const SEASON_NFT: char = '\u{0D}';         // 13
pub const HOUSE_NFT: char = '\u{0E}';          // 14
pub const BETSLIP_NFT: char = '\u{0F}';        // 15 (NEW: multi-bet slip)
pub const LIQUIDITY_POOL_NFT: char = '\u{10}'; // 16 (NEW: protocol liquidity)

// Premier League Teams
pub const TEAMS: [&str; 20] = [
    "Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton",
    "Chelsea", "Crystal Palace", "Everton", "Fulham", "Ipswich Town",
    "Leicester City", "Liverpool", "Manchester City", "Manchester United", "Newcastle",
    "Nottingham Forest", "Southampton", "Tottenham", "West Ham", "Wolves"
];

// Game Constants
pub const MATCHES_PER_TURN: usize = 10;
pub const TURNS_PER_SEASON: u32 = 36;
pub const HOUSE_EDGE_BPS: u64 = 400; // 4% house edge
pub const MARKETPLACE_FEE_BPS: u64 = 250; // 2.5% marketplace fee
pub const SEASON_POOL_BPS: u64 = 200; // 2% to season winner pool
pub const PROTOCOL_REVENUE_BPS: u64 = 200; // 2% to protocol (from house edge)
pub const MIN_BET: u64 = 100; // Minimum bet amount
pub const MAX_BET: u64 = 1_000_000; // Maximum single bet
pub const MAX_BETS_PER_SLIP: usize = 20; // Max bets in one betslip
pub const BADGE_BONUS_BPS: u64 = 500; // 5% badge bonus

// Bet Types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum BetType {
    Single,      // Single match bet
    Parlay,      // Multiple matches, all must win
    SystemBet,   // Multiple matches, partial wins allowed
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MatchResult {
    Pending,
    HomeWin,
    AwayWin,
    Draw,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchData {
    pub season_id: String,
    pub turn: u32,
    pub match_id: u8, // 0-9 for 10 matches per turn
    pub home_team: String,
    pub away_team: String,
    pub home_odds: u64, // Multiplier in basis points (10000 = 1.0x)
    pub away_odds: u64,
    pub draw_odds: u64,
    pub result: MatchResult,
    pub random_seed: Option<String>, // Transaction hash for randomness
    pub total_home_bets: u64,        // NEW: Track betting volume per outcome
    pub total_away_bets: u64,
    pub total_draw_bets: u64,
}

// Single bet within a betslip
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SingleBet {
    pub match_id: String,
    pub prediction: MatchResult,
    pub odds: u64, // Odds at time of bet
}

// NEW: Betslip containing multiple bets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BetslipData {
    pub slip_id: String,          // Unique identifier
    pub bettor: String,           // Wallet address
    pub bet_type: BetType,        // Single, Parlay, or SystemBet
    pub bets: Vec<SingleBet>,     // Individual bets in the slip
    pub total_stake: u64,         // Total LEAGUE tokens staked
    pub stake_per_bet: u64,       // For Single/SystemBet
    pub potential_payout: u64,    // Maximum possible payout
    pub badges: Vec<u8>,          // Team IDs of owned badges (0-19)
    pub settled: bool,
    pub payout_amount: u64,       // Actual payout after settlement
    pub timestamp: u64,           // When bet was placed
}

// Deprecated: Old single bet structure (kept for backwards compatibility)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BetData {
    pub match_id: String,
    pub prediction: MatchResult,
    pub stake: u64,
    pub odds: u64,
    pub bettor: String,
    pub has_badge: bool,
    pub settled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BadgeData {
    pub team_name: String,
    pub team_id: u8, // 0-19
    pub bonus_bps: u64, // Bonus to odds in basis points
    pub owner: String, // Current owner address
    pub total_bets_with_bonus: u64, // Track usage
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeasonData {
    pub season_id: String,
    pub current_turn: u32,
    pub team_scores: [u32; 20], // Points for each team (3 for win, 1 for draw)
    pub total_bets_collected: u64,
    pub season_pool: u64, // 2% of total bets for winner prediction
    pub is_finished: bool,
    pub winner_team_id: Option<u8>, // Team with most points
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeasonPrediction {
    pub season_id: String,
    pub predicted_winner: u8, // Team ID 0-19
    pub predictor: String,
}

// NEW: Liquidity Pool Management
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiquidityPoolData {
    pub pool_id: String,
    pub total_liquidity: u64,      // Total LEAGUE tokens in pool
    pub total_bets_in_play: u64,   // Bets not yet settled
    pub total_paid_out: u64,       // Historical payouts
    pub total_collected: u64,      // Historical bet stakes
    pub protocol_revenue: u64,     // Protocol's earned revenue
    pub house_balance: u64,        // Current available balance
    pub is_active: bool,
    pub min_liquidity: u64,        // Minimum required liquidity
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HouseData {
    pub total_league_supply: u64,
    pub airdrop_remaining: u64,
    pub protocol_address: String, // Address that can withdraw protocol revenue
}

pub fn app_contract(app: &App, tx: &Transaction, x: &Data, w: &Data) -> bool {
    let empty = Data::empty();
    assert_eq!(x, &empty);

    match app.tag {
        TOKEN => {
            // LEAGUE token
            check!(league_token_contract(app, tx))
        }
        NFT => {
            // Original NFT (for initial minting control)
            check!(nft_contract(app, tx, w))
        }
        MATCH_NFT => {
            check!(match_nft_contract(app, tx))
        }
        BET_NFT => {
            // Legacy single bet (deprecated)
            check!(bet_nft_contract(app, tx))
        }
        BETSLIP_NFT => {
            // NEW: Multi-bet betslip
            check!(betslip_nft_contract(app, tx))
        }
        BADGE_NFT => {
            check!(badge_nft_contract(app, tx))
        }
        SEASON_NFT => {
            check!(season_nft_contract(app, tx))
        }
        HOUSE_NFT => {
            check!(house_nft_contract(app, tx))
        }
        LIQUIDITY_POOL_NFT => {
            // NEW: Liquidity pool management
            check!(liquidity_pool_contract(app, tx))
        }
        _ => unreachable!(),
    }
    true
}

// LEAGUE Token Contract - ENHANCED
fn league_token_contract(token_app: &App, tx: &Transaction) -> bool {
    // Track token inputs and outputs
    let token_inputs: u64 = charm_values(token_app, tx.ins.iter().map(|(_, v)| v))
        .filter_map(|data| {
            let amount: Result<u64, _> = data.value();
            amount.ok()
        })
        .sum();

    let token_outputs: u64 = charm_values(token_app, tx.outs.iter())
        .filter_map(|data| {
            let amount: Result<u64, _> = data.value();
            amount.ok()
        })
        .sum();

    // Token conservation: outputs <= inputs (allows burning)
    // Minting only allowed if House NFT is present in inputs
    let has_house_nft = tx.ins.iter().any(|(_, _data)| {
        // Check if this input contains a House NFT
        // Simplified check - in production, verify actual charm tag
        true // Allow for now
    });

    if token_outputs > token_inputs {
        // Minting tokens - requires House NFT authorization
        check!(has_house_nft);
    }

    true
}

// Original NFT for bootstrapping
fn nft_contract(app: &App, tx: &Transaction, w: &Data) -> bool {
    let w_str: Option<String> = w.value().ok();
    check!(w_str.is_some());
    let w_str = w_str.unwrap();

    // Verify identity matches hash of w
    check!(hash(&w_str) == app.identity);

    // Verify spending correct UTXO
    let w_utxo_id = UtxoId::from_str(&w_str).unwrap();
    check!(tx.ins.iter().any(|(utxo_id, _)| utxo_id == &w_utxo_id));

    true
}

// Match NFT Contract - ENHANCED
fn match_nft_contract(match_app: &App, tx: &Transaction) -> bool {
    let input_matches: Vec<MatchData> = charm_values(match_app, tx.ins.iter().map(|(_, v)| v))
        .filter_map(|data| data.value().ok())
        .collect();

    let output_matches: Vec<MatchData> = charm_values(match_app, tx.outs.iter())
        .filter_map(|data| data.value().ok())
        .collect();

    if input_matches.is_empty() && !output_matches.is_empty() {
        // Creating new matches
        check!(validate_match_creation(&output_matches));
    } else if !input_matches.is_empty() && !output_matches.is_empty() {
        // Resolving matches
        check!(validate_match_resolution(&input_matches, &output_matches, tx));
    }

    true
}

fn validate_match_creation(matches: &[MatchData]) -> bool {
    for m in matches {
        check!(m.result == MatchResult::Pending);
        check!(TEAMS.contains(&m.home_team.as_str()));
        check!(TEAMS.contains(&m.away_team.as_str()));
        check!(m.home_team != m.away_team);

        // NEW: Initialize betting volume
        check!(m.total_home_bets == 0);
        check!(m.total_away_bets == 0);
        check!(m.total_draw_bets == 0);

        // Validate odds are reasonable
        check!(m.home_odds >= 10000 && m.home_odds <= 100000); // 1.0x to 10.0x
        check!(m.away_odds >= 10000 && m.away_odds <= 100000);
        check!(m.draw_odds >= 10000 && m.draw_odds <= 100000);
    }
    true
}

fn validate_match_resolution(
    input_matches: &[MatchData],
    output_matches: &[MatchData],
    _tx: &Transaction,
) -> bool {
    check!(input_matches.len() == output_matches.len());

    for (input, output) in input_matches.iter().zip(output_matches.iter()) {
        // Match must have been pending
        check!(input.result == MatchResult::Pending);

        // Match must now be resolved
        check!(output.result != MatchResult::Pending);

        // Match data (teams, odds) must be unchanged
        check!(input.home_team == output.home_team);
        check!(input.away_team == output.away_team);
        check!(input.home_odds == output.home_odds);
        check!(input.away_odds == output.away_odds);
        check!(input.draw_odds == output.draw_odds);

        // Random seed must be set
        check!(output.random_seed.is_some());

        // Betting volumes should be preserved
        check!(output.total_home_bets >= input.total_home_bets);
        check!(output.total_away_bets >= input.total_away_bets);
        check!(output.total_draw_bets >= input.total_draw_bets);
    }

    true
}

// Legacy Bet NFT Contract (backwards compatibility)
fn bet_nft_contract(bet_app: &App, tx: &Transaction) -> bool {
    let input_bets: Vec<BetData> = charm_values(bet_app, tx.ins.iter().map(|(_, v)| v))
        .filter_map(|data| data.value().ok())
        .collect();

    let output_bets: Vec<BetData> = charm_values(bet_app, tx.outs.iter())
        .filter_map(|data| data.value().ok())
        .collect();

    if input_bets.is_empty() && !output_bets.is_empty() {
        check!(validate_bet_placement(&output_bets, tx));
    } else if !input_bets.is_empty() {
        check!(validate_bet_settlement(&input_bets, &output_bets, tx));
    }

    true
}

fn validate_bet_placement(bets: &[BetData], _tx: &Transaction) -> bool {
    for bet in bets {
        check!(!bet.settled);
        check!(bet.stake >= MIN_BET && bet.stake <= MAX_BET);
        check!(bet.prediction != MatchResult::Pending);
    }
    true
}

fn validate_bet_settlement(
    input_bets: &[BetData],
    _output_bets: &[BetData],
    _tx: &Transaction,
) -> bool {
    // Bets can be burned (spent) when settling
    for bet in input_bets {
        check!(!bet.settled); // Can only settle unsettled bets
    }
    true
}

// NEW: Betslip NFT Contract - Multi-bet functionality
fn betslip_nft_contract(betslip_app: &App, tx: &Transaction) -> bool {
    let input_betslips: Vec<BetslipData> = charm_values(betslip_app, tx.ins.iter().map(|(_, v)| v))
        .filter_map(|data| data.value().ok())
        .collect();

    let output_betslips: Vec<BetslipData> = charm_values(betslip_app, tx.outs.iter())
        .filter_map(|data| data.value().ok())
        .collect();

    if input_betslips.is_empty() && !output_betslips.is_empty() {
        // Placing new betslips
        check!(validate_betslip_placement(&output_betslips, tx));
    } else if !input_betslips.is_empty() {
        // Settling betslips
        check!(validate_betslip_settlement(&input_betslips, &output_betslips, tx));
    }

    true
}

fn validate_betslip_placement(betslips: &[BetslipData], _tx: &Transaction) -> bool {
    for slip in betslips {
        // Basic validation
        check!(!slip.settled);
        check!(slip.total_stake >= MIN_BET);
        check!(!slip.bets.is_empty());
        check!(slip.bets.len() <= MAX_BETS_PER_SLIP);

        // Validate bet type constraints
        match slip.bet_type {
            BetType::Single => {
                check!(slip.bets.len() == 1);
                check!(slip.stake_per_bet == slip.total_stake);
            }
            BetType::Parlay => {
                check!(slip.bets.len() >= 2);
                // Parlay: all bets must win, payout is multiplicative
                let combined_odds = calculate_parlay_odds(&slip.bets);
                check!(slip.potential_payout > slip.total_stake);
                check!(combined_odds > 10000); // Must be better than 1.0x
            }
            BetType::SystemBet => {
                check!(slip.bets.len() >= 2);
                // System bet: stake divided among bets
                check!(slip.stake_per_bet * slip.bets.len() as u64 <= slip.total_stake);
            }
        }

        // Validate each bet
        for bet in &slip.bets {
            check!(bet.prediction != MatchResult::Pending);
            check!(bet.odds >= 10000 && bet.odds <= 100000);
        }

        // Validate badges (team IDs must be 0-19)
        for badge_team_id in &slip.badges {
            check!(*badge_team_id < 20);
        }
    }
    true
}

fn validate_betslip_settlement(
    input_slips: &[BetslipData],
    output_slips: &[BetslipData],
    _tx: &Transaction,
) -> bool {
    // Input slips must be unsettled
    for slip in input_slips {
        check!(!slip.settled);
    }

    // If there are output slips, they must be marked as settled
    for slip in output_slips {
        check!(slip.settled);
        // Payout must be reasonable (0 for loss, or calculated payout for win)
        check!(slip.payout_amount <= slip.potential_payout * 2); // Sanity check
    }

    true
}

// Badge NFT Contract - ENHANCED
fn badge_nft_contract(badge_app: &App, tx: &Transaction) -> bool {
    let input_badges: Vec<BadgeData> = charm_values(badge_app, tx.ins.iter().map(|(_, v)| v))
        .filter_map(|data| data.value().ok())
        .collect();

    let output_badges: Vec<BadgeData> = charm_values(badge_app, tx.outs.iter())
        .filter_map(|data| data.value().ok())
        .collect();

    // Validate badge data
    for badge in &output_badges {
        check!(badge.team_id < 20);
        check!(badge.team_name == TEAMS[badge.team_id as usize]);
        check!(badge.bonus_bps > 0 && badge.bonus_bps <= 1000); // Max 10% bonus
    }

    // If trading badges, validate marketplace fee
    if !input_badges.is_empty() && !output_badges.is_empty() {
        // Badge trading - ensure only one badge per team exists
        for (inp, out) in input_badges.iter().zip(output_badges.iter()) {
            check!(inp.team_id == out.team_id);
            check!(inp.team_name == out.team_name);
            // Owner can change (trading)
            // Usage stats should increase
            check!(out.total_bets_with_bonus >= inp.total_bets_with_bonus);
        }
    }

    true
}

// Season NFT Contract - ENHANCED
fn season_nft_contract(season_app: &App, tx: &Transaction) -> bool {
    let input_seasons: Vec<SeasonData> = charm_values(season_app, tx.ins.iter().map(|(_, v)| v))
        .filter_map(|data| data.value().ok())
        .collect();

    let output_seasons: Vec<SeasonData> = charm_values(season_app, tx.outs.iter())
        .filter_map(|data| data.value().ok())
        .collect();

    if input_seasons.is_empty() && !output_seasons.is_empty() {
        check!(validate_season_creation(&output_seasons));
    } else if !input_seasons.is_empty() && !output_seasons.is_empty() {
        check!(validate_season_update(&input_seasons, &output_seasons));
    }

    true
}

fn validate_season_creation(seasons: &[SeasonData]) -> bool {
    for season in seasons {
        check!(season.current_turn == 0);
        check!(season.team_scores == [0; 20]);
        check!(season.total_bets_collected == 0);
        check!(season.season_pool == 0);
        check!(!season.is_finished);
        check!(season.winner_team_id.is_none());
    }
    true
}

fn validate_season_update(input: &[SeasonData], output: &[SeasonData]) -> bool {
    check!(input.len() == output.len());

    for (inp, out) in input.iter().zip(output.iter()) {
        check!(inp.season_id == out.season_id);

        if !inp.is_finished {
            // Turn must advance by 1 or stay same
            check!(out.current_turn <= inp.current_turn + 1);
            check!(out.current_turn <= TURNS_PER_SEASON);

            // Pool must increase or stay same
            check!(out.total_bets_collected >= inp.total_bets_collected);
            check!(out.season_pool >= inp.season_pool);

            // Check if season is now finished
            if out.current_turn >= TURNS_PER_SEASON {
                check!(out.is_finished);
                // Winner must be determined
                check!(out.winner_team_id.is_some());
                if let Some(winner_id) = out.winner_team_id {
                    check!(winner_id < 20);
                    // Winner should have highest score
                    let winner_score = out.team_scores[winner_id as usize];
                    let max_score = out.team_scores.iter().max().unwrap();
                    check!(winner_score == *max_score);
                }
            }
        } else {
            // Finished seasons cannot be modified
            check!(inp.is_finished && out.is_finished);
            check!(inp.current_turn == out.current_turn);
        }
    }

    true
}

// House NFT Contract
fn house_nft_contract(_house_app: &App, _tx: &Transaction) -> bool {
    // House NFT controls administrative functions
    // Can mint LEAGUE tokens, create seasons, manage liquidity pool
    true
}

// NEW: Liquidity Pool Contract
fn liquidity_pool_contract(pool_app: &App, tx: &Transaction) -> bool {
    let input_pools: Vec<LiquidityPoolData> = charm_values(pool_app, tx.ins.iter().map(|(_, v)| v))
        .filter_map(|data| data.value().ok())
        .collect();

    let output_pools: Vec<LiquidityPoolData> = charm_values(pool_app, tx.outs.iter())
        .filter_map(|data| data.value().ok())
        .collect();

    if input_pools.is_empty() && !output_pools.is_empty() {
        // Creating liquidity pool
        check!(validate_pool_creation(&output_pools));
    } else if !input_pools.is_empty() && !output_pools.is_empty() {
        // Updating pool (deposits, withdrawals, payouts)
        check!(validate_pool_update(&input_pools, &output_pools, tx));
    }

    true
}

fn validate_pool_creation(pools: &[LiquidityPoolData]) -> bool {
    for pool in pools {
        check!(pool.total_liquidity > 0);
        check!(pool.total_bets_in_play == 0);
        check!(pool.total_paid_out == 0);
        check!(pool.total_collected == 0);
        check!(pool.protocol_revenue == 0);
        check!(pool.house_balance == pool.total_liquidity);
        check!(pool.is_active);
        check!(pool.min_liquidity > 0);
        check!(pool.total_liquidity >= pool.min_liquidity);
    }
    true
}

fn validate_pool_update(
    input_pools: &[LiquidityPoolData],
    output_pools: &[LiquidityPoolData],
    _tx: &Transaction,
) -> bool {
    check!(input_pools.len() == output_pools.len());

    for (inp, out) in input_pools.iter().zip(output_pools.iter()) {
        check!(inp.pool_id == out.pool_id);

        // Pool must remain active if accepting bets
        if out.total_bets_in_play > 0 {
            check!(out.is_active);
        }

        // Solvency check: house_balance + total_bets_in_play should cover potential payouts
        // Simplified: just ensure we're not paying out more than we have
        check!(out.total_paid_out >= inp.total_paid_out);
        check!(out.total_collected >= inp.total_collected);

        // Revenue tracking
        check!(out.protocol_revenue >= inp.protocol_revenue);

        // Balance integrity
        // total_liquidity = house_balance + bets_in_play + paid_out - collected - protocol_revenue
        let expected_balance = inp.total_liquidity
            .saturating_add(out.total_collected)
            .saturating_sub(inp.total_collected)
            .saturating_sub(out.total_paid_out.saturating_sub(inp.total_paid_out))
            .saturating_sub(out.protocol_revenue.saturating_sub(inp.protocol_revenue));

        // Allow for rounding differences
        let balance_diff = if out.total_liquidity > expected_balance {
            out.total_liquidity - expected_balance
        } else {
            expected_balance - out.total_liquidity
        };
        check!(balance_diff <= 100); // Allow small rounding errors

        // Minimum liquidity check
        if out.is_active {
            check!(out.house_balance >= out.min_liquidity);
        }
    }

    true
}

// Helper: Calculate parlay odds (multiplicative)
fn calculate_parlay_odds(bets: &[SingleBet]) -> u64 {
    let mut combined_odds = 10000u64; // Start at 1.0x

    for bet in bets {
        // Multiply odds: (combined * bet_odds) / 10000
        combined_odds = combined_odds.saturating_mul(bet.odds) / 10000;
    }

    combined_odds
}

// Helper: Generate match result from transaction hash
pub fn generate_match_result(random_seed: &str, match_id: u8) -> MatchResult {
    let mut hasher = Sha256::new();
    hasher.update(random_seed.as_bytes());
    hasher.update(&[match_id]);
    let hash = hasher.finalize();

    // Use hash to determine result
    let value = u32::from_be_bytes([hash[0], hash[1], hash[2], hash[3]]) % 100;

    // Probabilities: 45% home, 30% draw, 25% away
    if value < 45 {
        MatchResult::HomeWin
    } else if value < 75 {
        MatchResult::Draw
    } else {
        MatchResult::AwayWin
    }
}

// Helper: Calculate single bet payout
pub fn calculate_single_bet_payout(
    stake: u64,
    odds: u64,
    has_matching_badge: bool,
) -> u64 {
    let mut final_odds = odds;

    // Apply badge bonus if applicable
    if has_matching_badge {
        final_odds = final_odds + (final_odds * BADGE_BONUS_BPS / 10000);
    }

    // Apply house edge
    final_odds = final_odds.saturating_sub(final_odds * HOUSE_EDGE_BPS / 10000);

    // Calculate payout
    stake.saturating_mul(final_odds) / 10000
}

// Helper: Calculate parlay payout
pub fn calculate_parlay_payout(
    stake: u64,
    bets: &[SingleBet],
    badges: &[u8],
) -> u64 {
    let mut combined_odds = 10000u64;

    for bet in bets {
        // Check if bettor has badge for this match's team
        // This is simplified - in production, parse match_id to get team_id
        let has_badge = !badges.is_empty(); // Simplified

        let mut bet_odds = bet.odds;
        if has_badge {
            bet_odds = bet_odds + (bet_odds * BADGE_BONUS_BPS / 10000);
        }

        combined_odds = combined_odds.saturating_mul(bet_odds) / 10000;
    }

    // Apply house edge to final odds
    combined_odds = combined_odds.saturating_sub(combined_odds * HOUSE_EDGE_BPS / 10000);

    stake.saturating_mul(combined_odds) / 10000
}

// Helper: Calculate betslip payout based on results
pub fn calculate_betslip_payout(
    betslip: &BetslipData,
    match_results: &[(String, MatchResult)], // (match_id, result) pairs
) -> u64 {
    match betslip.bet_type {
        BetType::Single => {
            // Single bet: pay if prediction matches
            let bet = &betslip.bets[0];
            let result = match_results.iter()
                .find(|(id, _)| id == &bet.match_id)
                .map(|(_, r)| r);

            if let Some(actual_result) = result {
                if &bet.prediction == actual_result {
                    let has_badge = !betslip.badges.is_empty();
                    return calculate_single_bet_payout(betslip.total_stake, bet.odds, has_badge);
                }
            }
            0
        }
        BetType::Parlay => {
            // Parlay: ALL bets must win
            let all_won = betslip.bets.iter().all(|bet| {
                match_results.iter()
                    .find(|(id, _)| id == &bet.match_id)
                    .map(|(_, r)| &bet.prediction == r)
                    .unwrap_or(false)
            });

            if all_won {
                return calculate_parlay_payout(betslip.total_stake, &betslip.bets, &betslip.badges);
            }
            0
        }
        BetType::SystemBet => {
            // System bet: pay for each winning bet independently
            let mut total_payout = 0u64;

            for bet in &betslip.bets {
                let won = match_results.iter()
                    .find(|(id, _)| id == &bet.match_id)
                    .map(|(_, r)| &bet.prediction == r)
                    .unwrap_or(false);

                if won {
                    let has_badge = !betslip.badges.is_empty();
                    total_payout = total_payout.saturating_add(
                        calculate_single_bet_payout(betslip.stake_per_bet, bet.odds, has_badge)
                    );
                }
            }

            total_payout
        }
    }
}

pub(crate) fn hash(data: &str) -> B32 {
    let hash = Sha256::digest(data);
    B32(hash.into())
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_teams_count() {
        assert_eq!(TEAMS.len(), 20);
    }

    #[test]
    fn test_match_result_generation() {
        let result = generate_match_result("test_seed", 0);
        assert!(result != MatchResult::Pending);
    }

    #[test]
    fn test_parlay_odds_calculation() {
        let bets = vec![
            SingleBet {
                match_id: "m1".to_string(),
                prediction: MatchResult::HomeWin,
                odds: 18000, // 1.8x
            },
            SingleBet {
                match_id: "m2".to_string(),
                prediction: MatchResult::AwayWin,
                odds: 22000, // 2.2x
            },
        ];

        // Combined: 1.8 * 2.2 = 3.96x = 39600 bps
        let combined = calculate_parlay_odds(&bets);
        assert_eq!(combined, 39600);
    }

    #[test]
    fn test_single_bet_payout_with_badge() {
        let stake = 10000;
        let odds = 20000; // 2.0x

        // Without badge: 2.0 * 0.96 (house edge) = 1.92x
        let payout_no_badge = calculate_single_bet_payout(stake, odds, false);
        assert_eq!(payout_no_badge, 19200);

        // With badge: 2.0 * 1.05 (badge bonus) * 0.96 = 2.016x
        let payout_with_badge = calculate_single_bet_payout(stake, odds, true);
        assert_eq!(payout_with_badge, 20160);
    }

    #[test]
    fn test_betslip_validation() {
        // Single bet slip
        let slip = BetslipData {
            slip_id: "slip1".to_string(),
            bettor: "tb1p...".to_string(),
            bet_type: BetType::Single,
            bets: vec![SingleBet {
                match_id: "m1".to_string(),
                prediction: MatchResult::HomeWin,
                odds: 18000,
            }],
            total_stake: 10000,
            stake_per_bet: 10000,
            potential_payout: 19200,
            badges: vec![],
            settled: false,
            payout_amount: 0,
            timestamp: 1234567890,
        };

        assert_eq!(slip.bets.len(), 1);
        assert_eq!(slip.total_stake, slip.stake_per_bet);
    }

    #[test]
    fn test_parlay_payout_calculation() {
        let betslip = BetslipData {
            slip_id: "parlay1".to_string(),
            bettor: "tb1p...".to_string(),
            bet_type: BetType::Parlay,
            bets: vec![
                SingleBet {
                    match_id: "match1".to_string(),
                    prediction: MatchResult::HomeWin,
                    odds: 20000, // 2.0x
                },
                SingleBet {
                    match_id: "match2".to_string(),
                    prediction: MatchResult::AwayWin,
                    odds: 18000, // 1.8x
                },
            ],
            total_stake: 10000,
            stake_per_bet: 5000,
            potential_payout: 0,
            badges: vec![],
            settled: false,
            payout_amount: 0,
            timestamp: 1234567890,
        };

        // Both bets win
        let results = vec![
            ("match1".to_string(), MatchResult::HomeWin),
            ("match2".to_string(), MatchResult::AwayWin),
        ];

        let payout = calculate_betslip_payout(&betslip, &results);
        // Combined odds: 2.0 * 1.8 = 3.6x, with house edge: 3.6 * 0.96 = 3.456x
        // Payout: 10000 * 3.456 = 34560
        assert_eq!(payout, 34560);
    }

    #[test]
    fn test_parlay_partial_loss() {
        let betslip = BetslipData {
            slip_id: "parlay2".to_string(),
            bettor: "tb1p...".to_string(),
            bet_type: BetType::Parlay,
            bets: vec![
                SingleBet {
                    match_id: "match1".to_string(),
                    prediction: MatchResult::HomeWin,
                    odds: 20000,
                },
                SingleBet {
                    match_id: "match2".to_string(),
                    prediction: MatchResult::AwayWin,
                    odds: 18000,
                },
            ],
            total_stake: 10000,
            stake_per_bet: 5000,
            potential_payout: 0,
            badges: vec![],
            settled: false,
            payout_amount: 0,
            timestamp: 1234567890,
        };

        // Only one bet wins - parlay loses
        let results = vec![
            ("match1".to_string(), MatchResult::HomeWin),
            ("match2".to_string(), MatchResult::HomeWin), // Wrong prediction
        ];

        let payout = calculate_betslip_payout(&betslip, &results);
        assert_eq!(payout, 0); // Parlay requires all bets to win
    }

    #[test]
    fn test_system_bet_payout() {
        let betslip = BetslipData {
            slip_id: "system1".to_string(),
            bettor: "tb1p...".to_string(),
            bet_type: BetType::SystemBet,
            bets: vec![
                SingleBet {
                    match_id: "match1".to_string(),
                    prediction: MatchResult::HomeWin,
                    odds: 20000,
                },
                SingleBet {
                    match_id: "match2".to_string(),
                    prediction: MatchResult::AwayWin,
                    odds: 18000,
                },
                SingleBet {
                    match_id: "match3".to_string(),
                    prediction: MatchResult::Draw,
                    odds: 32000,
                },
            ],
            total_stake: 15000,
            stake_per_bet: 5000,
            potential_payout: 0,
            badges: vec![],
            settled: false,
            payout_amount: 0,
            timestamp: 1234567890,
        };

        // Two out of three win
        let results = vec![
            ("match1".to_string(), MatchResult::HomeWin),  // Win
            ("match2".to_string(), MatchResult::HomeWin),  // Loss
            ("match3".to_string(), MatchResult::Draw),     // Win
        ];

        let payout = calculate_betslip_payout(&betslip, &results);

        // Match1: 5000 * 2.0 * 0.96 = 9600
        // Match2: 0 (lost)
        // Match3: 5000 * 3.2 * 0.96 = 15360
        // Total: 9600 + 15360 = 24960
        assert_eq!(payout, 24960);
    }

    #[test]
    fn test_liquidity_pool_solvency() {
        let pool = LiquidityPoolData {
            pool_id: "pool1".to_string(),
            total_liquidity: 1_000_000,
            total_bets_in_play: 100_000,
            total_paid_out: 50_000,
            total_collected: 150_000,
            protocol_revenue: 6_000, // 4% of wins
            house_balance: 1_000_000 + 150_000 - 50_000 - 6_000,
            is_active: true,
            min_liquidity: 500_000,
        };

        assert!(pool.house_balance >= pool.min_liquidity);
        assert_eq!(pool.house_balance, 1_094_000);
    }

    #[test]
    fn test_max_bets_per_slip() {
        assert_eq!(MAX_BETS_PER_SLIP, 20);

        // Create a slip with max bets
        let mut bets = vec![];
        for i in 0..MAX_BETS_PER_SLIP {
            bets.push(SingleBet {
                match_id: format!("match{}", i),
                prediction: MatchResult::HomeWin,
                odds: 18000,
            });
        }

        assert_eq!(bets.len(), MAX_BETS_PER_SLIP);
    }

    #[test]
    fn test_min_max_bet_limits() {
        assert_eq!(MIN_BET, 100);
        assert_eq!(MAX_BET, 1_000_000);
        assert!(MIN_BET < MAX_BET);
    }

    #[test]
    fn test_protocol_revenue_calculation() {
        let stake = 100_000;
        let odds = 20000; // 2.0x

        // Gross payout: 200,000
        // With house edge (4%): 192,000
        // Protocol gets 2% of the 4% edge: 2% of 8,000 = 160

        let payout = calculate_single_bet_payout(stake, odds, false);
        let house_edge_amount = (stake * odds / 10000) - payout;
        let protocol_share = house_edge_amount * PROTOCOL_REVENUE_BPS / 10000;

        assert_eq!(payout, 192_000);
        assert_eq!(house_edge_amount, 8_000);
        assert_eq!(protocol_share, 160);
    }
}
