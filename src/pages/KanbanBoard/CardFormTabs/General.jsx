import PropTypes from "prop-types";
import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import "../../../design/scss/general.scss";
import "../../../design/css/CardForm.css";
import AttachmentIcon from "../../../assets/images/Attachment.svg";
import callFileService from "../../../services/callFileService";
import portService from "../../../services/portService";
import CommonService from "../../../services/commonService";
import billingEntityService from "../../../services/billingEntityService";
import billingInstructionService from "../../../services/billingInstructionService";
import vesselTypeService from "../../../services/vesselTypeService";
import bargeTypeService from "../../../services/bargeTypeService";
import vesselService from "../../../services/vesselService";
import {
  unwrapListResponse,
  mapOperatorsToOptions,
  mapPortsToOptions,
  mapCallTypesToOptions,
  mapBillingEntitiesToOptions,
  mapVesselTypesToOptions,
  mapBargeTypesToOptions,
  mergeOptionIfMissing,
} from "../../../helpers/callFileFormOptions";
import {
  isAppointmentEmailFileValid,
  getAppointmentEmailValidationMessage,
  parseAppointmentEmailFile,
  applyAppointmentEmailAutofill,
} from "../../../helpers/appointmentEmailAutofill";

// Job statuses in order with icons and descriptions (4 statuses)
const JOB_STATUSES = [
  { id: 1, title: "Received", key: "received", icon: "🚢", description: "Lorem Ipsum is simply dummy text of the printing and typesetting industry.Lorem Ipsum is simply dummy text of the printing and typesetting industry" },
  { id: 2, title: "Expected", key: "expected", icon: "🚢", description: "Lorem Ipsum is simply dummy text of the printing and typesetting industry.Lorem Ipsum is simply dummy text of the printing and typesetting industry" },
  { id: 3, title: "Arrived", key: "arrived", icon: "🔍", description: "Lorem Ipsum is simply dummy text of the printing and typesetting industry.Lorem Ipsum is simply dummy text of the printing and typesetting industry" },
  { id: 4, title: "Cleared", key: "cleared", icon: "✅", description: "Lorem Ipsum is simply dummy text of the printing and typesetting industry.Lorem Ipsum is simply dummy text of the printing and typesetting industry" },
  { id: 5, title: "Sailed", key: "sailed", icon: "⛵", description: "Lorem Ipsum is simply dummy text of the printing and typesetting industry.Lorem Ipsum is simply dummy text of the printing and typesetting industry" },
];


// Form Components
const FormField = ({ label, children, className = "" }) => {
  return (
    <div className={`cf-field ${className}`}>
      {label && <label>{label}</label>}
      {children}
    </div>
  );
};

FormField.propTypes = {
  label: PropTypes.string,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

const FormInput = ({ type = "text", value, onChange, placeholder, className = "", readOnly = false, disabled = false }) => {
  return (
    <div className={`cf-input ${className}`}>
      <input
        type={type}
        value={value || ""}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={disabled}
      />
    </div>
  );
};

FormInput.propTypes = {
  type: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  className: PropTypes.string,
  readOnly: PropTypes.bool,
  disabled: PropTypes.bool,
};

// Custom Select Component (similar to MultiSelectEmail UI)
const CustomSelect = ({ value, onChange, options = [], placeholder, className = "", disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);
  const displayValue = selectedOption ? selectedOption.label : "";

  const handleSelect = (optionValue) => {
    const syntheticEvent = {
      target: { value: optionValue }
    };
    onChange(syntheticEvent);
    setIsOpen(false);
  };

  return (
    <div className={`cf-multi-select-email ${disabled ? "disabled" : ""} ${className}`} ref={dropdownRef}>
      <div
        className={`cf-multi-select-email-input ${disabled ? "disabled" : ""}`}
        onClick={disabled ? undefined : () => setIsOpen(!isOpen)}
        style={{ pointerEvents: disabled ? "none" : "auto", opacity: disabled ? 0.6 : 1 }}
      >
        <div className="cf-multi-select-email-tags">
          {displayValue ? (
            <span className="cf-multi-select-selected-value">{displayValue}</span>
          ) : (
            <span className="cf-multi-select-placeholder">{placeholder || "Select..."}</span>
          )}
        </div>
        <span className="cf-multi-select-arrow">▼</span>
      </div>
      {isOpen && (
        <div className="cf-multi-select-dropdown">
          {options.map((option) => {
            const isSelected = value === option.value;
            return (
              <div
                key={option.value}
                className={`cf-multi-select-option ${isSelected ? "selected" : ""}`}
                onClick={() => handleSelect(option.value)}
              >
                <span>{option.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

CustomSelect.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    })
  ),
  placeholder: PropTypes.string,
  className: PropTypes.string,
  disabled: PropTypes.bool,
};

const FormSelect = ({ value, onChange, options = [], placeholder, className = "", disabled = false }) => {
  const normalizedValue = value === undefined || value === null ? "" : String(value);
  return (
    <CustomSelect
      value={normalizedValue}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
    />
  );
};

FormSelect.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    })
  ),
  placeholder: PropTypes.string,
  className: PropTypes.string,
  disabled: PropTypes.bool,
};

const OwnerField = ({ value, onChange, options = [], placeholder = "Select owner", disabled = false }) => {
  const selected = options.find((opt) => String(opt.value) === String(value ?? ""));
  const avatarLetter = selected?.label?.trim()?.charAt(0)?.toUpperCase() || "U";
  return (
    <FormField label="Owner">
      <div className="cf-owner-row">
        <div className="cf-owner-avatar">{avatarLetter}</div>
        <select
          value={value === undefined || value === null ? "" : String(value)}
          onChange={onChange}
          className="cf-owner-select"
          disabled={disabled}
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={String(opt.value)} value={String(opt.value)}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </FormField>
  );
};

const VesselNameField = ({ value, onChange, options = [], placeholder, onSave, disabled = false }) => {
  const [showAddInput, setShowAddInput] = useState(false);
  const [newVesselName, setNewVesselName] = useState("");

  const handleAddClick = () => {
    setShowAddInput(true);
    setNewVesselName("");
  };

  const handleSave = () => {
    if (newVesselName.trim()) {
      onSave(newVesselName.trim());
      setNewVesselName("");
      setShowAddInput(false);
    }
  };

  const handleCancel = () => {
    setNewVesselName("");
    setShowAddInput(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  return (
    <div className="cf-field">
      <label>Vessel Name</label>
      <div className="cf-vessel-name-row">
        <div className="cf-select" style={{ flex: 1 }}>
          <select value={value || ""} onChange={onChange} disabled={disabled}>
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {/* {!showAddInput && !disabled && (
          <button
            type="button"
            className="cf-add-vessel-btn"
            onClick={handleAddClick}
            aria-label="Add Vessel"
          >
            +
          </button>
        )} */}
      </div>
      {showAddInput && (
        <div className="cf-add-vessel-input-row">
          <div className="cf-input" style={{ flex: 1 }}>
            <input
              type="text"
              placeholder="Enter vessel name..."
              value={newVesselName}
              onChange={(e) => setNewVesselName(e.target.value)}
              onKeyDown={handleKeyPress}
              autoFocus
            />
          </div>
          <button
            type="button"
            className="cf-save-vessel-btn"
            onClick={handleSave}
            aria-label="Save Vessel"
            disabled={!newVesselName.trim()}
          >
            ✓
          </button>
          <button
            type="button"
            className="cf-cancel-vessel-btn"
            onClick={handleCancel}
            aria-label="Cancel"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

VesselNameField.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    })
  ),
  placeholder: PropTypes.string,
  onSave: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

OwnerField.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    })
  ),
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
};

// Document Upload Component
const DocumentUpload = ({ attachments = [], onAdd, onRemove, cardColor, disabled = false, type = "" }) => {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && onAdd) {
      files.forEach(file => onAdd(file));
    }
  };

  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0 && onAdd) {
      files.forEach(file => onAdd(file));
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemove = (index) => {
    if (onRemove) {
      onRemove(index);
    }
  };

  // When disabled and there are attachments, show only the file list with better UI
  if (disabled && attachments.length > 0) {
    return (
      <div className="document-upload-wrapper">
        <div className="document-file-display-list">
          {attachments.map((file, index) => (
            <div key={index} className="document-file-display-item">
              <div className="document-file-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M14 2V8H20"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M16 13H8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M16 17H8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M10 9H9H8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="document-file-info">
                <span className="document-file-name">{file.name || file}</span>
                {file.size && (
                  <span className="document-file-size">
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Helper function to get file icon based on file type
  const getFileIcon = (fileName) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    const iconColor = type ? `var(--upload-type-color, #3e5cb6)` : `var(--card-color, #2A00FF)`;

    if (['pdf'].includes(extension)) {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M14 2V8H20" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 13H8" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 17H8" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M14 2V8H20" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  // Helper function to format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="document-upload-wrapper">
      <div
        className={`document-upload-zone ${type ? `upload-type-${type.toLowerCase().replace(/\s+/g, '-')}` : ""} ${isDragging ? "dragging" : ""}`}
        onDragEnter={disabled ? undefined : handleDragEnter}
        onDragOver={disabled ? undefined : handleDragOver}
        onDragLeave={disabled ? undefined : handleDragLeave}
        onDrop={disabled ? undefined : handleDrop}
        onClick={disabled ? undefined : () => fileInputRef.current?.click()}
        style={{ "--card-color": "#3e5cb6" || "#2A00FF", pointerEvents: disabled ? "none" : "auto", opacity: disabled ? 0.6 : 1 }}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="file-input-hidden"
          accept="*/*"
          multiple
          onChange={handleFileInputChange}
          disabled={disabled}
        />
        <div className="upload-zone-content">
          <div className="upload-icon-wrapper">
          </div>
          <div className="upload-text-content">
            <p className="upload-main-text">
              Drag and drop your files here, or{" "}
              <span className="upload-link">click to browse</span>
            </p>
            {/* <p className="upload-sub-text">Supports all file formats</p> */}
          </div>
        </div>
      </div>

      {/* File Preview List - Shows below upload zone */}
      {attachments.length > 0 && (
        <div className="document-file-preview-list">
          {attachments.map((file, index) => (
            <div key={index} className="document-file-preview-item">
              <div className="document-file-preview-icon">
                {getFileIcon(file.name || file)}
              </div>
              <div className="document-file-preview-info">
                <span className="document-file-preview-name">{file.name || file}</span>
                <span className="document-file-preview-size">{formatFileSize(file.size)}</span>
              </div>
              {!disabled && (
                <button
                  className="document-file-preview-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(index);
                  }}
                  type="button"
                  title="Remove file"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

DocumentUpload.propTypes = {
  attachments: PropTypes.array,
  onAdd: PropTypes.func,
  onRemove: PropTypes.func,
  cardColor: PropTypes.string,
  disabled: PropTypes.bool,
  type: PropTypes.string,
};

// Multi-Select Email Component
const MultiSelectEmail = ({ value = [], onChange, options = [], placeholder, onAddNew, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [showAddInput, setShowAddInput] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setShowAddInput(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedValues = Array.isArray(value) ? value : (value ? [value] : []);

  const handleToggle = (email) => {
    const newValue = selectedValues.includes(email)
      ? selectedValues.filter(e => e !== email)
      : [...selectedValues, email];

    const syntheticEvent = {
      target: { value: newValue, name: "dailyReportEmail" }
    };
    onChange(syntheticEvent);
  };

  const handleAddNewEmail = () => {
    if (newEmail.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) {
      const email = newEmail.trim();
      if (!selectedValues.includes(email) && !options.some(opt => opt.value === email)) {
        if (onAddNew) {
          onAddNew(email);
        }
        handleToggle(email);
      }
      setNewEmail("");
      setShowAddInput(false);
    }
  };

  const handleRemoveEmail = (email, e) => {
    e.stopPropagation();
    const newValue = selectedValues.filter(e => e !== email);
    const syntheticEvent = {
      target: { value: newValue, name: "dailyReportEmail" }
    };
    onChange(syntheticEvent);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddNewEmail();
    } else if (e.key === "Escape") {
      setNewEmail("");
      setShowAddInput(false);
    }
  };

  return (
    <div className={`cf-multi-select-email ${disabled ? "disabled" : ""}`} ref={dropdownRef}>
      <div
        className={`cf-multi-select-email-input ${disabled ? "disabled" : ""}`}
        onClick={disabled ? undefined : () => setIsOpen(!isOpen)}
        style={{ pointerEvents: disabled ? "none" : "auto", opacity: disabled ? 0.6 : 1 }}
      >
        <div className="cf-multi-select-email-tags">
          {selectedValues.length > 0 ? (
            selectedValues.map((email) => (
              <span key={email} className="cf-email-tag">
                {email}
                {!disabled && (
                  <button
                    type="button"
                    className="cf-email-tag-remove"
                    onClick={(e) => handleRemoveEmail(email, e)}
                  >
                    ×
                  </button>
                )}
              </span>
            ))
          ) : (
            <span className="cf-multi-select-placeholder">{placeholder || "Select emails..."}</span>
          )}
        </div>
        <span className="cf-multi-select-arrow">▼</span>
      </div>
      {isOpen && (
        <div className="cf-multi-select-dropdown">
          {options.map((option) => {
            const isSelected = selectedValues.includes(option.value);
            return (
              <div
                key={option.value}
                className={`cf-multi-select-option ${isSelected ? "selected" : ""}`}
                onClick={() => handleToggle(option.value)}
              >
                <span className="cf-multi-select-checkbox">
                  {isSelected && "✓"}
                </span>
                <span>{option.label}</span>
              </div>
            );
          })}
          {!showAddInput ? (
            <div
              className="cf-multi-select-option add-new"
              onClick={() => {
                setShowAddInput(true);
                setNewEmail("");
              }}
            >
              <span>+ Add New Email</span>
            </div>
          ) : (
            <div className="cf-multi-select-add-input">
              <input
                type="email"
                placeholder="Enter email address..."
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={handleKeyPress}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
              <button
                type="button"
                className="cf-add-email-btn"
                onClick={handleAddNewEmail}
                disabled={!newEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())}
              >
                ✓
              </button>
              <button
                type="button"
                className="cf-cancel-email-btn"
                onClick={() => {
                  setNewEmail("");
                  setShowAddInput(false);
                }}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

MultiSelectEmail.propTypes = {
  value: PropTypes.oneOfType([PropTypes.array, PropTypes.string]),
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    })
  ),
  placeholder: PropTypes.string,
  onAddNew: PropTypes.func,
  disabled: PropTypes.bool,
};

// React Quill Editor Component
const ReactQuillEditor = ({ value, onChange, placeholder }) => {
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
    const syntheticEvent = { target: { value: content, name: "cardDescription" } };
    onChange(syntheticEvent);
  };

  return (
    <div className="react-quill-wrapper">
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value || ""}
        onChange={handleChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder || "Enter card description..."}
      />
    </div>
  );
};

ReactQuillEditor.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
};

// Daily Task/Todo Component
const DailyTaskTodo = ({ tasks = [], onChange, accentColor }) => {
  const [newTask, setNewTask] = useState("");
  const [localTasks, setLocalTasks] = useState(() => {
    // Initialize with dummy tasks if no tasks provided
    if (tasks && tasks.length > 0) {
      return tasks;
    }
    return [
      { id: 1, text: "Review vessel arrival documents", completed: true },
      { id: 2, text: "Coordinate with port authorities", completed: true },
      { id: 3, text: "Prepare crew change schedule", completed: false },
    ];
  });

  // Sync local tasks with prop changes
  useEffect(() => {
    if (tasks && tasks.length > 0) {
      setLocalTasks(tasks);
    }
  }, [tasks]);

  const handleAddTask = () => {
    if (newTask.trim()) {
      const task = {
        id: Date.now(),
        text: newTask.trim(),
        completed: false,
        createdAt: new Date().toISOString(),
      };
      const updatedTasks = [...localTasks, task];
      setLocalTasks(updatedTasks);
      if (onChange) {
        const syntheticEvent = { target: { value: updatedTasks } };
        onChange(syntheticEvent);
      }
      setNewTask("");
    }
  };

  const handleToggleTask = (taskId) => {
    const updatedTasks = localTasks.map((task) =>
      task.id === taskId ? { ...task, completed: !task.completed } : task
    );
    setLocalTasks(updatedTasks);
    if (onChange) {
      const syntheticEvent = { target: { value: updatedTasks } };
      onChange(syntheticEvent);
    }
  };

  const handleRemoveTask = (taskId) => {
    const updatedTasks = localTasks.filter((task) => task.id !== taskId);
    setLocalTasks(updatedTasks);
    if (onChange) {
      const syntheticEvent = { target: { value: updatedTasks } };
      onChange(syntheticEvent);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTask();
    }
  };

  const completedCount = localTasks.filter((t) => t.completed).length;
  const totalCount = localTasks.length;

  return (
    <div className="daily-task-todo-wrapper">
      <FormField label="Daily Tasks / Todo">
        <div className="daily-task-container">
          <div className="daily-task-input-row">
            <div className="cf-input" style={{ flex: 1 }}>
              <input
                type="text"
                placeholder="Add a new task..."
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={handleKeyPress}
              />
            </div>
            <button
              type="button"
              className="daily-task-add-btn"
              onClick={handleAddTask}
              disabled={!newTask.trim()}
            >
              +
            </button>
          </div>

          <div className="daily-task-list">
            {localTasks.length === 0 ? (
              <div className="daily-task-empty">
                <p>No tasks yet. Add a task to get started!</p>
              </div>
            ) : (
              localTasks.map((task) => (
                <div
                  key={task.id}
                  className={`daily-task-item ${task.completed ? "completed" : ""}`}
                >
                  <label className="daily-task-checkbox-display">
                    <input
                      type="checkbox"
                      checked={task.completed || false}
                      onChange={() => handleToggleTask(task.id)}
                      className="daily-task-checkbox-input"
                    />
                    <div
                      className={`daily-task-checkbox-icon ${task.completed ? "checked" : ""}`}
                    >
                      {task.completed && (
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path
                            d="M10 3L4.5 8.5L2 6"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  </label>
                  <span className="daily-task-text">{task.text}</span>
                  <button
                    type="button"
                    className="daily-task-remove-btn"
                    onClick={() => handleRemoveTask(task.id)}
                    title="Remove task"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          {localTasks.length > 0 && (
            <div className="daily-task-summary">
              <span className="daily-task-summary-text">
                {completedCount} of {totalCount} completed
              </span>
              <div className="daily-task-progress-bar">
                <div
                  className="daily-task-progress-fill"
                  style={{
                    width: `${(completedCount / totalCount) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </FormField>
    </div>
  );
};

DailyTaskTodo.propTypes = {
  tasks: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      text: PropTypes.string.isRequired,
      completed: PropTypes.bool,
      createdAt: PropTypes.string,
    })
  ),
  onChange: PropTypes.func,
  accentColor: PropTypes.string,
};


// Helper function to format date and time
const formatDateTime = (date, time) => {
  if (!date && !time) return "Not set";
  const dateStr = date ? new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
  const timeStr = time || '';
  return dateStr && timeStr ? `${dateStr} at ${timeStr}` : dateStr || timeStr || "Not set";
};

// Helper function to get status date/time from card/formValues
const getStatusDateTime = (card, formValues, statusKey) => {
  // Map status keys to potential date/time fields in card or formValues
  const dateTimeMap = {
    received: { date: formValues?.receivedDate || card?.receivedDate, time: formValues?.receivedTime || card?.receivedTime },
    expected: { date: formValues?.expectedDate || card?.expectedDate, time: formValues?.expectedTime || card?.expectedTime },
    arrived: { date: formValues?.arrivedDate || card?.arrivedDate, time: formValues?.arrivedTime || card?.arrivedTime },
    cleared: { date: formValues?.clearedDate || card?.clearedDate, time: formValues?.clearedTime || card?.clearedTime },
    sailed: { date: formValues?.sailedDate || card?.sailedDate, time: formValues?.sailedTime || card?.sailedTime },
  };

  return dateTimeMap[statusKey] || { date: null, time: null };
};

// Horizontal Progress Bar Component
const HorizontalProgressBar = ({ stages, currentStatus, accentColor, card, formValues }) => {
  const currentIndex = stages.findIndex(stage => stage.key === currentStatus);
  const activeIndex = currentIndex >= 0 ? currentIndex : 0;

  // Calculate progress width - reach the center of the active stage dot
  // Since dots are evenly distributed using flexbox with space-between,
  // the line spans from first dot center (0%) to last dot center (100%)
  // Each dot center is positioned at: (index / (totalStages - 1)) * 100
  const calculateProgressWidth = () => {
    if (stages.length <= 1) return 0;
    if (activeIndex === 0) {
      return 0;
    }
    if (activeIndex === stages.length - 1) {
      return 100;
    }

    // Calculate the exact percentage to reach the center of the active dot
    // Since dots are evenly spaced using flexbox with space-between,
    // the center of each dot is at: (index / (stages.length - 1)) * 100
    const dotCenterPosition = (activeIndex / (stages.length - 1)) * 100;

    // Add a visual offset to ensure the green line reaches the center of the dot
    // This accounts for:
    // 1. Dot width (28px) - line needs to extend to dot center
    // 2. Flexbox spacing calculations
    // 3. Subpixel rendering differences
    // For fewer stages (5), we need a larger offset to ensure proper connection
    const baseOffset = stages.length <= 5 ? 3.5 : 2.5;
    const offsetPercentage = activeIndex <= 2 ? baseOffset : baseOffset - 0.5;
    return Math.min(dotCenterPosition + offsetPercentage, 100);
  };

  const progressWidth = calculateProgressWidth();

  return (
    <div className="job-status-progress-container" style={{ "--progress-color": "#2e7d32" }}>
      <div className="job-status-progress-line">
        <div
          className="job-status-progress-fill"
          style={{
            width: `${progressWidth}%`,
            transition: "width 0.5s ease"
          }}
        />
      </div>
      <div className="job-status-progress-stages">
        {stages.map((stage, index) => {
          const isCompleted = index < activeIndex;
          const isActive = index === activeIndex;
          const isPending = index > activeIndex;
          const statusDateTime = getStatusDateTime(card, formValues, stage.key);
          const formattedDateTime = formatDateTime(statusDateTime.date, statusDateTime.time);

          return (
            <div
              key={stage.id}
              className={`job-status-progress-stage ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''} ${isPending ? 'pending' : ''}`}
            >
              <div className="job-status-tooltip-content">
                <div className="tooltip-description">{stage.description}</div>
              </div>
              <div className={`job-status-progress-dot ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''} ${isPending ? 'pending' : ''}`}>
                {isCompleted && <span className="check-icon">✓</span>}
                {isActive && <span className="active-dot"></span>}
                {isPending && <span className="pending-dot"></span>}
              </div>
              <div className="job-status-progress-label">
                {stage.title}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

HorizontalProgressBar.propTypes = {
  stages: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number.isRequired,
    title: PropTypes.string.isRequired,
    key: PropTypes.string.isRequired,
    icon: PropTypes.string,
    description: PropTypes.string,
  })).isRequired,
  currentStatus: PropTypes.string,
  accentColor: PropTypes.string,
  card: PropTypes.object,
  formValues: PropTypes.object,
};

function General({ card, formValues, handleChange, onSave, isAddMode = false, isSimplifiedMode = false }) {
  const accentColor = useMemo(() => card?.color || "#2A00FF", [card?.color]);
  const [vesselNameOptions, setVesselNameOptions] = useState([
    // Add vessel names here or fetch from API
  ]);
  const [vesselOptionsLoading, setVesselOptionsLoading] = useState(false);
  const [appointmentDocuments, setAppointmentDocuments] = useState([]);
  // MWP RENEWAL document states
  const [appointmentEmailDocuments, setAppointmentEmailDocuments] = useState([]);
  const [mwpCopyDocuments, setMwpCopyDocuments] = useState([]);
  const [supportingDocuments, setSupportingDocuments] = useState([]);
  const [fdaDispatchProofDocuments, setFdaDispatchProofDocuments] = useState([]);
  const [copyOfSalesOrderDocuments, setCopyOfSalesOrderDocuments] = useState([]);
  // CREW CHANGE document states
  const [crewChangeAppointmentEmailDocuments, setCrewChangeAppointmentEmailDocuments] = useState([]);
  const [launchHireSlipsDocuments, setLaunchHireSlipsDocuments] = useState([]);
  const [zawilPassCopyDocuments, setZawilPassCopyDocuments] = useState([]);
  const [cgPermitCopyDocuments, setCgPermitCopyDocuments] = useState([]);
  const [crewSummarySheetDocuments, setCrewSummarySheetDocuments] = useState([]);
  const [crewChangeSupportingDocuments, setCrewChangeSupportingDocuments] = useState([]);
  const [crewChangeFdaDispatchProofDocuments, setCrewChangeFdaDispatchProofDocuments] = useState([]);
  const [hotelInvoiceDocuments, setHotelInvoiceDocuments] = useState([]);
  const [crewChangeCopyOfSalesOrderDocuments, setCrewChangeCopyOfSalesOrderDocuments] = useState([]);
  const [inwardClearanceDocuments, setInwardClearanceDocuments] = useState([]);
  const [outwardClearanceDocuments, setOutwardClearanceDocuments] = useState([]);
  // FLEET document states
  const [fleetAppointmentEmailDocuments, setFleetAppointmentEmailDocuments] = useState([]);
  const [fleetCopyOfSalesOrderDocuments, setFleetCopyOfSalesOrderDocuments] = useState([]);
  // ON STATION document states
  const [onStationAppointmentEmailDocuments, setOnStationAppointmentEmailDocuments] = useState([]);
  const [onStationSupportingDocuments, setOnStationSupportingDocuments] = useState([]);
  const [onStationFdaDispatchProofDocuments, setOnStationFdaDispatchProofDocuments] = useState([]);
  const [onStationCopyOfSalesOrderDocuments, setOnStationCopyOfSalesOrderDocuments] = useState([]);
  const [dailyReportEmailOptions, setDailyReportEmailOptions] = useState([]);
  const [dailyReportEmailLoading, setDailyReportEmailLoading] = useState(false);
  const [billingInstructionType, setBillingInstructionType] = useState("");
  const [billingInstructionEmailOptions, setBillingInstructionEmailOptions] = useState([]);
  const [billingInstructionLoading, setBillingInstructionLoading] = useState(false);

  const [masterDataLoading, setMasterDataLoading] = useState(false);
  const [operatorOptions, setOperatorOptions] = useState([]);
  const [portSelectOptions, setPortSelectOptions] = useState([]);
  const [callTypeOptions, setCallTypeOptions] = useState([]);
  const [billingEntitySelectOptions, setBillingEntitySelectOptions] = useState([]);
  const [vesselTypeSelectOptions, setVesselTypeSelectOptions] = useState([]);
  const [bargeTypeSelectOptions, setBargeTypeSelectOptions] = useState([]);
  const [entityFields, setEntityFields] = useState([]);
  const [entityFieldValues, setEntityFieldValues] = useState({});
  const [entityFieldsLoading, setEntityFieldsLoading] = useState(false);
  const [entityFieldsError, setEntityFieldsError] = useState("");
  const [appointmentEmailParsing, setAppointmentEmailParsing] = useState(false);
  const [appointmentEmailAutofillError, setAppointmentEmailAutofillError] = useState("");

  // Initialize dummy document when not in add mode
  useEffect(() => {
    if (!isAddMode && appointmentDocuments.length === 0) {
      const dummyDocument = {
        name: "appointment_document.pdf",
        size: 1024000, // 1MB
        type: "application/pdf"
      };
      setAppointmentDocuments([dummyDocument]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAddMode]);

  useEffect(() => {
    let cancelled = false;

    const fetchRow = async (label, request, mapFn) => {
      try {
        const { data } = await request;
        const list = unwrapListResponse(data);
        return { label, options: mapFn(list) };
      } catch (e) {
        console.error(`[General] ${label} master data failed`, e);
        return { label, options: [] };
      }
    };

    const loadMasterData = async () => {
      setMasterDataLoading(true);
      const results = await Promise.all([
        fetchRow("operators", callFileService.getAllOperators(), mapOperatorsToOptions),
        fetchRow("ports", portService.getPorts({ params: { limit: 1000 } }), mapPortsToOptions),
        fetchRow("callTypes", CommonService.getCallTypes(), mapCallTypesToOptions),
        fetchRow(
          "billingEntities",
          billingEntityService.getBillingEntities({ params: { page: 1, limit: 1000 } }),
          mapBillingEntitiesToOptions
        ),
        fetchRow("vesselTypes", vesselTypeService.getVesselTypes({ params: { limit: 1000 } }), mapVesselTypesToOptions),
        fetchRow("bargeTypes", bargeTypeService.getBargeTypes({ params: { limit: 1000 } }), mapBargeTypesToOptions),
      ]);

      if (cancelled) return;

      for (const { label, options } of results) {
        if (label === "operators") setOperatorOptions(options);
        if (label === "ports") setPortSelectOptions(options);
        if (label === "callTypes") setCallTypeOptions(options);
        if (label === "billingEntities") setBillingEntitySelectOptions(options);
        if (label === "vesselTypes") setVesselTypeSelectOptions(options);
        if (label === "bargeTypes") setBargeTypeSelectOptions(options);
      }
      setMasterDataLoading(false);
    };

    loadMasterData();
    return () => {
      cancelled = true;
    };
  }, []);

  // Determine current job status from card data (updated for 5 statuses)
  const currentStatus = useMemo(() => {
    // Map card properties to status keys
    if (card?.sailed) return "sailed";
    if (card?.cleared) return "cleared";
    if (card?.arrived) return "arrived";
    if (card?.expected) return "expected";
    if (card?.received) return "received";
    // Default to Received
    return "expected";
  }, [card]);

  const typeOptions = [
    { value: "Type", label: "IMPORT" },
    { value: "MWP RENEWAL", label: "MWP RENEWAL" },
    // { value: "CREW CHANGE", label: "CREW CHANGE" },
    { value: "FLEET", label: "FLEET" },
    // { value: "MATERIAL DELIVERY", label: "MATERIAL DELIVERY" },
    // { value: "ON STATION", label: "ON STATION" },
  ];

  // Dummy values for all fields when isAddMode is false
  const dummyValues = {
    owner: "John Doe",
    appointmentReceivedDate: "2024-01-15",
    appointmentReceivedTime: "10:30",
    typeOfCall: "Import",
    mainBillingEntity: "SS7",
    poNumber: "PO-12345",
    shipper: "SRT-67890",
    project: "Project Alpha",
    vesselType: "Foreign Flag",
    bargeType: "Barge Import",
    vesselName: "MV Ocean Star",
    vesselOwner: "Ocean Shipping Co.",
    vesselPrincipal: "Principal Marine Ltd.",
    vesselManager: "Marine Management Inc.",
    otherBillingEntity: "Other Entity",
    assignedOperator: "Operator Name",
    serviceRequestorName: "Requestor Name",
    dailyReportEmail: ["admin@example.com", "reports@example.com"],
    billingInstructions: "Standard billing instructions apply",
    // CREW CHANGE specific fields
    lastMovedDate: "2024-01-20",
    lastMovedTime: "14:30",
    taxInvoice: "TI-98765",
    srtPoWbs: "SRT-123|PO-456|WBS-789",
    totalOnsigners: "5",
    totalOffsigners: "3",
    thirdPartyItems: "Various items",
    billingEntity: "SS7",
    operationsCompletionDate: "2024-01-25",
    operationsCompletionTime: "16:00",
    invoiceAmount: "50000.00",
    sapSalesOrderNo: "SO-12345",
  };


  // Helper function to get field value - prioritize formValues, then card, then dummy value if not in add mode
  const getFieldValue = (fieldName) => {
    if (formValues?.[fieldName] !== undefined && formValues[fieldName] !== null && formValues[fieldName] !== "") {
      return formValues[fieldName];
    }
    if (!isAddMode && card?.[fieldName] !== undefined && card[fieldName] !== null && card[fieldName] !== "") {
      return card[fieldName];
    }
    // Return dummy value when not in add mode
    if (!isAddMode && dummyValues[fieldName] !== undefined) {
      return dummyValues[fieldName];
    }
    return "";
  };

  const handleDocumentRemove = (index) => {
    setAppointmentDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAppointmentEmailDocumentAdd = async (file) => {
    if (!isAppointmentEmailFileValid(file)) {
      setAppointmentEmailAutofillError(getAppointmentEmailValidationMessage(file?.name));
      return;
    }

    setAppointmentEmailAutofillError("");
    setAppointmentDocuments((prev) => [...prev, file]);
    setAppointmentEmailParsing(true);

    try {
      const { mappedValues, warnings = [] } = await parseAppointmentEmailFile(file);
      const existingDailyReportEmail = Array.isArray(getFieldValue("dailyReportEmail"))
        ? getFieldValue("dailyReportEmail")
        : [];

      applyAppointmentEmailAutofill({
        mappedValues,
        handleChange,
        existingDailyReportEmail,
      });

      if (warnings.length > 0) {
        setAppointmentEmailAutofillError(warnings.join(" "));
      }
    } catch (error) {
      console.error("[General] appointment email parse failed", error);
      setAppointmentEmailAutofillError(
        error?.message || "Unable to parse appointment email file. Please review and fill details manually."
      );
    } finally {
      setAppointmentEmailParsing(false);
    }
  };

  const normalizeEntityEmailOptions = useCallback((payload) => {
    const root = payload?.data ?? payload ?? {};
    const rows = Array.isArray(root?.emails) ? root.emails : [];
    return rows
      .map((row) => {
        const value = row?.email ? String(row.email).trim() : "";
        return value ? { value, label: value } : null;
      })
      .filter(Boolean);
  }, []);

  const fetchBillingEntityEmails = useCallback(
    async (entityId) => {
      const normalizedEntityId = entityId === undefined || entityId === null ? "" : String(entityId).trim();
      if (!normalizedEntityId) {
        setDailyReportEmailOptions([]);
        return;
      }

      setDailyReportEmailLoading(true);
      try {
        const { data } = await billingEntityService.getAllEmailByEntity(normalizedEntityId);
        setDailyReportEmailOptions(normalizeEntityEmailOptions(data));
      } catch (error) {
        console.error("[General] billing entity emails fetch failed", error);
        setDailyReportEmailOptions([]);
      } finally {
        setDailyReportEmailLoading(false);
      }
    },
    [normalizeEntityEmailOptions]
  );

  const normalizeBillingInstruction = useCallback((payload) => {
    const root = payload?.data ?? payload ?? {};
    const data = root?.data ?? root ?? {};
    const instructionType = data?.instruction_type ? String(data.instruction_type).trim() : "";
    const description = data?.description ? String(data.description) : "";
    const emails = Array.isArray(data?.emails) ? data.emails : [];
    const emailOptions = emails
      .map((email) => {
        const normalizedEmail = email ? String(email).trim() : "";
        return normalizedEmail ? { value: normalizedEmail, label: normalizedEmail } : null;
      })
      .filter(Boolean);

    return { instructionType, description, emailOptions };
  }, []);

  const fetchBillingInstructionByEntity = useCallback(
    async (entityId) => {
      const normalizedEntityId = entityId === undefined || entityId === null ? "" : String(entityId).trim();
      if (!normalizedEntityId) {
        setBillingInstructionType("");
        setBillingInstructionEmailOptions([]);
        handleChange("billingInstructions")({ target: { value: "", name: "billingInstructions" } });
        handleChange("billingInstructionEmails")({ target: { value: [], name: "billingInstructionEmails" } });
        return;
      }

      setBillingInstructionLoading(true);
      try {
        const { data } = await billingInstructionService.fetchInstructionByEntity(normalizedEntityId);
        const { instructionType, description, emailOptions } = normalizeBillingInstruction(data);
        setBillingInstructionType(instructionType);
        setBillingInstructionEmailOptions(emailOptions);

        const isEmailInstruction = instructionType.toLowerCase() === "email";
        handleChange("billingInstructionEmails")({
          target: { value: isEmailInstruction ? emailOptions.map((opt) => opt.value) : [], name: "billingInstructionEmails" }
        });
        handleChange("billingInstructions")({
          target: { value: isEmailInstruction ? "" : description, name: "billingInstructions" }
        });
      } catch (error) {
        console.error("[General] billing instruction fetch failed", error);
        setBillingInstructionType("");
        setBillingInstructionEmailOptions([]);
        handleChange("billingInstructionEmails")({ target: { value: [], name: "billingInstructionEmails" } });
      } finally {
        setBillingInstructionLoading(false);
      }
    },
    [handleChange, normalizeBillingInstruction]
  );

  const normalizeVesselOptions = useCallback((payload) => {
    const rows = unwrapListResponse(payload);
    return rows
      .map((row) => {
        const vesselId = row?.vessel_id === undefined || row?.vessel_id === null ? "" : String(row.vessel_id);
        const vesselName = row?.vessel_name ? String(row.vessel_name).trim() : "";
        if (!vesselId || !vesselName) return null;
        return { value: vesselId, label: vesselName };
      })
      .filter(Boolean);
  }, []);

  const fetchVesselsByEntity = useCallback(
    async (entityId) => {
      const normalizedEntityId = entityId === undefined || entityId === null ? "" : String(entityId).trim();
      if (!normalizedEntityId) {
        setVesselNameOptions([]);
        return;
      }

      setVesselOptionsLoading(true);
      try {
        const { data } = await vesselService.getVesselByEntity(normalizedEntityId);
        setVesselNameOptions(normalizeVesselOptions(data));
      } catch (error) {
        console.error("[General] vessels by entity fetch failed", error);
        setVesselNameOptions([]);
      } finally {
        setVesselOptionsLoading(false);
      }
    },
    [normalizeVesselOptions]
  );

  const normalizeVesselDetails = useCallback((payload) => {
    const raw = payload?.data ?? payload ?? {};
    const detail = Array.isArray(raw) ? (raw[0] ?? {}) : raw;
    return {
      vessel_name: detail?.vessel_name ? String(detail.vessel_name) : "",
      vessel_owner: detail?.vessel_owner ? String(detail.vessel_owner) : "",
      vessel_manager: detail?.vessel_manager ? String(detail.vessel_manager) : "",
      vessel_principal: detail?.vessel_principal ? String(detail.vessel_principal) : "",
    };
  }, []);

  const handleVesselSelectionChange = useCallback(
    async (event) => {
      const selectedVesselId = event?.target?.value ?? "";
      handleChange("vesselName")(event);

      // Clear details immediately to avoid showing stale data.
      handleChange("vesselOwner")({ target: { value: "", name: "vesselOwner" } });
      handleChange("vesselManager")({ target: { value: "", name: "vesselManager" } });
      handleChange("vesselPrincipal")({ target: { value: "", name: "vesselPrincipal" } });

      const normalizedVesselId = selectedVesselId === undefined || selectedVesselId === null ? "" : String(selectedVesselId).trim();
      if (!normalizedVesselId) return;

      try {
        const { data } = await vesselService.getVesselDetailByVesselId(normalizedVesselId);
        const detail = normalizeVesselDetails(data);
        handleChange("vesselOwner")({ target: { value: detail.vessel_owner, name: "vesselOwner" } });
        handleChange("vesselManager")({ target: { value: detail.vessel_manager, name: "vesselManager" } });
        handleChange("vesselPrincipal")({ target: { value: detail.vessel_principal, name: "vesselPrincipal" } });
      } catch (error) {
        console.error("[General] vessel detail fetch failed", error);
      }
    },
    [handleChange, normalizeVesselDetails]
  );

  // Handle new email addition
  const handleAddNewEmail = useCallback(
    async (email) => {
      const normalizedEmail = email ? String(email).trim() : "";
      const currentEntityId = getFieldValue("mainBillingEntity");
      const normalizedEntityId = currentEntityId === undefined || currentEntityId === null ? "" : String(currentEntityId).trim();
      if (!normalizedEmail || !normalizedEntityId) return;

      try {
        await billingEntityService.addBillingEntityEmail({
          entity_id: normalizedEntityId,
          email: normalizedEmail,
        });
      } catch (error) {
        console.error("[General] add billing entity email failed", error);
      }

      setDailyReportEmailOptions((prev) => {
        if (prev.some((opt) => opt.value === normalizedEmail)) return prev;
        return [...prev, { value: normalizedEmail, label: normalizedEmail }];
      });
    },
    [getFieldValue]
  );

  const handleAddBillingInstructionEmail = useCallback(
    async (email) => {
      const normalizedEmail = email ? String(email).trim() : "";
      const currentEntityId = getFieldValue("mainBillingEntity");
      const normalizedEntityId = currentEntityId === undefined || currentEntityId === null ? "" : String(currentEntityId).trim();
      if (!normalizedEmail || !normalizedEntityId) return;

      try {
        await billingInstructionService.addBillingInstructionEmail({
          entity_id: normalizedEntityId,
          email: normalizedEmail,
        });
      } catch (error) {
        console.error("[General] add billing instruction email failed", error);
      }

      setBillingInstructionEmailOptions((prev) => {
        if (prev.some((opt) => opt.value === normalizedEmail)) return prev;
        return [...prev, { value: normalizedEmail, label: normalizedEmail }];
      });
    },
    [getFieldValue]
  );

  // Handle vessel save - add new vessel to options and update form value
  const handleVesselSave = (vesselName) => {
    const newVesselOption = {
      value: vesselName,
      label: vesselName,
    };

    // Add to options if not already exists
    if (!vesselNameOptions.some(opt => opt.value === newVesselOption.value)) {
      setVesselNameOptions([...vesselNameOptions, newVesselOption]);
    }

    // Update form value to the newly added vessel
    const syntheticEvent = {
      target: { value: vesselName, name: "vesselName" }
    };
    handleChange("vesselName")(syntheticEvent);
  };

  // Determine if fields should be disabled
  // In simplified mode: always enabled
  // In full mode: disabled when not in add mode (same as before)
  const isDisabled = isSimplifiedMode ? false : !isAddMode;
  const masterInputsDisabled = isDisabled || masterDataLoading;

  // Check if MWP RENEWAL type is selected in simplified mode
  const isMwPRenewal = isSimplifiedMode && getFieldValue("type") === "MWP RENEWAL";

  // Check if CREW CHANGE type is selected in simplified mode (or Type which should show same fields)
  const isCrewChange = isSimplifiedMode && (getFieldValue("type") === "CREW CHANGE" || getFieldValue("type") === "Type");

  // Check if FLEET type is selected in simplified mode
  const isFleet = isSimplifiedMode && getFieldValue("type") === "FLEET";

  // Check if MATERIAL DELIVERY type is selected in simplified mode
  const isMaterialDelivery = isSimplifiedMode && getFieldValue("type") === "MATERIAL DELIVERY";

  // Check if ON STATION type is selected in simplified mode
  const isOnStation = isSimplifiedMode && getFieldValue("type") === "ON STATION";

  const normalizeEntityFields = useCallback((rows) => {
    if (!Array.isArray(rows)) return [];
    return rows
      .map((row) => ({
        field_id: row?.field_id === undefined || row?.field_id === null ? "" : String(row.field_id),
        field_name: row?.field_name ? String(row.field_name).trim() : "",
      }))
      .filter((row) => row.field_id && row.field_name);
  }, []);

  const buildEntityFieldsPayload = useCallback(
    (fields, values) =>
      fields
        .map((field) => {
          const rawValue = values?.[field.field_id];
          const value = rawValue === undefined || rawValue === null ? "" : String(rawValue);
          return {
            field_id: field.field_id,
            field_name: field.field_name,
            value,
          };
        })
        .filter((item) => item.value.trim() !== ""),
    []
  );

  const handleEntityFieldValueChange = useCallback((fieldId) => (event) => {
    const nextValue = event?.target?.value ?? "";
    setEntityFieldValues((prev) => ({
      ...prev,
      [fieldId]: nextValue,
    }));
  }, []);

  const fetchEntityFields = useCallback(
    async (entityId, preservedValues = {}) => {
      const normalizedEntityId = entityId === undefined || entityId === null ? "" : String(entityId).trim();
      if (!normalizedEntityId) {
        setEntityFields([]);
        setEntityFieldValues({});
        setEntityFieldsLoading(false);
        setEntityFieldsError("");
        return;
      }

      setEntityFieldsLoading(true);
      setEntityFieldsError("");
      try {
        const { data } = await callFileService.getEntityFields(normalizedEntityId);
        const rows = unwrapListResponse(data);
        const normalizedFields = normalizeEntityFields(rows);

        setEntityFields(normalizedFields);
        setEntityFieldValues(() => {
          if (!normalizedFields.length) return {};
          const nextValues = {};
          normalizedFields.forEach((field) => {
            const previousValue = preservedValues?.[field.field_id];
            nextValues[field.field_id] = previousValue === undefined || previousValue === null ? "" : String(previousValue);
          });
          return nextValues;
        });
      } catch (error) {
        console.error("[General] entity fields fetch failed", error);
        setEntityFields([]);
        setEntityFieldValues({});
        setEntityFieldsError("Unable to load billing entity fields.");
      } finally {
        setEntityFieldsLoading(false);
      }
    },
    [normalizeEntityFields]
  );

  const handleMainBillingEntityChange = useCallback(
    (event) => {
      const selectedEntityId = event?.target?.value ?? "";
      handleChange("mainBillingEntity")(event);
      handleChange("dailyReportEmail")({
        target: { value: [], name: "dailyReportEmail" }
      });
      handleChange("billingInstructionEmails")({
        target: { value: [], name: "billingInstructionEmails" }
      });
      handleChange("billingInstructions")({
        target: { value: "", name: "billingInstructions" }
      });
      handleChange("vesselName")({ target: { value: "", name: "vesselName" } });
      handleChange("vesselOwner")({ target: { value: "", name: "vesselOwner" } });
      handleChange("vesselManager")({ target: { value: "", name: "vesselManager" } });
      handleChange("vesselPrincipal")({ target: { value: "", name: "vesselPrincipal" } });
      setEntityFields([]);
      setEntityFieldValues({});
      setEntityFieldsError("");
      void fetchEntityFields(selectedEntityId);
      void fetchBillingEntityEmails(selectedEntityId);
      void fetchBillingInstructionByEntity(selectedEntityId);
      void fetchVesselsByEntity(selectedEntityId);
    },
    [fetchBillingEntityEmails, fetchBillingInstructionByEntity, fetchEntityFields, fetchVesselsByEntity, handleChange]
  );

  useEffect(() => {
    const selectedEntityId = getFieldValue("mainBillingEntity");
    if (!selectedEntityId) return;
    void fetchEntityFields(selectedEntityId, entityFieldValues);
    void fetchBillingEntityEmails(selectedEntityId);
    void fetchBillingInstructionByEntity(selectedEntityId);
    void fetchVesselsByEntity(selectedEntityId);
    // Intentionally only bootstraps once for initial selected entity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);




  return (
    <div className="cardform-body general-tab-body">
      <div className="general-sections-wrapper">
        {/* {!isAddMode && !isSimplifiedMode && (
          <div className="cf-section job-status-section">
            <div className="cf-section-header">
              <div className="cf-section-title">Job Status</div>
            </div>
            <div className="cf-section-body job-status-section-body">
              <HorizontalProgressBar
                stages={JOB_STATUSES}
                currentStatus={currentStatus}
                accentColor={accentColor}
                card={card}
                formValues={formValues}
              />
            </div>
          </div>
        )} */}

        <div className="cf-section general-info-section">
          {!isAddMode && (
            <div className="cf-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="cf-section-title">General Information</div>
              {isSimplifiedMode && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ minWidth: "200px" }}>
                    <FormSelect
                      value={getFieldValue("type")}
                      onChange={handleChange("type")}
                      options={typeOptions}
                      placeholder="Select type..."
                      disabled={isDisabled}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="cf-section-body">
            <div className="general-info-two-column general-tab-form-layout">
              <div className="general-info-left">
                <div className="pre-arrival-form">
                  {isFleet ? (
                    <>
                      <OwnerField
                        value={getFieldValue("owner")}
                        onChange={handleChange("owner")}
                        options={mergeOptionIfMissing(operatorOptions, getFieldValue("owner"))}
                        placeholder="Select owner"
                        disabled={masterInputsDisabled}
                      />

                      <FormField label="Billing Entity">
                        <FormSelect
                          value={getFieldValue("billingEntity") || "SS7"}
                          onChange={handleChange("billingEntity")}
                          options={[{ value: "SS7", label: "SS7" }]}
                          placeholder="Select billing entity..."
                          disabled={true}
                        />
                      </FormField>

                      <FormField label="VESSEL NAME">
                        <FormSelect
                          value={getFieldValue("vesselName") || "MV Ocean Star"}
                          onChange={handleChange("vesselName")}
                          options={[{ value: getFieldValue("vesselName") || "MV Ocean Star", label: getFieldValue("vesselName") || "MV Ocean Star" }]}
                          placeholder="Select vessel name..."
                          disabled={true}
                        />
                      </FormField>

                      <FormField label="Last moved">
                        <div className="cf-input date-time-row">
                          <input
                            type="date"
                            value={getFieldValue("lastMovedDate")}
                            onChange={handleChange("lastMovedDate")}
                            placeholder="Select date"
                            disabled={isDisabled}
                          />
                          <input
                            type="time"
                            value={getFieldValue("lastMovedTime")}
                            onChange={handleChange("lastMovedTime")}
                            placeholder="Select time"
                            disabled={isDisabled}
                          />
                        </div>
                      </FormField>
                    </>
                  ) : (isCrewChange || isMaterialDelivery) ? (
                    <>
                      <OwnerField
                        value={getFieldValue("owner")}
                        onChange={handleChange("owner")}
                        options={mergeOptionIfMissing(operatorOptions, getFieldValue("owner"))}
                        placeholder="Select owner"
                        disabled={masterInputsDisabled}
                      />

                      <FormField label="Billing Entity">
                        <FormSelect
                          value={getFieldValue("billingEntity") || "SS7"}
                          onChange={handleChange("billingEntity")}
                          options={[{ value: "SS7", label: "SS7" }]}
                          placeholder="Select billing entity..."
                          disabled={true}
                        />
                      </FormField>

                      <FormField label="SRT|PO|WBS">
                        <FormInput
                          type="text"
                          placeholder="Enter SRT|PO|WBS..."
                          value={getFieldValue("srtPoWbs")}
                          onChange={handleChange("srtPoWbs")}
                          disabled={isDisabled}
                        />
                      </FormField>

                      <FormField label="VESSEL NAME">
                        <FormSelect
                          value={getFieldValue("vesselName") || "MV Ocean Star"}
                          onChange={handleChange("vesselName")}
                          options={[{ value: getFieldValue("vesselName") || "MV Ocean Star", label: getFieldValue("vesselName") || "MV Ocean Star" }]}
                          placeholder="Select vessel name..."
                          disabled={true}
                        />
                      </FormField>

                      <FormField label="Last moved">
                        <div className="cf-input date-time-row">
                          <input
                            type="date"
                            value={getFieldValue("lastMovedDate")}
                            onChange={handleChange("lastMovedDate")}
                            placeholder="Select date"
                            disabled={isDisabled}
                          />
                          <input
                            type="time"
                            value={getFieldValue("lastMovedTime")}
                            onChange={handleChange("lastMovedTime")}
                            placeholder="Select time"
                            disabled={isDisabled}
                          />
                        </div>
                      </FormField>

                      <FormField label="Inward Clearance Date">
                        <div className="cf-input date-time-row">
                          <input
                            type="date"
                            value={getFieldValue("inwardClearanceDate")}
                            onChange={handleChange("inwardClearanceDate")}
                            placeholder="Select date"
                            disabled={isDisabled}
                          />
                          <input
                            type="time"
                            value={getFieldValue("inwardClearanceTime")}
                            onChange={handleChange("inwardClearanceTime")}
                            placeholder="Select time"
                            disabled={isDisabled}
                          />
                        </div>
                      </FormField>

                      <FormField label="Outward Clearance Date">
                        <div className="cf-input date-time-row">
                          <input
                            type="date"
                            value={getFieldValue("outwardClearanceDate")}
                            onChange={handleChange("outwardClearanceDate")}
                            placeholder="Select date"
                            disabled={isDisabled}
                          />
                          <input
                            type="time"
                            value={getFieldValue("outwardClearanceTime")}
                            onChange={handleChange("outwardClearanceTime")}
                            placeholder="Select time"
                            disabled={isDisabled}
                          />
                        </div>
                      </FormField>

                      <FormField label="Operations completion date">
                        <div className="cf-input date-time-row">
                          <input
                            type="date"
                            value={getFieldValue("operationsCompletionDate")}
                            onChange={handleChange("operationsCompletionDate")}
                            placeholder="Select date"
                            disabled={isDisabled}
                          />
                          <input
                            type="time"
                            value={getFieldValue("operationsCompletionTime")}
                            onChange={handleChange("operationsCompletionTime")}
                            placeholder="Select time"
                            disabled={isDisabled}
                          />
                        </div>
                      </FormField>

                      <FormField label="Total Onsigners">
                        <FormInput
                          type="number"
                          placeholder="Enter total onsigners..."
                          value={getFieldValue("totalOnsigners")}
                          onChange={handleChange("totalOnsigners")}
                          disabled={true}
                        />
                      </FormField>

                      <FormField label="Total Offsigners">
                        <FormInput
                          type="number"
                          placeholder="Enter total offsigners..."
                          value={getFieldValue("totalOffsigners")}
                          onChange={handleChange("totalOffsigners")}
                          disabled={true}
                        />
                      </FormField>

                      <FormField label="3rd Party Items">
                        <FormInput
                          type="text"
                          placeholder="Enter 3rd party items..."
                          value={getFieldValue("thirdPartyItems")}
                          onChange={handleChange("thirdPartyItems")}
                          disabled={isDisabled}
                        />
                      </FormField>

                      <FormField label="Tax Invoice">
                        <FormInput
                          type="text"
                          placeholder="Enter tax invoice..."
                          value={getFieldValue("taxInvoice")}
                          onChange={handleChange("taxInvoice")}
                          disabled={isDisabled}
                        />
                      </FormField>

                      <FormField label="Invoice amount (Including VAT)">
                        <FormInput
                          type="text"
                          placeholder="Enter invoice amount..."
                          value={getFieldValue("invoiceAmount")}
                          onChange={handleChange("invoiceAmount")}
                          disabled={isDisabled}
                        />
                      </FormField>

                      <FormField label="SAP Sales Order No">
                        <FormSelect
                          value={getFieldValue("sapSalesOrderNo") || "SO-12345"}
                          onChange={handleChange("sapSalesOrderNo")}
                          options={[{ value: getFieldValue("sapSalesOrderNo") || "SO-12345", label: getFieldValue("sapSalesOrderNo") || "SO-12345" }]}
                          placeholder="Select SAP Sales Order No..."
                          disabled={true}
                        />
                      </FormField>

                      <FormField label="Service requester">
                        <FormSelect
                          value={getFieldValue("serviceRequestorName") || "Service Requester Name"}
                          onChange={handleChange("serviceRequestorName")}
                          options={[{ value: getFieldValue("serviceRequestorName") || "Service Requester Name", label: getFieldValue("serviceRequestorName") || "Service Requester Name" }]}
                          placeholder="Select service requester..."
                          disabled={true}
                        />
                      </FormField>
                    </>
                  ) : isOnStation ? (
                    <>
                      <OwnerField
                        value={getFieldValue("owner")}
                        onChange={handleChange("owner")}
                        options={mergeOptionIfMissing(operatorOptions, getFieldValue("owner"))}
                        placeholder="Select owner"
                        disabled={masterInputsDisabled}
                      />

                      <FormField label="Billing Entity">
                        <FormSelect
                          value={getFieldValue("billingEntity") || "SS7"}
                          onChange={handleChange("billingEntity")}
                          options={[{ value: "SS7", label: "SS7" }]}
                          placeholder="Select billing entity..."
                          disabled={true}
                        />
                      </FormField>

                      <FormField label="SRT|PO|WBS">
                        <FormInput
                          type="text"
                          placeholder="Enter SRT|PO|WBS..."
                          value={getFieldValue("srtPoWbs")}
                          onChange={handleChange("srtPoWbs")}
                          disabled={isDisabled}
                        />
                      </FormField>

                      <FormField label="Operations completion Date">
                        <div className="cf-input date-time-row">
                          <input
                            type="date"
                            value={getFieldValue("operationsCompletionDate")}
                            onChange={handleChange("operationsCompletionDate")}
                            placeholder="Select date"
                            disabled={isDisabled}
                          />
                          <input
                            type="time"
                            value={getFieldValue("operationsCompletionTime")}
                            onChange={handleChange("operationsCompletionTime")}
                            placeholder="Select time"
                            disabled={isDisabled}
                          />
                        </div>
                      </FormField>

                      <FormField label="VESSEL NAME">
                        <FormSelect
                          value={getFieldValue("vesselName") || "MV Ocean Star"}
                          onChange={handleChange("vesselName")}
                          options={[{ value: getFieldValue("vesselName") || "MV Ocean Star", label: getFieldValue("vesselName") || "MV Ocean Star" }]}
                          placeholder="Select vessel name..."
                          disabled={true}
                        />
                      </FormField>

                      <FormField label="Last moved">
                        <div className="cf-input date-time-row">
                          <input
                            type="date"
                            value={getFieldValue("lastMovedDate")}
                            onChange={handleChange("lastMovedDate")}
                            placeholder="Select date"
                            disabled={isDisabled}
                          />
                          <input
                            type="time"
                            value={getFieldValue("lastMovedTime")}
                            onChange={handleChange("lastMovedTime")}
                            placeholder="Select time"
                            disabled={isDisabled}
                          />
                        </div>
                      </FormField>

                      <FormField label="Tax Invoice">
                        <FormInput
                          type="text"
                          placeholder="Enter tax invoice..."
                          value={getFieldValue("taxInvoice")}
                          onChange={handleChange("taxInvoice")}
                          disabled={isDisabled}
                        />
                      </FormField>

                      <FormField label="Invoice amount (Including VAT)">
                        <FormInput
                          type="text"
                          placeholder="Enter invoice amount..."
                          value={getFieldValue("invoiceAmount")}
                          onChange={handleChange("invoiceAmount")}
                          disabled={isDisabled}
                        />
                      </FormField>

                      <FormField label="SAP Sales Order No">
                        <FormSelect
                          value={getFieldValue("sapSalesOrderNo") || "SO-12345"}
                          onChange={handleChange("sapSalesOrderNo")}
                          options={[{ value: getFieldValue("sapSalesOrderNo") || "SO-12345", label: getFieldValue("sapSalesOrderNo") || "SO-12345" }]}
                          placeholder="Select SAP Sales Order No..."
                          disabled={true}
                        />
                      </FormField>

                      <FormField label="Service requester">
                        <FormSelect
                          value={getFieldValue("serviceRequestorName") || "Service Requester Name"}
                          onChange={handleChange("serviceRequestorName")}
                          options={[{ value: getFieldValue("serviceRequestorName") || "Service Requester Name", label: getFieldValue("serviceRequestorName") || "Service Requester Name" }]}
                          placeholder="Select service requester..."
                          disabled={true}
                        />
                      </FormField>
                    </>
                  ) : isMwPRenewal ? (
                    <>
                      <OwnerField
                        value={getFieldValue("owner")}
                        onChange={handleChange("owner")}
                        options={mergeOptionIfMissing(operatorOptions, getFieldValue("owner"))}
                        placeholder="Select owner"
                        disabled={masterInputsDisabled}
                      />

                      <FormField label="VESSEL NAME">
                        <FormSelect
                          value="MV Ocean Star"
                          onChange={handleChange("vesselName")}
                          options={[{ value: "MV Ocean Star", label: "MV Ocean Star" }]}
                          placeholder="Select vessel name..."
                          disabled={true}
                        />
                      </FormField>

                      <FormField label="Last moved">
                        <div className="cf-input date-time-row">
                          <input
                            type="date"
                            value={getFieldValue("lastMovedDate")}
                            onChange={handleChange("lastMovedDate")}
                            placeholder="Select date"
                            disabled={isDisabled}
                          />
                          <input
                            type="time"
                            value={getFieldValue("lastMovedTime")}
                            onChange={handleChange("lastMovedTime")}
                            placeholder="Select time"
                            disabled={isDisabled}
                          />
                        </div>
                      </FormField>

                      <FormField label="Tax Invoice">
                        <FormInput
                          type="text"
                          placeholder="Enter tax invoice..."
                          value={getFieldValue("taxInvoice")}
                          onChange={handleChange("taxInvoice")}
                          disabled={isDisabled}
                        />
                      </FormField>

                      <FormField label="Invoice amount (Including VAT)">
                        <FormInput
                          type="text"
                          placeholder="Enter invoice amount..."
                          value={getFieldValue("invoiceAmount")}
                          onChange={handleChange("invoiceAmount")}
                          disabled={isDisabled}
                        />
                      </FormField>

                      <FormField label="SAP Sales Order No">
                        <FormInput
                          type="number"
                          placeholder="Enter SAP Sales Order No..."
                          value={getFieldValue("sapSalesOrderNo")}
                          onChange={handleChange("sapSalesOrderNo")}
                          disabled={isDisabled}
                        />
                      </FormField>

                      <FormField label="Service requester">
                        <FormInput
                          type="text"
                          placeholder="Enter service requester..."
                          value={getFieldValue("serviceRequestorName")}
                          onChange={handleChange("serviceRequestorName")}
                          disabled={isDisabled}
                        />
                      </FormField>

                      <FormField label="PO Number">
                        <FormInput
                          type="text"
                          placeholder="Enter PO number..."
                          value={getFieldValue("poNumber")}
                          onChange={handleChange("poNumber")}
                          disabled={isDisabled}
                        />
                      </FormField>

                      <FormField label="Issue Date">
                        <FormInput
                          type="date"
                          value={getFieldValue("issueDate")}
                          onChange={handleChange("issueDate")}
                          placeholder="Select issue date"
                          disabled={isDisabled}
                        />
                      </FormField>

                      <FormField label="Expiry Date">
                        <FormInput
                          type="date"
                          value={getFieldValue("expiryDate")}
                          onChange={handleChange("expiryDate")}
                          placeholder="Select expiry date"
                          disabled={isDisabled}
                        />
                      </FormField>
                    </>
                  ) : (
                    <>
                      <OwnerField
                        value={getFieldValue("owner")}
                        onChange={handleChange("owner")}
                        options={mergeOptionIfMissing(operatorOptions, getFieldValue("owner"))}
                        placeholder="Select owner"
                        disabled={masterInputsDisabled}
                      />

                      {!isSimplifiedMode && (
                        <div className="form-group">
                          <h3 className="form-group-title">Appointment Details</h3>
                          <FormField label="Appointment Email">
                            <DocumentUpload
                              attachments={appointmentDocuments}
                              onAdd={handleAppointmentEmailDocumentAdd}
                              onRemove={handleDocumentRemove}
                              cardColor={accentColor}
                              disabled={isDisabled || appointmentEmailParsing}
                            />
                            {appointmentEmailParsing && (
                              <div style={{ marginTop: "8px", color: "#3e5cb6", fontSize: "12px" }}>
                                Parsing appointment email...
                              </div>
                            )}
                            {!!appointmentEmailAutofillError && (
                              <div style={{ marginTop: "8px", color: "#dc3545", fontSize: "12px" }}>
                                {appointmentEmailAutofillError}
                              </div>
                            )}
                          </FormField>
                          <FormField label="Appointment Received">
                            <div className="cf-input date-time-row">
                              <input
                                type="date"
                                value={getFieldValue("appointmentReceivedDate")}
                                onChange={handleChange("appointmentReceivedDate")}
                                placeholder="Select date"
                                disabled={isDisabled}
                              />
                              <input
                                type="time"
                                value={getFieldValue("appointmentReceivedTime")}
                                onChange={handleChange("appointmentReceivedTime")}
                                placeholder="Select time"
                                disabled={isDisabled}
                              />
                            </div>
                          </FormField>
                        </div>
                      )}

                      <div className="form-group">
                        <h3 className="form-group-title">Service Information</h3>
                        <FormField label="Port">
                          <FormSelect
                            value={getFieldValue("port")}
                            onChange={handleChange("port")}
                            options={mergeOptionIfMissing(portSelectOptions, getFieldValue("port"))}
                            placeholder="Select port"
                            disabled={masterInputsDisabled}
                          />
                        </FormField>
                        <FormField label="Type of call / Service">
                          <FormSelect
                            value={getFieldValue("typeOfCall")}
                            onChange={handleChange("typeOfCall")}
                            options={mergeOptionIfMissing(callTypeOptions, getFieldValue("typeOfCall"))}
                            placeholder="Select type of call"
                            disabled={masterInputsDisabled}
                          />
                        </FormField>

                        <FormField label="Main Billing entity">
                          <FormSelect
                            value={getFieldValue("mainBillingEntity")}
                            onChange={handleMainBillingEntityChange}
                            options={mergeOptionIfMissing(billingEntitySelectOptions, getFieldValue("mainBillingEntity"))}
                            placeholder="Select billing entity"
                            disabled={masterInputsDisabled}
                          />
                        </FormField>

                        {entityFieldsLoading && (
                          <FormField label="">
                            <div className="cf-input">
                              <input type="text" value="Loading fields..." readOnly />
                            </div>
                          </FormField>
                        )}

                        {!entityFieldsLoading && entityFields.map((field) => (
                          <FormField key={field.field_id} label={field.field_name}>
                            <FormInput
                              type="text"
                              placeholder={`Enter ${field.field_name}...`}
                              value={entityFieldValues[field.field_id] || ""}
                              onChange={handleEntityFieldValueChange(field.field_id)}
                              disabled={isDisabled}
                            />
                          </FormField>
                        ))}

                        {!entityFieldsLoading && entityFieldsError && (
                          <FormField label="">
                            <div className="cf-input">
                              <input type="text" value={entityFieldsError} readOnly />
                            </div>
                          </FormField>
                        )}

                        {/* <FormField label="PO number">
                          <FormInput
                            type="text"
                            placeholder="Enter PO number..."
                            value={getFieldValue("poNumber")}
                            onChange={handleChange("poNumber")}
                            disabled={isDisabled}
                          />
                        </FormField> */}

                        {/* <FormField label="SRT number">
                          <FormInput
                            type="text"
                            placeholder="Enter SRT number..."
                            value={getFieldValue("shipper")}
                            onChange={handleChange("shipper")}
                            disabled={isDisabled}
                          />
                        </FormField> */}

                        {/* <FormField label="Project">
                          <FormInput
                            type="text"
                            placeholder="Enter project..."
                            value={getFieldValue("project")}
                            onChange={handleChange("project")}
                            disabled={isDisabled}
                          />
                        </FormField> */}
                      </div>

                      <div className="form-group">
                        <h3 className="form-group-title">Vessel Information</h3>

                        <FormField label="Vessel type">
                          <FormSelect
                            value={getFieldValue("vesselType")}
                            onChange={handleChange("vesselType")}
                            options={mergeOptionIfMissing(vesselTypeSelectOptions, getFieldValue("vesselType"))}
                            placeholder="Select vessel type"
                            disabled={masterInputsDisabled}
                          />
                        </FormField>

                        <FormField label="Barge type">
                          <FormSelect
                            value={getFieldValue("bargeType")}
                            onChange={handleChange("bargeType")}
                            options={mergeOptionIfMissing(bargeTypeSelectOptions, getFieldValue("bargeType"))}
                            placeholder="Select barge type"
                            disabled={masterInputsDisabled}
                          />
                        </FormField>

                        <VesselNameField
                          value={getFieldValue("vesselName")}
                          onChange={handleVesselSelectionChange}
                          options={vesselNameOptions}
                          placeholder="Select vessel name..."
                          onSave={handleVesselSave}
                          disabled={isDisabled || vesselOptionsLoading}
                        />

                        <FormField label="Vessel Owner">
                          <FormInput
                            type="text"
                            placeholder="Enter vessel owner..."
                            value={getFieldValue("vesselOwner")}
                            onChange={handleChange("vesselOwner")}
                            disabled={isDisabled}
                          />
                        </FormField>

                        <FormField label="Vessel Principal">
                          <FormInput
                            type="text"
                            placeholder="Enter vessel principal..."
                            value={getFieldValue("vesselPrincipal")}
                            onChange={handleChange("vesselPrincipal")}
                            disabled={isDisabled}
                          />
                        </FormField>

                        <FormField label="Vessel Manager">
                          <FormInput
                            type="text"
                            placeholder="Enter vessel manager..."
                            value={getFieldValue("vesselManager")}
                            onChange={handleChange("vesselManager")}
                            disabled={isDisabled}
                          />
                        </FormField>

                        <FormField label="Other billing entity">
                          <FormSelect
                            value={getFieldValue("otherBillingEntity")}
                            onChange={handleChange("otherBillingEntity")}
                            options={mergeOptionIfMissing(billingEntitySelectOptions, getFieldValue("otherBillingEntity"))}
                            placeholder="Select billing entity"
                            disabled={masterInputsDisabled}
                          />
                        </FormField>

                        <FormField label="Assigned Operator">
                          <FormSelect
                            value={getFieldValue("assignedOperator")}
                            onChange={handleChange("assignedOperator")}
                            options={mergeOptionIfMissing(operatorOptions, getFieldValue("assignedOperator"))}
                            placeholder="Select operator"
                            disabled={masterInputsDisabled}
                          />
                        </FormField>

                        <FormField label="Service Requestor Name">
                          <FormInput
                            type="text"
                            placeholder="Enter service requestor name..."
                            value={getFieldValue("serviceRequestorName")}
                            onChange={handleChange("serviceRequestorName")}
                            disabled={isDisabled}
                          />
                        </FormField>

                        <FormField label="Daily Report Email Id">
                          <MultiSelectEmail
                            value={
                              formValues?.dailyReportEmail !== undefined && formValues.dailyReportEmail !== null && formValues.dailyReportEmail.length > 0
                                ? formValues.dailyReportEmail
                                : !isAddMode && card?.dailyReportEmail && card.dailyReportEmail.length > 0
                                  ? card.dailyReportEmail
                                  : !isAddMode
                                    ? dummyValues.dailyReportEmail
                                    : []
                            }
                            onChange={handleChange("dailyReportEmail")}
                            options={dailyReportEmailOptions}
                            placeholder="Select email addresses..."
                            onAddNew={handleAddNewEmail}
                            disabled={isDisabled || dailyReportEmailLoading}
                          />
                        </FormField>

                        <FormField label="Billing instructions">
                          {billingInstructionType.toLowerCase() === "email" ? (
                            <MultiSelectEmail
                              value={
                                Array.isArray(formValues?.billingInstructionEmails)
                                  ? formValues.billingInstructionEmails
                                  : []
                              }
                              onChange={handleChange("billingInstructionEmails")}
                              options={billingInstructionEmailOptions}
                              placeholder="Select billing instruction emails..."
                              onAddNew={handleAddBillingInstructionEmail}
                              disabled={isDisabled || billingInstructionLoading}
                            />
                          ) : (
                            <FormInput
                              type="text"
                              placeholder="Enter billing instructions..."
                              value={getFieldValue("billingInstructions")}
                              onChange={handleChange("billingInstructions")}
                              disabled={isDisabled || billingInstructionLoading}
                            />
                          )}
                        </FormField>

                        {isAddMode && (
                          <div className="form-save-button-wrapper">
                            <button
                              type="button"
                              className="form-save-button"
                              onClick={() => {
                                if (onSave) {
                                  const entityFieldsPayload = buildEntityFieldsPayload(entityFields, entityFieldValues);
                                  onSave({
                                    ...formValues,
                                    entity_fields: entityFieldsPayload,
                                  });
                                }
                              }}
                            >
                              Save
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="general-info-right">
                {isAddMode ? (
                  <div className="card-description-wrapper">
                    <FormField label="Card Description">
                      <ReactQuillEditor
                        value={formValues?.cardDescription || ""}
                        onChange={handleChange("cardDescription")}
                        placeholder="Enter card description..."
                      />
                    </FormField>
                  </div>
                ) : isSimplifiedMode ? (
                  <>
                    <div className="remarks-wrapper">
                      <FormField label="Remarks">
                        <ReactQuillEditor
                          value={formValues?.remarks || card?.remarks || ""}
                          onChange={handleChange("remarks")}
                          placeholder="Enter remarks..."
                        />
                      </FormField>
                    </div>
                    {isFleet ? (
                      <div className="appointment-details-list-wrapper">
                        {/* Appointment Email Section */}
                        <h3 className="appointment-details-title">Appointment Email</h3>
                        <FormField>
                          <DocumentUpload
                            attachments={fleetAppointmentEmailDocuments}
                            onAdd={(file) => setFleetAppointmentEmailDocuments([...fleetAppointmentEmailDocuments, file])}
                            onRemove={(index) => setFleetAppointmentEmailDocuments(fleetAppointmentEmailDocuments.filter((_, i) => i !== index))}
                            cardColor={accentColor}
                            disabled={isDisabled}
                            type="FLEET"
                          />
                        </FormField>

                        {/* Copy of Sales order Section */}
                        <h3 className="appointment-details-title">Copy of Sales order</h3>
                        <FormField>
                          <DocumentUpload
                            attachments={fleetCopyOfSalesOrderDocuments}
                            onAdd={(file) => setFleetCopyOfSalesOrderDocuments([...fleetCopyOfSalesOrderDocuments, file])}
                            onRemove={(index) => setFleetCopyOfSalesOrderDocuments(fleetCopyOfSalesOrderDocuments.filter((_, i) => i !== index))}
                            cardColor={accentColor}
                            disabled={isDisabled}
                            type="FLEET"
                          />
                        </FormField>
                      </div>
                    ) : (isCrewChange || isMaterialDelivery) ? (
                      <div className="appointment-details-list-wrapper">
                        {/* Appointment Email Section */}
                        <h3 className="appointment-details-title">Appointment Email</h3>
                        <FormField>
                          <DocumentUpload
                            attachments={crewChangeAppointmentEmailDocuments}
                            onAdd={(file) => setCrewChangeAppointmentEmailDocuments([...crewChangeAppointmentEmailDocuments, file])}
                            onRemove={(index) => setCrewChangeAppointmentEmailDocuments(crewChangeAppointmentEmailDocuments.filter((_, i) => i !== index))}
                            cardColor={accentColor}
                            disabled={isDisabled}
                            type={isCrewChange ? "CREW CHANGE" : "MATERIAL DELIVERY"}
                          />
                        </FormField>

                        {/* Launch Hire Slips Section */}
                        <h3 className="appointment-details-title">Launch Hire Slips</h3>
                        <FormField>
                          <DocumentUpload
                            attachments={launchHireSlipsDocuments}
                            onAdd={(file) => setLaunchHireSlipsDocuments([...launchHireSlipsDocuments, file])}
                            onRemove={(index) => setLaunchHireSlipsDocuments(launchHireSlipsDocuments.filter((_, i) => i !== index))}
                            cardColor={accentColor}
                            disabled={isDisabled}
                            type={isCrewChange ? "CREW CHANGE" : "MATERIAL DELIVERY"}
                          />
                        </FormField>

                        {/* ZAWIL PASS COPY Section */}
                        <h3 className="appointment-details-title">ZAWIL PASS COPY</h3>
                        <FormField>
                          <DocumentUpload
                            attachments={zawilPassCopyDocuments}
                            onAdd={(file) => setZawilPassCopyDocuments([...zawilPassCopyDocuments, file])}
                            onRemove={(index) => setZawilPassCopyDocuments(zawilPassCopyDocuments.filter((_, i) => i !== index))}
                            cardColor={accentColor}
                            disabled={isDisabled}
                            type={isCrewChange ? "CREW CHANGE" : "MATERIAL DELIVERY"}
                          />
                        </FormField>

                        {/* CG PERMIT COPY Section */}
                        <h3 className="appointment-details-title">CG PERMIT COPY</h3>
                        <FormField>
                          <DocumentUpload
                            attachments={cgPermitCopyDocuments}
                            onAdd={(file) => setCgPermitCopyDocuments([...cgPermitCopyDocuments, file])}
                            onRemove={(index) => setCgPermitCopyDocuments(cgPermitCopyDocuments.filter((_, i) => i !== index))}
                            cardColor={accentColor}
                            disabled={isDisabled}
                            type={isCrewChange ? "CREW CHANGE" : "MATERIAL DELIVERY"}
                          />
                        </FormField>

                        {/* Crew Summary sheet Section */}
                        <h3 className="appointment-details-title">Crew Summary sheet</h3>
                        <FormField>
                          <DocumentUpload
                            attachments={crewSummarySheetDocuments}
                            onAdd={(file) => setCrewSummarySheetDocuments([...crewSummarySheetDocuments, file])}
                            onRemove={(index) => setCrewSummarySheetDocuments(crewSummarySheetDocuments.filter((_, i) => i !== index))}
                            cardColor={accentColor}
                            disabled={isDisabled}
                            type={isCrewChange ? "CREW CHANGE" : "MATERIAL DELIVERY"}
                          />
                        </FormField>

                        {/* Inward Clearance Section */}
                        <h3 className="appointment-details-title">Inward Clearance</h3>
                        <FormField>
                          <DocumentUpload
                            attachments={inwardClearanceDocuments}
                            onAdd={(file) => setInwardClearanceDocuments([...inwardClearanceDocuments, file])}
                            onRemove={(index) => setInwardClearanceDocuments(inwardClearanceDocuments.filter((_, i) => i !== index))}
                            cardColor={accentColor}
                            disabled={isDisabled}
                            type={isCrewChange ? "CREW CHANGE" : "MATERIAL DELIVERY"}
                          />
                        </FormField>

                        {/* Outward Clearance Section */}
                        <h3 className="appointment-details-title">Outward Clearance</h3>
                        <FormField>
                          <DocumentUpload
                            attachments={outwardClearanceDocuments}
                            onAdd={(file) => setOutwardClearanceDocuments([...outwardClearanceDocuments, file])}
                            onRemove={(index) => setOutwardClearanceDocuments(outwardClearanceDocuments.filter((_, i) => i !== index))}
                            cardColor={accentColor}
                            disabled={isDisabled}
                            type={isCrewChange ? "CREW CHANGE" : "MATERIAL DELIVERY"}
                          />
                        </FormField>

                        {/* SUPPORTING DOCUMENTS Section */}
                        <h3 className="appointment-details-title">SUPPORTING DOCUMENTS</h3>
                        <FormField>
                          <DocumentUpload
                            attachments={crewChangeSupportingDocuments}
                            onAdd={(file) => setCrewChangeSupportingDocuments([...crewChangeSupportingDocuments, file])}
                            onRemove={(index) => setCrewChangeSupportingDocuments(crewChangeSupportingDocuments.filter((_, i) => i !== index))}
                            cardColor={accentColor}
                            disabled={isDisabled}
                            type={isCrewChange ? "CREW CHANGE" : "MATERIAL DELIVERY"}
                          />
                        </FormField>

                        {/* FDA Dispatch Proof Section */}
                        <h3 className="appointment-details-title">FDA Dispatch Proof</h3>
                        <FormField>
                          <DocumentUpload
                            attachments={crewChangeFdaDispatchProofDocuments}
                            onAdd={(file) => setCrewChangeFdaDispatchProofDocuments([...crewChangeFdaDispatchProofDocuments, file])}
                            onRemove={(index) => setCrewChangeFdaDispatchProofDocuments(crewChangeFdaDispatchProofDocuments.filter((_, i) => i !== index))}
                            cardColor={accentColor}
                            disabled={isDisabled}
                            type={isCrewChange ? "CREW CHANGE" : "MATERIAL DELIVERY"}
                          />
                        </FormField>

                        {/* Hotel Invoice Section */}
                        <h3 className="appointment-details-title">Hotel Invoice</h3>
                        <FormField>
                          <DocumentUpload
                            attachments={hotelInvoiceDocuments}
                            onAdd={(file) => setHotelInvoiceDocuments([...hotelInvoiceDocuments, file])}
                            onRemove={(index) => setHotelInvoiceDocuments(hotelInvoiceDocuments.filter((_, i) => i !== index))}
                            cardColor={accentColor}
                            disabled={isDisabled}
                            type={isCrewChange ? "CREW CHANGE" : "MATERIAL DELIVERY"}
                          />
                        </FormField>

                        {/* Copy of Sales order Section */}
                        <h3 className="appointment-details-title">Copy of Sales order</h3>
                        <FormField>
                          <DocumentUpload
                            attachments={crewChangeCopyOfSalesOrderDocuments}
                            onAdd={(file) => setCrewChangeCopyOfSalesOrderDocuments([...crewChangeCopyOfSalesOrderDocuments, file])}
                            onRemove={(index) => setCrewChangeCopyOfSalesOrderDocuments(crewChangeCopyOfSalesOrderDocuments.filter((_, i) => i !== index))}
                            cardColor={accentColor}
                            disabled={isDisabled}
                            type={isCrewChange ? "CREW CHANGE" : "MATERIAL DELIVERY"}
                          />
                        </FormField>
                      </div>
                    ) : isMwPRenewal ? (
                      <div className="appointment-details-list-wrapper">
                        {/* Appointment Email Section */}
                        <h3 className="appointment-details-title">APPOINTMENT EMAIL</h3>
                        <FormField>
                          <DocumentUpload
                            attachments={appointmentEmailDocuments}
                            onAdd={(file) => setAppointmentEmailDocuments([...appointmentEmailDocuments, file])}
                            onRemove={(index) => setAppointmentEmailDocuments(appointmentEmailDocuments.filter((_, i) => i !== index))}
                            cardColor={accentColor}
                            disabled={isDisabled}
                          />
                        </FormField>

                        {/* MWP COPY Section */}
                        <h3 className="appointment-details-title">MWP COPY</h3>
                        <FormField>
                          <DocumentUpload
                            attachments={mwpCopyDocuments}
                            onAdd={(file) => setMwpCopyDocuments([...mwpCopyDocuments, file])}
                            onRemove={(index) => setMwpCopyDocuments(mwpCopyDocuments.filter((_, i) => i !== index))}
                            cardColor={accentColor}
                            disabled={isDisabled}
                          />
                        </FormField>

                        {/* SUPPORTING DOCUMENTS Section */}
                        <h3 className="appointment-details-title">SUPPORTING DOCUMENTS</h3>
                        <FormField>
                          <DocumentUpload
                            attachments={supportingDocuments}
                            onAdd={(file) => setSupportingDocuments([...supportingDocuments, file])}
                            onRemove={(index) => setSupportingDocuments(supportingDocuments.filter((_, i) => i !== index))}
                            cardColor={accentColor}
                            disabled={isDisabled}
                          />
                        </FormField>

                        {/* FDA Dispatch Proof Section */}
                        <h3 className="appointment-details-title">FDA DISPATCH PROOF</h3>
                        <FormField>
                          <DocumentUpload
                            attachments={fdaDispatchProofDocuments}
                            onAdd={(file) => setFdaDispatchProofDocuments([...fdaDispatchProofDocuments, file])}
                            onRemove={(index) => setFdaDispatchProofDocuments(fdaDispatchProofDocuments.filter((_, i) => i !== index))}
                            cardColor={accentColor}
                            disabled={isDisabled}
                          />
                        </FormField>

                        {/* Copy of Sales order Section */}
                        <h3 className="appointment-details-title">COPY OF SALES ORDER</h3>
                        <FormField>
                          <DocumentUpload
                            attachments={copyOfSalesOrderDocuments}
                            onAdd={(file) => setCopyOfSalesOrderDocuments([...copyOfSalesOrderDocuments, file])}
                            onRemove={(index) => setCopyOfSalesOrderDocuments(copyOfSalesOrderDocuments.filter((_, i) => i !== index))}
                            cardColor={accentColor}
                            disabled={isDisabled}
                          />
                        </FormField>
                      </div>
                    ) : isOnStation ? (
                      <>
                        <div className="appointment-details-list-wrapper">
                          {/* Appointment Email Section */}
                          <h3 className="appointment-details-title">Appointment Email</h3>
                          <FormField>
                            <DocumentUpload
                              attachments={onStationAppointmentEmailDocuments}
                              onAdd={(file) => setOnStationAppointmentEmailDocuments([...onStationAppointmentEmailDocuments, file])}
                              onRemove={(index) => setOnStationAppointmentEmailDocuments(onStationAppointmentEmailDocuments.filter((_, i) => i !== index))}
                              cardColor={accentColor}
                              disabled={isDisabled}
                              type="ON STATION"
                            />
                          </FormField>

                          {/* SUPPORTING DOCUMENTS Section */}
                          <h3 className="appointment-details-title">SUPPORTING DOCUMENTS</h3>
                          <FormField>
                            <DocumentUpload
                              attachments={onStationSupportingDocuments}
                              onAdd={(file) => setOnStationSupportingDocuments([...onStationSupportingDocuments, file])}
                              onRemove={(index) => setOnStationSupportingDocuments(onStationSupportingDocuments.filter((_, i) => i !== index))}
                              cardColor={accentColor}
                              disabled={isDisabled}
                              type="ON STATION"
                            />
                          </FormField>

                          {/* FDA Dispatch Proof Section */}
                          <h3 className="appointment-details-title">FDA Dispatch Proof</h3>
                          <FormField>
                            <DocumentUpload
                              attachments={onStationFdaDispatchProofDocuments}
                              onAdd={(file) => setOnStationFdaDispatchProofDocuments([...onStationFdaDispatchProofDocuments, file])}
                              onRemove={(index) => setOnStationFdaDispatchProofDocuments(onStationFdaDispatchProofDocuments.filter((_, i) => i !== index))}
                              cardColor={accentColor}
                              disabled={isDisabled}
                              type="ON STATION"
                            />
                          </FormField>

                          {/* Copy of Sales order Section */}
                          <h3 className="appointment-details-title">Copy of Sales order</h3>
                          <FormField>
                            <DocumentUpload
                              attachments={onStationCopyOfSalesOrderDocuments}
                              onAdd={(file) => setOnStationCopyOfSalesOrderDocuments([...onStationCopyOfSalesOrderDocuments, file])}
                              onRemove={(index) => setOnStationCopyOfSalesOrderDocuments(onStationCopyOfSalesOrderDocuments.filter((_, i) => i !== index))}
                              cardColor={accentColor}
                              disabled={isDisabled}
                              type="ON STATION"
                            />
                          </FormField>
                        </div>
                      </>
                    ) : (
                      <div className="appointment-details-list-wrapper">
                        {/* APPOINTMENT DETAILS Section */}
                        <h3 className="appointment-details-title">APPOINTMENT DETAILS</h3>
                        <div className="appointment-details-list">
                          <div className="appointment-detail-item appointment-detail-file">
                            <div className="appointment-detail-file-icon">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path
                                  d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
                                  stroke="#3e5cb6"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  fill="#3e5cb6"
                                  fillOpacity="0.1"
                                />
                                <path
                                  d="M14 2V8H20"
                                  stroke="#3e5cb6"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </div>
                            <div className="appointment-detail-file-info">
                              <span className="appointment-detail-label">appointment_document.pdf</span>
                              <span className="appointment-detail-file-size">1000.0 KB</span>
                            </div>
                          </div>
                        </div>

                        {/* Launch Hire Details Section */}
                        <h3 className="appointment-details-title">LAUNCH HIRE DETAILS</h3>
                        <div className="appointment-details-list">
                          <div className="appointment-detail-item appointment-detail-file">
                            <div className="appointment-detail-file-icon">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path
                                  d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
                                  stroke="#3e5cb6"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  fill="#3e5cb6"
                                  fillOpacity="0.1"
                                />
                                <path
                                  d="M14 2V8H20"
                                  stroke="#3e5cb6"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </div>
                            <div className="appointment-detail-file-info">
                              <span className="appointment-detail-label">Launch Hire Slips.pdf</span>
                              <span className="appointment-detail-file-size">1000.0 KB</span>
                            </div>
                          </div>
                        </div>

                        {/* Sailing Clearance Copy Section */}
                        <h3 className="appointment-details-title">SAILING CLEARANCE COPY</h3>
                        <div className="appointment-details-list">
                          <div className="appointment-detail-item appointment-detail-file">
                            <div className="appointment-detail-file-icon">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path
                                  d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
                                  stroke="#3e5cb6"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  fill="#3e5cb6"
                                  fillOpacity="0.1"
                                />
                                <path
                                  d="M14 2V8H20"
                                  stroke="#3e5cb6"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </div>
                            <div className="appointment-detail-file-info">
                              <span className="appointment-detail-label">Sailing Clearance Copy.pdf</span>
                              <span className="appointment-detail-file-size">1000.0 KB</span>
                            </div>
                          </div>
                        </div>

                        {/* Inward Clearance Copy Section */}
                        <h3 className="appointment-details-title">INWARD CLEARANCE COPY</h3>
                        <div className="appointment-details-list">
                          <div className="appointment-detail-item appointment-detail-file">
                            <div className="appointment-detail-file-icon">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path
                                  d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
                                  stroke="#3e5cb6"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  fill="#3e5cb6"
                                  fillOpacity="0.1"
                                />
                                <path
                                  d="M14 2V8H20"
                                  stroke="#3e5cb6"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </div>
                            <div className="appointment-detail-file-info">
                              <span className="appointment-detail-label">Inward Clearance Copy.pdf</span>
                              <span className="appointment-detail-file-size">1000.0 KB</span>
                            </div>
                          </div>
                        </div>

                        {/* Supporting Documents Section */}
                        <h3 className="appointment-details-title">SUPPORTING DOCUMENTS</h3>
                        <div className="appointment-details-list">
                          <div className="appointment-detail-item appointment-detail-file">
                            <div className="appointment-detail-file-icon">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path
                                  d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
                                  stroke="#3e5cb6"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  fill="#3e5cb6"
                                  fillOpacity="0.1"
                                />
                                <path
                                  d="M14 2V8H20"
                                  stroke="#3e5cb6"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </div>
                            <div className="appointment-detail-file-info">
                              <span className="appointment-detail-label">Supporting Documents.pdf</span>
                              <span className="appointment-detail-file-size">1000.0 KB</span>
                            </div>
                          </div>
                        </div>

                        {/* FDA Dispatch Proof Section */}
                        <h3 className="appointment-details-title">FDA DISPATCH PROOF</h3>
                        <div className="appointment-details-list">
                          <div className="appointment-detail-item appointment-detail-file">
                            <div className="appointment-detail-file-icon">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path
                                  d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
                                  stroke="#3e5cb6"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  fill="#3e5cb6"
                                  fillOpacity="0.1"
                                />
                                <path
                                  d="M14 2V8H20"
                                  stroke="#3e5cb6"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </div>
                            <div className="appointment-detail-file-info">
                              <span className="appointment-detail-label">FDA Dispatch Proof.pdf</span>
                              <span className="appointment-detail-file-size">1000.0 KB</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="daily-task-box-wrapper">
                    <DailyTaskTodo
                      tasks={formValues?.dailyTasks || card?.dailyTasks}
                      onChange={handleChange("dailyTasks")}
                      accentColor={accentColor}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

General.propTypes = {
  card: PropTypes.object,
  formValues: PropTypes.object,
  handleChange: PropTypes.func,
  onSave: PropTypes.func,
  isAddMode: PropTypes.bool,
  isSimplifiedMode: PropTypes.bool,
};

export default General;

