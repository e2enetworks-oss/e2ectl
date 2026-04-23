# Load Balancer Implementation Review

**Branch**: `images-feature` (rebased onto `feat/load-balancer` work)  
**Date**: 2026-04-22  
**Reviewer**: gstack plan-eng-review (automated, claude-sonnet-4-6)  
**Scope**: `src/load-balancer/`, `tests/unit/load-balancer/`, `tests/integration/load-balancer/`, `docs/user-guides/load-balancer.md`

---

## Summary

Full implementation of the `e2ectl load-balancer` command group, covering ALB (HTTP/HTTPS/BOTH) and NLB (TCP) load balancer types via the E2E Networks MyAccount API. The implementation follows the existing `types → client → service → formatter → command` layered architecture.

**Final test count**: 42 unit + 7 integration = **49 tests, all passing**.

---

## Files Added

| File                                                           | Purpose                                                  |
| -------------------------------------------------------------- | -------------------------------------------------------- |
| `src/load-balancer/types.ts`                                   | API request/response TypeScript interfaces               |
| `src/load-balancer/client.ts`                                  | `LoadBalancerApiClient` + `LoadBalancerClient` interface |
| `src/load-balancer/service.ts`                                 | Business logic, validation, credential resolution        |
| `src/load-balancer/formatter.ts`                               | Human-readable tables + JSON output                      |
| `src/load-balancer/command.ts`                                 | Commander.js command/subcommand wiring                   |
| `src/load-balancer/index.ts`                                   | Public barrel exports                                    |
| `tests/unit/load-balancer/client.test.ts`                      | 6 client unit tests (StubTransport pattern)              |
| `tests/unit/load-balancer/service.test.ts`                     | 17 service unit tests                                    |
| `tests/unit/load-balancer/formatter.test.ts`                   | 11 formatter unit tests                                  |
| `tests/unit/load-balancer/command.test.ts`                     | 8 command integration tests (CliRuntime stub)            |
| `tests/integration/load-balancer/list-fake-api.test.ts`        | 2 integration tests                                      |
| `tests/integration/load-balancer/create-fake-api.test.ts`      | 2 integration tests                                      |
| `tests/integration/load-balancer/delete-fake-api.test.ts`      | 1 integration test                                       |
| `tests/integration/load-balancer/backend-add-fake-api.test.ts` | 2 integration tests                                      |
| `docs/user-guides/load-balancer.md`                            | User-facing documentation                                |

## Files Modified

| File                 | Change                                                                 |
| -------------------- | ---------------------------------------------------------------------- |
| `src/app/program.ts` | Added `buildLoadBalancerCommand` import and `program.addCommand` call  |
| `src/app/runtime.ts` | Added `createLoadBalancerClient` to `CliRuntime` interface and factory |

---

## Commands Implemented

```
e2ectl load-balancer list
e2ectl load-balancer create   --name --plan --mode --port [--type] [--backend-name] ...
e2ectl load-balancer delete <lbId>   [--force] [--reserve-public-ip]
e2ectl load-balancer backend list <lbId>
e2ectl load-balancer backend add <lbId>   --backend-name --server-ip --server-port --server-name [...]
```

---

## API Mapping

| Operation                | Method | Path                                 |
| ------------------------ | ------ | ------------------------------------ |
| List                     | GET    | `/appliances/load-balancers/`        |
| Create                   | POST   | `/appliances/load-balancers/`        |
| Get (for backend update) | GET    | `/appliances/load-balancers/<id>/`   |
| Update                   | PUT    | `/appliances/load-balancers/<id>/`   |
| Delete                   | DELETE | `/appliances/<id>/` (different path) |

---

## Review Findings and Resolutions

### [A1] ACL Data Loss on Backend Update — FIXED

**Finding**: `addBackend` was sending `acl_list: []` and `acl_map: []` unconditionally in the PUT body, wiping any ACL rules the user had configured on the LB.

**Fix**: Extract `acl_list` and `acl_map` from the fetched context and forward them in the PUT body:

```typescript
const existingAclList = (context['acl_list'] as [] | undefined) ?? [];
const existingAclMap = (context['acl_map'] as [] | undefined) ?? [];
```

### [A2] Overly Permissive IPv4 Validation — FIXED

**Finding**: Initial implementation used a regex `^(\d{1,3}\.){3}\d{1,3}$` which accepts invalid addresses like `999.0.0.0`.

**Fix**: Replaced with `isIPv4()` from Node.js `node:net`, consistent with the rest of the codebase (reserved-ip, vpc).

### [Q1] Type-Unsafe Context Spread in PUT Body — FIXED

**Finding**: `addBackend` used `...(context as Record<string, unknown>)` to build the PUT body, bypassing TypeScript's type system and risking silent field injection.

**Fix**: Build the PUT body field by field with explicit types, preserving ACLs and timeout fields:

```typescript
client_timeout: (context['client_timeout'] as number | undefined) ?? DEFAULT_TIMEOUT,
server_timeout: (context['server_timeout'] as number | undefined) ?? DEFAULT_TIMEOUT,
...
```

### [Q2] Missing command.test.ts — FIXED

**Finding**: No unit tests validated Commander.js wiring (choice enforcement, co-required flag validation, --force behavior).

**Fix**: Added `tests/unit/load-balancer/command.test.ts` with 8 tests covering: list human output, create ALB, invalid --mode rejection, --backend-name without --server-ip, --backend-name without --server-name, delete --force, backend list, backend add.

### [Q3] Confusing Co-Required Flag Errors — FIXED

**Finding**: When `--backend-name` was provided without `--server-ip` or `--server-name`, the error message was unhelpful because the required-flag check happened after the IP parsing step.

**Fix**: Added explicit co-validation guard at the top of `createLoadBalancer` before any parsing:

```typescript
if (options.backendName !== undefined) {
  if (options.serverIp === undefined || options.serverIp.trim().length === 0) {
    throw new CliError('--server-ip is required when --backend-name is set.', ...);
  }
  if (options.serverName === undefined || options.serverName.trim().length === 0) {
    throw new CliError('--server-name is required when --backend-name is set.', ...);
  }
}
```

### [T1] Missing context=undefined Test — FIXED

**Finding**: The `addBackend` method throws a `CliError` with code `LOAD_BALANCER_CONTEXT_MISSING` when the API returns an LB with no context, but this path was not tested.

**Fix**: Added test to `service.test.ts`:

```typescript
it('throws when LB context is undefined', async () => {
  getLoadBalancer.mockResolvedValue(createAlbDetails({ context: undefined }));
  await expect(service.addBackend(...)).rejects.toMatchObject({ code: 'LOAD_BALANCER_CONTEXT_MISSING' });
});
```

---

## Design Decisions

**NLB single-backend-group constraint**: Enforced in `addBackend` by detecting NLB from `tcp_backend.length > 0 || lb.lb_mode === 'TCP'`, then comparing the existing group name against `--backend-name`. Throws `NLB_SINGLE_BACKEND_GROUP` with a suggestion pointing at the existing name.

**Delete path difference**: `DELETE /appliances/<id>/` (not `/appliances/load-balancers/<id>/`) — matches E2E Awakening source of truth. The `deleteLoadBalancer` client method uses `APPLIANCES_PATH` constant to make this explicit.

**`--server-port` defaults to `--port`**: If omitted, the server port defaults to the LB frontend port. Reduces required flags for the common single-port case.

**`--backend-port` for NLB**: Required when creating a new NLB backend group (defaults to `--server-port` then `--port`). Not needed for ALB backends.
