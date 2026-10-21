# Auto-injected credentials — redacted for security; set TESTSPRITE_AUTH_CREDENTIAL to run this locally
__AUTH_CREDENTIAL__ = __import__("os").environ.get("TESTSPRITE_AUTH_CREDENTIAL", "")
__AUTH_TYPE__ = "public"
__EXTRA_HEADERS__ = {"x-user-id": "alice"}
__AUTH_HEADERS__ = {**__EXTRA_HEADERS__}
import json
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def test_deny_access_when_alice_reads_bobs_invoice():
    # alice reading bob's seeded invoice (inv-1002) must be forbidden with 403

    # Build the request — cross-owner read
    url = "VAR_{url}/api/invoices/inv-1002"
    headers = {"Content-Type": "application/json", **__AUTH_HEADERS__, "x-user-id": "alice"}

    # Call the API
    response = requests.get(url, headers=headers, timeout=30)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")

    assert response.status_code == 403, f"expected 403, got {response.status_code}"
    try:
        data = response.json()
    except Exception as exc:
        assert False, f"expected JSON body, parse failed: {exc}"
    assert data.get("error") == "forbidden", f"expected error forbidden, got {data}"

    # The reverse direction must also be forbidden: bob reading alice's inv-1001
    url2 = "VAR_{url}/api/invoices/inv-1001"
    headers2 = {"Content-Type": "application/json", **__AUTH_HEADERS__, "x-user-id": "bob"}
    response2 = requests.get(url2, headers=headers2, timeout=30)
    print(f"Reverse Status: {response2.status_code}")
    print(f"Reverse Response: {response2.text}")
    assert response2.status_code == 403, f"expected 403 on reverse cross-owner read, got {response2.status_code}"


test_deny_access_when_alice_reads_bobs_invoice()
