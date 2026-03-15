# Maintaining e2ectl

This document is for maintainers responsible for CI, branch hygiene, release readiness, and documentation quality.

For contributor workflow, see [CONTRIBUTING.md](../CONTRIBUTING.md).
For release execution, see [docs/RELEASING.md](./RELEASING.md).

## Repository Gates

Before pushing, merging, or promoting a branch:

```bash
make lint
make test
make build
npm run test:integration
npm pack --dry-run
```

Optional live verification:

```bash
npm run test:manual
```

Coverage reporting remains an explicit local workflow and is not part of the default CI gate:

```bash
make coverage
```

The coverage lanes write separate reports to:

- `coverage/unit/index.html`
- `coverage/unit/lcov.info`
- `coverage/integration/index.html`
- `coverage/integration/lcov.info`

Coverage lane behavior:

- unit coverage uses Vitest V8 coverage directly
- integration coverage rebuilds `dist/` first and uses child-process-aware Node V8 coverage so the spawned CLI process is actually measured

If the plain `npm pack --dry-run` command fails locally because of npm cache permissions, rerun with a temporary cache:

```bash
env npm_config_cache=/tmp/e2ectl-npm-cache npm pack --dry-run
```

## Branch Policy

- `develop` is the staging branch for integration and hardening
- `main` is the release branch
- all feature work lands in `develop` first
- promotion from `develop` to `main` should happen only from a green staging tip

## CI Contract

### Fast gate

Runs on:

- pull requests to `develop`
- pull requests to `main`
- merge queue checks for `main`

Matrix:

- Node 18
- Node 20
- Node 22

Steps:

1. `npm ci`
2. `make lint`
3. `make test`
4. `make build`

### Full gate

Runs on:

- pushes to `develop`
- pull requests to `develop`
- pull requests to `main`
- merge queue checks for `main`

Steps:

1. `npm ci`
2. `make lint`
3. `make test`
4. `make build`
5. `npm run test:integration`
6. `npm pack --dry-run`

The integration lane uses the internal `E2ECTL_MYACCOUNT_BASE_URL` override so the compiled CLI can talk to a fake local MyAccount server, and it also exercises a local tarball install smoke path.

## Release Readiness Checklist

Before calling a branch production-ready, verify:

1. clean install from source: `npm install`, `make build`, `npm link`
2. first-run setup from a clean temporary `HOME`
3. `config import` and `config list` behavior
4. read-only command coverage against current live credentials where appropriate:
   - `node catalog os`
   - `node catalog plans --billing-type all`
   - `node list`
   - `volume list`
   - `volume plans`
   - `vpc list`
   - `vpc plans`
   - `ssh-key list`
5. create-path verification via fake API for:
   - hourly `node create`
   - committed `node create --billing-type committed --committed-plan-id <id>`
6. local gate completion:
   - `make lint`
   - `make test`
   - `make build`
   - `npm run test:integration`
   - `npm pack --dry-run`

## Documentation Discipline

Keep the maintained docs small and audience-specific:

- [README.md](../README.md): operator onboarding and daily usage
- [CONTRIBUTING.md](../CONTRIBUTING.md): contributor workflow and architecture rules
- [docs/MAINTAINING.md](./MAINTAINING.md): CI, branch, and readiness checks
- [docs/RELEASING.md](./RELEASING.md): release and npm publishing runbook

Release Please owns [CHANGELOG.md](../CHANGELOG.md). Do not hand-edit changelog entries or package versions outside the release flow.
