import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import salesOrderService from "../../../../../../services/salesOrderService";
import billingEntityService from "../../../../../../services/billingEntityService";
import DatePickerField from "../../../shared/components/DatePickerField";

const formatCurrencySAR = (amount) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 2,
  }).format(amount || 0);

const getStatusPillColors = (status) => {
  const s = String(status || "").toLowerCase();
  if (s.includes("closed") || s.includes("complete")) return { color: "#15803d", background: "#dcfce7" };
  if (s.includes("cancel")) return { color: "#b91c1c", background: "#fee2e2" };
  if (s.includes("open") || s.includes("draft")) return { color: "#1d4ed8", background: "#dbeafe" };
  return { color: "#475569", background: "#f1f5f9" };
};

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
  initialDiscountPercentage = 0,
}) => {
  const [copyToOpen, setCopyToOpen] = useState(false);
  const [vendorRefNo, setVendorRefNo] = useState("");
  const [discountPercentage, setDiscountPercentage] = useState(String(initialDiscountPercentage ?? 0));
  const [roundingEnabled, setRoundingEnabled] = useState(false);
  const [calculatedTotals, setCalculatedTotals] = useState(null);
  const [isCalculatingTotals, setIsCalculatingTotals] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [isLoadingVendors, setIsLoadingVendors] = useState(false);
  const [selectedVendorCode, setSelectedVendorCode] = useState("");
  const [vendorPickerOpen, setVendorPickerOpen] = useState(false);
  const [vendorSearch, setVendorSearch] = useState("");
  const [deliveryDateValue, setDeliveryDateValue] = useState(deliveryDate || "");
  const [documentDateValue, setDocumentDateValue] = useState(documentDate || "");
  const [remarksValue, setRemarksValue] = useState(remarks || "");
  const [poVendorId, setPoVendorId] = useState(null);
  const [poSummary, setPoSummary] = useState(null);
  const copyToRef = useRef(null);
  const vendorPickerRef = useRef(null);

  useEffect(() => {
    if (!copyToOpen) return undefined;
    const handleOutsideClick = (e) => {
      if (copyToRef.current && !copyToRef.current.contains(e.target)) setCopyToOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [copyToOpen]);

  useEffect(() => {
    if (!vendorPickerOpen) return undefined;
    const handleOutsideClick = (e) => {
      if (vendorPickerRef.current && !vendorPickerRef.current.contains(e.target)) {
        setVendorPickerOpen(false);
        setVendorSearch("");
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [vendorPickerOpen]);

  const selectedLineItems = salesOrderList.filter((item) => selectedItems.includes(item.id));

  // Vendor list — billingentity/getvendors, [{ vendor_id, customer_code, customer_name }] — populates the picker.
  useEffect(() => {
    let cancelled = false;
    setIsLoadingVendors(true);
    billingEntityService
      .getVendors()
      .then((response) => {
        if (cancelled) return;
        const rows = Array.isArray(response?.data?.data) ? response.data.data : [];
        const list = rows.map((v) => ({
          id: v.vendor_id ?? "",
          code: v.customer_code != null ? String(v.customer_code) : "",
          name: v.customer_name != null ? String(v.customer_name) : "",
        }));
        setVendors(list);
      })
      .catch(() => {
        if (!cancelled) setVendors([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingVendors(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // PO details — sales_order/get_po — authoritative vendor/dates/totals for the selected line items.
  useEffect(() => {
    let cancelled = false;
    salesOrderService
      .getPO(selectedItems)
      .then((response) => {
        if (cancelled) return;
        const body = response?.data;
        if (body?.status !== "success" || !body?.data) return;
        const data = body.data;
        if (data.vendor_id != null) setPoVendorId(data.vendor_id);
        if (data.delivery_date) setDeliveryDateValue(data.delivery_date);
        if (data.document_date) setDocumentDateValue(data.document_date);
        if (data.summary) {
          setPoSummary(data.summary);
          setDiscountPercentage(String(data.summary.discount_percentage ?? 0));
          setRoundingEnabled(Boolean(data.summary.rounding));
        }
      })
      .catch(() => {
        // Keep prop-based defaults and local calc fallback on failure.
      });
    return () => {
      cancelled = true;
    };
    // Selected line items are fixed for the lifetime of this modal's mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-select the vendor once both the picker list and the PO's vendor_id are known.
  useEffect(() => {
    if (poVendorId == null || vendors.length === 0) return;
    const match = vendors.find((v) => String(v.id) === String(poVendorId));
    if (match) {
      setSelectedVendorCode(match.code);
      setVendorRefNo(match.code);
    }
  }, [poVendorId, vendors]);

  // Seed totals from get_po's summary — the calculate_totals effect below refreshes them as the user edits discount/rounding.
  useEffect(() => {
    if (!poSummary) return;
    setCalculatedTotals({
      total_discount: poSummary.discount_amount,
      total_tax: poSummary.tax_amount,
      rounding_rate: poSummary.rounding_amount,
      grand_total: poSummary.total_payment_due,
    });
  }, [poSummary]);

  const selectedVendor = vendors.find((v) => v.code === selectedVendorCode) || null;

  const filteredVendors = vendors.filter(
    (v) =>
      v.code.toLowerCase().includes(vendorSearch.toLowerCase()) ||
      v.name.toLowerCase().includes(vendorSearch.toLowerCase())
  );

  const handleVendorSelect = (vendor) => {
    setSelectedVendorCode(vendor.code);
    setVendorRefNo(vendor.code);
    setVendorPickerOpen(false);
    setVendorSearch("");
  };

  const lineAmounts = selectedLineItems.map((item) => ({ item, ...calcLineAmounts(item) }));
  const totalBeforeDiscount = lineAmounts.reduce(
    (sum, l) => sum + (parseFloat(l.item.qty) || 0) * (parseFloat(l.item.unitPrice) || 0),
    0
  );
  // Local, per-line fallback shown until the first sales_order/calculate_totals response
  // arrives (or if a later call fails) — the API is the source of truth for discount/tax/
  // rounding/grand total once it responds.
  const localTax = lineAmounts.reduce((sum, l) => sum + l.tax, 0);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setIsCalculatingTotals(true);
      salesOrderService
        .calculateTotals({
          subtotal: totalBeforeDiscount,
          discount_percentage: parseFloat(discountPercentage) || 0,
          rounding: roundingEnabled ? 1 : 0,
        })
        .then((response) => {
          if (cancelled) return;
          const body = response?.data;
          if (body?.status === "success" && body?.data) {
            setCalculatedTotals(body.data);
          }
        })
        .catch(() => {
          // Keep the last known totals on failure — the preview just won't reflect this edit.
        })
        .finally(() => {
          if (!cancelled) setIsCalculatingTotals(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [totalBeforeDiscount, discountPercentage, roundingEnabled]);

  const totalDiscount = calculatedTotals
    ? Number(calculatedTotals.total_discount) || 0
    : (totalBeforeDiscount * (parseFloat(discountPercentage) || 0)) / 100;
  const taxAmount = calculatedTotals ? Number(calculatedTotals.total_tax) || 0 : localTax;
  const roundingAmount = calculatedTotals ? Number(calculatedTotals.rounding_rate) || 0 : 0;
  const grandTotal = calculatedTotals
    ? Number(calculatedTotals.grand_total) || 0
    : totalBeforeDiscount - totalDiscount + taxAmount + roundingAmount + (parseFloat(shippingFee) || 0);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isSubmitting) onClose();
  };

  const handleCopyToGoodsReceipt = () => {
    setCopyToOpen(false);
    // Integration point: wire to the GRN/Goods Receipt PO creation API once it is available.
    onCopyToGoodsReceipt?.({
      vendor: selectedVendor?.code || "—",
      name: selectedVendor?.name || "—",
      contactPerson,
      currency: localCurrency,
      branch,
      branchRegNo,
      poNo: soNumber,
      postingDate,
      documentDate: documentDateValue,
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
      discountPct: parseFloat(discountPercentage) || 0,
      tax: taxAmount,
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
          </div>
        </div>

        <div className="so-po-modal-body">
          <div className="so-po-doc">
            <div className="so-po-fields">
              <div className="so-po-fields-col">
                <div className="so-po-field-row">
                  <span className="so-po-field-label">Vendor</span>
                  <div className="so-po-vendor-select" ref={vendorPickerRef}>
                    <button
                      type="button"
                      className="so-po-vendor-trigger"
                      onClick={() => setVendorPickerOpen((v) => !v)}
                      disabled={isSubmitting || isLoadingVendors}
                    >
                      <span className="so-po-vendor-trigger-text">
                        {isLoadingVendors
                          ? "Loading vendors..."
                          : selectedVendor
                          ? `${selectedVendor.code} — ${selectedVendor.name}`
                          : "Select vendor..."}
                      </span>
                      <span className="so-po-vendor-trigger-caret">▾</span>
                    </button>
                    {vendorPickerOpen && (
                      <div className="so-po-vendor-menu">
                        <input
                          type="text"
                          className="so-po-vendor-search"
                          placeholder="Search by code or name..."
                          value={vendorSearch}
                          onChange={(e) => setVendorSearch(e.target.value)}
                          autoFocus
                        />
                        <div className="so-po-vendor-list">
                          {filteredVendors.length === 0 ? (
                            <div className="so-po-vendor-empty">No vendors found.</div>
                          ) : (
                            filteredVendors.map((v) => (
                              <button
                                type="button"
                                key={v.code}
                                className="so-po-vendor-item"
                                onClick={() => handleVendorSelect(v)}
                              >
                                <span className="so-po-vendor-item-code">{v.code}</span>
                                <span className="so-po-vendor-item-name">{v.name}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="so-po-field-row">
                  <span className="so-po-field-label">Name</span>
                  <span className="so-po-field-value" title={selectedVendor?.name || ""}>
                    {selectedVendor?.name || "—"}
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
                  {status ? (
                    <span className="so-po-status-pill" style={getStatusPillColors(status)}>
                      {status}
                    </span>
                  ) : (
                    <span className="so-po-field-value">—</span>
                  )}
                </div>
                <div className="so-po-field-row">
                  <span className="so-po-field-label">Posting Date</span>
                  <span className="so-po-field-value">{postingDate || "—"}</span>
                </div>
                <div className="so-po-field-row">
                  <span className="so-po-field-label">Delivery Date</span>
                  <DatePickerField
                    dateValue={deliveryDateValue}
                    onDateChange={(e) => setDeliveryDateValue(e.target.value)}
                    dateFieldName="poDeliveryDate"
                    disabled={isSubmitting}
                    className="so-po-field-input"
                  />
                </div>
                <div className="so-po-field-row">
                  <span className="so-po-field-label">Document Date</span>
                  <DatePickerField
                    dateValue={documentDateValue}
                    onDateChange={(e) => setDocumentDateValue(e.target.value)}
                    dateFieldName="poDocumentDate"
                    disabled={isSubmitting}
                    className="so-po-field-input"
                  />
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
                    <th>Total (LC)</th>
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
                      <td>{item.discount ?? 0}%</td>
                      <td>{item.taxCode || "—"}</td>
                      <td className="so-po-doc-item-total">{formatCurrencySAR(total)}</td>
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
                  <textarea
                    className="so-po-field-textarea"
                    value={remarksValue}
                    onChange={(e) => setRemarksValue(e.target.value)}
                    placeholder="Enter remarks..."
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="so-po-doc-totals">
                <div className="so-po-doc-totals-row">
                  <span>Total Before Discount</span>
                  <span>{formatCurrencySAR(totalBeforeDiscount)}</span>
                </div>
                <div className="so-po-doc-totals-row">
                  <span>Discount %</span>
                  <span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      className="so-po-field-input so-po-doc-totals-input"
                      value={discountPercentage}
                      onChange={(e) => setDiscountPercentage(e.target.value)}
                      disabled={isSubmitting}
                    />
                    %
                  </span>
                </div>
                <div className="so-po-doc-totals-row">
                  <span className="so-po-rounding-label">
                    <input
                      type="checkbox"
                      checked={roundingEnabled}
                      onChange={(e) => setRoundingEnabled(e.target.checked)}
                      disabled={isSubmitting}
                    />
                    Rounding
                  </span>
                  <span>{formatCurrencySAR(roundingAmount)}</span>
                </div>
                <div className="so-po-doc-totals-row">
                  <span>Tax{isCalculatingTotals ? " (calculating…)" : ""}</span>
                  <span>{formatCurrencySAR(taxAmount)}</span>
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

        <div className="so-po-modal-footer">
          <button type="button" className="so-po-btn so-po-btn-cancel" onClick={onClose} disabled={isSubmitting}>
            Close
          </button>
          <button
            type="button"
            className="so-po-btn so-po-btn-generate"
            onClick={() =>
              onGenerate({
                vendorId: selectedVendor?.id || "",
                vendorRefNo,
                deliveryDate: deliveryDateValue,
                documentDate: documentDateValue,
                remarks: remarksValue,
                discountPercentage: parseFloat(discountPercentage) || 0,
                rounding: roundingEnabled ? 1 : 0,
              })
            }
            disabled={isSubmitting || Boolean(purchaseOrderId)}
            title={purchaseOrderId ? "This purchase order has already been submitted." : undefined}
          >
            {isSubmitting ? "Submitting..." : purchaseOrderId ? "Submitted" : "Submit"}
          </button>
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
  initialDiscountPercentage: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};

export default GeneratePOModal;
