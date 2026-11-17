/**
 * "My Cards / All Cards" scope for a workflow. Filtering is server-side:
 * kanban_board/get_full_board/{board_id}?workflow_id={workflow_id}&scope={all|my}.
 * Values match the API's `scope` query param.
 */

export const CARD_SCOPE = Object.freeze({ ALL: "all", MINE: "my" });

export const DEFAULT_CARD_SCOPE = CARD_SCOPE.MINE;

export const CARD_SCOPE_OPTIONS = [
  { value: CARD_SCOPE.MINE, label: "My Cards" },
  { value: CARD_SCOPE.ALL, label: "All Cards" },
];
