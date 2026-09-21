(function defineSeasons(root) {
    "use strict";

    const namespace = root.StatsV2 || {};
    const constants = namespace.constants;
    const data = namespace.data;
    const analytics = namespace.analytics;
    const season = namespace.season;

    if (!constants || !data || !analytics || !season) {
        throw new Error("Stats V2 data, Analytics and Season modules must load before seasons.");
    }

    class SeasonError extends Error {
        constructor(code, message) {
            super(message);
            this.name = "SeasonError";
            this.code = code;
        }
    }

    function cloneState(state) { return JSON.parse(JSON.stringify(state)); }
    function assertState(state) {
        const validation = data.validateState(state);
        if (!validation.valid) throw new SeasonError("INVALID_STATE", validation.errors.join(" "));
    }
    function sortedWeekIds(state, weekIds) {
        const selected = new Set(weekIds);
        return state.weeks.filter((week) => selected.has(week.id))
            .sort((left, right) => left.startDate.localeCompare(right.startDate))
            .map((week) => week.id);
    }
    function nextSeasonNumber(seasons) {
        const used = seasons.map((item) => Number.parseInt(String(item.id).replace(/^season-/, ""), 10))
            .filter(Number.isInteger);
        return (used.length ? Math.max(...used) : 0) + 1;
    }
    function createOpenSeason(number, weekIds, timestamp) {
        return data.createSeason({
            id: `season-${number}`,
            label: `TEMPORADA ${number}`,
            status: "OPEN",
            weekIds,
            startWeekId: weekIds[0] || null
        }, timestamp);
    }

    function ensureCurrentSeason(state, timestamp = new Date().toISOString()) {
        assertState(state);
        const nextState = cloneState(state);
        let changed = false;
        if (!Array.isArray(nextState.seasons)) {
            nextState.seasons = [];
            changed = true;
        }
        if (!Object.prototype.hasOwnProperty.call(nextState.settings, "currentSeasonId")) {
            nextState.settings.currentSeasonId = null;
            changed = true;
        }
        let current = nextState.seasons.find((item) => item.status === "OPEN") || null;
        if (!current) {
            const assigned = new Set(nextState.seasons.flatMap((item) => item.weekIds || []));
            const unassigned = sortedWeekIds(nextState, nextState.weeks.map((week) => week.id).filter((weekId) => !assigned.has(weekId)));
            current = createOpenSeason(nextSeasonNumber(nextState.seasons), unassigned, timestamp);
            nextState.seasons.push(current);
            changed = true;
        }
        const assigned = new Set(nextState.seasons.flatMap((item) => item.weekIds || []));
        const missing = sortedWeekIds(nextState, nextState.weeks.map((week) => week.id).filter((weekId) => !assigned.has(weekId)));
        if (missing.length > 0) {
            current.weekIds.push(...missing);
            current.weekIds = sortedWeekIds(nextState, current.weekIds);
            current.startWeekId = current.weekIds[0] || null;
            current.updatedAt = timestamp;
            changed = true;
        }
        if (nextState.settings.currentSeasonId !== current.id) {
            nextState.settings.currentSeasonId = current.id;
            changed = true;
        }
        assertState(nextState);
        return { state: nextState, season: current, changed };
    }

    function currentSeason(state) {
        const seasonId = state.settings.currentSeasonId;
        return state.seasons.find((item) => item.id === seasonId && item.status === "OPEN")
            || state.seasons.find((item) => item.status === "OPEN") || null;
    }

    function assignWeekToCurrentSeason(state, weekId, timestamp = new Date().toISOString()) {
        const ensured = ensureCurrentSeason(state, timestamp);
        if (!ensured.state.weeks.some((week) => week.id === weekId)) {
            throw new SeasonError("WEEK_NOT_FOUND", "La semana no existe.");
        }
        if (ensured.state.seasons.some((item) => item.weekIds.includes(weekId))) return ensured.state;
        const nextState = cloneState(ensured.state);
        const current = currentSeason(nextState);
        current.weekIds.push(weekId);
        current.weekIds = sortedWeekIds(nextState, current.weekIds);
        current.startWeekId = current.weekIds[0];
        current.updatedAt = timestamp;
        assertState(nextState);
        return nextState;
    }

    function periodOptionsForCurrent(state, includeOpen = false) {
        const current = currentSeason(state);
        return { includeOpen, weekIds: current ? [...current.weekIds] : [] };
    }

    function personSnapshot(entry, scoreField) {
        return {
            participantId: entry.participantId,
            name: entry.participant.name,
            imageId: entry.participant.imageId || null,
            groupName: entry.group?.name || "Solista",
            score: entry[scoreField]
        };
    }

    function aggregateParticipantMetrics(rows) {
        const totals = new Map();
        rows.forEach((row) => {
            if (!totals.has(row.participantId)) {
                totals.set(row.participantId, {
                    participantId: row.participantId,
                    name: row.participant.name,
                    wins: 0,
                    topThree: 0,
                    standouts: 0
                });
            }
            const total = totals.get(row.participantId);
            total.wins += row.wins;
            total.topThree += row.topThreeAppearances;
            total.standouts += row.standoutVotes;
        });
        return [...totals.values()];
    }

    function metricHighlight(id, label, entries, field, lowerIsBetter = false, requirePositive = false) {
        if (entries.length === 0) return { id, label, value: null, names: [], detail: "Sin datos suficientes" };
        const ordered = [...entries].sort((left, right) => (
            lowerIsBetter ? left[field] - right[field] : right[field] - left[field]
        ) || left.name.localeCompare(right.name, "es", { sensitivity: "base" }));
        const bestValue = ordered[0][field];
        if (requirePositive && bestValue <= 0) {
            return { id, label, value: null, names: [], detail: "Sin datos suficientes" };
        }
        return {
            id,
            label,
            value: bestValue,
            names: ordered.filter((entry) => entry[field] === bestValue).map((entry) => entry.name),
            detail: ""
        };
    }

    function deriveHighlights(state, weekIds, includeOpen = false) {
        const options = { weekIds, includeOpen };
        const derived = analytics.deriveParticipantCategoryMetrics(state, options);
        const totals = aggregateParticipantMetrics(derived.rows);
        const improvedRows = derived.rows.filter((row) => row.evaluatedWeeks >= 3 && row.improvementSlope > 0)
            .map((row) => ({ name: row.participant.name, value: row.improvementSlope }));
        const consistentRows = derived.rows.filter((row) => row.evaluatedWeeks >= 3)
            .map((row) => ({ name: row.participant.name, value: row.standardDeviation }));
        const praised = analytics.deriveMostPraisedSkills(state, options).entries[0] || null;
        return [
            metricHighlight("wins", "Más victorias", totals, "wins", false, true),
            metricHighlight("top-three", "Más Top 3", totals, "topThree", false, true),
            metricHighlight("standouts", "Más destacados", totals, "standouts", false, true),
            metricHighlight("improved", "Mayor mejora", improvedRows, "value"),
            metricHighlight("consistent", "Más consistente", consistentRows, "value", true),
            praised
                ? { id: "praised", label: "Habilidad más elogiada", value: praised.count, names: [praised.tag.name], detail: "" }
                : { id: "praised", label: "Habilidad más elogiada", value: null, names: [], detail: "Sin elogios semanales" }
        ];
    }

    function buildResultsSnapshot(state, weekIds) {
        const overview = season.deriveSeasonOverview(state, { includeOpen: false, weekIds });
        return {
            grandWinners: overview.grandStandings.genders.map((standing) => ({
                gender: standing.gender,
                winners: standing.winners.map((entry) => personSnapshot(entry, "grandScore"))
            })),
            categoryWinners: overview.categoryWinners.map((standing) => ({
                categoryId: standing.categoryId,
                gender: standing.gender,
                winners: standing.winners.map((entry) => personSnapshot(entry, "seasonScore"))
            })),
            highlights: deriveHighlights(state, weekIds, false)
        };
    }

    function closeCurrentSeason(state, timestamp = new Date().toISOString()) {
        const ensured = ensureCurrentSeason(state, timestamp);
        const openWeek = ensured.state.weeks.find((week) => week.status === "OPEN");
        if (openWeek) {
            throw new SeasonError("OPEN_WEEK_EXISTS", "Cierra la semana abierta antes de cerrar la temporada.");
        }
        const current = currentSeason(ensured.state);
        if (!current || current.weekIds.length === 0) {
            throw new SeasonError("EMPTY_SEASON", "La temporada todavía no tiene semanas.");
        }
        const nextState = cloneState(ensured.state);
        const closing = currentSeason(nextState);
        closing.weekIds = sortedWeekIds(nextState, closing.weekIds);
        closing.startWeekId = closing.weekIds[0];
        closing.endWeekId = closing.weekIds.at(-1);
        closing.status = "CLOSED";
        closing.closedAt = timestamp;
        closing.resultsSnapshot = buildResultsSnapshot(nextState, closing.weekIds);
        closing.updatedAt = timestamp;
        const nextNumber = nextSeasonNumber(nextState.seasons);
        const opened = createOpenSeason(nextNumber, [], timestamp);
        nextState.seasons.push(opened);
        nextState.settings.currentSeasonId = opened.id;
        assertState(nextState);
        return { state: nextState, closedSeason: closing, currentSeason: opened };
    }

    namespace.seasons = Object.freeze({
        SeasonError,
        ensureCurrentSeason,
        currentSeason,
        assignWeekToCurrentSeason,
        periodOptionsForCurrent,
        deriveHighlights,
        buildResultsSnapshot,
        closeCurrentSeason
    });
    root.StatsV2 = namespace;
})(globalThis);
