// Kentucky Eats web app: the iPhone app's guides, search, filters, map and place details, in the browser.
// Keep its guide rules in step with KentuckyEats/Models/Guide.swift and its search with KentuckyEats/Models/Search.swift.
// Same data as the app, split by scripts/make-site.py into data/core.json (list, search and map columns), data/ids.json (each place's
// stable id, fetched at the first tap, key, scroll or hover, so a visit that only looks doesn't download it; saved places and #p= links
// wait for it) and data/detail-<county>.json (phones, websites, notes, and county records or inspection results where a state has them), fetched per
// county when a place there is opened. Every data file carries the version of the core.json it was built with (core.json "ver",
// detail "_v", ids "v"): files from another build are fetched again, and never mixed in, because ids and details are keyed by row. No cookies, no trackers; saved places and the last guide live in this browser's localStorage only
// (keys start with kyeats-: other state sites share the nickstrom5.github.io origin).
// The page runs under a strict Content-Security-Policy (hash-pinned inline script and style): never add inline event handlers or
// inline style attributes to the HTML built here; set properties from code instead.
(() => {
  "use strict";
  const BASE = document.documentElement.dataset.base || "";
  const $ = (s) => document.querySelector(s);
  // every value that goes into innerHTML passes through esc(), numbers included (the data file is trusted, but not that much)
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const own = (o, k) => typeof k === "string" && Object.prototype.hasOwnProperty.call(o, k);   // Object.hasOwn, for older Safari too
  const PREFIX = "kyeats-";
  const store = {
    get(k, d) { try { const v = localStorage.getItem(PREFIX + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch { /* private mode */ } },
  };
  // only http(s) links leave the page; bare hosts ("example.com/menu") get https://
  const safeUrl = (u) => {
    u = String(u ?? "").trim();
    if (/^https?:\/\/[^\s"'<>\\]+$/i.test(u)) return u;
    if (/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}(?:[/?#][^\s"'<>\\]*)?$/i.test(u)) return "https://" + u;
    return null;
  };
  const num = (x) => (x == null || x === "" || !Number.isFinite(Number(x)) ? null : Number(x));
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmtDate = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s ?? "")); return m ? `${MONTHS[+m[2] - 1]} ${+m[3]}, ${m[1]}` : String(s ?? ""); };
  // Kentucky's health departments score inspections out of 100; Louisville Metro's results come from its open data, the rest are on the
  // statewide public portal (Custom Data Processing), one table per county, numbered alphabetically (Adair 1, Fayette 34): linked from each place.
  const DPH_URL = "https://public.cdpehs.com/KYEnvPBL/VW_PUBLIC_EST_INSP/ShowVW_PUBLIC_EST_INSPTable.aspx";
  const LOU_URL = "https://louisvilleky.gov/government/health-wellness/food-safety";
  const PORTAL_COUNTIES = ["Adair County", "Allen County", "Anderson County", "Ballard County", "Barren County", "Bath County", "Bell County", "Boone County", "Bourbon County", "Boyd County", "Boyle County", "Bracken County", "Breathitt County", "Breckinridge County", "Bullitt County", "Butler County", "Caldwell County", "Calloway County", "Campbell County", "Carlisle County", "Carroll County", "Carter County", "Casey County", "Christian County", "Clark County", "Clay County", "Clinton County", "Crittenden County", "Cumberland County", "Daviess County", "Edmonson County", "Elliott County", "Estill County", "Fayette County", "Fleming County", "Floyd County", "Franklin County", "Fulton County", "Gallatin County", "Garrard County", "Grant County", "Graves County", "Grayson County", "Green County", "Greenup County", "Hancock County", "Hardin County", "Harlan County", "Harrison County", "Hart County", "Henderson County", "Henry County", "Hickman County", "Hopkins County", "Jackson County", "Jefferson County", "Jessamine County", "Johnson County", "Kenton County", "Knott County", "Knox County", "Larue County", "Laurel County", "Lawrence County", "Lee County", "Leslie County", "Letcher County", "Lewis County", "Lincoln County", "Livingston County", "Logan County", "Lyon County", "Madison County", "Magoffin County", "Marion County", "Marshall County", "Martin County", "Mason County", "McCracken County", "McCreary County", "McLean County", "Meade County", "Menifee County", "Mercer County", "Metcalfe County", "Monroe County", "Montgomery County", "Morgan County", "Muhlenberg County", "Nelson County", "Nicholas County", "Ohio County", "Oldham County", "Owen County", "Owsley County", "Pendleton County", "Perry County", "Pike County", "Powell County", "Pulaski County", "Robertson County", "Rockcastle County", "Rowan County", "Russell County", "Scott County", "Shelby County", "Simpson County", "Spencer County", "Taylor County", "Todd County", "Trigg County", "Trimble County", "Union County", "Warren County", "Washington County", "Wayne County", "Webster County", "Whitley County", "Wolfe County", "Woodford County"];
  const countyPortal = (c) => { const i = PORTAL_COUNTIES.indexOf(c); return i >= 0 ? `${DPH_URL}?COUNTY=${i + 1}` : DPH_URL; };

  // ---------------------------------------------------------------- search (a port of KentuckyEats/Models/Search.swift)
  // pikes are street types too, and "state st" is a street, not the state
  const typeSyn = { avenue: "ave", av: "ave", street: "st", boulevard: "blvd", road: "rd", drive: "dr", place: "pl", court: "ct",
    parkway: "pkwy", highway: "hwy", lane: "ln", trail: "trl", circle: "cir", terrace: "ter", pike: "pike", pk: "pike", pke: "pike" };
  // directions and road names: "north main" finds "N Main St", "interstate 40" finds "I-40"
  const syn = { ...typeSyn, north: "n", south: "s", east: "e", west: "w", northwest: "nw", northeast: "ne", southwest: "sw", southeast: "se",
    saint: "st", mount: "mt", fort: "ft", interstate: "i", ih: "i", freeway: "fwy", expressway: "expy" };
  const abbrs = new Set(Object.values(syn)), typeAbbrs = new Set(Object.values(typeSyn));
  const DIRS = new Set(["n", "s", "e", "w", "ne", "nw", "se", "sw"]);
  // the bit order is pipeline/kentucky.py's TAGS
  const HOTBROWN = 1, CLASSICS = 2, BOURBON = 4, NKY = 8, INNS = 16, OLDEST = 32;
  // a dish ("banh mi", "cheesy western") is not a tag: it's in each hand-checked place's search text, so it finds the places serving it
  const tagPhrases = [["hot browns", HOTBROWN], ["hot brown", HOTBROWN], ["kentucky classics", CLASSICS], ["bourbon country", BOURBON],
    ["historic inns", INNS], ["historic inn", INNS]];
  // letters with no accent to strip (NFD keeps them): "pho tay do" must find Phở Tây Đô (Ohio's 2026-10-24 fix)
  const UNACCENTED = { "ø": "o", "æ": "ae", "œ": "oe", "đ": "d", "ł": "l", "ß": "ss", "þ": "th", "ı": "i" };
  function normalize(s) {
    let t = String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[øæœđłßþı]/g, (c) => UNACCENTED[c]);
    // initials keep together, so "jr crickets" finds J.R. Crickets (St. and E. Main St stay as they are)
    t = t.replace(/\b([a-z])\.(?=[a-z]\b)/g, "$1");
    t = t.replace(/\b([a-z0-9])\s*&\s*([a-z0-9])\b/g, "$1$2").replace(/&/g, " and ").replace(/['’`]/g, "");
    return t.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  }
  const normAddr = (s) => normalize(s).split(" ").map((w) => (own(syn, w) ? syn[w] : w)).join(" ");

  function parse(text) {
    const q = { tokens: [], town: null, townPhrase: null, tag: 0, tagPhrase: null, tagStem: null, townNeedle: null, streetNeedle: null };
    let raw = normalize(text).split(" ").filter(Boolean);
    if (!raw.length) return q;
    let mapped = raw.map((w) => (own(syn, w) ? syn[w] : w));
    const find = (phrase) => {
      const p = phrase.split(" ");
      for (let i = 0; i + p.length <= mapped.length; i++) if (p.every((w, k) => mapped[i + k] === w)) return [i, i + p.length];
      return null;
    };
    const cut = ([a, b]) => { const words = raw.slice(a, b).join(" "); raw.splice(a, b - a); mapped.splice(a, b - a); return words; };
    for (const [phrase, tag] of tagPhrases) { const r = find(normalize(phrase)); if (r) { q.tag = tag; q.tagPhrase = cut(r); break; } }
    if (q.tagPhrase) { const stem = normalize(q.tagPhrase).replace(/s$/, ""); q.tagStem = stem ? " " + stem : null; }
    // the longest town named in the query wins, unless a street type follows it ("houston st" is a street)
    for (const key of TOWN_KEYS_BY_LENGTH) {
      const r = find(key);
      if (r && !(r[1] < mapped.length && typeAbbrs.has(mapped[r[1]]))) {
        // a direction word right before the town ("north shreveport") may mean the street as well as the town
        if (r[0] > 0 && DIRS.has(mapped[r[0] - 1])) q.streetNeedle = " " + mapped.slice(r[0] - 1, r[1]).join(" ") + " ";
        q.town = TOWN_KEYS[key]; q.townPhrase = cut(r); q.townNeedle = " " + normalize(q.townPhrase); break;
      }
    }
    const stop = new Set(["the", "and", "of", "a", "in", "near", "me"]);   // "barbecue near me" isn't a place named "Me"
    let idx = raw.map((_, i) => i);
    // stop words stay only when they're all there is ("the"); next to a guide or a town ("lemon pepper near me") they go
    if (q.tag || q.town || idx.some((i) => !stop.has(mapped[i]))) idx = idx.filter((i) => !stop.has(mapped[i]));
    idx.forEach((i, n) => {
      const token = raw[i], isLast = n === idx.length - 1;
      if (own(syn, token)) { q.tokens.push([` ${syn[token]} `, ` ${token}`]); return; }
      const whole = (abbrs.has(token) && (!isLast || token.length > 1)) || (token.length <= 2 && !isLast);
      const needles = [" " + token + (whole ? " " : "")];
      if (isLast && token.length >= 3) for (const [word, abbr] of Object.entries(typeSyn)) if (word !== token && word.startsWith(token)) needles.push(` ${abbr} `);
      q.tokens.push(needles);
    });
    // "brady st": a finished street type sticks to the word before it
    if (q.tokens.length >= 2 && idx.length && typeAbbrs.has(mapped[idx[idx.length - 1]])) {
      const last = idx[idx.length - 1], prev = idx[idx.length - 2];
      q.tokens.splice(-2, 2, [` ${mapped[prev]} ${mapped[last]} `, ` ${raw[prev]} ${raw[last]}`]);
    }
    return q;
  }
  const qEmpty = (q) => !q.tokens.length && !q.town && !q.tag;
  function matches(p, q) {
    if (q.tag && !(p.g & q.tag)) { if (!q.tagStem || !p.nameText.includes(q.tagStem)) return false; }
    if (q.town && p.c !== q.town) {
      if (!(q.townNeedle && p.nameText.includes(q.townNeedle)) && !(q.streetNeedle && p.search.includes(q.streetNeedle))) return false;
    }
    return q.tokens.every((needles) => needles.some((n) => p.search.includes(n)));
  }
  const nameMatches = (p, q) => q.tokens.length && q.tokens.every((needles) => needles.some((n) => p.nameText.includes(n)));

  // ---------------------------------------------------------------- guides (KentuckyEats/Models/Guide.swift)
  const hcTag = (t) => (p) => p.hc && Boolean(p.g & t);
  const HC_SORTS = ["featured", "nearest", "name"];
  const GUIDES = {
    hotbrown: { title: "Hot Browns", sub: "Hand-checked Hot Browns, from the Brown Hotel to Frankfort", inc: hcTag(HOTBROWN), sorts: HC_SORTS },
    classics: { title: "Kentucky Classics", sub: "Hand-checked burgoo, mutton, beer cheese, rolled oysters and spoonbread", inc: hcTag(CLASSICS), sorts: HC_SORTS },
    bourbon: { title: "Bardstown & Bourbon Country", sub: "Hand-checked tables in Bardstown, the bourbon capital", inc: hcTag(BOURBON), sorts: HC_SORTS },
    nky: { title: "Covington & Newport", sub: "Hand-checked goetta, German beer halls and river-town dining", inc: hcTag(NKY), sorts: HC_SORTS },
    inns: { title: "Historic Inns & Taverns", sub: "Hand-checked inns and taverns, from 1779 to the Beaumont Inn", inc: hcTag(INNS), sorts: HC_SORTS },
    honors: { title: "James Beard Honors", sub: "James Beard Foundation honorees", inc: (p) => p.mi > 0 || p.jb, sorts: ["iconic", "nearest"] },
    oldest: { title: "Oldest Places", sub: "Founding years checked at the same address, oldest first", inc: (p) => p.f != null && p.hc && Boolean(p.g & OLDEST), sorts: ["oldest"], ranked: true },
    all: { title: "All Restaurants", sub: "Restaurants, cafés, bars and bakeries statewide", inc: () => true, sorts: ["name", "nearest"] },
    saved: { title: "Saved", sub: "Places you saved in this browser", inc: (p) => saved.has(p.id), sorts: ["name", "nearest"] },
  };
  const HC_GUIDES = ["hotbrown", "classics", "bourbon", "nky", "inns"];
  const SORT_LABEL = { featured: "Featured first", nearest: "Nearest", oldest: "Oldest first", name: "A to Z", iconic: "James Beard honors first" };
  const MI = ["", "MICHELIN Recommended", "Bib Gourmand", "1 MICHELIN Star", "2 MICHELIN Stars", "3 MICHELIN Stars"];
  const CHIP = [[HOTBROWN, "Hot Brown"], [CLASSICS, "Kentucky classic"], [BOURBON, "Bourbon country"], [NKY, "Covington & Newport"],
    [INNS, "Historic inn"]];

  // ---------------------------------------------------------------- state
  let P = [], CAL = {}, TOWN_KEYS = {}, TOWN_KEYS_BY_LENGTH = [], GENERATED = "", META = {};
  let here = null, shown = 100, current = [], view = "list";
  const savedRaw = store.get("saved", []);
  const saved = new Set(Array.isArray(savedRaw) ? savedRaw.filter((x) => typeof x === "string" && x.length < 64) : []);
  const st = { g: "hotbrown", q: "", sort: "", town: "", cuisine: "", chains: false, bib: false, p: "" };
  let bibCount = 0;   // Bib Gourmand places (non-restaurants left out): the box shows only when there are some

  const miles = (a, b) => {
    const r = Math.PI / 180, dLa = (b.la - a.la) * r, dLo = (b.lo - a.lo) * r;
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.la * r) * Math.cos(b.la * r) * Math.sin(dLo / 2) ** 2;
    return 3958.8 * 2 * Math.asin(Math.sqrt(h));
  };
  const milesText = (m) => (m < 10 ? m.toFixed(1) : Math.round(m)) + " mi";

  function order() {
    const g = GUIDES[st.g];
    let o = st.sort && g.sorts.includes(st.sort) ? st.sort : HC_GUIDES.includes(st.g) && here ? "nearest" : g.sorts[0];
    if (o === "nearest" && !here) o = g.sorts.find((s) => s !== "nearest") || o;   // no location yet: say what the list is really sorted by
    return o;
  }

  function allows(p) {
    if (st.town && p.c !== st.town) return false;
    if (st.cuisine && p.cu !== st.cuisine) return false;
    if (st.chains && p.ch >= 5) return false;
    if (st.bib && p.mi !== 2) return false;      // MICHELIN Bib Gourmand only, as the app's Filters switch
    return true;
  }

  function list() {
    const g = GUIDES[st.g], q = parse(st.q), o = order();
    if (qEmpty(q) && st.q.trim()) return [];   // typed something, but nothing searchable ("🍕", "!!!")
    let out = P.filter((p) => g.inc(p) && allows(p) && (qEmpty(q) || matches(p, q)));
    const byName = (a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.i - b.i);
    if (o === "nearest" && here) {
      const dist = new Map(out.map((p) => [p, p.la != null ? miles(here, p) : Infinity]));
      out.sort((a, b) => dist.get(a) - dist.get(b) || byName(a, b));
    }
    else if (o === "featured") out.sort((a, b) => (b.ip ?? -1) - (a.ip ?? -1) || (a.f ?? 9999) - (b.f ?? 9999) || byName(a, b));
    else if (o === "oldest") out.sort((a, b) => (a.f ?? 9999) - (b.f ?? 9999) || byName(a, b));
    else if (o === "iconic") {   // MICHELIN distinction, then the James Beard honor, then name (the app's order)
      const jb = (p) => (p.h & 1 ? 4 : p.h & 2 ? 3 : p.h & 4 ? 2 : p.h & 8 ? 1 : 0);
      out.sort((a, b) => (b.mi || 0) - (a.mi || 0) || jb(b) - jb(a) || byName(a, b));
    }
    else out.sort(byName);
    if (q.tokens.length && !g.ranked) {       // name matches first when searching
      const named = out.filter((p) => nameMatches(p, q));
      if (named.length && named.length < out.length) { const ids = new Set(named); out = named.concat(out.filter((p) => !ids.has(p))); }
    }
    return out;
  }

  // ---------------------------------------------------------------- rendering
  const jbLabel = (p) => (p.h & 1 ? "America's Classic" : p.h & 2 ? "James Beard winner" : p.h & 4 ? "James Beard finalist" : p.h & 8 ? "James Beard semifinalist" : p.jb ? "James Beard (restaurateur)" : null);
  function chips(p, max) {
    const c = [];
    if (p.mi && MI[p.mi]) c.push(`<span class="tag tag-mi">${esc(MI[p.mi])}</span>`);
    const jb = jbLabel(p);
    if (jb) c.push(`<span class="tag tag-jb">${esc(jb)}</span>`);
    if (p.hc) for (const [t, label] of CHIP) if (p.g & t) c.push(`<span class="tag">${label}</span>`);
    if (p.hc && p.g & OLDEST && p.f) c.push(`<span class="tag tag-plain">Since ${esc(p.f)}</span>`);
    if (p.ch >= 5) c.push(`<span class="tag tag-plain">Chain · ${esc(p.ch)}</span>`);
    if (p.t === 0 && !p.h && !p.mi && !p.hc) c.push('<span class="tag tag-dash">Listing only</span>');
    return (max ? c.slice(0, max) : c).join("");
  }

  function metric(p, o) {
    if (o === "nearest" && here && p.la != null) return [milesText(miles(here, p)), "away"];
    if (p.f && st.g !== "all") return [String(p.f), "since"];
    return null;
  }

  function render() {
    const g = GUIDES[st.g], o = order();
    if (st.g === "saved" && !idsReady) loadIds().then(() => { if (st.g === "saved") render(); });
    current = list();
    document.querySelectorAll(".ex-guides button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.g === st.g)));
    $("#ex-sub").textContent = g.sub;
    const sortSel = $("#ex-sort");
    sortSel.innerHTML = g.sorts.map((s) => `<option value="${esc(s)}"${s === o ? " selected" : ""}>${esc(SORT_LABEL[s])}</option>`).join("");
    sortSel.disabled = g.sorts.length < 2;
    const filters = [st.town && `in ${st.town}`, st.cuisine && st.cuisine, st.chains && "no chains", st.bib && "Bib Gourmand"].filter(Boolean);
    $("#ex-count").textContent = `${current.length.toLocaleString()} ${current.length === 1 ? "place" : "places"} · ${SORT_LABEL[o]}` + (filters.length ? ` · ${filters.join(", ")}` : "");
    $("#ex-clear").hidden = !filters.length;
    // Near me stays: each tap asks for a fresh fix (people move), and it's how to retry after a timeout
    if (view === "list") renderList(o); else drawMap();
    saveHash();
  }

  // typing searches only the open guide (the page opens on Lemon Pepper Wings): when that finds little, the same words across every
  // restaurant, with the same filters, so a famous place outside the guide isn't a dead end
  const FEW = 5;
  function elsewhereCount() {
    const q = parse(st.q);
    if (st.g === "all" || qEmpty(q) || current.length >= FEW) return 0;
    let n = 0;
    for (const p of P) if (allows(p) && matches(p, q)) n++;
    return n > current.length ? n : 0;
  }
  const allButton = (n) => `<button type="button" class="ex-small" id="ex-all">Search all restaurants (${esc(n.toLocaleString())} ${n === 1 ? "match" : "matches"})</button>`;
  function wireAll() {
    const b = $("#ex-all");
    if (b) b.onclick = () => { st.g = "all"; st.sort = ""; shown = 100; render(); const r = $(".ex-row"); if (r) r.focus(); };
  }

  function renderList(o) {
    const ol = $("#ex-list");
    const g = GUIDES[st.g];
    const elsewhere = elsewhereCount();
    if (!current.length) {
      ol.innerHTML = `<li class="ex-empty">${st.g === "saved" && !idsReady ? "Loading your saved places…" : st.g === "saved" && idsFailed && saved.size ? "Your saved places couldn't load: you may be offline, or the site was just updated. Reload the page to try again." : elsewhere ? `Nothing in ${esc(g.title)} matches that. ${allButton(elsewhere)}` : st.g === "saved" ? "Nothing saved yet. Open a place and tap Save to keep it here, in this browser." : "No places match. Try fewer words or clear the filters."}</li>`;
      wireAll();
      $("#ex-more").hidden = true;
      return;
    }
    ol.innerHTML = current.slice(0, shown).map((p, i) => {
      const m = metric(p, o);
      const rank = g.ranked ? `<span class="ex-rank${i < 3 ? " top" : ""}" aria-label="Rank ${i + 1}">${i + 1}</span>` : "";
      const where = [p.c, p.cu].filter(Boolean).join(" · ");
      const big = m ? `<b>${esc(m[0])}</b>` : "";
      return `<li><button class="ex-row" data-i="${esc(p.i)}">${rank}<span class="ex-main"><b>${esc(p.n)}</b><span class="ex-town">${esc(where)}</span><span class="ex-chips">${chips(p, 4)}</span></span>${m ? `<span class="ex-metric">${big}<small>${esc(m[1])}</small></span>` : ""}</button></li>`;
    }).join("") + (elsewhere ? `<li class="ex-empty">Only ${esc(current.length)} in ${esc(g.title)}. ${allButton(elsewhere)}</li>` : "");
    wireAll();
    const left = current.length - shown;
    $("#ex-more").hidden = left <= 0;
    $("#ex-more").textContent = `Show more (${left.toLocaleString()} left)`;
  }

  // ---------------------------------------------------------------- place panel
  const TIER = { 2: "On an official list", 1: "High-confidence listing", 0: "Listing only" };   // "High-confidence", not "confirmed" (Nick, 2026-10-13)

  // the state's alcohol licenses are the only statewide official list, and only places serving alcohol hold one, so its match rates are a
  // floor for comparing kinds of listings, not a rate to quote per place (the app shows none either)
  function howWeKnow(p) {
    const src = SOURCES[p.s] || "meta";
    if (src === "research") return "On our hand-checked list (checked against a 2025 or 2026 source). The open map data didn't list it as a place to eat, so it's placed from its own map listing or street address.";
    if (p.t === 2) return src === "official"
      ? "From the state's alcohol license list. The open map data didn't have it, so it's placed on its licensed street address."
      : "Matched to an active state alcohol license.";
    return (p.t === 1 ? "A high-confidence listing in Overture's open map data." : "A single listing in Overture's open map data, so it may be closed or misfiled.")
      + (p.hc ? " It's also on our hand-checked list, checked against a 2025 or 2026 source." : "");
  }

  const kv = (k, v) => (v == null || v === "" ? "" : `<div class="ex-kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>`);
  const section = (t, body) => `<section class="ex-sec"><h3>${esc(t)}</h3>${body}</section>`;
  let listAtPush = null;   // the list's URL state when a place was opened with pushState (Back then closes the panel)

  // the open place is a modal dialog at every width (a bottom sheet on phones, a side sheet on wider screens, which would otherwise
  // cover Near me and the List/Map buttons): everything behind it is inert, and a click on the dimmed backdrop closes it
  function panelMode() {
    const panel = $("#ex-panel"), modal = !panel.hidden;
    if (modal) { panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); }
    else { panel.removeAttribute("role"); panel.removeAttribute("aria-modal"); }
    $("#ex-backdrop").hidden = !modal;
    const behind = [...document.querySelectorAll("body > .skip, .wrap > header, .wrap > nav, .wrap > footer, #main > *")].filter((el) => el !== panel && el.id !== "ex-backdrop");
    behind.forEach((el) => { el.inert = modal; });
  }

  // the latest official result as published and dated: Louisville Metro's score and its own grade where it gave one, or elsewhere the
  // county's score from the statewide portal (no grade there); the link goes to Louisville's page or the county's portal table
  // Jefferson County's results come from Louisville Metro's open data (the portal's Jefferson table is never read)
  const portalLink = (p) => p.county === "Jefferson County"
    ? `<p><a href="${LOU_URL}" rel="noopener" target="_blank">Louisville Metro's food safety page</a></p>`
    : `<p><a href="${countyPortal(p.county)}" rel="noopener" target="_blank">${esc(p.county ? p.county + " scores on the state portal" : "Kentucky's inspection portal")}</a></p>`;
  const inspectionSection = (d, p) => section("Health inspections", Array.isArray(d.ins) && d.ins.length >= 2
    ? kv("Latest inspection", `${d.ins[0]} · ${fmtDate(d.ins[1])}`)
      + (String(d.ins[2] || "").startsWith("Louisville")
        ? `<p class="ex-fine">Official results from Louisville Metro Public Health and Wellness's open data: the score is 100 minus the violation points under Kentucky's food code, and the letter is Louisville's own grade, shown only where it gave one. This site computes no grade, and an older result may not reflect the place today.</p><p><a href="${LOU_URL}" rel="noopener" target="_blank">Louisville Metro's food safety page</a></p>`
        : `<p class="ex-fine">Official results from Kentucky's public inspection portal, posted by the county health department: the last inspection's score, 100 minus the violation points under Kentucky's food code, shown as published. This site computes no grade, and an older result may not reflect the place today.</p>` + portalLink(p))
    : `<p class="ex-fine">Kentucky's health departments post their inspection scores on the state's public inspection portal (Louisville Metro in its open data). No score in them was matched to this place, so none is shown, and this site computes no grade.</p>` + portalLink(p));

  function openPlace(p, push = true) {
    const panel = $("#ex-panel");
    const wasOpen = !panel.hidden;
    // the place opens at once; its id (for Save, the #p= link and the Back step) follows when ids.json arrives, which the first tap
    // only starts, so a tap never waits on it. If ids.json can't load (offline, or a build changed under us), the place stays open
    // without Save and without a link.
    const waiting = p.id == null && !idsReady;
    if (waiting && (push || !wasOpen)) loadIds().then(() => { if (!panel.hidden && panel.dataset.i === String(p.i)) openPlace(p, push); });
    const noId = p.id == null, pid = p.id ?? "";
    // a re-render (the county's details just arrived) replaces the panel's buttons: remember where keyboard focus was, to put it back
    const focused = wasOpen && panel.contains(document.activeElement) ? document.activeElement : null;
    const refocus = focused && (focused.id ? `#${focused.id}` : focused.textContent.trim());
    st.p = pid;
    const loaded = DETAIL_LOADED.has(p.co), failed = DETAIL_FAILED.has(p.co);
    const d = DETAIL.get(p.i) || {};
    const la = num(p.la), lo = num(p.lo);
    const addr = [p.a, [p.c, p.z].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const apple = la != null && lo != null
      ? `https://maps.apple.com/?q=${encodeURIComponent(p.n)}&ll=${la},${lo}`
      : `https://maps.apple.com/?q=${encodeURIComponent(p.n + ", " + addr)}`;
    const dirs = la != null && lo != null ? `https://maps.apple.com/?daddr=${la},${lo}&dirflg=d` : apple;
    const site = safeUrl(d.w);
    const tel = d.ph ? String(d.ph).replace(/[^\d+]/g, "") : "";
    let html = `<button class="ex-close" id="ex-close" aria-label="Close">×</button>
      <p class="ex-kicker">${esc([p.c || "Kentucky", p.county && p.county !== "Kentucky" ? p.county : ""].filter(Boolean).join(" · ").toUpperCase())}</p>
      <h2 id="ex-pname">${esc(p.n)}</h2>
      <p class="ex-addr">${esc([addr, p.cu].filter(Boolean).join(" · "))}</p>
      ${here && la != null ? `<p class="ex-dist">${esc(milesText(miles(here, p)))} away</p>` : ""}
      <p class="ex-chips">${chips(p)}</p>
      <div class="ex-actions">
        <a class="btn ex-apple" href="${esc(apple)}" rel="noopener" target="_blank">Ratings, hours &amp; photos · Apple Maps</a>
        <div class="ex-act-row">
          <a href="${esc(dirs)}" rel="noopener" target="_blank">Directions</a>
          ${tel ? `<a href="tel:${esc(tel)}">Call</a>` : ""}
          ${site ? `<a href="${esc(site)}" rel="noopener nofollow" target="_blank">Website</a>` : ""}
          ${waiting ? '<button id="ex-save" aria-pressed="false" disabled>Save</button>' : noId ? "" : `<button id="ex-save" aria-pressed="${saved.has(pid)}">${saved.has(pid) ? "Saved" : "Save"}</button>`}
        </div>
      </div>`;
    if (!loaded) html += `<p class="ex-fine">Loading details…</p>`;
    if (p.hc && (d.note || p.dish || p.f || d.seas)) {
      html += section("Hand-checked", (d.note ? `<p>${esc(d.note)}</p>` : "") + kv("On the menu", p.dish ? String(p.dish).split("; ").join(", ") : "")
        + kv("Open here since", p.f) + (d.fn ? `<p class="ex-fine">${esc(d.fn)}</p>` : "") + kv("Season", d.seas)
        + `<p class="ex-fine">Checked against a 2025 or 2026 source: a dated magazine or news story or an official tourism listing. Menus and hours change, so check before you go.</p>`);
    }
    if (p.mi || d.jbf) {
      const lines = [...(p.mi && MI[p.mi] ? [MI[p.mi]] : []),
        ...(d.jbf ? String(d.jbf).split("; ").map((x) => "James Beard: " + x) : [])];
      html += section("Honors", `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul><p class="ex-fine">Honors are facts, not ratings. MICHELIN and the MICHELIN Guide are trademarks of Michelin; James Beard Foundation and James Beard Award are trademarks of the James Beard Foundation.</p>`);
    }
    if (failed) html += `<p class="ex-fine">This place's details (county records, phone, website) didn't load: you may be offline, or the site was just updated. Reload the page to try again.</p>`;
    else if (loaded) {
      const lic = Array.isArray(d.lic) ? d.lic.filter(Array.isArray) : [];
      html += section("Official records", (lic.length ? lic.map((l) => kv(String(l[0] || "Record"), [l[2], l[1] ? "No. " + l[1] : ""].filter(Boolean).join(" · ") || "On the list")).join("")
          : kv("License record", "—"))
        + kv("Serves alcohol", p.lq ? `Licensed to serve on the premises (${lic.some((l) => String(l[0] || "").startsWith("Louisville Metro ABC")) ? "Louisville Metro ABC" : "Kentucky ABC"})` : "—")
        + `<p class="ex-fine">${lic.length ? `From Louisville Metro's open data (its permitted food establishments and ABC licenses), Kentucky's public inspection portal and Kentucky ABC's statewide license lookup. A record that wasn't matched shows —, which means unknown, never "no".` : `No record in Louisville Metro's open data, Kentucky's public inspection portal or Kentucky ABC's license lookup was matched to this place, so — means unknown, never "no".`}</p>`);
    }
    html += loaded ? inspectionSection(d, p) : "";
    html += section("How we know it's here", kv("Listed as", TIER[p.t])
      + (p.ch >= 2 ? kv("Locations in Kentucky", p.ch.toLocaleString()) : "") + `<p class="ex-fine">${esc(howWeKnow(p))}</p>`);
    const store_url = safeUrl(window.APP_STORE_URL);   // set in the page footer script once the App Store listing exists
    html += store_url
      ? `<p class="ex-app">Save it on your phone: <a href="${esc(store_url)}" rel="noopener">get the free iPhone app</a></p>`
      : `<p class="ex-app">The iPhone app is coming soon. <a href="${BASE}/#download">Ask for early access</a></p>`;
    panel.innerHTML = html;
    panel.dataset.id = pid;
    panel.dataset.i = String(p.i);
    panel.hidden = false;
    document.body.classList.add("ex-open");
    panelMode();
    $("#ex-close").onclick = () => closePlace();
    if (!noId) $("#ex-save").onclick = (e) => {
      if (saved.has(p.id)) saved.delete(p.id); else saved.add(p.id);
      store.set("saved", [...saved]);
      e.target.textContent = saved.has(p.id) ? "Saved" : "Save";
      e.target.setAttribute("aria-pressed", String(saved.has(p.id)));
      if (st.g === "saved") render();
    };
    const samePlace = wasOpen && panel.dataset.shown === String(p.i);   // a re-render: details or the id just arrived
    if (!samePlace) panel.scrollTop = 0;
    panel.dataset.shown = String(p.i);
    if (!samePlace) $("#ex-close").focus();
    else if (refocus) {
      const same = refocus.startsWith("#") ? panel.querySelector(refocus)
        : [...panel.querySelectorAll("a, button")].find((el) => el.textContent.trim() === refocus);
      (same || $("#ex-close")).focus();
    }
    if (push && !noId) {
      if (panel.dataset.pushed) saveHash();   // one Back step per panel, not per place looked at
      else { listAtPush = listHash(); saveHash(true); panel.dataset.pushed = "1"; }
    }
    if (!loaded) loadDetail(p.co).then(() => { if (panel.dataset.i === String(p.i) && !panel.hidden) openPlace(p, false); });
  }

  // fromHistory: the Back button (or a hash link) already moved the URL, so don't touch history again
  function closePlace(fromHistory = false) {
    st.p = "";
    const panel = $("#ex-panel");
    const wasI = panel.dataset.i;   // the row the panel belonged to: focus goes back there
    panel.hidden = true;
    delete panel.dataset.id;
    delete panel.dataset.i;
    delete panel.dataset.shown;
    delete panel.dataset.pushed;
    document.body.classList.remove("ex-open");
    panelMode();
    if (!fromHistory) {
      // the list hasn't changed since the panel opened: step back over the entry openPlace pushed, so Back isn't a dead click
      if (history.state && history.state.kyeats === "place" && listHash() === listAtPush) history.back();
      else saveHash();
    }
    listAtPush = null;
    const row = wasI && document.querySelector(`.ex-row[data-i="${Number(wasI)}"]`);
    if (row) row.focus();
  }

  // ---------------------------------------------------------------- map (canvas: county outlines + a dot per place)
  let SHAPES = null, cam = null;
  // Kentucky's own frame (set per state: a port's leftover numbers once framed the wrong state, QA 2026-11-03)
  const LAT0 = 37.82, KX = Math.cos(LAT0 * Math.PI / 180);
  const proj = (lo, la) => [(lo - (-85.77)) * KX, -(la - LAT0)];

  function fitCam(w, h) {
    const [x0, y0] = proj(-89.58, 39.15), [x1, y1] = proj(-81.96, 36.49);   // the state's west/north and east/south edges
    const k = Math.min(w / (x1 - x0), h / (y1 - y0)) * 0.95;
    return { k, x: (w - (x1 - x0) * k) / 2 - x0 * k, y: (h - (y1 - y0) * k) / 2 - y0 * k };
  }

  // calls f on every ring, however deeply it's nested (the state is [polygon[ring[point]]], each county [ring[point]])
  const eachRing = (g, f) => {
    if (!Array.isArray(g) || !g.length) return;
    if (Array.isArray(g[0]) && typeof g[0][0] === "number") f(g); else g.forEach((x) => eachRing(x, f));
  };

  const classic = (p) => Boolean((p.hc && p.g) || p.mi);
  async function drawMap() {
    const cv = $("#ex-map"), wrap = $("#ex-mapwrap");
    const w = wrap.clientWidth, h = wrap.clientHeight, dpr = window.devicePixelRatio || 1;
    if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    if (!cam) cam = fitCam(w, h);
    if (!SHAPES) SHAPES = await fetchJSON(`${BASE}/data/ky_shapes.json`).catch(() => ({ state: [], counties: [] }));
    const c = cv.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    const X = (lo, la) => { const [x, y] = proj(lo, la); return [x * cam.k + cam.x, y * cam.k + cam.y]; };
    const ring = (r) => { r.forEach(([lo, la], i) => { const [x, y] = X(lo, la); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath(); };
    c.fillStyle = "#f7f3ec";   // the map stays light in dark mode (its frame is light too), so the navy dots keep their contrast
    c.beginPath(); eachRing(SHAPES.state, ring); c.fill("evenodd");
    c.strokeStyle = "rgba(14,26,48,.22)"; c.lineWidth = 0.8;
    for (const co of SHAPES.counties || []) { c.beginPath(); eachRing(co.c, ring); c.stroke(); }
    const pts = current.filter((p) => p.la != null);
    const r = Math.max(2.2, Math.min(5, 1.6 + cam.k / 120));
    // plain places: one batch of small squares (tens of thousands draw fast that way); hand-checked and honored places: dots on top
    c.fillStyle = "#1f3a5f";
    const sq = pts.length > 3000 ? Math.max(1.6, r - 0.6) : r * 1.6;
    for (const p of pts) {
      if (classic(p)) continue;
      const [x, y] = X(p.lo, p.la);
      if (x < -5 || y < -5 || x > w + 5 || y > h + 5) continue;
      if (pts.length > 3000) c.fillRect(x - sq / 2, y - sq / 2, sq, sq);
      else { c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill(); }
    }
    c.fillStyle = "#b0172b"; c.strokeStyle = "#ffffff"; c.lineWidth = 1;
    for (const p of pts) {
      if (!classic(p)) continue;
      const [x, y] = X(p.lo, p.la);
      if (x < -5 || y < -5 || x > w + 5 || y > h + 5) continue;
      c.beginPath(); c.arc(x, y, r + 1, 0, 6.2832); c.fill(); c.stroke();
    }
    $("#ex-maphint").textContent = pts.length ? `${pts.length.toLocaleString()} ${pts.length === 1 ? "place" : "places"} · tap a dot` : "No places to show";
  }

  function nearestDot(px, py) {
    let best = null, bd = 14 * 14;
    for (const p of current) {
      if (p.la == null) continue;
      const [x0, y0] = proj(p.lo, p.la), x = x0 * cam.k + cam.x, y = y0 * cam.k + cam.y;
      const d = (x - px) ** 2 + (y - py) ** 2;
      if (d < bd || (d === bd && classic(p))) { bd = d; best = p; }
    }
    return best;
  }

  function zoomAt(f, px, py) {
    const k = Math.min(Math.max(cam.k * f, 40), 60000);
    const s = k / cam.k;
    cam = { k, x: px - (px - cam.x) * s, y: py - (py - cam.y) * s };
    drawMap();
  }

  function mapEvents() {
    const cv = $("#ex-map");
    const ptrs = new Map();
    let moved = false, pinch0 = null;
    cv.addEventListener("wheel", (e) => { e.preventDefault(); const b = cv.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.25 : 0.8, e.clientX - b.left, e.clientY - b.top); }, { passive: false });
    cv.addEventListener("pointerdown", (e) => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = false; pinch0 = null; });
    cv.addEventListener("pointermove", (e) => {
      if (!ptrs.has(e.pointerId)) return;
      const prev = ptrs.get(e.pointerId);
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const r = cv.getBoundingClientRect();
        if (pinch0) zoomAt(d / pinch0, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top);
        pinch0 = d; moved = true; return;
      }
      const dx = e.clientX - prev[0], dy = e.clientY - prev[1];
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      cam.x += dx; cam.y += dy; drawMap();
    });
    const up = (e) => {
      ptrs.delete(e.pointerId);
      if (!moved && ptrs.size === 0) {
        const b = cv.getBoundingClientRect(), p = nearestDot(e.clientX - b.left, e.clientY - b.top);
        if (p) openPlace(p);
      }
      if (ptrs.size < 2) pinch0 = null;
    };
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", (e) => ptrs.delete(e.pointerId));
    $("#ex-zin").onclick = () => zoomAt(1.6, cv.clientWidth / 2, cv.clientHeight / 2);
    $("#ex-zout").onclick = () => zoomAt(0.625, cv.clientWidth / 2, cv.clientHeight / 2);
    window.addEventListener("resize", () => { if (view === "map") drawMap(); });
  }

  function centerOn(pt) {
    const cv = $("#ex-map"), w = cv.clientWidth, h = cv.clientHeight;
    const k = 4000, [x, y] = proj(pt.lo, pt.la);
    cam = { k, x: w / 2 - x * k, y: h / 2 - y * k };
  }

  // ---------------------------------------------------------------- data, URL state, controls
  let SOURCES = [], DETAIL_FILES = [];
  async function fetchJSON(url, opts) { const r = await fetch(url, opts); if (!r.ok) throw new Error(r.status + " " + url); return r.json(); }
  // the build this page's data comes from: the page names it (so a cached core.json from an older build isn't used), core.json confirms it
  const PAGE_VER = ($("#ex-app") && $("#ex-app").dataset.ver) || "";
  let DV = "";
  const vq = (v) => (v ? "?v=" + encodeURIComponent(v) : "");
  // a data file from another build (a cache that outlived a deploy) is fetched once more, then refused: its rows wouldn't line up
  async function fetchCurrent(url, verOf) {
    let d = await fetchJSON(url + vq(DV));
    if (DV && verOf(d) !== DV) d = await fetchJSON(url + vq(DV), { cache: "reload" });
    if (DV && verOf(d) !== DV) throw new Error("another build: " + url);
    return d;
  }
  const DETAIL = new Map(), DETAIL_LOADED = new Set(), DETAIL_FAILED = new Set(), detailPromises = new Map();
  // a county's detail file (phones, websites, notes, alcohol licenses) is fetched only once someone reaches for a place there
  function loadDetail(co) {
    // a county with no extras has no file (null in dfiles): nothing to fetch
    if (!Number.isInteger(co) || co < 0 || co >= DETAIL_FILES.length || !DETAIL_FILES[co]) { DETAIL_LOADED.add(co); return Promise.resolve(); }
    if (!detailPromises.has(co)) {
      detailPromises.set(co, fetchCurrent(`${BASE}/data/detail-${encodeURIComponent(DETAIL_FILES[co])}.json`, (d) => d && d._v).then((d) => {
        if (d && typeof d === "object") for (const k of Object.keys(d)) { const i = Number(k); if (Number.isInteger(i) && d[k] && typeof d[k] === "object") DETAIL.set(i, d[k]); }
      }).catch(() => { DETAIL_FAILED.add(co); /* offline or another build: the panel says so, and asks for a reload */ })
        .finally(() => DETAIL_LOADED.add(co)));
    }
    return detailPromises.get(co);
  }

  // ids.json: one stable id per place, in core order (saved places, #p= links and the panel's history entry use them)
  let idsPromise = null, idsReady = false, idsFailed = false;
  function loadIds() {
    idsPromise ||= fetchCurrent(`${BASE}/data/ids.json`, (d) => d && d.v).then((d) => {
      const ids = d && typeof d.ids === "string" ? d.ids.split(",") : [];   // one comma-separated string: smaller than a JSON array
      if (ids.length !== P.length) throw new Error("ids.json doesn't match core.json");
      ids.forEach((x, i) => { P[i].id = x; });
    }).catch(() => { idsFailed = true; /* offline or another build: saving and links wait for a reload, and the page says so */ })
      .finally(() => { idsReady = true; });
    return idsPromise;
  }

  async function load() {
    let d = await fetchJSON(`${BASE}/data/core.json${vq(PAGE_VER)}`);
    // a core.json with no version predates versioning (a cache that ignored ?v=): its rows would meet this build's ids and county
    // files unchecked, so fetch it once more past the cache, then stop with the reload message rather than mix two builds
    if (PAGE_VER && typeof d.ver !== "string") d = await fetchJSON(`${BASE}/data/core.json${vq(PAGE_VER)}`, { cache: "reload" });
    if (PAGE_VER && typeof d.ver !== "string") throw new Error("core.json from before versioning");
    DV = typeof d.ver === "string" ? d.ver : "";
    GENERATED = d.generated; CAL = d.calibration || {}; SOURCES = d.srcs || []; DETAIL_FILES = d.dfiles || [];
    META = { permits: d.permits_updated };
    const n = d.n, towns = new Map(), C = { ...d.cols };
    for (const [k, pairs] of Object.entries(d.sparse || {})) {   // mostly-empty columns arrive as [[index, value], ...]
      const col = new Array(n).fill(null);
      if (Array.isArray(pairs)) for (const pr of pairs) if (Array.isArray(pr) && Number.isInteger(pr[0]) && pr[0] >= 0 && pr[0] < n) col[pr[0]] = pr[1];
      C[k] = col;
    }
    for (const k of ["n", "c", "co", "cu", "t", "s", "a", "z", "b", "ch", "g", "hc", "ip", "f", "h", "mi", "dish", "lq", "dla", "dlo", "jb"])
      if (!Array.isArray(C[k]) || C[k].length !== n) C[k] = new Array(n).fill(null);
    P = new Array(n);
    let la = 0, lo = 0;   // coordinates come as steps of 0.0001° from the previous place
    for (let i = 0; i < n; i++) {
      let pla = null, plo = null;
      if (C.dla[i] != null && C.dlo[i] != null) { la += C.dla[i]; lo += C.dlo[i]; pla = la / 10000; plo = lo / 10000; }
      const city = C.c[i] == null ? null : d.cities[C.c[i]], cu = d.cuisines[C.cu[i]], brand = C.b[i] == null ? null : d.brands[C.b[i]];
      const county = C.co[i] == null ? null : d.counties[C.co[i]];
      const p = { i, id: null, n: String(C.n[i] ?? ""), c: city, cu, t: C.t[i], s: C.s[i], a: C.a[i], z: C.z[i], la: pla, lo: plo,
        ch: num(C.ch[i]) || 1, g: C.g[i] || 0, hc: C.hc[i] === 1, ip: C.ip[i], f: num(C.f[i]), h: C.h[i] || 0,
        mi: num(C.mi[i]) || 0, jb: C.jb[i] === 1, dish: C.dish[i], co: C.co[i], county, lq: C.lq[i] === 1 };
      p.search = " " + normalize([p.n, city, county, p.z, cu, brand, p.dish].filter(Boolean).join(" ")) + " " + normAddr(p.a || "") + " ";
      p.nameText = " " + normalize([p.n, brand].filter(Boolean).join(" ")) + " ";
      p.key = normalize(p.n);
      P[i] = p;
      if (city) towns.set(city, (towns.get(city) || 0) + 1);
    }
    const byCount = [...towns.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    for (const [name] of byCount) { const k = normAddr(name); if (!own(TOWN_KEYS, k)) TOWN_KEYS[k] = name; }   // biggest town wins a shared spelling
    TOWN_KEYS_BY_LENGTH = Object.keys(TOWN_KEYS).sort((a, b) => b.length - a.length);
    $("#ex-town").innerHTML = '<option value="">All towns</option>' + [...towns.keys()].sort((a, b) => a.localeCompare(b)).map((t) => `<option>${esc(t)}</option>`).join("");
    const cuis = new Map();
    for (const p of P) cuis.set(p.cu, (cuis.get(p.cu) || 0) + 1);
    $("#ex-cuisine").innerHTML = '<option value="">All kinds</option>' + [...cuis.entries()].sort((a, b) => b[1] - a[1]).map(([c, k]) => `<option value="${esc(c)}">${esc(c)} (${esc(k.toLocaleString())})</option>`).join("");
    bibCount = P.filter((p) => !p.v && p.mi === 2).length;
    $("#ex-bibwrap").hidden = !bibCount;
    $("#ex-bibn").textContent = `(${bibCount.toLocaleString()})`;
    if (!bibCount) st.bib = false;
  }

  const guideOk = (g) => own(GUIDES, g);
  function readHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    const last = store.get("guide", "hotbrown");
    // a returning visitor gets the guide they used last, unless it's an empty Saved list
    st.g = guideOk(h.get("g")) ? h.get("g") : guideOk(last) && !(last === "saved" && !saved.size) ? last : "hotbrown";
    st.q = h.get("q") || ""; st.town = h.get("town") || ""; st.cuisine = h.get("kind") || ""; st.chains = h.get("chains") === "1"; st.bib = h.get("bib") === "1";
    st.sort = h.get("sort") || ""; st.p = h.get("p") || "";
  }
  function hashOf(withPlace) {
    const h = new URLSearchParams();
    h.set("g", st.g);
    if (st.q) h.set("q", st.q); if (st.town) h.set("town", st.town); if (st.cuisine) h.set("kind", st.cuisine);
    if (st.chains) h.set("chains", "1"); if (st.bib) h.set("bib", "1"); if (st.sort) h.set("sort", st.sort); if (withPlace && st.p) h.set("p", st.p);
    return "#" + h.toString();
  }
  const listHash = () => hashOf(false);
  // filter changes replace the current history entry; opening a place pushes one, so Back closes the panel
  function saveHash(push = false) {
    const url = hashOf(true);
    if (push) history.pushState({ kyeats: "place" }, "", url);
    else history.replaceState(st.p ? { kyeats: "place" } : null, "", url);
    store.set("guide", st.g);
  }

  // a coarse Kentucky outline (KentuckyEats/Services/LocationService.swift's KentuckyOutline): a bounding box would count the neighbours' border towns
  const KY_RINGS = [[[-89.416, 36.501], [-89.365, 36.624], [-89.325, 36.63], [-89.273, 36.57], [-89.236, 36.565], [-89.212, 36.579], [-89.196, 36.628], [-89.158, 36.666], [-89.169, 36.673], [-89.168, 36.69], [-89.198, 36.717], [-89.198, 36.734], [-89.169, 36.758], [-89.126, 36.75], [-89.118, 36.759], [-89.123, 36.787], [-89.17, 36.799], [-89.177, 36.831], [-89.137, 36.847], [-89.116, 36.887], [-89.098, 36.961], [-89.114, 36.982], [-89.133, 36.984], [-89.17, 37.009], [-89.18, 37.046], [-89.154, 37.088], [-89.11, 37.118], [-89.085, 37.165], [-89.0, 37.223], [-88.931, 37.226], [-88.806, 37.187], [-88.733, 37.143], [-88.626, 37.118], [-88.566, 37.074], [-88.49, 37.062], [-88.459, 37.073], [-88.423, 37.152], [-88.447, 37.204], [-88.507, 37.261], [-88.514, 37.285], [-88.483, 37.345], [-88.475, 37.386], [-88.455, 37.407], [-88.413, 37.423], [-88.365, 37.4], [-88.284, 37.448], [-88.092, 37.47], [-88.071, 37.481], [-88.062, 37.516], [-88.132, 37.575], [-88.158, 37.661], [-88.121, 37.709], [-88.059, 37.742], [-88.027, 37.798], [-88.002, 37.798], [-87.952, 37.77], [-87.933, 37.795], [-87.906, 37.806], [-87.909, 37.844], [-87.939, 37.88], [-87.903, 37.924], [-87.876, 37.922], [-87.83, 37.875], [-87.791, 37.874], [-87.759, 37.89], [-87.676, 37.9], [-87.666, 37.888], [-87.683, 37.857], [-87.681, 37.836], [-87.671, 37.827], [-87.644, 37.825], [-87.612, 37.832], [-87.583, 37.872], [-87.586, 37.886], [-87.626, 37.921], [-87.597, 37.973], [-87.579, 37.969], [-87.579, 37.951], [-87.557, 37.927], [-87.511, 37.905], [-87.449, 37.94], [-87.412, 37.943], [-87.299, 37.895], [-87.222, 37.848], [-87.163, 37.839], [-87.132, 37.787], [-87.111, 37.781], [-87.067, 37.805], [-87.042, 37.87], [-87.044, 37.893], [-87.033, 37.905], [-86.969, 37.931], [-86.919, 37.935], [-86.855, 37.986], [-86.82, 37.998], [-86.796, 37.988], [-86.766, 37.932], [-86.732, 37.893], [-86.718, 37.892], [-86.681, 37.914], [-86.648, 37.908], [-86.663, 37.849], [-86.638, 37.841], [-86.597, 37.867], [-86.598, 37.906], [-86.588, 37.92], [-86.534, 37.916], [-86.505, 37.93], [-86.524, 37.968], [-86.52, 38.038], [-86.452, 38.049], [-86.43, 38.073], [-86.432, 38.087], [-86.463, 38.102], [-86.462, 38.118], [-86.432, 38.125], [-86.401, 38.104], [-86.379, 38.128], [-86.335, 38.128], [-86.322, 38.138], [-86.327, 38.158], [-86.372, 38.169], [-86.374, 38.187], [-86.361, 38.195], [-86.289, 38.157], [-86.273, 38.137], [-86.28, 38.089], [-86.262, 38.052], [-86.179, 38.01], [-86.123, 38.014], [-86.095, 38.007], [-86.053, 37.961], [-86.039, 37.958], [-86.028, 37.992], [-85.947, 38.004], [-85.924, 38.022], [-85.904, 38.09], [-85.905, 38.167], [-85.884, 38.198], [-85.842, 38.232], [-85.828, 38.276], [-85.781, 38.287], [-85.742, 38.266], [-85.679, 38.297], [-85.65, 38.329], [-85.63, 38.398], [-85.606, 38.438], [-85.499, 38.467], [-85.466, 38.509], [-85.418, 38.534], [-85.414, 38.563], [-85.437, 38.605], [-85.437, 38.659], [-85.455, 38.689], [-85.435, 38.727], [-85.415, 38.735], [-85.364, 38.729], [-85.277, 38.74], [-85.248, 38.731], [-85.215, 38.695], [-85.173, 38.687], [-84.992, 38.777], [-84.941, 38.774], [-84.887, 38.793], [-84.813, 38.784], [-84.828, 38.83], [-84.79, 38.86], [-84.784, 38.88], [-84.801, 38.893], [-84.866, 38.9], [-84.876, 38.91], [-84.876, 38.921], [-84.833, 38.958], [-84.829, 38.973], [-84.896, 39.056], [-84.832, 39.099], [-84.787, 39.114], [-84.751, 39.146], [-84.719, 39.136], [-84.687, 39.099], [-84.619, 39.072], [-84.572, 39.081], [-84.551, 39.098], [-84.511, 39.092], [-84.475, 39.118], [-84.452, 39.117], [-84.436, 39.099], [-84.427, 39.052], [-84.341, 39.034], [-84.307, 39.007], [-84.29, 38.955], [-84.235, 38.891], [-84.233, 38.832], [-84.214, 38.804], [-84.071, 38.769], [-83.962, 38.786], [-83.874, 38.761], [-83.853, 38.75], [-83.837, 38.716], [-83.788, 38.698], [-83.771, 38.654], [-83.669, 38.625], [-83.647, 38.631], [-83.624, 38.678], [-83.521, 38.701], [-83.468, 38.674], [-83.359, 38.654], [-83.328, 38.636], [-83.318, 38.607], [-83.299, 38.596], [-83.246, 38.627], [-83.203, 38.615], [-83.153, 38.617], [-83.134, 38.631], [-83.111, 38.67], [-83.061, 38.688], [-83.027, 38.726], [-82.971, 38.726], [-82.933, 38.746], [-82.887, 38.754], [-82.872, 38.736], [-82.879, 38.688], [-82.861, 38.659], [-82.856, 38.613], [-82.843, 38.587], [-82.79, 38.559], [-82.731, 38.558], [-82.701, 38.543], [-82.658, 38.496], [-82.615, 38.473], [-82.606, 38.459], [-82.595, 38.422], [-82.599, 38.345], [-82.574, 38.318], [-82.585, 38.297], [-82.576, 38.264], [-82.585, 38.248], [-82.605, 38.249], [-82.614, 38.237], [-82.6, 38.217], [-82.613, 38.173], [-82.646, 38.165], [-82.638, 38.137], [-82.623, 38.132], [-82.62, 38.119], [-82.589, 38.108], [-82.585, 38.09], [-82.552, 38.069], [-82.518, 38.0], [-82.489, 37.997], [-82.485, 37.983], [-82.466, 37.983], [-82.485, 37.972], [-82.485, 37.963], [-82.474, 37.959], [-82.499, 37.946], [-82.491, 37.938], [-82.502, 37.937], [-82.501, 37.928], [-82.482, 37.925], [-82.49, 37.918], [-82.477, 37.911], [-82.475, 37.899], [-82.464, 37.913], [-82.421, 37.883], [-82.41, 37.867], [-82.426, 37.861], [-82.417, 37.855], [-82.421, 37.846], [-82.401, 37.829], [-82.403, 37.809], [-82.387, 37.817], [-82.378, 37.802], [-82.341, 37.785], [-82.338, 37.774], [-82.325, 37.774], [-82.332, 37.762], [-82.313, 37.763], [-82.335, 37.743], [-82.298, 37.702], [-82.305, 37.675], [-82.288, 37.667], [-82.283, 37.674], [-82.257, 37.655], [-82.24, 37.66], [-82.218, 37.64], [-82.214, 37.624], [-82.187, 37.626], [-82.19, 37.644], [-82.176, 37.647], [-82.183, 37.621], [-82.166, 37.619], [-82.17, 37.609], [-82.158, 37.608], [-82.157, 37.591], [-82.129, 37.586], [-82.128, 37.574], [-82.146, 37.569], [-82.134, 37.552], [-82.075, 37.554], [-82.065, 37.535], [-82.047, 37.527], [-82.042, 37.547], [-82.012, 37.532], [-81.998, 37.542], [-81.966, 37.543], [-82.326, 37.284], [-82.345, 37.282], [-82.351, 37.269], [-82.499, 37.228], [-82.634, 37.156], [-82.722, 37.122], [-82.724, 37.046], [-82.744, 37.044], [-82.749, 37.025], [-82.76, 37.029], [-82.783, 37.009], [-82.829, 37.007], [-82.838, 36.989], [-82.868, 36.979], [-82.859, 36.929], [-82.879, 36.909], [-82.87, 36.9], [-82.88, 36.891], [-83.008, 36.849], [-83.026, 36.857], [-83.073, 36.856], [-83.076, 36.842], [-83.103, 36.829], [-83.106, 36.805], [-83.134, 36.785], [-83.129, 36.761], [-83.136, 36.744], [-83.195, 36.741], [-83.31, 36.712], [-83.425, 36.669], [-83.53, 36.668], [-83.578, 36.643], [-83.649, 36.624], [-83.691, 36.584], [-84.543, 36.598], [-85.195, 36.627], [-85.488, 36.616], [-85.678, 36.62], [-86.508, 36.654], [-86.551, 36.646], [-86.564, 36.635], [-86.59, 36.654], [-87.852, 36.637], [-87.85, 36.667], [-88.071, 36.68], [-88.034, 36.541], [-88.039, 36.514], [-88.054, 36.499], [-89.301, 36.509], [-89.416, 36.501]], [[-89.542, 36.506], [-89.57, 36.548], [-89.562, 36.568], [-89.528, 36.579], [-89.48, 36.567], [-89.467, 36.53], [-89.486, 36.499], [-89.542, 36.506]]];
  function inRing(ring, la, lo) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > la) !== (yj > la) && lo < (xj - xi) * (la - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  const inKentucky = (la, lo) => KY_RINGS.some((r) => inRing(r, la, lo));

  function locate() {
    if (!navigator.geolocation) { $("#ex-locmsg").textContent = "This browser can't share its location."; return; }
    $("#ex-locmsg").textContent = "Finding you…";
    navigator.geolocation.getCurrentPosition((pos) => {
      here = { la: pos.coords.latitude, lo: pos.coords.longitude };
      const inGA = inKentucky(here.la, here.lo);
      $("#ex-locmsg").textContent = inGA ? "Sorted by distance from you. Your location stays in this browser." : "You're outside Kentucky: distances are from where you are. Your location stays in this browser.";
      st.sort = GUIDES[st.g].sorts.includes("nearest") ? "nearest" : st.sort;
      if (view === "map" && inGA) centerOn(here);
      shown = 100; render();
    }, (err) => {
      $("#ex-locmsg").textContent = err && err.code === 1 ? "Location is off for this site. Allow it in your browser settings to sort by distance."
        : "Couldn't get a location fix just now. Tap Near me to try again.";
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 });   // a fresh fix on every tap, never one from minutes ago
  }

  function setView(v) {
    view = v;
    document.querySelectorAll(".ex-view button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v)));
    $("#ex-listwrap").hidden = v !== "list";
    $("#ex-mapwrap").hidden = v !== "map";
    render();
    // the map often starts below the fold (on phones, and on laptop-height screens): bring it into view
    if (v === "map" && $("#ex-mapwrap").getBoundingClientRect().top > innerHeight * 0.5) $("#ex-mapwrap").scrollIntoView({ block: "nearest" });
  }

  // the URL moved under us: Back/Forward (popstate) or a link to another #hash (hashchange). Both can fire for one step.
  function fromURL() {
    const before = listHash();
    readHash();
    if (listHash() !== before) { syncInputs(); shown = 100; render(); }
    if (st.p && !idsReady) { loadIds().then(fromURL); return; }
    const p = st.p && P.find((x) => x.id === st.p);
    const panel = $("#ex-panel");
    if (p) {
      if (panel.hidden || panel.dataset.id !== p.id) {
        openPlace(p, false);
        // Forward to a place opened earlier: its entry was pushed after the list's, so closing it steps back, as after a tap
        if (history.state && history.state.kyeats === "place") { listAtPush = listHash(); panel.dataset.pushed = "1"; }
      }
    }
    else { if (!panel.hidden) closePlace(true); linkMissing(); }
  }

  // a #p= link whose place isn't here: ids.json didn't load, or the place has left the list since the link was made
  function linkMissing() {
    if (!st.p) return;
    $("#ex-locmsg").textContent = idsFailed ? "The place in this link couldn't load: you may be offline, or the site was just updated. Reload the page to try again."
      : "The place in this link isn't on the list anymore (it may have closed or moved).";
  }

  function controls() {
    document.querySelectorAll(".ex-guides button").forEach((b) => b.onclick = () => { if (guideOk(b.dataset.g)) st.g = b.dataset.g; st.sort = ""; shown = 100; render(); });
    let t = null;
    $("#ex-q").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { st.q = e.target.value; shown = 100; render(); }, 120); });
    $("#ex-sort").onchange = (e) => { st.sort = e.target.value; if (st.sort === "nearest" && !here) locate(); shown = 100; render(); };
    $("#ex-town").onchange = (e) => { st.town = e.target.value; shown = 100; render(); };
    $("#ex-cuisine").onchange = (e) => { st.cuisine = e.target.value; shown = 100; render(); };
    $("#ex-chains").onchange = (e) => { st.chains = e.target.checked; shown = 100; render(); };
    $("#ex-bib").onchange = (e) => { st.bib = e.target.checked; shown = 100; render(); };
    $("#ex-clear").onclick = () => { st.town = st.cuisine = ""; st.chains = st.bib = false; syncInputs(); shown = 100; render(); };
    $("#ex-locate").onclick = locate;
    $("#ex-more").onclick = () => { shown += 200; renderList(order()); };
    document.querySelectorAll(".ex-view button").forEach((b) => b.onclick = () => setView(b.dataset.v));
    $("#ex-list").addEventListener("click", (e) => { const b = e.target.closest(".ex-row"); if (b && P[+b.dataset.i]) openPlace(P[+b.dataset.i]); });
    // warm the region file of the row under the pointer (or keyboard focus), so the panel opens with its details
    for (const ev of ["pointerover", "focusin"]) $("#ex-list").addEventListener(ev, (e) => { const b = e.target.closest && e.target.closest(".ex-row"); if (b && P[+b.dataset.i]) { loadIds(); loadDetail(P[+b.dataset.i].co); } });
    // the ids (a few hundred KB) wait for the first sign of use, so a visit that only looks doesn't download them
    const WARM = ["pointerdown", "keydown", "wheel", "scroll", "touchstart"];
    const warmIds = () => { WARM.forEach((ev) => removeEventListener(ev, warmIds, true)); loadIds(); };
    WARM.forEach((ev) => addEventListener(ev, warmIds, { capture: true, passive: true }));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#ex-panel").hidden) closePlace(); });
    window.addEventListener("popstate", fromURL);
    window.addEventListener("hashchange", fromURL);
    $("#ex-backdrop").addEventListener("click", () => { if (st.p || !$("#ex-panel").hidden) closePlace(); });
    mapEvents();
  }
  function syncInputs() {
    $("#ex-q").value = st.q; $("#ex-town").value = st.town; $("#ex-cuisine").value = st.cuisine; $("#ex-chains").checked = st.chains; $("#ex-bib").checked = st.bib;
  }

  (async () => {
    $("#ex-loading").hidden = false;   // hidden in the HTML, so a browser without JavaScript shows only the <noscript> note
    readHash();
    try { await load(); } catch (e) { $("#ex-loading").textContent = "The restaurant list couldn't load. Refresh to try again."; return; }
    syncInputs(); controls();
    $("#ex-app").hidden = false;
    $("#ex-loading").hidden = true;
    render();
    if (st.p) {
      await loadIds();
      const open = P.find((p) => p.id === st.p);
      if (open) { await loadDetail(open.co); openPlace(open, false); }
      else linkMissing();
    }
  })();
})();
