#!/usr/bin/env bash
# Initialize all deployed HubAssist contracts.
# Reads contract IDs from .env.contracts produced by deploy.sh.
# Usage: ./initialize.sh <source-account> <admin-address> <payment-token-address> [network]

set -euo pipefail

SOURCE="${1:?Usage: $0 <source-account> <admin-address> <payment-token-address> [network]}"
ADMIN="${2:?Missing admin-address}"
PAYMENT_TOKEN="${3:?Missing payment-token-address}"
NETWORK="${4:-testnet}"
CONTRACTS_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$CONTRACTS_DIR/.env.contracts"

# ── Load contract IDs ────────────────────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found. Run deploy.sh first." >&2
  exit 1
fi
# shellcheck source=/dev/null
source "$ENV_FILE"

: "${ACCESS_CONTROL_CONTRACT_ID:?ACCESS_CONTROL_CONTRACT_ID not set in $ENV_FILE}"
: "${MANAGE_HUB_CONTRACT_ID:?MANAGE_HUB_CONTRACT_ID not set in $ENV_FILE}"
: "${WORKSPACE_BOOKING_CONTRACT_ID:?WORKSPACE_BOOKING_CONTRACT_ID not set in $ENV_FILE}"
: "${PAYMENT_ESCROW_CONTRACT_ID:?PAYMENT_ESCROW_CONTRACT_ID not set in $ENV_FILE}"
: "${MEMBERSHIP_TOKEN_CONTRACT_ID:?MEMBERSHIP_TOKEN_CONTRACT_ID not set in $ENV_FILE}"

invoke() {
  local contract_id="$1"; shift
  echo "--> invoking $contract_id: $*"
  stellar contract invoke \
    --id "$contract_id" \
    --source-account "$SOURCE" \
    --network "$NETWORK" \
    -- "$@"
}

echo "==> Initializing contracts on $NETWORK..."
echo ""

# access_control: initialize(admin, multisig_config)
# multisig_config: threshold=1, critical_threshold=2, time_lock_duration=0
invoke "$ACCESS_CONTROL_CONTRACT_ID" initialize \
  --admin "$ADMIN" \
  --multisig_config '{"threshold":1,"critical_threshold":2,"time_lock_duration":0}'

# workspace_booking: initialize(admin, payment_token)
invoke "$WORKSPACE_BOOKING_CONTRACT_ID" initialize \
  --admin "$ADMIN" \
  --payment_token "$PAYMENT_TOKEN"

# payment_escrow: initialize(admin, payment_token, default_dispute_window)
# default_dispute_window = 86400 seconds (24 h)
invoke "$PAYMENT_ESCROW_CONTRACT_ID" initialize \
  --admin "$ADMIN" \
  --payment_token "$PAYMENT_TOKEN" \
  --default_dispute_window 86400

# membership_token: initialize(admin)
invoke "$MEMBERSHIP_TOKEN_CONTRACT_ID" initialize \
  --admin "$ADMIN"

echo ""
echo "==> All contracts initialized."
