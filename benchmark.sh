#!/usr/bin/env bash
#
# Token-Zip Benchmark Script
# Compares direct API call vs Token-Zip proxy for the same queries.
#
# Usage:
#   1. Start the token-zip server:  npm run dev
#   2. Set env vars (or edit below):
#      export DIRECT_API_KEY="your-key"
#      export DIRECT_BASE_URL="https://api.anthropic.com/v1"
#      export DIRECT_MODEL="claude-opus-4-6"
#   3. Run:  bash benchmark.sh

set -euo pipefail

TOKEN_ZIP_URL="${TOKEN_ZIP_URL:-http://localhost:3000/v1/chat/completions}"
DIRECT_BASE_URL="${DIRECT_BASE_URL:?Set DIRECT_BASE_URL (e.g. https://api.anthropic.com/v1)}"
DIRECT_API_KEY="${DIRECT_API_KEY:?Set DIRECT_API_KEY}"
DIRECT_MODEL="${DIRECT_MODEL:-claude-opus-4-6}"

QUERIES=(
  'Explain the difference between TCP and UDP in detail with examples.'
  'What are the SOLID principles in object-oriented programming? Give code examples for each.'
  'Design a database schema for an e-commerce platform. Cover users, products, orders, payments, and reviews.'
)

sep() { printf '%0.s─' {1..70}; echo; }

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                   Token-Zip Benchmark                          ║"
echo "╠══════════════════════════════════════════════════════════════════╣"
echo "║  Direct: $DIRECT_MODEL"
echo "║  Proxy:  Token-Zip → $DIRECT_MODEL"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo

total_direct_cost=0
total_zip_cost=0

for i in "${!QUERIES[@]}"; do
  query="${QUERIES[$i]}"
  idx=$((i + 1))
  sep
  echo "Query $idx: ${query:0:80}..."
  sep

  # --- Direct call ---
  echo -n "  Direct call... "
  direct_start=$(python3 -c "import time; print(time.time())")
  direct_result=$(curl -s "$DIRECT_BASE_URL/chat/completions" \
    -H "Authorization: Bearer $DIRECT_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"$DIRECT_MODEL\",\"messages\":[{\"role\":\"user\",\"content\":$(echo "$query" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read().strip()))')}],\"max_tokens\":8192}")
  direct_end=$(python3 -c "import time; print(time.time())")

  direct_in=$(echo "$direct_result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('usage',{}).get('prompt_tokens',0))")
  direct_out=$(echo "$direct_result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('usage',{}).get('completion_tokens',0))")
  direct_time=$(python3 -c "print(f'{$direct_end - $direct_start:.1f}')")
  direct_cost=$(python3 -c "print(f'{$direct_in * 5 / 1e6 + $direct_out * 25 / 1e6:.6f}')")
  echo "${direct_time}s | ${direct_in} in / ${direct_out} out | \$${direct_cost}"

  # --- Token-Zip call ---
  echo -n "  Token-Zip...   "
  zip_start=$(python3 -c "import time; print(time.time())")
  zip_result=$(curl -s "$TOKEN_ZIP_URL" \
    -H "Content-Type: application/json" \
    -d "{\"messages\":[{\"role\":\"user\",\"content\":$(echo "$query" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read().strip()))')}]}")
  zip_end=$(python3 -c "import time; print(time.time())")

  zip_stats=$(echo "$zip_result" | python3 -c "
import sys,json
d=json.load(sys.stdin)
s=d.get('token_zip_stats',{})
sv=s.get('savings',{})
cw=s.get('costWithoutZip',{})
cz=s.get('costWithZip',{})
print(f\"{s.get('compressedInputTokens',0)} {s.get('compressedOutputTokens',0)} {cz.get('amountUSD',0):.6f} {sv.get('percentage',0)}\")
")
  zip_in=$(echo "$zip_stats" | awk '{print $1}')
  zip_out=$(echo "$zip_stats" | awk '{print $2}')
  zip_cost=$(echo "$zip_stats" | awk '{print $3}')
  zip_pct=$(echo "$zip_stats" | awk '{print $4}')
  zip_time=$(python3 -c "print(f'{$zip_end - $zip_start:.1f}')")
  echo "${zip_time}s | ${zip_in} in / ${zip_out} out | \$${zip_cost} (saved ${zip_pct}%)"

  total_direct_cost=$(python3 -c "print($total_direct_cost + $direct_cost)")
  total_zip_cost=$(python3 -c "print($total_zip_cost + $zip_cost)")
  echo
done

sep
echo "TOTAL"
sep
savings_pct=$(python3 -c "d=$total_direct_cost; z=$total_zip_cost; print(f'{(d-z)/d*100:.1f}' if d>0 else '0')")
echo "  Direct total cost:    \$${total_direct_cost}"
echo "  Token-Zip total cost: \$${total_zip_cost}"
echo "  💰 Total saved:       \$$(python3 -c "print(f'{$total_direct_cost - $total_zip_cost:.6f}')") (${savings_pct}%)"
