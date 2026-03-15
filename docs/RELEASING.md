# Releasing e2ectl

This is the steady-state release runbook for `e2ectl`.

For CI ownership and promotion readiness, use [docs/MAINTAINING.md](./MAINTAINING.md). For day-to-day contributor workflow, use [CONTRIBUTING.md](../CONTRIBUTING.md).

## Prerequisites

Before running the release flow, confirm the repository is already set up for automated publishing:

- the npm package name `e2ectl` is owned by a company-controlled npm account
- npm trusted publishing is configured for this repository
- `RELEASE_PLEASE_TOKEN` is configured so Release Please tags and GitHub Releases trigger downstream publish workflows reliably
- maintainers can merge to `main` and approve release PRs under the current repository rules

Without `RELEASE_PLEASE_TOKEN`, Release Please can still open release PRs with the default `GITHUB_TOKEN`, but tags and releases created that way will not trigger the publish workflow automatically.

## Normal Release Flow

1. Merge feature work into `develop`.
2. Wait for the `develop` tip to pass the promotion gate from [docs/MAINTAINING.md](./MAINTAINING.md).
3. Open a promotion PR from `develop` to `main`.
4. Merge the promotion PR after the `main`-targeted checks and merge queue requirements pass.
5. Wait for Release Please to open or update the release PR on `main`.
6. Review the generated version bump and changelog, then merge the release PR.
7. Confirm Release Please created the git tag and GitHub Release.
8. Confirm the `publish` workflow completes and the package is available on npm.

If the publish workflow needs to be rerun for an existing tag, use the `publish` workflow dispatch input `release_tag`.

## Dist-Tag Policy

- Tags with a prerelease suffix publish to npm dist-tag `next`.
- Stable tags publish to npm dist-tag `latest`.

Examples:

- `v1.2.0-rc.1` -> `next`
- `v1.2.0` -> `latest`

The dist-tag is derived automatically from the git tag in `.github/workflows/publish.yml`.

## Verification Before Promotion

Before promoting `develop` to `main`, complete the promotion gate owned by [docs/MAINTAINING.md](./MAINTAINING.md):

```bash
make lint
make test
make build
npm run test:integration
npm pack --dry-run
```

The publish workflow reruns release-time verification on the tagged commit:

```bash
make lint
make test
make build
npm pack --dry-run
```

If the release needs live API confidence beyond the automated gate, run the opt-in manual node read checks before promotion.

## Maintainer Checklist

Before merging the promotion PR:

- confirm the exact `develop` commit is green on the promotion gate
- confirm docs and command examples are current
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

## Appendix: Repository Bootstrap

These are one-time setup tasks, not part of the normal release path:

- claim the unscoped npm package name `e2ectl`
- configure npm trusted publishing for this repository
- add the `RELEASE_PLEASE_TOKEN` repository secret
