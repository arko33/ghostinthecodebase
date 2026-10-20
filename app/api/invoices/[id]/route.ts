import { NextRequest, NextResponse } from "next/server";
import { getInvoice, getUser } from "@/src/store/invoices";

// matcha:api single-invoice endpoint. The BOLA catch target lives here.
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = req.headers.get("x-user-id");
  if (!userId || !getUser(userId)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { invoice, allowed } = getInvoice(params.id, userId);

  if (!invoice) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // In SECURE_MODE=on the store returns null for cross-owner reads; in
  // SECURE_MODE=off it returns the invoice (the BOLA leak). When the invoice
  // exists but is not owned, deny with 403 rather than leaking existence.
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({ invoice });
}
