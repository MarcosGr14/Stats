const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
require(path.join(projectRoot, "js", "constants.js"));
require(path.join(projectRoot, "js", "data.js"));
require(path.join(projectRoot, "js", "weekly.js"));
require(path.join(projectRoot, "js", "spotlight.js"));
require(path.join(projectRoot, "js", "profile-history.js"));

const { data, profileHistory } = globalThis.StatsV2;
const stamp = "2026-09-06T20:00:00.000Z";

function fixtureState() {
    const state = data.createEmptyState(stamp);
    state.groups.push(data.createGroup({ id: "group-aespa", name: "aespa" }, stamp));
    state.tags.push(
        data.createTag({ id: "tag-stable", name: "Stable Live", categoryId: "vocal", type: "strength", predefined: true }, stamp),
        data.createTag({ id: "tag-high", name: "High Notes", categoryId: "vocal", type: "strength", predefined: true }, stamp),
        data.createTag({ id: "tag-presence", name: "Stage Presence", categoryId: "stage", type: "strength", predefined: true }, stamp),
        data.createTag({ id: "tag-profile", name: "Ace", categoryId: "general", type: "neutral", predefined: true }, stamp)
    );
    state.participants.push(
        data.createParticipant({ id: "target", name: "Ningning", groupId: "group-aespa", gender: "female", imageId: "image-target", categoryIds: ["vocal", "stage"], archivedAt: "2026-09-07T00:00:00.000Z" }, stamp),
        data.createParticipant({ id: "rival-a", name: "A Rival", groupId: null, gender: "female", categoryIds: ["vocal", "stage"] }, stamp),
        data.createParticipant({ id: "rival-b", name: "B Rival", groupId: null, gender: "female", categoryIds: ["vocal", "stage"] }, stamp),
        data.createParticipant({ id: "male", name: "Male Rival", groupId: null, gender: "male", categoryIds: ["vocal", "stage"] }, stamp)
    );
    state.participantTagAssignments.push(data.createTagAssignment({
        id: "assignment-profile", participantId: "target", tagId: "tag-profile"
    }, stamp));
    state.weeks.push(
        data.createWeek({ id: "2026-W34", label: "W34", startDate: "2026-08-17", endDate: "2026-08-23", status: "CLOSED", closedAt: stamp }, stamp),
        data.createWeek({ id: "2026-W35", label: "W35", startDate: "2026-08-24", endDate: "2026-08-30", status: "CLOSED", closedAt: stamp }, stamp),
        data.createWeek({ id: "2026-W36", label: "W36", startDate: "2026-08-31", endDate: "2026-09-06", status: "CLOSED", closedAt: stamp }, stamp)
    );
    return state;
}

function vote(state, weekId, participantId, categoryId, userId, rating, reasonTagIds = []) {
    state.weeklyVotes.push(data.createWeeklyVote({
        id: `vote-${state.weeklyVotes.length + 1}`, weekId, participantId, categoryId, userId, rating, reasonTagIds
    }, stamp));
}

function score(state, weekId, participantId, categoryId, ratings, reasons = []) {
    ratings.forEach((rating, index) => vote(state, weekId, participantId, categoryId, `p${index + 1}`, rating, reasons[index] || []));
}

function smokeFixture() {
    const state = fixtureState();
    score(state, "2026-W34", "target", "vocal", ["impressed", "impressed"], [["tag-stable"], ["tag-high"]]);
    score(state, "2026-W34", "rival-a", "vocal", ["standout", "standout"]);
    score(state, "2026-W35", "target", "vocal", ["standout", "standout"], [["tag-stable"], ["tag-stable"]]);
    score(state, "2026-W35", "rival-a", "vocal", ["standout", "impressed"]);
    score(state, "2026-W36", "target", "vocal", ["standout", "standout"], [["tag-stable"], ["tag-high"]]);
    score(state, "2026-W36", "rival-a", "vocal", ["standout", "standout"]);
    score(state, "2026-W35", "target", "stage", ["standout"], [["tag-presence"]]);
    score(state, "2026-W35", "rival-a", "stage", ["standout", "standout"]);
    score(state, "2026-W35", "rival-b", "stage", ["standout", "impressed"]);
    score(state, "2026-W36", "target", "stage", ["standout", "impressed"], [["tag-presence"], ["tag-presence"]]);
    score(state, "2026-W36", "rival-a", "stage", ["impressed", "impressed"]);
    score(state, "2026-W36", "male", "vocal", ["standout", "standout"]);
    return state;
}

test("derives participant history by category in newest or oldest order", () => {
    const state = smokeFixture();
    const all = profileHistory.getParticipantHistory(state, "target");
    assert.deepEqual(all.map((record) => `${record.week.id}:${record.categoryId}`), [
        "2026-W36:vocal", "2026-W36:stage", "2026-W35:vocal", "2026-W35:stage", "2026-W34:vocal"
    ]);
    const vocalOldest = profileHistory.getParticipantHistory(state, "target", { categoryId: "vocal", order: "oldest" });
    assert.deepEqual(vocalOldest.map((record) => record.week.id), ["2026-W34", "2026-W35", "2026-W36"]);
});

test("matches the Phase 6 smoke metrics without mixing Vocal and Stage", () => {
    const state = smokeFixture();
    const vocal = profileHistory.getParticipantCategoryStats(state, "target", "vocal");
    const stage = profileHistory.getParticipantCategoryStats(state, "target", "stage");
    assert.deepEqual({ wins: vocal.wins, top3: vocal.topThreeAppearances, best: vocal.bestScore, weeks: vocal.weeksEvaluated },
        { wins: 2, top3: 3, best: 6, weeks: 3 });
    assert.deepEqual({ wins: stage.wins, top3: stage.topThreeAppearances, best: stage.bestScore, weeks: stage.weeksEvaluated },
        { wins: 1, top3: 2, best: 5, weeks: 2 });
});

test("counts unique evaluated weeks overall while category appearances stay separate", () => {
    const profile = profileHistory.getParticipantProfile(smokeFixture(), "target");
    assert.equal(profile.summary.weeksEvaluated, 3);
    assert.equal(profile.summary.wins, 3);
    assert.equal(profile.summary.topThreeAppearances, 5);
    assert.equal(profile.summary.categories, 2);
});

test("keeps Not evaluated as a trend gap and includes Normal as a real zero", () => {
    const state = fixtureState();
    score(state, "2026-W34", "target", "vocal", ["normal"]);
    score(state, "2026-W36", "target", "vocal", ["good"]);
    const vocal = profileHistory.getParticipantCategoryStats(state, "target", "vocal");
    assert.deepEqual(vocal.trend.map((point) => [point.weekId, point.evaluated, point.weeklyPoints]), [
        ["2026-W34", true, 0], ["2026-W35", false, null], ["2026-W36", true, 1]
    ]);
    assert.equal(vocal.weeksEvaluated, 2);
    assert.equal(vocal.bestScore, 1);
});

test("counts unique and joint winners and keeps Male rankings independent", () => {
    const state = smokeFixture();
    const history = profileHistory.getParticipantHistory(state, "target", { categoryId: "vocal" });
    assert.equal(history.find((record) => record.week.id === "2026-W35").jointWinner, false);
    assert.equal(history.find((record) => record.week.id === "2026-W36").jointWinner, true);
    assert.equal(history.find((record) => record.week.id === "2026-W36").rank, 1);
    assert.equal(profileHistory.getParticipantProfile(state, "target").winHistory.length, 3);
});

test("uses points, voters and Standouts for Best Week and preserves a real tie", () => {
    const state = fixtureState();
    score(state, "2026-W34", "target", "vocal", ["standout"]);
    score(state, "2026-W35", "target", "vocal", ["impressed", "good"]);
    score(state, "2026-W36", "target", "vocal", ["impressed", "good"]);
    const vocal = profileHistory.getParticipantCategoryStats(state, "target", "vocal");
    assert.deepEqual(vocal.bestWeeks.map((record) => record.week.id), ["2026-W35", "2026-W36"]);
    assert.equal(vocal.bestScore, 3);
});

test("derives weekly praise only from historical reasonTagIds, never profile tags", () => {
    const profile = profileHistory.getParticipantProfile(smokeFixture(), "target");
    assert.equal(profile.summary.mostPraised.tag.id, "tag-stable");
    assert.equal(profile.categoryStats.find((stats) => stats.categoryId === "stage").mostPraised.tag.id, "tag-presence");
    assert.deepEqual(profile.profileTags.neutral.map((tag) => tag.id), ["tag-profile"]);
    assert.equal(profile.topReasons.some((reason) => reason.tag.id === "tag-profile"), false);
});

test("preserves archived identity, tags, image and history without touching state or IndexedDB", () => {
    const state = smokeFixture();
    const snapshot = JSON.stringify(state);
    let indexedDbTouched = false;
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, get() { indexedDbTouched = true; return null; } });
    const profile = profileHistory.getParticipantProfile(state, "target");
    assert.equal(profile.participant.archivedAt !== null, true);
    assert.equal(profile.participant.imageId, "image-target");
    assert.equal(profile.history.length, 5);
    assert.equal(JSON.stringify(state), snapshot);
    assert.equal(indexedDbTouched, false);
    delete globalThis.indexedDB;
});
