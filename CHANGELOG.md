# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- Config profile commands for importing credentials, listing profiles, and setting default project and location context.
- Node commands for listing, inspecting, creating, and deleting MyAccount nodes.
- Node catalog discovery for operating systems, hourly plans, committed billing options, and valid plan/image combinations.
- Node action commands for power control, image save, and attaching SSH keys, volumes, and VPCs.
- Block storage volume commands for listing plans, creating volumes, and listing existing volumes.
- VPC commands for listing plans, creating VPCs, and listing existing VPCs.
- SSH key commands for listing and creating reusable SSH public keys.
- Deterministic `--json` output for automation and scripting.

### Changed

- `node catalog plans` now presents candidate configs separately from committed billing options and supports optional family filtering for faster discovery.
- Catalog output now uses clearer operator-facing wording, including `N/A` storage display for E1 custom-storage plans where raw disk values are not meaningful.
- Configuration handling now validates imported aliases and preserves per-profile default project and location context more safely.

## [0.1.0] - Mar 11, 2026

- Initial scaffold for the `e2ectl` CLI.
- M0 and M1 foundations: CLI wiring, config store, auth resolution, and test harness.
