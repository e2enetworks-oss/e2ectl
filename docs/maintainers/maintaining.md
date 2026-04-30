# Maintaining e2ectl

This document is for maintainers who own branch policy, CI health, promotion readiness, and live verification.

For contributor workflow, use [CONTRIBUTING.md](../../CONTRIBUTING.md). For release execution, use [releasing.md](./releasing.md).

## Branch Policy

- `develop` is the integration and hardening branch.
- `main` is the release branch.
- Land normal feature work in `develop` first.
- Promote only a green `develop` commit to `main`.
- Keep `main` protected behind pull request checks and merge queue policy where configured.

## CI And Promotion Gate

The reference contract is [`.github/workflows/verify.yml`](../../.github/workflows/verify.yml).

Linux is the authoritative promotion gate:

```bash
make lint
npm run docs:check
npm run coverage:unit
npm run coverage:integration
env npm_config_cache=/tmp/e2ectl-npm-cache npm pack --dry-run
```

The CI matrix is:

- Linux: full gate with lint, docs check, unit coverage upload, integration coverage upload, and package dry run
- macOS: build, unit-test, integration, and package confidence
- Windows: package install, help, and `--json` smoke

Notes:

- Public runtime support starts at Node.js 24.
- Linux uploads both `coverage/unit/lcov.info` and `coverage/integration/lcov.info` to Codecov using the `unit` and `integration` flags.
- `release-please.yml` stays smaller than `verify.yml`: release-time verification is Linux-only, while cross-platform confidence happens before promotion.
- `E2ECTL_MYACCOUNT_BASE_URL` is used in CI to point the built CLI at the fake MyAccount API.

## Manual Live Verification

Live lanes are strongly recommended before the first public release and future release candidates, but they are not mandatory CI or branch-protection gates.

Build the CLI first:

```bash
make build
```

Live tests live under `tests/manual/` and are split by risk:

- `npm run test:manual`: read-only API checks
- `npm run test:manual:smoke`: destructive disposable-resource smoke checks
- `npm run test:manual:dbaas`: destructive DBaaS lifecycle checks

### Safe Read-Only Lane

Run only after `make build`.

Command:

```bash
E2ECTL_RUN_MANUAL_E2E=1 \
E2E_API_KEY=... \
E2E_AUTH_TOKEN=... \
E2E_PROJECT_ID=... \
E2E_LOCATION=... \
npm run test:manual
```

Required read-only env vars:

- `E2ECTL_RUN_MANUAL_E2E=1`
- `E2E_API_KEY`
- `E2E_AUTH_TOKEN`
- `E2E_PROJECT_ID`
- `E2E_LOCATION`

Optional fixture env vars enable resource-specific get checks:

- `E2ECTL_MANUAL_DBAAS_ID`
- `E2ECTL_MANUAL_NODE_ID`
- `E2ECTL_MANUAL_RESERVED_IP`
- `E2ECTL_MANUAL_VOLUME_ID`
- `E2ECTL_MANUAL_VPC_ID`
- `E2ECTL_MANUAL_SECURITY_GROUP_ID`
- `E2ECTL_MANUAL_SSH_KEY_ID`

### Destructive Smoke Lane

Run only after `make build`.

Command:

```bash
E2E_API_KEY=... \
E2E_AUTH_TOKEN=... \
E2E_PROJECT_ID=... \
E2E_LOCATION=... \
E2ECTL_SMOKE_NODE_PLAN=... \
E2ECTL_SMOKE_NODE_IMAGE=... \
E2ECTL_SMOKE_UPGRADE_PLAN=... \
E2ECTL_SMOKE_UPGRADE_IMAGE=... \
npm run test:manual:smoke
```

Required smoke env vars:

- `E2E_API_KEY`
- `E2E_AUTH_TOKEN`
- `E2E_PROJECT_ID`
- `E2E_LOCATION`
- `E2ECTL_SMOKE_NODE_PLAN`
- `E2ECTL_SMOKE_NODE_IMAGE`
- `E2ECTL_SMOKE_UPGRADE_PLAN`
- `E2ECTL_SMOKE_UPGRADE_IMAGE`

For `E2ECTL_SMOKE_NODE_PLAN` and `E2ECTL_SMOKE_UPGRADE_PLAN`, use the full `items[].plan` value from `e2ectl --json node catalog plans ...`, not the shorter `sku` label.

Optional smoke env vars:

- `E2ECTL_SMOKE_PREFIX`
- `E2ECTL_SMOKE_MANIFEST`

Cleanup command:

```bash
npm run test:manual:smoke:cleanup -- --manifest <path>
```

Destructive-smoke manifests are written under `.manual-smoke/` by default. Keep the manifest until cleanup has succeeded.

### DBaaS Destructive Lane

This lane creates and deletes an actual DBaaS cluster and VPC. Run it only with disposable quota and credentials.

Command:

```bash
E2ECTL_RUN_MANUAL_E2E=1 \
E2E_API_KEY=... \
E2E_AUTH_TOKEN=... \
E2E_PROJECT_ID=... \
E2E_LOCATION=... \
E2ECTL_MANUAL_DBAAS_TYPE=postgres \
E2ECTL_MANUAL_DBAAS_VERSION=16 \
E2ECTL_MANUAL_DBAAS_PLAN="DBS.16GB" \
E2ECTL_MANUAL_DBAAS_DATABASE_NAME=testdb \
E2ECTL_MANUAL_DBAAS_PASSWORD='Testing@1234567890' \
npm run test:manual:dbaas
```

Required env vars:

- `E2ECTL_RUN_MANUAL_E2E=1`
- `E2E_API_KEY`
- `E2E_AUTH_TOKEN`
- `E2E_PROJECT_ID`
- `E2E_LOCATION`
- `E2ECTL_MANUAL_DBAAS_TYPE`
- `E2ECTL_MANUAL_DBAAS_VERSION`
- `E2ECTL_MANUAL_DBAAS_PLAN`
- `E2ECTL_MANUAL_DBAAS_DATABASE_NAME`
- `E2ECTL_MANUAL_DBAAS_PASSWORD`

Use the full DBaaS plan name from `dbaas plans`, for example `DBS.16GB`. The password must satisfy the platform policy.

If a DBaaS operation fails because the cluster is not yet running, wait for `dbaas get <id>` to report `Running` before retrying. On failure, check `.manual-dbaas/*-manifest.json` before doing any manual cleanup.

## Promotion Checklist

Before opening a promotion PR from `develop` to `main`, confirm:

- the exact `develop` commit is green in `verify.yml`
- docs are updated for any user, contributor, CI, or release flow changes
- command examples still match the built CLI
- changed `--json` output has been reviewed as a contract
- fake-API coverage still proves the affected flows

## Documentation Ownership

- [README.md](../../README.md): operators and evaluators
- [docs/user-guides/](../user-guides/index.md): operator task guides, command guides, troubleshooting, and automation recipes
- [CONTRIBUTING.md](../../CONTRIBUTING.md): code contributors
- [docs/maintainers/maintaining.md](./maintaining.md): maintainers and CI owners
- [docs/maintainers/releasing.md](./releasing.md): release execution

Release Please owns [CHANGELOG.md](../../CHANGELOG.md) and package version updates. Do not hand-edit them in normal maintenance work.
