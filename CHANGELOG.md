# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0](https://github.com/e2enetworks-oss/e2ectl/compare/v0.2.0...v0.3.0) (2026-04-10)


### Features

* add block storage volume commands ([0c7cd5d](https://github.com/e2enetworks-oss/e2ectl/commit/0c7cd5d29e7c985201e425cde3bd8fa8189f8f2e))
* add block storage volume commands ([7f44758](https://github.com/e2enetworks-oss/e2ectl/commit/7f4475838d5e8f1429029d6d413ab66691d71a9d))
* add config commands ([f8c44fe](https://github.com/e2enetworks-oss/e2ectl/commit/f8c44fe63a9ac7266af36cdd0ab9e5e80cce007e))
* add config import onboarding ([a75d2ea](https://github.com/e2enetworks-oss/e2ectl/commit/a75d2ea1b49f346231e7208ef0bb0bd2223067ca))
* add myaccount api client ([35ff131](https://github.com/e2enetworks-oss/e2ectl/commit/35ff1317e422984b5daae1b283afcc1cbbcf6cb4))
* add node action commands ([2f981e0](https://github.com/e2enetworks-oss/e2ectl/commit/2f981e0033ce5b48d9cb6b66b1d6af98afed4b32))
* add node action commands ([018812a](https://github.com/e2enetworks-oss/e2ectl/commit/018812a523158a69ccb1f03731f046d588720c85))
* add node billing discovery and committed create ([242fbef](https://github.com/e2enetworks-oss/e2ectl/commit/242fbef6c601f9b8cb2adfc62b474c77a01ba2da))
* add node billing discovery and committed create ([1f55bb9](https://github.com/e2enetworks-oss/e2ectl/commit/1f55bb98aa2693dc0b963321820f9a11e6e24659))
* add node catalog discovery flow ([b7fe028](https://github.com/e2enetworks-oss/e2ectl/commit/b7fe028851c73b07ff44f510d097b1b53abfa475))
* add node read commands ([b54f6df](https://github.com/e2enetworks-oss/e2ectl/commit/b54f6df521258d94d807608a89a022b1db33271f))
* add node write commands ([c200501](https://github.com/e2enetworks-oss/e2ectl/commit/c200501472b5d9401291649796c4cc709bd3b22c))
* add vpc and ssh key commands ([07e1fe1](https://github.com/e2enetworks-oss/e2ectl/commit/07e1fe11f8cac778095d63eb4efc5af48d047e70))
* add vpc and ssh key commands ([8a72a8e](https://github.com/e2enetworks-oss/e2ectl/commit/8a72a8e94b1ab4b4e49c643a2409988f00b75079))
* adopt clean v1 auth context model ([4c40eb7](https://github.com/e2enetworks-oss/e2ectl/commit/4c40eb7c7d080dbeb039907e9064af10aa16bf81))
* bootstrap e2ectl prototype CLI ([8067e59](https://github.com/e2enetworks-oss/e2ectl/commit/8067e59c5459fcf1a1706a45c334adf6d7de2b01))
* finalize pre-v1 hardening ([11f1e5b](https://github.com/e2enetworks-oss/e2ectl/commit/11f1e5b24ce9fd413721c0d1d3750ff4c69ea8c8))
* polish node catalog os output ([1cd4c70](https://github.com/e2enetworks-oss/e2ectl/commit/1cd4c70d85a3f20562d420996112415a416d8515))
* polish node catalog plans output ([5c4bf37](https://github.com/e2enetworks-oss/e2ectl/commit/5c4bf373f4f7933b43fd7651feb2f5300bcfabc4))
* polish node catalog plans output ([00b47f9](https://github.com/e2enetworks-oss/e2ectl/commit/00b47f931101a99191ec62f7c44239fa3fb4d0ac))
* scaffold e2ectl m0 and m1 ([2a56258](https://github.com/e2enetworks-oss/e2ectl/commit/2a56258a4368223c34288f06d327a432fceb1cbc))


### Bug Fixes

* **config:** ignore stale default alias when env is complete ([ddedb19](https://github.com/e2enetworks-oss/e2ectl/commit/ddedb196683c9eb17d86242b64ee92c18e6611e9))
* gate develop merges on integration checks ([15cf83d](https://github.com/e2enetworks-oss/e2ectl/commit/15cf83d0a9bdb9390a371ffbe7b2e1383c1b7563))
* gate develop merges on integration checks ([cdf59e4](https://github.com/e2enetworks-oss/e2ectl/commit/cdf59e45e1e5f29ea5d9d5c034b0c0200ceef0f0))
* harden pagination, ID safety, atomic write, and publish gate ([e02b77e](https://github.com/e2enetworks-oss/e2ectl/commit/e02b77ea0bf5a22122c280cb10dac172e5a3f96f))
* harden v1 config and CLI flows ([7c18293](https://github.com/e2enetworks-oss/e2ectl/commit/7c182932c70617653df7d4c9f7f20141f0bcb636))
* harden v1 config and CLI flows ([d1fbe52](https://github.com/e2enetworks-oss/e2ectl/commit/d1fbe522a7b7cc4e141ee578520a1b5ceb9d95c5))
* harden v1 config and node list flows ([b603faf](https://github.com/e2enetworks-oss/e2ectl/commit/b603faf4b076c71c12908ecc6bdfe79d74f22c51))
* harden v1 config and node list flows ([f047794](https://github.com/e2enetworks-oss/e2ectl/commit/f0477949073cc2e214bf779d2d9d57c9426cc4c6))
* make myaccount api errors permissive ([69bd29b](https://github.com/e2enetworks-oss/e2ectl/commit/69bd29b7939cc89a0b55e97d69a13e75d787d533))
* make MyAccount API errors permissive but centralized ([4068c34](https://github.com/e2enetworks-oss/e2ectl/commit/4068c34987530a1bb2eb8aa03998008129590110))
* resolve lint violations — prettierignore .claude/, unsafe-return, TS2532 ([60c1475](https://github.com/e2enetworks-oss/e2ectl/commit/60c1475d18fd89e21ef47b5c44f53c5f1fdad26d))
* restore node 18 ci compatibility ([a35e469](https://github.com/e2enetworks-oss/e2ectl/commit/a35e46929b9df6974fb4d593e31e2add070f48f9))
* scope manual publish concurrency by release tag ([2f53b2a](https://github.com/e2enetworks-oss/e2ectl/commit/2f53b2a879e06619e5bbb26bed2fd95373428c11))
* unblock release flow gates ([1aca156](https://github.com/e2enetworks-oss/e2ectl/commit/1aca15624677d2b56df5746470ef2db41b3f66a4))
* unblock release flow gates ([a5053c6](https://github.com/e2enetworks-oss/e2ectl/commit/a5053c60fe03caf2d922fa01fccc60ad6d2a6403))
* use a real family example in help text ([0944a5b](https://github.com/e2enetworks-oss/e2ectl/commit/0944a5bedae0bfe8420ff8b779fce0fe0ee965f1))
* validate node billing flags before auth ([195c454](https://github.com/e2enetworks-oss/e2ectl/commit/195c454da84a03a2c3f2c6a31610425311147b93))


### Miscellaneous Chores

* prepare 0.2.0 release ([fe23e9a](https://github.com/e2enetworks-oss/e2ectl/commit/fe23e9a1c543eb4a1b29a1e513f97a13447bd684))
* prepare 0.3.0 release ([16cb16e](https://github.com/e2enetworks-oss/e2ectl/commit/16cb16e83fe9b5bee6f24385d7f0c219f66a1981))
* prepare 0.3.0 release ([e04b8a0](https://github.com/e2enetworks-oss/e2ectl/commit/e04b8a0f2cca84c5eb86f66b79a2b1c40e869328))
* prepare v1 release ([f11b804](https://github.com/e2enetworks-oss/e2ectl/commit/f11b8049def118212d9ab19ddd7da2f792f7f46a))

## [Unreleased]

## [0.2.0] - 2026-04-02

### Added

- Config profile management for importing credentials, listing profiles, and setting default project and location context.
- Node lifecycle commands for listing, inspecting, creating, and deleting MyAccount nodes.
- Catalog-driven node discovery for operating systems, hourly plans, committed billing options, optional family filtering, clearer E1 custom-storage output, and valid plan/image combinations.
- Node action commands for power control, image save, and SSH key, volume, and VPC attachment workflows.
- Block storage volume, VPC, and SSH key management commands.
- Deterministic `--json` output for automation and scripting.
