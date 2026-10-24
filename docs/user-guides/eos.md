# EOS

## What This Command Group Does

`e2ectl myaccount eos` manages EOS, the E2E object storage: buckets, access keys for S3 tools
such as `mc`, and which keys can use which bucket.

## Before You Start

- Set the MyAccount project and location with `e2ectl myaccount configure`. Buckets and keys
  belong to a location.
- Install an S3 tool such as [MinIO Client](https://min.io/docs/minio/linux/reference/minio-mc.html)
  (`mc`) to upload and download files.

## Common Tasks

### Create A Bucket And A Key That Can Use It

```bash
e2ectl myaccount eos bucket create my-bucket
e2ectl myaccount eos key create --name ci2026
e2ectl myaccount eos access grant my-bucket --access-key <access-key> --role writer
```

Bucket names are 3 to 63 lowercase letters, digits, dots and dashes, starting and ending with a
letter or digit. Key names are 3 to 50 letters and digits, with no spaces or dashes. `key create` prints the
access key, the secret key and the endpoint. Save the secret key then:
e2ectl shows it only there, never in `key list` or `access list`.

Roles: `admin` (everything), `writer` (read and write objects), `reader` (read objects).
Granting one key never removes another key's access.

### Upload And Download With mc

```bash
mc alias set e2e https://<endpoint> <access-key> <secret-key>
mc cp ./report.csv e2e/my-bucket/
mc cp e2e/my-bucket/report.csv ./report-copy.csv
```

### See And Change Access

```bash
e2ectl myaccount eos access list my-bucket
e2ectl myaccount eos access revoke my-bucket <access-id>
```

### Delete Keys And Buckets

```bash
e2ectl myaccount eos key delete <access-key>
e2ectl myaccount eos bucket delete my-bucket
```

Both ask first; `--force` skips the question. Deleting a bucket deletes every object in it, and
E2E finishes it in the background: the bucket leaves `bucket list` when it is done.

## Examples

```bash
e2ectl --json myaccount eos bucket list
e2ectl --json myaccount eos key list
e2ectl --json myaccount eos access list my-bucket
```

`key create --json` returns:

```json
{
  "action": "key-create",
  "endpoint": "<endpoint>",
  "key": {
    "access_key": "<access-key>",
    "disabled": false,
    "id": 77,
    "name": "ci2026",
    "secret_key": "<secret-key>"
  }
}
```

## Errors And What To Do

| Message                                                      | What to do                                              |
| ------------------------------------------------------------ | ------------------------------------------------------- |
| `Access key <key> was not found.`                            | Pick one from `e2ectl myaccount eos key list`.          |
| `Access key name ... is not allowed.`                        | Use 3 to 50 letters and digits, for example `ci2026`.   |
| `"..." is not a valid bucket name.`                          | Use 3 to 63 lowercase letters, digits, dots and dashes. |
| `Unknown role`                                               | Use `--role admin`, `--role writer` or `--role reader`. |
| `This delete needs confirmation in an interactive terminal.` | Add `--force` in scripts.                               |

## Related Guides

- [Config](./config.md)
- [Automation cookbook](./automation.md)
