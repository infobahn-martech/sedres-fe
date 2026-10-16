// Subtabs that render a fixed feature screen on the real card (Operation's
// Crew Immigration dashboard and Check List table) instead of custom fields.
// Keyed by lowercased subtab name.
const FEATURE_PREVIEWS_BY_SUBTAB = {
    "crew immigration": "crew-immigration",
    "check list": "checklist",
    checklist: "checklist",
};

// Returns the feature preview kind for a subtab, or null when it has none.
export const getFeaturePreviewKind = (subTabName) => (
    FEATURE_PREVIEWS_BY_SUBTAB[(subTabName ?? "").trim().toLowerCase()] ?? null
);
