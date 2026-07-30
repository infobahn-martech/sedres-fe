import { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  X, FileText, UploadCloud, Hash, Tag, Clock, User, Ship,
  Sparkles, IdCard, CalendarCheck, Anchor, FileCheck, Receipt, Package,
  Paperclip, FolderOpen, Link2, GitBranch, Trash2, Plus, ArrowUpRight, ChevronDown, Building2, Search,
  CheckCircle2, CircleDashed, RefreshCw, Banknote, FileArchive, ShieldCheck,
} from "lucide-react";
import { notify } from "../../../../../../components/Toaster";
import billingEntityService from "../../../../../../services/billingEntityService";
import daService from "../../../../../../services/daService";
import userService from "../../../../../../services/userService";
import { mapBillingEntitiesToOptions, unwrapListResponse } from "../../../../../../shared/helpers/callFileFormOptions";
import { getInitials } from "../../../../../../shared/utils/utils";
import "../../../../../../design/scss/pages/kanban-board/daCardFields.scss";

const SUB_TABS = [
  { key: "summary", label: "Summary", icon: Sparkles },
  { key: "card", label: "Card", icon: IdCard },
  { key: "appointmentClearance", label: "Appointment & Clearance", icon: CalendarCheck },
  { key: "mwpLaunchHire", label: "MWP & Launch Hire", icon: Anchor },
  { key: "clearanceCopies", label: "Clearance Copies", icon: FileCheck },
  { key: "invoicesFees", label: "Invoices, Fees & Certificates", icon: Receipt },
  { key: "billingCargo", label: "Billing", icon: Package },
  { key: "vesselSalesOrder", label: "Vessel & Sales Order", icon: Ship },
  { key: "timeObjects", label: "Time Objects", icon: Clock },
  { key: "more", label: "More", icon: Paperclip },
];

const LIST_SECTIONS = [
  { key: "attachments", label: "Attachments", icon: Paperclip, placeholder: "Add an attachment link or name…", accent: "#2563eb" },
  { key: "docs", label: "Docs", icon: FolderOpen, placeholder: "Add a doc link or name…", accent: "#7c3aed" },
  { key: "linksOverview", label: "Links overview", icon: Link2, placeholder: "Add a link…", accent: "#059669" },
];

// api/da/required_documents/{call_id} — read-only reference documents. Only the
// MWP-tagged ones are currently rendered, inside the "MWP" inner-tab of the MWP &
// Launch Hire sub-tab (see RequiredDocumentsSection below); the rest of this list
// stays as the full shape of what the endpoint returns.
const REQUIRED_DOCUMENTS_CONFIG = [
  { key: "immigration_doc", label: "Crew Immigration", icon: User },
  { key: "inward_clearance_doc", label: "Inward Clearance", icon: CalendarCheck },
  { key: "mwp_doc", label: "MWP", icon: ShieldCheck, section: "mwp", accent: "#0891b2" },
  { key: "mwp_subscription_sadad", label: "MWP Subscription (SADAD)", icon: Banknote, section: "mwp", accent: "#d97706" },
  { key: "outward_clearance_doc", label: "Outward Clearance", icon: CalendarCheck },
  { key: "final_bayan_doc", label: "Final Bayan", icon: FileText },
  { key: "mawani_invoice", label: "Mawani Invoice", icon: Receipt },
  { key: "ibtikar_invoice", label: "Ibtikar Invoice", icon: Receipt },
  { key: "cargo_final_bayan", label: "Cargo Final Bayan", icon: Package },
];

const MWP_REQUIRED_DOCUMENTS_CONFIG = REQUIRED_DOCUMENTS_CONFIG.filter((doc) => doc.section === "mwp");

const MWP_LAUNCH_HIRE_TABS = [
  { key: "mwp", label: "MWP", icon: ShieldCheck },
  { key: "launchHire", label: "Launch Hire", icon: Ship },
];

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
};

const RAW_FIELDS_CONFIG = [
  // Card
  { key: "coOwners", label: "Co-owners", type: "user", group: "card", placeholder: "Search a user…" },
  { key: "customCardId", label: "Custom card ID", type: "text", group: "card", placeholder: "e.g. DA-2026-001" },
  { key: "lastMoved", label: "Last moved", type: "readonly", group: "card" },
  { key: "tags", label: "Tags", type: "chips", group: "card", placeholder: "Add tags" },
  // Appointment & Clearance
  { key: "appointmentEmail", label: "Appointment Email", type: "files", group: "appointmentClearance" },
  { key: "inwardClearanceDate", label: "Inward Clearance date", type: "datetime", group: "appointmentClearance" },
  { key: "outwardClearanceDate", label: "Outward Clearance Date", type: "datetime", group: "appointmentClearance" },
  { key: "operationsCompletionDate", label: "Operations completion date", type: "date", group: "appointmentClearance" },
  // MWP & Launch Hire
  { key: "launchHireSlips", label: "Launch Hire Slips", type: "files", group: "mwpLaunchHire" },
  { key: "thirdPartyLaunchHire", label: "3rd Party Launch hire (If any)", type: "text", group: "mwpLaunchHire", placeholder: "e.g. Al Rashid Transport Co." },
  { key: "roadTransport", label: "Road Transport", type: "number-unit", unit: "DAYS", group: "mwpLaunchHire", placeholder: "e.g. 3" },
  // Clearance Copies
  { key: "sailingClearanceCopy", label: "Sailing Clearance Copy", type: "files", group: "clearanceCopies", reserveSpace: true },
  { key: "inwardClearanceCopy", label: "Inward Clearance Copy", type: "files", group: "clearanceCopies", reserveSpace: true },
  { key: "supportingDocuments", label: "SUPPORTING DOCUMENTS", type: "files", group: "clearanceCopies", showCount: true, showDownloadAll: true, reserveSpace: true },
  { key: "fdaDispatchProof", label: "FDA Dispatch Proof", type: "files", group: "clearanceCopies", reserveSpace: true },
  // Invoices, Fees & Certificates
  { key: "taxInvoice", label: "Tax Invoice", type: "text", group: "invoicesFees", placeholder: "e.g. INV-88213" },
  { key: "srtPoWbs", label: "SRT|PO|WBS", type: "text", group: "invoicesFees", placeholder: "e.g. SRT-2201/PO-9982" },
  { key: "invoiceAmount", label: "Invoice amount (Including VAT)", type: "text", group: "invoicesFees", placeholder: "e.g. 12,500.00" },
  // Billing
  { key: "billingEntity", label: "Billing Entity- -", type: "billing-entity", group: "billingCargo" },
  { key: "billingOthers", label: "Others", type: "text", group: "billingCargo", placeholder: "e.g. Additional billing note" },
  // Vessel & Sales Order
  { key: "vesselName", label: "VESSEL NAME", type: "text", group: "vesselSalesOrder", placeholder: "e.g. MV Atlantic Star" },
  { key: "serviceRequester", label: "Service requester", type: "text", group: "vesselSalesOrder", placeholder: "e.g. Jeffrey Steve" },
  { key: "sapSalesOrderNo", label: "SAP Sales Order No", type: "text", group: "vesselSalesOrder", placeholder: "e.g. 3035188" },
  { key: "srnNo", label: "SRN No. (L & T)", type: "text", group: "vesselSalesOrder", placeholder: "e.g. 683/ CRPO 78/2026" },
  { key: "copyOfSalesOrder", label: "Copy of Sales order", type: "files", group: "vesselSalesOrder" },
  { key: "salesOrderSupportingDocs", label: "Sales Order Supporting documents", type: "files", group: "vesselSalesOrder", showCount: true },
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

// Groups that mix full-width tiles (files/chips) with half-width ones need a fixed
// column count so the full-width tiles end at the same edge as the row above them,
// instead of stretching across extra auto-fit columns on wide screens.
const FIXED_2COL_GROUPS = new Set(["mwpLaunchHire", "billingCargo"]);

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

// Splits "YYYY-MM-DD HH:mm:ss" into the {date, time} shape DateTimeField's
// <input type="date"> / <input type="time"> pair expects.
const parseApiDateTime = (raw) => {
  if (!raw) return { date: "", time: "" };
  const [datePart = "", timePart = ""] = String(raw).trim().split(" ");
  return { date: datePart, time: timePart ? timePart.slice(0, 5) : "" };
};

// Reverse of parseApiDateTime — builds the "YYYY-MM-DD HH:mm:ss" string
// api/da/save_appointment_clearance_tab expects from a DateTimeField's {date, time}.
const combineApiDateTime = ({ date, time } = {}) => {
  if (!date) return "";
  return `${date} ${time ? `${time}:00` : "00:00:00"}`;
};

const firstNonEmptyString = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
};

const getFileUrl = (filePath) => {
  const base = (import.meta.env.VITE_API_ENDPOINT || "").replace(/\/+$/, "");
  const path = String(filePath || "").replace(/^\/+/, "");
  return path ? `${base}/${path}` : "";
};

// api/da/appointment_clearance_tab returns already-uploaded documents (attachment path +
// uploader/date), not browser File objects — map them into the shape FileDropzone renders.
const mapApiDocument = (doc) => {
  const raw = doc?.attachment || "";
  const name = raw.split("/").pop() || raw || "Document";
  return {
    name,
    url: getFileUrl(raw),
    stage_document_id: doc?.stage_document_id ?? null,
    uploaded_by_name: doc?.uploaded_by_name ?? null,
    created_date: doc?.created_date ?? null,
  };
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

// Owner / Co-owners — avatar-trigger + floating search panel, same interaction pattern as
// the app's other user pickers (UserPickerField in BusinessRuleFormModal.jsx): a chevron
// trigger showing the picked user's initials, opening a panel that searches
// users/get_non_vendor_users instead of accepting arbitrary free text.
function UserSearchField({ label, icon, value, placeholder, onChange, accent }) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const query = filterText.trim();
    clearTimeout(debounceRef.current);
    setIsSearching(true);
    debounceRef.current = setTimeout(() => {
      const params = { page: 1, limit: 10, ...(query ? { search: query } : {}) };
      userService.getNonVendorUsers({ params })
        .then(({ data }) => setResults(Array.isArray(data?.data) ? data.data : []))
        .catch(() => setResults([]))
        .finally(() => setIsSearching(false));
    }, query ? 350 : 0);
    return () => clearTimeout(debounceRef.current);
  }, [filterText, isOpen]);

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

function FileDropzone({ label, icon, files, showCount, showDownloadAll, reserveSpace, onAddFiles, onRemoveFile }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = useCallback((fileList) => {
    const arr = Array.from(fileList || []);
    if (arr.length) onAddFiles(arr);
  }, [onAddFiles]);

  const handleDownloadAll = () => {
    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="da-cf-tile da-cf-tile--full">
      <TileLabel icon={icon}>
        {label}
        {showCount && files.length > 0 && <span className="da-cf-count-badge">{files.length}</span>}
      </TileLabel>
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
              <button type="button" className="da-cf-file-remove" onClick={() => onRemoveFile(i)}>
                <X size={14} />
              </button>
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
              <span className="da-cf-file-name da-cf-file-name--placeholder">No file synced yet</span>
            </div>
          </div>
        </div>
      ) : null}
      {showDownloadAll && files.length > 0 && (
        <div className="da-cf-file-actions-row">
          <button type="button" className="da-cf-download-all" onClick={handleDownloadAll}>
            <FileArchive size={13} />
            Download all as ZIP
          </button>
        </div>
      )}
    </div>
  );
}

FileDropzone.propTypes = {
  label: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  files: PropTypes.array.isRequired,
  showCount: PropTypes.bool,
  showDownloadAll: PropTypes.bool,
  reserveSpace: PropTypes.bool,
  onAddFiles: PropTypes.func.isRequired,
  onRemoveFile: PropTypes.func.isRequired,
};

function AutoBillingEntityField({ label, icon, value, isLoading }) {
  return (
    <div className="da-cf-tile">
      <TileLabel icon={icon}>{label}</TileLabel>
      <input
        type="text"
        className="da-cf-input da-cf-input--readonly"
        value={isLoading ? "Loading…" : value}
        placeholder="Not set in Appointment Details / Operation yet"
        readOnly
      />
      <span className="da-cf-tile-hint">Auto-filled from Appointment Details / Operation — not editable here.</span>
    </div>
  );
}

AutoBillingEntityField.propTypes = {
  label: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  value: PropTypes.string.isRequired,
  isLoading: PropTypes.bool.isRequired,
};

function SummaryPanel({ fieldValues, billingEntityLabel, summaryData, isLoadingSummary, onRefresh }) {
  const formatDateTime = (dt) => (dt?.date ? `${dt.date}${dt.time ? ` · ${dt.time}` : ""}` : null);

  // api/da/summary_tab/{call_id} is the source of truth once it loads; until then, or if
  // it comes back without a field, fall back to what's already been typed in other tabs.
  const isSummaryPending = isLoadingSummary && !summaryData;
  const apiValue = (key, fallback) =>
    isSummaryPending ? "Loading…" : (summaryData?.[key] || fallback);
  const apiDateValue = (key, fallback) =>
    isSummaryPending ? "Loading…" : (formatApiDateTime(summaryData?.[key]) || fallback);

  const stats = [
    { label: "Vessel", value: fieldValues.vesselName, icon: Ship, accent: "#2563eb" },
    { label: "Owner", value: fieldValues.owner, icon: User, accent: "#0d9488" },
    { label: "Vessel Owner", value: apiValue("vessel_owner", null), icon: Building2, accent: "#d97706" },
    { label: "Inward Clearance", value: apiDateValue("inward_clearance_date", formatDateTime(fieldValues.inwardClearanceDate)), icon: CalendarCheck, accent: "#0891b2" },
    { label: "Outward Clearance", value: apiDateValue("outward_clearance_date", formatDateTime(fieldValues.outwardClearanceDate)), icon: CalendarCheck, accent: "#7c3aed" },
    { label: "Billing Entity", value: apiValue("billing_entity", billingEntityLabel || null), icon: Package, accent: "#e11d48" },
    { label: "SAP Sales Order No", value: apiValue("sap_sales_order_no", fieldValues.sapSalesOrderNo), icon: Receipt, accent: "#059669" },
  ];

  return (
    <div className="da-cf-summary">
      <div className="da-cf-summary-hero">
        <div className="da-cf-summary-hero-main">
          <p className="da-cf-summary-hero-eyebrow">DA Summary</p>
          <h2 className="da-cf-summary-title">{fieldValues.vesselName || "Vessel not set yet"}</h2>
          <p className="da-cf-summary-hero-subtitle">
            A quick overview of this call&rsquo;s clearance, billing and sales order details.
          </p>
        </div>
        <div className="da-cf-summary-hero-actions">
          <button
            type="button"
            className="da-cf-summary-refresh-btn"
            onClick={onRefresh}
            disabled={isLoadingSummary}
          >
            <RefreshCw size={13} className={isLoadingSummary ? "da-cf-summary-refresh-icon--spinning" : ""} />
            {isLoadingSummary ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <h3 className="da-cf-summary-section-heading">Overview</h3>

      <div className="da-cf-summary-cards">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              className="da-cf-summary-card"
              key={stat.label}
              style={{ "--stagger-index": index, "--summary-accent": stat.accent }}
            >
              <span className="da-cf-summary-card-icon"><Icon size={22} /></span>
              <div className="da-cf-summary-card-content">
                <span className="da-cf-summary-card-label">{stat.label}</span>
                <p className={`da-cf-summary-card-value${stat.value ? "" : " da-cf-summary-card-value--empty"}`}>
                  {stat.value || "Not filled in yet"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

SummaryPanel.propTypes = {
  fieldValues: PropTypes.object.isRequired,
  billingEntityLabel: PropTypes.string,
  summaryData: PropTypes.object,
  isLoadingSummary: PropTypes.bool,
  onRefresh: PropTypes.func,
};

function ListRowsSection({ label, icon, rows, collapsed, onToggleCollapse, onAdd, onChangeRow, onRemoveRow, placeholder, accent }) {
  const Icon = icon;
  return (
    <div className="da-cf-more-card" style={{ "--step-accent": accent }}>
      <button type="button" className="da-cf-more-card-header" onClick={onToggleCollapse}>
        <span className="da-cf-more-card-icon"><Icon size={20} /></span>
        <div className="da-cf-more-card-heading">
          <h5 className="da-cf-more-card-title">{label}</h5>
          <span className="da-cf-more-card-count">{rows.length} item{rows.length === 1 ? "" : "s"}</span>
        </div>
        <span
          className="da-cf-more-add-btn"
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onAdd(); } }}
          title={`Add ${label.toLowerCase()}`}
        >
          <Plus size={15} />
        </span>
        <span className={`da-cf-more-chevron${collapsed ? " da-cf-more-chevron--collapsed" : ""}`}><ChevronDown size={16} /></span>
      </button>
      {!collapsed && (
        rows.length === 0 ? (
          <p className="da-cf-more-empty">Nothing added yet.</p>
        ) : (
          <div className="da-cf-more-rows">
            {rows.map((row, i) => (
              <div className="da-cf-more-row" key={row.id}>
                <Icon size={13} className="da-cf-more-row-icon" />
                <input
                  type="text"
                  className="da-cf-input"
                  value={row.value}
                  placeholder={placeholder}
                  onChange={(e) => onChangeRow(i, e.target.value)}
                />
                <button type="button" className="da-cf-more-row-remove" onClick={() => onRemoveRow(i)} title="Remove">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

ListRowsSection.propTypes = {
  label: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  rows: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, value: PropTypes.string })).isRequired,
  collapsed: PropTypes.bool.isRequired,
  onToggleCollapse: PropTypes.func.isRequired,
  onAdd: PropTypes.func.isRequired,
  onChangeRow: PropTypes.func.isRequired,
  onRemoveRow: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  accent: PropTypes.string,
};

function RelativesSection({ rows, collapsed, onToggleCollapse, onAdd, onChangeRow, onRemoveRow, accent }) {
  return (
    <div className="da-cf-more-card" style={{ "--step-accent": accent }}>
      <button type="button" className="da-cf-more-card-header" onClick={onToggleCollapse}>
        <span className="da-cf-more-card-icon"><GitBranch size={20} /></span>
        <div className="da-cf-more-card-heading">
          <h5 className="da-cf-more-card-title">Relatives &amp; Dependencies</h5>
          <span className="da-cf-more-card-count">{rows.length} item{rows.length === 1 ? "" : "s"}</span>
        </div>
        <span
          className="da-cf-more-add-btn"
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onAdd(); } }}
          title="Add related card"
        >
          <Plus size={15} />
        </span>
        <span className={`da-cf-more-chevron${collapsed ? " da-cf-more-chevron--collapsed" : ""}`}><ChevronDown size={16} /></span>
      </button>
      {!collapsed && (
        rows.length === 0 ? (
          <p className="da-cf-more-empty">No related cards yet.</p>
        ) : (
          <div className="da-cf-more-rows">
            {rows.map((row, i) => (
              <div className="da-cf-more-row" key={row.id}>
                <ArrowUpRight size={14} className="da-cf-more-row-icon" />
                <input
                  type="text"
                  className="da-cf-input"
                  value={row.value}
                  placeholder="e.g. VESSEL NAME - OUTWARD CLEARANCE ON ..."
                  onChange={(e) => onChangeRow(i, e.target.value)}
                />
                <button type="button" className="da-cf-more-row-remove" onClick={() => onRemoveRow(i)} title="Remove">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

RelativesSection.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, value: PropTypes.string })).isRequired,
  collapsed: PropTypes.bool.isRequired,
  onToggleCollapse: PropTypes.func.isRequired,
  onAdd: PropTypes.func.isRequired,
  onChangeRow: PropTypes.func.isRequired,
  onRemoveRow: PropTypes.func.isRequired,
  accent: PropTypes.string,
};

// Read-only list fed by api/da/required_documents/{call_id} — each entry is
// either already uploaded elsewhere in the system (file_name/file_url set)
// or still pending, unlike the editable FileDropzone fields above it.
function RequiredDocumentsSection({ documents, isLoading, configs = REQUIRED_DOCUMENTS_CONFIG, title = "Required Documents", standalone = false }) {
  const uploadedCount = configs.filter((doc) => documents?.[doc.key]?.file_url).length;
  const totalCount = configs.length;
  const progressPct = totalCount ? Math.round((uploadedCount / totalCount) * 100) : 0;

  return (
    <div className={`da-cf-required-docs${standalone ? " da-cf-required-docs--standalone" : ""}`}>
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
};

// Read-only list fed by api/da/time_objects/{call_id} — the set of time objects is
// configured per port/call type (same source as the Appointment tab's stage time
// mapping), so this renders whatever entries the API returns instead of a fixed config.
function TimeObjectsSection({ timeObjects, isLoading }) {
  if (isLoading) {
    return <p className="da-cf-more-empty">Loading…</p>;
  }
  if (timeObjects.length === 0) {
    return <p className="da-cf-more-empty">No time objects recorded yet.</p>;
  }
  return (
    <div className="da-cf-fields-grid da-cf-fields-grid--compact">
      {timeObjects.map((item) => (
        <ReadonlyField
          key={item.key}
          label={item.label}
          icon={Clock}
          value={item.value ? formatApiDateTime(item.value) : "Not set yet"}
        />
      ))}
    </div>
  );
}

TimeObjectsSection.propTypes = {
  timeObjects: PropTypes.arrayOf(
    PropTypes.shape({ key: PropTypes.string, label: PropTypes.string, value: PropTypes.string })
  ).isRequired,
  isLoading: PropTypes.bool,
};

// Operations completion is a plain date (no time) — a lighter formatter than
// formatApiDateTime so the read-only card doesn't show a spurious "00:00".
const formatDisplayDateOnly = (isoDate) => {
  if (!isoDate) return null;
  const d = new Date(`${isoDate}T00:00:00`);
  if (isNaN(d)) return isoDate;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

// Appointment & Clearance sub-tab: only the Appointment Email is something the user
// actually fills in here — the 3 clearance dates are populated from elsewhere in the
// backend, so they're shown read-only (no inputs, no save) instead of editable fields,
// and laid out as a 2x2 card grid rather than a step-by-step flow.
function AppointmentClearanceSection({ fieldValues, updateField }) {
  const cards = [
    {
      key: "appointmentEmail",
      icon: Paperclip,
      label: "Appointment Email",
      hint: "Upload the appointment confirmation email.",
      accent: "#2563eb",
      editable: true,
      isDone: fieldValues.appointmentEmail.length > 0,
      content: (
        <FileDropzone
          label="Appointment Email"
          icon={Paperclip}
          files={fieldValues.appointmentEmail}
          onAddFiles={(newFiles) => updateField("appointmentEmail", [...fieldValues.appointmentEmail, ...newFiles])}
          onRemoveFile={(i) => updateField("appointmentEmail", fieldValues.appointmentEmail.filter((_, idx) => idx !== i))}
        />
      ),
    },
    {
      key: "inwardClearanceDate",
      icon: CalendarCheck,
      label: "Inward Clearance",
      hint: "Synced from the backend once inward clearance is recorded.",
      accent: "#0891b2",
      editable: false,
      isDone: Boolean(fieldValues.inwardClearanceDate.date),
      content: (
        <p className="da-cf-ac-readonly-value">
          {fieldValues.inwardClearanceDate.date
            ? formatApiDateTime(combineApiDateTime(fieldValues.inwardClearanceDate))
            : <span className="da-cf-ac-readonly-empty">Not set yet</span>}
        </p>
      ),
    },
    {
      key: "operationsCompletionDate",
      icon: Anchor,
      label: "Operations Completion",
      hint: "Synced from the backend once operations are marked complete.",
      accent: "#d97706",
      editable: false,
      isDone: Boolean(fieldValues.operationsCompletionDate),
      content: (
        <p className="da-cf-ac-readonly-value">
          {fieldValues.operationsCompletionDate
            ? formatDisplayDateOnly(fieldValues.operationsCompletionDate)
            : <span className="da-cf-ac-readonly-empty">Not set yet</span>}
        </p>
      ),
    },
    {
      key: "outwardClearanceDate",
      icon: CalendarCheck,
      label: "Outward Clearance",
      hint: "Synced from the backend once outward clearance is recorded.",
      accent: "#7c3aed",
      editable: false,
      isDone: Boolean(fieldValues.outwardClearanceDate.date),
      content: (
        <p className="da-cf-ac-readonly-value">
          {fieldValues.outwardClearanceDate.date
            ? formatApiDateTime(combineApiDateTime(fieldValues.outwardClearanceDate))
            : <span className="da-cf-ac-readonly-empty">Not set yet</span>}
        </p>
      ),
    },
  ];

  return (
    <>
      <div className="da-cf-summary-hero">
        <div className="da-cf-summary-hero-main">
          <p className="da-cf-summary-hero-eyebrow">Appointment &amp; Clearance</p>
          <h2 className="da-cf-summary-title">Clearance Overview</h2>
          <p className="da-cf-summary-hero-subtitle">
            Upload the appointment email and track the clearance dates synced from the backend for this call.
          </p>
        </div>
      </div>

      <div className="da-cf-ac-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              className={`da-cf-ac-card${card.isDone ? " da-cf-ac-card--done" : ""}`}
              style={{ "--step-accent": card.accent }}
              key={card.key}
            >
              <div className="da-cf-ac-card-head">
                <span className="da-cf-ac-card-icon"><Icon size={26} /></span>
                <h5 className="da-cf-ac-card-title">{card.label}</h5>
              </div>
              <p className="da-cf-ac-card-hint">{card.hint}</p>
              <div className="da-cf-ac-card-field">{card.content}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

AppointmentClearanceSection.propTypes = {
  fieldValues: PropTypes.object.isRequired,
  updateField: PropTypes.func.isRequired,
};

// Invoices, Fees & Certificates sub-tab — same 3 fields as before (taxInvoice, srtPoWbs,
// invoiceAmount), just re-laid-out as a card-hero grid in the same visual language as
// AppointmentClearanceSection (.da-cf-ac-*) instead of the plain field grid other tabs use.
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
    label: "SRT|PO|WBS",
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

// Vessel & Sales Order sub-tab — same card-hero treatment as AppointmentClearanceSection
// and InvoicesFeesSection: each field (including the two file uploads) becomes its own
// card in a .da-cf-ac-grid instead of the plain field grid other tabs still use.
const VESSEL_SALES_ORDER_CARDS = [
  { key: "vesselName", type: "text", icon: Ship, label: "Vessel Name", hint: "Name of the vessel handled under this call.", accent: "#2563eb", placeholder: "e.g. MV Atlantic Star" },
  { key: "serviceRequester", type: "text", icon: User, label: "Service Requester", hint: "Person who requested this service.", accent: "#0d9488", placeholder: "e.g. Jeffrey Steve" },
  { key: "sapSalesOrderNo", type: "text", icon: Receipt, label: "SAP Sales Order No", hint: "SAP-generated sales order reference.", accent: "#d97706", placeholder: "e.g. 3035188" },
  { key: "srnNo", type: "text", icon: Tag, label: "SRN No. (L & T)", hint: "Service request number from L & T.", accent: "#7c3aed", placeholder: "e.g. 683/ CRPO 78/2026" },
  { key: "copyOfSalesOrder", type: "files", icon: FileText, label: "Copy of Sales Order", hint: "Upload the signed copy of the sales order.", accent: "#059669" },
  { key: "salesOrderSupportingDocs", type: "files", icon: Paperclip, label: "Sales Order Supporting Documents", hint: "Any additional documents supporting the sales order.", accent: "#e11d48", showCount: true },
];

function VesselSalesOrderSection({ fieldValues, updateField }) {
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
                    onRemoveFile={(i) => updateField(card.key, value.filter((_, idx) => idx !== i))}
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
};

// Card sub-tab — framed, animated panel instead of bare tiles on the page
// background (see .da-cf-card-panel* in daCardFields.scss): a pulsing icon
// header and staggered fade-up entrance for the 3 fields it holds.
function CardPanel({ fields, renderField, onSave, isSaving, saveDisabled }) {
  return (
    <div className="da-cf-card-panel">
      <div className="da-cf-card-panel-header">
        <span className="da-cf-card-panel-icon"><IdCard size={18} /></span>
        <div className="da-cf-card-panel-heading">
          <h4 className="da-cf-card-panel-title">Card</h4>
          <p className="da-cf-card-panel-subtitle">Identity, tags and movement info for this card.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={onSave}
          disabled={isSaving || saveDisabled}
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
      </div>
      <div className="da-cf-card-panel-grid">
        {fields.map((field, index) => (
          <div key={field.key} className="da-cf-card-panel-tile" style={{ "--stagger-index": index }}>
            {renderField(field)}
          </div>
        ))}
      </div>
    </div>
  );
}

CardPanel.propTypes = {
  fields: PropTypes.array.isRequired,
  renderField: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  isSaving: PropTypes.bool,
  saveDisabled: PropTypes.bool,
};

function DA({ card, formValues, handleChange }) {
  const [activeSubTab, setActiveSubTab] = useState("summary");
  // Inner toggle for the "MWP & Launch Hire" sub-tab — MWP shows the MWP-tagged
  // required documents, Launch Hire shows the editable launch-hire fields below.
  const [mwpLaunchHireTab, setMwpLaunchHireTab] = useState("mwp");
  const [fieldValues, setFieldValues] = useState(makeInitialFieldState);
  // co_owner_id isn't a visible field — UserSearchField only exposes the picked user's
  // name — but api/da/save_card_tab needs the id, so it's tracked alongside coOwners.
  const [coOwnerId, setCoOwnerId] = useState(null);
  const [lastMovedDisplay] = useState(() => formatTimestamp(new Date()));

  // api/da/summary_tab/{call_id} — feeds the Summary sub-tab with the real,
  // backend-resolved values (clearance dates, billing entity, SAP sales order no,
  // vessel owner) instead of relying only on locally-typed fields from other tabs.
  const callId = card?.call_id ?? card?.callId ?? card?.id ?? null;
  const [summaryData, setSummaryData] = useState(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  // Shared by the mount effect below and the Summary hero's manual Refresh button.
  const fetchSummaryTab = useCallback(() => {
    if (callId == null) return undefined;
    let cancelled = false;
    setIsLoadingSummary(true);
    daService.getSummaryTab(callId)
      .then(({ data }) => {
        if (!cancelled) setSummaryData(data?.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setSummaryData(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSummary(false);
      });
    return () => { cancelled = true; };
  }, [callId]);

  useEffect(() => fetchSummaryTab(), [fetchSummaryTab]);

  // api/da/card_tab/{call_id} — hydrates the editable "Card" sub-tab fields
  // (owner, co-owner, deadline, size, custom card ID, tags) with the backend's
  // saved values once, when the card first loads.
  useEffect(() => {
    if (callId == null) return undefined;
    let cancelled = false;
    daService.getCardTab(callId)
      .then(({ data }) => {
        if (cancelled) return;
        const cardData = data?.data;
        if (!cardData) return;
        setFieldValues((prev) => ({
          ...prev,
          owner: cardData.owner_name ?? prev.owner,
          coOwners: cardData.co_owner_name ?? prev.coOwners,
          deadline: cardData.deadline ?? prev.deadline,
          size: cardData.size ?? prev.size,
          customCardId: cardData.custom_card_id ?? prev.customCardId,
          tags: cardData.tags
            ? cardData.tags.split(",").map((t) => t.trim()).filter(Boolean)
            : prev.tags,
        }));
        setCoOwnerId(cardData.co_owner_id ?? null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [callId]);

  // api/da/appointment_clearance_tab/{call_id} — hydrates the "Appointment & Clearance"
  // sub-tab (clearance/operations dates + the Appointment Email documents already
  // uploaded against this call) once, when the card first loads.
  useEffect(() => {
    if (callId == null) return undefined;
    let cancelled = false;
    daService.getAppointmentClearanceTab(callId)
      .then(({ data }) => {
        if (cancelled) return;
        const tabData = data?.data;
        if (!tabData) return;
        const appointmentEmailDocs = tabData.documents?.["Appointment Email"];
        setFieldValues((prev) => ({
          ...prev,
          inwardClearanceDate: tabData.inward_clearance_date
            ? parseApiDateTime(tabData.inward_clearance_date)
            : prev.inwardClearanceDate,
          outwardClearanceDate: tabData.outward_clearance_date
            ? parseApiDateTime(tabData.outward_clearance_date)
            : prev.outwardClearanceDate,
          operationsCompletionDate: tabData.operations_completion_date
            ? String(tabData.operations_completion_date).slice(0, 10)
            : prev.operationsCompletionDate,
          appointmentEmail: Array.isArray(appointmentEmailDocs)
            ? appointmentEmailDocs.map(mapApiDocument)
            : prev.appointmentEmail,
        }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [callId]);

  // api/da/required_documents/{call_id} — read-only reference documents already
  // uploaded elsewhere in the system, shown at the bottom of the Clearance Copies
  // sub-tab. Unlike appointmentEmail above, these aren't editable here.
  const [requiredDocuments, setRequiredDocuments] = useState(null);
  const [isLoadingRequiredDocuments, setIsLoadingRequiredDocuments] = useState(false);

  useEffect(() => {
    if (callId == null) return undefined;
    let cancelled = false;
    setIsLoadingRequiredDocuments(true);
    daService.getRequiredDocuments(callId)
      .then(({ data }) => {
        if (!cancelled) setRequiredDocuments(data?.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setRequiredDocuments(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRequiredDocuments(false);
      });
    return () => { cancelled = true; };
  }, [callId]);

  // api/da/time_objects/{call_id} — read-only checkpoints (inward/outward clearance,
  // etc.) recorded against this call, shown in the "Time Objects" sub-tab. The response
  // is flattened/deduped the same way General.jsx's viewModeTimeObjects handles it,
  // since the set of objects is configured per port/call type, not fixed here.
  const [timeObjects, setTimeObjects] = useState([]);
  const [isLoadingTimeObjects, setIsLoadingTimeObjects] = useState(false);

  useEffect(() => {
    if (callId == null) return undefined;
    let cancelled = false;
    setIsLoadingTimeObjects(true);
    daService.getTimeObjects(callId)
      .then(({ data }) => {
        if (cancelled) return;
        const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        const seen = new Set();
        const parsed = rows
          .flatMap((item) => (Array.isArray(item) ? item : [item]))
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const label = firstNonEmptyString(item?.time_object, item?.time_object_name, item?.name);
            const value = firstNonEmptyString(item?.value, item?.time_object_value, item?.event_datetime);
            if (!label) return null;
            const key = `${firstNonEmptyString(String(item?.time_object_id ?? ""))}|${label}`;
            if (seen.has(key)) return null;
            seen.add(key);
            return { key, label, value };
          })
          .filter(Boolean);
        setTimeObjects(parsed);
      })
      .catch(() => {
        if (!cancelled) setTimeObjects([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTimeObjects(false);
      });
    return () => { cancelled = true; };
  }, [callId]);

  // api/da/save_card_tab/{call_id} — persists the Card sub-tab fields. current_sticker_id
  // comes from the card's global sticker picker (formValues.card_sticker_id, set via the
  // "Sticker" button in the card header) rather than a field on this tab.
  const [isSavingCardTab, setIsSavingCardTab] = useState(false);

  const handleSaveCardTab = useCallback(async () => {
    if (callId == null) {
      notify("Call ID is required before saving.", "error", "top-center");
      return;
    }
    const stickerId = formValues?.card_sticker_id ?? formValues?.sticker_id;

    const formData = new FormData();
    if (coOwnerId != null && coOwnerId !== "") formData.append("co_owner_id", coOwnerId);
    if (stickerId != null && stickerId !== "") formData.append("current_sticker_id", stickerId);
    formData.append("deadline", fieldValues.deadline || "");
    formData.append("size", fieldValues.size || "");
    formData.append("custom_card_id", fieldValues.customCardId || "");
    formData.append("tags", fieldValues.tags.join(", "));

    setIsSavingCardTab(true);
    try {
      await daService.saveCardTab(callId, formData);
      notify("Card details saved.", "success", "top-center");
    } catch (err) {
      notify(err?.response?.data?.message || "Failed to save card details.", "error", "top-center");
    } finally {
      setIsSavingCardTab(false);
    }
  }, [callId, coOwnerId, formValues, fieldValues]);

  // api/da/save_appointment_clearance_tab/{call_id} — persists the "Appointment &
  // Clearance" sub-tab. Only newly-picked browser File objects in appointmentEmail are
  // uploaded; documents already hydrated from the GET (mapApiDocument) aren't File
  // instances and are skipped so they aren't re-uploaded.
  const [isSavingAppointmentClearanceTab, setIsSavingAppointmentClearanceTab] = useState(false);

  const handleSaveAppointmentClearanceTab = useCallback(async () => {
    if (callId == null) {
      notify("Call ID is required before saving.", "error", "top-center");
      return;
    }
    const formData = new FormData();
    formData.append("inward_clearance_date", combineApiDateTime(fieldValues.inwardClearanceDate));
    formData.append("outward_clearance_date", combineApiDateTime(fieldValues.outwardClearanceDate));
    formData.append("operations_completion_date", fieldValues.operationsCompletionDate || "");
    fieldValues.appointmentEmail
      .filter((file) => file instanceof File)
      .forEach((file) => formData.append("appointment_email[]", file));

    setIsSavingAppointmentClearanceTab(true);
    try {
      await daService.saveAppointmentClearanceTab(callId, formData);
      notify("Appointment & Clearance details saved.", "success", "top-center");
    } catch (err) {
      notify(err?.response?.data?.message || "Failed to save appointment & clearance details.", "error", "top-center");
    } finally {
      setIsSavingAppointmentClearanceTab(false);
    }
  }, [callId, fieldValues]);

  const updateField = useCallback((key, value) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const rowIdCounter = useRef(0);
  const nextRowId = () => `row-${++rowIdCounter.current}`;

  // Billing Entity isn't entered here — it's already captured in the Appointment
  // Details / Operation tabs (formValues.mainBillingEntity / vesselBillingEntity /
  // tugBillingEntity / otherBillingEntity), so this tab just resolves that id to a
  // display name and mirrors it, read-only.
  const [billingEntityOptions, setBillingEntityOptions] = useState([]);
  const [isBillingEntityLoading, setIsBillingEntityLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadBillingEntities = async () => {
      setIsBillingEntityLoading(true);
      try {
        const { data } = await billingEntityService.getBillingEntities({ params: { page: 1, limit: 1000 } });
        const options = mapBillingEntitiesToOptions(unwrapListResponse(data));
        if (!cancelled) setBillingEntityOptions(options);
      } catch {
        if (!cancelled) setBillingEntityOptions([]);
      } finally {
        if (!cancelled) setIsBillingEntityLoading(false);
      }
    };
    loadBillingEntities();
    return () => { cancelled = true; };
  }, []);

  const billingEntityId =
    formValues?.mainBillingEntity ||
    formValues?.vesselBillingEntity ||
    formValues?.tugBillingEntity ||
    formValues?.otherBillingEntity ||
    "";
  const billingEntityLabel = billingEntityId
    ? billingEntityOptions.find((opt) => opt.value === String(billingEntityId))?.label ?? ""
    : "";

  const [listSections, setListSections] = useState(() => ({
    attachments: { rows: [], collapsed: false },
    docs: { rows: [], collapsed: false },
    linksOverview: { rows: [], collapsed: false },
  }));

  const addListRow = (sectionKey) => {
    setListSections((prev) => ({
      ...prev,
      [sectionKey]: { ...prev[sectionKey], rows: [...prev[sectionKey].rows, { id: nextRowId(), value: "" }] },
    }));
  };
  const changeListRow = (sectionKey, idx, value) => {
    setListSections((prev) => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        rows: prev[sectionKey].rows.map((row, i) => (i === idx ? { ...row, value } : row)),
      },
    }));
  };
  const removeListRow = (sectionKey, idx) => {
    setListSections((prev) => ({
      ...prev,
      [sectionKey]: { ...prev[sectionKey], rows: prev[sectionKey].rows.filter((_, i) => i !== idx) },
    }));
  };
  const toggleListCollapse = (sectionKey) => {
    setListSections((prev) => ({
      ...prev,
      [sectionKey]: { ...prev[sectionKey], collapsed: !prev[sectionKey].collapsed },
    }));
  };

  const [relatives, setRelatives] = useState([]);
  const [relativesCollapsed, setRelativesCollapsed] = useState(false);
  const addRelative = () => setRelatives((prev) => [...prev, { id: nextRowId(), value: "" }]);
  const changeRelative = (idx, value) =>
    setRelatives((prev) => prev.map((row, i) => (i === idx ? { ...row, value } : row)));
  const removeRelative = (idx) => setRelatives((prev) => prev.filter((_, i) => i !== idx));

  const renderField = (field) => {
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
            reserveSpace={field.reserveSpace}
            onAddFiles={(newFiles) => updateField(field.key, [...value, ...newFiles])}
            onRemoveFile={(i) => updateField(field.key, value.filter((_, idx) => idx !== i))}
          />
        );
      case "billing-entity":
        return (
          <AutoBillingEntityField
            key={field.key}
            label={field.label}
            icon={field.icon}
            value={billingEntityLabel}
            isLoading={isBillingEntityLoading}
          />
        );
      default:
        return null;
    }
  };

  const activeTabMeta = SUB_TABS.find((tab) => tab.key === activeSubTab);
  const activeFields = FIELDS_BY_GROUP[activeSubTab] ?? [];
  const ActiveGroupIcon = activeTabMeta.icon;

  return (
    <div className="cardform-body da-cf-panel">
      <div className="da-cf-save-banner">
        <span className="da-cf-save-dot" />
        Not saved yet — changes save automatically to this browser
      </div>

      <div className="da-cf-subtabs">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              className={`da-cf-subtab${activeSubTab === tab.key ? " da-cf-subtab--active" : ""}`}
              onClick={() => setActiveSubTab(tab.key)}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="da-cf-subtab-body">
        {activeSubTab !== "summary" && activeSubTab !== "card" && (
          <div className="da-cf-group-header">
            <span className="da-cf-group-icon"><ActiveGroupIcon size={16} /></span>
            <h4 className="da-cf-group-title">{activeTabMeta.label}</h4>
            {activeSubTab !== "more" && activeSubTab !== "timeObjects" && activeSubTab !== "appointmentClearance" && activeSubTab !== "mwpLaunchHire" && activeSubTab !== "invoicesFees" && activeSubTab !== "vesselSalesOrder" && (
              <span className="da-cf-group-count">{activeFields.length} field{activeFields.length === 1 ? "" : "s"}</span>
            )}
            {activeSubTab === "appointmentClearance" && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSaveAppointmentClearanceTab}
                disabled={isSavingAppointmentClearanceTab || callId == null}
              >
                {isSavingAppointmentClearanceTab ? "Saving…" : "Save"}
              </button>
            )}
          </div>
        )}

        {activeSubTab === "summary" ? (
          <SummaryPanel
            fieldValues={fieldValues}
            billingEntityLabel={billingEntityLabel}
            summaryData={summaryData}
            isLoadingSummary={isLoadingSummary}
            onRefresh={fetchSummaryTab}
          />
        ) : activeSubTab === "card" ? (
          <CardPanel
            fields={activeFields}
            renderField={renderField}
            onSave={handleSaveCardTab}
            isSaving={isSavingCardTab}
            saveDisabled={callId == null}
          />
        ) : activeSubTab === "timeObjects" ? (
          <TimeObjectsSection timeObjects={timeObjects} isLoading={isLoadingTimeObjects} />
        ) : activeSubTab === "appointmentClearance" ? (
          <AppointmentClearanceSection fieldValues={fieldValues} updateField={updateField} />
        ) : activeSubTab === "invoicesFees" ? (
          <InvoicesFeesSection fieldValues={fieldValues} updateField={updateField} />
        ) : activeSubTab === "vesselSalesOrder" ? (
          <VesselSalesOrderSection fieldValues={fieldValues} updateField={updateField} />
        ) : activeSubTab === "more" ? (
          <div className="da-cf-more">
            <div className="da-cf-summary-hero">
              <div className="da-cf-summary-hero-main">
                <p className="da-cf-summary-hero-eyebrow">More</p>
                <h2 className="da-cf-summary-title">Additional Details</h2>
                <p className="da-cf-summary-hero-subtitle">
                  Attachments, docs, links and related cards that don&rsquo;t fit anywhere else on this call.
                </p>
              </div>
            </div>
            <div className="da-cf-more-grid">
              {LIST_SECTIONS.map((section) => (
                <ListRowsSection
                  key={section.key}
                  label={section.label}
                  icon={section.icon}
                  rows={listSections[section.key].rows}
                  collapsed={listSections[section.key].collapsed}
                  onToggleCollapse={() => toggleListCollapse(section.key)}
                  onAdd={() => addListRow(section.key)}
                  onChangeRow={(i, v) => changeListRow(section.key, i, v)}
                  onRemoveRow={(i) => removeListRow(section.key, i)}
                  placeholder={section.placeholder}
                  accent={section.accent}
                />
              ))}
              <RelativesSection
                rows={relatives}
                collapsed={relativesCollapsed}
                onToggleCollapse={() => setRelativesCollapsed((c) => !c)}
                onAdd={addRelative}
                onChangeRow={changeRelative}
                onRemoveRow={removeRelative}
                accent="#d97706"
              />
            </div>
          </div>
        ) : activeSubTab === "mwpLaunchHire" ? (
          <div className="da-cf-mwp-launch-hire">
            <div className="da-cf-inner-tabs">
              {MWP_LAUNCH_HIRE_TABS.map((tab) => {
                const InnerIcon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    className={`da-cf-inner-tab${mwpLaunchHireTab === tab.key ? " da-cf-inner-tab--active" : ""}`}
                    onClick={() => setMwpLaunchHireTab(tab.key)}
                  >
                    <InnerIcon size={13} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <div className="da-cf-mwp-launch-hire-panel" key={mwpLaunchHireTab}>
              {mwpLaunchHireTab === "mwp" ? (
                <RequiredDocumentsSection
                  documents={requiredDocuments}
                  isLoading={isLoadingRequiredDocuments}
                  configs={MWP_REQUIRED_DOCUMENTS_CONFIG}
                  title="MWP Documents"
                  standalone
                />
              ) : (
                <div className="da-cf-fields-grid da-cf-fields-grid--launch-hire">
                  {activeFields.map((field) => renderField(field))}
                </div>
              )}
            </div>
          </div>
        ) : activeSubTab === "clearanceCopies" ? (
          <div className="da-cf-fields-grid da-cf-fields-grid--files2">
            {activeFields.map((field) => renderField(field))}
          </div>
        ) : (
          <div
            className={`da-cf-fields-grid${FIXED_2COL_GROUPS.has(activeSubTab) ? " da-cf-fields-grid--fixed2" : ""}`}
          >
            {activeFields.map((field) => renderField(field))}
          </div>
        )}
      </div>
    </div>
  );
}

DA.propTypes = {
  card: PropTypes.object,
  formValues: PropTypes.object,
  handleChange: PropTypes.func,
};

export default DA;
