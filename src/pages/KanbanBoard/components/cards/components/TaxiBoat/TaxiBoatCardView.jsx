import { useState, useCallback } from "react";
import PropTypes from "prop-types";
import { FiFlag, FiAnchor, FiNavigation, FiHome, FiArrowDown, FiArrowUp, FiClock, FiUpload, FiPlus } from "react-icons/fi";
import { FaShip } from "react-icons/fa";
import "../../../../../../design/scss/pages/kanban-board/taxi-boat-card.scss";
import "../../../../../../design/scss/pages/kanban-board/taxi-boat-service-scenarios.scss";

const CREW_CHANGE_SERVICES = ["Crew Change"];
const MATERIAL_SERVICES   = ["Material Delivery", "Provision Delivery", "Garbage Collection"];
const IMMIGRATION_SERVICES = ["Immigration Clearance"];

const MOCK_CREW_ROWS = [
  { name: "Ahmed Al-Rashid",  rank: "Chief Officer", nationality: "Saudi",    passportNo: "P1234567", seamanBookNo: "SB-10021" },
  { name: "Vikram Singh",     rank: "2nd Engineer",  nationality: "Indian",   passportNo: "P2345678", seamanBookNo: "SB-10022" },
  { name: "Juan Dela Cruz",   rank: "AB Seaman",     nationality: "Filipino", passportNo: "P3456789", seamanBookNo: "SB-10023" },
  { name: "Omar Hassan",      rank: "Cook",          nationality: "Egyptian", passportNo: "P4567890", seamanBookNo: "SB-10024" },
];

const STANDARD_TIMESTAMPS = [
  { key: "castOff",           label: "Cast off Time",       icon: FiFlag       },
  { key: "boatAlongsideShip", label: "Boat Alongside Ship", icon: FiAnchor     },
  { key: "boatCastOffShip",   label: "Boat Cast off Ship",  icon: FiNavigation },
  { key: "backToJetty",       label: "Back to Jetty",       icon: FiHome       },
];

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

  const isCrewChange     = CREW_CHANGE_SERVICES.includes(serviceType);
  const isMaterialService = MATERIAL_SERVICES.includes(serviceType);
  const isImmigration    = IMMIGRATION_SERVICES.includes(serviceType);

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

  // Scenario A: Crew Change
  const [signMode, setSignMode] = useState("sign-on");
  const [crewListFile, setCrewListFile] = useState(null);
  const [parsedCrewRows, setParsedCrewRows] = useState(null);

  // Scenario B: Material / Provision / Garbage
  const [packingListFile, setPackingListFile] = useState(null);

  // Scenario C: Immigration batch crew counts
  const [batchCounts, setBatchCounts] = useState([{ id: 1, value: "" }, { id: 2, value: "" }]);

  const captureNow = useCallback((setter, key) => {
    setter((prev) => ({ ...prev, [key]: new Date().toISOString() }));
  }, []);

  const handleCrewListUpload = useCallback((e) => {
    const file = e.target.files?.[0] ?? null;
    setCrewListFile(file);
    setParsedCrewRows(file ? MOCK_CREW_ROWS : null);
  }, []);

  const handleAddBatch = useCallback(() => {
    setBatchCounts((prev) => [...prev, { id: prev.length + 1, value: "" }]);
  }, []);

  const allDone = (tsState, keys) => keys.every((k) => tsState[k] !== null);

  const tsKeys = STANDARD_TIMESTAMPS.map((t) => t.key);
  const canComplete = isCrewChange
    ? true
    : isImmigration
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
          <div className="tb-excel-upload-row">
            <input
              type="file"
              id="tb-crew-list-input"
              className="tb-excel-upload-input"
              accept=".xlsx,.xls,.csv"
              onChange={handleCrewListUpload}
            />
            <label htmlFor="tb-crew-list-input" className="tb-excel-upload-btn">
              <FiUpload size={15} />
              Upload Crew List
            </label>
            {crewListFile && (
              <span className="tb-excel-upload-filename">{crewListFile.name}</span>
            )}
          </div>
          {parsedCrewRows && (
            <>
              <span className="tb-ai-parse-status">AI parsed — {parsedCrewRows.length} crew members found</span>
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
              Upload Packing List
            </label>
            {packingListFile && (
              <span className="tb-excel-upload-filename">{packingListFile.name}</span>
            )}
          </div>
        </div>
      )}

      {/* Scenario C: Immigration Clearance — batch crew counts */}
      {isImmigration && (
        <div className="tb-scenario-section">
          <h3 className="tb-section-title">Crew Batches</h3>
          <div className="tb-batch-fields">
            {batchCounts.map((batch, i) => (
              <div key={batch.id} className="tb-batch-field-row">
                <span className="tb-batch-field-label">
                  No. of Crew in Batch {BATCH_ORDINALS[i] ?? `${i + 1}th`}
                </span>
                <input
                  type="number"
                  className="tb-batch-field-input"
                  min="1"
                  value={batch.value}
                  onChange={(e) =>
                    setBatchCounts((prev) =>
                      prev.map((b) => b.id === batch.id ? { ...b, value: e.target.value } : b)
                    )
                  }
                  placeholder="0"
                />
              </div>
            ))}
            <button className="tb-add-batch-btn" onClick={handleAddBatch}>
              <FiPlus size={14} />
              Add Batch
            </button>
          </div>
        </div>
      )}

      {isImmigration && (
        <div className="tb-section">
          <h3 className="tb-section-title">Immigration Batch Tracking</h3>
          <TimestampGrid
            timestamps={batchRows}
            tsState={batchTs}
            onCapture={(key) => captureNow(setBatchTs, key)}
          />
        </div>
      )}

      {!isCrewChange && !isImmigration && (
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
