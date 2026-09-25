import { useMemo } from "react";
import { DragDropContext } from "@hello-pangea/dnd";
import { KANBAN_DND_DISABLED } from "../../../../shared/constants/kanbanConfig";
import ColumnHeader from "./ColumnHeader";
import SwimlaneColumnCell from "./SwimlaneColumnCell";
import {
  countCardsInColumn,
  getSwimlaneColumnCards,
  getColumnHeaderGroups,
} from "../../utils/columnHelpers";
import {
  isBatchUiTestWorkflow,
  getBatchUiTestBatches,
  countBatchUiTestCards,
} from "../../utils/batchUiTestData";
import {
  BOARD_COLUMN_GAP_PX,
  WORKFLOW_ROW_MIN_HEIGHT,
  getBoardGridTemplateColumns,
  getColumnWidth,
} from "../../utils/boardGridHelpers";
import useBatchMoveStore from "../../../../shared/store/batchMoveStore";
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

const isBacklogColumn = (column) =>
  String(column?.title ?? "").trim().toLowerCase() === BATCH_ACTION_COLUMN;

const hasBatchAction = (workflow, ...columns) =>
  isBatchWorkflow(workflow) && columns.some(isBacklogColumn);

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

  /* "Batch UI Test" board renders grouped preview batches (first lane only) instead of API cards */
  const isBatchUiTest = isBatchUiTestWorkflow(workflow);
  /* Cards of the batch board's first lane, with any card a batch has moved drawn in its new
     column instead. */
  const columnByCardId = useBatchMoveStore((state) => state.columnByCardId);
  const batchByCardId = useBatchMoveStore((state) => state.batchByCardId);

  const batchLaneCardsByColumn = useMemo(() => {
    if (!isBatchWorkflow(workflow)) return null;
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

  /* A column whose cards carry a batch renders them as groups (loose cards first, headerless),
     the same shape the "Batch UI Test" board uses. */
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
        usesBoardSelection: true,
        cards: loose,
      });
    }
    byNumber.forEach((batchCards, batchNumber) => {
      batches.push({
        id: `${laneId}-${colKey}-${batchNumber}`,
        title: batchNumber,
        usesBoardSelection: true,
        cards: batchCards,
      });
    });
    return batches;
  };

  const getColumnCount = (colKey) => {
    if (isBatchUiTest) return countBatchUiTestCards(workflow.columns[colKey]);
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
                    actionLabel="Batch"
                    onActionClick={
                      hasBatchAction(workflow, displayColumn, firstColumn)
                        ? () =>
                            onColumnBatchAction({
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
                        onToggleCardSelect={onToggleCardSelect}
                        onCardSelectDragStart={onCardSelectDragStart}
                        onCardSelectDragEnter={onCardSelectDragEnter}
                        batches={
                          isBatchUiTest && laneId === swimlaneOrder[0]
                            ? getBatchUiTestBatches(column)
                            : getBatchesForColumn(colKey, laneId)
                        }
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
