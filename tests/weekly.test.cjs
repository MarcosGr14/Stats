const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
require(path.join(projectRoot, "js", "constants.js"));
require(path.join(projectRoot, "js", "data.js"));
require(path.join(projectRoot, "js", "storage.js"));
require(path.join(projectRoot, "js", "weekly.js"));

const { constants, data, storage, weekly } = globalThis.StatsV2;
const timestamp = "2026-08-31T14:00:00.000Z";

function fixtureState() {
    const state = data.createEmptyState(timestamp);
    state.settings.voters = [{ id: "p1", name: "Marcos" }, { id: "p2", name: "Jackie" }];
    state.groups.push(data.createGroup({ id: "group-xg", name: "XG" }, timestamp));
    state.tags.push(
        data.createTag({ id: "tag-rap", name: "Flow", categoryId: "rap", type: "strength", predefined: true }, timestamp),
        data.createTag({ id: "tag-dance", name: "Precision", categoryId: "dance", type: "strength", predefined: true }, timestamp),
        data.createTag({ id: "tag-stage", name: "Presence", categoryId: "stage", type: "strength", predefined: true }, timestamp),
        data.createTag({ id: "tag-general", name: "Encore", categoryId: "general", type: "neutral", predefined: false }, timestamp)
    );
    const categorySets = [
        ["rap", "dance", "stage"], ["vocal", "stage"], ["dance"],
        ["stage"], ["visual"], ["all-rounder"], ["rap"], ["vocal"]
    ];
    categorySets.forEach((categoryIds, index) => state.participants.push(data.createParticipant({
        id: `participant-${index + 1}`,
        name: index === 0 ? "Jurin" : `Performer ${index + 1}`,
        groupId: index === 0 ? "group-xg" : null,
        gender: index % 2 ? "male" : "female",
        categoryIds
    }, timestamp)));
    return state;
}

function openWeek(state, date = timestamp) {
    return weekly.openCurrentIsoWeek(state, date, date).state;
}

function vote(state, participantId, categoryId, userId, rating, reasonTagIds = [], note = "") {
    return weekly.upsertVote(state, {
        weekId: state.settings.activeWeekId, participantId, categoryId, userId, rating, reasonTagIds, note
    }, timestamp).state;
}

class MemoryStorage {
    constructor() { this.values = new Map(); }
    getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
    setItem(key, value) { this.values.set(key, String(value)); }
}

test("derives ISO Monday-Sunday weeks in America/Panama", () => {
    assert.deepEqual(weekly.isoWeekForDate("2026-08-31T04:30:00.000Z"), {
        id: "2026-W35", label: "W35", startDate: "2026-08-24", endDate: "2026-08-30",
        timeZone: "America/Panama"
    });
    assert.equal(weekly.isoWeekForDate(timestamp).id, "2026-W36");
});

test("opens explicitly, allows one OPEN week and closes read-only", () => {
    const initial = fixtureState();
    const opened = weekly.openCurrentIsoWeek(initial, timestamp, timestamp);
    assert.equal(opened.created, true);
    assert.equal(opened.week.status, "OPEN");
    assert.equal(opened.state.weeks.length, 1);
    assert.equal(weekly.openCurrentIsoWeek(opened.state, timestamp, timestamp).created, false);
    assert.throws(() => weekly.openCurrentIsoWeek(opened.state, "2026-09-07T14:00:00.000Z"), (error) => error.code === "OPEN_WEEK_EXISTS");
    const closed = weekly.closeWeek(opened.state, opened.week.id, "2026-09-06T23:00:00.000Z");
    assert.equal(closed.week.status, "CLOSED");
    assert.equal(closed.state.settings.activeWeekId, null);
    assert.throws(() => vote(closed.state, "participant-1", "rap", "p1", "good"), /week does not exist|read-only/);
});

test("reopens only CLOSED weeks with an explicit audit trail and can close again", () => {
    let state = openWeek(fixtureState());
    state = vote(state, "participant-1", "rap", "p1", "standout", ["tag-rap"], "Historic");
    const voteSnapshot = JSON.stringify(state.weeklyVotes);
    state = weekly.closeWeek(state, state.settings.activeWeekId, "2026-09-01T10:00:00.000Z").state;
    const reopened = weekly.reopenWeek(state, "2026-W36", "2026-09-02T10:00:00.000Z");
    assert.equal(reopened.week.status, "OPEN");
    assert.equal(reopened.week.closedAt, "2026-09-01T10:00:00.000Z");
    assert.equal(reopened.week.reopenedAt, "2026-09-02T10:00:00.000Z");
    assert.equal(reopened.week.reopenCount, 1);
    assert.equal(JSON.stringify(reopened.state.weeklyVotes), voteSnapshot);
    const reclosed = weekly.closeWeek(reopened.state, "2026-W36", "2026-09-03T10:00:00.000Z");
    assert.equal(reclosed.week.status, "CLOSED");
    assert.equal(reclosed.week.closedAt, "2026-09-03T10:00:00.000Z");
    assert.equal(reclosed.week.reopenCount, 1);
});

test("reload preserves reopened state, audit fields and vote IDs", () => {
    let state = openWeek(fixtureState());
    state = vote(state, "participant-1", "rap", "p1", "good");
    const voteId = state.weeklyVotes[0].id;
    state = weekly.closeWeek(state, "2026-W36", "2026-09-01T10:00:00.000Z").state;
    state = weekly.reopenWeek(state, "2026-W36", "2026-09-02T10:00:00.000Z").state;
    const memory = new MemoryStorage();
    storage.save(state, memory, "2026-09-02T10:00:00.000Z");
    const loaded = storage.load(memory);
    assert.equal(loaded.status, "ready");
    assert.equal(loaded.state.weeks[0].status, "OPEN");
    assert.equal(loaded.state.weeks[0].reopenCount, 1);
    assert.equal(loaded.state.weeklyVotes[0].id, voteId);
});

test("rejects reopening OPEN and reopening while another week is OPEN", () => {
    let state = openWeek(fixtureState(), "2026-08-24T14:00:00.000Z");
    assert.throws(() => weekly.reopenWeek(state, "2026-W35"), (error) => error.code === "WEEK_OPEN");
    state = weekly.closeWeek(state, "2026-W35", timestamp).state;
    state = openWeek(state, timestamp);
    assert.throws(() => weekly.reopenWeek(state, "2026-W35"), (error) => (
        error.code === "OPEN_WEEK_EXISTS" && /Close the currently open week/.test(error.message)
    ));
});

test("stores independent category votes for the same participant and user", () => {
    let state = openWeek(fixtureState());
    state = vote(state, "participant-1", "rap", "p1", "standout", ["tag-rap"], "Strong verse");
    state = vote(state, "participant-1", "dance", "p1", "good", ["tag-dance"], "Clean break");
    state = vote(state, "participant-1", "stage", "p1", "normal");
    assert.equal(state.weeklyVotes.length, 3);
    assert.deepEqual(state.weeklyVotes.map((item) => item.categoryId), ["rap", "dance", "stage"]);
    assert.equal(weekly.findVote(state, "2026-W36", "participant-1", "rap", "p1").note, "Strong verse");
    assert.equal(weekly.findVote(state, "2026-W36", "participant-1", "dance", "p1").note, "Clean break");
});

test("upserts only the matching category and preserves identity", () => {
    let state = openWeek(fixtureState());
    state = vote(state, "participant-1", "rap", "p1", "good");
    state = vote(state, "participant-1", "dance", "p1", "impressed");
    const original = state.weeklyVotes[0];
    const updated = weekly.upsertVote(state, {
        weekId: "2026-W36", participantId: "participant-1", categoryId: "rap", userId: "p1",
        rating: "standout", reasonTagIds: ["tag-rap"], note: "Updated"
    }, "2026-09-01T12:00:00.000Z");
    assert.equal(updated.created, false);
    assert.equal(updated.vote.id, original.id);
    assert.equal(updated.vote.createdAt, original.createdAt);
    assert.equal(updated.state.weeklyVotes.length, 2);
    assert.equal(weekly.findVote(updated.state, "2026-W36", "participant-1", "dance", "p1").rating, "impressed");
});

test("rejects unsupported and unassigned categories", () => {
    const state = openWeek(fixtureState());
    assert.throws(() => vote(state, "participant-1", "unknown", "p1", "good"), (error) => error.code === "INVALID_CATEGORY");
    assert.throws(() => vote(state, "participant-2", "rap", "p1", "good"), (error) => error.code === "CATEGORY_NOT_ASSIGNED");
});

test("Not evaluated and Normal are independent per category", () => {
    let state = openWeek(fixtureState());
    state = vote(state, "participant-1", "rap", "p1", "normal");
    assert.equal(weekly.findVote(state, "2026-W36", "participant-1", "dance", "p1"), null);
    assert.equal(weekly.deriveCategoryWeeklyMetrics(state, "2026-W36", "participant-1", "rap").votesCount, 1);
    assert.equal(weekly.deriveCategoryWeeklyMetrics(state, "2026-W36", "participant-1", "dance").votesCount, 0);
    state = weekly.removeVote(state, "2026-W36", "participant-1", "rap", "p1").state;
    assert.equal(weekly.findVote(state, "2026-W36", "participant-1", "rap", "p1"), null);
});

test("reason tags and notes stay independent by category and never change profile assignments", () => {
    let state = openWeek(fixtureState());
    const beforeAssignments = JSON.stringify(state.participantTagAssignments);
    state = vote(state, "participant-1", "rap", "p1", "standout", ["tag-rap", "tag-general"], "Rap note");
    state = vote(state, "participant-1", "dance", "p1", "good", ["tag-dance"], "Dance note");
    assert.deepEqual(weekly.findVote(state, "2026-W36", "participant-1", "rap", "p1").reasonTagIds, ["tag-rap", "tag-general"]);
    assert.deepEqual(weekly.findVote(state, "2026-W36", "participant-1", "dance", "p1").reasonTagIds, ["tag-dance"]);
    assert.equal(JSON.stringify(state.participantTagAssignments), beforeAssignments);
    assert.throws(() => vote(state, "participant-1", "stage", "p1", "good", ["tag-rap", "tag-dance", "tag-stage", "tag-general"]), (error) => error.code === "REASON_LIMIT");
    assert.throws(() => vote(state, "participant-1", "stage", "p1", "good", [], "x".repeat(501)), (error) => error.code === "NOTE_TOO_LONG");
});

test("enforces five Standouts globally across mixed categories", () => {
    let state = openWeek(fixtureState());
    const selections = [
        ["participant-1", "rap"], ["participant-1", "dance"], ["participant-2", "vocal"],
        ["participant-3", "dance"], ["participant-4", "stage"]
    ];
    selections.forEach(([participantId, categoryId]) => { state = vote(state, participantId, categoryId, "p1", "standout"); });
    assert.equal(weekly.weeklyProgress(state, "2026-W36", "p1").standoutsUsed, 5);
    assert.throws(() => vote(state, "participant-5", "visual", "p1", "standout"), (error) => error.code === "STANDOUT_LIMIT");
    state = vote(state, "participant-5", "visual", "p2", "standout");
    assert.equal(weekly.weeklyProgress(state, "2026-W36", "p2").standoutsUsed, 1);
});

test("editing or removing a Standout frees a global slot", () => {
    let state = openWeek(fixtureState());
    const selections = [["participant-1", "rap"], ["participant-1", "dance"], ["participant-2", "vocal"], ["participant-3", "dance"], ["participant-4", "stage"]];
    selections.forEach(([participantId, categoryId]) => { state = vote(state, participantId, categoryId, "p1", "standout"); });
    state = vote(state, "participant-1", "rap", "p1", "good");
    state = vote(state, "participant-5", "visual", "p1", "standout");
    state = weekly.removeVote(state, "2026-W36", "participant-1", "dance", "p1").state;
    state = vote(state, "participant-6", "all-rounder", "p1", "standout");
    assert.equal(weekly.weeklyProgress(state, "2026-W36", "p1").standoutsUsed, 5);
});

test("a new week resets the global Standout limit", () => {
    let state = openWeek(fixtureState(), "2026-08-24T14:00:00.000Z");
    [["participant-1", "rap"], ["participant-1", "dance"], ["participant-2", "vocal"], ["participant-3", "dance"], ["participant-4", "stage"]]
        .forEach(([participantId, categoryId]) => { state = vote(state, participantId, categoryId, "p1", "standout"); });
    state = weekly.closeWeek(state, "2026-W35", timestamp).state;
    state = openWeek(state, timestamp);
    assert.equal(weekly.weeklyProgress(state, "2026-W36", "p1").standoutsUsed, 0);
});

test("derives points and voter metrics only for one category", () => {
    let state = openWeek(fixtureState());
    state = vote(state, "participant-1", "rap", "p1", "standout");
    state = vote(state, "participant-1", "rap", "p2", "impressed");
    state = vote(state, "participant-1", "dance", "p1", "good");
    assert.deepEqual(weekly.deriveCategoryWeeklyMetrics(state, "2026-W36", "participant-1", "rap"), {
        participantId: "participant-1", categoryId: "rap", weekId: "2026-W36",
        weeklyPoints: 5, votesCount: 2, votersCount: 2, standoutCount: 1,
        ratingDifference: 1, provisional: false
    });
    assert.equal(weekly.deriveCategoryWeeklyMetrics(state, "2026-W36", "participant-1", "dance").weeklyPoints, 1);
});

test("ranks one category by points, voters and Standouts with competition ties", () => {
    let state = openWeek(fixtureState());
    state = vote(state, "participant-1", "rap", "p1", "standout");
    state = vote(state, "participant-7", "rap", "p1", "standout");
    const ranking = weekly.deriveWeeklyRanking(state, "2026-W36", "rap");
    assert.deepEqual(ranking.map((item) => item.rank), [1, 1]);
    assert.equal(ranking.every((item) => item.tied), true);
});

test("weekly points provider requires category and leaves Rankings unwired", () => {
    let state = openWeek(fixtureState());
    state = vote(state, "participant-1", "rap", "p1", "standout");
    state = vote(state, "participant-1", "dance", "p1", "good");
    const provider = weekly.createWeeklyPointsProvider(state, "2026-W36");
    assert.equal(provider(state.participants[0], "rap"), 3);
    assert.equal(provider(state.participants[0], "dance"), 1);
    assert.equal(provider(state.participants[0]), null);
});

test("manual legacy categorization preserves vote identity and content", () => {
    let state = openWeek(fixtureState());
    state.weeklyVotes.push({
        id: "vote-legacy", weekId: "2026-W36", participantId: "participant-1", userId: "p1",
        rating: "standout", reasonTagIds: ["tag-rap"], note: "Preserve me",
        legacyUncategorized: true, createdAt: timestamp, updatedAt: timestamp
    });
    const converted = weekly.assignLegacyVoteCategory(state, "vote-legacy", "rap", "2026-09-01T12:00:00.000Z");
    assert.equal(converted.vote.id, "vote-legacy");
    assert.equal(converted.vote.categoryId, "rap");
    assert.equal(converted.vote.legacyUncategorized, undefined);
    assert.deepEqual(converted.vote.reasonTagIds, ["tag-rap"]);
    assert.equal(converted.vote.note, "Preserve me");
});

test("state validation rejects duplicate category votes and bypassing the global limit", () => {
    let state = openWeek(fixtureState());
    const base = data.createWeeklyVote({
        id: "vote-a", weekId: "2026-W36", participantId: "participant-1", categoryId: "rap", userId: "p1", rating: "good"
    }, timestamp);
    state.weeklyVotes.push(base, { ...base, id: "vote-b" });
    assert.match(data.validateState(state).errors.join(" "), /duplicates a weekly vote relationship/);

    state = openWeek(fixtureState());
    [["participant-1", "rap"], ["participant-1", "dance"], ["participant-2", "vocal"], ["participant-3", "dance"], ["participant-4", "stage"], ["participant-5", "visual"]]
        .forEach(([participantId, categoryId], index) => state.weeklyVotes.push(data.createWeeklyVote({
            id: `vote-${index}`, weekId: "2026-W36", participantId, categoryId, userId: "p1", rating: "standout"
        }, timestamp)));
    assert.match(data.validateState(state).errors.join(" "), /five-Standout limit/);
});

test("filters evaluation in the selected category", () => {
    let state = openWeek(fixtureState());
    state = vote(state, "participant-1", "rap", "p1", "standout");
    const rap = weekly.filterWeeklyParticipants(state, "2026-W36", "p1", {
        query: "XG", categoryId: "rap", gender: "female", groupId: "group-xg", evaluation: "standout"
    });
    const danceNotEvaluated = weekly.filterWeeklyParticipants(state, "2026-W36", "p1", {
        categoryId: "dance", evaluation: "not-evaluated"
    });
    assert.deepEqual(rap.map((participant) => participant.id), ["participant-1"]);
    assert.equal(danceNotEvaluated.some((participant) => participant.id === "participant-1"), true);
});
