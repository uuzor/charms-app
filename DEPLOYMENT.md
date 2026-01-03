# Deployment Guide
## Deploying Premier League Virtual Betting to Bitcoin Testnet4

This guide walks through deploying the smart contract to Bitcoin using the Charms protocol.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Setup Bitcoin Core](#setup-bitcoin-core)
3. [Get Test BTC](#get-test-btc)
4. [Build Smart Contract](#build-smart-contract)
5. [Deploy to Testnet4](#deploy-to-testnet4)
6. [Verify Deployment](#verify-deployment)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### 1. Install Bitcoin Core v28.0+

**macOS:**
```bash
brew install bitcoin
```

**Linux:**
```bash
# Download from https://bitcoin.org/en/download
wget https://bitcoincore.org/bin/bitcoin-core-28.0/bitcoin-28.0-x86_64-linux-gnu.tar.gz
tar -xvf bitcoin-28.0-x86_64-linux-gnu.tar.gz
sudo install -m 0755 -o root -g root -t /usr/local/bin bitcoin-28.0/bin/*
```

**Verify Installation:**
```bash
bitcoin-cli --version
# Should output: Bitcoin Core RPC client version v28.0.0 (or later)
```

### 2. Install jq (JSON processor)

**macOS:**
```bash
brew install jq
```

**Linux:**
```bash
sudo apt-get install jq
```

### 3. Install Rust & Charms CLI

**Rust:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup toolchain install nightly
```

**Charms CLI:**
```bash
export CARGO_TARGET_DIR=$(mktemp -d)/target
cargo install --locked charms
```

Verify:
```bash
charms --version
```

---

## Setup Bitcoin Core

### 1. Configure bitcoin.conf

**Location:**
- macOS: `~/Library/Application Support/Bitcoin/bitcoin.conf`
- Linux: `~/.bitcoin/bitcoin.conf`

**Configuration:**
```conf
server=1
testnet4=1
txindex=1
addresstype=bech32m
changetype=bech32m
```

### 2. Start Bitcoin Core

**macOS:**
```bash
bitcoind -daemon
```

**Linux:**
```bash
bitcoind -daemon
```

**Check sync status:**
```bash
bitcoin-cli -testnet4 getblockchaininfo
```

Wait for `"blocks"` to equal `"headers"` (fully synced). This can take several hours.

### 3. Create Alias for Convenience

Add to `~/.bashrc` or `~/.zshrc`:
```bash
alias b='bitcoin-cli -testnet4'
```

Then reload:
```bash
source ~/.bashrc  # or ~/.zshrc
```

### 4. Create and Load Wallet

```bash
b createwallet testwallet
b loadwallet testwallet
```

**Note:** If wallet already exists, just load it:
```bash
b loadwallet testwallet
```

---

## Get Test BTC

### 1. Generate a New Address

```bash
b getnewaddress
```

Example output:
```
tb1pxyz123...abc789
```

### 2. Get Test BTC from Faucet

Visit: **https://mempool.space/testnet4/faucet**

- Paste your address
- Request test BTC (aim for at least 50,000 sats = 0.0005 BTC)
- **Important:** Get multiple UTXOs by:
  - Tapping faucet multiple times, OR
  - Sending sats to yourself to create smaller UTXOs

### 3. Verify Balance

```bash
b getbalance
b listunspent
```

Example output:
```json
[
  {
    "txid": "2d6d1603f0738085f2035d496baf2b91a639d204b414ea180beb417a3e09f84e",
    "vout": 1,
    "address": "tb1pxyz123...abc789",
    "amount": 0.00050000,
    "confirmations": 6
  }
]
```

**You need:**
- At least 50,000 sats total
- Multiple UTXOs (at least one >= 10,000 sats)

---

## Build Smart Contract

### 1. Navigate to Project Root

```bash
cd /path/to/charms-app
```

### 2. Build the Rust Contract to WASM

```bash
cd contract
cargo build --release --target wasm32-wasip1
```

**Or use Charms CLI:**
```bash
app_bin=$(charms app build)
echo $app_bin  # Verify path to WASM binary
```

Expected output:
```
Built app: /path/to/charms-app/contract/target/wasm32-wasip1/release/premier_league_betting.wasm
```

### 3. Verify WASM Build

```bash
ls -lh target/wasm32-wasip1/release/premier_league_betting.wasm
```

Should show a file around **295KB** in size.

---

## Deploy to Testnet4

### 1. Prepare Environment Variables

```bash
# Set the app binary path
app_bin=$(charms app build)

# Get a funding UTXO from your wallet
b listunspent

# Pick one UTXO (copy txid:vout)
funding_utxo="2d6d1603f0738085f2035d496baf2b91a639d204b414ea180beb417a3e09f84e:1"
funding_utxo_value="50000"  # Value in satoshis

# Get change address
change_address=$(b getrawchangeaddress)

# Enable logging
export RUST_LOG=info
```

### 2. Cast Your First Spell (Create Season)

**Using the spell file:**
```bash
cat ./spells/01-create-season.yaml | envsubst | charms spell prove \
  --app-bins=${app_bin} \
  --funding-utxo=$funding_utxo \
  --funding-utxo-value=$funding_utxo_value \
  --change-address=$change_address
```

**What this does:**
1. Reads the spell YAML file
2. Generates zero-knowledge proof (takes ~5 minutes)
3. Creates two transactions:
   - **Commit transaction**: Commits to the spell and proof
   - **Spell transaction**: Contains the actual spell with proof in witness data
4. Outputs hex-encoded signed transactions

**Expected output (at the end):**
```json
[
  {"bitcoin":"020000000001015f...57505efa00000000"},
  {"bitcoin":"020000000001025f...e14c656300000000"}
]
```

### 3. Submit Transaction Package to Bitcoin

Copy the two hex strings from the output and submit as a package:

```bash
b submitpackage '["020000000001015f...57505efa00000000", "020000000001025f...e14c656300000000"]'
```

**Successful response:**
```json
{
  "package_msg": "success",
  "tx-results": {
    "txid1...": {"txid": "txid1..."},
    "txid2...": {"txid": "txid2..."}
  },
  "replaced-transactions": []
}
```

### 4. Wait for Confirmation

```bash
# Watch mempool
b getmempoolinfo

# Check transaction status
b gettransaction <txid>
```

Wait for at least 1 confirmation (~10 minutes on testnet).

---

## Verify Deployment

### 1. Check Transaction on Explorer

Visit: **https://mempool.space/testnet4/tx/YOUR_TXID**

Look for:
- Transaction confirmed
- Witness data containing spell
- Output with charm data

### 2. Verify Spell with Charms CLI

```bash
charms tx show-spell <txid>
```

This decodes and verifies the spell in the transaction.

### 3. Extract Charms with Frontend

Use the `charms-js` SDK in your frontend:

```typescript
import { extractAndVerifySpell } from "charms-js";

const txHex = await fetch(`https://mempool.space/testnet4/api/tx/${txid}/hex`).then(r => r.text());
const result = await extractAndVerifySpell(txHex, "testnet4");

if (result.success) {
  console.log("Season Charm:", result.charms[0]);
}
```

---

## Deploying All Game Components

### 1. Create Season (Already Done Above)

```bash
# ./spells/01-create-season.yaml
# Creates SEASON_NFT charm with initial state
```

### 2. Mint $LEAGUE Tokens

```bash
# Get new UTXO for funding
funding_utxo=$(b listunspent | jq -r '.[0].txid + ":" + (.[0].vout|tostring)')
funding_utxo_value=$(b listunspent | jq -r '.[0].amount * 100000000 | floor')

cat ./spells/09-mint-league-tokens.yaml | envsubst | charms spell prove \
  --app-bins=${app_bin} \
  --funding-utxo=$funding_utxo \
  --funding-utxo-value=$funding_utxo_value \
  --change-address=$change_address
```

### 3. Create Matches for Turn 1

```bash
# Update spell file with season txid
# Then cast:
cat ./spells/02-create-matches.yaml | envsubst | charms spell prove \
  --app-bins=${app_bin} \
  --prev-txs=$season_txid \
  --funding-utxo=$funding_utxo \
  --funding-utxo-value=$funding_utxo_value \
  --change-address=$change_address
```

### 4. Mint Team Badges (20 Total)

```bash
# For each team (0-19):
export TEAM_ID=0
export TEAM_NAME="Arsenal"

cat ./spells/06-mint-team-badge.yaml | envsubst | charms spell prove \
  --app-bins=${app_bin} \
  --funding-utxo=$funding_utxo \
  --funding-utxo-value=$funding_utxo_value \
  --change-address=$change_address
```

### 5. Place a Test Bet

```bash
# Requires $LEAGUE tokens first
export MATCH_ID="season1_turn1_match0"
export PREDICTION="HomeWin"
export STAKE="1000"

cat ./spells/03-place-bet.yaml | envsubst | charms spell prove \
  --app-bins=${app_bin} \
  --prev-txs=$match_txid \
  --funding-utxo=$league_token_utxo \
  --funding-utxo-value=$funding_utxo_value \
  --change-address=$change_address
```

---

## Deployment Checklist

- [ ] Bitcoin Core v28.0+ installed
- [ ] `bitcoin.conf` configured for testnet4
- [ ] Bitcoin node fully synced
- [ ] Wallet created and loaded
- [ ] At least 50,000 test sats received
- [ ] Multiple UTXOs available
- [ ] jq installed
- [ ] Rust and Charms CLI installed
- [ ] Smart contract built to WASM (295KB)
- [ ] Alias `b` set for bitcoin-cli
- [ ] Environment variables configured
- [ ] First spell cast successfully
- [ ] Transaction confirmed on testnet4
- [ ] Spell verified with Charms CLI
- [ ] Charms extractable with charms-js

---

## Troubleshooting

### Issue: "Bitcoin Core not synced"

**Solution:**
```bash
b getblockchaininfo | jq '.blocks, .headers'
```
Wait until both numbers match.

### Issue: "Insufficient funds"

**Solution:**
- Check balance: `b getbalance`
- Get more test BTC from faucet
- Ensure you have multiple UTXOs

### Issue: "Proof generation taking too long"

**Expected behavior:** Proofs take ~5 minutes to generate. This is normal.

**Alternative:** Use hosted proving service (if available):
```bash
export PROVER_URL=https://prover.charms.dev
```

### Issue: "Transaction rejected by mempool"

**Possible causes:**
1. Insufficient fee
2. Double-spend attempt
3. Invalid spell proof

**Debug:**
```bash
b testmempoolaccept '["<tx_hex>"]'
```

### Issue: "Cannot find UTXO"

**Solution:**
```bash
# List all UTXOs
b listunspent

# Ensure transactions are confirmed
b listtransactions
```

### Issue: "Charms CLI build fails"

**Solution:**
```bash
# Try from source
git clone https://github.com/CharmsDev/charms.git
cd charms
cargo install --path .
```

---

## Cost Estimation

### Testnet4 (Free)
- All transactions use test BTC
- No real value, only for testing

### Bitcoin Mainnet (Estimated)
- **Commit + Spell transaction**: ~5,000 - 10,000 sats (~$2-4 at current prices)
- **Per season deployment**: ~10,000 sats
- **Per match creation**: ~2,000 sats per turn
- **Total for full game**: ~500,000 sats (~$200)

**Optimization:**
- Batch transactions
- Use lower fee rates during off-peak hours
- Consolidate UTXOs beforehand

---

## Next Steps After Deployment

1. **Update Frontend Configuration**
   - Set `APP_ID` and `APP_VK` from deployment
   - Update contract addresses in hooks
   - Point to correct network (testnet4)

2. **Set Up Indexer**
   - Index all charm transactions
   - Serve match/bet data to frontend
   - Cache transaction hex for fast retrieval

3. **Test User Flows**
   - Connect wallet (Leather/Unisat)
   - Place bets on matches
   - Verify charm extraction
   - Test settlement process

4. **Monitor Transactions**
   - Watch mempool.space for confirmations
   - Verify all spells execute correctly
   - Track gas usage and costs

5. **Plan Mainnet Migration**
   - Audit smart contract
   - Prepare mainnet Bitcoin Core node
   - Get sufficient BTC for deployment
   - Deploy with real value

---

## Resources

**Official Documentation:**
- Charms Docs: https://docs.charms.dev
- Bitcoin Core: https://bitcoin.org/en/bitcoin-core/
- Mempool.space Testnet4: https://mempool.space/testnet4

**Tools:**
- Bitcoin Core Download: https://bitcoin.org/en/download
- Testnet4 Faucet: https://mempool.space/testnet4/faucet
- Charms GitHub: https://github.com/CharmsDev/charms
- charms-js SDK: https://github.com/CharmsDev/charms-js

**Support:**
- Charms Discord: [Join Community]
- Bitcoin Stack Exchange: https://bitcoin.stackexchange.com
- GitHub Issues: https://github.com/CharmsDev/charms/issues

---

## Security Considerations

**Testnet:**
- Use only for testing, never real funds
- Test BTC has no value
- Bugs won't cost real money

**Mainnet (Future):**
- Audit smart contract thoroughly
- Test all transaction flows extensively
- Use multisig for treasury
- Implement rate limiting
- Monitor for exploits
- Have emergency pause mechanism

---

## Appendix: Spell File Format

### Example: Create Season Spell

```yaml
# spells/01-create-season.yaml
version: 1
inputs:
  - txid: "$FUNDING_UTXO_TXID"
    vout: $FUNDING_UTXO_VOUT
outputs:
  - address: "$HOUSE_ADDRESS"
    value: 546  # Dust limit
    charm:
      app: "13/$APP_ID/$APP_VK"  # SEASON_NFT tag
      data:
        season_id: "season1"
        current_turn: 0
        total_turns: 36
        pool_amount: 0
        started: true
        winner: ""
```

### Key Fields:

- **version**: Spell format version (always 1)
- **inputs**: UTXOs being spent
- **outputs**: New UTXOs with charm data
- **charm.app**: Format is `TAG/APP_ID/APP_VK`
- **charm.data**: Application-specific data (validated by contract)

---

**Document Version**: 1.0
**Last Updated**: December 28, 2025
**Network**: Bitcoin Testnet4

---

*Always test thoroughly on testnet before deploying to mainnet. This guide assumes you have basic knowledge of Bitcoin transactions and command-line tools.*
