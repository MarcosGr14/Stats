const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
require(path.join(projectRoot, "js", "constants.js"));
require(path.join(projectRoot, "js", "data.js"));
require(path.join(projectRoot, "js", "storage.js"));
require(path.join(projectRoot, "js", "image-storage.js"));
require(path.join(projectRoot, "js", "backup.js"));

const { constants, data, imageStorage, backup } = globalThis.StatsV2;

class MemoryStorage {
    constructor(initial = {}) {
        this.values = new Map(Object.entries(initial));
        this.failNextStateWrite = false;
        this.stateWriteFailures = 0;
        this.corruptNextReadOnStateWrite = false;
        this.corruptNextStateRead = false;
    }
    get length() { return this.values.size; }
    key(index) { return [...this.values.keys()][index] ?? null; }
    getItem(key) {
        if (key === constants.STORAGE_KEY && this.corruptNextStateRead) {
            this.corruptNextStateRead = false;
            return "{corrupt-after-write";
        }
        return this.values.has(key) ? this.values.get(key) : null;
    }
    setItem(key, value) {
        if (key === constants.STORAGE_KEY && (this.failNextStateWrite || this.stateWriteFailures > 0)) {
            this.failNextStateWrite = false;
            this.stateWriteFailures = Math.max(0, this.stateWriteFailures - 1);
            const error = new Error("quota");
            error.name = "QuotaExceededError";
            throw error;
        }
        this.values.set(key, String(value));
        if (key === constants.STORAGE_KEY && this.corruptNextReadOnStateWrite) {
            this.corruptNextReadOnStateWrite = false;
            this.corruptNextStateRead = true;
        }
    }
    removeItem(key) { this.values.delete(key); }
}

function request(action) {
    const result = { result: undefined, error: null, onsuccess: null, onerror: null };
    queueMicrotask(() => {
        try { result.result = action(); result.onsuccess?.(); }
        catch (error) { result.error = error; result.onerror?.(); }
    });
    return result;
}

function fakeIndexedDb(initial = [], options = {}) {
    const records = new Map(initial.map((record) => [record.id, record]));
    let created = false;
    return {
        records,
        open() {
            const openRequest = { result: null, error: null };
            const database = {
                objectStoreNames: { contains: () => created },
                createObjectStore() { created = true; return storeFor(null); },
                transaction(_name, mode) {
                    const transaction = { error: null, oncomplete: null, onerror: null, onabort: null };
                    transaction.objectStore = () => storeFor(transaction);
                    setTimeout(() => {
                        if (options.failTransactionOnce && mode === "readwrite") {
                            options.failTransactionOnce = false;
                            transaction.error = new Error("image write failed");
                            transaction.onabort?.();
                        } else transaction.oncomplete?.();
                    }, 0);
                    return transaction;
                },
                close() {}
            };
            function storeFor() {
                return {
                    createIndex() {},
                    getAll: () => request(() => [...records.values()]),
                    get: (id) => request(() => records.get(id)),
                    put: (record) => request(() => { records.set(record.id, record); return record.id; }),
                    delete: (id) => request(() => records.delete(id)),
                    clear: () => request(() => records.clear())
                };
            }
            openRequest.result = database;
            queueMicrotask(() => {
                if (!created) openRequest.onupgradeneeded?.();
                openRequest.onsuccess?.();
            });
            return openRequest;
        }
    };
}

function richFixture(prefix = "source") {
    const timestamp = "2026-09-14T18:30:00.000Z";
    const state = data.createEmptyState(timestamp);
    state.groups.push(data.createGroup({ id: `group-${prefix}`, name: "Grupo" }, timestamp));
    state.tags.push(data.createTag({ id: `tag-${prefix}`, name: "Control", categoryId: "vocal", type: "strength", predefined: false }, timestamp));
    state.participants.push(data.createParticipant({
        id: `participant-${prefix}`,
        name: "Participante",
        groupId: `group-${prefix}`,
        gender: "female",
        categoryIds: ["vocal"],
        imageId: `image-${prefix}`,
        archivedAt: timestamp
    }, timestamp));
    state.participantTagAssignments.push(data.createTagAssignment({
        id: `assignment-${prefix}`,
        participantId: `participant-${prefix}`,
        tagId: `tag-${prefix}`,
        assignedAt: timestamp,
        removedAt: timestamp
    }, timestamp));
    state.weeks.push(data.createWeek({
        id: "2026-W37",
        label: "Semana 37",
        startDate: "2026-09-07",
        endDate: "2026-09-13",
        status: "CLOSED",
        openedAt: timestamp,
        closedAt: timestamp,
        reopenedAt: timestamp,
        reopenCount: 1
    }, timestamp));
    state.weeklyVotes.push(data.createWeeklyVote({
        id: `vote-${prefix}`,
        weekId: "2026-W37",
        participantId: `participant-${prefix}`,
        categoryId: "vocal",
        userId: "p1",
        rating: "standout",
        reasonTagIds: [`tag-${prefix}`],
        note: "Nota sintética"
    }, timestamp));
    return {
        state,
        image: {
            id: `image-${prefix}`,
            participantId: `participant-${prefix}`,
            fileName: "fixture.png",
            mimeType: "image/png",
            createdAt: timestamp,
            blob: new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2])], { type: "image/png" })
        }
    };
}

test("exports a versioned complete backup with state, images, metadata and no mutation", async () => {
    const fixture = richFixture();
    const before = JSON.stringify(fixture.state);
    const built = await backup.buildBackup(fixture.state, [fixture.image], { timestamp: "2026-09-15T00:00:00.000Z" });

    assert.equal(built.format, constants.BACKUP_FORMAT);
    assert.equal(built.formatVersion, 1);
    assert.equal(built.schemaVersion, 2);
    assert.equal(built.images[0].id, fixture.image.id);
    assert.equal(built.images[0].size, 10);
    assert.match(built.checksum.value, /^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(fixture.state), before);
});

test("validates a rich backup and reconstructs images exactly", async () => {
    const fixture = richFixture();
    const built = await backup.buildBackup(fixture.state, [fixture.image]);
    const validated = await backup.parseBackupText(JSON.stringify(built));
    assert.deepEqual(validated.state, fixture.state);
    assert.equal(validated.summary.participants, 1);
    assert.equal(validated.summary.votes, 1);
    assert.deepEqual([...new Uint8Array(await validated.imageRecords[0].blob.arrayBuffer())], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
});

test("rejects corrupt, wrong, future and incompatible backups before writing", async () => {
    await assert.rejects(backup.parseBackupText("{broken"), (error) => error.code === "INVALID_JSON");
    await assert.rejects(backup.validateBackup({ format: "other", formatVersion: 1 }), (error) => error.code === "WRONG_FORMAT");
    await assert.rejects(backup.validateBackup({ format: constants.BACKUP_FORMAT, formatVersion: 99 }), (error) => error.code === "FUTURE_VERSION");
    await assert.rejects(backup.validateBackup({ format: constants.BACKUP_FORMAT, formatVersion: 1, schemaVersion: 99, images: [] }), (error) => error.code === "SCHEMA_MISMATCH");
});

test("detects checksum changes and missing image content", async () => {
    const fixture = richFixture();
    const built = await backup.buildBackup(fixture.state, [fixture.image]);
    built.state.participants[0].name = "Modificado";
    await assert.rejects(backup.validateBackup(built), (error) => error.code === "CHECKSUM_MISMATCH");

    const withoutImage = richFixture("missing");
    await assert.rejects(backup.buildBackup(withoutImage.state, []), (error) => error.code === "MISSING_IMAGE");
});

test("rejects broken vote references and invalid image relationships", async () => {
    const fixture = richFixture("references");
    const brokenVote = await backup.buildBackup(fixture.state, [fixture.image]);
    brokenVote.state.weeklyVotes[0].participantId = "participant-missing";
    await assert.rejects(backup.validateBackup(brokenVote), (error) => error.code === "INVALID_STATE");

    const mismatchedImage = { ...fixture.image, participantId: "participant-missing" };
    await assert.rejects(backup.buildBackup(fixture.state, [mismatchedImage]), (error) => error.code === "BROKEN_IMAGE_REFERENCE");
});

test("rejects image bytes that do not match their declared MIME", async () => {
    const fixture = richFixture("signature");
    fixture.image.blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" });
    await assert.rejects(backup.buildBackup(fixture.state, [fixture.image]), (error) => error.code === "IMAGE_SIGNATURE_MISMATCH");
});

test("recovery snapshots retain corrupt raw state and image bytes", async () => {
    const fixture = richFixture("recovery");
    const snapshot = await backup.buildRecoverySnapshot("{corrupt", [fixture.image]);
    assert.equal(snapshot.format, "stats-v2-recovery-snapshot");
    assert.equal(snapshot.rawState, "{corrupt");
    assert.equal(snapshot.images[0].id, fixture.image.id);
    assert.match(snapshot.checksum.value, /^[a-f0-9]{64}$/);
});

test("restores all collections and images with structural equality", async () => {
    const target = richFixture("target");
    const current = richFixture("current");
    const candidate = await backup.buildBackup(target.state, [target.image]);
    const validated = await backup.validateBackup(candidate);
    const localStorage = new MemoryStorage({ [constants.STORAGE_KEY]: JSON.stringify(current.state) });
    const indexedDb = fakeIndexedDb([current.image]);
    let safetySnapshot = null;

    const restored = await backup.restoreValidated(validated, {
        localStorage,
        indexedDb,
        beforeWrite: ({ safetyBackup }) => { safetySnapshot = safetyBackup; }
    });

    assert.deepEqual(restored.state, target.state);
    assert.deepEqual(JSON.parse(localStorage.getItem(constants.STORAGE_KEY)), target.state);
    assert.deepEqual([...indexedDb.records.keys()], [target.image.id]);
    assert.equal(safetySnapshot.state.participants[0].id, current.state.participants[0].id);
});

test("rolls state and images back when the state write fails", async () => {
    const target = richFixture("target-rollback");
    const current = richFixture("current-rollback");
    const validated = await backup.validateBackup(await backup.buildBackup(target.state, [target.image]));
    const oldRaw = JSON.stringify(current.state);
    const localStorage = new MemoryStorage({ [constants.STORAGE_KEY]: oldRaw });
    localStorage.failNextStateWrite = true;
    const indexedDb = fakeIndexedDb([current.image]);

    await assert.rejects(
        backup.restoreValidated(validated, { localStorage, indexedDb }),
        (error) => error.code === "RESTORE_FAILED" && /recuperados/.test(error.message)
    );
    assert.equal(localStorage.getItem(constants.STORAGE_KEY), oldRaw);
    assert.deepEqual([...indexedDb.records.keys()], [current.image.id]);
});

test("keeps the previous state and images when the IndexedDB replacement fails", async () => {
    const target = richFixture("target-idb");
    const current = richFixture("current-idb");
    const validated = await backup.validateBackup(await backup.buildBackup(target.state, [target.image]));
    const oldRaw = JSON.stringify(current.state);
    const localStorage = new MemoryStorage({ [constants.STORAGE_KEY]: oldRaw });
    const indexedDb = fakeIndexedDb([current.image], { failTransactionOnce: true });

    await assert.rejects(backup.restoreValidated(validated, { localStorage, indexedDb }), (error) => error.code === "RESTORE_FAILED");
    assert.equal(localStorage.getItem(constants.STORAGE_KEY), oldRaw);
    assert.deepEqual([...indexedDb.records.keys()], [current.image.id]);
});

test("rolls back after a failed final read validation", async () => {
    const target = richFixture("target-final");
    const current = richFixture("current-final");
    const validated = await backup.validateBackup(await backup.buildBackup(target.state, [target.image]));
    const oldRaw = JSON.stringify(current.state);
    const localStorage = new MemoryStorage({ [constants.STORAGE_KEY]: oldRaw });
    localStorage.corruptNextReadOnStateWrite = true;
    const indexedDb = fakeIndexedDb([current.image]);

    await assert.rejects(backup.restoreValidated(validated, { localStorage, indexedDb }), (error) => error.code === "RESTORE_FAILED");
    assert.equal(localStorage.getItem(constants.STORAGE_KEY), oldRaw);
    assert.deepEqual([...indexedDb.records.keys()], [current.image.id]);
});

test("surfaces a critical error if rollback itself cannot restore the state", async () => {
    const target = richFixture("target-critical");
    const current = richFixture("current-critical");
    const validated = await backup.validateBackup(await backup.buildBackup(target.state, [target.image]));
    const localStorage = new MemoryStorage({ [constants.STORAGE_KEY]: JSON.stringify(current.state) });
    localStorage.stateWriteFailures = 2;
    const indexedDb = fakeIndexedDb([current.image]);

    await assert.rejects(backup.restoreValidated(validated, { localStorage, indexedDb }), (error) => error.code === "ROLLBACK_FAILED");
});

test("completes export, isolated reset and import with equivalent rich data", async () => {
    const fixture = richFixture("roundtrip");
    const originalRaw = JSON.stringify(fixture.state);
    const localStorage = new MemoryStorage({ [constants.STORAGE_KEY]: originalRaw, "foreign:key": "safe" });
    const indexedDb = fakeIndexedDb([fixture.image]);
    const exported = await backup.exportCurrent(fixture.state, { indexedDb });

    await backup.resetAll({ localStorage, indexedDb });
    assert.equal(localStorage.getItem(constants.STORAGE_KEY), null);
    assert.equal(indexedDb.records.size, 0);

    const validated = await backup.parseBackupText(exported.text);
    await backup.restoreValidated(validated, { localStorage, indexedDb });
    assert.equal(localStorage.getItem(constants.STORAGE_KEY), originalRaw);
    assert.equal(localStorage.getItem("foreign:key"), "safe");
    assert.deepEqual([...new Uint8Array(await indexedDb.records.get(fixture.image.id).blob.arrayBuffer())], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
});

test("total reset removes only Stats V2 keys and images", async () => {
    const fixture = richFixture("reset");
    const localStorage = new MemoryStorage({
        [constants.STORAGE_KEY]: JSON.stringify(fixture.state),
        [constants.TAG_MIGRATION_BACKUP_KEY]: "backup",
        "stats:v2:temporary": "owned",
        "another-app:key": "preserve"
    });
    const indexedDb = fakeIndexedDb([fixture.image]);
    await backup.resetAll({ localStorage, indexedDb });

    assert.equal(localStorage.getItem(constants.STORAGE_KEY), null);
    assert.equal(localStorage.getItem("stats:v2:temporary"), null);
    assert.equal(localStorage.getItem("another-app:key"), "preserve");
    assert.equal(indexedDb.records.size, 0);
});

test("failed reset restores Stats keys and images", async () => {
    const fixture = richFixture("reset-rollback");
    const raw = JSON.stringify(fixture.state);
    const localStorage = new MemoryStorage({ [constants.STORAGE_KEY]: raw, "foreign:key": "safe" });
    const indexedDb = fakeIndexedDb([fixture.image], { failTransactionOnce: true });

    await assert.rejects(backup.resetAll({ localStorage, indexedDb }), (error) => error.code === "RESET_FAILED");
    assert.equal(localStorage.getItem(constants.STORAGE_KEY), raw);
    assert.equal(localStorage.getItem("foreign:key"), "safe");
    assert.deepEqual([...indexedDb.records.keys()], [fixture.image.id]);
});

test("translates quota errors into useful Spanish", () => {
    const error = new Error("quota");
    error.name = "QuotaExceededError";
    assert.match(backup.friendlyError(error), /espacio suficiente/);
});
