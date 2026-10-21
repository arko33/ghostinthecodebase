# Integration Test (auto-assembled)
# Invoice visibility and retrieval flow
# Steps: List invoices with a real user session returns only that user's seeded invoice > List invoices does not leak other users' invoice records or fields > Read an invoice using the id captured from the list

# Auto-injected credentials - redacted for security; set TESTSPRITE_AUTH_CREDENTIAL to run this locally
__AUTH_CREDENTIAL__ = __import__("os").environ.get("TESTSPRITE_AUTH_CREDENTIAL", "")
__AUTH_TYPE__ = "public"
__EXTRA_HEADERS__ = {"x-user-id": "alice"}
__AUTH_HEADERS__ = {**__EXTRA_HEADERS__}
import json
import requests
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

__CHAIN_VARS__ = dict(__VARS__)

def run_integration_test():
    try:

        # Step 1: List invoices with a real user session returns only that user's seeded invoice
        print("\n> Step 1: List invoices with a real user session returns only that user's seeded invoice")
        __EXTRA_HEADERS__ = {"x-user-id": "alice"}
        __AUTH_HEADERS__ = {**__EXTRA_HEADERS__, "x-user-id": "alice"}
        # Testing GET /api/invoices - list invoices for the signed-in alice session

        # Build the request
        url = "VAR_{url}/api/invoices"
        headers = {"Content-Type": "application/json", **__AUTH_HEADERS__, "x-user-id": "alice"}
        payload = None

        # Call the API
        response = requests.get(url, headers=headers, timeout=30)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")

        # Verify success and invoice list shape
        assert response.status_code == 200, f"expected 200, got {response.status_code}"
        try:
            data = response.json()
        except Exception as exc:
            assert False, f"expected JSON body, parse failed: {exc}"
        assert isinstance(data, dict), f"expected JSON object, got {type(data).__name__}"
        assert "invoices" in data, f"expected invoices in response, got keys {list(data.keys())}"
        assert isinstance(data["invoices"], list), f"expected invoices to be a list, got {type(data['invoices']).__name__}"
        # Count-tolerant: the suite's create tests may add alice-owned records on shared instances
        invoice_ids = [inv.get("id") for inv in data["invoices"] if isinstance(inv, dict)]
        assert "inv-1001" in invoice_ids, f"expected alice's seeded invoice inv-1001, got ids {invoice_ids}"
        invoice = next(inv for inv in data["invoices"] if isinstance(inv, dict) and inv.get("id") == "inv-1001")
        assert isinstance(invoice, dict), f"expected invoice object, got {type(invoice).__name__}"
        assert invoice.get("ownerId") == "alice", f"expected ownerId alice, got {invoice.get('ownerId')}"
        assert all(inv.get("ownerId") == "alice" for inv in data["invoices"] if isinstance(inv, dict)), (
            f"owner isolation broken, alice saw other owners: {[inv.get('ownerId') for inv in data['invoices']]}"
        )
        # Capture the seeded invoice's own id (not the top-level body)
        __CHAIN_VARS__["invoice_id"] = invoice.get("id")
        print("  ok")

        # Step 2: List invoices does not leak other users' invoice records or fields
        print("\n> Step 2: List invoices does not leak other users' invoice records or fields")
        __EXTRA_HEADERS__ = {"x-user-id": "alice"}
        __AUTH_HEADERS__ = {**__EXTRA_HEADERS__, "x-user-id": "alice"}
        # Testing GET /api/invoices - alice sees only her invoices

        # Build the request
        url = "VAR_{url}/api/invoices"
        headers = {"Content-Type": "application/json", **__AUTH_HEADERS__, "x-user-id": "alice"}
        payload = None

        # Call the API
        response = requests.get(url, headers=headers, timeout=30)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")

        # Verify success and response shape
        assert response.status_code == 200, f"expected 200, got {response.status_code}"
        try:
            data = response.json()
        except Exception as exc:
            assert False, f"expected JSON body, parse failed: {exc}"
        assert isinstance(data, dict), f"expected JSON object, got {type(data).__name__}"
        assert "invoices" in data, f"expected invoices in response, got keys {list(data.keys())}"
        assert isinstance(data["invoices"], list), f"expected invoices list, got {type(data['invoices']).__name__}"
        invoice_ids = [inv.get("id") for inv in data["invoices"] if isinstance(inv, dict)]
        assert "inv-1001" in invoice_ids, f"expected seeded invoice inv-1001 to be present, got ids {invoice_ids}"

        invoice = next(inv for inv in data["invoices"] if isinstance(inv, dict) and inv.get("id") == "inv-1001")
        assert isinstance(invoice, dict), f"expected invoice object, got {type(invoice).__name__}"
        assert invoice.get("ownerId") == "alice", f"expected alice-owned invoice, got ownerId={invoice.get('ownerId')}"
        assert all(inv.get("ownerId") == "alice" for inv in data["invoices"] if isinstance(inv, dict)), (
            f"owner isolation broken, alice saw other owners: {[inv.get('ownerId') for inv in data['invoices']]}"
        )
        assert invoice.get("id") != "inv-1002", "response leaked bob's invoice id"
        assert invoice.get("customer") != "Bob Co", "response leaked bob's invoice customer"
        assert invoice.get("amount") != 9999, "response leaked bob's invoice amount"
        assert invoice.get("currency") != "EUR", "response leaked bob's invoice currency"
        assert invoice.get("status") != "draft", "response leaked bob's invoice status"
        assert "ownerEmail" not in invoice, "response leaked owner-scoped field ownerEmail"
        assert "ownerName" not in invoice, "response leaked owner-scoped field ownerName"
        assert "owner" not in invoice, "response leaked owner-scoped field owner"
        __CHAIN_VARS__["invoice_id"] = invoice.get("id")
        print("  ok")

        # Step 3: Read an invoice using the id captured from the list
        print("\n> Step 3: Read an invoice using the id captured from the list")
        __EXTRA_HEADERS__ = {"x-user-id": "alice"}
        __AUTH_HEADERS__ = {**__EXTRA_HEADERS__, "x-user-id": "alice"}
        # Testing GET /api/invoices/{id} - read invoice by captured id

        # Build the request
        url = f"VAR_{url}/api/invoices/{__CHAIN_VARS__['invoice_id']}"
        headers = {"Content-Type": "application/json", **__AUTH_HEADERS__, "x-user-id": "alice"}
        payload = None

        # Call the API
        response = requests.get(url, headers=headers, timeout=30)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")

        # Verify success and wrapped single-invoice shape (API contract: {"invoice": {...}})
        assert response.status_code == 200, f"expected 200, got {response.status_code}"
        try:
            data = response.json()
        except Exception as exc:
            assert False, f"expected JSON body, parse failed: {exc}"
        assert isinstance(data, dict), f"expected JSON object, got {type(data).__name__}"
        assert "invoice" in data, f"expected wrapped invoice key in response, got keys {list(data.keys())}"
        invoice = data["invoice"]
        assert isinstance(invoice, dict), f"expected invoice object, got {type(invoice).__name__}"
        assert invoice.get("id") == __CHAIN_VARS__["invoice_id"], f"expected id {__CHAIN_VARS__['invoice_id']}, got {invoice.get('id')}"
        assert invoice.get("ownerId") == "alice", f"expected ownerId alice, got {invoice.get('ownerId')}"
        print("  ok")

    finally:
        pass


run_integration_test()
