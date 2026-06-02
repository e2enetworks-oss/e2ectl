# Support Ticket

## What This Command Group Does

`e2ectl support-ticket` opens, lists, inspects, replies to, closes, and reopens MyAccount support tickets without leaving the terminal. Use it to drive the same ticketing flows you would otherwise run from the MyAccount portal — including attaching files, scoping requests to a specific contact person, pulling the full reply thread, and reviewing a ticket's activity timeline.

## Before You Start

- Save a default alias (and default project / location context), or pass `--alias`, `--project-id`, and `--location` explicitly.
- Know the numeric department id you want to file against. Run `e2ectl support-ticket departments` to list the valid ids — departments are configured per-account in MyAccount.
- Attachments must be `.jpg`, `.jpeg`, `.png`, or `.pdf`, no larger than 5 MB each, with at most 5 files per request.
- Subject can be up to 60 printable ASCII characters; descriptions and reply comments accept up to 6000 characters.

## Common Tasks

### Discover Department Ids

```bash
e2ectl support-ticket departments
```

Lists every active ticket department with its numeric id, so you can pick the right value for `create --department` without leaving the terminal. Run it once when you first script against an account (the ids are account-specific) and whenever a ticket fails because the department id is wrong.

Sample output:

```text
┌─────┬───────────────┬────────────────────────────┬─────────┐
│ ID  │ Name          │ Description                │ Default │
├─────┼───────────────┼────────────────────────────┼─────────┤
│ 101 │ Cloud Support │ Infra and platform issues  │ yes     │
├─────┼───────────────┼────────────────────────────┼─────────┤
│ 102 │ Billing       │ Invoices and payments      │ no      │
└─────┴───────────────┴────────────────────────────┴─────────┘

Tip: pass an id from the ID column as e2ectl support-ticket create --department <department-id> to route a new ticket.
```

Pass `--json` to capture the same data (`id`, `name`, `description`, `is_default`, `is_enabled`) for downstream automation.

### List And Inspect Tickets

```bash
e2ectl support-ticket list
e2ectl support-ticket get <ticket-id>
```

#### SOC and Abuse tickets

SOC and Abuse tickets live in separate tables. To `get`, `get-replies`, or `reply` on one, add the matching flag so the request is routed correctly:

```bash
e2ectl support-ticket get <ticket-id> --soc-ticket
e2ectl support-ticket get-replies <ticket-id> --abuse-ticket
e2ectl support-ticket reply <ticket-id> --abuse-ticket --comment "..."
```

`--soc-ticket` and `--abuse-ticket` are mutually exclusive.

Common filters on `list`:

```bash
e2ectl support-ticket list --status open --priority urgent
e2ectl support-ticket list --category Cloud --category Billing --year 2026
e2ectl support-ticket list --page-no 2 --per-page 25
```

`--category`, `--status`, and `--priority` are repeatable: pass the flag once per value (e.g. `--status Open --status Escalated`).

`--status open` expands to `Open, On Hold, Waiting on Customer, Escalated`. `--status resolved` expands to `Resolved, Closed`. You can also pass any combination of: `New, Open, On Hold, Waiting on Customer, Escalated, Resolved, Closed`.

`--priority urgent` expands to `High, Medium`. Or pass any of `High, Medium, Low`.

`--category` accepts any combination of `Cloud, Network, Billing, Sales, SOC, Abuse`. `SOC` and `Abuse` are sent as boolean filters; the others are joined into a single category filter.

### Read The Conversation Thread

```bash
e2ectl support-ticket get-replies <ticket-id>
```

This returns every comment and reply on the ticket (description thread plus follow-ups), including author, direction, channel, visibility, and any attachments. Truncated summaries are automatically expanded to the full thread text where the API exposes it. If a reply's full content cannot be loaded, the row is marked `[truncated — full content unavailable]` (and `is_summary_complete: false` in `--json`), and a warning is printed to stderr — the gap is never silent.

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

After the ticket is created, the CLI fetches and prints its full detail (the same view as `support-ticket get`). If that follow-up fetch fails, the ticket is still created — the command prints the new ticket id and number, warns on stderr, and points you to `support-ticket get <id>`.

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

### Reopen A Ticket

```bash
e2ectl support-ticket reopen <ticket-id> \
  --comment "<reason-for-reopening>"
```

Reopening posts a comment explaining why and moves a closed ticket back into an
active state — the inverse of `close`, so a ticket's full lifecycle stays in the
terminal without needing the web UI. Scope it to a contact person with the
optional `--contact-email` / `--contact-type` flags.

Sample output:

```text
Reopened support ticket 466.
Message: Ticket reopened.

Tip: add a reply with e2ectl support-ticket reply 466, or close it again with e2ectl support-ticket close 466.
```

### Review A Ticket's Timeline

```bash
e2ectl support-ticket timeline <ticket-id>
e2ectl support-ticket timeline <ticket-id> --month 05 --year 2026
```

`timeline` lists the ticket's activity events (creation, status changes,
comments, and so on) in chronological order. Narrow the view with the optional
`--month` (1-12) and `--year` filters.

Sample output:

```text
Timeline for support ticket 466:
┌─────────────────────┬────────────────┬───────────┬────────┬────────────────────────┐
│ Time                │ Event          │ Actor     │ Status │ Description            │
├─────────────────────┼────────────────┼───────────┼────────┼────────────────────────┤
│ 2026-05-18 14:32:15 │ created        │ Asha Iyer │ Open   │ Ticket created         │
├─────────────────────┼────────────────┼───────────┼────────┼────────────────────────┤
│ 2026-05-19 10:00:00 │ comment_added  │ Customer  │ --     │ Added a comment        │
└─────────────────────┴────────────────┴───────────┴────────┴────────────────────────┘

Tip: view the ticket's current details with e2ectl support-ticket get 466.
```

Pass `--json` to get the normalized events plus the applied `filters`
(`month`, `year`) for downstream automation.

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

- Resolve `--department` once for your account (via `support-ticket departments`) and treat it as a constant in scripts; the value is account-specific.
- Use `--json` on `list`, `get`, and `replies` when piping into other tools — the JSON shape is stable and includes the page summary (`open_count`, `resolved_count`, `urgent_count`, `total_records`).
- `--contact-email` and `--contact-type` are optional. When you omit them on `create`, MyAccount uses the account owner as the contact person.
- `--channel` defaults to `Web` on `create`; override it only if your workflow needs a specific origin tag.
- `--priority-ticket` marks a ticket as a priority (chat) ticket. `--soc-ticket` / `--abuse-ticket` on `get`, `get-replies`, and `reply` route the request to the SOC or Abuse ticket table; pass at most one.

## Related Guides

- [Config](./config.md)
- [Automation cookbook](./automation.md)

## Troubleshooting Pointers

- [Authentication and import problems](./troubleshooting.md#authentication-and-import-problems)
- [Non-interactive and automation failures](./troubleshooting.md#non-interactive-and-automation-failures)
- [Safe debug output](./troubleshooting.md#safe-debug-output)
