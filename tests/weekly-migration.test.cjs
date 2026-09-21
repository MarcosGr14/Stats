const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
require(path.join(projectRoot, "js", "constants.js"));
require(path.join(projectRoot, "js", "data.js"));
require(path.join(projectRoot, "js", "storage.js"));
require(path.join(projectRoot, "js", "weekly-migration.js"));

const { constants, data, storage, weeklyMigration } = globalThis.StatsV2;
const timestamp = "2026-08-31T14:00:00.000Z";

class MemoryStorage {
    constructor(values = {}) {
        this.values = new Map(Object.entries(values));
        this.writes = [];
        this.failPrimaryWrite = false;
    }
    getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
    setItem(key, value) {
        if (this.failPrimaryWrite && key === constants.STORAGE_KEY) throw new Error("quota");
        this.values.set(key, String(value));
        this.writes.push({ key, value: String(value) });
    }
}

function phaseThreeState() {
    const state = data.createEmptyState(timestamp);
    delete state.meta.weeklyVotingVersion;
    state.settings.voters = [{ id: "p1", name: "Marcos" }, { id: "p2", name: "Jackie" }];
    state.groups.push(data.createGroup({ id: "group-a", name: "aespa" }, timestamp));
    state.tags.push(data.createTag({ id: "tag-stage", name: "Stage Presence", categoryId: "stage", type: "strength", predefined: true }, timestamp));
    state.participants.push(data.createParticipant({
        id: "participant-a",
        name: "Ningning",
        groupId: "group-a",
        gender: "female",
        imageId: "image-a",
        categoryIds: ["vocal", "stage"]
    }, timestamp));
    state.participantTagAssignments.push(data.createTagAssignment({
        id: "assignment-a",
        participantId: "participant-a",
        tagId: "tag-stage"
    }, timestamp));
    state.weeks.push({
        id: "2026-W35",
        label: "W35",
        startDate: "2026-08-24",
        endDate: "2026-08-30",
        closed: false,
        createdAt: timestamp,
        updatedAt: timestamp
    });
    state.weeklyVotes.push({
        id: "vote-a",
        weekId: "2026-W35",
        participantId: "participant-a",
        userId: "p1",
        rating: "standout",
        selectedTagIds: ["tag-stage"],
        note: "Historic note",
        createdAt: timestamp,
        updatedAt: timestamp
    });
    state.settings.activeWeekId = "2026-W35";
    return state;
}

test("migrates Phase 3 additively while preserving all existing entities and media ids", () => {
    const before = phaseThreeState();
    const snapshots = {
        participants: JSON.stringify(before.participants),
        groups: JSON.stringify(before.groups),
        tags: JSON.stringify(before.tags),
        assignments: JSON.stringify(before.participantTagAssignments)
    };
    const result = weeklyMigration.ensureWeeklyVoting(before);
    assert.equal(result.changed, true);
    assert.equal(result.state.meta.weeklyVotingVersion, 1);
    assert.equal(JSON.stringify(result.state.participants), snapshots.participants);
    assert.equal(JSON.stringify(result.state.groups), snapshots.groups);
    assert.equal(JSON.stringify(result.state.tags), snapshots.tags);
    assert.equal(JSON.stringify(result.state.participantTagAssignments), snapshots.assignments);
    assert.equal(result.state.participants[0].imageId, "image-a");
    assert.equal(result.state.weeks[0].status, "OPEN");
    assert.equal(result.state.weeks[0].closed, false);
    assert.deepEqual(result.state.weeklyVotes[0].reasonTagIds, ["tag-stage"]);
    assert.deepEqual(result.state.weeklyVotes[0].selectedTagIds, ["tag-stage"]);
    assert.deepEqual(result.state.settings.voters.map((voter) => voter.name), ["Marcos", "Jackie"]);
});

test("migration is idempotent", () => {
    const first = weeklyMigration.ensureWeeklyVoting(phaseThreeState());
    const second = weeklyMigration.ensureWeeklyVoting(first.state);
    assert.equal(second.changed, false);
    assert.deepEqual(second.state, first.state);
});

test("stores one exact pre-weekly backup before the migrated primary state", () => {
    const raw = JSON.stringify(phaseThreeState());
    const memory = new MemoryStorage({ [constants.STORAGE_KEY]: raw });
    const result = weeklyMigration.migrateStoredState(memory, timestamp);
    assert.equal(result.status, "migrated");
    assert.equal(memory.getItem(constants.WEEKLY_MIGRATION_BACKUP_KEY), raw);
    assert.equal(JSON.parse(memory.getItem(constants.STORAGE_KEY)).meta.weeklyVotingVersion, 1);
    weeklyMigration.migrateStoredState(memory, timestamp);
    assert.equal(memory.writes.filter((write) => write.key === constants.WEEKLY_MIGRATION_BACKUP_KEY).length, 1);
});

test("does not overwrite corrupt Phase 3 storage", () => {
    const raw = "{broken-json";
    const memory = new MemoryStorage({ [constants.STORAGE_KEY]: raw });
    const result = weeklyMigration.migrateStoredState(memory, timestamp);
    assert.equal(result.status, "invalid");
    assert.equal(memory.getItem(constants.STORAGE_KEY), raw);
    assert.equal(memory.getItem(constants.WEEKLY_MIGRATION_BACKUP_KEY), null);
    assert.equal(memory.writes.length, 0);
});

test("keeps the original primary state if the migration save fails", () => {
    const raw = JSON.stringify(phaseThreeState());
    const memory = new MemoryStorage({ [constants.STORAGE_KEY]: raw });
    memory.failPrimaryWrite = true;
    assert.throws(() => weeklyMigration.migrateStoredState(memory, timestamp), /quota/);
    assert.equal(memory.getItem(constants.STORAGE_KEY), raw);
    assert.equal(memory.getItem(constants.WEEKLY_MIGRATION_BACKUP_KEY), raw);
});

test("rejects duplicate logical votes instead of merging historical data", () => {
    const state = phaseThreeState();
    state.weeklyVotes.push({ ...state.weeklyVotes[0], id: "vote-b" });
    assert.throws(
        () => weeklyMigration.ensureWeeklyVoting(state),
        (error) => error.code === "INVALID_STATE" && /duplicates/.test(error.message)
    );
});

test("migration never references IndexedDB", () => {
    let indexedDbReads = 0;
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, get() { indexedDbReads += 1; return null; } });
    try {
        weeklyMigration.ensureWeeklyVoting(phaseThreeState());
        assert.equal(indexedDbReads, 0);
    } finally {
        if (descriptor) Object.defineProperty(globalThis, "indexedDB", descriptor);
        else delete globalThis.indexedDB;
    }
});

