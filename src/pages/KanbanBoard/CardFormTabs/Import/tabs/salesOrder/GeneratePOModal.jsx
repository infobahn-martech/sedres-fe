import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";

const formatCurrencySAR = (amount) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 2,
  }).format(amount || 0);

const calcLineAmounts = (item) => {
  const qty = parseFloat(item.qty) || 0;
  const unitPrice = parseFloat(item.unitPrice) || 0;
  const discount = parseFloat(item.discount) || 0;
  const taxRate = (parseFloat(String(item.taxCode || "0").replace(/%/g, "")) || 0) / 100;
  const subtotal = qty * unitPrice * (1 - discount / 100);
  const tax = subtotal * taxRate;
  const total = item.totalAmount ?? subtotal + tax;
  return { subtotal, tax, total };
};

const TABS = ["Contents"];

// Generate PO Modal - printable PO preview only; submission result is reported via toast
const GeneratePOModal = ({
  show,
  onClose,
  onGenerate,
  isSubmitting = false,
  error,
  selectedItems,
  salesOrderList,
  soNumber = "",
  status = "",
  postingDate = "",
  deliveryDate = "",
  documentDate = "",
  branch = "",
  branchRegNo = "",
  contactPerson = "",
  localCurrency = "",
  owner = "",
  remarks = "",
  shippingFee = 0,
  termsAndConditions = "",
  purchaseOrderId = null,
  onCopyToGoodsReceipt,
}) => {
  const [copyToOpen, setCopyToOpen] = useState(false);
  const [vendorRefNo, setVendorRefNo] = useState("");
  const copyToRef = useRef(null);

  useEffect(() => {
    if (!copyToOpen) return undefined;
    const handleOutsideClick = (e) => {
      if (copyToRef.current && !copyToRef.current.contains(e.target)) setCopyToOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [copyToOpen]);

  const selectedLineItems = salesOrderList.filter((item) => selectedItems.includes(item.id));

  const vendorCodes = [...new Set(selectedLineItems.map((item) => item.supplierCode).filter(Boolean))];
  const vendorNames = [...new Set(selectedLineItems.map((item) => item.supplierName).filter(Boolean))];
  const vendorCodeLabel =
    vendorCodes.length === 0 ? "—" : vendorCodes.length === 1 ? vendorCodes[0] : `Multiple Vendors (${vendorCodes.length})`;
  const vendorNameLabel =
    vendorNames.length === 0 ? "—" : vendorNames.length === 1 ? vendorNames[0] : `Multiple Vendors (${vendorNames.length})`;

  const lineAmounts = selectedLineItems.map((item) => ({ item, ...calcLineAmounts(item) }));
  const totalBeforeDiscount = lineAmounts.reduce(
    (sum, l) => sum + (parseFloat(l.item.qty) || 0) * (parseFloat(l.item.unitPrice) || 0),
    0
  );
  const subtotal = lineAmounts.reduce((sum, l) => sum + l.subtotal, 0);
  const tax = lineAmounts.reduce((sum, l) => sum + l.tax, 0);
  const grandTotal = subtotal + tax + (parseFloat(shippingFee) || 0);
  const discountPct = totalBeforeDiscount > 0 ? ((totalBeforeDiscount - subtotal) / totalBeforeDiscount) * 100 : 0;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isSubmitting) onClose();
  };

  const handleCopyToGoodsReceipt = () => {
    setCopyToOpen(false);
    // Integration point: wire to the GRN/Goods Receipt PO creation API once it is available.
    onCopyToGoodsReceipt?.({
      vendor: vendorCodeLabel,
      name: vendorNameLabel,
      contactPerson,
      currency: localCurrency,
      branch,
      branchRegNo,
      poNo: soNumber,
      postingDate,
      documentDate,
      items: lineAmounts.map(({ item, tax: lineTax, total }) => ({
        itemNo: item.itemNo,
        itemDescription: item.itemDescription,
        qty: item.qty,
        unitPrice: item.unitPrice,
        discount: item.discount,
        taxCode: item.taxCode,
        taxAmount: lineTax,
        totalAmount: total,
      })),
      totalBeforeDiscount,
      discountPct,
      tax,
      totalPaymentDue: grandTotal,
    });
  };

  if (!show) return null;

  return (
    <div className="so-po-modal-backdrop" onClick={handleBackdropClick}>
      <div className="so-po-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="so-po-modal-close" onClick={onClose} disabled={isSubmitting}>
          ×
        </button>

        <div className="so-po-modal-header">
          <h3 className="so-po-doc-title">PURCHASE ORDER</h3>

          <div className="so-po-modal-actions">
            <div className="so-po-copyto" ref={copyToRef}>
              <button type="button" className="so-po-toolbar-btn" onClick={() => setCopyToOpen((v) => !v)}>
                Copy To ▾
              </button>
              {copyToOpen && (
                <div className="so-po-copyto-menu">
                  <button type="button" className="so-po-copyto-item" onClick={handleCopyToGoodsReceipt}>
                    Goods Receipt PO
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              className="so-po-toolbar-btn so-po-toolbar-btn-submit"
              onClick={() => onGenerate(vendorRefNo)}
              disabled={isSubmitting || Boolean(purchaseOrderId)}
              title={purchaseOrderId ? "This purchase order has already been submitted." : undefined}
            >
              {isSubmitting ? "Submitting..." : purchaseOrderId ? "Submitted" : "Submit"}
            </button>
          </div>
        </div>

        <div className="so-po-modal-body">
          <div className="so-po-doc">
            <div className="so-po-fields">
              <div className="so-po-fields-col">
                <div className="so-po-field-row">
                  <span className="so-po-field-label">Vendor</span>
                  <span className="so-po-field-value" title={vendorCodeLabel}>
                    {vendorCodeLabel}
                  </span>
                </div>
                <div className="so-po-field-row">
                  <span className="so-po-field-label">Name</span>
                  <span className="so-po-field-value" title={vendorNameLabel}>
                    {vendorNameLabel}
                  </span>
                </div>
                <div className="so-po-field-row">
                  <span className="so-po-field-label">Contact Person</span>
                  <span className="so-po-field-value">{contactPerson || "—"}</span>
                </div>
                <div className="so-po-field-row">
                  <span className="so-po-field-label">Vendor Ref. No.</span>
                  <input
                    type="text"
                    className="so-po-field-input"
                    value={vendorRefNo}
                    onChange={(e) => setVendorRefNo(e.target.value)}
                    placeholder="Enter vendor ref. no..."
                    disabled={isSubmitting}
                  />
                </div>
                <div className="so-po-field-row">
                  <span className="so-po-field-label">Local Currency</span>
                  <span className="so-po-field-value">{localCurrency || "—"}</span>
                </div>
              </div>

              <div className="so-po-fields-col">
                <div className="so-po-field-row">
                  <span className="so-po-field-label">No.</span>
                  <span className="so-po-field-value">{soNumber || "—"}</span>
                </div>
                <div className="so-po-field-row">
                  <span className="so-po-field-label">Status</span>
                  <span className="so-po-field-value">{status || "—"}</span>
                </div>
                <div className="so-po-field-row">
                  <span className="so-po-field-label">Posting Date</span>
                  <span className="so-po-field-value">{postingDate || "—"}</span>
                </div>
                <div className="so-po-field-row">
                  <span className="so-po-field-label">Delivery Date</span>
                  <span className="so-po-field-value">{deliveryDate || "—"}</span>
                </div>
                <div className="so-po-field-row">
                  <span className="so-po-field-label">Document Date</span>
                  <span className="so-po-field-value">{documentDate || "—"}</span>
                </div>
              </div>
            </div>

            <div className="so-po-branch-row">
              <div className="so-po-field-row">
                <span className="so-po-field-label">Branch</span>
                <span className="so-po-field-value">{branch || "—"}</span>
              </div>
              <div className="so-po-field-row">
                <span className="so-po-field-label">Branch Reg. No.</span>
                <span className="so-po-field-value">{branchRegNo || "—"}</span>
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
                    <th>Total (LC)</th>
                    <th>UoM Code</th>
                  </tr>
                </thead>
                <tbody>
                  {lineAmounts.map(({ item, total }, index) => (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td className="so-po-doc-item-no">{item.itemNo || "—"}</td>
                      <td className="so-po-doc-item-desc" title={item.itemDescription || ""}>
                        {item.itemDescription || "—"}
                      </td>
                      <td>{item.qty ?? 0}</td>
                      <td>{formatCurrencySAR(item.unitPrice)}</td>
                      <td>{item.discount ?? 0}</td>
                      <td>{item.taxCode || "—"}</td>
                      <td>{formatCurrencySAR(total)}</td>
                      <td>{item.uomCode || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="so-po-bottom">
              <div className="so-po-bottom-left">
                <div className="so-po-field-row">
                  <span className="so-po-field-label">Owner</span>
                  <span className="so-po-field-value">{owner || "—"}</span>
                </div>
                <div className="so-po-field-row so-po-field-row-textarea">
                  <span className="so-po-field-label">Remarks</span>
                  <textarea className="so-po-field-textarea" value={remarks || ""} readOnly />
                </div>
              </div>

              <div className="so-po-doc-totals">
                <div className="so-po-doc-totals-row">
                  <span>Total Before Discount</span>
                  <span>{formatCurrencySAR(totalBeforeDiscount)}</span>
                </div>
                <div className="so-po-doc-totals-row">
                  <span>Discount %</span>
                  <span>{discountPct.toFixed(2)}%</span>
                </div>
                <div className="so-po-doc-totals-row">
                  <span>Rounding</span>
                  <span>{formatCurrencySAR(0)}</span>
                </div>
                <div className="so-po-doc-totals-row">
                  <span>Tax</span>
                  <span>{formatCurrencySAR(tax)}</span>
                </div>
                {parseFloat(shippingFee) > 0 && (
                  <div className="so-po-doc-totals-row">
                    <span>Shipping Fee</span>
                    <span>{formatCurrencySAR(shippingFee)}</span>
                  </div>
                )}
                <div className="so-po-doc-totals-row so-po-doc-totals-grand">
                  <span>Total Payment Due</span>
                  <span>{formatCurrencySAR(grandTotal)}</span>
                </div>
              </div>
            </div>

            {termsAndConditions && (
              <div className="so-po-terms">
                <div className="so-po-terms-title">Terms &amp; Conditions</div>
                <div className="so-po-terms-body">{termsAndConditions}</div>
              </div>
            )}

            {error && <div className="so-po-doc-error">{error}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

GeneratePOModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onGenerate: PropTypes.func.isRequired,
  isSubmitting: PropTypes.bool,
  error: PropTypes.string,
  selectedItems: PropTypes.arrayOf(PropTypes.number).isRequired,
  salesOrderList: PropTypes.array.isRequired,
  soNumber: PropTypes.string,
  status: PropTypes.string,
  postingDate: PropTypes.string,
  deliveryDate: PropTypes.string,
  documentDate: PropTypes.string,
  branch: PropTypes.string,
  branchRegNo: PropTypes.string,
  contactPerson: PropTypes.string,
  localCurrency: PropTypes.string,
  owner: PropTypes.string,
  remarks: PropTypes.string,
  shippingFee: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  termsAndConditions: PropTypes.string,
  purchaseOrderId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onCopyToGoodsReceipt: PropTypes.func,
};

export default GeneratePOModal;
