import { useEffect, useMemo, useRef, useState } from "react";
import { DragDropContext } from "@hello-pangea/dnd";
import { FiChevronDown, FiDownload, FiSend, FiUploadCloud } from "react-icons/fi";
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
import useKanbanCardSelectionStore from "../../../../shared/store/kanbanCardSelectionStore";
import useExportApprovalStatusStore from "../../../../shared/store/exportApprovalStatusStore";
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

/* McDermott DA creates batches from Backlog the same way; the backend moves them to its PO request
   column. The SAIPEM invoice/SE steps after Backlog stay SAIPEM-only (isBatchWorkflow). */
const BATCH_CREATE_WORKFLOWS = [...BATCH_ACTION_WORKFLOWS, "MCDERMOTT"];

const isBatchCreateWorkflow = (workflow) => {
  const workflowTitle = String(workflow?.title ?? "").trim().toUpperCase();
  return BATCH_CREATE_WORKFLOWS.some((name) => workflowTitle.includes(name));
};

const isBacklogColumn = (column) =>
  String(column?.title ?? "").trim().toLowerCase() === BATCH_ACTION_COLUMN;

const hasBatchAction = (workflow, ...columns) =>
  isBatchCreateWorkflow(workflow) && columns.some(isBacklogColumn);

/* Invoice actions on SAIPEM column headers, shown only while a card in that column is ticked:
   "Upload Invoice" on "SE Received", "Merge Invoice" on "AR Invoices Issued", and on "Consolidated"
   "Create Submission Documents", which then opens the Final Submission Email. */
const SE_RECEIVED_COLUMN_PATTERN = /^se\s+received$/i;
const AR_INVOICES_ISSUED_COLUMN_PATTERN = /^ar\s+invoices?\s+issued$/i;
const CONSOLIDATED_COLUMN_PATTERN = /^consolidated\b/i;

/* McDermott DA: "Upload Invoice" on "Issue AR Invoice" for the cards the user ticks (no auto-tick),
   "Upload POs" on "Requested PO", whose cards start ticked, and "Send Invoice" on "PO Received",
   shown only while exactly one card there is ticked (the invoice email goes per card). */
const MCDERMOTT_WORKFLOW = "MCDERMOTT";
const ISSUE_AR_INVOICE_COLUMN_PATTERN = /^issue\s+ar\s+invoices?$/i;
const REQUESTED_PO_COLUMN_PATTERN = /^requested\s+po$/i;
const PO_RECEIVED_COLUMN_PATTERN = /^po\s+received$/i;

const isMcDermottWorkflow = (workflow) =>
  String(workflow?.title ?? "").trim().toUpperCase().includes(MCDERMOTT_WORKFLOW);

const getInvoiceAction = (workflow, column) => {
  const title = String(column?.title ?? "").trim();
  if (isMcDermottWorkflow(workflow)) {
    if (ISSUE_AR_INVOICE_COLUMN_PATTERN.test(title)) return "issueArInvoice";
    if (REQUESTED_PO_COLUMN_PATTERN.test(title)) return "uploadPos";
    if (PO_RECEIVED_COLUMN_PATTERN.test(title)) return "sendInvoice";
    return null;
  }
  if (!isBatchWorkflow(workflow)) return null;
  if (SE_RECEIVED_COLUMN_PATTERN.test(title)) return "upload";
  if (AR_INVOICES_ISSUED_COLUMN_PATTERN.test(title)) return "merge";
  if (CONSOLIDATED_COLUMN_PATTERN.test(title)) return "submission";
  return null;
};

const INVOICE_ACTION_BUTTONS = {
  upload: { label: "Upload Invoice", icon: <FiUploadCloud size={16} aria-hidden /> },
  issueArInvoice: { label: "Upload Invoices", icon: <FiUploadCloud size={16} aria-hidden /> },
  uploadPos: { label: "Upload POs", icon: <FiUploadCloud size={16} aria-hidden /> },
  sendInvoice: { label: "Send Invoice", icon: <FiSend size={16} aria-hidden /> },
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
  onColumnUploadInvoice,
  onColumnUploadPos,
  onColumnSendInvoice,
  onColumnMergeInvoice,
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

  /* McDermott "Requested PO" cards start ticked, ready for "Upload POs" (SAIPEM's invoice columns are only
     ticked by hand). Each card is ticked only the first time it shows up in that column, so a card the user
     unticks stays unticked across board refetches, and is ticked again once it moves on to the next one. */
  const setCardSelected = useKanbanCardSelectionStore((state) => state.setCardSelected);
  const autoTickedCardIdsRef = useRef(new Set());

  useEffect(() => {
    const isAutoTickColumn = (column) => getInvoiceAction(workflow, column) === "uploadPos";
    if (!isMcDermottWorkflow(workflow)) return;
    workflow.columnOrder
      .filter((colKey) => isAutoTickColumn(workflow.columns[colKey]))
      .forEach((colKey) =>
        swimlaneOrder
          .flatMap((laneId) =>
            batchLaneCardsByColumn && laneId === swimlaneOrder[0]
              ? batchLaneCardsByColumn[colKey] ?? []
              : getSwimlaneColumnCards(workflow, laneId, colKey)
          )
          .forEach((card) => {
            const tickKey = `${colKey}:${card?.id}`;
            if (!card?.id || autoTickedCardIdsRef.current.has(tickKey)) return;
            autoTickedCardIdsRef.current.add(tickKey);
            setCardSelected(card.id, true);
          })
      );
  }, [workflow, swimlaneOrder, batchLaneCardsByColumn, setCardSelected]);

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
              const sendSubmissionAction =
                isCreatingSubmission && submissionSendCards.length > 0
                  ? {
                      ...INVOICE_ACTION_BUTTONS.sendSubmission,
                      onClick: () => onColumnSendSubmission?.(submissionSendCards),
                    }
                  : undefined;
              const hasInvoiceButton =
                invoiceAction === "sendInvoice" ? invoiceCards.length === 1 : invoiceButtonCards.length > 0;
              const invoiceActionHandlers = {
                upload: onColumnUploadInvoice,
                issueArInvoice: (cards) =>
                  onColumnUploadInvoice?.(cards, { workflowId: workflow.workflow_id ?? workflow.id }),
                uploadPos: (cards) =>
                  onColumnUploadPos?.(cards, { workflowId: workflow.workflow_id ?? workflow.id }),
                sendInvoice: ([card]) => onColumnSendInvoice?.(card),
                merge: onColumnMergeInvoice,
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
                    actionLabel={hasInvoiceButton ? INVOICE_ACTION_BUTTONS[invoiceButton].label : "Batch"}
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
                        onBatchRequestPo={onBatchRequestPo}
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
