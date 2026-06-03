# Support Ticket

## What This Command Group Does

`e2ectl support-ticket` raises, tracks, and resolves MyAccount support tickets from the terminal: create a ticket, list and filter your tickets, read the reply thread, post replies with attachments, close, reopen, and review a ticket's activity timeline.

## Before You Start

- Save a default alias and default project/location context, or pass `--alias`, `--project-id`, and `--location` explicitly.
- Run `support-ticket departments` once to find your department ids — they are account-specific and required by `create`.
- Subject: up to 60 characters. Description and reply comments: up to 250 characters.
- Attachments: `.jpg`, `.jpeg`, `.png`, or `.pdf`, up to 5 MB each, max 5 files per request.

## Common Tasks

### Discover Department Ids

```bash
e2ectl support-ticket departments
```

Pass an id from the `ID` column as `create --department <department-id>`.

### List And Inspect Tickets

```bash
e2ectl support-ticket list
e2ectl support-ticket get <ticket-id>
```

Filter the list:

```bash
e2ectl support-ticket list --status open --priority urgent
e2ectl support-ticket list --category Cloud --category Billing --year 2026
e2ectl support-ticket list --page-no 2 --per-page 25
```

- `--status open` covers `Open`, `On Hold`, `Waiting on Customer`, and `Escalated`; `--status resolved` covers `Resolved` and `Closed`. You can also pass exact statuses (`New`, `Open`, `On Hold`, `Waiting on Customer`, `Escalated`, `Resolved`, `Closed`).
- `--priority urgent` covers `High` and `Medium`; or pass `High`, `Medium`, or `Low` directly.
- `--category` accepts `Cloud`, `Network`, `Billing`, `Sales`, `SOC`, and `Abuse`.
- Repeat any of these flags to combine values, e.g. `--status Open --status Escalated`.

### Read The Reply Thread

```bash
e2ectl support-ticket get-replies <ticket-id>
```

Shows the original description plus every follow-up, with author, channel, and attachments.

### Open A New Ticket

```bash
e2ectl support-ticket create \
  --department <department-id> \
  --subject "<subject>" \
  --description "<description>" \
  --ticket-category Cloud \
  --component "<service-or-component>" \
  --priority Medium
```

On success, the CLI prints the new ticket's full details, including its id and number.

Category rules:

| Category | `--component` | `--priority` | `--resource` |
| -------- | ------------- | ------------ | ------------ |
| Cloud    | Required      | Required     | Allowed      |
| Billing  | Required      | Required     | Not allowed  |
| Network  | Optional      | Optional     | Not allowed  |
| Sales    | Optional      | Optional     | Not allowed  |

### Reply To A Ticket

```bash
e2ectl support-ticket reply <ticket-id> --comment "<reply-body>"
```

Add `--attachment <file>` (repeatable) to include screenshots or documents.

### Close A Ticket

```bash
e2ectl support-ticket close <ticket-id> --comment "<closing-comment>"
```

Closing posts the comment and resolves the ticket in a single call.

### Reopen A Ticket

```bash
e2ectl support-ticket reopen <ticket-id> --comment "<reason-for-reopening>"
```

Reopening posts the comment and moves a closed ticket back into an active state.

### Review A Ticket's Timeline

```bash
e2ectl support-ticket timeline <ticket-id>
e2ectl support-ticket timeline <ticket-id> --month 5 --year 2026
```

Lists the ticket's activity (creation, status changes, comments) in chronological order. Narrow the view with the optional `--month` (1-12) and `--year` filters.

### Work With SOC And Abuse Tickets

SOC and Abuse tickets are tracked separately. Add the matching flag to `get`, `get-replies`, or `reply` so the request is routed correctly:

```bash
e2ectl support-ticket get <ticket-id> --soc-ticket
e2ectl support-ticket get-replies <ticket-id> --abuse-ticket
e2ectl support-ticket reply <ticket-id> --abuse-ticket --comment "..."
```

`--soc-ticket` and `--abuse-ticket` are mutually exclusive.

## Examples

Open a Cloud ticket with linked resources — `--resource` takes `id:name` or `id:name:ip` and is repeatable:

```bash
e2ectl support-ticket create \
  --department 1 \
  --subject "Node 4567 reachability" \
  --description "Node has been unreachable since 14:00 IST." \
  --ticket-category Cloud \
  --component "Compute" \
  --priority High \
  --resource 4567:web-node-1:203.0.113.10 \
  --resource 4568:web-node-2
```

Open a Billing ticket with CCs and an attached invoice:

```bash
e2ectl support-ticket create \
  --department 2 \
  --subject "Invoice clarification for April 2026" \
  --description "Please review the highlighted line items in the attached invoice." \
  --ticket-category Billing \
  --component "Invoicing" \
  --priority Medium \
  --cc finance@example.com \
  --cc cfo@example.com \
  --attachment ./invoice-2026-04.pdf
```

Post a reply with a screenshot:

```bash
e2ectl support-ticket reply <ticket-id> \
  --comment "See the attached screenshot from the dashboard." \
  --attachment ./dashboard.jpg
```

Capture ticket inventory for automation:

```bash
e2ectl --json support-ticket list --status open
```

## Automation Notes

- Resolve `--department` once per account (via `support-ticket departments --json`) and treat it as a constant in scripts.
- Use `--json` on `list`, `get`, and `get-replies` when piping into other tools — the list output includes the page summary (`open_count`, `resolved_count`, `urgent_count`, `total_records`).
- `--contact-email` and `--contact-type` are optional on `create`, `get`, `reply`, `close`, and `reopen`; when omitted, MyAccount uses the account owner as the contact person.

## Related Guides

- [Config](./config.md)
- [Automation cookbook](./automation.md)

## Troubleshooting Pointers

- [Authentication and import problems](./troubleshooting.md#authentication-and-import-problems)
- [Non-interactive and automation failures](./troubleshooting.md#non-interactive-and-automation-failures)
- [Safe debug output](./troubleshooting.md#safe-debug-output)
