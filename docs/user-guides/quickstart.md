# Quickstart

This guide is the safest path from install to your first successful operator task.

If you want the full first-node journey, continue with [Create your first node](./workflows/first-node.md). If you already have a saved profile, jump to the [node guide](./node.md).

## 1. Install The CLI

```bash
npm install -g @e2enetworks-oss/e2ectl
e2ectl --help
```

## 2. Create An API Key And Token

Open [E2E MyAccount > API & IAM](https://myaccount.e2enetworks.com/services/apiiam) and create an
API key and token. Keep them private. Do not paste them into tickets, chat threads, or screenshots.

## 3. Set Up e2ectl

```bash
e2ectl configure
```

It asks for the key and token (they are not shown as you type), checks them, and saves them in a
profile. Then it asks which platforms you use: TIR (recommended, picked by default) and MyAccount.
For each one it asks for the project and location (and the account, for TIR), checks them, and
saves them. Run it again at any time; it offers what is saved as the default answers.

To change one platform later:

```bash
e2ectl tir configure
e2ectl myaccount configure
```

In scripts and agents there is no terminal to ask in. Pass `--platform` and the values as flags,
and the key and token in `E2E_API_KEY` and `E2E_AUTH_TOKEN` (they are never taken as flags):

```bash
e2ectl configure --platform tir --account <account-id> --project <project-id> --location Chennai
e2ectl configure --platform myaccount --project <project-id> --location Delhi
```

A missing value fails with a message naming the flag to add. If you already have a downloaded
credential file, `e2ectl config import --file <path>` saves it as a profile instead.

If setup fails, start with [Authentication and import problems](./troubleshooting.md#authentication-and-import-problems).

## 4. Confirm What Was Saved

```bash
e2ectl config list
```

Most project-scoped commands can omit `--alias`, `--project-id`, and `--location` once a default alias and shared default context are saved.

If you only need account-scoped project commands, see the [project guide](./project.md). Those commands need authentication, but they do not require project or location context.

## 5. Discover Valid Node Inputs

Start with OS discovery:

```bash
e2ectl myaccount node catalog os
```

Then ask for exact plans and images:

```bash
e2ectl myaccount node catalog plans \
  --display-category "<display-category>" \
  --category "<category>" \
  --os "<os>" \
  --os-version "<os-version>" \
  --billing-type hourly
```

Use the exact `plan`, `image`, and committed-plan identifiers returned by the catalog output. If the create command rejects your input, see [Catalog and plan validation errors](./troubleshooting.md#catalog-and-plan-validation-errors).

## 6. Create Your First Node

```bash
e2ectl myaccount node create \
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
