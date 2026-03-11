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

## Verification Contract

- `make lint` runs formatting checks, ESLint, and `tsc --noEmit`
- `make test` runs unit tests only
- `make build` verifies the production compile
- `npm run test:manual` is for explicit read-only live API checks and stays skipped unless `E2ECTL_RUN_MANUAL_E2E=1`

Do not merge changes without running the relevant local gate first.

## Pull Requests

- Keep changes milestone-scoped and reviewable.
- Update docs when command behavior, operator flow, or CI expectations change.
- Prefer deterministic `--json` behavior for any machine-facing output changes.
- Add or update unit tests with every user-visible behavior change.

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

## CI Triggers

GitHub Actions runs for:

- pushes to `main`
- all pull requests

The CI matrix covers Node `18`, `20`, and `22`.
