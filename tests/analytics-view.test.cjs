const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
require(path.join(projectRoot, "js", "constants.js"));
require(path.join(projectRoot, "js", "ui.js"));
require(path.join(projectRoot, "js", "data.js"));
require(path.join(projectRoot, "js", "weekly.js"));
require(path.join(projectRoot, "js", "spotlight.js"));
require(path.join(projectRoot, "js", "profile-history.js"));
require(path.join(projectRoot, "js", "analytics.js"));
require(path.join(projectRoot, "js", "analytics-view.js"));

const { data, analyticsView } = globalThis.StatsV2;
const stamp = "2026-09-20T20:00:00.000Z";
const weekIds = ["2026-W31", "2026-W32", "2026-W33", "2026-W34", "2026-W35", "2026-W36", "2026-W37"];
const weekDates = [
    ["2026-07-27", "2026-08-02"],
    ["2026-08-03", "2026-08-09"],
    ["2026-08-10", "2026-08-16"],
    ["2026-08-17", "2026-08-23"],
    ["2026-08-24", "2026-08-30"],
    ["2026-08-31", "2026-09-06"],
    ["2026-09-07", "2026-09-13"]
];

function fixtureState() {
    const state = data.createEmptyState(stamp);
    state.groups.push(
        data.createGroup({ id: "aurora", name: "Aurora" }, stamp),
        data.createGroup({ id: "orbit", name: "Orbit" }, stamp)
    );
    state.tags.push(
        data.createTag({ id: "reason-tone", name: "Tono", categoryId: "vocal", type: "strength", predefined: true }, stamp),
        data.createTag({ id: "profile-tone", name: "Perfil vocal", categoryId: "vocal", type: "strength", predefined: false }, stamp)
    );
    state.participants.push(
        data.createParticipant({ id: "ana", name: "Ana", groupId: "aurora", gender: "female", categoryIds: ["vocal"] }, stamp),
        data.createParticipant({ id: "bea", name: "Bea", groupId: "aurora", gender: "female", categoryIds: ["vocal"] }, stamp),
        data.createParticipant({ id: "cora", name: "Cora", groupId: "orbit", gender: "female", categoryIds: ["vocal"] }, stamp),
        data.createParticipant({ id: "dani", name: "Dani", groupId: null, gender: "female", categoryIds: ["vocal"] }, stamp),
        data.createParticipant({ id: "eli", name: "Eli", groupId: "orbit", gender: "male", categoryIds: ["vocal"] }, stamp),
        data.createParticipant({ id: "finn", name: "Finn", groupId: null, gender: "male", categoryIds: ["vocal"] }, stamp)
    );
    state.participantTagAssignments.push(data.createTagAssignment({
        id: "assignment-1", participantId: "ana", tagId: "profile-tone"
    }, stamp));
    weekIds.forEach((weekId, weekIndex) => {
        state.weeks.push(data.createWeek({
            id: weekId,
            label: `Semana ${weekIndex + 1}`,
            startDate: weekDates[weekIndex][0],
            endDate: weekDates[weekIndex][1],
            status: weekIndex === 6 ? "OPEN" : "CLOSED",
            closedAt: weekIndex === 6 ? null : stamp
        }, stamp));
    });
    state.settings.activeWeekId = "2026-W37";
    const ratings = ["normal", "good", "impressed", "standout"];
    weekIds.forEach((weekId, weekIndex) => {
        state.participants.forEach((participant, participantIndex) => {
            ["p1", "p2"].forEach((userId, userIndex) => {
                state.weeklyVotes.push(data.createWeeklyVote({
                    id: `vote-${weekIndex}-${participantIndex}-${userIndex}`,
                    weekId,
                    participantId: participant.id,
                    categoryId: "vocal",
                    userId,
                    rating: ratings[(weekIndex + participantIndex + userIndex) % ratings.length],
                    reasonTagIds: participant.id === "ana" ? ["reason-tone"] : []
                }, stamp));
            });
        });
    });
    return state;
}

test("maps UI filters to the public Analytics query without inventing dimensions", () => {
    assert.deepEqual(analyticsView.createQuery({
        range: "8", categoryId: "vocal", gender: "female", groupId: "aurora", includeOpen: true
    }), {
        lastNWeeks: 8,
        categoryId: "vocal",
        gender: "female",
        groupId: "aurora",
        includeOpen: true
    });
    assert.deepEqual(analyticsView.createQuery({
        range: "unexpected", categoryId: "all", gender: "all", groupId: "all", includeOpen: false
    }), { lastNWeeks: undefined, categoryId: undefined, gender: undefined, groupId: undefined, includeOpen: false });
});

test("builds all five dashboard areas from six participants and seven weeks", () => {
    const model = analyticsView.createDashboardModel(fixtureState(), {
        range: "all", categoryId: "vocal", gender: "female", groupId: "all", includeOpen: true
    });
    assert.equal(model.scope.weekIds.length, 7);
    assert.equal(model.participantMetrics.rows.length, 4);
    assert.ok(model.wins.groups[0].entries.length > 0);
    assert.ok(model.ratingDistribution.distributions.length === 2);
    assert.equal(model.activity.weeks.length, 7);
    assert.ok(model.categoryAnalytics.rows.length > 0);
    assert.equal(model.praisedSkills.entries[0].tagId, "reason-tone");
    assert.equal(model.profileTags.entries[0].tagId, "profile-tone");
});

test("excludes OPEN by default and includes it only when requested", () => {
    const state = fixtureState();
    const official = analyticsView.createDashboardModel(state, {
        range: "all", categoryId: "vocal", gender: "female", groupId: "all", includeOpen: false
    });
    const live = analyticsView.createDashboardModel(state, {
        range: "all", categoryId: "vocal", gender: "female", groupId: "all", includeOpen: true
    });
    assert.equal(official.scope.weekIds.length, 6);
    assert.equal(live.scope.weekIds.length, 7);
    assert.equal(official.scope.weekStatus, "CLOSED_ONLY");
    assert.equal(live.scope.weekStatus, "OPEN_AND_CLOSED");
});

test("limits the time range after applying the official/live week scope", () => {
    const state = fixtureState();
    assert.deepEqual(analyticsView.createDashboardModel(state, {
        range: "4", categoryId: "vocal", gender: "female", groupId: "all", includeOpen: false
    }).scope.weekIds, ["2026-W33", "2026-W34", "2026-W35", "2026-W36"]);
    assert.deepEqual(analyticsView.createDashboardModel(state, {
        range: "4", categoryId: "vocal", gender: "female", groupId: "all", includeOpen: true
    }).scope.weekIds, ["2026-W34", "2026-W35", "2026-W36", "2026-W37"]);
});

test("does not mutate participants, votes, tags or assignments while deriving the dashboard", () => {
    const state = fixtureState();
    const before = JSON.stringify(state);
    analyticsView.createDashboardModel(state, {
        range: "12", categoryId: "vocal", gender: "all", groupId: "all", includeOpen: true
    });
    assert.equal(JSON.stringify(state), before);
});
