const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
require(path.join(projectRoot, "js", "constants.js"));
require(path.join(projectRoot, "js", "data.js"));
require(path.join(projectRoot, "js", "storage.js"));
require(path.join(projectRoot, "js", "weekly-migration.js"));

const { constants, data, weeklyMigration } = globalThis.StatsV2;
const timestamp = "2026-08-31T14:00:00.000Z";

class MemoryStorage {
    constructor(values = {}) { this.values = new Map(Object.entries(values)); this.writes = []; this.failPrimaryWrite = false; }
    getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
    setItem(key, value) {
        if (this.failPrimaryWrite && key === constants.STORAGE_KEY) throw new Error("quota");
        this.values.set(key, String(value));
        this.writes.push({ key, value: String(value) });
    }
}

function phaseFourState() {
    const state = data.createEmptyState(timestamp);
    state.meta.weeklyVotingVersion = 1;
    state.settings.voters = [{ id: "p1", name: "Marcos" }, { id: "p2", name: "Jackie" }];
    state.groups.push(data.createGroup({ id: "group-xg", name: "XG" }, timestamp));
    state.tags.push(data.createTag({ id: "tag-flow", name: "Flow", categoryId: "rap", type: "strength", predefined: true }, timestamp));
    state.participants.push(
        data.createParticipant({ id: "participant-single", name: "Solo", gender: "female", imageId: "image-single", categoryIds: ["vocal"] }, timestamp),
        data.createParticipant({ id: "participant-multi", name: "Jurin", groupId: "group-xg", gender: "female", imageId: "image-multi", categoryIds: ["rap", "dance", "stage"] }, timestamp)
    );
    state.participantTagAssignments.push(data.createTagAssignment({
        id: "assignment-a", participantId: "participant-multi", tagId: "tag-flow"
    }, timestamp));
    state.weeks.push(data.createWeek({
        id: "2026-W36", label: "W36", startDate: "2026-08-31", endDate: "2026-09-06", status: "OPEN"
    }, timestamp));
    delete state.weeks[0].reopenedAt;
    delete state.weeks[0].reopenCount;
    state.settings.activeWeekId = "2026-W36";
    state.weeklyVotes.push(
        { id: "vote-single", weekId: "2026-W36", participantId: "participant-single", userId: "p1", rating: "good", reasonTagIds: [], note: "Single", createdAt: timestamp, updatedAt: timestamp },
        { id: "vote-multi", weekId: "2026-W36", participantId: "participant-multi", userId: "p1", rating: "standout", reasonTagIds: ["tag-flow"], note: "Multi", createdAt: timestamp, updatedAt: timestamp }
    );
    return state;
}

test("migrates single-category votes safely and preserves multi-category votes as unresolved legacy", () => {
    const before = phaseFourState();
    const protectedCollections = ["participants", "groups", "tags", "participantTagAssignments"];
    const snapshots = Object.fromEntries(protectedCollections.map((name) => [name, JSON.stringify(before[name])]));
    const result = weeklyMigration.ensureCategoryVoting(before);
    assert.equal(result.state.meta.weeklyVotingVersion, 2);
    assert.equal(result.autoCategorizedCount, 1);
    assert.equal(result.legacyUncategorizedCount, 1);
    assert.equal(result.state.weeklyVotes.length, 2);
    assert.equal(result.state.weeklyVotes[0].categoryId, "vocal");
    assert.equal(result.state.weeklyVotes[1].categoryId, undefined);
    assert.equal(result.state.weeklyVotes[1].legacyUncategorized, true);
    assert.deepEqual(result.state.weeklyVotes.map((vote) => vote.id), ["vote-single", "vote-multi"]);
    assert.deepEqual(result.state.weeklyVotes.map((vote) => vote.note), ["Single", "Multi"]);
    assert.deepEqual(result.state.weeklyVotes[1].reasonTagIds, ["tag-flow"]);
    protectedCollections.forEach((name) => assert.equal(JSON.stringify(result.state[name]), snapshots[name]));
    assert.deepEqual(result.state.participants.map((participant) => participant.imageId), ["image-single", "image-multi"]);
    assert.equal(result.state.weeks[0].reopenCount, 0);
    assert.equal(result.state.weeks[0].reopenedAt, null);
});

test("category migration is idempotent and never duplicates votes", () => {
    const first = weeklyMigration.ensureCategoryVoting(phaseFourState());
    const second = weeklyMigration.ensureCategoryVoting(first.state);
    assert.equal(second.changed, false);
    assert.deepEqual(second.state, first.state);
    assert.equal(second.state.weeklyVotes.length, 2);
});

test("stores one exact pre-category backup before the migrated primary state", () => {
    const raw = JSON.stringify(phaseFourState());
    const memory = new MemoryStorage({ [constants.STORAGE_KEY]: raw });
    const result = weeklyMigration.migrateStoredCategoryState(memory, timestamp);
    assert.equal(result.status, "migrated");
    assert.equal(memory.getItem(constants.CATEGORY_VOTING_MIGRATION_BACKUP_KEY), raw);
    assert.equal(JSON.parse(memory.getItem(constants.STORAGE_KEY)).meta.weeklyVotingVersion, 2);
    weeklyMigration.migrateStoredCategoryState(memory, timestamp);
    assert.equal(memory.writes.filter((write) => write.key === constants.CATEGORY_VOTING_MIGRATION_BACKUP_KEY).length, 1);
});

test("never overwrites an existing pre-category backup", () => {
    const raw = JSON.stringify(phaseFourState());
    const originalBackup = "first-category-backup";
    const memory = new MemoryStorage({
        [constants.STORAGE_KEY]: raw,
        [constants.CATEGORY_VOTING_MIGRATION_BACKUP_KEY]: originalBackup
    });
    weeklyMigration.migrateStoredCategoryState(memory, timestamp);
    assert.equal(memory.getItem(constants.CATEGORY_VOTING_MIGRATION_BACKUP_KEY), originalBackup);
    assert.equal(memory.writes.some((write) => write.key === constants.CATEGORY_VOTING_MIGRATION_BACKUP_KEY), false);
});

test("backup failure aborts before changing the primary state", () => {
    const raw = JSON.stringify(phaseFourState());
    const memory = new MemoryStorage({ [constants.STORAGE_KEY]: raw });
    const originalSet = memory.setItem.bind(memory);
    memory.setItem = (key, value) => {
        if (key === constants.CATEGORY_VOTING_MIGRATION_BACKUP_KEY) throw new Error("backup failed");
        originalSet(key, value);
    };
    assert.throws(() => weeklyMigration.migrateStoredCategoryState(memory, timestamp), /backup failed/);
    assert.equal(memory.getItem(constants.STORAGE_KEY), raw);
});

test("primary save failure keeps the original state and exact backup", () => {
    const raw = JSON.stringify(phaseFourState());
    const memory = new MemoryStorage({ [constants.STORAGE_KEY]: raw });
    memory.failPrimaryWrite = true;
    assert.throws(() => weeklyMigration.migrateStoredCategoryState(memory, timestamp), /quota/);
    assert.equal(memory.getItem(constants.STORAGE_KEY), raw);
    assert.equal(memory.getItem(constants.CATEGORY_VOTING_MIGRATION_BACKUP_KEY), raw);
});

test("migration never reads or writes IndexedDB", () => {
    let indexedDbReads = 0;
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, get() { indexedDbReads += 1; return null; } });
    try {
        weeklyMigration.ensureCategoryVoting(phaseFourState());
        assert.equal(indexedDbReads, 0);
    } finally {
        if (descriptor) Object.defineProperty(globalThis, "indexedDB", descriptor);
        else delete globalThis.indexedDB;
    }
});
