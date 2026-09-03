const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
require(path.join(projectRoot, "js", "constants.js"));
require(path.join(projectRoot, "js", "data.js"));
require(path.join(projectRoot, "js", "weekly.js"));
require(path.join(projectRoot, "js", "spotlight.js"));
require(path.join(projectRoot, "js", "profile-history.js"));
require(path.join(projectRoot, "js", "analytics.js"));

const { data, analytics } = globalThis.StatsV2;
const stamp = "2026-09-13T20:00:00.000Z";

function addWeek(state, id, startDate, endDate, status = "CLOSED") {
    state.weeks.push(data.createWeek({
        id, label: id.slice(-3), startDate, endDate, status,
        closedAt: status === "CLOSED" ? stamp : null
    }, stamp));
}

function vote(state, weekId, participantId, categoryId, userId, rating, reasonTagIds = []) {
    state.weeklyVotes.push(data.createWeeklyVote({
        id: `vote-${state.weeklyVotes.length + 1}`,
        weekId, participantId, categoryId, userId, rating, reasonTagIds
    }, stamp));
}

function score(state, weekId, participantId, categoryId, ratings, reasons = []) {
    ratings.forEach((rating, index) => vote(
        state, weekId, participantId, categoryId, `p${index + 1}`, rating, reasons[index] || []
    ));
}

function fixtureState() {
    const state = data.createEmptyState(stamp);
    state.groups.push(
        data.createGroup({ id: "group-one", name: "Group One" }, stamp),
        data.createGroup({ id: "group-two", name: "Group Two" }, stamp)
    );
    state.tags.push(
        data.createTag({ id: "reason-tone", name: "Tone", categoryId: "vocal", type: "strength", predefined: true }, stamp),
        data.createTag({ id: "reason-power", name: "Power", categoryId: "vocal", type: "strength", predefined: true }, stamp),
        data.createTag({ id: "reason-presence", name: "Stage Presence", categoryId: "stage", type: "strength", predefined: true }, stamp),
        data.createTag({ id: "profile-strong", name: "Stable Profile", categoryId: "vocal", type: "strength", predefined: false }, stamp),
        data.createTag({ id: "profile-weak", name: "Breath Work", categoryId: "vocal", type: "weakness", predefined: false }, stamp),
        data.createTag({ id: "profile-special", name: "Ace", categoryId: "general", type: "neutral", predefined: false }, stamp)
    );
    state.participants.push(
        data.createParticipant({ id: "ari", name: "Ari", groupId: "group-one", gender: "female", categoryIds: ["vocal", "stage"], imageId: "image-ari", archivedAt: stamp }, stamp),
        data.createParticipant({ id: "bora", name: "Bora", groupId: "group-one", gender: "female", categoryIds: ["vocal"] }, stamp),
        data.createParticipant({ id: "cami", name: "Cami", groupId: "group-two", gender: "female", categoryIds: ["vocal"] }, stamp),
        data.createParticipant({ id: "dara", name: "Dara", groupId: null, gender: "female", categoryIds: ["vocal"] }, stamp),
        data.createParticipant({ id: "min", name: "Min", groupId: "group-two", gender: "male", categoryIds: ["vocal"] }, stamp),
        data.createParticipant({ id: "noah", name: "Noah", groupId: "group-two", gender: "male", categoryIds: ["stage"] }, stamp)
    );
    state.participantTagAssignments.push(
        data.createTagAssignment({ id: "assignment-1", participantId: "ari", tagId: "profile-strong" }, stamp),
        data.createTagAssignment({ id: "assignment-2", participantId: "bora", tagId: "profile-strong" }, stamp),
        data.createTagAssignment({ id: "assignment-3", participantId: "ari", tagId: "profile-weak" }, stamp),
        data.createTagAssignment({ id: "assignment-4", participantId: "dara", tagId: "profile-weak" }, stamp),
        data.createTagAssignment({ id: "assignment-5", participantId: "ari", tagId: "profile-special" }, stamp),
        data.createTagAssignment({ id: "assignment-removed", participantId: "cami", tagId: "profile-strong", removedAt: stamp }, stamp)
    );
    addWeek(state, "2026-W32", "2026-08-03", "2026-08-09");
    addWeek(state, "2026-W33", "2026-08-10", "2026-08-16");
    addWeek(state, "2026-W34", "2026-08-17", "2026-08-23");
    addWeek(state, "2026-W35", "2026-08-24", "2026-08-30");
    addWeek(state, "2026-W36", "2026-08-31", "2026-09-06");
    addWeek(state, "2026-W37", "2026-09-07", "2026-09-13", "OPEN");
    state.settings.activeWeekId = "2026-W37";

    score(state, "2026-W32", "ari", "vocal", ["normal", "normal"], [["reason-tone"], ["reason-tone"]]);
    score(state, "2026-W33", "ari", "vocal", ["good", "good"], [["reason-tone"], []]);
    score(state, "2026-W34", "ari", "vocal", ["impressed", "impressed"], [["reason-tone"], ["reason-tone"]]);
    score(state, "2026-W35", "ari", "vocal", ["standout", "standout"], [["reason-tone"], ["reason-power"]]);
    score(state, "2026-W36", "ari", "vocal", ["standout", "normal"], [["reason-tone"], []]);
    score(state, "2026-W37", "ari", "vocal", ["standout", "standout"], [["reason-tone"], ["reason-tone"]]);

    ["2026-W32", "2026-W33", "2026-W34", "2026-W35", "2026-W36"].forEach((weekId) => {
        score(state, weekId, "bora", "vocal", ["impressed", "impressed"], [["reason-power"], ["reason-power"]]);
    });
    ["2026-W32", "2026-W33", "2026-W34"].forEach((weekId) => {
        score(state, weekId, "cami", "vocal", ["standout"], [["reason-power"]]);
    });
    score(state, "2026-W32", "dara", "vocal", ["normal"]);
    score(state, "2026-W34", "dara", "vocal", ["good"]);
    score(state, "2026-W36", "dara", "vocal", ["standout", "standout"], [["reason-power"], ["reason-power"]]);

    score(state, "2026-W32", "min", "vocal", ["standout", "standout"]);
    score(state, "2026-W33", "min", "vocal", ["standout", "impressed"]);
    score(state, "2026-W34", "min", "vocal", ["impressed", "impressed"]);
    score(state, "2026-W35", "min", "vocal", ["impressed", "good"]);
    score(state, "2026-W36", "min", "vocal", ["good", "good"]);

    score(state, "2026-W32", "ari", "stage", ["good"], [["reason-presence"]]);
    score(state, "2026-W34", "ari", "stage", ["impressed"], [["reason-presence"]]);
    score(state, "2026-W36", "ari", "stage", ["standout"], [["reason-presence"]]);
    score(state, "2026-W32", "noah", "stage", ["good", "good"]);
    score(state, "2026-W34", "noah", "stage", ["impressed", "impressed"]);
    score(state, "2026-W36", "noah", "stage", ["standout", "standout"]);
    return state;
}

function femaleVocalGroup(result) {
    return result.groups.find((group) => group.categoryId === "vocal" && group.gender === "female");
}

test("loads Analytics after ranking sources and before application code", () => {
    const html = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
    assert.ok(html.indexOf("js/weekly.js") < html.indexOf("js/analytics.js"));
    assert.ok(html.indexOf("js/spotlight.js") < html.indexOf("js/analytics.js"));
    assert.ok(html.indexOf("js/profile-history.js") < html.indexOf("js/analytics.js"));
    assert.ok(html.indexOf("js/analytics.js") < html.indexOf("js/app.js"));
    assert.match(html, /Datos locales/);
});

test("defaults to CLOSED weeks and supports OPEN, ranges and last N weeks", () => {
    const state = fixtureState();
    assert.deepEqual(analytics.createScope(state).weekIds, ["2026-W32", "2026-W33", "2026-W34", "2026-W35", "2026-W36"]);
    assert.equal(analytics.createScope(state).weekStatus, "CLOSED_ONLY");
    assert.deepEqual(analytics.createScope(state, { includeOpen: true }).weekIds.at(-1), "2026-W37");
    assert.deepEqual(analytics.createScope(state, { fromWeekId: "2026-W34", toWeekId: "2026-W35" }).weekIds,
        ["2026-W34", "2026-W35"]);
    assert.deepEqual(analytics.createScope(state, { lastNWeeks: 2 }).weekIds, ["2026-W35", "2026-W36"]);
});

test("counts weekly wins and joint winners within category and gender", () => {
    const result = analytics.mostWeeklyWins(fixtureState(), { categoryId: "vocal", gender: "female" });
    const entries = femaleVocalGroup(result).entries;
    assert.deepEqual(entries.map((entry) => [entry.participantId, entry.value, entry.rank]), [
        ["bora", 3, 1], ["ari", 2, 2], ["dara", 1, 3]
    ]);
    assert.equal(entries.find((entry) => entry.participantId === "ari").participant.archivedAt !== null, true);
    assert.equal(analytics.mostWeeklyWins(fixtureState(), { categoryId: "vocal", gender: "male" }).groups[0].entries[0].participantId, "min");
    assert.equal(analytics.mostWeeklyWins(fixtureState(), { categoryId: "stage", gender: "female" }).groups[0].entries[0].value, 3);
});

test("counts competition Top 3 appearances including ranks 1, 1, 3 but excludes rank 4", () => {
    const entries = femaleVocalGroup(analytics.mostTopThreeAppearances(fixtureState(), {
        categoryId: "vocal", gender: "female"
    })).entries;
    assert.deepEqual(entries.slice(0, 2).map((entry) => [entry.participantId, entry.value, entry.rank, entry.tied]), [
        ["ari", 5, 1, true], ["bora", 5, 1, true]
    ]);
    assert.deepEqual(entries.find((entry) => entry.participantId === "cami").value, 3);
    assert.equal(entries.some((entry) => entry.participantId === "dara" && entry.value === 1), true);
});

test("keeps Standout votes, Standout weeks, Duo events, Solo Picks and Split Decisions distinct", () => {
    const state = fixtureState();
    const standouts = femaleVocalGroup(analytics.mostStandouts(state, { categoryId: "vocal", gender: "female" })).entries;
    assert.deepEqual(standouts.slice(0, 2).map((entry) => [entry.participantId, entry.value, entry.metadata.weeksWithStandout]), [
        ["ari", 3, 2], ["cami", 3, 3]
    ]);
    assert.deepEqual(femaleVocalGroup(analytics.mostDuoStandouts(state, { categoryId: "vocal", gender: "female" })).entries
        .map((entry) => [entry.participantId, entry.value]), [["ari", 1], ["dara", 1]]);
    assert.deepEqual(femaleVocalGroup(analytics.mostSoloPicks(state, { categoryId: "vocal", gender: "female" })).entries[0].participantId, "cami");
    assert.deepEqual(femaleVocalGroup(analytics.mostSplitDecisions(state, { categoryId: "vocal", gender: "female" })).entries[0].participantId, "ari");
});

test("derives disagreement only from dual-vote events", () => {
    const state = fixtureState();
    const controversial = femaleVocalGroup(analytics.mostControversial(state, {
        categoryId: "vocal", gender: "female"
    })).entries;
    assert.equal(controversial[0].participantId, "ari");
    assert.equal(controversial[0].value, 0.6);
    assert.equal(controversial[0].metadata.maxDifference, 3);
    assert.equal(controversial[0].metadata.splitDecisionCount, 1);
    assert.equal(controversial.some((entry) => entry.participantId === "dara"), false);

    const agreement = femaleVocalGroup(analytics.highestAgreement(state, {
        categoryId: "vocal", gender: "female"
    })).entries;
    assert.equal(agreement[0].participantId, "bora");
    assert.equal(agreement[0].value, 0);
    const biggest = femaleVocalGroup(analytics.biggestDisagreement(state, {
        categoryId: "vocal", gender: "female"
    })).entries;
    assert.deepEqual([biggest[0].participantId, biggest[0].weekId, biggest[0].value], ["ari", "2026-W36", 3]);
});

test("uses population deviation and the approved consistency tiebreaks", () => {
    const state = fixtureState();
    const metrics = analytics.deriveParticipantCategoryMetrics(state, { categoryId: "vocal", gender: "female" }).rows;
    assert.equal(metrics.find((row) => row.participantId === "ari").standardDeviation, 2);
    assert.equal(metrics.find((row) => row.participantId === "bora").standardDeviation, 0);
    assert.equal(metrics.find((row) => row.participantId === "cami").standardDeviation, 0);
    const entries = femaleVocalGroup(analytics.mostConsistent(state, { categoryId: "vocal", gender: "female" })).entries;
    assert.deepEqual(entries.slice(0, 2).map((entry) => [entry.participantId, entry.rank, entry.sampleSize]), [
        ["bora", 1, 5], ["cami", 2, 3]
    ]);
});

test("uses linear regression across chronological gaps for Most Improved", () => {
    const state = fixtureState();
    const metrics = analytics.deriveParticipantCategoryMetrics(state, { categoryId: "vocal", gender: "female" }).rows;
    assert.equal(metrics.find((row) => row.participantId === "ari").improvementSlope, 1);
    assert.equal(metrics.find((row) => row.participantId === "dara").improvementSlope, 1.5);
    assert.deepEqual(metrics.find((row) => row.participantId === "dara").metadata.trendPoints.map((point) => point.x), [0, 2, 4]);
    const improved = femaleVocalGroup(analytics.mostImproved(state, { categoryId: "vocal", gender: "female" })).entries;
    assert.deepEqual(improved.map((entry) => [entry.participantId, entry.value]), [["dara", 1.5], ["ari", 1]]);
});

test("calculates average weekly score and placement with minimum samples", () => {
    const state = fixtureState();
    const scoreEntries = femaleVocalGroup(analytics.bestAverageWeeklyScore(state, {
        categoryId: "vocal", gender: "female"
    })).entries;
    assert.deepEqual([scoreEntries[0].participantId, scoreEntries[0].value, scoreEntries[0].sampleSize], ["bora", 4, 5]);
    const placementEntries = femaleVocalGroup(analytics.bestAveragePlacement(state, {
        categoryId: "vocal", gender: "female"
    })).entries;
    assert.deepEqual([placementEntries[0].participantId, placementEntries[0].value], ["bora", 1.4]);
    assert.equal(placementEntries.some((entry) => entry.participantId === "dara"), true);
});

test("returns insufficientData when a statistical threshold is not met", () => {
    const state = fixtureState();
    const result = analytics.highestAgreement(state, {
        participantId: "dara", categoryId: "vocal", gender: "female"
    });
    assert.equal(result.insufficientData, true);
    assert.equal(result.groups.length, 0);
    assert.equal(result.minimumSample, 3);
    assert.equal(analytics.mostImproved(state, {
        participantId: "dara", categoryId: "vocal", gender: "female", minimumEvaluatedWeeks: 4
    }).insufficientData, true);
});

test("derives Weekly Praise only from reasonTagIds and profile tags only from active assignments", () => {
    const state = fixtureState();
    const praised = analytics.deriveMostPraisedSkills(state, { categoryId: "vocal", gender: "female" });
    assert.equal(praised.entries[0].tagId, "reason-power");
    assert.equal(praised.entries.some((entry) => entry.tagId === "profile-strong"), false);
    const profile = analytics.deriveProfileTagAnalytics(state, { categoryId: "vocal", gender: "female" });
    assert.deepEqual(profile.byType.strength.map((entry) => [entry.tagId, entry.count]), [["profile-strong", 2]]);
    assert.deepEqual(profile.byType.weakness.map((entry) => [entry.tagId, entry.count]), [["profile-weak", 2]]);
    assert.equal(profile.entries.some((entry) => entry.tagId === "reason-power"), false);
    assert.equal(profile.entries.some((entry) => entry.tagId === "profile-special"), false);
});

test("keeps P1 and P2 rating distributions and reasons independent", () => {
    const state = fixtureState();
    const p1 = analytics.deriveUserAnalytics(state, "p1", { categoryId: "vocal", gender: "female" });
    const p2 = analytics.deriveUserAnalytics(state, "p2", { categoryId: "vocal", gender: "female" });
    assert.notEqual(p1.totalVotes, p2.totalVotes);
    assert.notEqual(p1.standoutVotes, p2.standoutVotes);
    assert.equal(p1.ratingDistribution.ratings.reduce((total, rating) => total + rating.count, 0), p1.totalVotes);
    assert.equal(p2.ratingDistribution.ratings.reduce((total, rating) => total + rating.count, 0), p2.totalVotes);
    assert.equal(p1.ratingDistribution.ratings.reduce((total, rating) => total + rating.percentage, 0), 100);
    assert.equal(p1.mostCommonReasons[0].tagId.length > 0, true);
    assert.equal(p1.mostEvaluatedParticipants[0].participantId, "ari");
});

test("derives weekly activity and Most Active Week as activity, not performance", () => {
    const state = fixtureState();
    const activity = analytics.deriveWeeklyActivity(state);
    assert.equal(activity.weeks.length, 5);
    assert.equal(activity.weeks.some((week) => week.weekId === "2026-W37"), false);
    assert.equal(activity.weeks.every((week) => Number.isInteger(week.totalVotes)), true);
    assert.equal(activity.weeks.some((week) => week.reasonTagMentions > 0), true);
    const mostActive = analytics.mostActiveWeek(state);
    const expected = Math.max(...activity.weeks.map((week) => week.totalVotes));
    assert.equal(mostActive.entries.every((entry) => entry.totalVotes === expected), true);
    assert.match(mostActive.definition, /activity, not performance/i);
});

test("prepares category and descriptive group aggregates without Best Group", () => {
    const state = fixtureState();
    const categories = analytics.deriveCategoryAnalytics(state, { categoryId: "vocal", gender: "female" });
    const vocal = categories.rows[0];
    assert.equal(vocal.totalVotes > 0, true);
    assert.equal(vocal.uniqueParticipantsEvaluated, 4);
    assert.equal(vocal.mostWinsParticipants[0].participantId, "bora");
    assert.equal(vocal.mostPraisedSkill.tagId.length > 0, true);
    const groups = analytics.deriveGroupAnalytics(state, { categoryId: "vocal", gender: "female" });
    const groupOne = groups.rows.find((row) => row.groupId === "group-one");
    assert.deepEqual({ participants: groupOne.participantsEvaluated, wins: groupOne.wins, top3: groupOne.topThreeAppearances },
        { participants: 2, wins: 5, top3: 10 });
    assert.match(groups.description, /No Best Group/);
    assert.equal("rank" in groupOne, false);
});

test("supports participant, group and user filters without changing official ranks", () => {
    const state = fixtureState();
    const group = analytics.mostWeeklyWins(state, { categoryId: "vocal", gender: "female", groupId: "group-one" });
    assert.deepEqual(femaleVocalGroup(group).entries.map((entry) => entry.participantId), ["bora", "ari"]);
    const participant = analytics.deriveMostPraisedSkills(state, { participantId: "ari", categoryId: "vocal", userId: "p1" });
    assert.equal(participant.scope.userId, "p1");
    assert.equal(participant.entries[0].tagId, "reason-tone");
});

test("includeOpen exposes live history explicitly without changing the official default", () => {
    const state = fixtureState();
    const official = femaleVocalGroup(analytics.mostWeeklyWins(state, { categoryId: "vocal", gender: "female" })).entries;
    const live = femaleVocalGroup(analytics.mostWeeklyWins(state, {
        categoryId: "vocal", gender: "female", includeOpen: true
    })).entries;
    assert.deepEqual(official.slice(0, 2).map((entry) => [entry.participantId, entry.value]), [["bora", 3], ["ari", 2]]);
    assert.deepEqual(live.slice(0, 2).map((entry) => [entry.participantId, entry.value, entry.rank]), [
        ["ari", 3, 1], ["bora", 3, 1]
    ]);
    assert.equal(live[0].tied, true);
});

test("all analytics remain pure and never touch IndexedDB", () => {
    const state = fixtureState();
    const snapshot = JSON.stringify(state);
    let indexedDbTouched = false;
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, get() { indexedDbTouched = true; return null; } });
    analytics.mostWeeklyWins(state);
    analytics.mostTopThreeAppearances(state);
    analytics.mostStandouts(state);
    analytics.mostControversial(state);
    analytics.highestAgreement(state);
    analytics.mostConsistent(state);
    analytics.mostImproved(state);
    analytics.bestAverageWeeklyScore(state);
    analytics.bestAveragePlacement(state);
    analytics.deriveMostPraisedSkills(state);
    analytics.deriveProfileTagAnalytics(state);
    analytics.deriveUserAnalytics(state, "p1");
    analytics.deriveWeeklyActivity(state);
    analytics.deriveCategoryAnalytics(state);
    analytics.deriveGroupAnalytics(state);
    assert.equal(JSON.stringify(state), snapshot);
    assert.equal(indexedDbTouched, false);
    assert.equal(state.participants[0].imageId, "image-ari");
    delete globalThis.indexedDB;
});

test("rejects unsupported filters and documents deliberately pending metrics", () => {
    const state = fixtureState();
    assert.throws(() => analytics.createScope(state, { categoryId: "overall" }), /unsupported/);
    assert.throws(() => analytics.createScope(state, { userId: "p3" }), /p1 or p2/);
    assert.throws(() => analytics.mostConsistent(state, { minimumEvaluatedWeeks: 0 }), /positive integer/);
    assert.match(analytics.PENDING_METRICS.mostCompetitiveWeek, /Pending/);
    assert.match(analytics.PENDING_METRICS.overallScore, /deliberately not defined/);
    assert.equal(Object.values(analytics.METRIC_DEFINITIONS).every((definition) => definition.length > 20), true);
});
