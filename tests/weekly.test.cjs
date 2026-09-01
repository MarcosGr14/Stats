const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
require(path.join(projectRoot, "js", "constants.js"));
require(path.join(projectRoot, "js", "data.js"));
require(path.join(projectRoot, "js", "weekly.js"));

const { constants, data, weekly } = globalThis.StatsV2;
const timestamp = "2026-08-31T14:00:00.000Z";

function fixtureState() {
    const state = data.createEmptyState(timestamp);
    state.settings.voters = [
        { id: "p1", name: "Marcos" },
        { id: "p2", name: "Jackie" }
    ];
    state.groups.push(data.createGroup({ id: "group-aespa", name: "aespa" }, timestamp));
    state.tags.push(
        data.createTag({ id: "tag-stage", name: "Stage Presence", categoryId: "stage", type: "strength", predefined: true }, timestamp),
        data.createTag({ id: "tag-vocal", name: "Stable Live", categoryId: "vocal", type: "strength", predefined: true }, timestamp),
        data.createTag({ id: "tag-flow", name: "Flow", categoryId: "rap", type: "strength", predefined: true }, timestamp),
        data.createTag({ id: "tag-custom", name: "Encore", categoryId: "general", type: "neutral", predefined: false }, timestamp)
    );
    for (let index = 1; index <= 8; index += 1) {
        state.participants.push(data.createParticipant({
            id: `participant-${index}`,
            name: index === 1 ? "Ningning" : `Performer ${index}`,
            groupId: index <= 2 ? "group-aespa" : null,
            gender: index % 2 ? "female" : "male",
            imageId: index === 1 ? "image-ningning" : null,
            categoryIds: index % 2 ? ["vocal", "stage"] : ["rap", "dance"]
        }, timestamp));
    }
    return state;
}

function openWeek(state, date = "2026-08-31T14:00:00.000Z") {
    return weekly.openCurrentIsoWeek(state, date, timestamp).state;
}

function vote(state, participantId, userId, rating, reasonTagIds = [], note = "") {
    return weekly.upsertVote(state, {
        weekId: state.settings.activeWeekId,
        participantId,
        userId,
        rating,
        reasonTagIds,
        note
    }, timestamp).state;
}

test("derives ISO Monday-Sunday weeks in America/Panama", () => {
    assert.deepEqual(weekly.isoWeekForDate("2026-08-31T04:30:00.000Z"), {
        id: "2026-W35",
        label: "W35",
        startDate: "2026-08-24",
        endDate: "2026-08-30",
        timeZone: "America/Panama"
    });
    assert.deepEqual(weekly.isoWeekForDate("2026-08-31T05:00:00.000Z"), {
        id: "2026-W36",
        label: "W36",
        startDate: "2026-08-31",
        endDate: "2026-09-06",
        timeZone: "America/Panama"
    });
});

test("opens the current ISO week explicitly and never duplicates it", () => {
    const initial = fixtureState();
    const first = weekly.openCurrentIsoWeek(initial, timestamp, timestamp);
    const second = weekly.openCurrentIsoWeek(first.state, timestamp, timestamp);
    assert.equal(first.created, true);
    assert.equal(first.week.id, "2026-W36");
    assert.equal(first.week.status, "OPEN");
    assert.equal(first.week.startDate, "2026-08-31");
    assert.equal(first.week.endDate, "2026-09-06");
    assert.equal(second.created, false);
    assert.equal(second.state.weeks.length, 1);
});

test("allows only one OPEN week and closing freezes it", () => {
    const opened = openWeek(fixtureState(), "2026-08-24T14:00:00.000Z");
    assert.throws(
        () => weekly.openCurrentIsoWeek(opened, timestamp, timestamp),
        (error) => error.code === "OPEN_WEEK_EXISTS"
    );
    const closed = weekly.closeWeek(opened, opened.settings.activeWeekId, "2026-08-30T23:00:00.000Z");
    assert.equal(closed.week.status, "CLOSED");
    assert.equal(closed.week.closedAt, "2026-08-30T23:00:00.000Z");
    assert.equal(closed.state.settings.activeWeekId, null);
    assert.throws(
        () => weekly.upsertVote(closed.state, {
            weekId: closed.week.id,
            participantId: "participant-1",
            userId: "p1",
            rating: "good"
        }),
        (error) => error.code === "WEEK_CLOSED"
    );
    assert.throws(
        () => weekly.openCurrentIsoWeek(closed.state, "2026-08-24T14:00:00.000Z"),
        (error) => error.code === "WEEK_CLOSED"
    );
});

test("creates Standout, Impressed, Good and explicit Normal votes", () => {
    let state = openWeek(fixtureState());
    state = vote(state, "participant-1", "p1", "standout");
    state = vote(state, "participant-2", "p1", "impressed");
    state = vote(state, "participant-3", "p1", "good");
    state = vote(state, "participant-4", "p1", "normal");
    assert.deepEqual(state.weeklyVotes.map((item) => item.rating), ["standout", "impressed", "good", "normal"]);
    assert.equal(weekly.findVote(state, state.settings.activeWeekId, "participant-8", "p1"), null);
});

test("upserts one vote per week, participant and user without changing identity", () => {
    let state = openWeek(fixtureState());
    state = vote(state, "participant-1", "p1", "good", ["tag-stage"], " First note ");
    const original = state.weeklyVotes[0];
    const updated = weekly.upsertVote(state, {
        weekId: state.settings.activeWeekId,
        participantId: "participant-1",
        userId: "p1",
        rating: "standout",
        reasonTagIds: ["tag-flow"],
        note: "Updated"
    }, "2026-09-01T12:00:00.000Z");
    assert.equal(updated.created, false);
    assert.equal(updated.state.weeklyVotes.length, 1);
    assert.equal(updated.vote.id, original.id);
    assert.equal(updated.vote.createdAt, original.createdAt);
    assert.equal(updated.vote.updatedAt, "2026-09-01T12:00:00.000Z");
    assert.deepEqual(updated.vote.reasonTagIds, ["tag-flow"]);
});

test("removing an evaluation returns to Not evaluated instead of Normal", () => {
    let state = openWeek(fixtureState());
    state = vote(state, "participant-1", "p1", "normal");
    assert.equal(weekly.deriveParticipantWeeklyMetrics(state, state.settings.activeWeekId, "participant-1").votesCount, 1);
    const removed = weekly.removeVote(state, state.settings.activeWeekId, "participant-1", "p1");
    assert.equal(removed.removed, true);
    assert.equal(weekly.findVote(removed.state, state.settings.activeWeekId, "participant-1", "p1"), null);
});

test("rejects missing entities, invalid users and archived participants", () => {
    let state = openWeek(fixtureState());
    assert.throws(() => weekly.upsertVote(state, { weekId: state.settings.activeWeekId, participantId: "missing", userId: "p1", rating: "good" }), /does not exist/);
    assert.throws(() => weekly.upsertVote(state, { weekId: "2026-W01", participantId: "participant-1", userId: "p1", rating: "good" }), /week does not exist/);
    assert.throws(() => weekly.upsertVote(state, { weekId: state.settings.activeWeekId, participantId: "participant-1", userId: "admin", rating: "good" }), (error) => error.code === "INVALID_VOTER");
    state.participants[0].archivedAt = timestamp;
    assert.throws(() => weekly.upsertVote(state, { weekId: state.settings.activeWeekId, participantId: "participant-1", userId: "p1", rating: "good" }), (error) => error.code === "PARTICIPANT_ARCHIVED");
});

test("enforces five independent Standouts per user and week", () => {
    let state = openWeek(fixtureState());
    for (let index = 1; index <= constants.MAX_WEEKLY_STANDOUTS; index += 1) {
        state = vote(state, `participant-${index}`, "p1", "standout");
    }
    assert.equal(weekly.weeklyProgress(state, state.settings.activeWeekId, "p1").standoutsUsed, 5);
    assert.throws(
        () => vote(state, "participant-6", "p1", "standout"),
        (error) => error.code === "STANDOUT_LIMIT"
    );
    state = vote(state, "participant-6", "p2", "standout");
    assert.equal(weekly.weeklyProgress(state, state.settings.activeWeekId, "p2").standoutsUsed, 1);
});

test("state validation rejects persisted data that bypasses the Standout limit", () => {
    let state = openWeek(fixtureState());
    for (let index = 1; index <= 6; index += 1) {
        state.weeklyVotes.push(data.createWeeklyVote({
            id: `vote-bypass-${index}`,
            weekId: state.settings.activeWeekId,
            participantId: `participant-${index}`,
            userId: "p1",
            rating: "standout"
        }, timestamp));
    }
    const validation = data.validateState(state);
    assert.equal(validation.valid, false);
    assert.match(validation.errors.join(" "), /five-Standout limit/);
});

test("editing or removing a Standout frees its slot", () => {
    let state = openWeek(fixtureState());
    for (let index = 1; index <= 5; index += 1) state = vote(state, `participant-${index}`, "p1", "standout");
    state = vote(state, "participant-1", "p1", "impressed");
    state = vote(state, "participant-6", "p1", "standout");
    state = weekly.removeVote(state, state.settings.activeWeekId, "participant-2", "p1").state;
    state = vote(state, "participant-7", "p1", "standout");
    assert.equal(weekly.weeklyProgress(state, state.settings.activeWeekId, "p1").standoutsUsed, 5);
});

test("a new week resets Standout availability", () => {
    let state = openWeek(fixtureState(), "2026-08-24T14:00:00.000Z");
    for (let index = 1; index <= 5; index += 1) state = vote(state, `participant-${index}`, "p1", "standout");
    state = weekly.closeWeek(state, state.settings.activeWeekId, "2026-08-30T23:00:00.000Z").state;
    state = weekly.openCurrentIsoWeek(state, timestamp, timestamp).state;
    assert.equal(weekly.weeklyProgress(state, state.settings.activeWeekId, "p1").standoutsUsed, 0);
});

test("reason tags and notes are bounded, safe domain data and independent from profile tags", () => {
    let state = openWeek(fixtureState());
    const beforeAssignments = JSON.stringify(state.participantTagAssignments);
    state = vote(state, "participant-1", "p1", "standout", ["tag-stage", "tag-vocal", "tag-flow"], "  Great encore  ");
    assert.deepEqual(state.weeklyVotes[0].reasonTagIds, ["tag-stage", "tag-vocal", "tag-flow"]);
    assert.equal(state.weeklyVotes[0].note, "Great encore");
    assert.equal(JSON.stringify(state.participantTagAssignments), beforeAssignments);
    assert.throws(() => vote(state, "participant-2", "p1", "good", ["tag-stage", "tag-vocal", "tag-flow", "tag-custom"]), (error) => error.code === "REASON_LIMIT");
    assert.throws(() => vote(state, "participant-2", "p1", "good", ["missing"]), (error) => error.code === "TAG_NOT_FOUND");
    assert.throws(() => vote(state, "participant-2", "p1", "good", [], "x".repeat(501)), (error) => error.code === "NOTE_TOO_LONG");
});

test("derives weekly points, voters, Standouts, provisional state and disagreement", () => {
    let state = openWeek(fixtureState());
    state = vote(state, "participant-1", "p1", "standout");
    let metrics = weekly.deriveParticipantWeeklyMetrics(state, state.settings.activeWeekId, "participant-1");
    assert.deepEqual(metrics, {
        participantId: "participant-1",
        weekId: "2026-W36",
        weeklyPoints: 3,
        votesCount: 1,
        votersCount: 1,
        standoutCount: 1,
        ratingDifference: null,
        provisional: true
    });
    state = vote(state, "participant-1", "p2", "normal");
    metrics = weekly.deriveParticipantWeeklyMetrics(state, state.settings.activeWeekId, "participant-1");
    assert.equal(metrics.weeklyPoints, 3);
    assert.equal(metrics.votersCount, 2);
    assert.equal(metrics.ratingDifference, 3);
    assert.equal(metrics.provisional, false);
});

test("distinguishes two Normal votes from no evaluations", () => {
    let state = openWeek(fixtureState());
    const none = weekly.deriveParticipantWeeklyMetrics(state, state.settings.activeWeekId, "participant-1");
    state = vote(state, "participant-1", "p1", "normal");
    state = vote(state, "participant-1", "p2", "normal");
    const normal = weekly.deriveParticipantWeeklyMetrics(state, state.settings.activeWeekId, "participant-1");
    assert.deepEqual([none.weeklyPoints, none.votesCount], [0, 0]);
    assert.deepEqual([normal.weeklyPoints, normal.votesCount], [0, 2]);
});

test("orders weekly results by points, voters and Standouts with competition ties", () => {
    let state = openWeek(fixtureState());
    state = vote(state, "participant-1", "p1", "standout");
    state = vote(state, "participant-2", "p1", "impressed");
    state = vote(state, "participant-2", "p2", "good");
    state = vote(state, "participant-3", "p1", "impressed");
    state = vote(state, "participant-3", "p2", "normal");
    state = vote(state, "participant-4", "p1", "good");
    state = vote(state, "participant-4", "p2", "good");
    state = vote(state, "participant-5", "p1", "good");
    state = vote(state, "participant-5", "p2", "good");
    state = vote(state, "participant-6", "p1", "impressed");
    state = vote(state, "participant-6", "p2", "good");
    const ranking = weekly.deriveWeeklyRanking(state, state.settings.activeWeekId);
    assert.deepEqual(ranking.map((item) => item.participant.id), [
        "participant-2", "participant-6", "participant-1", "participant-3", "participant-4", "participant-5"
    ]);
    assert.deepEqual(ranking.map((item) => item.rank), [1, 1, 3, 4, 4, 4]);
    assert.equal(ranking[0].tied, true);
    assert.equal(ranking[1].tied, true);
    assert.equal(ranking[3].tied, true);
    assert.equal(ranking[5].tied, true);
});

test("provides real weekly points without wiring Rankings in Phase 4", () => {
    let state = openWeek(fixtureState());
    state = vote(state, "participant-1", "p1", "standout");
    const provider = weekly.createWeeklyPointsProvider(state, state.settings.activeWeekId);
    assert.equal(provider(state.participants[0]), 3);
    assert.equal(provider(state.participants[1]), null);
});

test("filters active voting participants by search, category, gender, group and evaluation", () => {
    let state = openWeek(fixtureState());
    state = vote(state, "participant-1", "p1", "standout");
    const result = weekly.filterWeeklyParticipants(state, state.settings.activeWeekId, "p1", {
        query: "AESPA",
        categoryId: "vocal",
        gender: "female",
        groupId: "group-aespa",
        evaluation: "standout"
    });
    assert.deepEqual(result.map((participant) => participant.id), ["participant-1"]);
});
