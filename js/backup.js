(function defineBackup(root) {
    "use strict";

    const namespace = root.StatsV2 || {};
    const constants = namespace.constants;
    const data = namespace.data;
    const storageService = namespace.storage;
    const imageStorage = namespace.imageStorage;

    if (!constants || !data || !storageService || !imageStorage) {
        throw new Error("Stats V2 data, storage and image storage must load before backup.");
    }

    class BackupError extends Error {
        constructor(code, message, details = []) {
            super(message);
            this.name = "BackupError";
            this.code = code;
            this.details = details;
        }
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function canonicalJson(value) {
        if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
        if (value && typeof value === "object") {
            return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
        }
        return JSON.stringify(value);
    }

    function bytesToBase64(bytes) {
        if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
        let binary = "";
        const chunkSize = 0x8000;
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
        }
        return root.btoa(binary);
    }

    function base64ToBytes(value) {
        if (typeof value !== "string" || value === "" || value.length % 4 !== 0
            || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
            throw new BackupError("INVALID_IMAGE_DATA", "Una imagen del backup está dañada.");
        }
        try {
            if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(value, "base64"));
            const binary = root.atob(value);
            return Uint8Array.from(binary, (character) => character.charCodeAt(0));
        } catch (error) {
            throw new BackupError("INVALID_IMAGE_DATA", "Una imagen del backup está dañada.");
        }
    }

    async function sha256(value, cryptoApi = root.crypto) {
        if (!cryptoApi || !cryptoApi.subtle || typeof cryptoApi.subtle.digest !== "function") {
            throw new BackupError("CRYPTO_UNAVAILABLE", "Este navegador no puede verificar la integridad del backup.");
        }
        const bytes = new TextEncoder().encode(value);
        const digest = new Uint8Array(await cryptoApi.subtle.digest("SHA-256", bytes));
        return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }

    function checksumBody(backup) {
        return {
            format: backup.format,
            formatVersion: backup.formatVersion,
            appVersion: backup.appVersion,
            schemaVersion: backup.schemaVersion,
            state: backup.state,
            images: backup.images
        };
    }

    function validateStateOrThrow(state) {
        const validation = data.validateState(state);
        if (!validation.valid) {
            throw new BackupError(
                "INVALID_STATE",
                "El backup contiene datos de Stats inválidos.",
                validation.errors
            );
        }
    }

    function hasImageSignature(bytes, mimeType) {
        if (mimeType === "image/png") {
            return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
                .every((byte, index) => bytes[index] === byte);
        }
        if (mimeType === "image/jpeg") {
            return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
        }
        if (mimeType === "image/webp") {
            return bytes.length >= 12
                && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF"
                && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP";
        }
        return false;
    }

    async function portableImage(record) {
        if (!record || typeof record.id !== "string" || !(record.blob instanceof Blob)) {
            throw new BackupError("INVALID_IMAGE", "No se pudo leer una imagen guardada.");
        }
        const validation = imageStorage.validateImageFile(record.blob);
        if (!validation.valid) throw new BackupError("INVALID_IMAGE", validation.message);
        const bytes = new Uint8Array(await record.blob.arrayBuffer());
        const mimeType = (record.mimeType || record.blob.type).toLowerCase();
        if (!hasImageSignature(bytes, mimeType)) {
            throw new BackupError("IMAGE_SIGNATURE_MISMATCH", `El contenido de la imagen ${record.id} no coincide con su formato.`);
        }
        return {
            id: record.id,
            participantId: record.participantId || null,
            fileName: record.fileName || "image",
            mimeType,
            size: bytes.byteLength,
            createdAt: record.createdAt || null,
            dataBase64: bytesToBase64(bytes)
        };
    }

    function validateImageRelations(state, images) {
        const participantIds = new Set(state.participants.map((participant) => participant.id));
        const referenced = new Map(state.participants
            .filter((participant) => participant.imageId)
            .map((participant) => [participant.imageId, participant.id]));
        const imageIds = new Set();

        images.forEach((image) => {
            if (imageIds.has(image.id)) {
                throw new BackupError("DUPLICATE_IMAGE", `El backup repite la imagen ${image.id}.`);
            }
            imageIds.add(image.id);
            if (image.participantId !== null && !participantIds.has(image.participantId)) {
                throw new BackupError("BROKEN_IMAGE_REFERENCE", `La imagen ${image.id} apunta a un participante inexistente.`);
            }
            if (referenced.has(image.id) && referenced.get(image.id) !== image.participantId) {
                throw new BackupError("BROKEN_IMAGE_REFERENCE", `La relación de la imagen ${image.id} no coincide con el participante.`);
            }
        });

        referenced.forEach((participantId, imageId) => {
            if (!imageIds.has(imageId)) {
                throw new BackupError("MISSING_IMAGE", `Falta la imagen usada por el participante ${participantId}.`);
            }
        });
    }

    function summarize(state, images, estimatedBytes = 0) {
        return {
            participants: state.participants.length,
            groups: state.groups.length,
            tags: state.tags.length,
            weeks: state.weeks.length,
            votes: state.weeklyVotes.length,
            images: images.length,
            estimatedBytes
        };
    }

    async function buildBackup(state, imageRecords, options = {}) {
        const safeState = clone(state);
        validateStateOrThrow(safeState);
        const images = [];
        for (const record of imageRecords) images.push(await portableImage(record));
        validateImageRelations(safeState, images);

        const backup = {
            format: constants.BACKUP_FORMAT,
            formatVersion: constants.BACKUP_FORMAT_VERSION,
            createdAt: options.timestamp || new Date().toISOString(),
            appVersion: constants.APP_VERSION,
            schemaVersion: constants.SCHEMA_VERSION,
            state: safeState,
            images,
            checksum: { algorithm: "SHA-256", value: "" }
        };
        backup.checksum.value = await sha256(canonicalJson(checksumBody(backup)), options.cryptoApi);
        return backup;
    }

    async function buildRecoverySnapshot(rawState, imageRecords, options = {}) {
        const images = [];
        for (const record of imageRecords) images.push(await portableImage(record));
        const snapshot = {
            format: "stats-v2-recovery-snapshot",
            formatVersion: 1,
            createdAt: options.timestamp || new Date().toISOString(),
            rawState,
            images,
            checksum: { algorithm: "SHA-256", value: "" }
        };
        snapshot.checksum.value = await sha256(canonicalJson({ rawState, images }), options.cryptoApi);
        return snapshot;
    }

    async function validateBackup(candidate, options = {}) {
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
            throw new BackupError("INVALID_FORMAT", "El archivo no es un backup válido de Stats V2.");
        }
        if (candidate.format !== constants.BACKUP_FORMAT) {
            throw new BackupError("WRONG_FORMAT", "El archivo no pertenece al formato de backup de Stats V2.");
        }
        if (!Number.isInteger(candidate.formatVersion)) {
            throw new BackupError("INVALID_VERSION", "El backup no indica una versión válida.");
        }
        if (candidate.formatVersion > constants.BACKUP_FORMAT_VERSION) {
            throw new BackupError("FUTURE_VERSION", "Este backup fue creado por una versión más reciente de Stats.");
        }
        if (candidate.formatVersion !== constants.BACKUP_FORMAT_VERSION) {
            throw new BackupError("UNSUPPORTED_VERSION", "Esta versión antigua de backup todavía no tiene una migración segura.");
        }
        if (candidate.schemaVersion !== constants.SCHEMA_VERSION) {
            throw new BackupError("SCHEMA_MISMATCH", "El esquema de datos del backup no es compatible con esta versión.");
        }
        if (!Array.isArray(candidate.images)) {
            throw new BackupError("INVALID_IMAGES", "El backup no contiene una colección de imágenes válida.");
        }
        if (typeof candidate.createdAt !== "string" || typeof candidate.appVersion !== "string") {
            throw new BackupError("INVALID_METADATA", "El backup no contiene metadata válida.");
        }
        validateStateOrThrow(candidate.state);
        if (!candidate.checksum || candidate.checksum.algorithm !== "SHA-256" || typeof candidate.checksum.value !== "string") {
            throw new BackupError("MISSING_CHECKSUM", "El backup no incluye una verificación de integridad válida.");
        }
        const actualChecksum = await sha256(canonicalJson(checksumBody(candidate)), options.cryptoApi);
        if (actualChecksum !== candidate.checksum.value) {
            throw new BackupError("CHECKSUM_MISMATCH", "El backup fue modificado o está incompleto.");
        }

        const imageRecords = candidate.images.map((image) => {
            if (!image || typeof image.id !== "string" || typeof image.mimeType !== "string"
                || !constants.IMAGE_MIME_TYPES.includes(image.mimeType.toLowerCase())
                || !Number.isInteger(image.size) || image.size <= 0 || image.size > constants.MAX_IMAGE_BYTES
                || (image.participantId !== null && typeof image.participantId !== "string")) {
                throw new BackupError("INVALID_IMAGE", "El backup contiene metadatos de imagen inválidos.");
            }
            const bytes = base64ToBytes(image.dataBase64);
            if (bytes.byteLength !== image.size) {
                throw new BackupError("IMAGE_SIZE_MISMATCH", `El tamaño de la imagen ${image.id} no coincide.`);
            }
            const blob = new Blob([bytes], { type: image.mimeType });
            if (!hasImageSignature(bytes, image.mimeType.toLowerCase())) {
                throw new BackupError("IMAGE_SIGNATURE_MISMATCH", `El contenido de la imagen ${image.id} no coincide con su formato.`);
            }
            const validation = imageStorage.validateImageFile(blob);
            if (!validation.valid) throw new BackupError("INVALID_IMAGE", validation.message);
            return {
                id: image.id,
                participantId: image.participantId,
                fileName: typeof image.fileName === "string" ? image.fileName : "image",
                mimeType: image.mimeType,
                createdAt: typeof image.createdAt === "string" ? image.createdAt : new Date(0).toISOString(),
                blob
            };
        });
        validateImageRelations(candidate.state, candidate.images);
        const estimatedBytes = new TextEncoder().encode(JSON.stringify(candidate)).byteLength;
        return {
            backup: clone(candidate),
            state: clone(candidate.state),
            imageRecords,
            summary: summarize(candidate.state, candidate.images, estimatedBytes)
        };
    }

    async function parseBackupText(text, options = {}) {
        let candidate;
        try {
            candidate = JSON.parse(text);
        } catch (error) {
            throw new BackupError("INVALID_JSON", "El archivo está dañado o no contiene JSON válido.");
        }
        return validateBackup(candidate, options);
    }

    async function exportCurrent(state, options = {}) {
        const records = await imageStorage.listImages(options.indexedDb);
        const backup = await buildBackup(state, records, options);
        const text = JSON.stringify(backup, null, 2);
        return {
            backup,
            text,
            summary: summarize(backup.state, backup.images, new TextEncoder().encode(text).byteLength)
        };
    }

    function statsKeys(storage) {
        const keys = new Set([
            constants.STORAGE_KEY,
            constants.TAG_MIGRATION_BACKUP_KEY,
            constants.WEEKLY_MIGRATION_BACKUP_KEY,
            constants.CATEGORY_VOTING_MIGRATION_BACKUP_KEY,
            constants.LAST_EXPORT_KEY
        ]);
        if (Number.isInteger(storage.length) && typeof storage.key === "function") {
            for (let index = 0; index < storage.length; index += 1) {
                const key = storage.key(index);
                if (typeof key === "string" && key.startsWith("stats:v2:")) keys.add(key);
            }
        }
        return [...keys];
    }

    async function restoreValidated(validated, options = {}) {
        const localStorage = options.localStorage || root.localStorage;
        const oldRawState = localStorage.getItem(constants.STORAGE_KEY);
        const oldImages = await imageStorage.listImages(options.indexedDb);
        let safetyBackup = null;
        let recoverySnapshot = null;
        if (oldRawState !== null) {
            const parsed = storageService.parseStoredState(oldRawState);
            if (parsed.status === "ready") safetyBackup = await buildBackup(parsed.state, oldImages, options);
            else recoverySnapshot = await buildRecoverySnapshot(oldRawState, oldImages, options);
        }
        if (typeof options.beforeWrite === "function") {
            await options.beforeWrite({ safetyBackup, recoverySnapshot, rawState: oldRawState });
        }

        try {
            await imageStorage.replaceAllImages(validated.imageRecords, options.indexedDb);
            storageService.replaceExact(validated.state, localStorage);
            const stored = storageService.load(localStorage);
            if (stored.status !== "ready") throw new BackupError("FINAL_VALIDATION", "La validación final del estado restaurado falló.");
            const restoredImages = await imageStorage.listImages(options.indexedDb);
            await buildBackup(stored.state, restoredImages, options);
            return { state: stored.state, summary: validated.summary };
        } catch (cause) {
            try {
                await imageStorage.replaceAllImages(oldImages, options.indexedDb);
                if (oldRawState === null) localStorage.removeItem(constants.STORAGE_KEY);
                else localStorage.setItem(constants.STORAGE_KEY, oldRawState);
            } catch (rollbackError) {
                throw new BackupError(
                    "ROLLBACK_FAILED",
                    "La restauración falló y no fue posible completar el rollback. No cierres esta pestaña.",
                    [cause.message, rollbackError.message]
                );
            }
            throw new BackupError("RESTORE_FAILED", "La restauración falló. Tus datos anteriores fueron recuperados.", [cause.message]);
        }
    }

    async function resetAll(options = {}) {
        const localStorage = options.localStorage || root.localStorage;
        const keys = statsKeys(localStorage);
        const snapshot = new Map(keys.map((key) => [key, localStorage.getItem(key)]));
        const oldImages = await imageStorage.listImages(options.indexedDb);
        try {
            await imageStorage.replaceAllImages([], options.indexedDb);
            keys.forEach((key) => localStorage.removeItem(key));
        } catch (cause) {
            try {
                await imageStorage.replaceAllImages(oldImages, options.indexedDb);
                snapshot.forEach((value, key) => {
                    if (value === null) localStorage.removeItem(key);
                    else localStorage.setItem(key, value);
                });
            } catch (rollbackError) {
                throw new BackupError("ROLLBACK_FAILED", "El borrado falló y no fue posible completar el rollback.", [cause.message, rollbackError.message]);
            }
            throw new BackupError("RESET_FAILED", "El borrado falló. Tus datos anteriores fueron recuperados.", [cause.message]);
        }
        return { removedKeys: keys, removedImages: oldImages.length };
    }

    function friendlyError(error) {
        if (error && (error.name === "QuotaExceededError" || error.code === 22 || error.code === 1014)) {
            return "No hay espacio suficiente en este dispositivo. Libera almacenamiento y vuelve a intentarlo.";
        }
        return error && error.message ? error.message : "No se pudo completar la operación.";
    }

    namespace.backup = Object.freeze({
        BackupError,
        canonicalJson,
        buildBackup,
        buildRecoverySnapshot,
        validateBackup,
        parseBackupText,
        exportCurrent,
        restoreValidated,
        resetAll,
        summarize,
        friendlyError
    });
    root.StatsV2 = namespace;
})(globalThis);
