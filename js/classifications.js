(function defineClassifications(root) {
    "use strict";

    const namespace = root.StatsV2 || {};
    const constants = namespace.constants;
    const data = namespace.data;
    const seasons = namespace.seasons;
    if (!constants || !data || !seasons) throw new Error("Classifications must load after constants, data and seasons.");

    class ClassificationError extends Error {
        constructor(code, message) { super(message); this.name = "ClassificationError"; this.code = code; }
    }

    const cloneState = (state) => JSON.parse(JSON.stringify(state));
    const keyFor = (participantId, categoryId) => JSON.stringify([participantId, categoryId]);
    const ratingScores = new Map(constants.RATING_OPTIONS.map(({ id, score }) => [id, score]));

    function currentSeason(state) {
        return state.seasons.find((season) => season.id === state.settings.currentSeasonId && season.status === "OPEN")
            || state.seasons.find((season) => season.status === "OPEN") || null;
    }

    function criteriaFor(state, categoryId) {
        const season = currentSeason(state);
        return season?.classificationCriteria?.[categoryId] || { ...constants.CLASSIFICATION_DEFAULTS };
    }

    function currentReviewPeriod(state) {
        const season = currentSeason(state);
        if (!season) return null;
        const seasonStart = state.weeks.find((week) => week.id === season.weekIds[0])?.startDate;
        const latestClosed = season.weekIds.map((id) => state.weeks.find((week) => week.id === id))
            .filter((week) => week?.status === "CLOSED")
            .sort((left, right) => left.endDate.localeCompare(right.endDate)).at(-1);
        if (!seasonStart || !latestClosed) return null;
        const firstYear = Number(seasonStart.slice(0, 4));
        const lastYear = Number(latestClosed.endDate.slice(0, 4));
        let current = null;
        for (let year = firstYear; year <= lastYear; year += 1) {
            [2, 5, 8, 11].forEach((month) => {
                const boundary = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
                if (boundary >= seasonStart && boundary <= latestClosed.endDate && (!current || boundary > current)) current = boundary;
            });
        }
        return current;
    }

    function evidenceFor(state, participantId, categoryId) {
        const season = currentSeason(state);
        const record = season?.categoryClassifications?.[keyFor(participantId, categoryId)] || null;
        const weeks = (season?.weekIds || []).map((id) => state.weeks.find((week) => week.id === id))
            .filter((week) => week?.status === "CLOSED"
                && !(record?.status === "paused" && record.pausedAfterDate && week.endDate <= record.pausedAfterDate));
        const completed = weeks.flatMap((week) => {
            const votes = state.weeklyVotes.filter((vote) => vote.weekId === week.id
                && vote.participantId === participantId && vote.categoryId === categoryId
                && !vote.legacyUncategorized);
            const voterIds = new Set(votes.map((vote) => vote.userId));
            if (!constants.VOTER_IDS.every((id) => voterIds.has(id))) return [];
            return [{ weekId: week.id, points: votes.reduce((sum, vote) => sum + (ratingScores.get(vote.rating) || 0), 0) }];
        });
        const averagePoints = completed.length
            ? completed.reduce((sum, week) => sum + week.points, 0) / completed.length : 0;
        const completedWeekIds = new Set(completed.map((week) => week.weekId));
        const tagCounts = new Map();
        state.weeklyVotes.filter((vote) => vote.participantId === participantId && vote.categoryId === categoryId
            && completedWeekIds.has(vote.weekId)).forEach((vote) => (vote.reasonTagIds || []).forEach((tagId) => {
            tagCounts.set(tagId, (tagCounts.get(tagId) || 0) + 1);
        }));
        const tagsById = new Map(state.tags.map((tag) => [tag.id, tag]));
        const topTags = [...tagCounts].sort((left, right) => right[1] - left[1])
            .slice(0, 3).map(([tagId, count]) => ({ tag: tagsById.get(tagId), count }))
            .filter((item) => item.tag);
        const criteria = criteriaFor(state, categoryId);
        const reviewPeriod = currentReviewPeriod(state);
        const reviewOpen = Boolean(reviewPeriod && record?.lastReviewedPeriod !== reviewPeriod);
        const meetsEvidence = completed.length >= criteria.minimumWeeks && averagePoints >= criteria.minimumAveragePoints;
        return {
            weeksEvaluated: completed.length,
            averagePoints,
            minimumWeeks: criteria.minimumWeeks,
            minimumAveragePoints: criteria.minimumAveragePoints,
            meetsEvidence,
            reviewPeriod,
            reviewOpen,
            ready: meetsEvidence && reviewOpen,
            weeks: completed.map((week) => week.weekId), topTags
        };
    }

    function assessmentFor(state, participantId, categoryId) {
        const participant = state.participants.find((item) => item.id === participantId);
        if (!participant) throw new ClassificationError("PARTICIPANT_NOT_FOUND", "El participante ya no existe.");
        const record = currentSeason(state)?.categoryClassifications?.[keyFor(participantId, categoryId)] || null;
        const evidence = evidenceFor(state, participantId, categoryId);
        let status = record?.status || (participant.categoryIds.includes(categoryId) ? "classified" : "observation");
        if (status === "ready" && !evidence.ready) status = "observation";
        if (status === "observation" && evidence.ready) status = "ready";
        return { participant, categoryId, status, confirmedBy: record?.confirmedBy || [], requestedStatus: record?.requestedStatus || null, evidence };
    }

    function categoryCandidates(state, categoryId, gender = "all") {
        return state.participants.filter((item) => item.archivedAt === null && (gender === "all" || item.gender === gender))
            .map((item) => assessmentFor(state, item.id, categoryId))
            .filter((item) => item.status === "classified"
                ? item.evidence.reviewOpen
                : item.evidence.weeksEvaluated > 0)
            .sort((left, right) => Number(right.evidence.ready) - Number(left.evidence.ready)
                || right.evidence.averagePoints - left.evidence.averagePoints
                || left.participant.name.localeCompare(right.participant.name, "es", { sensitivity: "base" }));
    }

    function updateCriteria(state, categoryId, input, timestamp = new Date().toISOString()) {
        if (!constants.CATEGORIES.some((category) => category.id === categoryId)) {
            throw new ClassificationError("INVALID_CATEGORY", "Selecciona una categoría válida.");
        }
        const minimumWeeks = Number(input.minimumWeeks);
        const minimumAveragePoints = Number(input.minimumAveragePoints);
        if (!Number.isInteger(minimumWeeks) || minimumWeeks < 1 || minimumWeeks > 52
            || !Number.isFinite(minimumAveragePoints) || minimumAveragePoints < 0 || minimumAveragePoints > 6) {
            throw new ClassificationError("INVALID_CRITERIA", "Usa de 1 a 52 semanas y un promedio entre 0 y 6 puntos.");
        }
        const next = cloneState(state);
        const season = currentSeason(next);
        if (!season) throw new ClassificationError("SEASON_NOT_FOUND", "No hay una temporada abierta.");
        season.classificationCriteria[categoryId] = { minimumWeeks, minimumAveragePoints };
        season.updatedAt = timestamp;
        const validation = data.validateState(next);
        if (!validation.valid) throw new ClassificationError("INVALID_STATE", validation.errors.join(" "));
        return next;
    }

    function reviewClassification(state, participantId, categoryId, voterId, action = "classified", timestamp = new Date().toISOString()) {
        if (!constants.VOTER_IDS.includes(voterId)) throw new ClassificationError("INVALID_VOTER", "El revisor debe ser P1 o P2.");
        if (!["classified", "paused"].includes(action)) throw new ClassificationError("INVALID_ACTION", "La acción de clasificación no es válida.");
        const assessed = assessmentFor(state, participantId, categoryId);
        if (assessed.participant.archivedAt !== null) throw new ClassificationError("PARTICIPANT_ARCHIVED", "Restaura al participante antes de clasificarlo.");
        if (action === "classified" && !assessed.evidence.ready) {
            throw new ClassificationError("EVIDENCE_INCOMPLETE", "Aún no cumple los criterios de semanas y promedio.");
        }
        if (!assessed.evidence.reviewOpen) throw new ClassificationError("REVIEW_CLOSED", "La revisión de clasificación abre al cierre de cada trimestre.");
        if (action === "paused" && assessed.status !== "classified") {
            throw new ClassificationError("NOT_CLASSIFIED", "Solo puedes pausar una categoría ya clasificada.");
        }
        const next = cloneState(state);
        const season = currentSeason(next);
        if (!season) throw new ClassificationError("SEASON_NOT_FOUND", "No hay una temporada abierta.");
        const key = keyFor(participantId, categoryId);
        const previous = season.categoryClassifications[key] || {};
        const reviewPeriod = assessed.evidence.reviewPeriod;
        const confirmedBy = previous.requestedStatus === action && previous.reviewPeriod === reviewPeriod
            ? [...previous.confirmedBy] : [];
        if (!confirmedBy.includes(voterId)) confirmedBy.push(voterId);
        const completed = constants.VOTER_IDS.every((id) => confirmedBy.includes(id));
        const participant = next.participants.find((item) => item.id === participantId);
        const status = completed ? action : (participant.categoryIds.includes(categoryId) ? "classified" : "ready");
        const periods = previous.periods ? [...previous.periods.map((period) => ({ ...period, weekIds: [...period.weekIds] }))] : [];
        if (completed && action === "classified") {
            // Qualification evidence remains in the weekly history; annual scoring begins at classification.
            periods.push({ weekIds: [] });
        }
        season.categoryClassifications[key] = {
            status, confirmedBy, requestedStatus: completed ? null : action,
            reviewPeriod, lastReviewedPeriod: completed ? reviewPeriod : previous.lastReviewedPeriod || null,
            periods,
            pausedAfterDate: completed && action === "paused"
                ? season.weekIds.map((id) => next.weeks.find((week) => week.id === id))
                    .filter((week) => week?.status === "CLOSED")
                    .sort((left, right) => left.endDate.localeCompare(right.endDate)).at(-1)?.endDate || null
                : completed && action === "classified" ? null : previous.pausedAfterDate || null,
            updatedAt: timestamp
        };
        if (completed && action === "classified" && !participant.categoryIds.includes(categoryId)) participant.categoryIds.push(categoryId);
        if (completed && action === "paused") participant.categoryIds = participant.categoryIds.filter((id) => id !== categoryId);
        participant.updatedAt = timestamp;
        season.updatedAt = timestamp;
        const validation = data.validateState(next);
        if (!validation.valid) throw new ClassificationError("INVALID_STATE", validation.errors.join(" "));
        return { state: next, completed, status };
    }

    namespace.classifications = Object.freeze({ ClassificationError, currentSeason, currentReviewPeriod, criteriaFor, evidenceFor, assessmentFor, categoryCandidates, updateCriteria, reviewClassification });
    root.StatsV2 = namespace;
})(globalThis);
