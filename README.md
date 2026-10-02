# Travel Booking System – Complete DevOps Project

Node.js/Express app (destinations, packages, bookings) + full DevOps lifecycle.

| Requirement | Where |
|---|---|
| Travel booking app | `src/`, `public/` |
| CI/CD lifecycle | `.github/workflows/ci-cd.yml` |
| Automated testing | `tests/` (Jest + Supertest, `npm test`) |
| Docker | `Dockerfile`, `docker-compose.yml` |
| Kubernetes | `k8s/` |
| Deployment automation | `scripts/`, `Makefile` |
| Blue-Green / Rolling | `k8s/bluegreen`, `k8s/rolling`, `scripts/deploy-*.sh` |
| Monitoring | `/metrics`, Prometheus + Grafana (`monitoring/`) |
| Logging | Structured JSON logs (pino) -> `docker logs` / `kubectl logs` |
| Security scanning | `npm audit` + Trivy (`scripts/security-scan.sh`, CI), helmet, non-root container |

## API
`GET /health` `GET /ready` `GET /metrics` `GET /api/info`
`GET|POST /api/destinations` · `GET /api/packages?destinationId=1`
`GET|POST /api/bookings` · `DELETE /api/bookings/:id`

## Run
1. Local: `npm install && npm test && npm start` -> http://localhost:3000
2. Docker stack: `docker compose up -d --build` -> app :3000, Prometheus :9090, Grafana :3001 (admin/admin)
3. Kubernetes (minikube): see below.

## Kubernetes
```
minikube start
minikube image load travel-booking:1.0.0      # after docker compose build
kubectl apply -f k8s/rolling/all.yaml         # rolling
kubectl apply -f k8s/bluegreen/all.yaml       # blue-green
minikube service travel-booking -n travel-rolling --url
minikube service travel-booking -n travel-bg --url
```
Release v1.1.0: change something, `docker build -t travel-booking:1.1.0 .`, `minikube image load travel-booking:1.1.0`, then
`scripts/deploy-rolling.sh travel-booking:1.1.0` or `scripts/deploy-bluegreen.sh travel-booking:1.1.0`.
Instant rollback (blue-green): `scripts/rollback-bluegreen.sh`; rolling: `kubectl -n travel-rolling rollout undo deploy/travel-booking`.

## Monitoring
Prometheus -> http://localhost:9090 (try `rate(http_request_duration_seconds_count[1m])`, `bookings_created_total`).
Grafana -> http://localhost:3001, Prometheus datasource is pre-provisioned; create a dashboard from the metrics.

## CI/CD secrets (GitHub)
`KUBE_CONFIG` = base64 of your kubeconfig. Images are pushed to GHCR.
