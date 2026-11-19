import { useCallback, useEffect, useRef, useState } from "react";
import usePermissions from "../../../shared/hooks/usePermissions";
import { PERMISSION_MODULES } from "../../../shared/constants/permissions";
import { initialData } from "../../../shared/helpers/data";
import { operatorKanbanStaticWorkflows } from "../../../shared/helpers/kanbanOperatorStaticData";
import {
  mapFullBoardApiResponse,
  extractFullBoardBackground,
} from "../../../shared/helpers/kanbanBoardApiMapper";
import kanbanBoardService from "../../../services/kanbanBoardService";
import daService from "../../../services/daService";
import { DA_DESK_BOARD_ID } from "../../../shared/constants/kanbanConfig";
import useBatchMoveStore from "../../../store/batchMoveStore";
import { findWorkflowByCardId } from "../utils/boardHelpers";
import { reorderWorkflowsByPinState } from "../utils/workflowHelpers";
import { DEFAULT_CARD_SCOPE } from "../utils/cardScopeFilter";

const isOperatorBoardId = (id) => String(id ?? "").toLowerCase() === "operator";

/* Batch grouping for the board's cards (matched by card_id). Only the Centralized DA Desk
   board calls da/batches; every other board has its grouping cleared. A failure leaves the
   board ungrouped. */
const loadBatches = (boardId) => {
  if (String(boardId ?? "") !== DA_DESK_BOARD_ID) {
    useBatchMoveStore.getState().setBatches([]);
    return Promise.resolve();
  }
  return daService
    .getBatches()
    .then(({ data }) => {
      if (data?.status === "success") useBatchMoveStore.getState().setBatches(data.data);
    })
    .catch(() => {});
};

/** Pinned workflows (from `is_pinned` on get_full_board) sort to the front, order preserved otherwise. */
const sortByPinState = (mapped) => {
  const pinState = Object.fromEntries(mapped.map((wf) => [wf.id, Boolean(wf.isPinned)]));
  return reorderWorkflowsByPinState(pinState, mapped);
};

/** One workflow of the board fetched with a card scope (`?workflow_id=&scope=`); null if it isn't in the response. */
const fetchWorkflowWithScope = async (boardId, workflowId, scope) => {
  const res = await kanbanBoardService.getFullBoard(boardId, { workflow_id: workflowId, scope });
  return (
    mapFullBoardApiResponse(res?.data).find((wf) => String(wf.id) === String(workflowId)) ?? null
  );
};

/**
 * Whole board in the default scope ("my"), then any workflow switched to another scope is
 * refetched with that scope and swapped in, so a refetch keeps each header's selection.
 */
const fetchBoardWithScopes = async (boardId, scopeByWorkflow = {}) => {
  const res = await kanbanBoardService.getFullBoard(boardId, { scope: DEFAULT_CARD_SCOPE });
  const payload = res?.data;
  let mapped = mapFullBoardApiResponse(payload);
  const overrides = Object.entries(scopeByWorkflow).filter(
    ([, scope]) => scope && scope !== DEFAULT_CARD_SCOPE
  );
  if (overrides.length) {
    const fresh = await Promise.all(
      overrides.map(([wfId, scope]) =>
        fetchWorkflowWithScope(boardId, wfId, scope).catch(() => null)
      )
    );
    const byId = Object.fromEntries(fresh.filter(Boolean).map((wf) => [String(wf.id), wf]));
    mapped = mapped.map((wf) => byId[String(wf.id)] ?? wf);
  }
  return { payload, mapped: sortByPinState(mapped) };
};

export default function useKanbanBoardState(selectedBoardId) {
  const { hasModule } = usePermissions();
  const [workflows, setWorkflows] = useState(() =>
    isOperatorBoardId(selectedBoardId) ? operatorKanbanStaticWorkflows : []
  );
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardLoadError, setBoardLoadError] = useState(null);
  const [boardBackground, setBoardBackground] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [showWorkspaces, setShowWorkspaces] = useState(false);
  const [addTargetWorkflowId, setAddTargetWorkflowId] = useState(null);

  /* "My Cards / All Cards" per workflow header; missing entry = DEFAULT_CARD_SCOPE ("my").
     The ref mirrors the state so refetches and in-flight scope fetches read the latest value. */
  const [cardScopeByWorkflow, setCardScopeByWorkflow] = useState({});
  const [cardScopeLoadingByWorkflow, setCardScopeLoadingByWorkflow] = useState({});
  const cardScopeRef = useRef({});
  const boardIdRef = useRef(selectedBoardId);
  boardIdRef.current = selectedBoardId;

  useEffect(() => {
    setSelectedCard(null);
    setIsAddMode(false);
    setAddTargetWorkflowId(null);
    cardScopeRef.current = {};
    setCardScopeByWorkflow({});
    setCardScopeLoadingByWorkflow({});
  }, [selectedBoardId]);

  const handleCardScopeChange = useCallback(
    async (workflowId, scope) => {
      const boardId = selectedBoardId;
      if (!boardId || isOperatorBoardId(boardId) || workflowId == null) return;
      const key = String(workflowId);
      const previous = cardScopeRef.current[key] ?? DEFAULT_CARD_SCOPE;
      if (previous === scope) return;

      cardScopeRef.current = { ...cardScopeRef.current, [key]: scope };
      setCardScopeByWorkflow(cardScopeRef.current);
      setCardScopeLoadingByWorkflow((prev) => ({ ...prev, [key]: true }));
      try {
        const fresh = await fetchWorkflowWithScope(boardId, key, scope);
        // Ignore if the board changed or the user flipped the toggle again meanwhile.
        if (boardIdRef.current !== boardId || cardScopeRef.current[key] !== scope) return;
        if (fresh) {
          setWorkflows((prev) => prev.map((wf) => (String(wf.id) === key ? fresh : wf)));
        }
      } catch {
        if (boardIdRef.current !== boardId || cardScopeRef.current[key] !== scope) return;
        cardScopeRef.current = { ...cardScopeRef.current, [key]: previous };
        setCardScopeByWorkflow(cardScopeRef.current);
      } finally {
        if (boardIdRef.current === boardId) {
          setCardScopeLoadingByWorkflow((prev) => ({ ...prev, [key]: false }));
        }
      }
    },
    [selectedBoardId]
  );

  const refetchBoard = useCallback(async () => {
    if (!selectedBoardId || isOperatorBoardId(selectedBoardId)) return;
    setBoardLoading(true);
    setBoardLoadError(null);
    try {
      const { payload, mapped } = await fetchBoardWithScopes(
        selectedBoardId,
        cardScopeRef.current
      );
      loadBatches(selectedBoardId);
      setWorkflows(mapped);
      setBoardBackground(extractFullBoardBackground(payload));
      setSelectedCard((prev) => {
        if (!prev?.id) return prev;
        const wf = findWorkflowByCardId(mapped, prev.id);
        const fresh = wf?.cards?.[prev.id];
        return fresh ?? prev;
      });
      setBoardLoadError(null);
    } catch (e) {
      setWorkflows([]);
      setBoardLoadError(
        e?.response?.status === 403
          ? "You don't have access to this board."
          : "Could not load board data."
      );
    } finally {
      setBoardLoading(false);
    }
  }, [selectedBoardId]);

  useEffect(() => {
    if (!selectedBoardId) {
      setWorkflows(initialData);
      setBoardBackground(null);
      setBoardLoadError(null);
      setBoardLoading(false);
      return undefined;
    }

    if (isOperatorBoardId(selectedBoardId)) {
      setWorkflows(operatorKanbanStaticWorkflows);
      setBoardBackground(null);
      setBoardLoadError(null);
      setBoardLoading(false);
      return undefined;
    }

    let cancelled = false;
    setBoardLoading(true);
    setBoardLoadError(null);

    (async () => {
      try {
        const { payload, mapped } = await fetchBoardWithScopes(selectedBoardId);
        if (cancelled) return;
        loadBatches(selectedBoardId);
        setWorkflows(mapped);
        setBoardBackground(extractFullBoardBackground(payload));
        setBoardLoadError(null);
      } catch (e) {
        if (!cancelled) {
          setWorkflows([]);
          setBoardLoadError(
            e?.response?.status === 403
              ? "You don't have access to this board."
              : "Could not load board data."
          );
        }
      } finally {
        if (!cancelled) setBoardLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedBoardId]);

  useEffect(() => {
    const handleShowWorkspaces = () => setShowWorkspaces(true);
    const handleHideWorkspaces = () => setShowWorkspaces(false);

    const handleSubtaskCardCreated = () => {
      refetchBoard();
    };

    window.addEventListener("kanban:show-workspaces", handleShowWorkspaces);
    window.addEventListener("kanban:hide-workspaces", handleHideWorkspaces);
    window.addEventListener("subtask:card-created", handleSubtaskCardCreated);

    return () => {
      window.removeEventListener("kanban:show-workspaces", handleShowWorkspaces);
      window.removeEventListener("kanban:hide-workspaces", handleHideWorkspaces);
      window.removeEventListener("subtask:card-created", handleSubtaskCardCreated);
    };
  }, [refetchBoard]);

  const handleSelectCard = useCallback((card) => {
    if (!hasModule(PERMISSION_MODULES.KANBAN_CARD)) return;
    setSelectedCard(card);
    setIsAddMode(false);
    setAddTargetWorkflowId(null);
  }, [hasModule]);

  const handleCloseCard = useCallback(() => {
    setSelectedCard(null);
    setIsAddMode(false);
    setAddTargetWorkflowId(null);
  }, []);

  /** Updates a card's accent color in workflow state (e.g. after kanban_card/update_card_color). Avoids full board refetch. */
  const patchCardColor = useCallback((cardId, color) => {
    if (cardId == null || String(cardId).trim() === "") return;
    const id = String(cardId).trim();
    const nextColor = color;
    setWorkflows((prev) =>
      prev.map((wf) => {
        const c = wf.cards?.[id];
        if (!c) return wf;
        return {
          ...wf,
          cards: {
            ...wf.cards,
            [id]: { ...c, color: nextColor },
          },
        };
      })
    );
    setSelectedCard((prev) => (prev?.id === id ? { ...prev, color: nextColor } : prev));
  }, []);

  /** Updates a card's title in workflow state (e.g. after kanban_card/update_card_title). Avoids full board refetch. */
  const patchCardTitle = useCallback((cardId, title) => {
    if (cardId == null || String(cardId).trim() === "") return;
    const id = String(cardId).trim();
    setWorkflows((prev) =>
      prev.map((wf) => {
        const c = wf.cards?.[id];
        if (!c) return wf;
        return {
          ...wf,
          cards: {
            ...wf.cards,
            [id]: { ...c, title },
          },
        };
      })
    );
    setSelectedCard((prev) => (prev?.id === id ? { ...prev, title } : prev));
  }, []);

  const patchCardType = useCallback((cardId, cardTypeId, meta = {}) => {
    if (cardId == null || String(cardId).trim() === "") return;
    const id = String(cardId).trim();
    const nextTypeId =
      cardTypeId != null && String(cardTypeId).trim() !== "" ? String(cardTypeId).trim() : null;
    const patch = {
      card_type_id: nextTypeId,
      cardTypeId: nextTypeId,
      type_name: meta.type_name,
      type_color_code: meta.color_code,
      type_icon_name: meta.icon_name,
    };
    setWorkflows((prev) =>
      prev.map((wf) => {
        const c = wf.cards?.[id];
        if (!c) return wf;
        return {
          ...wf,
          cards: {
            ...wf.cards,
            [id]: { ...c, ...patch },
          },
        };
      })
    );
    setSelectedCard((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  }, []);

  const patchCardBlocker = useCallback((cardId, blockerId, meta = {}) => {
    if (cardId == null || String(cardId).trim() === "") return;
    const id = String(cardId).trim();
    const nextId =
      blockerId != null && String(blockerId).trim() !== "" ? String(blockerId).trim() : null;
    const patch = {
      card_blocker_id: nextId,
      cardBlockerId: nextId,
      blocker_name: meta.name,
      blocker_color_code: meta.color_code,
      blocker_icon_name: meta.icon_name,
    };
    setWorkflows((prev) =>
      prev.map((wf) => {
        const c = wf.cards?.[id];
        if (!c) return wf;
        return { ...wf, cards: { ...wf.cards, [id]: { ...c, ...patch } } };
      })
    );
    setSelectedCard((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  }, []);

  const patchCardSticker = useCallback((cardId, stickerId, meta = {}) => {
    if (cardId == null || String(cardId).trim() === "") return;
    const id = String(cardId).trim();
    const nextId =
      stickerId != null && String(stickerId).trim() !== "" ? String(stickerId).trim() : null;
    const patch = {
      card_sticker_id: nextId,
      cardStickerId: nextId,
      sticker_name: meta.name,
      sticker_color_code: meta.color_code,
      sticker_icon_name: meta.icon_name,
    };
    setWorkflows((prev) =>
      prev.map((wf) => {
        const c = wf.cards?.[id];
        if (!c) return wf;
        return { ...wf, cards: { ...wf.cards, [id]: { ...c, ...patch } } };
      })
    );
    setSelectedCard((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  }, []);

  const patchCardTag = useCallback((cardId, tagId, meta = {}) => {
    if (cardId == null || String(cardId).trim() === "") return;
    const id = String(cardId).trim();
    const nextId = tagId != null && String(tagId).trim() !== "" ? String(tagId).trim() : null;
    const patch = {
      card_tag_id: nextId,
      cardTagId: nextId,
      tag_id: nextId,
      tag_name: meta.name,
      tag_color_code: meta.color_code,
      tag_icon_name: meta.icon_name,
    };
    setWorkflows((prev) =>
      prev.map((wf) => {
        const c = wf.cards?.[id];
        if (!c) return wf;
        return { ...wf, cards: { ...wf.cards, [id]: { ...c, ...patch } } };
      })
    );
    setSelectedCard((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  }, []);

  return {
    workflows,
    setWorkflows,
    refetchBoard,
    patchCardColor,
    patchCardTitle,
    patchCardType,
    patchCardBlocker,
    patchCardSticker,
    patchCardTag,
    boardLoading,
    boardLoadError,
    boardBackground,
    selectedCard,
    setSelectedCard,
    isAddMode,
    setIsAddMode,
    showWorkspaces,
    addTargetWorkflowId,
    setAddTargetWorkflowId,
    handleSelectCard,
    handleCloseCard,
    cardScopeByWorkflow,
    cardScopeLoadingByWorkflow,
    handleCardScopeChange,
  };
}
