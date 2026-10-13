// Tabs that send an email on the real card (General's Appointment Acceptance and
// Operation's Pre Arrival / Arrival / Departure reports). Keyed by lowercased tab name.
const EMAIL_SUBJECTS_BY_TAB = {
    "appointment details": "Appointment Acceptance",
};
const EMAIL_SUBJECTS_BY_SUBTAB = {
    "pre arrival": "Report - Pre Arrival",
    arrival: "Report - Arrival",
    departure: "Report - Departure",
};

const normalizeName = (name) => (name ?? "").trim().toLowerCase();

// Returns the dummy email subject for a tab/subtab, or null when it has no email preview.
export const getEmailPreviewSubject = (tabName, subTabName) => (
    subTabName
        ? EMAIL_SUBJECTS_BY_SUBTAB[normalizeName(subTabName)] ?? null
        : EMAIL_SUBJECTS_BY_TAB[normalizeName(tabName)] ?? null
);
