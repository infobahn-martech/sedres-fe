import { useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { Droppable } from "@hello-pangea/dnd";
import PropTypes from "prop-types";
import CardItem from "../cards/CardItem";
import TaxiBoatSmallCard from "../cards/components/TaxiBoat/TaxiBoatSmallCard";
import DASmallCard from "../cards/components/DA/DASmallCard";
import BatchGroup from "./BatchGroup";
import { buildSwimlaneDroppableId } from "../../hooks/useKanbanDnD";
import { CARD_GAP, CELL_PADDING_X, getCardsPerRow, getCardWidth } from "../../utils/boardGridHelpers";
import usePermissions from "../../../../shared/hooks/usePermissions";
import { PERMISSION_MODULES } from "../../../../shared/constants/permissions";
import { isSubmittedInvoicesColumnTitle } from "../../utils/columnTitles";
import "../../../../design/scss/pages/kanban-board/column.scss";

const EMPTY_SELECTED_IDS = [];
const EMPTY_BATCHES = [];

/**
 * One column cell inside a swimlane row: droppable area + CSS grid for cards (cardsPerRow).
 */
export default function SwimlaneColumnCell({
  laneId,
  column,
  cards,
  setSelectedCard,
  cardsById,
  isCollapsed = false,
  onContextMenu,
  columnHeight,
  onHeightChange,
  isDarkMode = false,
  layoutView = null,
  workflowTitle = "",
  selectedActionCardIds = EMPTY_SELECTED_IDS,
  onBatchSendSeRequest,
  onBatchUploadSeApproval,
  onBatchUploadInvoice,
  onBatchRequestPo,
  onBatchUploadPos,
  hideCardSelect = false,
  onToggleCardSelect,
  onCardSelectDragStart,
  onCardSelectDragEnter,
  batches = EMPTY_BATCHES,
}) {
  const { hasModule } = usePermissions();
  const canViewCards = hasModule(PERMISSION_MODULES.KANBAN_CARD);
  const EMPTY_DROP_ZONE_MIN_HEIGHT = 240;
  /* Only fall back to the big placeholder height when nothing else in the row sets a
     height — otherwise an empty column would stretch the whole swimlane row to 720px
     even when its siblings only need ~200px (all cells share one CSS grid row). */
  const hasBatches = batches.length > 0;
  /* Batch preview cards count as content for height reporting / empty-state checks */
  const contentCount = hasBatches
    ? batches.reduce((sum, batch) => sum + batch.cards.length, 0)
    : cards.length;
  const isUnconstrainedEmpty = contentCount === 0 && !columnHeight;
  const cellRef = useRef(null);
  const lastReportedHeightRef = useRef(null);
  const droppableId = buildSwimlaneDroppableId(laneId, column.id);
  /* Inner card grid: repeat(cardsPerRow, …) — layout inside the cell; board row width uses the same ratio via boardGridHelpers */
  const perRow = getCardsPerRow(column);
  const cardWidth = getCardWidth(layoutView);
  /* Custom column colour from Edit workflow → `--cell-bg` (swimlaneBoard.scss; the card list
     inherits it). Default white stays unset so the dark theme can tell it apart. */
  const hasCustomCellBg =
    Boolean(column.backgroundColor) && !/^#f{3}(f{3})?$/i.test(column.backgroundColor);
  const cellBgStyle = hasCustomCellBg ? { "--cell-bg": column.backgroundColor } : {};

  const handleContextMenu = (e) => {
    e.preventDefault();
    onContextMenu?.(e, column, laneId);
  };

  /* Ignore double-clicks that land on a card (Draggable roots render draggable="true") —
     only opening the empty column area should trigger the add-card workflow picker. */
  const handleDoubleClick = (e) => {
    if (e.target.closest('[draggable="true"]')) return;
    if (workflowTitle === "Task Workflow") {
      window.dispatchEvent(new CustomEvent("kanban:open-task-card-modal"));
      return;
    }
    window.dispatchEvent(new CustomEvent("kanban:open-add-card-modal"));
  };

  /* Report the height the cards actually need — never the cell's offsetHeight. The cell gets
     the shared row min-height (columnHeight) applied, so measuring it fed that height back into
     the pool and the row could only ever grow (e.g. after a batch collapsed or cards moved out).
     Empty / collapsed cells report 0 so a stale height doesn't keep the row stretched. */
  const measureHeight = useCallback(() => {
    const cell = cellRef.current;
    if (!cell || !onHeightChange) return;

    let height = 0;
    const list = cell.querySelector(".card-list");
    if (list && contentCount > 0 && !isCollapsed) {
      const cellTop = cell.getBoundingClientRect().top;
      let contentBottom = 0;
      for (const child of list.children) {
        contentBottom = Math.max(contentBottom, child.getBoundingClientRect().bottom - cellTop);
      }
      height = Math.ceil(
        contentBottom +
          parseFloat(getComputedStyle(list).paddingBottom) +
          parseFloat(getComputedStyle(cell).borderBottomWidth)
      );
    }

    if (lastReportedHeightRef.current !== height) {
      lastReportedHeightRef.current = height;
      onHeightChange(column.id, height, laneId);
    }
  }, [column.id, laneId, onHeightChange, contentCount, isCollapsed]);

  useLayoutEffect(() => {
    measureHeight();
    const rafId = requestAnimationFrame(measureHeight);
    return () => cancelAnimationFrame(rafId);
  }, [measureHeight]);

  /* Watch the cards themselves (batch expand/collapse, card content changes) — the cell box
     doesn't shrink below its min-height, so observing it would miss content getting smaller. */
  useEffect(() => {
    const list = cellRef.current?.querySelector(".card-list");
    if (!list || !onHeightChange) return;

    const resizeObserver = new ResizeObserver(measureHeight);
    Array.from(list.children).forEach((child) => resizeObserver.observe(child));
    return () => resizeObserver.disconnect();
  }, [measureHeight, onHeightChange]);

  if (isCollapsed) {
    return (
      <div
        ref={cellRef}
        className={`column column--swimlane-cell column-collapsed ${isDarkMode ? "column-dark" : ""}`}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
        style={{
          ...(columnHeight ? { minHeight: `${columnHeight}px` } : {}),
          ...cellBgStyle,
        }}
      >
        <span className="column-collapsed__title">{column.title}</span>
      </div>
    );
  }

  return (
    <div
      ref={cellRef}
      className={`column column--swimlane-cell ${isDarkMode ? "column-dark" : ""}`}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
      style={{
        ...(columnHeight ? { minHeight: `${columnHeight}px` } : {}),
        ...cellBgStyle,
      }}
    >
      <Droppable droppableId={droppableId}>
        {(provided, snapshot) => (
          <div
            className={`card-list card-list--swimlane-grid ${hasBatches ? "card-list--batched" : ""} ${
              snapshot.isDraggingOver ? "drag-over" : ""
            } ${isUnconstrainedEmpty ? "card-list--empty" : ""}`}
            ref={provided.innerRef}
            {...provided.droppableProps}
            style={{
              /* Inner card grid: fixed column widths; row height = tallest card in that row (implicit auto rows) */
              ...(hasBatches
                ? {}
                : {
                    display: "grid",
                    gridTemplateColumns: `repeat(${perRow}, ${cardWidth}px)`,
                    gap: `${CARD_GAP}px`,
                    padding: `${CELL_PADDING_X}px`,
                  }),
              justifyItems: "start",
              alignItems: "start",
              alignContent: "start",
              minHeight: isUnconstrainedEmpty ? `${EMPTY_DROP_ZONE_MIN_HEIGHT}px` : undefined,
            }}
          >
            {canViewCards && hasBatches && batches.map((batch, i) => (
              <BatchGroup
                key={batch.id}
                batch={batch}
                startIndex={batches.slice(0, i).reduce((sum, b) => sum + b.cards.length, 0)}
                perRow={perRow}
                cardWidth={cardWidth}
                columnTitle={column.title}
                workflowTitle={workflowTitle}
                selectedActionCardIds={selectedActionCardIds}
                hideCardSelect={hideCardSelect}
                onToggleCardSelect={onToggleCardSelect}
                onCardSelectDragStart={onCardSelectDragStart}
                onCardSelectDragEnter={onCardSelectDragEnter}
                setSelectedCard={setSelectedCard}
                onSendSeRequest={onBatchSendSeRequest}
                onUploadSeApproval={onBatchUploadSeApproval}
                onUploadInvoice={onBatchUploadInvoice}
                onRequestPo={onBatchRequestPo}
                onUploadPos={onBatchUploadPos}
              />
            ))}
            {canViewCards && !hasBatches && cards.map((card, index) =>
              card.cardVariant === "taxi-boat" ? (
                <TaxiBoatSmallCard
                  key={card.id}
                  card={card}
                  index={index}
                  setSelectedCard={setSelectedCard}
                />
              ) : card.cardVariant === "da" ? (
                <DASmallCard
                  key={card.id}
                  card={card}
                  index={index}
                  setSelectedCard={setSelectedCard}
                />
              ) : (
                <CardItem
                  key={card.id}
                  card={card}
                  index={index}
                  setSelectedCard={setSelectedCard}
                  cardsById={cardsById}
                  columnTitle={column.title}
                  workflowTitle={workflowTitle}
                  fixedDimensions={{ width: cardWidth }}
                  isSelectedForAction={selectedActionCardIds.includes(card.id)}
                  onToggleSelectForAction={hideCardSelect || isSubmittedInvoicesColumnTitle(column.title) ? undefined : onToggleCardSelect}
                  onSelectDragStart={onCardSelectDragStart}
                  onSelectDragEnter={onCardSelectDragEnter}
                />
              )
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

SwimlaneColumnCell.propTypes = {
  laneId: PropTypes.string.isRequired,
  column: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    color: PropTypes.string,
    wipLimit: PropTypes.number,
    cardsPerRow: PropTypes.number,
  }).isRequired,
  cards: PropTypes.arrayOf(PropTypes.object).isRequired,
  setSelectedCard: PropTypes.func.isRequired,
  cardsById: PropTypes.object,
  isCollapsed: PropTypes.bool,
  onContextMenu: PropTypes.func,
  columnHeight: PropTypes.number,
  onHeightChange: PropTypes.func,
  isDarkMode: PropTypes.bool,
  layoutView: PropTypes.string,
  workflowTitle: PropTypes.string,
  selectedActionCardIds: PropTypes.arrayOf(PropTypes.string),
  onBatchSendSeRequest: PropTypes.func,
  onBatchUploadSeApproval: PropTypes.func,
  onBatchUploadInvoice: PropTypes.func,
  onBatchRequestPo: PropTypes.func,
  onBatchUploadPos: PropTypes.func,
  hideCardSelect: PropTypes.bool,
  onToggleCardSelect: PropTypes.func,
  onCardSelectDragStart: PropTypes.func,
  onCardSelectDragEnter: PropTypes.func,
  batches: PropTypes.arrayOf(PropTypes.object),
};
