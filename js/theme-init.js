(() => {
    const systemTheme = () => window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
    try {
        const saved = localStorage.getItem("stats-v2-theme");
        const mode = ["auto", "light", "dark"].includes(saved) ? saved : "auto";
        document.documentElement.dataset.theme = mode === "auto" ? systemTheme() : mode;
    } catch (_) {
        document.documentElement.dataset.theme = systemTheme();
    }
})();
