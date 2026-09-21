const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
const domain = fs.readFileSync(path.join(projectRoot, "js", "profile-history.js"), "utf8");
const view = fs.readFileSync(path.join(projectRoot, "js", "profile-view.js"), "utf8");
const app = fs.readFileSync(path.join(projectRoot, "js", "app.js"), "utf8");
const weeklyView = fs.readFileSync(path.join(projectRoot, "js", "weekly-view.js"), "utf8");
const spotlightView = fs.readFileSync(path.join(projectRoot, "js", "spotlight-view.js"), "utf8");
const seasonView = fs.readFileSync(path.join(projectRoot, "js", "season-view.js"), "utf8");
const css = fs.readFileSync(path.join(projectRoot, "css", "profile.css"), "utf8");

test("loads profile derivation after Spotlight and profile UI before the app", () => {
    assert.ok(html.indexOf("js/spotlight.js") < html.indexOf("js/profile-history.js"));
    assert.ok(html.indexOf("js/profile-history.js") < html.indexOf("js/profile-view.js"));
    assert.ok(html.indexOf("js/profile-view.js") < html.indexOf("js/app.js"));
    assert.match(app, /profileViewService\.createController/);
});

test("exposes a complete participant dossier with reusable edit and tag actions", () => {
    assert.match(html, /id="profile" aria-labelledby="profile-name"/);
    assert.match(html, /id="profile-photo-image"/);
    assert.match(html, /id="profile-status"/);
    assert.match(html, /id="profile-tag-groups"/);
    assert.match(html, /id="profile-category-grid"/);
    assert.match(html, /id="profile-win-list"/);
    assert.match(html, /id="profile-history-list"/);
    assert.match(app, /editParticipant: openParticipantDialog/);
    assert.match(app, /manageTags: openTagDialog/);
});

test("routes Participant Manager, Rankings, Weekly and Spotlight records to the profile URL", () => {
    assert.match(app, /actionButton\("Ver perfil", "profile"/);
    assert.match(seasonView, /dataset\.seasonParticipantId/);
    assert.match(weeklyView, /dataset\.weeklyProfileId/);
    assert.match(spotlightView, /dataset\.spotlightParticipantId/);
    assert.match(app, /#profile\?participant=/);
    assert.match(app, /profileIdFromLocation/);
    assert.match(view, /elements\.back\.addEventListener\("click", goBack\)/);
});

test("provides accessible category-specific trends and textual gaps", () => {
    assert.match(html, /id="profile-trend-tabs" role="tablist" aria-label="Categoría de la evolución"/);
    assert.match(html, /id="profile-trend-chart" role="img" aria-label="Evolución"/);
    assert.match(view, /sin evaluar/);
    assert.match(view, /weeklyPoints === 0/);
    assert.match(view, /ArrowRight/);
    assert.match(view, /ArrowLeft/);
});

test("keeps profile metrics derived and avoids Overall or global scores", () => {
    assert.doesNotMatch(`${domain}\n${view}`, /storage\.(?:save|set)|localStorage|participantHistory\s*:|participantStats\s*:/);
    assert.doesNotMatch(`${domain}\n${view}\n${html.match(/<section class="profile-view"[\s\S]*?<section class="weekly-view"/)?.[0] || ""}`, /Overall Score|Season Score|Global Points|Performer of the Year/);
    assert.doesNotMatch(view, /innerHTML\s*=/);
    assert.match(domain, /spotlight\.deriveSpotlightRanking/);
});

test("protects profile layouts at phone, tablet and desktop breakpoints", () => {
    assert.match(css, /@media \(max-width: 70rem\)/);
    assert.match(css, /@media \(max-width: 50rem\)/);
    assert.match(css, /@media \(max-width: 44rem\)/);
    assert.match(css, /@media \(max-width: 32rem\)/);
    assert.match(css, /overflow-x: auto/);
    assert.match(css, /grid-template-columns: 1fr/);
});
