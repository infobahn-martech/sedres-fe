import { useState, useRef, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import PropTypes from "prop-types";
import { FiPrinter } from "react-icons/fi";
import VesselBoardingArabicPreview from "./VesselBoardingArabicPreview";
import { GroFieldTableSkeletonRows, GroLetterPreviewSkeleton } from "./GroCardViewSkeleton";
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
  const [templateLoading, setTemplateLoading] = useState(Boolean(portId));
  const [fieldValues, setFieldValues] = useState({});
  const [arabicValues, setArabicValues] = useState({});
  const [vesselData, setVesselData] = useState(null);
  const previewRef = useRef(null);
  // Edits waiting to be translated: fieldKey -> { toArabic, text }. Editing either column
  // queues a translation into the other one; a later edit of the same field replaces it.
  const pendingTranslationsRef = useRef({});
  const [translationTick, setTranslationTick] = useState(0);
  // Bumped on every edit of a field, so a response that arrives after a newer edit is dropped.
  const editSeqRef = useRef({});

  useEffect(() => {
    if (!portId) {
      setTemplateLoading(false);
      return undefined;
    }
    let cancelled = false;
    setTemplateLoading(true);
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
      })
      .finally(() => {
        if (!cancelled) setTemplateLoading(false);
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
    setArabicValues({});
    pendingTranslationsRef.current = {};
    editSeqRef.current = {};
  }, [templateData]);

  const queueTranslation = (fieldKey, text, toArabic) => {
    editSeqRef.current[fieldKey] = (editSeqRef.current[fieldKey] ?? 0) + 1;
    pendingTranslationsRef.current[fieldKey] = { text, toArabic };
    setTranslationTick((t) => t + 1);
  };

  // English edits fill the Arabic column and Arabic edits fill the English column. Debounced
  // so it doesn't fire on every keystroke. Results are written straight to state (not through
  // queueTranslation), so a translation never triggers a translation back.
  useEffect(() => {
    if (Object.keys(pendingTranslationsRef.current).length === 0) return undefined;
    const timer = setTimeout(() => {
      const batch = pendingTranslationsRef.current;
      pendingTranslationsRef.current = {};
      Object.entries(batch).forEach(([fieldKey, { text, toArabic }]) => {
        const trimmed = String(text ?? "").trim();
        if (!trimmed) return;
        const seq = editSeqRef.current[fieldKey];
        const request = toArabic
          ? translateService.translateToArabic(trimmed)
          : translateService.translateToEnglish(trimmed);
        request
          .then((res) => {
            const translated = res?.data?.data?.translated_value;
            if (!translated || editSeqRef.current[fieldKey] !== seq) return;
            const setTarget = toArabic ? setArabicValues : setFieldValues;
            setTarget((prev) => ({ ...prev, [fieldKey]: translated }));
          })
          .catch(() => {});
      });
    }, TRANSLATE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [translationTick]);

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
  // Prefilled English values are queued for Arabic translation like typed ones.
  const fieldValuesRef = useRef(fieldValues);
  fieldValuesRef.current = fieldValues;
  useEffect(() => {
    if (!vesselData || vesselFields.length === 0) return;
    const current = fieldValuesRef.current;
    const prefill = {};
    vesselFields.forEach((field) => {
      if (current[field.fieldKey]) return;
      const apiKey = matchVesselApiFieldKey(field.labelEn);
      if (!apiKey) return;
      const value = vesselData[apiKey];
      if (value == null || value === "") return;
      prefill[field.fieldKey] = String(value);
    });
    if (Object.keys(prefill).length === 0) return;
    setFieldValues((prev) => ({ ...prefill, ...prev }));
    Object.entries(prefill).forEach(([fieldKey, value]) => queueTranslation(fieldKey, value, true));
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
    queueTranslation(fieldKey, value, true);
  };

  const handleArabicChange = (fieldKey, value) => {
    setArabicValues((prev) => ({ ...prev, [fieldKey]: value }));
    queueTranslation(fieldKey, value, false);
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
                {templateLoading ? (
                  <GroFieldTableSkeletonRows rows={10} />
                ) : vesselFields.length === 0 ? (
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
            <div className="gro-vessel-reg-preview-actions gro-crew-imm-print-actions">
              <button
                type="button"
                className="gro-crew-imm-print-btn"
                title="Generate & download the Vessel Registration PDF"
                onClick={onSave}
                disabled={isSaving || !onSave || templateLoading}
                aria-busy={isSaving}
              >
                {isSaving ? (
                  <span className="spinner-border spinner-border-sm" role="status">
                    <span className="visually-hidden">Generating…</span>
                  </span>
                ) : (
                  <FiPrinter aria-hidden />
                )}
                {isSaving ? "Generating PDF…" : "Print"}
              </button>
            </div>
            ) : null}
          </div>
          {templateLoading ? (
            <div className="gro-vir-scroll gro-vir-preview" role="status" aria-live="polite">
              <span className="visually-hidden">Loading document preview…</span>
              <GroLetterPreviewSkeleton />
            </div>
          ) : (
            <div ref={previewRef} className="gro-vir-scroll gro-vir-preview">
              <VesselBoardingArabicPreview
                fieldValues={fieldValues}
                translations={arabicValues}
                templateData={templateData}
              />
            </div>
          )}
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
