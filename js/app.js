(function startApplication(root) {
    "use strict";

    const namespace = root.StatsV2;
    const constants = namespace && namespace.constants;
    const data = namespace && namespace.data;
    const storage = namespace && namespace.storage;
    const participantService = namespace && namespace.participants;
    const imageStorage = namespace && namespace.imageStorage;

    let state = null;
    let writable = false;
    let editingParticipantId = null;
    let deleteParticipantId = null;
    let selectedPhotoFile = null;
    let removeExistingPhoto = false;
    let previewObjectUrl = null;
    let cardObjectUrls = [];
    let returnFocusElement = null;
    let toastTimer = null;
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

    function initials(name) {
        const words = String(name || "ST").trim().split(/\s+/).filter(Boolean);
        if (words.length === 0) return "ST";
        if (words.length === 1) return words[0].slice(0, 2).toLocaleUpperCase("es");
        return `${words[0][0]}${words[1][0]}`.toLocaleUpperCase("es");
    }

    function groupName(groupId) {
        if (!groupId) return "Soloist / No group";
        return state.groups.find((group) => group.id === groupId)?.name || "Unknown group";
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
            throw new Error("Persistent storage is not available.");
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
        setText("schema-version", `Schema v${constants.SCHEMA_VERSION}`);
        elements.participantCount.setAttribute(
            "aria-label",
            `${state.participants.length} participante${state.participants.length === 1 ? "" : "s"}`
        );
    }

    function renderGroupOptions(selectedValue = elements.groupSelect.value) {
        const fragment = document.createDocumentFragment();
        const noGroup = createElement("option", "", "Soloist / No group");
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

        const photo = createElement("div", "card-photo");
        const image = createElement("img");
        image.alt = `Foto de ${participant.name}`;
        image.hidden = true;
        const fallback = createElement("span", "card-photo-fallback", initials(participant.name));
        photo.append(image, fallback);
        if (participant.archivedAt !== null) {
            photo.append(createElement("span", "archived-badge", "Archived"));
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

        const meta = createElement("div", "participant-meta");
        meta.append(createElement("span", "gender-label", participant.gender));
        const actions = createElement("div", "card-actions");
        actions.append(
            actionButton("Edit", "edit", participant.id),
            actionButton(participant.archivedAt ? "Restore" : "Archive", participant.archivedAt ? "restore" : "archive", participant.id),
            actionButton("Delete", "delete", participant.id)
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
            sort: elements.sort.value
        };
    }

    function renderEmptyState(filteredCount) {
        const hasParticipants = state.participants.length > 0;
        const isEmpty = filteredCount === 0;
        elements.empty.hidden = !isEmpty;
        if (!isEmpty) return;

        if (hasParticipants) {
            setText("empty-kicker", "No matching performers");
            setText("empty-title", "No results found");
            setText("empty-copy", "Try another search or clear the active filters.");
            elements.emptyButton.textContent = "Reset filters";
            elements.emptyButton.dataset.action = "reset";
        } else {
            setText("empty-kicker", "Your roster starts here");
            setText("empty-title", "No participants yet");
            setText("empty-copy", "Add your first performer and assign every category where they stand out.");
            elements.emptyButton.textContent = "Add first participant";
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
        elements.resultSummary.textContent = `${filtered.length} ${statusLabel} performer${filtered.length === 1 ? "" : "s"}`;
        renderEmptyState(filtered.length);
    }

    function renderAll() {
        renderCounts();
        renderGroupOptions();
        renderParticipants();
    }

    function resetFilters() {
        elements.search.value = "";
        elements.genderFilter.value = "all";
        elements.statusFilter.value = "active";
        elements.categoryFilter.value = "all";
        elements.sort.value = "a-z";
        renderParticipants();
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
        elements.dialogKicker.textContent = participant ? "Edit roster entry" : "New roster entry";
        elements.dialogTitle.textContent = participant ? `Edit ${participant.name}` : "Add participant";
        elements.saveButton.textContent = participant ? "Save changes" : "Save participant";
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
            elements.genderError.textContent = "Selecciona Male o Female.";
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
            elements.saveButton.textContent = "Saving…";

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

            const message = current ? `${domainResult.participant.name} actualizado.` : `${domainResult.participant.name} añadido al roster.`;
            closeParticipantDialog();
            showToast(
                imageCleanupSucceeded ? message : `${message} La imagen anterior queda pendiente de limpieza.`,
                imageCleanupSucceeded ? "success" : "warning"
            );
        } catch (error) {
            handleParticipantError(error);
        } finally {
            elements.saveButton.disabled = false;
            elements.saveButton.textContent = current ? "Save changes" : "Save participant";
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
        elements.deleteDialogTitle.textContent = deletion.allowed ? `Delete ${participant.name}?` : `Archive ${participant.name}?`;

        if (deletion.allowed) {
            elements.deleteDialogMessage.textContent = `${participant.name} no tiene historial relacionado. Se eliminará permanentemente.`;
            elements.confirmDelete.textContent = "Delete permanently";
            elements.confirmDelete.dataset.mode = "delete";
        } else if (participant.archivedAt === null) {
            elements.deleteDialogMessage.textContent = `${participant.name} tiene relaciones históricas y no puede borrarse. Puedes archivarlo conservando todos sus datos.`;
            elements.confirmDelete.textContent = "Archive participant";
            elements.confirmDelete.dataset.mode = "archive";
        } else {
            elements.deleteDialogMessage.textContent = `${participant.name} tiene relaciones históricas, por eso debe permanecer archivado.`;
            elements.confirmDelete.textContent = "Keep archived";
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
            participantCount: byId("participant-count"),
            storageStatus: byId("storage-status"),
            search: byId("participant-search"),
            genderFilter: byId("gender-filter"),
            statusFilter: byId("status-filter"),
            categoryFilter: byId("category-filter"),
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
            toast: byId("app-toast")
        };
    }

    function bindEvents() {
        elements.addButton.addEventListener("click", () => openParticipantDialog());
        elements.emptyButton.addEventListener("click", () => {
            if (elements.emptyButton.dataset.action === "reset") resetFilters();
            else openParticipantDialog();
        });
        elements.search.addEventListener("input", renderParticipants);
        [elements.genderFilter, elements.statusFilter, elements.categoryFilter, elements.sort]
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
    }

    function initialize() {
        if (!constants || !data || !storage || !participantService || !imageStorage) {
            throw new Error("Stats V2 participant modules did not load correctly.");
        }

        cacheElements();
        bindEvents();
        const result = storage.initialize();
        state = result.state;
        writable = result.status === "ready" || result.status === "initialized";
        elements.addButton.disabled = !writable;
        elements.emptyButton.disabled = !writable;
        showStorageStatus(result);
        renderAll();
    }

    document.addEventListener("DOMContentLoaded", initialize);
})(globalThis);
