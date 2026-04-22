# Image

## What This Command Group Does

`e2ectl image` lists, inspects, imports, renames, and deletes saved images.

Saved images can come from `e2ectl node action save-image` or from `e2ectl image import`.

## Before You Start

- Decide whether you need a saved image (`e2ectl image`) or a catalog image (`e2ectl node catalog plans`). They use different identifiers.
- Use `e2ectl image list` to find the `Template ID` needed for node creation.
- For `image import`, make sure the source is a public URL that MyAccount can reach. Local file paths are not supported.
- To create a node from a saved image, use `e2ectl node create --image <catalog-image> --saved-image-template-id <template-id>`. The `--image` value is the same catalog image identifier used in regular node creates (e.g. `Ubuntu-24.04-Distro`), not the saved image's OS name.

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
  --image <catalog-image> \
  --saved-image-template-id <template-id>
```

This is identical to a regular node create with two additions: `--saved-image-template-id` (the `Template ID` from `e2ectl image list`) and `is_saved_image` is set automatically. `--image` takes the same catalog image identifier as a regular create (e.g. `Ubuntu-24.04-Distro` from `node catalog plans`). Repeat `--ssh-key-id <ssh-key-id>` to attach more than one saved SSH key during node creation.

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
  --image Ubuntu-24.04-Distro \
  --saved-image-template-id <template-id> \
  --ssh-key-id <ssh-key-id-1> \
  --ssh-key-id <ssh-key-id-2>
```

Delete a saved image without the confirmation prompt:

```bash
e2ectl image delete <image-id> --force
```

## Automation Notes

- `image list` and `image get` are the safest discovery commands for scripts.
- Use `e2ectl --json image list` when later steps need the exact `template_id` to pass as `--saved-image-template-id`.
- Keep saved-image node creates catalog-first: discover `--plan` and `--image` from `e2ectl node catalog plans`, then add `--saved-image-template-id` from `e2ectl image list`.
- In non-interactive automation, use `image delete --force` when the workflow intentionally skips confirmation.

## Related Guides

- [Node](./node.md)
- [SSH key](./ssh-key.md)
- [Automation cookbook](./automation.md)

## Troubleshooting Pointers

- [Catalog and plan validation errors](./troubleshooting.md#catalog-and-plan-validation-errors)
- [Missing project or location context](./troubleshooting.md#missing-project-or-location-context)
- [Safe debug output](./troubleshooting.md#safe-debug-output)
