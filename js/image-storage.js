(function defineImageStorage(root) {
    "use strict";

    const namespace = root.StatsV2 || {};
    const constants = namespace.constants;

    if (!constants) {
        throw new Error("Stats V2 constants must load before image storage.");
    }

    function openDatabase(indexedDb = root.indexedDB) {
        if (!indexedDb) {
            return Promise.reject(new Error("IndexedDB is unavailable."));
        }

        return new Promise((resolve, reject) => {
            const request = indexedDb.open(constants.IMAGE_DB_NAME, constants.IMAGE_DB_VERSION);

            request.onupgradeneeded = () => {
                const database = request.result;
                if (!database.objectStoreNames.contains(constants.IMAGE_STORE_NAME)) {
                    const store = database.createObjectStore(constants.IMAGE_STORE_NAME, { keyPath: "id" });
                    store.createIndex("participantId", "participantId", { unique: false });
                    store.createIndex("createdAt", "createdAt", { unique: false });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error("Could not open the image database."));
            request.onblocked = () => reject(new Error("The image database upgrade is blocked by another tab."));
        });
    }

    function requestResult(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
        });
    }

    async function withStore(mode, operation, indexedDb) {
        const database = await openDatabase(indexedDb);
        try {
            const transaction = database.transaction(constants.IMAGE_STORE_NAME, mode);
            const store = transaction.objectStore(constants.IMAGE_STORE_NAME);
            return await operation(store);
        } finally {
            database.close();
        }
    }

    function putImage(record, indexedDb = root.indexedDB) {
        if (!record || typeof record.id !== "string" || !record.blob) {
            return Promise.reject(new TypeError("An image record requires an id and blob."));
        }

        const safeRecord = {
            id: record.id,
            participantId: record.participantId || null,
            blob: record.blob,
            fileName: record.fileName || "image",
            mimeType: record.mimeType || record.blob.type || "application/octet-stream",
            createdAt: record.createdAt || new Date().toISOString()
        };

        return withStore("readwrite", (store) => requestResult(store.put(safeRecord)), indexedDb);
    }

    function getImage(id, indexedDb = root.indexedDB) {
        return withStore("readonly", (store) => requestResult(store.get(id)), indexedDb);
    }

    function deleteImage(id, indexedDb = root.indexedDB) {
        return withStore("readwrite", (store) => requestResult(store.delete(id)), indexedDb);
    }

    namespace.imageStorage = Object.freeze({ openDatabase, putImage, getImage, deleteImage });
    root.StatsV2 = namespace;
})(globalThis);
