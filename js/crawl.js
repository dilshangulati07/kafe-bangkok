// crawl.js: "Plan a café crawl".
//
// You pick where to start (a neighbourhood or a BTS/MRT station), a mood,
// and how many stops (2 to 4). The planner picks cafés with that mood that
// are close to each other, puts them in the order with the least walking,
// and shows them as a numbered list and on a small map (js/map.js). Any stop
// can be swapped for another café nearby, and the whole route opens in
// Google Maps.
//
// Distances are straight lines between the cafés' lat/lng ("as the crow
// flies"), so the real walk is a little longer. Stations' positions come
// from meta.stations in cafes.json.

import { escapeHtml, icon, ICONS, hoursStatusHtml } from './ui.js';
import { showCrawlMap } from './map.js';
import { t, tHtml, inEnglish, moodLabel } from './i18n.js';

const POOL_SIZE = 20;    // the planner tries routes through the 20 matching cafés closest to the start
const SWAP_CHOICES = 3;  // how many nearby cafés "Swap" offers
const FAR_LEG = 2000;    // metres: past this, walking between two stops is a lot

let cafes = [];
let meta = {};
let zones = [];
let plan = null; // the crawl on screen: { start, mood, wanted, stops: [café, ...] }

// The parts of the section that change (found once, in initCrawl)
let form;
let result;
let stopsList;
let status;


/* ---------- Distances ---------- */

// Metres between two { lat, lng } points, measured along the Earth's
// surface (the "haversine" formula). Plenty accurate across a city.
function distance(a, b) {
  const EARTH_RADIUS = 6371000; // metres
  const rad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h));
}

// 437 -> "450 m" (to the nearest 50 m, and never "0 m"), 1234 -> "1.2 km"
// (in Thai "450 ม." and "1.2 กม.")
function formatDistance(metres) {
  const rounded = Math.max(50, Math.round(metres / 50) * 50);
  if (rounded < 1000) return t('crawl.metres', { n: rounded });
  return t('crawl.km', { n: (metres / 1000).toFixed(1) });
}

// The walk, one number per stop: how far it is from the place before it.
// The first stop counts from the station; a neighbourhood isn't a real
// place you walk from, so then the first stop is null.
// Example from BTS Ari: [450, 300, 700] (station to 1, 1 to 2, 2 to 3)
function legs(start, stops) {
  return stops.map((cafe, index) => {
    if (index > 0) return distance(stops[index - 1], cafe);
    return start.kind === 'station' ? distance(start, cafe) : null;
  });
}

const totalOf = (legList) => legList.reduce((sum, metres) => sum + (metres || 0), 0);


/* ---------- Where the crawl starts ---------- */

// The Start dropdown's values look like "zone:Ari & Phaya Thai" or
// "station:BTS Ari". Turn one into a point on the map:
//   { kind: 'station', name: 'BTS Ari', lat, lng }   the station itself
//   { kind: 'zone', name: 'Ari & Phaya Thai', lat, lng }   the middle of its cafés
function startFromValue(value) {
  const [kind, ...rest] = value.split(':');
  const name = rest.join(':');
  if (kind === 'station' && meta.stations[name]) {
    return { kind, name, ...meta.stations[name] };
  }
  // The middle of a neighbourhood: the average lat and lng of its cafés
  const inZone = cafes.filter((cafe) => cafe.zone === name && hasLocation(cafe));
  const average = (key) => inZone.reduce((sum, cafe) => sum + cafe[key], 0) / inZone.length;
  return { kind: 'zone', name, lat: average('lat'), lng: average('lng') };
}

const hasLocation = (cafe) => typeof cafe.lat === 'number' && typeof cafe.lng === 'number';

// Every café with this mood that we can put on a map
function matchingCafes(mood) {
  return cafes.filter((cafe) => cafe.moods.includes(mood) && hasLocation(cafe));
}


/* ---------- The planner ---------- */

// Find the crawl with the least walking. Take the POOL_SIZE matching cafés
// closest to the start, then try every route through `count` of them (every
// choice of cafés, in every order) and keep the shortest. A route's length
// counts from the start point to the first café, then café to café.
// With 20 cafés and 4 stops there are 116,280 routes, but a route is dropped
// as soon as it's longer than the best one so far, so most are never
// finished: it takes a few milliseconds. (Checked on 9 November 2026: for
// every start, mood and number of stops, this finds the same crawl as trying
// every café in the list.)
function planCrawl(start, mood, count) {
  const pool = matchingCafes(mood)
    .sort((a, b) => distance(start, a) - distance(start, b))
    .slice(0, POOL_SIZE);
  const stops = Math.min(count, pool.length);

  let best = [];
  let bestLength = Infinity;

  // Build routes one café at a time. `route` is the cafés so far and
  // `length` the metres walked so far.
  function extend(route, length) {
    if (length >= bestLength) return; // already longer than the best one: no need to go on
    if (route.length === stops) {
      best = route;
      bestLength = length;
      return;
    }
    const from = route.length > 0 ? route[route.length - 1] : start;
    for (const cafe of pool) {
      if (!route.includes(cafe)) extend([...route, cafe], length + distance(from, cafe));
    }
  }

  extend([], 0);
  return best;
}

// Other cafés with the same mood that aren't in the crawl yet, the ones
// closest to `cafe` first. These are what "Swap" offers.
function swapChoices(cafe) {
  return matchingCafes(plan.mood)
    .filter((other) => !plan.stops.includes(other))
    .sort((a, b) => distance(cafe, a) - distance(cafe, b))
    .slice(0, SWAP_CHOICES);
}


/* ---------- Google Maps ---------- */

// A Google Maps directions link: from the station (or the first café),
// through the stops in between ("waypoints"), to the last café. Places are
// written as "lat,lng", so Google goes to the exact spots. Phones allow up
// to 3 waypoints, and 4 stops from a station need exactly 3.
// https://developers.google.com/maps/documentation/urls/get-started#directions-action
function googleMapsUrl(start, stops, legList) {
  const point = (place) => `${place.lat},${place.lng}`;
  const places = start.kind === 'station' ? [start, ...stops] : stops;
  const params = new URLSearchParams({
    api: '1',
    origin: point(places[0]),
    destination: point(places[places.length - 1]),
  });
  const between = places.slice(1, -1);
  if (between.length > 0) params.set('waypoints', between.map(point).join('|'));
  // Walking directions, unless two stops are far apart: then Google picks the best way
  if (legList.every((metres) => metres === null || metres <= FAR_LEG)) params.set('travelmode', 'walking');
  // URLSearchParams turns "|" into %7C and "," into %2C, as Google asks
  return `https://www.google.com/maps/dir/?${params}`;
}


/* ---------- Drawing the crawl ---------- */

// "450 m from BTS Ari", "First stop", "300 m from stop 1"
function legText(index, metres) {
  if (index > 0) return escapeHtml(t('crawl.legFromStop', { distance: formatDistance(metres), i: index }));
  if (metres === null) return escapeHtml(t('crawl.firstStop'));
  return escapeHtml(t('crawl.legFromStart', { distance: formatDistance(metres), name: plan.start.name }));
}

// One stop in the list. The CSS lays the parts out on a small grid (see
// .crawl-stop in style.css): the distance on top, then the number, the café
// and its Swap button, then the nearby cafés once Swap is pressed.
// The name has data-action="open", so app.js opens the drawer for it.
function stopHtml(cafe, index, metres) {
  const id = escapeHtml(cafe.id);
  const name = escapeHtml(cafe.name);
  const station = cafe.station ? ` · ${escapeHtml(cafe.station)}` : '';
  return `
    <li class="crawl-stop">
      <p class="crawl-stop__leg">${legText(index, metres)}</p>
      <span class="crawl-stop__num" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
      <div class="crawl-stop__body">
        <h4 class="crawl-stop__name">
          <button class="crawl-stop__open" type="button" data-action="open" data-id="${id}" aria-haspopup="dialog" lang="en">${name}</button>
        </h4>
        <p class="crawl-stop__where">${escapeHtml(cafe.area)}${station}</p>
        ${hoursStatusHtml(cafe)}
      </div>
      <button class="link-button crawl-stop__swap" type="button" data-swap="${index}" aria-expanded="false" aria-controls="crawl-swap-${index}">
        ${escapeHtml(t('crawl.swap'))}<span class="visually-hidden"> ${inEnglish(cafe.name)}</span>
      </button>
      <div class="crawl-swap" id="crawl-swap-${index}" hidden></div>
    </li>`;
}

// Draw the plan: the heading, the numbered stops, the Google Maps link and the map
function showPlan() {
  const { start, stops } = plan;
  const mood = moodLabel(plan.mood);
  const heading = result.querySelector('[data-crawl-title]');
  const note = result.querySelector('[data-crawl-note]');
  const layout = result.querySelector('[data-crawl-layout]');
  result.hidden = false;

  // Fewer than 2 cafés can't make a crawl (only if the data had almost none with this mood)
  if (stops.length < 2) {
    heading.textContent = t('crawl.notEnough', { mood });
    result.querySelector('[data-crawl-meta]').textContent = '';
    note.textContent = t('crawl.tryMood');
    layout.hidden = true;
    return;
  }
  layout.hidden = false;

  const legList = legs(start, stops);
  heading.textContent = t(start.kind === 'station' ? 'crawl.titleStation' : 'crawl.titleZone', { name: start.name });
  result.querySelector('[data-crawl-meta]').textContent = t('crawl.meta', { n: stops.length, mood, distance: formatDistance(totalOf(legList)) });

  const notes = [t('crawl.noteStraight')];
  if (stops.length < plan.wanted) notes.push(t('crawl.noteFew', { n: stops.length, mood }));
  if (legList.some((metres) => metres > FAR_LEG)) notes.push(t('crawl.noteFar'));
  note.textContent = notes.join(' ');

  stopsList.innerHTML = stops.map((cafe, index) => stopHtml(cafe, index, legList[index])).join('');
  result.querySelector('[data-crawl-maps]').href = googleMapsUrl(start, stops, legList);

  const mapNote = result.querySelector('[data-crawl-map-note]');
  mapNote.textContent = '';
  showCrawlMap(stops.map((cafe) => ({ cafe })), start.kind === 'station' ? start : null).then((ok) => {
    if (!ok) mapNote.textContent = t('crawl.mapFailed');
  });
}


/* ---------- Swapping a stop ---------- */

function closeSwapPanels() {
  stopsList.querySelectorAll('[data-swap]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
  stopsList.querySelectorAll('.crawl-swap').forEach((panel) => { panel.hidden = true; });
}

// "Swap" opens a small list of nearby cafés under the stop (pressing it again closes it)
function toggleSwap(index) {
  const button = stopsList.querySelector(`[data-swap="${index}"]`);
  const panel = document.getElementById(`crawl-swap-${index}`);
  const wasOpen = button.getAttribute('aria-expanded') === 'true';
  closeSwapPanels();
  if (wasOpen) return;

  const cafe = plan.stops[index];
  const choices = swapChoices(cafe);
  panel.innerHTML = choices.length === 0
    ? `<p class="crawl-swap__title">${escapeHtml(t('crawl.noSwap', { mood: moodLabel(plan.mood) }))}</p>`
    : `
      <p class="crawl-swap__title">${escapeHtml(t('crawl.nearby'))}</p>
      <ul class="crawl-swap__list">
        ${choices.map((other) => `
          <li>
            <button class="crawl-swap__option" type="button" data-swap-at="${index}" data-swap-to="${escapeHtml(other.id)}">
              <span class="crawl-swap__name" lang="en">${escapeHtml(other.name)}</span>
              <span class="crawl-swap__meta">${escapeHtml(t('crawl.away', { area: other.area, distance: formatDistance(distance(cafe, other)) }))}</span>
            </button>
          </li>`).join('')}
      </ul>`;
  button.setAttribute('aria-expanded', 'true');
  panel.hidden = false;
}

// Put another café in place of stop `index`. The other stops stay where they are.
function swapStop(index, id) {
  const cafe = cafes.find((other) => other.id === id);
  if (!cafe) return;
  plan.stops[index] = cafe;
  showPlan();
  // Focus the new café's name, and tell screen readers what changed
  stopsList.querySelectorAll('.crawl-stop__open')[index].focus();
  const total = totalOf(legs(plan.start, plan.stops));
  status.innerHTML = tHtml('crawl.swapped', { i: index + 1, name: inEnglish(cafe.name), distance: escapeHtml(formatDistance(total)) });
}


/* ---------- Setting up the form ---------- */

// Also used after a language change, so it keeps whatever was picked
function buildForm() {
  const pickedMood = form.querySelector('[name=crawlMood]:checked')?.value || Object.keys(meta.moods)[0];
  const pickedStart = form.elements.start.value;

  // Moods: one pill per mood in meta.moods. Radio buttons, because a crawl has one mood.
  form.querySelector('[data-crawl-moods]').innerHTML = Object.keys(meta.moods)
    .map((key) => `
      <label class="mood-pill">
        <input class="visually-hidden" type="radio" name="crawlMood" value="${escapeHtml(key)}"${key === pickedMood ? ' checked' : ''}>
        ${escapeHtml(moodLabel(key))}
      </label>`)
    .join('');

  // Start: the neighbourhoods, then every station that has a position in meta.stations
  const zoneOptions = zones
    .map((zone) => `<option value="zone:${escapeHtml(zone)}">${escapeHtml(zone)}</option>`)
    .join('');
  const stationOptions = Object.keys(meta.stations).sort()
    .map((station) => `<option value="station:${escapeHtml(station)}">${escapeHtml(station)}</option>`)
    .join('');
  form.elements.start.innerHTML = `
    <optgroup label="${escapeHtml(t('crawl.zones'))}">${zoneOptions}</optgroup>
    <optgroup label="${escapeHtml(t('crawl.stations'))}">${stationOptions}</optgroup>`;
  if (pickedStart) form.elements.start.value = pickedStart;
}

// After a language change: the form's words, and the plan if there is one
export function refreshCrawlLanguage() {
  if (!form) return;
  buildForm();
  if (plan && !result.hidden) showPlan();
}

// `options` is { cafes, meta, zones } from app.js (zones = the zone names, A to Z)
export function initCrawl(options) {
  ({ cafes, meta, zones } = options);
  form = document.getElementById('crawl-form');
  result = document.getElementById('crawl-result');
  stopsList = result.querySelector('[data-crawl-stops]');
  status = document.querySelector('[data-crawl-status]');

  buildForm();
  result.querySelector('[data-crawl-maps]').insertAdjacentHTML('beforeend', icon(ICONS.external, 'icon icon--sm'));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const start = startFromValue(data.get('start'));
    const mood = data.get('crawlMood');
    const wanted = Number(data.get('stops'));
    plan = { start, mood, wanted, stops: planCrawl(start, mood, wanted) };
    showPlan();
    status.textContent = '';
    // Move to the result, so screen readers read it and Tab carries on from there
    result.querySelector('[data-crawl-title]').focus();
  });

  // One listener for every Swap button and swap choice in the list
  stopsList.addEventListener('click', (event) => {
    const swapButton = event.target.closest('[data-swap]');
    const choice = event.target.closest('[data-swap-to]');
    if (swapButton) toggleSwap(Number(swapButton.dataset.swap));
    if (choice) swapStop(Number(choice.dataset.swapAt), choice.dataset.swapTo);
  });

  // Escape closes an open swap list (from inside it, or from its Swap
  // button) and puts focus on that Swap button
  stopsList.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const open = stopsList.querySelector('[data-swap][aria-expanded="true"]');
    if (!open) return;
    closeSwapPanels();
    open.focus();
  });

  document.getElementById('crawl-app').hidden = false;
}
