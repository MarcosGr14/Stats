const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");

require(path.join(projectRoot, "js", "constants.js"));
require(path.join(projectRoot, "js", "data.js"));
require(path.join(projectRoot, "js", "storage.js"));

const { constants, data, storage } = globalThis.StatsV2;

class MemoryStorage {
    constructor(initial = {}) {
        this.values = new Map(Object.entries(initial));
    }

    getItem(key) {
        return this.values.has(key) ? this.values.get(key) : null;
    }

    setItem(key, value) {
        this.values.set(key, String(value));
    }

    removeItem(key) {
        this.values.delete(key);
    }
}

test("empty state uses the V2 normalized collections", () => {
    const state = data.createEmptyState("2026-08-30T00:00:00.000Z");

    assert.equal(state.schemaVersion, 2);
    assert.deepEqual(state.participants, []);
    assert.deepEqual(state.participantTagAssignments, []);
    assert.deepEqual(state.settings.voters, [
        { id: "p1", name: "P1" },
        { id: "p2", name: "P2" }
    ]);
    assert.equal(data.validateState(state).valid, true);
});

test("participant factory enforces neutral categories and supported gender", () => {
    const participant = data.createParticipant({
        id: "participant-ningning",
        name: " Ningning ",
        groupId: "group-aespa",
        gender: "female",
        categoryIds: ["vocal", "dance", "vocal"]
    }, "2026-08-30T00:00:00.000Z");

    assert.equal(participant.name, "Ningning");
    assert.deepEqual(participant.categoryIds, ["vocal", "dance"]);
    assert.equal(participant.archivedAt, null);
    assert.throws(
        () => data.createParticipant({ name: "Test", gender: "other", categoryIds: [] }),
        /unsupported value/
    );
    assert.throws(
        () => data.createParticipant({ name: "Test", gender: "male", categoryIds: ["solistaM"] }),
        /unsupported category/
    );
});

test("state validation rejects duplicate entity ids", () => {
    const state = data.createEmptyState("2026-08-30T00:00:00.000Z");
    state.groups = [
        { id: "group-a", name: "A" },
        { id: "group-a", name: "B" }
    ];

    const result = data.validateState(state);
    assert.equal(result.valid, false);
    assert.match(result.errors.join(" "), /duplicate id group-a/);
});

test("state validation rejects broken entity references", () => {
    const state = data.createEmptyState("2026-08-30T00:00:00.000Z");
    state.participants.push(data.createParticipant({
        id: "participant-a",
        name: "Performer",
        groupId: "missing-group",
        gender: "female",
        categoryIds: ["vocal"]
    }, "2026-08-30T00:00:00.000Z"));
    state.weeklyVotes.push(data.createWeeklyVote({
        id: "vote-a",
        weekId: "missing-week",
        participantId: "participant-a",
        userId: "p1",
        rating: "good",
        selectedTagIds: ["missing-tag"]
    }, "2026-08-30T00:00:00.000Z"));

    const result = data.validateState(state);
    assert.equal(result.valid, false);
    assert.match(result.errors.join(" "), /missing group/);
    assert.match(result.errors.join(" "), /missing week/);
    assert.match(result.errors.join(" "), /missing tag/);
});

test("initialization removes only the documented legacy key", () => {
    const memory = new MemoryStorage({
        [constants.LEGACY_STORAGE_KEY]: "legacy",
        "unrelated:key": "preserve-me"
    });

    const result = storage.initialize(memory, "2026-08-30T00:00:00.000Z");

    assert.equal(result.status, "initialized");
    assert.equal(result.legacyRemoved, true);
    assert.equal(memory.getItem(constants.LEGACY_STORAGE_KEY), null);
    assert.equal(memory.getItem("unrelated:key"), "preserve-me");
    assert.ok(memory.getItem(constants.STORAGE_KEY));
});

test("invalid V2 data is never overwritten during initialization", () => {
    const corruptValue = "{not-valid-json";
    const memory = new MemoryStorage({ [constants.STORAGE_KEY]: corruptValue });

    const result = storage.initialize(memory, "2026-08-30T00:00:00.000Z");

    assert.equal(result.status, "invalid");
    assert.equal(memory.getItem(constants.STORAGE_KEY), corruptValue);
    assert.equal(result.state.schemaVersion, 2);
});

test("save refuses invalid state", () => {
    const memory = new MemoryStorage();
    const invalidState = data.createEmptyState("2026-08-30T00:00:00.000Z");
    invalidState.schemaVersion = 999;

    assert.throws(() => storage.save(invalidState, memory), /Refusing to save invalid/);
    assert.equal(memory.getItem(constants.STORAGE_KEY), null);
});

test("HTML, CSS and JavaScript are separated", () => {
    const html = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");

    assert.doesNotMatch(html, /<style\b/i);
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
    assert.match(html, /css\/global\.css/);
    assert.match(html, /js\/storage\.js/);
});

test("application code avoids unsafe HTML insertion", () => {
    const javascript = fs.readdirSync(path.join(projectRoot, "js"))
        .filter((file) => file.endsWith(".js"))
        .map((file) => fs.readFileSync(path.join(projectRoot, "js", file), "utf8"))
        .join("\n");

    assert.doesNotMatch(javascript, /\.innerHTML\b/);
    assert.match(javascript, /\.textContent\b/);
});

test("foundation CSS includes keyboard, motion and small-screen safeguards", () => {
    const css = fs.readdirSync(path.join(projectRoot, "css"))
        .filter((file) => file.endsWith(".css"))
        .map((file) => fs.readFileSync(path.join(projectRoot, "css", file), "utf8"))
        .join("\n");

    assert.match(css, /:focus-visible/);
    assert.match(css, /prefers-reduced-motion/);
    assert.match(css, /@media\s*\(max-width:\s*32rem\)/);
});
