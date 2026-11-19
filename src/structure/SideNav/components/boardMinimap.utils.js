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

// Column tree of a stage, parents kept: { id, name, children }. A parent column spans its children in
// the header; only the leaf columns get cells.
function buildColumnTree(columns = []) {
  return sortByOrderKey(Array.isArray(columns) ? columns : [], 'column_order').map((col) => ({
    id: String(col?.column_id ?? ''),
    name: col?.column_name || 'Column',
    children: buildColumnTree(col?.children),
  }));
}

const leafCountOf = (node) => (node.children.length === 0 ? 1 : node.children.reduce((sum, child) => sum + leafCountOf(child), 0));
const depthOf = (node) => (node.children.length === 0 ? 1 : 1 + Math.max(...node.children.map(depthOf)));

// Header rows under the stage row: one row per nesting level, left to right across all stages. A
// parent column spans its leaf columns, a leaf spans down to the last row.
function buildColumnHeaderRows(stageSegments) {
  const depth = Math.max(1, ...stageSegments.flatMap((segment) => segment.columnTree.map(depthOf)));
  const rows = Array.from({ length: depth }, () => []);
  const place = (node, level) => {
    const isLeaf = node.children.length === 0;
    rows[level].push({
      id: node.id,
      name: node.name,
      isLeaf,
      colSpan: leafCountOf(node),
      rowSpan: isLeaf ? depth - level : 1,
    });
    node.children.forEach((child) => place(child, level + 1));
  };
  stageSegments.forEach((segment) => segment.columnTree.forEach((node) => place(node, 0)));
  return rows;
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
          columnTree: buildColumnTree(stage?.columns),
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
        columnHeaderRows: buildColumnHeaderRows(stageSegments),
        swimlanes,
      };
    })
    .filter((wf) => wf.stageSegments.length > 0 && wf.swimlanes.length > 0);
}
