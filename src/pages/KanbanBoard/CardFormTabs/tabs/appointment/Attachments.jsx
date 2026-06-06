import PropTypes from "prop-types";
import { useEffect, useMemo, useState } from "react";
import attachmentsService from "../../../../../services/attachmentsService";
import CardTabListLoading from "../../../../../components/CardTabListLoading";
import "../../../../../design/scss/attachments.scss";

/** Title case for display labels (category keys, checklist item names). */
const toTitleCase = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const AttachmentItem = ({ attachment, onView, cardColor }) => {
  const getFileIcon = (fileName) => {
    const extension = fileName?.split('.').pop()?.toLowerCase() || '';

    // PDF Icon
    if (extension === 'pdf') {
      return (
        <div className="file-icon-pdf">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="6" fill="#DC2626" />
            <text x="16" y="22" textAnchor="middle" fill="white" fontSize="10" fontWeight="600">PDF</text>
          </svg>
        </div>
      );
    }

    // Word/DOCX Icon
    if (['doc', 'docx'].includes(extension)) {
      return (
        <div className="file-icon-doc">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="6" fill="#2B579A" />
            <path d="M10 8H18L22 12V24C22 24.5523 21.5523 25 21 25H11C10.4477 25 10 24.5523 10 24V9C10 8.44772 10.4477 8 11 8Z" fill="white" opacity="0.9" />
            <path d="M18 8V12H22" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 16H20M12 19H20M12 22H16" stroke="#2B579A" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </div>
      );
    }

    // Image Icon
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
      return (
        <div className="file-icon-image">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="6" fill="#10B981" />
            <rect x="6" y="8" width="20" height="14" rx="2" fill="white" opacity="0.9" />
            <circle cx="12" cy="13" r="2" fill="#10B981" />
            <path d="M6 20L10 16L14 20L20 14L26 20V22C26 22.5523 25.5523 23 25 23H7C6.44772 23 6 22.5523 6 22V20Z" fill="#10B981" />
          </svg>
        </div>
      );
    }

    // Excel Icon
    if (['xls', 'xlsx'].includes(extension)) {
      return (
        <div className="file-icon-excel">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="6" fill="#107C41" />
            <text x="16" y="22" textAnchor="middle" fill="white" fontSize="8" fontWeight="600">XLS</text>
          </svg>
        </div>
      );
    }

    // Outlook .msg
    if (extension === "msg") {
      return (
        <div className="file-icon-msg">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="6" fill="#4F46E5" />
            <path
              d="M9 8.5h14a1 1 0 011 1v4.5H8V9.5a1 1 0 011-1z"
              stroke="white"
              strokeWidth="1.1"
              fill="white"
              fillOpacity="0.15"
            />
            <path d="M9 9.5l7 3 7-3" stroke="white" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
            <text x="16" y="23.5" textAnchor="middle" fill="white" fontSize="8" fontWeight="700">
              MSG
            </text>
          </svg>
        </div>
      );
    }

    // Default Document Icon
    return (
      <div className="file-icon-default">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="32" height="32" rx="6" fill="#6B7280" />
          <path d="M9 6H16L21 11V26C21 26.5523 20.5523 27 20 27H10C9.44772 27 9 26.5523 9 26V7C9 6.44772 9.44772 6 10 6Z" fill="white" opacity="0.9" />
          <path d="M16 6V11H21" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = Math.round(bytes / Math.pow(k, i) * 100) / 100;
    return size.toFixed(2) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const normalized =
      typeof dateString === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(dateString)
        ? dateString.replace(" ", "T")
        : dateString;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return "—";
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const year = date.getFullYear();
    const time = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return `${month} ${day}, ${year}, ${time}`;
  };

  const displayName = attachment.fileName?.trim() || "—";

  return (
    <div className="attachment-item">
      <div className="attachment-icon-wrapper">
        {getFileIcon(attachment.fileName)}
      </div>
      <div className="attachment-details">
        <div className="attachment-name">{displayName}</div>
        <div className="attachment-meta">
          {attachment.fileSize != null && attachment.fileSize > 0 && (
            <>
              <span className="attachment-size">{formatFileSize(attachment.fileSize)}</span>
              <span className="attachment-separator">•</span>
            </>
          )}
          <span className="attachment-date">{formatDate(attachment.uploadedAt)}</span>
          {attachment.uploadedBy && (
            <>
              <span className="attachment-separator">•</span>
              <span className="attachment-uploader">by {attachment.uploadedBy}</span>
            </>
          )}
        </div>
      </div>
      <div className="attachment-actions">
        {onView && (
          <button
            className="attachment-action-btn view"
            onClick={() => onView(attachment)}
            type="button"
            title={attachment.fileUrl ? "View in new tab" : "No file link"}
            disabled={!attachment.fileUrl}
            style={{ "--card-color": cardColor }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path
                d="M1.5 9s3-5.25 7.5-5.25S16.5 9 16.5 9s-3 5.25-7.5 5.25S1.5 9 1.5 9Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="9" cy="9" r="2.25" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

AttachmentItem.propTypes = {
  attachment: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    fileName: PropTypes.string,
    fileSize: PropTypes.number,
    uploadedAt: PropTypes.string,
    uploadedBy: PropTypes.string,
    fileUrl: PropTypes.string,
    category: PropTypes.string,
  }).isRequired,
  onView: PropTypes.func,
  cardColor: PropTypes.string,
};

const AttachmentCategory = ({ label, attachments, onView, cardColor }) => {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <div className="attachment-category">
      <div className="attachment-category-header">
        <h4 className="attachment-category-label">{label}</h4>
        <span className="attachment-category-count-badge" aria-label={`${attachments.length} file(s)`}>
          {attachments.length}
        </span>
      </div>
      <div className="attachments-items">
        {attachments.map((attachment, idx) => (
          <AttachmentItem
            key={attachment.id != null ? String(attachment.id) : `att-${idx}`}
            attachment={attachment}
            onView={onView}
            cardColor={cardColor}
          />
        ))}
      </div>
    </div>
  );
};

AttachmentCategory.propTypes = {
  label: PropTypes.string.isRequired,
  attachments: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      fileName: PropTypes.string,
      fileSize: PropTypes.number,
      uploadedAt: PropTypes.string,
      uploadedBy: PropTypes.string,
      fileUrl: PropTypes.string,
      category: PropTypes.string,
    })
  ),
  onView: PropTypes.func,
  cardColor: PropTypes.string,
};

const AttachmentList = ({ attachments, onView, cardColor }) => {
  // Group attachments by category/label
  const groupedAttachments = useMemo(() => {
    if (!attachments || attachments.length === 0) {
      return {};
    }

    const grouped = {};
    attachments.forEach((attachment) => {
      const category = attachment.category || "Other Documents";
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(attachment);
    });

    return grouped;
  }, [attachments]);

  if (!attachments || attachments.length === 0) {
    return (
      <div className="attachments-list">
        <div className="attachments-categories">
          <div className="attachments-empty-state">
            <p>No attachments added.</p>
          </div>
        </div>
      </div>
    );
  }

  const categories = Object.keys(groupedAttachments);

  return (
    <div className="attachments-list">
      <div className="attachments-categories">
        {categories.map((category) => (
          <AttachmentCategory
            key={category}
            label={toTitleCase(category.trim())}
            attachments={groupedAttachments[category]}
            onView={onView}
            cardColor={cardColor}
          />
        ))}
      </div>
    </div>
  );
};

AttachmentList.propTypes = {
  attachments: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      fileName: PropTypes.string,
      fileSize: PropTypes.number,
      uploadedAt: PropTypes.string,
      uploadedBy: PropTypes.string,
      fileUrl: PropTypes.string,
      category: PropTypes.string,
    })
  ),
  onView: PropTypes.func,
  cardColor: PropTypes.string,
};

const ChecklistList = ({ checklistItems, onView, cardColor }) => {
  if (!checklistItems || checklistItems.length === 0) {
    return (
      <div className="attachments-list">
        <div className="attachments-categories">
          <div className="attachments-empty-state">
            <p>No checklist items or documents.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="attachments-list">
      <div className="attachments-categories">
        {checklistItems.map((item) => {
          const rawName = item.itemName?.trim() || "—";
          const label = toTitleCase(rawName);
          const documents = item.documents || [];
          return (
            <div key={String(item.id)} className="attachment-category">
              <div className="attachment-category-header">
                <h4 className="attachment-category-label">{label}</h4>
                <span className="attachment-category-count-badge" aria-label={`${documents.length} file(s)`}>
                  {documents.length}
                </span>
              </div>
              <div className="attachments-items">
                {documents.length === 0 ? (
                  <p className="checklist-doc-empty">No documents uploaded.</p>
                ) : (
                  documents.map((doc, idx) => (
                    <AttachmentItem
                      key={doc.id != null ? String(doc.id) : `chk-doc-${String(item.id)}-${idx}`}
                      attachment={doc}
                      onView={onView}
                      cardColor={cardColor}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

ChecklistList.propTypes = {
  checklistItems: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      itemName: PropTypes.string,
      documents: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
          fileName: PropTypes.string,
          uploadedAt: PropTypes.string,
          uploadedBy: PropTypes.string,
          fileUrl: PropTypes.string,
          category: PropTypes.string,
        })
      ),
    })
  ),
  onView: PropTypes.func,
  cardColor: PropTypes.string,
};

const resolveAttachmentFileUrl = (fileUrl) => {
  const s = String(fileUrl || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s) || s.startsWith("blob:")) return s;
  const base = String(import.meta.env.VITE_API_ENDPOINT || "").replace(/\/+$/, "");
  if (!base) return s.startsWith("/") ? s : `/${s}`;
  return s.startsWith("/") ? `${base}${s}` : `${base}/${s}`;
};

const getViewerUrl = (url, fileName = "") => {
  const extension = fileName.split(".").pop()?.toLowerCase();

  const officeExtensions = [
    "doc",
    "docx",
    "xls",
    "xlsx",
    "ppt",
    "pptx",
  ];

  if (officeExtensions.includes(extension)) {
    return `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
  }

  return url;
};

const mapDocumentRow = (item, category, idPrefix, index) => {
  const fileName = item?.file_name != null ? String(item.file_name).trim() : "";
  return {
    id: `${idPrefix}::${index}::${fileName || "file"}`,
    fileName,
    uploadedBy: item?.uploaded_by != null ? String(item.uploaded_by) : "",
    uploadedAt:
      item?.date != null
        ? String(item.date)
        : item?.uploaded_at != null
          ? String(item.uploaded_at)
          : "",
    fileUrl: item?.file_url ?? item?.url ?? null,
    category,
  };
};

/** Map category-keyed documents (e.g. `stage_documents`, legacy `attachments`). */
const mapAttachmentsByCategory = (attachmentsByCategory) => {
  if (!attachmentsByCategory || typeof attachmentsByCategory !== "object" || Array.isArray(attachmentsByCategory)) {
    return [];
  }

  const flat = [];
  Object.entries(attachmentsByCategory).forEach(([category, items]) => {
    if (!Array.isArray(items)) return;
    items.forEach((item, index) => {
      flat.push(mapDocumentRow(item, category, category, index));
    });
  });
  return flat;
};

/** Flatten `task_documents` — object keyed by category or role/task groups. */
const mapTaskDocumentsResponse = (taskDocuments) => {
  if (!taskDocuments) return [];
  if (typeof taskDocuments === "object" && !Array.isArray(taskDocuments)) {
    return mapAttachmentsByCategory(taskDocuments);
  }
  if (!Array.isArray(taskDocuments)) return [];

  const flat = [];
  taskDocuments.forEach((entry, entryIdx) => {
    const category =
      entry?.role_name ||
      entry?.role ||
      entry?.task_name ||
      entry?.taskName ||
      "Task Documents";

    const nestedDocs = Array.isArray(entry?.documents)
      ? entry.documents
      : Array.isArray(entry?.tasks)
        ? entry.tasks.flatMap((task) => (Array.isArray(task?.documents) ? task.documents : []))
        : [];

    if (nestedDocs.length) {
      nestedDocs.forEach((item, index) => {
        flat.push(mapDocumentRow(item, category, `task-${entryIdx}`, index));
      });
      return;
    }

    if (entry?.file_name != null || entry?.file_url != null || entry?.url != null) {
      flat.push(mapDocumentRow(entry, category, `task-${entryIdx}`, 0));
    }
  });
  return flat;
};

/** Build attachment list from `get_all_attachments` payload. */
const buildAttachmentListFromPayload = (payload = {}) => [
  ...mapAttachmentsByCategory(payload.stage_documents ?? payload.stageDocuments),
  ...mapTaskDocumentsResponse(payload.task_documents ?? payload.taskDocuments),
  ...mapAttachmentsByCategory(payload.attachments),
];

/** Map `checklist_documents` / legacy `checklist` — items with nested documents. */
const mapChecklistResponse = (checklist) => {
  if (!Array.isArray(checklist)) return [];

  return checklist.map((row, idx) => ({
    id: row?.checklist_item_id ?? row?.call_checklist_item_id ?? `checklist-item-${idx}`,
    itemName: row?.item_name != null ? String(row.item_name) : "",
    documents: Array.isArray(row?.documents)
      ? row.documents.map((doc, dIdx) => ({
        id: doc?.checklist_item_file_id ?? `${idx}-doc-${dIdx}`,
        fileName: doc?.file_name != null ? String(doc.file_name) : "",
        uploadedBy: doc?.uploaded_by != null ? String(doc.uploaded_by) : "",
        uploadedAt: doc?.uploaded_at != null ? String(doc.uploaded_at) : "",
        fileUrl: doc?.file_url ?? null,
        category: "Checklist",
      }))
      : [],
  }));
};

function DocumentLibrary({ card, formValues }) {
  const cardColor = card?.color || "#2A00FF";

  const callId = useMemo(() => {
    const raw = card?.call_id ?? formValues?.call_id ?? card?.callId;
    if (raw === undefined || raw === null) return "";
    const s = String(raw).trim();
    return s;
  }, [card?.call_id, card?.callId, formValues?.call_id]);

  const [attachments, setAttachments] = useState([]);
  const [checklistItems, setChecklistItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!callId) {
      setAttachments([]);
      setChecklistItems([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    attachmentsService
      .getAllAttachments(callId)
      .then((res) => {
        if (cancelled) return;
        const body = res?.data;
        if (body?.status !== true) {
          setAttachments([]);
          setChecklistItems([]);
          setError(body?.message || "Failed to load attachments.");
          return;
        }
        const payload = body?.data || {};
        setError(null);
        setAttachments(buildAttachmentListFromPayload(payload));
        setChecklistItems(
          mapChecklistResponse(
            payload.checklist_documents ??
            payload.checklistDocuments ??
            payload.checklist
          )
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setAttachments([]);
        setChecklistItems([]);
        setError(
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Failed to load attachments."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [callId]);

  const handleView = (attachment) => {
    const rawUrl = attachment?.fileUrl;

    if (!rawUrl) {
      window.alert("No link is available for this attachment.");
      return;
    }

    const absUrl = resolveAttachmentFileUrl(rawUrl);

    const viewerUrl = getViewerUrl(
      absUrl,
      attachment?.fileName || ""
    );

    window.open(viewerUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="cardform-body">
      <div className="cardform-left-full attachments-content-wrapper" style={{ "--card-color": cardColor }}>
        <div className="attachments-list-header">
          <h3 className="attachments-list-title">
            <span className="attachments-list-title-bar" aria-hidden />
            <span className="attachments-list-title-text">Attachment List</span>
          </h3>
        </div>
        {!callId ? (
          <div className="attachments-list">
            <div className="attachments-categories">
              <div className="attachments-empty-state">
                <p>No call identifier available for attachments.</p>
              </div>
            </div>
          </div>
        ) : loading ? (
          <CardTabListLoading message="Loading attachments…" cardColor={cardColor} />
        ) : error ? (
          <div className="attachments-list">
            <div className="attachments-categories">
              <div className="attachments-empty-state">
                <p>{error}</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <AttachmentList
              attachments={attachments}
              onView={handleView}
              cardColor={cardColor}
            />
            <div className="">
              <div className="attachments-list-header">
                <h3 className="attachments-list-title">
                  <span className="attachments-list-title-bar" aria-hidden />
                  <span className="attachments-list-title-text">Checklist</span>
                  {/* <span className="attachments-section-badge" aria-label={`${checklistItems.length} checklist items`}>
                    {checklistItems.length}
                  </span> */}
                </h3>
              </div>
              <ChecklistList
                checklistItems={checklistItems}
                onView={handleView}
                cardColor={cardColor}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

DocumentLibrary.propTypes = {
  card: PropTypes.object,
  formValues: PropTypes.object,
  handleChange: PropTypes.func,
};

export default DocumentLibrary;

