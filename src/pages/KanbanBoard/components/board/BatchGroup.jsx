import { useState } from "react";
import PropTypes from "prop-types";
import { FiChevronDown } from "react-icons/fi";
import CardItem from "../cards/CardItem";
import "../../../../design/scss/pages/kanban-board/batch-group.scss";

const noop = () => {};

/**
 * Collapsible group of cards inside a column cell ("Batch UI Test" preview).
 * `startIndex` keeps Draggable indices contiguous across batches in the same Droppable.
 */
export default function BatchGroup({ batch, startIndex, perRow, cardWidth, columnTitle, workflowTitle }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const cardCount = batch.cards.length;

  const toggleSelect = (card) =>
    setSelectedIds((prev) =>
      prev.includes(card.id) ? prev.filter((id) => id !== card.id) : [...prev, card.id]
    );

  return (
    <div className={`batch-group ${isExpanded ? "" : "batch-group--collapsed"}`}>
      <button
        type="button"
        className="batch-group__header"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
      >
        <FiChevronDown className="batch-group__chevron" size={18} aria-hidden />
        <span className="batch-group__title">{batch.title}</span>
        <span className="batch-group__badge">
          {cardCount} {cardCount === 1 ? "card" : "cards"}
        </span>
      </button>

      {isExpanded && (
        <div
          className="batch-group__cards"
          style={{ gridTemplateColumns: `repeat(${perRow}, ${cardWidth}px)` }}
        >
          {batch.cards.map((card, i) => (
            <CardItem
              key={card.id}
              card={card}
              index={startIndex + i}
              setSelectedCard={noop}
              columnTitle={columnTitle}
              workflowTitle={workflowTitle}
              fixedDimensions={{ width: cardWidth }}
              isDragDisabled
              isSelectedForAction={selectedIds.includes(card.id)}
              onToggleSelectForAction={toggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

BatchGroup.propTypes = {
  batch: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    cards: PropTypes.arrayOf(PropTypes.object).isRequired,
  }).isRequired,
  startIndex: PropTypes.number.isRequired,
  perRow: PropTypes.number.isRequired,
  cardWidth: PropTypes.number.isRequired,
  columnTitle: PropTypes.string,
  workflowTitle: PropTypes.string,
};
