(function defineImageStorage(root) {
    "use strict";

    const namespace = root.StatsV2 || {};
    const constants = namespace.constants;
    const data = namespace.data;

    if (!constants || !data) {
        throw new Error("Stats V2 constants and data model must load before image storage.");
    }

    function validateImageFile(file) {
        if (!file || typeof file.type !== "string" || typeof file.size !== "number") {
            return { valid: false, code: "INVALID_FILE", message: "Selecciona un archivo de imagen válido." };
        }
        if (!constants.IMAGE_MIME_TYPES.includes(file.type.toLowerCase())) {
            return {
                valid: false,
                code: "UNSUPPORTED_TYPE",
                message: "Usa una imagen JPEG, PNG o WebP."
            };
        }
        if (file.size <= 0) {
            return { valid: false, code: "EMPTY_FILE", message: "La imagen seleccionada está vacía." };
        }
        if (file.size > constants.MAX_IMAGE_BYTES) {
            return {
                valid: false,
                code: "FILE_TOO_LARGE",
                message: "La imagen debe pesar 5 MB o menos."
            };
        }
        return { valid: true, code: null, message: "" };
    }

    function createImageRecord(file, participantId, timestamp = new Date().toISOString()) {
        const validation = validateImageFile(file);
        if (!validation.valid) {
            const error = new TypeError(validation.message);
            error.code = validation.code;
            throw error;
        }
        return {
            id: data.createId("image"),
            participantId: participantId || null,
            blob: file,
            fileName: file.name || "participant-image",
            mimeType: file.type,
            createdAt: timestamp
        };
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
        const validation = validateImageFile(record.blob);
        if (!validation.valid) {
            const error = new TypeError(validation.message);
            error.code = validation.code;
            return Promise.reject(error);
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

    namespace.imageStorage = Object.freeze({
        validateImageFile,
        createImageRecord,
        openDatabase,
        putImage,
        getImage,
        deleteImage
    });
    root.StatsV2 = namespace;
})(globalThis);
