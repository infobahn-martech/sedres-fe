/* eslint-disable no-unused-vars */
import { useState, useCallback, useEffect, useRef } from "react";
import { useCTPendingCards } from "../../../../../../shared/store/ctStore";
import { useTaxiBoatStore } from "../../../../../../shared/store/taxiBoatStore";
import useTaxiBoatAssignmentReducer from "../../../../../../store/TaxiBoatAssignmentReducer";
import useBillingEntityReducer from "../../../../../../store/BillingEntityReducer";
import useAuthReducer from "../../../../../../store/AuthReducer";
import useAlertReducer from "../../../../../../store/AlertReducer";
import launchHireService from "../../../../../../services/launchHireService";
import DateTimePickerField from "../../../../CardFormTabs/shared/components/DateTimePickerField";
import SearchableSelect from "../../../../../../components/form/SearchableSelect";
import { buildApiDateTime, splitApiDateTimeParts } from "../../../../../../shared/helpers/dateTimeFieldUtils";
import { formatGroDocumentDisplayName } from "../GRO/User/groCardUtils";
import PropTypes from "prop-types";
import { FiFlag, FiAnchor, FiNavigation, FiHome, FiArrowDown, FiArrowUp, FiArrowLeft, FiClock, FiUpload, FiPlus, FiCheckCircle, FiPrinter, FiUser } from "react-icons/fi";
import { FaShip } from "react-icons/fa";
import { MdDirectionsBoat } from "react-icons/md";
import "../../../../../../design/scss/pages/kanban-board/taxi-boat-card.scss";
import "../../../../../../design/scss/pages/kanban-board/taxi-boat-service-scenarios.scss";
import GroSummaryCard, { GroSummaryFieldCard } from "../GRO/User/GroSummaryCard";
import CardTabListLoading from "../../../../../../components/CardTabListLoading";

const CREW_CHANGE_SERVICES = ["Crew Change"];
const MATERIAL_SERVICES   = ["Material Delivery", "Provision Delivery", "Garbage Collection"];
const IMMIGRATION_SERVICES = ["Immigration Clearance"];

// launch_hire/get_taxiboat_booking_detail/{booking_id} — item_type is the real source of
// truth for which scenario to render. Only fall back to the legacy typeOfService matching
// above when item_type is missing or not one of these (e.g. still loading).
const KNOWN_ITEM_TYPES = new Set([
  "crew_change",
  "crew_immigration_batch",
  "material_inbound",
  "material_dispatch",
  "transport_request",
  "medical_request",
  "hotel_request",
  "third_party_service_request",
  "addon_service_request",
]);

const LOCATION_OPTIONS = ["Freighter Anchorage", "RT7", "Sea Island", "Juaymah"];

const MOCK_CREW_ROWS = [
  { name: "Ahmed Al-Rashid",  rank: "Chief Officer", nationality: "Saudi",    passportNo: "P1234567", seamanBookNo: "SB-10021" },
  { name: "Vikram Singh",     rank: "2nd Engineer",  nationality: "Indian",   passportNo: "P2345678", seamanBookNo: "SB-10022" },
  { name: "Juan Dela Cruz",   rank: "AB Seaman",     nationality: "Filipino", passportNo: "P3456789", seamanBookNo: "SB-10023" },
  { name: "Omar Hassan",      rank: "Cook",          nationality: "Egyptian", passportNo: "P4567890", seamanBookNo: "SB-10024" },
];

const MOCK_PACKING_LIST_ROWS = [
  { itemNo: "PL-001", description: "Safety Helmets",          qty: 20,  unit: "pcs",  weight: 12.0,  notes: ""         },
  { itemNo: "PL-002", description: "Fire Hose Assemblies",    qty: 4,   unit: "sets", weight: 48.5,  notes: ""         },
  { itemNo: "PL-003", description: "Hydraulic Fluid (ISO 46)",qty: 200, unit: "L",    weight: 180.0, notes: "Hazmat"   },
  { itemNo: "PL-004", description: "Spare Pump Impellers",    qty: 2,   unit: "pcs",  weight: 35.0,  notes: ""         },
  { itemNo: "PL-005", description: "Rope (16mm, 200m coil)",  qty: 3,   unit: "coil", weight: 90.0,  notes: ""         },
  { itemNo: "PL-006", description: "Electrical Cable Reels",  qty: 6,   unit: "reels",weight: 144.0, notes: ""         },
  { itemNo: "PL-007", description: "Engine Lube Oil 40W",     qty: 100, unit: "L",    weight: 88.0,  notes: "Hazmat"   },
  { itemNo: "PL-008", description: "Life Jacket (SOLAS)",     qty: 30,  unit: "pcs",  weight: 24.0,  notes: ""         },
];

function getBatchCrewRows(crewCount) {
  const n = Math.max(0, parseInt(crewCount, 10) || 0);
  if (n === 0) return [];
  return Array.from({ length: n }, (_, i) => ({ ...MOCK_CREW_ROWS[i % MOCK_CREW_ROWS.length] }));
}

// launch_hire/get_crew_immigration_booking/{booking_id} — crew row shape isn't fully
// confirmed on the backend yet, so fall back across likely field name variants.
function normalizeImmigrationCrewRow(crew) {
  return {
    name:         formatGroDocumentDisplayName(crew?.crew_name ?? crew?.name) || "—",
    rank:         formatGroDocumentDisplayName(crew?.rank ?? crew?.crew_rank) || "—",
    nationality:  formatGroDocumentDisplayName(crew?.nationality) || "—",
    passportNo:   crew?.passport_no ?? crew?.passportNo ?? "—",
    seamanBookNo: crew?.seaman_book_no ?? crew?.seamanBookNo ?? crew?.seaman_book_number ?? "—",
  };
}

function mapImmigrationBatches(apiBatches) {
  const initKeys = STANDARD_TIMESTAMPS.map((t) => t.key);
  return (Array.isArray(apiBatches) ? apiBatches : []).map((b, idx) => {
    const crew = Array.isArray(b?.crew) ? b.crew.map(normalizeImmigrationCrewRow) : [];
    return {
      id: idx + 1,
      // launch_hire/record_taxiboat_timestamp expects booking_item_id — fall back
      // across likely field name variants until the backend contract is confirmed.
      bookingItemId: b?.booking_item_id ?? b?.launch_hire_booking_item_id ?? null,
      batchLabel: b?.batch ? formatGroDocumentDisplayName(b.batch) : null,
      crewCount: String(crew.length),
      crew,
      operator: "",
      legs: {
        drop: makeLegState(initKeys),
        pickup: makeLegState(initKeys),
      },
    };
  });
}

// API sends "YYYY-MM-DD HH:mm:ss" (no timezone) — normalize to a `new Date()`-safe ISO-ish
// string the same way locally-captured timestamps are stored.
function normalizeApiDateTime(raw) {
  return raw ? String(raw).replace(" ", "T") : null;
}

// Shared crew shape across transport_request / medical_request / hotel_request item_types —
// each API namespaces its own row id (transport_request_crew_id, medical_request_crew_id,
// etc.) but crew_name/rank/nationality/passport_no are consistent.
function normalizeItemTypeCrewRow(crew) {
  return {
    name:          crew?.crew_name ?? "—",
    rank:          crew?.rank ?? "—",
    nationality:   crew?.nationality ?? "—",
    passportNo:    crew?.passport_no ?? "—",
    completedDate: crew?.completed_date ?? null,
  };
}

// launch_hire/get_booking_timestamps/{booking_id} — one Drop/Pickup leg, keyed by checkpoint field name.
function mapBookingTimestampLeg(leg) {
  const initKeys = STANDARD_TIMESTAMPS.map((t) => t.key);
  const ts = makeTsState(initKeys);
  const tsOps = makeTsState(initKeys);
  if (leg) {
    STANDARD_TIMESTAMPS.forEach(({ key, checkpoint }) => {
      const value = leg[checkpoint];
      if (value) {
        ts[key] = normalizeApiDateTime(value);
        tsOps[key] = leg.updated_by ?? "—";
      }
    });
  }
  return {
    ts,
    tsOps,
    completed: Boolean(leg?.trip_completed_time),
    completedAt: normalizeApiDateTime(leg?.trip_completed_time),
  };
}

const STANDARD_TIMESTAMPS = [
  { key: "castOff",           label: "Cast off Time",       icon: FiFlag,       animKey: "castOff",           checkpoint: "cast_off_time"      },
  { key: "boatAlongsideShip", label: "Boat Alongside Ship", icon: FiAnchor,     animKey: "boatAlongsideShip", checkpoint: "alongside_ship_time" },
  { key: "boatCastOffShip",   label: "Boat Cast off Ship",  icon: FiNavigation, animKey: "boatCastOffShip",   checkpoint: "cast_off_ship_time"  },
  { key: "backToJetty",       label: "Back to Jetty",       icon: FiHome,       animKey: "backToJetty",       checkpoint: "back_to_jetty_time" },
];

const TRIP_COMPLETED_CHECKPOINT = "trip_completed_time";

const CHECKPOINT_BY_KEY = STANDARD_TIMESTAMPS.reduce(
  (acc, t) => ({ ...acc, [t.key]: t.checkpoint }),
  {}
);

const BATCH_ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th"];
const CREW_PAGE_SIZE = 10;

const isBatchDone = (batch) => STANDARD_TIMESTAMPS.every((t) => batch.ts[t.key] !== null);

const makeTsState = (keys) =>
  keys.reduce((acc, key) => ({ ...acc, [key]: null }), {});

const LEG_TABS = [
  { key: "pickup", label: "Pickup" },
  { key: "drop",   label: "Drop"   },
];

const makeLegState = (keys) => ({
  ts: makeTsState(keys),
  tsOps: makeTsState(keys),
  cobTime: null,
  completedAt: null,
  stepBackLog: [],
  file: null,
  completed: false,
});

const isBatchFullyDone = (batch) => LEG_TABS.every(({ key }) => isBatchDone(batch.legs[key]));

const formatDuration = (ms) => {
  if (!ms || ms <= 0) return null;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};


const formatDateTime = (iso) => {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

// Read-only listing panels (material_inbound/dispatch, etc.) get raw "YYYY-MM-DD[ HH:mm:ss]"
// strings straight from the API — normalize then format, falling back to the raw value.
const safeFormatDate = (raw) => (raw ? formatDateTime(normalizeApiDateTime(raw)) ?? raw : "—");

function TimestampAnimIcon({ animKey }) {
  if (animKey === "castOff") {
    return (
      <span className="tb-tsanim tb-tsanim--castoff">
        <span className="tb-tsanim-rope" />
        <FaShip size={16} className="tb-tsanim-ship" />
      </span>
    );
  }
  if (animKey === "boatAlongsideShip") {
    return (
      <span className="tb-tsanim tb-tsanim--alongside">
        <FaShip size={20} className="tb-tsanim-vessel" />
        <FaShip size={11} className="tb-tsanim-boat" />
      </span>
    );
  }
  if (animKey === "boatCastOffShip") {
    return (
      <span className="tb-tsanim tb-tsanim--castoff-ship">
        <FaShip size={20} className="tb-tsanim-vessel" />
        <FaShip size={11} className="tb-tsanim-boat" />
      </span>
    );
  }
  if (animKey === "backToJetty") {
    return (
      <span className="tb-tsanim tb-tsanim--back-jetty">
        <FiAnchor size={15} className="tb-tsanim-anchor" />
        <FaShip size={15} className="tb-tsanim-ship" />
      </span>
    );
  }
  if (animKey === "batchPickup") {
    return (
      <span className="tb-tsanim tb-tsanim--batch-pickup">
        <FaShip size={14} className="tb-tsanim-vessel" />
        <span className="tb-tsanim-crew-dot" />
      </span>
    );
  }
  if (animKey === "batchDrop") {
    return (
      <span className="tb-tsanim tb-tsanim--batch-drop">
        <FaShip size={14} className="tb-tsanim-vessel" />
        <span className="tb-tsanim-crew-dot" />
      </span>
    );
  }
  return null;
}

TimestampAnimIcon.propTypes = { animKey: PropTypes.string.isRequired };

function TimestampCard({ label, value, onCheck, icon: Icon, animKey }) {
  const isChecked = value !== null;
  const formatted = formatDateTime(value);
  return (
    <div
      className={`tb-ts-card${isChecked ? " tb-ts-card--done" : ""}`}
      onClick={() => !isChecked && onCheck()}
      role="button"
      tabIndex={isChecked ? -1 : 0}
      onKeyDown={(e) => { if (!isChecked && (e.key === "Enter" || e.key === " ")) onCheck(); }}
    >
      <div className="tb-ts-card-icon-box">
        {animKey ? <TimestampAnimIcon animKey={animKey} /> : <Icon size={20} />}
      </div>
      <div className="tb-ts-card-title">{label}</div>
      <div className={`tb-ts-card-pill${isChecked ? " tb-ts-card-pill--captured" : ""}`}>
        {isChecked ? formatted : "Tap to capture"}
      </div>
    </div>
  );
}

TimestampCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  onCheck: PropTypes.func.isRequired,
  icon: PropTypes.elementType.isRequired,
  animKey: PropTypes.string,
};

function TimestampGrid({ timestamps, tsState, onCapture }) {
  return (
    <div className="tb-ts-grid">
      {timestamps.map(({ key, label, icon, animKey }) => (
        <TimestampCard
          key={key}
          label={label}
          value={tsState[key]}
          onCheck={() => onCapture(key)}
          icon={icon || FiClock}
          animKey={animKey}
        />
      ))}
    </div>
  );
}

TimestampGrid.propTypes = {
  timestamps: PropTypes.arrayOf(
    PropTypes.shape({ key: PropTypes.string, label: PropTypes.string, icon: PropTypes.elementType })
  ).isRequired,
  tsState: PropTypes.object.isRequired,
  onCapture: PropTypes.func.isRequired,
};

// Backend reason_code enum for launch_hire/cancel_taxiboat_timestamp — "Other" requires reason_text.
const UNDO_REASONS = [
  "Wrong time captured",
  "Operator error",
  "Re-capture required",
  "Other",
];

function ConfirmDialog({ label, onConfirm, onCancel }) {
  const [reason, setReason] = useState(null);
  const [otherText, setOtherText] = useState("");

  const canConfirm = reason !== null && (reason !== "Other" || otherText.trim().length > 0);

  return (
    <div className="tb-confirm-overlay" onClick={onCancel}>
      <div className="tb-confirm-box" onClick={(e) => e.stopPropagation()}>
        <p className="tb-confirm-msg">
          Are you sure you want to undo <strong>{label}</strong>?
          Selecting <em>Yes</em> will clear this timestamp and you will need to tap again to capture the current time.
        </p>

        <div className="tb-confirm-reason-section">
          <span className="tb-confirm-reason-label">Reason for going back</span>
          <div className="tb-confirm-reason-chips">
            {UNDO_REASONS.map((r) => (
              <button
                key={r}
                className={`tb-confirm-reason-chip${reason === r ? " tb-confirm-reason-chip--active" : ""}`}
                onClick={() => { setReason(r); if (r !== "Other") setOtherText(""); }}
              >
                {r}
              </button>
            ))}
          </div>
          {reason === "Other" && (
            <input
              type="text"
              className="tb-confirm-reason-input"
              placeholder="Please specify the reason..."
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              autoFocus
            />
          )}
        </div>

        <div className="tb-confirm-btns">
          <button
            className={`tb-confirm-btn tb-confirm-btn--yes${!canConfirm ? " tb-confirm-btn--disabled" : ""}`}
            disabled={!canConfirm}
            onClick={() => canConfirm && onConfirm(reason, reason === "Other" ? otherText.trim() : null)}
          >
            Yes, Go Back
          </button>
          <button className="tb-confirm-btn tb-confirm-btn--no" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

ConfirmDialog.propTypes = {
  label:     PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel:  PropTypes.func.isRequired,
};

function AddIntermediateTripControl({
  tripAdded, open, onToggle, onCancel, onSubmit, submitting,
  purpose, setPurpose,
  entityId, setEntityId, billingEntityOptions, isLoadingBillingEntities,
  tripDate, setTripDate,
  tripTime, setTripTime,
  compact,
}) {
  if (tripAdded) {
    return (
      <span className={`tb-add-trip-done${compact ? " tb-add-trip-done--compact" : ""}`}>
        <FiCheckCircle size={13} />Trip Added
      </span>
    );
  }
  const canSubmit = purpose.trim() && entityId && tripDate && tripTime && !submitting;
  return (
    <div className="tb-add-trip-anchor">
      <button className="tb-add-trip-btn" onClick={onToggle}>
        <FiPlus size={13} />Add Intermediate Trip
      </button>
      {open && (
        <div className="tb-add-trip-popover">
          <span className="tb-add-trip-form-title">Intermediate Trip Details</span>
          <div className="tb-add-trip-fields">
            <div className="tb-add-trip-field">
              <label className="tb-add-trip-label">Purpose <span className="tb-add-trip-required">*</span></label>
              <input className="tb-add-trip-input" type="text" placeholder="e.g. Material Delivery, Crew Change..." value={purpose} onChange={(e) => setPurpose(e.target.value)} />
            </div>
            <div className="tb-add-trip-field">
              <label className="tb-add-trip-label">Billing Entity <span className="tb-add-trip-required">*</span></label>
              <SearchableSelect
                className="tb-add-trip-input"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                options={billingEntityOptions}
                placeholder={isLoadingBillingEntities ? "Loading billing entities…" : "Select a billing entity"}
                disabled={isLoadingBillingEntities}
              />
            </div>
            <div className="tb-add-trip-field">
              <label className="tb-add-trip-label">Booking Date &amp; Time <span className="tb-add-trip-required">*</span></label>
              <DateTimePickerField
                dateValue={tripDate}
                timeValue={tripTime}
                onDateChange={(e) => setTripDate(e.target.value)}
                onTimeChange={(e) => setTripTime(e.target.value)}
              />
            </div>
          </div>
          <div className="tb-add-trip-btns">
            <button className="tb-add-trip-cancel" onClick={onCancel}>Cancel</button>
            <button className="tb-add-trip-submit" onClick={onSubmit} disabled={!canSubmit}>
              {submitting ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

AddIntermediateTripControl.propTypes = {
  tripAdded:   PropTypes.bool.isRequired,
  open:        PropTypes.bool.isRequired,
  onToggle:    PropTypes.func.isRequired,
  onCancel:    PropTypes.func.isRequired,
  onSubmit:    PropTypes.func.isRequired,
  submitting:  PropTypes.bool,
  purpose:     PropTypes.string.isRequired,
  setPurpose:  PropTypes.func.isRequired,
  entityId:    PropTypes.string.isRequired,
  setEntityId: PropTypes.func.isRequired,
  billingEntityOptions:     PropTypes.array.isRequired,
  isLoadingBillingEntities: PropTypes.bool,
  tripDate:    PropTypes.string.isRequired,
  setTripDate: PropTypes.func.isRequired,
  tripTime:    PropTypes.string.isRequired,
  setTripTime: PropTypes.func.isRequired,
  compact:     PropTypes.bool,
};

function TimestampStepper({ timestamps, tsState, onCapture, onComplete, jobCompleted, canFinish, onUndo, now, tsOps, shipName, intermediateTrip }) {
  const doneCount = timestamps.filter((t) => tsState[t.key] !== null).length;
  const totalSteps = timestamps.length;
  const allTimestampsDone = doneCount === totalSteps;
  const finalStepReady = canFinish !== undefined ? canFinish : allTimestampsDone;
  const totalWithFinal = totalSteps + (onComplete ? 1 : 0);
  const isArrived = onComplete ? jobCompleted : allTimestampsDone;

  return (
    <div className={`tb-stepper-wrap tb-stepper-wrap--step-${doneCount} tb-stepper-wrap--steps-${totalWithFinal}`}>
      <div className={`tb-stepper-boat-wrap${isArrived ? " tb-stepper-boat-wrap--arrived" : ""}`}>
        <MdDirectionsBoat size={20} className="tb-stepper-boat-icon" />
      </div>
      <ol className="tb-stepper">
      {timestamps.flatMap(({ key, label, icon: Icon, animKey, showShip }, i) => {
        const done = tsState[key] !== null;
        const prevKey = i > 0 ? timestamps[i - 1].key : null;
        const prevDone = i === 0 || tsState[prevKey] !== null;
        const isNext = !done && prevDone;
        const isLocked = !done && !isNext;
        // Only the most recently captured step can be undone — stepping back further
        // out of sequence would leave later captured timestamps orphaned.
        const nextKey = i < timestamps.length - 1 ? timestamps[i + 1].key : null;
        const nextDone = nextKey ? tsState[nextKey] !== null : false;
        const undoable = done && !nextDone && !!onUndo;

        const stepDuration = done && prevKey && tsState[prevKey]
          ? formatDuration(new Date(tsState[key]) - new Date(tsState[prevKey]))
          : null;

        const liveTimer = isNext && now && prevKey && tsState[prevKey]
          ? formatDuration(now - new Date(tsState[prevKey]))
          : null;

        const mainItem = (
          <li
            key={key}
            className={[
              "tb-stepper-item",
              done     ? "tb-stepper-item--done"     : "",
              undoable ? "tb-stepper-item--undoable" : "",
              isNext   ? "tb-stepper-item--next"     : "",
              isLocked ? "tb-stepper-item--locked"   : "",
            ].filter(Boolean).join(" ")}
            onClick={() => {
              if (undoable) onUndo(key, label);
              else if (isNext) onCapture(key);
            }}
            role={isNext || undoable ? "button" : undefined}
            tabIndex={isNext || undoable ? 0 : -1}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                if (undoable) onUndo(key, label);
                else if (isNext) onCapture(key);
              }
            }}
          >
            <div className="tb-stepper-track">
              <div className="tb-stepper-dot">{done ? "✓" : i + 1}</div>
              <div className="tb-stepper-line" />
            </div>
            <div className="tb-stepper-body">
              <div className="tb-stepper-icon-box">
                {animKey ? <TimestampAnimIcon animKey={animKey} /> : <Icon size={20} />}
              </div>
              <div className="tb-stepper-content">
                <span className="tb-stepper-label">
                  {label}
                  {showShip && shipName && shipName !== "—" && (
                    <span className="tb-stepper-ship-name"><FaShip size={8} />{shipName}</span>
                  )}
                </span>
                <span className={[
                  "tb-stepper-pill",
                  done   ? "tb-stepper-pill--done" : "",
                  isNext ? "tb-stepper-pill--next" : "",
                ].filter(Boolean).join(" ")}>
                  {done ? formatDateTime(tsState[key]) : isNext ? "Tap to capture" : "—"}
                </span>
                {stepDuration && (
                  <span className="tb-step-duration">{stepDuration}</span>
                )}
                {liveTimer && (
                  <span className="tb-step-live-timer">
                    <FiClock size={9} />
                    {liveTimer}
                  </span>
                )}
                {done && tsOps?.[key] && (
                  <span className="tb-stepper-operator-name">
                    <FiUser size={9} />
                    {tsOps[key]}
                  </span>
                )}
              </div>
            </div>
          </li>
        );

        if (key === "boatCastOffShip" && intermediateTrip) {
          return [mainItem, (
            <li key="intermediate-trip" className="tb-stepper-item tb-stepper-item--intermediate">
              <div className="tb-stepper-track">
                <div className="tb-stepper-dot tb-stepper-dot--trip"><FiArrowUp size={9} /></div>
                <div className="tb-stepper-line" />
              </div>
              <div className="tb-stepper-body">
                <div className="tb-stepper-icon-box tb-stepper-icon-box--trip">
                  <FiNavigation size={18} />
                </div>
                <div className="tb-stepper-content">
                  <span className="tb-stepper-label tb-stepper-label--trip">Intermediate Trip</span>
                  {intermediateTrip.purpose && <span className="tb-trip-split-purpose">{intermediateTrip.purpose}</span>}
                  {intermediateTrip.billingEntity && <span className="tb-trip-split-dest"><FaShip size={9} />{intermediateTrip.billingEntity}</span>}
                </div>
              </div>
            </li>
          )];
        }

        return [mainItem];
      })}
      {onComplete && (
        <li
          className={[
            "tb-stepper-item",
            jobCompleted                          ? "tb-stepper-item--done"   : "",
            finalStepReady && !jobCompleted       ? "tb-stepper-item--next"   : "",
            !finalStepReady && !jobCompleted      ? "tb-stepper-item--locked" : "",
          ].filter(Boolean).join(" ")}
          onClick={() => finalStepReady && !jobCompleted && onComplete()}
          role={finalStepReady && !jobCompleted ? "button" : undefined}
          tabIndex={finalStepReady && !jobCompleted ? 0 : -1}
          onKeyDown={(e) => {
            if (finalStepReady && !jobCompleted && (e.key === "Enter" || e.key === " ")) onComplete();
          }}
        >
          <div className="tb-stepper-track">
            <div className="tb-stepper-dot">{jobCompleted ? "✓" : totalSteps + 1}</div>
          </div>
          <div className="tb-stepper-body">
            <div className="tb-stepper-icon-box">
              <FiCheckCircle size={20} />
            </div>
            <div className="tb-stepper-content">
              <span className="tb-stepper-label">Trip Completed</span>
              <span className={[
                "tb-stepper-pill",
                jobCompleted                    ? "tb-stepper-pill--done" : "",
                finalStepReady && !jobCompleted ? "tb-stepper-pill--next" : "",
              ].filter(Boolean).join(" ")}>
                {jobCompleted ? "Completed" : finalStepReady ? "Tap to complete" : "—"}
              </span>
            </div>
          </div>
        </li>
      )}
      </ol>
      {allTimestampsDone && (() => {
        const firstTs = tsState[timestamps[0].key];
        const lastTs  = tsState[timestamps[timestamps.length - 1].key];
        const dur = firstTs && lastTs ? formatDuration(new Date(lastTs) - new Date(firstTs)) : null;
        return dur ? (
          <div className="tb-voyage-duration-bar">
            <FiClock size={12} />
            <span>Total voyage time: <strong>{dur}</strong></span>
          </div>
        ) : null;
      })()}
    </div>
  );
}

TimestampStepper.propTypes = {
  timestamps: PropTypes.arrayOf(
    PropTypes.shape({ key: PropTypes.string, label: PropTypes.string, icon: PropTypes.elementType })
  ).isRequired,
  tsState:      PropTypes.object.isRequired,
  onCapture:    PropTypes.func.isRequired,
  onComplete:   PropTypes.func,
  jobCompleted: PropTypes.bool,
  canFinish:    PropTypes.bool,
  onUndo:       PropTypes.func,
  now:             PropTypes.instanceOf(Date),
  tsOps:           PropTypes.object,
  shipName:        PropTypes.string,
  intermediateTrip: PropTypes.shape({
    purpose:       PropTypes.string,
    billingEntity: PropTypes.string,
  }),
};

function InfoCard({ label, value }) {
  return (
    <div className="tb-info-card">
      <span className="tb-info-label">{label}</span>
      <span className="tb-info-value">{value || "—"}</span>
    </div>
  );
}

InfoCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
};

function FinalStep({ canComplete, isDone, onComplete }) {
  return (
    <ol className="tb-stepper">
      <li
        className={[
          "tb-stepper-item",
          isDone                    ? "tb-stepper-item--done"   : "",
          canComplete && !isDone    ? "tb-stepper-item--next"   : "",
          !canComplete && !isDone   ? "tb-stepper-item--locked" : "",
        ].filter(Boolean).join(" ")}
        onClick={() => canComplete && !isDone && onComplete()}
        role={canComplete && !isDone ? "button" : undefined}
        tabIndex={canComplete && !isDone ? 0 : -1}
        onKeyDown={(e) => {
          if (canComplete && !isDone && (e.key === "Enter" || e.key === " ")) onComplete();
        }}
      >
        <div className="tb-stepper-track">
          <div className="tb-stepper-dot">✓</div>
        </div>
        <div className="tb-stepper-body">
          <div className="tb-stepper-icon-box">
            <FiCheckCircle size={20} />
          </div>
          <div className="tb-stepper-content">
            <span className="tb-stepper-label">Trip Completed</span>
            <span className={[
              "tb-stepper-pill",
              isDone                 ? "tb-stepper-pill--done" : "",
              canComplete && !isDone ? "tb-stepper-pill--next" : "",
            ].filter(Boolean).join(" ")}>
              {isDone ? "Completed" : canComplete ? "Tap to complete" : "—"}
            </span>
          </div>
        </div>
      </li>
    </ol>
  );
}

FinalStep.propTypes = {
  canComplete: PropTypes.bool.isRequired,
  isDone:      PropTypes.bool.isRequired,
  onComplete:  PropTypes.func.isRequired,
};

function TimestampSummaryTable({ timestamps, tsState, jobCompletedAt, stepsAllDone, stepBackLog, headerAction }) {
  const anyDone = timestamps.some((t) => tsState[t.key] !== null);
  if (!anyDone) return null;

  return (
    <div className="tb-ts-summary">
      <div className="tb-ts-summary-header">
        <span className="tb-ts-summary-title">Timestamps Summary</span>
        {headerAction}
      </div>
      <table className="tb-ts-summary-table">
        <thead>
          <tr>
            <th className="tb-ts-summary-th-num">#</th>
            <th>Step</th>
            <th>Captured Time</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          {timestamps.map(({ key, label }, i) => {
            const prevKey  = i > 0 ? timestamps[i - 1].key : null;
            const time     = tsState[key];
            const prevTime = prevKey ? tsState[prevKey] : null;
            const dur = time && prevTime ? formatDuration(new Date(time) - new Date(prevTime)) : null;
            return (
              <tr key={key} className={time ? "tb-ts-summary-row--done" : ""}>
                <td className="tb-ts-summary-num">
                  <span className={`tb-ts-summary-badge${time ? " tb-ts-summary-badge--done" : ""}`}>
                    {time ? <FiCheckCircle size={12} /> : i + 1}
                  </span>
                </td>
                <td className="tb-ts-summary-step">{label}</td>
                <td className="tb-ts-summary-time">
                  {time ? formatDateTime(time) : <span className="tb-ts-summary-blank">—</span>}
                </td>
                <td className="tb-ts-summary-dur">
                  {dur ? <span className="tb-ts-summary-dur-chip">{dur}</span> : <span className="tb-ts-summary-blank">—</span>}
                </td>
              </tr>
            );
          })}

          {/* Trip Completed row */}
          <tr className={["tb-ts-summary-row--job", jobCompletedAt ? "tb-ts-summary-row--done" : "tb-ts-summary-row--locked"].join(" ")}>
            <td className="tb-ts-summary-num">
              <span className={`tb-ts-summary-badge${jobCompletedAt ? " tb-ts-summary-badge--done" : " tb-ts-summary-badge--locked"}`}>
                <FiCheckCircle size={12} />
              </span>
            </td>
            <td className="tb-ts-summary-step tb-ts-summary-job-label">Trip Completed</td>
            <td className="tb-ts-summary-time">
              {jobCompletedAt
                ? formatDateTime(jobCompletedAt)
                : <span className="tb-ts-summary-blank">{stepsAllDone ? "Tap step 5 above" : "—"}</span>}
            </td>
            <td className="tb-ts-summary-dur">—</td>
          </tr>
          {/* Step Back Log rows */}
          {stepBackLog && stepBackLog.length > 0 && stepBackLog.map((entry, idx) => (
            <tr key={`sb-${idx}`} className="tb-ts-summary-row--stepback">
              <td className="tb-ts-summary-num">
                <span className="tb-ts-summary-badge tb-ts-summary-badge--stepback">
                  <FiArrowDown size={11} />
                </span>
              </td>
              <td className="tb-ts-summary-step tb-ts-summary-stepback-label">
                Step Back — {entry.step}
              </td>
              <td className="tb-ts-summary-time">{formatDateTime(entry.time)}</td>
              <td className="tb-ts-summary-dur tb-ts-summary-stepback-reason">{entry.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

TimestampSummaryTable.propTypes = {
  timestamps:      PropTypes.array.isRequired,
  tsState:         PropTypes.object.isRequired,
  jobCompletedAt:  PropTypes.string,
  cobTime:         PropTypes.string,
  onCaptureCob:    PropTypes.func.isRequired,
  stepsAllDone:    PropTypes.bool.isRequired,
  stepBackLog:     PropTypes.array,
  headerAction:    PropTypes.node,
};

const parseToInputDate = (raw) => {
  if (!raw || raw === "—") return "";
  try {
    const d = new Date(raw);
    if (!isNaN(d)) return d.toISOString().split("T")[0];
  } catch {console.log("Error parsing date:", raw)}
  return "";
};

const FLEET_ASSIGN_STEPS = ["Choose Fleet", "Assign Captain", "Ready"];

function FleetStatusPill({ label = "Available" }) {
  return (
    <span className="tb-status-pill">
      <span className="tb-status-pill-dot" />
      {label}
    </span>
  );
}

FleetStatusPill.propTypes = { label: PropTypes.string };

function TaxiFleetAssignPanel({
  fleets, isLoadingFleets,
  selectedFleet, onSelectFleet,
  captains, isLoadingCaptains,
  selectedCaptainId,
  isAssigning,
  assigned, assignedCaptainName,
  onAssignCaptain,
}) {
  const stepIndex = assigned ? 3 : selectedFleet ? 2 : 1;

  return (
    <div className="tb-fleet-panel">
      <div className="tb-fleet-panel-head">
        <h3 className="tb-fleet-panel-title">Taxi Fleet Assignment</h3>
        <ol className="tb-fleet-steps">
          {FLEET_ASSIGN_STEPS.map((label, i) => {
            const stepNum = i + 1;
            return (
              <li
                key={label}
                className={[
                  "tb-fleet-step",
                  stepIndex > stepNum ? "tb-fleet-step--done" : "",
                  stepIndex === stepNum ? "tb-fleet-step--active" : "",
                ].filter(Boolean).join(" ")}
              >
                <span className="tb-fleet-step-dot">
                  {stepIndex > stepNum ? <FiCheckCircle size={10} /> : stepNum}
                </span>
                {label}
              </li>
            );
          })}
        </ol>
      </div>

      {isLoadingFleets ? (
        <span className="tb-fleet-empty-hint">Loading fleets…</span>
      ) : fleets.length === 0 ? (
        <span className="tb-fleet-empty-hint">No fleets found for this operator.</span>
      ) : (
        <div className="tb-fleet-cards">
          {fleets.map((fleet) => {
            const isSelected = selectedFleet?.taxi_boat_id === fleet.taxi_boat_id;
            const isFleetAssigned = assigned && isSelected;
            return (
              <div
                key={fleet.taxi_boat_id}
                className={["tb-fleet-card", isSelected ? "tb-fleet-card--selected" : ""].filter(Boolean).join(" ")}
              >
                <button
                  type="button"
                  className="tb-fleet-card-head"
                  onClick={() => !assigned && onSelectFleet(fleet)}
                  disabled={assigned}
                >
                  <span className="tb-fleet-card-name">
                    <MdDirectionsBoat size={18} />
                    {fleet.taxi_boat_name}
                  </span>
                  {isSelected && (
                    <span className="tb-fleet-card-badge">
                      <FiCheckCircle size={11} /> Selected
                    </span>
                  )}
                </button>

                {isSelected && (
                  <div className="tb-fleet-card-body">
                    <div className="tb-fleet-card-row">
                      <span className="tb-fleet-card-row-label">Status</span>
                      <FleetStatusPill />
                    </div>
                    {(fleet.registration_no || fleet.capacity_persons != null) && (
                      <div className="tb-fleet-card-meta">
                        {fleet.registration_no && <span>{fleet.registration_no}</span>}
                        {fleet.capacity_persons != null && <span>{fleet.capacity_persons} persons</span>}
                      </div>
                    )}

                    <div className="tb-fleet-card-divider" />

                    {isFleetAssigned ? (
                      <div className="tb-fleet-success">
                        <FiCheckCircle size={18} />
                        <div className="tb-fleet-success-text">
                          <span className="tb-fleet-success-title">Captain Assigned</span>
                          <span className="tb-fleet-success-name">{assignedCaptainName}</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className="tb-fleet-card-row-label">Captain</span>
                        <SearchableSelect
                          className="tb-summary-select"
                          value={selectedCaptainId ?? ""}
                          onChange={(e) => onAssignCaptain(e.target.value)}
                          options={captains.map((captain) => ({
                            value: captain.taxiboat_captain_id,
                            label: captain.captain_name,
                          }))}
                          placeholder={
                            isLoadingCaptains
                              ? "Loading captains…"
                              : captains.length === 0
                              ? "No captains available"
                              : "Select Captain"
                          }
                          disabled={isLoadingCaptains || isAssigning || captains.length === 0}
                          menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                        />
                        {selectedCaptainId && (
                          <div className="tb-fleet-card-row">
                            <span className="tb-fleet-card-row-label">Captain Status</span>
                            <FleetStatusPill />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isLoadingFleets && fleets.length > 0 && !selectedFleet && (
        <div className="tb-fleet-empty-state">
          <FiUser size={18} />
          Select a fleet to assign a captain.
        </div>
      )}
    </div>
  );
}

TaxiFleetAssignPanel.propTypes = {
  fleets:              PropTypes.array.isRequired,
  isLoadingFleets:     PropTypes.bool.isRequired,
  selectedFleet:       PropTypes.object,
  onSelectFleet:       PropTypes.func.isRequired,
  captains:            PropTypes.array.isRequired,
  isLoadingCaptains:   PropTypes.bool.isRequired,
  selectedCaptainId:   PropTypes.string,
  isAssigning:         PropTypes.bool.isRequired,
  assigned:            PropTypes.bool.isRequired,
  assignedCaptainName: PropTypes.string,
  onAssignCaptain:     PropTypes.func.isRequired,
};

function CrewListBatchwisePanel({
  batches, setBatches, activeBatchTab, setActiveBatchTab,
  captureBatchTs, completeBatchLeg, cancelBatchTs, setUndoPending, vesselName, now, printLaunchSlip, bookingId,
  hideStepper, crewlistToggle, onCrewlistChange,
  tripAdded, tripSubmitting, addTripOpen, setAddTripOpen,
  addTripPurpose, setAddTripPurpose,
  addTripEntityId, setAddTripEntityId, billingEntityOptions, isLoadingBillingEntities,
  addTripDate, setAddTripDate,
  addTripTime, setAddTripTime,
  onAddTripToggle, handleAddTrip,
}) {
  const [crewPage, setCrewPage] = useState(1);
  const [uploadingBatchId, setUploadingBatchId] = useState(null);
  const [activeLeg, setActiveLeg] = useState("pickup");
  const [showCrewlist, setShowCrewlist] = useState(false);
  const crewlistOpen = !crewlistToggle || showCrewlist;
  const inCrewlistTab = crewlistToggle && showCrewlist;

  const toggleCrewlist = () => {
    const next = !showCrewlist;
    setShowCrewlist(next);
    onCrewlistChange?.(next);
  };
  const activeBatchId = batches[activeBatchTab]?.id;
  const notifySuccess = useAlertReducer((s) => s.success);
  const notifyError = useAlertReducer((s) => s.error);

  useEffect(() => {
    setCrewPage(1);
  }, [activeBatchId]);

  const handleUploadLaunchSlip = useCallback(async (batchIdx, batchIdVal, file) => {
    setBatches((prev) => prev.map((b, idx) => (idx === batchIdx ? { ...b, legs: { ...b.legs, [activeLeg]: { ...b.legs[activeLeg], file } } } : b)));
    if (!file || bookingId == null) return;
    const formData = new FormData();
    formData.append("booking_id", bookingId);
    formData.append("file", file);
    try {
      setUploadingBatchId(batchIdVal);
      const { data } = await launchHireService.uploadLaunchHireSlip(formData);
      setBatches((prev) =>
        prev.map((b, idx) =>
          idx === batchIdx
            ? { ...b, legs: { ...b.legs, [activeLeg]: { ...b.legs[activeLeg], file, fileUrl: data?.file_url ?? null, fileName: data?.launch_hire_slip ?? file.name } } }
            : b
        )
      );
      notifySuccess(data?.message ?? "Launch hire slip uploaded successfully");
    } catch (err) {
      notifyError(err?.response?.data?.message ?? err.message ?? "Failed to upload launch hire slip");
    } finally {
      setUploadingBatchId(null);
    }
  }, [bookingId, setBatches, notifySuccess, notifyError, activeLeg]);

  const activeBatch = batches[activeBatchTab];
  const activeLegData = activeBatch?.legs?.[activeLeg];

  return (
    <div className="tb-scenario-section">
      {crewlistToggle && (
        <div className="tb-crewlist-toggle-row">
          {!inCrewlistTab && (tripAdded || activeLegData?.ts?.boatCastOffShip) && (
            <AddIntermediateTripControl
              tripAdded={tripAdded}
              open={addTripOpen}
              onToggle={onAddTripToggle}
              onCancel={() => setAddTripOpen(false)}
              onSubmit={handleAddTrip}
              submitting={tripSubmitting}
              purpose={addTripPurpose}
              setPurpose={setAddTripPurpose}
              entityId={addTripEntityId}
              setEntityId={setAddTripEntityId}
              billingEntityOptions={billingEntityOptions}
              isLoadingBillingEntities={isLoadingBillingEntities}
              tripDate={addTripDate}
              setTripDate={setAddTripDate}
              tripTime={addTripTime}
              setTripTime={setAddTripTime}
              compact
            />
          )}
          <button
            type="button"
            className="tb-crewlist-toggle-btn"
            onClick={toggleCrewlist}
          >
            {showCrewlist ? (
              <>
                <FiArrowLeft size={14} />
                Back
              </>
            ) : (
              <>
                <FiUser size={14} />
                Crewlist
              </>
            )}
          </button>
        </div>
      )}

      {crewlistOpen && (
        <>
          <h3 className="tb-section-title">Crew List — Batchwise</h3>
          <div className="tb-batch-header-row">
            <div className="tb-batch-tab-strip">
              {batches.map((batch, i) => (
                <button
                  key={batch.id}
                  className={[
                    "tb-batch-tab",
                    activeBatchTab === i ? "tb-batch-tab--active" : "",
                    isBatchFullyDone(batch) ? "tb-batch-tab--done" : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => setActiveBatchTab(i)}
                >
                  {isBatchFullyDone(batch) && <FiCheckCircle size={12} />}
                  {batch.batchLabel ?? `Batch ${BATCH_ORDINALS[i] ?? `${i + 1}th`}`}
                </button>
              ))}
            </div>

            {activeLegData?.completed && !inCrewlistTab && (
              <div className="tb-batch-actions">
                <button
                  className="tb-batch-print-btn"
                  onClick={() => printLaunchSlip(activeLegData.ts, `Immigration Batch ${BATCH_ORDINALS[activeBatchTab] ?? activeBatchTab + 1} — ${activeLeg === "drop" ? "Drop" : "Pickup"}`, activeBatch.operator, activeLegData.completedAt)}
                >
                  <FiPrinter size={14} />
                  Print Launch Slip
                </button>
                <div>
                  <input
                    type="file"
                    id={`tb-batch-file-${activeBatch.id}-${activeLeg}`}
                    className="tb-launch-slip-input"
                    accept=".pdf,.jpg,.jpeg,.png"
                    disabled={uploadingBatchId === activeBatch.id}
                    onChange={(e) => handleUploadLaunchSlip(activeBatchTab, activeBatch.id, e.target.files?.[0] ?? null)}
                  />
                  <label htmlFor={`tb-batch-file-${activeBatch.id}-${activeLeg}`} className="tb-batch-upload-btn">
                    <FiUpload size={14} />
                    {uploadingBatchId === activeBatch.id
                      ? "Uploading…"
                      : activeLegData.file ? activeLegData.file.name : "Upload Launch Slip"}
                  </label>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {batches.map((batch, i) => {
        if (i !== activeBatchTab) return null;
        const leg = batch.legs[activeLeg];
        const done = isBatchDone(leg);
        const crewRows = batch.crew && batch.crew.length > 0 ? batch.crew : getBatchCrewRows(batch.crewCount);
        const totalCrewPages = Math.max(1, Math.ceil(crewRows.length / CREW_PAGE_SIZE));
        const crewPageSafe = Math.min(crewPage, totalCrewPages);
        const pagedCrewRows = crewRows.slice(
          (crewPageSafe - 1) * CREW_PAGE_SIZE,
          crewPageSafe * CREW_PAGE_SIZE
        );
        return (
          <div key={batch.id} className="tb-batch-tab-content">
            {crewlistOpen && crewRows.length > 0 && (
              <div className="tb-crew-table-wrapper tb-crew-table-wrapper--paged">
                <table className="tb-crew-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Rank</th>
                      <th>Nationality</th>
                      <th>Passport No.</th>
                      <th>Seaman Book No.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedCrewRows.map((row, ri) => (
                      <tr key={ri}>
                        <td>{(crewPageSafe - 1) * CREW_PAGE_SIZE + ri + 1}</td>
                        <td>{row.name}</td>
                        <td>{row.rank}</td>
                        <td>{row.nationality}</td>
                        <td>{row.passportNo}</td>
                        <td>{row.seamanBookNo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {totalCrewPages > 1 && (
                  <div className="tb-crew-pagination">
                    <button
                      type="button"
                      className="tb-crew-page-btn"
                      onClick={() => setCrewPage((p) => Math.max(1, p - 1))}
                      disabled={crewPageSafe === 1}
                    >
                      Prev
                    </button>
                    <span className="tb-crew-page-status">
                      Page {crewPageSafe} of {totalCrewPages}
                    </span>
                    <button
                      type="button"
                      className="tb-crew-page-btn"
                      onClick={() => setCrewPage((p) => Math.min(totalCrewPages, p + 1))}
                      disabled={crewPageSafe === totalCrewPages}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}

            {!hideStepper && !inCrewlistTab && (
              <div className="tb-tabs">
                <div className="tb-tabs-group">
                  {LEG_TABS.map(({ key, label }) => (
                    <button
                      key={key}
                      className={`tb-tab${activeLeg === key ? " tb-tab--active" : ""}`}
                      onClick={() => setActiveLeg(key)}
                    >
                      <span
                        key={`${key}-${activeLeg}`}
                        className={`tb-tab-vessel-wrap${activeLeg === key ? ` tb-tab-vessel-wrap--${key}-firing` : ""}`}
                      >
                        <FaShip size={12} />
                        <span className="tb-tab-cargo-dot" />
                      </span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!hideStepper && !inCrewlistTab && (
              <TimestampStepper
                timestamps={STANDARD_TIMESTAMPS}
                tsState={leg.ts}
                tsOps={leg.tsOps}
                shipName={vesselName}
                onCapture={(key) => captureBatchTs(i, activeLeg, key)}
                onComplete={() => completeBatchLeg(i, activeLeg)}
                jobCompleted={leg.completed}
                canFinish={isBatchDone(leg)}
                now={now}
                onUndo={(key, label) => setUndoPending({
                  label,
                  resetter: () => setBatches((prev) =>
                    prev.map((b, idx) =>
                      idx === i ? { ...b, legs: { ...b.legs, [activeLeg]: { ...b.legs[activeLeg], ts: { ...b.legs[activeLeg].ts, [key]: null }, completed: false } } } : b
                    )
                  ),
                  addToLog: (reason) => setBatches((prev) =>
                    prev.map((b, idx) =>
                      idx === i ? { ...b, legs: { ...b.legs, [activeLeg]: { ...b.legs[activeLeg], stepBackLog: [...b.legs[activeLeg].stepBackLog, { step: label, reason, time: new Date().toISOString() }] } } } : b
                    )
                  ),
                  cancelApi: (reasonCode, reasonText) => cancelBatchTs(i, activeLeg, key, reasonCode, reasonText),
                })}
              />
            )}

            {crewlistToggle && !inCrewlistTab && activeLegData?.completed && (
              <div className="tb-batch-actions tb-batch-actions--end">
                <button
                  className="tb-batch-print-btn"
                  onClick={() => printLaunchSlip(activeLegData.ts, `Immigration Batch ${BATCH_ORDINALS[activeBatchTab] ?? activeBatchTab + 1} — ${activeLeg === "drop" ? "Drop" : "Pickup"}`, activeBatch.operator, activeLegData.completedAt)}
                >
                  <FiPrinter size={14} />
                  Print Launch Slip
                </button>
                <div>
                  <input
                    type="file"
                    id={`tb-batch-file-${activeBatch.id}-${activeLeg}`}
                    className="tb-launch-slip-input"
                    accept=".pdf,.jpg,.jpeg,.png"
                    disabled={uploadingBatchId === activeBatch.id}
                    onChange={(e) => handleUploadLaunchSlip(activeBatchTab, activeBatch.id, e.target.files?.[0] ?? null)}
                  />
                  <label htmlFor={`tb-batch-file-${activeBatch.id}-${activeLeg}`} className="tb-batch-upload-btn">
                    <FiUpload size={14} />
                    {uploadingBatchId === activeBatch.id
                      ? "Uploading…"
                      : activeLegData.file ? activeLegData.file.name : "Upload Launch Slip"}
                  </label>
                </div>
              </div>
            )}

            {!inCrewlistTab && (
              <TimestampSummaryTable
                timestamps={STANDARD_TIMESTAMPS}
                tsState={leg.ts}
                jobCompletedAt={leg.completedAt}
                cobTime={leg.cobTime}
                stepsAllDone={isBatchDone(leg)}
                stepBackLog={leg.stepBackLog}
                onCaptureCob={() =>
                  setBatches((prev) =>
                    prev.map((b, idx) =>
                      idx === i ? { ...b, legs: { ...b.legs, [activeLeg]: { ...b.legs[activeLeg], cobTime: new Date().toISOString() } } } : b
                    )
                  )
                }
              />
            )}

            {done && (
              <div className="tb-batch-done-badge">
                <FiCheckCircle size={16} />
                Batch {BATCH_ORDINALS[i] ?? `${i + 1}th`} Complete
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

CrewListBatchwisePanel.propTypes = {
  batches:          PropTypes.array.isRequired,
  setBatches:       PropTypes.func.isRequired,
  activeBatchTab:   PropTypes.number.isRequired,
  setActiveBatchTab: PropTypes.func.isRequired,
  opFocusedBatch:   PropTypes.number,
  setOpFocusedBatch: PropTypes.func.isRequired,
  recentOps:        PropTypes.array,
  handleOpBlur:     PropTypes.func.isRequired,
  handleOpChipClick: PropTypes.func.isRequired,
  captureBatchTs:   PropTypes.func.isRequired,
  completeBatchLeg: PropTypes.func.isRequired,
  cancelBatchTs:    PropTypes.func,
  setUndoPending:   PropTypes.func.isRequired,
  vesselName:       PropTypes.string,
  now:              PropTypes.instanceOf(Date),
  hideStepper:      PropTypes.bool,
  crewlistToggle:   PropTypes.bool,
  onCrewlistChange: PropTypes.func,
  printLaunchSlip:  PropTypes.func.isRequired,
  bookingId:        PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  tripAdded:        PropTypes.bool,
  tripSubmitting:   PropTypes.bool,
  addTripOpen:      PropTypes.bool,
  setAddTripOpen:   PropTypes.func,
  addTripPurpose:   PropTypes.string,
  setAddTripPurpose: PropTypes.func,
  addTripEntityId:  PropTypes.string,
  setAddTripEntityId: PropTypes.func,
  billingEntityOptions:     PropTypes.array,
  isLoadingBillingEntities: PropTypes.bool,
  addTripDate:      PropTypes.string,
  setAddTripDate:   PropTypes.func,
  addTripTime:      PropTypes.string,
  setAddTripTime:   PropTypes.func,
  onAddTripToggle:  PropTypes.func,
  handleAddTrip:    PropTypes.func,
};

// Read-only listing panels for item_types that don't have a dedicated interactive
// scenario (crew_change and crew_immigration_batch keep their existing panels above).
// Pagination mirrors CrewListBatchwisePanel's crew table (same page size, same controls).
function TablePagination({ page, totalPages, onPrev, onNext }) {
  if (totalPages <= 1) return null;
  return (
    <div className="tb-crew-pagination">
      <button type="button" className="tb-crew-page-btn" onClick={onPrev} disabled={page === 1}>
        Prev
      </button>
      <span className="tb-crew-page-status">
        Page {page} of {totalPages}
      </span>
      <button type="button" className="tb-crew-page-btn" onClick={onNext} disabled={page === totalPages}>
        Next
      </button>
    </div>
  );
}

TablePagination.propTypes = {
  page:       PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  onPrev:     PropTypes.func.isRequired,
  onNext:     PropTypes.func.isRequired,
};

function ItemTypeCrewListing({ title, crew, showCompletedDate }) {
  const [page, setPage] = useState(1);
  const rows = (Array.isArray(crew) ? crew : []).map(normalizeItemTypeCrewRow);
  const totalPages = Math.max(1, Math.ceil(rows.length / CREW_PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pagedRows = rows.slice((pageSafe - 1) * CREW_PAGE_SIZE, pageSafe * CREW_PAGE_SIZE);
  return (
    <div className="tb-scenario-section">
      <h3 className="tb-section-title">{title}</h3>
      {rows.length === 0 ? (
        <span className="tb-fleet-empty-hint">No crew records found for this item.</span>
      ) : (
        <>
          <div className="tb-crew-table-wrapper tb-crew-table-wrapper--paged">
            <table className="tb-crew-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Rank</th>
                  <th>Nationality</th>
                  <th>Passport No.</th>
                  {showCompletedDate && <th>Completed Date</th>}
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row, i) => (
                  <tr key={i}>
                    <td>{(pageSafe - 1) * CREW_PAGE_SIZE + i + 1}</td>
                    <td>{row.name}</td>
                    <td>{row.rank}</td>
                    <td>{row.nationality}</td>
                    <td>{row.passportNo}</td>
                    {showCompletedDate && <td>{row.completedDate ? safeFormatDate(row.completedDate) : "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={pageSafe}
            totalPages={totalPages}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          />
        </>
      )}
    </div>
  );
}

ItemTypeCrewListing.propTypes = {
  title:             PropTypes.string.isRequired,
  crew:              PropTypes.array,
  showCompletedDate: PropTypes.bool,
};

function MaterialInboundListing({ materialInbound }) {
  const [page, setPage] = useState(1);
  if (!materialInbound) return null;
  const items = Array.isArray(materialInbound.items) ? materialInbound.items : [];
  const totalPages = Math.max(1, Math.ceil(items.length / CREW_PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pagedItems = items.slice((pageSafe - 1) * CREW_PAGE_SIZE, pageSafe * CREW_PAGE_SIZE);
  return (
    <div className="tb-scenario-section">
      <h3 className="tb-section-title">Material Inbound</h3>
      <div className="tb-info-grid">
        <InfoCard label="Inbound No." value={materialInbound.inbound_no} />
        <InfoCard label="Inbound Date" value={safeFormatDate(materialInbound.inbound_date)} />
        <InfoCard label="Remarks" value={materialInbound.remarks} />
      </div>
      {items.length > 0 && (
        <>
          <div className="tb-crew-table-wrapper tb-crew-table-wrapper--paged">
            <table className="tb-crew-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Order No.</th>
                  <th>PO No.</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Pickup Location</th>
                  <th>Route</th>
                  <th>Vehicle</th>
                </tr>
              </thead>
              <tbody>
                {pagedItems.map((item, i) => (
                  <tr key={item.inbound_item_id ?? i}>
                    <td>{(pageSafe - 1) * CREW_PAGE_SIZE + i + 1}</td>
                    <td>{item.order_no ?? "—"}</td>
                    <td>{item.po_no ?? "—"}</td>
                    <td>{item.description ?? "—"}</td>
                    <td>{item.quantity ?? "—"}</td>
                    <td>{item.transportation?.pickup_location ?? "—"}</td>
                    <td>
                      {item.transportation
                        ? `${item.transportation.from_location_name ?? "—"} → ${item.transportation.to_location_name ?? "—"}`
                        : "—"}
                    </td>
                    <td>{item.transportation?.vehicle_type_name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={pageSafe}
            totalPages={totalPages}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          />
        </>
      )}
    </div>
  );
}

MaterialInboundListing.propTypes = {
  materialInbound: PropTypes.object,
};

function MaterialDispatchListing({ materialDispatch }) {
  const [page, setPage] = useState(1);
  if (!materialDispatch) return null;
  const items = Array.isArray(materialDispatch.items) ? materialDispatch.items : [];
  const documents = Array.isArray(materialDispatch.documents) ? materialDispatch.documents : [];
  const totalPages = Math.max(1, Math.ceil(items.length / CREW_PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pagedItems = items.slice((pageSafe - 1) * CREW_PAGE_SIZE, pageSafe * CREW_PAGE_SIZE);
  return (
    <div className="tb-scenario-section">
      <h3 className="tb-section-title">Material Dispatch</h3>
      <div className="tb-info-grid">
        <InfoCard label="Dispatch Note No." value={materialDispatch.dispatch_note_no} />
        <InfoCard label="Dispatch Date" value={safeFormatDate(materialDispatch.dispatch_date)} />
        <InfoCard label="Delivery Location" value={materialDispatch.delivery_location} />
        <InfoCard label="Delivered To" value={materialDispatch.delivered_to} />
      </div>
      {items.length > 0 && (
        <>
          <div className="tb-crew-table-wrapper tb-crew-table-wrapper--paged">
            <table className="tb-crew-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Order No.</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Package Type</th>
                  <th>Remaining Qty</th>
                </tr>
              </thead>
              <tbody>
                {pagedItems.map((item, i) => (
                  <tr key={item.dispatch_note_item_id ?? i}>
                    <td>{(pageSafe - 1) * CREW_PAGE_SIZE + i + 1}</td>
                    <td>{item.order_no ?? item.po_no ?? "—"}</td>
                    <td>{item.description ?? "—"}</td>
                    <td>{item.quantity ?? "—"}</td>
                    <td>{item.package_type ?? "—"}</td>
                    <td>{item.remaining_qty ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={pageSafe}
            totalPages={totalPages}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          />
        </>
      )}
      {documents.length > 0 && (
        <div className="tb-excel-upload-row">
          {documents.map((doc) => (
            <a
              key={doc.material_document_id}
              href={doc.file_url}
              target="_blank"
              rel="noreferrer"
              className="tb-excel-upload-filename"
            >
              {doc.file_name ?? "Document"}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

MaterialDispatchListing.propTypes = {
  materialDispatch: PropTypes.object,
};

function ThirdPartyServiceListing({ serviceName, vesselName }) {
  return (
    <div className="tb-scenario-section">
      <h3 className="tb-section-title">Service Details</h3>
      <div className="tb-info-grid">
        <InfoCard label="Service Name" value={serviceName} />
        <InfoCard label="Vessel Name" value={vesselName} />
      </div>
    </div>
  );
}

ThirdPartyServiceListing.propTypes = {
  serviceName: PropTypes.string,
  vesselName:  PropTypes.string,
};

const TAXI_BOAT_OPERATOR_ROLE_ID = "20";
const TAXI_BOAT_CAPTAIN_ROLE_ID = "21";

function TaxiBoatCardView({ card, userRoleId = null }) {
  const serviceType = card?.typeOfService ?? "—";
  const isTaxiBoatOperator = String(userRoleId ?? "") === TAXI_BOAT_OPERATOR_ROLE_ID;
  const isTaxiBoatCaptain  = String(userRoleId ?? "") === TAXI_BOAT_CAPTAIN_ROLE_ID;

  // A Taxi Boat Operator account has no separate operator record — confirmed with
  // backend that this login's own userid IS its operator_id (no dedicated field
  // exists on the user/login response, unlike e.g. vendor_id for vendor logins).
  const loggedInUserId = useAuthReducer((s) => s.userProfile?.userid ?? s.authData?.userid ?? null);
  const notifyError = useAlertReducer((s) => s.error);
  const notifySuccess = useAlertReducer((s) => s.success);

  // Taxi Board only: get_call_detail / get_call_detail_by_id removed per Dany Thomas
  // (2026-08-27) — launch_hire/get_taxiboat_booking_detail/{booking_id} is now the sole
  // source for this card's values (vessel/billing/operator/captain/location/booking date),
  // falling back to the raw board card only while it's loading.
  const vendorId = card?.vendor_id ?? card?.raw?.vendor_id
    ?? (isTaxiBoatOperator ? loggedInUserId : null);
  const bookingId = card?.booking_id ?? card?.raw?.booking_id ?? card?.raw?.launch_hire_booking_id
    ?? card?.raw?.crew_immigration_booking_id ?? card?.callId ?? card?.id ?? null;

  const [locationEdit, setLocationEdit] = useState(() => card?.location ?? "");

  const [dropTs, setDropTs] = useState(() =>
    makeTsState(STANDARD_TIMESTAMPS.map((t) => t.key))
  );
  const [pickupTs, setPickupTs] = useState(() =>
    makeTsState(STANDARD_TIMESTAMPS.map((t) => t.key))
  );
  const [activeTab, setActiveTab] = useState("pickup");
  const [jobCompleted, setJobCompleted] = useState(false);
  const [jobCompletedAt, setJobCompletedAt] = useState(null);
  const [launchSlipFile, setLaunchSlipFile] = useState(null);
  const [dropCobTime, setDropCobTime] = useState(null);
  const [pickupCobTime, setPickupCobTime] = useState(null);
  const [dropStepBackLog, setDropStepBackLog] = useState([]);
  const [pickupStepBackLog, setPickupStepBackLog] = useState([]);
  const [undoPending, setUndoPending] = useState(null); // { label, resetter }
  const [, setCaptainCrewlistOpen] = useState(false);
  // Captain default view is Movement Timestamps — the read-only item_type listing (material
  // inbound/dispatch, transport/medical/hotel crew, third-party service) is tucked behind
  // this toggle instead of showing inline, mirroring CrewListBatchwisePanel's Crewlist toggle.
  const [itemDetailsOpen, setItemDetailsOpen] = useState(false);

  // Operator name recorded with each timestamp
  const [operatorName] = useState(() => card?.requestedOperator ?? "");
  const [dropTsOps, setDropTsOps] = useState(() => makeTsState(STANDARD_TIMESTAMPS.map(t => t.key)));
  const [pickupTsOps, setPickupTsOps] = useState(() => makeTsState(STANDARD_TIMESTAMPS.map(t => t.key)));

  // Intermediate trip form
  const addPendingCard = useCTPendingCards((state) => state.addPendingCard);
  const [addTripOpen, setAddTripOpen] = useState(false);
  const [addTripPurpose, setAddTripPurpose] = useState("");
  const [addTripEntityId, setAddTripEntityId] = useState("");
  const [addTripDate, setAddTripDate] = useState("");
  const [addTripTime, setAddTripTime] = useState("");
  const [tripAdded, setTripAdded] = useState(false);
  const [tripSubmitting, setTripSubmitting] = useState(false);

  // Billing entities — /billingentity — used for the intermediate trip's Billing Entity select
  const { billingEntities, isLoading: isLoadingBillingEntities, getBillingEntities } =
    useBillingEntityReducer((state) => state);
  useEffect(() => {
    getBillingEntities({ params: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const billingEntityOptions = (billingEntities ?? []).map((entity) => ({
    value: String(entity.entity_id),
    label: entity.billing_entity,
  }));
  const addTripEntityName = billingEntityOptions.find((opt) => opt.value === String(addTripEntityId))?.label ?? "";

  // Taxi fleet assignment
  const {
    fleets, isLoadingFleets, getFleetsByOperator,
    captains, isLoadingCaptains, getCaptainsByTaxiBoat, resetCaptains,
    isAssigning, assignCaptain,
  } = useTaxiBoatAssignmentReducer((state) => state);
  const [selectedFleet, setSelectedFleet] = useState(null);
  const [selectedCaptainId, setSelectedCaptainId] = useState(null);
  const [fleetAssigned, setFleetAssigned] = useState(false);
  const [assignedCaptainName, setAssignedCaptainName] = useState(null);
  const [bookingDateEdit, setBookingDateEdit] = useState(() => parseToInputDate(card?.bookingDate));
  const [bookingTimeEdit, setBookingTimeEdit] = useState("");

  useEffect(() => {
    if (!isTaxiBoatCaptain) getFleetsByOperator(vendorId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTaxiBoatCaptain, vendorId]);

  const handleSelectFleet = useCallback((fleet) => {
    setSelectedFleet(fleet);
    setSelectedCaptainId(null);
    resetCaptains();
    getCaptainsByTaxiBoat(fleet.taxi_boat_id);
  }, [resetCaptains, getCaptainsByTaxiBoat]);

  // An operator has a single taxi boat (get_fleet_by_operator returns one fleet), so
  // pre-select it as soon as it loads to populate the Assigned Captain dropdown.
  useEffect(() => {
    if (isTaxiBoatCaptain || selectedFleet || fleets.length === 0) return;
    handleSelectFleet(fleets[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTaxiBoatCaptain, fleets, selectedFleet]);

  // Captain selection now lives inside the Fleet card in TaxiFleetAssignPanel — picking a
  // captain there assigns immediately (same one-step flow the old summary dropdown used).
  const handleSummaryCaptainSelect = useCallback((captainId) => {
    const taxiBoatId = selectedFleet?.taxi_boat_id ?? fleets[0]?.taxi_boat_id;
    if (!captainId || !taxiBoatId) return;
    if (!locationEdit || !bookingDateEdit || !bookingTimeEdit) {
      notifyError("Location and booking date/time are required before assigning a captain.");
      return;
    }
    setSelectedCaptainId(captainId);
    const captain = captains.find((c) => String(c.taxiboat_captain_id) === String(captainId));
    assignCaptain({
      booking_id: bookingId,
      taxi_boat_id: taxiBoatId,
      taxiboat_captain_id: captainId,
      booking_datetime: buildApiDateTime(bookingDateEdit, bookingTimeEdit),
      location: locationEdit,
      cb: () => {
        setFleetAssigned(true);
        setAssignedCaptainName(captain?.captain_name ?? null);
      },
    });
  }, [selectedFleet, fleets, captains, bookingId, assignCaptain, locationEdit, bookingDateEdit, bookingTimeEdit, notifyError]);

  // Live clock — ticks every second for the live waiting timer on pending steps
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Operator quick-select — recent names from Zustand store
  const recentOps = useTaxiBoatStore((s) => s.recentOperators);
  const addRecentOperator = useTaxiBoatStore((s) => s.addRecentOperator);
  const [opFocusedBatch, setOpFocusedBatch] = useState(null);
  const opBlurTimer = useRef(null);

  const handleOpBlur = useCallback((operator) => {
    opBlurTimer.current = setTimeout(() => {
      if (operator?.trim()) addRecentOperator(operator);
      setOpFocusedBatch(null);
    }, 150);
  }, [addRecentOperator]);

  const handleOpChipClick = useCallback((batchIdx, op) => {
    clearTimeout(opBlurTimer.current);
    setBatches((prev) =>
      prev.map((b, i) => (i === batchIdx ? { ...b, operator: op } : b))
    );
    setOpFocusedBatch(null);
  }, []);

  // Scenario A: Crew Change
  const [signMode, setSignMode] = useState("sign-on");
  const [parsedCrewRows] = useState(() => {
    if (!Array.isArray(card?.crew) || card.crew.length === 0) return null;
    return card.crew.map((c) => ({
      name:        c.crewName     ?? "—",
      rank:        c.rank         ?? "—",
      nationality: c.nationality  ?? "—",
      passportNo:  c.passportNo   ?? "—",
      seamanBookNo: c.seamanBookNo ?? "—",
    }));
  });
  const crewFromCard = Array.isArray(card?.crew) && card.crew.length > 0;

  // Scenario A: Crew Change — own timestamps + print/upload
  const [crewTs, setCrewTs]               = useState(() => makeTsState(STANDARD_TIMESTAMPS.map((t) => t.key)));
  const [crewTsOps, setCrewTsOps]         = useState(() => makeTsState(STANDARD_TIMESTAMPS.map((t) => t.key)));
  const [crewStepBackLog, setCrewStepBackLog] = useState([]);
  const [crewJobCompleted, setCrewJobCompleted]   = useState(false);
  const [crewJobCompletedAt, setCrewJobCompletedAt] = useState(null);
  const [crewLaunchSlipFile, setCrewLaunchSlipFile] = useState(null);
  const [crewCobTime, setCrewCobTime]     = useState(null);

  // Scenario B: Material / Provision / Garbage
  const [packingListFile, setPackingListFile] = useState(null);
  const parsedPackingRows = packingListFile ? MOCK_PACKING_LIST_ROWS : null;

  // Scenario C: unified batch state — each batch has its own crew count, operator, timestamps, and file
  const [activeBatchTab, setActiveBatchTab] = useState(0);
  const [batches, setBatches] = useState(() => {
    const initKeys = STANDARD_TIMESTAMPS.map((t) => t.key);
    const initLegs = () => ({ drop: makeLegState(initKeys), pickup: makeLegState(initKeys) });
    return [
      { id: 1, crewCount: "10", operator: "", legs: initLegs() },
      { id: 2, crewCount: "8",  operator: "", legs: initLegs() },
      { id: 3, crewCount: "6",  operator: "", legs: initLegs() },
      { id: 4, crewCount: "5",  operator: "", legs: initLegs() },
    ];
  });

  // launch_hire/get_taxiboat_booking_detail/{booking_id} — carries the fleet/captain
  // already assigned to this booking (needed for launch_hire/create_intermediate_trip),
  // and — critically — item_type, which is the real source of truth for which scenario
  // to render below. Only fall back to the legacy typeOfService matching when item_type
  // is missing/unrecognized (e.g. still loading).
  const [taxiboatBookingDetail, setTaxiboatBookingDetail] = useState(null);
  const [isLoadingBookingDetail, setIsLoadingBookingDetail] = useState(true);
  useEffect(() => {
    if (bookingId == null) { setIsLoadingBookingDetail(false); return undefined; }
    let cancelled = false;
    setIsLoadingBookingDetail(true);
    launchHireService.getTaxiboatBookingDetail(bookingId)
      .then((res) => {
        if (!cancelled) setTaxiboatBookingDetail(res?.data?.data ?? res?.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setTaxiboatBookingDetail(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingBookingDetail(false);
      });
    return () => { cancelled = true; };
  }, [bookingId]);

  // get_taxiboat_booking_detail also carries the confirmed location/booking_datetime for
  // this booking — sync them into the operator's editable fields once loaded, so they
  // don't sit blank behind the "Select a location" / empty date-time placeholders.
  useEffect(() => {
    if (!taxiboatBookingDetail) return;
    if (taxiboatBookingDetail.location) setLocationEdit(taxiboatBookingDetail.location);
    const { date, time } = splitApiDateTimeParts(taxiboatBookingDetail.booking_datetime);
    if (date) setBookingDateEdit(date);
    if (time) setBookingTimeEdit(time);
  }, [taxiboatBookingDetail]);

  // Confirmed with backend (Dany Thomas, 2026-08-27): get_taxiboat_booking_detail is the
  // source of truth for the summary card — bind every value it carries from here, falling
  // back to call_file/get_call_detail_by_id or the raw board card only while it's loading
  // (or for legacy cards with no booking yet).
  const location = taxiboatBookingDetail?.location ?? card?.location ?? "—";
  const bookingDate = taxiboatBookingDetail?.booking_datetime
    ? safeFormatDate(taxiboatBookingDetail.booking_datetime)
    : (card?.bookingDate ?? "—");
  const vesselName = taxiboatBookingDetail?.vessel?.vessel_name ?? card?.vesselName ?? "—";
  const billingEntity = taxiboatBookingDetail?.billing_entity?.billing_entity ?? card?.name ?? "—";
  const requestedOperator = taxiboatBookingDetail?.operator?.name ?? card?.requestedOperator ?? "—";
  const assignedUser = taxiboatBookingDetail?.captain?.captain_name ?? card?.user ?? "—";

  // The booking may already have a confirmed fleet/captain (captain_assigned: true) from
  // a previous session — hydrate the assignment panel from it instead of only setting
  // fleetAssigned/assignedCaptainName after a fresh in-session assignCaptain call.
  useEffect(() => {
    if (isTaxiBoatCaptain || !taxiboatBookingDetail?.captain_assigned) return;
    const bookingFleetId = taxiboatBookingDetail?.fleet?.taxi_boat_id ?? taxiboatBookingDetail?.captain?.taxi_boat_id;
    const matchedFleet = fleets.find((f) => String(f.taxi_boat_id) === String(bookingFleetId)) ?? null;
    if (matchedFleet) setSelectedFleet(matchedFleet);
    setSelectedCaptainId(taxiboatBookingDetail?.captain?.taxiboat_captain_id ?? null);
    setAssignedCaptainName(taxiboatBookingDetail?.captain?.captain_name ?? null);
    setFleetAssigned(true);
  }, [isTaxiBoatCaptain, taxiboatBookingDetail, fleets]);

  // Single-item bookings (everything except the batchwise immigration flow) carry their
  // launch_hire_booking_item_id at the top level of get_taxiboat_booking_detail — this is
  // what record_taxiboat_timestamp/cancel_taxiboat_timestamp need for the Captain's Drop/
  // Pickup checkpoint capture below.
  const genericBookingItemId = taxiboatBookingDetail?.launch_hire_booking_item_id ?? null;

  const recordGenericCheckpoint = useCallback((legKey, checkpoint) => {
    if (genericBookingItemId == null || !checkpoint) return;
    launchHireService
      .recordTaxiboatTimestamp({
        booking_item_id: genericBookingItemId,
        trip_type: legKey === "drop" ? "Drop" : "Pickup",
        checkpoint,
      })
      .catch((err) => {
        notifyError(err?.response?.data?.message ?? err.message ?? "Failed to record timestamp");
      });
  }, [genericBookingItemId, notifyError]);

  const cancelGenericCheckpoint = useCallback((legKey, checkpoint, reasonCode, reasonText) => {
    if (genericBookingItemId == null || !checkpoint) return;
    launchHireService
      .cancelTaxiboatTimestamp({
        booking_item_id: genericBookingItemId,
        trip_type: legKey === "drop" ? "Drop" : "Pickup",
        checkpoint,
        reason_code: reasonCode,
        reason_text: reasonText || null,
      })
      .catch((err) => {
        notifyError(err?.response?.data?.message ?? err.message ?? "Failed to undo timestamp");
      });
  }, [genericBookingItemId, notifyError]);

  const rawItemType = taxiboatBookingDetail?.item_type ?? null;
  const itemType = KNOWN_ITEM_TYPES.has(rawItemType) ? rawItemType : null;

  const isCrewChange = itemType ? itemType === "crew_change" : CREW_CHANGE_SERVICES.includes(serviceType);
  const isImmigration = itemType ? itemType === "crew_immigration_batch" : IMMIGRATION_SERVICES.includes(serviceType);
  // Legacy mock Excel-upload panel — only reachable once item_type is unknown, since
  // material_inbound/material_dispatch now have their own real listings below.
  const isMaterialService = itemType ? false : MATERIAL_SERVICES.includes(serviceType);
  const isMaterialInbound = itemType === "material_inbound";
  const isMaterialDispatch = itemType === "material_dispatch";
  const isTransportRequest = itemType === "transport_request";
  const isMedicalRequest = itemType === "medical_request";
  const isHotelRequest = itemType === "hotel_request";
  const isThirdPartyService = itemType === "third_party_service_request" || itemType === "addon_service_request";
  const hasNewItemTypeListing = isMaterialInbound || isMaterialDispatch || isTransportRequest || isMedicalRequest || isHotelRequest || isThirdPartyService;

  // Crew List — Batchwise is shown for Immigration Clearance and as the Captain/Operator
  // default view; load real batches from the booking wherever it's shown.
  const showsBatchwisePanel = isImmigration;
  useEffect(() => {
    if (!showsBatchwisePanel || bookingId == null) return undefined;
    let cancelled = false;
    launchHireService.getCrewImmigrationBooking(bookingId)
      .then((res) => {
        if (cancelled) return;
        const data = res?.data?.data ?? res?.data ?? {};
        const mapped = mapImmigrationBatches(data?.batches);
        if (mapped.length > 0) {
          setBatches(mapped);
          setActiveBatchTab(0);
        }
      })
      .catch(() => {
        /* keep existing/mock batches on failure */
      });
    return () => { cancelled = true; };
  }, [showsBatchwisePanel, bookingId]);

  // launch_hire/get_booking_timestamps/{booking_id} — booking-level Drop/Pickup checkpoints.
  // Shown by the generic Movement Timestamps section below: for the legacy "no item_type
  // recognized yet" fallback, and for the new read-only item_type listings (transport/
  // medical/hotel requests, material inbound/dispatch, third-party/addon services). The
  // Taxi Boat Operator only assigns the fleet/captain and views the listing — the Captain
  // is the one who actually performs the trip, so Operators never see this capture panel.
  // For the Captain, Movement Timestamps is the default view for the new item_type
  // listings — the listing itself is tucked behind the Details toggle instead (see
  // itemDetailsOpen/showItemTypeListingContent below), so the two never show at once.
  const showsGenericTimestamps = isTaxiBoatOperator
    ? false
    : hasNewItemTypeListing
      ? (!isTaxiBoatCaptain || !itemDetailsOpen)
      : (!isImmigration && !isCrewChange && !isMaterialService && !isTaxiBoatCaptain);

  // The new read-only item_type listings show inline for every role except Captain, who
  // instead sees Movement Timestamps by default and reveals the listing via the toggle.
  const showItemTypeListingContent = hasNewItemTypeListing && (!isTaxiBoatCaptain || itemDetailsOpen);
  useEffect(() => {
    if (!showsGenericTimestamps || bookingId == null) return undefined;
    let cancelled = false;
    launchHireService.getBookingTimestamps(bookingId)
      .then((res) => {
        if (cancelled) return;
        const data = res?.data?.data ?? res?.data ?? {};
        const dropMapped = mapBookingTimestampLeg(data?.drop);
        const pickupMapped = mapBookingTimestampLeg(data?.pickup);
        setDropTs(dropMapped.ts);
        setDropTsOps(dropMapped.tsOps);
        setPickupTs(pickupMapped.ts);
        setPickupTsOps(pickupMapped.tsOps);
        if (dropMapped.completed || pickupMapped.completed) {
          setJobCompleted(true);
          setJobCompletedAt(dropMapped.completedAt ?? pickupMapped.completedAt);
        }
      })
      .catch(() => {
        /* keep existing/mock timestamps on failure */
      });
    return () => { cancelled = true; };
  }, [showsGenericTimestamps, bookingId]);

  const captureNow = useCallback((setter, key, opSetter, operator) => {
    setter((prev) => ({ ...prev, [key]: new Date().toISOString() }));
    if (opSetter) opSetter((prev) => ({ ...prev, [key]: operator || "—" }));
  }, []);

  const recordCheckpoint = useCallback((batchIdx, legKey, checkpoint) => {
    const batch = batches[batchIdx];
    if (batch?.bookingItemId == null || !checkpoint) return;
    launchHireService
      .recordTaxiboatTimestamp({
        booking_item_id: batch.bookingItemId,
        trip_type: legKey === "drop" ? "Drop" : "Pickup",
        checkpoint,
      })
      .catch((err) => {
        notifyError(err?.response?.data?.message ?? err.message ?? "Failed to record timestamp");
      });
  }, [batches, notifyError]);

  const captureBatchTs = useCallback((batchIdx, legKey, key) => {
    setBatches((prev) =>
      prev.map((b, i) =>
        i === batchIdx
          ? {
              ...b,
              legs: {
                ...b.legs,
                [legKey]: {
                  ...b.legs[legKey],
                  ts: { ...b.legs[legKey].ts, [key]: new Date().toISOString() },
                  tsOps: { ...b.legs[legKey].tsOps, [key]: b.operator || "—" },
                },
              },
            }
          : b
      )
    );
    recordCheckpoint(batchIdx, legKey, CHECKPOINT_BY_KEY[key]);
  }, [recordCheckpoint]);

  const completeBatchLeg = useCallback((batchIdx, legKey) => {
    const completedAt = new Date().toISOString();
    setBatches((prev) =>
      prev.map((b, i) =>
        i === batchIdx
          ? { ...b, legs: { ...b.legs, [legKey]: { ...b.legs[legKey], completed: true, completedAt } } }
          : b
      )
    );
    recordCheckpoint(batchIdx, legKey, TRIP_COMPLETED_CHECKPOINT);
  }, [recordCheckpoint]);

  const cancelBatchTs = useCallback((batchIdx, legKey, key, reasonCode, reasonText) => {
    const checkpoint = CHECKPOINT_BY_KEY[key];
    const bookingItemId = batches[batchIdx]?.bookingItemId;
    if (bookingItemId == null || !checkpoint) return;
    launchHireService
      .cancelTaxiboatTimestamp({
        booking_item_id: bookingItemId,
        trip_type: legKey === "drop" ? "Drop" : "Pickup",
        checkpoint,
        reason_code: reasonCode,
        reason_text: reasonText || null,
      })
      .catch((err) => {
        notifyError(err?.response?.data?.message ?? err.message ?? "Failed to undo timestamp");
      });
  }, [batches, notifyError]);

  const handleAddTripToggle = useCallback(() => {
    setAddTripDate((prev) => prev || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`);
    setAddTripTime((prev) => prev || `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    setAddTripOpen((open) => !open);
  }, [now]);

  const handleAddTrip = useCallback(() => {
    if (!addTripPurpose.trim() || !addTripEntityId || !addTripDate || !addTripTime) return;
    if (bookingId == null) return;
    setTripSubmitting(true);
    launchHireService
      .createIntermediateTrip({
        booking_id: bookingId,
        entity_id: addTripEntityId,
        purpose: addTripPurpose.trim(),
        booking_datetime: buildApiDateTime(addTripDate, addTripTime),
      })
      .then(({ data }) => {
        notifySuccess(data?.message ?? "Intermediate trip added successfully");
        addPendingCard({
          id: `ct-extra-${Date.now()}`,
          typeOfService: addTripPurpose.trim(),
          name: addTripEntityName || billingEntity,
          vesselName,
          progress: 0,
          timeLeft: "",
        });
        setTripAdded(true);
        setAddTripOpen(false);
      })
      .catch((err) => {
        notifyError(err?.response?.data?.message ?? err.message ?? "Failed to add intermediate trip");
      })
      .finally(() => setTripSubmitting(false));
  }, [
    addTripPurpose, addTripEntityId, addTripEntityName, addTripDate, addTripTime,
    bookingId, billingEntity, vesselName, addPendingCard, notifySuccess, notifyError,
  ]);

  const allDone = (tsState, keys) => keys.every((k) => tsState[k] !== null);

  const tsKeys = STANDARD_TIMESTAMPS.map((t) => t.key);

  const printLaunchSlip = useCallback((tsState, tabLabel, guide, completedAt) => {
    const slip = window.open("", "_blank", "width=820,height=680");
    if (!slip) return;
    const tsRows = STANDARD_TIMESTAMPS.map(({ key, label }, i) => {
      const val = tsState[key];
      const prevKey = i > 0 ? STANDARD_TIMESTAMPS[i - 1].key : null;
      const prevVal = prevKey ? tsState[prevKey] : null;
      const dur = val && prevVal ? formatDuration(new Date(val) - new Date(prevVal)) : null;
      return `<tr>
        <td>${label}</td>
        <td>${val ? formatDateTime(val) : "—"}</td>
        <td>${dur ?? "—"}</td>
      </tr>`;
    }).join("");
    slip.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Launch Slip</title>
<style>
  body{font-family:Arial,sans-serif;padding:36px 40px;color:#111;font-size:13px;}
  h1{font-size:20px;margin:0 0 2px;letter-spacing:.01em;}
  .sub{font-size:12px;color:#555;margin-bottom:18px;}
  .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin-bottom:20px;}
  .meta-item{display:flex;flex-direction:column;gap:1px;}
  .meta-label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.05em;}
  .meta-value{font-size:13px;font-weight:600;}
  table{width:100%;border-collapse:collapse;margin-bottom:22px;}
  th{background:#f1f5f9;font-size:11px;text-align:left;padding:7px 10px;border:1px solid #e2e8f0;}
  td{font-size:12px;padding:7px 10px;border:1px solid #e2e8f0;vertical-align:top;}
  .sig-row{display:flex;gap:32px;margin-top:40px;}
  .sig-box{flex:1;border-top:1.5px solid #111;padding-top:8px;font-size:11px;color:#444;}
  .footer{margin-top:24px;font-size:10px;color:#aaa;text-align:center;}
  @media print{body{padding:0;}}
</style></head><body>
  <h1>Launch Slip &mdash; ${tabLabel}</h1>
  <div class="sub">Printed: ${new Date().toLocaleString("en-GB")}</div>
  <div class="meta-grid">
    <div class="meta-item"><span class="meta-label">Vessel</span><span class="meta-value">${vesselName}</span></div>
    <div class="meta-item"><span class="meta-label">Service Type</span><span class="meta-value">${serviceType}</span></div>
    <div class="meta-item"><span class="meta-label">Billing Entity</span><span class="meta-value">${billingEntity}</span></div>
    <div class="meta-item"><span class="meta-label">Requested Operator</span><span class="meta-value">${requestedOperator}</span></div>
    <div class="meta-item"><span class="meta-label">Location</span><span class="meta-value">${location}</span></div>
    ${guide ? `<div class="meta-item"><span class="meta-label">Taxi Boat Guide</span><span class="meta-value">${guide}</span></div>` : ""}
    ${completedAt ? `<div class="meta-item"><span class="meta-label">Trip Completed</span><span class="meta-value">${formatDateTime(completedAt)}</span></div>` : ""}
  </div>
  <table>
    <thead><tr><th>Step</th><th>Captured Time</th><th>Duration</th></tr></thead>
    <tbody>${tsRows}</tbody>
  </table>
  <div class="sig-row">
    <div class="sig-box">Operator Signature</div>
    <div class="sig-box">Captain / OIM Signature</div>
    <div class="sig-box">Date &amp; Time</div>
  </div>
  <div class="footer">Sedres &mdash; Taxi Boat Launch Slip</div>
</body></html>`);
    slip.document.close();
    slip.focus();
    setTimeout(() => slip.print(), 250);
  }, [vesselName, serviceType, billingEntity, requestedOperator, location]);

  // taxiboatBookingDetail carries vessel/operator/billing/item_type — the scenario switch
  // above depends on it, so render nothing scenario-specific (mock data, wrong panel)
  // until it has settled.
  if (isLoadingBookingDetail) {
    return (
      <div className="tb-card-view">
        <CardTabListLoading message="Loading taxi boat booking…" />
      </div>
    );
  }

  // Print/Upload actions for the generic Movement Timestamps section — rendered inside
  // TimestampSummaryTable's header (top-right, next to the "Timestamps Summary" title)
  // instead of below the table.
  const launchSlipActions = jobCompleted && (
    <div className="tb-batch-actions tb-batch-actions--end">
      <button
        className="tb-batch-print-btn"
        onClick={() => printLaunchSlip(activeTab === "drop" ? dropTs : pickupTs, activeTab === "drop" ? "Drop Trip" : "Pickup Trip", operatorName, jobCompletedAt)}
      >
        <FiPrinter size={14} />
        Print Launch Slip
      </button>
      <div>
        <input
          type="file"
          id="tb-launch-slip-file"
          className="tb-launch-slip-input"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => setLaunchSlipFile(e.target.files?.[0] ?? null)}
        />
        <label htmlFor="tb-launch-slip-file" className="tb-batch-upload-btn">
          <FiUpload size={14} />
          {launchSlipFile ? launchSlipFile.name : "Upload Launch Slip"}
        </label>
      </div>
    </div>
  );

  return (
    <div className="tb-card-view">
      <div className={`gro-summary-grid${isTaxiBoatOperator ? "" : " gro-summary-grid--six-col"}`}>
        {!isTaxiBoatOperator && (
          <GroSummaryCard label="Requested Operator" value={requestedOperator} />
        )}
        <GroSummaryCard label="Billing Entity" value={billingEntity} />
        <GroSummaryCard label="Vessel Name"    value={vesselName}    />
        {isTaxiBoatOperator ? (
          <GroSummaryFieldCard label="Location">
            <SearchableSelect
              className="tb-summary-select"
              value={locationEdit}
              onChange={(e) => setLocationEdit(e.target.value)}
              options={LOCATION_OPTIONS.map((opt) => ({ value: opt, label: opt }))}
              placeholder="Select a location"
            />
          </GroSummaryFieldCard>
        ) : (
          <GroSummaryCard label="Location" value={location} />
        )}
        {isTaxiBoatOperator ? (
          <GroSummaryFieldCard label="Booking Date">
            <DateTimePickerField
              dateValue={bookingDateEdit}
              timeValue={bookingTimeEdit}
              onDateChange={(e) => setBookingDateEdit(e.target.value)}
              onTimeChange={(e) => setBookingTimeEdit(e.target.value)}
            />
          </GroSummaryFieldCard>
        ) : (
          <GroSummaryCard label="Booking Date" value={bookingDate} />
        )}
        {/* Captain selection now happens inside the Fleet card in TaxiFleetAssignPanel below,
            connected right next to the fleet it's being assigned to. */}
        <GroSummaryCard label="Assigned Captian" value={isTaxiBoatOperator ? assignedCaptainName : assignedUser} />
      </div>

      {isTaxiBoatCaptain ? (
        // Batchwise crew header only makes sense for immigration-style multi-batch trips —
        // the new read-only item_type listings (material/transport/medical/hotel/third-party)
        // render their own section below instead.
        !hasNewItemTypeListing && (
          <CrewListBatchwisePanel
            batches={batches}
            setBatches={setBatches}
            activeBatchTab={activeBatchTab}
            setActiveBatchTab={setActiveBatchTab}
            opFocusedBatch={opFocusedBatch}
            setOpFocusedBatch={setOpFocusedBatch}
            recentOps={recentOps}
            handleOpBlur={handleOpBlur}
            handleOpChipClick={handleOpChipClick}
            captureBatchTs={captureBatchTs}
            completeBatchLeg={completeBatchLeg}
            cancelBatchTs={cancelBatchTs}
            setUndoPending={setUndoPending}
            vesselName={vesselName}
            now={now}
            printLaunchSlip={printLaunchSlip}
            bookingId={bookingId}
            crewlistToggle
            onCrewlistChange={setCaptainCrewlistOpen}
            tripAdded={tripAdded}
            tripSubmitting={tripSubmitting}
            addTripOpen={addTripOpen}
            setAddTripOpen={setAddTripOpen}
            addTripPurpose={addTripPurpose}
            setAddTripPurpose={setAddTripPurpose}
            addTripEntityId={addTripEntityId}
            setAddTripEntityId={setAddTripEntityId}
            billingEntityOptions={billingEntityOptions}
            isLoadingBillingEntities={isLoadingBillingEntities}
            addTripDate={addTripDate}
            setAddTripDate={setAddTripDate}
            addTripTime={addTripTime}
            setAddTripTime={setAddTripTime}
            onAddTripToggle={handleAddTripToggle}
            handleAddTrip={handleAddTrip}
          />
        )
      ) : (
        <TaxiFleetAssignPanel
          fleets={fleets}
          isLoadingFleets={isLoadingFleets}
          selectedFleet={selectedFleet}
          onSelectFleet={handleSelectFleet}
          captains={captains}
          isLoadingCaptains={isLoadingCaptains}
          selectedCaptainId={selectedCaptainId}
          isAssigning={isAssigning}
          assigned={fleetAssigned}
          assignedCaptainName={assignedCaptainName}
          onAssignCaptain={handleSummaryCaptainSelect}
        />
      )}

      {/* Scenario A: Crew Change */}
      {isCrewChange && (
        <div className="tb-scenario-section">
          <h3 className="tb-section-title">Crew List</h3>
          <div className="tb-sign-mode-row">
            <div className="tb-sign-mode-toggle">
              <div className={`tb-sign-mode-slider${signMode === "sign-off" ? " tb-sign-mode-slider--off" : ""}`} />
              <button
                data-mode="sign-on"
                className={`tb-sign-mode-btn${signMode === "sign-on" ? " tb-sign-mode-btn--active" : ""}`}
                onClick={() => setSignMode("sign-on")}
              >
                <span className={`tb-ship-icon tb-ship-icon--in${signMode === "sign-on" ? " tb-ship-icon--sailing" : ""}`}>
                  <FaShip size={16} />
                </span>
                Sign On
              </button>
              <button
                data-mode="sign-off"
                className={`tb-sign-mode-btn${signMode === "sign-off" ? " tb-sign-mode-btn--active" : ""}`}
                onClick={() => setSignMode("sign-off")}
              >
                Sign Off
                <span className={`tb-ship-icon tb-ship-icon--out${signMode === "sign-off" ? " tb-ship-icon--sailing" : ""}`}>
                  <FaShip size={16} />
                </span>
              </button>
            </div>
            <span className="tb-sign-mode-hint">
              {signMode === "sign-on" ? "Crew boarding the vessel" : "Crew disembarking the vessel"}
            </span>
          </div>
          {parsedCrewRows && (
            <>
              <span className="tb-ai-parse-status">
                {crewFromCard
                  ? `From operator card — ${parsedCrewRows.length} crew members`
                  : `AI parsed — ${parsedCrewRows.length} crew members found`}
              </span>
              <div className="tb-crew-table-wrapper">
                <table className="tb-crew-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Rank</th>
                      <th>Nationality</th>
                      <th>Passport No.</th>
                      <th>Seaman Book No.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedCrewRows.map((row, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>{row.name}</td>
                        <td>{row.rank}</td>
                        <td>{row.nationality}</td>
                        <td>{row.passportNo}</td>
                        <td>{row.seamanBookNo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <h3 className="tb-section-title">Movement Timestamps</h3>
          <TimestampStepper
            timestamps={STANDARD_TIMESTAMPS}
            tsState={crewTs}
            tsOps={crewTsOps}
            shipName={vesselName}
            onCapture={(key) => captureNow(setCrewTs, key, setCrewTsOps, operatorName)}
            onComplete={() => { setCrewJobCompleted(true); setCrewJobCompletedAt(new Date().toISOString()); }}
            jobCompleted={crewJobCompleted}
            canFinish={STANDARD_TIMESTAMPS.every((t) => crewTs[t.key] !== null)}
            now={now}
            onUndo={(key, label) => setUndoPending({
              label,
              resetter: () => { setCrewTs((prev) => ({ ...prev, [key]: null })); setCrewTsOps((prev) => ({ ...prev, [key]: null })); setCrewJobCompleted(false); setCrewJobCompletedAt(null); },
              addToLog: (reason) => setCrewStepBackLog((prev) => [...prev, { step: label, reason, time: new Date().toISOString() }]),
            })}
          />
          <TimestampSummaryTable
            timestamps={STANDARD_TIMESTAMPS}
            tsState={crewTs}
            jobCompletedAt={crewJobCompletedAt}
            cobTime={crewCobTime}
            stepsAllDone={STANDARD_TIMESTAMPS.every((t) => crewTs[t.key] !== null)}
            stepBackLog={crewStepBackLog}
            onCaptureCob={() => setCrewCobTime(new Date().toISOString())}
          />
          {crewJobCompleted && (
            <div className="tb-batch-actions">
              <button
                className="tb-batch-print-btn"
                onClick={() => printLaunchSlip(crewTs, `Crew Change — ${signMode === "sign-on" ? "Sign On" : "Sign Off"}`, operatorName, crewJobCompletedAt)}
              >
                <FiPrinter size={14} />
                Print Launch Slip
              </button>
              <div>
                <input
                  type="file"
                  id="tb-crew-launch-slip-file"
                  className="tb-launch-slip-input"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setCrewLaunchSlipFile(e.target.files?.[0] ?? null)}
                />
                <label htmlFor="tb-crew-launch-slip-file" className="tb-batch-upload-btn">
                  <FiUpload size={14} />
                  {crewLaunchSlipFile ? crewLaunchSlipFile.name : "Upload Launch Slip"}
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scenario B: Material / Provision / Garbage Collection */}
      {isMaterialService && (
        <div className="tb-scenario-section">
          <h3 className="tb-section-title">Packing List</h3>
          <div className="tb-excel-upload-row">
            <input
              type="file"
              id="tb-packing-list-input"
              className="tb-excel-upload-input"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setPackingListFile(e.target.files?.[0] ?? null)}
            />
            <label htmlFor="tb-packing-list-input" className="tb-excel-upload-btn">
              <FiUpload size={15} />
              {packingListFile ? "Replace File" : "Upload Packing List"}
            </label>
            {packingListFile && (
              <span className="tb-excel-upload-filename">{packingListFile.name}</span>
            )}
          </div>
          {parsedPackingRows && (
            <>
              <span className="tb-ai-parse-status">
                AI parsed — {parsedPackingRows.length} items found
              </span>
              <div className="tb-crew-table-wrapper">
                <table className="tb-crew-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Item No.</th>
                      <th>Description</th>
                      <th>Qty</th>
                      <th>Unit</th>
                      <th>Weight (kg)</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedPackingRows.map((row, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>{row.itemNo}</td>
                        <td>{row.description}</td>
                        <td>{row.qty}</td>
                        <td>{row.unit}</td>
                        <td>{row.weight}</td>
                        <td>{row.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Scenario D: read-only item_type listings — material inbound/dispatch, transport/
          medical/hotel request crew, third-party/addon services. For the Captain, this is
          tucked behind the Details toggle instead of showing alongside Movement Timestamps. */}
      {isTaxiBoatCaptain && hasNewItemTypeListing && (
        <div className="tb-crewlist-toggle-row">
          <button
            type="button"
            className="tb-crewlist-toggle-btn"
            onClick={() => setItemDetailsOpen((open) => !open)}
          >
            {itemDetailsOpen ? (
              <>
                <FiArrowLeft size={14} />
                Back
              </>
            ) : (
              <>
                <FiUser size={14} />
                Details
              </>
            )}
          </button>
        </div>
      )}
      {showItemTypeListingContent && isMaterialInbound && (
        <MaterialInboundListing materialInbound={taxiboatBookingDetail?.material_inbound} />
      )}
      {showItemTypeListingContent && isMaterialDispatch && (
        <MaterialDispatchListing materialDispatch={taxiboatBookingDetail?.material_dispatch} />
      )}
      {showItemTypeListingContent && (isTransportRequest || isMedicalRequest || isHotelRequest) && (
        <ItemTypeCrewListing
          title={
            isTransportRequest ? "Transport Request — Crew"
              : isMedicalRequest ? "Medical Request — Crew"
              : "Hotel Request — Crew"
          }
          crew={taxiboatBookingDetail?.crew}
          showCompletedDate={isMedicalRequest}
        />
      )}
      {showItemTypeListingContent && isThirdPartyService && (
        <ThirdPartyServiceListing
          serviceName={taxiboatBookingDetail?.service_name}
          vesselName={vesselName}
        />
      )}

      {/* Scenario C: Immigration Clearance — per-batch tabs (Captain already sees this above, in place of Fleet Assignment) */}
      {isImmigration && !isTaxiBoatCaptain && (
        <CrewListBatchwisePanel
          batches={batches}
          setBatches={setBatches}
          activeBatchTab={activeBatchTab}
          setActiveBatchTab={setActiveBatchTab}
          opFocusedBatch={opFocusedBatch}
          setOpFocusedBatch={setOpFocusedBatch}
          recentOps={recentOps}
          handleOpBlur={handleOpBlur}
          handleOpChipClick={handleOpChipClick}
          captureBatchTs={captureBatchTs}
          completeBatchLeg={completeBatchLeg}
          cancelBatchTs={cancelBatchTs}
          setUndoPending={setUndoPending}
          vesselName={vesselName}
          now={now}
          printLaunchSlip={printLaunchSlip}
          bookingId={bookingId}
          hideStepper={isTaxiBoatOperator}
        />
      )}

      {!isImmigration && !isCrewChange && !hasNewItemTypeListing && isTaxiBoatOperator && (
        <CrewListBatchwisePanel
          batches={batches}
          setBatches={setBatches}
          activeBatchTab={activeBatchTab}
          setActiveBatchTab={setActiveBatchTab}
          opFocusedBatch={opFocusedBatch}
          setOpFocusedBatch={setOpFocusedBatch}
          recentOps={recentOps}
          handleOpBlur={handleOpBlur}
          handleOpChipClick={handleOpChipClick}
          captureBatchTs={captureBatchTs}
          completeBatchLeg={completeBatchLeg}
          cancelBatchTs={cancelBatchTs}
          setUndoPending={setUndoPending}
          vesselName={vesselName}
          now={now}
          printLaunchSlip={printLaunchSlip}
          bookingId={bookingId}
          hideStepper={isTaxiBoatOperator}
        />
      )}

      {showsGenericTimestamps && (
        <div className="tb-section">
          <h3 className="tb-section-title">Movement Timestamps</h3>
          <div className="tb-tabs">
            <div className="tb-tabs-group">
              <button
                className={`tb-tab${activeTab === "pickup" ? " tb-tab--active" : ""}`}
                onClick={() => setActiveTab("pickup")}
              >
                <span
                  key={`pickup-${activeTab}`}
                  className={`tb-tab-vessel-wrap${activeTab === "pickup" ? " tb-tab-vessel-wrap--pickup-firing" : ""}`}
                >
                  <FaShip size={12} />
                  <span className="tb-tab-cargo-dot" />
                </span>
                Pickup
              </button>
              <button
                className={`tb-tab${activeTab === "drop" ? " tb-tab--active" : ""}`}
                onClick={() => setActiveTab("drop")}
              >
                <span
                  key={`drop-${activeTab}`}
                  className={`tb-tab-vessel-wrap${activeTab === "drop" ? " tb-tab-vessel-wrap--drop-firing" : ""}`}
                >
                  <FaShip size={12} />
                  <span className="tb-tab-cargo-dot" />
                </span>
                Drop
              </button>
            </div>

            {(tripAdded || (activeTab === "drop" ? dropTs.boatCastOffShip : pickupTs.boatCastOffShip)) && (
              <AddIntermediateTripControl
                tripAdded={tripAdded}
                open={addTripOpen}
                onToggle={handleAddTripToggle}
                onCancel={() => setAddTripOpen(false)}
                onSubmit={handleAddTrip}
                submitting={tripSubmitting}
                purpose={addTripPurpose}
                setPurpose={setAddTripPurpose}
                entityId={addTripEntityId}
                setEntityId={setAddTripEntityId}
                billingEntityOptions={billingEntityOptions}
                isLoadingBillingEntities={isLoadingBillingEntities}
                tripDate={addTripDate}
                setTripDate={setAddTripDate}
                tripTime={addTripTime}
                setTripTime={setAddTripTime}
                compact
              />
            )}
          </div>
          <div key={activeTab} className={`tb-ts-panel tb-ts-panel--${activeTab}`}>
            {activeTab === "drop" ? (
              <>
                <TimestampStepper
                  timestamps={STANDARD_TIMESTAMPS}
                  tsState={dropTs}
                  tsOps={dropTsOps}
                  shipName={vesselName}
                  intermediateTrip={tripAdded ? { purpose: addTripPurpose, billingEntity: addTripEntityName } : undefined}
                  onCapture={(key) => {
                    captureNow(setDropTs, key, setDropTsOps, operatorName);
                    recordGenericCheckpoint("drop", CHECKPOINT_BY_KEY[key]);
                  }}
                  onComplete={() => {
                    setJobCompleted(true);
                    setJobCompletedAt(new Date().toISOString());
                    recordGenericCheckpoint("drop", TRIP_COMPLETED_CHECKPOINT);
                  }}
                  jobCompleted={jobCompleted}
                  canFinish={allDone(dropTs, tsKeys)}
                  now={now}
                  onUndo={(key, label) => setUndoPending({
                    label,
                    resetter: () => { setDropTs((prev) => ({ ...prev, [key]: null })); setDropTsOps((prev) => ({ ...prev, [key]: null })); setJobCompleted(false); setJobCompletedAt(null); },
                    addToLog: (reason) => setDropStepBackLog((prev) => [...prev, { step: label, reason, time: new Date().toISOString() }]),
                    cancelApi: (reasonCode, reasonText) => cancelGenericCheckpoint("drop", CHECKPOINT_BY_KEY[key], reasonCode, reasonText),
                  })}
                />
                <TimestampSummaryTable
                  timestamps={STANDARD_TIMESTAMPS}
                  tsState={dropTs}
                  jobCompletedAt={jobCompletedAt}
                  cobTime={dropCobTime}
                  stepsAllDone={allDone(dropTs, tsKeys)}
                  stepBackLog={dropStepBackLog}
                  onCaptureCob={() => setDropCobTime(new Date().toISOString())}
                  headerAction={launchSlipActions}
                />
              </>
            ) : (
              <>
                <TimestampStepper
                  timestamps={STANDARD_TIMESTAMPS}
                  tsState={pickupTs}
                  tsOps={pickupTsOps}
                  shipName={vesselName}
                  intermediateTrip={tripAdded ? { purpose: addTripPurpose, billingEntity: addTripEntityName } : undefined}
                  onCapture={(key) => {
                    captureNow(setPickupTs, key, setPickupTsOps, operatorName);
                    recordGenericCheckpoint("pickup", CHECKPOINT_BY_KEY[key]);
                  }}
                  onComplete={() => {
                    setJobCompleted(true);
                    setJobCompletedAt(new Date().toISOString());
                    recordGenericCheckpoint("pickup", TRIP_COMPLETED_CHECKPOINT);
                  }}
                  jobCompleted={jobCompleted}
                  canFinish={allDone(pickupTs, tsKeys)}
                  now={now}
                  onUndo={(key, label) => setUndoPending({
                    label,
                    resetter: () => { setPickupTs((prev) => ({ ...prev, [key]: null })); setPickupTsOps((prev) => ({ ...prev, [key]: null })); setJobCompleted(false); setJobCompletedAt(null); },
                    addToLog: (reason) => setPickupStepBackLog((prev) => [...prev, { step: label, reason, time: new Date().toISOString() }]),
                    cancelApi: (reasonCode, reasonText) => cancelGenericCheckpoint("pickup", CHECKPOINT_BY_KEY[key], reasonCode, reasonText),
                  })}
                />
                <TimestampSummaryTable
                  timestamps={STANDARD_TIMESTAMPS}
                  tsState={pickupTs}
                  jobCompletedAt={jobCompletedAt}
                  cobTime={pickupCobTime}
                  stepsAllDone={allDone(pickupTs, tsKeys)}
                  stepBackLog={pickupStepBackLog}
                  onCaptureCob={() => setPickupCobTime(new Date().toISOString())}
                  headerAction={launchSlipActions}
                />
              </>
            )}
          </div>
        </div>
      )}



      {undoPending && (
        <ConfirmDialog
          label={undoPending.label}
          onConfirm={(reasonCode, reasonText) => {
            undoPending.resetter();
            undoPending.addToLog?.(reasonText ? `${reasonCode}: ${reasonText}` : reasonCode);
            undoPending.cancelApi?.(reasonCode, reasonText);
            setUndoPending(null);
          }}
          onCancel={() => setUndoPending(null)}
        />
      )}
    </div>
  );
}

TaxiBoatCardView.propTypes = {
  card: PropTypes.object,
  userRoleId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default TaxiBoatCardView;
