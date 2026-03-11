# Maintaining e2ectl

## Repository Gates

Before pushing or merging:

```bash
make lint
make test
make build
```

Optional live verification:

```bash
npm run test:manual
```

## CI Contract

GitHub Actions verifies:

- pushes to `main`
- every pull request

Matrix:

- Node 18
- Node 20
- Node 22

Each job runs:

1. `npm ci`
2. `make lint`
3. `make test`
4. `make build`

The manual live API suite is intentionally not part of CI.

## Documentation Duties

Update these when behavior changes:

- [README.md](../README.md) for operator-facing usage
- [docs/DEMO.md](./DEMO.md) for live walkthrough commands
- [CONTRIBUTING.md](../CONTRIBUTING.md) for contributor workflow
- [docs/ROADMAP.md](./ROADMAP.md) for future roadmap and scope direction
- [CHANGELOG.md](../CHANGELOG.md) for user-visible release notes

## Release Notes

- Keep [CHANGELOG.md](../CHANGELOG.md) current for user-visible changes.
- Do not bump the package version unless a release is being prepared.
- Prefer Conventional Commits for history clarity.
- Keep the doc set small: avoid reintroducing milestone-by-milestone implementation history once it is absorbed into the maintained docs above.
