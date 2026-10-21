# Auto-injected credentials — redacted for security; set TESTSPRITE_AUTH_CREDENTIAL to run this locally
__AUTH_CREDENTIAL__ = __import__("os").environ.get("TESTSPRITE_AUTH_CREDENTIAL", "")
__AUTH_TYPE__ = "public"
__EXTRA_HEADERS__ = {"x-user-id": "alice"}
__AUTH_HEADERS__ = {**__EXTRA_HEADERS__}
def test_list_bobs_own_invoices():
    # Testing GET https://ghostinthecodebase.vercel.app/api/invoices — list bob's own invoices

    url = "https://ghostinthecodebase.vercel.app/api/invoices"
    headers = {"Content-Type": "application/json", **__AUTH_HEADERS__, "x-user-id": "bob"}

    response = requests.get(url, headers=headers, timeout=30)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")

    assert response.status_code == 200, f"expected 200, got {response.status_code}"

    try:
        data = response.json()
    except Exception as exc:
        assert False, f"expected JSON body, parse failed: {exc}"

    assert isinstance(data, dict), f"expected JSON object, got {type(data).__name__}"
    assert "invoices" in data, f"expected invoices in response, got keys {list(data.keys())}"
    assert isinstance(data["invoices"], list), f"expected invoices array, got {type(data['invoices']).__name__}"
    # Count-tolerant: the suite's own create tests can add bob-adjacent records on
    # shared prod instances; assert on the seeded record + isolation, not cardinality
    assert len(data["invoices"]) >= 1, f"expected at least one invoice for bob, got {len(data['invoices'])}"

    invoice_ids = [inv.get("id") for inv in data["invoices"] if isinstance(inv, dict)]
    assert "inv-1002" in invoice_ids, f"expected bob's seeded invoice inv-1002, got ids {invoice_ids}"
    assert "inv-1001" not in invoice_ids, f"did not expect alice's invoice inv-1001, got ids {invoice_ids}"
    invoice = next(inv for inv in data["invoices"] if isinstance(inv, dict) and inv.get("id") == "inv-1002")
    assert isinstance(invoice, dict), f"expected invoice to be an object, got {type(invoice).__name__}"
    assert invoice.get("ownerId") == "bob", f"expected ownerId bob, got {invoice.get('ownerId')}"
    assert invoice.get("customer") == "Globex", f"expected customer Globex, got {invoice.get('customer')}"
    assert invoice.get("amount") == 850, f"expected amount 850, got {invoice.get('amount')}"
    assert invoice.get("currency") == "USD", f"expected currency USD, got {invoice.get('currency')}"
    assert invoice.get("status") == "draft", f"expected status draft, got {invoice.get('status')}"
    assert "createdAt" in invoice, f"expected createdAt in invoice, got keys {list(invoice.keys())}"

    allowed_keys = {"id", "ownerId", "customer", "amount", "currency", "status", "createdAt"}
    assert set(invoice.keys()).issubset(allowed_keys), f"unexpected invoice fields: {sorted(set(invoice.keys()) - allowed_keys)}"

    # Owner isolation: every record bob sees must be bob-owned
    assert all(inv.get("ownerId") == "bob" for inv in data["invoices"] if isinstance(inv, dict)), (
        f"owner isolation broken, bob saw other owners: {[inv.get('ownerId') for inv in data['invoices']]}"
    )

test_list_bobs_own_invoices()