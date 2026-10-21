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

  // The store reports "exists but not owned" separately from "missing", so a
  // cross-owner read is denied with 403 instead of leaking existence via 404.
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({ invoice });
}
