import { useRef, useState } from "react";
import PropTypes from "prop-types";

const DROPZONE_CONFIG = [
  { key: "passport", title: "Passport", accept: ".pdf,.jpg,.jpeg,.png", multiple: true },
  { key: "iqama", title: "Iqama", accept: ".pdf,.jpg,.jpeg,.png", multiple: true },
  { key: "visa", title: "Visa", accept: ".pdf,.jpg,.jpeg,.png", multiple: true },
];

const DropzoneIcon = ({ status }) => {
  if (status === "uploading") {
    return <span className="crew-dropzone__spinner" aria-hidden="true" />;
  }
  if (status === "completed") {
    return (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === "failed") {
    return (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 5V9M8 11.5H8.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 18a4.5 4.5 0 0 1-1.5-8.74A5.5 5.5 0 0 1 16.5 8H17a4 4 0 0 1 1 7.87M12 11v8M9 14l3-3 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

DropzoneIcon.propTypes = {
  status: PropTypes.oneOf(["pending", "uploading", "completed", "failed"]).isRequired,
};

// Compact drag & drop upload boxes for Passport/Iqama and Visa — gated
// until the Crew List has been uploaded at least once (see
// CrewListUploadBox, a separate movement-type-aware component that owns
// the Crew List upload itself).
const CrewUploadDropzones = ({
  steps,
  onSelectPassportFiles,
  onSelectIqamaFiles,
  onSelectVisaFiles,
  visibleKeys,
}) => {
  const [draggingKey, setDraggingKey] = useState(null);
  const fileInputRefs = useRef({});
  // UPLOAD_PASSPORT/UPLOAD_IQAMA/UPLOAD_VISA permissions — when omitted, all
  // three dropzones show (existing behavior).
  const zones = visibleKeys ? DROPZONE_CONFIG.filter((zone) => visibleKeys.includes(zone.key)) : DROPZONE_CONFIG;

  const handlers = {
    passport: (fileList) => onSelectPassportFiles(fileList),
    iqama: (fileList) => onSelectIqamaFiles(fileList),
    visa: (fileList) => onSelectVisaFiles(fileList),
  };

  const isDisabled = () => steps.crewList?.status !== "completed";

  const openPicker = (key) => {
    if (isDisabled() || steps[key]?.status === "uploading") return;
    fileInputRefs.current[key]?.click();
  };

  const handleDragEnter = (key) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDisabled()) setDraggingKey(key);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingKey(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (key, multiple) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingKey(null);
    if (isDisabled()) return;
    handlers[key](multiple ? e.dataTransfer.files : e.dataTransfer.files?.[0]);
  };

  return (
    <div className="crew-upload-dropzones">
      {zones.map((zone) => {
        const state = steps[zone.key] || { status: "pending", files: [] };
        const disabled = isDisabled();

        return (
          <div
            key={zone.key}
            className={`crew-dropzone crew-dropzone--${state.status}${disabled ? " crew-dropzone--disabled" : ""}${draggingKey === zone.key ? " crew-dropzone--active" : ""}`}
            onClick={() => openPicker(zone.key)}
            onDragEnter={handleDragEnter(zone.key)}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop(zone.key, zone.multiple)}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            title={zone.title}
          >
            <input
              ref={(el) => (fileInputRefs.current[zone.key] = el)}
              type="file"
              accept={zone.accept}
              multiple={zone.multiple}
              className="crew-dropzone__input"
              disabled={disabled}
              onChange={(e) => {
                handlers[zone.key](zone.multiple ? e.target.files : e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <span className={`crew-dropzone__icon crew-dropzone__icon--${state.status}`}>
              <DropzoneIcon status={state.status} />
            </span>
            <span className="crew-dropzone__title">{zone.title}</span>
          </div>
        );
      })}
    </div>
  );
};

const stepStatePropType = PropTypes.shape({
  status: PropTypes.oneOf(["pending", "uploading", "completed", "failed"]),
  files: PropTypes.array,
  progress: PropTypes.number,
});

CrewUploadDropzones.propTypes = {
  steps: PropTypes.shape({
    crewList: stepStatePropType,
    passport: stepStatePropType,
    iqama: stepStatePropType,
    visa: stepStatePropType,
  }).isRequired,
  onSelectPassportFiles: PropTypes.func.isRequired,
  onSelectIqamaFiles: PropTypes.func.isRequired,
  onSelectVisaFiles: PropTypes.func.isRequired,
  visibleKeys: PropTypes.arrayOf(PropTypes.oneOf(["passport", "iqama", "visa"])),
};

export default CrewUploadDropzones;
