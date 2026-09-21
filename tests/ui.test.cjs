const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const nodes = new Map();
globalThis.document = {
    getElementById(id) { return nodes.get(id) || null; },
    createElement(tagName) {
        return { tagName: tagName.toUpperCase(), className: "", textContent: "" };
    }
};
require(path.join(projectRoot, "js", "constants.js"));
require(path.join(projectRoot, "js", "ui.js"));

const ui = globalThis.StatsV2.ui;

test("provides shared safe DOM helpers", () => {
    const marker = {};
    nodes.set("marker", marker);
    assert.equal(ui.byId("marker"), marker);
    const node = ui.element("strong", "metric", 12);
    assert.deepEqual(node, { tagName: "STRONG", className: "metric", textContent: "12" });
});

test("normalizes initials and approved labels centrally", () => {
    assert.equal(ui.initials("Kim Minji"), "KM");
    assert.equal(ui.initials("Lisa"), "LI");
    assert.equal(ui.categoryLabel("dance"), "BAILE");
    assert.equal(ui.genderLabel("female"), "Mujeres");
    assert.equal(ui.genderLabel("male", "singular"), "Hombre");
    assert.equal(ui.ratingLabel("standout"), "Destacado");
    assert.equal(ui.ratingLabel(null), "Sin evaluar");
});

test("formats decimal output for Panama without changing values", () => {
    assert.match(ui.decimal(12.345, 2), /^12[.,]35$/);
    assert.match(ui.decimal(7), /^7[.,]0$/);
});
