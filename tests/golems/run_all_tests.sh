#!/bin/bash
# PropAIrty full golem test suite runner
# Usage: ./run_all_tests.sh
# Returns: 0 if all pass, 1 if any fail

PYTHON=/root/propairty/backend/venv/bin/python
export PYTHONPATH=/root/propairty/backend
DIR="$(cd "$(dirname "$0")" && pwd)"

TOTAL_PASS=0
TOTAL_FAIL=0
FAILED_SUITES=""

run_suite() {
  local name="$1"
  local file="$2"
  echo "=== $name ==="
  result=$(cd "$DIR" && $PYTHON "$file" 2>&1)
  echo "$result" | grep -E "^(RESULTS|✓|✗|Total:)" | head -20
  pass=$(echo "$result" | grep -oP 'Total: \K[0-9]+(?= passed)')
  fail=$(echo "$result" | grep -oP '[0-9]+(?= failed)')
  # new_features2 uses a different summary line
  if [ -z "$pass" ]; then
    pass=$(echo "$result" | grep -oP 'PASS: \K[0-9]+')
    [ -z "$pass" ] && echo "$result" | grep -q "ALL CHECKS PASSED" && pass="?"
  fi
  TOTAL_PASS=$((TOTAL_PASS + ${pass:-0}))
  TOTAL_FAIL=$((TOTAL_FAIL + ${fail:-0}))
  if [ "${fail:-0}" -gt 0 ]; then
    FAILED_SUITES="$FAILED_SUITES $name"
    echo "FAIL: $fail failed in $name"
  elif echo "$result" | grep -q "ALL CHECKS PASSED"; then
    echo "PASS: all checks passed in $name"
  else
    echo "PASS: all ${pass:-?} passed in $name"
  fi
  echo ""
}

run_suite "full_lifecycle" "scenarios/full_lifecycle.py"
run_suite "new_features"   "scenarios/new_features.py"
run_suite "new_features2"  "scenarios/new_features2.py"

echo "=============================="
echo "GRAND TOTAL: $TOTAL_PASS passed, $TOTAL_FAIL failed"
if [ $TOTAL_FAIL -gt 0 ]; then
  echo "FAILED SUITES:$FAILED_SUITES"
  exit 1
else
  echo "ALL SUITES PASSED"
  exit 0
fi
