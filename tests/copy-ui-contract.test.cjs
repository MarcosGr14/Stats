const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(projectRoot, ...parts), "utf8");
const html = read("index.html");
const app = read("js", "app.js");
const weeklyView = read("js", "weekly-view.js");
const spotlightView = read("js", "spotlight-view.js");
const profileView = read("js", "profile-view.js");
const constants = read("js", "constants.js");
const tags = read("js", "tags.js");

test("uses concise Spanish copy across the primary views", () => {
    assert.match(html, />Participantes<\/h1>/);
    assert.match(html, />Votación semanal<\/h1>/);
    assert.match(html, /id="results-title">Resultados<\/h1>/);
    assert.match(html, /id="hall-title">Hall of Fame<\/h1>/);
    assert.match(html, />Clasificación de temporada<\/h1>/);
    assert.match(html, />Premios de temporada<\/h1>/);
    assert.match(app, /Administrar tags de/);
    assert.match(weeklyView, /Evaluar categorías/);
    assert.match(spotlightView, /Resultados oficiales/);
    assert.match(profileView, /Aún no hay victorias semanales/);
});

test("removes superseded English UI phrases from visible templates and renderers", () => {
    const visibleSources = `${html}\n${app}\n${weeklyView}\n${spotlightView}\n${profileView}`;
    [
        "Open current ISO week", "View participant", "View profile", "Save participant",
        "Not evaluated", "Official Results", "Live Preview", "Soloist / No group"
    ].forEach((phrase) => assert.doesNotMatch(visibleSources, new RegExp(phrase)));
});

test("keeps official tag names and internal compatibility identifiers unchanged", () => {
    assert.match(tags, /"Stable Live"/);
    assert.match(tags, /"Stage Presence"/);
    assert.match(constants, /WEEK_STATUSES: Object\.freeze\(\["OPEN", "CLOSED"\]\)/);
    assert.match(html, /value="female">Mujeres/);
    assert.match(html, /data-weekly-rating="standout"/);
    assert.match(read("js", "weekly.js"), /state\.weeklyVotes/);
});
