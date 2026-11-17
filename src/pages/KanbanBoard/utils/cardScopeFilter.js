/**
 * Client-side "All Cards / My Cards" scope for a workflow. Filtering only narrows each swimlane's
 * `cardMap` (what the columns render and count) — `workflow.cards` stays complete so card lookups,
 * linked-card navigation and drag-and-drop state updates keep working against the full board.
 */

export const CARD_SCOPE = Object.freeze({ ALL: "all", MINE: "mine" });

export const CARD_SCOPE_OPTIONS = [
  { value: CARD_SCOPE.ALL, label: "All Cards" },
  { value: CARD_SCOPE.MINE, label: "My Cards" },
];

const normalizeId = (value) => (value == null ? "" : String(value).trim());

/** A card is "mine" when its assigned user (`user_id`, or `assigned_to` if the API sends it) is the logged-in user. */
export const isCardAssignedToUser = (card, userId) => {
  const me = normalizeId(userId);
  if (!card || !me) return false;
  return normalizeId(card.userId) === me || normalizeId(card.raw?.assigned_to) === me;
};

/** Returns the workflow with every swimlane cell narrowed to the user's assigned cards. */
export const filterWorkflowByAssignee = (workflow, userId) => {
  if (!workflow?.swimlanes) return workflow;
  const swimlanes = {};
  for (const [laneId, lane] of Object.entries(workflow.swimlanes)) {
    const cardMap = {};
    for (const [colKey, ids] of Object.entries(lane?.cardMap || {})) {
      cardMap[colKey] = (ids || []).filter((id) =>
        isCardAssignedToUser(workflow.cards?.[id], userId)
      );
    }
    swimlanes[laneId] = { ...lane, cardMap };
  }
  return { ...workflow, swimlanes };
};

/** True when no swimlane cell of the workflow holds a card. */
export const isWorkflowEmpty = (workflow) =>
  Object.values(workflow?.swimlanes || {}).every((lane) =>
    Object.values(lane?.cardMap || {}).every((ids) => !ids?.length)
  );

const SEP = "::";
const parseDroppable = (droppableId) => {
  const i = droppableId.indexOf(SEP);
  return i === -1 ? null : { laneId: droppableId.slice(0, i), columnStableId: droppableId.slice(i + SEP.length) };
};

const getCellIds = (workflow, droppableId) => {
  const loc = parseDroppable(droppableId);
  if (!loc) return null;
  const colKey = Object.keys(workflow.columns || {}).find(
    (key) => workflow.columns[key]?.id === loc.columnStableId
  );
  return colKey ? workflow.swimlanes?.[loc.laneId]?.cardMap?.[colKey] ?? [] : null;
};

/**
 * Drag indexes from a filtered view refer to positions in the filtered lists. Translate them to
 * positions in the full lists so the existing drag-end handler (which splices the full lists)
 * places the card next to the same visible neighbour.
 */
export const remapDragResultToFullWorkflow = (fullWorkflow, filteredWorkflow, result) => {
  const { source, destination, draggableId } = result || {};
  if (!fullWorkflow || !filteredWorkflow || !source || !destination) return result;

  const fullSource = getCellIds(fullWorkflow, source.droppableId);
  const fullDest = getCellIds(fullWorkflow, destination.droppableId);
  const visibleDest = getCellIds(filteredWorkflow, destination.droppableId);
  if (!fullSource || !fullDest || !visibleDest) return result;

  const sourceIndex = fullSource.indexOf(draggableId);
  if (sourceIndex === -1) return result;

  // Both handlers treat the destination index as a position in the list without the dragged card.
  const fullWithout = fullDest.filter((id) => id !== draggableId);
  const visibleWithout = visibleDest.filter((id) => id !== draggableId);
  let destinationIndex;
  if (destination.index < visibleWithout.length) {
    destinationIndex = fullWithout.indexOf(visibleWithout[destination.index]);
  } else if (visibleWithout.length) {
    destinationIndex = fullWithout.indexOf(visibleWithout[visibleWithout.length - 1]) + 1;
  } else {
    destinationIndex = fullWithout.length;
  }
  if (destinationIndex < 0) destinationIndex = fullWithout.length;

  return {
    ...result,
    source: { ...source, index: sourceIndex },
    destination: { ...destination, index: destinationIndex },
  };
};
