# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- Config profile management for importing credentials, listing profiles, and setting default project and location context.
- Node lifecycle commands for listing, inspecting, creating, and deleting MyAccount nodes.
- Catalog-driven node discovery for operating systems, hourly plans, committed billing options, optional family filtering, clearer E1 custom-storage output, and valid plan/image combinations.
- Node action commands for power control, image save, and SSH key, volume, and VPC attachment workflows.
- Block storage volume, VPC, and SSH key management commands.
- Deterministic `--json` output for automation and scripting.

## [0.1.0] - Mar 11, 2026

- Initial scaffold for the `e2ectl` CLI.
- M0 and M1 foundations: CLI wiring, config store, auth resolution, and test harness.
