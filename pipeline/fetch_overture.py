"""Download the Overture Maps extracts that kentucky.py reads -> data/ky/

- overture_ky_bbox.parquet     every place in Kentucky's bounding box (name, category, address, point)
- overture_ky_sources.parquet  which datasets each Kentucky eating/drinking listing came from (Meta, Foursquare, ...)
- ky_shapes.json               simplified state and county outlines for the map
- ky_state_detail.geojson      the state outline at full detail, for the in-state test

Reads the public Overture bucket over S3 with DuckDB (no account needed). Ported from va-eats/pipeline/fetch_overture.py (2026-11-06).
Kentucky: 120 counties from Overture's land division areas (Louisville/Jefferson and Lexington-Fayette are merged governments but
still one county each). The Kentucky Bend (Fulton County's exclave in the Mississippi) stays in. The script checks the towns on the
lines with Indiana, Ohio, West Virginia, Virginia, Tennessee, Missouri and Illinois (Covington is in, Cincinnati out; Hopkinsville in,
Clarksville out; Ashland in, Huntington out).
"""
import os, re, json, time
import duckdb
from shapely import wkb
from shapely.geometry import mapping, Polygon

RELEASE = "2026-10-21.0"
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "ky")
# Kentucky (36.49°N–39.15°N, 81.96°W–89.57°W) plus a margin for the border towns (Covington, Ashland, Fulton, the Kentucky Bend)
BBOX = "bbox.xmin BETWEEN -89.7 AND -81.8 AND bbox.ymin BETWEEN 36.4 AND 39.25"
EAT = "('restaurant','casual_eatery','bar','fast_food_restaurant','coffee_shop','cafe','smoothie_juice_bar','brewery','food_court')"
os.makedirs(OUT, exist_ok=True)

con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; SET s3_region='us-west-2';")
places = f"s3://overturemaps-us-west-2/release/{RELEASE}/theme=places/type=place/*.parquet"

t = time.time()
if not os.path.exists(f"{OUT}/overture_ky_bbox.parquet"):
    con.execute(f"""
COPY (
  SELECT id, names.primary AS name, basic_category AS cat, taxonomy.primary AS tax, taxonomy.hierarchy AS hier, confidence,
         operating_status AS status, brand.names.primary AS brand, addresses[1].freeform AS street, addresses[1].locality AS city,
         addresses[1].postcode AS zip, addresses[1].region AS region, ST_Y(geometry) AS lat, ST_X(geometry) AS lon, websites[1] AS web,
         phones[1] AS phone
  FROM read_parquet('{places}', hive_partitioning=1) WHERE {BBOX}
) TO '{OUT}/overture_ky_bbox.parquet' (FORMAT PARQUET)""")
    print("places in bbox", round(time.time() - t), "s", flush=True)
if not os.path.exists(f"{OUT}/overture_ky_sources.parquet"):
    con.execute(f"""
COPY (
  SELECT id, list_transform(sources, lambda x: x.dataset) AS ds, list_transform(sources, lambda x: x.update_time) AS ut,
         list_transform(sources, lambda x: x.record_id) AS rid,
         len(socials) AS n_soc, len(websites) AS n_web, len(phones) AS n_ph
  FROM read_parquet('{places}', hive_partitioning=1)
  WHERE {BBOX} AND basic_category IN {EAT}
) TO '{OUT}/overture_ky_sources.parquet' (FORMAT PARQUET)""")
    print("sources", round(time.time() - t), "s", flush=True)

areas = f"s3://overturemaps-us-west-2/release/{RELEASE}/theme=divisions/type=division_area/*.parquet"
rows = con.execute(f"""
  SELECT subtype, names.primary AS name, ST_AsWKB(geometry) AS g
  FROM read_parquet('{areas}', hive_partitioning=1)
  WHERE country = 'US' AND region = 'US-KY' AND subtype IN ('region', 'county') AND class = 'land'
    AND bbox.xmin > -89.8 AND bbox.xmax < -81.7 AND bbox.ymin > 36.3 AND bbox.ymax < 39.3""").fetchall()
# Kentucky has no independent cities; a merged government's area keeps its county name ("Louisville/Jefferson County Metro" ->
# "Jefferson County")
def _cname(sub, name):
    if sub == "region" or name.endswith(" County"):
        return name
    m = re.search(r"\b([A-Z][a-z]+) County\b", name)
    return m.group(1) + " County" if m else name + " County"
rows = [(sub, _cname(sub, name), g) for sub, name, g in rows]


def rings(geom, tol, min_area):
    geom = geom.simplify(tol, preserve_topology=True)
    polys = [p for p in getattr(geom, "geoms", [geom]) if p.geom_type == "Polygon" and p.area >= min_area]
    return [[[round(x, 3), round(y, 3)] for x, y in p.exterior.coords] for p in polys]


out = {"state": None, "counties": []}
for sub, name, g in rows:
    geom = wkb.loads(bytes(g)).buffer(0)
    if sub == "region":
        json.dump(mapping(geom.simplify(0.0005, preserve_topology=True)), open(f"{OUT}/ky_state_detail.geojson", "w"))
        out["state"] = [[r] for r in rings(geom, 0.002, 0.000005)]
    else:
        out["counties"].append({"name": name, "c": rings(geom, 0.004, 0.00002)})
# full-detail county polygons for assigning each place to a county (not shipped)
json.dump({name: mapping(wkb.loads(bytes(g)).buffer(0).simplify(0.0003, preserve_topology=True))
           for sub, name, g in rows if sub == "county"}, open(f"{OUT}/ky_counties_detail.geojson", "w"))
json.dump(out, open(f"{OUT}/ky_shapes.json", "w"), separators=(",", ":"))
print("outlines: state", len(out["state"] or []), "rings +", len(out["counties"]), "counties;", round(time.time() - t), "s total")
# islands, shores and border towns: each must fall on the right side of the detailed state outline
from shapely.geometry import shape, Point
st = shape(json.load(open(f"{OUT}/ky_state_detail.geojson")))
for nm, lon, lat, want in [("Louisville", -85.7585, 38.2527, True), ("Jeffersonville, IN", -85.7372, 38.2776, False), ("Covington", -84.5085, 39.0837, True),
                           ("Newport", -84.4955, 39.0915, True), ("Cincinnati, OH", -84.5120, 39.1031, False), ("Ashland", -82.6380, 38.4784, True),
                           ("Huntington, WV", -82.4452, 38.4192, False), ("Pikeville", -82.5188, 37.4793, True), ("Williamson, WV", -82.2774, 37.6743, False),
                           ("Middlesboro", -83.7166, 36.6084, True), ("Harrogate, TN", -83.6566, 36.5823, False), ("Hopkinsville", -87.4886, 36.8656, True),
                           ("Clarksville, TN", -87.3595, 36.5298, False), ("Paducah", -88.6001, 37.0834, True), ("Metropolis, IL", -88.7320, 37.1511, False),
                           ("Henderson", -87.5900, 37.8362, True), ("Evansville, IN", -87.5558, 37.9748, False), ("Kentucky Bend", -89.5300, 36.5100, True),
                           ("New Madrid, MO", -89.5276, 36.5867, False), ("Maysville", -83.7444, 38.6412, True), ("Aberdeen, OH", -83.7613, 38.6559, False)]:
    ok = st.contains(Point(lon, lat))
    print(f"  {nm}: {'inside' if ok else 'outside'}{'' if ok == want else '  <-- WRONG'}")
print("counties:", len(out["counties"]), sorted(c["name"] for c in out["counties"]))

# the neighbours' land (Indiana, Ohio, West Virginia, Virginia, Tennessee, Missouri, Illinois): listings.py widens Kentucky's outline
# ~300 m for river shores, but only where no neighbour's land is, so a Cincinnati or Jeffersonville listing across the Ohio stays out
nb = con.execute(f"""
  SELECT region, ST_AsWKB(geometry) FROM read_parquet('{areas}', hive_partitioning=1)
  WHERE country = 'US' AND region IN ('US-IN', 'US-OH', 'US-WV', 'US-VA', 'US-TN', 'US-MO', 'US-IL') AND subtype = 'region' AND class = 'land'""").fetchall()
from shapely.ops import unary_union
from shapely.geometry import box
near = box(-89.8, 36.3, -81.7, 39.3)
nbg = unary_union([wkb.loads(bytes(g)).buffer(0).intersection(near) for _, g in nb])
json.dump(mapping(nbg.simplify(0.0002, preserve_topology=True)), open(f"{OUT}/ky_neighbors.geojson", "w"))
print("neighbours:", sorted(r for r, _ in nb))
