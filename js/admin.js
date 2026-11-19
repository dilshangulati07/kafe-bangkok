// admin.js: the café admin page (admin.html).
//
// It loads data/cafes.json, lists every café in a table you can search, and
// lets you add, edit and delete cafés in a form. Nothing is saved online:
// the changes live in this browser tab until you press "Download cafes.json".
// Then you put that file in the project's data folder in place of the old one.
//
//   1. Loading and the table
//   2. Opening hours: from the data to text and back
//   3. The form: filling it in and reading it back
//   4. Saving, deleting and downloading
//   5. Starting up

import { escapeHtml } from './ui.js';

const DATA_URL = 'data/cafes.json';
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_NAMES = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };

let data = null;        // the whole file as loaded: { meta, cafes }
let cafes = [];         // the cafés being edited (data.cafes)
let editingId = null;   // the id of the café in the form, or null when adding one
let unsaved = false;    // changes made since the last download
let opener = null;      // the button that opened the form (focus goes back to it)

const $ = (selector) => document.querySelector(selector);


/* ---------- 1. Loading and the table ---------- */

// "Blue Whale (Tha Tien)" -> "blue-whale-tha-tien"
function slugify(text) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// The same kind of Google Maps search link as the other cafés have
function searchLink(name) {
  const query = encodeURIComponent(`${name} Bangkok`).replace(/[()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function renderTable() {
  const query = slugify($('#admin-search').value);
  const shown = cafes.filter((cafe) => !query
    || [cafe.name, cafe.area, cafe.zone, cafe.id].some((text) => slugify(text).includes(query)));

  $('[data-admin-rows]').innerHTML = shown.map((cafe) => {
    const id = escapeHtml(cafe.id);
    const name = escapeHtml(cafe.name);
    return `
      <tr>
        <th scope="row"><span class="admin-table__name">${name}</span><span class="admin-table__id">${id}</span></th>
        <td>${escapeHtml(cafe.area)}</td>
        <td>${escapeHtml(cafe.zone)}</td>
        <td class="admin-table__price"><span aria-hidden="true">${'฿'.repeat(cafe.price)}</span><span class="visually-hidden">${cafe.price} of 3</span></td>
        <td>${escapeHtml(cafe.moods.map((key) => data.meta.moods[key] || key).join(', '))}</td>
        <td>${cafe.openingHours ? 'Yes' : '<span class="admin-table__no">No</span>'}</td>
        <td>${typeof cafe.lat === 'number' ? 'Yes' : '<span class="admin-table__no">No</span>'}</td>
        <td>${cafe.verified ? 'Yes' : '<span class="admin-table__no">No</span>'}</td>
        <td class="admin-table__actions">
          <button type="button" class="link-button" data-edit="${id}">Edit<span class="visually-hidden"> ${name}</span></button>
          <button type="button" class="link-button" data-delete="${id}">Delete<span class="visually-hidden"> ${name}</span></button>
        </td>
      </tr>`;
  }).join('');

  $('[data-admin-empty]').hidden = shown.length > 0;
  $('[data-admin-count]').textContent = shown.length === cafes.length
    ? `${cafes.length} cafés`
    : `${shown.length} of ${cafes.length} cafés`;
}

// The line under the buttons: what just happened, and a reminder to download
function setStatus(message) {
  const reminder = unsaved ? ' You have changes that aren\'t downloaded yet.' : '';
  $('[data-admin-status]').textContent = `${message}${reminder}`.trim();
}


/* ---------- 2. Opening hours: from the data to text and back ----------
   In cafes.json one day looks like [{ "open": "10:00", "close": "22:00" }]
   ([] is closed). In the form it's text: "10:00-22:00", "closed", or
   "08:00-12:00, 13:00-18:00". */

function dayToText(ranges) {
  if (ranges.length === 0) return 'closed';
  return ranges.map(({ open, close }) => `${open}-${close}`).join(', ');
}

// Text back to a list of { open, close }. Throws an Error with a message
// to show if the text doesn't make sense.
function textToDay(text) {
  const value = text.trim().toLowerCase();
  if (value === 'closed') return [];
  if (value === '') throw new Error('Write the hours, or "closed".');
  return value.split(',').map((part) => {
    // "8:00 - 22:00", "08:00–22:00" (any dash) all work
    const match = part.trim().match(/^(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})$/);
    if (!match) throw new Error(`"${part.trim()}" isn't like 10:00-22:00.`);
    const [, openH, openM, closeH, closeM] = match.map(Number);
    if (openH > 23 || openM > 59 || closeH > 24 || closeM > 59 || (closeH === 24 && closeM > 0)) {
      throw new Error(`"${part.trim()}" has a time that doesn't exist.`);
    }
    const time = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const open = time(openH, openM);
    const close = time(closeH, closeM);
    if (open === close) throw new Error(`"${part.trim()}" opens and closes at the same time.`);
    return { open, close };
  });
}


/* ---------- 3. The form: filling it in and reading it back ---------- */

const form = () => $('[data-admin-form]');

// The tick boxes and choices come from meta in cafes.json, so the form
// always matches the site
function buildChoices() {
  const { meta } = data;
  const box = (name, value, label) => `
    <label class="chip"><input class="visually-hidden" type="checkbox" name="${name}" value="${escapeHtml(value)}"> ${escapeHtml(label)}</label>`;
  $('[data-choices-moods]').innerHTML = Object.entries(meta.moods).map(([key, label]) => box('moods', key, label)).join('');
  $('[data-choices-features]').innerHTML = Object.entries(meta.features).map(([key, label]) => box('features', key, label)).join('');
  $('[data-choices-line]').innerHTML = meta.lines.map((line) => box('line', line, line)).join('');
  $('[data-choices-price]').innerHTML = Object.entries(meta.price).map(([value, label]) => `
    <label class="segmented__option" title="${escapeHtml(label)}">
      <input class="visually-hidden" type="radio" name="price" value="${escapeHtml(value)}">
      <span aria-hidden="true">${'฿'.repeat(Number(value))}</span>
      <span class="visually-hidden">${escapeHtml(label.replaceAll('฿', '').trim())}</span>
    </label>`).join('');

  // Suggestions for the zone and station boxes: every one already in the data
  const unique = (values) => [...new Set(values.filter(Boolean))].sort();
  $('[data-list-zones]').innerHTML = unique(cafes.map((cafe) => cafe.zone)).map((zone) => `<option value="${escapeHtml(zone)}"></option>`).join('');
  $('[data-list-stations]').innerHTML = unique([...cafes.map((cafe) => cafe.station), ...Object.keys(meta.stations || {})])
    .map((station) => `<option value="${escapeHtml(station)}"></option>`).join('');

  $('[data-days]').innerHTML = DAYS.map((day) => `
    <div class="field admin-form__day">
      <label class="field__label" for="f-day-${day}">${DAY_NAMES[day]}</label>
      <input id="f-day-${day}" class="input" name="day-${day}" type="text" autocomplete="off" spellcheck="false" aria-describedby="f-day-${day}-error">
      <p id="f-day-${day}-error" class="field__error" data-error-for="day-${day}" hidden></p>
    </div>`).join('');
}

// The day boxes only matter when "the full hours are known" is on
function showDays() {
  const known = form().elements.hoursKnown.checked;
  $('[data-days]').hidden = !known;
}

function setTicks(name, values) {
  form().querySelectorAll(`[name="${name}"]`).forEach((input) => {
    input.checked = values.includes(input.value);
  });
}

// Put a café into the form (or empty it, for a new one)
function fillForm(cafe) {
  const f = form();
  f.reset();
  clearProblems();
  const value = (field, fallback = '') => (cafe && cafe[field] !== null && cafe[field] !== undefined ? cafe[field] : fallback);
  f.elements.name.value = value('name');
  f.elements.id.value = value('id');
  f.elements.area.value = value('area');
  f.elements.zone.value = value('zone');
  f.elements.description.value = value('description');
  f.elements.station.value = value('station');
  f.elements.lat.value = value('lat');
  f.elements.lng.value = value('lng');
  f.elements.hours.value = value('hours');
  f.elements.mapsUrl.value = value('mapsUrl');
  f.elements.sources.value = (cafe ? cafe.sources : []).join('\n');
  f.elements.verified.checked = Boolean(cafe && cafe.verified);
  setTicks('line', cafe ? cafe.line : []);
  setTicks('moods', cafe ? cafe.moods : []);
  setTicks('features', cafe ? cafe.features : []);
  setTicks('price', [String(cafe ? cafe.price : 2)]);

  const known = Boolean(cafe && cafe.openingHours);
  f.elements.hoursKnown.checked = known;
  for (const day of DAYS) {
    f.elements[`day-${day}`].value = known ? dayToText(cafe.openingHours[day] || []) : '';
  }
  showDays();
}

function clearProblems() {
  form().querySelectorAll('[data-error-for]').forEach((error) => {
    error.textContent = '';
    error.hidden = true;
  });
  form().querySelectorAll('[aria-invalid]').forEach((input) => input.removeAttribute('aria-invalid'));
}

function showProblem(field, message) {
  const error = form().querySelector(`[data-error-for="${field}"]`);
  error.textContent = message;
  error.hidden = false;
  const input = form().elements[field];
  if (input && input.setAttribute) input.setAttribute('aria-invalid', 'true');
}

// Keep the order a café's list already had, with only new ticks added at
// the end. (Some cafés list their moods or features in their own order;
// without this, saving one unchanged would still change the file.)
function keepOrder(before, ticked) {
  return [...before.filter((key) => ticked.includes(key)), ...ticked.filter((key) => !before.includes(key))];
}

// Read the form into a café object, in the same order of fields as cafes.json.
// Returns { cafe } or { problems: [[field, message], ...] }.
function readForm() {
  const f = form();
  const original = cafes.find((cafe) => cafe.id === editingId) || { moods: [], features: [], line: [] };
  const text = (field) => f.elements[field].value.trim();
  const ticked = (name) => {
    const values = [...f.querySelectorAll(`[name="${name}"]:checked`)].map((input) => input.value);
    return Array.isArray(original[name]) ? keepOrder(original[name], values) : values; // (price is a number, not a list)
  };
  const problems = [];

  const name = text('name');
  if (!name) problems.push(['name', 'Give the café a name.']);

  // (With no name and no id, the name's message is enough)
  const id = text('id') || slugify(name);
  if (id || text('id')) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) problems.push(['id', 'Use small letters, numbers and hyphens only.']);
    else if (cafes.some((cafe) => cafe.id === id && cafe.id !== editingId)) problems.push(['id', `Another café already has the id "${id}".`]);
  }

  if (!text('area')) problems.push(['area', 'Which part of town is it in?']);
  if (!text('zone')) problems.push(['zone', 'Pick its neighbourhood.']);
  if (!text('description')) problems.push(['description', 'Write a short description.']);

  // Both lat and lng, or neither. Bangkok is about 13.7, 100.5.
  let lat = null;
  let lng = null;
  if (text('lat') || text('lng')) {
    lat = Number(text('lat'));
    lng = Number(text('lng'));
    if (!text('lat') || Number.isNaN(lat) || lat < 13 || lat > 15) problems.push(['lat', 'A latitude near Bangkok is about 13.7 (check the two aren\'t swapped).']);
    if (!text('lng') || Number.isNaN(lng) || lng < 99.5 || lng > 101.5) problems.push(['lng', 'A longitude near Bangkok is about 100.5.']);
  }

  const moods = ticked('moods');
  if (moods.length === 0) problems.push(['moods', 'Tick at least one mood.']);

  let openingHours = null;
  if (f.elements.hoursKnown.checked) {
    openingHours = {};
    for (const day of DAYS) {
      try {
        openingHours[day] = textToDay(f.elements[`day-${day}`].value);
      } catch (error) {
        problems.push([`day-${day}`, error.message]);
      }
    }
  }

  const mapsUrl = text('mapsUrl') || searchLink(name);
  const isWebLink = (url) => /^https?:\/\/\S+$/.test(url);
  if (!isWebLink(mapsUrl)) problems.push(['mapsUrl', 'That isn\'t a web address (it should start with https://).']);

  const sources = f.elements.sources.value.split('\n').map((line) => line.trim()).filter(Boolean);
  const badSource = sources.find((url) => !isWebLink(url));
  if (badSource) problems.push(['sources', `"${badSource}" isn't a web address.`]);

  if (problems.length > 0) return { problems };

  return {
    cafe: {
      id,
      name,
      area: text('area'),
      zone: text('zone'),
      station: text('station'),
      line: ticked('line'),
      lat: lat === null ? null : Math.round(lat * 1e5) / 1e5,
      lng: lng === null ? null : Math.round(lng * 1e5) / 1e5,
      price: Number(ticked('price')[0] || 2),
      moods,
      features: ticked('features'),
      description: text('description'),
      hours: text('hours'),
      openingHours,
      mapsUrl,
      sources,
      verified: f.elements.verified.checked,
    },
  };
}


/* ---------- 4. Saving, deleting and downloading ---------- */

const editor = () => $('#admin-editor');

function openEditor(cafe, button) {
  opener = button;
  editingId = cafe ? cafe.id : null;
  $('[data-editor-title]').textContent = cafe ? `Edit ${cafe.name}` : 'Add a café';
  fillForm(cafe);
  editor().showModal();
  form().elements.name.focus();
}

function saveCafe(event) {
  event.preventDefault();
  clearProblems();
  const { cafe, problems } = readForm();
  if (problems) {
    problems.forEach(([field, message]) => showProblem(field, message));
    const first = form().elements[problems[0][0]];
    (first && first.focus ? first : form().querySelector(`[name="${problems[0][0]}"]`)).focus();
    return;
  }

  if (editingId) {
    const index = cafes.findIndex((other) => other.id === editingId);
    // Keep any extra fields the old entry had that this form doesn't know about
    for (const [key, value] of Object.entries(cafes[index])) {
      if (!(key in cafe)) cafe[key] = value;
    }
    cafes[index] = cafe;
  } else {
    // A new café goes after the last one in its zone (the file is grouped by zone)
    const lastInZone = cafes.map((other) => other.zone).lastIndexOf(cafe.zone);
    cafes.splice(lastInZone === -1 ? cafes.length : lastInZone + 1, 0, cafe);
  }

  unsaved = true;
  renderTable();
  setStatus(`Saved ${cafe.name}.`);
  // When the form closes, focus goes to the café's Edit button in the table
  // (drawn again just now), or back to the button that opened the form
  opener = $(`[data-edit="${CSS.escape(cafe.id)}"]`) || opener;
  editor().close();
}

function deleteCafe(id) {
  const cafe = cafes.find((other) => other.id === id);
  if (!cafe || !window.confirm(`Delete ${cafe.name}? You can still get it back by reloading this page before you download.`)) return;
  cafes = cafes.filter((other) => other.id !== id);
  data.cafes = cafes;
  unsaved = true;
  renderTable();
  setStatus(`Deleted ${cafe.name}.`);
  $('#admin-search').focus();
}

// Build the file and hand it to the browser as a download. It's written the
// same way as the original (two-space indents), so a file with no changes
// comes out exactly the same.
function download() {
  data.cafes = cafes;
  const file = { ...data, meta: { ...data.meta, count: cafes.length }, cafes };
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'cafes.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  unsaved = false;
  setStatus(`Downloaded cafes.json with ${cafes.length} cafés. Put it in the data folder in place of the old one.`);
}


/* ---------- 5. Starting up ---------- */

async function start() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`status ${response.status}`);
    data = await response.json();
  } catch (error) {
    $('[data-admin-load]').textContent = "Couldn't load data/cafes.json. Open this page from the site (or a local server), not by double-clicking the file.";
    console.error(error);
    return;
  }
  cafes = data.cafes;
  buildChoices();
  renderTable();
  $('[data-admin-app]').hidden = false;

  $('#admin-search').addEventListener('input', renderTable);
  $('[data-admin-add]').addEventListener('click', (event) => openEditor(null, event.currentTarget));
  $('[data-admin-download]').addEventListener('click', download);

  // One listener for every Edit and Delete button in the table
  $('[data-admin-rows]').addEventListener('click', (event) => {
    const edit = event.target.closest('[data-edit]');
    const remove = event.target.closest('[data-delete]');
    if (edit) openEditor(cafes.find((cafe) => cafe.id === edit.dataset.edit), edit);
    if (remove) deleteCafe(remove.dataset.delete);
  });

  form().addEventListener('submit', saveCafe);
  form().elements.hoursKnown.addEventListener('change', showDays);
  document.querySelectorAll('[data-editor-close]').forEach((button) => button.addEventListener('click', () => editor().close()));
  // However the form closes (Save, Cancel, X or Escape), focus goes back
  // to the button that opened it (after a save: the café's Edit button)
  editor().addEventListener('close', () => {
    if (opener && opener.isConnected) opener.focus();
  });

  // Leaving with changes that weren't downloaded: the browser asks first
  window.addEventListener('beforeunload', (event) => {
    if (!unsaved) return;
    event.preventDefault();
    event.returnValue = '';
  });
}

start();
