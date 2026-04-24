"""
Update the 12 showcase properties with rich descriptions and full field usage:
  - date_listed  → triggers "New" badge (≤7 days) on some units
  - previous_rent → triggers "Reduced" badge on others
  - reception_rooms → shows reception chip on cards
  - occupancy_type → 'students' triggers "Student friendly" badge
  - Updated descriptions → longer, more evocative, mention specific features

Run from backend dir: python3 scripts/update_showcase_properties.py
"""
import sys, os
from datetime import date, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from app.database import SessionLocal
from app.models.property import Property
from app.models.unit import Unit

TODAY = date.today()

# Property name → (new description, list of unit updates keyed by unit name)
# Unit update dict keys: date_listed, previous_rent, reception_rooms, occupancy_type
UPDATES = {
    "Notting Hill Gardens": {
        "description": (
            "A beautifully presented Victorian townhouse conversion in the heart of Notting Hill, "
            "moments from Portobello Road market and the boutiques of Westbourne Grove. "
            "Original period features abound — intricate cornicing, original sash windows, "
            "cast-iron fireplaces and exposed pine floorboards — yet the property has been "
            "sensitively modernised with a Shaker-style kitchen, Quooker tap and underfloor heating throughout. "
            "A private south-facing courtyard garden provides rare outdoor space in W11. "
            "Excellent transport: Notting Hill Gate (Circle, District & Central lines) is a 4-minute walk. "
            "Available furnished or unfurnished. Pets considered. EPC rating C."
        ),
        "units": {
            "Garden Flat": {
                "date_listed": TODAY - timedelta(days=3),   # New badge
                "previous_rent": None,
                "reception_rooms": 1,
                "occupancy_type": "couple",
            },
            "First Floor Flat": {
                "date_listed": TODAY - timedelta(days=45),
                "previous_rent": 2350,                      # Reduced badge (was £2350, now £2100)
                "reception_rooms": 1,
                "occupancy_type": "single",
            },
        },
    },

    "Canary Wharf Residence": {
        "description": (
            "Sleek, architect-designed apartments in the iconic Canary Wharf financial district, "
            "occupying the upper floors of a landmark tower with floor-to-ceiling glazing and "
            "uninterrupted views across the Thames and the City skyline. "
            "Specification includes integrated Siemens appliances, Porcelanosa tiling, "
            "video-entry concierge, residents' gym, rooftop terrace and two underground parking spaces per apartment. "
            "Jubilee Line is 2 minutes on foot; Elizabeth Line (Canary Wharf) under 5 minutes. "
            "Bloomberg, HSBC and Barclays headquarters are within a 10-minute walk. "
            "Bills-included packages available. Corporate lets welcome. EPC rating B."
        ),
        "units": {
            "Apt 12A": {
                "date_listed": TODAY - timedelta(days=5),   # New badge
                "previous_rent": None,
                "reception_rooms": 1,
                "occupancy_type": "couple",
            },
            "Apt 12B": {
                "date_listed": TODAY - timedelta(days=5),   # New badge
                "previous_rent": None,
                "reception_rooms": 1,
                "occupancy_type": "single",
            },
            "Apt 14A": {
                "date_listed": TODAY - timedelta(days=120),
                "previous_rent": 4600,                      # Reduced badge
                "reception_rooms": 2,
                "occupancy_type": "family",
            },
        },
    },

    "Spinningfields Lofts": {
        "description": (
            "Stunning warehouse-conversion loft apartments in Manchester's premier business and lifestyle quarter, "
            "where Victorian industrial heritage meets contemporary urban living at its finest. "
            "Soaring 4-metre ceilings, exposed redbrick walls, polished concrete floors and original steel roof trusses "
            "create an extraordinary living environment that cannot be replicated in new-build. "
            "Each loft features bespoke fitted joinery, an island kitchen with Miele appliances, "
            "and oversized industrial-frame windows flooding every room with natural light. "
            "On the doorstep: Hawksmoor, Tattu, Australasia and the best of Manchester's culinary scene. "
            "Deansgate station 3 minutes walk; Manchester Victoria 8 minutes. EPC rating D."
        ),
        "units": {
            "Loft A": {
                "date_listed": TODAY - timedelta(days=2),   # New badge
                "previous_rent": None,
                "reception_rooms": 1,
                "occupancy_type": "single",
            },
            "Loft B": {
                "date_listed": TODAY - timedelta(days=60),
                "previous_rent": 1850,                      # Reduced
                "reception_rooms": 1,
                "occupancy_type": "couple",
            },
            "Loft C — Duplex": {
                "date_listed": TODAY - timedelta(days=14),
                "previous_rent": None,
                "reception_rooms": 2,
                "occupancy_type": "couple",
            },
        },
    },

    "New Town Apartments": {
        "description": (
            "Elegant Georgian apartments forming part of Edinburgh's UNESCO World Heritage New Town — "
            "one of the finest examples of 18th-century city planning in the world. "
            "Original architectural features are meticulously preserved: working shuttered sash windows, "
            "ornate plaster cornicing, marble fireplaces and original flagstone entrance halls. "
            "Alongside this heritage sits a fully modernised kitchen with Bosch appliances, "
            "a luxury bathroom with freestanding bath, and discreet modern wiring and heating. "
            "Moments from Princes Street, the Royal Mile, the Scottish National Gallery and the Scotch Whisky Experience. "
            "Edinburgh Waverley station 12 minutes on foot. Student and professional lets both considered. EPC rating E."
        ),
        "units": {
            "Ground Floor": {
                "date_listed": TODAY - timedelta(days=6),   # New badge
                "previous_rent": None,
                "reception_rooms": 1,
                "occupancy_type": "students",               # Student friendly badge
            },
            "First Floor": {
                "date_listed": TODAY - timedelta(days=90),
                "previous_rent": 2400,                      # Reduced
                "reception_rooms": 2,
                "occupancy_type": "professionals",
            },
        },
    },

    "Clifton Village Mews": {
        "description": (
            "A rare and charming Victorian mews house set within a private cobbled courtyard in Clifton Village, "
            "Bristol's most coveted residential address. "
            "The property has been completely renovated to a luxury standard while honouring its mews heritage: "
            "bespoke hand-painted joinery, engineered oak flooring, a beautifully appointed kitchen "
            "with an Aga and Quartz worktops, and a landscaped private courtyard garden with outdoor dining terrace. "
            "Three double bedrooms, two bathrooms (one en-suite) and a spacious open-plan reception with working fireplace. "
            "A 5-minute walk from the Clifton Suspension Bridge, Clifton Down station, Michelin-starred restaurants and the independent boutiques of Boyce's Avenue. "
            "Pets welcome. Long let preferred. EPC rating D."
        ),
        "units": {
            "Mews House": {
                "date_listed": TODAY - timedelta(days=4),   # New badge
                "previous_rent": 2500,                      # Reduced
                "reception_rooms": 2,
                "occupancy_type": "family",
            },
        },
    },

    "Jewellery Quarter Studios": {
        "description": (
            "Contemporary studio and one-bedroom apartments carved from a Grade II listed Victorian workshop "
            "in Birmingham's creative and cultural Jewellery Quarter — the UK's largest concentration of independent jewellers. "
            "Original features celebrated throughout: exposed brickwork, cast-iron columns and large factory windows "
            "sit alongside fully equipped modern kitchens, luxury shower rooms, high-speed fibre broadband and video-entry access. "
            "The Quarter itself offers an exceptional independent lifestyle — artisan coffee at Quarter Horse, "
            "cocktails at The Button Factory, fine dining at Pulperia and a thriving arts and gallery scene. "
            "Birmingham New Street station 12 minutes on foot. Ideal for students (Birmingham City University 8 min walk), "
            "young professionals and creatives. Bills-included packages available. EPC rating C."
        ),
        "units": {
            "Studio 1": {
                "date_listed": TODAY - timedelta(days=1),   # New badge
                "previous_rent": None,
                "reception_rooms": 0,
                "occupancy_type": "students",               # Student friendly
            },
            "Studio 2": {
                "date_listed": TODAY - timedelta(days=180),
                "previous_rent": 825,                       # Reduced
                "reception_rooms": 0,
                "occupancy_type": "students",
            },
            "Studio 3": {
                "date_listed": TODAY - timedelta(days=1),   # New badge
                "previous_rent": None,
                "reception_rooms": 0,
                "occupancy_type": "students",
            },
            "Flat 1": {
                "date_listed": TODAY - timedelta(days=30),
                "previous_rent": None,
                "reception_rooms": 1,
                "occupancy_type": "single",
            },
        },
    },

    "Headingley Park Terrace": {
        "description": (
            "A generous and beautifully presented Victorian terrace in the heart of Headingley, "
            "Leeds's most vibrant and cosmopolitan neighbourhood — consistently rated one of the best places to live in the north of England. "
            "The property offers four double bedrooms, two bathrooms, a large open-plan kitchen-diner "
            "with bifold doors opening onto a south-facing lawned garden, and a separate living room with original bay window and fireplace. "
            "Walking distance to Headingley Cricket Ground, the Otley Run, Hyde Park, "
            "Michelin-listed Ox Club and the independent shops of Otley Road. "
            "Outstanding schools nearby including Lawnswood and Headingley Primary. "
            "Kirkstall Forge station 8 minutes. University of Leeds 20 minutes on foot — ideal for postgraduate families. "
            "Off-street parking for two vehicles. EPC rating D."
        ),
        "units": {
            "Whole House": {
                "date_listed": TODAY - timedelta(days=7),   # New badge (exactly 7 days)
                "previous_rent": 2150,                      # Reduced
                "reception_rooms": 2,
                "occupancy_type": "family",
            },
        },
    },

    "Hove Seafront Apartments": {
        "description": (
            "Breath-taking beachfront apartments occupying a commanding position on Hove's famous Kings Road promenade, "
            "with unobstructed panoramic views across the English Channel from floor-to-ceiling glazing. "
            "Finished to an exceptional specification: bespoke Poggenpohl kitchens, Villeroy & Boch bathrooms, "
            "smart home automation, climate control and herringbone wood flooring throughout. "
            "Each apartment benefits from a private balcony or terrace directly above the beach, "
            "secure underground parking and a 24-hour concierge. The iconic Brighton Palace Pier is visible from every window. "
            "Brighton station is 15 minutes on foot or 5 minutes by taxi; Gatwick Airport 30 minutes by direct train. "
            "Some of England's finest restaurants, bars and independent boutiques are on the doorstep. EPC rating B."
        ),
        "units": {
            "Sea View 1A": {
                "date_listed": TODAY - timedelta(days=3),   # New badge
                "previous_rent": None,
                "reception_rooms": 1,
                "occupancy_type": "couple",
            },
            "Sea View 1B": {
                "date_listed": TODAY - timedelta(days=120),
                "previous_rent": 1850,                      # Reduced
                "reception_rooms": 1,
                "occupancy_type": "single",
            },
            "Penthouse 3": {
                "date_listed": TODAY - timedelta(days=3),   # New badge
                "previous_rent": None,
                "reception_rooms": 2,
                "occupancy_type": "family",
            },
        },
    },

    "Jericho Cottage": {
        "description": (
            "A delightful and rare Victorian artisan's cottage tucked away on one of Oxford's most sought-after streets "
            "in the bohemian Jericho neighbourhood — Oxford's answer to Notting Hill. "
            "Extensively renovated to an exceptional standard: a high-spec bulthaup kitchen, luxury family bathroom "
            "with roll-top bath and separate rainfall shower, engineered oak floors, "
            "Farrow & Ball throughout, and a Clearview wood-burning stove in the sitting room. "
            "The walled rear garden is fully enclosed, professionally landscaped and south-facing. "
            "Walking distance to the Ashmolean Museum, the Oxford Union, the Bodleian Library and Radcliffe Camera. "
            "Jericho's excellent restaurants, independent bookshops and the Jericho Café on the doorstep. "
            "Oxford station 18 minutes on foot. Ideal for visiting academics, researchers and Oxford University staff. EPC rating D."
        ),
        "units": {
            "Cottage": {
                "date_listed": TODAY - timedelta(days=5),   # New badge
                "previous_rent": 2300,                      # Reduced
                "reception_rooms": 1,
                "occupancy_type": "couple",
            },
        },
    },

    "Lansdown Crescent": {
        "description": (
            "A magnificent Grade I listed Georgian apartment forming part of Bath's celebrated Lansdown Crescent — "
            "one of the finest pieces of Regency architecture in Britain and a landmark of the UNESCO World Heritage City of Bath. "
            "The apartment has been impeccably restored under conservation area guidelines to honour every original detail: "
            "Doulton stone flagged hallways, carved marble chimney pieces, original shuttered windows, "
            "ornamental plasterwork ceilings and polished wooden shutters. "
            "Set against this historic canvas is a bespoke handmade kitchen, a luxury marble bathroom, "
            "contemporary concealed lighting and discreet underfloor heating. "
            "Sweeping views over the protected countryside of the Bath skyline. "
            "Bath Spa station 20 minutes on foot; Bristol Temple Meads 12 minutes by train. "
            "Royal Crescent, the Roman Baths and the Assembly Rooms all within a 10-minute walk. "
            "Available to professional couples or families only. Minimum 12-month tenancy. EPC rating E."
        ),
        "units": {
            "Ground Floor Apartment": {
                "date_listed": TODAY - timedelta(days=6),   # New badge
                "previous_rent": None,
                "reception_rooms": 2,
                "occupancy_type": "couple",
            },
            "Upper Apartment": {
                "date_listed": TODAY - timedelta(days=200),
                "previous_rent": 3200,                      # Reduced
                "reception_rooms": 2,
                "occupancy_type": "family",
            },
        },
    },

    "Baltic Triangle Warehouse": {
        "description": (
            "Industrial-chic warehouse apartments at the epicentre of Liverpool's most exciting creative district — "
            "the Baltic Triangle, home to the city's best independent restaurants, craft beer bars, galleries and tech startups. "
            "Converted from a Victorian dockside warehouse with obsessive attention to character: "
            "exposed steel I-beams, distressed concrete ceilings, polished screed floors, "
            "brickwork feature walls and industrial-style Crittal-frame windows bringing in extraordinary light. "
            "Modern kitchen with smeg appliances, fast fibre broadband, secure bike storage and a rooftop communal terrace "
            "with panoramic views over the Mersey and the Three Graces. "
            "Liverpool Central station 8 minutes on foot; Liverpool Lime Street 12 minutes. "
            "A thriving arts, music and food scene right on the doorstep — the perfect base for creatives, "
            "young professionals and students at Liverpool John Moores University (10 minutes). EPC rating D."
        ),
        "units": {
            "Unit A": {
                "date_listed": TODAY - timedelta(days=2),   # New badge
                "previous_rent": None,
                "reception_rooms": 1,
                "occupancy_type": "students",               # Student friendly
            },
            "Unit B": {
                "date_listed": TODAY - timedelta(days=90),
                "previous_rent": 975,                       # Reduced
                "reception_rooms": 1,
                "occupancy_type": "single",
            },
            "Unit C — Mezzanine": {
                "date_listed": TODAY - timedelta(days=2),   # New badge
                "previous_rent": None,
                "reception_rooms": 1,
                "occupancy_type": "couple",
            },
        },
    },

    "Kelham Island Lofts": {
        "description": (
            "Architecturally striking loft apartments set within a converted Victorian cutlery works "
            "on the banks of the River Don in Sheffield's award-winning Kelham Island neighbourhood — "
            "recently voted one of the UK's coolest places to live by Time Out and The Guardian. "
            "The conversion has been executed with exceptional craftsmanship: "
            "hand-finished plaster, reclaimed-timber feature walls, polished concrete floors "
            "and the original industrial machinery incorporated as sculptural art throughout the building's common areas. "
            "Each loft features a bespoke fitted kitchen, Velux skylights, underfloor heating, "
            "and private outdoor space (Lofts 1 & 2) or a private terrace (Penthouse). "
            "Craft breweries — Kelham Island Brewery, Hop Hideout and True North — are within a 2-minute walk, "
            "as are independent cafés, galleries and the renowned Joro restaurant. "
            "Sheffield station 12 minutes on foot. University of Sheffield campus 15 minutes — "
            "popular with postgraduate students and research academics. EPC rating C."
        ),
        "units": {
            "Loft 1": {
                "date_listed": TODAY - timedelta(days=4),   # New badge
                "previous_rent": None,
                "reception_rooms": 1,
                "occupancy_type": "students",               # Student friendly
            },
            "Loft 2": {
                "date_listed": TODAY - timedelta(days=4),   # New badge
                "previous_rent": None,
                "reception_rooms": 1,
                "occupancy_type": "couple",
            },
            "Loft 3 — Penthouse": {
                "date_listed": TODAY - timedelta(days=180),
                "previous_rent": 1550,                      # Reduced
                "reception_rooms": 2,
                "occupancy_type": "couple",
            },
        },
    },
}


def run():
    db = SessionLocal()
    updated_props = 0
    updated_units = 0

    try:
        for prop_name, data in UPDATES.items():
            prop = db.query(Property).filter(Property.name == prop_name).first()
            if not prop:
                print(f"  ✗ Property not found: {prop_name}")
                continue

            prop.description = data["description"]
            updated_props += 1

            for unit_name, udata in data["units"].items():
                unit = db.query(Unit).filter(Unit.property_id == prop.id, Unit.name == unit_name).first()
                if not unit:
                    print(f"    ✗ Unit not found: {unit_name} in {prop_name}")
                    continue
                unit.date_listed      = udata.get("date_listed")
                unit.previous_rent    = udata.get("previous_rent")
                unit.reception_rooms  = udata.get("reception_rooms", 0)
                unit.occupancy_type   = udata.get("occupancy_type")
                updated_units += 1

                badges = []
                if unit.previous_rent and unit.previous_rent > unit.monthly_rent:
                    badges.append("Reduced")
                if unit.date_listed and (TODAY - unit.date_listed).days <= 7:
                    badges.append("New")
                if unit.occupancy_type == "students":
                    badges.append("Student friendly")
                badge_str = f"  [{', '.join(badges)}]" if badges else ""
                print(f"    ✓ {unit_name}{badge_str}")

            print(f"  ✓ {prop_name}")

        db.commit()
        print(f"\n✓ Done. Updated {updated_props} properties and {updated_units} units.")

    except Exception as e:
        db.rollback()
        print(f"\n✗ Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
