// clock.js: the live Bangkok clock in the hero, and a greeting that changes
// with the time of day there.
//
// It also writes the part of the day onto <html> as data-time="morning",
// "afternoon", "evening" or "night". The CSS uses data-time="night" to
// highlight cafés tagged "Open late / 24h", and this file shows the
// "Open late right now" button at night (app.js decides what it does).
//
// The second half of the file works out today's date in Bangkok (for "Café
// of the day", see bangkokDate) and whether a café is open right now in
// Bangkok, from the openingHours in cafes.json (see openStatus).

import { t } from './i18n.js';

// The greetings are in i18n.js: 'greet.morning', 'greet.afternoon', 'greet.evening', 'greet.night'

// Formats any moment as Bangkok's time, like "07:42", whatever time zone
// the visitor's own device is set to. hourCycle 'h23' means 00–23, never "24:05".
const bangkokTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

// 5:00–11:59 morning, 12:00–16:59 afternoon, 17:00–21:59 evening, the rest night
function partOfDay(hour) {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

// Update the clock, the greeting and the night-time button once
export function tickClock() {
  const timeEl = document.querySelector('[data-clock-time]');
  const greetingEl = document.querySelector('[data-greeting]');
  const openLateButton = document.querySelector('[data-open-late]');
  if (!timeEl) return;

  const time = bangkokTime.format(new Date()); // "07:42"
  const part = partOfDay(Number(time.slice(0, 2)));

  timeEl.textContent = time;
  timeEl.dateTime = time; // the machine-readable version of the time
  if (greetingEl) greetingEl.textContent = t(`greet.${part}`);
  document.documentElement.dataset.time = part;
  if (openLateButton) openLateButton.hidden = part !== 'night';
}

export function startClock() {
  tickClock();
  // Every 30 seconds is often enough to keep the minutes right.
  // (app.js also calls tickClock after a language change, for the greeting.)
  setInterval(tickClock, 30 * 1000);
}


/* ---------- Is it open now? ----------
   openingHours in cafes.json looks like this:
     { "mon": [{ "open": "10:00", "close": "22:00" }], "tue": [], ... }
   - an empty list [] means closed that day
   - "close": "24:00" means open until midnight ("00:00"–"24:00" is all day)
   - a close time earlier than the open time ("18:00"–"02:00") runs past midnight
   - openingHours: null means we don't know the hours

   To compare times across days, every time becomes "minutes since Monday
   00:00": Tuesday 10:30 is 1 × 1440 + 630 = 2070. A week is 10080 minutes. */

const WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_NAMES = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
const DAY = 24 * 60;
const WEEK_MINUTES = 7 * DAY;

// The day and time in Bangkok right now, e.g. { day: 'tue', minutes: 630 } for 10:30
const bangkokDayAndTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function bangkokNow(date = new Date()) {
  // formatToParts gives pieces like { type: 'weekday', value: 'Tue' }
  const parts = {};
  for (const { type, value } of bangkokDayAndTime.formatToParts(date)) parts[type] = value;
  return { day: parts.weekday.slice(0, 3).toLowerCase(), minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

// Today's date in Bangkok (not on the visitor's device, which may be in
// another time zone), for "Café of the day":
//   { key: '2026-11-09', dayNumber: 20401, label: 'Monday 9 November' }
// dayNumber counts the days since 1 January 1970, so it goes up by exactly
// one every day, at midnight in Bangkok.
const bangkokDateParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const bangkokDateWords = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
// The same date in Thai: "วันจันทร์ที่ 9 พฤศจิกายน"
const bangkokDateWordsThai = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export function bangkokDate(date = new Date()) {
  const parts = {};
  for (const { type, value } of bangkokDateParts.formatToParts(date)) parts[type] = value;
  const { year, month, day } = parts;
  return {
    key: `${year}-${month}-${day}`,
    dayNumber: Date.UTC(Number(year), Number(month) - 1, Number(day)) / (24 * 60 * 60 * 1000),
    label: bangkokDateWords.format(date).replace(',', ''), // "Monday 9 November"
    labelThai: bangkokDateWordsThai.format(date),
  };
}

const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

// "minutes since Monday" back to a time of day: 2070 -> "10:30". A closing
// time on the stroke of midnight reads "midnight" ("Closes midnight").
function timeOfDay(weekMinutes, sayMidnight = true) {
  const m = ((weekMinutes % DAY) + DAY) % DAY;
  if (m === 0 && sayMidnight) return 'midnight';
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// Every opening in the week as [start, end] in "minutes since Monday",
// sorted, with touching ones joined (Mon 00:00–24:00 + Tue 00:00–24:00 is one long stretch)
function weekRanges(openingHours) {
  const ranges = [];
  WEEK.forEach((day, i) => {
    for (const { open, close } of openingHours[day] || []) {
      const start = i * DAY + toMinutes(open);
      let end = i * DAY + toMinutes(close);
      if (end <= start) end += DAY; // closes after midnight, on the next day
      ranges.push([start, end]);
    }
  });
  ranges.sort((a, b) => a[0] - b[0]);
  const joined = [];
  for (const range of ranges) {
    const last = joined[joined.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else joined.push([...range]);
  }
  // Sunday night running into Monday morning joins up with Monday too
  if (joined.length > 1 && joined[joined.length - 1][1] >= WEEK_MINUTES + joined[0][0]) {
    const last = joined.pop();
    joined[0] = [last[0] - WEEK_MINUTES, Math.max(joined[0][1], last[1] - WEEK_MINUTES)];
  }
  return joined;
}

// Whether a café is open right now in Bangkok, and what to say about it:
//   { state: 'open',    text: 'Open now',      detail: 'Closes 22:00' }
//   { state: 'open',    text: 'Open 24 hours', detail: '' }
//   { state: 'closed',  text: 'Closed',        detail: 'Opens 10:00' }  (or 'Opens tomorrow 10:00', 'Opens Fri 11:30')
//   { state: 'unknown', text: 'Hours unknown', detail: '' }
// text and detail are in English. The same facts also come as pieces, so
// ui.js can say them in Thai too (see hoursWords there):
//   key: 'open', 'open24', 'closed' or 'unknown'
//   time: when it closes ('22:00' or 'midnight') or opens ('10:00')
//   day: when it opens, if not today: 'tomorrow', or 'fri' and so on
export function openStatus(openingHours, now = bangkokNow()) {
  if (!openingHours) return { state: 'unknown', text: 'Hours unknown', detail: '', key: 'unknown' };
  const ranges = weekRanges(openingHours);
  if (ranges.length === 0) return { state: 'closed', text: 'Closed', detail: '', key: 'closed' };

  const today = WEEK.indexOf(now.day);
  const t = today * DAY + now.minutes;

  // Open now? Also try the same moment a week earlier and later, because a
  // Sunday-night opening that runs into Monday can start before "Monday 00:00"
  // or end after "Sunday 24:00".
  for (const [start, end] of ranges) {
    for (const time of [t - WEEK_MINUTES, t, t + WEEK_MINUTES]) {
      if (time >= start && time < end) {
        if (end - start >= WEEK_MINUTES || end - time >= DAY) return { state: 'open', text: 'Open 24 hours', detail: '', key: 'open24' };
        return { state: 'open', text: 'Open now', detail: `Closes ${timeOfDay(end)}`, key: 'open', time: timeOfDay(end) };
      }
    }
  }

  // Closed: find the next opening, going round the week if needed
  let wait = Infinity;
  for (const [start] of ranges) wait = Math.min(wait, (((start - t) % WEEK_MINUTES) + WEEK_MINUTES) % WEEK_MINUTES);
  const opensAt = t + wait;
  const daysAhead = Math.floor(opensAt / DAY) - today;
  let when = '';
  let day = null;
  if (daysAhead === 1) {
    when = 'tomorrow ';
    day = 'tomorrow';
  } else if (daysAhead > 1) {
    day = WEEK[Math.floor(opensAt / DAY) % 7];
    when = `${DAY_NAMES[day]} `;
  }
  const time = timeOfDay(opensAt, false);
  return { state: 'closed', text: 'Closed', detail: `Opens ${when}${time}`, key: 'closed', time, day };
}
