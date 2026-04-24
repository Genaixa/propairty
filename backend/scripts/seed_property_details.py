"""
Seed epc_potential, tenure, features, and virtual_tour_url for demo properties.
Run: python3 scripts/seed_property_details.py
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from app.database import SessionLocal
from app.models.property import Property

SEED = {
    # name_contains → (epc_potential, tenure, virtual_tour_url, features)
    "Jesmond":      ("B", "Leasehold",         "https://www.youtube.com/embed/dQw4w9WgXcQ",
                     "Double glazing throughout\nGas central heating\nFully fitted kitchen\nEn-suite to master bedroom\nPrivate rear garden\nSecure bike storage\nHigh-speed broadband ready\nClose to Metro station"),
    "Heaton":       ("C", "Leasehold",          None,
                     "Victorian bay window\nOriginal period features\nModern fitted kitchen\nGarden\nOff-street parking\nClose to amenities\nDouble glazing\nGas central heating"),
    "Gosforth":     ("B", "Freehold",           None,
                     "Detached property\nDouble garage\nPrivate driveway\nLandscaped rear garden\nConservatory\nEn-suite master bedroom\nGas central heating\nDouble glazing"),
    "Fenham":       ("D", "Freehold",           None,
                     "Semi-detached house\nPrivate rear garden\nOff-street parking\nGas central heating\nDouble glazing\nClose to schools\nClose to local shops\nBus links nearby"),
    "Gateshead":    ("C", "Leasehold",          None,
                     "River views\nConcierge service\nGym & communal lounge\nBusiness lounge\nAllocated parking\nHigh-speed broadband\nEnergy efficient\nClose to Metro"),
    "Ouseburn":     ("C", "Leasehold",          None,
                     "Exposed brick walls\nIndustrial-style interiors\nOpen-plan living\nRoof terrace access\nHigh ceilings\nClose to bars & restaurants\nBike storage\nHigh-speed broadband"),
    "Sandyford":    ("C", "Leasehold",          None,
                     "Bright open-plan layout\nModern fitted kitchen\nPrivate balcony\nAllocated parking\nClose to hospitals\nBus links\nDouble glazing\nGas central heating"),
    "Walker":       ("D", "Freehold",           None,
                     "Mid-terrace house\nPrivate garden\nGas central heating\nDouble glazing\nClose to schools\nLocal shops nearby\nGood transport links\nPet-friendly"),
    "Benton":       ("C", "Freehold",           None,
                     "Semi-detached house\nDriveway parking\nLarge rear garden\nGas central heating\nDouble glazing\nClose to Metro\nGood school catchment\nQuiet residential area"),
    "Whitley Bay":  ("B", "Freehold",           None,
                     "Detached property\nSea views\nDouble garage\nSouth-facing garden\nConservatory\nGas central heating\nDouble glazing\nClose to beach"),
    "Byker":        ("C", "Leasehold",          None,
                     "Shared house\nAll bills included\nFully furnished\nBroadband included\nClose to universities\nBus routes nearby\nCommon room\nLaundry facilities"),
    "Quayside":     ("A", "Leasehold",          "https://www.youtube.com/embed/dQw4w9WgXcQ",
                     "Stunning river views\nConcierge 24/7\nUnderground parking\nSpa & gym access\nRooftop terrace\nSmart home technology\nFloor-to-ceiling windows\nClose to restaurants & bars"),
}

def run():
    db = SessionLocal()
    try:
        props = db.query(Property).all()
        updated = 0
        for p in props:
            match = None
            for key, vals in SEED.items():
                if key.lower() in (p.name + ' ' + (p.address_line1 or '') + ' ' + (p.city or '')).lower():
                    match = vals
                    break
            if not match:
                # fallback defaults
                match = ("C", "Leasehold", None,
                         "Gas central heating\nDouble glazing\nFitted kitchen\nBathroom with shower\nClose to local amenities\nGood transport links")
            p.epc_potential    = match[0]
            p.tenure           = match[1]
            p.virtual_tour_url = match[2]
            p.features         = match[3]
            updated += 1
            print(f"  ✓ {p.name}")
        db.commit()
        print(f"\nUpdated {updated} properties.")
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    run()
