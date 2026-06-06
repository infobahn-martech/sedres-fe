import { useState, useEffect, useMemo, useRef } from "react";
import PropTypes from "prop-types";
import GroupSettingsIcon from "../../../../../assets/images/cv.png";
import { notify } from "../../../../../components/Toaster";
import { buildArrivalReportBody, buildArrivalDailyReportBody } from "../../services/sendReportBodyBuilder";
import appointmentAcceptanceService from "../../../../../services/appointmentAcceptanceService";
import useArrivalReducer from "../../../../../store/ArrivalReducer";
import {
  DynamicDateTimeFields,
  FormField,
  FormInput,
  FormSection,
  FormSelect,
  FormTextarea,
  OperationEmailPreviewPanel,
  OperationFileUpload,
  OperationFormCard,
  OperationSaveSection,
} from "./components/OperationCommon";
import { extractReportTemplateFields } from "./operationReportTemplate";
import { ensureHtmlForQuill, resolveReportBodyHtml } from "./operationReportMessageHtml";
import {
  applyArrivalGetDetailToForm,
  extractArrivalReportDraftFromDetail,
} from "./arrivalDetailApply";
import { isEventFieldRequired } from "./operationConstants";

function Arrival({
  formValues,
  handleChange,
  cardColor,
  isViewOnly = false,
  arrivalStageFields = [],
  postArrivalStageFields = [],
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

  const normalizeAttachmentFile = (fileLike) => {
    if (!fileLike) return null;
    if (fileLike instanceof File || fileLike instanceof Blob) return fileLike;
    if (fileLike?.file instanceof File || fileLike?.file instanceof Blob) return fileLike.file;
    return null;
  };

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

  const workflowStatusOptions = [
    { value: "Pending", label: "Pending" },
    { value: "Completed", label: "Completed" },
    { value: "On Hold", label: "On Hold" },
    { value: "Failed", label: "Failed" },
  ];
  const crewImmigrationStatusOptions = workflowStatusOptions;
  const customInspectionStatusOptions = [
    { value: "Pending", label: "Pending" },
    { value: "Passed", label: "Passed" },
    { value: "Failed", label: "Failed" },
  ];

  const postArrivalFieldsWithoutMwpExpiry = useMemo(
    () =>
      (Array.isArray(postArrivalStageFields) ? postArrivalStageFields : []).filter(
        (field) => field?.keyPrefix !== "marineWorkPermitExpires"
      ),
    [postArrivalStageFields]
  );

  const validateArrivalBeforeSave = () => {
    const resolvedCallId = resolveFormId(callId, formValues?.call_id, formValues?.callId);
    if (!resolvedCallId) {
      notify("Call ID is required to save Arrival.", "error");
      return false;
    }

    const allFields = [...arrivalStageFields, ...postArrivalStageFields];
    for (const field of allFields) {
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

    if (formValues?.customInspectionStatus === "Failed") {
      const failReason = String(formValues?.customInspectionFailReason || "").trim();
      if (!failReason) {
        notify("Custom inspection remark is required when status is Failed.", "error");
        return false;
      }
    }

    if (formValues?.crewImmigrationStatus === "On Hold") {
      const holdRemarks = String(formValues?.crewImmigrationHoldRemarks || "").trim();
      if (!holdRemarks) {
        notify("Crew immigration remark is required when status is On Hold.", "error");
        return false;
      }
    }

    return true;
  };

  const handleSingleArrivalFileAdd = (fieldKey) => (files) => {
    const nextFile = files?.[0] || null;
    handleChange(fieldKey)({ target: { value: nextFile ? [nextFile] : [] } });
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

  const arrivalEventFieldsApplyKey = useMemo(
    () =>
      [
        ...(Array.isArray(arrivalStageFields) ? arrivalStageFields : []),
        ...(Array.isArray(postArrivalStageFields) ? postArrivalStageFields : []),
      ]
        .map((f) =>
          [f?.keyPrefix, f?.event_type_id ?? f?.time_object_id ?? "", f?.event_name ?? ""].join(":")
        )
        .join("|"),
    [arrivalStageFields, postArrivalStageFields]
  );

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
        arrivalEventFields: arrivalStageFields,
        postArrivalEventFields: postArrivalStageFields,
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

      const timeObjects = buildTimeObjectsPayload([...arrivalStageFields, ...postArrivalStageFields], formValues);

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
  }, [callId, portId, callTypeId, formValues, arrivalStageFields, postArrivalStageFields, reportDraft.reportType]);

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
    const allFields = [...arrivalStageFields, ...postArrivalStageFields];
    const saveTimeObjects = buildSaveTimeObjectsPayload(allFields, formValues);
    const inwardDoc = normalizeAttachmentFile(formValues?.arrivalInwardClearanceDoc?.[0]);
    const mwpDoc = normalizeAttachmentFile(formValues?.arrivalMwpDoc?.[0]);
    const sadadDoc = normalizeAttachmentFile(formValues?.arrivalSadadDoc?.[0]);
    const initialBayanDoc = normalizeAttachmentFile(formValues?.arrivalInitialBayanDoc?.[0]);
    const finalBayanDoc = normalizeAttachmentFile(formValues?.arrivalFinalBayanDoc?.[0]);

    const fd = new FormData();
    fd.append("call_id", String(resolvedCallId));
    fd.append("time_objects", JSON.stringify(saveTimeObjects));
    fd.append("customs_status", String(formValues?.customInspectionStatus || ""));
    fd.append("immigration_status", String(formValues?.crewImmigrationStatus || ""));
    fd.append("immigration_remarks", String(formValues?.crewImmigrationHoldRemarks || ""));
    fd.append("inward_clearance_status", String(formValues?.inwardClearanceStatus || ""));
    fd.append("mwp_ticket_no", String(formValues?.mwpTicketNo || ""));
    fd.append("mwp_status", String(formValues?.mwpStatus || ""));
    fd.append("sadad_no", String(formValues?.sadadNo || ""));
    if (inwardDoc) fd.append("inward_clearance_doc", inwardDoc);
    if (mwpDoc) fd.append("mwp_doc", mwpDoc);
    if (sadadDoc) fd.append("sadad_doc", sadadDoc);
    if (initialBayanDoc) fd.append("initial_bayan_doc", initialBayanDoc);
    if (finalBayanDoc) fd.append("final_bayan_doc", finalBayanDoc);

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

  const arrivalPreviewAttachments = [
    ...(formValues.arrivalInwardClearanceDoc || []),
    ...(formValues.arrivalMwpDoc || []),
    ...(formValues.arrivalSadadDoc || []),
    ...(formValues.arrivalInitialBayanDoc || []),
    ...(formValues.arrivalFinalBayanDoc || []),
  ];

  return (
    <div className="cardform-left-full" style={{ "--card-color": cardColor }}>
      <div className="operation-content-header">
        <h3 className="operation-content-title">Arrival Information</h3>
      </div>
      <FormSection icon={GroupSettingsIcon} title="">
        <div className="operation-tab-layout">
          <div className="arrival-form">
            <div className="operation-two-column-grid operation-two-column-grid--split-scroll">
              <OperationFormCard className="operation-form-column">
                <OperationFormCard>
                  <DynamicDateTimeFields
                    eventFields={arrivalStageFields}
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

                  {formValues.customInspectionStatus === "Failed" && (
                    <FormField label="Custom Inspection Remark *" className="cf-field-full">
                      <FormTextarea
                        value={formValues.customInspectionFailReason || ""}
                        onChange={handleChange("customInspectionFailReason")}
                        placeholder="Specify remark..."
                        rows={3}
                        disabled={isViewOnly}
                      />
                    </FormField>
                  )}

                  <FormField label="Crew Immigration Status">
                    <FormSelect
                      value={formValues.crewImmigrationStatus || ""}
                      onChange={handleChange("crewImmigrationStatus")}
                      options={crewImmigrationStatusOptions}
                      placeholder="Select status..."
                      disabled={isViewOnly}
                    />
                  </FormField>

                  {formValues.crewImmigrationStatus === "On Hold" && (
                    <FormField label="Crew Immigration Remark *" className="cf-field-full">
                      <FormTextarea
                        value={formValues.crewImmigrationHoldRemarks || ""}
                        onChange={handleChange("crewImmigrationHoldRemarks")}
                        placeholder="Specify remark..."
                        rows={3}
                        disabled={isViewOnly}
                      />
                    </FormField>
                  )}

                  <FormField label="Inward Clearance Status">
                    <FormSelect
                      value={formValues.inwardClearanceStatus || ""}
                      onChange={handleChange("inwardClearanceStatus")}
                      options={workflowStatusOptions}
                      placeholder="Select status..."
                      disabled={isViewOnly}
                    />
                  </FormField>

                  <FormField label="MWP Ticket No">
                    <FormInput
                      value={formValues.mwpTicketNo || ""}
                      onChange={handleChange("mwpTicketNo")}
                      placeholder="Enter MWP ticket number"
                      disabled={isViewOnly}
                    />
                  </FormField>

                  <FormField label="MWP Status">
                    <FormSelect
                      value={formValues.mwpStatus || ""}
                      onChange={handleChange("mwpStatus")}
                      options={workflowStatusOptions}
                      placeholder="Select status..."
                      disabled={isViewOnly}
                    />
                  </FormField>

                  <FormField label="SADAD No">
                    <FormInput
                      value={formValues.sadadNo || ""}
                      onChange={handleChange("sadadNo")}
                      placeholder="Enter SADAD no"
                      disabled={isViewOnly}
                    />
                  </FormField>

                  <DynamicDateTimeFields
                    eventFields={postArrivalFieldsWithoutMwpExpiry}
                    formValues={formValues}
                    handleChange={handleChange}
                    isViewOnly={isViewOnly}
                  />
                </OperationFormCard>

                <FormField label="Inward Clearance Document">
                  <OperationFileUpload
                    files={formValues.arrivalInwardClearanceDoc || []}
                    onAddFiles={handleSingleArrivalFileAdd("arrivalInwardClearanceDoc")}
                    isViewOnly={isViewOnly}
                    ariaLabel="Upload inward clearance document"
                  />
                </FormField>
                <FormField label="MWP Document">
                  <OperationFileUpload
                    files={formValues.arrivalMwpDoc || []}
                    onAddFiles={handleSingleArrivalFileAdd("arrivalMwpDoc")}
                    isViewOnly={isViewOnly}
                    ariaLabel="Upload MWP document"
                  />
                </FormField>
                <FormField label="SADAD Document">
                  <OperationFileUpload
                    files={formValues.arrivalSadadDoc || []}
                    onAddFiles={handleSingleArrivalFileAdd("arrivalSadadDoc")}
                    isViewOnly={isViewOnly}
                    ariaLabel="Upload SADAD document"
                  />
                </FormField>
                <FormField label="Initial Bayan Document">
                  <OperationFileUpload
                    files={formValues.arrivalInitialBayanDoc || []}
                    onAddFiles={handleSingleArrivalFileAdd("arrivalInitialBayanDoc")}
                    isViewOnly={isViewOnly}
                    ariaLabel="Upload initial bayan document"
                  />
                </FormField>
                <FormField label="Final Bayan Document">
                  <OperationFileUpload
                    files={formValues.arrivalFinalBayanDoc || []}
                    onAddFiles={handleSingleArrivalFileAdd("arrivalFinalBayanDoc")}
                    isViewOnly={isViewOnly}
                    ariaLabel="Upload final bayan document"
                  />
                </FormField>
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
                  attachments={arrivalPreviewAttachments}
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
  postArrivalStageFields: PropTypes.array,
  callId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  portId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  callTypeId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default Arrival;
