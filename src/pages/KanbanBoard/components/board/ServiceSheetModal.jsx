import { Fragment, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { FiCheck, FiLayers, FiX } from "react-icons/fi";
import CustomModal from "@/components/CustomModal";
import useServiceSheetStore from "@/shared/store/serviceSheetStore";
import { notify } from "@/components/Toaster";
import { downloadFile } from "@/shared/utils/utils";
import "@/design/scss/blockers-modal.scss";
import "@/design/scss/pages/kanban-board/seReviewMoveModal.scss";
import "@/design/scss/pages/kanban-board/arInvoiceReviewModal.scss";

const COLUMNS = [
  { name: "sales_order", label: "Sales Order" },
  { name: "invoice_no", label: "Invoice No" },
  { name: "service_sheet_no", label: "Service Sheet No" },
];

const getSalesOrderKey = (card, salesOrder) => `${card.card_id}:${salesOrder.sales_order_no}`;

// Opened from the "AR Invoice Issued" column's "Enter Service Sheet No" button. One input per ticked
// card's sales order, with the invoice no shown read-only. Save sends the typed numbers to
// da/save_service_sheets.
const ServiceSheetModal = ({ onSaved }) => {
  const show = useServiceSheetStore((state) => state.showServiceSheetModal);
  const rows = useServiceSheetStore((state) => state.selectedServiceSheetCards);
  const onClose = useServiceSheetStore((state) => state.closeServiceSheetModal);
  const isSaving = useServiceSheetStore((state) => state.isSavingServiceSheets);
  const saveServiceSheets = useServiceSheetStore((state) => state.saveServiceSheets);

  const [serviceSheetByKey, setServiceSheetByKey] = useState({});

  useEffect(() => {
    if (!show) return;
    setServiceSheetByKey({});
  }, [show]);

  const setServiceSheet = (key, value) =>
    setServiceSheetByKey((prev) => ({ ...prev, [key]: value }));

  /* Only the sales orders the user typed a number for are sent. */
  const payload = rows
    .map((card) => ({
      call_id: card.call_id,
      card_id: card.card_id,
      sales_orders: card.sales_orders
        .map((salesOrder) => ({
          sales_order_no: salesOrder.sales_order_no,
          service_sheet_no: (serviceSheetByKey[getSalesOrderKey(card, salesOrder)] ?? "").trim(),
        }))
        .filter((salesOrder) => salesOrder.service_sheet_no),
    }))
    .filter((card) => card.sales_orders.length);
  const enteredCount = payload.reduce((sum, card) => sum + card.sales_orders.length, 0);

  const handleSave = async () => {
    if (isSaving || !payload.length) return;
    const { errorMessage, result } = await saveServiceSheets(payload);
    if (errorMessage) {
      notify(errorMessage, "error");
      return;
    }
    notify(
      `${enteredCount} service sheet ${enteredCount === 1 ? "number" : "numbers"} saved`,
      "success"
    );
    const movedCount = result?.moved_to_invoice_submitted?.length ?? 0;
    if (movedCount) {
      notify(`${movedCount} ${movedCount === 1 ? "card" : "cards"} moved to Invoice Submitted to Portal`, "success");
    }
    /* The full invoices zip only exists once the cards have moved, so it comes from this response. */
    const fullInvoicesZip = result?.full_invoices_zip;
    if (fullInvoicesZip?.url) {
      downloadFile({
        link: fullInvoicesZip.url,
        fileName: fullInvoicesZip.name || decodeURIComponent(fullInvoicesZip.url.split("/").pop()),
      });
    }
    onClose();
    onSaved?.();
  };

  const renderCardRows = (card) => {
    const salesOrders = card.sales_orders.length ? card.sales_orders : [null];
    return salesOrders.map((salesOrder, rowIndex) => (
      <tr key={salesOrder ? getSalesOrderKey(card, salesOrder) : `${card.card_id}:empty`}>
        {rowIndex === 0 && (
          <td rowSpan={salesOrders.length}>{card.card_id}</td>
        )}
        {!salesOrder && (
          <td colSpan={COLUMNS.length} className="ar-invoice-review__empty">
            No sales orders
          </td>
        )}
        {salesOrder && (
          <>
            <td>{salesOrder.sales_order_no || "-"}</td>
            <td>{salesOrder.invoice_no || "-"}</td>
            <td>
              <input
                type="text"
                className="form-control form-control-sm"
                value={serviceSheetByKey[getSalesOrderKey(card, salesOrder)] ?? ""}
                onChange={(event) => setServiceSheet(getSalesOrderKey(card, salesOrder), event.target.value)}
                disabled={isSaving}
                aria-label={`Service sheet no for ${salesOrder.sales_order_no}`}
              />
            </td>
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
          <span className="se-review-move-batch__title">{rows.length}</span>
          <span className="se-review-move-batch__count">{enteredCount} entered</span>
        </div>
      </div>

      <div className="blockers-table-section">
        <div className="blockers-table-wrapper">
          <table className="blockers-table ar-invoice-review__grid">
            <thead>
              <tr>
                <th>Card</th>
                {COLUMNS.map((column) => (
                  <th key={column.name}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((card) => <Fragment key={card.card_id}>{renderCardRows(card)}</Fragment>)
              ) : (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="ar-invoice-review__empty">
                    No sales orders
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
        <h5 className="blockers-modal-title">Enter Service Sheet No</h5>
        <p className="blockers-modal-subtitle">Type the service sheet no for each sales order</p>
      </div>
      <button
        type="button"
        className="blockers-modal-close"
        onClick={onClose}
        disabled={isSaving}
        aria-label="Close"
      >
        <FiX size={20} />
      </button>
    </div>
  );

  const renderFooter = () => (
    <div className="modal-footer se-review-move-footer">
      <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSaving}>
        Close
      </button>
      <button
        type="button"
        className="btn btn-primary"
        onClick={handleSave}
        disabled={isSaving || !payload.length}
      >
        <FiCheck className="me-2" />
        {isSaving ? "Saving..." : "Save"}
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

ServiceSheetModal.propTypes = {
  onSaved: PropTypes.func,
};

export default ServiceSheetModal;
