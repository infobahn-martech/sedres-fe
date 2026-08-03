import { useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import { format, isValid, parseISO } from "date-fns";
import GroupSettingsIcon from "../../../../../../../assets/images/cv.png";
import { FormSection } from "./Husbandry.components";
import HusbandryServiceRequestsTable from "./HusbandryServiceRequestsTable";
import useLaunchHireServiceReducer from "../../../../../../../store/LaunchHireServiceReducer";
import { SERVICE_ACCENT } from "./Husbandry.constants";

const LAUNCH_HIRE_ACCENT = SERVICE_ACCENT.LAUNCH_HIRE;

// booking_datetime comes back as "YYYY-MM-DD HH:mm:ss" — same raw shape the
// read-only item_type listings on the TaxiBoat board parse (see TaxiBoatCardView).
const formatBookingDateTime = (value) => {
  if (!value) return "";
  const normalized = typeof value === "string" ? value.replace(" ", "T") : value;
  const parsed = typeof value === "string" ? parseISO(normalized) : new Date(value);
  return isValid(parsed) ? format(parsed, "dd/MM/yyyy HH:mm") : "";
};

const humanizeItemType = (value) =>
  value
    ? String(value)
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : "";

const summarizeBatches = (batches) => {
  if (!Array.isArray(batches) || batches.length === 0) return "";
  const types = [...new Set(batches.map((b) => humanizeItemType(b?.item_type)).filter(Boolean))];
  if (types.length === 0) return `${batches.length} item${batches.length > 1 ? "s" : ""}`;
  return batches.length > 1 ? `${types.join(", ")} (${batches.length})` : types.join(", ");
};

// operator/fleet/captain naming (operator_name/taxi_boat_name/captain_name) matches
// the shared launch_hire booking-detail shape used by the TaxiBoat board.
const LAUNCH_HIRE_REQUEST_COLUMNS = [
  { key: "location", header: "Location", accessor: (r) => r?.location },
  { key: "booking_datetime", header: "Booking Date & Time", accessor: (r) => formatBookingDateTime(r?.booking_datetime) },
  { key: "status", header: "Status", accessor: (r) => r?.status, type: "status" },
  { key: "operator", header: "Operator", accessor: (r) => r?.operator?.operator_name ?? r?.operator?.name },
  { key: "fleet", header: "Fleet", accessor: (r) => r?.fleet?.taxi_boat_name ?? r?.fleet?.name },
  { key: "captain", header: "Captain", accessor: (r) => r?.captain?.captain_name ?? r?.captain?.name },
  { key: "batches", header: "Items", accessor: (r) => summarizeBatches(r?.batches) },
];

const LaunchHireContent = ({ formValues, cardColor }) => {
  const callId = formValues.call_id || formValues.callId || formValues.card_call_id;
  const { launchHireRequests, isLoadingRequests, getLaunchHireRequests } = useLaunchHireServiceReducer();

  useEffect(() => {
    void getLaunchHireRequests(callId);
  }, [callId, getLaunchHireRequests]);

  // Table's row-key/pagination-signature logic falls back to `id`/`request_id` —
  // map the booking's real id onto `id` so pagination resets correctly on refetch.
  const launchHireRequestRows = useMemo(
    () => launchHireRequests.map((row) => ({ ...row, id: row?.launch_hire_booking_id ?? row?.id })),
    [launchHireRequests]
  );

  return (
    <div className="cardform-left-full launchhire-booking" style={{ "--card-color": cardColor }}>
      <FormSection icon={GroupSettingsIcon} title="">
        <div className="pre-arrival-form launchhire-form">
          <HusbandryServiceRequestsTable
            title="Launch Hire Requests"
            requests={launchHireRequestRows}
            loading={isLoadingRequests}
            columns={LAUNCH_HIRE_REQUEST_COLUMNS}
            serviceType="LAUNCH_HIRE"
            emptyMessage="No launch hire requests found"
            accent={LAUNCH_HIRE_ACCENT}
          />
        </div>
      </FormSection>
    </div>
  );
};

LaunchHireContent.propTypes = {
  formValues: PropTypes.object.isRequired,
  cardColor: PropTypes.string,
};

export default LaunchHireContent;
