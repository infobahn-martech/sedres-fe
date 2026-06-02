import PropTypes from "prop-types";
import { useState, useEffect, useRef, forwardRef } from "react";
import DatePicker from "react-datepicker";
import { format, parse, isValid } from "date-fns";
import "react-datepicker/dist/react-datepicker.css";
import { FormTextarea } from "./checklistFormPrimitives";
import { getBackendFileSessionRemovalKey } from "./checklistMappers";

const formatDisplayDate = (value) => {
  if (!value) return "--/--/----";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

/** Backend-only preview URL (never local upload). */
const getBackendFilePreviewUrl = (file) => {
  if (!file || typeof file !== "object") return null;
  return (
    file.file_url ??
    file.sample_file_url ??
    file.requirement_file_url ??
    file.url ??
    file.link ??
    null
  );
};

const getItemRootBackendPreviewUrl = (rowItem) =>
  rowItem?.file_url ??
  rowItem?.sample_file_url ??
  rowItem?.requirement_file_url ??
  null;

const CalendarMetaIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <path d="M4 10H20" stroke="currentColor" strokeWidth="1.8" />
    <path d="M8 3V7M16 3V7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M9 14H15M9 17H13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

/** Stored / payload format: YYYY-MM-DD */
const parseExpiryYmdToDate = (ymd) => {
  if (!ymd || String(ymd).trim() === "") return null;
  const parsed = parse(String(ymd).trim().slice(0, 10), "yyyy-MM-dd", new Date());
  return isValid(parsed) ? parsed : null;
};

const ExpiryChipCustomInput = forwardRef(({ value, onClick, disabled }, ref) => {
  const inner = value && String(value).trim() !== "" ? String(value) : "--/--/----";
  const ariaLabel = inner === "--/--/----" ? "Expiry date, not set" : `Expiry date, ${inner}`;
  return (
    <div
      ref={ref}
      className="cl-item-meta-chip cl-item-meta-chip--expiry cl-item-meta-chip--clickable"
      onClick={onClick}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(e);
        }
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-haspopup="dialog"
      aria-label={ariaLabel}
      aria-disabled={disabled ? true : undefined}
    >
      <span className="cl-expiry-chip-visible">
        <span className="cl-meta-icon cl-meta-icon--svg" aria-hidden>
          <CalendarMetaIcon />
        </span>
        <span className="cl-expiry-chip-label">Exp: {inner}</span>
      </span>
    </div>
  );
});
ExpiryChipCustomInput.displayName = "ExpiryChipCustomInput";

const getRequirementMetaLabel = ({ requireCopyOnlyFromApi, requirement }) => {
  if (requireCopyOnlyFromApi) return "Req Copy";
  if (!requirement?.label) return "";

  const label = String(requirement.label).trim();
  if (!label) return "";
  if (/copy/i.test(label)) return "Req Copy";
  if (/original/i.test(label)) return "Req Original";
  return label;
};

const createLocalChecklistFileEntry = (file, uniqueKey) => ({
  id: `local_${uniqueKey}_${file.name}`,
  name: file.name,
  fileName: file.name,
  url: null,
  link: null,
  file_url: null,
  file,
  fromApi: false,
  isNew: true,
});

const truncateMiddle = (text, maxLen = 22) => {
  const s = String(text || "");
  if (s.length <= maxLen) return s;
  const half = Math.floor((maxLen - 2) / 2);
  return `${s.slice(0, half)}…${s.slice(-half)}`;
};

const MAX_INLINE_FILE_CHIPS = 2;

function displayNameForEntry(entry) {
  return entry instanceof File
    ? entry.name
    : entry?.name || entry?.fileName || entry?.file?.name || "File";
}

const fileEntryKey = (entry, idx) =>
  entry?.id != null ? String(entry.id) : `idx_${idx}_${displayNameForEntry(entry)}`;

const normalizeChecklistFilename = (value) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

const getNormalizedChecklistFileName = (entry) => {
  if (!entry) return "";
  const rawName =
    entry instanceof File
      ? entry.name
      : entry?.name ?? entry?.fileName ?? entry?.file?.name ?? "";
  return normalizeChecklistFilename(rawName);
};

/** Match checklist-by-id requirement/reference files so they are not shown in upload column. */
const buildReferenceFileLookup = (referenceFiles) => {
  const ids = new Set();
  const fileIds = new Set();
  const names = new Set();
  (Array.isArray(referenceFiles) ? referenceFiles : []).forEach((ref) => {
    if (ref?.id != null && String(ref.id).trim() !== "") ids.add(String(ref.id));
    if (ref?.file_id != null && String(ref.file_id).trim() !== "") fileIds.add(String(ref.file_id));
    const normalizedName = getNormalizedChecklistFileName(ref);
    if (normalizedName) names.add(normalizedName);
  });
  return { ids, fileIds, names };
};

const isReferenceFileEntry = (entry, lookup) => {
  if (!entry || !lookup) return false;
  if (entry?.file instanceof File || entry instanceof File) return false;
  const entryId = entry?.id != null ? String(entry.id) : "";
  const entryFileId = entry?.file_id != null ? String(entry.file_id) : "";
  if (entryId && lookup.ids.has(entryId)) return true;
  if (entryFileId && lookup.fileIds.has(entryFileId)) return true;
  const normalizedName = getNormalizedChecklistFileName(entry);
  if (normalizedName && lookup.names.has(normalizedName) && entry?.fromApi === true) return true;
  return false;
};

const filterUploadColumnFiles = (uploadedFiles, referenceFiles) => {
  const lookup = buildReferenceFileLookup(referenceFiles);
  return (Array.isArray(uploadedFiles) ? uploadedFiles : []).filter(
    (entry) => !isReferenceFileEntry(entry, lookup)
  );
};

const DocIcon = ({ size = 12 }) => (
  <span className="checklist-file-chip__ico" aria-hidden>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M14 3H7C5.9 3 5 3.9 5 5V19C5 20.1 5.9 21 7 21H17C18.1 21 19 20.1 19 19V8L14 3Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 3V8H19" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  </span>
);

DocIcon.propTypes = {
  size: PropTypes.number,
};

const ChecklistItemRow = ({
  item,
  itemData,
  onChange,
  cardColor = "#2A00FF",
  isViewOnly = false,
}) => {
  const {
    id,
    title,
    expiryDateRequired,
    uploadedFromApi = [],
    requirement,
    requireCopyOnlyFromApi,
    roleNames = [],
  } = item;
  const displayRoleNames = Array.isArray(roleNames) ? roleNames.filter(Boolean) : [];

  const [remarks, setRemarks] = useState(itemData?.remarks || "");
  const [uploadedFiles, setUploadedFiles] = useState(() =>
    Array.isArray(itemData?.uploadedFiles) ? itemData.uploadedFiles : []
  );
  const fileInputRef = useRef(null);
  const uploadFilesRef = useRef(null);
  const [moreUploadFilesOpen, setMoreUploadFilesOpen] = useState(false);

  const checked = itemData?.checked === true;
  const rowFiles = Array.isArray(uploadedFiles) ? uploadedFiles : [];
  const referenceFiles = Array.isArray(uploadedFromApi) ? uploadedFromApi : [];
  const uploadColumnFiles = filterUploadColumnFiles(rowFiles, referenceFiles);
  const itemRootBackendUrl = getItemRootBackendPreviewUrl(item);
  const urlFromList = (list) => {
    const arr = Array.isArray(list) ? list : [];
    for (const entry of arr) {
      const u = getBackendFilePreviewUrl(entry);
      if (u) return u;
    }
    return null;
  };
  const referencePreviewUrl = itemRootBackendUrl || urlFromList(referenceFiles);
  const requirementMetaLabel = getRequirementMetaLabel({ requireCopyOnlyFromApi, requirement });

  const uploadedFilesSyncKey = Array.isArray(itemData?.uploadedFiles)
    ? itemData.uploadedFiles.map((f) => `${f?.id ?? ""}:${f?.name ?? f?.fileName ?? ""}:${f?.file instanceof File ? "blob" : ""}`).join("|")
    : "";

  useEffect(() => {
    setRemarks(itemData?.remarks || "");
    setUploadedFiles(Array.isArray(itemData?.uploadedFiles) ? itemData.uploadedFiles : []);
  }, [itemData?.remarks, uploadedFilesSyncKey]);

  useEffect(() => {
    if (!moreUploadFilesOpen) return;
    const onDocMouseDown = (e) => {
      if (uploadFilesRef.current && !uploadFilesRef.current.contains(e.target)) {
        setMoreUploadFilesOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setMoreUploadFilesOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [moreUploadFilesOpen]);

  useEffect(() => {
    setMoreUploadFilesOpen(false);
  }, [uploadedFilesSyncKey]);

  const pushChange = (patch) => {
    const filesNext = patch.uploadedFiles !== undefined ? patch.uploadedFiles : uploadedFiles;
    const apiFilesNext = patch.apiUploadedFiles !== undefined ? patch.apiUploadedFiles : filesNext;
    const removedNext =
      patch.removedFiles !== undefined ? patch.removedFiles : itemData.removedFiles ?? [];
    onChange(id, {
      ...itemData,
      ...patch,
      remarks: patch.remarks !== undefined ? patch.remarks : remarks,
      uploadedFiles: filesNext,
      apiUploadedFiles: apiFilesNext,
      removedFiles: removedNext,
    });
  };

  const handleCheckedChange = (e) => {
    const next = e.target.checked;
    pushChange({ checked: next });
  };

  const handleFileChange = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    if (!picked.length) return;
    const batchKey = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const additions = picked.map((file, i) => createLocalChecklistFileEntry(file, `${batchKey}_${i}`));
    const next = [...uploadedFiles, ...additions];
    setUploadedFiles(next);
    pushChange({ uploadedFiles: next, checked: true });
  };

  const handleRemoveFileEntry = (entry) => {
    const isBackendRow =
      entry?.fromApi === true && !(entry instanceof File) && !(entry?.file instanceof File);
    const entryId = entry?.id;
    const entryFileId = entry?.file_id;
    const next = rowFiles.filter((f) => {
      const sameId = entryId != null && (f?.id ?? null) === entryId;
      const sameFileId = entryFileId != null && (f?.file_id ?? null) === entryFileId;
      return !(sameId || sameFileId);
    });
    const currentApiFiles = Array.isArray(itemData?.apiUploadedFiles) ? itemData.apiUploadedFiles : [];
    const nextApiFiles = currentApiFiles.filter((f) => {
      const sameId = entryId != null && (f?.id ?? null) === entryId;
      const sameFileId = entryFileId != null && (f?.file_id ?? null) === entryFileId;
      return !(sameId || sameFileId);
    });
    let removedNext = Array.isArray(itemData?.removedFiles) ? [...itemData.removedFiles] : [];
    if (isBackendRow) {
      // TODO: Backend delete API required for permanent deletion; GET still returns these files until then (session hide only).
      const key = getBackendFileSessionRemovalKey(entry);
      if (key && !removedNext.includes(key)) removedNext.push(key);
    }
    setUploadedFiles(next);
    pushChange({ uploadedFiles: next, apiUploadedFiles: nextApiFiles, removedFiles: removedNext });
  };

  const handleBrowseClick = () => fileInputRef.current?.click();

  const handleRemarksChange = (e) => {
    const newRemarks = e.target.value;
    setRemarks(newRemarks);
    pushChange({ remarks: newRemarks });
  };

  const handlePreviewOneFile = (e, entry) => {
    e.preventDefault();
    e.stopPropagation();
    const rawFile = entry instanceof File ? entry : entry?.file;
    if (rawFile instanceof File) {
      const objectUrl = URL.createObjectURL(rawFile);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      return;
    }
    const url = getBackendFilePreviewUrl(entry);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const canPreviewEntry = (entry) => {
    const rawFile = entry instanceof File ? entry : entry?.file;
    if (rawFile instanceof File) return true;
    return Boolean(getBackendFilePreviewUrl(entry));
  };

  const firstPreviewableReference = referenceFiles.find((entry) => canPreviewEntry(entry));
  const canOpenReferencePreview = Boolean(firstPreviewableReference || referencePreviewUrl);
  const showMetaRow = Boolean(expiryDateRequired || requirementMetaLabel || canOpenReferencePreview);

  const handlePreviewReferenceFile = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (firstPreviewableReference) {
      handlePreviewOneFile(e, firstPreviewableReference);
      return;
    }
    if (referencePreviewUrl) {
      window.open(referencePreviewUrl, "_blank", "noopener,noreferrer");
    }
  };

  const inlineUploadFiles = uploadColumnFiles.slice(0, MAX_INLINE_FILE_CHIPS);
  const uploadOverflowCount = Math.max(0, uploadColumnFiles.length - MAX_INLINE_FILE_CHIPS);
  const uploadPopoverId = `checklist-upload-files-popover-${id}`;

  const renderFileChip = (entry, idx, { variant = "inline", allowRemove = true } = {}) => {
    const label = displayNameForEntry(entry);
    const previewOk = canPreviewEntry(entry);
    const chipClass =
      variant === "popover"
        ? "checklist-file-chip checklist-file-chip--popover"
        : "checklist-file-chip checklist-file-chip--inline";
    const nameClass =
      variant === "popover"
        ? "checklist-file-chip__name checklist-file-chip__name--popover"
        : "checklist-file-chip__name";
    const displayLabel = variant === "popover" ? truncateMiddle(label, 36) : label;

    return (
      <div key={fileEntryKey(entry, idx)} className={chipClass} title={label}>
        <DocIcon size={variant === "popover" ? 12 : 11} />
        <span className={nameClass}>{displayLabel}</span>
        <button
          type="button"
          className="checklist-file-chip__btn checklist-file-chip__btn--view"
          disabled={!previewOk}
          onClick={(e) => handlePreviewOneFile(e, entry)}
          title={previewOk ? "Preview" : "No preview available"}
          aria-label={`Preview ${label}`}
        >
          <svg
            width={variant === "popover" ? 14 : 12}
            height={variant === "popover" ? 14 : 12}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <path
              d="M2 12C3.8 8.5 7.3 6 12 6C16.7 6 20.2 8.5 22 12C20.2 15.5 16.7 18 12 18C7.3 18 3.8 15.5 2 12Z"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
        {!isViewOnly && allowRemove ? (
          <button
            type="button"
            className="checklist-file-chip__btn checklist-file-chip__btn--remove"
            onClick={() => handleRemoveFileEntry(entry)}
            title="Remove from list"
            aria-label={`Remove ${label}`}
          >
            ×
          </button>
        ) : null}
      </div>
    );
  };

  const renderFileChipList = ({
    files,
    inlineSlice,
    overflowCount,
    popoverId,
    moreOpen,
    setMoreOpen,
    wrapRef,
    wrapClassName,
    rowClassName,
    popoverLabel,
    allowRemove,
  }) => {
    if (!files.length) return null;

    return (
      <div ref={wrapRef} className={wrapClassName}>
        <div className={rowClassName} aria-live="polite">
          {inlineSlice.map((entry, idx) =>
            renderFileChip(entry, idx, { allowRemove })
          )}
          {overflowCount > 0 ? (
            <button
              type="button"
              className="checklist-more-files-chip"
              aria-expanded={moreOpen}
              aria-controls={popoverId}
              onClick={() => setMoreOpen((o) => !o)}
            >
              +{overflowCount} more
            </button>
          ) : null}
        </div>
        {moreOpen && files.length > MAX_INLINE_FILE_CHIPS ? (
          <div id={popoverId} className="checklist-files-popover" role="dialog" aria-label={popoverLabel}>
            <ul className="checklist-files-popover__list">
              {files.map((entry, idx) => (
                <li key={fileEntryKey(entry, idx)} className="checklist-files-popover__item">
                  {renderFileChip(entry, idx, { variant: "popover", allowRemove })}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  };

  const renderUploadColumnFilesPreview = () =>
    renderFileChipList({
      files: uploadColumnFiles,
      inlineSlice: inlineUploadFiles,
      overflowCount: uploadOverflowCount,
      popoverId: uploadPopoverId,
      moreOpen: moreUploadFilesOpen,
      setMoreOpen: setMoreUploadFilesOpen,
      wrapRef: uploadFilesRef,
      wrapClassName: "cl-upload-files-wrap",
      rowClassName: "checklist-file-chip-row checklist-file-chip-row--upload",
      popoverLabel: "All uploaded files",
      allowRemove: true,
    });

  return (
    <tr className={`checklist-table-row cl-item-row ${checked ? "checked" : ""}`} style={{ "--card-color": cardColor }}>
      <td className="checklist-table-checkbox">
        <label className="checklist-checkbox-wrapper checklist-checkbox-wrapper--table">
          <input
            type="checkbox"
            checked={checked}
            onChange={handleCheckedChange}
            disabled={isViewOnly}
            className="checklist-checkbox"
            aria-label="Mark checklist item done"
          />
          <span className="checklist-checkbox-custom checklist-checkbox-custom--table">
            {checked ? <span className="checkmark">✓</span> : null}
          </span>
        </label>
      </td>
      <td className="checklist-table-label cl-col-item cl-item-cell">
        <div className="cl-item-content">
          <div className="cl-item-title-row">
            <div className="cl-item-title cl-item-title--primary" title={title}>{title}</div>
          </div>
          {showMetaRow ? (
            <div className="cl-item-meta-row cl-item-meta-row--inline">
              {expiryDateRequired ? (
                isViewOnly ? (
                  <span className="cl-item-meta-chip cl-item-meta-chip--expiry">
                    <span className="cl-meta-icon cl-meta-icon--svg" aria-hidden>
                      <CalendarMetaIcon />
                    </span>
                    <span>Exp: {formatDisplayDate(itemData?.expiryDate || "")}</span>
                  </span>
                ) : (
                  <DatePicker
                    wrapperClassName="cl-datepicker-wrapper"
                    selected={parseExpiryYmdToDate(itemData?.expiryDate)}
                    onChange={(date) => {
                      pushChange({ expiryDate: date ? format(date, "yyyy-MM-dd") : "" });
                    }}
                    dateFormat="dd/MM/yyyy"
                    customInput={<ExpiryChipCustomInput />}
                    disabled={isViewOnly}
                    popperClassName="cl-datepicker-popper"
                    calendarClassName="cl-datepicker-calendar"
                    popperPlacement="bottom-start"
                    showPopperArrow={false}
                    shouldCloseOnSelect={true}
                    strictParsing
                  />
                )
              ) : null}
              {expiryDateRequired && requirementMetaLabel ? <span className="cl-item-meta-sep" aria-hidden>|</span> : null}
              {requirementMetaLabel ? (
                <span className="cl-item-meta-chip" title={requirementMetaLabel}>
                  <span className="cl-item-meta-icon" aria-hidden>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M14 3H7C5.9 3 5 3.9 5 5V19C5 20.1 5.9 21 7 21H17C18.1 21 19 20.1 19 19V8L14 3Z" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M14 3V8H19" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M9 12H15M9 16H15" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                  </span>
                  <span className="cl-item-meta-label">{requirementMetaLabel}</span>
                </span>
              ) : null}
              {canOpenReferencePreview &&
              (expiryDateRequired || requirementMetaLabel) ? (
                <span className="cl-item-meta-sep" aria-hidden>
                  |
                </span>
              ) : null}
              {canOpenReferencePreview ? (
                <button
                  type="button"
                  className="cl-item-meta-preview-btn"
                  onClick={handlePreviewReferenceFile}
                  title="Preview reference file"
                  aria-label="Preview reference file"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M2 12C3.8 8.5 7.3 6 12 6C16.7 6 20.2 8.5 22 12C20.2 15.5 16.7 18 12 18C7.3 18 3.8 15.5 2 12Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </td>
      <td className="checklist-table-role cl-col-role cl-role-cell">
        {displayRoleNames.length > 0 ? (
          <div className="cl-role-badges">
            {displayRoleNames.map((roleName, roleIdx) => (
              <span
                key={`${id}_role_${roleIdx}_${roleName}`}
                className="cl-role-badge"
                title={roleName}
              >
                {roleName}
              </span>
            ))}
          </div>
        ) : (
          <span className="cl-role-empty" aria-label="No roles assigned">
            -
          </span>
        )}
      </td>
      <td className="checklist-table-upload cl-col-upload cl-col-upload--multi checklist-upload-compact-wrap">
        <div className="checklist-upload-compact">
          {!isViewOnly ? (
            <button
              type="button"
              className="checklist-upload-btn"
              onClick={handleBrowseClick}
              title="Upload documents"
              aria-label="Upload documents"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 16V4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M8 8L12 4L16 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 19H19" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              <span>Upload</span>
            </button>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            id={`file-upload-${id}`}
            onChange={handleFileChange}
            className="checklist-file-input"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          />
          {renderUploadColumnFilesPreview()}
        </div>
      </td>
      <td className="checklist-table-remarks cl-col-remarks">
        <FormTextarea
          value={remarks}
          onChange={handleRemarksChange}
          placeholder="Add remarks…"
          rows={1}
          className="checklist-table-textarea cl-remarks-ta"
          disabled={isViewOnly}
        />
      </td>
    </tr>
  );
};

ChecklistItemRow.propTypes = {
  item: PropTypes.object.isRequired,
  itemData: PropTypes.object,
  onChange: PropTypes.func.isRequired,
  cardColor: PropTypes.string,
  isViewOnly: PropTypes.bool,
};

export default ChecklistItemRow;
