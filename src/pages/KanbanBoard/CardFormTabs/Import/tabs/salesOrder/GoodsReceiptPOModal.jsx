import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";

const formatCurrencySAR = (amount) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 2,
  }).format(amount || 0);

const TABS = ["Contents", "Logistics", "Accounting", "Attachments"];

// Goods Receipt PO (GRN) preview modal - opened via "Copy To" from GeneratePOModal.
// "Add & New" calls sales_order/generate_grn against the purchase_order_id captured when the
// source PO was submitted (poDetails.purchaseOrderId) — requires the PO to have been submitted first.
const GoodsReceiptPOModal = ({ show, onClose, poDetails, onCreateGRN, isSubmitting = false }) => {
  const computedTotalPaymentDue = poDetails?.totalPaymentDue ?? 0;

  // Total Payment Due is editable — the edited value is sent to sales_order/generate_grn
  // as `amount` (e.g. for a partial delivery). Resets whenever a new PO is copied in.
  const [editableTotal, setEditableTotal] = useState(() => (computedTotalPaymentDue || 0).toFixed(2));

  useEffect(() => {
    setEditableTotal((computedTotalPaymentDue || 0).toFixed(2));
  }, [computedTotalPaymentDue, show]);

  if (!show || !poDetails) return null;

  const {
    vendor = "",
    name = "",
    contactPerson = "",
    currency = "",
    poNo = "",
    postingDate = "",
    documentDate = "",
    items = [],
    totalBeforeDiscount = 0,
    discountPct = 0,
    tax = 0,
    purchaseOrderId = null,
  } = poDetails;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleCreateGRNClick = () => {
    const finalTotal = parseFloat(editableTotal);
    onCreateGRN?.({
      ...poDetails,
      amount: Number.isFinite(finalTotal) ? finalTotal : computedTotalPaymentDue,
    });
  };

  return (
    <div className="so-po-modal-backdrop" onClick={handleBackdropClick}>
      <div className="so-po-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="so-po-modal-close" onClick={onClose}>
          ×
        </button>

        <div className="so-po-modal-header">
          <h3 className="so-po-doc-title">GOODS RECEIPT PO</h3>
          <div className="so-po-modal-actions">
            <span className="so-po-grn-badge">Copied from PO {poNo || "—"}</span>
          </div>
        </div>

        <div className="so-po-modal-body">
          <div className="so-po-doc">
            <div className="so-po-fields">
              <div className="so-po-fields-col">
                <div className="so-po-field-row">
                  <span className="so-po-field-label">Vendor</span>
                  <span className="so-po-field-value">{vendor || "—"}</span>
                </div>
                <div className="so-po-field-row">
                  <span className="so-po-field-label">Name</span>
                  <span className="so-po-field-value">{name || "—"}</span>
                </div>
                <div className="so-po-field-row">
                  <span className="so-po-field-label">Contact Person</span>
                  <span className="so-po-field-value">{contactPerson || "—"}</span>
                </div>
                <div className="so-po-field-row">
                  <span className="so-po-field-label">Local Currency</span>
                  <span className="so-po-field-value">{currency || "—"}</span>
                </div>
              </div>

              <div className="so-po-fields-col">
                <div className="so-po-field-row">
                  <span className="so-po-field-label">PO No.</span>
                  <span className="so-po-field-value">{poNo || "—"}</span>
                </div>
                <div className="so-po-field-row">
                  <span className="so-po-field-label">Posting Date</span>
                  <span className="so-po-field-value">{postingDate || "—"}</span>
                </div>
                <div className="so-po-field-row">
                  <span className="so-po-field-label">Document Date</span>
                  <span className="so-po-field-value">{documentDate || "—"}</span>
                </div>
              </div>
            </div>


            <div className="so-po-table-scroll">
              <table className="so-po-doc-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item No.</th>
                    <th>Item Description</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Discount %</th>
                    <th>Tax Code</th>
                    <th>Tax Amount</th>
                    <th>Total (LC)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={`${item.itemNo || "item"}-${index}`}>
                      <td>{index + 1}</td>
                      <td className="so-po-doc-item-no">{item.itemNo || "—"}</td>
                      <td className="so-po-doc-item-desc" title={item.itemDescription || ""}>
                        {item.itemDescription || "—"}
                      </td>
                      <td>{item.qty ?? 0}</td>
                      <td>{formatCurrencySAR(item.unitPrice)}</td>
                      <td>{item.discount ?? 0}%</td>
                      <td>{item.taxCode || "—"}</td>
                      <td>{formatCurrencySAR(item.taxAmount)}</td>
                      <td className="so-po-doc-item-total">{formatCurrencySAR(item.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="so-po-bottom">
              <div className="so-po-bottom-left">
                {!purchaseOrderId && (
                  <div className="so-po-grn-note">
                    This purchase order hasn&apos;t been submitted yet. Submit it before generating a Goods Receipt.
                  </div>
                )}
              </div>

              <div className="so-po-doc-totals">
                <div className="so-po-doc-totals-row">
                  <span>Total Before Discount</span>
                  <span>{formatCurrencySAR(totalBeforeDiscount)}</span>
                </div>
                <div className="so-po-doc-totals-row">
                  <span>Discount %</span>
                  <span>{(parseFloat(discountPct) || 0).toFixed(2)}%</span>
                </div>
                <div className="so-po-doc-totals-row">
                  <span>Tax</span>
                  <span>{formatCurrencySAR(tax)}</span>
                </div>
                <div className="so-po-doc-totals-row so-po-doc-totals-grand">
                  <span>Total Payment Due</span>
                  <span className="so-po-doc-totals-grand-input-wrap">
                    <span className="so-po-doc-totals-grand-currency">SAR</span>
                    <input
                      type="number"
                      step="0.01"
                      className="so-po-doc-totals-grand-input"
                      value={editableTotal}
                      onChange={(e) => setEditableTotal(e.target.value)}
                      disabled={isSubmitting}
                      aria-label="Total Payment Due"
                    />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="so-po-modal-footer">
          <button type="button" className="so-po-btn so-po-btn-cancel" onClick={onClose} disabled={isSubmitting}>
            Close
          </button>
          <button
            type="button"
            className="so-po-btn so-po-btn-generate"
            onClick={handleCreateGRNClick}
            disabled={!onCreateGRN || !purchaseOrderId || isSubmitting}
            title={!purchaseOrderId ? "Submit the purchase order first" : undefined}
          >
            {isSubmitting ? "Generating..." : "Generate GRN"}
          </button>
        </div>
      </div>
    </div>
  );
};

GoodsReceiptPOModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  poDetails: PropTypes.shape({
    vendor: PropTypes.string,
    name: PropTypes.string,
    contactPerson: PropTypes.string,
    currency: PropTypes.string,
    branch: PropTypes.string,
    branchRegNo: PropTypes.string,
    poNo: PropTypes.string,
    postingDate: PropTypes.string,
    documentDate: PropTypes.string,
    items: PropTypes.arrayOf(
      PropTypes.shape({
        itemNo: PropTypes.string,
        itemDescription: PropTypes.string,
        qty: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        unitPrice: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        discount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        taxCode: PropTypes.string,
        taxAmount: PropTypes.number,
        totalAmount: PropTypes.number,
      })
    ),
    totalBeforeDiscount: PropTypes.number,
    discountPct: PropTypes.number,
    tax: PropTypes.number,
    totalPaymentDue: PropTypes.number,
    purchaseOrderId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }),
  onCreateGRN: PropTypes.func,
  isSubmitting: PropTypes.bool,
};

export default GoodsReceiptPOModal;
