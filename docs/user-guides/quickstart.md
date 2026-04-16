# Quickstart

This guide is the safest path from install to your first successful operator task.

If you want the full first-node journey, continue with [Create your first node](./workflows/first-node.md). If you already have a saved profile, jump to the [node guide](./node.md).

## 1. Install The CLI

```bash
npm install -g @e2enetworks-oss/e2ectl
e2ectl --help
```

## 2. Download Your Credential File

Open [E2E MyAccount > API & IAM](https://myaccount.e2enetworks.com/services/apiiam), create an API token, and download the generated config JSON file.

Keep the file private. Do not paste its contents into tickets, chat threads, or screenshots.

## 3. Import A Saved Profile

Interactive terminals can let `e2ectl` help you choose a default alias and optional default project/location context:

```bash
e2ectl config import --file ~/Downloads/myaccount-config.json
```

For a fully non-interactive path, pass the shared defaults explicitly:

```bash
e2ectl config import \
  --file ~/Downloads/myaccount-config.json \
  --default <profile-alias> \
  --default-project-id <project-id> \
  --default-location <location> \
  --no-input
```

If import fails, start with [Authentication and import problems](./troubleshooting.md#authentication-and-import-problems).

## 4. Confirm What Was Saved

```bash
e2ectl config list
```

Most project-scoped commands can omit `--alias`, `--project-id`, and `--location` once a default alias and shared default context are saved.

If you only need account-scoped project commands, see the [project guide](./project.md). Those commands need authentication, but they do not require project or location context.

## 5. Discover Valid Node Inputs

Start with OS discovery:

```bash
e2ectl node catalog os
```

Then ask for exact plans and images:

```bash
e2ectl node catalog plans \
  --display-category "<display-category>" \
  --category "<category>" \
  --os "<os>" \
  --os-version "<os-version>" \
  --billing-type hourly
```

Use the exact `plan`, `image`, and committed-plan identifiers returned by the catalog output. If the create command rejects your input, see [Catalog and plan validation errors](./troubleshooting.md#catalog-and-plan-validation-errors).

## 6. Create Your First Node

```bash
e2ectl node create \
  --name <node-name> \
  --plan <plan> \
  --image <image>
```

For committed billing, add `--billing-type committed --committed-plan-id <committed-plan-id>`.

For `E1` and `E1WC` plans, also pass `--disk <size-gb>`.

## Next Steps

- Continue with [Create your first node](./workflows/first-node.md) for a task-first walkthrough
- Use [Networking and storage workflow](./workflows/networking-and-storage.md) after the node exists
- Keep [Troubleshooting](./troubleshooting.md) nearby for auth, context, and non-interactive errors
