(function defineSeasonView(root) {
    "use strict";

    const namespace = root.StatsV2 || {};
    const constants = namespace.constants;
    const season = namespace.season;

    if (!constants || !season) {
        throw new Error("Stats V2 constants and Season Standings must load before the Season view.");
    }

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = String(text);
        return node;
    }

    function initials(name) {
        const words = String(name || "ST").trim().split(/\s+/).filter(Boolean);
        if (words.length === 0) return "ST";
        if (words.length === 1) return words[0].slice(0, 2).toLocaleUpperCase("es");
        return `${words[0][0]}${words[1][0]}`.toLocaleUpperCase("es");
    }

    function categoryLabel(categoryId) {
        return constants.CATEGORIES.find((category) => category.id === categoryId)?.label || categoryId;
    }

    function genderLabel(gender) {
        return gender === "female" ? "Mujeres" : "Hombres";
    }

    function decimal(value, digits = 1) {
        return Number(value).toLocaleString("es-PA", {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
        });
    }

    function createViewModel(state, options = {}) {
        const overview = season.deriveSeasonOverview(state, { includeOpen: options.includeOpen === true });
        const categoryId = options.categoryId || "vocal";
        const gender = options.gender || "female";
        return Object.freeze({
            overview,
            standing: season.findStanding(overview.allStandings, categoryId, gender),
            categoryId,
            gender
        });
    }

    function createController(options) {
        const getState = options.getState;
        const viewParticipant = options.viewParticipant;
        const getImage = options.getImage || null;
        let activeSection = "overview";
        let categoryId = "vocal";
        let gender = "female";
        let currentModel = null;
        let renderGeneration = 0;
        let imageUrls = [];
        let imagePromises = new Map();
        const byId = (id) => document.getElementById(id);
        const elements = {
            view: byId("season"),
            mode: byId("season-mode"),
            period: byId("season-period"),
            liveStatus: byId("season-live-status"),
            includeOpen: byId("season-include-open"),
            sectionTabs: [...document.querySelectorAll("[data-season-section]")],
            sectionPanels: [...document.querySelectorAll("[data-season-panel]")],
            categoryTabs: [...document.querySelectorAll("[data-season-category]")],
            genderButtons: [...document.querySelectorAll("[data-season-gender]")],
            grandGrid: byId("season-grand-grid"),
            categoryWinners: byId("season-category-winners"),
            standingKicker: byId("season-standing-kicker"),
            standingCount: byId("season-standing-count"),
            podium: byId("season-podium"),
            eligibleBody: byId("season-eligible-body"),
            eligibleEmpty: byId("season-eligible-empty"),
            provisionalList: byId("season-provisional-list"),
            renderTime: byId("season-render-time"),
            dialog: byId("season-breakdown-dialog"),
            breakdownContent: byId("season-breakdown-content")
        };

        function revokeImages() {
            imageUrls.forEach((url) => URL.revokeObjectURL(url));
            imageUrls = [];
            imagePromises = new Map();
        }

        function imageUrl(imageId) {
            if (!getImage || !imageId) return Promise.resolve(null);
            if (!imagePromises.has(imageId)) {
                imagePromises.set(imageId, Promise.resolve(getImage(imageId)).then((record) => {
                    if (!record?.blob) return null;
                    const url = URL.createObjectURL(record.blob);
                    imageUrls.push(url);
                    return url;
                }).catch(() => null));
            }
            return imagePromises.get(imageId);
        }

        function avatar(participant, modifier = "") {
            const wrapper = element("span", `season-avatar ${modifier}`.trim());
            const image = element("img");
            image.alt = `Foto de ${participant.name}`;
            image.hidden = true;
            const fallback = element("span", "season-avatar-fallback", initials(participant.name));
            fallback.setAttribute("aria-hidden", "true");
            wrapper.append(image, fallback);
            const generation = renderGeneration;
            imageUrl(participant.imageId).then((url) => {
                if (!url || generation !== renderGeneration || !image.isConnected) return;
                image.src = url;
                image.hidden = false;
                fallback.hidden = true;
            });
            return wrapper;
        }

        function participantButton(participant) {
            const button = element("button", "season-participant-link", participant.name);
            button.type = "button";
            button.dataset.seasonParticipantId = participant.id;
            return button;
        }

        function breakdownButton(entry, kind = "season") {
            const button = element("button", "season-breakdown-button", "Ver desglose");
            button.type = "button";
            button.dataset.seasonBreakdownKind = kind;
            button.dataset.participantId = entry.participantId;
            button.dataset.gender = entry.gender;
            if (kind === "season") button.dataset.categoryId = entry.categoryId;
            return button;
        }

        function emptyState(title, copy) {
            const box = element("div", "season-empty-state");
            box.append(element("strong", "", title), element("p", "", copy));
            return box;
        }

        function renderMode(model) {
            const weekCount = model.overview.scope.weekIds.length;
            const live = model.overview.isLivePreview;
            elements.mode.textContent = live ? "Vista previa de temporada" : "Resultados oficiales";
            elements.period.textContent = `${weekCount} semana${weekCount === 1 ? "" : "s"} ${live ? "incluidas" : "cerradas"}`;
            elements.liveStatus.hidden = !live;
        }

        function grandWinnerCard(grandStanding) {
            const card = element("article", `season-grand-card season-grand-card--${grandStanding.gender}`);
            card.append(
                element("p", "micro-label", grandStanding.gender === "female" ? "Premio femenino" : "Premio masculino"),
                element("h3", "", grandStanding.gender === "female" ? "Ganadora de la temporada" : "Ganador de la temporada")
            );
            if (grandStanding.winners.length === 0) {
                card.append(emptyState("Sin ganador oficial", "Aún no hay una categoría con cinco semanas evaluadas."));
                return card;
            }
            if (grandStanding.winners.length > 1) {
                card.append(element("span", "season-joint-label", grandStanding.gender === "female" ? "Ganadoras conjuntas" : "Ganadores conjuntos"));
            }
            const winners = element("div", "season-grand-winners");
            grandStanding.winners.forEach((winner) => {
                const item = element("div", "season-grand-person");
                const identity = element("div", "season-grand-identity");
                const copy = element("div");
                copy.append(participantButton(winner.participant), element("span", "", winner.group?.name || "Solista"));
                identity.append(avatar(winner.participant, "season-avatar--grand"), copy);
                const best = `${categoryLabel(winner.bestCategory.categoryId)} ${decimal(winner.bestCategory.seasonScore)}`;
                const second = winner.secondBestCategory
                    ? `${categoryLabel(winner.secondBestCategory.categoryId)} ${decimal(winner.secondBestCategory.seasonScore)}`
                    : "Única categoría elegible";
                item.append(
                    identity,
                    element("strong", "season-grand-score", decimal(winner.grandScore)),
                    element("p", "season-grand-basis", `${best} · ${second}`),
                    breakdownButton(winner, "grand")
                );
                winners.append(item);
            });
            card.append(winners);
            return card;
        }

        function renderGrandWinners(model) {
            const fragment = document.createDocumentFragment();
            ["female", "male"].forEach((targetGender) => {
                const standing = model.overview.grandStandings.genders.find((item) => item.gender === targetGender);
                fragment.append(grandWinnerCard(standing));
            });
            elements.grandGrid.replaceChildren(fragment);
        }

        function categoryWinnerRow(item) {
            const row = element("div", "season-category-winner-row");
            row.append(element("span", "season-category-gender", genderLabel(item.gender)));
            if (item.winners.length === 0) {
                row.append(element("span", "season-category-no-winner", "Sin persona clasificada"));
                return row;
            }
            const identity = element("div", "season-category-winner-identity");
            item.winners.forEach((winner) => identity.append(participantButton(winner.participant)));
            const first = item.winners[0];
            row.append(
                identity,
                element("strong", "", decimal(first.seasonScore)),
                item.isJointWinner ? element("span", "season-joint-mini", "Conjunto") : element("span", "season-joint-mini", "")
            );
            return row;
        }

        function renderCategoryWinners(model) {
            const fragment = document.createDocumentFragment();
            constants.CATEGORIES.forEach((category) => {
                const card = element("article", "season-category-winner-card");
                card.dataset.category = category.id;
                card.append(element("h3", "", category.label));
                ["female", "male"].forEach((targetGender) => {
                    const item = model.overview.categoryWinners.find((winner) => (
                        winner.categoryId === category.id && winner.gender === targetGender
                    ));
                    card.append(categoryWinnerRow(item));
                });
                fragment.append(card);
            });
            elements.categoryWinners.replaceChildren(fragment);
        }

        function podiumCard(entry) {
            const card = element("article", "season-podium-card");
            card.dataset.rank = entry.rank;
            const rank = element("span", "season-podium-rank", `#${entry.rank}`);
            const identity = element("div", "season-podium-identity");
            identity.append(
                avatar(entry.participant, "season-avatar--podium"),
                participantButton(entry.participant),
                element("span", "", entry.group?.name || "Solista")
            );
            card.append(
                rank,
                identity,
                element("strong", "season-podium-score", decimal(entry.seasonScore)),
                element("span", "season-score-label", "Puntuación de temporada"),
                element("p", "season-podium-meta", `${entry.weeksEvaluated} semanas · ${entry.wins} victorias · ${entry.topThreeAppearances} Top 3`),
                breakdownButton(entry)
            );
            if (entry.tied) card.append(element("span", "season-tie-label", "Empate real"));
            return card;
        }

        function tableCell(label, content) {
            const cell = element("td");
            cell.dataset.label = label;
            if (content instanceof Node) cell.append(content);
            else cell.textContent = String(content);
            return cell;
        }

        function eligibleRow(entry) {
            const row = element("tr");
            const identity = element("div", "season-table-identity");
            const copy = element("div");
            copy.append(participantButton(entry.participant), element("small", "", entry.group?.name || "Solista"));
            identity.append(avatar(entry.participant, "season-avatar--table"), copy);
            const rankText = entry.tied ? `#${entry.rank} · Empate` : `#${entry.rank}`;
            row.append(
                tableCell("Puesto", rankText),
                tableCell("Participante", identity),
                tableCell("Puntuación", decimal(entry.seasonScore)),
                tableCell("Semanas", entry.weeksEvaluated),
                tableCell("Victorias", entry.wins),
                tableCell("Top 3", entry.topThreeAppearances),
                tableCell("Promedio", `${decimal(entry.averageWeeklyPoints, 2)} pts`),
                tableCell("Standout rate", `${decimal(entry.components.standoutRate)}%`),
                tableCell("Detalle", breakdownButton(entry))
            );
            return row;
        }

        function provisionalCard(entry) {
            const card = element("article", "season-provisional-card");
            const identity = element("div", "season-provisional-identity");
            const copy = element("div");
            copy.append(participantButton(entry.participant), element("span", "", entry.group?.name || "Solista"));
            identity.append(avatar(entry.participant, "season-avatar--table"), copy);
            card.append(
                element("span", "season-provisional-badge", "Provisional"),
                identity,
                element("strong", "season-provisional-score", decimal(entry.seasonScore)),
                element("p", "", `${entry.weeksEvaluated} de ${season.MINIMUM_ELIGIBLE_WEEKS} semanas evaluadas`),
                breakdownButton(entry)
            );
            return card;
        }

        function renderStanding(model) {
            const standing = model.standing;
            elements.standingKicker.textContent = `${categoryLabel(standing.categoryId)} · ${genderLabel(standing.gender)}`;
            const classifiedNoun = standing.gender === "female" ? "clasificadas" : "clasificados";
            elements.standingCount.textContent = `${standing.eligible.length} ${classifiedNoun}`;

            const podium = document.createDocumentFragment();
            standing.topThree.forEach((entry) => podium.append(podiumCard(entry)));
            elements.podium.replaceChildren(standing.topThree.length
                ? podium
                : emptyState("Top 3 pendiente", "Aún no hay participantes con cinco semanas evaluadas."));

            const rows = document.createDocumentFragment();
            standing.eligible.forEach((entry) => rows.append(eligibleRow(entry)));
            elements.eligibleBody.replaceChildren(rows);
            elements.eligibleEmpty.hidden = standing.eligible.length > 0;

            const provisional = document.createDocumentFragment();
            standing.provisional.forEach((entry) => provisional.append(provisionalCard(entry)));
            elements.provisionalList.replaceChildren(standing.provisional.length
                ? provisional
                : emptyState("Sin provisionales", "No hay evaluaciones por debajo del mínimo en esta selección."));
        }

        function breakdownMetric(label, value, weight, contribution) {
            const row = element("div", "season-breakdown-metric");
            const heading = element("div", "season-breakdown-metric-heading");
            heading.append(element("strong", "", label), element("span", "", `${decimal(value)} / 100`));
            const track = element("span", "season-breakdown-track");
            const bar = element("span", "season-breakdown-bar");
            bar.style.width = `${Math.max(0, Math.min(100, value))}%`;
            track.append(bar);
            row.append(
                heading,
                track,
                element("p", "", `Peso ${Math.round(weight * 100)}% · aporta ${decimal(contribution, 2)} puntos`)
            );
            return row;
        }

        function openSeasonBreakdown(entry) {
            const content = document.createDocumentFragment();
            const heading = element("h2", "", entry.participant.name);
            heading.id = "season-breakdown-title";
            content.append(
                element("p", "micro-label", `${categoryLabel(entry.categoryId)} · ${genderLabel(entry.gender)}`),
                heading,
                element("p", "season-dialog-subtitle", entry.group?.name || "Solista")
            );
            const score = element("div", "season-dialog-score");
            score.append(element("span", "", entry.eligible ? "Puntuación de temporada" : "Puntuación provisional"), element("strong", "", decimal(entry.seasonScore)));
            content.append(score);
            const metrics = element("div", "season-breakdown-metrics");
            metrics.append(
                breakdownMetric("Rendimiento promedio", entry.components.averagePerformance, season.SEASON_SCORE_WEIGHTS.averagePerformance, entry.contributions.averagePerformance),
                breakdownMetric("Tasa de victorias", entry.components.winRate, season.SEASON_SCORE_WEIGHTS.winRate, entry.contributions.winRate),
                breakdownMetric("Tasa de Top 3", entry.components.topThreeRate, season.SEASON_SCORE_WEIGHTS.topThreeRate, entry.contributions.topThreeRate),
                breakdownMetric("Tasa de Standouts", entry.components.standoutRate, season.SEASON_SCORE_WEIGHTS.standoutRate, entry.contributions.standoutRate)
            );
            content.append(metrics, element("p", "season-dialog-footnote",
                `${entry.weeksEvaluated} semanas · ${entry.wins} victorias · ${entry.topThreeAppearances} Top 3 · ${entry.standoutVotes}/${entry.possibleStandoutVotes} votos Standout.`));
            if (!entry.eligible) content.append(element("p", "season-dialog-warning", `Provisional: necesita ${season.MINIMUM_ELIGIBLE_WEEKS - entry.weeksEvaluated} semana${season.MINIMUM_ELIGIBLE_WEEKS - entry.weeksEvaluated === 1 ? "" : "s"} más para clasificar.`));
            elements.breakdownContent.replaceChildren(content);
            elements.dialog.showModal();
        }

        function openGrandBreakdown(entry) {
            const content = document.createDocumentFragment();
            const heading = element("h2", "", entry.participant.name);
            heading.id = "season-breakdown-title";
            content.append(
                element("p", "micro-label", entry.gender === "female" ? "Ganadora de la temporada" : "Ganador de la temporada"),
                heading,
                element("p", "season-dialog-subtitle", entry.group?.name || "Solista")
            );
            const score = element("div", "season-dialog-score season-dialog-score--grand");
            score.append(element("span", "", "Grand Score"), element("strong", "", decimal(entry.grandScore)));
            content.append(score);
            const categories = element("div", "season-grand-breakdown");
            const best = element("article", "");
            best.append(
                element("span", "", entry.secondBestCategory ? "95% · Mejor categoría" : "Única categoría elegible"),
                element("strong", "", categoryLabel(entry.bestCategory.categoryId)),
                element("b", "", decimal(entry.bestCategory.seasonScore))
            );
            categories.append(best);
            if (entry.secondBestCategory) {
                const second = element("article", "");
                second.append(
                    element("span", "", "5% · Segunda categoría"),
                    element("strong", "", categoryLabel(entry.secondBestCategory.categoryId)),
                    element("b", "", decimal(entry.secondBestCategory.seasonScore))
                );
                categories.append(second);
            }
            content.append(categories, element("p", "season-dialog-footnote", entry.secondBestCategory
                ? "Grand Score = 95% de la mejor categoría + 5% de la segunda categoría elegible."
                : "Basado en su única categoría elegible; no existe penalización por competir en una sola categoría."));
            elements.breakdownContent.replaceChildren(content);
            elements.dialog.showModal();
        }

        function openBreakdown(button) {
            if (!currentModel) return;
            const participantId = button.dataset.participantId;
            if (button.dataset.seasonBreakdownKind === "grand") {
                const grand = currentModel.overview.grandStandings.genders
                    .find((item) => item.gender === button.dataset.gender)?.entries
                    .find((entry) => entry.participantId === participantId);
                if (grand) openGrandBreakdown(grand);
                return;
            }
            const standing = season.findStanding(
                currentModel.overview.allStandings,
                button.dataset.categoryId,
                button.dataset.gender
            );
            const entry = [...standing.eligible, ...standing.provisional]
                .find((item) => item.participantId === participantId);
            if (entry) openSeasonBreakdown(entry);
        }

        function selectSection(sectionId, focus = false) {
            if (!elements.sectionTabs.some((tab) => tab.dataset.seasonSection === sectionId)) return;
            activeSection = sectionId;
            elements.sectionTabs.forEach((tab) => {
                const selected = tab.dataset.seasonSection === sectionId;
                tab.setAttribute("aria-selected", String(selected));
                tab.tabIndex = selected ? 0 : -1;
            });
            elements.sectionPanels.forEach((panel) => { panel.hidden = panel.dataset.seasonPanel !== sectionId; });
            if (focus) elements.sectionTabs.find((tab) => tab.dataset.seasonSection === sectionId)?.focus();
        }

        function selectCategory(nextCategoryId, focus = false) {
            if (!constants.CATEGORIES.some((category) => category.id === nextCategoryId)) return;
            categoryId = nextCategoryId;
            elements.categoryTabs.forEach((tab) => {
                const selected = tab.dataset.seasonCategory === categoryId;
                tab.setAttribute("aria-selected", String(selected));
                tab.tabIndex = selected ? 0 : -1;
            });
            currentModel = createViewModel(getState(), { includeOpen: elements.includeOpen.checked, categoryId, gender });
            renderStanding(currentModel);
            if (focus) elements.categoryTabs.find((tab) => tab.dataset.seasonCategory === categoryId)?.focus();
        }

        function selectGender(nextGender) {
            if (!constants.GENDERS.includes(nextGender)) return;
            gender = nextGender;
            elements.genderButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.seasonGender === gender)));
            currentModel = createViewModel(getState(), { includeOpen: elements.includeOpen.checked, categoryId, gender });
            renderStanding(currentModel);
        }

        function render() {
            renderGeneration += 1;
            revokeImages();
            const startedAt = performance.now();
            currentModel = createViewModel(getState(), { includeOpen: elements.includeOpen.checked, categoryId, gender });
            renderMode(currentModel);
            renderGrandWinners(currentModel);
            renderCategoryWinners(currentModel);
            renderStanding(currentModel);
            const duration = performance.now() - startedAt;
            elements.renderTime.textContent = `Derivado en ${decimal(duration, 0)} ms · sin datos persistidos`;
        }

        elements.includeOpen.addEventListener("change", render);
        elements.sectionTabs.forEach((tab, index) => {
            tab.addEventListener("click", () => selectSection(tab.dataset.seasonSection));
            tab.addEventListener("keydown", (event) => {
                let target = null;
                if (event.key === "ArrowRight") target = (index + 1) % elements.sectionTabs.length;
                if (event.key === "ArrowLeft") target = (index - 1 + elements.sectionTabs.length) % elements.sectionTabs.length;
                if (event.key === "Home") target = 0;
                if (event.key === "End") target = elements.sectionTabs.length - 1;
                if (target === null) return;
                event.preventDefault();
                selectSection(elements.sectionTabs[target].dataset.seasonSection, true);
            });
        });
        elements.categoryTabs.forEach((tab, index) => {
            tab.addEventListener("click", () => selectCategory(tab.dataset.seasonCategory));
            tab.addEventListener("keydown", (event) => {
                let target = null;
                if (event.key === "ArrowRight") target = (index + 1) % elements.categoryTabs.length;
                if (event.key === "ArrowLeft") target = (index - 1 + elements.categoryTabs.length) % elements.categoryTabs.length;
                if (event.key === "Home") target = 0;
                if (event.key === "End") target = elements.categoryTabs.length - 1;
                if (target === null) return;
                event.preventDefault();
                selectCategory(elements.categoryTabs[target].dataset.seasonCategory, true);
            });
        });
        elements.genderButtons.forEach((button) => {
            button.addEventListener("click", () => selectGender(button.dataset.seasonGender));
        });
        elements.view.addEventListener("click", (event) => {
            const participant = event.target.closest("button[data-season-participant-id]");
            if (participant) {
                if (elements.dialog.open) elements.dialog.close();
                viewParticipant(participant.dataset.seasonParticipantId);
                return;
            }
            const breakdown = event.target.closest("button[data-season-breakdown-kind]");
            if (breakdown) openBreakdown(breakdown);
        });

        return Object.freeze({
            activate() {
                selectSection(activeSection);
                render();
            }
        });
    }

    namespace.seasonView = Object.freeze({ createViewModel, createController });
    root.StatsV2 = namespace;
})(globalThis);
