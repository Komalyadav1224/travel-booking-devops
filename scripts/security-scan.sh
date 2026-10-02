#!/usr/bin/env bash
# Local security scan: dependency audit + Trivy (via Docker) on filesystem and image
set -euo pipefail
npm audit --audit-level=high || true
docker run --rm -v "$PWD":/src aquasec/trivy:latest fs --severity HIGH,CRITICAL /src
docker build -t travel-booking:scan .
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image --severity HIGH,CRITICAL travel-booking:scan
