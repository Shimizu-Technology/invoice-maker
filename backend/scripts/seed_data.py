"""Seed the database with sample clients."""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from decimal import Decimal
from app.database import SessionLocal, engine, Base
from app.models import Client, Invoice, HoursEntry, LineItem
from app.models.client import TemplateType


def seed_clients():
    """Create sample clients for testing."""
    # Create tables if they don't exist
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully.")

    db = SessionLocal()

    try:
        # Check if clients already exist
        existing = db.query(Client).first()
        if existing:
            print("Clients already exist. Skipping seed.")
            return

        # Sample clients
        clients = [
            Client(
                name="Spectrio",
                email="billing@spectrio.com",
                address="123 Business Ave, Suite 100, Orlando, FL 32801",
                default_rate=Decimal("100.00"),
                template_type=TemplateType.HOURLY,
                timezone="America/New_York",
                company_context="Contract work - monthly invoicing",
            ),
            Client(
                name="Code School",
                email="accounting@codeschool.com",
                address="456 Education Blvd, Austin, TX 78701",
                default_rate=Decimal("500.00"),
                template_type=TemplateType.TUITION,
                timezone="America/Chicago",
                company_context="Monthly tuition billing",
            ),
            Client(
                name="Web Project Client",
                email="contact@webproject.com",
                address="789 Tech Lane, San Francisco, CA 94102",
                default_rate=Decimal("150.00"),
                template_type=TemplateType.PROJECT,
                timezone="America/Los_Angeles",
                company_context="Project-based work with milestones",
            ),
        ]

        for client in clients:
            db.add(client)

        db.commit()
        print(f"Created {len(clients)} sample clients:")
        for client in clients:
            print(f"  - {client.name} ({client.template_type.value}): ${client.default_rate}/hr")

    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_clients()
