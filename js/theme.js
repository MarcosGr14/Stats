(function defineThemeController(root) {
    "use strict";

    const STORAGE_KEY = "stats-v2-theme";
    const MODES = new Set(["auto", "light", "dark"]);
    const media = root.matchMedia?.("(prefers-color-scheme: light)");

    function readMode() {
        try {
            const saved = root.localStorage.getItem(STORAGE_KEY);
            return MODES.has(saved) ? saved : "auto";
        } catch (_) {
            return "auto";
        }
    }

    let mode = readMode();

    function applyTheme() {
        const resolved = mode === "auto" ? (media?.matches ? "light" : "dark") : mode;
        root.document.documentElement.dataset.theme = resolved;
        const meta = root.document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = resolved === "light" ? "#F4F2EC" : "#0E0E12";
        const select = root.document.getElementById("theme-select");
        if (select && select.value !== mode) select.value = mode;
        const toggle = root.document.getElementById("theme-toggle");
        if (toggle) {
            const nextTheme = resolved === "light" ? "dark" : "light";
            const label = `Cambiar a tema ${nextTheme === "light" ? "claro" : "oscuro"}`;
            toggle.setAttribute("aria-label", label);
            toggle.title = label;
            const icon = toggle.querySelector(".theme-toggle-icon");
            const text = toggle.querySelector(".theme-toggle-label");
            if (icon) icon.textContent = nextTheme === "light" ? "☼" : "◐";
            if (text) text.textContent = nextTheme === "light" ? "Modo claro" : "Modo oscuro";
        }
    }

    function setMode(nextMode) {
        if (!MODES.has(nextMode)) return;
        mode = nextMode;
        try {
            root.localStorage.setItem(STORAGE_KEY, mode);
        } catch (_) {
            // The current session still applies the chosen theme when storage is unavailable.
        }
        applyTheme();
    }

    function initialize() {
        const select = root.document.getElementById("theme-select");
        if (select) {
            select.value = mode;
            select.addEventListener("change", () => setMode(select.value));
        }
        const toggle = root.document.getElementById("theme-toggle");
        toggle?.addEventListener("click", () => {
            const resolved = root.document.documentElement.dataset.theme;
            setMode(resolved === "light" ? "dark" : "light");
        });
        media?.addEventListener?.("change", () => {
            if (mode === "auto") applyTheme();
        });
        applyTheme();
    }

    root.document.addEventListener("DOMContentLoaded", initialize, { once: true });
})(globalThis);
