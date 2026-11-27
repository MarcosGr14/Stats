const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(projectRoot, "js", "theme.js"), "utf8");

function createThemeWindow(savedMode, prefersLight) {
    const listeners = {};
    const selectListeners = {};
    const select = {
        value: "",
        addEventListener: (name, listener) => { selectListeners[name] = listener; }
    };
    const meta = { content: "" };
    const documentListeners = {};
    const local = new Map(savedMode ? [["stats-v2-theme", savedMode]] : []);
    const media = {
        matches: prefersLight,
        addEventListener: (name, listener) => { listeners[name] = listener; }
    };
    const window = {
        document: {
            documentElement: { dataset: {} },
            querySelector: () => meta,
            getElementById: (id) => id === "theme-select" ? select : null,
            addEventListener: (name, listener) => { documentListeners[name] = listener; }
        },
        localStorage: {
            getItem: (key) => local.get(key) || null,
            setItem: (key, value) => local.set(key, value)
        },
        matchMedia: () => media
    };
    vm.runInNewContext(source, window);
    documentListeners.DOMContentLoaded();
    return { window, media, listeners, meta, select, selectListeners, local };
}

test("automatic theme follows the device and updates the browser theme color", () => {
    const state = createThemeWindow("auto", true);
    assert.equal(state.window.document.documentElement.dataset.theme, "light");
    assert.equal(state.meta.content, "#F4F2EC");
    assert.equal(state.select.value, "auto");

    state.media.matches = false;
    state.listeners.change();
    assert.equal(state.window.document.documentElement.dataset.theme, "dark");
    assert.equal(state.meta.content, "#0E0E12");
});

test("manual theme choices persist independently from application data", () => {
    const state = createThemeWindow("auto", false);
    state.select.value = "light";
    state.selectListeners.change();
    assert.equal(state.window.document.documentElement.dataset.theme, "light");
    assert.equal(state.local.get("stats-v2-theme"), "light");
    state.media.matches = false;
    state.listeners.change();
    assert.equal(state.window.document.documentElement.dataset.theme, "light");
});

test("theme selector and design styles stay part of the real application", () => {
    const html = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
    const styles = fs.readFileSync(path.join(projectRoot, "css", "tinta-volt.css"), "utf8");
    const tokens = fs.readFileSync(path.join(projectRoot, "css", "global.css"), "utf8");
    assert.match(html, /id="theme-select"/);
    assert.match(html, /<option value="auto">Automático<\/option>/);
    assert.ok(html.indexOf("css/tinta-volt.css") > html.indexOf("css/product.css"));
    assert.match(tokens, /:root\[data-theme="light"\]/);
    assert.match(styles, /prefers-reduced-motion: reduce/);
});
