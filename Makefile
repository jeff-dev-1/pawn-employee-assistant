.PHONY: help dev demo down logs check smoke ac

help:
	@echo "make dev    - run all four processes locally (needs Node >= 20.9)"
	@echo "make demo   - docker compose up -d --build (needs Docker)"
	@echo "make down   - stop and remove the stack"
	@echo "make logs   - follow all container logs"
	@echo "make check  - typecheck + tests"
	@echo "make smoke  - protocol-level acceptance against every registered server"
	@echo "make ac     - check + smoke"

dev:
	npm run dev

demo:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f

check:
	npm run typecheck && npm test

smoke:
	npm run smoke

ac: check smoke
	@echo "acceptance: types, tests and protocol all pass"
