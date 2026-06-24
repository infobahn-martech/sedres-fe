import { useState, useCallback } from "react";
import PropTypes from "prop-types";
import { FiFlag, FiAnchor, FiNavigation, FiHome, FiArrowDown, FiArrowUp, FiClock, FiUpload, FiPlus } from "react-icons/fi";
import { FaShip } from "react-icons/fa";
import { MdDirectionsBoat } from "react-icons/md";
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
  { key: "castOff",           label: "Cast off Time",       icon: FiFlag,       animKey: "castOff"           },
  { key: "boatAlongsideShip", label: "Boat Alongside Ship", icon: FiAnchor,     animKey: "boatAlongsideShip" },
  { key: "boatCastOffShip",   label: "Boat Cast off Ship",  icon: FiNavigation, animKey: "boatCastOffShip"   },
  { key: "backToJetty",       label: "Back to Jetty",       icon: FiHome,       animKey: "backToJetty"       },
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

function TimestampStepper({ timestamps, tsState, onCapture }) {
  const doneCount = timestamps.filter((t) => tsState[t.key] !== null).length;
  const totalSteps = timestamps.length;
  return (
    <div className={`tb-stepper-wrap tb-stepper-wrap--step-${doneCount} tb-stepper-wrap--steps-${totalSteps}`}>
      <div className="tb-stepper-boat-wrap">
        <MdDirectionsBoat size={20} className="tb-stepper-boat-icon" />
      </div>
      <ol className="tb-stepper">
      {timestamps.map(({ key, label, icon: Icon, animKey }, i) => {
        const done = tsState[key] !== null;
        const prevDone = i === 0 || tsState[timestamps[i - 1].key] !== null;
        const isNext = !done && prevDone;
        const isLocked = !done && !isNext;
        return (
          <li
            key={key}
            className={[
              "tb-stepper-item",
              done     ? "tb-stepper-item--done"   : "",
              isNext   ? "tb-stepper-item--next"   : "",
              isLocked ? "tb-stepper-item--locked" : "",
            ].filter(Boolean).join(" ")}
            onClick={() => isNext && onCapture(key)}
            role={isNext ? "button" : undefined}
            tabIndex={isNext ? 0 : -1}
            onKeyDown={(e) => {
              if (isNext && (e.key === "Enter" || e.key === " ")) onCapture(key);
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
                <span className="tb-stepper-label">{label}</span>
                <span className={[
                  "tb-stepper-pill",
                  done   ? "tb-stepper-pill--done" : "",
                  isNext ? "tb-stepper-pill--next" : "",
                ].filter(Boolean).join(" ")}>
                  {done ? formatDateTime(tsState[key]) : isNext ? "Tap to capture" : "—"}
                </span>
              </div>
            </div>
          </li>
        );
      })}
      </ol>
    </div>
  );
}

TimestampStepper.propTypes = {
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
    { key: `pickup${i + 1}`, label: `Pickup ${BATCH_ORDINALS[i] ?? `${i + 1}th`} Batch`, icon: FiArrowDown, animKey: "batchPickup" },
    { key: `drop${i + 1}`,   label: `Drop ${BATCH_ORDINALS[i] ?? `${i + 1}th`} Batch`,   icon: FiArrowUp,   animKey: "batchDrop"   },
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
  const [parsedCrewRows, setParsedCrewRows] = useState(() => {
    if (!Array.isArray(card?.crew) || card.crew.length === 0) return null;
    return card.crew.map((c) => ({
      name:        c.crewName     ?? "—",
      rank:        c.rank         ?? "—",
      nationality: c.nationality  ?? "—",
      passportNo:  c.passportNo   ?? "—",
      seamanBookNo: c.seamanBookNo ?? "—",
    }));
  });
  const crewFromCard = Array.isArray(card?.crew) && card.crew.length > 0 && !crewListFile;

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
          <TimestampStepper
            timestamps={batchRows}
            tsState={batchTs}
            onCapture={(key) => captureNow(setBatchTs, key)}
          />
        </div>
      )}

      {!isImmigration && (
        <div className="tb-section">
          <h3 className="tb-section-title">Movement Timestamps</h3>
          <div className="tb-tabs">
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
          </div>
          <div key={activeTab} className={`tb-ts-panel tb-ts-panel--${activeTab}`}>
            {activeTab === "drop" ? (
              <TimestampStepper
                timestamps={STANDARD_TIMESTAMPS}
                tsState={dropTs}
                onCapture={(key) => captureNow(setDropTs, key)}
              />
            ) : (
              <TimestampStepper
                timestamps={STANDARD_TIMESTAMPS}
                tsState={pickupTs}
                onCapture={(key) => captureNow(setPickupTs, key)}
              />
            )}
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
