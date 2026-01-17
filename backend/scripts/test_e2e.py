"""End-to-end tests for Invoice Maker backend."""

import sys
import time
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import Client

client = TestClient(app)


def test_health():
    """Test health endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    print("[PASS] Health check")


def test_list_clients():
    """Test listing clients."""
    response = client.get("/api/clients")
    assert response.status_code == 200
    clients = response.json()
    assert len(clients) >= 3  # Spectrio, Code School, Web Project Client
    print(f"[PASS] List clients ({len(clients)} found)")


def test_chat_hourly_invoice():
    """Test creating an hourly invoice via chat."""
    # Send a chat message for hourly invoice
    response = client.post(
        "/api/chat/",
        json={"content": "Create an invoice for Spectrio for 40 hours in January 2025 at $100/hr"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "preview"
    assert data["invoice_preview"]["client_name"] == "Spectrio"
    assert data["invoice_preview"]["total_amount"] == 4000.0
    print("[PASS] Chat hourly invoice preview")
    return data["session_id"]


def test_chat_tuition_invoice():
    """Test creating a tuition invoice via chat."""
    response = client.post(
        "/api/chat/",
        json={"content": "Bill Code School $500 for February tuition"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "preview"
    assert "Code School" in data["invoice_preview"]["client_name"]
    print("[PASS] Chat tuition invoice preview")


def test_chat_project_invoice():
    """Test creating a project invoice via chat."""
    response = client.post(
        "/api/chat/",
        json={"content": "Create an invoice for Web Project Client for website design $2000"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "preview"
    print("[PASS] Chat project invoice preview")


def test_chat_confirm_invoice():
    """Test confirming an invoice from preview."""
    # First create a preview with unique description
    ts = int(time.time())
    response = client.post(
        "/api/chat/",
        json={"content": f"Invoice Spectrio for 10 hours at $100/hr for consulting session {ts}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "preview", f"Expected preview, got: {data}"
    session_id = data["session_id"]

    # Confirm the invoice
    response = client.post(
        "/api/chat/",
        json={"content": "confirm", "session_id": session_id}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "invoice_created", f"Expected invoice_created, got: {data}"
    assert data["invoice_id"] is not None
    assert data["pdf_url"] is not None
    print(f"[PASS] Invoice confirmed and PDF generated: {data['invoice_id']}")
    return data["invoice_id"]


def test_get_invoice():
    """Test getting an invoice by ID."""
    # First create an invoice with unique description
    ts = int(time.time())
    response = client.post(
        "/api/chat/",
        json={"content": f"Invoice Spectrio for 5 hours at $100/hr for task {ts}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "preview", f"Expected preview, got: {data}"
    session_id = data["session_id"]

    response = client.post(
        "/api/chat/",
        json={"content": "confirm", "session_id": session_id}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "invoice_created", f"Expected invoice_created, got: {data}"
    invoice_id = data["invoice_id"]

    # Get the invoice
    response = client.get(f"/api/invoices/{invoice_id}")
    assert response.status_code == 200
    invoice = response.json()
    assert invoice["id"] == invoice_id
    print(f"[PASS] Get invoice: {invoice['invoice_number']}")


def test_list_invoices():
    """Test listing invoices."""
    response = client.get("/api/invoices")
    assert response.status_code == 200
    invoices = response.json()
    print(f"[PASS] List invoices ({len(invoices)} found)")


def test_client_memory():
    """Test that AI remembers client details."""
    response = client.post(
        "/api/chat/",
        json={"content": "What's Spectrio's hourly rate?"}
    )
    # The AI should reference the client's rate in its response
    assert response.status_code == 200
    print("[PASS] Client memory query")


def test_crud_client():
    """Test client CRUD operations."""
    # Create with unique name
    ts = int(time.time())
    unique_name = f"Test Client E2E {ts}"

    response = client.post(
        "/api/clients",
        json={
            "name": unique_name,
            "email": f"test{ts}@e2e.com",
            "default_rate": 75.00,
            "template_type": "hourly"
        }
    )
    assert response.status_code in [200, 201]
    new_client = response.json()
    client_id = new_client["id"]
    print(f"[PASS] Create client: {client_id}")

    # Read
    response = client.get(f"/api/clients/{client_id}")
    assert response.status_code == 200
    assert response.json()["name"] == unique_name
    print("[PASS] Read client")

    # Update
    response = client.put(
        f"/api/clients/{client_id}",
        json={"default_rate": 80.00}
    )
    assert response.status_code == 200
    assert float(response.json()["default_rate"]) == 80.00
    print("[PASS] Update client")

    # Delete
    response = client.delete(f"/api/clients/{client_id}")
    assert response.status_code in [200, 204]
    print("[PASS] Delete client")


def run_all_tests():
    """Run all end-to-end tests."""
    print("=" * 60)
    print("Invoice Maker End-to-End Tests")
    print("=" * 60)

    tests = [
        ("Health Check", test_health),
        ("List Clients", test_list_clients),
        ("Chat: Hourly Invoice", test_chat_hourly_invoice),
        ("Chat: Tuition Invoice", test_chat_tuition_invoice),
        ("Chat: Project Invoice", test_chat_project_invoice),
        ("Chat: Confirm Invoice", test_chat_confirm_invoice),
        ("Get Invoice", test_get_invoice),
        ("List Invoices", test_list_invoices),
        ("Client Memory", test_client_memory),
        ("Client CRUD", test_crud_client),
    ]

    passed = 0
    failed = 0

    for name, test_fn in tests:
        try:
            test_fn()
            passed += 1
        except Exception as e:
            print(f"[FAIL] {name}: {e}")
            failed += 1

    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)

    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
