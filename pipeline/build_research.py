"""Writes data/research/app/*.json (hand-checked Kentucky guides), data/research/michelin.json, jbf.json and closed.json from the
compact lists below. Ported from va-eats/pipeline/build_research.py (2026-11-06).

Each entry cites the page that names it, read on 2026-11-06: an official Kentucky tourism page (kentuckytourism.com, the Kentucky
Department of Tourism; gotolouisville.com, Louisville Tourism; visitowensboro.com; meetnky.com, the Northern Kentucky convention and
visitors bureau), a page dated 2025-26 on a robots-checked host (check_sources.py), or jamesbeard.org. The address comes from the map
listing we already hold for that name in that town (site/kentucky.json); a name that isn't found exactly once in its town (or at the
street number given) is left out and listed in data/research/app/LEADS.md. A place the map data doesn't show as a place to eat is
added only with a street address from its official listing or our own map data (ADDR).
Usage: ../.venv/bin/python build_research.py   (then kentucky.py)"""
import json, os, re
from brands import brand_of
from common import norm_name
ROOT = os.path.join(os.path.dirname(__file__), "..")
R = os.path.join(ROOT, "data", "research")
d = json.load(open(os.path.join(ROOT, "site", "kentucky.json")))
C, M = d["cols"], d["meta"]
norm = lambda s: re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", (s or "").lower().replace("'", "").replace("’", ""))).strip()

# each dated on its face, or an official tourism page (read 2026-11-06)
KT8 = "https://www.kentuckytourism.com/8-iconic-kentucky-dishes-to-try-in-your-lifetime"                     # Kentucky Department of Tourism
KT_BARD = "https://www.kentuckytourism.com/your-guide-best-food-drink-bardstown"                            # Kentucky Department of Tourism
KT_BARD26 = ("https://www.kentuckytourism.com/trip-planning/travel-inspiration/articles/2026/03/04/"
             "10-can-t-miss-experiences-in-bardstown--kentucky")                                               # 2026-03-04
GTL_HB = "https://www.gotolouisville.com/blog/ways-to-eat-hot-brown-louisville-ky/"                          # Louisville Tourism, 2026-04-17
WUKY_HB = "https://www.wuky.org/wuky-news/2025-04-23/kentucky-hot-brown-trail-winds-through-downtown-frankfort"   # WUKY, 2025-04-23
VO = lambda slug: f"https://visitowensboro.com/listing/{slug}/"                                            # Visit Owensboro listing
NKY = "https://www.meetnky.com/restaurants/"                                                               # meetNKY (official CVB)
TT_OLDREST = "https://www.tastingtable.com/1975409/oldest-restaurant-every-state-still-open/"          # 2025-09-23
TT_OLDBAR = "https://www.tastingtable.com/1786324/oldest-bar-every-state/"                          # 2025-02-17
JBF26 = "https://www.jamesbeard.org/stories/james-beard-award-semifinalists-2026"                   # 2026-01-21
JBF26N = "https://www.jamesbeard.org/stories/james-beard-awards-restaurant-and-chef-nominees-2026"  # 2026-03-31
JBF25 = "https://www.jamesbeard.org/stories/the-2025-james-beard-award-semifinalists"               # 2025-01-22
JBF25N = "https://www.jamesbeard.org/stories/2025-james-beard-awards-restaurant-and-chef-nominees"  # 2025-04-02
JBF15_BI = "https://www.jamesbeard.org/blog/2015-americas-classics-beaumont-inn"                    # 2015 America's Classics
MI_UT = "https://guide.michelin.com/us/en"                                                         # no MICHELIN Guide covers Kentucky

# (name as the source writes it or as our listing spells it, town as our listing has it, street number to pick the location (or
# None), note, founded, founded_note, [sources])
LOU, FRA, OWB, BAR = "Louisville", "Frankfort", "Owensboro", "Bardstown"
GUIDES = {
 "hot brown": [   # the open-faced turkey, bacon and Mornay sandwich the Brown Hotel created in 1926 (Kentucky Tourism)
  ("J. Graham's Cafe", LOU, "335", "The Brown Hotel's café, where the Hot Brown was created in 1926; one of Kentucky Tourism's two best places to try it.", None, None, [KT8]),
  ("English Grill", LOU, "335", "The Brown Hotel's dining room, the other place Kentucky Tourism sends you for the original Hot Brown.", None, None, [KT8]),
  ("Sidebar at Whiskey Row", LOU, None, "Hot Brown fries in a cast-iron skillet and a Hot Brown burger with beer cheese.", None, None, [GTL_HB]),
  ("Lou Lou Food + Drink", LOU, "108", "A traditional Hot Brown entrée, and a Hot Brown pizza on a Mornay base.", None, None, [GTL_HB]),
  ("The Goose Eatery & Hangout", LOU, None, "Four Hot Browns on the menu, among them the vegetarian Veggie Brown.", None, None, [GTL_HB]),
  ("Serafini", FRA, None, "A Hot Brown on the menu all year, not just for Frankfort's Hot Brown Trail.", None, None, [WUKY_HB]),
  ("Andy's Artisan Bread", FRA, None, "A Hot Brown croissant that regulars ask for all year.", None, None, [WUKY_HB]),
  ("Mi Fiesta", FRA, None, "A Mexican-style Hot Brown on Frankfort's Hot Brown Trail.", None, None, [WUKY_HB]),
  ("Kentucky Coffeetree Cafe", FRA, None, "Hot Brown soup on Frankfort's Hot Brown Trail.", None, None, [WUKY_HB]),
 ],
 "kentucky classic": [   # Kentucky Tourism's "8 iconic Kentucky dishes", one best place each, and Owensboro's barbecue buffets
  ("Kingfish", LOU, "3021", "Kentucky Tourism's pick for rolled oysters, a Louisville snack from the late 19th century.", None, None, [KT8]),
  ("Boone Tavern", "Berea", "100", "Spoonbread in the dining room of Berea's historic hotel, Kentucky Tourism's place to try it.", None, None, [KT8]),
  ("Old Hickory Bar-B-Q", OWB, "338", "Kentucky Tourism's best place to try burgoo, the stew of chicken, pork and mutton.", None, None, [KT8, VO("old-hickory-bar-b-q")]),
  ("Moonlite Bar-B-Q Inn", OWB, "2840", "Owensboro's mutton barbecue and burgoo; a 30-seat roadside restaurant in 1963 that now seats 350.", None, None,
   [KT8, VO("moonlite-bar-b-q-inn")]),
  ("Ole South Barbecue", OWB, "3523", "Owensboro barbecue with lunch and dinner buffets, and breakfast.", None, None, [VO("ole-south-barbecue")]),
  ("Hall's on the River", "Winchester", "1225", "Kentucky Tourism's pick for beer cheese: sharp cheddar, beer, garlic and spices, by the Kentucky River.", None, None, [KT8]),
 ],
 "bourbon country": [   # Kentucky Tourism's Bardstown guides
  ("Old Talbott Tavern", BAR, "107", "A 1779 stagecoach stop on Court Square: bourbon-sauced dishes, pot roast and bourbon pours.", None, None, [KT_BARD, KT_BARD26]),
  ("The Rickhouse Restaurant and Lounge", BAR, None, "Fine dining below the Oscar Getz Museum of Whiskey History, with more than 150 bourbons.", None, None, [KT_BARD]),
  ("Mr. Tubs", BAR, None, "A casual neighborhood spot with a country ham plate and a Kentucky snack box.", None, None, [KT_BARD]),
  ("Toogie's Table", BAR, None, "A seasonal, farm-forward kitchen cooking with Kentucky ingredients.", None, None, [KT_BARD]),
  ("Mammy's Kitchen", BAR, None, "Downtown plates, best known for its bourbon pork chops.", None, None, [KT_BARD]),
  ("3rd Street Tap House", BAR, None, "More than 30 beers, wines and bourbon.", None, None, [KT_BARD]),
  ("Ernie's Tavern", "Bloomfield", None, "A memorabilia-filled tavern near Bardstown with burgers and its own bowling alley.", None, None, [KT_BARD26]),
  ("BJ's Steakhouse", BAR, None, "Burgers and crispy onion rings downtown.", None, None, [KT_BARD26]),
 ],
 "covington newport": [   # meetNKY's restaurant page (Food & Wine named Covington a top small city for food and drink in 2025)
  ("Anchor Grill", "Covington", None, "A 24-hour diner known for its GLT: goetta, lettuce and tomato.", None, None, [NKY]),
  ("Bouquet Restaurant & Wine Bar", "Covington", None, "A MainStrasse Village restaurant and wine bar.", None, None, [NKY]),
  ("The Baker's Table", "Newport", None, "David Willocks's restaurant, a James Beard finalist for Best Chef: Southeast in 2026.", None, None, [NKY, JBF26N]),
  ("Hofbrauhaus Newport", "Newport", "200", "The first Hofbräuhaus in the U.S., built to the Munich original's standards.", None, None, [NKY]),
  ("Libby's Southern Comfort", "Covington", None, "Southern comfort food, from chicken biscuits up.", None, None, [NKY]),
  ("Frida 602", "Covington", None, "A Mexican kitchen and bar.", None, None, [NKY]),
  ("The Gruff", "Covington", None, "A Covington deli, pizza and patio spot.", None, None, [NKY]),
  ("Pompilio's", "Newport", None, "A Newport Italian restaurant.", None, None, [NKY]),
  ("Wunderbar", "Covington", None, "A local bar and café serving wursts, brats and other German dishes.", None, None, [NKY]),
 ],
 "historic inn": [
  ("Beaumont Inn", "Harrodsburg", "638", "A family inn since 1919: two-year-old country ham, fried chicken and corn pudding; a James Beard America's Classic in 2015.",
   None, None, [JBF15_BI]),
  ("Boone Tavern", "Berea", "100", "Berea's historic hotel dining room, Kentucky Tourism's place for spoonbread.", None, None, [KT8]),
  ("Old Talbott Tavern", BAR, "107", "A tavern and inn on Bardstown's Court Square since 1779.", None, None, [TT_OLDREST, TT_OLDBAR]),
  ("Holly Hill Inn", "Midway", None, "A James Beard semifinalist for Outstanding Hospitality in 2025.", None, None, [JBF25]),
 ],
 "oldest": [
  ("Old Talbott Tavern", BAR, "107", "A tavern and inn on Bardstown's Court Square since 1779.", 1779,
   "Tasting Table's oldest restaurant (September 2025) and oldest bar (February 2025) in every state: Kentucky's, around since 1779 at 107 W Stephen Foster Ave.",
   [TT_OLDREST, TT_OLDBAR]),
  ("Beaumont Inn", "Harrodsburg", "638", "A family inn since 1919.", 1919,
   "The James Beard Foundation's 2015 America's Classics page: founded by the Goddards in 1917, opened for business in 1919.", [JBF15_BI]),
 ],
}
# street addresses for places the map data doesn't show as a place to eat: from the official listing, or our own map listing for it
ADDR = {("Old Talbott Tavern", BAR): "107 W Stephen Foster Ave", ("English Grill", LOU): "335 W Broadway", ("Beaumont Inn", "Harrodsburg"): "638 Beaumont Inn Dr",
        ("Boone Tavern", "Berea"): "100 Main St N", ("Ole South Barbecue", OWB): "3523 KY-54"}
CUISINE = {("Old Talbott Tavern", BAR): "American & Other", ("English Grill", LOU): "American & Other", ("Beaumont Inn", "Harrodsburg"): "Soul & Southern",
           ("Boone Tavern", "Berea"): "Soul & Southern", ("Hall's on the River", "Winchester"): "American & Other"}
KINDS = {k: [k] for k in ("hot brown", "kentucky classic", "bourbon country", "covington newport", "historic inn", "oldest")}

# MICHELIN: no guide covers Kentucky (its American South guide is AL, GA, LA, MS, NC, SC and TN)
MICHELIN = []
MI_MATCH = {}
# James Beard (facts with sources): Kentucky's wins named on jamesbeard.org pages we read, and its 2025-26 nominees (finalists) and
# semifinalists; no Kentucky winner in 2025 or 2026
SE = "Best Chef: Southeast"
JBF = [{"name": "Beaumont Inn", "city": "Harrodsburg", "address": "638 Beaumont Inn Dr", "honors": ["America's Classics 2015"], "sources": [JBF15_BI]},
       {"name": "MeeshMeesh Mediterranean", "city": LOU, "honors": [f"{SE} finalist 2025 (Noam Bilitzer)", f"{SE} semifinalist 2026 (Noam Bilitzer)"],
        "sources": [JBF25N, JBF26], "match_names": ["MEESHMEESH"]},
       {"name": "freight house", "city": "Paducah", "honors": [f"{SE} finalist 2025 (Sara Bradley)"], "sources": [JBF25N, JBF25],
        "match_names": ["FREIGHT HOUSE"]},
       {"name": "The Baker's Table", "city": "Newport", "honors": [f"{SE} finalist 2026 (David Willocks)"], "sources": [JBF26N, JBF26]},
       {"name": "Watch Hill Proper", "city": "Prospect", "honors": ["Outstanding Bar semifinalist 2026"], "sources": [JBF26]},
       {"name": "Holly Hill Inn", "city": "Midway", "honors": ["Outstanding Hospitality semifinalist 2025"], "sources": [JBF25]}]
# closed, each with a source (none verified this pass)
CLOSED = []


def key(s):
    """The name key without a leading "the": "Varsity" is our "The Varsity"."""
    return re.sub(r"^the ", "", norm(s))


def find(name, town, num):
    k = key(name)
    hits = [i for i, n in enumerate(C["name"]) if C["city"][i] is not None and M["cities"][C["city"][i]] == town
            and (key(n) == k or key(n).startswith(k + " ") or k.startswith(key(n) + " ") or key(n).replace(" ", "") == k.replace(" ", "")
                 or (key(n).split()[:2] == k.split()[:2] and len(k.split()) >= 2))]
    if num:
        hits = [i for i in hits if (C["addr"][i] or "").split(" ")[0] == num]
    return hits


leads, n_out = [], {}
for kind, rows in GUIDES.items():
    out = []
    for name, town, num, note, founded, fnote, srcs in rows:
        hits = find(name, town, num)
        if not hits and (name, town) in ADDR:
            out.append({"name": name, "address": ADDR[(name, town)], "city": town, "zip": None, "kinds": KINDS[kind], "dishes": [], "note": note,
                        "founded": founded, "founded_note": fnote, "website": None, "open": True, "evidence_date": "2026-10",
                        "sources": srcs, "match_names": []} | ({"cuisine": CUISINE[(name, town)]} if (name, town) in CUISINE else {}))
            continue
        if len(hits) != 1:
            leads.append(f"- {kind}: {name} ({town}{', ' + num if num else ''}) — {len(hits)} matches in our data; not added"); continue
        i = hits[0]
        out.append({"name": C["name"][i], "address": C["addr"][i], "city": town, "zip": str(C["zip"][i]) if C["zip"][i] else None,
                    "kinds": KINDS[kind], "dishes": [], "note": note, "founded": founded, "founded_note": fnote, "website": None, "open": True,
                    "evidence_date": "2026-10", "sources": srcs, "match_names": [name.upper()] if norm(name) != norm(C["name"][i]) else []})
        if brand_of(norm_name(name)):   # a chain shows under its own spelling at every branch, whatever the listing says
            out[-1]["display"] = name
        if (name, town) in CUISINE:
            out[-1]["cuisine"] = CUISINE[(name, town)]
    fn = re.sub(r"[^a-z]+", "_", kind).strip("_")
    json.dump(out, open(f"{R}/app/{fn}.json", "w"), indent=1, ensure_ascii=False)
    n_out[kind] = len(out)

MI_ADDR = {}
json.dump({"restaurants": [{"name": n, "address": MI_ADDR.get(n), "city": t, "zip": None, "distinction": dist, "cuisine": cu, "green_star": False,
                             "michelin_url": MI_UT, "sources": [MI_UT], "match_names": [x.upper() for x in MI_MATCH.get(n, [])], "open": True}
                            for n, t, dist, cu in MICHELIN]}, open(f"{R}/michelin.json", "w"), indent=1, ensure_ascii=False)
json.dump([dict({"address": None}, **j, zip=None, open=True) for j in JBF], open(f"{R}/jbf.json", "w"), indent=1, ensure_ascii=False)
json.dump(CLOSED, open(f"{R}/closed.json", "w"), indent=1, ensure_ascii=False)
open(f"{R}/app/LEADS.md", "w").write("# Kentucky research leads (not yet verified)\n\nWritten by pipeline/build_research.py.\n\n" + "\n".join(leads) + """

## Waiting for a source we may use, or for the map data
- The Cafe (731 Brent St, Louisville: Kentucky Tourism's pick for Benedictine; a Hot Brown and Hot Brown tots per Louisville Tourism):
  its name has no distinctive word, so the matcher can't tie a researched entry to it; left out of the guides.
- Five Brothers Bar & Kitchen (Bardstown; Kentucky Tourism 2026-03-04) isn't in the map data.
- Western Kentucky barbecue beyond Owensboro (Thomason's in Henderson, Starnes in Paducah, Peak Bros. near Waverly): only older
  (2012-2023) pages found; Kentucky Tourism's 2023 BBQ trail article now answers 404.
- Beer cheese: Winchester's Beer Cheese Trail pages on visitwinchesterky.com are dated 2018 and 2022 (Pilot View Mini Mart, Beech
  Springs Farm Market, Loma's, Woody's, Abettor Brewing, Engine House Deli): waiting for a 2025-26 list.
- Goetta: visitcincy.com's goetta post (2022-07-11) names Tom & Chee (Newport), Bellevue Bistro and Greyhound Tavern (Fort Mitchell):
  too old for "checked open". Chili parlors: no 2025-26 page names Kentucky parlors (Skyline and Gold Star get brand facts only).
- Honors: Edward Lee (610 Magnolia, Best Chef: Southeast finalist 2011-2017) and Sam Fore (Tuk Tuk Sri Lankan Bites, finalist 2023)
  need their jamesbeard.org pages read and their restaurants checked open.
- brownhotel.com answers 403 to the fetcher: the Brown Hotel's own pages aren't cited (Kentucky Tourism's are).
- Alcohol outside Jefferson County: Kentucky ABC's BELLE export posts no terms (Nick's call). Inspections outside Jefferson County:
  the statewide CDP portal posts no terms (Nick's call), so it is linked per county, never exported.
""")
print(n_out, "| leads:", len(leads))
for l in leads: print(l)
