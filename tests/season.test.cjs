const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
require(path.join(projectRoot, "js", "constants.js"));
require(path.join(projectRoot, "js", "data.js"));
require(path.join(projectRoot, "js", "weekly.js"));
require(path.join(projectRoot, "js", "spotlight.js"));
require(path.join(projectRoot, "js", "profile-history.js"));
require(path.join(projectRoot, "js", "analytics.js"));
require(path.join(projectRoot, "js", "season.js"));

const { data, season } = globalThis.StatsV2;
const stamp = "2026-09-20T20:00:00.000Z";
const weeks = [
    ["2026-W31", "2026-07-27", "2026-08-02", "CLOSED"],
    ["2026-W32", "2026-08-03", "2026-08-09", "CLOSED"],
    ["2026-W33", "2026-08-10", "2026-08-16", "CLOSED"],
    ["2026-W34", "2026-08-17", "2026-08-23", "CLOSED"],
    ["2026-W35", "2026-08-24", "2026-08-30", "CLOSED"],
    ["2026-W36", "2026-08-31", "2026-09-06", "CLOSED"],
    ["2026-W37", "2026-09-07", "2026-09-13", "OPEN"]
];

function addVotes(state, participantId, categoryId, rating, count, startIndex = 0) {
    weeks.slice(startIndex, startIndex + count).forEach(([weekId]) => {
        ["p1", "p2"].forEach((userId) => state.weeklyVotes.push(data.createWeeklyVote({
            id: `vote-${weekId}-${participantId}-${categoryId}-${userId}`,
            weekId, participantId, categoryId, userId, rating
        }, stamp)));
    });
}

function fixtureState() {
    const state = data.createEmptyState(stamp);
    state.groups.push(
        data.createGroup({ id: "aurora", name: "Aurora" }, stamp),
        data.createGroup({ id: "orbit", name: "Orbit" }, stamp)
    );
    state.participants.push(
        data.createParticipant({ id: "f1", name: "Ayla", groupId: "aurora", gender: "female", categoryIds: ["vocal"] }, stamp),
        data.createParticipant({ id: "f2", name: "Bella", groupId: "aurora", gender: "female", categoryIds: ["vocal"] }, stamp),
        data.createParticipant({ id: "f3", name: "Celia", groupId: "orbit", gender: "female", categoryIds: ["vocal", "rap"] }, stamp),
        data.createParticipant({ id: "fp", name: "Dalia", groupId: null, gender: "female", categoryIds: ["vocal"] }, stamp),
        data.createParticipant({ id: "fn", name: "Emma", groupId: null, gender: "female", categoryIds: ["vocal"] }, stamp),
        data.createParticipant({ id: "m1", name: "Kai", groupId: "orbit", gender: "male", categoryIds: ["vocal"] }, stamp),
        data.createParticipant({ id: "m2", name: "Leo", groupId: "orbit", gender: "male", categoryIds: ["vocal"] }, stamp),
        data.createParticipant({ id: "m3", name: "Milo", groupId: null, gender: "male", categoryIds: ["vocal"] }, stamp),
        data.createParticipant({ id: "mp", name: "Noel", groupId: null, gender: "male", categoryIds: ["vocal"] }, stamp)
    );
    weeks.forEach(([id, startDate, endDate, status], index) => state.weeks.push(data.createWeek({
        id, label: `Semana ${index + 1}`, startDate, endDate, status,
        closedAt: status === "CLOSED" ? stamp : null
    }, stamp)));
    state.settings.activeWeekId = "2026-W37";

    addVotes(state, "f1", "vocal", "standout", 6);
    addVotes(state, "f2", "vocal", "standout", 6);
    addVotes(state, "f3", "vocal", "good", 6);
    addVotes(state, "fp", "vocal", "standout", 4);
    addVotes(state, "fn", "vocal", "normal", 5);
    addVotes(state, "f3", "rap", "standout", 6);
    addVotes(state, "m1", "vocal", "impressed", 6);
    addVotes(state, "m2", "vocal", "impressed", 6);
    addVotes(state, "m3", "vocal", "good", 6);
    addVotes(state, "mp", "vocal", "standout", 4);

    addVotes(state, "f3", "vocal", "standout", 1, 6);
    return state;
}

function categoryEntry(categoryId, seasonScore, eligible = true) {
    return { categoryId, seasonScore, eligible };
}

test("calculates the official 40/25/20/15 Season Score with full precision", () => {
    const result = season.calculateSeasonScore({
        averageWeeklyPoints: 5.1,
        weeksEvaluated: 8,
        wins: 4,
        topThreeAppearances: 6,
        standoutVotes: 6
    });
    assert.equal(result.components.averagePerformance, 85);
    assert.equal(result.components.winRate, 50);
    assert.equal(result.components.topThreeRate, 75);
    assert.equal(result.components.standoutRate, 37.5);
    assert.equal(result.contributions.averagePerformance, 34);
    assert.equal(result.contributions.winRate, 12.5);
    assert.equal(result.contributions.topThreeRate, 15);
    assert.equal(result.contributions.standoutRate, 5.625);
    assert.equal(result.seasonScore, 67.125);
    assert.equal(season.displayScore(85.45), 85.5);
});

test("counts Normal as evaluated, excludes Not evaluated and applies the five-week threshold", () => {
    const standing = season.deriveCategoryStanding(fixtureState(), { categoryId: "vocal", gender: "female" });
    const normal = standing.eligible.find((entry) => entry.participantId === "fn");
    const provisional = standing.provisional.find((entry) => entry.participantId === "fp");
    assert.equal(normal.weeksEvaluated, 5);
    assert.equal(normal.averageWeeklyPoints, 0);
    assert.equal(normal.eligible, true);
    assert.equal(provisional.weeksEvaluated, 4);
    assert.equal(provisional.eligible, false);
    assert.equal(standing.eligible.some((entry) => entry.participantId === "fp"), false);
});

test("keeps category and gender standings independent", () => {
    const state = fixtureState();
    const femaleVocal = season.deriveCategoryStanding(state, { categoryId: "vocal", gender: "female" });
    const maleVocal = season.deriveCategoryStanding(state, { categoryId: "vocal", gender: "male" });
    const femaleRap = season.deriveCategoryStanding(state, { categoryId: "rap", gender: "female" });
    assert.equal(femaleVocal.eligible.some((entry) => entry.participant.gender === "male"), false);
    assert.equal(maleVocal.eligible.some((entry) => entry.participant.gender === "female"), false);
    assert.deepEqual(femaleRap.eligible.map((entry) => entry.participantId), ["f3"]);
    assert.equal(femaleVocal.eligible.find((entry) => entry.participantId === "f3").categoryId, "vocal");
});

test("orders eligible standings by exact score and preserves competition ties", () => {
    const standing = season.deriveCategoryStanding(fixtureState(), { categoryId: "vocal", gender: "female" });
    assert.deepEqual(standing.eligible.slice(0, 3).map((entry) => [entry.participantId, entry.rank, entry.tied]), [
        ["f1", 1, true], ["f2", 1, true], ["f3", 3, false]
    ]);
    assert.deepEqual(standing.topThree.map((entry) => entry.participantId), ["f1", "f2", "f3"]);
    assert.equal(standing.provisional[0].participantId, "fp");
    assert.equal(standing.provisional[0].seasonScore, 100);
});

test("selects female, male and joint category winners without allowing provisional winners", () => {
    const result = season.deriveCategoryWinners(fixtureState());
    const female = result.items.find((item) => item.categoryId === "vocal" && item.gender === "female");
    const male = result.items.find((item) => item.categoryId === "vocal" && item.gender === "male");
    assert.deepEqual(female.winners.map((entry) => entry.participantId), ["f1", "f2"]);
    assert.equal(female.isJointWinner, true);
    assert.deepEqual(male.winners.map((entry) => entry.participantId), ["m1", "m2"]);
    assert.equal(female.winners.some((entry) => entry.participantId === "fp"), false);
    assert.equal(male.winners.some((entry) => entry.participantId === "mp"), false);
});

test("uses only best and second eligible categories for Grand Score", () => {
    const result = season.calculateGrandScore([
        categoryEntry("vocal", 88),
        categoryEntry("rap", 81),
        categoryEntry("dance", 76)
    ]);
    assert.ok(Math.abs(result.grandScore - 87.65) < 1e-12);
    assert.equal(result.bestCategory.categoryId, "vocal");
    assert.equal(result.secondBestCategory.categoryId, "rap");
    assert.equal(result.eligibleCategoryCount, 3);
});

test("does not penalize a single eligible category and rejects provisional categories", () => {
    assert.equal(season.calculateGrandScore([categoryEntry("vocal", 91)]).grandScore, 91);
    assert.throws(() => season.calculateGrandScore([
        categoryEntry("vocal", 91), categoryEntry("stage", 99, false)
    ]), /eligible categories/);
});

test("prevents cross-category quantity advantage", () => {
    const oneCategory = season.calculateGrandScore([categoryEntry("vocal", 90)]);
    const fourCategories = season.calculateGrandScore([
        categoryEntry("vocal", 85), categoryEntry("rap", 84),
        categoryEntry("dance", 83), categoryEntry("stage", 82)
    ]);
    assert.ok(Math.abs(fourCategories.grandScore - 84.95) < 1e-12);
    assert.ok(oneCategory.grandScore > fourCategories.grandScore);
});

test("separates Grand Winners by gender, preserves ties and excludes candidates without an eligible category", () => {
    const result = season.deriveGrandStandings(fixtureState());
    const female = result.genders.find((item) => item.gender === "female");
    const male = result.genders.find((item) => item.gender === "male");
    assert.deepEqual(female.winners.map((entry) => entry.participantId), ["f1", "f2"]);
    assert.deepEqual(female.winners.map((entry) => entry.rank), [1, 1]);
    assert.deepEqual(male.winners.map((entry) => entry.participantId), ["m1", "m2"]);
    assert.equal(female.entries.some((entry) => entry.participantId === "fp"), false);
    assert.equal(female.notEligible.some((entry) => entry.participantId === "fp"), true);
    assert.equal(male.entries.some((entry) => entry.participantId === "mp"), false);
});

test("uses CLOSED weeks by default and marks OPEN-inclusive calculations as live preview", () => {
    const state = fixtureState();
    const official = season.deriveCategoryStanding(state, { categoryId: "vocal", gender: "female" });
    const live = season.deriveCategoryStanding(state, { categoryId: "vocal", gender: "female", includeOpen: true });
    assert.deepEqual(official.scope.weekIds, weeks.slice(0, 6).map(([id]) => id));
    assert.equal(official.isLivePreview, false);
    assert.equal(live.scope.weekIds.length, 7);
    assert.equal(live.isLivePreview, true);
    assert.notEqual(
        official.eligible.find((entry) => entry.participantId === "f3").seasonScore,
        live.eligible.find((entry) => entry.participantId === "f3").seasonScore
    );
});

test("derives all twelve standings from one immutable current-history scope", () => {
    const result = season.deriveAllStandings(fixtureState());
    assert.equal(result.standings.length, 12);
    assert.deepEqual(new Set(result.standings.map((standing) => standing.categoryId)),
        new Set(["vocal", "rap", "dance", "stage", "visual", "all-rounder"]));
    assert.deepEqual(new Set(result.standings.map((standing) => standing.gender)), new Set(["male", "female"]));
});

test("never mutates state, persists standings or touches IndexedDB", () => {
    const state = fixtureState();
    const before = JSON.stringify(state);
    const previousIndexedDb = globalThis.indexedDB;
    globalThis.indexedDB = new Proxy({}, { get() { throw new Error("IndexedDB must not be touched"); } });
    try {
        const result = season.deriveSeasonOverview(state);
        assert.equal(result.categoryWinners.length, 12);
        assert.equal(JSON.stringify(state), before);
        assert.equal(Object.prototype.hasOwnProperty.call(state.participants[0], "seasonScore"), false);
        assert.equal(Object.prototype.hasOwnProperty.call(state, "seasonStandings"), false);
    } finally {
        globalThis.indexedDB = previousIndexedDb;
    }
});
