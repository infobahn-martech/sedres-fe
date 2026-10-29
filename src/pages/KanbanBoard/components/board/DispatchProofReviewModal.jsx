import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { FiAlertTriangle, FiCheck, FiFileText, FiLayers, FiX } from "react-icons/fi";
import CustomModal from "@/components/CustomModal";
import useDispatchProofReviewStore from "@/shared/store/dispatchProofReviewStore";
import { notify } from "@/components/Toaster";
import MaterialTablePagination from "../../CardFormTabs/Import/tabs/husbandry/components/MaterialTablePagination";
import "@/design/scss/blockers-modal.scss";
import "@/design/scss/pages/kanban-board/seReviewMoveModal.scss";
import "@/design/scss/pages/kanban-board/arInvoiceReviewModal.scss";
import "@/design/scss/pages/kanban-board/poReviewModal.scss";

/* Review table columns, in display order (plus the card tick before them). */
const COLUMNS = [
  { name: "invoice_no", label: "Invoice No" },
  { name: "proof", label: "Dispatch Proof" },
];

const REVIEW_PAGE_SIZE = 20;

// Opened after an L&T "Uploaded to Portal" bulk dispatch proof upload. One row per card with the
// invoice number(s) and the proof identified for it; cards with a proof start ticked. Confirm sends the
// ticked cards to da/confirm_dispatch_proofs, which moves them to "Dispatch Proof Uploaded".
const DispatchProofReviewModal = ({ onConfirmed }) => {
  const show = useDispatchProofReviewStore((state) => state.showDispatchProofReviewModal);
  const cards = useDispatchProofReviewStore((state) => state.selectedDispatchProofReviewCards);
  const notPlacedFiles = useDispatchProofReviewStore(
    (state) => state.selectedDispatchProofReviewNotPlacedFiles
  );
  const onClose = useDispatchProofReviewStore((state) => state.closeDispatchProofReviewModal);
  const isConfirming = useDispatchProofReviewStore((state) => state.isConfirmingDispatchProofs);
  const confirmDispatchProofs = useDispatchProofReviewStore((state) => state.confirmDispatchProofs);

  const columnCount = COLUMNS.length + 1;

  const [uncheckedCardIds, setUncheckedCardIds] = useState({});
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!show) return;
    setUncheckedCardIds({});
    setCurrentPage(1);
  }, [show]);

  const isCardChecked = (card) => Boolean(card.ready) && !uncheckedCardIds[card.card_id];

  const toggleCard = (card) =>
    setUncheckedCardIds((prev) => ({ ...prev, [card.card_id]: !prev[card.card_id] }));

  const checkedCards = cards.filter(isCardChecked);

  const totalPages = Math.max(1, Math.ceil(cards.length / REVIEW_PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const pageCards = cards.slice((page - 1) * REVIEW_PAGE_SIZE, page * REVIEW_PAGE_SIZE);

  const readyCards = cards.filter((card) => card.ready);
  const isAllChecked = readyCards.length > 0 && checkedCards.length === readyCards.length;
  const isSomeChecked = checkedCards.length > 0 && !isAllChecked;

  const toggleAllCards = () =>
    setUncheckedCardIds(
      isAllChecked ? Object.fromEntries(readyCards.map((card) => [card.card_id, true])) : {}
    );

  const handleConfirm = async () => {
    if (isConfirming || !checkedCards.length) return;
    const payload = checkedCards.map((card) => ({ call_id: card.call_id, card_id: card.card_id }));
    const { errorMessage, result } = await confirmDispatchProofs(payload);
    if (errorMessage) {
      notify(errorMessage, "error");
      return;
    }
    const movedCount = result?.moved_to_dispatched?.length ?? payload.length;
    notify(
      `${movedCount} ${movedCount === 1 ? "card" : "cards"} moved to Dispatch Proof Uploaded`,
      "success"
    );
    onClose();
    onConfirmed?.(payload);
  };

  /* The proof's file name, linked to the file when there is a link. */
  const renderProof = (card) => {
    if (!card.proof) return <span className="ar-invoice-review__missing">Not identified</span>;
    const label = card.proof.name || "View proof";
    if (!card.proof.url) return label;
    return (
      <a
        href={card.proof.url}
        target="_blank"
        rel="noopener noreferrer"
        className="po-review__file-link"
      >
        <FiFileText size={14} aria-hidden />
        {label}
      </a>
    );
  };

  const renderCardRow = (card) => (
    <tr key={card.card_id ?? card.call_id}>
      <td className="ar-invoice-review__card-cell">
        <input
          type="checkbox"
          className="form-check-input ar-invoice-review__checkbox"
          checked={isCardChecked(card)}
          onChange={() => toggleCard(card)}
          disabled={!card.ready || isConfirming}
          title={card.ready ? undefined : "No dispatch proof was identified for this card"}
          aria-label={`Select card ${card.card_id}`}
        />
      </td>
      <td>{(card.invoice_nos ?? []).join(", ") || "-"}</td>
      <td>{renderProof(card)}</td>
    </tr>
  );

  const renderBody = () => (
    <>
      <div className="blockers-toolbar-section">
        <div className="se-review-move-batch">
          <FiLayers className="se-review-move-batch__icon" />
          <span className="se-review-move-batch__caption">Cards:</span>
          <span className="se-review-move-batch__title">{cards.length}</span>
          <span className="se-review-move-batch__count">{checkedCards.length} selected</span>
        </div>
      </div>

      {notPlacedFiles.length > 0 && (
        <div className="po-review__not-placed">
          <div className="po-review__not-placed-title">
            <FiAlertTriangle size={14} aria-hidden />
            {notPlacedFiles.length} {notPlacedFiles.length === 1 ? "file was" : "files were"} not placed
          </div>
          <ul className="po-review__not-placed-list">
            {notPlacedFiles.map((file, index) => {
              const fileName = typeof file === "string" ? file : file?.file_name;
              const reason = typeof file === "string" ? "" : file?.reason;
              return (
                <li key={`${fileName}-${index}`}>
                  <strong>{fileName}</strong>
                  {reason ? ` - ${reason}` : ""}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="blockers-table-section">
        <div className="blockers-table-wrapper">
          <table className="blockers-table ar-invoice-review__grid">
            <thead>
              <tr>
                <th className="ar-invoice-review__card-head">
                  <input
                    type="checkbox"
                    className="form-check-input ar-invoice-review__checkbox"
                    checked={isAllChecked}
                    ref={(element) => {
                      if (element) element.indeterminate = isSomeChecked;
                    }}
                    onChange={toggleAllCards}
                    disabled={!readyCards.length || isConfirming}
                    aria-label="Select all cards"
                  />
                </th>
                {COLUMNS.map((column) => (
                  <th key={column.name}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cards.length ? (
                pageCards.map(renderCardRow)
              ) : (
                <tr>
                  <td colSpan={columnCount} className="ar-invoice-review__empty">
                    No cards to review
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="ar-invoice-review__pagination">
          <MaterialTablePagination
            page={page}
            total={cards.length}
            limit={REVIEW_PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>
    </>
  );

  const renderHeader = () => (
    <div className="blockers-modal-header">
      <div className="blockers-modal-header-text">
        <h5 className="blockers-modal-title">Dispatch Proof Review</h5>
        <p className="blockers-modal-subtitle">Check the dispatch proofs, then confirm the ticked cards</p>
      </div>
      <button
        type="button"
        className="blockers-modal-close"
        onClick={onClose}
        disabled={isConfirming}
        aria-label="Close"
      >
        <FiX size={20} />
      </button>
    </div>
  );

  const renderFooter = () => (
    <div className="modal-footer se-review-move-footer">
      <button type="button" className="btn btn-outline" onClick={onClose} disabled={isConfirming}>
        Close
      </button>
      <button
        type="button"
        className="btn btn-primary"
        onClick={handleConfirm}
        disabled={isConfirming || !checkedCards.length}
      >
        <FiCheck className="me-2" />
        {isConfirming ? "Confirming..." : `Confirm (${checkedCards.length})`}
      </button>
    </div>
  );

  return (
    <CustomModal
      show={show}
      closeModal={onClose}
      className="blockers-modal se-review-move-modal ar-invoice-review-modal po-review-modal"
      backdropClassName="blockers-modal-backdrop"
      createModal
      bodyClassname="blockers-modal-body"
      header={renderHeader()}
      body={renderBody()}
      footer={renderFooter()}
    />
  );
};

DispatchProofReviewModal.propTypes = {
  onConfirmed: PropTypes.func,
};

export default DispatchProofReviewModal;
