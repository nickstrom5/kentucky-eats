# Kentucky Eats (ky-eats) — notes for Claude Code sessions

Built 2026-11-06 by a side session for Nick's "build the 17 states left" (group: Kentucky, Indiana, Missouri, Kansas), ported from
`../va-eats/` (its official-ArcGIS plumbing) with every fix through 2026-11-05 (delivery-only brands hidden, the website blocklist and
`link_blocklist.py`, the Share link `Links.site + explore/#p=<id>`, over-the-air data, the adult-venue rules, the Denny's check,
`playbook/app-store/listing.json`). Local only: git-ignored data, no repo, no remote, nothing published. Sources: `playbook/12-sources.md`.
Brand: `playbook/05-naming.md` — **provisional**, every choice waits for Nick ("Kentucky Eats: Restaurants", subtitle "Hot Browns,
Burgoo & Bourbon", Home Screen "Kentucky Eats"; a Hot Brown in its skillet on flag navy #1B365D, bluegrass green #3D6B4A, goldenrod
#E6A817 fill only; a four-plank fence over bluegrass hills).

## Kentucky is different
- **Official data: Louisville Metro only** (PDDL): food permits, five years of inspections and ABC licenses (`pipeline/fetch_official.py`,
  `official.py`). Each inspection shows the official score (100 minus violation points, 902 KAR 45:005) and Louisville's own A/B/C grade
  only where it gave one, verbatim and dated ("Score 97, grade A"); never recomputed. Jefferson County places with an on-premises ABC
  license say "Serves alcohol"; elsewhere it's unknown, never "no". Every other place links its county's table on the statewide portal
  (`Links.countyInspections`, `explore.js` countyPortal; Fayette is COUNTY=34). The portal's CSV export and Kentucky ABC's BELLE lookup
  post no terms: **Nick's call**, not used.
- **No Google data at all:** `listings.py` and `kentucky.py` run without the UCSD snapshot (none downloaded).
- **ZIPs** 400xx-427xx (the Virginia range leaked in the port and once marked 17,675 listings junk: fixed in `listings.py` and `kentucky.py`).
- **One region** ("Kentucky", one detail file, as the prompt asks); the site groups lists by county.
- **Guides** (tags in `kentucky.py` TAGS; bits 1..32): hotbrown 9, classics 6, bourbon 8, nky 9, inns 4, oldest 2 (Old Talbott Tavern
  1779, Beaumont Inn 1919). Honors: James Beard only (no MICHELIN Guide covers Kentucky): Beaumont Inn (America's Classics 2015),
  MeeshMeesh, freight house, The Baker's Table, Watch Hill Proper, Holly Hill Inn. Lexington has no hand-checked place yet (LEADS.md).
- **Venues:** SDF/CVG/LEX terminals (600 / 2939 / 4000 Terminal Dr and boxes), KFC Yum! Center, Rupp Arena, Kroger Field, Churchill
  Downs, the Expo Center, Fort Knox, Fort Campbell, the prisons. Adult clubs removed by name and Overture category (3).

## Rebuild
```bash
cd pipeline
../.venv/bin/python fetch_overture.py && ../.venv/bin/python fetch_extras.py && ../.venv/bin/python fetch_official.py
../.venv/bin/python geocode_official.py && ../.venv/bin/python geocode_census.py && ../.venv/bin/python listings.py
../.venv/bin/python calibrate.py && ../.venv/bin/python kentucky.py && ../.venv/bin/python build_research.py && ../.venv/bin/python kentucky.py
KY_APP=1 ../.venv/bin/python kentucky.py && cd .. && cp data/app/places.json data/app/detail-*.json KentuckyEats/Resources/
.venv/bin/python pipeline/check_websites.py && .venv/bin/python pipeline/check_websites.py --retry-transient   # then re-export
.venv/bin/python scripts/make-site.py && .venv/bin/python scripts/publish_app_data.py && .venv/bin/python scripts/publish_app_data.py --check
.venv/bin/python scripts/qa-site.py --static
```
The `.venv` is a copy of va-eats' (python.org framework 3.12). Run `xcodegen generate` when the set of `Resources/*.json` changes.

## App, site, screenshots
- App: `KentuckyEats/` (bundle `com.kentuckyeats.ios`), tests in `KentuckyEatsTests/` (fixture, Louisville results, county portal
  links, outline with the Kentucky Bend, bundled-data guards) and `KentuckyEatsUITests/`. Archive only with Xcode 1.app (27.2, 27B52).
- Site: `scripts/make-site.py` (17 pages; nickstrom5.github.io/kentucky-eats until a CNAME exists), `scripts/explore.js`, `scripts/qa-site.py`.
- Screenshots: `scripts/capture-screenshots.sh` (ScreenshotMode: downtown Louisville; Owensboro, Bardstown, Covington per guide; detail =
  Beaumont Inn), then `scripts/site-images.sh`, `scripts/appstore-screenshots.py`. Icons: `scripts/icon-concepts.swift`, `make-brand.swift`.

## Status (2026-11-06, ready to publish; nothing public)
- Pipeline: app 9,075 places / 8,678 restaurants in 383 towns; research 37/37 matched; websites link-checked. Official: Louisville Metro
  Open Data (PDDL): inspections through 2026-10-29 shown verbatim ("Score 97, grade A") on about 1,700 places, only inside Jefferson
  County (official.py `_in_jefferson()`); Louisville ABC licenses mark "Serves alcohol". Zero-width characters stripped from websites.
- Tests (Xcode 1.app, iOS 27.0): unit 50/50 on iPhone 17 Pro Max and iPad Pro 13" M5 (after the rebuild; ShareLinkTests reads
  docs/data/ids.json, so run make-site.py before the unit tests); UI 6 on iPhone (1 skipped) and 6/6 on iPad (before the rebuild).
- Site: 17 pages, `qa-site.py --static` OK; OTA 2026-11-06.2 `--check` OK (local only). Screens: docs/screenshots (12), App Store frames
  playbook/app-store/iphone (8) and ipad (6) (captured before the 4-place Louisville fix; the iPad home says 8,659 restaurants, now 8,678).
  Icon A passes check.swift. `playbook/app-store/listing.json` (support/privacy URLs on nickstrom5.github.io/kentucky-eats/, 404 until
  Pages is on).
- **Nick decides:** name, icon and palette (playbook/05-naming.md); the statewide CDP inspection portal's bulk export (all 120
  counties); the repo, Pages, App Store Connect record and upload.

## Rules
No commits, pushes, public repos, App Store Connect or DNS changes without Nick's yes each time; never submit for review or accept
agreements; never publish Google-derived data. Support email nick@eatsranked.com. Commit author "Nick Soderstrom"
<329204362+nickstrom5@users.noreply.github.com> via `-c user.name -c user.email`.
