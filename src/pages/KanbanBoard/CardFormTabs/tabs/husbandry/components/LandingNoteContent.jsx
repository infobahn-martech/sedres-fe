import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import CustomModal from "../../../../../../components/CustomModal";
import DeleteConfirmationModal from "../../../../../../components/DeleteConfirmationModal";
import { FormField, FormInput, FormSelect, ReactQuillEditor } from "./Husbandry.components";
import DateTimePickerField from "../../../components/DateTimePickerField";
import MaterialTablePagination from "./MaterialTablePagination";
import editIcon from "../../../../../../assets/images/edit.svg";
import deleteIcon from "../../../../../../assets/images/delete.svg";
import eyeIcon from "../../../../../../assets/images/eye.svg";
import useLandingNoteReducer from "../../../../../../store/LandingNoteReducer";

// Extracts a positive numeric string ID from a plain value, numeric, or nested object ({ id: ... })
const toIdStr = (v) => {
  if (v == null) return "";
  if (typeof v === "object") return v.id != null && Number(v.id) > 0 ? String(v.id) : "";
  const n = Number(v);
  return n > 0 ? String(n) : "";
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



const LandingNoteContent = ({ formValues, handleChange, cardColor }) => {
  const {
    getAllLandingNotes,
    getLandingNoteById,
    updateLandingNote,
    deleteLandingNote,
    convertLandingNote,
    landingNotes,
    landingTotal,
    isLoadingList,
    isLoadingUpdate,
    isLoadingDelete,
    isLoadingConvert,
  } = useLandingNoteReducer((state) => state);

  const [showModal, setShowModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingNote, setDeletingNote] = useState(null);
  const [notesList, setNotesList] = useState([]);
  const [editingNote, setEditingNote] = useState(null);
  const [convertingNote, setConvertingNote] = useState(null);
  const [viewingNote, setViewingNote] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [existingDocuments, setExistingDocuments] = useState([]);
  const fileInputRef = useRef(null);
  const [isDraggingDocuments, setIsDraggingDocuments] = useState(false);
  const documentsFileInputRef = useRef(null);
  const [expandedConvertOrders, setExpandedConvertOrders] = useState({ 1: true });
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const [landingPage, setLandingPage] = useState(1);
  const LANDING_LIMIT = 10;
  const dropdownButtonRefs = useRef({});

  // Edit form state
  const [formData, setFormData] = useState({
    landing_date: "",
    inbound_id: "",
    warehouse_id: "",
    received_from: "",
    location: "",
    signature: "",
    remarks: "",
    items: [],
  });

  useEffect(() => {
    const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);
    if (!callId) return;
    getAllLandingNotes({ call_id: callId, page: landingPage, limit: LANDING_LIMIT });
  }, [formValues?.call_id, formValues?.callId, formValues?.card_call_id, landingPage]);

  const emptyFormData = {
    landing_date: "",
    inbound_id: "",
    warehouse_id: "",
    received_from: "",
    location: "",
    signature: "",
    remarks: "",
    items: [],
  };

  const buildEditItem = (item = {}) => ({
    inbound_item_id: item.inbound_item_id ?? item.landing_note_item_id ?? item.id ?? "",
    _order_no: item.order_no || "",
    _po_no: item.po_no || "",
    _package_type: item.package_type || "",
    _description: item.description || "",
    quantity: item.quantity != null ? String(item.quantity) : "",
    slot_no_id: toIdStr(item.slot_no_id) || toIdStr(item.slot_no) || toIdStr(item.slot),
    reason_id: toIdStr(item.reason_id) || toIdStr(item.reason),
    dispatch_date: item.dispatch_date ? item.dispatch_date.split(" ")[0] : "",
    transportation_required: item.transportation_required ? 1 : 0,
    transportation: {
      vehicle_type_id: item.transportation?.vehicle_type_id || "",
      from_location_id: item.transportation?.from_location_id || "",
      pickup_location: item.transportation?.pickup_location || "",
      to_location_id: item.transportation?.to_location_id || "",
      driver_id: item.transportation?.driver_id || "",
    },
  });

  const buildFormFromNote = (note) => ({
    landing_date: note.landing_date ? note.landing_date.split(" ")[0] : "",
    inbound_id: note.inbound_id ? String(note.inbound_id) : "",
    warehouse_id: note.warehouse_id ? String(note.warehouse_id) : "",
    received_from: note.received_from || "",
    location: note.location || "",
    signature: note.signature || "",
    remarks: note.remarks || "",
    items: Array.isArray(note.items) ? note.items.map(buildEditItem) : [],
  });

  const populateFormFromNote = (note) => {
    setFormData(buildFormFromNote(note));
    const doc = note.document ?? (Array.isArray(note.documents) ? note.documents[0] : null);
    setExistingDocuments((prev) => (doc ? [doc] : prev));
    setSelectedFiles([]);
  };

  const handleOpenModal = (note = null) => {
    if (note) {
      setEditingNote(note);
      // Pre-fill immediately from list data; detail fetch will re-populate below
      setFormData(buildFormFromNote(note));
      setExistingDocuments(note.document ? [note.document] : []);
      setSelectedFiles([]);
    } else {
      setEditingNote(null);
      setFormData(emptyFormData);
      setExistingDocuments([]);
      setSelectedFiles([]);
    }
    setShowModal(true);
  };

  // Two-phase: fetch full detail after modal opens for edit
  useEffect(() => {
    if (!editingNote || !showModal) return;
    const id = editingNote.landing_note_id ?? editingNote.id;
    if (!id) return;
    getLandingNoteById({ id, cb: (detail) => { if (detail) populateFormFromNote(detail); } });
  }, [editingNote?.landing_note_id, showModal]);

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingNote(null);
    setFormData(emptyFormData);
    setExistingDocuments([]);
    setSelectedFiles([]);
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditItemChange = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item),
    }));
  };

  const handleEditTransportationChange = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, transportation: { ...item.transportation, [field]: value } } : item
      ),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);
    if (!editingNote) return;

    const id = editingNote.landing_note_id ?? editingNote.id;
    const fd = new FormData();
    if (formData.landing_date) fd.append("landing_date", formData.landing_date);
    if (formData.inbound_id) fd.append("inbound_id", formData.inbound_id);
    if (formData.warehouse_id) fd.append("warehouse_id", formData.warehouse_id);
    if (formData.received_from) fd.append("received_from", formData.received_from);
    if (formData.location) fd.append("location", formData.location);
    if (formData.signature) fd.append("signature", formData.signature);
    if (formData.remarks) fd.append("remarks", formData.remarks);
    if (selectedFiles[0]) fd.append("file", selectedFiles[0]);

    formData.items.forEach((item, i) => {
      fd.append(`items[${i}][inbound_item_id]`, item.inbound_item_id);
      fd.append(`items[${i}][quantity]`, item.quantity);
      if (item.slot_no_id) fd.append(`items[${i}][slot_no_id]`, item.slot_no_id);
      if (item.reason_id) fd.append(`items[${i}][reason_id]`, item.reason_id);
      if (item.dispatch_date) fd.append(`items[${i}][dispatch_date]`, item.dispatch_date);
      fd.append(`items[${i}][transportation_required]`, item.transportation_required ? 1 : 0);
      if (item.transportation_required) {
        fd.append(`items[${i}][transportation][vehicle_type_id]`, item.transportation.vehicle_type_id || "");
        fd.append(`items[${i}][transportation][from_location_id]`, item.transportation.from_location_id || "");
        fd.append(`items[${i}][transportation][pickup_location]`, item.transportation.pickup_location || "");
        fd.append(`items[${i}][transportation][to_location_id]`, item.transportation.to_location_id || "");
        fd.append(`items[${i}][transportation][driver_id]`, item.transportation.driver_id || "");
      }
    });

    updateLandingNote({
      landingNoteId: id,
      data: fd,
      cb: () => {
        handleCloseModal();
        getAllLandingNotes({ call_id: callId, page: landingPage, limit: LANDING_LIMIT });
      },
    });
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

  const handleDelete = (note) => {
    setDeletingNote(note);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    if (!deletingNote) return;
    const landingNoteId = deletingNote.landing_note_id ?? deletingNote.id;
    const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);
    const pageAfterDelete = landingNotes.length <= 1 && landingPage > 1 ? landingPage - 1 : landingPage;
    deleteLandingNote({
      landingNoteId,
      cb: () => {
        setShowDeleteModal(false);
        setDeletingNote(null);
        if (pageAfterDelete !== landingPage) setLandingPage(pageAfterDelete);
        getAllLandingNotes({ call_id: callId, page: pageAfterDelete, limit: LANDING_LIMIT });
      },
    });
  };

  const slotOptions = [
    { value: "1", label: "Slot 1" },
    { value: "2", label: "Slot 2" },
    { value: "3", label: "Slot 3" },
    { value: "4", label: "Slot 4" },
    { value: "5", label: "Slot 5" },
    { value: "6", label: "Slot 6" },
  ];

  const reasonOptions = [
    { value: "1", label: "Scrap" },
    { value: "2", label: "Wrong supply" },
    { value: "3", label: "Safe storage" },
    { value: "4", label: "Service" },
    { value: "5", label: "Transit" },
  ];

  const buildEmptyConvertItem = (item = {}) => ({
    landing_note_item_id: item.landing_note_item_id ?? item.item_id ?? item.id ?? "",
    _order_no: item.order_no || item.inbound_order_no || "",
    _po_no: item.po_no || item.purchase_order_no || "",
    _package_type: item.package_type || "",
    _description: item.description || "",
    quantity: item.quantity != null ? String(item.quantity) : "",
    slot: toIdStr(item.slot_no_id) || toIdStr(item.slot_no) || toIdStr(item.slot),
    reason: toIdStr(item.reason_id) || toIdStr(item.reason),
    packing_required: item.packing_required ? 1 : 0,
    repacking_pallets: item.repacking_pallets ? String(item.repacking_pallets) : "",
    repacking_rolls: item.repacking_rolls ? String(item.repacking_rolls) : "",
    transportation_required: item.transportation_required ? 1 : 0,
    transportation: {
      vehicle_type_id: item.transportation?.vehicle_type_id ? String(item.transportation.vehicle_type_id) : "",
      from_location_id: item.transportation?.from_location_id ? String(item.transportation.from_location_id) : "",
      pickup_location: item.transportation?.pickup_location || "",
      to_location_id: item.transportation?.to_location_id ? String(item.transportation.to_location_id) : "",
      driver_id: item.transportation?.driver_id ? String(item.transportation.driver_id) : "",
      remarks: item.transportation?.remarks || "",
    },
  });

  const emptyConvertForm = {
    dispatch_date: "",
    dispatch_time: "",
    warehouse_id: "",
    signature: "",
    delivery_location: "",
    delivered_to: "",
    remarks: "",
    documents: [],
    items: [],
  };

  const [convertFormData, setConvertFormData] = useState(emptyConvertForm);

  const handleConvertToDispatch = (note) => {
    handleCloseDropdown();
    setConvertingNote(note);
    const items = Array.isArray(note.items) && note.items.length > 0
      ? note.items.map(buildEmptyConvertItem)
      : [buildEmptyConvertItem()];
    setConvertFormData({
      ...emptyConvertForm,
      warehouse_id: note.warehouse_id ? String(note.warehouse_id) : "",
      signature: note.signature || "",
      delivery_location: note.location || "",
      delivered_to: note.received_from || "",
      remarks: note.remarks || "",
      items,
    });
    setShowConvertModal(true);
  };

  const handleCloseConvertModal = () => {
    setShowConvertModal(false);
    setConvertingNote(null);
    setConvertFormData(emptyConvertForm);
  };

  const handleConvertFormChange = (field, value) => {
    setConvertFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleConvertItemChange = (index, field, value) => {
    setConvertFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item),
    }));
  };

  const handleConvertTransportationChange = (index, field, value) => {
    setConvertFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, transportation: { ...item.transportation, [field]: value } } : item
      ),
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

  const handleConvertSubmit = (e) => {
    e.preventDefault();
    const landingNoteId = convertingNote?.landing_note_id ?? convertingNote?.id;
    const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);

    const fd = new FormData();
    fd.append("landing_note_id", landingNoteId);
    if (convertFormData.warehouse_id) fd.append("warehouse_id", convertFormData.warehouse_id);
    const dateVal = [convertFormData.dispatch_date, convertFormData.dispatch_time].filter(Boolean).join(" ");
    if (dateVal) fd.append("dispatch_date", dateVal);
    if (convertFormData.signature) fd.append("signature", convertFormData.signature);
    if (convertFormData.delivery_location) fd.append("delivery_location", convertFormData.delivery_location);
    if (convertFormData.delivered_to) fd.append("delivered_to", convertFormData.delivered_to);
    if (convertFormData.remarks) fd.append("remarks", convertFormData.remarks);
    if (convertFormData.documents?.[0]?.file) fd.append("file", convertFormData.documents[0].file);

    convertFormData.items.forEach((item, i) => {
      fd.append(`items[${i}][landing_note_item_id]`, item.landing_note_item_id);
      fd.append(`items[${i}][quantity]`, item.quantity);
      if (item.slot) fd.append(`items[${i}][slot]`, item.slot);
      if (item.reason) fd.append(`items[${i}][reason]`, item.reason);
      fd.append(`items[${i}][packing_required]`, item.packing_required ? 1 : 0);
      if (item.packing_required) {
        fd.append(`items[${i}][repacking_pallets]`, parseInt(item.repacking_pallets) || 0);
        fd.append(`items[${i}][repacking_rolls]`, parseInt(item.repacking_rolls) || 0);
      }
      fd.append(`items[${i}][transportation_required]`, item.transportation_required ? 1 : 0);
      if (item.transportation_required) {
        fd.append(`items[${i}][transportation][vehicle_type_id]`, item.transportation.vehicle_type_id || "");
        fd.append(`items[${i}][transportation][from_location_id]`, item.transportation.from_location_id || "");
        fd.append(`items[${i}][transportation][pickup_location]`, item.transportation.pickup_location || "");
        fd.append(`items[${i}][transportation][to_location_id]`, item.transportation.to_location_id || "");
        fd.append(`items[${i}][transportation][driver_id]`, item.transportation.driver_id || "");
        fd.append(`items[${i}][transportation][remarks]`, item.transportation.remarks || "");
      }
    });

    convertLandingNote({
      data: fd,
      cb: () => {
        handleCloseConvertModal();
        getAllLandingNotes({ call_id: callId, page: landingPage, limit: LANDING_LIMIT });
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

          {/* Basic Details */}
          <div style={{ marginBottom: "28px", paddingBottom: "24px", borderBottom: "1px solid #e2e2ea" }}>
            <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#00368c", marginBottom: "16px" }}>Basic Details</h3>
            <div className="row">
              <div className="col-md-6 mb-3">
                <FormField label="Landing Date">
                  <div className="cf-input">
                    <input
                      type="date"
                      value={formData.landing_date}
                      onChange={(e) => handleFormChange("landing_date", e.target.value)}
                    />
                  </div>
                </FormField>
              </div>
              <div className="col-md-6 mb-3">
                <FormField label="Warehouse ID">
                  <FormInput type="number" value={formData.warehouse_id} onChange={(e) => handleFormChange("warehouse_id", e.target.value)} placeholder="Enter warehouse ID..." />
                </FormField>
              </div>
              <div className="col-md-6 mb-3">
                <FormField label="Received From">
                  <FormInput type="text" value={formData.received_from} onChange={(e) => handleFormChange("received_from", e.target.value)} placeholder="Enter received from..." />
                </FormField>
              </div>
              <div className="col-md-6 mb-3">
                <FormField label="Location">
                  <FormInput type="text" value={formData.location} onChange={(e) => handleFormChange("location", e.target.value)} placeholder="Enter location..." />
                </FormField>
              </div>
              <div className="col-md-6 mb-3">
                <FormField label="Signature">
                  <FormInput type="text" value={formData.signature} onChange={(e) => handleFormChange("signature", e.target.value)} placeholder="Enter signature..." />
                </FormField>
              </div>
            </div>
          </div>

          {/* Order Items */}
          {formData.items.length > 0 && (
            <div style={{ marginBottom: "28px", paddingBottom: "24px", borderBottom: "1px solid #e2e2ea" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#00368c", marginBottom: "16px" }}>Order Items</h3>
              {formData.items.map((item, i) => (
                <div key={i} style={{ border: "1px solid #e2e2ea", borderRadius: "8px", padding: "16px", marginBottom: "16px", backgroundColor: "#fafafa" }}>
                  <p style={{ fontSize: "13px", fontWeight: "700", color: "#00368c", marginBottom: "12px" }}>Item {i + 1}</p>

                  {/* Read-only info from inbound order */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px", marginBottom: "16px", padding: "12px", backgroundColor: "#ececec", borderRadius: "6px" }}>
                    {item._order_no && <div><div style={{ fontSize: "11px", fontWeight: "600", color: "#888", textTransform: "uppercase", marginBottom: "2px" }}>Order No</div><div style={{ fontSize: "13px", color: "#1a1a1a" }}>{item._order_no}</div></div>}
                    {item._po_no && <div><div style={{ fontSize: "11px", fontWeight: "600", color: "#888", textTransform: "uppercase", marginBottom: "2px" }}>PO No</div><div style={{ fontSize: "13px", color: "#1a1a1a" }}>{item._po_no}</div></div>}
                    {item._package_type && <div><div style={{ fontSize: "11px", fontWeight: "600", color: "#888", textTransform: "uppercase", marginBottom: "2px" }}>Package Type</div><div style={{ fontSize: "13px", color: "#1a1a1a" }}>{item._package_type}</div></div>}
                    <div><div style={{ fontSize: "11px", fontWeight: "600", color: "#888", textTransform: "uppercase", marginBottom: "2px" }}>Description</div><div style={{ fontSize: "13px", color: item._description ? "#1a1a1a" : "#aaa" }}>{item._description || "-"}</div></div>
                  </div>

                  <div className="row">
                    <div className="col-md-4 mb-3">
                      <FormField label="Quantity">
                        <FormInput type="number" value={item.quantity} onChange={(e) => handleEditItemChange(i, "quantity", e.target.value)} placeholder="Quantity..." />
                      </FormField>
                    </div>
                    <div className="col-md-4 mb-3">
                      <FormField label="Slot No">
                        <FormSelect value={item.slot_no_id} onChange={(e) => handleEditItemChange(i, "slot_no_id", e.target.value)} options={slotOptions} placeholder="Select slot..." />
                      </FormField>
                    </div>
                    <div className="col-md-4 mb-3">
                      <FormField label="Reason">
                        <FormSelect value={item.reason_id} onChange={(e) => handleEditItemChange(i, "reason_id", e.target.value)} options={reasonOptions} placeholder="Select reason..." />
                      </FormField>
                    </div>
                    <div className="col-md-6 mb-3">
                      <FormField label="Dispatch Date">
                        <div className="cf-input">
                          <input type="date" value={item.dispatch_date} onChange={(e) => handleEditItemChange(i, "dispatch_date", e.target.value)} />
                        </div>
                      </FormField>
                    </div>

                    {/* Transportation */}
                    <div className="col-12 mb-2">
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                        <input type="checkbox" checked={!!item.transportation_required} onChange={(e) => handleEditItemChange(i, "transportation_required", e.target.checked ? 1 : 0)} style={{ width: "16px", height: "16px", cursor: "pointer" }} />
                        <span style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a" }}>Transportation Required</span>
                      </label>
                    </div>
                    {!!item.transportation_required && (
                      <>
                        <div className="col-md-6 mb-3">
                          <FormField label="Vehicle Type ID">
                            <FormInput type="number" value={item.transportation.vehicle_type_id} onChange={(e) => handleEditTransportationChange(i, "vehicle_type_id", e.target.value)} placeholder="Vehicle Type ID..." />
                          </FormField>
                        </div>
                        <div className="col-md-6 mb-3">
                          <FormField label="From Location ID">
                            <FormInput type="number" value={item.transportation.from_location_id} onChange={(e) => handleEditTransportationChange(i, "from_location_id", e.target.value)} placeholder="From Location ID..." />
                          </FormField>
                        </div>
                        <div className="col-md-6 mb-3">
                          <FormField label="Pickup Location">
                            <FormInput type="text" value={item.transportation.pickup_location} onChange={(e) => handleEditTransportationChange(i, "pickup_location", e.target.value)} placeholder="Pickup location..." />
                          </FormField>
                        </div>
                        <div className="col-md-6 mb-3">
                          <FormField label="To Location ID">
                            <FormInput type="number" value={item.transportation.to_location_id} onChange={(e) => handleEditTransportationChange(i, "to_location_id", e.target.value)} placeholder="To Location ID..." />
                          </FormField>
                        </div>
                        <div className="col-md-6 mb-3">
                          <FormField label="Driver ID">
                            <FormInput type="number" value={item.transportation.driver_id} onChange={(e) => handleEditTransportationChange(i, "driver_id", e.target.value)} placeholder="Driver ID..." />
                          </FormField>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Landing Proof & Remarks */}
          <div>
            <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#00368c", marginBottom: "16px" }}>Landing Proof & Remarks</h3>
            <div className="mb-3">
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
                    <input ref={fileInputRef} type="file" id="landingProofDocuments" multiple onChange={handleFileChange} className="file-input-hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
                    <div className="upload-zone-content">
                      <div className="upload-icon-wrapper"></div>
                      <div className="upload-text-content">
                        <p className="upload-main-text">Drag and drop your files here, or <span className="upload-link">click to browse</span></p>
                      </div>
                    </div>
                  </div>
                  {existingDocuments.length > 0 && selectedFiles.length === 0 && (
                    <div className="document-file-preview-list" style={{ marginTop: "8px" }}>
                      <p style={{ fontSize: "12px", color: "#888", margin: "0 0 6px 0", fontWeight: "600" }}>Current file:</p>
                      {existingDocuments.map((doc, index) => (
                        <div key={index} className="document-file-preview-item">
                          <div className="document-file-preview-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                          <div className="document-file-preview-info">
                            <span className="document-file-preview-name">{doc.file_name || doc.name || "Document"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
                              {file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / 1024 / 1024).toFixed(2)} MB`}
                            </span>
                          </div>
                          <button className="document-file-preview-remove" onClick={(e) => { e.stopPropagation(); handleRemoveFile(index); }} type="button" title="Remove file">
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
            <div className="card-description-wrapper">
              <FormField label="Remarks">
                <ReactQuillEditor value={formData.remarks || ""} onChange={(e) => handleFormChange("remarks", e.target.value)} placeholder="Enter remarks..." name="remarks" />
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
        disabled={isLoadingUpdate}
        style={{ backgroundColor: "#00368c", display: "flex", alignItems: "center", gap: "8px" }}
      >
        {isLoadingUpdate && (
          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
        )}
        {isLoadingUpdate ? "Saving..." : (editingNote ? "Update Note" : "Add Note")}
      </button>
    </div>
  );

  // Convert to Dispatch Modal Render Functions
  const renderConvertHeader = () => (
    <>
      <h1 className="modal-title">Convert to Dispatch Note</h1>
    </>
  );

  const renderConvertBody = () => {
    return (
      <div className="modal-body">
        <div className="lead-form">
          <form id="convertToDispatchForm" onSubmit={handleConvertSubmit}>

            {/* Landing note reference (read-only) */}
            {convertingNote && (
              <div style={{ marginBottom: "20px", padding: "12px 16px", backgroundColor: "#eef2ff", borderRadius: "8px", display: "flex", gap: "32px" }}>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: "600", color: "#888", textTransform: "uppercase", marginBottom: "2px" }}>Landing Note No</div>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#00368c" }}>{convertingNote.landing_note_no || convertingNote.landingNoteNo || "-"}</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: "600", color: "#888", textTransform: "uppercase", marginBottom: "2px" }}>Dispatch Note No</div>
                  <div style={{ fontSize: "14px", color: "#666" }}>Auto-generated by system</div>
                </div>
              </div>
            )}

            {/* Basic Details */}
            <div style={{ marginBottom: "28px", paddingBottom: "24px", borderBottom: "1px solid #e2e2ea" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#00368c", marginBottom: "16px" }}>Basic Details</h3>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <FormField label="Dispatch Date & Time">
                    <DateTimePickerField
                      dateValue={convertFormData.dispatch_date}
                      timeValue={convertFormData.dispatch_time}
                      onDateTimeChange={(v) => setConvertFormData((prev) => ({ ...prev, dispatch_date: v.date, dispatch_time: v.time }))}
                      placeholder="YYYY-MM-DD HH:mm"
                    />
                  </FormField>
                </div>
                <div className="col-md-6 mb-3">
                  <FormField label="Warehouse ID">
                    <FormInput
                      type="number"
                      value={convertFormData.warehouse_id}
                      onChange={(e) => handleConvertFormChange("warehouse_id", e.target.value)}
                      placeholder="Enter warehouse ID..."
                    />
                  </FormField>
                </div>
              </div>
            </div>

            {/* Order Details (items from landing note) */}
            <div style={{ marginBottom: "28px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#00368c", marginBottom: "16px" }}>Order Details</h3>
              {convertFormData.items.map((item, i) => (
                <div key={i} style={{ border: "1px solid #e2e2ea", borderRadius: "8px", padding: "16px", marginBottom: "16px", backgroundColor: "#fafafa" }}>
                  <p style={{ fontSize: "13px", fontWeight: "700", color: "#00368c", marginBottom: "12px" }}>Item {i + 1}</p>

                  {/* Read-only info from landing note */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "10px", marginBottom: "16px", padding: "12px", backgroundColor: "#ececec", borderRadius: "6px" }}>
                    <div><div style={{ fontSize: "11px", fontWeight: "600", color: "#888", textTransform: "uppercase", marginBottom: "2px" }}>Order No</div><div style={{ fontSize: "13px", color: item._order_no ? "#1a1a1a" : "#aaa" }}>{item._order_no || "-"}</div></div>
                    <div><div style={{ fontSize: "11px", fontWeight: "600", color: "#888", textTransform: "uppercase", marginBottom: "2px" }}>PO No</div><div style={{ fontSize: "13px", color: item._po_no ? "#1a1a1a" : "#aaa" }}>{item._po_no || "-"}</div></div>
                    <div><div style={{ fontSize: "11px", fontWeight: "600", color: "#888", textTransform: "uppercase", marginBottom: "2px" }}>Package Type</div><div style={{ fontSize: "13px", color: item._package_type ? "#1a1a1a" : "#aaa" }}>{item._package_type || "-"}</div></div>
                    <div><div style={{ fontSize: "11px", fontWeight: "600", color: "#888", textTransform: "uppercase", marginBottom: "2px" }}>Description</div><div style={{ fontSize: "13px", color: item._description ? "#1a1a1a" : "#aaa" }}>{item._description || "-"}</div></div>
                  </div>

                  {/* Editable fields */}
                  <div className="row">
                    <div className="col-md-4 mb-3">
                      <FormField label="Quantity">
                        <FormInput type="number" value={item.quantity} onChange={(e) => handleConvertItemChange(i, "quantity", e.target.value)} placeholder="Quantity..." />
                      </FormField>
                    </div>
                    <div className="col-md-4 mb-3">
                      <FormField label="Slot">
                        <FormSelect value={item.slot} onChange={(e) => handleConvertItemChange(i, "slot", e.target.value)} options={slotOptions} placeholder="Select slot..." />
                      </FormField>
                    </div>
                    <div className="col-md-4 mb-3">
                      <FormField label="Reason">
                        <FormSelect value={item.reason} onChange={(e) => handleConvertItemChange(i, "reason", e.target.value)} options={reasonOptions} placeholder="Select reason..." />
                      </FormField>
                    </div>

                    {/* Packing */}
                    <div className="col-12 mb-2">
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                        <input type="checkbox" checked={!!item.packing_required} onChange={(e) => handleConvertItemChange(i, "packing_required", e.target.checked ? 1 : 0)} style={{ width: "16px", height: "16px", cursor: "pointer" }} />
                        <span style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a" }}>Packing Required</span>
                      </label>
                    </div>
                    {!!item.packing_required && (
                      <>
                        <div className="col-md-6 mb-3">
                          <FormField label="Repacking Pallets">
                            <FormInput type="number" value={item.repacking_pallets} onChange={(e) => handleConvertItemChange(i, "repacking_pallets", e.target.value)} placeholder="Integer..." />
                          </FormField>
                        </div>
                        <div className="col-md-6 mb-3">
                          <FormField label="Repacking Rolls">
                            <FormInput type="number" value={item.repacking_rolls} onChange={(e) => handleConvertItemChange(i, "repacking_rolls", e.target.value)} placeholder="Integer..." />
                          </FormField>
                        </div>
                      </>
                    )}

                    {/* Transportation */}
                    <div className="col-12 mb-2">
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                        <input type="checkbox" checked={!!item.transportation_required} onChange={(e) => handleConvertItemChange(i, "transportation_required", e.target.checked ? 1 : 0)} style={{ width: "16px", height: "16px", cursor: "pointer" }} />
                        <span style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a" }}>Transportation Required</span>
                      </label>
                    </div>
                    {!!item.transportation_required && (
                      <>
                        <div className="col-md-6 mb-3">
                          <FormField label="Vehicle Type ID">
                            <FormInput type="number" value={item.transportation.vehicle_type_id} onChange={(e) => handleConvertTransportationChange(i, "vehicle_type_id", e.target.value)} placeholder="Vehicle Type ID..." />
                          </FormField>
                        </div>
                        <div className="col-md-6 mb-3">
                          <FormField label="From Location ID">
                            <FormInput type="number" value={item.transportation.from_location_id} onChange={(e) => handleConvertTransportationChange(i, "from_location_id", e.target.value)} placeholder="From Location ID..." />
                          </FormField>
                        </div>
                        <div className="col-md-6 mb-3">
                          <FormField label="Pickup Location">
                            <FormInput type="text" value={item.transportation.pickup_location} onChange={(e) => handleConvertTransportationChange(i, "pickup_location", e.target.value)} placeholder="Pickup location..." />
                          </FormField>
                        </div>
                        <div className="col-md-6 mb-3">
                          <FormField label="To Location ID">
                            <FormInput type="number" value={item.transportation.to_location_id} onChange={(e) => handleConvertTransportationChange(i, "to_location_id", e.target.value)} placeholder="To Location ID..." />
                          </FormField>
                        </div>
                        <div className="col-md-6 mb-3">
                          <FormField label="Driver ID">
                            <FormInput type="number" value={item.transportation.driver_id} onChange={(e) => handleConvertTransportationChange(i, "driver_id", e.target.value)} placeholder="Driver ID..." />
                          </FormField>
                        </div>
                        <div className="col-md-6 mb-3">
                          <FormField label="Transportation Remarks">
                            <FormInput type="text" value={item.transportation.remarks} onChange={(e) => handleConvertTransportationChange(i, "remarks", e.target.value)} placeholder="Remarks..." />
                          </FormField>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Dispatch Details (below order details as per spec) */}
            <div style={{ marginBottom: "28px", paddingBottom: "24px", borderBottom: "1px solid #e2e2ea" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#00368c", marginBottom: "16px" }}>Dispatch Details</h3>
              <div className="row">
                <div className="col-md-4 mb-3">
                  <FormField label="Signature">
                    <FormInput type="text" value={convertFormData.signature} onChange={(e) => handleConvertFormChange("signature", e.target.value)} placeholder="Enter signature..." />
                  </FormField>
                </div>
                <div className="col-md-4 mb-3">
                  <FormField label="Delivery Location">
                    <FormInput type="text" value={convertFormData.delivery_location} onChange={(e) => handleConvertFormChange("delivery_location", e.target.value)} placeholder="Enter delivery location..." />
                  </FormField>
                </div>
                <div className="col-md-4 mb-3">
                  <FormField label="Delivered To">
                    <FormInput type="text" value={convertFormData.delivered_to} onChange={(e) => handleConvertFormChange("delivered_to", e.target.value)} placeholder="Enter person name..." />
                  </FormField>
                </div>
              </div>
            </div>

            {/* Documents & Remarks */}
            <div>
              <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#00368c", marginBottom: "16px" }}>Documents & Remarks</h3>
              <div className="mb-3">
                <FormField label="Document Upload">
                  <div style={{ marginTop: "8px" }}>
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
                  </div>
                </FormField>
              </div>
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

          </form>
        </div>
      </div>
    );
  };

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
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        {isLoadingConvert && (
          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
        )}
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
            ) : landingNotes.length > 0 ? (
              landingNotes.map((note) => {
                const firstItem = Array.isArray(note.items) ? note.items[0] : null;
                const rowKey = note.landing_note_id ?? note.id;
                const description = firstItem?.description || "";
                return (
                <tr key={rowKey}>
                  <td>
                    <div className="material-table-cell">{note.landing_note_no || ""}</div>
                  </td>
                  <td>
                    <div className="material-table-cell">
                      {formatDate(note.landing_date)}
                    </div>
                  </td>
                  <td>
                    <div className="material-table-cell">{firstItem?.po_no || ""}</div>
                  </td>
                  <td>
                    <div className="material-table-cell">
                      {note.document ? (
                        <span style={{ color: "#00368c" }}>{note.document.file_name}</span>
                      ) : (
                        <span style={{ color: "#999" }}>No files</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="material-table-cell">{firstItem?.quantity || ""}</div>
                  </td>
                  <td>
                    <div className="material-table-cell">{firstItem?.package_type || ""}</div>
                  </td>
                  <td>
                    <div className="material-table-cell">
                      {description.length > 13 ? (
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
                      <Tooltip id={`view-note-${rowKey}`} place="left" content="View" />
                      <button
                        type="button"
                        onClick={() => handleViewNote(note)}
                        data-tooltip-id={`view-note-${rowKey}`}
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
                      <Tooltip id={`print-note-${rowKey}`} place="left" content="Print" />
                      <button
                        type="button"
                        onClick={() => handlePrintNote(note)}
                        data-tooltip-id={`print-note-${rowKey}`}
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
                      <Tooltip id={`convert-note-${rowKey}`} place="left" content=" Convert" />
                      <button
                        type="button"
                        onClick={() => handleConvertToDispatch(note)}
                        data-tooltip-id={`convert-note-${rowKey}`}
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
                      <div className="action-dropdown-wrapper" style={{ position: "relative", display: "inline-block", zIndex: openDropdownId === rowKey ? 9999 : "auto", flexShrink: 0 }}>
                        <Tooltip id={`more-actions-${rowKey}`} place="left" content="More actions" />
                        <button
                          type="button"
                          onClick={(e) => handleToggleDropdown(rowKey, e)}
                          data-tooltip-id={`more-actions-${rowKey}`}
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
                        {openDropdownId === rowKey && createPortal(
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
                                handleDelete(note);
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
          total={landingTotal}
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

      <DeleteConfirmationModal
        show={showDeleteModal}
        onCancel={() => { setShowDeleteModal(false); setDeletingNote(null); }}
        onConfirm={handleConfirmDelete}
        isLoading={isLoadingDelete}
        deleteText="Are you sure you want to delete this landing note?"
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
