(function defineWeeklyMigration(root) {
    "use strict";

    const namespace = root.StatsV2 || {};
    const constants = namespace.constants;
    const data = namespace.data;
    const storageService = namespace.storage;

    if (!constants || !data || !storageService) {
        throw new Error("Stats V2 constants, data and storage must load before weekly migration.");
    }

    class WeeklyMigrationError extends Error {
        constructor(code, message) {
            super(message);
            this.name = "WeeklyMigrationError";
            this.code = code;
        }
    }

    function cloneState(state) {
        return JSON.parse(JSON.stringify(state));
    }

    function prepareLegacyShape(state) {
        const candidate = cloneState(state);
        if (candidate.weeks === undefined) candidate.weeks = [];
        if (candidate.weeklyVotes === undefined) candidate.weeklyVotes = [];
        if (!candidate.settings || typeof candidate.settings !== "object" || Array.isArray(candidate.settings)) {
            throw new WeeklyMigrationError("INVALID_STATE", "Phase 3 settings are missing or invalid.");
        }
        if (!Array.isArray(candidate.settings.voters)) {
            candidate.settings.voters = [];
        }
        if (candidate.settings.activeWeekId === undefined) candidate.settings.activeWeekId = null;
        return candidate;
    }

    function ensureVoters(candidate) {
        const unexpected = candidate.settings.voters.filter((voter) => (
            !voter || !constants.VOTER_IDS.includes(voter.id)
        ));
        if (unexpected.length > 0) {
            throw new WeeklyMigrationError("UNSUPPORTED_VOTER", "Weekly Voting only supports the permanent p1 and p2 user IDs.");
        }

        constants.VOTER_IDS.forEach((id) => {
            if (!candidate.settings.voters.some((voter) => voter.id === id)) {
                candidate.settings.voters.push({ id, name: id.toUpperCase() });
            }
        });
    }

    function upgradeWeek(week) {
        if (week.status === undefined) week.status = week.closed ? "CLOSED" : "OPEN";
        if (week.openedAt === undefined) week.openedAt = week.createdAt;
        if (week.closedAt === undefined) {
            week.closedAt = week.status === "CLOSED" ? (week.updatedAt || week.createdAt) : null;
        }
        if (week.updatedAt === undefined) week.updatedAt = week.createdAt;
    }

    function upgradeVote(vote) {
        if (vote.reasonTagIds === undefined) {
            vote.reasonTagIds = Array.isArray(vote.selectedTagIds) ? [...vote.selectedTagIds] : [];
        }
    }

    function ensureWeeklyVoting(state) {
        if (!state || typeof state !== "object" || Array.isArray(state)) {
            throw new WeeklyMigrationError("INVALID_STATE", "Phase 3 state must be an object.");
        }
        if (state.meta && state.meta.weeklyVotingVersion === 1) {
            const validation = data.validateState(state);
            if (!validation.valid) {
                throw new WeeklyMigrationError("INVALID_STATE", validation.errors.join(" "));
            }
            return { state: cloneState(state), changed: false };
        }

        const candidate = prepareLegacyShape(state);
        const legacyValidation = data.validateState(candidate);
        if (!legacyValidation.valid) {
            throw new WeeklyMigrationError("INVALID_STATE", legacyValidation.errors.join(" "));
        }

        ensureVoters(candidate);
        candidate.weeks.forEach(upgradeWeek);
        candidate.weeklyVotes.forEach(upgradeVote);

        const openWeeks = candidate.weeks.filter((week) => week.status === "OPEN");
        if (openWeeks.length > 1) {
            throw new WeeklyMigrationError("MULTIPLE_OPEN_WEEKS", "Phase 3 data contains more than one open week.");
        }
        candidate.settings.activeWeekId = openWeeks.length === 1 ? openWeeks[0].id : null;
        candidate.meta.weeklyVotingVersion = 1;

        const validation = data.validateState(candidate);
        if (!validation.valid) {
            throw new WeeklyMigrationError("INVALID_MIGRATION", validation.errors.join(" "));
        }
        return { state: candidate, changed: true };
    }

    function migrateStoredState(storageAdapter, timestamp = new Date().toISOString()) {
        const loaded = storageService.load(storageAdapter);
        if (loaded.status !== "ready") return loaded;

        const migration = ensureWeeklyVoting(loaded.state);
        if (!migration.changed) return { ...loaded, migrated: false };

        const saved = storageService.saveWithNamedBackup(
            migration.state,
            constants.WEEKLY_MIGRATION_BACKUP_KEY,
            storageAdapter,
            timestamp
        );
        const verified = storageService.load(storageAdapter);
        if (verified.status !== "ready") {
            throw new WeeklyMigrationError("VERIFY_FAILED", "Weekly Voting migration could not be verified after saving.");
        }
        return { status: "migrated", state: saved, errors: [], migrated: true };
    }

    namespace.weeklyMigration = Object.freeze({
        WeeklyMigrationError,
        ensureWeeklyVoting,
        migrateStoredState
    });
    root.StatsV2 = namespace;
})(globalThis);
