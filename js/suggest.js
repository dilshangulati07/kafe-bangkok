// suggest.js: the "Suggest a café" form near the bottom of the page.
//
// The form is handled by Netlify Forms (data-netlify="true" in index.html).
// When the site is deployed, Netlify reads the form from the HTML, and from
// then on it stores whatever people send. You read the suggestions in the
// Netlify dashboard, under Forms. There's no server code of our own.
//
// Without JavaScript the form still works: the browser checks the required
// fields and Netlify shows its own thank-you page. With JavaScript (this
// file), the fields are checked with friendlier messages, the form is sent
// in the background with fetch(), and the thank-you appears right here.
//
// Spam: the form has a "honeypot", a hidden field called bot-field. People
// never see it, but simple spam bots fill in every field they find, and
// Netlify quietly throws away anything with bot-field filled in.

import { escapeHtml } from './ui.js';
import { t, moodLabel } from './i18n.js';

// Every field we check, in the order they appear in the form
const FIELDS = ['name', 'area', 'mapsUrl', 'why', 'moods[]', 'email'];

let isSending = false;

// Is this a link to Google Maps? Accepts the app's Share links
// (maps.app.goo.gl/...), older goo.gl/maps links, maps.google.com, and
// google.com/maps (or google.co.th/maps, and so on).
function isGoogleMapsLink(text) {
  let url;
  try {
    url = new URL(text);
  } catch {
    return false; // not a web address at all
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'maps.app.goo.gl') return true;
  if (host === 'goo.gl') return url.pathname.startsWith('/maps');
  if (/^maps\.google\.[a-z.]+$/.test(host)) return true;
  return /^google\.[a-z.]+$/.test(host) && url.pathname.startsWith('/maps');
}

// What's wrong with one field, in words, or '' if it's fine
function problemWith(form, field) {
  const value = field === 'moods[]' ? '' : form.elements[field].value.trim();
  switch (field) {
    case 'name':
      return value ? '' : t('suggest.errName');
    case 'area':
      return value ? '' : t('suggest.errArea');
    case 'mapsUrl':
      if (!value) return t('suggest.errMaps');
      return isGoogleMapsLink(value) ? '' : t('suggest.errMapsWrong');
    case 'why':
      return value ? '' : t('suggest.errWhy');
    case 'moods[]':
      return new FormData(form).getAll('moods[]').length > 0 ? '' : t('suggest.errMoods');
    case 'email':
      // Optional, so empty is fine. validity.valid is the browser's own email check.
      return !value || form.elements.email.validity.valid ? '' : t('suggest.errEmail');
    default:
      return '';
  }
}

// Show (or clear) the message under a field. aria-invalid tells screen
// readers the field has a problem, and each field's aria-describedby already
// points at its message, so they read it out too.
function showProblem(form, field, message) {
  const error = form.querySelector(`[data-error-for="${field}"]`);
  error.textContent = message;
  error.hidden = !message;
  if (field === 'moods[]') {
    error.closest('fieldset').classList.toggle('is-invalid', Boolean(message));
    return;
  }
  const input = form.elements[field];
  if (message) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
}

// Check every field. Returns the names of the ones with a problem.
function checkAll(form) {
  return FIELDS.filter((field) => {
    const message = problemWith(form, field);
    showProblem(form, field, message);
    return message !== '';
  });
}

function focusField(form, field) {
  const input = field === 'moods[]' ? form.querySelector('[name="moods[]"]') : form.elements[field];
  input.focus();
}

// Send the form to Netlify in the background. Netlify wants it the way a
// normal form would send it ("URL-encoded"), with a form-name field saying
// which form it is. FormData collects every field, the honeypot included.
async function send(form) {
  if (isSending) return; // already on its way (a double click, say)

  const problems = checkAll(form);
  if (problems.length > 0) {
    focusField(form, problems[0]);
    return;
  }

  const button = form.querySelector('[type="submit"]');
  const status = form.querySelector('[data-suggest-status]');
  const body = new URLSearchParams(new FormData(form));
  body.set('form-name', form.getAttribute('name'));

  // aria-disabled instead of disabled: a disabled button would lose keyboard focus
  isSending = true;
  button.setAttribute('aria-disabled', 'true');
  button.textContent = t('suggest.sending');
  status.textContent = '';

  try {
    const response = await fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!response.ok) throw new Error(`Netlify answered ${response.status}`);
    showThanks(form, form.elements.name.value.trim());
  } catch {
    // Offline, or not on Netlify (a local test server can't take forms)
    status.textContent = t('suggest.failed');
  } finally {
    isSending = false;
    button.removeAttribute('aria-disabled');
    button.textContent = t('suggest.send');
  }
}

// Swap the form for the thank-you message, and move focus to it so screen
// readers read it out (the form you were in has just gone).
function showThanks(form, cafeName) {
  const thanks = document.getElementById('suggest-thanks');
  thanks.querySelector('[data-suggest-name]').textContent = cafeName;
  form.hidden = true;
  thanks.hidden = false;
  thanks.querySelector('h3').focus();
}

// "Suggest another café": an empty form again
function startAgain(form) {
  form.reset();
  FIELDS.forEach((field) => showProblem(form, field, ''));
  form.querySelector('[data-suggest-status]').textContent = '';
  document.getElementById('suggest-thanks').hidden = true;
  form.hidden = false;
  form.elements.name.focus();
}

// The mood boxes are written in index.html, because Netlify reads the form
// from the HTML when the site is deployed (it has to see a field called
// "moods[]"). Here they're rebuilt from meta.moods, so the labels always
// match the finder's. The [] tells Netlify the field can have several values.
// (Ticked boxes stay ticked when it's redrawn after a language change.)
function buildMoodBoxes(form, moods) {
  const ticked = new FormData(form).getAll('moods[]');
  form.querySelector('[data-suggest-moods]').innerHTML = Object.keys(moods)
    .map((key) => `
      <label class="chip">
        <input class="visually-hidden" type="checkbox" name="moods[]" value="${escapeHtml(key)}"${ticked.includes(key) ? ' checked' : ''}>
        ${escapeHtml(moodLabel(key))}
      </label>`)
    .join('');
}

let suggestForm = null;
let moodKeys = {};

// After a language change: the mood labels, and any messages on show
export function refreshSuggestLanguage() {
  if (!suggestForm) return;
  buildMoodBoxes(suggestForm, moodKeys);
  FIELDS.forEach((field) => {
    const error = suggestForm.querySelector(`[data-error-for="${field}"]`);
    if (!error.hidden) showProblem(suggestForm, field, problemWith(suggestForm, field));
  });
  const status = suggestForm.querySelector('[data-suggest-status]');
  if (status.textContent) status.textContent = t('suggest.failed');
}

export function initSuggest(meta) {
  const form = document.getElementById('suggest-form');
  if (!form) return;
  suggestForm = form;
  moodKeys = meta.moods;

  buildMoodBoxes(form, meta.moods);
  form.noValidate = true; // our messages instead of the browser's pop-ups

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    send(form);
  });

  // Once a field shows a problem, check it again as it's being fixed
  form.addEventListener('input', (event) => {
    const field = event.target.name;
    if (!FIELDS.includes(field)) return;
    const error = form.querySelector(`[data-error-for="${field}"]`);
    if (!error.hidden) showProblem(form, field, problemWith(form, field));
  });

  document.querySelector('[data-suggest-again]').addEventListener('click', () => startAgain(form));
}
