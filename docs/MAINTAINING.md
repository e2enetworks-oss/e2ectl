# Maintaining e2ectl

This document is for maintainers responsible for branch policy, CI health, release readiness, and documentation quality.

For contributor workflow, use [CONTRIBUTING.md](../CONTRIBUTING.md). For release execution, use [docs/RELEASING.md](./RELEASING.md).

## Branch Policy

- `develop` is the staging branch for feature integration and hardening.
- `main` is the release branch.
- Land normal feature work in `develop` first.
- Promote only a green `develop` tip to `main`.
- Keep `main` protected behind pull request checks and merge queue policy where configured.

## Promotion Gate

A `develop` commit is ready for promotion only when the full gate is green:

```bash
make lint
make test
make build
npm run test:integration
npm pack --dry-run
```

Operational notes:

- Public runtime support starts at Node.js 20.
- `make coverage` is optional and remains outside the default promotion gate.
- `npm run test:manual` is opt-in live verification and never a required CI lane.
- If `npm pack --dry-run` fails locally because of npm cache permissions, rerun with `env npm_config_cache=/tmp/e2ectl-npm-cache npm pack --dry-run`.

## CI Contract

### Fast gate

Runs on:

- pull requests to `develop`
- pull requests to `main`
- merge queue checks for `main`

Configuration:

- Ubuntu runners
- Node.js 20 and 22 matrix

Steps:

1. `npm ci`
2. `make lint`
3. `make test`
4. `make build`

### Integration gate

Runs on:

- pushes to `develop`
- pull requests to `develop`
- pull requests to `main`
- merge queue checks for `main`

Configuration:

- Ubuntu runners
- Node.js 20 and 22 matrix

Steps:

1. `npm ci`
2. `make lint`
3. `make test`
4. `make build`
5. `npm run test:integration`
6. `npm pack --dry-run`

The integration lane uses the internal `E2ECTL_MYACCOUNT_BASE_URL` override so the built CLI can talk to a fake MyAccount API, and it also exercises install-from-tarball smoke coverage.

## Release Readiness Checks

Before opening a promotion PR from `develop` to `main`, confirm:

- the promotion gate above is green on the exact `develop` commit being promoted
- docs are updated for any operator, contributor, CI, or release-flow changes
- command examples still match the built CLI help surface
- any changed `--json` output has been reviewed as a machine-facing contract
- automated fake-API coverage still covers the affected create, list, catalog, and attachment flows

If a release needs additional confidence against live credentials, run the opt-in manual lane separately. Today that lane covers read-only node checks (`node catalog os`, `node catalog plans`, `node list`, and optional `node get`) only.

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
