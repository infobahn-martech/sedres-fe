import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  X, FileText, UploadCloud, Hash, Tag, Clock, User, Ship,
  CalendarCheck, Anchor, Receipt, Package,
  Paperclip, FolderOpen, ChevronDown, Search,
  CheckCircle2, CircleDashed, Banknote, FileArchive, ShieldCheck, Loader2, AlertCircle, Eye,
  Download, Printer,
} from "lucide-react";
import { debounce } from "lodash";
import { notify } from "../../../../../../components/Toaster";
import CustomModal from "../../../../../../components/CustomModal";
import daService from "../../../../../../services/daService";
import userService from "../../../../../../services/userService";
import { getInitials } from "../../../../../../shared/utils/utils";
import { useDaLocalReachedDates, useDaLocalLaunchHire } from "../../../../../../shared/store/daStore";
import { parseApiDateTime, mapStatusTimelineResponse } from "./daStatusTimeline";
import "../../../../../../design/scss/pages/kanban-board/daCardFields.scss";

// Card / Appointment & Clearance / MWP / Launch Hire / Clearance Copies / Invoices,
// Nested sub-tabs shown inside the "DA Operations" section.
const DA_OPERATOR_SUB_TABS = [
  { key: "operationDetails", label: "Operation Details", icon: Anchor, accent: "#2563eb", hint: "Owner, co-owner, service requester and last moved status for this call." },
  { key: "invoice", label: "Invoice", icon: Receipt, accent: "#059669", hint: "Tax invoice, SRT/PO/WBS reference and invoice amount for this call." },
];

// Matches the debounce delay used for the Export Approval tab's autosave (Approval.jsx).
const AUTO_SAVE_DEBOUNCE_MS = 1200;

// api/da/required_documents/{call_id} — read-only reference documents. The full list
// (see RequiredDocumentsSection below) is shown at the bottom of the "Clearance Copies"
// sub-tab; the MWP-tagged subset is also surfaced separately inside the "MWP" sub-tab.
const REQUIRED_DOCUMENTS_CONFIG = [
  { key: "immigration_doc", label: "Crew Immigration", icon: User },
  { key: "mwp_doc", label: "MWP", icon: ShieldCheck, section: "mwp", accent: "#0891b2" },
  { key: "mwp_subscription_sadad", label: "MWP Subscription (SADAD)", icon: Banknote, section: "mwp", accent: "#d97706" },
  { key: "final_bayan_doc", label: "Final Bayan", icon: FileText },
  { key: "mawani_invoice", label: "Mawani Invoice", icon: Receipt },
  { key: "ibtikar_invoice", label: "Ibtikar Invoice", icon: Receipt },
  { key: "cargo_final_bayan", label: "Cargo Final Bayan", icon: Package },
];

const MWP_REQUIRED_DOCUMENTS_CONFIG = REQUIRED_DOCUMENTS_CONFIG.filter((doc) => doc.section === "mwp");
const FINAL_BAYAN_REQUIRED_DOCUMENTS_CONFIG = REQUIRED_DOCUMENTS_CONFIG.filter(
  (doc) => doc.key === "final_bayan_doc" || doc.key === "cargo_final_bayan"
);
const OTHER_REQUIRED_DOCUMENTS_CONFIG = REQUIRED_DOCUMENTS_CONFIG.filter(
  (doc) => doc.section !== "mwp" && doc.key !== "final_bayan_doc" && doc.key !== "cargo_final_bayan"
);

const TYPE_ICON = {
  text: Hash,
  date: CalendarCheck,
  datetime: CalendarCheck,
  "number-unit": Hash,
  chips: Tag,
  "billing-entity": Tag,
  files: UploadCloud,
  readonly: Clock,
  user: User,
};

const FIELD_ICON_OVERRIDES = {
  owner: User,
  coOwners: User,
  vesselName: Ship,
  attachmentFiles: Paperclip,
  docFiles: FolderOpen,
};

const RAW_FIELDS_CONFIG = [
  // Launch Hire
  { key: "launchHireSlips", label: "Launch Hire Slips", type: "files", group: "launchHire" },
  { key: "thirdPartyLaunchHire", label: "3rd Party Launch hire (If any)", type: "text", group: "launchHire", placeholder: "e.g. Al Rashid Transport Co." },
  { key: "roadTransport", label: "Road Transport", type: "number-unit", unit: "DAYS", group: "launchHire", placeholder: "e.g. 3" },
  // Clearance Copies
  { key: "sailingClearanceCopy", label: "Sailing Clearance Copy", type: "files", group: "clearanceCopies", reserveSpace: true },
  { key: "inwardClearanceCopy", label: "Inward Clearance Copy", type: "files", group: "clearanceCopies", reserveSpace: true },
  { key: "supportingDocuments", label: "SUPPORTING DOCUMENTS", type: "files", group: "clearanceCopies", showCount: true, showDownloadAll: true, reserveSpace: true, documentName: "Supporting Documents" },
  { key: "fdaDispatchProof", label: "FDA Dispatch Proof", type: "files", group: "clearanceCopies", reserveSpace: true },
  // Invoices, Fees & Certificates
  { key: "taxInvoice", label: "Tax Invoice", type: "text", group: "invoicesFees", placeholder: "e.g. INV-88213" },
  { key: "srtPoWbs", label: "SRT / PO / WBS", type: "text", group: "invoicesFees", placeholder: "e.g. SRT-2201/PO-9982" },
  { key: "invoiceAmount", label: "Invoice amount (Including VAT)", type: "text", group: "invoicesFees", placeholder: "e.g. 12,500.00" },
  // Vessel & Sales Order
  { key: "vesselName", label: "VESSEL NAME", type: "text", group: "vesselSalesOrder", placeholder: "e.g. MV Atlantic Star" },
  { key: "serviceRequester", label: "Service requester", type: "text", group: "vesselSalesOrder", placeholder: "e.g. Jeffrey Steve" },
  { key: "sapSalesOrderNo", label: "SAP Sales Order No", type: "text", group: "vesselSalesOrder", placeholder: "e.g. 3035188" },
  { key: "srnNo", label: "SRN No. (L & T)", type: "text", group: "vesselSalesOrder", placeholder: "e.g. 683/ CRPO 78/2026" },
  { key: "copyOfSalesOrder", label: "Copy of Sales order", type: "files", group: "vesselSalesOrder" },
  { key: "salesOrderSupportingDocs", label: "Sales Order Supporting documents", type: "files", group: "vesselSalesOrder", showCount: true },
  // DA Operations > Operation Details — mirrors fields already captured in Card / Vessel
  // & Sales Order above, kept in sync since they share the same fieldValues keys.
  { key: "coOwners", label: "Co-owner", type: "user", group: "operationDetails", placeholder: "Search a user…" },
  { key: "serviceRequester", label: "Service requester", type: "text", group: "operationDetails", placeholder: "e.g. Jeffrey Steve" },
  { key: "lastMoved", label: "Last moved", type: "readonly", group: "operationDetails" },
];

const FIELDS_CONFIG = RAW_FIELDS_CONFIG.map((field) => ({
  ...field,
  icon: FIELD_ICON_OVERRIDES[field.key] ?? TYPE_ICON[field.type],
}));

const FIELDS_BY_GROUP = FIELDS_CONFIG.reduce((acc, field) => {
  if (!acc[field.group]) acc[field.group] = [];
  acc[field.group].push(field);
  return acc;
}, {});

// Owner, Vessel Owner and Billing Entity aren't editable anywhere in the app (they're
// resolved from summary_tab / the billing entity lookup), so Operation Details shows
// them as ReadonlyField tiles rather than routing them through renderField.
const OPERATION_DETAILS_FIELDS_BY_KEY = (FIELDS_BY_GROUP.operationDetails ?? [])
  .reduce((acc, f) => ({ ...acc, [f.key]: f }), {});

const makeInitialFieldState = () => {
  const state = {};
  FIELDS_CONFIG.forEach((field) => {
    if (field.type === "readonly" || field.type === "billing-entity") return;
    if (field.type === "files") state[field.key] = [];
    else if (field.type === "datetime") state[field.key] = { date: "", time: "" };
    else if (field.type === "chips") state[field.key] = [];
    else state[field.key] = "";
  });
  return state;
};

const formatTimestamp = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// api/da/summary_tab returns "YYYY-MM-DD HH:mm:ss" — render it the same way the rest of
// the app displays timestamps (en-GB, 12h clock).
const formatApiDateTime = (raw) => {
  if (!raw) return null;
  const d = new Date(String(raw).replace(" ", "T"));
  if (isNaN(d)) return raw;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const firstNonEmptyString = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
};

function TileLabel({ icon, children }) {
  const Icon = icon;
  return (
    <span className="da-cf-tile-label">
      <span className="da-cf-tile-icon"><Icon size={13} /></span>
      {children}
    </span>
  );
}

TileLabel.propTypes = { icon: PropTypes.elementType.isRequired, children: PropTypes.node.isRequired };

function TextField({ label, icon, value, placeholder, onChange, accent }) {
  return (
    <div className="da-cf-tile" style={{ "--tile-accent": accent }}>
      <TileLabel icon={icon}>{label}</TileLabel>
      <input
        type="text"
        className="da-cf-input"
        value={value}
        placeholder={placeholder ?? "—"}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

TextField.propTypes = {
  label: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  value: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  accent: PropTypes.string,
};

// Co-owners is DA-specific, so its picker is scoped to DA users (role_id 22 — see
// isDaRole in Approval.jsx) via users/get_users_by_role, same function/payload used by
// the other role-scoped user pickers in the app (e.g. GROCardView's assignee select).
const CO_OWNER_ROLE_ID = 22;

// Owner / Co-owners — avatar-trigger + floating search panel, same interaction pattern as
// the app's other user pickers (UserPickerField in BusinessRuleFormModal.jsx): a chevron
// trigger showing the picked user's initials, opening a panel to pick from the fetched
// role-scoped user list (filtered client-side as you type, not a per-keystroke search call).
function UserSearchField({ label, icon, value, placeholder, onChange, accent }) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [roleUsers, setRoleUsers] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    setIsSearching(true);
    userService.getUsersByRole({ role_id: CO_OWNER_ROLE_ID })
      .then(({ data }) => {
        if (cancelled) return;
        const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        setRoleUsers(
          list.map((u) => ({
            user_id: u.user_id ?? u.id,
            name: u.name ?? u.user_name ?? u.full_name ?? `User ${u.user_id ?? u.id}`,
            role: u.role,
          }))
        );
      })
      .catch(() => { if (!cancelled) setRoleUsers([]); })
      .finally(() => { if (!cancelled) setIsSearching(false); });
    return () => { cancelled = true; };
  }, [isOpen]);

  const results = useMemo(() => {
    const query = filterText.trim().toLowerCase();
    if (!query) return roleUsers;
    return roleUsers.filter((u) => (u.name || "").toLowerCase().includes(query));
  }, [roleUsers, filterText]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onDocMouseDown = (e) => {
      if (panelRef.current?.contains(e.target)) return;
      if (triggerRef.current?.contains(e.target)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
    setFilterText("");
  };

  const handlePick = (user) => {
    onChange(user?.name ?? "", user);
    setIsOpen(false);
  };

  return (
    <div className="da-cf-tile da-cf-user-search" style={{ "--tile-accent": accent }}>
      <TileLabel icon={icon}>{label}</TileLabel>
      <button
        type="button"
        ref={triggerRef}
        className="da-cf-input da-cf-user-search-trigger"
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="da-cf-user-search-avatar" aria-hidden>{getInitials(value) || <User size={13} />}</span>
        <span className={`da-cf-user-search-trigger-name${value ? "" : " da-cf-user-search-trigger-name--empty"}`}>
          {value || placeholder || "Select a user"}
        </span>
        <ChevronDown size={15} className="da-cf-user-search-chevron" aria-hidden />
      </button>

      {isOpen && (
        <div className="da-cf-user-search-dropdown" ref={panelRef}>
          <div className="da-cf-user-search-filter">
            <Search size={13} className="da-cf-user-search-filter-icon" aria-hidden />
            <input
              type="text"
              placeholder="Search a user…"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              autoFocus
            />
          </div>
          <div className="da-cf-user-search-list">
            <button type="button" className="da-cf-user-search-row" onClick={() => handlePick(null)}>
              <span className="da-cf-user-search-avatar" aria-hidden><User size={13} /></span>
              <span className="da-cf-user-search-name">None</span>
            </button>
            {isSearching ? (
              <div className="da-cf-user-search-empty">Searching…</div>
            ) : results.length === 0 ? (
              <div className="da-cf-user-search-empty">No matches</div>
            ) : (
              results.map((user) => (
                <button
                  type="button"
                  key={user.user_id}
                  className="da-cf-user-search-row"
                  onClick={() => handlePick(user)}
                >
                  <span className="da-cf-user-search-avatar" aria-hidden>{getInitials(user.name)}</span>
                  <span className="da-cf-user-search-name">{user.name}</span>
                  {user.role && <span className="da-cf-user-search-role">{user.role}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

UserSearchField.propTypes = {
  label: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  value: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  accent: PropTypes.string,
};

function DateField({ label, icon, value, onChange, accent }) {
  return (
    <div className="da-cf-tile" style={{ "--tile-accent": accent }}>
      <TileLabel icon={icon}>{label}</TileLabel>
      <input type="date" className="da-cf-input da-cf-input--numeric" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

DateField.propTypes = {
  label: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  accent: PropTypes.string,
};

function ReadonlyField({ label, icon, value, accent }) {
  return (
    <div className="da-cf-tile" style={{ "--tile-accent": accent }}>
      <TileLabel icon={icon}>{label}</TileLabel>
      <input type="text" className="da-cf-input da-cf-input--readonly da-cf-input--numeric" value={value} readOnly />
    </div>
  );
}

ReadonlyField.propTypes = {
  label: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  value: PropTypes.string.isRequired,
  accent: PropTypes.string,
};

function DateTimeField({ label, icon, date, time, onDateChange, onTimeChange }) {
  return (
    <div className="da-cf-tile">
      <TileLabel icon={icon}>{label}</TileLabel>
      <div className="da-cf-datetime-row">
        <input type="date" className="da-cf-input da-cf-input--numeric" value={date} onChange={(e) => onDateChange(e.target.value)} />
        <input type="time" className="da-cf-input da-cf-input--numeric" value={time} onChange={(e) => onTimeChange(e.target.value)} />
      </div>
    </div>
  );
}

DateTimeField.propTypes = {
  label: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  date: PropTypes.string.isRequired,
  time: PropTypes.string.isRequired,
  onDateChange: PropTypes.func.isRequired,
  onTimeChange: PropTypes.func.isRequired,
};

function NumberUnitField({ label, icon, value, unit, placeholder, onChange }) {
  return (
    <div className="da-cf-tile">
      <TileLabel icon={icon}>{label}</TileLabel>
      <div className="da-cf-unit-input-wrap">
        <input
          type="number"
          min="0"
          className="da-cf-input da-cf-input--numeric da-cf-input--with-unit"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="da-cf-unit-suffix">{unit}</span>
      </div>
    </div>
  );
}

NumberUnitField.propTypes = {
  label: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  value: PropTypes.string.isRequired,
  unit: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};

function ChipsField({ label, icon, chips, placeholder, onAdd, onRemove, accent }) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) {
      onAdd(trimmed);
      setDraft("");
    }
  };

  return (
    <div className="da-cf-tile da-cf-tile--full" style={{ "--tile-accent": accent }}>
      <TileLabel icon={icon}>{label}</TileLabel>
      {chips.length > 0 && (
        <div className="da-cf-chips-row">
          {chips.map((chip, i) => (
            <span className="da-cf-chip" key={`${chip}-${i}`}>
              {chip}
              <button type="button" className="da-cf-chip-remove" onClick={() => onRemove(i)}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        className="da-cf-input"
        placeholder={placeholder ?? "Add and press Enter"}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
      />
    </div>
  );
}

ChipsField.propTypes = {
  label: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  chips: PropTypes.arrayOf(PropTypes.string).isRequired,
  placeholder: PropTypes.string,
  onAdd: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  accent: PropTypes.string,
};

// Image and PDF files get their own lightbox (view) with explicit Download/Print
// actions instead of a bare new tab; other file types still just open in a new tab.
const IMAGE_FILE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"]);
const isImageFile = (file) => {
  const name = file?.name || file?.url || "";
  const ext = name.split(".").pop()?.toLowerCase();
  return IMAGE_FILE_EXTENSIONS.has(ext);
};
const isPdfFile = (file) => {
  const name = file?.name || file?.url || "";
  return name.split(".").pop()?.toLowerCase() === "pdf";
};
const isPreviewableFile = (file) => isImageFile(file) || isPdfFile(file);

function FileDropzone({ label, icon, files, showCount, showDownloadAll, documentName, callId, reserveSpace, readOnly, isLoading, id, highlighted, onAddFiles, onRemoveFile }) {
  const [dragging, setDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = useCallback((fileList) => {
    const arr = Array.from(fileList || []);
    if (!arr.length) return;
    // Freshly picked File objects have no .url until the backend roundtrip finishes,
    // so the eye icon (isPreviewableFile below) would stay hidden until then — give
    // previewable types a local blob URL right away so preview works immediately.
    arr.forEach((file) => {
      if (isPreviewableFile(file)) file.url = URL.createObjectURL(file);
    });
    onAddFiles(arr);
  }, [onAddFiles]);

  // api/da/download_section_zip/{call_id}?document_name= — comes back as a real zip
  // file, but a failed lookup returns a JSON error body with the same 200/blob
  // response type, so the content-type is checked before treating it as a download
  // (same pattern as exportExecutionLogsFile in BusinessRuleReducer).
  const handleDownloadAll = async () => {
    if (callId == null || isDownloadingZip) return;
    setIsDownloadingZip(true);
    try {
      const response = await daService.downloadSectionZip(callId, documentName);
      const contentType = response.headers?.["content-type"] ?? "";
      if (contentType.includes("json")) {
        const text = await response.data.text();
        let message = "Failed to download zip.";
        try { message = JSON.parse(text)?.message ?? message; } catch { /* not JSON */ }
        notify(message, "error", "top-center");
        return;
      }
      const blob = new Blob([response.data], { type: contentType || "application/zip" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${label || documentName}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      let message = "Failed to download zip.";
      if (err?.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          message = JSON.parse(text)?.message ?? message;
        } catch { /* not JSON */ }
      } else {
        message = err?.response?.data?.message || message;
      }
      notify(message, "error", "top-center");
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handlePrintPreview = () => {
    if (!previewFile) return;
    const win = window.open(previewFile.url, "_blank");
    if (win) win.onload = () => win.print();
  };

  // A plain <a href download> doesn't reliably force a save (some browsers just
  // navigate/open the file instead, e.g. for blob: URLs) — fetching the bytes and
  // clicking a detached link is the same proven approach handleDownloadAll uses above.
  const handleDownloadPreview = async () => {
    if (!previewFile) return;
    try {
      const response = await fetch(previewFile.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = previewFile.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      notify("Failed to download file.", "error", "top-center");
    }
  };

  return (
    <>
    <div id={id} className={`da-cf-tile da-cf-tile--full${highlighted ? " da-cf-tile--highlighted" : ""}`}>
      <TileLabel icon={icon}>
        {label}
        {showCount && files.length > 0 && <span className="da-cf-count-badge">{files.length}</span>}
      </TileLabel>
      {!readOnly && (
        <div
          className={`da-cf-dropzone${dragging ? " da-cf-dropzone--dragging" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
        >
          <UploadCloud size={18} className="da-cf-dropzone-icon" />
          Drag files here or Click to upload
          <input
            ref={inputRef}
            type="file"
            multiple
            className="da-cf-dropzone-input"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      )}
      {files.length > 0 ? (
        <div className="da-cf-file-list">
          {files.map((file, i) => (
            <div className="da-cf-file-row" key={`${file.name}-${i}`}>
              <span className="da-cf-file-icon"><FileText size={14} /></span>
              <div className="da-cf-file-name-wrap">
                {file.url ? (
                  <a className="da-cf-file-name" href={file.url} target="_blank" rel="noreferrer">{file.name}</a>
                ) : (
                  <span className="da-cf-file-name">{file.name}</span>
                )}
                {file.uploaded_by_name && (
                  <span className="da-cf-file-meta">
                    {file.uploaded_by_name}
                    {file.created_date ? ` · ${formatApiDateTime(file.created_date)}` : ""}
                  </span>
                )}
              </div>
              {file.url && (
                isPreviewableFile(file) ? (
                  <button
                    type="button"
                    className="da-cf-file-view"
                    onClick={() => setPreviewFile(file)}
                    title="View document"
                  >
                    <Eye size={14} />
                  </button>
                ) : (
                  <a
                    className="da-cf-file-view"
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    title="View document"
                  >
                    <Eye size={14} />
                  </a>
                )
              )}
              {!readOnly && (
                <button type="button" className="da-cf-file-remove" onClick={() => onRemoveFile(i)}>
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : reserveSpace ? (
        // Some of these fields get their file synced in from the backend rather than
        // uploaded here, so this reserves the same row height up front — the card
        // doesn't grow/shift once that data arrives.
        <div className="da-cf-file-list">
          <div className="da-cf-file-row da-cf-file-row--placeholder">
            <span className="da-cf-file-icon"><FileText size={14} /></span>
            <div className="da-cf-file-name-wrap">
              <span className="da-cf-file-name da-cf-file-name--placeholder">
                {isLoading ? "Loading…" : "No file synced yet"}
              </span>
            </div>
          </div>
        </div>
      ) : null}
      {showDownloadAll && files.length > 0 && (
        <div className="da-cf-file-actions-row">
          <button type="button" className="da-cf-download-all" onClick={handleDownloadAll} disabled={isDownloadingZip}>
            {isDownloadingZip ? <Loader2 size={13} className="da-cf-autosave-status-spin" /> : <FileArchive size={13} />}
            {isDownloadingZip ? "Downloading…" : "Download all as ZIP"}
          </button>
        </div>
      )}
    </div>
    {previewFile && (
      <CustomModal
        show
        closeModal={() => setPreviewFile(null)}
        createModal
        dialgName="da-cf-image-preview-dialog"
        bodyClassname="da-cf-image-preview-body"
        header={
          <div className="da-cf-image-preview-header">
            <span className="da-cf-image-preview-title">{previewFile.name}</span>
            <div className="da-cf-image-preview-actions">
              <button type="button" className="da-cf-file-view" onClick={handleDownloadPreview} title="Download">
                <Download size={16} />
              </button>
              <button type="button" className="da-cf-file-view" onClick={handlePrintPreview} title="Print">
                <Printer size={16} />
              </button>
              <button type="button" className="da-cf-file-view" onClick={() => setPreviewFile(null)} title="Close">
                <X size={16} />
              </button>
            </div>
          </div>
        }
        body={
          isPdfFile(previewFile) ? (
            <iframe className="da-cf-pdf-preview-frame" src={previewFile.url} title={previewFile.name} />
          ) : (
            <img className="da-cf-image-preview-img" src={previewFile.url} alt={previewFile.name} />
          )
        }
      />
    )}
    </>
  );
}

FileDropzone.propTypes = {
  label: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  files: PropTypes.array.isRequired,
  showCount: PropTypes.bool,
  showDownloadAll: PropTypes.bool,
  documentName: PropTypes.string,
  callId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  reserveSpace: PropTypes.bool,
  readOnly: PropTypes.bool,
  isLoading: PropTypes.bool,
  id: PropTypes.string,
  highlighted: PropTypes.bool,
  onAddFiles: PropTypes.func.isRequired,
  onRemoveFile: PropTypes.func.isRequired,
};

// Read-only tile for an api/da/required_documents/{call_id} entry — synced-only, no upload.
function RequiredDocTile({ doc, requiredDocuments, isLoading }) {
  const entry = requiredDocuments?.[doc.key];
  const files = entry?.file_url ? [{ name: entry.file_name || doc.label, url: entry.file_url }] : [];
  return (
    <FileDropzone
      label={doc.label}
      icon={doc.icon}
      files={files}
      reserveSpace
      readOnly
      isLoading={isLoading}
      onAddFiles={() => {}}
      onRemoveFile={() => {}}
    />
  );
}

RequiredDocTile.propTypes = {
  doc: PropTypes.shape({ key: PropTypes.string, label: PropTypes.string, icon: PropTypes.elementType }).isRequired,
  requiredDocuments: PropTypes.object,
  isLoading: PropTypes.bool,
};

// Inward/Outward Clearance — its own card section (same icon-badge-header shape as
// Operation Details/Invoice/Link beside it), using the same ReadonlyField tile UI
// Operation Details uses for Owner/Service requester/Last moved, so the two cards
// read as one consistent style instead of Clearance having its own custom look.
function ClearanceStatsRow({ stats }) {
  return (
    <section className="da-cf-ops-card da-cf-clearance-card">
      <header className="da-cf-ops-card-header">
        <span className="da-cf-ops-card-icon"><CalendarCheck size={20} /></span>
        <h4 className="da-cf-ops-card-title">Clearance</h4>
      </header>
      <div className="da-cf-fields-grid da-cf-clearance-fields">
        {stats.map((stat) => (
          <ReadonlyField
            key={stat.label}
            label={stat.label}
            icon={stat.icon}
            value={stat.value || "Not set"}
            accent={stat.accent}
          />
        ))}
      </div>
    </section>
  );
}

ClearanceStatsRow.propTypes = {
  stats: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string,
      value: PropTypes.string,
      icon: PropTypes.elementType,
      accent: PropTypes.string,
    })
  ).isRequired,
};

function StatusTimelineSection({ steps, onStepClick, isLoading, isAdvancing }) {
  return (
    <div className="da-cf-timeline-card">
      <div className="da-cf-timeline-header">
        <h3 className="da-cf-summary-section-heading da-cf-timeline-heading">
          <Clock size={14} className="da-cf-timeline-heading-icon" />
          DA Status Timeline
        </h3>
        {isLoading && steps.length === 0 && <span className="da-cf-summary-card-value--empty">Loading…</span>}
      </div>
      <div className="da-cf-timeline">
        {steps.map((step, index) => {
          const displayState = step.state;
          const Icon = displayState === "done" ? CheckCircle2 : displayState === "current" ? Clock : CircleDashed;
          // Three click targets:
          // - "current" step's round moves the DA forward one stage. Sending
          //   api/da/update_status the CURRENT step's own status_name is a no-op (it's
          //   already that status), so this sends the *next* step's label instead.
          // - the "up next" pending step (right after the current one) does the same
          //   forward move — clicking the step you're moving TO also completes the
          //   current one, since both name the same destination status. Also allowed
          //   when the previous step is already "done" (not just "current") — e.g. a
          //   step toggled via the header sticker/checkbox can land straight on "done"
          //   without the timeline ever marking it "current", which would otherwise
          //   strand the following pending step as unclickable.
          // - a "done" step's round moves the DA back one stage, but only the step right
          //   before the current one — reverting is one-by-one too, not a jump straight
          //   back to an arbitrary earlier stage.
          const prevStep = steps[index - 1];
          const nextStep = steps[index + 1];
          const isForwardClickable = step.state === "current" && Boolean(nextStep);
          const isUpNextClickable = step.state === "pending" && (prevStep?.state === "current" || prevStep?.state === "done");
          const isBackClickable = step.state === "done" && nextStep?.state === "current";
          const isClickable = Boolean(onStepClick) && !isAdvancing && (isForwardClickable || isUpNextClickable || isBackClickable);
          const targetStep = isForwardClickable ? nextStep : step;
          const targetLabel = targetStep.label;
          return (
            <div className={`da-cf-timeline-step da-cf-timeline-step--${displayState}`} key={step.key}>
              <div className="da-cf-timeline-step-marker">
                {isClickable ? (
                  <button
                    type="button"
                    className="da-cf-timeline-step-icon da-cf-timeline-step-icon--clickable"
                    title={isBackClickable ? `Revert to "${targetLabel}"` : `Move to "${targetLabel}"`}
                    onClick={() => onStepClick({ statusId: targetStep.statusId, label: targetLabel })}
                  >
                    <Icon size={16} />
                  </button>
                ) : (
                  <span className="da-cf-timeline-step-icon">
                    <Icon size={16} />
                  </span>
                )}
                {index < steps.length - 1 && (
                  <span className="da-cf-timeline-step-connector" title={steps[index + 1].label} />
                )}
              </div>
              <div className="da-cf-timeline-step-body">
                <span className="da-cf-timeline-step-label">{step.label}</span>
                <span className={`da-cf-timeline-status-badge da-cf-timeline-status-badge--${displayState}`}>
                  {displayState === "done" ? "Completed" : displayState === "current" ? "In progress" : "Not reached"}
                </span>
                {step.state === "done" && step.date && (
                  <span className="da-cf-timeline-step-date">
                    <CalendarCheck size={10} className="da-cf-timeline-step-date-icon" aria-hidden />
                    {formatDisplayDateOnly(step.date)}{step.time ? ` · ${step.time}` : ""}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

StatusTimelineSection.propTypes = {
  steps: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string,
      statusId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      stickerId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      label: PropTypes.string,
      date: PropTypes.string,
      time: PropTypes.string,
      state: PropTypes.oneOf(["done", "current", "pending"]),
    })
  ).isRequired,
  onStepClick: PropTypes.func,
  isLoading: PropTypes.bool,
  isAdvancing: PropTypes.bool,
};

// Separate from the backend-driven DA Status Timeline above — this is a local-only activity
// log fed by the Sales Order tab's Client Approval & Invoicing process (Send SO → Upload
// Invoice → Send Invoice → Payment), shared via formValues.soProcessTimeline. No backend
// field/endpoint yet for any of this.
function SalesOrderActivitySection({ events }) {
  if (!events || events.length === 0) return null;
  // Oldest-first, left-to-right — reads as a process flow, same direction as the
  // step-based DA Status Timeline above it.
  const sorted = [...events].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return (
    <div className="da-cf-timeline-card">
      <div className="da-cf-timeline-header">
        <h3 className="da-cf-summary-section-heading da-cf-timeline-heading">
          <Clock size={14} className="da-cf-timeline-heading-icon" />
          Sales Order Activity
        </h3>
      </div>
      <div className="da-cf-so-activity-list">
        {sorted.map((entry) => (
          <div className="da-cf-so-activity-row" key={entry.id}>
            <div className="da-cf-so-activity-marker">
              <span className="da-cf-so-activity-dot" />
            </div>
            <span className="da-cf-so-activity-text">
              {entry.event}{entry.itemNo ? ` — Item ${entry.itemNo}` : ""}
            </span>
            <span className="da-cf-so-activity-time">{formatApiDateTime(entry.timestamp)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

SalesOrderActivitySection.propTypes = {
  events: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      event: PropTypes.string,
      itemNo: PropTypes.string,
      timestamp: PropTypes.string,
    })
  ),
};

function SummaryPanel({ callId, statusTimeline, isLoadingStatusTimeline, onAdvanceDaStage, isAdvancingDaStage, soProcessTimeline }) {
  const getLocalReachedDate = useDaLocalReachedDates((s) => s.getReachedDate);

  // api/da/update_status doesn't persist reached_date yet (backend gap) — for a step that's
  // done but has no reached_date from the API, fall back to the client's own timestamp from
  // when it was clicked (see setDaLocalReachedDate in CardForm.jsx). The API value always
  // wins once the backend actually returns one.
  const timelineSteps = useMemo(() => {
    const mapped = mapStatusTimelineResponse(statusTimeline);
    if (callId == null) return mapped;
    return mapped.map((step) => {
      if (step.state !== "done" || step.date) return step;
      const fallback = getLocalReachedDate(String(callId).trim(), step.label);
      if (!fallback) return step;
      const { date, time } = parseApiDateTime(fallback);
      return date ? { ...step, date, time: time || null } : step;
    });
  }, [statusTimeline, callId, getLocalReachedDate]);

  return (
    <>
      <StatusTimelineSection
        steps={timelineSteps}
        isLoading={isLoadingStatusTimeline}
        onStepClick={onAdvanceDaStage}
        isAdvancing={isAdvancingDaStage}
      />
      <SalesOrderActivitySection events={soProcessTimeline} />
    </>
  );
}

SummaryPanel.propTypes = {
  callId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  statusTimeline: PropTypes.array,
  isLoadingStatusTimeline: PropTypes.bool,
  onAdvanceDaStage: PropTypes.func,
  isAdvancingDaStage: PropTypes.bool,
  soProcessTimeline: PropTypes.array,
};

// Read-only list fed by api/da/required_documents/{call_id} — each entry is
// either already uploaded elsewhere in the system (file_name/file_url set)
// or still pending, unlike the editable FileDropzone fields above it.
function RequiredDocumentsSection({ documents, isLoading, configs = REQUIRED_DOCUMENTS_CONFIG, title = "Required Documents", standalone = false, large = false }) {
  const uploadedCount = configs.filter((doc) => documents?.[doc.key]?.file_url).length;
  const totalCount = configs.length;
  const progressPct = totalCount ? Math.round((uploadedCount / totalCount) * 100) : 0;

  return (
    <div className={`da-cf-required-docs${standalone ? " da-cf-required-docs--standalone" : ""}${large ? " da-cf-required-docs--large" : ""}`}>
      <div className="da-cf-required-docs-header">
        <h5 className="da-cf-required-docs-title">{title}</h5>
        {!isLoading && (
          <span className="da-cf-required-docs-progress-label">{uploadedCount} of {totalCount} uploaded</span>
        )}
      </div>
      <div className="da-cf-required-docs-progress-track" style={{ "--da-progress": `${progressPct}%` }}>
        <div className="da-cf-required-docs-progress-fill" />
      </div>
      <div className="da-cf-required-docs-grid">
        {configs.map((doc) => {
          const Icon = doc.icon;
          const entry = documents?.[doc.key];
          const fileName = entry?.file_name || null;
          const fileUrl = entry?.file_url || null;
          const isUploaded = Boolean(fileUrl);
          return (
            <div
              className={`da-cf-required-doc-card${isUploaded ? " da-cf-required-doc-card--done" : ""}`}
              style={{ "--doc-accent": doc.accent }}
              key={doc.key}
            >
              <span className="da-cf-required-doc-icon"><Icon size={15} /></span>
              <div className="da-cf-required-doc-body">
                <span className="da-cf-required-doc-label">{doc.label}</span>
                {isLoading ? (
                  <span className="da-cf-required-doc-status">Loading…</span>
                ) : isUploaded ? (
                  <a className="da-cf-required-doc-link" href={fileUrl} target="_blank" rel="noreferrer">{fileName || "View file"}</a>
                ) : (
                  <span className="da-cf-required-doc-status da-cf-required-doc-status--pending">Not uploaded yet</span>
                )}
              </div>
              <span className={`da-cf-required-doc-badge${isUploaded ? " da-cf-required-doc-badge--done" : ""}`}>
                {isUploaded ? <CheckCircle2 size={13} /> : <CircleDashed size={13} />}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

RequiredDocumentsSection.propTypes = {
  documents: PropTypes.object,
  isLoading: PropTypes.bool,
  configs: PropTypes.arrayOf(PropTypes.shape({ key: PropTypes.string, label: PropTypes.string, icon: PropTypes.elementType, accent: PropTypes.string })),
  title: PropTypes.string,
  standalone: PropTypes.bool,
  large: PropTypes.bool,
};

// Operations completion is a plain date (no time) — a lighter formatter than
// formatApiDateTime so the read-only card doesn't show a spurious "00:00".
const formatDisplayDateOnly = (isoDate) => {
  if (!isoDate) return null;
  const d = new Date(`${isoDate}T00:00:00`);
  if (isNaN(d)) return isoDate;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

// Invoices, Fees & Certificates sub-tab — same 3 fields as before (taxInvoice, srtPoWbs,
// invoiceAmount), just re-laid-out as a card-hero grid (.da-cf-ac-*) instead of the
// plain field grid other tabs use.
const INVOICES_FEES_CARDS = [
  {
    key: "taxInvoice",
    icon: Receipt,
    label: "Tax Invoice",
    hint: "Reference number of the tax invoice issued for this call.",
    accent: "#2563eb",
    placeholder: "e.g. INV-88213",
  },
  {
    key: "srtPoWbs",
    icon: Hash,
    label: "SRT / PO / WBS",
    hint: "Cross-reference codes for SRT, PO and WBS tracking.",
    accent: "#0891b2",
    placeholder: "e.g. SRT-2201/PO-9982",
  },
  {
    key: "invoiceAmount",
    icon: Banknote,
    label: "Invoice amount (Including VAT)",
    hint: "Total invoice amount including VAT, in the billing currency.",
    accent: "#059669",
    placeholder: "e.g. 12,500.00",
  },
];

function InvoicesFeesSection({ fieldValues, updateField }) {
  return (
    <>
      <div className="da-cf-summary-hero">
        <div className="da-cf-summary-hero-main">
          <p className="da-cf-summary-hero-eyebrow">Invoices, Fees &amp; Certificates</p>
          <h2 className="da-cf-summary-title">Invoice Overview</h2>
          <p className="da-cf-summary-hero-subtitle">
            Track the tax invoice, cross-reference codes and total invoice amount for this call.
          </p>
        </div>
      </div>

      <div className="da-cf-ac-grid da-cf-ac-grid--3col">
        {INVOICES_FEES_CARDS.map((card) => {
          const Icon = card.icon;
          const value = fieldValues[card.key];
          return (
            <div
              className={`da-cf-ac-card${value ? " da-cf-ac-card--done" : ""}`}
              style={{ "--step-accent": card.accent }}
              key={card.key}
            >
              <div className="da-cf-ac-card-head">
                <span className="da-cf-ac-card-icon"><Icon size={26} /></span>
                <h5 className="da-cf-ac-card-title">{card.label}</h5>
              </div>
              <p className="da-cf-ac-card-hint">{card.hint}</p>
              <div className="da-cf-ac-card-field">
                <TextField
                  label={card.label}
                  icon={Icon}
                  value={value}
                  placeholder={card.placeholder}
                  onChange={(v) => updateField(card.key, v)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

InvoicesFeesSection.propTypes = {
  fieldValues: PropTypes.object.isRequired,
  updateField: PropTypes.func.isRequired,
};

// DA Operations > Invoice — same 3 fields as InvoicesFeesSection above (Tax Invoice,
// SRT / PO / WBS, Invoice amount), styled as plain field tiles like Operation Details
// instead of the bigger InvoicesFeesSection card treatment. All 3 are editable; Tax
// Invoice / Invoice amount persist via api/da/save_operation_tab/{call_id}, while
// SRT / PO / WBS has no field in that payload, so typed values are saved via the
// local-only useDaLocalLaunchHire fallback (see updateField in DA below) since there's
// no real backend field to persist to.
function InvoiceCardsSection({ fieldValues, updateField }) {
  return (
    <div className="da-cf-fields-grid da-cf-fields-grid--fixed2">
      {INVOICES_FEES_CARDS.map((card) => (
        <TextField
          key={card.key}
          label={card.label}
          icon={card.icon}
          value={fieldValues[card.key]}
          placeholder={card.placeholder}
          onChange={(v) => updateField(card.key, v)}
          accent={card.accent}
        />
      ))}
    </div>
  );
}

InvoiceCardsSection.propTypes = {
  fieldValues: PropTypes.object.isRequired,
  updateField: PropTypes.func.isRequired,
};

// Vessel & Sales Order sub-tab — same card-hero treatment as InvoicesFeesSection: each
// field (including the two file uploads) becomes its own card in a .da-cf-ac-grid
// instead of the plain field grid other tabs still use.
const VESSEL_SALES_ORDER_CARDS = [
  { key: "vesselName", type: "text", icon: Ship, label: "Vessel Name", hint: "Name of the vessel handled under this call.", accent: "#2563eb", placeholder: "e.g. MV Atlantic Star" },
  { key: "serviceRequester", type: "text", icon: User, label: "Service Requester", hint: "Person who requested this service.", accent: "#0d9488", placeholder: "e.g. Jeffrey Steve" },
  { key: "sapSalesOrderNo", type: "text", icon: Receipt, label: "SAP Sales Order No", hint: "SAP-generated sales order reference.", accent: "#d97706", placeholder: "e.g. 3035188" },
  { key: "srnNo", type: "text", icon: Tag, label: "SRN No. (L & T)", hint: "Service request number from L & T.", accent: "#7c3aed", placeholder: "e.g. 683/ CRPO 78/2026" },
  { key: "copyOfSalesOrder", type: "files", icon: FileText, label: "Copy of Sales Order", hint: "Upload the signed copy of the sales order.", accent: "#059669" },
  // documentName must match documents_tab's Title Case document group label —
  // download_section_zip matches on this literal string.
  { key: "salesOrderSupportingDocs", type: "files", icon: Paperclip, label: "Sales Order Supporting Documents", hint: "Any additional documents supporting the sales order.", accent: "#e11d48", showCount: true, showDownloadAll: true, documentName: "Sales Order Supporting Documents" },
];

function VesselSalesOrderSection({ fieldValues, updateField, onRemoveDocument }) {
  return (
    <>
      <div className="da-cf-summary-hero">
        <div className="da-cf-summary-hero-main">
          <p className="da-cf-summary-hero-eyebrow">Vessel &amp; Sales Order</p>
          <h2 className="da-cf-summary-title">{fieldValues.vesselName || "Vessel not set yet"}</h2>
          <p className="da-cf-summary-hero-subtitle">
            Vessel identity and sales order references for this call.
          </p>
        </div>
      </div>

      <div className="da-cf-ac-grid">
        {VESSEL_SALES_ORDER_CARDS.map((card) => {
          const Icon = card.icon;
          const value = fieldValues[card.key];
          const isDone = card.type === "files" ? value.length > 0 : Boolean(value);
          return (
            <div
              className={`da-cf-ac-card${isDone ? " da-cf-ac-card--done" : ""}`}
              style={{ "--step-accent": card.accent }}
              key={card.key}
            >
              <div className="da-cf-ac-card-head">
                <span className="da-cf-ac-card-icon"><Icon size={26} /></span>
                <h5 className="da-cf-ac-card-title">{card.label}</h5>
              </div>
              <p className="da-cf-ac-card-hint">{card.hint}</p>
              <div className="da-cf-ac-card-field">
                {card.type === "files" ? (
                  <FileDropzone
                    label={card.label}
                    icon={Icon}
                    files={value}
                    showCount={card.showCount}
                    onAddFiles={(newFiles) => updateField(card.key, [...value, ...newFiles])}
                    onRemoveFile={(i) => onRemoveDocument(card.key, i)}
                  />
                ) : (
                  <TextField
                    label={card.label}
                    icon={Icon}
                    value={value}
                    placeholder={card.placeholder}
                    onChange={(v) => updateField(card.key, v)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

VesselSalesOrderSection.propTypes = {
  fieldValues: PropTypes.object.isRequired,
  updateField: PropTypes.func.isRequired,
  onRemoveDocument: PropTypes.func.isRequired,
};

// Inline status pill shown next to the "DA Operations" Save button, reflecting the
// debounced autosave (see runSaveOperationTab / debouncedAutoSaveOperationTab in DA
// below) — same idle/saving/saved/error states as the Export Approval tab's AutoSaveStatus.
function OperationAutoSaveStatus({ status }) {
  if (status === "saving") {
    return (
      <span className="da-cf-autosave-status da-cf-autosave-status--saving">
        <Loader2 size={13} className="da-cf-autosave-status-spin" /> Saving…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="da-cf-autosave-status da-cf-autosave-status--saved">
        <CheckCircle2 size={13} /> All changes saved
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="da-cf-autosave-status da-cf-autosave-status--error">
        <AlertCircle size={13} /> Couldn&rsquo;t save changes
      </span>
    );
  }
  return null;
}

OperationAutoSaveStatus.propTypes = {
  status: PropTypes.oneOf(["idle", "saving", "saved", "error"]),
};

function DA({ card, formValues, handleChange, daStatusRefreshToken, onAdvanceDaStage, isAdvancingDaStage }) {
  const [fieldValues, setFieldValues] = useState(makeInitialFieldState);
  // co_owner_id isn't a visible field — UserSearchField only exposes the picked user's
  // name — but api/da/save_operation_tab needs the id, so it's tracked alongside coOwners.
  const [coOwnerId, setCoOwnerId] = useState(null);
  const [lastMovedDisplay] = useState(() => formatTimestamp(new Date()));

  // api/da/summary_tab/{call_id} — feeds the Summary sub-tab with the real,
  // backend-resolved values (clearance dates, billing entity, SAP sales order no,
  // vessel owner) instead of relying only on locally-typed fields from other tabs.
  // Normalized to a string (not just whatever type `card` happens to carry) so it's a
  // stable primitive across re-renders — `card.call_id` flips between number and string
  // as the card prop gets replaced by different sources (list stub vs. fetched detail),
  // and each flip was re-triggering every effect below keyed on [callId, ...], firing
  // duplicate GETs (e.g. operation_tab) for the exact same call.
  const rawCallId = card?.call_id ?? card?.callId ?? card?.id ?? null;
  const callId = rawCallId != null ? String(rawCallId) : null;
  // api/da/status_timeline/{call_id} — real per-call status progression shown in the
  // Summary sub-tab's Status Timeline, replacing the old hardcoded/click-driven placeholder.
  // Also refetches when daStatusRefreshToken bumps (CardForm's footer stepper / header
  // sticker picker just advanced this call's DA stage), so this section updates immediately
  // instead of only on the next time the card is opened.
  const [statusTimeline, setStatusTimeline] = useState([]);
  const [isLoadingStatusTimeline, setIsLoadingStatusTimeline] = useState(false);

  useEffect(() => {
    if (callId == null) return undefined;
    let cancelled = false;
    setIsLoadingStatusTimeline(true);
    daService.getStatusTimeline(callId)
      .then(({ data }) => {
        if (!cancelled) setStatusTimeline(Array.isArray(data?.data) ? data.data : []);
      })
      .catch(() => {
        if (!cancelled) setStatusTimeline([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingStatusTimeline(false);
      });
    return () => { cancelled = true; };
  }, [callId, daStatusRefreshToken]);

  // api/da/da_details/{call_id} — Owner, Co-owner, Service requester, Last moved (stage
  // entered date), Tax Invoice, SRT/PO/WBS and Invoice amount now come from this dedicated
  // endpoint rather than being guessed off operation_tab/summary_tab. assigned_operator_id
  // is fetched too but has no matching name field in the response and no established UI
  // slot yet, so it's kept on daDetailsData without being rendered. Co-owner, Tax Invoice,
  // SRT/PO/WBS and Invoice amount are the editable ones here — they're persisted via
  // api/da/save_da_details (see the autosave effect below); Owner, Service requester and
  // Last moved stay read-only, sourced from this GET only.
  const [daDetailsData, setDaDetailsData] = useState(null);
  const [isLoadingDaDetails, setIsLoadingDaDetails] = useState(false);
  const setLaunchHireOverride = useDaLocalLaunchHire((s) => s.setLaunchHireOverride);
  // Guards the api/da/save_da_details autosave below, same pattern/purpose as
  // skipNextOperationAutoSaveRef further down but scoped to this GET's own fields so the
  // two hydration effects don't steal each other's one-shot skip.
  const skipNextDaDetailsAutoSaveRef = useRef(true);

  useEffect(() => {
    if (callId == null) return undefined;
    let cancelled = false;
    setIsLoadingDaDetails(true);
    daService.getDaDetails(callId)
      .then(({ data }) => {
        if (cancelled) return;
        const details = data?.data ?? null;
        setDaDetailsData(details);
        if (!details) return;
        skipNextDaDetailsAutoSaveRef.current = true;
        if (details.co_owner_id != null) setCoOwnerId(details.co_owner_id);
        setFieldValues((prev) => ({
          ...prev,
          coOwners: details.co_owner_name ?? prev.coOwners,
          serviceRequester: details.service_requester ?? prev.serviceRequester,
          taxInvoice: details.tax_invoice_no ?? prev.taxInvoice,
          srtPoWbs: details.srt_po_wbs_ref ?? prev.srtPoWbs,
          invoiceAmount: details.invoice_amount ?? prev.invoiceAmount,
        }));
      })
      .catch(() => {
        if (!cancelled) setDaDetailsData(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDaDetails(false);
      });
    return () => { cancelled = true; };
  }, [callId, daStatusRefreshToken]);

  // api/da/save_operation_tab/{call_id} — persists Operation Details' Billing Note and
  // Sales Order's SAP Sales Order No. Co-owner/Tax Invoice/SRT|PO|WBS/Invoice amount moved
  // to api/da/save_da_details below; everything else in that tab (Vessel, Service requester,
  // Launch Hire, SRN No.) has no field in either payload and stays read-only, synced only
  // from the GETs above.
  //
  // Autosaves AUTO_SAVE_DEBOUNCE_MS after the last edit to either field, same debounce
  // pattern as the Export Approval tab (Approval.jsx). latestOperationFormRef keeps the
  // debounced closure reading fresh values instead of a stale snapshot.
  // skipNextOperationAutoSaveRef is set right before the operation_tab GET hydrates
  // these fields, so loading a card doesn't immediately re-save what it just fetched.
  // There's no manual Save button — this is the only way these fields get persisted,
  // and it runs silently, only updating the status pill (no toast).
  const [operationSaveStatus, setOperationSaveStatus] = useState("idle");
  const latestOperationFormRef = useRef(null);
  latestOperationFormRef.current = {
    billingNote: fieldValues.billingOthers,
    sapSalesOrderNo: fieldValues.sapSalesOrderNo,
  };
  const skipNextOperationAutoSaveRef = useRef(true);

  const runSaveOperationTab = useCallback(async () => {
    if (callId == null) return;
    const { billingNote, sapSalesOrderNo } = latestOperationFormRef.current;
    const formData = new FormData();
    formData.append("billing_note", billingNote || "");
    formData.append("sap_sales_order_no", sapSalesOrderNo || "");

    setOperationSaveStatus("saving");
    try {
      await daService.saveOperationTab(callId, formData);
      setOperationSaveStatus("saved");
    } catch {
      setOperationSaveStatus("error");
    }
  }, [callId]);

  const debouncedAutoSaveOperationTab = useMemo(
    () => debounce(runSaveOperationTab, AUTO_SAVE_DEBOUNCE_MS),
    [runSaveOperationTab],
  );

  useEffect(() => () => debouncedAutoSaveOperationTab.flush(), [debouncedAutoSaveOperationTab]);

  useEffect(() => {
    if (skipNextOperationAutoSaveRef.current) {
      skipNextOperationAutoSaveRef.current = false;
      return;
    }
    debouncedAutoSaveOperationTab();
  }, [
    fieldValues.billingOthers,
    fieldValues.sapSalesOrderNo,
    debouncedAutoSaveOperationTab,
  ]);

  // api/da/save_da_details/{call_id} — persists Operation Details' Co-owner and Invoice's
  // Tax Invoice/SRT|PO|WBS/Invoice amount. Same debounce + skip-on-hydrate pattern as
  // save_operation_tab above, just against its own status/skip ref so the two autosaves
  // (and the two GETs that hydrate them) don't interfere with each other. Reuses the same
  // operationSaveStatus pill since both cards live under the one "DA Operations" toolbar.
  const latestDaDetailsFormRef = useRef(null);
  latestDaDetailsFormRef.current = {
    coOwnerId,
    taxInvoiceNo: fieldValues.taxInvoice,
    srtPoWbs: fieldValues.srtPoWbs,
    invoiceAmount: fieldValues.invoiceAmount,
  };

  const runSaveDaDetails = useCallback(async () => {
    if (callId == null) return;
    const { coOwnerId: co, taxInvoiceNo, srtPoWbs, invoiceAmount } = latestDaDetailsFormRef.current;
    // Sent as FormData, not a plain JSON object — matches every other DA save call
    // (saveOperationTab, saveDocumentsTab); the backend for this endpoint doesn't
    // read a raw JSON body, so a plain object here was posting successfully while
    // silently dropping every field.
    const payload = new FormData();
    payload.append("co_owner_id", co != null && co !== "" ? co : "");
    payload.append("tax_invoice_no", taxInvoiceNo || "");
    payload.append("srt_po_wbs_ref", srtPoWbs || "");
    payload.append("invoice_amount", invoiceAmount || "");

    setOperationSaveStatus("saving");
    try {
      await daService.saveDaDetails(callId, payload);
      setOperationSaveStatus("saved");
    } catch (err) {
      setOperationSaveStatus("error");
      notify(err?.response?.data?.message || "Failed to save changes.", "error", "top-center");
    }
  }, [callId]);

  const debouncedAutoSaveDaDetails = useMemo(
    () => debounce(runSaveDaDetails, AUTO_SAVE_DEBOUNCE_MS),
    [runSaveDaDetails],
  );

  useEffect(() => () => debouncedAutoSaveDaDetails.flush(), [debouncedAutoSaveDaDetails]);

  useEffect(() => {
    if (skipNextDaDetailsAutoSaveRef.current) {
      skipNextDaDetailsAutoSaveRef.current = false;
      return;
    }
    debouncedAutoSaveDaDetails();
  }, [
    coOwnerId,
    fieldValues.taxInvoice,
    fieldValues.srtPoWbs,
    fieldValues.invoiceAmount,
    debouncedAutoSaveDaDetails,
  ]);

  // thirdPartyLaunchHire/roadTransport/srnNo have no save endpoint (see InvoiceCardsSection /
  // VESSEL_SALES_ORDER_CARDS comments), so typed values also get mirrored into
  // useDaLocalLaunchHire — the only place they're remembered across reopening the card,
  // since there's no backend to persist them to.
  const LOCAL_ONLY_FIELD_KEYS = useMemo(() => new Set(["thirdPartyLaunchHire", "roadTransport", "srnNo"]), []);

  const updateField = useCallback((key, value) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
    if (LOCAL_ONLY_FIELD_KEYS.has(key) && callId != null) setLaunchHireOverride(callId, key, value);
  }, [callId, setLaunchHireOverride, LOCAL_ONLY_FIELD_KEYS]);

  // Removing a file field entry: already-uploaded documents (mapApiDocument shape, not a
  // browser File) carry a stage_document_id — those are persisted on the backend, so removal
  // must call api/da/delete_document, unlike a freshly-picked File that's only ever local
  // state until the next autosave. Optimistically removes, then rolls back + toasts on failure
  // so a failed delete doesn't silently leave the user thinking the document is gone.
  const handleRemoveDocument = useCallback((key, index) => {
    const files = fieldValues[key] || [];
    const file = files[index];
    const documentId = file && !(file instanceof File) ? file.stage_document_id : null;

    setFieldValues((prev) => ({ ...prev, [key]: (prev[key] || []).filter((_, idx) => idx !== index) }));

    if (documentId == null) return;
    daService.deleteDocument(documentId).catch((err) => {
      setFieldValues((prev) => {
        const next = [...(prev[key] || [])];
        next.splice(index, 0, file);
        return { ...prev, [key]: next };
      });
      notify(err?.response?.data?.message || "Failed to delete document.", "error", "top-center");
    });
  }, [fieldValues]);

  const renderField = (field, extraProps) => {
    const value = fieldValues[field.key];
    switch (field.type) {
      case "text":
        return (
          <TextField
            key={field.key}
            label={field.label}
            icon={field.icon}
            value={value}
            placeholder={field.placeholder}
            onChange={(v) => updateField(field.key, v)}
            accent={field.accent}
          />
        );
      case "user":
        return (
          <UserSearchField
            key={field.key}
            label={field.label}
            icon={field.icon}
            value={value}
            placeholder={field.placeholder}
            onChange={(v, user) => {
              updateField(field.key, v);
              if (field.key === "coOwners") setCoOwnerId(user?.user_id ?? null);
            }}
            accent={field.accent}
          />
        );
      case "date":
        return (
          <DateField
            key={field.key}
            label={field.label}
            icon={field.icon}
            value={value}
            onChange={(v) => updateField(field.key, v)}
            accent={field.accent}
          />
        );
      case "readonly":
        return <ReadonlyField key={field.key} label={field.label} icon={field.icon} value={lastMovedDisplay} accent={field.accent} />;
      case "datetime":
        return (
          <DateTimeField
            key={field.key}
            label={field.label}
            icon={field.icon}
            date={value.date}
            time={value.time}
            onDateChange={(v) => updateField(field.key, { ...value, date: v })}
            onTimeChange={(v) => updateField(field.key, { ...value, time: v })}
          />
        );
      case "number-unit":
        return (
          <NumberUnitField
            key={field.key}
            label={field.label}
            icon={field.icon}
            unit={field.unit}
            value={value}
            placeholder={field.placeholder}
            onChange={(v) => updateField(field.key, v)}
          />
        );
      case "chips":
        return (
          <ChipsField
            key={field.key}
            label={field.label}
            icon={field.icon}
            chips={value}
            placeholder={field.placeholder}
            onAdd={(chip) => updateField(field.key, [...value, chip])}
            onRemove={(i) => updateField(field.key, value.filter((_, idx) => idx !== i))}
            accent={field.accent}
          />
        );
      case "files":
        return (
          <FileDropzone
            key={field.key}
            label={field.label}
            icon={field.icon}
            files={value}
            showCount={field.showCount}
            showDownloadAll={field.showDownloadAll}
            documentName={field.documentName}
            callId={callId}
            reserveSpace={field.reserveSpace}
            onAddFiles={(newFiles) => updateField(field.key, [...value, ...newFiles])}
            onRemoveFile={(i) => handleRemoveDocument(field.key, i)}
            {...extraProps}
          />
        );
      default:
        return null;
    }
  };

  const clearanceStats = [
    { label: "Inward Clearance", value: null, icon: CalendarCheck, accent: "#0891b2" },
    { label: "Outward Clearance", value: null, icon: CalendarCheck, accent: "#7c3aed" },
  ];

  return (
    <div className="cardform-body da-cf-panel">
      <div className="da-cf-subtab-body">
        <SummaryPanel
          callId={callId}
          statusTimeline={statusTimeline}
          isLoadingStatusTimeline={isLoadingStatusTimeline}
          onAdvanceDaStage={onAdvanceDaStage}
          isAdvancingDaStage={isAdvancingDaStage}
          soProcessTimeline={formValues?.soProcessTimeline}
        />

        <div className="da-cf-ops-toolbar">
          <OperationAutoSaveStatus status={operationSaveStatus} />
        </div>

        {/* Clearance, Operation Details and Invoice share one 3-up row — Clearance is
            the smallest of the three, but sits alongside them instead of on its own
            line since all three are just small pieces of read/edit data. */}
        <div className="da-cf-ops-grid da-cf-ops-grid--3col">
          <ClearanceStatsRow stats={clearanceStats} />
          {DA_OPERATOR_SUB_TABS.map((tab) => {
            const Icon = tab.icon;
            const isOperationDetails = tab.key === "operationDetails";
            const isInvoice = tab.key === "invoice";
            return (
              <section className="da-cf-ops-card" style={{ "--step-accent": tab.accent }} key={tab.key}>
                <header className="da-cf-ops-card-header">
                  <span className="da-cf-ops-card-icon"><Icon size={20} /></span>
                  <h4 className="da-cf-ops-card-title">{tab.label}</h4>
                </header>
                <p className="da-cf-ac-card-hint">{tab.hint}</p>
                <div className="da-cf-ops-card-body">
                  {isOperationDetails ? (
                    <div className="da-cf-fields-grid da-cf-fields-grid--fixed2">
                      <ReadonlyField
                        label="Owner"
                        icon={User}
                        value={isLoadingDaDetails && !daDetailsData ? "Loading…" : (daDetailsData?.call_owner_name || "Not set yet")}
                        accent="#0d9488"
                      />
                      {renderField(OPERATION_DETAILS_FIELDS_BY_KEY.coOwners)}
                      <ReadonlyField
                        label="Service requester"
                        icon={OPERATION_DETAILS_FIELDS_BY_KEY.serviceRequester.icon}
                        value={isLoadingDaDetails && !daDetailsData ? "Loading…" : (fieldValues.serviceRequester || "Not set yet")}
                        accent={OPERATION_DETAILS_FIELDS_BY_KEY.serviceRequester.accent}
                      />
                      <ReadonlyField
                        label="Last moved"
                        icon={Clock}
                        value={isLoadingDaDetails && !daDetailsData ? "Loading…" : (formatApiDateTime(daDetailsData?.stage_entered_date) || lastMovedDisplay)}
                        accent={OPERATION_DETAILS_FIELDS_BY_KEY.lastMoved.accent}
                      />
                    </div>
                  ) : isInvoice ? (
                    <InvoiceCardsSection fieldValues={fieldValues} updateField={updateField} />
                  ) : (
                    <p className="da-cf-ac-readonly-value">
                      <span className="da-cf-ac-readonly-empty">Coming soon.</span>
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

DA.propTypes = {
  card: PropTypes.object,
  formValues: PropTypes.object,
  handleChange: PropTypes.func,
  daStatusRefreshToken: PropTypes.number,
  onAdvanceDaStage: PropTypes.func,
  isAdvancingDaStage: PropTypes.bool,
};

export default DA;
