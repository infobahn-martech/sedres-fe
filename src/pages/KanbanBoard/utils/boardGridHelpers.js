/**
 * Board-level column sizing: each track is a fixed pixel width derived from cardsPerRow,
 * card size, gap, and cell padding so headers and swimlane cells stay aligned.
 */

const DEFAULT_CARDS_PER_ROW = 2;

export const CARD_WIDTH = 180;
export const MODERN_CARD_WIDTH = 210;
export const CARD_GAP = 12;

/** One side of horizontal padding inside the card-list cell (L+R total = 2× this). */
export const CELL_PADDING_X = 10;

/** Total horizontal padding inside a column cell (matches L+R padding of .card-list--swimlane-grid). */
export const CELL_HORIZONTAL_PADDING_TOTAL = CELL_PADDING_X * 2;

/** Gap between workflow columns on the outer board grid (not the same as CARD_GAP). */
export const BOARD_COLUMN_GAP_PX = 6;

/** Fixed track width for a collapsed column (title rotated vertically, cards hidden). */
export const COLLAPSED_COLUMN_WIDTH = 44;

/** Baseline min-height for every workflow's swimlane row, so rows look consistent board-wide
 *  even when a workflow's content is shorter than this (content can still grow it taller). */
export const WORKFLOW_ROW_MIN_HEIGHT = 240;

/**
 * @param {object | null | undefined} column
 * @returns {number}
 */
export function getCardsPerRow(column) {
  if (column == null) return DEFAULT_CARDS_PER_ROW;
  const n = column.cardsPerRow;
  return typeof n === "number" && n > 0 ? n : DEFAULT_CARDS_PER_ROW;
}

/**
 * Returns fixed card width for the active layout mode.
 *
 * @param {string | null | undefined} viewMode
 * @returns {number}
 */
export function getCardWidth(viewMode) {
  return viewMode === "modern" ? MODERN_CARD_WIDTH : CARD_WIDTH;
}

/**
 * columnWidth = cardsPerRow * cardWidth + (cardsPerRow - 1) * CARD_GAP + horizontal padding
 *
 * @param {object} column
 * @param {Set<string> | null | undefined} [collapsedColumnIds] - column ids currently collapsed
 * @param {string | null | undefined} [viewMode]
 * @returns {number} Rounded pixel width for one board column track
 */
export function getColumnWidth(column, collapsedColumnIds = null, viewMode = null) {
  if (column?.id && collapsedColumnIds?.has(column.id)) {
    return COLLAPSED_COLUMN_WIDTH;
  }

  const n = getCardsPerRow(column);
  const cardWidth = getCardWidth(viewMode);
  const base =
    n * cardWidth +
    Math.max(0, n - 1) * CARD_GAP +
    CELL_HORIZONTAL_PADDING_TOTAL;

  return Math.round(base);
}

/**
 * Builds `grid-template-columns` for the header row and each swimlane row.
 * A collapsed column gets a fixed `COLLAPSED_COLUMN_WIDTH` track. Every other column gets
 * `minmax(Wpx, 1fr)`: it stretches to absorb the space freed by collapsed columns (or any
 * extra board width), and shrinks to its fixed px width (triggering horizontal scroll) once
 * the columns no longer fit.
 *
 * @param {Record<string, object>} columns
 * @param {string[]} columnOrder
 * @param {Set<string> | null | undefined} collapsedColumnIds
 * @param {string | null | undefined} viewMode
 * @returns {string} e.g. "44px minmax(204px, 1fr) minmax(204px, 1fr)"
 */
export function getBoardGridTemplateColumns(
  columns,
  columnOrder,
  collapsedColumnIds = null,
  viewMode = null
) {
  const parts = columnOrder.map((colKey) => {
    const column = columns[colKey];
    const w = getColumnWidth(column, collapsedColumnIds, viewMode);
    return collapsedColumnIds?.has(column?.id) ? `${w}px` : `minmax(${w}px, 1fr)`;
  });
  return parts.join(" ");
}
