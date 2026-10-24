/* Shore Book · Galápagos — offline cache.
   Bump CACHE when you edit index.html, or the phone keeps the old copy. */
const CACHE = "shore-book-galapagos-v1";
const TILES = "shore-book-galapagos-tiles-v1";
const OWN = "shore-book-galapagos-";   /* only ever clear our own caches — other books may share the origin */
const TILE_HOSTS = ["tile.openstreetmap.org"];
const TILE_MAX = 900;          /* an archipelago is wider than a town; still only what you looked at */
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./ata-logo.png",
  "./favicon.svg",
  "./favicon.ico",
  "./apple-touch-icon.png",
  "./icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith(OWN) && k !== CACHE && k !== TILES).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Map tiles: whatever you looked at while you had signal is still there when
   you do not. Nothing is fetched in bulk — only the tiles actually displayed. */
async function tile(req){
  const c = await caches.open(TILES);
  const hit = await c.match(req);
  if(hit) return hit;
  try{
    const res = await fetch(req);
    if(res && (res.ok || res.type === "opaque")){
      c.put(req, res.clone()).then(() => trim(c)).catch(() => {});
    }
    return res;
  }catch(err){
    return new Response("", {status:504, statusText:"No signal, no tile"});
  }
}
async function trim(c){
  const keys = await c.keys();
  for(let i = 0; i < keys.length - TILE_MAX; i++) await c.delete(keys[i]);
}

/* Cache first: on a landing at Genovesa there is no network to fall back to.
   The AI endpoint is never cached — it is POST, and its answers are per photo. */
self.addEventListener("fetch", e => {
  if(e.request.method !== "GET") return;

  let url;
  try{ url = new URL(e.request.url); }catch(err){ return; }

  if(TILE_HOSTS.indexOf(url.hostname) > -1){ e.respondWith(tile(e.request)); return; }
  if(url.origin !== self.location.origin) return;   /* leave anything else alone */
  if(url.pathname.indexOf("/api/") > -1) return;

  e.respondWith(
    caches.match(e.request).then(hit => {
      if (hit) return hit;
      return fetch(e.request)
        .then(res => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => e.request.mode === "navigate"
          ? caches.match("./index.html")
          : new Response("", {status:504, statusText:"Offline"}));
    })
  );
});
