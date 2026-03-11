# e2ectl Roadmap

## Current v1 Baseline

The current CLI baseline is production-oriented for the shipped surface area:

- alias-based auth profiles where each alias stores one API key and bearer-token pair
- optional per-alias defaults for `project_id` and `location`
- command-level context overrides with deterministic `--json` output
- config management, node catalog discovery, node list/get/create/delete
- unit-test coverage plus an explicit manual live-check lane
- CI gates for format, lint, typecheck, tests, and build

## Near-Term Priorities

### 1. Release Readiness

- finalize npm publishing metadata and release workflow
- tighten changelog/versioning discipline for `1.x`
- document the supported compatibility contract for JSON output

### 2. Broader Node Ergonomics

- improve node create UX beyond raw `plan` and `image` flags
- add more guided discovery around valid create inputs
- expand safe defaults only where the backend contract is well understood

### 3. Integration Verification

- add a stronger manual integration runbook for write paths
- decide whether a gated non-production integration suite should exist outside CI
- keep CI itself deterministic and free of live-account dependencies

### 4. Service Expansion

- extend coverage beyond config and node commands
- preserve the same internal client and output contracts as new services are added
- keep human-readable defaults and machine-readable JSON aligned across commands

## Change Management Rules

- update [README.md](../README.md) when the command surface or operator flow changes
- update [docs/DEMO.md](./DEMO.md) when demo or manual verification commands change
- update [CONTRIBUTING.md](../CONTRIBUTING.md) and [docs/MAINTAINING.md](./MAINTAINING.md) when contributor or release workflow changes
- keep [CHANGELOG.md](../CHANGELOG.md) current for user-visible behavior changes
