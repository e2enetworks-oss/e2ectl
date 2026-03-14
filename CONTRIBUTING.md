# Contributing

This document is for contributors working on the `e2ectl` codebase.

If you are trying to use the CLI, start with [README.md](./README.md).
If you maintain CI or releases, also read [docs/MAINTAINING.md](./docs/MAINTAINING.md) and [docs/RELEASING.md](./docs/RELEASING.md).

## Requirements

- Node.js 18+
- npm

## Local Setup

```bash
npm install
make lint
make test
make build
npm run test:integration
```

Useful commands:

```bash
make dev
node dist/app/index.js --help
npm run test:manual
npm pack --dry-run
```

## Scope Of This Document

Use each doc for one audience:

- [README.md](./README.md): operator-facing usage and onboarding
- [CONTRIBUTING.md](./CONTRIBUTING.md): contributor workflow, architecture, and verification rules
- [docs/MAINTAINING.md](./docs/MAINTAINING.md): CI, branch policy, and maintenance checks
- [docs/RELEASING.md](./docs/RELEASING.md): release and npm publishing runbook

Do not move contributor or CI internals into `README.md` unless an operator truly needs them.

## Branch Roles

- `develop` is the staging branch for pre-v1 integration and hardening
- `main` is the release branch
- target `develop` for normal feature work
- promotion from `develop` to `main` reruns the full gate before release automation

## Architecture Contract

The maintained v1 source tree is:

```text
src/
  app/
  core/
  myaccount/
  config/
  node/
  volume/
  vpc/
  ssh-key/
```

### Domain ownership

- `app/` is bootstrap only. It wires the Commander program, runtime, stdout/stderr, prompts, config store, transport, and domain factories.
- `core/` contains shared low-level helpers such as errors, deterministic JSON helpers, and masking.
- `myaccount/` owns shared request execution, credential validation, API envelope typing, and centralized API failure handling.
- `config/` owns profile persistence, import parsing, alias/default-context behavior, and auth/context resolution.
- `node/` owns node discovery, create/delete flows, node actions, node-specific parsing, and node rendering.
- `volume/` owns block storage list/plans/create flows, size-to-IOPS resolution, and volume output shaping.
- `vpc/` owns VPC list/plans/create flows, CIDR validation, and VPC output shaping.
- `ssh-key/` owns SSH key list/create flows, file or stdin loading, and SSH key output shaping.

### Architectural rules

- Commands stay thin. `command.ts` defines CLI surface area and delegates immediately.
- Services orchestrate validation, defaults, prompts, and cross-domain workflows.
- Clients own endpoint paths and success-shape parsing.
- Formatters own human-readable output and deterministic `--json`.
- Generic API failure handling stays centralized in `src/myaccount/transport.ts`.
- Cross-domain imports go through each domain `index.ts`, not internal files.
- Clean up accidental pre-release JSON shapes before carrying them into `1.0.0`.
- Do not introduce placeholder abstractions or speculative generic layers.

## Verification Contract

Before opening or merging a PR, run the relevant local gate:

```bash
make lint
make test
make build
npm run test:integration
npm pack --dry-run
```

What the gate covers:

- `make lint`: formatting, ESLint, and TypeScript `--noEmit`
- `make test`: unit tests
- `make build`: production compile
- `npm run test:integration`: process-level and fake-API integration tests
- `npm pack --dry-run`: publishable package preview

Manual live checks remain opt-in:

```bash
E2ECTL_RUN_MANUAL_E2E=1 \
E2E_API_KEY=<api-key> \
E2E_AUTH_TOKEN=<token> \
E2E_PROJECT_ID=<project-id> \
E2E_LOCATION=Delhi \
npm run test:manual
```

## Testing Expectations

- Put unit tests under `tests/unit/<domain>/`
- Put integration tests under `tests/integration/<domain>/`
- Keep integration tests focused on real CLI behavior, fake-API request verification, and package smoke checks
- Treat `--json` output as a contract and review it whenever commands or response shaping changes
- Prefer adding or updating tests in the domain you touched rather than broad unrelated changes

Every user-visible behavior change should include:

- tests
- docs updates
- example validation against the real CLI surface

## Behavior Changes

If you change command behavior, also update:

- user-facing examples in [README.md](./README.md)
- contributor or maintenance rules here or in [docs/MAINTAINING.md](./docs/MAINTAINING.md) when process expectations changed
- release guidance in [docs/RELEASING.md](./docs/RELEASING.md) if release flow changes

Do not ship behavior changes with stale command examples.

## Conventional Commits And Releases

Release Please owns versioning and changelog generation on `main`.

- Use Conventional Commits such as `feat:`, `fix:`, and `chore:`
- Use `feat!:` or a `BREAKING CHANGE:` footer only for intentional breaking changes
- Do not hand-edit `package.json` versions outside the release PR flow
- Do not hand-edit [CHANGELOG.md](./CHANGELOG.md) in normal feature PRs
- Release override markers and first-release procedures live in [docs/RELEASING.md](./docs/RELEASING.md)

## Pull Requests

- Keep changes scoped and reviewable
- Update docs whenever operator flow, contributor workflow, CI expectations, or release mechanics change
- Keep JSON output deterministic for automation
- Avoid broad refactors when implementing a narrow feature slice
- Run the relevant local gate before asking for review
