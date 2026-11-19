// i18n.js: every word of the interface, in English and Thai ("i18n" is
// short for "internationalisation": i, then 18 letters, then n).
//
// How it works:
//   - Words in index.html are marked with data-i18n="key" (the text),
//     data-i18n-html="key" (text with a little markup, like <em>) or
//     data-i18n-attr="aria-label:key" (an attribute). translatePage() fills
//     them in. The English in index.html is only there for people without
//     JavaScript: the words themselves live here.
//   - JavaScript files ask for words with t('key'), or t('key', { n: 3 })
//     when there's a number or name to put in ({n} in the text).
//   - A value can also be a small function, for English plurals
//     ("1 café", "2 cafés"). Thai doesn't change the noun, so it's simpler.
//   - Mood, feature and price labels in English come from meta in
//     cafes.json (one place for them). Their Thai versions are here, with
//     keys like 'mood.date', matching the keys in cafes.json.
//   - Café names, descriptions, areas, zones and stations stay in English:
//     they're the data, not the interface.
//
// The choice is saved in localStorage ("kafe-bangkok:lang"). A first-time
// visitor whose browser is set to Thai gets Thai.

import { save } from './store.js';

export const LANGUAGES = ['en', 'th'];
const THAI_FONT = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400..800&display=swap';

// English plurals: "1 café", "4 cafés"
const cafes = (n) => `${num(n)} ${Number(n) === 1 ? 'café' : 'cafés'}`;

// Big numbers with a comma: 2047 -> "2,047" (Thai writes numbers the same way)
export const num = (n) => Number(n).toLocaleString('en-US');

const en = {
  'page.title': 'Kafé Bangkok · find a café that fits your mood',
  skip: 'Skip to content',

  // Top bar
  'nav.label': 'Main',
  'nav.menu': 'Menu',
  'nav.savedBadge': ' saved',
  'nav.find': 'Find a café',
  'nav.areas': 'Neighbourhoods',
  'nav.barista': 'Ask the barista',
  'nav.saved': 'Saved',
  'nav.savedCount': ' cafés',
  'nav.suggest': 'Suggest a café',
  'lang.label': 'Language',

  // Hero
  'hero.pillMore': ' · Café finder',
  'hero.timeIn': 'Time in Bangkok:',
  'hero.city': 'Bangkok',
  'hero.title': 'Find your Bangkok café, <em>today</em>.',
  'hero.cups': 'Two Kafé Bangkok cups: an iced coffee with a straw, and a navy hot cup with a lid',
  'hero.lead': "Pick a mood and a part of town, and we'll match you with a café: a garden in Ari, a quiet desk in Thonglor, a seat by the river in Thonburi.",
  'hero.find': 'Find my café',
  'hero.ask': 'Ask the barista',
  'hero.openLate': 'Open late right now',
  'hero.summary': ({ n, zones }) => `${n} cafés across ${zones} neighbourhoods`,
  'greet.morning': "Good morning. Here's where to get your first cup.",
  'greet.afternoon': 'Good afternoon. Time for a slow cup somewhere shady.',
  'greet.evening': 'Good evening. Somewhere calm to wind down?',
  'greet.night': 'Still up? These cafés stay open late.',

  // Café of the day
  'today.heading': 'Café of the day',
  'today.details': 'See details',

  // Finder
  'finder.label': '01 / Find',
  'finder.title': 'Find a café',
  'finder.intro': 'Pick a mood, add a must-have or two, and choose a part of town. The best matches come first.',
  'finder.form': 'Café filters',
  'finder.moodLegend': 'What are you in the mood for?',
  'finder.moodHint': 'Pick as many as you like.',
  'finder.mustLegend': 'Must-haves',
  'finder.mustHint': "Tick anything you'd really miss. We'll only show cafés with all of them.",
  'finder.area': 'Area',
  'finder.anywhere': 'Anywhere',
  'finder.line': 'Line',
  'finder.anyLine': 'Any line',
  'finder.maxPrice': 'Max price',
  'finder.upTo': 'Up to {label}',
  'finder.gettingThere': 'Getting there',
  'finder.nearStation': 'Near BTS/MRT',
  'finder.hours': 'Opening hours',
  'finder.openNow': 'Open now',
  'finder.openNowHint': 'Bangkok time. Cafés with unknown hours are hidden.',
  'finder.search': 'Search',
  'finder.searchPlaceholder': 'Café name or area',
  'finder.copyLink': 'Copy link',
  'finder.copied': 'Copied',
  'finder.copiedStatus': 'Link copied. Send it to a friend.',
  'finder.copyFailed': "Your browser wouldn't let me copy it. You can copy the address bar instead.",
  'finder.clearAll': 'Clear all',
  'finder.loadError': "Sorry, the café list didn't load. Please refresh the page.",

  // Results
  'results.view': 'Show results as',
  'results.list': 'List',
  'results.map': 'Map',
  'results.surprise': 'Surprise me',
  'results.sortBy': 'Sort by',
  'results.sortBest': 'Best match',
  'results.sortPrice': 'Price, low to high',
  'results.sortName': 'Name, A to Z',
  'results.label': 'Café results',
  'results.showMore': 'Show more cafés',
  'results.showingOf': 'Showing {shown} of {total} cafés',
  'results.showing': ({ n }) => `Showing ${cafes(n)}`,
  cafes: ({ n }) => cafes(n),

  // Empty state
  'empty.title': 'No café fits all of that',
  'empty.text': 'Try another area, a higher price or a shorter search, or switch off “Near BTS/MRT”.',
  'empty.clear': 'Clear filters',
  'empty.tipArea': 'another area',
  'empty.tipLine': 'any line',
  'empty.tipPrice': 'a higher price',
  'empty.tipSearch': 'a shorter search',
  'empty.tipStation': 'switching off “Near BTS/MRT”',
  'empty.tipOpen': 'switching off “Open now”',
  'empty.tipClear': 'Try clearing the filters.',
  'empty.try': 'Try {list}.',
  'empty.mustTitle': 'No cafés{where} match {names}',
  'empty.in': ' in {zone}',
  'empty.dropCouple': 'Try removing a couple of them.',
  'empty.dropOne': 'Try removing {name}. That brings back {count}.',
  'empty.dropChoice': 'Try removing one: {list}.',
  'empty.choice': '{name} ({count})',
  or: 'or',

  // Café cards
  'card.checkMap': 'Check map',
  'card.price': 'Price: {word}',
  'card.match': '{n}% match',
  'card.why': 'Why it fits: ',
  'card.openLate': 'Open late',
  'card.tags': 'Tags',
  'card.checked': 'Checked',
  'card.checkedHidden': ': still open, details confirmed',
  'card.save': 'Save',
  'card.visited': 'Been there',
  'card.compare': 'Compare',

  // Opening hours
  'hours.open': 'Open now',
  'hours.open24': 'Open 24 hours',
  'hours.closed': 'Closed',
  'hours.unknown': 'Hours unknown',
  'hours.closes': 'Closes {time}',
  'hours.closesMidnight': 'Closes midnight',
  'hours.opens': 'Opens {time}',
  'hours.opensTomorrow': 'Opens tomorrow {time}',
  'hours.opensDay': 'Opens {day} {time}',
  'day.mon': 'Mon', 'day.tue': 'Tue', 'day.wed': 'Wed', 'day.thu': 'Thu', 'day.fri': 'Fri', 'day.sat': 'Sat', 'day.sun': 'Sun',

  // Drawer
  'drawer.close': 'Close',
  'drawer.lines': ({ lines, n }) => `(${lines} line${n > 1 ? 's' : ''})`,
  'drawer.and': ' and ',
  'drawer.noStation': 'None listed, check the map',
  'drawer.noHours': 'Not listed — check Google Maps',
  'drawer.noMatch': "It doesn't match what you picked in the finder, but it might still be worth a look.",
  'drawer.noPicks': "Pick a mood or a must-have in the finder and we'll note why this café fits.",
  'drawer.has': 'Has',
  'drawer.why': 'Why it fits',
  'drawer.details': 'Details',
  'drawer.station': 'Station',
  'drawer.price': 'Price',
  'drawer.hours': 'Hours',
  'drawer.tags': 'Tags',
  'drawer.goodFor': 'Good for',
  'drawer.sources': 'Sources',
  'drawer.maps': 'Open in Google Maps',
  newTab: ' (opens in a new tab)',

  // Map
  'map.label': 'Map of the cafés in your results',
  'map.loading': 'Loading the map…',
  'map.failed': "The map couldn't load. Check your connection and try again, or use the list.",
  'map.missing': ({ n }) => (n === 1
    ? "1 café in your results doesn't have a known location, so it isn't on the map."
    : `${n} cafés in your results don't have a known location, so they aren't on the map.`),
  'map.cluster': '{n} cafés here. Zoom in to see them.',
  'map.details': 'Details',
  'map.zoomIn': 'Zoom in',
  'map.zoomOut': 'Zoom out',
  'map.osmCredit': 'Café locations © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors (ODbL)',
  'map.legend': 'Map key',
  'map.legendPicked': ({ n }) => `Hand-picked (${num(n)})`,
  'map.legendLocal': ({ n }) => `Local cafés (${num(n)})`,
  'map.legendChain': ({ n }) => `Chains (${num(n)})`,
  'map.legendChainOff': 'Chains hidden (switch on “Include chains” below the map)',

  // More cafés (from OpenStreetMap, js/osm.js), under the results. The
  // OpenStreetMap credit is in the footer and the map's corner only.
  'more.titleIdle': 'More cafés nearby',
  'more.title': ({ n }) => `Also nearby: ${num(n)} more ${n === 1 ? 'café' : 'cafés'}`,
  'more.note': "Moods, must-haves and price can't apply to these, as we haven't tagged them. Area, line, near BTS/MRT, open now and search do.",
  'more.show': 'Show more cafés nearby',
  'more.loading': 'Loading more cafés…',
  'more.failed': "The extra cafés couldn't load. Check your connection and try again.",
  'more.next': 'Show {n} more',
  'more.chains': 'Include chains (Starbucks, Amazon…)',
  'more.brand': 'Brand',
  'more.allChains': 'All chains',
  'more.empty': 'No more cafés nearby fit these filters.',
  'more.list': 'More cafés nearby',
  'osm.chainTag': 'Chain',
  'osm.brand': 'Brand: {name}',
  'osm.chainBrand': 'Chain: {name}',
  'osm.noStation': 'No BTS/MRT within 1 km',
  'osm.website': 'Website',
  'osm.facebook': 'Facebook',
  'osm.call': 'Call {name}',

  // Neighbourhoods
  'areas.label': '02 / Areas',
  'areas.title': 'Neighbourhoods',
  'areas.intro': 'Every part of town has its own café habits. Pick one to see its cafés.',
  'areas.show': 'Show cafés in ',
  'areas.mostly': 'Mostly:',

  // Crawl planner
  'crawl.label': '03 / Crawl',
  'crawl.title': 'Plan a café crawl',
  'crawl.intro': "Pick where to start and a mood. We'll line up two to four cafés close to each other, in the order with the least walking.",
  'crawl.form': 'Plan a café crawl',
  'crawl.mood': 'Mood',
  'crawl.moodHint': 'Every stop will have this one.',
  'crawl.start': 'Start from',
  'crawl.zones': 'Neighbourhoods',
  'crawl.stations': 'BTS/MRT stations',
  'crawl.stops': 'Stops',
  'crawl.plan': 'Plan my crawl',
  'crawl.stopsLabel': 'Stops, in order',
  'crawl.openRoute': 'Open route in Google Maps',
  'crawl.mapLabel': 'Map of your café crawl',
  'crawl.metres': '{n} m',
  'crawl.km': '{n} km',
  'crawl.titleStation': 'Your crawl from {name}',
  'crawl.titleZone': 'Your crawl around {name}',
  'crawl.meta': '{n} stops · {mood} · {distance} in all',
  'crawl.noteStraight': 'Distances are straight lines, so the walk is a little longer.',
  'crawl.noteFew': 'There are only {n} {mood} cafés on the map, so this crawl has {n} stops.',
  'crawl.noteFar': 'Some stops are more than 2 km apart, so a taxi or the BTS may be quicker between those.',
  'crawl.notEnough': 'Not enough {mood} cafés for a crawl',
  'crawl.tryMood': 'Try another mood.',
  'crawl.firstStop': 'First stop',
  'crawl.legFromStart': '{distance} from {name}',
  'crawl.legFromStop': '{distance} from stop {i}',
  'crawl.swap': 'Swap',
  'crawl.nearby': 'Nearby instead',
  'crawl.noSwap': 'No other {mood} cafés to swap in.',
  'crawl.away': '{area} · {distance} away',
  'crawl.swapped': 'Stop {i} is now {name}. {distance} in all.',
  'crawl.start.label': 'Start: {name}',
  'crawl.mapFailed': "The map couldn't load. The list and the Google Maps link still work.",

  // Saved and the passport
  'saved.label': '04 / Saved',
  'saved.title': 'Saved',
  'saved.intro': 'Cafés you heart will wait for you here.',
  'saved.summary': ({ n, visited }) => `${cafes(n)} saved, ${visited} of them visited.`,
  'saved.list': 'Saved cafés',
  'saved.emptyTitle': 'Nothing saved yet',
  'saved.emptyText': "Tap the heart on any café and it'll wait for you here, on this device.",
  'saved.emptyButton': 'Find a café',
  'passport.title': 'Café passport',
  'passport.none': "You haven't visited any of the {total} cafés yet.",
  'passport.some': "You've visited {n} of {total} cafés.",
  'passport.stamps': 'Neighbourhood stamps',
  'passport.first': 'Press "Been there" on a café to get your first stamp.',
  'passport.stamped': '{n} of {total} neighbourhoods stamped.',

  // Stats
  'stats.label': '05 / Stats',
  'stats.title': 'Café stats',
  'stats.intro': 'The list in numbers. Every figure is counted straight from the café data.',
  'stats.perArea': 'Cafés per area',
  'stats.moods': 'Most common moods',
  'stats.moodsNote': 'A café can have more than one mood, so these add up to more than {total}.',
  'stats.price': 'Price spread',
  'stats.late': 'Open late',
  'stats.lateText': 'Cafés tagged “Open late / 24h”: open until 22:00 or later most days, or all night.',
  'stats.hours': 'Known opening hours',
  'stats.hoursText': 'Cafés with full opening hours, so we can say whether they’re open right now. The rest show “Hours unknown”.',
  'stats.of': 'of {total}',
  'stats.allTitle': 'Every café on the site',
  'stats.allUnit': 'cafés',
  'stats.allText': ({ picked, kept, checked }) => `Our ${num(picked)} hand-picked cafés, plus ${num(kept)} more that we can trust are still open (of the ${num(checked)} cafés in Bangkok on OpenStreetMap).`,
  'stats.reliableNote': 'The extra cafés show only if they have a real name, were updated since 2022, and have at least two signs that someone has checked them: opening hours, a website, a phone number, a street address, a recent survey, or being a chain branch.',
  'stats.mix': 'Hand-picked, local and chain',
  'stats.handPicked': 'Hand-picked',
  'stats.local': 'Local cafés',
  'stats.chain': 'Chain cafés',
  'stats.topChains': 'Top 10 chains, by branches',
  'stats.chainsNote': 'Chains are the big coffee brands, plus any brand with 5 or more cafés in Bangkok. The bars count the branches we show, as of {date}.',
  'stats.osmLoading': 'Counting every café…',
  'stats.osmFailed': "The numbers for the extra cafés couldn't load. Check your connection and reload the page.",

  // How it works
  'how.label': '06 / How it works',
  'how.title': 'How it works',
  'how.intro': 'Three small steps, and the list sorts itself.',
  'how.step1Title': 'Pick your mood',
  'how.step1Text': 'A date, a quiet desk, a garden, somewhere pretty or somewhere cheap. Choose one, or a few.',
  'how.step2Title': 'Add your must-haves',
  'how.step2Text': "Good Wi-Fi, a river view, open late, room for the dog. You'll only see cafés that have every one you tick.",
  'how.step3Title': 'Get cafés ranked for you',
  'how.step3Text': 'Every café gets a match score from your picks, with a short note on why it fits.',
  'how.note1': 'Must-haves are strict: a café without one of yours isn\'t shown. The rest are ranked by a custom match score. Your moods count the most, and being near a BTS or MRT station adds a little. A café that ticks every box gets close to 100%.',
  'how.note2': 'Ask the barista is a chat built from simple word rules. It runs fully in your browser, with no AI service and no account, and your saved cafés stay on this device too.',

  // Suggest a café
  'suggest.label': '07 / Suggest',
  'suggest.title': 'Suggest a café',
  'suggest.intro': "Know a Bangkok café that should be on the list? Tell us about it. Every suggestion is checked on Google Maps before it's added.",
  'suggest.name': 'Café name',
  'suggest.area': 'Area',
  'suggest.areaPlaceholder': 'For example Ari or Thonglor',
  'suggest.maps': 'Google Maps link',
  'suggest.mapsHint': 'In Google Maps, open the café, tap Share, then Copy link.',
  'suggest.why': 'Why you like it',
  'suggest.goodFor': 'Good for',
  'suggest.goodForHint': 'Tick any that fit.',
  'suggest.email': 'Email',
  'suggest.optional': '(optional)',
  'suggest.emailHint': "Only if you'd like to hear when it's added.",
  'suggest.send': 'Send suggestion',
  'suggest.sending': 'Sending…',
  'suggest.failed': "Sorry, your suggestion didn't send. Check your connection and try again.",
  'suggest.errName': "Tell us the café's name.",
  'suggest.errArea': 'Which part of Bangkok is it in?',
  'suggest.errMaps': "Paste the café's Google Maps link.",
  'suggest.errMapsWrong': "That doesn't look like a Google Maps link. In Google Maps, tap Share, then Copy link.",
  'suggest.errWhy': 'Tell us what you like about it, even in a few words.',
  'suggest.errMoods': 'Tick at least one mood.',
  'suggest.errEmail': "That email address doesn't look right. You can also leave it empty.",
  'suggest.thanksTitle': 'Thank you!',
  'suggest.thanksBefore': "We've got your suggestion for ",
  'suggest.thanksAfter': ". We'll check it on Google Maps and add it to the list if it's a good fit.",
  'suggest.again': 'Suggest another café',

  // Footer
  'footer.byline': 'Kafé Bangkok · a project by Dilshan Gulati',
  'footer.portfolio': 'Portfolio',
  'footer.how': 'How it works',
  'footer.suggest': 'Suggest a café',
  'footer.data': "Café data compiled from public guides and cafés' own websites",
  'footer.locations': 'Café locations from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors and <a href="https://www.wongnai.com/">Wongnai</a> listings.',
  'footer.check': 'Cafés change often. Check Google Maps before you go.',
  'footer.osm': 'Café locations © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors (<a href="https://opendatacommons.org/licenses/odbl/">ODbL</a>)',

  // Compare
  'compare.label': 'Compare cafés',
  'compare.clear': 'Clear',
  'compare.button': 'Compare',
  'compare.title': 'Side by side',
  'compare.close': 'Close',
  'compare.hint': 'Swipe the table sideways to see every café.',
  'compare.table': 'Comparison table',
  'compare.remove': 'Remove {name} from compare',
  'compare.area': 'Area',
  'compare.station': 'Station',
  'compare.price': 'Price',
  'compare.moods': 'Moods',
  'compare.features': 'Features',
  'compare.hours': 'Hours',
  'compare.none': 'None listed',
  'compare.noHours': 'Not listed, check Google Maps',
  'compare.max': 'You can compare up to {max} cafés. Untick one first.',
  'compare.oneMore': 'Tick one more café to compare them side by side.',
  'compare.added': '{name} added to compare. {n} of {max}.',
  'compare.removed': '{name} removed from compare. {n} of {max}.',
  'compare.removedShort': '{name} removed from compare.',
  'compare.cleared': 'Compare cleared.',

  // Barista chat: the panel
  'chat.open': 'Ask the barista',
  'chat.title': 'Ask the barista',
  'chat.sub': "Tell me what you're after.",
  'chat.close': 'Close chat',
  'chat.log': 'Conversation',
  'chat.chips': 'Quick replies',
  'chat.inputLabel': 'Message the barista',
  'chat.placeholder': 'Try “quiet café in Ari”',
  'chat.send': 'Send',
  'chat.notLoaded': "The café list hasn't loaded, so the barista can't help yet. Please refresh the page.",
  'chat.baristaSays': 'The barista says:',
  'chat.youSaid': 'You said:',
  'chat.match': ' · {n}% match',
  'chat.save': 'Save {name}',
  'chat.order': 'Your order:',
  'chat.anywhere': 'anywhere',
  'chat.upTo': 'up to {price}',
  'chat.nearStation': 'near BTS/MRT',
  'chat.openNow': 'open now',
  'chat.chipAnywhere': 'Anywhere',
  'chat.chipDone': "No, that's all",
  'chat.chipAnyPrice': 'Any price',
  'chat.chipMore': 'Show me more',
  'chat.chipSurprise': 'Surprise me',
  'chat.chipRestart': 'Start over',
  'chat.chipFinder': 'Use these in the finder',
  'chat.chainsNear': 'There are also {n} chain cafés nearby, like {brands}. Want to see them?',
  'chat.chainsAll': 'There are also {n} chain cafés around Bangkok, like {brands}. Want to see them?',
  'chat.chainsOne': 'There’s also 1 chain café nearby: {brands}. Want to see it?',
  'chat.and': ' and ',
  'chat.chipChains': 'Show chain cafés',
  'chat.chipWithout': 'Without {name}',
  'chat.chipTryAnywhere': 'Try anywhere',
  'chat.chipStationOrNot': 'Station or not',
  'chat.chipAnyTime': 'Any time',
  'chat.chipEarlier': 'Show the earlier ones again',
  'chat.chipResume': 'Pick up where we left off',
  'chat.relaxZone': 'Anywhere in town, then.',
  'chat.relaxPrice': 'Any price, then.',
  'chat.relaxStation': 'Station or not, then.',
  'chat.relaxOpen': 'Any time, then.',
  'chat.relaxFeature': '{label}, then.',
  'chat.relaxExcluded': 'Back to the full list.',
  'chat.tapOne': 'Tap one of these, or say it another way.',
  'chat.dropSomething': 'Want me to drop something?',
  'chat.noneHas': 'No café{where} has {names}. Want me to drop {what}?',
  'chat.in': ' in {zone}',
  'chat.dropIt': 'it',
  'chat.dropOne': 'one',
  'chat.dropCouple': 'a couple',
  'chat.ackNo': 'no {x}',
  'chat.ackNotZone': 'not {zone}',
  'chat.ackAnyPrice': 'any price',
  'chat.ackNearStation': 'near a station',
  'chat.ackStationOrNot': 'station or not',
  'chat.ackAnyTime': 'any time',

  // Barista chat: a few ways to say each thing (one is picked at random)
  'chat.greet': [
    'Hi, welcome in. What kind of café are you after today?',
    "Hello! Kettle's on. What sort of café are we looking for today?",
    "Hi there. Tell me what kind of café you're in the mood for today.",
  ],
  'chat.welcomeBack': [
    'Welcome back! Want to pick up where we left off, or try something new?',
    'Good to see you again. Carry on from last time, or a fresh idea?',
  ],
  'chat.leadIn': ['Nice.', 'Lovely.', 'Good choice.', 'Got it.', 'Ooh, good one.'],
  'chat.askMood': ['What kind of café are you after?', 'What sort of café are you in the mood for?', 'What kind of place do you fancy?'],
  'chat.askArea': ['Any part of town?', 'Where in Bangkok?', 'Which area suits you?'],
  'chat.askFeatures': ["Anything you'd really miss if it wasn't there?", 'Any must-haves?', 'Anything it has to have?'],
  'chat.askMoreFeatures': ['Anything else?', 'Anything more, or is that it?', 'One more, or is that everything?'],
  'chat.askBudget': ['And how much do you want to spend?', "Last one: what's the budget?", 'And budget-wise?'],
  'chat.results': ["Here's what I'd pour for you.", 'These fit best.', 'My top picks for you.', 'Try these.'],
  'chat.fewResults': ["That's all that fits.", 'Only those fit all of that.'],
  'chat.more': ['A few more.', 'Here are the next ones.', 'Coming right up.'],
  'chat.noMore': ["That's everything on my list for that. Want to loosen something?", "You've seen them all. Shall we change something?"],
  'chat.none': ['Hmm, nothing on my list fits all of that.', "I couldn't find one that ticks every box.", 'No luck with all of that, sorry.'],
  'chat.surprise': ['Feeling lucky? Try this one.', 'My pick for today.', 'Close your eyes and point. This one.'],
  'chat.cheaper': ['Cheaper it is.', 'Lighter on the wallet, coming up.', 'Keeping it cheap.'],
  'chat.cheapest': ["That's already the cheapest end of my list.", "Can't go cheaper than ฿, I'm afraid."],
  'chat.elsewhere': ['Fair enough, some others.', 'No problem, different ones.', "Let's try a few others."],
  'chat.closer': ['Near a BTS or MRT station, then.', 'Easy to reach by train, then.', 'Close to the skytrain, then.'],
  'chat.confused': ["Sorry, I didn't catch that.", 'Hmm, that one went over my head.', "I'm only a barista, I'm afraid. That one lost me."],
  'chat.confusedHint': ['Try something like "quiet café in Ari", or tap a mood.', 'Tell me a mood or an area, like "garden café for a date".'],
  'chat.restart': ['Fresh cup. What kind of café are you after?', 'Clean slate. What are we looking for?'],
  'chat.resume': ["Right, where were we. Here's what I had for you.", 'Picking up from last time.'],
  'chat.ack': ['Got it: {x}.', 'Noted, {x}.', '{X}, lovely.'],
  // after a negative ("no rooftop"), "No rooftop, lovely." sounds odd
  'chat.ackNegative': ['Got it: {x}.', 'Noted, {x}.', 'Fair enough: {x}.'],
};

const th = {
  'page.title': 'Kafé Bangkok · หาคาเฟ่ที่ใช่สำหรับอารมณ์วันนี้',
  skip: 'ข้ามไปยังเนื้อหา',

  'nav.label': 'เมนูหลัก',
  'nav.menu': 'เมนู',
  'nav.savedBadge': ' ร้านที่บันทึกไว้',
  'nav.find': 'หาคาเฟ่',
  'nav.areas': 'ย่าน',
  'nav.barista': 'ถามบาริสต้า',
  'nav.saved': 'ที่บันทึกไว้',
  'nav.savedCount': ' ร้าน',
  'nav.suggest': 'แนะนำคาเฟ่',
  'lang.label': 'ภาษา',

  'hero.pillMore': ' · ค้นหาคาเฟ่',
  'hero.timeIn': 'เวลาในกรุงเทพฯ:',
  'hero.city': 'กรุงเทพฯ',
  // ⁠ is an invisible "word joiner": it stops the line breaking inside ที่ใช่ ("the right one")
  'hero.title': 'หาคาเฟ่กรุงเทพฯ ที่⁠ใช่สำหรับ<em>วันนี้</em>',
  'hero.cups': 'แก้วกาแฟ Kafé Bangkok สองใบ: กาแฟเย็นพร้อมหลอด และแก้วกาแฟร้อนสีกรมท่าพร้อมฝา',
  'hero.lead': 'เลือกบรรยากาศและย่านที่อยากไป แล้วเราจะจับคู่คาเฟ่ให้ ไม่ว่าจะเป็นสวนสวยในอารีย์ มุมนั่งทำงานเงียบ ๆ ในทองหล่อ หรือที่นั่งริมแม่น้ำฝั่งธนฯ',
  'hero.find': 'หาคาเฟ่ให้ฉัน',
  'hero.ask': 'ถามบาริสต้า',
  'hero.openLate': 'ร้านที่เปิดดึกตอนนี้',
  'hero.summary': ({ n, zones }) => `${n} คาเฟ่ใน ${zones} ย่าน`,
  'greet.morning': 'อรุณสวัสดิ์ ไปหากาแฟแก้วแรกของวันกัน',
  'greet.afternoon': 'สวัสดีตอนบ่าย ได้เวลาจิบกาแฟช้า ๆ ในมุมร่ม ๆ',
  'greet.evening': 'สวัสดีตอนเย็น หาที่สงบ ๆ ไว้พักผ่อนไหม?',
  'greet.night': 'ยังไม่นอนเหรอ คาเฟ่เหล่านี้เปิดถึงดึก',

  'today.heading': 'คาเฟ่ประจำวัน',
  'today.details': 'ดูรายละเอียด',

  'finder.label': '01 / ค้นหา',
  'finder.title': 'หาคาเฟ่',
  'finder.intro': 'เลือกบรรยากาศ เพิ่มสิ่งที่ต้องมีสักหนึ่งหรือสองอย่าง แล้วเลือกย่าน ร้านที่ตรงใจที่สุดจะขึ้นก่อน',
  'finder.form': 'ตัวกรองคาเฟ่',
  'finder.moodLegend': 'วันนี้อยากได้บรรยากาศแบบไหน?',
  'finder.moodHint': 'เลือกได้หลายอย่าง',
  'finder.mustLegend': 'สิ่งที่ต้องมี',
  'finder.mustHint': 'ติ๊กสิ่งที่ขาดไม่ได้ เราจะแสดงเฉพาะร้านที่มีครบทุกข้อ',
  'finder.area': 'ย่าน',
  'finder.anywhere': 'ทุกย่าน',
  'finder.line': 'สายรถไฟฟ้า',
  'finder.anyLine': 'ทุกสาย',
  'finder.maxPrice': 'ราคาสูงสุด',
  'finder.upTo': 'ไม่เกิน {label}',
  'finder.gettingThere': 'การเดินทาง',
  'finder.nearStation': 'ใกล้ BTS/MRT',
  'finder.hours': 'เวลาเปิด',
  'finder.openNow': 'เปิดอยู่ตอนนี้',
  'finder.openNowHint': 'ตามเวลากรุงเทพฯ ร้านที่ไม่ทราบเวลาเปิดจะถูกซ่อนไว้',
  'finder.search': 'ค้นหา',
  'finder.searchPlaceholder': 'ชื่อร้านหรือย่าน',
  'finder.copyLink': 'คัดลอกลิงก์',
  'finder.copied': 'คัดลอกแล้ว',
  'finder.copiedStatus': 'คัดลอกลิงก์แล้ว ส่งให้เพื่อนได้เลย',
  'finder.copyFailed': 'เบราว์เซอร์ไม่ยอมให้คัดลอก ลองคัดลอกจากแถบที่อยู่ด้านบนแทนนะ',
  'finder.clearAll': 'ล้างทั้งหมด',
  'finder.loadError': 'ขออภัย โหลดรายชื่อคาเฟ่ไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง',

  'results.view': 'แสดงผลแบบ',
  'results.list': 'รายการ',
  'results.map': 'แผนที่',
  'results.surprise': 'สุ่มให้หน่อย',
  'results.sortBy': 'เรียงตาม',
  'results.sortBest': 'ตรงใจที่สุด',
  'results.sortPrice': 'ราคา ต่ำไปสูง',
  'results.sortName': 'ชื่อ A ถึง Z',
  'results.label': 'ผลการค้นหาคาเฟ่',
  'results.showMore': 'ดูคาเฟ่เพิ่ม',
  'results.showingOf': 'แสดง {shown} จาก {total} ร้าน',
  'results.showing': ({ n }) => `แสดง ${n} ร้าน`,
  cafes: ({ n }) => `${num(n)} ร้าน`,

  'empty.title': 'ไม่มีคาเฟ่ที่ตรงกับทุกข้อ',
  'empty.text': 'ลองเปลี่ยนย่าน เพิ่มงบ หรือพิมพ์คำค้นให้สั้นลง หรือปิด “ใกล้ BTS/MRT”',
  'empty.clear': 'ล้างตัวกรอง',
  'empty.tipArea': 'เปลี่ยนย่าน',
  'empty.tipLine': 'เลือกทุกสาย',
  'empty.tipPrice': 'เพิ่มงบ',
  'empty.tipSearch': 'พิมพ์คำค้นให้สั้นลง',
  'empty.tipStation': 'ปิด “ใกล้ BTS/MRT”',
  'empty.tipOpen': 'ปิด “เปิดอยู่ตอนนี้”',
  'empty.tipClear': 'ลองล้างตัวกรองดู',
  'empty.try': 'ลอง{list}',
  'empty.mustTitle': 'ไม่มีคาเฟ่{where}ที่มี {names}',
  'empty.in': 'ใน {zone} ',
  'empty.dropCouple': 'ลองเอาออกสักสองข้อ',
  'empty.dropOne': 'ลองเอา {name} ออก จะได้คาเฟ่กลับมา {count}',
  'empty.dropChoice': 'ลองเอาออกสักข้อ: {list}',
  'empty.choice': '{name} ({count})',
  or: 'หรือ',

  'card.checkMap': 'ดูแผนที่',
  'card.price': 'ราคา: {word}',
  'card.match': 'ตรงใจ {n}%',
  'card.why': 'ทำไมถึงเหมาะ: ',
  'card.openLate': 'เปิดดึก',
  'card.tags': 'แท็ก',
  'card.checked': 'ตรวจแล้ว',
  'card.checkedHidden': ': ยังเปิดอยู่ และยืนยันข้อมูลแล้ว',
  'card.save': 'บันทึก',
  'card.visited': 'เคยไปแล้ว',
  'card.compare': 'เปรียบเทียบ',

  'hours.open': 'เปิดอยู่',
  'hours.open24': 'เปิด 24 ชั่วโมง',
  'hours.closed': 'ปิดอยู่',
  'hours.unknown': 'ไม่ทราบเวลาเปิด',
  'hours.closes': 'ปิด {time} น.',
  'hours.closesMidnight': 'ปิดเที่ยงคืน',
  'hours.opens': 'เปิด {time} น.',
  'hours.opensTomorrow': 'เปิดพรุ่งนี้ {time} น.',
  'hours.opensDay': 'เปิดวัน{day} {time} น.',
  'day.mon': 'จันทร์', 'day.tue': 'อังคาร', 'day.wed': 'พุธ', 'day.thu': 'พฤหัสฯ', 'day.fri': 'ศุกร์', 'day.sat': 'เสาร์', 'day.sun': 'อาทิตย์',

  'drawer.close': 'ปิด',
  'drawer.lines': ({ lines }) => `(สาย ${lines})`,
  'drawer.and': ' และ ',
  'drawer.noStation': 'ไม่ระบุ ดูในแผนที่',
  'drawer.noHours': 'ไม่ระบุ ดูใน Google Maps',
  'drawer.noMatch': 'ร้านนี้ไม่ตรงกับที่เลือกไว้ในตัวค้นหา แต่ก็อาจน่าแวะไปดูนะ',
  'drawer.noPicks': 'เลือกบรรยากาศหรือสิ่งที่ต้องมีในตัวค้นหา แล้วเราจะบอกว่าทำไมร้านนี้ถึงเหมาะ',
  'drawer.has': 'มี',
  'drawer.why': 'ทำไมถึงเหมาะ',
  'drawer.details': 'รายละเอียด',
  'drawer.station': 'สถานี',
  'drawer.price': 'ราคา',
  'drawer.hours': 'เวลาเปิด',
  'drawer.tags': 'แท็ก',
  'drawer.goodFor': 'เหมาะกับ',
  'drawer.sources': 'แหล่งข้อมูล',
  'drawer.maps': 'เปิดใน Google Maps',
  newTab: ' (เปิดในแท็บใหม่)',

  'map.label': 'แผนที่คาเฟ่ในผลการค้นหา',
  'map.loading': 'กำลังโหลดแผนที่…',
  'map.failed': 'โหลดแผนที่ไม่ได้ ลองเช็กอินเทอร์เน็ตแล้วลองใหม่ หรือใช้แบบรายการแทน',
  'map.missing': ({ n }) => `มี ${n} ร้านในผลการค้นหาที่ไม่ทราบตำแหน่ง จึงไม่ได้แสดงบนแผนที่`,
  'map.cluster': 'ตรงนี้มี {n} คาเฟ่ ซูมเข้าเพื่อดูทีละร้าน',
  'map.details': 'รายละเอียด',
  'map.zoomIn': 'ซูมเข้า',
  'map.zoomOut': 'ซูมออก',
  'map.osmCredit': 'ตำแหน่งคาเฟ่ © ผู้ร่วมพัฒนา <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> (ODbL)',
  'map.legend': 'คำอธิบายแผนที่',
  'map.legendPicked': ({ n }) => `ร้านที่เราคัดมา (${num(n)})`,
  'map.legendLocal': ({ n }) => `ร้านท้องถิ่น (${num(n)})`,
  'map.legendChain': ({ n }) => `ร้านเชน (${num(n)})`,
  'map.legendChainOff': 'ซ่อนร้านเชนอยู่ (เปิด “รวมร้านเชน” ใต้แผนที่)',

  'more.titleIdle': 'คาเฟ่อื่น ๆ ใกล้ ๆ',
  'more.title': ({ n }) => `ใกล้ ๆ กันยังมีอีก ${num(n)} ร้าน`,
  'more.note': 'ร้านเหล่านี้ใช้ตัวกรองบรรยากาศ สิ่งที่ต้องมี และราคาไม่ได้ เพราะเรายังไม่ได้ติดแท็กให้ แต่ใช้ย่าน สายรถไฟ ใกล้ BTS/MRT เปิดอยู่ตอนนี้ และช่องค้นหาได้',
  'more.show': 'ดูคาเฟ่อื่น ๆ ใกล้ ๆ',
  'more.loading': 'กำลังโหลดคาเฟ่เพิ่ม…',
  'more.failed': 'โหลดคาเฟ่เพิ่มเติมไม่ได้ ลองเช็กอินเทอร์เน็ตแล้วลองใหม่',
  'more.next': 'ดูอีก {n} ร้าน',
  'more.chains': 'รวมร้านเชน (Starbucks, Amazon…)',
  'more.brand': 'แบรนด์',
  'more.allChains': 'ทุกแบรนด์',
  'more.empty': 'ไม่มีคาเฟ่อื่นที่ตรงกับตัวกรองนี้',
  'more.list': 'คาเฟ่อื่น ๆ ใกล้ ๆ',
  'osm.chainTag': 'ร้านเชน',
  'osm.brand': 'แบรนด์: {name}',
  'osm.chainBrand': 'ร้านเชน: {name}',
  'osm.noStation': 'ไม่มี BTS/MRT ในระยะ 1 กม.',
  'osm.website': 'เว็บไซต์',
  'osm.facebook': 'Facebook',
  'osm.call': 'โทรหา {name}',

  'areas.label': '02 / ย่าน',
  'areas.title': 'ย่านต่าง ๆ',
  'areas.intro': 'แต่ละย่านมีสไตล์คาเฟ่ของตัวเอง เลือกย่านเพื่อดูคาเฟ่ในย่านนั้น',
  'areas.show': 'ดูคาเฟ่ใน ',
  'areas.mostly': 'ส่วนใหญ่:',

  'crawl.label': '03 / คาเฟ่ฮอปปิ้ง',
  'crawl.title': 'วางแผนคาเฟ่ฮอปปิ้ง',
  'crawl.intro': 'เลือกจุดเริ่มต้นและบรรยากาศ เราจะจัดคาเฟ่ 2 ถึง 4 ร้านที่อยู่ใกล้กัน และเรียงลำดับให้เดินน้อยที่สุด',
  'crawl.form': 'วางแผนคาเฟ่ฮอปปิ้ง',
  'crawl.mood': 'บรรยากาศ',
  'crawl.moodHint': 'ทุกร้านในเส้นทางจะมีบรรยากาศแบบนี้',
  'crawl.start': 'เริ่มจาก',
  'crawl.zones': 'ย่าน',
  'crawl.stations': 'สถานี BTS/MRT',
  'crawl.stops': 'จำนวนร้าน',
  'crawl.plan': 'จัดเส้นทางให้เลย',
  'crawl.stopsLabel': 'จุดแวะตามลำดับ',
  'crawl.openRoute': 'เปิดเส้นทางใน Google Maps',
  'crawl.mapLabel': 'แผนที่เส้นทางคาเฟ่ฮอปปิ้ง',
  'crawl.metres': '{n} ม.',
  'crawl.km': '{n} กม.',
  'crawl.titleStation': 'เส้นทางของคุณจาก {name}',
  'crawl.titleZone': 'เส้นทางของคุณแถว {name}',
  'crawl.meta': '{n} ร้าน · {mood} · รวม {distance}',
  'crawl.noteStraight': 'ระยะทางวัดเป็นเส้นตรง ระยะเดินจริงจะไกลกว่านี้เล็กน้อย',
  'crawl.noteFew': 'บนแผนที่มีคาเฟ่แนว{mood}แค่ {n} ร้าน เส้นทางนี้เลยมี {n} จุด',
  'crawl.noteFar': 'บางจุดห่างกันเกิน 2 กม. นั่งแท็กซี่หรือ BTS ช่วงนั้นอาจเร็วกว่า',
  'crawl.notEnough': 'คาเฟ่แนว{mood}มีไม่พอสำหรับคาเฟ่ฮอปปิ้ง',
  'crawl.tryMood': 'ลองเลือกบรรยากาศอื่น',
  'crawl.firstStop': 'จุดแรก',
  'crawl.legFromStart': 'ห่างจาก {name} {distance}',
  'crawl.legFromStop': 'ห่างจากจุดที่ {i} {distance}',
  'crawl.swap': 'สลับ',
  'crawl.nearby': 'ร้านใกล้ ๆ แทน',
  'crawl.noSwap': 'ไม่มีคาเฟ่แนว{mood}ร้านอื่นให้สลับแล้ว',
  'crawl.away': '{area} · ห่างไป {distance}',
  'crawl.swapped': 'จุดที่ {i} เปลี่ยนเป็น {name} แล้ว รวม {distance}',
  'crawl.start.label': 'เริ่ม: {name}',
  'crawl.mapFailed': 'โหลดแผนที่ไม่ได้ แต่รายการและลิงก์ Google Maps ยังใช้ได้',

  'saved.label': '04 / ที่บันทึกไว้',
  'saved.title': 'ที่บันทึกไว้',
  'saved.intro': 'คาเฟ่ที่คุณกดหัวใจจะรออยู่ตรงนี้',
  'saved.summary': ({ n, visited }) => `บันทึกไว้ ${n} ร้าน ไปมาแล้ว ${visited} ร้าน`,
  'saved.list': 'คาเฟ่ที่บันทึกไว้',
  'saved.emptyTitle': 'ยังไม่มีร้านที่บันทึกไว้',
  'saved.emptyText': 'กดหัวใจที่ร้านไหนก็ได้ แล้วร้านนั้นจะรออยู่ตรงนี้ บนอุปกรณ์เครื่องนี้',
  'saved.emptyButton': 'หาคาเฟ่',
  'passport.title': 'พาสปอร์ตคาเฟ่',
  'passport.none': 'คุณยังไม่ได้ไปคาเฟ่ไหนเลย จากทั้งหมด {total} ร้าน',
  'passport.some': 'คุณไปมาแล้ว {n} จาก {total} ร้าน',
  'passport.stamps': 'ตราประทับย่าน',
  'passport.first': 'กด “เคยไปแล้ว” ที่ร้านไหนก็ได้ เพื่อรับตราประทับแรก',
  'passport.stamped': 'ได้ตราประทับแล้ว {n} จาก {total} ย่าน',

  'stats.label': '05 / สถิติ',
  'stats.title': 'สถิติคาเฟ่',
  'stats.intro': 'ลิสต์ของเราในรูปตัวเลข ทุกตัวเลขนับตรงจากข้อมูลคาเฟ่',
  'stats.perArea': 'จำนวนคาเฟ่ในแต่ละย่าน',
  'stats.moods': 'บรรยากาศที่พบบ่อยที่สุด',
  'stats.moodsNote': 'ร้านหนึ่งมีได้หลายบรรยากาศ ตัวเลขรวมกันจึงเกิน {total}',
  'stats.price': 'ช่วงราคา',
  'stats.late': 'เปิดดึก',
  'stats.lateText': 'คาเฟ่ที่ติดแท็ก “เปิดดึก / 24 ชม.” คือเปิดถึง 22:00 น. หรือดึกกว่านั้นเกือบทุกวัน หรือเปิดทั้งคืน',
  'stats.hours': 'รู้เวลาเปิดแน่นอน',
  'stats.hoursText': 'คาเฟ่ที่มีเวลาเปิดครบทุกวัน เราจึงบอกได้ว่าตอนนี้เปิดอยู่ไหม ร้านที่เหลือจะแสดงว่า “ไม่ทราบเวลาเปิด”',
  'stats.of': 'จาก {total}',
  'stats.allTitle': 'คาเฟ่ทั้งหมดบนเว็บ',
  'stats.allUnit': 'ร้าน',
  'stats.allText': ({ picked, kept, checked }) => `คาเฟ่ที่เราคัดมา ${num(picked)} ร้าน และอีก ${num(kept)} ร้านที่เชื่อได้ว่ายังเปิดอยู่ (จากคาเฟ่ในกรุงเทพฯ ${num(checked)} ร้านบน OpenStreetMap)`,
  'stats.reliableNote': 'คาเฟ่เพิ่มเติมจะแสดงก็ต่อเมื่อมีชื่อร้านจริง มีการอัปเดตข้อมูลตั้งแต่ปี 2022 (พ.ศ. 2565) และมีหลักฐานอย่างน้อย 2 อย่างว่ามีคนตรวจสอบแล้ว ได้แก่ เวลาเปิด เว็บไซต์ เบอร์โทร ที่อยู่ การสำรวจล่าสุด หรือเป็นสาขาของร้านเชน',
  'stats.mix': 'ร้านที่คัดมา ร้านท้องถิ่น และร้านเชน',
  'stats.handPicked': 'ร้านที่เราคัดมา',
  'stats.local': 'ร้านท้องถิ่น',
  'stats.chain': 'ร้านเชน',
  'stats.topChains': 'ร้านเชน 10 อันดับแรก ตามจำนวนสาขา',
  'stats.chainsNote': 'ร้านเชนคือแบรนด์กาแฟใหญ่ ๆ และแบรนด์ที่มีตั้งแต่ 5 สาขาขึ้นไปในกรุงเทพฯ แท่งกราฟนับเฉพาะสาขาที่เราแสดง ข้อมูล ณ วันที่ {date}',
  'stats.osmLoading': 'กำลังนับคาเฟ่ทั้งหมด…',
  'stats.osmFailed': 'โหลดตัวเลขของคาเฟ่เพิ่มเติมไม่ได้ ลองเช็กอินเทอร์เน็ตแล้วโหลดหน้าใหม่',

  'how.label': '06 / วิธีใช้',
  'how.title': 'ใช้งานยังไง',
  'how.intro': 'แค่สามขั้นง่าย ๆ รายการจะเรียงให้เอง',
  'how.step1Title': 'เลือกบรรยากาศ',
  'how.step1Text': 'ไปเดท หามุมทำงานเงียบ ๆ อยากนั่งในสวน อยากได้ร้านสวย หรือร้านราคาประหยัด เลือกอย่างเดียวหรือหลายอย่างก็ได้',
  'how.step2Title': 'เพิ่มสิ่งที่ต้องมี',
  'how.step2Text': 'Wi-Fi ดี วิวริมน้ำ เปิดดึก หรือพาน้องหมาไปได้ คุณจะเห็นเฉพาะร้านที่มีครบทุกข้อที่ติ๊ก',
  'how.step3Title': 'ได้คาเฟ่ที่เรียงตามความตรงใจ',
  'how.step3Text': 'ทุกร้านได้คะแนนความตรงใจจากสิ่งที่คุณเลือก พร้อมเหตุผลสั้น ๆ ว่าทำไมถึงเหมาะ',
  'how.note1': 'สิ่งที่ต้องมีนั้นเข้มงวด: ร้านที่ขาดข้อใดข้อหนึ่งจะไม่แสดง ส่วนที่เหลือเรียงด้วยคะแนนความตรงใจที่เราคิดขึ้นเอง บรรยากาศที่คุณเลือกมีน้ำหนักมากที่สุด และการอยู่ใกล้ BTS หรือ MRT ช่วยเพิ่มคะแนนอีกนิด ร้านที่ตรงทุกข้อจะได้เกือบ 100%',
  'how.note2': 'ถามบาริสต้าคือแชตที่สร้างจากกฎคำง่าย ๆ ทำงานในเบราว์เซอร์ของคุณทั้งหมด ไม่ใช้บริการ AI ไม่ต้องสมัครบัญชี และร้านที่คุณบันทึกไว้ก็อยู่บนอุปกรณ์นี้เท่านั้น',

  'suggest.label': '07 / แนะนำ',
  'suggest.title': 'แนะนำคาเฟ่',
  'suggest.intro': 'รู้จักคาเฟ่ในกรุงเทพฯ ที่ควรอยู่ในลิสต์ไหม? บอกเราหน่อย ทุกร้านที่แนะนำมาจะถูกเช็กใน Google Maps ก่อนเพิ่ม',
  'suggest.name': 'ชื่อร้าน',
  'suggest.area': 'ย่าน',
  'suggest.areaPlaceholder': 'เช่น อารีย์ หรือ ทองหล่อ',
  'suggest.maps': 'ลิงก์ Google Maps',
  'suggest.mapsHint': 'เปิดร้านใน Google Maps กด “แชร์” แล้วกด “คัดลอกลิงก์”',
  'suggest.why': 'ทำไมถึงชอบร้านนี้',
  'suggest.goodFor': 'เหมาะกับ',
  'suggest.goodForHint': 'ติ๊กได้ทุกข้อที่ใช่',
  'suggest.email': 'อีเมล',
  'suggest.optional': '(ไม่บังคับ)',
  'suggest.emailHint': 'ใส่เฉพาะถ้าอยากให้เราแจ้งเมื่อเพิ่มร้านแล้ว',
  'suggest.send': 'ส่งคำแนะนำ',
  'suggest.sending': 'กำลังส่ง…',
  'suggest.failed': 'ขออภัย ส่งคำแนะนำไม่สำเร็จ ลองเช็กอินเทอร์เน็ตแล้วส่งใหม่อีกครั้ง',
  'suggest.errName': 'บอกชื่อร้านหน่อย',
  'suggest.errArea': 'ร้านอยู่ย่านไหนของกรุงเทพฯ?',
  'suggest.errMaps': 'วางลิงก์ Google Maps ของร้าน',
  'suggest.errMapsWrong': 'ลิงก์นี้ดูไม่ใช่ลิงก์ Google Maps ใน Google Maps ให้กด “แชร์” แล้วกด “คัดลอกลิงก์”',
  'suggest.errWhy': 'เล่าหน่อยว่าชอบอะไร สั้น ๆ ก็ได้',
  'suggest.errMoods': 'ติ๊กบรรยากาศอย่างน้อยหนึ่งข้อ',
  'suggest.errEmail': 'อีเมลนี้ดูไม่ถูกต้อง หรือจะเว้นว่างไว้ก็ได้',
  'suggest.thanksTitle': 'ขอบคุณ!',
  'suggest.thanksBefore': 'เราได้รับคำแนะนำร้าน ',
  'suggest.thanksAfter': ' แล้ว เราจะเช็กใน Google Maps และเพิ่มลงในลิสต์ถ้าเหมาะ',
  'suggest.again': 'แนะนำร้านอื่นอีก',

  'footer.byline': 'Kafé Bangkok · โปรเจกต์โดย Dilshan Gulati',
  'footer.portfolio': 'ผลงาน',
  'footer.how': 'ใช้งานยังไง',
  'footer.suggest': 'แนะนำคาเฟ่',
  'footer.data': 'ข้อมูลคาเฟ่รวบรวมจากคู่มือสาธารณะและเว็บไซต์ของร้าน',
  'footer.locations': 'ตำแหน่งร้านจากผู้ร่วมพัฒนา <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> และข้อมูลร้านใน <a href="https://www.wongnai.com/">Wongnai</a>',
  'footer.check': 'คาเฟ่เปลี่ยนแปลงบ่อย เช็ก Google Maps ก่อนไปนะ',
  'footer.osm': 'ตำแหน่งคาเฟ่ © ผู้ร่วมพัฒนา <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> (<a href="https://opendatacommons.org/licenses/odbl/">ODbL</a>)',

  'compare.label': 'เปรียบเทียบคาเฟ่',
  'compare.clear': 'ล้าง',
  'compare.button': 'เปรียบเทียบ',
  'compare.title': 'เทียบกันชัด ๆ',
  'compare.close': 'ปิด',
  'compare.hint': 'ปัดตารางไปด้านข้างเพื่อดูทุกร้าน',
  'compare.table': 'ตารางเปรียบเทียบ',
  'compare.remove': 'เอา {name} ออกจากการเปรียบเทียบ',
  'compare.area': 'ย่าน',
  'compare.station': 'สถานี',
  'compare.price': 'ราคา',
  'compare.moods': 'บรรยากาศ',
  'compare.features': 'สิ่งที่มี',
  'compare.hours': 'เวลาเปิด',
  'compare.none': 'ไม่ระบุ',
  'compare.noHours': 'ไม่ระบุ ดูใน Google Maps',
  'compare.max': 'เปรียบเทียบได้สูงสุด {max} ร้าน เอาออกก่อนหนึ่งร้านนะ',
  'compare.oneMore': 'ติ๊กอีกหนึ่งร้านเพื่อเทียบกัน',
  'compare.added': 'เพิ่ม {name} ในการเปรียบเทียบแล้ว {n} จาก {max}',
  'compare.removed': 'เอา {name} ออกจากการเปรียบเทียบแล้ว {n} จาก {max}',
  'compare.removedShort': 'เอา {name} ออกจากการเปรียบเทียบแล้ว',
  'compare.cleared': 'ล้างการเปรียบเทียบแล้ว',

  'chat.open': 'ถามบาริสต้า',
  'chat.title': 'ถามบาริสต้า',
  'chat.sub': 'บอกมาเลยว่าอยากได้แบบไหน',
  'chat.close': 'ปิดแชต',
  'chat.log': 'บทสนทนา',
  'chat.chips': 'ตัวเลือกตอบด่วน',
  'chat.inputLabel': 'พิมพ์ถึงบาริสต้า',
  'chat.placeholder': 'ลองพิมพ์ “คาเฟ่เงียบ ๆ แถวอารีย์”',
  'chat.send': 'ส่ง',
  'chat.notLoaded': 'รายชื่อคาเฟ่ยังโหลดไม่เสร็จ บาริสต้าเลยยังช่วยไม่ได้ ลองรีเฟรชหน้าดูนะ',
  'chat.baristaSays': 'บาริสต้าพูดว่า:',
  'chat.youSaid': 'คุณพูดว่า:',
  'chat.match': ' · ตรงใจ {n}%',
  'chat.save': 'บันทึก {name}',
  'chat.order': 'ออเดอร์ของคุณ:',
  'chat.anywhere': 'ทุกย่าน',
  'chat.upTo': 'ไม่เกิน {price}',
  'chat.nearStation': 'ใกล้ BTS/MRT',
  'chat.openNow': 'เปิดอยู่ตอนนี้',
  'chat.chipAnywhere': 'ทุกย่าน',
  'chat.chipDone': 'ไม่มีแล้ว แค่นี้',
  'chat.chipAnyPrice': 'ราคาไหนก็ได้',
  'chat.chipMore': 'ดูเพิ่มอีก',
  'chat.chipSurprise': 'สุ่มให้หน่อย',
  'chat.chipRestart': 'เริ่มใหม่',
  'chat.chipFinder': 'ใช้เงื่อนไขนี้ในตัวค้นหา',
  'chat.chainsNear': 'แถวนี้ยังมีร้านกาแฟเชนอีก {n} ร้าน เช่น {brands} อยากดูไหม',
  'chat.chainsAll': 'ทั่วกรุงเทพฯ ยังมีร้านกาแฟเชนอีก {n} ร้าน เช่น {brands} อยากดูไหม',
  'chat.chainsOne': 'แถวนี้ยังมีร้านกาแฟเชนอีก 1 ร้าน คือ {brands} อยากดูไหม',
  'chat.and': ' และ ',
  'chat.chipChains': 'ดูร้านเชน',
  'chat.chipWithout': 'ไม่ต้องมี{name}',
  'chat.chipTryAnywhere': 'ลองทุกย่าน',
  'chat.chipStationOrNot': 'ใกล้สถานีหรือไม่ก็ได้',
  'chat.chipAnyTime': 'เวลาไหนก็ได้',
  'chat.chipEarlier': 'ขอดูร้านก่อนหน้าอีกที',
  'chat.chipResume': 'ต่อจากครั้งที่แล้ว',
  'chat.relaxZone': 'งั้นทุกย่านเลยนะ',
  'chat.relaxPrice': 'งั้นราคาไหนก็ได้นะ',
  'chat.relaxStation': 'งั้นใกล้สถานีหรือไม่ก็ได้นะ',
  'chat.relaxOpen': 'งั้นเวลาไหนก็ได้นะ',
  'chat.relaxFeature': 'งั้น{label}นะ',
  'chat.relaxExcluded': 'กลับไปดูลิสต์ทั้งหมด',
  'chat.tapOne': 'แตะเลือกอันใดอันหนึ่ง หรือลองพิมพ์แบบอื่นดู',
  'chat.dropSomething': 'ให้ตัดเงื่อนไขไหนออกไหม?',
  'chat.noneHas': 'ไม่มีคาเฟ่{where}ที่มี {names} เลย {what}',
  'chat.in': 'ใน {zone} ',
  'chat.dropIt': 'ให้ตัดออกไหม?',
  'chat.dropOne': 'ให้ตัดออกสักข้อไหม?',
  'chat.dropCouple': 'ให้ตัดออกสักสองข้อไหม?',
  'chat.ackNo': 'ไม่เอา{x}',
  'chat.ackNotZone': 'ไม่เอา {zone}',
  'chat.ackAnyPrice': 'ราคาไหนก็ได้',
  'chat.ackNearStation': 'ใกล้สถานี',
  'chat.ackStationOrNot': 'ใกล้สถานีหรือไม่ก็ได้',
  'chat.ackAnyTime': 'เวลาไหนก็ได้',

  'chat.greet': [
    'สวัสดี ยินดีต้อนรับ วันนี้อยากได้คาเฟ่แบบไหน?',
    'สวัสดี! ต้มน้ำรอแล้ว วันนี้หาคาเฟ่แบบไหนดี?',
    'หวัดดี บอกมาเลยว่าวันนี้อยากนั่งคาเฟ่แบบไหน',
  ],
  'chat.welcomeBack': [
    'ยินดีต้อนรับกลับมา! จะต่อจากครั้งที่แล้ว หรือลองอะไรใหม่ดี?',
    'ดีใจที่ได้เจออีก ต่อจากครั้งก่อนไหม หรือจะเริ่มใหม่?',
  ],
  'chat.leadIn': ['ดีเลย', 'เยี่ยม', 'เลือกได้ดี', 'รับทราบ', 'โอ้ น่าสนใจ'],
  'chat.askMood': ['อยากได้คาเฟ่แบบไหน?', 'วันนี้อยากได้บรรยากาศแบบไหน?', 'อยากไปร้านแนวไหนดี?'],
  'chat.askArea': ['ย่านไหนดี?', 'แถวไหนของกรุงเทพฯ?', 'สะดวกย่านไหน?'],
  'chat.askFeatures': ['มีอะไรที่ขาดไม่ได้ไหม?', 'มีสิ่งที่ต้องมีไหม?', 'ร้านต้องมีอะไรบ้าง?'],
  'chat.askMoreFeatures': ['มีอะไรอีกไหม?', 'เพิ่มอีกไหม หรือแค่นี้?', 'อีกสักอย่างไหม หรือครบแล้ว?'],
  'chat.askBudget': ['แล้วงบประมาณเท่าไหร่ดี?', 'ข้อสุดท้าย: งบเท่าไหร่?', 'เรื่องงบล่ะ?'],
  'chat.results': ['นี่คือร้านที่อยากแนะนำ', 'ร้านพวกนี้เหมาะที่สุด', 'ร้านเด็ดที่เลือกมาให้', 'ลองร้านพวกนี้ดู'],
  'chat.fewResults': ['มีที่ตรงแค่นี้', 'มีแค่ร้านเหล่านี้ที่ตรงทุกข้อ'],
  'chat.more': ['อีกสองสามร้าน', 'ร้านถัดไป', 'จัดให้'],
  'chat.noMore': ['หมดลิสต์สำหรับเงื่อนไขนี้แล้ว ลองผ่อนเงื่อนไขสักข้อไหม?', 'ดูครบทุกร้านแล้ว เปลี่ยนอะไรสักอย่างไหม?'],
  'chat.none': ['อืม ไม่มีร้านในลิสต์ที่ตรงทุกข้อเลย', 'หาร้านที่ครบทุกข้อไม่เจอ', 'ขอโทษนะ ไม่มีร้านที่ตรงทั้งหมด'],
  'chat.surprise': ['รู้สึกโชคดีไหม? ลองร้านนี้', 'ร้านที่เลือกให้วันนี้', 'หลับตาจิ้มเลย ร้านนี้'],
  'chat.cheaper': ['เอาถูกลงนะ', 'ประหยัดลงหน่อย จัดให้', 'เน้นราคาประหยัด'],
  'chat.cheapest': ['นี่ก็ถูกที่สุดในลิสต์แล้ว', 'ถูกกว่า ฿ ไม่ได้แล้วล่ะ'],
  'chat.elsewhere': ['ได้เลย ลองร้านอื่น', 'ไม่มีปัญหา ร้านอื่นนะ', 'ลองดูร้านอื่นกัน'],
  'chat.closer': ['งั้นใกล้ BTS หรือ MRT นะ', 'งั้นไปง่ายด้วยรถไฟฟ้า', 'งั้นใกล้สถานีรถไฟฟ้า'],
  'chat.confused': ['ขอโทษนะ ไม่ค่อยเข้าใจ', 'อืม อันนี้ไม่เข้าใจจริง ๆ', 'เป็นแค่บาริสต้าน่ะ อันนี้งงเลย'],
  'chat.confusedHint': ['ลองพิมพ์แบบ “คาเฟ่เงียบ ๆ แถวอารีย์” หรือแตะเลือกบรรยากาศ', 'บอกบรรยากาศหรือย่าน เช่น “คาเฟ่มีสวนไว้ไปเดท”'],
  'chat.restart': ['เริ่มแก้วใหม่ อยากได้คาเฟ่แบบไหน?', 'เริ่มใหม่หมด หาร้านแบบไหนดี?'],
  'chat.resume': ['โอเค ต่อจากเมื่อกี้ นี่คือร้านที่เลือกไว้', 'ต่อจากครั้งที่แล้วนะ'],
  'chat.ack': ['รับทราบ: {x}', 'จดไว้แล้ว: {x}', '{X} ได้เลย'],
  'chat.ackNegative': ['รับทราบ: {x}', 'จดไว้แล้ว: {x}', 'โอเค: {x}'],

  // Thai labels for the keys in cafes.json (English ones come from meta there)
  'mood.date': 'เดท',
  'mood.green': 'ร่มรื่น',
  'mood.work': 'ทำงาน / อ่านหนังสือ',
  'mood.aesthetic': 'ร้านสวย',
  'mood.budget': 'ราคาประหยัด',
  'feature.garden': 'สวน',
  'feature.outdoor': 'ที่นั่งกลางแจ้ง',
  'feature.river': 'ริมน้ำ / คลอง',
  'feature.rooftop': 'ดาดฟ้า',
  'feature.view': 'วิว',
  'feature.quiet': 'เงียบ',
  'feature.wifi': 'Wi-Fi ดี',
  'feature.specialty': 'กาแฟสเปเชียลตี้',
  'feature.dessert': 'ขนม / เบเกอรี่',
  'feature.brunch': 'บรันช์',
  'feature.lateNight': 'เปิดดึก / 24 ชม.',
  'feature.pets': 'สัตว์เลี้ยงเข้าได้',
  'feature.music': 'ดนตรี / แผ่นเสียง',
  'feature.books': 'หนังสือ',
  'price.1': 'ประหยัด',
  'price.2': 'ปานกลาง',
  'price.3': 'ราคาสูง',

  // The "why it fits" reasons come from score.js in English. These are
  // their Thai versions, looked up by the English words. ("near BTS Ari"
  // becomes "ใกล้ BTS Ari" in reasonText below.) A reason without a Thai
  // version here simply shows in English.
  'reason.great for a date': 'เหมาะกับไปเดท',
  'reason.green and leafy': 'ร่มรื่น มีต้นไม้',
  'reason.good for working': 'เหมาะกับนั่งทำงาน',
  'reason.pretty space': 'ร้านสวย',
  'reason.easy on the wallet': 'ราคาไม่แรง',
  'reason.garden seating': 'มีที่นั่งในสวน',
  'reason.outdoor seating': 'มีที่นั่งกลางแจ้ง',
  'reason.by the river': 'ริมน้ำ',
  'reason.rooftop seats': 'มีที่นั่งบนดาดฟ้า',
  'reason.nice view': 'วิวสวย',
  'reason.quiet': 'เงียบ',
  'reason.good Wi-Fi': 'Wi-Fi ดี',
  'reason.specialty coffee': 'กาแฟสเปเชียลตี้',
  'reason.desserts and bakes': 'มีขนมและเบเกอรี่',
  'reason.brunch menu': 'มีเมนูบรันช์',
  'reason.open late': 'เปิดดึก',
  'reason.pet-friendly': 'พาสัตว์เลี้ยงไปได้',
  'reason.music and vinyl': 'มีดนตรีและแผ่นเสียง',
  'reason.books to read': 'มีหนังสือให้อ่าน',
  'reason.near': 'ใกล้ {station}',
};

const STRINGS = { en, th };

// The language the page starts in: the inline script in index.html's <head>
// has already set <html lang> (from the saved choice, or the browser's language).
// (The typeof check lets the test scripts load clock.js, which uses t(), outside a browser.)
const pageLang = typeof document === 'undefined' ? 'en' : document.documentElement.lang;
let lang = LANGUAGES.includes(pageLang) ? pageLang : 'en';
let meta = { moods: {}, features: {}, price: {} }; // English labels from cafes.json (see setMeta)

export function getLang() {
  return lang;
}

// app.js hands over meta from cafes.json once it has loaded
export function setMeta(dataMeta) {
  meta = dataMeta;
}

// The words for `key` in the current language, with {name} parts filled in
// from `vars`. Falls back to English, then to the key itself.
export function t(key, vars = {}) {
  const value = STRINGS[lang][key] ?? STRINGS.en[key];
  if (value === undefined) return key;
  if (typeof value === 'function') return value(vars);
  return value.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

// Escaping, the same as escapeHtml in ui.js (copied here because ui.js
// imports this file, and two files importing each other is confusing)
const escapeText = (text) => String(text)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

// A café name (or other English data) inside Thai text, for HTML. lang="en"
// makes screen readers read it with an English voice: "บันทึก Factory Coffee"
// otherwise comes out as "Factory Coffee" said in Thai.
export function inEnglish(text) {
  return `<span lang="en">${escapeText(text)}</span>`;
}

// Like t(), but for HTML: the words are escaped, and the {name} parts are
// put in as they are, because they're already HTML (like inEnglish(name)).
// For plain texts only (not the plural functions).
export function tHtml(key, htmlVars = {}) {
  const value = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  return String(value).split(/(\{\w+\})/).map((part) => {
    const name = part.match(/^\{(\w+)\}$/)?.[1];
    return name && name in htmlVars ? String(htmlVars[name]) : escapeText(part);
  }).join('');
}

// A list of ways to say one thing (the barista's lines)
export function lines(key) {
  return STRINGS[lang][key] ?? STRINGS.en[key] ?? [];
}

// "a, b or c" in English, "a, b หรือ c" in Thai
export function listOr(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${t('or')} ${items[items.length - 1]}`;
}

// Labels for the keys in cafes.json: Thai from here, English from meta
export function moodLabel(key) {
  return (lang === 'th' && th[`mood.${key}`]) || meta.moods[key] || key;
}

export function featureLabel(key) {
  return (lang === 'th' && th[`feature.${key}`]) || meta.features[key] || key;
}

// meta.price[2] is "฿฿ mid-range". priceWord(2) is just the word ("mid-range"),
// priceLabel(2) is the whole label ("฿฿ mid-range" or "฿฿ ปานกลาง").
export function priceWord(level) {
  if (lang === 'th' && th[`price.${level}`]) return th[`price.${level}`];
  return (meta.price[level] || '').replaceAll('฿', '').trim();
}

export function priceLabel(level) {
  return `${'฿'.repeat(Number(level))} ${priceWord(level)}`;
}

// A "why it fits" reason from score.js, in the current language
export function reasonText(reason) {
  if (lang !== 'th') return reason;
  if (reason.startsWith('near ')) return t('reason.near', { station: reason.slice(5) });
  return th[`reason.${reason}`] || reason;
}

// Fill in every data-i18n, data-i18n-html and data-i18n-attr inside `root`
export function translatePage(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  // Only ever our own strings from this file, never anything a visitor typed
  root.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  // data-i18n-attr="aria-label:map.label; placeholder:finder.searchPlaceholder"
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const [attribute, key] = pair.split(':').map((part) => part.trim());
      if (attribute && key) el.setAttribute(attribute, t(key));
    }
  });
  if (root === document) document.title = t('page.title');
}

// Thai letters come from Noto Sans Thai. Its stylesheet is only fetched once
// Thai is switched on, so English visitors don't download it.
function loadThaiFont() {
  if (document.querySelector('link[data-thai-font]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = THAI_FONT;
  link.dataset.thaiFont = '';
  document.head.append(link);
}

// Switch language: remember it, set <html lang>, and translate the page's
// fixed words. (app.js then redraws everything JavaScript drew.)
export function setLang(newLang) {
  if (!LANGUAGES.includes(newLang)) return;
  lang = newLang;
  save('lang', lang);
  document.documentElement.lang = lang;
  if (lang === 'th') loadThaiFont();
  translatePage(document);
}

// Called once at the start: same as setLang, without saving a choice the
// visitor hasn't made yet.
export function startI18n() {
  document.documentElement.lang = lang;
  if (lang === 'th') loadThaiFont();
  translatePage(document);
}
