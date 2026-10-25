# SSH Key

## What This Command Group Does

`e2ectl myaccount ssh-key` creates, lists, inspects, and deletes saved SSH public keys. Attach flows use `e2ectl myaccount node action ssh-key`.

## Before You Start

- Use a public key file, not a private key file.
- Decide whether file input or stdin is the safer path for your environment.

## Common Tasks

### List And Inspect SSH Keys

```bash
e2ectl myaccount ssh-key list
e2ectl myaccount ssh-key get <ssh-key-id>
```

### Create A Key From A File

```bash
e2ectl myaccount ssh-key create \
  --label <key-label> \
  --public-key-file ~/.ssh/id_ed25519.pub
```

### Creating The Same Key Again

If the same public key is already saved (same type and key body; the comment at the end does not
count), `ssh-key create` returns the saved key instead of failing. The output says so, including
when the saved key has a different label, and `--json` has `"created": false`. A new key has
`"created": true`. This makes `ssh-key create` safe to run again in scripts.

### Create A Key From Stdin

```bash
cat ~/.ssh/id_ed25519.pub | e2ectl myaccount ssh-key create \
  --label <key-label> \
  --public-key-file -
```

### Attach Saved SSH Keys To A Node

```bash
e2ectl myaccount node action ssh-key attach <node-id> \
  --ssh-key-id <ssh-key-id>
```

Repeat `--ssh-key-id` to attach more than one key.

### Delete A Saved SSH Key

```bash
e2ectl myaccount ssh-key delete <ssh-key-id>
```

## Examples

Capture SSH key inventory for automation:

```bash
e2ectl --json myaccount ssh-key list
```

Delete a key without the confirmation prompt:

```bash
e2ectl myaccount ssh-key delete <ssh-key-id> --force
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
