import { useState, useRef, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import PropTypes from "prop-types";
import { FiSave } from "react-icons/fi";
import VesselBoardingArabicPreview from "./VesselBoardingArabicPreview";
import { extractVesselRegTemplateFields, matchVesselApiFieldKey } from "./vesselRegTemplateFields";
import groService from "@/services/groService";
import vesselService from "@/services/vesselService";
import translateService from "@/services/translateService";

const TRANSLATE_DEBOUNCE_MS = 500;

/**
 * Template-driven form view — editable fields (from the port's pass template of `templateType`)
 * + Arabic document preview. Used for Vessel Inward Registration and the Crew Immigration form.
 */
const VesselInwardRegistrationView = forwardRef(function VesselInwardRegistrationView(
  {
    onSave,
    isSaving = false,
    portId,
    callId,
    templateType = "Vessel Registration",
    sectionTitle = "Vessel Particulars",
  },
  ref
) {
  const [templateData, setTemplateData] = useState(null);
  const [fieldValues, setFieldValues] = useState({});
  const [translations, setTranslations] = useState({});
  // Arabic values typed manually by the user — take precedence over auto-translations.
  const [arabicOverrides, setArabicOverrides] = useState({});
  const [vesselData, setVesselData] = useState(null);
  const previewRef = useRef(null);
  const translatedSourceRef = useRef({});

  useEffect(() => {
    if (!portId) return;
    let cancelled = false;
    groService
      .getTemplatesByPort(portId, templateType)
      .then((res) => {
        if (cancelled) return;
        const list = res?.data?.data ?? res?.data ?? [];
        const first = Array.isArray(list) ? list[0] : null;
        setTemplateData(first ?? null);
      })
      .catch(() => {
        if (!cancelled) setTemplateData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [portId, templateType]);

  const vesselFields = useMemo(
    () => extractVesselRegTemplateFields(templateData?.more_description),
    [templateData]
  );

  useEffect(() => {
    setFieldValues({});
    setTranslations({});
    setArabicOverrides({});
    translatedSourceRef.current = {};
  }, [templateData]);

  // Effective Arabic value per field: the user's manual entry if present, else the auto-translation.
  const arabicValues = useMemo(
    () => ({ ...translations, ...arabicOverrides }),
    [translations, arabicOverrides]
  );

  // Translate each field's typed/prefilled English value to Arabic for the preview's 3rd
  // column, debounced so it doesn't fire on every keystroke, and skips values already sent.
  useEffect(() => {
    const timer = setTimeout(() => {
      Object.entries(fieldValues).forEach(([fieldKey, value]) => {
        const trimmed = String(value ?? "").trim();
        if (!trimmed || translatedSourceRef.current[fieldKey] === trimmed) return;
        translatedSourceRef.current[fieldKey] = trimmed;
        translateService
          .translateToArabic(trimmed)
          .then((res) => {
            const translated = res?.data?.data?.translated_value;
            if (translated) {
              setTranslations((prev) => ({ ...prev, [fieldKey]: translated }));
            }
          })
          .catch(() => {
            translatedSourceRef.current[fieldKey] = null;
          });
      });
    }, TRANSLATE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [fieldValues]);

  useEffect(() => {
    if (!callId) {
      setVesselData(null);
      return undefined;
    }
    let cancelled = false;
    vesselService
      .getVesselByCall(callId)
      .then((res) => {
        if (cancelled) return;
        setVesselData(res?.data?.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setVesselData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [callId]);

  // Prefill each template row from vessel/get_vessel_by_call by matching its English label
  // to the response's field keys — only fills blanks, never overwrites a typed value.
  useEffect(() => {
    if (!vesselData || vesselFields.length === 0) return;
    setFieldValues((prev) => {
      let changed = false;
      const next = { ...prev };
      vesselFields.forEach((field) => {
        if (next[field.fieldKey]) return;
        const apiKey = matchVesselApiFieldKey(field.labelEn);
        if (!apiKey) return;
        const value = vesselData[apiKey];
        if (value == null || value === "") return;
        next[field.fieldKey] = String(value);
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [vesselData, vesselFields]);

  useImperativeHandle(
    ref,
    () => ({
      getPreviewHtml: () => previewRef.current?.outerHTML,
    }),
    []
  );

  const handleFieldChange = (fieldKey, value) => {
    setFieldValues((prev) => ({ ...prev, [fieldKey]: value }));
  };

  const handleArabicChange = (fieldKey, value) => {
    setArabicOverrides((prev) => ({ ...prev, [fieldKey]: value }));
  };

  return (
    <div className="gro-crew-immigration-panel gro-vir-panel">
      <div className="gro-crew-immigration-bulk-body gro-vir-body">
        <div className="gro-crew-immigration-bulk-left gro-vir-col">
          <p className="gro-crew-immigration-bulk-section-title">{sectionTitle}</p>
          <div className="gro-crew-immigration-bulk-table-wrap gro-vir-scroll">
            <table className="gro-crew-immigration-bulk-table gro-vir-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Value (Arabic)</th>
                  <th>Value (English)</th>
                </tr>
              </thead>
              <tbody>
                {vesselFields.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="gro-crew-immigration-bulk-empty">
                      No fields available.
                    </td>
                  </tr>
                ) : (
                  vesselFields.map((field) => (
                    <tr key={field.fieldKey}>
                      <td>{field.displayLabel}</td>
                      <td>
                        <input
                          type="text"
                          dir="rtl"
                          lang="ar"
                          className="gro-crew-immigration-bulk-input"
                          value={arabicValues[field.fieldKey] ?? ""}
                          onChange={(e) => handleArabicChange(field.fieldKey, e.target.value)}
                          placeholder={field.displayLabel}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="gro-crew-immigration-bulk-input"
                          value={fieldValues[field.fieldKey] ?? ""}
                          onChange={(e) => handleFieldChange(field.fieldKey, e.target.value)}
                          placeholder={field.displayLabel}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="gro-crew-immigration-bulk-right gro-vir-col">
          <div className="gro-vessel-reg-preview-header">
            <p className="gro-crew-immigration-bulk-section-title">Document Preview</p>
            {onSave ? (
            <div className="gro-vessel-reg-preview-actions">
              <button
                type="button"
                className="gro-vessel-reg-icon-btn"
                title="Generate & Download Vessel Registration PDF"
                aria-label="Generate & Download Vessel Registration PDF"
                onClick={onSave}
                disabled={isSaving || !onSave}
              >
                {isSaving ? (
                  <span className="spinner-border spinner-border-sm" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </span>
                ) : (
                  <FiSave />
                )}
              </button>
            </div>
            ) : null}
          </div>
          <div ref={previewRef} className="gro-vir-scroll gro-vir-preview">
            <VesselBoardingArabicPreview
              fieldValues={fieldValues}
              translations={arabicValues}
              templateData={templateData}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

VesselInwardRegistrationView.propTypes = {
  onSave: PropTypes.func,
  isSaving: PropTypes.bool,
  portId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  callId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  templateType: PropTypes.string,
  sectionTitle: PropTypes.string,
};

VesselInwardRegistrationView.displayName = "VesselInwardRegistrationView";

export default VesselInwardRegistrationView;
