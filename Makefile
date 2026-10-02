install: ; npm install
test: ; npm test
run: ; npm start
up: ; docker compose up -d --build
down: ; docker compose down
scan: ; ./scripts/security-scan.sh
k8s-rolling: ; kubectl apply -f k8s/rolling/all.yaml
k8s-bluegreen: ; kubectl apply -f k8s/bluegreen/all.yaml
