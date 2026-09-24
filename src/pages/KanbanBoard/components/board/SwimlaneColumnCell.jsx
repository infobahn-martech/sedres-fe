import { useRef, useEffect, useLayoutEffect } from "react";
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

  useLayoutEffect(() => {
    /* Empty columns must never report their height into the shared row-height pool: their
       own placeholder min-height (see isUnconstrainedEmpty) would otherwise get baked into
       maxColumnHeights and stretch every column in the row, with no way to shrink back down. */
    if (!cellRef.current || !onHeightChange || contentCount === 0) return;

    const measureHeight = () => {
      if (cellRef.current) {
        const height = cellRef.current.offsetHeight;
        if (lastReportedHeightRef.current !== height) {
          lastReportedHeightRef.current = height;
          onHeightChange(column.id, height, laneId);
        }
      }
    };

    measureHeight();
    const rafId = requestAnimationFrame(() => {
      measureHeight();
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [contentCount, column.id, laneId, onHeightChange, isCollapsed]);

  useEffect(() => {
    if (!cellRef.current || !onHeightChange || contentCount === 0) return;

    const measureHeight = () => {
      if (cellRef.current) {
        const height = cellRef.current.offsetHeight;
        if (lastReportedHeightRef.current !== height) {
          lastReportedHeightRef.current = height;
          onHeightChange(column.id, height, laneId);
        }
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      measureHeight();
    });

    resizeObserver.observe(cellRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [contentCount, column.id, laneId, onHeightChange, isCollapsed]);

  if (isCollapsed) {
    return (
      <div
        ref={cellRef}
        className={`column column--swimlane-cell column-collapsed ${isDarkMode ? "column-dark" : ""}`}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
        style={{
          ...(columnHeight ? { minHeight: `${columnHeight}px` } : {}),
          ...(column.backgroundColor ? { backgroundColor: column.backgroundColor } : {}),
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
        ...(column.backgroundColor ? { backgroundColor: column.backgroundColor } : {}),
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
              ...(column.backgroundColor ? { backgroundColor: column.backgroundColor } : {}),
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
                  onToggleSelectForAction={onToggleCardSelect}
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
  onToggleCardSelect: PropTypes.func,
  onCardSelectDragStart: PropTypes.func,
  onCardSelectDragEnter: PropTypes.func,
  batches: PropTypes.arrayOf(PropTypes.object),
};
