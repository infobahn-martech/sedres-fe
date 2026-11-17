import { useId, useRef, useState, useEffect } from "react";
import { FiUploadCloud, FiTrash2, FiRefreshCw } from "react-icons/fi";
import "../../design/scss/signature-upload.scss";

/**
 * Signature file picker with preview.
 * - previewUrl: current signature (existing URL or data URL of a newly picked file)
 * - onSelect(file): called with the picked File
 * - onRemove(): called when the user clears the signature
 */
function SignatureUpload({
  label = "Signature",
  previewUrl,
  onSelect,
  onRemove,
  disabled = false,
  error,
  accept = "image/*",
  compact = false,
}) {
  const inputId = useId();
  const inputRef = useRef(null);
  const [isBroken, setIsBroken] = useState(false);

  useEffect(() => setIsBroken(false), [previewUrl]);

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onSelect?.(file);
    // allow re-selecting the same file after a remove
    e.target.value = "";
  };

  const hasPreview = Boolean(previewUrl) && !isBroken;

  return (
    <div className="form-field">
      <div
        className={`signature-upload ${compact ? "is-compact" : ""} ${error ? "has-error" : ""} ${disabled ? "is-disabled" : ""}`}
      >
        <span className="signature-upload__label">{label}</span>

        <div className="signature-upload__body">
          {hasPreview ? (
            <img
              src={previewUrl}
              alt="Signature"
              className="signature-upload__preview"
              onError={() => setIsBroken(true)}
            />
          ) : (
            <label
              htmlFor={disabled ? undefined : inputId}
              className="signature-upload__empty"
            >
              <FiUploadCloud size={20} />
              <span>{disabled ? "No signature uploaded" : "Click to upload signature"}</span>
            </label>
          )}

          {!disabled && hasPreview && (
            <div className="signature-upload__actions">
              <button
                type="button"
                className="signature-upload__btn"
                onClick={() => inputRef.current?.click()}
              >
                <FiRefreshCw size={14} /> Change
              </button>
              <button
                type="button"
                className="signature-upload__btn signature-upload__btn--danger"
                onClick={onRemove}
              >
                <FiTrash2 size={14} /> Remove
              </button>
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          className="d-none"
          onChange={handleChange}
          disabled={disabled}
        />
      </div>
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

export default SignatureUpload;
