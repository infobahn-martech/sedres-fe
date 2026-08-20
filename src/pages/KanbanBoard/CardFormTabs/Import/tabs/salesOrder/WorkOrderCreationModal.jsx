import React, { useState } from "react";
import PropTypes from "prop-types";
import { FaWhatsapp } from "react-icons/fa";

// Work Order Creation Modal - premium UI, styles live in salesOrder.scss
const WorkOrderCreationModal = ({
  show,
  onClose,
  onGenerate,
  isSubmitting = false,
  selectedItems,
  salesOrderList,
  cardColor,
  billingEntity = "",
  vesselName = "",
  portName = "",
}) => {
  const [createAs, setCreateAs] = useState("Draft");

  const selectedLineItems = salesOrderList.filter((item) => selectedItems.includes(item.id));

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isSubmitting) onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    onGenerate({ billingEntity, vesselName, portName, createAs });
  };

  const handleShareWhatsApp = () => {
    const lines = [
      `*Billing Entity:* ${billingEntity || "—"}`,
      `*Vessel:* ${vesselName || "—"}`,
      `*Port:* ${portName || "—"}`,
      `*Status:* ${createAs}`,
      "",
      `*Line Items (${selectedLineItems.length}):*`,
      ...selectedLineItems.map(
        (item) => `- ${item.itemNo || "—"} | ${item.itemDescription || "—"} | Qty: ${item.qty ?? "—"}`
      ),
    ];
    const text = encodeURIComponent(lines.join("\n"));
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  if (!show) return null;

  return (
    <div className="so-wo-modal-backdrop" onClick={handleBackdropClick}>
      <div
        className="so-wo-modal"
        style={{ "--card-color": cardColor || "#2A00FF" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="so-wo-modal-header">
          <h2 className="so-wo-modal-title">Work Order Creation</h2>
          <button type="button" className="so-wo-modal-close" onClick={onClose} disabled={isSubmitting}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="so-wo-modal-form">
          <div className="so-wo-modal-body">
            <div className="so-wo-field">
              <label className="so-wo-label">Billing Entity</label>
              <input type="text" className="so-wo-input so-wo-input-readonly" value={billingEntity} readOnly />
            </div>

            <div className="so-wo-field-row">
              <div className="so-wo-field">
                <label className="so-wo-label">Vessel Name</label>
                <input type="text" className="so-wo-input so-wo-input-readonly" value={vesselName} readOnly />
              </div>
              <div className="so-wo-field">
                <label className="so-wo-label">Port Name</label>
                <input type="text" className="so-wo-input so-wo-input-readonly" value={portName} readOnly />
              </div>
            </div>

            <div className="so-wo-field">
              <label className="so-wo-label">Selected Line ({selectedLineItems.length})</label>
              <div className="so-wo-line-list">
                {selectedLineItems.map((item) => (
                  <div key={item.id} className="so-wo-line-item">
                    <div className="so-wo-line-cell">
                      <span className="so-wo-line-cell-label">Item Code</span>
                      <div className="so-wo-line-cell-value">{item.itemNo || "—"}</div>
                    </div>
                    <div className="so-wo-line-cell">
                      <span className="so-wo-line-cell-label">Item Description</span>
                      <div className="so-wo-line-cell-value">{item.itemDescription || "—"}</div>
                    </div>
                    <div className="so-wo-line-cell so-wo-line-cell-qty">
                      <span className="so-wo-line-cell-label">Quantity</span>
                      <div className="so-wo-line-cell-value">{item.qty ?? "—"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="so-wo-field">
              <label className="so-wo-label">Create As</label>
              <select
                className="so-wo-input"
                value={createAs}
                onChange={(e) => setCreateAs(e.target.value)}
              >
                <option value="Draft">Draft</option>
                <option value="Active">Active</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
          </div>

          <div className="so-wo-modal-footer">
            <button
              type="button"
              className="so-wo-btn so-wo-btn-share"
              onClick={handleShareWhatsApp}
              disabled={isSubmitting || selectedLineItems.length === 0}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <FaWhatsapp size={16} color="#25D366" />
              Share
            </button>
            <button type="button" className="so-wo-btn so-wo-btn-cancel" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="so-wo-btn so-wo-btn-generate" disabled={isSubmitting}>
              {isSubmitting ? "Generating..." : "Generate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

WorkOrderCreationModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onGenerate: PropTypes.func.isRequired,
  isSubmitting: PropTypes.bool,
  selectedItems: PropTypes.arrayOf(PropTypes.number).isRequired,
  salesOrderList: PropTypes.array.isRequired,
  cardColor: PropTypes.string,
  billingEntity: PropTypes.string,
  vesselName: PropTypes.string,
  portName: PropTypes.string,
};

export default WorkOrderCreationModal;
