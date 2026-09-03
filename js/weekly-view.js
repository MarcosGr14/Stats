(function defineWeeklyView(root) {
    "use strict";

    const namespace = root.StatsV2 || {};
    const constants = namespace.constants;
    const weekly = namespace.weekly;
    if (!constants || !weekly) throw new Error("Stats V2 constants and weekly voting must load before the weekly view.");

    function byId(id) { return document.getElementById(id); }
    function createElement(tagName, className = "", text = "") {
        const element = document.createElement(tagName);
        if (className) element.className = className;
        if (text !== "") element.textContent = text;
        return element;
    }
    function categoryLabel(categoryId) {
        return constants.CATEGORIES.find((category) => category.id === categoryId)?.label || categoryId;
    }
    function ratingLabel(ratingId) {
        return constants.RATING_OPTIONS.find((rating) => rating.id === ratingId)?.label || "Sin evaluar";
    }

    function createController(options) {
        const state = options.getState;
        const commitState = options.commitState;
        const canWrite = options.canWrite;
        const notify = options.notify;
        const viewParticipant = options.viewParticipant;
        const elements = {
            weekSelect: byId("weekly-week-select"), openWeek: byId("open-current-week"),
            closeWeek: byId("close-current-week"), reopenWeek: byId("reopen-current-week"),
            status: byId("weekly-status"), empty: byId("weekly-empty"), workspace: byId("weekly-workspace"),
            periodTitle: byId("weekly-period-title"), weekRange: byId("weekly-week-range"),
            userSwitch: byId("weekly-user-switch"), voterClarity: byId("weekly-voter-clarity"),
            evaluatedCount: byId("weekly-evaluated-count"), standoutCount: byId("weekly-standout-count"),
            standoutRemaining: byId("weekly-standout-remaining"), standoutProgress: byId("weekly-standout-progress"),
            search: byId("weekly-search"), categoryFilter: byId("weekly-category-filter"),
            genderFilter: byId("weekly-gender-filter"), groupFilter: byId("weekly-group-filter"),
            evaluationFilter: byId("weekly-evaluation-filter"), resetFilters: byId("reset-weekly-filters"),
            resultsSummary: byId("weekly-results-summary"), readonlyCopy: byId("weekly-readonly-copy"),
            grid: byId("weekly-grid"), noResults: byId("weekly-no-results"),
            legacyWarning: byId("weekly-legacy-warning"), legacyWarningCopy: byId("weekly-legacy-warning-copy"),
            voteDialog: byId("weekly-vote-dialog"), voteForm: byId("weekly-vote-form"),
            voteKicker: byId("weekly-vote-kicker"), voteTitle: byId("weekly-vote-title"),
            voteIdentity: byId("weekly-vote-identity"), voteError: byId("weekly-vote-error"),
            categoryTabs: byId("weekly-category-tabs"), ratingCategory: byId("weekly-rating-category"),
            ratingOptions: [...document.querySelectorAll("[data-weekly-rating]")],
            selectedReasons: byId("weekly-selected-reasons"), reasonCount: byId("weekly-reason-count"),
            reasonSearch: byId("weekly-reason-search"), reasonList: byId("weekly-reason-list"),
            note: byId("weekly-note"), noteCount: byId("weekly-note-count"),
            removeVote: byId("remove-weekly-vote"), saveVote: byId("save-weekly-vote"),
            closeVote: byId("close-weekly-vote"), cancelVote: byId("cancel-weekly-vote"),
            legacyConversion: byId("weekly-legacy-conversion"), legacyConversionCopy: byId("weekly-legacy-conversion-copy"),
            assignLegacyCategory: byId("assign-legacy-category"),
            closeDialog: byId("close-week-dialog"), closeDialogTitle: byId("close-week-dialog-title"),
            closeDialogMessage: byId("close-week-dialog-message"), cancelCloseWeek: byId("cancel-close-week"),
            confirmCloseWeek: byId("confirm-close-week"),
            reopenDialog: byId("reopen-week-dialog"), reopenDialogTitle: byId("reopen-week-dialog-title"),
            reopenDialogMessage: byId("reopen-week-dialog-message"), cancelReopenWeek: byId("cancel-reopen-week"),
            confirmReopenWeek: byId("confirm-reopen-week")
        };

        let selectedWeekId = null;
        let activeUserId = constants.VOTER_IDS[0];
        let editingParticipantId = null;
        let editingCategoryId = null;
        let selectedRating = null;
        let selectedReasonIds = new Set();
        let returnFocusElement = null;

        function currentWeek() { return state().weeks.find((week) => week.id === selectedWeekId) || null; }
        function currentVoter() {
            return state().settings.voters.find((voter) => voter.id === activeUserId) || { id: activeUserId, name: activeUserId.toUpperCase() };
        }
        function groupName(groupId) {
            return groupId ? state().groups.find((group) => group.id === groupId)?.name || "Grupo desconocido" : "Solista";
        }
        function ensureSelection() {
            const weeks = [...state().weeks].sort((left, right) => right.id.localeCompare(left.id));
            if (!selectedWeekId || !weeks.some((week) => week.id === selectedWeekId)) {
                selectedWeekId = state().settings.activeWeekId || weeks[0]?.id || null;
            }
            if (!state().settings.voters.some((voter) => voter.id === activeUserId)) activeUserId = constants.VOTER_IDS[0];
        }
        function renderWeekSelect() {
            const weeks = [...state().weeks].sort((left, right) => right.id.localeCompare(left.id));
            const fragment = document.createDocumentFragment();
            if (weeks.length === 0) fragment.append(createElement("option", "", "Aún no hay semanas"));
            weeks.forEach((week) => {
                const option = createElement("option", "", `${week.label} · ${week.status === "OPEN" ? "ABIERTA" : "CERRADA"}`);
                option.value = week.id;
                option.selected = week.id === selectedWeekId;
                fragment.append(option);
            });
            elements.weekSelect.replaceChildren(fragment);
            elements.weekSelect.disabled = weeks.length === 0;
        }
        function renderGroupOptions() {
            const current = elements.groupFilter.value || "all";
            const fragment = document.createDocumentFragment();
            const all = createElement("option", "", "Todos"); all.value = "all"; fragment.append(all);
            const solo = createElement("option", "", "Solistas"); solo.value = "soloist"; fragment.append(solo);
            [...state().groups].sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" })).forEach((group) => {
                const option = createElement("option", "", group.name); option.value = group.id; fragment.append(option);
            });
            elements.groupFilter.replaceChildren(fragment);
            elements.groupFilter.value = [...elements.groupFilter.options].some((option) => option.value === current) ? current : "all";
        }
        function renderUserSwitch() {
            const fragment = document.createDocumentFragment();
            state().settings.voters.forEach((voter) => {
                const button = createElement("button", "weekly-user-button");
                button.type = "button"; button.dataset.weeklyUserId = voter.id;
                button.setAttribute("aria-pressed", String(voter.id === activeUserId));
                button.append(createElement("span", "", voter.id.toUpperCase()), createElement("strong", "", voter.name));
                fragment.append(button);
            });
            elements.userSwitch.replaceChildren(fragment);
            elements.voterClarity.textContent = `Editando solo los votos de ${currentVoter().name} (${activeUserId.toUpperCase()}).`;
        }
        function createCategoryBadge(categoryId) {
            return createElement("span", `category-badge category-badge--${categoryId}`, categoryLabel(categoryId));
        }
        function createCategorySummary(participant, categoryId, week) {
            const vote = weekly.findVote(state(), week.id, participant.id, categoryId, activeUserId);
            const metrics = weekly.deriveCategoryWeeklyMetrics(state(), week.id, participant.id, categoryId);
            const row = createElement("div", "weekly-category-summary");
            const identity = createElement("div", "weekly-category-summary__identity");
            identity.append(createCategoryBadge(categoryId), createElement("span", `weekly-state weekly-state--${vote?.rating || "none"}`, ratingLabel(vote?.rating)));
            const points = createElement("span", "weekly-category-points", metrics.votesCount ? `${metrics.weeklyPoints} pts · ${metrics.votersCount}/2` : "Sin puntaje");
            row.append(identity, points);
            return row;
        }
        function createVoteCard(participant, week) {
            const card = createElement("article", "weekly-card");
            const heading = createElement("div", "weekly-card-heading");
            const identity = createElement("div");
            identity.append(createElement("h2", "", participant.name), createElement("p", "", groupName(participant.groupId)));
            const legacy = weekly.findLegacyVote(state(), week.id, participant.id, activeUserId);
            if (legacy) heading.append(identity, createElement("span", "weekly-state weekly-state--legacy", "Voto anterior"));
            else heading.append(identity);
            const summaries = createElement("div", "weekly-category-summaries");
            participant.categoryIds.forEach((categoryId) => summaries.append(createCategorySummary(participant, categoryId, week)));
            const footer = createElement("div", "weekly-card-footer");
            footer.append(createElement("p", "weekly-card-reasons", legacy ? "Asigna el voto anterior a la categoría correcta." : "Cada categoría se evalúa por separado."));
            const actions = createElement("div", "weekly-card-actions");
            const profileAction = createElement("button", "button button--quiet", "Ver perfil");
            profileAction.type = "button"; profileAction.dataset.weeklyProfileId = participant.id;
            actions.append(profileAction);
            if (week.status === "OPEN") {
                const action = createElement("button", "button button--primary", "Evaluar categorías");
                action.type = "button"; action.dataset.weeklyParticipantId = participant.id; action.disabled = !canWrite();
                actions.append(action);
            } else actions.append(createElement("span", "weekly-readonly-badge", "Solo consulta"));
            footer.append(actions);
            card.append(heading, summaries, footer);
            return card;
        }
        function currentFilters() {
            return { query: elements.search.value, categoryId: elements.categoryFilter.value,
                gender: elements.genderFilter.value, groupId: elements.groupFilter.value,
                evaluation: elements.evaluationFilter.value };
        }
        function renderCards(week) {
            const participants = weekly.filterWeeklyParticipants(state(), week.id, activeUserId, currentFilters());
            const fragment = document.createDocumentFragment();
            participants.forEach((participant) => fragment.append(createVoteCard(participant, week)));
            elements.grid.replaceChildren(fragment);
            elements.resultsSummary.textContent = `${participants.length} participante${participants.length === 1 ? "" : "s"}`;
            elements.noResults.hidden = participants.length > 0;
        }
        function renderProgress(week) {
            const progress = weekly.weeklyProgress(state(), week.id, activeUserId);
            elements.evaluatedCount.textContent = progress.evaluatedCount;
            elements.standoutCount.textContent = `${progress.standoutsUsed} / ${constants.MAX_WEEKLY_STANDOUTS}`;
            elements.standoutRemaining.textContent = progress.standoutsRemaining;
            elements.standoutProgress.dataset.limitReached = String(progress.standoutLimitReached);
            elements.standoutProgress.setAttribute("aria-label", `${progress.standoutsUsed} de ${constants.MAX_WEEKLY_STANDOUTS} destacados usados en todas las categorías`);
        }
        function renderLegacyWarning(week) {
            const legacyCount = state().weeklyVotes.filter((vote) => vote.weekId === week.id && vote.legacyUncategorized === true).length;
            elements.legacyWarning.hidden = legacyCount === 0;
            elements.legacyWarningCopy.textContent = legacyCount === 0 ? "" : `${legacyCount} voto${legacyCount === 1 ? "" : "s"} anterior${legacyCount === 1 ? "" : "es"}. Reabre la semana si hace falta y asígnalos manualmente.`;
        }
        function render() {
            if (state()?.meta?.weeklyVotingVersion !== 2) {
                selectedWeekId = null;
                elements.weekSelect.replaceChildren(createElement("option", "", "Votación semanal no disponible"));
                elements.weekSelect.disabled = true; elements.openWeek.disabled = true;
                elements.closeWeek.hidden = true; elements.reopenWeek.hidden = true;
                elements.empty.hidden = false; elements.workspace.hidden = true;
                elements.status.textContent = "Unavailable"; elements.status.dataset.state = "none";
                return;
            }
            ensureSelection(); renderWeekSelect(); renderGroupOptions();
            const week = currentWeek();
            elements.empty.hidden = Boolean(week); elements.workspace.hidden = !week; elements.openWeek.disabled = !canWrite();
            if (!week) {
                elements.status.textContent = "Sin semana"; elements.status.dataset.state = "none";
                elements.closeWeek.hidden = true; elements.reopenWeek.hidden = true; return;
            }
            elements.status.textContent = week.status === "OPEN" ? "ABIERTA" : "CERRADA"; elements.status.dataset.state = week.status.toLocaleLowerCase("en");
            elements.periodTitle.textContent = `${week.label} · ${week.id}`;
            elements.weekRange.textContent = `${weekly.formatWeekRange(week)} · lunes-domingo`;
            elements.closeWeek.hidden = week.status !== "OPEN"; elements.closeWeek.disabled = !canWrite();
            elements.reopenWeek.hidden = week.status !== "CLOSED"; elements.reopenWeek.disabled = !canWrite();
            elements.readonlyCopy.textContent = week.status === "OPEN" ? "ABIERTA · Puedes editar los votos" : "CERRADA · Resultados oficiales";
            renderUserSwitch(); renderProgress(week); renderLegacyWarning(week); renderCards(week);
        }

        function showVoteError(message = "") { elements.voteError.textContent = message; elements.voteError.hidden = !message; }
        function syncRatingButtons() {
            elements.ratingOptions.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.weeklyRating === selectedRating)));
        }
        function renderSelectedReasons() {
            const fragment = document.createDocumentFragment();
            [...selectedReasonIds].forEach((tagId) => {
                const tag = state().tags.find((item) => item.id === tagId); if (!tag) return;
                const chip = createElement("button", "weekly-selected-reason", `${tag.name} ×`);
                chip.type = "button"; chip.dataset.weeklyRemoveReason = tag.id;
                chip.setAttribute("aria-label", `Quitar motivo semanal ${tag.name}`); fragment.append(chip);
            });
            elements.selectedReasons.replaceChildren(fragment);
            elements.reasonCount.textContent = `${selectedReasonIds.size} / ${constants.MAX_WEEKLY_REASON_TAGS}`;
        }
        function reasonPriority(tag) {
            if (tag.categoryId === editingCategoryId) return 0;
            if (tag.categoryId === "general") return 1;
            return 2;
        }
        function renderReasonList() {
            const query = elements.reasonSearch.value.trim().toLocaleLowerCase("es");
            const matching = [...state().tags]
                .filter((tag) => !query || tag.name.toLocaleLowerCase("es").includes(query))
                .sort((left, right) => reasonPriority(left) - reasonPriority(right)
                    || left.name.localeCompare(right.name, "es", { sensitivity: "base" })).slice(0, 24);
            const fragment = document.createDocumentFragment();
            matching.forEach((tag) => {
                const button = createElement("button", "weekly-reason-option", tag.name);
                button.type = "button"; button.dataset.weeklyReasonId = tag.id;
                button.setAttribute("aria-pressed", String(selectedReasonIds.has(tag.id)));
                button.append(createElement("small", "", tag.categoryId === "general" ? "General" : categoryLabel(tag.categoryId))); fragment.append(button);
            });
            if (!matching.length) fragment.append(createElement("p", "weekly-reason-empty", "No hay motivos con esta búsqueda."));
            elements.reasonList.replaceChildren(fragment);
        }
        function renderCategoryTabs(participant) {
            const fragment = document.createDocumentFragment();
            participant.categoryIds.forEach((categoryId) => {
                const vote = weekly.findVote(state(), currentWeek().id, participant.id, categoryId, activeUserId);
                const button = createElement("button", "weekly-category-tab");
                button.type = "button"; button.role = "tab"; button.dataset.weeklyCategoryId = categoryId;
                button.setAttribute("aria-selected", String(categoryId === editingCategoryId));
                button.append(createElement("strong", "", categoryLabel(categoryId)), createElement("span", "", ratingLabel(vote?.rating)));
                fragment.append(button);
            });
            elements.categoryTabs.replaceChildren(fragment);
        }
        function renderLegacyConversion(participant) {
            const legacy = weekly.findLegacyVote(state(), currentWeek().id, participant.id, activeUserId);
            elements.legacyConversion.hidden = !legacy;
            if (!legacy) return;
            const hasCategoryVote = Boolean(weekly.findVote(state(), currentWeek().id, participant.id, editingCategoryId, activeUserId));
            elements.legacyConversionCopy.textContent = `${ratingLabel(legacy.rating)} · ${legacy.note || "Sin nota"}. Asígnalo a ${categoryLabel(editingCategoryId)}.`;
            elements.assignLegacyCategory.disabled = hasCategoryVote;
            elements.assignLegacyCategory.textContent = hasCategoryVote ? "Categoría ya evaluada" : `Asignar a ${categoryLabel(editingCategoryId)}`;
        }
        function loadCategory(categoryId) {
            const participant = state().participants.find((item) => item.id === editingParticipantId);
            if (!participant || !participant.categoryIds.includes(categoryId)) return;
            editingCategoryId = categoryId;
            const existing = weekly.findVote(state(), currentWeek().id, participant.id, categoryId, activeUserId);
            selectedRating = existing?.rating || null; selectedReasonIds = new Set(existing?.reasonTagIds || []);
            elements.note.value = existing?.note || ""; elements.noteCount.textContent = elements.note.value.length;
            elements.removeVote.hidden = !existing; elements.saveVote.textContent = existing ? "Guardar cambios" : "Guardar evaluación";
            elements.ratingCategory.textContent = categoryLabel(categoryId);
            elements.reasonSearch.value = ""; showVoteError(); syncRatingButtons();
            renderCategoryTabs(participant); renderLegacyConversion(participant); renderSelectedReasons(); renderReasonList();
        }
        function openVoteDialog(participantId, trigger) {
            const week = currentWeek();
            if (!week || week.status !== "OPEN" || !canWrite()) return;
            const participant = state().participants.find((item) => item.id === participantId);
            if (!participant || participant.archivedAt !== null) return;
            editingParticipantId = participantId;
            const filteredCategory = elements.categoryFilter.value;
            editingCategoryId = participant.categoryIds.includes(filteredCategory) ? filteredCategory : participant.categoryIds[0];
            returnFocusElement = trigger || document.activeElement;
            elements.voteKicker.textContent = `${week.label} · Votando como ${currentVoter().name} (${activeUserId.toUpperCase()})`;
            elements.voteTitle.textContent = `Evaluar a ${participant.name}`;
            elements.voteIdentity.textContent = `${groupName(participant.groupId)} · Guarda cada categoría por separado`;
            loadCategory(editingCategoryId); elements.voteDialog.showModal();
            (elements.ratingOptions.find((button) => button.dataset.weeklyRating === selectedRating) || elements.categoryTabs.querySelector("button"))?.focus();
        }
        function closeVoteDialog() {
            if (elements.voteDialog.open) elements.voteDialog.close();
            editingParticipantId = null; editingCategoryId = null; selectedRating = null; selectedReasonIds = new Set(); showVoteError();
            if (returnFocusElement?.isConnected) returnFocusElement.focus(); returnFocusElement = null;
        }
        function submitVote(event) {
            event.preventDefault(); const week = currentWeek();
            if (!week || !editingParticipantId || !editingCategoryId) return;
            if (!selectedRating) { showVoteError("Selecciona una valoración. Sin evaluar significa que no hay un voto guardado."); return; }
            try {
                const result = weekly.upsertVote(state(), {
                    weekId: week.id, participantId: editingParticipantId, categoryId: editingCategoryId,
                    userId: activeUserId, rating: selectedRating,
                    reasonTagIds: [...selectedReasonIds], note: elements.note.value
                });
                const participantName = state().participants.find((participant) => participant.id === editingParticipantId)?.name;
                commitState(result.state); loadCategory(editingCategoryId);
                notify(`${participantName} · ${categoryLabel(editingCategoryId)}: ${ratingLabel(result.vote.rating)} guardado.`);
            } catch (error) { showVoteError(error.message); }
        }
        function removeEvaluation() {
            const week = currentWeek(); if (!week || !editingParticipantId || !editingCategoryId) return;
            try {
                const result = weekly.removeVote(state(), week.id, editingParticipantId, editingCategoryId, activeUserId);
                commitState(result.state); loadCategory(editingCategoryId);
                notify(`${categoryLabel(editingCategoryId)} quedó sin evaluar para ${currentVoter().name}.`);
            } catch (error) { showVoteError(error.message); }
        }
        function assignLegacyCategory() {
            const legacy = weekly.findLegacyVote(state(), currentWeek().id, editingParticipantId, activeUserId);
            if (!legacy) return;
            try {
                const result = weekly.assignLegacyVoteCategory(state(), legacy.id, editingCategoryId);
                commitState(result.state); loadCategory(editingCategoryId);
                notify(`Voto anterior asignado a ${categoryLabel(editingCategoryId)}. Se conservaron sus datos.`);
            } catch (error) { showVoteError(error.message); }
        }

        function openCurrentWeek() {
            if (!canWrite()) return;
            try {
                const result = weekly.openCurrentIsoWeek(state()); selectedWeekId = result.week.id;
                if (result.created || state().settings.activeWeekId !== result.week.id) commitState(result.state); else render();
                notify(result.created ? `${result.week.label} abierta para votar.` : `${result.week.label} seleccionada.`);
            } catch (error) { notify(error.message, "error"); }
        }
        function openCloseDialog() {
            const week = currentWeek(); if (!week || week.status !== "OPEN") return;
            returnFocusElement = elements.closeWeek; elements.closeDialogTitle.textContent = `¿Cerrar ${week.label}?`;
            elements.closeDialogMessage.textContent = "La semana quedará en modo de consulta. Se conservarán todos los votos.";
            elements.closeDialog.showModal(); elements.cancelCloseWeek.focus();
        }
        function closeCloseDialog() { if (elements.closeDialog.open) elements.closeDialog.close(); if (returnFocusElement?.isConnected) returnFocusElement.focus(); returnFocusElement = null; }
        function confirmCloseWeek() {
            const week = currentWeek(); if (!week) return;
            try { const result = weekly.closeWeek(state(), week.id); commitState(result.state); closeCloseDialog(); notify(`${week.label} cerrada. Los resultados ya son oficiales.`); }
            catch (error) { closeCloseDialog(); notify(error.message, "error"); }
        }
        function openReopenDialog() {
            const week = currentWeek(); if (!week || week.status !== "CLOSED") return;
            returnFocusElement = elements.reopenWeek; elements.reopenDialogTitle.textContent = `¿Reabrir ${week.label}?`;
            elements.reopenDialogMessage.textContent = "Podrás volver a editar los votos. El historial se conservará.";
            elements.reopenDialog.showModal(); elements.cancelReopenWeek.focus();
        }
        function closeReopenDialog() { if (elements.reopenDialog.open) elements.reopenDialog.close(); if (returnFocusElement?.isConnected) returnFocusElement.focus(); returnFocusElement = null; }
        function confirmReopenWeek() {
            const week = currentWeek(); if (!week) return;
            try { const result = weekly.reopenWeek(state(), week.id); commitState(result.state); closeReopenDialog(); notify(`${week.label} reabierta. Ya puedes editar los votos.`); }
            catch (error) { closeReopenDialog(); notify(error.message, "error"); }
        }
        function resetFilters() {
            elements.search.value = ""; elements.categoryFilter.value = "all"; elements.genderFilter.value = "all";
            elements.groupFilter.value = "all"; elements.evaluationFilter.value = "all"; render();
        }
        function bindEvents() {
            elements.weekSelect.addEventListener("change", () => { selectedWeekId = elements.weekSelect.value || null; render(); });
            elements.openWeek.addEventListener("click", openCurrentWeek);
            elements.closeWeek.addEventListener("click", openCloseDialog);
            elements.reopenWeek.addEventListener("click", openReopenDialog);
            elements.userSwitch.addEventListener("click", (event) => {
                const button = event.target.closest("button[data-weekly-user-id]"); if (!button) return;
                activeUserId = button.dataset.weeklyUserId; render();
            });
            elements.search.addEventListener("input", render);
            [elements.categoryFilter, elements.genderFilter, elements.groupFilter, elements.evaluationFilter]
                .forEach((control) => control.addEventListener("change", render));
            elements.resetFilters.addEventListener("click", resetFilters);
            elements.grid.addEventListener("click", (event) => {
                const profileButton = event.target.closest("button[data-weekly-profile-id]");
                if (profileButton) {
                    viewParticipant(profileButton.dataset.weeklyProfileId);
                    return;
                }
                const button = event.target.closest("button[data-weekly-participant-id]");
                if (button) openVoteDialog(button.dataset.weeklyParticipantId, button);
            });
            elements.categoryTabs.addEventListener("click", (event) => {
                const button = event.target.closest("button[data-weekly-category-id]");
                if (button) loadCategory(button.dataset.weeklyCategoryId);
            });
            elements.ratingOptions.forEach((button) => button.addEventListener("click", () => {
                selectedRating = button.dataset.weeklyRating; showVoteError(); syncRatingButtons();
            }));
            elements.reasonSearch.addEventListener("input", renderReasonList);
            elements.reasonList.addEventListener("click", (event) => {
                const button = event.target.closest("button[data-weekly-reason-id]"); if (!button) return;
                const tagId = button.dataset.weeklyReasonId;
                if (selectedReasonIds.has(tagId)) selectedReasonIds.delete(tagId);
                else if (selectedReasonIds.size >= constants.MAX_WEEKLY_REASON_TAGS) { showVoteError(`Elige hasta ${constants.MAX_WEEKLY_REASON_TAGS} motivos semanales.`); return; }
                else selectedReasonIds.add(tagId);
                showVoteError(); renderSelectedReasons(); renderReasonList();
            });
            elements.selectedReasons.addEventListener("click", (event) => {
                const button = event.target.closest("button[data-weekly-remove-reason]"); if (!button) return;
                selectedReasonIds.delete(button.dataset.weeklyRemoveReason); renderSelectedReasons(); renderReasonList();
            });
            elements.note.addEventListener("input", () => { elements.noteCount.textContent = elements.note.value.length; });
            elements.voteForm.addEventListener("submit", submitVote);
            elements.removeVote.addEventListener("click", removeEvaluation);
            elements.assignLegacyCategory.addEventListener("click", assignLegacyCategory);
            elements.closeVote.addEventListener("click", closeVoteDialog); elements.cancelVote.addEventListener("click", closeVoteDialog);
            elements.voteDialog.addEventListener("cancel", (event) => { event.preventDefault(); closeVoteDialog(); });
            elements.voteDialog.addEventListener("click", (event) => { if (event.target === elements.voteDialog) closeVoteDialog(); });
            elements.cancelCloseWeek.addEventListener("click", closeCloseDialog); elements.confirmCloseWeek.addEventListener("click", confirmCloseWeek);
            elements.closeDialog.addEventListener("cancel", (event) => { event.preventDefault(); closeCloseDialog(); });
            elements.closeDialog.addEventListener("click", (event) => { if (event.target === elements.closeDialog) closeCloseDialog(); });
            elements.cancelReopenWeek.addEventListener("click", closeReopenDialog); elements.confirmReopenWeek.addEventListener("click", confirmReopenWeek);
            elements.reopenDialog.addEventListener("cancel", (event) => { event.preventDefault(); closeReopenDialog(); });
            elements.reopenDialog.addEventListener("click", (event) => { if (event.target === elements.reopenDialog) closeReopenDialog(); });
        }
        bindEvents();
        return Object.freeze({ render, activate: render });
    }

    namespace.weeklyView = Object.freeze({ createController });
    root.StatsV2 = namespace;
})(globalThis);
