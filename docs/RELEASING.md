# Releasing e2ectl

This repository is set up for automated GitHub releases and npm publishing.

The intended public launch path is:

1. publish `1.0.0-rc.1` to npm dist-tag `next`
2. validate install and operator flow
3. publish `1.0.0` to npm dist-tag `latest`

## Normal Release Flow

1. merge feature work into `develop`
2. confirm the `develop` tip is green
3. open a promotion PR from `develop` to `main`
4. merge the promotion PR after CI and merge queue checks pass
5. let Release Please open or update a release PR on `main`
6. review and merge the release PR
7. let Release Please create the git tag and GitHub Release
8. let the publish workflow publish the package to npm

Version bump rules:

- `fix:` -> patch
- `feat:` -> minor
- `feat!:` or `BREAKING CHANGE:` -> major

## Dist-Tag Policy

- prerelease versions such as `1.0.0-rc.1` publish to `next`
- stable versions such as `1.0.0` publish to `latest`

The publish workflow derives the npm dist-tag from the git tag:

- tags with a prerelease suffix publish to `next`
- stable tags publish to `latest`

## Activation Prerequisites

End-to-end publishing requires all of the following:

1. the unscoped npm package `e2ectl` is owned by a company-controlled npm account
2. npm trusted publishing is configured for this repository and the publish workflow
3. the repository has a `RELEASE_PLEASE_TOKEN` secret

Why `RELEASE_PLEASE_TOKEN` matters:

- the default `GITHUB_TOKEN` can still open release PRs
- but tags and releases created with the default token may not trigger downstream publish workflows reliably
- use `RELEASE_PLEASE_TOKEN` so the publish workflow runs automatically after Release Please creates a GitHub Release

## First Public Prerelease

Force the first prerelease with a commit body containing:

```text
Release-As: 1.0.0-rc.1
```

After that lands on `main`:

1. Release Please opens a release PR for `1.0.0-rc.1`
2. review the generated changelog and version bump
3. merge the release PR
4. Release Please creates tag `v1.0.0-rc.1` and a GitHub Release
5. the publish workflow publishes `e2ectl@1.0.0-rc.1` to npm dist-tag `next`

## First Stable Release

After the release candidate is validated, force the stable cut with a commit body containing:

```text
Release-As: 1.0.0
```

After that lands on `main`:

1. Release Please opens a release PR for `1.0.0`
2. review and merge the release PR
3. Release Please creates tag `v1.0.0` and a GitHub Release
4. the publish workflow publishes `e2ectl@1.0.0` to npm dist-tag `latest`

## Verification Before Promotion

Before promoting `develop` to `main`, the staging branch should already be green on:

```bash
make lint
make test
make build
npm run test:integration
npm pack --dry-run
```

The publish workflow then re-runs release-time verification on the tagged commit:

```bash
make lint
make test
make build
npm pack --dry-run
```

## Maintainer Checklist

Before turning the release workflows on for real publishing:

1. create the company-controlled npm user account
2. claim the unscoped npm package name `e2ectl`
3. configure npm trusted publishing for this repo and the publish workflow
4. add the `RELEASE_PLEASE_TOKEN` repository secret
5. confirm GitHub Actions can create and approve pull requests if repo settings require it
6. cut `1.0.0-rc.1`

## Changelog And Versioning Policy

- Release Please owns [CHANGELOG.md](../CHANGELOG.md)
- do not hand-edit changelog entries in normal feature PRs
- do not bump package versions manually outside the release PR flow
