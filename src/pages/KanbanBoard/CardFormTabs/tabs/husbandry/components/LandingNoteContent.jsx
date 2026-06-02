import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import CustomModal from "../../../../../../components/CustomModal";
import { FormField, FormInput, FormSelect, ReactQuillEditor } from "./Husbandry.components";
import DateTimePickerField from "../../../components/DateTimePickerField";
import MaterialTablePagination from "./MaterialTablePagination";
import editIcon from "../../../../../../assets/images/edit.svg";
import deleteIcon from "../../../../../../assets/images/delete.svg";
import eyeIcon from "../../../../../../assets/images/eye.svg";
import useLandingNoteReducer from "../../../../../../store/LandingNoteReducer";
import logisticsWarehouseService from "../../../../../../services/logisticsWarehouseService";
import vehicleService from "../../../../../../services/vehicleService";
import driverService from "../../../../../../services/driverService";

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

const emptyConvertItem = () => ({
  id: 1,
  landing_note_item_id: null,
  orderNo: "",
  poDo: "",
  quantity: "",
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

const buildDispatchConvertOrders = (note) => {
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
    return {
      id: idx + 1,
      landing_note_item_id: getLandingNoteItemId(item),
      orderNo: item.order_no || note?.landingNoteNo || note?.landing_note_no || "",
      poDo: item.po_no || note?.poDo || "",
      quantity: item.quantity ? String(item.quantity) : "",
      packageType: String(item.package_type_id || ""),
      description: item.description || "",
      slot: normalizeSlotValue(item.slot ?? item.slot_no ?? item.slot_no_id),
      reason: item.reason ?? item.reason_name ?? "",
      packing_required: isTruthyFlag(item.packing_required) || repackingPallets !== "" || repackingRolls !== "",
      repacking_pallets: repackingPallets,
      repacking_rolls: repackingRolls,
      transportation_required: isTruthyFlag(item.transportation_required) || Boolean(transportation),
      typeOfVehicle: transportation ? String(transportation.vehicle_type_id || "") : "",
      fromLocation: transportation ? String(transportation.from_location_id || "") : "",
      pickUpFrom: transportation?.pickup_location || "",
      toLocation: transportation ? String(transportation.to_location_id || "") : "",
      driverName: transportation ? String(transportation.driver_id || "") : "",
      transportRemarks: transportation?.remarks || "",
    };
  });
};

const LandingNoteContent = ({ formValues, handleChange, cardColor }) => {
  const {
    updateLandingNote,
    convertLandingNote,
    getAllLandingNotes,
    getLandingNoteById,
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
        const [whRes, vehRes, drvRes] = await Promise.all([
          logisticsWarehouseService.getWarehouseLocations(),
          vehicleService.getAllTransportVehicles(),
          driverService.getAllDrivers(),
        ]);
        if (cancelled) return;
        const whRows = Array.isArray(whRes?.data) ? whRes.data : whRes?.data?.data ?? [];
        setWarehouseOptions(whRows.map((r) => ({ value: String(r.location_id ?? ""), label: String(r.location ?? "") })).filter((o) => o.value));
        setLocationOptions(whRows.map((r) => ({ value: String(r.location_id ?? ""), label: String(r.location ?? "") })).filter((o) => o.value));
        const vehRows = Array.isArray(vehRes?.data) ? vehRes.data : vehRes?.data?.data ?? [];
        setVehicleOptions(vehRows.map((r) => ({ value: String(r.vehicle_type_id ?? ""), label: String(r.vehicle_name ?? "") })).filter((o) => o.value));
        const drvRows = Array.isArray(drvRes?.data) ? drvRes.data : drvRes?.data?.data ?? [];
        setDriverOptions(drvRows.map((r) => ({ value: String(r.driver_id ?? ""), label: String(r.driver_name ?? "") })).filter((o) => o.value));
      } catch (err) {
        console.error("Failed to load reference data", err);
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
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertFormErrors, setConvertFormErrors] = useState({});
  const [showViewModal, setShowViewModal] = useState(false);
  const [notesList, setNotesList] = useState([]);
  const [editingNote, setEditingNote] = useState(null);
  const [convertingNote, setConvertingNote] = useState(null);
  const [viewingNote, setViewingNote] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileInputRef = useRef(null);
  const [isDraggingDocuments, setIsDraggingDocuments] = useState(false);
  const documentsFileInputRef = useRef(null);
  const [expandedConvertOrders, setExpandedConvertOrders] = useState({ 1: true });
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const [landingPage, setLandingPage] = useState(1);
  const LANDING_LIMIT = 10;
  const dropdownButtonRefs = useRef({});

  // Form state
  const [formData, setFormData] = useState({
    landingNoteNo: "",
    date: "",
    time: "",
    poDo: "",
    landingProof: [],
    quantity: "",
    packageType: "",
    description: "",
  });

  useEffect(() => {
    const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);
    if (!callId) return;
    getAllLandingNotes({ call_id: callId, page: landingPage, limit: LANDING_LIMIT });
  }, [formValues?.call_id, formValues?.callId, formValues?.card_call_id, landingPage]);

  useEffect(() => {
    if (Array.isArray(landingNotes) && landingNotes.length > 0) {
      setNotesList(landingNotes.map(mapLandingNoteForDisplay));
      return;
    }
    setNotesList(Array.isArray(formValues.landingNoteList) ? formValues.landingNoteList : []);
  }, [landingNotes, formValues.landingNoteList]);

  const handleOpenModal = (note = null) => {
    if (note) {
      setEditingNote(note);
      setFormData({
        landingNoteNo: note.landingNoteNo || "",
        date: note.date || "",
        time: note.time || "",
        poDo: note.poDo || "",
        landingProof: note.landingProof || [],
        quantity: note.quantity || "",
        packageType: note.packageType || "",
        description: note.description || "",
      });
      setSelectedFiles(note.landingProof || []);
    } else {
      setEditingNote(null);
      setFormData({
        landingNoteNo: "",
        date: "",
        time: "",
        poDo: "",
        landingProof: [],
        quantity: "",
        packageType: "",
        description: "",
      });
      setSelectedFiles([]);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingNote(null);
    setFormData({
      landingNoteNo: "",
      date: "",
      time: "",
      poDo: "",
      landingProof: [],
      quantity: "",
      packageType: "",
      description: "",
    });
    setSelectedFiles([]);
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (editingNote) {
      const payload = new FormData();
      payload.append("landing_date", formData.date);
      payload.append("inbound_id", editingNote.inbound_id || "");
      payload.append("warehouse_id", formData.warehouse_id || "");
      payload.append("received_from", formData.received_from || "");
      payload.append("location", formData.location || "");
      payload.append("signature", formData.signature || "");
      payload.append("remarks", formData.remarks || "");
      selectedFiles.forEach((file) => {
        if (file instanceof File) {
          payload.append("file", file);
        }
      });
      if (editingNote.items && editingNote.items.length > 0) {
        editingNote.items.forEach((item, index) => {
          payload.append(`items[${index}][inbound_item_id]`, item.inbound_item_id || "");
          payload.append(`items[${index}][quantity]`, item.quantity || "");
          payload.append(`items[${index}][transportation_required]`, item.transportation_required || 0);
        });
      }

      const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);
      updateLandingNote({
        landingNoteId: editingNote.id,
        data: payload,
        cb: () => {
          handleCloseModal();
          getAllLandingNotes({ call_id: callId, page: landingPage, limit: LANDING_LIMIT });
        },
      });
      return;
    } else {
      // Create new note
      const newNote = {
        id: notesList.length > 0 ? Math.max(...notesList.map(m => m.id)) + 1 : 1,
        landingNoteNo: formData.landingNoteNo || `LN-${String(notesList.length + 1).padStart(5, '0')}`,
        date: formData.date,
        poDo: formData.poDo,
        landingProof: selectedFiles,
        quantity: formData.quantity,
        packageType: formData.packageType,
        description: formData.description,
      };

      const updatedList = [...notesList, newNote];
      setNotesList(updatedList);

      // Update formValues
      const syntheticEvent = { target: { value: updatedList } };
      handleChange("landingNoteList")(syntheticEvent);
    }

    handleCloseModal();
  };

  // File upload handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    handleFiles(files);
  };

  const handleFiles = (files) => {
    const validFiles = files.filter((file) => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      const validTypes = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];
      const fileExtension = "." + file.name.split(".").pop().toLowerCase();
      return file.size <= maxSize && validTypes.includes(fileExtension);
    });

    setSelectedFiles((prev) => [...prev, ...validFiles]);
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
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

  const packageTypeOptions = [
    { value: "Box", label: "Box" },
    { value: "Pallet", label: "Pallet" },
    { value: "Crate", label: "Crate" },
    { value: "Bag", label: "Bag" },
    { value: "Container", label: "Container" },
  ];

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
  });


  const handleConvertToDispatch = (note) => {
    handleCloseDropdown();
    setConvertingNote(note);
    const orders = buildDispatchConvertOrders(note);
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
    });
    setExpandedConvertOrders(exp);
    setShowConvertModal(true);

    const landingNoteId = note?.landing_note_id ?? note?.id;
    if (landingNoteId != null && getLandingNoteById) {
      getLandingNoteById({
        id: landingNoteId,
        cb: (detail) => {
          if (!detail) return;
          const normalizedDetail = mapLandingNoteForDisplay(detail);
          const detailOrders = buildDispatchConvertOrders(normalizedDetail);
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
    setConvertFormErrors({});
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

  const validateConvertForm = () => {
    const errors = {};
    if (!convertFormData.dispatch_date) errors.dispatch_date = "Date is required";
    if (!convertFormData.warehouse_id) errors.warehouse_id = "Warehouse is required";
    if (!convertFormData.delivery_location) errors.delivery_location = "Delivery location is required";
    if (!convertFormData.delivered_to) errors.delivered_to = "Deliver to is required";
    convertFormData.orders.forEach((order, idx) => {
      if (!order.quantity) errors[`co${idx}_quantity`] = "Quantity is required";
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
    fd.append("remarks", convertFormData.remarks || "");
    if (convertFormData.documents?.length > 0) fd.append("file", convertFormData.documents[0].file ?? convertFormData.documents[0]);
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
        if (callId) getAllLandingNotes({ call_id: callId, page: landingPage, limit: LANDING_LIMIT });
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
  };

  const handleCloseViewModal = () => {
    setShowViewModal(false);
    setViewingNote(null);
  };

  const handlePrintNote = (note) => {
    handleCloseDropdown();
    const printWindow = window.open('', '_blank');
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print - Landing Note ${note.landingNoteNo || ''}</title>
          <style>
            body {
              font-family: "Open Sans", sans-serif;
              padding: 20px;
              color: #333;
            }
            .print-header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #00368c;
              padding-bottom: 15px;
            }
            .print-header h1 {
              color: #00368c;
              margin: 0;
              font-size: 24px;
            }
            .print-section {
              margin-bottom: 25px;
            }
            .print-section-title {
              font-size: 18px;
              font-weight: bold;
              color: #00368c;
              margin-bottom: 15px;
              border-bottom: 1px solid #e2e2ea;
              padding-bottom: 8px;
            }
            .print-row {
              display: flex;
              margin-bottom: 12px;
            }
            .print-label {
              font-weight: 600;
              width: 200px;
              color: #666;
            }
            .print-value {
              flex: 1;
              color: #1a1a1a;
            }
            .print-footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e2e2ea;
              text-align: center;
              color: #666;
              font-size: 12px;
            }
            @media print {
              body { margin: 0; padding: 15px; }
              .print-footer { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h1>Landing Note Details</h1>
          </div>
          
          <div class="print-section">
            <div class="print-section-title">Note Information</div>
            <div class="print-row">
              <div class="print-label">Landing Note No:</div>
              <div class="print-value">${note.landingNoteNo || "-"}</div>
            </div>
            <div class="print-row">
              <div class="print-label">Date:</div>
              <div class="print-value">${formatDate(note.date) || "-"}</div>
            </div>
            <div class="print-row">
              <div class="print-label">PO/DO:</div>
              <div class="print-value">${note.poDo || "-"}</div>
            </div>
            <div class="print-row">
              <div class="print-label">Quantity:</div>
              <div class="print-value">${note.quantity || "-"}</div>
            </div>
            <div class="print-row">
              <div class="print-label">Package Type:</div>
              <div class="print-value">${note.packageType || "-"}</div>
            </div>
            <div class="print-row">
              <div class="print-label">Description:</div>
              <div class="print-value">${note.description || "-"}</div>
            </div>
            <div class="print-row">
              <div class="print-label">Landing Proof:</div>
              <div class="print-value">${note.landingProof && note.landingProof.length > 0 ? `${note.landingProof.length} file(s)` : "No files"}</div>
            </div>
          </div>

          <div class="print-footer">
            <p>Printed on ${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const renderHeader = () => (
    <>
      <h1 className="modal-title">{editingNote ? "Edit Landing Note" : "Add Landing Note"}</h1>
    </>
  );

  const renderBody = () => (
    <div className="modal-body">
      <div className="lead-form">
        <form id="landingNoteForm" onSubmit={handleSubmit}>
          <div className="permInputs row mb-lg-3">
            <div className="col-12 mb-3">
              <FormField label="Landing Note No">
                <FormInput
                  type="text"
                  value={formData.landingNoteNo}
                  onChange={(e) => handleFormChange("landingNoteNo", e.target.value)}
                  placeholder="Enter landing note number..."
                />
              </FormField>
            </div>

            <div className="col-12 mb-3">
              <FormField label="Date">
                <DateTimePickerField
                  dateValue={formData.date}
                  timeValue={formData.time}
                  onDateTimeChange={(nextValues) =>
                    setFormData((prev) => ({ ...prev, date: nextValues.date, time: nextValues.time }))
                  }
                  dateFieldName="date"
                  timeFieldName="time"
                  placeholder="YYYY-MM-DD hh:mm"
                />
              </FormField>
            </div>

            <div className="col-12 mb-3">
              <FormField label="PO/DO">
                <FormInput
                  type="text"
                  value={formData.poDo}
                  onChange={(e) => handleFormChange("poDo", e.target.value)}
                  placeholder="Enter PO/DO number..."
                />
              </FormField>
            </div>

            <div className="col-12 mb-3">
              <FormField label="Landing Proof">
                <div className="document-upload-wrapper">
                  <div
                    className={`document-upload-zone ${isDragging ? "dragging" : ""}`}
                    onDragEnter={handleDragEnter}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={handleBrowseClick}
                    style={{ "--card-color": cardColor || "#00368c" }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      id="landingProofDocuments"
                      multiple
                      onChange={handleFileChange}
                      className="file-input-hidden"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
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
                  {selectedFiles.length > 0 && (
                    <div className="document-file-preview-list">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="document-file-preview-item">
                          <div className="document-file-preview-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                          <div className="document-file-preview-info">
                            <span className="document-file-preview-name">{file.name}</span>
                            <span className="document-file-preview-size">
                              {file.size < 1024 * 1024
                                ? `${(file.size / 1024).toFixed(1)} KB`
                                : `${(file.size / 1024 / 1024).toFixed(2)} MB`}
                            </span>
                          </div>
                          <button
                            className="document-file-preview-remove"
                            onClick={(e) => { e.stopPropagation(); handleRemoveFile(index); }}
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
              </FormField>
            </div>

            <div className="col-12 mb-3">
              <FormField label="Quantity">
                <FormInput
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => handleFormChange("quantity", e.target.value)}
                  placeholder="Enter quantity..."
                />
              </FormField>
            </div>

            <div className="col-12 mb-3">
              <FormField label="Package Type">
                <FormSelect
                  value={formData.packageType}
                  onChange={(e) => handleFormChange("packageType", e.target.value)}
                  options={packageTypeOptions}
                  placeholder="Select package type..."
                />
              </FormField>
            </div>

            <div className="col-12 mb-3">
              <FormField label="Description">
                <FormInput
                  type="text"
                  value={formData.description}
                  onChange={(e) => handleFormChange("description", e.target.value)}
                  placeholder="Enter description..."
                />
              </FormField>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  const renderFooter = () => (
    <div className="modal-footer">
      <button
        type="button"
        className="btn btn-secondary"
        onClick={handleCloseModal}
      >
        Cancel
      </button>
      <button
        type="submit"
        form="landingNoteForm"
        className="btn btn-primary"
        style={{ backgroundColor: "#00368c", opacity: isLoadingUpdateLandingNote ? 0.7 : 1, cursor: isLoadingUpdateLandingNote ? "not-allowed" : "pointer" }}
        disabled={isLoadingUpdateLandingNote}
      >
        {editingNote ? (isLoadingUpdateLandingNote ? "Updating..." : "Update Note") : "Add Note"}
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

          {/* Info: Landing Note No */}
          {convertingNote && (
            <div style={{ marginBottom: "16px", padding: "10px 14px", background: "#f0f4ff", borderRadius: "8px", fontSize: "13px", color: "#00368c" }}>
              <strong>Landing Note:</strong> {convertingNote.landingNoteNo || convertingNote.landing_note_no || "-"}
              &nbsp;&nbsp;|&nbsp;&nbsp;
              <strong>Dispatch Note No:</strong> Auto-generated by system
            </div>
          )}

          {/* Basic Details */}
          <div style={{ marginBottom: "24px", paddingBottom: "20px", borderBottom: "1px solid #e2e2ea" }}>
            <h3 style={{ fontSize: "15px", fontWeight: "600", marginBottom: "14px", color: "#1a1a1a" }}>Basic Details</h3>
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
                  />
                  {convertFormErrors.dispatch_date && <span style={{ color: "#dc3545", fontSize: "12px" }}>{convertFormErrors.dispatch_date}</span>}
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
                  {convertFormErrors.warehouse_id && <span style={{ color: "#dc3545", fontSize: "12px" }}>{convertFormErrors.warehouse_id}</span>}
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
                  {convertFormErrors.delivery_location && <span style={{ color: "#dc3545", fontSize: "12px" }}>{convertFormErrors.delivery_location}</span>}
                </FormField>
              </div>
              <div className="col-md-4 mb-2">
                <FormField label="Delivered To *">
                  <FormInput type="text" value={convertFormData.delivered_to} onChange={(e) => { handleConvertFormChange("delivered_to", e.target.value); setConvertFormErrors((p) => { const n = { ...p }; delete n.delivered_to; return n; }); }} placeholder="Enter person name..." className={convertFormErrors.delivered_to ? "is-invalid" : ""} />
                  {convertFormErrors.delivered_to && <span style={{ color: "#dc3545", fontSize: "12px" }}>{convertFormErrors.delivered_to}</span>}
                </FormField>
              </div>
            </div>
          </div>

          {/* Order Details */}
          <div style={{ marginBottom: "24px", paddingBottom: "20px", borderBottom: "1px solid #e2e2ea" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "600", margin: 0, color: "#1a1a1a" }}>Order Details</h3>
              <button type="button" onClick={handleAddNewConvertOrder} style={{ padding: "8px 16px", backgroundColor: "#00368c", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>+ Add Order</button>
            </div>

            {convertFormData.orders.map((order, index) => (
              <div key={order.id} style={{ marginBottom: "12px", border: "1px solid #e2e2ea", borderRadius: "8px", overflow: "hidden" }}>
                <div onClick={() => toggleConvertOrderExpand(order.id)} style={{ padding: "10px 16px", backgroundColor: "#f8f9fa", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a" }}>Order {index + 1}</span>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    {convertFormData.orders.length > 1 && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleRemoveConvertOrder(order.id); }} style={{ padding: "4px 10px", backgroundColor: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>Remove</button>
                    )}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ transform: expandedConvertOrders[order.id] ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                      <path d="M6 9L12 15L18 9" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                {expandedConvertOrders[order.id] && (
                  <div style={{ padding: "16px", backgroundColor: "white" }}>
                    {/* Order Info */}
                    <div className="row g-2 mb-2">
                      <div className="col-md-4">
                        <FormField label="Order No">
                          <FormInput type="text" value={order.orderNo} onChange={(e) => handleConvertOrderChange(order.id, "orderNo", e.target.value)} placeholder="Order number..." />
                        </FormField>
                      </div>
                      <div className="col-md-4">
                        <FormField label="PO/DO">
                          <FormInput type="text" value={order.poDo} onChange={(e) => handleConvertOrderChange(order.id, "poDo", e.target.value)} placeholder="PO/DO..." />
                        </FormField>
                      </div>
                      <div className="col-md-4">
                        <FormField label="Quantity *">
                          <FormInput type="text" inputMode="numeric" value={order.quantity} onChange={(e) => { const val = e.target.value; if (val === "" || /^\d+$/.test(val)) { handleConvertOrderChange(order.id, "quantity", val); setConvertFormErrors((p) => { const n = { ...p }; delete n[`co${index}_quantity`]; return n; }); } }} placeholder="Quantity..." className={convertFormErrors[`co${index}_quantity`] ? "is-invalid" : ""} />
                          {convertFormErrors[`co${index}_quantity`] && <span style={{ color: "#dc3545", fontSize: "12px" }}>{convertFormErrors[`co${index}_quantity`]}</span>}
                        </FormField>
                      </div>
                      <div className="col-md-6">
                        <FormField label="Description">
                          <FormInput type="text" value={order.description} onChange={(e) => handleConvertOrderChange(order.id, "description", e.target.value)} placeholder="Description..." />
                        </FormField>
                      </div>
                    </div>

                    {/* Dispatch Details */}
                    <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #e2e2ea" }}>
                      <p style={{ fontSize: "13px", fontWeight: "600", color: "#555", marginBottom: "10px" }}>Dispatch Details</p>
                      <div className="row g-2">
                        <div className="col-md-4">
                          <FormField label="Slot">
                            <FormSelect value={order.slot} onChange={(e) => handleConvertOrderChange(order.id, "slot", e.target.value)} options={slotOptions} placeholder="Select slot..." />
                          </FormField>
                        </div>
                        <div className="col-md-4">
                          <FormField label="Reason">
                            <FormSelect value={order.reason} onChange={(e) => handleConvertOrderChange(order.id, "reason", e.target.value)} options={reasonOptions} placeholder="Select reason..." />
                          </FormField>
                        </div>
                      </div>

                      {/* Packing Required */}
                      <div style={{ marginTop: "10px" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", marginBottom: "8px" }}>
                          <input type="checkbox" checked={order.packing_required || false} onChange={(e) => handleConvertOrderChange(order.id, "packing_required", e.target.checked)} style={{ cursor: "pointer", width: "16px", height: "16px" }} />
                          <span style={{ fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>Packing Required</span>
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
                      <div style={{ marginTop: "10px" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", marginBottom: "8px" }}>
                          <input type="checkbox" checked={order.transportation_required || false} onChange={(e) => handleConvertOrderChange(order.id, "transportation_required", e.target.checked)} style={{ cursor: "pointer", width: "16px", height: "16px" }} />
                          <span style={{ fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>Transportation Required</span>
                        </label>
                        {order.transportation_required && (
                          <div className="row g-2">
                            <div className="col-md-4">
                              <FormField label="Vehicle Type">
                                <FormSelect value={order.typeOfVehicle} onChange={(e) => handleConvertOrderChange(order.id, "typeOfVehicle", e.target.value)} options={vehicleOptions} placeholder="Select vehicle..." />
                              </FormField>
                            </div>
                            <div className="col-md-4">
                              <FormField label="From Location">
                                <FormSelect value={order.fromLocation} onChange={(e) => handleConvertOrderChange(order.id, "fromLocation", e.target.value)} options={locationOptions} placeholder="From location..." />
                              </FormField>
                            </div>
                            <div className="col-md-4">
                              <FormField label="Pick-Up From">
                                <FormInput type="text" value={order.pickUpFrom} onChange={(e) => handleConvertOrderChange(order.id, "pickUpFrom", e.target.value)} placeholder="Pick-up location..." />
                              </FormField>
                            </div>
                            <div className="col-md-4">
                              <FormField label="To Location">
                                <FormSelect value={order.toLocation} onChange={(e) => handleConvertOrderChange(order.id, "toLocation", e.target.value)} options={locationOptions} placeholder="To location..." />
                              </FormField>
                            </div>
                            <div className="col-md-4">
                              <FormField label="Driver">
                                <FormSelect value={order.driverName} onChange={(e) => handleConvertOrderChange(order.id, "driverName", e.target.value)} options={driverOptions} placeholder="Select driver..." />
                              </FormField>
                            </div>
                            <div className="col-md-4">
                              <FormField label="Remarks">
                                <FormInput type="text" value={order.transportRemarks} onChange={(e) => handleConvertOrderChange(order.id, "transportRemarks", e.target.value)} placeholder="Transport remarks..." />
                              </FormField>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Documents & Remarks */}
          <div>
            <h3 style={{ fontSize: "15px", fontWeight: "600", marginBottom: "14px", color: "#1a1a1a" }}>Documents & Remarks</h3>
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
    <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "12px", padding: "16px 24px" }}>
      <button
        type="button"
        onClick={handleCloseConvertModal}
        style={{
          padding: "10px 20px",
          backgroundColor: "#f5f5f5",
          color: "#333",
          border: "1px solid #e2e2ea",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: "500",
        }}
      >
        Cancel
      </button>
      <button
        type="submit"
        form="convertToDispatchForm"
        disabled={isLoadingConvert}
        style={{
          padding: "10px 20px",
          backgroundColor: "#00368c",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: isLoadingConvert ? "not-allowed" : "pointer",
          fontSize: "14px",
          fontWeight: "500",
          opacity: isLoadingConvert ? 0.7 : 1,
        }}
      >
        {isLoadingConvert ? "Converting..." : "Convert"}
      </button>
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

    return (
      <div className="modal-body">
        <div className="view-vessel-container" style={{ padding: "20px" }}>
          {/* Note Information */}
          <div className="view-row" style={{ display: "flex", flexWrap: "wrap", gap: "20px", marginBottom: "20px" }}>
            <div className="view-item" style={{ flex: "1", minWidth: "200px" }}>
              <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>Landing Note No</div>
              <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{viewingNote.landingNoteNo || "-"}</div>
            </div>
            <div className="view-item" style={{ flex: "1", minWidth: "200px" }}>
              <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>Date</div>
              <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{formatDate(viewingNote.date) || "-"}</div>
            </div>
            <div className="view-item" style={{ flex: "1", minWidth: "200px" }}>
              <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>PO/DO</div>
              <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{viewingNote.poDo || "-"}</div>
            </div>
          </div>

          <div className="view-row" style={{ display: "flex", flexWrap: "wrap", gap: "20px", marginBottom: "20px" }}>
            <div className="view-item" style={{ flex: "1", minWidth: "200px" }}>
              <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>Quantity</div>
              <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{viewingNote.quantity || "-"}</div>
            </div>
            <div className="view-item" style={{ flex: "1", minWidth: "200px" }}>
              <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>Package Type</div>
              <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{viewingNote.packageType || "-"}</div>
            </div>
            <div className="view-item" style={{ flex: "1", minWidth: "200px" }}>
              <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>Landing Proof</div>
              <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>
                {viewingNote.landingProof && viewingNote.landingProof.length > 0 ? `${viewingNote.landingProof.length} file(s)` : "No files"}
              </div>
            </div>
          </div>

          <div className="view-row" style={{ marginBottom: "20px" }}>
            <div className="view-item" style={{ width: "100%" }}>
              <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>Description</div>
              <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{viewingNote.description || "-"}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderViewFooter = () => (
    <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "12px", padding: "16px 24px" }}>
      <button
        type="button"
        onClick={handleCloseViewModal}
        style={{
          padding: "10px 20px",
          backgroundColor: "#f5f5f5",
          color: "#333",
          border: "1px solid #e2e2ea",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: "500",
        }}
      >
        Close
      </button>
      {viewingNote && (
        <button
          type="button"
          onClick={() => handlePrintNote(viewingNote)}
          style={{
            padding: "10px 20px",
            backgroundColor: "#00368c",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "500",
          }}
        >
          Print
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
      <div className="table-wrapper table-responsive material-table-container" style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 330px)", minHeight: 0 }}>
        <table className="table table-striped material-table sub-note-table" style={{ "--card-color": "#e2e6ff", tableLayout: "fixed" }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 1, backgroundColor: "#fff" }}>
            <tr>
              <th>Order No</th>
              <th>Date</th>
              <th>PO/DO</th>
              <th>Landing Proof</th>
              <th>Quantity</th>
              <th>Package Type</th>
              <th>Description</th>
              <th style={{ paddingLeft: "28px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoadingList ? (
              <tr>
                <td colSpan="8" style={{ textAlign: "center", padding: "20px", color: "#666" }}>Loading...</td>
              </tr>
            ) : notesList.length > 0 ? (
              notesList.slice((landingPage - 1) * LANDING_LIMIT, landingPage * LANDING_LIMIT).map((note) => {
                const rowKey = note.landing_note_id ?? note.id ?? Math.random();
                const firstItem = Array.isArray(note.items) ? note.items[0] : null;
                const noteNo = note.landing_note_no || note.landingNoteNo || "";
                const noteDate = note.landing_date || note.date || "";
                const poDo = firstItem?.po_no || note.poDo || "";
                const quantity = firstItem?.quantity ?? note.quantity ?? "";
                const packageType = firstItem?.package_type || note.packageType || "";
                const description = firstItem?.description || note.description || "";
                const files = note.files || note.landing_proof || note.landingProof || [];
                return (
                <tr key={rowKey}>
                  <td>
                    <div className="material-table-cell">{noteNo}</div>
                  </td>
                  <td>
                    <div className="material-table-cell">
                      {formatDate(noteDate)}
                    </div>
                  </td>
                  <td>
                    <div className="material-table-cell">{poDo}</div>
                  </td>
                  <td>
                    <div className="material-table-cell">
                      {files.length > 0 ? (
                        <span style={{ color: "#00368c", cursor: "pointer" }}>
                          {files.length} file(s)
                        </span>
                      ) : (
                        <span style={{ color: "#999" }}>No files</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="material-table-cell">{quantity}</div>
                  </td>
                  <td>
                    <div className="material-table-cell">{packageType}</div>
                  </td>
                  <td>
                    <div className="material-table-cell">
                      {description && description.length > 13 ? (
                        <>
                          <Tooltip
                            id={`description-tooltip-${rowKey}`}
                            place="right"
                            content={description}
                            className="material-table-tooltip"
                          />
                          <span
                            data-tooltip-id={`description-tooltip-${rowKey}`}
                            style={{ cursor: "help" }}
                          >
                            {description.substring(0, 13)}...
                          </span>
                        </>
                      ) : (
                        <span>{description}</span>
                      )}
                    </div>
                  </td>
                  <td style={{ position: "relative", whiteSpace: "nowrap", overflow: "visible" }}>
                    <div className="material-table-cell" style={{ position: "relative", overflow: "visible", display: "flex", alignItems: "center", gap: "8px", justifyContent: "flex-start", flexWrap: "nowrap" }}>
                      <Tooltip id={`view-note-${note.id}`} place="left" content="View" />
                      <button
                        type="button"
                        onClick={() => handleViewNote(note)}
                        data-tooltip-id={`view-note-${note.id}`}
                        style={{
                          padding: "6px 8px",
                          backgroundColor: "transparent",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#00368c",
                          transition: "background-color 0.2s",
                          flexShrink: 0
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#f0f0f0";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        <img src={eyeIcon} alt="view" style={{ width: "18px", height: "18px" }} />
                      </button>
                      <Tooltip id={`print-note-${note.id}`} place="left" content="Print" />
                      <button
                        type="button"
                        onClick={() => handlePrintNote(note)}
                        data-tooltip-id={`print-note-${note.id}`}
                        style={{
                          padding: "6px 8px",
                          backgroundColor: "transparent",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#00368c",
                          transition: "background-color 0.2s",
                          flexShrink: 0
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#f0f0f0";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M6 9V2H18V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M6 18H4C2.89543 18 2 17.1046 2 16V11C2 9.89543 2.89543 9 4 9H20C21.1046 9 22 9.89543 22 11V16C22 17.1046 21.1046 18 20 18H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M18 14H6V22H18V14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M18 9H6V14H18V9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <Tooltip id={`convert-note-${note.id}`} place="left" content=" Convert" />
                      <button
                        type="button"
                        onClick={() => handleConvertToDispatch(note)}
                        data-tooltip-id={`convert-note-${note.id}`}
                        style={{
                          padding: "6px 8px",
                          backgroundColor: "transparent",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#00368c",
                          transition: "background-color 0.2s",
                          flexShrink: 0
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#f0f0f0";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 4H10V12H1V4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M10 6H16L19 9V12H10V6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx="4" cy="17" r="2" stroke="currentColor" strokeWidth="2" />
                          <circle cx="17" cy="17" r="2" stroke="currentColor" strokeWidth="2" />
                          <path d="M19 9H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </button>
                      <div className="action-dropdown-wrapper" style={{ position: "relative", display: "inline-block", zIndex: openDropdownId === note.id ? 9999 : "auto", flexShrink: 0 }}>
                        <Tooltip id={`more-actions-${note.id}`} place="left" content="More actions" />
                        <button
                          type="button"
                          onClick={(e) => handleToggleDropdown(note.id, e)}
                          data-tooltip-id={`more-actions-${note.id}`}
                          style={{
                            padding: "6px 8px",
                            backgroundColor: "transparent",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#00368c"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#f0f0f0";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent";
                          }}
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
                            style={{
                              position: "fixed",
                              top: `${dropdownPosition.top}px`,
                              right: `${dropdownPosition.right}px`,
                              backgroundColor: "white",
                              border: "1px solid #e2e2ea",
                              borderRadius: "6px",
                              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                              zIndex: 99999,
                              minWidth: "180px",
                              padding: "4px 0"
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                handleCloseDropdown();
                                handleOpenModal(note);
                              }}
                              style={{
                                width: "100%",
                                padding: "10px 16px",
                                backgroundColor: "transparent",
                                border: "none",
                                textAlign: "left",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                fontSize: "14px",
                                color: "#1a1a1a",
                                transition: "background-color 0.2s"
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = "#f5f5f5";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "transparent";
                              }}
                            >
                              <img src={editIcon} alt="edit" style={{ width: "16px", height: "16px" }} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleCloseDropdown();
                                handleDelete(note.id);
                              }}
                              style={{
                                width: "100%",
                                padding: "10px 16px",
                                backgroundColor: "transparent",
                                border: "none",
                                textAlign: "left",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                fontSize: "14px",
                                color: "#dc3545",
                                transition: "background-color 0.2s"
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = "#f5f5f5";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "transparent";
                              }}
                            >
                              <img src={deleteIcon} alt="delete" style={{ width: "16px", height: "16px" }} />
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
                <td colSpan="8" style={{ textAlign: "center", padding: "20px" }}>
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
        dialgName="modal-dialog modal-dialog-centered modal-dialog-scrollable"
        createModal
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
