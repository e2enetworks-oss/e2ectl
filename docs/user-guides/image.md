# Image

## What This Command Group Does

`e2ectl image` lists, inspects, imports, renames, and deletes saved images.

Saved images can come from `e2ectl node action save-image` or from `e2ectl image import`.

## Before You Start

- Decide whether you need a saved image (`e2ectl image`) or a catalog image (`e2ectl node catalog plans`). They use different identifiers.
- Use the exact saved-image id from `image list`, `image get`, or `node action save-image`.
- For `image import`, make sure the source is a public URL that MyAccount can reach. Local file paths are not supported.
- To create a node from a saved image, use `e2ectl node create --saved-image-id <image-id>`.

## Common Tasks

### List And Inspect Saved Images

```bash
e2ectl image list
e2ectl image get <image-id>
```

### Import An Image From A Public URL

```bash
e2ectl image import \
  --name <image-name> \
  --url <public-image-url>
```

If the imported image is not CentOS, add `--os UBUNTU`, `--os WINDOWS_BIOS`, or `--os WINDOWS_UEFI`. If you omit `--os`, the CLI uses `CENTOS`.

### Rename A Saved Image

```bash
e2ectl image rename <image-id> --name <new-image-name>
```

### Create A Node From A Saved Image

```bash
e2ectl node create \
  --name <node-name> \
  --plan <plan> \
  --saved-image-id <image-id>
```

Use `e2ectl node catalog plans` first so `--plan` comes from the current catalog output. Repeat `--ssh-key-id <ssh-key-id>` to attach more than one saved SSH key during node creation.

### Delete A Saved Image

```bash
e2ectl image delete <image-id>
```

## Examples

Import an Ubuntu image:

```bash
e2ectl image import \
  --name ubuntu-golden-2404 \
  --url https://example.com/images/ubuntu-24.04.qcow2 \
  --os UBUNTU
```

Create a node from a saved image with multiple SSH keys:

```bash
e2ectl node create \
  --name <node-name> \
  --plan <plan> \
  --saved-image-id <image-id> \
  --ssh-key-id <ssh-key-id-1> \
  --ssh-key-id <ssh-key-id-2>
```

Delete a saved image without the confirmation prompt:

```bash
e2ectl image delete <image-id> --force
```

## Automation Notes

- `image list` and `image get` are the safest discovery commands for scripts.
- Use `e2ectl --json image list` when later steps need exact `image_id` values.
- Keep saved-image node creates catalog-first by discovering the target plan with `e2ectl node catalog plans` on the same branch and environment.
- In non-interactive automation, use `image delete --force` when the workflow intentionally skips confirmation.

## Related Guides

- [Node](./node.md)
- [SSH key](./ssh-key.md)
- [Automation cookbook](./automation.md)

## Troubleshooting Pointers

- [Catalog and plan validation errors](./troubleshooting.md#catalog-and-plan-validation-errors)
- [Missing project or location context](./troubleshooting.md#missing-project-or-location-context)
- [Safe debug output](./troubleshooting.md#safe-debug-output)
