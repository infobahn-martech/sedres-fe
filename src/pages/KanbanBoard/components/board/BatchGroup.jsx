import { useState } from "react";
import PropTypes from "prop-types";
import { FiChevronDown } from "react-icons/fi";
import CardItem from "../cards/CardItem";
import "../../../../design/scss/pages/kanban-board/batch-group.scss";

const noop = () => {};
const EMPTY_SELECTED_IDS = [];
const AWAITING_SE_COLUMN_PATTERN = /^awaiting\s+(for\s+)?se$/i;

/**
 * Collapsible group of cards inside a column cell ("Batch UI Test" preview).
 * `startIndex` keeps Draggable indices contiguous across batches in the same Droppable.
 */
export default function BatchGroup({
  batch,
  startIndex,
  perRow,
  cardWidth,
  columnTitle,
  workflowTitle,
  selectedActionCardIds = EMPTY_SELECTED_IDS,
  onToggleCardSelect,
  setSelectedCard,
  onSendSeRequest,
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [previewSelectedIds, setPreviewSelectedIds] = useState([]);
  const cardCount = batch.cards.length;

  /* Loose cards render as a plain grid: no header, never collapsed. */
  const isUngrouped = Boolean(batch.isUngrouped);
  /* Batches the board builds join its own selection and card clicks; the "Batch UI Test"
     preview keeps its own, since its cards are not in the board's data. */
  const isBoardBatch = Boolean(batch.usesBoardSelection);
  /* Batches already emailed for SE creation sit in "Awaiting SE" (live title "Awaiting for SE"). */
  const isAwaitingSeColumn = AWAITING_SE_COLUMN_PATTERN.test((columnTitle ?? "").trim());
  const selectedIds = isBoardBatch ? selectedActionCardIds : previewSelectedIds;
  const toggleSelect = isBoardBatch
    ? onToggleCardSelect
    : (card) =>
        setPreviewSelectedIds((prev) =>
          prev.includes(card.id) ? prev.filter((id) => id !== card.id) : [...prev, card.id]
        );

  return (
    <div
      className={`batch-group ${isUngrouped ? "batch-group--loose" : ""} ${
        isExpanded ? "" : "batch-group--collapsed"
      }`}
    >
      {!isUngrouped && (
        <div className="batch-group__header">
          <button
            type="button"
            className="batch-group__toggle"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
          >
            <FiChevronDown className="batch-group__chevron" size={18} aria-hidden />
            <span className="batch-group__title">{batch.title}</span>
          </button>

          {isBoardBatch && isAwaitingSeColumn ? (
            <button type="button" className="batch-group__action">
              Upload SE Approval
            </button>
          ) : isBoardBatch ? (
            <button
              type="button"
              className="batch-group__action"
              onClick={() => onSendSeRequest?.(batch)}
            >
              Sent for SE creation
            </button>
          ) : (
            <span className="batch-group__badge">
              {cardCount} {cardCount === 1 ? "card" : "cards"}
            </span>
          )}
        </div>
      )}

      {(isUngrouped || isExpanded) && (
        <div
          className="batch-group__cards"
          style={{ gridTemplateColumns: `repeat(${perRow}, ${cardWidth}px)` }}
        >
          {batch.cards.map((card, i) => (
            <CardItem
              key={card.id}
              card={card}
              index={startIndex + i}
              setSelectedCard={isBoardBatch ? (setSelectedCard ?? noop) : noop}
              columnTitle={columnTitle}
              workflowTitle={workflowTitle}
              fixedDimensions={{ width: cardWidth }}
              isDragDisabled={!isBoardBatch}
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
    isUngrouped: PropTypes.bool,
    usesBoardSelection: PropTypes.bool,
  }).isRequired,
  startIndex: PropTypes.number.isRequired,
  perRow: PropTypes.number.isRequired,
  cardWidth: PropTypes.number.isRequired,
  columnTitle: PropTypes.string,
  workflowTitle: PropTypes.string,
  selectedActionCardIds: PropTypes.arrayOf(PropTypes.string),
  onToggleCardSelect: PropTypes.func,
  setSelectedCard: PropTypes.func,
  onSendSeRequest: PropTypes.func,
};
