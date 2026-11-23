/**
 * Maps GET kanban_board/get_full_board/{board_id} payloads into the normalized
 * workflow shape used by the board (`mapBoardWorkflowFromApi` / `normalizeWorkflowFromApi` in data.js).
 */

import { mapBoardWorkflowFromApi } from "./data";

/**
 * Converts a single BE workflow record into the normalized FE workflow object.
 * @param {object} beWorkflow - one element of response.data
 * @returns {object|null}
 */
export function mapFullBoardApiToWorkflow(beWorkflow) {
  return mapBoardWorkflowFromApi(beWorkflow);
}

/**
 * Maps the full API body (workflows) to normalized FE workflows.
 * Accepts either a bare array or a common wrapper `{ data: Workflow[] }`.
 * @param {unknown} responseData - axios `response.data`
 * @returns {object[]}
 */
export function mapFullBoardApiResponse(responseData) {
  const list = Array.isArray(responseData)
    ? responseData
    : Array.isArray(responseData?.data)
      ? responseData.data
      : [];
  return list.map(mapFullBoardApiToWorkflow).filter(Boolean);
}

/**
 * Extracts the board-level `background: { color, background_url }` from a
 * `get_full_board` response, if present.
 * @param {unknown} responseData - axios `response.data`
 * @returns {{ color?: string; background_url?: string } | null}
 */
/**
 * Extracts the board's port from a `get_full_board` response: board-level `port_id`
 * (top level or under `board`), else the first workflow that carries one.
 * @param {unknown} responseData - axios `response.data`
 * @returns {string | null}
 */
export function extractFullBoardPortId(responseData) {
  const hasValue = (v) => v != null && String(v).trim() !== "";
  const boardLevel = [
    responseData?.port_id,
    responseData?.board?.port_id,
    responseData?.board_port_id,
  ].find(hasValue);
  if (boardLevel != null) return String(boardLevel).trim();
  const list = Array.isArray(responseData?.data) ? responseData.data : [];
  const wf = list.find((w) => hasValue(w?.port_id) || hasValue(w?.board_port_id));
  const fromWorkflow = wf ? (hasValue(wf.port_id) ? wf.port_id : wf.board_port_id) : null;
  return fromWorkflow != null ? String(fromWorkflow).trim() : null;
}

export function extractFullBoardBackground(responseData) {
  const background = responseData?.background;
  return background && typeof background === "object" ? background : null;
}
