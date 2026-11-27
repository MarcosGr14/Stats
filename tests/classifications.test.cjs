const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
["constants", "data", "weekly", "spotlight", "profile-history", "analytics", "season", "seasons", "classifications"]
    .forEach((name) => require(path.join(root, "js", `${name}.js`)));
const { constants, data, weekly, seasons, classifications, season } = globalThis.StatsV2;
const timestamp = "2026-04-10T12:00:00.000Z";

function fixture() {
    let state = data.createEmptyState(timestamp);
    state.participants.push(data.createParticipant({ id: "dino", name: "Dino", gender: "male", categoryIds: [] }, timestamp));
    const weeks = [
        ["2026-W11", "2026-03-09", "2026-03-15"],
        ["2026-W12", "2026-03-16", "2026-03-22"],
        ["2026-W13", "2026-03-23", "2026-03-29"],
        ["2026-W14", "2026-03-30", "2026-04-05"]
    ];
    weeks.forEach(([id, startDate, endDate]) => state.weeks.push(data.createWeek({ id, label: id, startDate, endDate, status: "CLOSED", closedAt: timestamp }, timestamp)));
    state = seasons.ensureCurrentSeason(state, timestamp).state;
    state.weeks.slice(0, 3).forEach((week) => constants.VOTER_IDS.forEach((userId, index) => {
        state.weeklyVotes.push(data.createWeeklyVote({ id: `${week.id}-${userId}`, weekId: week.id,
            participantId: "dino", categoryId: "dance", userId,
            rating: index === 0 ? "standout" : "impressed" }, timestamp));
    }));
    return state;
}

test("classification requires three complete weeks, the average threshold and both reviewers", () => {
    let state = fixture();
    const evidence = classifications.evidenceFor(state, "dino", "dance");
    assert.equal(evidence.weeksEvaluated, 3);
    assert.equal(evidence.averagePoints, 5);
    assert.equal(evidence.reviewPeriod, "2026-03-31");
    assert.equal(evidence.ready, true);
    const first = classifications.reviewClassification(state, "dino", "dance", "p1");
    assert.equal(first.completed, false);
    assert.deepEqual(first.state.participants[0].categoryIds, []);
    const second = classifications.reviewClassification(first.state, "dino", "dance", "p2");
    assert.equal(second.completed, true);
    assert.deepEqual(second.state.participants[0].categoryIds, ["dance"]);
    const historical = season.deriveCategoryStanding(second.state, { categoryId: "dance", gender: "male", weekIds: ["2026-W11", "2026-W12", "2026-W13"] });
    assert.equal(historical.provisional[0].participant.id, "dino");
    assert.deepEqual(second.state.seasons[0].categoryClassifications[JSON.stringify(["dino", "dance"])].confirmedBy, ["p1", "p2"]);
});

test("criteria are editable but bounded per category", () => {
    const state = fixture();
    const updated = classifications.updateCriteria(state, "dance", { minimumWeeks: 4, minimumAveragePoints: 4.5 });
    assert.deepEqual(classifications.criteriaFor(updated, "dance"), { minimumWeeks: 4, minimumAveragePoints: 4.5 });
    assert.throws(() => classifications.updateCriteria(state, "dance", { minimumWeeks: 0, minimumAveragePoints: 8 }),
        (error) => error.code === "INVALID_CRITERIA");
});

test("pausing stops seasonal scoring and requires fresh evidence to reclassify", () => {
    let state = fixture();
    let first = classifications.reviewClassification(state, "dino", "dance", "p1");
    let classified = classifications.reviewClassification(first.state, "dino", "dance", "p2");
    const pauseState = JSON.parse(JSON.stringify(classified.state));
    pauseState.weeks.push(data.createWeek({ id: "2026-W27", label: "2026-W27", startDate: "2026-06-29",
        endDate: "2026-07-05", status: "CLOSED", closedAt: timestamp }, timestamp));
    const nextQuarter = seasons.ensureCurrentSeason(pauseState, timestamp).state;
    const pause1 = classifications.reviewClassification(nextQuarter, "dino", "dance", "p1", "paused");
    const paused = classifications.reviewClassification(pause1.state, "dino", "dance", "p2", "paused");
    assert.equal(classifications.evidenceFor(paused.state, "dino", "dance").weeksEvaluated, 0);
    assert.equal(paused.state.seasons[0].categoryClassifications[JSON.stringify(["dino", "dance"])].pausedAfterDate, "2026-07-05");
    assert.throws(() => classifications.reviewClassification(paused.state, "dino", "dance", "p1"),
        (error) => error.code === "EVIDENCE_INCOMPLETE");
});
