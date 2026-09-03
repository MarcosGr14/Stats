(function startApplication(root) {
    "use strict";

    const namespace = root.StatsV2;
    const constants = namespace && namespace.constants;
    const data = namespace && namespace.data;
    const storage = namespace && namespace.storage;
    const participantService = namespace && namespace.participants;
    const tagService = namespace && namespace.tags;
    const rankingsService = namespace && namespace.rankings;
    const weeklyService = namespace && namespace.weekly;
    const weeklyMigration = namespace && namespace.weeklyMigration;
    const weeklyViewService = namespace && namespace.weeklyView;
    const spotlightService = namespace && namespace.spotlight;
    const spotlightViewService = namespace && namespace.spotlightView;
    const profileHistoryService = namespace && namespace.profileHistory;
    const profileViewService = namespace && namespace.profileView;
    const analyticsViewService = namespace && namespace.analyticsView;
    const imageStorage = namespace && namespace.imageStorage;

    let state = null;
    let writable = false;
    let editingParticipantId = null;
    let deleteParticipantId = null;
    let tagParticipantId = null;
    let pendingTagDeleteId = null;
    let selectedPhotoFile = null;
    let removeExistingPhoto = false;
    let previewObjectUrl = null;
    let cardObjectUrls = [];
    let returnFocusElement = null;
    let toastTimer = null;
    let activeView = "participants";
    let rankingCategory = "vocal";
    let weeklyController = null;
    let spotlightController = null;
    let profileController = null;
    let analyticsController = null;
    let currentProfileId = null;
    let profileHasInternalReturn = false;
    let elements = {};

    function byId(id) {
        return document.getElementById(id);
    }

    function createElement(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = String(text);
        return node;
    }

    function findParticipant(participantId) {
        return state.participants.find((participant) => participant.id === participantId) || null;
    }

    function findTag(tagId) {
        return state.tags.find((tag) => tag.id === tagId) || null;
    }

    function initials(name) {
        const words = String(name || "ST").trim().split(/\s+/).filter(Boolean);
        if (words.length === 0) return "ST";
        if (words.length === 1) return words[0].slice(0, 2).toLocaleUpperCase("es");
        return `${words[0][0]}${words[1][0]}`.toLocaleUpperCase("es");
    }

    function groupName(groupId) {
        if (!groupId) return "Solista / Sin grupo";
        return state.groups.find((group) => group.id === groupId)?.name || "Grupo desconocido";
    }

    function genderLabel(gender) {
        return gender === "female" ? "Mujer" : "Hombre";
    }

    function setText(id, value) {
        const target = byId(id);
        if (target) target.textContent = String(value);
    }

    function showToast(message, type = "success") {
        clearTimeout(toastTimer);
        elements.toast.textContent = message;
        elements.toast.dataset.type = type;
        elements.toast.hidden = false;
        toastTimer = setTimeout(() => {
            elements.toast.hidden = true;
        }, 3600);
    }

    function showStorageStatus(result) {
        const status = elements.storageStatus;
        const legacyNote = result.legacyRemoved ? " · Legacy eliminado" : "";
        const messages = {
            ready: `Datos locales listos${legacyNote}`,
            initialized: `Estado V2 inicializado${legacyNote}`,
            migrated: "Datos preservados · módulos V2 actualizados",
            "weekly-migrated": "Datos preservados · Votación semanal lista",
            "category-voting-migrated": "Datos preservados · Votos por categoría listos",
            invalid: "Datos V2 inválidos · edición bloqueada",
            unavailable: "Almacenamiento no disponible · edición bloqueada"
        };

        status.textContent = messages[result.status] || "Estado local desconocido";
        delete status.dataset.state;
        if (result.status === "invalid") status.dataset.state = "error";
        if (result.status === "unavailable") status.dataset.state = "warning";
    }

    function commitState(nextState) {
        if (!writable) {
            throw new Error("El almacenamiento no está disponible.");
        }
        state = storage.save(nextState);
        renderAll();
        return state;
    }

    function renderCounts() {
        const active = state.participants.filter((participant) => participant.archivedAt === null).length;
        const archived = state.participants.length - active;
        setText("participant-count", state.participants.length);
        setText("active-count", active);
        setText("archived-count", archived);
        setText("group-count", state.groups.length);
        setText("schema-version", "Datos locales");
        elements.participantCount.setAttribute(
            "aria-label",
            `${state.participants.length} participante${state.participants.length === 1 ? "" : "s"}`
        );
    }

    function renderGroupOptions(selectedValue = elements.groupSelect.value) {
        const fragment = document.createDocumentFragment();
        const noGroup = createElement("option", "", "Solista / Sin grupo");
        noGroup.value = "";
        fragment.append(noGroup);

        [...state.groups]
            .sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" }))
            .forEach((group) => {
                const option = createElement("option", "", group.name);
                option.value = group.id;
                fragment.append(option);
            });

        elements.groupSelect.replaceChildren(fragment);
        elements.groupSelect.value = selectedValue || "";
    }

    function revokeCardUrls() {
        cardObjectUrls.forEach((url) => URL.revokeObjectURL(url));
        cardObjectUrls = [];
    }

    async function loadCardImage(imageId, image, fallback) {
        try {
            const record = await imageStorage.getImage(imageId);
            if (!record || !record.blob || !image.isConnected) return;
            const url = URL.createObjectURL(record.blob);
            if (!image.isConnected) {
                URL.revokeObjectURL(url);
                return;
            }
            cardObjectUrls.push(url);
            image.src = url;
            image.hidden = false;
            fallback.hidden = true;
        } catch (error) {
            image.hidden = true;
            fallback.hidden = false;
        }
    }

    function createCategoryBadge(categoryId) {
        const category = constants.CATEGORIES.find((item) => item.id === categoryId);
        return createElement(
            "span",
            `category-badge category-badge--${categoryId}`,
            category ? category.label : categoryId
        );
    }

    function createTagChip(tag, removable = false, participantId = null) {
        const chip = createElement("span", `tag-chip tag-chip--${tag.type}`);
        const symbol = tag.type === "strength" ? "+" : tag.type === "weakness" ? "△" : "✦";
        chip.append(
            createElement("span", "tag-chip-symbol", symbol),
            createElement("span", "tag-chip-name", tag.name)
        );
        if (removable) {
            const remove = createElement("button", "tag-chip-remove", "×");
            remove.type = "button";
            remove.dataset.tagAction = "remove";
            remove.dataset.tagId = tag.id;
            remove.dataset.participantId = participantId;
            remove.setAttribute("aria-label", `Quitar ${tag.name}`);
            chip.append(remove);
        }
        return chip;
    }

    function renderTagFilterOptions(selectedValue = elements.tagFilter.value) {
        const fragment = document.createDocumentFragment();
        const allOption = createElement("option", "", "Todos");
        allOption.value = "all";
        fragment.append(allOption);
        [...state.tags]
            .sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" }))
            .forEach((tag) => {
                const option = createElement("option", "", `${tag.name} · ${tagCategoryLabel(tag.categoryId)}`);
                option.value = tag.id;
                fragment.append(option);
            });
        elements.tagFilter.replaceChildren(fragment);
        elements.tagFilter.value = state.tags.some((tag) => tag.id === selectedValue) ? selectedValue : "all";
    }

    function actionButton(label, action, participantId) {
        const button = createElement("button", "", label);
        button.type = "button";
        button.dataset.action = action;
        button.dataset.participantId = participantId;
        return button;
    }

    function createParticipantCard(participant) {
        const card = createElement("article", "participant-card");
        card.dataset.archived = String(participant.archivedAt !== null);
        card.dataset.participantId = participant.id;
        card.tabIndex = -1;

        const photo = createElement("div", "card-photo");
        const image = createElement("img");
        image.alt = `Foto de ${participant.name}`;
        image.hidden = true;
        const fallback = createElement("span", "card-photo-fallback", initials(participant.name));
        photo.append(image, fallback);
        if (participant.archivedAt !== null) {
            photo.append(createElement("span", "archived-badge", "Archivado"));
        }
        if (participant.imageId) loadCardImage(participant.imageId, image, fallback);

        const body = createElement("div", "participant-card-body");
        body.append(
            createElement("h2", "", participant.name),
            createElement("p", "participant-group", groupName(participant.groupId))
        );

        const badges = createElement("div", "category-badges");
        participant.categoryIds.forEach((categoryId) => badges.append(createCategoryBadge(categoryId)));
        body.append(badges);

        const activeTags = tagService.activeTagsForParticipant(state, participant.id).map((item) => item.tag);
        const tagPreview = createElement("div", "card-tag-preview");
        if (activeTags.length === 0) {
            tagPreview.append(createElement("span", "card-tag-empty", "Sin tags"));
        } else {
            activeTags.slice(0, 3).forEach((tag) => tagPreview.append(createTagChip(tag)));
            if (activeTags.length > 3) {
                tagPreview.append(createElement("span", "tag-more", `+${activeTags.length - 3} más`));
            }
        }
        body.append(tagPreview);

        const meta = createElement("div", "participant-meta");
        meta.append(createElement("span", "gender-label", genderLabel(participant.gender)));
        const actions = createElement("div", "card-actions");
        actions.append(
            actionButton("Ver perfil", "profile", participant.id),
            actionButton("Administrar tags", "tags", participant.id),
            actionButton("Editar", "edit", participant.id),
            actionButton(participant.archivedAt ? "Restaurar" : "Archivar", participant.archivedAt ? "restore" : "archive", participant.id),
            actionButton("Eliminar", "delete", participant.id)
        );
        meta.append(actions);
        body.append(meta);
        card.append(photo, body);
        return card;
    }

    function currentFilters() {
        return {
            query: elements.search.value,
            gender: elements.genderFilter.value,
            status: elements.statusFilter.value,
            categoryId: elements.categoryFilter.value,
            tagId: elements.tagFilter.value,
            sort: elements.sort.value
        };
    }

    function renderEmptyState(filteredCount) {
        const hasParticipants = state.participants.length > 0;
        const isEmpty = filteredCount === 0;
        elements.empty.hidden = !isEmpty;
        if (!isEmpty) return;

        if (hasParticipants) {
            setText("empty-kicker", "Sin coincidencias");
            setText("empty-title", "No hay participantes con estos filtros");
            setText("empty-copy", "Prueba otra búsqueda o limpia los filtros.");
            elements.emptyButton.textContent = "Limpiar filtros";
            elements.emptyButton.dataset.action = "reset";
        } else {
            setText("empty-kicker", "Tu lista empieza aquí");
            setText("empty-title", "Aún no hay participantes");
            setText("empty-copy", "Agrega tu primer participante.");
            elements.emptyButton.textContent = "Agregar participante";
            elements.emptyButton.dataset.action = "add";
        }
    }

    function renderParticipants() {
        revokeCardUrls();
        const filtered = participantService.filterParticipants(state, currentFilters());
        const fragment = document.createDocumentFragment();
        filtered.forEach((participant) => fragment.append(createParticipantCard(participant)));
        elements.grid.replaceChildren(fragment);

        const statusLabel = elements.statusFilter.options[elements.statusFilter.selectedIndex].text.toLocaleLowerCase("es");
        elements.resultSummary.textContent = `${filtered.length} participante${filtered.length === 1 ? "" : "s"} ${filtered.length === 1 ? statusLabel.replace(/s$/, "") : statusLabel}`;
        renderEmptyState(filtered.length);
    }

    function renderRankingFilterOptions() {
        const selectedGroup = elements.rankingGroupFilter.value || "all";
        const groupFragment = document.createDocumentFragment();
        const allGroups = createElement("option", "", "Todos");
        allGroups.value = "all";
        const soloists = createElement("option", "", "Solistas / Sin grupo");
        soloists.value = "soloist";
        groupFragment.append(allGroups, soloists);
        [...state.groups]
            .sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" }))
            .forEach((group) => {
                const option = createElement("option", "", group.name);
                option.value = group.id;
                groupFragment.append(option);
            });
        elements.rankingGroupFilter.replaceChildren(groupFragment);
        elements.rankingGroupFilter.value = selectedGroup === "soloist" || state.groups.some((group) => group.id === selectedGroup)
            ? selectedGroup
            : "all";

        const selectedTag = elements.rankingTagFilter.value || "all";
        const tagFragment = document.createDocumentFragment();
        const allTags = createElement("option", "", "Todos");
        allTags.value = "all";
        tagFragment.append(allTags);
        [...state.tags]
            .sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" }))
            .forEach((tag) => {
                const option = createElement("option", "", `${tag.name} · ${tagCategoryLabel(tag.categoryId)}`);
                option.value = tag.id;
                tagFragment.append(option);
            });
        elements.rankingTagFilter.replaceChildren(tagFragment);
        elements.rankingTagFilter.value = state.tags.some((tag) => tag.id === selectedTag) ? selectedTag : "all";
    }

    function rankingCategoryLabel(categoryId = rankingCategory) {
        return constants.CATEGORIES.find((category) => category.id === categoryId)?.label || categoryId;
    }

    function currentRankingFilters() {
        return {
            categoryId: rankingCategory,
            query: elements.rankingSearch.value,
            gender: elements.rankingGenderFilter.value,
            groupId: elements.rankingGroupFilter.value,
            tagId: elements.rankingTagFilter.value,
            includeArchived: elements.rankingIncludeArchived.checked,
            sort: elements.rankingSort.value,
            scoreProvider: null
        };
    }

    function createRankingRow(item) {
        const participant = item.participant;
        const row = createElement("article", "ranking-row");
        row.dataset.archived = String(participant.archivedAt !== null);
        row.dataset.participantId = participant.id;

        const status = createElement("span", "ranking-status", "Sin ranking");
        const photo = createElement("div", "ranking-photo");
        const image = createElement("img");
        image.alt = `Foto de ${participant.name}`;
        image.hidden = true;
        const fallback = createElement("span", "", initials(participant.name));
        photo.append(image, fallback);
        if (participant.imageId) loadCardImage(participant.imageId, image, fallback);

        const copy = createElement("div", "ranking-copy");
        const nameLine = createElement("div", "ranking-name-line");
        nameLine.append(createElement("h3", "", participant.name));
        if (participant.archivedAt !== null) {
            nameLine.append(createElement("span", "ranking-archived", "Archivado"));
        }
        copy.append(nameLine, createElement("p", "ranking-group", item.group ? item.group.name : "Solista / Sin grupo"));

        const details = createElement("div", "ranking-details");
        details.append(createCategoryBadge(rankingCategory));
        const tags = createElement("div", "ranking-tags");
        item.tags.slice(0, 3).forEach((tag) => tags.append(createTagChip(tag)));
        if (item.tags.length > 3) tags.append(createElement("span", "tag-more", `+${item.tags.length - 3} más`));
        if (item.tags.length > 0) details.append(tags);
        details.append(createElement("span", "gender-label", genderLabel(participant.gender)));
        copy.append(details);

        const view = createElement("button", "button button--quiet ranking-view-button", "Ver perfil");
        view.type = "button";
        view.dataset.rankingParticipantId = participant.id;
        row.append(status, photo, copy, view);
        return row;
    }

    function renderRankingEmptyState(result) {
        const empty = result.items.length === 0;
        elements.rankingEmpty.hidden = !empty;
        if (!empty) return;

        const label = rankingCategoryLabel();
        const hasCategoryParticipants = state.participants.some((participant) => (
            participant.archivedAt === null && participant.categoryIds.includes(rankingCategory)
        ));
        if (hasCategoryParticipants) {
            elements.rankingEmptyTitle.textContent = "No hay participantes con estos filtros.";
            elements.rankingEmptyCopy.textContent = "Prueba otra búsqueda o limpia los filtros.";
            elements.rankingEmptyAction.textContent = "Limpiar filtros";
            elements.rankingEmptyAction.dataset.action = "reset";
        } else {
            elements.rankingEmptyTitle.textContent = `Aún no hay participantes en ${label}.`;
            elements.rankingEmptyCopy.textContent = "Agrega esta categoría desde Participantes.";
            elements.rankingEmptyAction.textContent = "Abrir participantes";
            elements.rankingEmptyAction.dataset.action = "participants";
        }
    }

    function renderRankings() {
        revokeCardUrls();
        const result = rankingsService.deriveRanking(state, currentRankingFilters());
        const fragment = document.createDocumentFragment();
        result.items.forEach((item) => fragment.append(createRankingRow(item)));
        elements.rankingList.replaceChildren(fragment);
        elements.rankingsView.dataset.category = rankingCategory;

        elements.rankingTabs.forEach((tab) => {
            const selected = tab.dataset.rankingCategory === rankingCategory;
            tab.setAttribute("aria-selected", String(selected));
            tab.tabIndex = selected ? 0 : -1;
        });
        const activeTab = elements.rankingTabs.find((tab) => tab.dataset.rankingCategory === rankingCategory);
        if (activeTab) elements.rankingPanel.setAttribute("aria-labelledby", activeTab.id);

        const label = rankingCategoryLabel();
        elements.rankingDirectoryTitle.textContent = `Participantes de ${label}`;
        elements.rankingResultCount.textContent = `${result.items.length} participante${result.items.length === 1 ? "" : "s"}`;
        renderRankingEmptyState(result);
    }

    function activeViewFromLocation() {
        if (root.location.hash === "#weekly") return "weekly";
        if (root.location.hash === "#spotlight") return "spotlight";
        if (root.location.hash === "#rankings") return "rankings";
        if (root.location.hash === "#analytics") return "analytics";
        if (root.location.hash.startsWith("#profile?")) return "profile";
        return "participants";
    }

    function profileIdFromLocation() {
        if (!root.location.hash.startsWith("#profile?")) return null;
        const query = root.location.hash.slice(root.location.hash.indexOf("?") + 1);
        return new URLSearchParams(query).get("participant");
    }

    function activateView(view, shouldRender = true) {
        activeView = ["participants", "profile", "weekly", "spotlight", "rankings", "analytics"].includes(view) ? view : "participants";
        elements.participantManager.hidden = activeView !== "participants";
        elements.profileView.hidden = activeView !== "profile";
        elements.weeklyView.hidden = activeView !== "weekly";
        elements.spotlightView.hidden = activeView !== "spotlight";
        elements.rankingsView.hidden = activeView !== "rankings";
        elements.analyticsView.hidden = activeView !== "analytics";
        [elements.navParticipants, elements.navWeekly, elements.navSpotlight, elements.navRankings, elements.navAnalytics]
            .forEach((link) => link.removeAttribute("aria-current"));
        if (activeView === "participants") elements.navParticipants.setAttribute("aria-current", "page");
        if (activeView === "profile") elements.navParticipants.setAttribute("aria-current", "page");
        if (activeView === "weekly") elements.navWeekly.setAttribute("aria-current", "page");
        if (activeView === "spotlight") elements.navSpotlight.setAttribute("aria-current", "page");
        if (activeView === "rankings") elements.navRankings.setAttribute("aria-current", "page");
        if (activeView === "analytics") elements.navAnalytics.setAttribute("aria-current", "page");
        const titles = { participants: "Participantes", profile: "Perfil", weekly: "Votación semanal", spotlight: "Destacados de la semana", rankings: "Rankings", analytics: "Estadísticas" };
        const profileParticipant = activeView === "profile" ? findParticipant(profileIdFromLocation() || currentProfileId) : null;
        document.title = `${profileParticipant?.name || titles[activeView]} · Stats V2`;
        if (shouldRender) {
            if (activeView === "rankings") renderRankings();
            else if (activeView === "analytics") analyticsController?.activate();
            else if (activeView === "weekly") weeklyController?.activate();
            else if (activeView === "spotlight") spotlightController?.activate();
            else if (activeView === "profile") {
                const participantId = profileIdFromLocation() || currentProfileId;
                if (findParticipant(participantId)) {
                    currentProfileId = participantId;
                    profileController?.activate(participantId);
                } else {
                    navigateToView("participants");
                }
            }
            else renderParticipants();
        }
    }

    function navigateToView(view) {
        const targetHash = `#${view}`;
        if (root.location.hash !== targetHash) root.history.pushState(null, "", targetHash);
        activateView(view);
        byId(view)?.scrollIntoView({ block: "start" });
    }

    function selectRankingCategory(categoryId, focusTab = false) {
        if (!constants.CATEGORIES.some((category) => category.id === categoryId)) return;
        rankingCategory = categoryId;
        renderRankings();
        if (focusTab) {
            elements.rankingTabs.find((tab) => tab.dataset.rankingCategory === categoryId)?.focus();
        }
    }

    function resetRankingFilters() {
        elements.rankingSearch.value = "";
        elements.rankingGenderFilter.value = "all";
        elements.rankingGroupFilter.value = "all";
        elements.rankingTagFilter.value = "all";
        elements.rankingSort.value = "a-z";
        elements.rankingIncludeArchived.checked = false;
        renderRankings();
    }

    function openParticipantProfile(participantId) {
        const participant = findParticipant(participantId);
        if (!participant) return;
        profileHasInternalReturn = activeView !== "profile";
        currentProfileId = participantId;
        const targetHash = `#profile?participant=${encodeURIComponent(participantId)}`;
        if (root.location.hash !== targetHash) root.history.pushState(null, "", targetHash);
        activateView("profile");
        elements.profileView.scrollIntoView({ block: "start" });
    }

    function backFromProfile() {
        if (profileHasInternalReturn) {
            profileHasInternalReturn = false;
            root.history.back();
            return;
        }
        navigateToView("participants");
    }

    function renderAll() {
        renderCounts();
        renderGroupOptions();
        renderTagFilterOptions();
        renderRankingFilterOptions();
        activateView(activeView);
    }

    function resetFilters() {
        elements.search.value = "";
        elements.genderFilter.value = "all";
        elements.statusFilter.value = "active";
        elements.categoryFilter.value = "all";
        elements.tagFilter.value = "all";
        elements.sort.value = "a-z";
        renderParticipants();
    }

    function tagCategoryLabel(categoryId) {
        return constants.TAG_CATEGORIES.find((category) => category.id === categoryId)?.label || "General";
    }

    function setTagWarning(message = "") {
        elements.tagCategoryWarning.textContent = message;
        elements.tagCategoryWarning.hidden = !message;
    }

    function renderAssignedTags() {
        const participant = findParticipant(tagParticipantId);
        if (!participant) return;
        const assigned = tagService.activeTagsForParticipant(state, participant.id).map((item) => item.tag);
        elements.assignedTagCount.textContent = String(assigned.length);
        elements.assignedTagsEmpty.hidden = assigned.length > 0;

        const fragment = document.createDocumentFragment();
        constants.TAG_TYPES.forEach((type) => {
            const matching = assigned.filter((tag) => tag.type === type);
            if (matching.length === 0) return;
            const group = createElement("section", `assigned-tag-group assigned-tag-group--${type}`);
            group.append(createElement("h4", "", constants.TAG_TYPE_LABELS[type]));
            const chips = createElement("div", "assigned-tag-chips");
            matching.forEach((tag) => chips.append(createTagChip(tag, true, participant.id)));
            group.append(chips);
            fragment.append(group);
        });
        elements.assignedTagGroups.replaceChildren(fragment);
    }

    function renderTagCatalog() {
        const participant = findParticipant(tagParticipantId);
        if (!participant) return;
        const assignedIds = new Set(tagService.activeTagsForParticipant(state, participant.id).map((item) => item.tag.id));
        const filtered = tagService.filterCatalog(state, {
            query: elements.tagSearch.value,
            categoryId: elements.tagCategoryFilter.value,
            type: elements.tagTypeFilter.value
        });
        const fragment = document.createDocumentFragment();

        filtered.forEach((tag) => {
            const row = createElement("article", `tag-catalog-item tag-catalog-item--${tag.type}`);
            const add = createElement("button", "tag-catalog-add");
            add.type = "button";
            add.dataset.tagAction = "assign";
            add.dataset.tagId = tag.id;
            add.disabled = assignedIds.has(tag.id);
            add.setAttribute("aria-pressed", String(assignedIds.has(tag.id)));
            add.append(
                createElement("span", "tag-catalog-name", tag.name),
                createElement(
                    "span",
                    "tag-catalog-meta",
                    `${constants.TAG_TYPE_LABELS[tag.type]} · ${tagCategoryLabel(tag.categoryId)}`
                )
            );
            row.append(add);

            if (!tag.predefined) {
                const actions = createElement("div", "tag-catalog-actions");
                const usage = tagService.tagUsage(state, tag.id);
                const edit = createElement("button", "text-button", "Editar");
                edit.type = "button";
                edit.dataset.tagAction = "edit-custom";
                edit.dataset.tagId = tag.id;
                edit.disabled = usage.totalReferences > 0;
                edit.setAttribute(
                    "aria-label",
                    usage.totalReferences > 0 ? `Editar ${tag.name}, no disponible mientras esté en uso` : `Editar ${tag.name}`
                );
                const remove = createElement("button", "text-button text-button--danger", "Eliminar");
                remove.type = "button";
                remove.dataset.tagAction = "delete-custom";
                remove.dataset.tagId = tag.id;
                remove.setAttribute("aria-label", `Eliminar tag personalizado ${tag.name}`);
                actions.append(edit, remove);
                row.append(actions);
            }
            fragment.append(row);
        });

        elements.tagCatalogList.replaceChildren(fragment);
        elements.tagCatalogEmpty.hidden = filtered.length > 0;
    }

    function renderTagDialog() {
        const participant = findParticipant(tagParticipantId);
        if (!participant) return;
        elements.tagDialogTitle.textContent = `Administrar tags de ${participant.name}`;
        elements.tagDialogIdentity.textContent = groupName(participant.groupId);
        renderAssignedTags();
        renderTagCatalog();
    }

    function hideCustomTagForm() {
        elements.customTagForm.hidden = true;
        elements.customTagForm.reset();
        elements.customTagId.value = "";
        elements.customTagAssignField.hidden = false;
        elements.customTagError.textContent = "";
        elements.customTagFormTitle.textContent = "Crear tag personalizado";
        elements.saveCustomTag.textContent = "Crear y asignar";
    }

    function updateCustomTagSubmitLabel() {
        if (elements.customTagId.value) {
            elements.saveCustomTag.textContent = "Guardar cambios";
            return;
        }
        elements.saveCustomTag.textContent = elements.assignCustomTag.checked ? "Crear y asignar" : "Crear tag";
    }

    function showCustomTagForm(tag = null) {
        elements.customTagForm.hidden = false;
        elements.customTagError.textContent = "";
        elements.customTagId.value = tag ? tag.id : "";
        elements.customTagName.value = tag ? tag.name : "";
        elements.customTagCategory.value = tag ? tag.categoryId : "general";
        elements.customTagType.value = tag ? tag.type : "neutral";
        elements.customTagAssignField.hidden = Boolean(tag);
        elements.customTagFormTitle.textContent = tag ? `Editar ${tag.name}` : "Crear tag personalizado";
        updateCustomTagSubmitLabel();
        requestAnimationFrame(() => elements.customTagName.focus());
    }

    function openTagDialog(participantId) {
        if (!writable) {
            showToast("La edición está bloqueada hasta recuperar el almacenamiento local.", "error");
            return;
        }
        const participant = findParticipant(participantId);
        if (!participant) return;
        returnFocusElement = document.activeElement;
        tagParticipantId = participantId;
        elements.tagSearch.value = "";
        elements.tagCategoryFilter.value = "all";
        elements.tagTypeFilter.value = "all";
        setTagWarning();
        hideCustomTagForm();
        renderTagDialog();
        elements.tagDialog.showModal();
        requestAnimationFrame(() => elements.tagSearch.focus());
    }

    function closeTagDialog() {
        if (elements.tagDialog.open) elements.tagDialog.close();
        tagParticipantId = null;
        hideCustomTagForm();
        setTagWarning();
        if (returnFocusElement && typeof returnFocusElement.focus === "function") returnFocusElement.focus();
    }

    function assignTagToCurrent(tagId) {
        const participant = findParticipant(tagParticipantId);
        const tag = findTag(tagId);
        if (!participant || !tag) return;
        try {
            const result = tagService.assignTag(state, participant.id, tag.id);
            if (result.created) commitState(result.state);
            renderTagDialog();
            setTagWarning(result.categoryWarning
                ? `${participant.name} no está actualmente en ${tagCategoryLabel(tag.categoryId)}, pero el tag fue permitido.`
                : "");
            showToast(result.created ? `${tag.name} asignado a ${participant.name}.` : `${tag.name} ya estaba asignado.`);
        } catch (error) {
            showToast("No se pudo asignar el tag.", "error");
        }
    }

    function removeTagFromCurrent(tagId) {
        const participant = findParticipant(tagParticipantId);
        const tag = findTag(tagId);
        if (!participant || !tag) return;
        try {
            const result = tagService.removeTag(state, participant.id, tag.id);
            commitState(result.state);
            setTagWarning();
            renderTagDialog();
            showToast(`${tag.name} removido de ${participant.name}.`);
        } catch (error) {
            showToast("No se pudo remover el tag.", "error");
        }
    }

    function submitCustomTag(event) {
        event.preventDefault();
        elements.customTagError.textContent = "";
        const editingTagId = elements.customTagId.value;
        const input = {
            name: elements.customTagName.value,
            categoryId: elements.customTagCategory.value,
            type: elements.customTagType.value
        };

        try {
            if (editingTagId) {
                const updated = tagService.updateCustomTag(state, editingTagId, input);
                commitState(updated.state);
                hideCustomTagForm();
                renderTagDialog();
                showToast(`${updated.tag.name} actualizado.`);
                return;
            }

            const catalogResult = tagService.createCustomTag(state, input);
            if (!elements.assignCustomTag.checked) {
                commitState(catalogResult.state);
                hideCustomTagForm();
                renderTagDialog();
                setTagWarning();
                showToast(catalogResult.created
                    ? `${catalogResult.tag.name} creado en el catálogo.`
                    : `${catalogResult.tag.name} ya existía en el catálogo.`);
                return;
            }
            const assignmentResult = tagService.assignTag(catalogResult.state, tagParticipantId, catalogResult.tag.id);
            commitState(assignmentResult.state);
            hideCustomTagForm();
            renderTagDialog();
            const participant = findParticipant(tagParticipantId);
            setTagWarning(assignmentResult.categoryWarning
                ? `${participant.name} no está actualmente en ${tagCategoryLabel(catalogResult.tag.categoryId)}, pero el tag fue permitido.`
                : "");
            showToast(catalogResult.created
                ? `${catalogResult.tag.name} creado y asignado.`
                : `${catalogResult.tag.name} ya existía y fue reutilizado.`);
        } catch (error) {
            elements.customTagError.textContent = error.message || "No se pudo guardar el tag.";
        }
    }

    function openTagDeleteDialog(tagId) {
        const tag = findTag(tagId);
        if (!tag || tag.predefined) return;
        const usage = tagService.tagUsage(state, tag.id);
        pendingTagDeleteId = tag.id;
        elements.tagDeleteDialogTitle.textContent = `¿Eliminar ${tag.name}?`;
        elements.confirmTagDelete.disabled = usage.totalReferences > 0;
        elements.tagDeleteDialogMessage.textContent = usage.totalReferences > 0
            ? `${tag.name} conserva ${usage.totalAssignments} relación(es) de perfil y ${usage.reasonVoteCount} razón(es) semanales. No puede borrarse ni romper el historial.`
            : `${tag.name} no tiene referencias y se eliminará del catálogo global.`;
        elements.tagDeleteDialog.showModal();
        requestAnimationFrame(() => elements.cancelTagDelete.focus());
    }

    function closeTagDeleteDialog() {
        if (elements.tagDeleteDialog.open) elements.tagDeleteDialog.close();
        pendingTagDeleteId = null;
    }

    function confirmTagDelete() {
        const tag = findTag(pendingTagDeleteId);
        if (!tag) return closeTagDeleteDialog();
        try {
            const result = tagService.deleteCustomTag(state, tag.id);
            commitState(result.state);
            closeTagDeleteDialog();
            renderTagDialog();
            showToast(`${tag.name} eliminado del catálogo.`);
        } catch (error) {
            closeTagDeleteDialog();
            showToast(error.message || "No se pudo borrar el tag.", "error");
        }
    }

    function clearPreviewUrl() {
        if (previewObjectUrl) {
            URL.revokeObjectURL(previewObjectUrl);
            previewObjectUrl = null;
        }
    }

    function showPhotoFallback(name) {
        clearPreviewUrl();
        elements.photoPreviewImage.removeAttribute("src");
        elements.photoPreviewImage.hidden = true;
        elements.photoPreviewFallback.hidden = false;
        elements.photoPreviewFallback.textContent = initials(name);
    }

    function showPhotoBlob(blob) {
        clearPreviewUrl();
        previewObjectUrl = URL.createObjectURL(blob);
        elements.photoPreviewImage.src = previewObjectUrl;
        elements.photoPreviewImage.hidden = false;
        elements.photoPreviewFallback.hidden = true;
    }

    async function loadExistingPhoto(participant) {
        if (!participant.imageId) return;
        try {
            const record = await imageStorage.getImage(participant.imageId);
            if (editingParticipantId !== participant.id || !elements.participantDialog.open) return;
            if (record && record.blob) {
                showPhotoBlob(record.blob);
            } else {
                elements.photoError.textContent = "La foto guardada no está disponible; puedes reemplazarla.";
            }
        } catch (error) {
            if (editingParticipantId === participant.id) {
                elements.photoError.textContent = "No se pudo cargar la foto; el participante sigue disponible.";
            }
        }
    }

    function clearFormErrors() {
        elements.formErrors.hidden = true;
        elements.formErrors.textContent = "";
        elements.nameError.textContent = "";
        elements.genderError.textContent = "";
        elements.categoriesError.textContent = "";
        elements.groupError.textContent = "";
        elements.photoError.textContent = "";
    }

    function showFormError(message) {
        elements.formErrors.textContent = message;
        elements.formErrors.hidden = false;
    }

    function openParticipantDialog(participantId = null) {
        if (!writable) {
            showToast("La edición está bloqueada hasta recuperar el almacenamiento local.", "error");
            return;
        }

        returnFocusElement = document.activeElement;
        editingParticipantId = participantId;
        selectedPhotoFile = null;
        removeExistingPhoto = false;
        elements.form.reset();
        elements.photoInput.value = "";
        elements.inlineGroupForm.hidden = true;
        elements.newGroupName.value = "";
        clearFormErrors();

        const participant = participantId ? findParticipant(participantId) : null;
        elements.participantId.value = participant ? participant.id : "";
        elements.dialogKicker.textContent = participant ? "Editar participante" : "Nuevo participante";
        elements.dialogTitle.textContent = participant ? `Editar ${participant.name}` : "Agregar participante";
        elements.saveButton.textContent = participant ? "Guardar cambios" : "Guardar participante";
        elements.name.value = participant ? participant.name : "";
        renderGroupOptions(participant ? participant.groupId : "");

        if (participant) {
            const gender = elements.form.querySelector(`input[name="gender"][value="${participant.gender}"]`);
            if (gender) gender.checked = true;
            elements.form.querySelectorAll('input[name="categories"]').forEach((checkbox) => {
                checkbox.checked = participant.categoryIds.includes(checkbox.value);
            });
            elements.removePhoto.hidden = !participant.imageId;
            showPhotoFallback(participant.name);
        } else {
            elements.removePhoto.hidden = true;
            showPhotoFallback("ST");
        }

        elements.participantDialog.showModal();
        requestAnimationFrame(() => elements.name.focus());
        if (participant && participant.imageId) loadExistingPhoto(participant);
    }

    function closeParticipantDialog() {
        if (elements.participantDialog.open) elements.participantDialog.close();
        clearPreviewUrl();
        selectedPhotoFile = null;
        removeExistingPhoto = false;
        editingParticipantId = null;
        if (returnFocusElement && typeof returnFocusElement.focus === "function") {
            returnFocusElement.focus();
        }
    }

    function validateParticipantForm() {
        clearFormErrors();
        const name = elements.name.value.trim();
        const gender = elements.form.querySelector('input[name="gender"]:checked')?.value || "";
        const categoryIds = [...elements.form.querySelectorAll('input[name="categories"]:checked')]
            .map((checkbox) => checkbox.value);
        let valid = true;

        if (!name) {
            elements.nameError.textContent = "El nombre es obligatorio.";
            valid = false;
        } else if (name.length > constants.MAX_NAME_LENGTH) {
            elements.nameError.textContent = `Usa ${constants.MAX_NAME_LENGTH} caracteres o menos.`;
            valid = false;
        }
        if (!gender) {
            elements.genderError.textContent = "Selecciona Mujer u Hombre.";
            valid = false;
        }
        if (categoryIds.length === 0) {
            elements.categoriesError.textContent = "Selecciona al menos una categoría.";
            valid = false;
        }

        if (!valid) showFormError("Revisa los campos marcados antes de guardar.");
        return {
            valid,
            input: {
                name,
                groupId: elements.groupSelect.value || null,
                gender,
                categoryIds
            }
        };
    }

    function handleParticipantError(error) {
        if (error.code === "DUPLICATE_PARTICIPANT") {
            elements.nameError.textContent = "Ya existe un participante activo con ese nombre exacto.";
            elements.name.focus();
            showFormError("Usa otro nombre o edita el participante existente.");
            return;
        }
        if (error.code === "MISSING_GROUP") {
            elements.groupError.textContent = "El grupo seleccionado ya no existe.";
            showFormError("Selecciona otro grupo.");
            return;
        }
        showFormError("No se pudo guardar. Revisa la información e inténtalo nuevamente.");
    }

    async function safelyDeleteImage(imageId) {
        if (!imageId || state.participants.some((participant) => participant.imageId === imageId)) {
            return true;
        }
        try {
            await imageStorage.deleteImage(imageId);
            return true;
        } catch (error) {
            return false;
        }
    }

    async function submitParticipant(event) {
        event.preventDefault();
        const formResult = validateParticipantForm();
        if (!formResult.valid) return;

        const current = editingParticipantId ? findParticipant(editingParticipantId) : null;
        const participantId = current ? current.id : data.createId("participant");
        const previousImageId = current ? current.imageId : null;
        let imageRecord = null;
        let plannedImageId = removeExistingPhoto ? null : previousImageId;

        try {
            if (selectedPhotoFile) {
                imageRecord = imageStorage.createImageRecord(selectedPhotoFile, participantId);
                plannedImageId = imageRecord.id;
            }

            const domainResult = current
                ? participantService.updateParticipant(state, current.id, {
                    ...formResult.input,
                    imageId: plannedImageId
                })
                : participantService.createParticipant(state, {
                    ...formResult.input,
                    id: participantId,
                    imageId: plannedImageId
                });

            elements.saveButton.disabled = true;
            elements.saveButton.textContent = "Guardando…";

            if (imageRecord) {
                try {
                    await imageStorage.putImage(imageRecord);
                } catch (error) {
                    elements.photoError.textContent = error.message || "No se pudo guardar la foto.";
                    showFormError("La foto no se guardó. Retírala o intenta con otra imagen.");
                    return;
                }
            }

            try {
                commitState(domainResult.state);
            } catch (error) {
                if (imageRecord) {
                    try { await imageStorage.deleteImage(imageRecord.id); } catch (cleanupError) { /* best effort */ }
                }
                showFormError("No se pudo guardar en este dispositivo. El formulario permanece abierto.");
                return;
            }

            let imageCleanupSucceeded = true;
            if (previousImageId && previousImageId !== plannedImageId) {
                imageCleanupSucceeded = await safelyDeleteImage(previousImageId);
            }

            const message = current ? `${domainResult.participant.name} actualizado.` : `${domainResult.participant.name} agregado.`;
            closeParticipantDialog();
            showToast(
                imageCleanupSucceeded ? message : `${message} La imagen anterior queda pendiente de limpieza.`,
                imageCleanupSucceeded ? "success" : "warning"
            );
        } catch (error) {
            handleParticipantError(error);
        } finally {
            elements.saveButton.disabled = false;
            elements.saveButton.textContent = current ? "Guardar cambios" : "Guardar participante";
        }
    }

    function handlePhotoSelection() {
        const file = elements.photoInput.files && elements.photoInput.files[0];
        elements.photoError.textContent = "";
        if (!file) return;
        const validation = imageStorage.validateImageFile(file);
        if (!validation.valid) {
            selectedPhotoFile = null;
            elements.photoInput.value = "";
            elements.photoError.textContent = validation.message;
            return;
        }

        selectedPhotoFile = file;
        removeExistingPhoto = false;
        elements.removePhoto.hidden = false;
        showPhotoBlob(file);
    }

    function removePhotoSelection() {
        const current = editingParticipantId ? findParticipant(editingParticipantId) : null;
        selectedPhotoFile = null;
        elements.photoInput.value = "";
        removeExistingPhoto = Boolean(current && current.imageId);
        elements.removePhoto.hidden = true;
        elements.photoError.textContent = "";
        showPhotoFallback(elements.name.value);
    }

    function toggleGroupForm(show) {
        elements.inlineGroupForm.hidden = !show;
        elements.groupError.textContent = "";
        if (show) requestAnimationFrame(() => elements.newGroupName.focus());
    }

    function createGroupFromForm() {
        elements.groupError.textContent = "";
        try {
            const result = participantService.createGroup(state, elements.newGroupName.value);
            commitState(result.state);
            renderGroupOptions(result.group.id);
            elements.newGroupName.value = "";
            toggleGroupForm(false);
            showToast(result.created ? `${result.group.name} creado.` : `${result.group.name} ya existía y fue reutilizado.`);
        } catch (error) {
            elements.groupError.textContent = error.code === "EMPTY_NAME"
                ? "Escribe un nombre de grupo."
                : "No se pudo guardar el grupo.";
        }
    }

    function handleParticipantAction(action, participantId) {
        try {
            if (action === "profile") {
                openParticipantProfile(participantId);
                return;
            }
            if (action === "tags") {
                openTagDialog(participantId);
                return;
            }
            if (action === "edit") {
                openParticipantDialog(participantId);
                return;
            }
            if (action === "delete") {
                openDeleteDialog(participantId);
                return;
            }

            const result = action === "archive"
                ? participantService.archiveParticipant(state, participantId)
                : participantService.restoreParticipant(state, participantId);
            commitState(result.state);
            showToast(action === "archive" ? `${result.participant.name} archivado.` : `${result.participant.name} restaurado.`);
        } catch (error) {
            showToast(
                error.code === "DUPLICATE_PARTICIPANT"
                    ? "No se puede restaurar: ya existe un participante activo con ese nombre."
                    : "No se pudo completar la operación.",
                "error"
            );
        }
    }

    function openDeleteDialog(participantId) {
        const participant = findParticipant(participantId);
        const deletion = participantService.canDeleteParticipant(state, participantId);
        deleteParticipantId = participantId;
        elements.deleteDialogTitle.textContent = deletion.allowed ? `¿Eliminar ${participant.name}?` : `¿Archivar ${participant.name}?`;

        if (deletion.allowed) {
            elements.deleteDialogMessage.textContent = `${participant.name} no tiene historial relacionado. Se eliminará permanentemente.`;
            elements.confirmDelete.textContent = "Eliminar permanentemente";
            elements.confirmDelete.dataset.mode = "delete";
        } else if (participant.archivedAt === null) {
            elements.deleteDialogMessage.textContent = `${participant.name} tiene relaciones históricas y no puede borrarse. Puedes archivarlo conservando todos sus datos.`;
            elements.confirmDelete.textContent = "Archivar participante";
            elements.confirmDelete.dataset.mode = "archive";
        } else {
            elements.deleteDialogMessage.textContent = `${participant.name} tiene relaciones históricas, por eso debe permanecer archivado.`;
            elements.confirmDelete.textContent = "Mantener archivado";
            elements.confirmDelete.dataset.mode = "close";
        }

        returnFocusElement = document.activeElement;
        elements.deleteDialog.showModal();
        requestAnimationFrame(() => elements.cancelDelete.focus());
    }

    function closeDeleteDialog() {
        if (elements.deleteDialog.open) elements.deleteDialog.close();
        deleteParticipantId = null;
        if (returnFocusElement && typeof returnFocusElement.focus === "function") returnFocusElement.focus();
    }

    async function confirmDelete() {
        const participant = findParticipant(deleteParticipantId);
        const mode = elements.confirmDelete.dataset.mode;
        if (mode === "close") {
            closeDeleteDialog();
            return;
        }

        try {
            const result = mode === "archive"
                ? participantService.archiveParticipant(state, participant.id)
                : participantService.deleteParticipant(state, participant.id);
            commitState(result.state);

            let cleanupSucceeded = true;
            if (mode === "delete" && participant.imageId) {
                cleanupSucceeded = await safelyDeleteImage(participant.imageId);
            }
            closeDeleteDialog();
            showToast(
                mode === "archive"
                    ? `${participant.name} archivado para conservar su historial.`
                    : cleanupSucceeded
                        ? `${participant.name} eliminado permanentemente.`
                        : `${participant.name} eliminado; su imagen queda pendiente de limpieza.`,
                cleanupSucceeded ? "success" : "warning"
            );
        } catch (error) {
            showToast("No se pudo completar la eliminación.", "error");
        }
    }

    function cacheElements() {
        elements = {
            participantManager: byId("participants"),
            profileView: byId("profile"),
            weeklyView: byId("weekly"),
            spotlightView: byId("spotlight"),
            rankingsView: byId("rankings"),
            analyticsView: byId("analytics"),
            navParticipants: byId("nav-participants"),
            navWeekly: byId("nav-weekly"),
            navSpotlight: byId("nav-spotlight"),
            navRankings: byId("nav-rankings"),
            navAnalytics: byId("nav-analytics"),
            participantCount: byId("participant-count"),
            storageStatus: byId("storage-status"),
            search: byId("participant-search"),
            genderFilter: byId("gender-filter"),
            statusFilter: byId("status-filter"),
            categoryFilter: byId("category-filter"),
            tagFilter: byId("tag-filter"),
            sort: byId("sort-participants"),
            resetFilters: byId("reset-filters"),
            grid: byId("participant-grid"),
            resultSummary: byId("result-summary"),
            empty: byId("participant-empty"),
            emptyButton: byId("empty-add-participant"),
            addButton: byId("add-participant"),
            participantDialog: byId("participant-dialog"),
            form: byId("participant-form"),
            participantId: byId("participant-id"),
            dialogKicker: byId("participant-dialog-kicker"),
            dialogTitle: byId("participant-dialog-title"),
            closeDialog: byId("close-participant-dialog"),
            cancelParticipant: byId("cancel-participant"),
            saveButton: byId("save-participant"),
            formErrors: byId("form-errors"),
            name: byId("participant-name"),
            nameError: byId("name-error"),
            genderError: byId("gender-error"),
            categoriesError: byId("categories-error"),
            groupSelect: byId("participant-group"),
            showGroupForm: byId("show-group-form"),
            inlineGroupForm: byId("inline-group-form"),
            newGroupName: byId("new-group-name"),
            createGroup: byId("create-group"),
            cancelGroup: byId("cancel-group"),
            groupError: byId("group-error"),
            photoInput: byId("participant-photo"),
            photoPreviewImage: byId("photo-preview-image"),
            photoPreviewFallback: byId("photo-preview-fallback"),
            photoError: byId("photo-error"),
            removePhoto: byId("remove-photo"),
            deleteDialog: byId("delete-dialog"),
            deleteDialogTitle: byId("delete-dialog-title"),
            deleteDialogMessage: byId("delete-dialog-message"),
            cancelDelete: byId("cancel-delete"),
            confirmDelete: byId("confirm-delete"),
            tagDialog: byId("tag-dialog"),
            tagDialogTitle: byId("tag-dialog-title"),
            tagDialogIdentity: byId("tag-dialog-identity"),
            closeTagDialog: byId("close-tag-dialog"),
            doneManagingTags: byId("done-managing-tags"),
            assignedTagCount: byId("assigned-tag-count"),
            assignedTagGroups: byId("assigned-tag-groups"),
            assignedTagsEmpty: byId("assigned-tags-empty"),
            tagSearch: byId("tag-search"),
            tagCategoryFilter: byId("tag-category-filter"),
            tagTypeFilter: byId("tag-type-filter"),
            tagCategoryWarning: byId("tag-category-warning"),
            tagCatalogList: byId("tag-catalog-list"),
            tagCatalogEmpty: byId("tag-catalog-empty"),
            showCustomTagForm: byId("show-custom-tag-form"),
            customTagForm: byId("custom-tag-form"),
            customTagId: byId("custom-tag-id"),
            customTagFormTitle: byId("custom-tag-form-title"),
            customTagName: byId("custom-tag-name"),
            customTagCategory: byId("custom-tag-category"),
            customTagType: byId("custom-tag-type"),
            customTagAssignField: byId("custom-tag-assign-field"),
            assignCustomTag: byId("assign-custom-tag"),
            customTagError: byId("custom-tag-error"),
            cancelCustomTag: byId("cancel-custom-tag"),
            saveCustomTag: byId("save-custom-tag"),
            tagDeleteDialog: byId("tag-delete-dialog"),
            tagDeleteDialogTitle: byId("tag-delete-dialog-title"),
            tagDeleteDialogMessage: byId("tag-delete-dialog-message"),
            cancelTagDelete: byId("cancel-tag-delete"),
            confirmTagDelete: byId("confirm-tag-delete"),
            rankingPanel: byId("ranking-panel"),
            rankingTabs: [...document.querySelectorAll("[data-ranking-category]")],
            rankingSearch: byId("ranking-search"),
            rankingGenderFilter: byId("ranking-gender-filter"),
            rankingGroupFilter: byId("ranking-group-filter"),
            rankingTagFilter: byId("ranking-tag-filter"),
            rankingSort: byId("ranking-sort"),
            rankingIncludeArchived: byId("ranking-include-archived"),
            resetRankingFilters: byId("reset-ranking-filters"),
            rankingDirectoryTitle: byId("ranking-directory-title"),
            rankingResultCount: byId("ranking-result-count"),
            rankingList: byId("ranking-list"),
            rankingEmpty: byId("ranking-empty"),
            rankingEmptyTitle: byId("ranking-empty-title"),
            rankingEmptyCopy: byId("ranking-empty-copy"),
            rankingEmptyAction: byId("ranking-empty-action"),
            toast: byId("app-toast")
        };
    }

    function bindEvents() {
        elements.navParticipants.addEventListener("click", (event) => {
            event.preventDefault();
            navigateToView("participants");
        });
        elements.navWeekly.addEventListener("click", (event) => {
            event.preventDefault();
            navigateToView("weekly");
        });
        elements.navSpotlight.addEventListener("click", (event) => {
            event.preventDefault();
            navigateToView("spotlight");
        });
        elements.navRankings.addEventListener("click", (event) => {
            event.preventDefault();
            navigateToView("rankings");
        });
        elements.navAnalytics.addEventListener("click", (event) => {
            event.preventDefault();
            navigateToView("analytics");
        });
        root.addEventListener("hashchange", () => activateView(activeViewFromLocation()));

        elements.addButton.addEventListener("click", () => openParticipantDialog());
        elements.emptyButton.addEventListener("click", () => {
            if (elements.emptyButton.dataset.action === "reset") resetFilters();
            else openParticipantDialog();
        });
        elements.search.addEventListener("input", renderParticipants);
        [elements.genderFilter, elements.statusFilter, elements.categoryFilter, elements.tagFilter, elements.sort]
            .forEach((control) => control.addEventListener("change", renderParticipants));
        elements.resetFilters.addEventListener("click", resetFilters);
        elements.grid.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-action]");
            if (button) handleParticipantAction(button.dataset.action, button.dataset.participantId);
        });

        elements.form.addEventListener("submit", submitParticipant);
        elements.closeDialog.addEventListener("click", closeParticipantDialog);
        elements.cancelParticipant.addEventListener("click", closeParticipantDialog);
        elements.participantDialog.addEventListener("cancel", (event) => {
            event.preventDefault();
            closeParticipantDialog();
        });
        elements.participantDialog.addEventListener("click", (event) => {
            if (event.target === elements.participantDialog) closeParticipantDialog();
        });
        elements.name.addEventListener("input", () => {
            if (elements.photoPreviewImage.hidden) {
                elements.photoPreviewFallback.textContent = initials(elements.name.value);
            }
        });
        elements.photoInput.addEventListener("change", handlePhotoSelection);
        elements.removePhoto.addEventListener("click", removePhotoSelection);
        elements.showGroupForm.addEventListener("click", () => toggleGroupForm(true));
        elements.cancelGroup.addEventListener("click", () => toggleGroupForm(false));
        elements.createGroup.addEventListener("click", createGroupFromForm);
        elements.newGroupName.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                createGroupFromForm();
            }
        });

        elements.cancelDelete.addEventListener("click", closeDeleteDialog);
        elements.confirmDelete.addEventListener("click", confirmDelete);
        elements.deleteDialog.addEventListener("cancel", (event) => {
            event.preventDefault();
            closeDeleteDialog();
        });
        elements.deleteDialog.addEventListener("click", (event) => {
            if (event.target === elements.deleteDialog) closeDeleteDialog();
        });

        elements.closeTagDialog.addEventListener("click", closeTagDialog);
        elements.doneManagingTags.addEventListener("click", closeTagDialog);
        elements.tagDialog.addEventListener("cancel", (event) => {
            event.preventDefault();
            closeTagDialog();
        });
        elements.tagDialog.addEventListener("click", (event) => {
            if (event.target === elements.tagDialog) closeTagDialog();
        });
        elements.assignedTagGroups.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-tag-action='remove']");
            if (button) removeTagFromCurrent(button.dataset.tagId);
        });
        elements.tagSearch.addEventListener("input", renderTagCatalog);
        [elements.tagCategoryFilter, elements.tagTypeFilter]
            .forEach((control) => control.addEventListener("change", renderTagCatalog));
        elements.tagCatalogList.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-tag-action]");
            if (!button) return;
            const tag = findTag(button.dataset.tagId);
            if (button.dataset.tagAction === "assign") assignTagToCurrent(button.dataset.tagId);
            if (button.dataset.tagAction === "edit-custom" && tag) showCustomTagForm(tag);
            if (button.dataset.tagAction === "delete-custom") openTagDeleteDialog(button.dataset.tagId);
        });
        elements.showCustomTagForm.addEventListener("click", () => showCustomTagForm());
        elements.cancelCustomTag.addEventListener("click", hideCustomTagForm);
        elements.customTagForm.addEventListener("submit", submitCustomTag);
        elements.assignCustomTag.addEventListener("change", updateCustomTagSubmitLabel);

        elements.cancelTagDelete.addEventListener("click", closeTagDeleteDialog);
        elements.confirmTagDelete.addEventListener("click", confirmTagDelete);
        elements.tagDeleteDialog.addEventListener("cancel", (event) => {
            event.preventDefault();
            closeTagDeleteDialog();
        });
        elements.tagDeleteDialog.addEventListener("click", (event) => {
            if (event.target === elements.tagDeleteDialog) closeTagDeleteDialog();
        });

        elements.rankingTabs.forEach((tab, index) => {
            tab.addEventListener("click", () => selectRankingCategory(tab.dataset.rankingCategory));
            tab.addEventListener("keydown", (event) => {
                let targetIndex = null;
                if (event.key === "ArrowRight") targetIndex = (index + 1) % elements.rankingTabs.length;
                if (event.key === "ArrowLeft") targetIndex = (index - 1 + elements.rankingTabs.length) % elements.rankingTabs.length;
                if (event.key === "Home") targetIndex = 0;
                if (event.key === "End") targetIndex = elements.rankingTabs.length - 1;
                if (targetIndex === null) return;
                event.preventDefault();
                selectRankingCategory(elements.rankingTabs[targetIndex].dataset.rankingCategory, true);
            });
        });
        elements.rankingSearch.addEventListener("input", renderRankings);
        [elements.rankingGenderFilter, elements.rankingGroupFilter, elements.rankingTagFilter, elements.rankingSort, elements.rankingIncludeArchived]
            .forEach((control) => control.addEventListener("change", renderRankings));
        elements.resetRankingFilters.addEventListener("click", resetRankingFilters);
        elements.rankingList.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-ranking-participant-id]");
            if (button) openParticipantProfile(button.dataset.rankingParticipantId);
        });
        elements.rankingEmptyAction.addEventListener("click", () => {
            if (elements.rankingEmptyAction.dataset.action === "reset") resetRankingFilters();
            else navigateToView("participants");
        });
    }

    function initialize() {
        if (!constants || !data || !storage || !participantService || !tagService || !rankingsService
            || !weeklyService || !weeklyMigration || !weeklyViewService || !spotlightService
            || !spotlightViewService || !profileHistoryService || !profileViewService || !analyticsViewService || !imageStorage) {
            throw new Error("Stats V2 participant, tag, weekly, Spotlight, profile, ranking and Analytics modules did not load correctly.");
        }

        cacheElements();
        bindEvents();
        const result = storage.initialize();
        state = result.state;
        writable = result.status === "ready" || result.status === "initialized";
        if (writable) {
            try {
                const weeklyUpgrade = weeklyMigration.ensureWeeklyVoting(state);
                if (weeklyUpgrade.changed) {
                    state = storage.saveWithNamedBackup(
                        weeklyUpgrade.state,
                        constants.WEEKLY_MIGRATION_BACKUP_KEY
                    );
                    result.status = "weekly-migrated";
                }
                const categoryUpgrade = weeklyMigration.ensureCategoryVoting(state);
                if (categoryUpgrade.changed) {
                    state = storage.saveWithNamedBackup(
                        categoryUpgrade.state,
                        constants.CATEGORY_VOTING_MIGRATION_BACKUP_KEY
                    );
                    result.status = "category-voting-migrated";
                    result.legacyUncategorizedCount = categoryUpgrade.legacyUncategorizedCount;
                }
                const tagMigration = tagService.ensurePredefinedCatalog(state);
                if (tagMigration.changed) {
                    state = storage.saveWithBackup(tagMigration.state);
                    result.status = "migrated";
                    result.tagsAdded = tagMigration.addedCount;
                }
            } catch (error) {
                writable = false;
                result.status = "unavailable";
                result.errors = [error.message];
            }
        }
        elements.addButton.disabled = !writable;
        elements.emptyButton.disabled = !writable;
        weeklyController = weeklyViewService.createController({
            getState: () => state,
            commitState,
            canWrite: () => writable,
            notify: showToast,
            viewParticipant: openParticipantProfile
        });
        spotlightController = spotlightViewService.createController({
            getState: () => state,
            viewParticipant: openParticipantProfile
        });
        profileController = profileViewService.createController({
            getState: () => state,
            goBack: backFromProfile,
            editParticipant: openParticipantDialog,
            manageTags: openTagDialog
        });
        analyticsController = analyticsViewService.createController({
            getState: () => state,
            viewParticipant: openParticipantProfile
        });
        activeView = activeViewFromLocation();
        showStorageStatus(result);
        renderAll();
    }

    document.addEventListener("DOMContentLoaded", initialize);
})(globalThis);
