const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
["constants.js", "data.js", "participant-catalog.js"].forEach((file) => {
    require(path.join(projectRoot, "js", file));
});

const { data, participantCatalog } = globalThis.StatsV2;
const stamp = "2026-11-25T12:00:00.000Z";

test("contains the supplied Fan Choice catalog once per performer and group", () => {
    const identities = participantCatalog.entries.map((entry) => (
        `${entry.group || "solo"}|${entry.name.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, "")}`
    ));
    assert.equal(participantCatalog.entries.length, 242);
    assert.equal(new Set(identities).size, identities.length);
    const namesByIdentity = new Map();
    participantCatalog.entries.forEach((entry) => {
        const key = entry.name.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, "");
        namesByIdentity.set(key, (namesByIdentity.get(key) || 0) + 1);
    });
    assert.deepEqual([...namesByIdentity].filter(([, count]) => count > 1).map(([name]) => name).sort(), [
        "dk", "doyoung", "jay", "jiwoo"
    ]);
    assert.equal(participantCatalog.entries.filter((entry) => entry.gender === "female").length, 104);
    assert.equal(participantCatalog.entries.filter((entry) => entry.gender === "male").length, 138);
    assert.ok(participantCatalog.entries.some((entry) => entry.name === "B.I" && entry.group === null));
    assert.equal(participantCatalog.entries.filter((entry) => entry.name === "B.I").length, 1);
});

test("adds only missing catalog groups and participants without changing existing identities", () => {
    const state = data.createEmptyState(stamp);
    state.groups.push(data.createGroup({ id: "group-aespa", name: "AESPA" }, stamp));
    state.groups.push(data.createGroup({ id: "group-txt", name: "Tomorrow X Together" }, stamp));
    state.groups.push(data.createGroup({ id: "group-ikon", name: "iKON" }, stamp));
    state.participants.push(
        data.createParticipant({
            id: "existing-karina", name: "KARINA", groupId: "group-aespa", gender: "female",
            imageId: "karina-image", categoryIds: ["dance"]
        }, stamp),
        data.createParticipant({
            id: "existing-soobin", name: "Soobin", groupId: "group-txt", gender: "male", categoryIds: ["vocal"]
        }, stamp),
        data.createParticipant({
            id: "existing-bi", name: "B.I.", groupId: "group-ikon", gender: "male", categoryIds: ["rap"]
        }, stamp)
    );

    const result = participantCatalog.ensureFanChoiceCatalog(state, stamp);
    assert.equal(result.addedParticipants, 239);
    assert.equal(result.addedGroups, 36);
    assert.equal(result.state.participants.find((item) => item.name === "KARINA").id, "existing-karina");
    assert.equal(result.state.participants.find((item) => item.name === "KARINA").imageId, "karina-image");
    assert.equal(result.state.participants.find((item) => item.name === "Soobin").id, "existing-soobin");
    assert.equal(result.state.participants.find((item) => item.id === "existing-bi").groupId, null);
    assert.equal(result.state.groups.find((item) => item.id === "group-txt").name, "TOMORROW X TOGETHER (TXT)");
    assert.ok(result.state.participants.filter((item) => !["existing-karina", "existing-soobin", "existing-bi"].includes(item.id))
        .every((item) => item.categoryIds.length === 0));
    assert.equal(data.validateState(result.state).valid, true);
});

test("is idempotent and does not recreate an intentionally removed catalog entry", () => {
    const first = participantCatalog.ensureFanChoiceCatalog(data.createEmptyState(stamp), stamp);
    const removedId = first.state.participants[0].id;
    const edited = structuredClone(first.state);
    edited.participants = edited.participants.filter((item) => item.id !== removedId);

    const second = participantCatalog.ensureFanChoiceCatalog(edited, stamp);
    assert.equal(second.changed, false);
    assert.equal(second.state.participants.some((item) => item.id === removedId), false);
    assert.equal(second.state.participants.length, 241);
});
