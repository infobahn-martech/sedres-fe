import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { FiCheck, FiList, FiPlus, FiTrash2, FiX } from "react-icons/fi";
import salesOrderService from "@/services/salesOrderService";
import daService from "@/services/daService";
import PremiumSelect from "@/components/form/PremiumSelect";
import { notify } from "@/components/Toaster";
import "@/design/scss/salesOrder.scss";
import "@/design/scss/defaultLineItemsModal.scss";

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatAmount = (value) =>
  toNumber(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.response?.data?.error || error?.message || fallback;

const isFailedResult = (result) =>
  result.status === "rejected" || (result.value?.data?.status && result.value.data.status !== "success");

const EMPTY_ADD_FORM = { itemCode: "", tariffId: "", itemName: "", unitPrice: "", taxPercentage: "" };

// Shown right after a call file is created: lists the call's default sales order line items
// (sales_order/get_default_line_items/{call_id}). The user can remove items or add more from the
// port's tariff list; nothing is saved until Confirm. On Confirm, items not yet on the sales order
// are added (sales_order/add_call_line_item) and removed items that were already on it are
// cancelled (da/da_delete_sales_line_item). Skip leaves the sales order as is.
function DefaultLineItemsModal({ callId, onDone }) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [details, setDetails] = useState(null);
  const [items, setItems] = useState([]);
  // Items already on the sales order that the user removed — cancelled on Confirm.
  const [removedItems, setRemovedItems] = useState([]);
  const [isApplying, setIsApplying] = useState(false);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM);
  const [addError, setAddError] = useState("");
  const [itemCodeOptions, setItemCodeOptions] = useState([]);
  const [isLoadingItemCodes, setIsLoadingItemCodes] = useState(false);
  const [isLoadingItemDetails, setIsLoadingItemDetails] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError("");
    salesOrderService
      .getDefaultLineItems(callId)
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.status && data.status !== "success") {
          setLoadError(data?.message || "Could not load default line items.");
          return;
        }
        const payload = data?.data ?? {};
        setDetails(payload);
        setItems(Array.isArray(payload.items) ? payload.items : []);
        setRemovedItems([]);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(getErrorMessage(error, "Could not load default line items."));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [callId]);

  const portId = details?.port_id;
  const entityId = details?.entity_id;
  const currency = details?.currency ?? "";

  // Item codes for the call's port (sales_order/get_item_codes/{port_id}) — loaded on first open of the add form.
  useEffect(() => {
    if (!isAddOpen || !portId || itemCodeOptions.length) return;
    let cancelled = false;
    setIsLoadingItemCodes(true);
    salesOrderService
      .getItemCodes(portId)
      .then((response) => {
        if (cancelled) return;
        const body = response?.data;
        setItemCodeOptions(body?.status === "success" && Array.isArray(body?.data) ? body.data : []);
      })
      .catch(() => {
        if (!cancelled) setItemCodeOptions([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingItemCodes(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAddOpen, portId, itemCodeOptions.length]);

  // One option per item code; codes whose tariff is already listed are hidden.
  const itemCodeSelectOptions = useMemo(() => {
    const listedTariffIds = new Set(items.map((item) => String(item.tariff_id)));
    const seen = new Set();
    return itemCodeOptions.reduce((acc, option) => {
      if (!option?.item_code || seen.has(option.item_code)) return acc;
      seen.add(option.item_code);
      if (listedTariffIds.has(String(option.tariff_id))) return acc;
      acc.push({
        value: option.item_code,
        label: option.item_name ? `${option.item_code} — ${option.item_name}` : option.item_code,
      });
      return acc;
    }, []);
  }, [itemCodeOptions, items]);

  const totals = useMemo(
    () =>
      items.reduce(
        (acc, item) => {
          const unit = toNumber(item.unit_price);
          const total = toNumber(item.total_price);
          acc.subtotal += unit;
          acc.totalTax += total - unit;
          acc.grandTotal += total;
          return acc;
        },
        { subtotal: 0, totalTax: 0, grandTotal: 0 }
      ),
    [items]
  );

  const pendingAddCount = items.filter((item) => item.so_item_id == null).length;
  const pendingRemoveCount = removedItems.length;

  const openAddForm = () => {
    setAddForm(EMPTY_ADD_FORM);
    setAddError("");
    setIsAddOpen(true);
  };

  const closeAddForm = () => {
    setIsAddOpen(false);
    setAddForm(EMPTY_ADD_FORM);
    setAddError("");
  };

  // Item code picked — autofill name / price / tax via sales_order/get_item_details.
  const handleItemCodeSelect = async (itemCode) => {
    const option = itemCodeOptions.find((o) => o.item_code === itemCode);
    setAddError("");
    setAddForm({
      ...EMPTY_ADD_FORM,
      itemCode,
      tariffId: option?.tariff_id ?? "",
      itemName: option?.item_name ?? "",
    });
    if (!option?.tariff_id) return;

    setIsLoadingItemDetails(true);
    try {
      const response = await salesOrderService.getItemDetails(option.tariff_id, entityId);
      const body = response?.data;
      if (body?.status === "success" && body?.data) {
        const itemDetails = body.data;
        setAddForm((prev) =>
          prev.itemCode !== itemCode
            ? prev
            : {
                ...prev,
                itemName: itemDetails.item_name || prev.itemName,
                unitPrice: itemDetails.price ?? itemDetails.default_price ?? prev.unitPrice,
                taxPercentage: itemDetails.tax_percentage ?? itemDetails.tax ?? prev.taxPercentage,
              }
        );
      }
    } catch (error) {
      setAddError(getErrorMessage(error, "Failed to load item details."));
    } finally {
      setIsLoadingItemDetails(false);
    }
  };

  const handleAddItem = () => {
    if (!addForm.tariffId) {
      setAddError("Please select an item code.");
      return;
    }
    const unit = toNumber(addForm.unitPrice);
    const tax = toNumber(addForm.taxPercentage);
    // A previously removed sales order item that is re-added is simply restored.
    const restored = removedItems.find((item) => String(item.tariff_id) === String(addForm.tariffId));
    if (restored) {
      setRemovedItems((prev) => prev.filter((item) => item !== restored));
      setItems((prev) => [...prev, restored]);
    } else {
      setItems((prev) => [
        ...prev,
        {
          tariff_id: addForm.tariffId,
          so_item_id: null,
          item_code: addForm.itemCode,
          item_name: addForm.itemName || addForm.itemCode,
          unit_price: unit,
          tax_percentage: tax,
          total_price: unit + (unit * tax) / 100,
          isNew: true,
        },
      ]);
    }
    closeAddForm();
  };

  const handleRemoveItem = (item) => {
    setItems((prev) => prev.filter((row) => row !== item));
    if (item.so_item_id != null) setRemovedItems((prev) => [...prev, item]);
  };

  const handleConfirm = async () => {
    const toAdd = items.filter((item) => item.so_item_id == null);
    if (!toAdd.length && !removedItems.length) {
      onDone();
      return;
    }

    setIsApplying(true);
    const results = await Promise.allSettled([
      ...toAdd.map((item) =>
        salesOrderService.addCallLineItem({
          call_id: Number(callId) || callId,
          tariff_id: Number(item.tariff_id) || item.tariff_id,
        })
      ),
      ...removedItems.map((item) => daService.deleteSalesLineItem({ so_item_id: item.so_item_id })),
    ]);
    setIsApplying(false);

    const failed = results.filter(isFailedResult);
    if (failed.length) {
      const first = failed[0];
      const message =
        first.status === "rejected" ? getErrorMessage(first.reason, "") : first.value?.data?.message || "";
      notify(
        `${failed.length} line item change${failed.length > 1 ? "s" : ""} could not be saved.${message ? ` ${message}` : ""}`,
        "error"
      );
    } else {
      notify("Line items updated.", "success");
    }
    onDone();
  };

  const renderAddForm = () => (
    <div className="dli-add-panel">
      <div className="dli-add-panel-header">
        <h4 className="dli-add-panel-title">Add New Sales Order Item</h4>
        <button
          type="button"
          className="sales-order-add-accordion-close"
          onClick={closeAddForm}
          aria-label="Close add item form"
        >
          <FiX />
        </button>
      </div>
      <div className="dli-add-panel-body">
        <div className="sales-order-add-form-field dli-add-field--code">
          <label>
            Item Code <span className="dli-required">*</span>
          </label>
          <PremiumSelect
            value={addForm.itemCode}
            onChange={(e) => handleItemCodeSelect(e.target.value)}
            options={itemCodeSelectOptions}
            placeholder={
              !portId ? "No port on this call" : isLoadingItemCodes ? "Loading item codes..." : "Select Item Code..."
            }
            searchPlaceholder="Search item code..."
            disabled={!portId || isLoadingItemCodes || isLoadingItemDetails}
            hasError={Boolean(addError)}
            className="so-add-form-select"
            menuClassName="so-add-form-select-menu"
          />
          {addError && <span className="sales-order-add-form-error">{addError}</span>}
        </div>
        <div className="sales-order-add-form-field dli-add-field--desc">
          <label>Item Description</label>
          <input
            type="text"
            className="sales-order-add-form-input"
            value={isLoadingItemDetails ? "Loading..." : addForm.itemName}
            placeholder="Auto-filled from item code"
            readOnly
          />
        </div>
        <div className="sales-order-add-form-field">
          <label>Unit Price</label>
          <input
            type="text"
            className="sales-order-add-form-input dli-input-num"
            value={addForm.unitPrice === "" ? "" : formatAmount(addForm.unitPrice)}
            placeholder="0.00"
            readOnly
          />
        </div>
        <div className="dli-add-panel-actions">
          <button type="button" className="sales-order-add-form-cancel" onClick={closeAddForm}>
            Cancel
          </button>
          <button
            type="button"
            className="sales-order-add-form-save"
            onClick={handleAddItem}
            disabled={!addForm.tariffId || isLoadingItemDetails}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );

  const renderBody = () => {
    if (isLoading) {
      return <div className="dli-modal-state">Loading line items...</div>;
    }
    if (loadError) {
      return <div className="dli-modal-state dli-modal-state--error">{loadError}</div>;
    }
    return (
      <div className="dli-modal-content">
        <div className="dli-toolbar">
          <span className="dli-toolbar-label">
            {items.length} line item{items.length === 1 ? "" : "s"}
          </span>
          {!isAddOpen && (
            <button type="button" className="dli-add-btn" onClick={openAddForm} disabled={isApplying}>
              <FiPlus />
              Add Item
            </button>
          )}
        </div>

        {isAddOpen && renderAddForm()}

        <div className="dli-table-card">
          <table className="dli-modal-table">
            <thead>
              <tr>
                <th className="dli-col-idx">#</th>
                <th className="dli-col-code">Item Code</th>
                <th>Description</th>
                <th className="dli-col-num">Unit Price</th>
                <th className="dli-col-num">Tax %</th>
                <th className="dli-col-num">Total</th>
                <th className="dli-col-action" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="dli-table-empty">
                    No line items. Use <strong>Add Item</strong> to add one.
                  </td>
                </tr>
              ) : (
                items.map((item, index) => (
                  <tr key={`${item.tariff_id}-${item.so_item_id ?? "new"}`}>
                    <td className="dli-col-idx">{index + 1}</td>
                    <td className="dli-col-code">
                      <span className="dli-code-pill">{item.item_code || "—"}</span>
                    </td>
                    <td>
                      <div className="dli-item-name">
                        {item.item_name}
                        {item.isNew && <span className="dli-badge">New</span>}
                      </div>
                    </td>
                    <td className="dli-col-num">{formatAmount(item.unit_price)}</td>
                    <td className="dli-col-num">{toNumber(item.tax_percentage)}%</td>
                    <td className="dli-col-num dli-col-total">{formatAmount(item.total_price)}</td>
                    <td className="dli-col-action">
                      <button
                        type="button"
                        className="dli-delete-btn"
                        onClick={() => handleRemoveItem(item)}
                        disabled={isApplying}
                        title="Remove item"
                        aria-label={`Remove ${item.item_name}`}
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="dli-modal-totals">
          <div>
            <span>Subtotal</span>
            <span>
              {currency} {formatAmount(totals.subtotal)}
            </span>
          </div>
          <div>
            <span>Tax</span>
            <span>
              {currency} {formatAmount(totals.totalTax)}
            </span>
          </div>
          <div className="dli-modal-totals-grand">
            <span>Grand Total</span>
            <span>
              {currency} {formatAmount(totals.grandTotal)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const pendingSummary = [
    pendingAddCount ? `${pendingAddCount} to add` : "",
    pendingRemoveCount ? `${pendingRemoveCount} to remove` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return createPortal(
    <div className="so-doc-modal-overlay dli-modal-overlay">
      <div className="so-doc-modal dli-modal" role="dialog" aria-modal="true" aria-labelledby="dli-modal-title">
        <div className="so-doc-modal-header">
          <span className="so-doc-modal-header-icon">
            <FiList />
          </span>
          <div className="so-doc-modal-heading">
            <h3 id="dli-modal-title" className="so-doc-modal-title">
              Sales Order Line Items
            </h3>
            <p className="so-doc-modal-subtitle">
              {details?.sales_order_no
                ? `${details.sales_order_no} · review the line items for this call.`
                : "Review the line items for this call."}
            </p>
          </div>
        </div>

        <div className="so-doc-modal-body dli-modal-body">{renderBody()}</div>

        <div className="so-doc-modal-footer">
          <span className="so-doc-modal-count">{!isLoading && !loadError ? pendingSummary : ""}</span>
          <div className="so-doc-modal-actions">
            <button type="button" className="sales-order-add-form-cancel" onClick={onDone} disabled={isApplying}>
              Skip
            </button>
            <button
              type="button"
              className="sales-order-add-form-save dli-confirm-btn"
              onClick={handleConfirm}
              disabled={isLoading || isApplying || Boolean(loadError)}
            >
              <FiCheck />
              {isApplying ? "Saving..." : "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

DefaultLineItemsModal.propTypes = {
  callId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onDone: PropTypes.func.isRequired,
};

export default DefaultLineItemsModal;
