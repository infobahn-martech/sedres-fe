import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { FiCheck, FiList } from "react-icons/fi";
import salesOrderService from "@/services/salesOrderService";
import daService from "@/services/daService";
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

// Shown right after a call file is created: lists the call's default sales order line items
// (sales_order/get_default_line_items/{call_id}). Items already on the sales order (so_item_id set)
// start checked. On Confirm, newly checked items are added (sales_order/add_call_line_item) and
// unchecked existing ones are cancelled (da/da_delete_sales_line_item). Skip leaves the sales order as is.
function DefaultLineItemsModal({ callId, onDone }) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [details, setDetails] = useState(null);
  const [checkedTariffIds, setCheckedTariffIds] = useState(() => new Set());
  const [isApplying, setIsApplying] = useState(false);

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
        const items = Array.isArray(payload.items) ? payload.items : [];
        setDetails({ ...payload, items });
        setCheckedTariffIds(
          new Set(items.filter((item) => item?.so_item_id != null).map((item) => item.tariff_id))
        );
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

  const items = details?.items ?? [];
  const currency = details?.currency ?? "";

  const totals = useMemo(
    () =>
      items.reduce(
        (acc, item) => {
          if (!checkedTariffIds.has(item.tariff_id)) return acc;
          const unit = toNumber(item.unit_price);
          const total = toNumber(item.total_price);
          acc.subtotal += unit;
          acc.totalTax += total - unit;
          acc.grandTotal += total;
          return acc;
        },
        { subtotal: 0, totalTax: 0, grandTotal: 0 }
      ),
    [items, checkedTariffIds]
  );

  const allChecked = items.length > 0 && items.every((item) => checkedTariffIds.has(item.tariff_id));

  const toggleItem = (tariffId) => {
    setCheckedTariffIds((prev) => {
      const next = new Set(prev);
      if (next.has(tariffId)) next.delete(tariffId);
      else next.add(tariffId);
      return next;
    });
  };

  const toggleAll = () => {
    setCheckedTariffIds(allChecked ? new Set() : new Set(items.map((item) => item.tariff_id)));
  };

  const handleConfirm = async () => {
    const toAdd = items.filter((item) => item.so_item_id == null && checkedTariffIds.has(item.tariff_id));
    const toDelete = items.filter((item) => item.so_item_id != null && !checkedTariffIds.has(item.tariff_id));
    if (!toAdd.length && !toDelete.length) {
      onDone();
      return;
    }

    setIsApplying(true);
    const results = await Promise.allSettled([
      ...toAdd.map((item) =>
        salesOrderService.addCallLineItem({ call_id: Number(callId) || callId, tariff_id: item.tariff_id })
      ),
      ...toDelete.map((item) => daService.deleteSalesLineItem({ so_item_id: item.so_item_id })),
    ]);
    setIsApplying(false);

    const failed = results.filter(
      (result) =>
        result.status === "rejected" ||
        (result.value?.data?.status && result.value.data.status !== "success")
    );
    if (failed.length) {
      const first = failed[0];
      const message =
        first.status === "rejected"
          ? getErrorMessage(first.reason, "")
          : first.value?.data?.message || "";
      notify(
        `${failed.length} line item change${failed.length > 1 ? "s" : ""} could not be saved.${message ? ` ${message}` : ""}`,
        "error"
      );
    } else {
      notify("Line items updated.", "success");
    }
    onDone();
  };

  const renderBody = () => {
    if (isLoading) {
      return <div className="dli-modal-state">Loading line items...</div>;
    }
    if (loadError) {
      return <div className="dli-modal-state dli-modal-state--error">{loadError}</div>;
    }
    if (!items.length) {
      return <div className="dli-modal-state">No default line items for this call.</div>;
    }
    return (
      <div className="dli-modal-table-wrap">
        <table className="dli-modal-table">
          <thead>
            <tr>
              <th className="dli-col-check">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  disabled={isApplying}
                  aria-label="Select all line items"
                />
              </th>
              <th>Item</th>
              <th className="dli-col-num">Unit Price</th>
              <th className="dli-col-num">Tax %</th>
              <th className="dli-col-num">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isChecked = checkedTariffIds.has(item.tariff_id);
              return (
                <tr
                  key={item.tariff_id}
                  className={isChecked ? "is-selected" : ""}
                  onClick={() => !isApplying && toggleItem(item.tariff_id)}
                >
                  <td className="dli-col-check">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleItem(item.tariff_id)}
                      onClick={(e) => e.stopPropagation()}
                      disabled={isApplying}
                      aria-label={`Include ${item.item_name}`}
                    />
                  </td>
                  <td>
                    <div className="dli-item-name">{item.item_name}</div>
                    {item.item_code && <div className="dli-item-code">{item.item_code}</div>}
                  </td>
                  <td className="dli-col-num">{formatAmount(item.unit_price)}</td>
                  <td className="dli-col-num">{toNumber(item.tax_percentage)}%</td>
                  <td className="dli-col-num">{formatAmount(item.total_price)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="dli-modal-totals">
          <div>
            <span>Subtotal</span>
            <span>{currency} {formatAmount(totals.subtotal)}</span>
          </div>
          <div>
            <span>Tax</span>
            <span>{currency} {formatAmount(totals.totalTax)}</span>
          </div>
          <div className="dli-modal-totals-grand">
            <span>Grand Total</span>
            <span>{currency} {formatAmount(totals.grandTotal)}</span>
          </div>
        </div>
      </div>
    );
  };

  const selectedCount = checkedTariffIds.size;

  return createPortal(
    <div className="so-doc-modal-overlay dli-modal-overlay">
      <div className="so-doc-modal dli-modal" role="dialog" aria-modal="true" aria-labelledby="dli-modal-title">
        <div className="so-doc-modal-header">
          <span className="so-doc-modal-header-icon">
            <FiList />
          </span>
          <div className="so-doc-modal-heading">
            <h3 id="dli-modal-title" className="so-doc-modal-title">Sales Order Line Items</h3>
            <p className="so-doc-modal-subtitle">
              {details?.sales_order_no
                ? `${details.sales_order_no} · choose the line items to keep on this call.`
                : "Choose the line items to keep on this call."}
            </p>
          </div>
        </div>

        <div className="so-doc-modal-body">{renderBody()}</div>

        <div className="so-doc-modal-footer">
          <span className="so-doc-modal-count">
            {!isLoading && !loadError && items.length
              ? `${selectedCount} of ${items.length} selected`
              : ""}
          </span>
          <div className="so-doc-modal-actions">
            <button type="button" className="sales-order-add-form-cancel" onClick={onDone} disabled={isApplying}>
              Skip
            </button>
            <button
              type="button"
              className="sales-order-add-form-save"
              onClick={handleConfirm}
              disabled={isLoading || isApplying || Boolean(loadError) || !items.length}
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
