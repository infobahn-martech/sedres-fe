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
  BOARD_COLUMN_GAP_PX,
  WORKFLOW_ROW_MIN_HEIGHT,
  getBoardGridTemplateColumns,
  getColumnWidth,
} from "../../utils/boardGridHelpers";
import { sanitizeSwimlaneColorCode, pickForegroundOnSwimlaneBackground } from "../../../EditWorkflows/workflow.utils";
import "../../../../design/scss/pages/kanban-board/swimlaneBoard.scss";

const EMPTY_COLLAPSED_SET = new Set();

export default function WorkflowColumns({
  workflow,
  collapsedColumns,
  maxColumnHeights,
  onDragEnd,
  onSelectCard,
  cardsById,
  onColumnHeaderClick,
  onContextMenu,
  onHeightChange,
  isDarkMode,
  layoutView,
}) {
  const collapsedColumnIds = collapsedColumns[workflow.id] ?? EMPTY_COLLAPSED_SET;
  const maxHeight = Math.max(maxColumnHeights[workflow.id] || 0, WORKFLOW_ROW_MIN_HEIGHT);

  const swimlaneOrder = workflow.swimlaneOrder?.length
    ? workflow.swimlaneOrder
    : ["lane-default"];

  const shouldShowSwimlaneTitle = swimlaneOrder.length > 1;

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
                (sum, k) => sum + countCardsInColumn(workflow, k),
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
                            wipDisplay={String(countCardsInColumn(workflow, colKey))}
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
                    const cards = getSwimlaneColumnCards(workflow, laneId, colKey);
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
