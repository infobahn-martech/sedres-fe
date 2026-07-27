import { useState, useRef, useEffect, Fragment } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import CustomModal from "../../../../../../../components/CustomModal";
import { FormField, FormInput, FormSelect, FormTextarea, ReactQuillEditor } from "./Husbandry.components";
import { LAUNCH_HIRE_LOCATION_OPTIONS } from "./Husbandry.constants";
import { splitApiDateTimeParts, nextDayOf } from "../../../../../../../shared/helpers/dateTimeFieldUtils";
import DateTimePickerField from "../../../../shared/components/DateTimePickerField";
import LocationAutocomplete from "./LocationAutocomplete";
import LocationMapPicker from "./LocationMapPicker";
import MaterialTablePagination from "./MaterialTablePagination";
import editIcon from "../../../../../../../assets/images/edit.svg";
import deleteIcon from "../../../../../../../assets/images/delete.svg";
import eyeIcon from "../../../../../../../assets/images/eye.svg";
import useLandingNoteReducer from "../../../../../../../store/LandingNoteReducer";
import useDispatchNoteReducer from "../../../../../../../store/DispatchNoteReducer";
import useAlertReducer from "../../../../../../../store/AlertReducer";
import logisticsWarehouseService from "../../../../../../../services/logisticsWarehouseService";
import vehicleService from "../../../../../../../services/vehicleService";
import inboundOrderService from "../../../../../../../services/inboundOrderService";
import landingNoteService from "../../../../../../../services/landingNoteService";
import "../../../../../../../design/scss/material-edit-form.scss";
import "../../../../../../../design/scss/dispatch-note.scss";

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
          accept="*/*"
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


const getLandingNoteItemId = (item) => (
  item?.landing_note_item_id
  ?? item?.landingNoteItemId
  ?? item?.item_id
  ?? item?.id
  ?? null
);

const toNonNegativeIntegerString = (value) => {
  if (value == null || value === "") return "";
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? String(number) : "";
};

const isTruthyFlag = (value) => value === true || Number(value) === 1 || String(value).toLowerCase() === "true";

const normalizeSlotValue = (value) => {
  if (value == null || value === "") return "";
  const raw = String(value).trim();
  if (/^slot\s+[1-6]$/i.test(raw)) return raw.replace(/^slot\s+/i, "Slot ");
  if (/^[1-6]$/.test(raw)) return `Slot ${raw}`;
  return raw;
};

const getTransportation = (item) => item?.transportation || item?.transport || null;

const getFileUrl = (filePath) => {
  const base = (import.meta.env.VITE_API_ENDPOINT || "").replace(/\/+$/, "");
  const path = (filePath || "").replace(/^\/+/, "");
  return `${base}/${path}`;
};

const isImageFile = (fileName) => /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName || "");

const mergeOptionForValue = (options, value) => {
  if (value == null || value === "") return options;
  const s = String(value);
  if (options.some((o) => o.value === s)) return options;
  return [...options, { value: s, label: s }];
};

// Small icon set for the View Landing Note modal's info/field cards
// (landing-view-info-card, landing-view-section-icon — see dispatch-note.scss).
const renderViewIcon = (icon) => {
  switch (icon) {
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
    case "user":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
          <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "pin":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 22s7-7.05 7-12a7 7 0 1 0-14 0c0 4.95 7 12 7 12Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "signature":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 17c2-1 3-4 4-6 1.5-3 2.5-4 3.5-1 .6 1.7 1.5 1.8 2.5 0 1-1.8 2-1.8 3 0s2 2 4.5-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 20h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
    case "note":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M9 12h6M9 16h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "slot":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="4" width="7" height="16" rx="1.5" stroke="currentColor" strokeWidth="2" />
          <rect x="14" y="4" width="7" height="16" rx="1.5" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "flag":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 21V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M5 4h13l-3 4 3 4H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "box":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 7h16v13H4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M4 7l3-4h10l3 4M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
    case "check":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
};

const emptyConvertItem = () => ({
  id: 1,
  landing_note_item_id: null,
  orderNo: "",
  poDo: "",
  quantity: "",
  maxQty: null,
  dispatchedQty: null,
  dispatchStatus: "",
  packageType: "",
  description: "",
  slot: "",
  reason: "",
  packing_required: false,
  repacking_pallets: "",
  repacking_rolls: "",
  transportation_required: false,
  typeOfVehicle: "",
  fromLocation: "",
  pickUpFrom: "",
  toLocation: "",
  driverName: "",
  transportRemarks: "",
});

const mapLandingNoteForDisplay = (note) => {
  const items = Array.isArray(note?.items) ? note.items : [];
  const firstItem = items[0] || {};
  return {
    ...note,
    id: note?.landing_note_id ?? note?.id,
    landingNoteNo: note?.landing_note_no ?? note?.landingNoteNo ?? "",
    date: note?.landing_date ?? note?.date ?? "",
    poDo: firstItem?.po_no ?? note?.po_no ?? note?.poDo ?? "",
    landingProof: note?.landing_proof ?? note?.landingProof ?? note?.documents ?? [],
    quantity: firstItem?.quantity ?? note?.quantity ?? "",
    packageType: firstItem?.package_type ?? firstItem?.package_type_id ?? note?.packageType ?? "",
    description: firstItem?.description ?? note?.description ?? "",
    items,
  };
};

const buildDispatchConvertOrders = (note, vehicleOpts = [], locationOpts = [], driverOpts = []) => {
  const apiItems = Array.isArray(note?.items) ? note.items : [];
  if (!apiItems.length) {
    return [{
      ...emptyConvertItem(),
      orderNo: note?.landingNoteNo || note?.landing_note_no || "",
      poDo: note?.poDo || note?.po_no || "",
      quantity: note?.quantity ? String(note.quantity) : "",
    }];
  }

  return apiItems.map((item, idx) => {
    const repackingPallets = toNonNegativeIntegerString(item.repacking_pallets ?? item.repacking?.pallets);
    const repackingRolls = toNonNegativeIntegerString(item.repacking_rolls ?? item.repacking?.rolls);
    const transportation = getTransportation(item);
    const remainingQtyRaw = item.remaining_qty;
    const hasRemainingQty = remainingQtyRaw !== undefined && remainingQtyRaw !== null && remainingQtyRaw !== "";
    const maxQty = hasRemainingQty ? Number(remainingQtyRaw) : (item.quantity ? Number(item.quantity) : null);
    const hasTransportData = Boolean(transportation) && Boolean(
      transportation.vehicle_type_id || transportation.vehicle_type_name ||
      transportation.from_location_id || transportation.from_location_name ||
      transportation.to_location_id || transportation.to_location_name ||
      transportation.driver_id || transportation.driver_name ||
      transportation.pickup_location
    );
    return {
      id: idx + 1,
      landing_note_item_id: getLandingNoteItemId(item),
      orderNo: item.order_no || note?.landingNoteNo || note?.landing_note_no || "",
      poDo: item.po_no || note?.poDo || "",
      quantity: hasRemainingQty ? String(remainingQtyRaw) : (item.quantity ? String(item.quantity) : ""),
      maxQty,
      dispatchedQty: item.dispatched_qty ?? null,
      dispatchStatus: item.status ?? "",
      packageType: String(item.package_type_id || ""),
      description: item.description || "",
      slot: normalizeSlotValue(item.slot ?? item.slot_no ?? item.slot_no_id),
      reason: item.reason ?? item.reason_name ?? "",
      packing_required: isTruthyFlag(item.packing_required) || repackingPallets !== "" || repackingRolls !== "",
      repacking_pallets: repackingPallets,
      repacking_rolls: repackingRolls,
      transportation_required: isTruthyFlag(item.transportation_required ?? item.transport_required) || hasTransportData,
      typeOfVehicle: transportation
        ? String(transportation.vehicle_type_id || "") ||
          (vehicleOpts.find((o) => o.label.toLowerCase() === (transportation.vehicle_type_name || "").toLowerCase())?.value || "") ||
          (transportation.vehicle_type_name ? String(transportation.vehicle_type_name) : "")
        : "",
      fromLocation: transportation
        ? String(transportation.from_location_id || "") ||
          (locationOpts.find((o) => o.label.toLowerCase() === (transportation.from_location_name || "").toLowerCase())?.value || "") ||
          (transportation.from_location_name ? String(transportation.from_location_name) : "")
        : "",
      pickUpFrom: transportation?.pickup_location || "",
      toLocation: transportation
        ? String(transportation.to_location_id || "") ||
          (locationOpts.find((o) => o.label.toLowerCase() === (transportation.to_location_name || "").toLowerCase())?.value || "") ||
          (transportation.to_location_name ? String(transportation.to_location_name) : "")
        : "",
      driverName: transportation
        ? String(transportation.driver_id || "") ||
          (driverOpts.find((o) => o.label.toLowerCase() === (transportation.driver_name || "").toLowerCase())?.value || "") ||
          (transportation.driver_name ? String(transportation.driver_name) : "")
        : "",
      transportRemarks: transportation?.remarks || "",
    };
  });
};

const LandingNoteContent = ({ formValues, handleChange, cardColor }) => {
  const {
    convertLandingNote,
    getAllLandingNotes,
    getLandingNotesTotal,
    getLandingNoteById,
    updateLandingNote,
    landingNotes,
    landingTotal,
    isLoadingList,
    isLoadingUpdate,
    isLoadingConvert,
  } = useLandingNoteReducer((state) => state);

  const [warehouseOptions, setWarehouseOptions] = useState([]);
  const [vehicleOptions, setVehicleOptions] = useState([]);
  const [driverOptions, setDriverOptions] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [whRes, vehRes, drvRes, trLocRes] = await Promise.all([
          logisticsWarehouseService.getWarehouseLocations(),
          vehicleService.getMaterialVehicles(),
          vehicleService.getMaterialDrivers(),
          inboundOrderService.getMaterialTransportLocations(),
        ]);
        if (cancelled) return;
        const whRows = Array.isArray(whRes?.data) ? whRes.data : whRes?.data?.data ?? [];
        setWarehouseOptions(whRows.map((r) => ({ value: String(r.location_id ?? ""), label: String(r.location ?? "") })).filter((o) => o.value));
        const vehRows = Array.isArray(vehRes?.data) ? vehRes.data : vehRes?.data?.data ?? [];
        setVehicleOptions(vehRows.map((r) => ({ value: String(r.vehicle_type_id ?? ""), label: String(r.vehicle_name ?? "") })).filter((o) => o.value));
        const drvRows = Array.isArray(drvRes?.data) ? drvRes.data : drvRes?.data?.data ?? [];
        setDriverOptions(drvRows.map((r) => ({ value: String(r.driver_id ?? ""), label: String(r.driver_name ?? "") })).filter((o) => o.value));
        const trLocRows = Array.isArray(trLocRes?.data) ? trLocRes.data : trLocRes?.data?.data ?? [];
        setLocationOptions(trLocRows.map((r) => ({ value: String(r.location_id ?? ""), label: String(r.location ?? "") })).filter((o) => o.value));
      } catch (err) {
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const slotOptions = [
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

  const [showModal, setShowModal] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [printingNoteId, setPrintingNoteId] = useState(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertFormErrors, setConvertFormErrors] = useState({});
  const [showViewModal, setShowViewModal] = useState(false);
  const [notesList, setNotesList] = useState([]);
  const [editingNote, setEditingNote] = useState(null);
  const [convertingNote, setConvertingNote] = useState(null);
  const [convertMinDate, setConvertMinDate] = useState(undefined);
  const [editMinDate, setEditMinDate] = useState(undefined);
  const [viewingNote, setViewingNote] = useState(null);
  const [isDraggingDocuments, setIsDraggingDocuments] = useState(false);
  const documentsFileInputRef = useRef(null);
  const editDocInputRef = useRef(null);
  const [isDraggingEditDocuments, setIsDraggingEditDocuments] = useState(false);
  const [expandedConvertOrders, setExpandedConvertOrders] = useState({ 1: true });
  const [isLoadingConvertDetail, setIsLoadingConvertDetail] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const [landingPage, setLandingPage] = useState(1);
  const LANDING_LIMIT = 10;
  const dropdownButtonRefs = useRef({});

  const [formData, setFormData] = useState({
    landing_date: "",
    landing_time: "",
    warehouse_id: "",
    received_from: "",
    location: "",
    signature: "",
    remarks: "",
    documents: [],
    existingDocuments: [],
    removedDocumentIds: [],
    items: [],
  });
  const [formErrors, setFormErrors] = useState({});
  const [expandedEditItems, setExpandedEditItems] = useState({});

  useEffect(() => {
    const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);
    if (!callId) return;
    getAllLandingNotes({ call_id: callId, page: landingPage, limit: LANDING_LIMIT });
  }, [formValues?.call_id, formValues?.callId, formValues?.card_call_id, landingPage, getAllLandingNotes]);

  useEffect(() => {
    if (Array.isArray(landingNotes) && landingNotes.length > 0) {
      setNotesList(landingNotes.map(mapLandingNoteForDisplay));
      return;
    }
    setNotesList(Array.isArray(formValues.landingNoteList) ? formValues.landingNoteList : []);
  }, [landingNotes, formValues.landingNoteList]);

  const emptyEditFormData = () => ({
    landing_date: "", landing_time: "", warehouse_id: "",
    inbound_id: "", received_from: "", location: "", signature: "",
    remarks: "", documents: [], existingDocuments: [], removedDocumentIds: [], items: [],
  });

  const populateFormFromDetail = (detail) => {
    const { date, time } = splitApiDateTimeParts(detail.landing_date || "");
    const items = Array.isArray(detail.items) ? detail.items.map((item, idx) => {
      const transport = item?.transportation || null;
      return {
        id: idx + 1,
        landing_note_item_id: item.landing_note_item_id || null,
        inbound_item_id: item.inbound_item_id || null,
        order_no: item.order_no || "",
        po_no: item.po_no || "",
        quantity: item.quantity ? String(item.quantity) : "",
        package_type: item.package_type || "",
        description: item.description || "",
        transportation_required: isTruthyFlag(item.transportation_required),
        typeOfVehicle: transport ? String(transport.vehicle_type_id || "") : "",
        fromLocation: transport ? String(transport.from_location_id || "") : "",
        pickUpFrom: transport?.pickup_location || "",
        toLocation: transport ? String(transport.to_location_id || "") : "",
        driverName: transport ? String(transport.driver_id || "") : "",
        slot_no: item.slot_no_id ?? item.slot_no ?? "",
        reason: item.reason_id ?? item.reason ?? item.reason_name ?? "",
        dispatch_date: item.dispatch_date || "",
        dispatch_time: "",
      };
    }) : [];

    const exp = {};
    items.forEach((item) => { exp[item.id] = true; });
    setEditorKey((k) => k + 1);
    setFormData({
      landing_date: date,
      landing_time: time,
      inbound_id: detail.inbound_id ? String(detail.inbound_id) : "",
      warehouse_id: String(detail.warehouse_id || ""),
      received_from: detail.received_from || "",
      location: detail.location || "",
      signature: detail.signature || "",
      remarks: (detail.remarks || "").replace(/<[^>]*>/g, "").trim(),
      documents: [],
      existingDocuments: Array.isArray(detail.documents) ? detail.documents : [],
      removedDocumentIds: [],
      items,
    });
    setExpandedEditItems(exp);

    setEditMinDate(undefined);
    if (detail.inbound_id) {
      inboundOrderService.getInboundById(detail.inbound_id)
        .then(({ data }) => {
          const inboundDetail = data?.data;
          const minDate = nextDayOf(inboundDetail?.inbound_date || inboundDetail?.date);
          if (minDate) setEditMinDate(minDate);
        })
        .catch(() => {});
    }
  };

  const handleOpenModal = (note = null) => {
    if (note) {
      setEditingNote(note);
      setShowModal(true);
      const noteId = note?.landing_note_id ?? note?.id;
      if (noteId != null) {
        getLandingNoteById({
          id: noteId,
          cb: (detail) => { if (detail) populateFormFromDetail(detail); },
        });
      }
      return;
    }
    setEditingNote(null);
    setFormData(emptyEditFormData());
    setExpandedEditItems({});
    setFormErrors({});
    setEditMinDate(undefined);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingNote(null);
    setFormData(emptyEditFormData());
    setExpandedEditItems({});
    setFormErrors({});
    setEditMinDate(undefined);
  };

  const handleEditItemChange = (itemId, field, value) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) => item.id === itemId ? { ...item, [field]: value } : item),
    }));
  };

  const toggleEditItemExpand = (itemId) => {
    setExpandedEditItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const validateEditForm = () => {
    const errors = {};
    if (!formData.landing_date) errors.landing_date = "Date is required";
    if (!formData.received_from) errors.received_from = "Received From is required";
    if (!formData.location) errors.location = "Location is required";
    formData.items.forEach((item, idx) => {
      if (!item.quantity) errors[`item_${idx}_qty`] = "Quantity is required";
      if (item.transportation_required) {
        if (!item.typeOfVehicle) errors[`item_${idx}_veh`] = "Vehicle type is required";
        if (!item.fromLocation) errors[`item_${idx}_from`] = "From location is required";
        if (!item.toLocation) errors[`item_${idx}_to`] = "To location is required";
        if (!item.driverName) errors[`item_${idx}_drv`] = "Driver is required";
      }
    });
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateEditForm()) return;

    const landingNoteId = editingNote?.landing_note_id ?? editingNote?.id;
    const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);
    const fd = new FormData();
    fd.append("landing_date", formData.landing_date + (formData.landing_time ? ` ${formData.landing_time}` : ""));
    if (formData.inbound_id) fd.append("inbound_id", formData.inbound_id);
    fd.append("warehouse_id", formData.warehouse_id || "");
    fd.append("received_from", formData.received_from || "");
    fd.append("location", formData.location || "");
    fd.append("signature", formData.signature || "");
    fd.append("remarks", (formData.remarks || "").replace(/<[^>]*>/g, "").trim());
    (formData.documents || []).forEach((doc) => {
      const file = doc?.file ?? doc;
      if (file) fd.append("file[]", file);
    });
    (formData.removedDocumentIds || []).forEach((id) => fd.append("removed_document_ids[]", id));

    const items = formData.items.map((item) => {
      const result = {
        landing_note_item_id: item.landing_note_item_id || null,
        quantity: Number(item.quantity) || 0,
        transportation_required: item.transportation_required ? 1 : 0,
        slot_no: item.slot_no || "",
        reason: item.reason || "",
        dispatch_date: item.dispatch_date ? item.dispatch_date + (item.dispatch_time ? ` ${item.dispatch_time}` : "") : null,
      };
      if (item.transportation_required) {
        result.transportation = {
          vehicle_type_id: Number(item.typeOfVehicle) || 0,
          from_location_id: Number(item.fromLocation) || 0,
          pickup_location: item.pickUpFrom || "",
          to_location_id: Number(item.toLocation) || 0,
          driver_id: Number(item.driverName) || 0,
        };
      }
      return result;
    });
    fd.append("items", JSON.stringify(items));

    updateLandingNote({
      landingNoteId,
      data: fd,
      cb: () => {
        handleCloseModal();
        if (callId) {
          getAllLandingNotes({ call_id: callId, page: landingPage, limit: LANDING_LIMIT });
          getLandingNotesTotal({ call_id: callId });
        }
      },
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleDelete = (noteId) => {
    if (window.confirm("Are you sure you want to delete this landing note?")) {
      const updatedList = notesList.filter(note => note.id !== noteId);
      setNotesList(updatedList);

      // Update formValues
      const syntheticEvent = { target: { value: updatedList } };
      handleChange("landingNoteList")(syntheticEvent);
    }
  };

  // Form state for Convert to Dispatch modal
  const [convertFormData, setConvertFormData] = useState({
    dispatch_date: "",
    dispatch_time: "",
    warehouse_id: "",
    signature: "",
    delivery_location: "",
    delivered_to: "",
    documents: [],
    remarks: "",
    orders: [emptyConvertItem()],
    launch_hire: false,
    launch_hire_location: "",
    launch_hire_booking_date: "",
    launch_hire_booking_time: "",
  });


  const handleConvertToDispatch = (note) => {
    handleCloseDropdown();
    setConvertingNote(note);
    setConvertMinDate(nextDayOf(note.landing_date || note.date));
    const orders = buildDispatchConvertOrders(note, vehicleOptions, locationOptions, driverOptions);
    const warehouseId = note?.warehouse_id ?? note?.warehouse ?? "";
    const exp = {};
    orders.forEach((o) => { exp[o.id] = true; });
    setConvertFormData({
      dispatch_date: "",
      dispatch_time: "",
      warehouse_id: warehouseId ? String(warehouseId) : "",
      signature: "",
      delivery_location: "",
      delivered_to: "",
      documents: [],
      remarks: "",
      orders,
      launch_hire: false,
      launch_hire_location: "",
      launch_hire_booking_date: "",
      launch_hire_booking_time: "",
    });
    setExpandedConvertOrders(exp);
    setShowConvertModal(true);

    const landingNoteId = note?.landing_note_id ?? note?.id;
    if (landingNoteId != null && getLandingNoteById) {
      setIsLoadingConvertDetail(true);
      getLandingNoteById({
        id: landingNoteId,
        cb: (detail) => {
          setIsLoadingConvertDetail(false);
          if (!detail) return;
          const detailMinDate = nextDayOf(detail.landing_date || detail.date);
          if (detailMinDate) setConvertMinDate(detailMinDate);
          const normalizedDetail = mapLandingNoteForDisplay(detail);
          const detailOrders = buildDispatchConvertOrders(normalizedDetail, vehicleOptions, locationOptions, driverOptions);
          const detailExp = {};
          detailOrders.forEach((o) => { detailExp[o.id] = true; });
          setConvertingNote(normalizedDetail);
          setConvertFormData((prev) => ({
            ...prev,
            warehouse_id: String(normalizedDetail.warehouse_id ?? normalizedDetail.warehouse ?? prev.warehouse_id ?? ""),
            orders: detailOrders,
          }));
          setExpandedConvertOrders(detailExp);
        },
      });
    }
  };

  const handleCloseConvertModal = () => {
    setShowConvertModal(false);
    setConvertingNote(null);
    setConvertMinDate(undefined);
    setConvertFormErrors({});
    setIsLoadingConvertDetail(false);
    setConvertFormData({
      dispatch_date: "",
      dispatch_time: "",
      warehouse_id: "",
      signature: "",
      delivery_location: "",
      delivered_to: "",
      documents: [],
      remarks: "",
      orders: [emptyConvertItem()],
      launch_hire: false,
      launch_hire_location: "",
      launch_hire_booking_date: "",
      launch_hire_booking_time: "",
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

  const handleNonNegativeIntegerChange = (orderId, field, value) => {
    if (value === "" || /^\d+$/.test(value)) {
      handleConvertOrderChange(orderId, field, value);
    }
  };

  const handleAddNewConvertOrder = () => {
    const newOrderId = convertFormData.orders.length > 0
      ? Math.max(...convertFormData.orders.map((o) => o.id)) + 1
      : 1;
    setConvertFormData((prev) => ({
      ...prev,
      orders: [...prev.orders, { ...emptyConvertItem(), id: newOrderId }],
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

  const handleDocumentsDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingDocuments(false);

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      const currentAttachments = convertFormData.documents || [];
      const newAttachments = files.map((file) => ({
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

  const handleDocumentsFileInputChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const currentAttachments = convertFormData.documents || [];
      const newAttachments = files.map((file) => ({
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

  // Handle new-document drag and drop for the Edit Landing Note form
  const handleEditDocumentsDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingEditDocuments(true);
  };

  const handleEditDocumentsDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingEditDocuments(false);
  };

  const handleEditDocumentsDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const addEditDocuments = (files) => {
    if (!files.length) return;
    const currentAttachments = formData.documents || [];
    const newAttachments = files.map((file) => ({
      name: file.name,
      file: file,
      size: file.size,
      type: file.type,
    }));
    setFormData((prev) => ({
      ...prev,
      documents: [...currentAttachments, ...newAttachments],
    }));
  };

  const handleEditDocumentsDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingEditDocuments(false);
    addEditDocuments(Array.from(e.dataTransfer.files || []));
  };

  const handleEditDocumentsFileInputChange = (e) => {
    addEditDocuments(Array.from(e.target.files || []));
    if (editDocInputRef.current) {
      editDocInputRef.current.value = "";
    }
  };

  const handleEditDocumentsRemove = (index) => {
    setFormData((prev) => ({
      ...prev,
      documents: (prev.documents || []).filter((_, i) => i !== index),
    }));
  };

  const handleEditExistingDocumentRemove = (index) => {
    setFormData((prev) => {
      const docs = prev.existingDocuments || [];
      const removed = docs[index];
      const docId = removed?.material_document_id ?? removed?.document_id ?? removed?.id;
      return {
        ...prev,
        existingDocuments: docs.filter((_, i) => i !== index),
        removedDocumentIds: docId != null ? [...(prev.removedDocumentIds || []), docId] : (prev.removedDocumentIds || []),
      };
    });
  };

  const validateConvertForm = () => {
    const errors = {};
    if (!convertFormData.dispatch_date) errors.dispatch_date = "Date is required";
    if (!convertFormData.warehouse_id) errors.warehouse_id = "Warehouse is required";
    if (!convertFormData.delivery_location) errors.delivery_location = "Delivery location is required";
    if (!convertFormData.delivered_to) errors.delivered_to = "Deliver to is required";
    if (convertFormData.launch_hire) {
      if (!convertFormData.launch_hire_location) errors.launch_hire_location = "Location is required";
      if (!convertFormData.launch_hire_booking_date) errors.launch_hire_booking_date = "Booking date and time are required";
    }
    convertFormData.orders.forEach((order, idx) => {
      if (!order.quantity) {
        errors[`co${idx}_quantity`] = "Quantity is required";
      } else if (order.maxQty != null && Number(order.quantity) > order.maxQty) {
        errors[`co${idx}_quantity`] = `Quantity cannot exceed available quantity (${order.maxQty})`;
      }
    });
    setConvertFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleConvertSubmit = (e) => {
    e.preventDefault();
    if (!validateConvertForm()) return;
    const landingNoteId = convertingNote?.landing_note_id ?? convertingNote?.id;
    const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);
    const fd = new FormData();
    fd.append("landing_note_id", landingNoteId);
    fd.append("call_id", callId);
    fd.append("warehouse_id", convertFormData.warehouse_id || "");
    const dispatchDate = convertFormData.dispatch_date + (convertFormData.dispatch_time ? ` ${convertFormData.dispatch_time}` : "");
    fd.append("dispatch_date", dispatchDate);
    fd.append("signature", convertFormData.signature || "");
    fd.append("delivery_location", convertFormData.delivery_location || "");
    fd.append("delivered_to", convertFormData.delivered_to || "");
    fd.append("launch_hire", convertFormData.launch_hire ? 1 : 0);
    fd.append("location", convertFormData.launch_hire ? (convertFormData.launch_hire_location || "") : "");
    const launchHireBookingDatetime = convertFormData.launch_hire
      ? convertFormData.launch_hire_booking_date + (convertFormData.launch_hire_booking_time ? ` ${convertFormData.launch_hire_booking_time}` : "")
      : "";
    fd.append("booking_datetime", launchHireBookingDatetime);
    fd.append("remarks", (convertFormData.remarks || "").replace(/<[^>]*>/g, "").trim());
    (convertFormData.documents || []).forEach((doc) => {
      const file = doc?.file ?? doc;
      if (file) fd.append("file[]", file);
    });
    const items = convertFormData.orders.map((order) => {
      const landingNoteItemId = order.landing_note_item_id || null;
      const item = {
        id: landingNoteItemId,
        landing_note_item_id: landingNoteItemId,
        quantity: Number(order.quantity) || 0,
        slot: order.slot || "",
        reason: order.reason || "",
        packing_required: order.packing_required ? 1 : 0,
        repacking_pallets: order.packing_required ? (parseInt(order.repacking_pallets) || 0) : 0,
        repacking_rolls: order.packing_required ? (parseInt(order.repacking_rolls) || 0) : 0,
        transportation_required: order.transportation_required ? 1 : 0,
      };
      if (order.transportation_required) {
        item.transportation = {
          vehicle_type_id: Number(order.typeOfVehicle) || 0,
          from_location_id: Number(order.fromLocation) || 0,
          pickup_location: order.pickUpFrom || "",
          to_location_id: Number(order.toLocation) || 0,
          driver_id: Number(order.driverName) || 0,
          remarks: order.transportRemarks || "",
        };
      }
      return item;
    });
    fd.append("items", JSON.stringify(items));
    convertLandingNote({
      data: fd,
      cb: () => {
        handleCloseConvertModal();
        if (callId) {
          getAllLandingNotes({ call_id: callId, page: landingPage, limit: LANDING_LIMIT });
          getLandingNotesTotal({ call_id: callId });
          useDispatchNoteReducer.getState().getDispatchNotesTotal({ call_id: callId });
        }
      },
    });
  };

  const handleToggleDropdown = (noteId, e) => {
    e.stopPropagation();
    if (openDropdownId === noteId) {
      setOpenDropdownId(null);
    } else {
      const button = e.currentTarget;
      const rect = button.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right
      });
      dropdownButtonRefs.current[noteId] = button;
      setOpenDropdownId(noteId);
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

  const handleViewNote = (note) => {
    handleCloseDropdown();
    setViewingNote(note);
    setShowViewModal(true);
    const noteId = note?.landing_note_id ?? note?.id;
    if (noteId != null && getLandingNoteById) {
      getLandingNoteById({
        id: noteId,
        cb: (detail) => {
          if (!detail) return;
          setViewingNote(mapLandingNoteForDisplay(detail));
        },
      });
    }
  };

  const handleCloseViewModal = () => {
    setShowViewModal(false);
    setViewingNote(null);
  };

  const handlePrintNote = async (note) => {
    handleCloseDropdown();
    const landingNoteId = note?.landing_note_id ?? note?.id;
    if (!landingNoteId || printingNoteId) return;
    setPrintingNoteId(landingNoteId);
    try {
      let inboundId = note?.inbound_id;
      if (!inboundId) {
        await new Promise((resolve) => {
          getLandingNoteById({
            id: landingNoteId,
            cb: (detail) => {
              inboundId = detail?.inbound_id;
              resolve();
            },
          });
        });
      }
      const response = await landingNoteService.printLandingNote(landingNoteId, inboundId);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      const { error: showError } = useAlertReducer.getState();
      if (err?.response?.data instanceof Blob) {
        const text = await err.response.data.text();
        try { showError(JSON.parse(text)?.message ?? 'Failed to generate print'); }
        catch { showError('Failed to generate print'); }
      } else {
        showError(err?.response?.data?.message ?? 'Failed to generate print');
      }
    } finally {
      setPrintingNoteId(null);
    }
  };

  const renderHeader = () => (
    <h1 className="modal-title">Edit Landing Note</h1>
  );

  const renderBody = () => (
    <div className="modal-body">
      <div className="lead-form">
        <form id="landingNoteForm" className="material-edit-form" onSubmit={handleSubmit}>

          {/* Basic Details */}
          <div className="dispatch-edit-section">
            <h3 className="landing-edit-section-title">Basic Details</h3>
            <div className="row g-2 mb-3">
              <div className="col-md-6">
                <FormField label="Date *">
                  <DateTimePickerField
                    dateValue={formData.landing_date}
                    timeValue={formData.landing_time}
                    onDateTimeChange={(v) => {
                      setFormData((p) => ({ ...p, landing_date: v.date, landing_time: v.time }));
                      if (formErrors.landing_date) setFormErrors((p) => { const n = { ...p }; delete n.landing_date; return n; });
                    }}
                    dateFieldName="landing_date"
                    timeFieldName="landing_time"
                    placeholder="YYYY-MM-DD hh:mm"
                    minDate={editMinDate}
                  />
                </FormField>
                {formErrors.landing_date && <span className="text-danger small">{formErrors.landing_date}</span>}
              </div>
              <div className="col-md-6">
                <FormField label="Warehouse">
                  <FormSelect value={formData.warehouse_id} onChange={(e) => setFormData((p) => ({ ...p, warehouse_id: e.target.value }))} options={warehouseOptions} placeholder="Select warehouse" />
                </FormField>
              </div>
            </div>
            <div className="row g-2 mb-3">
              <div className="col-md-6">
                <FormField label="Received From *">
                  <FormInput type="text" value={formData.received_from} onChange={(e) => { setFormData((p) => ({ ...p, received_from: e.target.value })); if (formErrors.received_from) setFormErrors((p) => { const n = { ...p }; delete n.received_from; return n; }); }} placeholder="Enter received from..." />
                </FormField>
                {formErrors.received_from && <span className="text-danger small">{formErrors.received_from}</span>}
              </div>
              <div className="col-md-6">
                <FormField label="Location *">
                  <FormInput type="text" value={formData.location} onChange={(e) => { setFormData((p) => ({ ...p, location: e.target.value })); if (formErrors.location) setFormErrors((p) => { const n = { ...p }; delete n.location; return n; }); }} placeholder="Enter location..." />
                </FormField>
                {formErrors.location && <span className="text-danger small">{formErrors.location}</span>}
              </div>
            </div>
            <div className="row g-2 mb-3">
              <div className="col-md-12">
                <FormField label="Signature">
                  <FormInput type="text" value={formData.signature} onChange={(e) => setFormData((p) => ({ ...p, signature: e.target.value }))} placeholder="Enter signature..." />
                </FormField>
              </div>
            </div>
            <div className="row g-2 mb-3">
              <div className="col-md-12">
                <FormField label="Remarks">
                  <ReactQuillEditor
                    key={editorKey}
                    value={formData.remarks}
                    onChange={(e) => setFormData((p) => ({ ...p, remarks: e.target.value }))}
                    placeholder="Enter remarks..."
                    name="remarks"
                  />
                </FormField>
              </div>
            </div>
            <div className="row g-2">
              <div className="col-md-12">
                <FormField label="Documents">
                  {formData.existingDocuments?.length > 0 && (
                    <div className="landing-doc-list mb-2">
                      {formData.existingDocuments.map((doc, i) => {
                        const fileName = doc.file_name || doc.name || `File ${i + 1}`;
                        const fileUrl = getFileUrl(doc.file_path || "");
                        const isImg = isImageFile(fileName);
                        return (
                          <div key={i} className="landing-doc-card">
                            {isImg ? (
                              <img src={fileUrl} alt={fileName} className="landing-doc-thumbnail" />
                            ) : (
                              <div className="landing-doc-icon">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#00368c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  <path d="M14 2V8H20" stroke="#00368c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </div>
                            )}
                            <div className="landing-doc-info">
                              <div className="landing-doc-name">{fileName}</div>
                            </div>
                            <a href={fileUrl} target="_blank" rel="noreferrer" className="landing-doc-view-btn">View</a>
                            <button
                              type="button"
                              className="document-file-preview-remove"
                              onClick={() => handleEditExistingDocumentRemove(i)}
                              title="Remove file"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <AttachmentsList
                    attachments={formData.documents || []}
                    onRemove={handleEditDocumentsRemove}
                    cardColor={cardColor}
                    isDragging={isDraggingEditDocuments}
                    onDragEnter={handleEditDocumentsDragEnter}
                    onDragLeave={handleEditDocumentsDragLeave}
                    onDragOver={handleEditDocumentsDragOver}
                    onDrop={handleEditDocumentsDrop}
                    fileInputRef={editDocInputRef}
                    onFileInputChange={handleEditDocumentsFileInputChange}
                  />
                </FormField>
              </div>
            </div>
          </div>

          {/* Order Items */}
          {formData.items.length > 0 && (
            <div className="dispatch-edit-section dispatch-edit-section--last">
              <h3 className="landing-edit-section-title">Order Items</h3>
              {formData.items.map((item, index) => (
                <div key={item.id} className="landing-edit-item-card">
                  <div
                    className={`landing-edit-item-header${expandedEditItems[item.id] ? " landing-edit-item-header--expanded" : ""}`}
                    onClick={() => toggleEditItemExpand(item.id)}
                  >
                    <span className="fw-semibold landing-edit-item-title-text">
                      Item {index + 1}{item.order_no ? ` — ${item.order_no}` : ""}
                    </span>
                    <svg
                      width="20" height="20" viewBox="0 0 24 24" fill="none"
                      className={`landing-edit-chevron${expandedEditItems[item.id] ? " landing-edit-chevron--open" : ""}`}
                    >
                      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>

                  {expandedEditItems[item.id] && (
                    <div className="landing-edit-item-body">
                      {/* Display-only info */}
                      <div className="row g-2 mb-3">
                        <div className="col-md-4">
                          <div className="landing-edit-item-info-label">PO/DO</div>
                          <div className="landing-edit-item-info-value">{item.po_no || "-"}</div>
                        </div>
                        <div className="col-md-4">
                          <div className="landing-edit-item-info-label">Package Type</div>
                          <div className="landing-edit-item-info-value">{item.package_type || "-"}</div>
                        </div>
                        <div className="col-md-4">
                          <div className="landing-edit-item-info-label">Description</div>
                          <div className="landing-edit-item-info-value">{item.description || "-"}</div>
                        </div>
                      </div>

                      {/* Editable fields */}
                      <div className="border-top pt-3">
                        <div className="row g-2 mb-2">
                          <div className="col-md-3">
                            <FormField label="Quantity *">
                              <FormInput
                                type="number"
                                value={item.quantity}
                                onChange={(e) => {
                                  handleEditItemChange(item.id, "quantity", e.target.value);
                                  if (formErrors[`item_${index}_qty`]) setFormErrors((p) => { const n = { ...p }; delete n[`item_${index}_qty`]; return n; });
                                }}
                                placeholder="Enter quantity..."
                              />
                            </FormField>
                            {formErrors[`item_${index}_qty`] && <span className="text-danger landing-edit-error-msg">{formErrors[`item_${index}_qty`]}</span>}
                          </div>
                          <div className="col-md-3">
                            <FormField label="Slot No">
                              <FormSelect
                                value={item.slot_no}
                                onChange={(e) => handleEditItemChange(item.id, "slot_no", e.target.value)}
                                options={slotOptions}
                                placeholder="Select slot..."
                              />
                            </FormField>
                          </div>
                          <div className="col-md-3">
                            <FormField label="Reason">
                              <FormSelect
                                value={item.reason}
                                onChange={(e) => handleEditItemChange(item.id, "reason", e.target.value)}
                                options={reasonOptions}
                                placeholder="Select reason..."
                              />
                            </FormField>
                          </div>
                          <div className="col-md-3">
                            <FormField label="Dispatch Date">
                              <DateTimePickerField
                                dateValue={item.dispatch_date}
                                timeValue={item.dispatch_time}
                                onDateTimeChange={(v) => {
                                  handleEditItemChange(item.id, "dispatch_date", v.date);
                                  handleEditItemChange(item.id, "dispatch_time", v.time);
                                }}
                                dateFieldName="dispatch_date"
                                timeFieldName="dispatch_time"
                                placeholder="YYYY-MM-DD hh:mm"
                              />
                            </FormField>
                          </div>
                        </div>

                        {/* Transportation */}
                        <div className="mt-2 dispatch-transport-section">
                          <label className="d-flex align-items-center gap-2 mb-2">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={item.transportation_required}
                              onChange={(e) => handleEditItemChange(item.id, "transportation_required", e.target.checked)}
                              disabled
                            />
                            <span className="fw-semibold landing-edit-transport-label-text">Transportation Required</span>
                          </label>
                          {item.transportation_required && (() => {
                            const transportSteps = [
                              { key: "vehicle", icon: "truck", label: "Vehicle Type *", value: item.typeOfVehicle, errorKey: `item_${index}_veh`, field: (
                                <FormSelect
                                  value={item.typeOfVehicle}
                                  onChange={(e) => { handleEditItemChange(item.id, "typeOfVehicle", e.target.value); if (formErrors[`item_${index}_veh`]) setFormErrors((p) => { const n = { ...p }; delete n[`item_${index}_veh`]; return n; }); }}
                                  options={mergeOptionForValue(vehicleOptions, item.typeOfVehicle)}
                                  placeholder="Select vehicle..."
                                  disabled
                                />
                              ) },
                              { key: "from", icon: "pin", label: "From Location *", value: item.fromLocation, errorKey: `item_${index}_from`, field: (
                                <FormSelect
                                  value={item.fromLocation}
                                  onChange={(e) => { handleEditItemChange(item.id, "fromLocation", e.target.value); if (formErrors[`item_${index}_from`]) setFormErrors((p) => { const n = { ...p }; delete n[`item_${index}_from`]; return n; }); }}
                                  options={mergeOptionForValue(locationOptions, item.fromLocation)}
                                  placeholder="From location..."
                                  disabled
                                />
                              ) },
                              { key: "pickup", icon: "target", label: "Pick-Up From", value: item.pickUpFrom, field: (
                                <LocationAutocomplete
                                  value={item.pickUpFrom}
                                  onChange={(e) => handleEditItemChange(item.id, "pickUpFrom", e.target.value)}
                                  placeholder="Pick-up location..."
                                />
                              ) },
                              { key: "to", icon: "flag", label: "To Location *", value: item.toLocation, errorKey: `item_${index}_to`, field: (
                                <FormSelect
                                  value={item.toLocation}
                                  onChange={(e) => { handleEditItemChange(item.id, "toLocation", e.target.value); if (formErrors[`item_${index}_to`]) setFormErrors((p) => { const n = { ...p }; delete n[`item_${index}_to`]; return n; }); }}
                                  options={mergeOptionForValue(locationOptions, item.toLocation)}
                                  placeholder="To location..."
                                  disabled
                                />
                              ) },
                              { key: "driver", icon: "user", label: "Driver *", value: item.driverName, errorKey: `item_${index}_drv`, field: (
                                <FormSelect
                                  value={item.driverName}
                                  onChange={(e) => { handleEditItemChange(item.id, "driverName", e.target.value); if (formErrors[`item_${index}_drv`]) setFormErrors((p) => { const n = { ...p }; delete n[`item_${index}_drv`]; return n; }); }}
                                  options={mergeOptionForValue(driverOptions, item.driverName)}
                                  placeholder="Select driver..."
                                  disabled
                                />
                              ) },
                            ];
                            const allDone = transportSteps.every((s) => !!s.value);
                            return (
                              <div className="dispatch-launch-hire-card dispatch-transport-form-card">
                                <div className="dispatch-launch-hire-steps dispatch-launch-hire-steps--form dispatch-transport-form-steps dispatch-transport-form-steps--readonly">
                                  {transportSteps.map((step, stepIdx, steps) => {
                                    const isDone = !!step.value;
                                    const isCurrent = !isDone && steps.slice(0, stepIdx).every((s) => !!s.value);
                                    return (
                                      <Fragment key={step.key}>
                                        <div className="dispatch-launch-hire-step dispatch-launch-hire-step--form" style={{ "--stagger-index": stepIdx }}>
                                          <div className="dispatch-launch-hire-step-head">
                                            <span className="dispatch-launch-hire-step-icon-wrap">
                                              <span className={`dispatch-launch-hire-step-icon dispatch-launch-hire-step-icon--transport${isCurrent ? " dispatch-launch-hire-step-icon--highlight-transport" : ""}`}>
                                                {renderViewIcon(step.icon)}
                                              </span>
                                              <span className={`dispatch-launch-hire-step-num${isDone ? " dispatch-launch-hire-step-num--done" : ""}`}>
                                                {isDone ? (
                                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                                  </svg>
                                                ) : (
                                                  stepIdx + 1
                                                )}
                                              </span>
                                            </span>
                                            <span className="dispatch-launch-hire-step-label">{step.label}</span>
                                          </div>
                                          <div className="dispatch-launch-hire-step-field">
                                            {step.field}
                                            {step.errorKey && formErrors[step.errorKey] && <span className="text-danger landing-edit-error-msg">{formErrors[step.errorKey]}</span>}
                                          </div>
                                        </div>
                                        <div className="dispatch-launch-hire-track" aria-hidden="true">
                                          <span className="dispatch-launch-hire-track-line dispatch-launch-hire-track-line--transport" />
                                          {stepIdx < steps.findIndex((s) => s.key === "to") && (
                                            <span className="dispatch-launch-hire-track-boat dispatch-launch-hire-track-boat--transport">
                                              {renderViewIcon("truck")}
                                            </span>
                                          )}
                                        </div>
                                      </Fragment>
                                    );
                                  })}
                                  <div className={`dispatch-transport-track-node${allDone ? " dispatch-transport-track-node--done" : ""}`}>
                                    <span className="dispatch-launch-hire-step-icon-wrap">
                                      <span className={`dispatch-launch-hire-step-icon${allDone ? " dispatch-launch-hire-step-icon--done" : " dispatch-launch-hire-step-icon--transport"}`}>
                                        {renderViewIcon("check")}
                                      </span>
                                    </span>
                                    <span className="dispatch-transport-track-node-label">Done</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </form>
      </div>
    </div>
  );

  const renderFooter = () => (
    <div className="modal-footer">
      <button type="button" className="btn btn-secondary" onClick={handleCloseModal} disabled={isLoadingUpdate}>
        Cancel
      </button>
      <button type="submit" form="landingNoteForm" className="btn btn-primary" disabled={isLoadingUpdate}>
        {isLoadingUpdate
          ? <><span className="spinner-border spinner-border-sm me-2" role="status" />Updating...</>
          : "Update"
        }
      </button>
    </div>
  );

  // Convert to Dispatch Modal Render Functions
  const renderConvertHeader = () => (
    <>
      <h1 className="modal-title">Convert to Dispatch Note</h1>
    </>
  );

  const renderConvertBody = () => (
    <div className="modal-body">
      <div className="lead-form">
        <form id="convertToDispatchForm" onSubmit={handleConvertSubmit}>

          {/* Basic Details */}
          <div className="landing-convert-section">
            <h3 className="landing-convert-section-title">Basic Details</h3>
            <div className="row g-2">
              <div className="col-md-6 mb-2">
                <FormField label="Dispatch Date *">
                  <DateTimePickerField
                    dateValue={convertFormData.dispatch_date}
                    timeValue={convertFormData.dispatch_time}
                    onDateTimeChange={(v) => { setConvertFormData((p) => ({ ...p, dispatch_date: v.date, dispatch_time: v.time })); setConvertFormErrors((p) => { const n = { ...p }; delete n.dispatch_date; return n; }); }}
                    dateFieldName="dispatch_date"
                    timeFieldName="dispatch_time"
                    placeholder="YYYY-MM-DD hh:mm"
                    minDate={convertMinDate}
                  />
                  {convertFormErrors.dispatch_date && <span className="landing-convert-error">{convertFormErrors.dispatch_date}</span>}
                </FormField>
              </div>
              <div className="col-md-6 mb-2">
                <FormField label="Warehouse *">
                  <FormSelect
                    value={convertFormData.warehouse_id}
                    onChange={(e) => { setConvertFormData((p) => ({ ...p, warehouse_id: e.target.value })); setConvertFormErrors((p) => { const n = { ...p }; delete n.warehouse_id; return n; }); }}
                    options={warehouseOptions}
                    placeholder="Select warehouse"
                    className={convertFormErrors.warehouse_id ? "is-invalid" : ""}
                  />
                  {convertFormErrors.warehouse_id && <span className="landing-convert-error">{convertFormErrors.warehouse_id}</span>}
                </FormField>
              </div>
              <div className="col-md-4 mb-2">
                <FormField label="Signature">
                  <FormInput type="text" value={convertFormData.signature} onChange={(e) => handleConvertFormChange("signature", e.target.value)} placeholder="Enter signature..." />
                </FormField>
              </div>
              <div className="col-md-4 mb-2">
                <FormField label="Delivery Location *">
                  <FormInput type="text" value={convertFormData.delivery_location} onChange={(e) => { handleConvertFormChange("delivery_location", e.target.value); setConvertFormErrors((p) => { const n = { ...p }; delete n.delivery_location; return n; }); }} placeholder="Enter delivery location..." className={convertFormErrors.delivery_location ? "is-invalid" : ""} />
                  {convertFormErrors.delivery_location && <span className="landing-convert-error">{convertFormErrors.delivery_location}</span>}
                </FormField>
              </div>
              <div className="col-md-4 mb-2">
                <FormField label="Delivered To *">
                  <FormInput type="text" value={convertFormData.delivered_to} onChange={(e) => { handleConvertFormChange("delivered_to", e.target.value); setConvertFormErrors((p) => { const n = { ...p }; delete n.delivered_to; return n; }); }} placeholder="Enter person name..." className={convertFormErrors.delivered_to ? "is-invalid" : ""} />
                  {convertFormErrors.delivered_to && <span className="landing-convert-error">{convertFormErrors.delivered_to}</span>}
                </FormField>
              </div>
            </div>
          </div>

          {/* Launch Hire */}
          <div className="landing-convert-section">
            <h3 className="landing-convert-section-title">Launch Hire</h3>
            <label className="landing-convert-checkbox-label">
              <input
                type="checkbox"
                checked={convertFormData.launch_hire || false}
                onChange={(e) => {
                  handleConvertFormChange("launch_hire", e.target.checked);
                  setConvertFormErrors((p) => { const n = { ...p }; delete n.launch_hire_location; delete n.launch_hire_booking_date; return n; });
                }}
                className="landing-convert-checkbox"
              />
              <span className="landing-convert-checkbox-text">Launch hire required</span>
            </label>
            {convertFormData.launch_hire && (
              <div className="dispatch-launch-hire-card">
                <div className="dispatch-launch-hire-steps dispatch-launch-hire-steps--form">
                  <div className="dispatch-launch-hire-step dispatch-launch-hire-step--form" style={{ "--stagger-index": 0 }}>
                    <div className="dispatch-launch-hire-step-head">
                      <span className="dispatch-launch-hire-step-icon-wrap">
                        <span className="dispatch-launch-hire-step-icon">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                            <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                        <span className="dispatch-launch-hire-step-num">1</span>
                      </span>
                      <span className="dispatch-launch-hire-step-label">Booking Date &amp; Time <span className="text-danger">*</span></span>
                    </div>
                    <div className="dispatch-launch-hire-step-field">
                      <DateTimePickerField
                        dateValue={convertFormData.launch_hire_booking_date}
                        timeValue={convertFormData.launch_hire_booking_time}
                        onDateTimeChange={(v) => {
                          setConvertFormData((p) => ({ ...p, launch_hire_booking_date: v.date, launch_hire_booking_time: v.time }));
                          setConvertFormErrors((p) => { const n = { ...p }; delete n.launch_hire_booking_date; return n; });
                        }}
                        dateFieldName="launch_hire_booking_date"
                        timeFieldName="launch_hire_booking_time"
                        placeholder="YYYY-MM-DD hh:mm"
                        hasError={Boolean(convertFormErrors.launch_hire_booking_date)}
                      />
                      {convertFormErrors.launch_hire_booking_date && <span className="landing-convert-error">{convertFormErrors.launch_hire_booking_date}</span>}
                    </div>
                  </div>

                  <div className="dispatch-launch-hire-track" aria-hidden="true">
                    <span className="dispatch-launch-hire-track-line" />
                    <span className="dispatch-launch-hire-track-boat">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 15h18l-2 5H5l-2-5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M12 3v12M9 6l3-3 3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M2 15c2-2.5 4-3.5 10-3.5s8 1 10 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </span>
                  </div>

                  <div className="dispatch-launch-hire-step dispatch-launch-hire-step--form" style={{ "--stagger-index": 1 }}>
                    <div className="dispatch-launch-hire-step-head">
                      <span className="dispatch-launch-hire-step-icon-wrap">
                        <span className="dispatch-launch-hire-step-icon dispatch-launch-hire-step-icon--highlight">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 22s7-7.05 7-12a7 7 0 1 0-14 0c0 4.95 7 12 7 12Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                            <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
                          </svg>
                        </span>
                        <span className="dispatch-launch-hire-step-num">2</span>
                      </span>
                      <span className="dispatch-launch-hire-step-label">Location <span className="text-danger">*</span></span>
                    </div>
                    <div className="dispatch-launch-hire-step-field">
                      <FormSelect
                        value={convertFormData.launch_hire_location}
                        onChange={(e) => { handleConvertFormChange("launch_hire_location", e.target.value); setConvertFormErrors((p) => { const n = { ...p }; delete n.launch_hire_location; return n; }); }}
                        options={LAUNCH_HIRE_LOCATION_OPTIONS}
                        placeholder="Select location..."
                        className={convertFormErrors.launch_hire_location ? "is-invalid" : ""}
                      />
                      {convertFormErrors.launch_hire_location && <span className="landing-convert-error">{convertFormErrors.launch_hire_location}</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Order Details */}
          <div className="landing-convert-section">
            <div className="landing-convert-section-header">
              <h3 className="landing-convert-section-title">Order Details</h3>
            </div>

            {convertFormData.orders.map((order, index) => (
              <div key={order.id} className="landing-convert-order-card">
                <div onClick={() => toggleConvertOrderExpand(order.id)} className="landing-convert-order-header">
                  <span className="landing-convert-order-title">Order {index + 1}</span>
                  <div className="landing-convert-order-actions">
                    {index === convertFormData.orders.length - 1 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleAddNewConvertOrder(); }}
                        className="dispatch-order-icon-btn"
                        title="Add order"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </button>
                    )}
                    {convertFormData.orders.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleRemoveConvertOrder(order.id); }}
                        className="dispatch-order-icon-btn dispatch-order-icon-btn--delete"
                        title="Remove order"
                      >
                        <img src={deleteIcon} alt="delete" />
                      </button>
                    )}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={`landing-convert-chevron${expandedConvertOrders[order.id] ? " landing-convert-chevron--open" : ""}`}>
                      <path d="M6 9L12 15L18 9" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                {expandedConvertOrders[order.id] && (
                  <div className="landing-convert-order-body">
                    {/* Order Info */}
                    <div className="row g-2 mb-2">
                      <div className="col-md-6">
                        <FormField label="Order No">
                          <FormInput type="text" value={order.orderNo} onChange={(e) => handleConvertOrderChange(order.id, "orderNo", e.target.value)} placeholder="Order number..." />
                        </FormField>
                      </div>
                      <div className="col-md-6">
                        <FormField label="PO/DO">
                          <FormInput type="text" value={order.poDo} onChange={(e) => handleConvertOrderChange(order.id, "poDo", e.target.value)} placeholder="PO/DO..." />
                        </FormField>
                      </div>
                    </div>
                    <div className="row g-2 mb-2">
                      <div className="col-md-8">
                        <FormField label="Description">
                          <FormInput type="text" value={order.description} onChange={(e) => handleConvertOrderChange(order.id, "description", e.target.value)} placeholder="Description..." />
                        </FormField>
                      </div>
                      <div className="col-md-4">
                        <FormField label="Dispatch Quantity *">
                          <FormInput type="text" inputMode="numeric" value={order.quantity} onChange={(e) => { const val = e.target.value; if (val === "" || /^\d+$/.test(val)) { handleConvertOrderChange(order.id, "quantity", val); setConvertFormErrors((p) => { const n = { ...p }; delete n[`co${index}_quantity`]; return n; }); } }} placeholder="Quantity..." className={convertFormErrors[`co${index}_quantity`] ? "is-invalid" : ""} />
                          {order.maxQty != null && (
                            <div className="landing-convert-qty-max text-end">Max: {order.maxQty}</div>
                          )}
                          {convertFormErrors[`co${index}_quantity`] && <span className="landing-convert-error">{convertFormErrors[`co${index}_quantity`]}</span>}
                        </FormField>
                      </div>
                    </div>

                    {/* Dispatch Details */}
                    <div className="landing-convert-dispatch-section">
                      <p className="landing-convert-dispatch-title">Dispatch Details</p>
                      <div className="row g-2">
                        <div className="col-md-4">
                          <FormField label="Slot">
                            <FormSelect value={order.slot} onChange={(e) => handleConvertOrderChange(order.id, "slot", e.target.value)} options={mergeOptionForValue(slotOptions, order.slot)} placeholder="Select slot..." />
                          </FormField>
                        </div>
                        <div className="col-md-4">
                          <FormField label="Reason">
                            <FormSelect value={order.reason} onChange={(e) => handleConvertOrderChange(order.id, "reason", e.target.value)} options={reasonOptions} placeholder="Select reason..." />
                          </FormField>
                        </div>
                      </div>

                      {/* Packing Required */}
                      <div className="mt-2">
                        <label className="landing-convert-checkbox-label">
                          <input type="checkbox" checked={order.packing_required || false} onChange={(e) => handleConvertOrderChange(order.id, "packing_required", e.target.checked)} className="landing-convert-checkbox" />
                          <span className="landing-convert-checkbox-text">Packing Required</span>
                        </label>
                        {order.packing_required && (
                          <div className="row g-2">
                            <div className="col-md-4">
                              <FormField label="Repacking Pallets">
                                <FormInput
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={order.repacking_pallets}
                                  onChange={(e) => handleNonNegativeIntegerChange(order.id, "repacking_pallets", e.target.value)}
                                  placeholder="0"
                                />
                              </FormField>
                            </div>
                            <div className="col-md-4">
                              <FormField label="Repacking Rolls">
                                <FormInput
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={order.repacking_rolls}
                                  onChange={(e) => handleNonNegativeIntegerChange(order.id, "repacking_rolls", e.target.value)}
                                  placeholder="0"
                                />
                              </FormField>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Transportation Required */}
                      <div className="mt-2 dispatch-transport-section">
                        <label className="landing-convert-checkbox-label">
                          <input type="checkbox" checked={order.transportation_required || false} onChange={(e) => handleConvertOrderChange(order.id, "transportation_required", e.target.checked)} className="landing-convert-checkbox" />
                          <span className="landing-convert-checkbox-text">Transportation Required</span>
                        </label>
                        {order.transportation_required && (() => {
                          const transportSteps = [
                            { key: "vehicle", icon: "truck", label: "Vehicle Type", value: order.typeOfVehicle, field: (
                              <FormSelect value={order.typeOfVehicle} onChange={(e) => handleConvertOrderChange(order.id, "typeOfVehicle", e.target.value)} options={mergeOptionForValue(vehicleOptions, order.typeOfVehicle)} placeholder="Select vehicle..." />
                            ) },
                            { key: "from", icon: "pin", label: "From Location", value: order.fromLocation, field: (
                              <FormSelect value={order.fromLocation} onChange={(e) => handleConvertOrderChange(order.id, "fromLocation", e.target.value)} options={mergeOptionForValue(locationOptions, order.fromLocation)} placeholder="From location..." />
                            ) },
                            { key: "pickup", icon: "target", label: "Pick-Up From", value: order.pickUpFrom, field: (
                              <LocationMapPicker value={order.pickUpFrom} onChange={(e) => handleConvertOrderChange(order.id, "pickUpFrom", e.target.value)} placeholder="Pick-up location..." />
                            ) },
                            { key: "to", icon: "flag", label: "To Location", value: order.toLocation, field: (
                              <FormSelect value={order.toLocation} onChange={(e) => handleConvertOrderChange(order.id, "toLocation", e.target.value)} options={mergeOptionForValue(locationOptions, order.toLocation)} placeholder="To location..." />
                            ) },
                            { key: "driver", icon: "user", label: "Driver", value: order.driverName, field: (
                              <FormSelect value={order.driverName} onChange={(e) => handleConvertOrderChange(order.id, "driverName", e.target.value)} options={mergeOptionForValue(driverOptions, order.driverName)} placeholder="Select driver..." />
                            ) },
                            { key: "remarks", icon: "note", label: "Remarks", value: order.transportRemarks, field: (
                              <FormInput type="text" value={order.transportRemarks} onChange={(e) => handleConvertOrderChange(order.id, "transportRemarks", e.target.value)} placeholder="Transport remarks..." />
                            ) },
                          ];
                          const allDone = transportSteps.every((s) => !!s.value);
                          return (
                            <div className="dispatch-launch-hire-card dispatch-transport-form-card">
                              <div className="dispatch-launch-hire-steps dispatch-launch-hire-steps--form dispatch-transport-form-steps">
                                {transportSteps.map((step, stepIdx, steps) => {
                                  const isDone = !!step.value;
                                  const isCurrent = !isDone && steps.slice(0, stepIdx).every((s) => !!s.value);
                                  return (
                                    <Fragment key={step.key}>
                                      <div className="dispatch-launch-hire-step dispatch-launch-hire-step--form" style={{ "--stagger-index": stepIdx }}>
                                        <div className="dispatch-launch-hire-step-head">
                                          <span className="dispatch-launch-hire-step-icon-wrap">
                                            <span className={`dispatch-launch-hire-step-icon dispatch-launch-hire-step-icon--transport${isCurrent ? " dispatch-launch-hire-step-icon--highlight-transport" : ""}`}>
                                              {renderViewIcon(step.icon)}
                                            </span>
                                            <span className={`dispatch-launch-hire-step-num${isDone ? " dispatch-launch-hire-step-num--done" : ""}`}>
                                              {isDone ? (
                                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                              ) : (
                                                stepIdx + 1
                                              )}
                                            </span>
                                          </span>
                                          <span className="dispatch-launch-hire-step-label">{step.label}</span>
                                        </div>
                                        <div className="dispatch-launch-hire-step-field">
                                          {step.field}
                                        </div>
                                      </div>
                                      <div className="dispatch-launch-hire-track" aria-hidden="true">
                                        <span className="dispatch-launch-hire-track-line dispatch-launch-hire-track-line--transport" />
                                        {stepIdx < steps.findIndex((s) => s.key === "to") && (
                                          <span className="dispatch-launch-hire-track-boat dispatch-launch-hire-track-boat--transport">
                                            {renderViewIcon("truck")}
                                          </span>
                                        )}
                                      </div>
                                    </Fragment>
                                  );
                                })}
                                <div className={`dispatch-transport-track-node${allDone ? " dispatch-transport-track-node--done" : ""}`}>
                                  <span className="dispatch-launch-hire-step-icon-wrap">
                                    <span className={`dispatch-launch-hire-step-icon${allDone ? " dispatch-launch-hire-step-icon--done" : " dispatch-launch-hire-step-icon--transport"}`}>
                                      {renderViewIcon("check")}
                                    </span>
                                  </span>
                                  <span className="dispatch-transport-track-node-label">Done</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Documents & Remarks */}
          <div>
            <h3 className="landing-convert-section-title">Documents & Remarks</h3>
            <div className="mb-2">
              <FormField label="File">
                <AttachmentsList
                  attachments={convertFormData.documents || []}
                  onAdd={() => {}}
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
            <div className="mb-2">
              <FormField label="Remarks">
                <ReactQuillEditor value={convertFormData.remarks || ""} onChange={(e) => handleConvertFormChange("remarks", e.target.value)} placeholder="Enter remarks..." name="remarks" />
              </FormField>
            </div>
          </div>

        </form>
      </div>
    </div>
  );

  const renderConvertFooter = () => (
    <div className="modal-footer justify-content-end">
      <div className="d-flex gap-2">
        <button type="button" onClick={handleCloseConvertModal} className="btn btn-secondary">
          Cancel
        </button>
        <button
          type="submit"
          form="convertToDispatchForm"
          disabled={isLoadingConvert || isLoadingConvertDetail}
          className="btn btn-primary"
        >
          {isLoadingConvert ? "Converting..." : isLoadingConvertDetail ? "Loading..." : "Convert"}
        </button>
      </div>
    </div>
  );

  // View Note Modal Render Functions
  const renderViewHeader = () => (
    <>
      <h1 className="modal-title">View Landing Note Details</h1>
    </>
  );

  const renderViewBody = () => {
    if (!viewingNote) return null;

    const viewItems = Array.isArray(viewingNote.items) ? viewingNote.items : [];
    const warehouseName = warehouseOptions.find((o) => o.value === String(viewingNote.warehouse_id || ""))?.label || null;
    const documents = Array.isArray(viewingNote.documents) ? viewingNote.documents
      : Array.isArray(viewingNote.landingProof) ? viewingNote.landingProof : [];

    return (
      <div className="modal-body">
        <div className="lead-form">
          {/* Note Header */}
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
                { key: "no", icon: "hash", label: "Landing Note No", value: viewingNote.landingNoteNo || "-" },
                { key: "date", icon: "calendar", label: "Date", value: formatDate(viewingNote.date) || "-" },
                { key: "warehouse", icon: "building", label: "Warehouse", value: warehouseName || "-" },
                { key: "received_from", icon: "user", label: "Received From", value: viewingNote.received_from || "-" },
                { key: "location", icon: "pin", label: "Location", value: viewingNote.location || "-" },
                ...(viewingNote.signature ? [{ key: "signature", icon: "signature", label: "Signature", value: viewingNote.signature }] : []),
              ].map((field, index) => (
                <div key={field.key} className="landing-view-info-card" style={{ "--stagger-index": index }}>
                  <span className="landing-view-info-icon">
                    {renderViewIcon(field.icon)}
                  </span>
                  <div className="landing-view-info-body">
                    <span className="landing-view-info-label">{field.label}</span>
                    <span className="landing-view-info-value">{field.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-12">
              <label className="landing-view-label">Documents</label>
              {documents.length > 0 ? (
                <div className="landing-doc-list">
                  {documents.map((doc, i) => {
                    const fileName = doc.file_name || doc.name || `File ${i + 1}`;
                    const fileUrl = getFileUrl(doc.file_path || doc.file_url || "");
                    const isImage = isImageFile(fileName);
                    return (
                      <div key={i} className="landing-doc-card">
                        {isImage ? (
                          <img src={fileUrl} alt={fileName} className="landing-doc-thumbnail" />
                        ) : (
                          <div className="landing-doc-icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#00368c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M14 2V8H20" stroke="#00368c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        )}
                        <div className="landing-doc-info">
                          <div className="landing-doc-name">{fileName}</div>
                          {doc.remarks && <div className="landing-doc-remarks">{doc.remarks}</div>}
                        </div>
                        <a href={fileUrl} target="_blank" rel="noreferrer" className="landing-doc-view-btn">View</a>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="landing-view-box">No files</div>
              )}
            </div>
            {viewingNote.remarks && (
              <div className="col-12">
                <label className="landing-view-label">Remarks</label>
                <div className="landing-view-box landing-view-box--textarea" dangerouslySetInnerHTML={{ __html: viewingNote.remarks }} />
              </div>
            )}
          </div>

          {/* Order Items */}
          {viewItems.length > 0 && (
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
                <span className="landing-view-count-badge">{viewItems.length}</span>
              </h4>
              {viewItems.map((item, idx) => {
                const transport = getTransportation(item);
                const hasTransport = isTruthyFlag(item.transportation_required) || Boolean(transport);
                const hasPacking = isTruthyFlag(item.packing_required);
                const hasDispatch = item.slot_no_id || item.reason_id || item.dispatch_date || item.slot || item.slot_no || item.reason;
                const vehicleName = transport?.vehicle_type_name ||
                  vehicleOptions.find((o) => o.value === String(transport?.vehicle_type_id))?.label || "-";
                const fromLocName = transport?.from_location_name ||
                  locationOptions.find((o) => o.value === String(transport?.from_location_id))?.label || "-";
                const toLocName = transport?.to_location_name ||
                  locationOptions.find((o) => o.value === String(transport?.to_location_id))?.label || "-";
                const driverName = transport?.driver_name ||
                  driverOptions.find((o) => o.value === String(transport?.driver_id))?.label || "-";
                return (
                  <div
                    key={item.landing_note_item_id || idx}
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
                        { key: "po_do", icon: "hash", label: "PO/DO", value: item.po_no || "-" },
                        { key: "quantity", icon: "list", label: "Quantity", value: item.quantity ?? "-" },
                        { key: "package_type", icon: "package", label: "Package Type", value: item.package_type || item.package_type_id || "-" },
                        { key: "description", icon: "note", label: "Description", value: item.description || "-" },
                      ].map((field, fieldIdx) => (
                        <div key={field.key} className="landing-view-info-card landing-view-info-card--items" style={{ "--stagger-index": fieldIdx }}>
                          <span className="landing-view-info-icon landing-view-info-icon--items">
                            {renderViewIcon(field.icon)}
                          </span>
                          <div className="landing-view-info-body">
                            <span className="landing-view-info-label">{field.label}</span>
                            <span className="landing-view-info-value">{field.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {hasDispatch && (
                      <div className="landing-view-sub-section">
                        <div className="landing-view-sub-title landing-view-sub-title--iconic">
                          <span className="landing-view-section-icon landing-view-section-icon--dispatch landing-view-section-icon--sm">
                            {renderViewIcon("flag")}
                          </span>
                          <span>Dispatch Details</span>
                        </div>
                        <div className="row g-2">
                          <div className="col-md-4 col-6">
                            <label className="landing-view-label">Slot</label>
                            <div className="landing-view-box">{normalizeSlotValue(item.slot ?? item.slot_no ?? item.slot_no_id) || "-"}</div>
                          </div>
                          <div className="col-md-4 col-6">
                            <label className="landing-view-label">Reason</label>
                            <div className="landing-view-box">{item.reason || item.reason_name || item.reason_id || "-"}</div>
                          </div>
                          <div className="col-md-4 col-6">
                            <label className="landing-view-label">Dispatch Date</label>
                            <div className="landing-view-box">{item.dispatch_date ? formatDate(item.dispatch_date) : "-"}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {hasPacking && (
                      <div className="landing-view-sub-section">
                        <div className="landing-view-sub-title landing-view-sub-title--iconic">
                          <span className="landing-view-section-icon landing-view-section-icon--packing landing-view-section-icon--sm">
                            {renderViewIcon("box")}
                          </span>
                          <span>Packing</span>
                        </div>
                        <div className="row g-2">
                          <div className="col-md-4 col-6">
                            <label className="landing-view-label">Repacking Pallets</label>
                            <div className="landing-view-box">{item.repacking_pallets ?? "-"}</div>
                          </div>
                          <div className="col-md-4 col-6">
                            <label className="landing-view-label">Repacking Rolls</label>
                            <div className="landing-view-box">{item.repacking_rolls ?? "-"}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {hasTransport && transport && (
                      <div className="landing-view-sub-section landing-view-sub-section--transport-card">
                        <div className="landing-view-sub-title landing-view-sub-title--iconic">
                          <span className="landing-view-section-icon landing-view-section-icon--transport landing-view-section-icon--sm">
                            {renderViewIcon("truck")}
                          </span>
                          <span>Transportation</span>
                        </div>
                        {(() => {
                          const isDriverEmpty = driverName === "-";
                          const routeSteps = [
                            { key: "vehicle", icon: "truck", label: "Type of Vehicle", value: vehicleName },
                            { key: "from", icon: "pin", label: "From Location", value: fromLocName },
                            { key: "pickup", icon: "target", label: "Pick-Up From", value: transport.pickup_location || "-" },
                            { key: "to", icon: "flag", label: "To Location", value: toLocName },
                          ];
                          return (
                            <>
                              <div className="landing-view-transport-driver-row">
                                <div className={`landing-view-transport-step${isDriverEmpty ? " landing-view-transport-step--empty" : ""}`}>
                                  <span className="landing-view-transport-step-icon-wrap">
                                    <span className="landing-view-transport-step-icon">
                                      {renderViewIcon("user")}
                                    </span>
                                  </span>
                                  <div className="landing-view-transport-step-body">
                                    <span className="landing-view-transport-step-label">Driver</span>
                                    <span className="landing-view-transport-step-value">{driverName}</span>
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
                                            {renderViewIcon(step.icon)}
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
                                            {renderViewIcon("truck")}
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
                        {transport.remarks && (
                          <div className="row g-2 mt-2">
                            <div className="col-md-6 col-12">
                              <label className="landing-view-label">Remarks</label>
                              <div className="landing-view-box">{transport.remarks}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderViewFooter = () => (
    <div className="modal-footer">
      <button type="button" className="btn btn-secondary" onClick={handleCloseViewModal}>
        Close
      </button>
      {viewingNote && (
        <button
          type="button"
          className="btn btn-primary d-flex align-items-center gap-2"
          onClick={() => handlePrintNote(viewingNote)}
          disabled={!!printingNoteId}
        >
          {printingNoteId === (viewingNote?.landing_note_id ?? viewingNote?.id)
            ? <><span className="spinner-border spinner-border-sm" role="status" />Printing...</>
            : "Print"
          }
        </button>
      )}
    </div>
  );

  return (
    <div className="cardform-left-full material-management-content-wrapper" style={{ "--card-color": cardColor }}>
      <div className="material-list-header">
        <h3 className="material-list-title">
          <span className="material-list-title-bar"></span>
          Landing Note
        </h3>
      </div>
      <div className="table-wrapper table-responsive material-table-container landing-table-wrapper">
        <div className="landing-table-scroll">
        <table className="table table-striped material-table sub-note-table landing-table">
          <thead>
            <tr>
              <th>Order No</th>
              <th>Date</th>
              <th>PO/DO</th>
              <th>Landing Proof</th>
              <th>Quantity</th>
              <th>Package Type</th>
              <th>Description</th>
              <th className="landing-table-actions-th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoadingList ? (
              <tr>
                <td colSpan="8" className="landing-table-loading">Loading...</td>
              </tr>
            ) : notesList.length > 0 ? (
              notesList.map((note) => (
                <tr key={note.id}>
                  <td>
                    <div className="material-table-cell">{note.landingNoteNo || ""}</div>
                  </td>
                  <td>
                    <div className="material-table-cell">
                      {formatDate(note.date)}
                    </div>
                  </td>
                  <td>
                    <div className="material-table-cell">{note.poDo || ""}</div>
                  </td>
                  <td>
                    <div className="material-table-cell">
                      {note.landingProof && note.landingProof.length > 0 ? (
                        <span className="landing-table-proof-link">
                          {note.landingProof.length} file(s)
                        </span>
                      ) : (
                        <span className="landing-table-proof-none">No files</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="material-table-cell">{note.quantity || ""}</div>
                  </td>
                  <td>
                    <div className="material-table-cell">{note.packageType || ""}</div>
                  </td>
                  <td>
                    <div className="material-table-cell">
                      {note.description && note.description.length > 13 ? (
                        <>
                          <Tooltip
                            id={`description-tooltip-${note.id}`}
                            place="right"
                            content={note.description}
                            className="material-table-tooltip"
                          />
                          <span
                            data-tooltip-id={`description-tooltip-${note.id}`}
                            className="landing-table-description"
                          >
                            {note.description.substring(0, 13)}...
                          </span>
                        </>
                      ) : (
                        <span>{note.description || ""}</span>
                      )}
                    </div>
                  </td>
                  <td className="landing-table-actions-td">
                    <div className="material-table-cell landing-table-actions-cell">
                      <Tooltip id={`view-note-${note.id}`} place="left" content="View" />
                      <button
                        type="button"
                        onClick={() => handleViewNote(note)}
                        data-tooltip-id={`view-note-${note.id}`}
                        className="landing-action-btn"
                      >
                        <img src={eyeIcon} alt="view" />
                      </button>
                      <Tooltip id={`print-note-${note.id}`} place="left" content="Print" />
                      <button
                        type="button"
                        onClick={() => handlePrintNote(note)}
                        data-tooltip-id={`print-note-${note.id}`}
                        disabled={printingNoteId === (note.landing_note_id ?? note.id)}
                        className="landing-action-btn"
                      >
                        {printingNoteId === (note.landing_note_id ?? note.id) ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="landing-spin">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 9V2H18V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M6 18H4C2.89543 18 2 17.1046 2 16V11C2 9.89543 2.89543 9 4 9H20C21.1046 9 22 9.89543 22 11V16C22 17.1046 21.1046 18 20 18H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M18 14H6V22H18V14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M18 9H6V14H18V9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      <Tooltip id={`convert-note-${note.id}`} place="left" content=" Convert" />
                      <button
                        type="button"
                        onClick={() => handleConvertToDispatch(note)}
                        data-tooltip-id={`convert-note-${note.id}`}
                        className="landing-action-btn"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 4H10V12H1V4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M10 6H16L19 9V12H10V6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx="4" cy="17" r="2" stroke="currentColor" strokeWidth="2" />
                          <circle cx="17" cy="17" r="2" stroke="currentColor" strokeWidth="2" />
                          <path d="M19 9H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </button>
                      <div className={`action-dropdown-wrapper landing-more-actions-wrapper${openDropdownId === note.id ? " landing-more-actions-wrapper--open" : ""}`}>
                        <Tooltip id={`more-actions-${note.id}`} place="left" content="More actions" />
                        <button
                          type="button"
                          onClick={(e) => handleToggleDropdown(note.id, e)}
                          data-tooltip-id={`more-actions-${note.id}`}
                          className="landing-action-btn"
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="6" r="1.5" fill="currentColor" />
                            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                            <circle cx="12" cy="18" r="1.5" fill="currentColor" />
                          </svg>
                        </button>
                        {openDropdownId === note.id && createPortal(
                          <div
                            data-dropdown-menu
                            className="landing-dropdown-menu"
                            style={{ top: `${dropdownPosition.top}px`, right: `${dropdownPosition.right}px` }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                handleCloseDropdown();
                                handleOpenModal(note);
                              }}
                              className="landing-dropdown-item landing-dropdown-item--default"
                            >
                              <img src={editIcon} alt="edit" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleCloseDropdown();
                                handleDelete(note.id);
                              }}
                              className="landing-dropdown-item landing-dropdown-item--danger"
                            >
                              <img src={deleteIcon} alt="delete" />
                              <span>Delete</span>
                            </button>
                          </div>,
                          document.body
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="landing-table-empty">
                  No landing notes added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
        <MaterialTablePagination
          page={landingPage}
          total={landingTotal || notesList.length}
          limit={LANDING_LIMIT}
          onPageChange={setLandingPage}
        />
      </div>

      <CustomModal
        className="material-management-modal"
        dialgName="modal-dialog modal-dialog-centered modal-dialog-scrollable"
        show={showModal}
        closeModal={handleCloseModal}
        header={renderHeader()}
        body={renderBody()}
        footer={renderFooter()}
      />

      <CustomModal
        className="material-management-modal"
        show={showConvertModal}
        closeModal={handleCloseConvertModal}
        header={renderConvertHeader()}
        body={renderConvertBody()}
        footer={renderConvertFooter()}
        dialgName="modal-dialog modal-dialog-centered"
      />

      <CustomModal
        className="material-management-modal"
        show={showViewModal}
        closeModal={handleCloseViewModal}
        header={renderViewHeader()}
        body={renderViewBody()}
        footer={renderViewFooter()}
        dialgName="modal-dialog modal-dialog-centered"
      />
    </div>
  );
};

LandingNoteContent.propTypes = {
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
  cardColor: PropTypes.string,
};

export default LandingNoteContent;
