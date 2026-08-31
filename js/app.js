(function startApplication(root) {
    "use strict";

    const namespace = root.StatsV2;

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = String(value);
        }
    }

    function showStorageStatus(result) {
        const status = document.getElementById("storage-status");
        if (!status) return;

        const legacyNote = result.legacyRemoved ? " · Legacy eliminado" : "";
        const messages = {
            ready: `Datos locales listos${legacyNote}`,
            initialized: `Estado V2 inicializado${legacyNote}`,
            invalid: "Datos V2 inválidos: el original no fue sobrescrito",
            unavailable: "Almacenamiento no disponible: sesión temporal"
        };

        status.textContent = messages[result.status] || "Estado local desconocido";
        if (result.status === "invalid") status.dataset.state = "error";
        if (result.status === "unavailable") status.dataset.state = "warning";
    }

    function renderFoundation() {
        if (!namespace || !namespace.storage || !namespace.constants) {
            throw new Error("Stats V2 foundation modules did not load correctly.");
        }

        const result = namespace.storage.initialize();
        const state = result.state;
        const activeWeek = state.weeks.find((week) => week.id === state.settings.activeWeekId);

        setText("participant-count", state.participants.length);
        setText("active-week", activeWeek ? activeWeek.label : "—");
        setText("vote-count", state.weeklyVotes.length);
        setText("tag-count", state.tags.length);
        setText("schema-version", `Schema v${namespace.constants.SCHEMA_VERSION}`);
        showStorageStatus(result);
    }

    document.addEventListener("DOMContentLoaded", renderFoundation);
})(globalThis);
