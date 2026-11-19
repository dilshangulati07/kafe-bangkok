// ui.js: everything that draws or changes the page. It never decides
// WHICH cafés to show; app.js does that and hands the results over.
//
//   1. Helpers and icons
//   2. Mobile menu
//   3. "Ask the barista" buttons
//   4. Toast message
//   5. Finder: building the filter controls
//   6. Finder: moving prefs into and out of the form
//   7. Café cards (results list, heart and "Been there" buttons)
//   8. Saved cafés
//   9. Dialog helpers and the café drawer (the details panel)
//  10. Neighbourhoods
//  11. Café passport
//  12. Compare (bar and side-by-side table)
//  13. "Copy link" feedback
//  14. Footer: where the café data comes from
//  15. Café of the day
//  16. Café stats (the charts)
//  17. The TH / EN switch
//
// chat.js borrows a few things from here: escapeHtml, icon, ICONS and the
// two dialog helpers, so the chat and the drawer behave the same way.
//
// Every word comes from js/i18n.js: t('key') gives it in the language
// that's on. Café names and descriptions stay in English, so they carry
// lang="en" (screen readers then read them with an English voice).

import { openStatus } from './clock.js';
import { t, tHtml, inEnglish, moodLabel, featureLabel, priceWord, priceLabel, reasonText, getLang, num } from './i18n.js';


/* ---------- 1. Helpers and icons ---------- */

// Café text is put into the page as HTML. Escaping turns characters like
// < > & " into safe codes, so a name such as "Tom & Jerry's <Café>" shows as
// text and can never be read as HTML tags.
export function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Wraps the inside of a 24×24 line icon in an <svg>.
// Its stroke style comes from the .icon class in style.css.
export function icon(paths, className = 'icon') {
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
}

export const ICONS = {
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  heart: '<path d="M12 19.5s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 8.7 5.2c1.5 0 2.6.8 3.3 2 .7-1.2 1.8-2 3.3-2a4.2 4.2 0 0 1 4.2 4.3c0 5.4-7.5 10-7.5 10z"/>',
  // a circle with a tick in it ("Been there")
  visited: '<circle cx="12" cy="12" r="8.25"/><path d="M8.3 12.4l2.5 2.5 4.9-5.3"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  // an arrow pointing up and out ("opens in Google Maps")
  external: '<path d="M8 16L16.5 7.5M9.5 7.5h7v7"/>',
};


/* ---------- 2. Mobile menu ---------- */
export function initNav() {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;

  // One place that opens or closes the menu, so the button's
  // aria-expanded (read by screen readers) always matches what you see.
  function setOpen(isOpen) {
    toggle.setAttribute('aria-expanded', String(isOpen));
    nav.classList.toggle('is-open', isOpen);
  }

  toggle.addEventListener('click', () => {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    setOpen(!isOpen);
  });

  // After picking something in the menu, close it so it doesn't cover the page.
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a, button')) setOpen(false);
  });

  // Escape closes the menu and puts keyboard focus back on the Menu button.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) {
      setOpen(false);
      toggle.focus();
    }
  });

  // Clicking anywhere outside the top bar closes it too.
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.topbar')) setOpen(false);
  });
}


/* ---------- 3. "Ask the barista" buttons ---------- */
// Every element with a data-open-chat attribute (the menu item and the
// hero button) runs the same function. app.js decides what that function is.
export function bindChatButtons(openChat) {
  document.querySelectorAll('[data-open-chat]').forEach((button) => {
    button.addEventListener('click', openChat);
  });
}


/* ---------- 4. Toast (a short message at the bottom of the screen) ---------- */
let toastTimer;

export function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add('is-visible');

  // If a toast is already showing, restart its 4-second countdown.
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 4000);
}


/* ---------- 5. Finder: building the filter controls ---------- */
// Fills the empty containers in the form using the data: the keys come from
// meta in cafes.json, the words from i18n.js. `zones` and `lines` are lists
// like [{ name: "Ari & Phaya Thai", count: 10 }, ...].
// app.js calls this again after a language change (then writePrefs puts the
// ticks back).
//
// Every control is a real form input (checkbox, radio, select), styled to
// look like outlined pills. That gives keyboard support and screen-reader
// states for free, and CSS can style the ticked ones with :checked.
export function buildFilterControls(form, meta, zones, lines) {
  // Moods: a row of pills (filled navy when ticked)
  form.querySelector('#mood-options').innerHTML = Object.keys(meta.moods)
    .map((key) => `
      <label class="mood-pill">
        <input class="visually-hidden" type="checkbox" name="mood" value="${escapeHtml(key)}">
        ${escapeHtml(moodLabel(key))}
      </label>`)
    .join('');

  // Must-haves: smaller pills
  form.querySelector('#feature-options').innerHTML = Object.keys(meta.features)
    .map((key) => `
      <label class="chip">
        <input class="visually-hidden" type="checkbox" name="feature" value="${escapeHtml(key)}">
        ${escapeHtml(featureLabel(key))}
      </label>`)
    .join('');

  // Area dropdown: "Anywhere" first, then each zone with its number of cafés
  const zoneOptions = zones
    .map(({ name, count }) => `<option value="${escapeHtml(name)}">${escapeHtml(name)} (${count})</option>`)
    .join('');
  form.elements.zone.innerHTML = `<option value="Anywhere">${escapeHtml(t('finder.anywhere'))}</option>${zoneOptions}`;

  // Line dropdown: "Any line" first, then each BTS/MRT line from meta.lines
  const lineOptions = lines
    .map(({ name, count }) => `<option value="${escapeHtml(name)}">${escapeHtml(name)} (${count})</option>`)
    .join('');
  form.elements.line.innerHTML = `<option value="Any">${escapeHtml(t('finder.anyLine'))}</option>${lineOptions}`;

  // Price: radio buttons, because you pick exactly one. meta.price looks like
  // { "1": "฿ budget", ... }. The ฿ signs are shown; screen readers hear the word.
  form.querySelector('#price-options').innerHTML = Object.keys(meta.price)
    .map((value) => `
        <label class="segmented__option" title="${escapeHtml(t('finder.upTo', { label: priceLabel(value) }))}">
          <input class="visually-hidden" type="radio" name="maxPrice" value="${escapeHtml(value)}">
          <span aria-hidden="true">${'฿'.repeat(Number(value))}</span>
          <span class="visually-hidden">${escapeHtml(priceWord(value))}</span>
        </label>`)
    .join('');
}


/* ---------- 6. Finder: moving prefs into and out of the form ---------- */

// Read the whole form into a prefs object.
// FormData collects every named input: ticked checkboxes, the chosen radio,
// the dropdown value and the search text.
export function readPrefs(form) {
  const data = new FormData(form);
  return {
    moods: data.getAll('mood'),
    features: data.getAll('feature'),
    zone: data.get('zone') || 'Anywhere',
    line: data.get('line') || 'Any',
    maxPrice: Number(data.get('maxPrice')) || 3,
    nearStation: data.has('nearStation'),
    openNow: data.has('openNow'),
    query: (data.get('query') || '').trim(),
  };
}

// The opposite: make the form show a prefs object
// (used when restoring saved filters and for "Clear all").
export function writePrefs(form, prefs) {
  form.querySelectorAll('input[name="mood"]').forEach((input) => {
    input.checked = prefs.moods.includes(input.value);
  });
  form.querySelectorAll('input[name="feature"]').forEach((input) => {
    input.checked = prefs.features.includes(input.value);
  });
  form.querySelectorAll('input[name="maxPrice"]').forEach((input) => {
    input.checked = Number(input.value) === prefs.maxPrice;
  });
  form.elements.zone.value = prefs.zone;
  form.elements.line.value = prefs.line;
  form.elements.nearStation.checked = prefs.nearStation;
  form.elements.openNow.checked = prefs.openNow;
  form.elements.query.value = prefs.query;
}


/* ---------- 7. Café cards ---------- */

// `results` is the whole sorted list from app.js: [{ cafe, score, reasons }, ...]
// Only the first `shown` of them are drawn; "Show more cafés" adds the rest
// in batches (see appendResults). Drawing every card on every filter
// change was slow, and meant 400+ Tab presses to get past the list.
// `saved` is { favourites, visited }, two Sets of café ids, so each card's
// heart and "Been there" buttons start in the right state.
// `compareIds` is the list of café ids ticked for Compare.
export function renderResults(results, shown, meta, saved, compareIds) {
  const list = document.getElementById('results');
  const empty = document.getElementById('empty-state');
  const total = results.length;

  list.innerHTML = resultItemsHtml(results.slice(0, shown), meta, saved, compareIds);
  list.hidden = total === 0;
  empty.hidden = total > 0;
  showResultCount(total, shown);

  // Nothing to pick from, so "Surprise me" can't do anything
  document.querySelector('[data-surprise]').disabled = total === 0;
}

// The empty state's heading and advice, worked out in app.js
// (e.g. "No cafés match Open late / 24h + Garden"). textContent, not
// innerHTML, so zone and feature names can never be read as HTML.
export function setEmptyMessage({ title, text }) {
  document.querySelector('#empty-state .empty-state__title').textContent = title;
  document.querySelector('#empty-state .empty-state__text').textContent = text;
}

// "Show more cafés": add results[from] up to results[to] to the end of the list
export function appendResults(results, from, to, meta, saved, compareIds) {
  document.getElementById('results')
    .insertAdjacentHTML('beforeend', resultItemsHtml(results.slice(from, to), meta, saved, compareIds));
  showResultCount(results.length, to);
}

// --i is each card's place in its batch, used to stagger the fade-in a little
function resultItemsHtml(results, meta, saved, compareIds) {
  return results
    .map((result, index) => `
      <li class="results__item" style="--i: ${Math.min(index, 10)}">
        ${cafeCardHtml(result, meta, saved, compareIds, 'result')}
      </li>`)
    .join('');
}

// "Showing 24 of 95 cafés" (read out by screen readers, it's aria-live),
// and the "Show more" button only while there are more to show
function showResultCount(total, shown) {
  const count = document.getElementById('result-count');
  count.textContent = shown < total
    ? t('results.showingOf', { shown, total })
    : t('results.showing', { n: total });
  document.querySelector('[data-show-more]').hidden = shown >= total;
}

// One café card. `listName` goes in front of the card's id, because the same
// café can be in the results and in Saved at once, and ids must be unique.
//
// Clicking anywhere on the card opens the drawer (app.js listens for that).
// The name is a real <button> as well, so keyboard users can open it too.
function cafeCardHtml({ cafe, score, reasons }, meta, saved, compareIds, listName) {
  const id = escapeHtml(cafe.id);
  const titleId = `${listName}-${id}`;

  // PLAN.md: when there's no station, say "Check map" instead
  const station = cafe.station
    ? escapeHtml(cafe.station)
    : `<span class="cafe-card__no-station">${escapeHtml(t('card.checkMap'))}</span>`;

  // Price: ฿ signs for people looking, the word ("mid-range") for screen readers
  const price = `
    <p class="cafe-card__price">
      <span aria-hidden="true">${'฿'.repeat(cafe.price)}</span>
      <span class="visually-hidden">${escapeHtml(t('card.price', { word: priceWord(cafe.price) }))}</span>
    </p>`;

  // Only show the badge once there's a real score
  const badge = score > 0 ? `<span class="match">${escapeHtml(t('card.match', { n: Math.round(score) }))}</span>` : '';

  // Up to 3 reasons in one small line: "quiet · garden seating · near BTS Ari".
  // Each reason gets its own span, so it wraps as a whole (see .cafe-card__reason).
  // They're picked in English (pickCardReasons looks for the station), then translated.
  const shown = pickCardReasons(cafe, reasons).map(reasonText);
  const note = shown.length > 0
    ? `<p class="cafe-card__note"><span class="visually-hidden">${escapeHtml(t('card.why'))}</span>${shown.map((reason) => `<span class="cafe-card__reason">${escapeHtml(reason)}</span>`).join(' · ')}</p>`
    : '';

  // "Open late" only shows at night: clock.js sets data-time="night" on
  // <html>, and the CSS reveals this label for cafés tagged "Open late / 24h"
  const lateBadge = cafe.features.includes('lateNight')
    ? `<span class="late-badge">${escapeHtml(t('card.openLate'))}</span>`
    : '';

  // Name and match on top, then where and price, the description, the tags
  // as one line of small text, the reasons, and the small buttons
  return `
    <article class="cafe-card" data-id="${id}" aria-labelledby="${titleId}">
      <div class="cafe-card__head">
        <div class="cafe-card__title">
          <h3 class="cafe-card__name" id="${titleId}">
            <button class="cafe-card__open" type="button" data-action="open" data-id="${id}" aria-haspopup="dialog" lang="en">${escapeHtml(cafe.name)}</button>
          </h3>
          ${checkedHtml(cafe)}
          ${lateBadge}
        </div>
        ${badge}
      </div>
      <div class="cafe-card__meta">
        <p class="cafe-card__where">${escapeHtml(cafe.area)} · ${station}</p>
        ${price}
      </div>
      ${hoursStatusHtml(cafe)}
      <p class="cafe-card__desc" lang="en">${escapeHtml(cafe.description)}</p>
      <ul class="tags" aria-label="${escapeHtml(t('card.tags'))}">
        ${tagsHtml(cafe.moods, moodLabel, 'tag tag--mood')}
        ${tagsHtml(cafe.features, featureLabel, 'tag')}
      </ul>
      <div class="cafe-card__foot">
        ${note}
        <div class="cafe-card__actions">
          ${toggleButtonsHtml(cafe, saved)}
          ${compareToggleHtml(cafe, compareIds)}
        </div>
      </div>
    </article>`;
}

// "Open now · Closes 22:00", "Closed · Opens 10:00", "Open 24 hours" or
// "Hours unknown", from the café's openingHours and Bangkok's time right now.
// data-hours-for lets refreshHoursStatus find it again a minute later.
// (crawl.js uses it too, for the stops of a café crawl.)
export function hoursStatusHtml(cafe, className = 'hours-status') {
  return `<p class="${className}" data-hours-for="${escapeHtml(cafe.id)}">${hoursStatusInner(cafe)}</p>`;
}

function hoursStatusInner(cafe) {
  const status = openStatus(cafe.openingHours);
  const { text, detail } = hoursWords(status);
  // The " · " is decoration; screen readers hear a comma instead
  const rest = detail
    ? `<span aria-hidden="true"> · </span><span class="visually-hidden">, </span>${escapeHtml(detail)}`
    : '';
  return `<span class="hours-status__state hours-status__state--${status.state}">${escapeHtml(text)}</span>${rest}`;
}

// The words for an openStatus result (clock.js) in the language that's on:
// { text: 'Open now', detail: 'Closes 22:00' } or { text: 'เปิดอยู่', detail: 'ปิด 22:00 น.' }
function hoursWords(status) {
  const { key, time, day } = status;
  if (key === 'open24') return { text: t('hours.open24'), detail: '' };
  if (key === 'open') {
    return { text: t('hours.open'), detail: time === 'midnight' ? t('hours.closesMidnight') : t('hours.closes', { time }) };
  }
  if (key === 'closed') {
    let detail = '';
    if (time && day === 'tomorrow') detail = t('hours.opensTomorrow', { time });
    else if (time && day) detail = t('hours.opensDay', { day: t(`day.${day}`), time });
    else if (time) detail = t('hours.opens', { time });
    return { text: t('hours.closed'), detail };
  }
  return { text: t('hours.unknown'), detail: '' };
}

// The clock moves on, so app.js calls this once a minute: every open/closed
// line on the page (cards and drawer) is worked out again.
export function refreshHoursStatus(cafesById) {
  document.querySelectorAll('[data-hours-for]').forEach((el) => {
    const cafe = cafesById.get(el.dataset.hoursFor);
    if (cafe) el.innerHTML = hoursStatusInner(cafe);
  });
}

// List or Map: show one, hide the other. The list keeps its cards while
// the map is showing. In the map every result is a pin (not 24 at a time),
// so the count says all of them and "Show more" goes away.
// `extraOnMap` is how many OpenStreetMap cafés would be pins too: the map
// shows if there's anything at all to put on it.
export function applyResultsView(view, total, extraOnMap = 0) {
  const showMap = view === 'map' && total + extraOnMap > 0;
  document.getElementById('results').hidden = total === 0 || showMap;
  document.getElementById('results-map').hidden = !showMap;
  if (showMap) {
    document.querySelector('[data-show-more]').hidden = true;
    document.getElementById('result-count').textContent = t('results.showing', { n: total });
  }
  document.querySelectorAll('[data-view]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.view === view));
  });
}

// A card has room for 3 reasons. scoreCafe puts the "near BTS/MRT" reason
// last, so a plain slice(0, 3) would cut it first. In Bangkok traffic,
// being near a station matters, so it always stays and the lowest of the
// other reasons is dropped instead.
// Example: [green, date, garden, near BTS Thong Lo] -> [green, date, near BTS Thong Lo]
function pickCardReasons(cafe, reasons) {
  if (reasons.length <= 3) return reasons;

  const stationReason = cafe.station
    ? reasons.find((reason) => reason.includes(cafe.station))
    : undefined;
  if (!stationReason) return reasons.slice(0, 3);

  const others = reasons.filter((reason) => reason !== stationReason);
  return [...others.slice(0, 2), stationReason];
}

// Tags, shown as one line of small text with " · " between them (the dots
// come from the CSS). `keys` are short keys like "garden"; `label` is
// moodLabel or featureLabel from i18n.js, which turns them into "Garden" (or "สวน").
function tagsHtml(keys, label, className) {
  return keys
    .map((key) => `<li class="${className}">${escapeHtml(label(key))}</li>`)
    .join(' '); // the space is where a long line of tags may wrap
}

// A small "Checked" label for cafés whose details have been checked by hand
// (verified: true in cafes.json). Shown on cards and in the drawer.
function checkedHtml(cafe) {
  if (cafe.verified !== true) return '';
  return `<p class="checked">${escapeHtml(t('card.checked'))}<span class="visually-hidden">${escapeHtml(t('card.checkedHidden'))}</span></p>`;
}

// The heart (Save) and "Been there" buttons, used on cards and in the drawer.
// On cards they're small icon-only buttons (with a tooltip); in the drawer,
// `withWords` shows the words too. aria-pressed tells screen readers whether
// each one is on, and the CSS uses it to fill the icon in. The café's name is
// added as hidden text, so a screen reader hears "Save Natura Café".
function toggleButtonsHtml(cafe, saved, withWords = false) {
  const id = escapeHtml(cafe.id);
  const name = inEnglish(cafe.name); // escaped, in a lang="en" span
  const save = escapeHtml(t('card.save'));
  const visited = escapeHtml(t('card.visited'));
  const words = (text) => (withWords
    ? `${text}<span class="visually-hidden"> ${name}</span>`
    : `<span class="visually-hidden">${text} ${name}</span>`);
  const shape = withWords ? 'toggle' : 'toggle toggle--icon';
  const tooltip = (text) => (withWords ? '' : ` title="${text}"`);
  return `
    <button class="${shape} toggle--save" type="button" data-action="favourite" data-id="${id}" aria-pressed="${saved.favourites.has(cafe.id)}"${tooltip(save)}>
      ${icon(ICONS.heart)}${words(save)}
    </button>
    <button class="${shape} toggle--visited" type="button" data-action="visited" data-id="${id}" aria-pressed="${saved.visited.has(cafe.id)}"${tooltip(visited)}>
      ${icon(ICONS.visited)}${words(visited)}
    </button>`;
}

// After a heart or "Been there" button is pressed, update every copy of it
// (the same café can be in the results, in Saved and in the drawer).
// `action` is "favourite" or "visited".
export function setToggleState(action, cafeId, isOn) {
  document.querySelectorAll(`[data-action="${action}"]`).forEach((button) => {
    if (button.dataset.id === cafeId) {
      button.setAttribute('aria-pressed', String(isOn));
    }
  });
}

// The "Compare" tick box on each card. It's a real checkbox (hidden) inside
// a label styled like the other buttons, the same trick as the filter chips.
function compareToggleHtml(cafe, compareIds) {
  const checked = compareIds.includes(cafe.id) ? 'checked' : '';
  return `
    <label class="toggle compare-toggle">
      <input class="visually-hidden" type="checkbox" data-compare="${escapeHtml(cafe.id)}" ${checked}>
      <span class="compare-toggle__box">${icon(ICONS.check)}</span>${escapeHtml(t('card.compare'))}<span class="visually-hidden"> ${inEnglish(cafe.name)}</span>
    </label>`;
}

// Tick or untick every copy of one café's Compare box (results and Saved)
export function setCompareState(cafeId, isOn) {
  document.querySelectorAll('[data-compare]').forEach((box) => {
    if (box.dataset.compare === cafeId) box.checked = isOn;
  });
}


/* ---------- 8. Saved cafés ---------- */

// `savedCafes` is the list of hearted cafés, newest first.
// Saved cards don't show a match score: this is your list, not a ranking.
export function renderSaved(savedCafes, meta, saved, compareIds) {
  const list = document.getElementById('saved-list');
  const empty = document.getElementById('saved-empty');
  const total = savedCafes.length;

  list.innerHTML = savedCafes
    .map((cafe) => `
      <li class="saved__item">
        ${cafeCardHtml({ cafe, score: 0, reasons: [] }, meta, saved, compareIds, 'saved')}
      </li>`)
    .join('');
  list.hidden = total === 0;
  empty.hidden = total > 0;

  // The count next to "Saved" in the top bar (hidden while it's 0)
  document.querySelectorAll('[data-saved-count]').forEach((count) => {
    count.textContent = total;
  });
  document.querySelectorAll('[data-saved-badge]').forEach((badge) => {
    badge.hidden = total === 0;
  });

  updateSavedSummary(saved);
}

// The line under the Saved heading, e.g. "3 cafés saved, 1 of them visited."
// It's separate from renderSaved because pressing "Been there" changes it
// without the list itself changing.
export function updateSavedSummary(saved) {
  const summary = document.getElementById('saved-summary');
  const total = saved.favourites.size;
  const visitedCount = [...saved.favourites].filter((id) => saved.visited.has(id)).length;

  summary.textContent = total === 0
    ? t('saved.intro')
    : t('saved.summary', { n: total, visited: visitedCount });
}


/* ---------- 9. Dialog helpers and the café drawer ----------
   The drawer (and the chat in chat.js) is a <dialog>, opened with
   showModal(). That gives us a few things for free: the rest of the page
   can't be clicked or tabbed to while it's open, and Escape closes it.
   On top of that:
   - a click outside closes it (closeOnOutsideClick),
   - Tab keeps moving around inside it, a "focus trap" (trapFocus),
   - focus goes back to the button that opened it when it closes. */

// A click outside the panel lands on the dimmed backdrop, which counts as
// a click on the <dialog> itself (the panel inside covers the rest of it).
// We also check where the press STARTED, so selecting text inside and
// letting go outside doesn't close it by accident.
export function closeOnOutsideClick(dialog) {
  let pressStartedOutside = false;
  dialog.addEventListener('pointerdown', (event) => {
    pressStartedOutside = event.target === dialog;
  });
  dialog.addEventListener('click', (event) => {
    if (pressStartedOutside && event.target === dialog) dialog.close();
  });
}

// Keep Tab inside a dialog: Tab on the last button jumps to the first,
// and Shift+Tab on the first jumps to the last.
// Use it as: dialog.addEventListener('keydown', (event) => trapFocus(dialog, event))
export function trapFocus(dialog, event) {
  if (event.key !== 'Tab') return;

  const focusable = [...dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled])')]
    .filter((element) => element.getClientRects().length > 0); // skip hidden ones (they have no boxes on screen)
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const current = document.activeElement;
  // Focus can end up on the dialog itself (or nowhere) after clicking plain
  // text in it, or after the button you pressed was removed.
  const lost = !dialog.contains(current) || current === dialog;

  if (event.shiftKey && (current === first || lost)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (current === last || lost)) {
    event.preventDefault();
    first.focus();
  }
}

// --- The café drawer ---

let drawer;              // the <dialog> element
let lastOpener = null;   // the button that opened the drawer
let lastSection = null;  // the page section that button was in
let lastCafeId = null;   // which café is showing

export function initDrawer() {
  drawer = document.getElementById('cafe-drawer');

  drawer.querySelector('[data-close-drawer]').addEventListener('click', () => drawer.close());
  closeOnOutsideClick(drawer);
  drawer.addEventListener('keydown', (event) => trapFocus(drawer, event));

  // 'close' fires however the drawer was closed: X, Escape or outside click.
  drawer.addEventListener('close', returnFocus);
}

// `result` is { cafe, score, reasons, hasPicks } for one café, scored with the
// current filters. `opener` is the button that should get focus back afterwards.
export function openDrawer(result, meta, saved, opener) {
  lastOpener = opener;
  lastSection = opener ? opener.closest('section') : null;
  lastCafeId = result.cafe.id;

  const body = drawer.querySelector('.drawer__body');
  body.innerHTML = drawerBodyHtml(result, meta, saved);
  body.scrollTop = 0;
  drawer.querySelector('.drawer__foot').innerHTML = mapsButtonHtml(result.cafe);

  if (!drawer.open) drawer.showModal();
  // Start focus on the café's name, so a screen reader reads the drawer from
  // the top. From there Tab goes on to the buttons, Shift+Tab back to the X.
  drawer.querySelector('#drawer-title').focus();
}

// Put focus back on the card's button. If that button has been redrawn
// since (say you un-hearted the café while the drawer was open, and the
// Saved list changed), look for the café's new button in the same section,
// or fall back to that section's heading.
function returnFocus() {
  const opener = lastOpener;
  lastOpener = null;
  if (!opener) return;

  if (opener.isConnected) {
    opener.focus();
    return;
  }

  if (!lastSection) return;
  const newButton = [...lastSection.querySelectorAll('[data-action="open"]')]
    .find((button) => button.dataset.id === lastCafeId);
  if (newButton) {
    newButton.focus();
  } else {
    // tabindex="-1" lets a heading take focus from code (but not from Tab)
    const heading = lastSection.querySelector('h2');
    heading.setAttribute('tabindex', '-1');
    heading.focus();
  }
}

// Everything in the drawer apart from the X and the Google Maps button
function drawerBodyHtml({ cafe, score, reasons, hasPicks }, meta, saved) {
  // "BTS Siam (BTS Sukhumvit and BTS Silom lines)"
  const lines = cafe.line.length > 0
    ? ` <span class="drawer__muted">${escapeHtml(t('drawer.lines', { lines: cafe.line.join(t('drawer.and')), n: cafe.line.length }))}</span>`
    : '';
  const station = cafe.station
    ? escapeHtml(cafe.station) + lines
    : `<span class="drawer__muted">${escapeHtml(t('drawer.noStation'))}</span>`;

  // Open now or not first, then the hours as written in cafes.json (in English, like the rest of the café's data)
  const hoursText = cafe.hours
    ? `<span lang="en">${escapeHtml(cafe.hours)}</span>`
    : `<span class="drawer__muted">${escapeHtml(t('drawer.noHours'))}</span>`;
  const hours = `${hoursStatusHtml(cafe, 'hours-status hours-status--drawer')}<span class="drawer__hours-text">${hoursText}</span>`;

  // meta.price[2] is "฿฿ mid-range": show the ฿ signs, let screen readers hear the word
  const price = `<span class="drawer__baht" aria-hidden="true">${'฿'.repeat(cafe.price)}</span> ${escapeHtml(priceWord(cafe.price))}`;

  const badge = score > 0 ? `<span class="match">${escapeHtml(t('card.match', { n: Math.round(score) }))}</span>` : '';

  // Every reason from scoreCafe this time, not just the 3 that fit on a card
  let why;
  if (reasons.length > 0) {
    why = `
      <ul class="why-list">
        ${reasons.map((reason) => `<li>${escapeHtml(reasonText(reason))}</li>`).join('')}
      </ul>`;
  } else if (hasPicks) {
    why = `<p class="drawer__muted">${escapeHtml(t('drawer.noMatch'))}</p>`;
  } else {
    why = `<p class="drawer__muted">${escapeHtml(t('drawer.noPicks'))}</p>`;
  }

  // Features are optional (some cafés have none), moods always have at least one
  const features = cafe.features.length > 0
    ? `<h4 class="drawer__sublabel">${escapeHtml(t('drawer.has'))}</h4>
       <ul class="tags">${tagsHtml(cafe.features, featureLabel, 'tag')}</ul>`
    : '';

  // Show each source as its website name, e.g. "thattravelblog.com"
  const sources = cafe.sources
    .filter(isWebLink)
    .map((url) => `
      <li><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(siteName(url))}<span class="visually-hidden">${escapeHtml(t('newTab'))}</span></a></li>`)
    .join('');

  return `
    <header class="drawer__head">
      <h2 id="drawer-title" class="drawer__title" tabindex="-1" lang="en">${escapeHtml(cafe.name)}</h2>
      <div class="drawer__badges">${checkedHtml(cafe)}${badge}</div>
      <p class="drawer__where">${escapeHtml(cafe.area)} · ${escapeHtml(cafe.zone)}</p>
    </header>

    <div class="drawer__actions">${toggleButtonsHtml(cafe, saved, true)}</div>

    <p class="drawer__desc" lang="en">${escapeHtml(cafe.description)}</p>

    <div class="drawer__section">
      <h3 class="drawer__label">${escapeHtml(t('drawer.why'))}</h3>
      ${why}
    </div>

    <div class="drawer__section">
      <h3 class="drawer__label">${escapeHtml(t('drawer.details'))}</h3>
      <dl class="details">
        <div><dt>${escapeHtml(t('drawer.station'))}</dt><dd>${station}</dd></div>
        <div><dt>${escapeHtml(t('drawer.price'))}</dt><dd>${price}</dd></div>
        <div><dt>${escapeHtml(t('drawer.hours'))}</dt><dd>${hours}</dd></div>
      </dl>
    </div>

    <div class="drawer__section">
      <h3 class="drawer__label">${escapeHtml(t('drawer.tags'))}</h3>
      <h4 class="drawer__sublabel">${escapeHtml(t('drawer.goodFor'))}</h4>
      <ul class="tags">${tagsHtml(cafe.moods, moodLabel, 'tag tag--mood')}</ul>
      ${features}
    </div>

    ${sources ? `
      <div class="drawer__section drawer__sources">
        <h3 class="drawer__label">${escapeHtml(t('drawer.sources'))}</h3>
        <ul class="sources">${sources}</ul>
      </div>` : ''}`;
}

function mapsButtonHtml(cafe) {
  if (!isWebLink(cafe.mapsUrl)) return '';
  return `
    <a class="btn btn--primary drawer__maps" href="${escapeHtml(cafe.mapsUrl)}" target="_blank" rel="noopener noreferrer">
      ${escapeHtml(t('drawer.maps'))}<span class="visually-hidden">${escapeHtml(t('newTab'))}</span>
      ${icon(ICONS.external, 'icon icon--sm')}
    </a>`;
}

// Only make links out of normal web addresses (http or https). This stops
// a typo or something odd in cafes.json from turning into a broken or unsafe link.
function isWebLink(url) {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false; // not a valid address at all
  }
}

// "https://www.thattravelblog.com/blog/..." -> "thattravelblog.com"
function siteName(url) {
  return new URL(url).hostname.replace(/^www\./, '');
}


/* ---------- 10. Neighbourhoods ---------- */

// `zones` is [{ name: "Ari & Phaya Thai", count: 10, topMoods: ['aesthetic', 'date'] }, ...]
// Each row is one button, like a line on a menu: the zone's name, how many
// cafés, and its top moods as small text. app.js listens for clicks on [data-zone].
export function renderNeighbourhoods(zones, meta) {
  document.getElementById('zone-list').innerHTML = zones
    .map((zone) => `
      <li>
        <button class="zone-card" type="button" data-zone="${escapeHtml(zone.name)}">
          <span class="zone-card__name"><span class="visually-hidden">${escapeHtml(t('areas.show'))}</span>${escapeHtml(zone.name)}</span>
          <span class="zone-card__count">${escapeHtml(t('cafes', { n: zone.count }))}</span>
          <span class="zone-card__moods">
            <span class="visually-hidden">${escapeHtml(t('areas.mostly'))}</span>
            ${zone.topMoods.map((key) => `<span class="tag tag--mood">${escapeHtml(moodLabel(key))}</span>`).join(' ')}
          </span>
        </button>
      </li>`)
    .join('');
}


/* ---------- 11. Café passport ---------- */

// "You've visited 7 of 95 cafés" (counted from the data), a thin progress line, and a "stamp" (a
// small box with its name and count) for every neighbourhood with at least
// one visited café.
// `zones` is the same list as renderNeighbourhoods gets.
export function renderPassport(allCafes, visited, zones) {
  const visitedCafes = allCafes.filter((cafe) => visited.has(cafe.id));
  const total = allCafes.length;
  const count = visitedCafes.length;

  document.getElementById('passport-progress').textContent = count === 0
    ? t('passport.none', { total })
    : t('passport.some', { n: count, total });
  document.querySelector('.passport__bar span').style.width = `${(count / total) * 100}%`;

  // How many visited cafés are in each zone
  const perZone = {};
  for (const cafe of visitedCafes) {
    perZone[cafe.zone] = (perZone[cafe.zone] || 0) + 1;
  }
  const stamped = zones.filter((zone) => perZone[zone.name] > 0);

  document.getElementById('passport-stamps').innerHTML = stamped
    .map((zone) => `
      <li class="stamp">
        <span class="stamp__zone">${escapeHtml(zone.name)}</span>
        <span class="stamp__count">${escapeHtml(t('cafes', { n: perZone[zone.name] }))}</span>
      </li>`)
    .join('');

  document.getElementById('passport-note').textContent = stamped.length === 0
    ? t('passport.first')
    : t('passport.stamped', { n: stamped.length, total: zones.length });
}


/* ---------- 12. Compare ---------- */

// The bar at the bottom of the screen. `chosen` is the list of cafés
// ticked for Compare (up to 3), in the order they were ticked.
export function renderCompareBar(chosen) {
  const bar = document.querySelector('.compare-bar');
  bar.hidden = chosen.length === 0;
  bar.querySelector('.compare-bar__list').innerHTML = chosen
    .map((cafe) => `
      <li class="compare-chip">
        <span class="compare-chip__name" lang="en">${escapeHtml(cafe.name)}</span>
        <button class="compare-chip__remove" type="button" data-compare-remove="${escapeHtml(cafe.id)}">
          ${icon(ICONS.close, 'icon')}<span class="visually-hidden">${tHtml('compare.remove', { name: inEnglish(cafe.name) })}</span>
        </button>
      </li>`)
    .join('');
  bar.querySelector('[data-compare-count]').textContent = chosen.length;
}

// The bar appears and changes without moving focus, so a hidden status
// line tells screen readers what happened ("Natura Café added. 2 of 3.").
// `html` comes from tHtml in i18n.js (escaped, the café name in lang="en").
export function announceCompare(html) {
  document.getElementById('compare-status').innerHTML = html;
}

let compareDialog;
let compareOpener = null;

export function initCompareDialog() {
  compareDialog = document.getElementById('compare-dialog');
  compareDialog.querySelector('[data-close-compare]').addEventListener('click', () => compareDialog.close());
  closeOnOutsideClick(compareDialog);
  compareDialog.addEventListener('keydown', (event) => trapFocus(compareDialog, event));
  compareDialog.addEventListener('close', () => {
    if (compareOpener && compareOpener.isConnected) compareOpener.focus();
    compareOpener = null;
  });
}

// The side-by-side table: one column per café, one row per detail.
// Each café's name is a button that opens its drawer (on top of this).
export function openCompare(chosen, meta, opener) {
  compareOpener = opener;

  const none = (key) => `<span class="compare-table__none">${escapeHtml(t(key))}</span>`;
  const row = (labelKey, cellHtml) => `
    <tr>
      <th scope="row">${escapeHtml(t(labelKey))}</th>
      ${chosen.map((cafe) => `<td>${cellHtml(cafe)}</td>`).join('')}
    </tr>`;
  const price = (cafe) => `<span class="drawer__baht" aria-hidden="true">${'฿'.repeat(cafe.price)}</span> ${escapeHtml(priceWord(cafe.price))}`;

  const table = compareDialog.querySelector('.compare-table');
  // Each café column needs about 10rem, so on a phone the table is wider
  // than the screen and its box scrolls sideways (see .compare-scroll).
  table.style.minWidth = `${7 + chosen.length * 10}rem`;
  table.innerHTML = `
    <thead>
      <tr>
        <td></td>
        ${chosen.map((cafe) => `
          <th scope="col">
            <button class="compare-table__name" type="button" data-action="open" data-id="${escapeHtml(cafe.id)}" aria-haspopup="dialog" lang="en">${escapeHtml(cafe.name)}</button>
          </th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${row('compare.area', (cafe) => `${escapeHtml(cafe.area)}<span class="compare-table__sub">${escapeHtml(cafe.zone)}</span>`)}
      ${row('compare.station', (cafe) => (cafe.station ? escapeHtml(cafe.station) : none('compare.none')))}
      ${row('compare.price', price)}
      ${row('compare.moods', (cafe) => `<ul class="tags">${tagsHtml(cafe.moods, moodLabel, 'tag tag--mood')}</ul>`)}
      ${row('compare.features', (cafe) => (cafe.features.length > 0
        ? `<ul class="tags">${tagsHtml(cafe.features, featureLabel, 'tag')}</ul>`
        : none('compare.none')))}
      ${row('compare.hours', (cafe) => (cafe.hours ? `<span lang="en">${escapeHtml(cafe.hours)}</span>` : none('compare.noHours')))}
    </tbody>`;

  compareDialog.querySelector('.compare-scroll').scrollLeft = 0;
  compareDialog.showModal();
  compareDialog.querySelector('#compare-title').focus();
}


/* ---------- 13. "Copy link" feedback ---------- */
let copiedTimer;

// The button says "Copied" for two seconds. A button's own text changing
// isn't always read out, so a hidden status line says it to screen readers too.
export function showCopied(button) {
  const label = button.querySelector('[data-copy-label]');
  const status = document.querySelector('[data-copy-status]');
  label.textContent = t('finder.copied');
  status.textContent = t('finder.copiedStatus');
  button.classList.add('is-copied');

  clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => {
    label.textContent = t('finder.copyLink');
    status.textContent = '';
    button.classList.remove('is-copied');
  }, 2000);
}


/* ---------- 14. Footer: where the café data comes from ---------- */

// "Café data compiled from public guides and cafés' own websites: driproast.com, ..." The list is
// made from every source link in cafes.json, so it stays right as cafés
// are added. Each site links to its home page.
export function renderSources(allCafes) {
  const sites = new Set();
  for (const cafe of allCafes) {
    for (const url of cafe.sources) {
      if (isWebLink(url)) sites.add(siteName(url));
    }
  }
  const slot = document.querySelector('[data-source-list]');
  if (!slot || sites.size === 0) return;

  const links = [...sites].sort()
    .map((site) => `<a href="https://${escapeHtml(site)}/">${escapeHtml(site)}</a>`);
  slot.innerHTML = `: ${links.join(', ')}`;
}


/* ---------- 15. Café of the day ---------- */

// The small section under the hero. app.js picks the café; `today` is
// bangkokDate() from clock.js ({ key: '2026-11-09', label: 'Monday 9 November' }).
// "See details" has data-action="open", so app.js's page click listener
// opens the drawer for it, like a card's name.
export function renderCafeOfTheDay(cafe, today) {
  const section = document.getElementById('today');
  const date = section.querySelector('[data-today-date]');
  date.textContent = getLang() === 'th' ? today.labelThai : today.label;
  date.dateTime = today.key;

  // "Nang Loeng · Old Town & Chinatown". When the zone already names the
  // area ("Ari" is in "Ari & Phaya Thai"), the zone on its own says it.
  const where = cafe.zone.includes(cafe.area) ? cafe.zone : `${cafe.area} · ${cafe.zone}`;

  section.querySelector('[data-today-cafe]').innerHTML = `
    <h3 class="today__name" lang="en">${escapeHtml(cafe.name)}</h3>
    <p class="today__where">${escapeHtml(where)}</p>
    <p class="today__desc" lang="en">${escapeHtml(cafe.description)}</p>
    <button class="btn btn--secondary btn--small" type="button" data-action="open" data-id="${escapeHtml(cafe.id)}" aria-haspopup="dialog">
      ${escapeHtml(t('today.details'))}<span class="visually-hidden">: ${inEnglish(cafe.name)}</span>
    </button>`;
  section.hidden = false;
}


/* ---------- 16. Café stats (the charts) ----------
   Plain HTML and CSS, no chart library. Each chart compares counts, so
   it's a list of thin navy bars, longest first, with the number at the tip
   of each bar. The bar's length is a CSS variable (--share, from 0 to 1),
   so the browser draws it and there's no drawing code. Screen readers
   read each row as text ("Ari & Phaya Thai, 10 cafés"); the bars themselves
   are aria-hidden.

   `stats` (counted in app.js from cafes.json) looks like:
   { total: 95, perArea: [{ name, count }], moods: [{ key, count }],
     prices: [{ level: 1, count }], late: 13, knownHours: 20 } */

// One chart of bars. `rows` is [{ label, count }]; the longest bar is the largest count.
// `labelLang` is 'en' for labels that are data, like chain names, so screen
// readers say them in English in the middle of Thai.
function barsHtml(rows, labelClass = '', labelLang = '') {
  const max = Math.max(1, ...rows.map((row) => row.count));
  const lang = labelLang ? ` lang="${labelLang}"` : '';
  return `
    <ol class="bars">
      ${rows.map((row) => `
        <li class="bar">
          <span class="bar__label ${labelClass}"${lang}>${escapeHtml(row.label)}</span>
          <span class="bar__plot">
            <span class="bar__fill" style="--share: ${(row.count / max).toFixed(3)}" aria-hidden="true"></span>
            <span class="bar__value"><span aria-hidden="true">${num(row.count)}</span><span class="visually-hidden">${escapeHtml(t('cafes', { n: row.count }))}</span></span>
          </span>
        </li>`).join('')}
    </ol>`;
}

// One headline number out of the total, with a thin meter under it ("13 of 95")
function figureHtml(titleKey, count, total, textKey) {
  return `
    <figure class="stat-figure">
      <figcaption class="stat-chart__title">${escapeHtml(t(titleKey))}</figcaption>
      <p class="stat-figure__value">
        <span class="stat-figure__number">${count}</span>
        <span class="stat-figure__of">${escapeHtml(t('stats.of', { total }))}</span>
      </p>
      <div class="meter" aria-hidden="true"><span class="meter__fill" style="--share: ${(count / total).toFixed(3)}"></span></div>
      <p class="stat-figure__text">${escapeHtml(t(textKey))}</p>
    </figure>`;
}

// The numbers for every café on the site, ours and OpenStreetMap's.
// `all` is { state: 'loading' } or { state: 'failed' } while there's nothing
// to show, else { state: 'ready', total, handPicked, local, chain, checked,
// topChains: [{ name, count }], date } (counted in app.js). `checked` is how
// many cafés OpenStreetMap had before tools/fetch-osm.mjs kept the reliable ones.
function allCafesHtml(all) {
  if (all.state !== 'ready') {
    return `<p class="stats__osm-status" role="status">${escapeHtml(t(all.state === 'failed' ? 'stats.osmFailed' : 'stats.osmLoading'))}</p>`;
  }
  const date = new Intl.DateTimeFormat(getLang() === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(`${all.date}T12:00:00Z`));
  return `
    <figure class="stat-figure">
      <figcaption class="stat-chart__title">${escapeHtml(t('stats.allTitle'))}</figcaption>
      <p class="stat-figure__value">
        <span class="stat-figure__number">${escapeHtml(num(all.total))}</span>
        <span class="stat-figure__of">${escapeHtml(t('stats.allUnit'))}</span>
      </p>
      <p class="stat-figure__text">${escapeHtml(t('stats.allText', { picked: all.handPicked, kept: all.local + all.chain, checked: all.checked }))}</p>
      <div class="stat-chart stats__mix">
        <p class="stat-chart__title">${escapeHtml(t('stats.mix'))}</p>
        ${barsHtml([
          { label: t('stats.handPicked'), count: all.handPicked },
          { label: t('stats.local'), count: all.local },
          { label: t('stats.chain'), count: all.chain },
        ].sort((a, b) => b.count - a.count))}
        <p class="stat-chart__note">${escapeHtml(t('stats.reliableNote'))}</p>
      </div>
    </figure>
    <figure class="stat-chart">
      <figcaption class="stat-chart__title">${escapeHtml(t('stats.topChains'))}</figcaption>
      ${barsHtml(all.topChains.map(({ name, count }) => ({ label: name, count })), '', 'en')}
      <p class="stat-chart__note">${escapeHtml(t('stats.chainsNote', { date }))}</p>
    </figure>`;
}

// `all` is described above allCafesHtml. app.js draws the stats straight
// away with { state: 'loading' }, then again once the OpenStreetMap
// numbers are in.
export function renderStats(stats, all = { state: 'loading' }) {
  const box = document.querySelector('[data-stats]');
  if (!box) return;
  box.innerHTML = `
    <div class="stats__all">${allCafesHtml(all)}</div>
    <figure class="stat-chart stats__areas">
      <figcaption class="stat-chart__title">${escapeHtml(t('stats.perArea'))}</figcaption>
      ${barsHtml(stats.perArea.map(({ name, count }) => ({ label: name, count })))}
    </figure>
    <div class="stats__side">
      <figure class="stat-chart">
        <figcaption class="stat-chart__title">${escapeHtml(t('stats.moods'))}</figcaption>
        ${barsHtml(stats.moods.map(({ key, count }) => ({ label: moodLabel(key), count })))}
        <p class="stat-chart__note">${escapeHtml(t('stats.moodsNote', { total: stats.total }))}</p>
      </figure>
      <figure class="stat-chart">
        <figcaption class="stat-chart__title">${escapeHtml(t('stats.price'))}</figcaption>
        ${barsHtml(stats.prices.map(({ level, count }) => ({ label: priceLabel(level), count })), 'bar__label--price')}
      </figure>
    </div>
    <div class="stats__figures">
      ${figureHtml('stats.late', stats.late, stats.total, 'stats.lateText')}
      ${figureHtml('stats.hours', stats.knownHours, stats.total, 'stats.hoursText')}
    </div>`;
}


/* ---------- 17. The TH / EN switch ---------- */

// aria-pressed="true" on the language that's on (the CSS fills it navy)
export function showLanguage(lang) {
  document.querySelectorAll('[data-lang]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.lang === lang));
  });
}
