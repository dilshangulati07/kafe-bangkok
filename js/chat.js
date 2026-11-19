// chat.js: "Ask the barista", a small chat that recommends cafés.
//
// There's no AI and no API here, just rules:
//   1. A keyword parser reads what you type ("quiet cheap place in Ari", or
//      in Thai, "คาเฟ่เงียบ ๆ ถูก ๆ แถวอารีย์") and turns it into prefs, the
//      same shape the finder uses.
//   2. If something's missing, the barista asks for it: mood, area,
//      must-haves, budget, with quick-reply chips for each.
//   3. Cafés go through the finder's own filters (app.js hands those over)
//      and are ranked with scoreCafe from score.js.
//   4. The top 3 show as mini cards. Follow-ups like "something cheaper",
//      "somewhere else", "closer to BTS" and "more" change the last search.
//   5. Simple negatives work too: "no rooftop" (or "ไม่เอาดาดฟ้า") takes a
//      must-have away, "not too crowded" means quiet, "not expensive"
//      (or "ไม่แพง") means budget.
//
// The barista answers in the language that's switched on (its lines are in
// i18n.js), and understands English and some Thai whichever one that is.
//
// Contents
//   1. Words the barista understands
//   2. Picking a line
//   3. State
//   4. Setting up, opening and closing
//   5. Drawing messages, chips and mini cards
//   6. Reacting to chips and typed messages
//   7. Asking questions and showing cafés
//   8. Reading typed messages (the keyword parser)

import { scoreCafe } from './score.js';
import { escapeHtml, icon, ICONS, trapFocus, closeOnOutsideClick } from './ui.js';
import { load, save } from './store.js';
import { t, tHtml, inEnglish, lines, moodLabel, featureLabel, priceLabel, reasonText, getLang, num } from './i18n.js';


/* ---------- 1. Words the barista understands ---------- */

// Each rule: if any of these words appear, this is what they mean.
// Keys (date, garden, wifi...) are the same short keys as in cafes.json.
// `words` are English, matched as whole words. `thai` are Thai, matched
// anywhere in the message, because Thai is written without spaces between words.
const WORD_RULES = [
  // Moods
  { words: ['date', 'dates', 'romantic', 'romance', 'girlfriend', 'boyfriend', 'anniversary'], thai: ['เดท', 'แฟน', 'โรแมนติก'], moods: ['date'] },
  { words: ['plant', 'plants', 'green', 'greenery', 'nature', 'tree', 'trees', 'leafy', 'jungle'], thai: ['ต้นไม้', 'ธรรมชาติ', 'ร่มรื่น', 'สีเขียว'], moods: ['green'] },
  { words: ['garden', 'gardens'], thai: ['สวน'], moods: ['green'], features: ['garden'] },
  { words: ['work', 'working', 'study', 'studying', 'laptop', 'remote'], thai: ['ทำงาน', 'อ่านหนังสือ', 'ติวหนังสือ', 'โน้ตบุ๊ก', 'โน๊ตบุ๊ค'], moods: ['work'] },
  { words: ['wifi', 'wi-fi', 'internet'], thai: ['ไวไฟ', 'เน็ต'], moods: ['work'], features: ['wifi'] },
  { words: ['pretty', 'instagram', 'instagrammable', 'aesthetic', 'photo', 'photos', 'cute', 'beautiful'], thai: ['สวย', 'ถ่ายรูป', 'น่ารัก', 'มินิมอล'], moods: ['aesthetic'] },
  { words: ['cheap', 'budget', 'student', 'students', 'affordable'], thai: ['ถูก', 'ประหยัด', 'นักศึกษา'], moods: ['budget'], maxPrice: 1 },
  // Must-haves
  { words: ['quiet', 'calm', 'peaceful'], thai: ['เงียบ', 'สงบ'], features: ['quiet'] },
  { words: ['late', 'night', 'tonight', 'midnight', '24', '24h'], thai: ['เปิดดึก', 'ดึก', 'กลางคืน', '24 ชม', '24 ชั่วโมง'], features: ['lateNight'] },
  { words: ['dog', 'dogs', 'cat', 'cats', 'pet', 'pets', 'puppy'], thai: ['สัตว์เลี้ยง', 'น้องหมา', 'หมาแมว', 'สุนัข', 'แมว'], features: ['pets'] },
  { words: ['river', 'riverside', 'canal'], thai: ['ริมน้ำ', 'แม่น้ำ', 'ริมคลอง', 'เจ้าพระยา'], features: ['river'] },
  { words: ['rooftop', 'roof'], thai: ['ดาดฟ้า', 'รูฟท็อป'], features: ['rooftop'] },
  { words: ['view', 'views', 'skyline'], thai: ['วิว'], features: ['view'] },
  { words: ['brunch', 'breakfast'], thai: ['บรันช์', 'อาหารเช้า'], features: ['brunch'] },
  { words: ['dessert', 'desserts', 'cake', 'cakes', 'bakery', 'pastry', 'pastries', 'croissant'], thai: ['ขนม', 'ของหวาน', 'เค้ก', 'เบเกอรี่', 'ครัวซองต์'], features: ['dessert'] },
  { words: ['outdoor', 'outdoors', 'outside', 'terrace'], thai: ['กลางแจ้ง', 'นอกร้าน', 'เอาท์ดอร์'], features: ['outdoor'] },
  { words: ['specialty', 'speciality', 'pour over', 'single origin'], thai: ['สเปเชียลตี้', 'กาแฟดริป'], features: ['specialty'] },
  { words: ['vinyl', 'music', 'records'], thai: ['แผ่นเสียง', 'ดนตรี', 'เพลง'], features: ['music'] },
  // Not plain 'หนังสือ' (book): 'อ่านหนังสือ' means "study" and belongs to work above.
  { words: ['book', 'books', 'reading', 'library', 'bookshop', 'bookstore'], thai: ['ร้านหนังสือ', 'ห้องสมุด', 'คาเฟ่หนังสือ', 'หนังสือให้อ่าน', 'บุ๊คคาเฟ่'], features: ['books'] },
  // Getting there
  { words: ['bts', 'mrt', 'skytrain', 'station'], thai: ['รถไฟฟ้า', 'บีทีเอส', 'สถานี'], nearStation: true },
  // Opening hours: only cafés open right now in Bangkok
  { words: ['open now', 'right now', 'still open', 'currently open', 'open at the moment', 'open right now'], thai: ['เปิดอยู่', 'เปิดตอนนี้', 'ยังเปิด'], openNow: true },
];

// Words for each part of town. The zone names must match cafes.json
// exactly; initChat drops any that don't, so a renamed zone can't break the chat.
const ZONE_RULES = [
  { words: ['ari', 'phaya thai', 'sanam pao'], thai: ['อารีย์', 'พญาไท', 'สนามเป้า'], zone: 'Ari & Phaya Thai' },
  { words: ['thonglor', 'thong lo', 'thonglo', 'ekkamai', 'ekamai', 'phra khanong'], thai: ['ทองหล่อ', 'เอกมัย', 'พระโขนง'], zone: 'Thonglor, Ekkamai & Phra Khanong' },
  { words: ['siam', 'ratchathewi', 'phloen chit', 'ploenchit', 'chidlom', 'lumphini'], thai: ['สยาม', 'ราชเทวี', 'เพลินจิต', 'ชิดลม', 'ลุมพินี'], zone: 'Siam & Central' },
  { words: ['silom', 'sathorn', 'sathon', 'charoen krung', 'bang rak'], thai: ['สีลม', 'สาทร', 'เจริญกรุง', 'บางรัก'], zone: 'Silom, Sathorn & Riverside' },
  { words: ['chinatown', 'china town', 'old town', 'yaowarat', 'khao san', 'banglamphu', 'talat noi'], thai: ['เยาวราช', 'ไชน่าทาวน์', 'เมืองเก่า', 'ข้าวสาร', 'บางลำพู', 'ตลาดน้อย'], zone: 'Old Town & Chinatown' },
  { words: ['lat phrao', 'ladprao', 'lad phrao'], thai: ['ลาดพร้าว'], zone: 'Lat Phrao & North' },
  { words: ['bang na', 'bangna', 'on nut', 'onnut'], thai: ['บางนา', 'อ่อนนุช'], zone: 'On Nut & Bang Na' },
  { words: ['thonburi', 'bang kachao', 'taling chan'], thai: ['ธนบุรี', 'ฝั่งธน', 'บางกะเจ้า', 'ตลิ่งชัน'], zone: 'Thonburi & Bang Kachao' },
  { words: ['phrom phong', 'phromphong', 'asok', 'asoke', 'sukhumvit'], thai: ['พร้อมพงษ์', 'อโศก', 'สุขุมวิท'], zone: 'Sukhumvit (Asok to Phrom Phong)' },
];

// Follow-ups that change the last search instead of starting a new one.
// The English ones are regular expressions: \b means "the edge of a word",
// so "cheaper" matches but "cheapest-looking" wouldn't sneak in by accident.
// The Thai ones are plain words to look for.
const FOLLOW_UPS = {
  restart: { english: /\b(start over|start again|restart|reset)\b/, thai: ['เริ่มใหม่'] },
  cheaper: { english: /\b(cheaper|less expensive|lower price)\b/, thai: ['ถูกกว่า', 'ถูกลง'] },
  elsewhere: { english: /\b(somewhere|something|someplace) else\b|\b(other|different) (ones|cafes|places|options)\b/, thai: ['ที่อื่น', 'ร้านอื่น'] },
  closer: { english: /\b(closer|nearer|near|close) to (a |the )?(bts|mrt|skytrain|station|train)\b/, thai: ['ใกล้รถไฟฟ้า', 'ใกล้สถานี', 'ใกล้ bts', 'ใกล้ mrt'] },
  surprise: { english: /\bsurprise\b|\brandom\b/, thai: ['สุ่ม'] },
  more: { english: /\b(more|next|others)\b/, thai: ['อีก', 'เพิ่ม'] },
};

// Negatives: "no rooftop", "not romantic", "don't want a garden", "without
// music". A few small words may sit in between: "not too crowded",
// "not in Ari". This is the start of a regular expression; findNegated
// adds the keyword to the end of it.
const NEGATION = String.raw`\b(?:not|no|don'?t want|do not want|without)\s+(?:(?:too|very|so|that|really|overly|a|an|any|the|in|near|around)\s+)*`;
// The same in Thai: ไม่ (not), ไม่เอา (don't want), ไม่ต้อง (don't need)...
// and a small word may follow: ไม่ค่อยแพง (not very expensive), ไม่เอาร้านดาดฟ้า.
const THAI_NEGATION = String.raw`(?:ไม่ต้องการ|ไม่ต้องมี|ไม่เอา|ไม่ต้อง|ไม่ชอบ|ไม่มี|ไม่)\s*(?:ค่อย|ร้าน|แบบ|ที่|ใน|แถว)?\s*`;

// Words that only mean something after a negative:
// "not too crowded" means quiet, "not expensive" means budget (up to ฿฿).
const NEGATED_MEANINGS = [
  { words: ['crowded', 'busy', 'noisy', 'loud', 'packed'], thai: ['คนเยอะ', 'วุ่นวาย', 'เสียงดัง', 'พลุกพล่าน'], features: ['quiet'] },
  { words: ['expensive', 'pricey', 'fancy', 'overpriced'], thai: ['แพง'], moods: ['budget'], maxPrice: 2 },
];

// Typed answers that mean "skip this question"
const SKIP_WORDS = {
  area: { english: /\b(anywhere|any area|don'?t mind|doesn'?t matter|no preference|whatever|wherever)\b/, thai: ['ที่ไหนก็ได้', 'ย่านไหนก็ได้', 'ไม่เลือก'] },
  features: { english: /\b(no|nope|nah|nothing|none|that'?s (all|it|everything)|skip)\b/, thai: ['ไม่มี', 'พอแล้ว', 'แค่นี้', 'ไม่ต้อง'] },
  budget: { english: /\b(any|anything|don'?t mind|doesn'?t matter|whatever|no limit)\b/, thai: ['เท่าไหร่ก็ได้', 'ราคาไหนก็ได้', 'ไม่จำกัด'] },
  midBudget: { english: /\b(mid|middle|medium|moderate)\b/, thai: ['กลางๆ', 'กลาง ๆ', 'ปานกลาง'] },
};

// "café", "coffee", "คาเฟ่": a message with only these is someone starting
// out, so the barista asks what kind of café instead of saying "pardon?"
const CAFE_WORDS = { english: /\b(cafe|cafes|coffee|coffee shop)\b/, thai: ['คาเฟ่', 'กาแฟ'] };

// The must-haves offered as chips (people can still type any of the others)
const COMMON_FEATURES = ['garden', 'quiet', 'wifi', 'lateNight', 'river', 'dessert'];

const RESULTS_PER_PAGE = 3;
const TYPING_DELAY = 450; // ms the barista "types" before each reply


/* ---------- 2. Picking a line ----------
   The barista has a few ways to say each thing (in i18n.js, like
   'chat.greet'), so it doesn't sound like a machine. pick() chooses one at random. */
function pick(options) {
  return options[Math.floor(Math.random() * options.length)];
}

const say = (key) => pick(lines(`chat.${key}`));

// The barista's avatar: our "K" mark, a small navy circle with a white K.
// Its colours come from the .k-mark classes in style.css.
const AVATAR = `
  <svg class="k-mark avatar" viewBox="0 0 28 28" aria-hidden="true">
    <circle class="k-mark__disc" cx="14" cy="14" r="13"/>
    <path class="k-mark__k" d="M10.5 8v12M10.5 14.6L17 8M12.4 13.1l5.1 6.9"/>
  </svg>`;


/* ---------- 3. State ---------- */

let options;       // what app.js handed over (see initChat)
let panel, scroller, log, typing, chipBox, form, input, fab;

let opener = null;              // the button that opened the chat
let returnFocusOnClose = true;  // false when "Use these in the finder" closes it
let started = false;            // has the barista said hello yet?
let currentChips = [];          // the chips on screen right now
let lastSession = null;         // prefs saved from a previous visit
let queue = Promise.resolve();  // replies happen one after another (see enqueue)

// Every search's prefs, so a mini card can open the drawer with the
// prefs it was found with, even after the conversation has moved on.
const searches = [];

const convo = {
  prefs: emptyPrefs(),
  step: 'mood',         // what the barista just asked: 'mood', 'area', 'features', 'budget' or 'results'
  answered: new Set(),  // questions already answered ('area', 'features', 'budget')
  ranked: null,         // the full ranked list for the current search (null = no search yet)
  shownCount: 0,        // how many of `ranked` have been shown so far
  excluded: new Set(),  // café ids the user said "somewhere else" to
};

function emptyPrefs() {
  return { moods: [], features: [], zone: 'Anywhere', line: 'Any', maxPrice: 3, nearStation: false, openNow: false };
}

// A copy with only the fields the chat uses (so saved data can't add extras)
function copyPrefs(prefs) {
  return {
    moods: [...prefs.moods],
    features: [...prefs.features],
    zone: prefs.zone,
    line: prefs.line || 'Any',
    maxPrice: prefs.maxPrice,
    nearStation: prefs.nearStation,
    openNow: prefs.openNow === true,
  };
}

function hasAnyPrefs(prefs) {
  return prefs.moods.length > 0 || prefs.features.length > 0
    || prefs.zone !== 'Anywhere' || prefs.maxPrice < 3 || prefs.nearStation || prefs.openNow;
}

function startFresh() {
  convo.prefs = emptyPrefs();
  convo.step = 'mood';
  convo.answered = new Set();
  convo.ranked = null;
  convo.shownCount = 0;
  convo.excluded = new Set();
}


/* ---------- 4. Setting up, opening and closing ---------- */

// app.js calls this once the café data has loaded. `settings` contains:
//   cafes, meta, saved       the data and the Sets of hearted/visited ids
//   zones                    every zone name in cafes.json
//   passesFilters(cafe, prefs)   the finder's filters (area, price, station, open now, must-haves)
//   cleanPrefs(prefs)        checks prefs loaded from localStorage
//   openCafe(id, opener, prefs)  opens the detail drawer
//   useInFinder(prefs)       copies prefs into the finder and scrolls there
//   countChains(prefs)       how many OpenStreetMap chain cafés pass these
//                            filters, and the biggest brands (a Promise)
//   showChains(prefs)        copies prefs into the finder, switches on
//                            "Include chains" and scrolls to those cafés
export function initChat(settings) {
  options = settings;

  // Forget any zone rule whose zone isn't in the data
  for (let i = ZONE_RULES.length - 1; i >= 0; i--) {
    if (!options.zones.includes(ZONE_RULES[i].zone)) ZONE_RULES.splice(i, 1);
  }

  panel = document.getElementById('chat');
  scroller = panel.querySelector('.chat__scroll');
  log = panel.querySelector('.chat__log');
  typing = panel.querySelector('.chat__typing');
  chipBox = panel.querySelector('.chat__chips');
  form = panel.querySelector('.chat__form');
  input = panel.querySelector('#chat-input');
  fab = document.querySelector('.chat-fab');

  panel.querySelectorAll('[data-avatar]').forEach((slot) => { slot.innerHTML = AVATAR; });

  panel.querySelector('[data-close-chat]').addEventListener('click', () => panel.close());
  closeOnOutsideClick(panel);
  panel.addEventListener('keydown', (event) => trapFocus(panel, event));
  panel.addEventListener('close', handleClose);

  chipBox.addEventListener('click', handleChipClick);
  form.addEventListener('submit', handleSubmit);

  // Mini cards in the conversation open the detail drawer
  log.addEventListener('click', (event) => {
    const card = event.target.closest('[data-chat-open]');
    if (card) {
      options.openCafe(card.dataset.chatOpen, card, searches[card.dataset.search]);
    }
  });

  fab.hidden = false; // the round button only appears once the chat can work
}

// After a language change: the chips on show get their new words. (Messages
// already in the conversation stay as they were said.)
export function refreshChatLanguage() {
  if (chipBox && currentChips.length > 0) showChips(currentChips);
}

// `openerButton` is whichever "Ask the barista" button was pressed.
export function openChat(openerButton) {
  opener = openerButton || null;
  if (!panel.open) panel.showModal();
  // Focus the title (not the text box), so phones don't pop the keyboard up
  // over the barista's first message. Tab goes on to the chips and the box.
  panel.querySelector('#chat-title').focus();

  if (!started) {
    started = true;
    enqueue(greet);
  }
}

// When the chat closes (X, Escape or a click outside), put focus back on the
// button that opened it. The top-bar button may be hidden by then (the
// phone menu closes), so fall back to the round button.
function handleClose() {
  if (returnFocusOnClose && opener) {
    opener.focus();
    if (document.activeElement !== opener) fab.focus();
  }
  returnFocusOnClose = true;
  opener = null;
}

// Replies are async (the barista "types" for a moment), so if you send two
// messages quickly, the second waits for the first reply to finish.
function enqueue(task) {
  queue = queue.then(task).catch((error) => console.error(error));
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


/* ---------- 5. Drawing messages, chips and mini cards ---------- */

function addMessage(who, html) {
  const message = document.createElement('div');
  message.className = `msg msg--${who}`;
  const speaker = who === 'barista' ? t('chat.baristaSays') : t('chat.youSaid');
  message.innerHTML = `
    ${who === 'barista' ? `<span class="msg__avatar">${AVATAR}</span>` : ''}
    <div class="msg__bubble"><span class="visually-hidden">${escapeHtml(speaker)} </span>${html}</div>`;
  log.append(message);
  scroller.scrollTop = scroller.scrollHeight;
}

// The barista replies: a short "typing" pause, then the message, then chips.
async function barista(html, chips = []) {
  showChips([]);
  typing.hidden = false;
  scroller.scrollTop = scroller.scrollHeight;
  await wait(TYPING_DELAY);
  typing.hidden = true;
  addMessage('barista', html);
  showChips(chips);
}

// A chip's label is a small function (like () => moodLabel('date')), so the
// same chip can say its words again in the other language after a switch.
const labelOf = (chip) => chip.label();

// `chips` is a list like [{ label: () => 'Date spot', action: 'mood', value: 'date' }]
function showChips(chips) {
  currentChips = chips;
  chipBox.innerHTML = chips
    .map((chip, index) => `<button class="chat-chip" type="button" data-chip="${index}">${escapeHtml(labelOf(chip))}</button>`)
    .join('');
  chipBox.hidden = chips.length === 0;
}

// `results` is [{ cafe, score, reasons }, ...]. Each mini card is a button
// that opens the drawer, plus a heart. The heart uses data-action="favourite",
// so app.js handles it exactly like the hearts on the big cards.
function miniCardsHtml(results, searchIndex) {
  const cards = results.map(({ cafe, score, reasons }) => {
    const id = escapeHtml(cafe.id);
    const name = escapeHtml(cafe.name);
    const match = score > 0 ? escapeHtml(t('chat.match', { n: Math.round(score) })) : '';
    const reason = reasons.length > 0
      ? `<span class="mini-card__reason">${escapeHtml(reasonText(reasons[0]))}</span>`
      : '';
    return `
      <li class="mini-card">
        <button class="mini-card__open" type="button" data-chat-open="${id}" data-search="${searchIndex}" aria-haspopup="dialog">
          <span class="mini-card__name" lang="en">${name}</span>
          <span class="mini-card__meta">${escapeHtml(cafe.area)}${match}</span>
          ${reason}
        </button>
        <button class="toggle toggle--save mini-card__save" type="button" data-action="favourite" data-id="${id}" aria-pressed="${options.saved.favourites.has(cafe.id)}">
          ${icon(ICONS.heart)}<span class="visually-hidden">${tHtml('chat.save', { name: inEnglish(cafe.name) })}</span>
        </button>
      </li>`;
  });
  return `<ul class="mini-cards">${cards.join('')}</ul>`;
}

// The barista reads your order back, like a ticket:
// "Your order: Work / study, Budget · Quiet · Ari & Phaya Thai · up to ฿"
function orderHtml(prefs) {
  return `<p class="msg__order"><span class="msg__order-label">${escapeHtml(t('chat.order'))}</span> ${escapeHtml(describe(prefs))}</p>`;
}

function describe(prefs) {
  const parts = [];
  if (prefs.moods.length > 0) parts.push(prefs.moods.map(moodLabel).join(', '));
  if (prefs.features.length > 0) parts.push(prefs.features.map(featureLabel).join(', '));
  parts.push(prefs.zone === 'Anywhere' ? t('chat.anywhere') : prefs.zone);
  if (prefs.maxPrice < 3) parts.push(t('chat.upTo', { price: '฿'.repeat(prefs.maxPrice) }));
  if (prefs.nearStation) parts.push(t('chat.nearStation'));
  if (prefs.openNow) parts.push(t('chat.openNow'));
  return parts.join(' · ');
}

// The chips for each question
function moodChips() {
  return Object.keys(options.meta.moods).map((key) => ({ label: () => moodLabel(key), action: 'mood', value: key }));
}

function areaChips() {
  return [
    { label: () => t('chat.chipAnywhere'), action: 'area', value: 'Anywhere' },
    ...options.zones.map((zone) => ({ label: () => zone, action: 'area', value: zone })),
  ];
}

function featureChips() {
  const left = COMMON_FEATURES.filter((key) => !convo.prefs.features.includes(key));
  return [
    ...left.map((key) => ({ label: () => featureLabel(key), action: 'feature', value: key })),
    { label: () => t('chat.chipDone'), action: 'features-done' },
  ];
}

function budgetChips() {
  return [
    { label: () => priceLabel(1), action: 'budget', value: 1 },
    { label: () => priceLabel(2), action: 'budget', value: 2 },
    { label: () => t('chat.chipAnyPrice'), action: 'budget', value: 3 },
  ];
}

function resultChips() {
  const chips = [];
  if (convo.ranked && convo.shownCount < convo.ranked.length) {
    chips.push({ label: () => t('chat.chipMore'), action: 'more' });
  }
  chips.push(
    { label: () => t('chat.chipSurprise'), action: 'surprise' },
    { label: () => t('chat.chipRestart'), action: 'restart' },
    { label: () => t('chat.chipFinder'), action: 'finder' },
  );
  return chips;
}

// When nothing fits, offer to drop whichever filters are switched on.
// `fixes` are must-haves that bring cafés back when dropped (see mustHaveFixes).
function relaxChips(fixes = []) {
  const chips = fixes.map((fix) => ({
    label: () => t('chat.chipWithout', { name: featureLabel(fix.key) }),
    action: 'relax-feature',
    value: fix.key,
  }));
  if (convo.prefs.zone !== 'Anywhere') chips.push({ label: () => t('chat.chipTryAnywhere'), action: 'relax-zone' });
  if (convo.prefs.maxPrice < 3) chips.push({ label: () => t('chat.chipAnyPrice'), action: 'relax-price' });
  if (convo.prefs.nearStation) chips.push({ label: () => t('chat.chipStationOrNot'), action: 'relax-station' });
  if (convo.prefs.openNow) chips.push({ label: () => t('chat.chipAnyTime'), action: 'relax-open' });
  if (convo.excluded.size > 0) chips.push({ label: () => t('chat.chipEarlier'), action: 'relax-excluded' });
  chips.push({ label: () => t('chat.chipRestart'), action: 'restart' });
  return chips;
}


/* ---------- 6. Reacting to chips and typed messages ---------- */

function handleChipClick(event) {
  const button = event.target.closest('[data-chip]');
  if (!button) return;
  const chip = currentChips[button.dataset.chip];
  // event.detail is 0 when the button was pressed with the keyboard
  const byKeyboard = event.detail === 0;
  showChips([]); // so a second tap can't send it twice

  enqueue(async () => {
    addMessage('user', `<p>${escapeHtml(labelOf(chip))}</p>`);
    await runChip(chip);
    // Keyboard users lost focus with the old chips, so put it on the first
    // new chip (or the text box). Mouse and touch users don't need this.
    if (byKeyboard) (chipBox.querySelector('button') || input).focus();
  });
}

function handleSubmit(event) {
  event.preventDefault(); // stop the form reloading the page
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  enqueue(async () => {
    addMessage('user', `<p>${escapeHtml(text)}</p>`);
    await handleText(text);
  });
}

function runChip(chip) {
  switch (chip.action) {
    case 'mood':
      startFresh();
      convo.prefs.moods = [chip.value];
      return continueFlow(say('leadIn'));
    case 'area':
      convo.prefs.zone = chip.value;
      convo.answered.add('area');
      return continueFlow(say('leadIn'));
    case 'feature':
      convo.prefs.features.push(chip.value);
      return ask('features', say('leadIn')); // "Lovely. Anything else?"
    case 'features-done':
      convo.answered.add('features');
      return continueFlow();
    case 'budget':
      convo.prefs.maxPrice = chip.value;
      convo.answered.add('budget');
      return continueFlow();
    case 'more':
      return showMore();
    case 'surprise':
      return surprise();
    case 'restart':
      return startOver();
    case 'finder':
      return useInFinder();
    case 'chains':
      return showChains();
    case 'resume':
      convo.prefs = copyPrefs(lastSession);
      return showResults(say('resume'));
    case 'relax-zone':
      convo.prefs.zone = 'Anywhere';
      return showResults(t('chat.relaxZone'));
    case 'relax-price':
      convo.prefs.maxPrice = 3;
      return showResults(t('chat.relaxPrice'));
    case 'relax-station':
      convo.prefs.nearStation = false;
      return showResults(t('chat.relaxStation'));
    case 'relax-open':
      convo.prefs.openNow = false;
      return showResults(t('chat.relaxOpen'));
    case 'relax-feature':
      convo.prefs.features = convo.prefs.features.filter((key) => key !== chip.value);
      return showResults(t('chat.relaxFeature', { label: labelOf(chip) })); // "Without Garden, then."
    case 'relax-excluded':
      convo.excluded.clear();
      return showResults(t('chat.relaxExcluded'));
    default:
      return confused();
  }
}

// What happens with a typed message:
//   1. "start over", and follow-ups that change the last search
//   2. otherwise read it for moods, must-haves, area, price and station
//   3. nothing understood: a skip answer ("anywhere", "no"), just "café"
//      (ask what kind), or a kind "pardon?"
//   4. two or more things understood: answer straight away
//      one thing: note it and ask the next question
function handleText(text) {
  const words = tidy(text);
  const hasSearch = convo.ranked !== null;

  if (said(words, FOLLOW_UPS.restart)) return startOver();
  if (said(words, FOLLOW_UPS.surprise)) return surprise();
  if (hasSearch) {
    if (said(words, FOLLOW_UPS.cheaper)) return makeCheaper();
    if (said(words, FOLLOW_UPS.elsewhere)) return showElsewhere();
    if (said(words, FOLLOW_UPS.closer)) return goCloser();
  }

  const found = parse(words);

  if (found.count === 0) {
    if (hasSearch && said(words, FOLLOW_UPS.more)) return showMore();
    const skipped = answerWithSkipWord(words);
    if (skipped) return skipped;
    if (convo.step === 'mood' && said(words, CAFE_WORDS)) return ask('mood', say('leadIn'));
    return confused();
  }

  // After results, a message that says two or more things is a new search,
  // not a change to the old one ("romantic garden cafe" after "quiet in Ari").
  if (convo.step === 'results' && found.count >= 2) startFresh();
  const wasResults = convo.step === 'results';
  applyFound(found);

  if (found.count >= 2) return showResults();
  if (wasResults) return showResults(`${ackLine(found)} ${say('results')}`);
  return continueFlow(ackLine(found));
}

// "anywhere" for the area, "no" for must-haves, "any" for budget...
// Returns the next reply, or null if the words weren't a skip answer.
function answerWithSkipWord(words) {
  if (convo.step === 'area' && said(words, SKIP_WORDS.area)) {
    convo.prefs.zone = 'Anywhere';
    convo.answered.add('area');
    return continueFlow(say('leadIn'));
  }
  if (convo.step === 'features' && said(words, SKIP_WORDS.features)) {
    convo.answered.add('features');
    return continueFlow();
  }
  if (convo.step === 'budget') {
    if (said(words, SKIP_WORDS.midBudget)) convo.prefs.maxPrice = 2;
    else if (said(words, SKIP_WORDS.budget)) convo.prefs.maxPrice = 3;
    else return null;
    convo.answered.add('budget');
    return continueFlow();
  }
  return null;
}

function confused() {
  const atQuestion = ['area', 'features', 'budget'].includes(convo.step);
  if (atQuestion) {
    return barista(`<p>${escapeHtml(`${say('confused')} ${t('chat.tapOne')}`)}</p>`, chipsFor(convo.step));
  }
  return barista(`<p>${escapeHtml(`${say('confused')} ${say('confusedHint')}`)}</p>`, moodChips());
}


/* ---------- 7. Asking questions and showing cafés ---------- */

function greet() {
  const last = copyPrefs(options.cleanPrefs(load('chatPrefs', null)));
  if (hasAnyPrefs(last)) {
    lastSession = last;
    const chips = [{ label: () => t('chat.chipResume'), action: 'resume' }, ...moodChips()];
    return barista(`<p>${escapeHtml(say('welcomeBack'))}</p>`, chips);
  }
  return barista(`<p>${escapeHtml(say('greet'))}</p>`, moodChips());
}

function startOver() {
  startFresh();
  return barista(`<p>${escapeHtml(say('restart'))}</p>`, moodChips());
}

// Ask the first question that hasn't been answered yet, or show cafés
// when there's nothing left to ask. `lead` is a short "Nice." or "Got it: ..." first.
function continueFlow(lead = '') {
  const p = convo.prefs;
  if (p.moods.length === 0) return ask('mood', lead);
  if (p.zone === 'Anywhere' && !convo.answered.has('area')) return ask('area', lead);
  if (!convo.answered.has('features')) return ask('features', lead);
  if (p.maxPrice === 3 && !convo.answered.has('budget')) return ask('budget', lead);
  return showResults();
}

function ask(step, lead = '') {
  convo.step = step;
  const questions = {
    mood: 'askMood',
    area: 'askArea',
    features: convo.prefs.features.length > 0 ? 'askMoreFeatures' : 'askFeatures',
    budget: 'askBudget',
  };
  const text = `${lead} ${say(questions[step])}`.trim();
  return barista(`<p>${escapeHtml(text)}</p>`, chipsFor(step));
}

function chipsFor(step) {
  if (step === 'area') return areaChips();
  if (step === 'features') return featureChips();
  if (step === 'budget') return budgetChips();
  if (step === 'results') return resultChips();
  return moodChips();
}

// Rank every café for these prefs: the finder's filters first, then
// scoreCafe, best first (ties A to Z), leaving out "somewhere else" ones.
// (One shared collator for A to Z, like app.js: much quicker than localeCompare with options.)
const nameOrder = new Intl.Collator('en', { sensitivity: 'base' });

function rank(prefs) {
  return options.cafes
    .filter((cafe) => options.passesFilters(cafe, prefs) && !convo.excluded.has(cafe.id))
    .filter((cafe) => hasSomethingAskedFor(cafe, prefs))
    .map((cafe) => {
      const { score = 0, reasons = [] } = scoreCafe(cafe, prefs) || {};
      return { cafe, score, reasons };
    })
    .sort((a, b) => b.score - a.score || nameOrder.compare(a.cafe.name, b.cafe.name));
}

// The finder lists every café that passes the filters, best first. The
// barista is pickier: it only suggests cafés with at least one of the moods
// or must-haves you asked for. (Must-haves are already required by
// passesFilters; this matters when you only asked for moods. scoreCafe gives
// a few points for being near a station, but that alone isn't a reason to
// recommend a café.)
function hasSomethingAskedFor(cafe, prefs) {
  if (prefs.moods.length === 0 && prefs.features.length === 0) return true;
  return prefs.moods.some((mood) => cafe.moods.includes(mood))
    || prefs.features.some((feature) => cafe.features.includes(feature));
}

// For a search with no results: the must-haves worth dropping, as
// [{ key, count }] with the most cafés first. Empty when the must-haves
// aren't the problem (none were asked for, or nothing fits even without them).
function mustHaveFixes(prefs) {
  const features = prefs.features;
  if (features.length === 0) return [];
  if (rank({ ...prefs, features: [] }).length === 0) return [];

  // Drop each must-have on its own and count the cafés that come back
  const fixes = features
    .map((key) => ({ key, count: rank({ ...prefs, features: features.filter((other) => other !== key) }).length }))
    .filter((fix) => fix.count > 0)
    .sort((a, b) => b.count - a.count);

  // Dropping just one doesn't help (three or more asked for): offer them all
  return fixes.length > 0 ? fixes : features.map((key) => ({ key, count: 0 }));
}

// What the barista says when nothing fits. When the must-haves are the reason,
// it names them: "No café in Ari & Phaya Thai has Rooftop. Want me to drop it?"
function noneLine(fixes) {
  if (fixes.length === 0) return `${say('none')} ${t('chat.dropSomething')}`;
  const p = convo.prefs;
  const names = p.features.map(featureLabel).join(' + ');
  const where = p.zone === 'Anywhere' ? '' : t('chat.in', { zone: p.zone });
  let what = t('chat.dropOne');
  if (p.features.length === 1) what = t('chat.dropIt');
  else if (fixes[0].count === 0) what = t('chat.dropCouple');
  return t('chat.noneHas', { where, names, what });
}

async function showResults(intro = say('results')) {
  convo.step = 'results';
  convo.ranked = rank(convo.prefs);
  convo.shownCount = 0;
  save('chatPrefs', convo.prefs); // so next visit can "pick up where we left off"
  searches.push(copyPrefs(convo.prefs));
  const searchIndex = searches.length - 1;

  if (convo.ranked.length === 0) {
    const fixes = mustHaveFixes(convo.prefs);
    // "Here's what I'd pour for you." makes no sense before "no café has...",
    // so the default results line is left out (lines like "Cheaper it is." stay)
    const lead = lines('chat.results').includes(intro) ? '' : `${intro} `;
    // Nothing of ours fits, but a chain nearby might do. Its chip goes after
    // the "Without …" chips (those are the main way out), before "Start over".
    const chains = await chainsHtml(convo.prefs);
    const chips = relaxChips(fixes);
    if (chains) chips.splice(chips.length - 1, 0, { label: () => t('chat.chipChains'), action: 'chains' });
    return barista(
      `<p>${escapeHtml(lead + noneLine(fixes))}</p>${orderHtml(convo.prefs)}${chains}`,
      chips,
    );
  }

  const first = convo.ranked.slice(0, RESULTS_PER_PAGE);
  convo.shownCount = first.length;
  const outro = convo.ranked.length < RESULTS_PER_PAGE ? `<p>${escapeHtml(say('fewResults'))}</p>` : '';
  const chains = await chainsHtml(convo.prefs);
  const chips = chains ? [{ label: () => t('chat.chipChains'), action: 'chains' }, ...resultChips()] : resultChips();
  return barista(
    `<p>${escapeHtml(intro)}</p>${orderHtml(convo.prefs)}${miniCardsHtml(first, searchIndex)}${outro}${chains}`,
    chips,
  );
}

// "There are also 23 chain cafés nearby, like Starbucks and Café Amazon.
// Want to see them?" Chains come from OpenStreetMap (js/osm.js) and pass the
// same area, station and open-now filters. Moods and must-haves can't apply
// to them, so they're only mentioned, never mixed into the picks.
// Returns '' when there are none, or if the extra cafés couldn't load.
async function chainsHtml(prefs) {
  try {
    const { count, brands } = await options.countChains(prefs);
    if (count === 0) return '';
    let key = prefs.zone === 'Anywhere' ? 'chat.chainsAll' : 'chat.chainsNear';
    if (count === 1) key = 'chat.chainsOne';
    const names = brands.map(inEnglish).join(escapeHtml(t('chat.and')));
    return `<p>${tHtml(key, { n: escapeHtml(num(count)), brands: names })}</p>`;
  } catch {
    return ''; // offline, say: the barista just doesn't mention them
  }
}

function showMore() {
  const next = convo.ranked.slice(convo.shownCount, convo.shownCount + RESULTS_PER_PAGE);
  if (next.length === 0) return barista(`<p>${escapeHtml(say('noMore'))}</p>`, relaxChips());
  convo.shownCount += next.length;
  return barista(`<p>${escapeHtml(say('more'))}</p>${miniCardsHtml(next, searches.length - 1)}`, resultChips());
}

// A random café from the current top 10 (or from every café, if there's
// been no search yet)
function surprise() {
  const pool = convo.ranked && convo.ranked.length > 0 ? convo.ranked.slice(0, 10) : rank(emptyPrefs());
  const choice = pool[Math.floor(Math.random() * pool.length)];
  if (!convo.ranked) searches.push(emptyPrefs());
  return barista(`<p>${escapeHtml(say('surprise'))}</p>${miniCardsHtml([choice], searches.length - 1)}`, resultChips());
}

// "Something cheaper": go one ฿ below the priciest café just shown.
// (Lowering from "any price" to ฿฿ wouldn't help if they were all ฿฿ already.)
function makeCheaper() {
  const shown = convo.ranked.slice(0, Math.max(convo.shownCount, 1));
  const priciest = shown.length > 0 ? Math.max(...shown.map((result) => result.cafe.price)) : convo.prefs.maxPrice;
  const newMax = Math.min(priciest, convo.prefs.maxPrice) - 1;
  if (newMax < 1) return barista(`<p>${escapeHtml(say('cheapest'))}</p>`, resultChips());

  convo.prefs.maxPrice = newMax;
  convo.answered.add('budget');
  return showResults(say('cheaper'));
}

// "Somewhere else": leave out everything shown so far and rank again
function showElsewhere() {
  convo.ranked.slice(0, convo.shownCount).forEach((result) => convo.excluded.add(result.cafe.id));
  return showResults(say('elsewhere'));
}

function goCloser() {
  convo.prefs.nearStation = true;
  return showResults(say('closer'));
}

// "Use these in the finder": close the chat and let app.js copy the prefs
// into the finder. Focus goes to the results there, not back to the button.
function useInFinder() {
  returnFocusOnClose = false;
  panel.close();
  options.useInFinder(copyPrefs(convo.prefs));
}


// "Show chain cafés": like "Use these in the finder", with "Include chains" on
function showChains() {
  returnFocusOnClose = false;
  panel.close();
  options.showChains(copyPrefs(convo.prefs));
}


/* ---------- 8. Reading typed messages (the keyword parser) ---------- */

// Lower-case, strip accents ("Café" -> "cafe"), straighten curly quotes
// and squash spaces, so the word lists only need one spelling.
// (Thai letters and their marks aren't touched.)
function tidy(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Turn a word into a regular expression that matches it as plain text
// (so "-" in "wi-fi" or "/" can't be read as regex symbols)
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Is `phrase` in `text` as whole words? ("art" shouldn't match "start".)
function hasWord(text, phrase) {
  return new RegExp(`\\b${escapeRegex(phrase)}\\b`).test(text);
}

// Does the message say one of these? `entry` is { english: /regex/, thai: [...] }
// (the follow-ups, skip words and café words above)
function said(text, entry) {
  return entry.english.test(text) || entry.thai.some((word) => text.includes(word));
}

// Does the message mention this rule? English as whole words, Thai anywhere.
function mentions(text, rule) {
  return rule.words.some((word) => hasWord(text, word))
    || (rule.thai || []).some((word) => text.includes(word));
}

// If one of the rule's words comes right after a negative ("no rooftop",
// "not too crowded", "ไม่เอาดาดฟ้า"), return that whole bit of text, otherwise null.
function findNegated(text, rule) {
  for (const word of rule.words) {
    const match = text.match(new RegExp(`${NEGATION}${escapeRegex(word)}\\b`));
    if (match) return match[0];
  }
  for (const word of rule.thai || []) {
    const match = text.match(new RegExp(`${THAI_NEGATION}${escapeRegex(word)}`));
    if (match) return match[0];
  }
  return null;
}

// Add one rule's meaning to what's been found so far
function addMeaning(found, rule) {
  found.count += 1;
  for (const mood of rule.moods || []) {
    if (!found.moods.includes(mood)) found.moods.push(mood);
  }
  for (const feature of rule.features || []) {
    if (!found.features.includes(feature)) found.features.push(feature);
  }
  if (rule.maxPrice) found.maxPrice = rule.maxPrice;
  if (rule.nearStation) found.nearStation = true;
  if (rule.openNow) found.openNow = true;
}

// Turn a tidied message into what it asks for. `count` is how many
// different things were understood ("romantic date" is one thing, "date
// in Ari" is two), which decides whether the barista can answer straight away.
//
// Negatives are read first and then cut out of the text, so "no rooftop"
// can't also count as asking for a rooftop:
//   1. "not too crowded", "not expensive": a negative that means a positive
//   2. "no rooftop", "not romantic": take that mood or must-have away
//   3. everything else, as usual
function parse(message) {
  const found = {
    moods: [], features: [], zone: null, maxPrice: null,
    nearStation: null,              // true, false ("not near BTS") or null (not mentioned)
    openNow: null,                  // true ("open now"), false ("doesn't have to be open now") or null
    notMoods: [], notFeatures: [],  // things to take away
    notZone: null,                  // "not in Ari"
    count: 0,
  };
  let words = message;

  for (const rule of NEGATED_MEANINGS) {
    const negated = findNegated(words, rule);
    if (!negated) continue;
    words = words.replace(negated, ' ');
    addMeaning(found, rule);
  }

  for (const rule of WORD_RULES) {
    const negated = findNegated(words, rule);
    if (!negated) continue;
    words = words.replace(negated, ' ');
    found.count += 1;
    found.notMoods.push(...(rule.moods || []));
    found.notFeatures.push(...(rule.features || []));
    if (rule.maxPrice) found.maxPrice = 3;           // "not cheap": any price will do
    if (rule.nearStation) found.nearStation = false; // "not near BTS": station or not
    if (rule.openNow) found.openNow = false;         // "not right now": any time
  }

  for (const rule of ZONE_RULES) {
    const negated = findNegated(words, rule);
    if (!negated) continue;
    words = words.replace(negated, ' ');
    found.count += 1;
    found.notZone = rule.zone;
  }

  for (const rule of WORD_RULES) {
    if (mentions(words, rule)) addMeaning(found, rule);
  }

  const zoneRule = ZONE_RULES.find((rule) => mentions(words, rule));
  if (zoneRule) {
    found.zone = zoneRule.zone;
    found.count += 1;
  }
  return found;
}

// Change the conversation's prefs: take away the negatives, add the rest
function applyFound(found) {
  const p = convo.prefs;
  p.moods = p.moods.filter((mood) => !found.notMoods.includes(mood));
  p.features = p.features.filter((feature) => !found.notFeatures.includes(feature));

  for (const mood of found.moods) {
    if (!p.moods.includes(mood)) p.moods.push(mood);
  }
  for (const feature of found.features) {
    if (!p.features.includes(feature)) p.features.push(feature);
  }
  if (found.notZone && p.zone === found.notZone) p.zone = 'Anywhere';
  if (found.zone) {
    p.zone = found.zone;
    convo.answered.add('area');
  }
  if (found.maxPrice) {
    p.maxPrice = found.maxPrice;
    convo.answered.add('budget');
  }
  if (found.nearStation !== null) p.nearStation = found.nearStation;
  if (found.openNow !== null) p.openNow = found.openNow;
}

// "Got it: date spot, no rooftop." The barista repeats what it understood.
function ackLine(found) {
  // English labels start lower-case mid-sentence ("date spot"); Thai has no capitals
  const inSentence = (text) => (getLang() === 'en' ? text.charAt(0).toLowerCase() + text.slice(1) : text);
  const mood = (key) => inSentence(moodLabel(key));
  const feature = (key) => inSentence(featureLabel(key));
  const items = [
    ...found.moods.map(mood),
    ...found.features.map(feature),
    ...found.notMoods.map((key) => t('chat.ackNo', { x: mood(key) })),
    ...found.notFeatures.map((key) => t('chat.ackNo', { x: feature(key) })),
  ];
  if (found.zone) items.push(found.zone);
  if (found.notZone) items.push(t('chat.ackNotZone', { zone: found.notZone }));
  if (found.maxPrice === 3) items.push(t('chat.ackAnyPrice'));
  else if (found.maxPrice) items.push(t('chat.upTo', { price: '฿'.repeat(found.maxPrice) }));
  if (found.nearStation === true) items.push(t('chat.ackNearStation'));
  if (found.nearStation === false) items.push(t('chat.ackStationOrNot'));
  if (found.openNow === true) items.push(t('chat.openNow'));
  if (found.openNow === false) items.push(t('chat.ackAnyTime'));

  const hasNegative = found.notMoods.length > 0 || found.notFeatures.length > 0
    || found.notZone !== null || found.nearStation === false || found.maxPrice === 3
    || found.openNow === false;
  const list = items.join(', ');
  return say(hasNegative ? 'ackNegative' : 'ack')
    .replace('{x}', list)
    .replace('{X}', list.charAt(0).toUpperCase() + list.slice(1));
}
