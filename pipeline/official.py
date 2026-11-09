"""Official records for Kentucky -> one table of licensed food businesses (playbook/12-sources.md).

Kentucky's local and district health departments inspect under 902 KAR 45:005 (the 2013 FDA Food Code): the score is 100 minus the
violation points. The one open feed is Louisville Metro's (Jefferson County, PDDL): its permitted establishments (about 8,500, most with
a point), five years of inspections with the official score and, on most regular inspections, Louisville Metro Public Health and
Wellness's own A/B/C grade, shown as published, dated, never recomputed; and Louisville Metro's ABC (alcoholic beverage) licenses. The
other 119 counties' scores sit on Custom Data Processing's statewide portal (public.cdpehs.com): with Nick's yes (2026-11-07),
fetch_cdp.py exports each county's table (the last inspection and any follow-up, with the score as published: no grade outside
Louisville). Kentucky ABC's BELLE lookup (fetch_abc_belle.py, Nick's yes 2026-11-07) gives the on-premise drink licenses statewide.

load() returns: jur, lic (our id), name, keys (name keys), addr, city, zip, num, street, lat, lon, kind, active, ltype, insp, biz.
"""
import os, re, json, datetime
import numpy as np, pandas as pd
from common import norm_name, RAW, KY, name_sim, _stems, GENERIC, canon_city

_JEFF = None
def _in_jefferson(la, lo):
    """Louisville's point falls inside Jefferson County's own outline (the Overture county shape, slightly widened for the river)."""
    global _JEFF
    if _JEFF is None:
        from shapely.geometry import shape
        from shapely.prepared import prep
        _JEFF = prep(shape(json.load(open(f"{KY}/ky_counties_detail.geojson"))["Jefferson County"]).buffer(0.002))
    from shapely.geometry import Point
    return _JEFF.contains(Point(lo, la))

OFF = os.path.join(RAW, "official")
DIRS = {"N": "N", "S": "S", "E": "E", "W": "W", "NORTH": "N", "SOUTH": "S", "EAST": "E", "WEST": "W"}
TYPES = set("ST STREET AVE AV AVENUE BLVD BOULEVARD RD ROAD DR DRIVE LN LANE CT COURT PL PLACE PKWY PARKWAY TER TRL TRAIL WAY HWY CIR "
            "CIRCLE PLZ SQ MALL BND PASS XING RUN ROW WALK RDG LOOP FWY FREEWAY EXPY EXPRESSWAY PIKE PK PKE".split())


def road(a):
    """One spelling for numbered roads. Kentucky writes one road as 'Route 100', 'US 7', 'Rt 2', 'KY 100' or 'KY Route 100', so every
    numbered US or state route is 'SH n' (as in ri-eats); 'N INTERSTATE 95' = 'I-95'; 'COUNTY ROAD 5' = 'CR 5'."""
    a = re.sub(r"(\d)\s*&\s*(\d)", r"\1-\2", a.upper())
    a = re.sub(r"\b(US|KY|SR|SH|CR|I|IH|RT|RTE)-(\w)", r"\1 \2", a)
    a = re.sub(r"\b(?:INTERSTATE(?: HIGHWAY| HWY)?|IH|I H)\s*(?=\d)", "I ", a)
    a = re.sub(r"\b(?:US|U S)\s+(?:HIGHWAY|HWY)\b", "US", a)
    a = re.sub(r"\b(?:FARM[- ]TO[- ]MARKET(?: ROAD| RD)?|FARM (?:ROAD|RD)|F M)\b", "FM", a)
    a = re.sub(r"\b(?:RANCH[- ]TO[- ]MARKET(?: ROAD| RD)?|RANCH (?:ROAD|RD)|RR|RM)\b(?=\s*\d)", "RM", a)
    a = re.sub(r"\b(?:STATE (?:HIGHWAY|HWY|ROAD|RD|ROUTE|RTE)|SR|SH|VERMONT (?:ROUTE|RTE|HIGHWAY|HWY)|KY (?:ROUTE|RTE|RT|HIGHWAY|HWY)|KY|"
               r"US (?:ROUTE|RTE|RT)|US|ROUTE|RTE|RT|HWY)\b\.?(?=\s*\d)", "SH", a)
    a = re.sub(r"\b(?:COUNTY (?:HIGHWAY|HWY|ROAD|RD)|CO RD|CTY (?:HWY|RD)|CR)\b", "CR", a)
    a = re.sub(r"\bHIGHWAY\b", "HWY", a)
    return re.sub(r"\b(US|SH|CR|HWY|FM|RM|I) (\w+)\s*-\s*\w+", r"\1 \2", a)


ORD = {"FIRST": "1ST", "SECOND": "2ND", "THIRD": "3RD", "FOURTH": "4TH", "FIFTH": "5TH", "SIXTH": "6TH", "SEVENTH": "7TH",
       "EIGHTH": "8TH", "NINTH": "9TH", "TENTH": "10TH", "ELEVENTH": "11TH", "TWELFTH": "12TH"}


def street_key(a):
    """'2505 Monroe St' -> ('2505', 'MONROE'); '1000 OSAGE STREET' -> ('1000', 'OSAGE'); 'E Colfax Ave' keeps 'COLFAX'."""
    if not isinstance(a, str):
        return None, None
    a = re.sub(r"[.,#]", " ", road(a))
    # "20940-A North Frederick Ave": a hyphenated unit letter is part of the number (Maryland's Montgomery County wrote them so)
    m = re.match(r"^\s*(\d+)(?:-?[A-Z])?(?:\s*-\s*\d+[A-Z]?)?\s+(.*)$", a)
    if not m:
        return None, None
    words = [w for w in m.group(2).split() if w]
    if len(words) > 1 and words[0] in DIRS:
        words = words[1:]
    core = []
    for w in words:
        if w in TYPES and core:
            break
        core.append(w)
    core = [ORD.get(w, w) for w in core]
    return m.group(1), " ".join(core[:3]) or None


def street_compat(a, b):
    """Same street, or one is a whole-word prefix of the other: Boulder's 2025 set sometimes truncates ("1206 CENTAUR" = Centaur Village Dr)."""
    if not isinstance(a, str) or not isinstance(b, str) or not a or not b:
        return False
    return a == b or a.startswith(b + " ") or b.startswith(a + " ")


def street_nums(a):
    """'157-159 W Main St' -> {'157', '159'}; '2505 Monroe St' -> {'2505'}."""
    if not isinstance(a, str):
        return set()
    a = road(a)
    m = re.match(r"^\s*(\d+)[A-Z]?(?:\s*-\s*(\d+)[A-Z]?)?\s", a.upper() + " ")
    if not m:
        return set()
    lo = int(m.group(1)); hi = int(m.group(2)) if m.group(2) else lo
    if hi < lo:   # "1500-02"
        hi = int(str(lo)[: len(str(lo)) - len(m.group(2))] + m.group(2)) if m.group(2) else lo
    return {str(x) for x in range(lo, hi + 1, 2 if (hi - lo) % 2 == 0 else 1)} if 0 <= hi - lo <= 12 else {str(lo)}


def _names(*vals):
    out = []
    for v in vals:
        if not isinstance(v, str):
            continue
        v = re.sub(r"\s*\((?:MOBILE|MOBILE UNIT|COMMISSARY|CATERING|SPECIAL EVENT|SPEC EVENT|TEMP(?:ORARY)? EVENT|CP|INSIDE [^)]*)\)\s*$", "", v, flags=re.I)
        for part in re.split(r"\s*/\s*|\s+\bdba\b\s+|\s+&\s+(?=[A-Z][a-z])", v, flags=re.I):
            k = norm_name(re.sub(r"\b(?:LLC|INC|CORP|CORPORATION|LTD|CO)\b\.?", "", part, flags=re.I))
            if k and k not in out:
                out.append(k)
    return out


META = json.load(open(os.path.join(OFF, "meta.json"))) if os.path.exists(os.path.join(OFF, "meta.json")) else {}
# the publisher's own last edit of the inspections layer (ArcGIS editingInfo), else the day we read it
LIST_DATE = (META.get("louisville") or {}).get("edited") or (META.get("louisville") or {}).get("fetched")
FETCHED = (META.get("louisville") or {}).get("fetched")
# Louisville Metro's own page for its food inspection scores (search and map)
MONT_PAGE = "https://louisvilleky.gov/government/health-wellness/food-safety"
# Kentucky's statewide public inspection portal (Custom Data Processing); one table per county, numbered alphabetically (Adair 1,
# Fayette 34): linked, never read
INSPECTIONS_URL = "https://public.cdpehs.com/KYEnvPBL/VW_PUBLIC_EST_INSP/ShowVW_PUBLIC_EST_INSPTable.aspx"
# the inspection types whose score is a food inspection's score (not an office visit, a survey or an enforcement step)
INS_TYPES = {"REGULAR": "Regular", "FOLLOWUP": "Follow-up", "COMPLAINT": "Complaint"}
RESULTS = ()       # filled by load_louisville(): "Score 97, grade A" / "Score 95", as published
ONPREM_T = ("Louisville Metro on-premises alcohol license", "Kentucky ABC on-premises drink license")
RETAIL_T = "Louisville Metro package alcohol license"
ABC_ON = {"Restaurant / Cafe", "Bar", "Private Club", "Hotels", "River Boat", "Bowling Alley", "Amusement", "Theatre / Museum",
          "Convention Center Complex", "Airport", "Golf Course", "Country Club", "Sports / Fitness", "Horse Race Track", "Catering"}
ABC_RETAIL = {"Liquor Store", "Grocery / Food Mart", "Drug Store", "Retail"}


def liq_kind(t):
    """A license type as shown -> on-premises or retail."""
    if not isinstance(t, str):
        return None
    return "onprem" if t in ONPREM_T else "retail" if "package" in t else None


COLUMNS = ["jur", "lic", "name", "dba", "holder", "keys", "addr", "city", "zip", "num", "street", "lat", "lon", "kind", "active", "ltype",
           "insp", "issued", "biz", "drinks", "county"]


def _zip(z):
    z = re.sub(r"\D", "", str(z or ""))
    return z[:5] if len(z) >= 5 else ""


def _addr(a):
    """'2790 VETERANS MEMORIAL BLVD STE 130' -> '2790 Veterans Memorial Blvd Ste 130'."""
    a = re.sub(r"\s+", " ", a or "").strip()
    return re.sub(r"\b([A-Z]{2,})\b", lambda m: m.group(1).title(), a)


def _city(c):
    return canon_city(" ".join(w.capitalize() for w in str(c or "").split())) if isinstance(c, str) and c.strip() else None


def _ms(v):
    """An ArcGIS date (epoch milliseconds, UTC) -> YYYY-MM-DD in Louisville's time (the inspector's own day)."""
    if not isinstance(v, (int, float)):
        return None
    d = datetime.datetime.fromtimestamp(v / 1000, datetime.timezone.utc) - datetime.timedelta(hours=5)
    return d.date().isoformat()


# Louisville's establishment types that are a place to go out to eat; the rest (pools, schools, day cares, hospitals, temporary event
# stands, caterers, commissaries, groceries, warehouses, tattoo studios) stay out. Mobile units are trucks: never a restaurant's record.
LOU_FOOD = {"FOOD SERVICE", "RETAIL BAKERY", "BAKERY", "RETAIL WITH LIMITED SERVICE"}
LOU_TRUCK = {"SELF-CONTAINED MOBILE FOOD UNITS", "MOBILE RETAIL UNIT", "MOBILE RESTRICTED CONCESSION"}


def _result(score, grade):
    return f"Score {int(score)}" + (f", grade {grade}" if grade in ("A", "B", "C") else "")


def load_louisville():
    global RESULTS
    E = json.load(open(os.path.join(OFF, "louisville", "establishments.json")))
    by, res = {}, set()
    for r in json.load(open(os.path.join(OFF, "louisville", "inspections.json"))):
        t = INS_TYPES.get(r.get("InspectionType"))
        if not t or r.get("EstablishmentID") is None or not isinstance(r.get("score"), (int, float)) or not r.get("InspectionDate"):
            continue
        if FETCHED and _ms(r["InspectionDate"]) > FETCHED:
            continue
        rs = _result(r["score"], r.get("GradeID"))
        res.add(rs)
        by.setdefault(r["EstablishmentID"], []).append([_ms(r["InspectionDate"]), rs, t, r.get("InspectionID")])
    # best first: a higher score, then a grade A before B before C, then the bare score
    RESULTS = tuple(sorted(res, key=lambda s_: (-int(re.search(r"\d+", s_).group()), s_)))
    rows = []
    for p in E:
        name = re.sub(r"\s+", " ", p.get("PremiseName") or "").strip()
        et = (p.get("EstType") or "").strip()
        kind = "food" if et in LOU_FOOD else "truck" if et in LOU_TRUCK else "other"
        addr = _addr(" ".join(x for x in (p.get("PermiseStreetNo"), p.get("PremiseStreet")) if x))
        # Louisville's own point, only where it falls in Jefferson County: a few rows put Louisville addresses (1704 Bardstown Rd,
        # 550 S 1st St) in Shelby or Spencer County; those are placed from their street address instead (geocode_official.py)
        la, lo = p.get("latitude"), p.get("longitude")
        if not (isinstance(la, (int, float)) and isinstance(lo, (int, float)) and _in_jefferson(la, lo)):
            la = lo = None
        num, st = street_key(addr)
        rows.append({"jur": "louisville", "lic": f"louisville-{p['EstablishmentID']}", "name": name, "dba": name, "holder": None,
                     "keys": _names(name), "addr": addr, "city": _city(p.get("PremiseCity")), "zip": _zip(p.get("PremiseZip")),
                     "num": num, "street": st, "lat": la, "lon": lo, "kind": kind,
                     "active": (p.get("Status") or "").upper() == "ACTIVE",
                     "ltype": "Louisville Metro food permit (" + et.title() + ")",
                     "insp": sorted(by.get(p["EstablishmentID"], []), key=lambda v: v[0] or "", reverse=True),
                     "issued": _ms(p.get("opening_date")), "drinks": None, "county": None})
    return rows


def _drinks(r):
    on = lambda k: (r.get(k) or "") == "Active"
    keys = [k for k in r if on(k)]
    out = set()
    if any(k.startswith(("NQ1_", "NQ2_", "NQ3_")) for k in keys):
        out |= {"beer", "wine", "liquor"}
    if any(k.startswith("Quota_Retail_Drink") for k in keys):
        out |= {"wine", "liquor"}
    if any(k.startswith("NQ4_") or k.startswith("NQ_Retail_Malt_Bev_Combo") for k in keys):
        out.add("beer")
    return [d for d in ("beer", "wine", "liquor") if d in out] or None


def load_louabc():
    rows = []
    today = datetime.date.today().isoformat()
    for r in json.load(open(os.path.join(OFF, "louisville", "abc.json"))):
        cat = r.get("LicenseCat") or ""
        if cat not in ABC_ON | ABC_RETAIL:
            continue
        name = re.sub(r"\s+", " ", r.get("BusinessName") or "").strip()
        m = re.match(r"^(.*?),\s*([^,]+),\s*KY\s*(\d{5})?", (r.get("Address") or "").strip())
        addr, city, zp = (_addr(m.group(1)), _city(m.group(2)), m.group(3) or "") if m else (_addr(r.get("Address")), None, "")
        num, st = street_key(addr)
        exp = _ms(r.get("EXPDTTM"))
        ltype = ONPREM_T[0] if cat in ABC_ON else RETAIL_T
        rows.append({"jur": "louabc", "lic": f"louabc-{r.get('LicenseNO')}", "name": name, "dba": name, "holder": None, "keys": _names(name),
                     "addr": addr, "city": city, "zip": zp, "num": num, "street": st, "lat": r.get("_lat") or r.get("GPSY"),
                     "lon": r.get("_lon") or r.get("GPSX"), "kind": "liquor",
                     "active": r.get("LicStatus") == "Active" and (exp is None or exp >= today), "ltype": ltype, "insp": [],
                     "issued": None, "drinks": _drinks(r) if cat in ABC_ON else None, "county": None})
    return rows


CDP_DIR = os.path.join(OFF, "cdp")
CDP_META = json.load(open(os.path.join(CDP_DIR, "fetched.json"))) if os.path.exists(os.path.join(CDP_DIR, "fetched.json")) else {}
FETCHED_CDP = CDP_META.get("fetched")
COUNTIES = sorted(json.load(open(os.path.join(KY, "ky_counties_detail.geojson"))).keys())   # CDP numbers: alphabetical, Adair 1


def _mdy(v):
    """'9/1/2026' -> '2026-09-01'."""
    m = re.match(r"^\s*(\d{1,2})/(\d{1,2})/(\d{4})\s*$", str(v or ""))
    return f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}" if m else None


def load_cdp():
    """Kentucky's statewide portal, county by county: the last inspection and any follow-up, each with its score as published. The
    export carries no establishment type (schools, day cares and groceries are in it), so these rows only ever attach to a listing they
    match: kind "inspected" never adds a place."""
    import csv
    rows = []
    for fn in sorted(os.listdir(CDP_DIR)):
        m = re.match(r"^(\d{3})\.csv$", fn)
        if not m:
            continue
        n = int(m.group(1)); county = COUNTIES[n - 1]
        for i, r in enumerate(csv.DictReader(open(os.path.join(CDP_DIR, fn), encoding="utf-8"))):
            name = re.sub(r"\s+", " ", r.get("Premise Name") or "").strip()
            addr = _addr(r.get("Premise Address 1"))
            if not name or not addr:
                continue
            insp = []
            for dk, sk, typ, tag in (("Last Insp Date", "Last Insp Score", "Inspection", "l"), ("Follow Insp Date", "Follow Insp Score", "Follow-up", "f")):
                d, sc = _mdy(r.get(dk)), str(r.get(sk) or "").strip()
                if d and re.fullmatch(r"\d{1,3}", sc) and (not FETCHED_CDP or d <= FETCHED_CDP):
                    insp.append([d, f"Score {int(sc)}", typ, f"cdp-{n}-{i}-{tag}"])
            num, st = street_key(addr)
            rows.append({"jur": "cdp", "lic": f"cdp-{n}-{i}", "name": name, "dba": name, "holder": None, "keys": _names(name), "addr": addr,
                         "city": _city(r.get("Premise City")), "zip": "", "num": num, "street": st, "lat": None, "lon": None,
                         "kind": "inspected", "active": True, "ltype": "Kentucky food establishment inspection record",
                         "insp": sorted(insp, key=lambda v: v[0], reverse=True), "issued": None, "drinks": None, "county": county})
    return rows


ABC_DIR = os.path.join(OFF, "ky_abc")
# Kentucky ABC's drink license types -> what each allows by the drink (KRS 243.082-243.084, 243.030)
KYABC_DRINKS = {"NQ1": ["beer", "wine", "liquor"], "NQ2": ["beer", "wine", "liquor"], "NQ3": ["beer", "wine", "liquor"],
                "NQ4": ["beer"], "LD": ["wine", "liquor"], "LR": ["beer", "wine", "liquor"]}


def load_kyabc():
    """Kentucky ABC's active on-premise drink licenses, statewide (BELLE lookup): DBA name and premises only; a license with no DBA
    name (only its holder's name, often a person's) is left out."""
    rows = []
    for fn in sorted(os.listdir(ABC_DIR)):
        if not fn.endswith(".json"):
            continue
        d = json.load(open(os.path.join(ABC_DIR, fn)))
        lt = d["type"]
        for r in d["rows"]:
            dbas = [x.strip() for x in (r.get("DBA") or "").split(";") if x.strip()]
            if not dbas:
                continue
            addr = _addr(r.get("PremisesStreet"))
            num, st = street_key(addr)
            cty = (r.get("County") or "").strip()
            rows.append({"jur": "kyabc", "lic": f"kyabc-{lt}-{r.get('SiteID')}", "name": dbas[0], "dba": dbas[0], "holder": None,
                         "keys": _names(*dbas), "addr": addr, "city": _city(r.get("City")), "zip": _zip(r.get("Zip")), "num": num,
                         "street": st, "lat": None, "lon": None, "kind": "liquor", "active": True, "ltype": ONPREM_T[1], "insp": [],
                         "issued": None, "drinks": KYABC_DRINKS.get(lt),
                         "county": (cty if cty.endswith("County") else cty + " County") if cty else None})
    return rows


def load():
    """Louisville Metro's food permits (with their inspections) and its ABC licenses, the statewide portal's county inspections and
    Kentucky ABC's statewide drink licenses (see the docstring)."""
    rows = []
    if os.path.exists(os.path.join(OFF, "louisville", "establishments.json")):
        rows += load_louisville()
    if os.path.exists(os.path.join(OFF, "louisville", "abc.json")):
        rows += load_louabc()
    if os.path.isdir(CDP_DIR):
        rows += load_cdp()
    if os.path.isdir(ABC_DIR):
        rows += load_kyabc()
    df = pd.DataFrame(rows) if rows else pd.DataFrame({c: pd.Series(dtype=object) for c in COLUMNS})
    for c_ in COLUMNS:
        if c_ not in df.columns:
            df[c_] = None
    df["lat"] = df["lat"].astype(float); df["lon"] = df["lon"].astype(float); df["active"] = df["active"].astype(bool)
    df["biz"] = np.arange(len(df))
    return df
