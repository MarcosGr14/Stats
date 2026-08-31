(function defineStorage(root) {
    "use strict";

    const namespace = root.StatsV2 || {};
    const constants = namespace.constants;
    const data = namespace.data;

    if (!constants || !data) {
        throw new Error("Stats V2 constants and data model must load before storage.");
    }

    function defaultStorage() {
        if (!root.localStorage) {
            throw new Error("localStorage is unavailable.");
        }
        return root.localStorage;
    }

    function parseStoredState(rawValue) {
        try {
            const state = JSON.parse(rawValue);
            const validation = data.validateState(state);
            return validation.valid
                ? { status: "ready", state, errors: [] }
                : { status: "invalid", state: null, errors: validation.errors };
        } catch (error) {
            return { status: "invalid", state: null, errors: [error.message] };
        }
    }

    function load(storage = defaultStorage()) {
        try {
            const rawValue = storage.getItem(constants.STORAGE_KEY);
            if (rawValue === null) {
                return { status: "missing", state: null, errors: [] };
            }
            return parseStoredState(rawValue);
        } catch (error) {
            return { status: "unavailable", state: null, errors: [error.message] };
        }
    }

    function save(state, storage = defaultStorage(), timestamp = new Date().toISOString()) {
        const candidate = JSON.parse(JSON.stringify(state));
        if (candidate.meta) {
            candidate.meta.updatedAt = timestamp;
        }

        const validation = data.validateState(candidate);
        if (!validation.valid) {
            const error = new TypeError(`Refusing to save invalid Stats V2 state: ${validation.errors.join(" ")}`);
            error.validationErrors = validation.errors;
            throw error;
        }

        storage.setItem(constants.STORAGE_KEY, JSON.stringify(candidate));
        return candidate;
    }

    function initialize(storage = defaultStorage(), timestamp = new Date().toISOString()) {
        let legacyRemoved = false;

        try {
            if (storage.getItem(constants.LEGACY_STORAGE_KEY) !== null) {
                storage.removeItem(constants.LEGACY_STORAGE_KEY);
                legacyRemoved = true;
            }

            const stored = load(storage);
            if (stored.status === "ready") {
                return { ...stored, legacyRemoved };
            }
            if (stored.status === "invalid") {
                return {
                    ...stored,
                    state: data.createEmptyState(timestamp),
                    legacyRemoved
                };
            }
            if (stored.status === "unavailable") {
                return {
                    ...stored,
                    state: data.createEmptyState(timestamp),
                    legacyRemoved
                };
            }

            const state = save(data.createEmptyState(timestamp), storage, timestamp);
            return { status: "initialized", state, errors: [], legacyRemoved };
        } catch (error) {
            return {
                status: "unavailable",
                state: data.createEmptyState(timestamp),
                errors: [error.message],
                legacyRemoved
            };
        }
    }

    namespace.storage = Object.freeze({ initialize, load, save, parseStoredState });
    root.StatsV2 = namespace;
})(globalThis);
