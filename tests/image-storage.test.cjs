const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
require(path.join(projectRoot, "js", "constants.js"));
require(path.join(projectRoot, "js", "data.js"));
require(path.join(projectRoot, "js", "image-storage.js"));

const { constants, imageStorage } = globalThis.StatsV2;

function asyncRequest(action) {
    const request = { result: undefined, error: null, onsuccess: null, onerror: null };
    queueMicrotask(() => {
        try {
            request.result = action();
            if (request.onsuccess) request.onsuccess();
        } catch (error) {
            request.error = error;
            if (request.onerror) request.onerror();
        }
    });
    return request;
}

function createFakeIndexedDb() {
    const records = new Map();
    let created = false;

    const store = {
        createIndex() {},
        put(record) {
            return asyncRequest(() => {
                records.set(record.id, record);
                return record.id;
            });
        },
        get(id) {
            return asyncRequest(() => records.get(id));
        },
        delete(id) {
            return asyncRequest(() => records.delete(id));
        }
    };

    const database = {
        objectStoreNames: { contains: () => created },
        createObjectStore() {
            created = true;
            return store;
        },
        transaction() {
            return { objectStore: () => store };
        },
        close() {}
    };

    return {
        open() {
            const request = {
                result: database,
                error: null,
                onupgradeneeded: null,
                onsuccess: null,
                onerror: null,
                onblocked: null
            };
            queueMicrotask(() => {
                if (!created && request.onupgradeneeded) request.onupgradeneeded();
                if (request.onsuccess) request.onsuccess();
            });
            return request;
        }
    };
}

function imageFile(name = "performer.png", type = "image/png", size = 4) {
    return new File([new Uint8Array(size)], name, { type });
}

test("accepts JPEG, PNG and WebP images within 5 MB", () => {
    for (const type of constants.IMAGE_MIME_TYPES) {
        assert.equal(imageStorage.validateImageFile(imageFile("image", type)).valid, true);
    }
});

test("rejects unsupported, empty and oversized images", () => {
    assert.equal(imageStorage.validateImageFile(imageFile("image.gif", "image/gif")).code, "UNSUPPORTED_TYPE");
    assert.equal(imageStorage.validateImageFile(imageFile("empty.png", "image/png", 0)).code, "EMPTY_FILE");
    assert.equal(
        imageStorage.validateImageFile(imageFile("large.png", "image/png", constants.MAX_IMAGE_BYTES + 1)).code,
        "FILE_TOO_LARGE"
    );
});

test("creates an image record associated with a participant", () => {
    const record = imageStorage.createImageRecord(
        imageFile(),
        "participant-a",
        "2026-08-31T00:00:00.000Z"
    );

    assert.match(record.id, /^image-/);
    assert.equal(record.participantId, "participant-a");
    assert.equal(record.mimeType, "image/png");
});

test("stores, retrieves and deletes an image through the IndexedDB abstraction", async () => {
    const indexedDb = createFakeIndexedDb();
    const record = imageStorage.createImageRecord(imageFile(), "participant-a");

    await imageStorage.putImage(record, indexedDb);
    const stored = await imageStorage.getImage(record.id, indexedDb);
    assert.equal(stored.id, record.id);
    assert.equal(stored.participantId, "participant-a");

    await imageStorage.deleteImage(record.id, indexedDb);
    assert.equal(await imageStorage.getImage(record.id, indexedDb), undefined);
});
