# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- Internal MyAccount API client with credential validation and node list/get/create/delete support.
- Config profile commands with masked listings and deterministic JSON output.
- Expanded unit coverage plus a manual read-only API test lane that is skipped by default.

### Changed

- CI now documents and enforces the lint, unit test, and build gate across Node 18, 20, and 22.
- Auth identity and request context are now documented cleanly: aliases store one API key/token pair, while `project_id` and `location` are alias defaults or command-level overrides.
- Configuration docs now describe the production v1 command surface instead of prototype milestones.

## [0.1.0] - Mar 11, 2026

- Initial scaffold for the `e2ectl` CLI.
- M0 and M1 foundations: CLI wiring, config store, auth resolution, and test harness.
