import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import { FiFilePlus, FiFileText, FiClipboard, FiTool, FiCheck, FiChevronLeft, FiChevronRight, FiRefreshCw, FiUpload, FiTrash2 } from "react-icons/fi";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import "../../../../../../design/scss/salesOrder.scss";
import { PORT_OPTIONS, PORT_OPTIONS_WITH_ID } from "../../../../../../shared/constants/ports";
import salesOrderService from "../../../../../../services/salesOrderService";
import callFileService from "../../../../../../services/callFileService";
import useAttachmentsReducer from "../../../../../../store/AttachmentsReducer";
import DatePickerField from "../../../shared/components/DatePickerField";
import PremiumSelect from "../../../../../../components/form/PremiumSelect";
import useAlertReducer from "../../../../../../store/AlertReducer";
import useAuthReducer from "../../../../../../store/AuthReducer";
import WorkOrderCreationModal from "./WorkOrderCreationModal";
import WorkOrderDetailsModal from "./WorkOrderDetailsModal";
import GeneratePOModal from "./GeneratePOModal";
import GoodsReceiptPOModal from "./GoodsReceiptPOModal";
import SoApprovalEmailModal from "./SoApprovalEmailModal";
import CustomModal from "../../../../../../components/CustomModal";
import DeleteConfirmationModal from "../../../../../../components/DeleteConfirmationModal";

const BP_CURRENCY_OPTIONS = ["SAR", "USD", "EURO"];
const USD_TO_SAR_RATE = 3.75;
const SALES_ORDER_PAGE_SIZE = 10;

// Group Checkbox Component with indeterminate support
const GroupCheckbox = ({ checked, indeterminate, onChange, onClick }) => {
  const checkboxRef = useRef(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={checkboxRef}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={onClick}
      style={{
        width: "18px",
        height: "18px",
        cursor: "pointer",
      }}
    />
  );
};

GroupCheckbox.propTypes = {
  checked: PropTypes.bool.isRequired,
  indeterminate: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  onClick: PropTypes.func.isRequired,
};

const TAX_CODE_OPTIONS = ["15%", "5%", "0%"];
const TYPE_OF_PO_OPTIONS = ["Inhouse", "Outhouse PO", "Multiple PO"];

// Client-specific SO → Invoice → Payment status sequence, per ops-provided reference
// (API.txt). Different clients follow different named statuses/timelines — "GENERAL" is
// the fallback for clients without specific invoicing guidelines. Where a client has
// multiple port/call-type variants in the reference, one representative variant is used
// here (see comment per entry) — not yet split by port/call type. maxDays is shown as a
// target, not enforced.
const CLIENT_SO_STATUS_TIMELINES = {
  GENERAL: [
    { label: "To Be Sent for SO Approval", maxDays: "1" },
    { label: "Awaiting SO Approval", maxDays: "3" },
    { label: "Invoice Issuance", maxDays: "1" },
    { label: "Invoice Dispatched", maxDays: "1" },
    { label: "Awaiting Payment", maxDays: "Credit period" },
    { label: "Closed Paid" },
  ],
  MCDERMOTT: [ // import/export/domestic — Rastanura variant
    { label: "To Be Sent for SRF", maxDays: "1" },
    { label: "Awaiting SRF", maxDays: "4" },
    { label: "Invoice Issued and Send for PO", maxDays: "1" },
    { label: "PO Received", maxDays: "7" },
    { label: "Invoice Dispatched", maxDays: "1" },
    { label: "Archived" },
  ],
  SAIPEM: [ // Domestic call-Jubail variant
    { label: "To Be Sent for SO Approval", maxDays: "1" },
    { label: "Awaiting SO Approval", maxDays: "3" },
    { label: "To Be Sent for Service Entry", maxDays: "1" },
    { label: "Awaiting Consolidated Invoice" },
  ],
  "L&T": [ // Domestic call-Jubail/RT variant
    { label: "Sent for SCC Approval / SCC (Service Request Form)", maxDays: "2 days" },
    { label: "Follow Up SCC Approval" },
    { label: "Invoice Issued", maxDays: "3 days" },
    { label: "Submitted", maxDays: "2 days" },
    { label: "Closed Unpaid" },
    { label: "Closed Paid" },
  ],
  "SUBSEA 7": [ // Domestic call-Jubail/RT variant
    { label: "To Be Sent for SRT / SRT (Service Request Ticket)", maxDays: "3" },
    { label: "Follow Up SRT Approval", maxDays: "1" },
    { label: "Invoice Issued", maxDays: "2" },
    { label: "Submitted", maxDays: "1" },
    { label: "Closed Unpaid" },
    { label: "Closed Paid" },
  ],
  "AL-GIHAZ": [ // (Lamprell) — Domestic/Husbandry call-Jubail/RT variant (same steps both)
    { label: "SO Approval", maxDays: "7" },
    { label: "Request for PO", maxDays: "7" },
    { label: "Invoice Issued", maxDays: "4" },
    { label: "Payment Application Form", maxDays: "7" },
    { label: "Final Submission of Invoice" },
    { label: "Closed Unpaid" },
    { label: "Closed Paid" },
  ],
  "LAMPRELL SAUDI": [ // Domestic call /RT variant
    { label: "SO Approval", maxDays: "2" },
    { label: "Invoice Issued", maxDays: "1" },
    { label: "Submitted", maxDays: "1" },
    { label: "Closed Unpaid" },
    { label: "Closed Paid" },
  ],
  "LAMPRELL UAE": [ // Domestic call-Jubail/RT variant
    { label: "Approved SO Along with PO" },
    { label: "Invoice Issued" },
    { label: "Submitted" },
    { label: "Closed Unpaid" },
    { label: "Closed Paid" },
  ],
};

// Matches the SO's client/billing entity name against the reference table above,
// falling back to GENERAL when the client isn't listed.
const resolveClientSoStatusSteps = (clientName) => {
  const name = String(clientName || "").trim().toUpperCase();
  if (!name) return CLIENT_SO_STATUS_TIMELINES.GENERAL;
  const key = Object.keys(CLIENT_SO_STATUS_TIMELINES).find((k) => k !== "GENERAL" && name.includes(k));
  return CLIENT_SO_STATUS_TIMELINES[key] || CLIENT_SO_STATUS_TIMELINES.GENERAL;
};

const EMPTY_NEW_ITEM_FORM = {
  callFile: "",
  itemNo: "",
  tariffId: "",
  itemDescription: "",
  qty: "",
  unitPrice: "",
  discount: "0",
  taxCode: "15%",
  typeOfPo: "",
  supplierCode: "",
  supplierName: "",
  documents: [],
};

const isThirdParty = (value) => value === 1 || value === "1" || value === true;

const DUMMY_VENDORS = [
  { code: "VEND-001", name: "Al Rashid Trading Co." },
  { code: "VEND-002", name: "Gulf Marine Supplies" },
  { code: "VEND-003", name: "Eastern Shipping LLC" },
  { code: "VEND-004", name: "Red Sea Logistics" },
  { code: "VEND-005", name: "Arabian Cargo Services" },
  { code: "VEND-006", name: "Jubail Maritime Group" },
  { code: "VEND-007", name: "Dammam Port Services" },
  { code: "VEND-008", name: "Saudi Freight Solutions" },
];

// Vendor List Modal
const VendorListModal = ({ show, onClose, onSelect }) => {
  const [search, setSearch] = useState("");
  if (!show) return null;

  const filtered = DUMMY_VENDORS.filter(
    (v) =>
      v.code.toLowerCase().includes(search.toLowerCase()) ||
      v.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#fff", borderRadius: "10px", width: "480px", maxHeight: "70vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#1a1a2e" }}>Select Vendor</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "#888", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: "14px 22px", borderBottom: "1px solid #eee" }}>
          <input
            type="text"
            placeholder="Search by code or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            style={{ width: "100%", padding: "8px 12px", border: "1px solid #dde0ea", borderRadius: "7px", fontSize: "13px", boxSizing: "border-box", fontFamily: "inherit" }}
          />
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "#888", fontSize: "13px" }}>No vendors found.</div>
          ) : (
            filtered.map((v) => (
              <div
                key={v.code}
                onClick={() => { onSelect(v); onClose(); }}
                style={{ padding: "12px 22px", cursor: "pointer", borderBottom: "1px solid #f4f4f8", display: "flex", alignItems: "center", gap: "14px", transition: "background 0.1s" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f6ff")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              >
                <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#5a5f8a", background: "#f0f2ff", padding: "3px 8px", borderRadius: "5px", flexShrink: 0 }}>{v.code}</span>
                <span style={{ fontSize: "14px", color: "#1a1a2e", fontWeight: "500" }}>{v.name}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

VendorListModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
};

// Document List Modal — manages the documents already attached to a sales order item
// (sourced from the API's per-item `documents` array) plus any newly uploaded this session.
// No shared document library concept — each item only ever shows/edits its own files.
const DocumentListModal = ({ show, onClose, onSave, initialSelected = [], libraryDocs = [] }) => {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [uploadedDocs, setUploadedDocs] = useState([]);

  useEffect(() => {
    if (show) {
      setSelected(new Set((initialSelected || []).map((d) => d.id)));
      setUploadedDocs([]);
      setSearch("");
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
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const ext = (file.name.split(".").pop() || "").toUpperCase();
    const newDoc = { id: `local-${Date.now()}`, name: file.name, type: ext || "FILE" };
    setUploadedDocs((prev) => [...prev, newDoc]);
    setSelected((prev) => new Set(prev).add(newDoc.id));
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: "16px", boxSizing: "border-box" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#fff", borderRadius: "10px", width: "90%", maxWidth: "640px", maxHeight: "70vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#1a1a2e" }}>Select Supporting Documents</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "#888", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: "14px 22px", borderBottom: "1px solid #eee", flexShrink: 0, display: "flex", gap: "10px", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search by document name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            style={{ flex: 1, padding: "8px 12px", border: "1px solid #dde0ea", borderRadius: "7px", fontSize: "13px", boxSizing: "border-box", fontFamily: "inherit" }}
          />
          <label
            style={{ padding: "8px 14px", fontSize: "13px", border: "1px solid #dde0ea", borderRadius: "7px", background: "#f5f6ff", color: "#2A00FF", cursor: "pointer", fontFamily: "inherit", fontWeight: "600", whiteSpace: "nowrap", flexShrink: 0 }}
          >
            Upload New
            <input type="file" onChange={handleFileUpload} style={{ display: "none" }} />
          </label>
        </div>
        <div style={{ overflowY: "auto", flex: 1, minHeight: 0, padding: "14px 18px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px", alignContent: "start" }}>
          {filtered.length === 0 ? (
            <div style={{ gridColumn: "1 / -1", padding: "24px", textAlign: "center", color: "#888", fontSize: "13px" }}>No documents found.</div>
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
                    gap: "14px",
                    padding: "12px 14px",
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
                    style={{ width: "16px", height: "16px", cursor: "pointer", flexShrink: 0, accentColor: "#2A00FF" }}
                  />
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "40px",
                      height: "40px",
                      borderRadius: "9px",
                      background: "#eef1ff",
                      color: "#2A00FF",
                      flexShrink: 0,
                    }}
                  >
                    <FiFileText size={20} />
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: "14px", color: "#1a1a2e", fontWeight: "600", minWidth: 0, wordBreak: "break-word" }}>{d.name}</span>
                    <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#5a5f8a", background: "#f0f2ff", padding: "2px 7px", borderRadius: "4px", alignSelf: "flex-start" }}>{d.type}</span>
                  </span>
                </label>
              );
            })
          )}
        </div>
        <div style={{ padding: "14px 22px", borderTop: "1px solid #eee", display: "flex", justifyContent: "flex-end", gap: "10px", flexShrink: 0 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "8px 18px", fontSize: "13px", border: "1px solid #ddd", borderRadius: "5px", background: "#f5f5f5", color: "#333", cursor: "pointer", fontFamily: "inherit" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{ padding: "8px 18px", fontSize: "13px", border: "none", borderRadius: "5px", background: "#00368c", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: "600" }}
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
};

// Premium pagination control for the sales order table
const SalesOrderPagination = ({ page, total, limit, onPageChange, compact = false }) => {
  if (!total || total <= 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  const getPageNumbers = () => {
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = [1];
    let rangeStart = Math.max(2, page - 1);
    let rangeEnd = Math.min(totalPages - 1, page + 1);
    if (page <= 2) rangeEnd = 4;
    if (page >= totalPages - 1) rangeStart = totalPages - 3;
    if (rangeStart > 2) pages.push("ellipsis-start");
    for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
    if (rangeEnd < totalPages - 1) pages.push("ellipsis-end");
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className={`so-pagination${compact ? " so-pagination--compact" : ""}`}>
      <span className="so-pagination-info">
        Showing <strong>{start}</strong>–<strong>{end}</strong> of <strong>{total}</strong> entries
      </span>
      <div className="so-pagination-controls">
        <button
          type="button"
          className="so-pagination-btn so-pagination-nav"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          aria-label="Previous page"
        >
          <FiChevronLeft size={16} />
        </button>
        {getPageNumbers().map((p) =>
          typeof p === "number" ? (
            <button
              key={p}
              type="button"
              className={`so-pagination-btn so-pagination-page${page === p ? " is-active" : ""}`}
              onClick={() => onPageChange(p)}
              aria-current={page === p ? "page" : undefined}
            >
              {p}
            </button>
          ) : (
            <span key={p} className="so-pagination-ellipsis">
              &hellip;
            </span>
          )
        )}
        <button
          type="button"
          className="so-pagination-btn so-pagination-nav"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          aria-label="Next page"
        >
          <FiChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

SalesOrderPagination.propTypes = {
  page: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired,
  limit: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
  compact: PropTypes.bool,
};

const SalesOrderList = ({
  card,
  formValues,
  handleChange,
  cardColor,
  readOnly = false,
  showPOStatus = false,
  isDAModule = false,
  isDaCardContext = false,
  isLoadingSalesOrder = false,
  salesOrderError = null,
  refreshSalesOrder,
}) => {
  // Broader "this is a DA card" signal — isDAModule alone only covers the dedicated DA-desk
  // board routes; isDaCardContext also covers DA-variant/DA-board cards reached via the
  // generic /kanban-board/:boardId route (where a separate "DA" tab is appended instead).
  const isDaVerifyContext = isDAModule || isDaCardContext;
  const salesOrderList = formValues.salesOrderList || [];
  const billingEntity = formValues.billingEntity || "";
  const lineItemTotal = formValues.lineItemTotal || 0;

  // SO Header fields (no mock defaults — values come from API via mapSalesOrderResponse or user edits)
  const soCustomerCode = formValues.soCustomerCode || "";
  const soCustomerName = formValues.soCustomerName || "";
  const soContactPerson = formValues.soContactPerson || "";
  const soBpCurrency = formValues.soBpCurrency || "";
  const soEuroRate = formValues.soEuroRate || "";
  const soPoNo = formValues.soPoNo || "";
  const soPort = formValues.soPort || "";
  const soSoNo = formValues.soSoNo || "";
  const soPostingDate = formValues.soPostingDate || "";
  const soDeliveryDate = formValues.soDeliveryDate || "";
  const soDocumentDate = formValues.soDocumentDate || "";
  const soShipName = formValues.soShipName || "";
  const soProjectName = formValues.soProjectName || "";
  const branch = formValues.branch || "";
  const soContactEmail = formValues.email || "";
  const srtNumber = formValues.srtNumber || "";
  const loggedInUserName = useAuthReducer((state) => state.profileData?.name || state.authData?.name || "");
  const soOwner = formValues.soOwner || loggedInUserName;
  const soRemarks = formValues.soRemarks || "";

  const portOptions = useMemo(() => {
    if (!soPort || PORT_OPTIONS.includes(soPort)) return PORT_OPTIONS;
    return [soPort, ...PORT_OPTIONS];
  }, [soPort]);

  const bpCurrencySelectOptions = useMemo(
    () => BP_CURRENCY_OPTIONS.map((c) => ({ value: c, label: c === "EURO" ? "EURO (€)" : c })),
    []
  );

  const portSelectOptions = useMemo(
    () => portOptions.map((p) => ({ value: p, label: p })),
    [portOptions]
  );

  // State for accordion and form
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);
  const [expandedCallFiles, setExpandedCallFiles] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [newItemForm, setNewItemForm] = useState(EMPTY_NEW_ITEM_FORM);

  // Item code lookup + item details autofill (sales_order/get_item_codes, sales_order/get_item_details)
  const [itemCodeOptions, setItemCodeOptions] = useState([]);
  const [isLoadingItemCodes, setIsLoadingItemCodes] = useState(false);
  const [isLoadingItemDetails, setIsLoadingItemDetails] = useState(false);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [itemNoError, setItemNoError] = useState("");

  const callId = card?.call_id ?? card?.callId ?? null;

  // card_file/get_call_detail — the kanban `card` prop doesn't carry port_id/main_billing_entity_id,
  // so fetch it directly (same pattern used by Operation.jsx / General.jsx).
  const [callDetailData, setCallDetailData] = useState(null);

  useEffect(() => {
    if (!callId) {
      setCallDetailData(null);
      return;
    }
    let cancelled = false;
    callFileService
      .getCallDetail(callId)
      .then((response) => {
        if (cancelled) return;
        const body = response?.data;
        setCallDetailData(body?.data ?? body ?? null);
      })
      .catch(() => {
        if (!cancelled) setCallDetailData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [callId]);

  // attachments/get_all_supporting_docs/{call_id} — always offered as pickable options in the
  // Select Supporting Documents modal, alongside whatever's already attached to the item.
  const supportingDocsLibrary = useAttachmentsReducer((state) => state.supportingDocs);
  const getAllSupportingDocs = useAttachmentsReducer((state) => state.getAllSupportingDocs);

  useEffect(() => {
    getAllSupportingDocs(callId);
  }, [callId, getAllSupportingDocs]);

  const entityId =
    callDetailData?.main_billing_entity_id ??
    formValues.mainBillingEntity ??
    card?.main_billing_entity_id ??
    card?.mainBillingEntity ??
    null;
  const portId = useMemo(
    () =>
      callDetailData?.port_id ??
      card?.port_id ??
      card?.portId ??
      PORT_OPTIONS_WITH_ID.find((p) => p.name === soPort)?.id ??
      null,
    [callDetailData, card, soPort]
  );

  // State for checkbox selection (exclude DA module) — separate sets so a row that already
  // has a PO can still be selected for Work Order, and vice versa.
  const [selectedPoItems, setSelectedPoItems] = useState(new Set());
  const [selectedWoItems, setSelectedWoItems] = useState(new Set());
  // Local-only for now — no backend field/endpoint yet to persist per-item verification (DA-only column).
  const [verifiedItems, setVerifiedItems] = useState(new Set());
  // Local-only — whole-SO status stepper (SO Approval → ... → Closed Paid), steps driven
  // by the client-specific reference table above. No backend field/endpoint yet.
  const [soStatusStepIndex, setSoStatusStepIndex] = useState(0);
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false);
  const [isGeneratingWorkOrder, setIsGeneratingWorkOrder] = useState(false);
  const bulkActionBarRef = useRef(null);
  // State for the email modal on the SO Status stepper's "To Be Sent for SO Approval"
  // step. Local-only for now — no backend send endpoint yet.
  const [showSoApprovalEmailModal, setShowSoApprovalEmailModal] = useState(false);
  // Invoice PDF uploaded on the SO Status stepper's "Invoice Issuance" step. Local-only
  // for now — no backend field/endpoint yet to persist it. Uploading just attaches the
  // file — advancing to the next step happens separately via the Confirm checkbox.
  const [invoicePdfFile, setInvoicePdfFile] = useState(null);
  const [invoicePdfPreviewUrl, setInvoicePdfPreviewUrl] = useState(null);
  const invoicePdfInputRef = useRef(null);

  useEffect(() => {
    if (!invoicePdfFile) {
      setInvoicePdfPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(invoicePdfFile);
    setInvoicePdfPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [invoicePdfFile]);

  // State for the Work Order Details modal (sales_order/get_work_order/{wo_id}) — opened by
  // clicking a Work Order No. in the table.
  const [workOrderDetailsTarget, setWorkOrderDetailsTarget] = useState(null); // order id
  const [workOrderDetails, setWorkOrderDetails] = useState(null);
  const [isLoadingWorkOrderDetails, setIsLoadingWorkOrderDetails] = useState(false);
  const [workOrderDetailsError, setWorkOrderDetailsError] = useState(null);

  // State for Generate PO modal
  const [showGeneratePOPopup, setShowGeneratePOPopup] = useState(false);
  const [isGeneratingPO, setIsGeneratingPO] = useState(false);
  const [generatePOError, setGeneratePOError] = useState(null);
  const [generatePOItemIds, setGeneratePOItemIds] = useState([]);
  // Captured from a successful sales_order/generate_po response — required to generate a GRN
  // against that PO. Reset whenever a new Generate PO session starts so a stale ID from a
  // previous PO can never be reused.
  const [lastGeneratedPurchaseOrderId, setLastGeneratedPurchaseOrderId] = useState(null);

  // State for Goods Receipt PO (GRN) modal - opened via "Copy To" on the Generate PO modal
  const [showGRNModal, setShowGRNModal] = useState(false);
  const [grnDetails, setGrnDetails] = useState(null);
  const [isGeneratingGRN, setIsGeneratingGRN] = useState(false);

  // State for vendor modal (row-level supplier picker)
  const [vendorModalTarget, setVendorModalTarget] = useState(null); // orderId or "new"

  // State for document modal (row-level document picker) — documents themselves come from
  // each item's own `documents` array (mapped from the API), not a shared pool.
  const [documentModalTarget, setDocumentModalTarget] = useState(null); // orderId or "new"

  // State for the line item delete confirmation modal
  const [showDeleteItemModal, setShowDeleteItemModal] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);

  // State for the "Approved" checkbox confirmation modal (Awaiting SO Approval step)
  const [showApproveSoModal, setShowApproveSoModal] = useState(false);
  // State for the "Confirm" checkbox confirmation modal (Invoice Issuance step)
  const [showInvoiceConfirmModal, setShowInvoiceConfirmModal] = useState(false);

  const displayOrderList = Array.isArray(salesOrderList) ? salesOrderList : [];

  const totalOrderCount = displayOrderList.length;
  const totalOrderPages = Math.max(1, Math.ceil(totalOrderCount / SALES_ORDER_PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalOrderPages) setCurrentPage(totalOrderPages);
  }, [currentPage, totalOrderPages]);

  const paginationStart = (currentPage - 1) * SALES_ORDER_PAGE_SIZE;
  const paginatedOrderList = displayOrderList.slice(paginationStart, paginationStart + SALES_ORDER_PAGE_SIZE);

  // Group items by callFile
  const groupByCallFile = (orders) => {
    const grouped = {};
    const ungrouped = [];

    orders.forEach((order) => {
      const callFile = order.callFile;
      if (callFile) {
        if (!grouped[callFile]) {
          grouped[callFile] = [];
        }
        grouped[callFile].push(order);
      } else {
        ungrouped.push(order);
      }
    });

    return { grouped, ungrouped };
  };

  const { grouped, ungrouped } = groupByCallFile(paginatedOrderList);

  // Fetches sales_order/get_item_codes/{portId} — shared by the auto-load effect below and by
  // a post-generate_po refresh (a generated PO can change which items are still available for
  // the port).
  const fetchItemCodes = useCallback((cancelledRef) => {
    if (!portId) {
      setItemCodeOptions([]);
      return Promise.resolve();
    }
    setIsLoadingItemCodes(true);
    return salesOrderService
      .getItemCodes(portId)
      .then((response) => {
        if (cancelledRef?.current) return;
        const body = response?.data;
        setItemCodeOptions(body?.status === "success" && Array.isArray(body?.data) ? body.data : []);
      })
      .catch(() => {
        if (cancelledRef?.current) return;
        setItemCodeOptions([]);
        useAlertReducer.getState().error("Failed to load item codes for the selected port.");
      })
      .finally(() => {
        if (!cancelledRef?.current) setIsLoadingItemCodes(false);
      });
  }, [portId]);

  // Load item codes for the SO's port as soon as the Sales Order tab is opened
  useEffect(() => {
    const cancelledRef = { current: false };
    fetchItemCodes(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [fetchItemCodes]);

  // Toggle accordion for callFile
  const toggleCallFileAccordion = (callFile) => {
    setExpandedCallFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(callFile)) {
        newSet.delete(callFile);
      } else {
        newSet.add(callFile);
      }
      return newSet;
    });
  };

  const calcRowTotal = (order, overrides = {}) => {
    const qty = parseFloat(overrides.qty ?? order.qty) || 0;
    const unitPrice = parseFloat(overrides.unitPrice ?? order.unitPrice) || 0;
    const discount = parseFloat(overrides.discount ?? order.discount) || 0;
    const taxCode = overrides.taxCode ?? order.taxCode ?? "15%";
    const taxRate = (parseFloat(String(taxCode).replace(/%/g, "")) || 0) / 100;
    const discountedPrice = unitPrice * (1 - discount / 100);
    const totalBeforeTax = qty * discountedPrice;
    return Math.round((totalBeforeTax + totalBeforeTax * taxRate) * 100) / 100;
  };

  // Calculate total line item total from list if not provided
  const calculatedLineItemTotal = lineItemTotal || displayOrderList.reduce((sum, item) => {
    return sum + (parseFloat(item.totalAmount) || 0);
  }, 0);

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrencySAR = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "SAR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Get PO Status color
  const getPOStatusColor = (status) => {
    switch (status) {
      case "Draft":
        return "#FFA500"; // Orange
      case "Issued":
        return "#4169E1"; // Royal Blue
      case "Completed":
        return "#008000"; // Green
      default:
        return "#666666"; // Gray
    }
  };

  // Get PO Status background color (lighter version)
  const getPOStatusBgColor = (status) => {
    switch (status) {
      case "Draft":
        return "#FFF4E6"; // Light Orange
      case "Issued":
        return "#E6EDFF"; // Light Blue
      case "Completed":
        return "#E6F7E6"; // Light Green
      default:
        return "#F5F5F5"; // Light Gray
    }
  };

  const handleFieldChange = (orderId, field, value) => {
    const updatedList = salesOrderList.map((order) => {
      if (order.id !== orderId) return order;
      const overrides = { [field]: value };
      return { ...order, ...overrides, totalAmount: calcRowTotal(order, overrides) };
    });
    handleChange("salesOrderList")({ target: { value: updatedList } });
  };

  // Persists Quantity / Discount % / Tax Code edits to sales_order/update_sales_order_item_amount.
  // Fired on blur (qty/discount inputs) or immediately after a select change (tax code) —
  // not on every keystroke, to avoid spamming the API while the user is still typing.
  const handleUpdateItemAmount = async (order) => {
    if (!order?.id) return;
    const payload = {
      so_item_id: order.id,
      quantity: parseFloat(order.qty) || 0,
      discount_percentage: parseFloat(order.discount) || 0,
      tax_percentage: parseFloat(String(order.taxCode ?? "0").replace(/%/g, "")) || 0,
    };
    try {
      await salesOrderService.updateSalesOrderItemAmount(payload);
      if (refreshSalesOrder) await refreshSalesOrder();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to update the item.";
      useAlertReducer.getState().error(msg);
    }
  };

  // Persists SO header field edits to sales_order/update_sales_order. Fired on blur or Enter
  // (no submit button) — sends only the sales_order_id plus the single field that changed.
  // Known columns (delivery_date, document_date, discount_percentage) go top-level; everything
  // else goes under `fields`.
  const handleUpdateSalesOrder = async (payloadFields) => {
    if (!formValues.salesOrderId) return;
    try {
      await salesOrderService.updateSalesOrder({ sales_order_id: formValues.salesOrderId, ...payloadFields });
      if (refreshSalesOrder) await refreshSalesOrder();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to update the sales order.";
      useAlertReducer.getState().error(msg);
    }
  };

  // Attach to onKeyDown alongside an onBlur handler so Enter commits immediately (blurring
  // triggers the actual save, avoiding a duplicate call for the same value).
  const handleEnterBlur = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.target.blur();
    }
  };

  const handleSoDeliveryDateChange = (e) => {
    handleChange("soDeliveryDate")(e);
    handleUpdateSalesOrder({ delivery_date: e.target.value });
  };

  const handleSoDocumentDateChange = (e) => {
    handleChange("soDocumentDate")(e);
    handleUpdateSalesOrder({ document_date: e.target.value });
  };

  const handleToggleVerified = (orderId) => {
    setVerifiedItems((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  // Logs each SO-process step into shared formValues.soProcessTimeline so the DA tab's
  // Summary sub-tab (DA.jsx) can show it as a "Sales Order Activity" timeline — local-only,
  // same as the process itself, but shared across tabs via the card's formValues.
  const appendSoTimelineEvent = (event, itemNo) => {
    const existing = Array.isArray(formValues.soProcessTimeline) ? formValues.soProcessTimeline : [];
    const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, event, itemNo, timestamp: new Date().toISOString() };
    handleChange("soProcessTimeline")({ target: { value: [...existing, entry] } });
  };

  // Advances the whole-SO status stepper by one step (forward-only, one at a time —
  // same interaction pattern as the real DA Status Timeline in the DA tab).
  const handleAdvanceSoStatus = (steps) => {
    setSoStatusStepIndex((prev) => {
      if (prev >= steps.length - 1) return prev;
      const next = prev + 1;
      appendSoTimelineEvent(steps[next].label, null);
      return next;
    });
  };

  // Called from the SO Approval email modal — sending is local-only for now (no backend
  // endpoint yet), so this just closes the modal and advances the stepper.
  const handleCreateSoApprovalEmail = (steps) => {
    setShowSoApprovalEmailModal(false);
    handleAdvanceSoStatus(steps);
  };

  // DA ticks "Approved" once the SO approval response has been received — asks for
  // confirmation first, then advances the stepper the same way the other step actions do.
  const handleApproveSoApproval = (steps) => {
    handleAdvanceSoStatus(steps);
    useAlertReducer.getState().success("Sales order approval confirmed.");
  };

  const handleConfirmApproveSoModal = () => {
    handleApproveSoApproval(resolveClientSoStatusSteps(soCustomerName));
    setShowApproveSoModal(false);
  };

  const handleCancelApproveSoModal = () => {
    setShowApproveSoModal(false);
  };

  // Uploading the invoice on the "Invoice Issuance" step — PDF only, local-only for now
  // (no backend field/endpoint yet). Only attaches the file; DA advances separately via
  // the Confirm checkbox once they've reviewed it.
  const handleInvoicePdfSelected = (file) => {
    if (!file) return;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      useAlertReducer.getState().error("Please upload a PDF file.");
      return;
    }
    setInvoicePdfFile(file);
  };

  const handleRemoveInvoicePdf = () => {
    setInvoicePdfFile(null);
  };

  // DA confirms the attached invoice PDF is correct — asks for confirmation first, then
  // advances the stepper the same way the other step actions do.
  const handleConfirmInvoiceIssuance = (steps) => {
    if (!invoicePdfFile) return;
    handleAdvanceSoStatus(steps);
    useAlertReducer.getState().success(`Invoice "${invoicePdfFile.name}" confirmed.`);
  };

  const handleConfirmInvoiceConfirmModal = () => {
    handleConfirmInvoiceIssuance(resolveClientSoStatusSteps(soCustomerName));
    setShowInvoiceConfirmModal(false);
  };

  const handleCancelInvoiceConfirmModal = () => {
    setShowInvoiceConfirmModal(false);
  };

  // Delete a line item — no backend endpoint yet, so this is local-only (removes from
  // formValues.salesOrderList the same way other row edits in this file persist).
  const handleDeleteItem = (order) => {
    setDeletingItem(order);
    setShowDeleteItemModal(true);
  };

  const handleConfirmDeleteItem = () => {
    if (!deletingItem) return;
    const updatedList = salesOrderList.filter((order) => order.id !== deletingItem.id);
    handleChange("salesOrderList")({ target: { value: updatedList } });
    setSelectedPoItems((prev) => {
      const next = new Set(prev);
      next.delete(deletingItem.id);
      return next;
    });
    setSelectedWoItems((prev) => {
      const next = new Set(prev);
      next.delete(deletingItem.id);
      return next;
    });
    setVerifiedItems((prev) => {
      const next = new Set(prev);
      next.delete(deletingItem.id);
      return next;
    });
    setShowDeleteItemModal(false);
    setDeletingItem(null);
  };

  const handleCancelDeleteItem = () => {
    setShowDeleteItemModal(false);
    setDeletingItem(null);
  };

  const handleVendorSelect = (vendor) => {
    if (vendorModalTarget === "new") {
      setNewItemForm((prev) => ({ ...prev, supplierCode: vendor.code, supplierName: vendor.name }));
    } else if (vendorModalTarget !== null) {
      const updatedList = salesOrderList.map((order) =>
        order.id === vendorModalTarget ? { ...order, supplierCode: vendor.code, supplierName: vendor.name } : order
      );
      handleChange("salesOrderList")({ target: { value: updatedList } });
    }
    setVendorModalTarget(null);
  };

  const handleDocumentSave = (documents) => {
    if (documentModalTarget === "new") {
      setNewItemForm((prev) => ({ ...prev, documents }));
    } else if (documentModalTarget !== null) {
      const updatedList = salesOrderList.map((order) =>
        order.id === documentModalTarget ? { ...order, documents } : order
      );
      handleChange("salesOrderList")({ target: { value: updatedList } });
    }
    setDocumentModalTarget(null);
  };

  const getDocumentModalInitialSelected = () => {
    if (documentModalTarget === "new") return newItemForm.documents || [];
    if (documentModalTarget !== null) {
      const order = salesOrderList.find((o) => o.id === documentModalTarget);
      return order?.documents || [];
    }
    return [];
  };

  // Supporting Documents chip/button control (shared by table rows and add-item form)
  const renderSupportingDocsControl = (documents, onOpen, disabled = false) => {
    const count = documents?.length || 0;

    if (count > 0) {
      const chipContent = (
        <>
          <FiFileText className="so-docs-chip-icon" />
          <span className="so-docs-chip-count">
            {count} file{count > 1 ? "s" : ""}
          </span>
        </>
      );
      return (
        <div className="so-docs-control">
          {readOnly ? (
            <span className="so-docs-chip">{chipContent}</span>
          ) : (
            <button
              type="button"
              className="so-docs-chip so-docs-chip--clickable"
              onClick={onOpen}
              disabled={disabled}
            >
              {chipContent}
            </button>
          )}
          {!readOnly && (
            <button
              type="button"
              className="so-docs-action-btn so-docs-action-btn--icon"
              onClick={onOpen}
              disabled={disabled}
              title="Upload documents"
              aria-label="Upload documents"
            >
              <FiUpload />
            </button>
          )}
        </div>
      );
    }

    if (readOnly) {
      return <span className="so-docs-empty">—</span>;
    }

    return (
      <button type="button" className="so-docs-add-btn" onClick={onOpen} disabled={disabled}>
        <FiFilePlus className="so-docs-add-icon" />
        Add Docs
      </button>
    );
  };

  const handleAddNewItem = () => {
    setNewItemForm(EMPTY_NEW_ITEM_FORM);
    setItemNoError("");
    setIsAccordionOpen(true);
  };

  // No backend endpoint yet — button placeholder, API wiring to follow separately.
  const handleSyncSap = () => {
    useAlertReducer.getState().error("Sync SAP is not available yet.");
  };

  const handleFormChange = (field, value) => {
    setNewItemForm(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  // Item code selected from the port's tariff list — autofill description/price via get_item_details
  const handleItemCodeSelect = async (itemCode) => {
    const option = itemCodeOptions.find((o) => o.item_code === itemCode);
    setNewItemForm((prev) => ({ ...prev, itemNo: itemCode, tariffId: option?.tariff_id ?? "" }));
    setItemNoError("");

    if (!option?.tariff_id) return;

    setIsLoadingItemDetails(true);
    try {
      const response = await salesOrderService.getItemDetails(option.tariff_id, entityId);
      const body = response?.data;
      if (body?.status === "success" && body?.data) {
        const details = body.data;
        setNewItemForm((prev) => ({
          ...prev,
          itemDescription: details.item_name || prev.itemDescription,
          unitPrice: details.price ?? details.default_price ?? prev.unitPrice,
        }));
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Failed to load item details.";
      useAlertReducer.getState().error(msg);
    } finally {
      setIsLoadingItemDetails(false);
    }
  };

  const handleSaveNewItem = async () => {
    if (!newItemForm.tariffId || !newItemForm.itemDescription) {
      setItemNoError("Please select an Item No");
      return;
    }
    setItemNoError("");
    if (!callId) {
      useAlertReducer.getState().error("No call identifier available for this card.");
      return;
    }
    if (isSavingItem) return;

    const payload = {
      call_id: callId,
      tariff_id: newItemForm.tariffId,
      quantity: parseFloat(newItemForm.qty) || 1,
      type_PO: newItemForm.typeOfPo || "",
      supporting_docu: (newItemForm.documents || []).map((d) => d.name).join(", "),
      vendor_id: newItemForm.supplierCode || "",
      discount: parseFloat(newItemForm.discount) || 0,
    };

    setIsSavingItem(true);
    try {
      const response = await salesOrderService.saveSalesOrderItem(payload);
      const body = response?.data;
      if (body?.status !== "success") {
        throw new Error(body?.message || "Failed to save sales order item.");
      }

      const currentList = salesOrderList.length > 0 ? salesOrderList : [];
      const maxId = currentList.length > 0 ? Math.max(...currentList.map((item) => item.id || 0)) : 0;

      const newItem = {
        id: body.so_item_id ?? maxId + 1,
        callFile: newItemForm.callFile || null,
        itemNo: newItemForm.itemNo,
        itemDescription: newItemForm.itemDescription,
        qty: parseFloat(newItemForm.qty) || 1,
        unitPrice: parseFloat(newItemForm.unitPrice) || 0,
        discount: parseFloat(newItemForm.discount) || 0,
        taxCode: newItemForm.taxCode || "15%",
        typeOfPo: newItemForm.typeOfPo || "",
        supplierCode: newItemForm.supplierCode || "",
        supplierName: newItemForm.supplierName || "",
        documents: newItemForm.documents || [],
        poStatus: "Draft",
        workOrder: "",
      };
      newItem.totalAmount = calcRowTotal(newItem);

      handleChange("salesOrderList")({ target: { value: [...currentList, newItem] } });
      useAlertReducer.getState().success("Sales order item saved successfully.");

      setIsAccordionOpen(false);
      setNewItemForm(EMPTY_NEW_ITEM_FORM);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to save sales order item.";
      useAlertReducer.getState().error(msg);
    } finally {
      setIsSavingItem(false);
    }
  };

  const handleCancel = () => {
    setIsAccordionOpen(false);
    setNewItemForm(EMPTY_NEW_ITEM_FORM);
    setItemNoError("");
  };

  // Checkbox selection handlers (only for non-DA module).
  // PO and Work Order have their own selection column/state — a row already carrying one
  // is not selectable for that action, so eligibility is enforced at the checkbox itself
  // rather than by disabling the whole bulk action after the fact.
  const isEligibleForPo = (order) => !order.poNo && Number(order.woStatus) === 1;
  const isEligibleForWo = (order) => !order.workOrder && Number(order.woStatus) !== 1;

  const handleItemCheckboxToggle = (itemId, checked, setSelected) => {
    if (isDAModule) return; // Exclude DA module

    setSelected((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(itemId);
      } else {
        newSet.delete(itemId);
      }
      return newSet;
    });
  };

  const handleGroupSelectAll = (orders, checked, isEligible, setSelected) => {
    if (isDAModule) return; // Exclude DA module

    setSelected((prev) => {
      const newSet = new Set(prev);
      orders.filter(isEligible).forEach((order) => {
        if (checked) {
          newSet.add(order.id);
        } else {
          newSet.delete(order.id);
        }
      });
      return newSet;
    });
  };

  const isGroupAllSelected = (orders, selectedSet, isEligible) => {
    if (isDAModule) return false;
    const eligible = orders.filter(isEligible);
    if (eligible.length === 0) return false;
    return eligible.every((order) => selectedSet.has(order.id));
  };

  const isGroupSomeSelected = (orders, selectedSet, isEligible) => {
    if (isDAModule) return false;
    const eligible = orders.filter(isEligible);
    if (eligible.length === 0) return false;
    return eligible.some((order) => selectedSet.has(order.id)) && !isGroupAllSelected(orders, selectedSet, isEligible);
  };

  const canGeneratePO = selectedPoItems.size > 0;
  const canGenerateWorkOrder = selectedWoItems.size > 0;

  const handleGenerateWorkOrder = () => {
    if (!canGenerateWorkOrder) return;
    setShowWorkOrderModal(true);
  };

  const handleCloseWorkOrderModal = () => {
    setShowWorkOrderModal(false);
  };

  // Opens the Work Order Details modal for a table row and fetches sales_order/get_work_order/{wo_id}.
  const handleOpenWorkOrderDetails = (order) => {
    if (!order.woId) {
      useAlertReducer.getState().error("No work order identifier available for this item.");
      return;
    }
    setWorkOrderDetailsTarget(order.id);
    setWorkOrderDetails(null);
    setWorkOrderDetailsError(null);
    setIsLoadingWorkOrderDetails(true);
    salesOrderService
      .getWorkOrder(order.woId)
      .then((response) => {
        const body = response?.data;
        if (body?.status !== "success" || !body?.data) {
          setWorkOrderDetailsError(
            typeof body?.message === "string" && body.message.trim()
              ? body.message
              : "Unable to load work order details."
          );
          return;
        }
        setWorkOrderDetails(body.data);
      })
      .catch((err) => {
        const msg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Failed to load work order details.";
        setWorkOrderDetailsError(typeof msg === "string" ? msg : "Failed to load work order details.");
      })
      .finally(() => setIsLoadingWorkOrderDetails(false));
  };

  const handleCloseWorkOrderDetails = () => {
    setWorkOrderDetailsTarget(null);
    setWorkOrderDetails(null);
    setWorkOrderDetailsError(null);
  };

  const handleCreateWorkOrder = async () => {
    if (isGeneratingWorkOrder) return;

    // Re-validate against the latest item state right before calling the API —
    // an item may have already had a Work Order generated since it was selected.
    const validItemIds = Array.from(selectedWoItems).filter((id) => {
      const order = displayOrderList.find((o) => o.id === id);
      return order ? isEligibleForWo(order) : false;
    });
    if (validItemIds.length === 0) {
      useAlertReducer.getState().error("Selected items already have a Work Order No. Please refresh and try again.");
      setShowWorkOrderModal(false);
      return;
    }

    const payload = { so_item_ids: validItemIds };
    setIsGeneratingWorkOrder(true);
    try {
      await salesOrderService.generateWorkOrder(payload.so_item_ids);
      useAlertReducer.getState().success("Work order generated successfully.");
      setShowWorkOrderModal(false);
      setSelectedWoItems(new Set());
      if (refreshSalesOrder) await refreshSalesOrder();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to generate work order.";
      useAlertReducer.getState().error(msg);
    } finally {
      setIsGeneratingWorkOrder(false);
    }
  };

  const handleGeneratePO = () => {
    if (!canGeneratePO) return;
    // Re-validate against the latest item state — a selected item may have had a PO
    // generated elsewhere since it was checked.
    const validItemIds = Array.from(selectedPoItems).filter((id) => {
      const order = displayOrderList.find((o) => o.id === id);
      return order ? isEligibleForPo(order) : false;
    });
    if (validItemIds.length === 0) {
      useAlertReducer.getState().error("Selected items already have a PO No. Please refresh and try again.");
      return;
    }
    setGeneratePOItemIds(validItemIds);
    setGeneratePOError(null);
    setLastGeneratedPurchaseOrderId(null);
    setShowGeneratePOPopup(true);
  };

  const handleCloseGeneratePOPopup = () => {
    if (isGeneratingPO) return;
    setShowGeneratePOPopup(false);
  };

  const handleCopyToGoodsReceipt = (poDetails) => {
    setGrnDetails({ ...poDetails, purchaseOrderId: lastGeneratedPurchaseOrderId });
    setShowGRNModal(true);
    setShowGeneratePOPopup(false);
  };

  const handleCloseGRNModal = () => {
    setShowGRNModal(false);
    setGrnDetails(null);
  };

  const handleCreateGRN = async (details) => {
    if (isGeneratingGRN) return;

    const purchaseOrderId = details?.purchaseOrderId;
    if (!purchaseOrderId) {
      useAlertReducer.getState().error("Please submit the purchase order before generating a Goods Receipt.");
      return;
    }

    const discountPercentage =
      formValues.soDiscountPercentage != null && String(formValues.soDiscountPercentage).trim() !== ""
        ? Number(formValues.soDiscountPercentage)
        : 0;

    // Total Payment Due is editable in the GRN preview — the delta the user dialed in
    // against the computed total is sent through as the rounding adjustment.
    const rounding = Number.isFinite(details?.roundingAdjustment)
      ? Math.round(details.roundingAdjustment * 100) / 100
      : 0;

    const payload = {
      purchase_order_id: purchaseOrderId,
      contact_person: soContactPerson,
      due_date: soDeliveryDate,
      document_date: soDocumentDate,
      buyer: soContactPerson,
      owner: soOwner,
      discount_percentage: discountPercentage,
      rounding,
      remarks: soRemarks,
    };

    setIsGeneratingGRN(true);
    try {
      const response = await salesOrderService.generateGRN(payload);
      const body = response?.data;
      if (body?.status !== "success") {
        throw new Error(body?.message || "Failed to generate goods receipt.");
      }
      useAlertReducer.getState().success("Goods receipt generated successfully.");
      handleCloseGRNModal();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to generate goods receipt.";
      useAlertReducer.getState().error(msg);
    } finally {
      setIsGeneratingGRN(false);
    }
  };

  const handleConfirmGeneratePO = async (vendorRefNo) => {
    if (isGeneratingPO) return;

    // Re-validate against the latest known item state right before calling the API —
    // an item may have already had a PO generated since this selection was made.
    const validItemIds = generatePOItemIds.filter((id) => {
      const order = displayOrderList.find((o) => o.id === id);
      return order ? isEligibleForPo(order) : false;
    });
    if (validItemIds.length === 0) {
      useAlertReducer.getState().error("Selected items already have a PO No. Please refresh and try again.");
      setShowGeneratePOPopup(false);
      return;
    }

    const discountPercentage =
      formValues.soDiscountPercentage != null && String(formValues.soDiscountPercentage).trim() !== ""
        ? Number(formValues.soDiscountPercentage)
        : 0;

    const payload = {
      so_item_ids: validItemIds,
      vendor_ref_no: vendorRefNo || "",
      contact_person: soContactPerson,
      branch,
      currency: soBpCurrency,
      delivery_date: soDeliveryDate,
      document_date: soDocumentDate,
      discount_percentage: discountPercentage,
      rounding: 0,
      remarks: soRemarks,
    };

    setIsGeneratingPO(true);
    setGeneratePOError(null);
    try {
      const response = await salesOrderService.generatePO(payload);
      const body = response?.data;
      if (body?.status !== "success") {
        throw new Error(body?.message || "Failed to generate purchase order.");
      }

      useAlertReducer.getState().success("Purchase order generated successfully.");

      const newPurchaseOrderId = body?.data?.purchase_order_id ?? body?.purchase_order_id ?? null;
      setLastGeneratedPurchaseOrderId(newPurchaseOrderId);

      // Leave the modal open (rather than closing it) so "Copy To > Goods Receipt PO" can use
      // the purchase_order_id just captured above.
      setSelectedPoItems(new Set());
      if (refreshSalesOrder) await refreshSalesOrder();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to generate purchase order.";
      setGeneratePOError(msg);
      useAlertReducer.getState().error(msg);
    } finally {
      setIsGeneratingPO(false);
    }
  };

  // Helper function to render table header with tooltip if label > 10 chars (DAModule only)
  const renderTableHeader = (label, className = "") => {
    const thProps = { className: className || undefined };
    if (isDAModule && label.length > 10) {
      const tooltipId = `header-tooltip-${label.replace(/\s+/g, '-').toLowerCase()}`;
      const truncatedLabel = label.substring(0, 10) + "...";
      return <th {...thProps} data-tooltip-id={tooltipId}>{truncatedLabel}</th>;
    }
    return <th {...thProps}>{label}</th>;
  };

  const cellStyle = {
    width: "100%",
    border: "1px solid var(--border-primary)",
    borderRadius: "4px",
    padding: "4px 8px",
    textAlign: "center",
    fontSize: "14px",
    fontFamily: "inherit",
    background: "var(--surface-primary)",
    color: "var(--text-primary)",
  };

  // Render a single order row
  const renderOrderRow = (order) => {
    const hasWorkOrder = Boolean(order.workOrder) || Number(order.woStatus) === 1;
    const defaultTypeOfPo = !isThirdParty(order.is_third_party) ? "Inhouse" : "";

    const eligibleForPo = isEligibleForPo(order);
    const eligibleForWo = isEligibleForWo(order);

    return (
    <tr key={order.id}>
      {/* Item No */}
      <td>
        <div className="sales-order-table-cell">
          <span>{order.itemNo || ""}</span>
        </div>
      </td>

      {/* Item Description */}
      <td>
        <div className="sales-order-table-cell">{order.itemDescription || ""}</div>
      </td>

      {/* Qty */}
      <td>
        <div className="sales-order-table-cell">
          {readOnly ? (order.qty ?? 0) : (
            <input
              type="number"
              min="0"
              step="1"
              value={order.qty ?? 0}
              onChange={(e) => handleFieldChange(order.id, "qty", e.target.value)}
              onBlur={() => handleUpdateItemAmount(order)}
              className="sales-order-qty-input"
              style={cellStyle}
            />
          )}
        </div>
      </td>

      {/* Unit Price */}
      <td>
        <div className="sales-order-table-cell">
          {formatCurrencySAR(order.unitPrice || 0)}
        </div>
      </td>

      {/* Discount % */}
      <td>
        <div className="sales-order-table-cell">
          {readOnly ? `${order.discount ?? 0}%` : (
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={order.discount ?? 0}
              onChange={(e) => handleFieldChange(order.id, "discount", e.target.value)}
              onBlur={() => handleUpdateItemAmount(order)}
              className="sales-order-qty-input"
              style={cellStyle}
            />
          )}
        </div>
      </td>

      {/* Tax Code */}
      <td>
        <div className="sales-order-table-cell">
          {readOnly ? (order.taxCode || "15%") : (
            <select
              value={order.taxCode || "15%"}
              onChange={(e) => {
                const value = e.target.value;
                handleFieldChange(order.id, "taxCode", value);
                handleUpdateItemAmount({ ...order, taxCode: value });
              }}
              className="sales-order-type-po-select"
            >
              {TAX_CODE_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
        </div>
      </td>

      {/* Total Amount */}
      <td>
        <div className="sales-order-table-cell sales-order-table-cell-total">
          {formatCurrencySAR(order.totalAmount || 0)}
        </div>
      </td>

      {/* Work Order No. — checkbox to select for Generate Work Order, or the existing WO number */}
      <td>
        <div className="sales-order-table-cell" style={{ textAlign: "center" }}>
          {isDAModule ? (
            order.workOrder ? (
              <button type="button" className="so-wo-number-link" onClick={() => handleOpenWorkOrderDetails(order)}>
                {order.workOrder}
              </button>
            ) : (
              "—"
            )
          ) : eligibleForWo ? (
            <input
              type="checkbox"
              checked={selectedWoItems.has(order.id)}
              onChange={(e) => handleItemCheckboxToggle(order.id, e.target.checked, setSelectedWoItems)}
              aria-label="Select for Generate Work Order"
              style={{ width: "18px", height: "18px", cursor: "pointer" }}
            />
          ) : order.workOrder ? (
            <button type="button" className="so-wo-number-link" onClick={() => handleOpenWorkOrderDetails(order)}>
              {order.workOrder}
            </button>
          ) : (
            "—"
          )}
        </div>
      </td>

      {/* PO No. — checkbox to select for Generate PO, or the existing PO number */}
      <td>
        <div className="sales-order-table-cell" style={{ textAlign: "center" }}>
          {isDAModule ? (
            order.poNo || "—"
          ) : eligibleForPo ? (
            <input
              type="checkbox"
              checked={selectedPoItems.has(order.id)}
              onChange={(e) => handleItemCheckboxToggle(order.id, e.target.checked, setSelectedPoItems)}
              aria-label="Select for Generate PO"
              style={{ width: "18px", height: "18px", cursor: "pointer" }}
            />
          ) : (
            order.poNo || "—"
          )}
        </div>
      </td>

      {/* Type of PO */}
      <td>
        <div className="sales-order-table-cell">
          {readOnly ? (order.typeOfPo || defaultTypeOfPo || "—") : (
            <select
              value={order.typeOfPo || defaultTypeOfPo}
              onChange={(e) => handleFieldChange(order.id, "typeOfPo", e.target.value)}
              className="sales-order-type-po-select"
              disabled={!hasWorkOrder}
            >
              <option value="">— Select —</option>
              {TYPE_OF_PO_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
        </div>
      </td>

      {/* Third Party */}
      <td>
        <div className="sales-order-table-cell">
          {isThirdParty(order.is_third_party) ? (
            <FiCheck className="so-third-party-tick" aria-label="Third party" />
          ) : (
            <span className="so-docs-empty">—</span>
          )}
        </div>
      </td>

      {/* Supporting Documents */}
      <td>
        <div className="sales-order-table-cell">
          {renderSupportingDocsControl(order.documents, () => setDocumentModalTarget(order.id), !hasWorkOrder)}
        </div>
      </td>

      {/* Supplier Code */}
      <td>
        <div className="sales-order-table-cell sales-order-supplier-cell">
          {readOnly ? (
            <span title={order.supplierName || ""}>{order.supplierCode || "—"}</span>
          ) : (
            <>
              <span
                title={order.supplierName || ""}
                className={`sales-order-supplier-code-text${order.supplierCode ? "" : " is-empty"}`}
              >
                {order.supplierCode ? `${order.supplierCode}` : "—"}
              </span>
              {isThirdParty(order.is_third_party) && (
                <button
                  type="button"
                  onClick={() => setVendorModalTarget(order.id)}
                  title={order.supplierName || "Select Vendor"}
                  className="sales-order-supplier-select-btn"
                  disabled={!hasWorkOrder}
                >
                  {order.supplierCode ? "Change" : "Select"}
                </button>
              )}
            </>
          )}
        </div>
      </td>

      {/* Verify — DA-only, local state until a backend field exists to persist it */}
      {isDaVerifyContext && (
        <td>
          <div className="sales-order-table-cell" style={{ textAlign: "center" }}>
            <input
              type="checkbox"
              className="sales-order-verify-checkbox"
              checked={verifiedItems.has(order.id)}
              onChange={() => handleToggleVerified(order.id)}
              aria-label="Verify line item"
            />
          </div>
        </td>
      )}

      {/* Delete — DA-only, no backend endpoint yet, removes the item locally */}
      {isDaVerifyContext && !readOnly && (
        <td>
          <div className="sales-order-table-cell" style={{ textAlign: "center" }}>
            <button
              type="button"
              className="sales-order-delete-item-btn"
              onClick={() => handleDeleteItem(order)}
              title={`Delete Item No. ${order.itemNo || ""}`}
              aria-label={`Delete Item No. ${order.itemNo || ""}`}
            >
              <FiTrash2 />
            </button>
          </div>
        </td>
      )}
    </tr>
    );
  };

  return (
    <div className="cardform-left-full sales-order-content-wrapper" style={{ "--card-color": cardColor }}>
      <div className="sales-order-list-header">
        <h3 className="sales-order-list-title">
          <span className="sales-order-list-title-bar"></span>
          SALES ORDER LIST
        </h3>
        <div className="sales-order-list-header-actions">
          <SalesOrderPagination
            page={currentPage}
            total={totalOrderCount}
            limit={SALES_ORDER_PAGE_SIZE}
            onPageChange={setCurrentPage}
            compact
          />
          {!readOnly && (
            <div className="sales-order-add-button-wrap">
              <button
                type="button"
                className="sales-order-add-button"
                onClick={handleAddNewItem}
              >
                + Add Item
              </button>

              {/* Add Item Popover — anchored directly below the button */}
              {isAccordionOpen && (
                <>
                  <div className="sales-order-add-popover-backdrop" onClick={handleCancel} />
                  <div className="sales-order-add-accordion sales-order-add-popover" style={{ "--card-color": cardColor }}>
                  <div className="sales-order-add-accordion-header">
                    <h4 className="sales-order-add-accordion-title">Add New Sales Order Item</h4>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="sales-order-add-accordion-close"
                      style={{ color: cardColor }}
                    >
                      ×
                    </button>
                  </div>
                  <div className="sales-order-add-accordion-body">
                    <div className="sales-order-add-form-grid">
                      <div className="sales-order-add-form-field">
                        <label>Item No <span style={{ color: "#e53935" }}>*</span></label>
                        <select
                          value={newItemForm.itemNo}
                          onChange={(e) => handleItemCodeSelect(e.target.value)}
                          className="sales-order-add-form-input"
                          disabled={!portId || isLoadingItemCodes || isLoadingItemDetails}
                          required
                        >
                          <option value="">
                            {!portId
                              ? "Select Port first..."
                              : isLoadingItemCodes
                              ? "Loading item codes..."
                              : "Select Item No..."}
                          </option>
                          {itemCodeOptions.map((o) => (
                            <option key={o.tariff_id} value={o.item_code}>{o.item_code}</option>
                          ))}
                        </select>
                        {itemNoError && (
                          <span className="sales-order-add-form-error">{itemNoError}</span>
                        )}
                      </div>
                      <div className="sales-order-add-form-field" style={{ gridColumn: "span 2" }}>
                        <label>Item Description <span style={{ color: "#e53935" }}>*</span></label>
                        <input
                          type="text"
                          value={newItemForm.itemDescription}
                          onChange={(e) => handleFormChange("itemDescription", e.target.value)}
                          placeholder="e.g., Container Handling Service"
                          className="sales-order-add-form-input"
                          required
                        />
                      </div>
                      <div className="sales-order-add-form-field">
                        <label>Quantity</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={newItemForm.qty}
                          onChange={(e) => handleFormChange("qty", e.target.value)}
                          placeholder="1"
                          className="sales-order-add-form-input"
                        />
                      </div>
                      <div className="sales-order-add-form-field">
                        <label>Unit Price</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={newItemForm.unitPrice}
                          onChange={(e) => handleFormChange("unitPrice", e.target.value)}
                          placeholder="0.00"
                          className="sales-order-add-form-input"
                        />
                      </div>
                      <div className="sales-order-add-form-field">
                        <label>Discount %</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={newItemForm.discount}
                          onChange={(e) => handleFormChange("discount", e.target.value)}
                          placeholder="0"
                          className="sales-order-add-form-input"
                        />
                      </div>
                      <div className="sales-order-add-form-field">
                        <label>Tax Code</label>
                        <select
                          value={newItemForm.taxCode}
                          onChange={(e) => handleFormChange("taxCode", e.target.value)}
                          className="sales-order-add-form-input"
                        >
                          {TAX_CODE_OPTIONS.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div className="sales-order-add-form-field">
                        <label>Type of PO</label>
                        <select
                          value={newItemForm.typeOfPo}
                          onChange={(e) => handleFormChange("typeOfPo", e.target.value)}
                          className="sales-order-add-form-input"
                        >
                          <option value="">— Select —</option>
                          {TYPE_OF_PO_OPTIONS.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div className="sales-order-add-form-field">
                        <label>Supporting Documents</label>
                        <div className="sales-order-add-form-docs">
                          {renderSupportingDocsControl(newItemForm.documents, () => setDocumentModalTarget("new"))}
                        </div>
                      </div>
                      <div className="sales-order-add-form-field">
                        <label>Supplier Code</label>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <input
                            type="text"
                            value={newItemForm.supplierCode ? `${newItemForm.supplierCode} — ${newItemForm.supplierName}` : ""}
                            readOnly
                            placeholder="— Select vendor —"
                            className="sales-order-add-form-input"
                            style={{ flex: 1, cursor: "default" }}
                          />
                          <button
                            type="button"
                            onClick={() => setVendorModalTarget("new")}
                            className="sales-order-supplier-select-btn"
                          >
                            {newItemForm.supplierCode ? "Change" : "Select"}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="sales-order-add-form-actions">
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="sales-order-add-form-cancel"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveNewItem}
                        className="sales-order-add-form-save"
                        disabled={isSavingItem}
                      >
                        {isSavingItem ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                  </div>
                </>
              )}
            </div>
          )}

          {!readOnly && (
            <button
              type="button"
              className="sales-order-sync-sap-button"
              onClick={handleSyncSap}
            >
              <FiRefreshCw />
              Sync SAP
            </button>
          )}
        </div>
      </div>

      {salesOrderError && (
        <div
          role="alert"
          style={{
            margin: "0 16px 12px",
            padding: "12px 14px",
            borderRadius: "8px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontSize: "14px",
          }}
        >
          {salesOrderError}
        </div>
      )}

      <div className="so-main-layout">
        {/* Left: SO Header Fields Panel — scrollable field list */}
        <div className="so-left-panel">
          <div className="so-left-panel-title">Order Details</div>
          <div className="so-left-field-list">
            <div className="so-header-field">
              <label className="so-header-label">Customer Code</label>
              <input
                type="text"
                className="so-header-input so-header-input-readonly"
                value={soCustomerCode}
                readOnly
              />
            </div>
            <div className="so-header-field">
              <label className="so-header-label">Customer Name</label>
              <input
                type="text"
                className="so-header-input so-header-input-readonly"
                value={soCustomerName}
                readOnly
              />
            </div>
            <div className="so-header-field">
              <label className="so-header-label">Contact Person</label>
              <input
                type="text"
                className="so-header-input so-header-input-readonly"
                value={soContactPerson}
                readOnly
              />
            </div>
            <div className="so-header-field">
              <label className="so-header-label">Contact Email</label>
              <input
                type="text"
                className="so-header-input so-header-input-readonly"
                value={soContactEmail}
                readOnly
              />
            </div>
            <div className="so-header-field">
              <label className="so-header-label">PO No <span className="so-required">*</span></label>
              <input
                type="text"
                className="so-header-input"
                placeholder="Enter PO No..."
                value={soPoNo}
                onChange={handleChange("soPoNo")}
                onBlur={() => handleUpdateSalesOrder({ fields: { po_number: soPoNo } })}
                onKeyDown={handleEnterBlur}
                readOnly={readOnly}
                required
              />
            </div>
            <div className="so-header-field">
              <label className="so-header-label">SRT Number</label>
              <input
                type="text"
                className="so-header-input"
                placeholder="Enter SRT Number..."
                value={srtNumber}
                onChange={handleChange("srtNumber")}
                readOnly={readOnly}
              />
            </div>
            <div className="so-header-field">
              <label className="so-header-label">Project Name <span className="so-required">*</span></label>
              <input
                type="text"
                className="so-header-input"
                placeholder="Enter project name..."
                value={soProjectName}
                onChange={handleChange("soProjectName")}
                onBlur={() => handleUpdateSalesOrder({ fields: { project_name: soProjectName } })}
                onKeyDown={handleEnterBlur}
                readOnly={readOnly}
                required
              />
            </div>
            <div className="so-header-field">
              <label className="so-header-label">Port</label>
              <PremiumSelect
                className="so-header-premium-select"
                value={soPort}
                onChange={handleChange("soPort")}
                options={portSelectOptions}
                placeholder="Select Port..."
                searchPlaceholder="Search port..."
                disabled={readOnly}
              />
            </div>
            <div className="so-header-field">
              <label className="so-header-label">Branch</label>
              <input
                type="text"
                className="so-header-input so-header-input-readonly"
                value={branch}
                readOnly
              />
            </div>
            <div className="so-header-field">
              <label className="so-header-label">SO No</label>
              <input
                type="text"
                className="so-header-input so-header-input-readonly"
                value={soSoNo}
                readOnly
              />
            </div>
            <div className="so-header-field">
              <label className="so-header-label">Posting Date</label>
              <DatePickerField
                dateValue={soPostingDate}
                dateFieldName="soPostingDate"
                disabled
                className="so-header-input so-header-input-readonly"
              />
            </div>
            <div className="so-header-field">
              <label className="so-header-label">Delivery Date</label>
              <DatePickerField
                dateValue={soDeliveryDate}
                onDateChange={handleSoDeliveryDateChange}
                dateFieldName="soDeliveryDate"
                disabled={readOnly}
                className="so-header-input"
              />
            </div>
            <div className="so-header-field">
              <label className="so-header-label">Document Date</label>
              <DatePickerField
                dateValue={soDocumentDate}
                onDateChange={handleSoDocumentDateChange}
                dateFieldName="soDocumentDate"
                disabled={readOnly}
                className="so-header-input"
              />
            </div>
            <div className="so-header-field">
              <label className="so-header-label">Ship Name</label>
              <input
                type="text"
                className="so-header-input"
                placeholder="Enter ship name..."
                value={soShipName}
                readOnly
              />
            </div>
            <div className="so-header-field">
              <label className="so-header-label">BP Currency</label>
              <PremiumSelect
                className="so-header-premium-select"
                value={soBpCurrency}
                onChange={handleChange("soBpCurrency")}
                options={bpCurrencySelectOptions}
                placeholder="—"
                searchPlaceholder="Search currency..."
                disabled={readOnly}
              />
            </div>
            {soBpCurrency === "USD" && (
              <div className="so-header-field">
                <label className="so-header-label">USD → SAR Rate</label>
                <span className="so-currency-rate so-currency-rate-block">
                  1 USD = {USD_TO_SAR_RATE} SAR
                </span>
              </div>
            )}
            {soBpCurrency === "EURO" && (
              <div className="so-header-field">
                <label className="so-header-label">Conversion Rate (€ → SAR) <span className="so-required">*</span></label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="so-header-input"
                  placeholder="Enter EUR → SAR rate..."
                  value={soEuroRate}
                  onChange={handleChange("soEuroRate")}
                  readOnly={readOnly}
                  required
                />
              </div>
            )}
          </div>
        </div>

        {/* Right: Table view + Accounting Summary — wider column */}
        <div className="so-right-panel">
          {/* Sticky Bulk Action Bar — each button only appears once its own selection is non-empty */}
          {!isDAModule && (canGeneratePO || canGenerateWorkOrder) && (
            <div ref={bulkActionBarRef} className="so-bulk-action-bar so-bulk-action-bar-compact">
              <div className="so-bulk-action-buttons">
                {canGeneratePO && (
                  <button
                    type="button"
                    onClick={handleGeneratePO}
                    className="so-bulk-btn so-bulk-btn-generate-po"
                  >
                    <FiClipboard className="so-bulk-btn-icon" />
                    Generate PO ({selectedPoItems.size})
                  </button>
                )}
                {canGenerateWorkOrder && (
                  <button
                    type="button"
                    onClick={handleGenerateWorkOrder}
                    className="so-bulk-btn so-bulk-btn-generate-wo"
                  >
                    <FiTool className="so-bulk-btn-icon" />
                    Generate Work Order ({selectedWoItems.size})
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="table-wrapper sales-order-table-container" style={{ position: "relative" }}>
            {isLoadingSalesOrder && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 5,
                  backgroundColor: "rgba(255, 255, 255, 0.75)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: "12px",
                }}
                aria-busy="true"
                aria-live="polite"
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    border: "3px solid #e2e8f0",
                    borderTopColor: cardColor || "#2A00FF",
                    borderRadius: "50%",
                    animation: "salesOrderSpin 0.8s linear infinite",
                  }}
                />
                <style>{`@keyframes salesOrderSpin { to { transform: rotate(360deg); } }`}</style>
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#334155" }}>Loading sales order…</span>
              </div>
            )}
            {/* Tooltips for table headers (DAModule only, labels > 10 chars) */}
            {isDAModule && (
              <>
                <Tooltip id="header-tooltip-item-description" place="top" content="Item Description" className="small-header-tooltip" />
                <Tooltip id="header-tooltip-total-amount" place="top" content="Total Amount" className="small-header-tooltip" />
              </>
            )}
            <table className="table table-striped sales-order-table sales-order-list-table" style={{ "--card-color": "#e2e6ff" }}>
              <thead>
                <tr>
                  {renderTableHeader("Item No", "col-item-no")}
                  {renderTableHeader("Item Description", "col-item-desc")}
                  {renderTableHeader("Quantity", "col-qty")}
                  {renderTableHeader("Unit Price", "col-unit-price")}
                  {renderTableHeader("Discount", "col-discount")}
                  {renderTableHeader("Tax Code", "col-tax")}
                  {renderTableHeader("Total Amount", "col-total")}
                  {renderTableHeader("Work Order No.", "col-work-order")}
                  {renderTableHeader("PO No.", "col-po-no")}
                  {renderTableHeader("Type of PO", "col-type-po")}
                  {renderTableHeader("Third Party", "col-third-party")}
                  {renderTableHeader("Supporting Documents", "col-documents")}
                  {renderTableHeader("Supplier Code", "col-supplier")}
                  {isDaVerifyContext && renderTableHeader("Verify", "col-verify")}
                  {isDaVerifyContext && !readOnly && renderTableHeader("", "col-delete")}
                </tr>
              </thead>
              <tbody>
                {displayOrderList.length === 0 && !isLoadingSalesOrder && (
                  <tr>
                    <td
                      colSpan={13 + (isDaVerifyContext ? 1 : 0) + (isDaVerifyContext && !readOnly ? 1 : 0)}
                      style={{ padding: "28px 16px", textAlign: "center", color: "#64748b", fontSize: "14px" }}
                    >
                      No sales order line items for this call.
                    </td>
                  </tr>
                )}
                {/* Render grouped items with accordion (2+ items per callFile) */}
                {Object.entries(grouped).map(([callFile, orders]) => {
                  if (orders.length < 2) {
                    // If only 1 item, render as regular row
                    return renderOrderRow(orders[0]);
                  }

                  const isExpanded = expandedCallFiles.has(callFile);
                  const groupAllSelectedPo = isGroupAllSelected(orders, selectedPoItems, isEligibleForPo);
                  const groupSomeSelectedPo = isGroupSomeSelected(orders, selectedPoItems, isEligibleForPo);
                  const groupAllSelectedWo = isGroupAllSelected(orders, selectedWoItems, isEligibleForWo);
                  const groupSomeSelectedWo = isGroupSomeSelected(orders, selectedWoItems, isEligibleForWo);

                  return (
                    <React.Fragment key={callFile}>
                      {/* Accordion header row */}
                      <tr
                        className="sales-order-accordion-header-row"
                        onClick={(e) => {
                          // Don't toggle if clicking on checkbox
                          if (!isDAModule && e.target.type === "checkbox") {
                            e.stopPropagation();
                            return;
                          }
                          toggleCallFileAccordion(callFile);
                        }}
                        style={{ cursor: "pointer", backgroundColor: isExpanded ? "rgba(42, 0, 255, 0.05)" : "#ffffff" }}
                      >
                        <td colSpan={isDaVerifyContext ? 14 : 13} style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                              {!isDAModule && (
                                <GroupCheckbox
                                  checked={groupAllSelectedPo}
                                  indeterminate={groupSomeSelectedPo}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleGroupSelectAll(orders, e.target.checked, isEligibleForPo, setSelectedPoItems);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              )}
                              {!isDAModule && (
                                <GroupCheckbox
                                  checked={groupAllSelectedWo}
                                  indeterminate={groupSomeSelectedWo}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleGroupSelectAll(orders, e.target.checked, isEligibleForWo, setSelectedWoItems);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              )}
                              <span
                                style={{
                                  transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                                  transition: "transform 0.2s",
                                  display: "inline-block",
                                  color: cardColor,
                                  fontWeight: "bold",
                                  fontSize: "16px"
                                }}
                              >
                                ▶
                              </span>
                              <span style={{ fontWeight: "600", color: "#1a1a1a" }}>
                                Call File: {callFile}
                              </span>
                              <span style={{
                                fontSize: "12px",
                                color: "#666",
                                backgroundColor: "rgba(42, 0, 255, 0.1)",
                                padding: "2px 8px",
                                borderRadius: "12px"
                              }}>
                                {orders.length} item{orders.length > 1 ? "s" : ""}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                      {/* Accordion content rows */}
                      {isExpanded && orders.map((order) => renderOrderRow(order))}
                    </React.Fragment>
                  );
                })}
                {/* Render ungrouped items (no callFile) */}
                {ungrouped.map((order) => renderOrderRow(order))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Sales Order Status — DA-only, whole-SO status checklist (SO Approval →
          ... → Closed Paid), steps sourced from the client-specific reference table
          (CLIENT_SO_STATUS_TIMELINES) matched against this SO's client/billing entity name.
          Plain vertical checklist (no timeline/progress-bar visual) — each row's own action
          advances one step at a time, same interaction pattern as the real DA Status
          Timeline in the DA tab. Local-only for now — no backend field/endpoint yet to
          persist the current step. */}
      {isDaVerifyContext && (() => {
        const steps = resolveClientSoStatusSteps(soCustomerName);
        const currentIndex = Math.min(soStatusStepIndex, steps.length - 1);
        return (
          <div className="so-client-process-section">
            <h3 className="so-client-process-title">
              <FiClipboard className="so-client-process-title-icon" />
              Sales Order Status{soCustomerName ? ` — ${soCustomerName}` : ""}
            </h3>
            <div className="so-status-checklist">
              {steps.map((step, index) => {
                if (index !== currentIndex) return null;
                const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "pending";
                const isClickable = state === "current" && index < steps.length - 1;
                return (
                  <div
                    className={`so-status-check-row so-status-check-row--${state}`}
                    key={step.label}
                  >
                    <div className="so-status-check-icon">
                      {state === "done" ? <FiCheck /> : <span className="so-status-check-dot" />}
                    </div>
                    <div className="so-status-check-info">
                      <span className="so-status-check-label">{step.label}</span>
                    </div>
                    <div className="so-status-check-action">
                      {isClickable && step.label === "To Be Sent for SO Approval" ? (
                        <button
                          type="button"
                          className="so-status-step-dot--labeled"
                          title="Open SO Approval email"
                          onClick={() => setShowSoApprovalEmailModal(true)}
                        >
                          To Be Sent for SO Approval
                        </button>
                      ) : isClickable && step.label === "Awaiting SO Approval" ? (
                        <label className="so-status-step-approve-check" title={`Move to "${steps[index + 1].label}"`}>
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={() => setShowApproveSoModal(true)}
                          />
                          <span>Approved</span>
                        </label>
                      ) : isClickable && step.label === "Invoice Issuance" ? (
                        <div className="so-status-check-invoice-action">
                          <button
                            type="button"
                            className="so-status-step-upload-btn"
                            title="Upload invoice PDF"
                            onClick={() => invoicePdfInputRef.current?.click()}
                          >
                            <FiUpload />
                            <span>{invoicePdfFile ? "Replace Invoice PDF" : "Upload Invoice PDF"}</span>
                          </button>
                          <input
                            ref={invoicePdfInputRef}
                            type="file"
                            accept="application/pdf,.pdf"
                            className="so-status-step-upload-input-hidden"
                            onChange={(e) => {
                              handleInvoicePdfSelected(e.target.files?.[0]);
                              e.target.value = "";
                            }}
                          />
                          {invoicePdfFile && (
                            <span className="so-status-step-file-name" title={invoicePdfFile.name}>
                              <FiFileText />
                              <span className="so-status-step-file-label">{invoicePdfFile.name}</span>
                              {invoicePdfPreviewUrl && (
                                <a
                                  href={invoicePdfPreviewUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="so-status-step-file-action"
                                  title="View invoice PDF"
                                >
                                  View
                                </a>
                              )}
                              <button
                                type="button"
                                className="so-status-step-file-action so-status-step-file-action--remove"
                                title="Remove invoice PDF"
                                onClick={handleRemoveInvoicePdf}
                              >
                                ×
                              </button>
                            </span>
                          )}
                          <label
                            className={`so-status-step-approve-check${!invoicePdfFile ? " so-status-step-approve-check--disabled" : ""}`}
                            title={invoicePdfFile ? `Move to "${steps[index + 1].label}"` : undefined}
                          >
                            <input
                              type="checkbox"
                              checked={false}
                              disabled={!invoicePdfFile}
                              onChange={() => setShowInvoiceConfirmModal(true)}
                            />
                            <span>Confirm</span>
                          </label>
                        </div>
                      ) : isClickable ? (
                        <button
                          type="button"
                          className="so-status-check-advance-btn"
                          onClick={() => handleAdvanceSoStatus(steps)}
                        >
                          Move to &quot;{steps[index + 1].label}&quot;
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <SoApprovalEmailModal
              show={showSoApprovalEmailModal}
              onClose={() => setShowSoApprovalEmailModal(false)}
              onCreate={() => handleCreateSoApprovalEmail(steps)}
              soCustomerName={soCustomerName}
            />
            <CustomModal
              show={showApproveSoModal}
              closeModal={handleCancelApproveSoModal}
              dialgName="so-approve-confirm-dialog"
              body={
                <div className="so-approve-confirm-body">
                  <div className="so-approve-confirm-title">
                    {`Are you sure you want to approve this Sales Order${soCustomerName ? ` — ${soCustomerName}` : ""}?`}
                  </div>
                  <div className="so-approve-confirm-actions">
                    <button type="button" className="btn btn-secondary" onClick={handleCancelApproveSoModal}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-primary" onClick={handleConfirmApproveSoModal}>
                      Confirm
                    </button>
                  </div>
                </div>
              }
            />
            <CustomModal
              show={showInvoiceConfirmModal}
              closeModal={handleCancelInvoiceConfirmModal}
              dialgName="so-approve-confirm-dialog"
              body={
                <div className="so-approve-confirm-body">
                  <div className="so-approve-confirm-title">
                    {`Are you sure you want to confirm invoice${invoicePdfFile ? ` "${invoicePdfFile.name}"` : ""}?`}
                  </div>
                  <div className="so-approve-confirm-actions">
                    <button type="button" className="btn btn-secondary" onClick={handleCancelInvoiceConfirmModal}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-primary" onClick={handleConfirmInvoiceConfirmModal}>
                      Confirm
                    </button>
                  </div>
                </div>
              }
            />
          </div>
        );
      })()}

      {/* Accounting Summary — always visible at the bottom of the page */}
      {(() => {
        const amountFromForm = (v) => {
          if (v == null || v === "") return null;
          const n = parseFloat(String(v).replace(/,/g, ""));
          return Number.isFinite(n) ? n : null;
        };

        const subtotalCalc = displayOrderList.reduce((sum, item) => {
          const qty = parseFloat(item.qty) || 0;
          const unitPrice = parseFloat(item.unitPrice) || 0;
          return sum + qty * unitPrice;
        }, 0);
        const totalDiscountCalc = displayOrderList.reduce((sum, item) => {
          const qty = parseFloat(item.qty) || 0;
          const unitPrice = parseFloat(item.unitPrice) || 0;
          const discount = parseFloat(item.discount) || 0;
          return sum + qty * unitPrice * (discount / 100);
        }, 0);
        const totalTaxCalc = displayOrderList.reduce((sum, item) => {
          const qty = parseFloat(item.qty) || 0;
          const unitPrice = parseFloat(item.unitPrice) || 0;
          const discount = parseFloat(item.discount) || 0;
          const taxRate = (parseFloat(String(item.taxCode || "").replace(/%/g, "")) || 0) / 100;
          const discountedTotal = qty * unitPrice * (1 - discount / 100);
          return sum + discountedTotal * taxRate;
        }, 0);
        const grandTotalCalc = subtotalCalc - totalDiscountCalc + totalTaxCalc;

        const subtotal = amountFromForm(formValues.soSubtotal) ?? subtotalCalc;
        const totalDiscount = amountFromForm(formValues.soTotalDiscount) ?? totalDiscountCalc;
        const totalTax = amountFromForm(formValues.soTotalTax) ?? totalTaxCalc;
        const grandTotal = amountFromForm(formValues.soGrandTotal) ?? grandTotalCalc;
        const currencyLabel = soBpCurrency === "EURO" ? "EURO (€)" : soBpCurrency;

        return (
          <div className="so-summary-section">
            <h3 className="so-summary-section-title">Accounting Summary</h3>
            <div className="so-summary-extra-fields">
              <div className="so-header-field">
                <label className="so-header-label">Owner</label>
                <input
                  type="text"
                  className="so-header-input so-header-input-readonly"
                  value={soOwner}
                  readOnly
                />
              </div>
              <div className="so-header-field so-summary-remarks-field">
                <label className="so-header-label">Remarks</label>
                <textarea
                  className="so-header-input so-summary-remarks-textarea"
                  placeholder="Add internal remarks..."
                  value={soRemarks}
                  onChange={handleChange("soRemarks")}
                  readOnly={readOnly}
                />
              </div>
            </div>
            <div className="so-accounting-grid">
              <div className="so-accounting-row">
                <span className="so-accounting-label">Currency</span>
                <span className="so-accounting-value so-accounting-currency">{currencyLabel}</span>
              </div>
              <div className="so-accounting-divider" />
              <div className="so-accounting-row">
                <span className="so-accounting-label">Subtotal</span>
                <span className="so-accounting-value">{formatCurrencySAR(subtotal)}</span>
              </div>
              {(!readOnly || (formValues.soDiscountPercentage != null && String(formValues.soDiscountPercentage).trim() !== "")) && (
                <div className="so-accounting-row">
                  <span className="so-accounting-label">Discount</span>
                  {readOnly ? (
                    <span className="so-accounting-value">
                      {String(formValues.soDiscountPercentage).replace(/%$/, "")}%
                    </span>
                  ) : (
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formValues.soDiscountPercentage ?? ""}
                      onChange={handleChange("soDiscountPercentage")}
                      onBlur={() =>
                        handleUpdateSalesOrder({ discount_percentage: parseFloat(formValues.soDiscountPercentage) || 0 })
                      }
                      onKeyDown={handleEnterBlur}
                      placeholder="0"
                      className="so-accounting-discount-input"
                    />
                  )}
                </div>
              )}
              <div className="so-accounting-row">
                <span className="so-accounting-label">Total Discount</span>
                <span className="so-accounting-value so-accounting-discount">− {formatCurrencySAR(totalDiscount)}</span>
              </div>
              <div className="so-accounting-row">
                <span className="so-accounting-label">Total Tax</span>
                <span className="so-accounting-value">{formatCurrencySAR(totalTax)}</span>
              </div>
              <div className="so-accounting-divider" />
              <div className="so-accounting-row so-accounting-grand">
                <span className="so-accounting-label">Grand Total</span>
                <span className="so-accounting-value so-accounting-grand-value">{formatCurrencySAR(grandTotal)}</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Work Order Creation Modal */}
      {showWorkOrderModal && (
        <WorkOrderCreationModal
          show={showWorkOrderModal}
          onClose={handleCloseWorkOrderModal}
          onGenerate={handleCreateWorkOrder}
          isSubmitting={isGeneratingWorkOrder}
          selectedItems={Array.from(selectedWoItems)}
          salesOrderList={displayOrderList}
          cardColor={cardColor}
          billingEntity={billingEntity || soCustomerName}
          vesselName={soShipName}
          portName={soPort}
        />
      )}

      {/* Work Order Details Modal */}
      {workOrderDetailsTarget !== null && (
        <WorkOrderDetailsModal
          show={workOrderDetailsTarget !== null}
          onClose={handleCloseWorkOrderDetails}
          isLoading={isLoadingWorkOrderDetails}
          error={workOrderDetailsError}
          details={workOrderDetails}
          cardColor={cardColor}
        />
      )}

      {/* Generate PO Modal */}
      {showGeneratePOPopup && (
        <GeneratePOModal
          show={showGeneratePOPopup}
          onClose={handleCloseGeneratePOPopup}
          onGenerate={handleConfirmGeneratePO}
          isSubmitting={isGeneratingPO}
          error={generatePOError}
          selectedItems={generatePOItemIds}
          salesOrderList={displayOrderList}
          soNumber={soSoNo}
          status={formValues.soStatus || ""}
          postingDate={soPostingDate}
          deliveryDate={soDeliveryDate}
          documentDate={soDocumentDate}
          branch={branch}
          contactPerson={soContactPerson}
          localCurrency={soBpCurrency}
          owner={soOwner}
          remarks={soRemarks}
          purchaseOrderId={lastGeneratedPurchaseOrderId}
          onCopyToGoodsReceipt={handleCopyToGoodsReceipt}
        />
      )}

      {/* Goods Receipt PO (GRN) Modal - opened via Copy To on the Generate PO modal */}
      {showGRNModal && (
        <GoodsReceiptPOModal
          show={showGRNModal}
          onClose={handleCloseGRNModal}
          poDetails={grnDetails}
          onCreateGRN={handleCreateGRN}
          isSubmitting={isGeneratingGRN}
        />
      )}

      {/* Vendor List Modal */}
      <VendorListModal
        show={vendorModalTarget !== null}
        onClose={() => setVendorModalTarget(null)}
        onSelect={handleVendorSelect}
      />

      {/* Document List Modal */}
      <DocumentListModal
        key={documentModalTarget ?? "closed"}
        show={documentModalTarget !== null}
        onClose={() => setDocumentModalTarget(null)}
        onSave={handleDocumentSave}
        initialSelected={getDocumentModalInitialSelected()}
        libraryDocs={supportingDocsLibrary}
      />

      {/* Delete Line Item confirmation */}
      <DeleteConfirmationModal
        show={showDeleteItemModal}
        onCancel={handleCancelDeleteItem}
        onConfirm={handleConfirmDeleteItem}
        deleteText={`Are you sure you want to delete Item No. ${deletingItem?.itemNo || ""}?`}
      />
    </div>
  );
};

SalesOrderList.propTypes = {
  card: PropTypes.object,
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
  cardColor: PropTypes.string,
  readOnly: PropTypes.bool,
  showPOStatus: PropTypes.bool,
  isDAModule: PropTypes.bool,
  isDaCardContext: PropTypes.bool,
  isLoadingSalesOrder: PropTypes.bool,
  salesOrderError: PropTypes.oneOfType([PropTypes.string, PropTypes.oneOf([null])]),
  refreshSalesOrder: PropTypes.func,
};

export default SalesOrderList;

