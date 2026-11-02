import { Fragment, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { FiAlertTriangle, FiCheck, FiLayers, FiX } from "react-icons/fi";
import CustomModal from "@/components/CustomModal";
import useLamprellUaePoApprovalStore from "@/store/lamprellUaePoApprovalStore";
import { notify } from "@/components/Toaster";
import "@/design/scss/blockers-modal.scss";
import "@/design/scss/pages/kanban-board/seReviewMoveModal.scss";
import "@/design/scss/pages/kanban-board/arInvoiceReviewModal.scss";
import "@/design/scss/pages/kanban-board/lamprellUaePoReviewModal.scss";

/* Editable review columns, in display order; name is the da/confirm_po_approval field. */
const COLUMNS = [
  { name: "sales_order_no", label: "SO No" },
  { name: "po_number", label: "PO #" },
  { name: "received_qty", label: "Received Qty" },
  { name: "srn_no", label: "SRN No" },
];

// Opened after a Lamprell UAE "Upload PO" (pre-filled from the client's reply) or with no file (blank rows).
// One row per sales order, every field editable. Confirm sends the ticked cards to da/confirm_po_approval.
const LamprellUaePoReviewModal = ({ onConfirmed }) => {
  const show = useLamprellUaePoApprovalStore((state) => state.showPoReviewModal);
  const reviewCards = useLamprellUaePoApprovalStore((state) => state.poReviewCards);
  const onClose = useLamprellUaePoApprovalStore((state) => state.closePoReviewModal);
  const isConfirming = useLamprellUaePoApprovalStore((state) => state.isPoConfirming);
  const confirmPo = useLamprellUaePoApprovalStore((state) => state.confirmPo);

  const [cards, setCards] = useState([]);
  const [uncheckedCardIds, setUncheckedCardIds] = useState({});

  useEffect(() => {
    if (!show) return;
    setCards(reviewCards);
    setUncheckedCardIds({});
  }, [show, reviewCards]);

  const isCardChecked = (card) => !uncheckedCardIds[card.card_id];
  const checkedCards = cards.filter(isCardChecked);
  const isAllChecked = cards.length > 0 && checkedCards.length === cards.length;
  const isSomeChecked = checkedCards.length > 0 && !isAllChecked;

  const toggleCard = (card) => setUncheckedCardIds((prev) => ({ ...prev, [card.card_id]: !prev[card.card_id] }));

  const toggleAllCards = () =>
    setUncheckedCardIds(isAllChecked ? Object.fromEntries(cards.map((card) => [card.card_id, true])) : {});

  const updateField = (cardId, rowIndex, name, value) =>
    setCards((prev) =>
      prev.map((card) =>
        card.card_id === cardId
          ? {
              ...card,
              sales_orders: card.sales_orders.map((salesOrder, index) =>
                index === rowIndex ? { ...salesOrder, [name]: value } : salesOrder
              ),
            }
          : card
      )
    );

  const handleConfirm = async () => {
    if (isConfirming || !checkedCards.length) return;
    const payload = checkedCards.map((card) => ({
      call_id: card.call_id,
      card_id: card.card_id,
      sales_orders: card.sales_orders.map((salesOrder) =>
        Object.fromEntries(COLUMNS.map((column) => [column.name, String(salesOrder[column.name] ?? "").trim()]))
      ),
    }));
    const { ok, message, result } = await confirmPo(payload);
    if (!ok) {
      notify(message, "error");
      return;
    }
    const movedToDaCount = result?.moved_to_da?.length ?? 0;
    const movedCount = movedToDaCount || (result?.moved_to_po_received?.length ?? payload.length);
    notify(
      `${movedCount} ${movedCount === 1 ? "card" : "cards"} moved to ${movedToDaCount ? "the DA board" : "PO Received"}`,
      "success"
    );
    onConfirmed?.(payload.map((card) => card.card_id));
  };

  const renderCardRows = (card) =>
    card.sales_orders.map((salesOrder, rowIndex) => (
      <tr key={`${card.card_id}:${rowIndex}`}>
        {rowIndex === 0 && (
          <td rowSpan={card.sales_orders.length} className="ar-invoice-review__card-cell">
            <input
              type="checkbox"
              className="form-check-input ar-invoice-review__checkbox"
              checked={isCardChecked(card)}
              onChange={() => toggleCard(card)}
              disabled={isConfirming}
              aria-label={`Select card ${card.card_id}`}
            />
          </td>
        )}
        {COLUMNS.map((column) => (
          <td key={column.name}>
            <input
              type="text"
              className="form-control form-control-sm ar-invoice-review__input"
              value={salesOrder[column.name] ?? ""}
              onChange={(event) => updateField(card.card_id, rowIndex, column.name, event.target.value)}
              disabled={isConfirming}
              aria-label={`${column.label} for card ${card.card_id}`}
            />
            {column.name === "srn_no" && salesOrder.srn_used_by?.used_on && (
              <div className="ar-invoice-review__missing">
                <FiAlertTriangle size={12} aria-hidden /> Already used on {salesOrder.srn_used_by.used_on}
              </div>
            )}
          </td>
        ))}
      </tr>
    ));

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
                    disabled={!cards.length || isConfirming}
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
                cards.map((card) => <Fragment key={card.card_id}>{renderCardRows(card)}</Fragment>)
              ) : (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="ar-invoice-review__empty">
                    No cards to review
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  const renderHeader = () => (
    <div className="blockers-modal-header">
      <div className="blockers-modal-header-text">
        <h5 className="blockers-modal-title">PO Review</h5>
        <p className="blockers-modal-subtitle">Check or edit the PO details, then confirm the ticked cards</p>
      </div>
      <button type="button" className="blockers-modal-close" onClick={onClose} disabled={isConfirming} aria-label="Close">
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
      className="blockers-modal se-review-move-modal ar-invoice-review-modal lamprell-uae-po-review-modal"
      backdropClassName="blockers-modal-backdrop"
      createModal
      bodyClassname="blockers-modal-body"
      header={renderHeader()}
      body={renderBody()}
      footer={renderFooter()}
    />
  );
};

LamprellUaePoReviewModal.propTypes = {
  onConfirmed: PropTypes.func,
};

export default LamprellUaePoReviewModal;
