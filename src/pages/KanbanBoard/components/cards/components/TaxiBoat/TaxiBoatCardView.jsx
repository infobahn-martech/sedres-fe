import { useState, useCallback } from "react";
import PropTypes from "prop-types";
import { FiFlag, FiAnchor, FiNavigation, FiHome, FiArrowDown, FiArrowUp, FiClock } from "react-icons/fi";
import "../../../../../../design/scss/pages/kanban-board/taxi-boat-card.scss";

const STANDARD_TIMESTAMPS = [
  { key: "castOff",           label: "Cast off Time",       icon: FiFlag       },
  { key: "boatAlongsideShip", label: "Boat Alongside Ship", icon: FiAnchor     },
  { key: "boatCastOffShip",   label: "Boat Cast off Ship",  icon: FiNavigation },
  { key: "backToJetty",       label: "Back to Jetty",       icon: FiHome       },
];

const IMMIGRATION_SERVICES = ["Immigration Clearance"];

const BATCH_ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th"];

const makeTsState = (keys) =>
  keys.reduce((acc, key) => ({ ...acc, [key]: null }), {});

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

function TimestampCard({ label, value, onCheck, icon: Icon }) {
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
        <Icon size={20} />
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
};

function TimestampGrid({ timestamps, tsState, onCapture }) {
  return (
    <div className="tb-ts-grid">
      {timestamps.map(({ key, label, icon }) => (
        <TimestampCard
          key={key}
          label={label}
          value={tsState[key]}
          onCheck={() => onCapture(key)}
          icon={icon || FiClock}
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

function TaxiBoatCardView({ card }) {
  const serviceType = card?.typeOfService ?? "—";
  const assignedUser = card?.user ?? "—";
  const requestedOperator = card?.requestedOperator ?? "—";
  const vesselName = card?.vesselName ?? "—";
  const bookingDate = card?.bookingDate ?? "—";
  const location = card?.location ?? "—";
  const billingEntity = card?.name ?? "—";
  const batchCount = Math.max(2, Number(card?.batchCount) || 2);

  const isImmigration = IMMIGRATION_SERVICES.includes(serviceType);

  const batchRows = Array.from({ length: batchCount }, (_, i) => [
    { key: `pickup${i + 1}`, label: `Pickup ${BATCH_ORDINALS[i] ?? `${i + 1}th`} Batch`, icon: FiArrowDown },
    { key: `drop${i + 1}`,   label: `Drop ${BATCH_ORDINALS[i] ?? `${i + 1}th`} Batch`,   icon: FiArrowUp  },
  ]).flat();

  const [dropTs, setDropTs] = useState(() =>
    makeTsState(STANDARD_TIMESTAMPS.map((t) => t.key))
  );
  const [pickupTs, setPickupTs] = useState(() =>
    makeTsState(STANDARD_TIMESTAMPS.map((t) => t.key))
  );
  const [batchTs, setBatchTs] = useState(() =>
    makeTsState(batchRows.map((r) => r.key))
  );
  const [activeTab, setActiveTab] = useState("drop");
  const [jobCompleted, setJobCompleted] = useState(false);
  const [launchSlipFile, setLaunchSlipFile] = useState(null);

  const captureNow = useCallback((setter, key) => {
    setter((prev) => ({ ...prev, [key]: new Date().toISOString() }));
  }, []);

  const allDone = (tsState, keys) => keys.every((k) => tsState[k] !== null);

  const tsKeys = STANDARD_TIMESTAMPS.map((t) => t.key);
  const canComplete = isImmigration
    ? allDone(batchTs, batchRows.map((r) => r.key))
    : allDone(dropTs, tsKeys) && allDone(pickupTs, tsKeys);

  return (
    <div className="tb-card-view">
      <div className="tb-info-grid">
        <InfoCard label="Assigned User"      value={assignedUser}      />
        <InfoCard label="Requested Operator" value={requestedOperator} />
        <InfoCard label="Billing Entity"     value={billingEntity}     />
        <InfoCard label="Vessel Name"        value={vesselName}        />
        <InfoCard label="Location"           value={location}          />
        <InfoCard label="Booking Date"       value={bookingDate}       />
      </div>

      {isImmigration ? (
        <div className="tb-section">
          <h3 className="tb-section-title">Immigration Batch Tracking</h3>
          <TimestampGrid
            timestamps={batchRows}
            tsState={batchTs}
            onCapture={(key) => captureNow(setBatchTs, key)}
          />
        </div>
      ) : (
        <div className="tb-section">
          <h3 className="tb-section-title">Movement Timestamps</h3>
          <div className="tb-tabs">
            <button
              className={`tb-tab${activeTab === "drop" ? " tb-tab--active" : ""}`}
              onClick={() => setActiveTab("drop")}
            >
              Drop
            </button>
            <button
              className={`tb-tab${activeTab === "pickup" ? " tb-tab--active" : ""}`}
              onClick={() => setActiveTab("pickup")}
            >
              Pickup
            </button>
          </div>
          {activeTab === "drop" ? (
            <TimestampGrid
              timestamps={STANDARD_TIMESTAMPS}
              tsState={dropTs}
              onCapture={(key) => captureNow(setDropTs, key)}
            />
          ) : (
            <TimestampGrid
              timestamps={STANDARD_TIMESTAMPS}
              tsState={pickupTs}
              onCapture={(key) => captureNow(setPickupTs, key)}
            />
          )}
          <div className="tb-section-progress-hint">
            <span className={`tb-progress-chip${allDone(dropTs, tsKeys) ? " tb-progress-chip--done" : ""}`}>
              Drop {STANDARD_TIMESTAMPS.filter((t) => dropTs[t.key]).length}/{STANDARD_TIMESTAMPS.length}
            </span>
            <span className={`tb-progress-chip${allDone(pickupTs, tsKeys) ? " tb-progress-chip--done" : ""}`}>
              Pickup {STANDARD_TIMESTAMPS.filter((t) => pickupTs[t.key]).length}/{STANDARD_TIMESTAMPS.length}
            </span>
          </div>
        </div>
      )}

      <div className="tb-job-complete-row">
        <label className={`tb-job-complete-label${!canComplete ? " tb-job-complete-label--disabled" : ""}`}>
          <input
            type="checkbox"
            className="tb-ts-checkbox"
            checked={jobCompleted}
            disabled={!canComplete || jobCompleted}
            onChange={() => {
              if (canComplete && !jobCompleted) setJobCompleted(true);
            }}
          />
          <span>Job Completed</span>
        </label>
        {!canComplete && !jobCompleted && (
          <span className="tb-job-complete-hint">Complete all timestamps to enable</span>
        )}
      </div>

      {jobCompleted && (
        <div className="tb-launch-slip-section">
          <h4 className="tb-launch-slip-title">Upload Launch Slip</h4>
          <p className="tb-launch-slip-hint">Please upload the signed Launch Slip to finalize this job.</p>
          <div className="tb-launch-slip-upload">
            <input
              type="file"
              id="tb-launch-slip-input"
              className="tb-launch-slip-input"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setLaunchSlipFile(e.target.files?.[0] ?? null)}
            />
            <label htmlFor="tb-launch-slip-input" className="tb-launch-slip-btn">
              {launchSlipFile ? "Change File" : "Choose File"}
            </label>
            {launchSlipFile && (
              <span className="tb-launch-slip-filename">{launchSlipFile.name}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

TaxiBoatCardView.propTypes = {
  card: PropTypes.object,
};

export default TaxiBoatCardView;
