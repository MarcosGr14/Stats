(function defineWeeklyView(root) {
    "use strict";

    const namespace = root.StatsV2 || {};
    const constants = namespace.constants;
    const weekly = namespace.weekly;

    if (!constants || !weekly) {
        throw new Error("Stats V2 constants and weekly domain must load before the weekly view.");
    }

    function createController(options) {
        const getState = options.getState;
        const commitState = options.commitState;
        const canWrite = options.canWrite;
        const notify = options.notify;
        let selectedWeekId = null;
        let activeUserId = "p1";
        let editingParticipantId = null;
        let selectedRating = null;
        let selectedReasonIds = new Set();
        let returnFocusElement = null;

        const byId = (id) => document.getElementById(id);
        const elements = {
            view: byId("weekly"),
            status: byId("weekly-status"),
            weekSelect: byId("weekly-week-select"),
            openWeek: byId("open-current-week"),
            closeWeek: byId("close-current-week"),
            empty: byId("weekly-empty"),
            workspace: byId("weekly-workspace"),
            periodTitle: byId("weekly-period-title"),
            weekRange: byId("weekly-week-range"),
            userSwitch: byId("weekly-user-switch"),
            voterClarity: byId("weekly-voter-clarity"),
            evaluatedCount: byId("weekly-evaluated-count"),
            standoutProgress: byId("weekly-standout-progress"),
            standoutCount: byId("weekly-standout-count"),
            standoutRemaining: byId("weekly-standout-remaining"),
            search: byId("weekly-search"),
            categoryFilter: byId("weekly-category-filter"),
            genderFilter: byId("weekly-gender-filter"),
            groupFilter: byId("weekly-group-filter"),
            evaluationFilter: byId("weekly-evaluation-filter"),
            resetFilters: byId("reset-weekly-filters"),
            resultsSummary: byId("weekly-results-summary"),
            readonlyCopy: byId("weekly-readonly-copy"),
            grid: byId("weekly-grid"),
            noResults: byId("weekly-no-results"),
            voteDialog: byId("weekly-vote-dialog"),
            voteForm: byId("weekly-vote-form"),
            voteKicker: byId("weekly-vote-kicker"),
            voteTitle: byId("weekly-vote-title"),
            voteIdentity: byId("weekly-vote-identity"),
            closeVote: byId("close-weekly-vote"),
            cancelVote: byId("cancel-weekly-vote"),
            saveVote: byId("save-weekly-vote"),
            removeVote: byId("remove-weekly-vote"),
            voteError: byId("weekly-vote-error"),
            ratingOptions: [...document.querySelectorAll("[data-weekly-rating]")],
            selectedReasons: byId("weekly-selected-reasons"),
            reasonCount: byId("weekly-reason-count"),
            reasonSearch: byId("weekly-reason-search"),
            reasonList: byId("weekly-reason-list"),
            note: byId("weekly-note"),
            noteCount: byId("weekly-note-count"),
            closeDialog: byId("close-week-dialog"),
            closeDialogTitle: byId("close-week-dialog-title"),
            closeDialogMessage: byId("close-week-dialog-message"),
            cancelCloseWeek: byId("cancel-close-week"),
            confirmCloseWeek: byId("confirm-close-week")
        };

        function createElement(tag, className, text) {
            const element = document.createElement(tag);
            if (className) element.className = className;
            if (text !== undefined) element.textContent = String(text);
            return element;
        }

        function state() {
            return getState();
        }

        function currentWeek() {
            return state().weeks.find((week) => week.id === selectedWeekId) || null;
        }

        function currentVoter() {
            return state().settings.voters.find((voter) => voter.id === activeUserId)
                || state().settings.voters[0];
        }

        function groupName(groupId) {
            if (!groupId) return "Soloist / No group";
            return state().groups.find((group) => group.id === groupId)?.name || "Unknown group";
        }

        function ratingLabel(ratingId) {
            return constants.RATING_OPTIONS.find((rating) => rating.id === ratingId)?.label || "Not evaluated";
        }

        function ratingClass(ratingId) {
            return ratingId ? `weekly-state weekly-state--${ratingId}` : "weekly-state weekly-state--none";
        }

        function sortedWeeks() {
            return [...state().weeks].sort((left, right) => right.startDate.localeCompare(left.startDate));
        }

        function ensureSelection() {
            const weeks = sortedWeeks();
            if (weeks.length === 0) {
                selectedWeekId = null;
                return;
            }
            if (!weeks.some((week) => week.id === selectedWeekId)) {
                selectedWeekId = state().settings.activeWeekId || weeks[0].id;
            }
            if (!state().settings.voters.some((voter) => voter.id === activeUserId)) {
                activeUserId = "p1";
            }
        }

        function renderWeekSelect() {
            const fragment = document.createDocumentFragment();
            const weeks = sortedWeeks();
            if (weeks.length === 0) {
                const option = createElement("option", "", "No weeks yet");
                option.value = "";
                fragment.append(option);
            } else {
                weeks.forEach((week) => {
                    const option = createElement("option", "", `${week.label} · ${weekly.formatWeekRange(week)} · ${week.status}`);
                    option.value = week.id;
                    fragment.append(option);
                });
            }
            elements.weekSelect.replaceChildren(fragment);
            elements.weekSelect.value = selectedWeekId || "";
            elements.weekSelect.disabled = weeks.length === 0;
        }

        function renderGroupOptions() {
            const selected = elements.groupFilter.value || "all";
            const fragment = document.createDocumentFragment();
            const all = createElement("option", "", "All groups");
            all.value = "all";
            const soloist = createElement("option", "", "Soloist / No group");
            soloist.value = "soloist";
            fragment.append(all, soloist);
            [...state().groups]
                .sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" }))
                .forEach((group) => {
                    const option = createElement("option", "", group.name);
                    option.value = group.id;
                    fragment.append(option);
                });
            elements.groupFilter.replaceChildren(fragment);
            elements.groupFilter.value = selected === "soloist" || state().groups.some((group) => group.id === selected)
                ? selected
                : "all";
        }

        function renderUserSwitch() {
            const fragment = document.createDocumentFragment();
            state().settings.voters.forEach((voter) => {
                const button = createElement("button", "weekly-user-button", voter.name);
                button.type = "button";
                button.dataset.weeklyUserId = voter.id;
                button.setAttribute("aria-pressed", String(voter.id === activeUserId));
                button.setAttribute("aria-label", `Vote as ${voter.name}, ${voter.id.toUpperCase()}`);
                const badge = createElement("span", "", voter.id.toUpperCase());
                button.prepend(badge);
                fragment.append(button);
            });
            elements.userSwitch.replaceChildren(fragment);
            const voter = currentVoter();
            elements.voterClarity.textContent = voter ? `Current vote owner: ${voter.name} (${voter.id.toUpperCase()})` : "";
        }

        function createCategoryBadge(categoryId) {
            const category = constants.CATEGORIES.find((item) => item.id === categoryId);
            return createElement("span", `category-badge category-badge--${categoryId}`, category?.label || categoryId);
        }

        function createVoteCard(participant, week) {
            const activeVote = weekly.findVote(state(), week.id, participant.id, activeUserId);
            const metrics = weekly.deriveParticipantWeeklyMetrics(state(), week.id, participant.id);
            const card = createElement("article", "weekly-card");
            card.dataset.participantId = participant.id;

            const heading = createElement("div", "weekly-card-heading");
            const identity = createElement("div");
            identity.append(
                createElement("h2", "", participant.name),
                createElement("p", "", groupName(participant.groupId))
            );
            const voteState = createElement("span", ratingClass(activeVote?.rating), activeVote ? ratingLabel(activeVote.rating) : "Not evaluated");
            heading.append(identity, voteState);

            const categories = createElement("div", "category-badges");
            participant.categoryIds.forEach((categoryId) => categories.append(createCategoryBadge(categoryId)));

            const metricsRow = createElement("div", "weekly-card-metrics");
            const points = metrics.votesCount > 0 ? `${metrics.weeklyPoints} pts` : "No score";
            metricsRow.append(
                createElement("p", "", points),
                createElement("p", "", `${metrics.votersCount}/2 voters`),
                createElement("p", "", `${metrics.standoutCount} standout${metrics.standoutCount === 1 ? "" : "s"}`)
            );
            if (metrics.provisional) metricsRow.append(createElement("span", "weekly-provisional", "Provisional"));

            const footer = createElement("div", "weekly-card-footer");
            if (activeVote?.reasonTagIds.length) {
                const reasons = activeVote.reasonTagIds
                    .map((tagId) => state().tags.find((tag) => tag.id === tagId)?.name)
                    .filter(Boolean)
                    .join(" · ");
                footer.append(createElement("p", "weekly-card-reasons", reasons));
            } else {
                footer.append(createElement("p", "weekly-card-reasons", activeVote ? "No weekly reasons" : "No evaluation from this user"));
            }
            if (week.status === "OPEN") {
                const action = createElement("button", activeVote ? "button button--secondary" : "button button--primary", activeVote ? "Edit vote" : "Vote");
                action.type = "button";
                action.dataset.weeklyParticipantId = participant.id;
                action.disabled = !canWrite();
                footer.append(action);
            } else {
                footer.append(createElement("span", "weekly-readonly-badge", "Read-only"));
            }
            card.append(heading, categories, metricsRow, footer);
            return card;
        }

        function currentFilters() {
            return {
                query: elements.search.value,
                categoryId: elements.categoryFilter.value,
                gender: elements.genderFilter.value,
                groupId: elements.groupFilter.value,
                evaluation: elements.evaluationFilter.value
            };
        }

        function renderCards(week) {
            const participants = weekly.filterWeeklyParticipants(state(), week.id, activeUserId, currentFilters());
            const fragment = document.createDocumentFragment();
            participants.forEach((participant) => fragment.append(createVoteCard(participant, week)));
            elements.grid.replaceChildren(fragment);
            elements.resultsSummary.textContent = `${participants.length} performer${participants.length === 1 ? "" : "s"}`;
            elements.noResults.hidden = participants.length > 0;
        }

        function renderProgress(week) {
            const progress = weekly.weeklyProgress(state(), week.id, activeUserId);
            elements.evaluatedCount.textContent = progress.evaluatedCount;
            elements.standoutCount.textContent = `${progress.standoutsUsed} / ${constants.MAX_WEEKLY_STANDOUTS}`;
            elements.standoutRemaining.textContent = progress.standoutsRemaining;
            elements.standoutProgress.dataset.limitReached = String(progress.standoutLimitReached);
            elements.standoutProgress.setAttribute(
                "aria-label",
                progress.standoutLimitReached
                    ? `Standout limit reached: ${progress.standoutsUsed} of ${constants.MAX_WEEKLY_STANDOUTS}`
                    : `${progress.standoutsUsed} of ${constants.MAX_WEEKLY_STANDOUTS} Standouts used`
            );
        }

        function render() {
            if (state()?.meta?.weeklyVotingVersion !== 1) {
                selectedWeekId = null;
                elements.weekSelect.replaceChildren(createElement("option", "", "Weekly Voting unavailable"));
                elements.weekSelect.disabled = true;
                elements.openWeek.disabled = true;
                elements.closeWeek.hidden = true;
                elements.empty.hidden = false;
                elements.workspace.hidden = true;
                elements.status.textContent = "Unavailable";
                elements.status.dataset.state = "none";
                return;
            }
            ensureSelection();
            renderWeekSelect();
            renderGroupOptions();
            const week = currentWeek();
            elements.empty.hidden = Boolean(week);
            elements.workspace.hidden = !week;
            elements.openWeek.disabled = !canWrite();
            if (!week) {
                elements.status.textContent = "No week";
                elements.status.dataset.state = "none";
                elements.closeWeek.hidden = true;
                return;
            }

            elements.status.textContent = week.status;
            elements.status.dataset.state = week.status.toLocaleLowerCase("en");
            elements.periodTitle.textContent = `${week.label} · ${week.id}`;
            elements.weekRange.textContent = `${weekly.formatWeekRange(week)} · Monday-Sunday`;
            elements.closeWeek.hidden = week.status !== "OPEN";
            elements.closeWeek.disabled = !canWrite();
            elements.readonlyCopy.textContent = week.status === "OPEN"
                ? "OPEN · Votes can be edited"
                : "CLOSED · Frozen and read-only";
            renderUserSwitch();
            renderProgress(week);
            renderCards(week);
        }

        function showVoteError(message = "") {
            elements.voteError.textContent = message;
            elements.voteError.hidden = !message;
        }

        function syncRatingButtons() {
            elements.ratingOptions.forEach((button) => {
                const selected = button.dataset.weeklyRating === selectedRating;
                button.setAttribute("aria-pressed", String(selected));
            });
        }

        function renderSelectedReasons() {
            const fragment = document.createDocumentFragment();
            [...selectedReasonIds].forEach((tagId) => {
                const tag = state().tags.find((item) => item.id === tagId);
                if (!tag) return;
                const chip = createElement("button", "weekly-selected-reason", `${tag.name} ×`);
                chip.type = "button";
                chip.dataset.weeklyRemoveReason = tag.id;
                chip.setAttribute("aria-label", `Remove weekly reason ${tag.name}`);
                fragment.append(chip);
            });
            elements.selectedReasons.replaceChildren(fragment);
            elements.reasonCount.textContent = `${selectedReasonIds.size} / ${constants.MAX_WEEKLY_REASON_TAGS}`;
        }

        function renderReasonList() {
            const query = elements.reasonSearch.value.trim().toLocaleLowerCase("es");
            const matching = [...state().tags]
                .filter((tag) => !query || tag.name.toLocaleLowerCase("es").includes(query))
                .sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" }))
                .slice(0, 24);
            const fragment = document.createDocumentFragment();
            matching.forEach((tag) => {
                const selected = selectedReasonIds.has(tag.id);
                const button = createElement("button", "weekly-reason-option", tag.name);
                button.type = "button";
                button.dataset.weeklyReasonId = tag.id;
                button.setAttribute("aria-pressed", String(selected));
                button.append(createElement("small", "", tag.categoryId));
                fragment.append(button);
            });
            if (matching.length === 0) fragment.append(createElement("p", "weekly-reason-empty", "No reasons match this search."));
            elements.reasonList.replaceChildren(fragment);
        }

        function openVoteDialog(participantId, trigger) {
            const week = currentWeek();
            if (!week || week.status !== "OPEN" || !canWrite()) return;
            const participant = state().participants.find((item) => item.id === participantId);
            if (!participant || participant.archivedAt !== null) return;
            const existing = weekly.findVote(state(), week.id, participantId, activeUserId);
            const voter = currentVoter();
            editingParticipantId = participantId;
            selectedRating = existing?.rating || null;
            selectedReasonIds = new Set(existing?.reasonTagIds || []);
            returnFocusElement = trigger || document.activeElement;
            elements.voteKicker.textContent = `${week.label} · Voting as ${voter.name} (${voter.id.toUpperCase()})`;
            elements.voteTitle.textContent = existing ? `Edit ${participant.name}` : `Evaluate ${participant.name}`;
            elements.voteIdentity.textContent = `${groupName(participant.groupId)} · ${week.id}`;
            elements.note.value = existing?.note || "";
            elements.noteCount.textContent = elements.note.value.length;
            elements.removeVote.hidden = !existing;
            elements.saveVote.textContent = existing ? "Save changes" : "Save evaluation";
            elements.reasonSearch.value = "";
            showVoteError();
            syncRatingButtons();
            renderSelectedReasons();
            renderReasonList();
            elements.voteDialog.showModal();
            (elements.ratingOptions.find((button) => button.dataset.weeklyRating === selectedRating)
                || elements.ratingOptions[0]).focus();
        }

        function closeVoteDialog() {
            if (elements.voteDialog.open) elements.voteDialog.close();
            editingParticipantId = null;
            selectedRating = null;
            selectedReasonIds = new Set();
            showVoteError();
            if (returnFocusElement?.isConnected) returnFocusElement.focus();
            returnFocusElement = null;
        }

        function submitVote(event) {
            event.preventDefault();
            const week = currentWeek();
            if (!week || !editingParticipantId) return;
            if (!selectedRating) {
                showVoteError("Select Standout, Impressed, Good or Normal. Not evaluated is represented by no saved record.");
                elements.ratingOptions[0].focus();
                return;
            }
            try {
                const result = weekly.upsertVote(state(), {
                    weekId: week.id,
                    participantId: editingParticipantId,
                    userId: activeUserId,
                    rating: selectedRating,
                    reasonTagIds: [...selectedReasonIds],
                    note: elements.note.value
                });
                const participantName = state().participants.find((participant) => participant.id === editingParticipantId)?.name;
                commitState(result.state);
                closeVoteDialog();
                notify(`${participantName}: ${ratingLabel(result.vote.rating)} saved for ${currentVoter().name}.`);
            } catch (error) {
                showVoteError(error.message);
            }
        }

        function removeEvaluation() {
            const week = currentWeek();
            if (!week || !editingParticipantId) return;
            try {
                const participantName = state().participants.find((participant) => participant.id === editingParticipantId)?.name;
                const result = weekly.removeVote(state(), week.id, editingParticipantId, activeUserId);
                commitState(result.state);
                closeVoteDialog();
                notify(`${participantName} is now Not evaluated for ${currentVoter().name}.`);
            } catch (error) {
                showVoteError(error.message);
            }
        }

        function openCurrentWeek() {
            if (!canWrite()) return;
            try {
                const result = weekly.openCurrentIsoWeek(state());
                selectedWeekId = result.week.id;
                if (result.created || state().settings.activeWeekId !== result.week.id) commitState(result.state);
                else render();
                notify(result.created ? `${result.week.label} opened for weekly voting.` : `${result.week.label} selected.`);
            } catch (error) {
                notify(error.message, "error");
            }
        }

        function openCloseDialog() {
            const week = currentWeek();
            if (!week || week.status !== "OPEN") return;
            returnFocusElement = elements.closeWeek;
            elements.closeDialogTitle.textContent = `Close ${week.label}?`;
            elements.closeDialogMessage.textContent = `${week.id} will become permanently read-only in Phase 4. All votes, reasons and notes will be preserved.`;
            elements.closeDialog.showModal();
            elements.cancelCloseWeek.focus();
        }

        function closeCloseDialog() {
            if (elements.closeDialog.open) elements.closeDialog.close();
            if (returnFocusElement?.isConnected) returnFocusElement.focus();
            returnFocusElement = null;
        }

        function confirmCloseWeek() {
            const week = currentWeek();
            if (!week) return;
            try {
                const result = weekly.closeWeek(state(), week.id);
                commitState(result.state);
                closeCloseDialog();
                notify(`${week.label} closed. Weekly results are now read-only.`);
            } catch (error) {
                closeCloseDialog();
                notify(error.message, "error");
            }
        }

        function resetFilters() {
            elements.search.value = "";
            elements.categoryFilter.value = "all";
            elements.genderFilter.value = "all";
            elements.groupFilter.value = "all";
            elements.evaluationFilter.value = "all";
            render();
        }

        function bindEvents() {
            elements.weekSelect.addEventListener("change", () => {
                selectedWeekId = elements.weekSelect.value || null;
                render();
            });
            elements.openWeek.addEventListener("click", openCurrentWeek);
            elements.closeWeek.addEventListener("click", openCloseDialog);
            elements.userSwitch.addEventListener("click", (event) => {
                const button = event.target.closest("button[data-weekly-user-id]");
                if (!button) return;
                activeUserId = button.dataset.weeklyUserId;
                render();
            });
            elements.search.addEventListener("input", render);
            [elements.categoryFilter, elements.genderFilter, elements.groupFilter, elements.evaluationFilter]
                .forEach((control) => control.addEventListener("change", render));
            elements.resetFilters.addEventListener("click", resetFilters);
            elements.grid.addEventListener("click", (event) => {
                const button = event.target.closest("button[data-weekly-participant-id]");
                if (button) openVoteDialog(button.dataset.weeklyParticipantId, button);
            });

            elements.ratingOptions.forEach((button) => button.addEventListener("click", () => {
                selectedRating = button.dataset.weeklyRating;
                showVoteError();
                syncRatingButtons();
            }));
            elements.reasonSearch.addEventListener("input", renderReasonList);
            elements.reasonList.addEventListener("click", (event) => {
                const button = event.target.closest("button[data-weekly-reason-id]");
                if (!button) return;
                const tagId = button.dataset.weeklyReasonId;
                if (selectedReasonIds.has(tagId)) selectedReasonIds.delete(tagId);
                else if (selectedReasonIds.size >= constants.MAX_WEEKLY_REASON_TAGS) {
                    showVoteError(`Choose up to ${constants.MAX_WEEKLY_REASON_TAGS} weekly reasons.`);
                    return;
                } else selectedReasonIds.add(tagId);
                showVoteError();
                renderSelectedReasons();
                renderReasonList();
            });
            elements.selectedReasons.addEventListener("click", (event) => {
                const button = event.target.closest("button[data-weekly-remove-reason]");
                if (!button) return;
                selectedReasonIds.delete(button.dataset.weeklyRemoveReason);
                renderSelectedReasons();
                renderReasonList();
            });
            elements.note.addEventListener("input", () => {
                elements.noteCount.textContent = elements.note.value.length;
            });
            elements.voteForm.addEventListener("submit", submitVote);
            elements.removeVote.addEventListener("click", removeEvaluation);
            elements.closeVote.addEventListener("click", closeVoteDialog);
            elements.cancelVote.addEventListener("click", closeVoteDialog);
            elements.voteDialog.addEventListener("cancel", (event) => {
                event.preventDefault();
                closeVoteDialog();
            });
            elements.voteDialog.addEventListener("click", (event) => {
                if (event.target === elements.voteDialog) closeVoteDialog();
            });

            elements.cancelCloseWeek.addEventListener("click", closeCloseDialog);
            elements.confirmCloseWeek.addEventListener("click", confirmCloseWeek);
            elements.closeDialog.addEventListener("cancel", (event) => {
                event.preventDefault();
                closeCloseDialog();
            });
            elements.closeDialog.addEventListener("click", (event) => {
                if (event.target === elements.closeDialog) closeCloseDialog();
            });
        }

        bindEvents();
        return Object.freeze({ render, activate: render });
    }

    namespace.weeklyView = Object.freeze({ createController });
    root.StatsV2 = namespace;
})(globalThis);
