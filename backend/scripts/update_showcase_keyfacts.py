"""
Add key facts to all showcase properties:
  - available_from, furnished, deposit_weeks per unit
  - epc_rating per property

Run: python3 scripts/update_showcase_keyfacts.py
"""
import sys, os
from datetime import date, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from app.database import SessionLocal
from app.models.property import Property
from app.models.unit import Unit

TODAY = date.today()

UPDATES = {
    "Notting Hill Gardens": {
        "epc_rating": "C",
        "units": {
            "Garden Flat":      {"available_from": TODAY + timedelta(days=7),  "furnished": "furnished",       "deposit_weeks": 5},
            "First Floor Flat": {"available_from": TODAY + timedelta(days=14), "furnished": "unfurnished",     "deposit_weeks": 5},
        },
    },
    "Canary Wharf Residence": {
        "epc_rating": "B",
        "units": {
            "Apt 12A": {"available_from": TODAY + timedelta(days=3),  "furnished": "furnished",       "deposit_weeks": 5},
            "Apt 12B": {"available_from": TODAY + timedelta(days=3),  "furnished": "furnished",       "deposit_weeks": 5},
            "Apt 14A": {"available_from": TODAY + timedelta(days=30), "furnished": "part-furnished",  "deposit_weeks": 5},
        },
    },
    "Spinningfields Lofts": {
        "epc_rating": "D",
        "units": {
            "Loft A":         {"available_from": TODAY + timedelta(days=1),  "furnished": "furnished",   "deposit_weeks": 5},
            "Loft B":         {"available_from": TODAY + timedelta(days=21), "furnished": "unfurnished", "deposit_weeks": 5},
            "Loft C — Duplex":{"available_from": TODAY + timedelta(days=10), "furnished": "furnished",   "deposit_weeks": 5},
        },
    },
    "New Town Apartments": {
        "epc_rating": "E",
        "units": {
            "Ground Floor": {"available_from": TODAY + timedelta(days=5),  "furnished": "furnished",     "deposit_weeks": 5},
            "First Floor":  {"available_from": TODAY + timedelta(days=60), "furnished": "unfurnished",   "deposit_weeks": 5},
        },
    },
    "Clifton Village Mews": {
        "epc_rating": "D",
        "units": {
            "Mews House": {"available_from": TODAY + timedelta(days=2), "furnished": "part-furnished", "deposit_weeks": 5},
        },
    },
    "Jewellery Quarter Studios": {
        "epc_rating": "C",
        "units": {
            "Studio 1": {"available_from": TODAY,                         "furnished": "furnished", "deposit_weeks": 5},
            "Studio 2": {"available_from": TODAY + timedelta(days=28),   "furnished": "furnished", "deposit_weeks": 5},
            "Studio 3": {"available_from": TODAY,                         "furnished": "furnished", "deposit_weeks": 5},
            "Flat 1":   {"available_from": TODAY + timedelta(days=14),   "furnished": "furnished", "deposit_weeks": 5},
        },
    },
    "Headingley Park Terrace": {
        "epc_rating": "D",
        "units": {
            "Whole House": {"available_from": TODAY + timedelta(days=7), "furnished": "unfurnished", "deposit_weeks": 5},
        },
    },
    "Hove Seafront Apartments": {
        "epc_rating": "B",
        "units": {
            "Sea View 1A":  {"available_from": TODAY + timedelta(days=4),  "furnished": "furnished",     "deposit_weeks": 5},
            "Sea View 1B":  {"available_from": TODAY + timedelta(days=45), "furnished": "furnished",     "deposit_weeks": 5},
            "Penthouse 3":  {"available_from": TODAY + timedelta(days=4),  "furnished": "furnished",     "deposit_weeks": 5},
        },
    },
    "Jericho Cottage": {
        "epc_rating": "D",
        "units": {
            "Cottage": {"available_from": TODAY + timedelta(days=6), "furnished": "part-furnished", "deposit_weeks": 5},
        },
    },
    "Lansdown Crescent": {
        "epc_rating": "E",
        "units": {
            "Ground Floor Apartment": {"available_from": TODAY + timedelta(days=5),  "furnished": "unfurnished",   "deposit_weeks": 5},
            "Upper Apartment":        {"available_from": TODAY + timedelta(days=90), "furnished": "part-furnished","deposit_weeks": 5},
        },
    },
    "Baltic Triangle Warehouse": {
        "epc_rating": "D",
        "units": {
            "Unit A":           {"available_from": TODAY + timedelta(days=2),  "furnished": "furnished",     "deposit_weeks": 5},
            "Unit B":           {"available_from": TODAY + timedelta(days=30), "furnished": "unfurnished",   "deposit_weeks": 5},
            "Unit C — Mezzanine":{"available_from": TODAY + timedelta(days=2), "furnished": "furnished",     "deposit_weeks": 5},
        },
    },
    "Kelham Island Lofts": {
        "epc_rating": "C",
        "units": {
            "Loft 1":            {"available_from": TODAY + timedelta(days=4),   "furnished": "furnished",     "deposit_weeks": 5},
            "Loft 2":            {"available_from": TODAY + timedelta(days=4),   "furnished": "furnished",     "deposit_weeks": 5},
            "Loft 3 — Penthouse":{"available_from": TODAY + timedelta(days=60),  "furnished": "part-furnished","deposit_weeks": 5},
        },
    },
}


def run():
    db = SessionLocal()
    try:
        for prop_name, data in UPDATES.items():
            prop = db.query(Property).filter(Property.name == prop_name).first()
            if not prop:
                print(f"✗ Not found: {prop_name}"); continue

            prop.epc_rating = data["epc_rating"]

            for unit_name, udata in data["units"].items():
                unit = db.query(Unit).filter(Unit.property_id == prop.id, Unit.name == unit_name).first()
                if not unit:
                    print(f"  ✗ Unit not found: {unit_name}"); continue
                unit.available_from = udata["available_from"]
                unit.furnished      = udata["furnished"]
                unit.deposit_weeks  = udata["deposit_weeks"]
                deposit_amt = round(unit.monthly_rent * 12 / 52 * unit.deposit_weeks)
                avail = udata["available_from"].strftime("%-d %b %Y")
                print(f"  ✓ {unit_name}: {udata['furnished']}, avail {avail}, deposit £{deposit_amt:,}")

            print(f"✓ {prop_name} (EPC {data['epc_rating']})")

        db.commit()
        print("\n✓ All key facts updated.")
    except Exception as e:
        db.rollback()
        print(f"\n✗ {e}"); raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
