import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";
import { FiEye } from "react-icons/fi";
import {
  getOptionLabel,
  formatDateTime,
  splitApiDateTimeValue,
  firstNonEmptyString,
} from "./generalHelpers";

const APPOINTMENT_TYPE_LABELS = {
  tug: "Taxi Tug",
  tug_and_barge: "Tug and barge",
  taxi_tug_and_barge: "Taxi tug and barge",
  vessel: "Vessel",
};

const openAppointmentEmail = (url) => {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
};

// Reveals each detail box with a fade/slide-in the first time it scrolls into view.
const DetailBox = ({ title, children }) => {
  const boxRef = useRef(null);
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    const node = boxRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setIsRevealed(true);
      return undefined;
    }

    const fallbackTimer = window.setTimeout(() => setIsRevealed(true), 900);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsRevealed(true);
          observer.disconnect();
          window.clearTimeout(fallbackTimer);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  return (
    <div ref={boxRef} className={`detail-box ${isRevealed ? "detail-box--revealed" : ""}`}>
      <div className="detail-box-header">
        <span className="detail-box-title">{title}</span>
      </div>
      <div className="detail-box-body">{children}</div>
    </div>
  );
};

DetailBox.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node,
};

const isEmptyDetailValue = (value) =>
  value === undefined ||
  value === null ||
  value === "" ||
  (Array.isArray(value) && value.length === 0);

const DetailRow = ({ label, value, span = false }) => (
  <div className={`detail-row ${span ? "detail-row--span" : ""}`}>
    <span className="detail-row-label">{label}</span>
    <div className="detail-row-value">
      {isEmptyDetailValue(value) ? <span className="detail-row-empty">Not set</span> : value}
    </div>
  </div>
);

DetailRow.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.node,
  span: PropTypes.bool,
};

const DetailSubsectionTitle = ({ children }) => (
  <div className="detail-subsection-title">{children}</div>
);

DetailSubsectionTitle.propTypes = {
  children: PropTypes.node.isRequired,
};

const DetailChips = ({ items }) => {
  if (!items || items.length === 0) return <span className="detail-row-empty">Not set</span>;
  return (
    <div className="detail-chip-list">
      {items.map((item) => (
        <span key={item} className="detail-chip">
          {item}
        </span>
      ))}
    </div>
  );
};

DetailChips.propTypes = {
  items: PropTypes.arrayOf(PropTypes.string),
};

// Read-only, "detail box" presentation of the Appointment Details tab used in view mode
// (an existing call, not the Add Card flow). Mirrors the same field set/grouping as the
// editable form in General.jsx's default (non-simplified) branch, without input chrome.
function GeneralViewAppointmentDetails({
  getFieldValue,
  shouldShowApiField,
  ownerOptions,
  operatorOptions,
  portSelectOptions,
  callTypeOptions,
  billingEntitySelectOptions,
  singleVesselTypeOptions,
  tugTypeSelectOptions,
  bargeTypeSelectOptions,
  vesselNameOptions,
  tugVesselNameOptions,
  bargeVesselNameOptions,
  checklistOptions,
  viewModeTimeObjects,
  visibleDynamicEntityFields,
  entityFieldValues,
  appointmentEmailName,
  appointmentEmailUrl,
  isSingleVesselSection,
  isTugAndBargeSelected,
  dailyReportEmailOptions,
  billingInstructionType,
  billingInstructionEmailOptions,
}) {
  const selectedChecklists = Array.isArray(getFieldValue("selectedChecklists"))
    ? getFieldValue("selectedChecklists")
    : [];
  const checklistLabels = selectedChecklists
    .map((id) => getOptionLabel(checklistOptions, id) || String(id))
    .filter(Boolean);

  const bargeSelectedChecklists = Array.isArray(getFieldValue("bargeSelectedChecklists"))
    ? getFieldValue("bargeSelectedChecklists")
    : [];
  const bargeChecklistLabels = bargeSelectedChecklists
    .map((id) => getOptionLabel(checklistOptions, id) || String(id))
    .filter(Boolean);

  const dailyReportEmails = Array.isArray(getFieldValue("dailyReportEmail"))
    ? getFieldValue("dailyReportEmail")
    : [];
  const dailyReportEmailLabels = dailyReportEmails
    .map((id) => getOptionLabel(dailyReportEmailOptions, id) || String(id))
    .filter(Boolean);

  const billingInstructionEmails = Array.isArray(getFieldValue("billingInstructionEmails"))
    ? getFieldValue("billingInstructionEmails")
    : [];
  const billingInstructionEmailLabels = billingInstructionEmails
    .map((id) => getOptionLabel(billingInstructionEmailOptions, id) || String(id))
    .filter(Boolean);

  const appointmentTypeValue = getFieldValue("appointmentType");
  const appointmentTypeLabel = APPOINTMENT_TYPE_LABELS[appointmentTypeValue] || appointmentTypeValue;

  const vesselNameLabel =
    getOptionLabel(vesselNameOptions, getFieldValue("vesselName")) || getFieldValue("vesselName");
  const tugVesselNameLabel =
    getOptionLabel(tugVesselNameOptions, getFieldValue("tugVesselName")) || getFieldValue("tugVesselName");
  const bargeVesselNameLabel =
    getOptionLabel(bargeVesselNameOptions, getFieldValue("bargeVesselName")) ||
    getFieldValue("bargeVesselName");

  return (
    <div className="general-view-detail-boxes">
      <DetailBox title="Appointment Overview">
        {shouldShowApiField("owner_id") && (
          <DetailRow
            label="Owner"
            value={getOptionLabel(ownerOptions, getFieldValue("owner")) || getFieldValue("owner")}
          />
        )}
        {shouldShowApiField("appointment_email") && (
          <DetailRow
            label="Appointment Email"
            span
            value={
              appointmentEmailName ? (
                <div className="detail-attachment-row">
                  <span className="detail-attachment-name">{appointmentEmailName}</span>
                  <button
                    type="button"
                    className="detail-attachment-view-btn"
                    onClick={() => openAppointmentEmail(appointmentEmailUrl)}
                    disabled={!appointmentEmailUrl}
                    title={appointmentEmailUrl ? "View appointment email" : "File URL not available"}
                  >
                    <FiEye size={14} strokeWidth={2.2} aria-hidden />
                  </button>
                </div>
              ) : null
            }
          />
        )}
        {shouldShowApiField("appointment_type") && (
          <DetailRow label="Appointment Type" value={appointmentTypeLabel} />
        )}
        {shouldShowApiField("appointment_received_date") && (
          <DetailRow
            label="Appointment Received"
            value={formatDateTime(
              getFieldValue("appointmentReceivedDate"),
              getFieldValue("appointmentReceivedTime")
            )}
          />
        )}
      </DetailBox>

      <DetailBox title="Service Information">
        {shouldShowApiField("main_billing_entity_id") && (
          <DetailRow
            label="Call Type"
            value={getOptionLabel(
              callTypeOptions,
              firstNonEmptyString(getFieldValue("call_type_id"), getFieldValue("typeOfCall"))
            )}
          />
        )}
        {shouldShowApiField("main_billing_entity_id") && (
          <DetailRow label="Port" value={getOptionLabel(portSelectOptions, getFieldValue("port"))} />
        )}
        {viewModeTimeObjects.map((item) => {
          const parsed = splitApiDateTimeValue(item.value);
          return (
            <DetailRow key={item.key} label={item.label} value={formatDateTime(parsed.date, parsed.time)} />
          );
        })}
        {shouldShowApiField("main_billing_entity_id") && (
          <DetailRow label="Last Port" value={getFieldValue("lastPort")} />
        )}
        {visibleDynamicEntityFields.map((field) => (
          <DetailRow key={field.field_id} label={field.field_name} value={entityFieldValues[field.field_id]} />
        ))}
      </DetailBox>

      <DetailBox title="Vessel Information">
        {isSingleVesselSection ? (
          <>
            <DetailRow label="Vessel Type" value={getOptionLabel(singleVesselTypeOptions, getFieldValue("vesselType"))} />
            <DetailRow label="Vessel Name" value={vesselNameLabel} />
            <DetailRow
              label="Billing Entity"
              value={getOptionLabel(billingEntitySelectOptions, getFieldValue("vesselBillingEntity"))}
            />
            <DetailRow label="Vessel Owner" value={getFieldValue("vesselOwner")} />
            <DetailRow label="Vessel Charterer" value={getFieldValue("vesselPrincipal")} />
            <DetailRow label="Checklist" span value={<DetailChips items={checklistLabels} />} />
          </>
        ) : isTugAndBargeSelected ? (
          <>
            <DetailSubsectionTitle>Tug Information</DetailSubsectionTitle>
            <DetailRow label="Vessel Type" value={getOptionLabel(tugTypeSelectOptions, getFieldValue("tugType"))} />
            <DetailRow label="Vessel Name" value={tugVesselNameLabel} />
            <DetailRow
              label="Billing Entity"
              value={getOptionLabel(billingEntitySelectOptions, getFieldValue("tugBillingEntity"))}
            />
            <DetailRow label="Vessel Owner" value={getFieldValue("tugOwner")} />
            <DetailRow label="Vessel Charterer" value={getFieldValue("tugPrincipal")} />
            <DetailRow label="Vessel Manager" value={getFieldValue("tugManager")} />
            <DetailRow label="Checklist" span value={<DetailChips items={checklistLabels} />} />

            <DetailSubsectionTitle>Barge Information</DetailSubsectionTitle>
            <DetailRow label="Vessel Type" value={getOptionLabel(bargeTypeSelectOptions, getFieldValue("bargeType"))} />
            <DetailRow label="Vessel Name" value={bargeVesselNameLabel} />
            <DetailRow
              label="Billing Entity"
              value={getOptionLabel(billingEntitySelectOptions, getFieldValue("bargeBillingEntity"))}
            />
            <DetailRow label="Vessel Owner" value={getFieldValue("bargeOwner")} />
            <DetailRow label="Vessel Charterer" value={getFieldValue("bargePrincipal")} />
            <DetailRow label="Vessel Manager" value={getFieldValue("bargeManager")} />
            <DetailRow label="Checklist" span value={<DetailChips items={bargeChecklistLabels} />} />
          </>
        ) : null}

        <DetailRow label="Assigned Operator" value={getOptionLabel(operatorOptions, getFieldValue("assignedOperator"))} />
        <DetailRow label="Service Requestor Name" value={getFieldValue("serviceRequestorName")} />
        <DetailRow label="Service Requestor Email" value={getFieldValue("serviceRequestorEmail")} />
        <DetailRow label="Daily Report Emails" span value={<DetailChips items={dailyReportEmailLabels} />} />
        {billingInstructionType ? <DetailRow label="Instruction Type" value={billingInstructionType} /> : null}
        <DetailRow
          label="Billing Instructions"
          span
          value={
            String(billingInstructionType || "").toLowerCase() === "email" ? (
              <DetailChips items={billingInstructionEmailLabels} />
            ) : (
              getFieldValue("billingInstructions")
            )
          }
        />
      </DetailBox>
    </div>
  );
}

GeneralViewAppointmentDetails.propTypes = {
  getFieldValue: PropTypes.func.isRequired,
  shouldShowApiField: PropTypes.func.isRequired,
  ownerOptions: PropTypes.array,
  operatorOptions: PropTypes.array,
  portSelectOptions: PropTypes.array,
  callTypeOptions: PropTypes.array,
  billingEntitySelectOptions: PropTypes.array,
  singleVesselTypeOptions: PropTypes.array,
  tugTypeSelectOptions: PropTypes.array,
  bargeTypeSelectOptions: PropTypes.array,
  vesselNameOptions: PropTypes.array,
  tugVesselNameOptions: PropTypes.array,
  bargeVesselNameOptions: PropTypes.array,
  checklistOptions: PropTypes.array,
  viewModeTimeObjects: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string,
      label: PropTypes.string,
      value: PropTypes.string,
    })
  ),
  visibleDynamicEntityFields: PropTypes.array,
  entityFieldValues: PropTypes.object,
  appointmentEmailName: PropTypes.string,
  appointmentEmailUrl: PropTypes.string,
  isSingleVesselSection: PropTypes.bool,
  isTugAndBargeSelected: PropTypes.bool,
  dailyReportEmailOptions: PropTypes.array,
  billingInstructionType: PropTypes.string,
  billingInstructionEmailOptions: PropTypes.array,
};

export default GeneralViewAppointmentDetails;
