import { useState } from "react";
import PropTypes from "prop-types";
import { FiChevronDown } from "react-icons/fi";
import CardItem from "../cards/CardItem";
import "../../../../design/scss/pages/kanban-board/batch-group.scss";

const noop = () => {};
const EMPTY_SELECTED_IDS = [];
const AWAITING_SE_COLUMN_PATTERN = /^awaiting\s+(for\s+)?se$/i;
const SE_RECEIVED_COLUMN_PATTERN = /^se\s+received$/i;

/**
 * Collapsible group of cards inside a column cell.
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
  onUploadSeApproval,
  onUploadInvoice,
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  /* Loose cards render as a plain grid: no header, never collapsed. */
  const isUngrouped = Boolean(batch.isUngrouped);
  /* Batches already emailed for SE creation sit in "Awaiting SE" (live title "Awaiting for SE"). */
  const isAwaitingSeColumn = AWAITING_SE_COLUMN_PATTERN.test((columnTitle ?? "").trim());
  /* Batches whose SE approval is back sit in "SE Received" and move on to invoicing. */
  const isSeReceivedColumn = SE_RECEIVED_COLUMN_PATTERN.test((columnTitle ?? "").trim());

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

          {isAwaitingSeColumn ? (
            <button
              type="button"
              className="batch-group__action"
              onClick={() => onUploadSeApproval?.(batch)}
            >
              Upload SE Approval
            </button>
          ) : isSeReceivedColumn ? (
            <button
              type="button"
              className="batch-group__action"
              onClick={() => onUploadInvoice?.(batch)}
            >
              Upload Invoice
            </button>
          ) : (
            <button
              type="button"
              className="batch-group__action"
              onClick={() => onSendSeRequest?.(batch)}
            >
              Sent for SE creation
            </button>
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
              setSelectedCard={setSelectedCard ?? noop}
              columnTitle={columnTitle}
              workflowTitle={workflowTitle}
              fixedDimensions={{ width: cardWidth }}
              isSelectedForAction={selectedActionCardIds.includes(card.id)}
              onToggleSelectForAction={onToggleCardSelect}
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
  onUploadSeApproval: PropTypes.func,
  onUploadInvoice: PropTypes.func,
};
