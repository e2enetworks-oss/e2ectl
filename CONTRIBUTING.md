# Contributing

## Requirements

- Node.js 18+
- npm

## Start Here

Before changing code:

1. Read [README.md](./README.md) for the operator-facing workflow.
2. Read [docs/MAINTAINING.md](./docs/MAINTAINING.md) for CI and maintenance expectations.
3. Run the local gate:

```bash
npm install
make lint
make test
make build
npm run test:integration
npm pack --dry-run
```

## Documentation Boundaries

- `README.md` is the operator and first-time-user guide.
- `CONTRIBUTING.md` is the contributor workflow, architecture, and verification contract.
- `docs/MAINTAINING.md` is the maintainer guide for CI, staging, and release readiness checks.
- `docs/RELEASING.md` is the release and npm publishing runbook.

## Local Workflow

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
npm run test:integration
npm run test:manual
node dist/app/index.js --help
npm pack --dry-run
```

For release automation and npm publish flow, read [docs/RELEASING.md](./docs/RELEASING.md).

## Branch Roles

- `develop` is the staging branch for pre-v1 integration and hardening work.
- `main` is the release branch.
- Pull requests into `develop` run both the fast gate and the full staging gate.
- Merges into `develop` rerun the full staging gate on the merged branch tip.
- Promotion from `develop` to `main` reruns the full gate before release automation on `main`.

## Architecture Contract

This repository is organized as a production-oriented v1 CLI. Keep the source tree in this shape:

```text
src/
  app/
    index.ts
    program.ts
    runtime.ts

  core/
    errors.ts
    json.ts
    mask.ts

  myaccount/
    transport.ts
    credential-validator.ts
    types.ts
    index.ts

  config/
    index.ts
    command.ts
    service.ts
    resolver.ts
    store.ts
    import-file.ts
    formatter.ts
    types.ts

  node/
    index.ts
    client.ts
    command.ts
    service.ts
    formatter.ts
    defaults.ts
    types.ts
```

### Domain Ownership

- `app/` is bootstrap only. It wires the Commander program, runtime, stdout/stderr, prompts, store, shared transport, and domain client factories.
- `core/` contains shared low-level primitives only: errors, deterministic JSON helpers, and secret masking.
- `myaccount/` is shared transport only: request execution, API envelope typing, credential validation, and centralized API failure handling.
- `config/` owns alias storage, import parsing, default alias/default context behavior, and auth/context resolution.
- `node/` owns node workflows, node create defaults, node-specific API parsing, and node-specific rendering.

### Architectural Rules

- Commands stay thin. `command.ts` files define CLI surface area and delegate business logic.
- Services orchestrate validation, confirmation, defaults, and auth/context resolution. They should not print output or manually serialize JSON.
- Service clients own endpoint paths and success-shape parsing. They return typed data to services.
- Formatters own both human-readable rendering and deterministic `--json` rendering.
- Keep Commander usage-error normalization centralized at the app boundary so CLI usage failures follow the same error contract as service/domain failures.
- `src/myaccount/transport.ts` owns generic HTTP execution and generic API failure handling. Do not duplicate backend error translation in `node/client.ts` or future service clients.
- If a future endpoint returns a different success body, add a transport-level response parser instead of re-implementing auth, timeout, or API failure handling in the domain client.
- Deterministic `--json` output is a compatibility contract. Review key order, field names, null handling, and sorting before merging changes.
- Import across domains only via that domain's `index.ts`. Do not reach into another domain's internal files.
- Do not introduce placeholder abstractions. If a file or type does not serve the current v1 scope, do not add it.

### Adding A New Domain

For new services such as `volume` or `vpc`, keep the existing domain shape:

- `src/<domain>/command.ts` for CLI surface only
- `src/<domain>/service.ts` for workflow orchestration
- `src/<domain>/client.ts` for endpoint paths and success parsing
- `src/<domain>/formatter.ts` for human and deterministic JSON output

Reuse `config/resolver.ts` for credential/context resolution and keep shared MyAccount request execution inside `src/myaccount/transport.ts`.

## Verification Contract

- `make lint` runs formatting checks, ESLint, and `tsc --noEmit`
- `make test` runs unit tests only
- `make build` verifies the production compile
- `npm run test:integration` runs the process-level and fake-API integration lane
- `npm pack --dry-run` verifies the publishable package contents locally
- `npm run test:manual` is for explicit read-only live API checks and stays skipped unless `E2ECTL_RUN_MANUAL_E2E=1`

Do not merge changes without running the relevant local gate first.

## Behavior Changes

Every user-visible behavior change requires:

- unit tests
- docs updates
- deterministic `--json` output review
- verification that README examples still match the real CLI help surface when you touch commands or flags

This includes command help text, prompt/confirmation flow, error wording that operators rely on, and machine-facing JSON fields.

## Release Automation

- `main` is expected to stay releaseable.
- Use Conventional Commits on merged PRs so Release Please can derive the right version bump.
- Do not hand-edit `package.json` versions outside the release PR flow.
- The first public prerelease is forced with a commit body that contains `Release-As: 1.0.0-rc.1`.
- The first stable release is forced with a commit body that contains `Release-As: 1.0.0`.
- GitHub release automation and npm publish activation steps live in [docs/RELEASING.md](./docs/RELEASING.md).

## Testing Expectations

- Integration tests live under `tests/integration/`.
- Integration tests exercise the compiled CLI process, temporary `HOME` directories, a fake local MyAccount server, and a local tarball install smoke path.
- The integration lane uses the internal `E2ECTL_MYACCOUNT_BASE_URL` override so the built CLI can talk to the fake server without hitting live APIs.
- Manual live API tests are never part of normal CI.
- Fast PR checks run `make lint`, `make test`, and `make build`.
- The full staging/promotion gate additionally runs `npm run test:integration` and `npm pack --dry-run`.
- Prefer unit coverage at the domain level and keep the seams explicit:
  - `tests/unit/app/`
  - `tests/unit/core/`
  - `tests/unit/myaccount/`
  - `tests/unit/config/`
  - `tests/unit/node/`
- Keep integration coverage focused on real CLI behavior:
  - `tests/integration/app/`
  - `tests/integration/config/`
  - `tests/integration/node/`
- `tests/unit/myaccount/` covers transport behavior, request construction, and centralized error handling.
- `tests/unit/app/` covers CLI entrypoint behavior such as usage-error normalization and exit paths.
- `tests/unit/config/` covers secure and atomic config persistence in addition to command behavior.
- `tests/unit/node/` covers node client endpoint parsing plus command/service behavior such as defaults, prompts, and output.

## Manual API Checks

The manual suite is intentionally excluded from CI. To run it:

```bash
E2ECTL_RUN_MANUAL_E2E=1 \
E2E_API_KEY=<api-key> \
E2E_AUTH_TOKEN=<token> \
E2E_PROJECT_ID=<project-id> \
E2E_LOCATION=Delhi \
npm run test:manual
```

Optional:

- `E2ECTL_MANUAL_NODE_ID` to exercise the live `node get` path

The default manual suite verifies:

- OS catalog discovery
- plan and image catalog discovery
- node list

## Pull Requests

- Keep changes scoped and reviewable.
- Update docs when command behavior, operator flow, architecture rules, or CI expectations change.
- Keep JSON output deterministic for automation.
- When touching install, config, auth, or node-read flows, verify the first-time operator path from a clean temp `HOME` before merging.
- Prefer the boring solution over introducing new layers.

## CI Triggers

GitHub Actions runs for:

- pull requests to `develop`
- pull requests to `main`
- merge queue (`merge_group`) checks for `main`
- pushes to `develop` for the full staging gate

- `ci.yml` is the fast gate and covers Node `18`, `20`, and `22`.
- `integration.yml` is the full staging and promotion gate, runs on Node `22`, and is required on pull requests to both `develop` and `main`.
