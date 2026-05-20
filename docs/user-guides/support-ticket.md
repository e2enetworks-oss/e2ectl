# Support Ticket

## What This Command Group Does

`e2ectl support-ticket` opens, lists, inspects, replies to, and closes MyAccount support tickets without leaving the terminal. Use it to drive the same ticketing flows you would otherwise run from the MyAccount portal — including attaching files, scoping requests to a specific contact person, and pulling the full reply thread.

## Before You Start

- Save a default alias (and default project / location context), or pass `--alias`, `--project-id`, and `--location` explicitly.
- Know the numeric department id you want to file against. Departments are configured per-account in MyAccount.
- Attachments must be `.jpg`, `.jpeg`, or `.pdf`, no larger than 5 MB each, with at most 5 files per request.
- Subjects accept up to 256 characters; descriptions and reply comments accept up to 6000 characters.

## Common Tasks

### List And Inspect Tickets

```bash
e2ectl support-ticket list
e2ectl support-ticket get <ticket-id>
```

Common filters on `list`:

```bash
e2ectl support-ticket list --status open --priority urgent
e2ectl support-ticket list --category Cloud,Billing --year 2026
e2ectl support-ticket list --page-no 2 --per-page 25
```

`--status open` expands to `Open, On Hold, Waiting on Customer, Escalated`. `--status resolved` expands to `Resolved, Closed`. You can also pass any comma-separated combination of: `New, Open, On Hold, Waiting on Customer, Escalated, Resolved, Closed`.

`--priority urgent` expands to `High, Medium`. Or pass a comma-separated list of `High, Medium, Low`.

`--category` accepts any combination of `Cloud, Network, Billing, Sales, SOC, Abuse`. `SOC` and `Abuse` are sent as boolean filters; the others are joined into a single category filter.

### Read The Conversation Thread

```bash
e2ectl support-ticket replies <ticket-id>
```

This returns every comment and reply on the ticket (description thread plus follow-ups), including author, direction, channel, visibility, and any attachments. Truncated summaries are automatically expanded to the full thread text where the API exposes it.

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

Category-specific rules:

| Category | `--component`           | `--priority`           | `--resource` |
| -------- | ----------------------- | ---------------------- | ------------ |
| Cloud    | Required                | Required               | Allowed      |
| Billing  | Required                | Required               | Not allowed  |
| Network  | Optional                | Optional               | Not allowed  |
| Sales    | Optional (sent as `""`) | Ignored (sent as null) | Not allowed  |

### Reply To A Ticket

```bash
e2ectl support-ticket reply <ticket-id> \
  --comment "<reply-body>"
```

### Close A Ticket

```bash
e2ectl support-ticket close <ticket-id> \
  --comment "<closing-comment>"
```

Closing posts the comment and resolves the ticket in a single call.

## Examples

Attach Cloud resources to a new Cloud ticket. `--resource` takes `id:name` or `id:name:ip`, and can be repeated:

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

Open a Billing ticket with CCs and an attached invoice PDF:

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

Scope a request to a specific contact person on the account:

```bash
e2ectl support-ticket get <ticket-id> \
  --contact-email lead@example.com \
  --contact-type "Technical Lead"
```

Post a reply with a screenshot attachment:

```bash
e2ectl support-ticket reply <ticket-id> \
  --comment "See the attached screenshot from the dashboard." \
  --attachment ./dashboard.jpg
```

Capture ticket inventory for downstream automation:

```bash
e2ectl --json support-ticket list --status open
```

## Automation Notes

- Resolve `--department` once for your account and treat it as a constant in scripts; the value is account-specific.
- Use `--json` on `list`, `get`, and `replies` when piping into other tools — the JSON shape is stable and includes the page summary (`open_count`, `resolved_count`, `urgent_count`, `total_records`).
- `--contact-email` and `--contact-type` are optional. When you omit them on `create`, MyAccount uses the account owner as the contact person.
- `--channel` defaults to `Web` on `create`; override it only if your workflow needs a specific origin tag.
- `--priority-ticket` marks a ticket as a priority (chat) ticket. `--abuse-ticket` on `reply` flags the reply as belonging to an abuse ticket.

## Related Guides

- [Config](./config.md)
- [Automation cookbook](./automation.md)

## Troubleshooting Pointers

- [Authentication and import problems](./troubleshooting.md#authentication-and-import-problems)
- [Non-interactive and automation failures](./troubleshooting.md#non-interactive-and-automation-failures)
- [Safe debug output](./troubleshooting.md#safe-debug-output)
