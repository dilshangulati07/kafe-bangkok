// app.js: the starting point of the site.
// index.html loads this file with <script type="module">. It loads the café
// data, keeps track of the filters and the saved cafés, decides which cafés
// to show and in what order, and asks ui.js to draw them. It also picks the
// café of the day, counts the café stats, switches between Thai and English
// (the words are in i18n.js), and starts the "Ask the barista" chat
// (chat.js), the café crawl planner (crawl.js) and the "Suggest a café"
// form (suggest.js). The extra cafés from OpenStreetMap (osm.js) are shown
// under the results, on the map and in the stats; they're only downloaded
// when one of those needs them (see needOsm).

import {
  initNav, bindChatButtons, showToast,
  buildFilterControls, readPrefs, writePrefs, renderResults, appendResults, setEmptyMessage,
  applyResultsView, refreshHoursStatus,
  renderSaved, updateSavedSummary, setToggleState,
  initDrawer, openDrawer,
  renderNeighbourhoods, renderPassport,
  setCompareState, renderCompareBar, announceCompare, initCompareDialog, openCompare,
  showCopied, renderSources, renderCafeOfTheDay, renderStats, showLanguage, escapeHtml,
} from './ui.js';
import { loadOsmCafes, osmData, filterOsmCafes, osmCardHtml, countChains } from './osm.js';
import { scoreCafe } from './score.js';
import { load, save, loadIdSet, saveIdSet } from './store.js';
import { initChat, openChat, refreshChatLanguage } from './chat.js';
import { startClock, tickClock, openStatus, bangkokDate } from './clock.js';
import { showMap, refreshMapLanguage } from './map.js';
import { initCrawl, refreshCrawlLanguage } from './crawl.js';
import { initSuggest, refreshSuggestLanguage } from './suggest.js';
import { t, tHtml, inEnglish, listOr, featureLabel, getLang, setLang, setMeta, startI18n } from './i18n.js';

const DATA_URL = 'data/cafes.json';
const SORT_OPTIONS = ['best', 'price', 'name'];
const MAX_COMPARE = 3;
const RESULTS_BATCH = 24; // result cards drawn at a time (24 fills 2 or 3 columns evenly)


/* ---------- State: everything the finder knows ---------- */
let meta = {};               // labels for moods, features and prices (from cafes.json)
let cafes = [];              // every café in cafes.json
let cafesById = new Map();   // the same cafés, looked up by id: cafesById.get('suriya-coffee')
let zoneNames = [];          // every zone, A to Z
let zoneStats = [];          // every zone with its café count and top moods (see countZones)
let lineStats = [];          // every BTS/MRT line with its café count, for the Line dropdown
let loadFailed = false;      // true if cafes.json didn't load
let prefs = defaultPrefs();  // what the user has chosen
let sortBy = 'best';         // 'best', 'price' or 'name'
let filterForm;              // the filters <form>
let sortSelect;              // the "Sort by" dropdown
let compareIds = [];         // cafés ticked for Compare, in the order they were ticked
let currentResults = [];     // the ranked list for the current filters
let shownCount = 0;          // how many of currentResults have cards on screen
let view = 'list';           // 'list' or 'map' (the switch above the results)

// The extra cafés from OpenStreetMap (see "More cafés from OpenStreetMap" below)
const OSM_BATCH = 24;        // OpenStreetMap cards drawn at a time
let osmState = 'idle';       // 'idle' (not asked for yet), 'loading', 'ready' or 'failed'
let osmPromise = null;       // the download, so it only happens once
let osmResults = [];         // the OpenStreetMap cafés that pass the filters
let osmShown = 0;            // how many of them have cards on screen
let osmListOpen = false;     // has "Show more cafés" been pressed?
let chains = defaultChains(); // "Include chains" and the brand dropdown

// Cafés the user has hearted or been to. Each is a Set of café ids.
const saved = { favourites: new Set(), visited: new Set() };

// The starting filters. It's a function, not a constant, so every call
// gets brand-new arrays (two prefs objects never share the same list).
function defaultPrefs() {
  return { moods: [], features: [], zone: 'Anywhere', line: 'Any', maxPrice: 3, nearStation: false, openNow: false, query: '' };
}

// Chains are off at first. `brand` is 'Any' or one brand's name (with chains on).
function defaultChains() {
  return { on: false, brand: 'Any' };
}

// Saved or shared chain settings, checked like cleanPrefs does. The brand
// can't be checked until osm-cafes.json has loaded (see needOsm).
function cleanChains(saved) {
  const clean = defaultChains();
  if (!saved || typeof saved !== 'object' || saved.on !== true) return clean;
  clean.on = true;
  if (typeof saved.brand === 'string' && saved.brand) clean.brand = saved.brand;
  return clean;
}


/* ---------- Loading the data ---------- */

// Download cafes.json and turn it into a normal JavaScript object.
async function loadCafeData() {
  const response = await fetch(DATA_URL);
  // fetch only throws on network failure, so check for errors like 404 ourselves.
  if (!response.ok) {
    throw new Error(`Couldn't load ${DATA_URL} (status ${response.status})`);
  }
  return response.json();
}

// Every zone once, sorted A to Z, with how many cafés it has and its two
// most common moods (ties go to the mood listed first in meta.moods).
// Result: [{ name: "Ari & Phaya Thai", count: 10, topMoods: ['aesthetic', 'date'] }, ...]
function countZones(allCafes) {
  const zones = {};
  for (const cafe of allCafes) {
    if (!zones[cafe.zone]) zones[cafe.zone] = { name: cafe.zone, count: 0, moods: {} };
    const zone = zones[cafe.zone];
    zone.count += 1;
    for (const mood of cafe.moods) {
      zone.moods[mood] = (zone.moods[mood] || 0) + 1;
    }
  }

  const moodOrder = Object.keys(meta.moods);
  return Object.values(zones)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((zone) => ({
      name: zone.name,
      count: zone.count,
      topMoods: Object.keys(zone.moods)
        .sort((a, b) => zone.moods[b] - zone.moods[a] || moodOrder.indexOf(a) - moodOrder.indexOf(b))
        .slice(0, 2),
    }));
}

// Saved filters could be from an older version of the site (say a zone was
// renamed), so keep only values that still make sense and use defaults for the rest.
function cleanPrefs(savedPrefs, zoneNames) {
  const clean = defaultPrefs();
  if (!savedPrefs || typeof savedPrefs !== 'object') return clean;

  const prices = Object.keys(meta.price).map(Number); // [1, 2, 3]

  if (Array.isArray(savedPrefs.moods)) {
    clean.moods = savedPrefs.moods.filter((key) => Object.hasOwn(meta.moods, key));
  }
  if (Array.isArray(savedPrefs.features)) {
    clean.features = savedPrefs.features.filter((key) => Object.hasOwn(meta.features, key));
  }
  if (zoneNames.includes(savedPrefs.zone)) clean.zone = savedPrefs.zone;
  if (meta.lines.includes(savedPrefs.line)) clean.line = savedPrefs.line;
  if (prices.includes(savedPrefs.maxPrice)) clean.maxPrice = savedPrefs.maxPrice;
  clean.nearStation = savedPrefs.nearStation === true;
  clean.openNow = savedPrefs.openNow === true;
  if (typeof savedPrefs.query === 'string') clean.query = savedPrefs.query;

  return clean;
}


/* ---------- Filtering, scoring and sorting ---------- */

// Lower-case and strip accents, so searching "cafe" also finds "Café".
function simplify(text) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Hard filters: a café that fails any of these isn't shown at all.
// Must-haves are hard filters too: a café needs EVERY must-have you ticked.
// Moods are NOT checked here; they only change the score (and so the order).
// `filters` is a prefs object: the finder's own, or the chat's (chat.js
// uses this same function, so both apply the filters the same way).
function passesFilters(cafe, filters) {
  if (filters.zone !== 'Anywhere' && cafe.zone !== filters.zone) return false;
  if (cafe.price > filters.maxPrice) return false;
  if (filters.nearStation && !cafe.station) return false;
  // "BTS Silom": the café's station must be on that line. cafe.line is a
  // list, because a station like Siam is on two lines. (The chat's prefs
  // have no line, so `filters.line &&` lets those through.)
  if (filters.line && filters.line !== 'Any' && !cafe.line.includes(filters.line)) return false;
  if (filters.openNow && !isOpenForFilter(cafe, filters)) return false;
  // every() is true only when the café has each ticked must-have
  // (and also true when none are ticked, so nothing is filtered out then)
  if (!filters.features.every((feature) => cafe.features.includes(feature))) return false;

  if (filters.query) {
    const query = simplify(filters.query);
    const inName = simplify(cafe.name).includes(query);
    const inArea = simplify(cafe.area).includes(query);
    if (!inName && !inArea) return false;
  }
  return true;
}

// "Open now": the café's openingHours must say it's open right now in
// Bangkok, so cafés we don't have hours for are left out too.
// One exception: when "Open late / 24h" is also ticked (the hero's "Open
// late right now" button ticks both), a café tagged that way whose hours we
// don't know stays in. Real hours are used where we have them, the tag where
// we don't.
function isOpenForFilter(cafe, filters) {
  const { state } = openStatus(cafe.openingHours);
  if (state === 'open') return true;
  return state === 'unknown'
    && filters.features.includes('lateNight')
    && cafe.features.includes('lateNight');
}

// Score one café. scoreCafe lives in js/score.js. The `|| {}` and the
// defaults keep the page working even if it ever returns nothing.
function scoreOne(cafe, scorePrefs) {
  const { score = 0, reasons = [] } = scoreCafe(cafe, scorePrefs) || {};
  return { cafe, score, reasons };
}

// Compare functions for .sort(). Each returns a negative number if `a`
// should come first, positive if `b` should. `||` means "if that's a tie
// (0), use the next rule".
// One shared Intl.Collator compares names A to Z, ignoring accents and capitals
// ("Café" = "cafe"). It's the same as a.localeCompare(b, 'en', { sensitivity:
// 'base' }), but that builds a new collator on every call, which made sorting
// the biggest cost of each filter change.
const nameOrder = new Intl.Collator('en', { sensitivity: 'base' });
const byName = (a, b) => nameOrder.compare(a.cafe.name, b.cafe.name);
const SORTERS = {
  best: (a, b) => b.score - a.score || byName(a, b),
  price: (a, b) => a.cafe.price - b.cafe.price || b.score - a.score || byName(a, b),
  name: byName,
};

// The finder's cafés, filtered and sorted (by the chosen sort, unless
// another sorter is passed in: "Surprise me" always wants best matches).
function rankCafes(sorter = SORTERS[sortBy]) {
  const results = cafes
    .filter((cafe) => passesFilters(cafe, prefs))
    .map((cafe) => scoreOne(cafe, prefs));
  results.sort(sorter);
  return results;
}

// "1 café", "4 cafés" (or "4 ร้าน")
function cafeCount(count) {
  return t('cafes', { n: count });
}

// How many cafés pass these filters
function countMatches(filters) {
  return cafes.filter((cafe) => passesFilters(cafe, filters)).length;
}

// Advice that names only the filters that are switched on, e.g.
// "Try another area or switching off “Open now”."
function generalTips() {
  const tips = [];
  if (prefs.zone !== 'Anywhere') tips.push(t('empty.tipArea'));
  if (prefs.line !== 'Any') tips.push(t('empty.tipLine'));
  if (prefs.maxPrice < 3) tips.push(t('empty.tipPrice'));
  if (prefs.query) tips.push(t('empty.tipSearch'));
  if (prefs.nearStation) tips.push(t('empty.tipStation'));
  if (prefs.openNow) tips.push(t('empty.tipOpen'));
  if (tips.length === 0) return t('empty.tipClear');
  return t('empty.try', { list: listOr(tips) }); // "Try a, b or c."
}

// The words for the empty state when nothing fits. If the must-haves are
// what rule everything out, name them and say which one to take away:
//   title: "No cafés match Open late / 24h + Garden"
//   text:  "Try removing one: Garden (4 cafés) or Open late / 24h (2 cafés)."
function emptyMessage() {
  const general = { title: t('empty.title'), text: generalTips() };
  // No must-haves ticked, or nothing fits even without them (the area,
  // price or search rule everything out): the general advice
  if (prefs.features.length === 0) return general;
  if (countMatches({ ...prefs, features: [] }) === 0) return general;

  const names = prefs.features.map(featureLabel);
  const where = prefs.zone === 'Anywhere' ? '' : t('empty.in', { zone: prefs.zone });
  const title = t('empty.mustTitle', { where, names: names.join(' + ') });

  // Take away each must-have on its own and count the cafés that come back.
  // Keep the ones that help, the most cafés first.
  const fixes = prefs.features
    .map((key) => ({
      name: featureLabel(key),
      count: countMatches({ ...prefs, features: prefs.features.filter((other) => other !== key) }),
    }))
    .filter((fix) => fix.count > 0)
    .sort((a, b) => b.count - a.count);

  // Taking away one isn't enough (three or more ticked): you need to drop two
  if (fixes.length === 0) return { title, text: t('empty.dropCouple') };

  if (fixes.length === 1) {
    return { title, text: t('empty.dropOne', { name: fixes[0].name, count: cafeCount(fixes[0].count) }) };
  }

  // "Garden (4 cafés), Quiet (3 cafés) or Open late / 24h (2 cafés)"
  const choices = fixes.map((fix) => t('empty.choice', { name: fix.name, count: cafeCount(fix.count) }));
  return { title, text: t('empty.dropChoice', { list: listOr(choices) }) };
}


/* ---------- Favourites, "Been there" and the passport ---------- */

// Only keep saved ids that are still in cafes.json (a café might have
// been removed from the list since it was saved).
function keepKnownIds(ids) {
  return new Set([...ids].filter((id) => cafesById.has(id)));
}

// Add the id if it's missing, remove it if it's there.
// Returns true if the id is in the Set afterwards.
function flip(ids, id) {
  if (ids.has(id)) {
    ids.delete(id);
    return false;
  }
  ids.add(id);
  return true;
}

// Draw the Saved section, newest first. A Set keeps ids in the order they
// were added, so reversing it puts the most recent heart at the top.
function showSaved() {
  const savedCafes = [...saved.favourites].reverse().map((id) => cafesById.get(id));
  renderSaved(savedCafes, meta, saved, compareIds);
}

function toggleFavourite(id, button) {
  const isOn = flip(saved.favourites, id);
  saveIdSet('favourites', saved.favourites);
  setToggleState('favourite', id, isOn);

  const pressedInSavedList = button.closest('#saved-list') !== null;
  showSaved();

  // Un-hearting a café inside Saved removes its card, and the button you
  // just pressed goes with it. Move focus to the Saved heading so keyboard
  // and screen-reader users aren't dropped back at the top of the page.
  if (pressedInSavedList) {
    document.getElementById('saved-title').focus();
  }
}

function toggleVisited(id) {
  const isOn = flip(saved.visited, id);
  saveIdSet('visited', saved.visited);
  setToggleState('visited', id, isOn);
  updateSavedSummary(saved);
  renderPassport(cafes, saved.visited, zoneStats);
}


/* ---------- Compare ---------- */

function compareCafes() {
  return compareIds.map((id) => cafesById.get(id));
}

// A Compare box on a card was ticked or unticked
function handleCompareChange(box) {
  const id = box.dataset.compare;
  const name = cafesById.get(id).name;

  if (box.checked && compareIds.length >= MAX_COMPARE) {
    box.checked = false;
    showToast(t('compare.max', { max: MAX_COMPARE }));
    return;
  }

  if (box.checked) {
    compareIds.push(id);
  } else {
    compareIds = compareIds.filter((other) => other !== id);
  }
  setCompareState(id, box.checked); // the same café may be in Saved too
  renderCompareBar(compareCafes());
  announceCompare(tHtml(box.checked ? 'compare.added' : 'compare.removed', { name: inEnglish(name), n: compareIds.length, max: MAX_COMPARE }));
}

function removeFromCompare(id) {
  compareIds = compareIds.filter((other) => other !== id);
  setCompareState(id, false);
  renderCompareBar(compareCafes());
  announceCompare(tHtml('compare.removedShort', { name: inEnglish(cafesById.get(id).name) }));
}

// Clicks inside the bar at the bottom: remove one café, clear all, or compare
function handleCompareBarClick(event) {
  const remove = event.target.closest('[data-compare-remove]');
  const clear = event.target.closest('[data-compare-clear]');
  const compare = event.target.closest('[data-compare-open]');

  if (remove) {
    removeFromCompare(remove.dataset.compareRemove);
    // That button has gone; move focus somewhere sensible
    const next = document.querySelector('.compare-bar:not([hidden]) [data-compare-open]');
    (next || document.getElementById('result-count')).focus();
  }
  if (clear) {
    [...compareIds].forEach((id) => setCompareState(id, false));
    compareIds = [];
    renderCompareBar([]);
    announceCompare(tHtml('compare.cleared'));
    document.getElementById('result-count').focus();
  }
  if (compare) {
    if (compareIds.length < 2) {
      showToast(t('compare.oneMore'));
      return;
    }
    openCompare(compareCafes(), meta, compare);
  }
}


/* ---------- The café drawer ---------- */

// Open the drawer for one café. It's scored again, so the drawer can list
// every reason, not just the 3 that fit on a card. `reasonPrefs` is the
// finder's filters, or the chat's when a mini card in the chat opened it.
function openCafe(id, opener, reasonPrefs = prefs) {
  const cafe = cafesById.get(id);
  if (!cafe) return;

  const result = scoreOne(cafe, reasonPrefs);
  result.hasPicks = reasonPrefs.moods.length > 0 || reasonPrefs.features.length > 0;
  openDrawer(result, meta, saved, opener);
}

// "Surprise me": a random café from the current top 10 best matches.
// The steam on the button's cup puffs for a moment first (CSS does the
// animation, and skips it for people who prefer less motion).
function surpriseMe(button) {
  const top = rankCafes(SORTERS.best).slice(0, 10);
  if (top.length === 0) return;
  const choice = top[Math.floor(Math.random() * top.length)];

  button.classList.add('is-steaming');
  setTimeout(() => button.classList.remove('is-steaming'), 1000);

  const lessMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(() => openCafe(choice.cafe.id, button), lessMotion ? 0 : 450);
}

// One click listener for the whole page handles every card button, in the
// results, in Saved, in the drawer and in the compare table. Each button
// says what it does with data-action and which café with data-id.
function handlePageClick(event) {
  const button = event.target.closest('[data-action]');
  if (button) {
    const { action, id } = button.dataset;
    if (action === 'open') openCafe(id, button);
    if (action === 'favourite') toggleFavourite(id, button);
    if (action === 'visited') toggleVisited(id);
    return;
  }

  // A click anywhere else on a card (its description, tags...) opens it too,
  // unless it was on a link, the Compare box, or the user was selecting text.
  // (OpenStreetMap cards have no drawer, so they're left out.)
  const card = event.target.closest('.cafe-card:not(.osm-card)');
  const isSelectingText = window.getSelection().toString() !== '';
  if (card && !event.target.closest('a, label, input') && !isSelectingText) {
    openCafe(card.dataset.id, card.querySelector('[data-action="open"]'));
  }
}


/* ---------- Shareable links (the address's #hash) ----------
   The finder's choices are kept in the address, for example
     #m=date,green&f=quiet&z=ari-phaya-thai&l=bts-sukhumvit&p=2&s=1&o=1&q=roast&sort=price
   m = moods, f = must-haves, z = area, l = BTS/MRT line, p = max price,
   s = near BTS/MRT, o = open now, q = search text, c = 1 for "Include
   chains" and b = one chain brand (b=starbucks). Only choices that differ
   from the defaults are written, so an untouched finder has no hash at all. */

// "Ari & Phaya Thai" -> "ari-phaya-thai"
function zoneSlug(zone) {
  return simplify(zone).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Accept the full slug, or just its start ("z=ari" finds "ari-phaya-thai")
function zoneFromSlug(slug) {
  if (!slug) return 'Anywhere';
  return zoneNames.find((zone) => zoneSlug(zone) === slug)
    || zoneNames.find((zone) => zoneSlug(zone).startsWith(`${slug}-`))
    || 'Anywhere';
}

// "BTS Sukhumvit" -> "bts-sukhumvit", and back again
function lineSlug(line) {
  return zoneSlug(line);
}

function lineFromSlug(slug) {
  return meta.lines.find((line) => lineSlug(line) === slug) || 'Any';
}

// A chain brand from the address: "starbucks" -> "Starbucks". Before
// osm-cafes.json has loaded there's no list to look in, so it stays as it is
// and needOsm looks it up later.
function brandFromSlug(slug) {
  const data = osmData();
  if (!data || slug === 'Any') return slug;
  const found = data.chainBrands.find(({ name }) => name === slug || zoneSlug(name) === slug);
  return found ? found.name : 'Any';
}

function prefsToHash(p, sort, chainChoice) {
  const parts = [];
  if (p.moods.length > 0) parts.push(`m=${p.moods.join(',')}`);
  if (p.features.length > 0) parts.push(`f=${p.features.join(',')}`);
  if (p.zone !== 'Anywhere') parts.push(`z=${zoneSlug(p.zone)}`);
  if (p.line !== 'Any') parts.push(`l=${lineSlug(p.line)}`);
  if (p.maxPrice !== 3) parts.push(`p=${p.maxPrice}`);
  if (p.nearStation) parts.push('s=1');
  if (p.openNow) parts.push('o=1');
  if (p.query) parts.push(`q=${encodeURIComponent(p.query)}`);
  if (sort !== 'best') parts.push(`sort=${sort}`);
  if (chainChoice.on) parts.push('c=1');
  if (chainChoice.on && chainChoice.brand !== 'Any') parts.push(`b=${zoneSlug(chainChoice.brand)}`);
  return parts.join('&');
}

// The opposite. URLSearchParams reads "a=1&b=2" style text for us.
// cleanPrefs then drops anything unknown, like a mistyped mood.
function hashToState(hash) {
  const params = new URLSearchParams(hash);
  const list = (key) => (params.get(key) || '').split(',').filter(Boolean);
  const raw = {
    moods: list('m'),
    features: list('f'),
    zone: zoneFromSlug(params.get('z')),
    line: lineFromSlug(params.get('l')),
    maxPrice: Number(params.get('p')) || 3,
    nearStation: params.get('s') === '1',
    openNow: params.get('o') === '1',
    query: params.get('q') || '',
  };
  const sort = params.get('sort');
  const chainChoice = cleanChains({ on: params.get('c') === '1', brand: brandFromSlug(params.get('b') || 'Any') });
  return { prefs: cleanPrefs(raw, zoneNames), sort: SORT_OPTIONS.includes(sort) ? sort : 'best', chains: chainChoice };
}

// Finder hashes always have an "=" in them. "#saved" or "#finder" are
// just the menu's links to parts of the page, so those are left alone.
function isFinderHash(hash) {
  return hash.includes('=');
}

// Keep the address in step with the filters. replaceState changes the
// address without adding a Back-button step or firing 'hashchange'.
function writeHash() {
  const wanted = prefsToHash(prefs, sortBy, chains);
  const current = window.location.hash.slice(1);
  if (wanted === current) return;
  if (!wanted && !isFinderHash(current)) return; // don't wipe a "#saved" link
  const { pathname, search } = window.location;
  history.replaceState(null, '', wanted ? `#${wanted}` : pathname + search);
}

// Someone pasted or edited a link in this tab
function handleHashChange() {
  const hash = window.location.hash.slice(1);
  if (!isFinderHash(hash)) return;
  ({ prefs, sort: sortBy, chains } = hashToState(hash));
  writePrefs(filterForm, prefs);
  sortSelect.value = sortBy;
  showChainControls();
  update();
}

async function copyLink(button) {
  writeHash(); // make sure the address shows the current filters
  try {
    await navigator.clipboard.writeText(window.location.href);
    showCopied(button);
  } catch {
    // Some browsers block copying (for example on a page opened from a file)
    showToast(t('finder.copyFailed'));
  }
}


/* ---------- Keeping everything in step ---------- */

// Called after every change: remember the filters, put them in the
// address, then redraw the results (the first batch of them).
function update() {
  save('prefs', prefs);
  save('sort', sortBy);
  save('chains', chains);
  writeHash();
  currentResults = rankCafes();
  shownCount = Math.min(RESULTS_BATCH, currentResults.length);
  renderResults(currentResults, shownCount, meta, saved, compareIds);
  if (currentResults.length === 0) setEmptyMessage(emptyMessage());
  updateOsm();
  // The map also shows when only OpenStreetMap cafés fit (say, a search for "Starbucks")
  const osmOnMap = osmState === 'ready' ? osmResults.length : 0;
  applyResultsView(view, currentResults.length, osmOnMap);
  if (view === 'map' && currentResults.length + osmOnMap > 0) {
    // Our cafés go on the map straight away; the OpenStreetMap ones join
    // them once they've loaded (needOsm calls update() again then)
    const osm = osmState === 'ready' ? { cafes: osmResults, chainsOn: chains.on } : null;
    showMap(currentResults, openCafe, osm);
  }
  if (view === 'map') needOsm().catch(() => {}); // a failed download is already shown under the results
}

// The List / Map switch above the results
function setView(newView) {
  view = newView;
  save('view', view); // remembered on this device, like the sort order
  update();
}

// Opening hours move with the clock. Once a minute, redo every "Open now ·
// Closes 22:00" line, and if "Open now" is on and a café has just opened or
// closed, redraw the results so the list (or map) stays right.
function refreshOpenNow() {
  // Look a café up in our list, or else in the OpenStreetMap one
  refreshHoursStatus({ get: (id) => cafesById.get(id) || osmData()?.byId.get(id) });
  if (!prefs.openNow) return;
  const idsNow = rankCafes().map(({ cafe }) => cafe.id).join();
  const idsShown = currentResults.map(({ cafe }) => cafe.id).join();
  const osmNow = filterOsmCafes(prefs, chains).map((cafe) => cafe.id).join();
  const osmShownIds = osmResults.map((cafe) => cafe.id).join();
  if (idsNow !== idsShown || osmNow !== osmShownIds) update();
}

// "Show more cafés": draw the next batch, then move focus to the first new
// café so keyboard users carry on from there (the button may have gone).
function showMoreResults() {
  const from = shownCount;
  shownCount = Math.min(from + RESULTS_BATCH, currentResults.length);
  appendResults(currentResults, from, shownCount, meta, saved, compareIds);
  document.querySelectorAll('#results .cafe-card__open')[from].focus();
}

/* ---------- More cafés from OpenStreetMap ----------
   Under the results: "Also nearby: 412 more cafés from OpenStreetMap", an
   "Include chains" switch with a brand dropdown, and the cafés as simple
   cards, 24 at a time. They pass the same area, line, near BTS/MRT, open
   now and search filters as our cafés (passesOsmFilters in osm.js).
   osm-cafes.json is downloaded the first time it's needed: "Show more
   cafés", the Map view, the stats or the barista's chain count. */

// Download osm-cafes.json (once) and redraw what uses it. Returns a Promise,
// so the barista can wait for it. Every caller gets the same download.
function needOsm() {
  if (!osmPromise) {
    osmState = 'loading';
    setMoreStatus(t('more.loading'));
    // .then(loaded, failed): the second function only handles a failed
    // download, not a mistake inside the first one
    osmPromise = loadOsmCafes().then(
      () => {
        osmState = 'ready';
        setMoreStatus('');
        // A brand from a saved filter or a shared link: find its proper name now
        // (or go back to "All chains" if that brand isn't in the data)
        chains.brand = brandFromSlug(chains.brand);
        buildBrandOptions();
        showChainControls();
        update(); // the section's count and cards, and the map's grey pins
        showStats();
      },
      (error) => {
        osmPromise = null; // pressing "Show more cafés" again tries again
        osmState = 'failed';
        setMoreStatus(t('more.failed'));
        updateOsm();
        showStats();
        throw error;
      },
    );
  }
  return osmPromise;
}

// "Loading…" or "couldn't load" under the heading (read out: it's role="status")
function setMoreStatus(text) {
  document.querySelector('[data-more-status]').textContent = text;
  // While it's downloading, pressing the button again would do nothing
  document.querySelector('[data-more-open]').disabled = osmState === 'loading';
}

// Redraw the section after any change. `keep` is how many cards to keep on
// screen (after a language change); otherwise it starts again at 24.
function updateOsm(keep = 0) {
  const title = document.querySelector('[data-more-title]');
  const openButton = document.querySelector('[data-more-open]');
  const list = document.querySelector('[data-more-list]');
  const empty = document.querySelector('[data-more-empty]');

  if (osmState !== 'ready') {
    title.textContent = t('more.titleIdle');
    openButton.hidden = false;
    list.hidden = true;
    empty.hidden = true;
    document.querySelector('[data-more-next]').hidden = true;
    return;
  }

  osmResults = filterOsmCafes(prefs, chains);
  title.textContent = t('more.title', { n: osmResults.length });
  openButton.hidden = osmListOpen;
  osmShown = osmListOpen ? Math.min(Math.max(OSM_BATCH, keep), osmResults.length) : 0;
  list.innerHTML = osmResults.slice(0, osmShown).map(osmCardHtml).join('');
  list.hidden = osmShown === 0;
  empty.hidden = !osmListOpen || osmResults.length > 0;
  showOsmNextButton();
}

// "Show 24 more" while there are more cards to draw
function showOsmNextButton() {
  const next = document.querySelector('[data-more-next]');
  const left = osmResults.length - osmShown;
  next.hidden = !osmListOpen || left <= 0;
  next.querySelector('button').textContent = t('more.next', { n: Math.min(OSM_BATCH, left) });
}

// "Show more cafés": download if needed, open the list, and move focus to
// the heading (the button disappears, so focus mustn't go with it)
function openOsmList() {
  osmListOpen = true;
  needOsm()
    .then(() => {
      updateOsm();
      document.querySelector('[data-more-title]').focus();
    })
    .catch(() => {}); // the "couldn't load" message is already showing
}

// "Show 24 more": the next batch, with focus on the first new card's link
function showMoreOsm() {
  const from = osmShown;
  osmShown = Math.min(from + OSM_BATCH, osmResults.length);
  document.querySelector('[data-more-list]')
    .insertAdjacentHTML('beforeend', osmResults.slice(from, osmShown).map(osmCardHtml).join(''));
  showOsmNextButton();
  document.querySelectorAll('[data-more-list] .osm-card__maps')[from].focus();
}

// The brand dropdown: "All chains", then every chain brand, biggest first
function buildBrandOptions() {
  const options = osmData().chainBrands
    .map(({ name, count }) => `<option value="${escapeHtml(name)}" lang="en">${escapeHtml(name)} (${count})</option>`)
    .join('');
  document.querySelector('[data-brand]').innerHTML = `<option value="Any">${escapeHtml(t('more.allChains'))}</option>${options}`;
}

// Put the switch and dropdown in step with `chains`. They only appear once
// the data is here (there's nothing to switch on before that).
function showChainControls() {
  if (osmState !== 'ready') return;
  document.querySelector('[data-more-controls]').hidden = false;
  document.querySelector('[data-chains]').checked = chains.on;
  document.querySelector('[data-brand-field]').hidden = !chains.on;
  document.querySelector('[data-brand]').value = chains.brand;
}

function startOsmSection() {
  document.querySelector('[data-more-open]').addEventListener('click', openOsmList);
  document.querySelector('[data-more-next] button').addEventListener('click', showMoreOsm);

  document.querySelector('[data-chains]').addEventListener('change', (event) => {
    chains = { on: event.target.checked, brand: 'Any' };
    showChainControls();
    update();
  });
  document.querySelector('[data-brand]').addEventListener('change', (event) => {
    chains.brand = event.target.value;
    update();
  });
}

// The barista's "Show chain cafés": its choices go into the finder, chains
// are switched on and the list opens, then the page goes to those cafés.
function showChainsFromChat(chatPrefs) {
  prefs = cleanPrefs(chatPrefs, zoneNames);
  sortBy = 'best';
  writePrefs(filterForm, prefs);
  sortSelect.value = sortBy;
  chains = { on: true, brand: 'Any' };
  osmListOpen = true;
  showChainControls();
  update();
  const title = document.querySelector('[data-more-title]');
  title.scrollIntoView();
  title.focus({ preventScroll: true });
}

function clearFilters(form, button) {
  prefs = defaultPrefs();
  chains = defaultChains();
  writePrefs(form, prefs);
  showChainControls();
  update();
  // The empty-state button disappears once results come back, so move
  // keyboard focus to the result count instead of losing it.
  if (button.closest('#empty-state')) {
    document.getElementById('result-count').focus();
  }
}

// Bring the results into view and put focus on the count, so screen
// readers hear "Showing 10 cafés". Used by the zone cards and the chat.
function goToResults(target) {
  document.getElementById(target).scrollIntoView();
  document.getElementById('result-count').focus({ preventScroll: true });
}

// A neighbourhood card was clicked: show that area's cafés
function showZone(zone) {
  prefs.zone = zone;
  writePrefs(filterForm, prefs);
  update();
  goToResults('results-bar');
}

// "Open late right now" (the hero shows it at night, see clock.js): tick the
// "Open late / 24h" must-have AND switch on "Open now", then take the user to
// the results. Together they use real opening hours where we know them (a
// tagged café that has closed by now drops out) and the tag where we don't
// (see isOpenForFilter).
function showOpenLate() {
  if (!prefs.features.includes('lateNight')) prefs.features.push('lateNight');
  prefs.openNow = true;
  writePrefs(filterForm, prefs);
  update();
  goToResults('results-bar');
}

// "Use these in the finder" in the chat: copy the chat's choices into the
// filters, redraw, and take the user to the finder.
function useInFinder(chatPrefs) {
  prefs = cleanPrefs(chatPrefs, zoneNames);
  sortBy = 'best';
  writePrefs(filterForm, prefs);
  sortSelect.value = sortBy;
  update();
  goToResults('finder');
}

function startFinder() {
  const form = document.getElementById('filters');
  zoneStats = countZones(cafes);
  zoneNames = zoneStats.map((zone) => zone.name);
  filterForm = form;
  sortSelect = document.getElementById('sort');

  // Each line in meta.lines with how many cafés are on it, for the Line dropdown
  lineStats = meta.lines.map((name) => ({ name, count: cafes.filter((cafe) => cafe.line.includes(name)).length }));
  buildFilterControls(form, meta, zoneStats, lineStats);

  // Bring back the filters and sort order. A shared link (#m=date...) wins
  // over what this browser saved last time.
  const hash = window.location.hash.slice(1);
  const openedSharedLink = isFinderHash(hash);
  if (openedSharedLink) {
    ({ prefs, sort: sortBy, chains } = hashToState(hash));
  } else {
    prefs = cleanPrefs(load('prefs', null), zoneNames);
    const savedSort = load('sort', 'best');
    sortBy = SORT_OPTIONS.includes(savedSort) ? savedSort : 'best';
    chains = cleanChains(load('chains', null));
  }
  writePrefs(form, prefs);
  sortSelect.value = sortBy;
  view = load('view', 'list') === 'map' ? 'map' : 'list';

  // Bring back hearted and visited cafés too.
  saved.favourites = keepKnownIds(loadIdSet('favourites'));
  saved.visited = keepKnownIds(loadIdSet('visited'));

  // One listener on the whole form instead of one per control ("event
  // delegation"). Ticking a box, picking an option or typing all fire an
  // 'input' event that bubbles up to the form.
  form.addEventListener('input', () => {
    prefs = readPrefs(form);
    update();
  });

  // Pressing Enter in the search box would normally submit (reload) the page.
  form.addEventListener('submit', (event) => event.preventDefault());

  sortSelect.addEventListener('change', () => {
    sortBy = sortSelect.value;
    update();
  });

  // "Clear all" in the filters and "Clear filters" in the empty state
  document.querySelectorAll('[data-clear-filters]').forEach((button) => {
    button.addEventListener('click', () => clearFilters(form, button));
  });

  document.querySelector('[data-show-more] button').addEventListener('click', showMoreResults);
  startOsmSection();

  const surpriseButton = document.querySelector('[data-surprise]');
  surpriseButton.addEventListener('click', () => surpriseMe(surpriseButton));

  document.querySelector('[data-open-late]').addEventListener('click', showOpenLate);

  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.view));
  });

  // Once a minute: opening hours move with the clock, and at midnight in
  // Bangkok there's a new café of the day
  setInterval(() => {
    refreshOpenNow();
    showCafeOfTheDay();
  }, 60 * 1000);

  const copyButton = document.querySelector('[data-copy-link]');
  copyButton.addEventListener('click', () => copyLink(copyButton));

  window.addEventListener('hashchange', handleHashChange);

  renderNeighbourhoods(zoneStats, meta);
  document.getElementById('zone-list').addEventListener('click', (event) => {
    const card = event.target.closest('[data-zone]');
    if (card) showZone(card.dataset.zone);
  });

  initDrawer();
  initCompareDialog();
  document.addEventListener('click', handlePageClick);
  document.addEventListener('change', (event) => {
    if (event.target.matches('[data-compare]')) handleCompareChange(event.target);
  });
  document.querySelector('.compare-bar').addEventListener('click', handleCompareBarClick);

  initChat({
    cafes,
    meta,
    saved,
    zones: zoneNames,
    passesFilters,
    cleanPrefs: (savedPrefs) => cleanPrefs(savedPrefs, zoneNames),
    openCafe,
    useInFinder,
    countChains: (chatPrefs) => needOsm().then(() => countChains(chatPrefs)),
    showChains: showChainsFromChat,
  });

  initCrawl({ cafes, meta, zones: zoneNames });
  initSuggest(meta);

  document.getElementById('finder-app').hidden = false;
  showSaved();
  renderPassport(cafes, saved.visited, zoneStats);
  showStats();
  loadOsmForStats();
  update();

  // A friend's link: take them straight to the results it describes
  if (openedSharedLink) document.getElementById('finder').scrollIntoView();
}


/* ---------- Small bits of the page ---------- */

// Every "Ask the barista" button (top bar, hero, round button) runs this.
// Before the café data has loaded, the barista has nothing to suggest.
function handleChatButton(event) {
  if (cafes.length === 0) {
    showToast(t('chat.notLoaded'));
    return;
  }
  openChat(event.currentTarget);
}

// Fill in the "95 cafés across 9 neighbourhoods" line in the hero, counted from the data.
function showCafeSummary() {
  const summary = document.querySelector('[data-cafe-summary]');
  if (!summary) return;

  // A Set keeps only unique values, so its size is the number of different zones.
  const zoneCount = new Set(cafes.map((cafe) => cafe.zone)).size;
  summary.textContent = t('hero.summary', { n: cafes.length, zones: zoneCount });
  summary.hidden = false;
}


/* ---------- Café stats ----------
   Every number for the stats section, counted from cafes.json:
   { total, perArea: [{ name, count }], moods: [{ key, count }],
     prices: [{ level, count }], late, knownHours } */
function countStats() {
  const count = (test) => cafes.filter(test).length;
  const mostFirst = (a, b) => b.count - a.count;
  return {
    total: cafes.length,
    // zoneStats already has each zone's count (see countZones)
    perArea: zoneStats.map(({ name, count: n }) => ({ name, count: n })).sort((a, b) => mostFirst(a, b) || a.name.localeCompare(b.name)),
    moods: Object.keys(meta.moods).map((key) => ({ key, count: count((cafe) => cafe.moods.includes(key)) })).sort(mostFirst),
    // Prices stay in their own order (฿, ฿฿, ฿฿฿), not sorted by count
    prices: Object.keys(meta.price).map((level) => ({ level: Number(level), count: count((cafe) => cafe.price === Number(level)) })),
    late: count((cafe) => cafe.features.includes('lateNight')),
    knownHours: count((cafe) => cafe.openingHours !== null),
  };
}

// Every café on the site, ours and OpenStreetMap's (see renderStats in ui.js):
// the total, hand-picked / local / chain, and the 10 chains with most branches
function countAllCafes() {
  if (osmState === 'failed') return { state: 'failed' };
  if (osmState !== 'ready') return { state: 'loading' };
  const osm = osmData();
  const local = osm.cafes.filter((cafe) => cafe.type === 'local').length;
  return {
    state: 'ready',
    total: cafes.length + osm.cafes.length,
    handPicked: cafes.length,
    local,
    chain: osm.cafes.length - local,
    checked: osm.checked,
    topChains: osm.chainBrands.slice(0, 10),
    date: osm.date,
  };
}

function showStats() {
  renderStats(countStats(), countAllCafes());
}

// The stats are far down the page. When someone scrolls to within a
// screen or so of them, start downloading the OpenStreetMap cafés, so the
// numbers are there by the time they arrive (and nobody who never scrolls
// that far downloads them).
function loadOsmForStats() {
  const section = document.getElementById('stats');
  const watcher = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    watcher.disconnect();
    needOsm().catch(() => {}); // a failure shows in the stats ("couldn't load")
  }, { rootMargin: '800px 0px' });
  watcher.observe(section);
}


/* ---------- Thai / English ---------- */

// The TH / EN buttons in the top bar. i18n.js swaps the page's fixed words;
// everything JavaScript drew is drawn again in the new language.
function changeLanguage(newLang) {
  if (newLang === getLang()) return;
  setLang(newLang);
  showLanguage(newLang);
  tickClock(); // the greeting
  if (loadFailed) showLoadError();
  if (cafes.length === 0) return;

  showCafeSummary();
  showCafeOfTheDay(true);
  buildFilterControls(filterForm, meta, zoneStats, lineStats);
  writePrefs(filterForm, prefs); // put the ticks back
  renderNeighbourhoods(zoneStats, meta);
  showSaved();
  renderPassport(cafes, saved.visited, zoneStats);
  renderCompareBar(compareCafes());
  showStats();
  refreshCrawlLanguage();
  refreshSuggestLanguage();
  refreshChatLanguage();
  refreshMapLanguage();
  if (osmState === 'ready') {
    buildBrandOptions(); // "All chains" in the new language
    showChainControls();
  }
  if (osmState === 'loading') setMoreStatus(t('more.loading'));
  if (osmState === 'failed') setMoreStatus(t('more.failed'));

  // The results, keeping as many cards on screen as before ("Show more"),
  // here and in the OpenStreetMap list
  const keep = shownCount;
  const keepOsm = osmShown;
  update();
  if (keep > shownCount) {
    const from = shownCount;
    shownCount = Math.min(keep, currentResults.length);
    appendResults(currentResults, from, shownCount, meta, saved, compareIds);
  }
  if (keepOsm > osmShown) updateOsm(keepOsm);
}

function startLanguageSwitch() {
  showLanguage(getLang());
  document.querySelectorAll('[data-lang]').forEach((button) => {
    button.addEventListener('click', () => changeLanguage(button.dataset.lang));
  });
}

/* ---------- Café of the day ---------- */

const DAY_STEP = 37;       // how far along the list the pick moves each day (see cafeOfTheDay)
let cafeOfTheDayKey = '';  // the Bangkok date it was last picked for, e.g. "2026-11-09"

// a and b's greatest common divisor: the biggest number that divides both
function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

// The same café for everyone on the same day, by the date in Bangkok.
// `dayNumber` goes up by one each day (see bangkokDate in clock.js).
// cafes.json is grouped by area, so simply taking the next café each day
// would stay in one area for a week or more. Instead the pick jumps DAY_STEP
// places along the list each day, going round and round. When the step and
// the number of cafés share no common divisor (gcd 1), every café gets a
// turn before any comes back. 37 works for the current list; if the list
// changes size, the loop moves to the next number that works.
function cafeOfTheDay(dayNumber) {
  let step = DAY_STEP;
  while (gcd(step, cafes.length) !== 1) step += 1;
  return cafes[(dayNumber * step) % cafes.length];
}

// Draw it, unless it's already showing today's (`force`: draw it anyway,
// after a language change)
function showCafeOfTheDay(force = false) {
  const today = bangkokDate();
  if (today.key === cafeOfTheDayKey && !force) return;
  cafeOfTheDayKey = today.key;
  renderCafeOfTheDay(cafeOfTheDay(today.dayNumber), today);
}

function showLoadError() {
  loadFailed = true;
  const status = document.querySelector('[data-load-status]');
  if (status) {
    status.textContent = t('finder.loadError');
  }
}


/* ---------- Start ---------- */
async function init() {
  startI18n(); // the page's fixed words in the language set in <head>
  startLanguageSwitch();
  initNav();
  startClock();
  bindChatButtons(handleChatButton);

  try {
    const data = await loadCafeData();
    meta = data.meta;
    cafes = data.cafes;
    cafesById = new Map(cafes.map((cafe) => [cafe.id, cafe]));
    setMeta(meta); // the English mood, feature and price labels
  } catch (error) {
    // A real problem, so it goes to the console for whoever is fixing it
    console.error(error, '\nIf you opened index.html by double-clicking it, run a local server instead: python -m http.server 8000');
    showLoadError();
    return;
  }

  showCafeSummary();
  showCafeOfTheDay();
  renderSources(cafes);
  startFinder();
}

init();
