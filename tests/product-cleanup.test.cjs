const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(projectRoot, ...parts), "utf8");
const html = read("index.html");
const app = read("js", "app.js");
const appCss = read("css", "app.css");
const seasonView = read("js", "season-view.js");
const weeklyView = read("js", "weekly-view.js");

test("keeps a focused six-destination navigation and contextual profiles and tags", () => {
    const navigation = html.match(/<nav class="primary-nav"[\s\S]*?<\/nav>/)?.[0] || "";
    assert.equal((navigation.match(/<a /g) || []).length, 6);
    ["participants", "weekly", "spotlight", "rankings", "analytics", "season"].forEach((id) => {
        assert.match(navigation, new RegExp(`href="#${id}"`));
    });
    assert.doesNotMatch(navigation, /profile|tags/i);
    assert.match(app, /#profile\?participant=/);
});

test("keeps Participants as the deterministic default view", () => {
    assert.match(html, /id="participants"[^>]*>/);
    assert.doesNotMatch(html.match(/id="participants"[^>]*>/)?.[0] || "", /hidden/);
    assert.match(html, /href="#participants" aria-current="page"/);
    assert.match(app, /return "participants";/);
});

test("loads shared UI helpers before every renderer", () => {
    const uiIndex = html.indexOf("js/ui.js");
    assert.ok(html.indexOf("js/constants.js") < uiIndex);
    ["weekly-view.js", "spotlight-view.js", "profile-view.js", "analytics-view.js", "season-view.js", "app.js"]
        .forEach((asset) => assert.ok(uiIndex < html.indexOf(`js/${asset}`)));
});

test("removes the obsolete provisional Rankings directory and its dead CSS", () => {
    assert.equal(fs.existsSync(path.join(projectRoot, "js", "rankings.js")), false);
    assert.doesNotMatch(html, /js\/rankings\.js|Sin ranking|unranked-badge|ranking-toolbar|top-three-locked/);
    assert.doesNotMatch(app, /rankingsService|renderRankings|rankingCategory|scoreProvider: null/);
    assert.doesNotMatch(appCss, /\.rankings-view|\.ranking-toolbar|\.ranking-row|\.unranked-badge|\.top-three-locked/);
});

test("keeps Rankings read-only and derived from the Season source", () => {
    assert.match(html, /id="rankings-title">Clasificación de temporada<\/h1>/);
    assert.match(seasonView, /createViewModel\(getState\(\)/);
    assert.match(seasonView, /activeView === "rankings"/);
    assert.doesNotMatch(seasonView, /localStorage|sessionStorage|indexedDB|storage\.(?:save|set)/);
});

test("removes obsolete visible English copy without renaming domain identifiers", () => {
    const visibleSources = `${html}\n${weeklyView}\n${seasonView}`;
    ["Unavailable", "0 evaluated", "Grand Score", "Standout rate", "Vista previa LIVE"]
        .forEach((copy) => assert.doesNotMatch(visibleSources, new RegExp(copy)));
    assert.match(read("js", "season.js"), /grandScore/);
    assert.match(read("js", "weekly.js"), /standoutCount/);
});

test("does not introduce a schema, migration or persistent cache in Product Cleanup", () => {
    assert.doesNotMatch(read("js", "ui.js"), /localStorage|sessionStorage|indexedDB|storage/);
    assert.doesNotMatch(seasonView, /cache|memo/i);
    assert.match(read("js", "constants.js"), /APP_VERSION: "2\.8\.5-product-cleanup"/);
    assert.doesNotMatch(html, /Fase 9|phase 9/i);
});
