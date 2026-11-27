"use strict";

const CACHE_NAME = "stats-shell-2.16.0";
const SHELL_FILES = [
    "./",
    "./index.html",
    "./manifest.webmanifest",
    "./css/global.css?v=2.16.0",
    "./css/components.css?v=2.16.0",
    "./css/app.css?v=2.16.0",
    "./css/weekly.css?v=2.16.0",
    "./css/spotlight.css?v=2.16.0",
    "./css/profile.css?v=2.16.0",
    "./css/season.css?v=2.16.0",
    "./css/backup.css?v=2.16.0",
    "./css/product.css?v=2.16.0",
    "./css/tinta-volt.css?v=2.16.0",
    "./js/theme-init.js?v=2.16.0",
    "./js/constants.js?v=2.16.0",
    "./js/theme.js?v=2.16.0",
    "./js/ui.js?v=2.16.0",
    "./js/data.js?v=2.16.0",
    "./js/participant-catalog.js?v=2.16.0",
    "./js/storage.js?v=2.16.0",
    "./js/weekly-migration.js?v=2.16.0",
    "./js/weekly.js?v=2.16.0",
    "./js/spotlight.js?v=2.16.0",
    "./js/profile-history.js?v=2.16.0",
    "./js/analytics.js?v=2.16.0",
    "./js/season.js?v=2.16.0",
    "./js/seasons.js?v=2.16.0",
    "./js/classifications.js?v=2.16.0",
    "./js/participants.js?v=2.16.0",
    "./js/tags.js?v=2.16.0",
    "./js/image-storage.js?v=2.16.0",
    "./js/backup.js?v=2.16.0",
    "./js/backup-view.js?v=2.16.0",
    "./js/weekly-view.js?v=2.16.0",
    "./js/spotlight-view.js?v=2.16.0",
    "./js/profile-view.js?v=2.16.0",
    "./js/season-view.js?v=2.16.0",
    "./js/product-view.js?v=2.16.0",
    "./js/app.js?v=2.16.0",
    "./js/pwa.js?v=2.16.0",
    "./assets/brand/stats-wordmark.png",
    "./assets/brand/stats-symbol.png",
    "./assets/brand/pwa-192.png",
    "./assets/brand/pwa-512.png",
    "./assets/brand/pwa-maskable-512.png",
    "./assets/brand/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
    event.waitUntil(caches.keys()
        .then((keys) => Promise.all(keys.filter((key) => key.startsWith("stats-shell-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
        .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== "GET" || url.origin !== self.location.origin) return;

    if (request.mode === "navigate") {
        event.respondWith((async () => {
            const cache = await caches.open(CACHE_NAME);
            try {
                const response = await fetch(request);
                if (response.ok) await cache.put("./index.html", response.clone());
                return response;
            } catch {
                return (await cache.match(request)) || (await cache.match("./index.html")) || Response.error();
            }
        })());
        return;
    }

    if (!/\.(?:css|js|png|svg|webp|ico|webmanifest)$/.test(url.pathname)) return;

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
    })());
});
