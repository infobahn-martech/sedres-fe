import { useState, useEffect, useRef, Fragment } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import CustomModal from "@/components/CustomModal";
import DeleteConfirmationModal from "@/components/DeleteConfirmationModal";
import CardTabListLoading from "@/components/CardTabListLoading";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import GroupSettingsIcon from "@/assets/images/cv.png";
import {
  FormField,
  FormInput,
  FormSelect,
  FormSection,
  FormGroup,
  FieldRow,
  FieldError,
  CheckboxField,
  PremiumCardHeader,
} from "./Husbandry.components";
import { validateDocumentFiles, MAIN_TABS, SERVICE_ACCENT } from "./Husbandry.constants";
import DateTimePickerField from "@/pages/KanbanBoard/CardFormTabs/shared/components/DateTimePickerField";
import LocationAutocomplete from "./LocationAutocomplete";
import editIcon from "@/assets/images/edit.svg";
import deleteIcon from "@/assets/images/delete.svg";
import logisticsWarehouseService from "@/services/logisticsWarehouseService";
import packingTypeService from "@/services/packingTypeService";
import useInboundOrderReducer from "@/store/InboundOrderReducer";
import useLandingNoteReducer from "@/store/LandingNoteReducer";
import useAlertReducer from "@/store/AlertReducer";
import inboundOrderService from "@/services/inboundOrderService";
import vehicleService from "@/services/vehicleService";
import usePermissions from "@/shared/hooks/usePermissions";
import { PERMISSION_MODULES, PERMISSION_SUBMODULES, PERMISSION_ACTIONS } from "@/shared/constants/permissions";
import {
  splitApiDateTimeParts,
  buildApiDateTime,
  formatDisplayDateTime,
  nextDayOf,
} from "@/shared/helpers/dateTimeFieldUtils";
import "@/design/scss/material-edit-form.scss";
import "@/design/scss/dispatch-note.scss";
import PremiumSelect from "@/components/form/PremiumSelect";
import {
  FiCopy,
  FiEye,
  FiPrinter,
  FiMoreVertical,
  FiFileText,
  FiArrowUp,
  FiArrowDown,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";

const MATERIAL_ACCENT = SERVICE_ACCENT[MAIN_TABS.MATERIAL_MANAGEMENT];

const extractListFromApi = (body) => {
  if (body == null) return [];
  if (Array.isArray(body)) return body;
  if (Array.isArray(body.data)) return body.data;
  return [];
};

const mergeOptionForValue = (options, value) => {
  if (value == null || value === "") return options;
  const s = String(value);
  if (options.some((o) => o.value === s)) return options;
  return [...options, { value: s, label: s }];
};

const launchHireStatusTone = (status) => {
  const raw = String(status ?? "").trim().toLowerCase();
  if (raw === "completed" || raw === "done") return "done";
  if (raw === "cancelled" || raw === "rejected") return "cancelled";
  if (raw === "pending" || raw === "requested") return "pending";
  return "default";
};

// Status step swaps its icon to match tone, so "done"/"cancelled" read at a glance
// instead of always showing a generic flag.
const launchHireStatusIcon = (tone) => {
  if (tone === "done") return "check";
  if (tone === "cancelled") return "cross";
  if (tone === "pending") return "clock";
  return "flag";
};

const renderLaunchHireStepIcon = (icon) => {
  switch (icon) {
    case "clock":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "pin":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 22s7-7.05 7-12a7 7 0 1 0-14 0c0 4.95 7 12 7 12Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "flag":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 21V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M5 4h13l-3 4 3 4H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "note":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M9 12h6M9 16h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "hash":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "calendar":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M8 3v4M16 3v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "building":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 21V10l9-6 9 6v11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 21v-6h6v6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
    case "list":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "package":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 8l-9-5-9 5 9 5 9-5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 8v8l9 5 9-5V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 13v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "check":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "cross":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "truck":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 8h11v8H2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M13 11h4l3 3v2h-7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="6" cy="18" r="1.8" stroke="currentColor" strokeWidth="2" />
          <circle cx="17" cy="18" r="1.8" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "target":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="0.6" fill="currentColor" />
        </svg>
      );
    case "user":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
          <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
};

// AttachmentsList Component (from Operation.jsx)
const AttachmentsList = ({ attachments = [], onRemove, cardColor, isDragging, onDragEnter, onDragLeave, onDragOver, onDrop, fileInputRef, onFileInputChange }) => {
  return (
    <div className="document-upload-wrapper">
      <div
        className={`document-upload-zone ${isDragging ? "dragging" : ""}`}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{ "--card-color": cardColor || "#00368c" }}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="file-input-hidden"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          multiple
          onChange={onFileInputChange}
        />
        <div className="upload-zone-content">
          <div className="upload-icon-wrapper"></div>
          <div className="upload-text-content">
            <p className="upload-main-text">
              Drag and drop your files here, or{" "}
              <span className="upload-link">click to browse</span>
            </p>
            <p className="upload-sub-text">
              Supports: PDF, DOC, DOCX, JPG, PNG (Max 10MB per file)
            </p>
          </div>
        </div>
      </div>
      {attachments.length > 0 && (
        <div className="document-file-preview-list">
          {attachments.map((item, index) => (
            <div key={index} className="document-file-preview-item">
              <div className="document-file-preview-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="document-file-preview-info">
                <span className="document-file-preview-name">{item.name || item}</span>
                {item.size != null && (
                  <span className="document-file-preview-size">
                    {item.size < 1024 * 1024
                      ? `${(item.size / 1024).toFixed(1)} KB`
                      : `${(item.size / 1024 / 1024).toFixed(2)} MB`}
                  </span>
                )}
              </div>
              <button
                className="document-file-preview-remove"
                onClick={(e) => { e.stopPropagation(); onRemove(index); }}
                type="button"
                title="Remove file"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ReactQuillEditor Component (from Operation.jsx)
const ReactQuillEditor = ({ value, onChange, placeholder, name = "remarks", className = "" }) => {
  const quillRef = useRef(null);

  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ color: [] }, { background: [] }],
      ["link", "image"],
      ["clean"],
    ],
  };

  const formats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "list",
    "bullet",
    "color",
    "background",
    "link",
    "image",
  ];

  const handleChange = (content) => {
    const syntheticEvent = { target: { value: content, name: name } };
    onChange(syntheticEvent);
  };

  return (
    <div className={`react-quill-wrapper ${className}`}>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value || ""}
        onChange={handleChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder || "Enter remarks..."}
      />
    </div>
  );
};

const InboundOrdersContent = ({ formValues, cardColor, showLaunchHire = true }) => {
  const { hasPermission } = usePermissions();
  // KANBAN_CARD > MATERIAL_MANAGEMENT per-action gates — absence of the
  // module/submodule/action in the permissions response means false (deny by
  // default).
  const canAddInbound = hasPermission({
    moduleKey: PERMISSION_MODULES.KANBAN_CARD,
    submoduleKey: PERMISSION_SUBMODULES.MATERIAL_MANAGEMENT,
    actionKey: PERMISSION_ACTIONS.ADD_INBOUND_ORDER,
  });
  const canUpdateInbound = hasPermission({
    moduleKey: PERMISSION_MODULES.KANBAN_CARD,
    submoduleKey: PERMISSION_SUBMODULES.MATERIAL_MANAGEMENT,
    actionKey: PERMISSION_ACTIONS.UPDATE_INBOUND_ORDER,
  });
  const canDeleteInbound = hasPermission({
    moduleKey: PERMISSION_MODULES.KANBAN_CARD,
    submoduleKey: PERMISSION_SUBMODULES.MATERIAL_MANAGEMENT,
    actionKey: PERMISSION_ACTIONS.DELETE_INBOUND_ORDER,
  });
  const canPrintInbound = hasPermission({
    moduleKey: PERMISSION_MODULES.KANBAN_CARD,
    submoduleKey: PERMISSION_SUBMODULES.MATERIAL_MANAGEMENT,
    actionKey: PERMISSION_ACTIONS.PRINT_INBOUND_ORDER,
  });
  const canConvertToLandingNote = hasPermission({
    moduleKey: PERMISSION_MODULES.KANBAN_CARD,
    submoduleKey: PERMISSION_SUBMODULES.MATERIAL_MANAGEMENT,
    actionKey: PERMISSION_ACTIONS.CONVERT_TO_LANDING_NOTE,
  });
  const {
    saveInboundOrder,
    updateInboundOrder,
    deleteInboundOrder,
    convertInboundToLandingNote,
    getAllInbound,
    getInboundOrdersTotal,
    getInboundById,
    clearInboundDetail,
    inboundOrders,
    inboundTotal,
    isLoadingList: isLoadingOrders,
    isLoadingView,
    isLoadingSave: isSubmitting,
    isBeingUpdated,
    isLoadingDelete,
    isBeingConverted,
    inboundDetail: viewingOrder,
  } = useInboundOrderReducer((state) => state);

  const formBodyRef = useRef(null);
  const [printingId, setPrintingId] = useState(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertFormErrors, setConvertFormErrors] = useState({});
  const [showViewModal, setShowViewModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [editOrderMinDate, setEditOrderMinDate] = useState(undefined);
  const [convertingOrder, setConvertingOrder] = useState(null);
  const [convertMinDate, setConvertMinDate] = useState(undefined);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingOrder, setDeletingOrder] = useState(null);
  const [expandedOrders, setExpandedOrders] = useState({ 1: true }); // First order expanded by default
  const [expandedConvertOrders, setExpandedConvertOrders] = useState({ 1: true });
  const [isDraggingDocuments, setIsDraggingDocuments] = useState(false);
  const documentsFileInputRef = useRef(null);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const dropdownButtonRefs = useRef({});
  const [inboundPage, setInboundPage] = useState(1);
  // Inbound list date sort (applies to the orders loaded for the current page).
  const [dateSortAsc, setDateSortAsc] = useState(true);
  const [formErrors, setFormErrors] = useState({});
  const INBOUND_LIMIT = 10;

  // Form state - Basic Details
  const [formData, setFormData] = useState({
    date: "",
    time: "",
    warehouse: "",
    remarks: "",
    launchHire: false,
    launchHireDate: "",
    launchHireTime: "",
    launchHireLocation: "",
    orders: [{
      id: 1,
      inbound_item_id: null,
      transportation_id: null,
      orderNo: "",
      poDo: "",
      quantity: "",
      packageType: "",
      description: "",
      transportation: false,
      typeOfVehicle: "",
      fromLocation: "",
      pickUpFrom: "",
      toLocation: "",
      driverName: "",
      slotNo: "",
      reason: "",
      dispatchDate: "",
      dispatchTime: ""
    }], // Order Details array
  });

  // Form state for Convert to Landing modal
  const [convertFormData, setConvertFormData] = useState({
    date: "",
    time: "",
    warehouse: "",
    receivedFrom: "",
    location: "",
    signature: "",
    documents: [],
    remarks: "",
    orders: [{
      id: 1,
      orderNo: "",
      poDo: "",
      quantity: "",
      packageType: "",
      description: "",
      transportation: false,
      typeOfVehicle: "",
      fromLocation: "",
      pickUpFrom: "",
      toLocation: "",
      driverName: "",
      slotNo: "",
      reason: "",
      dispatchDate: "",
      dispatchTime: ""
    }],
  });

  const [warehouseLocationOptions, setWarehouseLocationOptions] = useState([]);
  const [transportLocationOptions, setTransportLocationOptions] = useState([]);
  const [packageTypeOptions, setPackageTypeOptions] = useState([]);
  const [materialVehicleOptions, setMaterialVehicleOptions] = useState([]);
  const [materialDriverOptions, setMaterialDriverOptions] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const loadReferenceData = async () => {
      const [whRes, pkgRes, vehRes, drvRes, trLocRes] = await Promise.allSettled([
        logisticsWarehouseService.getWarehouseLocations(),
        packingTypeService.getPackingTypes(),
        vehicleService.getMaterialVehicles(),
        vehicleService.getMaterialDrivers(),
        inboundOrderService.getMaterialTransportLocations(),
      ]);
      if (cancelled) return;
      if (whRes.status === "fulfilled") {
        const whRows = extractListFromApi(whRes.value?.data);
        setWarehouseLocationOptions(
          whRows
            .map((r) => ({ value: String(r.location_id ?? ""), label: String(r.location ?? "") }))
            .filter((o) => o.value && o.label)
        );
      }
      if (pkgRes.status === "fulfilled") {
        const pkgRows = extractListFromApi(pkgRes.value?.data);
        setPackageTypeOptions(
          pkgRows
            .map((r) => ({ value: String(r.package_type_id ?? ""), label: String(r.package_type ?? "") }))
            .filter((o) => o.value && o.label)
        );
      }
      if (vehRes.status === "fulfilled") {
        const vehRows = extractListFromApi(vehRes.value?.data);
        setMaterialVehicleOptions(
          vehRows
            .map((r) => ({ value: String(r.vehicle_type_id ?? ""), label: String(r.vehicle_name ?? "") }))
            .filter((o) => o.value && o.label)
        );
      }
      if (drvRes.status === "fulfilled") {
        const drvRows = extractListFromApi(drvRes.value?.data);
        setMaterialDriverOptions(
          drvRows
            .map((r) => ({ value: String(r.driver_id ?? ""), label: String(r.driver_name ?? r.name ?? "") }))
            .filter((o) => o.value)
        );
      }
      if (trLocRes.status === "fulfilled") {
        const trLocRows = extractListFromApi(trLocRes.value?.data);
        setTransportLocationOptions(
          trLocRows
            .map((r) => ({ value: String(r.location_id ?? ""), label: String(r.location ?? "") }))
            .filter((o) => o.value && o.label)
        );
      }
    };
    loadReferenceData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);
    if (!callId) return;
    getAllInbound({ call_id: callId, page: inboundPage, limit: INBOUND_LIMIT });
  }, [formValues?.call_id, formValues?.callId, formValues?.card_call_id, inboundPage]);

  const populateFormFromOrder = (order) => {
    const apiItems = Array.isArray(order.items) ? order.items : [];
    const orderItems = apiItems.length > 0
      ? apiItems.map((item, idx) => ({
        id: item.inbound_item_id || idx + 1,
        inbound_item_id: item.inbound_item_id ? Number(item.inbound_item_id) : null,
        transportation_id: item.transportation?.transportation_id ? Number(item.transportation.transportation_id) : null,
        orderNo: item.order_no || "",
        poDo: item.po_do_no ?? item.po_no ?? "",
        quantity: item.quantity || "",
        packageType: String(item.package_type_id || ""),
        description: item.description || "",
        transportation: Number(item.transportation_required) === 1,
        typeOfVehicle: item.transportation
          ? String(item.transportation.vehicle_type_id || "") ||
          (materialVehicleOptions.find((o) => o.label.toLowerCase() === (item.transportation.vehicle_type_name || "").toLowerCase())?.value || "") ||
          (item.transportation.vehicle_type_name ? String(item.transportation.vehicle_type_name) : "")
          : "",
        fromLocation: item.transportation
          ? String(item.transportation.from_location_id || "") ||
          (transportLocationOptions.find((o) => o.label.toLowerCase() === (item.transportation.from_location_name || "").toLowerCase())?.value || "") ||
          (item.transportation.from_location_name ? String(item.transportation.from_location_name) : "")
          : "",
        pickUpFrom: item.transportation ? item.transportation.pickup_location || "" : "",
        toLocation: item.transportation
          ? String(item.transportation.to_location_id || "") ||
          (transportLocationOptions.find((o) => o.label.toLowerCase() === (item.transportation.to_location_name || "").toLowerCase())?.value || "") ||
          (item.transportation.to_location_name ? String(item.transportation.to_location_name) : "")
          : "",
        driverName: item.transportation
          ? String(item.transportation.driver_id || "") ||
          (materialDriverOptions.find((o) => o.label.toLowerCase() === (item.transportation.driver_name || "").toLowerCase())?.value || "") ||
          (item.transportation.driver_name ? String(item.transportation.driver_name) : "")
          : "",
        slotNo: "",
        reason: "",
        dispatchDate: "",
        dispatchTime: "",
      }))
      : [{
        id: 1,
        inbound_item_id: null,
        transportation_id: null,
        orderNo: "",
        poDo: "",
        quantity: "",
        packageType: "",
        description: "",
        transportation: false,
        typeOfVehicle: "",
        fromLocation: "",
        pickUpFrom: "",
        toLocation: "",
        driverName: "",
        slotNo: "",
        reason: "",
        dispatchDate: "",
        dispatchTime: "",
      }];

    const { date: editDate, time: editTime } = splitApiDateTimeParts(
      order.inbound_date || order.date || "",
      order.inbound_time || order.time || ""
    );

    const launchHireBooking = order.launch_hire && typeof order.launch_hire === "object" ? order.launch_hire : null;

    const { date: launchHireDate, time: launchHireTime } = splitApiDateTimeParts(
      launchHireBooking?.booking_datetime || order.booking_datetime || order.launch_hire_date || "",
      ""
    );

    setFormData({
      date: editDate,
      time: editTime,
      warehouse: String(order.warehouse_id || order.warehouse || ""),
      remarks: order.remarks || "",
      launchHire: launchHireBooking ? true : Number(order.launch_hire) === 1,
      launchHireDate,
      launchHireTime,
      launchHireLocation: launchHireBooking?.location || order.location || order.launch_hire_location || "",
      orders: orderItems,
    });
    if (editDate) setEditOrderMinDate(editDate);

    const expandedState = {};
    orderItems.forEach((item) => {
      expandedState[item.id] = true;
    });
    setExpandedOrders(expandedState);
  };

  // Loads an existing order into the left-hand form card for editing.
  const handleEditOrder = (order) => {
    if (!order || !canUpdateInbound) return;
    setFormErrors({});
    setEditingOrder(order);
    populateFormFromOrder(order);
    formBodyRef.current?.scrollTo?.({ top: 0, behavior: "smooth" });

    const inboundId = order.inbound_id ?? order.id;
    if (inboundId != null && inboundId !== "") {
      inboundOrderService
        .getInboundById(inboundId)
        .then(({ data }) => {
          const detail = data?.data;
          if (detail) populateFormFromOrder(detail);
        })
        .catch(() => { });
    }
  };

  // Clears the form card back to a blank "new order" (also exits edit mode).
  const resetInboundForm = () => {
    setEditingOrder(null);
    setEditOrderMinDate(undefined);
    setFormErrors({});
    setFormData({
      date: "",
      time: "",
      warehouse: "",
      remarks: "",
      launchHire: false,
      launchHireDate: "",
      launchHireTime: "",
      launchHireLocation: "",
      orders: [{
        id: 1,
        inbound_item_id: null,
        transportation_id: null,
        orderNo: "",
        poDo: "",
        quantity: "",
        packageType: "",
        description: "",
        transportation: false,
        typeOfVehicle: "",
        fromLocation: "",
        pickUpFrom: "",
        toLocation: "",
        driverName: "",
        slotNo: "",
        reason: "",
        dispatchDate: "",
        dispatchTime: ""
      }],
    });
    setExpandedOrders({ 1: true });
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleOrderChange = (orderId, field, value) => {
    setFormData((prev) => ({
      ...prev,
      orders: prev.orders.map((order) =>
        order.id === orderId ? { ...order, [field]: value } : order
      ),
    }));
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.date) errors.date = "Date is required";
    if (!formData.warehouse) errors.warehouse = "Warehouse is required";
    if (formData.launchHire && !formData.launchHireDate) errors.launchHireDate = "Booking date and time are required";
    formData.orders.forEach((order, idx) => {
      if (!order.quantity) errors[`o${idx}_quantity`] = "Quantity is required";
      if (!order.packageType) errors[`o${idx}_packageType`] = "Package Type is required";
      if (order.transportation) {
        if (!order.typeOfVehicle) errors[`o${idx}_typeOfVehicle`] = "Vehicle type is required";
        if (!order.fromLocation) errors[`o${idx}_fromLocation`] = "From location is required";
        if (!order.pickUpFrom) errors[`o${idx}_pickUpFrom`] = "Pick-up from is required";
        if (!order.toLocation) errors[`o${idx}_toLocation`] = "To location is required";
        if (!order.driverName) errors[`o${idx}_driverName`] = "Driver is required";
      }
    });
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddNewOrder = () => {
    const lastOrder = formData.orders[formData.orders.length - 1];
    if (lastOrder && (!lastOrder.quantity || !lastOrder.packageType)) {
      const idx = formData.orders.length - 1;
      setFormErrors((prev) => ({
        ...prev,
        [`o${idx}_quantity`]: !lastOrder.quantity ? "Quantity is required" : undefined,
        [`o${idx}_packageType`]: !lastOrder.packageType ? "Package Type is required" : undefined,
      }));
      // Expand the last order so errors are visible
      setExpandedOrders((prev) => ({ ...prev, [lastOrder.id]: true }));
      return;
    }
    const newOrderId = formData.orders.length > 0 ? Math.max(...formData.orders.map((o) => o.id)) + 1 : 1;
    setFormData((prev) => ({
      ...prev,
      orders: [
        ...prev.orders,
        {
          id: newOrderId,
          inbound_item_id: null,
          transportation_id: null,
          orderNo: "",
          poDo: "",
          quantity: "",
          packageType: "",
          description: "",
          transportation: false,
          typeOfVehicle: "",
          fromLocation: "",
          pickUpFrom: "",
          toLocation: "",
          driverName: "",
          slotNo: "",
          reason: "",
          dispatchDate: "",
          dispatchTime: ""
        },
      ],
    }));
    // Expand the new order by default
    setExpandedOrders((prev) => ({
      ...prev,
      [newOrderId]: true,
    }));
  };

  const handleRemoveOrder = (orderId) => {
    if (formData.orders.length > 1) {
      setFormData((prev) => ({
        ...prev,
        orders: prev.orders.filter((order) => order.id !== orderId),
      }));
      // Remove from expandedOrders if it exists
      setExpandedOrders((prev) => {
        const newExpanded = { ...prev };
        delete newExpanded[orderId];
        return newExpanded;
      });
    }
  };

  const toggleOrderExpand = (orderId) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingOrder?.inbound_id ? !canUpdateInbound : !canAddInbound) return;
    if (!validateForm()) return;
    const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);

    const items = formData.orders.map((order) => {
      const item = {
        ...(order.inbound_item_id ? { inbound_item_id: order.inbound_item_id } : {}),
        po_do_no: order.poDo,
        quantity: Number(order.quantity) || 0,
        package_type_id: Number(order.packageType) || 0,
        description: order.description || "",
        transportation_required: order.transportation ? 1 : 0,
      };
      if (order.transportation) {
        item.transportation = {
          ...(order.transportation_id ? { transportation_id: order.transportation_id } : {}),
          vehicle_type_id: Number(order.typeOfVehicle) || 0,
          from_location_id: Number(order.fromLocation) || 0,
          pickup_location: order.pickUpFrom || "",
          to_location_id: Number(order.toLocation) || 0,
          driver_id: Number(order.driverName) || 0,
        };
      }
      return item;
    });

    const payload = {
      call_id: callId,
      warehouse_id: Number(formData.warehouse) || 0,
      inbound_date: buildApiDateTime(formData.date, formData.time),
      inbound_time: (formData.time || "").slice(0, 5),
      // Remarks use the shared rich-text editor; the API stores plain text.
      remarks: (formData.remarks || "").replace(/<[^>]*>/g, "").trim(),
      launch_hire: formData.launchHire ? 1 : 0,
      ...(formData.launchHire ? {
        booking_datetime: buildApiDateTime(formData.launchHireDate, formData.launchHireTime),
        location: formData.launchHireLocation || "",
      } : {}),
      items,
    };

    if (editingOrder?.inbound_id) {
      updateInboundOrder({
        inboundId: editingOrder.inbound_id,
        data: payload,
        cb: () => {
          resetInboundForm();
          getAllInbound({ call_id: callId, page: inboundPage, limit: INBOUND_LIMIT });
          getInboundOrdersTotal({ call_id: callId });
        },
      });
    } else {
      saveInboundOrder({
        data: payload,
        cb: () => {
          resetInboundForm();
          getAllInbound({ call_id: callId, page: inboundPage, limit: INBOUND_LIMIT });
          getInboundOrdersTotal({ call_id: callId });
        },
      });
    }
  };

  const handleReset = () => {
    setFormData({
      date: "",
      time: "",
      warehouse: "",
      remarks: "",
      launchHire: false,
      launchHireDate: "",
      launchHireTime: "",
      launchHireLocation: "",
      orders: [{
        id: 1,
        inbound_item_id: null,
        transportation_id: null,
        orderNo: "",
        poDo: "",
        quantity: "",
        packageType: "",
        description: "",
        transportation: false,
        typeOfVehicle: "",
        fromLocation: "",
        pickUpFrom: "",
        toLocation: "",
        driverName: "",
        slotNo: "",
        reason: "",
        dispatchDate: "",
        dispatchTime: ""
      }],
    });
    setExpandedOrders({ 1: true });
  };

  const handleDelete = (order) => {
    if (!canDeleteInbound) return;
    handleCloseDropdown();
    setDeletingOrder(order);
    setShowDeleteModal(true);
  };

  const resolveInboundId = (order) => {
    const raw = order?.inbound_id ?? order?.id;
    if (raw == null || raw === "") return null;
    return raw;
  };

  const handleConfirmDelete = () => {
    if (!deletingOrder) return;
    const inboundId = resolveInboundId(deletingOrder);
    if (inboundId == null) return;

    const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);
    const pageAfterDelete =
      inboundOrders.length <= 1 && inboundPage > 1 ? inboundPage - 1 : inboundPage;

    deleteInboundOrder({
      inboundId,
      cb: () => {
        setShowDeleteModal(false);
        setDeletingOrder(null);
        // Drop the form out of edit mode if the order being edited was deleted.
        if (editingOrder && resolveInboundId(editingOrder) === inboundId) {
          resetInboundForm();
        }
        if (pageAfterDelete !== inboundPage) {
          setInboundPage(pageAfterDelete);
        }
        getAllInbound({ call_id: callId, page: pageAfterDelete, limit: INBOUND_LIMIT });
        getInboundOrdersTotal({ call_id: callId });
      },
    });
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setDeletingOrder(null);
  };

  const handleViewOrder = (order) => {
    handleCloseDropdown();
    setShowViewModal(true);
    const inboundId = resolveInboundId(order);
    if (inboundId != null) {
      getInboundById({ inboundId });
    }
  };

  const handleCloseViewModal = () => {
    setShowViewModal(false);
    clearInboundDetail();
  };

  const handleToggleDropdown = (orderId, e) => {
    e.stopPropagation();
    if (openDropdownId === orderId) {
      setOpenDropdownId(null);
    } else {
      const button = e.currentTarget;
      const rect = button.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right
      });
      dropdownButtonRefs.current[orderId] = button;
      setOpenDropdownId(orderId);
    }
  };

  const handleCloseDropdown = () => {
    setOpenDropdownId(null);
  };

  // Close dropdown when clicking outside or scrolling
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is on the dropdown button or inside the portal dropdown menu
      const isDropdownButton = event.target.closest('.action-dropdown-wrapper');
      const isDropdownMenu = event.target.closest('[data-dropdown-menu]');

      if (!isDropdownButton && !isDropdownMenu) {
        setOpenDropdownId(null);
      }
    };

    const handleScroll = () => {
      setOpenDropdownId(null);
    };

    if (openDropdownId) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [openDropdownId]);

  const handlePrintOrder = async (order) => {
    if (!canPrintInbound) return;
    handleCloseDropdown();
    const inboundId = resolveInboundId(order);
    if (!inboundId || printingId) return;
    setPrintingId(inboundId);
    try {
      const response = await inboundOrderService.printInboundOrder(inboundId);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      const { error: showError } = useAlertReducer.getState();
      showError(err?.response?.data?.message ?? 'Failed to generate print');
    } finally {
      setPrintingId(null);
    }
  };

  const buildConvertOrders = (items) => {
    if (!Array.isArray(items) || items.length === 0) return null;
    return items.map((item, idx) => ({
      id: idx + 1,
      inbound_item_id: item.inbound_item_id ? Number(item.inbound_item_id) : null,
      orderNo: item.order_no || "",
      poDo: item.po_do_no ?? item.po_no ?? "",
      quantity: item.quantity ? String(item.quantity) : "",
      packageType: String(item.package_type_id || ""),
      description: item.description || "",
      transportation: Number(item.transportation_required) === 1,
      transportation_id: item.transportation?.transportation_id ? Number(item.transportation.transportation_id) : null,
      typeOfVehicle: item.transportation
        ? String(item.transportation.vehicle_type_id || "") ||
        (materialVehicleOptions.find((o) => o.label.toLowerCase() === (item.transportation.vehicle_type_name || "").toLowerCase())?.value || "") ||
        (item.transportation.vehicle_type_name ? String(item.transportation.vehicle_type_name) : "")
        : "",
      fromLocation: item.transportation
        ? String(item.transportation.from_location_id || "") ||
        (transportLocationOptions.find((o) => o.label.toLowerCase() === (item.transportation.from_location_name || "").toLowerCase())?.value || "") ||
        (item.transportation.from_location_name ? String(item.transportation.from_location_name) : "")
        : "",
      pickUpFrom: item.transportation ? item.transportation.pickup_location || "" : "",
      toLocation: item.transportation
        ? String(item.transportation.to_location_id || "") ||
        (transportLocationOptions.find((o) => o.label.toLowerCase() === (item.transportation.to_location_name || "").toLowerCase())?.value || "") ||
        (item.transportation.to_location_name ? String(item.transportation.to_location_name) : "")
        : "",
      driverName: item.transportation
        ? String(item.transportation.driver_id || "") ||
        (materialDriverOptions.find((o) => o.label.toLowerCase() === (item.transportation.driver_name || "").toLowerCase())?.value || "") ||
        (item.transportation.driver_name ? String(item.transportation.driver_name) : "")
        : "",
      slotNo: item.slot_no || (item.slot_no_id != null ? `Slot ${item.slot_no_id}` : (item.slotNo != null ? String(item.slotNo) : "")),
      reason: item.reason ? String(item.reason) : "",
      ...splitApiDateTimeParts(item.dispatch_date || item.dispatchDate || ""),
    }));
  };

  const handleConvertToLanding = (order) => {
    if (!canConvertToLandingNote) return;
    handleCloseDropdown();
    setConvertingOrder(order);
    setConvertMinDate(nextDayOf(order.inbound_date || order.date));
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    setConvertFormData({
      date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
      warehouse: String(order.warehouse_id || ""),
      receivedFrom: "",
      signature: "",
      location: "",
      documents: [],
      remarks: "",
      orders: [{
        id: 1, inbound_item_id: null, orderNo: "", poDo: "", quantity: "", packageType: "", description: "", transportation: false, typeOfVehicle: "", fromLocation: "", pickUpFrom: "", toLocation: "", driverName: "", slotNo: "", reason: "", dispatchDate: "",
        dispatchTime: ""
      }],
    });
    setExpandedConvertOrders({ 1: true });
    setShowConvertModal(true);

    const inboundId = order.inbound_id ?? order.id;
    if (inboundId != null) {
      inboundOrderService.getInboundById(inboundId)
        .then(({ data }) => {
          const detail = data?.data;
          if (!detail) return;
          const detailMinDate = nextDayOf(detail.inbound_date || detail.date);
          if (detailMinDate) setConvertMinDate(detailMinDate);
          const orders = buildConvertOrders(detail.items);
          if (orders) {
            const exp = {};
            orders.forEach((o) => { exp[o.id] = true; });
            setConvertingOrder(detail);
            setConvertFormData((prev) => ({
              ...prev,
              warehouse: String(detail.warehouse_id || prev.warehouse),
              receivedFrom: detail.received_from || prev.receivedFrom || "",
              location: detail.location || prev.location || "",
              signature: detail.signature || prev.signature || "",
              orders,
            }));
            setExpandedConvertOrders(exp);
          }
        })
        .catch(() => { });
    }
  };

  const handleCloseConvertModal = () => {
    setShowConvertModal(false);
    setConvertingOrder(null);
    setConvertMinDate(undefined);
    setConvertFormErrors({});
    setConvertFormData({
      date: "",
      time: "",
      warehouse: "",
      receivedFrom: "",
      location: "",
      signature: "",
      documents: [],
      remarks: "",
      orders: [{
        id: 1,
        inbound_item_id: null,
        transportation_id: null,
        orderNo: "",
        poDo: "",
        quantity: "",
        packageType: "",
        description: "",
        transportation: false,
        typeOfVehicle: "",
        fromLocation: "",
        pickUpFrom: "",
        toLocation: "",
        driverName: "",
        slotNo: "",
        reason: "",
        dispatchDate: "",
        dispatchTime: ""
      }],
    });
  };

  const handleConvertFormChange = (field, value) => {
    setConvertFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleConvertOrderChange = (orderId, field, value) => {
    setConvertFormData((prev) => ({
      ...prev,
      orders: prev.orders.map((order) =>
        order.id === orderId ? { ...order, [field]: value } : order
      ),
    }));
  };

  const handleAddNewConvertOrder = () => {
    const newOrderId = convertFormData.orders.length > 0
      ? Math.max(...convertFormData.orders.map((o) => o.id)) + 1
      : 1;
    setConvertFormData((prev) => ({
      ...prev,
      orders: [
        ...prev.orders,
        {
          id: newOrderId,
          inbound_item_id: null,
          transportation_id: null,
          orderNo: "",
          poDo: "",
          quantity: "",
          packageType: "",
          description: "",
          transportation: false,
          typeOfVehicle: "",
          fromLocation: "",
          pickUpFrom: "",
          toLocation: "",
          driverName: "",
          slotNo: "",
          reason: "",
          dispatchDate: "",
          dispatchTime: ""
        },
      ],
    }));
    setExpandedConvertOrders((prev) => ({
      ...prev,
      [newOrderId]: true,
    }));
  };

  const handleRemoveConvertOrder = (orderId) => {
    if (convertFormData.orders.length > 1) {
      setConvertFormData((prev) => ({
        ...prev,
        orders: prev.orders.filter((order) => order.id !== orderId),
      }));
      setExpandedConvertOrders((prev) => {
        const newExpanded = { ...prev };
        delete newExpanded[orderId];
        return newExpanded;
      });
    }
  };

  const toggleConvertOrderExpand = (orderId) => {
    setExpandedConvertOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  // Handle documents drag and drop
  const handleDocumentsDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingDocuments(true);
  };

  const handleDocumentsDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingDocuments(false);
  };

  const handleDocumentsDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const addDocumentFiles = (files) => {
    const { validFiles, rejectedFiles } = validateDocumentFiles(files);
    if (rejectedFiles.length > 0) {
      const { error: showError } = useAlertReducer.getState();
      showError(rejectedFiles.map((f) => `"${f.name}" — ${f.reason}`).join("; "));
    }
    if (validFiles.length > 0) {
      const currentAttachments = convertFormData.documents || [];
      const newAttachments = validFiles.map((file) => ({
        name: file.name,
        file: file,
        size: file.size,
        type: file.type,
      }));
      const updatedAttachments = [...currentAttachments, ...newAttachments];
      setConvertFormData((prev) => ({
        ...prev,
        documents: updatedAttachments,
      }));
    }
  };

  const handleDocumentsDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingDocuments(false);
    addDocumentFiles(Array.from(e.dataTransfer.files || []));
  };

  const handleDocumentsFileInputChange = (e) => {
    addDocumentFiles(Array.from(e.target.files || []));
    if (documentsFileInputRef.current) {
      documentsFileInputRef.current.value = "";
    }
  };

  const handleDocumentsRemove = (index) => {
    const currentAttachments = convertFormData.documents || [];
    const updatedAttachments = currentAttachments.filter((_, i) => i !== index);
    setConvertFormData((prev) => ({
      ...prev,
      documents: updatedAttachments,
    }));
  };

  const validateConvertForm = () => {
    const errors = {};
    if (!convertFormData.date) errors.date = "Date is required";
    if (!convertFormData.receivedFrom) errors.receivedFrom = "Received From is required";
    if (!convertFormData.location) errors.location = "Location is required";
    convertFormData.orders.forEach((order, idx) => {
      if (!order.quantity) errors[`co${idx}_quantity`] = "Quantity is required";
      if (!order.slotNo) errors[`co${idx}_slotNo`] = "Slot is required";
    });
    setConvertFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleConvertSubmit = (e) => {
    e.preventDefault();
    if (!validateConvertForm()) return;
    const inboundId = convertingOrder?.inbound_id ?? convertingOrder?.id;
    const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);
    const landingDate = convertFormData.date + (convertFormData.time ? ` ${convertFormData.time}` : "");
    const fd = new FormData();
    fd.append("inbound_id", inboundId);
    fd.append("call_id", callId);
    fd.append("warehouse_id", convertFormData.warehouse || "");
    fd.append("landing_date", landingDate);
    fd.append("landing_note_number", "");
    fd.append("received_from", convertFormData.receivedFrom || "");
    fd.append("location", convertFormData.location || "");
    fd.append("signature", convertFormData.signature || "");
    fd.append("remarks", (convertFormData.remarks || "").replace(/<[^>]*>/g, "").trim());
    (convertFormData.documents || []).forEach((doc) => {
      const file = doc?.file ?? doc;
      if (file) fd.append("file[]", file);
    });
    const items = convertFormData.orders.map((order) => ({
      inbound_item_id: order.inbound_item_id || null,
      quantity: Number(order.quantity) || 0,
      slot_no: order.slotNo || "",
      reason: order.reason || "",
      dispatch_date: order.dispatchDate ? (order.dispatchDate + (order.dispatchTime ? ` ${order.dispatchTime}` : "")) : "",
      transportation_required: order.transportation ? 1 : 0,
      transportation: order.transportation ? {
        vehicle_type_id: Number(order.typeOfVehicle) || 0,
        from_location_id: Number(order.fromLocation) || 0,
        pickup_location: order.pickUpFrom || "",
        to_location_id: Number(order.toLocation) || 0,
        driver_id: Number(order.driverName) || 0,
      } : null,
    }));
    fd.append("items", JSON.stringify(items));
    convertInboundToLandingNote({
      data: fd,
      cb: () => {
        handleCloseConvertModal();
        getAllInbound({ call_id: callId, page: inboundPage, limit: INBOUND_LIMIT });
        getInboundOrdersTotal({ call_id: callId });
        useLandingNoteReducer.getState().getLandingNotesTotal({ call_id: callId });
      },
    });
  };


  const formatDate = (dateString, separateTime) => formatDisplayDateTime(dateString, separateTime);

  const slotNoOptions = [
    { value: "Slot 1", label: "Slot 1" },
    { value: "Slot 2", label: "Slot 2" },
    { value: "Slot 3", label: "Slot 3" },
    { value: "Slot 4", label: "Slot 4" },
    { value: "Slot 5", label: "Slot 5" },
    { value: "Slot 6", label: "Slot 6" },
  ];

  const reasonOptions = [
    { value: "Scrap", label: "Scrap" },
    { value: "Wrong supply", label: "Wrong supply" },
    { value: "Safe storage", label: "Safe storage" },
    { value: "Service", label: "Service" },
    { value: "Transit", label: "Transit" },
  ];

  const launchHireLocationOptions = [
    { value: "Freighter Anchorage", label: "Freighter Anchorage" },
    { value: "RT7", label: "RT7" },
    { value: "Sea Island", label: "Sea Island" },
    { value: "Juaymah", label: "Juaymah" },
  ];


  const WEEKDAY_FMT = { weekday: "long" };
  const DAY_FMT = { day: "2-digit", month: "short", year: "numeric" };

  const itemPackageLabel = (item) =>
    item?.package_type ||
    packageTypeOptions.find((o) => o.value === String(item?.package_type_id ?? ""))?.label ||
    "";

  const formatQty = (value) => {
    const n = Number(value);
    if (value == null || value === "" || Number.isNaN(n)) return "—";
    return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
  };

  const orderSortKey = (order) => {
    const { date, time } = splitApiDateTimeParts(order.inbound_date || order.date || "", order.inbound_time || order.time || "");
    return date ? `${date} ${time || "00:00"}` : "";
  };

  // "28 Nov 2026" on top, weekday (+ time when set) underneath.
  const orderDateParts = (order) => {
    const { date, time } = splitApiDateTimeParts(order.inbound_date || order.date || "", order.inbound_time || order.time || "");
    if (!date) return null;
    const [y, m, d] = date.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    if (Number.isNaN(dt.getTime())) return null;
    const weekday = dt.toLocaleDateString("en-GB", WEEKDAY_FMT);
    return {
      date: dt.toLocaleDateString("en-GB", DAY_FMT),
      sub: time && time !== "00:00" ? `${weekday} · ${time}` : weekday,
    };
  };

  const handleCopyOrderNo = (orderNo) => {
    if (!orderNo || !navigator?.clipboard?.writeText) return;
    navigator.clipboard
      .writeText(orderNo)
      .then(() => useAlertReducer.getState().success("Order number copied"))
      .catch(() => useAlertReducer.getState().error("Could not copy order number"));
  };

  const visibleOrders = inboundOrders
    .slice()
    .sort((a, b) => {
      const cmp = orderSortKey(a).localeCompare(orderSortKey(b));
      return dateSortAsc ? cmp : -cmp;
    });

  const visibleTotalQty = visibleOrders.reduce(
    (sum, order) =>
      sum + (Array.isArray(order.items) ? order.items : []).reduce((s, item) => s + (Number(item.quantity) || 0), 0),
    0
  );

  const inboundTotalPages = Math.max(1, Math.ceil((inboundTotal || 0) / INBOUND_LIMIT));

  const editingOrderLabel = editingOrder?.inbound_no || editingOrder?.order_no || "";
  const editingInboundId = editingOrder ? resolveInboundId(editingOrder) : null;
  // The form card replaces the old "+ Add" modal, so hide it when the user can neither add nor is editing.
  const showFormCard = canAddInbound || !!editingOrder;

  const clearFormError = (key) => {
    if (!formErrors[key]) return;
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Left-hand form card body (was the Add/Edit modal body).
  // Field layout follows the shared husbandry service pattern:
  // FormGroup → FormField / FieldRow, transport-date-time-field, CheckboxField, Quill remarks.
  const renderFormBody = () => (
    <form id="inboundOrderForm" className="material-edit-form material-note-card-form" onSubmit={handleSubmit}>
      <FormGroup icon="calendar" label="" accent={MATERIAL_ACCENT}>
        <FormField label="Date *">
          <div className="transport-date-time-field">
            <DateTimePickerField
              dateValue={formData.date}
              timeValue={formData.time}
              onDateTimeChange={(nextValues) => {
                setFormData((prev) => ({ ...prev, date: nextValues.date, time: nextValues.time }));
                clearFormError("date");
              }}
              dateFieldName="date"
              timeFieldName="time"
              placeholder="Select date and time"
              minDate={editingOrder ? editOrderMinDate : undefined}
            />
          </div>
          <FieldError message={formErrors.date} />
        </FormField>

        <FormField label="Warehouse *">
          <PremiumSelect
            value={formData.warehouse}
            onChange={(e) => {
              handleFormChange("warehouse", e.target.value);
              clearFormError("warehouse");
            }}
            options={mergeOptionForValue(warehouseLocationOptions, formData.warehouse)}
            placeholder="Select warehouse"
            searchPlaceholder="Search warehouse..."
            hasError={!!formErrors.warehouse}
          />
          <FieldError message={formErrors.warehouse} />
        </FormField>
      </FormGroup>

      <FormGroup icon="list" label="Order Details" accent={MATERIAL_ACCENT}>
        <div className="inbound-orders">
          {formData.orders.map((order, index) => {
            const isOpen = !!expandedOrders[order.id];
            const hasOrderError = Object.keys(formErrors).some((k) => k.startsWith(`o${index}_`) && formErrors[k]);
            const pkgLabel = packageTypeOptions.find((o) => o.value === order.packageType)?.label || "";
            const summaryParts = [
              order.quantity ? `${order.quantity}${pkgLabel ? ` × ${pkgLabel}` : ""}` : "",
              order.poDo ? `PO/DO ${order.poDo}` : "",
            ].filter(Boolean);
            return (
              <div
                key={order.id}
                className={`inbound-order${isOpen ? " is-open" : ""}${hasOrderError ? " has-error" : ""}`}
              >
                <div
                  className="inbound-order__head"
                  role="button"
                  tabIndex={0}
                  aria-expanded={isOpen}
                  onClick={() => toggleOrderExpand(order.id)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleOrderExpand(order.id);
                    }
                  }}
                >
                  <span className="inbound-order__index">{index + 1}</span>
                  <div className="inbound-order__title">
                    <span className="inbound-order__name">Order {index + 1}</span>
                    {!isOpen && (
                      <span className="inbound-order__summary">
                        {summaryParts.length ? summaryParts.join(" · ") : "No details yet"}
                      </span>
                    )}
                  </div>
                  {order.transportation && (
                    <span className="inbound-order__chip">
                      {renderLaunchHireStepIcon("truck")}
                      Transport
                    </span>
                  )}
                  <div className="inbound-order__actions">
                    {formData.orders.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleRemoveOrder(order.id); }}
                        className="inbound-order__icon-btn inbound-order__icon-btn--delete"
                        title="Remove order"
                        aria-label={`Remove order ${index + 1}`}
                      >
                        <img src={deleteIcon} alt="" />
                      </button>
                    )}
                    <svg
                      width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
                      className={`inbound-order__chevron${isOpen ? " expanded" : ""}`}
                    >
                      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                {isOpen && (
                  <div className="inbound-order__body">
                    <div className="inbound-order__grid">
                      <FormField label="PO/DO" className="inbound-order__span-2">
                        <FormInput
                          type="text"
                          value={order.poDo}
                          onChange={(e) => {
                            handleOrderChange(order.id, "poDo", e.target.value);
                            clearFormError(`o${index}_poDo`);
                          }}
                          placeholder="Enter PO/DO number..."
                        />
                        <FieldError message={formErrors[`o${index}_poDo`]} />
                      </FormField>

                      <FormField label="Quantity *">
                        <FormInput
                          type="number"
                          value={order.quantity}
                          onChange={(e) => {
                            handleOrderChange(order.id, "quantity", e.target.value);
                            clearFormError(`o${index}_quantity`);
                          }}
                          placeholder="Enter quantity..."
                          className={formErrors[`o${index}_quantity`] ? "is-invalid" : ""}
                        />
                        <FieldError message={formErrors[`o${index}_quantity`]} />
                      </FormField>

                      <FormField label="Package Type *">
                        <PremiumSelect
                          value={order.packageType}
                          onChange={(e) => {
                            handleOrderChange(order.id, "packageType", e.target.value);
                            clearFormError(`o${index}_packageType`);
                          }}
                          options={mergeOptionForValue(packageTypeOptions, order.packageType)}
                          placeholder="Select package type"
                          searchPlaceholder="Search package type..."
                          hasError={!!formErrors[`o${index}_packageType`]}
                        />
                        <FieldError message={formErrors[`o${index}_packageType`]} />
                      </FormField>

                      <FormField label="Description" className="inbound-order__span-2">
                        <FormInput
                          type="text"
                          value={order.description}
                          onChange={(e) => handleOrderChange(order.id, "description", e.target.value)}
                          placeholder="Enter description..."
                        />
                      </FormField>
                    </div>

                    <div className={`inbound-order__transport${order.transportation ? " is-on" : ""}`}>
                      <label className="inbound-order__transport-toggle">
                        <span className="inbound-order__transport-icon">{renderLaunchHireStepIcon("truck")}</span>
                        <span className="inbound-order__transport-text">
                          <span className="inbound-order__transport-title">Transportation required</span>
                          <span className="inbound-order__transport-hint">Arrange a vehicle and driver for this order</span>
                        </span>
                        <input
                          type="checkbox"
                          className="inbound-order__switch"
                          checked={!!order.transportation}
                          onChange={(e) => handleOrderChange(order.id, "transportation", e.target.checked)}
                        />
                      </label>

                      {order.transportation && (
                        <div className="inbound-order__transport-body">
                          <div className="inbound-order__grid">
                            <FormField label="Type of Vehicle *">
                              <PremiumSelect
                                value={order.typeOfVehicle}
                                onChange={(e) => {
                                  handleOrderChange(order.id, "typeOfVehicle", e.target.value);
                                  clearFormError(`o${index}_typeOfVehicle`);
                                }}
                                options={mergeOptionForValue(materialVehicleOptions, order.typeOfVehicle)}
                                placeholder="Select vehicle"
                                searchPlaceholder="Search vehicle..."
                                hasError={!!formErrors[`o${index}_typeOfVehicle`]}
                              />
                              <FieldError message={formErrors[`o${index}_typeOfVehicle`]} />
                            </FormField>

                            <FormField label="Driver Name *">
                              <PremiumSelect
                                value={order.driverName}
                                onChange={(e) => {
                                  handleOrderChange(order.id, "driverName", e.target.value);
                                  clearFormError(`o${index}_driverName`);
                                }}
                                options={mergeOptionForValue(materialDriverOptions, order.driverName)}
                                placeholder="Select driver"
                                searchPlaceholder="Search driver..."
                                hasError={!!formErrors[`o${index}_driverName`]}
                              />
                              <FieldError message={formErrors[`o${index}_driverName`]} />
                            </FormField>
                          </div>

                          <div className="inbound-order__route">
                            <FormField label="From Location *">
                              <PremiumSelect
                                value={order.fromLocation}
                                onChange={(e) => {
                                  handleOrderChange(order.id, "fromLocation", e.target.value);
                                  clearFormError(`o${index}_fromLocation`);
                                }}
                                options={mergeOptionForValue(transportLocationOptions, order.fromLocation)}
                                placeholder="Select from"
                                searchPlaceholder="Search location..."
                                hasError={!!formErrors[`o${index}_fromLocation`]}
                              />
                              <FieldError message={formErrors[`o${index}_fromLocation`]} />
                            </FormField>

                            <span className="inbound-order__route-arrow" aria-hidden="true">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </span>

                            <FormField label="To Location *">
                              <PremiumSelect
                                value={order.toLocation}
                                onChange={(e) => {
                                  handleOrderChange(order.id, "toLocation", e.target.value);
                                  clearFormError(`o${index}_toLocation`);
                                }}
                                options={mergeOptionForValue(transportLocationOptions, order.toLocation)}
                                placeholder="Select to"
                                searchPlaceholder="Search location..."
                                hasError={!!formErrors[`o${index}_toLocation`]}
                              />
                              <FieldError message={formErrors[`o${index}_toLocation`]} />
                            </FormField>
                          </div>

                          <FormField label="Pick-Up From *">
                            <LocationAutocomplete
                              value={order.pickUpFrom}
                              onChange={(e) => {
                                handleOrderChange(order.id, "pickUpFrom", e.target.value);
                                clearFormError(`o${index}_pickUpFrom`);
                              }}
                              placeholder="Enter pick-up location..."
                            />
                            <FieldError message={formErrors[`o${index}_pickUpFrom`]} />
                          </FormField>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <button type="button" className="inbound-orders__add" onClick={handleAddNewOrder}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Add another order
          </button>
        </div>
      </FormGroup>

      {showLaunchHire && (
        <FormGroup icon="LAUNCH_HIRE" label="Launch Hire" accent={MATERIAL_ACCENT}>
          <FormField>
            <CheckboxField
              label="Launch hire required"
              checked={formData.launchHire}
              onChange={(e) => handleFormChange("launchHire", e.target.checked)}
              disabled={!!editingOrder}
            />
          </FormField>
          {formData.launchHire && (
            <FieldRow>
              <FormField label="Location">
                <PremiumSelect
                  value={formData.launchHireLocation}
                  onChange={(e) => handleFormChange("launchHireLocation", e.target.value)}
                  options={mergeOptionForValue(launchHireLocationOptions, formData.launchHireLocation)}
                  placeholder="Select location"
                  searchPlaceholder="Search location..."
                />
              </FormField>
              <FormField label="Booking Date Time *">
                <div className="transport-date-time-field">
                  <DateTimePickerField
                    dateValue={formData.launchHireDate}
                    timeValue={formData.launchHireTime}
                    onDateTimeChange={(nextValues) => {
                      setFormData((prev) => ({
                        ...prev,
                        launchHireDate: nextValues.date,
                        launchHireTime: nextValues.time,
                      }));
                      clearFormError("launchHireDate");
                    }}
                    dateFieldName="launchHireDate"
                    timeFieldName="launchHireTime"
                    placeholder="Select date and time"
                  />
                </div>
                <FieldError message={formErrors.launchHireDate} />
              </FormField>
            </FieldRow>
          )}
        </FormGroup>
      )}

      <FormGroup icon="notebook" label="Remarks" accent={MATERIAL_ACCENT}>
        <div className="cgpass-remarks">
          <FormField>
            <ReactQuillEditor
              value={formData.remarks || ""}
              onChange={(e) => handleFormChange("remarks", e.target.value)}
              placeholder="Enter remarks..."
              name="remarks"
            />
          </FormField>
        </div>
      </FormGroup>
    </form>
  );

  // Left-hand form card footer (was the modal footer). Cancel only shows in edit mode.
  const renderFormFooter = () => (
    <div className="form-save-button-wrapper cgpass-save-footer material-note-save-footer">
      <button type="button" onClick={handleReset} className="material-note-ghost-action">
        Reset
      </button>
      <div className="material-note-footer-actions">
        {editingOrder && (
          <button type="button" onClick={resetInboundForm} className="material-note-ghost-action">
            Cancel
          </button>
        )}
        <button
          type="submit"
          form="inboundOrderForm"
          disabled={isSubmitting || isBeingUpdated}
          className="form-save-button"
        >
          {editingOrder ? (isBeingUpdated ? "Updating..." : "Update") : (isSubmitting ? "Saving..." : "Save")}
        </button>
      </div>
    </div>
  );

  // Convert to Landing Modal Render Functions
  const renderConvertHeader = () => (
    <>
      <h1 className="modal-title">Convert to Landing Note</h1>
    </>
  );

  const renderConvertBody = () => (
    <div className="modal-body">
      <div className="lead-form">
        <form id="convertToLandingForm" className="material-edit-form" onSubmit={handleConvertSubmit}>
          {/* Basic Details Section */}
          <div className="dispatch-edit-section">
            <h3 className="dispatch-edit-section-title">Basic Details</h3>
            <div className="row mb-lg-3">
              <div className="col-md-6 mb-3">
                <FormField label="Date *">
                  <DateTimePickerField
                    dateValue={convertFormData.date}
                    timeValue={convertFormData.time}
                    onDateTimeChange={(nextValues) => {
                      setConvertFormData((prev) => ({ ...prev, date: nextValues.date, time: nextValues.time }));
                      if (convertFormErrors.date) setConvertFormErrors((p) => { const n = { ...p }; delete n.date; return n; });
                    }}
                    dateFieldName="date"
                    timeFieldName="time"
                    placeholder="DD/MM/YYYY HH:mm"
                    hasError={!!convertFormErrors.date}
                    minDate={convertMinDate}
                  />
                </FormField>
                {convertFormErrors.date && <span className="dispatch-edit-error">{convertFormErrors.date}</span>}
              </div>

              <div className="col-md-6 mb-3">
                <FormField label="Warehouse">
                  <FormSelect
                    value={convertFormData.warehouse}
                    onChange={(e) => handleConvertFormChange("warehouse", e.target.value)}
                    options={mergeOptionForValue(warehouseLocationOptions, convertFormData.warehouse)}
                    placeholder="Select warehouse"
                    disabled
                  />
                </FormField>
              </div>
            </div>

            {/* Receipt Details Section */}
            <div className="dispatch-transport-section">
              <h3 className="dispatch-edit-section-title">Receipt Details</h3>
              <div className="row mb-3">
                <div className="col-md-6 mb-3">
                  <FormField label="Received From *">
                    <FormInput
                      type="text"
                      value={convertFormData.receivedFrom}
                      onChange={(e) => { handleConvertFormChange("receivedFrom", e.target.value); setConvertFormErrors((p) => { const n = { ...p }; delete n.receivedFrom; return n; }); }}
                      placeholder="Enter received from..."
                      className={convertFormErrors.receivedFrom ? "is-invalid" : ""}
                    />
                  </FormField>
                  {convertFormErrors.receivedFrom && <span className="dispatch-edit-error">{convertFormErrors.receivedFrom}</span>}
                </div>

                <div className="col-md-6 mb-3">
                  <FormField label="Signature">
                    <FormInput
                      type="text"
                      value={convertFormData.signature}
                      onChange={(e) => handleConvertFormChange("signature", e.target.value)}
                      placeholder="Enter signature..."
                    />
                  </FormField>
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-6 mb-3">
                  <FormField label="Location *">
                    <FormInput
                      type="text"
                      value={convertFormData.location}
                      onChange={(e) => { handleConvertFormChange("location", e.target.value); setConvertFormErrors((p) => { const n = { ...p }; delete n.location; return n; }); }}
                      placeholder="Enter location..."
                      className={convertFormErrors.location ? "is-invalid" : ""}
                    />
                  </FormField>
                  {convertFormErrors.location && <span className="dispatch-edit-error">{convertFormErrors.location}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Order Details Section */}
          <div className="dispatch-edit-section">
            <div className="dispatch-section-header">
              <h3 className="dispatch-edit-section-title">Order Details</h3>
              <button type="button" onClick={handleAddNewConvertOrder} className="dispatch-add-order-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Add New Order
              </button>
            </div>

            {convertFormData.orders.map((order, index) => (
              <div key={order.id} className="dispatch-edit-item-card">
                <div className="dispatch-edit-item-header" onClick={() => toggleConvertOrderExpand(order.id)}>
                  <span className="dispatch-edit-item-label">Order {index + 1}</span>
                  <div className="dispatch-item-actions">
                    {!order.inbound_item_id && (
                      <span
                        className="delete"
                        onClick={(e) => { e.stopPropagation(); handleRemoveConvertOrder(order.id); }}
                      >
                        <img src={deleteIcon} alt="delete" />
                      </span>
                    )}
                    <svg
                      width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
                      className={`dispatch-edit-chevron${expandedConvertOrders[order.id] ? " expanded" : ""}`}
                    >
                      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                {expandedConvertOrders[order.id] && (
                  <div className="dispatch-edit-item-body">
                    <div className="row g-2 mb-2">
                      <div className="col-lg-4 col-md-6">
                        <FormField label="Order No">
                          <FormInput
                            type="text"
                            value={order.orderNo}
                            onChange={(e) => handleConvertOrderChange(order.id, "orderNo", e.target.value)}
                            placeholder="Enter order number..."
                            disabled={!!order.inbound_item_id}
                          />
                        </FormField>
                      </div>

                      <div className="col-lg-4 col-md-6">
                        <FormField label="PO/DO">
                          <FormInput
                            type="text"
                            value={order.poDo}
                            onChange={(e) => handleConvertOrderChange(order.id, "poDo", e.target.value)}
                            placeholder="Enter PO/DO number..."
                            disabled={!!order.inbound_item_id}
                          />
                        </FormField>
                      </div>

                      <div className="col-lg-4 col-md-6">
                        <FormField label="Quantity *">
                          <FormInput
                            type="number"
                            value={order.quantity}
                            onChange={(e) => handleConvertOrderChange(order.id, "quantity", e.target.value)}
                            placeholder="Enter quantity..."
                            className={convertFormErrors[`co${index}_quantity`] ? "is-invalid" : ""}
                            disabled={!!order.inbound_item_id}
                          />
                        </FormField>
                        {convertFormErrors[`co${index}_quantity`] && <span className="dispatch-edit-error">{convertFormErrors[`co${index}_quantity`]}</span>}
                      </div>

                      <div className="col-lg-6 col-md-12">
                        <FormField label="Description">
                          <FormInput
                            type="text"
                            value={order.description}
                            onChange={(e) => handleConvertOrderChange(order.id, "description", e.target.value)}
                            placeholder="Enter description..."
                            disabled={!!order.inbound_item_id}
                          />
                        </FormField>
                      </div>

                      <div className="col-lg-6 col-md-12">
                        <FormField label="Package Type">
                          <FormSelect
                            value={order.packageType}
                            onChange={(e) => handleConvertOrderChange(order.id, "packageType", e.target.value)}
                            options={mergeOptionForValue(packageTypeOptions, order.packageType)}
                            placeholder="Select package type..."
                            disabled={!!order.inbound_item_id}
                          />
                        </FormField>
                      </div>
                    </div>

                    {/* Transportation Section */}
                    <div className="dispatch-transport-section">
                      <div className="dispatch-edit-checkbox-group">
                        <label className="dispatch-edit-checkbox-label">
                          <input
                            type="checkbox"
                            className="dispatch-edit-checkbox"
                            checked={order.transportation || false}
                            onChange={(e) => handleConvertOrderChange(order.id, "transportation", e.target.checked)}
                            disabled
                          />
                          <span>Transportation</span>
                        </label>
                      </div>

                      {order.transportation && (
                        <div className="row g-2 mb-1">
                          <div className="col-lg-4 col-md-6">
                            <FormField label="Type of Vehicle">
                              <FormSelect
                                value={order.typeOfVehicle}
                                onChange={(e) => handleConvertOrderChange(order.id, "typeOfVehicle", e.target.value)}
                                options={mergeOptionForValue(materialVehicleOptions, order.typeOfVehicle)}
                                placeholder="Select type of vehicle..."
                                disabled={!!order.inbound_item_id}
                              />
                            </FormField>
                          </div>

                          <div className="col-lg-4 col-md-6">
                            <FormField label="From Location">
                              <FormSelect
                                value={order.fromLocation}
                                onChange={(e) => handleConvertOrderChange(order.id, "fromLocation", e.target.value)}
                                options={mergeOptionForValue(transportLocationOptions, order.fromLocation)}
                                placeholder="Select from location..."
                                disabled={!!order.inbound_item_id}
                              />
                            </FormField>
                          </div>

                          <div className="col-lg-4 col-md-6">
                            <FormField label="Pick-Up From">
                              <FormInput
                                type="text"
                                value={order.pickUpFrom}
                                onChange={(e) => handleConvertOrderChange(order.id, "pickUpFrom", e.target.value)}
                                placeholder="Enter pick-up location..."
                                disabled={!!order.inbound_item_id}
                              />
                            </FormField>
                          </div>

                          <div className="col-lg-4 col-md-6">
                            <FormField label="To Location">
                              <FormSelect
                                value={order.toLocation}
                                onChange={(e) => handleConvertOrderChange(order.id, "toLocation", e.target.value)}
                                options={mergeOptionForValue(transportLocationOptions, order.toLocation)}
                                placeholder="Select to location..."
                                disabled={!!order.inbound_item_id}
                              />
                            </FormField>
                          </div>

                          <div className="col-lg-4 col-md-6">
                            <FormField label="Driver Name">
                              <FormSelect
                                value={order.driverName}
                                onChange={(e) => handleConvertOrderChange(order.id, "driverName", e.target.value)}
                                options={mergeOptionForValue(materialDriverOptions, order.driverName)}
                                placeholder="Select driver name..."
                                disabled={!!order.inbound_item_id}
                              />
                            </FormField>
                          </div>
                        </div>
                      )}

                      {/* Slot No, Reason, Dispatch Date - After Transportation */}
                      <div className="row g-2 mb-1 slot-reason-row">
                        <div className="col-lg-4 col-md-6">
                          <FormField label="Slot No *">
                            <FormSelect
                              value={order.slotNo}
                              onChange={(e) => handleConvertOrderChange(order.id, "slotNo", e.target.value)}
                              options={slotNoOptions}
                              placeholder="Select slot no..."
                              className={convertFormErrors[`co${index}_slotNo`] ? "is-invalid" : ""}
                            />
                          </FormField>
                          {convertFormErrors[`co${index}_slotNo`] && <span className="dispatch-edit-error">{convertFormErrors[`co${index}_slotNo`]}</span>}
                        </div>

                        <div className="col-lg-4 col-md-6">
                          <FormField label="Reason">
                            <FormSelect
                              value={order.reason}
                              onChange={(e) => handleConvertOrderChange(order.id, "reason", e.target.value)}
                              options={reasonOptions}
                              placeholder="Select reason..."
                            />
                          </FormField>
                        </div>

                        <div className="col-lg-4 col-md-6">
                          <FormField label="Dispatch Date *" className="dispatch-date-plain">
                            <DateTimePickerField
                              dateValue={order.dispatchDate}
                              timeValue={order.dispatchTime}
                              onDateTimeChange={(v) => {
                                handleConvertOrderChange(order.id, "dispatchDate", v.date);
                                handleConvertOrderChange(order.id, "dispatchTime", v.time);
                              }}
                              dateFieldName="dispatchDate"
                              timeFieldName="dispatchTime"
                              placeholder="DD/MM/YYYY HH:mm"
                            />
                          </FormField>
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Documents & Remarks Section - Outside Order Details */}
          <div className="dispatch-edit-section dispatch-edit-section--last">
            <h3 className="dispatch-edit-section-title">Documents & Remarks</h3>

            {/* Document Upload - Full Width */}
            <div className="mb-2">
              <FormField label="Document Upload">
                <AttachmentsList
                  attachments={convertFormData.documents || []}
                  onAdd={() => { }}
                  onRemove={handleDocumentsRemove}
                  cardColor={cardColor}
                  isDragging={isDraggingDocuments}
                  onDragEnter={handleDocumentsDragEnter}
                  onDragLeave={handleDocumentsDragLeave}
                  onDragOver={handleDocumentsDragOver}
                  onDrop={handleDocumentsDrop}
                  fileInputRef={documentsFileInputRef}
                  onFileInputChange={handleDocumentsFileInputChange}
                />
              </FormField>
            </div>

            {/* Remarks - Full Width, Below Document Upload */}
            <div className="mb-3">
              <div className="card-description-wrapper">
                <FormField label="Remarks">
                  <ReactQuillEditor
                    value={convertFormData.remarks || ""}
                    onChange={(e) => handleConvertFormChange("remarks", e.target.value)}
                    placeholder="Enter remarks..."
                    name="remarks"
                  />
                </FormField>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  const renderConvertFooter = () => (
    <div className="modal-footer">
      <button type="button" onClick={handleCloseConvertModal} className="btn btn-secondary">
        Cancel
      </button>
      <button type="submit" form="convertToLandingForm" disabled={isBeingConverted} className="btn btn-primary">
        {isBeingConverted ? "Converting..." : "Convert"}
      </button>
    </div>
  );

  // View Order Modal Render Functions
  const renderViewHeader = () => (
    <>
      <h1 className="modal-title">View Inbound Order Details</h1>
    </>
  );

  const renderViewBody = () => {
    if (isLoadingView) {
      return (
        <div className="modal-body">
          <CardTabListLoading message="Loading..." cardColor={cardColor} />
        </div>
      );
    }

    if (!viewingOrder) return null;

    const items = Array.isArray(viewingOrder.items) ? viewingOrder.items : [];

    return (
      <div className="modal-body">
        <div className="lead-form">
          <div className="landing-view-basic-section mb-4">
            <h3 className="landing-view-section-title">
              <span className="landing-view-section-icon landing-view-section-icon--info">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 8h.01M11 12h1v5h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span>Basic Details</span>
            </h3>
            <div className="landing-view-info-grid">
              {[
                { key: "inbound_no", icon: "hash", label: "Inbound No", value: viewingOrder.inbound_no || "-" },
                { key: "date", icon: "calendar", label: "Date", value: formatDate(viewingOrder.inbound_date, viewingOrder.inbound_time || viewingOrder.time) || "-" },
                { key: "warehouse", icon: "building", label: "Warehouse", value: warehouseLocationOptions.find((o) => o.value === String(viewingOrder.warehouse_id))?.label || "-" },
                { key: "remarks", icon: "note", label: "Remarks", value: viewingOrder.remarks || "-" },
              ].map((field, index) => (
                <div key={field.key} className="landing-view-info-card" style={{ "--stagger-index": index }}>
                  <span className="landing-view-info-icon">
                    {renderLaunchHireStepIcon(field.icon)}
                  </span>
                  <div className="landing-view-info-body">
                    <span className="landing-view-info-label">{field.label}</span>
                    <span className="landing-view-info-value">{field.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {viewingOrder.launch_hire && (() => {
            const statusTone = launchHireStatusTone(viewingOrder.launch_hire.status);
            return (
              <div className="dispatch-edit-section dispatch-launch-hire-section mb-4">
                <h3 className="dispatch-edit-section-title dispatch-launch-hire-title">
                  <span className="dispatch-launch-hire-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 15h18l-2 5H5l-2-5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M12 3v12M9 6l3-3 3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M2 15c2-2.5 4-3.5 10-3.5s8 1 10 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span>Launch Hire</span>
                </h3>
                <div className="dispatch-launch-hire-card">
                  <div className="dispatch-launch-hire-steps">
                    {[
                      { key: "booking", icon: "clock", label: "Booking Date/Time", value: formatDate(viewingOrder.launch_hire.booking_datetime) || "-" },
                      { key: "location", icon: "pin", label: "Location", value: viewingOrder.launch_hire.location || "-" },
                      { key: "status", icon: launchHireStatusIcon(statusTone), label: "Status", value: viewingOrder.launch_hire.status || "-", tone: statusTone },
                      ...(viewingOrder.launch_hire.remarks ? [{ key: "remarks", icon: "note", label: "Remarks", value: viewingOrder.launch_hire.remarks }] : []),
                    ].map((step, index) => {
                      const isEmpty = step.value === "-";
                      return (
                        <div
                          key={step.key}
                          className={`dispatch-launch-hire-step${isEmpty ? " dispatch-launch-hire-step--empty" : ""}`}
                          style={{ "--stagger-index": index }}
                        >
                          <span className="dispatch-launch-hire-step-icon-wrap">
                            <span className={`dispatch-launch-hire-step-icon${step.tone ? ` dispatch-launch-hire-step-icon--${step.tone}` : ""}`}>
                              {renderLaunchHireStepIcon(step.icon)}
                            </span>
                            <span className="dispatch-launch-hire-step-num">{index + 1}</span>
                          </span>
                          <span className="dispatch-launch-hire-step-body">
                            <span className="dispatch-launch-hire-step-label">{step.label}</span>
                            <span className="dispatch-launch-hire-step-value">{step.value}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {items.length > 0 && (
            <div className="landing-view-items-section">
              <h4 className="landing-view-section-title mb-3">
                <span className="landing-view-section-icon landing-view-section-icon--items">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 8l-9-5-9 5 9 5 9-5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 8v8l9 5 9-5V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12 13v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                <span>Order Items</span>
                <span className="landing-view-count-badge">{items.length}</span>
              </h4>
              {items.map((item, idx) => (
                <div
                  key={item.inbound_item_id || idx}
                  className="landing-view-item-card landing-view-item-card--animated"
                  style={{ "--stagger-index": idx }}
                >
                  <div className="landing-view-item-title landing-view-item-title--iconic">
                    <span className="landing-view-item-icon">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20.5 7.5L12 3 3.5 7.5 12 12l8.5-4.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M3.5 7.5v9L12 21l8.5-4.5v-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span>Item {idx + 1}{item.order_no ? ` — ${item.order_no}` : ""}</span>
                  </div>
                  <div className="landing-view-info-grid landing-view-info-grid--items mb-3">
                    {[
                      { key: "po_do", icon: "hash", label: "PO/DO", value: item.po_do_no ?? item.po_no ?? "-" },
                      { key: "quantity", icon: "list", label: "Quantity", value: item.quantity ?? "-" },
                      {
                        key: "package_type",
                        icon: "package",
                        label: "Package Type",
                        value: item.package_type || packageTypeOptions.find((o) => o.value === String(item.package_type_id))?.label || "-",
                      },
                      ...(item.description ? [{ key: "description", icon: "note", label: "Description", value: item.description }] : []),
                    ].map((field, fieldIdx) => (
                      <div
                        key={field.key}
                        className="landing-view-info-card landing-view-info-card--items"
                        style={{ "--stagger-index": fieldIdx }}
                      >
                        <span className="landing-view-info-icon landing-view-info-icon--items">
                          {renderLaunchHireStepIcon(field.icon)}
                        </span>
                        <div className="landing-view-info-body">
                          <span className="landing-view-info-label">{field.label}</span>
                          <span className="landing-view-info-value">{field.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {Number(item.transportation_required) === 1 && item.transportation && (
                    <div className="landing-view-sub-section landing-view-sub-section--transport-card">
                      <div className="landing-view-sub-title landing-view-sub-title--iconic">
                        <span className="landing-view-section-icon landing-view-section-icon--transport landing-view-section-icon--sm">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2 8h11v8H2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                            <path d="M13 11h4l3 3v2h-7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                            <circle cx="6" cy="18" r="1.8" stroke="currentColor" strokeWidth="2" />
                            <circle cx="17" cy="18" r="1.8" stroke="currentColor" strokeWidth="2" />
                          </svg>
                        </span>
                        <span>Transportation</span>
                      </div>
                      {(() => {
                        const driverStep = {
                          key: "driver",
                          icon: "user",
                          label: "Driver Name",
                          value: item.transportation.driver_name ||
                            materialDriverOptions.find((o) => o.value === String(item.transportation.driver_id))?.label ||
                            item.transportation.driver_id ||
                            "-",
                        };
                        const isDriverEmpty = driverStep.value === "-";
                        const routeSteps = [
                          {
                            key: "vehicle",
                            icon: "truck",
                            label: "Type of Vehicle",
                            value: item.transportation.vehicle_type_name ||
                              materialVehicleOptions.find((o) => o.value === String(item.transportation.vehicle_type_id))?.label ||
                              item.transportation.vehicle_type_id ||
                              "-",
                          },
                          {
                            key: "from",
                            icon: "pin",
                            label: "From Location",
                            value: item.transportation.from_location_name ||
                              transportLocationOptions.find((o) => o.value === String(item.transportation.from_location_id))?.label ||
                              item.transportation.from_location_id ||
                              "-",
                          },
                          {
                            key: "pickup",
                            icon: "target",
                            label: "Pick-Up From",
                            value: item.transportation.pickup_location || "-",
                          },
                          {
                            key: "to",
                            icon: "flag",
                            label: "To Location",
                            value: item.transportation.to_location_name ||
                              transportLocationOptions.find((o) => o.value === String(item.transportation.to_location_id))?.label ||
                              item.transportation.to_location_id ||
                              "-",
                          },
                        ];
                        return (
                          <>
                            <div className="landing-view-transport-driver-row">
                              <div className={`landing-view-transport-step${isDriverEmpty ? " landing-view-transport-step--empty" : ""}`}>
                                <span className="landing-view-transport-step-icon-wrap">
                                  <span className="landing-view-transport-step-icon">
                                    {renderLaunchHireStepIcon(driverStep.icon)}
                                  </span>
                                </span>
                                <div className="landing-view-transport-step-body">
                                  <span className="landing-view-transport-step-label">{driverStep.label}</span>
                                  <span className="landing-view-transport-step-value">{driverStep.value}</span>
                                </div>
                              </div>
                            </div>
                            <div className="landing-view-transport-steps">
                              {routeSteps.map((step, stepIdx, steps) => {
                                const isEmpty = step.value === "-";
                                return (
                                  <Fragment key={step.key}>
                                    <div
                                      className={`landing-view-transport-step${isEmpty ? " landing-view-transport-step--empty" : ""}`}
                                      style={{ "--stagger-index": stepIdx }}
                                    >
                                      <span className="landing-view-transport-step-icon-wrap">
                                        <span className="landing-view-transport-step-icon">
                                          {renderLaunchHireStepIcon(step.icon)}
                                        </span>
                                        <span className="landing-view-transport-step-num">{stepIdx + 1}</span>
                                      </span>
                                      <div className="landing-view-transport-step-body">
                                        <span className="landing-view-transport-step-label">{step.label}</span>
                                        <span className="landing-view-transport-step-value">{step.value}</span>
                                      </div>
                                    </div>
                                    {stepIdx < steps.length - 1 && (
                                      <div className="landing-view-transport-track" aria-hidden="true" style={{ "--stagger-index": stepIdx }}>
                                        <span className="landing-view-transport-track-line" />
                                        <span className="landing-view-transport-track-truck">
                                          {renderLaunchHireStepIcon("truck")}
                                        </span>
                                      </div>
                                    )}
                                  </Fragment>
                                );
                              })}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderViewFooter = () => (
    <div className="modal-footer">
      <button type="button" onClick={handleCloseViewModal} className="btn btn-secondary">
        Close
      </button>
      {viewingOrder && canPrintInbound && (
        <button
          type="button"
          onClick={() => handlePrintOrder(viewingOrder)}
          disabled={Boolean(printingId)}
          className="btn btn-primary"
        >
          {printingId
            ? <span className="btn-spinner-content"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="icon-spinning"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" /></svg>Printing...</span>
            : "Print"
          }
        </button>
      )}
    </div>
  );

  return (
    <div className="cardform-left-full" style={{ "--card-color": cardColor }}>
      <FormSection icon={GroupSettingsIcon} title="">
        <div className="pre-arrival-form material-notes-form inbound-orders-form">
          <div className={`general-info-two-column operation-section-form-layout crew-pass-premium-grid${showFormCard ? "" : " material-notes-grid--list-only"}`}>
            {showFormCard && (
              <div className="general-info-left crew-pass-premium-left">
                <div className={`crew-pass-request-details-card husb-accent-${MATERIAL_ACCENT}`}>
                  <PremiumCardHeader
                    icon={MAIN_TABS.MATERIAL_MANAGEMENT}
                    title={editingOrder ? `Edit inbound order${editingOrderLabel ? ` ${editingOrderLabel}` : ""}` : "New inbound order"}
                    subtitle={editingOrder ? "Update the order details and save your changes" : "Register materials expected at the warehouse"}
                    headerClassName="crew-pass-request-details-card__header"
                    titleClassName="crew-pass-request-details-card__title"
                  />
                  <div
                    ref={formBodyRef}
                    className="crew-pass-request-details-card__body crew-pass-form-fields crew-pass-thin-scrollbar"
                  >
                    {renderFormBody()}
                  </div>
                  {renderFormFooter()}
                </div>
              </div>
            )}

            <div className="general-info-right crew-pass-requests-sidebar">
              <div className={`crew-pass-requests-table-card husb-accent-${MATERIAL_ACCENT} inbound-list-card`} role="region" aria-label="Inbound orders">
                <PremiumCardHeader
                  icon="list"
                  title="Inbound orders"
                  subtitle="All inbound orders for this job"
                  count={inboundTotal || undefined}
                  headerClassName="crew-pass-requests-table-card__header"
                  titleClassName="crew-pass-requests-table-card__title"
                />

                <div className="crew-pass-requests-table-card__body">
                  {isLoadingOrders ? (
                    <div className="crew-pass-requests-table-card__skeleton" aria-busy="true">
                      <Skeleton height={14} borderRadius={6} count={1} style={{ marginBottom: 12 }} />
                      <Skeleton height={36} borderRadius={6} count={6} />
                    </div>
                  ) : inboundOrders.length === 0 ? (
                    <div className="crew-pass-requests-table-card__empty">No inbound orders found</div>
                  ) : (
                    <div className="crew-pass-requests-table-scroll crew-pass-thin-scrollbar">
                      <table className="inbound-table">
                        <colgroup>
                          <col className="inbound-table__col-order" />
                          <col className="inbound-table__col-date" />
                          <col />
                          <col className="inbound-table__col-warehouse" />
                          <col className="inbound-table__col-actions" />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>Order no.</th>
                            <th aria-sort={dateSortAsc ? "ascending" : "descending"}>
                              <button
                                type="button"
                                className="inbound-table__sort"
                                onClick={() => setDateSortAsc((v) => !v)}
                              >
                                Date
                                {dateSortAsc ? <FiArrowUp size={12} aria-hidden="true" /> : <FiArrowDown size={12} aria-hidden="true" />}
                              </button>
                            </th>
                            <th>Package</th>
                            <th>Warehouse</th>
                            <th className="inbound-table__actions-th">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleOrders.map((order, orderIdx) => {
                            const inboundId = resolveInboundId(order);
                            const rowKey = inboundId ?? `inbound-${orderIdx}`;
                            const items = Array.isArray(order.items) ? order.items : [];
                            const firstItem = items[0] || null;
                            const extraItems = Math.max(0, items.length - 1);
                            const packageLabel = firstItem ? itemPackageLabel(firstItem) : "";
                            const warehouseLabel = warehouseLocationOptions.find(
                              (o) => o.value === String(order.warehouse_id ?? "")
                            )?.label;
                            const isEditingRow = editingInboundId != null && inboundId === editingInboundId;
                            const orderNo = String(order.inbound_no || "");
                            const splitAt = orderNo.lastIndexOf("-");
                            const orderPrefix = splitAt > 0 ? orderNo.slice(0, splitAt + 1) : "";
                            const orderTail = splitAt > 0 ? orderNo.slice(splitAt + 1) : orderNo;
                            const dateInfo = orderDateParts(order);
                            const emptyCell = <span className="inbound-table__muted">—</span>;
                            return (
                              <tr key={rowKey} className={isEditingRow ? "is-editing" : undefined}>
                                <td>
                                  {orderNo ? (
                                    <div className="inbound-table__order">
                                      <span className="inbound-table__order-no" title={orderNo}>
                                        {orderPrefix && <span className="inbound-table__order-prefix">{orderPrefix}</span>}
                                        <span className="inbound-table__order-tail">{orderTail}</span>
                                      </span>
                                      <button
                                        type="button"
                                        className="inbound-table__copy"
                                        onClick={() => handleCopyOrderNo(orderNo)}
                                        data-tip="Copy"
                                        aria-label={`Copy order number ${orderNo}`}
                                      >
                                        <FiCopy size={13} />
                                      </button>
                                      {isEditingRow && <span className="inbound-table__editing">Editing</span>}
                                    </div>
                                  ) : emptyCell}
                                </td>
                                <td>
                                  {dateInfo ? (
                                    <div className="inbound-table__stack">
                                      <span className="inbound-table__primary">{dateInfo.date}</span>
                                      <span className="inbound-table__secondary">{dateInfo.sub}</span>
                                    </div>
                                  ) : emptyCell}
                                </td>
                                <td>
                                  {firstItem ? (
                                    <div className="inbound-table__package">
                                      <span className="inbound-table__qty">{formatQty(firstItem.quantity)}</span>
                                      <span className="inbound-table__times" aria-hidden="true">×</span>
                                      <span className="inbound-table__package-name" title={packageLabel || undefined}>
                                        {packageLabel || "Package not set"}
                                      </span>
                                      {extraItems > 0 && (
                                        <>
                                          <span
                                            className="inbound-table__more"
                                            data-tip={`${extraItems} more item${extraItems === 1 ? "" : "s"} — open View`}
                                            tabIndex={0}
                                          >
                                            +{extraItems}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  ) : emptyCell}
                                </td>
                                <td>
                                  <span className="inbound-table__ellipsis" title={warehouseLabel || undefined}>
                                    {warehouseLabel || emptyCell}
                                  </span>
                                </td>
                                <td className="inbound-table__actions-td">
                                  <div className="inbound-table__actions">
                                    {canConvertToLandingNote && (
                                      <button
                                        type="button"
                                        onClick={() => handleConvertToLanding(order)}
                                        className="inbound-table__landing"
                                      >
                                        <FiFileText size={14} aria-hidden="true" />
                                        Landing note
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleViewOrder(order)}
                                      data-tip="View"
                                      className="inbound-table__icon-action"
                                      aria-label="View order"
                                    >
                                      <FiEye size={17} />
                                    </button>
                                    {canPrintInbound && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handlePrintOrder(order)}
                                          data-tip="Print"
                                          disabled={printingId === inboundId}
                                          className="inbound-table__icon-action"
                                          aria-label="Print order"
                                        >
                                          {printingId === inboundId ? (
                                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="icon-spinning">
                                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                                            </svg>
                                          ) : (
                                            <FiPrinter size={17} />
                                          )}
                                        </button>
                                      </>
                                    )}
                                    {(canUpdateInbound || canDeleteInbound) && (
                                      <div className={`action-dropdown-wrapper${openDropdownId === rowKey ? " action-dropdown-wrapper--open" : ""}`}>
                                        <button
                                          type="button"
                                          onClick={(e) => handleToggleDropdown(rowKey, e)}
                                          data-tip="More actions"
                                          className="inbound-table__icon-action"
                                          aria-label="More actions"
                                        >
                                          <FiMoreVertical size={17} />
                                        </button>
                                        {openDropdownId === rowKey && createPortal(
                                          <div
                                            data-dropdown-menu
                                            className="dispatch-note-dropdown-menu"
                                            style={{ top: `${dropdownPosition.top}px`, right: `${dropdownPosition.right}px` }}
                                          >
                                            {canUpdateInbound && (
                                              <button
                                                type="button"
                                                onClick={() => { handleCloseDropdown(); handleEditOrder(order); }}
                                                className="dispatch-note-dropdown-btn"
                                              >
                                                <img src={editIcon} alt="edit" className="dispatch-note-dropdown-icon" />
                                                <span>Edit</span>
                                              </button>
                                            )}
                                            {canDeleteInbound && (
                                              <button
                                                type="button"
                                                onClick={() => { handleDelete(order); }}
                                                className="dispatch-note-dropdown-btn dispatch-note-dropdown-btn--danger"
                                              >
                                                <img src={deleteIcon} alt="delete" className="dispatch-note-dropdown-icon" />
                                                <span>Delete</span>
                                              </button>
                                            )}
                                          </div>,
                                          document.body
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {!isLoadingOrders && inboundOrders.length > 0 && (
                    <div className="inbound-list-footer">
                      <span>
                        {visibleOrders.length} of {inboundTotal || inboundOrders.length} order{(inboundTotal || inboundOrders.length) === 1 ? "" : "s"}
                        {" · "}Total quantity {formatQty(visibleTotalQty)}
                      </span>
                      {inboundTotalPages > 1 && (
                        <div className="inbound-list-pager">
                          <button
                            type="button"
                            className="crew-pass-requests-pagination__btn"
                            disabled={inboundPage <= 1}
                            onClick={() => setInboundPage((p) => Math.max(1, p - 1))}
                            aria-label="Previous page"
                          >
                            <FiChevronLeft size={14} />
                          </button>
                          <span className="inbound-list-pager__label">
                            Page {inboundPage} of {inboundTotalPages}
                          </span>
                          <button
                            type="button"
                            className="crew-pass-requests-pagination__btn"
                            disabled={inboundPage >= inboundTotalPages}
                            onClick={() => setInboundPage((p) => Math.min(inboundTotalPages, p + 1))}
                            aria-label="Next page"
                          >
                            <FiChevronRight size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </FormSection>

      <CustomModal
        className="material-management-modal inbound-orders-modal"
        show={showConvertModal}
        closeModal={handleCloseConvertModal}
        header={renderConvertHeader()}
        body={renderConvertBody()}
        footer={renderConvertFooter()}
        dialgName="modal-dialog modal-dialog-centered"
      />

      <CustomModal
        className="material-management-modal inbound-orders-modal"
        show={showViewModal}
        closeModal={handleCloseViewModal}
        header={renderViewHeader()}
        body={renderViewBody()}
        footer={renderViewFooter()}
        dialgName="modal-dialog modal-dialog-centered"
      />

      <DeleteConfirmationModal
        show={showDeleteModal}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        deleteText={`Are you sure you want to delete inbound order ${deletingOrder?.inbound_no || deletingOrder?.order_no || deletingOrder?.orderNo || `#${deletingOrder?.inbound_id ?? deletingOrder?.id ?? ""}`}?`}
        isLoading={isLoadingDelete}
      />
    </div>
  );
};

InboundOrdersContent.propTypes = {
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
  cardColor: PropTypes.string,
  showLaunchHire: PropTypes.bool,
};

export default InboundOrdersContent;

