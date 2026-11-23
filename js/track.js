// js/track.js: counts what people do here, without cookies.
//
// Sends tiny anonymous events to /api/track (functions/api/track.js), which
// adds them up for the Insights page of the private dashboard: which cafés
// get opened, which moods people tap, what they search for. Nothing here
// identifies a person. Browsers that ask not to be tracked (Do Not Track or
// Global Privacy Control) send nothing, and neither does a local copy.

const off =
  navigator.globalPrivacyControl === true ||
  navigator.doNotTrack === '1' ||
  /^(localhost|127\.|\[::1\])/.test(location.hostname) ||
  location.protocol === 'file:';

function send(events) {
  if (off || events.length === 0) return;
  const body = JSON.stringify({ events });
  try {
    if (navigator.sendBeacon && navigator.sendBeacon('/api/track', body)) return;
    fetch('/api/track', { method: 'POST', body, keepalive: true }).catch(() => {});
  } catch {
    // Counting must never get in the way of the site.
  }
}

export function track(type, target = '') {
  send([{ type, target: String(target) }]);
}

// The finder's filters: only count a mood, area or search when someone
// picks it, once things have settled (so typing "roast" isn't five events).
// The first call is the filters the page starts with (restored from last
// time or from a shared link), so it's remembered but not counted.
let last = null;
let timer = 0;

const pickedOf = (p) => ({
  mood: new Set(p.moods),
  feature: new Set(p.features),
  zone: new Set(p.zone && p.zone !== 'Anywhere' ? [p.zone] : []),
  line: new Set(p.line && p.line !== 'Any' ? [p.line] : []),
  open_now: new Set(p.openNow ? ['on'] : []),
  search: new Set(p.query && p.query.trim().length >= 2 ? [p.query.trim().toLowerCase()] : []),
});

export function trackFilters(prefs) {
  const now = pickedOf(prefs);
  if (last === null) {
    last = now;
    return;
  }
  clearTimeout(timer);
  timer = setTimeout(() => {
    const events = [];
    for (const [type, values] of Object.entries(now)) {
      for (const value of values) if (!last[type].has(value)) events.push({ type, target: value });
    }
    last = now;
    send(events);
  }, 1500);
}

// "Open in Google Maps" in the café drawer (ui.js gives it data-id).
document.addEventListener('click', (event) => {
  const link = event.target.closest('a.drawer__maps[data-id]');
  if (link) track('maps', link.dataset.id);
});
