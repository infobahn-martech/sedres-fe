import { Fragment, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { FiAlertTriangle, FiCheck, FiFileText, FiLayers, FiX } from "react-icons/fi";
import CustomModal from "../../../../components/CustomModal";
import usePoReviewStore from "../../../../shared/store/poReviewStore";
import { notify } from "../../../../components/Toaster";
import MaterialTablePagination from "../../CardFormTabs/Import/tabs/husbandry/components/MaterialTablePagination";
import "../../../../design/scss/blockers-modal.scss";
import "../../../../design/scss/pages/kanban-board/seReviewMoveModal.scss";
import "../../../../design/scss/pages/kanban-board/arInvoiceReviewModal.scss";
import "../../../../design/scss/pages/kanban-board/poReviewModal.scss";

/* Review table columns, in display order. */
const COLUMNS = [
  { name: "sales_order_invoice", label: "SO / Invoice No" },
  { name: "po", label: "PO" },
  { name: "pr_number", label: "PR" },
];

/* Cards per page in the review table, matching da/upload_pos' page size. */
const REVIEW_PAGE_SIZE = 20;

const getSalesOrderKey = (card, salesOrder) =>
  `${card.card_id}:${salesOrder.sales_order_id ?? salesOrder.sales_order_no}`;

// Opened after a McDermott "Requested PO" bulk PO upload. One row per sales order with the PO placed
// on it; cards with every PO placed start ticked. Confirm sends the ticked cards to da/confirm_pos,
// which moves them to "PO Received".
const PoReviewModal = ({ onConfirmed }) => {
  const show = usePoReviewStore((state) => state.showPoReviewModal);
  const cards = usePoReviewStore((state) => state.selectedPoReviewCards);
  const notPlacedFiles = usePoReviewStore((state) => state.selectedPoReviewNotPlacedFiles);
  const onClose = usePoReviewStore((state) => state.closePoReviewModal);
  const isConfirming = usePoReviewStore((state) => state.isConfirmingPos);
  const confirmPos = usePoReviewStore((state) => state.confirmPos);
  const isLoading = usePoReviewStore((state) => state.isPoReviewLoading);
  const fetchPoReview = usePoReviewStore((state) => state.fetchPoReview);

  /* The card tick comes before the configured columns. */
  const columnCount = COLUMNS.length + 1;

  const [uncheckedCardIds, setUncheckedCardIds] = useState({});
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!show) return;
    setUncheckedCardIds({});
    setCurrentPage(1);
    fetchPoReview().then((errorMessage) => {
      if (errorMessage) notify(errorMessage, "error");
    });
  }, [show, fetchPoReview]);

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
    const payload = checkedCards.map((card) => ({
      call_id: card.call_id,
      card_id: card.card_id,
      sales_orders: (card.sales_orders ?? []).map((salesOrder) => ({
        sales_order_id: salesOrder.sales_order_id,
        sales_order_no: salesOrder.sales_order_no,
        po_id: salesOrder.po?.po_id ?? null,
      })),
    }));
    const { errorMessage, result } = await confirmPos(payload);
    if (errorMessage) {
      notify(errorMessage, "error");
      return;
    }
    const movedCount = result?.moved_to_po_received?.length ?? payload.length;
    notify(`${movedCount} ${movedCount === 1 ? "card" : "cards"} moved to PO Received`, "success");
    onClose();
    onConfirmed?.();
  };

  const renderSalesOrderInvoice = (salesOrder) =>
    [salesOrder.sales_order_no, salesOrder.invoice_no].filter(Boolean).join(" / ") || "-";

  /* The PO number, linked to the PO file when there is one. */
  const renderPo = (salesOrder) => {
    if (!salesOrder.po) return <span className="ar-invoice-review__missing">Not uploaded</span>;
    const label = salesOrder.po.po_number || salesOrder.po.file_name || "View PO";
    if (!salesOrder.po.file_url) return label;
    return (
      <a
        href={salesOrder.po.file_url}
        target="_blank"
        rel="noopener noreferrer"
        className="po-review__file-link"
      >
        <FiFileText size={14} aria-hidden />
        {label}
      </a>
    );
  };

  /* One row per sales order; the card's tick cell spans all of the card's rows. */
  const renderCardRows = (card) => {
    const salesOrders = card.sales_orders?.length ? card.sales_orders : [null];
    return salesOrders.map((salesOrder, rowIndex) => (
      <tr key={salesOrder ? getSalesOrderKey(card, salesOrder) : `${card.card_id}:empty`}>
        {rowIndex === 0 && (
          <td rowSpan={salesOrders.length} className="ar-invoice-review__card-cell">
            <input
              type="checkbox"
              className="form-check-input ar-invoice-review__checkbox"
              checked={isCardChecked(card)}
              onChange={() => toggleCard(card)}
              disabled={!card.ready || isConfirming}
              title={card.ready ? undefined : "All sales orders need a PO before this card can be confirmed"}
              aria-label={`Select card ${card.card_id}`}
            />
          </td>
        )}
        {!salesOrder && (
          <td colSpan={columnCount - 1} className="ar-invoice-review__empty">
            No sales orders
          </td>
        )}
        {salesOrder && (
          <>
            <td>{renderSalesOrderInvoice(salesOrder)}</td>
            <td>{renderPo(salesOrder)}</td>
            <td>{salesOrder.po?.pr_number || "-"}</td>
          </>
        )}
      </tr>
    ));
  };

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
            {notPlacedFiles.map((file, index) => (
              <li key={`${file.file_name}-${index}`}>
                <strong>{file.file_name}</strong>
                {file.reason ? ` - ${file.reason}` : ""}
              </li>
            ))}
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
                pageCards.map((card) => (
                  <Fragment key={card.card_id ?? card.call_id}>{renderCardRows(card)}</Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={columnCount} className="ar-invoice-review__empty">
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
        <h5 className="blockers-modal-title">PO Review</h5>
        <p className="blockers-modal-subtitle">Check the POs, then confirm the ticked cards</p>
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

PoReviewModal.propTypes = {
  onConfirmed: PropTypes.func,
};

export default PoReviewModal;
