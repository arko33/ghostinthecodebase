// In-memory store for the live target API that TestSprite pokes.
// This simulates an "AI-generated app under observation": a tiny invoice
// service that once shipped a BOLA/IDOR hole (OWASP API1:2023 #1) — a
// cross-owner read that skipped the ownership check. Ownership is now
// enforced unconditionally; the regression suite in the TestSprite project
// pins that behaviour so it cannot come back.

export interface User {
  id: string;
  name: string;
}

export interface Invoice {
  id: string;
  ownerId: string;
  customer: string;
  amount: number;
  currency: string;
  status: "draft" | "sent" | "paid";
  createdAt: string;
}

// matcha:adp seed data is deterministic so the TestSprite suite can reference
// a stable id (inv-1001) across cold starts on serverless.
const SEED_USERS: Record<string, User> = {
  alice: { id: "alice", name: "Alice" },
  bob: { id: "bob", name: "Bob" },
};

const SEED_INVOICES: Invoice[] = [
  {
    id: "inv-1001",
    ownerId: "alice",
    customer: "Acme Corp",
    amount: 1200,
    currency: "USD",
    status: "sent",
    createdAt: "2026-10-20T08:00:00.000Z",
  },
  {
    id: "inv-1002",
    ownerId: "bob",
    customer: "Globex",
    amount: 850,
    currency: "USD",
    status: "draft",
    createdAt: "2026-10-20T09:00:00.000Z",
  },
];

// Module-level store survives across requests within a single server instance.
// On serverless cold starts it re-seeds, which is fine because ids are stable.
const store: { users: Map<string, User>; invoices: Map<string, Invoice> } = {
  users: new Map(Object.entries(SEED_USERS)),
  invoices: new Map(SEED_INVOICES.map((i) => [i.id, i])),
};

export function getUser(id: string): User | undefined {
  return store.users.get(id);
}

export function listInvoices(ownerId: string): Invoice[] {
  return [...store.invoices.values()].filter((i) => i.ownerId === ownerId);
}

export function createInvoice(
  ownerId: string,
  input: { customer: string; amount: number; currency?: string },
): Invoice {
  const id = `inv-${Math.floor(1000 + Math.random() * 9000)}`;
  const invoice: Invoice = {
    id,
    ownerId,
    customer: input.customer,
    amount: input.amount,
    currency: input.currency ?? "USD",
    status: "draft",
    createdAt: new Date().toISOString(),
  };
  store.invoices.set(id, invoice);
  return invoice;
}

/**
 * Fetch a single invoice, scoped to the caller.
 *
 * Ownership is always enforced: a caller that does not own the invoice gets
 * `allowed: false`, which the route turns into 403 without leaking the payload.
 * The "exists but forbidden" (403) vs "not found" (404) split is kept so the
 * route never leaks whether an id exists to a caller who cannot read it.
 */
export function getInvoice(
  id: string,
  requestingUserId: string,
): { invoice: Invoice | null; allowed: boolean } {
  const invoice = store.invoices.get(id);
  if (!invoice) return { invoice: null, allowed: false };

  const allowed = invoice.ownerId === requestingUserId;
  return { invoice, allowed };
}
