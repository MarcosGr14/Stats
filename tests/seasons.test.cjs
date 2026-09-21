const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
[
    "constants.js", "data.js", "weekly.js", "spotlight.js", "analytics.js", "season.js", "seasons.js"
].forEach((file) => require(path.join(projectRoot, "js", file)));

const { data, weekly, seasons } = globalThis.StatsV2;
const stamp = "2026-08-01T12:00:00.000Z";

function fixtureState() {
    const state = data.createEmptyState(stamp);
    state.settings.voters = [{ id: "p1", name: "P1" }, { id: "p2", name: "P2" }];
    state.tags.push(data.createTag({ id: "tag-power", name: "Power", categoryId: "vocal", type: "strength" }, stamp));
    state.participants.push(
        data.createParticipant({ id: "female-one", name: "Ari", gender: "female", categoryIds: ["vocal"] }, stamp),
        data.createParticipant({ id: "male-one", name: "Min", gender: "male", categoryIds: ["vocal"] }, stamp)
    );
    ["2026-08-03T12:00:00.000Z", "2026-08-10T12:00:00.000Z", "2026-08-17T12:00:00.000Z", "2026-08-24T12:00:00.000Z", "2026-08-31T12:00:00.000Z"]
        .forEach((date, index) => {
            const descriptor = weekly.isoWeekForDate(date);
            state.weeks.push(data.createWeek({
                ...descriptor,
                status: "CLOSED",
                closedAt: date
            }, date));
            [["female-one", "standout"], ["male-one", index === 0 ? "good" : "impressed"]]
                .forEach(([participantId, rating]) => {
                    ["p1", "p2"].forEach((userId) => state.weeklyVotes.push(data.createWeeklyVote({
                        id: `vote-${index}-${participantId}-${userId}`,
                        weekId: descriptor.id,
                        participantId,
                        categoryId: "vocal",
                        userId,
                        rating,
                        reasonTagIds: participantId === "female-one" ? ["tag-power"] : []
                    }, date)));
                });
        });
    return state;
}

test("adds one current season without changing existing records", () => {
    const state = fixtureState();
    delete state.seasons;
    delete state.settings.currentSeasonId;
    const preserved = JSON.stringify({
        participants: state.participants,
        groups: state.groups,
        tags: state.tags,
        assignments: state.participantTagAssignments,
        weeks: state.weeks,
        votes: state.weeklyVotes
    });
    const result = seasons.ensureCurrentSeason(state, "2026-09-01T12:00:00.000Z");
    assert.equal(result.changed, true);
    assert.equal(result.season.id, "season-1");
    assert.equal(result.season.status, "OPEN");
    assert.deepEqual(result.season.weekIds, ["2026-W32", "2026-W33", "2026-W34", "2026-W35", "2026-W36"]);
    assert.equal(result.state.settings.currentSeasonId, "season-1");
    assert.equal(JSON.stringify({
        participants: result.state.participants,
        groups: result.state.groups,
        tags: result.state.tags,
        assignments: result.state.participantTagAssignments,
        weeks: result.state.weeks,
        votes: result.state.weeklyVotes
    }), preserved);
    assert.equal(data.validateState(result.state).valid, true);
});

test("closes a season with frozen winners and starts the next one", () => {
    let state = seasons.ensureCurrentSeason(fixtureState(), "2026-09-01T12:00:00.000Z").state;
    const preserved = JSON.stringify({
        participants: state.participants,
        weeks: state.weeks,
        votes: state.weeklyVotes,
        tags: state.tags
    });
    const result = seasons.closeCurrentSeason(state, "2026-09-07T12:00:00.000Z");
    assert.equal(result.closedSeason.status, "CLOSED");
    assert.equal(result.closedSeason.startWeekId, "2026-W32");
    assert.equal(result.closedSeason.endWeekId, "2026-W36");
    assert.equal(result.closedSeason.resultsSnapshot.grandWinners
        .find((standing) => standing.gender === "female").winners[0].name, "Ari");
    assert.equal(result.closedSeason.resultsSnapshot.categoryWinners
        .find((standing) => standing.categoryId === "vocal" && standing.gender === "male").winners[0].name, "Min");
    assert.equal(result.closedSeason.resultsSnapshot.highlights.length, 6);
    assert.equal(result.currentSeason.id, "season-2");
    assert.equal(result.currentSeason.status, "OPEN");
    assert.deepEqual(result.currentSeason.weekIds, []);
    assert.equal(result.state.settings.currentSeasonId, "season-2");
    assert.equal(JSON.stringify({
        participants: result.state.participants,
        weeks: result.state.weeks,
        votes: result.state.weeklyVotes,
        tags: result.state.tags
    }), preserved);
    assert.equal(data.validateState(result.state).valid, true);
});

test("requires a closed week and assigns the next created week to the new season", () => {
    let state = seasons.ensureCurrentSeason(fixtureState(), "2026-09-01T12:00:00.000Z").state;
    state = seasons.closeCurrentSeason(state, "2026-09-07T12:00:00.000Z").state;
    const opened = weekly.openNextIsoWeek(state, "2026-09-08T12:00:00.000Z");
    assert.throws(() => seasons.closeCurrentSeason(opened.state), (error) => (
        error.code === "OPEN_WEEK_EXISTS"
        && error.message === "Cierra la semana abierta antes de cerrar la temporada."
    ));
    state = seasons.assignWeekToCurrentSeason(opened.state, opened.week.id, "2026-09-08T12:00:00.000Z");
    assert.deepEqual(seasons.currentSeason(state).weekIds, ["2026-W37"]);
    assert.equal(data.validateState(state).valid, true);
});

test("does not close an empty season", () => {
    const state = seasons.ensureCurrentSeason(data.createEmptyState(stamp), stamp).state;
    assert.throws(() => seasons.closeCurrentSeason(state), (error) => error.code === "EMPTY_SEASON");
});
