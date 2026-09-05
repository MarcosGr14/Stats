(function defineSeason(root) {
    "use strict";

    const namespace = root.StatsV2 || {};
    const constants = namespace.constants;
    const analytics = namespace.analytics;

    if (!constants || !analytics) {
        throw new Error("Stats V2 constants and Analytics must load before Season Standings.");
    }

    const MAX_WEEKLY_POINTS = 6;
    const MINIMUM_ELIGIBLE_WEEKS = 5;
    const SEASON_SCORE_WEIGHTS = Object.freeze({
        averagePerformance: 0.40,
        winRate: 0.25,
        topThreeRate: 0.20,
        standoutRate: 0.15
    });
    const GRAND_SCORE_WEIGHTS = Object.freeze({ bestCategory: 0.95, secondCategory: 0.05 });
    const categoryIds = new Set(constants.CATEGORIES.map((category) => category.id));
    const genderIds = new Set(constants.GENDERS);

    function compareText(left, right) {
        return String(left || "").localeCompare(String(right || ""), "es", { sensitivity: "base" });
    }

    function categoryIndex(categoryId) {
        return constants.CATEGORIES.findIndex((category) => category.id === categoryId);
    }

    function assertFiniteNonNegative(value, field) {
        if (!Number.isFinite(value) || value < 0) throw new TypeError(`${field} must be a finite non-negative number.`);
        return value;
    }

    function normalizedPeriodOptions(options = {}) {
        return {
            includeOpen: options.includeOpen === true,
            fromWeekId: options.fromWeekId || options.startWeekId || undefined,
            toWeekId: options.toWeekId || options.endWeekId || undefined,
            lastNWeeks: options.lastNWeeks
        };
    }

    function validateStandingSelection(categoryId, gender) {
        if (!categoryIds.has(categoryId)) throw new TypeError("Season category is unsupported.");
        if (!genderIds.has(gender)) throw new TypeError("Season gender is unsupported.");
    }

    function calculateSeasonScore(metrics) {
        const weeksEvaluated = assertFiniteNonNegative(
            metrics.weeksEvaluated ?? metrics.evaluatedWeeks,
            "weeksEvaluated"
        );
        if (!Number.isInteger(weeksEvaluated) || weeksEvaluated === 0) {
            throw new TypeError("weeksEvaluated must be a positive integer.");
        }
        const averageWeeklyPoints = assertFiniteNonNegative(metrics.averageWeeklyPoints, "averageWeeklyPoints");
        const wins = assertFiniteNonNegative(metrics.wins, "wins");
        const topThreeAppearances = assertFiniteNonNegative(metrics.topThreeAppearances, "topThreeAppearances");
        const standoutVotes = assertFiniteNonNegative(metrics.standoutVotes, "standoutVotes");
        const possibleStandoutVotes = weeksEvaluated * constants.VOTER_IDS.length;
        const averagePerformance = (averageWeeklyPoints / MAX_WEEKLY_POINTS) * 100;
        const winRate = (wins / weeksEvaluated) * 100;
        const topThreeRate = (topThreeAppearances / weeksEvaluated) * 100;
        const standoutRate = (standoutVotes / possibleStandoutVotes) * 100;
        const contributions = Object.freeze({
            averagePerformance: averagePerformance * SEASON_SCORE_WEIGHTS.averagePerformance,
            winRate: winRate * SEASON_SCORE_WEIGHTS.winRate,
            topThreeRate: topThreeRate * SEASON_SCORE_WEIGHTS.topThreeRate,
            standoutRate: standoutRate * SEASON_SCORE_WEIGHTS.standoutRate
        });
        const seasonScore = contributions.averagePerformance + contributions.winRate
            + contributions.topThreeRate + contributions.standoutRate;
        return Object.freeze({
            seasonScore,
            weeksEvaluated,
            possibleStandoutVotes,
            components: Object.freeze({ averagePerformance, winRate, topThreeRate, standoutRate }),
            contributions
        });
    }

    function createStandingEntry(row) {
        const calculation = calculateSeasonScore(row);
        return {
            participantId: row.participantId,
            participant: row.participant,
            group: row.group,
            categoryId: row.categoryId,
            gender: row.gender,
            seasonScore: calculation.seasonScore,
            weeksEvaluated: row.evaluatedWeeks,
            wins: row.wins,
            topThreeAppearances: row.topThreeAppearances,
            averageWeeklyPoints: row.averageWeeklyPoints,
            standoutVotes: row.standoutVotes,
            possibleStandoutVotes: calculation.possibleStandoutVotes,
            components: calculation.components,
            contributions: calculation.contributions,
            eligible: row.evaluatedWeeks >= MINIMUM_ELIGIBLE_WEEKS,
            rank: null,
            tied: false
        };
    }

    function sortByScore(entries, field) {
        return [...entries].sort((left, right) => right[field] - left[field]
            || compareText(left.participant.name, right.participant.name));
    }

    function assignCompetitionRanks(entries, field) {
        const ranked = sortByScore(entries, field).map((entry, index, ordered) => ({
            ...entry,
            rank: index > 0 && entry[field] === ordered[index - 1][field] ? null : index + 1,
            tied: false
        }));
        ranked.forEach((entry, index) => {
            if (entry.rank === null) entry.rank = ranked[index - 1].rank;
            entry.tied = (index > 0 && entry[field] === ranked[index - 1][field])
                || (index < ranked.length - 1 && entry[field] === ranked[index + 1][field]);
        });
        return ranked;
    }

    function standingFromRows(rows, scope, categoryId, gender) {
        const entries = rows
            .filter((row) => row.categoryId === categoryId && row.gender === gender)
            .map(createStandingEntry);
        const eligible = assignCompetitionRanks(entries.filter((entry) => entry.eligible), "seasonScore");
        const provisional = sortByScore(entries.filter((entry) => !entry.eligible), "seasonScore");
        return Object.freeze({
            categoryId,
            gender,
            scope: Object.freeze({ ...scope, categoryId, gender }),
            minimumEligibleWeeks: MINIMUM_ELIGIBLE_WEEKS,
            eligible: Object.freeze(eligible),
            provisional: Object.freeze(provisional),
            topThree: Object.freeze(eligible.filter((entry) => entry.rank <= 3)),
            winners: Object.freeze(eligible.filter((entry) => entry.rank === 1)),
            insufficientData: entries.length === 0,
            isLivePreview: scope.includeOpen === true
        });
    }

    function deriveCategoryStanding(state, options = {}) {
        const categoryId = options.categoryId;
        const gender = options.gender;
        validateStandingSelection(categoryId, gender);
        const periodOptions = normalizedPeriodOptions(options);
        const derived = analytics.deriveParticipantCategoryMetrics(state, { ...periodOptions, categoryId, gender });
        return standingFromRows(derived.rows, derived.scope, categoryId, gender);
    }

    function deriveAllStandings(state, options = {}) {
        const periodOptions = normalizedPeriodOptions(options);
        const derived = analytics.deriveParticipantCategoryMetrics(state, periodOptions);
        const standings = [];
        constants.CATEGORIES.forEach((category) => {
            constants.GENDERS.forEach((gender) => {
                standings.push(standingFromRows(derived.rows, derived.scope, category.id, gender));
            });
        });
        return Object.freeze({
            scope: derived.scope,
            minimumEligibleWeeks: MINIMUM_ELIGIBLE_WEEKS,
            standings: Object.freeze(standings),
            insufficientData: standings.every((standing) => standing.insufficientData),
            isLivePreview: derived.scope.includeOpen === true
        });
    }

    function findStanding(allStandings, categoryId, gender) {
        validateStandingSelection(categoryId, gender);
        return allStandings.standings.find((standing) => (
            standing.categoryId === categoryId && standing.gender === gender
        )) || null;
    }

    function winnersFromStandings(allStandings) {
        return Object.freeze(allStandings.standings.map((standing) => Object.freeze({
            categoryId: standing.categoryId,
            gender: standing.gender,
            winners: standing.winners,
            isJointWinner: standing.winners.length > 1,
            isLivePreview: standing.isLivePreview,
            insufficientData: standing.winners.length === 0
        })));
    }

    function deriveCategoryWinners(state, options = {}) {
        const allStandings = deriveAllStandings(state, options);
        return Object.freeze({
            scope: allStandings.scope,
            items: winnersFromStandings(allStandings),
            insufficientData: allStandings.standings.every((standing) => standing.winners.length === 0),
            isLivePreview: allStandings.isLivePreview
        });
    }

    function calculateGrandScore(eligibleCategoryEntries) {
        if (!Array.isArray(eligibleCategoryEntries) || eligibleCategoryEntries.length === 0) {
            throw new TypeError("Grand Score requires at least one eligible category.");
        }
        eligibleCategoryEntries.forEach((entry) => {
            if (entry.eligible !== true) throw new TypeError("Grand Score only accepts eligible categories.");
            assertFiniteNonNegative(entry.seasonScore, "seasonScore");
            if (!categoryIds.has(entry.categoryId)) throw new TypeError("Grand Score category is unsupported.");
        });
        const ordered = [...eligibleCategoryEntries].sort((left, right) => right.seasonScore - left.seasonScore
            || categoryIndex(left.categoryId) - categoryIndex(right.categoryId));
        const bestCategory = ordered[0];
        const secondBestCategory = ordered[1] || null;
        const grandScore = secondBestCategory
            ? (bestCategory.seasonScore * GRAND_SCORE_WEIGHTS.bestCategory)
                + (secondBestCategory.seasonScore * GRAND_SCORE_WEIGHTS.secondCategory)
            : bestCategory.seasonScore;
        return Object.freeze({
            grandScore,
            bestCategory,
            secondBestCategory,
            eligibleCategoryCount: ordered.length,
            weights: GRAND_SCORE_WEIGHTS
        });
    }

    function grandStandingsFromAll(allStandings) {
        const categoriesByParticipant = new Map();
        const provisionalByParticipant = new Map();
        allStandings.standings.forEach((standing) => {
            standing.eligible.forEach((entry) => {
                const key = `${entry.gender}\u0000${entry.participantId}`;
                if (!categoriesByParticipant.has(key)) categoriesByParticipant.set(key, []);
                categoriesByParticipant.get(key).push(entry);
            });
            standing.provisional.forEach((entry) => {
                const key = `${entry.gender}\u0000${entry.participantId}`;
                if (!provisionalByParticipant.has(key)) provisionalByParticipant.set(key, []);
                provisionalByParticipant.get(key).push(entry);
            });
        });

        const genders = constants.GENDERS.map((gender) => {
            const candidates = [];
            categoriesByParticipant.forEach((categoryEntries, key) => {
                if (!key.startsWith(`${gender}\u0000`)) return;
                const calculation = calculateGrandScore(categoryEntries);
                const source = categoryEntries[0];
                candidates.push({
                    participantId: source.participantId,
                    participant: source.participant,
                    group: source.group,
                    gender,
                    grandScore: calculation.grandScore,
                    bestCategory: calculation.bestCategory,
                    secondBestCategory: calculation.secondBestCategory,
                    eligibleCategoryCount: calculation.eligibleCategoryCount,
                    rank: null,
                    tied: false
                });
            });
            const entries = assignCompetitionRanks(candidates, "grandScore");
            const candidateIds = new Set(entries.map((entry) => entry.participantId));
            const notEligible = [];
            provisionalByParticipant.forEach((categoryEntries, key) => {
                if (!key.startsWith(`${gender}\u0000`)) return;
                const participantId = key.split("\u0000")[1];
                if (candidateIds.has(participantId)) return;
                const source = categoryEntries[0];
                notEligible.push({
                    participantId,
                    participant: source.participant,
                    group: source.group,
                    gender,
                    provisionalCategories: [...categoryEntries].sort((left, right) => (
                        right.seasonScore - left.seasonScore || categoryIndex(left.categoryId) - categoryIndex(right.categoryId)
                    ))
                });
            });
            notEligible.sort((left, right) => compareText(left.participant.name, right.participant.name));
            return Object.freeze({
                gender,
                entries: Object.freeze(entries),
                winners: Object.freeze(entries.filter((entry) => entry.rank === 1)),
                notEligible: Object.freeze(notEligible),
                insufficientData: entries.length === 0,
                isLivePreview: allStandings.isLivePreview
            });
        });
        return Object.freeze({
            scope: allStandings.scope,
            genders: Object.freeze(genders),
            insufficientData: genders.every((standing) => standing.insufficientData),
            isLivePreview: allStandings.isLivePreview
        });
    }

    function deriveGrandStandings(state, options = {}) {
        return grandStandingsFromAll(deriveAllStandings(state, options));
    }

    function deriveSeasonOverview(state, options = {}) {
        const allStandings = deriveAllStandings(state, options);
        return Object.freeze({
            scope: allStandings.scope,
            allStandings,
            categoryWinners: winnersFromStandings(allStandings),
            grandStandings: grandStandingsFromAll(allStandings),
            isLivePreview: allStandings.isLivePreview
        });
    }

    function displayScore(value) {
        if (!Number.isFinite(value)) return null;
        return Math.round((value + Number.EPSILON) * 10) / 10;
    }

    namespace.season = Object.freeze({
        MAX_WEEKLY_POINTS,
        MINIMUM_ELIGIBLE_WEEKS,
        SEASON_SCORE_WEIGHTS,
        GRAND_SCORE_WEIGHTS,
        calculateSeasonScore,
        deriveCategoryStanding,
        deriveAllStandings,
        findStanding,
        deriveCategoryWinners,
        calculateGrandScore,
        deriveGrandStandings,
        deriveSeasonOverview,
        displayScore
    });
    root.StatsV2 = namespace;
})(globalThis);
