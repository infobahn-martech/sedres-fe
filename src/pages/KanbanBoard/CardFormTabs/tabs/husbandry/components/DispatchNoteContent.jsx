import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import CustomModal from "../../../../../../components/CustomModal";
import { FormField, FormInput, FormSelect } from "./Husbandry.components";
import MaterialTablePagination from "./MaterialTablePagination";
import editIcon from "../../../../../../assets/images/edit.svg";
import deleteIcon from "../../../../../../assets/images/delete.svg";
import eyeIcon from "../../../../../../assets/images/eye.svg";
import useDispatchNoteReducer from "../../../../../../store/DispatchNoteReducer";

const isTruthyFlag = (value) => value === true || Number(value) === 1 || String(value).toLowerCase() === "true";

const getTransportation = (item) => item?.transportation || item?.transport || null;

const getFileUrl = (filePath) => {
  const base = (import.meta.env.VITE_API_ENDPOINT || "").replace(/\/+$/, "");
  const path = (filePath || "").replace(/^\/+/, "");
  return `${base}/${path}`;
};

const isImageFile = (fileName) => /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName || "");

// Generate dummy dispatch note data
const generateDummyDispatchNotes = () => {
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

  const dummyNotes = [];
  for (let i = 1; i <= 10; i++) {
    const dispatchDate = new Date();
    dispatchDate.setDate(dispatchDate.getDate() - Math.floor(Math.random() * 30));

    dummyNotes.push({
      id: i,
      orderNo: `DISP-${String(i).padStart(5, '0')}`,
      date: dispatchDate.toISOString().split('T')[0],
      poDo: `PO-${String(i).padStart(4, '0')}`,
      deliveryProof: [],
      quantity: Math.floor(Math.random() * 100) + 1,
      packageType: packageTypes[Math.floor(Math.random() * packageTypes.length)],
      description: descriptions[Math.floor(Math.random() * descriptions.length)],
    });
  }
  return dummyNotes;
};

const DispatchNoteContent = ({ formValues, handleChange, cardColor }) => {
  const { getAllDispatchNotes, getDispatchNoteById, dispatchNotes, dispatchTotal, isLoadingList, isLoadingDetail } = useDispatchNoteReducer((state) => state);

  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [notesList, setNotesList] = useState([]);
  const [editingNote, setEditingNote] = useState(null);
  const [viewingNote, setViewingNote] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileInputRef = useRef(null);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const dropdownButtonRefs = useRef({});
  const [dispatchPage, setDispatchPage] = useState(1);
  const DISPATCH_LIMIT = 10;

  // Form state
  const [formData, setFormData] = useState({
    orderNo: "",
    date: "",
    poDo: "",
    deliveryProof: [],
    quantity: "",
    packageType: "",
    description: "",
  });

  useEffect(() => {
    const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);
    if (callId) {
      getAllDispatchNotes({ call_id: callId, page: dispatchPage, limit: DISPATCH_LIMIT });
    }
  }, [formValues?.call_id, formValues?.callId, formValues?.card_call_id, dispatchPage]);

  useEffect(() => {
    if (Array.isArray(dispatchNotes)) {
      setNotesList(dispatchNotes.map((note) => {
        const firstItem = Array.isArray(note.items) && note.items.length > 0 ? note.items[0] : {};
        return {
          ...note,
          id: note.dispatch_note_id || note.id,
          orderNo: note.dispatch_note_no || note.orderNo || "",
          date: note.dispatch_date || note.date || "",
          poDo: firstItem.po_no || note.po_no || note.poDo || "",
          deliveryProof: note.document ? [note.document] : (note.documents || []),
          quantity: firstItem.quantity ?? note.quantity ?? "",
          packageType: firstItem.package_type || note.package_type || note.packageType || "",
          description: firstItem.description || note.description || "",
          items: note.items || [],
        };
      }));
    }
  }, [dispatchNotes]);

  const handleOpenModal = (note = null) => {
    if (note) {
      setEditingNote(note);
      setFormData({
        orderNo: note.orderNo || "",
        date: note.date || "",
        poDo: note.poDo || "",
        deliveryProof: note.deliveryProof || [],
        quantity: note.quantity || "",
        packageType: note.packageType || "",
        description: note.description || "",
      });
      setSelectedFiles(note.deliveryProof || []);
    } else {
      setEditingNote(null);
      setFormData({
        orderNo: "",
        date: "",
        poDo: "",
        deliveryProof: [],
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
      orderNo: "",
      date: "",
      poDo: "",
      deliveryProof: [],
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
      // Update existing note
      const updatedList = notesList.map(note =>
        note.id === editingNote.id
          ? {
            ...note,
            orderNo: formData.orderNo || note.orderNo,
            date: formData.date,
            poDo: formData.poDo,
            deliveryProof: selectedFiles,
            quantity: formData.quantity,
            packageType: formData.packageType,
            description: formData.description,
          }
          : note
      );
      setNotesList(updatedList);

      // Update formValues
      const syntheticEvent = { target: { value: updatedList } };
      handleChange("dispatchNoteList")(syntheticEvent);
    } else {
      // Create new note
      const newNote = {
        id: notesList.length > 0 ? Math.max(...notesList.map(m => m.id)) + 1 : 1,
        orderNo: formData.orderNo || `DISP-${String(notesList.length + 1).padStart(5, '0')}`,
        date: formData.date,
        poDo: formData.poDo,
        deliveryProof: selectedFiles,
        quantity: formData.quantity,
        packageType: formData.packageType,
        description: formData.description,
      };

      const updatedList = [...notesList, newNote];
      setNotesList(updatedList);

      // Update formValues
      const syntheticEvent = { target: { value: updatedList } };
      handleChange("dispatchNoteList")(syntheticEvent);
    }

    handleCloseModal();
  };

  const handleDelete = (noteId) => {
    if (window.confirm("Are you sure you want to delete this dispatch note?")) {
      const updatedList = notesList.filter(note => note.id !== noteId);
      setNotesList(updatedList);

      // Update formValues
      const syntheticEvent = { target: { value: updatedList } };
      handleChange("dispatchNoteList")(syntheticEvent);
    }
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
    getDispatchNoteById({
      id: note.id || note.dispatch_note_id,
      cb: (detail) => {
        if (detail) setViewingNote(detail);
      },
    });
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

  const packageTypeOptions = [
    { value: "Box", label: "Box" },
    { value: "Pallet", label: "Pallet" },
    { value: "Crate", label: "Crate" },
    { value: "Bag", label: "Bag" },
    { value: "Container", label: "Container" },
  ];

  const renderHeader = () => (
    <>
      <h1 className="modal-title">{editingNote ? "Edit Dispatch Note" : "Add Dispatch Note"}</h1>
    </>
  );

  const renderBody = () => (
    <div className="modal-body">
      <div className="lead-form">
        <form id="dispatchNoteForm" onSubmit={handleSubmit}>
          <div className="permInputs row mb-lg-3">
            <div className="col-12 mb-3">
              <FormField label="Order No">
                <FormInput
                  type="text"
                  value={formData.orderNo}
                  onChange={(e) => handleFormChange("orderNo", e.target.value)}
                  placeholder="Enter order number..."
                />
              </FormField>
            </div>

            <div className="col-12 mb-3">
              <FormField label="Date">
                <div className="cf-input">
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleFormChange("date", e.target.value)}
                    placeholder="Select date"
                  />
                </div>
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
                    <input
                      ref={fileInputRef}
                      type="file"
                      id="dispatchNoteDeliveryProof"
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
        form="dispatchNoteForm"
        className="btn btn-primary"
        style={{ backgroundColor: "#00368c" }}
      >
        {editingNote ? "Update Note" : "Add Note"}
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

    if (isLoadingDetail) {
      return (
        <div className="modal-body">
          <div className="d-flex justify-content-center align-items-center py-5">
            <span className="spinner-border spinner-border-sm me-2" role="status" />
            Loading...
          </div>
        </div>
      );
    }

    const viewItems = Array.isArray(viewingNote.items) ? viewingNote.items : [];
    const documents = Array.isArray(viewingNote.documents) ? viewingNote.documents : [];

    return (
      <div className="modal-body">
        <div className="lead-form">
          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <label className="landing-view-label">Dispatch Note No</label>
              <div className="landing-view-box">{viewingNote.dispatch_note_no || "-"}</div>
            </div>
            <div className="col-md-4">
              <label className="landing-view-label">Dispatch Date</label>
              <div className="landing-view-box">{formatDate(viewingNote.dispatch_date) || "-"}</div>
            </div>
            <div className="col-md-4">
              <label className="landing-view-label">Warehouse</label>
              <div className="landing-view-box">{viewingNote.warehouse_id || "-"}</div>
            </div>
            <div className="col-md-4">
              <label className="landing-view-label">Delivery Location</label>
              <div className="landing-view-box">{viewingNote.delivery_location || "-"}</div>
            </div>
            <div className="col-md-4">
              <label className="landing-view-label">Delivered To</label>
              <div className="landing-view-box">{viewingNote.delivered_to || "-"}</div>
            </div>
            {viewingNote.signature && (
              <div className="col-md-4">
                <label className="landing-view-label">Signature</label>
                <div className="landing-view-box">{viewingNote.signature}</div>
              </div>
            )}
            <div className="col-12">
              <label className="landing-view-label">Documents</label>
              {documents.length > 0 ? (
                <div className="landing-doc-list">
                  {documents.map((doc, i) => {
                    const fileName = doc.file_name || doc.name || `File ${i + 1}`;
                    const fileUrl = getFileUrl(doc.file_path || doc.file_url || "");
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

          {viewItems.length > 0 && (
            <div className="landing-view-items-section">
              <h4 className="fw-semibold mb-3">Items</h4>
              {viewItems.map((item, idx) => {
                const transport = getTransportation(item);
                const hasTransport = isTruthyFlag(item.transportation_required) || Boolean(transport);
                const hasPacking = isTruthyFlag(item.packing_required);
                return (
                  <div key={item.dispatch_note_item_id || idx} className="landing-view-item-card">
                    <div className="landing-view-item-title">
                      Item {idx + 1}{item.order_no ? ` — ${item.order_no}` : ""}
                    </div>
                    <div className="row g-2 mb-2">
                      <div className="col-md-3 col-6">
                        <label className="landing-view-label">PO No</label>
                        <div className="landing-view-box">{item.po_no || "-"}</div>
                      </div>
                      <div className="col-md-3 col-6">
                        <label className="landing-view-label">Quantity</label>
                        <div className="landing-view-box">{item.quantity ?? "-"}</div>
                      </div>
                      <div className="col-md-3 col-6">
                        <label className="landing-view-label">Package Type</label>
                        <div className="landing-view-box">{item.package_type || "-"}</div>
                      </div>
                      <div className="col-md-3 col-6">
                        <label className="landing-view-label">Description</label>
                        <div className="landing-view-box">{item.description || "-"}</div>
                      </div>
                    </div>

                    {(item.slot || item.reason) && (
                      <div className="landing-view-sub-section">
                        <div className="landing-view-sub-title">Dispatch Details</div>
                        <div className="row g-2">
                          {item.slot && (
                            <div className="col-md-6 col-6">
                              <label className="landing-view-label">Slot</label>
                              <div className="landing-view-box">{item.slot}</div>
                            </div>
                          )}
                          {item.reason && (
                            <div className="col-md-6 col-6">
                              <label className="landing-view-label">Reason</label>
                              <div className="landing-view-box">{item.reason}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {hasPacking && (
                      <div className="landing-view-sub-section">
                        <div className="landing-view-sub-title">Packing</div>
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
                      <div className="landing-view-sub-section">
                        <div className="landing-view-sub-title">Transportation</div>
                        <div className="row g-2">
                          <div className="col-md-4 col-6">
                            <label className="landing-view-label">Vehicle Type</label>
                            <div className="landing-view-box">{transport.vehicle_type_name || transport.vehicle_type_id || "-"}</div>
                          </div>
                          <div className="col-md-4 col-6">
                            <label className="landing-view-label">From Location</label>
                            <div className="landing-view-box">{transport.from_location_name || transport.from_location_id || "-"}</div>
                          </div>
                          <div className="col-md-4 col-6">
                            <label className="landing-view-label">Pick-Up From</label>
                            <div className="landing-view-box">{transport.pickup_location || "-"}</div>
                          </div>
                          <div className="col-md-4 col-6">
                            <label className="landing-view-label">To Location</label>
                            <div className="landing-view-box">{transport.to_location_name || transport.to_location_id || "-"}</div>
                          </div>
                          <div className="col-md-4 col-6">
                            <label className="landing-view-label">Driver</label>
                            <div className="landing-view-box">{transport.driver_name || transport.driver_id || "-"}</div>
                          </div>
                          {transport.remarks && (
                            <div className="col-md-4 col-6">
                              <label className="landing-view-label">Remarks</label>
                              <div className="landing-view-box landing-view-box--textarea" dangerouslySetInnerHTML={{ __html: transport.remarks }} />
                            </div>
                          )}
                        </div>
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
        <button type="button" className="btn btn-primary" onClick={() => handlePrintNote(viewingNote)}>
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
              <tr><td colSpan="8" style={{ textAlign: "center", padding: "20px" }}>Loading...</td></tr>
            ) : notesList.length > 0 ? (
              notesList.map((note) => (
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
        <MaterialTablePagination
          page={dispatchPage}
          total={dispatchTotal}
          limit={DISPATCH_LIMIT}
          onPageChange={setDispatchPage}
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

DispatchNoteContent.propTypes = {
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
  cardColor: PropTypes.string,
};

export default DispatchNoteContent;
