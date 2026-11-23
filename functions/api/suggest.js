// functions/api/suggest.js: receives the "Suggest a café" form.
//
// This is a Cloudflare Pages Function, so it runs on Cloudflare, not in the
// browser. It answers POST /api/suggest. Each suggestion is saved as a row in
// the kafe_suggestions table of the D1 database "dilshan-sites" (bound as DB:
// Workers & Pages → kafe-bangkok → Settings → Bindings). You read and approve
// them in the private admin dashboard. If DB isn't bound, it falls back to
// the older KV namespace bound as SUGGESTIONS.
//
// js/suggest.js sends the form in the background and asks for JSON back.
// Without JavaScript, the browser posts the form normally and gets a small
// thank-you page instead.

const LIMITS = { name: 100, area: 80, mapsUrl: 500, why: 1000, email: 200 };
const REQUIRED = ['name', 'area', 'mapsUrl', 'why'];
const MAX_MOODS = 10;

// Same rule as isGoogleMapsLink() in js/suggest.js
function isGoogleMapsLink(text) {
  let url;
  try {
    url = new URL(text);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'maps.app.goo.gl') return true;
  if (host === 'goo.gl') return url.pathname.startsWith('/maps');
  if (/^maps\.google\.[a-z.]+$/.test(host)) return true;
  return /^google\.[a-z.]+$/.test(host) && url.pathname.startsWith('/maps');
}

// Check the fields. Returns { suggestion } or { problem }.
export function readSuggestion(form) {
  const field = (key) => String(form.get(key) ?? '').trim();

  // The honeypot: people never see it, so anything in it means a bot.
  if (field('bot-field')) return { bot: true };

  const suggestion = {};
  for (const [key, max] of Object.entries(LIMITS)) {
    const value = field(key);
    if (value.length > max) return { problem: `${key} is too long` };
    suggestion[key] = value;
  }
  for (const key of REQUIRED) {
    if (!suggestion[key]) return { problem: `${key} is missing` };
  }
  if (!isGoogleMapsLink(suggestion.mapsUrl)) return { problem: 'mapsUrl is not a Google Maps link' };
  if (suggestion.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(suggestion.email)) {
    return { problem: 'email does not look right' };
  }

  const moods = form.getAll('moods[]').map((m) => String(m).trim()).filter(Boolean);
  if (moods.length === 0) return { problem: 'pick at least one mood' };
  if (moods.length > MAX_MOODS || moods.some((m) => !/^[a-z-]{1,20}$/.test(m))) {
    return { problem: 'moods are not valid' };
  }
  suggestion.moods = [...new Set(moods)];
  return { suggestion };
}

function wantsJson(request) {
  return (request.headers.get('Accept') || '').includes('application/json');
}

function reply(request, status, message) {
  if (wantsJson(request)) {
    return Response.json({ ok: status < 400, message }, { status });
  }
  const page = `<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${status < 400 ? 'Thank you' : 'Not sent'} · Kafé Bangkok</title>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.5">
<h1>${status < 400 ? 'Thank you!' : 'Sorry, that didn’t send'}</h1>
<p>${message}</p><p><a href="/#suggest">Back to Kafé Bangkok</a></p></body></html>`;
  return new Response(page, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function onRequestPost({ request, env }) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return reply(request, 400, 'The form could not be read.');
  }

  const { suggestion, problem, bot } = readSuggestion(form);
  // Bots get the same "thank you" as people, so they don't learn to dodge the trap.
  if (bot) return reply(request, 200, 'We’ve got your suggestion.');
  if (problem) return reply(request, 400, `Please check the form: ${problem}.`);

  const when = new Date().toISOString();
  if (env.DB) {
    await env.DB.prepare("INSERT INTO kafe_suggestions (id, created_at, status, data) VALUES (?, ?, 'new', ?)")
      .bind(crypto.randomUUID(), when, JSON.stringify(suggestion))
      .run();
  } else if (env.SUGGESTIONS) {
    const key = `s:${when}:${crypto.randomUUID().slice(0, 8)}`;
    await env.SUGGESTIONS.put(key, JSON.stringify({ ...suggestion, sentAt: when }));
  } else {
    return reply(request, 503, 'Suggestions are not set up on this site yet.');
  }
  return reply(request, 200, 'We’ve got your suggestion. We’ll check it on Google Maps and add it if it’s a good fit.');
}

// Anything other than POST
export function onRequest() {
  return new Response('Send the Suggest a café form here with POST.', { status: 405, headers: { Allow: 'POST' } });
}
