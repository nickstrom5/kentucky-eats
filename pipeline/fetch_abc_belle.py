"""Kentucky ABC's on-premise drink licenses, statewide -> data/raw/official/ky_abc/<TYPE>.json (git-ignored, never public).

Nick's yes, 2026-11-07: script Kentucky ABC's public BELLE license lookup (abcportal.ky.gov/BelleExternal/LicenseLookup/LicenseDetails,
the licensing portal named in 804 KAR 4:400) for "Serves alcohol". robots.txt answers 404 (no rules; checked 2026-11-07); no posted
terms. The lookup's "Export to Excel" fails on the State's side (an EPPlus assembly error, 2026-11-07), so this reads the same rows
through the grid's own data call (GetGridData), filtered by license type, 200 rows a page, one request at a time with a 3-second pause,
a generic client name, no email address.

License types read (active licenses that allow drinks on the premises; ReportGenerator/GetLicenseTypes): NQ1, NQ2 and NQ3 Retail Drink,
NQ4 Retail Malt Beverage Drink, LD Quota Retail Drink, LR Limited Restaurant. Package, supplier, storage, caterer, hotel in-room and
supplemental licenses are left out. Kept per row: the State's site id, the DBA name, the premises street, city, county and ZIP, and the
type. The licensee's own name (often a person's) is never kept.
Usage: ../.venv/bin/python fetch_abc_belle.py
"""
import datetime, json, os, time
import requests

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "data", "raw", "official", "ky_abc")
os.makedirs(OUT, exist_ok=True)
GRID = "https://abcportal.ky.gov/BelleExternal/LicenseLookup/GetGridData"
TYPES = {"NQ1": "NQ1 Retail Drink License", "NQ2": "NQ2 Retail Drink License", "NQ3": "NQ3 Retail Drink License",
         "NQ4": "NQ4 Retail Malt Beverage Drink License", "LD": "Quota Retail Drink License", "LR": "Limited Restaurant License"}
KEEP = ("SiteID", "DBA", "PremisesStreet", "City", "County", "Zip")
PAUSE, SIZE = 3.0, 200
S = requests.Session()
S.headers["User-Agent"] = "EatsRankedData/1.0"


def page(lt, n):
    form = {"sort": "", "page": n, "pageSize": SIZE, "group": "", "filter": "", "LicenseType": lt, "DBA": "", "LicenseeName": "",
            "LicenseNumber": "", "SiteID": "", "PremisesStreet": "", "County": "", "Zip": "", "City": ""}
    for attempt in range(4):
        try:
            r = S.post(GRID, data=form, timeout=120)
            if r.status_code == 200:
                d = r.json()
                if d.get("Errors"):
                    raise RuntimeError(str(d["Errors"])[:200])
                return d
            print(f"  {lt} page {n}: HTTP {r.status_code}; retrying", flush=True)
        except (requests.RequestException, ValueError) as e:
            print(f"  {lt} page {n}: {type(e).__name__}; retrying", flush=True)
        time.sleep(PAUSE * 5 * (attempt + 1))
    raise RuntimeError(f"{lt} page {n} failed")


def main():
    counts = {}
    for lt, label in TYPES.items():
        rows, n, total = [], 1, None
        while True:
            d = page(lt, n)
            time.sleep(PAUSE)
            total = d.get("Total") or 0
            rows += [{k: (x.get(k) or "").strip() if isinstance(x.get(k), str) else x.get(k) for k in KEEP} | {"type": lt}
                     for x in d.get("Data") or []]
            if not d.get("Data") or len(rows) >= total:
                break
            n += 1
        json.dump({"type": lt, "label": label, "fetched": datetime.date.today().isoformat(), "total": total, "rows": rows},
                  open(os.path.join(OUT, f"{lt}.json"), "w"), indent=0)
        counts[lt] = (len(rows), total)
        print(f"{lt}: {len(rows)} of {total}", flush=True)
    print("done", counts)


if __name__ == "__main__":
    main()
