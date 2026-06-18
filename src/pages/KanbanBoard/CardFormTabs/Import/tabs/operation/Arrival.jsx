import { useState, useEffect, useMemo, useRef } from "react";
import PropTypes from "prop-types";
import GroupSettingsIcon from "../../../../../../assets/images/cv.png";
import { notify } from "../../../../../../components/Toaster";
import { buildArrivalReportBody, buildArrivalDailyReportBody } from "../../services/sendReportBodyBuilder";
import appointmentAcceptanceService from "../../../../../../services/appointmentAcceptanceService";
import useArrivalReducer from "../../../../../../store/ArrivalReducer";
import DateTimePickerField from "../../../shared/components/DateTimePickerField";
import {
  AdditionalTimeObjectAddButton,
  AdditionalTimeObjectsFields,
  appendAdditionalTimeObject,
  buildAdditionalTimeObjectsPayload,
  DynamicDateTimeFields,
  FormField,
  FormSection,
  FormSelect,
  FormTextarea,
  OperationEmailPreviewPanel,
  OperationFormCard,
  OperationSaveSection,
  validateAdditionalTimeObjects,
} from "./components/OperationCommon";
import { extractReportTemplateFields } from "./operationReportTemplate";
import { ensureHtmlForQuill, resolveReportBodyHtml } from "./operationReportMessageHtml";
import {
  applyArrivalGetDetailToForm,
  extractArrivalReportDraftFromDetail,
} from "./arrivalDetailApply";
import { isEventFieldRequired } from "./operationConstants";

const ARRIVAL_CUSTOMS_FIELD_KEYS = new Set(["ATA", "CIC", "CIC_1"]);
const ARRIVAL_IMMIGRATION_FIELD_KEYS = new Set(["CIC_2", "CIC_3"]);

const FALLBACK_ARRIVAL_TIME_OBJECT_FIELDS = [
  {
    event_name: "Actual Time of Arrival",
    keyPrefix: "actualArrival",
    time_object_id: 11,
    field_key: "ATA",
    is_required: "0",
    sort_order: 1,
  },
  {
    event_name: "Custom Inspection Commenced",
    keyPrefix: "customInspectionCommenced",
    time_object_id: 9,
    field_key: "CIC",
    sort_order: 2,
  },
  {
    event_name: "Custom Inspection Completed",
    keyPrefix: "customInspectionCompleted",
    time_object_id: 10,
    field_key: "CIC_1",
    sort_order: 3,
  },
  {
    event_name: "Crew Immigration Commenced",
    keyPrefix: "crewImmigrationCommenced",
    time_object_id: 12,
    field_key: "CIC_2",
    sort_order: 4,
  },
  {
    event_name: "Crew Immigration Completed",
    keyPrefix: "crewImmigrationCompleted",
    time_object_id: 20,
    field_key: "CIC_3",
    sort_order: 5,
  },
];

const resolveArrivalTimeObjectFields = (apiFields = []) => {
  const source =
    Array.isArray(apiFields) && apiFields.length ? apiFields : FALLBACK_ARRIVAL_TIME_OBJECT_FIELDS;
  return [...source].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
};

const splitArrivalTimeObjectFields = (fields = []) => {
  const hasFieldKeys = fields.some((field) => String(field?.field_key || "").trim());
  if (hasFieldKeys) {
    return {
      customs: fields.filter((field) =>
        ARRIVAL_CUSTOMS_FIELD_KEYS.has(String(field?.field_key || "").toUpperCase())
      ),
      immigration: fields.filter((field) =>
        ARRIVAL_IMMIGRATION_FIELD_KEYS.has(String(field?.field_key || "").toUpperCase())
      ),
    };
  }
  return {
    customs: fields.slice(0, 3),
    immigration: fields.slice(3, 5),
  };
};

function Arrival({
  formValues,
  handleChange,
  cardColor,
  isViewOnly = false,
  arrivalStageFields = [],
  callId = "",
  portId = "",
  callTypeId = "",
}) {
  const resolveFormId = (...values) => {
    for (const value of values) {
      if (value === undefined || value === null) continue;
      const normalized = String(value).trim();
      if (normalized) return normalized;
    }
    return "";
  };

  const toDateTimeValue = (datePart, timePart) => {
    const dateValue = String(datePart || "").trim();
    const timeValue = String(timePart || "").trim();
    if (!dateValue || !timeValue) return "";
    return `${dateValue} ${timeValue}`;
  };

  const isValidEmailList = (value = "") => {
    const emails = String(value)
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean);

    if (!emails.length) return false;

    return emails.every((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  };

  const buildTimeObjectsPayload = (eventFields, values) =>
    (Array.isArray(eventFields) ? eventFields : [])
      .map((field) => {
        const keyPrefix = field?.keyPrefix;
        if (!keyPrefix) return null;
        const timeObjectValue = toDateTimeValue(values?.[`${keyPrefix}Date`], values?.[`${keyPrefix}Time`]);
        if (!timeObjectValue) return null;
        return {
          time_object_id: field?.time_object_id ?? field?.event_type_id ?? null,
          field_key: field?.field_key || field?.event_name || keyPrefix,
          time_object_value: timeObjectValue,
        };
      })
      .filter(Boolean);

  const buildSaveTimeObjectsPayload = (eventFields, values) =>
    (Array.isArray(eventFields) ? eventFields : [])
      .map((field) => {
        const keyPrefix = field?.keyPrefix;
        if (!keyPrefix) return null;
        const timeObjectValue = toDateTimeValue(values?.[`${keyPrefix}Date`], values?.[`${keyPrefix}Time`]);
        if (!timeObjectValue) return null;
        const timeObjectId = field?.time_object_id ?? field?.event_type_id;
        if (timeObjectId == null || timeObjectId === "") return null;
        return {
          time_object_id: timeObjectId,
          time_object_value: timeObjectValue,
        };
      })
      .filter(Boolean);

  const renderDateTimeField = (label, keyPrefix, required = false) => (
    <FormField
      key={keyPrefix}
      label={required ? `${label} *` : label}
      className="cf-field-full"
    >
      <DateTimePickerField
        dateValue={formValues[`${keyPrefix}Date`] || ""}
        timeValue={formValues[`${keyPrefix}Time`] || ""}
        onDateChange={handleChange(`${keyPrefix}Date`)}
        onTimeChange={handleChange(`${keyPrefix}Time`)}
        dateFieldName={`${keyPrefix}Date`}
        timeFieldName={`${keyPrefix}Time`}
        disabled={isViewOnly}
      />
    </FormField>
  );

  const resolveCreatedBy = () => {
    if (typeof window === "undefined") return "";
    return String(
      localStorage.getItem("userid") ||
      localStorage.getItem("user_id") ||
      localStorage.getItem("userId") ||
      ""
    ).trim();
  };

  const [reportDraft, setReportDraft] = useState({
    reportType: "arrival",
    from: "operations@shipping.com",
    to: "",
    cc: "",
    subject: "Report - Arrival",
    message: "",
  });
  const fetchArrivalDetail = useArrivalReducer((s) => s.fetchArrivalDetail);
  const saveArrivalDetailAction = useArrivalReducer((s) => s.saveArrivalDetail);
  const sendArrivalReportAction = useArrivalReducer((s) => s.sendArrivalReport);
  const isSavingArrival = useArrivalReducer((s) => s.isSavingArrival);
  const isSendingArrivalReport = useArrivalReducer((s) => s.isSendingArrivalReport);
  const emailPreviewFromDetailRef = useRef(false);

  const arrivalTimeObjectFields = useMemo(
    () => resolveArrivalTimeObjectFields(arrivalStageFields),
    [arrivalStageFields]
  );
  const { customs: arrivalCustomsTimeFields, immigration: arrivalImmigrationTimeFields } = useMemo(
    () => splitArrivalTimeObjectFields(arrivalTimeObjectFields),
    [arrivalTimeObjectFields]
  );

  const customInspectionStatusOptions = [
    { value: "Passed", label: "Passed" },
    { value: "On Hold", label: "On Hold" },
    { value: "Failed", label: "Failed" },
  ];
  const crewImmigrationStatusOptions = [
    { value: "Completed", label: "Completed" },
    { value: "Pending", label: "Pending" },
  ];

  const showCustomInspectionRemarks =
    formValues?.customInspectionStatus === "On Hold" ||
    formValues?.customInspectionStatus === "Failed";
  const showCrewImmigrationRemarks = formValues?.crewImmigrationStatus === "Pending";
  const showInwardClearanceTimestamp = formValues?.inwardClearanceStatus === "Received";

  const validateArrivalBeforeSave = () => {
    const resolvedCallId = resolveFormId(callId, formValues?.call_id, formValues?.callId);
    if (!resolvedCallId) {
      notify("Call ID is required to save Arrival.", "error");
      return false;
    }

    for (const field of arrivalTimeObjectFields) {
      if (!isEventFieldRequired(field)) continue;
      const keyPrefix = field?.keyPrefix;
      if (!keyPrefix) continue;
      const dateValue = String(formValues?.[`${keyPrefix}Date`] || "").trim();
      const timeValue = String(formValues?.[`${keyPrefix}Time`] || "").trim();
      if (!dateValue || !timeValue) {
        notify(`${field.event_name || "Required date/time field"} is required.`, "error");
        return false;
      }
    }

    if (showCustomInspectionRemarks) {
      const remarks = String(formValues?.customsRemarks || "").trim();
      if (!remarks) {
        notify("Custom Inspection Remarks is required when status is On Hold or Failed.", "error");
        return false;
      }
    }

    if (showCrewImmigrationRemarks) {
      const remarks = String(formValues?.crewImmigrationHoldRemarks || "").trim();
      if (!remarks) {
        notify("Crew Immigration Remarks is required when status is Pending.", "error");
        return false;
      }
    }

    if (showInwardClearanceTimestamp) {
      const date = String(formValues?.inwardClearanceReceivedDate || "").trim();
      const time = String(formValues?.inwardClearanceReceivedTime || "").trim();
      if (!date || !time) {
        notify(
          "Inward Clearance Received Timestamp is required when Inward Clearance is Received.",
          "error"
        );
        return false;
      }
    }

    const additionalValidation = validateAdditionalTimeObjects(formValues.arrivalAdditionalTimeObjects);
    if (!additionalValidation.valid) {
      notify(additionalValidation.message, "error");
      return false;
    }

    return true;
  };

  const handleReportDraftChange = (field, value) => {
    setReportDraft((prev) => ({ ...prev, [field]: value }));
  };

  const getArrivalMessage = (reportType) =>
    ensureHtmlForQuill(
      reportType === "daily" ? buildArrivalDailyReportBody(formValues) : buildArrivalReportBody(formValues)
    );

  useEffect(() => {
    setReportDraft((prev) => ({
      ...prev,
      message: getArrivalMessage(prev.reportType),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const arrivalEventFieldsApplyKey = arrivalTimeObjectFields
    .map((field) =>
      [field.keyPrefix, field.time_object_id ?? field.event_type_id ?? "", field.field_key ?? ""].join(":")
    )
    .join("|");

  useEffect(() => {
    emailPreviewFromDetailRef.current = false;
  }, [callId]);

  useEffect(() => {
    if (isViewOnly) return undefined;
    const resolvedCallId = resolveFormId(callId, formValues?.call_id, formValues?.callId);
    if (!resolvedCallId) return undefined;

    let cancelled = false;

    const run = async () => {
      const detail = await fetchArrivalDetail({ callId: resolvedCallId });
      if (cancelled || !detail) return;

      applyArrivalGetDetailToForm({
        responseBody: detail,
        arrivalEventFields: arrivalTimeObjectFields,
        postArrivalEventFields: [],
        handleChange,
      });

      const savedDraft = extractArrivalReportDraftFromDetail(detail);
      if (savedDraft) {
        emailPreviewFromDetailRef.current = true;
        setReportDraft((prev) => ({
          ...prev,
          reportType: savedDraft.reportType || prev.reportType,
          from: savedDraft.from || prev.from,
          to: savedDraft.to,
          cc: savedDraft.cc,
          subject: savedDraft.subject || prev.subject,
          message: savedDraft.message || prev.message,
        }));
      }
    };

    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- formValues / handleChange omitted to avoid refetch loops
  }, [callId, isViewOnly, arrivalEventFieldsApplyKey, fetchArrivalDetail]);

  useEffect(() => {
    let cancelled = false;

    const loadArrivalTemplate = async () => {
      if (reportDraft.reportType !== "arrival") return;
      if (emailPreviewFromDetailRef.current) return;

      const resolvedCallId = resolveFormId(callId, formValues?.call_id, formValues?.callId);
      const resolvedPortId = resolveFormId(portId, formValues?.port_id, formValues?.portId);
      const resolvedCallTypeId = resolveFormId(callTypeId, formValues?.call_type_id, formValues?.typeOfCall, formValues?.callTypeId);
      if (!resolvedCallId || !resolvedPortId || !resolvedCallTypeId) return;

      const timeObjects = buildTimeObjectsPayload(arrivalTimeObjectFields, formValues);

      try {
        const response = await appointmentAcceptanceService.getArrivalTemplateByPortCallType({
          call_id: resolvedCallId,
          port_id: resolvedPortId,
          call_type_id: resolvedCallTypeId,
          report_type_id: 4,
          time_objects: timeObjects,
        });

        if (cancelled) return;
        const template = extractReportTemplateFields(response);

        setReportDraft((prev) => ({
          ...prev,
          subject: template.subject || prev.subject,
          message: template.message || prev.message,
        }));
      } catch (error) {
        if (cancelled) return;
        console.error("[Operation] arrival/get_template_by_port_calltype failed", error);
      }
    };

    loadArrivalTemplate();

    return () => {
      cancelled = true;
    };
  }, [callId, portId, callTypeId, formValues, arrivalTimeObjectFields, reportDraft.reportType]);

  const handleReportTypeChange = (nextType) => {
    emailPreviewFromDetailRef.current = false;
    setReportDraft((prev) => ({
      ...prev,
      reportType: nextType,
      subject: nextType === "daily" ? "Report - Daily Arrival" : "Report - Arrival",
      message: getArrivalMessage(nextType),
    }));
  };

  const saveArrivalData = async () => {
    if (!validateArrivalBeforeSave()) return false;

    const resolvedCallId = resolveFormId(callId, formValues?.call_id, formValues?.callId);
    const saveTimeObjects = [
      ...buildSaveTimeObjectsPayload(arrivalTimeObjectFields, formValues),
      ...buildAdditionalTimeObjectsPayload(formValues.arrivalAdditionalTimeObjects),
    ];

    const fd = new FormData();
    fd.append("call_id", String(resolvedCallId));
    fd.append("time_objects", JSON.stringify(saveTimeObjects));
    fd.append("customs_status", String(formValues?.customInspectionStatus || ""));
    fd.append("customs_remarks", String(formValues?.customsRemarks || ""));
    fd.append("immigration_status", String(formValues?.crewImmigrationStatus || ""));
    fd.append("immigration_remarks", String(formValues?.crewImmigrationHoldRemarks || ""));
    fd.append("inward_clearance_status", String(formValues?.inwardClearanceStatus || ""));
    fd.append(
      "inward_clearance_received_timestamp",
      toDateTimeValue(
        formValues?.inwardClearanceReceivedDate,
        formValues?.inwardClearanceReceivedTime
      )
    );
    fd.append(
      "mwp_applied",
      toDateTimeValue(formValues?.mwpAppliedDate, formValues?.mwpAppliedTime)
    );
    fd.append(
      "mwp_received",
      toDateTimeValue(formValues?.mwpReceivedDate, formValues?.mwpReceivedTime)
    );

    const createdBy = resolveCreatedBy();
    if (createdBy) {
      fd.append("created_by", createdBy);
    }

    const arrivalReportBody = resolveReportBodyHtml(
      reportDraft.message,
      reportDraft.reportType === "daily" ? buildArrivalDailyReportBody(formValues) : buildArrivalReportBody(formValues)
    );
    fd.append(
      "arrival_report",
      JSON.stringify({
        subject: reportDraft.subject ?? "",
        body: arrivalReportBody ?? "",
        to_email: reportDraft.to ?? "",
        from_email: reportDraft.from ?? "",
        cc_emails: reportDraft.cc ?? "",
      })
    );

    try {
      await saveArrivalDetailAction({ formData: fd });
      notify("Arrival saved successfully.", "success");
      return true;
    } catch (error) {
      notify(error?.response?.data?.message || "Failed to save Arrival.", "error");
      return false;
    }
  };

  const handleSaveAndSendReport = async () => {
    const resolvedCallId = resolveFormId(callId, formValues?.call_id, formValues?.callId);
    if (!resolvedCallId) {
      notify("Call ID is required to send report.", "error");
      return;
    }

    if (!String(reportDraft.to || "").trim()) {
      notify("Recipient email is required.", "error");
      return;
    }

    if (!isValidEmailList(reportDraft.to)) {
      notify("Please enter valid recipient email(s).", "error");
      return;
    }

    const reportTypeId = reportDraft.reportType === "daily" ? 3 : 4;
    const createdBy = resolveCreatedBy();
    const body = resolveReportBodyHtml(
      reportDraft.message,
      reportDraft.reportType === "daily" ? buildArrivalDailyReportBody(formValues) : buildArrivalReportBody(formValues)
    );
    const from = String(reportDraft.from ?? "").trim();
    const to = String(reportDraft.to ?? "").trim();
    const cc = String(reportDraft.cc ?? "").trim();
    const subject = String(reportDraft.subject ?? "").trim();

    try {
      await sendArrivalReportAction({
        payload: {
          call_id: resolvedCallId,
          report_type_id: reportTypeId,
          from,
          to,
          cc,
          from_email: from,
          to_email: to,
          cc_emails: cc,
          subject,
          message: body,
          body,
          ...(createdBy ? { created_by: createdBy } : {}),
        },
      });
      notify(
        `${reportDraft.reportType === "daily" ? "Daily" : "Arrival"} report sent successfully.`,
        "success"
      );
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Failed to send report.";
      notify(msg, "error");
    }
  };

  const handleSaveOnly = async () => {
    await saveArrivalData();
  };

  return (
    <div className="cardform-left-full" style={{ "--card-color": cardColor }}>
      <div className="operation-content-header">
        <h3 className="operation-content-title">Arrival Information</h3>
      </div>
      <FormSection icon={GroupSettingsIcon} title="">
        <div className="operation-tab-layout">
          <div className="arrival-form">
            <div className="operation-two-column-grid operation-two-column-grid--split-scroll">
              <OperationFormCard
                className="operation-form-column"
                topRightAction={
                  !isViewOnly ? (
                    <AdditionalTimeObjectAddButton
                      onClick={() =>
                        handleChange("arrivalAdditionalTimeObjects")({
                          target: {
                            value: appendAdditionalTimeObject(formValues.arrivalAdditionalTimeObjects),
                          },
                        })
                      }
                    />
                  ) : null
                }
              >
                <DynamicDateTimeFields
                  eventFields={arrivalCustomsTimeFields}
                  formValues={formValues}
                  handleChange={handleChange}
                  isViewOnly={isViewOnly}
                />

                <FormField label="Custom Inspection Status">
                  <FormSelect
                    value={formValues.customInspectionStatus || ""}
                    onChange={handleChange("customInspectionStatus")}
                    options={customInspectionStatusOptions}
                    placeholder="Select status..."
                    disabled={isViewOnly}
                  />
                </FormField>

                {showCustomInspectionRemarks && (
                  <FormField label="Custom Inspection Remarks *" className="cf-field-full">
                    <FormTextarea
                      value={formValues.customsRemarks || ""}
                      onChange={handleChange("customsRemarks")}
                      placeholder="Specify remarks..."
                      rows={3}
                      disabled={isViewOnly}
                    />
                  </FormField>
                )}

                <DynamicDateTimeFields
                  eventFields={arrivalImmigrationTimeFields}
                  formValues={formValues}
                  handleChange={handleChange}
                  isViewOnly={isViewOnly}
                />

                <FormField label="Crew Immigration Status">
                  <FormSelect
                    value={formValues.crewImmigrationStatus || ""}
                    onChange={handleChange("crewImmigrationStatus")}
                    options={crewImmigrationStatusOptions}
                    placeholder="Select status..."
                    disabled={isViewOnly}
                  />
                </FormField>

                {showCrewImmigrationRemarks && (
                  <FormField label="Crew Immigration Remarks *" className="cf-field-full">
                    <FormTextarea
                      value={formValues.crewImmigrationHoldRemarks || ""}
                      onChange={handleChange("crewImmigrationHoldRemarks")}
                      placeholder="Specify remarks..."
                      rows={3}
                      disabled={isViewOnly}
                    />
                  </FormField>
                )}

                <FormField label="Inward Clearance">
                  <div className="operation-inline-radio-row">
                    <label className="operation-inline-radio">
                      <input
                        type="radio"
                        name="inwardClearanceStatus"
                        value="Received"
                        checked={formValues.inwardClearanceStatus === "Received"}
                        onChange={handleChange("inwardClearanceStatus")}
                        disabled={isViewOnly}
                      />
                      <span>Received</span>
                    </label>
                    <label className="operation-inline-radio">
                      <input
                        type="radio"
                        name="inwardClearanceStatus"
                        value="Not Received"
                        checked={formValues.inwardClearanceStatus === "Not Received"}
                        onChange={handleChange("inwardClearanceStatus")}
                        disabled={isViewOnly}
                      />
                      <span>Not Received</span>
                    </label>
                  </div>
                </FormField>

                {showInwardClearanceTimestamp &&
                  renderDateTimeField("Inward Clearance Received Timestamp", "inwardClearanceReceived", true)}

                {renderDateTimeField("MWP Applied", "mwpApplied")}
                {renderDateTimeField("MWP Received", "mwpReceived")}

                <AdditionalTimeObjectsFields
                  value={formValues.arrivalAdditionalTimeObjects || []}
                  onChange={(next) =>
                    handleChange("arrivalAdditionalTimeObjects")({ target: { value: next } })
                  }
                  isViewOnly={isViewOnly}
                  hideAddButton
                />
              </OperationFormCard>
              <OperationFormCard className="operation-email-column">
                <OperationEmailPreviewPanel
                  reportType={reportDraft.reportType}
                  reportTypeOptions={[
                    { value: "arrival", label: "Arrival Report" },
                    { value: "daily", label: "Daily Report" },
                  ]}
                  from={reportDraft.from}
                  to={reportDraft.to}
                  cc={reportDraft.cc}
                  subject={reportDraft.subject}
                  message={reportDraft.message}
                  attachments={[]}
                  onChange={handleReportDraftChange}
                  onReportTypeChange={handleReportTypeChange}
                  onSend={handleSaveAndSendReport}
                  isSending={isSendingArrivalReport || isSavingArrival}
                  isViewOnly={isViewOnly}
                />
              </OperationFormCard>
            </div>
          </div>
          <OperationSaveSection isViewOnly={isViewOnly} onSave={handleSaveOnly} isSaving={isSavingArrival} />
        </div>
      </FormSection>
    </div>
  );
}

Arrival.propTypes = {
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
  cardColor: PropTypes.string,
  onAddLink: PropTypes.func,
  onRemoveLink: PropTypes.func,
  isViewOnly: PropTypes.bool,
  arrivalStageFields: PropTypes.array,
  callId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  portId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  callTypeId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default Arrival;
