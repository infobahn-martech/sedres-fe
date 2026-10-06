import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { FiChevronDown } from "react-icons/fi";
import CardItem from "../cards/CardItem";
import useBatchMoveStore from "../../../../shared/store/batchMoveStore";
import "../../../../design/scss/pages/kanban-board/batch-group.scss";

const noop = () => {};
const EMPTY_SELECTED_IDS = [];
const AWAITING_SE_COLUMN_PATTERN = /^awaiting\s+(for\s+)?se$/i;
const SE_RECEIVED_COLUMN_PATTERN = /^se\s+received$/i;
/* McDermott batches skip SAIPEM's SE steps, so their header has no SE actions. */
const MCDERMOTT_WORKFLOW_PATTERN = /mcdermott/i;
/* Compared on letters only, so stray spaces, punctuation or invisible characters in the live
   column title don't hide the "Request PO" button. */
const READY_FOR_PO_REQUEST_COLUMN_KEY = "readyforporequest";
const isReadyForPoRequestColumn = (title) =>
  String(title ?? "").toLowerCase().replace(/[^a-z]/g, "") === READY_FOR_PO_REQUEST_COLUMN_KEY;

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
  onCardSelectDragStart,
  onCardSelectDragEnter,
  setSelectedCard,
  onSendSeRequest,
  onUploadSeApproval,
  onUploadInvoice,
  onRequestPo,
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  /* Loose cards render as a plain grid: no header, never collapsed. */
  const isUngrouped = Boolean(batch.isUngrouped);
  const isSeFlowBatch = !isUngrouped && !MCDERMOTT_WORKFLOW_PATTERN.test(workflowTitle ?? "");
  /* McDermott batches in "Ready for PO Request" send the PO request email from the header. */
  const isPoRequestBatch =
    !isUngrouped &&
    !isSeFlowBatch &&
    isReadyForPoRequestColumn(columnTitle);
  /* Batches already emailed for SE creation sit in "Awaiting SE" (live title "Awaiting for SE"). */
  const isAwaitingSeColumn = AWAITING_SE_COLUMN_PATTERN.test((columnTitle ?? "").trim());
  /* Batches whose SE approval is back sit in "SE Received" and move on to invoicing. */
  const isSeReceivedColumn = SE_RECEIVED_COLUMN_PATTERN.test((columnTitle ?? "").trim());
  /* Batches still to be sent for SE creation start with no card ticked. Ticks are kept per
     batch, apart from the board-wide selection used to create batches in Backlog. */
  const isSendSeBatch = isSeFlowBatch && !isAwaitingSeColumn && !isSeReceivedColumn;
  const [seTickedCardIds, setSeTickedCardIds] = useState([]);
  /* "Awaiting SE" batches start with no card ticked. The user ticks the cards to confirm; once the SE
     upload is done, ticked cards the SE approval covers turn green. */
  const seApprovedByCardId = useBatchMoveStore((state) => state.seApprovedByCardId);
  const seTickedByCardId = useBatchMoveStore((state) => state.seTickedByCardId);
  const toggleSeReviewCard = useBatchMoveStore((state) => state.toggleSeReviewCard);
  const isSeReviewBatch = isSeFlowBatch && isAwaitingSeColumn;
  /* Once the batch's SE upload is done, "Review and Move" replaces "Upload SE Approval". */
  const batchId = useBatchMoveStore((state) => state.batchIdByNumber[batch.title]);
  const isSeUploadDone = useBatchMoveStore((state) => Boolean(state.seReviewByBatchId[batchId]));
  const openSeReviewMoveModal = useBatchMoveStore((state) => state.openSeReviewMoveModal);
  const loadSeReview = useBatchMoveStore((state) => state.loadSeReview);

  /* The SE upload's result only lives in memory, so after a reload it is read back per batch. */
  useEffect(() => {
    if (!isSeReviewBatch || batchId == null || isSeUploadDone) return;
    loadSeReview(batchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSeReviewBatch, batchId, loadSeReview]);

  const getIsSelectedForAction = (card) => {
    if (isSendSeBatch) return seTickedCardIds.includes(card.id);
    if (isSeReviewBatch) {
      const isSeTicked = Boolean(seTickedByCardId[String(card.id)]);
      if (!isSeUploadDone) return isSeTicked;
      return Boolean(seApprovedByCardId[String(card.id)]) && isSeTicked;
    }
    return selectedActionCardIds.includes(card.id);
  };

  const getToggleSelectForAction = () => {
    if (isSendSeBatch) return toggleSeCardTick;
    if (isSeReviewBatch) return (card) => toggleSeReviewCard(card.id, { isSeUploadDone });
    return onToggleCardSelect;
  };

  /* Drag-select only drives the board-wide selection; the per-batch SE ticks stay click-only. */
  const isBoardSelection = !isSendSeBatch && !isSeReviewBatch;

  const toggleSeCardTick = (card) =>
    setSeTickedCardIds((prev) =>
      prev.includes(card.id) ? prev.filter((id) => id !== card.id) : [...prev, card.id]
    );

  const tickedSeCards = batch.cards.filter((card) => seTickedCardIds.includes(card.id));

  const handleSendSeRequest = () => onSendSeRequest?.({ ...batch, cards: tickedSeCards });

  return (
    <div
      className={`batch-group ${isUngrouped ? "batch-group--loose" : ""} ${
        isExpanded ? "" : "batch-group--collapsed"
      } ${isSeReviewBatch && isSeUploadDone ? "batch-group--se-review" : ""}`}
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

          {isPoRequestBatch ? (
            <button
              type="button"
              className="batch-group__action"
              onClick={() => onRequestPo?.(batch)}
            >
              Request PO
            </button>
          ) : !isSeFlowBatch ? null : isAwaitingSeColumn && isSeUploadDone ? (
            <button
              type="button"
              className="batch-group__action"
              onClick={() => openSeReviewMoveModal({ ...batch, batchId })}
            >
              Review and Move
            </button>
          ) : isAwaitingSeColumn ? (
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
              onClick={handleSendSeRequest}
              disabled={!tickedSeCards.length}
            >
              Send For SE creation
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
              isSelectedForAction={getIsSelectedForAction(card)}
              onToggleSelectForAction={getToggleSelectForAction()}
              onSelectDragStart={isBoardSelection ? onCardSelectDragStart : undefined}
              onSelectDragEnter={isBoardSelection ? onCardSelectDragEnter : undefined}
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
  onCardSelectDragStart: PropTypes.func,
  onCardSelectDragEnter: PropTypes.func,
  setSelectedCard: PropTypes.func,
  onSendSeRequest: PropTypes.func,
  onUploadSeApproval: PropTypes.func,
  onUploadInvoice: PropTypes.func,
  onRequestPo: PropTypes.func,
};
