import { useCallback } from "react";
import { notify } from "../../../components/Toaster";
import { userHasDeskStartTaskRole } from "../../../shared/helpers/groUserRoles";
import taskCardService from "../../../services/taskCardService";
import daService from "../../../services/daService";
import kanbanBoardService from "../../../services/kanbanBoardService";
import {
  findColumnByCardId,
  findLaneColumnLocationForCard,
  movePureCardToColumn,
} from "../utils/columnHelpers";

const normalizeColumnTitle = (title) =>
  String(title ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const isTodoColumn = (column) => {
  const t = normalizeColumnTitle(column?.title);
  return t === "to do" || t === "todo";
};

const isInProgressColumn = (column) => normalizeColumnTitle(column?.title) === "in progress";

const isTodoToInProgressMove = (workflow, startColumnKey, finishColumnKey) => {
  if (!workflow?.columns || startColumnKey === finishColumnKey) return false;
  const startCol = workflow.columns[startColumnKey];
  const finishCol = workflow.columns[finishColumnKey];
  return isTodoColumn(startCol) && isInProgressColumn(finishCol);
};

const dragApiErrorMessage = (err, fallback) => {
  const msg = err?.response?.data?.message ?? err?.message;
  return typeof msg === "string" && msg.trim() ? msg.trim() : fallback;
};

// Centralized DA Desk board (kanban_board/get_full_board board_id "3") — same id CardForm.jsx's
// isDABoard check uses (via the route boardId prop, the id this board was actually fetched with).
// Column moves here must persist via api/da/advance_stage so the card's DA modal (footer step /
// status timeline) reflects the board move on reopen. Prefer the route boardId (authoritative,
// matches CardForm.jsx exactly); fall back to the per-workflow board_id echoed by the API in case
// a caller doesn't have the route id handy.
const isDABoardWorkflow = (workflow, routeBoardId) =>
  String(routeBoardId ?? workflow?.boardId ?? "") === "3";

/** Matches WorkflowColumns / SwimlaneColumnCell droppable ids: `${laneId}::${columnStableId}` */
export const parseSwimlaneDroppableId = (droppableId) => {
  const sep = "::";
  const i = droppableId.indexOf(sep);
  if (i === -1) return null;
  return {
    laneId: droppableId.slice(0, i),
    columnStableId: droppableId.slice(i + sep.length),
  };
};

export const buildSwimlaneDroppableId = (laneId, columnStableId) => `${laneId}::${columnStableId}`;

const applyCrossColumnMove = (
  prevWorkflows,
  workflowId,
  {
    src,
    dest,
    draggableId,
    startColumnKey,
    finishColumnKey,
    sourceIndex,
    destinationIndex,
    startLane,
    finishLane,
  }
) => {
  const sameLane = src.laneId === dest.laneId;
  const startList = Array.from(startLane.cardMap[startColumnKey] || []);
  startList.splice(sourceIndex, 1);

  const finishList = Array.from(
    sameLane ? startLane.cardMap[finishColumnKey] || [] : finishLane.cardMap[finishColumnKey] || []
  );
  finishList.splice(destinationIndex, 0, draggableId);

  const workflow = prevWorkflows.find((item) => item.id === workflowId);
  const card = workflow?.cards?.[draggableId];
  let nextCard = card;
  if (card && (finishColumnKey !== card.columnId || dest.laneId !== card.laneId)) {
    nextCard = { ...card, columnId: finishColumnKey, laneId: dest.laneId };
  }

  return prevWorkflows.map((item) => {
    if (item.id !== workflowId) return item;

    if (sameLane) {
      const lane = item.swimlanes[src.laneId];
      return {
        ...item,
        swimlanes: {
          ...item.swimlanes,
          [src.laneId]: {
            ...lane,
            cardMap: {
              ...lane.cardMap,
              [startColumnKey]: startList,
              [finishColumnKey]: finishList,
            },
          },
        },
        cards: nextCard ? { ...item.cards, [draggableId]: nextCard } : item.cards,
      };
    }

    const sLane = item.swimlanes[src.laneId];
    const fLane = item.swimlanes[dest.laneId];
    return {
      ...item,
      swimlanes: {
        ...item.swimlanes,
        [src.laneId]: {
          ...sLane,
          cardMap: {
            ...sLane.cardMap,
            [startColumnKey]: startList,
          },
        },
        [dest.laneId]: {
          ...fLane,
          cardMap: {
            ...fLane.cardMap,
            [finishColumnKey]: finishList,
          },
        },
      },
      cards: nextCard ? { ...item.cards, [draggableId]: nextCard } : item.cards,
    };
  });
};

/** After refetch, keep a successfully started card in the In Progress column if BE board lags. */
const ensureCardInColumn = (
  prevWorkflows,
  workflowId,
  cardId,
  finishColumnKey,
  laneId,
  destinationIndex
) => {
  const workflow = prevWorkflows.find((w) => w.id === workflowId);
  if (!workflow) return prevWorkflows;

  const laneCol = findLaneColumnLocationForCard(workflow, cardId);
  if (laneCol?.columnKey === finishColumnKey && laneCol?.laneId === laneId) {
    return prevWorkflows;
  }

  if (!workflow.swimlanes[laneId]?.cardMap) return prevWorkflows;

  const nextWorkflows = prevWorkflows.map((w) => {
    if (w.id !== workflowId) return w;
    if (!w.swimlanes[laneId]?.cardMap) return w;

    const cardMap = Object.fromEntries(
      Object.entries(w.swimlanes).map(([lid, sl]) => {
        const map = { ...sl.cardMap };
        for (const colKey of Object.keys(map)) {
          map[colKey] = (map[colKey] || []).filter((id) => id !== cardId);
        }
        return [lid, { ...sl, cardMap: map }];
      })
    );

    const targetLane = cardMap[laneId];
    const finishList = [...(targetLane.cardMap[finishColumnKey] || [])].filter((id) => id !== cardId);
    const idx = Math.min(Math.max(destinationIndex, 0), finishList.length);
    finishList.splice(idx, 0, cardId);

    cardMap[laneId] = {
      ...targetLane,
      cardMap: {
        ...targetLane.cardMap,
        [finishColumnKey]: finishList,
      },
    };

    const card = w.cards[cardId];
    return {
      ...w,
      swimlanes: cardMap,
      cards: card
        ? {
          ...w.cards,
          [cardId]: { ...card, columnId: finishColumnKey, laneId },
        }
        : w.cards,
    };
  });

  return nextWorkflows;
};

export default function useKanbanDnD(workflows, setWorkflows, { userProfile, refetchBoard, boardId } = {}) {
  const findCardColumn = useCallback(
    (cardId) => findColumnByCardId(workflows, cardId),
    [workflows]
  );

  // Resolves the card's current lane/column from `prev` (the live state at update time) rather
  // than a closed-over `workflows` snapshot, so a caller that fires after an intervening state
  // update (e.g. a board refetch that ran while this call was pending) still finds — and moves
  // from — the card's real current position instead of a stale one.
  const moveCardToColumn = useCallback(
    (cardId, targetColumnId) => {
      setWorkflows((prev) => movePureCardToColumn(prev, cardId, targetColumnId));
    },
    [setWorkflows]
  );

  const createDragEndHandler = useCallback(
    (workflowId) => async (result) => {
      const { destination, source, draggableId } = result;
      if (!destination) return;

      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      ) {
        return;
      }

      const workflow = workflows.find((item) => item.id === workflowId);
      if (!workflow) return;

      const src = parseSwimlaneDroppableId(source.droppableId);
      const dest = parseSwimlaneDroppableId(destination.droppableId);
      if (!src || !dest) return;

      const startColumnKey = Object.keys(workflow.columns).find(
        (k) => workflow.columns[k].id === src.columnStableId
      );
      const finishColumnKey = Object.keys(workflow.columns).find(
        (k) => workflow.columns[k].id === dest.columnStableId
      );
      if (!startColumnKey || !finishColumnKey) return;

      const startLane = workflow.swimlanes[src.laneId];
      const finishLane = workflow.swimlanes[dest.laneId];
      if (!startLane?.cardMap || !finishLane?.cardMap) return;

      const sameLane = src.laneId === dest.laneId;
      const sameColumn = startColumnKey === finishColumnKey;

      const shouldStartTask =
        userHasDeskStartTaskRole(userProfile) &&
        !sameColumn &&
        isTodoToInProgressMove(workflow, startColumnKey, finishColumnKey);

      if (shouldStartTask) {
        const moveParams = {
          src,
          dest,
          draggableId,
          startColumnKey,
          finishColumnKey,
          sourceIndex: source.index,
          destinationIndex: destination.index,
          startLane,
          finishLane,
        };

        setWorkflows((prev) => applyCrossColumnMove(prev, workflowId, moveParams));

        try {
          const taskId = workflow.cards?.[draggableId]?.taskId ?? "";
          await taskCardService.startTask(draggableId, taskId);
          if (refetchBoard) {
            await refetchBoard();
          }
          setWorkflows((prev) =>
            ensureCardInColumn(
              prev,
              workflowId,
              draggableId,
              finishColumnKey,
              dest.laneId,
              destination.index
            )
          );
        } catch (err) {
          setWorkflows((prev) =>
            ensureCardInColumn(prev, workflowId, draggableId, startColumnKey, src.laneId, source.index)
          );
          notify(dragApiErrorMessage(err, "Failed to start task."), "error");
        }
        return;
      }

      if (sameLane && sameColumn) {
        const list = Array.from(startLane.cardMap[startColumnKey] || []);
        list.splice(source.index, 1);
        list.splice(destination.index, 0, draggableId);

        setWorkflows((prev) =>
          prev.map((item) => {
            if (item.id !== workflowId) return item;
            const lane = item.swimlanes[src.laneId];
            return {
              ...item,
              swimlanes: {
                ...item.swimlanes,
                [src.laneId]: {
                  ...lane,
                  cardMap: {
                    ...lane.cardMap,
                    [startColumnKey]: list,
                  },
                },
              },
            };
          })
        );
        return;
      }

      const moveParams = {
        src,
        dest,
        draggableId,
        startColumnKey,
        finishColumnKey,
        sourceIndex: source.index,
        destinationIndex: destination.index,
        startLane,
        finishLane,
      };

      // DA board: persist the column move via advance_stage so the card's DA modal
      // (footer step / status timeline) shows the new stage next time it's opened, and so
      // the move survives the board refetch that runs whenever a card modal closes.
      if (isDABoardWorkflow(workflow, boardId)) {
        const card = workflow.cards?.[draggableId];
        const callIdRaw = card?.call_id ?? card?.callId;
        const callId = callIdRaw != null ? String(callIdRaw).trim() : "";
        const targetColumnId = workflow.columns?.[finishColumnKey]?.id;

        // Can't identify the call / target column for advance_stage — don't move locally
        // only, since that move would silently revert on the next board refetch.
        if (!callId || !targetColumnId) {
          notify("Could not move this card: missing call reference.", "error");
          return;
        }

        setWorkflows((prev) => applyCrossColumnMove(prev, workflowId, moveParams));

        try {
          const { data } = await daService.advanceStage({ call_id: callId, column_id: targetColumnId });
          if (!data?.status) {
            throw new Error(data?.message || "Failed to move card to that stage.");
          }
        } catch (err) {
          setWorkflows((prev) =>
            applyCrossColumnMove(prev, workflowId, {
              ...moveParams,
              src: dest,
              dest: src,
              startColumnKey: finishColumnKey,
              finishColumnKey: startColumnKey,
              sourceIndex: destination.index,
              destinationIndex: source.index,
              startLane: finishLane,
              finishLane: startLane,
            })
          );
          notify(dragApiErrorMessage(err, "Failed to move card to that stage."), "error");
        }
        return;
      }

      const targetColumnId = workflow.columns?.[finishColumnKey]?.id;
      setWorkflows((prev) => applyCrossColumnMove(prev, workflowId, moveParams));

      try {
        await kanbanBoardService.moveCard({ card_id: draggableId, to_column_id: targetColumnId });
      } catch (err) {
        setWorkflows((prev) =>
          applyCrossColumnMove(prev, workflowId, {
            ...moveParams,
            src: dest,
            dest: src,
            startColumnKey: finishColumnKey,
            finishColumnKey: startColumnKey,
            sourceIndex: destination.index,
            destinationIndex: source.index,
            startLane: finishLane,
            finishLane: startLane,
          })
        );
        notify(dragApiErrorMessage(err, "Failed to move card."), "error");
      }
    },
    [workflows, setWorkflows, userProfile, refetchBoard, boardId]
  );

  return {
    findCardColumn,
    moveCardToColumn,
    createDragEndHandler,
  };
}
