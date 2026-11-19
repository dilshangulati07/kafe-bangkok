// tools/fetch-osm.mjs: downloads every café in Bangkok from OpenStreetMap
// and cleans it into data/osm-cafes.json, the extra cafés the site shows
// under "Also nearby" and on the map.
//
// It isn't part of the website. Run it by hand with Node 18 or newer (it
// uses Node's built-in fetch, so there's nothing to install), from the
// project folder:
//
//   node tools/fetch-osm.mjs                                    download and clean
//   node tools/fetch-osm.mjs --save-raw data-raw/osm-raw.json   also keep OpenStreetMap's reply
//   node tools/fetch-osm.mjs --from data-raw/osm-raw.json       clean a saved reply again (no download)
//
// What it does:
//   1. Asks the Overpass API (a read-only search service for OpenStreetMap)
//      for every node and way tagged amenity=cafe inside Bangkok's boundary,
//      with each café's last edit date.
//   2. Keeps only cafés we can trust are real and still open (see "Which
//      cafés are kept" below): a real name, not tagged as closed, edited
//      since 2022, and at least 2 signs that someone has checked it.
//   3. Drops any café that is already one of our hand-picked cafés in
//      data/cafes.json (same name, within 150 m). cafes.json is only read.
//   4. For each café it keeps, works out its brand, chain or local, zone,
//      nearest BTS/MRT station, opening hours, street, and its website,
//      Facebook page and phone number when it has them.
//   5. Writes data/osm-cafes.json with short keys and no spaces, to keep it small.
//
// The data is © OpenStreetMap contributors, under the ODbL licence, so the
// site credits them wherever these cafés show.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('../', import.meta.url);
const CAFES_FILE = new URL('data/cafes.json', ROOT);
const OUT_FILE = new URL('data/osm-cafes.json', ROOT);

// The main Overpass server first; if it's busy (it often is), a mirror.
const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

// Bangkok (the Bangkok Metropolitan Administration) is the boundary tagged
// ISO3166-2=TH-10. "out center meta" gives each way (a building outline)
// one middle point, so it gets a lat/lng like a node, and adds each café's
// edit details: "timestamp" (when it was last changed in OpenStreetMap) is
// what the "edited since 2022" rule reads.
const QUERY = `
[out:json][timeout:180];
area["ISO3166-2"="TH-10"]["boundary"="administrative"]->.bangkok;
(
  node["amenity"="cafe"](area.bangkok);
  way["amenity"="cafe"](area.bangkok);
);
out center meta;`;

const DUPLICATE_DISTANCE = 150;  // metres: same name this close = one of our cafés
const STATION_DISTANCE = 1000;   // metres: the nearest station counts if it's this close
const ZONE_DISTANCE = 3000;      // metres: further than this from every hand-picked café = "Outer Bangkok"
const ZONE_NEIGHBOURS = 5;       // how many nearby hand-picked cafés vote on the zone
const CHAIN_BRANCHES = 5;        // a brand with this many cafés or more counts as a chain
const OUTER_ZONE = 'Outer Bangkok';


/* ---------- Known chains ----------
   Each chain has the name we show and the patterns that find it in a café's
   brand or name tags, in English and Thai. Any other brand with 5 or more
   cafés in the data becomes a chain too (see the end of clean()). */
const KNOWN_CHAINS = [
  ['Starbucks', /starbucks|สตาร์บัค/i],
  ['Café Amazon', /amazon|อเมซอน/i],
  ['True Coffee', /true\s*coffee|ทรู\s*คอฟฟี่/i],
  ['Inthanin', /inthanin|อินทนิล/i],
  ['All Café', /^all\s*caf|ออลคาเฟ่/i],
  ['Black Canyon', /black\s*canyon|แบล็ค\s*แคนยอน/i],
  ['Doi Chaang', /doi\s*chaang|ดอยช้าง/i],
  ['Coffee World', /coffee\s*world/i],
  ['Mezzo', /^mezzo\b|เมซโซ่/i],
  ["D'Oro", /\bd['’]?\s?oro\b|ดีโอโร่/i],
  ['Punthai', /punthai|พันธุ์ไทย|พันธ์ุไทย/i],
  ['Tom N Toms', /tom\s*n\s*toms/i],
  ['Hollys', /holly'?s/i],
  ['% Arabica', /%\s*arabica|^arabica\b/i],
  ['The Coffee Club', /coffee\s*club/i],
  ['Casa Lapin', /casa\s*lapin/i],
  ['Kudsan', /kudsan|กุดสั่น/i],
];

// Other brands that are spelt more than one way in the data (English and
// Thai). These only join the spellings up: they're chains only if they have
// CHAIN_BRANCHES cafés or more.
const OTHER_BRANDS = [
  ['ChaTraMue', /chatramue|cha\s*tra\s*mue|ชาตรามือ/i],
  ['Chao Doi', /chao\s*doi|ชาวดอย/i],
  ["Swensen's", /swensen/i],
  ['Mixue', /mixue|มี่เสวี่ย/i],
  ['S&P', /^s\s*&\s*p\b|เอส\s*แอนด์\s*พี/i],
  ['Wawee Coffee', /wawee|วาวี/i],
];

// Every brand named above. A branch of one of these is a "known chain"
// branch, one of the signs in trustSigns().
const NAMED_BRANDS = new Set([...KNOWN_CHAINS, ...OTHER_BRANDS].map(([brand]) => brand));


/* ---------- Which cafés are kept ----------
   Anyone can add a café to OpenStreetMap, and nobody has to remove it when
   it closes. So a café is removed if ANY of these is true:
     - it has no name, or only a generic one ("Coffee", "ร้านกาแฟ", "Coffee/คอฟฟี่/咖啡")
     - it's tagged as closed (disused:*, was:*, abandoned:*, end_date,
       or opening_hours "closed"/"off")
     - nobody has edited it in OpenStreetMap since EDITED_SINCE
   and the rest are kept only with at least MIN_SIGNS of these signs that
   someone has looked after it:
     opening hours, a website or social link, a phone number, a street
     address, a check_date or survey:date from CHECKED_SINCE or later,
     or being a branch of a known chain. */
const EDITED_SINCE = '2022-01-01';
const CHECKED_SINCE = 2023;
const MIN_SIGNS = 2;

// Words that say "this is a café" but not which one, in English, Thai and
// Chinese. A name made only of these words is generic.
const GENERIC_WORDS_EN = /\b(the|cafe|caffe|coffee|coffeeshop|shop|house|bar|stall|kiosk|fresh|tea|bakery|drinks?|and)\b/g;
const GENERIC_WORDS_TH = /ร้าน|กาแฟ|สด|คาเฟ่|คอฟฟี่|ขาย|น้ำ|เครื่องดื่ม|ชา/g; // Thai has no spaces, so these are cut out anywhere
const GENERIC_WORDS_ZH = /咖啡|店|館|馆|茶/g;

function isGenericName(text) {
  const left = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') // "café" -> "cafe"
    .replace(GENERIC_WORDS_EN, ' ')
    .replace(GENERIC_WORDS_TH, '')
    .replace(GENERIC_WORDS_ZH, '')
    .replace(/[^\p{L}\p{N}]+/gu, ''); // spaces, "/", "&", "-"... (letters in any alphabet stay)
  return left === '';
}

// Tagged as closed: "disused:amenity=cafe", "was:name=...", an end_date,
// or opening_hours that just says "closed"
function isClosed(tags) {
  if (Object.keys(tags).some((key) => /^(disused|was|abandoned):/.test(key))) return true;
  if (tags.end_date) return true;
  return /^(closed|off)$/i.test((tags.opening_hours || '').trim());
}

// The year at the start of a date tag ("2024-05-01" or "2024") as a number, or 0
const yearOf = (text) => Number((text || '').match(/^\d{4}/)?.[0] || 0);

// Which of the signs (see above) a café has, e.g. ['hours', 'phone']
function trustSigns(tags, brand) {
  const keys = Object.keys(tags);
  const signs = [];
  if (tags.opening_hours) signs.push('hours');
  // a website, Facebook, Instagram or other contact:* link (contact:phone counts as a phone)
  if (keys.some((key) => /^(website|contact:website|facebook|instagram)$/.test(key) || /^contact:(?!phone|mobile)/.test(key))) signs.push('link');
  if (keys.some((key) => /^(phone|mobile|phone:mobile|contact:phone|contact:mobile)$/.test(key))) signs.push('phone');
  if (tags['addr:street'] || tags['addr:housenumber']) signs.push('address');
  // check_date:opening_hours means someone checked the hours on the spot, so it counts too
  if ([tags.check_date, tags['check_date:opening_hours'], tags['survey:date']].some((date) => yearOf(date) >= CHECKED_SINCE)) signs.push('checked');
  if (NAMED_BRANDS.has(brand)) signs.push('chain');
  return signs;
}


/* ---------- Links ----------
   Cards show "Website", "Facebook" and the phone number when a café has
   them. Only http(s) links are kept, so a bad tag can't become a harmful link. */

// "www.cafe.com" or "https://cafe.com/" -> "https://cafe.com/", or '' if it isn't a web link
function cleanUrl(text) {
  if (!text) return '';
  let url = text.split(';')[0].trim(); // a few tags hold more than one link
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('.') ? parsed.href : '';
  } catch {
    return '';
  }
}

const isFacebookUrl = (url) => /(^|\.)(facebook|fb)\.com$/i.test(new URL(url).hostname);

// The facebook tag is a link or just a page name ("philcoffeecompany", "@cafe")
function facebookUrl(text) {
  if (!text) return '';
  const value = text.split(';')[0].trim();
  if (/(facebook|fb)\.com/i.test(value)) return cleanUrl(value);
  const page = value.replace(/^@/, '');
  return /^[\w.-]+$/.test(page) ? `https://www.facebook.com/${page}` : ''; // "sweet it is-wall" isn't a page name
}

function findLinks(tags) {
  let facebook = facebookUrl(tags['contact:facebook'] || tags.facebook);
  let website = '';
  for (const url of [tags.website, tags['contact:website']].map(cleanUrl).filter(Boolean)) {
    // Many cafés' "website" is their Facebook page: show it as Facebook
    if (isFacebookUrl(url)) facebook ||= url;
    else website ||= url;
  }
  const phone = (tags.phone || tags['contact:phone'] || tags.mobile || tags['contact:mobile'] || '').split(';')[0].trim();
  return { website, facebook, phone: phone.replace(/\D/g, '').length >= 6 ? phone : '' };
}


/* ---------- Small helpers ---------- */

// Straight-line distance in metres between two points (the haversine formula,
// the same one js/crawl.js uses).
function distance(lat1, lng1, lat2, lng2) {
  const rad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(a));
}

const hasThai = (text) => /[฀-๿]/.test(text);

// For comparing names: lower case, no accents, no punctuation, and without
// words every café has ("café", "coffee", "the", "bangkok").
function nameKey(text) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(the|cafe|coffee|roasters?|bangkok|bkk|shop|house|and)\b/g, ' ')
    .replace(/[^a-z0-9฀-๿]+/g, '');
}

// Two names are "the same café" when their keys match, one contains the
// other ("Factory" and "Factory Coffee Phaya Thai"), or they start with the
// same 5 letters or more ("Patom Organik Living" and "Patom Organic Living",
// "Rocket Coffeebar Sathorn 12" and "Rocket Coffee Bar"). This is only
// checked for cafés within 150 m of each other, so a shared start is
// very unlikely to be two different cafés.
function sameName(a, b) {
  const keyA = nameKey(a);
  const keyB = nameKey(b);
  if (keyA.length < 3 || keyB.length < 3) return keyA === keyB && keyA !== '';
  if (keyA.includes(keyB) || keyB.includes(keyA)) return true;
  let shared = 0;
  while (shared < keyA.length && keyA[shared] === keyB[shared]) shared += 1;
  return shared >= 5;
}

const round5 = (number) => Math.round(number * 1e5) / 1e5; // about 1 m


/* ---------- Opening hours ----------
   OpenStreetMap's opening_hours tag looks like "Mo-Fr 07:00-20:00; Sa,Su 08:00-18:00".
   This turns the common forms into one text per day, Monday first:
     ["07:00-20:00", ..., "08:00-18:00", "08:00-18:00"]
   "" means closed that day, and "07:00-12:00,13:00-20:00" is two openings.
   Anything it doesn't understand (months, "sunrise", "Monday - Saturday",
   "AM/PM"...) gives null, and the site shows "Hours unknown". Public-holiday
   rules ("PH off") are skipped, as the site only knows a normal week. */
const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// "mo", "tue" or "saturday" -> its place in the week (0 = Monday), or -1.
// A word counts if it's the start of a day's English name, at least 2 letters.
function dayIndex(word) {
  if (word.length < 2) return -1;
  return DAY_NAMES.findIndex((dayName) => dayName.startsWith(word));
}

// "Mo-Fr" -> {0..4}, "Sa,Su" -> {5, 6}, "Fr-Mo" goes round the weekend.
// Returns null if it can't read the days.
function readDays(text) {
  const days = new Set();
  for (const part of text.split(',').map((piece) => piece.trim().toLowerCase()).filter(Boolean)) {
    if (part === 'ph') continue; // public holidays: skipped (see above)
    if (part === 'everyday' || part === 'daily') {
      [0, 1, 2, 3, 4, 5, 6].forEach((day) => days.add(day));
      continue;
    }
    const range = part.match(/^([a-z]+)(?:\s*-\s*([a-z]+))?$/);
    if (!range) return null;
    const from = dayIndex(range[1]);
    const to = range[2] ? dayIndex(range[2]) : from;
    if (from < 0 || to < 0) return null;
    for (let day = from; ; day = (day + 1) % 7) {
      days.add(day);
      if (day === to) break;
    }
  }
  return days;
}

// "07:00-20:00", "7.30-17.00" or "07:00-12:00,13:00-20:00" -> "07:00-20:00" / null
function readTimes(text) {
  const spans = [];
  for (const part of text.split(',').map((piece) => piece.trim())) {
    const match = part.match(/^(\d{1,2})[:.](\d{2})\s*-\s*(\d{1,2})[:.](\d{2})$/);
    if (!match) return null;
    const [open, close] = [[match[1], match[2]], [match[3], match[4]]]
      .map(([h, m]) => `${h.padStart(2, '0')}:${m}`);
    if (Number(open.slice(0, 2)) > 24 || Number(close.slice(0, 2)) > 24) return null;
    spans.push(`${open}-${close}`);
  }
  return spans.join(',');
}

export function parseOpeningHours(raw) {
  if (!raw) return null;
  // Comments in quotes ("last order 21:00") don't change the hours
  const text = raw.replace(/"[^"]*"/g, '').trim();
  const week = Array(7).fill(''); // a day no rule names is closed
  let anyRule = false;

  // Rules are split by ";". Some mappers use "," between rules instead
  // ("Mo-Fr 08:00-18:00, Sa-Su 09:00-18:00"), so a "," after a time and
  // before a day splits too. (A "," between days, "Mo,We", doesn't.)
  const rules = text.split(/;|(?<=\d)\s*,(?=\s*[A-Za-z]{2})/).map((rule) => rule.trim()).filter(Boolean);
  for (const rule of rules) {
    if (rule === '24/7') {
      week.fill('00:00-24:00');
      anyRule = true;
      continue;
    }
    // "Mo-Fr 07:00-20:00", "Sa-Su off", or only times ("10:00-22:00" = every
    // day). The days are everything before the first digit or off/closed/open.
    const at = rule.search(/\d|\b(?:off|closed|open)\b/i);
    if (at < 0) return null;
    const dayText = rule.slice(0, at).trim();
    const rest = rule.slice(at).trim().toLowerCase();
    const days = dayText ? readDays(dayText) : new Set([0, 1, 2, 3, 4, 5, 6]);
    if (!days) return null;
    if (days.size === 0) continue; // a public-holiday rule only
    let times;
    if (rest === 'off' || rest === 'closed') times = '';
    else if (rest === 'open') continue; // "PH open"
    else times = readTimes(rest);
    if (times === null) return null;
    // A later rule replaces an earlier one for its days (OpenStreetMap's rule)
    for (const day of days) week[day] = times;
    anyRule = true;
  }
  return anyRule ? week : null;
}


/* ---------- Download ----------
   The Overpass servers are free and often busy (they answer 502 or 504).
   So the script takes turns asking each server, waits a little between
   rounds, and keeps trying for up to RETRY_FOR. Each try is cut off after
   REQUEST_TIMEOUT, so one slow server can't use up all the time. */
const RETRY_FOR = 5 * 60 * 1000;      // 5 minutes in all
const REQUEST_TIMEOUT = 90 * 1000;    // a good answer takes well under a minute
const RETRY_WAIT = 20 * 1000;         // pause between rounds

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function download() {
  const giveUpAt = Date.now() + RETRY_FOR;
  for (let round = 1; ; round += 1) {
    for (const server of SERVERS) {
      const data = await askServer(server, round);
      if (data) return data;
      if (Date.now() >= giveUpAt) throw new Error('No Overpass server answered in 5 minutes. Try again later.');
    }
    console.log(`  waiting ${RETRY_WAIT / 1000} s before trying again`);
    await wait(RETRY_WAIT);
  }
}

// One try at one server: OpenStreetMap's reply, or null if it didn't work
async function askServer(server, round) {
  try {
    console.log(`Asking ${server} (round ${round}) ...`);
    const response = await fetch(server, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'KafeBangkok-data-refresh/1.0 (static café-finder website)',
      },
      body: `data=${encodeURIComponent(QUERY)}`,
    });
    if (!response.ok) {
      await response.body?.cancel(); // let go of the connection before trying the next server
      throw new Error(`status ${response.status}`);
    }
    const data = await response.json();
    if (!Array.isArray(data.elements)) throw new Error('no elements in the reply');
    console.log(`  got ${data.elements.length} cafés`);
    return data;
  } catch (error) {
    const why = error.name === 'TimeoutError' ? `no answer in ${REQUEST_TIMEOUT / 1000} s` : error.message;
    console.warn(`  that didn't work (${why})`);
    return null;
  }
}


/* ---------- Cleaning ---------- */

// Which brand a café belongs to, from its brand tags, then its names.
// Returns a known brand name, or the brand tag as written, or ''.
function findBrand(tags) {
  const brandTags = [tags['brand:en'], tags.brand].filter(Boolean);
  const nameTags = [tags['name:en'], tags.name, tags['name:th']].filter(Boolean);
  for (const [brand, pattern] of [...KNOWN_CHAINS, ...OTHER_BRANDS]) {
    if (brandTags.some((text) => pattern.test(text)) || nameTags.some((text) => pattern.test(text))) return brand;
  }
  return brandTags[0] || '';
}

// The zone: the most common zone among the hand-picked cafés closest to it
// (ties go to the closest café's zone). If even the closest hand-picked café
// is more than ZONE_DISTANCE away, it's out in the suburbs: "Outer Bangkok".
function findZone(lat, lng, handPicked) {
  const nearest = handPicked
    .map((cafe) => ({ zone: cafe.zone, metres: distance(lat, lng, cafe.lat, cafe.lng) }))
    .sort((a, b) => a.metres - b.metres)
    .slice(0, ZONE_NEIGHBOURS)
    .filter((near) => near.metres <= ZONE_DISTANCE);
  if (nearest.length === 0) return OUTER_ZONE;
  const votes = {};
  for (const { zone } of nearest) votes[zone] = (votes[zone] || 0) + 1;
  const most = Math.max(...Object.values(votes));
  return nearest.find(({ zone }) => votes[zone] === most).zone;
}

// The nearest station in meta.stations, if it's within STATION_DISTANCE
function findStation(lat, lng, stations) {
  let best = '';
  let bestMetres = STATION_DISTANCE;
  for (const [name, spot] of Object.entries(stations)) {
    const metres = distance(lat, lng, spot.lat, spot.lng);
    if (metres <= bestMetres) {
      best = name;
      bestMetres = metres;
    }
  }
  return best;
}

// Must-have style features we can read from the tags
function findFeatures(tags, names) {
  const features = [];
  if (tags.outdoor_seating && tags.outdoor_seating !== 'no') features.push('outdoor');
  if (tags.internet_access === 'wlan') features.push('wifi');
  const sweet = /dessert|bakery|cake|ขนม|เบเกอรี่/i;
  if (sweet.test(tags.cuisine || '') || names.some((name) => sweet.test(name))) features.push('dessert');
  return features;
}

function clean(raw, cafeData) {
  const { meta, cafes: handPicked } = cafeData;
  const placedHandPicked = handPicked.filter((cafe) => typeof cafe.lat === 'number');

  // Each station's line(s), taken from the hand-picked cafés at that station
  const stationLines = {};
  for (const cafe of handPicked) {
    if (cafe.station) stationLines[cafe.station] = cafe.line;
  }

  // Why each removed café went (each counts once, under the first reason that fits)
  const counts = { downloaded: raw.elements.length, noPlace: 0, noName: 0, generic: 0, closed: 0, old: 0, duplicate: 0, fewSigns: 0 };
  const duplicates = [];
  const kept = [];

  // The "edited since" rule needs each café's edit date, which "out center
  // meta" adds. An older saved download without dates skips that rule.
  const hasEditDates = raw.elements.some((element) => element.timestamp);

  // Branches per brand (and cafés per name, for cafés with no brand tag)
  // across every named café in the download, not only the ones kept, so a
  // chain stays a chain even when only a few of its branches pass the rules.
  const branchesInDownload = {};
  const namesInDownload = {};

  for (const element of raw.elements) {
    const tags = element.tags || {};
    const lat = element.lat ?? element.center?.lat;
    const lng = element.lon ?? element.center?.lon;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      counts.noPlace += 1;
      continue;
    }

    // English name if there is one, else the name; the Thai name beside it
    const name = (tags['name:en'] || tags.name || '').trim();
    if (!name) {
      counts.noName += 1;
      continue;
    }
    if ([tags['name:en'], tags.name, tags['name:th']].filter(Boolean).every(isGenericName)) {
      counts.generic += 1;
      continue;
    }
    const brand = findBrand(tags);
    if (brand) branchesInDownload[brand] = (branchesInDownload[brand] || 0) + 1;
    else namesInDownload[name] = (namesInDownload[name] || 0) + 1;

    if (isClosed(tags)) {
      counts.closed += 1;
      continue;
    }
    // "2021-08-14T09:30:00Z" comes before "2022-01-01": not edited since then
    if (hasEditDates && (element.timestamp || '') < EDITED_SINCE) {
      counts.old += 1;
      continue;
    }
    let nameTh = (tags['name:th'] || '').trim();
    if (!nameTh && tags.name && hasThai(tags.name) && tags.name !== name) nameTh = tags.name.trim();
    if (nameTh === name) nameTh = '';

    // Already one of our hand-picked cafés? (same name within 150 m)
    const names = [name, nameTh, tags.name, tags['name:en']].filter(Boolean);
    const twin = placedHandPicked.find((cafe) => distance(lat, lng, cafe.lat, cafe.lng) <= DUPLICATE_DISTANCE
      && names.some((other) => sameName(other, cafe.name)));
    if (twin) {
      counts.duplicate += 1;
      duplicates.push(`${name} = ${twin.name}`);
      continue;
    }

    if (trustSigns(tags, brand).length < MIN_SIGNS) {
      counts.fewSigns += 1;
      continue;
    }

    const station = findStation(lat, lng, meta.stations);
    kept.push({
      id: `${element.type[0]}${element.id}`, // "n311073587" (node) or "w123" (way)
      name,
      nameTh,
      lat: round5(lat),
      lng: round5(lng),
      brand,
      // For the Google Maps search: the street (a few tags hold a whole
      // address, so only up to the first comma) and a chain's branch name
      street: (tags['addr:street'] || '').split(',')[0].trim(),
      branch: (tags.branch || '').trim(),
      ...findLinks(tags),
      zone: findZone(lat, lng, placedHandPicked),
      station,
      features: findFeatures(tags, names),
      openingHoursRaw: tags.opening_hours || '',
      openingHours: parseOpeningHours(tags.opening_hours),
    });
  }

  // Chains: the known ones, plus any brand with CHAIN_BRANCHES cafés or more
  // in the download. A café with no brand but a name shared by that many
  // cafés counts too (generic names like "Coffee" were removed above, so they can't).
  const knownChains = new Set(KNOWN_CHAINS.map(([brand]) => brand));
  for (const cafe of kept) {
    if (!cafe.brand && namesInDownload[cafe.name] >= CHAIN_BRANCHES) {
      cafe.brand = cafe.name;
      branchesInDownload[cafe.name] = namesInDownload[cafe.name];
    }
  }
  const isChain = (brand) => knownChains.has(brand) || branchesInDownload[brand] >= CHAIN_BRANCHES;

  // Cafés kept per brand: the file lists brands with the most first
  const perBrand = {};
  for (const cafe of kept) {
    if (cafe.brand) perBrand[cafe.brand] = (perBrand[cafe.brand] || 0) + 1;
  }

  // Lists the cafés point into by number, to keep the file small
  const zones = [...new Set(handPicked.map((cafe) => cafe.zone))].sort().concat(OUTER_ZONE);
  const stations = Object.keys(meta.stations).sort();
  const brands = Object.entries(perBrand).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([brand]) => brand);

  // Short keys (see "OpenStreetMap cafés" in docs/TECHNICAL.md). Empty values are left out.
  const out = kept
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))
    .map((cafe) => {
      const row = { i: cafe.id, n: cafe.name };
      if (cafe.nameTh) row.t = cafe.nameTh;
      row.y = cafe.lat;
      row.x = cafe.lng;
      row.z = zones.indexOf(cafe.zone);
      if (cafe.station) row.s = stations.indexOf(cafe.station);
      if (cafe.brand) row.b = brands.indexOf(cafe.brand);
      if (isChain(cafe.brand)) row.c = 1;
      if (cafe.features.length > 0) row.f = cafe.features;
      if (cafe.openingHoursRaw) row.o = cafe.openingHoursRaw;
      if (cafe.openingHours) row.h = cafe.openingHours;
      if (cafe.street) row.a = cafe.street;
      if (cafe.branch) row.r = cafe.branch;
      if (cafe.website) row.w = cafe.website;
      if (cafe.facebook) row.fb = cafe.facebook;
      if (cafe.phone) row.p = cafe.phone;
      return row;
    });

  const file = {
    about: 'Cafés in Bangkok from OpenStreetMap (amenity=cafe), cleaned by tools/fetch-osm.mjs. © OpenStreetMap contributors, ODbL 1.0: https://www.openstreetmap.org/copyright',
    date: (raw.osm3s?.timestamp_osm_base || new Date().toISOString()).slice(0, 10),
    checked: counts.downloaded, // how many cafés OpenStreetMap had (the stats say "N of M")
    zones,
    stations: stations.map((stationName) => [stationName, stationLines[stationName] || []]),
    brands,
    cafes: out,
  };

  const chains = out.filter((row) => row.c).length;
  console.log(`Downloaded ${counts.downloaded} cafés. Removed:`);
  console.log(`  ${counts.noName} with no name, ${counts.generic} with a generic name, ${counts.noPlace} with no position`);
  console.log(`  ${counts.closed} tagged as closed`);
  if (hasEditDates) console.log(`  ${counts.old} not edited since ${EDITED_SINCE}`);
  else console.warn(`  (none for age: this download has no edit dates, so the "edited since ${EDITED_SINCE}" rule was skipped. Download again to apply it.)`);
  console.log(`  ${counts.duplicate} already hand-picked`);
  console.log(`  ${counts.fewSigns} with fewer than ${MIN_SIGNS} signs (hours, link, phone, address, recent check, known chain)`);
  console.log(`Kept ${out.length}: ${out.length - chains} local and ${chains} chain cafés.`);
  console.log(`Hours read for ${out.filter((row) => row.h).length} of the ${out.filter((row) => row.o).length} with an opening_hours tag.`);
  console.log(`Links: ${out.filter((row) => row.w).length} websites, ${out.filter((row) => row.fb).length} Facebook pages, ${out.filter((row) => row.p).length} phone numbers.`);
  return { file, duplicates };
}


/* ---------- Run ---------- */

function option(flag) {
  const at = process.argv.indexOf(flag);
  return at > 0 ? process.argv[at + 1] : null;
}

async function main() {
  const fromFile = option('--from');
  const saveRaw = option('--save-raw');
  const raw = fromFile ? JSON.parse(readFileSync(fromFile, 'utf8')) : await download();
  if (saveRaw) {
    mkdirSync(dirname(saveRaw), { recursive: true }); // e.g. data-raw/
    writeFileSync(saveRaw, JSON.stringify(raw));
    console.log(`Saved OpenStreetMap's reply in ${saveRaw}.`);
  }

  const cafeData = JSON.parse(readFileSync(CAFES_FILE, 'utf8'));
  const { file, duplicates } = clean(raw, cafeData);
  if (process.argv.includes('--show-duplicates')) console.log(duplicates.join('\n'));

  writeFileSync(OUT_FILE, JSON.stringify(file));
  console.log(`Wrote data/osm-cafes.json (${(JSON.stringify(file).length / 1024).toFixed(0)} KB).`);
}

// Only run when started from the command line (not when imported by a test)
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    // exitCode (not process.exit) lets Node close its network connections first;
    // process.exit() here can crash Node on Windows with a libuv assertion
    process.exitCode = 1;
  });
}
