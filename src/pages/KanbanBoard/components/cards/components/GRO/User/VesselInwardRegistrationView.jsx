import { useState, useRef, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import PropTypes from "prop-types";
import DOMPurify from "dompurify";
import { FiPrinter } from "react-icons/fi";
import VesselBoardingArabicPreview from "./VesselBoardingArabicPreview";
import GroTranslationModeBar from "./GroTranslationModeBar";
import { TRANSLATION_MODES, translationDirections, useGroTranslationMode } from "./groTranslationMode";
import { GroFieldTableSkeletonRows, GroLetterPreviewSkeleton } from "./GroCardViewSkeleton";
import { extractVesselRegTemplateFields, matchVesselApiFieldKey } from "./vesselRegTemplateFields";
import groService from "@/services/groService";
import vesselService from "@/services/vesselService";
import translateService from "@/services/translateService";

const TRANSLATE_DEBOUNCE_MS = 500;

const SAVED_HTML_SANITIZE_CONFIG = {
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus"],
  ALLOW_DATA_ATTR: false,
};

/**
 * generated_document.html is the preview's own outerHTML from the last Print (wrapped in
 * `.gro-vir-preview`). Unwrap it so it can be rendered back inside the same wrapper, sanitized.
 */
const unwrapSavedPreviewHtml = (html) => {
  const raw = String(html ?? "").trim();
  if (!raw) return "";
  let inner = raw;
  if (typeof DOMParser !== "undefined") {
    const root = new DOMParser().parseFromString(raw, "text/html").body.firstElementChild;
    if (root?.classList?.contains("gro-vir-preview") && root.parentElement?.children.length === 1) {
      inner = root.innerHTML;
    }
  }
  return DOMPurify.sanitize(inner, SAVED_HTML_SANITIZE_CONFIG);
};

/** generated_document.values → { english, arabic } ({ english, arabic } or { fieldValues, arabicValues }). */
const parseSavedValues = (values) => {
  let parsed = values;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const english = parsed.english ?? parsed.fieldValues ?? null;
  const arabic = parsed.arabic ?? parsed.arabicValues ?? null;
  if (!english && !arabic) return null;
  return {
    english: english && typeof english === "object" ? english : {},
    arabic: arabic && typeof arabic === "object" ? arabic : {},
  };
};

/**
 * Template-driven form view — editable fields (from the port's pass template of `templateType`)
 * + Arabic document preview. Used for Vessel Inward Registration and the Crew Immigration form.
 */
const VesselInwardRegistrationView = forwardRef(function VesselInwardRegistrationView(
  {
    navigation = null,
    actions = null,
    onSave,
    isSaving = false,
    portId,
    callId,
    templateType = "Vessel Registration",
    // generated_document.html / .values from get_call_detail_by_id — the last generated document.
    savedHtml = null,
    savedValues = null,
  },
  ref
) {
  const savedPreviewHtml = useMemo(() => unwrapSavedPreviewHtml(savedHtml), [savedHtml]);
  const restoredValues = useMemo(() => parseSavedValues(savedValues), [savedValues]);
  // The saved document is shown until the user edits a field; then the live template preview takes over.
  const [showSavedPreview, setShowSavedPreview] = useState(Boolean(savedPreviewHtml));
  useEffect(() => {
    setShowSavedPreview(Boolean(savedPreviewHtml));
  }, [savedPreviewHtml]);
  const isShowingSaved = showSavedPreview && Boolean(savedPreviewHtml);
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
  const [translationMode, setTranslationMode] = useGroTranslationMode(
    `gro.translationMode.${templateType}`,
    TRANSLATION_MODES.AUTO
  );
  const { enToAr, arToEn } = translationDirections(translationMode);

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

  // Restore the values the last document was generated with (vessel prefill only fills blanks after).
  useEffect(() => {
    if (!restoredValues) return;
    setFieldValues((prev) => ({ ...prev, ...restoredValues.english }));
    setArabicValues((prev) => ({ ...prev, ...restoredValues.arabic }));
  }, [templateData, restoredValues]);

  // Every edit bumps the field's sequence (dropping in-flight results); it is only translated
  // when the selected mode translates in that direction.
  const queueTranslation = (fieldKey, text, toArabic) => {
    editSeqRef.current[fieldKey] = (editSeqRef.current[fieldKey] ?? 0) + 1;
    if (!(toArabic ? enToAr : arToEn)) {
      delete pendingTranslationsRef.current[fieldKey];
      return;
    }
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

  // Switching to a translating mode fills the blanks on the target side from the values already
  // there (e.g. prefilled English entered while in "Type manually"); typed values are never replaced.
  const arabicValuesRef = useRef(arabicValues);
  arabicValuesRef.current = arabicValues;
  const lastModeRef = useRef(translationMode);
  useEffect(() => {
    if (lastModeRef.current === translationMode) return;
    lastModeRef.current = translationMode;
    const english = fieldValuesRef.current;
    const arabic = arabicValuesRef.current;
    const hasText = (v) => String(v ?? "").trim() !== "";
    vesselFields.forEach(({ fieldKey }) => {
      if (enToAr && hasText(english[fieldKey]) && !hasText(arabic[fieldKey])) {
        queueTranslation(fieldKey, english[fieldKey], true);
      } else if (arToEn && hasText(arabic[fieldKey]) && !hasText(english[fieldKey])) {
        queueTranslation(fieldKey, arabic[fieldKey], false);
      }
    });
    // Runs only when the mode changes; current values are read from refs on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translationMode]);

  useImperativeHandle(
    ref,
    () => ({
      getPreviewHtml: () => previewRef.current?.outerHTML,
      // Sent with the generate request so the next load can restore the table (generated_document.values).
      getFormValues: () => ({ english: fieldValuesRef.current, arabic: arabicValuesRef.current }),
    }),
    []
  );

  const handleFieldChange = (fieldKey, value) => {
    setShowSavedPreview(false);
    setFieldValues((prev) => ({ ...prev, [fieldKey]: value }));
    queueTranslation(fieldKey, value, true);
  };

  const handleArabicChange = (fieldKey, value) => {
    setShowSavedPreview(false);
    setArabicValues((prev) => ({ ...prev, [fieldKey]: value }));
    queueTranslation(fieldKey, value, false);
  };

  return (
    <div className="gro-crew-immigration-panel gro-vir-panel">
      {navigation || actions ? (
        <div className="gro-crew-immigration-toolbar gro-crew-imm-toolbar">
          <div className="gro-crew-imm-toolbar-group">{navigation}</div>
          {actions ? (
            <div className="gro-crew-imm-toolbar-group gro-crew-imm-toolbar-group--end">
              <div className="gro-pass-segments gro-crew-imm-actions">{actions}</div>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="gro-crew-immigration-bulk-body gro-vir-body">
        <div className="gro-crew-immigration-bulk-left gro-vir-col">
          <GroTranslationModeBar mode={translationMode} onChange={setTranslationMode} />
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
          {onSave ? (
          <div className="gro-vessel-reg-preview-header gro-vessel-reg-preview-header--actions">
            <div className="gro-vessel-reg-preview-actions gro-crew-imm-print-actions">
              <button
                type="button"
                className="gro-crew-imm-print-btn"
                title="Generate & download the Vessel Registration PDF"
                onClick={onSave}
                disabled={isSaving || !onSave || (templateLoading && !isShowingSaved)}
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
          </div>
          ) : null}
          {isShowingSaved ? (
            <div
              ref={previewRef}
              className="gro-vir-scroll gro-vir-preview"
              dangerouslySetInnerHTML={{ __html: savedPreviewHtml }}
            />
          ) : templateLoading ? (
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
  navigation: PropTypes.node,
  actions: PropTypes.node,
  onSave: PropTypes.func,
  isSaving: PropTypes.bool,
  portId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  callId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  templateType: PropTypes.string,
  savedHtml: PropTypes.string,
  savedValues: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
};

VesselInwardRegistrationView.displayName = "VesselInwardRegistrationView";

export default VesselInwardRegistrationView;
