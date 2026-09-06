const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
const view = fs.readFileSync(path.join(projectRoot, "js", "analytics-view.js"), "utf8");
const app = fs.readFileSync(path.join(projectRoot, "js", "app.js"), "utf8");
const css = fs.readFileSync(path.join(projectRoot, "css", "analytics.css"), "utf8");
const analyticsSection = html.match(/<section class="analytics-view"[\s\S]*?<section class="season-view"/)?.[0] || "";

test("loads the Analytics UI after its core and before the application", () => {
    assert.ok(html.indexOf("js/analytics.js") < html.indexOf("js/analytics-view.js"));
    assert.ok(html.indexOf("js/analytics-view.js") < html.indexOf("js/app.js"));
    assert.ok(html.indexOf("css/analytics.css") >= 0);
    assert.match(html, /id="nav-analytics" href="#analytics"/);
    assert.match(app, /analyticsController = analyticsViewService\.createController/);
    assert.match(app, /activeView === "analytics"/);
});

test("exposes the approved global filters and defaults to official results", () => {
    assert.match(analyticsSection, /id="analytics-range"/);
    assert.match(analyticsSection, /value="4"/);
    assert.match(analyticsSection, /value="8"/);
    assert.match(analyticsSection, /value="12"/);
    assert.match(analyticsSection, /id="analytics-category"/);
    assert.match(analyticsSection, /id="analytics-gender"/);
    assert.match(analyticsSection, /id="analytics-group"/);
    assert.match(analyticsSection, /id="analytics-include-open" type="checkbox">/);
    assert.doesNotMatch(analyticsSection, /id="analytics-include-open"[^>]*checked/);
    assert.match(view, /includeOpen: elements\.includeOpen\.checked/);
});

test("provides five keyboard-operable Analytics sections", () => {
    assert.match(analyticsSection, /role="tablist" aria-label="Secciones de estadísticas"/);
    ["summary", "performance", "users", "skills", "activity"].forEach((section) => {
        assert.match(analyticsSection, new RegExp(`data-analytics-tab="${section}"`));
        assert.match(analyticsSection, new RegExp(`data-analytics-panel="${section}"`));
    });
    assert.match(view, /ArrowRight/);
    assert.match(view, /ArrowLeft/);
    assert.match(view, /event\.key === "Home"/);
    assert.match(view, /event\.key === "End"/);
});

test("covers summary, individual performance, P1/P2, skills and activity without a composite score", () => {
    assert.match(view, /Más victorias/);
    assert.match(view, /Más Top 3/);
    assert.match(view, /Más destacados/);
    assert.match(view, /Mayor mejora/);
    assert.match(view, /Más consistente/);
    assert.match(view, /Mayor desacuerdo puntual/);
    assert.match(view, /Destacados por ambos/);
    assert.match(analyticsSection, /Solo reason tags/);
    assert.match(analyticsSection, /role="img" aria-label="Actividad semanal"/);
    assert.doesNotMatch(`${analyticsSection}\n${view}`, /Overall Score|Season Score|Global Points|Performer of the Year|Best Group/i);
});

test("shows explicit insufficient-data states and a text equivalent for charts", () => {
    assert.match(view, /Datos insuficientes/);
    assert.match(view, /Se necesitan al menos/);
    assert.match(view, /Aún no hay resultados con estos filtros/);
    assert.match(view, /elements\.activityChart\.setAttribute\("aria-label", summary\)/);
    assert.match(view, /elements\.activityText\.textContent = summary/);
});

test("keeps the Analytics UI read-only and derived without persistent caches", () => {
    assert.doesNotMatch(view, /storage\.|localStorage|indexedDB|imageStorage|sessionStorage/);
    assert.doesNotMatch(view, /innerHTML\s*=/);
    assert.doesNotMatch(view, /cache|memo/i);
    assert.match(view, /sin caché/);
    assert.match(view, /analytics\.deriveMostPraisedSkills/);
    assert.match(view, /analytics\.deriveProfileTagAnalytics/);
});

test("protects the Analytics layout at phone, tablet and desktop widths", () => {
    assert.match(css, /@media \(max-width: 70rem\)/);
    assert.match(css, /@media \(max-width: 50rem\)/);
    assert.match(css, /@media \(max-width: 44rem\)/);
    assert.match(css, /@media \(max-width: 32rem\)/);
    assert.match(css, /overflow-x: auto/);
    assert.match(css, /grid-template-columns: 1fr/);
    assert.match(css, /prefers-reduced-motion: reduce/);
});
