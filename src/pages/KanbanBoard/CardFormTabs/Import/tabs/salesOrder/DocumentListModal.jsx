import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { FiFileText } from "react-icons/fi";
import useAlertReducer from "../../../../../../store/AlertReducer";

// Document List Modal — manages the documents already attached to a sales order item
// (sourced from the API's per-item `documents` array) plus any newly uploaded this session.
// No shared document library concept — each item only ever shows/edits its own files.
// Also reused by SoApprovalEmailModal's "From Document Library" attachment option (soItemId
// left null there — see its own usage comment) so staff can pick from the same
// attachments/get_all_supporting_docs library instead of only browsing their device.
const DocumentListModal = ({ show, onClose, onSave, initialSelected = [], libraryDocs = [], soItemId = null, onUploadDocuments }) => {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (show) {
      setSelected(new Set((initialSelected || []).map((d) => d.id)));
      setUploadedDocs([]);
      setSearch("");
      setIsUploading(false);
    }
    // Only reset when modal opens; initialSelected is captured at open time via key on parent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  if (!show) return null;

  // initialSelected first (so already-attached docs keep their id/name), then the call's
  // supporting-doc library (attachments/get_all_supporting_docs — always offered), then any
  // newly uploaded this session. Deduped by id so a doc already attached isn't listed twice.
  const seenDocIds = new Set();
  const allDocs = [...(initialSelected || []), ...libraryDocs, ...uploadedDocs].filter((d) => {
    if (seenDocIds.has(d.id)) return false;
    seenDocIds.add(d.id);
    return true;
  });
  const filtered = allDocs.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));

  const toggleDocument = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = () => {
    const selectedDocuments = allDocs.filter((d) => selected.has(d.id));
    onSave(selectedDocuments);
    onClose();
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;

    // Item already exists on the backend — upload immediately via
    // sales_order/add_so_item_document. A not-yet-saved "new" item has no so_item_id yet,
    // so its files stay staged locally until the item itself is saved.
    if (soItemId && onUploadDocuments) {
      setIsUploading(true);
      try {
        const uploaded = await onUploadDocuments(files);
        setUploadedDocs((prev) => [...prev, ...uploaded]);
        setSelected((prev) => {
          const next = new Set(prev);
          uploaded.forEach((d) => next.add(d.id));
          return next;
        });
      } catch (err) {
        const msg = err?.response?.data?.message || err?.message || "Failed to upload document(s).";
        useAlertReducer.getState().error(msg);
      } finally {
        setIsUploading(false);
      }
      return;
    }

    const newDocs = files.map((file, idx) => {
      const ext = (file.name.split(".").pop() || "").toUpperCase();
      return { id: `local-${Date.now()}-${idx}`, name: file.name, type: ext || "FILE" };
    });
    setUploadedDocs((prev) => [...prev, ...newDocs]);
    setSelected((prev) => {
      const next = new Set(prev);
      newDocs.forEach((d) => next.add(d.id));
      return next;
    });
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: "16px", boxSizing: "border-box" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#fff", borderRadius: "12px", width: "94%", maxWidth: "920px", maxHeight: "82vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "22px 28px", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#1a1a2e" }}>Select Supporting Documents</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer", color: "#888", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: "16px 28px", borderBottom: "1px solid #eee", flexShrink: 0, display: "flex", gap: "12px", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search by document name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            style={{ flex: 1, padding: "11px 16px", border: "1px solid #dde0ea", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box", fontFamily: "inherit" }}
          />
          <label
            style={{ padding: "11px 18px", fontSize: "14px", border: "1px solid #dde0ea", borderRadius: "8px", background: isUploading ? "#eceefc" : "#f5f6ff", color: "#2A00FF", cursor: isUploading ? "wait" : "pointer", fontFamily: "inherit", fontWeight: "600", whiteSpace: "nowrap", flexShrink: 0, opacity: isUploading ? 0.7 : 1 }}
          >
            {isUploading ? "Uploading..." : "Upload New"}
            <input type="file" multiple onChange={handleFileUpload} disabled={isUploading} style={{ display: "none" }} />
          </label>
        </div>
        <div style={{ overflowY: "auto", flex: 1, minHeight: 0, padding: "18px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "12px", alignContent: "start" }}>
          {filtered.length === 0 ? (
            <div style={{ gridColumn: "1 / -1", padding: "32px", textAlign: "center", color: "#888", fontSize: "14px" }}>No documents found.</div>
          ) : (
            filtered.map((d) => {
              const isChecked = selected.has(d.id);
              return (
                <label
                  key={d.id}
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    padding: "14px 16px",
                    border: `1px solid ${isChecked ? "#b3baff" : "#e6e9f2"}`,
                    borderRadius: "10px",
                    background: isChecked ? "#f3f4ff" : "#ffffff",
                    boxShadow: isChecked ? "0 2px 8px rgba(42, 0, 255, 0.08)" : "0 1px 3px rgba(15, 23, 42, 0.05)",
                    transition: "border-color 0.15s, background 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => { if (!isChecked) e.currentTarget.style.background = "#f7f8ff"; }}
                  onMouseLeave={(e) => { if (!isChecked) e.currentTarget.style.background = "#ffffff"; }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleDocument(d.id)}
                    style={{ width: "17px", height: "17px", cursor: "pointer", flexShrink: 0, accentColor: "#2A00FF" }}
                  />
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "42px",
                      height: "42px",
                      borderRadius: "9px",
                      background: "#eef1ff",
                      color: "#2A00FF",
                      flexShrink: 0,
                    }}
                  >
                    <FiFileText size={20} />
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: "14px", lineHeight: 1.4, color: "#1a1a2e", fontWeight: "600", minWidth: 0, wordBreak: "break-word" }}>{d.name}</span>
                    <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#5a5f8a", background: "#f0f2ff", padding: "2px 7px", borderRadius: "4px", alignSelf: "flex-start" }}>{d.type}</span>
                  </span>
                </label>
              );
            })
          )}
        </div>
        <div style={{ padding: "16px 28px", borderTop: "1px solid #eee", display: "flex", justifyContent: "flex-end", gap: "12px", flexShrink: 0 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "11px 22px", fontSize: "14px", fontWeight: "600", border: "1px solid #dde0ea", borderRadius: "8px", background: "#fff", color: "#333", cursor: "pointer", fontFamily: "inherit" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#f5f6fa"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{ padding: "11px 22px", fontSize: "14px", border: "none", borderRadius: "8px", background: "#00368c", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: "600", boxShadow: "0 4px 14px rgba(0, 54, 140, 0.32)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#002a6e"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#00368c"; }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

DocumentListModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  initialSelected: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      name: PropTypes.string.isRequired,
      type: PropTypes.string,
    })
  ),
  libraryDocs: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      name: PropTypes.string.isRequired,
      type: PropTypes.string,
    })
  ),
  soItemId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onUploadDocuments: PropTypes.func,
};

export default DocumentListModal;
