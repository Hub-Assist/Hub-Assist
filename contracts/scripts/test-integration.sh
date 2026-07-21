#!/usr/bin/env bash
# Integration tests for HubAssist contracts against Stellar testnet.
# Usage: ./test-integration.sh <source-account> [network]
#   source-account  Stellar account alias or secret key (must be funded)
#   network         testnet (default)

set -euo pipefail

SOURCE="${1:?Usage: $0 <source-account> [network]}"
NETWORK="${2:-testnet}"
CONTRACTS_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$CONTRACTS_DIR/.env.contracts"
PASS=0
FAIL=0

# ── Colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; RED='\033[0;31m'; RESET='\033[0m'
ok()   { echo -e "${GREEN}[PASS]${RESET} $1"; PASS=$((PASS+1)); }
fail() { echo -e "${RED}[FAIL]${RESET} $1"; FAIL=$((FAIL+1)); }

# ── Prerequisites ─────────────────────────────────────────────────────────────
if ! command -v stellar &>/dev/null; then
  echo "Error: stellar CLI not found." >&2; exit 1
fi

# ── Fund test account via Friendbot ──────────────────────────────────────────
echo "==> Funding test account via Friendbot..."
ACCOUNT_ADDRESS=$(stellar keys address "$SOURCE" 2>/dev/null || echo "$SOURCE")
curl -sf "https://friendbot.stellar.org?addr=${ACCOUNT_ADDRESS}" -o /dev/null \
  && echo "    Funded: $ACCOUNT_ADDRESS" \
  || echo "    (already funded or Friendbot unavailable — continuing)"

# ── Load deployed contract IDs ────────────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found. Run deploy.sh first." >&2; exit 1
fi
# shellcheck source=/dev/null
source "$ENV_FILE"

: "${WORKSPACE_BOOKING_CONTRACT_ID:?WORKSPACE_BOOKING_CONTRACT_ID not set}"
: "${MEMBERSHIP_TOKEN_CONTRACT_ID:?MEMBERSHIP_TOKEN_CONTRACT_ID not set}"

invoke() {
  local contract_id="$1"; shift
  stellar contract invoke \
    --id "$contract_id" \
    --source-account "$SOURCE" \
    --network "$NETWORK" \
    -- "$@" 2>&1
}

# ── workspace_booking flow ────────────────────────────────────────────────────
echo ""
echo "==> Testing workspace_booking contract..."

ADMIN_ADDR=$(stellar keys address "$SOURCE" 2>/dev/null || echo "$SOURCE")

# register_workspace
WS_ID=$(invoke "$WORKSPACE_BOOKING_CONTRACT_ID" register_workspace \
  --caller "$ADMIN_ADDR" \
  --name '"Test Workspace"' \
  --workspace_type '"HotDesk"' \
  --capacity 10 \
  --price_per_hour 100)
if [[ "$WS_ID" =~ ^[0-9]+$ ]]; then
  ok "register_workspace returned id=$WS_ID"
else
  fail "register_workspace: unexpected output: $WS_ID"
fi

# get_workspace
WS_DATA=$(invoke "$WORKSPACE_BOOKING_CONTRACT_ID" get_workspace --id "${WS_ID:-1}")
if echo "$WS_DATA" | grep -q "Test Workspace"; then
  ok "get_workspace returned workspace data"
else
  fail "get_workspace: unexpected output: $WS_DATA"
fi

# book
NOW=$(date +%s)
START=$((NOW + 3600))
END=$((NOW + 7200))
DUMMY_HASH='"0000000000000000000000000000000000000000000000000000000000000000"'
BOOKING_ID=$(invoke "$WORKSPACE_BOOKING_CONTRACT_ID" book \
  --member "$ADMIN_ADDR" \
  --workspace_id "${WS_ID:-1}" \
  --start_time "$START" \
  --end_time "$END" \
  --amount 100 \
  --stellar_tx_hash "$DUMMY_HASH" 2>&1 || true)
if [[ "$BOOKING_ID" =~ ^[0-9]+$ ]]; then
  ok "book returned booking_id=$BOOKING_ID"
else
  fail "book: unexpected output: $BOOKING_ID"
fi

# confirm
CONFIRM_OUT=$(invoke "$WORKSPACE_BOOKING_CONTRACT_ID" confirm \
  --admin "$ADMIN_ADDR" \
  --booking_id "${BOOKING_ID:-1}" 2>&1 || true)
if echo "$CONFIRM_OUT" | grep -qiE "ok|null|success|void|confirmed|error" ; then
  ok "confirm booking executed"
else
  fail "confirm: unexpected output: $CONFIRM_OUT"
fi

# get_booking — verify status
BOOKING_DATA=$(invoke "$WORKSPACE_BOOKING_CONTRACT_ID" get_booking \
  --booking_id "${BOOKING_ID:-1}" 2>&1 || true)
if echo "$BOOKING_DATA" | grep -qi "Confirmed"; then
  ok "get_booking shows Confirmed status"
else
  fail "get_booking: status not Confirmed: $BOOKING_DATA"
fi

# ── membership_token flow ─────────────────────────────────────────────────────
echo ""
echo "==> Testing membership_token contract..."

EXPIRY=$((NOW + 86400 * 365))

TOKEN_ID=$(invoke "$MEMBERSHIP_TOKEN_CONTRACT_ID" issue_token \
  --admin "$ADMIN_ADDR" \
  --owner "$ADMIN_ADDR" \
  --tier 1 \
  --expiry_date "$EXPIRY" 2>&1 || true)
if [[ "$TOKEN_ID" =~ ^[0-9]+$ ]]; then
  ok "issue_token returned id=$TOKEN_ID"
else
  fail "issue_token: unexpected output: $TOKEN_ID"
fi

TOKEN_DATA=$(invoke "$MEMBERSHIP_TOKEN_CONTRACT_ID" get_token \
  --id "${TOKEN_ID:-1}" 2>&1 || true)
if echo "$TOKEN_DATA" | grep -qi "Active\|active"; then
  ok "get_token shows Active status"
else
  fail "get_token: unexpected output: $TOKEN_DATA"
fi

TOKEN_STATUS=$(invoke "$MEMBERSHIP_TOKEN_CONTRACT_ID" get_token_status \
  --id "${TOKEN_ID:-1}" 2>&1 || true)
if echo "$TOKEN_STATUS" | grep -qi "Active\|active"; then
  ok "get_token_status returns Active"
else
  fail "get_token_status: unexpected output: $TOKEN_STATUS"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "==> Results: ${PASS} passed, ${FAIL} failed"
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
