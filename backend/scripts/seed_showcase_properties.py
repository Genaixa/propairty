"""
Seed 12 showcase properties across UK regions with Pexels cover photos.
Run from backend dir: python3 scripts/seed_showcase_properties.py
"""
import uuid
import urllib.request
import os
import sys

# Use the app's SQLAlchemy engine (PostgreSQL in production)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from app.database import engine, SessionLocal
from app.models import Property, Unit, UploadedFile

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), '..', 'uploads')
ORG_ID = 1  # Change to match your organisation id

os.makedirs(UPLOADS_DIR, exist_ok=True)

PROPERTIES = [
    {
        "name": "Notting Hill Gardens",
        "address_line1": "14 Ladbroke Grove",
        "address_line2": None,
        "city": "London",
        "postcode": "W11 3BQ",
        "property_type": "residential",
        "description": "A beautifully presented Victorian townhouse conversion in the heart of Notting Hill. Moments from Portobello Road market, excellent transport links to central London. High ceilings, period features throughout, and a private south-facing garden.",
        "pexels_id": "1396122",
        "units": [
            {"name": "Garden Flat", "bedrooms": 2, "bathrooms": 1, "monthly_rent": 2850, "status": "vacant"},
            {"name": "First Floor Flat", "bedrooms": 1, "bathrooms": 1, "monthly_rent": 2100, "status": "occupied"},
        ],
    },
    {
        "name": "Canary Wharf Residence",
        "address_line1": "8 South Colonnade",
        "address_line2": "Canary Wharf",
        "city": "London",
        "postcode": "E14 5AB",
        "property_type": "residential",
        "description": "Sleek, modern apartment in the iconic Canary Wharf financial district. Floor-to-ceiling windows with stunning river views. Concierge, gym, roof terrace and underground parking included. 2 minutes to Jubilee Line.",
        "pexels_id": "2506990",
        "units": [
            {"name": "Apt 12A", "bedrooms": 2, "bathrooms": 2, "monthly_rent": 3400, "status": "vacant"},
            {"name": "Apt 12B", "bedrooms": 1, "bathrooms": 1, "monthly_rent": 2500, "status": "vacant"},
            {"name": "Apt 14A", "bedrooms": 3, "bathrooms": 2, "monthly_rent": 4200, "status": "occupied"},
        ],
    },
    {
        "name": "Spinningfields Lofts",
        "address_line1": "3 Hardman Square",
        "address_line2": None,
        "city": "Manchester",
        "postcode": "M3 3EB",
        "property_type": "residential",
        "description": "Stunning warehouse conversion loft apartments in Manchester's premier business and lifestyle district. Exposed brickwork, polished concrete floors and 4-metre ceilings create a truly unique living space. Surrounded by award-winning restaurants and bars.",
        "pexels_id": "1571460",
        "units": [
            {"name": "Loft A", "bedrooms": 1, "bathrooms": 1, "monthly_rent": 1350, "status": "vacant"},
            {"name": "Loft B", "bedrooms": 2, "bathrooms": 1, "monthly_rent": 1700, "status": "occupied"},
            {"name": "Loft C — Duplex", "bedrooms": 2, "bathrooms": 2, "monthly_rent": 1950, "status": "vacant"},
        ],
    },
    {
        "name": "New Town Apartments",
        "address_line1": "22 Queen Street",
        "address_line2": None,
        "city": "Edinburgh",
        "postcode": "EH2 1JX",
        "property_type": "residential",
        "description": "Elegant Georgian apartments in Edinburgh's UNESCO World Heritage New Town. Original cornicing, shuttered sash windows and working fireplaces sit alongside a fully modernised kitchen and bathrooms. Moments from Princes Street and the Royal Mile.",
        "pexels_id": "2121121",
        "units": [
            {"name": "Ground Floor", "bedrooms": 2, "bathrooms": 1, "monthly_rent": 1600, "status": "vacant"},
            {"name": "First Floor", "bedrooms": 3, "bathrooms": 2, "monthly_rent": 2100, "status": "occupied"},
        ],
    },
    {
        "name": "Clifton Village Mews",
        "address_line1": "7 Caledonia Place",
        "address_line2": "Clifton",
        "city": "Bristol",
        "postcode": "BS8 4DN",
        "property_type": "residential",
        "description": "Charming Victorian mews property in the highly sought-after Clifton Village, Bristol's most desirable residential neighbourhood. Private courtyard, original cobbles and beautifully landscaped communal gardens. A short walk from the Clifton Suspension Bridge.",
        "pexels_id": "106399",
        "units": [
            {"name": "Mews House", "bedrooms": 3, "bathrooms": 2, "monthly_rent": 2200, "status": "vacant"},
        ],
    },
    {
        "name": "Jewellery Quarter Studios",
        "address_line1": "45 Frederick Street",
        "address_line2": "Jewellery Quarter",
        "city": "Birmingham",
        "postcode": "B1 3HN",
        "property_type": "HMO",
        "description": "Contemporary studio and one-bedroom apartments in Birmingham's creative Jewellery Quarter. Former Victorian workshop sensitively converted to provide modern living with heritage character. Excellent transport links — 10 minutes to New Street station.",
        "pexels_id": "2724748",
        "units": [
            {"name": "Studio 1", "bedrooms": 0, "bathrooms": 1, "monthly_rent": 750, "status": "vacant"},
            {"name": "Studio 2", "bedrooms": 0, "bathrooms": 1, "monthly_rent": 750, "status": "occupied"},
            {"name": "Studio 3", "bedrooms": 0, "bathrooms": 1, "monthly_rent": 775, "status": "vacant"},
            {"name": "Flat 1", "bedrooms": 1, "bathrooms": 1, "monthly_rent": 950, "status": "occupied"},
        ],
    },
    {
        "name": "Headingley Park Terrace",
        "address_line1": "12 Ash Road",
        "address_line2": "Headingley",
        "city": "Leeds",
        "postcode": "LS6 3HD",
        "property_type": "residential",
        "description": "Spacious Victorian terrace in the vibrant Headingley neighbourhood, popular with young professionals and families alike. Large bay windows, original fireplaces and a generous rear garden. Excellent schools, cafés and parks within walking distance.",
        "pexels_id": "323780",
        "units": [
            {"name": "Whole House", "bedrooms": 4, "bathrooms": 2, "monthly_rent": 1900, "status": "vacant"},
        ],
    },
    {
        "name": "Hove Seafront Apartments",
        "address_line1": "62 Kings Road",
        "address_line2": None,
        "city": "Brighton",
        "postcode": "BN1 1NA",
        "property_type": "residential",
        "description": "Stunning beachfront apartments with uninterrupted sea views across the English Channel. Light-flooded interiors with contemporary finish throughout. Secure underground parking and private beach access. Brighton station is 15 minutes on foot.",
        "pexels_id": "3935320",
        "units": [
            {"name": "Sea View 1A", "bedrooms": 2, "bathrooms": 2, "monthly_rent": 2400, "status": "vacant"},
            {"name": "Sea View 1B", "bedrooms": 1, "bathrooms": 1, "monthly_rent": 1650, "status": "occupied"},
            {"name": "Penthouse 3", "bedrooms": 3, "bathrooms": 2, "monthly_rent": 3500, "status": "vacant"},
        ],
    },
    {
        "name": "Jericho Cottage",
        "address_line1": "9 Kingston Road",
        "address_line2": "Jericho",
        "city": "Oxford",
        "postcode": "OX2 6RJ",
        "property_type": "residential",
        "description": "Delightful Victorian cottage in Oxford's bohemian Jericho neighbourhood. Beautifully renovated to a high standard while retaining original character. Enclosed private garden, wood-burning stove and high-spec kitchen. Walking distance to Oxford University.",
        "pexels_id": "1029599",
        "units": [
            {"name": "Cottage", "bedrooms": 2, "bathrooms": 1, "monthly_rent": 2050, "status": "vacant"},
        ],
    },
    {
        "name": "Lansdown Crescent",
        "address_line1": "3 Lansdown Crescent",
        "address_line2": None,
        "city": "Bath",
        "postcode": "BA1 5EX",
        "property_type": "residential",
        "description": "Magnificent Grade I listed Georgian apartment forming part of Bath's famous Lansdown Crescent. Impeccably restored to honour the original Regency architecture — stone flagged hallways, marble fireplaces and sweeping countryside views.",
        "pexels_id": "2635038",
        "units": [
            {"name": "Ground Floor Apartment", "bedrooms": 2, "bathrooms": 1, "monthly_rent": 2300, "status": "vacant"},
            {"name": "Upper Apartment", "bedrooms": 3, "bathrooms": 2, "monthly_rent": 2900, "status": "occupied"},
        ],
    },
    {
        "name": "Baltic Triangle Warehouse",
        "address_line1": "18 Parliament Street",
        "address_line2": "Baltic Triangle",
        "city": "Liverpool",
        "postcode": "L8 5RN",
        "property_type": "HMO",
        "description": "Industrial-chic warehouse apartments in Liverpool's creative hub, the Baltic Triangle. Exposed steel beams, polished concrete and industrial-style kitchens give these apartments enormous personality. Home to galleries, independent restaurants and pop-up venues on the doorstep.",
        "pexels_id": "4450334",
        "units": [
            {"name": "Unit A", "bedrooms": 1, "bathrooms": 1, "monthly_rent": 850, "status": "vacant"},
            {"name": "Unit B", "bedrooms": 1, "bathrooms": 1, "monthly_rent": 875, "status": "occupied"},
            {"name": "Unit C — Mezzanine", "bedrooms": 2, "bathrooms": 1, "monthly_rent": 1100, "status": "vacant"},
        ],
    },
    {
        "name": "Kelham Island Lofts",
        "address_line1": "5 Green Lane",
        "address_line2": "Kelham Island",
        "city": "Sheffield",
        "postcode": "S3 8SQ",
        "property_type": "residential",
        "description": "Architecturally striking loft apartments in Sheffield's award-winning Kelham Island neighbourhood, recently voted one of the UK's coolest places to live. Set within a converted Victorian cutlery works with the River Don running alongside. Craft breweries and galleries within minutes.",
        "pexels_id": "1438832",
        "units": [
            {"name": "Loft 1", "bedrooms": 1, "bathrooms": 1, "monthly_rent": 900, "status": "vacant"},
            {"name": "Loft 2", "bedrooms": 2, "bathrooms": 1, "monthly_rent": 1150, "status": "vacant"},
            {"name": "Loft 3 — Penthouse", "bedrooms": 2, "bathrooms": 2, "monthly_rent": 1400, "status": "occupied"},
        ],
    },
]


def download_pexels_image(pexels_id, dest_path):
    url = f"https://images.pexels.com/photos/{pexels_id}/pexels-photo-{pexels_id}.jpeg?auto=compress&cs=tinysrgb&w=1200"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
        with open(dest_path, 'wb') as f:
            f.write(data)
        print(f"  Downloaded {len(data)//1024}KB from Pexels photo {pexels_id}")
        return len(data)
    except Exception as e:
        print(f"  WARN: Could not download photo {pexels_id}: {e}")
        return None


def seed():
    db = SessionLocal()
    created = []

    try:
        for prop_data in PROPERTIES:
            print(f"\nCreating: {prop_data['name']} ({prop_data['city']})")

            prop = Property(
                organisation_id=ORG_ID,
                name=prop_data['name'],
                address_line1=prop_data['address_line1'],
                address_line2=prop_data.get('address_line2'),
                city=prop_data['city'],
                postcode=prop_data['postcode'],
                property_type=prop_data['property_type'],
                description=prop_data.get('description'),
            )
            db.add(prop)
            db.flush()  # get prop.id
            print(f"  Property ID: {prop.id}")

            # Download and store cover photo
            filename = f"{uuid.uuid4().hex}.jpg"
            dest = os.path.join(UPLOADS_DIR, filename)
            size = download_pexels_image(prop_data['pexels_id'], dest)
            if size:
                photo = UploadedFile(
                    organisation_id=ORG_ID,
                    entity_type='property',
                    entity_id=prop.id,
                    filename=filename,
                    original_name=f"{prop_data['name'].lower().replace(' ', '-')}.jpg",
                    mime_type='image/jpeg',
                    file_size=size,
                    category='photo',
                )
                db.add(photo)
                print(f"  Photo stored as {filename}")

            # Create units
            for u in prop_data['units']:
                unit = Unit(
                    property_id=prop.id,
                    name=u['name'],
                    bedrooms=u['bedrooms'],
                    bathrooms=u['bathrooms'],
                    monthly_rent=u['monthly_rent'],
                    status=u['status'],
                )
                db.add(unit)
                print(f"  Unit: {u['name']} ({u['bedrooms']}bed £{u['monthly_rent']}/mo {u['status']})")

            created.append((prop.id, prop_data['name'], prop_data['city']))

        db.commit()
        print(f"\n✓ Done. Created {len(created)} properties:")
        for pid, name, city in created:
            print(f"  [{pid}] {name} — {city}")

    except Exception as e:
        db.rollback()
        print(f"\n✗ Error: {e}")
        raise
    finally:
        db.close()


if __name__ == '__main__':
    seed()
