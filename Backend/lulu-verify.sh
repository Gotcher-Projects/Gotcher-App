#!/usr/bin/env sh
# Lulu Print API smoke test — pr0 account confirmation, and a reusable auth check for pr1–pr5.
#
# Reads LULU_* from Backend/.env (never commit secrets — .env is gitignored). It:
#   1. gets an OAuth token (client_credentials)     -> proves creds + auth model
#   2. GETs /print-jobs/                             -> proves Print API access (200, count 0 on a fresh account)
#   3. reports whether LULU_POD_PACKAGE_ID is set    -> reminder that the trim/product is still TBD (pr0 decision)
#
# Usage:  ./lulu-verify.sh          # sandbox (LULU_API_BASE from .env, defaults to sandbox)
#         ./lulu-verify.sh prod     # force production base, overriding .env
#
# A green run is the "account is good" signal for pr0. It touches no CradleHQ code or DB.

set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
ENV_FILE="$SCRIPT_DIR/.env"

[ -f "$ENV_FILE" ] || { echo "✗ No .env at $ENV_FILE"; exit 1; }

# Pull a single KEY= value from .env (cut -f2- keeps '=' inside values, e.g. base64).
get_env() { grep -E "^$1=" "$ENV_FILE" | head -n1 | cut -d= -f2- ; }

CLIENT_ID=$(get_env LULU_CLIENT_ID)
CLIENT_SECRET=$(get_env LULU_CLIENT_SECRET)
POD_PACKAGE_ID=$(get_env LULU_POD_PACKAGE_ID)
BASE=$(get_env LULU_API_BASE)

# Base URL: `prod` arg wins; else .env value; else sandbox.
if [ "${1:-}" = "prod" ]; then
  BASE="https://api.lulu.com"
elif [ -z "$BASE" ]; then
  BASE="https://api.sandbox.lulu.com"
fi

echo "Lulu API base: $BASE"

if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ]; then
  echo "✗ LULU_CLIENT_ID / LULU_CLIENT_SECRET are blank in .env — paste them from developers.lulu.com and re-run."
  exit 1
fi

command -v curl >/dev/null 2>&1 || { echo "✗ curl not found on PATH."; exit 1; }

TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

# ── 1. OAuth token (client_credentials; Basic auth via curl -u) ────────────────
TOKEN_URL="$BASE/auth/realms/glasstree/protocol/openid-connect/token"
HTTP=$(curl -s -o "$TMP" -w '%{http_code}' \
  -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d grant_type=client_credentials \
  "$TOKEN_URL")

if [ "$HTTP" != "200" ]; then
  echo "✗ Token request failed (HTTP $HTTP) at $TOKEN_URL"
  echo "  Response: $(head -c 400 "$TMP")"
  echo "  Hints: 401 = wrong client id/secret; 404 = wrong base URL (sandbox vs prod)."
  exit 1
fi

ACCESS=$(sed -n 's/.*"access_token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$TMP")
EXPIRES=$(sed -n 's/.*"expires_in"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/p' "$TMP")
[ -n "$ACCESS" ] || { echo "✗ Got HTTP 200 but no access_token. Response: $(head -c 400 "$TMP")"; exit 1; }
echo "✓ OAuth token OK (length ${#ACCESS}, expires_in ${EXPIRES:-?}s)"

# ── 2. Print API access ────────────────────────────────────────────────────────
HTTP=$(curl -s -o "$TMP" -w '%{http_code}' \
  -H "Authorization: Bearer $ACCESS" \
  "$BASE/print-jobs/")

if [ "$HTTP" != "200" ]; then
  echo "✗ /print-jobs/ returned HTTP $HTTP"
  echo "  Response: $(head -c 400 "$TMP")"
  echo "  401 here (after a good token) usually means the Print API entitlement isn't enabled — contact Lulu."
  exit 1
fi
COUNT=$(sed -n 's/.*"count"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/p' "$TMP")
echo "✓ Print API reachable — /print-jobs/ count = ${COUNT:-0}"

# ── 3. Product (trim/SKU) reminder ──────────────────────────────────────────────
if [ -n "$POD_PACKAGE_ID" ]; then
  echo "✓ LULU_POD_PACKAGE_ID set: $POD_PACKAGE_ID"
else
  echo "• LULU_POD_PACKAGE_ID not set yet — trim/product still TBD (pr0 decision; needed for pr4–pr6)."
fi

echo ""
echo "✅ Account verified. pr0 auth mechanics are good."
