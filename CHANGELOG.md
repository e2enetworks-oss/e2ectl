# Changelog

All notable changes to this project will be documented in this file.

## [0.5.0](https://github.com/e2enetworks-oss/e2ectl/compare/v0.4.0...v0.5.0) (2026-04-26)

### Added

- Saved image workflows:
  - `e2ectl image list`
  - `e2ectl image rename`
  - `e2ectl image delete`
  - `e2ectl node action save-image`
- Saved-image node launches via `e2ectl node create --saved-image-template-id`, while keeping catalog `--plan` and `--image` validation explicit.
- Saved-image user documentation covering discovery, reuse, automation, and first-node workflows.

### Fixed

- Cleaned README badge links and saved-image guide formatting.
- Tightened test type assertions for undefined values.
- Hardened volume and VPC service/formatter edge cases.

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
