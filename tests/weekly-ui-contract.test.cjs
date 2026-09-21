const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
const view = fs.readFileSync(path.join(projectRoot, "js", "weekly-view.js"), "utf8");
const css = fs.readFileSync(path.join(projectRoot, "css", "weekly.css"), "utf8");
const app = fs.readFileSync(path.join(projectRoot, "js", "app.js"), "utf8");

test("exposes Weekly navigation and explicit week creation without automatic opening", () => {
    assert.match(html, /id="nav-weekly" href="#weekly"/);
    assert.match(html, /id="open-current-week"[^>]*>Abrir semana actual/);
    assert.match(html, /id="new-week"[^>]*>Nueva semana/);
    assert.doesNotMatch(app, /openCurrentIsoWeek\(/);
    assert.match(view, /elements\.openWeek\.addEventListener\("click", openCurrentWeek\)/);
    assert.match(view, /elements\.newWeek\.addEventListener\("click", openNextWeek\)/);
    assert.match(view, /weekly\.openNextIsoWeek/);
});

test("weekly voting controls communicate category, user, rating, removal and reopen accessibly", () => {
    assert.match(html, /id="weekly-user-switch" role="group" aria-label="Votante actual"/);
    assert.equal((html.match(/data-weekly-rating=/g) || []).length, 4);
    assert.equal((html.match(/aria-pressed="false"/g) || []).length >= 4, true);
    assert.match(html, /Quitar evaluación/);
    assert.match(html, /role="alert" aria-live="assertive"/);
    assert.match(view, /week\.status !== "OPEN"/);
    assert.match(html, /id="weekly-category-tabs" role="tablist"/);
    assert.match(html, /id="reopen-current-week"[^>]*>Reabrir semana/);
    assert.match(html, /id="reopen-week-dialog"/);
    assert.match(view, /weekly\.reopenWeek/);
    assert.match(view, /data\.weeklyCategoryId|weeklyCategoryId/);
});

test("weekly reasons and notes have the approved UI limits", () => {
    assert.match(html, /Opcional · Máximo 3/);
    assert.match(html, /no cambian los tags del perfil/);
    assert.match(html, /id="weekly-note" maxlength="500"/);
    assert.match(view, /MAX_WEEKLY_REASON_TAGS/);
    assert.match(view, /reasonPriority/);
    assert.doesNotMatch(view, /\.innerHTML\s*=/);
});

test("legacy category conversion is explicit and preserves unresolved votes in the UI", () => {
    assert.match(html, /id="weekly-legacy-warning"/);
    assert.match(html, /id="assign-legacy-category"/);
    assert.match(view, /findLegacyVote/);
    assert.match(view, /assignLegacyVoteCategory/);
});

test("weekly assets load before the app while Rankings uses accumulated Season standings", () => {
    assert.ok(html.indexOf("js/weekly-migration.js") < html.indexOf("js/app.js"));
    assert.ok(html.indexOf("js/weekly.js") < html.indexOf("js/app.js"));
    assert.ok(html.indexOf("js/weekly-view.js") < html.indexOf("js/app.js"));
    assert.doesNotMatch(html, /js\/rankings\.js|Sin ranking/);
    assert.match(html, /id="rankings-title">Clasificación de temporada<\/h1>/);
    assert.match(app, /seasonController\?\.activate\("rankings"\)/);
});

test("weekly layout contains mobile, tablet and desktop safeguards", () => {
    assert.match(css, /@media \(max-width: 70rem\)/);
    assert.match(css, /@media \(max-width: 44rem\)/);
    assert.match(css, /@media \(max-width: 32rem\)/);
    assert.match(css, /grid-template-columns: 1fr/);
    assert.match(css, /width: min\(54rem, calc\(100% - 2rem\)\)/);
});
