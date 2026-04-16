# Volume

## What This Command Group Does

`e2ectl volume` discovers plans, creates block storage volumes, lists and inspects them, and deletes them. Volume attach and detach flows use `e2ectl node action volume`.

## Before You Start

- Choose the intended project and location first.
- Run `volume plans` before `volume create` so the CLI can derive valid IOPS from a supported size.

## Common Tasks

### Discover Available Volume Sizes

```bash
e2ectl volume plans
```

Inspect one size in more detail:

```bash
e2ectl volume plans --size <size-gb>
```

### List And Inspect Volumes

```bash
e2ectl volume list
e2ectl volume get <volume-id>
```

### Create A Volume

```bash
e2ectl volume create \
  --name <volume-name> \
  --size <size-gb> \
  --billing-type hourly
```

For committed billing, add `--committed-plan-id <committed-plan-id>` and, if needed, `--post-commit-behavior <behavior>`.

### Attach Or Detach A Volume From A Node

```bash
e2ectl node action volume attach <node-id> --volume-id <volume-id>
e2ectl node action volume detach <node-id> --volume-id <volume-id>
```

### Delete A Volume

```bash
e2ectl volume delete <volume-id>
```

## Examples

List only currently available sizes:

```bash
e2ectl volume plans --available-only
```

Delete a volume without the confirmation prompt:

```bash
e2ectl volume delete <volume-id> --force
```

## Automation Notes

- Use `volume plans --json` when a later step needs the exact committed plan id for a create call.
- Keep attach and detach steps next to the node workflow that owns them so automation can roll back cleanly.

## Related Guides

- [Node](./node.md)
- [Networking and storage workflow](./workflows/networking-and-storage.md)
- [Automation cookbook](./automation.md)

## Troubleshooting Pointers

- [Catalog and plan validation errors](./troubleshooting.md#catalog-and-plan-validation-errors)
- [Attachment and identifier mix-ups](./troubleshooting.md#attachment-and-identifier-mix-ups)
