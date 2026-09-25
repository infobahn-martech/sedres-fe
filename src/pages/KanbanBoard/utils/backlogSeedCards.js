/**
 * Static cards for the SAIPEM board's Backlog column, so the batch flow can be tried out before
 * the backend serves real ones. They sit after whatever the API returned for that column.
 * `isStatic` keeps them out of drag-and-drop, which only knows about real board cards.
 */

const CARD_GREEN = "#2e7d32";
const SEED_ID_PREFIX = "backlog-seed-";

/** Batch number the next batch gets. Issued by the backend (format: Sep_26_Batch1). */
export const NEXT_BATCH_NUMBER = "Sep_26_Batch1";

/** Seed cards are not in the board's card lookup, so callers that filter by it must skip them. */
export const isBacklogSeedCardId = (cardId) => String(cardId ?? "").startsWith(SEED_ID_PREFIX);

const makeCard = (id, vesselName, billingEntity, user, timeLeft) => ({
  id: `${SEED_ID_PREFIX}${id}`,
  cardSource: "api",
  vesselName,
  billingEntity,
  user,
  timeLeft,
  progress: 0,
  color: CARD_GREEN,
  isStatic: true,
});

export const BACKLOG_SEED_CARDS = [
  makeCard("1", "AL NEHEM", "Land T Hydrocarbon Saudi Company", "Omar", "13d 2h 43m 21s"),
  makeCard("2", "BRITOIL 21", "Subsea 7 Intl Contracting LTD", "Sara", "13d 2h 59m 58s"),
  makeCard("3", "CORAL NAVIGATOR", "Subsea 7 Singapore Contracting", "Omar", "13d 3h 5m 47s"),
  makeCard("4", "MSC ARUSHI", "Mediterranean Shipping Company", "Mona", "2d 6h 40m 1s"),
  makeCard("5", "OCEAN TRADER", "Al-Ard For Industrial and Trading Co.", "Sara", "5d 11h 2m 18s"),
  makeCard("6", "GULF SENTINEL", "Company Conntrak Gulf Limited", "Omar", "8d 19h 47m 30s"),
  makeCard("7", "DELTA PRIDE", "Dialog Jubail Supply Base Co.", "Omar", "14d 23h 27m 46s"),
  makeCard("8", "ARABIAN FALCON", "GAHTANI INTL. MARITIME AGENCIES", "Sara", "3d 8h 15m 6s"),
];
