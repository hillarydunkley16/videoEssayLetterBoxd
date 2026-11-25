#!/usr/bin/env bash
# usage: lh-median.sh <url> <outdir> [runs]
# Runs Lighthouse N times with APPLIED throttling (devtools: Slow 4G + 4x CPU, so the
# metrics are what the browser actually did, not Lantern's simulation) and prints medians.
# Primary metric is observed First Paint (closest Lighthouse gets to "Start Render").
set -euo pipefail
URL="$1"; OUT="$2"; RUNS="${3:-5}"
mkdir -p "$OUT"
rm -f "$OUT"/run*.json
export CHROME_PATH="${CHROME_PATH:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
for i in $(seq 1 "$RUNS"); do
  npx --yes lighthouse "$URL" --only-categories=performance --output=json \
    --throttling-method=devtools \
    --output-path="$OUT/run$i.json" --quiet \
    --chrome-flags="--headless=new --no-sandbox" >/dev/null 2>&1 || echo "run $i failed"
done
python3 -I - "$OUT" <<'EOF'
import json, glob, statistics, sys
runs = [json.load(open(f)) for f in sorted(glob.glob(sys.argv[1] + "/run*.json"))]
print(f"{len(runs)} runs (throttling: devtools)")

def row(label, vals):
    print(f"{label:22} median={statistics.median(vals):9.2f}  all={[round(v, 2) for v in vals]}")

# First Paint isn't its own audit; it lives in the metrics audit details.
row("First Paint ms", [r["audits"]["metrics"]["details"]["items"][0]["observedFirstPaint"] for r in runs])
for label, k in {
    "FCP ms": "first-contentful-paint",
    "LCP ms": "largest-contentful-paint",
    "Speed Index ms": "speed-index",
    "TBT ms": "total-blocking-time",
    "CLS": "cumulative-layout-shift",
}.items():
    row(label, [r["audits"][k]["numericValue"] for r in runs])
EOF
