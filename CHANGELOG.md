# Changelog

All notable changes to this project will be documented in this file.

## [0.6.0](https://github.com/e2enetworks-oss/e2ectl/compare/v0.5.0...v0.6.0) (2026-05-06)


### Features

* add billing type option for load balancer creation and implement validation rules ([5719fc7](https://github.com/e2enetworks-oss/e2ectl/commit/5719fc7427dedbe3999589593dc7035cd1e00ad9))
* add billing type option to load balancer creation command ([298b8c4](https://github.com/e2enetworks-oss/e2ectl/commit/298b8c4d79a9dbfc99f45de8ee5a3f1b1bcd3236))
* add billing type option to load balancer creation command and implement related tests ([47a7f97](https://github.com/e2enetworks-oss/e2ectl/commit/47a7f97aebe489650698ff1b1f35ba5f942cf755))
* add load balancer and SSL list only CLI support ([dd6a29a](https://github.com/e2enetworks-oss/e2ectl/commit/dd6a29a3c70c24f5f4b3ac03a3086bc2f049dfca))
* add SSL client tests and formatter enhancements ([c510dc1](https://github.com/e2enetworks-oss/e2ectl/commit/c510dc1aa64610ac2d25cd2601f6d1a1ba7cbeac))
* Add tests for updating load balancers and backend groups, including protocol changes and VPC attachment/detachment ([9a12bce](https://github.com/e2enetworks-oss/e2ectl/commit/9a12bce5fe3b022b30bcfd850174680e83ca1f09))
* **dbaas:** add complete DBaaS command suite with VPC, networking, and whitelist support ([84dfc89](https://github.com/e2enetworks-oss/e2ectl/commit/84dfc89cd776fff618efa148c904081cc17a8ad9))
* **dbaas:** add network show command and related functionality ([3d23b53](https://github.com/e2enetworks-oss/e2ectl/commit/3d23b53dcc4280718f20078fd360dd1e17f195fb))
* **dbaas:** add private IPs to database entries and update output to reflect Public Endpoint ([abb0be0](https://github.com/e2enetworks-oss/e2ectl/commit/abb0be0f5fa2af92b2b4cb2b793fc94f4b0f8b4e))
* **dbaas:** add types for DBaaS API, commands, options, and services ([6d428bf](https://github.com/e2enetworks-oss/e2ectl/commit/6d428bf0dfaebb6fa9a4ce670df7dd60bfa05c4d))
* **dbaas:** enforce VPC attachment for public IP creation flags and update related documentation ([19367de](https://github.com/e2enetworks-oss/e2ectl/commit/19367dea1af46ea20212203196995fb33c473af3))
* **dbaas:** enhance command validation and error handling for network actions; update message handling in results ([5f82445](https://github.com/e2enetworks-oss/e2ectl/commit/5f824459e29aa98be09e782d32e22376dd32150c))
* **dbaas:** enhance DBaaS API with VPC, public IP, and whitelisting features ([10f2555](https://github.com/e2enetworks-oss/e2ectl/commit/10f255571801f663ed06c2d7dc1226eeb833e436))
* **dbaas:** enhance DBaaS command and formatter to include private IPs and improve output structure ([fff8bb5](https://github.com/e2enetworks-oss/e2ectl/commit/fff8bb528c9229578cba66033bc4e1bc967115a2))
* **dbaas:** enhance DBaaS functionality with destructive tests and updates ([b5bd891](https://github.com/e2enetworks-oss/e2ectl/commit/b5bd89101886fb69871a163e3e93c70cda3b72d2))
* **dbaas:** enhance manual verification process with expanded validation rules and cleanup procedures ([536a2dc](https://github.com/e2enetworks-oss/e2ectl/commit/536a2dc0d9c7b015b4b46ce5f6c00dd1d54bf56f))
* **dbaas:** enhance service tests with additional scenarios and validations ([58775a9](https://github.com/e2enetworks-oss/e2ectl/commit/58775a90ae62eb545cd14db018706852438dd7e7))
* **dbaas:** enhance tests for DBaaS commands and formatter with new scenarios ([c80e014](https://github.com/e2enetworks-oss/e2ectl/commit/c80e014a7bfb75c5a7c088ecf3d96769d3e6e6ef))
* **dbaas:** update DBaaS command structure to use whitelist-ip and enhance password handling ([19254a6](https://github.com/e2enetworks-oss/e2ectl/commit/19254a61753a0183196f9b8582fc2e164fc11b9e))
* enhance lb and ssl commands with richer output and UX improvements ([b061140](https://github.com/e2enetworks-oss/e2ectl/commit/b06114085ec5501ea58b7a4f18b5bc6309f31fe1))
* enhance load balancer documentation and remove deprecated server list functionality ([4c61382](https://github.com/e2enetworks-oss/e2ectl/commit/4c61382618ae27c3b3136c5df9136477d7c39364))
* Implement reserved IP functionality for load balancers ([b9a0ab0](https://github.com/e2enetworks-oss/e2ectl/commit/b9a0ab0958d09c0b8fc0702a85be971e5b9fb89a))
* **lb:** add load balancer billing options and algorithms ([db322cb](https://github.com/e2enetworks-oss/e2ectl/commit/db322cbcddc68d4bb15dc265011102ce1edbac6b))
* **load-balancer:** add support for internal load balancers with --lb-type option and update related commands and tests ([3998f70](https://github.com/e2enetworks-oss/e2ectl/commit/3998f70c6dd453645bfa1aec1a46bcae026fc4c0))
* **load-balancer:** add test for handling unknown lb-type in createLoadBalancer ([7d86804](https://github.com/e2enetworks-oss/e2ectl/commit/7d86804dc61639173e68beac3ec6ac98034bbfd7))
* **load-balancer:** add types and client for load balancer API ([2eb4b0c](https://github.com/e2enetworks-oss/e2ectl/commit/2eb4b0ca47107db028820d9ce7e6a88727cde470))
* **load-balancer:** enhance load balancer API with new backend group functions and request builders ([f380a13](https://github.com/e2enetworks-oss/e2ectl/commit/f380a136f149bb83ae1227e3eec1f79ffdfba45f))
* **load-balancer:** implement backend group renaming functionality; ensure unique server names within groups and update related tests ([61ebbbf](https://github.com/e2enetworks-oss/e2ectl/commit/61ebbbff7005658919bbe7e709d135682ba89e2e))
* **load-balancer:** remove backend server update functionality and related tests; handle duplicate server names in add operation ([474aff1](https://github.com/e2enetworks-oss/e2ectl/commit/474aff15b3d7e72b180700553b5dabb762c50173))
* **load-balancer:** remove backendPort from LoadBalancerBackendGroupCreateOptions and update related tests ([1195290](https://github.com/e2enetworks-oss/e2ectl/commit/11952905aeaf28583cdd22bd31a5617712f7f9fa))
* **load-balancer:** remove unused options from LoadBalancerBackendGroupCreate and Delete interfaces; update related test for clarity ([c9285d0](https://github.com/e2enetworks-oss/e2ectl/commit/c9285d0e34db48b670148ca5abb6a4888db76874))
* **load-balancer:** rename 'name' option to 'backend-group-name' in backend group commands and update related tests ([a643a72](https://github.com/e2enetworks-oss/e2ectl/commit/a643a726810890f3e0bf9df24658419b907d0da5))
* **load-balancer:** rename update request functions for clarity; update references in service ([d5dda0e](https://github.com/e2enetworks-oss/e2ectl/commit/d5dda0ed9ac4510b36c2cce8b9ea0ab593ac4ff3))
* **load-balancer:** update command options from '--name' to '--backend-group-name' in load balancer commands and tests ([27d4c2d](https://github.com/e2enetworks-oss/e2ectl/commit/27d4c2de8eac370cc8cd9931eb599898a2b73e3f))
* **load-balancer:** update VPC option naming from '--vpc' to '--vpc-id' across commands, services, and tests for consistency ([55c2e2f](https://github.com/e2enetworks-oss/e2ectl/commit/55c2e2f1c88ff163010645dbe9307b8d45586915))
* **ssl:** make createSslClient mandatory in CliRuntime and simplify SSL command implementation ([21d0ef6](https://github.com/e2enetworks-oss/e2ectl/commit/21d0ef6fc58f95ad6baf81cba4f30f27ea16709b))
* **tests:** add comprehensive validation tests for DBaaS CLI commands and improve error handling ([0cc6e2a](https://github.com/e2enetworks-oss/e2ectl/commit/0cc6e2a2bfb98bbbbfa6d07abae18c3f04c6e913))
* **tests:** add SSL client stubs to various command tests ([6f00a6b](https://github.com/e2enetworks-oss/e2ectl/commit/6f00a6ba2a2e4e646bded546a959d3403beafcef))
* update backend group creation flags for improved clarity and consistency ([8d76edf](https://github.com/e2enetworks-oss/e2ectl/commit/8d76edf1ccd1953a99f511a8c90d3b981a0d067f))
* update load balancer commands and documentation to require server IP and name for backend group creation ([91c22ee](https://github.com/e2enetworks-oss/e2ectl/commit/91c22eec0924c0bc89d6ac07d19f18796ceaebe3))


### Fixes

* **dbaas:** rename 'list-types' command to 'types' for consistency across documentation and code ([f21d0d0](https://github.com/e2enetworks-oss/e2ectl/commit/f21d0d0dd62208a06a051813af27b694827a6613))
* **dbaas:** update connection_endpoint to null for better handling of missing values ([62b4162](https://github.com/e2enetworks-oss/e2ectl/commit/62b4162a9b514ac57967b53f3ae2235b6a68ac78))
* **dbaas:** update create command example to use a placeholder for plan name ([d45030d](https://github.com/e2enetworks-oss/e2ectl/commit/d45030d2e429478654615f573ac650dc6b6f6946))
* **dbaas:** update create command to use placeholder for VPC ID ([4e695d4](https://github.com/e2enetworks-oss/e2ectl/commit/4e695d4dee92a444ec62e676bbc71cb884c98064))
* **dbaas:** update DBaaS password prompt location and enhance status normalization logic ([33ff0b5](https://github.com/e2enetworks-oss/e2ectl/commit/33ff0b585f28693b1ddcb7b3cd0b2dd49499a520))
* **dbaas:** update documentation for SKU ID reference and clarify VPC attachment command ([15aeabd](https://github.com/e2enetworks-oss/e2ectl/commit/15aeabdb6c7b52a56290abfda5940f41e93c948c))
* **dbaas:** update IP address validation to only accept valid IPv4 addresses ([db966d9](https://github.com/e2enetworks-oss/e2ectl/commit/db966d92f37fd48a42462ce94e9f1395db69ec48))
* **dbaas:** update status field to reflect provisioning and pending states in test cases ([73ff94c](https://github.com/e2enetworks-oss/e2ectl/commit/73ff94c723b8f6d79d2e6ddde2e53e325a07e9cf))
* **docs:** clarify guidelines for client and types files in CONTRIBUTING.md ([e7e5230](https://github.com/e2enetworks-oss/e2ectl/commit/e7e523055f35298cb991b6a74c53c168688aff2e))
* **docs:** update architecture rules for service and client ownership clarification ([cf05b88](https://github.com/e2enetworks-oss/e2ectl/commit/cf05b8878a2671f8daf78200869773250599092a))
* fail dbaas action groups on missing args ([21477fc](https://github.com/e2enetworks-oss/e2ectl/commit/21477fcfbce8834ca27097159847c044c6d2e732))
* **formatter:** add newline to the end of backend group list output for better readability ([00549b8](https://github.com/e2enetworks-oss/e2ectl/commit/00549b8afcb0d6253c4863bf8444c2ae6c3ee18d))
* **load-balancer:** handle potential null values in context and status normalization ([e70ca69](https://github.com/e2enetworks-oss/e2ectl/commit/e70ca690452c3d45b4e0eba2905b73824abba988))
* **tests:** increase timeout values for package install smoke test to ensure stability ([d4a866e](https://github.com/e2enetworks-oss/e2ectl/commit/d4a866e0f3cd1dd6e48481afc962f3e1affcaf90))
* validate load balancer billing flags before auth ([3d7b5a2](https://github.com/e2enetworks-oss/e2ectl/commit/3d7b5a2be32fb575fb231147a7f0d49babec3fc2))


### Internal

* **changelog:** remove unreleased section and load balancer command details for clarity ([fb45546](https://github.com/e2enetworks-oss/e2ectl/commit/fb45546582af3ef701ddf4846a3f37863f29bc52))
* **dbaas:** improve code readability by formatting software object in tests and adjusting type casting in summarizeSupportedClusterOrNull ([9ea2bc9](https://github.com/e2enetworks-oss/e2ectl/commit/9ea2bc9a7bb7178fd81318097f6e34651b47a222))
* **dbaas:** remove network show command and related functionality ([abe98c8](https://github.com/e2enetworks-oss/e2ectl/commit/abe98c8c811dce4fab9898f7a88e70168e487578))
* **dbaas:** remove SKU-related commands and options from DBaaS service and formatter ([600e6a1](https://github.com/e2enetworks-oss/e2ectl/commit/600e6a1634d6121c96a7cbe11ba3caa2fe382a82))
* **dbaas:** update command structure for network and whitelist actions for clarity and consistency ([709c528](https://github.com/e2enetworks-oss/e2ectl/commit/709c528bc1353b6b2a7f85203a926cc036fe14cc))
* **tests:** improve code readability in DBaaS status check and empty state validation ([875a086](https://github.com/e2enetworks-oss/e2ectl/commit/875a086892139b15f498a6f3dd8c2bd9836cbbf3))
* **tests:** remove retired load balancer command tests for clarity ([9a8a3c7](https://github.com/e2enetworks-oss/e2ectl/commit/9a8a3c75e45c7461d70fed60b5660a52c125d98c))
* **tests:** remove unnecessary blank lines in process-errors and process-help test files for improved readability ([d0a5154](https://github.com/e2enetworks-oss/e2ectl/commit/d0a5154299cdd050c3bbfc6e80242c563c25630c))
* **tests:** streamline argument formatting in DBaaS CLI tests for improved readability ([9e0f765](https://github.com/e2enetworks-oss/e2ectl/commit/9e0f7651c276da6eab7d1c4455b55fc0a5efd2c0))
* **tests:** streamline CLI command formatting for consistency in load balancer tests ([5638e56](https://github.com/e2enetworks-oss/e2ectl/commit/5638e56fb09b9076e95156d018843c4df2b4c478))
* update import path for normalizeRequiredNumericId to improve module structure ([ee997fb](https://github.com/e2enetworks-oss/e2ectl/commit/ee997fb9480c210a5d22121cdaa8004cb0fe3149))

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
