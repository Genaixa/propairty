#!/usr/bin/env python3
"""
Seed realistic rooms and amenities data for all units.
Run from backend dir: python scripts/seed_unit_details.py
"""
import sys, os, json, random
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    env_file = next(f for f in ["/root/propairty/backend/.env", "/root/propairty/backend/.env.production"] if os.path.exists(f))
    for line in open(env_file):
        if line.startswith("DATABASE_URL="):
            os.environ.setdefault("DATABASE_URL", line.split("=",1)[1].strip())
except StopIteration:
    pass

from app.database import SessionLocal
from app.models.unit import Unit
from app.models.property import Property

db = SessionLocal()

# ── Room templates by bedroom count ──────────────────────────────────────────
def make_rooms(bedrooms: int, bathrooms: int, reception_rooms: int = 1):
    rooms = []
    rooms.append({"type": "hallway", "label": "Entrance Hallway", "size_sqm": random.choice([4, 5, 6])})
    for i in range(reception_rooms):
        rooms.append({"type": "living_room", "label": "Living Room" if i == 0 else "Sitting Room",
                      "size_sqm": random.choice([16, 18, 20, 22])})
    rooms.append({"type": "kitchen", "label": "Kitchen / Diner",
                  "size_sqm": random.choice([10, 12, 14, 16])})
    for i in range(bedrooms):
        if i == 0:
            label = "Master Bedroom"
            size = random.choice([14, 16, 18])
            rtype = "master_bedroom"
        else:
            label = f"Bedroom {i + 1}"
            size = random.choice([9, 10, 12])
            rtype = "bedroom"
        rooms.append({"type": rtype, "label": label, "size_sqm": size})
    for i in range(bathrooms):
        if i == 0:
            rooms.append({"type": "bathroom", "label": "Family Bathroom", "size_sqm": random.choice([6, 7, 8])})
        else:
            rooms.append({"type": "ensuite", "label": "En-suite Shower Room", "size_sqm": random.choice([4, 5])})
    return rooms


# ── Amenity templates ─────────────────────────────────────────────────────────
BASE_AMENITIES = ["central_heating", "full_kitchen", "shower"]

STANDARD_AMENITIES = [
    "wifi", "washing_machine", "fridge_freezer", "oven", "hob",
    "tv", "intercom", "storage",
]

PREMIUM_AMENITIES = [
    "dishwasher", "tumble_dryer", "microwave", "kettle_toaster",
    "ev_charging", "bike_storage", "lift", "concierge",
]

OUTDOOR_AMENITIES = ["garden", "balcony", "communal_garden"]

BILLS_AMENITIES = ["gas_incl", "electric_incl", "water_incl", "broadband_incl"]


def make_amenities(prop: Property, unit: Unit) -> list:
    amenities = list(BASE_AMENITIES)

    # Furnishing
    furnished = unit.furnished or random.choice(["furnished", "furnished", "part_furnished", "unfurnished"])
    if furnished == "furnished":
        amenities += ["furnished", "beds_incl", "desk"]
    elif furnished == "part_furnished":
        amenities.append("part_furnished")
    else:
        amenities.append("unfurnished")

    # Standard (most have these)
    for a in STANDARD_AMENITIES:
        if random.random() > 0.3:
            amenities.append(a)

    # Bath
    if unit.bathrooms > 1:
        amenities.append("ensuite")
    if random.random() > 0.4:
        amenities.append("bath")
    if random.random() > 0.6:
        amenities.append("electric_shower")

    # Premium (higher rent = more premium)
    rent = float(unit.monthly_rent)
    premium_chance = 0.6 if rent > 1500 else 0.3 if rent > 800 else 0.15
    for a in PREMIUM_AMENITIES:
        if random.random() < premium_chance:
            amenities.append(a)

    # Outdoor
    has_garden = random.random() > 0.5
    if has_garden:
        amenities.append(random.choice(OUTDOOR_AMENITIES))

    # Parking
    if random.random() > 0.4:
        amenities.append("parking")

    # Bills (if bills_included)
    if prop.bills_included:
        amenities += ["gas_incl", "electric_incl", "water_incl"]
        if random.random() > 0.4:
            amenities.append("broadband_incl")

    return list(dict.fromkeys(amenities))  # deduplicate preserving order


# ── Run ───────────────────────────────────────────────────────────────────────
props = db.query(Property).all()
updated = 0

for prop in props:
    for unit in prop.units:
        beds = unit.bedrooms or 1
        baths = unit.bathrooms or 1
        recs = unit.reception_rooms or 1

        # Set rooms if not already set
        existing_rooms = []
        try:
            existing_rooms = json.loads(unit.rooms or "[]")
        except Exception:
            pass

        if not existing_rooms:
            unit.rooms = json.dumps(make_rooms(beds, baths, recs))

        # Set amenities if not already set
        existing_amenities = []
        try:
            existing_amenities = json.loads(unit.amenities or "[]")
        except Exception:
            pass

        if not existing_amenities:
            unit.amenities = json.dumps(make_amenities(prop, unit))
            # Also set furnished column from the amenities we chose
            if "furnished" in json.loads(unit.amenities):
                unit.furnished = "furnished"
            elif "part_furnished" in json.loads(unit.amenities):
                unit.furnished = "part-furnished"
            elif "unfurnished" in json.loads(unit.amenities):
                unit.furnished = "unfurnished"

        updated += 1

db.commit()
print(f"✓ Seeded rooms & amenities for {updated} units across {len(props)} properties.")
db.close()
