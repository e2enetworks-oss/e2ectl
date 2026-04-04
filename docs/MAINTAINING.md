# Maintaining e2ectl

This document is for maintainers who own branch policy, CI health, promotion readiness, and live verification.

For contributor workflow, use [CONTRIBUTING.md](../CONTRIBUTING.md). For release execution, use [docs/RELEASING.md](./RELEASING.md).

## Branch Policy

- `develop` is the integration and hardening branch.
- `main` is the release branch.
- Land normal feature work in `develop` first.
- Promote only a green `develop` commit to `main`.
- Keep `main` protected behind pull request checks and merge queue policy where configured.

## CI And Promotion Gate

The reference contract is [`.github/workflows/verify.yml`](../.github/workflows/verify.yml).

Linux is the authoritative promotion gate:

```bash
make lint
npm run coverage:unit
make build
npm run test:integration
env npm_config_cache=/tmp/e2ectl-npm-cache npm pack --dry-run
```

The CI matrix is:

- Linux: full gate with lint, unit coverage, build, integration, and package dry run
- macOS: build, unit-test, integration, and package confidence
- Windows: package install, help, and `--json` smoke

Notes:

- Public runtime support starts at Node.js 24.
- `release-please.yml` stays smaller than `verify.yml`: release-time verification is Linux-only, while cross-platform confidence happens before promotion.
- `E2ECTL_MYACCOUNT_BASE_URL` is used in CI to point the built CLI at the fake MyAccount API.

## Manual Live Verification

Live lanes are strongly recommended before the first public release and future release candidates, but they are not mandatory CI or branch-protection gates.

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

Always-covered domains:

- node
- dns
- reserved-ip
- volume
- vpc
- security-group
- ssh-key

Optional fixture env vars enable detail/get checks:

- `E2ECTL_MANUAL_NODE_ID`
- `E2ECTL_MANUAL_DNS_DOMAIN`
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
E2ECTL_SMOKE_DNS_DOMAIN=... \
npm run test:manual:smoke
```

Required smoke env vars:

- `E2E_API_KEY`
- `E2E_AUTH_TOKEN`
- `E2E_PROJECT_ID`
- `E2E_LOCATION`
- `E2ECTL_SMOKE_NODE_PLAN`
- `E2ECTL_SMOKE_NODE_IMAGE`
- `E2ECTL_SMOKE_DNS_DOMAIN`

Optional smoke env vars:

- `E2ECTL_SMOKE_PREFIX`
- `E2ECTL_SMOKE_RECORD_TTL`
- `E2ECTL_SMOKE_MANIFEST`

Cleanup command:

```bash
npm run test:manual:smoke:cleanup -- --manifest <path>
```

Cleanup order:

1. DNS records
2. addon reserved IP detach
3. node delete
4. reserved IP delete
5. volume delete
6. VPC delete
7. SSH key delete
8. security group delete

The cleanup script tries the built CLI first and falls back to direct clients only when CLI cleanup fails.

## Promotion Checklist

Before opening a promotion PR from `develop` to `main`, confirm:

- the exact `develop` commit is green in `verify.yml`
- docs are updated for any user, contributor, CI, or release flow changes
- command examples still match the built CLI
- changed `--json` output has been reviewed as a contract
- fake-API coverage still proves the affected flows

## Documentation Ownership

- [README.md](../README.md): operators and automation users
- [CONTRIBUTING.md](../CONTRIBUTING.md): code contributors
- [docs/MAINTAINING.md](./MAINTAINING.md): maintainers and CI owners
- [docs/RELEASING.md](./RELEASING.md): release execution

Release Please owns [CHANGELOG.md](../CHANGELOG.md) and package version updates. Do not hand-edit them in normal maintenance work.
