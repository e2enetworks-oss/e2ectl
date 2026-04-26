# Changelog

All notable changes to this project will be documented in this file.

## [0.5.0](https://github.com/e2enetworks-oss/e2ectl/compare/v0.4.0...v0.5.0) (2026-04-26)


### Features

* add saved image CLI workflows and saved-image node launches ([9f045da](https://github.com/e2enetworks-oss/e2ectl/commit/9f045da8659371c0fc79a69917262204931a5f8d))
* enhance volume and VPC services with edge case handling and improved test coverage ([7f0624b](https://github.com/e2enetworks-oss/e2ectl/commit/7f0624b2a5b4a1d7b1059b624114d7e21e5ca3bb))


### Fixes

* add blank line for improved readability in image user guide ([3ffe84f](https://github.com/e2enetworks-oss/e2ectl/commit/3ffe84fc67b02761c98fc2ebad11499b01d5f660))
* add type assertions for undefined values in tests to ensure type safety ([8e851a8](https://github.com/e2enetworks-oss/e2ectl/commit/8e851a8e8b36c9c65411d3df43aa5d8fadbd3bea))
* remove unnecessary blank line in image user guide ([15a084c](https://github.com/e2enetworks-oss/e2ectl/commit/15a084c3b71f65f9cef89fe89ee8b542a228113a))
* stop ignoring local planning files ([627ee85](https://github.com/e2enetworks-oss/e2ectl/commit/627ee85d70b8cabcc4d5105cb803de0b83b776a3))
* update badge link to point to the develop branch in README.md ([76a7b19](https://github.com/e2enetworks-oss/e2ectl/commit/76a7b192781072dcb74dc77af4890cf93c028399))
* update coverage thresholds to 85% for branches, functions, lines, and statements ([715f18f](https://github.com/e2enetworks-oss/e2ectl/commit/715f18f8d0a667b32342bdf83da83a97306d29cf))

## [0.4.0](https://github.com/e2enetworks-oss/e2ectl/compare/v0.3.0...v0.4.0) (2026-04-16)


### Added

- Project commands for listing, creating, and starring or unstarring MyAccount projects.
- Reserved IP commands for listing, reserving, attaching, detaching, and deleting public IP allocations.
- Security group commands, including node attach and detach workflows.
- Node upgrade support and explicit public IP detach actions.

## [0.3.0](https://github.com/e2enetworks-oss/e2ectl/compare/v0.2.0...v0.3.0) (2026-04-10)


### Features

- Volume, VPC, and SSH key management commands for create, list, get, and delete workflows.
- Catalog-driven node discovery and richer node action support, including power, image save, and attachment flows.
- Deterministic `--json` output across the main operator workflows for automation and scripting.


### Changed

- Adopted the scoped npm package name `@e2enetworks-oss/e2ectl`.
- Standardized auth and default context handling around saved profiles, alias defaults, and explicit overrides.
- Raised the supported runtime baseline to Node.js 24.


### Fixed

- Hardened config resolution and stale-default handling when environment credentials are complete.
- Centralized and softened MyAccount API error handling for more predictable CLI behavior.
- Tightened validation around node billing and discovery flows.
- Improved CI and release hardening, including integration-gated `develop` merges, coverage reporting, and npm publishing setup.

## [Unreleased]

## [0.2.0] - 2026-04-02

### Added

- Config profile management for importing credentials, listing profiles, and setting default project and location context.
- Node lifecycle commands for listing, inspecting, creating, and deleting MyAccount nodes.
- Catalog-driven node discovery for operating systems, hourly plans, committed billing options, optional family filtering, clearer E1 custom-storage output, and valid plan/image combinations.
- Node action commands for power control, image save, and SSH key, volume, and VPC attachment workflows.
- Block storage volume, VPC, and SSH key management commands.
- Deterministic `--json` output for automation and scripting.
