# Contributing

## Requirements

- Node.js 18+
- npm

## Local Workflow

```bash
npm install
make lint
make test
make build
```

Useful commands:

```bash
make dev
npm run test:manual
```

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
- `src/myaccount/transport.ts` owns generic HTTP execution and generic API failure handling. Do not duplicate backend error translation in `node/client.ts` or future service clients.
- Deterministic `--json` output is a compatibility contract. Review key order, field names, null handling, and sorting before merging changes.
- Import across domains only via that domain's `index.ts`. Do not reach into another domain's internal files.
- Do not introduce placeholder abstractions. If a file or type does not serve the current v1 scope, do not add it.

## Verification Contract

- `make lint` runs formatting checks, ESLint, and `tsc --noEmit`
- `make test` runs unit tests only
- `make build` verifies the production compile
- `npm run test:manual` is for explicit read-only live API checks and stays skipped unless `E2ECTL_RUN_MANUAL_E2E=1`

Do not merge changes without running the relevant local gate first.

## Behavior Changes

Every user-visible behavior change requires:

- unit tests
- docs updates
- deterministic `--json` output review

This includes command help text, prompt/confirmation flow, error wording that operators rely on, and machine-facing JSON fields.

## Testing Expectations

- Manual live API tests are never part of normal CI.
- CI runs `make lint`, `make test`, and `make build`.
- Prefer unit coverage at the domain level and keep the seams explicit:
  - `tests/unit/app/`
  - `tests/unit/core/`
  - `tests/unit/myaccount/`
  - `tests/unit/config/`
  - `tests/unit/node/`
- `tests/unit/myaccount/` covers transport behavior, request construction, and centralized error handling.
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
- Prefer the boring solution over introducing new layers.

## CI Triggers

GitHub Actions runs for:

- pushes to `main`
- all pull requests

The CI matrix covers Node `18`, `20`, and `22`.
