# M2_001: Internal API Client

**Prototype:** v0.1.0
**Milestone:** M2
**Workstream:** 001
**Date:** Mar 11, 2026
**Status:** DONE
**Priority:** P0 — Add the MyAccount transport layer the CLI depends on
**Depends on:** M1_001

---

## 1.0 Transport Layer

**Status:** DONE

Build a reusable MyAccount client with typed envelope parsing and consistent auth injection.

**Dimensions:**

- 1.1 DONE Add base URL, timeout, and fetch injection support
- 1.2 DONE Inject bearer auth and required query parameters
- 1.3 DONE Parse API envelopes and convert failures into CLI errors

---

## 2.0 Credential Validation

**Status:** DONE

Use the MyAccount IAM endpoint to validate config credentials before later config commands persist them.

**Dimensions:**

- 2.1 DONE Implement `/iam/multi-crn/` validation call
- 2.2 DONE Wire the concrete API-backed credential validator
- 2.3 DONE Add unit coverage for success and failure paths

---

## 3.0 Acceptance Criteria

**Status:** DONE

- [x] 3.1 API requests always send bearer auth and `apikey`
- [x] 3.2 Project-scoped requests also send `project_id` and `location`
- [x] 3.3 Invalid envelopes and transport failures are surfaced as actionable CLI errors

---

## 4.0 Out of Scope

- User-facing command implementations
- Node-specific CRUD methods
- Manual API integration tests
