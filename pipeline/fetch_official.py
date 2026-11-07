"""Kentucky's open official records -> data/raw/official/ (git-ignored, never public).

Checked 2026-11-06 (playbook/12-sources.md). The open feeds are Louisville Metro's (Jefferson County), on its ArcGIS open-data
platform (owner LouisvilleMetro, services1.arcgis.com/79kfd2K6fskCAkyg), all under the platform's Terms of Use and the Open Data Commons
PDDL (public domain; an app must name the source, version and modifications):
  - Environmental Health Bulk Data - Establishments (item d64d4748d7074e3a88ec8d55ef797edc): every permitted establishment, with a point
  - Environmental Health Bulk Data - Inspections (6b7d648876784f4db1392ed6b6a9bfc4): five years rolling, daily, with the official score
    (100 minus violation points, 902 KAR 45:005) and, on most regular inspections, Louisville's own A/B/C grade
  - ABC Licenses (f17c7ab0ff954b729116fccb20f0f23b): Louisville Metro's alcoholic beverage licenses, with category, status and point
Outside Jefferson County the inspection scores are only on Custom Data Processing's statewide portal (public.cdpehs.com), which posts
no terms: it's linked per county, never exported, until Nick decides. Kentucky ABC's BELLE lookup has no posted terms: not used.
One request at a time, a second apart; no owner or person names are kept.
"""
import datetime, json, os, time
import requests

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "official")
os.makedirs(os.path.join(OUT, "louisville"), exist_ok=True)
UA = "KentuckyEatsDataCheck/1.0 (+https://nickstrom5.github.io/kentucky-eats/; nick@eatsranked.com)"
B = "https://services1.arcgis.com/79kfd2K6fskCAkyg/arcgis/rest/services"
EST = f"{B}/Louisville_Metro_KY_Environmental_Health_Bulk_Data_Establishments/FeatureServer/0"
INS = f"{B}/Louisville_Metro_KY_Environmental_Health_Bulk_Data_Inspections/FeatureServer/0"
ABC = f"{B}/abc_license_ait4135/FeatureServer/0"
S = requests.Session(); S.headers["User-Agent"] = UA


def get(url, **params):
    for attempt in range(4):
        r = S.get(url, params=params, timeout=90)
        if r.status_code == 200 and "error" not in r.text[:200]:
            return r.json()
        time.sleep(5 * (attempt + 1))
    r.raise_for_status()
    raise RuntimeError(r.text[:300])


def arcgis(layer, fields, geometry=False, where="1=1"):
    rows, off = [], 0
    while True:
        d = get(f"{layer}/query", where=where, outFields=fields, returnGeometry=str(geometry).lower(), outSR=4326,
                orderByFields="ObjectId", resultOffset=off, resultRecordCount=1000, f="json")
        feats = d.get("features") or []
        for f in feats:
            a = dict(f["attributes"])
            if geometry and f.get("geometry"):
                a["_lon"], a["_lat"] = f["geometry"].get("x"), f["geometry"].get("y")
            rows.append(a)
        if len(feats) < 1000 and not d.get("exceededTransferLimit"):
            return rows
        off += len(feats)
        time.sleep(1)


def edited(layer):
    """The layer's own last-edit time (ArcGIS editingInfo), so 'updated' is the publisher's day, not ours."""
    d = get(layer, f="json")
    v = (d.get("editingInfo") or {}).get("lastEditDate") or (d.get("editingInfo") or {}).get("dataLastEditDate")
    return datetime.datetime.fromtimestamp(v / 1000, datetime.timezone.utc).date().isoformat() if v else None


TERMS = ("Louisville Metro Government Open Data Platform Terms of Use; data under the Open Data Commons Public Domain Dedication and "
         "License (PDDL): https://louisville-metro-opendata-lojic.hub.arcgis.com/pages/terms-of-use-and-license")
today = datetime.date.today().isoformat()
meta = {"louisville": {"name": "Louisville Metro Public Health and Wellness: Environmental Health Bulk Data (Establishments, Inspections)",
                       "url": "https://data.louisvilleky.gov", "fetched": today, "edited": edited(INS), "terms": TERMS},
        "louabc": {"name": "Louisville Metro: ABC Licenses", "url": "https://data.louisvilleky.gov", "fetched": today,
                   "edited": edited(ABC), "terms": TERMS}}
est = arcgis(EST, "EstablishmentID,EstType,RCodeDesc,PremiseName,PermiseStreetNo,PremiseStreet,PremiseExtraAddrLine,PremiseCity,"
             "PremiseState,PremiseZip,Status,latitude,longitude,opening_date,IsCaterer,IsTrucksOnly,ObjectId")
time.sleep(1)
ins = arcgis(INS, "InspectionID,EstablishmentID,InspectionDate,InspectionType,GradeID,score,ObjectId")
time.sleep(1)
abc = arcgis(ABC, "*", True)
json.dump(est, open(os.path.join(OUT, "louisville", "establishments.json"), "w"))
json.dump(ins, open(os.path.join(OUT, "louisville", "inspections.json"), "w"))
json.dump(abc, open(os.path.join(OUT, "louisville", "abc.json"), "w"))
json.dump(meta, open(os.path.join(OUT, "meta.json"), "w"), indent=1)
print("Louisville establishments:", len(est), "| inspections:", len(ins), "| ABC licenses:", len(abc), "| edited:",
      meta["louisville"]["edited"], meta["louabc"]["edited"])
