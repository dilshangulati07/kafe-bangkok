// functions/api/track.js: counts what people do on Kafé Bangkok.
//
// js/track.js sends small, anonymous events here ("someone opened café X",
// "someone tapped the Date spot mood"). Each one becomes a row in the
// site_events table of the D1 database "dilshan-sites", and the private
// admin dashboard turns them into the Insights page.
//
// No cookies, no IP addresses, no ids that follow a person around: only the
// event, the café or filter it was about, the day and the country (which
// Cloudflare already knows from the request).

const TYPES = new Set(['open', 'maps', 'save', 'surprise', 'chat', 'map_view', 'mood', 'feature', 'zone', 'line', 'search', 'open_now', 'share']);
const MAX_EVENTS = 12;
const MAX_BODY = 4000;
const BOTS = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|curl|wget|python/i;

// "2026-11-24" in Bangkok time (UTC+7, no daylight saving)
export function bangkokDay(date = new Date()) {
  return new Date(date.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

// Keep only known event types and short, plain targets.
export function cleanEvents(body) {
  const list = Array.isArray(body?.events) ? body.events.slice(0, MAX_EVENTS) : [];
  return list
    .filter((e) => e && TYPES.has(e.type))
    .map((e) => {
      const target = String(e.target ?? '')
        .replace(/[\u0000-\u001f]/g, ' ')
        .trim()
        .slice(0, 80);
      // Searches are counted case-blind ("Roast" and "roast" are one search)
      return { type: e.type, target: e.type === 'search' ? target.toLowerCase() : target };
    });
}

const done = () => new Response(null, { status: 204 });

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return new Response(null, { status: 403 });
  if (BOTS.test(request.headers.get('User-Agent') || '')) return done();
  if (!env.DB) return done(); // preview deployments have no database

  const text = await request.text();
  if (text.length > MAX_BODY) return new Response(null, { status: 413 });
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  const events = cleanEvents(body);
  if (events.length === 0) return done();

  const now = new Date();
  const day = bangkokDay(now);
  const country = String(request.cf?.country || '').slice(0, 2);
  const insert = env.DB.prepare(
    'INSERT INTO site_events (site, day, created_at, type, target, country) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const statements = events.map((e) => insert.bind('kafe', day, now.toISOString(), e.type, e.target, country));
  // Now and then, forget events older than about 13 months.
  if (Math.random() < 0.005) {
    statements.push(env.DB.prepare("DELETE FROM site_events WHERE day < date('now', '-400 days')"));
  }
  try {
    await env.DB.batch(statements);
  } catch {
    // Counting must never break the site, so a failed write is just skipped.
  }
  return done();
}
