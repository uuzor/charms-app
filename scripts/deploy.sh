#!/bin/bash
# Deployment Script for Premier League Virtual Betting on Bitcoin Testnet4
#
# Prerequisites:
# - Bitcoin Core v28.0+ running with testnet4
# - Charms CLI installed
# - Test BTC in wallet (at least 50,000 sats)
# - jq installed

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check prerequisites
check_prerequisites() {
    info "Checking prerequisites..."

    # Check bitcoin-cli
    if ! command -v bitcoin-cli &> /dev/null; then
        error "bitcoin-cli not found. Install Bitcoin Core v28.0+"
    fi

    # Check charms
    if ! command -v charms &> /dev/null; then
        error "charms CLI not found. Install with: cargo install --locked charms"
    fi

    # Check jq
    if ! command -v jq &> /dev/null; then
        error "jq not found. Install with: brew install jq (macOS) or apt-get install jq (Linux)"
    fi

    # Set up alias
    alias b='bitcoin-cli -testnet4'

    info "All prerequisites installed ✓"
}

# Check Bitcoin node status
check_bitcoin_node() {
    info "Checking Bitcoin node status..."

    if ! bitcoin-cli -testnet4 getblockchaininfo &> /dev/null; then
        error "Bitcoin node not running. Start with: bitcoind -daemon"
    fi

    local blocks=$(bitcoin-cli -testnet4 getblockchaininfo | jq -r '.blocks')
    local headers=$(bitcoin-cli -testnet4 getblockchaininfo | jq -r '.headers')

    if [ "$blocks" != "$headers" ]; then
        warn "Bitcoin node not fully synced. Blocks: $blocks, Headers: $headers"
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        info "Bitcoin node fully synced ✓"
    fi
}

# Check wallet and balance
check_wallet() {
    info "Checking wallet..."

    # Load wallet if not loaded
    if ! bitcoin-cli -testnet4 getwalletinfo &> /dev/null; then
        warn "No wallet loaded. Loading testwallet..."
        bitcoin-cli -testnet4 loadwallet testwallet || \
        bitcoin-cli -testnet4 createwallet testwallet
    fi

    local balance=$(bitcoin-cli -testnet4 getbalance)
    local balance_sats=$(echo "$balance * 100000000" | bc | cut -d. -f1)

    if [ "$balance_sats" -lt 50000 ]; then
        error "Insufficient balance. Need at least 50,000 sats, have: $balance_sats sats"
    fi

    info "Wallet balance: $balance_sats sats ✓"
}

# Build smart contract
build_contract() {
    info "Building smart contract to WASM..."

    cd "$(dirname "$0")/.."

    if [ ! -f "Cargo.toml" ]; then
        error "Cargo.toml not found. Run this script from the project root."
    fi

    cargo build --release --target wasm32-wasip1

    local wasm_path="target/wasm32-wasip1/release/premier-league-betting.wasm"

    if [ ! -f "$wasm_path" ]; then
        error "WASM build failed"
    fi

    local size=$(ls -lh "$wasm_path" | awk '{print $5}')
    info "Smart contract built: $size ✓"

    export APP_BIN="$(pwd)/$wasm_path"
}

# Get funding UTXO
get_funding_utxo() {
    info "Getting funding UTXO..."

    local utxos=$(bitcoin-cli -testnet4 listunspent | jq -r '.[] | select(.amount >= 0.0001)')

    if [ -z "$utxos" ]; then
        error "No suitable UTXO found. Need at least 10,000 sats in one UTXO."
    fi

    export FUNDING_UTXO=$(echo "$utxos" | jq -r '.[0].txid + ":" + (.[0].vout|tostring)' | head -1)
    export FUNDING_UTXO_VALUE=$(echo "$utxos" | jq -r '.[0].amount * 100000000 | floor' | head -1)
    export CHANGE_ADDRESS=$(bitcoin-cli -testnet4 getrawchangeaddress)

    info "Funding UTXO: $FUNDING_UTXO ($FUNDING_UTXO_VALUE sats)"
}

# Cast a spell
cast_spell() {
    local spell_file=$1
    local spell_name=$2
    local prev_txs=${3:-""}

    info "Casting spell: $spell_name..."

    if [ ! -f "$spell_file" ]; then
        error "Spell file not found: $spell_file"
    fi

    # Enable logging
    export RUST_LOG=info

    # Prepare command
    local cmd="cat $spell_file | envsubst | charms spell prove \
        --app-bins=$APP_BIN \
        --funding-utxo=$FUNDING_UTXO \
        --funding-utxo-value=$FUNDING_UTXO_VALUE \
        --change-address=$CHANGE_ADDRESS"

    if [ ! -z "$prev_txs" ]; then
        cmd="$cmd --prev-txs=$prev_txs"
    fi

    info "Generating proof (this takes ~5 minutes)..."

    # Execute and capture output
    local output=$(eval $cmd 2>&1)

    # Extract transaction hex
    local tx_package=$(echo "$output" | grep -o '\[{.*}\]' | tail -1)

    if [ -z "$tx_package" ]; then
        error "Failed to generate spell. Output: $output"
    fi

    # Submit package
    info "Submitting transaction package..."
    local result=$(bitcoin-cli -testnet4 submitpackage "$tx_package")

    # Extract txid
    local txid=$(echo "$result" | jq -r '.["tx-results"] | to_entries | .[1].value.txid')

    if [ -z "$txid" ] || [ "$txid" = "null" ]; then
        error "Failed to submit transaction. Result: $result"
    fi

    info "✓ Spell cast successfully!"
    info "Transaction ID: $txid"
    info "View on explorer: https://mempool.space/testnet4/tx/$txid"

    echo "$txid"
}

# Main deployment flow
main() {
    echo -e "${GREEN}"
    echo "======================================"
    echo " Premier League Virtual Betting"
    echo " Smart Contract Deployment"
    echo " Network: Bitcoin Testnet4"
    echo "======================================"
    echo -e "${NC}"

    check_prerequisites
    check_bitcoin_node
    check_wallet
    build_contract
    get_funding_utxo

    # Step 1: Create Season
    info "Step 1/4: Creating Season..."
    SEASON_TXID=$(cast_spell "spells/01-create-season.yaml" "Create Season")
    echo

    # Wait for confirmation
    info "Waiting for confirmation (this may take ~10 minutes)..."
    while true; do
        confirmations=$(bitcoin-cli -testnet4 gettransaction "$SEASON_TXID" 2>/dev/null | jq -r '.confirmations // 0')
        if [ "$confirmations" -gt 0 ]; then
            break
        fi
        echo -n "."
        sleep 10
    done
    echo
    info "Season confirmed! ✓"

    # Refresh UTXO for next transaction
    get_funding_utxo

    # Step 2: Mint $LEAGUE Tokens
    info "Step 2/4: Minting $LEAGUE tokens..."
    TOKEN_TXID=$(cast_spell "spells/09-mint-league-tokens.yaml" "Mint Tokens")
    echo

    # Step 3: Create First Match Set
    info "Step 3/4: Creating matches for Turn 1..."
    export PREV_TXS="$SEASON_TXID"
    get_funding_utxo
    MATCH_TXID=$(cast_spell "spells/02-create-matches.yaml" "Create Matches" "$SEASON_TXID")
    echo

    # Step 4: Mint First Team Badge
    info "Step 4/4: Minting Arsenal team badge..."
    export TEAM_ID=0
    export TEAM_NAME="Arsenal"
    get_funding_utxo
    BADGE_TXID=$(cast_spell "spells/06-mint-team-badge.yaml" "Mint Badge")
    echo

    # Summary
    echo -e "${GREEN}"
    echo "======================================"
    echo " Deployment Complete! 🎉"
    echo "======================================"
    echo -e "${NC}"
    echo
    info "Transaction Summary:"
    echo "  Season:  $SEASON_TXID"
    echo "  Tokens:  $TOKEN_TXID"
    echo "  Matches: $MATCH_TXID"
    echo "  Badge:   $BADGE_TXID"
    echo
    info "Next Steps:"
    echo "  1. Verify transactions on https://mempool.space/testnet4"
    echo "  2. Update frontend with APP_ID and APP_VK"
    echo "  3. Set SEASON_TXID in frontend configuration"
    echo "  4. Test charm extraction with charms-js SDK"
    echo
    info "To mint more badges, run:"
    echo "  ./scripts/mint-badges.sh"
    echo
}

# Run main function
main "$@"
