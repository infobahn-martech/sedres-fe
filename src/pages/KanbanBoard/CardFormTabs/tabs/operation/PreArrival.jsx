import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import GroupSettingsIcon from "../../../../../assets/images/cv.png";
import { notify } from "../../../../../components/Toaster";
import { buildPreArrivalReportBody } from "../../services/sendReportBodyBuilder";
import {
  DEFAULT_PRE_ARRIVAL_DOCUMENT_HANDLING,
  collectPreArrivalProcessAttachments,
  mergeChecklistItemsIntoDocumentHandling,
} from "./preArrivalDocumentHandling";
import preArrivalService from "../../../../../services/preArrivalService";
import appointmentAcceptanceService from "../../../../../services/appointmentAcceptanceService";
import coordinatesService from "../../../../../services/coordinatesService";
import {
  BAD_WEATHER,
  PRE_ARRIVAL_CUSTOM_CLEARANCE_ROLE_ID,
  PRE_ARRIVAL_GRO_ROLE_ID,
  PRE_ARRIVAL_SABER_STATUS_OPTIONS,
  PRE_ARRIVAL_SABER_STATUS_SAVE_VALUE,
  PRE_ARRIVAL_WEATHER_FORECAST_OPTIONS,
  PRE_ARRIVAL_WEATHER_FORECAST_SAVE_VALUE,
  SABER_APPLIED_BY_SEDRES,
} from "./operationConstants";
import {
  DynamicDateTimeFields,
  FormField,
  FormInput,
  FormSection,
  FormSelect,
  OperationEmailPreviewPanel,
  OperationFileUpload,
  OperationFormCard,
  OperationSaveSection,
} from "./components/OperationCommon";
import { extractReportTemplateFields } from "./operationReportTemplate";
import { ensureHtmlForQuill, resolveReportBodyHtml } from "./operationReportMessageHtml";
import {
  applyPreArrivalGetDetailToForm,
  findTaskDocumentGroupByRole,
  mergePreArrivalDetailDocuments,
} from "./preArrivalDetailApply";

const IconEye = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
  </svg>
);

function openAttachmentPreview(attachment) {
  const raw = attachment?.file;
  if (raw instanceof Blob) {
    const url = URL.createObjectURL(raw);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  const link = attachment?.url || attachment?.attachment;
  if (typeof link === "string" && /^https?:\/\//i.test(link)) {
    window.open(link, "_blank", "noopener,noreferrer");
    return;
  }
  console.log("Preview document:", attachment?.name);
}

const DOC_STATUS_NOT_UPLOADED = 0;
const DOC_STATUS_UPLOADED = 1;
const DOC_STATUS_VERIFIED = 2;
const DOC_STATUS_REUPLOAD = 3;
const DOC_STATUS_REJECTED = 4;

const CompactFileUploadRow = ({
  label,
  files = [],
  status = null,
  remarks = null,
}) => {
  const hasFiles = (files || []).length > 0;
  const displayLabel = String(label || "").trim() || "Document";
  // Missing status from get_documents_by_role: treat as Not uploaded for UI actions when no files,
  // or as Uploaded when local/attached files exist (preview). Never use Number(null) — that is 0.
  const statusIsEmpty =
    status === null ||
    status === undefined ||
    status === "" ||
    (typeof status === "string" && status.trim() === "");
  const parsedStatus =
    statusIsEmpty || !Number.isFinite(Number(status)) ? null : Number(status);
  const rowStatus =
    parsedStatus !== null
      ? parsedStatus
      : hasFiles
        ? DOC_STATUS_UPLOADED
        : DOC_STATUS_NOT_UPLOADED;
  const isNotUploaded = rowStatus === DOC_STATUS_NOT_UPLOADED;
  const isUploaded = rowStatus === DOC_STATUS_UPLOADED;
  const isVerified = rowStatus === DOC_STATUS_VERIFIED;
  const isReupload = rowStatus === DOC_STATUS_REUPLOAD;
  const isRejected = rowStatus === DOC_STATUS_REJECTED;
  const canPreview = hasFiles;
  const statusLabel = isNotUploaded
    ? "Not uploaded"
    : isUploaded
      ? "Uploaded"
      : isVerified
        ? "Verified"
        : isReupload
          ? "Re-upload"
          : isRejected
            ? "Rejected"
            : "";
  const statusClass = isNotUploaded
    ? "document-row-status-chip--not-uploaded"
    : isUploaded
      ? "document-row-status-chip--uploaded"
      : isVerified
        ? "document-row-status-chip--verified"
        : isReupload
          ? "document-row-status-chip--reupload"
          : isRejected
            ? "document-row-status-chip--rejected"
            : "";

  return (
    <div className="document-row compact-file-upload-row">
      <div className="document-row-name compact-file-upload-label">
        <div className="compact-file-upload-label-top">
          <span className="compact-file-upload-title" title={displayLabel}>
            {displayLabel}
          </span>

          <div className="compact-file-upload-right">
            {statusLabel ? (
              <span className={`document-row-status-chip ${statusClass}`}>
                {statusLabel}
              </span>
            ) : null}

            {!isNotUploaded && (
              <button
                type="button"
                className="document-row-icon-btn"
                onClick={() => openAttachmentPreview(files[0])}
                title="Preview"
                disabled={!canPreview}
              >
                <IconEye />
              </button>
            )}
          </div>
        </div>
        {/* {showUploadedFileName ? (
          <div className="compact-file-upload-filename" title={secondaryFileName}>
            {secondaryFileName}
          </div>
        ) : null} */}
        {remarks && String(remarks).trim() ? (
          <div className="compact-file-upload-remarks" title={String(remarks)}>
            {String(remarks)}
          </div>
        ) : null}
      </div>
    </div>
  );
};

CompactFileUploadRow.propTypes = {
  label: PropTypes.string.isRequired,
  files: PropTypes.array,
  status: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  remarks: PropTypes.string,
};

const SaberUploadBox = ({ files = [], onAddFiles, isViewOnly = false }) => {
  return (
    <OperationFileUpload
      files={files}
      onAddFiles={onAddFiles}
      isViewOnly={isViewOnly}
      ariaLabel="Upload SABER certificate files"
    />
  );
};

SaberUploadBox.propTypes = {
  files: PropTypes.array,
  onAddFiles: PropTypes.func.isRequired,
  isViewOnly: PropTypes.bool,
};

function DocumentGroupCard({ title, children }) {
  return (
    <div className="document-group-card">
      <h4 className="document-group-card__title">{title}</h4>
      <div className="document-group-card__body">{children}</div>
    </div>
  );
}

DocumentGroupCard.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

function PreArrivalDocumentHandlingSection({ formValues }) {
  const dh = formValues.preArrivalDocumentHandling || DEFAULT_PRE_ARRIVAL_DOCUMENT_HANDLING;
  const stageFiles = Array.isArray(dh.stageFiles) ? dh.stageFiles : [];
  const roleGroups = Array.isArray(dh.roleGroups) ? dh.roleGroups : [];

  return (
    <div className="document-handling-section">
      {stageFiles.length > 0 && (
        <div className="document-handling-stage-docs" role="region" aria-label="Stage documents">
          <h4 className="document-group-card__title">Stage documents</h4>
          <ul className="document-stage-file-list">
            {stageFiles.map((f, idx) => (
              <li key={`${f.stage_document_id ?? idx}-${f.name}`}>
                {f.url ? (
                  <a href={f.url} target="_blank" rel="noopener noreferrer">
                    {f.name}
                  </a>
                ) : (
                  <span>{f.name}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="document-handling-header-row" role="group" aria-label="Document handling">
        <h3 className="document-handling-section__heading">Document handling</h3>
      </div>

      {roleGroups.map((group) => {
        const title = String(group?.role_name || "Documents").trim();
        const cardTitle = /documents?$/i.test(title) ? title : `${title} documents`;
        return (
          <DocumentGroupCard key={`role-${group?.role_id ?? title}`} title={cardTitle}>
            {(group?.items || []).map((doc) => (
              <CompactFileUploadRow
                key={`${group?.role_id ?? title}-${doc.id}`}
                label={doc.document_name || doc.name}
                files={doc.files || []}
                status={doc.status}
                remarks={doc.remarks}
              />
            ))}
          </DocumentGroupCard>
        );
      })}
    </div>
  );
}

PreArrivalDocumentHandlingSection.propTypes = {
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
  isViewOnly: PropTypes.bool,
  portId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  callId: PropTypes.string,
  assigneeHints: PropTypes.shape({
    gro: PropTypes.shape({
      value: PropTypes.string,
      label: PropTypes.string,
      roleId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    }),
    customClearance: PropTypes.shape({
      value: PropTypes.string,
      label: PropTypes.string,
      roleId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    }),
  }),
  detailDocSkip: PropTypes.shape({
    groUserId: PropTypes.string,
    customUserId: PropTypes.string,
    groHasDocs: PropTypes.bool,
    customHasDocs: PropTypes.bool,
  }),
};

function PreArrival({
  card,
  formValues,
  handleChange,
  cardColor,
  isViewOnly = false,
  eventFields = [],
  portId,
  callTypeId,
  vesselTypeId,
}) {
  const [isSavingPreArrival, setIsSavingPreArrival] = useState(false);
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [isLoadingCoordinateTypes, setIsLoadingCoordinateTypes] = useState(false);
  const [isLoadingCoordinates, setIsLoadingCoordinates] = useState(false);
  const [coordinateTypeOptions, setCoordinateTypeOptions] = useState([]);
  const [coordinateOptions, setCoordinateOptions] = useState([]);
  const [reportDraft, setReportDraft] = useState({
    from: "operations@shipping.com",
    to: "",
    cc: "",
    subject: "Report - Pre Arrival",
    message: "",
  });
  const emailPreviewFromDetailRef = useRef(false);
  const [preArrivalDetailAssigneeHints, setPreArrivalDetailAssigneeHints] = useState({
    gro: null,
    customClearance: null,
  });
  const [preArrivalDetailDocSkip, setPreArrivalDetailDocSkip] = useState({
    groUserId: null,
    customUserId: null,
    groHasDocs: false,
    customHasDocs: false,
  });
  const formValuesRef = useRef(formValues);
  const coordinatesFetchGenRef = useRef(0);
  const pendingCoordinateIdRef = useRef(null);
  const preArrivalDocumentsDetailRef = useRef({ taskDocuments: [], stageDocuments: [] });
  const checklistFetchKeyRef = useRef("");

  const callId = useMemo(
    () => String(card?.call_id ?? card?.callId ?? formValues?.call_id ?? formValues?.callId ?? card?.id ?? "").trim(),
    [card?.call_id, card?.callId, card?.id, formValues?.call_id, formValues?.callId]
  );

  const eventFieldsApplyKey = useMemo(
    () =>
      (eventFields || [])
        .map((f) =>
          [f.keyPrefix, f.event_type_id ?? f.time_object_id ?? "", f.event_name ?? ""].join(":")
        )
        .join("|"),
    [eventFields]
  );

  const resolveFormId = (...values) => {
    for (const value of values) {
      if (value === undefined || value === null) continue;
      const normalized = String(value).trim();
      if (normalized) return normalized;
    }
    return "";
  };

  const buildTemplateTimeObjectsPayload = (fields, values) =>
    (Array.isArray(fields) ? fields : [])
      .map((field) => {
        const keyPrefix = field?.keyPrefix;
        if (!keyPrefix) return null;

        const date = String(values?.[`${keyPrefix}Date`] || "").trim();
        const time = String(values?.[`${keyPrefix}Time`] || "").trim();
        if (!date || !time) return null;

        const timeObjectId =
          field?.time_object_id ??
          field?.event_type_id ??
          field?.eventTypeId ??
          field?.event_typeid ??
          field?.id ??
          null;
        if (timeObjectId == null || timeObjectId === "") return null;

        return {
          time_object_id: Number(timeObjectId),
          field_key: field?.field_key || field?.event_name || keyPrefix,
          time_object_value: `${date} ${time}:00`,
        };
      })
      .filter(Boolean);

  useEffect(() => {
    formValuesRef.current = formValues;
  }, [formValues]);

  useEffect(() => {
    pendingCoordinateIdRef.current = null;
    preArrivalDocumentsDetailRef.current = { taskDocuments: [], stageDocuments: [] };
    checklistFetchKeyRef.current = "";
    emailPreviewFromDetailRef.current = false;
    setPreArrivalDetailAssigneeHints({ gro: null, customClearance: null });
    setPreArrivalDetailDocSkip({
      groUserId: null,
      customUserId: null,
      groHasDocs: false,
      customHasDocs: false,
    });
  }, [callId]);

  const checklistRequestIds = useMemo(() => {
    const resolvedPortId = Number(
      resolveFormId(portId, formValues?.port_id, formValues?.portId, card?.port_id, card?.portId)
    );
    const resolvedCallTypeId = Number(
      resolveFormId(
        callTypeId,
        formValues?.call_type_id,
        formValues?.typeOfCall,
        formValues?.callTypeId,
        card?.call_type_id,
        card?.typeOfCall
      )
    );
    const resolvedVesselTypeId = Number(
      resolveFormId(
        vesselTypeId,
        formValues?.vesselType,
        formValues?.vessel_type_id,
        card?.vessel_type_id
      )
    );
    if (
      !Number.isFinite(resolvedPortId) ||
      resolvedPortId <= 0 ||
      !Number.isFinite(resolvedCallTypeId) ||
      resolvedCallTypeId <= 0 ||
      !Number.isFinite(resolvedVesselTypeId) ||
      resolvedVesselTypeId <= 0
    ) {
      return null;
    }
    return {
      port_id: resolvedPortId,
      call_type_id: resolvedCallTypeId,
      vessel_type_id: resolvedVesselTypeId,
      key: `${resolvedPortId}|${resolvedCallTypeId}|${resolvedVesselTypeId}`,
    };
  }, [
    portId,
    callTypeId,
    vesselTypeId,
    formValues?.port_id,
    formValues?.portId,
    formValues?.call_type_id,
    formValues?.typeOfCall,
    formValues?.callTypeId,
    formValues?.vesselType,
    formValues?.vessel_type_id,
    card?.port_id,
    card?.portId,
    card?.call_type_id,
    card?.typeOfCall,
    card?.vessel_type_id,
  ]);

  const documentHandlingRowsKey = useMemo(() => {
    const dh = formValues.preArrivalDocumentHandling;
    const roleGroupKey = (dh?.roleGroups || [])
      .map((g) => `${g.role_id}:${(g.items || []).map((r) => r.id).join(",")}`)
      .join("|");
    return `${formValues.assignedGro || ""}|${formValues.assignedCustom || ""}|${roleGroupKey}`;
  }, [
    formValues.preArrivalDocumentHandling,
    formValues.assignedGro,
    formValues.assignedCustom,
  ]);

  const applyDetailDocuments = useCallback(() => {
    const { taskDocuments, stageDocuments } = preArrivalDocumentsDetailRef.current;
    if (!taskDocuments?.length && !stageDocuments?.length) return;
    const dhCurrent = formValuesRef.current?.preArrivalDocumentHandling;
    const nextDh = mergePreArrivalDetailDocuments(
      dhCurrent,
      taskDocuments || [],
      stageDocuments || []
    );
    if (!nextDh) return;
    if (JSON.stringify(nextDh) !== JSON.stringify(dhCurrent)) {
      handleChange("preArrivalDocumentHandling")({ target: { value: nextDh } });
    }
  }, [handleChange]);

  useEffect(() => {
    if (isViewOnly || !checklistRequestIds) return;

    const requestKey = checklistRequestIds.key;
    if (checklistFetchKeyRef.current === requestKey) return;

    const ac = new AbortController();
    let cancelled = false;

    const loadChecklistDocuments = async () => {
      try {
        const res = await preArrivalService.getChecklistItemsByRole({
          port_id: checklistRequestIds.port_id,
          call_type_id: checklistRequestIds.call_type_id,
          vessel_type_id: checklistRequestIds.vessel_type_id,
        });
        if (ac.signal.aborted || cancelled) return;

        const body = res?.data ?? res;
        const status = body?.status;
        if (typeof status === "string" && status.toLowerCase() === "error") return;

        const apiRoleGroups = body?.data ?? [];
        const dhCurrent = formValuesRef.current?.preArrivalDocumentHandling;
        const nextDh = mergeChecklistItemsIntoDocumentHandling(dhCurrent, apiRoleGroups);
        if (JSON.stringify(nextDh) === JSON.stringify(dhCurrent)) {
          checklistFetchKeyRef.current = requestKey;
          return;
        }

        handleChange("preArrivalDocumentHandling")({ target: { value: nextDh } });
        checklistFetchKeyRef.current = requestKey;
      } catch (error) {
        if (!ac.signal.aborted && !cancelled) {
          console.error("[Operation] pre_arrival/get_checklist_items_by_role failed", error);
        }
      }
    };

    loadChecklistDocuments();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [checklistRequestIds, isViewOnly, handleChange]);

  const fetchPreArrivalDetail = useCallback(
    async (abortSignal) => {
      if (isViewOnly || !callId) return;

      try {
        const res = await preArrivalService.getPreArrivalDetail(callId);
        if (abortSignal?.aborted) return;
        const body = res?.data ?? res;
        const status = body?.status;
        if (typeof status === "string" && status.toLowerCase() === "error") return;

        const root = body?.data ?? body ?? {};
        preArrivalDocumentsDetailRef.current = {
          taskDocuments: root.task_documents ?? root.taskDocuments ?? [],
          stageDocuments: root.stage_documents ?? root.stageDocuments ?? [],
        };

        const snapshot = formValuesRef.current;
        const { coordinatesId } = applyPreArrivalGetDetailToForm({
          responseBody: body,
          eventFields,
          handleChange,
          currentForm: snapshot,
        });
        if (coordinatesId && !String(snapshot.coordinateTypeId || "").trim()) {
          pendingCoordinateIdRef.current = coordinatesId;
        }

        const taskDocs = root.task_documents ?? root.taskDocuments ?? [];
        const groG = findTaskDocumentGroupByRole(taskDocs, PRE_ARRIVAL_GRO_ROLE_ID);
        const ccG = findTaskDocumentGroupByRole(taskDocs, PRE_ARRIVAL_CUSTOM_CLEARANCE_ROLE_ID);

        setPreArrivalDetailAssigneeHints({
          gro:
            groG?.user_id != null
              ? {
                value: String(groG.user_id),
                label: groG.name || `User ${groG.user_id}`,
                roleId: groG.role_id ?? PRE_ARRIVAL_GRO_ROLE_ID,
              }
              : null,
          customClearance:
            ccG?.user_id != null
              ? {
                value: String(ccG.user_id),
                label: ccG.name || `User ${ccG.user_id}`,
                roleId: ccG.role_id ?? PRE_ARRIVAL_CUSTOM_CLEARANCE_ROLE_ID,
              }
              : null,
        });

        setPreArrivalDetailDocSkip({
          groUserId: groG?.user_id != null ? String(groG.user_id) : null,
          customUserId: ccG?.user_id != null ? String(ccG.user_id) : null,
          groHasDocs: Boolean(groG?.documents?.length),
          customHasDocs: Boolean(ccG?.documents?.length),
        });

        const sent = root.sent_report ?? root.sentReport;
        if (sent != null && typeof sent === "object") {
          emailPreviewFromDetailRef.current = true;
          setReportDraft({
            from: sent.from_email != null ? String(sent.from_email) : "operations@shipping.com",
            to: sent.to_email != null ? String(sent.to_email) : "",
            cc:
              sent.cc_emails != null
                ? String(sent.cc_emails)
                : sent.cc_email != null
                  ? String(sent.cc_email)
                  : "",
            subject: sent.subject != null ? String(sent.subject) : "Report - Pre Arrival",
            message: sent.body != null ? ensureHtmlForQuill(String(sent.body)) : "",
          });
        } else {
          emailPreviewFromDetailRef.current = false;
        }

        applyDetailDocuments();
      } catch (error) {
        if (!abortSignal?.aborted) {
          console.error("[Operation] pre_arrival/get_prearrival_detail failed", error);
        }
        throw error;
      }
    },
    [callId, isViewOnly, eventFields, handleChange, applyDetailDocuments]
  );

  useEffect(() => {
    const ac = new AbortController();
    fetchPreArrivalDetail(ac.signal);
    return () => ac.abort();
  }, [callId, isViewOnly, eventFieldsApplyKey, fetchPreArrivalDetail]);

  useEffect(() => {
    if (isViewOnly) return;
    applyDetailDocuments();
  }, [documentHandlingRowsKey, isViewOnly, applyDetailDocuments]);

  useEffect(() => {
    const needId = pendingCoordinateIdRef.current;
    if (!needId || String(formValues.coordinateTypeId || "").trim() || !coordinateTypeOptions.length) {
      return;
    }

    let cancelled = false;

    const resolve = async () => {
      for (const opt of coordinateTypeOptions) {
        if (cancelled) return;
        try {
          const response = await coordinatesService.getCoordinatesByType({
            coordinate_type_id: opt.value,
          });
          const raw = response?.data?.data ?? response?.data ?? [];
          const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
          const found = list.some((item) => String(item.coordinates_id) === String(needId));
          if (found) {
            if (!cancelled) {
              handleChange("coordinateTypeId")({ target: { value: opt.value } });
              pendingCoordinateIdRef.current = null;
            }
            return;
          }
        } catch {
          /* try next coordinate type */
        }
      }
    };

    resolve();

    return () => {
      cancelled = true;
    };
  }, [coordinateTypeOptions, formValues.coordinateTypeId, handleChange]);

  const handleSaberUtAddFiles = (files) => {
    const currentAttachments = formValues.saberUtDocumentsAttachments || [];
    handleChange("saberUtDocumentsAttachments")({ target: { value: [...currentAttachments, ...files] } });
  };

  const handleSaberUtStatusChange = (e) => {
    const value = e.target.value;
    handleChange("saberUtStatus")(e);
    if (value !== SABER_APPLIED_BY_SEDRES) {
      handleChange("saberUtDocumentsAttachments")({ target: { value: [] } });
    }
  };

  const handleWeatherForecastChange = (e) => {
    const value = e.target.value;
    handleChange("weatherForecast")(e);

    if (value === BAD_WEATHER) {
      notify(
        "Bad weather selected. Please re-check ETA and clearance time objects.",
        "warning"
      );
      handleChange("preArrivalTimeObjectsNeedRecheck")({
        target: { value: true },
      });
    } else {
      handleChange("preArrivalTimeObjectsNeedRecheck")({
        target: { value: false },
      });
    }
  };

  const handlePreArrivalTimeObjectChange = useCallback(
    (fieldName) => (event) => {
      handleChange(fieldName)(event);
      if (formValues.preArrivalTimeObjectsNeedRecheck) {
        handleChange("preArrivalTimeObjectsNeedRecheck")({ target: { value: false } });
      }
    },
    [handleChange, formValues.preArrivalTimeObjectsNeedRecheck]
  );

  const fetchCoordinatesByType = useCallback(
    async (coordinateTypeId) => {
      if (!coordinateTypeId) {
        setCoordinateOptions([]);
        handleChange("coordinates")({ target: { value: "" } });
        handleChange("preArrivalCoordinatesId")({ target: { value: "" } });
        return;
      }

      const fetchId = ++coordinatesFetchGenRef.current;
      setIsLoadingCoordinates(true);
      try {
        const response = await coordinatesService.getCoordinatesByType({
          coordinate_type_id: coordinateTypeId,
        });
        if (fetchId !== coordinatesFetchGenRef.current) return;

        const raw = response?.data?.data ?? response?.data ?? [];
        const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
        const mapped = list
          .filter((item) => item?.coordinates_id != null && String(item.coordinates || "").trim())
          .map((item) => ({
            value: String(item.coordinates_id),
            label: String(item.coordinates).trim(),
          }));

        setCoordinateOptions(mapped);

        if (mapped.length === 0) {
          handleChange("preArrivalCoordinatesId")({ target: { value: "" } });
          handleChange("coordinates")({ target: { value: "" } });
          notify("No coordinates found for selected type.", "warning");
          return;
        }

        const latest = formValuesRef.current || {};
        const byId = mapped.find((o) => o.value === String(latest.preArrivalCoordinatesId || ""));
        const byCoords = mapped.find(
          (o) => o.label === String(latest.coordinates || "").trim()
        );
        const pick = byId || byCoords;
        if (pick) {
          handleChange("preArrivalCoordinatesId")({ target: { value: pick.value } });
          handleChange("coordinates")({ target: { value: pick.label } });
        }
      } catch (error) {
        if (fetchId !== coordinatesFetchGenRef.current) return;
        setCoordinateOptions([]);
        handleChange("coordinates")({ target: { value: "" } });
        handleChange("preArrivalCoordinatesId")({ target: { value: "" } });
        notify(error?.response?.data?.message || "Failed to fetch coordinates.", "error");
      } finally {
        if (fetchId === coordinatesFetchGenRef.current) {
          setIsLoadingCoordinates(false);
        }
      }
    },
    [handleChange]
  );

  useEffect(() => {
    let cancelled = false;

    const loadCoordinateTypes = async () => {
      setIsLoadingCoordinateTypes(true);
      try {
        const response = await coordinatesService.getAllCoordinateTypes();
        if (cancelled) return;
        const rawData = response?.data?.data ?? response?.data ?? [];
        const typeList = Array.isArray(rawData) ? rawData : rawData ? [rawData] : [];
        const mappedOptions = typeList
          .filter((item) => item?.coordinate_type_id != null)
          .map((item) => ({
            value: String(item.coordinate_type_id),
            label: String(item.coordinate_type || ""),
          }))
          .filter((option) => option.label.trim().length > 0);
        setCoordinateTypeOptions(mappedOptions);
      } catch (error) {
        if (cancelled) return;
        setCoordinateTypeOptions([]);
        notify(error?.response?.data?.message || "Failed to fetch coordinate types.", "error");
      } finally {
        if (!cancelled) {
          setIsLoadingCoordinateTypes(false);
        }
      }
    };

    loadCoordinateTypes();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!formValues.coordinateTypeId) {
      coordinatesFetchGenRef.current += 1;
      setCoordinateOptions([]);
      return;
    }
    fetchCoordinatesByType(formValues.coordinateTypeId);
  }, [formValues.coordinateTypeId, fetchCoordinatesByType]);

  const handleCoordinateTypeChange = (e) => {
    const selectedTypeId = e.target.value;
    handleChange("coordinateTypeId")({ target: { value: selectedTypeId } });
    handleChange("preArrivalCoordinatesId")({ target: { value: "" } });
    handleChange("coordinates")({ target: { value: "" } });
    if (!selectedTypeId) {
      coordinatesFetchGenRef.current += 1;
      setCoordinateOptions([]);
    }
  };

  const handleCoordinatesSelectChange = (e) => {
    const selectedId = e.target.value;
    handleChange("preArrivalCoordinatesId")({ target: { value: selectedId } });
    const opt = coordinateOptions.find((o) => o.value === selectedId);
    handleChange("coordinates")({ target: { value: opt?.label || "" } });
  };

  const savePreArrivalData = async () => {
    const callId = card?.call_id || card?.callId || formValues?.call_id || formValues?.callId || card?.id || "";

    if (!callId) {
      notify("Call ID is required.", "error");
      return false;
    }
    if (
      formValues.weatherForecast === BAD_WEATHER &&
      formValues.preArrivalTimeObjectsNeedRecheck === true
    ) {
      notify(
        "Bad weather is selected. Saving without re-checking ETA and clearance time objects.",
        "warning"
      );
    }

    const timeObjects = (eventFields || [])
      .map((field, index) => {
        const dateKey = `${field.keyPrefix}Date`;
        const timeKey = `${field.keyPrefix}Time`;

        const date = formValues[dateKey];
        const time = formValues[timeKey];

        if (!date || !time) return null;
        const timeObjectId =
          field.time_object_id ??
          field.event_type_id ??
          field.eventTypeId ??
          field.event_typeid ??
          field.id ??
          null;
        if (timeObjectId == null) {
          console.warn("[Operation] Missing time_object_id for event field", field, index);
          return null;
        }
        return {
          time_object_id: Number(timeObjectId),
          time_object_value: `${date} ${time}:00`,
        };
      })
      .filter(Boolean);

    const attachmentFile = (item) => {
      if (item?.file instanceof File) return item.file;
      if (item instanceof File) return item;
      return null;
    };

    const fd = new FormData();
    fd.append("call_id", callId);
    fd.append("time_objects", JSON.stringify(timeObjects));
    const saberStatusNum = PRE_ARRIVAL_SABER_STATUS_SAVE_VALUE[formValues.saberUtStatus];
    fd.append(
      "saber_status",
      saberStatusNum != null ? String(saberStatusNum) : ""
    );
    const weatherForecastNum = PRE_ARRIVAL_WEATHER_FORECAST_SAVE_VALUE[formValues.weatherForecast];
    fd.append(
      "weather_forecast",
      weatherForecastNum != null ? String(weatherForecastNum) : ""
    );
    const coordinatesId = String(formValues.preArrivalCoordinatesId || "").trim();
    if (coordinatesId) {
      fd.append("coordinates_id", coordinatesId);
    }

    if (formValues.saberUtStatus === SABER_APPLIED_BY_SEDRES) {
      (formValues.saberUtDocumentsAttachments || []).forEach((item) => {
        const f = attachmentFile(item);
        if (f) {
          fd.append("saber_attachments[]", f);
        }
      });
    }

    const reportBody = resolveReportBodyHtml(reportDraft.message, buildPreArrivalReportBody(formValues));
    fd.append(
      "pre_arrival_report",
      JSON.stringify({
        subject: reportDraft.subject ?? "",
        body: reportBody ?? "",
        to_email: reportDraft.to ?? "",
        from_email: reportDraft.from ?? "",
        cc_emails: reportDraft.cc ?? "",
      })
    );

    for (let pair of fd.entries()) {
      console.log(pair[0], pair[1]);
    }

    try {
      setIsSavingPreArrival(true);
      await preArrivalService.savePreArrival(fd);
      try {
        await fetchPreArrivalDetail();
      } catch (refreshError) {
        notify(
          refreshError?.response?.data?.message ||
          "Saved, but failed to refresh Pre Arrival details.",
          "warning"
        );
      }
      notify("Pre Arrival saved successfully.", "success");
      return true;
    } catch (error) {
      notify(error?.response?.data?.message || "Failed to save Pre Arrival.", "error");
      return false;
    } finally {
      setIsSavingPreArrival(false);
    }
  };

  const preArrivalReportAttachments = [
    ...(formValues.saberUtDocumentsAttachments || []),
    ...collectPreArrivalProcessAttachments(formValues.preArrivalDocumentHandling),
  ];

  useEffect(() => {
    setReportDraft((prev) => ({
      ...prev,
      message: ensureHtmlForQuill(buildPreArrivalReportBody(formValues)),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadReportTemplate = async () => {
      if (emailPreviewFromDetailRef.current) return;

      const resolvedCallId = resolveFormId(callId, formValues?.call_id, formValues?.callId);
      const resolvedPortId = resolveFormId(portId, formValues?.port_id, formValues?.portId);
      const resolvedCallTypeId = resolveFormId(
        callTypeId,
        formValues?.call_type_id,
        formValues?.typeOfCall,
        formValues?.callTypeId
      );
      if (!resolvedCallId || !resolvedPortId || !resolvedCallTypeId) return;

      const timeObjects = buildTemplateTimeObjectsPayload(eventFields, formValues);

      try {
        const response = await appointmentAcceptanceService.getTemplateByPortCallType({
          call_id: resolvedCallId,
          port_id: resolvedPortId,
          call_type_id: resolvedCallTypeId,
          report_type_id: 2,
          time_objects: timeObjects,
        });
        if (cancelled) return;
        if (emailPreviewFromDetailRef.current) return;

        const template = extractReportTemplateFields(response);
        setReportDraft((prev) => ({
          ...prev,
          from: template.from || prev.from,
          subject: template.subject || prev.subject,
          message: template.message || prev.message,
        }));
      } catch (error) {
        if (cancelled) return;
        console.error("[Operation] report_template/get_template_by_port_calltype failed", error);
      }
    };

    loadReportTemplate();

    return () => {
      cancelled = true;
    };
  }, [callId, portId, callTypeId, formValues, eventFieldsApplyKey]);

  const handleReportDraftChange = (field, value) => {
    setReportDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleSendPreArrivalReport = async () => {
    if (!callId) {
      notify("Call ID is required to send the report.", "error");
      return;
    }

    const body = resolveReportBodyHtml(reportDraft.message, buildPreArrivalReportBody(formValues));

    setIsSendingReport(true);
    try {
      await preArrivalService.sendPreArrivalReport({
        call_id: callId,
        report_type_id: 2,
        from_email: String(reportDraft.from ?? "").trim(),
        to_email: String(reportDraft.to ?? "").trim(),
        cc_emails: String(reportDraft.cc ?? "").trim(),
        subject: String(reportDraft.subject ?? "").trim(),
        body,
      });
      notify("Pre Arrival report sent successfully.", "success");
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Failed to send Pre Arrival report.";
      notify(msg, "error");
    } finally {
      setIsSendingReport(false);
    }
  };

  return (
    <div className="cardform-left-full" style={{ "--card-color": cardColor }}>
      <div className="operation-content-header">
        <h3 className="operation-content-title">Pre-Arrival Information</h3>
      </div>
      <FormSection icon={GroupSettingsIcon} title="">
        <div className="operation-tab-layout">
          <div className="pre-arrival-form operation-tab-scroll">
            <div className="operation-prearrival-grid">
              <OperationFormCard className="operation-form-column">
                <div
                  className={`prearrival-timeobject-highlight ${formValues.weatherForecast === BAD_WEATHER && formValues.preArrivalTimeObjectsNeedRecheck
                    ? "is-warning"
                    : ""
                    }`.trim()}
                >
                  <DynamicDateTimeFields
                    eventFields={eventFields}
                    formValues={formValues}
                    handleChange={handlePreArrivalTimeObjectChange}
                    isViewOnly={isViewOnly}
                  />
                </div>

                <FormField label="SABER Status">
                  <FormSelect
                    value={formValues.saberUtStatus || ""}
                    onChange={handleSaberUtStatusChange}
                    options={PRE_ARRIVAL_SABER_STATUS_OPTIONS}
                    placeholder="Select SABER status..."
                    disabled={isViewOnly}
                  />
                </FormField>

                {formValues.saberUtStatus === SABER_APPLIED_BY_SEDRES && (
                  <FormField label="SABER Certificate Upload">
                    <SaberUploadBox
                      files={formValues.saberUtDocumentsAttachments || []}
                      onAddFiles={handleSaberUtAddFiles}
                      isViewOnly={isViewOnly}
                    />
                  </FormField>
                )}

                <FormField label="Weather Forecast">
                  <FormSelect
                    value={formValues?.weatherForecast || ""}
                    onChange={handleWeatherForecastChange}
                    options={PRE_ARRIVAL_WEATHER_FORECAST_OPTIONS}
                    placeholder="Select weather forecast..."
                    disabled={isViewOnly}
                  />
                  {formValues.weatherForecast === BAD_WEATHER && (
                    <div className="prearrival-windy-map">
                      <iframe
                        title="Windy Weather Map"
                        width="650"
                        height="450"
                        src="https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=default&metricTemp=default&metricWind=default&zoom=8&overlay=wind&product=ecmwf&level=surface&lat=27.284&lon=49.109&detailLat=29.0525682775337&detailLon=48.087158203125&marker=true"
                        frameBorder="0"
                      />
                    </div>
                  )}
                </FormField>

                <FormField label="Coordinates Type">
                  <FormSelect
                    value={formValues?.coordinateTypeId || ""}
                    onChange={handleCoordinateTypeChange}
                    options={coordinateTypeOptions}
                    placeholder="Select coordinate type..."
                    disabled={isViewOnly || isLoadingCoordinateTypes || isLoadingCoordinates}
                  />
                </FormField>

                {formValues?.coordinateTypeId ? (
                  <FormField label="Select Coordinates">
                    <FormSelect
                      value={formValues?.preArrivalCoordinatesId || ""}
                      onChange={handleCoordinatesSelectChange}
                      options={coordinateOptions}
                      placeholder={
                        isLoadingCoordinates
                          ? "Loading coordinates..."
                          : coordinateOptions.length
                            ? "Select coordinates..."
                            : "No coordinates for this type"
                      }
                      disabled={
                        isViewOnly ||
                        isLoadingCoordinates ||
                        coordinateOptions.length === 0
                      }
                    />
                  </FormField>
                ) : (
                  !!formValues?.coordinates && (
                    <FormField label="Coordinates">
                      <FormInput
                        type="text"
                        value={formValues?.coordinates || ""}
                        onChange={() => { }}
                        placeholder="Coordinates will appear here..."
                        disabled
                      />
                    </FormField>
                  )
                )}
              </OperationFormCard>
              <OperationFormCard className="operation-document-column">
                <PreArrivalDocumentHandlingSection
                  formValues={formValues}
                  handleChange={handleChange}
                  isViewOnly={isViewOnly}
                  portId={portId}
                  callId={callId}
                  assigneeHints={preArrivalDetailAssigneeHints}
                  detailDocSkip={preArrivalDetailDocSkip}
                />
              </OperationFormCard>
              <OperationFormCard className="operation-email-column">
                <OperationEmailPreviewPanel
                  from={reportDraft.from}
                  to={reportDraft.to}
                  cc={reportDraft.cc}
                  subject={reportDraft.subject}
                  message={reportDraft.message}
                  attachments={preArrivalReportAttachments}
                  onChange={handleReportDraftChange}
                  onSend={handleSendPreArrivalReport}
                  isSending={isSendingReport || isSavingPreArrival}
                  isViewOnly={isViewOnly}
                />
              </OperationFormCard>
            </div>
          </div>
          <OperationSaveSection isViewOnly={isViewOnly} onSave={savePreArrivalData} isSaving={isSavingPreArrival} />
        </div>
      </FormSection>
    </div>
  );
}

PreArrival.propTypes = {
  card: PropTypes.object,
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
  ownerInitial: PropTypes.string.isRequired,
  cardUser: PropTypes.string,
  cardColor: PropTypes.string,
  onAddLink: PropTypes.func,
  onRemoveLink: PropTypes.func,
  isViewOnly: PropTypes.bool,
  eventFields: PropTypes.array,
  portId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  callTypeId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  vesselTypeId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default PreArrival;
