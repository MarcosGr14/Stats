(function defineConstants(root) {
    "use strict";

    const namespace = root.StatsV2 || {};

    const constants = {
        APP_VERSION: "2.4.1-category-voting",
        SCHEMA_VERSION: 2,
        MAX_NAME_LENGTH: 80,
        MAX_TAG_NAME_LENGTH: 60,
        MAX_WEEKLY_REASON_TAGS: 3,
        MAX_WEEKLY_NOTE_LENGTH: 500,
        MAX_WEEKLY_STANDOUTS: 5,
        MAX_IMAGE_BYTES: 5 * 1024 * 1024,
        IMAGE_MIME_TYPES: Object.freeze(["image/jpeg", "image/png", "image/webp"]),
        STORAGE_KEY: "stats:v2:state",
        TAG_MIGRATION_BACKUP_KEY: "stats:v2:state:pre-tags-backup",
        WEEKLY_MIGRATION_BACKUP_KEY: "stats:v2:state:pre-weekly-voting-backup",
        CATEGORY_VOTING_MIGRATION_BACKUP_KEY: "stats:v2:state:pre-category-voting-backup",
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
        TAG_CATEGORIES: Object.freeze([
            Object.freeze({ id: "vocal", label: "Vocal" }),
            Object.freeze({ id: "rap", label: "Rap" }),
            Object.freeze({ id: "dance", label: "Dance" }),
            Object.freeze({ id: "stage", label: "Stage" }),
            Object.freeze({ id: "general", label: "General" })
        ]),
        TAG_TYPE_LABELS: Object.freeze({
            strength: "Strengths",
            weakness: "Needs Work",
            neutral: "Special"
        }),
        WEEK_STATUSES: Object.freeze(["OPEN", "CLOSED"]),
        VOTER_IDS: Object.freeze(["p1", "p2"]),
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
