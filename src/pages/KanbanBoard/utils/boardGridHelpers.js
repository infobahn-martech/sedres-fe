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

/** Card view levels 2–4 (sidebar selector) use a dense board: narrower cards, tighter gaps and
 *  fixed-width column tracks, so more columns fit before horizontal scrolling starts. */

/** Level 2 — moderate (~83%) reduction of Level 1: a 2-per-row column is 325px vs 392px
 *  (modern layout 373px vs 452px), so roughly 1–2 extra columns fit on screen. */
export const LEVEL2_CARD_WIDTH = 150;
export const MODERN_LEVEL2_CARD_WIDTH = 174;
export const LEVEL2_CARD_GAP = 9;
export const LEVEL2_CELL_PADDING_X = 8;

/** Levels 3–4 — compact / minimal board. */
export const DENSE_CARD_WIDTH = 136;
export const MODERN_DENSE_CARD_WIDTH = 156;
export const DENSE_CARD_GAP = 6;
export const DENSE_CELL_PADDING_X = 6;

/** @param {number | null | undefined} viewLevel */
export function isDenseViewLevel(viewLevel) {
  return Number(viewLevel) >= 2;
}

/** Gap between cards inside a column cell for the active view level. */
export function getCardGap(viewLevel = 1) {
  if (Number(viewLevel) === 2) return LEVEL2_CARD_GAP;
  return isDenseViewLevel(viewLevel) ? DENSE_CARD_GAP : CARD_GAP;
}

/** One side of horizontal padding inside a column cell for the active view level. */
export function getCellPaddingX(viewLevel = 1) {
  if (Number(viewLevel) === 2) return LEVEL2_CELL_PADDING_X;
  return isDenseViewLevel(viewLevel) ? DENSE_CELL_PADDING_X : CELL_PADDING_X;
}

/** Level 4 (Minimal) card view: tiles pack into as many tracks as fit the column's width. */
export const MINIMAL_TILE_WIDTH = 34;
export const MINIMAL_TILE_GAP = 6;
export const MINIMAL_GRID_TEMPLATE = `repeat(auto-fill, ${MINIMAL_TILE_WIDTH}px)`;

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
 * Returns fixed card width for the active layout mode and card view level.
 *
 * @param {string | null | undefined} viewMode
 * @param {number} [viewLevel] - card view level (1 Detailed … 4 Minimal)
 * @returns {number}
 */
export function getCardWidth(viewMode, viewLevel = 1) {
  if (Number(viewLevel) === 2) {
    return viewMode === "modern" ? MODERN_LEVEL2_CARD_WIDTH : LEVEL2_CARD_WIDTH;
  }
  if (isDenseViewLevel(viewLevel)) {
    return viewMode === "modern" ? MODERN_DENSE_CARD_WIDTH : DENSE_CARD_WIDTH;
  }
  return viewMode === "modern" ? MODERN_CARD_WIDTH : CARD_WIDTH;
}

/**
 * columnWidth = cardsPerRow * cardWidth + (cardsPerRow - 1) * cardGap + horizontal padding
 *
 * @param {object} column
 * @param {Set<string> | null | undefined} [collapsedColumnIds] - column ids currently collapsed
 * @param {string | null | undefined} [viewMode]
 * @param {number} [viewLevel] - card view level (1 Detailed … 4 Minimal)
 * @returns {number} Rounded pixel width for one board column track
 */
export function getColumnWidth(column, collapsedColumnIds = null, viewMode = null, viewLevel = 1) {
  if (column?.id && collapsedColumnIds?.has(column.id)) {
    return COLLAPSED_COLUMN_WIDTH;
  }

  const n = getCardsPerRow(column);
  const cardWidth = getCardWidth(viewMode, viewLevel);
  const base =
    n * cardWidth +
    Math.max(0, n - 1) * getCardGap(viewLevel) +
    getCellPaddingX(viewLevel) * 2;

  return Math.round(base);
}

/**
 * One grid track for a column. Level 1 tracks stretch (`minmax(W, 1fr)`) to fill spare board
 * width; dense levels keep the fixed narrow width so the board visibly tightens.
 */
export function getColumnTrack(column, collapsedColumnIds = null, viewMode = null, viewLevel = 1) {
  const w = getColumnWidth(column, collapsedColumnIds, viewMode, viewLevel);
  const isCollapsed = Boolean(column?.id && collapsedColumnIds?.has(column.id));
  return isCollapsed || isDenseViewLevel(viewLevel) ? `${w}px` : `minmax(${w}px, 1fr)`;
}

/**
 * Builds `grid-template-columns` for the header row and each swimlane row.
 * A collapsed column gets a fixed `COLLAPSED_COLUMN_WIDTH` track. At Level 1 every other column
 * gets `minmax(Wpx, 1fr)`: it stretches to absorb the space freed by collapsed columns (or any
 * extra board width), and shrinks to its fixed px width (triggering horizontal scroll) once
 * the columns no longer fit. Dense levels (2–4) use fixed narrow tracks — see getColumnTrack.
 *
 * @param {Record<string, object>} columns
 * @param {string[]} columnOrder
 * @param {Set<string> | null | undefined} collapsedColumnIds
 * @param {string | null | undefined} viewMode
 * @param {number} [viewLevel] - card view level (1 Detailed … 4 Minimal)
 * @returns {string} e.g. "44px minmax(204px, 1fr) minmax(204px, 1fr)"
 */
export function getBoardGridTemplateColumns(
  columns,
  columnOrder,
  collapsedColumnIds = null,
  viewMode = null,
  viewLevel = 1
) {
  return columnOrder
    .map((colKey) => getColumnTrack(columns[colKey], collapsedColumnIds, viewMode, viewLevel))
    .join(" ");
}
