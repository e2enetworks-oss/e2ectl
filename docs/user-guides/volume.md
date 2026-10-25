# Volume

## What This Command Group Does

`e2ectl myaccount volume` discovers plans, creates block storage volumes, lists and inspects them, and deletes them. Volume attach and detach flows use `e2ectl myaccount node action volume`.

## Before You Start

- Choose the intended project and location first.
- Run `volume plans` before `volume create` so the CLI can derive valid IOPS from a supported size.

## Common Tasks

### Discover Available Volume Sizes

```bash
e2ectl myaccount volume plans
```

Inspect one size in more detail:

```bash
e2ectl myaccount volume plans --size <size-gb>
```

### List And Inspect Volumes

```bash
e2ectl myaccount volume list
e2ectl myaccount volume get <volume-id>
```

### Create A Volume

```bash
e2ectl myaccount volume create \
  --name <volume-name> \
  --size <size-gb> \
  --billing-type hourly
```

For committed billing, add `--committed-plan-id <committed-plan-id>` and, if needed, `--post-commit-behavior <behavior>`.

### Attach Or Detach A Volume From A Node

```bash
e2ectl myaccount node action volume attach <node-id> --volume-id <volume-id>
e2ectl myaccount node action volume detach <node-id> --volume-id <volume-id>
```

### Grow A Volume

```bash
e2ectl myaccount volume resize <volume-id> --size 200
e2ectl myaccount volume get <volume-id>
```

It asks before growing the volume, because a volume cannot be shrunk again; add `--force` in
scripts. The volume must be attached to a node, and the new size must be bigger and one of the
sizes in `volume plans`. E2E grows it through the node it is attached to; the volume keeps its name and
data. E2E refuses while the volume has snapshots: delete them first. Grow the filesystem inside
the node afterwards to use the new space.

### Snapshot A Volume

```bash
e2ectl myaccount volume snapshot create <volume-id> --name nightly
e2ectl myaccount volume snapshot list <volume-id>
e2ectl myaccount volume snapshot delete <volume-id> <snapshot-id>
```

The volume must be attached to a node; E2E takes the snapshot through that node. The
snapshot list has the same columns as node snapshots. Volume snapshot ids are numbers.

To restore, save a snapshot as a new volume. The volume it came from is never overwritten, and
the new volume is billed like any other:

```bash
e2ectl myaccount volume snapshot save-volume <volume-id> <snapshot-id> --name restored
```

### Delete A Volume

```bash
e2ectl myaccount volume delete <volume-id>
```

## Examples

List only currently available sizes:

```bash
e2ectl myaccount volume plans --available-only
```

Delete a volume without the confirmation prompt:

```bash
e2ectl myaccount volume delete <volume-id> --force
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
