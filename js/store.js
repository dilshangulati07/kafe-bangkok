// store.js: saves small things in the browser using localStorage
// (last used filters and sort order, favourite cafés, visited cafés).
//
// localStorage can fail. Some browsers block it in private mode, and it
// can be full. Every call is wrapped in try/catch so the site keeps
// working either way, it just won't remember things.

// Put in front of every key so ours don't clash with other projects
// you run on the same address (for example localhost:8000).
const PREFIX = 'kafe-bangkok:';

// Read a saved value. Returns `fallback` if nothing is saved or reading fails.
export function load(key, fallback) {
  try {
    const saved = localStorage.getItem(PREFIX + key);
    return saved === null ? fallback : JSON.parse(saved);
  } catch {
    return fallback;
  }
}

// Save a value. localStorage only stores text, so arrays and objects
// are turned into JSON text first. Returns true if it worked.
export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// Favourites and visited cafés are saved as a list of café ids, like
// ["daydream-believer", "suriya-coffee"]. This reads one of those lists
// and returns a Set (a list where each id can only appear once).
// Anything that isn't a list of text (an old or broken save) is ignored.
export function loadIdSet(key) {
  const saved = load(key, []);
  if (!Array.isArray(saved)) return new Set();
  return new Set(saved.filter((id) => typeof id === 'string'));
}

// Save a Set of ids back as a plain list.
export function saveIdSet(key, ids) {
  return save(key, [...ids]);
}
