import { useEffect, useMemo, useRef, useState } from "react";
import { DragDropContext } from "@hello-pangea/dnd";
import { FiArrowRight, FiChevronDown, FiDownload, FiEdit3, FiFileText, FiSend, FiUpload, FiUploadCloud } from "react-icons/fi";
import { MdCallMerge } from "react-icons/md";
import { KANBAN_DND_DISABLED } from "../../../../shared/constants/kanbanConfig";
import ColumnHeader from "./ColumnHeader";
import SwimlaneColumnCell from "./SwimlaneColumnCell";
import {
  countCardsInColumn,
  getSwimlaneColumnCards,
  getColumnHeaderGroups,
} from "../../utils/columnHelpers";
import {
  BOARD_COLUMN_GAP_PX,
  WORKFLOW_ROW_MIN_HEIGHT,
  getBoardGridTemplateColumns,
  getColumnWidth,
} from "../../utils/boardGridHelpers";
import useBatchMoveStore from "../../../../shared/store/batchMoveStore";
import useExportApprovalStatusStore from "../../../../shared/store/exportApprovalStatusStore";
import useSignatureCheckStore from "../../../../shared/store/signatureCheckStore";
import useServiceSheetStore from "../../../../shared/store/serviceSheetStore";
import useZamilMarinePoRequestStore from "../../../../shared/store/zamilMarinePoRequestStore";
import useAlertReducer from "../../../../store/AlertReducer";
import { isMcDermottWorkflow, isZamilWorkflow, isSubseaWorkflow, isColumnBeforeArchive, isLntWorkflow, isLntSubmittedToDa, isUploadedToPortalColumnTitle } from "../../utils/columnTitles";
import { needsExportApprovalCheck } from "../../utils/cardHelpers";
import { sanitizeSwimlaneColorCode, pickForegroundOnSwimlaneBackground } from "../../../EditWorkflows/workflow.utils";
import "../../../../design/scss/pages/kanban-board/swimlaneBoard.scss";

const EMPTY_COLLAPSED_SET = new Set();

/* Batch action lives on the Backlog column of the SAIPEM workflow only (SNAMPROGETTI is the
   name it is being renamed from, so both are accepted while that rename lands). */
const BATCH_ACTION_WORKFLOWS = ["SAIPEM", "SNAMPROGETTI"];
const BATCH_ACTION_COLUMN = "backlog";

const isBatchWorkflow = (workflow) => {
  const workflowTitle = String(workflow?.title ?? "").trim().toUpperCase();
  return BATCH_ACTION_WORKFLOWS.some((name) => workflowTitle.includes(name));
};

/* McDermott, BGP and Zamil Crew DA create batches from Backlog the same way; the backend moves them to
   its next column. The SAIPEM invoice/SE steps after Backlog stay SAIPEM-only (isBatchWorkflow). */
const BATCH_CREATE_WORKFLOWS = [...BATCH_ACTION_WORKFLOWS, "MCDERMOTT", "BGP", "ZAMIL"];

const isBatchCreateWorkflow = (workflow) => {
  const workflowTitle = String(workflow?.title ?? "").trim().toUpperCase();
  return BATCH_CREATE_WORKFLOWS.some((name) => workflowTitle.includes(name));
};

const isBacklogColumn = (column) =>
  String(column?.title ?? "").trim().toLowerCase() === BATCH_ACTION_COLUMN;

/* Zamil Marine has no batch step, so its Backlog column header carries no batch icon. */
const NO_BATCH_ACTION_WORKFLOW_PATTERN = /zamil.*marine/i;

const hasBatchAction = (workflow, ...columns) =>
  isBatchCreateWorkflow(workflow) &&
  !NO_BATCH_ACTION_WORKFLOW_PATTERN.test(workflow?.title ?? "") &&
  columns.some(isBacklogColumn);

/* Invoice actions on SAIPEM column headers, shown only while a card in that column is ticked:
   "Upload Invoice" on "SE Received", "Merge Invoice" on "AR Invoices Issued", and on "Consolidated"
   "Create Submission Documents", which then opens the Final Submission Email. */
const SE_RECEIVED_COLUMN_PATTERN = /^se\s+received$/i;
const AR_INVOICES_ISSUED_COLUMN_PATTERN = /^ar\s+invoices?\s+issued$/i;
const CONSOLIDATED_COLUMN_PATTERN = /^consolidated\b/i;

/* McDermott DA: "Upload Invoice" on "Issue AR Invoice" for the cards the user ticks (no auto-tick),
   "Upload POs" on "Requested PO" for the cards the user ticks, "Upload SRF" on "Submitted to DA" for the
   cards the user ticks, and "Send Invoice" on "PO Received", shown only while exactly one card there is
   ticked (the invoice email goes per card). */
const ISSUE_AR_INVOICE_COLUMN_PATTERN = /^issue\s+ar\s+invoices?$/i;
const REQUESTED_PO_COLUMN_PATTERN = /^requested\s+po$/i;
const POSH_REQUESTED_PO_COLUMN_PATTERN = /^requested\b.*\bpo$/i;
const PO_RECEIVED_COLUMN_PATTERN =/^po\s+received$/i;
const SUBMITTED_TO_DA_COLUMN_PATTERN = /^submitted to da$/i;

/* L&T DA: "Convert to AR Invoice" takes the same bulk invoice upload as McDermott's "Issue AR Invoice",
   for the cards the user ticks. */
const CONVERT_TO_AR_INVOICE_COLUMN_PATTERN = /^convert\s+to\s+ar\s+invoices?$/i;
const READY_FOR_POSTING_IN_SAP_COLUMN_PATTERN = /^ready\s+(to|for)\s+post(ing)?\s+in\s+sap$/i;

/* L&T DA: "Ready for Dispatch" downloads the ticked cards' invoice PDF and XML files as a zip. */
const READY_FOR_DISPATCH_COLUMN_PATTERN = /^ready\s+for\s+dispatch$/i;

/* L&T DA: "To be Uploaded to the Portal" shows "Move the Cards", which moves the ticked cards to the next
   column (Uploaded to Portal). */
const TO_BE_UPLOADED_TO_PORTAL_COLUMN_PATTERN = /^to\s+be\s+uploaded\s+to\s+(the\s+)?portal$/i;

/* DA: "Uploaded to Portal" shows "Upload Dispatch Proof" only while exactly one card there is ticked, and the
   board page keeps that column to a single ticked card (see isUploadedToPortalColumnTitle). L&T is the
   exception: it keeps multi-select and uploads for all ticked cards. */

/* L&T DA: "SCC Received" shows "Upload SCC Documents" for the cards the user ticks (signed SOs, SCCs and the
   approval email in one bulk upload), which then opens the SCC review. */
const SCC_RECEIVED_COLUMN_PATTERN = /^scc\s+received$/i;

/* L&T DA: "SO sent for SCC" shows "Send for SCC Approval" for the cards the user ticks; it opens the SCC
   approval email draft, and sending moves the cards to "SCC received". */
const SO_SENT_FOR_SCC_COLUMN_PATTERN = /^so\s+sent\s+for\s+scc$/i;

/* Zamil Marine DA has no batches: "Send for PO Request" on "Request for PO" sends one request for
   every card the user ticks. */
const ZAMIL_MARINE_WORKFLOW_PATTERN = /zamil.*marine/i;
const REQUEST_FOR_PO_COLUMN_PATTERN = /^request[^a-z]*for[^a-z]*po$/i;

const getInvoiceAction = (workflow, column) => {
  const title = String(column?.title ?? "").trim();
  if (ZAMIL_MARINE_WORKFLOW_PATTERN.test(workflow?.title ?? "") && REQUEST_FOR_PO_COLUMN_PATTERN.test(title)) {
    return "requestZamilMarinePo";
  }
  if (isMcDermottWorkflow(workflow)) {
    if (ISSUE_AR_INVOICE_COLUMN_PATTERN.test(title)) return "issueArInvoice";
    if (REQUESTED_PO_COLUMN_PATTERN.test(title)) return "uploadPos";
    if (PO_RECEIVED_COLUMN_PATTERN.test(title)) return "sendInvoice";
    if (SUBMITTED_TO_DA_COLUMN_PATTERN.test(title)) return "uploadSrf";
    return null;
  }
  if (ISSUE_AR_INVOICE_COLUMN_PATTERN.test(title)) return "issueArInvoice";
  if (isLntSubmittedToDa(workflow?.title, title)) return "checkSignatures";
  if (SCC_RECEIVED_COLUMN_PATTERN.test(title)) return "uploadSccDocuments";
  /* Zamil Crew uploads from each batch header (BatchGroup), so its column header has no upload button. */
  if (CONVERT_TO_AR_INVOICE_COLUMN_PATTERN.test(title)) return isZamilWorkflow(workflow) ? null : "issueArInvoice";
  if (READY_FOR_DISPATCH_COLUMN_PATTERN.test(title)) return "downloadInvoices";
  if (TO_BE_UPLOADED_TO_PORTAL_COLUMN_PATTERN.test(title)) return "moveCards";
  if (isUploadedToPortalColumnTitle(title)) return "uploadDispatchProof";
  if (SO_SENT_FOR_SCC_COLUMN_PATTERN.test(title)) return "sendSccApproval";
  /* POSH DA has no batches: "Request PO" on "AR Invoices Issued" sends the PO request for the one ticked
     card (the backend takes one card at a time). */
  if (POSH_WORKFLOW_PATTERN.test(workflow?.title ?? "")) {
    if (AR_INVOICES_ISSUED_COLUMN_PATTERN.test(title)) return "requestPo";
    /* POSH names the PO column "Requested/ Awaiting for PO"; it uploads one PO for one ticked card. */
    if (POSH_REQUESTED_PO_COLUMN_PATTERN.test(title)) return "uploadPos";
    if (PO_RECEIVED_COLUMN_PATTERN.test(title)) return "sendInvoice";
  }
  /* Subsea 7 DA uploads the SAP invoices for the cards the user ticks on "Ready to post in SAP". */
  if (isSubseaWorkflow(workflow) && READY_FOR_POSTING_IN_SAP_COLUMN_PATTERN.test(title)) return "issueArInvoice";
  /* Subsea 7 DA sends the final invoice for the one ticked card from "AR Invoices Issued". */
  if (isSubseaWorkflow(workflow) && AR_INVOICES_ISSUED_COLUMN_PATTERN.test(title)) return "sendInvoice";
  /* Zamil Crew DA sends the final invoice for the one ticked card from "AR Invoice Issued". */
  if (isZamilWorkflow(workflow) && AR_INVOICES_ISSUED_COLUMN_PATTERN.test(title)) return "sendInvoice";
  if (!isBatchWorkflow(workflow)) {
    return AR_INVOICES_ISSUED_COLUMN_PATTERN.test(title) ? "enterServiceSheetNo" : null;
  }
  if (SE_RECEIVED_COLUMN_PATTERN.test(title)) return "upload";
  if (AR_INVOICES_ISSUED_COLUMN_PATTERN.test(title)) return "merge";
  if (CONSOLIDATED_COLUMN_PATTERN.test(title)) return "submission";
  return null;
};

const POSH_WORKFLOW_PATTERN = /posh/i;
/* POSH, BGP and Subsea 7 workflows name the "Issue AR Invoice" column action "Upload SAP Invoices". */
const SAP_INVOICES_LABEL_WORKFLOW_PATTERN = /posh|bgp|subsea/i;
const ISSUE_AR_INVOICE_SAP_LABEL = "Upload SAP Invoices";

const INVOICE_ACTION_BUTTONS = {
  upload: { label: "Upload Invoice", icon: <FiUploadCloud size={16} aria-hidden /> },
  issueArInvoice: { label: "Upload Invoices", icon: <FiUploadCloud size={16} aria-hidden /> },
  uploadPos: { label: "Upload POs", icon: <FiUploadCloud size={16} aria-hidden /> },
  uploadSccDocuments: { label: "Upload SCC Documents", icon: <FiUploadCloud size={16} aria-hidden /> },
  uploadSrf: { label: "Upload SRF", icon: <FiUploadCloud size={16} aria-hidden /> },
  sendInvoice: { label: "Send Invoice", icon: <FiSend size={16} aria-hidden /> },
  sendSccApproval: { label: "Send for SCC Approval", icon: <FiSend size={16} aria-hidden /> },
  downloadInvoices: { label: "Download Invoices", icon: <FiDownload size={16} aria-hidden /> },
  uploadDispatchProof: { label: "Upload Dispatch Proof", icon: <FiUpload size={16} aria-hidden /> },
  moveCards: { label: "Move the Cards", icon: <FiArrowRight size={16} aria-hidden /> },
  requestPo: { label: "Request PO", icon: <FiSend size={16} aria-hidden /> },
  requestZamilMarinePo: { label: "Send for PO Request", icon: <FiSend size={16} aria-hidden /> },
  enterServiceSheetNo: { label: "Enter Service Sheet No", icon: <FiFileText size={16} aria-hidden /> },
  checkSignatures: { label: "Check Signatures", icon: <FiEdit3 size={16} aria-hidden /> },
  merge: { label: "Merge Invoice", icon: <MdCallMerge size={16} aria-hidden /> },
  prepareSubmission: { label: "Create Submission Documents", icon: <FiDownload size={16} aria-hidden /> },
  sendSubmission: { label: "Send For Final Submission", icon: <FiSend size={16} aria-hidden /> },
};

export default function WorkflowColumns({
  workflow,
  collapsedColumns,
  maxColumnHeights,
  onDragEnd,
  onSelectCard,
  cardsById,
  onColumnHeaderClick,
  onColumnBatchAction,
  onBatchSendSeRequest,
  onBatchUploadSeApproval,
  onBatchUploadInvoice,
  onBatchRequestPo,
  onColumnRequestPo,
  onColumnUploadInvoice,
  onColumnUploadPos,
  onUploadSrf,
  onUploadSccDocuments,
  onColumnSendInvoice,
  onColumnSendSccApproval,
  onColumnSubmitByEmail,
  onColumnMergeInvoice,
  onColumnDownloadInvoices,
  onColumnMoveCards,
  onUploadDispatchProof,
  onColumnPrepareSubmission,
  onColumnSendSubmission,
  onContextMenu,
  onHeightChange,
  isDarkMode,
  layoutView,
  selectedActionCardIds,
  onToggleCardSelect,
  onCardSelectDragStart,
  onCardSelectDragEnter,
}) {
  const collapsedColumnIds = collapsedColumns[workflow.id] ?? EMPTY_COLLAPSED_SET;
  const maxHeight = Math.max(maxColumnHeights[workflow.id] || 0, WORKFLOW_ROW_MIN_HEIGHT);

  const swimlaneOrder = useMemo(
    () => (workflow.swimlaneOrder?.length ? workflow.swimlaneOrder : ["lane-default"]),
    [workflow.swimlaneOrder]
  );

  const shouldShowSwimlaneTitle = swimlaneOrder.length > 1;

  const [collapsedLaneIds, setCollapsedLaneIds] = useState(() => new Set());
  const toggleLane = (laneId) =>
    setCollapsedLaneIds((prev) => {
      const next = new Set(prev);
      if (next.has(laneId)) next.delete(laneId);
      else next.add(laneId);
      return next;
    });

  /* Lane titles mirror the board name bar's on-screen box, so they stay centered under the board
     name however the board is scrolled (whichever ancestor does the scrolling). */
  const scrollContainerRef = useRef(null);
  const boardRef = useRef(null);
  useEffect(() => {
    const container = scrollContainerRef.current;
    const board = boardRef.current;
    const header = container?.closest(".kanban-accordion")?.querySelector(".kanban-accordion-header");
    if (!container || !board || !header || !shouldShowSwimlaneTitle) return undefined;

    let frame = 0;
    const align = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const headerRect = header.getBoundingClientRect();
        const boardRect = board.getBoundingClientRect();
        board.style.setProperty("--lane-title-w", `${headerRect.width}px`);
        board.style.setProperty("--lane-title-x", `${headerRect.left - boardRect.left}px`);
      });
    };

    align();
    const observer = new ResizeObserver(align);
    observer.observe(header);
    observer.observe(container);
    window.addEventListener("scroll", align, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", align, true);
    };
  }, [shouldShowSwimlaneTitle, layoutView]);

  /* Cards of the batch board's first lane, with any card a batch has moved drawn in its new
     column instead. */
  const columnByCardId = useBatchMoveStore((state) => state.columnByCardId);
  const batchByCardId = useBatchMoveStore((state) => state.batchByCardId);
  const batchIdByNumber = useBatchMoveStore((state) => state.batchIdByNumber);
  const submissionIdByCardId = useBatchMoveStore((state) => state.submissionIdByCardId);

  const loadExportApprovalStatuses = useExportApprovalStatusStore((state) => state.loadStatuses);

  /* get_full_board leaves is_export_approval_card out for some Backlog cards, and sends true for
     non-Export calls too, so those cards' export approval state is read from the call detail
     (re-read on every board load). */
  useEffect(() => {
    if (!isBatchCreateWorkflow(workflow)) return;
    const callIds = workflow.columnOrder
      .filter((colKey) => isBacklogColumn(workflow.columns[colKey]))
      .flatMap((colKey) => swimlaneOrder.flatMap((laneId) => getSwimlaneColumnCards(workflow, laneId, colKey)))
      .filter((card) => card?.callId && needsExportApprovalCheck(card))
      .map((card) => card.callId);
    if (callIds.length) loadExportApprovalStatuses([...new Set(callIds)]);
  }, [workflow, swimlaneOrder, loadExportApprovalStatuses]);

  const openSignatureCheckModal = useSignatureCheckStore((state) => state.openSignatureCheckModal);
  const openServiceSheetModal = useServiceSheetStore((state) => state.openServiceSheetModal);
  const openZamilMarinePoRequestModal = useZamilMarinePoRequestStore((state) => state.openPoRequestEmailModal);

  const handleZamilMarinePoRequest = async (cards) => {
    const { ok, message } = await openZamilMarinePoRequestModal(cards);
    if (!ok) useAlertReducer.getState().error(message);
  };

  const batchLaneCardsByColumn = useMemo(() => {
    if (!isBatchCreateWorkflow(workflow)) return null;
    const laneId = swimlaneOrder[0];
    const byColumn = {};
    const relocated = [];

    workflow.columnOrder.forEach((colKey) => {
      byColumn[colKey] = [];
      getSwimlaneColumnCards(workflow, laneId, colKey).forEach((card) => {
        const target = columnByCardId[card.id];
        if (target && target !== colKey) relocated.push({ card, target });
        else byColumn[colKey].push(card);
      });
    });

    relocated.forEach(({ card, target }) => byColumn[target]?.push(card));
    return byColumn;
  }, [workflow, swimlaneOrder, columnByCardId]);

  /* Cards of a column across every lane, as drawn on the board (batch moves applied). */
  const getColumnCards = (colKey) =>
    swimlaneOrder.flatMap((laneId) =>
      batchLaneCardsByColumn && laneId === swimlaneOrder[0]
        ? batchLaneCardsByColumn[colKey] ?? []
        : getSwimlaneColumnCards(workflow, laneId, colKey)
    );

  /* A column whose cards carry a batch renders them as groups (loose cards first, headerless). */
  const getBatchesForColumn = (colKey, laneId) => {
    const cards =
      batchLaneCardsByColumn && laneId === swimlaneOrder[0]
        ? batchLaneCardsByColumn[colKey]
        : getSwimlaneColumnCards(workflow, laneId, colKey);
    if (!cards?.length) return undefined;

    const loose = [];
    const byNumber = new Map();
    cards.forEach((card) => {
      const batchNumber = batchByCardId[card.id];
      if (!batchNumber) {
        loose.push(card);
        return;
      }
      if (!byNumber.has(batchNumber)) byNumber.set(batchNumber, []);
      byNumber.get(batchNumber).push(card);
    });
    if (byNumber.size === 0) return undefined;

    const batches = [];
    if (loose.length > 0) {
      batches.push({
        id: `${laneId}-${colKey}-loose`,
        title: "",
        isUngrouped: true,
        cards: loose,
      });
    }
    /* Newest batch (highest backend batch id) first; batches without an id keep their order. */
    const batchEntries = [...byNumber.entries()].sort(
      ([numberA], [numberB]) => (Number(batchIdByNumber[numberB]) || 0) - (Number(batchIdByNumber[numberA]) || 0)
    );
    batchEntries.forEach(([batchNumber, batchCards]) => {
      batches.push({
        id: `${laneId}-${colKey}-${batchNumber}`,
        title: batchNumber,
        cards: batchCards,
      });
    });
    return batches;
  };

  const getColumnCount = (colKey) => {
    if (batchLaneCardsByColumn) return batchLaneCardsByColumn[colKey]?.length ?? 0;
    return countCardsInColumn(workflow, colKey);
  };

  /* Outer board grid: one track per column, collapsed columns get a fixed narrow track
     (see getColumnWidth / getBoardGridTemplateColumns) */
  const boardGridTemplateColumns = useMemo(
    () =>
      getBoardGridTemplateColumns(
        workflow.columns,
        workflow.columnOrder,
        collapsedColumnIds,
        layoutView
      ),
    [workflow.columns, workflow.columnOrder, collapsedColumnIds, layoutView]
  );

  const headerGroups = useMemo(
    () => getColumnHeaderGroups(workflow),
    [workflow.columns, workflow.columnOrder]
  );

  const boardRowGridStyle = useMemo(
    () => ({
      display: "grid",
      gridTemplateColumns: boardGridTemplateColumns,
      gap: `${BOARD_COLUMN_GAP_PX}px`,
      width: "max-content",
      minWidth: "100%",
      alignItems: "stretch",
    }),
    [boardGridTemplateColumns]
  );

  return (
    <div
      ref={scrollContainerRef}
      className={`kanban-container kanban-container--board-hscroll ${layoutView === "normal" ? "kanban-normal-layout" : ""}`}
      key={layoutView}
    >
      <DragDropContext onDragEnd={KANBAN_DND_DISABLED ? () => {} : onDragEnd}>
        <div
          ref={boardRef}
          className={`kanban-board kanban-board--swimlanes ${!shouldShowSwimlaneTitle ? "kanban-board--single-swimlane" : ""}`}
        >
          {/* --- Column headers (workflow stages): same grid tracks as swimlane rows below --- */}
          <div className="kanban-board__header-row" style={boardRowGridStyle}>
            {headerGroups.map((group) => {
              const firstColumn = workflow.columns[group.colKeys[0]];
              const isGrouped = group.colKeys.length > 1;
              const displayColumn = isGrouped
                ? {
                    id: `group-${firstColumn.parentColumnId}`,
                    title: firstColumn.parentTitle || firstColumn.title,
                    color: firstColumn.color,
                    wipLimit: null,
                  }
                : firstColumn;

              const isCollapsed = !isGrouped && collapsedColumnIds.has(firstColumn.id);
              const cardCount = group.colKeys.reduce(
                (sum, k) => sum + getColumnCount(k),
                0
              );
              const wipDisplay = String(cardCount);
              const invoiceAction = isGrouped ? null : getInvoiceAction(workflow, firstColumn);
              const invoiceCards = invoiceAction
                ? getColumnCards(group.colKeys[0]).filter((card) => selectedActionCardIds?.includes(card.id))
                : [];
              /* "Consolidated": ticked cards whose submission documents are not created yet get "Create
                 Submission Documents"; creating them opens the Final Submission Email. Ticked cards that
                 already have a submission get "Send For Final Submission", which reopens that email: it is
                 the main button when every ticked card has one, and the second button in a mixed selection. */
              const isSubmissionColumn = invoiceAction === "submission";
              const submissionCreateCards = isSubmissionColumn
                ? invoiceCards.filter((card) => submissionIdByCardId[String(card.id)] == null)
                : [];
              const submissionSendCards = isSubmissionColumn
                ? invoiceCards.filter((card) => submissionIdByCardId[String(card.id)] != null)
                : [];
              const isCreatingSubmission = submissionCreateCards.length > 0;
              let invoiceButton = invoiceAction;
              let invoiceButtonCards = invoiceCards;
              if (isSubmissionColumn) {
                invoiceButton = isCreatingSubmission ? "prepareSubmission" : "sendSubmission";
                invoiceButtonCards = isCreatingSubmission ? submissionCreateCards : submissionSendCards;
              }
              let sendSubmissionAction;
              if (isCreatingSubmission && submissionSendCards.length > 0) {
                sendSubmissionAction = {
                  ...INVOICE_ACTION_BUTTONS.sendSubmission,
                  onClick: () => onColumnSendSubmission?.(submissionSendCards),
                };
              }
              const hasInvoiceButton =
                invoiceAction === "sendInvoice" ||
                invoiceAction === "requestPo" ||
                (invoiceAction === "uploadDispatchProof" && !isLntWorkflow(workflow))
                  ? invoiceCards.length === 1 : invoiceButtonCards.length > 0;
              const invoiceActionHandlers = {
                upload: onColumnUploadInvoice,
                issueArInvoice: (cards) =>
                  onColumnUploadInvoice?.(cards, {
                    workflowId: workflow.workflow_id ?? workflow.id,
                    isZamilCrew: isZamilWorkflow(workflow),
                  }),
                uploadPos: (cards) =>
                  onColumnUploadPos?.(cards, { workflowId: workflow.workflow_id ?? workflow.id }),
                uploadSrf: (cards) =>
                  onUploadSrf?.(cards, { workflowId: workflow.workflow_id ?? workflow.id }),
                uploadSccDocuments: (cards) =>
                  onUploadSccDocuments?.(cards, { workflowId: workflow.workflow_id ?? workflow.id }),
                sendInvoice: ([card]) => onColumnSendInvoice?.(card, {
                    isFinalInvoice: isSubseaWorkflow(workflow),
                    isZamilCrew: isZamilWorkflow(workflow),
                  }),
                sendSccApproval: onColumnSendSccApproval,
                requestPo: onColumnRequestPo,
                requestZamilMarinePo: handleZamilMarinePoRequest,
                merge: onColumnMergeInvoice,
                downloadInvoices: onColumnDownloadInvoices,
                uploadDispatchProof: onUploadDispatchProof,
                moveCards: onColumnMoveCards,
                checkSignatures: (cards) =>
                  openSignatureCheckModal(
                    cards
                      .filter((card) => card.callId)
                      .map((card) => ({ call_id: Number(card.callId), card_id: Number(card.id) }))
                  ),
                enterServiceSheetNo: (cards) =>
                  openServiceSheetModal(
                    cards
                      .filter((card) => card.callId)
                      .map((card) => ({
                        call_id: Number(card.callId),
                        card_id: Number(card.id),
                        sales_orders: card.raw?.sales_orders?.length
                          ? card.raw.sales_orders
                          : card.salesOrderNo
                            ? [{ sales_order_no: card.salesOrderNo, invoice_no: null }]
                            : [],
                      }))
                  ),
                prepareSubmission: onColumnPrepareSubmission,
                sendSubmission: onColumnSendSubmission,
              };

              return (
                <div
                  key={group.key}
                  className={`kanban-board__header-slot ${isCollapsed ? "kanban-board__header-slot--collapsed" : ""}`}
                  style={isGrouped ? { gridColumn: `span ${group.colKeys.length}` } : undefined}
                >
                  <ColumnHeader
                    column={displayColumn}
                    wipDisplay={wipDisplay}
                    isCollapsed={isCollapsed}
                    onHeaderClick={
                      isGrouped ? undefined : () => onColumnHeaderClick(workflow.id, firstColumn.id)
                    }
                    isDarkMode={isDarkMode}
                    actionLabel={
                      hasInvoiceButton
                        ? invoiceButton === "issueArInvoice" && SAP_INVOICES_LABEL_WORKFLOW_PATTERN.test(workflow?.title ?? "")
                          ? ISSUE_AR_INVOICE_SAP_LABEL
                          : INVOICE_ACTION_BUTTONS[invoiceButton].label
                        : "Batch"
                    }
                    actionIcon={hasInvoiceButton ? INVOICE_ACTION_BUTTONS[invoiceButton].icon : undefined}
                    secondaryAction={hasInvoiceButton ? sendSubmissionAction : undefined}
                    onActionClick={
                      hasInvoiceButton
                        ? () => invoiceActionHandlers[invoiceButton]?.(invoiceButtonCards)
                        : hasBatchAction(workflow, displayColumn, firstColumn)
                        ? () =>
                            onColumnBatchAction({
                              /* Only Backlog's ticks: other columns keep cards ticked too. */
                              cardIds: group.colKeys
                                .flatMap(getColumnCards)
                                .filter((card) => selectedActionCardIds?.includes(card.id))
                                .map((card) => card.id),
                              nextColumnKey:
                                workflow.columnOrder[
                                  workflow.columnOrder.indexOf(group.colKeys[0]) + 1
                                ] ?? null,
                            })
                        : undefined
                    }
                  />
                  {isGrouped && (
                    <div
                      className="kanban-board__header-subrow"
                      style={{
                        display: "grid",
                        gridTemplateColumns: group.colKeys
                          .map((k) => {
                            const child = workflow.columns[k];
                            const w = getColumnWidth(child, collapsedColumnIds, layoutView);
                            return collapsedColumnIds.has(child.id) ? `${w}px` : `minmax(${w}px, 1fr)`;
                          })
                          .join(" "),
                        gap: `${BOARD_COLUMN_GAP_PX}px`,
                      }}
                    >
                      {group.colKeys.map((colKey) => {
                        const child = workflow.columns[colKey];
                        const childIsCollapsed = collapsedColumnIds.has(child.id);
                        return (
                          <ColumnHeader
                            key={child.id}
                            column={child}
                            wipDisplay={String(getColumnCount(colKey))}
                            isCollapsed={childIsCollapsed}
                            onHeaderClick={() => onColumnHeaderClick(workflow.id, child.id)}
                            isDarkMode={isDarkMode}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* --- Swimlane rows: each lane is a full-width band; one droppable cell per column --- */}
          {swimlaneOrder.map((laneId) => {
            const lane = workflow.swimlanes?.[laneId];
            if (!lane) return null;

            /* Only real (non-default) swimlane colors get the colored title band — see workflow-swimlane-label-cell / board-minimap-lane-label for the same convention */
            const laneColorHex = sanitizeSwimlaneColorCode(lane.color);
            const hasLaneColor = Boolean(laneColorHex) && laneColorHex !== "#ffffff";
            const isLaneCollapsed = shouldShowSwimlaneTitle && collapsedLaneIds.has(laneId);

            return (
              <section
                className={`kanban-swimlane ${!shouldShowSwimlaneTitle ? "kanban-swimlane--single" : ""} ${
                  isLaneCollapsed ? "kanban-swimlane--collapsed" : ""
                }`}
                key={laneId}
                aria-label={lane.title}
                style={
                  !shouldShowSwimlaneTitle && hasLaneColor
                    ? { borderLeft: `3px solid ${laneColorHex}` }
                    : undefined
                }
              >
                {shouldShowSwimlaneTitle && (
                  /* Zero-width track: the title never widens the board (avoids a resize feedback loop) */
                  <div className="kanban-swimlane__title-track">
                  <button
                    type="button"
                    className={`kanban-swimlane__title ${hasLaneColor ? "kanban-swimlane__title--colored" : ""}`}
                    onClick={() => toggleLane(laneId)}
                    aria-expanded={!isLaneCollapsed}
                    style={
                      hasLaneColor
                        ? {
                            "--lane-color": laneColorHex,
                            "--lane-fg": pickForegroundOnSwimlaneBackground(laneColorHex),
                          }
                        : undefined
                    }
                  >
                    <span className="kanban-swimlane__title-text">{lane.title}</span>
                    <FiChevronDown className="kanban-swimlane__title-icon" aria-hidden="true" />
                  </button>
                  </div>
                )}
                {/* Same gridTemplateColumns as header row — keeps headers and cells aligned */}
                <div className="kanban-swimlane__columns" style={boardRowGridStyle}>
                  {workflow.columnOrder.map((colKey) => {
                    const column = workflow.columns[colKey];
                    const cards =
                      batchLaneCardsByColumn && laneId === swimlaneOrder[0]
                        ? batchLaneCardsByColumn[colKey]
                        : getSwimlaneColumnCards(workflow, laneId, colKey);
                    const isCollapsed = collapsedColumnIds.has(column.id);

                    return (
                      <SwimlaneColumnCell
                        key={`${laneId}-${column.id}`}
                        laneId={laneId}
                        column={column}
                        cards={cards}
                        setSelectedCard={onSelectCard}
                        cardsById={cardsById}
                        isCollapsed={isCollapsed}
                        onContextMenu={onContextMenu}
                        columnHeight={maxHeight}
                        onHeightChange={onHeightChange}
                        isDarkMode={isDarkMode}
                        layoutView={layoutView}
                        workflowTitle={workflow.title}
                        selectedActionCardIds={selectedActionCardIds}
                        onBatchSendSeRequest={onBatchSendSeRequest}
                        onBatchUploadSeApproval={onBatchUploadSeApproval}
                        onBatchUploadInvoice={onBatchUploadInvoice}
                        onBatchIssueArInvoice={(cards) =>
                          onColumnUploadInvoice?.(cards, {
                            workflowId: workflow.workflow_id ?? workflow.id,
                            isZamilCrew: isZamilWorkflow(workflow),
                          })
                        }
                        onBatchRequestPo={onBatchRequestPo}
                        onBatchUploadPos={(cards) =>
                          onColumnUploadPos?.(cards, { workflowId: workflow.workflow_id ?? workflow.id })
                        }
                        onBatchSubmitByEmail={onColumnSubmitByEmail}
                        hideCardSelect={isColumnBeforeArchive(workflow, colKey)}
                        onToggleCardSelect={onToggleCardSelect}
                        onCardSelectDragStart={onCardSelectDragStart}
                        onCardSelectDragEnter={onCardSelectDragEnter}
                        batches={getBatchesForColumn(colKey, laneId)}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
