(function defineParticipants(root) {
    "use strict";

    const namespace = root.StatsV2 || {};
    const constants = namespace.constants;
    const data = namespace.data;

    if (!constants || !data) {
        throw new Error("Stats V2 constants and data model must load before participants.");
    }

    class ParticipantError extends Error {
        constructor(code, message) {
            super(message);
            this.name = "ParticipantError";
            this.code = code;
        }
    }

    function cloneState(state) {
        return JSON.parse(JSON.stringify(state));
    }

    function normalizeName(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function comparableName(value) {
        return normalizeName(value).toLocaleLowerCase("es");
    }

    function assertState(state) {
        const validation = data.validateState(state);
        if (!validation.valid) {
            throw new ParticipantError("INVALID_STATE", validation.errors.join(" "));
        }
    }

    function assertName(name, field = "name") {
        const normalized = normalizeName(name);
        if (!normalized) {
            throw new ParticipantError("EMPTY_NAME", `${field} is required.`);
        }
        if (normalized.length > constants.MAX_NAME_LENGTH) {
            throw new ParticipantError(
                "NAME_TOO_LONG",
                `${field} must be ${constants.MAX_NAME_LENGTH} characters or fewer.`
            );
        }
        return normalized;
    }

    function assertGroupExists(state, groupId) {
        if (groupId !== null && !state.groups.some((group) => group.id === groupId)) {
            throw new ParticipantError("MISSING_GROUP", "The selected group does not exist.");
        }
    }

    function assertNoActiveDuplicate(state, name, ignoredParticipantId = null) {
        const duplicate = state.participants.find((participant) => (
            participant.id !== ignoredParticipantId
            && participant.archivedAt === null
            && comparableName(participant.name) === comparableName(name)
        ));
        if (duplicate) {
            throw new ParticipantError(
                "DUPLICATE_PARTICIPANT",
                `An active participant named ${normalizeName(name)} already exists.`
            );
        }
    }

    function findParticipant(state, participantId) {
        const participant = state.participants.find((item) => item.id === participantId);
        if (!participant) {
            throw new ParticipantError("NOT_FOUND", "Participant not found.");
        }
        return participant;
    }

    function createGroup(state, name, timestamp = new Date().toISOString()) {
        assertState(state);
        const normalized = assertName(name, "group name");
        const existing = state.groups.find((group) => comparableName(group.name) === comparableName(normalized));
        if (existing) {
            return { state: cloneState(state), group: { ...existing }, created: false };
        }

        const nextState = cloneState(state);
        const group = data.createGroup({ name: normalized }, timestamp);
        nextState.groups.push(group);
        assertState(nextState);
        return { state: nextState, group, created: true };
    }

    function createParticipant(state, input, timestamp = new Date().toISOString()) {
        assertState(state);
        const name = assertName(input.name);
        const groupId = input.groupId || null;
        assertGroupExists(state, groupId);
        assertNoActiveDuplicate(state, name);

        const participant = data.createParticipant({ ...input, name, groupId }, timestamp);
        const nextState = cloneState(state);
        nextState.participants.push(participant);
        assertState(nextState);
        return { state: nextState, participant };
    }

    function updateParticipant(state, participantId, changes, timestamp = new Date().toISOString()) {
        assertState(state);
        const current = findParticipant(state, participantId);
        const name = assertName(changes.name);
        const groupId = changes.groupId || null;
        assertGroupExists(state, groupId);
        if (current.archivedAt === null) {
            assertNoActiveDuplicate(state, name, participantId);
        }

        const updated = data.createParticipant({
            ...current,
            ...changes,
            id: current.id,
            name,
            groupId,
            createdAt: current.createdAt,
            archivedAt: current.archivedAt
        }, timestamp);
        const nextState = cloneState(state);
        const index = nextState.participants.findIndex((item) => item.id === participantId);
        nextState.participants[index] = updated;
        assertState(nextState);
        return { state: nextState, participant: updated };
    }

    function archiveParticipant(state, participantId, timestamp = new Date().toISOString()) {
        assertState(state);
        const current = findParticipant(state, participantId);
        const nextState = cloneState(state);
        const archived = nextState.participants.find((item) => item.id === participantId);
        archived.archivedAt = current.archivedAt || timestamp;
        archived.updatedAt = timestamp;
        assertState(nextState);
        return { state: nextState, participant: archived };
    }

    function restoreParticipant(state, participantId, timestamp = new Date().toISOString()) {
        assertState(state);
        const current = findParticipant(state, participantId);
        assertNoActiveDuplicate(state, current.name, participantId);
        const nextState = cloneState(state);
        const restored = nextState.participants.find((item) => item.id === participantId);
        restored.archivedAt = null;
        restored.updatedAt = timestamp;
        assertState(nextState);
        return { state: nextState, participant: restored };
    }

    function historicalRelations(state, participantId) {
        return {
            votes: state.weeklyVotes.filter((vote) => vote.participantId === participantId).length,
            tagAssignments: state.participantTagAssignments.filter(
                (assignment) => assignment.participantId === participantId
            ).length
        };
    }

    function canDeleteParticipant(state, participantId) {
        findParticipant(state, participantId);
        const relations = historicalRelations(state, participantId);
        return {
            allowed: relations.votes === 0 && relations.tagAssignments === 0,
            relations
        };
    }

    function deleteParticipant(state, participantId) {
        assertState(state);
        const participant = findParticipant(state, participantId);
        const deletion = canDeleteParticipant(state, participantId);
        if (!deletion.allowed) {
            throw new ParticipantError(
                "ARCHIVE_REQUIRED",
                "This participant has historical relations and must be archived instead."
            );
        }

        const nextState = cloneState(state);
        nextState.participants = nextState.participants.filter((item) => item.id !== participantId);
        assertState(nextState);
        return { state: nextState, participant: { ...participant } };
    }

    function filterParticipants(state, options = {}) {
        const query = comparableName(options.query || "");
        const gender = options.gender || "all";
        const status = options.status || "active";
        const categoryId = options.categoryId || "all";
        const sort = options.sort || "a-z";
        const groupsById = new Map(state.groups.map((group) => [group.id, group.name]));

        const filtered = state.participants.filter((participant) => {
            const groupName = participant.groupId ? groupsById.get(participant.groupId) || "" : "";
            const matchesQuery = !query
                || comparableName(participant.name).includes(query)
                || comparableName(groupName).includes(query);
            const matchesGender = gender === "all" || participant.gender === gender;
            const matchesStatus = status === "all"
                || (status === "active" && participant.archivedAt === null)
                || (status === "archived" && participant.archivedAt !== null);
            const matchesCategory = categoryId === "all" || participant.categoryIds.includes(categoryId);
            return matchesQuery && matchesGender && matchesStatus && matchesCategory;
        });

        return filtered.sort((left, right) => {
            if (sort === "recent") {
                return Date.parse(right.createdAt) - Date.parse(left.createdAt)
                    || left.name.localeCompare(right.name, "es", { sensitivity: "base" });
            }
            return left.name.localeCompare(right.name, "es", { sensitivity: "base" });
        });
    }

    namespace.participants = Object.freeze({
        ParticipantError,
        createGroup,
        createParticipant,
        updateParticipant,
        archiveParticipant,
        restoreParticipant,
        canDeleteParticipant,
        deleteParticipant,
        historicalRelations,
        filterParticipants
    });
    root.StatsV2 = namespace;
})(globalThis);
