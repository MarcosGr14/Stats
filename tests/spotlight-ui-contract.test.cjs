const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
const domain = fs.readFileSync(path.join(projectRoot, "js", "spotlight.js"), "utf8");
const view = fs.readFileSync(path.join(projectRoot, "js", "spotlight-view.js"), "utf8");
const app = fs.readFileSync(path.join(projectRoot, "js", "app.js"), "utf8");
const css = fs.readFileSync(path.join(projectRoot, "css", "spotlight.css"), "utf8");

test("loads Weekly Spotlight derivation and view before the application", () => {
    assert.ok(html.indexOf("js/weekly.js") < html.indexOf("js/spotlight.js"));
    assert.ok(html.indexOf("js/spotlight.js") < html.indexOf("js/spotlight-view.js"));
    assert.ok(html.indexOf("js/spotlight-view.js") < html.indexOf("js/app.js"));
    assert.match(html, /id="nav-results" href="#results"/);
    assert.match(app, /spotlightController = spotlightViewService\.createController/);
    assert.match(html, /data-results-tab="week"/);
});

test("exposes week, six categories and separate Mujeres and Hombres controls accessibly", () => {
    assert.match(html, /id="spotlight-week-select"/);
    assert.match(html, /id="spotlight-category-tabs" role="tablist" aria-label="Categoría"/);
    assert.match(html, /data-spotlight-gender="female" aria-pressed="true"/);
    assert.match(html, /data-spotlight-gender="male" aria-pressed="false"/);
    assert.match(view, /constants\.CATEGORIES\.forEach/);
    assert.match(view, /ArrowRight/);
    assert.match(view, /ArrowLeft/);
});

test("renders LIVE or OFFICIAL Top 3, full ranking, reason skill and weekly recap", () => {
    assert.match(html, /id="spotlight-mode"/);
    assert.match(html, /id="spotlight-podium"/);
    assert.match(html, /id="spotlight-ranking-list"/);
    assert.match(html, /id="spotlight-praised"/);
    assert.match(html, /id="spotlight-recap-grid"/);
    assert.match(view, /Resultados oficiales/);
    assert.match(view, /Resultados en vivo/);
    assert.match(view, /sin evaluar/);
    assert.match(view, /Ver perfil/);
});

test("keeps Spotlight derived and read-only with no persistent collections", () => {
    assert.doesNotMatch(`${domain}\n${view}`, /storage\.(?:save|set)|localStorage|indexedDB\.(?:open|deleteDatabase)/);
    assert.doesNotMatch(`${domain}\n${view}`, /weeklyRankings|weeklyWinners|rankPosition|weeklyWinner/);
    assert.doesNotMatch(view, /innerHTML\s*=/);
    assert.doesNotMatch(html.match(/<section class="spotlight-view"[\s\S]*?<section class="rankings-view"/)?.[0] || "", /Save|Edit vote|Close Week|Reopen Week/);
});

test("has mobile, tablet, desktop and reduced-motion safeguards", () => {
    assert.match(css, /@media \(max-width: 70rem\)/);
    assert.match(css, /@media \(max-width: 44rem\)/);
    assert.match(css, /@media \(max-width: 32rem\)/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(css, /grid-template-columns: 1fr/);
    assert.match(css, /overflow-x: auto/);
});
