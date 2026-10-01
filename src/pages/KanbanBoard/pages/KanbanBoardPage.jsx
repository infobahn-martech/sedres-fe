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
import SeApprovalUploadModal from "../components/board/SeApprovalUploadModal";
import SeReviewMoveModal from "../components/board/SeReviewMoveModal";
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

  /* "Send For SE creation" on a batch group header opens the email draft for that batch. */
  const [showSeRequestEmailModal, setShowSeRequestEmailModal] = useState(false);
  const [selectedSeRequestBatch, setSelectedSeRequestBatch] = useState(null);
  const [seRequestEmailDraft, setSeRequestEmailDraft] = useState(null);
  const batchIdByNumber = useBatchMoveStore((state) => state.batchIdByNumber);

  /* Unique call ids of the batch's cards. */
  const getBatchCallIds = useCallback(
    (batch) => [
      ...new Set(
        (batch?.cards || []).map((card) => card?.callId ?? cardsById[card?.id]?.callId).filter(Boolean)
      ),
    ],
    [cardsById]
  );

  /* Opens the email prefilled from the backend draft for the batch's ticked cards. */
  const handleBatchSendSeRequest = useCallback(
    async (batch) => {
      const batchId = batchIdByNumber[batch?.title];
      if (!batchId) {
        notify("Batch not found", "error");
        return;
      }
      const callIds = getBatchCallIds(batch);
      if (callIds.length === 0) {
        notify("Select at least one card to send for SE creation", "error");
        return;
      }
      let data;
      try {
        ({ data } = await daService.getSeCreationEmailDraft(batchId, callIds));
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
    [batchIdByNumber, getBatchCallIds]
  );

  const handleCloseSeRequestEmail = useCallback(() => {
    setShowSeRequestEmailModal(false);
    setSelectedSeRequestBatch(null);
    setSeRequestEmailDraft(null);
  }, []);

  /* Sends the SE creation email for the batch via da/send_se_creation_email, with the ticked cards' call ids. */
  const [isSendingSeRequestEmail, setIsSendingSeRequestEmail] = useState(false);

  const handleSendSeRequestEmail = useCallback(
    async (emailData) => {
      const batchId = seRequestEmailDraft?.batch_id ?? batchIdByNumber[selectedSeRequestBatch?.title];
      if (!batchId) {
        notify("Batch not found", "error");
        return;
      }

      const formData = new FormData();
      formData.append("batch_id", batchId);
      formData.append("to", emailData?.to ?? "");
      formData.append("cc", emailData?.cc ?? "");
      formData.append("subject", emailData?.subject ?? "");
      formData.append("body", emailData?.message ?? "");
      if (seRequestEmailDraft?.stage_document_id != null) {
        formData.append("stage_document_id", seRequestEmailDraft.stage_document_id);
      }
      const callIds = getBatchCallIds(selectedSeRequestBatch);
      if (callIds.length) {
        formData.append("call_ids", callIds.join(","));
      }
      (emailData?.attachments || []).forEach((file) => formData.append("attachments[]", file));

      setIsSendingSeRequestEmail(true);
      try {
        let data;
        try {
          ({ data } = await daService.sendSeCreationEmail(formData));
        } catch (error) {
          data = error?.response?.data;
        }
        if (data?.status !== "success") {
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
    [
      selectedSeRequestBatch,
      seRequestEmailDraft,
      batchIdByNumber,
      getBatchCallIds,
      handleCloseSeRequestEmail,
      refetchBoard,
    ]
  );

  /* "Upload SE Approval" on an "Awaiting SE" batch header opens the upload modal for that batch. */
  const [showSeApprovalUploadModal, setShowSeApprovalUploadModal] = useState(false);
  const [selectedSeApprovalBatch, setSelectedSeApprovalBatch] = useState(null);
  const [isUploadingSeApproval, setIsUploadingSeApproval] = useState(false);

  const handleBatchUploadSeApproval = useCallback((batch) => {
    setSelectedSeApprovalBatch(batch);
    setShowSeApprovalUploadModal(true);
  }, []);

  const handleCloseSeApprovalUpload = useCallback(() => {
    setShowSeApprovalUploadModal(false);
    setSelectedSeApprovalBatch(null);
  }, []);

  const seDocumentUploadedByBatchId = useBatchMoveStore((state) => state.seDocumentUploadedByBatchId);
  const markSeDocumentUploaded = useBatchMoveStore((state) => state.markSeDocumentUploaded);
  const setSeReview = useBatchMoveStore((state) => state.setSeReview);
  const selectedSeApprovalBatchId = batchIdByNumber[selectedSeApprovalBatch?.title];

  /* SE excel sheet is required on a batch's first upload; the approval email can follow later. */
  const seApprovalUploadFields = useMemo(
    () => [
      {
        name: "se_document",
        label: "SE Document",
        accept: ".xlsx,.xls",
        formatsHint: "XLSX, XLS",
        required: !seDocumentUploadedByBatchId[selectedSeApprovalBatchId],
      },
      {
        name: "se_approval_email",
        label: "SE Approval Email",
        accept: ".msg,.eml",
        formatsHint: "MSG, EML",
      },
    ],
    [seDocumentUploadedByBatchId, selectedSeApprovalBatchId]
  );

  /* Stores the SE document and/or approval email against the batch via da/upload_se_approval. */
  const handleUploadSeApproval = useCallback(
    async ({ se_document: seDocument, se_approval_email: seApprovalEmail }) => {
      const batchId = selectedSeApprovalBatchId;
      if (!batchId) {
        notify("Batch not found", "error");
        return;
      }

      const formData = new FormData();
      formData.append("batch_id", batchId);
      if (seDocument?.[0]) formData.append("se_document", seDocument[0]);
      if (seApprovalEmail?.[0]) formData.append("se_approval_email", seApprovalEmail[0]);

      setIsUploadingSeApproval(true);
      try {
        let data;
        try {
          ({ data } = await daService.uploadSeApproval(formData));
        } catch (error) {
          data = error?.response?.data;
        }
        if (data?.status !== "success") {
          notify(data?.message || "Failed to upload SE approval", "error");
          return;
        }
        if (seDocument?.[0]) markSeDocumentUploaded(batchId);
        setSeReview(data.data?.se_review, { resetUnticks: true });
        notify(data.message || "SE approval uploaded successfully", "success");
        handleCloseSeApprovalUpload();
        refetchBoard?.();
      } finally {
        setIsUploadingSeApproval(false);
      }
    },
    [
      selectedSeApprovalBatchId,
      markSeDocumentUploaded,
      setSeReview,
      handleCloseSeApprovalUpload,
      refetchBoard,
    ]
  );

  /* "Upload Invoice" on an "SE Received" batch header opens the upload modal for that batch.
     UI only for now: no backend route exists yet to persist the invoice file. */
  const [showInvoiceUploadModal, setShowInvoiceUploadModal] = useState(false);
  const [selectedInvoiceBatch, setSelectedInvoiceBatch] = useState(null);

  const handleBatchUploadInvoice = useCallback((batch) => {
    setSelectedInvoiceBatch(batch);
    setShowInvoiceUploadModal(true);
  }, []);

  const handleCloseInvoiceUpload = useCallback(() => {
    setShowInvoiceUploadModal(false);
    setSelectedInvoiceBatch(null);
  }, []);

  const batchByCardId = useBatchMoveStore((state) => state.batchByCardId);

  /* The same upload from the "SE Received" column header, for the cards ticked in that column
     (loose cards have no batch header to carry the button). */
  const handleColumnUploadInvoice = useCallback(
    (cards) => {
      if (!cards?.length) return;
      const batchNumbers = [...new Set(cards.map((card) => batchByCardId[card.id]).filter(Boolean))];
      handleBatchUploadInvoice({ id: "se-received-selection", title: batchNumbers.join(", "), cards });
    },
    [batchByCardId, handleBatchUploadInvoice]
  );

  const handleUploadInvoices = useCallback(
    (files) => {
      const cardCount = selectedInvoiceBatch?.cards?.length ?? 0;
      notify(
        `${files.length} ${files.length === 1 ? "invoice" : "invoices"} attached for ${cardCount} ${
          cardCount === 1 ? "card" : "cards"
        }`,
        "info"
      );
      (selectedInvoiceBatch?.cards ?? []).forEach((card) => removeCardSelectionId(card.id));
      handleCloseInvoiceUpload();
    },
    [selectedInvoiceBatch, removeCardSelectionId, handleCloseInvoiceUpload]
  );

  /* "Merge Invoice" on the "AR Invoices Issued" column header opens a bulk upload for the ticked
     cards of that column. UI only for now: no backend route exists yet to persist the invoices. */
  const [showMergeInvoiceModal, setShowMergeInvoiceModal] = useState(false);
  const [selectedMergeInvoiceCards, setSelectedMergeInvoiceCards] = useState([]);

  const handleColumnMergeInvoice = useCallback((cards) => {
    if (!cards?.length) return;
    setSelectedMergeInvoiceCards(cards);
    setShowMergeInvoiceModal(true);
  }, []);

  const handleCloseMergeInvoice = useCallback(() => {
    setShowMergeInvoiceModal(false);
    setSelectedMergeInvoiceCards([]);
  }, []);

  const handleMergeInvoices = useCallback(
    (files) => {
      const cardCount = selectedMergeInvoiceCards.length;
      notify(
        `${files.length} ${files.length === 1 ? "invoice" : "invoices"} attached for ${cardCount} ${
          cardCount === 1 ? "card" : "cards"
        }`,
        "info"
      );
      selectedMergeInvoiceCards.forEach((card) => removeCardSelectionId(card.id));
      handleCloseMergeInvoice();
    },
    [selectedMergeInvoiceCards, removeCardSelectionId, handleCloseMergeInvoice]
  );

  const mergeInvoiceBatchTitle = useMemo(
    () =>
      [...new Set(selectedMergeInvoiceCards.map((card) => batchByCardId[card.id]).filter(Boolean))].join(", "),
    [selectedMergeInvoiceCards, batchByCardId]
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

      /* The backend picks the target column by category (Crewing/Port Call) and returns it as
         column_id; column keys on the board are String(column_id). */
      moveCardsToColumn(
        batchCards.map((card) => card.id),
        data.column_id != null ? String(data.column_id) : selectedBatchTargetColumn,
        data.batch_number,
        data.batch_id
      );
      notify(
        data.column_name
          ? `Batch ${data.batch_number} created and moved to ${data.column_name}`
          : `Batch ${data.batch_number} created`,
        "success"
      );
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
          onBatchUploadSeApproval={handleBatchUploadSeApproval}
          onBatchUploadInvoice={handleBatchUploadInvoice}
          onColumnUploadInvoice={handleColumnUploadInvoice}
          onColumnMergeInvoice={handleColumnMergeInvoice}
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

      <SeApprovalUploadModal
        show={showSeApprovalUploadModal}
        onClose={handleCloseSeApprovalUpload}
        onUpload={handleUploadSeApproval}
        isSubmitting={isUploadingSeApproval}
        batchTitle={selectedSeApprovalBatch?.title ?? ""}
        subtitle="Attach the SE document and approval email for this batch"
        fields={seApprovalUploadFields}
      />

      <SeReviewMoveModal onConfirmed={refetchBoard} />

      <SeApprovalUploadModal
        show={showInvoiceUploadModal}
        onClose={handleCloseInvoiceUpload}
        onUpload={handleUploadInvoices}
        batchTitle={selectedInvoiceBatch?.title ?? ""}
        selectedCardCount={selectedInvoiceBatch?.cards?.length ?? 0}
        title="Upload Invoice"
        subtitle="Attach the invoices for the selected cards"
        submitLabel="Upload Invoice"
      />

      <SeApprovalUploadModal
        show={showMergeInvoiceModal}
        onClose={handleCloseMergeInvoice}
        onUpload={handleMergeInvoices}
        batchTitle={mergeInvoiceBatchTitle}
        selectedCardCount={selectedMergeInvoiceCards.length}
        title="Merge Invoice"
        subtitle="Attach the invoices for the selected cards"
        submitLabel="Upload Invoices"
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
