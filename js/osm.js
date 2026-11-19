// osm.js: the extra cafés from OpenStreetMap (data/osm-cafes.json).
//
// cafes.json holds our hand-picked cafés, with moods, prices and a match
// score. osm-cafes.json holds about 500 more: the cafés in Bangkok on
// OpenStreetMap that we can trust are real and still open (edited since
// 2022, with at least two signs someone has checked them), made by
// tools/fetch-osm.mjs. They only have a name, a place, and sometimes a
// brand, opening hours, a street, a website, a Facebook page or a phone
// number, so they can't be scored. The site shows them separately: under
// "Also nearby" below the results, as grey pins on the map, and in the stats.
//
// The file is about 100 KB, so it's only downloaded when it's needed: when
// someone opens the map, presses "Show more cafés", reaches the stats, or
// the barista mentions chains. loadOsmCafes() downloads it once and every
// later call gets the same answer.
//
// On the page they look like ordinary cafés (with a small "Chain" tag for
// chains). The data is © OpenStreetMap contributors (ODbL): the credit
// "Café locations © OpenStreetMap contributors (ODbL)" is in the footer and
// the map's corner, which is where it must stay.

import { escapeHtml, hoursStatusHtml } from './ui.js';
import { t, featureLabel } from './i18n.js';
import { openStatus } from './clock.js';

const OSM_URL = 'data/osm-cafes.json';
const WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const OUTER_ZONE = 'Outer Bangkok'; // the zone for cafés far from all of ours (see tools/fetch-osm.mjs)

let loading = null; // a Promise, so the file is only downloaded once
let data = null;    // { cafes, byId, chainBrands, date } once it has loaded

// Lower-case and strip accents, so searching "cafe" finds "Café" (as in app.js)
function simplify(text) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// The file keeps each day's hours as one short text, Monday first:
//   ["07:00-20:00", "", "07:00-12:00,13:00-20:00", ...]   ("" = closed)
// The rest of the site reads hours as { mon: [{ open, close }], ... } (see
// "Opening hours" in docs/TECHNICAL.md), so turn it into that.
function toOpeningHours(week) {
  const hours = {};
  WEEK.forEach((day, i) => {
    hours[day] = week[i]
      ? week[i].split(',').map((span) => {
        const [open, close] = span.split('-');
        return { open, close };
      })
      : [];
  });
  return hours;
}

// One row of the file, with its short keys, into a café object with the same
// field names the hand-picked cafés use (name, zone, station, line, lat, lng,
// openingHours...), so the map and the open-now code can treat both alike.
//   i: id, n: name, t: Thai name, y: latitude, x: longitude,
//   z: zone (a place in file.zones), s: station (a place in file.stations),
//   b: brand (a place in file.brands), c: 1 for a chain,
//   f: features, o: opening_hours as written on OpenStreetMap, h: hours by day,
//   a: street, r: a chain's branch name, w: website, fb: Facebook page, p: phone
function expand(row, file) {
  const [station, line] = row.s === undefined ? ['', []] : file.stations[row.s];
  const brand = row.b === undefined ? '' : file.brands[row.b];
  const cafe = {
    id: row.i,
    name: row.n,
    nameTh: row.t || '',
    lat: row.y,
    lng: row.x,
    zone: file.zones[row.z],
    station,
    line,
    brand,
    type: row.c === 1 ? 'chain' : 'local',
    features: row.f || [],
    openingHoursRaw: row.o || '',
    openingHours: row.h ? toOpeningHours(row.h) : null,
    street: row.a || '',
    branch: row.r || '',
    website: row.w || '',
    facebook: row.fb || '',
    phone: row.p || '',
  };
  cafe.mapsUrl = mapsUrl(cafe);
  // Everything the search box looks through, simplified once here, not on every key press
  cafe.searchText = simplify([cafe.name, cafe.nameTh, brand, cafe.branch, cafe.street, cafe.zone].join(' '));
  return cafe;
}

// A Google Maps search for the café: its name, its branch, its street (or
// else its station, or else its area) and "Bangkok", e.g.
//   "Pitta Cafe, ซอยพระรามที่ 2 ซอย 50, Bangkok"   "Starbucks, Siam Square One, Bangkok"
// so Maps opens the place itself, with its photos, reviews and hours.
// A chain's name is generic: "Starbucks, BTS Asok" could be any of several
// branches. So a chain with no branch or street searches for the brand with
// the map centred on the café, zoomed right in (18z):
//   https://www.google.com/maps/search/Starbucks/@13.7286,100.5316,18z
// and Google shows the branch right there, with its own page.
function mapsUrl(cafe) {
  const search = (text) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
  if (cafe.type === 'chain' && !cafe.branch && !cafe.street) {
    return `https://www.google.com/maps/search/${encodeURIComponent(cafe.brand)}/@${cafe.lat},${cafe.lng},18z`;
  }
  const parts = [cafe.name];
  if (cafe.branch && !simplify(cafe.name).includes(simplify(cafe.branch))) parts.push(cafe.branch);
  // Our own area names aren't places Google knows, so the station or street
  // comes first; "(Asok to Phrom Phong)" is left off an area's name
  const area = cafe.zone === OUTER_ZONE ? '' : cafe.zone.replace(/\s*\(.*\)/, '');
  const near = cafe.street || cafe.station || area;
  if (near) parts.push(near);
  parts.push('Bangkok');
  return search(parts.join(', '));
}

// Download osm-cafes.json (only the first time) and get it ready.
// Resolves to { cafes, byId, chainBrands, date }.
export function loadOsmCafes() {
  if (!loading) {
    loading = fetch(OSM_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`Couldn't load ${OSM_URL} (status ${response.status})`);
        return response.json();
      })
      .then((file) => {
        const cafes = file.cafes.map((row) => expand(row, file));
        // Local cafés first, then chains; A to Z inside each
        const nameOrder = new Intl.Collator('en', { sensitivity: 'base' });
        cafes.sort((a, b) => (a.type === b.type ? 0 : a.type === 'local' ? -1 : 1) || nameOrder.compare(a.name, b.name));
        data = {
          cafes,
          byId: new Map(cafes.map((cafe) => [cafe.id, cafe])),
          chainBrands: countChainBrands(cafes),
          date: file.date,
          checked: file.checked, // how many cafés OpenStreetMap had, before the rules
        };
        return data;
      })
      .catch((error) => {
        loading = null; // let the next try download it again (say, once back online)
        throw error;
      });
  }
  return loading;
}

// The data, or null if it hasn't loaded yet
export function osmData() {
  return data;
}

// Every chain brand with its number of cafés, the most first:
// [{ name: 'Starbucks', count: 214 }, { name: 'Café Amazon', count: 189 }, ...]
function countChainBrands(cafes) {
  const counts = {};
  for (const cafe of cafes) {
    if (cafe.type === 'chain') counts[cafe.brand] = (counts[cafe.brand] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

// The finder's filters that make sense for these cafés: area, line, near
// BTS/MRT, open now and the search box. Moods, must-haves and price can't
// apply (OpenStreetMap doesn't know them), so they're left out.
// `chains` is { on: true/false, brand: 'Any' or a brand name }: chains only
// show when "Include chains" is on, and a chosen brand shows only that brand.
export function passesOsmFilters(cafe, filters, chains) {
  if (cafe.type === 'chain' && !chains.on) return false;
  if (chains.on && chains.brand !== 'Any' && cafe.brand !== chains.brand) return false;
  if (filters.zone !== 'Anywhere' && cafe.zone !== filters.zone) return false;
  if (filters.line && filters.line !== 'Any' && !cafe.line.includes(filters.line)) return false;
  if (filters.nearStation && !cafe.station) return false;
  // "Open now": only cafés whose hours say they're open (unknown hours are hidden, as in the finder)
  if (filters.openNow && openStatus(cafe.openingHours).state !== 'open') return false;
  if (filters.query && !cafe.searchText.includes(simplify(filters.query))) return false;
  return true;
}

// The OpenStreetMap cafés that pass the filters (already in order)
export function filterOsmCafes(filters, chains) {
  if (!data) return [];
  return data.cafes.filter((cafe) => passesOsmFilters(cafe, filters, chains));
}

// "Starbucks · chain" or a local café's brand, or '' when there's none
function brandText(cafe) {
  if (!cafe.brand) return '';
  return cafe.type === 'chain' ? t('osm.chainBrand', { name: cafe.brand }) : t('osm.brand', { name: cafe.brand });
}

// "Silom, Sathorn & Riverside · BTS Sala Daeng" (or "no BTS/MRT within 1 km")
function whereHtml(cafe) {
  const station = cafe.station
    ? escapeHtml(cafe.station)
    : `<span class="cafe-card__no-station">${escapeHtml(t('osm.noStation'))}</span>`;
  return `${escapeHtml(cafe.zone)} · ${station}`;
}

// A link that opens in a new tab. Screen readers hear which café it's for
// ("Website: Pitta Cafe (opens in a new tab)"), as every card has these links.
function outsideLinkHtml(url, text, cafe, className) {
  return `
    <a class="${className}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
      ${escapeHtml(text)}<span class="visually-hidden">: <span lang="en">${escapeHtml(cafe.name)}</span>${escapeHtml(t('newTab'))}</span>
    </a>`;
}

// The links at the foot of a card or pop-up: Google Maps, then the website,
// Facebook page and phone number when the café has them.
// `base` is 'osm-card' or 'map-popup'.
function linksHtml(cafe, base) {
  const links = [outsideLinkHtml(cafe.mapsUrl, t('drawer.maps'), cafe, `${base}__maps`)];
  if (cafe.website) links.push(outsideLinkHtml(cafe.website, t('osm.website'), cafe, `${base}__link`));
  if (cafe.facebook) links.push(outsideLinkHtml(cafe.facebook, t('osm.facebook'), cafe, `${base}__link`));
  if (cafe.phone) {
    // "tel:" wants only digits and "+": "02 610 9702" -> "tel:026109702"
    links.push(`
      <a class="${base}__link" href="tel:${escapeHtml(cafe.phone.replace(/[^\d+]/g, ''))}">
        <span class="visually-hidden">${escapeHtml(t('osm.call', { name: cafe.name }))}: </span>${escapeHtml(cafe.phone)}
      </a>`);
  }
  return links.join('');
}

// One card for an OpenStreetMap café. It's quieter than a hand-picked card:
// no match %, description, heart or Compare, and nothing to open, just the
// facts and its links. A chain gets a small grey "Chain" tag where a
// hand-picked card has its match %; a local café has nothing there.
export function osmCardHtml(cafe) {
  // The "Chain" tag already says it's a chain, so the brand line just names it
  const brand = cafe.brand ? t('osm.brand', { name: cafe.brand }) : '';
  const features = cafe.features.length > 0
    ? `<ul class="tags" aria-label="${escapeHtml(t('card.tags'))}">${cafe.features.map((key) => `<li class="tag">${escapeHtml(featureLabel(key))}</li>`).join(' ')}</ul>`
    : '';
  return `
    <li class="results__item osm-item">
      <article class="cafe-card osm-card" aria-label="${escapeHtml(cafe.name)}" data-osm-id="${escapeHtml(cafe.id)}">
        <div class="cafe-card__head">
          <div class="cafe-card__title">
            <h4 class="cafe-card__name" lang="en">${escapeHtml(cafe.name)}</h4>
            ${cafe.nameTh ? `<p class="osm-card__thai" lang="th">${escapeHtml(cafe.nameTh)}</p>` : ''}
          </div>
          ${cafe.type === 'chain' ? `<p class="osm-card__chain">${escapeHtml(t('osm.chainTag'))}</p>` : ''}
        </div>
        <p class="cafe-card__where osm-card__where">${whereHtml(cafe)}</p>
        ${brand ? `<p class="osm-card__brand">${escapeHtml(brand)}</p>` : ''}
        ${hoursStatusHtml(cafe)}
        ${features}
        <div class="osm-card__foot">${linksHtml(cafe, 'osm-card')}</div>
      </article>
    </li>`;
}

// What a grey or outlined pin's pop-up says (map.js puts it in the pop-up box)
export function osmPopupHtml(cafe) {
  const brand = brandText(cafe);
  return `
    <p class="map-popup__name" lang="en">${escapeHtml(cafe.name)}</p>
    ${cafe.nameTh ? `<p class="map-popup__thai" lang="th">${escapeHtml(cafe.nameTh)}</p>` : ''}
    <p class="map-popup__meta">${whereHtml(cafe)}${brand ? `<br>${escapeHtml(brand)}` : ''}</p>
    ${hoursStatusHtml(cafe, 'hours-status map-popup__hours')}
    <div class="map-popup__links">${linksHtml(cafe, 'map-popup')}</div>`;
}

// For the barista: how many chain cafés pass the chat's filters, and the
// two biggest brands among them ("Starbucks and Café Amazon").
// Resolves to { count, brands: ['Starbucks', 'Café Amazon'] }.
export async function countChains(filters) {
  await loadOsmCafes();
  const chains = filterOsmCafes({ ...filters, query: '' }, { on: true, brand: 'Any' })
    .filter((cafe) => cafe.type === 'chain');
  return { count: chains.length, brands: countChainBrands(chains).slice(0, 2).map(({ name }) => name) };
}
