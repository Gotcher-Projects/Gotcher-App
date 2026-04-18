#!/usr/bin/env bash

# GotcherApp — Run All Tests
#
# Runs Gradle unit tests for the backend and Vitest for the frontend,
# then prints a per-suite summary table with a grand total.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export JAVA_HOME="/c/Program Files/Java/jdk-21"
export PATH="$JAVA_HOME/bin:$PATH:/c/Program Files/nodejs"

DIVIDER="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RULE="──────────────────────────────────────────────────────────────────────────"

echo ""
echo "  GotcherApp — All Tests"
echo "$DIVIDER"
echo ""

grand_run=0; grand_fail=0; grand_err=0; grand_skip=0
grand_pass=0; grand_total_suites=0

declare -a SUITE_RESULTS   # "name | run | fail | err | skip | status"

# ── Backend (Gradle) ──────────────────────────────────────────────────────────

echo "  ── backend (gradle) ──"

BACKEND_DIR="$ROOT_DIR/Backend"

if [ ! -f "$BACKEND_DIR/build.gradle.kts" ]; then
  echo "  [SKIP] No build.gradle.kts found — skipping"
  echo ""
  SUITE_RESULTS+=("backend|—|—|—|—|SKIP")
else
  GRADLE_OUTPUT=$(cd "$BACKEND_DIR" && set -a && [ -f .env ] && source .env; set +a && \
    ./gradlew --no-daemon test 2>&1) || true
  BUILD_SUCCESS=$(echo "$GRADLE_OUTPUT" | grep -c "BUILD SUCCESSFUL" || true)

  svc_run=0; svc_fail=0; svc_err=0; svc_skip=0

  printf "  %-52s  %5s  %4s  %5s  %4s\n" "Test Class" "Run" "Fail" "Error" "Skip"
  echo "  $RULE"

  # Parse Gradle test output (XML report summary lines)
  while IFS= read -r line; do
    class=$(echo "$line" | sed -E 's/.*> //' | sed -E 's/ PASSED.*//' | sed -E 's/ FAILED.*//')
    printf "  %-52s  %s\n" "$class" "$(echo "$line" | grep -oE '(PASSED|FAILED)' || echo '')"
  done < <(echo "$GRADLE_OUTPUT" | grep -E "^\s+[A-Za-z].*Test\s+(PASSED|FAILED)" || true)

  # Parse XML reports for totals
  TEST_REPORT_DIR="$BACKEND_DIR/build/test-results/test"
  if [ -d "$TEST_REPORT_DIR" ]; then
    while IFS= read -r xml; do
      r=$(grep -oP '(?<=tests=")[0-9]+' "$xml" | head -1 || echo 0)
      f=$(grep -oP '(?<=failures=")[0-9]+' "$xml" | head -1 || echo 0)
      e=$(grep -oP '(?<=errors=")[0-9]+' "$xml" | head -1 || echo 0)
      s=$(grep -oP '(?<=skipped=")[0-9]+' "$xml" | head -1 || echo 0)
      svc_run=$((svc_run + r))
      svc_fail=$((svc_fail + f))
      svc_err=$((svc_err + e))
      svc_skip=$((svc_skip + s))
    done < <(find "$TEST_REPORT_DIR" -name "TEST-*.xml" 2>/dev/null)
  fi

  echo "  $RULE"
  printf "  %-52s  %5s  %4s  %5s  %4s\n" "TOTAL" "$svc_run" "$svc_fail" "$svc_err" "$svc_skip"

  if [ "$BUILD_SUCCESS" -gt 0 ] && [ "$svc_fail" -eq 0 ] && [ "$svc_err" -eq 0 ]; then
    BE_STATUS="✅ PASS"
    grand_pass=$((grand_pass + 1))
  else
    BE_STATUS="❌ FAIL"
    echo ""
    echo "  Failures / Errors:"
    echo "$GRADLE_OUTPUT" | grep -E "(FAILED|> Task :test FAILED|AssertionError|expected:)" | head -15 || true
  fi

  SUITE_RESULTS+=("backend|$svc_run|$svc_fail|$svc_err|$svc_skip|$BE_STATUS")
  grand_run=$((grand_run + svc_run))
  grand_fail=$((grand_fail + svc_fail))
  grand_err=$((grand_err + svc_err))
  grand_skip=$((grand_skip + svc_skip))
  grand_total_suites=$((grand_total_suites + 1))

  echo ""
fi

# ── Frontend (Vitest) ─────────────────────────────────────────────────────────

echo "  ── frontend (vitest) ──"

FRONTEND_DIR="$ROOT_DIR/Frontend"

if [ ! -f "$FRONTEND_DIR/package.json" ]; then
  echo "  [SKIP] No package.json found — skipping"
  echo ""
  SUITE_RESULTS+=("frontend|—|—|—|—|SKIP")
else
  FE_EXIT=0
  FE_OUTPUT=$(cd "$FRONTEND_DIR" && NO_COLOR=1 npm test 2>&1) || FE_EXIT=$?

  fe_pass=$(echo "$FE_OUTPUT" | grep -oP '\d+(?= passed)' | tail -1 || echo "0")
  fe_fail=$(echo "$FE_OUTPUT" | grep -oP '\d+(?= failed)'  | tail -1 || echo "0")
  fe_skip=$(echo "$FE_OUTPUT" | grep -oP '\d+(?= skipped)' | tail -1 || echo "0")
  fe_pass=${fe_pass:-0}; fe_fail=${fe_fail:-0}; fe_skip=${fe_skip:-0}
  fe_run=$((fe_pass + fe_fail + fe_skip))

  printf "  %-52s  %5s  %4s\n" "Test File" "Pass" "Fail"
  echo "  $RULE"

  # Print per-file results
  echo "$FE_OUTPUT" | grep -E "✓|×|PASS|FAIL" | grep -v "^$" | head -30 | while IFS= read -r line; do
    printf "  %s\n" "$line"
  done || true

  echo "  $RULE"
  printf "  %-52s  %5s  %4s  %5s  %4s\n" "TOTAL" "$fe_run" "$fe_fail" "0" "$fe_skip"

  if [ "$FE_EXIT" -eq 0 ]; then
    FE_STATUS="✅ PASS"
    grand_pass=$((grand_pass + 1))
  else
    FE_STATUS="❌ FAIL"
    echo ""
    echo "  Failures / Errors:"
    echo "$FE_OUTPUT" | grep -E "(FAIL|AssertionError|Error:)" | head -15 || true
  fi

  SUITE_RESULTS+=("frontend|$fe_run|$fe_fail|0|$fe_skip|$FE_STATUS")
  grand_run=$((grand_run + fe_run))
  grand_fail=$((grand_fail + fe_fail))
  grand_skip=$((grand_skip + fe_skip))
  grand_total_suites=$((grand_total_suites + 1))

  echo ""
fi

# ── Grand summary ──────────────────────────────────────────────────────────────

echo "$DIVIDER"
echo ""
echo "  Summary"
echo ""
printf "  %-25s  %5s  %4s  %5s  %4s  %s\n" "Suite" "Run" "Fail" "Error" "Skip" "Status"
echo "  $RULE"

for entry in "${SUITE_RESULTS[@]}"; do
  IFS='|' read -r sname srun sfail serr sskip sstatus <<< "$entry"
  printf "  %-25s  %5s  %4s  %5s  %4s  %s\n" "$sname" "$srun" "$sfail" "$serr" "$sskip" "$sstatus"
done

echo "  $RULE"
printf "  %-25s  %5s  %4s  %5s  %4s\n" "GRAND TOTAL" "$grand_run" "$grand_fail" "$grand_err" "$grand_skip"
echo ""

if [ "$grand_pass" -eq "$grand_total_suites" ]; then
  echo "  ✅  All $grand_total_suites suite(s) passed — $grand_run tests"
else
  FAILED_COUNT=$((grand_total_suites - grand_pass))
  echo "  ❌  $FAILED_COUNT of $grand_total_suites suite(s) had failures — $grand_fail failure(s), $grand_err error(s)"
fi

echo ""
echo "$DIVIDER"
echo ""

if [ "$grand_fail" -gt 0 ] || [ "$grand_err" -gt 0 ] || [ "$grand_pass" -lt "$grand_total_suites" ]; then
  exit 1
fi
exit 0
