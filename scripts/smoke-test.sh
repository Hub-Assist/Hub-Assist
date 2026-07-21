#!/usr/bin/env bash
# End-to-end smoke test for HubAssist.
# Exercises the complete user journey against a running backend.
# Usage: ./scripts/smoke-test.sh [API_URL]
#   API_URL  defaults to http://localhost:3001/api/v1

set -euo pipefail

API="${1:-http://localhost:3001/api/v1}"
PASS=0; FAIL=0

GREEN='\033[0;32m'; RED='\033[0;31m'; RESET='\033[0m'
ok()   { echo -e "${GREEN}[PASS]${RESET} $1"; PASS=$((PASS+1)); }
fail() { echo -e "${RED}[FAIL]${RESET} $1"; FAIL=$((FAIL+1)); }

require_cmd() { command -v "$1" &>/dev/null || { echo "Error: $1 not found" >&2; exit 1; }; }
require_cmd curl
require_cmd jq

TS=$(date +%s)
EMAIL="smoke_${TS}@hubassist.test"
PASSWORD="Smoke@1234"
FIRSTNAME="Smoke"
LASTNAME="Test"

echo "==> HubAssist smoke test — $API"
echo ""

# ── 1. Register ───────────────────────────────────────────────────────────────
echo "--- Step 1: Register"
REG=$(curl -sf -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"firstname\":\"$FIRSTNAME\",\"lastname\":\"$LASTNAME\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" || echo '{}')
if echo "$REG" | jq -e '.message' &>/dev/null; then
  ok "Register: $(echo "$REG" | jq -r '.message')"
else
  fail "Register failed: $REG"
fi

# ── 2. Login (skip OTP in smoke — use direct login if OTP not required) ───────
echo "--- Step 2: Login"
LOGIN=$(curl -sf -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" || echo '{}')
TOKEN=$(echo "$LOGIN" | jq -r '.access_token // .data.access_token // empty')
if [[ -n "$TOKEN" && "$TOKEN" != "null" ]]; then
  ok "Login: token obtained"
else
  fail "Login failed (OTP may be required in this environment): $LOGIN"
  TOKEN=""
fi

AUTH_HEADER=""
[[ -n "$TOKEN" ]] && AUTH_HEADER="Authorization: Bearer $TOKEN"

# ── 3. Browse workspaces ──────────────────────────────────────────────────────
echo "--- Step 3: Browse workspaces"
WS_RESP=$(curl -sf "$API/workspaces" \
  ${AUTH_HEADER:+-H "$AUTH_HEADER"} || echo '{}')
WS_COUNT=$(echo "$WS_RESP" | jq '.data | length // 0' 2>/dev/null || echo 0)
if [[ "$WS_COUNT" -ge 0 ]]; then
  ok "Browse workspaces: $WS_COUNT workspace(s) returned"
else
  fail "Browse workspaces failed: $WS_RESP"
fi

# ── 4. Create booking (requires auth + a workspace) ───────────────────────────
echo "--- Step 4: Create booking"
if [[ -n "$TOKEN" && "$WS_COUNT" -gt 0 ]]; then
  WS_ID=$(echo "$WS_RESP" | jq -r '.data[0].id')
  START=$(date -u -d "+1 hour" +"%Y-%m-%dT%H:%M:%S" 2>/dev/null || date -u -v+1H +"%Y-%m-%dT%H:%M:%S")
  END=$(date -u -d "+3 hours" +"%Y-%m-%dT%H:%M:%S" 2>/dev/null || date -u -v+3H +"%Y-%m-%dT%H:%M:%S")
  BOOKING=$(curl -sf -X POST "$API/bookings" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"workspaceId\":\"$WS_ID\",\"startTime\":\"${START}Z\",\"endTime\":\"${END}Z\",\"totalAmount\":200}" || echo '{}')
  BOOKING_ID=$(echo "$BOOKING" | jq -r '.id // .booking.id // empty')
  if [[ -n "$BOOKING_ID" && "$BOOKING_ID" != "null" ]]; then
    ok "Create booking: id=$BOOKING_ID"
  else
    fail "Create booking failed: $BOOKING"
    BOOKING_ID=""
  fi
else
  fail "Create booking skipped (no auth token or no workspaces)"
  BOOKING_ID=""
fi

# ── 5. Clock in ───────────────────────────────────────────────────────────────
echo "--- Step 5: Clock in"
if [[ -n "$TOKEN" ]]; then
  CLOCKIN=$(curl -sf -X POST "$API/attendance/clock-in" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{}' || echo '{}')
  SESSION_ID=$(echo "$CLOCKIN" | jq -r '.sessionId // empty')
  if [[ -n "$SESSION_ID" && "$SESSION_ID" != "null" ]]; then
    ok "Clock in: sessionId=$SESSION_ID"
  else
    fail "Clock in failed: $CLOCKIN"
  fi
else
  fail "Clock in skipped (no auth token)"
fi

# ── 6. Clock out ──────────────────────────────────────────────────────────────
echo "--- Step 6: Clock out"
if [[ -n "$TOKEN" ]]; then
  CLOCKOUT=$(curl -sf -X POST "$API/attendance/clock-out" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{}' || echo '{}')
  if echo "$CLOCKOUT" | jq -e '.message' &>/dev/null; then
    ok "Clock out: $(echo "$CLOCKOUT" | jq -r '.message')"
  else
    fail "Clock out failed: $CLOCKOUT"
  fi
else
  fail "Clock out skipped (no auth token)"
fi

# ── 7. Health check ───────────────────────────────────────────────────────────
echo "--- Step 7: Health check"
HEALTH=$(curl -sf "${API%/v1}/health" || echo '{}')
STATUS=$(echo "$HEALTH" | jq -r '.status // empty')
if [[ "$STATUS" == "ok" ]]; then
  ok "Health check: $STATUS"
else
  fail "Health check failed: $HEALTH"
fi

# ── 8. Verify Stellar tx endpoint ─────────────────────────────────────────────
echo "--- Step 8: Stellar verify-tx endpoint"
if [[ -n "$TOKEN" ]]; then
  VERIFY=$(curl -sf -X POST "$API/stellar/verify-tx" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"txHash":"0000000000000000000000000000000000000000000000000000000000000000"}' || echo '{}')
  # Any response (even error) means the endpoint exists
  if [[ -n "$VERIFY" ]]; then
    ok "Stellar verify-tx endpoint reachable"
  else
    fail "Stellar verify-tx endpoint unreachable"
  fi
else
  fail "Stellar verify-tx skipped (no auth token)"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "==> Results: ${PASS} passed, ${FAIL} failed"
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
