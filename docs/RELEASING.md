# Releasing e2ectl

This is the steady-state release runbook for `e2ectl`.

For CI ownership and promotion readiness, use [docs/MAINTAINING.md](./MAINTAINING.md). For day-to-day contributor workflow, use [CONTRIBUTING.md](../CONTRIBUTING.md).

## Before You Start

Before running the release flow, confirm the repository is already set up for automated publishing:

- the npm scope `@e2enetworks-oss` is owned by a company-controlled npm organization
- the npm package `@e2enetworks-oss/e2ectl` is configured for public publishing on npmjs
- npm trusted publishing is configured for this repository and the workflow file `release-please.yml`
- maintainers can merge to `main` and approve release PRs under the current repository rules

This release path does not use a personal PAT, `RELEASE_PLEASE_TOKEN`, or a long-lived npm publish token. Release Please runs with GitHub's built-in `GITHUB_TOKEN`, and npm publishing uses npm trusted publishing over OIDC.

Because `GITHUB_TOKEN` does not trigger extra workflows from release PR and release events, the authoritative publish-time verification lives inside `release-please.yml` before the publish step.

## Normal Release Flow

1. Merge feature work into `develop`.
2. Wait for the `develop` tip to pass the promotion gate from [docs/MAINTAINING.md](./MAINTAINING.md).
3. Open a promotion PR from `develop` to `main`.
4. Merge the promotion PR after the `main`-targeted checks and merge queue requirements pass.
5. Wait for Release Please to open or update the release PR on `main`.
6. Review the generated version bump and changelog, then merge the release PR.
7. Confirm the `release-please` workflow publishes the package to npm and that a GitHub Release was created.

Because Release Please uses `GITHUB_TOKEN`, releases and release PRs are created from the repository workflow context rather than from a personal account.

## Dist-Tag Policy

- Stable releases publish to npm dist-tag `latest`.
- Pre-release versions with a suffix such as `-rc.1` publish to npm dist-tag `next`.

The dist-tag is derived automatically from the version Release Please created.

## Verification Before Promotion

Before promoting `develop` to `main`, complete the promotion gate owned by [docs/MAINTAINING.md](./MAINTAINING.md):

```bash
make lint
npm run coverage:unit
make build
npm run test:integration
npm pack --dry-run
```

Operational notes:

- Public runtime support starts at Node.js 24.
- `npm run coverage:unit` enforces the minimum 80% unit coverage floor used by CI and release-time verification.
- npm trusted publishing currently requires npm CLI `11.5.1+`, which the release workflow installs explicitly.

When Release Please publishes from CI, the workflow reruns the same release-time verification on the tagged commit:

```bash
make lint
npm run coverage:unit
make build
npm run test:integration
npm pack --dry-run
```

This now matches the real release gate, including integration tests, before npm publish.

## Optional Live Smoke

If the release needs live API confidence beyond the automated gate, use one of the opt-in manual lanes before promotion:

- `npm run test:manual` stays read-only and safe.
- `npm run test:manual:smoke` is destructive and exercises disposable create/update/delete flows through the built CLI.

Smoke is strongly recommended before the first public release and future release candidates, but it is not a mandatory policy gate.

Run smoke only after `make build`.

Required smoke environment variables:

- `E2E_API_KEY`
- `E2E_AUTH_TOKEN`
- `E2E_PROJECT_ID`
- `E2E_LOCATION`
- `E2ECTL_SMOKE_NODE_PLAN`
- `E2ECTL_SMOKE_NODE_IMAGE`
- `E2ECTL_SMOKE_DNS_DOMAIN`

Optional smoke environment variables:

- `E2ECTL_SMOKE_PREFIX`
- `E2ECTL_SMOKE_RECORD_TTL`
- `E2ECTL_SMOKE_MANIFEST`

If smoke fails, keep the printed manifest path. Resume cleanup with:

```bash
npm run test:manual:smoke:cleanup -- --manifest <path>
```

The cleanup script deletes DNS records first, then detaches addon reserved IPs, deletes the node, deletes reserved IPs, and finally deletes the security group. It tries the CLI first and falls back to direct clients only if CLI cleanup fails.

## Maintainer Checklist

Before merging the promotion PR:

- confirm the exact `develop` commit is green on the promotion gate
- confirm docs and command examples are current
- strongly consider a destructive smoke run for first-release and release-candidate promotions
- confirm any release automation or dist-tag changes were documented in this file

Before merging the Release Please PR:

- review the generated version bump
- review the generated changelog for accuracy and scope
- confirm no one hand-edited package versions or changelog entries outside the release PR

After publish completes:

- verify the GitHub Release and tag exist
- verify the package resolves from npm with the expected dist-tag
- verify the install path matches the published release you intended to promote

## Changelog And Versioning Policy

- Release Please owns [CHANGELOG.md](../CHANGELOG.md) and package version updates.
- Conventional Commits drive the default version bump:
  - `fix:` -> patch
  - `feat:` -> minor
  - `feat!:` or `BREAKING CHANGE:` -> major
- Do not hand-edit changelog entries or `package.json` versions in normal feature PRs.
- If a release needs an explicit version override, use a commit body with `Release-As: x.y.z`.
