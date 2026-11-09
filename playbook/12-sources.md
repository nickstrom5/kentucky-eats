# Kentucky sources (checked 2026-11-06)

## Official data used
- **Louisville Metro Open Data** (services1.arcgis.com/79kfd2K6fskCAkyg, owner LouisvilleMetro; terms: louisville-metro-opendata-lojic
  .hub.arcgis.com/pages/terms-of-use-and-license, **Open Data Commons PDDL**, public domain; an app must "explicitly identify the source,
  version, and modifications", done on the About screen and the site's terms):
  - Environmental Health Bulk Data - Establishments (d64d4748…): 8,509 active rows (2,662 FOOD SERVICE, 2,481 temporary, pools,
    schools, day cares, tattoo studios…); 61% carry a point, the rest are placed on Overture address points.
  - Environmental Health Bulk Data - Inspections (6b7d6488…): 101,789 rows, 2021-11-01 to 2026-10-30, daily. Used: REGULAR, FOLLOWUP and
    COMPLAINT inspections with a score (OTHER, OFFICE, FIELD, SURVEY and ENFORCEMENT ACTIONS left out). GradeID A/B/C on about 37,000
    rows, almost all regular inspections; the grade isn't a function of the score (C's at 95+), so both are shown verbatim, per
    inspection, as "Score 97, grade A" or "Score 95". 1,489 app restaurants show a result (inspections through 2026-10-30).
  - ABC Licenses (f17c7ab0…): 1,650 rows (1,536 active); on-premises categories (Restaurant / Cafe, Bar, Private Club, Hotels…) mark
    "Serves alcohol" for 347 app restaurants; package-only licenses (liquor stores, groceries) hide store-only listings.
- **Kentucky's food code** (902 KAR 45:005, apps.legislature.ky.gov/law/kar/902/045/005.pdf, read 2026-11-06): Form DFS-208; "The
  rating score of the establishment shall be the total of the point value for all violations subtracted from 100" (Section 6(4));
  under 70 brings a DFS-214 notice of intent to suspend (Section 7(1)).

## Added with Nick's yes (2026-11-07)
- **Statewide inspection portal** (public.cdpehs.com/KYEnvPBL/VW_PUBLIC_EST_INSP/ShowVW_PUBLIC_EST_INSPTable.aspx?COUNTY=n, Custom Data
  Processing for the local and district health departments; robots.txt answers 404, no posted terms): `pipeline/fetch_cdp.py` presses
  each county table's own "Export to CSV" button, one county at a time with a 3-second pause, a generic client name (EatsRankedData/1.0),
  no email; Jefferson (56) is skipped (Louisville's open data). Columns: name, address, city, last inspection date and score, follow-up
  date and score. Shown as published ("Score 92", dated), no grade (the portal gives none); the rows carry no establishment type, so
  they only attach to listings they match (official.py `load_cdp`, kind "inspected"). Each place outside Jefferson links its county's
  table; a Jefferson place links Louisville Metro's food safety page. Rebuilt 2026-11-07: 4,696 places outside Jefferson show the
  portal's latest score (through 2026-11-06), 1,571 in Jefferson show Louisville's (through 2026-10-29).
- **Kentucky ABC BELLE** license lookup (abcportal.ky.gov/BelleExternal/LicenseLookup/LicenseDetails; robots.txt 404; no posted terms):
  its "Export to Excel" fails on the State's side (an EPPlus assembly error, 2026-11-07), so `pipeline/fetch_abc_belle.py` reads the
  grid's own data call (GetGridData) by license type, 200 rows a page, 3 seconds apart: NQ1, NQ2, NQ3 and NQ4 retail drink, LD quota
  retail drink, LR limited restaurant (5,667 active licenses, 2026-11-07). Kept: DBA name and premises only, never the licensee's name.
  On-premises drink licenses mark "Serves alcohol" statewide (official.py `load_kyabc`): 1,551 places (1,340 from Kentucky ABC, 211
  from Louisville Metro's list).
- **Lexington-Fayette (LFCHD)** green/red placards: name-by-name lookup only; no color shown.

## Research sources (robots-checked with pipeline/check_sources.py)
kentuckytourism.com (8 iconic dishes; Bardstown guide; 2026-03-04 Bardstown article), gotolouisville.com (Hot Brown blog 2026-04-17),
wuky.org (Frankfort Hot Brown Trail 2025-04-23), visitowensboro.com (listings), meetnky.com/restaurants, tastingtable.com (oldest
restaurant 2025-09-23, oldest bar 2025-02-17), jamesbeard.org (2025-26 semifinalists and nominees; 2015 America's Classics: Beaumont
Inn). brownhotel.com answers 403 (not cited). Leads waiting for a 2025-26 source: data/research/app/LEADS.md (Lexington's Hot Brown
trail is a 2023 Herald-Leader list; Winchester's beer cheese trail pages are 2018/2022; Western Kentucky BBQ beyond Owensboro; goetta).

## Map data and calibration
- Overture 2026-10-21.0: 17,967 eating/drinking listings in Kentucky; 120 counties; border checks pass (the Kentucky Bend in; Cincinnati,
  Jeffersonville, Evansville, Clarksville, Huntington out). No Google 2021 snapshot is read at all.
- App (2026-11-07 rebuild): 10,299 places, 9,841 restaurants (Census CBP 2023: 7,857 NAICS 722 establishments). Keep rule: the family's (Meta 0.95, or 0.90
  with a website, or a brand feed), plus Louisville's permitted restaurants (1,869 places on an official list, 475 added from it).
