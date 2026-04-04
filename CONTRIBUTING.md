# Contributing

This document is for people changing the `e2ectl` codebase.

If you are using the CLI, start with [README.md](./README.md). If you own CI or promotion readiness, use [docs/MAINTAINING.md](./docs/MAINTAINING.md). If you are cutting a release, use [docs/RELEASING.md](./docs/RELEASING.md).

## Requirements

- Node.js 24+
- npm

## Local Setup

```bash
npm install
make lint
make test
make build
npm run test:integration
```

Useful day-to-day commands:

```bash
make dev
make coverage
node dist/app/index.js --help
npm run coverage:unit
npm run coverage:integration
npm run test:manual
npm run test:manual:smoke
npm pack --dry-run
```

## Branch Roles

- `develop` is the staging branch for ongoing feature integration.
- `main` is the release branch.
- Target `develop` for normal feature work unless the maintainers asked for a release-only change.

## Repository Shape

The maintained v1 source tree is:

```text
src/
  app/
  core/
  myaccount/
  config/
  dns/
  node/
  reserved-ip/
  security-group/
  volume/
  vpc/
  ssh-key/
```

Domain ownership:

- `src/app/` wires Commander, runtime services, stdout/stderr, prompts, config store, and domain factories.
- `src/core/` contains low-level shared helpers such as errors, deterministic JSON helpers, and masking.
- `src/myaccount/` owns shared API transport, credential validation, request/response typing, and centralized API failure handling.
- `src/config/` owns profile persistence, import parsing, alias/default-context behavior, and auth/context resolution.
- `src/dns/` owns DNS zone and record workflows plus DNS verification output.
- `src/node/` owns node discovery, create/delete flows, actions, and output shaping.
- `src/reserved-ip/` owns reserved IP inventory, attach/detach, reserve-on-delete, and output shaping.
- `src/security-group/` owns security group CRUD flows and rules-file handling.
- `src/volume/` owns volume list/get/delete, plans, create flows, and output shaping.
- `src/vpc/` owns VPC list/get/delete, plans, create flows, and output shaping.
- `src/ssh-key/` owns SSH key list/get/delete, create flows, and output shaping.

Architectural rules:

- Commands stay thin. `command.ts` files define the CLI surface and delegate immediately.
- Services orchestrate CLI validation, defaults, prompts, and cross-domain workflows. They do not own rendering.
- Clients own reusable API paths and response parsing.
- Formatters own human-readable output and deterministic `--json` output.
- When adding new domains or cleaning existing ones, keep the same seam: `command.ts` for Commander wiring, `service.ts` for CLI orchestration, `client.ts` for reusable API access, and `formatter.ts` for rendering.
- Generic API failure handling stays centralized in `src/myaccount/transport.ts`.
- Cross-domain imports should go through each domain `index.ts`.
- Prefer small, explicit implementations over speculative abstractions.

## Verification Contract

Before asking for review, run the local gate:

```bash
make lint
make test
make build
npm run test:integration
npm run coverage:unit
npm pack --dry-run
```

What this covers:

- `make lint`: formatting check, ESLint, and TypeScript `--noEmit`
- `make test`: unit tests
- `make build`: production compile
- `npm run test:integration`: built CLI process checks, fake-API coverage, and tarball install smoke
- `npm run coverage:unit`: unit tests with the enforced 80% coverage floor used by CI
- `npm pack --dry-run`: publishable package preview

The maintainer-owned CI policy and promotion gate live in [docs/MAINTAINING.md](./docs/MAINTAINING.md).

## Testing Expectations

- Put unit tests under `tests/unit/<domain>/`.
- Put integration tests under `tests/integration/<domain>/`.
- Add or update tests in the domain you touched instead of broad unrelated changes.
- Treat `--json` output as a contract whenever command behavior or formatters change.
- Unit and integration coverage reports are written under `coverage/unit/` and `coverage/integration/`.
- Run `make coverage` when you want both reports locally.
- `npm run coverage:integration` rebuilds `dist/` first and measures the spawned CLI process, not just the Vitest runner.
- Manual live checks stay opt-in:

```bash
E2ECTL_RUN_MANUAL_E2E=1 \
E2E_API_KEY=<api-key> \
E2E_AUTH_TOKEN=<auth-token> \
E2E_PROJECT_ID=<project-id> \
E2E_LOCATION=<location> \
npm run test:manual
```

- Destructive smoke is a separate lane. Run it only when you explicitly need live create/update/delete coverage and have already built the CLI:

```bash
make build
npm run test:manual:smoke
```

- The smoke env contract and cleanup flow live in [README.md](./README.md), [docs/MAINTAINING.md](./docs/MAINTAINING.md), and [docs/RELEASING.md](./docs/RELEASING.md).
- Do not run the destructive lane automatically in normal feature work.

## Documentation Expectations

Every user-visible behavior change should ship with:

- tests
- docs updates
- examples validated against the real CLI surface

Update docs by audience:

- [README.md](./README.md) for operator-facing usage and onboarding
- [CONTRIBUTING.md](./CONTRIBUTING.md) for contributor workflow and architecture rules
- [docs/MAINTAINING.md](./docs/MAINTAINING.md) for CI, branch, and readiness policy
- [docs/RELEASING.md](./docs/RELEASING.md) for maintainer release mechanics

Keep one clear home for each repeated fact instead of pasting the same explanation into every doc. Do not leave stale command examples behind after behavior changes.

## Conventional Commits And Release Please

- Use Conventional Commits such as `feat:`, `fix:`, and `chore:`.
- Use `feat!:` or a `BREAKING CHANGE:` footer only for intentional breaking changes.
- Release Please owns version bumps and [CHANGELOG.md](./CHANGELOG.md) on `main`.
- Do not hand-edit `package.json` versions or changelog entries in normal feature work.
- If release automation changes, update [docs/RELEASING.md](./docs/RELEASING.md) in the same PR.

## Pull Requests

- Keep changes scoped and reviewable.
- Avoid broad refactors when implementing a narrow fix or feature.
- Target `develop` unless maintainers asked for a release-only exception.
- Include the verification commands you actually ran.
- Call out doc updates when operator flow, contributor workflow, CI expectations, or release mechanics changed.
