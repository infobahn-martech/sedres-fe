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
import ArInvoiceReviewModal from "../components/board/ArInvoiceReviewModal";
import PoReviewModal from "../components/board/PoReviewModal";
import SubmissionDocumentsModal from "../components/board/SubmissionDocumentsModal";
import ContextMenu from "../components/menus/ContextMenu";
import AccordionMenu from "../components/menus/AccordionMenu";
import useKanbanBoardState from "../hooks/useKanbanBoardState";
import useWorkflowExpansion from "../hooks/useWorkflowExpansion";
import useWorkflowPinning from "../hooks/useWorkflowPinning";
import useColumnHeights from "../hooks/useColumnHeights";
import useKanbanDnD from "../hooks/useKanbanDnD";
import useKanbanRoleAccess from "../hooks/useKanbanRoleAccess";
import useKanbanMarqueeSelect from "../hooks/useKanbanMarqueeSelect";
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
import { downloadFile } from "../../../shared/utils/utils";
import { useThemeStore } from "../../../shared/store/themeStore";
import useKanbanCardSelectionStore from "../../../shared/store/kanbanCardSelectionStore";
import useBatchMoveStore from "../../../shared/store/batchMoveStore";
import useArInvoiceReviewStore from "../../../shared/store/arInvoiceReviewStore";
import usePoReviewStore from "../../../shared/store/poReviewStore";
import "../../../design/scss/pages/kanban-board/marquee-select.scss";

/* "SE Received" bulk invoice upload: PDFs only. da/upload_ar_invoices takes max_files_per_request
   (20) files per call, so larger uploads are sent in chunks of that size, one after another. */
const AR_INVOICE_FIELD_NAME = "invoices";
const AR_INVOICE_FILES_PER_REQUEST = 20;
/* How many unmatched file names the warning lists before summarising the rest. */
const AR_INVOICE_NOT_PLACED_PREVIEW = 5;
const arInvoiceUploadFields = [
  {
    name: AR_INVOICE_FIELD_NAME,
    accept: ".pdf",
    formatsHint: "PDF",
    multiple: true,
  },
];
/* McDermott "Requested PO" bulk PO upload: PDFs only, sent to da/upload_pos in chunks of
   max_files_per_request (20), like the AR invoices above. */
const PO_FIELD_NAME = "pos";
const PO_FILES_PER_REQUEST = 20;
const poUploadFields = [
  {
    name: PO_FIELD_NAME,
    accept: ".pdf",
    formatsHint: "PDF",
    multiple: true,
  },
];
/* The files da/send_submission_email takes on top of the documents the draft already attaches,
   in the order the draft body lists them (the draft's merged invoices come last). The consolidated
   invoice and merged invoices are attached by the draft; a file picked on their row is sent in addition. */
const FINAL_SUBMISSION_FILE_FIELDS = [
  { name: "signed_letter", label: "Covering letter (signed and stamped)", required: true },
  { name: "consolidated_invoice", label: "Consolidated invoice (Excel)", multiple: true },
  { name: "approved_se_sheet", label: "Approved SE sheet", multiple: true },
  { name: "approved_se_copies", label: "Copies of approved SEs", multiple: true },
  { name: "merged_invoices", label: "Merged invoices", multiple: true },
];
/* The draft's attachments that belong to a field's row, by their `kind`, or by file name
   (Submission_Letter_<inv>_<id>.pdf, Consolidated_Invoice_<inv>_<id>.xlsx) for a draft without one. */
const FINAL_SUBMISSION_DRAFT_FILES = {
  signed_letter: { kind: "letter", pattern: /^submission_letter/i },
  consolidated_invoice: { kind: "consolidated", pattern: /^consolidated_invoice/i },
  approved_se_sheet: { kind: "se_sheet", pattern: /_approved_se\.[a-z]+$/i },
};

const isDraftFile = ({ kind, pattern }, attachment) =>
  attachment?.kind ? attachment.kind === kind : pattern.test(attachment?.name ?? "");

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
  const setSelectedCardIds = useKanbanCardSelectionStore((state) => state.setSelectedCardIds);

  /* Backlog column batch icon (SAIPEM board): confirm the batch built from the ticked cards. */
  const [showBatchConfirmModal, setShowBatchConfirmModal] = useState(false);
  /* Column the batch moves its cards to — the one after Backlog on the board. */
  const [selectedBatchTargetColumn, setSelectedBatchTargetColumn] = useState(null);
  /* The cards ticked in Backlog; ticks in other columns (e.g. the invoice columns) stay out. */
  const [selectedBatchCardIds, setSelectedBatchCardIds] = useState([]);
  const moveCardsToColumn = useBatchMoveStore((state) => state.moveCardsToColumn);
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);

  const handleColumnBatchAction = useCallback(
    ({ nextColumnKey, cardIds = [] }) => {
      if (cardIds.length === 0) return;
      setSelectedBatchCardIds(cardIds);
      setSelectedBatchTargetColumn(nextColumnKey);
      setShowBatchConfirmModal(true);
    },
    []
  );

  const handleCloseBatchConfirm = useCallback(() => setShowBatchConfirmModal(false), []);

  /* "Send For SE creation" on a batch group header opens the email draft for that batch. */
  const [showSeRequestEmailModal, setShowSeRequestEmailModal] = useState(false);
  const [selectedSeRequestBatch, setSelectedSeRequestBatch] = useState(null);
  const [seRequestEmailDraft, setSeRequestEmailDraft] = useState(null);
  const batchIdByNumber = useBatchMoveStore((state) => state.batchIdByNumber);
  const clearCardColumns = useBatchMoveStore((state) => state.clearCardColumns);
  const clearSeTicks = useBatchMoveStore((state) => state.clearSeTicks);

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
        /* The backend moves the batch on; a column override left from creating it would keep
           drawing the cards in the old column. */
        const sentCardIds = (selectedSeRequestBatch?.cards ?? []).map((card) => card.id);
        clearCardColumns(sentCardIds);
        /* The batch lands in "Awaiting SE" with no card ticked. */
        clearSeTicks(sentCardIds);
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
      clearCardColumns,
      clearSeTicks,
      handleCloseSeRequestEmail,
      refetchBoard,
    ]
  );

  /* "Request PO" on a McDermott "Ready for PO Request" batch header opens the PO request email draft. */
  const [showPoRequestEmailModal, setShowPoRequestEmailModal] = useState(false);
  const [selectedPoRequestBatch, setSelectedPoRequestBatch] = useState(null);
  const [poRequestEmailDraft, setPoRequestEmailDraft] = useState(null);
  const [isSendingPoRequest, setIsSendingPoRequest] = useState(false);

  const handleBatchRequestPo = useCallback(
    async (batch) => {
      const batchId = batchIdByNumber[batch?.title];
      if (!batchId) {
        notify("Batch not found", "error");
        return;
      }
      let data;
      try {
        ({ data } = await daService.getPoRequestDraft(batchId));
      } catch (error) {
        data = error?.response?.data;
      }
      if (data?.status !== "success" || !data?.data) {
        notify(data?.message || "Failed to load PO request email draft", "error");
        return;
      }
      setPoRequestEmailDraft(data.data);
      setSelectedPoRequestBatch(batch);
      setShowPoRequestEmailModal(true);
    },
    [batchIdByNumber]
  );

  const handleClosePoRequestEmail = useCallback(() => {
    setShowPoRequestEmailModal(false);
    setSelectedPoRequestBatch(null);
    setPoRequestEmailDraft(null);
  }, []);

  /* Sends the PO request via da/send_po_request; the backend moves the batch's cards to "Requested PO". */
  const handleSendPoRequestEmail = useCallback(
    async (emailData) => {
      const batchId = poRequestEmailDraft?.batch_id ?? batchIdByNumber[selectedPoRequestBatch?.title];
      if (!batchId) {
        notify("Batch not found", "error");
        return;
      }

      const formData = new FormData();
      formData.append("batch_id", batchId);
      if (poRequestEmailDraft?.stage_document_id != null) {
        formData.append("stage_document_id", poRequestEmailDraft.stage_document_id);
      }
      formData.append("to", emailData?.to ?? "");
      formData.append("cc", emailData?.cc ?? "");
      formData.append("subject", emailData?.subject ?? "");
      formData.append("body", emailData?.message ?? "");
      (emailData?.attachments || []).forEach((file) => formData.append("attachments[]", file));

      setIsSendingPoRequest(true);
      try {
        let data;
        try {
          ({ data } = await daService.sendPoRequest(formData));
        } catch (error) {
          data = error?.response?.data;
        }
        if (data?.status !== "success") {
          notify(data?.message || "Failed to send PO request", "error");
          return;
        }
        notify(data.message || "PO request sent successfully", "success");
        /* A column override left from creating the batch would keep drawing the cards in the old column. */
        clearCardColumns((selectedPoRequestBatch?.cards ?? []).map((card) => card.id));
        handleClosePoRequestEmail();
        refetchBoard?.();
      } finally {
        setIsSendingPoRequest(false);
      }
    },
    [
      poRequestEmailDraft,
      selectedPoRequestBatch,
      batchIdByNumber,
      clearCardColumns,
      handleClosePoRequestEmail,
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
        setSeReview(data.data?.se_review);
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

  /* "Upload Invoice" on an "SE Received" batch header opens the upload modal for that batch. */
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
     (loose cards have no batch header to carry the button). McDermott's "Issue AR Invoice" uses it
     too, with its workflowId: its invoice review is read per workflow. */
  const handleColumnUploadInvoice = useCallback(
    (cards, { workflowId = null } = {}) => {
      if (!cards?.length) return;
      const batchNumbers = [...new Set(cards.map((card) => batchByCardId[card.id]).filter(Boolean))];
      handleBatchUploadInvoice({
        id: "se-received-selection",
        title: batchNumbers.join(", "),
        cards,
        workflowId,
      });
    },
    [batchByCardId, handleBatchUploadInvoice]
  );

  const [isUploadingInvoices, setIsUploadingInvoices] = useState(false);
  const openArInvoiceReviewModal = useArInvoiceReviewStore((state) => state.openArInvoiceReviewModal);

  /* Bulk AR invoice upload for the ticked cards: the backend matches each PDF to a card's sales
     order. Files go in chunks of AR_INVOICE_FILES_PER_REQUEST; each response carries the latest
     state of every card, so the last one wins per card, and unmatched files are collected. */
  const [invoiceUploadProgress, setInvoiceUploadProgress] = useState(null);

  const handleUploadInvoices = useCallback(
    async ({ [AR_INVOICE_FIELD_NAME]: invoices = [] }) => {
      const cards = selectedInvoiceBatch?.cards ?? [];
      const callIds = getBatchCallIds(selectedInvoiceBatch);
      if (!callIds.length) {
        notify("The selected cards have no call to upload invoices for", "error");
        return;
      }

      const chunks = [];
      for (let start = 0; start < invoices.length; start += AR_INVOICE_FILES_PER_REQUEST) {
        chunks.push(invoices.slice(start, start + AR_INVOICE_FILES_PER_REQUEST));
      }

      const reviewCardById = {};
      const notPlacedFiles = [];
      let receivedCount = 0;
      let failedMessage = null;

      setIsUploadingInvoices(true);
      setInvoiceUploadProgress({ done: 0, total: invoices.length });
      try {
        for (const chunk of chunks) {
          const formData = new FormData();
          formData.append("call_ids", callIds.join(","));
          formData.append("card_ids", cards.map((card) => card.id).join(","));
          chunk.forEach((file) => formData.append("invoices[]", file));

          let data;
          try {
            ({ data } = await daService.uploadArInvoices(formData));
          } catch (error) {
            data = error?.response?.data;
          }
          if (data?.status !== "success") {
            failedMessage = data?.message || "Failed to upload invoices";
            break;
          }
          receivedCount += data.data?.received_files?.length ?? chunk.length;
          notPlacedFiles.push(...(data.data?.not_placed_files ?? []));
          (data.data?.cards ?? []).forEach((card) => {
            reviewCardById[String(card.card_id)] = card;
          });
          setInvoiceUploadProgress((prev) => ({ ...prev, done: prev.done + chunk.length }));
        }

        if (!receivedCount) {
          notify(failedMessage || "Failed to upload invoices", "error");
          return;
        }
        if (failedMessage) {
          notify(
            `Uploaded ${receivedCount} of ${invoices.length} invoices, then stopped: ${failedMessage}`,
            "error"
          );
        } else {
          notify(
            `${receivedCount} ${receivedCount === 1 ? "invoice" : "invoices"} uploaded successfully`,
            "success"
          );
        }
        if (notPlacedFiles.length) {
          const preview = notPlacedFiles.slice(0, AR_INVOICE_NOT_PLACED_PREVIEW).join(", ");
          const restCount = notPlacedFiles.length - AR_INVOICE_NOT_PLACED_PREVIEW;
          notify(
            `${notPlacedFiles.length} ${
              notPlacedFiles.length === 1 ? "file" : "files"
            } not matched to any sales order: ${preview}${restCount > 0 ? ` and ${restCount} more` : ""}`,
            "warn"
          );
        }
        cards.forEach((card) => removeCardSelectionId(card.id));
        handleCloseInvoiceUpload();
        /* The response lists every SE Received card; the review covers only the ones uploaded for. */
        openArInvoiceReviewModal(
          cards.map((card) => reviewCardById[String(card.id)]).filter(Boolean),
          { workflowId: selectedInvoiceBatch?.workflowId ?? null }
        );
        refetchBoard?.();
      } finally {
        setIsUploadingInvoices(false);
        setInvoiceUploadProgress(null);
      }
    },
    [
      selectedInvoiceBatch,
      getBatchCallIds,
      removeCardSelectionId,
      handleCloseInvoiceUpload,
      openArInvoiceReviewModal,
      refetchBoard,
    ]
  );

  /* "Upload POs" on McDermott's "Requested PO" column header, for the cards ticked there (all of
     them by default). The backend matches each PO PDF to a card's sales order by its invoice. */
  const [showPoUploadModal, setShowPoUploadModal] = useState(false);
  const [selectedPoUploadCards, setSelectedPoUploadCards] = useState([]);
  const [selectedPoUploadWorkflowId, setSelectedPoUploadWorkflowId] = useState(null);
  const [isUploadingPos, setIsUploadingPos] = useState(false);
  const [poUploadProgress, setPoUploadProgress] = useState(null);
  const openPoReviewModal = usePoReviewStore((state) => state.openPoReviewModal);

  const handleColumnUploadPos = useCallback((cards, { workflowId = null } = {}) => {
    if (!cards?.length) return;
    setSelectedPoUploadCards(cards);
    setSelectedPoUploadWorkflowId(workflowId);
    setShowPoUploadModal(true);
  }, []);

  const handleClosePoUpload = useCallback(() => {
    setShowPoUploadModal(false);
    setSelectedPoUploadCards([]);
    setSelectedPoUploadWorkflowId(null);
  }, []);

  /* Files go in chunks of PO_FILES_PER_REQUEST; each response carries the latest state of every
     card, so the last one wins per card, and unplaced files are collected for the review. */
  const handleUploadPos = useCallback(
    async ({ [PO_FIELD_NAME]: pos = [] }) => {
      const cards = selectedPoUploadCards;
      const workflowId = selectedPoUploadWorkflowId;
      const callIds = getBatchCallIds({ cards });
      if (!callIds.length) {
        notify("The selected cards have no call to upload POs for", "error");
        return;
      }

      const chunks = [];
      for (let start = 0; start < pos.length; start += PO_FILES_PER_REQUEST) {
        chunks.push(pos.slice(start, start + PO_FILES_PER_REQUEST));
      }

      const reviewCardById = {};
      const notPlacedFiles = [];
      let receivedCount = 0;
      let failedMessage = null;

      setIsUploadingPos(true);
      setPoUploadProgress({ done: 0, total: pos.length });
      try {
        for (const chunk of chunks) {
          const formData = new FormData();
          formData.append("call_ids", callIds.join(","));
          formData.append("card_ids", cards.map((card) => card.id).join(","));
          chunk.forEach((file) => formData.append("pos[]", file));

          let data;
          try {
            ({ data } = await daService.uploadPos(formData));
          } catch (error) {
            data = error?.response?.data;
          }
          if (data?.status !== "success") {
            failedMessage = data?.message || "Failed to upload POs";
            break;
          }
          receivedCount += data.data?.received_files?.length ?? chunk.length;
          notPlacedFiles.push(...(data.data?.not_placed_files ?? []));
          (data.data?.cards ?? []).forEach((card) => {
            reviewCardById[String(card.card_id)] = card;
          });
          setPoUploadProgress((prev) => ({ ...prev, done: prev.done + chunk.length }));
        }

        if (!receivedCount) {
          notify(failedMessage || "Failed to upload POs", "error");
          return;
        }
        if (failedMessage) {
          notify(`Uploaded ${receivedCount} of ${pos.length} POs, then stopped: ${failedMessage}`, "error");
        } else {
          notify(`${receivedCount} ${receivedCount === 1 ? "PO" : "POs"} uploaded successfully`, "success");
        }
        cards.forEach((card) => removeCardSelectionId(card.id));
        handleClosePoUpload();
        openPoReviewModal(
          cards.map((card) => reviewCardById[String(card.id)]).filter(Boolean),
          { notPlacedFiles, workflowId }
        );
        refetchBoard?.();
      } finally {
        setIsUploadingPos(false);
        setPoUploadProgress(null);
      }
    },
    [
      selectedPoUploadCards,
      selectedPoUploadWorkflowId,
      getBatchCallIds,
      removeCardSelectionId,
      handleClosePoUpload,
      openPoReviewModal,
      refetchBoard,
    ]
  );

  /* "Send Invoice" on McDermott's "PO Received" column header, for the one card ticked there,
     opens that card's invoice email draft. */
  const [showInvoiceDispatchEmailModal, setShowInvoiceDispatchEmailModal] = useState(false);
  const [selectedInvoiceDispatchCard, setSelectedInvoiceDispatchCard] = useState(null);
  const [invoiceDispatchDraft, setInvoiceDispatchDraft] = useState(null);
  const [isSendingInvoiceDispatch, setIsSendingInvoiceDispatch] = useState(false);

  const handleColumnSendInvoice = useCallback(async (card) => {
    if (!card?.callId) {
      notify("The selected card has no call to send the invoice for", "error");
      return;
    }
    let data;
    try {
      ({ data } = await daService.getInvoiceDispatchDraft(card.callId));
    } catch (error) {
      data = error?.response?.data;
    }
    if (data?.status !== "success" || !data?.data) {
      notify(data?.message || "Failed to load invoice email draft", "error");
      return;
    }
    setInvoiceDispatchDraft(data.data);
    setSelectedInvoiceDispatchCard(card);
    setShowInvoiceDispatchEmailModal(true);
  }, []);

  const handleCloseInvoiceDispatchEmail = useCallback(() => {
    setShowInvoiceDispatchEmailModal(false);
    setSelectedInvoiceDispatchCard(null);
    setInvoiceDispatchDraft(null);
  }, []);

  /* Sends the invoice email; the backend moves the card to "Invoice Dispatched". */
  const handleSendInvoiceDispatchEmail = useCallback(
    async (emailData) => {
      const callId = invoiceDispatchDraft?.call_id ?? selectedInvoiceDispatchCard?.callId;
      const cardId = invoiceDispatchDraft?.card_id ?? selectedInvoiceDispatchCard?.id;
      if (!callId || !cardId) {
        notify("Card not found", "error");
        return;
      }

      const formData = new FormData();
      formData.append("call_id", callId);
      formData.append("card_id", cardId);
      if (invoiceDispatchDraft?.stage_document_id != null) {
        formData.append("stage_document_id", invoiceDispatchDraft.stage_document_id);
      }
      formData.append("to", emailData?.to ?? "");
      formData.append("cc", emailData?.cc ?? "");
      formData.append("subject", emailData?.subject ?? "");
      formData.append("body", emailData?.message ?? "");
      (emailData?.attachments || []).forEach((file) => formData.append("attachments[]", file));

      setIsSendingInvoiceDispatch(true);
      try {
        let data;
        try {
          ({ data } = await daService.sendInvoiceDispatch(formData));
        } catch (error) {
          data = error?.response?.data;
        }
        if (data?.status !== "success") {
          notify(data?.message || "Failed to send invoice", "error");
          return;
        }
        notify(data.message || "Invoice sent successfully", "success");
        removeCardSelectionId(selectedInvoiceDispatchCard?.id);
        handleCloseInvoiceDispatchEmail();
        refetchBoard?.();
      } finally {
        setIsSendingInvoiceDispatch(false);
      }
    },
    [
      invoiceDispatchDraft,
      selectedInvoiceDispatchCard,
      removeCardSelectionId,
      handleCloseInvoiceDispatchEmail,
      refetchBoard,
    ]
  );

  /* The invoice PDF the backend already holds for the email, shown under its document name. */
  const invoiceDispatchDocuments = useMemo(
    () =>
      invoiceDispatchDraft?.document_url
        ? [
            {
              name: invoiceDispatchDraft.document_name || "Invoice",
              url: invoiceDispatchDraft.document_url,
            },
          ]
        : [],
    [invoiceDispatchDraft]
  );

  /* "Merge Invoice" on the "AR Invoices Issued" column header merges the ticked cards' confirmed
     AR invoices into one PDF via da/merge_ar_invoices, then shows the merged file in a new window. */
  const [isMergingInvoices, setIsMergingInvoices] = useState(false);

  const handleColumnMergeInvoice = useCallback(
    async (cards) => {
      if (!cards?.length || isMergingInvoices) return;
      const mergeCards = cards
        .filter((card) => card.callId)
        .map((card) => ({ call_id: Number(card.callId), card_id: Number(card.id) }));
      if (!mergeCards.length) {
        notify("The selected cards have no call to merge invoices for", "error");
        return;
      }

      /* Opened while still inside the click so the browser does not block it as a popup; the merged
         PDF is loaded into it once the response arrives. */
      const mergedWindow = window.open("", "_blank");
      if (mergedWindow) {
        mergedWindow.opener = null;
        mergedWindow.document.title = "Merge Invoice";
        mergedWindow.document.body.textContent = "Merging invoices...";
      }

      setIsMergingInvoices(true);
      try {
        let data;
        try {
          ({ data } = await daService.mergeArInvoices({ cards: mergeCards }));
        } catch (error) {
          data = error?.response?.data;
        }
        if (data?.status !== "success" || !data.data?.merged_url) {
          mergedWindow?.close();
          notify(data?.message || "Failed to merge invoices", "error");
          return;
        }
        const { invoice_count: invoiceCount, merged_page_count: pageCount, merged_url: mergedUrl } =
          data.data ?? {};
        notify(
          `${invoiceCount ?? mergeCards.length} ${invoiceCount === 1 ? "invoice" : "invoices"} merged${
            pageCount ? ` (${pageCount} ${pageCount === 1 ? "page" : "pages"})` : ""
          }`,
          "success"
        );
        /* Downloads the merged PDF, then shows it in the new tab. The file sits on another origin, so it
           is fetched as a blob first: a plain download link to it would only navigate. While the uploads
           folder sends no CORS header the fetch fails, and the new tab alone shows the file. */
        try {
          const response = await fetch(mergedUrl);
          if (response.ok) {
            downloadFile({
              link: URL.createObjectURL(await response.blob()),
              fileName: decodeURIComponent(mergedUrl.split("/").pop()) || "Merged_Invoices.pdf",
            });
          }
        } catch {
          /* The new tab below still shows the merged PDF. */
        }
        if (mergedWindow) mergedWindow.location.href = mergedUrl;
        else window.open(mergedUrl, "_blank", "noopener,noreferrer");
        cards.forEach((card) => removeCardSelectionId(card.id));
        refetchBoard?.();
      } finally {
        setIsMergingInvoices(false);
      }
    },
    [isMergingInvoices, removeCardSelectionId, refetchBoard]
  );

  /* "Consolidated" column: "Create Submission Documents" builds the ticked cards' documents into a zip via
     da/create_submission_documents and keeps the returned submission_id against the cards, which turns the
     column action into "Send For Final Submission" (the email drafted by da/submission_email_draft). */
  const submissionIdByCardId = useBatchMoveStore((state) => state.submissionIdByCardId);
  const setSubmissionId = useBatchMoveStore((state) => state.setSubmissionId);
  const clearSubmissionId = useBatchMoveStore((state) => state.clearSubmissionId);
  const [showSubmissionDocumentsModal, setShowSubmissionDocumentsModal] = useState(false);
  const [selectedSubmissionDocumentsCards, setSelectedSubmissionDocumentsCards] = useState([]);
  const [isCreatingSubmissionDocuments, setIsCreatingSubmissionDocuments] = useState(false);
  const [showFinalSubmissionEmailModal, setShowFinalSubmissionEmailModal] = useState(false);
  const [selectedFinalSubmission, setSelectedFinalSubmission] = useState(null);
  const [isLoadingFinalSubmissionDraft, setIsLoadingFinalSubmissionDraft] = useState(false);
  const [isSendingFinalSubmission, setIsSendingFinalSubmission] = useState(false);

  const handleColumnPrepareSubmission = useCallback((cards) => {
    if (!cards?.length) return;
    setSelectedSubmissionDocumentsCards(cards);
    setShowSubmissionDocumentsModal(true);
  }, []);

  const handleCloseSubmissionDocuments = useCallback(() => {
    if (isCreatingSubmissionDocuments) return;
    setShowSubmissionDocumentsModal(false);
    setSelectedSubmissionDocumentsCards([]);
  }, [isCreatingSubmissionDocuments]);

  const handleCreateSubmissionDocuments = useCallback(
    async (invoiceNo) => {
      const submissionCards = selectedSubmissionDocumentsCards
        .filter((card) => card.callId)
        .map((card) => ({ call_id: Number(card.callId), card_id: Number(card.id) }));
      if (!submissionCards.length) {
        notify("The selected cards have no call to create submission documents for", "error");
        return;
      }

      setIsCreatingSubmissionDocuments(true);
      try {
        let data;
        try {
          ({ data } = await daService.createSubmissionDocuments({ cards: submissionCards, inv_no: invoiceNo }));
        } catch (error) {
          data = error?.response?.data;
        }
        const { submission_id: submissionId, zip_url: zipUrl } = data?.data ?? {};
        if (data?.status !== "success" || submissionId == null) {
          notify(data?.message || "Failed to create submission documents", "error");
          return;
        }
        setSubmissionId(
          submissionCards.map((card) => card.card_id),
          submissionId
        );
        /* A zip is always downloaded, so a plain link to it saves the file without leaving the board. */
        if (zipUrl) {
          downloadFile({ link: zipUrl, fileName: decodeURIComponent(zipUrl.split("/").pop()) || "Submission_Documents.zip" });
        }
        notify("Submission documents created", "success");
        setShowSubmissionDocumentsModal(false);
        setSelectedSubmissionDocumentsCards([]);
      } finally {
        setIsCreatingSubmissionDocuments(false);
      }
    },
    [selectedSubmissionDocumentsCards, setSubmissionId]
  );

  const handleColumnSendFinalSubmission = useCallback(
    async (cards) => {
      if (!cards?.length || isLoadingFinalSubmissionDraft) return;
      const submissionIds = [...new Set(cards.map((card) => submissionIdByCardId[String(card.id)]))];
      if (submissionIds.length > 1) {
        notify("The ticked cards belong to different submissions. Tick one submission's cards at a time.", "error");
        return;
      }
      const [submissionId] = submissionIds;

      setIsLoadingFinalSubmissionDraft(true);
      try {
        let data;
        try {
          ({ data } = await daService.getSubmissionEmailDraft(submissionId));
        } catch (error) {
          data = error?.response?.data;
        }
        if (data?.status !== "success") {
          /* A stale submission (cards regrouped, already submitted, or moved on) has to be created again. */
          clearSubmissionId(submissionId);
          notify(data?.message || "Failed to load the final submission email", "error");
          refetchBoard?.();
          return;
        }
        setSelectedFinalSubmission({ submissionId, cards, draft: data.data ?? {} });
        setShowFinalSubmissionEmailModal(true);
      } finally {
        setIsLoadingFinalSubmissionDraft(false);
      }
    },
    [isLoadingFinalSubmissionDraft, submissionIdByCardId, clearSubmissionId, refetchBoard]
  );

  const handleCloseFinalSubmissionEmail = useCallback(() => {
    if (isSendingFinalSubmission) return;
    setShowFinalSubmissionEmailModal(false);
    setSelectedFinalSubmission(null);
  }, [isSendingFinalSubmission]);

  const handleSendFinalSubmissionEmail = useCallback(
    async ({ to, cc, subject, message, fieldFiles }) => {
      if (!selectedFinalSubmission) return;
      const { submissionId, cards } = selectedFinalSubmission;
      const formData = new FormData();
      formData.append("submission_id", submissionId);
      formData.append("to", to);
      if (cc?.trim()) formData.append("cc", cc);
      formData.append("subject", subject);
      formData.append("body", message);
      (fieldFiles?.signed_letter ?? []).forEach((file) => formData.append("signed_letter", file));
      (fieldFiles?.approved_se_sheet ?? []).forEach((file) => formData.append("approved_se_sheet[]", file));
      (fieldFiles?.approved_se_copies ?? []).forEach((file) => formData.append("approved_se_copies[]", file));
      (fieldFiles?.consolidated_invoice ?? []).forEach((file) => formData.append("consolidated_invoice[]", file));
      (fieldFiles?.merged_invoices ?? []).forEach((file) => formData.append("merged_invoices[]", file));

      setIsSendingFinalSubmission(true);
      try {
        let data;
        try {
          ({ data } = await daService.sendSubmissionEmail(formData));
        } catch (error) {
          data = error?.response?.data;
        }
        if (data?.status !== "success") {
          notify(data?.message || "Failed to send the final submission email", "error");
          return;
        }
        const movedCount = data.data?.moved_to_submitted?.length ?? cards.length;
        notify(
          `Final submission sent. ${movedCount} ${movedCount === 1 ? "card" : "cards"} moved to Submitted Invoices`,
          "success"
        );
        clearSubmissionId(submissionId);
        cards.forEach((card) => removeCardSelectionId(card.id));
        setShowFinalSubmissionEmailModal(false);
        setSelectedFinalSubmission(null);
        refetchBoard?.();
      } finally {
        setIsSendingFinalSubmission(false);
      }
    },
    [selectedFinalSubmission, clearSubmissionId, removeCardSelectionId, refetchBoard]
  );

  const finalSubmissionDraft = selectedFinalSubmission?.draft;
  const isMergedInvoicesAttachment = useCallback(
    (attachment) =>
      attachment?.url === finalSubmissionDraft?.merged_invoices?.url || /^merged_invoices/i.test(attachment?.name ?? ""),
    [finalSubmissionDraft]
  );
  /* The draft's generated covering letter (to sign), consolidated invoice and the batch's approved SE sheet
     open from their own rows. */
  const finalSubmissionFileFields = useMemo(() => {
    const attachments = (finalSubmissionDraft?.attachments ?? []).filter((attachment) => attachment?.url);
    return FINAL_SUBMISSION_FILE_FIELDS.map((field) => {
      if (field.name === "merged_invoices") {
        const document = attachments.find((attachment) => isMergedInvoicesAttachment(attachment));
        return document ? { ...field, document } : field;
      }
      const draftFile = FINAL_SUBMISSION_DRAFT_FILES[field.name];
      const document = draftFile && attachments.find((attachment) => isDraftFile(draftFile, attachment));
      return document ? { ...field, document } : field;
    });
  }, [finalSubmissionDraft, isMergedInvoicesAttachment]);

  /* Draft attachments that have no row of their own are listed as plain attachments. */
  const finalSubmissionDocuments = useMemo(
    () =>
      (finalSubmissionDraft?.attachments ?? []).filter(
        (attachment) =>
          attachment?.url &&
          !isMergedInvoicesAttachment(attachment) &&
          !Object.values(FINAL_SUBMISSION_DRAFT_FILES).some((draftFile) => isDraftFile(draftFile, attachment))
      ),
    [finalSubmissionDraft, isMergedInvoicesAttachment]
  );

  /* Creates the batch on the backend from the ticked Backlog cards. The backend issues the batch
     number (e.g. Sep_26_Batch1) and returns it as batch_number. */
  const handleConfirmBatch = useCallback(async () => {
    const batchCards = selectedBatchCardIds
      .map((id) => cardsById[id])
      .filter((card) => card?.callId);
    if (batchCards.length === 0) {
      notify("Select at least one card with a call to create a batch", "error");
      setShowBatchConfirmModal(false);
      return;
    }

    const cards = batchCards.map((card) => ({ call_id: Number(card.callId), card_id: Number(card.id) }));
    setIsCreatingBatch(true);
    try {
      let data;
      try {
        ({ data } = await daService.createHubBatch({ cards }));
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
      selectedBatchCardIds.forEach((id) => removeCardSelectionId(id));
    } finally {
      setIsCreatingBatch(false);
    }
  }, [
    selectedBatchCardIds,
    cardsById,
    moveCardsToColumn,
    selectedBatchTargetColumn,
    removeCardSelectionId,
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

  const { marqueeRef, handleMarqueeMouseDown } = useKanbanMarqueeSelect({
    selectedCardIds,
    onSelectionChange: setSelectedCardIds,
  });

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
      <div style={{ position: "relative" }} onMouseDown={handleMarqueeMouseDown}>
        <div ref={marqueeRef} className="kanban-marquee-select" aria-hidden="true" />
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
          onBatchRequestPo={handleBatchRequestPo}
          onColumnUploadInvoice={handleColumnUploadInvoice}
          onColumnUploadPos={handleColumnUploadPos}
          onColumnSendInvoice={handleColumnSendInvoice}
          onColumnMergeInvoice={handleColumnMergeInvoice}
          onColumnPrepareSubmission={handleColumnPrepareSubmission}
          onColumnSendFinalSubmission={handleColumnSendFinalSubmission}
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
        statusText={`Create a batch with the ${selectedBatchCardIds.length} selected ${
          selectedBatchCardIds.length === 1 ? "card" : "cards"
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

      <SeCreationEmailModal
        show={showPoRequestEmailModal}
        onClose={handleClosePoRequestEmail}
        onSend={handleSendPoRequestEmail}
        isSubmitting={isSendingPoRequest}
        batchTitle={poRequestEmailDraft?.batch_number || selectedPoRequestBatch?.title || ""}
        defaultTo={poRequestEmailDraft?.to ?? ""}
        defaultCc={poRequestEmailDraft?.cc ?? ""}
        defaultSubject={poRequestEmailDraft?.subject ?? ""}
        defaultBody={poRequestEmailDraft?.body ?? ""}
        documentUrl={poRequestEmailDraft?.document_url ?? ""}
        title="PO Request Email"
        subtitle="Request the purchase order for this batch"
        sendLabel="Send PO Request"
        subjectPrefix="Request for PO"
      />

      <SubmissionDocumentsModal
        show={showSubmissionDocumentsModal}
        onClose={handleCloseSubmissionDocuments}
        onCreate={handleCreateSubmissionDocuments}
        isSubmitting={isCreatingSubmissionDocuments}
        cardCount={selectedSubmissionDocumentsCards.length}
      />

      <SeCreationEmailModal
        show={showFinalSubmissionEmailModal}
        onClose={handleCloseFinalSubmissionEmail}
        onSend={handleSendFinalSubmissionEmail}
        isSubmitting={isSendingFinalSubmission}
        defaultTo={finalSubmissionDraft?.to ?? ""}
        defaultCc={finalSubmissionDraft?.cc ?? ""}
        defaultSubject={finalSubmissionDraft?.subject ?? ""}
        defaultBody={finalSubmissionDraft?.body ?? ""}
        documents={finalSubmissionDocuments}
        fileFields={finalSubmissionFileFields}
        title="Final Submission Email"
        subtitle="Send the submission documents to the client"
        sendLabel="Send for Final Submission"
        subjectPrefix="INV Submission"
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
        isSubmitting={isUploadingInvoices}
        submittingLabel={
          invoiceUploadProgress
            ? `Uploading ${invoiceUploadProgress.done} / ${invoiceUploadProgress.total}...`
            : undefined
        }
        batchTitle={selectedInvoiceBatch?.title ?? ""}
        selectedCardCount={selectedInvoiceBatch?.cards?.length ?? 0}
        title="Upload Invoice"
        subtitle="Attach the invoices for the selected cards"
        submitLabel="Upload Invoice"
        fields={arInvoiceUploadFields}
      />

      <ArInvoiceReviewModal onConfirmed={refetchBoard} />

      <SeApprovalUploadModal
        show={showPoUploadModal}
        onClose={handleClosePoUpload}
        onUpload={handleUploadPos}
        isSubmitting={isUploadingPos}
        submittingLabel={
          poUploadProgress ? `Uploading ${poUploadProgress.done} / ${poUploadProgress.total}...` : undefined
        }
        batchTitle={[
          ...new Set(selectedPoUploadCards.map((card) => batchByCardId[card.id]).filter(Boolean)),
        ].join(", ")}
        selectedCardCount={selectedPoUploadCards.length}
        title="Upload POs"
        subtitle="Attach the POs for the selected cards"
        submitLabel="Upload POs"
        fields={poUploadFields}
      />

      <PoReviewModal onConfirmed={refetchBoard} />

      <SeCreationEmailModal
        show={showInvoiceDispatchEmailModal}
        onClose={handleCloseInvoiceDispatchEmail}
        onSend={handleSendInvoiceDispatchEmail}
        isSubmitting={isSendingInvoiceDispatch}
        defaultTo={invoiceDispatchDraft?.to ?? ""}
        defaultCc={invoiceDispatchDraft?.cc ?? ""}
        defaultSubject={invoiceDispatchDraft?.subject ?? ""}
        defaultBody={invoiceDispatchDraft?.body ?? ""}
        documents={invoiceDispatchDocuments}
        title="Invoice Email"
        subtitle="Send the invoice to the client"
        sendLabel="Send Invoice"
        subjectPrefix="Tax Invoice"
        allowTables
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
