# Releasing e2ectl

This document is for maintainers executing a release.

For CI policy and promotion readiness, use [docs/MAINTAINING.md](./MAINTAINING.md). For contributor workflow, use [CONTRIBUTING.md](../CONTRIBUTING.md).

## Before You Start

Confirm the repository is already set up for automated publishing:

- the npm scope `@e2enetworks-oss` is owned by the correct npm organization
- the package is configured for public publishing on npmjs
- npm trusted publishing is configured for this repository and `release-please.yml`
- maintainers can merge to `main` and approve release PRs

This release path does not use a personal PAT, `RELEASE_PLEASE_TOKEN`, or a long-lived npm token. Release Please uses GitHub's built-in `GITHUB_TOKEN`, and npm publish uses trusted publishing over OIDC.

## Release Flow

1. Merge feature work into `develop`.
2. Wait for the `develop` tip to pass the promotion gate from [docs/MAINTAINING.md](./MAINTAINING.md).
3. Open a promotion PR from `develop` to `main`.
4. Merge the promotion PR after the `main` checks pass.
5. Wait for Release Please to open or update the release PR on `main`.
6. Review the generated version bump and changelog, then merge the release PR.
7. Confirm the `release-please` workflow publishes to npm and creates a GitHub Release.

## Platform Proof Story

- Linux is the full verify-and-publish gate.
- macOS adds build, test, and package confidence before promotion.
- Windows adds package install and basic CLI smoke before promotion.

Cross-platform confidence lives in `verify.yml`. Publish-time verification in `release-please.yml` stays Linux-only.

## Dist-Tag Policy

- Stable releases publish to npm dist-tag `latest`.
- Pre-release versions such as `-rc.1` publish to npm dist-tag `next`.

The dist-tag is derived automatically from the version Release Please creates.

## Publish-Time Verification

Before npm publish, `release-please.yml` reruns the Linux release gate on the tagged commit:

```bash
make lint
npm run coverage:unit
make build
npm run test:integration
npm pack --dry-run
```

## Optional Live Rehearsal

If you want live API confidence beyond CI:

- `npm run test:manual` is the safe read-only lane
- `npm run test:manual:smoke` is the destructive disposable-resource lane

For exact commands, env vars, and cleanup behavior, use [docs/MAINTAINING.md](./MAINTAINING.md).

For the first public release and future release candidates, running both live lanes is strongly recommended when safe credentials and disposable quota are available. This remains recommended guidance, not mandatory policy.

## Release Checklist

Before merging the promotion PR:

- confirm the exact `develop` commit is green
- confirm docs and command examples are current
- strongly consider running both live lanes for first-release and release-candidate promotions

Before merging the Release Please PR:

- review the generated version bump
- review the generated changelog for accuracy
- confirm no one hand-edited package versions or changelog entries outside the release PR

After publish completes:

- verify the GitHub Release and tag exist
- verify the package resolves from npm with the expected dist-tag
- verify the install path matches the published release you intended to ship

## Versioning And Changelog Policy

- Release Please owns [CHANGELOG.md](../CHANGELOG.md) and package version updates.
- Conventional Commits drive the default version bump.
- Do not hand-edit changelog entries or `package.json` versions in normal feature work.
- If a release needs an explicit version override, use a commit body with `Release-As: x.y.z`.
