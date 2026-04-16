# SSH Key

## What This Command Group Does

`e2ectl ssh-key` creates, lists, inspects, and deletes saved SSH public keys. Attach flows use `e2ectl node action ssh-key`.

## Before You Start

- Use a public key file, not a private key file.
- Decide whether file input or stdin is the safer path for your environment.

## Common Tasks

### List And Inspect SSH Keys

```bash
e2ectl ssh-key list
e2ectl ssh-key get <ssh-key-id>
```

### Create A Key From A File

```bash
e2ectl ssh-key create \
  --label <key-label> \
  --public-key-file ~/.ssh/id_ed25519.pub
```

### Create A Key From Stdin

```bash
cat ~/.ssh/id_ed25519.pub | e2ectl ssh-key create \
  --label <key-label> \
  --public-key-file -
```

### Attach Saved SSH Keys To A Node

```bash
e2ectl node action ssh-key attach <node-id> \
  --ssh-key-id <ssh-key-id>
```

Repeat `--ssh-key-id` to attach more than one key.

### Delete A Saved SSH Key

```bash
e2ectl ssh-key delete <ssh-key-id>
```

## Examples

Capture SSH key inventory for automation:

```bash
e2ectl --json ssh-key list
```

Delete a key without the confirmation prompt:

```bash
e2ectl ssh-key delete <ssh-key-id> --force
```

## Automation Notes

- Keep public key material in files or stdin instead of long inline shell arguments.
- Use `--json` when later steps need saved SSH key ids for node-create or node-action flows.

## Related Guides

- [Node](./node.md)
- [Networking and storage workflow](./workflows/networking-and-storage.md)
- [Automation cookbook](./automation.md)

## Troubleshooting Pointers

- [Attachment and identifier mix-ups](./troubleshooting.md#attachment-and-identifier-mix-ups)
- [Safe debug output](./troubleshooting.md#safe-debug-output)
