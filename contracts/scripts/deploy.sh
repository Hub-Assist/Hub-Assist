#!/usr/bin/env bash
# Deploy all HubAssist contracts to Stellar testnet in dependency order.
# Usage: ./deploy.sh <source-account> [network]
#   source-account  Stellar account alias or secret key
#   network         testnet (default) | mainnet

set -euo pipefail

SOURCE="${1:?Usage: $0 <source-account> [network]}"
NETWORK="${2:-testnet}"
CONTRACTS_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$CONTRACTS_DIR/.env.contracts"

# ── Prerequisites ────────────────────────────────────────────────────────────
if ! command -v stellar &>/dev/null; then
  echo "Error: stellar CLI not found. Install with: cargo install --locked stellar-cli@23.1.3" >&2
  exit 1
fi

echo "Network : $NETWORK"
echo "Source  : $SOURCE"
echo "Output  : $ENV_FILE"
echo ""

# ── Build all contracts ──────────────────────────────────────────────────────
echo "==> Building all contracts..."
(cd "$CONTRACTS_DIR" && stellar contract build)

WASM_DIR="$CONTRACTS_DIR/target/wasm32v1-none/release"

# ── Deploy helper ────────────────────────────────────────────────────────────
deploy() {
  local alias="$1"
  local wasm="$WASM_DIR/${alias}.wasm"

  echo "--> Deploying $alias..."
  local contract_id
  contract_id=$(stellar contract deploy \
    --wasm "$wasm" \
    --source-account "$SOURCE" \
    --network "$NETWORK" \
    --alias "$alias" \
    2>&1 | tail -1)

  echo "    $alias => $contract_id"
  echo "${alias^^}_CONTRACT_ID=$contract_id" >> "$ENV_FILE"
}

# ── Reset output file ────────────────────────────────────────────────────────
cat > "$ENV_FILE" <<EOF
# HubAssist deployed contract IDs — $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# Network: $NETWORK
STELLAR_NETWORK=$NETWORK
EOF

# ── Deploy in dependency order ───────────────────────────────────────────────
# common_types is a library — no standalone deployment needed
deploy access_control
deploy manage_hub
deploy workspace_booking
deploy payment_escrow
deploy membership_token

echo ""
echo "==> Deployment complete. Contract IDs saved to $ENV_FILE"
