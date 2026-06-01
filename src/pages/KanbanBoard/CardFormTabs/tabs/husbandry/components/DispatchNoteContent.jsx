import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import CustomModal from "../../../../../../components/CustomModal";
import DeleteConfirmationModal from "../../../../../../components/DeleteConfirmationModal";
import { FormField, FormInput, FormSelect } from "./Husbandry.components";
import DateTimePickerField from "../../../components/DateTimePickerField";
import editIcon from "../../../../../../assets/images/edit.svg";
import deleteIcon from "../../../../../../assets/images/delete.svg";
import eyeIcon from "../../../../../../assets/images/eye.svg";
import useDispatchNoteReducer from "../../../../../../store/DispatchNoteReducer";

const normalizeDispatchNote = (note) => ({
  id: note.dispatch_note_id,
  dispatch_note_id: note.dispatch_note_id,
  orderNo: note.dispatch_note_no || "",
  date: note.dispatch_date || "",
  poDo: note.items?.[0]?.po_no || "",
  deliveryProof: note.documents?.length > 0 ? note.documents.map((d) => d.file_name) : [],
  quantity: note.items?.reduce((s, i) => s + parseFloat(i.quantity || 0), 0).toFixed(2) || "",
  packageType: note.items?.[0]?.package_type || "",
  description: note.items?.[0]?.description || "",
});

const DispatchNoteContent = ({ formValues, handleChange, cardColor }) => {
  const {
    getAllDispatchNotes,
    getDispatchNoteById,
    updateDispatchNote,
    deleteDispatchNote,
    dispatchNotes,
    dispatchTotal,
    isLoadingList,
    isLoadingDetail,
    isLoadingUpdate,
    isLoadingDelete,
  } = useDispatchNoteReducer((state) => state);

  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingNote, setDeletingNote] = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const [viewingNote, setViewingNote] = useState(null);
  const [existingDocument, setExistingDocument] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileInputRef = useRef(null);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const dropdownButtonRefs = useRef({});
  const [dispatchPage, setDispatchPage] = useState(1);
  const DISPATCH_LIMIT = 10;

  const emptyFormData = {
    dispatch_date: "",
    dispatch_time: "",
    warehouse_id: "",
    signature: "",
    delivery_location: "",
    delivered_to: "",
    remarks: "",
    items: [],
  };

  const [formData, setFormData] = useState(emptyFormData);

  useEffect(() => {
    const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);
    if (!callId) return;
    getAllDispatchNotes({ call_id: callId, page: dispatchPage, limit: DISPATCH_LIMIT });
  }, [formValues?.call_id, formValues?.callId, formValues?.card_call_id, dispatchPage]);

  const slotOptions = [
    { value: "1", label: "Slot 1" },
    { value: "2", label: "Slot 2" },
    { value: "3", label: "Slot 3" },
    { value: "4", label: "Slot 4" },
    { value: "5", label: "Slot 5" },
    { value: "6", label: "Slot 6" },
  ];

  const buildEditItem = (item = {}) => ({
    dispatch_note_item_id: item.dispatch_note_item_id ?? item.id ?? "",
    _order_no: item.order_no || "",
    _po_no: item.po_no || "",
    _package_type: item.package_type || "",
    _description: item.description || "",
    quantity: item.quantity != null ? String(item.quantity) : "",
    slot: (() => {
      const v = item.slot ?? item.slot_no_id ?? "";
      if (typeof v === "string" && /^slot-\d+$/i.test(v)) return v.replace(/^slot-/i, "");
      const n = Number(v);
      return n > 0 ? String(n) : "";
    })(),
    reason: item.reason || item.reason_id || "",
    packing_required: item.packing_required && item.packing_required !== "0" ? 1 : 0,
    repacking_pallets: item.repacking_pallets ? String(item.repacking_pallets) : "",
    repacking_rolls: item.repacking_rolls ? String(item.repacking_rolls) : "",
    transportation_required: item.transportation_required && item.transportation_required !== "0" ? 1 : 0,
    transportation: {
      vehicle_type_id: item.transportation?.vehicle_type_id ? String(item.transportation.vehicle_type_id) : "",
      from_location_id: item.transportation?.from_location_id ? String(item.transportation.from_location_id) : "",
      pickup_location: item.transportation?.pickup_location || "",
      to_location_id: item.transportation?.to_location_id ? String(item.transportation.to_location_id) : "",
      driver_id: item.transportation?.driver_id ? String(item.transportation.driver_id) : "",
      remarks: item.transportation?.remarks || "",
    },
  });

  const handleOpenModal = (note = null) => {
    setFormData(emptyFormData);
    setSelectedFiles([]);
    setExistingDocument(null);
    setEditingNote(note ?? null);
    setShowModal(true);
  };

  useEffect(() => {
    if (!editingNote || !showModal) return;
    const id = editingNote.dispatch_note_id ?? editingNote.id;
    if (!id) return;
    getDispatchNoteById({
      id,
      cb: (detail) => {
        if (!detail) return;
        setExistingDocument(detail.documents?.[0] || null);
        setFormData({
          dispatch_date: detail.dispatch_date ? detail.dispatch_date.split(" ")[0] : "",
          dispatch_time: detail.dispatch_date?.split(" ")[1] || "",
          warehouse_id: detail.warehouse_id ? String(detail.warehouse_id) : "",
          signature: detail.signature || "",
          delivery_location: detail.delivery_location || "",
          delivered_to: detail.delivered_to || "",
          remarks: detail.remarks || "",
          items: Array.isArray(detail.items) ? detail.items.map(buildEditItem) : [],
        });
      },
    });
  }, [editingNote?.dispatch_note_id, showModal]);

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingNote(null);
    setFormData(emptyFormData);
    setSelectedFiles([]);
    setExistingDocument(null);
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item),
    }));
  };

  const handleTransportationChange = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, transportation: { ...item.transportation, [field]: value } } : item
      ),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!editingNote) return;
    const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);
    const id = editingNote.dispatch_note_id ?? editingNote.id;
    const fd = new FormData();
    const dateVal = [formData.dispatch_date, formData.dispatch_time].filter(Boolean).join(" ");
    if (dateVal) fd.append("dispatch_date", dateVal);
    if (formData.warehouse_id) fd.append("warehouse_id", formData.warehouse_id);
    if (formData.signature) fd.append("signature", formData.signature);
    if (formData.delivery_location) fd.append("delivery_location", formData.delivery_location);
    if (formData.delivered_to) fd.append("delivered_to", formData.delivered_to);
    if (formData.remarks) fd.append("remarks", formData.remarks);
    if (selectedFiles[0]) fd.append("file", selectedFiles[0]);
    formData.items.forEach((item, i) => {
      fd.append(`items[${i}][dispatch_note_item_id]`, item.dispatch_note_item_id);
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
    updateDispatchNote({
      dispatchNoteId: id,
      data: fd,
      cb: () => {
        handleCloseModal();
        getAllDispatchNotes({ call_id: callId, page: dispatchPage, limit: DISPATCH_LIMIT });
      },
    });
  };

  const handleDelete = (note) => {
    setDeletingNote(note);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    if (!deletingNote) return;
    const dispatchNoteId = deletingNote.dispatch_note_id ?? deletingNote.id;
    const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);
    const pageAfterDelete = dispatchNotes.length <= 1 && dispatchPage > 1 ? dispatchPage - 1 : dispatchPage;
    deleteDispatchNote({
      dispatchNoteId,
      cb: () => {
        setShowDeleteModal(false);
        setDeletingNote(null);
        if (pageAfterDelete !== dispatchPage) setDispatchPage(pageAfterDelete);
        getAllDispatchNotes({ call_id: callId, page: pageAfterDelete, limit: DISPATCH_LIMIT });
      },
    });
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setDeletingNote(null);
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
          <title>Print - Dispatch Note ${note.orderNo || ''}</title>
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
            <h1>Dispatch Note Details</h1>
          </div>
          
          <div class="print-section">
            <div class="print-section-title">Note Information</div>
            <div class="print-row">
              <div class="print-label">Order No:</div>
              <div class="print-value">${note.orderNo || "-"}</div>
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
              <div class="print-label">Delivery Proof:</div>
              <div class="print-value">${note.deliveryProof && note.deliveryProof.length > 0 ? `${note.deliveryProof.length} file(s)` : "No files"}</div>
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

  const renderHeader = () => (
    <h1 className="modal-title">Edit Dispatch Note</h1>
  );

  const renderBody = () => (
    <div className="modal-body">
      <div className="lead-form">
        {isLoadingDetail && (
          <div style={{ textAlign: "center", padding: "10px 0 4px", color: "#00368c", fontSize: "13px" }}>
            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
            Loading note details...
          </div>
        )}
        <form id="dispatchNoteForm" onSubmit={handleSubmit}>
          {/* Basic Details */}
          <div style={{ marginBottom: "28px", paddingBottom: "24px", borderBottom: "1px solid #e2e2ea" }}>
            <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#00368c", marginBottom: "16px" }}>Basic Details</h3>
            <div className="row">
              <div className="col-md-6 mb-3">
                <FormField label="Dispatch Date & Time">
                  <DateTimePickerField
                    dateValue={formData.dispatch_date}
                    timeValue={formData.dispatch_time}
                    onDateTimeChange={(v) => setFormData((prev) => ({ ...prev, dispatch_date: v.date, dispatch_time: v.time }))}
                    placeholder="YYYY-MM-DD HH:mm"
                  />
                </FormField>
              </div>
              <div className="col-md-6 mb-3">
                <FormField label="Warehouse ID">
                  <FormInput type="number" value={formData.warehouse_id} onChange={(e) => handleFormChange("warehouse_id", e.target.value)} placeholder="Enter warehouse ID..." />
                </FormField>
              </div>
              <div className="col-md-6 mb-3">
                <FormField label="Signature">
                  <FormInput type="text" value={formData.signature} onChange={(e) => handleFormChange("signature", e.target.value)} placeholder="Enter signature..." />
                </FormField>
              </div>
              <div className="col-md-6 mb-3">
                <FormField label="Delivery Location">
                  <FormInput type="text" value={formData.delivery_location} onChange={(e) => handleFormChange("delivery_location", e.target.value)} placeholder="Enter delivery location..." />
                </FormField>
              </div>
              <div className="col-md-6 mb-3">
                <FormField label="Delivered To">
                  <FormInput type="text" value={formData.delivered_to} onChange={(e) => handleFormChange("delivered_to", e.target.value)} placeholder="Enter person name..." />
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
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px", marginBottom: "16px", padding: "12px", backgroundColor: "#ececec", borderRadius: "6px" }}>
                    {item._order_no && <div><div style={{ fontSize: "11px", fontWeight: "600", color: "#888", textTransform: "uppercase", marginBottom: "2px" }}>Order No</div><div style={{ fontSize: "13px", color: "#1a1a1a" }}>{item._order_no}</div></div>}
                    {item._po_no && <div><div style={{ fontSize: "11px", fontWeight: "600", color: "#888", textTransform: "uppercase", marginBottom: "2px" }}>PO No</div><div style={{ fontSize: "13px", color: "#1a1a1a" }}>{item._po_no}</div></div>}
                    {item._package_type && <div><div style={{ fontSize: "11px", fontWeight: "600", color: "#888", textTransform: "uppercase", marginBottom: "2px" }}>Package Type</div><div style={{ fontSize: "13px", color: "#1a1a1a" }}>{item._package_type}</div></div>}
                    <div><div style={{ fontSize: "11px", fontWeight: "600", color: "#888", textTransform: "uppercase", marginBottom: "2px" }}>Description</div><div style={{ fontSize: "13px", color: item._description ? "#1a1a1a" : "#aaa" }}>{item._description || "-"}</div></div>
                  </div>
                  <div className="row">
                    <div className="col-md-4 mb-3">
                      <FormField label="Quantity">
                        <FormInput type="number" value={item.quantity} onChange={(e) => handleItemChange(i, "quantity", e.target.value)} placeholder="Quantity..." />
                      </FormField>
                    </div>
                    <div className="col-md-4 mb-3">
                      <FormField label="Slot">
                        <FormSelect value={item.slot} onChange={(e) => handleItemChange(i, "slot", e.target.value)} options={slotOptions} placeholder="Select slot..." />
                      </FormField>
                    </div>
                    <div className="col-md-4 mb-3">
                      <FormField label="Reason">
                        <FormInput type="text" value={item.reason} onChange={(e) => handleItemChange(i, "reason", e.target.value)} placeholder="Enter reason..." />
                      </FormField>
                    </div>
                    <div className="col-12 mb-2">
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                        <input type="checkbox" checked={!!item.packing_required} onChange={(e) => handleItemChange(i, "packing_required", e.target.checked ? 1 : 0)} style={{ width: "16px", height: "16px", cursor: "pointer" }} />
                        <span style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a" }}>Packing Required</span>
                      </label>
                    </div>
                    {!!item.packing_required && (
                      <>
                        <div className="col-md-6 mb-3">
                          <FormField label="Repacking Pallets">
                            <FormInput type="number" value={item.repacking_pallets} onChange={(e) => handleItemChange(i, "repacking_pallets", e.target.value)} placeholder="Integer..." />
                          </FormField>
                        </div>
                        <div className="col-md-6 mb-3">
                          <FormField label="Repacking Rolls">
                            <FormInput type="number" value={item.repacking_rolls} onChange={(e) => handleItemChange(i, "repacking_rolls", e.target.value)} placeholder="Integer..." />
                          </FormField>
                        </div>
                      </>
                    )}
                    <div className="col-12 mb-2">
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                        <input type="checkbox" checked={!!item.transportation_required} onChange={(e) => handleItemChange(i, "transportation_required", e.target.checked ? 1 : 0)} style={{ width: "16px", height: "16px", cursor: "pointer" }} />
                        <span style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a" }}>Transportation Required</span>
                      </label>
                    </div>
                    {!!item.transportation_required && (
                      <>
                        <div className="col-md-6 mb-3">
                          <FormField label="Vehicle Type ID">
                            <FormInput type="number" value={item.transportation.vehicle_type_id} onChange={(e) => handleTransportationChange(i, "vehicle_type_id", e.target.value)} placeholder="Vehicle Type ID..." />
                          </FormField>
                        </div>
                        <div className="col-md-6 mb-3">
                          <FormField label="From Location ID">
                            <FormInput type="number" value={item.transportation.from_location_id} onChange={(e) => handleTransportationChange(i, "from_location_id", e.target.value)} placeholder="From Location ID..." />
                          </FormField>
                        </div>
                        <div className="col-md-6 mb-3">
                          <FormField label="Pickup Location">
                            <FormInput type="text" value={item.transportation.pickup_location} onChange={(e) => handleTransportationChange(i, "pickup_location", e.target.value)} placeholder="Pickup location..." />
                          </FormField>
                        </div>
                        <div className="col-md-6 mb-3">
                          <FormField label="To Location ID">
                            <FormInput type="number" value={item.transportation.to_location_id} onChange={(e) => handleTransportationChange(i, "to_location_id", e.target.value)} placeholder="To Location ID..." />
                          </FormField>
                        </div>
                        <div className="col-md-6 mb-3">
                          <FormField label="Driver ID">
                            <FormInput type="number" value={item.transportation.driver_id} onChange={(e) => handleTransportationChange(i, "driver_id", e.target.value)} placeholder="Driver ID..." />
                          </FormField>
                        </div>
                      </>
                    )}
                    <div className="col-12 mb-3">
                      <FormField label="Transportation Remarks">
                        <FormInput type="text" value={item.transportation.remarks} onChange={(e) => handleTransportationChange(i, "remarks", e.target.value)} placeholder="Transportation remarks..." />
                      </FormField>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Delivery Proof & Remarks */}
          <div style={{ marginBottom: "28px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#00368c", marginBottom: "16px" }}>Delivery Proof & Remarks</h3>
            <div className="row">
              <div className="col-12 mb-3">
                <FormField label="Delivery Proof">
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
                      <input ref={fileInputRef} type="file" id="dispatchNoteDeliveryProof" multiple onChange={handleFileChange} className="file-input-hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
                      <div className="upload-zone-content">
                        <div className="upload-icon-wrapper"></div>
                        <div className="upload-text-content">
                          <p className="upload-main-text">Drag and drop your files here, or <span className="upload-link">click to browse</span></p>
                        </div>
                      </div>
                    </div>
                    {existingDocument && selectedFiles.length === 0 && (
                      <div className="document-file-preview-list">
                        <div className="document-file-preview-item">
                          <div className="document-file-preview-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </div>
                          <div className="document-file-preview-info">
                            <span className="document-file-preview-name">{existingDocument.file_name || "Existing file"}</span>
                            <span className="document-file-preview-size" style={{ color: "#888" }}>Current file</span>
                          </div>
                        </div>
                      </div>
                    )}
                    {selectedFiles.length > 0 && (
                      <div className="document-file-preview-list">
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="document-file-preview-item">
                            <div className="document-file-preview-icon">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </div>
                            <div className="document-file-preview-info">
                              <span className="document-file-preview-name">{file.name}</span>
                              <span className="document-file-preview-size">{file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / 1024 / 1024).toFixed(2)} MB`}</span>
                            </div>
                            <button className="document-file-preview-remove" onClick={(e) => { e.stopPropagation(); handleRemoveFile(index); }} type="button" title="Remove file">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </FormField>
              </div>
              <div className="col-12 mb-3">
                <FormField label="Remarks">
                  <FormInput type="text" value={formData.remarks} onChange={(e) => handleFormChange("remarks", e.target.value)} placeholder="Enter remarks..." />
                </FormField>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  const renderFooter = () => (
    <div className="modal-footer">
      <button type="button" className="btn btn-secondary" onClick={handleCloseModal} disabled={isLoadingUpdate}>
        Cancel
      </button>
      <button type="submit" form="dispatchNoteForm" className="btn btn-primary" style={{ backgroundColor: "#00368c" }} disabled={isLoadingUpdate}>
        {isLoadingUpdate ? (
          <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />Updating...</>
        ) : "Update Note"}
      </button>
    </div>
  );

  // View Note Modal Render Functions
  const renderViewHeader = () => (
    <>
      <h1 className="modal-title">View Dispatch Note Details</h1>
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
              <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>Order No</div>
              <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{viewingNote.orderNo || "-"}</div>
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
              <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>Delivery Proof</div>
              <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>
                {viewingNote.deliveryProof && viewingNote.deliveryProof.length > 0 ? `${viewingNote.deliveryProof.length} file(s)` : "No files"}
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
          Dispatch Note
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
              <th>Delivery Proof</th>
              <th>Quantity</th>
              <th>Package Type</th>
              <th>Description</th>
              <th style={{ paddingLeft: "28px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoadingList ? (
              <tr>
                <td colSpan="8" style={{ textAlign: "center", padding: "20px" }}>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                  Loading...
                </td>
              </tr>
            ) : dispatchNotes.length > 0 ? (
              dispatchNotes.map(normalizeDispatchNote).map((note) => (
                <tr key={note.id}>
                  <td>
                    <div className="material-table-cell">{note.orderNo || ""}</div>
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
                      {note.deliveryProof && note.deliveryProof.length > 0 ? (
                        <span style={{ color: "#00368c", cursor: "pointer" }}>
                          {note.deliveryProof.length} file(s)
                        </span>
                      ) : (
                        <span style={{ color: "#999" }}>No files</span>
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
                            style={{ cursor: "help" }}
                          >
                            {note.description.substring(0, 13)}...
                          </span>
                        </>
                      ) : (
                        <span>{note.description || ""}</span>
                      )}
                    </div>
                  </td>
                  <td style={{ position: "relative", overflow: "visible" }}>
                    <div className="material-table-cell" style={{ position: "relative", overflow: "visible", display: "flex", alignItems: "center", gap: "8px", justifyContent: "flex-start" }}>
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
                          transition: "background-color 0.2s"
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
                      <Tooltip id={`edit-note-${note.id}`} place="left" content="Edit" />
                      <button
                        type="button"
                        onClick={() => handleOpenModal(note)}
                        data-tooltip-id={`edit-note-${note.id}`}
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
                          transition: "background-color 0.2s"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#f0f0f0";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        <img src={editIcon} alt="edit" style={{ width: "18px", height: "18px" }} />
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
                          transition: "background-color 0.2s"
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
                      <div className="action-dropdown-wrapper" style={{ position: "relative", display: "inline-block", zIndex: openDropdownId === note.id ? 9999 : "auto" }}>
                        <Tooltip id={`more-actions-${note.id}`} place="right" content="More actions" />
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
              ))
            ) : (
              <tr>
                <td colSpan="8" style={{ textAlign: "center", padding: "20px" }}>
                  No dispatch notes added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
        {dispatchTotal > 0 && (() => {
          const totalPages = Math.ceil(dispatchTotal / DISPATCH_LIMIT);
          const start = (dispatchPage - 1) * DISPATCH_LIMIT + 1;
          const end = Math.min(dispatchPage * DISPATCH_LIMIT, dispatchTotal);
          return (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 4px 4px", fontSize: "13px", color: "#555" }}>
              <span>Showing {start} to {end} of {dispatchTotal} entries</span>
              <div style={{ display: "flex", gap: "4px" }}>
                <button onClick={() => setDispatchPage(p => Math.max(1, p - 1))} disabled={dispatchPage === 1} style={{ padding: "4px 10px", border: "1px solid #dee2e6", borderRadius: "4px", background: dispatchPage === 1 ? "#f8f9fa" : "#fff", color: dispatchPage === 1 ? "#aaa" : "#00368c", cursor: dispatchPage === 1 ? "default" : "pointer" }}>&lt;</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setDispatchPage(p)} style={{ padding: "4px 10px", border: "1px solid #dee2e6", borderRadius: "4px", background: dispatchPage === p ? "#00368c" : "#fff", color: dispatchPage === p ? "#fff" : "#00368c", cursor: "pointer", fontWeight: dispatchPage === p ? 600 : 400 }}>{p}</button>
                ))}
                <button onClick={() => setDispatchPage(p => Math.min(totalPages, p + 1))} disabled={dispatchPage === totalPages} style={{ padding: "4px 10px", border: "1px solid #dee2e6", borderRadius: "4px", background: dispatchPage === totalPages ? "#f8f9fa" : "#fff", color: dispatchPage === totalPages ? "#aaa" : "#00368c", cursor: dispatchPage === totalPages ? "default" : "pointer" }}>&gt;</button>
              </div>
            </div>
          );
        })()}
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
        deleteText={`Are you sure you want to delete dispatch note ${deletingNote?.orderNo || ""}?`}
        isLoading={isLoadingDelete}
      />
    </div>
  );
};

DispatchNoteContent.propTypes = {
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
  cardColor: PropTypes.string,
};

export default DispatchNoteContent;
