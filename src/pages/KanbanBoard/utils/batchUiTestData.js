import gulfmarineLogo from "../../../assets/images/gulfmarine.png";

/** Batch grouping is a UI preview scoped to this single workflow — every other board renders flat cards. */
export const BATCH_UI_TEST_WORKFLOW_TITLE = "Batch UI Test";

export const isBatchUiTestWorkflow = (workflow) =>
  String(workflow?.title ?? "").trim() === BATCH_UI_TEST_WORKFLOW_TITLE;

const CARD_GREEN = "#2e7d32";
const CARD_ORANGE = "#f59e0b";

const makeCard = (id, vesselName, billingEntity, user, timeLeft, progress, extra = {}) => ({
  id: `batch-ui-test-${id}`,
  cardSource: "api",
  vesselName,
  billingEntity,
  user,
  timeLeft,
  progress,
  color: CARD_GREEN,
  ...extra,
});

const DOWNLOAD_ICON = { cardTypeIcon: "FiDownload", cardTypeColor: "#16a34a", cardTypeName: "Import" };
const SEND_ICON = { cardTypeIcon: "FiSend", cardTypeColor: "#f97316", cardTypeName: "Dispatch", color: CARD_ORANGE };
const HOURGLASS_ICON = { cardTypeIcon: "LuHourglass", cardTypeColor: "#f59e0b", cardTypeName: "Awaiting" };

/** Keyed by column title (case-insensitive) so the preview follows the board's stage names. */
const BATCHES_BY_COLUMN = {
  requested: [
    {
      id: "batch-1",
      title: "Batch 1",
      cards: [
        makeCard("b1-1", "AHT CHRYSOLITE", "Al-Ard For Industrial and Trading Co.", "Sara", "13d 2h 40m 32s", 0),
        makeCard("b1-2", "AL NEHEM", "Land T Hydrocarbon Saudi Company", "Omar", "13d 2h 43m 21s", 0),
        makeCard("b1-3", "BRITOIL 21", "Subsea 7 Intl Contracting LTD", "Sara", "13d 2h 59m 58s", 0),
        makeCard("b1-4", "CORAL NAVIGATOR", "Subsea 7 Singapore Contracting", "Omar", "13d 3h 5m 47s", 0),
      ],
    },
    {
      id: "batch-2",
      title: "Batch 2",
      cards: [
        makeCard("b2-1", "AL NEHEM", "GAHTANI INTL. MARITIME AGENCIES", "Omar", "13d 3h 8m 11s", 0),
        makeCard("b2-2", "DELTA PRIDE", "Dialog Jubail Supply Base Co.", "Omar", "14d 23h 27m 46s", 0, DOWNLOAD_ICON),
        makeCard("b2-3", "AESEN GALAXY", "COMPASS ARABIA LLC", "Mona", "40d 21h 24m 12s", 100),
        makeCard("b2-4", "INDUS VENTURE", "Company Conntrak Gulf Limited", "Mona", "41d 3h 12m 37s", 100, {
          ...SEND_ICON,
          entityLogo: gulfmarineLogo,
        }),
        makeCard("b2-5", "LOTUS EXPLORER", "Conntrak Saudi Catering Services", "Mona", "41d 3h 24m 52s", 100, {
          entityLogo: gulfmarineLogo,
        }),
        makeCard("b2-6", "NEPTUNE SPIRIT", "Company Conntrak Gulf Limited", "Mona", "41d 4h 2m 9s", 60, {
          ...HOURGLASS_ICON,
          entityLogo: gulfmarineLogo,
        }),
      ],
    },
  ],
};

const EMPTY_BATCHES = [];

export const getBatchUiTestBatches = (column) =>
  BATCHES_BY_COLUMN[String(column?.title ?? "").trim().toLowerCase()] ?? EMPTY_BATCHES;

export const countBatchUiTestCards = (column) =>
  getBatchUiTestBatches(column).reduce((sum, batch) => sum + batch.cards.length, 0);
