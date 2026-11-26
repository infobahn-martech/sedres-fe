import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { FiSearch, FiX, FiCheckCircle, FiCheck, FiUploadCloud, FiFileText, FiShield } from "react-icons/fi";
import TabEmptyState from "@/components/TabEmptyState";
import DocumentPreview from "@/pages/KanbanBoard/CardFormTabs/Import/tabs/appointment/documentLibrary/DocumentPreview";
import { TaskDocumentFilePreview } from "../../shared/TaskDocuments";
import {
  formatGroDocumentDisplayName,
  getDocumentFileTypeIcon,
  getGroDocumentVerifyStatus,
  groDocumentHasDownloadableUrl,
} from "./groCardUtils";
import "@/design/scss/documentLibrary.scss";

// GRO status: 0 not uploaded · 1 awaiting verification · 2 verified · 3 reupload · 4 rejected.
const STATUS_META = {
  0: { label: "Not uploaded", tone: "muted" },
  1: { label: "Pending", tone: "pending" },
  2: { label: "Verified", tone: "verified" },
  3: { label: "Reupload", tone: "warning" },
  4: { label: "Rejected", tone: "danger" },
};

// Document Library preview speaks its own file-type vocabulary.
const LIBRARY_TYPE_BY_KIND = { pdf: "pdf", word: "doc", excel: "xls", image: "image", mail: "msg" };

const firstText = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const toLibraryDocument = (doc) => {
  const kind = getDocumentFileTypeIcon(doc.file_name, doc.file_url, doc);
  const type = LIBRARY_TYPE_BY_KIND[kind] ?? "file";
  return {
    id: doc.__rowKey,
    type,
    fileType: type,
    name: formatGroDocumentDisplayName(doc.document_name ?? ""),
    uploadedBy: firstText(doc.uploaded_by, doc.uploaded_by_name, doc.uploaded_by_user?.name),
    date: firstText(doc.uploaded_at, doc.updated_at, doc.created_at),
    previewUrl: doc.file_url || undefined,
  };
};

/**
 * Documents tab of a GRO / Custom Clearance task card, laid out like the Document Library:
 * a document list on the left and a live preview on the right, under the same brand band
 * as the task's own tab so switching tabs keeps the card's frame still.
 */
export default function GroTaskDocumentsPanel({
  navigation = null,
  actions = null,
  taskTitle = "",
  documents,
  isGroLoading,
  isSubmittingAction = false,
  showDocumentVerifyActions = false,
  onApproveClick,
  onRejectClick,
}) {
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState(null);
  const listRef = useRef(null);
  const safeDocuments = useMemo(() => (Array.isArray(documents) ? documents : []), [documents]);

  const term = search.trim().toLowerCase();
  const visibleDocuments = useMemo(
    () =>
      term
        ? safeDocuments.filter((doc) =>
            formatGroDocumentDisplayName(doc?.document_name ?? "").toLowerCase().includes(term)
          )
        : safeDocuments,
    [safeDocuments, term]
  );

  // Keep a valid selection: the current one if still listed, else the first document with a file.
  useEffect(() => {
    if (visibleDocuments.some((doc) => doc.__rowKey === selectedKey)) return;
    const firstWithFile = visibleDocuments.find(groDocumentHasDownloadableUrl) ?? visibleDocuments[0];
    setSelectedKey(firstWithFile?.__rowKey ?? null);
  }, [visibleDocuments, selectedKey]);

  const selectedDoc = useMemo(
    () => safeDocuments.find((doc) => doc.__rowKey === selectedKey) ?? null,
    [safeDocuments, selectedKey]
  );
  const libraryDocument = useMemo(() => (selectedDoc ? toLibraryDocument(selectedDoc) : null), [selectedDoc]);

  const verifiedCount = useMemo(
    () => safeDocuments.filter((doc) => getGroDocumentVerifyStatus(doc) === 2).length,
    [safeDocuments]
  );
  const total = safeDocuments.length;
  const allVerified = total > 0 && verifiedCount === total;

  // Up / Down moves through the list like a file manager.
  const handleListKeyDown = (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const index = visibleDocuments.findIndex((doc) => doc.__rowKey === selectedKey);
    const nextIndex = Math.min(
      visibleDocuments.length - 1,
      Math.max(0, index + (e.key === "ArrowDown" ? 1 : -1))
    );
    const next = visibleDocuments[nextIndex];
    if (!next) return;
    setSelectedKey(next.__rowKey);
    listRef.current?.querySelector(`[data-row-key="${CSS.escape(String(next.__rowKey))}"]`)?.focus();
  };

  const selectedStatus = selectedDoc ? getGroDocumentVerifyStatus(selectedDoc) : 0;
  const selectedRemarks = String(selectedDoc?.remarks ?? "").trim();
  const canVerifySelected = showDocumentVerifyActions && selectedStatus === 1;

  // Verification strip (pending → Approve / Reject, or the review remarks), shown inside
  // the selected document's row.
  const reviewStrip =
    selectedDoc && (canVerifySelected || selectedRemarks) ? (
      <div className={`gro-docs-lib-review gro-docs-lib-review--${STATUS_META[selectedStatus].tone}`}>
        <span className="gro-docs-lib-review-text" title={selectedRemarks || undefined}>
          {canVerifySelected ? "Awaiting your verification" : `${STATUS_META[selectedStatus].label}`}
          {selectedRemarks ? <span className="gro-docs-lib-review-remarks">{` · ${selectedRemarks}`}</span> : null}
        </span>
        {canVerifySelected ? (
          <span className="gro-docs-lib-review-actions">
            <button
              type="button"
              className="gro-docs-lib-review-btn gro-docs-lib-review-btn--reject"
              disabled={isSubmittingAction}
              onClick={() => onRejectClick(selectedDoc)}
            >
              <FiX aria-hidden />
              Reject
            </button>
            <button
              type="button"
              className="gro-docs-lib-review-btn gro-docs-lib-review-btn--approve"
              disabled={isSubmittingAction}
              onClick={() => onApproveClick(selectedDoc)}
            >
              <FiCheck aria-hidden />
              Approve
            </button>
          </span>
        ) : null}
      </div>
    ) : null;

  return (
    <div className="gro-crew-immigration-panel gro-crew-imm-panel gro-crew-imm-panel--docs">
      <div className="gro-crew-immigration-toolbar gro-crew-imm-toolbar">
        <div className="gro-crew-imm-toolbar-group">
          {navigation ? (
            <>
              {navigation}
              <span className="gro-crew-imm-toolbar-divider" aria-hidden />
            </>
          ) : null}
          {isGroLoading ? (
            <span className="gro-skeleton gro-skel-on-brand gro-skel-pill" aria-hidden="true" />
          ) : total === 0 ? null : (
            <span
              className={`gro-crew-imm-band-stat${allVerified ? " gro-crew-imm-band-stat--done" : ""}`}
              aria-live="polite"
            >
              <FiCheckCircle aria-hidden />
              {`${verifiedCount} of ${total} verified`}
            </span>
          )}
        </div>

        <div className="gro-crew-imm-toolbar-group gro-crew-imm-toolbar-group--end">
          {total > 0 ? (
          <label className="gro-crew-imm-search">
            <FiSearch aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents…"
              aria-label="Search documents"
            />
            {search ? (
              <button
                type="button"
                className="gro-crew-imm-search-clear"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <FiX />
              </button>
            ) : null}
          </label>
          ) : null}
          {actions ? <div className="gro-pass-segments gro-crew-imm-actions">{actions}</div> : null}
        </div>
      </div>

      {!isGroLoading && total === 0 ? (
        <div className="gro-docs-lib-none">
          <TabEmptyState
            variant="documents"
            title="No documents yet"
            description={
              taskTitle
                ? `Documents for ${taskTitle} will appear here as soon as they are uploaded or generated, ready to preview and verify.`
                : "Documents for this task will appear here as soon as they are uploaded or generated, ready to preview and verify."
            }
            hints={[
              { icon: FiUploadCloud, label: "Uploaded files" },
              { icon: FiFileText, label: "Generated letters" },
              { icon: FiShield, label: "Verification" },
            ]}
          />
        </div>
      ) : (
      <div className="gro-docs-lib">
        <section className="gro-docs-lib-list" aria-label="Documents">
          {isGroLoading ? (
            <div className="gro-docs-lib-message" role="status">
              <span className="gro-skel-spinner" aria-hidden="true" />
              Loading documents…
            </div>
          ) : visibleDocuments.length === 0 ? (
            <div className="gro-docs-lib-message">
              {term ? `No documents match “${search.trim()}”.` : "No documents yet."}
            </div>
          ) : (
            <div ref={listRef} role="listbox" aria-label="Documents" onKeyDown={handleListKeyDown}>
              {visibleDocuments.map((doc) => {
                const status = getGroDocumentVerifyStatus(doc);
                const meta = STATUS_META[status];
                const isSelected = doc.__rowKey === selectedKey;
                return (
                  <div
                    key={doc.__rowKey}
                    className={`gro-docs-lib-row${isSelected ? " is-selected" : ""}${status === 0 ? " is-empty" : ""}`}
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      tabIndex={isSelected ? 0 : -1}
                      data-row-key={doc.__rowKey}
                      className="gro-docs-lib-row-select"
                      onClick={() => setSelectedKey(doc.__rowKey)}
                    >
                      <TaskDocumentFilePreview fileName={doc.file_name} fileUrl={doc.file_url} document={doc} />
                      <span className="gro-docs-lib-row-main">
                        <span className="gro-docs-lib-row-name" title={formatGroDocumentDisplayName(doc.document_name)}>
                          {formatGroDocumentDisplayName(doc.document_name)}
                        </span>
                        <span className="gro-docs-lib-row-meta">
                          <span className={`gro-docs-lib-status gro-docs-lib-status--${meta.tone}`}>{meta.label}</span>
                          {doc.file_name ? <span className="gro-docs-lib-row-file">{doc.file_name}</span> : null}
                        </span>
                      </span>
                    </button>
                    {isSelected ? reviewStrip : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <aside className="gro-docs-lib-preview" aria-label="Document preview">
          {selectedDoc && !groDocumentHasDownloadableUrl(selectedDoc) ? (
            <div className="gro-docs-lib-empty">
              <FiUploadCloud aria-hidden />
              <p className="gro-docs-lib-empty-title">{libraryDocument?.name}</p>
              <p className="gro-docs-lib-empty-text">No file has been uploaded for this document yet.</p>
            </div>
          ) : (
            <DocumentPreview document={isGroLoading ? null : libraryDocument} />
          )}
        </aside>
      </div>
      )}
    </div>
  );
}

GroTaskDocumentsPanel.propTypes = {
  navigation: PropTypes.node,
  actions: PropTypes.node,
  taskTitle: PropTypes.string,
  documents: PropTypes.array.isRequired,
  isGroLoading: PropTypes.bool.isRequired,
  isSubmittingAction: PropTypes.bool,
  showDocumentVerifyActions: PropTypes.bool,
  onApproveClick: PropTypes.func.isRequired,
  onRejectClick: PropTypes.func.isRequired,
};
