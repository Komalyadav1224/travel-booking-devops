#!/usr/bin/env bash
set -euo pipefail
NS=travel-bg
CURRENT=$(kubectl -n $NS get svc travel-booking -o jsonpath='{.spec.selector.version}')
if [ "$CURRENT" = "blue" ]; then OLD=green; else OLD=blue; fi
kubectl -n $NS scale deploy/travel-$OLD --replicas=2
kubectl -n $NS rollout status deploy/travel-$OLD --timeout=120s
kubectl -n $NS patch svc travel-booking -p "{\"spec\":{\"selector\":{\"app\":\"travel-booking\",\"version\":\"$OLD\"}}}"
echo "Rolled back to $OLD"
