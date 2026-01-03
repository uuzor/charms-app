#!/bin/bash
# Mint all 20 Premier League Team Badge NFTs
#
# Prerequisites: Same as deploy.sh
# Usage: ./scripts/mint-badges.sh

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

# Premier League teams
declare -a TEAMS=(
    "Arsenal"
    "Liverpool"
    "Manchester City"
    "Manchester United"
    "Chelsea"
    "Tottenham"
    "Newcastle"
    "Aston Villa"
    "Brighton"
    "West Ham"
    "Wolves"
    "Nottingham Forest"
    "Brentford"
    "Fulham"
    "Crystal Palace"
    "Bournemouth"
    "Leicester City"
    "Ipswich Town"
    "Everton"
    "Southampton"
)

# Build contract
info "Building smart contract..."
cd "$(dirname "$0")/.."
cargo build --release --target wasm32-wasip1
export APP_BIN="$(pwd)/target/wasm32-wasip1/release/premier-league-betting.wasm"

# Setup
alias b='bitcoin-cli -testnet4'
export RUST_LOG=info

# Mint all badges
for i in "${!TEAMS[@]}"; do
    TEAM_NAME="${TEAMS[$i]}"
    TEAM_ID=$i

    info "Minting badge $((i+1))/20: $TEAM_NAME (ID: $TEAM_ID)"

    # Get fresh UTXO
    FUNDING_UTXO=$(b listunspent | jq -r '.[0].txid + ":" + (.[0].vout|tostring)')
    FUNDING_UTXO_VALUE=$(b listunspent | jq -r '.[0].amount * 100000000 | floor')
    CHANGE_ADDRESS=$(b getrawchangeaddress)

    export TEAM_ID TEAM_NAME FUNDING_UTXO FUNDING_UTXO_VALUE CHANGE_ADDRESS

    # Cast spell
    output=$(cat spells/06-mint-team-badge.yaml | envsubst | charms spell prove \
        --app-bins=$APP_BIN \
        --funding-utxo=$FUNDING_UTXO \
        --funding-utxo-value=$FUNDING_UTXO_VALUE \
        --change-address=$CHANGE_ADDRESS 2>&1)

    # Submit
    tx_package=$(echo "$output" | grep -o '\[{.*}\]' | tail -1)
    result=$(b submitpackage "$tx_package")
    txid=$(echo "$result" | jq -r '.["tx-results"] | to_entries | .[1].value.txid')

    info "✓ $TEAM_NAME badge minted: $txid"
    echo "$TEAM_NAME,$TEAM_ID,$txid" >> badges.csv

    # Small delay to avoid overwhelming the node
    sleep 2
done

info "All 20 team badges minted! ✓"
info "Results saved to badges.csv"
