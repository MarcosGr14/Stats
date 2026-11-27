const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

test("declares an installable Stats PWA with regular and maskable app icons", () => {
    const html = read("index.html");
    const manifest = JSON.parse(read("manifest.webmanifest"));
    assert.match(html, /rel="manifest" href="manifest\.webmanifest"/);
    assert.equal(manifest.display, "standalone");
    assert.equal(manifest.theme_color, "#0E0E12");
    assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192" && icon.purpose === "any"));
    assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable"));
    manifest.icons.forEach((icon) => assert.ok(fs.existsSync(path.join(root, icon.src))));
});

test("uses the provided brand in the header and registers the service worker", () => {
    const html = read("index.html");
    assert.match(html, /assets\/brand\/stats-wordmark\.png/);
    assert.match(html, /assets\/brand\/apple-touch-icon\.png/);
    assert.match(read("js", "pwa.js"), /serviceWorker\.register\("\.\/sw\.js"/);
    assert.ok(fs.existsSync(path.join(root, "assets", "brand", "stats-symbol.png")));
});

test("caches the offline app shell without intercepting app data requests", () => {
    const worker = read("sw.js");
    assert.match(worker, /cache\.addAll\(SHELL_FILES\)/);
    assert.match(worker, /request\.mode === "navigate"/);
    assert.match(worker, /\(\?:css\|js\|png\|svg\|webp\|ico\|webmanifest\)/);
    assert.doesNotMatch(worker, /indexedDB|localStorage|fetch\(.*api/i);
});
