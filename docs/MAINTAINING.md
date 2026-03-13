# Maintaining e2ectl

## Repository Gates

Before pushing or merging:

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

For pre-release smoke checks, also verify a clean-room first-user flow with a temporary `HOME`: import a credential file, save defaults, run `config list`, and exercise read-only node commands against live credentials.
For release automation and npm publish activation, use [docs/RELEASING.md](./RELEASING.md).

## Branch Roles

- `develop` is the staging branch for pre-v1 integration and hardening.
- `main` is the release branch.
- Pull requests into `develop` run both the fast gate and the full staging gate.
- Pushes to `develop` rerun the full staging gate on the merged branch tip.
- Promotion from `develop` to `main` reruns the full gate and merge queue checks before release automation on `main`.

## Source Layout

The maintained v1 tree is:

```text
src/
  app/
  core/
  myaccount/
  config/
  node/
```

Detailed architecture rules live in [CONTRIBUTING.md](../CONTRIBUTING.md). Keep `app/` bootstrap-only, keep commands thin, and keep formatter-owned JSON output deterministic.
Keep generic API failure handling centralized in `src/myaccount/transport.ts`, and keep node-specific endpoint parsing in `src/node/client.ts`. Cross-domain imports should go through each domain `index.ts`.
Keep config persistence secure and atomic during normal writes, and keep Commander usage-error normalization centralized at the CLI entrypoint.

## CI Contract

GitHub Actions verifies:

- pull requests to `develop`
- pull requests to `main`
- merge queue (`merge_group`) checks for `main`
- pushes to `develop`

Fast `ci.yml` matrix:

- Node 18
- Node 20
- Node 22

Fast gate steps:

1. `npm ci`
2. `make lint`
3. `make test`
4. `make build`

Full staging and promotion gate in `integration.yml`:

1. `npm ci`
2. `make lint`
3. `make test`
4. `make build`
5. `npm run test:integration`
6. `npm pack --dry-run`

The manual live API suite is intentionally not part of CI.
The integration lane uses the internal `E2ECTL_MYACCOUNT_BASE_URL` override so the compiled CLI can talk to a fake local MyAccount server during automated tests, and it also includes a local tarball install smoke path.

## Release Workflows

This repo also has two release-specific workflows:

- `.github/workflows/release-please.yml` opens release PRs and creates GitHub tags/releases from `main`
- `.github/workflows/publish.yml` publishes tagged GitHub Releases to npm after rerunning the local verification gate

Those workflows are intentionally designed so the repo can be prepared now and fully activated later, once a company-controlled npm owner account and trusted publishing are configured.

## Release Smoke Check

Before calling a branch production-ready, verify:

1. clean install from source: `npm install`, `make build`, `npm link`
2. first-time setup from a clean temp `HOME`
3. `config import` and `config list` behavior
4. read-only live API calls such as `node catalog os`, `node catalog plans`, and `node list`
5. local gates: `make lint`, `make test`, `make build`, `npm run test:integration`
6. publish package preview: `npm pack --dry-run`

## Documentation Duties

Update these when behavior changes:

- [README.md](../README.md) for operator-facing usage only
- [CONTRIBUTING.md](../CONTRIBUTING.md) for contributor workflow
- [docs/MAINTAINING.md](./MAINTAINING.md) for CI and maintenance policy
- [CHANGELOG.md](../CHANGELOG.md) for user-visible release notes
- [docs/RELEASING.md](./RELEASING.md) for versioning and npm publish process

Keep contributor workflow, CI internals, and release mechanics out of `README.md` unless an operator truly needs them to start using the CLI.

Any user-visible behavior change must also update unit tests, docs, and the deterministic `--json` output review. The manual live API suite remains opt-in and is never part of normal CI.

## Release Notes

- Keep [CHANGELOG.md](../CHANGELOG.md) current for user-visible changes.
- Do not bump the package version unless a release is being prepared.
- Prefer Conventional Commits for history clarity.
- Keep the doc set small: avoid reintroducing milestone-by-milestone implementation history once it is absorbed into the maintained docs above.
