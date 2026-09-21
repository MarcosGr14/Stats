(function defineDataModel(root) {
    "use strict";

    const namespace = root.StatsV2 || {};
    const constants = namespace.constants;

    if (!constants) {
        throw new Error("Stats V2 constants must load before the data model.");
    }

    const categoryIds = new Set(constants.CATEGORIES.map((category) => category.id));
    const tagCategoryIds = new Set(constants.TAG_CATEGORIES.map((category) => category.id));
    const ratingIds = new Set(constants.RATING_OPTIONS.map((rating) => rating.id));
    const weekStatuses = new Set(constants.WEEK_STATUSES);
    const ISO_WEEK_ID_PATTERN = /^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/;
    const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
    const DAY_MS = 24 * 60 * 60 * 1000;
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

    function isoWeekIdFromMonday(date) {
        const thursday = new Date(date.getTime() + 3 * DAY_MS);
        const isoYear = thursday.getUTCFullYear();
        const januaryFourth = new Date(Date.UTC(isoYear, 0, 4));
        const januaryFourthWeekday = (januaryFourth.getUTCDay() + 6) % 7;
        const firstMonday = new Date(januaryFourth.getTime() - januaryFourthWeekday * DAY_MS);
        const weekNumber = Math.floor((date.getTime() - firstMonday.getTime()) / (7 * DAY_MS)) + 1;
        return `${isoYear}-W${String(weekNumber).padStart(2, "0")}`;
    }

    function isValidIsoWeekRange(week) {
        if (!DATE_KEY_PATTERN.test(week.startDate) || !DATE_KEY_PATTERN.test(week.endDate)) return false;
        const start = new Date(`${week.startDate}T00:00:00.000Z`);
        const end = new Date(`${week.endDate}T00:00:00.000Z`);
        return !Number.isNaN(start.getTime())
            && !Number.isNaN(end.getTime())
            && start.getUTCDay() === 1
            && end.getUTCDay() === 0
            && end.getTime() - start.getTime() === 6 * DAY_MS
            && isoWeekIdFromMonday(start) === week.id;
    }

    function createEmptyState(timestamp = nowIso()) {
        return {
            schemaVersion: constants.SCHEMA_VERSION,
            meta: {
                createdAt: timestamp,
                updatedAt: timestamp,
                weeklyVotingVersion: 2
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
        const categoryId = input.categoryId || "general";
        if (!tagCategoryIds.has(categoryId)) {
            throw new TypeError("categoryId has an unsupported category.");
        }

        return {
            id: input.id || createId("tag"),
            name: requireText(input.name, "name"),
            categoryId,
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
        const id = requireText(input.id, "id");
        if (!ISO_WEEK_ID_PATTERN.test(id)) {
            throw new TypeError("id must be an ISO week id such as 2026-W36.");
        }
        const week = {
            id,
            label: requireText(input.label, "label"),
            startDate: requireText(input.startDate, "startDate"),
            endDate: requireText(input.endDate, "endDate"),
            status: requireChoice(input.status || "OPEN", constants.WEEK_STATUSES, "status"),
            openedAt: input.openedAt || timestamp,
            closedAt: input.closedAt || null,
            reopenedAt: input.reopenedAt || null,
            reopenCount: Number.isInteger(input.reopenCount) ? input.reopenCount : 0,
            createdAt: input.createdAt || timestamp,
            updatedAt: timestamp
        };
        if (!isValidIsoWeekRange(week)) {
            throw new TypeError("startDate and endDate must match the ISO Monday-Sunday week id.");
        }
        return week;
    }

    function createWeeklyVote(input, timestamp = nowIso()) {
        const rating = requireChoice(input.rating, [...ratingIds], "rating");
        return {
            id: input.id || createId("vote"),
            weekId: requireText(input.weekId, "weekId"),
            participantId: requireText(input.participantId, "participantId"),
            categoryId: requireChoice(input.categoryId, [...categoryIds], "categoryId"),
            userId: requireText(input.userId, "userId"),
            rating,
            reasonTagIds: uniqueStrings(input.reasonTagIds || input.selectedTagIds || [], "reasonTagIds"),
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
        } else if (state.meta.weeklyVotingVersion !== undefined
            && ![1, 2].includes(state.meta.weeklyVotingVersion)) {
            errors.push("meta.weeklyVotingVersion must be 1 or 2 when present.");
        }
        const weeklyVotingVersion = isRecord(state.meta) ? state.meta.weeklyVotingVersion : undefined;
        const hasWeeklyVoting = weeklyVotingVersion === 1 || weeklyVotingVersion === 2;
        const hasCategoryVoting = weeklyVotingVersion === 2;

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
            if (hasWeeklyVoting) {
                const voterIds = state.settings.voters.map((voter) => voter && voter.id).sort();
                if (voterIds.length !== constants.VOTER_IDS.length
                    || voterIds.some((id, index) => id !== [...constants.VOTER_IDS].sort()[index])) {
                    errors.push("settings.voters must contain exactly p1 and p2.");
                }
            }
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
                if (tag.categoryId !== null && !tagCategoryIds.has(tag.categoryId)) {
                    errors.push(`${path} has an unsupported categoryId.`);
                }
                if (typeof tag.predefined !== "boolean") errors.push(`${path}.predefined must be boolean.`);
            });
        }


        if (Array.isArray(state.participantTagAssignments)) {
            const activeAssignments = new Set();
            state.participantTagAssignments.forEach((assignment, index) => {
                if (!isRecord(assignment)) return;
                const path = `participantTagAssignments[${index}]`;
                requireEntityText(assignment, "participantId", path, errors);
                requireEntityText(assignment, "tagId", path, errors);
                requireEntityText(assignment, "assignedAt", path, errors);
                requireNullableText(assignment, "removedAt", path, errors);
                if (assignment.removedAt === null) {
                    const activeKey = `${assignment.participantId}\u0000${assignment.tagId}`;
                    if (activeAssignments.has(activeKey)) {
                        errors.push(`${path} duplicates an active participant/tag relationship.`);
                    }
                    activeAssignments.add(activeKey);
                }
            });
        }

        if (Array.isArray(state.weeks)) {
            let openWeekCount = 0;
            state.weeks.forEach((week, index) => {
                if (!isRecord(week)) return;
                const path = `weeks[${index}]`;
                requireEntityText(week, "label", path, errors);
                requireEntityText(week, "startDate", path, errors);
                requireEntityText(week, "endDate", path, errors);
                validateTimestamps(week, path, errors);
                if (hasWeeklyVoting) {
                    if (!ISO_WEEK_ID_PATTERN.test(week.id)) errors.push(`${path}.id must be an ISO week id.`);
                    if (!isValidIsoWeekRange(week)) {
                        errors.push(`${path} must match its ISO Monday-Sunday date range.`);
                    }
                    if (!weekStatuses.has(week.status)) errors.push(`${path}.status must be OPEN or CLOSED.`);
                    requireEntityText(week, "openedAt", path, errors);
                    requireNullableText(week, "closedAt", path, errors);
                    if (hasCategoryVoting) {
                        requireNullableText(week, "reopenedAt", path, errors);
                        if (!Number.isInteger(week.reopenCount) || week.reopenCount < 0) {
                            errors.push(`${path}.reopenCount must be a non-negative integer.`);
                        }
                    }
                    if (week.status === "OPEN") {
                        openWeekCount += 1;
                        if (!hasCategoryVoting && week.closedAt !== null) errors.push(`${path}.closedAt must be null while OPEN.`);
                    }
                    if (week.status === "CLOSED" && week.closedAt === null) {
                        errors.push(`${path}.closedAt is required while CLOSED.`);
                    }
                } else if (typeof week.closed !== "boolean") {
                    errors.push(`${path}.closed must be boolean.`);
                }
            });
            if (hasWeeklyVoting && openWeekCount > 1) {
                errors.push("Only one week may be OPEN.");
            }
        }

        if (Array.isArray(state.weeklyVotes)) {
            const voteRelationships = new Set();
            const standoutCounts = new Map();
            state.weeklyVotes.forEach((vote, index) => {
                if (!isRecord(vote)) return;
                const path = `weeklyVotes[${index}]`;
                requireEntityText(vote, "weekId", path, errors);
                requireEntityText(vote, "participantId", path, errors);
                requireEntityText(vote, "userId", path, errors);
                validateTimestamps(vote, path, errors);
                if (!ratingIds.has(vote.rating)) errors.push(`${path} has an unsupported rating.`);
                const reasonTagIds = hasWeeklyVoting ? vote.reasonTagIds : vote.selectedTagIds;
                const reasonField = hasWeeklyVoting ? "reasonTagIds" : "selectedTagIds";
                if (!Array.isArray(reasonTagIds)
                    || reasonTagIds.some((id) => typeof id !== "string")
                    || new Set(reasonTagIds).size !== reasonTagIds.length) {
                    errors.push(`${path} has invalid ${reasonField}.`);
                } else if (hasWeeklyVoting && reasonTagIds.length > constants.MAX_WEEKLY_REASON_TAGS) {
                    errors.push(`${path}.reasonTagIds exceeds the allowed limit.`);
                }
                if (typeof vote.note !== "string") errors.push(`${path}.note must be a string.`);
                if (hasWeeklyVoting && typeof vote.note === "string"
                    && vote.note.length > constants.MAX_WEEKLY_NOTE_LENGTH) {
                    errors.push(`${path}.note exceeds the allowed length.`);
                }
                let relationshipKey = `${vote.weekId}\u0000${vote.participantId}\u0000${vote.userId}`;
                if (hasCategoryVoting) {
                    const isLegacy = vote.legacyUncategorized === true;
                    if (isLegacy) {
                        if (vote.categoryId !== undefined && vote.categoryId !== null) {
                            errors.push(`${path} cannot have categoryId while legacyUncategorized is true.`);
                        }
                        relationshipKey += "\u0000legacy";
                    } else {
                        requireEntityText(vote, "categoryId", path, errors);
                        if (!categoryIds.has(vote.categoryId)) errors.push(`${path}.categoryId is unsupported.`);
                        relationshipKey += `\u0000${vote.categoryId}`;
                    }
                }
                if (voteRelationships.has(relationshipKey)) {
                    errors.push(`${path} duplicates a weekly vote relationship.`);
                }
                voteRelationships.add(relationshipKey);
                if (vote.rating === "standout") {
                    const standoutKey = `${vote.weekId}\u0000${vote.userId}`;
                    const count = (standoutCounts.get(standoutKey) || 0) + 1;
                    standoutCounts.set(standoutKey, count);
                    if (count > constants.MAX_WEEKLY_STANDOUTS) {
                        errors.push(`${path} exceeds the five-Standout limit for its user and week.`);
                    }
                }
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
                const reasonTagIds = hasWeeklyVoting ? vote.reasonTagIds : vote.selectedTagIds;
                if (Array.isArray(reasonTagIds)) {
                    reasonTagIds.forEach((tagId) => {
                        if (!tagIds.has(tagId)) errors.push(`weeklyVotes[${index}] references a missing tag.`);
                    });
                }
                if (hasCategoryVoting && vote.legacyUncategorized !== true && participantIds.has(vote.participantId)) {
                    const participant = state.participants.find((item) => item && item.id === vote.participantId);
                    if (!participant || !participant.categoryIds.includes(vote.categoryId)) {
                        errors.push(`weeklyVotes[${index}].categoryId is not assigned to its participant.`);
                    }
                }
            });
            if (state.settings.activeWeekId !== null && !weekIds.has(state.settings.activeWeekId)) {
                errors.push("settings.activeWeekId references a missing week.");
            } else if (hasWeeklyVoting && state.settings.activeWeekId !== null) {
                const activeWeek = state.weeks.find((week) => week.id === state.settings.activeWeekId);
                if (!activeWeek || activeWeek.status !== "OPEN") {
                    errors.push("settings.activeWeekId must reference the OPEN week.");
                }
            }
            if (hasWeeklyVoting) {
                const openWeek = state.weeks.find((week) => week && week.status === "OPEN");
                if (openWeek && state.settings.activeWeekId !== openWeek.id) {
                    errors.push("settings.activeWeekId must identify the only OPEN week.");
                }
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
