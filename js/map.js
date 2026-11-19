// map.js: the Map view of the results.
//
// It uses Leaflet, a small open-source map library, with map pictures
// ("tiles") from OpenStreetMap. Leaflet is only downloaded the first time
// someone opens the map, so people who only use the list never load it.
//
// app.js decides which cafés to show (the same filtered list as the List
// view) and calls showMap(results). Each café with a known lat/lng gets a
// small navy pin; clicking a pin shows its name, area, match % and a
// "Details" button that opens the café drawer.
//
// Cafés close together are grouped into one numbered navy circle by
// Leaflet.markercluster (a Leaflet add-on). Without it, zoomed out over the
// whole city, dozens of pins would sit on top of each other and be too
// small and crowded to tap. Clicking a circle zooms in until they separate.
//
// Once the extra cafés from OpenStreetMap have loaded (js/osm.js), they go
// on the same map: local cafés as smaller grey pins, chains as small
// outlined pins. Their pop-up has the facts and a Google Maps link instead
// of "Details". They share the cluster circles with our cafés (two sets of
// circles on top of each other would hide each other); a circle is navy if
// it holds at least one hand-picked café, and white if it's only
// OpenStreetMap cafés.
//
// The same file draws the small map in "Plan a café crawl" (showCrawlMap,
// at the bottom): numbered pins for the stops and a dotted line between them.

import { escapeHtml } from './ui.js';
import { t, inEnglish } from './i18n.js';
import { osmPopupHtml } from './osm.js';

// Leaflet from cdnjs, pinned to one version. "integrity" is a fingerprint of
// the exact file: if the file on the CDN ever changed, the browser would
// refuse to run it.
const LEAFLET_JS = {
  src: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  integrity: 'sha512-puJW3E/qXDqYp9IfhAI54BJEaWIfloJ7JWs7OeD5i6ruC9JZL1gERT1wjtwXFlh7CjE7ZJ+/vcRZRkIYIb6p4g==',
};
const LEAFLET_CSS = {
  href: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  integrity: 'sha512-h9FcoyWjHcOcmEVkxOfTLnmZFWIH0iZhZT1H2TbOq55xssQGEJHEaIm+PgoUaZbRvQTNTluNOEfb1ZRy6D3BOw==',
};
// Leaflet.markercluster, also pinned. Only its layout CSS is loaded: the
// circles' look (navy, white number) comes from style.css, not its colourful default theme.
const CLUSTER_JS = {
  src: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.js',
  integrity: 'sha512-OFs3W4DIZ5ZkrDhBFtsCP6JXtMEDGmhl0QPlmWYBJay40TT1n3gt2Xuw8Pf/iezgW9CdabjkNChRqozl/YADmg==',
};
const CLUSTER_CSS = {
  href: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.css',
  integrity: 'sha512-mQ77VzAakzdpWdgfL/lM1ksNy89uFgibRQANsNneSTMD/bj0Y/8+94XMwYhnbzx8eki2hrbPpDm0vD0CiT2lcg==',
};

// OpenStreetMap's tiles must always show this credit (it's part of their rules)
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const BANGKOK = [13.7465, 100.5348]; // where the map starts before any pins are added

// Room left round the map's edges when it zooms to fit cafés, so no pin or
// circle ends up under the + / – buttons or the map credit in the corners
const EDGE_PADDING = [48, 48];

let leafletReady = null; // a Promise, so Leaflet is only loaded once
let map = null;          // the Leaflet map, made the first time it's shown
let pins = null;         // the cluster group holding all the pins, emptied on every redraw
let openMarker = null;   // the pin whose pop-up is open, if any
let osmCredit = '';      // the "Café locations © OpenStreetMap" credit on the map now, if any
const osmMarkers = new Map(); // an OpenStreetMap café's pin, made once and kept (see osmMarker)

// Add a <script> or <link> tag and wait for it to load
function loadTag(tag, attributes) {
  return new Promise((resolve, reject) => {
    const el = document.createElement(tag);
    Object.assign(el, attributes, { crossOrigin: 'anonymous' });
    el.addEventListener('load', resolve);
    el.addEventListener('error', () => reject(new Error(`Couldn't load ${attributes.src || attributes.href}`)));
    document.head.append(el);
  });
}

// Leaflet first, then the cluster add-on (it needs window.L to exist)
function loadLeaflet() {
  if (!leafletReady) {
    leafletReady = Promise.all([
      loadTag('link', { rel: 'stylesheet', ...LEAFLET_CSS }),
      loadTag('script', LEAFLET_JS),
    ]).then(() => Promise.all([
      loadTag('link', { rel: 'stylesheet', ...CLUSTER_CSS }),
      loadTag('script', CLUSTER_JS),
    ])).catch((error) => {
      leafletReady = null; // let the next try load it again (say, once back online)
      throw error;
    });
  }
  return leafletReady;
}

const lessMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// A new Leaflet map inside `canvas`, with OpenStreetMap's tiles and credit.
// The results map and the crawl map both start like this.
function newMap(canvas) {
  const L = window.L;
  const leafletMap = L.map(canvas, {
    center: BANGKOK,
    zoom: 12,
    zoomControl: false, // added just below, with its words in our language
    // The mouse wheel scrolls the page, not the map (use the + and - buttons,
    // or pinch on a phone). Otherwise scrolling past the map would zoom it.
    scrollWheelZoom: false,
    // No sliding and fading for people who asked for less motion
    zoomAnimation: !lessMotion(),
    fadeAnimation: !lessMotion(),
    markerZoomAnimation: !lessMotion(),
  });
  addZoomButtons(leafletMap);
  // Leaflet's own credit, without its little flag icon
  leafletMap.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
  L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(leafletMap);
  return leafletMap;
}

// The + and – buttons. Leaflet labels them "Zoom in" and "Zoom out" in
// English, so they're made here with the words from i18n.js.
const zoomButtons = new Map(); // each map's zoom buttons, so they can be swapped after a language change

function addZoomButtons(leafletMap) {
  zoomButtons.get(leafletMap)?.remove();
  const control = window.L.control.zoom({ zoomInTitle: t('map.zoomIn'), zoomOutTitle: t('map.zoomOut') }).addTo(leafletMap);
  zoomButtons.set(leafletMap, control);
}

// After a language change: new zoom buttons on every map made so far.
// (Pins, circles and pop-ups get their words when they're next drawn.)
export function refreshMapLanguage() {
  for (const leafletMap of zoomButtons.keys()) addZoomButtons(leafletMap);
  if (osmCredit) setOsmCredit(true); // the OpenStreetMap credit in the new language
}

// "Café locations © OpenStreetMap contributors (ODbL)" in the map's credit
// line, while OpenStreetMap cafés are on the map (their licence asks for it)
function setOsmCredit(on) {
  if (osmCredit) map.attributionControl.removeAttribution(osmCredit);
  osmCredit = on ? t('map.osmCredit') : '';
  if (osmCredit) map.attributionControl.addAttribution(osmCredit);
}

function createMap(canvas) {
  const L = window.L;
  map = newMap(canvas);

  pins = L.markerClusterGroup({
    iconCreateFunction: clusterIcon,
    showCoverageOnHover: false,   // no blue outline of the group's area on hover
    spiderfyOnMaxZoom: true,      // cafés in the same building fan out at full zoom
    zoomToBoundsOnClick: false,   // we do the zooming ourselves, just below
    animate: !lessMotion(),
    chunkedLoading: true,         // adds hundreds of pins in small steps, so the page never freezes
    // Once the last step is done, check which pins sit outside or under something
    chunkProgress: (done, total) => { if (done === total) switchOffCovered(); },
    spiderLegPolylineOptions: { color: '#1F2A44', weight: 1.5, opacity: 0.5 },
  }).addTo(map);

  // A click (or Enter) on a circle zooms in until its cafés separate, with
  // room round the edges. If they're in the same building, zooming wouldn't
  // separate them, so the add-on fans them out instead (that's "spiderfy").
  pins.on('clusterclick clusterkeypress', (event) => {
    if (event.type === 'clusterkeypress' && event.originalEvent.key !== 'Enter') return;
    const bounds = event.layer.getBounds();
    if (map.getBoundsZoom(bounds) >= map.getMaxZoom()) return;
    // How far in can we go and still fit all of the circle's cafés, with the padding?
    const fitZoom = map.getBoundsZoom(bounds, false, L.point(EDGE_PADDING).multiplyBy(2));
    if (fitZoom > map.getZoom()) {
      map.fitBounds(bounds, { padding: EDGE_PADDING });
    } else {
      // The circle already fills the view (say, most of the city): go in one step around it
      map.setView(event.layer.getLatLng(), map.getZoom() + 1);
    }
  });

  // Pins and circles move whenever the map does, so check what's covered again
  map.on('moveend', switchOffCovered);
  pins.on('animationend', switchOffCovered); // circles splitting or joining
  map.on('popupclose', () => {
    openMarker = null;
    setTimeout(switchOffCovered, 250); // after the pop-up has faded out
  });
}

// Things that sit on top of the map: an open pop-up, the + / – buttons and the credit
const COVERS = '#map-canvas .leaflet-popup, #map-canvas .leaflet-control-zoom, #map-canvas .leaflet-control-attribution';

// Any pin or circle partly hidden behind one of those is switched off
// ("inert": no clicks, no Tab stop) until the map moves again. Otherwise the
// sliver peeking out would be a target too small to tap. Tapping there just
// reaches the map, and moving the map brings the café back.
// The same goes for pins and circles that stick out past the map's edge.
// The cluster add-on keeps a few just outside the view; if the keyboard
// focused one, the browser would scroll the map box to show it, the add-on
// would redraw, and the focused circle (with the keyboard focus) would vanish.
function switchOffCovered() {
  const boxes = [...document.querySelectorAll(COVERS)].map((el) => el.getBoundingClientRect());
  const frame = document.getElementById('map-canvas').getBoundingClientRect();
  for (const icon of document.querySelectorAll('#map-canvas .leaflet-marker-icon')) {
    if (openMarker && icon === openMarker.getElement()) {
      icon.inert = false; // the pin whose pop-up is open stays as it is
      continue;
    }
    const r = icon.getBoundingClientRect();
    const outside = r.left < frame.left || r.right > frame.right || r.top < frame.top || r.bottom > frame.bottom;
    icon.inert = outside || boxes.some((box) => r.left < box.right && r.right > box.left && r.top < box.bottom && r.bottom > box.top);
  }
}

// A group of cafés: a navy circle with the number in it, bigger for bigger
// groups. Screen readers hear "12 cafés here. Zoom in to see them." (Leaflet
// already makes it a focusable button, and Enter zooms in, like a click.)
// A circle with no hand-picked café in it (only OpenStreetMap cafés) is
// white with a navy outline and number instead (map-cluster--osm).
function clusterIcon(cluster) {
  const L = window.L;
  const count = cluster.getChildCount();
  const size = count < 10 ? 36 : count < 50 ? 42 : count < 500 ? 48 : 54;
  const hasHandPicked = cluster.getAllChildMarkers().some((marker) => marker.options.handPicked);
  return L.divIcon({
    className: hasHandPicked ? 'map-cluster' : 'map-cluster map-cluster--osm',
    iconSize: [size, size],
    html: `<span aria-hidden="true">${count}</span><span class="visually-hidden">${escapeHtml(t('map.cluster', { n: count }))}</span>`,
  });
}

// The small box that opens when a pin is clicked
function popupContent({ cafe, score }, onDetails) {
  const box = document.createElement('div');
  box.className = 'map-popup';
  const match = score > 0 ? ` · <span class="match">${escapeHtml(t('card.match', { n: Math.round(score) }))}</span>` : '';
  box.innerHTML = `
    <p class="map-popup__name" lang="en">${escapeHtml(cafe.name)}</p>
    <p class="map-popup__meta">${escapeHtml(cafe.area)}${match}</p>
    <button type="button" class="btn btn--primary btn--small map-popup__details">
      ${escapeHtml(t('map.details'))}<span class="visually-hidden">: ${inEnglish(cafe.name)}</span>
    </button>`;
  box.querySelector('button').addEventListener('click', (event) => onDetails(cafe.id, event.currentTarget));
  return box;
}

// The pin for one OpenStreetMap café: a 24px tap area with a small grey dot
// (local) or a small navy ring (chain), drawn by .map-pin--osm / --chain in
// style.css. There can be hundreds of them, so each is made once and kept:
// redrawing after a filter change only adds and removes them.
function osmMarker(cafe) {
  if (osmMarkers.has(cafe.id)) return osmMarkers.get(cafe.id);
  const L = window.L;
  const marker = L.marker([cafe.lat, cafe.lng], {
    icon: L.divIcon({ className: `map-pin map-pin--${cafe.type === 'chain' ? 'chain' : 'osm'}`, iconSize: [24, 24] }),
    title: cafe.name,
    keyboard: true,
    riseOnHover: true,
  });
  marker.bindPopup(() => {
    const box = document.createElement('div');
    box.className = 'map-popup';
    box.innerHTML = osmPopupHtml(cafe);
    return box;
  }, { closeButton: true, minWidth: 180 });
  // "Kaffle, Old Town & Chinatown" for screen readers
  marker.on('add', () => {
    marker.getElement().setAttribute('aria-label', `${cafe.name}, ${cafe.zone}`);
    marker.getElement().setAttribute('lang', 'en');
  });
  marker.on('popupopen', () => {
    openMarker = marker;
    switchOffCovered();
  });
  osmMarkers.set(cafe.id, marker);
  return marker;
}

// The map key under the map: how many of each kind of pin are showing.
// It only shows once OpenStreetMap cafés are on the map (before that, every
// pin is one of ours, as it always was).
function showLegend(handPickedCount, osm) {
  const legend = document.querySelector('[data-map-legend]');
  legend.hidden = !osm;
  if (!osm) return;
  const local = osm.cafes.filter((cafe) => cafe.type === 'local').length;
  legend.querySelector('[data-legend="picked"]').textContent = t('map.legendPicked', { n: handPickedCount });
  legend.querySelector('[data-legend="local"]').textContent = t('map.legendLocal', { n: local });
  legend.querySelector('[data-legend="chain"]').textContent = osm.chainsOn
    ? t('map.legendChain', { n: osm.cafes.length - local })
    : t('map.legendChainOff');
}

// Draw a pin for every café in `results` that has a location, and zoom the
// map to fit them. `onDetails(id, button)` opens the drawer.
// `osm` is { cafes, chainsOn } (the OpenStreetMap cafés that pass the
// filters), or null before they've loaded.
function drawPins(results, onDetails, osm) {
  const L = window.L;
  pins.clearLayers();
  const placed = results.filter(({ cafe }) => typeof cafe.lat === 'number' && typeof cafe.lng === 'number');

  const markers = placed.map((result) => {
    const { cafe } = result;
    // A divIcon is plain HTML instead of a picture: a 28px tap area with a
    // small navy dot in the middle (the dot is drawn by .map-pin in style.css).
    // handPicked: true tells clusterIcon there's one of ours in a circle.
    const marker = L.marker([cafe.lat, cafe.lng], {
      icon: L.divIcon({ className: 'map-pin', iconSize: [28, 28] }),
      title: cafe.name,
      keyboard: true,
      riseOnHover: true,
      handPicked: true,
      zIndexOffset: 1000, // ours sit on top of the grey pins
    });
    marker.bindPopup(() => popupContent(result, onDetails), { closeButton: true, minWidth: 180 });
    // The pin's HTML is made again each time it comes out of a group, so give
    // it its screen-reader name every time ("Artis Coffee, Sukhumvit Soi 18").
    // It's the café's own English name and area, so it's read in English.
    marker.on('add', () => {
      marker.getElement().setAttribute('aria-label', `${cafe.name}, ${cafe.area}`);
      marker.getElement().setAttribute('lang', 'en');
    });
    marker.on('popupopen', () => {
      openMarker = marker;
      switchOffCovered();
    });
    return marker;
  });
  const osmPins = osm ? osm.cafes.map(osmMarker) : [];
  pins.addLayers([...markers, ...osmPins]); // all at once, so the groups are worked out once
  setOsmCredit(osmPins.length > 0);
  showLegend(placed.length, osm);

  // Zoom to fit our cafés (the main results); the grey pins are extra.
  // Only if none of ours fit, zoom to the OpenStreetMap ones instead.
  const spots = placed.length > 0
    ? placed.map(({ cafe }) => [cafe.lat, cafe.lng])
    : (osm ? osm.cafes : []).map((cafe) => [cafe.lat, cafe.lng]);
  if (spots.length === 1) {
    map.setView(spots[0], 16);
  } else if (spots.length > 1) {
    map.fitBounds(L.latLngBounds(spots), { padding: EDGE_PADDING, maxZoom: 16 });
  }
  switchOffCovered(); // in case the view didn't change (so no 'moveend' comes)
  return results.length - placed.length; // how many couldn't be placed
}

// Show `results` on the map (loading Leaflet first if needed), and the
// OpenStreetMap cafés in `osm` ({ cafes, chainsOn }) if they've loaded.
export async function showMap(results, onDetails, osm = null) {
  const canvas = document.getElementById('map-canvas');
  const note = document.querySelector('[data-map-note]');

  if (!window.L) note.textContent = t('map.loading');
  try {
    await loadLeaflet();
  } catch {
    note.textContent = t('map.failed');
    return;
  }

  if (!map) createMap(canvas);
  // The map box may have just been un-hidden, so let Leaflet measure it again
  map.invalidateSize();

  const missing = drawPins(results, onDetails, osm);
  note.textContent = missing === 0 ? '' : t('map.missing', { n: missing });
}


/* ---------- The crawl map (used by js/crawl.js) ---------- */

let crawlMap = null;   // made the first time a crawl is planned
let crawlLayer = null; // the start, the numbered pins and the line, emptied on every redraw
let crawlPins = [];    // the numbered pins, stop 1 first

const PIN_SIZE = 30;

// A numbered pin. `shift` moves it that many pixels to the right of its
// café (see spreadCrawlPins); iconAnchor is the point of the pin that sits
// on the café, so a smaller x moves the picture right.
function crawlPinIcon(number, shift = 0) {
  return window.L.divIcon({
    className: 'crawl-pin',
    iconSize: [PIN_SIZE, PIN_SIZE],
    iconAnchor: [PIN_SIZE / 2 - shift, PIN_SIZE / 2],
    // the number is decoration for screen readers: the list says it all
    html: `<span aria-hidden="true">${number}</span>`,
  });
}

// Two stops a few metres apart (say, in the same mall) would have their pins
// on top of each other, hiding a number. After every zoom, a pin that would
// cover an earlier one is moved sideways until both show. Only the picture
// moves: the dotted line still goes to the café's real spot.
function spreadCrawlPins() {
  const placed = []; // where the pins so far ended up, in pixels
  crawlPins.forEach((marker, index) => {
    const spot = crawlMap.latLngToLayerPoint(marker.getLatLng());
    let shift = 0;
    while (placed.some((other) => other.distanceTo(spot.add([shift, 0])) < PIN_SIZE - 2)) shift += PIN_SIZE;
    placed.push(spot.add([shift, 0]));
    marker.setIcon(crawlPinIcon(index + 1, shift));
  });
}

// Draw a café crawl: a small hollow circle for the starting station (if
// the crawl starts at one), a numbered navy pin for each stop, and a dotted
// line joining them in order.
//   stops: the cafés in order, [{ cafe }, ...]
//   start: { name: 'BTS Ari', lat, lng }, or null for a neighbourhood
// These pins don't react to clicks or Tab: the list next to the map is where
// you open or swap a café, so keyboard users don't meet every café twice.
// Returns false if Leaflet couldn't load (crawl.js then says so).
export async function showCrawlMap(stops, start) {
  try {
    await loadLeaflet();
  } catch {
    return false;
  }
  const L = window.L;
  if (!crawlMap) {
    crawlMap = newMap(document.getElementById('crawl-map'));
    crawlLayer = L.layerGroup().addTo(crawlMap);
    crawlMap.on('zoomend', spreadCrawlPins);
  }
  crawlMap.invalidateSize(); // the box may have just been un-hidden
  crawlLayer.clearLayers();

  const stopPoints = stops.map(({ cafe }) => [cafe.lat, cafe.lng]);
  const route = start ? [[start.lat, start.lng], ...stopPoints] : stopPoints;

  // "1 6" with round ends draws a line of small dots
  L.polyline(route, { color: '#1F2A44', weight: 2.5, opacity: 0.7, dashArray: '1 6', lineCap: 'round', interactive: false })
    .addTo(crawlLayer);

  if (start) {
    L.marker([start.lat, start.lng], {
      icon: L.divIcon({ className: 'crawl-start-pin', iconSize: [18, 18] }),
      interactive: false,
      keyboard: false,
    })
      // A small label that always shows: "Start: BTS Ari"
      .bindTooltip(escapeHtml(t('crawl.start.label', { name: start.name })), { permanent: true, direction: 'right', offset: [10, 0], className: 'crawl-start-label' })
      .addTo(crawlLayer);
  }

  crawlPins = stops.map(({ cafe }, index) => L.marker([cafe.lat, cafe.lng], {
    icon: crawlPinIcon(index + 1),
    interactive: false,
    keyboard: false,
    zIndexOffset: (stops.length - index) * 100, // the lower number on top
  }).addTo(crawlLayer));

  crawlMap.fitBounds(L.latLngBounds(route), { padding: EDGE_PADDING, maxZoom: 17 });
  spreadCrawlPins(); // in case the zoom didn't change (then no 'zoomend' comes)
  return true;
}
