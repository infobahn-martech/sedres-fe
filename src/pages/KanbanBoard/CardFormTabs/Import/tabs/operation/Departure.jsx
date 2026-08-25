import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import GroupSettingsIcon from "../../../../../../assets/images/cv.png";
import { buildDepartureReportBody } from "../../services/sendReportBodyBuilder";
import { ensureHtmlForQuill, resolveReportBodyHtml } from "./operationReportMessageHtml";
import { notify } from "../../../../../../components/Toaster";
import appointmentAcceptanceService from "../../../../../../services/appointmentAcceptanceService";
import useArrivalReducer from "../../../../../../store/ArrivalReducer";
import useDepartureReducer from "../../../../../../store/DepartureReducer";
import { OPERATION_STAGE_IDS } from "./operationConstants";
import { extractReportTemplateFields } from "./operationReportTemplate";
import {
  applyDepartureGetDetailToForm,
  extractDepartureReportDraftFromDetail,
} from "./departureDetailApply";
import {
  AdditionalTimeObjectAddButton,
  AdditionalTimeObjectsFields,
  appendAdditionalTimeObject,
  commitAdditionalTimeObject,
  DynamicDateTimeFields,
  extractUploadedAttachments,
  FormField,
  FormInput,
  FormSection,
  FormSelect,
  getAttachmentFile,
  mapAttachmentsForSave,
  OperationEmailPreviewPanel,
  OperationFileUpload,
  OperationFormCard,
  OperationSaveSection,
  persistAdditionalTimeObjects,
  refreshAdditionalTimeObjectsByCall,
  useApplyStageTimeObjectValues,
  validateAdditionalTimeObjects,
} from "./components/OperationCommon";

const DEPARTURE_REPORT_TYPE_ID = 5;

const CLEARANCE_DELIVERED_BY_OPTIONS = [
  { value: "By Email", label: "By Email" },
  { value: "By Launch", label: "By Launch" },
];

function Departure({
  formValues,
  handleChange,
  cardColor,
  onSendReport,
  isViewOnly = false,
  eventFields = [],
  callId = "",
  portId = "",
  callTypeId = "",
  billingEntityId,
  stageId = OPERATION_STAGE_IDS.DEPARTURE,
  canAddTimeObject = true,
  canDeleteTimeObject = true,
  canPreviewEmail = true,
  canSendReport = true,
}) {
  const saveCallTimeObjectAction = useArrivalReducer((s) => s.saveCallTimeObject);
  const getTimeObjectsByCallAction = useArrivalReducer((s) => s.getTimeObjectsByCall);
  const deleteCallTimeObjectAction = useArrivalReducer((s) => s.deleteCallTimeObject);
  const fetchDepartureDetail = useDepartureReducer((s) => s.fetchDepartureDetail);
  const saveDepartureDetailAction = useDepartureReducer((s) => s.saveDepartureDetail);
  const [reportDraft, setReportDraft] = useState({
    from: "operations@shipping.com",
    to: "",
    cc: "",
    subject: "Report - Departure",
    message: "",
  });
  const [isSavingDeparture, setIsSavingDeparture] = useState(false);
  const reportDraftFromDetailRef = useRef(false);

  const resolvedCallId = String(
    callId || formValues?.call_id || formValues?.callId || ""
  ).trim();

  const outwardClearanceIssuedIndex = (Array.isArray(eventFields) ? eventFields : []).findIndex(
    (field) => String(field?.event_name || "").trim().toLowerCase() === "outward clearance issued"
  );
  const eventFieldsBeforeClearanceDelivered =
    outwardClearanceIssuedIndex === -1 ? eventFields : eventFields.slice(0, outwardClearanceIssuedIndex + 1);
  const eventFieldsAfterClearanceDelivered =
    outwardClearanceIssuedIndex === -1 ? [] : eventFields.slice(outwardClearanceIssuedIndex + 1);

  useApplyStageTimeObjectValues(eventFields, formValues, handleChange);

  const handleDepartureDocumentsAdd = (files) => {
    if (files.length > 0) {
      const currentAttachments = formValues.departureAttachments || [];
      const updatedAttachments = [...currentAttachments, ...files];
      const syntheticEvent = { target: { value: updatedAttachments } };
      handleChange("departureAttachments")(syntheticEvent);
    }
  };

  const handleDepartureReportAttachmentsAdd = (files) => {
    if (files.length > 0) {
      const currentAttachments = formValues.departureReportAttachments || [];
      const updatedAttachments = [...currentAttachments, ...files];
      handleChange("departureReportAttachments")({ target: { value: updatedAttachments } });
    }
  };

  const handleDepartureReportAttachmentsChange = (nextAttachments) => {
    handleChange("departureReportAttachments")({ target: { value: nextAttachments } });
  };

  useEffect(() => {
    setReportDraft((prev) => ({
      ...prev,
      message: ensureHtmlForQuill(buildDepartureReportBody(formValues)),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const departureEventFieldsApplyKey = (Array.isArray(eventFields) ? eventFields : [])
    .map((field) =>
      [field.keyPrefix, field.time_object_id ?? field.event_type_id ?? "", field.field_key ?? ""].join(":")
    )
    .join("|");

  useEffect(() => {
    reportDraftFromDetailRef.current = false;
  }, [resolvedCallId]);

  useEffect(() => {
    if (isViewOnly || !resolvedCallId) return undefined;

    let cancelled = false;

    const run = async () => {
      const detail = await fetchDepartureDetail({ callId: resolvedCallId });
      if (cancelled || !detail) return;

      applyDepartureGetDetailToForm({ responseBody: detail, eventFields, handleChange });

      const savedDraft = extractDepartureReportDraftFromDetail(detail);
      if (savedDraft) {
        reportDraftFromDetailRef.current = true;
        setReportDraft((prev) => ({
          ...prev,
          from: savedDraft.from || prev.from,
          to: savedDraft.to,
          cc: savedDraft.cc,
          subject: savedDraft.subject || prev.subject,
          message: savedDraft.message || prev.message,
        }));
        if (savedDraft.attachments.length) {
          handleChange("departureReportAttachments")({ target: { value: savedDraft.attachments } });
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- formValues / handleChange omitted to avoid refetch loops
  }, [resolvedCallId, isViewOnly, departureEventFieldsApplyKey, fetchDepartureDetail]);

  useEffect(() => {
    if (isViewOnly) return undefined;

    let cancelled = false;

    const loadDepartureTemplate = async () => {
      if (reportDraftFromDetailRef.current) return;

      const resolvedPortId = String(portId || formValues?.port_id || formValues?.portId || "").trim();
      const resolvedCallTypeId = String(
        callTypeId || formValues?.call_type_id || formValues?.typeOfCall || formValues?.callTypeId || ""
      ).trim();
      if (!resolvedCallId || !resolvedPortId || !resolvedCallTypeId) return;

      const timeObjects = buildDepartureTemplateTimeObjectsPayload();

      try {
        const response = await appointmentAcceptanceService.getArrivalTemplateByPortCallType({
          call_id: resolvedCallId,
          port_id: resolvedPortId,
          call_type_id: resolvedCallTypeId,
          report_type_id: DEPARTURE_REPORT_TYPE_ID,
          time_objects: timeObjects,
        });

        if (cancelled) return;
        const template = extractReportTemplateFields(response);

        setReportDraft((prev) => ({
          ...prev,
          from: template.from || prev.from,
          to: template.to || prev.to,
          cc: template.cc || prev.cc,
          subject: template.subject || prev.subject,
          message: template.message || prev.message,
        }));

        const templateAttachments = extractUploadedAttachments(template.attachments);
        const currentReportAttachments = formValues.departureReportAttachments || [];
        if (templateAttachments.length && !currentReportAttachments.length) {
          handleChange("departureReportAttachments")({ target: { value: templateAttachments } });
        }
      } catch {
        if (cancelled) return;
      }
    };

    loadDepartureTemplate();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedCallId, portId, callTypeId, isViewOnly, formValues]);

  const handleReportDraftChange = (field, value) => {
    setReportDraft((prev) => ({ ...prev, [field]: value }));
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

  const toDateTimeValue = (datePart, timePart) => {
    const dateValue = String(datePart || "").trim();
    const timeValue = String(timePart || "").trim();
    if (!dateValue || !timeValue) return "";
    return `${dateValue} ${timeValue}`;
  };

  const buildDepartureTimeObjectsPayload = () =>
    (Array.isArray(eventFields) ? eventFields : [])
      .map((field) => {
        const keyPrefix = field?.keyPrefix;
        if (!keyPrefix) return null;
        const timeObjectValue = toDateTimeValue(
          formValues?.[`${keyPrefix}Date`],
          formValues?.[`${keyPrefix}Time`]
        );
        if (!timeObjectValue) return null;
        const timeObjectId = field?.time_object_id ?? field?.event_type_id;
        if (timeObjectId == null || timeObjectId === "") return null;
        return {
          time_object_id: timeObjectId,
          time_object_value: `${timeObjectValue}:00`,
        };
      })
      .filter(Boolean);

  const buildDepartureTemplateTimeObjectsPayload = () =>
    (Array.isArray(eventFields) ? eventFields : [])
      .map((field) => {
        const keyPrefix = field?.keyPrefix;
        if (!keyPrefix) return null;
        const timeObjectValue = toDateTimeValue(
          formValues?.[`${keyPrefix}Date`],
          formValues?.[`${keyPrefix}Time`]
        );
        if (!timeObjectValue) return null;
        return {
          time_object_id: field?.time_object_id ?? field?.event_type_id ?? null,
          field_key: field?.field_key || field?.event_name || keyPrefix,
          time_object_value: timeObjectValue,
        };
      })
      .filter(Boolean);

  const saveDepartureData = async () => {
    const additionalValidation = validateAdditionalTimeObjects(
      formValues.departureAdditionalTimeObjects
    );
    if (!additionalValidation.valid) {
      notify(additionalValidation.message, "error");
      return false;
    }

    if (!resolvedCallId) {
      notify("Call ID is required to save Departure.", "error");
      return false;
    }

    const timeObjects = buildDepartureTimeObjectsPayload();
    const reportAttachmentsList = formValues.departureReportAttachments || [];
    const newReportAttachmentFiles = reportAttachmentsList.map(getAttachmentFile).filter(Boolean);
    const uploadedReportAttachments = mapAttachmentsForSave(reportAttachmentsList);

    const fd = new FormData();
    fd.append("call_id", String(resolvedCallId));
    fd.append("next_port", String(formValues?.nextPort || ""));
    fd.append("clearance_delivered_by", String(formValues?.clearance_delivered_by || "By Email"));
    fd.append("time_objects", JSON.stringify(timeObjects));
    fd.append(
      "departure_report",
      JSON.stringify({
        subject: reportDraft.subject ?? "",
        body: resolveReportBodyHtml(reportDraft.message, buildDepartureReportBody(formValues)) ?? "",
        to_email: reportDraft.to ?? "",
        from_email: reportDraft.from ?? "",
        cc_emails: reportDraft.cc ?? "",
        attachments: uploadedReportAttachments,
      })
    );
    newReportAttachmentFiles.forEach((file) => fd.append("attachments[]", file));

    const emailRequestDocFile = getAttachmentFile((formValues.departureAttachments || [])[0]);
    if (emailRequestDocFile) {
      fd.append("email_request_doc", emailRequestDocFile);
    }

    const createdBy = resolveCreatedBy();
    if (createdBy) {
      fd.append("created_by", createdBy);
    }

    try {
      await saveDepartureDetailAction({ formData: fd });
      try {
        await persistAdditionalTimeObjects({
          rows: formValues.departureAdditionalTimeObjects,
          callId: resolvedCallId,
          stageId,
          saveCallTimeObject: saveCallTimeObjectAction,
        });
      } catch (additionalError) {
        notify(
          additionalError?.response?.data?.message ||
          "Saved, but failed to save one or more additional time objects.",
          "warning"
        );
      }
      const detail = await fetchDepartureDetail({ callId: resolvedCallId });
      if (detail) {
        applyDepartureGetDetailToForm({ responseBody: detail, eventFields, handleChange });
      }
      notify("Departure saved successfully.", "success");
      return true;
    } catch (error) {
      notify(error?.response?.data?.message || "Failed to save Departure.", "error");
      return false;
    }
  };

  const handleCommitAdditionalTimeObject = async (row, index) => {
    if (!resolvedCallId) return;
    try {
      const newId = await commitAdditionalTimeObject({
        row,
        callId: resolvedCallId,
        stageId,
        saveCallTimeObject: saveCallTimeObjectAction,
      });
      const refreshedRows = await refreshAdditionalTimeObjectsByCall({
        callId: resolvedCallId,
        stageId,
        portId: formValues?.port_id ?? formValues?.portId ?? "",
        callTypeId:
          formValues?.call_type_id ??
          formValues?.typeOfCall ??
          formValues?.callTypeId ??
          "",
        getTimeObjectsByCall: getTimeObjectsByCallAction,
        currentRows: formValues.departureAdditionalTimeObjects || [],
        committedIndex: index,
      });
      if (refreshedRows) {
        handleChange("departureAdditionalTimeObjects")({ target: { value: refreshedRows } });
      } else if (newId != null && String(row?.id ?? "") !== String(newId)) {
        const rows = formValues.departureAdditionalTimeObjects || [];
        const next = rows.map((r, i) => (i === index ? { ...r, id: newId } : r));
        handleChange("departureAdditionalTimeObjects")({ target: { value: next } });
      }
    } catch (error) {
      notify(
        error?.response?.data?.message || "Failed to save time object.",
        "error"
      );
    }
  };

  const handleRemoveAdditionalTimeObject = async (row, index) => {
    const rows = formValues.departureAdditionalTimeObjects || [];
    const next = rows.filter((_, rowIndex) => rowIndex !== index);

    if (row?.id != null && String(row.id).trim() !== "" && resolvedCallId) {
      try {
        await deleteCallTimeObjectAction({
          timeObjectId: row.id,
          callId: resolvedCallId,
          stageId,
        });
        const refreshedRows = await refreshAdditionalTimeObjectsByCall({
          callId: resolvedCallId,
          stageId,
          portId: formValues?.port_id ?? formValues?.portId ?? "",
          callTypeId:
            formValues?.call_type_id ??
            formValues?.typeOfCall ??
            formValues?.callTypeId ??
            "",
          getTimeObjectsByCall: getTimeObjectsByCallAction,
          currentRows: next,
          committedIndex: -1,
        });
        if (refreshedRows) {
          handleChange("departureAdditionalTimeObjects")({ target: { value: refreshedRows } });
          return;
        }
      } catch (error) {
        notify(
          error?.response?.data?.message || "Failed to delete time object.",
          "error"
        );
        return;
      }
    }

    handleChange("departureAdditionalTimeObjects")({ target: { value: next } });
  };

  const handleSaveAndSendReport = async () => {
    setIsSavingDeparture(true);
    try {
      const saveResult = await saveDepartureData();
      if (!saveResult) return;

      await onSendReport?.({
        tabName: "Departure",
        call_id: resolvedCallId,
        from: reportDraft.from,
        to: reportDraft.to,
        cc: reportDraft.cc,
        subject: reportDraft.subject,
        body: resolveReportBodyHtml(reportDraft.message, buildDepartureReportBody(formValues)),
        attachments: formValues.departureReportAttachments || [],
      });
    } finally {
      setIsSavingDeparture(false);
    }
  };

  return (
    <div className="cardform-left-full" style={{ "--card-color": cardColor }}>
      <div className="operation-content-header">
        <h3 className="operation-content-title">Departure Information</h3>
      </div>
      <FormSection icon={GroupSettingsIcon} title="">
        <div className="operation-tab-layout">
          <div className="departure-form">
            <div className="operation-two-column-grid operation-two-column-grid--split-scroll">
              <OperationFormCard
                className="operation-form-column"
                topRightAction={
                  !isViewOnly ? (
                    <AdditionalTimeObjectAddButton
                      onClick={() =>
                        handleChange("departureAdditionalTimeObjects")({
                          target: {
                            value: appendAdditionalTimeObject(formValues.departureAdditionalTimeObjects),
                          },
                        })
                      }
                    />
                  ) : null
                }
              >
                <FormField label="Email Requested Accept">
                  <OperationFileUpload
                    files={formValues.departureAttachments || []}
                    onAddFiles={handleDepartureDocumentsAdd}
                    isViewOnly={isViewOnly}
                    ariaLabel="Upload departure documents"
                  />
                </FormField>

                <DynamicDateTimeFields
                  eventFields={eventFieldsBeforeClearanceDelivered}
                  formValues={formValues}
                  handleChange={handleChange}
                  isViewOnly={isViewOnly}
                />

                <FormField label="Outward Clearance Delivered">
                  <FormSelect
                    value={formValues.clearance_delivered_by || "By Email"}
                    onChange={handleChange("clearance_delivered_by")}
                    options={CLEARANCE_DELIVERED_BY_OPTIONS}
                    placeholder="Select..."
                    disabled={isViewOnly}
                  />
                </FormField>

                <DynamicDateTimeFields
                  eventFields={eventFieldsAfterClearanceDelivered}
                  formValues={formValues}
                  handleChange={handleChange}
                  isViewOnly={isViewOnly}
                />

                <FormField label="Next port">
                  <FormInput
                    type="text"
                    value={formValues.nextPort || ""}
                    onChange={handleChange("nextPort")}
                    placeholder="Enter next port..."
                    disabled={isViewOnly}
                  />
                </FormField>

                <AdditionalTimeObjectsFields
                  value={formValues.departureAdditionalTimeObjects || []}
                  onChange={(next) =>
                    handleChange("departureAdditionalTimeObjects")({ target: { value: next } })
                  }
                  onRemoveRow={handleRemoveAdditionalTimeObject}
                  onCommitRow={handleCommitAdditionalTimeObject}
                  isViewOnly={isViewOnly}
                  hideAddButton
                  canAdd={canAddTimeObject}
                  canDelete={canDeleteTimeObject}
                />

                <FormField label="Attachments">
                  <OperationFileUpload
                    files={formValues.departureReportAttachments || []}
                    onAddFiles={handleDepartureReportAttachmentsAdd}
                    isViewOnly={isViewOnly}
                    ariaLabel="Upload departure report attachments"
                  />
                </FormField>
              </OperationFormCard>
              {canPreviewEmail && (
                <OperationFormCard className="operation-email-column">
                  <OperationEmailPreviewPanel
                    from={reportDraft.from}
                    to={reportDraft.to}
                    cc={reportDraft.cc}
                    subject={reportDraft.subject}
                    message={reportDraft.message}
                    attachments={formValues.departureReportAttachments || []}
                    onAttachmentsChange={handleDepartureReportAttachmentsChange}
                    billingEntityId={billingEntityId ?? formValues.mainBillingEntity}
                    onChange={handleReportDraftChange}
                    onSend={handleSaveAndSendReport}
                    isSending={isSavingDeparture}
                    isViewOnly={isViewOnly}
                    canSend={canSendReport}
                  />
                </OperationFormCard>
              )}
            </div>
          </div>
          <OperationSaveSection isViewOnly={isViewOnly} onSave={handleSaveAndSendReport} isSaving={isSavingDeparture} />
        </div>
      </FormSection>
    </div>
  );
}

Departure.propTypes = {
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
  cardColor: PropTypes.string,
  onAddLink: PropTypes.func,
  onRemoveLink: PropTypes.func,
  onSendReport: PropTypes.func,
  isViewOnly: PropTypes.bool,
  eventFields: PropTypes.array,
  callId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  portId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  callTypeId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  billingEntityId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  stageId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  canAddTimeObject: PropTypes.bool,
  canDeleteTimeObject: PropTypes.bool,
  canPreviewEmail: PropTypes.bool,
  canSendReport: PropTypes.bool,
};

export default Departure;
