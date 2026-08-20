import React, { useState } from "react";
import PropTypes from "prop-types";
import { FaWhatsapp } from "react-icons/fa";
import salesOrderService from "../../../../../../services/salesOrderService";
import useAlertReducer from "../../../../../../store/AlertReducer";

const formatDateTime = (value) => {
  if (!value) return "—";
  const s = String(value).trim();
  if (!s || s.startsWith("0000-00-00")) return "—";
  const d = new Date(s.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const hasValue = (v) => v != null && String(v).trim() !== "" && String(v).trim() !== "0000-00-00 00:00:00";
const str = (v) => (hasValue(v) ? String(v).trim() : "—");

const formatCurrencySAR = (amount) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 2,
  }).format(amount || 0);

const STATUS_STYLES = {
  Pending: { color: "#b45309", background: "#fef3c7" },
  Draft: { color: "#475569", background: "#f1f5f9" },
  Active: { color: "#1d4ed8", background: "#dbeafe" },
  Completed: { color: "#15803d", background: "#dcfce7" },
};
const getStatusStyle = (status) => STATUS_STYLES[status] || { color: "#475569", background: "#f1f5f9" };

// Work Order Details Modal — opened by clicking a Work Order No. in the sales order table.
// Fetches sales_order/get_work_order/{wo_id} (handled by the parent, which passes down
// loading/error/details), same presentational-only pattern as the other SO modals.
const WorkOrderDetailsModal = ({ show, onClose, isLoading = false, error = null, details, cardColor }) => {
  const [isSharing, setIsSharing] = useState(false);

  if (!show) return null;

  const wo = details || {};
  const items = Array.isArray(wo.items) ? wo.items : [];
  const itemsTotal = items.reduce((sum, item) => sum + (parseFloat(item.total_price) || 0), 0);

  const handleShareWhatsApp = () => {
    if (!wo.wo_id || isSharing) return;
    setIsSharing(true);
    salesOrderService
      .getWorkOrderPdf(wo.wo_id)
      .then((response) => {
        const body = response?.data;
        const fileUrl = body?.data?.file_url;
        if (body?.status !== "success" || !fileUrl) {
          throw new Error(body?.message || "Unable to generate the work order PDF.");
        }
        const text = encodeURIComponent(`*Work Order:* ${wo.wo_number || ""}\n${fileUrl}`);
        window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
      })
      .catch((err) => {
        const msg =
          err?.response?.data?.message || err?.response?.data?.error || err?.message || "Failed to share work order PDF.";
        useAlertReducer.getState().error(typeof msg === "string" ? msg : "Failed to share work order PDF.");
      })
      .finally(() => setIsSharing(false));
  };

  const metaFields = [
    { label: "Vessel Name", value: wo.vessel_name },
    { label: "Port", value: wo.port },
    { label: "Service Type", value: wo.service_type },
    { label: "Vendor Type", value: wo.vendor_type },
    { label: "Assigned To", value: wo.assigned_to_name || wo.assigned_to },
    { label: "Created By", value: wo.created_by_name || wo.created_by },
    { label: "Created Date", value: hasValue(wo.created_date) ? formatDateTime(wo.created_date) : null },
    { label: "Updated By", value: wo.updated_by },
    { label: "Updated Date", value: hasValue(wo.updated_date) ? formatDateTime(wo.updated_date) : null },
    { label: "Attachment", value: wo.request_email },
  ].filter((f) => hasValue(f.value));

  return (
    <div className="so-wo-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="so-wo-modal so-wod-modal"
        style={{ "--card-color": cardColor || "#2A00FF" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="so-wo-modal-header">
          <div className="so-wod-header-titles">
            <h2 className="so-wo-modal-title">{str(wo.wo_number)}</h2>
            {hasValue(wo.status) && (
              <span className="so-wod-status-badge" style={getStatusStyle(wo.status)}>
                {wo.status}
              </span>
            )}
          </div>
          <button type="button" className="so-wo-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="so-wo-modal-body">
          {isLoading && (
            <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-secondary)", fontSize: "14px" }}>
              Loading work order details…
            </div>
          )}

          {!isLoading && error && (
            <div
              role="alert"
              style={{
                padding: "12px 14px",
                borderRadius: "8px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          {!isLoading && !error && (
            <>
              {metaFields.length > 0 && (
                <div className="so-wod-meta-grid">
                  {metaFields.map((f) => (
                    <div className="so-wod-meta-item" key={f.label}>
                      <span className="so-wod-meta-label">{f.label}</span>
                      <span className="so-wod-meta-value">{f.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {items.length > 0 && (
                <div className="so-wod-items-section">
                  <div className="so-wod-items-title">Work Order Items ({items.length})</div>
                  <div className="so-wod-items-table-wrap">
                    <table className="so-wod-items-table">
                      <thead>
                        <tr>
                          <th>Item Code</th>
                          <th>Item Description</th>
                          <th className="so-wod-items-num">Qty</th>
                          <th className="so-wod-items-num">Unit Price</th>
                          <th className="so-wod-items-num">Discount %</th>
                          <th className="so-wod-items-num">Tax %</th>
                          <th className="so-wod-items-num">Total</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.wo_item_id}>
                            <td className="so-wod-items-code">{item.item_code || "—"}</td>
                            <td className="so-wod-items-desc" title={item.item_name || ""}>
                              {item.item_name || "—"}
                            </td>
                            <td className="so-wod-items-num">{item.quantity ?? "—"}</td>
                            <td className="so-wod-items-num">{formatCurrencySAR(item.unit_price)}</td>
                            <td className="so-wod-items-num">
                              {hasValue(item.discount_percentage) ? `${item.discount_percentage}%` : "—"}
                            </td>
                            <td className="so-wod-items-num">
                              {hasValue(item.tax_percentage) ? `${item.tax_percentage}%` : "—"}
                            </td>
                            <td className="so-wod-items-num so-wod-items-total">
                              {formatCurrencySAR(item.total_price)}
                            </td>
                            <td>
                              {hasValue(item.item_status) && (
                                <span className="so-wod-item-status-badge" style={getStatusStyle(item.item_status)}>
                                  {item.item_status}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={6} className="so-wod-items-total-label">
                            Total
                          </td>
                          <td className="so-wod-items-num so-wod-items-total">{formatCurrencySAR(itemsTotal)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="so-wo-modal-footer">
          {!isLoading && !error && wo.wo_id && (
            <button
              type="button"
              className="so-wo-btn so-wo-btn-share"
              onClick={handleShareWhatsApp}
              disabled={isSharing}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <FaWhatsapp size={16} color="#25D366" />
              {isSharing ? "Preparing PDF..." : "Share"}
            </button>
          )}
          <button type="button" className="so-wo-btn so-wo-btn-cancel" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

WorkOrderDetailsModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  error: PropTypes.oneOfType([PropTypes.string, PropTypes.oneOf([null])]),
  details: PropTypes.object,
  cardColor: PropTypes.string,
};

export default WorkOrderDetailsModal;
