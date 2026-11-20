import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { FiCheck, FiEdit2, FiList, FiPlus, FiTrash2, FiX } from "react-icons/fi";
import salesOrderService from "@/services/salesOrderService";
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

// quantity is absent on default line items (one unit each).
const getQuantity = (item) => (item?.quantity == null ? 1 : toNumber(item.quantity));

const computeTotal = (unitPrice, quantity, taxPercentage) => {
  const net = toNumber(unitPrice) * toNumber(quantity);
  return net + (net * toNumber(taxPercentage)) / 100;
};

// Shown right after a call file is created: lists the default sales order line items for the call's
// billing entity / port / call type (sales_order/get_default_line_items?entity_id&port_id&call_type_id). The user can edit the quantity / tax of listed items
// and add more from the port's tariff list (newly added items can be deleted again); nothing is saved
// until Confirm. On Confirm, items not yet on the sales order are added (sales_order/add_call_line_item)
// and edited items are updated (sales_order/update_sales_order_item_amount). Skip leaves the sales order as is.
// readOnly: review-only (no Add Item / edit / Skip) — Confirm still adds the pending default items.
// soType: when set, items come from sales_order/get_so_items_by_call/{call_id}?so_type=<soType>
// (the call's existing sales order) instead of get_default_line_items.
// initialItems: when set (e.g. the line item a service save just created), these are listed instead;
// the call's sales order (get_so_items_by_call) is still read for the entity / currency the Add Item form needs.
function DefaultLineItemsModal({
  callId,
  entityId: entityIdProp,
  portId,
  callTypeId,
  onDone,
  readOnly = false,
  soType,
  initialItems,
  title,
  subtitle,
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [details, setDetails] = useState(null);
  const [items, setItems] = useState([]);
  // Row being edited inline (quantity / tax %); the change is applied to the sales order on Confirm.
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({ quantity: "", taxPercentage: "" });
  const [editError, setEditError] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
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
    const hasInitialItems = Array.isArray(initialItems);
    const request =
      soType || hasInitialItems
        ? salesOrderService.getSoItemsByCall(callId, soType)
        : salesOrderService.getDefaultLineItems({
            entity_id: entityIdProp,
            port_id: portId,
            call_type_id: callTypeId,
          });
    if (hasInitialItems) {
      setItems(initialItems);
    }
    request
      .then(({ data }) => {
        if (cancelled) return;
        if (hasInitialItems) {
          // Only the call's sales order context is needed; the listed items came from the caller.
          setDetails(data?.status && data.status !== "success" ? {} : (data?.data ?? {}));
          return;
        }
        if (data?.status && data.status !== "success") {
          setLoadError(data?.message || "Could not load line items.");
          return;
        }
        const payload = data?.data ?? {};
        setDetails(payload);
        // get_so_items_by_call soft-deletes (item_status "Cancelled") instead of dropping rows.
        const rawItems = Array.isArray(payload.items) ? payload.items : [];
        setItems(
          rawItems.filter(
            (item) => String(item?.item_status ?? item?.status ?? "").trim().toLowerCase() !== "cancelled"
          )
        );
      })
      .catch((error) => {
        if (cancelled) return;
        if (hasInitialItems) setDetails({});
        else setLoadError(getErrorMessage(error, "Could not load line items."));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [callId, soType, initialItems, entityIdProp, portId, callTypeId]);

  const entityId = details?.entity_id ?? entityIdProp;
  const currency = details?.currency ?? "";

  // Item codes (sales_order/get_item_with_item_code) — loaded on first open
  // of the add form. item_code arrives as "OFM0014 - Description"; split into code + name.
  useEffect(() => {
    if (!isAddOpen || itemCodeOptions.length) return;
    let cancelled = false;
    setIsLoadingItemCodes(true);
    salesOrderService
      .getItemWithItemCode()
      .then((response) => {
        if (cancelled) return;
        const body = response?.data;
        const raw = body?.status === "success" ? body?.data : null;
        const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : [];
        setItemCodeOptions(
          list
            .map((option) => {
              const fullLabel = String(option?.item_code ?? "").trim();
              const separatorIndex = fullLabel.indexOf(" - ");
              const code = separatorIndex >= 0 ? fullLabel.slice(0, separatorIndex).trim() : fullLabel;
              const name =
                option?.item_name ?? (separatorIndex >= 0 ? fullLabel.slice(separatorIndex + 3).trim() : "");
              return { tariff_id: option?.tariff_id, item_code: code, item_name: name, label: fullLabel };
            })
            .filter((option) => option.item_code)
        );
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
  }, [isAddOpen, itemCodeOptions.length]);

  // One option per item code; codes whose tariff is already listed are hidden.
  const itemCodeSelectOptions = useMemo(() => {
    const listedTariffIds = new Set(items.map((item) => String(item.tariff_id)));
    const listedItemCodes = new Set(items.map((item) => item.item_code).filter(Boolean));
    const seen = new Set();
    return itemCodeOptions.reduce((acc, option) => {
      if (!option?.item_code || seen.has(option.item_code)) return acc;
      seen.add(option.item_code);
      if (listedTariffIds.has(String(option.tariff_id)) || listedItemCodes.has(option.item_code)) return acc;
      acc.push({
        value: option.item_code,
        label: option.label || option.item_code,
      });
      return acc;
    }, []);
  }, [itemCodeOptions, items]);

  const totals = useMemo(
    () =>
      items.reduce(
        (acc, item) => {
          const net = toNumber(item.unit_price) * getQuantity(item);
          const total = toNumber(item.total_price);
          acc.subtotal += net;
          acc.totalTax += total - net;
          acc.grandTotal += total;
          return acc;
        },
        { subtotal: 0, totalTax: 0, grandTotal: 0 }
      ),
    [items]
  );

  const columnCount = 7 + (readOnly ? 0 : 1);
  // Items that came with the save response (fromSave) are already recorded by that save.
  const isPendingAdd = (item) => item.so_item_id == null && !item.fromSave;
  const pendingAddCount = items.filter(isPendingAdd).length;
  const pendingUpdateCount = items.filter((item) => item.isEdited).length;

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
    setItems((prev) => [
      ...prev,
      {
        tariff_id: addForm.tariffId,
        so_item_id: null,
        item_code: addForm.itemCode,
        item_name: addForm.itemName || addForm.itemCode,
        unit_price: unit,
        quantity: 1,
        tax_percentage: tax,
        total_price: computeTotal(unit, 1, tax),
        isNew: true,
      },
    ]);
    closeAddForm();
  };

  // Only newly added (not yet saved) items can be deleted.
  const handleRemoveItem = (item) => {
    setItems((prev) => prev.filter((row) => row !== item));
  };

  const startEdit = (item) => {
    setEditingItem(item);
    setEditForm({ quantity: String(getQuantity(item)), taxPercentage: String(toNumber(item.tax_percentage)) });
    setEditError("");
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setEditError("");
  };

  const saveEdit = async () => {
    if (isSavingEdit) return;
    const quantity = Number(editForm.quantity);
    const taxPercentage = Number(editForm.taxPercentage);
    if (editForm.quantity === "" || !Number.isFinite(quantity) || quantity <= 0) {
      setEditError("Quantity must be greater than 0.");
      return;
    }
    if (editForm.taxPercentage === "" || !Number.isFinite(taxPercentage) || taxPercentage < 0) {
      setEditError("Tax % must be 0 or more.");
      return;
    }
    const item = editingItem;
    const originalQuantity = item.originalQuantity ?? getQuantity(item);
    const originalTax = item.originalTax ?? toNumber(item.tax_percentage);
    if (quantity === getQuantity(item) && taxPercentage === toNumber(item.tax_percentage)) {
      cancelEdit();
      return;
    }
    const updated = {
      ...item,
      quantity,
      tax_percentage: taxPercentage,
      total_price: computeTotal(item.unit_price, quantity, taxPercentage),
      originalQuantity,
      originalTax,
      isEdited: quantity !== originalQuantity || taxPercentage !== originalTax,
    };

    // A default item not yet on the sales order has nothing to update yet — it is added on Confirm,
    // then updated with these values.
    if (isPendingAdd(item)) {
      setItems((prev) => prev.map((row) => (row === item ? updated : row)));
      cancelEdit();
      return;
    }

    // Already on the sales order: update it right away (sales_order/update_sales_order_item_amount).
    setIsSavingEdit(true);
    setEditError("");
    try {
      const [resolved] = await resolveSoItemIds([item]);
      if (resolved?.so_item_id == null) throw new Error("Line item not found on the sales order.");
      const response = await salesOrderService.updateSalesOrderItemAmount({
        so_item_id: Number(resolved.so_item_id) || resolved.so_item_id,
        quantity,
        tax_percentage: taxPercentage,
      });
      const body = response?.data;
      if (body?.status && body.status !== "success") {
        throw new Error(body?.message || "Could not update the line item.");
      }
      const saved = { ...updated, so_item_id: resolved.so_item_id, isEdited: false, isUpdated: true };
      setItems((prev) => prev.map((row) => (row === item ? saved : row)));
      cancelEdit();
      notify("Line item updated.", "success");
    } catch (error) {
      setEditError(getErrorMessage(error, "Could not update the line item."));
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Items without an so_item_id (default items added on this Confirm, or save-response items) are found
  // on the call's sales order by item code / tariff (latest active line, preferring the original quantity).
  const resolveSoItemIds = async (list) => {
    if (!list.some((item) => item.so_item_id == null)) return list;
    let soItems = [];
    try {
      const { data } = await salesOrderService.getSoItemsByCall(callId);
      soItems = Array.isArray(data?.data?.items) ? data.data.items : [];
    } catch {
      soItems = [];
    }
    const used = new Set(list.map((item) => item.so_item_id).filter((id) => id != null).map(String));
    return list.map((item) => {
      if (item.so_item_id != null) return item;
      const candidates = soItems
        .filter(
          (row) =>
            row?.so_item_id != null &&
            !used.has(String(row.so_item_id)) &&
            ((item.item_code && row.item_code === item.item_code) ||
              (item.tariff_id != null && String(row.tariff_id) === String(item.tariff_id))) &&
            String(row?.item_status ?? row?.status ?? "").trim().toLowerCase() !== "cancelled"
        )
        .sort((a, b) => Number(b.so_item_id) - Number(a.so_item_id));
      const originalQuantity = item.originalQuantity ?? item.quantity;
      const match =
        candidates.find((row) => originalQuantity != null && toNumber(row.quantity) === toNumber(originalQuantity)) ??
        candidates[0];
      if (match) used.add(String(match.so_item_id));
      return { ...item, so_item_id: match?.so_item_id ?? null };
    });
  };

  const handleConfirm = async () => {
    const toAdd = items.filter(isPendingAdd);
    const toUpdate = items.filter((item) => item.isEdited);
    if (!toAdd.length && !toUpdate.length) {
      onDone();
      return;
    }

    setIsApplying(true);
    // Adds first: an edited default item has to exist on the sales order before it can be updated.
    const addResults = await Promise.allSettled(
      toAdd.map((item) =>
        salesOrderService.addCallLineItem({
          call_id: Number(callId) || callId,
          tariff_id: Number(item.tariff_id) || item.tariff_id,
        })
      )
    );
    const withAddedIds = toUpdate.map((item) => {
      if (item.so_item_id != null) return item;
      const result = addResults[toAdd.indexOf(item)];
      const body = result?.status === "fulfilled" ? result.value?.data : null;
      const soItemId = body?.data?.so_item_id ?? body?.so_item_id;
      return soItemId != null ? { ...item, so_item_id: soItemId } : item;
    });
    const resolvedUpdates = await resolveSoItemIds(withAddedIds);
    const updateResults = await Promise.allSettled(
      resolvedUpdates.map((item) =>
        item.so_item_id == null
          ? Promise.reject(new Error("Line item not found on the sales order."))
          : salesOrderService.updateSalesOrderItemAmount({
              so_item_id: Number(item.so_item_id) || item.so_item_id,
              quantity: toNumber(item.quantity),
              tax_percentage: toNumber(item.tax_percentage),
            })
      )
    );
    setIsApplying(false);

    const failed = [...addResults, ...updateResults].filter(isFailedResult);
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
              isLoadingItemCodes ? "Loading item codes..." : "Select Item Code..."
            }
            searchPlaceholder="Search item code..."
            disabled={isLoadingItemCodes || isLoadingItemDetails}
            hasError={Boolean(addError)}
            className="so-add-form-select"
            menuClassName="so-add-form-select-menu"
          />
          {addError && <span className="sales-order-add-form-error">{addError}</span>}
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
          {!readOnly && !isAddOpen && (
            <button type="button" className="dli-add-btn" onClick={openAddForm} disabled={isApplying}>
              <FiPlus />
              Add Item
            </button>
          )}
        </div>

        {!readOnly && isAddOpen && renderAddForm()}

        <div className="dli-table-card">
          <table className="dli-modal-table">
            <thead>
              <tr>
                <th className="dli-col-idx">#</th>
                <th className="dli-col-code">Item Code</th>
                <th>Description</th>
                <th className="dli-col-num">Unit Price</th>
                <th className="dli-col-num dli-col-qty">Qty</th>
                <th className="dli-col-num">Tax %</th>
                <th className="dli-col-num">Total</th>
                {!readOnly && <th className="dli-col-action" aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="dli-table-empty">
                    {readOnly ? (
                      "No line items."
                    ) : (
                      <>
                        No line items. Use <strong>Add Item</strong> to add one.
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                items.map((item, index) => {
                  const isEditing = editingItem === item;
                  const rowTotal = isEditing
                    ? computeTotal(item.unit_price, editForm.quantity, editForm.taxPercentage)
                    : item.total_price;
                  const handleEditKeyDown = (e) => {
                    if (e.key === "Enter") saveEdit();
                    if (e.key === "Escape") cancelEdit();
                  };
                  return (
                    <tr
                      key={`${item.tariff_id ?? item.item_code}-${item.so_item_id ?? "new"}`}
                      className={isEditing ? "dli-row--editing" : undefined}
                    >
                      <td className="dli-col-idx">{index + 1}</td>
                      <td className="dli-col-code">
                        <span className="dli-code-pill">{item.item_code || "—"}</span>
                      </td>
                      <td>
                        <div className="dli-item-name">
                          {item.item_name}
                          {item.isNew && <span className="dli-badge">New</span>}
                          {item.isEdited && !isEditing && <span className="dli-badge dli-badge--edited">Edited</span>}
                          {item.isUpdated && !item.isEdited && !isEditing && <span className="dli-badge">Updated</span>}
                        </div>
                        {isEditing && editError && <span className="sales-order-add-form-error">{editError}</span>}
                      </td>
                      <td className="dli-col-num">{formatAmount(item.unit_price)}</td>
                      <td className="dli-col-num dli-col-qty">
                        {isEditing ? (
                          <input
                            type="number"
                            min="1"
                            step="1"
                            className="dli-row-input"
                            value={editForm.quantity}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, quantity: e.target.value }))}
                            onKeyDown={handleEditKeyDown}
                            aria-label="Quantity"
                            autoFocus
                          />
                        ) : (
                          getQuantity(item)
                        )}
                      </td>
                      <td className="dli-col-num">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            step="any"
                            className="dli-row-input"
                            value={editForm.taxPercentage}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, taxPercentage: e.target.value }))}
                            onKeyDown={handleEditKeyDown}
                            aria-label="Tax percentage"
                          />
                        ) : (
                          `${toNumber(item.tax_percentage)}%`
                        )}
                      </td>
                      <td className="dli-col-num dli-col-total">{formatAmount(rowTotal)}</td>
                      {!readOnly && (
                        <td className="dli-col-action">
                          {isEditing ? (
                            <div className="dli-row-actions">
                              <button
                                type="button"
                                className="dli-icon-btn dli-icon-btn--save"
                                onClick={saveEdit}
                                disabled={isSavingEdit}
                                title={isSavingEdit ? "Saving..." : "Save"}
                                aria-label={`Apply changes to ${item.item_name}`}
                              >
                                <FiCheck />
                              </button>
                              <button
                                type="button"
                                className="dli-icon-btn"
                                onClick={cancelEdit}
                                disabled={isSavingEdit}
                                title="Cancel"
                                aria-label="Cancel edit"
                              >
                                <FiX />
                              </button>
                            </div>
                          ) : item.isNew ? (
                            <button
                              type="button"
                              className="dli-delete-btn"
                              onClick={() => handleRemoveItem(item)}
                              disabled={isApplying || Boolean(editingItem)}
                              title="Remove item"
                              aria-label={`Remove ${item.item_name}`}
                            >
                              <FiTrash2 />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="dli-icon-btn dli-edit-btn"
                              onClick={() => startEdit(item)}
                              disabled={isApplying || Boolean(editingItem)}
                              title="Edit quantity / tax"
                              aria-label={`Edit ${item.item_name}`}
                            >
                              <FiEdit2 />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
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
    pendingUpdateCount ? `${pendingUpdateCount} to update` : "",
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
              {title || "Sales Order Line Items"}
            </h3>
            <p className="so-doc-modal-subtitle">
              {subtitle ||
                (details?.sales_order_no
                  ? `${details.sales_order_no} · review the line items for this call.`
                  : "Review the line items for this call.")}
            </p>
          </div>
        </div>

        <div className="so-doc-modal-body dli-modal-body">{renderBody()}</div>

        <div className="so-doc-modal-footer">
          <span className="so-doc-modal-count">{!isLoading && !loadError ? pendingSummary : ""}</span>
          <div className="so-doc-modal-actions">
            {!readOnly && (
              <button type="button" className="sales-order-add-form-cancel" onClick={onDone} disabled={isApplying}>
                Skip
              </button>
            )}
            <button
              type="button"
              className="sales-order-add-form-save dli-confirm-btn"
              onClick={handleConfirm}
              disabled={isLoading || isApplying || Boolean(loadError) || Boolean(editingItem)}
              title={editingItem ? "Apply or cancel the row edit first" : undefined}
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
  /** get_default_line_items params; required unless soType / initialItems is set. */
  entityId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  portId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  callTypeId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onDone: PropTypes.func.isRequired,
  readOnly: PropTypes.bool,
  soType: PropTypes.string,
  /** Items to list instead of loading them (e.g. from a service save response). Keep the array reference stable. */
  initialItems: PropTypes.array,
  title: PropTypes.string,
  subtitle: PropTypes.string,
};

export default DefaultLineItemsModal;
