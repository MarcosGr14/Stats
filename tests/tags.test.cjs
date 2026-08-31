const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
require(path.join(projectRoot, "js", "constants.js"));
require(path.join(projectRoot, "js", "data.js"));
require(path.join(projectRoot, "js", "storage.js"));
require(path.join(projectRoot, "js", "tags.js"));

const { constants, data, storage, tags } = globalThis.StatsV2;
const timestamp = "2026-08-31T00:00:00.000Z";

class MemoryStorage {
    constructor() {
        this.values = new Map();
        this.failPrimaryWrites = false;
    }
    getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
    setItem(key, value) {
        if (this.failPrimaryWrites && key === constants.STORAGE_KEY) throw new Error("quota blocked");
        this.values.set(key, String(value));
    }
    removeItem(key) { this.values.delete(key); }
}

function phaseOneState() {
    const state = data.createEmptyState(timestamp);
    state.groups.push(data.createGroup({ id: "group-aespa", name: "aespa" }, timestamp));
    state.participants.push(data.createParticipant({
        id: "participant-ningning",
        name: "Ningning",
        groupId: "group-aespa",
        gender: "female",
        imageId: "image-real-1",
        categoryIds: ["vocal", "dance"]
    }, timestamp));
    state.participants.push(data.createParticipant({
        id: "participant-jurin",
        name: "Jurin",
        groupId: null,
        gender: "female",
        imageId: "image-real-2",
        categoryIds: ["rap", "dance"]
    }, timestamp));
    return state;
}

function migratedState() {
    return tags.ensurePredefinedCatalog(phaseOneState(), timestamp).state;
}

function tagByName(state, name, categoryId) {
    return state.tags.find((tag) => tag.name === name && tag.categoryId === categoryId);
}

test("loads the predefined catalog once with stable unique ids", () => {
    const first = tags.ensurePredefinedCatalog(phaseOneState(), timestamp);
    const second = tags.ensurePredefinedCatalog(first.state, "2026-09-01T00:00:00.000Z");

    assert.equal(first.addedCount, 84);
    assert.equal(new Set(first.state.tags.map((tag) => tag.id)).size, 84);
    assert.equal(first.state.tags.every((tag) => tag.predefined), true);
    assert.equal(second.changed, false);
    assert.equal(second.state.tags.length, 84);
});

test("migrates Phase 1 additively without changing participants, groups or image ids", () => {
    const before = phaseOneState();
    const participantSnapshot = JSON.stringify(before.participants);
    const groupSnapshot = JSON.stringify(before.groups);

    const result = tags.ensurePredefinedCatalog(before, timestamp);

    assert.equal(JSON.stringify(result.state.participants), participantSnapshot);
    assert.equal(JSON.stringify(result.state.groups), groupSnapshot);
    assert.deepEqual(result.state.participants.map((item) => item.imageId), ["image-real-1", "image-real-2"]);
    assert.deepEqual(before.tags, []);
});

test("backs up the exact Phase 1 JSON before saving the additive catalog", () => {
    const memory = new MemoryStorage();
    const before = storage.save(phaseOneState(), memory, timestamp);
    const rawBefore = memory.getItem(constants.STORAGE_KEY);
    const migrated = tags.ensurePredefinedCatalog(before, timestamp).state;

    storage.saveWithBackup(migrated, memory, "2026-09-01T00:00:00.000Z");

    assert.equal(memory.getItem(constants.TAG_MIGRATION_BACKUP_KEY), rawBefore);
    assert.equal(storage.load(memory).state.participants[0].id, "participant-ningning");
});

test("keeps the original primary state intact if the migration write fails", () => {
    const memory = new MemoryStorage();
    const before = storage.save(phaseOneState(), memory, timestamp);
    const rawBefore = memory.getItem(constants.STORAGE_KEY);
    const migrated = tags.ensurePredefinedCatalog(before, timestamp).state;
    memory.failPrimaryWrites = true;

    assert.throws(
        () => storage.saveWithBackup(migrated, memory, "2026-09-01T00:00:00.000Z"),
        /quota blocked/
    );
    assert.equal(memory.getItem(constants.STORAGE_KEY), rawBefore);
    assert.equal(memory.getItem(constants.TAG_MIGRATION_BACKUP_KEY), rawBefore);
});

test("creates valid custom tags and reuses exact case-insensitive matches", () => {
    const initial = migratedState();
    const created = tags.createCustomTag(initial, {
        name: "  Killer   Bridge ",
        categoryId: "general",
        type: "neutral"
    }, timestamp);
    const reused = tags.createCustomTag(created.state, {
        name: "killer bridge",
        categoryId: "general",
        type: "neutral"
    }, timestamp);

    assert.equal(created.created, true);
    assert.equal(created.tag.name, "Killer Bridge");
    assert.equal(created.tag.predefined, false);
    assert.equal(reused.created, false);
    assert.equal(reused.tag.id, created.tag.id);
});

test("rejects empty custom names, invalid types and invalid categories", () => {
    const state = migratedState();
    assert.throws(
        () => tags.createCustomTag(state, { name: " ", categoryId: "general", type: "neutral" }),
        (error) => error.code === "EMPTY_NAME"
    );
    assert.throws(
        () => tags.createCustomTag(state, { name: "Test", categoryId: "general", type: "negative" }),
        (error) => error.code === "INVALID_TYPE"
    );
    assert.throws(
        () => tags.createCustomTag(state, { name: "Test", categoryId: "visual", type: "neutral" }),
        (error) => error.code === "INVALID_CATEGORY"
    );
});

test("assigns one global tag to multiple participants without duplicating active relations", () => {
    let state = migratedState();
    const stagePresence = tagByName(state, "Stage Presence", "stage");
    const first = tags.assignTag(state, "participant-ningning", stagePresence.id, timestamp);
    const duplicate = tags.assignTag(first.state, "participant-ningning", stagePresence.id, timestamp);
    const second = tags.assignTag(duplicate.state, "participant-jurin", stagePresence.id, timestamp);

    assert.equal(first.created, true);
    assert.equal(duplicate.created, false);
    assert.equal(second.state.participantTagAssignments.length, 2);
    assert.equal(tags.tagUsage(second.state, stagePresence.id).activeCount, 2);
});

test("removing a tag from one participant preserves the catalog and other assignments", () => {
    let state = migratedState();
    const stableLive = tagByName(state, "Stable Live", "vocal");
    state = tags.assignTag(state, "participant-ningning", stableLive.id, timestamp).state;
    state = tags.assignTag(state, "participant-jurin", stableLive.id, timestamp).state;
    state = tags.removeTag(state, "participant-ningning", stableLive.id, "2026-09-01T00:00:00.000Z").state;

    assert.ok(state.tags.some((tag) => tag.id === stableLive.id));
    assert.deepEqual(
        tags.activeTagsForParticipant(state, "participant-jurin").map((item) => item.tag.id),
        [stableLive.id]
    );
    assert.deepEqual(tags.activeTagsForParticipant(state, "participant-ningning"), []);
});

test("rejects missing participants and tags", () => {
    const state = migratedState();
    const tag = state.tags[0];
    assert.throws(
        () => tags.assignTag(state, "missing", tag.id),
        (error) => error.code === "PARTICIPANT_NOT_FOUND"
    );
    assert.throws(
        () => tags.assignTag(state, "participant-ningning", "missing"),
        (error) => error.code === "TAG_NOT_FOUND"
    );
});

test("protects predefined and referenced custom tags from global deletion", () => {
    let state = migratedState();
    const predefined = state.tags[0];
    assert.throws(
        () => tags.deleteCustomTag(state, predefined.id),
        (error) => error.code === "PREDEFINED_PROTECTED"
    );

    const custom = tags.createCustomTag(state, {
        name: "Encore Queen",
        categoryId: "general",
        type: "neutral"
    }, timestamp);
    state = tags.assignTag(custom.state, "participant-ningning", custom.tag.id, timestamp).state;
    assert.throws(
        () => tags.deleteCustomTag(state, custom.tag.id),
        (error) => error.code === "TAG_IN_USE"
    );
});

test("deletes an unused custom tag and allows safe edits only before assignment", () => {
    const initial = tags.createCustomTag(migratedState(), {
        name: "Ending Fairy",
        categoryId: "general",
        type: "neutral"
    }, timestamp);
    const updated = tags.updateCustomTag(initial.state, initial.tag.id, {
        name: "Award Show Monster",
        categoryId: "stage",
        type: "strength"
    }, "2026-09-01T00:00:00.000Z");
    const deleted = tags.deleteCustomTag(updated.state, updated.tag.id);

    assert.equal(updated.tag.name, "Award Show Monster");
    assert.equal(deleted.state.tags.some((tag) => tag.id === updated.tag.id), false);
});
