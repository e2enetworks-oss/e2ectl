# Releasing e2ectl

This repository is prepared for automated GitHub releases plus npm publishing, with a deliberate first public flow:

1. publish `1.0.0-rc.1` to npm dist-tag `next`
2. validate install and operator flow
3. publish `1.0.0` to npm dist-tag `latest`

## Files And Responsibilities

- `.github/workflows/ci.yml`
  - fast verification on pull requests to `develop` and `main`
  - required merge queue verification for `main`
  - runs `make lint`, `make test`, and `make build`
- `.github/workflows/integration.yml`
  - full staging verification on pull requests to `develop` and on pushes to `develop`
  - full promotion verification on pull requests and merge queue runs for `main`
  - runs `make lint`, `make test`, `make build`, `npm run test:integration`, and `npm pack --dry-run`
- `.github/workflows/release-please.yml`
  - watches `main`
  - opens and updates release PRs
  - creates git tags and GitHub Releases when a release PR is merged
- `.github/workflows/publish.yml`
  - runs on published GitHub Releases
  - can also be started manually for a known git tag
  - verifies the tagged commit again
  - publishes the package to npm with the correct dist-tag
- `release-please-config.json`
  - tells Release Please how to version this repository
- `.release-please-manifest.json`
  - stores the last released version for the repository root
- `package.json`
  - source of truth for the package name, bin entrypoint, npm metadata, and publish-time build hook

## Release Automation Design

This repo uses Release Please for version management.

Normal flow:

1. merge feature and hardening PRs into `develop`
2. `integration.yml` validates the merged `develop` tip
3. open a promotion PR from `develop` to `main`
4. `ci.yml` and `integration.yml` run on that PR, and again in merge queue for `main`
5. merge the promotion PR into `main`
6. Release Please opens or updates a release PR
7. merge that release PR
8. Release Please creates the git tag and GitHub Release
9. the publish workflow runs from that release and publishes to npm

Rules:

- `fix:` commits become patch releases
- `feat:` commits become minor releases
- `feat!:` or `BREAKING CHANGE:` become major releases
- do not hand-edit `package.json` version except through the release PR flow

## npm Dist-Tag Policy

- prerelease versions such as `1.0.0-rc.1` publish to `next`
- stable versions such as `1.0.0` publish to `latest`

The publish workflow derives the dist-tag from the git tag version:

- tag contains a hyphen, for example `v1.0.0-rc.1` -> `next`
- tag has no prerelease suffix, for example `v1.0.0` -> `latest`

## Activation Prerequisites

The repo can be prepared before npm ownership exists, but end-to-end publishing only works after these are in place:

1. the unscoped npm package `e2ectl` is owned by a company-controlled npm user account
2. npm trusted publishing is configured for this GitHub repository and the publish workflow
3. the repo has a `RELEASE_PLEASE_TOKEN` secret

Why the extra GitHub token matters:

- Release Please can fall back to the default `GITHUB_TOKEN`
- that fallback is enough to open release PRs
- but tags or releases created with the default token do not trigger downstream workflows reliably
- use `RELEASE_PLEASE_TOKEN` so the publish workflow runs automatically after Release Please creates a GitHub Release
- if you ever cut a release before that secret exists, use the manual dispatch path in `.github/workflows/publish.yml` as a one-off recovery path

## First Public Release: 1.0.0-rc.1

The first prerelease is intentionally forced rather than inferred.

Ensure the code promoted from `develop` to `main` contains a commit message body with:

```text
Release-As: 1.0.0-rc.1
```

After that promotion lands on `main`:

1. Release Please opens a release PR for `1.0.0-rc.1`
2. review the generated changelog and version bump
3. merge the release PR
4. Release Please creates tag `v1.0.0-rc.1` and a GitHub Release
5. the publish workflow publishes `e2ectl@1.0.0-rc.1` to npm dist-tag `next`

Operator install once that package exists:

```bash
npm install -g e2ectl@next
e2ectl --help
```

## Stable Release: 1.0.0

After the release candidate is validated, force the stable cut with another small PR whose commit body contains:

```text
Release-As: 1.0.0
```

After that promotion lands on `main`:

1. Release Please opens a release PR for `1.0.0`
2. review and merge the release PR
3. Release Please creates tag `v1.0.0` and a GitHub Release
4. the publish workflow publishes `e2ectl@1.0.0` to npm dist-tag `latest`

Stable install:

```bash
npm install -g e2ectl
e2ectl --help
```

## Release Verification

The publish workflow intentionally re-runs repository verification before publishing:

```bash
make lint
make test
make build
npm pack --dry-run
```

This keeps the published artifact tied to a green tagged commit instead of assuming the earlier PR CI was enough.

Before promoting `develop` to `main`, the staging branch should already be green on:

```bash
make lint
make test
make build
npm run test:integration
npm pack --dry-run
```

## Maintainer Checklist

Before turning the workflows on for real publishing:

1. create the company-controlled npm user account
2. claim the unscoped npm package name `e2ectl`
3. configure npm trusted publishing for this repo and the publish workflow
4. add the `RELEASE_PLEASE_TOKEN` repository secret
5. confirm GitHub Actions is allowed to create and approve pull requests if your repo settings require it
6. cut `1.0.0-rc.1`
