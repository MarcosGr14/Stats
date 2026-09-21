(function defineBackupView(root) {
    "use strict";

    const namespace = root.StatsV2 || {};
    const constants = namespace.constants;
    const backupService = namespace.backup;
    const imageStorage = namespace.imageStorage;

    if (!constants || !backupService || !imageStorage) {
        throw new Error("Stats V2 backup services must load before the backup view.");
    }

    function dateParts(date = new Date()) {
        const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Panama",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23"
        }).formatToParts(date).reduce((result, part) => {
            result[part.type] = part.value;
            return result;
        }, {});
        return `${parts.year}-${parts.month}-${parts.day}-${parts.hour}${parts.minute}`;
    }

    function formatSize(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString("es-PA", { maximumFractionDigits: 1 })} KB`;
        return `${(bytes / (1024 * 1024)).toLocaleString("es-PA", { maximumFractionDigits: 1 })} MB`;
    }

    function downloadText(text, fileName, documentRef = root.document) {
        const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
        const link = documentRef.createElement("a");
        link.href = url;
        link.download = fileName;
        documentRef.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    function createController(options) {
        const documentRef = options.document || root.document;
        const localStorage = options.localStorage || root.localStorage;
        const indexedDb = options.indexedDb || root.indexedDB;
        const byId = (id) => documentRef.getElementById(id);
        const elements = {
            shell: documentRef.querySelector(".site-shell"),
            view: byId("data-safety"),
            exportButton: byId("export-backup"),
            importFile: byId("import-backup-file"),
            importError: byId("import-backup-error"),
            lastExport: byId("last-export-status"),
            openReset: byId("open-reset-data"),
            resetDialog: byId("reset-data-dialog"),
            resetInput: byId("reset-confirmation"),
            resetError: byId("reset-data-error"),
            resetConfirm: byId("confirm-reset-data"),
            resetCancel: byId("cancel-reset-data"),
            exportBeforeReset: byId("export-before-reset"),
            previewDialog: byId("backup-preview-dialog"),
            closePreview: byId("close-backup-preview"),
            cancelPreview: byId("cancel-backup-preview"),
            confirmRestore: byId("confirm-restore-backup"),
            restoreError: byId("restore-backup-error"),
            recovery: byId("recovery-mode"),
            recoveryDetail: byId("recovery-detail"),
            recoveryFile: byId("recovery-import-file"),
            recoveryError: byId("recovery-error"),
            downloadRaw: byId("download-raw-state"),
            restart: byId("restart-stats")
        };
        let pendingRestore = null;
        let recoveryRaw = null;
        let returnFocus = null;

        function setBusy(button, busy, busyLabel, regularLabel) {
            button.disabled = busy;
            button.textContent = busy ? busyLabel : regularLabel;
        }

        function closePreview() {
            if (elements.previewDialog.open) elements.previewDialog.close();
            pendingRestore = null;
            elements.restoreError.textContent = "";
            if (returnFocus && typeof returnFocus.focus === "function") returnFocus.focus();
        }

        function fillPreview(validated) {
            const summary = validated.summary;
            ["participants", "groups", "tags", "weeks", "votes", "images"].forEach((key) => {
                byId(`preview-${key}`).textContent = String(summary[key]);
            });
            byId("preview-size").textContent = `Tamaño estimado: ${formatSize(summary.estimatedBytes)}.`;
        }

        function openPreview(validated, trigger) {
            pendingRestore = validated;
            returnFocus = trigger;
            elements.restoreError.textContent = "";
            fillPreview(validated);
            elements.previewDialog.showModal();
            requestAnimationFrame(() => elements.confirmRestore.focus());
        }

        async function readBackupInput(input, errorElement) {
            const file = input.files && input.files[0];
            if (!file) return;
            errorElement.textContent = "";
            try {
                const validated = await backupService.parseBackupText(await file.text());
                openPreview(validated, input);
            } catch (error) {
                errorElement.textContent = backupService.friendlyError(error);
            } finally {
                input.value = "";
            }
        }

        async function doExport(button = elements.exportButton) {
            const currentState = options.getState();
            if (!currentState) throw new Error("No hay un estado válido para exportar.");
            setBusy(button, true, "Preparando…", button === elements.exportBeforeReset ? "Exportar antes" : "Exportar backup");
            try {
                const result = await backupService.exportCurrent(currentState, { indexedDb });
                downloadText(result.text, `stats-backup-${dateParts()}.json`, documentRef);
                const timestamp = new Date().toISOString();
                try { localStorage.setItem(constants.LAST_EXPORT_KEY, timestamp); } catch (error) { /* Optional metadata only. */ }
                if (elements.lastExport) elements.lastExport.textContent = `Última exportación: ${new Date(timestamp).toLocaleString("es-PA")}.`;
                options.notify(`Backup completo exportado (${formatSize(result.summary.estimatedBytes)}).`);
                return result;
            } catch (error) {
                options.notify(backupService.friendlyError(error), "error");
                throw error;
            } finally {
                setBusy(button, false, "Preparando…", button === elements.exportBeforeReset ? "Exportar antes" : "Exportar backup");
            }
        }

        async function confirmRestore() {
            if (!pendingRestore) return;
            elements.restoreError.textContent = "";
            setBusy(elements.confirmRestore, true, "Restaurando…", "Restaurar backup");
            try {
                await backupService.restoreValidated(pendingRestore, {
                    localStorage,
                    indexedDb,
                    beforeWrite: ({ safetyBackup, recoverySnapshot, rawState }) => {
                        if (safetyBackup) {
                            downloadText(JSON.stringify(safetyBackup, null, 2), `stats-pre-restore-${dateParts()}.json`, documentRef);
                        } else if (recoverySnapshot) {
                            downloadText(JSON.stringify(recoverySnapshot, null, 2), `stats-pre-restore-recovery-${dateParts()}.json`, documentRef);
                        } else if (rawState !== null) {
                            downloadText(rawState, `stats-recovery-raw-${dateParts().slice(0, 10)}.json`, documentRef);
                        }
                    }
                });
                options.notify("Backup restaurado y validado correctamente.");
                elements.previewDialog.close();
                root.location.reload();
            } catch (error) {
                elements.restoreError.textContent = backupService.friendlyError(error);
            } finally {
                setBusy(elements.confirmRestore, false, "Restaurando…", "Restaurar backup");
            }
        }

        function openReset() {
            returnFocus = documentRef.activeElement;
            elements.resetInput.value = "";
            elements.resetConfirm.disabled = true;
            elements.resetError.textContent = "";
            elements.resetDialog.showModal();
            requestAnimationFrame(() => elements.exportBeforeReset.focus());
        }

        function closeReset() {
            if (elements.resetDialog.open) elements.resetDialog.close();
            if (returnFocus && typeof returnFocus.focus === "function") returnFocus.focus();
        }

        async function confirmReset() {
            if (elements.resetInput.value !== "BORRAR") return;
            elements.resetError.textContent = "";
            setBusy(elements.resetConfirm, true, "Borrando…", "Borrar definitivamente");
            try {
                await backupService.resetAll({ localStorage, indexedDb });
                root.location.reload();
            } catch (error) {
                elements.resetError.textContent = backupService.friendlyError(error);
                setBusy(elements.resetConfirm, false, "Borrando…", "Borrar definitivamente");
            }
        }

        async function renderSummary() {
            const currentState = options.getState();
            if (!currentState) return;
            byId("data-summary-participants").textContent = String(currentState.participants.length);
            byId("data-summary-weeks").textContent = String(currentState.weeks.length);
            byId("data-summary-votes").textContent = String(currentState.weeklyVotes.length);
            try {
                byId("data-summary-images").textContent = String((await imageStorage.listImages(indexedDb)).length);
            } catch (error) {
                byId("data-summary-images").textContent = "—";
            }
            const lastExport = localStorage.getItem(constants.LAST_EXPORT_KEY);
            elements.lastExport.textContent = lastExport
                ? `Última exportación: ${new Date(lastExport).toLocaleString("es-PA")}.`
                : "Aún no hay una exportación registrada.";
        }

        function activate() {
            renderSummary();
        }

        function activateRecovery(result) {
            recoveryRaw = localStorage.getItem(constants.STORAGE_KEY);
            elements.shell.hidden = true;
            elements.recovery.hidden = false;
            elements.downloadRaw.disabled = recoveryRaw === null;
            const detail = result.status === "invalid"
                ? "El estado local no tiene una estructura válida. Conservamos el contenido original sin cambios."
                : "No fue posible acceder al almacenamiento local. Conservamos el contenido disponible sin cambios.";
            elements.recoveryDetail.textContent = detail;
            documentRef.title = "Recuperación · Stats V2";
            requestAnimationFrame(() => elements.recoveryFile.focus());
        }

        elements.exportButton.addEventListener("click", () => doExport().catch(() => {}));
        elements.exportBeforeReset.addEventListener("click", () => doExport(elements.exportBeforeReset).catch(() => {}));
        elements.importFile.addEventListener("change", () => readBackupInput(elements.importFile, elements.importError));
        elements.recoveryFile.addEventListener("change", () => readBackupInput(elements.recoveryFile, elements.recoveryError));
        elements.closePreview.addEventListener("click", closePreview);
        elements.cancelPreview.addEventListener("click", closePreview);
        elements.previewDialog.addEventListener("cancel", (event) => { event.preventDefault(); closePreview(); });
        elements.confirmRestore.addEventListener("click", confirmRestore);
        elements.openReset.addEventListener("click", openReset);
        elements.resetCancel.addEventListener("click", closeReset);
        elements.resetDialog.addEventListener("cancel", (event) => { event.preventDefault(); closeReset(); });
        elements.resetInput.addEventListener("input", () => {
            elements.resetConfirm.disabled = elements.resetInput.value !== "BORRAR";
        });
        elements.resetConfirm.addEventListener("click", confirmReset);
        elements.downloadRaw.addEventListener("click", () => {
            if (recoveryRaw !== null) downloadText(recoveryRaw, `stats-recovery-raw-${dateParts().slice(0, 10)}.json`, documentRef);
        });
        elements.restart.addEventListener("click", () => root.location.reload());

        return Object.freeze({ activate, activateRecovery, renderSummary });
    }

    namespace.backupView = Object.freeze({ createController, downloadText, formatSize, dateParts });
    root.StatsV2 = namespace;
})(globalThis);
