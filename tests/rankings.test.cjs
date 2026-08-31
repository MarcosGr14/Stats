const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const projectRoot = path.resolve(__dirname, "..");
require(path.join(projectRoot, "js", "constants.js"));
require(path.join(projectRoot, "js", "data.js"));
require(path.join(projectRoot, "js", "storage.js"));
require(path.join(projectRoot, "js", "rankings.js"));

const { data, rankings, storage } = globalThis.StatsV2;
const timestamp = "2026-08-31T00:00:00.000Z";

function fixtureState() {
    const state = data.createEmptyState(timestamp);
    state.groups.push(
        data.createGroup({ id: "group-aespa", name: "aespa" }, timestamp),
        data.createGroup({ id: "group-xg", name: "XG" }, timestamp)
    );
    state.participants.push(
        data.createParticipant({
            id: "participant-ningning",
            name: "Ningning",
            groupId: "group-aespa",
            gender: "female",
            imageId: "image-ningning",
            categoryIds: ["vocal", "dance"],
            createdAt: "2026-08-01T00:00:00.000Z"
        }, "2026-08-01T00:00:00.000Z"),
        data.createParticipant({
            id: "participant-jurin",
            name: "Jurin",
            groupId: "group-xg",
            gender: "female",
            imageId: "image-jurin",
            categoryIds: ["rap", "dance", "stage"],
            createdAt: "2026-08-02T00:00:00.000Z"
        }, "2026-08-02T00:00:00.000Z"),
        data.createParticipant({
            id: "participant-mark",
            name: "Mark",
            groupId: null,
            gender: "male",
            imageId: null,
            categoryIds: ["rap", "stage", "visual", "all-rounder"],
            createdAt: "2026-08-03T00:00:00.000Z"
        }, "2026-08-03T00:00:00.000Z"),
        data.createParticipant({
            id: "participant-legacy",
            name: "Legacy Vocal",
            groupId: null,
            gender: "female",
            imageId: "image-legacy",
            categoryIds: ["vocal", "all-rounder"],
            archivedAt: "2026-08-10T00:00:00.000Z",
            createdAt: "2026-07-01T00:00:00.000Z"
        }, "2026-08-10T00:00:00.000Z")
    );
    state.tags.push(
        data.createTag({ id: "tag-stage-presence", name: "Stage Presence", categoryId: "stage", type: "strength", predefined: true }, timestamp),
        data.createTag({ id: "tag-flow", name: "Flow", categoryId: "rap", type: "strength", predefined: true }, timestamp)
    );
    state.participantTagAssignments.push(
        data.createTagAssignment({ id: "assignment-jurin-stage", participantId: "participant-jurin", tagId: "tag-stage-presence" }, timestamp),
        data.createTagAssignment({ id: "assignment-mark-stage", participantId: "participant-mark", tagId: "tag-stage-presence", removedAt: "2026-08-20T00:00:00.000Z" }, timestamp),
        data.createTagAssignment({ id: "assignment-mark-flow", participantId: "participant-mark", tagId: "tag-flow" }, timestamp)
    );
    return state;
}

function names(result) {
    return result.items.map((item) => item.participant.name);
}

test("derives each category from participant categoryIds without duplicating storage records", () => {
    const state = fixtureState();
    assert.deepEqual(names(rankings.deriveRanking(state, { categoryId: "vocal" })), ["Ningning"]);
    assert.deepEqual(names(rankings.deriveRanking(state, { categoryId: "rap" })), ["Jurin", "Mark"]);
    assert.deepEqual(names(rankings.deriveRanking(state, { categoryId: "dance" })), ["Jurin", "Ningning"]);
    assert.deepEqual(names(rankings.deriveRanking(state, { categoryId: "stage" })), ["Jurin", "Mark"]);
    assert.deepEqual(names(rankings.deriveRanking(state, { categoryId: "visual" })), ["Mark"]);
    assert.deepEqual(names(rankings.deriveRanking(state, { categoryId: "all-rounder" })), ["Mark"]);
    assert.equal(state.participants.length, 4);
});

test("excludes archived participants by default and can include them explicitly", () => {
    const state = fixtureState();
    assert.deepEqual(names(rankings.deriveRanking(state, { categoryId: "vocal" })), ["Ningning"]);
    assert.deepEqual(
        names(rankings.deriveRanking(state, { categoryId: "vocal", includeArchived: true })),
        ["Legacy Vocal", "Ningning"]
    );
});

test("filters category directories by All, Male and Female", () => {
    const state = fixtureState();
    assert.deepEqual(names(rankings.deriveRanking(state, { categoryId: "rap", gender: "all" })), ["Jurin", "Mark"]);
    assert.deepEqual(names(rankings.deriveRanking(state, { categoryId: "rap", gender: "male" })), ["Mark"]);
    assert.deepEqual(names(rankings.deriveRanking(state, { categoryId: "rap", gender: "female" })), ["Jurin"]);
});

test("filters by groupId and supports soloists with a null group", () => {
    const state = fixtureState();
    assert.deepEqual(names(rankings.deriveRanking(state, { categoryId: "rap", groupId: "group-xg" })), ["Jurin"]);
    assert.deepEqual(names(rankings.deriveRanking(state, { categoryId: "rap", groupId: "soloist" })), ["Mark"]);
});

test("filters by active tags and ignores removed assignments", () => {
    const state = fixtureState();
    assert.deepEqual(names(rankings.deriveRanking(state, { categoryId: "stage", tagId: "tag-stage-presence" })), ["Jurin"]);
    assert.deepEqual(names(rankings.deriveRanking(state, { categoryId: "rap", tagId: "tag-flow" })), ["Mark"]);
});

test("combines category, gender, group, tag and query filters", () => {
    const state = fixtureState();
    const result = rankings.deriveRanking(state, {
        categoryId: "stage",
        gender: "female",
        groupId: "group-xg",
        tagId: "tag-stage-presence",
        query: "  JURIN  "
    });
    assert.deepEqual(names(result), ["Jurin"]);
});

test("searches participant, group and active tag names case-insensitively", () => {
    const state = fixtureState();
    assert.deepEqual(names(rankings.deriveRanking(state, { categoryId: "vocal", query: "NING" })), ["Ningning"]);
    assert.deepEqual(names(rankings.deriveRanking(state, { categoryId: "dance", query: "AeSpA" })), ["Ningning"]);
    assert.deepEqual(names(rankings.deriveRanking(state, { categoryId: "rap", query: "FLOW" })), ["Mark"]);
});

test("supports neutral A-Z and Recently Added sorting without assigning ranks", () => {
    const state = fixtureState();
    const alphabetical = rankings.deriveRanking(state, { categoryId: "rap", sort: "a-z" });
    const recent = rankings.deriveRanking(state, { categoryId: "rap", sort: "recent" });
    assert.deepEqual(names(alphabetical), ["Jurin", "Mark"]);
    assert.deepEqual(names(recent), ["Mark", "Jurin"]);
    assert.equal(alphabetical.ranked, false);
    assert.deepEqual(alphabetical.items.map((item) => item.rank), [null, null]);
    assert.deepEqual(rankings.topThree(alphabetical), []);
});

test("accepts a future scoreProvider without coupling derivation to a formula", () => {
    const state = fixtureState();
    const scores = new Map([["participant-jurin", 7], ["participant-mark", 11]]);
    const result = rankings.deriveRanking(state, {
        categoryId: "rap",
        scoreProvider: (participant) => scores.get(participant.id)
    });
    assert.equal(result.ranked, true);
    assert.deepEqual(names(result), ["Mark", "Jurin"]);
    assert.deepEqual(result.items.map((item) => item.rank), [1, 2]);
    assert.deepEqual(rankings.topThree(result).map((item) => item.participant.name), ["Mark", "Jurin"]);
});

test("falls back to Unranked when a scoreProvider is incomplete", () => {
    const state = fixtureState();
    const result = rankings.deriveRanking(state, {
        categoryId: "rap",
        scoreProvider: (participant) => participant.id === "participant-jurin" ? 4 : null
    });
    assert.equal(result.ranked, false);
    assert.deepEqual(result.items.map((item) => item.score), [null, null]);
    assert.deepEqual(rankings.topThree(result), []);
});

test("ranking derivation does not mutate participants, groups, tags, assignments or image ids", () => {
    const state = fixtureState();
    const before = JSON.stringify(state);
    rankings.deriveRanking(state, {
        categoryId: "dance",
        gender: "female",
        groupId: "group-xg",
        tagId: "tag-stage-presence",
        query: "jurin",
        sort: "recent"
    });
    assert.equal(JSON.stringify(state), before);
    assert.deepEqual(state.participants.map((participant) => participant.imageId), [
        "image-ningning", "image-jurin", null, "image-legacy"
    ]);
});

test("opening a derived ranking does not write persistent state", () => {
    const state = fixtureState();
    const values = new Map([["stats:v2:state", JSON.stringify(state)]]);
    let writes = 0;
    const memory = {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { writes += 1; values.set(key, value); }
    };
    const loaded = storage.load(memory);
    const before = values.get("stats:v2:state");
    rankings.deriveRanking(loaded.state, { categoryId: "stage" });
    assert.equal(writes, 0);
    assert.equal(values.get("stats:v2:state"), before);
});

test("rejects unsupported ranking categories", () => {
    assert.throws(
        () => rankings.deriveRanking(fixtureState(), { categoryId: "general" }),
        /unsupported/
    );
});

test("ranking UI exposes six accessible tabs and loads derivation before the app", () => {
    const html = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
    const categories = [...html.matchAll(/data-ranking-category="([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(categories, ["vocal", "rap", "dance", "stage", "visual", "all-rounder"]);
    assert.match(html, /role="tablist"/);
    assert.match(html, /Top 3 · Locked/);
    assert.ok(html.indexOf("js/rankings.js") < html.indexOf("js/app.js"));
});
