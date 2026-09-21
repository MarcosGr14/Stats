(function defineProductView(root) {
    "use strict";

    const namespace = root.StatsV2 || {};
    const constants = namespace.constants;
    const seasons = namespace.seasons;
    const ui = namespace.ui;

    if (!constants || !seasons || !ui) {
        throw new Error("Stats V2 seasons and UI helpers must load before the product view.");
    }

    const { element, categoryLabel, decimal } = ui;

    function createController(options) {
        const getState = options.getState;
        const commitState = options.commitState;
        const canWrite = options.canWrite;
        const notify = options.notify;
        const activateSpotlight = options.activateSpotlight;
        const activateSeason = options.activateSeason;
        const viewParticipant = options.viewParticipant;
        let resultsTab = "week";
        const byId = (id) => document.getElementById(id);
        const elements = {
            results: byId("results"),
            resultsTabs: [...document.querySelectorAll("[data-results-tab]")],
            spotlight: byId("spotlight"),
            season: byId("season"),
            rankings: byId("rankings"),
            seasonBar: byId("current-season-bar"),
            seasonLabel: byId("current-season-label"),
            seasonPeriod: byId("current-season-period"),
            seasonHighlights: byId("season-context-highlights"),
            openCloseSeason: byId("open-close-season"),
            closeSeasonDialog: byId("close-season-dialog"),
            cancelCloseSeason: byId("cancel-close-season"),
            confirmCloseSeason: byId("confirm-close-season"),
            hall: byId("hall-of-fame"),
            hallList: byId("hall-list"),
            hallEmpty: byId("hall-empty")
        };

        function weekPeriod(seasonRecord) {
            if (!seasonRecord || seasonRecord.weekIds.length === 0) return "Sin semanas";
            const state = getState();
            const first = state.weeks.find((week) => week.id === seasonRecord.startWeekId);
            const lastId = seasonRecord.endWeekId || seasonRecord.weekIds.at(-1);
            const last = state.weeks.find((week) => week.id === lastId);
            return `${first?.label || seasonRecord.startWeekId} – ${last?.label || lastId}`;
        }

        function highlightCard(item) {
            const card = element("article", "season-highlight-card");
            card.append(element("span", "", item.label));
            const value = item.names.length > 0 ? item.names.join(" / ") : item.detail;
            card.append(element("strong", "", value || "Sin datos"));
            if (item.value !== null) {
                const suffix = item.id === "praised" ? " menciones" : "";
                card.append(element("small", "", `${decimal(item.value, 2)}${suffix}`));
            }
            return card;
        }

        function renderCurrentSeason() {
            const state = getState();
            const current = seasons.currentSeason(state);
            elements.seasonLabel.textContent = current?.label || "TEMPORADA";
            elements.seasonPeriod.textContent = weekPeriod(current);
            elements.openCloseSeason.disabled = !canWrite();
            const highlights = current
                ? seasons.deriveHighlights(state, current.weekIds, false)
                    .filter((item) => ["wins", "top-three", "standouts", "praised"].includes(item.id))
                : [];
            elements.seasonHighlights.replaceChildren(...highlights.map(highlightCard));
        }

        function selectResultsTab(tab, focus = false) {
            resultsTab = tab === "season" ? "season" : "week";
            elements.resultsTabs.forEach((button) => {
                const selected = button.dataset.resultsTab === resultsTab;
                button.setAttribute("aria-selected", String(selected));
                button.tabIndex = selected ? 0 : -1;
            });
            const showSeason = resultsTab === "season";
            elements.spotlight.hidden = showSeason;
            elements.season.hidden = !showSeason;
            elements.rankings.hidden = !showSeason;
            elements.seasonBar.hidden = !showSeason;
            elements.seasonHighlights.hidden = !showSeason;
            if (showSeason) {
                renderCurrentSeason();
                activateSeason();
            } else activateSpotlight();
            if (focus) elements.resultsTabs.find((button) => button.dataset.resultsTab === resultsTab)?.focus();
        }

        function activateResults() {
            elements.results.hidden = false;
            selectResultsTab(resultsTab);
        }

        function winnerButton(person) {
            const button = element("button", "hall-person", person.name);
            button.type = "button";
            button.dataset.hallParticipantId = person.participantId;
            return button;
        }

        function winnerList(winners, emptyCopy = "Sin ganador oficial") {
            const list = element("div", "hall-winner-list");
            if (winners.length === 0) list.append(element("span", "hall-no-winner", emptyCopy));
            else winners.forEach((winner) => list.append(winnerButton(winner)));
            return list;
        }

        function grandCard(record, gender) {
            const standing = record.resultsSnapshot.grandWinners.find((item) => item.gender === gender);
            const card = element("article", `hall-grand-card hall-grand-card--${gender}`);
            card.append(
                element("span", "", gender === "female" ? "Ganadora general femenina" : "Ganador general masculino"),
                winnerList(standing?.winners || [])
            );
            return card;
        }

        function categoryCard(record, category) {
            const card = element("article", "hall-category-card");
            card.append(element("h3", "", category.label));
            [["female", "Mujer"], ["male", "Hombre"]].forEach(([gender, label]) => {
                const row = element("div", "hall-category-row");
                const standing = record.resultsSnapshot.categoryWinners.find((item) => (
                    item.categoryId === category.id && item.gender === gender
                ));
                row.append(element("span", "", label), winnerList(standing?.winners || [], "Sin clasificar"));
                card.append(row);
            });
            return card;
        }

        function hallSeasonCard(record) {
            const card = element("article", "hall-season-card");
            const heading = element("header", "hall-season-heading");
            const copy = element("div");
            copy.append(element("p", "eyebrow", "Temporada cerrada"), element("h2", "", record.label));
            heading.append(copy, element("strong", "hall-season-period", weekPeriod(record)));
            const grands = element("div", "hall-grand-grid");
            grands.append(grandCard(record, "female"), grandCard(record, "male"));
            const categories = element("div", "hall-category-grid");
            constants.CATEGORIES.forEach((category) => categories.append(categoryCard(record, category)));
            const highlights = element("div", "hall-highlight-grid");
            record.resultsSnapshot.highlights.forEach((item) => highlights.append(highlightCard(item)));
            card.append(heading, grands, categories, highlights);
            return card;
        }

        function renderHall() {
            const closed = [...getState().seasons].filter((record) => record.status === "CLOSED")
                .sort((left, right) => right.closedAt.localeCompare(left.closedAt));
            elements.hallList.replaceChildren(...closed.map(hallSeasonCard));
            elements.hallEmpty.hidden = closed.length > 0;
        }

        function activateHall() {
            elements.hall.hidden = false;
            renderHall();
        }

        function openCloseSeasonDialog() {
            elements.closeSeasonDialog.showModal();
            elements.cancelCloseSeason.focus();
        }
        function closeCloseSeasonDialog() {
            if (elements.closeSeasonDialog.open) elements.closeSeasonDialog.close();
        }
        function confirmCloseSeason() {
            try {
                const result = seasons.closeCurrentSeason(getState());
                commitState(result.state);
                closeCloseSeasonDialog();
                resultsTab = "season";
                activateResults();
                notify(`${result.closedSeason.label} pasó al Hall of Fame. ${result.currentSeason.label} está en curso.`);
            } catch (error) {
                closeCloseSeasonDialog();
                notify(error.message, "error");
            }
        }

        elements.resultsTabs.forEach((button, index) => {
            button.addEventListener("click", () => selectResultsTab(button.dataset.resultsTab));
            button.addEventListener("keydown", (event) => {
                if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
                event.preventDefault();
                selectResultsTab(elements.resultsTabs[(index + 1) % elements.resultsTabs.length].dataset.resultsTab, true);
            });
        });
        elements.openCloseSeason.addEventListener("click", openCloseSeasonDialog);
        elements.cancelCloseSeason.addEventListener("click", closeCloseSeasonDialog);
        elements.confirmCloseSeason.addEventListener("click", confirmCloseSeason);
        elements.closeSeasonDialog.addEventListener("cancel", (event) => { event.preventDefault(); closeCloseSeasonDialog(); });
        elements.hallList.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-hall-participant-id]");
            if (button) viewParticipant(button.dataset.hallParticipantId);
        });

        return Object.freeze({
            activateResults,
            activateHall,
            hideResultPanels() {
                elements.results.hidden = true;
                elements.spotlight.hidden = true;
                elements.season.hidden = true;
                elements.rankings.hidden = true;
            }
        });
    }

    namespace.productView = Object.freeze({ createController });
    root.StatsV2 = namespace;
})(globalThis);
