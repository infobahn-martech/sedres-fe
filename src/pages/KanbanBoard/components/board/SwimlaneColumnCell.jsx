import { useRef, useEffect, useLayoutEffect } from "react";
import { Droppable } from "@hello-pangea/dnd";
import PropTypes from "prop-types";
import CardItem from "../cards/CardItem";
import TaxiBoatSmallCard from "../cards/components/TaxiBoat/TaxiBoatSmallCard";
import DASmallCard from "../cards/components/DA/DASmallCard";
import { buildSwimlaneDroppableId } from "../../hooks/useKanbanDnD";
import { CARD_GAP, CELL_PADDING_X, getCardsPerRow, getCardWidth } from "../../utils/boardGridHelpers";
import usePermissions from "../../../../shared/hooks/usePermissions";
import { PERMISSION_MODULES } from "../../../../shared/constants/permissions";
import "../../../../design/scss/pages/kanban-board/column.scss";

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
  isClassicLayout = false,
  isModernLayout = false,
  isDarkMode = false,
  layoutView = null,
}) {
  const { hasModule } = usePermissions();
  const canViewCards = hasModule(PERMISSION_MODULES.KANBAN_CARD);
  const EMPTY_DROP_ZONE_MIN_HEIGHT = 720;
  /* Only fall back to the big placeholder height when nothing else in the row sets a
     height — otherwise an empty column would stretch the whole swimlane row to 720px
     even when its siblings only need ~200px (all cells share one CSS grid row). */
  const isUnconstrainedEmpty = cards.length === 0 && !columnHeight;
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

  useLayoutEffect(() => {
    /* Empty columns must never report their height into the shared row-height pool: their
       own placeholder min-height (see isUnconstrainedEmpty) would otherwise get baked into
       maxColumnHeights and stretch every column in the row, with no way to shrink back down. */
    if (!cellRef.current || !onHeightChange || cards.length === 0) return;

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
  }, [cards.length, column.id, laneId, onHeightChange, isCollapsed]);

  useEffect(() => {
    if (!cellRef.current || !onHeightChange || cards.length === 0) return;

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
  }, [cards.length, column.id, laneId, onHeightChange, isCollapsed]);

  if (isCollapsed) {
    return (
      <div
        ref={cellRef}
        className={`column column--swimlane-cell column-collapsed ${
          isClassicLayout ? "column-classic" : ""
        } ${isModernLayout ? "column-modern" : ""} ${isDarkMode ? "column-dark" : ""}`}
        onContextMenu={handleContextMenu}
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
      className={`column column--swimlane-cell ${isClassicLayout ? "column-classic" : ""} ${
        isModernLayout ? "column-modern" : ""
      } ${isDarkMode ? "column-dark" : ""}`}
      onContextMenu={handleContextMenu}
      style={{
        ...(columnHeight ? { minHeight: `${columnHeight}px` } : {}),
        ...(column.backgroundColor ? { backgroundColor: column.backgroundColor } : {}),
      }}
    >
      <Droppable droppableId={droppableId}>
        {(provided, snapshot) => (
          <div
            className={`card-list card-list--swimlane-grid ${
              snapshot.isDraggingOver ? "drag-over" : ""
            } ${isUnconstrainedEmpty ? "card-list--empty" : ""}`}
            ref={provided.innerRef}
            {...provided.droppableProps}
            style={{
              /* Inner card grid: fixed column widths; row height = tallest card in that row (implicit auto rows) */
              display: "grid",
              gridTemplateColumns: `repeat(${perRow}, ${cardWidth}px)`,
              gap: `${CARD_GAP}px`,
              padding: `${CELL_PADDING_X}px`,
              justifyItems: "start",
              alignItems: "start",
              alignContent: "start",
              minHeight: isUnconstrainedEmpty ? `${EMPTY_DROP_ZONE_MIN_HEIGHT}px` : undefined,
              ...(column.backgroundColor ? { backgroundColor: column.backgroundColor } : {}),
            }}
          >
            {canViewCards && cards.map((card, index) =>
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
                  isClassicLayout={isClassicLayout}
                  isModernLayout={isModernLayout}
                  columnTitle={column.title}
                  fixedDimensions={{ width: cardWidth }}
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
  isClassicLayout: PropTypes.bool,
  isModernLayout: PropTypes.bool,
  isDarkMode: PropTypes.bool,
  layoutView: PropTypes.string,
};
