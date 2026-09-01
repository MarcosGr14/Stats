(function defineAnalytics(root) {
    "use strict";

    const namespace = root.StatsV2 || {};
    const constants = namespace.constants;
    const weekly = namespace.weekly;
    const spotlight = namespace.spotlight;

    if (!constants || !weekly || !spotlight) {
        throw new Error("Stats V2 constants, Weekly Voting and Weekly Spotlight must load before Analytics.");
    }

    const DEFAULT_MINIMUMS = Object.freeze({
        evaluatedWeeks: 3,
        dualVoteWeeks: 3,
        appearances: 3
    });
    const categoryIds = new Set(constants.CATEGORIES.map((category) => category.id));
    const genderIds = new Set(constants.GENDERS);
    const voterIds = new Set(constants.VOTER_IDS);
    const EPSILON = 1e-10;

    const METRIC_DEFINITIONS = Object.freeze({
        weeklyWins: "Number of rank #1 results within each week, category and gender. Every joint winner receives one full win.",
        topThreeAppearances: "Number of official competition ranks 1, 2 or 3 within each category and gender.",
        standoutVotes: "Number of individual weekly votes whose rating is Standout. Two Standout votes count as two.",
        duoStandoutEvents: "Number of participant/category/week events where both P1 and P2 voted Standout.",
        soloPickEvents: "Number of participant/category/week events where exactly one user voted and that rating was above Normal.",
        splitDecisionEvents: "Number of events identified by the existing Weekly Spotlight Split Decision badge.",
        controversial: "Mean absolute P1/P2 rating difference using only events where both users voted.",
        biggestDisagreement: "Individual dual-vote events with the largest absolute P1/P2 rating difference.",
        agreement: "Lowest mean absolute P1/P2 rating difference with at least the configured number of dual-vote weeks.",
        consistency: "Population standard deviation of weeklyPoints across evaluated weeks only. Lower is more consistent.",
        improvement: "Ordinary least-squares slope of weeklyPoints over chronological selected-week positions. Gaps remain in time but are not scored.",
        averageWeeklyScore: "Arithmetic mean of weeklyPoints across evaluated weeks. Normal contributes zero; missing evaluation is excluded.",
        averagePlacement: "Arithmetic mean of the existing competition rank across ranked appearances.",
        praisedSkill: "Count of weeklyVotes.reasonTagIds mentions. Profile tag assignments are never included.",
        profileTags: "Count of active participantTagAssignments by tag type. Removed assignments and weekly reasons are excluded.",
        ratingDistribution: "Count and percentage of existing votes by rating. Not evaluated is absent and therefore excluded.",
        weeklyActivity: "Descriptive count of votes, evaluated participants, evaluated categories, Standouts and reason-tag mentions per week."
    });

    const PENDING_METRICS = Object.freeze({
        mostCompetitiveWeek: "Pending an approved definition; no competition formula is inferred.",
        overallScore: "Outside Phase 7A and deliberately not defined.",
        seasonStandings: "Outside Phase 7A and deliberately not defined.",
        bestGroup: "Group analytics are descriptive only; no Best Group is defined."
    });

    function compareText(left, right) {
        return String(left || "").localeCompare(String(right || ""), "es", { sensitivity: "base" });
    }

    function equalNumber(left, right) {
        return Math.abs(left - right) <= EPSILON;
    }

    function assertState(state) {
        const collections = ["participants", "groups", "tags", "participantTagAssignments", "weeks", "weeklyVotes"];
        if (!state || collections.some((name) => !Array.isArray(state[name]))) {
            throw new TypeError("Analytics requires a valid Stats V2 state.");
        }
    }

    function positiveInteger(value, fallback, field) {
        if (value === undefined) return fallback;
        if (!Number.isInteger(value) || value < 1) throw new TypeError(`${field} must be a positive integer.`);
        return value;
    }

    function normalizeOptions(state, options = {}) {
        assertState(state);
        const categoryId = options.categoryId && options.categoryId !== "all" ? options.categoryId : null;
        const gender = options.gender && options.gender !== "all" ? options.gender : null;
        const userId = options.userId && options.userId !== "all" ? options.userId : null;
        if (categoryId && !categoryIds.has(categoryId)) throw new TypeError("Analytics category is unsupported.");
        if (gender && !genderIds.has(gender)) throw new TypeError("Analytics gender is unsupported.");
        if (userId && !voterIds.has(userId)) throw new TypeError("Analytics user must be p1 or p2.");
        if (options.lastNWeeks !== undefined && (!Number.isInteger(options.lastNWeeks) || options.lastNWeeks < 1)) {
            throw new TypeError("lastNWeeks must be a positive integer.");
        }
        return {
            categoryId,
            gender,
            userId,
            participantId: options.participantId || null,
            groupId: options.groupId === undefined || options.groupId === "all" ? null : options.groupId,
            fromWeekId: options.fromWeekId || options.startWeekId || null,
            toWeekId: options.toWeekId || options.endWeekId || null,
            lastNWeeks: options.lastNWeeks || null,
            includeOpen: options.includeOpen === true,
            minimumEvaluatedWeeks: positiveInteger(options.minimumEvaluatedWeeks, DEFAULT_MINIMUMS.evaluatedWeeks, "minimumEvaluatedWeeks"),
            minimumDualVoteWeeks: positiveInteger(options.minimumDualVoteWeeks, DEFAULT_MINIMUMS.dualVoteWeeks, "minimumDualVoteWeeks"),
            minimumAppearances: positiveInteger(options.minimumAppearances, DEFAULT_MINIMUMS.appearances, "minimumAppearances")
        };
    }

    function selectedWeeks(state, normalized) {
        let weeks = [...state.weeks]
            .filter((week) => normalized.includeOpen || week.status === "CLOSED")
            .filter((week) => !normalized.fromWeekId || week.id >= normalized.fromWeekId)
            .filter((week) => !normalized.toWeekId || week.id <= normalized.toWeekId)
            .sort((left, right) => left.id.localeCompare(right.id));
        if (normalized.lastNWeeks) weeks = weeks.slice(-normalized.lastNWeeks);
        return weeks;
    }

    function createScope(state, options = {}) {
        const normalized = normalizeOptions(state, options);
        const weeks = selectedWeeks(state, normalized);
        return Object.freeze({
            includeOpen: normalized.includeOpen,
            weekStatus: normalized.includeOpen ? "OPEN_AND_CLOSED" : "CLOSED_ONLY",
            weekIds: Object.freeze(weeks.map((week) => week.id)),
            fromWeekId: normalized.fromWeekId,
            toWeekId: normalized.toWeekId,
            lastNWeeks: normalized.lastNWeeks,
            categoryId: normalized.categoryId,
            gender: normalized.gender,
            groupId: normalized.groupId,
            participantId: normalized.participantId,
            userId: normalized.userId
        });
    }

    function participantMatches(participant, normalized) {
        if (!participant) return false;
        if (normalized.participantId && participant.id !== normalized.participantId) return false;
        if (normalized.gender && participant.gender !== normalized.gender) return false;
        if (normalized.groupId === "soloist" && participant.groupId !== null) return false;
        if (normalized.groupId && normalized.groupId !== "soloist" && participant.groupId !== normalized.groupId) return false;
        if (normalized.categoryId && !participant.categoryIds.includes(normalized.categoryId)) return false;
        return true;
    }

    function scopedContext(state, options = {}) {
        const normalized = normalizeOptions(state, options);
        const weeks = selectedWeeks(state, normalized);
        const weekIds = new Set(weeks.map((week) => week.id));
        const participantsById = new Map(state.participants.map((participant) => [participant.id, participant]));
        const groupsById = new Map(state.groups.map((group) => [group.id, group]));
        const tagsById = new Map(state.tags.map((tag) => [tag.id, tag]));
        const participants = state.participants.filter((participant) => participantMatches(participant, normalized));
        return {
            normalized,
            weeks,
            weekIds,
            participants,
            participantsById,
            groupsById,
            tagsById,
            scope: createScope(state, options)
        };
    }

    function scopedVotes(state, context, respectUser = true) {
        return state.weeklyVotes.filter((vote) => {
            const participant = context.participantsById.get(vote.participantId);
            return context.weekIds.has(vote.weekId)
                && vote.legacyUncategorized !== true
                && participantMatches(participant, context.normalized)
                && (!context.normalized.categoryId || vote.categoryId === context.normalized.categoryId)
                && (!respectUser || !context.normalized.userId || vote.userId === context.normalized.userId);
        });
    }

    function scopedRankingRecords(state, context) {
        const categories = constants.CATEGORIES.filter((category) => (
            !context.normalized.categoryId || category.id === context.normalized.categoryId
        ));
        const genders = constants.GENDERS.filter((gender) => !context.normalized.gender || gender === context.normalized.gender);
        const records = [];
        context.weeks.forEach((week) => {
            categories.forEach((category) => {
                genders.forEach((gender) => {
                    const result = spotlight.deriveSpotlightRanking(state, {
                        weekId: week.id,
                        categoryId: category.id,
                        gender
                    });
                    result.items.forEach((item) => {
                        if (!participantMatches(item.participant, context.normalized)) return;
                        records.push({
                            week,
                            categoryId: category.id,
                            gender,
                            participant: item.participant,
                            group: item.participant.groupId ? context.groupsById.get(item.participant.groupId) || null : null,
                            rank: item.rank,
                            tied: item.tied,
                            winnerCount: result.winners.length,
                            metrics: { ...item.metrics },
                            votes: item.votes,
                            badge: item.badge ? { ...item.badge } : null
                        });
                    });
                });
            });
        });
        return records;
    }

    function mean(values) {
        return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
    }

    function populationStandardDeviation(values) {
        if (!values.length) return null;
        const average = mean(values);
        return Math.sqrt(values.reduce((total, value) => total + ((value - average) ** 2), 0) / values.length);
    }

    function linearRegressionSlope(points) {
        if (points.length < 2) return null;
        const averageX = mean(points.map((point) => point.x));
        const averageY = mean(points.map((point) => point.y));
        const denominator = points.reduce((total, point) => total + ((point.x - averageX) ** 2), 0);
        if (equalNumber(denominator, 0)) return 0;
        return points.reduce((total, point) => total + ((point.x - averageX) * (point.y - averageY)), 0) / denominator;
    }

    function metricKey(participantId, categoryId, gender) {
        return `${participantId}\u0000${categoryId}\u0000${gender}`;
    }

    function deriveParticipantCategoryMetrics(state, options = {}) {
        const context = scopedContext(state, options);
        const weekIndex = new Map(context.weeks.map((week, index) => [week.id, index]));
        const records = scopedRankingRecords(state, context);
        const rowsByKey = new Map();
        records.forEach((record) => {
            const key = metricKey(record.participant.id, record.categoryId, record.gender);
            if (!rowsByKey.has(key)) {
                rowsByKey.set(key, {
                    participantId: record.participant.id,
                    participant: record.participant,
                    group: record.group,
                    categoryId: record.categoryId,
                    gender: record.gender,
                    records: []
                });
            }
            rowsByKey.get(key).records.push(record);
        });

        const rows = [...rowsByKey.values()].map((row) => {
            const points = row.records.map((record) => record.metrics.weeklyPoints);
            const ranks = row.records.map((record) => record.rank);
            const dualDifferences = row.records
                .map((record) => record.metrics.ratingDifference)
                .filter((value) => value !== null);
            const standoutWeeks = new Set();
            let standoutVotes = 0;
            row.records.forEach((record) => {
                const count = record.votes.filter((vote) => vote.rating === "standout").length;
                standoutVotes += count;
                if (count > 0) standoutWeeks.add(record.week.id);
            });
            const trendPoints = row.records.map((record) => ({
                x: weekIndex.get(record.week.id),
                y: record.metrics.weeklyPoints,
                weekId: record.week.id
            }));
            return {
                participantId: row.participantId,
                participant: row.participant,
                group: row.group,
                categoryId: row.categoryId,
                gender: row.gender,
                appearances: row.records.length,
                evaluatedWeeks: row.records.length,
                wins: row.records.filter((record) => record.rank === 1).length,
                topThreeAppearances: row.records.filter((record) => record.rank <= 3).length,
                standoutVotes,
                weeksWithStandout: standoutWeeks.size,
                duoStandoutEvents: row.records.filter((record) => record.badge?.id === "duo-standout").length,
                soloPickEvents: row.records.filter((record) => record.badge?.id === "solo-pick").length,
                splitDecisionEvents: row.records.filter((record) => record.badge?.id === "split-decision").length,
                dualVoteWeeks: dualDifferences.length,
                averageRatingDifference: mean(dualDifferences),
                maxRatingDifference: dualDifferences.length ? Math.max(...dualDifferences) : null,
                averageWeeklyPoints: mean(points),
                standardDeviation: populationStandardDeviation(points),
                improvementSlope: linearRegressionSlope(trendPoints),
                averagePlacement: mean(ranks),
                records: row.records,
                metadata: {
                    weeklyPoints: points,
                    ranks,
                    dualVoteDifferences: dualDifferences,
                    trendPoints
                }
            };
        }).sort((left, right) => constants.CATEGORIES.findIndex((category) => category.id === left.categoryId)
            - constants.CATEGORIES.findIndex((category) => category.id === right.categoryId)
            || constants.GENDERS.indexOf(left.gender) - constants.GENDERS.indexOf(right.gender)
            || compareText(left.participant.name, right.participant.name));

        return {
            metric: "participantCategoryMetrics",
            scope: context.scope,
            rows,
            insufficientData: rows.length === 0
        };
    }

    function groupedLeaderboard(rows, configuration) {
        const groupsByKey = new Map();
        rows.filter(configuration.eligible || (() => true)).forEach((row) => {
            const key = `${row.categoryId}\u0000${row.gender}`;
            if (!groupsByKey.has(key)) groupsByKey.set(key, []);
            groupsByKey.get(key).push(row);
        });
        const groups = [...groupsByKey].map(([key, source]) => {
            const [categoryId, gender] = key.split("\u0000");
            const ordered = [...source].sort((left, right) => configuration.compare(left, right)
                || compareText(left.participant.name, right.participant.name));
            const entries = ordered.map((row, index) => ({
                participantId: row.participantId,
                participant: row.participant,
                categoryId,
                gender,
                value: configuration.value(row),
                sampleSize: configuration.sampleSize(row),
                metadata: configuration.metadata(row),
                rank: index > 0 && configuration.same(row, ordered[index - 1]) ? null : index + 1,
                tied: false
            }));
            entries.forEach((entry, index) => {
                if (entry.rank === null) entry.rank = entries[index - 1].rank;
                entry.tied = (index > 0 && configuration.same(ordered[index], ordered[index - 1]))
                    || (index < ordered.length - 1 && configuration.same(ordered[index], ordered[index + 1]));
            });
            return { categoryId, gender, entries, insufficientData: entries.length === 0 };
        }).sort((left, right) => constants.CATEGORIES.findIndex((category) => category.id === left.categoryId)
            - constants.CATEGORIES.findIndex((category) => category.id === right.categoryId)
            || constants.GENDERS.indexOf(left.gender) - constants.GENDERS.indexOf(right.gender));
        return groups;
    }

    function resultWithGroups(metric, definition, scope, groups, minimumSample) {
        return {
            metric,
            definition,
            minimumSample,
            scope,
            groups,
            insufficientData: groups.length === 0 || groups.every((group) => group.insufficientData)
        };
    }

    function countLeaderboard(state, options, metric, field, definition) {
        const derived = deriveParticipantCategoryMetrics(state, options);
        const groups = groupedLeaderboard(derived.rows, {
            eligible: (row) => row[field] > 0,
            compare: (left, right) => right[field] - left[field],
            same: (left, right) => left[field] === right[field],
            value: (row) => row[field],
            sampleSize: (row) => row.appearances,
            metadata: (row) => ({
                evaluatedWeeks: row.evaluatedWeeks,
                wins: row.wins,
                topThreeAppearances: row.topThreeAppearances,
                standoutVotes: row.standoutVotes,
                weeksWithStandout: row.weeksWithStandout
            })
        });
        return resultWithGroups(metric, definition, derived.scope, groups, 1);
    }

    function mostWeeklyWins(state, options = {}) {
        return countLeaderboard(state, options, "mostWeeklyWins", "wins", METRIC_DEFINITIONS.weeklyWins);
    }

    function mostTopThreeAppearances(state, options = {}) {
        return countLeaderboard(state, options, "mostTopThreeAppearances", "topThreeAppearances", METRIC_DEFINITIONS.topThreeAppearances);
    }

    function mostStandouts(state, options = {}) {
        return countLeaderboard(state, options, "mostStandouts", "standoutVotes", METRIC_DEFINITIONS.standoutVotes);
    }

    function mostDuoStandouts(state, options = {}) {
        return countLeaderboard(state, options, "mostDuoStandouts", "duoStandoutEvents", METRIC_DEFINITIONS.duoStandoutEvents);
    }

    function mostSoloPicks(state, options = {}) {
        return countLeaderboard(state, options, "mostSoloPicks", "soloPickEvents", METRIC_DEFINITIONS.soloPickEvents);
    }

    function mostSplitDecisions(state, options = {}) {
        return countLeaderboard(state, options, "mostSplitDecisions", "splitDecisionEvents", METRIC_DEFINITIONS.splitDecisionEvents);
    }

    function disagreementLeaderboard(state, options, mode) {
        const derived = deriveParticipantCategoryMetrics(state, options);
        const minimum = derived.scope && normalizeOptions(state, options).minimumDualVoteWeeks;
        const descending = mode === "controversial";
        const groups = groupedLeaderboard(derived.rows, {
            eligible: (row) => row.dualVoteWeeks >= minimum,
            compare: (left, right) => descending
                ? right.averageRatingDifference - left.averageRatingDifference
                : left.averageRatingDifference - right.averageRatingDifference,
            same: (left, right) => equalNumber(left.averageRatingDifference, right.averageRatingDifference),
            value: (row) => row.averageRatingDifference,
            sampleSize: (row) => row.dualVoteWeeks,
            metadata: (row) => ({
                dualVoteWeeks: row.dualVoteWeeks,
                maxDifference: row.maxRatingDifference,
                splitDecisionCount: row.splitDecisionEvents,
                differences: row.metadata.dualVoteDifferences
            })
        });
        const metric = descending ? "mostControversial" : "highestAgreement";
        const definition = descending ? METRIC_DEFINITIONS.controversial : METRIC_DEFINITIONS.agreement;
        return resultWithGroups(metric, definition, derived.scope, groups, minimum);
    }

    function mostControversial(state, options = {}) {
        return disagreementLeaderboard(state, options, "controversial");
    }

    function highestAgreement(state, options = {}) {
        return disagreementLeaderboard(state, options, "agreement");
    }

    function biggestDisagreement(state, options = {}) {
        const context = scopedContext(state, options);
        const records = scopedRankingRecords(state, context)
            .filter((record) => record.metrics.ratingDifference !== null)
            .map((record) => ({
                participantId: record.participant.id,
                participant: record.participant,
                weekId: record.week.id,
                week: record.week,
                categoryId: record.categoryId,
                gender: record.gender,
                value: record.metrics.ratingDifference,
                votes: record.votes.map((vote) => ({ userId: vote.userId, rating: vote.rating, score: weekly.ratingScore(vote.rating) }))
            }));
        const groupsByKey = new Map();
        records.forEach((record) => {
            const key = `${record.categoryId}\u0000${record.gender}`;
            if (!groupsByKey.has(key)) groupsByKey.set(key, []);
            groupsByKey.get(key).push(record);
        });
        const groups = [...groupsByKey].map(([key, items]) => {
            const [categoryId, gender] = key.split("\u0000");
            const highest = Math.max(...items.map((item) => item.value));
            const entries = items.filter((item) => item.value === highest)
                .sort((left, right) => left.weekId.localeCompare(right.weekId)
                    || compareText(left.participant.name, right.participant.name))
                .map((item) => ({ ...item, rank: 1, tied: items.filter((candidate) => candidate.value === highest).length > 1 }));
            return { categoryId, gender, entries, insufficientData: false };
        });
        return resultWithGroups("biggestDisagreement", METRIC_DEFINITIONS.biggestDisagreement, context.scope, groups, 1);
    }

    function mostConsistent(state, options = {}) {
        const normalized = normalizeOptions(state, options);
        const derived = deriveParticipantCategoryMetrics(state, options);
        const groups = groupedLeaderboard(derived.rows, {
            eligible: (row) => row.evaluatedWeeks >= normalized.minimumEvaluatedWeeks,
            compare: (left, right) => left.standardDeviation - right.standardDeviation
                || right.evaluatedWeeks - left.evaluatedWeeks
                || right.averageWeeklyPoints - left.averageWeeklyPoints,
            same: (left, right) => equalNumber(left.standardDeviation, right.standardDeviation)
                && left.evaluatedWeeks === right.evaluatedWeeks
                && equalNumber(left.averageWeeklyPoints, right.averageWeeklyPoints),
            value: (row) => row.standardDeviation,
            sampleSize: (row) => row.evaluatedWeeks,
            metadata: (row) => ({
                standardDeviation: row.standardDeviation,
                averageWeeklyPoints: row.averageWeeklyPoints,
                evaluatedWeeks: row.evaluatedWeeks,
                weeklyPoints: row.metadata.weeklyPoints
            })
        });
        return resultWithGroups("mostConsistent", METRIC_DEFINITIONS.consistency, derived.scope, groups, normalized.minimumEvaluatedWeeks);
    }

    function mostImproved(state, options = {}) {
        const normalized = normalizeOptions(state, options);
        const derived = deriveParticipantCategoryMetrics(state, options);
        const groups = groupedLeaderboard(derived.rows, {
            eligible: (row) => row.evaluatedWeeks >= normalized.minimumEvaluatedWeeks && row.improvementSlope > 0,
            compare: (left, right) => right.improvementSlope - left.improvementSlope,
            same: (left, right) => equalNumber(left.improvementSlope, right.improvementSlope),
            value: (row) => row.improvementSlope,
            sampleSize: (row) => row.evaluatedWeeks,
            metadata: (row) => ({
                slope: row.improvementSlope,
                evaluatedWeeks: row.evaluatedWeeks,
                trendPoints: row.metadata.trendPoints
            })
        });
        return resultWithGroups("mostImproved", METRIC_DEFINITIONS.improvement, derived.scope, groups, normalized.minimumEvaluatedWeeks);
    }

    function bestAverageWeeklyScore(state, options = {}) {
        const normalized = normalizeOptions(state, options);
        const derived = deriveParticipantCategoryMetrics(state, options);
        const groups = groupedLeaderboard(derived.rows, {
            eligible: (row) => row.evaluatedWeeks >= normalized.minimumEvaluatedWeeks,
            compare: (left, right) => right.averageWeeklyPoints - left.averageWeeklyPoints,
            same: (left, right) => equalNumber(left.averageWeeklyPoints, right.averageWeeklyPoints),
            value: (row) => row.averageWeeklyPoints,
            sampleSize: (row) => row.evaluatedWeeks,
            metadata: (row) => ({ evaluatedWeeks: row.evaluatedWeeks, weeklyPoints: row.metadata.weeklyPoints })
        });
        return resultWithGroups("bestAverageWeeklyScore", METRIC_DEFINITIONS.averageWeeklyScore, derived.scope, groups, normalized.minimumEvaluatedWeeks);
    }

    function bestAveragePlacement(state, options = {}) {
        const normalized = normalizeOptions(state, options);
        const derived = deriveParticipantCategoryMetrics(state, options);
        const groups = groupedLeaderboard(derived.rows, {
            eligible: (row) => row.appearances >= normalized.minimumAppearances,
            compare: (left, right) => left.averagePlacement - right.averagePlacement,
            same: (left, right) => equalNumber(left.averagePlacement, right.averagePlacement),
            value: (row) => row.averagePlacement,
            sampleSize: (row) => row.appearances,
            metadata: (row) => ({ appearances: row.appearances, ranks: row.metadata.ranks })
        });
        return resultWithGroups("bestAveragePlacement", METRIC_DEFINITIONS.averagePlacement, derived.scope, groups, normalized.minimumAppearances);
    }

    function rankedCounts(items, labelAccessor) {
        const ordered = [...items].sort((left, right) => right.count - left.count
            || compareText(labelAccessor(left), labelAccessor(right)));
        return ordered.map((item, index) => ({
            ...item,
            rank: index > 0 && item.count === ordered[index - 1].count ? null : index + 1,
            tied: (index > 0 && item.count === ordered[index - 1].count)
                || (index < ordered.length - 1 && item.count === ordered[index + 1].count)
        })).map((item, index, entries) => ({ ...item, rank: item.rank === null ? entries[index - 1].rank : item.rank }));
    }

    function deriveMostPraisedSkills(state, options = {}) {
        const context = scopedContext(state, options);
        const counts = new Map();
        scopedVotes(state, context, true).forEach((vote) => {
            (vote.reasonTagIds || []).forEach((tagId) => {
                if (context.tagsById.has(tagId)) counts.set(tagId, (counts.get(tagId) || 0) + 1);
            });
        });
        const entries = rankedCounts([...counts].map(([tagId, count]) => ({
            tagId,
            tag: context.tagsById.get(tagId),
            count,
            value: count,
            sampleSize: count
        })), (entry) => entry.tag.name);
        return {
            metric: "mostPraisedSkill",
            definition: METRIC_DEFINITIONS.praisedSkill,
            scope: context.scope,
            entries,
            insufficientData: entries.length === 0
        };
    }

    function deriveProfileTagAnalytics(state, options = {}) {
        const normalized = normalizeOptions(state, options);
        const participantsById = new Map(state.participants.map((participant) => [participant.id, participant]));
        const tagsById = new Map(state.tags.map((tag) => [tag.id, tag]));
        const typeFilter = options.tagType || options.type || null;
        if (typeFilter && !constants.TAG_TYPES.includes(typeFilter)) throw new TypeError("Profile tag type is unsupported.");
        const countsByType = new Map(constants.TAG_TYPES.map((type) => [type, new Map()]));
        state.participantTagAssignments
            .filter((assignment) => assignment.removedAt === null)
            .forEach((assignment) => {
                const participant = participantsById.get(assignment.participantId);
                const tag = tagsById.get(assignment.tagId);
                if (!participantMatches(participant, normalized) || !tag) return;
                if (normalized.categoryId && tag.categoryId !== normalized.categoryId) return;
                if (typeFilter && tag.type !== typeFilter) return;
                const counts = countsByType.get(tag.type);
                counts.set(tag.id, (counts.get(tag.id) || 0) + 1);
            });
        const byType = {};
        constants.TAG_TYPES.forEach((type) => {
            byType[type] = rankedCounts([...countsByType.get(type)].map(([tagId, count]) => ({
                tagId,
                tag: tagsById.get(tagId),
                count,
                value: count,
                sampleSize: count
            })), (entry) => entry.tag.name);
        });
        const entries = typeFilter ? byType[typeFilter] : constants.TAG_TYPES.flatMap((type) => byType[type]);
        return {
            metric: "profileTagAnalytics",
            definition: METRIC_DEFINITIONS.profileTags,
            filters: {
                categoryId: normalized.categoryId,
                gender: normalized.gender,
                groupId: normalized.groupId,
                participantId: normalized.participantId,
                tagType: typeFilter
            },
            byType,
            entries,
            insufficientData: entries.length === 0
        };
    }

    function deriveRatingDistribution(state, options = {}) {
        const context = scopedContext(state, options);
        const users = context.normalized.userId ? [context.normalized.userId] : constants.VOTER_IDS;
        const votes = scopedVotes(state, context, false);
        const distributions = users.map((userId) => {
            const userVotes = votes.filter((vote) => vote.userId === userId);
            const totalVotes = userVotes.length;
            const ratings = constants.RATING_OPTIONS.map((rating) => {
                const count = userVotes.filter((vote) => vote.rating === rating.id).length;
                return {
                    ratingId: rating.id,
                    label: rating.label,
                    score: rating.score,
                    count,
                    percentage: totalVotes ? (count / totalVotes) * 100 : 0
                };
            });
            return { userId, totalVotes, ratings, insufficientData: totalVotes === 0 };
        });
        return {
            metric: "ratingDistribution",
            definition: METRIC_DEFINITIONS.ratingDistribution,
            scope: context.scope,
            distributions,
            insufficientData: distributions.every((distribution) => distribution.insufficientData)
        };
    }

    function deriveUserAnalytics(state, userId, options = {}) {
        if (!voterIds.has(userId)) throw new TypeError("User analytics requires p1 or p2.");
        const merged = { ...options, userId };
        const context = scopedContext(state, merged);
        const votes = scopedVotes(state, context, true);
        const participantCounts = new Map();
        votes.forEach((vote) => participantCounts.set(vote.participantId, (participantCounts.get(vote.participantId) || 0) + 1));
        const mostEvaluatedParticipants = rankedCounts([...participantCounts].map(([participantId, count]) => ({
            participantId,
            participant: context.participantsById.get(participantId),
            count,
            value: count,
            sampleSize: count
        })), (entry) => entry.participant.name);
        const scores = votes.map((vote) => weekly.ratingScore(vote.rating));
        return {
            metric: "userAnalytics",
            userId,
            scope: context.scope,
            totalVotes: votes.length,
            averageRating: mean(scores),
            standoutVotes: votes.filter((vote) => vote.rating === "standout").length,
            mostCommonReasons: deriveMostPraisedSkills(state, merged).entries,
            mostEvaluatedParticipants,
            ratingDistribution: deriveRatingDistribution(state, merged).distributions[0],
            insufficientData: votes.length === 0
        };
    }

    function deriveWeeklyActivity(state, options = {}) {
        const context = scopedContext(state, options);
        const votes = scopedVotes(state, context, true);
        const weeks = context.weeks.map((week) => {
            const weekVotes = votes.filter((vote) => vote.weekId === week.id);
            return {
                weekId: week.id,
                week,
                totalVotes: weekVotes.length,
                participantsEvaluated: new Set(weekVotes.map((vote) => vote.participantId)).size,
                categoriesEvaluated: new Set(weekVotes.map((vote) => vote.categoryId)).size,
                standoutsUsed: weekVotes.filter((vote) => vote.rating === "standout").length,
                reasonTagMentions: weekVotes.reduce((total, vote) => total + (vote.reasonTagIds || []).length, 0),
                uniqueReasonTags: new Set(weekVotes.flatMap((vote) => vote.reasonTagIds || [])).size
            };
        });
        return {
            metric: "weeklyActivity",
            definition: METRIC_DEFINITIONS.weeklyActivity,
            scope: context.scope,
            weeks,
            insufficientData: weeks.every((week) => week.totalVotes === 0)
        };
    }

    function mostActiveWeek(state, options = {}) {
        const activity = deriveWeeklyActivity(state, options);
        const highest = Math.max(0, ...activity.weeks.map((week) => week.totalVotes));
        const entries = highest > 0 ? activity.weeks.filter((week) => week.totalVotes === highest)
            .map((week) => ({ ...week, value: week.totalVotes, rank: 1, tied: activity.weeks.filter((item) => item.totalVotes === highest).length > 1 })) : [];
        return {
            metric: "mostActiveWeek",
            definition: "Week or tied weeks with the largest number of weeklyVotes. This measures activity, not performance.",
            scope: activity.scope,
            entries,
            insufficientData: entries.length === 0
        };
    }

    function deriveCategoryAnalytics(state, options = {}) {
        const context = scopedContext(state, options);
        const participantMetrics = deriveParticipantCategoryMetrics(state, options).rows;
        const votes = scopedVotes(state, context, false);
        const categories = constants.CATEGORIES.filter((category) => !context.normalized.categoryId || category.id === context.normalized.categoryId);
        const genders = constants.GENDERS.filter((gender) => !context.normalized.gender || gender === context.normalized.gender);
        const rows = [];
        categories.forEach((category) => genders.forEach((gender) => {
            const participantIds = new Set(context.participants.filter((participant) => participant.gender === gender).map((participant) => participant.id));
            const categoryVotes = votes.filter((vote) => vote.categoryId === category.id && participantIds.has(vote.participantId));
            const metrics = participantMetrics.filter((row) => row.categoryId === category.id && row.gender === gender);
            const records = metrics.flatMap((row) => row.records);
            const wins = metrics.filter((row) => row.wins > 0);
            const mostWins = wins.length ? Math.max(...wins.map((row) => row.wins)) : 0;
            const praised = deriveMostPraisedSkills(state, { ...options, categoryId: category.id, gender }).entries;
            rows.push({
                categoryId: category.id,
                gender,
                totalVotes: categoryVotes.length,
                uniqueParticipantsEvaluated: new Set(categoryVotes.map((vote) => vote.participantId)).size,
                averageWeeklyScore: mean(records.map((record) => record.metrics.weeklyPoints)),
                totalStandouts: categoryVotes.filter((vote) => vote.rating === "standout").length,
                mostPraisedSkill: praised[0] || null,
                mostWinsParticipants: mostWins ? wins.filter((row) => row.wins === mostWins).map((row) => ({
                    participantId: row.participantId,
                    participant: row.participant,
                    wins: row.wins
                })) : [],
                insufficientData: categoryVotes.length === 0
            });
        }));
        return { metric: "categoryAnalytics", scope: context.scope, rows, insufficientData: rows.every((row) => row.insufficientData) };
    }

    function deriveGroupAnalytics(state, options = {}) {
        const context = scopedContext(state, options);
        const participantMetrics = deriveParticipantCategoryMetrics(state, options).rows;
        const groups = state.groups.filter((group) => !context.normalized.groupId || context.normalized.groupId === group.id);
        const rows = [];
        groups.forEach((group) => {
            constants.CATEGORIES.filter((category) => !context.normalized.categoryId || category.id === context.normalized.categoryId)
                .forEach((category) => constants.GENDERS.filter((gender) => !context.normalized.gender || gender === context.normalized.gender)
                    .forEach((gender) => {
                        const metrics = participantMetrics.filter((row) => row.participant.groupId === group.id
                            && row.categoryId === category.id && row.gender === gender);
                        rows.push({
                            groupId: group.id,
                            group,
                            categoryId: category.id,
                            gender,
                            participantsEvaluated: new Set(metrics.map((row) => row.participantId)).size,
                            wins: metrics.reduce((total, row) => total + row.wins, 0),
                            topThreeAppearances: metrics.reduce((total, row) => total + row.topThreeAppearances, 0),
                            standoutVotes: metrics.reduce((total, row) => total + row.standoutVotes, 0),
                            insufficientData: metrics.length === 0
                        });
                    }));
        });
        return {
            metric: "groupAnalytics",
            description: "Descriptive group totals only. No Best Group rank is assigned.",
            scope: context.scope,
            rows,
            insufficientData: rows.every((row) => row.insufficientData)
        };
    }

    namespace.analytics = Object.freeze({
        DEFAULT_MINIMUMS,
        METRIC_DEFINITIONS,
        PENDING_METRICS,
        createScope,
        deriveParticipantCategoryMetrics,
        mostWeeklyWins,
        mostTopThreeAppearances,
        mostStandouts,
        mostDuoStandouts,
        mostSoloPicks,
        mostSplitDecisions,
        mostControversial,
        biggestDisagreement,
        highestAgreement,
        mostConsistent,
        mostImproved,
        bestAverageWeeklyScore,
        bestAveragePlacement,
        deriveMostPraisedSkills,
        deriveProfileTagAnalytics,
        deriveUserAnalytics,
        deriveRatingDistribution,
        deriveWeeklyActivity,
        mostActiveWeek,
        deriveCategoryAnalytics,
        deriveGroupAnalytics
    });
    root.StatsV2 = namespace;
})(globalThis);
