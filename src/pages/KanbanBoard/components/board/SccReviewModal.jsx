import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { FiAlertTriangle, FiCheck, FiFileText, FiLayers, FiX } from "react-icons/fi";
import CustomModal from "@/components/CustomModal";
import useSccReviewStore from "@/shared/store/sccReviewStore";
import { notify } from "@/components/Toaster";
import MaterialTablePagination from "../../CardFormTabs/Import/tabs/husbandry/components/MaterialTablePagination";
import "@/design/scss/blockers-modal.scss";
import "@/design/scss/pages/kanban-board/seReviewMoveModal.scss";
import "@/design/scss/pages/kanban-board/arInvoiceReviewModal.scss";
import "@/design/scss/pages/kanban-board/poReviewModal.scss";

/* Review table columns, in display order. */
const COLUMNS = [
  { name: "sales_orders", label: "Sales Order" },
  { name: "signed_so", label: "Signed SO" },
  { name: "scc", label: "SCC" },
  { name: "approval_email", label: "Approval Email" },
];

const REVIEW_PAGE_SIZE = 20;

// Opened after an L&T "SCC Received" bulk upload. One row per card with the signed SO, SCC and
// approval email placed on it; cards with everything placed start ticked. Confirm sends the ticked
// cards to da/confirm_scc_documents, which moves them on (moved_to_da).
const SccReviewModal = ({ onConfirmed }) => {
  const show = useSccReviewStore((state) => state.showSccReviewModal);
  const cards = useSccReviewStore((state) => state.selectedSccReviewCards);
  const notPlacedFiles = useSccReviewStore((state) => state.selectedSccReviewNotPlacedFiles);
  const onClose = useSccReviewStore((state) => state.closeSccReviewModal);
  const isConfirming = useSccReviewStore((state) => state.isConfirmingScc);
  const confirmSccDocuments = useSccReviewStore((state) => state.confirmSccDocuments);
  const isLoading = useSccReviewStore((state) => state.isSccReviewLoading);
  const fetchSccReview = useSccReviewStore((state) => state.fetchSccReview);

  const [uncheckedCardIds, setUncheckedCardIds] = useState({});
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!show) return;
    setUncheckedCardIds({});
    setCurrentPage(1);
    fetchSccReview().then((errorMessage) => {
      if (errorMessage) notify(errorMessage, "error");
    });
  }, [show, fetchSccReview]);

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
    const { errorMessage, result } = await confirmSccDocuments(payload);
    if (errorMessage) {
      notify(errorMessage, "error");
      return;
    }
    const movedCount = result?.moved_to_da?.length ?? payload.length;
    const notMovedCount = result?.not_moved?.length ?? 0;
    notify(`${movedCount} ${movedCount === 1 ? "card" : "cards"} confirmed and moved on`, "success");
    if (notMovedCount) {
      notify(`${notMovedCount} ${notMovedCount === 1 ? "card was" : "cards were"} not moved`, "error");
    }
    onClose();
    onConfirmed?.();
  };

  /* The document name, linked to the file when there is one. */
  const renderDocument = (document) => {
    if (!document) return <span className="ar-invoice-review__missing">Not uploaded</span>;
    const label = document.name || "View";
    if (!document.url) return label;
    return (
      <a href={document.url} target="_blank" rel="noopener noreferrer" className="po-review__file-link">
        <FiFileText size={14} aria-hidden />
        {label}
      </a>
    );
  };

  const renderSalesOrders = (card) => {
    const salesOrders = (card.sales_orders ?? []).map((salesOrder) =>
      typeof salesOrder === "object" ? salesOrder.sales_order_no : salesOrder
    );
    return salesOrders.length ? salesOrders.join(", ") : "-";
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
          title={
            card.ready ? undefined : "The signed SO, SCC and approval email are needed before this card can be confirmed"
          }
          aria-label={`Select card ${card.card_id}`}
        />
      </td>
      <td>{renderSalesOrders(card)}</td>
      <td>{renderDocument(card.documents?.signed_so)}</td>
      <td>{renderDocument(card.documents?.scc)}</td>
      <td>{renderDocument(card.documents?.approval_email)}</td>
    </tr>
  );

  const renderBody = () => (
    <>
      <div className="blockers-toolbar-section">
        <div className="se-review-move-batch">
          <FiLayers className="se-review-move-batch__icon" />
          <span className="se-review-move-batch__caption">Cards:</span>
          <span className="se-review-move-batch__title">{cards.length}</span>
          <span className="se-review-move-batch__count">
            {checkedCards.length} selected
            {isLoading ? " (refreshing...)" : ""}
          </span>
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
              const fileName = typeof file === "object" ? file.file_name : file;
              return (
                <li key={`${fileName}-${index}`}>
                  <strong>{fileName}</strong>
                  {file?.reason ? ` - ${file.reason}` : ""}
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
                  <td colSpan={COLUMNS.length + 1} className="ar-invoice-review__empty">
                    {isLoading ? "Loading..." : "No cards to review"}
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
        <h5 className="blockers-modal-title">SCC Review</h5>
        <p className="blockers-modal-subtitle">Check the documents, then confirm the ticked cards</p>
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
        disabled={isConfirming || isLoading || !checkedCards.length}
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

SccReviewModal.propTypes = {
  onConfirmed: PropTypes.func,
};

export default SccReviewModal;
