# e2ectl

[![Verify](https://github.com/e2enetworks-oss/e2ectl/actions/workflows/verify.yml/badge.svg?branch=develop)](https://github.com/e2enetworks-oss/e2ectl/actions/workflows/verify.yml) [![Coverage](https://codecov.io/gh/e2enetworks-oss/e2ectl/branch/main/graph/badge.svg)](https://github.com/e2enetworks-oss/e2ectl/tree/develop) [![Release](https://img.shields.io/github/v/release/e2enetworks-oss/e2ectl)](https://github.com/e2enetworks-oss/e2ectl/releases/latest) [![Docs](https://img.shields.io/badge/docs-blue)](./docs/user-guides/index.md) ![Node 24+](https://img.shields.io/badge/node-24%2B-339933?logo=node.js&logoColor=white) ![MIT](https://img.shields.io/badge/license-MIT-blue.svg)

`e2ectl` is the command-line interface for managing [E2E Networks](https://www.e2enetworks.com/) MyAccount resources from the terminal.

It provides a unified CLI to manage E2E MyAccount resources—compute nodes, networking, storage, and access—using reusable profiles, a shared default context, and deterministic --json output for automation.

## Requirements

- Node.js 24+
- npm

## Install

```bash
npm install -g @e2enetworks-oss/e2ectl
e2ectl --help
```

For prerelease builds:

```bash
npm install -g @e2enetworks-oss/e2ectl@next
```

## Quickstart

1. Create an API token in [E2E MyAccount > API & IAM](https://myaccount.e2enetworks.com/services/apiiam) and download the generated config JSON file.
2. Import the file into a saved profile:

```bash
e2ectl config import --file ~/Downloads/myaccount-config.json
```

3. Discover an exact node plan and image:

```bash
e2ectl node catalog os

e2ectl node catalog plans \
  --display-category "<display-category>" \
  --category "<category>" \
  --os "<os>" \
  --os-version "<os-version>" \
  --billing-type hourly
```

4. Create your first node:

```bash
e2ectl node create \
  --name <node-name> \
  --plan <plan> \
  --image <image>
```

For a fuller onboarding path, use the [quickstart guide](./docs/user-guides/quickstart.md) and the [first-node workflow](./docs/user-guides/workflows/first-node.md).

## Common Workflows

- Create your first operator-ready node: [First node workflow](./docs/user-guides/workflows/first-node.md)
- Add networking, storage, and access resources to an existing node: [Networking and storage workflow](./docs/user-guides/workflows/networking-and-storage.md)
- Script repeatable runs with `--json` and `--no-input`: [Automation cookbook](./docs/user-guides/automation.md)

## Documentation Map

Start with:

- [User guides index](./docs/user-guides/index.md)
- [Quickstart](./docs/user-guides/quickstart.md)
- [Troubleshooting](./docs/user-guides/troubleshooting.md)

Command guides:

- [Config](./docs/user-guides/config.md)
- [Project](./docs/user-guides/project.md)
- [Node](./docs/user-guides/node.md)
- [Image](./docs/user-guides/image.md)
- [Reserved IP](./docs/user-guides/reserved-ip.md)
- [Volume](./docs/user-guides/volume.md)
- [VPC](./docs/user-guides/vpc.md)
- [Security group](./docs/user-guides/security-group.md)
- [SSH key](./docs/user-guides/ssh-key.md)

## Contributors And Maintainers

- [Contributing](./CONTRIBUTING.md) for local setup, architecture rules, tests, and PR expectations
- [Maintaining e2ectl](./docs/maintainers/maintaining.md) for CI policy, branch flow, and promotion readiness
- [Releasing e2ectl](./docs/maintainers/releasing.md) for publish and release execution
