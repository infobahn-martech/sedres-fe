import { useState, useEffect, useRef, Fragment } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import CustomModal from "../../../../../../../components/CustomModal";
import DeleteConfirmationModal from "../../../../../../../components/DeleteConfirmationModal";
import CardTabListLoading from "../../../../../../../components/CardTabListLoading";
import { FormField, FormInput, FormSelect, FormTextarea } from "./Husbandry.components";
import DateTimePickerField from "../../../../shared/components/DateTimePickerField";
import LocationMapPicker from "./LocationMapPicker";
import editIcon from "../../../../../../../assets/images/edit.svg";
import deleteIcon from "../../../../../../../assets/images/delete.svg";
import eyeIcon from "../../../../../../../assets/images/eye.svg";
import printIcon from "../../../../../../../assets/images/print.svg";
import logisticsWarehouseService from "../../../../../../../services/logisticsWarehouseService";
import packingTypeService from "../../../../../../../services/packingTypeService";
import useInboundOrderReducer from "../../../../../../../store/InboundOrderReducer";
import useLandingNoteReducer from "../../../../../../../store/LandingNoteReducer";
import useAlertReducer from "../../../../../../../store/AlertReducer";
import inboundOrderService from "../../../../../../../services/inboundOrderService";
import vehicleService from "../../../../../../../services/vehicleService";
import {
  splitApiDateTimeParts,
  buildApiDateTime,
  formatDisplayDateTime,
  nextDayOf,
} from "../../../../../../../shared/helpers/dateTimeFieldUtils";
import "../../../../../../../design/scss/material-edit-form.scss";
import "../../../../../../../design/scss/dispatch-note.scss";
import MaterialTablePagination from "./MaterialTablePagination";

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

// Generate dummy inbound orders data
const generateDummyInboundOrders = () => {
  const packageTypes = ["Box", "Pallet", "Crate", "Bag", "Container"];
  const descriptions = [
    "Spare parts for vessel maintenance",
    "Safety equipment and supplies",
    "Food and beverage items",
    "Technical equipment",
    "Cleaning supplies",
    "Medical supplies",
    "Office supplies",
    "Tools and hardware"
  ];

  const dummyOrders = [];
  for (let i = 1; i <= 10; i++) {
    const orderDate = new Date();
    orderDate.setDate(orderDate.getDate() - Math.floor(Math.random() * 30));

    dummyOrders.push({
      id: i,
      orderNo: `ORD-${String(i).padStart(5, '0')}`,
      date: orderDate.toISOString().split('T')[0],
      poDo: `PO-${String(i).padStart(4, '0')}`,
      quantity: Math.floor(Math.random() * 100) + 1,
      packageType: packageTypes[Math.floor(Math.random() * packageTypes.length)],
      description: descriptions[Math.floor(Math.random() * descriptions.length)],
    });
  }
  return dummyOrders;
};

// AttachmentsList Component (from Operation.jsx)
const AttachmentsList = ({ attachments = [], onAdd, onRemove, cardColor, isDragging, onDragEnter, onDragLeave, onDragOver, onDrop, fileInputRef, onFileInputChange }) => {
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

const InboundOrdersContent = ({ formValues, handleChange, cardColor }) => {
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

  const [showModal, setShowModal] = useState(false);


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

  const handleOpenModal = (order = null) => {
    if (order) {
      setEditingOrder(order);
      populateFormFromOrder(order);
      setShowModal(true);

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
      return;
    }

    setEditingOrder(null);
    setEditOrderMinDate(undefined);
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
        dispatchTime: "",
      }],
    });
    setExpandedOrders({ 1: true });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
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
    formData.orders.forEach((order, idx) => {
      if (!order.quantity) errors[`o${idx}_quantity`] = "Quantity is required";
      if (!order.packageType) errors[`o${idx}_packageType`] = "Package Type is required";
      if (order.transportation) {
        if (!order.typeOfVehicle) errors[`o${idx}_typeOfVehicle`] = "Vehicle type is required";
        if (!order.fromLocation) errors[`o${idx}_fromLocation`] = "From location is required";
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
      remarks: formData.remarks || "",
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
          handleCloseModal();
          getAllInbound({ call_id: callId, page: inboundPage, limit: INBOUND_LIMIT });
          getInboundOrdersTotal({ call_id: callId });
        },
      });
    } else {
      saveInboundOrder({
        data: payload,
        cb: () => {
          handleCloseModal();
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

  const renderHeader = () => (
    <>
      <h1 className="modal-title">{editingOrder ? "Edit Inbound Order" : "Add Inbound Order"}</h1>
    </>
  );

  const renderBody = () => (
    <div className="modal-body">
      <div className="lead-form">
        <form id="inboundOrderForm" className="material-edit-form" onSubmit={handleSubmit}>
          {/* Basic Details Section */}
          <div className="dispatch-edit-section">
            <h3 className="dispatch-edit-section-title">Basic Details</h3>
            <div className="row g-2 mb-2">
              <div className="col-md-6 mb-2">
                <FormField label="Date *">
                  <DateTimePickerField
                    dateValue={formData.date}
                    timeValue={formData.time}
                    onDateTimeChange={(nextValues) => {
                      setFormData((prev) => ({
                        ...prev,
                        date: nextValues.date,
                        time: nextValues.time,
                      }));
                      if (formErrors.date) setFormErrors((prev) => { const next = { ...prev }; delete next.date; return next; });
                    }}
                    dateFieldName="date"
                    timeFieldName="time"
                    placeholder="YYYY-MM-DD hh:mm"
                    minDate={editingOrder ? editOrderMinDate : undefined}
                  />
                </FormField>
                {formErrors.date && <span className="dispatch-edit-error">{formErrors.date}</span>}
              </div>

              <div className="col-md-6 mb-2">
                <FormField label="Warehouse *">
                  <FormSelect
                    value={formData.warehouse}
                    onChange={(e) => {
                      handleFormChange("warehouse", e.target.value);
                      if (formErrors.warehouse) setFormErrors((prev) => { const e = { ...prev }; delete e.warehouse; return e; });
                    }}
                    options={mergeOptionForValue(warehouseLocationOptions, formData.warehouse)}
                    placeholder="Select warehouse"
                  />
                </FormField>
                {formErrors.warehouse && <span className="dispatch-edit-error">{formErrors.warehouse}</span>}
              </div>

            </div>
          </div>

          {/* Order Details Section */}
          <div className="dispatch-edit-section">
            <div className="dispatch-section-header">
              <h3 className="dispatch-edit-section-title">Order Details</h3>
            </div>

            {formData.orders.map((order, index) => (
              <div key={order.id} className="dispatch-edit-item-card">
                <div className="dispatch-edit-item-header" onClick={() => toggleOrderExpand(order.id)}>
                  <span className="dispatch-edit-item-label">Order {index + 1}</span>
                  <div className="dispatch-item-actions">
                    {index === formData.orders.length - 1 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleAddNewOrder(); }}
                        className="dispatch-order-icon-btn"
                        title="Add order"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </button>
                    )}
                    {formData.orders.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleRemoveOrder(order.id); }}
                        className="dispatch-order-icon-btn dispatch-order-icon-btn--delete"
                        title="Remove order"
                      >
                        <img src={deleteIcon} alt="delete" />
                      </button>
                    )}
                    <svg
                      width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
                      className={`dispatch-edit-chevron${expandedOrders[order.id] ? " expanded" : ""}`}
                    >
                      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                {expandedOrders[order.id] && (
                  <div className="dispatch-edit-item-body">
                    <div className="row g-2 mb-2">
                      <div className="col-lg-4 col-md-6">
                        <FormField label="PO/DO">
                          <FormInput
                            type="text"
                            value={order.poDo}
                            onChange={(e) => {
                              handleOrderChange(order.id, "poDo", e.target.value);
                              if (formErrors[`o${index}_poDo`]) setFormErrors((prev) => { const e = { ...prev }; delete e[`o${index}_poDo`]; return e; });
                            }}
                            placeholder="Enter PO/DO number..."
                          />
                        </FormField>
                        {formErrors[`o${index}_poDo`] && <span className="dispatch-edit-error">{formErrors[`o${index}_poDo`]}</span>}
                      </div>

                      <div className="col-lg-4 col-md-6">
                        <FormField label="Quantity *">
                          <FormInput
                            type="number"
                            value={order.quantity}
                            onChange={(e) => {
                              handleOrderChange(order.id, "quantity", e.target.value);
                              if (formErrors[`o${index}_quantity`]) setFormErrors((prev) => { const e = { ...prev }; delete e[`o${index}_quantity`]; return e; });
                            }}
                            placeholder="Enter quantity..."
                          />
                        </FormField>
                        {formErrors[`o${index}_quantity`] && <span className="dispatch-edit-error">{formErrors[`o${index}_quantity`]}</span>}
                      </div>

                      <div className="col-lg-4 col-md-6">
                        <FormField label="Package Type *">
                          <FormSelect
                            value={order.packageType}
                            onChange={(e) => {
                              handleOrderChange(order.id, "packageType", e.target.value);
                              if (formErrors[`o${index}_packageType`]) setFormErrors((prev) => { const e = { ...prev }; delete e[`o${index}_packageType`]; return e; });
                            }}
                            options={mergeOptionForValue(packageTypeOptions, order.packageType)}
                            placeholder="Select package type..."
                          />
                        </FormField>
                        {formErrors[`o${index}_packageType`] && <span className="dispatch-edit-error">{formErrors[`o${index}_packageType`]}</span>}
                      </div>

                      <div className="col-lg-12 col-md-12">
                        <FormField label="Description">
                          <FormInput
                            type="text"
                            value={order.description}
                            onChange={(e) => handleOrderChange(order.id, "description", e.target.value)}
                            placeholder="Enter description..."
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
                            onChange={(e) => handleOrderChange(order.id, "transportation", e.target.checked)}
                          />
                          <span>Transportation</span>
                        </label>
                      </div>

                      {order.transportation && (() => {
                        const transportSteps = [
                          {
                            key: "driver",
                            icon: "user",
                            label: "Driver Name *",
                            value: order.driverName,
                            error: formErrors[`o${index}_driverName`],
                            field: (
                              <FormSelect
                                value={order.driverName}
                                onChange={(e) => {
                                  handleOrderChange(order.id, "driverName", e.target.value);
                                  if (formErrors[`o${index}_driverName`]) setFormErrors((prev) => { const e = { ...prev }; delete e[`o${index}_driverName`]; return e; });
                                }}
                                options={mergeOptionForValue(materialDriverOptions, order.driverName)}
                                placeholder="Select driver name..."
                              />
                            ),
                          },
                          {
                            key: "vehicle",
                            icon: "truck",
                            label: "Type of Vehicle *",
                            value: order.typeOfVehicle,
                            error: formErrors[`o${index}_typeOfVehicle`],
                            field: (
                              <FormSelect
                                value={order.typeOfVehicle}
                                onChange={(e) => {
                                  handleOrderChange(order.id, "typeOfVehicle", e.target.value);
                                  if (formErrors[`o${index}_typeOfVehicle`]) setFormErrors((prev) => { const e = { ...prev }; delete e[`o${index}_typeOfVehicle`]; return e; });
                                }}
                                options={mergeOptionForValue(materialVehicleOptions, order.typeOfVehicle)}
                                placeholder="Select type of vehicle..."
                              />
                            ),
                          },
                          {
                            key: "from",
                            icon: "pin",
                            label: "From Location *",
                            value: order.fromLocation,
                            error: formErrors[`o${index}_fromLocation`],
                            field: (
                              <FormSelect
                                value={order.fromLocation}
                                onChange={(e) => {
                                  handleOrderChange(order.id, "fromLocation", e.target.value);
                                  if (formErrors[`o${index}_fromLocation`]) setFormErrors((prev) => { const e = { ...prev }; delete e[`o${index}_fromLocation`]; return e; });
                                }}
                                options={mergeOptionForValue(transportLocationOptions, order.fromLocation)}
                                placeholder="Select from location..."
                              />
                            ),
                          },
                          {
                            key: "pickup",
                            icon: "target",
                            label: "Pick-Up From",
                            value: order.pickUpFrom,
                            field: (
                              <LocationMapPicker
                                value={order.pickUpFrom}
                                onChange={(e) => handleOrderChange(order.id, "pickUpFrom", e.target.value)}
                                placeholder="Enter pick-up location..."
                              />
                            ),
                          },
                          {
                            key: "to",
                            icon: "flag",
                            label: "To Location *",
                            value: order.toLocation,
                            error: formErrors[`o${index}_toLocation`],
                            field: (
                              <FormSelect
                                value={order.toLocation}
                                onChange={(e) => {
                                  handleOrderChange(order.id, "toLocation", e.target.value);
                                  if (formErrors[`o${index}_toLocation`]) setFormErrors((prev) => { const e = { ...prev }; delete e[`o${index}_toLocation`]; return e; });
                                }}
                                options={mergeOptionForValue(transportLocationOptions, order.toLocation)}
                                placeholder="To location..."
                              />
                            ),
                          },
                        ];
                        const allDone = transportSteps.every((s) => !!s.value);

                        const renderStepCard = (step, stepIdx) => {
                          const isDone = !!step.value;
                          const isCurrent = !isDone && transportSteps.slice(0, stepIdx).every((s) => !!s.value);
                          return (
                            <div key={step.key} className="dispatch-launch-hire-step dispatch-launch-hire-step--form" style={{ "--stagger-index": stepIdx }}>
                              <div className="dispatch-launch-hire-step-head">
                                <span className="dispatch-launch-hire-step-icon-wrap">
                                  <span
                                    className={`dispatch-launch-hire-step-icon dispatch-launch-hire-step-icon--transport${isCurrent ? " dispatch-launch-hire-step-icon--highlight-transport" : ""}`}
                                  >
                                    {renderLaunchHireStepIcon(step.icon)}
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
                                {step.error && <span className="dispatch-edit-error">{step.error}</span>}
                              </div>
                            </div>
                          );
                        };

                        const renderTrack = (key) => (
                          <div key={`${key}-track`} className="dispatch-launch-hire-track" aria-hidden="true">
                            <span className="dispatch-launch-hire-track-line dispatch-launch-hire-track-line--transport" />
                            <span className="dispatch-launch-hire-track-boat dispatch-launch-hire-track-boat--transport">
                              {renderLaunchHireStepIcon("truck")}
                            </span>
                          </div>
                        );

                        const journeySteps = transportSteps.slice(1); // vehicle -> from -> pickup -> to

                        return (
                          <div className="dispatch-launch-hire-card dispatch-transport-form-card">
                            {/* Row 1: Driver, standalone. */}
                            <div className="dispatch-launch-hire-steps dispatch-launch-hire-steps--form dispatch-transport-form-steps dispatch-transport-form-steps--single">
                              {renderStepCard(transportSteps[0], 0)}
                            </div>

                            {/* Row 2: the journey — Vehicle -> From -> Pick-Up -> To Location. */}
                            <div className="dispatch-launch-hire-steps dispatch-launch-hire-steps--form dispatch-transport-form-steps">
                              {journeySteps.map((step, i) => {
                                const stepIdx = i + 1;
                                return (
                                  <Fragment key={step.key}>
                                    {renderStepCard(step, stepIdx)}
                                    {i < journeySteps.length - 1 && renderTrack(step.key)}
                                  </Fragment>
                                );
                              })}
                            </div>

                            {/* Row 3: Done. */}
                            <div className="dispatch-launch-hire-steps dispatch-launch-hire-steps--form dispatch-transport-form-steps dispatch-transport-form-steps--single">
                              <div className={`dispatch-transport-track-node${allDone ? " dispatch-transport-track-node--done" : ""}`}>
                                <span className="dispatch-launch-hire-step-icon-wrap">
                                  <span className={`dispatch-launch-hire-step-icon${allDone ? " dispatch-launch-hire-step-icon--done" : " dispatch-launch-hire-step-icon--transport"}`}>
                                    {renderLaunchHireStepIcon("check")}
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
                )}
              </div>
            ))}
          </div>

          {/* Launch Hire Section */}
          <div className="dispatch-edit-section">
            <div className="dispatch-edit-checkbox-group">
              <label className="dispatch-edit-checkbox-label">
                <input
                  type="checkbox"
                  className="dispatch-edit-checkbox"
                  checked={formData.launchHire || false}
                  onChange={(e) => handleFormChange("launchHire", e.target.checked)}
                />
                <span>Launch Hire</span>
              </label>
            </div>

            {formData.launchHire && (
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
                      <span className="dispatch-launch-hire-step-label">Booking Date &amp; Time</span>
                    </div>
                    <div className="dispatch-launch-hire-step-field">
                      <DateTimePickerField
                        dateValue={formData.launchHireDate}
                        timeValue={formData.launchHireTime}
                        onDateTimeChange={(nextValues) => {
                          setFormData((prev) => ({
                            ...prev,
                            launchHireDate: nextValues.date,
                            launchHireTime: nextValues.time,
                          }));
                        }}
                        dateFieldName="launchHireDate"
                        timeFieldName="launchHireTime"
                        placeholder="YYYY-MM-DD hh:mm"
                      />
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
                      <span className="dispatch-launch-hire-step-label">Location</span>
                    </div>
                    <div className="dispatch-launch-hire-step-field">
                      <FormSelect
                        value={formData.launchHireLocation}
                        onChange={(e) => handleFormChange("launchHireLocation", e.target.value)}
                        options={mergeOptionForValue(launchHireLocationOptions, formData.launchHireLocation)}
                        placeholder="Select location..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Remarks - after order details */}
          <div className="row g-2 mt-2">
            <div className="col-md-12">
              <FormField label="Remarks">
                <FormTextarea
                  value={formData.remarks}
                  onChange={(e) => handleFormChange("remarks", e.target.value)}
                  placeholder="Enter remarks..."
                  rows={3}
                />
              </FormField>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  const renderFooter = () => (
    <div className="modal-footer justify-content-between">
      <button type="button" onClick={handleReset} className="btn btn-outline-secondary">
        Reset
      </button>
      <div className="d-flex gap-2">
        <button type="button" onClick={handleCloseModal} className="btn btn-secondary">
          Cancel
        </button>
        <button
          type="submit"
          form="inboundOrderForm"
          disabled={isSubmitting || isBeingUpdated}
          className="btn btn-primary"
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
                    placeholder="YYYY-MM-DD hh:mm"
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
                            readOnly={!!order.inbound_item_id}
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
                            readOnly={!!order.inbound_item_id}
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
                            readOnly={!!order.inbound_item_id}
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
                            readOnly={!!order.inbound_item_id}
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
                        <div className="dispatch-launch-hire-steps dispatch-launch-hire-steps--form dispatch-transport-form-steps">
                          {[
                            {
                              key: "vehicle",
                              icon: "truck",
                              label: "Type of Vehicle",
                              field: (
                                <FormSelect
                                  value={order.typeOfVehicle}
                                  onChange={(e) => handleConvertOrderChange(order.id, "typeOfVehicle", e.target.value)}
                                  options={mergeOptionForValue(materialVehicleOptions, order.typeOfVehicle)}
                                  placeholder="Select type of vehicle..."
                                  disabled={!!order.inbound_item_id}
                                />
                              ),
                            },
                            {
                              key: "from",
                              icon: "pin",
                              label: "From Location",
                              field: (
                                <FormSelect
                                  value={order.fromLocation}
                                  onChange={(e) => handleConvertOrderChange(order.id, "fromLocation", e.target.value)}
                                  options={mergeOptionForValue(transportLocationOptions, order.fromLocation)}
                                  placeholder="Select from location..."
                                  disabled={!!order.inbound_item_id}
                                />
                              ),
                            },
                            {
                              key: "pickup",
                              icon: "target",
                              label: "Pick-Up From",
                              field: (
                                <FormInput
                                  type="text"
                                  value={order.pickUpFrom}
                                  onChange={(e) => handleConvertOrderChange(order.id, "pickUpFrom", e.target.value)}
                                  placeholder="Enter pick-up location..."
                                  readOnly={!!order.inbound_item_id}
                                  disabled={!!order.inbound_item_id}
                                />
                              ),
                            },
                            {
                              key: "to",
                              icon: "flag",
                              label: "To Location",
                              field: (
                                <FormSelect
                                  value={order.toLocation}
                                  onChange={(e) => handleConvertOrderChange(order.id, "toLocation", e.target.value)}
                                  options={mergeOptionForValue(transportLocationOptions, order.toLocation)}
                                  placeholder="Select to location..."
                                  disabled={!!order.inbound_item_id}
                                />
                              ),
                            },
                            {
                              key: "driver",
                              icon: "user",
                              label: "Driver Name",
                              field: (
                                <FormSelect
                                  value={order.driverName}
                                  onChange={(e) => handleConvertOrderChange(order.id, "driverName", e.target.value)}
                                  options={mergeOptionForValue(materialDriverOptions, order.driverName)}
                                  placeholder="Select driver name..."
                                  disabled={!!order.inbound_item_id}
                                />
                              ),
                            },
                          ].map((step, stepIdx, steps) => (
                            <Fragment key={step.key}>
                              <div className="dispatch-launch-hire-step dispatch-launch-hire-step--form" style={{ "--stagger-index": stepIdx }}>
                                <div className="dispatch-launch-hire-step-head">
                                  <span className="dispatch-launch-hire-step-icon-wrap">
                                    <span className="dispatch-launch-hire-step-icon dispatch-launch-hire-step-icon--transport">
                                      {renderLaunchHireStepIcon(step.icon)}
                                    </span>
                                    <span className="dispatch-launch-hire-step-num">{stepIdx + 1}</span>
                                  </span>
                                  <span className="dispatch-launch-hire-step-label">{step.label}</span>
                                </div>
                                <div className="dispatch-launch-hire-step-field">
                                  {step.field}
                                </div>
                              </div>
                              {stepIdx < steps.findIndex((s) => s.key === "to") && (
                                <div className="dispatch-launch-hire-track" aria-hidden="true">
                                  <span className="dispatch-launch-hire-track-line dispatch-launch-hire-track-line--transport" />
                                  <span className="dispatch-launch-hire-track-boat dispatch-launch-hire-track-boat--transport">
                                    {renderLaunchHireStepIcon("truck")}
                                  </span>
                                </div>
                              )}
                            </Fragment>
                          ))}
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
                          <FormField label="Dispatch Date">
                            <DateTimePickerField
                              dateValue={order.dispatchDate}
                              timeValue={order.dispatchTime}
                              onDateTimeChange={(v) => {
                                handleConvertOrderChange(order.id, "dispatchDate", v.date);
                                handleConvertOrderChange(order.id, "dispatchTime", v.time);
                              }}
                              dateFieldName="dispatchDate"
                              timeFieldName="dispatchTime"
                              placeholder="YYYY-MM-DD hh:mm"
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
      {viewingOrder && (
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
    <div className="cardform-left-full material-management-content-wrapper" style={{ "--card-color": cardColor }}>
      <div className="material-list-header">
        <h3 className="material-list-title">
          <span className="material-list-title-bar"></span>
          Inbound Orders
        </h3>
        <button
          type="button"
          className="material-add-btn"
          onClick={() => handleOpenModal()}
        >
          + Add
        </button>
      </div>
      <div className="table-wrapper table-responsive material-table-container note-table-container">
        <div className="note-table-scroll">
          <table className="table table-striped material-table inbound-table note-table">
            <thead className="note-thead">
              <tr>
                <th>Order No</th>
                <th>Date</th>
                <th>PO/DO</th>
                <th>Quantity</th>
                <th>Package Type</th>
                <th>Description</th>
                <th className="note-actions-th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingOrders ? (
                <tr>
                  <td colSpan="7" className="note-empty-td">Loading...</td>
                </tr>
              ) : inboundOrders.length > 0 ? (
                inboundOrders.map((order) => {
                  const firstItem = Array.isArray(order.items) ? order.items[0] : null;
                  const rowKey = order.inbound_id ?? order.id ?? Math.random();
                  const description = firstItem?.description || "";
                  return (
                    <tr key={rowKey}>
                      <td>
                        <div className="material-table-cell">{order.inbound_no || ""}</div>
                      </td>
                      <td>
                        <div className="material-table-cell">
                          {formatDate(order.inbound_date || order.date, order.inbound_time || order.time)}
                        </div>
                      </td>
                      <td>
                        <div className="material-table-cell">{firstItem?.po_do_no ?? firstItem?.po_no ?? ""}</div>
                      </td>
                      <td>
                        <div className="material-table-cell">{firstItem?.quantity ?? ""}</div>
                      </td>
                      <td>
                        <div className="material-table-cell">
                          {firstItem?.package_type ||
                            packageTypeOptions.find((o) => o.value === String(firstItem?.package_type_id))?.label ||
                            ""}
                        </div>
                      </td>
                      <td>
                        <div className="material-table-cell">
                          {description.length > 25 ? (
                            <>
                              <Tooltip
                                id={`description-tooltip-${rowKey}`}
                                place="right"
                                content={description}
                                className="material-table-tooltip"
                              />
                              <span
                                data-tooltip-id={`description-tooltip-${rowKey}`}
                                className="note-desc-tip"
                              >
                                {description.substring(0, 25)}...
                              </span>
                            </>
                          ) : (
                            <span>{description}</span>
                          )}
                        </div>
                      </td>
                      <td className="note-actions-td">
                        <div className="material-table-cell note-actions-cell">
                          <Tooltip id={`view-order-${rowKey}`} place="left" content="View" />
                          <button
                            type="button"
                            onClick={() => handleViewOrder(order)}
                            data-tooltip-id={`view-order-${rowKey}`}
                            className="note-action-btn"
                          >
                            <img src={eyeIcon} alt="view" className="note-action-icon" />
                          </button>
                          <Tooltip id={`print-order-${rowKey}`} place="left" content="Print" />
                          <button
                            type="button"
                            onClick={() => handlePrintOrder(order)}
                            data-tooltip-id={`print-order-${rowKey}`}
                            disabled={printingId === resolveInboundId(order)}
                            className="print-action-icon-wrap"
                          >
                            {printingId === resolveInboundId(order) ? (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="icon-spinning">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                              </svg>
                            ) : (
                              <img src={printIcon} alt="print" className="material-action-icon" />
                            )}
                          </button>
                          <Tooltip id={`convert-order-${rowKey}`} place="left" content=" Convert" />
                          <button
                            type="button"
                            onClick={() => handleConvertToLanding(order)}
                            data-tooltip-id={`convert-order-${rowKey}`}
                            className="note-action-btn"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M2 18L4 16L6 18L8 16L10 18L12 16L14 18L16 16L18 18L20 16L22 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M2 10L12 4L22 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M12 4V18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                          <div className={`action-dropdown-wrapper${openDropdownId === rowKey ? " action-dropdown-wrapper--open" : ""}`}>
                            <Tooltip id={`more-actions-${rowKey}`} place="left" content="More actions" />
                            <button
                              type="button"
                              onClick={(e) => handleToggleDropdown(rowKey, e)}
                              data-tooltip-id={`more-actions-${rowKey}`}
                              className="note-action-btn"
                            >
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="6" r="1.5" fill="currentColor" />
                                <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                                <circle cx="12" cy="18" r="1.5" fill="currentColor" />
                              </svg>
                            </button>
                            {openDropdownId === rowKey && createPortal(
                              <div
                                data-dropdown-menu
                                className="dispatch-note-dropdown-menu"
                                style={{ top: `${dropdownPosition.top}px`, right: `${dropdownPosition.right}px` }}
                              >
                                <button
                                  type="button"
                                  onClick={() => { handleCloseDropdown(); handleOpenModal(order); }}
                                  className="dispatch-note-dropdown-btn"
                                >
                                  <img src={editIcon} alt="edit" className="dispatch-note-dropdown-icon" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { handleDelete(order); }}
                                  className="dispatch-note-dropdown-btn dispatch-note-dropdown-btn--danger"
                                >
                                  <img src={deleteIcon} alt="delete" className="dispatch-note-dropdown-icon" />
                                  <span>Delete</span>
                                </button>
                              </div>,
                              document.body
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="note-empty-td">
                    No inbound orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <MaterialTablePagination
          page={inboundPage}
          total={inboundTotal}
          limit={INBOUND_LIMIT}
          onPageChange={setInboundPage}
        />
      </div>

      <CustomModal
        className="material-management-modal inbound-orders-modal"
        show={showModal}
        closeModal={handleCloseModal}
        header={renderHeader()}
        body={renderBody()}
        footer={renderFooter()}
        dialgName="modal-dialog modal-dialog-centered"
      />

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
};

export default InboundOrdersContent;

