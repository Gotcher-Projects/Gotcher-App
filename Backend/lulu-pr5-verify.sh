#!/usr/bin/env sh
# Lulu Print API — pr5 client verification. Exercises the exact Lulu-facing contract the Java LuluClient uses,
# straight from curl, so the API shapes + the cover cross-check can be verified WITHOUT the app/sidecar/tunnel.
#
# Reads LULU_* from Backend/.env (same as lulu-verify.sh; secrets never committed). Two modes:
#
#   ./lulu-pr5-verify.sh                      # SAFE — creates NO print job. Runs:
#                                             #   1. OAuth token
#                                             #   2. cover-dimensions cross-check (our spine formula vs Lulu's calc)
#                                             #   3. cost-calculation preview (proves address/SKU/shipping shape; pr6 sneak-peek)
#
#   ./lulu-pr5-verify.sh submit <interior_url> <cover_url> [pageCount]
#                                             # LIVE — creates a PAID sandbox print job from two PUBLIC pdf urls
#                                             #   (the /print/pdf/{token} links via your tunnel) and polls status
#                                             #   until Lulu finishes fetching them. This is the "Done when" e2e.
#
# Mirrors LuluPrintService: SKU from LULU_POD_PACKAGE_ID, shipping MAIL (plain GROUND is NOT offered for this
# SKU→US — verified 2026-07-18), canned US address, qty 1.

set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
ENV_FILE="$SCRIPT_DIR/.env"
[ -f "$ENV_FILE" ] || { echo "✗ No .env at $ENV_FILE"; exit 1; }
get_env() { grep -E "^$1=" "$ENV_FILE" | head -n1 | cut -d= -f2- ; }

CLIENT_ID=$(get_env LULU_CLIENT_ID)
CLIENT_SECRET=$(get_env LULU_CLIENT_SECRET)
POD=$(get_env LULU_POD_PACKAGE_ID)
BASE=$(get_env LULU_API_BASE); [ -n "$BASE" ] || BASE="https://api.sandbox.lulu.com"

# The spine/wrap geometry the Java + PrintCoverPage.jsx use — kept here to reproduce the computed wrap dims.
TRIM_W=8.5; TRIM_H=11; BLEED=0.125; PAPER_PPI=444; SPINE_PAD=0.06; TOL=0.02
SHIPPING_LEVEL="MAIL"

[ -n "$CLIENT_ID" ] && [ -n "$CLIENT_SECRET" ] || { echo "✗ LULU_CLIENT_ID/SECRET blank in .env"; exit 1; }
[ -n "$POD" ] || { echo "✗ LULU_POD_PACKAGE_ID blank in .env"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "✗ curl not found."; exit 1; }

echo "Lulu API base: $BASE"
echo "SKU:           $POD"
echo ""

# ── OAuth ─────────────────────────────────────────────────────────────────────
TOKEN_URL="$BASE/auth/realms/glasstree/protocol/openid-connect/token"
ACCESS=$(curl -s -u "$CLIENT_ID:$CLIENT_SECRET" -d grant_type=client_credentials "$TOKEN_URL" \
  | sed -n 's/.*"access_token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
[ -n "$ACCESS" ] || { echo "✗ OAuth failed — check creds / base URL."; exit 1; }
echo "✓ OAuth token OK (length ${#ACCESS})"

AUTH="Authorization: Bearer $ACCESS"
JSON="Content-Type: application/json"

# Canned US shipping address (create-job schema: country_code).
ADDR='"shipping_address":{"name":"CradleHQ Sandbox Test","street1":"123 Test Street","city":"Los Angeles","state_code":"CA","postcode":"90001","country_code":"US","phone_number":"5551234567"}'

# ── submit mode ───────────────────────────────────────────────────────────────
if [ "${1:-}" = "submit" ]; then
  INTERIOR_URL="${2:-}"; COVER_URL="${3:-}"; PAGES="${4:-100}"
  [ -n "$INTERIOR_URL" ] && [ -n "$COVER_URL" ] || {
    echo "✗ usage: ./lulu-pr5-verify.sh submit <interior_url> <cover_url> [pageCount]"; exit 1; }

  echo ""
  echo "→ Creating a PAID sandbox print job (shipping $SHIPPING_LEVEL, qty 1)…"
  EXT="pr5-verify-$(date +%s)"
  LI="\"line_items\":[{\"title\":\"CradleHQ Memory Book\",\"quantity\":1,\"pod_package_id\":\"$POD\",\"interior\":{\"source_url\":\"$INTERIOR_URL\"},\"cover\":{\"source_url\":\"$COVER_URL\"}}]"
  BODY="{\"contact_email\":\"print@cradlehq.app\",\"external_id\":\"$EXT\",\"shipping_level\":\"$SHIPPING_LEVEL\",$LI,$ADDR}"

  RESP=$(curl -s -X POST "$BASE/print-jobs/" -H "$AUTH" -H "$JSON" -d "$BODY")
  JOB_ID=$(echo "$RESP" | sed -n 's/.*"id"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/p' | head -n1)
  [ -n "$JOB_ID" ] || { echo "✗ create failed: $(echo "$RESP" | head -c 400)"; exit 1; }
  echo "✓ Print job created: id=$JOB_ID (external_id=$EXT)"

  # Poll status while Lulu asynchronously fetches the source_urls.
  echo "→ Polling status (Lulu fetches the PDFs server-side; this is where a bad url shows up)…"
  i=0
  while [ "$i" -lt 12 ]; do
    STAT=$(curl -s "$BASE/print-jobs/$JOB_ID/" -H "$AUTH" \
      | sed -n 's/.*"status"[[:space:]]*:[[:space:]]*{[[:space:]]*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)
    echo "    [$(printf '%02d' $i)] status = ${STAT:-?}"
    case "$STAT" in
      REJECTED|ERROR|CANCELED) echo "✗ Job reached a FAILED status ($STAT) — inspect the line-item messages."; exit 1 ;;
      IN_PRODUCTION|PRODUCTION_READY|SHIPPED|PRODUCTION_DELAYED) echo "✅ Job reached a non-error status ($STAT) — Lulu fetched both PDFs."; exit 0 ;;
    esac
    i=$((i + 1)); sleep 5
  done
  echo "• Still validating after ~60s (last: ${STAT:-?}). Re-check: curl $BASE/print-jobs/$JOB_ID/ -H 'Authorization: Bearer …'"
  exit 0
fi

# ── default (safe) mode: cross-check + cost preview ───────────────────────────
echo ""
echo "── Cover-dimension cross-check (our spine formula vs Lulu's calc) ─────────────"
FAILED=0
for PC in 32 100 400; do
  DIMS=$(curl -s -X POST "$BASE/cover-dimensions/" -H "$AUTH" -H "$JSON" \
    -d "{\"pod_package_id\":\"$POD\",\"interior_page_count\":$PC,\"unit\":\"inch\"}")
  W=$(echo "$DIMS" | sed -n 's/.*"width"[[:space:]]*:[[:space:]]*"\([0-9.]*\)".*/\1/p')
  H=$(echo "$DIMS" | sed -n 's/.*"height"[[:space:]]*:[[:space:]]*"\([0-9.]*\)".*/\1/p')
  if [ -z "$W" ] || [ -z "$H" ]; then echo "  $PC pages: ✗ no dims: $(echo "$DIMS" | head -c 200)"; FAILED=1; continue; fi
  if awk -v pc="$PC" -v w="$W" -v h="$H" -v tw="$TRIM_W" -v th="$TRIM_H" -v b="$BLEED" \
         -v ppi="$PAPER_PPI" -v pad="$SPINE_PAD" -v tol="$TOL" 'BEGIN{
        spine=pc/ppi+pad; cw=2*b+2*tw+spine; ch=2*b+th;
        dw=w-cw; if(dw<0)dw=-dw; dh=h-ch; if(dh<0)dh=-dh; ok=(dw<=tol && dh<=tol);
        printf "  %4d pages: Lulu %sx%s in  vs computed %.4fx%.4f in  ->  %s\n", pc, w, h, cw, ch, (ok?"MATCH":"MISMATCH");
        exit(ok?0:1); }'; then :; else FAILED=1; fi
done
[ "$FAILED" -eq 0 ] && echo "✓ All cover dimensions match within ${TOL}in." || echo "✗ A cover dimension MISMATCHED — reconcile PrintCoverPage.jsx constants."

echo ""
echo "── Cost-calculation preview (100 pages, qty 1, $SHIPPING_LEVEL to US — pr6 sneak-peek) ──"
COST=$(curl -s -X POST "$BASE/print-job-cost-calculations/" -H "$AUTH" -H "$JSON" \
  -d "{\"line_items\":[{\"page_count\":100,\"pod_package_id\":\"$POD\",\"quantity\":1}],$ADDR,\"shipping_level\":\"$SHIPPING_LEVEL\"}")
TOTAL=$(echo "$COST" | sed -n 's/.*"total_cost_incl_tax"[[:space:]]*:[[:space:]]*"\([0-9.]*\)".*/\1/p' | head -n1)
if [ -n "$TOTAL" ]; then
  echo "✓ Cost-calc OK — total incl. tax + shipping = \$$TOTAL USD (print + $SHIPPING_LEVEL shipping)."
else
  echo "✗ Cost-calc failed: $(echo "$COST" | head -c 300)"; FAILED=1
fi

echo ""
[ "$FAILED" -eq 0 ] && echo "✅ pr5 client contract verified against $BASE (no print job created)." \
                     || { echo "✗ One or more checks failed."; exit 1; }
echo "   To run the full submit e2e: ./lulu-pr5-verify.sh submit <interior_url> <cover_url> [pages]  (needs a tunnel)."
