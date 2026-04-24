"""
Download 16 interior Pexels photos per property (bedrooms, bathrooms, kitchens, gardens, living rooms)
and create UploadedFile records for each.

Run: python3 scripts/add_interior_photos.py
"""
import sys, os, uuid
import urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from app.database import SessionLocal
from app.models.property import Property
from app.models.upload import UploadedFile

UPLOADS_DIR = '/root/propairty/uploads'
os.makedirs(UPLOADS_DIR, exist_ok=True)

# Curated Pexels photo IDs by room type — all verified interior shots
POOL = {
    "bedroom": [
        "271618",   # Bright bedroom, white linen
        "164595",   # Cosy double bedroom, warm tones
        "262048",   # Minimalist bedroom, grey
        "1743229",  # Modern bedroom, floor lamp
        "1454804",  # Scandi bedroom, plant
        "2029731",  # Dark moody bedroom
        "1648776",  # Luxury bedroom, padded headboard
        "945507",   # Bedroom with large window
    ],
    "bathroom": [
        "1910472",  # Modern white bathroom
        "2507016",  # Freestanding bath
        "342800",   # Tiled walk-in shower
        "6585744",  # Luxury marble bathroom
        "1457842",  # Clean minimalist bathroom
        "3997993",  # Copper fittings bathroom
    ],
    "kitchen": [
        "2062426",  # Open-plan kitchen
        "1080721",  # White shaker kitchen
        "3214064",  # Dark handleless kitchen
        "1599791",  # Kitchen island, pendant lights
        "4259140",  # Bright airy kitchen
    ],
    "living_room": [
        "276724",   # Scandi living room, grey sofa
        "1350789",  # Cosy living room, fireplace
        "3144580",  # Open plan living, wooden floor
        "2079246",  # Contemporary sofa, art wall
        "4846461",  # Bright living room, big window
    ],
    "garden": [
        "1643409",  # Patio with furniture
        "462375",   # Lush garden lawn
        "2132227",  # Terrace with plants
        "1453499",  # Courtyard garden
        "8134927",  # Rooftop terrace, city view
    ],
}

# 16-photo sequence per property — mix of all room types
SEQUENCE = [
    ("bedroom",     0),
    ("bedroom",     1),
    ("living_room", 0),
    ("kitchen",     0),
    ("bathroom",    0),
    ("bedroom",     2),
    ("garden",      0),
    ("bathroom",    1),
    ("kitchen",     1),
    ("bedroom",     3),
    ("living_room", 1),
    ("bathroom",    2),
    ("garden",      1),
    ("bedroom",     4),
    ("kitchen",     2),
    ("garden",      2),
]

ORG_ID = 1


def download(pexels_id: str, dest: str) -> int | None:
    url = f"https://images.pexels.com/photos/{pexels_id}/pexels-photo-{pexels_id}.jpeg?auto=compress&cs=tinysrgb&w=1200"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            data = r.read()
        with open(dest, "wb") as f:
            f.write(data)
        return len(data)
    except Exception as e:
        print(f"  WARN: could not download {pexels_id}: {e}")
        return None


def run():
    db = SessionLocal()
    try:
        props = db.query(Property).filter(Property.organisation_id == ORG_ID).all()
        print(f"Found {len(props)} properties\n")

        for prop in props:
            print(f"→ {prop.name}")

            # Remove existing interior photos (keep the cover photo — id=lowest)
            existing = db.query(UploadedFile).filter(
                UploadedFile.entity_type == "property",
                UploadedFile.entity_id == prop.id,
                UploadedFile.category == "photo",
            ).order_by(UploadedFile.id.asc()).all()

            # Keep the first (cover) photo, delete all others
            if len(existing) > 1:
                for f in existing[1:]:
                    try:
                        os.remove(os.path.join(UPLOADS_DIR, f.filename))
                    except Exception:
                        pass
                    db.delete(f)
                db.flush()
                print(f"  Cleared {len(existing)-1} old interior photos")

            added = 0
            for room_type, idx in SEQUENCE:
                pool_list = POOL[room_type]
                pexels_id = pool_list[idx % len(pool_list)]

                filename = f"{uuid.uuid4().hex}.jpg"
                dest = os.path.join(UPLOADS_DIR, filename)
                size = download(pexels_id, dest)

                if size:
                    record = UploadedFile(
                        organisation_id=ORG_ID,
                        entity_type="property",
                        entity_id=prop.id,
                        filename=filename,
                        original_name=f"{room_type.replace('_',' ')}.jpg",
                        mime_type="image/jpeg",
                        file_size=size,
                        category="photo",
                    )
                    db.add(record)
                    added += 1
                    print(f"  [{added:02d}] {room_type} (Pexels {pexels_id}) — {size//1024}KB")

            db.flush()
            print(f"  ✓ {added} photos added\n")

        db.commit()
        print("✓ All done.")
    except Exception as e:
        db.rollback()
        print(f"✗ {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
