// Tabs/subtabs that render a fixed feature screen on the real card instead of
// custom fields. Keyed by lowercased tab/subtab name.
const FEATURE_PREVIEWS_BY_TAB = {
    husbandry: "husbandry",
    "sales order": "sales-order",
    reports: "reports",
    "document library": "document-library",
    comments: "comments",
    subtasks: "subtasks",
    notes: "notes",
};
const FEATURE_PREVIEWS_BY_SUBTAB = {
    "crew immigration": "crew-immigration",
    "check list": "checklist",
    checklist: "checklist",
};

const normalizeName = (name) => (name ?? "").trim().toLowerCase();

// Returns the feature preview kind for the active tab/subtab, or null when it
// has none. A tab's own preview only applies while it has no subtabs, so
// user-added subtabs still show their fields.
export const getFeaturePreviewKind = (tabName, subTabName) => (
    subTabName
        ? FEATURE_PREVIEWS_BY_SUBTAB[normalizeName(subTabName)] ?? null
        : FEATURE_PREVIEWS_BY_TAB[normalizeName(tabName)] ?? null
);
