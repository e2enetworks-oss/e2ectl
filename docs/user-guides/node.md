# Node

## What This Command Group Does

`e2ectl node` covers catalog discovery, node lifecycle management, power actions, saved-image capture, public-IP detach, and attachment flows for VPCs, volumes, security groups, and SSH keys.

## Before You Start

- Save a default alias and default project/location context, or pass `--alias`, `--project-id`, and `--location` explicitly.
- Use `node catalog` before `node create` or `node upgrade` so you send exact plan and image identifiers from the current catalog.

## Common Tasks

### Discover OS Rows

```bash
e2ectl node catalog os
```

### Discover Exact Plans And Images

```bash
e2ectl node catalog plans \
  --display-category "<display-category>" \
  --category "<category>" \
  --os "<os>" \
  --os-version "<os-version>" \
  --billing-type all
```

### List And Inspect Nodes

```bash
e2ectl node list
e2ectl node get <node-id>
```

### Create A Node

```bash
e2ectl node create \
  --name <node-name> \
  --plan <plan> \
  --image <image>
```

For committed billing, add `--billing-type committed --committed-plan-id <committed-plan-id>`.

For `E1` and `E1WC` plans, also pass `--disk <size-gb>`.

To create from a saved image, use the same `--image` value as a regular node create and add `--saved-image-template-id`:

```bash
e2ectl node create \
  --name <node-name> \
  --plan <plan> \
  --image <catalog-image> \
  --saved-image-template-id <template-id>
```

`<catalog-image>` is the same image identifier from `node catalog plans` (e.g. `Ubuntu-24.04-Distro`). Find `<template-id>` in the `Template ID` column of `e2ectl image list`.

### Upgrade A Node

```bash
e2ectl node upgrade <node-id> \
  --plan <plan> \
  --image <image>
```

### Power A Node Off Or On

```bash
e2ectl node action power-off <node-id>
e2ectl node action power-on <node-id>
```

### Save A Node As An Image

```bash
e2ectl node action save-image <node-id> --name <image-name>
```

Manage saved images later with `e2ectl image list`, `e2ectl image rename`, and `e2ectl image delete`. Create nodes from saved images with `e2ectl node create --image <catalog-image> --saved-image-template-id <template-id>` — `--image` takes the same catalog image value as a regular node create.

### Detach The Current Primary Public IP

```bash
e2ectl node action public-ip detach <node-id>
```

### Delete A Node

```bash
e2ectl node delete <node-id>
e2ectl node delete <node-id> --reserve-public-ip
```

## Examples

Attach a volume to an existing node:

```bash
e2ectl node action volume attach <node-id> --volume-id <volume-id>
```

Attach a VPC with an explicit subnet:

```bash
e2ectl node action vpc attach <node-id> \
  --vpc-id <vpc-id> \
  --subnet-id <subnet-id>
```

Attach multiple security groups:

```bash
e2ectl node action security-group attach <node-id> \
  --security-group-id <security-group-id-1> \
  --security-group-id <security-group-id-2>
```

## Automation Notes

- `node catalog os`, `node catalog plans`, `node list`, and `node get` are the safest discovery-first commands for scripts.
- Use `--json` when later steps need node ids, plan ids, or image ids.
- Keep create and upgrade flows catalog-first so automation stays aligned with the branch's shipped API surface.

## Related Guides

- [Quickstart](./quickstart.md)
- [Create your first node](./workflows/first-node.md)
- [Networking and storage workflow](./workflows/networking-and-storage.md)
- [Image](./image.md)
- [Reserved IP](./reserved-ip.md)
- [Volume](./volume.md)
- [VPC](./vpc.md)
- [Security group](./security-group.md)
- [SSH key](./ssh-key.md)

## Troubleshooting Pointers

- [Catalog and plan validation errors](./troubleshooting.md#catalog-and-plan-validation-errors)
- [Missing project or location context](./troubleshooting.md#missing-project-or-location-context)
- [Attachment and identifier mix-ups](./troubleshooting.md#attachment-and-identifier-mix-ups)
