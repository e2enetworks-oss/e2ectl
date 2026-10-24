# Node

## What This Command Group Does

`e2ectl myaccount node` covers catalog discovery, node lifecycle management, power actions, saved-image capture, public-IP detach, and attachment flows for VPCs, volumes, security groups, and SSH keys.

## Before You Start

- Save a default alias and default project/location context, or pass `--alias`, `--project-id`, and `--location` explicitly.
- Use `node catalog` before `node create` or `node upgrade` so you send exact plan and image identifiers from the current catalog.

## Common Tasks

### Discover OS Rows

```bash
e2ectl myaccount node catalog os
```

The rows include GPU nodes where the location offers them: display category `GPU`, category `Gpu`.
On the test account those are in Delhi only.

### Discover Exact Plans And Images

```bash
e2ectl myaccount node catalog plans \
  --display-category "<display-category>" \
  --category "<category>" \
  --os "<os>" \
  --os-version "<os-version>" \
  --billing-type all
```

Narrow the list with these filters:

| Flag                 | Keeps plans with                                         |
| -------------------- | -------------------------------------------------------- |
| `--gpu-type <card>`  | that GPU card, for example `T4`, `A100` or `Nvidia-L40S` |
| `--min-vcpu <count>` | at least that many vCPUs                                 |
| `--min-ram <gb>`     | at least that much RAM, in GB                            |

For example, every GPU plan with an A100 and at least 32 vCPUs:

```bash
e2ectl myaccount node catalog plans --location Delhi \
  --display-category GPU --category Gpu --os Ubuntu --os-version 24.04 \
  --gpu-type A100 --min-vcpu 32
```

Each `--json` item has `config.gpu`: `{ "count": 1, "memory_gb": 16, "type": "Nvidia-T4" }`, or
`null` for plans without a GPU. A GPU node is created with `node create` like any other node, using
the plan and image from this list.

### List And Inspect Nodes

```bash
e2ectl myaccount node list
e2ectl myaccount node get <node-id>
```

### Create A Node

```bash
e2ectl myaccount node create \
  --name <node-name> \
  --plan <plan> \
  --image <image>
```

Add `--wait` to return only when the node is running. It checks every 10 seconds for up to 20
minutes, and the `--json` output then includes the running node under `node`. If the node fails
to start or is still not running after 20 minutes, the error names the node so you can check or
delete it: it exists and is billed either way.

For committed billing, add `--billing-type committed --committed-plan-id <committed-plan-id>`.

For `E1` and `E1WC` plans, also pass `--disk <size-gb>`.

To create from a saved image, use the same `--image` value as a regular node create and add `--saved-image-template-id`:

```bash
e2ectl myaccount node create \
  --name <node-name> \
  --plan <plan> \
  --image <catalog-image> \
  --saved-image-template-id <template-id>
```

`<catalog-image>` is the same image identifier from `node catalog plans` (e.g. `Ubuntu-24.04-Distro`). Find `<template-id>` in the `Template ID` column of `e2ectl myaccount image list`.

### Upgrade A Node

```bash
e2ectl myaccount node upgrade <node-id> --plan <plan>
```

The node keeps the image it runs now. The CLI finds that image from the node's OS and the catalog;
if it cannot match exactly one catalog row, or the plan is not offered for that image, it stops and
asks for `--image`. `--json` reports `"image_kept": true` when the image was kept.

To switch the image at the same time, pass it:

```bash
e2ectl myaccount node upgrade <node-id> --plan <plan> --image <image>
```

### Power A Node Off Or On

```bash
e2ectl myaccount node action power-off <node-id>
e2ectl myaccount node action power-on <node-id>
```

### Reboot A Node

```bash
e2ectl myaccount node action reboot <node-id>
```

### Protect A Node From Deletion

```bash
e2ectl myaccount node action protect <node-id>
e2ectl myaccount node action unprotect <node-id>
```

A protected node cannot be deleted until protection is turned off. `node get` shows
`Deletion Protection: on` or `off`.

### Save A Node As An Image

```bash
e2ectl myaccount node action save-image <node-id> --name <image-name>
```

Manage saved images later with `e2ectl myaccount image list`, `e2ectl myaccount image rename`, and `e2ectl myaccount image delete`. Create nodes from saved images with `e2ectl myaccount node create --image <catalog-image> --saved-image-template-id <template-id>` — `--image` takes the same catalog image value as a regular node create.

### Detach The Current Primary Public IP

```bash
e2ectl myaccount node action public-ip detach <node-id>
```

### Delete A Node

```bash
e2ectl myaccount node delete <node-id>
e2ectl myaccount node delete <node-id> --reserve-public-ip
```

## Examples

Attach a volume to an existing node:

```bash
e2ectl myaccount node action volume attach <node-id> --volume-id <volume-id>
```

Attach a VPC with an explicit subnet:

```bash
e2ectl myaccount node action vpc attach <node-id> \
  --vpc-id <vpc-id> \
  --subnet-id <subnet-id>
```

Attach multiple security groups:

```bash
e2ectl myaccount node action security-group attach <node-id> \
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
