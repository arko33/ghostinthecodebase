# Auto-injected credentials — redacted for security; set TESTSPRITE_AUTH_CREDENTIAL to run this locally
__AUTH_CREDENTIAL__ = __import__("os").environ.get("TESTSPRITE_AUTH_CREDENTIAL", "")
__AUTH_TYPE__ = "public"
__EXTRA_HEADERS__ = {"x-user-id": "bob"}
__AUTH_HEADERS__ = {**__EXTRA_HEADERS__}
import json
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def test_get_own_seeded_invoice_by_id_as_bob():
    # Testing GET VAR_{url}/api/invoices/inv-1002 — bob reads his own seeded invoice

    # Build the request
    url = "VAR_{url}/api/invoices/inv-1002"
    headers = {"Content-Type": "application/json", **__AUTH_HEADERS__, "x-user-id": "bob"}
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
    assert "invoice" in data, f"expected invoice wrapper in response, got keys {list(data.keys())}"
    inv = data["invoice"]
    assert isinstance(inv, dict), f"expected invoice object, got {type(inv).__name__}"
    assert inv.get("id") == "inv-1002", f"expected invoice.id inv-1002, got {inv.get('id')}"
    assert inv.get("ownerId") == "bob", f"expected invoice.ownerId bob, got {inv.get('ownerId')}"


test_get_own_seeded_invoice_by_id_as_bob()
