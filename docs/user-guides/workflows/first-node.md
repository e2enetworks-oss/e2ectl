# Create Your First Node

This workflow is the shortest safe path from saved credentials to a running node.

It keeps the first success milestone simple: import one profile, discover one valid catalog row, create one node, and confirm you can inspect it.

## Before You Start

- Install `e2ectl` and download a MyAccount credential JSON file.
- Pick a project and location you are comfortable using for a first node.
- Keep the credential file private and disposable in local screenshots or notes.

## 1. Import The Downloaded Credentials

```bash
e2ectl config import --file ~/Downloads/myaccount-config.json
```

If you are working non-interactively, use the explicit pattern from [Quickstart](../quickstart.md).

## 2. Confirm The Saved Profile

```bash
e2ectl config list
```

This is the moment to confirm the default alias and shared default project/location values before you create anything.

## 3. Discover Projects If You Still Need One

```bash
e2ectl project list
```

If you need a new project first:

```bash
e2ectl project create --name <project-name>
```

## 4. Find A Known-Good Catalog Row

Start with the available OS rows:

```bash
e2ectl node catalog os
```

Then choose one row and ask for exact hourly plans and images:

```bash
e2ectl node catalog plans \
  --display-category "<display-category>" \
  --category "<category>" \
  --os "<os>" \
  --os-version "<os-version>" \
  --billing-type hourly
```

For a first node, an hourly path keeps the decision surface smaller. You can revisit committed billing after the first successful create.

## 5. Create The Node

**From a catalog image (standard):**

```bash
e2ectl node create \
  --name <node-name> \
  --plan <plan> \
  --image <image>
```

**From a saved image** — use the same `--plan` and `--image` as above, plus the `Template ID` from `e2ectl image list`:

```bash
e2ectl node create \
  --name <node-name> \
  --plan <plan> \
  --image <image> \
  --saved-image-template-id <template-id>
```

If the selected plan is `E1` or `E1WC`, also pass `--disk <size-gb>`.

If you already have a saved SSH key id, you can add it during create with repeated `--ssh-key-id <ssh-key-id>` flags.

## 6. Confirm The Result

```bash
e2ectl node list
e2ectl node get <node-id>
```

You have reached the first success milestone once the new node appears in list output and `node get` returns the expected record.

## What To Do Next

- add storage, networking, or access resources with [Networking and storage workflow](./networking-and-storage.md)
- learn the rest of the command surface in the [node guide](../node.md)
- move to scripts and CI with the [automation cookbook](../automation.md)

## When Something Goes Wrong

- use [Authentication and import problems](../troubleshooting.md#authentication-and-import-problems) if the first steps fail
- use [Catalog and plan validation errors](../troubleshooting.md#catalog-and-plan-validation-errors) if create rejects a plan or image
- use [Missing project or location context](../troubleshooting.md#missing-project-or-location-context) if the command asks for context you thought was already saved
