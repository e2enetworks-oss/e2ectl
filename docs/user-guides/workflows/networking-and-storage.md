# Networking And Storage Workflow

This workflow covers the common follow-up path after a node already exists: add storage, networking, and access resources without bouncing between unrelated docs.

## Before You Start

- Confirm the target node id with `e2ectl node list`.
- Decide which resources you actually need. Not every node needs every attachment type.
- Keep the workflow explicit so later cleanup is straightforward.

## 1. Attach A Volume

Discover the size and billing option first:

```bash
e2ectl volume plans --size <size-gb>
```

Create the volume:

```bash
e2ectl volume create \
  --name <volume-name> \
  --size <size-gb> \
  --billing-type hourly
```

Attach it to the node:

```bash
e2ectl node action volume attach <node-id> --volume-id <volume-id>
```

## 2. Attach A VPC

Review the available billing options:

```bash
e2ectl vpc plans
```

Create the VPC:

```bash
e2ectl vpc create \
  --name <vpc-name> \
  --billing-type hourly \
  --cidr-source e2e
```

Attach it to the node:

```bash
e2ectl node action vpc attach <node-id> --vpc-id <vpc-id>
```

Add `--subnet-id <subnet-id>` or `--private-ip <private-ip>` only when your network design calls for them.

## 3. Attach A Reserved IP

Allocate a new reserved IP or preserve the node's current public IP:

```bash
e2ectl reserved-ip create
e2ectl reserved-ip reserve node <node-id>
```

Attach the reserved IP to the node:

```bash
e2ectl reserved-ip attach node <ip-address> --node-id <node-id>
```

## 4. Attach Security Groups And SSH Keys

Create or update the security group:

```bash
e2ectl security-group create \
  --name <security-group-name> \
  --rules-file ./rules.json
```

Attach it to the node:

```bash
e2ectl node action security-group attach <node-id> \
  --security-group-id <security-group-id>
```

Create an SSH key if needed:

```bash
e2ectl ssh-key create \
  --label <key-label> \
  --public-key-file ~/.ssh/id_ed25519.pub
```

Attach it to the node:

```bash
e2ectl node action ssh-key attach <node-id> \
  --ssh-key-id <ssh-key-id>
```

## 5. Verify What Changed

```bash
e2ectl node get <node-id>
e2ectl volume get <volume-id>
e2ectl vpc get <vpc-id>
e2ectl reserved-ip get <ip-address>
```

## 6. Detach Or Clean Up Later

```bash
e2ectl node action volume detach <node-id> --volume-id <volume-id>
e2ectl node action vpc detach <node-id> --vpc-id <vpc-id>
e2ectl reserved-ip detach node <ip-address> --node-id <node-id>
e2ectl node action security-group detach <node-id> --security-group-id <security-group-id>
```

Then delete any disposable resources you no longer need:

```bash
e2ectl volume delete <volume-id> --force
e2ectl vpc delete <vpc-id> --force
e2ectl reserved-ip delete <ip-address> --force
```

## Related Guides

- [Node](../node.md)
- [Reserved IP](../reserved-ip.md)
- [Volume](../volume.md)
- [VPC](../vpc.md)
- [Security group](../security-group.md)
- [SSH key](../ssh-key.md)
- [Troubleshooting](../troubleshooting.md)
