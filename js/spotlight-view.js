(function defineSpotlightView(root) {
    "use strict";

    const namespace = root.StatsV2 || {};
    const constants = namespace.constants;
    const weekly = namespace.weekly;
    const spotlight = namespace.spotlight;
    const imageStorage = namespace.imageStorage;

    if (!constants || !weekly || !spotlight || !imageStorage) {
        throw new Error("Stats V2 Spotlight dependencies did not load correctly.");
    }

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = String(text);
        return node;
    }

    function initials(name) {
        const words = String(name || "ST").trim().split(/\s+/).filter(Boolean);
        if (words.length < 2) return (words[0] || "ST").slice(0, 2).toLocaleUpperCase("es");
        return `${words[0][0]}${words[1][0]}`.toLocaleUpperCase("es");
    }

    function categoryLabel(categoryId) {
        return constants.CATEGORIES.find((category) => category.id === categoryId)?.label || categoryId;
    }

    function genderLabel(gender) {
        return gender === "female" ? "Female" : "Male";
    }

    function createController(options) {
        const getState = options.getState;
        const viewParticipant = options.viewParticipant;
        let selectedWeekId = "";
        let selectedCategoryId = constants.CATEGORIES[0].id;
        let selectedGender = "female";
        let imageUrls = [];
        const elements = {
            view: document.getElementById("spotlight"),
            mode: document.getElementById("spotlight-mode"),
            intro: document.getElementById("spotlight-intro"),
            weekSelect: document.getElementById("spotlight-week-select"),
            empty: document.getElementById("spotlight-empty"),
            workspace: document.getElementById("spotlight-workspace"),
            categoryTabs: document.getElementById("spotlight-category-tabs"),
            genderSwitch: document.getElementById("spotlight-gender-switch"),
            resultKicker: document.getElementById("spotlight-result-kicker"),
            resultTitle: document.getElementById("spotlight-result-title"),
            weekRange: document.getElementById("spotlight-week-range"),
            praised: document.getElementById("spotlight-praised"),
            praisedName: document.getElementById("spotlight-praised-name"),
            praisedCount: document.getElementById("spotlight-praised-count"),
            winnerCopy: document.getElementById("spotlight-winner-copy"),
            podium: document.getElementById("spotlight-podium"),
            rankingSummary: document.getElementById("spotlight-ranking-summary"),
            rankingList: document.getElementById("spotlight-ranking-list"),
            resultEmpty: document.getElementById("spotlight-result-empty"),
            recapCopy: document.getElementById("spotlight-recap-copy"),
            recapGrid: document.getElementById("spotlight-recap-grid")
        };

        function revokeImages() {
            imageUrls.forEach((url) => URL.revokeObjectURL(url));
            imageUrls = [];
        }

        async function loadPhoto(imageId, image, fallback) {
            if (!imageId) return;
            try {
                const record = await imageStorage.getImage(imageId);
                if (!record?.blob || !image.isConnected) return;
                const url = URL.createObjectURL(record.blob);
                imageUrls.push(url);
                image.src = url;
                image.hidden = false;
                fallback.hidden = true;
            } catch (_) {
                // Results remain usable when local image storage is unavailable.
            }
        }

        function createPhoto(participant) {
            const photo = element("div", "spotlight-photo");
            const image = element("img");
            image.alt = `Foto de ${participant.name}`;
            image.hidden = true;
            const fallback = element("span", "", initials(participant.name));
            photo.append(image, fallback);
            if (participant.imageId) loadPhoto(participant.imageId, image, fallback);
            return photo;
        }

        function appendMetrics(container, item) {
            const meta = element("div", "spotlight-result-meta");
            meta.append(
                element("strong", "spotlight-points", `${item.metrics.weeklyPoints} pts`),
                element("span", "spotlight-metric", `${item.metrics.votersCount} voter${item.metrics.votersCount === 1 ? "" : "s"}`),
                element("span", "spotlight-metric", `${item.metrics.standoutCount} standout${item.metrics.standoutCount === 1 ? "" : "s"}`)
            );
            if (item.badge) meta.append(element("span", `spotlight-badge spotlight-badge--${item.badge.id}`, item.badge.label));
            if (item.tied) meta.append(element("span", "spotlight-badge", "Tie"));
            container.append(meta);
        }

        function appendReasons(container, item) {
            const reasons = element("div", "spotlight-reasons");
            reasons.setAttribute("aria-label", "Top weekly reasons");
            item.topReasonTags.forEach((reason) => {
                reasons.append(element("span", "spotlight-reason", `${reason.tag.name}${reason.count > 1 ? ` ×${reason.count}` : ""}`));
            });
            container.append(reasons);
        }

        function participantButton(participantId) {
            const button = element("button", "button button--quiet spotlight-view-button", "View participant");
            button.type = "button";
            button.dataset.spotlightParticipantId = participantId;
            return button;
        }

        function createPodiumCard(item) {
            const card = element("article", "spotlight-card");
            card.dataset.rank = String(item.rank);
            card.append(element("span", "spotlight-rank", String(item.rank)), createPhoto(item.participant));
            card.append(
                element("h3", "", item.participant.name),
                element("p", "spotlight-group", item.group?.name || "Soloist / No group")
            );
            appendMetrics(card, item);
            appendReasons(card, item);
            card.append(participantButton(item.participant.id));
            return card;
        }

        function createRankingRow(item) {
            const row = element("article", "spotlight-row");
            row.append(element("span", "spotlight-row-rank", String(item.rank)), createPhoto(item.participant));
            const identity = element("div", "spotlight-row-identity");
            identity.append(
                element("h3", "", item.participant.name),
                element("p", "spotlight-group", item.group?.name || "Soloist / No group")
            );
            const details = element("div", "spotlight-row-details");
            appendMetrics(details, item);
            appendReasons(details, item);
            row.append(identity, details, participantButton(item.participant.id));
            return row;
        }

        function renderWeekOptions(state) {
            const weeks = [...state.weeks].sort((left, right) => right.id.localeCompare(left.id));
            if (!weeks.some((week) => week.id === selectedWeekId)) {
                selectedWeekId = state.settings.activeWeekId && weeks.some((week) => week.id === state.settings.activeWeekId)
                    ? state.settings.activeWeekId
                    : weeks[0]?.id || "";
            }
            const fragment = document.createDocumentFragment();
            if (weeks.length === 0) {
                const empty = element("option", "", "No weeks yet");
                empty.value = "";
                fragment.append(empty);
            } else {
                weeks.forEach((week) => {
                    const option = element("option", "", `${week.label} · ${week.status}`);
                    option.value = week.id;
                    fragment.append(option);
                });
            }
            elements.weekSelect.replaceChildren(fragment);
            elements.weekSelect.value = selectedWeekId;
        }

        function renderTabs() {
            const fragment = document.createDocumentFragment();
            constants.CATEGORIES.forEach((category, index) => {
                const button = element("button", "", category.label);
                button.type = "button";
                button.id = `spotlight-tab-${category.id}`;
                button.dataset.spotlightCategory = category.id;
                button.setAttribute("role", "tab");
                button.setAttribute("aria-selected", String(category.id === selectedCategoryId));
                button.tabIndex = category.id === selectedCategoryId ? 0 : -1;
                button.addEventListener("keydown", (event) => {
                    let target = null;
                    if (event.key === "ArrowRight") target = (index + 1) % constants.CATEGORIES.length;
                    if (event.key === "ArrowLeft") target = (index - 1 + constants.CATEGORIES.length) % constants.CATEGORIES.length;
                    if (event.key === "Home") target = 0;
                    if (event.key === "End") target = constants.CATEGORIES.length - 1;
                    if (target === null) return;
                    event.preventDefault();
                    selectedCategoryId = constants.CATEGORIES[target].id;
                    render();
                    requestAnimationFrame(() => document.getElementById(`spotlight-tab-${selectedCategoryId}`)?.focus());
                });
                fragment.append(button);
            });
            elements.categoryTabs.replaceChildren(fragment);
        }

        function renderRecap(state, result) {
            const overview = spotlight.deriveWeeklyOverview(state, selectedWeekId);
            elements.recapCopy.textContent = overview.mode === "OFFICIAL" ? "Official weekly recap" : "Live overview · provisional";
            const fragment = document.createDocumentFragment();
            overview.categories.forEach(({ category, results }) => {
                const card = element("article", "spotlight-recap-card");
                const button = element("button", "", category.label);
                button.type = "button";
                button.dataset.spotlightRecapCategory = category.id;
                button.append(element("span", "", "→"));
                card.append(button);
                results.forEach(({ gender, winners, evaluatedCount }) => {
                    const line = element("div", "spotlight-recap-result");
                    line.append(
                        element("span", "", genderLabel(gender)),
                        element("strong", "", winners.length > 0
                            ? winners.map((winner) => winner.participant.name).join(" · ")
                            : evaluatedCount > 0 ? "No winner" : "No results")
                    );
                    card.append(line);
                });
                fragment.append(card);
            });
            elements.recapGrid.replaceChildren(fragment);
            elements.view.dataset.category = result.categoryId;
        }

        function renderResults(state) {
            revokeImages();
            const result = spotlight.deriveSpotlightRanking(state, {
                weekId: selectedWeekId, categoryId: selectedCategoryId, gender: selectedGender
            });
            const isOfficial = result.mode === "OFFICIAL";
            elements.mode.textContent = isOfficial ? "Official Results" : "Live Preview";
            elements.mode.className = `spotlight-mode spotlight-mode--${isOfficial ? "official" : "live"}`;
            elements.intro.textContent = isOfficial
                ? "Resultados cerrados e inmutables, derivados del registro semanal."
                : "Vista provisional: cambia inmediatamente cuando se editan votos de la semana abierta.";
            elements.resultKicker.textContent = isOfficial ? "Official weekly ranking" : "Live ranking · Provisional";
            elements.resultTitle.textContent = `${genderLabel(selectedGender)} ${categoryLabel(selectedCategoryId)}`;
            elements.weekRange.textContent = `${result.week.label} · ${weekly.formatWeekRange(result.week)} · America/Panama`;
            elements.winnerCopy.textContent = result.winners.length === 0
                ? "No weekly leader yet"
                : `${isOfficial ? "Winner" : "Leader"}${result.winners.length > 1 ? "s" : ""}: ${result.winners.map((item) => item.participant.name).join(" · ")}`;

            elements.praised.hidden = !result.mostPraisedSkill;
            if (result.mostPraisedSkill) {
                elements.praisedName.textContent = result.mostPraisedSkill.tag.name;
                elements.praisedCount.textContent = `${result.mostPraisedSkill.count} weekly mention${result.mostPraisedSkill.count === 1 ? "" : "s"}`;
            }

            const podium = document.createDocumentFragment();
            result.topThree.forEach((item) => podium.append(createPodiumCard(item)));
            elements.podium.replaceChildren(podium);
            const list = document.createDocumentFragment();
            result.items.forEach((item) => list.append(createRankingRow(item)));
            elements.rankingList.replaceChildren(list);
            elements.resultEmpty.hidden = result.items.length > 0;
            elements.rankingSummary.textContent = `${result.items.length} evaluated · ${result.notEvaluatedCount} not evaluated`;
            renderRecap(state, result);
        }

        function render() {
            const state = getState();
            renderWeekOptions(state);
            renderTabs();
            elements.genderSwitch.querySelectorAll("[data-spotlight-gender]").forEach((button) => {
                button.setAttribute("aria-pressed", String(button.dataset.spotlightGender === selectedGender));
            });
            const hasWeek = Boolean(selectedWeekId);
            elements.empty.hidden = hasWeek;
            elements.workspace.hidden = !hasWeek;
            if (!hasWeek) {
                revokeImages();
                elements.mode.textContent = "No week";
                elements.mode.className = "spotlight-mode spotlight-mode--empty";
                return;
            }
            renderResults(state);
        }

        elements.weekSelect.addEventListener("change", () => {
            selectedWeekId = elements.weekSelect.value;
            render();
        });
        elements.categoryTabs.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-spotlight-category]");
            if (!button) return;
            selectedCategoryId = button.dataset.spotlightCategory;
            render();
        });
        elements.genderSwitch.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-spotlight-gender]");
            if (!button) return;
            selectedGender = button.dataset.spotlightGender;
            render();
        });
        elements.view.addEventListener("click", (event) => {
            const participant = event.target.closest("button[data-spotlight-participant-id]");
            if (participant) viewParticipant(participant.dataset.spotlightParticipantId);
            const recap = event.target.closest("button[data-spotlight-recap-category]");
            if (recap) {
                selectedCategoryId = recap.dataset.spotlightRecapCategory;
                render();
                elements.categoryTabs.scrollIntoView({ block: "center" });
            }
        });

        return Object.freeze({ activate: render });
    }

    namespace.spotlightView = Object.freeze({ createController });
    root.StatsV2 = namespace;
})(globalThis);
