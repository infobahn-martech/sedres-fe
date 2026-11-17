/**
 * Pure transform: raw kanban_workflow/get_workflow_by_board/{board_id} response
 * -> the shape BoardMinimapModal renders (one block per active workflow, each with
 * its stage segments, the flattened leaf columns under them, and its swimlane rows).
 */

import { sanitizeSwimlaneColorCode } from '../../../pages/EditWorkflows/workflow.utils';

const DEFAULT_STAGE_COLOR = '#9ca3af';

function isActiveFlag(raw) {
  if (raw === undefined || raw === null) return true;
  return raw === 1 || raw === '1' || raw === true;
}

function sortByOrderKey(list, key) {
  return [...list].sort((a, b) => (parseInt(a?.[key], 10) || 0) - (parseInt(b?.[key], 10) || 0));
}

function normalizeStageColor(colorCode) {
  if (colorCode == null || String(colorCode).trim() === '') return DEFAULT_STAGE_COLOR;
  const s = String(colorCode).trim();
  return s.startsWith('#') ? s : `#${s}`;
}

/** Nested sub-columns are flattened to single leaf boxes (no stacked/parent rows in the mini view). */
function flattenColumnsToLeaves(columns = []) {
  const leaves = [];
  sortByOrderKey(Array.isArray(columns) ? columns : [], 'column_order').forEach((col) => {
    const children = Array.isArray(col?.children) ? col.children : [];
    if (children.length > 0) {
      sortByOrderKey(children, 'column_order').forEach((child) => {
        leaves.push({ id: String(child?.column_id ?? ''), name: child?.column_name || 'Column' });
      });
      return;
    }
    leaves.push({ id: String(col?.column_id ?? ''), name: col?.column_name || 'Column' });
  });
  return leaves;
}

/**
 * @param {object[]} rawWorkflows - `data.data` from get_workflow_by_board (array of
 *   { workflow_id, workflow_name, is_active, stages: [...], swimlanes: [...] })
 * @returns {{ id: string, name: string, stageSegments: { id, name, color, columns }[], leafColumns: { id, name }[], swimlanes: { id, name, colorCode }[] }[]}
 */
export function buildBoardMinimapWorkflows(rawWorkflows) {
  if (!Array.isArray(rawWorkflows)) return [];

  return rawWorkflows
    .filter((wf) => wf && isActiveFlag(wf.is_active))
    .map((wf) => {
      const stageSegments = sortByOrderKey(Array.isArray(wf.stages) ? wf.stages : [], 'stage_order')
        .map((stage) => ({
          id: String(stage?.stage_id ?? ''),
          name: stage?.stage_name || 'Stage',
          color: normalizeStageColor(stage?.color_code),
          columns: flattenColumnsToLeaves(stage?.columns),
        }))
        .filter((segment) => segment.columns.length > 0);

      const swimlanes = sortByOrderKey(
        (Array.isArray(wf.swimlanes) ? wf.swimlanes : []).filter((sl) => sl && isActiveFlag(sl.is_active)),
        'swimlane_order'
      ).map((sl) => ({
        id: String(sl?.swimlane_id ?? ''),
        name: sl?.swimlane_name || 'Swimlane',
        colorCode: sanitizeSwimlaneColorCode(sl?.color_code),
      }));

      return {
        id: String(wf.workflow_id ?? ''),
        name: wf.workflow_name || 'Workflow',
        stageSegments,
        leafColumns: stageSegments.flatMap((segment) => segment.columns),
        swimlanes,
      };
    })
    .filter((wf) => wf.stageSegments.length > 0 && wf.swimlanes.length > 0);
}
