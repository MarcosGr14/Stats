const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
require(path.join(projectRoot, "js", "constants.js"));
require(path.join(projectRoot, "js", "data.js"));
require(path.join(projectRoot, "js", "storage.js"));
require(path.join(projectRoot, "js", "participants.js"));

const { data, storage, participants } = globalThis.StatsV2;
const timestamp = "2026-08-31T00:00:00.000Z";

class MemoryStorage {
    constructor() {
        this.values = new Map();
    }
    getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
    setItem(key, value) { this.values.set(key, String(value)); }
    removeItem(key) { this.values.delete(key); }
}

function stateWithGroup() {
    const state = data.createEmptyState(timestamp);
    return participants.createGroup(state, "aespa", timestamp).state;
}

function addParticipant(state, overrides = {}) {
    return participants.createParticipant(state, {
        id: overrides.id,
        name: overrides.name || "Ningning",
        groupId: overrides.groupId === undefined ? state.groups[0]?.id || null : overrides.groupId,
        gender: overrides.gender || "female",
        categoryIds: overrides.categoryIds || ["vocal", "stage"],
        imageId: overrides.imageId || null
    }, overrides.timestamp || timestamp);
}

test("creates a participant with multiple categories and a valid group", () => {
    const state = stateWithGroup();
    const result = addParticipant(state);

    assert.equal(result.participant.name, "Ningning");
    assert.equal(result.participant.groupId, state.groups[0].id);
    assert.deepEqual(result.participant.categoryIds, ["vocal", "stage"]);
    assert.equal(result.state.participants.length, 1);
});

test("reuses groups case-insensitively instead of duplicating them", () => {
    const initial = stateWithGroup();
    const result = participants.createGroup(initial, "  AESPA  ", timestamp);

    assert.equal(result.created, false);
    assert.equal(result.group.id, initial.groups[0].id);
    assert.equal(result.state.groups.length, 1);
});

test("rejects empty names, missing categories and unsupported gender", () => {
    const state = stateWithGroup();

    assert.throws(() => addParticipant(state, { name: "   " }), /name is required/);
    assert.throws(() => addParticipant(state, { categoryIds: [] }), /at least one category/);
    assert.throws(() => addParticipant(state, { gender: "other" }), /unsupported value/);
});

test("rejects missing groups and exact active duplicates", () => {
    const state = stateWithGroup();
    assert.throws(() => addParticipant(state, { groupId: "missing" }), /does not exist/);

    const withParticipant = addParticipant(state).state;
    assert.throws(
        () => addParticipant(withParticipant, { name: "NINGNING" }),
        (error) => error.code === "DUPLICATE_PARTICIPANT"
    );
});

test("edits a participant without changing id or createdAt", () => {
    const initial = addParticipant(stateWithGroup()).state;
    const current = initial.participants[0];
    const result = participants.updateParticipant(initial, current.id, {
        name: "NINGNING",
        groupId: current.groupId,
        gender: "female",
        categoryIds: ["vocal", "stage", "all-rounder"],
        imageId: "image-new"
    }, "2026-09-01T00:00:00.000Z");

    assert.equal(result.participant.id, current.id);
    assert.equal(result.participant.createdAt, current.createdAt);
    assert.equal(result.participant.updatedAt, "2026-09-01T00:00:00.000Z");
    assert.deepEqual(result.participant.categoryIds, ["vocal", "stage", "all-rounder"]);
});

test("archives and restores while preserving identity and data", () => {
    const initial = addParticipant(stateWithGroup()).state;
    const current = initial.participants[0];
    const archived = participants.archiveParticipant(initial, current.id, "2026-09-01T00:00:00.000Z");
    const restored = participants.restoreParticipant(archived.state, current.id, "2026-09-02T00:00:00.000Z");

    assert.equal(archived.participant.archivedAt, "2026-09-01T00:00:00.000Z");
    assert.equal(restored.participant.archivedAt, null);
    assert.equal(restored.participant.id, current.id);
    assert.equal(restored.participant.name, current.name);
});

test("requires archive instead of delete when historical relations exist", () => {
    const initial = addParticipant(stateWithGroup()).state;
    const current = initial.participants[0];
    initial.tags.push(data.createTag({ id: "tag-vocal", name: "Stable Live", type: "strength" }, timestamp));
    initial.participantTagAssignments.push(data.createTagAssignment({
        id: "assignment-a",
        participantId: current.id,
        tagId: "tag-vocal"
    }, timestamp));

    assert.equal(participants.canDeleteParticipant(initial, current.id).allowed, false);
    assert.throws(
        () => participants.deleteParticipant(initial, current.id),
        (error) => error.code === "ARCHIVE_REQUIRED"
    );
});

test("permanently deletes participants without history", () => {
    const initial = addParticipant(stateWithGroup()).state;
    const current = initial.participants[0];
    const result = participants.deleteParticipant(initial, current.id);

    assert.equal(result.state.participants.length, 0);
    assert.equal(result.participant.id, current.id);
});

test("filters by search, group, gender, status and category", () => {
    let state = stateWithGroup();
    state = addParticipant(state, { id: "participant-a", name: "Ningning" }).state;
    state = addParticipant(state, {
        id: "participant-b",
        name: "Mark",
        groupId: null,
        gender: "male",
        categoryIds: ["rap"]
    }).state;
    state = participants.archiveParticipant(state, "participant-b", "2026-09-02T00:00:00.000Z").state;

    assert.deepEqual(participants.filterParticipants(state).map((item) => item.name), ["Ningning"]);
    assert.deepEqual(participants.filterParticipants(state, { query: "aespa" }).map((item) => item.name), ["Ningning"]);
    assert.deepEqual(
        participants.filterParticipants(state, { status: "all", gender: "male", categoryId: "rap" })
            .map((item) => item.name),
        ["Mark"]
    );
    assert.deepEqual(
        participants.filterParticipants(state, { status: "all", sort: "recent" })
            .map((item) => item.name),
        ["Mark", "Ningning"]
    );
});

test("filters participants by active tag relationships only", () => {
    let state = stateWithGroup();
    state = addParticipant(state, { id: "participant-a", name: "Ningning" }).state;
    state = addParticipant(state, {
        id: "participant-b",
        name: "Mark",
        groupId: null,
        gender: "male",
        categoryIds: ["rap"]
    }).state;
    state.tags.push(data.createTag({
        id: "tag-stage-presence",
        name: "Stage Presence",
        categoryId: "stage",
        type: "strength",
        predefined: true
    }, timestamp));
    state.participantTagAssignments.push(data.createTagAssignment({
        id: "assignment-active",
        participantId: "participant-a",
        tagId: "tag-stage-presence"
    }, timestamp));
    state.participantTagAssignments.push(data.createTagAssignment({
        id: "assignment-removed",
        participantId: "participant-b",
        tagId: "tag-stage-presence",
        removedAt: "2026-09-01T00:00:00.000Z"
    }, timestamp));

    assert.deepEqual(
        participants.filterParticipants(state, { tagId: "tag-stage-presence" }).map((item) => item.name),
        ["Ningning"]
    );
});

test("persists and reloads participant state through the central storage helper", () => {
    const memory = new MemoryStorage();
    const state = addParticipant(stateWithGroup()).state;
    storage.save(state, memory, timestamp);
    const loaded = storage.load(memory);

    assert.equal(loaded.status, "ready");
    assert.equal(loaded.state.participants[0].name, "Ningning");
    assert.equal(loaded.state.groups[0].name, "aespa");
});
