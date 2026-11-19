# Kafé Bangkok: technical notes

The detailed design and data notes behind the site. For an overview, see the [README](../README.md).

## Features

- **Mood picker and must-haves.** Five moods (date, green escape, work / study, aesthetic, budget) and fourteen must-haves (garden, riverside, good Wi-Fi, open late, books and more). Pick as many as you like.
- **Filters.** Area (9 neighbourhoods), BTS/MRT line, maximum price, "near BTS/MRT", "Open now" and a search box for café names and areas.
- **Open now.** Every card and the drawer say "Open now · Closes 22:00", "Closed · Opens 10:00", "Open 24 hours" or "Hours unknown", worked out from the café's opening hours and the time in Bangkok, and kept up to date every minute. The "Open now" switch hides closed cafés and cafés with unknown hours, and the barista understands "open now".
- **Map view.** A List / Map switch above the results. The map shows the same filtered cafés as small navy pins (Leaflet with OpenStreetMap tiles); click a pin for its name, area, match and a "Details" button. The OpenStreetMap cafés join them as smaller grey pins (local cafés) and small outlined pins (chains), with a key under the map.
- **More cafés nearby.** Under the finder, "Also nearby: 262 more cafés" (the number follows your filters), from OpenStreetMap. Only reliable ones are kept: edited since 2022, not tagged as closed, with a real name and at least two signs that someone has checked them (see "OpenStreetMap cafés" below). Area, line, near BTS/MRT, open now and search apply to them; moods, must-haves and price can't (we haven't tagged them), and a small line says so. "Include chains (Starbucks, Amazon…)" is off at first; switch it on to add the chains and pick one brand. The cards look like ordinary café cards: the name, the Thai name, the brand, the area, the nearest station and open-now, with a small grey "Chain" tag on chain cafés. Their links: "Open in Google Maps" (a search for the café by name and street), then "Website", "Facebook" and the phone number when it has them. OpenStreetMap is credited only in the footer and the map's corner.
- **Ranked results** with a "% match" badge and a handwritten "why it fits" note on every card. Sort by best match, price or name.
- **Café details** in a side drawer (a bottom sheet on phones): hours, all tags, every reason it matched, an "Open in Google Maps" button and links to the sources.
- **Ask the barista.** A rule-based chat that understands messages like "quiet cheap place in Ari to study" or "no rooftop, not too expensive", asks follow-up questions with quick-reply chips, and answers with the top 3 cafés. It also says "There are also 30 chain cafés nearby, like Café Amazon and Starbucks" and offers a "Show chain cafés" chip.
- **Saved cafés.** Heart a café to save it and mark the ones you've "been there". The saved count shows in the top bar.
- **Café passport.** "You've visited 7 of 160 cafés", plus a stamp for every neighbourhood you've visited.
- **Neighbourhoods.** A card for each area, with how many cafés it has and its most common moods. Click one to see its cafés.
- **Compare.** Tick up to 3 cafés and see them side by side: area, station, price, moods, features and hours.
- **Surprise me.** Opens a random café from your current top 10.
- **Café of the day.** Under the hero, one café a day with its area, description and a "See details" button. Everyone sees the same café on the same day, by the date in Bangkok (wherever you are), and it changes by itself at midnight there.
- **Plan a café crawl.** Pick a starting neighbourhood or BTS/MRT station, a mood and 2 to 4 stops. The planner picks cafés with that mood close to each other, puts them in the order with the least walking, shows the distance between stops and draws them as numbered pins on a small map. "Swap" offers three nearby cafés for any stop, and "Open route in Google Maps" opens the whole walk there.
- **Suggest a café.** A short form (name, area, Google Maps link, why you like it, moods and an optional email) sent to Netlify Forms, with a thank-you shown on the page. In the top bar menu and the footer.
- **Thai / English.** A TH / EN switch in the top bar translates every word of the interface into Thai: buttons, labels, headings, empty states, the barista, moods and features, the crawl planner, the form, café of the day and the open-now labels. Café names and descriptions stay in English. The choice is remembered, and a first visit from a browser set to Thai opens in Thai. The barista also understands common Thai words (คาเฟ่, เงียบ, ถูก, สวน, เดท, เปิดดึก, ทำงาน, ร้านหนังสือ and more) in either language.
- **Café stats.** Simple bar charts in plain HTML and CSS: every café on the site (hand-picked, local and chain, and how many of OpenStreetMap's cafés passed the reliability rules), the top 10 chains by branches, cafés per area, the most common moods, the price spread, how many open late and how many have known opening hours. Every number is counted from the data.
- **Admin page** (`admin.html`, not linked from the site). A table of every café with search, a form to add, edit or delete cafés (every field, hours by day and the map position included), and "Download cafes.json" to save the result. It runs only in your browser.
- **Live Bangkok clock.** The hero shows the time in Bangkok and a greeting for the time of day. At night it highlights cafés that open late and offers an "Open late right now" button: it uses real opening hours where we know them, and the "Open late / 24h" tag where we don't.
- **Shareable links.** The filters live in the address (for example `#m=date,green&f=quiet&z=ari-phaya-thai&l=bts-sukhumvit&p=2&o=1`, plus `c=1&b=starbucks` for "Include chains" and a brand), so "Copy link" lets a friend see the same results.
- **Accessible and mobile first.** Works by keyboard only, has visible focus everywhere, passes WCAG AA colour contrast, respects "reduce motion", and works from 360px phones up to wide screens.

## How the match score works

The score lives in `js/score.js` (`scoreCafe(cafe, prefs)`). In plain English:

- Every mood you picked that the café has is worth **10 points**. Moods count the most, because they're the main reason you're looking.
- Every must-have you picked that the café has is worth **6 points**.
- A café near a BTS or MRT station gets a **2 point** bonus, and a café whose details have been checked by hand (`verified: true`) gets **1 point**. The bonuses are small, so they mostly break ties.
- The score is the points a café earned divided by the most it *could* have earned, as a percentage. A café with everything you asked for, near a station and checked, scores 100%.
- If you haven't picked any moods or must-haves, there's nothing to match against, so every café scores 0 and the badge is hidden.

While scoring, each match adds a short reason ("great for a date", "garden seating", "near BTS Ari"). Cards show up to three, and always keep the station reason, because getting there matters in Bangkok traffic.

Area, price, "near BTS/MRT", the search box and the must-haves are filters: a café that doesn't pass them isn't shown at all. Must-haves are strict, so a café needs every one you ticked (this happens in `passesFilters` in `js/app.js`, for the finder and the chat). If nothing is left, the empty state names the must-have to remove, and the barista offers "Without …" chips.

## How the crawl planner works

The planner lives in `js/crawl.js`.

1. **The start.** A station is its real position (from `meta.stations` in `cafes.json`). A neighbourhood is the middle of its cafés: the average of their latitudes and longitudes.
2. **The cafés.** Only cafés with the chosen mood. The 20 closest to the start go into the running.
3. **The route.** It tries every route through 2, 3 or 4 of those cafés (every choice, in every order) and keeps the one with the least walking: from the start to the first café, then café to café. A route is dropped as soon as it's longer than the best one found so far, so this takes a few milliseconds. It was checked against trying every café in the list, for every start, mood and number of stops, and always found the same crawl.
4. **Distances.** Straight lines between two points on the Earth (the haversine formula), rounded to the nearest 50 m. Real walks are a little longer, and the page says so. If two stops are more than 2 km apart, it suggests a taxi or the BTS, and the Google Maps link lets Google pick how to travel instead of asking for walking directions.
5. **Swap.** Shows the three cafés with the same mood closest to that stop. Picking one replaces only that stop.
6. **Google Maps.** A directions link from the station (or the first café) through the stops to the last one, with each place as exact coordinates. Google allows 3 stops in between on phones, and a 4-stop crawl from a station needs exactly 3.

## Suggest a café (Netlify Forms)

The form in `index.html` has `data-netlify="true"`, so Netlify collects what people send. There's no server code of our own. `js/suggest.js` checks the fields with friendly messages (the café's name, area, a real Google Maps link, why you like it, at least one mood, and the email only if one is given), sends the form in the background with `fetch`, and shows a thank-you without leaving the page. Without JavaScript, the browser checks the required fields and Netlify shows its own thank-you page.

- **Spam:** a hidden "honeypot" field called `bot-field` (`netlify-honeypot="bot-field"`). People never see it; spam bots fill it in, and Netlify quietly throws those submissions away.
- **Fields must stay in the HTML:** Netlify finds the form by reading `index.html` when the site is deployed, so every field (including the `moods[]` checkboxes) has to be written there, not only added by JavaScript.
- **Locally:** `python -m http.server` can't receive forms, so sending a suggestion there shows the "didn't send" message. It works on Netlify.
- **Reading suggestions:** in the Netlify dashboard, under Forms → suggest-cafe.

## Thai and English

Every word of the interface lives in one file, `js/i18n.js`, in English and in Thai.

- Fixed words in `index.html` carry `data-i18n="key"` (or `data-i18n-html`, or `data-i18n-attr="aria-label:key"`), and `translatePage()` fills them in. The English already in the HTML is only for people without JavaScript.
- Words drawn by JavaScript come from `t('key')`, for example `t('results.showingOf', { shown: 24, total: 160 })` gives "Showing 24 of 160 cafés" or "แสดง 24 จาก 160 ร้าน".
- To add a new piece of text: add the key to both the `en` and `th` lists in `i18n.js`, then use it with `data-i18n` or `t()`.
- Mood, feature and price labels in English still come from `meta` in `cafes.json`. Their Thai versions are in `i18n.js` under the same keys (`mood.date`, `feature.garden`...). The "why it fits" reasons come from `score.js` in English and are looked up in Thai when shown, so `score.js` didn't change.
- Café data (names, descriptions, areas, zones, stations) stays in English. Café names and descriptions are marked `lang="en"`, so screen readers read them with an English voice in the middle of Thai.
- Thai text uses Noto Sans Thai, loaded only once Thai is switched on. English words keep the site's fonts. Thai gets a little more line height and no letter-spacing.
- The choice is saved in `localStorage`, and `<html lang>` is set to `th` or `en` before the page draws (a tiny script in `<head>`), so there's no flash of the wrong language.
- The barista's word rules each have a list of Thai words too. Thai is written without spaces, so those are matched anywhere in the message; "ไม่" (not), "ไม่เอา" (don't want) and so on work like "no".

## Café stats

`countStats()` in `js/app.js` counts everything from `cafes.json`, and `renderStats()` in `js/ui.js` draws it. `countAllCafes()` counts the first row, every café on the site, from both files: the total, hand-picked against local and chain, how many of the cafés OpenStreetMap had were kept ("471 of the 2,254", from `checked` in `osm-cafes.json`) with a note on the rules, and the 10 chains with most branches. Those numbers need `osm-cafes.json`, so the page starts downloading it when you scroll near the stats (it says "Counting…" until then). Each chart is a list of thin navy bars, longest first, with the number at the end of each bar. A bar's length is a CSS variable (`--share`, from 0 to 1), so there's no chart library and no drawing code. Screen readers read each row as text ("Ari & Phaya Thai, 8 cafés"). Open late counts cafés tagged "Open late / 24h", and known hours counts cafés with `openingHours`.

## Admin page

Open `admin.html` on the site (or the local server). It isn't linked from the site, and it has `<meta name="robots" content="noindex">` so search engines leave it out.

1. It loads `data/cafes.json` and shows every café in a table. Search by name, area, zone or id.
2. **Add a café**, or **Edit** / **Delete** one. The form has every field: name, id, area, zone, description, station, line, latitude and longitude, price, moods, features, the hours text, opening hours by day (`10:00-22:00`, `closed`, `18:00-02:00` past midnight, `00:00-24:00` all day), the Google Maps link, sources and "checked". It points out mistakes (a missing mood, latitude and longitude swapped, a day written wrongly, an id that's taken).
3. **Download cafes.json** saves the result. Put it in the `data` folder in place of the old file and deploy.

Nothing is saved online, and changes stay in that browser tab until you download (the browser asks before you leave with changes). A download with no changes is exactly the same file. Each café keeps its fields in the usual order, and a new café goes after the last one in its zone.

## How the barista chat works

"Ask the barista" (`js/chat.js`) is rule-based. There's no AI and nothing is sent anywhere.

1. **Reading your message.** Word lists turn what you type into the same kind of choices the finder uses: "romantic" or "girlfriend" mean *date*, "plants" or "trees" mean *green escape*, "cheap" means *budget* and ฿ only, "thonglor" or "ekkamai" mean that area, and so on.
2. **Negatives.** "no rooftop" or "don't want a garden" take that choice away, "not too crowded" means *quiet*, and "not expensive" means *budget*, up to ฿฿.
3. **Asking what's missing.** If your message says two or more things, the barista answers straight away. Otherwise it asks about mood, area, must-haves and budget, with quick-reply chips for each.
4. **Ranking.** Cafés go through the finder's own filters and are scored with the same `scoreCafe`. The barista only suggests cafés that have at least one thing you asked for, and shows the top 3 as mini cards you can open or save.
5. **Follow-ups.** "something cheaper", "somewhere else", "closer to BTS" and "more" change the last search, and "start over" starts again. Your last search is saved in the browser, so next time the barista offers to pick up where you left off.

## Built with

- HTML, CSS and JavaScript (ES modules). No frameworks, no build step, no npm packages.
- [Leaflet](https://leafletjs.com/) 1.9.4 and [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) 1.5.3 for the Map view, loaded from cdnjs (pinned versions, with integrity hashes) only when someone opens the map, with map tiles from [OpenStreetMap](https://www.openstreetmap.org/copyright).
- `<dialog>` for the drawer, chat and compare table, so focus handling and Escape-to-close are built in.
- `localStorage` for filters, saved and visited cafés, and the barista's last search.
- Google Fonts: Bricolage Grotesque (headings), Instrument Serif italic (accent words and notes), Manrope (text), and Noto Sans Thai: for the ฿ sign (a one-character file), and for all Thai text once Thai is switched on.
- Inline SVG drawings and icons: the two floating Kafé Bangkok cups with their "K" mark, the line icons, and small illustrations. The sky, clouds and drifting background words are plain CSS.
- Hosted on Netlify, with Netlify Forms collecting café suggestions.

## Project structure

```
kafe-bangkok/
├── index.html          the whole site
├── admin.html          the café admin page (not linked from the site)
├── 404.html            "page not found", in the same style
├── favicon.svg         the cup icon
├── images/
│   ├── og-image.svg    share picture (source)
│   └── og-image.png    share picture (1200 × 630, used by og:image)
├── css/
│   ├── style.css       all the site's styles
│   └── admin.css       a few extra styles for admin.html
├── js/
│   ├── app.js          loads the data, filters, ranks, saving, share links, stats, Thai/English
│   ├── i18n.js         every word of the interface, in English and Thai
│   ├── admin.js        the admin page
│   ├── score.js        the match score
│   ├── chat.js         Ask the barista
│   ├── clock.js        the live Bangkok clock, greeting, today's date, "is it open now?"
│   ├── map.js          the Map view and the crawl map (loads Leaflet when first needed)
│   ├── osm.js          the extra cafés from OpenStreetMap: loading, filters, cards
│   ├── crawl.js        Plan a café crawl
│   ├── suggest.js      the Suggest a café form (Netlify Forms)
│   ├── ui.js           draws the page: cards, drawer, saved, compare...
│   └── store.js        localStorage helpers
├── data/
│   ├── cafes.json      the hand-picked cafés
│   └── osm-cafes.json  the reliable cafés in Bangkok on OpenStreetMap (made by tools/fetch-osm.mjs)
├── data-raw/
│   └── osm-raw.json    OpenStreetMap's whole reply, saved by the script (not part of the site; don't deploy it)
├── tools/
│   └── fetch-osm.mjs   downloads and cleans osm-cafes.json (run by hand, not part of the site)
└── netlify.toml        Netlify settings (static site, no build)
```

## Run it locally

The site loads `data/cafes.json` with `fetch`, which browsers block when you open `index.html` by double-clicking it. Run a small local server instead:

```
python -m http.server 8000
```

Then open http://localhost:8000.

## Deploy

1. Push the folder to GitHub.
2. On Netlify, add a new site from the repository. There's no build command, and the publish directory is the project root (`netlify.toml` already says so).
3. Turn on form detection: in the site's settings on Netlify, open Forms and click "Enable form detection", then deploy again. Netlify then finds the `suggest-cafe` form, and suggestions appear under Forms.
4. Change the `og:url` and `og:image` addresses in `index.html` (and the live link in the README) to your Netlify address.

To deploy by dragging a zip onto Netlify instead, zip only the site: `index.html`, `404.html`, `admin.html`, `netlify.toml`, `favicon.svg` and the `css`, `js`, `data` and `images` folders, at the top level of the zip. Leave out `tools/`, `data-raw/` and the Markdown files.

## Café data

`data/cafes.json` holds 160 cafés across 9 neighbourhoods, compiled on 6 November 2026 from public guides (105 at first; 10 were removed and 65 added on 9 November 2026, see below). Every count on the site (hero, neighbourhoods, area and line dropdowns, passport, results) is worked out from this file, so adding or removing a café updates them all:

- [That Travel Blog](https://thattravelblog.com/)
- [TripCanvas](https://thailand.tripcanvas.co/)
- [Visit Thailand Today](https://visitthailandtoday.com/)
- [Drip Roast](https://driproast.com/)
- [The Thaiger](https://thethaiger.com/)
- [Time Out Bangkok](https://www.timeout.com/bangkok), [The Way to Coffee](https://www.thewaytocoffee.com/), [That Bangkok Life](https://www.thatbangkoklife.com/), [Thailand with Tereza](https://thailandwithtereza.com/) and [Tatler Asia](https://www.tatlerasia.com/) (for the 65 cafés added later)

On 9 November 2026 the late-night cafés were checked again. Where hours were confirmed on a café's own website, that page was added to its `sources` and it was marked `verified: true`.

Also on 9 November 2026 ten cafés were removed: five that Wongnai shows as closed or possibly closed (Roots at Sathon, Roots Ari, Organika House Cafe, Breakfast Story Thonglor, Flower in Hand by P) and five whose location couldn't be confirmed anywhere (Uncle Tai Coffee, Nine Pastry, Grains & Groove, Cosmo Vibrators, THIRDBASE).

Then 70 more cafés (several book cafés among them) were checked one by one and 65 were added. Each was searched for on the web to make sure it's still open, given a map pin, a station within 1 km where there is one, and the right neighbourhood for where it really is. Five were left out: Somewhere Bookshop and Home Café (closed for good in October 2026), Before Sunset (listed as closed), Porcupine Cafe and Casa Lapin Thonglor (no sign they're still open), and Cof and Cow at Khlong Ong Ang (new, but no address could be found). The "Books" feature came with them.

Each café's `sources` field links to the page it came from. Descriptions are written fresh, not copied, and there are no copied photos or reviews: each café links to Google Maps instead. Mood and feature labels come from `meta` in the same file, so they're defined in one place.

Cafés open and close often in Bangkok. `verified: true` marks a café whose details have been checked by hand, and it shows a small "checked" mark on its card. Check Google Maps before you go.

### Opening hours, lines and locations

Each café also has:

- `openingHours`: the `hours` text turned into something the code can read, one list per day. `[]` means closed that day, `"close": "24:00"` means open until midnight, and a close time earlier than the open time (`"18:00"` to `"02:00"`) runs past midnight. If the hours aren't fully known (for example "Opens 07:30" or "Closed Monday"), it's `null` and the café shows "Hours unknown". The `hours` text stays as it was.

  ```json
  "openingHours": {
    "mon": [],
    "tue": [{ "open": "11:00", "close": "22:00" }],
    "...": "and so on to sun"
  }
  ```
- `line`: the BTS/MRT line(s) of the café's station, from its name: `["BTS Sukhumvit"]`, `["MRT Blue"]`, `["BTS Gold"]` (Khlong San), `["MRT Yellow"]` (Hua Mak), or both BTS lines for Siam, where they meet. It's `[]` when there's no station. `meta.lines` lists the lines in the order the Line dropdown shows them.
- `lat` and `lng`: where the café is, for the map. They were looked up on 9 November 2026 from [OpenStreetMap](https://www.openstreetmap.org/copyright) (© OpenStreetMap contributors, ODbL) and the cafés' [Wongnai](https://www.wongnai.com/) listings (or, for a few of the later cafés, their [Time Out Bangkok](https://www.timeout.com/bangkok) page), and checked against each café's station or area. Cafés inside a mall or hotel use the building's location. Every café now has a location; a new café without a reliable one can use `null`, and the map leaves it out and says so.
- On the map, cafés close together are grouped into a numbered navy circle (Leaflet.markercluster). Click or press Enter on a circle to zoom in until the cafés separate.
- `meta.stations`: the position of every BTS/MRT station named in the cafés, `{ "BTS Ari": { "lat": 13.77971, "lng": 100.54462 }, ... }`, from [OpenStreetMap](https://www.openstreetmap.org/copyright) on 9 November 2026. The crawl planner starts from these. A new station needs a position here before it shows up as a starting point.

## OpenStreetMap cafés

`data/osm-cafes.json` holds the cafés in Bangkok on [OpenStreetMap](https://www.openstreetmap.org/copyright) that we can trust are real and still open, and that aren't one of our hand-picked cafés: 471 of the 2,254 that OpenStreetMap had on 9 November 2026 (262 local and 209 chain). The data is © OpenStreetMap contributors under the [ODbL](https://opendatacommons.org/licenses/odbl/). The licence needs a credit where people can see it, so "Café locations © OpenStreetMap contributors (ODbL)" stays in the footer and in the map's corner. On the page itself these cafés look like any other café: no "From OpenStreetMap" labels or links on cards or pop-ups, and the stats mention OpenStreetMap once.

**Refreshing it.** From the project folder, with Node 18 or newer (nothing to install):

```
node tools/fetch-osm.mjs --save-raw data-raw/osm-raw.json
```

It asks the Overpass API for every node and way tagged `amenity=cafe` inside Bangkok's boundary (the Bangkok Metropolitan Administration, `ISO3166-2=TH-10`), with `out center meta`: buildings get a single point, and every café comes with the date it was last edited. The free Overpass servers are often busy (they answer 502 or 504), so the script takes turns asking overpass-api.de and a mirror, waits 20 seconds between rounds and keeps trying for up to 5 minutes (each try is cut off after 90 seconds). If nothing answers, it stops and leaves the old `osm-cafes.json` as it was. It only reads `cafes.json`.

- `--save-raw data-raw/osm-raw.json` keeps OpenStreetMap's whole reply (about 850 KB). `--from data-raw/osm-raw.json` cleans that saved reply again without downloading, for example after changing a rule.
- `data-raw/` is for the script only, not part of the site: leave it out of the deploy (the Netlify zip doesn't include it).
- A reply saved before 10 November 2026 (made with `out center tags`) has no edit dates. The script then skips the "edited since 2022" rule and says so; download again to apply it.

**Which cafés are kept.** Anyone can add a café to OpenStreetMap, and nobody has to remove it when it closes, so many entries are years out of date. The rules are at the top of `tools/fetch-osm.mjs` (`EDITED_SINCE`, `CHECKED_SINCE`, `MIN_SIGNS`). A café is removed for the first of these reasons that fits, so each one counts once:

| Reason | Removed on 9 Nov 2026 |
|---|---|
| No name | 152 |
| Only a generic name: "Coffee", "Coffee House", "Coffee bar", "ร้านกาแฟ", "กาแฟสด", "ร้านขายน้ำ", "Coffee/คอฟฟี่/咖啡"… | 19 |
| Tagged as closed: `disused:*`, `was:*`, `abandoned:*`, `end_date`, or `opening_hours` "closed" / "off" | 0 |
| Not edited on OpenStreetMap since 1 January 2022 | 588 |
| Already one of our hand-picked cafés (same name within 150 m) | 37 |
| Fewer than 2 signs that someone has checked it (see below) | 987 |
| **Kept** | **471** |

A name is generic when nothing is left after taking out the words that only say "café" (coffee, cafe, shop, house, bar, ร้าน, กาแฟ, สด, คาเฟ่, น้ำ, 咖啡…). No café was tagged as closed this time: the download asks for `amenity=cafe`, and a café marked closed on OpenStreetMap usually loses that tag (it becomes `disused:amenity=cafe`). The rule is there for the ones that keep both.

The signs that someone has checked a café (it needs at least 2):

- opening hours (`opening_hours`)
- a link: `website`, `contact:website`, `facebook`, `instagram` or any other `contact:*` tag (a `contact:phone` counts as a phone)
- a phone number: `phone`, `mobile` or `contact:phone`
- a street address: `addr:street` or `addr:housenumber`
- a recent check: `check_date`, `check_date:opening_hours` or `survey:date` from 2023 or later
- being a branch of a known chain (the chains below, plus ChaTraMue, Chao Doi, Swensen's, Mixue, S&P and Wawee Coffee)

**How each café is cleaned** (also in `tools/fetch-osm.mjs`):

- **Name:** the English name (`name:en`) if there is one, else `name`; the Thai name (`name:th`, or `name` when that's Thai) beside it.
- **Already ours:** "Same name" ignores capitals, accents, punctuation and words like "café", "coffee" and "roasters", and also counts one name inside the other, or the same first 5 letters ("Patom Organik Living" and "Patom Organic Living").
- **Brand and chains:** from `brand` / `brand:en`, or the name. Starbucks, Café Amazon, True Coffee, Inthanin, All Café, Black Canyon, Doi Chaang, Coffee World, Mezzo, D'Oro, Punthai, Tom N Toms, Hollys, % Arabica, The Coffee Club, Casa Lapin and Kudsan are always chains, in English or Thai spelling. Any other brand with 5 or more cafés in the whole download is a chain too (S&P, ChaTraMue, Chao Doi and Swensen's this time). They're counted before the rules, so a chain stays a chain even when only a few of its branches pass. Everything else is local.
- **Zone:** the most common zone among the 5 nearest hand-picked cafés within 3 km. Further out than that from all of them, it's "Outer Bangkok" (only the "Anywhere" area shows those).
- **Station:** the nearest station in `meta.stations` within 1 km, and its line(s).
- **Features:** `outdoor_seating` → Outdoor seating, `internet_access=wlan` → Good Wi-Fi, a cuisine or name with dessert, bakery or cake → Desserts / bakery. They show as tags on the card (the must-have filters don't use them).
- **Opening hours:** the `opening_hours` tag as written, and the common forms ("Mo-Fr 07:00-20:00; Sa,Su 08:00-18:00", "24/7", "Tue-Sun 09:00-18:00", "PH off") read into hours by day, so "Open now" works. Anything it can't read (months, "sunrise", "AM/PM") stays "Hours unknown". 292 of the 293 tagged ones were read.
- **Links:** the website (`website` or `contact:website`, with `https://` added when it's missing), the Facebook page (`contact:facebook` or `facebook`, a link or just a page name; a Facebook address in `website` becomes the Facebook link too) and the first phone number. Only `http` and `https` links are kept, so a bad tag can't become a harmful link. This time: 189 websites, 80 Facebook pages and 185 phone numbers.
- **Street and branch:** `addr:street` (up to the first comma, as a few hold a whole address) and `branch` (a chain's branch name, like "Siam Square One"), for the Google Maps search.

**The links on a card.** "Open in Google Maps" searches for the café by its name, its branch, its street (or else its station, or else its area) and "Bangkok", for example `Pitta Cafe, ซอยพระรามที่ 2 ซอย 50, Bangkok` or `S&P, The Old Siam, ถนนตรีเพชร, Bangkok`. That way Maps opens the place itself, with its photos, reviews and hours. Our own area names aren't places Google knows, so the brackets ("(Asok to Phrom Phong)") are left off, and "Outer Bangkok" isn't used at all. A chain's name is generic: "Starbucks, BTS Asok" could be any of several branches. So a chain with no branch or street (172 of the 209) searches for its brand on a map centred on the café, zoomed right in: `https://www.google.com/maps/search/Starbucks/@13.74633,100.53413,18z`. Google then lists that brand's branches around that spot, each with its own page. (Google doesn't always put the very nearest one first, but it's on the screen.) After it come "Website", "Facebook" and the phone number (a `tel:` link) when the café has them. Pop-ups on the map have the same links. A chain café's card also has a small grey "Chain" tag where a hand-picked card has its match %.

**The file** is one line of JSON with short keys to keep it small (about 100 KB, much less once the server compresses it):

```json
{
  "about": "...", "date": "2026-11-09", "checked": 2254,
  "zones": ["Ari & Phaya Thai", "...", "Outer Bangkok"],
  "stations": [["BTS Ari", ["BTS Sukhumvit"]], "..."],
  "brands": ["Starbucks", "Café Amazon", "..."],
  "cafes": [
    { "i": "n1702370757", "n": "Thegardenhousecafe", "t": "เดอะการ์เด้นเฮ้าสคาเฟ่", "y": 13.60373, "x": 100.51503,
      "z": 9, "b": 19, "f": ["outdoor", "wifi", "dessert"],
      "o": "Mo-Su 09:00-23:00", "h": ["09:00-23:00", "...", "09:00-23:00"],
      "a": "ถนนประชาอุทิศ", "w": "http://www.gardenhouseparty.com/",
      "fb": "https://www.facebook.com/thegardenhousecafe/", "p": "+66958288989" }
  ]
}
```

`checked` is how many cafés OpenStreetMap had before the rules (the stats say "471 of the 2,254"). In each café, `i` is the OpenStreetMap id (`n` node or `w` way, then the number), `n` the name, `t` the Thai name, `y`/`x` latitude and longitude, `z`, `s` and `b` places in the `zones`, `stations` and `brands` lists, `c: 1` a chain, `f` features, `o` the opening_hours tag and `h` the hours by day, Monday first ("" closed, "07:00-12:00,13:00-20:00" two openings), `a` the street, `r` the branch, `w` the website, `fb` the Facebook page and `p` the phone number. Keys with nothing in them are left out. `js/osm.js` turns each row back into a café with the usual field names.

**When it loads.** Not with the page: only when someone presses "Show more cafés", opens the Map view, scrolls near the stats, or the barista counts chains. On a local server the page loads in about 150 ms either way, a filter change takes about 10–13 ms with the extra cafés loaded, and the Map view redraws its 630 pins with no step over 50 ms.

