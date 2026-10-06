import { useEffect, useMemo, useRef } from "react";
import { DragDropContext } from "@hello-pangea/dnd";
import { FiDownload, FiSend, FiUploadCloud } from "react-icons/fi";
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
   "Create Submission Documents", then "Send For Final Submission" once those cards' documents exist. */
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
  finalSubmission: { label: "Send For Final Submission", icon: <FiSend size={16} aria-hidden /> },
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
  onColumnSendFinalSubmission,
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

  /* Cards of the batch board's first lane, with any card a batch has moved drawn in its new
     column instead. */
  const columnByCardId = useBatchMoveStore((state) => state.columnByCardId);
  const batchByCardId = useBatchMoveStore((state) => state.batchByCardId);
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

  /* "SE Received" and "AR Invoices Issued" cards start ticked, ready for "Upload Invoice" / "Merge
     Invoice", and McDermott "Requested PO" cards for "Upload POs". Each card is ticked only the first
     time it shows up in that column, so a card the user unticks stays unticked across board refetches,
     and is ticked again once it moves on to the next one. */
  const setCardSelected = useKanbanCardSelectionStore((state) => state.setCardSelected);
  const autoTickedCardIdsRef = useRef(new Set());

  useEffect(() => {
    const isAutoTickColumn = (column) => {
      const action = getInvoiceAction(workflow, column);
      return isBatchWorkflow(workflow) ? Boolean(action) : action === "uploadPos";
    };
    if (!isBatchWorkflow(workflow) && !isMcDermottWorkflow(workflow)) return;
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
    byNumber.forEach((batchCards, batchNumber) => {
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
      className={`kanban-container kanban-container--board-hscroll ${layoutView === "normal" ? "kanban-normal-layout" : ""}`}
      key={layoutView}
    >
      <DragDropContext onDragEnd={KANBAN_DND_DISABLED ? () => {} : onDragEnd}>
        <div
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
              /* "Consolidated": ticked cards with created documents get "Send For Final Submission", the
                 rest "Create Submission Documents"; a mix of both shows the two buttons side by side. */
              const submissionReadyCards =
                invoiceAction === "submission"
                  ? invoiceCards.filter((card) => submissionIdByCardId[String(card.id)] != null)
                  : [];
              const submissionPendingCards =
                invoiceAction === "submission"
                  ? invoiceCards.filter((card) => submissionIdByCardId[String(card.id)] == null)
                  : [];
              const invoiceButton =
                invoiceAction === "submission"
                  ? submissionPendingCards.length
                    ? "prepareSubmission"
                    : "finalSubmission"
                  : invoiceAction;
              const invoiceButtonCards =
                invoiceAction === "submission"
                  ? submissionPendingCards.length
                    ? submissionPendingCards
                    : submissionReadyCards
                  : invoiceCards;
              const hasInvoiceButton =
                invoiceAction === "sendInvoice" ? invoiceCards.length === 1 : invoiceCards.length > 0;
              const secondaryAction =
                submissionPendingCards.length && submissionReadyCards.length
                  ? {
                      ...INVOICE_ACTION_BUTTONS.finalSubmission,
                      onClick: () => onColumnSendFinalSubmission?.(submissionReadyCards),
                    }
                  : undefined;
              const invoiceActionHandlers = {
                upload: onColumnUploadInvoice,
                issueArInvoice: (cards) =>
                  onColumnUploadInvoice?.(cards, { workflowId: workflow.workflow_id ?? workflow.id }),
                uploadPos: (cards) =>
                  onColumnUploadPos?.(cards, { workflowId: workflow.workflow_id ?? workflow.id }),
                sendInvoice: ([card]) => onColumnSendInvoice?.(card),
                merge: onColumnMergeInvoice,
                prepareSubmission: onColumnPrepareSubmission,
                finalSubmission: onColumnSendFinalSubmission,
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
                    secondaryAction={secondaryAction}
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

            return (
              <section
                className={`kanban-swimlane ${!shouldShowSwimlaneTitle ? "kanban-swimlane--single" : ""}`}
                key={laneId}
                aria-label={lane.title}
                style={
                  !shouldShowSwimlaneTitle && hasLaneColor
                    ? { borderLeft: `3px solid ${laneColorHex}` }
                    : undefined
                }
              >
                {shouldShowSwimlaneTitle && (
                  <div
                    className="kanban-swimlane__title"
                    style={
                      hasLaneColor
                        ? {
                            backgroundColor: laneColorHex,
                            color: pickForegroundOnSwimlaneBackground(laneColorHex),
                          }
                        : undefined
                    }
                  >
                    {lane.title}
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
