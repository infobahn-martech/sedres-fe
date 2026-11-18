import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { FiCheck, FiEye, FiLayers, FiX } from "react-icons/fi";
import CustomModal from "@/components/CustomModal";
import useLntArInvoiceStore from "@/store/lntArInvoiceStore";
import useBatchMoveStore from "@/store/batchMoveStore";
import { notify } from "@/components/Toaster";
import { viewUploadedFile } from "@/shared/utils/viewUploadedFile";
import MaterialTablePagination from "../../CardFormTabs/Import/tabs/husbandry/components/MaterialTablePagination";
import "@/design/scss/blockers-modal.scss";
import "@/design/scss/pages/kanban-board/seReviewMoveModal.scss";
import "@/design/scss/pages/kanban-board/arInvoiceReviewModal.scss";
import "@/design/scss/pages/kanban-board/lntArInvoiceReviewModal.scss";

const REVIEW_PAGE_SIZE = 20;

/* One option per card + sales order; the same sales order number can be offered on several cards. */
const getOptionKey = (option) => `${option.card_id}:${option.sales_order_no}`;

// Opened after an L&T "Received from Ops" bulk invoice upload. One row per identified invoice: its
// QR code state, the invoice file and a dropdown of the sales orders it can go on, picked by the
// user. An invoice without a QR code cannot be confirmed, so its card stays in Received from Ops.
// Confirm sends the picked sales orders, grouped by card, to da/confirm_ar_invoices.
const LntArInvoiceReviewModal = ({ onConfirmed }) => {
  const show = useLntArInvoiceStore((state) => state.showArInvoiceReviewModal);
  const invoices = useLntArInvoiceStore((state) => state.selectedArInvoiceReviewInvoices);
  const onClose = useLntArInvoiceStore((state) => state.closeArInvoiceReviewModal);
  const isConfirming = useLntArInvoiceStore((state) => state.isConfirmingArInvoices);
  const confirmArInvoices = useLntArInvoiceStore((state) => state.confirmArInvoices);
  const clearCardColumns = useBatchMoveStore((state) => state.clearCardColumns);

  /* { [invoice_id]: optionKey } — the sales order the user picked for each invoice. */
  const [pickedOptionKeys, setPickedOptionKeys] = useState({});
  /* Only the user's own unticks are tracked; an invoice with a QR code and a picked SO starts ticked. */
  const [uncheckedInvoiceIds, setUncheckedInvoiceIds] = useState({});
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!show) return;
    setPickedOptionKeys({});
    setUncheckedInvoiceIds({});
    setCurrentPage(1);
  }, [show]);

  /* An invoice with a single sales order option has it selected already; once the user touches the
     dropdown their choice (even "Select SO") is kept. */
  const getSelectedOptionKey = (invoice) => {
    const options = invoice.sales_order_options ?? [];
    return pickedOptionKeys[invoice.invoice_id] ?? (options.length === 1 ? getOptionKey(options[0]) : "");
  };

  const getPickedOption = (invoice) =>
    (invoice.sales_order_options ?? []).find(
      (option) => getOptionKey(option) === getSelectedOptionKey(invoice)
    );

  const isConfirmable = (invoice) => Boolean(invoice.qr_code_present) && Boolean(getPickedOption(invoice));
  const isChecked = (invoice) => isConfirmable(invoice) && !uncheckedInvoiceIds[invoice.invoice_id];

  const toggleInvoice = (invoice) =>
    setUncheckedInvoiceIds((prev) => ({ ...prev, [invoice.invoice_id]: !prev[invoice.invoice_id] }));

  const checkedInvoices = invoices.filter(isChecked);
  const confirmableInvoices = invoices.filter(isConfirmable);
  const isAllChecked = confirmableInvoices.length > 0 && checkedInvoices.length === confirmableInvoices.length;
  const isSomeChecked = checkedInvoices.length > 0 && !isAllChecked;

  const toggleAllInvoices = () =>
    setUncheckedInvoiceIds(
      isAllChecked
        ? Object.fromEntries(confirmableInvoices.map((invoice) => [invoice.invoice_id, true]))
        : {}
    );

  const totalPages = Math.max(1, Math.ceil(invoices.length / REVIEW_PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const pageInvoices = invoices.slice((page - 1) * REVIEW_PAGE_SIZE, page * REVIEW_PAGE_SIZE);

  /* The ticked invoices grouped by the card their picked sales order belongs to. */
  const buildConfirmPayload = () => {
    const cardsById = new Map();
    checkedInvoices.forEach((invoice) => {
      const option = getPickedOption(invoice);
      if (!cardsById.has(option.card_id)) {
        cardsById.set(option.card_id, {
          call_id: option.call_id,
          card_id: option.card_id,
          sales_orders: [],
        });
      }
      cardsById.get(option.card_id).sales_orders.push({
        sales_order_no: option.sales_order_no,
        invoice_id: invoice.invoice_id,
      });
    });
    return [...cardsById.values()];
  };

  const handleConfirm = async () => {
    if (isConfirming || !checkedInvoices.length) return;
    const payload = buildConfirmPayload();
    const { errorMessage, result } = await confirmArInvoices(payload);
    if (errorMessage) {
      notify(errorMessage, "error");
      return;
    }
    const moved = result?.card_positions;
    const movedCount = Array.isArray(moved) ? moved.length : payload.length;
    const column = moved?.[0]?.column_name;
    notify(
      `${movedCount} ${movedCount === 1 ? "card" : "cards"} ${column ? `moved to ${column}` : "confirmed"}`,
      "success"
    );
    clearCardColumns(payload.map((card) => card.card_id));
    onClose();
    onConfirmed?.();
  };

  const renderRow = (invoice) => {
    const hasQr = Boolean(invoice.qr_code_present);
    const options = invoice.sales_order_options ?? [];
    return (
      <tr key={invoice.invoice_id} className={hasQr ? undefined : "lnt-invoice-review__row--no-qr"}>
        <td className="ar-invoice-review__card-cell">
          <input
            type="checkbox"
            className="form-check-input ar-invoice-review__checkbox"
            checked={isChecked(invoice)}
            onChange={() => toggleInvoice(invoice)}
            disabled={!isConfirmable(invoice) || isConfirming}
            title={
              hasQr
                ? isConfirmable(invoice)
                  ? undefined
                  : "Select a sales order for this invoice first"
                : "No QR code: this card stays in Received from Ops"
            }
            aria-label={`Select invoice ${invoice.invoice_no}`}
          />
        </td>
        <td>{invoice.invoice_no || "-"}</td>
        <td>
          <select
            className="form-select form-select-sm lnt-invoice-review__so-select"
            value={getSelectedOptionKey(invoice)}
            onChange={(e) =>
              setPickedOptionKeys((prev) => ({ ...prev, [invoice.invoice_id]: e.target.value }))
            }
            disabled={!hasQr || isConfirming}
            aria-label={`Sales order for invoice ${invoice.invoice_no}`}
          >
            <option value="">Select SO</option>
            {options.map((option) => (
              <option key={getOptionKey(option)} value={getOptionKey(option)}>
                {option.sales_order_no}
              </option>
            ))}
          </select>
        </td>
        <td>
          <span className={hasQr ? "lnt-invoice-review__qr--yes" : "lnt-invoice-review__qr--no"}>
            {hasQr ? "Present" : "Not present"}
          </span>
        </td>
        <td>
          <button
            type="button"
            className="se-review-move-view-btn"
            onClick={() => viewUploadedFile(invoice.file_url)}
            disabled={!invoice.file_url}
            title={invoice.file_url ? "View the uploaded invoice" : "No uploaded invoice"}
          >
            <FiEye size={14} />
            View
          </button>
        </td>
      </tr>
    );
  };

  const renderBody = () => (
    <>
      <div className="blockers-toolbar-section">
        <div className="se-review-move-batch">
          <FiLayers className="se-review-move-batch__icon" />
          <span className="se-review-move-batch__caption">Invoices:</span>
          <span className="se-review-move-batch__title">{invoices.length}</span>
          <span className="se-review-move-batch__count">{checkedInvoices.length} selected</span>
        </div>
      </div>

      <div className="blockers-table-section">
        <div className="blockers-table-wrapper">
          <table className="blockers-table ar-invoice-review__grid lnt-invoice-review__grid">
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
                    onChange={toggleAllInvoices}
                    disabled={!confirmableInvoices.length || isConfirming}
                    aria-label="Select all invoices"
                  />
                </th>
                <th>Invoice No</th>
                <th>SO</th>
                <th>QR Code</th>
                <th>Invoice File</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length ? (
                pageInvoices.map(renderRow)
              ) : (
                <tr>
                  <td colSpan={5} className="ar-invoice-review__empty">
                    No invoices to review
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="ar-invoice-review__pagination">
          <MaterialTablePagination
            page={page}
            total={invoices.length}
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
        <h5 className="blockers-modal-title">Invoice Review</h5>
        <p className="blockers-modal-subtitle">
          Select the sales order for each invoice, then confirm the ticked invoices
        </p>
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
        disabled={isConfirming || !checkedInvoices.length}
      >
        <FiCheck className="me-2" />
        {isConfirming ? "Confirming..." : `Confirm (${checkedInvoices.length})`}
      </button>
    </div>
  );

  return (
    <CustomModal
      show={show}
      closeModal={onClose}
      className="blockers-modal se-review-move-modal ar-invoice-review-modal"
      backdropClassName="blockers-modal-backdrop"
      createModal
      bodyClassname="blockers-modal-body"
      header={renderHeader()}
      body={renderBody()}
      footer={renderFooter()}
    />
  );
};

LntArInvoiceReviewModal.propTypes = {
  onConfirmed: PropTypes.func,
};

export default LntArInvoiceReviewModal;
