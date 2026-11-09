"""Kentucky's statewide food-inspection portal -> data/raw/official/cdp/<NNN>.csv (git-ignored, never public).

Nick's yes, 2026-11-07: script the bulk export of Custom Data Processing's public portal (public.cdpehs.com/KYEnvPBL), which posts each
county health department's last inspection per establishment. robots.txt answers 404 (no rules; checked 2026-11-07) and the portal posts
no terms. Each county's table has the portal's own "Export to CSV" button; this script presses it, one county at a time: a GET for the
table (the portal puts a cookieless session id in the path), then the button's POST. One request at a time with a 3-second pause, a
generic client name, no email address. Jefferson County (56) is skipped: Louisville Metro's open data covers it (fetch_official.py).

Columns as exported: Premise Name, Premise Address 1, Premise City, Last Insp Date, Last Insp Score, Follow Insp Date, Follow Insp Score.
County numbers are alphabetical (Adair 1, Fayette 34, Jefferson 56, Woodford 120), as in data/ky/ky_counties_detail.geojson.
Usage: ../.venv/bin/python fetch_cdp.py [--force]   (resumes: a county whose CSV exists is skipped unless --force)
"""
import datetime, html, json, os, re, sys, time
import requests

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "data", "raw", "official", "cdp")
os.makedirs(OUT, exist_ok=True)
TABLE = "https://public.cdpehs.com/KYEnvPBL/VW_PUBLIC_EST_INSP/ShowVW_PUBLIC_EST_INSPTable.aspx?COUNTY={n}"
BUTTON = "ctl00$PageContent$VW_PUBLIC_EST_INSPExportCSVButton"
HEADER = '"Premise Name","Premise Address 1","Premise City","Last Insp Date","Last Insp Score","Follow Insp Date","Follow Insp Score"'
PAUSE = 3.0
SKIP = {56}   # Jefferson: Louisville Metro's open data
COUNTIES = sorted(json.load(open(os.path.join(ROOT, "data", "ky", "ky_counties_detail.geojson"))).keys())
assert len(COUNTIES) == 120 and COUNTIES[33] == "Fayette County" and COUNTIES[55] == "Jefferson County", COUNTIES[:3]
S = requests.Session()
S.headers["User-Agent"] = "EatsRankedData/1.0"


def request(method, url, **kw):
    for attempt in range(4):
        try:
            r = S.request(method, url, timeout=180, **kw)
            if r.status_code == 200:
                return r
            print(f"  {method} {r.status_code}; retrying", flush=True)
        except requests.RequestException as e:
            print(f"  {method} {type(e).__name__}; retrying", flush=True)
        time.sleep(PAUSE * 5 * (attempt + 1))
    raise RuntimeError(f"{method} {url} failed")


def export(n):
    r = request("GET", TABLE.format(n=n))
    time.sleep(PAUSE)
    form = {m.group(1): html.unescape(m.group(2))
            for m in re.finditer(r'<input type="hidden" name="([^"]+)"[^>]*value="([^"]*)"', r.text)}
    if "__VIEWSTATE" not in form:
        raise RuntimeError(f"county {n}: no form on the table page")
    form[BUTTON + ".x"], form[BUTTON + ".y"] = "8", "8"
    c = request("POST", r.url, data=form)
    time.sleep(PAUSE)
    text = c.content.decode("utf-8-sig", errors="replace")
    if not text.startswith(HEADER):
        raise RuntimeError(f"county {n}: unexpected export ({c.headers.get('Content-Type')}): {text[:120]!r}")
    return text


def main():
    force = "--force" in sys.argv
    log = {}
    for n, name in enumerate(COUNTIES, 1):
        path = os.path.join(OUT, f"{n:03d}.csv")
        if n in SKIP or (os.path.exists(path) and not force):
            continue
        text = export(n)
        open(path, "w", encoding="utf-8").write(text)
        rows = text.count("\n") - 1
        log[name] = rows
        print(f"{n:3d} {name}: {rows} rows", flush=True)
    meta = os.path.join(OUT, "fetched.json")
    old = json.load(open(meta)) if os.path.exists(meta) else {}
    old.update({"fetched": datetime.date.today().isoformat(), "source": TABLE.format(n="<n>")})
    old.setdefault("rows", {}).update(log)
    json.dump(old, open(meta, "w"), indent=1)


if __name__ == "__main__":
    main()
