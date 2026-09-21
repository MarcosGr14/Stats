const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const html = read("index.html");
const view = read("js", "backup-view.js");
const app = read("js", "app.js");
const css = read("css", "backup.css");

test("loads backup services before the application and exposes Data Safety", () => {
    assert.ok(html.indexOf("js/image-storage.js") < html.indexOf("js/backup.js"));
    assert.ok(html.indexOf("js/backup.js") < html.indexOf("js/backup-view.js"));
    assert.ok(html.indexOf("js/backup-view.js") < html.indexOf("js/app.js"));
    assert.match(html, /id="nav-data" href="#data"/);
    assert.match(html, /id="data-safety"/);
});

test("provides export, import preview, strong reset and recovery controls", () => {
    ["export-backup", "import-backup-file", "backup-preview-dialog", "reset-data-dialog", "recovery-mode", "download-raw-state"]
        .forEach((id) => assert.match(html, new RegExp(`id="${id}"`)));
    assert.match(html, /escribe <strong>BORRAR<\/strong>/);
    assert.match(view, /value !== "BORRAR"/);
    assert.match(view, /stats-pre-restore-/);
    assert.match(view, /stats-recovery-raw-/);
    assert.match(view, /Conservamos el contenido original sin cambios/);
});

test("keeps files keyboard-labelled and reports errors accessibly", () => {
    assert.match(html, /for="import-backup-file"/);
    assert.match(html, /for="recovery-import-file"/);
    assert.match(html, /id="restore-backup-error" role="alert" aria-live="assertive"/);
    assert.match(html, /id="recovery-error" role="alert" aria-live="assertive"/);
    assert.match(view, /requestAnimationFrame\(\(\) => elements\.confirmRestore\.focus\(\)\)/);
});

test("enters Recovery Mode before normal controllers when stored state is corrupt", () => {
    assert.match(app, /if \(result\.status === "invalid"\)[\s\S]*?backupController\.activateRecovery\(result\);[\s\S]*?return;/);
    assert.match(view, /elements\.shell\.hidden = true/);
    assert.match(view, /recoveryRaw = localStorage\.getItem\(constants\.STORAGE_KEY\)/);
});

test("protects Data Safety and Recovery layouts at phone, tablet and desktop widths", () => {
    assert.match(css, /width: min\(74rem/);
    assert.match(css, /@media \(max-width: 48rem\)/);
    assert.match(css, /@media \(max-width: 32rem\)/);
    assert.match(css, /\.recovery-mode/);
    assert.match(css, /\.site-shell\[hidden\]/);
});
