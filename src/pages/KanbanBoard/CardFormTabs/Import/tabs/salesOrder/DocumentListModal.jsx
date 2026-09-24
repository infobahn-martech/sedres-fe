import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { FiFileText, FiSearch, FiUploadCloud, FiUpload, FiX, FiCheck, FiPaperclip } from "react-icons/fi";
import useAlertReducer from "../../../../../../store/AlertReducer";
import "../../../../../../design/scss/salesOrder.scss";

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
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (show) {
      setSelected(new Set((initialSelected || []).map((d) => d.id)));
      setUploadedDocs([]);
      setSearch("");
      setIsUploading(false);
      setIsDragging(false);
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

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    handleFiles(files);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (isUploading) return;
    handleFiles(Array.from(e.dataTransfer?.files || []));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false);
  };

  const handleFiles = async (files) => {
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
      return { id: `local-${Date.now()}-${idx}`, name: file.name, type: ext || "FILE", file };
    });
    setUploadedDocs((prev) => [...prev, ...newDocs]);
    setSelected((prev) => {
      const next = new Set(prev);
      newDocs.forEach((d) => next.add(d.id));
      return next;
    });
  };

  const selectedCount = selected.size;

  return (
    <div
      className="so-doc-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="so-doc-modal" role="dialog" aria-modal="true" aria-labelledby="so-doc-modal-title">
        <div className="so-doc-modal-header">
          <span className="so-doc-modal-header-icon">
            <FiPaperclip />
          </span>
          <div className="so-doc-modal-heading">
            <h3 id="so-doc-modal-title" className="so-doc-modal-title">Select Supporting Documents</h3>
            <p className="so-doc-modal-subtitle">Pick from this call&apos;s documents or upload new files.</p>
          </div>
          <button type="button" className="so-doc-modal-close" onClick={onClose} aria-label="Close">
            <FiX />
          </button>
        </div>

        <div className="so-doc-modal-toolbar">
          <div className="so-doc-modal-search">
            <FiSearch className="so-doc-modal-search-icon" />
            <input
              type="text"
              placeholder="Search by document name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button type="button" className="so-doc-modal-search-clear" onClick={() => setSearch("")} aria-label="Clear search">
                <FiX />
              </button>
            )}
          </div>
          <label className={`so-doc-modal-upload-btn${isUploading ? " is-uploading" : ""}`}>
            <FiUpload />
            {isUploading ? "Uploading..." : "Upload New"}
            <input type="file" multiple onChange={handleFileUpload} disabled={isUploading} hidden />
          </label>
        </div>

        <div
          className={`so-doc-modal-body${isDragging ? " is-dragging" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {filtered.length === 0 ? (
            search ? (
              <div className="so-doc-modal-empty">
                <FiSearch className="so-doc-modal-empty-icon" />
                <span className="so-doc-modal-empty-title">No documents match &quot;{search}&quot;</span>
                <span className="so-doc-modal-empty-hint">Try a different name or upload a new file.</span>
              </div>
            ) : (
              <label className="so-doc-modal-dropzone">
                <FiUploadCloud className="so-doc-modal-dropzone-icon" />
                <span className="so-doc-modal-empty-title">No documents yet</span>
                <span className="so-doc-modal-empty-hint">
                  Drag &amp; drop files here, or <span className="so-doc-modal-link">browse</span> to upload
                </span>
                <input type="file" multiple onChange={handleFileUpload} disabled={isUploading} hidden />
              </label>
            )
          ) : (
            <div className="so-doc-modal-list">
              {filtered.map((d) => {
                const isChecked = selected.has(d.id);
                return (
                  <label key={d.id} className={`so-doc-modal-item${isChecked ? " is-selected" : ""}`}>
                    <input
                      type="checkbox"
                      className="so-doc-modal-item-checkbox"
                      checked={isChecked}
                      onChange={() => toggleDocument(d.id)}
                    />
                    <span className="so-doc-modal-item-icon">
                      <FiFileText />
                    </span>
                    <span className="so-doc-modal-item-name" title={d.name}>{d.name}</span>
                    {d.type && <span className="so-doc-modal-item-type">{d.type}</span>}
                    <span className="so-doc-modal-item-check" aria-hidden="true">
                      <FiCheck />
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          {isDragging && (
            <div className="so-doc-modal-drop-overlay">
              <FiUploadCloud />
              Drop files to upload
            </div>
          )}
        </div>

        <div className="so-doc-modal-footer">
          <span className="so-doc-modal-count">
            {selectedCount > 0 ? `${selectedCount} document${selectedCount > 1 ? "s" : ""} selected` : "No documents selected"}
          </span>
          <div className="so-doc-modal-actions">
            <button type="button" className="sales-order-add-form-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="sales-order-add-form-save" onClick={handleSave} disabled={isUploading}>
              Save
            </button>
          </div>
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
