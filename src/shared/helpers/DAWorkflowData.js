// ============================================================
// DA WORKFLOW (demo, frontend-only — mirrors Task Workflow/TDData.js)
// ============================================================

const DA_DEMO_CARDS = {
    "da-demo-card-1": {
        id: "da-demo-card-1",
        laneId: "default",
        columnId: "col-todo",
        workflow_id: "wf-da-demo",
        workflow_role_id: null,
        cardVariant: "da",
        cardSource: "static",
        title: "DA – Crew Change",
        vesselName: "MV Atlantic Star",
        name: "Gulf Marine",
        user: "James Okonkwo",
        requestedOperator: "Ali Hassan",
        typeOfService: "Crew Change",
        location: "Freighter Anchorage",
        bookingDate: "23 Jun 2026",
        batchCount: 2,
        timeLeft: "4h 30m",
        progress: 0,
        color: "rgb(62 94 189)",
        crew: [
            { id: "c1", crewName: "Ahmed Al-Rashid", rank: "Chief Officer", nationality: "Saudi",    passportNo: "P1234567", seamanBookNo: "SB-10021" },
            { id: "c2", crewName: "Vikram Singh",     rank: "2nd Engineer",  nationality: "Indian",   passportNo: "P2345678", seamanBookNo: "SB-10022" },
            { id: "c3", crewName: "Juan Dela Cruz",   rank: "AB Seaman",     nationality: "Filipino", passportNo: "P3456789", seamanBookNo: "SB-10023" },
            { id: "c4", crewName: "Omar Hassan",      rank: "Cook",          nationality: "Egyptian", passportNo: "P4567890", seamanBookNo: "SB-10024" },
        ],
    },
};

/** Static template for the DA Workflow injected on the frontend. */
export const DA_WORKFLOW_TEMPLATE = {
    id: "wf-da-demo",
    title: "DA Workflow",
    columnOrder: ["col-todo", "col-progress", "col-done"],
    columns: {
        "col-todo":     { id: "col-todo",     title: "To Do",       color: "#3b82f6", stageId: "stage-1", stageTitle: "To Do",       wipLimit: null, cardsPerRow: 2, backgroundColor: "#ffffff" },
        "col-progress": { id: "col-progress", title: "In Progress", color: "#f59e0b", stageId: "stage-2", stageTitle: "In Progress", wipLimit: null, cardsPerRow: 2, backgroundColor: "#ffffff" },
        "col-done":     { id: "col-done",     title: "Completed",   color: "#22c55e", stageId: "stage-3", stageTitle: "Completed",   wipLimit: null, cardsPerRow: 2, backgroundColor: "#ffffff" },
    },
    swimlaneOrder: ["default"],
    swimlanes: {
        default: { id: "default", title: "Default", color: "#ffffff", cardMap: { "col-todo": [], "col-progress": [], "col-done": [] } },
    },
    cards: {},
};

// DA Workflow template merged with the DA demo card
export const DA_WORKFLOW_WITH_DEMO = {
    ...DA_WORKFLOW_TEMPLATE,
    swimlanes: {
        default: {
            ...DA_WORKFLOW_TEMPLATE.swimlanes.default,
            cardMap: {
                ...DA_WORKFLOW_TEMPLATE.swimlanes.default.cardMap,
                "col-todo": ["da-demo-card-1"],
            },
        },
    },
    cards: DA_DEMO_CARDS,
};

/** Ensures DA Workflow is always present in the workflows array. */
export const ensureDAWorkflow = (mapped) => {
    if (mapped.some((wf) => wf.id === "wf-da-demo" || wf.title === "DA Workflow")) {
        return mapped;
    }
    return [...mapped, DA_WORKFLOW_WITH_DEMO];
};

const DA_TEST_CARDS = [
    {
        id: "da-test-awaiting-ack-card",
        column: "awaitingAcknowledgment",
        vesselName: "MV Atlantic Star",
        billingEntity: "Gulf Marine",
        taskName: "Crew Change",
        user: "Captain",
        timeLeft: "4h 30m",
        progress: 0,
        color: "#2A00FF",
    },
    {
        id: "da-test-awaiting-ack-card-2",
        column: "awaitingAcknowledgment",
        vesselName: "RT - ZAKHER FORCE MATERIAL DELIVERY - DEC",
        billingEntity: "Gulf Marine",
        taskName: "Crew Change",
        user: "Captain",
        timeLeft: "4h 30m",
        progress: 0,
        color: "#2A00FF",
    },
    {
        id: "da-test-awaiting-ack-card-3",
        column: "awaitingAcknowledgment",
        vesselName: "RT - QMS AL SAHAMA II - MATERIAL DELIVERY",
        billingEntity: "Gulf Marine",
        taskName: "Crew Change",
        user: "Captain",
        timeLeft: "4h 30m",
        progress: 0,
        color: "#2A00FF",
    },
    {
        id: "da-test-dispatched-card",
        column: "dispatched",
        vesselName: "OFFSHORE CAT",
        billingEntity: "Gulf Marine",
        taskName: "Crew Change",
        user: "Captain",
        timeLeft: "4h 30m",
        progress: 0,
        color: "#2A00FF",
    },
    {
        id: "da-test-dispatched-card-2",
        column: "dispatched",
        vesselName: "Client - Zakher Marine Saudi",
        billingEntity: "Gulf Marine",
        taskName: "Crew Change",
        user: "Captain",
        timeLeft: "4h 30m",
        progress: 0,
        color: "#2A00FF",
    },
    {
        id: "da-test-dispatched-card-3",
        column: "dispatched",
        vesselName: "CRPO 117-119/2026/LTA/ 7400078821 ASTRO 3303 - DMM PORT CALL-CREW CHANGE-ARR: 11.04.2026/ DEP:VESSEL PRESENT AT SCJ",
        billingEntity: "Gulf Marine",
        taskName: "Crew Change",
        user: "Captain",
        timeLeft: "4h 30m",
        progress: 0,
        color: "#2A00FF",
    },
    {
        id: "da-test-finalized-card-1",
        column: "finalized",
        vesselName: "Client - SAIPEM",
        billingEntity: "Gulf Marine",
        taskName: "Crew Change",
        user: "Captain",
        timeLeft: "4h 30m",
        progress: 0,
        color: "#2A00FF",
    },
    {
        id: "da-test-finalized-card-2",
        column: "finalized",
        vesselName: "MV -Mossalem Tide - imp",
        billingEntity: "Gulf Marine",
        taskName: "Crew Change",
        user: "Captain",
        timeLeft: "4h 30m",
        progress: 0,
        color: "#2A00FF",
        mwpIssuedBySedres: true,
    },
    {
        id: "da-test-finalized-card-3",
        column: "finalized",
        vesselName: "NLP JACKSON CALL RT",
        billingEntity: "Gulf Marine",
        taskName: "Crew Change",
        user: "Captain",
        timeLeft: "4h 30m",
        progress: 0,
        color: "#2A00FF",
    },
    {
        id: "da-test-algihaz-card-1",
        column: "alGihazAwaitingSubmission",
        vesselName: "SK MARQUEE",
        billingEntity: "Gulf Marine",
        taskName: "Crew Change",
        user: "Captain",
        timeLeft: "4h 30m",
        progress: 0,
        color: "#2A00FF",
    },
    {
        id: "da-test-algihaz-card-2",
        column: "alGihazAwaitingSubmission",
        vesselName: "RT - SK MARQUEE",
        billingEntity: "Gulf Marine",
        taskName: "Crew Change",
        user: "Captain",
        timeLeft: "4h 30m",
        progress: 0,
        color: "#2A00FF",
    },
    {
        id: "da-test-algihaz-card-3",
        column: "alGihazAwaitingSubmission",
        vesselName: "RT - TRANSPORT - AMC",
        billingEntity: "Gulf Marine",
        taskName: "Crew Change",
        user: "Captain",
        timeLeft: "4h 30m",
        progress: 0,
        color: "#2A00FF",
    },
];

// The backend's real column title varies by board — sometimes the misspelling
// ("achnowlegment"), sometimes the British spelling ("acknowledgement"). Match
// all known variants so this doesn't silently break depending on which is live.
const AWAITING_ACKNOWLEDGMENT_TITLES = new Set([
    "awaiting acknowledgment",
    "awaiting acknowledgement",
    "awaiting achnowlegment",
]);

/** Matches a column title against the (misspelled) "Awaiting acknowledgment" column, case-insensitively. */
export const isAwaitingAcknowledgmentTitle = (title) =>
    typeof title === "string" && AWAITING_ACKNOWLEDGMENT_TITLES.has(title.trim().toLowerCase());

const DISPATCHED_TITLES = new Set(["dispatched"]);

/** Matches a column title against the "Dispatched" column, case-insensitively. */
export const isDispatchedTitle = (title) =>
    typeof title === "string" && DISPATCHED_TITLES.has(title.trim().toLowerCase());

const FINALIZED_TITLES = new Set(["finalized"]);

/** Matches a column title against the "Finalized" column, case-insensitively. */
export const isFinalizedTitle = (title) =>
    typeof title === "string" && FINALIZED_TITLES.has(title.trim().toLowerCase());

const AL_GIHAZ_AWAITING_SUBMISSION_TITLES = new Set(["al gihaz awaiting submission"]);

/** Matches a column title against the "Al Gihaz awaiting submission" column, case-insensitively. */
export const isAlGihazAwaitingSubmissionTitle = (title) =>
    typeof title === "string" && AL_GIHAZ_AWAITING_SUBMISSION_TITLES.has(title.trim().toLowerCase());

// Maps each DA_TEST_CARDS "column" value to the matcher that finds its real column ID.
const COLUMN_MATCHERS = {
    awaitingAcknowledgment: isAwaitingAcknowledgmentTitle,
    dispatched: isDispatchedTitle,
    finalized: isFinalizedTitle,
    alGihazAwaitingSubmission: isAlGihazAwaitingSubmissionTitle,
};

/**
 * TEMP/dev-only: injects client-side test cards into the live "DA Workflow"'s
 * "Awaiting acknowledgment" and "Dispatched" columns so the new DA tab can be
 * visually checked before any real card exists there via the backend. Skips any
 * test card that already exists (e.g. a real card has since taken over that slot),
 * and no-ops entirely on the static demo fallback (it has no such columns).
 * Safe to delete this export + its call site once no longer needed.
 */
export const injectDATestCard = (workflows) =>
    workflows.map((wf) => {
        let nextWf = wf;

        Object.entries(COLUMN_MATCHERS).forEach(([columnKey, matchesTitle]) => {
            const cardsForColumn = DA_TEST_CARDS.filter((testCard) => testCard.column === columnKey);
            if (!cardsForColumn.length) return;

            // Match whichever workflow actually owns this column — its real backend
            // workflow_name isn't necessarily "DA Workflow" (that name belongs only
            // to the frontend-only demo fallback in this file).
            const colId = nextWf.columnOrder?.find((id) => matchesTitle(nextWf.columns?.[id]?.title));
            if (!colId) return;

            const laneId = nextWf.swimlaneOrder?.[0];
            const swimlane = laneId ? nextWf.swimlanes?.[laneId] : null;
            if (!swimlane) return;

            const missingCards = cardsForColumn.filter((testCard) => !nextWf.cards?.[testCard.id]);
            if (!missingCards.length) return;

            const newCards = Object.fromEntries(
                missingCards.map((testCard) => [
                    testCard.id,
                    { ...testCard, laneId, columnId: colId, cardSource: "api" },
                ])
            );

            nextWf = {
                ...nextWf,
                cards: { ...nextWf.cards, ...newCards },
                swimlanes: {
                    ...nextWf.swimlanes,
                    [laneId]: {
                        ...swimlane,
                        cardMap: {
                            ...swimlane.cardMap,
                            [colId]: [
                                ...(swimlane.cardMap?.[colId] || []),
                                ...missingCards.map((testCard) => testCard.id),
                            ],
                        },
                    },
                },
            };
        });

        return nextWf;
    });
