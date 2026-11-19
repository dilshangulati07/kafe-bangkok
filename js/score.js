// score.js: works out how well one café matches what the user picked.
// app.js calls scoreCafe(cafe, prefs) for every café and sorts by the score.
// Area, price and "near BTS/MRT only" are hard filters in app.js, so a café
// that reaches this function has already passed them.

// Short phrases for the "why it fits" note on each card.
// The keys are the same as meta.moods and meta.features in data/cafes.json.
const LABELS = {
  moods: {
    date: 'great for a date',
    green: 'green and leafy',
    work: 'good for working',
    aesthetic: 'pretty space',
    budget: 'easy on the wallet',
  },
  features: {
    garden: 'garden seating',
    outdoor: 'outdoor seating',
    river: 'by the river',
    rooftop: 'rooftop seats',
    view: 'nice view',
    quiet: 'quiet',
    wifi: 'good Wi-Fi',
    specialty: 'specialty coffee',
    dessert: 'desserts and bakes',
    brunch: 'brunch menu',
    lateNight: 'open late',
    pets: 'pet-friendly',
    music: 'music and vinyl',
    books: 'books to read',
  },
};

// Points. Moods are worth the most because they're the main reason people
// pick a café. The bonuses are small so they only break ties.
const MOOD_POINTS = 10;
const FEATURE_POINTS = 6;
const STATION_BONUS = 2;
const VERIFIED_BONUS = 1;

// prefs looks like { moods: ['work'], features: ['lateNight'], ... }
// Returns { score: 0-100, reasons: ['good for working', 'open late', 'near BTS Ari'] }
export function scoreCafe(cafe, prefs) {
  const moods = prefs.moods || [];
  const features = prefs.features || [];

  // Nothing picked yet, so there's nothing to match against.
  if (moods.length === 0 && features.length === 0) {
    return { score: 0, reasons: [] };
  }

  let earned = 0;
  const reasons = [];

  // The best a café could do: have every selected mood and feature, plus both bonuses.
  const maxPossible = moods.length * MOOD_POINTS
    + features.length * FEATURE_POINTS
    + STATION_BONUS
    + VERIFIED_BONUS;

  // Moods first, so they come first in the reasons too.
  for (const mood of moods) {
    if (cafe.moods.includes(mood)) {
      earned += MOOD_POINTS;
      reasons.push(LABELS.moods[mood] || mood);
    }
  }

  for (const feature of features) {
    if (cafe.features.includes(feature)) {
      earned += FEATURE_POINTS;
      reasons.push(LABELS.features[feature] || feature);
    }
  }

  // station is an empty string when we don't know one, and '' counts as false.
  if (cafe.station) {
    earned += STATION_BONUS;
    reasons.push('near ' + cafe.station);
  }

  if (cafe.verified === true) {
    earned += VERIFIED_BONUS;
  }

  // maxPossible is always at least 13 here, but check anyway so we never divide by zero.
  const score = maxPossible > 0 ? Math.round((earned / maxPossible) * 100) : 0;
  return { score, reasons };
}
