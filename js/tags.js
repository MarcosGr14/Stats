(function defineTags(root) {
    "use strict";

    const namespace = root.StatsV2 || {};
    const constants = namespace.constants;
    const data = namespace.data;

    if (!constants || !data) {
        throw new Error("Stats V2 constants and data model must load before tags.");
    }

    class TagError extends Error {
        constructor(code, message) {
            super(message);
            this.name = "TagError";
            this.code = code;
        }
    }

    const definitions = [];

    function addDefinitions(categoryId, type, names) {
        names.forEach((name) => definitions.push(Object.freeze({ categoryId, type, name })));
    }

    addDefinitions("vocal", "strength", [
        "High Notes", "Vocal Power", "Stable Live", "Vocal Range", "Vocal Tone", "Falsetto",
        "Head Voice", "Chest Voice", "Belting", "Breath Control", "Agility", "Runs & Riffs",
        "Harmonies", "Emotional Delivery", "Versatility"
    ]);
    addDefinitions("vocal", "weakness", [
        "Pitch Instability", "Weak Projection", "Breath Issues", "Limited Range", "Inconsistent Live",
        "Strained High Notes"
    ]);
    addDefinitions("rap", "strength", [
        "Flow", "Fast Rap", "Diction", "Rhythm", "Tone", "Delivery", "Freestyle", "Wordplay",
        "Breath Control", "Stage Delivery", "Versatility", "Low Register", "Aggressive Flow", "Melodic Rap"
    ]);
    addDefinitions("rap", "weakness", [
        "Weak Diction", "Inconsistent Flow", "Breath Issues", "Low Projection", "Limited Variation"
    ]);
    addDefinitions("dance", "strength", [
        "Precision", "Isolation", "Footwork", "Body Control", "Musicality", "Power", "Fluidity",
        "Freestyle", "Synchronization", "Clean Lines", "Hip-hop", "Contemporary", "Waacking",
        "Popping", "Versatility"
    ]);
    addDefinitions("dance", "weakness", [
        "Timing Issues", "Low Energy", "Stiff Movement", "Weak Isolation", "Inconsistent Precision",
        "Limited Versatility"
    ]);
    addDefinitions("stage", "strength", [
        "Stage Presence", "Facial Expressions", "Charisma", "Camera Awareness", "Crowd Control", "Energy",
        "Confidence", "Concept Adaptability", "Center Presence", "Consistency"
    ]);
    addDefinitions("stage", "weakness", [
        "Low Stage Energy", "Limited Expressions", "Camera Awareness Issues", "Inconsistent Presence",
        "Low Confidence"
    ]);
    addDefinitions("general", "neutral", [
        "All-Rounder", "Ace", "Fast Improvement", "Consistent", "Standout Performer", "Reliable Live",
        "Great Chemistry", "Concept Chameleon"
    ]);

    const PREDEFINED_TAGS = Object.freeze(definitions);
    const tagCategories = new Set(constants.TAG_CATEGORIES.map((category) => category.id));

    function cloneState(state) {
        return JSON.parse(JSON.stringify(state));
    }

    function normalizeText(value) {
        return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
    }

    function comparableText(value) {
        return normalizeText(value).toLocaleLowerCase("es");
    }

    function tagKey(input) {
        return `${input.categoryId}\u0000${input.type}\u0000${comparableText(input.name)}`;
    }

    function slug(value) {
        return normalizeText(value)
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/&/g, " and ")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
    }

    function predefinedId(definition) {
        return `tag-${definition.categoryId}-${definition.type}-${slug(definition.name)}`;
    }

    function assertState(state) {
        const validation = data.validateState(state);
        if (!validation.valid) {
            throw new TagError("INVALID_STATE", validation.errors.join(" "));
        }
    }

    function assertCategory(categoryId) {
        if (!tagCategories.has(categoryId)) {
            throw new TagError("INVALID_CATEGORY", "Selecciona una categoría de tag válida.");
        }
        return categoryId;
    }

    function assertType(type) {
        if (!constants.TAG_TYPES.includes(type)) {
            throw new TagError("INVALID_TYPE", "Selecciona Fortalezas, Por mejorar o Especial.");
        }
        return type;
    }

    function assertName(name) {
        const normalized = normalizeText(name);
        if (!normalized) throw new TagError("EMPTY_NAME", "El nombre del tag es obligatorio.");
        if (normalized.length > constants.MAX_TAG_NAME_LENGTH) {
            throw new TagError(
                "NAME_TOO_LONG",
                `El nombre debe tener ${constants.MAX_TAG_NAME_LENGTH} caracteres o menos.`
            );
        }
        return normalized;
    }

    function findParticipant(state, participantId) {
        const participant = state.participants.find((item) => item.id === participantId);
        if (!participant) throw new TagError("PARTICIPANT_NOT_FOUND", "Participante no encontrado.");
        return participant;
    }

    function findTag(state, tagId) {
        const tag = state.tags.find((item) => item.id === tagId);
        if (!tag) throw new TagError("TAG_NOT_FOUND", "Tag no encontrado.");
        return tag;
    }

    function ensurePredefinedCatalog(state, timestamp = new Date().toISOString()) {
        assertState(state);
        const nextState = cloneState(state);
        const tagsById = new Map(nextState.tags.map((tag) => [tag.id, tag]));
        const tagsByKey = new Map(nextState.tags.map((tag) => [tagKey(tag), tag]));
        let addedCount = 0;
        let upgradedCount = 0;

        PREDEFINED_TAGS.forEach((definition) => {
            const id = predefinedId(definition);
            const collision = tagsById.get(id);
            if (collision && tagKey(collision) !== tagKey(definition)) {
                throw new TagError("CATALOG_ID_COLLISION", `El ID predefinido ${id} ya está en uso.`);
            }

            const equivalent = tagsByKey.get(tagKey(definition));
            if (equivalent) {
                if (!equivalent.predefined) {
                    equivalent.predefined = true;
                    equivalent.updatedAt = timestamp;
                    upgradedCount += 1;
                }
                return;
            }

            const tag = data.createTag({ ...definition, id, predefined: true }, timestamp);
            nextState.tags.push(tag);
            tagsById.set(tag.id, tag);
            tagsByKey.set(tagKey(tag), tag);
            addedCount += 1;
        });

        assertState(nextState);
        return {
            state: nextState,
            addedCount,
            upgradedCount,
            changed: addedCount > 0 || upgradedCount > 0
        };
    }

    function createCustomTag(state, input, timestamp = new Date().toISOString()) {
        assertState(state);
        const candidate = {
            name: assertName(input.name),
            categoryId: assertCategory(input.categoryId),
            type: assertType(input.type)
        };
        const existing = state.tags.find((tag) => tagKey(tag) === tagKey(candidate));
        if (existing) {
            return { state: cloneState(state), tag: { ...existing }, created: false };
        }

        const nextState = cloneState(state);
        const tag = data.createTag({ ...candidate, predefined: false }, timestamp);
        nextState.tags.push(tag);
        assertState(nextState);
        return { state: nextState, tag, created: true };
    }

    function updateCustomTag(state, tagId, changes, timestamp = new Date().toISOString()) {
        assertState(state);
        const current = findTag(state, tagId);
        if (current.predefined) throw new TagError("PREDEFINED_PROTECTED", "Los tags predefinidos no se editan.");
        const usage = tagUsage(state, tagId);
        if (usage.totalReferences > 0) {
            throw new TagError("TAG_IN_USE", "Este tag tiene relaciones de perfil o razones semanales y no se puede editar.");
        }

        const candidate = {
            name: assertName(changes.name),
            categoryId: assertCategory(changes.categoryId),
            type: assertType(changes.type)
        };
        const duplicate = state.tags.find((tag) => tag.id !== tagId && tagKey(tag) === tagKey(candidate));
        if (duplicate) throw new TagError("DUPLICATE_TAG", "Ya existe un tag igual en el catálogo.");

        const nextState = cloneState(state);
        const target = nextState.tags.find((tag) => tag.id === tagId);
        Object.assign(target, candidate, { updatedAt: timestamp });
        assertState(nextState);
        return { state: nextState, tag: target };
    }

    function assignTag(state, participantId, tagId, timestamp = new Date().toISOString()) {
        assertState(state);
        const participant = findParticipant(state, participantId);
        const tag = findTag(state, tagId);
        const existing = state.participantTagAssignments.find((assignment) => (
            assignment.participantId === participantId
            && assignment.tagId === tagId
            && assignment.removedAt === null
        ));
        if (existing) {
            return {
                state: cloneState(state),
                assignment: { ...existing },
                created: false,
                categoryWarning: tag.categoryId !== "general" && !participant.categoryIds.includes(tag.categoryId)
            };
        }

        const nextState = cloneState(state);
        const assignment = data.createTagAssignment({ participantId, tagId }, timestamp);
        nextState.participantTagAssignments.push(assignment);
        assertState(nextState);
        return {
            state: nextState,
            assignment,
            created: true,
            categoryWarning: tag.categoryId !== "general" && !participant.categoryIds.includes(tag.categoryId)
        };
    }

    function removeTag(state, participantId, tagId, timestamp = new Date().toISOString()) {
        assertState(state);
        findParticipant(state, participantId);
        findTag(state, tagId);
        const nextState = cloneState(state);
        const assignment = nextState.participantTagAssignments.find((item) => (
            item.participantId === participantId && item.tagId === tagId && item.removedAt === null
        ));
        if (!assignment) throw new TagError("ASSIGNMENT_NOT_FOUND", "Este participante no tiene asignado el tag.");
        assignment.removedAt = timestamp;
        assertState(nextState);
        return { state: nextState, assignment };
    }

    function activeTagsForParticipant(state, participantId) {
        findParticipant(state, participantId);
        const tagsById = new Map(state.tags.map((tag) => [tag.id, tag]));
        return state.participantTagAssignments
            .filter((assignment) => assignment.participantId === participantId && assignment.removedAt === null)
            .map((assignment) => ({ tag: tagsById.get(assignment.tagId), assignment }))
            .filter((item) => item.tag)
            .sort((left, right) => left.tag.name.localeCompare(right.tag.name, "es", { sensitivity: "base" }));
    }

    function tagUsage(state, tagId) {
        findTag(state, tagId);
        const assignments = state.participantTagAssignments.filter((assignment) => assignment.tagId === tagId);
        const reasonVotes = state.weeklyVotes.filter((vote) => (
            Array.isArray(vote.reasonTagIds) && vote.reasonTagIds.includes(tagId)
        ));
        const activeParticipantIds = [...new Set(assignments
            .filter((assignment) => assignment.removedAt === null)
            .map((assignment) => assignment.participantId))];
        return {
            activeCount: activeParticipantIds.length,
            activeParticipantIds,
            totalAssignments: assignments.length,
            reasonVoteCount: reasonVotes.length,
            totalReferences: assignments.length + reasonVotes.length
        };
    }

    function deleteCustomTag(state, tagId) {
        assertState(state);
        const tag = findTag(state, tagId);
        if (tag.predefined) throw new TagError("PREDEFINED_PROTECTED", "Los tags predefinidos no se pueden borrar.");
        const usage = tagUsage(state, tagId);
        if (usage.totalReferences > 0) {
            throw new TagError(
                "TAG_IN_USE",
                `Este tag conserva ${usage.totalReferences} relación(es) de perfil o voto y no se puede borrar.`
            );
        }
        const nextState = cloneState(state);
        nextState.tags = nextState.tags.filter((item) => item.id !== tagId);
        assertState(nextState);
        return { state: nextState, tag: { ...tag } };
    }

    function filterCatalog(state, options = {}) {
        const query = comparableText(options.query || "");
        const categoryId = options.categoryId || "all";
        const type = options.type || "all";
        return state.tags
            .filter((tag) => (
                (!query || comparableText(tag.name).includes(query))
                && (categoryId === "all" || tag.categoryId === categoryId)
                && (type === "all" || tag.type === type)
            ))
            .sort((left, right) => (
                left.categoryId.localeCompare(right.categoryId)
                || left.type.localeCompare(right.type)
                || left.name.localeCompare(right.name, "es", { sensitivity: "base" })
            ));
    }

    namespace.tags = Object.freeze({
        TagError,
        PREDEFINED_TAGS,
        predefinedId,
        ensurePredefinedCatalog,
        createCustomTag,
        updateCustomTag,
        assignTag,
        removeTag,
        activeTagsForParticipant,
        tagUsage,
        deleteCustomTag,
        filterCatalog
    });
    root.StatsV2 = namespace;
})(globalThis);
