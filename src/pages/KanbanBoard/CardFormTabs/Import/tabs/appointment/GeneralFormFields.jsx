import PropTypes from "prop-types";
import { useMemo, useRef, useState, useEffect, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { FiEye } from "react-icons/fi";
import SearchableSelect, { deriveSearchPlaceholder } from "../../../../../../components/form/SearchableSelect";

const openAppointmentEmail = (url) => {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
};

const AppointmentEmailFileActions = ({ fileUrl }) => {
  const urlMissing = !fileUrl || !String(fileUrl).trim();
  const unavailableTitle = "File URL not available";

  return (
    <div className="appointment-email-file-actions">
      <button
        type="button"
        className="appointment-email-file-action-btn"
        title={urlMissing ? unavailableTitle : "View appointment email"}
        disabled={urlMissing}
        onClick={(e) => {
          e.stopPropagation();
          openAppointmentEmail(fileUrl);
        }}
        aria-label="View appointment email"
      >
        <FiEye size={16} strokeWidth={2.2} aria-hidden />
      </button>
      {/* <button
        type="button"
        className="appointment-email-file-action-btn appointment-email-file-action-btn--download"
        title={urlMissing ? unavailableTitle : "Download appointment email"}
        disabled={urlMissing}
        onClick={(e) => {
          e.stopPropagation();
          downloadAppointmentEmail(fileUrl, fileName);
        }}
        aria-label="Download appointment email"
      >
        <FiDownload size={16} strokeWidth={2.2} aria-hidden />
      </button> */}
    </div>
  );
};

AppointmentEmailFileActions.propTypes = {
  fileUrl: PropTypes.string,
  fileName: PropTypes.string,
};

// Form Components
const FormField = ({ label, children, className = "", hasError = false }) => {
  return (
    <div className={`cf-field ${hasError ? "has-error" : ""} ${className}`}>
      {label && (
        <label>
          {label.endsWith(" *") ? (
            <>
              {label.slice(0, -2)} <span className="cf-required">*</span>
            </>
          ) : (
            label
          )}
        </label>
      )}
      {children}
    </div>
  );
};

FormField.propTypes = {
  label: PropTypes.string,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  hasError: PropTypes.bool,
};

const FormInput = ({ type = "text", value, onChange, placeholder, className = "", readOnly = false, disabled = false, hasError = false }) => {
  return (
    <div className={`cf-input ${hasError ? "is-invalid" : ""} ${className}`}>
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
  hasError: PropTypes.bool,
};

const FormSelect = ({
  value,
  onChange,
  options = [],
  placeholder,
  searchPlaceholder,
  className = "",
  disabled = false,
  hasError = false,
  menuClassName = "",
  menuPortalTarget = null,
  menuPosition = "absolute",
}) => {
  const normalizedValue = value === undefined || value === null ? "" : String(value);
  return (
    <SearchableSelect
      value={normalizedValue}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      className={className}
      disabled={disabled}
      hasError={hasError}
      menuClassName={menuClassName}
      menuPortalTarget={menuPortalTarget}
      menuPosition={menuPosition}
    />
  );
};

FormSelect.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired,
    })
  ),
  placeholder: PropTypes.string,
  searchPlaceholder: PropTypes.string,
  className: PropTypes.string,
  disabled: PropTypes.bool,
  hasError: PropTypes.bool,
  menuClassName: PropTypes.string,
  menuPortalTarget: PropTypes.any,
  menuPosition: PropTypes.oneOf(["absolute", "fixed"]),
};

const UserOptionAvatar = ({ avatarUrl, label, className = "" }) => {
  const letterSource = label != null ? String(label).trim() : "";
  const displayLetter = letterSource ? letterSource.charAt(0).toUpperCase() : "U";
  const src = avatarUrl != null && String(avatarUrl).trim();
  const [imgFailed, setImgFailed] = useState(false);

  if (src && !imgFailed) {
    return (
      <div className={`cf-owner-avatar cf-owner-avatar--img ${className}`.trim()}>
        <img src={src} alt="" onError={() => setImgFailed(true)} />
      </div>
    );
  }
  return <div className={`cf-owner-avatar ${className}`.trim()}>{displayLetter}</div>;
};

UserOptionAvatar.propTypes = {
  avatarUrl: PropTypes.string,
  label: PropTypes.string,
  className: PropTypes.string,
};

const OwnerField = ({
  label = "Owner",
  value,
  onChange,
  options = [],
  placeholder = "Select owner",
  disabled = false,
  error,
  hasError = false,
}) => {
  const selected = options.find((opt) => String(opt.value) === String(value ?? ""));
  const showErr = hasError || Boolean(error);
  const renderOption = (option) => (
    <div className="cf-searchable-option-with-avatar">
      <UserOptionAvatar avatarUrl={option.avatar} label={option.label} className="cf-owner-avatar--sm" />
      <span>{option.label}</span>
    </div>
  );
  return (
    <FormField label={label} hasError={showErr}>
      <div className={`cf-owner-row ${showErr ? "is-invalid" : ""}`}>
        <UserOptionAvatar avatarUrl={selected?.avatar} label={selected?.label} />
        <SearchableSelect
          value={value === undefined || value === null ? "" : String(value)}
          onChange={onChange}
          options={options}
          placeholder={placeholder}
          searchPlaceholder={deriveSearchPlaceholder(placeholder)}
          disabled={disabled}
          hasError={showErr}
          className="cf-owner-searchable-select"
          renderOption={renderOption}
        />
      </div>
      {error ? <div className="cf-field-error">{error}</div> : null}
    </FormField>
  );
};

OwnerField.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      avatar: PropTypes.string,
    })
  ),
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  error: PropTypes.string,
  hasError: PropTypes.bool,
};

// Document Upload Component
const DocumentUpload = ({
  attachments = [],
  onAdd,
  onRemove,
  disabled = false,
  type = "",
  hasError = false,
  allowMultiple = true,
  onMultipleFiles,
  isLoading = false,
  loadingText = "Uploading...",
  fileUrl = "",
  showFileActions = false,
}) => {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const zoneDisabled = disabled || isLoading;

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (zoneDisabled) return;
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

    if (zoneDisabled) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && onAdd) {
      if (!allowMultiple) {
        if (files.length > 1 && onMultipleFiles) onMultipleFiles(files);
        onAdd(files[0]);
        return;
      }
      files.forEach(file => onAdd(file));
    }
  };

  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0 && onAdd) {
      if (!allowMultiple) {
        if (files.length > 1 && onMultipleFiles) onMultipleFiles(files);
        onAdd(files[0]);
      } else {
        files.forEach(file => onAdd(file));
      }
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
          {attachments.map((file, index) => {
            const displayName = file.name || file;
            return (
              <div key={index} className="appointment-email-file-row document-file-display-item">
                <div className="appointment-email-file-left">
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
                  <span className="appointment-email-file-name document-file-name">{displayName}</span>
                </div>
                {showFileActions && (
                  <AppointmentEmailFileActions fileUrl={fileUrl} fileName={displayName} />
                )}
              </div>
            );
          })}
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
        className={`document-upload-zone ${type ? `upload-type-${type.toLowerCase().replace(/\s+/g, '-')}` : ""} ${isDragging ? "dragging" : ""} ${hasError ? "has-error" : ""} ${isLoading ? "is-loading" : ""}`}
        onDragEnter={zoneDisabled ? undefined : handleDragEnter}
        onDragOver={zoneDisabled ? undefined : handleDragOver}
        onDragLeave={zoneDisabled ? undefined : handleDragLeave}
        onDrop={zoneDisabled ? undefined : handleDrop}
        onClick={zoneDisabled ? undefined : () => fileInputRef.current?.click()}
        style={{ "--card-color": "#3e5cb6" || "#2A00FF", pointerEvents: zoneDisabled ? "none" : "auto", opacity: zoneDisabled ? 0.6 : 1 }}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="file-input-hidden"
          multiple={allowMultiple}
          onChange={handleFileInputChange}
          disabled={zoneDisabled}
        />
        <div className="upload-zone-content">
          {isLoading ? (
            <div className="document-upload-loading-state">
              <span className="document-upload-spinner" aria-hidden="true" />
              <p className="upload-main-text">{loadingText}</p>
            </div>
          ) : (
            <>
              <div className="upload-text-content">
                <p className="upload-main-text">
                  Drag and drop your files here, or{" "}
                  <span className="upload-link">click to browse</span>
                </p>
                {/* <p className="upload-sub-text">Supports all file formats</p> */}
              </div>
            </>
          )}
        </div>
      </div>

      {/* File Preview List - Shows below upload zone */}
      {attachments.length > 0 && (
        <div className="document-file-preview-list">
          {attachments.map((file, index) => {
            const displayName = file.name || file;
            return (
              <div
                key={index}
                className={`document-file-preview-item ${showFileActions ? "appointment-email-file-row appointment-email-file-row--preview" : ""}`}
              >
                {showFileActions ? (
                  <div className="appointment-email-file-left">
                    <div className="document-file-preview-icon">
                      {getFileIcon(displayName)}
                    </div>
                    <span className="appointment-email-file-name document-file-preview-name">{displayName}</span>
                  </div>
                ) : (
                  <>
                    <div className="document-file-preview-icon">
                      {getFileIcon(displayName)}
                    </div>
                    <div className="document-file-preview-info">
                      <span className="document-file-preview-name">{displayName}</span>
                      <span className="document-file-preview-size">{formatFileSize(file.size)}</span>
                    </div>
                  </>
                )}
                {showFileActions && (
                  <AppointmentEmailFileActions fileUrl={fileUrl} fileName={displayName} />
                )}
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
            );
          })}
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
  hasError: PropTypes.bool,
  allowMultiple: PropTypes.bool,
  onMultipleFiles: PropTypes.func,
  isLoading: PropTypes.bool,
  loadingText: PropTypes.string,
  fileUrl: PropTypes.string,
  showFileActions: PropTypes.bool,
};

// Multi-Select Email Component
const MultiSelectEmail = ({ value = [], onChange, options = [], placeholder, onAddNew, disabled = false, name = "dailyReportEmail", hasError = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [showAddInput, setShowAddInput] = useState(false);
  const [isAddingNewEmail, setIsAddingNewEmail] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const menuPortalRef = useRef(null);
  const [portalMenuBox, setPortalMenuBox] = useState({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 320,
  });

  const updatePortalMenuPosition = useCallback(() => {
    if (!isOpen) return;
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 8;
    const viewportPad = 8;
    const maxMenu = 320;
    const spaceAbove = rect.top - gap - viewportPad;
    const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPad;
    const placeTop = spaceBelow < 180 && spaceAbove > spaceBelow;
    const availableSpace = placeTop ? spaceAbove : spaceBelow;
    const maxHeight = Math.min(maxMenu, Math.max(120, availableSpace));
    const top = placeTop ? Math.max(viewportPad, rect.top - gap - maxHeight) : rect.bottom + gap;

    setPortalMenuBox({
      top,
      left: rect.left,
      width: rect.width,
      maxHeight,
    });
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return undefined;
    updatePortalMenuPosition();
    const rafId = requestAnimationFrame(updatePortalMenuPosition);
    const onScrollOrResize = () => updatePortalMenuPosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [isOpen, updatePortalMenuPosition]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isAddingNewEmail) return;
      const target = event.target;
      if (dropdownRef.current?.contains(target)) return;
      if (menuPortalRef.current?.contains(target)) return;
      setIsOpen(false);
      setShowAddInput(false);
      setFilterQuery("");
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isAddingNewEmail]);

  const valuesEqual = (a, b) => String(a) === String(b);
  const valueToLabel = (val) => {
    const opt = options.find((o) => valuesEqual(o.value, val));
    return opt?.label ?? String(val);
  };

  useEffect(() => {
    if (!isOpen) setFilterQuery("");
  }, [isOpen]);

  const filterPlaceholder = useMemo(() => deriveSearchPlaceholder(placeholder), [placeholder]);

  const filteredOptions = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => String(o.label).toLowerCase().includes(q));
  }, [options, filterQuery]);

  const selectedValues = Array.isArray(value) ? value : (value ? [value] : []);

  const pushSelectedValue = (optionValue) => {
    if (selectedValues.some((v) => valuesEqual(v, optionValue))) return;
    const syntheticEvent = {
      target: { value: [...selectedValues, optionValue], name }
    };
    onChange(syntheticEvent);
  };

  const handleToggle = (optionValue) => {
    const newValue = selectedValues.some((v) => valuesEqual(v, optionValue))
      ? selectedValues.filter((e) => !valuesEqual(e, optionValue))
      : [...selectedValues, optionValue];

    const syntheticEvent = {
      target: { value: newValue, name }
    };
    onChange(syntheticEvent);
  };

  const handleAddNewEmail = async () => {
    const email = newEmail.trim();
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!email || !isValid || isAddingNewEmail) return;

    const selectedAlready = selectedValues.some((entry) => String(entry).trim().toLowerCase() === email.toLowerCase());
    if (selectedAlready) {
      setNewEmail("");
      setShowAddInput(false);
      return;
    }

    const existingOption = options.find((opt) => {
      const label = String(opt?.label ?? "").trim().toLowerCase();
      const rawValue = String(opt?.value ?? "").trim().toLowerCase();
      return label === email.toLowerCase() || rawValue === email.toLowerCase();
    });

    if (existingOption) {
      pushSelectedValue(existingOption.value);
      setNewEmail("");
      setShowAddInput(false);
      return;
    }

    try {
      setIsAddingNewEmail(true);
      pushSelectedValue(email);
      if (onAddNew) {
        await Promise.resolve(onAddNew(email));
      }
      setNewEmail("");
      setShowAddInput(false);
      setIsOpen(true);
    } finally {
      setIsAddingNewEmail(false);
    }
  };

  const handleRemoveEmail = (rawVal, e) => {
    e.stopPropagation();
    const newValue = selectedValues.filter((entry) => !valuesEqual(entry, rawVal));
    const syntheticEvent = {
      target: { value: newValue, name }
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

  const dropdownPanel = (
    <div
      ref={menuPortalRef}
      className="cf-multi-select-dropdown cf-multi-select-dropdown--filterable cf-multi-select-dropdown--portal cf-searchable-select__menu-portal"
      style={{
        position: "fixed",
        top: portalMenuBox.top,
        left: portalMenuBox.left,
        width: portalMenuBox.width,
        maxWidth: portalMenuBox.width,
        minWidth: 0,
        right: "auto",
        margin: 0,
        maxHeight: portalMenuBox.maxHeight,
        zIndex: 13000,
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <div className="cf-multi-select-filter" onClick={(e) => e.stopPropagation()}>
        <input
          type="text"
          className="cf-multi-select-filter-input"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder={filterPlaceholder}
          autoComplete="off"
        />
      </div>
      <div className="cf-multi-select-results">
        <div className="cf-multi-select-options-scroll">
          {filteredOptions.length === 0 ? (
            <div className="cf-multi-select-no-results">No results found</div>
          ) : (
            filteredOptions.map((option) => {
              const isSelected = selectedValues.some((v) => valuesEqual(v, option.value));
              return (
                <div
                  key={String(option.value)}
                  className={`cf-multi-select-option ${isSelected ? "selected" : ""}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleToggle(option.value);
                  }}
                >
                  <span className="cf-multi-select-checkbox">
                    {isSelected && "✓"}
                  </span>
                  <span>{option.label}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
      <div className="cf-multi-select-footer" onMouseDown={(e) => e.stopPropagation()}>
        {!showAddInput ? (
          <div
            className="cf-multi-select-option add-new"
            onMouseDown={(e) => {
              e.preventDefault();
              setShowAddInput(true);
              setNewEmail("");
            }}
          >
            <span>+ Add New Email</span>
          </div>
        ) : (
          <div className="cf-multi-select-add-input" onMouseDown={(e) => e.stopPropagation()}>
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
              disabled={isAddingNewEmail || !newEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())}
            >
              {isAddingNewEmail ? "..." : "✓"}
            </button>
            <button
              type="button"
              className="cf-cancel-email-btn"
              disabled={isAddingNewEmail}
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
    </div>
  );

  return (
    <div className={`cf-multi-select-email ${disabled ? "disabled" : ""} ${hasError ? "has-error" : ""}`} ref={dropdownRef}>
      <div
        ref={triggerRef}
        className={`cf-multi-select-email-input ${disabled ? "disabled" : ""} ${hasError ? "has-error" : ""}`}
        onClick={disabled ? undefined : () => setIsOpen(!isOpen)}
        style={{ pointerEvents: disabled ? "none" : "auto" }}
      >
        <div className="cf-multi-select-email-tags">
          {selectedValues.length > 0 ? (
            selectedValues.map((entryVal) => (
              <span key={String(entryVal)} className="cf-email-tag">
                {valueToLabel(entryVal)}
                {!disabled && (
                  <button
                    type="button"
                    className="cf-email-tag-remove"
                    onClick={(e) => handleRemoveEmail(entryVal, e)}
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
      {isOpen && typeof document !== "undefined" && createPortal(dropdownPanel, document.body)}
    </div>
  );
};

MultiSelectEmail.propTypes = {
  value: PropTypes.oneOfType([PropTypes.array, PropTypes.string]),
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired,
    })
  ),
  placeholder: PropTypes.string,
  onAddNew: PropTypes.func,
  disabled: PropTypes.bool,
  name: PropTypes.string,
  hasError: PropTypes.bool,
};

// Generic multi-select with checkbox options and a search filter (no add-new footer).
const MultiSelectField = ({
  value = [],
  onChange,
  options = [],
  placeholder,
  disabled = false,
  name,
  hasError = false,
  className = "",
  menuMaxHeight,
  isLoading = false,
  emptyMessage = "No options found",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current?.contains(event.target)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) setFilterQuery("");
  }, [isOpen]);

  const filterPlaceholder = useMemo(() => deriveSearchPlaceholder(placeholder), [placeholder]);

  const filteredOptions = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => String(o.label).toLowerCase().includes(q));
  }, [options, filterQuery]);

  const valuesEqual = (a, b) => String(a) === String(b);
  const selectedValues = Array.isArray(value) ? value : (value ? [value] : []);
  const valueToLabel = (val) => options.find((o) => valuesEqual(o.value, val))?.label ?? String(val);

  const handleToggle = (optionValue) => {
    const newValue = selectedValues.some((v) => valuesEqual(v, optionValue))
      ? selectedValues.filter((entry) => !valuesEqual(entry, optionValue))
      : [...selectedValues, optionValue];
    onChange({ target: { value: newValue, name } });
  };

  const handleRemove = (rawVal, e) => {
    e.stopPropagation();
    onChange({ target: { value: selectedValues.filter((entry) => !valuesEqual(entry, rawVal)), name } });
  };

  return (
    <div
      className={`cf-multi-select-email ${disabled ? "disabled" : ""} ${hasError ? "has-error" : ""} ${className}`.trim()}
      ref={dropdownRef}
      style={menuMaxHeight ? { "--cf-multiselect-menu-max-height": `${menuMaxHeight}px` } : undefined}
    >
      <div
        className={`cf-multi-select-email-input ${disabled ? "disabled" : ""} ${hasError ? "has-error" : ""}`}
        onClick={disabled ? undefined : () => setIsOpen((prev) => !prev)}
      >
        <div className="cf-multi-select-email-tags">
          {selectedValues.length > 0 ? (
            selectedValues.map((entryVal) => (
              <span key={String(entryVal)} className="cf-email-tag">
                {valueToLabel(entryVal)}
                {!disabled && (
                  <button
                    type="button"
                    className="cf-email-tag-remove"
                    onClick={(e) => handleRemove(entryVal, e)}
                  >
                    ×
                  </button>
                )}
              </span>
            ))
          ) : (
            <span className="cf-multi-select-placeholder">{placeholder || "Select..."}</span>
          )}
        </div>
        <span className="cf-multi-select-arrow">▼</span>
      </div>
      {isOpen && !disabled && (
        <div className="cf-multi-select-dropdown cf-multi-select-dropdown--menu-height cf-multi-select-dropdown--filterable">
          <div className="cf-multi-select-filter" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              className="cf-multi-select-filter-input"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder={filterPlaceholder}
              autoComplete="off"
            />
          </div>
          <div className="cf-multi-select-results">
            <div className="cf-multi-select-options-scroll">
              {isLoading ? (
                <div className="cf-multi-select-no-results">Loading...</div>
              ) : filteredOptions.length === 0 ? (
                <div className="cf-multi-select-no-results">{options.length === 0 ? emptyMessage : "No results found"}</div>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = selectedValues.some((v) => valuesEqual(v, option.value));
                  return (
                    <div
                      key={String(option.value)}
                      className={`cf-multi-select-option ${isSelected ? "selected" : ""}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleToggle(option.value);
                      }}
                    >
                      <span className="cf-multi-select-checkbox">
                        {isSelected && "✓"}
                      </span>
                      <span>{option.label}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

MultiSelectField.propTypes = {
  value: PropTypes.oneOfType([PropTypes.array, PropTypes.string]),
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired,
    })
  ),
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  name: PropTypes.string,
  hasError: PropTypes.bool,
  className: PropTypes.string,
  menuMaxHeight: PropTypes.number,
  isLoading: PropTypes.bool,
  emptyMessage: PropTypes.string,
};

export { FormField, FormInput, FormSelect, OwnerField, DocumentUpload, MultiSelectEmail, MultiSelectField };
