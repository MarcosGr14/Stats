const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(projectRoot, ...parts), "utf8");
const html = read("index.html");
const domain = read("js", "season.js");
const view = read("js", "season-view.js");
const app = read("js", "app.js");
const css = read("css", "season.css");
const seasonSection = html.match(/<section class="season-view"[\s\S]*?<section class="season-rankings-view"/)?.[0] || "";
const rankingsSection = html.match(/<section class="season-rankings-view"[\s\S]*?<dialog class="season-breakdown-dialog"/)?.[0] || "";

test("loads the shared Season source before its view and the application", () => {
    assert.ok(html.indexOf("js/analytics.js") < html.indexOf("js/season.js"));
    assert.ok(html.indexOf("js/season.js") < html.indexOf("js/season-view.js"));
    assert.ok(html.indexOf("js/season-view.js") < html.indexOf("js/app.js"));
    assert.match(html, /js\/app\.js\?v=2\.9\.0/);
    assert.match(html, /id="nav-rankings" href="#rankings"/);
    assert.match(html, /id="nav-season" href="#season"/);
    assert.match(app, /seasonController = seasonViewService\.createController/);
    assert.match(app, /seasonController\?\.activate\("rankings"\)/);
    assert.match(app, /seasonController\?\.activate\("season"\)/);
});

test("separates accumulated standings from Season awards without duplicating them", () => {
    assert.match(seasonSection, /id="season-grand-grid"/);
    assert.match(seasonSection, /id="season-category-winners"/);
    assert.doesNotMatch(seasonSection, /id="season-podium"|id="season-eligible-body"|data-season-category/);
    assert.match(rankingsSection, /id="season-podium"/);
    assert.match(rankingsSection, /id="season-eligible-body"/);
    assert.match(rankingsSection, /id="season-provisional-list"/);
    assert.doesNotMatch(rankingsSection, /id="season-grand-grid"|id="season-category-winners"/);
    assert.doesNotMatch(html, /data-season-section|data-season-panel|Sin ranking|top-three-locked/);
});

test("exposes six keyboard-operable category tabs and separate genders in Rankings", () => {
    ["vocal", "rap", "dance", "stage", "visual", "all-rounder"].forEach((categoryId) => {
        assert.match(rankingsSection, new RegExp(`data-season-category="${categoryId}"`));
    });
    assert.match(rankingsSection, /data-season-gender="female"/);
    assert.match(rankingsSection, /data-season-gender="male"/);
    assert.match(view, /event\.key === "ArrowRight"/);
    assert.match(view, /event\.key === "ArrowLeft"/);
    assert.match(view, /event\.key === "Home"/);
    assert.match(view, /event\.key === "End"/);
});

test("keeps official CLOSED results as the explicit default in both views", () => {
    assert.match(seasonSection, /id="season-include-open" type="checkbox">/);
    assert.match(rankingsSection, /id="rankings-include-open" type="checkbox">/);
    assert.doesNotMatch(`${seasonSection}\n${rankingsSection}`, /include-open"[^>]*checked/);
    assert.match(view, /let includeOpen = false/);
    assert.match(view, /elements\.seasonIncludeOpen\.checked = includeOpen/);
    assert.match(view, /elements\.rankingsIncludeOpen\.checked = includeOpen/);
    assert.match(html, /Vista previa en vivo · Provisional/);
});

test("keeps awards, ties, eligible standings and provisionals explainable", () => {
    assert.match(view, /Ganadora de la temporada/);
    assert.match(view, /Ganador de la temporada/);
    assert.match(view, /Ganadoras conjuntas|Ganadores conjuntos/);
    assert.match(rankingsSection, /Cómo se calcula/);
    assert.match(rankingsSection, /40% rendimiento promedio/);
    assert.match(view, /Rendimiento promedio/);
    assert.match(view, /Tasa de victorias/);
    assert.match(view, /Tasa de Top 3/);
    assert.match(view, /Tasa de destacados/);
    assert.match(view, /95% · Mejor categoría/);
    assert.match(view, /5% · Segunda categoría/);
    assert.doesNotMatch(`${seasonSection}\n${rankingsSection}\n${domain}\n${view}`, /Best Group|sumAllCategories|overallScore|seasonScore\s*[:=].*reduce/i);
});

test("uses one contextual breakdown dialog and safe DOM construction", () => {
    assert.equal((html.match(/id="season-breakdown-dialog"/g) || []).length, 1);
    assert.match(html, /aria-label="Cerrar desglose"/);
    assert.match(view, /`#\$\{entry\.rank\}`/);
    assert.match(view, /Empate real/);
    assert.match(view, /Ver desglose/);
    assert.doesNotMatch(`${domain}\n${view}`, /localStorage|sessionStorage|storage\.(?:save|set)|indexedDB\.(?:open|deleteDatabase)/);
    assert.doesNotMatch(view, /innerHTML\s*=/);
    assert.match(view, /image\.alt = `Foto de/);
});

test("protects awards, standings and breakdowns at required widths", () => {
    assert.match(css, /\.season-view,\s*\.season-rankings-view/);
    assert.match(css, /@media \(max-width: 70rem\)/);
    assert.match(css, /@media \(max-width: 50rem\)/);
    assert.match(css, /@media \(max-width: 44rem\)/);
    assert.match(css, /@media \(max-width: 32rem\)/);
    assert.match(css, /overflow-x: auto/);
    assert.match(css, /grid-template-columns: 1fr/);
    assert.match(css, /prefers-reduced-motion: reduce/);
});
