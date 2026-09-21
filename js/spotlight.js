(function defineWeeklySpotlight(root) {
    "use strict";

    const namespace = root.StatsV2 || {};
    const constants = namespace.constants;
    const weekly = namespace.weekly;

    if (!constants || !weekly) {
        throw new Error("Stats V2 constants and weekly voting must load before Weekly Spotlight.");
    }

    const categoryIds = new Set(constants.CATEGORIES.map((category) => category.id));
    const genderIds = new Set(constants.GENDERS);

    function assertSelection(state, weekId, categoryId, gender) {
        const week = state.weeks.find((item) => item.id === weekId);
        if (!week) throw new TypeError("Weekly Spotlight requires an existing week.");
        if (!categoryIds.has(categoryId)) throw new TypeError("Weekly Spotlight category is unsupported.");
        if (!genderIds.has(gender)) throw new TypeError("Weekly Spotlight gender is unsupported.");
        return week;
    }

    function compareNames(left, right) {
        return left.localeCompare(right, "es", { sensitivity: "base" });
    }

    function selectionKey(weekId, categoryId, participantId) {
        return `${weekId}\u0000${categoryId}\u0000${participantId}`;
    }

    function categoryGenderKey(categoryId, gender) {
        return `${categoryId}\u0000${gender}`;
    }

    function createDerivationContext(state) {
        const votesBySelection = new Map();
        state.weeklyVotes.forEach((vote) => {
            if (vote.legacyUncategorized === true || !vote.categoryId) return;
            const key = selectionKey(vote.weekId, vote.categoryId, vote.participantId);
            if (!votesBySelection.has(key)) votesBySelection.set(key, []);
            votesBySelection.get(key).push(vote);
        });
        const candidatesByCategoryGender = new Map();
        state.participants.forEach((participant) => {
            participant.categoryIds.forEach((categoryId) => {
                const key = categoryGenderKey(categoryId, participant.gender);
                if (!candidatesByCategoryGender.has(key)) candidatesByCategoryGender.set(key, []);
                candidatesByCategoryGender.get(key).push(participant);
            });
        });
        return {
            votesBySelection,
            candidatesByCategoryGender,
            groupsById: new Map(state.groups.map((group) => [group.id, group])),
            tagsById: new Map(state.tags.map((tag) => [tag.id, tag]))
        };
    }

    function votesFor(state, weekId, participantId, categoryId) {
        return state.weeklyVotes.filter((vote) => vote.weekId === weekId
            && vote.participantId === participantId
            && vote.categoryId === categoryId
            && vote.legacyUncategorized !== true);
    }

    function deriveResultBadge(votes) {
        const scores = votes.map((vote) => weekly.ratingScore(vote.rating)).filter((score) => score !== null);
        if (scores.length === 2 && scores.every((score) => score === 3)) {
            return { id: "duo-standout", label: "Destacado por ambos" };
        }
        if (scores.length === 2 && Math.max(...scores) - Math.min(...scores) === 3) {
            return { id: "split-decision", label: "Opiniones divididas" };
        }
        if (scores.length === 2 && scores.every((score) => score >= 1)) {
            return { id: "duo-approved", label: "Aprobado por ambos" };
        }
        if (scores.length === 1 && scores[0] > 0) {
            return { id: "solo-pick", label: "Elección individual" };
        }
        return null;
    }

    function countReasonTags(state, votes, limit = 3, preparedTagsById = null) {
        const tagsById = preparedTagsById || new Map(state.tags.map((tag) => [tag.id, tag]));
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

    function topReasonTagsForParticipant(state, weekId, participantId, categoryId, limit = 3) {
        return countReasonTags(state, votesFor(state, weekId, participantId, categoryId), limit);
    }

    function mostPraisedSkill(state, weekId, categoryId, gender, preparedContext = null) {
        assertSelection(state, weekId, categoryId, gender);
        const context = preparedContext || createDerivationContext(state);
        const candidates = context.candidatesByCategoryGender.get(categoryGenderKey(categoryId, gender)) || [];
        const votes = candidates.flatMap((participant) => (
            context.votesBySelection.get(selectionKey(weekId, categoryId, participant.id)) || []
        ));
        return countReasonTags(state, votes, 1, context.tagsById)[0] || null;
    }

    function deriveSpotlightRanking(state, options, preparedContext = null) {
        const { weekId, categoryId, gender } = options || {};
        const week = assertSelection(state, weekId, categoryId, gender);
        const context = preparedContext || createDerivationContext(state);
        const candidates = context.candidatesByCategoryGender.get(categoryGenderKey(categoryId, gender)) || [];
        const items = candidates.map((participant) => {
            const votes = context.votesBySelection.get(selectionKey(weekId, categoryId, participant.id)) || [];
            if (votes.length === 0) return null;
            return {
                participant,
                group: participant.groupId ? context.groupsById.get(participant.groupId) || null : null,
                metrics: weekly.deriveMetricsFromVotes(votes, { weekId, participantId: participant.id, categoryId }),
                votes,
                badge: deriveResultBadge(votes),
                topReasonTags: countReasonTags(state, votes, 3, context.tagsById),
                rank: null,
                tied: false
            };
        }).filter(Boolean);

        items.sort((left, right) => weekly.compareWeeklyMetrics(left.metrics, right.metrics)
            || compareNames(left.participant.name, right.participant.name));
        items.forEach((item, index) => {
            item.rank = index > 0 && weekly.sameRankMetrics(item.metrics, items[index - 1].metrics)
                ? items[index - 1].rank
                : index + 1;
        });
        items.forEach((item, index) => {
            item.tied = (index > 0 && weekly.sameRankMetrics(item.metrics, items[index - 1].metrics))
                || (index < items.length - 1 && weekly.sameRankMetrics(item.metrics, items[index + 1].metrics));
        });

        return {
            week,
            categoryId,
            gender,
            mode: week.status === "CLOSED" ? "OFFICIAL" : "LIVE",
            items,
            topThree: items.filter((item) => item.rank <= 3),
            winners: items.filter((item) => item.rank === 1),
            notEvaluatedCount: candidates.filter((participant) => participant.archivedAt === null
                && !(context.votesBySelection.get(selectionKey(weekId, categoryId, participant.id)) || []).length).length,
            mostPraisedSkill: countReasonTags(state, items.flatMap((item) => item.votes), 1, context.tagsById)[0] || null
        };
    }

    function deriveWeeklyOverview(state, weekId) {
        const week = state.weeks.find((item) => item.id === weekId);
        if (!week) throw new TypeError("Weekly Spotlight requires an existing week.");
        const context = createDerivationContext(state);
        return {
            week,
            mode: week.status === "CLOSED" ? "OFFICIAL" : "LIVE",
            categories: constants.CATEGORIES.map((category) => ({
                category,
                results: constants.GENDERS.map((gender) => {
                    const ranking = deriveSpotlightRanking(state, { weekId, categoryId: category.id, gender }, context);
                    return { gender, winners: ranking.winners, evaluatedCount: ranking.items.length };
                })
            }))
        };
    }

    function deriveParticipantHistory(state, participantId) {
        const participant = state.participants.find((item) => item.id === participantId);
        if (!participant) throw new TypeError("Participant history requires an existing participant.");
        const context = createDerivationContext(state);
        const entries = [];
        state.weeks.forEach((week) => {
            participant.categoryIds.forEach((categoryId) => {
                const ranking = deriveSpotlightRanking(state, {
                    weekId: week.id, categoryId, gender: participant.gender
                }, context);
                const item = ranking.items.find((candidate) => candidate.participant.id === participantId);
                if (item) entries.push({ week, categoryId, rank: item.rank, tied: item.tied, metrics: item.metrics });
            });
        });
        const bestWeek = [...entries].sort((left, right) => (
            right.metrics.weeklyPoints - left.metrics.weeklyPoints
            || right.metrics.votersCount - left.metrics.votersCount
            || right.metrics.standoutCount - left.metrics.standoutCount
            || left.week.id.localeCompare(right.week.id)
        ))[0] || null;
        return {
            participantId,
            entries,
            wins: entries.filter((entry) => entry.rank === 1).length,
            topThreeAppearances: entries.filter((entry) => entry.rank <= 3).length,
            bestWeek
        };
    }

    namespace.spotlight = Object.freeze({
        votesFor,
        createDerivationContext,
        deriveResultBadge,
        topReasonTagsForParticipant,
        mostPraisedSkill,
        deriveSpotlightRanking,
        deriveWeeklyOverview,
        deriveParticipantHistory
    });
    root.StatsV2 = namespace;
})(globalThis);
