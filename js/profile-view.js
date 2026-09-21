(function defineProfileView(root) {
    "use strict";

    const namespace = root.StatsV2 || {};
    const constants = namespace.constants;
    const profileHistory = namespace.profileHistory;
    const imageStorage = namespace.imageStorage;
    const ui = namespace.ui;

    if (!constants || !profileHistory || !imageStorage || !ui) {
        throw new Error("Stats V2 profile history, UI helpers and image storage must load before participant profiles.");
    }

    const { element, initials, categoryLabel } = ui;

    function createController(options) {
        const getState = options.getState;
        const goBack = options.goBack;
        const editParticipant = options.editParticipant;
        const manageTags = options.manageTags;
        let participantId = null;
        let trendCategoryId = null;
        let photoUrl = null;
        let currentProfile = null;
        const elements = {
            view: document.getElementById("profile"),
            back: document.getElementById("profile-back"),
            edit: document.getElementById("profile-edit"),
            manageTags: document.getElementById("profile-manage-tags"),
            photoImage: document.getElementById("profile-photo-image"),
            photoFallback: document.getElementById("profile-photo-fallback"),
            name: document.getElementById("profile-name"),
            status: document.getElementById("profile-status"),
            group: document.getElementById("profile-group"),
            gender: document.getElementById("profile-gender"),
            categoryChips: document.getElementById("profile-category-chips"),
            wins: document.getElementById("profile-wins"),
            topThree: document.getElementById("profile-top-three"),
            weeks: document.getElementById("profile-weeks"),
            categories: document.getElementById("profile-categories"),
            bestWeek: document.getElementById("profile-best-week"),
            mostPraised: document.getElementById("profile-most-praised"),
            mostWins: document.getElementById("profile-most-wins"),
            tagGroups: document.getElementById("profile-tag-groups"),
            categoryGrid: document.getElementById("profile-category-grid"),
            trendTabs: document.getElementById("profile-trend-tabs"),
            trendChart: document.getElementById("profile-trend-chart"),
            trendSummary: document.getElementById("profile-trend-summary"),
            topReasons: document.getElementById("profile-top-reasons"),
            badgeCounts: document.getElementById("profile-badge-counts"),
            winList: document.getElementById("profile-win-list"),
            historyCategory: document.getElementById("profile-history-category"),
            historyOrder: document.getElementById("profile-history-order"),
            historyList: document.getElementById("profile-history-list"),
            historyEmpty: document.getElementById("profile-history-empty")
        };

        function revokePhoto() {
            if (photoUrl) URL.revokeObjectURL(photoUrl);
            photoUrl = null;
        }

        async function loadPhoto(participant) {
            revokePhoto();
            elements.photoImage.hidden = true;
            elements.photoImage.removeAttribute("src");
            elements.photoImage.alt = `Foto de ${participant.name}`;
            elements.photoFallback.hidden = false;
            elements.photoFallback.textContent = initials(participant.name);
            if (!participant.imageId) return;
            try {
                const record = await imageStorage.getImage(participant.imageId);
                if (!record?.blob || participant.id !== participantId) return;
                photoUrl = URL.createObjectURL(record.blob);
                elements.photoImage.src = photoUrl;
                elements.photoImage.hidden = false;
                elements.photoFallback.hidden = true;
            } catch (_) {
                // Identity and history remain available when the local image database is unavailable.
            }
        }

        function categoryChip(categoryId) {
            const chip = element("span", "profile-category-chip", categoryLabel(categoryId));
            chip.dataset.category = categoryId;
            return chip;
        }

        function renderIdentity(profile) {
            const { participant, group, summary } = profile;
            elements.name.textContent = participant.name;
            elements.status.textContent = participant.archivedAt === null ? "Activo" : "Archivado";
            elements.status.dataset.archived = String(participant.archivedAt !== null);
            elements.group.textContent = group?.name || "Solista / Sin grupo";
            elements.gender.textContent = participant.gender === "female" ? "Mujer" : "Hombre";
            const chips = document.createDocumentFragment();
            profile.categoryIds.forEach((categoryId) => chips.append(categoryChip(categoryId)));
            elements.categoryChips.replaceChildren(chips);
            elements.wins.textContent = String(summary.wins);
            elements.topThree.textContent = String(summary.topThreeAppearances);
            elements.weeks.textContent = String(summary.weeksEvaluated);
            elements.categories.textContent = String(summary.categories);
            loadPhoto(participant);
        }

        function renderSummary(profile) {
            const summary = profile.summary;
            elements.bestWeek.textContent = summary.bestRecords.length > 0
                ? summary.bestRecords.map((record) => `${record.week.label} · ${categoryLabel(record.categoryId)}`).join(" / ")
                : "Sin evaluar";
            elements.mostPraised.textContent = summary.mostPraised
                ? `${summary.mostPraised.tag.name} · ${summary.mostPraised.count} mención${summary.mostPraised.count === 1 ? "" : "es"}`
                : "Aún no hay elogios semanales";
            elements.mostWins.textContent = summary.mostWinsCategories.length > 0
                ? summary.mostWinsCategories.map((stats) => `${categoryLabel(stats.categoryId)} · ${stats.wins} victoria${stats.wins === 1 ? "" : "s"}`).join(" / ")
                : "Aún no hay victorias";
        }

        function renderProfileTags(profile) {
            const definitions = [
                ["strength", "Fortalezas"],
                ["weakness", "Por mejorar"],
                ["neutral", "Especial"]
            ];
            const fragment = document.createDocumentFragment();
            definitions.forEach(([type, label]) => {
                const group = element("article", "profile-tag-group");
                group.append(element("h3", "", label));
                const list = element("div", "profile-tag-list");
                const tags = profile.profileTags[type];
                if (tags.length === 0) list.append(element("p", "profile-tag-empty", "Sin tags del perfil"));
                else tags.forEach((tag) => list.append(element("span", `profile-tag-pill profile-tag-pill--${type}`, tag.name)));
                group.append(list);
                fragment.append(group);
            });
            elements.tagGroups.replaceChildren(fragment);
        }

        function metric(label, value) {
            const item = element("p");
            item.append(element("strong", "", value), element("span", "", label));
            return item;
        }

        function renderCategoryCards(profile) {
            const fragment = document.createDocumentFragment();
            profile.categoryStats.forEach((stats) => {
                const card = element("article", "profile-category-card");
                card.dataset.category = stats.categoryId;
                card.append(element("h3", "", categoryLabel(stats.categoryId)));
                const grid = element("div", "profile-record-grid");
                grid.append(
                    metric("Victorias", stats.wins),
                    metric("Top 3", stats.topThreeAppearances),
                    metric("Mejor puntaje", stats.bestScore === null ? "—" : `${stats.bestScore} pts`),
                    metric("Semanas", stats.weeksEvaluated)
                );
                card.append(grid);
                const praise = element("p", "profile-record-praise");
                praise.append(element("span", "", "Más elogiado"), document.createTextNode(stats.mostPraised?.tag.name || "Sin elogios semanales"));
                card.append(praise);
                const button = element("button", "button button--quiet", `Ver historial de ${categoryLabel(stats.categoryId)}`);
                button.type = "button";
                button.dataset.profileCategory = stats.categoryId;
                card.append(button);
                fragment.append(card);
            });
            elements.categoryGrid.replaceChildren(fragment);
        }

        function selectTrendCategory(categoryId, focus = false) {
            if (!currentProfile?.categoryIds.includes(categoryId)) return;
            trendCategoryId = categoryId;
            renderTrend(currentProfile);
            if (focus) requestAnimationFrame(() => document.getElementById(`profile-trend-tab-${categoryId}`)?.focus());
        }

        function renderTrendTabs(profile) {
            const fragment = document.createDocumentFragment();
            profile.categoryIds.forEach((categoryId, index) => {
                const button = element("button", "", categoryLabel(categoryId));
                button.type = "button";
                button.id = `profile-trend-tab-${categoryId}`;
                button.dataset.profileTrendCategory = categoryId;
                button.setAttribute("role", "tab");
                button.setAttribute("aria-selected", String(categoryId === trendCategoryId));
                button.tabIndex = categoryId === trendCategoryId ? 0 : -1;
                button.addEventListener("keydown", (event) => {
                    let target = null;
                    if (event.key === "ArrowRight") target = (index + 1) % profile.categoryIds.length;
                    if (event.key === "ArrowLeft") target = (index - 1 + profile.categoryIds.length) % profile.categoryIds.length;
                    if (event.key === "Home") target = 0;
                    if (event.key === "End") target = profile.categoryIds.length - 1;
                    if (target === null) return;
                    event.preventDefault();
                    selectTrendCategory(profile.categoryIds[target], true);
                });
                fragment.append(button);
            });
            elements.trendTabs.replaceChildren(fragment);
        }

        function renderTrend(profile) {
            const stats = profile.categoryStats.find((item) => item.categoryId === trendCategoryId) || profile.categoryStats[0];
            if (!stats) {
                elements.trendChart.replaceChildren(element("p", "profile-section-empty", "No hay categorías disponibles."));
                return;
            }
            trendCategoryId = stats.categoryId;
            elements.view.style.setProperty("--profile-accent", `var(--color-${stats.categoryId})`);
            renderTrendTabs(profile);
            const fragment = document.createDocumentFragment();
            stats.trend.forEach((point) => {
                const item = element("div", "profile-trend-point");
                item.dataset.evaluated = String(point.evaluated);
                item.append(element("span", "profile-trend-score", point.evaluated ? `${point.weeklyPoints} pts` : "Sin dato"));
                const track = element("div", "profile-trend-track");
                if (point.evaluated) {
                    const bar = element("span", "profile-trend-bar");
                    bar.style.height = point.weeklyPoints === 0 ? "0.25rem" : `${Math.max(8, point.weeklyPoints / 6 * 100)}%`;
                    track.append(bar);
                } else {
                    track.append(element("span", "profile-trend-gap", "···"));
                }
                item.append(track, element("span", "profile-trend-label", point.label));
                fragment.append(item);
            });
            const summary = `Evolución de ${categoryLabel(stats.categoryId)}: ${stats.trend.map((point) => (
                `${point.label} ${point.evaluated ? `${point.weeklyPoints} puntos` : "sin evaluar"}`
            )).join(", ")}.`;
            elements.trendChart.setAttribute("aria-label", summary);
            elements.trendSummary.textContent = summary;
            elements.trendChart.replaceChildren(fragment);
        }

        function renderPraise(profile) {
            const reasons = element("div", "profile-reason-list");
            if (profile.topReasons.length === 0) reasons.append(element("p", "profile-section-empty", "Aún no hay elogios semanales."));
            profile.topReasons.slice(0, 8).forEach((reason) => {
                const pill = element("span", "profile-reason-pill", reason.tag.name);
                pill.append(element("strong", "", `×${reason.count}`));
                reasons.append(pill);
            });
            elements.topReasons.replaceChildren(reasons);

            const badges = element("div", "profile-badge-list");
            if (profile.badgeCounts.length === 0) badges.append(element("p", "profile-section-empty", "Aún no hay distinciones."));
            profile.badgeCounts.forEach((entry) => {
                const pill = element("span", "profile-badge-pill", entry.badge.label);
                pill.append(element("strong", "", `×${entry.count}`));
                badges.append(pill);
            });
            elements.badgeCounts.replaceChildren(badges);
        }

        function renderWins(profile) {
            const fragment = document.createDocumentFragment();
            if (profile.winHistory.length === 0) fragment.append(element("p", "profile-section-empty", "Aún no hay victorias semanales."));
            profile.winHistory.forEach((record) => {
                const item = element("article", "profile-win-item");
                item.append(
                    element("strong", "", record.week.label),
                    element("p", "", `${categoryLabel(record.categoryId)} · ${record.jointWinner ? "Victoria compartida" : "Victoria"}`),
                    element("p", "", `${record.metrics.weeklyPoints} pts · ${record.metrics.votersCount}/2 votos · ${record.metrics.standoutCount} destacado${record.metrics.standoutCount === 1 ? "" : "s"}`)
                );
                fragment.append(item);
            });
            elements.winList.replaceChildren(fragment);
        }

        function renderHistoryOptions(profile) {
            const selected = profile.categoryIds.includes(elements.historyCategory.value)
                ? elements.historyCategory.value : "all";
            const fragment = document.createDocumentFragment();
            const all = element("option", "", "Todas las categorías");
            all.value = "all";
            fragment.append(all);
            profile.categoryIds.forEach((categoryId) => {
                const option = element("option", "", categoryLabel(categoryId));
                option.value = categoryId;
                fragment.append(option);
            });
            elements.historyCategory.replaceChildren(fragment);
            elements.historyCategory.value = selected;
        }

        function historyLabel(text, modifier = "") {
            return element("span", `profile-history-label${modifier ? ` profile-history-label--${modifier}` : ""}`, text);
        }

        function renderHistory(profile) {
            const records = profileHistory.getParticipantHistory(getState(), participantId, {
                categoryId: elements.historyCategory.value,
                order: elements.historyOrder.value
            });
            const fragment = document.createDocumentFragment();
            records.forEach((record) => {
                const item = element("article", "profile-history-item");
                item.append(element("span", "profile-history-rank", `#${record.rank}`));
                const identity = element("div", "profile-history-identity");
                identity.append(
                    element("h3", "", `${record.week.label} · ${categoryLabel(record.categoryId)}`),
                    element("p", "", `${record.mode === "OFFICIAL" ? "Oficial" : "En vivo · Provisional"} · ${record.week.startDate} a ${record.week.endDate}`)
                );
                const meta = element("div", "profile-history-meta");
                meta.append(
                    element("strong", "", `${record.metrics.weeklyPoints} pts`),
                    element("span", "", `${record.metrics.votersCount}/2 votos`),
                    element("span", "", `${record.metrics.standoutCount} destacado${record.metrics.standoutCount === 1 ? "" : "s"}`)
                );
                if (record.winner) meta.append(historyLabel(record.jointWinner ? "Victoria compartida" : "Victoria", "winner"));
                if (record.badge) meta.append(historyLabel(record.badge.label));
                const reasons = element("div", "profile-history-reasons");
                record.topReasonTags.forEach((reason) => reasons.append(element("span", "profile-reason-pill", `${reason.tag.name}${reason.count > 1 ? ` ×${reason.count}` : ""}`)));
                item.append(identity, meta, reasons);
                fragment.append(item);
            });
            elements.historyList.replaceChildren(fragment);
            elements.historyEmpty.hidden = records.length > 0;
        }

        function render() {
            const state = getState();
            currentProfile = profileHistory.getParticipantProfile(state, participantId);
            if (!trendCategoryId || !currentProfile.categoryIds.includes(trendCategoryId)) {
                trendCategoryId = currentProfile.categoryIds[0] || null;
            }
            renderIdentity(currentProfile);
            renderSummary(currentProfile);
            renderProfileTags(currentProfile);
            renderCategoryCards(currentProfile);
            renderTrend(currentProfile);
            renderPraise(currentProfile);
            renderWins(currentProfile);
            renderHistoryOptions(currentProfile);
            renderHistory(currentProfile);
        }

        elements.back.addEventListener("click", goBack);
        elements.edit.addEventListener("click", () => participantId && editParticipant(participantId));
        elements.manageTags.addEventListener("click", () => participantId && manageTags(participantId));
        elements.categoryGrid.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-profile-category]");
            if (!button) return;
            const categoryId = button.dataset.profileCategory;
            selectTrendCategory(categoryId);
            elements.historyCategory.value = categoryId;
            renderHistory(currentProfile);
            elements.trendTabs.scrollIntoView({ block: "center" });
        });
        elements.trendTabs.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-profile-trend-category]");
            if (button) selectTrendCategory(button.dataset.profileTrendCategory);
        });
        elements.historyCategory.addEventListener("change", () => renderHistory(currentProfile));
        elements.historyOrder.addEventListener("change", () => renderHistory(currentProfile));

        return Object.freeze({
            activate(nextParticipantId) {
                if (nextParticipantId !== participantId) {
                    participantId = nextParticipantId;
                    trendCategoryId = null;
                    elements.historyCategory.value = "all";
                    elements.historyOrder.value = "newest";
                }
                render();
            }
        });
    }

    namespace.profileView = Object.freeze({ createController });
    root.StatsV2 = namespace;
})(globalThis);
