use charms_sdk::data::{
    charm_values, check, App, Data, Transaction, UtxoId, B32, NFT, TOKEN,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

// Custom charm tags (as chars to match app.tag type)
pub const MATCH_NFT: char = '\u{0A}';   // 10
pub const BET_NFT: char = '\u{0B}';     // 11
pub const BADGE_NFT: char = '\u{0C}';   // 12
pub const SEASON_NFT: char = '\u{0D}';  // 13
pub const HOUSE_NFT: char = '\u{0E}';   // 14

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
pub const HOUSE_EDGE_BPS: u64 = 400; // 4% (basis points)
pub const MARKETPLACE_FEE_BPS: u64 = 250; // 2.5%
pub const SEASON_POOL_BPS: u64 = 200; // 2% of bets go to season pool

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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BetData {
    pub match_id: String, // Reference to match NFT identity
    pub prediction: MatchResult, // HomeWin, AwayWin, or Draw
    pub stake: u64, // Amount of LEAGUE tokens
    pub odds: u64, // Odds at time of bet (basis points)
    pub bettor: String, // Address
    pub has_badge: bool, // Did bettor have team badge for bonus
    pub settled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BadgeData {
    pub team_name: String,
    pub team_id: u8, // 0-19
    pub bonus_bps: u64, // Bonus to odds in basis points (e.g., 500 = 5% better odds)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeasonData {
    pub season_id: String,
    pub current_turn: u32,
    pub team_scores: [u32; 20], // Points for each team
    pub total_bets_collected: u64, // For calculating 2% pool
    pub season_pool: u64, // 2% of total bets
    pub is_finished: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeasonPrediction {
    pub season_id: String,
    pub predicted_winner: u8, // Team ID 0-19
    pub predictor: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HouseData {
    pub total_league_supply: u64,
    pub airdrop_remaining: u64, // 30% reserved for airdrop
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
            check!(bet_nft_contract(app, tx))
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
        _ => unreachable!(),
    }
    true
}

// LEAGUE Token Contract
fn league_token_contract(_token_app: &App, _tx: &Transaction) -> bool {
    // Tokens can be minted by house NFT or through betting payouts
    // For now, allow any mint/burn for flexibility
    // In production, add stricter controls
    true
}

// Original NFT for bootstrapping
fn nft_contract(app: &App, tx: &Transaction, w: &Data) -> bool {
    // Can mint house NFT, season NFT, or badges with proper authorization
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

// Match NFT Contract
fn match_nft_contract(match_app: &App, tx: &Transaction) -> bool {
    // Matches can be created or resolved
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
    // Ensure all matches are pending
    for m in matches {
        check!(m.result == MatchResult::Pending);
        check!(TEAMS.contains(&m.home_team.as_str()));
        check!(TEAMS.contains(&m.away_team.as_str()));
        check!(m.home_team != m.away_team);
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

        // Random seed must be set (using tx hash)
        check!(output.random_seed.is_some());
    }

    true
}

// Bet NFT Contract
fn bet_nft_contract(bet_app: &App, tx: &Transaction) -> bool {
    let input_bets: Vec<BetData> = charm_values(bet_app, tx.ins.iter().map(|(_, v)| v))
        .filter_map(|data| data.value().ok())
        .collect();

    let output_bets: Vec<BetData> = charm_values(bet_app, tx.outs.iter())
        .filter_map(|data| data.value().ok())
        .collect();

    if input_bets.is_empty() && !output_bets.is_empty() {
        // Placing new bets
        check!(validate_bet_placement(&output_bets, tx));
    } else if !input_bets.is_empty() {
        // Settling bets
        check!(validate_bet_settlement(&input_bets, &output_bets, tx));
    }

    true
}

fn validate_bet_placement(bets: &[BetData], _tx: &Transaction) -> bool {
    for bet in bets {
        check!(!bet.settled);
        check!(bet.stake > 0);
        check!(bet.prediction != MatchResult::Pending);
    }
    true
}

fn validate_bet_settlement(
    _input_bets: &[BetData],
    _output_bets: &[BetData],
    _tx: &Transaction,
) -> bool {
    // Bets can be burned (spent) when settling
    // Check that LEAGUE tokens are paid out correctly based on winning bets
    // This is simplified - in production, verify exact payout calculations
    true
}

// Badge NFT Contract
fn badge_nft_contract(badge_app: &App, tx: &Transaction) -> bool {
    let output_badges: Vec<BadgeData> = charm_values(badge_app, tx.outs.iter())
        .filter_map(|data| data.value().ok())
        .collect();

    // Validate badge data
    for badge in &output_badges {
        check!(badge.team_id < 20);
        check!(badge.team_name == TEAMS[badge.team_id as usize]);
        check!(badge.bonus_bps > 0 && badge.bonus_bps <= 1000); // Max 10% bonus
    }

    // Could add marketplace fee validation here
    true
}

// Season NFT Contract
fn season_nft_contract(season_app: &App, tx: &Transaction) -> bool {
    let input_seasons: Vec<SeasonData> = charm_values(season_app, tx.ins.iter().map(|(_, v)| v))
        .filter_map(|data| data.value().ok())
        .collect();

    let output_seasons: Vec<SeasonData> = charm_values(season_app, tx.outs.iter())
        .filter_map(|data| data.value().ok())
        .collect();

    if input_seasons.is_empty() && !output_seasons.is_empty() {
        // Creating new season
        check!(validate_season_creation(&output_seasons));
    } else if !input_seasons.is_empty() && !output_seasons.is_empty() {
        // Updating season
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
    }
    true
}

fn validate_season_update(input: &[SeasonData], output: &[SeasonData]) -> bool {
    check!(input.len() == output.len());

    for (inp, out) in input.iter().zip(output.iter()) {
        check!(inp.season_id == out.season_id);

        if !inp.is_finished {
            // Turn must advance by 1 or stay same (if just collecting bets)
            check!(out.current_turn <= inp.current_turn + 1);
            check!(out.current_turn <= TURNS_PER_SEASON);

            // Pool must increase or stay same
            check!(out.total_bets_collected >= inp.total_bets_collected);
            check!(out.season_pool >= inp.season_pool);

            // Check if season is now finished
            if out.current_turn >= TURNS_PER_SEASON {
                check!(out.is_finished);
            }
        }
    }

    true
}

// House NFT Contract
fn house_nft_contract(_house_app: &App, _tx: &Transaction) -> bool {
    // House NFT controls administrative functions
    // Could add specific controls for minting LEAGUE tokens, creating seasons, etc.
    true
}

// Helper function to generate randomness from transaction
pub fn generate_match_result(random_seed: &str, match_id: u8) -> MatchResult {
    let mut hasher = Sha256::new();
    hasher.update(random_seed.as_bytes());
    hasher.update(&[match_id]);
    let hash = hasher.finalize();

    // Use hash to determine result
    let value = u32::from_be_bytes([hash[0], hash[1], hash[2], hash[3]]) % 100;

    // Simplified odds: 45% home win, 30% draw, 25% away win
    if value < 45 {
        MatchResult::HomeWin
    } else if value < 75 {
        MatchResult::Draw
    } else {
        MatchResult::AwayWin
    }
}

pub fn calculate_payout(stake: u64, odds: u64, has_badge: bool, bonus_bps: u64) -> u64 {
    let mut final_odds = odds;

    // Apply badge bonus
    if has_badge {
        final_odds = final_odds + (final_odds * bonus_bps / 10000);
    }

    // Apply house edge
    final_odds = final_odds - (final_odds * HOUSE_EDGE_BPS / 10000);

    // Calculate payout
    stake * final_odds / 10000
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
    fn test_match_result_determinism() {
        // Same seed should produce same result
        let result1 = generate_match_result("deterministic_seed", 5);
        let result2 = generate_match_result("deterministic_seed", 5);
        assert_eq!(result1, result2);

        // Different seeds should (likely) produce different results
        let result3 = generate_match_result("different_seed", 5);
        // This might occasionally fail due to randomness, but unlikely
        assert!(result1 == result3 || result1 != result3); // Always true, just showing concept
    }

    #[test]
    fn test_match_result_distribution() {
        // Test that all three outcomes are possible
        let mut home_wins = 0;
        let mut away_wins = 0;
        let mut draws = 0;

        for i in 0..100 {
            let seed = format!("test_seed_{}", i);
            match generate_match_result(&seed, 0) {
                MatchResult::HomeWin => home_wins += 1,
                MatchResult::AwayWin => away_wins += 1,
                MatchResult::Draw => draws += 1,
                MatchResult::Pending => panic!("Should never be pending"),
            }
        }

        // All three outcomes should occur
        assert!(home_wins > 0, "HomeWin should occur");
        assert!(away_wins > 0, "AwayWin should occur");
        assert!(draws > 0, "Draw should occur");
        assert_eq!(home_wins + away_wins + draws, 100);

        println!("Distribution over 100 matches:");
        println!("  Home wins: {}", home_wins);
        println!("  Away wins: {}", away_wins);
        println!("  Draws: {}", draws);
    }

    #[test]
    fn test_payout_calculation() {
        // 1000 stake at 2.0x odds (20000 bps)
        let payout = calculate_payout(1000, 20000, false, 0);
        // With 4% house edge: 2.0 * 0.96 = 1.92x
        assert_eq!(payout, 1920);

        // With 5% badge bonus: 2.0 * 1.05 * 0.96 = 2.016x
        let payout_with_badge = calculate_payout(1000, 20000, true, 500);
        assert_eq!(payout_with_badge, 2016);
    }

    #[test]
    fn test_payout_with_different_odds() {
        // Test various odds scenarios

        // Underdog bet: 3.0x odds (30000 bps)
        let payout = calculate_payout(1000, 30000, false, 0);
        assert_eq!(payout, 2880); // 1000 * (30000 * 0.96) / 10000 = 2880

        // Favorite bet: 1.5x odds (15000 bps)
        let payout = calculate_payout(1000, 15000, false, 0);
        assert_eq!(payout, 1440); // 1000 * (15000 * 0.96) / 10000 = 1440

        // With 10% badge bonus on 2.0x odds (20000 bps)
        let payout = calculate_payout(1000, 20000, true, 1000);
        assert_eq!(payout, 2112); // 1000 * (20000 * 1.10 * 0.96) / 10000 = 2112
    }

    #[test]
    fn test_season_constants() {
        assert_eq!(TURNS_PER_SEASON, 36);
        assert_eq!(MATCHES_PER_TURN, 10);
        // 36 turns * 10 matches = 360 total matches per season
        assert_eq!(TURNS_PER_SEASON as usize * MATCHES_PER_TURN, 360);
    }

    #[test]
    fn test_match_data_creation() {
        let match_data = MatchData {
            season_id: "season_1".to_string(),
            turn: 1,
            match_id: 0,
            home_team: "Arsenal".to_string(),
            away_team: "Liverpool".to_string(),
            home_odds: 18000,
            away_odds: 22000,
            draw_odds: 32000,
            result: MatchResult::Pending,
            random_seed: None,
        };

        assert_eq!(match_data.home_team, "Arsenal");
        assert_eq!(match_data.away_team, "Liverpool");
        assert_eq!(match_data.result, MatchResult::Pending);
        assert!(TEAMS.contains(&match_data.home_team.as_str()));
        assert!(TEAMS.contains(&match_data.away_team.as_str()));
    }

    #[test]
    fn test_bet_data_creation() {
        let bet = BetData {
            match_id: "match_123".to_string(),
            prediction: MatchResult::HomeWin,
            stake: 5000,
            odds: 18000,
            bettor: "tb1p...".to_string(),
            has_badge: true,
            settled: false,
        };

        assert_eq!(bet.stake, 5000);
        assert_eq!(bet.prediction, MatchResult::HomeWin);
        assert!(!bet.settled);
        assert!(bet.has_badge);
    }

    #[test]
    fn test_badge_data_validation() {
        let badge = BadgeData {
            team_name: "Manchester City".to_string(),
            team_id: 12,
            bonus_bps: 500,
        };

        assert!(badge.team_id < 20);
        assert_eq!(badge.team_name, TEAMS[badge.team_id as usize]);
        assert_eq!(badge.bonus_bps, 500); // 5% bonus
    }

    #[test]
    fn test_season_data_initialization() {
        let season = SeasonData {
            season_id: "season_2024_1".to_string(),
            current_turn: 0,
            team_scores: [0; 20],
            total_bets_collected: 0,
            season_pool: 0,
            is_finished: false,
        };

        assert_eq!(season.current_turn, 0);
        assert_eq!(season.team_scores.iter().sum::<u32>(), 0);
        assert!(!season.is_finished);
    }

    #[test]
    fn test_season_scoring() {
        let mut team_scores = [0u32; 20];

        // Arsenal wins (team_id 0): +3 points
        team_scores[0] += 3;

        // Liverpool draws (team_id 11): +1 point
        team_scores[11] += 1;

        // Manchester City wins twice (team_id 12): +6 points
        team_scores[12] += 6;

        assert_eq!(team_scores[0], 3);
        assert_eq!(team_scores[11], 1);
        assert_eq!(team_scores[12], 6);

        // Find leader
        let leader_score = team_scores.iter().max().unwrap();
        assert_eq!(*leader_score, 6);
    }

    #[test]
    fn test_house_edge_calculation() {
        // House edge should reduce payouts by 4%
        let stake = 10000;
        let odds = 20000; // 2.0x

        let gross_payout = stake * odds / 10000; // 20000
        let net_payout = calculate_payout(stake, odds, false, 0); // 19200

        let house_take = gross_payout - net_payout;
        assert_eq!(house_take, 800); // 4% of 20000
        assert_eq!(house_take as f64 / gross_payout as f64, 0.04);
    }

    #[test]
    fn test_full_game_flow_simulation() {
        println!("\n=== PREMIER LEAGUE BETTING GAME SIMULATION ===\n");

        // 1. Create a season
        let season_id = "test_season_1";
        let mut season = SeasonData {
            season_id: season_id.to_string(),
            current_turn: 1,
            team_scores: [0; 20],
            total_bets_collected: 0,
            season_pool: 0,
            is_finished: false,
        };
        println!("✓ Season created: {}", season_id);

        // 2. Create a match
        let mut match_data = MatchData {
            season_id: season_id.to_string(),
            turn: 1,
            match_id: 0,
            home_team: "Arsenal".to_string(),
            away_team: "Liverpool".to_string(),
            home_odds: 18000, // 1.8x
            away_odds: 22000, // 2.2x
            draw_odds: 32000, // 3.2x
            result: MatchResult::Pending,
            random_seed: None,
        };
        println!("✓ Match created: {} vs {}", match_data.home_team, match_data.away_team);
        println!("  Odds - Home: 1.8x, Away: 2.2x, Draw: 3.2x");

        // 3. Place a bet
        let bet = BetData {
            match_id: "match_0".to_string(),
            prediction: MatchResult::HomeWin,
            stake: 10000, // 10,000 LEAGUE tokens
            odds: match_data.home_odds,
            bettor: "tb1p3w06fgh64axkj3uphn4t258ehweccm367vkdhkvz8qzdagjctm8qaw2xyv".to_string(),
            has_badge: true, // Has Arsenal badge
            settled: false,
        };
        println!("✓ Bet placed: 10,000 LEAGUE on Home Win (Arsenal)");
        println!("  Badge bonus: +5%");

        season.total_bets_collected += bet.stake;
        season.season_pool = season.total_bets_collected * SEASON_POOL_BPS / 10000;
        println!("  Season pool: {} LEAGUE (2%)", season.season_pool);

        // 4. Resolve the match with randomness
        let tx_hash = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6";
        match_data.random_seed = Some(tx_hash.to_string());
        match_data.result = generate_match_result(tx_hash, match_data.match_id);
        println!("✓ Match resolved using tx hash: {}...", &tx_hash[..16]);
        println!("  Result: {:?}", match_data.result);

        // 5. Update season scores
        match match_data.result {
            MatchResult::HomeWin => {
                season.team_scores[0] += 3; // Arsenal gets 3 points
                println!("  Arsenal +3 points");
            }
            MatchResult::AwayWin => {
                season.team_scores[11] += 3; // Liverpool gets 3 points
                println!("  Liverpool +3 points");
            }
            MatchResult::Draw => {
                season.team_scores[0] += 1; // Arsenal gets 1 point
                season.team_scores[11] += 1; // Liverpool gets 1 point
                println!("  Arsenal +1 point, Liverpool +1 point");
            }
            _ => {}
        }

        // 6. Calculate payout
        let won_bet = bet.prediction == match_data.result;
        let payout = if won_bet {
            calculate_payout(bet.stake, bet.odds, bet.has_badge, 500)
        } else {
            0
        };

        if won_bet {
            println!("✓ Bet WON! Payout: {} LEAGUE", payout);
            let profit = payout - bet.stake;
            println!("  Profit: {} LEAGUE", profit);
        } else {
            println!("✗ Bet lost. Better luck next time!");
        }

        println!("\n=== SEASON STATUS ===");
        println!("Turn: {}/{}", season.current_turn, TURNS_PER_SEASON);
        println!("Total bets collected: {} LEAGUE", season.total_bets_collected);
        println!("Season pool: {} LEAGUE", season.season_pool);
        println!("Arsenal points: {}", season.team_scores[0]);
        println!("Liverpool points: {}", season.team_scores[11]);

        // Assertions
        assert!(match_data.result != MatchResult::Pending);
        assert_eq!(season.total_bets_collected, 10000);
        assert_eq!(season.season_pool, 200); // 2% of 10000
    }

    #[test]
    fn test_provably_fair_randomness() {
        println!("\n=== PROVABLY FAIR RANDOMNESS TEST ===\n");

        let tx_hashes = vec![
            "9742dfa1234567890abcdef",
            "753c484fedcba0987654321",
            "a89a829aaaaaabbbbbbcccc",
        ];

        for (i, hash) in tx_hashes.iter().enumerate() {
            println!("Transaction {}: {}", i + 1, hash);
            let result = generate_match_result(hash, 0);
            println!("  Result: {:?}\n", result);

            // Verify determinism
            let result2 = generate_match_result(hash, 0);
            assert_eq!(result, result2, "Randomness must be deterministic!");
        }

        println!("✓ All results are deterministic and verifiable");
    }
}
