# Maintaining e2ectl

This document is for maintainers who own branch policy, CI health, release readiness, and documentation quality.

For contributor workflow, use [CONTRIBUTING.md](../CONTRIBUTING.md). For release execution, use [docs/RELEASING.md](./RELEASING.md).

## Branch Policy

- `develop` is the staging branch for feature integration and hardening.
- `main` is the release branch.
- Land normal feature work in `develop` first.
- Promote only a green `develop` tip to `main`.
- Keep `main` protected behind pull request checks and merge queue policy where configured.

## Promotion Gate

The reference contract is [`.github/workflows/verify.yml`](../.github/workflows/verify.yml).

A `develop` commit is ready for promotion only when this full gate is green:

```bash
make lint
npm run coverage:unit
make build
npm run test:integration
npm pack --dry-run
```

Operational notes:

- Public runtime support starts at Node.js 24.
- `npm run coverage:unit` enforces the minimum 80% unit coverage floor used by CI.
- `make coverage` remains optional when you also want the integration coverage report.
- `npm run test:manual` is the opt-in read-only live check lane and is never a required CI lane.
- `npm run test:manual:smoke` is the opt-in destructive live smoke lane and is never a required CI lane.
- If `npm pack --dry-run` fails locally because of npm cache permissions, rerun with `env npm_config_cache=/tmp/e2ectl-npm-cache npm pack --dry-run`.

## CI Contract

Runs on:

- pushes to `develop`
- pull requests to `develop`
- pull requests to `main`
- merge queue checks for `main`

Configuration:

- Ubuntu runners
- Node.js 24 only

Steps:

1. `npm ci`
2. `make lint`
3. `npm run coverage:unit`
4. `make build`
5. `npm run test:integration`
6. `npm pack --dry-run`

The verify workflow uses the internal `E2ECTL_MYACCOUNT_BASE_URL` override so the built CLI can talk to a fake MyAccount API, and it also exercises install-from-tarball smoke coverage.

`release-please.yml` now reruns the same publish-time verification, including `npm run test:integration`, before npm publish.

## Release Readiness Checks

Before opening a promotion PR from `develop` to `main`, confirm:

- the promotion gate above is green on the exact `develop` commit being promoted
- docs are updated for any operator, contributor, CI, or release-flow changes
- command examples still match the built CLI help surface
- any changed `--json` output has been reviewed as a machine-facing contract
- automated fake-API coverage still covers the affected create, list, get, delete, catalog, and attachment flows

If a release needs additional confidence against live credentials, run one of the opt-in manual lanes separately. Use the read-only lane for safe spot checks, or the destructive smoke lane for disposable end-to-end release validation.

## Manual Live Verification

Two opt-in live lanes exist:

- `npm run test:manual` stays read-only and safe. It only runs when `E2ECTL_RUN_MANUAL_E2E=1` is set, and it covers node catalog/list/get checks.
- `npm run test:manual:smoke` is destructive. It uses the built CLI against live credentials to create and clean up disposable resources.

Run smoke only after `make build`.

Smoke requires these environment variables:

- `E2E_API_KEY`
- `E2E_AUTH_TOKEN`
- `E2E_PROJECT_ID`
- `E2E_LOCATION`
- `E2ECTL_SMOKE_NODE_PLAN`
- `E2ECTL_SMOKE_NODE_IMAGE`
- `E2ECTL_SMOKE_DNS_DOMAIN`

Optional smoke variables:

- `E2ECTL_SMOKE_PREFIX`
- `E2ECTL_SMOKE_RECORD_TTL`
- `E2ECTL_SMOKE_MANIFEST`

Smoke writes a persistent manifest under `.tmp/` by default. If `E2ECTL_SMOKE_MANIFEST` is set, that path is used instead. The test updates the manifest after each successful create or mutate step, and prints the manifest path clearly on failure.

If a smoke run is interrupted or partial cleanup fails, resume cleanup with:

```bash
npm run test:manual:smoke:cleanup -- --manifest <path>
```

Cleanup order is:

1. DNS records
2. addon reserved IP detach when needed
3. node delete
4. reserved IP delete
5. security group delete

The cleanup command tries the built CLI first and falls back to direct clients only when CLI cleanup fails.

Destructive smoke remains strongly recommended for the first public release and future release candidates, but it is not a mandatory CI or branch-protection gate.

## Documentation Discipline

Each maintained doc has one audience:

- [README.md](../README.md): operators and automation users
- [CONTRIBUTING.md](../CONTRIBUTING.md): code contributors
- [docs/MAINTAINING.md](./MAINTAINING.md): maintainers and CI owners
- [docs/RELEASING.md](./RELEASING.md): maintainers executing releases

Documentation rules:

- Keep one clear home for each recurring fact and link instead of duplicating full explanations.
- Update user-facing docs whenever command behavior, examples, environment precedence, or safety guidance changes.
- Update maintainer docs whenever CI policy, branch policy, or release readiness rules change.
- Update release docs whenever versioning, dist-tag policy, or publish automation changes.
- Release Please owns [CHANGELOG.md](../CHANGELOG.md) and package version updates. Do not hand-edit them in normal maintenance work.
