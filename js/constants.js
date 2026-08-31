(function defineConstants(root) {
    "use strict";

    const namespace = root.StatsV2 || {};

    const constants = {
        APP_VERSION: "2.0.0-foundation",
        SCHEMA_VERSION: 2,
        STORAGE_KEY: "stats:v2:state",
        LEGACY_STORAGE_KEY: "rankingsApp_data",
        IMAGE_DB_NAME: "stats-v2",
        IMAGE_DB_VERSION: 1,
        IMAGE_STORE_NAME: "images",
        CATEGORIES: Object.freeze([
            Object.freeze({ id: "vocal", label: "VOCAL" }),
            Object.freeze({ id: "rap", label: "RAP" }),
            Object.freeze({ id: "dance", label: "DANCE" }),
            Object.freeze({ id: "stage", label: "STAGE" }),
            Object.freeze({ id: "visual", label: "VISUAL" }),
            Object.freeze({ id: "all-rounder", label: "ALL-ROUNDER" })
        ]),
        GENDERS: Object.freeze(["male", "female"]),
        TAG_TYPES: Object.freeze(["strength", "weakness", "neutral"]),
        RATING_OPTIONS: Object.freeze([
            Object.freeze({ id: "standout", score: 3, label: "Standout" }),
            Object.freeze({ id: "impressed", score: 2, label: "Impressed" }),
            Object.freeze({ id: "good", score: 1, label: "Good" }),
            Object.freeze({ id: "normal", score: 0, label: "Normal" })
        ])
    };

    namespace.constants = Object.freeze(constants);
    root.StatsV2 = namespace;
})(globalThis);
