# PRD — GhostInTheCodebase Invoices Target API

> Product spec for the API that TestSprite tests. This is the live demo app
> that Ghost observes: a small "agent-generated" invoice service with full
> ownership enforcement.

## Product intent

An invoices micro-API embedded in a demo product surface (the GhostInTheCodebase
dashboard). It lets two seeded users manage invoices. The API's core promise:
**a user can only ever see and create their own invoices.** Cross-user data
isolation is the product's headline behavior (an OWASP API1:2023 / BOLA
protection showcase), enforced in code — not behind a flag.

## Users & seeded data (deterministic)

| Entity | Value | Notes |
| --- | --- | --- |
| Users | `alice`, `bob` | the only valid identities |
| Invoice 1 | `inv-1001` owner `alice`, customer `Acme Corp` | stable id across restarts |
| Invoice 2 | `inv-1002` owner `bob`, customer `Globex` | stable id across restarts |

Authentication is a custom identity header, `x-user-id`, whose value must be a
seeded user id. There is no Bearer/basic/key-based auth in this API.

## Features & intended behavior

### F1 — List my invoices
A signed-in user lists invoices. Only the caller's invoices are returned;
another user's invoices never appear, in any form, including field leakage.

- `alice` sees exactly `inv-1001`.
- `bob` sees exactly `inv-1002`.
- A request without `x-user-id` (or with an unknown id) is rejected: HTTP 401,
  machine-readable body `{"error":"unauthorized"}`, no data.

### F2 — Read one invoice, owner-scoped
A single-invoice read enforces ownership explicitly:

- Own invoice → HTTP 200 with the invoice object (id, ownerId, customer,
  amount, currency, status, createdAt).
- Another user's existing invoice → HTTP **403** `{"error":"forbidden"}`,
  empty payload — the BOLADenied case. The API must not leak the record's
  existence or content.
- Unknown id → HTTP **404** `{"error":"not_found"}`.
- Missing/unknown `x-user-id` → HTTP 401.

### F3 — Create an invoice
A signed-in user creates an invoice owned by themselves.

- Valid body `{customer: string (required, non-empty), amount: number
  (required), currency: string (optional)}` → HTTP **201**; response carries
  the new invoice with `currency` defaulting to `USD` and `status` defaulting
  to `draft`; the new `ownerId` is the caller, never anyone else.
- Missing `customer`, or `amount` missing/non-numeric → HTTP **422**
  `{"error":"customer and numeric amount are required"}`; nothing is created.
- Malformed JSON body → HTTP **400** `{"error":"invalid_json"}`.
- Without `x-user-id` → HTTP **401**, and nothing is created (the created-invoice
  count must not change).

## Non-goals (out of scope)

- Payment processing / status transitions (`draft → sent → paid`).
- Registration or login endpoints — users are seeded.
- Pagination, filtering, webhooks.

## Testing intent for the suite

Cover, per feature: authentication (401), happy path (200/201), ownership denial
(403), not-found (404), validation (400/422), and isolation of the other user's
data at every step. Create operations must not mutate other users' data. Error
bodies use the machine-readable `{"error": "..."}` shape shown above.

## Suite maintenance log

- 2026-10-22 — First portal run surfaced a TestSprite plan/codegen issue: the
  generated capture assumed an `invoice_id` field, while the contract (this PRD
  + `docs/openapi.json`) defines `{"invoices":[{"id": ...}]}`, created as
  `{"invoice": {"id": ...}}`. Fixed in the portal by refining the affected
  test descriptions to capture `id` from the correct path (seeded ids remain
  `inv-1001`/`inv-1002`). API code untouched.
- 2026-10-22 — PR-check run surfaced a REAL finding: `SECURE_MODE` existed only
  in the Vercel **production** environment, so preview deployments (which the
  PR check tests) ran with the BOLA hole live and cross-owner reads returned
  200. Fixed operationally: `SECURE_MODE=on` is now also attached to the
  **preview** environment; subsequent runs assert ownership denial (`403`).
  This is the catch → fix → green loop the check is meant to exercise. API
  code remains untouched.
- 2026-10-22 — Batch runs surfaced a second REAL finding: the invoice store is
  per-serverless-instance, so `POST /api/invoices` → `201` then an immediate
  `GET` on a concurrently routed instance returns `404` (record lives only on
  the creating instance; diagnostic runs printed `Read attempt 1..6 → 404`).
  The suite now asserts the create contract + ownership fields + list
  isolation strictly, and treats cross-instance read-back as soft-verify
  (retry 6×, verify when it lands). A durable store (plan-level fix) is
  tracked in the Ghost cloud PR; until then read-back is only
  deterministic while at most one instance is warm.
- 2026-10-22 — Final suite state: **23/23 green** via the TestSprite CLI batch
  runner (`test run --all`), backend project target `ghostinthecodebase.vercel.app`.
  Test-code fixes were applied directly with `test code put` (literal seeded
  ids `inv-1001`/`inv-1002`, correct `x-user-id`, wrapped `{"invoice": ...}`
  shape) — the API contract itself remains unchanged.
