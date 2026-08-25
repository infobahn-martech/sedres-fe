/**
 * Pure utility functions for workflow editor logic.
 * All functions are immutable and side-effect free.
 */

export const AREA_ORDER = [
  // 'BACKLOG AREA',
  'REQUESTED AREA',
  'IN PROGRESS AREA',
  'DONE AREA',
  'READY TO ARCHIVE AREA',
];

/** Fixed area banner colors — never tied to the stage color picker. Keys match `area` strings. */
export const WORKFLOW_AREA_HEADER_BACKGROUND = {
  'REQUESTED AREA': '#1976d2',
  'IN PROGRESS AREA': '#fb8c00',
  'DONE AREA': '#43a047',
  'READY TO ARCHIVE AREA': '#7b1fa2',
};

/**
 * Inline styles for `.workflow-board-area-header` only (picker does not affect these).
 */
export function getWorkflowAreaHeaderStyles(area) {
  const backgroundColor = WORKFLOW_AREA_HEADER_BACKGROUND[area];
  if (backgroundColor) {
    return { backgroundColor, color: '#ffffff' };
  }
  return { backgroundColor: '#e5e7eb', color: '#374151' };
}

/** Stage swatch, color picker `initialHex`, and empty swimlane cell when no custom color is set. */
export const DEFAULT_STAGE_SWATCH_HEX = '#f8fafc';

const DEFAULT_SWIMLANE_ID = 'default';
const DEFAULT_SWIMLANE_NAME = 'Default Swimlane';

/**
 * Map API stage to internal area.
 * Uses is_archive_stage, is_done_stage, then stage_order.
 */
function getAreaForApiStage(apiStage) {
  if (apiStage.is_archive_stage === '1') return 'READY TO ARCHIVE AREA';
  if (apiStage.is_done_stage === '1') return 'DONE AREA';
  const order = parseInt(apiStage.stage_order, 10) || 0;
  return AREA_ORDER[Math.max(0, order - 1)] ?? AREA_ORDER[0];
}

/**
 * Transform API workflow response to internal workflow shape.
 * Accepts full response { status, data } or inner data { workflow_id, workflow_name, stages, swimlanes }.
 * API: { workflow_id, workflow_name, stages: [{ stage_id, stage_name, stage_order, color_code, is_done_stage, is_archive_stage, columns }], swimlanes }
 * Internal: { id, name, swimlanes: [{ id, name, colorCode?, stages: [{ id, name, area, limit, cardsPerRow, row, col, colSpan, color?, bgColor? }] }] }
 * Swimlane `colorCode`: 6-digit hex from API `color_code` (see sanitizeSwimlaneColorCode).
 * Lane colors: `columns[].background_color` when present, else `stage.color_code` — maps to `color` / `bgColor` on internal stages.
 */
function toPositiveNumber(value) {
  const num = parseInt(value, 10);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function getSortableNumber(value, fallback = 0) {
  const num = parseInt(value, 10);
  return Number.isFinite(num) ? num : fallback;
}

function sortByOrder(list, key) {
  return [...list].sort((a, b) => getSortableNumber(a?.[key]) - getSortableNumber(b?.[key]));
}

/**
 * Swimlane/column lane color from API: prefer column `background_color`, then stage `color_code`.
 * Stored on internal stage as hex (or rgb string) for swatch + cell; picker saves via `update_workflow_column` `{ background_color }`.
 */
function getLaneColorFromApiColumn(column, apiStage) {
  const fromCol = column?.background_color;
  if (fromCol != null && String(fromCol).trim() !== '') return String(fromCol).trim();
  const fromStage = apiStage?.color_code;
  if (fromStage != null && String(fromStage).trim() !== '') return String(fromStage).trim();
  return undefined;
}

function buildInternalStagesFromApiStages(apiStages = [], fallbackStartId = 1) {
  const sortedStages = [...apiStages].sort(
    (a, b) => (parseInt(a.stage_order, 10) || 0) - (parseInt(b.stage_order, 10) || 0)
  );
  const stages = [];
  const areaNextCol = {};
  let nextGeneratedId = fallbackStartId;

  sortedStages.forEach((apiStage) => {
    const area = getAreaForApiStage(apiStage);
    const stageId = String(apiStage?.stage_id ?? '');
    const fallbackColumn = {
      column_id: apiStage?.stage_id,
      column_name: apiStage?.stage_name,
      column_order: '1',
      cards_per_row: '1',
    };
    const columns = Array.isArray(apiStage?.columns) && apiStage.columns.length > 0
      ? sortByOrder(apiStage.columns, 'column_order')
      : [fallbackColumn];

    if (areaNextCol[area] == null) areaNextCol[area] = 0;

    const topLevelColumns = columns.filter(
      (c) => c?.parent_column_id == null || c?.parent_column_id === ''
    );

    topLevelColumns.forEach((col, colIdx) => {
      const children = Array.isArray(col?.children) ? sortByOrder(col.children, 'column_order') : [];
      const stageInternalId = toPositiveNumber(col?.column_id) ?? nextGeneratedId++;

      if (children.length === 0) {
        const laneColor = getLaneColorFromApiColumn(col, apiStage);
        stages.push({
          id: stageInternalId,
          name: col?.column_name || apiStage?.stage_name || 'Stage',
          area,
          limit: 0,
          cardsPerRow: Math.max(1, getSortableNumber(col?.cards_per_row, 1)),
          row: 0,
          col: areaNextCol[area],
          colSpan: 1,
          stageId,
          columnId: String(col?.column_id ?? `${stageId}-${colIdx + 1}`),
          ...(laneColor ? { color: laneColor, bgColor: laneColor } : {}),
        });
        areaNextCol[area] += 1;
        return;
      }

      const startCol = areaNextCol[area];
      const span = children.length;
      const parentLaneColor = getLaneColorFromApiColumn(col, apiStage);
      stages.push({
        id: stageInternalId,
        name: col?.column_name || apiStage?.stage_name || 'Stage',
        area,
        limit: 0,
        cardsPerRow: Math.max(1, getSortableNumber(col?.cards_per_row, 1)),
        row: 0,
        col: startCol,
        colSpan: span,
        stageId,
        columnId: String(col?.column_id ?? `${stageId}-${colIdx + 1}`),
        ...(parentLaneColor ? { color: parentLaneColor, bgColor: parentLaneColor } : {}),
      });

      const parentColumnIdStr = String(col?.column_id ?? '');
      children.forEach((child, childIdx) => {
        const childInternalId = toPositiveNumber(child?.column_id) ?? nextGeneratedId++;
        const childParentId =
          child?.parent_column_id != null && String(child?.parent_column_id) !== ''
            ? String(child.parent_column_id)
            : parentColumnIdStr;
        const childLaneColor = getLaneColorFromApiColumn(child, apiStage);
        stages.push({
          id: childInternalId,
          name: child?.column_name || 'Stage',
          area,
          limit: 0,
          cardsPerRow: Math.max(1, getSortableNumber(child?.cards_per_row, 1)),
          row: 1,
          col: startCol + childIdx,
          colSpan: 1,
          stageId,
          columnId: String(child?.column_id ?? `${stageId}-${childIdx + 1}`),
          parent_column_id: childParentId,
          ...(childLaneColor ? { color: childLaneColor, bgColor: childLaneColor } : {}),
        });
      });

      areaNextCol[area] += span;
    });
  });

  return stages;
}

function createDefaultSwimlaneFromStages(apiStages, workflowIdForKey) {
  return {
    id: `${DEFAULT_SWIMLANE_ID}-${workflowIdForKey}`,
    name: DEFAULT_SWIMLANE_NAME,
    stages: buildInternalStagesFromApiStages(apiStages),
  };
}

/**
 * Normalize swimlane `color_code` from the API to a 6-char #hex (fixes common 5-digit values like #fffff).
 */
export function sanitizeSwimlaneColorCode(raw) {
  if (raw == null || String(raw).trim() === '') return undefined;
  let s = String(raw).trim();
  if (!s.startsWith('#')) s = `#${s}`;
  if (/^#[0-9a-fA-F]{5}$/.test(s)) return `${s}f`.toLowerCase();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const r = s[1];
    const g = s[2];
    const b = s[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return undefined;
}

/**
 * Readable label text on a swimlane color background (WCAG-style luminance).
 */
export function pickForegroundOnSwimlaneBackground(hex6) {
  const h = hex6?.replace('#', '');
  if (!h || h.length !== 6) return '#1f2937';
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.62 ? '#1f2937' : '#ffffff';
}

function transformApiSwimlanes(apiSwimlanes, apiStages, workflowIdForKey) {
  const defaultStages = buildInternalStagesFromApiStages(apiStages);

  return apiSwimlanes.map((sl, idx) => {
    const swimlaneId = toPositiveNumber(sl?.swimlane_id ?? sl?.id) ?? `${workflowIdForKey}-sl-${idx + 1}`;
    const swimlaneName = sl.swimlane_name ?? sl.name ?? `Swimlane ${idx + 1}`;
    const colorCode = sanitizeSwimlaneColorCode(sl?.color_code);
    return {
      id: swimlaneId,
      name: swimlaneName,
      ...(colorCode ? { colorCode } : {}),
      stages: defaultStages.map((stage) => ({ ...stage })),
    };
  });
}

function isAlreadyInternalWorkflow(workflow) {
  return Boolean(workflow && workflow.id != null && Array.isArray(workflow.swimlanes));
}

function normalizeIsActive(raw) {
  if (raw === undefined || raw === null) return 1;
  if (raw === 0 || raw === false || raw === '0') return 0;
  return 1;
}

function normalizeSingleWorkflow(workflow, idx = 0) {
  if (!workflow) return null;
  if (isAlreadyInternalWorkflow(workflow)) {
    return {
      ...workflow,
      swimlanes: Array.isArray(workflow.swimlanes) ? workflow.swimlanes : [],
      is_active: normalizeIsActive(workflow.is_active),
    };
  }

  const workflowIdRaw = workflow?.workflow_id ?? workflow?.id;
  if (workflowIdRaw == null) return null;

  const workflowId = toPositiveNumber(workflowIdRaw) ?? String(workflowIdRaw);
  const workflowName = workflow?.workflow_name ?? workflow?.name ?? `Workflow ${idx + 1}`;
  const apiStages = Array.isArray(workflow?.stages) ? workflow.stages : [];
  const apiSwimlanes = Array.isArray(workflow?.swimlanes) ? workflow.swimlanes : [];

  const normalizedSwimlanes =
    apiSwimlanes.length > 0
      ? transformApiSwimlanes(apiSwimlanes, apiStages, workflowId)
      : [createDefaultSwimlaneFromStages(apiStages, workflowId)];

  return {
    id: workflowId,
    name: workflowName,
    swimlanes: normalizedSwimlanes,
    is_active: normalizeIsActive(workflow?.is_active),
  };
}

export function normalizeWorkflowData(apiResponse) {
  const source = apiResponse?.status === 'success' ? apiResponse?.data : apiResponse;
  if (!source) return [];
  const list = Array.isArray(source) ? source : [source];
  return list
    .map((workflow, idx) => normalizeSingleWorkflow(workflow, idx))
    .filter(Boolean);
}

export function transformApiWorkflowToInternal(apiResponse) {
  const normalized = normalizeWorkflowData(apiResponse);
  return normalized[0] ?? null;
}

export function rgbToHex(rgb) {
  if (!rgb) return '#f9fafb';
  if (rgb.startsWith('#')) return rgb.toUpperCase();
  const match = rgb.match(/\d+/g);
  if (!match || match.length < 3) return '#f9fafb';
  return (
    '#' +
    match
      .map((x) => {
        const hex = parseInt(x, 10).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('')
      .toUpperCase()
  );
}

export function hexToRgb(hex) {
  if (!hex || !hex.startsWith('#')) return null;
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})` : null;
}

export function normalizeRgb(rgb) {
  if (!rgb) return '';
  if (rgb.startsWith('#')) return rgb;
  const match = rgb.match(/\d+/g);
  if (!match || match.length < 3) return '';
  return `rgb(${match[0]}, ${match[1]}, ${match[2]})`;
}

/**
 * Get next unique stage ID from a workflow.
 */
export function getNextStageId(workflow) {
  const maxId = Math.max(0, ...workflow.swimlanes.flatMap((sl) => sl.stages.map((s) => s.id)));
  return maxId + 1;
}

/**
 * Get next unique swimlane ID from a workflow.
 */
export function getNextSwimlaneId(workflow) {
  const maxId = Math.max(0, ...workflow.swimlanes.map((sl) => sl.id));
  return maxId + 1;
}

/**
 * Duplicate a swimlane with new ids; new swimlane name is "New Swimlane".
 * Returns a new swimlane object (immutable).
 */
export function duplicateSwimlane(workflow, sourceSwimlane) {
  const newSwimlaneId = getNextSwimlaneId(workflow);
  const maxStageId = Math.max(0, ...workflow.swimlanes.flatMap((sl) => sl.stages.map((s) => s.id)));
  const newStages = sourceSwimlane.stages.map((s, i) => ({
    ...s,
    id: maxStageId + 1 + i,
  }));
  return {
    id: newSwimlaneId,
    name: 'New Swimlane',
    stages: newStages,
  };
}

/**
 * Build board column structure: { area, cols: number }[] - horizontal columns per area.
 */
export function getBoardColumnStructure(workflow, areaOrder = AREA_ORDER) {
  const colsPerArea = {};
  areaOrder.forEach((area) => {
    let maxCols = 0;
    workflow.swimlanes.forEach((swimlane) => {
      const stagesInArea = swimlane.stages.filter((s) => s.area === area);
      const maxColInArea =
        stagesInArea.length > 0
          ? Math.max(...stagesInArea.map((s) => (s.col ?? 0) + (s.colSpan ?? 1)))
          : 0;
      if (maxColInArea > maxCols) maxCols = maxColInArea;
      if (maxCols > (colsPerArea[area] ?? 0)) colsPerArea[area] = maxCols;
    });
  });
  return areaOrder
    .map((area) => ({ area, cols: colsPerArea[area] ?? 0 }))
    .filter((x) => x.cols > 0);
}

/**
 * Build per-area matrix: { row: { col: stage } } - stage at (row, col).
 */
export function getAreaMatrix(swimlane, area) {
  const matrix = {};
  swimlane.stages
    .filter((s) => s.area === area)
    .forEach((s) => {
      const row = s.row ?? 0;
      const col = s.col ?? 0;
      if (!matrix[row]) matrix[row] = {};
      matrix[row][col] = s;
    });
  return matrix;
}

/**
 * Get stages that occupy a specific column in an area (considers colSpan).
 */
export function getStagesInColumn(swimlane, area, colIdx) {
  return swimlane.stages
    .filter((s) => {
      if (s.area !== area) return false;
      const col = s.col ?? 0;
      const span = s.colSpan ?? 1;
      return col <= colIdx && colIdx < col + span;
    })
    .sort((a, b) => (a.row ?? 0) - (b.row ?? 0));
}

/**
 * Get max row index in an area for grid row count.
 */
export function getMaxRowInArea(swimlane, area) {
  const stagesInArea = swimlane.stages.filter((s) => s.area === area);
  if (stagesInArea.length === 0) return -1;
  return Math.max(...stagesInArea.map((s) => s.row ?? 0));
}

/**
 * Global rows across all areas in a swimlane (for equal-height area blocks).
 */
export function getGlobalRowsForSwimlane(swimlane, boardStructure) {
  let maxRows = 0;
  boardStructure.forEach(({ area }) => {
    const rowsInArea = getMaxRowInArea(swimlane, area) + 1;
    if (rowsInArea > maxRows) maxRows = rowsInArea;
  });
  return Math.max(1, maxRows);
}

/**
 * Check if a cell (row, col) is occupied by any stage in the area.
 * For full-height single columns, all rows in that column are treated as occupied.
 */
export function isCellOccupied(areaStages, row, col) {
  const occupyingStages = areaStages.filter((s) => {
    const sCol = s.col ?? 0;
    const sSpan = s.colSpan ?? 1;
    return sCol <= col && col < sCol + sSpan;
  });

  if (occupyingStages.length === 0) return false;

  const exactColumnStages = occupyingStages.filter(
    (s) => (s.col ?? 0) === col && (s.colSpan ?? 1) === 1
  );
  if (exactColumnStages.length === 1) {
    const sameColStages = areaStages.filter((s) => (s.col ?? 0) === col);
    if (sameColStages.length === 1) {
      return true;
    }
  }

  return areaStages.some((s) => {
    const sRow = s.row ?? 0;
    const sCol = s.col ?? 0;
    const sSpan = s.colSpan ?? 1;
    return sRow === row && sCol <= col && col < sCol + sSpan;
  });
}

/**
 * Generate unique column key for hover tracking.
 */
export function getColumnKey(workflowId, swimlaneId, stageId) {
  return `${workflowId}-${swimlaneId}-${stageId}`;
}

/**
 * Generate unique col-stack key for rail positioning.
 */
export function getColStackKey(workflowId, swimlaneId, area, colIdx) {
  return `${workflowId}-${swimlaneId}-${area}-${colIdx}`;
}

/**
 * Insert a new column to the left of the target stage.
 * Returns new stages array (immutable).
 */
export function insertColumnLeft(stages, targetStageId, newId, newStageName = 'New Column') {
  const stage = stages.find((s) => s.id === targetStageId);
  if (!stage) return stages;

  const area = stage.area;
  const targetRow = stage.row ?? 0;
  const targetCol = stage.col ?? 0;
  const span = stage.colSpan ?? 1;

  // For stacked children (row > 0), we need to treat the insert
  // as a full-area column insert under the owning parent in the row above.
  let parentStage = null;
  let parentEndCol = null;
  if (targetRow > 0) {
    parentStage = stages.find((s) => {
      if (s.area !== area) return false;
      const row = s.row ?? 0;
      if (row !== targetRow - 1) return false;
      const col = s.col ?? 0;
      const colSpan = s.colSpan ?? 1;
      return col <= targetCol && targetCol < col + colSpan;
    });
    if (parentStage) {
      const parentCol = parentStage.col ?? 0;
      const parentSpan = parentStage.colSpan ?? 1;
      parentEndCol = parentCol + parentSpan; // first column strictly to the right of the parent before expansion
    }
  }

  const newStage = {
    ...stage,
    id: newId,
    name: newStageName,
    row: targetRow,
    col: targetCol,
    // New top-level parents should always start as a single-column block.
    // For stacked children (row > 0), we preserve the original span.
    colSpan: targetRow === 0 ? 1 : span,
  };

  const newStages = stages.map((s) => {
    if (s.area !== area) return s;

    const row = s.row ?? 0;
    const col = s.col ?? 0;
    const colSpan = s.colSpan ?? 1;

    // When there is no parentStage (non-stacked insert) we want:
    // - For top-level parents (row 0): shift ALL stages at/after targetCol in this area,
    //   so parent and any stacked children under it move together.
    // - For purely same-row inserts in lower rows: keep previous behaviour (shift same-row siblings only).
    if (!parentStage) {
      if (targetRow === 0) {
        if (col >= targetCol) {
          return { ...s, col: col + 1 };
        }
        return s;
      }
      if (row === targetRow && col >= targetCol) {
        return { ...s, col: col + 1 };
      }
      return s;
    }

    // Stacked behaviour (row > 0):
    // 1) Expand the owning parent above by increasing its colSpan by 1.
    if (s === parentStage) {
      return { ...s, colSpan: colSpan + 1 };
    }

    // 2) Shift the original target stage (and any same-row siblings to its right *within* the parent)
    //    one column to the right so the new stage can be inserted on the left.
    if (row === targetRow && col >= targetCol && col < parentEndCol) {
      return { ...s, col: col + 1 };
    }

    // 3) For all stages at or beyond the parent's right boundary, shift one column to the right
    //    so we don't overlap the expanded parent in row 0.
    if (parentEndCol != null && col >= parentEndCol) {
      return { ...s, col: col + 1 };
    }

    return s;
  });
  newStages.push(newStage);
  return newStages;
}

/**
 * Insert a new column to the right of the target stage.
 * When adding beside stacked child (targetRow > 0), expands parent stages above by increasing colSpan.
 * Returns new stages array (immutable).
 */
export function insertColumnRight(stages, targetStageId, newId, newStageName = 'New Column') {
  const stage = stages.find((s) => s.id === targetStageId);
  if (!stage) return stages;

  const area = stage.area;
  const targetRow = stage.row ?? 0;
  const stageCol = stage.col ?? 0;
  const stageSpan = stage.colSpan ?? 1;

  // When the target is a top-level parent that already spans multiple columns,
  // "add to the right" should insert the new column immediately after the
  // entire parent block (at parentCol + colSpan), not just after the first
  // column of the span. For stacked children (row > 0), we still want the
  // insert directly to the right of the child cell.
  const targetCol =
    targetRow === 0
      ? stageCol + stageSpan
      : stageCol + 1;

  // For stacked children (row > 0), treat the insert as a full-area column insert
  // under the owning parent in the row above.
  let parentStage = null;
  let parentEndCol = null;
  if (targetRow > 0) {
    parentStage = stages.find((s) => {
      if (s.area !== area) return false;
      const row = s.row ?? 0;
      if (row !== targetRow - 1) return false;
      const col = s.col ?? 0;
      const colSpan = s.colSpan ?? 1;
      return col <= stageCol && stageCol < col + colSpan;
    });
    if (parentStage) {
      const parentCol = parentStage.col ?? 0;
      const parentSpan = parentStage.colSpan ?? 1;
      parentEndCol = parentCol + parentSpan; // first column strictly to the right of the parent before expansion
    }
  }

  const newStage = {
    ...stage,
    id: newId,
    name: newStageName,
    row: targetRow,
    col: targetCol,
    // New top-level parents should always start as a single-column block.
    // For stacked children (row > 0), we preserve the original span (usually 1).
    colSpan: targetRow === 0 ? 1 : stage.colSpan ?? 1,
  };

  const newStages = stages.map((s) => {
    if (s.area !== area) return s;

    const row = s.row ?? 0;
    const col = s.col ?? 0;
    const colSpan = s.colSpan ?? 1;

    // Non-stacked behaviour (row 0) stays as before: only shift siblings in the same row.
    if (!parentStage || targetRow === 0) {
      if (row === targetRow && col >= targetCol) {
        return { ...s, col: col + 1 };
      }
      return s;
    }

    // Stacked behaviour (row > 0):
    // 1) Expand the owning parent above by increasing its colSpan by 1.
    if (s === parentStage) {
      return { ...s, colSpan: colSpan + 1 };
    }

    // 2) All stacked children in the same row at or to the right of the insertion column
    //    should shift one column to the right (the new child is inserted after the target).
    if (row === targetRow && col >= targetCol && col < parentEndCol) {
      return { ...s, col: col + 1 };
    }

    // 3) For all stages at or beyond the parent's right boundary, shift one column to the right
    //    so we don't overlap the expanded parent in row 0.
    if (parentEndCol != null && col >= parentEndCol) {
      return { ...s, col: col + 1 };
    }

    return s;
  });
  newStages.push(newStage);
  return newStages;
}

/**
 * Remove a stage by id from a swimlane.
 * Returns new stages array (immutable).
 */
export function removeStage(stages, stageId) {
  return stages.filter((s) => s.id !== stageId);
}

/**
 * Insert a new subcolumn below the target stage in the same column.
 * Returns new stages array (immutable).
 */
export function insertSubcolumnBelow(stages, targetStageId, newId, newStageName = 'New Column') {
  const stage = stages.find((s) => s.id === targetStageId);
  if (!stage) return stages;

  const area = stage.area;
  const currentRow = stage.row ?? 0;
  const currentCol = stage.col ?? 0;
  const insertRow = currentRow + 1;

  const newStage = {
    ...stage,
    id: newId,
    name: newStageName,
    area,
    row: insertRow,
    col: currentCol,
    colSpan: 1,
    limit: stage.limit ?? 0,
    cardsPerRow: stage.cardsPerRow ?? 1,
  };

  const newStages = stages.map((s) => {
    if (s.area === area && (s.col ?? 0) === currentCol && (s.row ?? 0) >= insertRow) {
      return { ...s, row: (s.row ?? 0) + 1 };
    }
    return s;
  });
  newStages.push(newStage);
  return newStages;
}

/** Default name for new columns (matches insertColumnLeft/Right/Subcolumn). */
export const DEFAULT_NEW_COLUMN_NAME = 'New Column';

export function findStageByInternalId(stages, internalId) {
  return stages.find((s) => s.id === internalId || String(s.id) === String(internalId));
}

/** True if this stage is a child column (under a row-0 parent), not a top-level parent column. */
export function isWorkflowStageChildColumn(stage) {
  if (!stage) return false;
  const p = stage.parent_column_id;
  if (p != null && String(p) !== '') return true;
  return (stage.row ?? 0) >= 1;
}

/**
 * True if this column is a parent with nested child columns (hide "Cards per row" in the editor).
 * Supports nested arrays on the stage object, or flattened siblings linked by parent_column_id.
 */
export function workflowStageHasChildColumns(stage, swimlaneStages = []) {
  if (!stage) return false;
  if (Array.isArray(stage.child_columns) && stage.child_columns.length > 0) return true;
  if (Array.isArray(stage.sub_columns) && stage.sub_columns.length > 0) return true;
  if (Array.isArray(stage.children) && stage.children.length > 0) return true;
  const cid = stage.columnId;
  if (cid == null || cid === '') return false;
  const pid = String(cid);
  return swimlaneStages.some((s) => {
    const p = s?.parent_column_id;
    return p != null && String(p) !== '' && String(p) === pid;
  });
}

/**
 * When global row count exceeds this column's depth and the deepest stage is a child,
 * suppress empty grid placeholders below (no third nesting level).
 */
export function isEmptyGridCellSuppressedForChildCap(areaStages, rowIdx, colIdx) {
  const overlapping = areaStages.filter((s) => {
    const sCol = s.col ?? 0;
    const sSpan = s.colSpan ?? 1;
    return sCol <= colIdx && colIdx < sCol + sSpan;
  });
  if (overlapping.length === 0) return false;
  const maxR = Math.max(...overlapping.map((s) => s.row ?? 0));
  if (rowIdx <= maxR) return false;
  const bottom = overlapping.filter((s) => (s.row ?? 0) === maxR);
  return bottom.some((s) => isWorkflowStageChildColumn(s));
}

/**
 * Row-0 parent stage that spans the given stacked child column (row >= 1).
 */
export function findParentRow0Stage(stages, childStage) {
  if (!childStage) return null;
  const row = childStage.row ?? 0;
  if (row === 0) return null;
  const col = childStage.col ?? 0;
  return (
    stages.find((s) => {
      if (s.area !== childStage.area) return false;
      if (String(s.stageId ?? '') !== String(childStage.stageId ?? '')) return false;
      if ((s.row ?? 0) !== 0) return false;
      const c = s.col ?? 0;
      const span = s.colSpan ?? 1;
      return c <= col && col < c + span;
    }) ?? null
  );
}

function getChildStagesUnderParent(stages, parent) {
  const pCol = parent.col ?? 0;
  const pSpan = parent.colSpan ?? 1;
  return stages
    .filter(
      (s) =>
        s.area === parent.area &&
        String(s.stageId ?? '') === String(parent.stageId ?? '') &&
        (s.row ?? 0) > 0 &&
        (s.col ?? 0) >= pCol &&
        (s.col ?? 0) < pCol + pSpan
    )
    .sort((a, b) => {
      const rd = (a.row ?? 0) - (b.row ?? 0);
      if (rd !== 0) return rd;
      return (a.col ?? 0) - (b.col ?? 0);
    });
}

function compactCreateColumnPayload(parts) {
  const out = {
    workflow_stage_id: String(parts.workflow_stage_id),
    column_name: parts.column_name,
  };
  if (parts.parent_column_id != null && parts.parent_column_id !== '') {
    out.parent_column_id = String(parts.parent_column_id);
  }
  if (parts.insert_after_column_id != null && parts.insert_after_column_id !== '') {
    out.insert_after_column_id = String(parts.insert_after_column_id);
  }
  if (parts.insert_before_column_id != null && parts.insert_before_column_id !== '') {
    out.insert_before_column_id = String(parts.insert_before_column_id);
  }
  return out;
}

/**
 * Build POST body for create_workflow_column from current swimlane stage list and UI action.
 * @param {'left'|'right'|'subcolumn'} action
 * @returns {{ ok: true, payload: object } | { ok: false, message: string }}
 */
export function buildCreateWorkflowColumnPayload(stages, targetInternalId, action) {
  const target = findStageByInternalId(stages, targetInternalId);
  if (!target) {
    return { ok: false, message: 'Column not found.' };
  }
  const workflowStageId = target.stageId != null && target.stageId !== '' ? String(target.stageId) : null;
  if (!workflowStageId) {
    return { ok: false, message: 'Missing workflow stage. Load the board from the server before adding columns.' };
  }
  if (target.columnId == null || target.columnId === '') {
    return { ok: false, message: 'Missing column id. Load the board from the server before adding columns.' };
  }

  const columnName = DEFAULT_NEW_COLUMN_NAME;
  const base = { workflow_stage_id: workflowStageId, column_name: columnName };

  if (action === 'subcolumn') {
    if (isWorkflowStageChildColumn(target)) {
      return { ok: false, message: 'Cannot nest columns under a child column.' };
    }
    const row = target.row ?? 0;
    if (row === 0) {
      const children = getChildStagesUnderParent(stages, target);
      if (children.length === 0) {
        return {
          ok: true,
          payload: compactCreateColumnPayload({
            ...base,
            parent_column_id: String(target.columnId),
          }),
        };
      }
      const last = children[children.length - 1];
      return {
        ok: true,
        payload: compactCreateColumnPayload({
          ...base,
          parent_column_id: String(target.columnId),
          insert_after_column_id: String(last.columnId),
        }),
      };
    }

    const parent = findParentRow0Stage(stages, target);
    if (!parent || parent.columnId == null || parent.columnId === '') {
      return { ok: false, message: 'Parent column not found for stacked column.' };
    }
    return {
      ok: true,
      payload: compactCreateColumnPayload({
        ...base,
        parent_column_id: String(parent.columnId),
        insert_after_column_id: String(target.columnId),
      }),
    };
  }

  const row = target.row ?? 0;
  if (row === 0) {
    if (action === 'right') {
      return {
        ok: true,
        payload: compactCreateColumnPayload({
          ...base,
          insert_after_column_id: String(target.columnId),
        }),
      };
    }
    if (action === 'left') {
      return {
        ok: true,
        payload: compactCreateColumnPayload({
          ...base,
          insert_before_column_id: String(target.columnId),
        }),
      };
    }
  }

  if (row >= 1) {
    const parent = findParentRow0Stage(stages, target);
    if (!parent || parent.columnId == null || parent.columnId === '') {
      return { ok: false, message: 'Parent column not found.' };
    }
    if (action === 'right') {
      return {
        ok: true,
        payload: compactCreateColumnPayload({
          ...base,
          parent_column_id: String(parent.columnId),
          insert_after_column_id: String(target.columnId),
        }),
      };
    }
    if (action === 'left') {
      return {
        ok: true,
        payload: compactCreateColumnPayload({
          ...base,
          parent_column_id: String(parent.columnId),
          insert_before_column_id: String(target.columnId),
        }),
      };
    }
  }

  return { ok: false, message: 'Unsupported column action.' };
}
