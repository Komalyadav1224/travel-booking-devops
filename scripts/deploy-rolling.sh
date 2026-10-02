#!/usr/bin/env bash
# Usage: scripts/deploy-rolling.sh travel-booking:1.1.0
set -euo pipefail
NS=travel-rolling; IMAGE=${1:?usage: $0 <image:tag>}
kubectl -n $NS set image deploy/travel-booking app="$IMAGE"
kubectl -n $NS set env deploy/travel-booking APP_VERSION="${IMAGE##*:}"
kubectl -n $NS rollout status deploy/travel-booking --timeout=180s \
  || { echo "Rollout failed -> rolling back"; kubectl -n $NS rollout undo deploy/travel-booking; exit 1; }
echo "Rolling deployment done: $IMAGE"
