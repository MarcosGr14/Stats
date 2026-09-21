const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
require(path.join(projectRoot, "js", "constants.js"));
require(path.join(projectRoot, "js", "data.js"));
require(path.join(projectRoot, "js", "weekly.js"));
require(path.join(projectRoot, "js", "spotlight.js"));

const { data, weekly, spotlight } = globalThis.StatsV2;
const timestamp = "2026-09-01T14:00:00.000Z";

function fixtureState() {
    const state = data.createEmptyState(timestamp);
    state.groups.push(data.createGroup({ id: "group-a", name: "A Group" }, timestamp));
    state.tags.push(
        data.createTag({ id: "tag-tone", name: "Tone", categoryId: "vocal", type: "strength", predefined: true }, timestamp),
        data.createTag({ id: "tag-control", name: "Control", categoryId: "vocal", type: "strength", predefined: true }, timestamp),
        data.createTag({ id: "tag-flow", name: "Flow", categoryId: "rap", type: "strength", predefined: true }, timestamp)
    );
    [
        ["a", "Ari", "female", ["vocal", "rap"]],
        ["b", "Bora", "female", ["vocal"]],
        ["c", "Cami", "female", ["vocal"]],
        ["d", "Dara", "female", ["vocal"]],
        ["e", "Eun", "female", ["vocal"]],
        ["m", "Min", "male", ["vocal", "rap"]]
    ].forEach(([id, name, gender, categoryIds]) => state.participants.push(data.createParticipant({
        id: `participant-${id}`, name, gender, categoryIds, groupId: id === "a" ? "group-a" : null
    }, timestamp)));
    return weekly.openCurrentIsoWeek(state, timestamp, timestamp).state;
}

function addVote(state, participantId, categoryId, userId, rating, reasonTagIds = []) {
    state.weeklyVotes.push(data.createWeeklyVote({
        id: `vote-${state.weeklyVotes.length + 1}`,
        weekId: "2026-W36", participantId, categoryId, userId, rating, reasonTagIds
    }, timestamp));
}

function addCoreScenario(state) {
    addVote(state, "participant-a", "vocal", "p1", "standout", ["tag-tone"]);
    addVote(state, "participant-a", "vocal", "p2", "standout", ["tag-tone", "tag-control"]);
    addVote(state, "participant-b", "vocal", "p1", "standout", ["tag-control"]);
    addVote(state, "participant-b", "vocal", "p2", "impressed", ["tag-control"]);
    addVote(state, "participant-c", "vocal", "p1", "impressed", ["tag-tone"]);
    addVote(state, "participant-c", "vocal", "p2", "impressed", ["tag-tone"]);
    addVote(state, "participant-d", "vocal", "p1", "normal");
}

test("builds the exact Female Vocal Top 3 and includes Normal but excludes Not evaluated", () => {
    const state = fixtureState();
    addCoreScenario(state);
    const result = spotlight.deriveSpotlightRanking(state, {
        weekId: "2026-W36", categoryId: "vocal", gender: "female"
    });
    assert.deepEqual(result.items.map((item) => item.participant.name), ["Ari", "Bora", "Cami", "Dara"]);
    assert.deepEqual(result.items.map((item) => item.metrics.weeklyPoints), [6, 5, 4, 0]);
    assert.deepEqual(result.topThree.map((item) => item.participant.name), ["Ari", "Bora", "Cami"]);
    assert.equal(result.notEvaluatedCount, 1);
    assert.equal(result.mode, "LIVE");
});

test("separates every result by category and gender", () => {
    const state = fixtureState();
    addVote(state, "participant-a", "rap", "p1", "standout", ["tag-flow"]);
    addVote(state, "participant-m", "vocal", "p1", "impressed");
    assert.deepEqual(spotlight.deriveSpotlightRanking(state, {
        weekId: "2026-W36", categoryId: "rap", gender: "female"
    }).items.map((item) => item.participant.name), ["Ari"]);
    assert.deepEqual(spotlight.deriveSpotlightRanking(state, {
        weekId: "2026-W36", categoryId: "vocal", gender: "male"
    }).items.map((item) => item.participant.name), ["Min"]);
    assert.equal(spotlight.deriveSpotlightRanking(state, {
        weekId: "2026-W36", categoryId: "rap", gender: "male"
    }).items.length, 0);
});

test("orders by points, voters and Standouts and assigns competition ties", () => {
    const state = fixtureState();
    addVote(state, "participant-a", "vocal", "p1", "standout");
    addVote(state, "participant-b", "vocal", "p1", "standout");
    addVote(state, "participant-c", "vocal", "p1", "impressed");
    addVote(state, "participant-c", "vocal", "p2", "good");
    const result = spotlight.deriveSpotlightRanking(state, {
        weekId: "2026-W36", categoryId: "vocal", gender: "female"
    });
    assert.deepEqual(result.items.map((item) => item.participant.name), ["Cami", "Ari", "Bora"]);
    assert.deepEqual(result.items.map((item) => item.rank), [1, 2, 2]);
    assert.deepEqual(result.winners.map((item) => item.participant.name), ["Cami"]);

    addVote(state, "participant-d", "vocal", "p1", "standout");
    const tied = spotlight.deriveSpotlightRanking(state, {
        weekId: "2026-W36", categoryId: "vocal", gender: "female"
    });
    assert.deepEqual(tied.items.map((item) => item.rank), [1, 2, 2, 2]);
    assert.equal(tied.items.filter((item) => item.rank === 2).every((item) => item.tied), true);
});

test("reports joint winners with competition ranking 1, 1, 3", () => {
    const state = fixtureState();
    addVote(state, "participant-a", "vocal", "p1", "standout");
    addVote(state, "participant-b", "vocal", "p1", "standout");
    addVote(state, "participant-c", "vocal", "p1", "impressed");
    const result = spotlight.deriveSpotlightRanking(state, {
        weekId: "2026-W36", categoryId: "vocal", gender: "female"
    });
    assert.deepEqual(result.items.map((item) => item.rank), [1, 1, 3]);
    assert.deepEqual(result.winners.map((item) => item.participant.name), ["Ari", "Bora"]);
    assert.equal(result.winners.every((item) => item.tied), true);
});

test("derives result badges without affecting score or rank", () => {
    const state = fixtureState();
    addVote(state, "participant-a", "vocal", "p1", "standout");
    addVote(state, "participant-a", "vocal", "p2", "standout");
    addVote(state, "participant-b", "vocal", "p1", "good");
    addVote(state, "participant-b", "vocal", "p2", "impressed");
    addVote(state, "participant-c", "vocal", "p1", "standout");
    addVote(state, "participant-c", "vocal", "p2", "normal");
    addVote(state, "participant-d", "vocal", "p1", "good");
    const badges = Object.fromEntries(spotlight.deriveSpotlightRanking(state, {
        weekId: "2026-W36", categoryId: "vocal", gender: "female"
    }).items.map((item) => [item.participant.name, item.badge?.id || null]));
    assert.deepEqual(badges, {
        Ari: "duo-standout", Bora: "duo-approved", Cami: "split-decision", Dara: "solo-pick"
    });
});

test("uses weekly reasonTagIds only for top reasons and Most Praised Skill", () => {
    const state = fixtureState();
    state.participantTagAssignments.push(data.createTagAssignment({
        id: "profile-only", participantId: "participant-a", tagId: "tag-flow"
    }, timestamp));
    addCoreScenario(state);
    const beforeAssignments = JSON.stringify(state.participantTagAssignments);
    const result = spotlight.deriveSpotlightRanking(state, {
        weekId: "2026-W36", categoryId: "vocal", gender: "female"
    });
    assert.equal(result.mostPraisedSkill.tag.id, "tag-tone");
    assert.deepEqual(result.items[0].topReasonTags.map((item) => item.tag.id), ["tag-tone", "tag-control"]);
    assert.equal(result.items[0].topReasonTags.some((item) => item.tag.id === "tag-flow"), false);
    assert.equal(JSON.stringify(state.participantTagAssignments), beforeAssignments);
});

test("switches LIVE to OFFICIAL on close and back to LIVE on reopen", () => {
    let state = fixtureState();
    addVote(state, "participant-a", "vocal", "p1", "good");
    state = weekly.closeWeek(state, "2026-W36", timestamp).state;
    assert.equal(spotlight.deriveSpotlightRanking(state, {
        weekId: "2026-W36", categoryId: "vocal", gender: "female"
    }).mode, "OFFICIAL");
    state = weekly.reopenWeek(state, "2026-W36", timestamp).state;
    assert.equal(spotlight.deriveSpotlightRanking(state, {
        weekId: "2026-W36", categoryId: "vocal", gender: "female"
    }).mode, "LIVE");
    state = weekly.upsertVote(state, {
        weekId: "2026-W36", participantId: "participant-b", categoryId: "vocal",
        userId: "p1", rating: "standout", reasonTagIds: [], note: "Reopened edit"
    }, timestamp).state;
    assert.deepEqual(spotlight.deriveSpotlightRanking(state, {
        weekId: "2026-W36", categoryId: "vocal", gender: "female"
    }).items.map((item) => [item.participant.name, item.metrics.weeklyPoints]), [["Bora", 3], ["Ari", 1]]);
});

test("derives overview and participant history without mutating persistent data or IndexedDB", () => {
    const state = fixtureState();
    addCoreScenario(state);
    const snapshot = JSON.stringify(state);
    let indexedDbTouched = false;
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, get() { indexedDbTouched = true; return null; } });
    const overview = spotlight.deriveWeeklyOverview(state, "2026-W36");
    const history = spotlight.deriveParticipantHistory(state, "participant-a");
    assert.equal(overview.categories.length, 6);
    assert.equal(overview.categories[0].results.length, 2);
    assert.equal(history.wins, 1);
    assert.equal(history.topThreeAppearances, 1);
    assert.equal(history.bestWeek.metrics.weeklyPoints, 6);
    assert.equal(JSON.stringify(state), snapshot);
    assert.equal(indexedDbTouched, false);
    delete globalThis.indexedDB;
});
