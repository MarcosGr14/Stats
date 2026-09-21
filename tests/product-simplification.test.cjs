const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const html = read("index.html");
const app = read("js", "app.js");
const productView = read("js", "product-view.js");
const css = read("css", "product.css");

test("exposes only the five requested primary views", () => {
    const navigation = html.match(/<nav class="primary-nav"[\s\S]*?<\/nav>/)?.[0] || "";
    assert.equal((navigation.match(/<a /g) || []).length, 5);
    ["Participantes", "Votación", "Resultados", "Hall of Fame", "Datos"]
        .forEach((label) => assert.match(navigation, new RegExp(`>${label}<`)));
    ["nav-spotlight", "nav-rankings", "nav-analytics", "nav-season", "nav-data-safety"]
        .forEach((id) => assert.doesNotMatch(navigation, new RegExp(`id="${id}"`)));
});

test("combines weekly and season results under two tabs", () => {
    assert.match(html, /data-results-tab="week">Semana/);
    assert.match(html, /data-results-tab="season">Temporada/);
    assert.match(productView, /activateSpotlight\(\)/);
    assert.match(productView, /activateSeason\(\)/);
    assert.match(app, /seasonController\.activate\("season"\)/);
    assert.match(app, /seasonController\.activate\("rankings"\)/);
});

test("provides explicit season closure and a frozen Hall of Fame", () => {
    assert.match(html, /id="open-close-season"[^>]*>Cerrar temporada/);
    assert.match(html, /Los resultados actuales pasarán al Hall of Fame y comenzará una nueva temporada\./);
    assert.match(html, /id="hall-of-fame"/);
    assert.match(productView, /seasons\.closeCurrentSeason/);
    assert.match(productView, /resultsSnapshot\.grandWinners/);
    assert.match(productView, /resultsSnapshot\.categoryWinners/);
    assert.match(productView, /resultsSnapshot\.highlights/);
});

test("keeps profile analytics contextual and Data simple", () => {
    assert.match(html, /id="profile-wins"/);
    assert.match(html, /id="profile-top-three"/);
    assert.match(html, /id="profile-standouts"/);
    const dataSection = html.match(/<section class="data-safety-view"[\s\S]*?<dialog class="season-breakdown-dialog"/)?.[0] || "";
    assert.match(dataSection, />Exportar backup</);
    assert.match(dataSection, />Importar backup</);
    assert.match(dataSection, />Borrar todos los datos</);
    assert.doesNotMatch(dataSection, /IndexedDB|localStorage|schema|rollback|manifest|checksum/i);
});

test("uses a five-item mobile bottom navigation", () => {
    assert.match(css, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
    assert.match(css, /position: fixed/);
    assert.match(css, /bottom: 0\.65rem/);
});
