.DEFAULT_GOAL := help

include make/lint.mk
include make/test.mk
include make/build.mk
include make/push.mk
include make/sonar.mk

.PHONY: help dev up down _clean

help:
	@printf "Available targets:\n"
	@printf "  make dev      Run the CLI in development mode\n"
	@printf "  make up       No-op for this repository\n"
	@printf "  make down     No-op for this repository\n"
	@printf "  make lint     Run format check, ESLint, and typecheck\n"
	@printf "  make test     Run unit tests\n"
	@printf "  make coverage Run unit and integration coverage reports\n"
	@printf "  make build    Build the CLI\n"
	@printf "  make _clean   Remove generated artefacts\n"
	@printf "  make push     Placeholder for package publish flow\n"
	@printf "  make sonar    Placeholder for SonarQube integration\n"

dev:
	npm run dev -- --help

up:
	@echo "No background services to start for e2ectl."

down:
	@echo "No background services to stop for e2ectl."

_clean:
	node ./scripts/clean.mjs
