/**
 * The service worker's source (Step 1.5). It is served from `/sw.js` with a version baked in at
 * build time, so every deploy is a new worker: the page then offers "Reload to update".
 *
 * - Install: cache every screen's HTML and every `/_next/static` file it references, following
 *   references from JS chunks one level so lazily loaded chunks are cached too.
 * - Navigations: served from this version's cache (HTML and chunks always come from the same
 *   build), falling back to the network for anything not cached.
 * - Static assets: cache first, cached as they are fetched.
 * - Client-side route payloads (RSC): network only. Offline they fail, and Next.js falls back to a
 *   full navigation, which the cache serves.
 */
export const ROUTES = ["/today", "/plan", "/focus", "/goals", "/goals/goal", "/goals/area", "/settings", "/goal-setup"];

export const ASSETS = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

export function workerSource(version: string): string {
  return `/* FOQUS service worker ${version} */
const VERSION = ${JSON.stringify(version)};
const CACHE = "foqus-" + VERSION;
const ROUTES = ${JSON.stringify(ROUTES)};
const ASSETS = ${JSON.stringify(ASSETS)};

const staticRefs = (text, fromHtml) => {
  const out = new Set();
  const re = fromHtml ? /\\/_next\\/static\\/[^"'\\s\\\\)?]+/g : /static\\/(?:chunks|media|css)\\/[^"'\\s\\\\)?]+/g;
  for (const m of text.matchAll(re)) out.add(fromHtml ? m[0] : "/_next/" + m[0]);
  return [...out];
};

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    const seen = new Set();
    const js = [];
    for (const route of ROUTES) {
      const res = await fetch(route, { cache: "reload", credentials: "same-origin" });
      if (!res.ok) throw new Error("Could not cache " + route);
      const html = await res.clone().text();
      await cache.put(route, res);
      for (const url of staticRefs(html, true)) if (!seen.has(url)) { seen.add(url); js.push(url); }
    }
    // Follow references from JS chunks one level (lazily loaded chunks).
    for (const url of [...js]) {
      if (!url.endsWith(".js")) continue;
      const res = await fetch(url);
      if (!res.ok) continue;
      await cache.put(url, res.clone());
      for (const ref of staticRefs(await res.text(), false)) if (!seen.has(ref)) { seen.add(ref); js.push(ref); }
    }
    await Promise.all(js.map(async (url) => {
      if (await cache.match(url)) return;
      const res = await fetch(url);
      if (res.ok) await cache.put(url, res);
    }));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith("foqus-") && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

const routeKey = (pathname) => {
  const p = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return ROUTES.includes(p) ? p : null;
};

async function navigate(request, url) {
  if (url.pathname === "/") return Response.redirect("/today", 302);
  const key = routeKey(url.pathname);
  const cache = await caches.open(CACHE);
  const cached = key ? await cache.match(key) : undefined;
  if (cached) return cached;
  try {
    return await fetch(request);
  } catch {
    return (await cache.match("/today")) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok && res.type === "basic") cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname === "/sw.js") return;
  if (request.mode === "navigate") return event.respondWith(navigate(request, url));
  if (request.headers.get("RSC")) return; // network; offline, Next.js falls back to a full navigation
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/splash/") || ASSETS.includes(url.pathname)) {
    return event.respondWith(cacheFirst(request));
  }
});
`;
}
