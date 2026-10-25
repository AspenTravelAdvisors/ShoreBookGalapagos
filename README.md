# Shore Book · Galápagos 2026

An offline-first expedition companion for HX's *Nine of the Best Isles* (Western & Northern
route) aboard MS Santa Cruz II, 24 November – 4 December 2026. Built for Aspen Travel Advisors.

Sibling to [ShoreBookAdriatic](https://github.com/AspenTravelAdvisors/ShoreBookAdriatic) and
ShoreBookPolynesia. It keeps their engine and manner: one file, no build, works with no signal.
It adds what an expedition needs that a port day does not. The book knows which landing you are
on, recognises what you photographed, keeps a log of what you have seen, and writes the trip up.

## What is new in this book

| | Works with no signal | Needs signal |
| --- | --- | --- |
| **Day** — each day's landings, wet or dry, what to carry, water temperature, a countdown to the panga | ✓ | |
| **Before breakfast** — a briefing assembled from the book: what you still have not seen that today can show you, flagged *only here* or *last chance* | ✓ | |
| **Tonight's briefing** — type or dictate the expedition leader's talk; the book works out what changed for tomorrow and rewrites the day | text is kept | ✓ to read it |
| **Wildlife** — 166 species: the 108 this route can show (including the Bolívar Channel whales and the November migrant shorebirds) and the rest of the archipelago, marked *Not expected on this route* with where they do live. A field key: group, colours, size, where. Ranked by what lives where you are standing | ✓ | |
| **Off the list** — log anything the book does not have, by name or from a photo ID; it goes in the log, the journal and the two-phone merge | ✓ | |
| **Species photos** — one openly licensed photo per species from Wikimedia Commons, credited on each species page | ✓ once saved | first open only |
| **Camera** — photos are filed under the landing they were taken on, by their own EXIF timestamp (phone or separate camera), and identified when there is signal | filing and queue | ✓ to identify |
| **Log** — the checklist: what you have, what is left, and the next and last chance to see each one | ✓ | |
| **Chart** — every visitor site, the route, the equator, and where you are by GPS | ✓ drawn | tiles |
| **Journal** — notes per day, what the naturalists said, confirmed photos, an AI write-up per day, a PDF at the end | ✓ | ✓ write-up |
| **Two phones** — send your log by AirDrop, the other phone merges it | ✓ | |

Identification is careful by design. It gives up to three candidates with a confidence for each.
It keeps what is visible apart from what that might mean (*"holding its wings out"* against
*"probably drying them after a dive"*). It says what photo would settle the question. If the
photo is a dark finch on a rock, the answer is "a ground finch", and the book explains why that
is the honest answer.

## How it works

`index.html` holds markup, styles, data and logic. Near the top of the script are `SITES`
(21 stops, each with the species recorded there — 20 visitor sites and the Bolívar Channel crossing, seen from the deck), `DAYS` (the itinerary) and `SPECIES`.
Where each species can be seen is worked out from the sites, so the two lists cannot drift apart.

`SPECIES` is the whole archipelago, not this voyage. A species is on the route if a stop in
`SITES` that `DAYS` visits lists it; everything else shows as *Not expected on this route*, with
its `r` line saying where in the islands it lives. Anything a guest logs that the book does not
have is kept on the phone under `sbg.custom` and behaves like a book species.

Photos live in IndexedDB on the phone. Everything else lives in localStorage under `sbg.` keys.

`api/claude.js` is the only server code. It is a Vercel function that holds the API key and runs
four fixed jobs (`identify`, `ask`, `briefing`, `journal`) with prompts written on the server, so
nobody who finds the URL can use it as a general Claude endpoint. It uses Claude Opus 5.5 with
structured JSON output and server-side refusal fallback. The species catalogue goes in a cached
system block, so repeat calls are cheap.

Species photos are not in the repo. The first time the book opens with signal, it asks
Wikipedia for the lead image of a named article for each species (`WIKI` in `index.html`;
alternates come after `|`). Only CC0, CC BY, CC BY-SA and public-domain files are kept. It saves a
640 px copy and the photographer's credit to IndexedDB, so the photos work at sea. Credits show on
each species page and under Know → Species photos. If a picture is wrong, change its article
title in `WIKI`.

`sw.js` caches the app and every map tile you look at. It never caches `/api/` and only ever
deletes its own `shore-book-galapagos-*` caches. **Bump `CACHE` in `sw.js` whenever you edit
`index.html`.**

## Deploying

1. Import the repo into Vercel. There is no build step: `api/claude.js` and its one dependency
   (`@anthropic-ai/sdk`) are picked up automatically.
2. Under Settings → Environment Variables, set:
   - `ANTHROPIC_API_KEY` — the API key.
   - `BOOK_CODE` — any short code. Give it to the travellers; they enter it once under
     **Know → Settings**. Requests without it are refused.
3. On each phone, open the site in Safari, then Share → **Add to Home Screen**. Open the book
   from the icon and enter the trip code.
4. **Before flying to the islands**, on hotel Wi-Fi in Quito, check Know → Species photos says
   all of them (or close), and open the Chart and look at each island once so its tiles are kept.

Without the two variables the book still works. It files photos and queues them, and the
field key, log and journal all run. Photo ID and questions explain that they are not switched on.

Rough cost: one identification is a ~1568 px photo plus the cached catalogue at high effort,
about five to ten US cents on Opus 5.5. A keen photographer might identify 150–300 photos on
the trip.

## Local development

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`. The service worker needs `localhost` or HTTPS. `vercel dev`
runs the API function locally as well.

## Before it travels

The content was written without web access and has not been checked against live sources.

- **Darwin Bay.** HX prints it on the morning of 4 December, but the ship is due at Baltra at
  08:30 that day. The book places it on the afternoon of the 3rd and marks it *Unconfirmed*.
- **Times.** HX printed only the sites and the 14:50 sailing and 08:30 arrival. Every other hour
  is how this route is normally run and is marked *typical*. Edit times on the phone, or paste
  the evening briefing.
- **Puerto Ayora day.** HX lists only "Puerto Ayora". The Darwin Station, highlands and town
  split is the usual pattern, not a confirmed plan.
- **Restaurants** in Quito and Puerto Ayora, opening hours, and the park fee ($200 for foreign
  adults) need checking against live sources.
- **Pins** are good to the landing beach, not the boot.

## Privacy

Nothing leaves the phone unless someone asks for it. Asking for an identification, a question,
a briefing reading or a journal entry sends that photo (made smaller) or text, with the name of
the visitor site, to the Vercel function, which passes it to Anthropic. No location, names or
booking details are sent. None are stored in this repo either. The journal asks for names on the
phone.

## Credits

Aspen Travel Advisors, Aspen, Colorado. Map tiles © OpenStreetMap contributors.
Hours, prices and itineraries drift. The book says so, and means it.

## A new itinerary

The book is built to be reused. For another voyage:

1. In `TRIP`, set the dates, ship and line, a new `id` (logs only merge between phones on the
   same id), a new `store` prefix (so a phone that carried the last trip keeps the logs apart),
   and the `other` comparison table for Know, or remove it.
2. Rewrite `DAYS`. Add any stops it needs to `SITES`, each with the species seen there in `see`.
   Leave unused sites in place; they cost nothing. A passage worth watching from the ship, such
   as the Bolívar Channel, is a stop with `how:"ship"`.
3. Leave `SPECIES` alone unless something is missing. The route list, the "Not expected" marks,
   the log totals, the briefings and the photo-ID catalogue all follow from the sites.
4. Check `BRING`, `KNOW` and the `screen` films for anything that names this trip, update the
   README, and bump `CACHE` in `sw.js`.
