import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import { FiFilePlus, FiFileText, FiClipboard, FiTool, FiCheck, FiX, FiChevronLeft, FiChevronRight, FiRefreshCw, FiUpload, FiTrash2 } from "react-icons/fi";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import "../../../../../../design/scss/salesOrder.scss";
import { PORT_OPTIONS_WITH_ID } from "../../../../../../shared/constants/ports";
import salesOrderService from "../../../../../../services/salesOrderService";
import billingEntityService from "../../../../../../services/billingEntityService";
import callFileService from "../../../../../../services/callFileService";
import daService from "../../../../../../services/daService";
import useAttachmentsReducer from "../../../../../../store/AttachmentsReducer";
import useVendorReducer from "../../../../../../store/VendorReducer";
import DatePickerField from "../../../shared/components/DatePickerField";
import PremiumSelect from "../../../../../../components/form/PremiumSelect";
import useAlertReducer from "../../../../../../store/AlertReducer";
import useAuthReducer from "../../../../../../store/AuthReducer";
import { useDaLocalVerifiedItems } from "../../../../../../shared/store/daStore";
import { getFirstUserRoleId } from "../../../../../../shared/helpers/groUserRoles";
import WorkOrderCreationModal from "./WorkOrderCreationModal";
import WorkOrderDetailsModal from "./WorkOrderDetailsModal";
import GeneratePOModal from "./GeneratePOModal";
import GoodsReceiptPOModal from "./GoodsReceiptPOModal";
import SoApprovalEmailModal from "./SoApprovalEmailModal";
import DocumentListModal from "./DocumentListModal";
import UploadInvoiceModal from "../../../../../../components/UploadInvoiceModal";
import CustomModal from "../../../../../../components/CustomModal";
import DeleteConfirmationModal from "../../../../../../components/DeleteConfirmationModal";

const BP_CURRENCY_OPTIONS = ["SAR", "USD", "EURO"];
const USD_TO_SAR_RATE = 3.75;
const SALES_ORDER_PAGE_SIZE = 10;
// Column 4's ("SO Sent for approval") local-only per-session action state — see soActionState.
const SO_ACTION_STATE_DEFAULT = {
  button_state: "send",
  last_email_sent_date: null,
  last_decision: null,
  last_decision_date: null,
};

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
// { value, label } shapes for the Add Item form's PremiumSelect fields
const TAX_CODE_SELECT_OPTIONS = TAX_CODE_OPTIONS.map((t) => ({ value: t, label: t }));
const TYPE_OF_PO_SELECT_OPTIONS = TYPE_OF_PO_OPTIONS.map((t) => ({ value: t, label: t }));

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

// The two item_status values da/da_verify_sales_line_item flips a Sales Order line item
// between: ticking the Action-column checkbox must end on "Verified", un-ticking on
// "Completed". Compared through normalizeItemStatus so casing/padding from the API can't make
// a correct response read as a mismatch.
const VERIFIED_ITEM_STATUS = "Verified";
const COMPLETED_ITEM_STATUS = "Completed";
const normalizeItemStatus = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (raw.toLowerCase() === VERIFIED_ITEM_STATUS.toLowerCase()) return VERIFIED_ITEM_STATUS;
  if (raw.toLowerCase() === COMPLETED_ITEM_STATUS.toLowerCase()) return COMPLETED_ITEM_STATUS;
  return raw;
};

// Vendor List Modal
const VendorListModal = ({ show, onClose, onSelect, vendors = [] }) => {
  const [search, setSearch] = useState("");
  if (!show) return null;

  const filtered = vendors.filter(
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
  vendors: PropTypes.arrayOf(
    PropTypes.shape({
      code: PropTypes.string,
      name: PropTypes.string,
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
  isDAModule = false,
  isDaCardContext = false,
  isLoadingSalesOrder = false,
  salesOrderError = null,
  refreshSalesOrder,
  daStatusRefreshToken,
  onAdvanceDaStage,
  isAdvancingDaStage = false,
  onDaStatusRefresh,
  currentStep,
  stepLabels,
  soActionStateResetToken,
}) => {
  // Broader "this is a DA card" signal — isDAModule alone only covers the dedicated DA-desk
  // board routes; isDaCardContext also covers DA-variant/DA-board cards reached via the
  // generic /kanban-board/:boardId route.
  const isDaContext = isDAModule || isDaCardContext;
  //
  // The Sales Order tab's header DA action button (status/advance button, SO approval
  // email, Approve/Reject decisions) is restricted to Port Manager (role_id "1") and Port
  // Operator (role_id "2") only, per request.
  const userProfile = useAuthReducer((state) => state.userProfile);
  const userRoleId = getFirstUserRoleId(userProfile);
  const isPortManagerOrOperator = ["1", "2"].includes(String(userRoleId ?? ""));
  const isDaVerifyContext = isDaContext && isPortManagerOrOperator;
  // The table's own "Action" column (verify tick) is separately scoped, per request, to also
  // include the DA desk user (role_id "22") — the header button above stays PM/PO-only.
  const isDaRoleUser = String(userRoleId ?? "") === "22";
  const canViewActionColumn = isDaContext && (isPortManagerOrOperator || isDaRoleUser);
  const callId = card?.call_id ?? card?.callId ?? null;
  // Deleted items are filtered purely from the API's own status field now — confirmed via
  // testing that da/da_delete_sales_line_item's response and sales_order/get_so_items_by_call
  // both reliably send item_status: "Cancelled" for a deleted row, and mapSalesOrderResponse.js
  // already excludes "cancelled" items on every fetch (see its `items` filter). No client-side
  // fallback needed for this — see updatedList in handleConfirmDeleteItem below for how the
  // row disappears immediately on delete regardless.
  const salesOrderList = useMemo(
    () => formValues.salesOrderList || [],
    [formValues.salesOrderList]
  );
  const billingEntity = formValues.billingEntity || "";

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

  const bpCurrencySelectOptions = useMemo(
    () => BP_CURRENCY_OPTIONS.map((c) => ({ value: c, label: c === "EURO" ? "EURO (€)" : c })),
    []
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
  const updateSalesOrderItemAmount = useVendorReducer((state) => state.updateSalesOrderItemAmount);
  const updateSalesOrderReducer = useVendorReducer((state) => state.updateSalesOrder);

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
  // Per-item verification (DA-only column) — persisted via da/da_verify_sales_line_item.
  // useDaLocalVerifiedItems (daStore.js) holds the tick per call + so_item_id; it is seeded on
  // load from each item's own item_status (see apiVerifiedItemIds below) so the ticks survive a
  // page reload, and is the same in-memory-only store pattern used elsewhere in DA.
  // verifyingItemIds just tracks which item currently has a verify request in flight (drives
  // the checkbox's `disabled` prop). It's React state, so it only takes effect on the NEXT
  // render — a fast double-click/double-fire on the same checkbox can land both events before
  // that render commits, letting both past the `disabled` guard and firing two independent
  // verify calls (confirmed live 2026-09-15: same so_item_id verified then immediately
  // reverted). verifyingItemIdsRef is a synchronous companion Set checked/set at the very top
  // of handleToggleVerified so the second of two near-simultaneous calls is blocked instantly,
  // before React has a chance to re-render.
  const [verifyingItemIds, setVerifyingItemIds] = useState(new Set());
  const verifyingItemIdsRef = useRef(new Set());
  // Latest known line-item list, kept so a verify toggle merges its new status into the result
  // of a toggle that is still in flight on ANOTHER row. Building `updatedList` from the value
  // this render closed over instead would drop that other row's new status, and the status
  // sync below would then un-tick a row whose own call had actually succeeded.
  const salesOrderListRef = useRef([]);
  const localVerifiedItemIds = useDaLocalVerifiedItems((s) => s.verifiedItemIds[callId]);
  const setLocalItemVerified = useDaLocalVerifiedItems((s) => s.setItemVerified);
  // Whether a row reads as verified. Read from the session store only (per request
  // 2026-09-10 — each tick is the client's own explicit action), never from the row's
  // `status` field directly; the store is instead kept in sync with that status below, so the
  // checkbox has a single source of truth in both the toggle and the load path.
  const isItemVerified = (item) => localVerifiedItemIds?.has(item?.id) === true;
  // Keeps the tick in step with each item's own item_status, in BOTH directions — "Verified"
  // ticks the row, any other real status un-ticks it. That is what keeps a click to ONE
  // da/da_verify_sales_line_item request: the endpoint only flips the status, so a checkbox
  // that disagreed with the backend would flip the item the wrong way ("Completed" on a tick)
  // and need a second, corrective call. Syncing only one way left exactly that gap — a row
  // un-ticked here but still "Verified" in the list data (or the reverse) stayed out of step.
  // Items whose status the backend leaves blank are skipped, so they keep this session's tick.
  const apiItemStatusFlags = useMemo(
    () =>
      (Array.isArray(salesOrderList) ? salesOrderList : [])
        .map((item) => [item?.id, normalizeItemStatus(item?.status)])
        .filter(([itemId, status]) => itemId != null && status !== "")
        .map(([itemId, status]) => [itemId, status === VERIFIED_ITEM_STATUS]),
    [salesOrderList]
  );
  useEffect(() => {
    salesOrderListRef.current = Array.isArray(salesOrderList) ? salesOrderList : [];
  }, [salesOrderList]);
  useEffect(() => {
    if (!callId) return;
    apiItemStatusFlags.forEach(([itemId, isVerified]) => {
      // An item with a request in flight is mid-flip; its row status is whatever the previous
      // call left behind, so syncing from it here would fight the click in progress.
      if (verifyingItemIdsRef.current.has(itemId)) return;
      if (useDaLocalVerifiedItems.getState().isItemVerified(callId, itemId) !== isVerified) {
        setLocalItemVerified(callId, itemId, isVerified);
      }
    });
  }, [apiItemStatusFlags, callId, setLocalItemVerified, verifyingItemIds]);
  // On column 4 ("SO Sent for approval"), the plain "Send For SO approval" button stays hidden
  // until every current line item has been verified. The non-empty check prevents an empty
  // sales-order list from passing Array.prototype.every() vacuously. Only the initial send
  // state is gated; the Awaiting-decision, approved, and post-reject states remain available
  // once the SO-approval cycle has started.
  const hasVerifiedAllItems =
    salesOrderList.length > 0 && salesOrderList.every((item) => isItemVerified(item));
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false);
  const [isGeneratingWorkOrder, setIsGeneratingWorkOrder] = useState(false);
  const bulkActionBarRef = useRef(null);

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
  const [vendors, setVendors] = useState([]);
  const vendorSelectOptions = useMemo(
    () => vendors.map((v) => ({ value: v.code, label: `${v.code} — ${v.name}` })),
    [vendors]
  );

  // get_item_codes can return the same item_code under several tariff rows; show each code once
  // (first occurrence wins, same row handleItemCodeSelect resolves via find).
  const itemCodeSelectOptions = useMemo(() => {
    const seen = new Set();
    return itemCodeOptions.reduce((acc, o) => {
      if (!o?.item_code || seen.has(o.item_code)) return acc;
      seen.add(o.item_code);
      acc.push({ value: o.item_code, label: o.item_code });
      return acc;
    }, []);
  }, [itemCodeOptions]);

  // Vendor list — billingentity/getvendors, [{ customer_code, customer_name }]
  useEffect(() => {
    let cancelled = false;
    billingEntityService
      .getVendors()
      .then((response) => {
        if (cancelled) return;
        const rows = Array.isArray(response?.data?.data) ? response.data.data : [];
        setVendors(
          rows.map((v) => ({
            code: v.customer_code != null ? String(v.customer_code) : "",
            name: v.customer_name != null ? String(v.customer_name) : "",
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setVendors([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // State for document modal (row-level document picker) — documents themselves come from
  // each item's own `documents` array (mapped from the API), not a shared pool.
  const [documentModalTarget, setDocumentModalTarget] = useState(null); // orderId or "new"

  // State for the line item delete confirmation modal
  const [showDeleteItemModal, setShowDeleteItemModal] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  // Column 4 ("SO Sent for approval") button state: { button_state: "send" |
  // "awaiting_approval" | "approved", last_email_sent_date, last_decision, last_decision_date }.
  // Hydrated from api/da/action_state/{call_id} again (restored per request 2026-09-24 — the
  // 2026-09-11 local-only/per-session version is gone), so reopening a card shows the state the
  // backend actually persisted. The local setSoActionState calls in handleCreateSoApprovalEmail /
  // handleApproveDaClientDecision / handleRejectDaClientDecision below stay as optimistic
  // updates until the refetch below confirms them. Falls back to SO_ACTION_STATE_DEFAULT
  // ("send") whenever the fetch fails or the call isn't found.
  const [soActionState, setSoActionState] = useState(SO_ACTION_STATE_DEFAULT);
  // Whether the client's approval was recorded in THIS session (handleApproveDaClientDecision
  // below) — see effectiveSoButtonState for why a persisted "approved" alone isn't enough.
  const [didApproveSoInSession, setDidApproveSoInSession] = useState(false);

  const fetchSoActionState = useCallback(() => {
    if (!callId) return;
    daService
      .getActionState(callId)
      .then(({ data }) =>
        setSoActionState(data?.status === "success" ? data.data ?? SO_ACTION_STATE_DEFAULT : SO_ACTION_STATE_DEFAULT)
      )
      .catch(() => setSoActionState(SO_ACTION_STATE_DEFAULT));
  }, [callId]);

  // soActionStateResetToken is bumped by CardForm's handleClose on every close (see there) —
  // closing and reopening the SAME card doesn't necessarily remount this component, so callId
  // alone wasn't enough to catch that case, only an actual page refresh (a real fresh mount).
  // Resets to the default first so the previous card's state never shows while the fetch below
  // is still in flight.
  useEffect(() => {
    setSoActionState(SO_ACTION_STATE_DEFAULT);
    setDidApproveSoInSession(false);
    setIsApprovalEmailUploaded(false);
    setApprovedByInput("");
    setApprovedByName("");
  }, [callId, soActionStateResetToken]);

  // daStatusRefreshToken is bumped by onDaStatusRefresh after every action below, so the
  // authoritative button_state is refetched once per action instead of being called by hand.
  useEffect(() => {
    if (!canViewActionColumn) return;
    fetchSoActionState();
  }, [canViewActionColumn, callId, daStatusRefreshToken, soActionStateResetToken, fetchSoActionState]);

  // The header action button reflects and acts on the DA record's REAL current stage.
  //
  // Deliberately NOT name-matched against "Ops completed" / "SO approval" text (an earlier
  // version did, via /ops completed/i and /so approval/i) — confirmed 2026-08-25 that
  // different calls' timelines use entirely different wording for this stage (e.g. one
  // call's step right after "Ops completed" is "To be sent for SRF", not "SO approval" at
  // all), so name-matching left the header button permanently hidden — even after
  // verifying — on every call whose next step isn't literally named "SO approval".

  // The card's real current stage — the card's own sticker (same flattened sticker_name field
  // the topbar sticker pill reads, kept in sync via kanban_card/update_card_sticker — see the
  // "status_timeline's sticker_id" note in daStatusTimeline.js) is now the only source; the
  // separate api/da/status_timeline fetch this used to also fall back to (and the local
  // override for the window before it loaded) was removed per request 2026-09-11 — it was
  // desyncing from the board column and leaking stale labels (e.g. "Closed Paid") into the
  // header/Subject on cards that hadn't actually reached that stage.
  const isAtArInvoiceColumn =
    Array.isArray(stepLabels) && currentStep != null && /ar invoice issued/i.test(stepLabels[currentStep - 1] || "");
  // Column-driven, same pattern as the other isAt*Column flags — while the card is physically
  // sitting on "Ops completed" (before it's moved on to "SO Sent for approval"), the header
  // action area must show nothing at all, regardless of what the granular DA status-timeline
  // says (it can already read "To be sent for SO approval" at this point, from verifying line
  // items — see handleToggleVerified's skipCardMove advance — which used to leak a button onto
  // this column even though the card hasn't reached the SO-approval column yet). Per request
  // 2026-09-10: reconfirmed no DA action button of any kind should show at this column, even
  // once verified — a same-day attempt to show it right after verify (before the column move)
  // was reverted.
  const isAtOpsCompletedColumn =
    Array.isArray(stepLabels) && currentStep != null && /ops completed/i.test(stepLabels[currentStep - 1] || "");
  // Same masking problem as isAtArInvoiceColumn, but for column 4 ("SO Sent for approval").
  // Also reused by shouldShowDaActionButton further below.
  const isCardAtSoApprovalColumn =
    Array.isArray(stepLabels) && currentStep != null && /so sent for approval/i.test(stepLabels[currentStep - 1] || "");
  // What column 4's header action actually renders from (see the header action block below).
  //
  // api/da/action_state can report button_state "approved" for a call that is still physically
  // sitting on column 4 — recording an approval moves the card ON to column 5 ("SO/PO Approval
  // Received"), which renders the Approved/Upload-Approval-Email UI through its own
  // isAtSoApprovalDecisionColumn branch, so an "approved" reading while the card is still on
  // column 4 is a leftover from an earlier cycle of the same call, not this one. Trusting it
  // there replaced the "Send For SO approval" action with the Upload Approval Email UI on cards
  // that had only just arrived at the column (reported 2026-09-24). Only an approval recorded in
  // this session (didApproveSoInSession) keeps the card showing Approved on column 4, and that's
  // purely to avoid a flash while the column move is still in flight. "awaiting_approval" is
  // trusted as persisted — that's the state worth surviving a card reopen.
  const effectiveSoButtonState =
    isCardAtSoApprovalColumn && soActionState?.button_state === "approved" && !didApproveSoInSession
      ? "send"
      : soActionState?.button_state;
  // The Sales Order tab's own "Action" column (Verify + Delete, further below) needs a
  // different, column-POSITION-driven flag rather than isCardAtSoApprovalColumn's text match —
  // each department/client swimlane on the multi-workflow board runs its own column set (see
  // WorkflowAccordion/WorkflowColumns — e.g. Supervisor/Operator's column right after "Ops
  // Completed" is literally named "SO Sent for approval", but Subsea 7's is "Awaiting SRT"),
  // so a fixed name match only ever worked for the one workflow that happens to use that
  // wording. Per request 2026-09-11: show the Action column on whichever column comes
  // immediately after "Ops Completed" in THIS card's own workflow, regardless of its name.
  // Deliberately NOT reused for isCardAtSoApprovalColumn's own consumers (the header SO
  // approval email/decision button flow) — that flow is specifically about the SO-approval
  // sub-stage and must stay scoped to workflows that actually name a column that way.
  const opsCompletedStepIndex = Array.isArray(stepLabels)
    ? stepLabels.findIndex((label) => /ops completed/i.test(label || ""))
    : -1;
  const isAtColumnAfterOpsCompleted =
    opsCompletedStepIndex !== -1 && currentStep != null && currentStep === opsCompletedStepIndex + 2;
  // api/da/status_timeline is no longer fetched here (removed per request 2026-09-11 — it was
  // the source of a "Closed Paid" label leaking into the Subject on cards that hadn't actually
  // reached that stage, and desynced from the board column in general). The card's own sticker
  // is now the only source for the real current stage; verify-tick and invoice-upload no longer
  // locally advance/revert this label (see handleToggleVerified / handleUploadInvoiceIssuance).
  const effectiveNextDaStatusLabel = formValues?.sticker_name || card?.sticker_name;

  // Stage-category flags, all derived from the real current stage name above so the button's
  // content self-heals to match the DA Status Timeline whenever the real data changes —
  // forward (verify, send email, record a decision) or backward (a rejection reverts it) — the
  // full sequence is real api/da/status_timeline rows (Ops completed → To be sent for SO
  // approval/SRF → Awaiting SO approval → Invoice Issuance → Invoice dispatched → Awaiting
  // payment → Closed paid), so reading the sticker directly replaces the old local-only
  // sub-flow simulation state that used to track these one click at a time.
  // "Awaiting" / "Closed" are structural/status words, not the varying approval-type noun (SO
  // approval / SRF / etc), so matching them is safe. "Invoice dispatched"
  // is also a decision checkpoint (client acknowledging the dispatched invoice) even though its
  // name doesn't literally say "awaiting" — Approve moves it on to Awaiting payment, Reject
  // reverts to Invoice Issuance so a corrected invoice can be re-sent.
  // On column 4 ("SO Sent for approval") this is no longer consulted for the decision UI —
  // that's now driven directly by api/da/action_state's button_state (see soActionState above),
  // which is authoritative and immune to the granular-status/board-column desync this flag used
  // to have to guard against. Still used as-is for every other awaiting-decision stage (Invoice
  // dispatched / Awaiting payment).
  const isAwaitingDecisionStage = /awaiting|invoice dispatched/i.test(effectiveNextDaStatusLabel || "");
  const isRealInvoiceIssuanceStage = /invoice issuance/i.test(effectiveNextDaStatusLabel || "");
  const isTerminalClosedStage = /closed/i.test(effectiveNextDaStatusLabel || "");
  // Every stage in the real sequence is now explicitly identified above (awaiting-decision /
  // invoice-issuance / closed) EXCEPT the one that still needs an email sent before it can
  // advance (e.g. "To be sent for SO approval" / "To be sent for SRF" — wording that varies per
  // call, per the useMemo comment above). handleAdvanceDaStatusFromHeader and daActionButtonLabel
  // below both treat that remaining case as the default ("needs email") rather than matching a
  // fixed prefix like /^to be sent for/i — that name-match used to be the bug: any call whose
  // wording didn't match fell through to a plain-advance branch that skipped the email step
  // entirely, silently jumping straight to "Awaiting SO approval" on a single click. Defaulting
  // to "needs email" for anything unrecognized instead means an unmatched wording can only ever
  // show the modal one extra time, never skip it.

  // The button shows the real current stage's own name (effectiveNextDaStatusLabel) — its
  // wording varies per call (seen as "SO approval", "To be sent for SRF", etc.), so a fixed
  // string would be wrong/misleading on calls using different wording. For the "needs email"
  // stage specifically, the real label already reads as "To be sent for X" — prefixing it with
  // another "Send for" produced the grammatically doubled "Send for To be sent for SO approval",
  // so strip that leading phrase for display only (detection above still reads the raw label).
  const displayStageLabel = (effectiveNextDaStatusLabel || "").replace(/^to be sent for\s+/i, "") || effectiveNextDaStatusLabel;
  const daActionButtonLabel = isTerminalClosedStage
    ? "Closed Paid"
    : isRealInvoiceIssuanceStage
    ? "Send for Invoice Dispatch"
    : displayStageLabel
    ? `Send for ${displayStageLabel}`
    : displayStageLabel;

  // "Send for SO approval" specifically should only show once the card's board column
  // (the footer stepper — currentStep/stepLabels, same source get_full_board feeds it)
  // has actually reached the "SO Sent for approval" column, not just once the DA's own
  // (coarser-independent, sub-stage-level) status timeline says the next email to send is
  // the SO approval one. Deliberately scoped to only this one wording — NOT a general
  // footer/DA-status name-match, which is exactly the bug class the comment above this
  // already fixed once: different calls phrase other sub-stages differently, so matching
  // those against column names would silently hide the button forever on calls whose
  // wording doesn't line up.
  const isSoApprovalActionButton =
    !isTerminalClosedStage && !isRealInvoiceIssuanceStage && !isAwaitingDecisionStage && /so approval/i.test(displayStageLabel || "");
  const shouldShowDaActionButton = !isSoApprovalActionButton || isCardAtSoApprovalColumn;

  // Looks up a board column's own title by pattern rather than a hardcoded literal string —
  // getColumnIdFromStepLabel (CardForm.jsx) needs an exact (trim+lowercase) match against the
  // column's real title, and hardcoding "AR invoice issued/ Submitted to FDA" here risks a
  // silent no-op advance if the real title's punctuation/spacing differs even slightly.
  const findBoardColumnLabel = (pattern) =>
    (Array.isArray(stepLabels) ? stepLabels.find((label) => pattern.test(label || "")) : null) ?? null;

  // "SO/PO Approval Received" (column 5) is the client-decision column for the SO approval
  // sent at column 4 — approving moves on to column 6, rejecting reverts to column 4 (see
  // handleApproveDaClientDecision / handleRejectDaClientDecision below). Being physically on
  // this column always means "awaiting that decision" (there's no other sub-state parked
  // here — a decision always moves the card off it), so this is footer/column-driven rather
  // than text-matched against the granular DA status wording, same reasoning as
  // isCardAtSoApprovalColumn above.
  // Position-driven (same pattern as isAtColumnAfterOpsCompleted): whichever column comes
  // immediately after "SO Sent for approval" in THIS card's own workflow, regardless of its
  // name. Only the Supervisor/Operator workflow literally names it "SO/PO Approval Received" —
  // on the other workflows Approve moved the card one column on to a differently-named column,
  // so the "Approved" label flashed on column 4 and then vanished the moment the column changed
  // (reported 2026-09-16). The old name match is kept as a fallback for any workflow where
  // that column isn't directly after "SO Sent for approval".
  const soSentForApprovalStepIndex = Array.isArray(stepLabels)
    ? stepLabels.findIndex((label) => /so sent for approval/i.test(label || ""))
    : -1;
  const isAtSoApprovalDecisionColumn =
    (soSentForApprovalStepIndex !== -1 && currentStep != null && currentStep === soSentForApprovalStepIndex + 2) ||
    (Array.isArray(stepLabels) && currentStep != null && /so\s*\/?\s*po approval received/i.test(stepLabels[currentStep - 1] || ""));

  // State for the SO Approval email modal, opened from the header action button when
  // effectiveNextDaStatusLabel is the "SO Approval" stage. Sends via api/da/da_send_action_email
  // (see handleCreateSoApprovalEmail) — the DA status itself still only advances via
  // onAdvanceDaStage's normal click path, same as every other status; this just triggers the
  // real email send and refetches the timeline so any server-side change shows up.
  const [showSoApprovalEmailModal, setShowSoApprovalEmailModal] = useState(false);
  const [isSendingSoApprovalEmail, setIsSendingSoApprovalEmail] = useState(false);

  // The label the modal's Subject should echo. Deliberately captured explicitly per open call
  // (see handleOpenSoApprovalEmailModal below) instead of always reading daActionButtonLabel at
  // render time — daActionButtonLabel is driven by the granular DA status-timeline
  // (effectiveNextDaStatusLabel), which can disagree with the board-column-driven
  // isCardAtSoApprovalColumn/soActionState path (the same desync class already hit on column 4
  // before). When "Send For SO approval" is the button actually clicked, the Subject must say
  // that column's real name, not whatever the (possibly stale/desynced) granular status says.
  const [modalActionLabel, setModalActionLabel] = useState("");

  // Prefills the modal's "To" field — api/da/da_action_email_draft/{call_id} →
  // { status: "success", data: { recipient } }. Fetched right before opening the modal (see
  // handleOpenSoApprovalEmailModal) rather than on mount, since it's only relevant once staff
  // is actually about to send this stage's email.
  const [draftRecipientEmail, setDraftRecipientEmail] = useState("");

  // Prefills the modal's "Cc" field from the same draft response (data.cc) — the backend owns
  // the cc list for this stage just like the recipient; empty string when it sends none.
  const [draftCcEmail, setDraftCcEmail] = useState("");

  // Pre-loaded documents from verified SO line items' Supporting Documents field — collected
  // when opening the modal and passed to SoApprovalEmailModal to auto-attach them.
  const [preLoadedDocuments, setPreLoadedDocuments] = useState([]);

  // Invoice Issuance modal — opened once staff records the client's approval. Reuses the
  // existing UploadInvoiceModal (components/UploadInvoiceModal.jsx), same component the
  // Vendor/Transport/Hotel portals already use for invoice upload. The upload itself persists
  // via da/da_upload_invoice (see handleUploadInvoiceIssuance) — the client-decision states
  // that follow it are still local-only simulation, same as the rest of this stage.
  const [showInvoiceIssuanceModal, setShowInvoiceIssuanceModal] = useState(false);

  // SO approval email upload modal — opened from the "Upload Approval Email" button shown next
  // to the "Approved" label once the client's SO approval has been recorded (column 4 with
  // api/da/action_state reporting "approved", or the card sitting on column 5). Same
  // UploadInvoiceModal drag-and-drop component as Invoice Issuance above, with its own wording.
  const [showApprovalEmailUploadModal, setShowApprovalEmailUploadModal] = useState(false);

  // Whether the client's SO approval email has been uploaded for this card (see
  // handleUploadApprovalEmail) — the "Approved" label only shows once it has been. Local-only
  // and per-session, same as soActionState: da/da_upload_approval_email's response carries no
  // readable flag to hydrate this from, so it's reset together with soActionState below.
  const [isApprovalEmailUploaded, setIsApprovalEmailUploaded] = useState(false);

  // "Approved by" header field shown in place of the old static "Approved" label once the
  // approval email has been uploaded (per request 2026-09-23): the typed name is committed with
  // the tick button and wiped with the clear button. Local-only and per-session, same as
  // isApprovalEmailUploaded above — no backend field exists for it yet.
  const [approvedByInput, setApprovedByInput] = useState("");
  const [approvedByName, setApprovedByName] = useState("");
  const [isRecordingApprovedBy, setIsRecordingApprovedBy] = useState(false);

  // api/da/da_action_email_draft/{call_id} — { status: "success", data: { recipient,
  // stage_document_id? } }. Best effort: if it fails or callId is missing, the modal just opens
  // with an empty "To" instead of blocking staff from sending the email at all. Also collects
  // documents from verified SO line items (Supporting Documents field) and pre-loads them as
  // email attachments.
  //
  // stage_document_id (when present) is a document the backend already generated/holds for
  // this stage — confirmed via a live response carrying it (2026-09-15) even though it isn't
  // one of the SO line items' own Supporting Documents. It used to be fetched and silently
  // dropped, so staff saw "Attachments (0)" even though the backend had a real document for
  // this stage; it's now surfaced as its own pre-loaded attachment entry and threaded through
  // to handleCreateSoApprovalEmail below so it's actually sent, not just shown.
  // document_url (added to the response 2026-09-15) is that same document's file URL — passed
  // through as this entry's `url` so SoApprovalEmailModal's handleOpenAttachment can actually
  // open/preview it instead of the name-only placeholder from before.
  const handleOpenSoApprovalEmailModal = async (actionLabel) => {
    setModalActionLabel(actionLabel || daActionButtonLabel);

    // Collect documents from verified SO line items
    const docs = [];
    const verifiedIds = localVerifiedItemIds || new Set();
    (salesOrderList || []).forEach((item) => {
      if (verifiedIds.has(item.id) && item.documents && Array.isArray(item.documents)) {
        docs.push(...item.documents);
      }
    });

    if (!callId) {
      setPreLoadedDocuments(docs);
      setShowSoApprovalEmailModal(true);
      return;
    }
    try {
      const { data } = await daService.getActionEmailDraft(callId);
      setDraftRecipientEmail(data?.data?.recipient || "");
      setDraftCcEmail(data?.data?.cc || "");
      const stageDocumentId = data?.data?.stage_document_id ?? null;
      const stageDocumentUrl = data?.data?.document_url || null;
      if (stageDocumentId != null) {
        docs.push({
          stage_document_id: stageDocumentId,
          name: stageDocumentUrl ? stageDocumentUrl.split("/").pop() : `Attached document #${stageDocumentId}`,
          url: stageDocumentUrl,
        });
      }
    } catch {
      setDraftRecipientEmail("");
      setDraftCcEmail("");
    } finally {
      setPreLoadedDocuments(docs);
      setShowSoApprovalEmailModal(true);
    }
  };

  const handleAdvanceDaStatusFromHeader = () => {
    if (!effectiveNextDaStatusLabel || isTerminalClosedStage || isAwaitingDecisionStage) return;
    if (isRealInvoiceIssuanceStage) {
      setShowInvoiceIssuanceModal(true);
      return;
    }
    // isSoApprovalDaStatus is the safe default for every other stage (see its declaration
    // above) — always requires the email confirmation before advancing, never a silent direct
    // advance, since there's no longer any real stage left in the sequence that should skip it.
    handleOpenSoApprovalEmailModal();
  };

  // api/da/da_send_action_email — multipart/form-data: { call_id, to, subject, body,
  // stage_document_id?, attachments[]? } → { status: true, sticker_id, status_id, status_name }
  // on success, or { status: "error" | false, message } (call_id/to/subject/body missing,
  // stage_document_id not found, or no next status left in this call's sequence) on failure.
  // Backend rejects a JSON body outright ("call_id, to, subject and body are required" even
  // when every field is present) — it only reads multipart form fields, same as
  // da_upload_invoice. Field name "attachments[]" confirmed against the real API contract
  // 2026-09-10.
  //
  // emailData.attachments (files picked in SoApprovalEmailModal's "+ Add") used to be silently
  // dropped here — collected in the modal's local state but never appended to this FormData, so
  // nothing was ever actually sent to the backend.
  //
  // emailData.attachments can also contain the pre-loaded stage document entry (see
  // handleOpenSoApprovalEmailModal — a plain { stage_document_id, name } object, not a browser
  // File) — that one has no bytes to upload, so it goes through the endpoint's own
  // stage_document_id field instead of attachments[]; only real Files are appended there. Staff
  // can still remove it via the modal's "×" before sending, which simply leaves it out here.
  //
  // emailData.attachments can also contain documents picked via "From Document Library" (see
  // SoApprovalEmailModal's DocumentLibraryPickerModal) — plain { id, name, url } objects, not
  // Files, and with no stage_document_id either (they're not the special stage document). The
  // backend has no known "attach by URL/id" field, so these are fetched into real Files here and
  // sent through the same attachments[] the endpoint already accepts. If a fetch fails (e.g. the
  // document host doesn't allow cross-origin reads), that one document is skipped and reported —
  // send still proceeds with everything else rather than blocking the whole email.
  const handleCreateSoApprovalEmail = async (emailData) => {
    if (!callId) {
      useAlertReducer.getState().error("No call identifier available for this card.");
      return;
    }
    setIsSendingSoApprovalEmail(true);
    try {
      const rawAttachments = emailData?.attachments || [];
      const stageDocumentEntry = rawAttachments.find((file) => !(file instanceof File) && file?.stage_document_id != null);
      const libraryEntries = rawAttachments.filter(
        (file) => !(file instanceof File) && file?.stage_document_id == null && file?.url
      );
      const fetchedLibraryFiles = [];
      for (const doc of libraryEntries) {
        try {
          const res = await fetch(doc.url);
          const blob = await res.blob();
          fetchedLibraryFiles.push(new File([blob], doc.name, { type: blob.type }));
        } catch {
          useAlertReducer.getState().error(`Couldn't attach "${doc.name}" from the Document Library — sending without it.`);
        }
      }

      const formData = new FormData();
      formData.append("call_id", callId);
      formData.append("to", emailData?.to ?? "");
      formData.append("cc", emailData?.cc ?? "");
      formData.append("subject", emailData?.subject ?? "");
      formData.append("body", emailData?.message ?? "");
      if (stageDocumentEntry) formData.append("stage_document_id", stageDocumentEntry.stage_document_id);
      [...rawAttachments.filter((file) => file instanceof File), ...fetchedLibraryFiles]
        .forEach((file) => formData.append("attachments[]", file));
      const { data } = await daService.sendActionEmail(formData);
      if (!data || data.status === "error" || data.status === false) {
        useAlertReducer.getState().error(data?.message || `Failed to send ${effectiveNextDaStatusLabel || "approval"} email.`);
        return;
      }
      setShowSoApprovalEmailModal(false);
      // Optimistic — the action_state refetch triggered by onDaStatusRefresh below confirms it;
      // this just avoids a flash back to "Send For SO approval" while that refetch is in flight.
      setSoActionState((prev) => ({ ...prev, button_state: "awaiting_approval" }));
      setDidApproveSoInSession(false);
      // Deliberately NOT moving the board column here (no onAdvanceDaStage call) — sending the
      // SO approval email keeps the card on "SO Sent for approval" (column 4) itself; the
      // Awaiting-decision UI shows right there too (see isCardAtSoApprovalColumn + soActionState
      // in the render below). Approving is what moves the column on to "AR invoice issued" (see
      // handleApproveDaClientDecision). Column 5 ("SO/PO Approval Received") is no longer used by
      // this flow at all — its own header action was removed per request, so a card must never
      // be parked there with nothing to do.
      if (refreshSalesOrder) refreshSalesOrder();
      onDaStatusRefresh?.();
      useAlertReducer.getState().success(`${data.status_name || effectiveNextDaStatusLabel || "Approval"} email sent.`);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        `Failed to send ${effectiveNextDaStatusLabel || "approval"} email.`;
      useAlertReducer.getState().error(msg);
    } finally {
      setIsSendingSoApprovalEmail(false);
    }
  };

  // api/da/da_record_client_decision — { call_id, decision: 1|0 } → { status: true, sticker_id,
  // status_id, status_name } on success, or { status: "error" | false, message } (call_id/decision
  // missing, or no previous/next status left in this call's sequence) on failure. Shared by all
  // three Accept/Reject decision points below (SO approval, invoice, payment) since the endpoint
  // is generic per call_id — the backend tracks sequence position itself.
  const [isRecordingDaClientDecision, setIsRecordingDaClientDecision] = useState(false);

  const recordDaClientDecision = async (decision) => {
    if (!callId) {
      useAlertReducer.getState().error("No call identifier available for this card.");
      return null;
    }
    setIsRecordingDaClientDecision(true);
    try {
      const { data } = await daService.recordClientDecision({ call_id: callId, decision });
      if (!data || data.status === "error" || data.status === false) {
        useAlertReducer.getState().error(data?.message || "Failed to record the client's decision.");
        return null;
      }
      if (refreshSalesOrder) refreshSalesOrder();
      // Bumps daStatusRefreshToken, which both DA.jsx's Summary-tab Status Timeline
      // (api/da/status_timeline) and the soActionState effect above react to by refetching —
      // no explicit fetchSoActionState() here, that fired the same GET twice per click.
      onDaStatusRefresh?.();
      return data;
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to record the client's decision.";
      useAlertReducer.getState().error(msg);
      return null;
    } finally {
      setIsRecordingDaClientDecision(false);
    }
  };

  // Generic Approve/Reject for whichever "Awaiting X" stage is currently active (SO approval,
  // payment, etc. — see isAwaitingDecisionStage) — recordDaClientDecision already advances or
  // reverts the backend's real sequence position by one, so no per-substage handler is needed.
  // The SO-approval decision point is the one exception: recordDaClientDecision only moves the
  // granular DA sub-status, not the board column, so approving it also explicitly moves the
  // column on to "AR invoice issued" (column 6). The decision UI shows on "SO Sent for
  // approval" itself (column 4, isCardAtSoApprovalColumn — sending the email no longer moves
  // the column, see handleCreateSoApprovalEmail) — isAtSoApprovalDecisionColumn (column 5) is
  // kept only in case a card ever lands there some other way.
  const handleApproveDaClientDecision = async () => {
    // isAtSoApprovalDecisionColumn covers the legacy column-5 spot; the normal case is column 4
    // with api/da/action_state already reporting "awaiting_approval" — authoritative, so no
    // desync guesswork needed here anymore.
    const wasSoApprovalDecision =
      isAtSoApprovalDecisionColumn || (isCardAtSoApprovalColumn && soActionState?.button_state === "awaiting_approval");
    const data = await recordDaClientDecision(1);
    if (data && wasSoApprovalDecision) {
      // Optimistic — fetchSoActionState() inside recordDaClientDecision above will confirm/
      // correct this shortly; this just avoids a flash back to Approve/Reject while that
      // refetch is still in flight and the column hasn't moved on yet.
      setSoActionState((prev) => ({ ...prev, button_state: "approved" }));
      setDidApproveSoInSession(true);
      useAlertReducer.getState().success("Approved successfully.");
      // Per request 2026-09-11: move exactly ONE column forward (whatever immediately follows
      // the card's current column), not straight to a hardcoded "AR invoice issued" match —
      // that used to skip over "SO/PO Approval Received" entirely, jumping the card 2 steps
      // ahead in one Approve click.
      const nextColumnLabel = Array.isArray(stepLabels) && currentStep != null ? stepLabels[currentStep] : null;
      if (nextColumnLabel) {
        // skipStatusUpdate: recordDaClientDecision above (api/da/da_record_client_decision)
        // already advanced the granular DA status server-side — re-sending that same status_id
        // through api/da/update_status here was a no-op the backend rejected, which used to
        // stop onAdvanceDaStage before it ever reached the actual column move.
        onAdvanceDaStage?.({ statusId: data.status_id, label: nextColumnLabel, skipStatusUpdate: true });
      }
    }
  };

  // Rejecting from "Invoice dispatched" reverts the real stage back to "Invoice Issuance" (one
  // step back in the backend's sequence) so a corrected invoice can be re-sent — reopen the
  // upload modal immediately instead of making staff click the header button again themselves.
  // Scoped to isAtArInvoiceColumn (column 6) on purpose — effectiveNextDaStatusLabel alone
  // isn't safe here, since it can still read a leftover "Invoice dispatched" from a desynced
  // sticker while actually rejecting the SO-approval decision on column 4, which used to
  // wrongly reopen the invoice upload modal instead of going back to "Send For SO approval".
  // Rejecting the SO-approval decision only needs a column move when it was shown on the legacy
  // column-5 spot — from column 4 the card never left that column, so there's nothing to
  // revert; the granular status alone reverting (to "To be sent for SO approval") is what
  // switches the UI back to the plain "Send For SO approval" button.
  const handleRejectDaClientDecision = async () => {
    const wasInvoiceDispatchedStage = isAtArInvoiceColumn && /invoice dispatched/i.test(effectiveNextDaStatusLabel || "");
    const wasSoApprovalDecisionColumn = isAtSoApprovalDecisionColumn;
    // Column 4 only ever represents the SO-approval sub-flow by design (see
    // isCardAtSoApprovalColumn's own comment) — api/da/action_state's button_state is
    // authoritative here, no more guessing from the granular status-timeline (see
    // open_issue_da_record_client_decision_noop_for_desynced_call for why that used to be
    // unreliable).
    const wasSoApprovalPendingAtColumn4 = isCardAtSoApprovalColumn && soActionState?.button_state === "awaiting_approval";
    const data = await recordDaClientDecision(0);
    if (data && wasSoApprovalPendingAtColumn4) {
      // Optimistic — fetchSoActionState() inside recordDaClientDecision above will confirm/
      // correct this shortly.
      setSoActionState((prev) => ({ ...prev, button_state: "send" }));
      setDidApproveSoInSession(false);
    }
    if (data && wasInvoiceDispatchedStage) setShowInvoiceIssuanceModal(true);
    if (data && wasSoApprovalDecisionColumn) {
      const soSentForApprovalLabel = findBoardColumnLabel(/so sent for approval/i);
      if (soSentForApprovalLabel) {
        // See the matching comment in handleApproveDaClientDecision above — decision is already
        // recorded server-side by recordDaClientDecision, so skip the redundant update_status call.
        onAdvanceDaStage?.({ statusId: data.status_id, label: soSentForApprovalLabel, skipStatusUpdate: true });
      }
    }
  };

  const handleCloseInvoiceIssuanceModal = () => {
    setShowInvoiceIssuanceModal(false);
  };

  const handleCloseApprovalEmailUploadModal = () => {
    setShowApprovalEmailUploadModal(false);
  };

  // Persists via da/da_upload_so_approval_proof (call_id + proof file(s), multipart/form-data)
  // -> { status: "success", stage_document_id } on success, or { status: "error", message } when
  // the call has no sales order. Like da_upload_invoice the response carries no
  // status_id/sticker_id, so the upload does not advance the DA's real stage — it only flips
  // isApprovalEmailUploaded so the header swaps the upload button for the "Approved" label
  // (see renderApprovedWithEmailUpload).
  // Submitting with no file is allowed on purpose (UploadInvoiceModal's allowEmptyUpload) so the
  // backend's own "No sales order found for this call" message is what the modal shows.
  const handleUploadApprovalEmail = async (files) => {
    if (!callId) {
      useAlertReducer.getState().error("No call identifier available for this card.");
      return;
    }
    const formData = new FormData();
    formData.append("call_id", callId);
    (files || []).forEach((file) => formData.append("proof", file));

    const { data } = await daService.uploadSoApprovalProof(formData);
    if (data?.status !== "success") {
      throw new Error(data?.message || "Failed to upload the approval proof.");
    }

    setIsApprovalEmailUploaded(true);
    useAlertReducer.getState().success("Approval proof uploaded.");
    if (refreshSalesOrder) refreshSalesOrder();
    onDaStatusRefresh?.();
  };

  // Persists via da/da_upload_invoice (call_id + invoice file(s), multipart/form-data) →
  // { status: "success", stage_document_id } — unlike da_send_action_email /
  // da_record_client_decision, this response carries no status_id/sticker_id, so the upload
  // itself does NOT advance the DA's real stage (confirmed against the endpoint's own
  // contract). api/da/status_timeline (previously used to look up the next real step's
  // statusId/label so this could advance it locally) is no longer fetched (removed per
  // request 2026-09-11) — the real stage now only advances however the card's own sticker
  // gets updated server-side; this no longer nudges it locally.
  const handleUploadInvoiceIssuance = async (files) => {
    if (!callId) {
      useAlertReducer.getState().error("No call identifier available for this card.");
      return;
    }
    const formData = new FormData();
    formData.append("call_id", callId);
    (files || []).forEach((file) => formData.append("invoice", file));

    const { data } = await daService.uploadInvoice(formData);
    if (data?.status !== "success") {
      throw new Error(data?.message || "Failed to upload the invoice.");
    }
    if (refreshSalesOrder) refreshSalesOrder();
    onDaStatusRefresh?.();
  };

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

  const formatCurrencySAR = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: toApiCurrency(soBpCurrency) || "SAR",
      minimumFractionDigits: 2,
    }).format(amount);
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
      vendor_id: order.supplierCode || "",
    };
    try {
      await updateSalesOrderItemAmount(payload);
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

  // SAR has no separate rate field (implicitly 1); USD is fixed; EURO is user-entered.
  const getConversionRate = (currency) => {
    if (currency === "USD") return USD_TO_SAR_RATE;
    if (currency === "EURO") return parseFloat(soEuroRate) || 0;
    return 1;
  };

  // UI/internal value is "EURO"; the API expects the ISO code "EUR".
  const toApiCurrency = (currency) => (currency === "EURO" ? "EUR" : currency);

  // Keeps the discount % input within 0–100 while typing.
  const clampDiscountPercentage = (value) => {
    if (value === "" || value == null) return "";
    const num = parseFloat(value);
    if (!Number.isFinite(num)) return "";
    return String(Math.min(100, Math.max(0, num)));
  };

  // Persists SO header field edits to sales_order/update_sales_order. Fired on blur or Enter
  // (no submit button) — sends only the sales_order_id plus the single field that changed.
  // Known columns (delivery_date, document_date, discount_percentage, total_discount) go
  // top-level; everything else goes under `fields`.
  const handleUpdateSalesOrder = async (payloadFields) => {
    if (!formValues.salesOrderId) return;
    try {
      await updateSalesOrderReducer({ sales_order_id: formValues.salesOrderId, ...payloadFields });
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

  // Verifying a line item is the trigger that moves the whole DA/SO record into the
  // approval flow — ticking the checkbox calls da/da_verify_sales_line_item, which FLIPS the
  // item's status server-side (Completed <-> Verified) and returns the resulting item_status.
  // One click therefore sends exactly ONE request and nothing else: tick →
  // { status: "success", so_item_id, item_status: "Verified" }, untick → the same with
  // "Completed". No retry and no corrective second call — the checkbox is kept in step with
  // the backend by apiItemStatusFlags (each item's own item_status, synced both ways), so the
  // flip this one call performs is already the intended one. If a row is somehow still out of
  // step, the checkbox follows the returned item_status and a message asks for another click
  // rather than firing that second call silently.
  // On success this also advances the real DA status to its next stage (e.g. Ops completed →
  // Sent for SO Approval), same api/da/update_status call the header action button makes, so
  // the header button's label updates to reflect it. Un-ticking it again reverts one stage
  // back the same way (sends the last-done step's own label — same mechanism DA.jsx's own
  // Status Timeline uses for its "done" step revert). No modal/email popup here either way —
  // that's still only triggered by the header button's own click (see isSoApprovalDaStatus).
  //
  // order.status is written straight from the call's item_status here but is NOT what the
  // checkbox reads (see isItemVerified). Never fall back to the row's previous `status` when
  // item_status comes back blank — an earlier version did, which fed a locally-written
  // "Verified" back in as if it were the item's real underlying status.
  const handleToggleVerified = async (order) => {
    const orderId = order.id;
    // Synchronous guard (see verifyingItemIdsRef's declaration) — must be the very first thing
    // checked/set, before any await, so a second call landing in the same tick as the first is
    // rejected immediately rather than racing past a not-yet-rendered `disabled` checkbox.
    if (verifyingItemIdsRef.current.has(orderId)) return;
    verifyingItemIdsRef.current.add(orderId);

    // Per request 2026-09-10: each line item's tick is its own explicit client action, not a
    // reflection of the DA record's overall advancement — localVerifiedItemIds (session-only,
    // per order id) backs the checkbox's own `checked` prop below and is written from the
    // call's response.
    // Read the current tick straight from the store rather than the value this render closed
    // over: clicking again before React has re-rendered with the previous click's result would
    // otherwise compute the intent from a stale tick, aim at the status the item is already on,
    // and flip it the wrong way (which is what surfaced the "click again" message when ticking
    // and un-ticking quickly).
    const isNowVerified = !useDaLocalVerifiedItems.getState().isItemVerified(callId, orderId);
    // A tick must end on "Verified", an untick on "Completed" — the flip is symmetric.
    const targetStatus = isNowVerified ? VERIFIED_ITEM_STATUS : COMPLETED_ITEM_STATUS;
    setVerifyingItemIds((prev) => new Set(prev).add(orderId));
    try {
      // Exactly ONE request per click — no retry, no corrective second call. The checkbox and
      // the backend are kept in step by the apiVerifiedItemIds seeding above, so the flip this
      // call performs is already the one the click intends.
      const response = await daService.verifySalesLineItem({ so_item_id: orderId });
      const body = response?.data;
      if (body?.status !== "success") {
        throw new Error(body?.message || "Failed to update the item's verification status.");
      }
      // Written unconditionally (never falling back to the row's previous `status`) so a blank
      // item_status can't leave a stale "Verified" behind on an untick.
      const nextStatus = normalizeItemStatus(body?.item_status);
      const updatedList = salesOrderListRef.current.map((item) =>
        item.id === orderId ? { ...item, status: body?.item_status || "" } : item
      );
      // Recorded before the parent re-renders so a toggle on another row that lands in the
      // meantime merges into this result instead of overwriting it.
      salesOrderListRef.current = updatedList;
      handleChange("salesOrderList")({ target: { value: updatedList } });
      // A blank item_status says nothing about where the item landed — fall back to what the
      // click intended rather than silently dropping the tick.
      setLocalItemVerified(
        callId,
        orderId,
        nextStatus ? nextStatus === VERIFIED_ITEM_STATUS : isNowVerified
      );
      if (nextStatus && nextStatus !== targetStatus) {
        // The row and the backend were out of step, so this single flip landed on the opposite
        // status. The checkbox follows the backend rather than the click; say why instead of
        // leaving it looking like the click did nothing, and let the next click do the flip.
        useAlertReducer
          .getState()
          .error(
            `Item No. ${order.itemNo || orderId} was "${body?.item_status}" on the server — click again to set it to "${targetStatus}".`
          );
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to update the item's verification status.";
      useAlertReducer.getState().error(msg);
    } finally {
      verifyingItemIdsRef.current.delete(orderId);
      setVerifyingItemIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  // Delete a line item — persisted via da/da_delete_sales_line_item (so_item_id), which
  // soft-deletes the item on the backend (item_status: "Cancelled"). Removed from the local
  // list on success the same way other row edits in this file update salesOrderList.
  const handleDeleteItem = (order) => {
    setDeletingItem(order);
    setShowDeleteItemModal(true);
  };

  const handleConfirmDeleteItem = async () => {
    if (!deletingItem || isDeletingItem) return;
    setIsDeletingItem(true);
    try {
      const response = await daService.deleteSalesLineItem({ so_item_id: deletingItem.id });
      const body = response?.data;
      if (body?.status !== "success") {
        throw new Error(body?.message || "Failed to delete the item.");
      }

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
      setVerifyingItemIds((prev) => {
        const next = new Set(prev);
        next.delete(deletingItem.id);
        return next;
      });
      setLocalItemVerified(callId, deletingItem.id, false);
      setShowDeleteItemModal(false);
      setDeletingItem(null);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to delete the item.";
      useAlertReducer.getState().error(msg);
    } finally {
      setIsDeletingItem(false);
    }
  };

  const handleCancelDeleteItem = () => {
    if (isDeletingItem) return;
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

  // Uploads file(s) to sales_order/add_so_item_document for an existing line item, then
  // refreshes so the item's server-side `documents` list stays in sync. Returns the newly
  // uploaded docs so the modal can reflect them immediately without waiting on the refresh.
  const handleUploadItemDocuments = async (soItemId, files) => {
    const formData = new FormData();
    formData.append("so_item_id", soItemId);
    files.forEach((file) => formData.append("documents[]", file));

    const response = await salesOrderService.addSoItemDocument(formData);
    const body = response?.data;
    if (body?.status !== "success") {
      throw new Error(body?.message || "Failed to upload document(s).");
    }
    if (refreshSalesOrder) await refreshSalesOrder();

    const returnedDocs = Array.isArray(body?.data) ? body.data : [];
    return files.map((file, idx) => {
      const ext = (file.name.split(".").pop() || "").toUpperCase();
      const returned = returnedDocs[idx];
      return {
        id: returned?.id ?? returned?.document_id ?? `uploaded-${Date.now()}-${idx}`,
        name: returned?.name ?? returned?.file_name ?? file.name,
        type: ext || "FILE",
      };
    });
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
      setItemNoError("Please select an Item Code");
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

  // Opens the Generate PO modal for a row that already has a PO No. — GeneratePOModal fetches
  // sales_order/get_po itself from selectedItems, so this just seeds it with the PO's item ids
  // and its known purchaseOrderId (which also disables re-submitting).
  const handleOpenExistingPO = (order) => {
    if (!order.poId) {
      useAlertReducer.getState().error("No purchase order identifier available for this item.");
      return;
    }
    const poItems = salesOrderList.filter((o) => o.poNo === order.poNo);
    const itemIds = poItems.length > 0 ? poItems.map((o) => o.id) : [order.id];
    setGeneratePOItemIds(itemIds);
    setGeneratePOError(null);
    setLastGeneratedPurchaseOrderId(order.poId);
    setShowGeneratePOPopup(true);
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

    // Total Payment Due is editable in the GRN preview — the amount the user dialed in
    // is sent through as-is (e.g. for a partial delivery).
    const amount = Number.isFinite(details?.amount) ? details.amount : 0;

    const payload = {
      purchase_order_id: purchaseOrderId,
      amount,
      document_date: soDocumentDate,
      due_date: soDeliveryDate,
      discount_percentage: discountPercentage,
      rounding: 0,
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

  const handleConfirmGeneratePO = async ({
    vendorId,
    vendorRefNo,
    deliveryDate,
    documentDate,
    remarks,
    discountPercentage = 0,
    rounding = 0,
  } = {}) => {
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

    const payload = {
      so_item_ids: validItemIds,
      vendor_id: vendorId || "",
      vendor_ref_no: vendorRefNo || "",
      contact_person: soContactPerson,
      branch,
      currency: soBpCurrency,
      delivery_date: deliveryDate || soDeliveryDate,
      document_date: documentDate || soDocumentDate,
      discount_percentage: discountPercentage,
      rounding,
      remarks: remarks || soRemarks,
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
            <div className="sales-order-percent-input-wrapper">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={order.discount ?? 0}
                onChange={(e) => handleFieldChange(order.id, "discount", e.target.value)}
                onBlur={() => handleUpdateItemAmount(order)}
                className="sales-order-qty-input"
                style={{ ...cellStyle, boxSizing: "border-box", paddingRight: "20px" }}
              />
              <span className="sales-order-percent-input-suffix">%</span>
            </div>
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
            order.poNo ? (
              <button type="button" className="so-wo-number-link" onClick={() => handleOpenExistingPO(order)}>
                {order.poNo}
              </button>
            ) : (
              "—"
            )
          ) : eligibleForPo ? (
            <input
              type="checkbox"
              checked={selectedPoItems.has(order.id)}
              onChange={(e) => handleItemCheckboxToggle(order.id, e.target.checked, setSelectedPoItems)}
              aria-label="Select for Generate PO"
              style={{ width: "18px", height: "18px", cursor: "pointer" }}
            />
          ) : order.poNo ? (
            <button type="button" className="so-wo-number-link" onClick={() => handleOpenExistingPO(order)}>
              {order.poNo}
            </button>
          ) : (
            "—"
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

      {/* Action — DA-only: Verify checkbox (persisted via da/da_verify_sales_line_item) +
          Delete (no backend endpoint yet, removes the item locally). Column itself only
          renders once the card's board column (footer stepper) actually reaches the column
          right after "Ops Completed" in this workflow — position-driven via
          isAtColumnAfterOpsCompleted, NOT isCardAtSoApprovalColumn, since different
          workflows/swimlanes name that column differently (see its declaration above). Not
          shown at all before that (no disabled placeholder cell).
          Per request 2026-09-10: the tick itself must NOT auto-show checked just because the
          column renders (isAtColumnAfterOpsCompleted — always true here, since that's the
          render gate itself, so it used to tick every row unconditionally). Each row's tick
          reflects only whether the client themselves clicked THAT line (localVerifiedItemIds,
          keyed per order id). */}
      {canViewActionColumn && isAtColumnAfterOpsCompleted && (
        <td>
          <div className="sales-order-table-cell sales-order-action-cell">
            <input
              type="checkbox"
              className="sales-order-verify-checkbox"
              checked={isItemVerified(order)}
              onChange={() => handleToggleVerified(order)}
              disabled={verifyingItemIds.has(order.id)}
              aria-label="Verify line item"
            />
            {!readOnly && (
              <button
                type="button"
                className="sales-order-delete-item-btn"
                onClick={() => handleDeleteItem(order)}
                title={`Delete Item No. ${order.itemNo || ""}`}
                aria-label={`Delete Item No. ${order.itemNo || ""}`}
              >
                <FiTrash2 />
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
    );
  };

  // "Approved" header state shared by column 4 (api/da/action_state "approved") and column 5
  // ("SO/PO Approval Received"). Per request 2026-09-17 this is a two-step state: first only
  // the "Upload Approval Email" button (opens the drag-and-drop upload modal, see
  // handleUploadApprovalEmail); once the upload succeeds it becomes the "Approved by" field,
  // where staff type in who approved the SO and commit it with the tick (per request
  // 2026-09-23, replacing the old static "Approved" label).
  const handleChangeApprovedBy = (event) => {
    setApprovedByInput(event.target.value);
    setApprovedByName("");
  };

  // Persists via da/da_record_approved_by (call_id + approved_by) -> { status: "success" }.
  // The backend rejects it with "No approval proof uploaded yet for this call" until the
  // approval proof exists for the same call, so the confirmed name is only shown on success.
  const handleConfirmApprovedBy = async () => {
    const name = approvedByInput.trim();
    if (!name) {
      useAlertReducer.getState().error("Please enter who approved this.");
      return;
    }
    if (!callId) {
      useAlertReducer.getState().error("No call identifier available for this card.");
      return;
    }
    setIsRecordingApprovedBy(true);
    try {
      const { data } = await daService.recordApprovedBy({ call_id: callId, approved_by: name });
      if (!data || data.status === "error" || data.status === false) {
        useAlertReducer.getState().error(data?.message || "Failed to record who approved this.");
        return;
      }
      setApprovedByInput(name);
      setApprovedByName(name);
      useAlertReducer.getState().success("Approved by recorded.");
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to record who approved this.";
      useAlertReducer.getState().error(msg);
    } finally {
      setIsRecordingApprovedBy(false);
    }
  };

  const handleClearApprovedBy = () => {
    setApprovedByInput("");
    setApprovedByName("");
  };

  const renderApprovedWithEmailUpload = () =>
    isApprovalEmailUploaded ? (
      <div className="sales-order-da-approved-by">
        {approvedByName ? (
          <span className="sales-order-da-approved-by-confirmed">
            <FiCheck />
            Approved by {approvedByName}
          </span>
        ) : (
          <>
            <label className="sales-order-da-approved-by-label" htmlFor="sales-order-da-approved-by">
              Approved by
            </label>
            <input
              id="sales-order-da-approved-by"
              type="text"
              className="sales-order-da-approved-by-input"
              placeholder="Enter name..."
              value={approvedByInput}
              onChange={handleChangeApprovedBy}
              disabled={isRecordingApprovedBy}
            />
            <button
              type="button"
              className="sales-order-da-approved-by-btn sales-order-da-approved-by-btn--confirm"
              title="Confirm the approver name"
              onClick={handleConfirmApprovedBy}
              disabled={isRecordingApprovedBy}
            >
              <FiCheck />
            </button>
            <button
              type="button"
              className="sales-order-da-approved-by-btn sales-order-da-approved-by-btn--clear"
              title="Clear the approver name"
              onClick={handleClearApprovedBy}
              disabled={isRecordingApprovedBy}
            >
              <FiX />
            </button>
          </>
        )}
      </div>
    ) : (
      <button
        type="button"
        className="sales-order-da-status-button"
        title="Upload the client's SO approval email"
        onClick={() => setShowApprovalEmailUploadModal(true)}
      >
        <FiUpload />
        Upload Approval Email
      </button>
    );

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
          {isDaVerifyContext &&
            // Hard floor: the DA header action button must never appear before the card has
            // physically reached column 4 ("SO Sent for approval") — steps 1-3 show nothing at
            // all, regardless of what the granular DA status-timeline fetch reports (that data
            // is independent of the board column and can otherwise race ahead). Per request.
            Number(currentStep) >= 4 &&
            // isCardAtSoApprovalColumn is footer/column-driven on purpose (see its own
            // declaration above) — column 4 must show its own fixed button state purely from
            // currentStep/stepLabels, never from the sticker-derived effectiveNextDaStatusLabel
            // — that data can race ahead of the real board column (e.g. an earlier
            // da/advance_stage failure), which used to leak a far-future label like "Send for
            // Invoice dispatched" onto column 4. Every other button state still requires that
            // sticker data as before. Column 6's "Invoice Issuance" sub-stage ("Send for Invoice
            // Dispatch" button, opening the upload modal) was removed per request —
            // isAwaitingDecisionStage further below (Invoice dispatched / Awaiting payment)
            // still shows normally once the real stage moves past Invoice Issuance some other
            // way. Column 5 ("SO/PO Approval Received") — per request 2026-09-11 now shows a
            // plain "Approved" label (Approve moves the card here from column 4, see
            // handleApproveDaClientDecision) instead of nothing at all.
            !isAtOpsCompletedColumn &&
            !(isAtArInvoiceColumn && isRealInvoiceIssuanceStage) &&
            (isCardAtSoApprovalColumn ||
              isAtSoApprovalDecisionColumn ||
              (effectiveNextDaStatusLabel && shouldShowDaActionButton)) && (
            // Column 4's button state is driven by api/da/action_state's button_state now, via
            // effectiveSoButtonState (see its declaration above, which is where a stale persisted
            // "approved" is discounted at this column) — replacing the old
            // justApproved/justRejected/isSoApprovalEmailPendingDecision local guesswork. Every
            // other column still uses the granular DA status-timeline (isAwaitingDecisionStage /
            // daActionButtonLabel) as before.
            isAtSoApprovalDecisionColumn ? (
              renderApprovedWithEmailUpload()
            ) : isCardAtSoApprovalColumn ? (
              effectiveSoButtonState === "approved" ? (
                renderApprovedWithEmailUpload()
              ) : effectiveSoButtonState === "awaiting_approval" ? (
                <div className="sales-order-da-status-group">
                  <span className="sales-order-da-status-button sales-order-da-status-button--label">
                    <FiClipboard />
                    Awaiting SO Approval
                  </span>
                  <button
                    type="button"
                    className="sales-order-da-decision-btn sales-order-da-decision-btn--approve"
                    title="Record the client's approval"
                    disabled={isRecordingDaClientDecision}
                    onClick={handleApproveDaClientDecision}
                  >
                    <FiCheck /> Approved
                  </button>
                  <button
                    type="button"
                    className="sales-order-da-decision-btn sales-order-da-decision-btn--reject"
                    title="Record the client's rejection and move this stage back"
                    disabled={isRecordingDaClientDecision}
                    onClick={handleRejectDaClientDecision}
                  >
                    <FiX /> Rejected
                  </button>
                </div>
              ) : effectiveSoButtonState === "send" && hasVerifiedAllItems ? (
                <button
                  type="button"
                  className="sales-order-da-status-button"
                  disabled={isAdvancingDaStage}
                  title='Open "SO approval" email'
                  onClick={() => handleOpenSoApprovalEmailModal(stepLabels?.[currentStep - 1])}
                >
                  <FiClipboard />
                  Send For SO approval
                </button>
              ) : null
            ) : isAwaitingDecisionStage ? (
              <div className="sales-order-da-status-group">
                <span className="sales-order-da-status-button sales-order-da-status-button--label">
                  <FiClipboard />
                  {effectiveNextDaStatusLabel}
                </span>
                <button
                  type="button"
                  className="sales-order-da-decision-btn sales-order-da-decision-btn--approve"
                  title="Record the client's approval"
                  disabled={isRecordingDaClientDecision}
                  onClick={handleApproveDaClientDecision}
                >
                  <FiCheck /> Approved
                </button>
                <button
                  type="button"
                  className="sales-order-da-decision-btn sales-order-da-decision-btn--reject"
                  title="Record the client's rejection and move this stage back"
                  disabled={isRecordingDaClientDecision}
                  onClick={handleRejectDaClientDecision}
                >
                  <FiX /> Rejected
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="sales-order-da-status-button"
                disabled={isAdvancingDaStage || isTerminalClosedStage}
                title={
                  isTerminalClosedStage
                    ? "Payment received — closed"
                    : isRealInvoiceIssuanceStage
                    ? "Open Invoice Issuance upload"
                    : `Open "${displayStageLabel}" email`
                }
                onClick={handleAdvanceDaStatusFromHeader}
              >
                <FiClipboard />
                {daActionButtonLabel}
              </button>
            )
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
                        <label>Item Code <span style={{ color: "#e53935" }}>*</span></label>
                        <PremiumSelect
                          value={newItemForm.itemNo}
                          onChange={(e) => handleItemCodeSelect(e.target.value)}
                          options={itemCodeSelectOptions}
                          placeholder={
                            !portId
                              ? "Select Port first..."
                              : isLoadingItemCodes
                              ? "Loading item codes..."
                              : "Select Item Code..."
                          }
                          searchPlaceholder="Search item code..."
                          disabled={!portId || isLoadingItemCodes || isLoadingItemDetails}
                          hasError={Boolean(itemNoError)}
                          className="so-add-form-select"
                          menuClassName="so-add-form-select-menu"
                        />
                        {itemNoError && (
                          <span className="sales-order-add-form-error">{itemNoError}</span>
                        )}
                      </div>
                      <div className="sales-order-add-form-field">
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
                        <PremiumSelect
                          value={newItemForm.taxCode}
                          onChange={(e) => handleFormChange("taxCode", e.target.value)}
                          options={TAX_CODE_SELECT_OPTIONS}
                          placeholder="Select tax code..."
                          className="so-add-form-select"
                          menuClassName="so-add-form-select-menu"
                        />
                      </div>
                      <div className="sales-order-add-form-field">
                        <label>Type of PO</label>
                        <PremiumSelect
                          value={newItemForm.typeOfPo}
                          onChange={(e) => handleFormChange("typeOfPo", e.target.value)}
                          options={TYPE_OF_PO_SELECT_OPTIONS}
                          placeholder="— Select —"
                          className="so-add-form-select"
                          menuClassName="so-add-form-select-menu"
                        />
                      </div>
                      <div className="sales-order-add-form-field">
                        <label>Supporting Documents</label>
                        <div className="sales-order-add-form-docs">
                          {renderSupportingDocsControl(newItemForm.documents, () => setDocumentModalTarget("new"))}
                        </div>
                      </div>
                      <div className="sales-order-add-form-field">
                        <label>Supplier Code</label>
                        <PremiumSelect
                          value={newItemForm.supplierCode}
                          onChange={(e) => {
                            const code = e.target.value;
                            const vendor = vendors.find((v) => v.code === code);
                            setNewItemForm((prev) => ({
                              ...prev,
                              supplierCode: code,
                              supplierName: vendor?.name || "",
                            }));
                          }}
                          options={vendorSelectOptions}
                          placeholder="— Select vendor —"
                          searchPlaceholder="Search by code or name..."
                          className="so-add-form-select"
                          menuClassName="so-add-form-select-menu"
                        />
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
                onBlur={() => handleUpdateSalesOrder({ fields: { srt_number: srtNumber } })}
                onKeyDown={handleEnterBlur}
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
              <input
                type="text"
                className="so-header-input so-header-input-readonly"
                value={soPort}
                readOnly
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
                onChange={(e) => {
                  const newCurrency = e.target.value;
                  handleChange("soBpCurrency")(e);
                  handleUpdateSalesOrder({
                    currency: toApiCurrency(newCurrency),
                    conversion_rate: getConversionRate(newCurrency),
                  });
                }}
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
                  onBlur={() =>
                    handleUpdateSalesOrder({
                      currency: toApiCurrency(soBpCurrency),
                      conversion_rate: parseFloat(soEuroRate) || 0,
                    })
                  }
                  onKeyDown={handleEnterBlur}
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
                  {renderTableHeader("Item Code", "col-item-no")}
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
                  {canViewActionColumn && isAtColumnAfterOpsCompleted && renderTableHeader("Action", "col-verify")}
                </tr>
              </thead>
              <tbody>
                {displayOrderList.length === 0 && !isLoadingSalesOrder && (
                  <tr>
                    <td
                      colSpan={13 + (canViewActionColumn && isAtColumnAfterOpsCompleted ? 1 : 0)}
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
                        <td colSpan={canViewActionColumn && isAtColumnAfterOpsCompleted ? 14 : 13} style={{ padding: "12px 16px" }}>
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
        const totalTax = amountFromForm(formValues.soTotalTax) ?? totalTaxCalc;
        const grandTotal = amountFromForm(formValues.soGrandTotal) ?? grandTotalCalc;
        const currencyLabel = soBpCurrency === "EURO" ? "EURO (€)" : soBpCurrency;

        const roundingEnabled = !!formValues.soRoundingEnabled;
        const roundingAdjustment = Math.round(grandTotal) - grandTotal;
        const finalGrandTotal = roundingEnabled ? grandTotal + roundingAdjustment : grandTotal;

        const headerDiscountPercentage = parseFloat(formValues.soDiscountPercentage) || 0;
        const headerDiscountAmount = subtotal * (headerDiscountPercentage / 100);

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
                  onBlur={() => handleUpdateSalesOrder({ remarks: soRemarks })}
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
                <span className="so-accounting-label">Total before discount</span>
                <span className="so-accounting-value">{formatCurrencySAR(subtotal)}</span>
              </div>
              {(!readOnly || (formValues.soDiscountPercentage != null && String(formValues.soDiscountPercentage).trim() !== "")) && (
                <div className="so-accounting-row">
                  <span className="so-accounting-label">Discount</span>
                  <div className="so-accounting-discount-value-wrap">
                    {readOnly ? (
                      <span className="so-accounting-value">
                        {String(formValues.soDiscountPercentage).replace(/%$/, "")}%
                      </span>
                    ) : (
                      <div className="so-accounting-discount-input-wrap">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={formValues.soDiscountPercentage ?? ""}
                          onChange={(e) => handleChange("soDiscountPercentage")(clampDiscountPercentage(e.target.value))}
                          onBlur={() => {
                            const pctNum = parseFloat(clampDiscountPercentage(formValues.soDiscountPercentage)) || 0;
                            handleUpdateSalesOrder({ discount_percentage: pctNum });
                          }}
                          onKeyDown={handleEnterBlur}
                          placeholder="0"
                          className="so-accounting-discount-input"
                        />
                        <span className="so-accounting-discount-percent-sign">%</span>
                      </div>
                    )}
                    {readOnly ? (
                      <span className="so-accounting-value so-accounting-discount-amount">
                        {formatCurrencySAR(headerDiscountAmount)}
                      </span>
                    ) : (
                      <div className="so-accounting-discount-input-wrap">
                        <span className="so-accounting-discount-currency-prefix">
                          {toApiCurrency(soBpCurrency) || "SAR"}
                        </span>
                        <input
                          type="number"
                          min="0"
                          max={subtotal || undefined}
                          step="0.01"
                          value={headerDiscountAmount ? Number(headerDiscountAmount.toFixed(2)) : ""}
                          onChange={(e) => {
                            const rawValue = e.target.value;
                            if (rawValue === "") {
                              handleChange("soDiscountPercentage")("");
                              return;
                            }
                            const amountNum = parseFloat(rawValue);
                            if (subtotal > 0 && Number.isFinite(amountNum)) {
                              handleChange("soDiscountPercentage")(clampDiscountPercentage((amountNum / subtotal) * 100));
                            }
                          }}
                          onBlur={() => {
                            const pctNum = parseFloat(clampDiscountPercentage(formValues.soDiscountPercentage)) || 0;
                            const amount = Number((subtotal * (pctNum / 100)).toFixed(2));
                            handleUpdateSalesOrder({ total_discount: amount });
                          }}
                          onKeyDown={handleEnterBlur}
                          placeholder="0.00"
                          className="so-accounting-discount-input"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="so-accounting-row">
                <label className="so-accounting-label so-accounting-checkbox-label">
                  <input
                    type="checkbox"
                    checked={roundingEnabled}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      handleChange("soRoundingEnabled")(checked);
                      handleUpdateSalesOrder({ rounding: checked ? 1 : 0 });
                    }}
                    disabled={readOnly}
                    className="so-accounting-checkbox"
                  />
                  Rounding
                </label>
                <span className="so-accounting-value">
                  {roundingEnabled
                    ? `${roundingAdjustment >= 0 ? "+ " : "− "}${formatCurrencySAR(Math.abs(roundingAdjustment))}`
                    : formatCurrencySAR(0)}
                </span>
              </div>
              <div className="so-accounting-row">
                <span className="so-accounting-label">Total Tax</span>
                <span className="so-accounting-value">{formatCurrencySAR(totalTax)}</span>
              </div>
              <div className="so-accounting-divider" />
              <div className="so-accounting-row so-accounting-grand">
                <span className="so-accounting-label">Grand Total</span>
                <span className="so-accounting-value so-accounting-grand-value">{formatCurrencySAR(finalGrandTotal)}</span>
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
          initialDiscountPercentage={formValues.soDiscountPercentage || 0}
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
        vendors={vendors}
      />

      {/* Document List Modal */}
      <DocumentListModal
        key={documentModalTarget ?? "closed"}
        show={documentModalTarget !== null}
        onClose={() => setDocumentModalTarget(null)}
        onSave={handleDocumentSave}
        initialSelected={getDocumentModalInitialSelected()}
        libraryDocs={supportingDocsLibrary}
        soItemId={documentModalTarget !== "new" ? documentModalTarget : null}
        onUploadDocuments={(files) => handleUploadItemDocuments(documentModalTarget, files)}
      />

      {/* Delete Line Item confirmation */}
      <DeleteConfirmationModal
        show={showDeleteItemModal}
        onCancel={handleCancelDeleteItem}
        onConfirm={handleConfirmDeleteItem}
        deleteText={`Are you sure you want to delete Item Code. ${deletingItem?.itemNo || ""}?`}
        isLoading={isDeletingItem}
      />

      {/* SO Approval email — opened from the header action button when the DA's real current
          stage is the "To be sent for X approval" stage (see isSoApprovalDaStatus). */}
      {isDaVerifyContext && (
        <SoApprovalEmailModal
          show={showSoApprovalEmailModal}
          onClose={() => setShowSoApprovalEmailModal(false)}
          onCreate={handleCreateSoApprovalEmail}
          isSubmitting={isSendingSoApprovalEmail}
          soCustomerName={soCustomerName}
          stageLabel={displayStageLabel || "SO Approval"}
          actionLabel={modalActionLabel}
          defaultTo={draftRecipientEmail}
          defaultCc={draftCcEmail}
          preLoadedDocuments={preLoadedDocuments}
          callId={callId}
        />
      )}

      {/* SO approval email upload — opened from the "Upload Approval Email" button; a successful
          upload swaps that button for the "Approved" label (see renderApprovedWithEmailUpload). */}
      {isDaVerifyContext && (
        <UploadInvoiceModal
          show={showApprovalEmailUploadModal}
          closeModal={handleCloseApprovalEmailUploadModal}
          contextLabel={soCustomerName ? `SO — ${soCustomerName}` : undefined}
          onUploadComplete={handleUploadApprovalEmail}
          allowEmptyUpload
          title="Upload Approval Email"
          fieldLabel="Attach approval email"
          accept=".pdf,.eml,.msg,.jpg,.jpeg,.png"
          formatsHint="PDF, EML, MSG, JPG, PNG"
          inputId="upload-approval-email-input"
        />
      )}

      {/* Invoice Issuance — opened from the header action button when the DA's real current
          stage is Invoice Issuance (see isRealInvoiceIssuanceStage). */}
      {isDaVerifyContext && (
        <UploadInvoiceModal
          show={showInvoiceIssuanceModal}
          closeModal={handleCloseInvoiceIssuanceModal}
          contextLabel={soCustomerName ? `SO — ${soCustomerName}` : undefined}
          onUploadComplete={handleUploadInvoiceIssuance}
        />
      )}
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
  onAdvanceDaStage: PropTypes.func,
  isAdvancingDaStage: PropTypes.bool,
  onDaStatusRefresh: PropTypes.func,
  currentStep: PropTypes.number,
  stepLabels: PropTypes.arrayOf(PropTypes.string),
  daStatusRefreshToken: PropTypes.number,
  soActionStateResetToken: PropTypes.number,
};

export default SalesOrderList;

