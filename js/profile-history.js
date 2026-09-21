(function defineProfileHistory(root) {
    "use strict";

    const namespace = root.StatsV2 || {};
    const constants = namespace.constants;
    const spotlight = namespace.spotlight;

    if (!constants || !spotlight) {
        throw new Error("Stats V2 constants and Weekly Spotlight must load before profile history.");
    }

    const categoryIndex = new Map(constants.CATEGORIES.map((category, index) => [category.id, index]));

    function findParticipant(state, participantId) {
        const participant = state.participants.find((item) => item.id === participantId);
        if (!participant) throw new TypeError("Participant profile requires an existing participant.");
        return participant;
    }

    function compareNames(left, right) {
        return left.localeCompare(right, "es", { sensitivity: "base" });
    }

    function compareRecordMetrics(left, right) {
        return right.metrics.weeklyPoints - left.metrics.weeklyPoints
            || right.metrics.votersCount - left.metrics.votersCount
            || right.metrics.standoutCount - left.metrics.standoutCount;
    }

    function sameRecordMetrics(left, right) {
        return left.metrics.weeklyPoints === right.metrics.weeklyPoints
            && left.metrics.votersCount === right.metrics.votersCount
            && left.metrics.standoutCount === right.metrics.standoutCount;
    }

    function historicalCategoryIds(state, participant) {
        const ids = new Set(participant.categoryIds);
        state.weeklyVotes.forEach((vote) => {
            if (vote.participantId === participant.id && vote.categoryId && vote.legacyUncategorized !== true) {
                ids.add(vote.categoryId);
            }
        });
        return [...ids].sort((left, right) => (categoryIndex.get(left) ?? 99) - (categoryIndex.get(right) ?? 99));
    }

    function deriveReasonCounts(state, votes, limit = Infinity) {
        const tagsById = new Map(state.tags.map((tag) => [tag.id, tag]));
        const counts = new Map();
        votes.forEach((vote) => {
            (vote.reasonTagIds || []).forEach((tagId) => {
                if (tagsById.has(tagId)) counts.set(tagId, (counts.get(tagId) || 0) + 1);
            });
        });
        return [...counts]
            .map(([tagId, count]) => ({ tag: tagsById.get(tagId), count }))
            .sort((left, right) => right.count - left.count || compareNames(left.tag.name, right.tag.name))
            .slice(0, limit);
    }

    function getParticipantHistory(state, participantId, options = {}) {
        const participant = findParticipant(state, participantId);
        const spotlightContext = options.spotlightContext || spotlight.createDerivationContext(state);
        const categoryId = options.categoryId || "all";
        const categoryIds = historicalCategoryIds(state, participant)
            .filter((id) => categoryId === "all" || id === categoryId);
        const records = [];

        state.weeks.forEach((week) => {
            categoryIds.forEach((id) => {
                const result = spotlight.deriveSpotlightRanking(state, {
                    weekId: week.id,
                    categoryId: id,
                    gender: participant.gender
                }, spotlightContext);
                const ranked = result.items.find((item) => item.participant.id === participantId);
                if (!ranked) return;
                records.push({
                    participantId,
                    week,
                    categoryId: id,
                    category: constants.CATEGORIES.find((category) => category.id === id),
                    rank: ranked.rank,
                    tied: ranked.tied,
                    winner: ranked.rank === 1,
                    jointWinner: ranked.rank === 1 && result.winners.length > 1,
                    mode: result.mode,
                    metrics: { ...ranked.metrics },
                    badge: ranked.badge ? { ...ranked.badge } : null,
                    topReasonTags: ranked.topReasonTags.map((reason) => ({ tag: reason.tag, count: reason.count }))
                });
            });
        });

        const direction = options.order === "oldest" ? 1 : -1;
        return records.sort((left, right) => direction * left.week.id.localeCompare(right.week.id)
            || (categoryIndex.get(left.categoryId) ?? 99) - (categoryIndex.get(right.categoryId) ?? 99));
    }

    function bestRecords(records) {
        if (records.length === 0) return [];
        const ordered = [...records].sort(compareRecordMetrics);
        return ordered.filter((record) => sameRecordMetrics(record, ordered[0]));
    }

    function getParticipantCategoryStats(state, participantId, categoryId, spotlightContext = null) {
        const participant = findParticipant(state, participantId);
        if (!historicalCategoryIds(state, participant).includes(categoryId)) {
            throw new TypeError("Participant profile category is unsupported.");
        }
        const records = getParticipantHistory(state, participantId, {
            categoryId,
            order: "oldest",
            spotlightContext: spotlightContext || spotlight.createDerivationContext(state)
        });
        const votes = state.weeklyVotes.filter((vote) => vote.participantId === participantId
            && vote.categoryId === categoryId && vote.legacyUncategorized !== true);
        const reasons = deriveReasonCounts(state, votes);
        const bestWeeks = bestRecords(records);
        const entriesByWeek = new Map(records.map((record) => [record.week.id, record]));
        const trend = [...state.weeks]
            .sort((left, right) => left.id.localeCompare(right.id))
            .map((week) => {
                const record = entriesByWeek.get(week.id);
                return record ? {
                    weekId: week.id,
                    label: week.label,
                    evaluated: true,
                    weeklyPoints: record.metrics.weeklyPoints,
                    rank: record.rank,
                    mode: record.mode
                } : {
                    weekId: week.id,
                    label: week.label,
                    evaluated: false,
                    weeklyPoints: null,
                    rank: null,
                    mode: week.status === "CLOSED" ? "OFFICIAL" : "LIVE"
                };
            });

        return {
            participantId,
            categoryId,
            records,
            wins: records.filter((record) => record.winner).length,
            topThreeAppearances: records.filter((record) => record.rank <= 3).length,
            weeksEvaluated: records.length,
            bestScore: bestWeeks[0]?.metrics.weeklyPoints ?? null,
            bestWeeks,
            mostPraised: reasons[0] || null,
            topReasons: reasons,
            trend
        };
    }

    function activeProfileTags(state, participantId) {
        const tagsById = new Map(state.tags.map((tag) => [tag.id, tag]));
        const tags = state.participantTagAssignments
            .filter((assignment) => assignment.participantId === participantId && assignment.removedAt === null)
            .map((assignment) => tagsById.get(assignment.tagId))
            .filter(Boolean)
            .sort((left, right) => compareNames(left.name, right.name));
        return Object.freeze({
            strength: tags.filter((tag) => tag.type === "strength"),
            weakness: tags.filter((tag) => tag.type === "weakness"),
            neutral: tags.filter((tag) => tag.type === "neutral")
        });
    }

    function getParticipantProfile(state, participantId) {
        const participant = findParticipant(state, participantId);
        const group = participant.groupId ? state.groups.find((item) => item.id === participant.groupId) || null : null;
        const categoryIds = historicalCategoryIds(state, participant);
        const spotlightContext = spotlight.createDerivationContext(state);
        const categoryStats = categoryIds.map((categoryId) => getParticipantCategoryStats(
            state, participantId, categoryId, spotlightContext
        ));
        const history = getParticipantHistory(state, participantId, { spotlightContext });
        const votes = state.weeklyVotes.filter((vote) => vote.participantId === participantId
            && vote.categoryId && vote.legacyUncategorized !== true);
        const topReasons = deriveReasonCounts(state, votes);
        const badgeCounts = new Map();
        history.forEach((record) => {
            if (record.badge) badgeCounts.set(record.badge.id, {
                badge: record.badge,
                count: (badgeCounts.get(record.badge.id)?.count || 0) + 1
            });
        });
        const highestWinCount = Math.max(0, ...categoryStats.map((stats) => stats.wins));

        return {
            participant,
            group,
            profileTags: activeProfileTags(state, participantId),
            categoryIds,
            categoryStats,
            history,
            summary: {
                weeksEvaluated: new Set(history.map((record) => record.week.id)).size,
                wins: history.filter((record) => record.winner).length,
                topThreeAppearances: history.filter((record) => record.rank <= 3).length,
                standoutVotes: votes.filter((vote) => vote.rating === "standout").length,
                categories: categoryIds.length,
                bestRecords: bestRecords(history),
                mostPraised: topReasons[0] || null,
                mostWinsCategories: highestWinCount > 0
                    ? categoryStats.filter((stats) => stats.wins === highestWinCount)
                    : []
            },
            topReasons,
            badgeCounts: [...badgeCounts.values()].sort((left, right) => right.count - left.count
                || compareNames(left.badge.label, right.badge.label)),
            winHistory: history.filter((record) => record.winner),
            topThreeHistory: history.filter((record) => record.rank <= 3)
        };
    }

    namespace.profileHistory = Object.freeze({
        deriveReasonCounts,
        getParticipantHistory,
        getParticipantCategoryStats,
        getParticipantProfile
    });
    root.StatsV2 = namespace;
})(globalThis);
