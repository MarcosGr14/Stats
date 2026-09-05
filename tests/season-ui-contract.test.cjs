const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
const domain = fs.readFileSync(path.join(projectRoot, "js", "season.js"), "utf8");
const view = fs.readFileSync(path.join(projectRoot, "js", "season-view.js"), "utf8");
const app = fs.readFileSync(path.join(projectRoot, "js", "app.js"), "utf8");
const css = fs.readFileSync(path.join(projectRoot, "css", "season.css"), "utf8");
const seasonSection = html.match(/<section class="season-view"[\s\S]*?<section class="rankings-view"/)?.[0] || "";

test("loads Season Standings after Analytics and its view before the application", () => {
    assert.ok(html.indexOf("js/analytics.js") < html.indexOf("js/season.js"));
    assert.ok(html.indexOf("js/season.js") < html.indexOf("js/season-view.js"));
    assert.ok(html.indexOf("js/season-view.js") < html.indexOf("js/app.js"));
    assert.match(html, /js\/app\.js\?v=2\.8\.0/);
    assert.ok(html.indexOf("css/season.css") >= 0);
    assert.match(html, /id="nav-season" href="#season"/);
    assert.match(app, /seasonController = seasonViewService\.createController/);
    assert.match(app, /activeView === "season"/);
});

test("provides overview and standings as accessible keyboard tabs", () => {
    assert.match(seasonSection, /role="tablist" aria-label="Vistas de temporada"/);
    assert.match(seasonSection, /data-season-section="overview"/);
    assert.match(seasonSection, /data-season-section="standings"/);
    assert.match(seasonSection, /data-season-panel="overview"/);
    assert.match(seasonSection, /data-season-panel="standings"/);
    assert.match(view, /event\.key === "ArrowRight"/);
    assert.match(view, /event\.key === "ArrowLeft"/);
    assert.match(view, /event\.key === "Home"/);
    assert.match(view, /event\.key === "End"/);
});

test("exposes six category tabs, separate genders and official CLOSED default", () => {
    ["vocal", "rap", "dance", "stage", "visual", "all-rounder"].forEach((categoryId) => {
        assert.match(seasonSection, new RegExp(`data-season-category="${categoryId}"`));
    });
    assert.match(seasonSection, /data-season-gender="female"/);
    assert.match(seasonSection, /data-season-gender="male"/);
    assert.match(seasonSection, /id="season-include-open" type="checkbox">/);
    assert.doesNotMatch(seasonSection, /id="season-include-open"[^>]*checked/);
    assert.match(view, /includeOpen: elements\.includeOpen\.checked/);
    assert.match(seasonSection, /Vista previa LIVE · Provisional/);
});

test("contains Grand Winners, twelve category winners, Top 3 and separated standings", () => {
    assert.match(seasonSection, /id="season-grand-grid"/);
    assert.match(seasonSection, /id="season-category-winners"/);
    assert.match(seasonSection, /id="season-podium"/);
    assert.match(seasonSection, /id="season-eligible-body"/);
    assert.match(seasonSection, /id="season-provisional-list"/);
    assert.match(view, /Ganadora de la temporada/);
    assert.match(view, /Ganador de la temporada/);
    assert.match(view, /Ganadoras conjuntas|Ganadores conjuntos/);
});

test("makes Season and Grand scores explainable without hidden composite metrics", () => {
    assert.match(seasonSection, /Cómo se calcula/);
    assert.match(seasonSection, /40% rendimiento promedio/);
    assert.match(view, /Rendimiento promedio/);
    assert.match(view, /Tasa de victorias/);
    assert.match(view, /Tasa de Top 3/);
    assert.match(view, /Tasa de Standouts/);
    assert.match(view, /95% · Mejor categoría/);
    assert.match(view, /5% · Segunda categoría/);
    assert.doesNotMatch(`${seasonSection}\n${domain}\n${view}`, /Best Group|sumAllCategories|overallScore|seasonScore\s*[:=].*reduce/i);
});

test("uses safe DOM construction and never persists derived standings", () => {
    assert.doesNotMatch(`${domain}\n${view}`, /localStorage|sessionStorage|storage\.(?:save|set)|indexedDB\.(?:open|deleteDatabase)/);
    assert.doesNotMatch(view, /innerHTML\s*=/);
    assert.doesNotMatch(domain, /participant\.seasonScore|participant\.grandScore|state\.seasonStandings/);
    assert.match(domain, /analytics\.deriveParticipantCategoryMetrics/);
    assert.match(view, /image\.alt = `Foto de/);
});

test("provides semantic breakdown controls and textual ranks", () => {
    assert.match(seasonSection, /<dialog class="season-breakdown-dialog"/);
    assert.match(seasonSection, /aria-label="Cerrar desglose"/);
    assert.match(view, /`#\$\{entry\.rank\}`/);
    assert.match(view, /Empate real/);
    assert.match(view, /Ver desglose/);
});

test("protects standings, podium and breakdowns at required widths", () => {
    assert.match(css, /@media \(max-width: 70rem\)/);
    assert.match(css, /@media \(max-width: 50rem\)/);
    assert.match(css, /@media \(max-width: 44rem\)/);
    assert.match(css, /@media \(max-width: 32rem\)/);
    assert.match(css, /overflow-x: auto/);
    assert.match(css, /grid-template-columns: 1fr/);
    assert.match(css, /prefers-reduced-motion: reduce/);
});
