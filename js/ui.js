(function defineUiHelpers(root) {
    "use strict";

    const namespace = root.StatsV2 || {};
    const constants = namespace.constants;

    if (!constants) throw new Error("Stats V2 constants must load before UI helpers.");

    function byId(id) {
        return root.document.getElementById(id);
    }

    function element(tagName, className = "", text) {
        const node = root.document.createElement(tagName);
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

    function genderLabel(gender, form = "plural") {
        if (form === "singular") return gender === "female" ? "Mujer" : "Hombre";
        return gender === "female" ? "Mujeres" : "Hombres";
    }

    function ratingLabel(ratingId, fallback = "Sin evaluar") {
        return constants.RATING_OPTIONS.find((rating) => rating.id === ratingId)?.label || fallback;
    }

    function decimal(value, digits = 1) {
        return Number(value).toLocaleString("es-PA", {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
        });
    }

    namespace.ui = Object.freeze({ byId, element, initials, categoryLabel, genderLabel, ratingLabel, decimal });
    root.StatsV2 = namespace;
})(globalThis);
