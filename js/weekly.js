(function defineWeeklyVoting(root) {
    "use strict";

    const namespace = root.StatsV2 || {};
    const constants = namespace.constants;
    const data = namespace.data;

    if (!constants || !data) throw new Error("Stats V2 constants and data must load before weekly voting.");

    const DAY_MS = 24 * 60 * 60 * 1000;
    const PANAMA_TIME_ZONE = "America/Panama";
    const ratingById = new Map(constants.RATING_OPTIONS.map((rating) => [rating.id, rating]));
    const categoryIds = new Set(constants.CATEGORIES.map((category) => category.id));

    class WeeklyError extends Error {
        constructor(code, message) {
            super(message);
            this.name = "WeeklyError";
            this.code = code;
        }
    }

    function cloneState(state) { return JSON.parse(JSON.stringify(state)); }
    function assertState(state) {
        const validation = data.validateState(state);
        if (!validation.valid) throw new WeeklyError("INVALID_STATE", validation.errors.join(" "));
    }
    function datePartsInPanama(value) {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) throw new WeeklyError("INVALID_DATE", "A valid date is required.");
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: PANAMA_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit"
        }).formatToParts(date);
        const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
        return { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
    }
    function dateKey(date) {
        return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    }
    function isoWeekForDate(value = new Date()) {
        const parts = datePartsInPanama(value);
        const localDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
        const weekday = (localDate.getUTCDay() + 6) % 7;
        const monday = new Date(localDate.getTime() - weekday * DAY_MS);
        const thursday = new Date(monday.getTime() + 3 * DAY_MS);
        const isoYear = thursday.getUTCFullYear();
        const januaryFourth = new Date(Date.UTC(isoYear, 0, 4));
        const januaryFourthWeekday = (januaryFourth.getUTCDay() + 6) % 7;
        const firstMonday = new Date(januaryFourth.getTime() - januaryFourthWeekday * DAY_MS);
        const weekNumber = Math.floor((monday.getTime() - firstMonday.getTime()) / (7 * DAY_MS)) + 1;
        const sunday = new Date(monday.getTime() + 6 * DAY_MS);
        const paddedWeek = String(weekNumber).padStart(2, "0");
        return {
            id: `${isoYear}-W${paddedWeek}`, label: `W${paddedWeek}`,
            startDate: dateKey(monday), endDate: dateKey(sunday), timeZone: PANAMA_TIME_ZONE
        };
    }
    function formatWeekRange(week, locale = "en-US") {
        const format = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" });
        const start = new Date(`${week.startDate}T12:00:00.000Z`);
        const end = new Date(`${week.endDate}T12:00:00.000Z`);
        return `${format.format(start)} - ${format.format(end)}`;
    }
    function findWeek(state, weekId) {
        const week = state.weeks.find((item) => item.id === weekId);
        if (!week) throw new WeeklyError("WEEK_NOT_FOUND", "The selected week does not exist.");
        return week;
    }
    function findParticipant(state, participantId) {
        const participant = state.participants.find((item) => item.id === participantId);
        if (!participant) throw new WeeklyError("PARTICIPANT_NOT_FOUND", "The participant does not exist.");
        return participant;
    }
    function assertVoter(state, userId) {
        if (!constants.VOTER_IDS.includes(userId) || !state.settings.voters.some((voter) => voter.id === userId)) {
            throw new WeeklyError("INVALID_VOTER", "The voter must be p1 or p2.");
        }
    }
    function assertParticipantCategory(participant, categoryId) {
        if (!categoryIds.has(categoryId)) throw new WeeklyError("INVALID_CATEGORY", "Select a valid voting category.");
        if (!participant.categoryIds.includes(categoryId)) {
            throw new WeeklyError("CATEGORY_NOT_ASSIGNED", "This category is not assigned to the participant.");
        }
    }

    function openCurrentIsoWeek(state, value = new Date(), timestamp = new Date().toISOString()) {
        assertState(state);
        const descriptor = isoWeekForDate(value);
        const existing = state.weeks.find((week) => week.id === descriptor.id);
        if (existing) {
            if (existing.status === "CLOSED") {
                throw new WeeklyError("WEEK_CLOSED", `${descriptor.label} is closed. Use Reopen Week explicitly.`);
            }
            const nextState = cloneState(state);
            nextState.settings.activeWeekId = existing.id;
            assertState(nextState);
            return { state: nextState, week: nextState.weeks.find((week) => week.id === existing.id), created: false };
        }
        const openWeek = state.weeks.find((week) => week.status === "OPEN");
        if (openWeek) throw new WeeklyError("OPEN_WEEK_EXISTS", `Close ${openWeek.label} before opening ${descriptor.label}.`);
        const nextState = cloneState(state);
        const week = data.createWeek({ ...descriptor, id: descriptor.id, status: "OPEN" }, timestamp);
        nextState.weeks.push(week);
        nextState.settings.activeWeekId = week.id;
        assertState(nextState);
        return { state: nextState, week, created: true };
    }
    function closeWeek(state, weekId, timestamp = new Date().toISOString()) {
        assertState(state);
        const current = findWeek(state, weekId);
        if (current.status === "CLOSED") throw new WeeklyError("WEEK_CLOSED", "This week is already closed.");
        const nextState = cloneState(state);
        const week = nextState.weeks.find((item) => item.id === weekId);
        week.status = "CLOSED";
        if (Object.prototype.hasOwnProperty.call(week, "closed")) week.closed = true;
        week.closedAt = timestamp;
        week.updatedAt = timestamp;
        if (nextState.settings.activeWeekId === weekId) nextState.settings.activeWeekId = null;
        assertState(nextState);
        return { state: nextState, week };
    }
    function reopenWeek(state, weekId, timestamp = new Date().toISOString()) {
        assertState(state);
        const current = findWeek(state, weekId);
        if (current.status !== "CLOSED") throw new WeeklyError("WEEK_OPEN", "Only a closed week can be reopened.");
        const otherOpenWeek = state.weeks.find((week) => week.status === "OPEN" && week.id !== weekId);
        if (otherOpenWeek) {
            throw new WeeklyError("OPEN_WEEK_EXISTS", "Close the currently open week before reopening another week.");
        }
        const nextState = cloneState(state);
        const week = nextState.weeks.find((item) => item.id === weekId);
        week.status = "OPEN";
        if (Object.prototype.hasOwnProperty.call(week, "closed")) week.closed = false;
        week.reopenedAt = timestamp;
        week.reopenCount = (week.reopenCount || 0) + 1;
        week.updatedAt = timestamp;
        nextState.settings.activeWeekId = weekId;
        assertState(nextState);
        return { state: nextState, week };
    }

    function findVote(state, weekId, participantId, categoryId, userId) {
        return state.weeklyVotes.find((vote) => vote.weekId === weekId
            && vote.participantId === participantId && vote.categoryId === categoryId
            && vote.userId === userId && vote.legacyUncategorized !== true) || null;
    }
    function findLegacyVote(state, weekId, participantId, userId) {
        return state.weeklyVotes.find((vote) => vote.weekId === weekId
            && vote.participantId === participantId && vote.userId === userId
            && vote.legacyUncategorized === true) || null;
    }
    function normalizeVoteInput(state, input) {
        const week = findWeek(state, input.weekId);
        if (week.status !== "OPEN") throw new WeeklyError("WEEK_CLOSED", "Closed weeks are read-only.");
        const participant = findParticipant(state, input.participantId);
        if (participant.archivedAt !== null) {
            throw new WeeklyError("PARTICIPANT_ARCHIVED", "Archived participants cannot receive new weekly votes.");
        }
        assertParticipantCategory(participant, input.categoryId);
        assertVoter(state, input.userId);
        if (!ratingById.has(input.rating)) throw new WeeklyError("INVALID_RATING", "Select a valid weekly rating.");
        const reasonTagIds = Array.isArray(input.reasonTagIds) ? [...new Set(input.reasonTagIds)] : [];
        if (reasonTagIds.some((tagId) => typeof tagId !== "string")) {
            throw new WeeklyError("INVALID_REASONS", "Reason tags must use valid tag IDs.");
        }
        if (reasonTagIds.length > constants.MAX_WEEKLY_REASON_TAGS) {
            throw new WeeklyError("REASON_LIMIT", `Choose up to ${constants.MAX_WEEKLY_REASON_TAGS} reason tags.`);
        }
        const tagIds = new Set(state.tags.map((tag) => tag.id));
        if (reasonTagIds.some((tagId) => !tagIds.has(tagId))) {
            throw new WeeklyError("TAG_NOT_FOUND", "One or more reason tags no longer exist.");
        }
        const note = typeof input.note === "string" ? input.note.trim() : "";
        if (note.length > constants.MAX_WEEKLY_NOTE_LENGTH) {
            throw new WeeklyError("NOTE_TOO_LONG", `Notes must be ${constants.MAX_WEEKLY_NOTE_LENGTH} characters or fewer.`);
        }
        return { reasonTagIds, note };
    }
    function standoutCountForUser(state, weekId, userId, ignoredVoteId = null) {
        return state.weeklyVotes.filter((vote) => vote.weekId === weekId && vote.userId === userId
            && vote.rating === "standout" && vote.id !== ignoredVoteId).length;
    }
    function upsertVote(state, input, timestamp = new Date().toISOString()) {
        assertState(state);
        const normalized = normalizeVoteInput(state, input);
        const existing = findVote(state, input.weekId, input.participantId, input.categoryId, input.userId);
        if (input.rating === "standout"
            && standoutCountForUser(state, input.weekId, input.userId, existing && existing.id) >= constants.MAX_WEEKLY_STANDOUTS) {
            throw new WeeklyError("STANDOUT_LIMIT",
                `You have used all ${constants.MAX_WEEKLY_STANDOUTS} Standouts for this week. Lower or remove another Standout first.`);
        }
        const nextState = cloneState(state);
        let vote;
        if (existing) {
            vote = nextState.weeklyVotes.find((item) => item.id === existing.id);
            Object.assign(vote, {
                rating: input.rating, reasonTagIds: normalized.reasonTagIds,
                note: normalized.note, updatedAt: timestamp
            });
            if (Object.prototype.hasOwnProperty.call(vote, "selectedTagIds")) {
                vote.selectedTagIds = [...normalized.reasonTagIds];
            }
        } else {
            vote = data.createWeeklyVote({
                weekId: input.weekId, participantId: input.participantId, categoryId: input.categoryId,
                userId: input.userId, rating: input.rating,
                reasonTagIds: normalized.reasonTagIds, note: normalized.note
            }, timestamp);
            nextState.weeklyVotes.push(vote);
        }
        assertState(nextState);
        return { state: nextState, vote, created: !existing };
    }
    function removeVote(state, weekId, participantId, categoryId, userId) {
        assertState(state);
        const week = findWeek(state, weekId);
        if (week.status !== "OPEN") throw new WeeklyError("WEEK_CLOSED", "Closed weeks are read-only.");
        const participant = findParticipant(state, participantId);
        assertParticipantCategory(participant, categoryId);
        assertVoter(state, userId);
        const existing = findVote(state, weekId, participantId, categoryId, userId);
        if (!existing) return { state: cloneState(state), vote: null, removed: false };
        const nextState = cloneState(state);
        nextState.weeklyVotes = nextState.weeklyVotes.filter((vote) => vote.id !== existing.id);
        assertState(nextState);
        return { state: nextState, vote: { ...existing }, removed: true };
    }
    function assignLegacyVoteCategory(state, voteId, categoryId, timestamp = new Date().toISOString()) {
        assertState(state);
        const existing = state.weeklyVotes.find((vote) => vote.id === voteId);
        if (!existing || existing.legacyUncategorized !== true) {
            throw new WeeklyError("LEGACY_VOTE_NOT_FOUND", "The uncategorized legacy vote no longer exists.");
        }
        const week = findWeek(state, existing.weekId);
        if (week.status !== "OPEN") throw new WeeklyError("WEEK_CLOSED", "Reopen the week before categorizing this legacy vote.");
        const participant = findParticipant(state, existing.participantId);
        assertParticipantCategory(participant, categoryId);
        if (findVote(state, existing.weekId, existing.participantId, categoryId, existing.userId)) {
            throw new WeeklyError("CATEGORY_VOTE_EXISTS", "This category already has a vote for the same user and week.");
        }
        const nextState = cloneState(state);
        const vote = nextState.weeklyVotes.find((item) => item.id === voteId);
        vote.categoryId = categoryId;
        delete vote.legacyUncategorized;
        vote.updatedAt = timestamp;
        assertState(nextState);
        return { state: nextState, vote };
    }

    function ratingScore(ratingId) { return ratingById.get(ratingId)?.score ?? null; }
    function deriveCategoryWeeklyMetrics(state, weekId, participantId, categoryId) {
        findWeek(state, weekId);
        const participant = findParticipant(state, participantId);
        assertParticipantCategory(participant, categoryId);
        const votes = state.weeklyVotes.filter((vote) => vote.weekId === weekId
            && vote.participantId === participantId && vote.categoryId === categoryId
            && vote.legacyUncategorized !== true);
        const scores = votes.map((vote) => ratingScore(vote.rating));
        return {
            participantId, categoryId, weekId,
            weeklyPoints: scores.reduce((total, score) => total + score, 0),
            votesCount: votes.length,
            votersCount: new Set(votes.map((vote) => vote.userId)).size,
            standoutCount: votes.filter((vote) => vote.rating === "standout").length,
            ratingDifference: scores.length === constants.VOTER_IDS.length ? Math.max(...scores) - Math.min(...scores) : null,
            provisional: votes.length === 1
        };
    }
    function compareWeeklyMetrics(left, right) {
        return right.weeklyPoints - left.weeklyPoints
            || right.votersCount - left.votersCount
            || right.standoutCount - left.standoutCount;
    }
    function sameRankMetrics(left, right) {
        return left.weeklyPoints === right.weeklyPoints
            && left.votersCount === right.votersCount
            && left.standoutCount === right.standoutCount;
    }
    function deriveWeeklyRanking(state, weekId, categoryId) {
        findWeek(state, weekId);
        if (!categoryIds.has(categoryId)) throw new WeeklyError("INVALID_CATEGORY", "Select a valid ranking category.");
        const participantsById = new Map(state.participants.map((participant) => [participant.id, participant]));
        const votedParticipantIds = [...new Set(state.weeklyVotes
            .filter((vote) => vote.weekId === weekId && vote.categoryId === categoryId && vote.legacyUncategorized !== true)
            .map((vote) => vote.participantId))];
        const items = votedParticipantIds.map((participantId) => ({
            participant: participantsById.get(participantId),
            metrics: deriveCategoryWeeklyMetrics(state, weekId, participantId, categoryId),
            rank: null, tied: false
        }));
        items.sort((left, right) => compareWeeklyMetrics(left.metrics, right.metrics)
            || left.participant.name.localeCompare(right.participant.name, "es", { sensitivity: "base" }));
        items.forEach((item, index) => {
            item.rank = index > 0 && sameRankMetrics(item.metrics, items[index - 1].metrics)
                ? items[index - 1].rank : index + 1;
        });
        items.forEach((item, index) => {
            item.tied = (index > 0 && sameRankMetrics(item.metrics, items[index - 1].metrics))
                || (index < items.length - 1 && sameRankMetrics(item.metrics, items[index + 1].metrics));
        });
        return items;
    }
    function createWeeklyPointsProvider(state, weekId) {
        findWeek(state, weekId);
        return (participant, categoryId) => {
            if (!categoryId || !participant.categoryIds.includes(categoryId)) return null;
            const metrics = deriveCategoryWeeklyMetrics(state, weekId, participant.id, categoryId);
            return metrics.votesCount > 0 ? metrics.weeklyPoints : null;
        };
    }
    function weeklyProgress(state, weekId, userId) {
        findWeek(state, weekId);
        assertVoter(state, userId);
        const votes = state.weeklyVotes.filter((vote) => vote.weekId === weekId && vote.userId === userId);
        const standoutsUsed = votes.filter((vote) => vote.rating === "standout").length;
        return {
            evaluatedCount: votes.length,
            standoutsUsed,
            standoutsRemaining: constants.MAX_WEEKLY_STANDOUTS - standoutsUsed,
            standoutLimitReached: standoutsUsed >= constants.MAX_WEEKLY_STANDOUTS
        };
    }
    function comparableText(value) { return String(value || "").trim().toLocaleLowerCase("es"); }
    function filterWeeklyParticipants(state, weekId, userId, options = {}) {
        const week = findWeek(state, weekId);
        assertVoter(state, userId);
        const query = comparableText(options.query);
        const categoryId = options.categoryId || "all";
        const gender = options.gender || "all";
        const groupId = options.groupId || "all";
        const evaluation = options.evaluation || "all";
        const groupsById = new Map(state.groups.map((group) => [group.id, group.name]));
        const historicalIds = new Set(state.weeklyVotes.filter((vote) => vote.weekId === weekId).map((vote) => vote.participantId));
        return state.participants
            .filter((participant) => participant.archivedAt === null || (week.status === "CLOSED" && historicalIds.has(participant.id)))
            .filter((participant) => categoryId === "all" || participant.categoryIds.includes(categoryId))
            .filter((participant) => gender === "all" || participant.gender === gender)
            .filter((participant) => groupId === "all" || (groupId === "soloist" ? participant.groupId === null : participant.groupId === groupId))
            .filter((participant) => {
                const groupName = participant.groupId ? groupsById.get(participant.groupId) : "";
                return !query || comparableText(participant.name).includes(query) || comparableText(groupName).includes(query);
            })
            .filter((participant) => {
                const votes = state.weeklyVotes.filter((vote) => vote.weekId === weekId
                    && vote.participantId === participant.id && vote.userId === userId
                    && (categoryId === "all" || vote.categoryId === categoryId));
                if (evaluation === "all") return true;
                if (evaluation === "evaluated") return votes.length > 0;
                if (evaluation === "not-evaluated") return votes.length === 0;
                return votes.some((vote) => vote.rating === evaluation);
            })
            .sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" }));
    }

    namespace.weekly = Object.freeze({
        WeeklyError, PANAMA_TIME_ZONE, isoWeekForDate, formatWeekRange,
        openCurrentIsoWeek, closeWeek, reopenWeek,
        findVote, findLegacyVote, upsertVote, removeVote, assignLegacyVoteCategory,
        ratingScore, standoutCountForUser, deriveCategoryWeeklyMetrics,
        compareWeeklyMetrics, sameRankMetrics, deriveWeeklyRanking, createWeeklyPointsProvider,
        weeklyProgress, filterWeeklyParticipants
    });
    root.StatsV2 = namespace;
})(globalThis);
