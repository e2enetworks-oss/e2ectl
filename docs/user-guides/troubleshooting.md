# Troubleshooting

Use this guide when a quickstart, workflow, or command guide stops being predictable.

## Authentication And Import Problems

Symptoms:

- `config import` rejects the file
- commands report missing auth fields
- the wrong account appears to be active

Checks:

- confirm the credential file came from MyAccount API & IAM
- rerun `e2ectl config list` and make sure the expected alias exists
- if you exported `E2E_API_KEY` or `E2E_AUTH_TOKEN`, remember they override the saved alias

Fixes:

- re-import the credential file with `e2ectl config import --file <path>`
- if you need a clean replacement, use `--force` during import
- remove an outdated alias with `e2ectl config remove --alias <profile-alias>`

## Missing Project Or Location Context

Symptoms:

- project-scoped commands complain about missing `project_id` or `location`
- one command works, but the next one suddenly needs more flags

Checks:

- account-scoped `project` commands do not need project or location context
- most other command families do need project and location context
- `--project-id` and `--location` override environment variables and saved defaults

Fixes:

- save shared defaults with `config import` or `config set-context`
- pass `--project-id <project-id> --location <location>` explicitly for one-off commands
- verify that your default alias is the one you expect with `e2ectl config list`

## Catalog And Plan Validation Errors

Symptoms:

- `node create`, `node upgrade`, `volume create`, or `vpc create` reject an id
- committed billing options fail validation

Checks:

- rerun the matching discovery command on the same branch and environment
- use the exact `plan`, `image`, `committed-plan-id`, or billing option from the newest output
- if the plan is `E1` or `E1WC`, make sure `node create` also includes `--disk <size-gb>`

Fixes:

- use `e2ectl node catalog plans ...` before node create or upgrade
- use `e2ectl volume plans` before volume create
- use `e2ectl vpc plans` before VPC create

## Load Balancer Errors

### 412 during `lb create`

Symptom: `MyAccount API request failed: Precondition Failed` with "Unable to fire Load Balancer vm instance".

Cause: The `--plan` value does not match any base plan name exactly.

Fix: Run `e2ectl lb plans` and copy the plan name from the Plan column (for example `E2E-LB-2`). The plan name is case-sensitive and must match exactly.

### NLB_SINGLE_BACKEND_GROUP

Symptom: `NLB <id> already has a backend group. NLB supports only one backend group.`

Cause: You ran `backend-group add` on an NLB that already has a backend group. NLBs support exactly one backend group.

Fix: Use `e2ectl lb backend-server add <lbId>` to add a server to the existing group instead of creating a new one.

### LAST_BACKEND_GROUP_NOT_DELETABLE

Symptom: `Backend group "<name>" is the last backend group on load balancer <id>. Keep at least one backend group attached.`

Cause: You tried to delete the only remaining backend group on a load balancer. The API requires at least one backend group to exist.

Fix: Either add another backend group first (`e2ectl lb backend-group add <lbId>`), or delete the entire load balancer with `e2ectl lb delete <lbId> --force` if you no longer need it.

### LAST_BACKEND_SERVER_NOT_DELETABLE

Symptom: `Server "<name>" is the last server in backend group "<group>". Keep at least one server attached.`

Cause: You tried to delete the only remaining server in a backend group. The API requires at least one server per backend group.

Fix: Either add another server first (`e2ectl lb backend-server add <lbId>`), or delete the entire backend group with `e2ectl lb backend-group remove <lbId> <groupName>` if you no longer need the group.

## Attachment And Identifier Mix-Ups

Symptoms:

- attach or detach commands fail even though the resource exists
- the CLI accepts one id shape in create output and another in later commands

Checks:

- reserved IP commands expect the exact `ip_address`
- volume attach and detach use the volume id from `volume list` or `volume get`
- VPC commands use the canonical VPC id, which is the `network_id`
- security-group and SSH-key attach flows use the ids returned by their list or get commands

Fixes:

- copy ids directly from the matching list, get, or create output
- prefer `--json` for scripts so a later step can consume the exact id field

## Non-Interactive And Automation Failures

Symptoms:

- CI hangs waiting for input
- a script behaves differently from an interactive terminal

Checks:

- `config import` needs `--no-input` when prompts are not allowed
- scripts should pass explicit defaults instead of relying on an interactive selection
- commands that change state may need `--force` when the workflow intentionally skips confirmation

Fixes:

- use the patterns in the [automation cookbook](./automation.md)
- make sure the script sets the same `HOME`, saved profile, and default context for every step that relies on local config

## Safe Debug Output

Before sharing output in issues or chat:

- redact `api_key`, `auth_token`, and any downloaded credential file contents
- consider redacting project ids, node ids, volume ids, VPC ids, security-group ids, SSH key ids, and reserved IPs when the audience does not need them
- keep screenshots cropped to the failing command and the minimal surrounding context

If you need to share machine-readable output, prefer a redacted `--json` sample over a full terminal transcript.
