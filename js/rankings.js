(function defineRankings(root) {
    "use strict";

    const namespace = root.StatsV2 || {};
    const constants = namespace.constants;

    if (!constants) {
        throw new Error("Stats V2 constants must load before rankings.");
    }

    const categoryIds = new Set(constants.CATEGORIES.map((category) => category.id));

    function comparableText(value) {
        return String(value || "").trim().toLocaleLowerCase("es");
    }

    function activeTagsByParticipant(state) {
        const tagsById = new Map(state.tags.map((tag) => [tag.id, tag]));
        const result = new Map();

        state.participantTagAssignments.forEach((assignment) => {
            if (assignment.removedAt !== null) return;
            const tag = tagsById.get(assignment.tagId);
            if (!tag) return;
            const participantTags = result.get(assignment.participantId) || [];
            participantTags.push(tag);
            result.set(assignment.participantId, participantTags);
        });

        return result;
    }

    function assertCategory(categoryId) {
        if (!categoryIds.has(categoryId)) {
            throw new TypeError("Ranking category is unsupported.");
        }
    }

    function deriveRanking(state, options = {}) {
        const categoryId = options.categoryId || constants.CATEGORIES[0].id;
        assertCategory(categoryId);

        const query = comparableText(options.query);
        const gender = options.gender || "all";
        const groupId = options.groupId || "all";
        const tagId = options.tagId || "all";
        const includeArchived = Boolean(options.includeArchived);
        const sort = options.sort === "recent" ? "recent" : "a-z";
        const scoreProvider = typeof options.scoreProvider === "function" ? options.scoreProvider : null;
        const groupsById = new Map(state.groups.map((group) => [group.id, group]));
        const tagsByParticipant = activeTagsByParticipant(state);

        const items = state.participants
            .filter((participant) => participant.categoryIds.includes(categoryId))
            .filter((participant) => includeArchived || participant.archivedAt === null)
            .filter((participant) => gender === "all" || participant.gender === gender)
            .filter((participant) => {
                if (groupId === "all") return true;
                if (groupId === "soloist") return participant.groupId === null;
                return participant.groupId === groupId;
            })
            .filter((participant) => {
                const tags = tagsByParticipant.get(participant.id) || [];
                return tagId === "all" || tags.some((tag) => tag.id === tagId);
            })
            .filter((participant) => {
                if (!query) return true;
                const group = participant.groupId ? groupsById.get(participant.groupId) : null;
                const tags = tagsByParticipant.get(participant.id) || [];
                return comparableText(participant.name).includes(query)
                    || comparableText(group && group.name).includes(query)
                    || tags.some((tag) => comparableText(tag.name).includes(query));
            })
            .map((participant) => ({
                participant,
                group: participant.groupId ? groupsById.get(participant.groupId) || null : null,
                tags: [...(tagsByParticipant.get(participant.id) || [])],
                score: scoreProvider ? scoreProvider(participant, categoryId) : null,
                rank: null
            }));

        const ranked = Boolean(scoreProvider)
            && items.length > 0
            && items.every((item) => Number.isFinite(item.score));

        if (ranked) {
            items.sort((left, right) => (
                right.score - left.score
                || left.participant.name.localeCompare(right.participant.name, "es", { sensitivity: "base" })
            ));
            items.forEach((item, index) => {
                item.rank = index + 1;
            });
        } else if (sort === "recent") {
            items.sort((left, right) => (
                right.participant.createdAt.localeCompare(left.participant.createdAt)
                || left.participant.name.localeCompare(right.participant.name, "es", { sensitivity: "base" })
            ));
            items.forEach((item) => {
                item.score = null;
            });
        } else {
            items.sort((left, right) => (
                left.participant.name.localeCompare(right.participant.name, "es", { sensitivity: "base" })
            ));
            items.forEach((item) => {
                item.score = null;
            });
        }

        return { categoryId, ranked, items };
    }

    function topThree(derivedRanking) {
        return derivedRanking && derivedRanking.ranked
            ? derivedRanking.items.slice(0, 3)
            : [];
    }

    namespace.rankings = Object.freeze({ deriveRanking, topThree });
    root.StatsV2 = namespace;
})(globalThis);
