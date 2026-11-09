"""Place official records that have no coordinates on Overture address points, and cache the address-point index.

Kentucky has no official list yet (official.py), so there's nothing to place; the address-point index (data/ky/ap_index.pkl, Overture's
Kentucky address points, about 1.5 million) still places researched addresses the map listings lack (kentucky.py). Match: same house number and street
key, then the same zip (else the same town). -> data/ky/official.pkl (official.load() plus lat/lon/geo columns)
"""
import os, re, time, pickle, json
import numpy as np, pandas as pd
from common import KY, canon_city
import official
from official import street_key

t = time.time()
idx_path = f"{KY}/ap_index.pkl"
if os.path.exists(idx_path):
    AP = pd.read_pickle(idx_path)
else:
    AP = pd.read_parquet(f"{KY}/addresses_ky.parquet", columns=["number", "street", "postcode", "postal_city", "state", "muni", "lat", "lon"])
    AP = AP[AP.state.isin(["KY", None]) | AP.state.isna()]
    keys = [street_key(f"{n} {s}") for n, s in zip(AP.number.astype(str), AP.street.fillna(""))]
    AP["num"] = [k[0] for k in keys]
    AP["key"] = [k[1] for k in keys]
    AP["zip"] = AP.postcode.fillna("").astype(str).str[:5]
    AP["town"] = [(canon_city(re.sub(r"^(?:City|Town) of ", "", m)) or "").lower() if isinstance(m, str) else "" for m in AP.muni]
    AP["ptown"] = AP.postal_city.map(lambda c: (canon_city(c) or "").lower() if isinstance(c, str) else "")
    AP = AP[AP.num.notna() & AP.key.notna()][["num", "key", "zip", "town", "ptown", "lat", "lon"]].reset_index(drop=True)
    AP.to_pickle(idx_path)
print("address points:", len(AP), round(time.time() - t), "s", flush=True)
F = official.load()
# Address points are many: group only those at a house number and street some record needs (millions of tiny groups
# took longer than the whole build)
need = set(zip(F.num, F.street))
APn = AP[pd.Series(list(zip(AP.num, AP.key))).isin(need).values]
by = {k: g for k, g in APn.groupby(["num", "key"])}
print("indexed", len(by), "of", len(need), "needed addresses", round(time.time() - t), "s", flush=True)


_CTY = None


def in_county(name, lat, lon):
    """Address points inside a county's outline: for a record its list files by county with no town or zip (Vanderburgh's reports)."""
    global _CTY
    if _CTY is None:
        from shapely.geometry import shape
        from shapely.prepared import prep
        _CTY = {n: prep(shape(g)) for n, g in json.load(open(f"{KY}/ky_counties_detail.geojson")).items()}
    from shapely.geometry import Point
    poly = _CTY.get(name)
    return np.array([bool(poly) and poly.contains(Point(lo, la)) for la, lo in zip(lat, lon)], dtype=bool)


def place(num, key, zip5, city, county=None):
    g = by.get((num, key))
    if g is None:
        return None
    town = (canon_city(city) or "").lower() if isinstance(city, str) else ""
    for sel, how in ((g.zip == zip5, "zip"), ((g.town == town) | (g.ptown == town), "town")):
        h = g[sel] if (zip5 if how == "zip" else town) else g.iloc[0:0]
        if len(h) and (h.lat.max() - h.lat.min()) < 0.01 and (h.lon.max() - h.lon.min()) < 0.013:
            return float(h.lat.median()), float(h.lon.median()), how
    if isinstance(county, str) and county and not zip5 and not town:
        h = g[in_county(county, g.lat.values, g.lon.values)]
        if len(h) and (h.lat.max() - h.lat.min()) < 0.01 and (h.lon.max() - h.lon.min()) < 0.013:
            return float(h.lat.median()), float(h.lon.median()), "county"
    return None


F["geo"] = np.where(F.lat.notna(), "source", None)
fallback = {}
if "n_pts" in F:
    unsure = F.n_pts.fillna(1).gt(1)
    fallback = {i: (F.at[i, "lat"], F.at[i, "lon"]) for i in F.index[unsure]}
    F.loc[unsure, ["lat", "lon"]] = np.nan
    F.loc[unsure, "geo"] = None
miss = F.lat.isna() & F.num.notna() & F.street.notna()
cty_col = F.loc[miss, "county"] if "county" in F else pd.Series([None] * int(miss.sum()), index=F.index[miss])
hits = [place(n, k, z, c, ct) for n, k, z, c, ct in zip(F.loc[miss, "num"], F.loc[miss, "street"], F.loc[miss, "zip"], F.loc[miss, "city"], cty_col)]
for i, h in zip(F.index[miss], hits):
    if h:
        F.at[i, "lat"], F.at[i, "lon"], F.at[i, "geo"] = h
for i, (la, lo) in fallback.items():
    if F.at[i, "lat"] != F.at[i, "lat"]:
        F.at[i, "lat"], F.at[i, "lon"], F.at[i, "geo"] = la, lo, "source (points disagree)"
F.to_pickle(f"{KY}/official.pkl")
print("placed:", F.geo.value_counts(dropna=False).to_dict(), "| by source still without a point:",
      F[F.lat.isna()].groupby("jur").size().to_dict(), round(time.time() - t), "s")
