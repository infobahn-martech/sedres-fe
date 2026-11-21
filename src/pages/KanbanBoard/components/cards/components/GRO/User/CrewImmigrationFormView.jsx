import { useState, useEffect, useMemo, useRef } from "react";
import PropTypes from "prop-types";
import DOMPurify from "dompurify";
import groService from "@/services/groService";
import vesselService from "@/services/vesselService";
import translateService from "@/services/translateService";
import { getImmigrationCrewList } from "@/services/cgAndZwailpassService";
import { formatGregorianDate, formatHijriDate } from "./groArabicDate";
import { GroFieldTableSkeletonRows, GroLetterPreviewSkeleton } from "./GroCardViewSkeleton";
import {
  parseCrewImmigrationTemplates,
  extractCrewImmigrationPlaceholders,
  renderCrewImmigrationTemplate,
  humanizePlaceholder,
  needsArabicTranslation,
} from "./crewImmigrationTemplate";

const TRANSLATE_DEBOUNCE_MS = 500;
const ARRIVAL_DATE_KEYS = ["arrival_date", "ata", "actual_arrival", "eta", "dey"];

const SANITIZE_CONFIG = {
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus"],
  ALLOW_DATA_ATTR: false,
};

// English text -> Arabic translation, shared by every section so each text is translated once.
const translationCache = new Map();
const pendingTranslations = new Set();

/** Debounced English->Arabic translation of `texts`; returns a lookup for the results. */
function useArabicTranslations(texts) {
  const [, setVersion] = useState(0);
  const mountedRef = useRef(true);
  const textsKey = texts.join("\u0001");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      textsKey.split("\u0001").forEach((text) => {
        if (!text || translationCache.has(text) || pendingTranslations.has(text)) return;
        pendingTranslations.add(text);
        translateService
          .translateToArabic(text)
          .then((res) => {
            const translated = res?.data?.data?.translated_value;
            if (translated) translationCache.set(text, translated);
          })
          .catch(() => {})
          .finally(() => {
            pendingTranslations.delete(text);
            if (mountedRef.current) setVersion((v) => v + 1);
          });
      });
    }, TRANSLATE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [textsKey]);

  return (text) => translationCache.get(text) ?? "";
}

const toArabicValue = (english, translate) => {
  const text = String(english ?? "").trim();
  if (!text) return "";
  return needsArabicTranslation(text) ? translate(text) : text;
};

const formatHijriFromValue = (value) => {
  if (!value) return "";
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? "" : formatHijriDate(date);
};

/** "BATCH 2" -> "2"; falls back to the batch name as-is. */
const batchNumber = (batch) => String(batch ?? "").match(/\d+/)?.[0] ?? String(batch ?? "");

/** One template (Entry / Return): its fields, crew table and live preview. */
function CrewImmigrationTemplateSection({ template, autoValues, crew }) {
  const html = template?.more_description ?? "";
  const { fieldKeys, crewKeys } = useMemo(() => extractCrewImmigrationPlaceholders(html), [html]);

  const [englishOverrides, setEnglishOverrides] = useState({});
  const [arabicOverrides, setArabicOverrides] = useState({});
  const [crewOverrides, setCrewOverrides] = useState({});

  // A new batch is a new letter — drop manual edits made for the previous one.
  useEffect(() => {
    setEnglishOverrides({});
    setArabicOverrides({});
    setCrewOverrides({});
  }, [crew, html]);

  const englishValues = useMemo(() => {
    const out = {};
    fieldKeys.forEach((key) => {
      out[key] = englishOverrides[key] ?? String(autoValues?.[key] ?? "");
    });
    return out;
  }, [fieldKeys, englishOverrides, autoValues]);

  // Crew source values (English) per repeating-row token; `_ar` tokens translate their base field.
  const crewSourceRows = useMemo(
    () =>
      crew.map((member, index) => {
        const row = {};
        crewKeys.forEach((key) => {
          if (key === "sl_no") row[key] = String(index + 1);
          else if (/_ar$/.test(key)) row[key] = String(member?.[key] ?? member?.[key.replace(/_ar$/, "")] ?? "");
          else row[key] = String(member?.[key] ?? "");
        });
        return row;
      }),
    [crew, crewKeys]
  );

  const textsToTranslate = useMemo(() => {
    const texts = Object.values(englishValues).filter(needsArabicTranslation);
    crewSourceRows.forEach((row) => {
      crewKeys.forEach((key) => {
        if (/_ar$/.test(key) && needsArabicTranslation(row[key])) texts.push(row[key]);
      });
    });
    return Array.from(new Set(texts.map((t) => t.trim()))).sort();
  }, [englishValues, crewSourceRows, crewKeys]);

  const translate = useArabicTranslations(textsToTranslate);

  const arabicValues = {};
  fieldKeys.forEach((key) => {
    arabicValues[key] = arabicOverrides[key] ?? toArabicValue(englishValues[key], translate);
  });

  const crewRows = crewSourceRows.map((row, index) => {
    const out = {};
    crewKeys.forEach((key) => {
      const overrideKey = `${index}:${key}`;
      if (crewOverrides[overrideKey] != null) out[key] = crewOverrides[overrideKey];
      else if (/_ar$/.test(key)) out[key] = toArabicValue(row[key], translate);
      else out[key] = row[key];
    });
    return out;
  });

  // The letter is Arabic: prefer the Arabic value, fall back to the English one.
  const previewValues = {};
  fieldKeys.forEach((key) => {
    previewValues[key] = arabicValues[key] || englishValues[key];
  });

  const previewHtml = DOMPurify.sanitize(
    renderCrewImmigrationTemplate(html, previewValues, crewRows),
    SANITIZE_CONFIG
  );

  const editableCrewKeys = crewKeys.filter((key) => key !== "sl_no");

  return (
    <section className="gro-crew-imm-form-section">
      <div className="gro-crew-imm-form-section-head">
        <h4 className="gro-crew-imm-form-section-title">{template?.template_name || "Crew Immigration"}</h4>
        {template?.description ? (
          <p className="gro-crew-imm-form-section-desc">{template.description}</p>
        ) : null}
      </div>

      <div className="gro-crew-immigration-bulk-body">
        <div className="gro-crew-immigration-bulk-left">
          <p className="gro-crew-immigration-bulk-section-title">Fields</p>
          <div className="gro-crew-immigration-bulk-table-wrap">
            <table className="gro-crew-immigration-bulk-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Value (Arabic)</th>
                  <th>Value (English)</th>
                </tr>
              </thead>
              <tbody>
                {fieldKeys.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="gro-crew-immigration-bulk-empty">
                      No fields available.
                    </td>
                  </tr>
                ) : (
                  fieldKeys.map((key) => (
                    <tr key={key}>
                      <td>{humanizePlaceholder(key)}</td>
                      <td>
                        <input
                          type="text"
                          dir="rtl"
                          lang="ar"
                          className="gro-crew-immigration-bulk-input"
                          value={arabicValues[key] ?? ""}
                          onChange={(e) =>
                            setArabicOverrides((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          placeholder={humanizePlaceholder(key)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="gro-crew-immigration-bulk-input"
                          value={englishValues[key] ?? ""}
                          onChange={(e) =>
                            setEnglishOverrides((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          placeholder={humanizePlaceholder(key)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {crewKeys.length > 0 ? (
            <>
              <p className="gro-crew-immigration-bulk-section-title gro-crew-imm-form-subtitle">
                Crew ({crewRows.length})
              </p>
              <div className="gro-crew-immigration-bulk-table-wrap">
                <table className="gro-crew-immigration-bulk-table">
                  <thead>
                    <tr>
                      <th className="gro-crew-immigration-bulk-th-sl">#</th>
                      {editableCrewKeys.map((key) => (
                        <th key={key}>{humanizePlaceholder(key)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {crewRows.length === 0 ? (
                      <tr>
                        <td colSpan={editableCrewKeys.length + 1} className="gro-crew-immigration-bulk-empty">
                          No crew in this batch.
                        </td>
                      </tr>
                    ) : (
                      crewRows.map((row, index) => (
                        <tr key={crew[index]?.crew_id ?? index}>
                          <td className="gro-crew-immigration-bulk-td-sl">{index + 1}</td>
                          {editableCrewKeys.map((key) => {
                            const isArabic = /_ar$/.test(key);
                            return (
                              <td key={key}>
                                <input
                                  type="text"
                                  dir={isArabic ? "rtl" : undefined}
                                  lang={isArabic ? "ar" : undefined}
                                  className="gro-crew-immigration-bulk-input"
                                  value={row[key] ?? ""}
                                  onChange={(e) =>
                                    setCrewOverrides((prev) => ({
                                      ...prev,
                                      [`${index}:${key}`]: e.target.value,
                                    }))
                                  }
                                  placeholder={crewSourceRows[index]?.[key] || humanizePlaceholder(key)}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>

        <div className="gro-crew-immigration-bulk-right">
          <p className="gro-crew-immigration-bulk-section-title">Document Preview</p>
          <div className="bulk-pass-arabic-preview" aria-readonly="true" aria-label="Document preview (read only)">
            <div className="bulk-pass-arabic-paper gro-crew-imm-form-paper" dir="rtl">
              <div
                className="bulk-pass-arabic-more-description"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

CrewImmigrationTemplateSection.propTypes = {
  template: PropTypes.shape({
    template_name: PropTypes.string,
    description: PropTypes.string,
    more_description: PropTypes.string,
  }).isRequired,
  autoValues: PropTypes.object.isRequired,
  crew: PropTypes.arrayOf(PropTypes.object).isRequired,
};

/**
 * Crew Immigration form tab — one section per Crew Immigration template for the port
 * (Entry / Return), each filled from the selected batch's crew and the call's vessel.
 */
export default function CrewImmigrationFormView({ portId, callId, activeBatch: controlledBatch }) {
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [batches, setBatches] = useState([]);
  const [ownBatch, setActiveBatch] = useState("");
  // Embedded in the Crew Immigration tab, the batch is chosen by the parent's batch tabs.
  const isControlled = controlledBatch !== undefined;
  const activeBatch = isControlled ? controlledBatch : ownBatch;
  const [vesselData, setVesselData] = useState(null);

  useEffect(() => {
    if (!portId) return undefined;
    let cancelled = false;
    setTemplatesLoading(true);
    groService
      .getTemplatesByPort(portId, "Crew Immigration")
      .then((res) => {
        if (!cancelled) setTemplates(parseCrewImmigrationTemplates(res));
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [portId]);

  useEffect(() => {
    if (callId == null || callId === "") return undefined;
    let cancelled = false;
    getImmigrationCrewList(callId, { page: 1, limit: 1000 })
      .then((res) => {
        if (cancelled) return;
        const envelope = res?.data?.data ?? res?.data ?? {};
        const list = (Array.isArray(envelope?.batches) ? envelope.batches : [])
          .filter((b) => b?.batch)
          .map((b) => ({ batch: b.batch, crew: Array.isArray(b.crew) ? b.crew : [] }));
        setBatches(list);
        setActiveBatch((prev) => (list.some((b) => b.batch === prev) ? prev : list[0]?.batch ?? ""));
      })
      .catch(() => {
        if (!cancelled) setBatches([]);
      });
    vesselService
      .getVesselByCall(callId)
      .then((res) => {
        if (!cancelled) setVesselData(res?.data?.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setVesselData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [callId]);

  const crew = useMemo(
    () => batches.find((b) => b.batch === activeBatch)?.crew ?? [],
    [batches, activeBatch]
  );

  const autoValues = useMemo(() => {
    const today = new Date();
    const arrivalKey = ARRIVAL_DATE_KEYS.find((k) => vesselData?.[k]);
    return {
      ...(vesselData ?? {}),
      batch_no: batchNumber(activeBatch),
      hijri_date: formatHijriDate(today),
      gregorian_date: formatGregorianDate(today),
      vessel_name: vesselData?.vessel_name ?? "",
      last_port_country: vesselData?.last_port_country ?? vesselData?.arriving_from ?? "",
      arrival_date_hijri: arrivalKey ? formatHijriFromValue(vesselData[arrivalKey]) : "",
      crew_count: String(crew.length),
    };
  }, [vesselData, activeBatch, crew.length]);

  return (
    <div className={`gro-crew-imm-form${isControlled ? "" : " gro-crew-immigration-panel"}`}>
      {!isControlled && batches.length > 0 ? (
        <div className="gro-crew-immigration-toolbar">
          <div className="gro-pass-segments" role="tablist" aria-label="Batch">
            {batches.map((b) => (
              <div key={b.batch} className="gro-pass-segment-wrap">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeBatch === b.batch}
                  className={`gro-pass-segment${activeBatch === b.batch ? " gro-pass-segment--active" : ""}`}
                  onClick={() => setActiveBatch(b.batch)}
                >
                  {b.batch}
                </button>
                <span className="gro-pass-segment-count">{b.crew.length}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {templatesLoading ? (
        <div role="status" aria-live="polite">
          <span className="visually-hidden">Loading Crew Immigration templates…</span>
          {[0, 1].map((i) => (
            <section key={i} className="gro-crew-imm-form-section" aria-hidden="true">
              <div className="gro-crew-imm-form-section-head">
                <span className="gro-skeleton gro-skel-title" />
                <span className="gro-skeleton gro-skel-text" style={{ width: "34%", marginTop: 6 }} />
              </div>
              <div className="gro-crew-immigration-bulk-body">
                <div className="gro-crew-immigration-bulk-left">
                  <div className="gro-crew-immigration-bulk-table-wrap">
                    <table className="gro-crew-immigration-bulk-table">
                      <tbody>
                        <GroFieldTableSkeletonRows rows={6} />
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="gro-crew-immigration-bulk-right">
                  <GroLetterPreviewSkeleton />
                </div>
              </div>
            </section>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <p className="gro-crew-immigration-bulk-empty">No Crew Immigration templates configured for this port.</p>
      ) : (
        templates.map(({ key, template }) => (
          <CrewImmigrationTemplateSection
            key={key}
            template={template}
            autoValues={autoValues}
            crew={crew}
          />
        ))
      )}
    </div>
  );
}

CrewImmigrationFormView.propTypes = {
  portId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  callId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  activeBatch: PropTypes.string,
};
