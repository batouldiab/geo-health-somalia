# Convenience targets (run from Git Bash / WSL on Windows).

.PHONY: dev build typecheck test offline models data up down logs

## frontend dev server with hot reload (http://localhost:5173 and /finder.html)
dev:
	cd frontend && npm run dev

## production build of the frontend (dist/ is a complete static site, data included)
build:
	cd frontend && npm run build

typecheck:
	cd frontend && npm run typecheck

## the place-matcher test over every named place in Bakool (prints the table used in the README)
test:
	cd frontend && node scripts/test-matcher.mjs

## copy the ONNX runtime into public/ort/ and fetch Whisper tiny into public/models/ (once, online)
offline:
	cd frontend && npm run prepare-offline

models:
	python pipeline/fetch_models.py

## rebuild the data files from pipeline/raw/ (needs the raw downloads; see pipeline/README.md)
data:
	python pipeline/build_bakool_health_v1.py && python pipeline/build_buildings_v1.py && python pipeline/postprocess_v1.py

## the production container locally (needs Docker + certs in deploy/certs)
up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f --tail=100
