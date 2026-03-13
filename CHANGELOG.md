# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- Internal MyAccount API client with credential validation and node list/get/create/delete support.
- Config profile commands with masked listings and deterministic JSON output.
- Expanded unit coverage plus a manual read-only API test lane that is skipped by default.
- CLI entrypoint tests that normalize Commander usage errors into the shared CLI error contract.
- Transport coverage for future non-envelope success parsing without duplicating centralized API failure handling.
- Release automation docs and GitHub workflow scaffolding for Release Please plus npm publishing.

### Changed

- CI now documents and enforces the lint, unit test, and build gate across Node 18, 20, and 22.
- Auth identity and request context are now documented cleanly: aliases store one API key/token pair, while `project_id` and `location` are alias defaults or command-level overrides.
- Configuration docs now describe the production v1 command surface instead of prototype milestones.
- Config writes now tighten `~/.e2e/` and `config.json` permissions and use atomic file replacement.
- `config import` now validates alias/default state before mutating disk, and blank aliases are rejected consistently.
- Deterministic `--json` command outputs now have exact contract coverage in unit tests.
- Package metadata and docs now prepare for `1.0.0-rc.1` on npm `next`, followed by `1.0.0` on `latest`.

### Fixed

- `npm link` installs now execute correctly from symlinked entrypoints, which keeps the documented first-time install flow working.
- Build and pack flows now start from a clean `dist/`, which keeps npm release tarballs free of stale generated files.

## [0.1.0] - Mar 11, 2026

- Initial scaffold for the `e2ectl` CLI.
- M0 and M1 foundations: CLI wiring, config store, auth resolution, and test harness.
