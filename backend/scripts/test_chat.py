"""Test the chat endpoint."""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    """Test health endpoint."""
    response = client.get("/health")
    print(f"Health check: {response.json()}")
    assert response.status_code == 200


def test_list_clients():
    """Test listing clients."""
    response = client.get("/api/clients")
    print(f"Clients: {response.json()}")
    assert response.status_code == 200


def test_chat_invoice():
    """Test chat endpoint for invoice creation."""
    # Send a chat message
    response = client.post(
        "/api/chat/",
        json={"content": "Create an invoice for Spectrio for 40 hours in January 2025 at $100/hr"}
    )
    print(f"Chat response status: {response.status_code}")
    print(f"Chat response: {response.json()}")
    assert response.status_code == 200


if __name__ == "__main__":
    print("=" * 50)
    print("Testing Invoice Maker API")
    print("=" * 50)

    print("\n1. Testing health endpoint...")
    test_health()

    print("\n2. Testing list clients...")
    test_list_clients()

    print("\n3. Testing chat endpoint...")
    test_chat_invoice()

    print("\n" + "=" * 50)
    print("All tests passed!")
    print("=" * 50)
