import { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import CustomModal from "../../../../../../components/CustomModal";
import DeleteConfirmationModal from "../../../../../../components/DeleteConfirmationModal";
import { FormField, FormInput, FormSelect } from "./Husbandry.components";
import LocationAutocomplete from "./LocationAutocomplete";

// Generate dummy material data
const generateDummyMaterials = () => {
  const materialTypes = ["Equipment", "Supplies", "Spare Parts", "Tools", "Consumables"];
  const drivers = ["John Doe", "Jane Smith", "Mike Johnson", "Sarah Williams", "David Brown"];
  const statuses = ["Pending", "In Transit", "Delivered", "Cancelled"];

  const dummyMaterials = [];
  for (let i = 1; i <= 10; i++) {
    const pickupDate = new Date();
    pickupDate.setDate(pickupDate.getDate() - Math.floor(Math.random() * 30));
    const dropOffDate = new Date(pickupDate);
    dropOffDate.setDate(dropOffDate.getDate() + Math.floor(Math.random() * 7));

    dummyMaterials.push({
      id: i,
      materialToCollectOrDeliver: Math.random() > 0.5 ? "Collect" : "Deliver",
      materialType: materialTypes[Math.floor(Math.random() * materialTypes.length)],
      driver: drivers[Math.floor(Math.random() * drivers.length)],
      pickUp: pickupDate.toISOString().slice(0, 16),
      dropOff: dropOffDate.toISOString().slice(0, 16),
      dropOffLocation: `Location ${i}`,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      documents: [],
    });
  }
  return dummyMaterials;
};

const MaterialManagementContent = ({ formValues, handleChange, cardColor }) => {
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [materialsList, setMaterialsList] = useState([]);
  const [deletingMaterial, setDeletingMaterial] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileInputRef = useRef(null);

  // Form state
  const [formData, setFormData] = useState({
    materialType: "",
    materialToCollectOrDeliver: "",
    driver: "",
    pickUpDate: "",
    pickUpTime: "",
    dropOffDate: "",
    dropOffTime: "",
    dropOffLocation: "",
    status: "",
    documents: [],
  });

  // Initialize with dummy data on mount if empty
  useEffect(() => {
    const materials = formValues.materialManagementList || [];
    if (materials.length === 0) {
      const dummyData = generateDummyMaterials();
      const syntheticEvent = { target: { value: dummyData } };
      handleChange("materialManagementList")(syntheticEvent);
      setMaterialsList(dummyData);
    } else {
      setMaterialsList(materials);
    }
  }, [formValues.materialManagementList, handleChange]);

  // Update local list when formValues change
  useEffect(() => {
    if (formValues.materialManagementList) {
      setMaterialsList(formValues.materialManagementList);
    }
  }, [formValues.materialManagementList]);

  const handleOpenModal = () => {
    setFormData({
      materialType: "",
      materialToCollectOrDeliver: "",
      driver: "",
      pickUpDate: "",
      pickUpTime: "",
      dropOffDate: "",
      dropOffTime: "",
      dropOffLocation: "",
      status: "",
      documents: [],
    });
    setSelectedFiles([]);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormData({
      materialType: "",
      materialToCollectOrDeliver: "",
      driver: "",
      pickUpDate: "",
      pickUpTime: "",
      dropOffDate: "",
      dropOffTime: "",
      dropOffLocation: "",
      status: "",
      documents: [],
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

    // Combine date and time for pickUp and dropOff
    const pickUp = formData.pickUpDate && formData.pickUpTime
      ? `${formData.pickUpDate}T${formData.pickUpTime}`
      : "";
    const dropOff = formData.dropOffDate && formData.dropOffTime
      ? `${formData.dropOffDate}T${formData.dropOffTime}`
      : "";

    const newMaterial = {
      id: materialsList.length > 0 ? Math.max(...materialsList.map(m => m.id)) + 1 : 1,
      materialToCollectOrDeliver: formData.materialToCollectOrDeliver,
      materialType: formData.materialType,
      driver: formData.driver,
      pickUp: pickUp,
      dropOff: dropOff,
      dropOffLocation: formData.dropOffLocation,
      status: formData.status,
      documents: selectedFiles,
    };

    const updatedList = [...materialsList, newMaterial];
    setMaterialsList(updatedList);

    // Update formValues
    const syntheticEvent = { target: { value: updatedList } };
    handleChange("materialManagementList")(syntheticEvent);

    handleCloseModal();
  };

  // File upload handlers
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

  const handleDeleteMaterial = (id) => {
    setDeletingMaterial(materialsList.find(m => m.id === id));
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (!deletingMaterial) return;
    const updatedList = materialsList.filter((m) => m.id !== deletingMaterial.id);
    setMaterialsList(updatedList);
    const syntheticEvent = { target: { value: updatedList } };
    handleChange("materialManagementList")(syntheticEvent);
    setShowDeleteModal(false);
    setDeletingMaterial(null);
  };

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return "";
    const date = new Date(dateTimeString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusClass = (status) => {
    const statusMap = {
      Pending: "status-pending",
      "In Transit": "status-in-progress",
      Delivered: "status-completed",
      Cancelled: "status-cancelled",
    };
    return statusMap[status] || "";
  };

  const materialTypeOptions = [
    { value: "Equipment", label: "Equipment" },
    { value: "Supplies", label: "Supplies" },
    { value: "Spare Parts", label: "Spare Parts" },
    { value: "Tools", label: "Tools" },
    { value: "Consumables", label: "Consumables" },
  ];

  const statusOptions = [
    { value: "Pending", label: "Pending" },
    { value: "In Transit", label: "In Transit" },
    { value: "Delivered", label: "Delivered" },
    { value: "Cancelled", label: "Cancelled" },
  ];

  const collectOrDeliverOptions = [
    { value: "Collect", label: "Collect" },
    { value: "Deliver", label: "Deliver" },
  ];

  const renderHeader = () => (
    <>
      <h1 className="modal-title">Add Material</h1>
    </>
  );

  const renderBody = () => (
    <div className="modal-body">
      <div className="lead-form">
        <form id="materialForm" onSubmit={handleSubmit}>
          <div className="permInputs row mb-lg-3">
            <div className="col-12 mb-3">
              <FormField label="Material to Collect or Deliver">
                <FormSelect
                  value={formData.materialToCollectOrDeliver}
                  onChange={(e) => handleFormChange("materialToCollectOrDeliver", e.target.value)}
                  options={collectOrDeliverOptions}
                  placeholder="Select..."
                />
              </FormField>
            </div>

            <div className="col-12 mb-3">
              <FormField label="Type of Material">
                <FormSelect
                  value={formData.materialType}
                  onChange={(e) => handleFormChange("materialType", e.target.value)}
                  options={materialTypeOptions}
                  placeholder="Select material type..."
                />
              </FormField>
            </div>

            <div className="col-12 mb-3">
              <FormField label="Driver">
                <FormInput
                  type="text"
                  value={formData.driver}
                  onChange={(e) => handleFormChange("driver", e.target.value)}
                  placeholder="Enter driver name..."
                />
              </FormField>
            </div>

            <div className="col-12 mb-3">
              <FormField label="Pick Up">
                <div className="cf-input date-time-row">
                  <input
                    type="date"
                    value={formData.pickUpDate}
                    onChange={(e) => handleFormChange("pickUpDate", e.target.value)}
                    placeholder="Select date"
                  />
                  <input
                    type="time"
                    value={formData.pickUpTime}
                    onChange={(e) => handleFormChange("pickUpTime", e.target.value)}
                    placeholder="Select time"
                  />
                </div>
              </FormField>
            </div>

            <div className="col-12 mb-3">
              <FormField label="Drop Off">
                <div className="cf-input date-time-row">
                  <input
                    type="date"
                    value={formData.dropOffDate}
                    onChange={(e) => handleFormChange("dropOffDate", e.target.value)}
                    placeholder="Select date"
                  />
                  <input
                    type="time"
                    value={formData.dropOffTime}
                    onChange={(e) => handleFormChange("dropOffTime", e.target.value)}
                    placeholder="Select time"
                  />
                </div>
              </FormField>
            </div>

            <div className="col-12 mb-3">
              <FormField label="Drop Off Location">
                <LocationAutocomplete
                  value={formData.dropOffLocation || ""}
                  onChange={(e) => handleFormChange("dropOffLocation", e.target.value)}
                  placeholder="Search for a location..."
                  onLocationSelect={(locationData) => {
                    // Optional: Store additional location data if needed
                    console.log("Drop off location selected:", locationData);
                  }}
                />
              </FormField>
            </div>

            <div className="col-12 mb-3">
              <FormField label="Status">
                <FormSelect
                  value={formData.status}
                  onChange={(e) => handleFormChange("status", e.target.value)}
                  options={statusOptions}
                  placeholder="Select status..."
                />
              </FormField>
            </div>

            <div className="col-12 mb-3">
              <FormField label="Delivery Receipt">
                <div
                  className={`document-upload-zone ${isDragging ? "dragging" : ""}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={handleBrowseClick}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    id="materialDocuments"
                    multiple
                    onChange={handleFileChange}
                    className="file-input-hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  />

                  {selectedFiles.length === 0 ? (
                    <div className="upload-zone-content">
                      <div className="upload-icon-wrapper">
                        <svg
                          width="48"
                          height="48"
                          viewBox="0 0 48 48"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <rect
                            x="4"
                            y="4"
                            width="40"
                            height="40"
                            rx="8"
                            stroke="#00368c"
                            strokeWidth="2"
                            strokeDasharray="4 4"
                            fill="none"
                          />
                          <path
                            d="M24 16V32M24 16L18 22M24 16L30 22M12 36H36"
                            stroke="#00368c"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      <div className="upload-text-content">
                        <p className="upload-main-text">
                          Drag & drop files here, or <span className="upload-link">browse</span>
                        </p>
                        <p className="upload-sub-text">
                          Supports: PDF, DOC, DOCX, JPG, PNG (Max 10MB per file)
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="uploaded-files-list">
                      <div className="files-header">
                        <span className="files-count">{selectedFiles.length} file(s) uploaded</span>
                        <div className="files-header-actions">
                          <button
                            type="button"
                            className="add-more-files-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBrowseClick();
                            }}
                            style={{ "--card-color": cardColor }}
                          >
                            + Add More
                          </button>
                          <button
                            type="button"
                            className="btn-remove-files"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFiles([]);
                            }}
                            style={{ "--card-color": cardColor }}
                          >
                            Remove All
                          </button>
                        </div>
                      </div>
                      <div className="files-list">
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="file-item">
                            <div className="file-info">
                              <span className="file-name">{file.name}</span>
                              <span className="file-size">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </span>
                            </div>
                            <button
                              type="button"
                              className="btn-remove-file"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveFile(index);
                              }}
                              style={{ "--card-color": cardColor }}
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M12 4L4 12M4 4L12 12"
                                  stroke="#999"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
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
        form="materialForm"
        className="btn btn-primary"
        style={{ backgroundColor: "#00368c" }}
      >
        Add Material
      </button>
    </div>
  );

  return (
    <div className="cardform-left-full material-management-content-wrapper" style={{ "--card-color": cardColor }}>
      <div className="material-list-header">
        <h3 className="material-list-title">
          <span className="material-list-title-bar"></span>
          Material Management
        </h3>
        <button
          type="button"
          className="material-add-btn"
          onClick={handleOpenModal}
        >
          + Add
        </button>
      </div>
      <div className="table-wrapper table-responsive material-table-container">
        <table className="table table-striped material-table" style={{ "--card-color": "#e2e6ff" }}>
          <thead>
            <tr>
              <th>Material Type</th>
              <th>Driver</th>
              <th>Pick Up</th>
              <th>Drop Off</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {materialsList.length > 0 ? (
              materialsList.map((material) => (
                <tr key={material.id}>
                  <td>
                    <div className="material-table-cell">{material.materialType || ""}</div>
                  </td>
                  <td>
                    <div className="material-table-cell">{material.driver || ""}</div>
                  </td>
                  <td>
                    <div className="material-table-cell">
                      {formatDateTime(material.pickUp)}
                    </div>
                  </td>
                  <td>
                    <div className="material-table-cell">
                      {formatDateTime(material.dropOff)}
                    </div>
                  </td>
                  <td>
                    <div className={`material-table-cell ${getStatusClass(material.status)}`}>
                      {material.status || ""}
                    </div>
                  </td>
                  <td>
                    <div className="material-table-actions">
                      <button
                        type="button"
                        className="material-table-action-btn edit"
                        title="Edit"
                        onClick={() => handleOpenModal()}
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M11.333 2a1.886 1.886 0 0 1 2.667 2.667L4.667 14H2v-2.667L11.333 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="material-table-action-btn delete"
                        title="Delete"
                        onClick={() => handleDeleteMaterial(material.id)}
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M2 4h12M5.333 4V2.667h5.334V4M6.667 7.333v4M9.333 7.333v4M3.333 4l.667 9.333h8L12.667 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: "center", padding: "20px" }}>
                  No materials added yet. Click &quot;Add&quot; to add a new material.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CustomModal
        className="material-management-modal"
        show={showModal}
        closeModal={handleCloseModal}
        header={renderHeader()}
        body={renderBody()}
        footer={renderFooter()}
      />

      {!!showDeleteModal && (
        <DeleteConfirmationModal
          show={showDeleteModal}
          onCancel={() => {
            setShowDeleteModal(false);
            setDeletingMaterial(null);
          }}
          onConfirm={confirmDelete}
          deleteText={`Are you sure you want to delete this material${deletingMaterial?.materialType ? ` (${deletingMaterial.materialType})` : ""}?`}
        />
      )}
    </div>
  );
};

MaterialManagementContent.propTypes = {
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
  cardColor: PropTypes.string,
};

export default MaterialManagementContent;

