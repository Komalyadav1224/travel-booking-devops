#!/usr/bin/env bash
# Usage: scripts/deploy-bluegreen.sh travel-booking:1.1.0
set -euo pipefail
NS=travel-bg; IMAGE=${1:?usage: $0 <image:tag>}
CURRENT=$(kubectl -n $NS get svc travel-booking -o jsonpath='{.spec.selector.version}')
if [ "$CURRENT" = "blue" ]; then NEW=green; else NEW=blue; fi
echo "Live: $CURRENT  ->  Deploying to idle: $NEW"
kubectl -n $NS set image deploy/travel-$NEW app="$IMAGE"
kubectl -n $NS set env deploy/travel-$NEW APP_VERSION="${IMAGE##*:}"
kubectl -n $NS scale deploy/travel-$NEW --replicas=2
kubectl -n $NS rollout status deploy/travel-$NEW --timeout=180s
echo "Smoke test on $NEW..."
kubectl -n $NS port-forward deploy/travel-$NEW 18080:3000 >/dev/null & PF=$!
sleep 3
if ! curl -fsS http://localhost:18080/health >/dev/null; then kill $PF; echo "Smoke test failed. Live traffic untouched."; exit 1; fi
kill $PF
kubectl -n $NS patch svc travel-booking -p "{\"spec\":{\"selector\":{\"app\":\"travel-booking\",\"version\":\"$NEW\"}}}"
echo "Traffic switched to $NEW. Old ($CURRENT) kept for instant rollback: scripts/rollback-bluegreen.sh"
