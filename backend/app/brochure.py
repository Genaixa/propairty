"""
Professional PDF brochure generator for property listings.
Generates once, caches to disk, regenerates only when content changes.
"""
import hashlib
import json
import os
from datetime import date
from pathlib import Path

UPLOAD_DIR = Path("/root/propairty/backend/uploads")
BROCHURE_DIR = UPLOAD_DIR  # store alongside other uploads

EPC_BANDS = [
    ("A", "92–100", "#007f3b"),
    ("B", "81–91",  "#2d994d"),
    ("C", "69–80",  "#69b045"),
    ("D", "55–68",  "#f0b424"),
    ("E", "39–54",  "#f07124"),
    ("F", "21–38",  "#e0351e"),
    ("G", "1–20",   "#b30000"),
]

CTB_EXPLANATIONS = {
    "A": "Band A — Lowest rate. Properties valued under £40,000 at 1991 prices.",
    "B": "Band B — Properties valued £40,001–£52,000 at 1991 prices.",
    "C": "Band C — Properties valued £52,001–£68,000 at 1991 prices.",
    "D": "Band D — Properties valued £68,001–£88,000 at 1991 prices. UK average.",
    "E": "Band E — Properties valued £88,001–£120,000 at 1991 prices.",
    "F": "Band F — Properties valued £120,001–£160,000 at 1991 prices.",
    "G": "Band G — Properties valued £160,001–£320,000 at 1991 prices.",
    "H": "Band H — Highest rate. Properties valued over £320,000 at 1991 prices.",
}

AMENITY_LABELS = {
    "wifi": "WiFi", "parking": "Parking", "washing_machine": "Washing machine",
    "tumble_dryer": "Tumble dryer", "dishwasher": "Dishwasher", "tv": "TV",
    "central_heating": "Central heating", "air_conditioning": "Air conditioning",
    "garden": "Garden", "balcony": "Balcony", "storage": "Storage",
    "fireplace": "Fireplace", "full_kitchen": "Fully equipped kitchen",
    "microwave": "Microwave", "oven": "Oven", "hob": "Hob",
    "fridge_freezer": "Fridge / freezer", "kettle_toaster": "Kettle & toaster",
    "shower": "Shower", "bath": "Bath", "ensuite": "En-suite",
    "electric_shower": "Electric shower", "lift": "Lift / elevator",
    "concierge": "Porter / concierge", "intercom": "Intercom",
    "bike_storage": "Bike storage", "communal_garden": "Communal garden",
    "ev_charging": "EV charging", "gas_incl": "Gas included",
    "electric_incl": "Electricity included", "water_incl": "Water included",
    "broadband_incl": "Broadband included", "council_tax_incl": "Council tax included",
    "furnished": "Furnished", "part_furnished": "Part furnished",
    "unfurnished": "Unfurnished", "beds_incl": "Beds included", "desk": "Desk / workspace",
}

AMENITY_ICONS = {
    "wifi": "📶", "parking": "🚗", "washing_machine": "🫧", "tumble_dryer": "♻️",
    "dishwasher": "🍽️", "tv": "📺", "central_heating": "🌡️", "air_conditioning": "❄️",
    "garden": "🌿", "balcony": "🏙️", "storage": "📦", "fireplace": "🔥",
    "full_kitchen": "🍳", "microwave": "📻", "oven": "🔲", "hob": "🟠",
    "fridge_freezer": "🧊", "kettle_toaster": "☕", "shower": "🚿", "bath": "🛁",
    "ensuite": "🚪", "electric_shower": "⚡", "lift": "🛗", "concierge": "🏨",
    "intercom": "📞", "bike_storage": "🚲", "communal_garden": "🌳",
    "ev_charging": "🔌", "gas_incl": "💨", "electric_incl": "💡",
    "water_incl": "💧", "broadband_incl": "🌐", "council_tax_incl": "📋",
    "furnished": "🛋️", "part_furnished": "🪑", "unfurnished": "🏚️",
    "beds_incl": "🛏️", "desk": "🖥️",
}

AMENITY_DESCS = {
    "wifi":            "High-speed broadband connection available.",
    "parking":         "Off-street or dedicated parking space included.",
    "washing_machine": "In-unit or communal washing machine available.",
    "tumble_dryer":    "Tumble dryer available — no laundrette trips needed.",
    "dishwasher":      "Built-in dishwasher for convenient clean-up.",
    "tv":              "Television set or TV point provided.",
    "central_heating": "Full central heating system throughout — gas or electric.",
    "air_conditioning":"Air conditioning unit(s) for year-round comfort.",
    "garden":          "Private garden or outdoor space for your use.",
    "balcony":         "Private balcony with outdoor space.",
    "storage":         "Dedicated storage cupboard or space included.",
    "fireplace":       "Feature fireplace — decorative or working.",
    "full_kitchen":    "Fully fitted kitchen with all essential cooking appliances.",
    "microwave":       "Microwave oven included.",
    "oven":            "Electric or gas oven.",
    "hob":             "Gas or electric hob for everyday cooking.",
    "fridge_freezer":  "Full-size fridge/freezer included.",
    "kettle_toaster":  "Kettle and toaster provided.",
    "shower":          "Shower unit — over-bath or separate cubicle.",
    "bath":            "Full bath tub included.",
    "ensuite":         "Private en-suite shower room to the master bedroom.",
    "electric_shower": "Mains-pressure electric shower.",
    "lift":            "Passenger lift serving all floors.",
    "concierge":       "On-site porter or concierge service.",
    "intercom":        "Video or audio door intercom system.",
    "bike_storage":    "Secure on-site cycle storage.",
    "communal_garden": "Access to shared communal garden or courtyard.",
    "ev_charging":     "Electric vehicle charging point on site.",
    "gas_incl":        "Gas bills included in the monthly rent.",
    "electric_incl":   "Electricity bills included in the monthly rent.",
    "water_incl":      "Water rates included in the monthly rent.",
    "broadband_incl":  "Broadband internet included in the monthly rent.",
    "council_tax_incl":"Council tax covered by the landlord.",
    "furnished":       "Property is fully furnished — beds, sofas, dining furniture and storage all included.",
    "part_furnished":  "Some furniture included — please confirm exact items with agent.",
    "unfurnished":     "Unfurnished — tenants bring their own furniture.",
    "beds_incl":       "Bed frames and mattresses provided in all bedrooms.",
    "desk":            "Desk and workspace area — ideal for home working.",
}

AMENITY_GROUPS = [
    ("Kitchen & appliances",  ["full_kitchen", "oven", "hob", "microwave", "fridge_freezer", "dishwasher", "kettle_toaster"]),
    ("Bathroom",              ["shower", "bath", "ensuite", "electric_shower"]),
    ("Heating & climate",     ["central_heating", "air_conditioning", "fireplace"]),
    ("Laundry",               ["washing_machine", "tumble_dryer"]),
    ("Outdoor & storage",     ["garden", "balcony", "communal_garden", "storage", "bike_storage", "parking", "ev_charging"]),
    ("Connectivity & home",   ["wifi", "tv", "intercom", "desk"]),
    ("Building services",     ["lift", "concierge"]),
    ("Bills included",        ["gas_incl", "electric_incl", "water_incl", "broadband_incl", "council_tax_incl"]),
    ("Furnishing",            ["furnished", "part_furnished", "unfurnished", "beds_incl"]),
]

ROOM_ICONS = {
    "master_bedroom": "🛏️", "bedroom": "🛏️", "living_room": "🛋️",
    "kitchen": "🍳", "kitchen_diner": "🍽️", "dining_room": "🪑",
    "bathroom": "🛁", "ensuite": "🚿", "wc": "🚽", "study": "🖥️",
    "utility": "🫧", "hallway": "🚪", "storage": "📦",
    "conservatory": "🌿", "garage": "🚗", "garden": "🌳",
    "balcony": "🏙️", "other": "🔲",
}

ROOM_DESCS = {
    "master_bedroom": "The principal bedroom with ample space for a double or king-size bed plus wardrobes.",
    "bedroom":        "Good-sized bedroom suitable for a single or double bed.",
    "living_room":    "The main reception room — the social heart of the home.",
    "kitchen":        "Fitted kitchen with base and wall units, worktops, and integrated appliances.",
    "kitchen_diner":  "Open-plan kitchen and dining area — perfect for entertaining.",
    "dining_room":    "Formal dining room separate from the kitchen.",
    "bathroom":       "Full family bathroom with bath, wash-hand basin, and WC.",
    "ensuite":        "Private en-suite shower room directly accessible from the bedroom.",
    "wc":             "Separate guest WC / cloakroom.",
    "study":          "Dedicated home office or study room.",
    "utility":        "Utility / laundry room — typically houses washing machine and dryer.",
    "hallway":        "Entrance hallway — provides access to all principal rooms.",
    "storage":        "Built-in storage cupboard or airing cupboard.",
    "conservatory":   "Conservatory or sun room with natural light throughout.",
    "garage":         "Integral or detached garage — storage or parking.",
    "garden":         "Private rear or front garden.",
    "balcony":        "Private balcony with outdoor access.",
}


def _brochure_cache_paths(prop_id: int):
    pdf  = BROCHURE_DIR / f"auto_brochure_{prop_id}.pdf"
    hash_ = BROCHURE_DIR / f"auto_brochure_{prop_id}.hash"
    return pdf, hash_


def _compute_hash(prop, photo_urls: list, org) -> str:
    data = {
        "_v": 4,  # bump to force regeneration when template changes
        "name": prop.name,
        "address": prop.address_line1,
        "address2": prop.address_line2,
        "city": prop.city,
        "postcode": prop.postcode,
        "description": prop.description,
        "features": prop.features,
        "property_type": prop.property_type,
        "epc_rating": prop.epc_rating,
        "epc_potential": prop.epc_potential,
        "council_tax_band": prop.council_tax_band,
        "bills_included": prop.bills_included,
        "tenure": prop.tenure,
        "reference_number": prop.reference_number,
        "photos": sorted(photo_urls),
        "units": sorted([
            {
                "id": u.id,
                "name": u.name,
                "bedrooms": u.bedrooms,
                "bathrooms": u.bathrooms,
                "reception_rooms": u.reception_rooms,
                "monthly_rent": str(u.monthly_rent),
                "furnished": u.furnished,
                "available_from": str(u.available_from) if u.available_from else None,
                "deposit_weeks": u.deposit_weeks,
                "amenities": u.amenities,
                "rooms": u.rooms,
            }
            for u in prop.units
        ], key=lambda x: x["id"]),
        "org_name": org.name,
        "org_color": org.brand_color,
        "org_email": org.email,
        "org_phone": org.phone,
    }
    return hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()


def invalidate_brochure_cache(prop_id: int):
    """Call this whenever property content changes (photos, units, details)."""
    _, hash_path = _brochure_cache_paths(prop_id)
    try:
        hash_path.unlink(missing_ok=True)
    except Exception:
        pass


def get_or_generate_brochure(prop, photo_urls: list, org, floorplan_url: str | None = None) -> bytes:
    """
    Return cached PDF bytes if content hasn't changed, otherwise generate and cache a new one.
    """
    pdf_path, hash_path = _brochure_cache_paths(prop.id)

    current_hash = _compute_hash(prop, photo_urls, org)

    # Check cache hit
    if pdf_path.exists() and hash_path.exists():
        try:
            if hash_path.read_text().strip() == current_hash:
                return pdf_path.read_bytes()
        except Exception:
            pass

    # Generate
    try:
        from weasyprint import HTML as WPHtml
    except ImportError:
        raise RuntimeError("weasyprint not installed")

    html = _build_html(prop, photo_urls, org, floorplan_url)
    pdf_bytes = WPHtml(string=html, base_url="https://propairty.co.uk").write_pdf()

    # Cache
    try:
        pdf_path.write_bytes(pdf_bytes)
        hash_path.write_text(current_hash)
    except Exception:
        pass  # Cache write failure is non-fatal

    return pdf_bytes


# ─────────────────────────────────────────────────────────────────────────────
# HTML template
# ─────────────────────────────────────────────────────────────────────────────

def _img(url: str, style: str = "") -> str:
    if not url:
        return ""
    src = f"https://propairty.co.uk{url}" if url.startswith("/") else url
    return f'<img src="{src}" style="{style}" />'


def _build_html(prop, photo_urls: list, org, floorplan_url) -> str:
    import json as _json

    brand = org.brand_color or "#4f46e5"
    vacant = [u for u in prop.units if u.status == "vacant"]
    features = [f.strip() for f in (prop.features or "").splitlines() if f.strip()]

    full_address = ", ".join(filter(None, [
        prop.address_line1, prop.address_line2, prop.city, prop.postcode
    ]))
    prop_type_label = {
        "residential": "Residential property",
        "HMO": "HMO / House share",
        "commercial": "Commercial property",
    }.get(prop.property_type, prop.property_type or "Property")

    # Price range
    if vacant:
        rents = [float(u.monthly_rent) for u in vacant]
        if min(rents) == max(rents):
            price_str = f"£{int(min(rents)):,} pcm"
        else:
            price_str = f"£{int(min(rents)):,}–£{int(max(rents)):,} pcm"
    else:
        price_str = "Price on application"

    # Cover photo & gallery
    cover_url = (f"https://propairty.co.uk{photo_urls[0]}" if photo_urls else "")
    gallery_urls = [f"https://propairty.co.uk{u}" for u in photo_urls[1:]]

    # Bedroom / bathroom summary across all units
    all_beds  = sorted(set(u.bedrooms or 0 for u in prop.units))
    all_baths = sorted(set(u.bathrooms or 0 for u in prop.units))
    bed_str   = ("Studio" if all_beds == [0] else
                 f"{all_beds[0]}–{all_beds[-1]} bed" if len(all_beds) > 1 else
                 f"{all_beds[0]} bed") if all_beds else "—"
    bath_str  = (f"{all_baths[0]}–{all_baths[-1]}" if len(all_baths) > 1 else str(all_baths[0])) if all_baths else "—"

    ref = prop.reference_number or f"PROP-{prop.id:04d}"
    today = date.today().strftime("%d %B %Y")

    css = f"""
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
        font-family: Inter, -apple-system, Helvetica, sans-serif;
        color: #111827; background: #fff; font-size: 10pt; line-height: 1.65;
    }}
    a {{ color: {brand}; text-decoration: none; }}

    /* ── Cover ── */
    .cover {{ page-break-after: always; }}
    .cover-img {{ width: 100%; height: 185mm; object-fit: cover; object-position: center; display: block; }}
    .cover-brand {{
        background: {brand}; color: #fff;
        padding: 6mm 20mm; display: flex; justify-content: space-between; align-items: center;
    }}
    .cover-brand-name {{ font-size: 13pt; font-weight: 800; }}
    .cover-brand-contact {{ font-size: 8pt; opacity: 0.85; text-align: right; }}
    .cover-body {{ padding: 10mm 20mm 8mm; }}
    .cover-badge {{
        display: inline-block; background: {brand}18; color: {brand};
        font-size: 8pt; font-weight: 700; padding: 1.5mm 5mm;
        border-radius: 99px; margin-bottom: 4mm; border: 1px solid {brand}44;
        text-transform: uppercase; letter-spacing: .06em;
    }}
    .cover-title {{ font-size: 24pt; font-weight: 900; line-height: 1.2; margin-bottom: 2mm; }}
    .cover-address {{ font-size: 11pt; color: #6b7280; margin-bottom: 6mm; }}
    .cover-price {{ font-size: 28pt; font-weight: 900; color: {brand}; margin-bottom: 1mm; }}
    .cover-price-sub {{ font-size: 9pt; color: #6b7280; }}
    .cover-stats {{
        display: flex; gap: 5mm; margin-top: 6mm;
        border-top: 1px solid #e5e7eb; padding-top: 5mm;
    }}
    .cover-stat {{ text-align: center; flex: 1; }}
    .cover-stat-val {{ font-size: 16pt; font-weight: 800; color: {brand}; display: block; }}
    .cover-stat-lbl {{ font-size: 7.5pt; color: #9ca3af; font-weight: 500; }}
    .cover-ref {{ font-size: 7.5pt; color: #9ca3af; margin-top: 5mm; }}

    /* ── Section / page ── */
    .page {{ padding: 14mm 20mm; page-break-after: always; }}
    .page-last {{ padding: 14mm 20mm; }}
    .section {{ margin-bottom: 8mm; }}
    .section-title {{
        font-size: 8pt; font-weight: 800; text-transform: uppercase; letter-spacing: .1em;
        color: {brand}; border-bottom: 2px solid {brand}22;
        padding-bottom: 2mm; margin-bottom: 4mm;
    }}
    .page-title {{ font-size: 18pt; font-weight: 900; margin-bottom: 6mm; color: #111827; }}

    /* ── Two column ── */
    .two-col {{ display: flex; gap: 8mm; }}
    .two-col > .col {{ flex: 1; }}
    .two-col > .col-narrow {{ flex: 0 0 55mm; }}

    /* ── Description ── */
    .description {{ font-size: 10.5pt; color: #374151; line-height: 1.75; }}

    /* ── Key facts table ── */
    .facts-table {{ width: 100%; border-collapse: collapse; font-size: 9.5pt; }}
    .facts-table td {{ padding: 2.5mm 3mm; border-bottom: 1px solid #f3f4f6; vertical-align: top; }}
    .facts-table td:first-child {{ color: #6b7280; font-weight: 500; white-space: nowrap; width: 40%; }}
    .facts-table td:last-child {{ font-weight: 600; }}
    .facts-table tr:last-child td {{ border-bottom: none; }}

    /* ── Features list ── */
    .features-grid {{ display: flex; flex-wrap: wrap; gap: 0; }}
    .feature-item {{
        width: 50%; display: flex; align-items: flex-start; gap: 2.5mm;
        padding: 1.5mm 0; font-size: 9.5pt; color: #374151;
    }}
    .feature-tick {{
        width: 4.5mm; height: 4.5mm; border-radius: 50%; background: {brand};
        color: #fff; font-size: 6pt; display: inline-flex; align-items: center;
        justify-content: center; flex-shrink: 0; margin-top: 0.5mm;
    }}

    /* ── Photo grid ── */
    .gallery-grid {{ display: flex; flex-wrap: wrap; gap: 3mm; }}
    .gallery-grid img {{
        object-fit: cover; border-radius: 4px; display: block;
    }}
    .g-full  {{ width: 100%;                height: 65mm; }}
    .g-half  {{ width: calc(50% - 1.5mm);  height: 50mm; }}
    .g-third {{ width: calc(33.33% - 2mm); height: 42mm; }}
    .g-two-thirds {{ width: calc(66.66% - 1.5mm); height: 55mm; }}

    /* ── Unit cards ── */
    .unit-card {{
        border: 1.5px solid {brand}44; border-radius: 8px;
        overflow: hidden; margin-bottom: 5mm;
    }}
    .unit-header {{
        background: {brand}0d; border-bottom: 1px solid {brand}22;
        padding: 4mm 5mm; display: flex; justify-content: space-between; align-items: flex-start;
    }}
    .unit-name {{ font-size: 12pt; font-weight: 800; }}
    .unit-price {{ font-size: 18pt; font-weight: 900; color: {brand}; line-height: 1; }}
    .unit-price-sub {{ font-size: 8pt; color: #9ca3af; }}
    .unit-body {{ padding: 4mm 5mm; }}
    .unit-spec-row {{ display: flex; gap: 6mm; font-size: 9pt; color: #6b7280; margin-bottom: 3mm; }}
    .unit-facts {{ display: flex; flex-wrap: wrap; gap: 2mm; }}
    .unit-fact {{
        background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 5px;
        padding: 1.5mm 3mm; font-size: 8.5pt; color: #374151;
    }}
    .deposit-box {{
        background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px;
        padding: 3mm 4mm; font-size: 9pt; color: #166534; margin-top: 3mm;
    }}

    /* ── Rooms table ── */
    .rooms-table {{ width: 100%; border-collapse: collapse; font-size: 9.5pt; }}
    .rooms-table thead th {{
        background: #f9fafb; padding: 2.5mm 4mm; text-align: left;
        font-size: 7.5pt; font-weight: 700; text-transform: uppercase;
        letter-spacing: .06em; color: #6b7280; border-bottom: 2px solid #e5e7eb;
    }}
    .rooms-table tbody td {{ padding: 2.5mm 4mm; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }}
    .rooms-table tbody tr:last-child td {{ border-bottom: none; }}
    .room-icon {{ font-size: 13pt; line-height: 1; }}
    .room-desc {{ font-size: 8pt; color: #9ca3af; margin-top: 0.5mm; }}

    /* ── Amenities ── */
    .amenity-group {{ margin-bottom: 6mm; }}
    .amenity-group-title {{
        font-size: 8pt; font-weight: 700; text-transform: uppercase;
        letter-spacing: .08em; color: #6b7280; margin-bottom: 2.5mm;
    }}
    .amenity-list {{ display: flex; flex-wrap: wrap; gap: 2mm; }}
    .amenity-chip {{
        background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px;
        padding: 2mm 3.5mm; font-size: 8.5pt; display: flex; align-items: center; gap: 2mm;
    }}
    .amenity-chip-icon {{ font-size: 11pt; line-height: 1; }}
    .amenity-chip-text {{ }}
    .amenity-chip-desc {{ font-size: 7.5pt; color: #9ca3af; display: block; }}

    /* ── EPC ── */
    .epc-container {{ display: flex; gap: 8mm; }}
    .epc-bar-col {{ flex: 0 0 50mm; }}
    .epc-band-row {{
        display: flex; align-items: center; gap: 3mm;
        padding: 1.5mm 3mm; margin-bottom: 1mm;
        border-radius: 3px; font-size: 9pt; font-weight: 700; color: #fff;
    }}
    .epc-band-row.current {{ outline: 2.5px solid #111; outline-offset: 1px; }}
    .epc-band-row.inactive {{ opacity: 0.35; }}
    .epc-info-col {{ flex: 1; font-size: 9pt; color: #374151; }}
    .epc-info-col p {{ margin-bottom: 3mm; line-height: 1.6; }}

    /* ── Info callout ── */
    .info-box {{
        background: #eff6ff; border-left: 3px solid #3b82f6;
        padding: 3mm 4mm; border-radius: 0 6px 6px 0;
        font-size: 8.5pt; color: #1e40af; margin: 3mm 0; line-height: 1.6;
    }}
    .warn-box {{
        background: #fffbeb; border-left: 3px solid #f59e0b;
        padding: 3mm 4mm; border-radius: 0 6px 6px 0;
        font-size: 8.5pt; color: #92400e; margin: 3mm 0; line-height: 1.6;
    }}

    /* ── Steps ── */
    .steps {{ display: flex; flex-direction: column; gap: 4mm; }}
    .step {{ display: flex; gap: 4mm; align-items: flex-start; }}
    .step-num {{
        width: 7mm; height: 7mm; border-radius: 50%; background: {brand};
        color: #fff; font-size: 9pt; font-weight: 800;
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }}
    .step-body {{ flex: 1; }}
    .step-title {{ font-weight: 700; font-size: 10pt; }}
    .step-desc {{ font-size: 8.5pt; color: #6b7280; margin-top: 0.5mm; }}

    /* ── Contact box ── */
    .contact-box {{
        background: {brand}; color: #fff; border-radius: 8px;
        padding: 8mm; text-align: center; margin-bottom: 6mm;
    }}
    .contact-box h2 {{ font-size: 16pt; font-weight: 900; margin-bottom: 2mm; }}
    .contact-box p {{ font-size: 9.5pt; opacity: .85; margin-bottom: 4mm; }}
    .contact-detail {{ font-size: 12pt; font-weight: 700; }}

    /* ── Footer ── */
    .footer {{
        background: #f9fafb; border-top: 2px solid {brand};
        padding: 4mm 20mm; display: flex; justify-content: space-between; align-items: center;
        font-size: 7.5pt; color: #9ca3af;
    }}
    .footer-brand {{ font-weight: 700; color: #6b7280; }}

    /* ── Divider ── */
    .divider {{ height: 1px; background: #f3f4f6; margin: 5mm 0; }}
    .accent-divider {{ height: 2px; background: {brand}22; margin: 5mm 0; }}

    /* Page break helpers */
    .pb {{ page-break-before: always; padding-top: 0; }}
    """

    # ── Cover page ────────────────────────────────────────────────────────────
    cover = f"""
    <div class="cover">
      <div class="cover-brand">
        <span class="cover-brand-name">{org.name}</span>
        <span class="cover-brand-contact">
          {org.email or ''}{' · ' if org.email and org.phone else ''}{org.phone or ''}
        </span>
      </div>
      {f'<img class="cover-img" src="{cover_url}" />' if cover_url else
       '<div style="height:185mm;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:40pt;">🏠</div>'}
      <div class="cover-body">
        <span class="cover-badge">{prop_type_label}</span>
        <div class="cover-title">{prop.name}</div>
        <div class="cover-address">📍 {full_address}</div>
        <div class="cover-price">{price_str}</div>
        <div class="cover-price-sub">per calendar month · all prices excl. bills unless stated</div>
        <div class="cover-stats">
          <div class="cover-stat">
            <span class="cover-stat-val">{bed_str}</span>
            <span class="cover-stat-lbl">Bedroom{'' if bed_str in ('Studio','1 bed') else 's'}</span>
          </div>
          <div class="cover-stat">
            <span class="cover-stat-val">{bath_str}</span>
            <span class="cover-stat-lbl">Bathroom{'' if bath_str == '1' else 's'}</span>
          </div>
          <div class="cover-stat">
            <span class="cover-stat-val">{len(vacant)}</span>
            <span class="cover-stat-lbl">Unit{'' if len(vacant)==1 else 's'} available</span>
          </div>
          <div class="cover-stat">
            <span class="cover-stat-val">{len(photo_urls)}</span>
            <span class="cover-stat-lbl">Photo{'' if len(photo_urls)==1 else 's'}</span>
          </div>
        </div>
        <div class="cover-ref">Ref: {ref} · Brochure generated {today}</div>
      </div>
    </div>
    """

    # ── Overview & description page ───────────────────────────────────────────
    kf_rows = ""
    kf_data = [
        ("Property type",   prop_type_label),
        ("Tenure",          prop.tenure),
        ("EPC rating",      (prop.epc_rating + (f" (potential {prop.epc_potential})" if prop.epc_potential else "")) if prop.epc_rating else None),
        ("Council tax band", f"Band {prop.council_tax_band}" if prop.council_tax_band else None),
        ("Bills included",  "Yes — see unit details for what's included" if prop.bills_included else "No — payable by tenant"),
        ("Reference",       ref),
    ]
    for label, val in kf_data:
        if val:
            kf_rows += f"<tr><td>{label}</td><td>{val}</td></tr>"

    feature_html = ""
    if features:
        items = "".join(f'<div class="feature-item"><span class="feature-tick">✓</span><span>{f}</span></div>' for f in features)
        feature_html = f"""
        <div class="section">
          <div class="section-title">Key features</div>
          <div class="features-grid">{items}</div>
        </div>"""

    # Second photo to break up the text
    second_photo = ""
    if len(photo_urls) > 1:
        second_photo = f'<img src="https://propairty.co.uk{photo_urls[1]}" style="width:100%;height:55mm;object-fit:cover;border-radius:6px;margin:5mm 0;display:block;" />'

    overview = f"""
    <div class="page">
      <div class="page-title">Property overview</div>
      <div class="two-col">
        <div class="col">
          {f'<div class="section"><div class="section-title">About this property</div><div class="description">{prop.description}</div></div>' if prop.description else ''}
          {second_photo}
          {feature_html}
        </div>
        <div class="col-narrow">
          <div class="section">
            <div class="section-title">Property details</div>
            <table class="facts-table">
              {kf_rows}
            </table>
          </div>
          <div class="info-box">
            <strong>Viewing arrangements:</strong> Contact {org.name} to arrange a viewing.
            {f'Call {org.phone} or email' if org.phone else 'Email'}
            {org.email or 'the agent'} to book your slot.
          </div>
          {'<div class="warn-box"><strong>Bills included:</strong> This property is listed as bills included. Please confirm with the agent exactly which utility bills are covered.</div>' if prop.bills_included else ''}
        </div>
      </div>
    </div>
    """

    # ── Photo gallery page ────────────────────────────────────────────────────
    gallery_html = ""
    if gallery_urls:
        photos_to_show = gallery_urls[:12]  # up to 12 additional photos
        cells = []
        i = 0
        while i < len(photos_to_show):
            remaining = len(photos_to_show) - i
            if remaining == 1:
                cells.append(f'<img src="{photos_to_show[i]}" class="g-full" />')
                i += 1
            elif remaining == 2:
                cells.append(f'<img src="{photos_to_show[i]}" class="g-half" />')
                cells.append(f'<img src="{photos_to_show[i+1]}" class="g-half" />')
                i += 2
            elif remaining >= 3:
                # Use a 2+1 or 3-equal pattern
                if i % 5 == 0 and remaining >= 3:
                    # Full width + two halves
                    cells.append(f'<img src="{photos_to_show[i]}" class="g-full" />')
                    if i + 1 < len(photos_to_show):
                        cells.append(f'<img src="{photos_to_show[i+1]}" class="g-half" />')
                    if i + 2 < len(photos_to_show):
                        cells.append(f'<img src="{photos_to_show[i+2]}" class="g-half" />')
                    i += 3
                else:
                    cells.append(f'<img src="{photos_to_show[i]}" class="g-third" />')
                    if i + 1 < len(photos_to_show):
                        cells.append(f'<img src="{photos_to_show[i+1]}" class="g-third" />')
                    if i + 2 < len(photos_to_show):
                        cells.append(f'<img src="{photos_to_show[i+2]}" class="g-third" />')
                    i += 3

        gallery_html = f"""
        <div class="page">
          <div class="page-title">A closer look — {len(photo_urls)} photos</div>
          <div class="gallery-grid">
            {''.join(cells)}
          </div>
          {f'<p style="font-size:8pt;color:#9ca3af;margin-top:4mm;text-align:right;">Floorplan available — ask agent for details.</p>' if floorplan_url else ''}
        </div>
        """

    # ── Units & pricing page ──────────────────────────────────────────────────
    unit_cards = ""
    for u in vacant:
        monthly = float(u.monthly_rent)
        weekly  = round(monthly * 12 / 52)
        dep_weeks = u.deposit_weeks or 5
        deposit = round(weekly * dep_weeks)

        try:
            amenities = json.loads(u.amenities or "[]")
        except Exception:
            amenities = []

        furnished_label = {
            "furnished": "Fully furnished",
            "part_furnished": "Part furnished",
            "part-furnished": "Part furnished",
            "unfurnished": "Unfurnished",
        }.get(u.furnished or "", u.furnished or "")

        avail = u.available_from.strftime("%d %b %Y") if u.available_from else "Now"

        # Top amenities to show as chips
        highlight_keys = ["furnished", "part_furnished", "wifi", "parking", "dishwasher", "garden", "balcony", "ensuite", "central_heating"]
        chips = [f'<span class="unit-fact">{AMENITY_ICONS.get(k,"·")} {AMENITY_LABELS.get(k,k)}</span>'
                 for k in highlight_keys if k in amenities][:6]

        unit_cards += f"""
        <div class="unit-card">
          <div class="unit-header">
            <div>
              <div class="unit-name">{u.name}</div>
              <div class="unit-spec-row">
                <span>{'Studio' if u.bedrooms==0 else f'{u.bedrooms} bedroom{"s" if u.bedrooms!=1 else ""}'}</span>
                <span>·</span>
                <span>{u.bathrooms} bathroom{'s' if u.bathrooms!=1 else ''}</span>
                {f'<span>·</span><span>{u.reception_rooms} reception room{"s" if u.reception_rooms!=1 else ""}</span>' if u.reception_rooms else ''}
                {f'<span>·</span><span>{furnished_label}</span>' if furnished_label else ''}
              </div>
            </div>
            <div style="text-align:right;">
              <div class="unit-price">£{int(monthly):,}</div>
              <div class="unit-price-sub">per month · £{weekly:,}/pw</div>
              {f'<div style="font-size:8pt;color:#9ca3af;text-decoration:line-through;">Was £{int(float(u.previous_rent)):,}/mo</div>' if u.previous_rent and float(u.previous_rent) > monthly else ''}
            </div>
          </div>
          <div class="unit-body">
            <div style="display:flex;gap:8mm;font-size:9pt;color:#6b7280;margin-bottom:3mm;">
              <span>📅 Available: <strong style="color:#111">{avail}</strong></span>
              <span>🔑 Min. tenancy: <strong style="color:#111">6 months</strong></span>
            </div>
            {'<div class="unit-facts">' + ''.join(chips) + '</div>' if chips else ''}
            <div class="deposit-box">
              💰 <strong>Security deposit: £{deposit:,}</strong> ({dep_weeks} weeks' rent) ·
              Held in a government-approved tenancy deposit scheme (TDS, DPS or MyDeposits).
              Returned in full at the end of the tenancy subject to the property being left in good condition.
            </div>
          </div>
        </div>"""

    pricing_info = f"""
    <div class="info-box">
      <strong>Referencing requirements:</strong> Most tenants are required to earn at least 30× the monthly
      rent as annual gross income (e.g. £{int(float(vacant[0].monthly_rent)) if vacant else 0:,}/mo requires
      £{int(float(vacant[0].monthly_rent)*30) if vacant else 0:,}/yr). Guarantors may be accepted where
      income thresholds are not met. Full credit, employment and prior landlord referencing will be carried out.
    </div>
    <div class="info-box" style="margin-top:2mm;">
      <strong>Holding deposit:</strong> A holding deposit of up to one week's rent may be required to
      reserve the property while referencing is completed. This is credited against the first month's rent.
    </div>
    """ if vacant else ""

    units_page = f"""
    <div class="page">
      <div class="page-title">Available units &amp; pricing</div>
      <p style="font-size:9pt;color:#6b7280;margin-bottom:5mm;">
        {len(vacant)} unit{'s' if len(vacant)!=1 else ''} currently available
        {'across this property' if len(prop.units) > 1 else ''}.
        All rents quoted per calendar month. Contact {org.name} for current availability.
      </p>
      {unit_cards if unit_cards else '<p style="color:#6b7280;font-size:9pt;">No units currently listed — contact agent for details.</p>'}
      {pricing_info}
    </div>
    """

    # ── Property specification (rooms) page ───────────────────────────────────
    rooms_page = ""
    for u in vacant[:1]:  # Show rooms for first vacant unit
        try:
            rooms = json.loads(u.rooms or "[]")
        except Exception:
            rooms = []
        if rooms:
            total_sqm = sum(r.get("size_sqm", 0) for r in rooms if r.get("size_sqm"))
            rows_html = ""
            for r in rooms:
                icon = ROOM_ICONS.get(r.get("type", ""), "🔲")
                label = r.get("label") or r.get("type", "").replace("_", " ").title()
                size = r.get("size_sqm")
                size_str = f"{size} m²  ({round(size * 10.764)} sq ft)" if size else "—"
                desc = ROOM_DESCS.get(r.get("type", ""), "")
                rows_html += f"""
                <tr>
                  <td><span class="room-icon">{icon}</span></td>
                  <td>
                    <strong>{label}</strong>
                    {f'<div class="room-desc">{desc}</div>' if desc else ''}
                  </td>
                  <td style="text-align:right;font-weight:600;white-space:nowrap;">{size_str}</td>
                </tr>"""

            total_row = f'<tr style="background:#f9fafb;"><td colspan="2" style="font-weight:700;padding:2.5mm 4mm;border-top:2px solid #e5e7eb;">Total floor area (approx.)</td><td style="font-weight:700;text-align:right;padding:2.5mm 4mm;border-top:2px solid #e5e7eb;">{total_sqm} m²  ({round(total_sqm * 10.764)} sq ft)</td></tr>' if total_sqm else ""

            rooms_page = f"""
            <div class="page">
              <div class="page-title">Property specification</div>
              <p style="font-size:9pt;color:#6b7280;margin-bottom:5mm;">
                Room-by-room breakdown for <em>{u.name}</em>. Sizes are approximate and measured
                to the widest points. All measurements should be independently verified before exchange.
              </p>
              <table class="rooms-table">
                <thead>
                  <tr>
                    <th style="width:8mm;"></th>
                    <th>Room</th>
                    <th style="text-align:right;">Approx. size</th>
                  </tr>
                </thead>
                <tbody>
                  {rows_html}
                  {total_row}
                </tbody>
              </table>
              <div class="warn-box" style="margin-top:5mm;">
                Floor areas are approximate. All measurements are taken to the widest point and may
                include fitted wardrobes or alcoves. Prospective tenants should carry out their own
                measurements before ordering furniture or fittings.
              </div>
            </div>
            """

    # ── Amenities page ────────────────────────────────────────────────────────
    all_amenities: set = set()
    for u in prop.units:
        try:
            all_amenities |= set(json.loads(u.amenities or "[]"))
        except Exception:
            pass

    amenities_html = ""
    if all_amenities:
        groups_html = ""
        for group_title, keys in AMENITY_GROUPS:
            present = [k for k in keys if k in all_amenities]
            if not present:
                continue
            chips = ""
            for k in present:
                icon  = AMENITY_ICONS.get(k, "·")
                label = AMENITY_LABELS.get(k, k.replace("_", " "))
                desc  = AMENITY_DESCS.get(k, "")
                chips += f"""
                <div class="amenity-chip">
                  <span class="amenity-chip-icon">{icon}</span>
                  <span>
                    <span class="amenity-chip-text">{label}</span>
                    {f'<span class="amenity-chip-desc">{desc}</span>' if desc else ''}
                  </span>
                </div>"""
            groups_html += f"""
            <div class="amenity-group">
              <div class="amenity-group-title">{group_title}</div>
              <div class="amenity-list">{chips}</div>
            </div>"""

        amenities_html = f"""
        <div class="page">
          <div class="page-title">Amenities &amp; inclusions</div>
          <p style="font-size:9pt;color:#6b7280;margin-bottom:5mm;">
            The following amenities and features are provided at this property. Items marked as
            "included" are part of the tenancy — no additional cost. Please confirm specific items
            with {org.name} prior to signing your tenancy agreement.
          </p>
          {groups_html}
        </div>
        """

    # ── EPC & legal page ──────────────────────────────────────────────────────
    epc_section = ""
    if prop.epc_rating:
        band_rows = ""
        for band, score_range, color in EPC_BANDS:
            is_current   = band == prop.epc_rating
            is_potential = band == prop.epc_potential
            classes = "epc-band-row"
            if not is_current and not is_potential:
                classes += " inactive"
            if is_current:
                classes += " current"
            label = band
            if is_current:
                label += " ← Current"
            if is_potential:
                label += " ← Potential"
            band_rows += f'<div class="{classes}" style="background:{color};">{label} &nbsp; <span style="font-weight:400;font-size:8pt;">{score_range}</span></div>'

        epc_section = f"""
        <div class="section">
          <div class="section-title">Energy Performance Certificate (EPC)</div>
          <div class="epc-container">
            <div class="epc-bar-col">
              {band_rows}
            </div>
            <div class="epc-info-col">
              <p>This property has a current EPC rating of <strong>Band {prop.epc_rating}</strong>.
              {f'With recommended energy efficiency improvements, the rating could reach <strong>Band {prop.epc_potential}</strong>.' if prop.epc_potential else ''}
              </p>
              <p>An Energy Performance Certificate rates a property's energy efficiency on a scale from
              <strong>A (most efficient)</strong> to <strong>G (least efficient)</strong>. A higher
              rating means lower energy bills and a smaller carbon footprint.</p>
              <p>Landlords are legally required to achieve a minimum EPC rating of <strong>Band E</strong>
              before letting a property (as of 2024). A valid EPC must be provided to tenants at
              the point of marketing.</p>
              <div class="info-box">
                A higher EPC rating typically means lower energy bills for the tenant.
                Band A–C properties can save hundreds of pounds per year compared to Band E–G.
              </div>
            </div>
          </div>
        </div>
        """

    ctb_section = ""
    if prop.council_tax_band:
        explanation = CTB_EXPLANATIONS.get(prop.council_tax_band, "")
        ctb_section = f"""
        <div class="section">
          <div class="section-title">Council tax</div>
          <p style="font-size:9.5pt;margin-bottom:2mm;">
            This property is in <strong>Council Tax Band {prop.council_tax_band}</strong>.
            {explanation}
          </p>
          <p style="font-size:9pt;color:#6b7280;">
            Council tax is paid by the occupying tenant (unless explicitly stated as included in the rent).
            The exact annual amount depends on the local authority and any applicable discounts (e.g. single-person
            25% discount, student exemption). Contact your local council to confirm the current rate.
          </p>
        </div>
        """

    tenure_section = ""
    if prop.tenure:
        tenure_descs = {
            "Freehold": "The landlord owns the property and the land it stands on outright, with no time limit. Freehold properties typically carry no ground rent or service charge obligations.",
            "Leasehold": "The property is held on a long lease from the freeholder. There may be ground rent and service charge obligations. The remaining lease term should be verified prior to exchange.",
            "Share of Freehold": "The landlord holds a share of the freehold alongside other flat owners in the building. This gives greater control over building management and is generally considered advantageous.",
        }
        tenure_section = f"""
        <div class="section">
          <div class="section-title">Tenure</div>
          <p style="font-size:9.5pt;"><strong>{prop.tenure}</strong> — {tenure_descs.get(prop.tenure, '')}</p>
        </div>
        """

    # ── Utilities & rights page ───────────────────────────────────────────────
    utilities_page = f"""
    <div class="page">
      <div class="page-title">Utilities, rights &amp; restrictions</div>
      <div class="two-col">
        <div class="col">
          <div class="section">
            <div class="section-title">Utility supply</div>
            <table class="facts-table">
              <tr><td>⚡ Electric</td><td>Ask agent to confirm supplier</td></tr>
              <tr><td>💧 Water</td><td>Ask agent to confirm supplier</td></tr>
              <tr><td>🌡️ Heating</td><td>{'Included in the monthly rent' if prop.bills_included else 'Ask agent to confirm — gas or electric'}</td></tr>
              <tr><td>🌐 Broadband</td><td>Check Ofcom broadband checker at checker.ofcom.org.uk for speed estimates at this postcode ({prop.postcode})</td></tr>
              <tr><td>🚰 Sewerage</td><td>Ask agent to confirm supplier</td></tr>
            </table>
          </div>
          <div class="section">
            <div class="section-title">Rights &amp; restrictions</div>
            <table class="facts-table">
              <tr><td>Private rights of way</td><td>Ask agent</td></tr>
              <tr><td>Public rights of way</td><td>Ask agent</td></tr>
              <tr><td>Listed building</td><td>Ask agent</td></tr>
              <tr><td>Restrictions / covenants</td><td>Ask agent</td></tr>
              <tr><td>Pets permitted</td><td>Ask agent — written consent required</td></tr>
              <tr><td>Smoking</td><td>Not permitted inside the property</td></tr>
            </table>
          </div>
        </div>
        <div class="col">
          <div class="section">
            <div class="section-title">Flood risk</div>
            <table class="facts-table">
              <tr><td>Flooded in last 5 years</td><td>Ask agent</td></tr>
              <tr><td>Flood defences</td><td>Ask agent</td></tr>
              <tr><td>Source of flood risk</td><td>Ask agent</td></tr>
            </table>
            <div class="info-box">
              Check long-term flood risk for this property at the government's official service:
              check-long-term-flood-risk.service.gov.uk (postcode: {prop.postcode})
            </div>
          </div>
          <div class="section">
            <div class="section-title">Deposit summary</div>
            {''.join(f"""
            <div style="border:1px solid #e5e7eb;border-radius:6px;padding:3mm 4mm;margin-bottom:2mm;">
              <div style="font-weight:700;font-size:10pt;">{u.name}</div>
              <table class="facts-table" style="margin-top:2mm;">
                <tr><td>Holding deposit</td><td style="font-weight:700;">£{round(float(u.monthly_rent)*12/52):,} (1 week)</td></tr>
                <tr><td>Security deposit</td><td style="font-weight:700;">£{round(float(u.monthly_rent)*12/52*(u.deposit_weeks or 5)):,} ({u.deposit_weeks or 5} weeks)</td></tr>
                <tr><td>Deposit protection</td><td>Government-approved TDS/DPS scheme</td></tr>
              </table>
            </div>""" for u in vacant)}
            <div class="warn-box">
              Under the Tenant Fees Act 2019, security deposits for properties with annual rent
              below £50,000 are capped at 5 weeks' rent (6 weeks above £50,000). Deposits are
              registered with a government-approved scheme within 30 days.
            </div>
          </div>
        </div>
      </div>
    </div>
    """

    legal_page = ""
    if prop.epc_rating or prop.council_tax_band or prop.tenure:
        legal_page = f"""
        <div class="page">
          <div class="page-title">Energy &amp; legal information</div>
          {epc_section}
          {ctb_section}
          {tenure_section}
          <div class="section">
            <div class="section-title">Regulatory compliance</div>
            <p style="font-size:9pt;color:#374151;margin-bottom:2mm;">
              All properties managed by {org.name} are let in full compliance with current UK
              residential lettings legislation, including:
            </p>
            <div class="features-grid">
              {"".join(f'<div class="feature-item"><span class="feature-tick">✓</span><span>{item}</span></div>' for item in [
                "Gas Safety Certificate (annual)",
                "Electrical Installation Condition Report (EICR)",
                "Energy Performance Certificate (EPC)",
                "Smoke & carbon monoxide alarm compliance",
                "Right to Rent verification (all adult occupants)",
                "Tenancy Deposit Protection (TDS / DPS / MyDeposits)",
                "How to Rent guide provided to tenants",
                "Deposit Prescribed Information served within 30 days",
              ])}
            </div>
          </div>
        </div>
        """

    # ── How to apply / contact page ───────────────────────────────────────────
    contact_page = f"""
    <div class="page-last">
      <div class="page-title">How to apply</div>
      <div class="two-col">
        <div class="col">
          <div class="steps">
            <div class="step">
              <div class="step-num">1</div>
              <div class="step-body">
                <div class="step-title">Register your interest</div>
                <div class="step-desc">Contact {org.name} by phone or email to express your interest and check current availability.</div>
              </div>
            </div>
            <div class="step">
              <div class="step-num">2</div>
              <div class="step-body">
                <div class="step-title">Arrange a viewing</div>
                <div class="step-desc">We'll schedule a convenient time for you to view the property in person. Virtual viewings may also be available on request.</div>
              </div>
            </div>
            <div class="step">
              <div class="step-num">3</div>
              <div class="step-body">
                <div class="step-title">Submit your application</div>
                <div class="step-desc">Complete our online application form and provide proof of identity, income and a previous landlord reference.</div>
              </div>
            </div>
            <div class="step">
              <div class="step-num">4</div>
              <div class="step-body">
                <div class="step-title">Referencing &amp; offer</div>
                <div class="step-desc">We carry out credit, income and landlord reference checks. A holding deposit of up to one week's rent secures the property during this process.</div>
              </div>
            </div>
            <div class="step">
              <div class="step-num">5</div>
              <div class="step-body">
                <div class="step-title">Sign &amp; move in</div>
                <div class="step-desc">Sign your Assured Shorthold Tenancy (AST) agreement. Pay your first month's rent and security deposit. Collect your keys on move-in day.</div>
              </div>
            </div>
          </div>
          <div class="info-box" style="margin-top:5mm;">
            <strong>Documents you'll need:</strong> Passport or driving licence · 3 months' payslips or
            SA302 (self-employed) · Bank statements · Employer's reference · Previous landlord's reference.
          </div>
        </div>
        <div class="col-narrow">
          <div class="contact-box">
            <h2>{org.name}</h2>
            <p>Get in touch to arrange your viewing or ask any questions about this property.</p>
            {f'<div class="contact-detail">📞 {org.phone}</div>' if org.phone else ''}
            {f'<div class="contact-detail" style="margin-top:2mm;">✉️ {org.email}</div>' if org.email else ''}
            {f'<div style="margin-top:3mm;font-size:8pt;opacity:.8;">📍 {org.address_text}</div>' if org.address_text else ''}
          </div>
          <div class="section" style="margin-top:4mm;">
            <div class="section-title">Important notes</div>
            <p style="font-size:8.5pt;color:#6b7280;line-height:1.65;">
              All particulars are prepared in good faith and are not intended to constitute part of any
              contract. All measurements and room sizes are approximate. Prospective tenants should
              satisfy themselves by inspection or otherwise as to the correctness of each statement.
              {org.name} has not tested any services, appliances or fixtures. Floor plans are for
              guidance only and are not to scale.
            </p>
          </div>
        </div>
      </div>
    </div>
    """

    # ── What's nearby page ───────────────────────────────────────────────────
    nearby_page = f"""
    <div class="page">
      <div class="page-title">Location &amp; neighbourhood</div>
      <div class="two-col">
        <div class="col">
          <div class="section">
            <div class="section-title">About the location</div>
            <p style="font-size:9.5pt;color:#374151;margin-bottom:3mm;">
              {prop.name} is located at {full_address}.
              {'<br/>' + prop.description if prop.description else ''}
            </p>
          </div>
          <div class="section">
            <div class="section-title">Useful local links</div>
            <table class="facts-table">
              <tr><td>🗺️ Street map</td><td>Search postcode <strong>{prop.postcode}</strong> on Google Maps or Apple Maps</td></tr>
              <tr><td>🚆 Transport</td><td>Check National Rail, TfL or local bus routes for postcode {prop.postcode}</td></tr>
              <tr><td>🏫 Schools</td><td>gov.uk/school-performance — search by postcode {prop.postcode}</td></tr>
              <tr><td>🌊 Flood risk</td><td>check-long-term-flood-risk.service.gov.uk — postcode {prop.postcode}</td></tr>
              <tr><td>🌐 Broadband</td><td>checker.ofcom.org.uk — broadband speeds at {prop.postcode}</td></tr>
              <tr><td>📋 Council tax</td><td>{'Band ' + prop.council_tax_band + ' — contact local council for current rates' if prop.council_tax_band else 'Contact local council'}</td></tr>
            </table>
          </div>
        </div>
        <div class="col">
          <div class="section">
            <div class="section-title">Agency details</div>
            <div class="contact-box" style="text-align:left;padding:6mm;">
              <div style="font-size:14pt;font-weight:900;margin-bottom:2mm;">{org.name}</div>
              {f'<div style="font-size:9.5pt;margin-bottom:1mm;">📞 {org.phone}</div>' if org.phone else ''}
              {f'<div style="font-size:9.5pt;margin-bottom:1mm;">✉️ {org.email}</div>' if org.email else ''}
              {f'<div style="font-size:9.5pt;margin-bottom:1mm;">📍 {org.address_text}</div>' if org.address_text else ''}
              {f'<div style="font-size:9.5pt;">🌐 {org.website_url}</div>' if org.website_url else ''}
            </div>
            {''.join(f"""
            <div class="amenity-group" style="margin-top:5mm;">
              <div class="amenity-group-title">Opening hours</div>
              <table class="facts-table">
                {''.join(f'<tr><td>{h.get("day","")}</td><td style="font-weight:600;">{h.get("hours","")}</td></tr>' for h in (json.loads(org.opening_hours_json or "[]") if org.opening_hours_json else []))}
              </table>
            </div>
            """) if org.opening_hours_json else ''}
          </div>
          <div class="section">
            <div class="section-title">Accreditations</div>
            <div class="amenity-list">
              <div class="amenity-chip" style="background:#00a65015;border-color:#00a650;color:#00a650;font-weight:700;">🏅 ARLA Propertymark</div>
              <div class="amenity-chip" style="background:#1a5fa815;border-color:#1a5fa8;color:#1a5fa8;font-weight:700;">🛡️ DPS Deposit Protected</div>
              <div class="amenity-chip" style="background:#6b21a815;border-color:#6b21a8;color:#6b21a8;font-weight:700;">💼 Client Money Protected</div>
              <div class="amenity-chip" style="background:#37415115;border-color:#374151;color:#374151;font-weight:700;">📋 ICO Registered</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    """

    # ── Tenants' guide page ───────────────────────────────────────────────────
    tenants_guide = f"""
    <div class="page" style="background:#fff;">
      <div style="text-align:center;margin-bottom:8mm;">
        <div style="display:inline-block;background:{brand};color:#fff;padding:3mm 10mm;border-radius:99px;font-size:9pt;font-weight:800;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4mm;">Your essential guide</div>
        <div style="font-size:22pt;font-weight:900;margin-bottom:1mm;">Tenants' Guide</div>
        <div style="font-size:10pt;color:#6b7280;">Everything you need to know about renting with {org.name}</div>
      </div>

      <div class="two-col" style="gap:7mm;">
        <div class="col">

          <!-- Before you move in -->
          <div class="amenity-group">
            <div style="font-size:11pt;font-weight:800;color:{brand};margin-bottom:3mm;padding-bottom:1.5mm;border-bottom:2px solid {brand}22;">Before you move in</div>
            <div class="steps">
              <div class="step">
                <div class="step-num" style="background:{brand};font-size:8pt;">✓</div>
                <div class="step-body">
                  <div class="step-title">Tenancy agreement</div>
                  <div class="step-desc">Read your Assured Shorthold Tenancy (AST) agreement carefully before signing. It sets out all your rights and responsibilities as a tenant. Ask us to clarify anything you don't understand.</div>
                </div>
              </div>
              <div class="step">
                <div class="step-num" style="background:{brand};font-size:8pt;">✓</div>
                <div class="step-body">
                  <div class="step-title">How to Rent guide</div>
                  <div class="step-desc">You will receive the government's latest 'How to Rent' checklist — keep this safe. It is a legal requirement for your landlord to provide this.</div>
                </div>
              </div>
              <div class="step">
                <div class="step-num" style="background:{brand};font-size:8pt;">✓</div>
                <div class="step-body">
                  <div class="step-title">Inventory &amp; check-in</div>
                  <div class="step-desc">A detailed inventory will be prepared at the start of your tenancy documenting the condition of the property and its contents. Check it thoroughly and report any discrepancies within 7 days.</div>
                </div>
              </div>
              <div class="step">
                <div class="step-num" style="background:{brand};font-size:8pt;">✓</div>
                <div class="step-body">
                  <div class="step-title">Deposit protection</div>
                  <div class="step-desc">Your deposit will be registered with a government-approved Tenancy Deposit Scheme (TDS, DPS or MyDeposits) within 30 days of receipt. You will receive Prescribed Information confirming this.</div>
                </div>
              </div>
            </div>
          </div>

          <!-- During your tenancy -->
          <div class="amenity-group" style="margin-top:5mm;">
            <div style="font-size:11pt;font-weight:800;color:{brand};margin-bottom:3mm;padding-bottom:1.5mm;border-bottom:2px solid {brand}22;">During your tenancy</div>
            <table class="facts-table">
              <tr>
                <td>📅 Rent payment</td>
                <td>Payable monthly in advance on the date specified in your tenancy agreement, by standing order or bank transfer. Set up your standing order before your move-in date.</td>
              </tr>
              <tr>
                <td>🔧 Reporting repairs</td>
                <td>Report all maintenance issues promptly via our online portal, email or phone. Emergency repairs (no heat, flooding, security) are dealt with as a priority — call us immediately.</td>
              </tr>
              <tr>
                <td>🏡 Property care</td>
                <td>You are responsible for keeping the property clean and in good order. Report any damp, leaks or damage immediately — delays can make problems worse and may affect your deposit.</td>
              </tr>
              <tr>
                <td>🔑 Access</td>
                <td>We will give at least 24 hours' written notice before any inspection or contractor visit (except genuine emergencies). Inspections typically take place every 3–6 months.</td>
              </tr>
              <tr>
                <td>💡 Utilities</td>
                <td>Register with utility providers on your move-in date. Take meter readings and keep receipts. Inform your local council to set up council tax in your name (unless included in rent).</td>
              </tr>
              <tr>
                <td>📋 Alterations</td>
                <td>Do not make any alterations, redecorate or install fixtures without our prior written consent. Unauthorised changes may result in deposit deductions at the end of the tenancy.</td>
              </tr>
              <tr>
                <td>🐾 Pets</td>
                <td>Pets are not permitted unless specifically agreed in writing in your tenancy agreement. Unapproved pets are a breach of tenancy.</td>
              </tr>
              <tr>
                <td>🔒 Security</td>
                <td>Ensure all windows and doors are locked when leaving the property. Notify us immediately if keys are lost — replacement costs are your responsibility.</td>
              </tr>
            </table>
          </div>

        </div>
        <div class="col">

          <!-- Moving out -->
          <div class="amenity-group">
            <div style="font-size:11pt;font-weight:800;color:{brand};margin-bottom:3mm;padding-bottom:1.5mm;border-bottom:2px solid {brand}22;">Moving out</div>
            <table class="facts-table">
              <tr>
                <td>📝 Notice</td>
                <td>Give written notice as required by your tenancy agreement (usually 1 month for a periodic tenancy, or as agreed). Notice must end on the correct rent date.</td>
              </tr>
              <tr>
                <td>🧹 Cleanliness</td>
                <td>Return the property in the same clean condition as at the start. Professional cleaning is strongly recommended — carpets, oven, windows and bathrooms in particular.</td>
              </tr>
              <tr>
                <td>🛠️ Repairs</td>
                <td>Repair or pay for any damage beyond fair wear and tear. Fair wear and tear is the natural deterioration of a property through normal use — it is not chargeable.</td>
              </tr>
              <tr>
                <td>📦 Belongings</td>
                <td>Remove all your possessions and any rubbish. Items left behind may be disposed of and the cost charged to your deposit.</td>
              </tr>
              <tr>
                <td>📸 Check-out</td>
                <td>A check-out inspection will be carried out against the original inventory. Take your own dated photographs before handing back the keys.</td>
              </tr>
              <tr>
                <td>🔑 Keys</td>
                <td>Return all keys — including any post box, garage or window keys — on the last day of the tenancy. Unreturned keys will be charged against your deposit.</td>
              </tr>
            </table>
          </div>

          <!-- Deposit deductions -->
          <div class="amenity-group" style="margin-top:5mm;">
            <div style="font-size:11pt;font-weight:800;color:{brand};margin-bottom:3mm;padding-bottom:1.5mm;border-bottom:2px solid {brand}22;">Understanding your deposit</div>
            <p style="font-size:8.5pt;color:#374151;margin-bottom:3mm;line-height:1.65;">
              Your deposit is protected throughout your tenancy. Deductions can only be made for:
            </p>
            <div class="features-grid">
              {"".join(f'<div class="feature-item"><span class="feature-tick" style="background:#ef4444;">✗</span><span>{item}</span></div>' for item in [
                "Damage beyond fair wear and tear",
                "Unpaid rent or bills",
                "Missing items from the inventory",
                "Unauthorised alterations or redecoration",
                "Professional cleaning (if required)",
                "Removal of tenant's belongings left behind",
                "Key replacement costs",
                "Garden maintenance if not carried out",
              ])}
            </div>
            <div class="info-box" style="margin-top:3mm;">
              <strong>Dispute resolution:</strong> If you disagree with proposed deductions, you have the right
              to raise a dispute with the relevant Tenancy Deposit Scheme. Both parties will be asked to
              provide evidence and a neutral adjudicator will make a binding decision — free of charge.
            </div>
          </div>

          <!-- Emergency contacts -->
          <div class="amenity-group" style="margin-top:5mm;">
            <div style="font-size:11pt;font-weight:800;color:{brand};margin-bottom:3mm;padding-bottom:1.5mm;border-bottom:2px solid {brand}22;">Emergency contacts</div>
            <table class="facts-table">
              <tr><td>🚨 Emergency services</td><td><strong>999</strong></td></tr>
              <tr><td>🏥 Non-emergency police</td><td><strong>101</strong></td></tr>
              <tr><td>⚡ Power cut (England)</td><td><strong>105</strong></td></tr>
              <tr><td>💧 Water emergency</td><td>Contact your water supplier</td></tr>
              <tr><td>🔥 Gas emergency</td><td><strong>0800 111 999</strong> (National Gas)</td></tr>
              <tr><td>🏠 {org.name}</td><td>{org.phone or 'See contact details'}</td></tr>
            </table>
          </div>

        </div>
      </div>

      <!-- Bottom CTA -->
      <div style="margin-top:6mm;background:{brand}0d;border:1px solid {brand}33;border-radius:8px;padding:5mm 6mm;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:11pt;font-weight:800;margin-bottom:1mm;">Questions? We're here to help.</div>
          <div style="font-size:9pt;color:#6b7280;">Contact {org.name} — your dedicated letting agent throughout your tenancy.</div>
        </div>
        <div style="text-align:right;">
          {f'<div style="font-size:12pt;font-weight:800;color:{brand};">📞 {org.phone}</div>' if org.phone else ''}
          {f'<div style="font-size:10pt;color:#6b7280;margin-top:1mm;">✉️ {org.email}</div>' if org.email else ''}
        </div>
      </div>
    </div>
    """

    footer = f"""
    <div class="footer">
      <span class="footer-brand">{org.name}</span>
      <span>Ref: {ref} · {full_address}</span>
      <span>Generated {today} · propairty.co.uk</span>
    </div>
    """

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>{prop.name} — Property Brochure</title>
  <style>{css}</style>
</head>
<body>
  {cover}
  {overview}
  {gallery_html}
  {units_page}
  {rooms_page}
  {amenities_html}
  {legal_page}
  {utilities_page}
  {nearby_page}
  {contact_page}
  {tenants_guide}
  {footer}
</body>
</html>"""
