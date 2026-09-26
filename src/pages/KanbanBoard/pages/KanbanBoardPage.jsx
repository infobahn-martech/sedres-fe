import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useLayoutView } from "../../../shared/context/LayoutViewContext";
import { getBoardPageBackgroundStyle } from "../../../shared/utils/dashboardBackground";
import Workspaces from "../../Workspaces";
import useSyncKanbanSidebarWorkflows from "../../../shared/hooks/useSyncKanbanSidebarWorkflows";
import useKanbanAddCardFromSidebar from "../../../shared/hooks/useKanbanAddCardFromSidebar";
import { getAddModeCardFormWorkflow } from "../../../shared/helpers/kanbanSidebarWorkflow";
import KanbanBoardContent from "../components/board/KanbanBoardContent";
import CardForm from "../components/cards/CardForm";
import StatusConfirmationModal from "../../../components/StatusConfirmationModal";
import confirmTickIcon from "../../../assets/images/toast-success.svg";
import SeCreationEmailModal from "../components/board/SeCreationEmailModal";
import ContextMenu from "../components/menus/ContextMenu";
import AccordionMenu from "../components/menus/AccordionMenu";
import useKanbanBoardState from "../hooks/useKanbanBoardState";
import useWorkflowExpansion from "../hooks/useWorkflowExpansion";
import useWorkflowPinning from "../hooks/useWorkflowPinning";
import useColumnHeights from "../hooks/useColumnHeights";
import useKanbanDnD from "../hooks/useKanbanDnD";
import useKanbanRoleAccess from "../hooks/useKanbanRoleAccess";
import usePermissions from "../../../shared/hooks/usePermissions";
import { PERMISSION_MODULES, PERMISSION_SUBMODULES, PERMISSION_ACTIONS } from "../../../shared/constants/permissions";
import { createNewCardDraft } from "../utils/cardHelpers";
import { findWorkflowByCardId } from "../utils/boardHelpers";
import { resolveCardFormVariant } from "../../../shared/helpers/cardFormVariant";
import { getFirstUserRoleId } from "../../../shared/helpers/groUserRoles";
import useAuthReducer from "../../../store/AuthReducer";
import workflowService from "../../../services/workflowService";
import daService from "../../../services/daService";
import { notify } from "../../../components/Toaster";
import { useThemeStore } from "../../../shared/store/themeStore";
import useKanbanCardSelectionStore from "../../../shared/store/kanbanCardSelectionStore";
import useBatchMoveStore from "../../../shared/store/batchMoveStore";

export default function KanbanBoardPage() {
  const { boardId: boardIdParam } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const selectedBoardId = useMemo(() => {
    if (boardIdParam != null && boardIdParam !== "") return boardIdParam;
    const segments = location.pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] === "operator" ? "operator" : null;
  }, [boardIdParam, location.pathname]);

  const isOperatorBoard = String(selectedBoardId ?? "").toLowerCase() === "operator";
  const userProfile = useAuthReducer((state) => state.userProfile);
  const userRoleId = getFirstUserRoleId(userProfile);
  const { layoutView, setPageBackground } = useLayoutView();
  const { isDark: isDarkMode } = useThemeStore();

  const {
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
  } = useKanbanBoardState(selectedBoardId);

  const {
    expandedWorkflows,
    collapsedColumns,
    toggleWorkflow,
    expandWorkflow,
    expandOnlyWorkflow,
    collapseWorkflow,
    collapseAllWorkflows,
    handleColumnHeaderClick,
  } = useWorkflowExpansion(workflows);

  const { pinnedWorkflows, toggleWorkflowPin } = useWorkflowPinning(
    workflows,
    setWorkflows
  );
  const { maxColumnHeights, handleColumnHeightChange } = useColumnHeights(workflows);
  const { findCardColumn, moveCardToColumn, createDragEndHandler } = useKanbanDnD(
    workflows,
    setWorkflows,
    { userProfile, refetchBoard, boardId: selectedBoardId }
  );

  /** Flat id -> card lookup across every workflow, used to resolve linked-card navigation (see CardItem). */
  const cardsById = useMemo(
    () => Object.assign({}, ...workflows.map((wf) => wf.cards)),
    [workflows]
  );

  // Deep-link support: /kanban-board/:boardId?card=<id> (e.g. from Advanced
  // Search) opens that card's form once its workflows have loaded, then
  // strips the param so it doesn't reopen on a later navigation/back.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cardId = params.get("card");
    if (!cardId) return;
    const card = cardsById[cardId];
    if (!card) return;
    handleSelectCard(card);
    params.delete("card");
    const nextSearch = params.toString();
    navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ""}`, { replace: true });
  }, [location.search, location.pathname, cardsById, handleSelectCard, navigate]);

  useEffect(() => {
    setWorkflowFilterId(null);
  }, [selectedBoardId]);

  useKanbanRoleAccess();

  useEffect(() => {
    setPageBackground(getBoardPageBackgroundStyle(boardBackground));
    return () => setPageBackground(null);
  }, [boardBackground, setPageBackground]);

  const [contextMenu, setContextMenu] = useState(null);
  const [contextMenuColumn, setContextMenuColumn] = useState(null);
  const [contextMenuLaneId, setContextMenuLaneId] = useState(null);
  const [accordionMenu, setAccordionMenu] = useState(null);
  const [accordionMenuWorkflowId, setAccordionMenuWorkflowId] = useState(null);
  /* null = show every workflow; set from the sidebar's Select Workflow submenu to show only one. */
  const [workflowFilterId, setWorkflowFilterId] = useState(null);

  const visibleWorkflows = useMemo(
    () =>
      workflowFilterId == null
        ? workflows
        : workflows.filter((w) => String(w.id) === String(workflowFilterId)),
    [workflows, workflowFilterId]
  );

  useSyncKanbanSidebarWorkflows(workflows, selectedBoardId);
  useKanbanAddCardFromSidebar({
    setSelectedCard,
    setIsAddMode,
    setAddTargetWorkflowId,
  });

  const handleAccordionMenuClick = useCallback((event, workflowId) => {
    event.stopPropagation();
    setAccordionMenu({
      x: event.clientX,
      y: event.clientY,
    });
    setAccordionMenuWorkflowId(workflowId);
  }, []);

  const handleCloseAccordionMenu = useCallback(() => {
    setAccordionMenu(null);
    setAccordionMenuWorkflowId(null);
  }, []);

  const handleToggleWorkflow = useCallback(
    (workflowId) => {
      workflowService
        .toggleCollapseWorkflow(workflowId)
        .then(() => {
          toggleWorkflow(workflowId);
        })
        .catch((err) => {
          const msg = err?.response?.data?.message ?? err.message ?? "Could not update workflow.";
          notify(msg, "error");
        });
    },
    [toggleWorkflow]
  );

  const handleAccordionExpand = useCallback(() => {
    if (!accordionMenuWorkflowId) return;
    const workflowId = accordionMenuWorkflowId;
    workflowService
      .toggleCollapseWorkflow(workflowId)
      .then(() => {
        expandWorkflow(workflowId);
      })
      .catch((err) => {
        const msg = err?.response?.data?.message ?? err.message ?? "Could not expand workflow.";
        notify(msg, "error");
      });
  }, [accordionMenuWorkflowId, expandWorkflow]);

  const handleAccordionCollapse = useCallback(() => {
    if (!accordionMenuWorkflowId) return;
    const workflowId = accordionMenuWorkflowId;
    workflowService
      .toggleCollapseWorkflow(workflowId)
      .then(() => {
        collapseWorkflow(workflowId);
      })
      .catch((err) => {
        const msg = err?.response?.data?.message ?? err.message ?? "Could not collapse workflow.";
        notify(msg, "error");
      });
  }, [accordionMenuWorkflowId, collapseWorkflow]);

  const handleTogglePin = useCallback(() => {
    if (!accordionMenuWorkflowId) return;
    const workflowId = accordionMenuWorkflowId;
    workflowService
      .togglePinWorkflow(workflowId)
      .then(() => {
        toggleWorkflowPin(workflowId);
      })
      .catch((err) => {
        const msg = err?.response?.data?.message ?? err.message ?? "Could not update pin.";
        notify(msg, "error");
      })
      .finally(() => {
        handleCloseAccordionMenu();
      });
  }, [accordionMenuWorkflowId, toggleWorkflowPin, handleCloseAccordionMenu]);

  const handleJumpToWorkflow = useCallback(
    (workflowId) => {
      if (workflowId == null) return;
      if (workflowId === "all") {
        setWorkflowFilterId(null);
        const expandedIds = workflows
          .filter((w) => Boolean(expandedWorkflows[w.id]))
          .map((w) => w.id);
        collapseAllWorkflows();
        Promise.all(expandedIds.map((id) => workflowService.toggleCollapseWorkflow(id))).catch((err) => {
          const msg = err?.response?.data?.message ?? err.message ?? "Could not collapse workflows.";
          notify(msg, "error");
        });
        return;
      }
      setWorkflowFilterId(workflowId);
      const scrollToWorkflow = () => {
        requestAnimationFrame(() => {
          document
            .getElementById(`workflow-accordion-${workflowId}`)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      };
      const wasExpanded = Boolean(expandedWorkflows[workflowId]);
      expandOnlyWorkflow(workflowId);
      if (wasExpanded) {
        scrollToWorkflow();
        return;
      }
      workflowService
        .toggleCollapseWorkflow(workflowId)
        .then(() => {
          scrollToWorkflow();
        })
        .catch((err) => {
          const msg = err?.response?.data?.message ?? err.message ?? "Could not expand workflow.";
          notify(msg, "error");
        });
    },
    [expandedWorkflows, expandOnlyWorkflow, collapseAllWorkflows, workflows]
  );

  useEffect(() => {
    const handleJumpToWorkflowEvent = (e) => handleJumpToWorkflow(e?.detail?.workflowId);
    window.addEventListener("kanban:jump-to-workflow", handleJumpToWorkflowEvent);
    return () => window.removeEventListener("kanban:jump-to-workflow", handleJumpToWorkflowEvent);
  }, [handleJumpToWorkflow]);

  const handleWorkflowPinClick = useCallback(
    (workflowId) => {
      if (!workflowId) return;
      workflowService
        .togglePinWorkflow(workflowId)
        .then(() => {
          toggleWorkflowPin(workflowId);
        })
        .catch((err) => {
          const msg = err?.response?.data?.message ?? err.message ?? "Could not update pin.";
          notify(msg, "error");
        });
    },
    [toggleWorkflowPin]
  );

  const handleColumnContextMenu = useCallback((event, column, laneId) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
    });
    setContextMenuColumn(column);
    setContextMenuLaneId(laneId !== undefined && laneId !== null ? String(laneId) : null);
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
    setContextMenuColumn(null);
    setContextMenuLaneId(null);
  }, []);

  const { hasAnyPermission } = usePermissions();

  /* Board-level multi-card selection (see kanbanCardSelectionStore). Kept separate from
     `selectedCard` above, which drives the (unrelated) card-detail modal. Only ids are stored;
     full card data is resolved from this page's own `cardsById`. */
  const selectedCardIds = useKanbanCardSelectionStore((state) => state.selectedCardIds);
  const toggleCardSelectionId = useKanbanCardSelectionStore((state) => state.toggleCardId);
  const setCardSelectionId = useKanbanCardSelectionStore((state) => state.setCardSelected);
  const removeCardSelectionId = useKanbanCardSelectionStore((state) => state.removeCardId);
  const clearCardSelection = useKanbanCardSelectionStore((state) => state.clearSelection);

  /* Backlog column batch icon (SAIPEM board): confirm the batch built from the ticked cards. */
  const [showBatchConfirmModal, setShowBatchConfirmModal] = useState(false);
  /* Column the batch moves its cards to — the one after Backlog on the board. */
  const [selectedBatchTargetColumn, setSelectedBatchTargetColumn] = useState(null);
  const moveCardsToColumn = useBatchMoveStore((state) => state.moveCardsToColumn);
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);

  const handleColumnBatchAction = useCallback(
    ({ nextColumnKey }) => {
      if (selectedCardIds.length === 0) return;
      setSelectedBatchTargetColumn(nextColumnKey);
      setShowBatchConfirmModal(true);
    },
    [selectedCardIds]
  );

  const handleCloseBatchConfirm = useCallback(() => setShowBatchConfirmModal(false), []);

  /* "Sent for SE creation" on a batch group header opens the email draft for that batch. */
  const [showSeRequestEmailModal, setShowSeRequestEmailModal] = useState(false);
  const [selectedSeRequestBatch, setSelectedSeRequestBatch] = useState(null);
  const [seRequestEmailDraft, setSeRequestEmailDraft] = useState(null);
  const batchIdByNumber = useBatchMoveStore((state) => state.batchIdByNumber);

  /* Opens the email prefilled from the backend draft for the batch. */
  const handleBatchSendSeRequest = useCallback(
    async (batch) => {
      const batchId = batchIdByNumber[batch?.title];
      if (!batchId) {
        notify("Batch not found", "error");
        return;
      }
      let data;
      try {
        ({ data } = await daService.getSeCreationEmailDraft(batchId));
      } catch (error) {
        data = error?.response?.data;
      }
      if (data?.status !== "success" || !data?.data) {
        notify(data?.message || "Failed to load SE creation email draft", "error");
        return;
      }
      setSeRequestEmailDraft(data.data);
      setSelectedSeRequestBatch(batch);
      setShowSeRequestEmailModal(true);
    },
    [batchIdByNumber]
  );

  const handleCloseSeRequestEmail = useCallback(() => {
    setShowSeRequestEmailModal(false);
    setSelectedSeRequestBatch(null);
    setSeRequestEmailDraft(null);
  }, []);

  /* Sends the SE creation email via da_send_action_email. The endpoint takes a single call_id,
     so the batch's first card with a call is used. */
  const [isSendingSeRequestEmail, setIsSendingSeRequestEmail] = useState(false);

  const handleSendSeRequestEmail = useCallback(
    async (emailData) => {
      const callId = (selectedSeRequestBatch?.cards || [])
        .map((card) => card?.callId ?? cardsById[card?.id]?.callId)
        .find(Boolean);
      if (!callId) {
        notify("No call found for this batch", "error");
        return;
      }

      const formData = new FormData();
      formData.append("call_id", callId);
      formData.append("to", emailData?.to ?? "");
      formData.append("cc", emailData?.cc ?? "");
      formData.append("subject", emailData?.subject ?? "");
      formData.append("body", emailData?.message ?? "");
      if (seRequestEmailDraft?.stage_document_id != null) {
        formData.append("stage_document_id", seRequestEmailDraft.stage_document_id);
      }
      (emailData?.attachments || []).forEach((file) => formData.append("attachments[]", file));

      setIsSendingSeRequestEmail(true);
      try {
        let data;
        try {
          ({ data } = await daService.sendActionEmail(formData));
        } catch (error) {
          data = error?.response?.data;
        }
        if (!data || data.status === "error" || data.status === false) {
          notify(data?.message || "Failed to send SE creation email", "error");
          return;
        }
        notify(data.message || "Email sent successfully", "success");
        handleCloseSeRequestEmail();
        refetchBoard?.();
      } finally {
        setIsSendingSeRequestEmail(false);
      }
    },
    [selectedSeRequestBatch, seRequestEmailDraft, cardsById, handleCloseSeRequestEmail, refetchBoard]
  );

  /* Creates the batch on the backend from the ticked cards' calls. The backend issues the batch
     number (e.g. Sep_26_Batch1) and returns it as batch_number. */
  const handleConfirmBatch = useCallback(async () => {
    const batchCards = selectedCardIds
      .map((id) => cardsById[id])
      .filter((card) => card?.callId);
    if (batchCards.length === 0) {
      notify("Select at least one card with a call to create a batch", "error");
      setShowBatchConfirmModal(false);
      return;
    }

    const callIds = batchCards.map((card) => Number(card.callId));
    setIsCreatingBatch(true);
    try {
      let data;
      try {
        ({ data } = await daService.createHubBatch({ call_ids: callIds }));
      } catch (error) {
        data = error?.response?.data;
      }

      if (data?.status !== true) {
        notify(data?.message || "Failed to create batch", "error");
        return;
      }

      moveCardsToColumn(
        batchCards.map((card) => card.id),
        selectedBatchTargetColumn,
        data.batch_number,
        data.batch_id
      );
      notify(`Batch ${data.batch_number} created`, "success");
      setShowBatchConfirmModal(false);
      clearCardSelection();
    } finally {
      setIsCreatingBatch(false);
    }
  }, [
    selectedCardIds,
    cardsById,
    moveCardsToColumn,
    selectedBatchTargetColumn,
    clearCardSelection,
  ]);

  const handleToggleCardSelection = useCallback(
    (card) => toggleCardSelectionId(card.id),
    [toggleCardSelectionId]
  );

  /* Click-and-drag "paint" selection (Excel-style): mousedown on a card's checkbox flips it and
     starts a drag; every other card the pointer then enters is set to match that same target
     state, so a single drag can select or deselect a whole run of cards. `isDraggingRef`/
     `dragValueRef` are refs (not state) since they only need to be read from event handlers and
     must never trigger a re-render mid-drag. */
  const isDraggingRef = useRef(false);
  const dragValueRef = useRef(false);

  const handleCardSelectDragStart = useCallback(
    (card) => {
      const nextSelected = !selectedCardIds.includes(card.id);
      isDraggingRef.current = true;
      dragValueRef.current = nextSelected;
      setCardSelectionId(card.id, nextSelected);
    },
    [selectedCardIds, setCardSelectionId]
  );

  const handleCardSelectDragEnter = useCallback(
    (card) => {
      if (!isDraggingRef.current) return;
      setCardSelectionId(card.id, dragValueRef.current);
    },
    [setCardSelectionId]
  );

  useEffect(() => {
    const endDrag = () => {
      isDraggingRef.current = false;
    };
    window.addEventListener("mouseup", endDrag);
    return () => window.removeEventListener("mouseup", endDrag);
  }, []);

  // Drop any selected id that disappears from the board (moved/removed by a refetch).
  useEffect(() => {
    const staleIds = selectedCardIds.filter((id) => !cardsById[id]);
    staleIds.forEach((id) => removeCardSelectionId(id));
  }, [cardsById, selectedCardIds, removeCardSelectionId]);
  const handleCreateCard = useCallback(() => {
    // ADD_CARD no longer has a VIEW action — it's gated by its granular
    // Basic fields / Email actions instead.
    if (
      !hasAnyPermission(
        [PERMISSION_ACTIONS.BASIC_FIELDS, PERMISSION_ACTIONS.EMAIL].map((actionKey) => ({
          moduleKey: PERMISSION_MODULES.KANBAN_CARD,
          submoduleKey: PERMISSION_SUBMODULES.ADD_CARD,
          actionKey,
        }))
      )
    ) {
      return;
    }
    const newCard = createNewCardDraft(contextMenuColumn?.color, contextMenuLaneId);
    setSelectedCard(newCard);
    setIsAddMode(true);
    setAddTargetWorkflowId(null);
  }, [contextMenuColumn, contextMenuLaneId, setSelectedCard, setIsAddMode, setAddTargetWorkflowId, hasAnyPermission]);

  const handleWorkflowColumnHeightChange = useCallback(
    (columnId, height, laneId) => {
      handleColumnHeightChange(workflows, columnId, height, laneId);
    },
    [handleColumnHeightChange, workflows]
  );

  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu) {
        handleCloseContextMenu();
      }
    };

    if (contextMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => {
        document.removeEventListener("click", handleClickOutside);
      };
    }
    return undefined;
  }, [contextMenu, handleCloseContextMenu]);

  useEffect(() => {
    const handleClickOutside = () => {
      if (accordionMenu) {
        handleCloseAccordionMenu();
      }
    };

    if (accordionMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => {
        document.removeEventListener("click", handleClickOutside);
      };
    }
    return undefined;
  }, [accordionMenu, handleCloseAccordionMenu]);

  const selectedCardWorkflow = useMemo(() => {
    if (!selectedCard) return null;
    return findWorkflowByCardId(workflows, selectedCard.id);
  }, [selectedCard, workflows]);

  const addModeCardWorkflow = useMemo(
    () =>
      getAddModeCardFormWorkflow(
        workflows,
        isAddMode,
        selectedCardWorkflow,
        addTargetWorkflowId
      ),
    [workflows, isAddMode, selectedCardWorkflow, addTargetWorkflowId]
  );

  const columnsForCardForm = addModeCardWorkflow?.columns;
  const columnOrderForCardForm = addModeCardWorkflow?.columnOrder;

  if (showWorkspaces) {
    return <Workspaces />;
  }

  return (
    <div
      className={
        isDarkMode ? "kanban-board-wrapper kanban-board-wrapper-dark" : "kanban-board-wrapper"
      }
    >
      {boardLoadError && !isOperatorBoard && (
        <div
          className="kanban-board-load-banner"
          role="status"
          style={{
            padding: "8px 16px",
            fontSize: 13,
            color: "var(--text-primary)",
            background: "var(--bg-secondary)",
            borderBottom: "1px solid var(--color-warning)",
          }}
        >
          {boardLoadError}
        </div>
      )}
      <div style={{ position: "relative" }}>
        {boardLoading && !isOperatorBoard && (
          <div
            aria-busy="true"
            aria-live="polite"
            className={
              isDarkMode
                ? "kanban-board-loader-overlay kanban-board-loader-overlay-dark"
                : "kanban-board-loader-overlay"
            }
          >
            <div className="kanban-board-loader">
              <div className="kanban-board-spinner" />
              <div className="kanban-board-loader-text">Loading board...</div>
            </div>
          </div>
        )}
        <KanbanBoardContent
          workflows={visibleWorkflows}
          cardsById={cardsById}
          boardLoading={boardLoading}
          suppressEmptyMessage={isOperatorBoard}
          expandedWorkflows={expandedWorkflows}
          collapsedColumns={collapsedColumns}
          maxColumnHeights={maxColumnHeights}
          pinnedWorkflows={pinnedWorkflows}
          createDragEndHandler={createDragEndHandler}
          onSelectCard={handleSelectCard}
          onColumnHeaderClick={handleColumnHeaderClick}
          onColumnBatchAction={handleColumnBatchAction}
          onBatchSendSeRequest={handleBatchSendSeRequest}
          onContextMenu={handleColumnContextMenu}
          onHeightChange={handleWorkflowColumnHeightChange}
          onToggleWorkflow={handleToggleWorkflow}
          onAccordionMenuClick={handleAccordionMenuClick}
          onPinClick={handleWorkflowPinClick}
          isDarkMode={isDarkMode}
          layoutView={layoutView}
          selectedActionCardIds={selectedCardIds}
          onToggleCardSelect={handleToggleCardSelection}
          onCardSelectDragStart={handleCardSelectDragStart}
          onCardSelectDragEnter={handleCardSelectDragEnter}
        />
      </div>

      <StatusConfirmationModal
        show={showBatchConfirmModal}
        statusText={`Create a batch with the ${selectedCardIds.length} selected ${
          selectedCardIds.length === 1 ? "card" : "cards"
        }?`}
        icon={confirmTickIcon}
        onCancel={handleCloseBatchConfirm}
        onConfirm={handleConfirmBatch}
        isLoading={isCreatingBatch}
      />

      <SeCreationEmailModal
        show={showSeRequestEmailModal}
        onClose={handleCloseSeRequestEmail}
        onSend={handleSendSeRequestEmail}
        isSubmitting={isSendingSeRequestEmail}
        batchTitle={seRequestEmailDraft?.batch_number || selectedSeRequestBatch?.title || ""}
        defaultTo={seRequestEmailDraft?.recipient ?? ""}
        defaultCc={seRequestEmailDraft?.cc ?? ""}
        defaultSubject={seRequestEmailDraft?.subject ?? ""}
        defaultBody={seRequestEmailDraft?.body ?? ""}
        documentUrl={seRequestEmailDraft?.document_url ?? ""}
      />

      {selectedCard && columnsForCardForm && (
        <CardForm
          show={true}
          close={handleCloseCard}
          card={selectedCard}
          moveCardToColumn={moveCardToColumn}
          columns={columnsForCardForm}
          columnOrder={columnOrderForCardForm}
          currentColumn={isAddMode ? null : findCardColumn(selectedCard.id)}
          isAddMode={isAddMode}
          variant={selectedCard?.cardVariant ?? resolveCardFormVariant(selectedCard?.workflow_role_id, userRoleId)}
          boardId={selectedBoardId}
          onBoardRefresh={isOperatorBoard ? undefined : refetchBoard}
          patchCardColor={patchCardColor}
          patchCardTitle={patchCardTitle}
          patchCardType={patchCardType}
          patchCardBlocker={patchCardBlocker}
          patchCardSticker={patchCardSticker}
          patchCardTag={patchCardTag}
        />
      )}

      <ContextMenu
        position={contextMenu}
        onClose={handleCloseContextMenu}
        onCreateCard={handleCreateCard}
      />

      <AccordionMenu
        position={accordionMenu}
        onClose={handleCloseAccordionMenu}
        onExpand={handleAccordionExpand}
        onCollapse={handleAccordionCollapse}
        isExpanded={
          accordionMenuWorkflowId ? expandedWorkflows[accordionMenuWorkflowId] : false
        }
        isPinned={
          accordionMenuWorkflowId ? pinnedWorkflows[accordionMenuWorkflowId] : false
        }
        onTogglePin={handleTogglePin}
      />
    </div>
  );
}
