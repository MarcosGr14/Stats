(function defineDataModel(root) {
    "use strict";

    const namespace = root.StatsV2 || {};
    const constants = namespace.constants;

    if (!constants) {
        throw new Error("Stats V2 constants must load before the data model.");
    }

    const categoryIds = new Set(constants.CATEGORIES.map((category) => category.id));
    const ratingIds = new Set(constants.RATING_OPTIONS.map((rating) => rating.id));
    const collectionNames = Object.freeze([
        "participants",
        "groups",
        "tags",
        "participantTagAssignments",
        "weeks",
        "weeklyVotes"
    ]);

    function nowIso() {
        return new Date().toISOString();
    }

    function createId(prefix) {
        const randomId = root.crypto && typeof root.crypto.randomUUID === "function"
            ? root.crypto.randomUUID()
            : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        return `${prefix}-${randomId}`;
    }

    function requireText(value, field) {
        if (typeof value !== "string" || value.trim() === "") {
            throw new TypeError(`${field} must be a non-empty string.`);
        }
        const normalized = value.trim();
        if (normalized.length > constants.MAX_NAME_LENGTH) {
            throw new TypeError(`${field} must be ${constants.MAX_NAME_LENGTH} characters or fewer.`);
        }
        return normalized;
    }

    function requireChoice(value, choices, field) {
        if (!choices.includes(value)) {
            throw new TypeError(`${field} has an unsupported value.`);
        }
        return value;
    }

    function uniqueStrings(values, field) {
        if (!Array.isArray(values) || values.some((value) => typeof value !== "string")) {
            throw new TypeError(`${field} must be an array of strings.`);
        }
        return [...new Set(values)];
    }

    function createEmptyState(timestamp = nowIso()) {
        return {
            schemaVersion: constants.SCHEMA_VERSION,
            meta: {
                createdAt: timestamp,
                updatedAt: timestamp
            },
            participants: [],
            groups: [],
            tags: [],
            participantTagAssignments: [],
            weeks: [],
            weeklyVotes: [],
            settings: {
                activeWeekId: null,
                voters: [
                    { id: "p1", name: "P1" },
                    { id: "p2", name: "P2" }
                ]
            }
        };
    }

    function createParticipant(input, timestamp = nowIso()) {
        const categories = uniqueStrings(input.categoryIds || [], "categoryIds");
        if (categories.length === 0) {
            throw new TypeError("categoryIds requires at least one category.");
        }
        if (categories.some((id) => !categoryIds.has(id))) {
            throw new TypeError("categoryIds contains an unsupported category.");
        }

        return {
            id: input.id || createId("participant"),
            name: requireText(input.name, "name"),
            groupId: input.groupId || null,
            gender: requireChoice(input.gender, constants.GENDERS, "gender"),
            imageId: input.imageId || null,
            categoryIds: categories,
            archivedAt: input.archivedAt || null,
            createdAt: input.createdAt || timestamp,
            updatedAt: timestamp
        };
    }

    function createGroup(input, timestamp = nowIso()) {
        return {
            id: input.id || createId("group"),
            name: requireText(input.name, "name"),
            createdAt: input.createdAt || timestamp,
            updatedAt: timestamp
        };
    }

    function createTag(input, timestamp = nowIso()) {
        if (input.categoryId !== null && input.categoryId !== undefined && !categoryIds.has(input.categoryId)) {
            throw new TypeError("categoryId has an unsupported category.");
        }

        return {
            id: input.id || createId("tag"),
            name: requireText(input.name, "name"),
            categoryId: input.categoryId || null,
            type: requireChoice(input.type, constants.TAG_TYPES, "type"),
            predefined: Boolean(input.predefined),
            createdAt: input.createdAt || timestamp,
            updatedAt: timestamp
        };
    }

    function createTagAssignment(input, timestamp = nowIso()) {
        return {
            id: input.id || createId("assignment"),
            participantId: requireText(input.participantId, "participantId"),
            tagId: requireText(input.tagId, "tagId"),
            assignedAt: input.assignedAt || timestamp,
            removedAt: input.removedAt || null
        };
    }

    function createWeek(input, timestamp = nowIso()) {
        return {
            id: input.id || createId("week"),
            label: requireText(input.label, "label"),
            startDate: requireText(input.startDate, "startDate"),
            endDate: requireText(input.endDate, "endDate"),
            closed: Boolean(input.closed),
            createdAt: input.createdAt || timestamp,
            updatedAt: timestamp
        };
    }

    function createWeeklyVote(input, timestamp = nowIso()) {
        const rating = requireChoice(input.rating, [...ratingIds], "rating");
        return {
            id: input.id || createId("vote"),
            weekId: requireText(input.weekId, "weekId"),
            participantId: requireText(input.participantId, "participantId"),
            userId: requireText(input.userId, "userId"),
            rating,
            selectedTagIds: uniqueStrings(input.selectedTagIds || [], "selectedTagIds"),
            note: typeof input.note === "string" ? input.note.trim() : "",
            createdAt: input.createdAt || timestamp,
            updatedAt: timestamp
        };
    }

    function isRecord(value) {
        return value !== null && typeof value === "object" && !Array.isArray(value);
    }

    function validateUniqueIds(items, collection, errors) {
        const seen = new Set();
        items.forEach((item, index) => {
            if (!isRecord(item) || typeof item.id !== "string" || item.id.trim() === "") {
                errors.push(`${collection}[${index}] requires a string id.`);
                return;
            }
            if (seen.has(item.id)) {
                errors.push(`${collection} contains duplicate id ${item.id}.`);
            }
            seen.add(item.id);
        });
    }

    function requireEntityText(entity, field, path, errors) {
        if (typeof entity[field] !== "string" || entity[field].trim() === "") {
            errors.push(`${path}.${field} must be a non-empty string.`);
        }
    }

    function requireNullableText(entity, field, path, errors) {
        if (entity[field] !== null && typeof entity[field] !== "string") {
            errors.push(`${path}.${field} must be null or a string.`);
        }
    }

    function validateTimestamps(entity, path, errors) {
        requireEntityText(entity, "createdAt", path, errors);
        requireEntityText(entity, "updatedAt", path, errors);
    }

    function validateState(state) {
        const errors = [];

        if (!isRecord(state)) {
            return { valid: false, errors: ["State must be an object."] };
        }
        if (state.schemaVersion !== constants.SCHEMA_VERSION) {
            errors.push(`schemaVersion must be ${constants.SCHEMA_VERSION}.`);
        }
        if (!isRecord(state.meta) || typeof state.meta.createdAt !== "string" || typeof state.meta.updatedAt !== "string") {
            errors.push("meta requires createdAt and updatedAt timestamps.");
        }

        collectionNames.forEach((collection) => {
            if (!Array.isArray(state[collection])) {
                errors.push(`${collection} must be an array.`);
                return;
            }
            validateUniqueIds(state[collection], collection, errors);
        });

        if (!isRecord(state.settings) || !Array.isArray(state.settings.voters)) {
            errors.push("settings requires a voters array.");
        } else {
            validateUniqueIds(state.settings.voters, "settings.voters", errors);
            state.settings.voters.forEach((voter, index) => {
                if (typeof voter.name !== "string" || voter.name.trim() === "") {
                    errors.push(`settings.voters[${index}] requires a name.`);
                }
            });
            if (state.settings.activeWeekId !== null && typeof state.settings.activeWeekId !== "string") {
                errors.push("settings.activeWeekId must be null or a string.");
            }
        }

        if (Array.isArray(state.participants)) {
            state.participants.forEach((participant, index) => {
                if (!isRecord(participant)) return;
                const path = `participants[${index}]`;
                requireEntityText(participant, "name", path, errors);
                requireNullableText(participant, "groupId", path, errors);
                requireNullableText(participant, "imageId", path, errors);
                requireNullableText(participant, "archivedAt", path, errors);
                validateTimestamps(participant, path, errors);
                if (!constants.GENDERS.includes(participant.gender)) {
                    errors.push(`${path} has an unsupported gender.`);
                }
                if (!Array.isArray(participant.categoryIds)
                    || participant.categoryIds.length === 0
                    || participant.categoryIds.some((id) => !categoryIds.has(id))
                    || new Set(participant.categoryIds).size !== participant.categoryIds.length) {
                    errors.push(`${path} has invalid categoryIds.`);
                }
            });
        }


        if (Array.isArray(state.groups)) {
            state.groups.forEach((group, index) => {
                if (!isRecord(group)) return;
                const path = `groups[${index}]`;
                requireEntityText(group, "name", path, errors);
                validateTimestamps(group, path, errors);
            });
        }

        if (Array.isArray(state.tags)) {
            state.tags.forEach((tag, index) => {
                if (!isRecord(tag)) return;
                const path = `tags[${index}]`;
                requireEntityText(tag, "name", path, errors);
                requireNullableText(tag, "categoryId", path, errors);
                validateTimestamps(tag, path, errors);
                if (!constants.TAG_TYPES.includes(tag.type)) {
                    errors.push(`${path} has an unsupported type.`);
                }
                if (tag.categoryId !== null && !categoryIds.has(tag.categoryId)) {
                    errors.push(`${path} has an unsupported categoryId.`);
                }
                if (typeof tag.predefined !== "boolean") errors.push(`${path}.predefined must be boolean.`);
            });
        }


        if (Array.isArray(state.participantTagAssignments)) {
            state.participantTagAssignments.forEach((assignment, index) => {
                if (!isRecord(assignment)) return;
                const path = `participantTagAssignments[${index}]`;
                requireEntityText(assignment, "participantId", path, errors);
                requireEntityText(assignment, "tagId", path, errors);
                requireEntityText(assignment, "assignedAt", path, errors);
                requireNullableText(assignment, "removedAt", path, errors);
            });
        }

        if (Array.isArray(state.weeks)) {
            state.weeks.forEach((week, index) => {
                if (!isRecord(week)) return;
                const path = `weeks[${index}]`;
                requireEntityText(week, "label", path, errors);
                requireEntityText(week, "startDate", path, errors);
                requireEntityText(week, "endDate", path, errors);
                validateTimestamps(week, path, errors);
                if (typeof week.closed !== "boolean") errors.push(`${path}.closed must be boolean.`);
            });
        }

        if (Array.isArray(state.weeklyVotes)) {
            state.weeklyVotes.forEach((vote, index) => {
                if (!isRecord(vote)) return;
                const path = `weeklyVotes[${index}]`;
                requireEntityText(vote, "weekId", path, errors);
                requireEntityText(vote, "participantId", path, errors);
                requireEntityText(vote, "userId", path, errors);
                validateTimestamps(vote, path, errors);
                if (!ratingIds.has(vote.rating)) errors.push(`${path} has an unsupported rating.`);
                if (!Array.isArray(vote.selectedTagIds)
                    || vote.selectedTagIds.some((id) => typeof id !== "string")
                    || new Set(vote.selectedTagIds).size !== vote.selectedTagIds.length) {
                    errors.push(`${path} has invalid selectedTagIds.`);
                }
                if (typeof vote.note !== "string") errors.push(`${path}.note must be a string.`);
            });
        }

        if (collectionNames.every((name) => Array.isArray(state[name])) && isRecord(state.settings)) {
            const participantIds = new Set(state.participants.map((item) => item && item.id));
            const groupIds = new Set(state.groups.map((item) => item && item.id));
            const tagIds = new Set(state.tags.map((item) => item && item.id));
            const weekIds = new Set(state.weeks.map((item) => item && item.id));
            const voterIds = new Set(Array.isArray(state.settings.voters)
                ? state.settings.voters.map((item) => item && item.id)
                : []);

            state.participants.forEach((participant, index) => {
                if (participant && participant.groupId !== null && !groupIds.has(participant.groupId)) {
                    errors.push(`participants[${index}].groupId references a missing group.`);
                }
            });
            state.participantTagAssignments.forEach((assignment, index) => {
                if (!assignment) return;
                if (!participantIds.has(assignment.participantId)) {
                    errors.push(`participantTagAssignments[${index}].participantId references a missing participant.`);
                }
                if (!tagIds.has(assignment.tagId)) {
                    errors.push(`participantTagAssignments[${index}].tagId references a missing tag.`);
                }
            });
            state.weeklyVotes.forEach((vote, index) => {
                if (!vote) return;
                if (!weekIds.has(vote.weekId)) errors.push(`weeklyVotes[${index}].weekId references a missing week.`);
                if (!participantIds.has(vote.participantId)) {
                    errors.push(`weeklyVotes[${index}].participantId references a missing participant.`);
                }
                if (!voterIds.has(vote.userId)) errors.push(`weeklyVotes[${index}].userId references a missing voter.`);
                if (Array.isArray(vote.selectedTagIds)) {
                    vote.selectedTagIds.forEach((tagId) => {
                        if (!tagIds.has(tagId)) errors.push(`weeklyVotes[${index}] references a missing tag.`);
                    });
                }
            });
            if (state.settings.activeWeekId !== null && !weekIds.has(state.settings.activeWeekId)) {
                errors.push("settings.activeWeekId references a missing week.");
            }
        }

        return { valid: errors.length === 0, errors };
    }

    namespace.data = Object.freeze({
        collectionNames,
        createId,
        createEmptyState,
        createParticipant,
        createGroup,
        createTag,
        createTagAssignment,
        createWeek,
        createWeeklyVote,
        validateState
    });
    root.StatsV2 = namespace;
})(globalThis);
