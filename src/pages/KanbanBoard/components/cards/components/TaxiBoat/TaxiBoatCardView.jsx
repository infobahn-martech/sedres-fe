import { useState, useCallback, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { FiFlag, FiAnchor, FiNavigation, FiHome, FiArrowDown, FiArrowUp, FiClock, FiUpload, FiPlus, FiCheckCircle, FiPrinter, FiUser } from "react-icons/fi";
import { FaShip } from "react-icons/fa";
import { MdDirectionsBoat } from "react-icons/md";
import "../../../../../../design/scss/pages/kanban-board/taxi-boat-card.scss";
import "../../../../../../design/scss/pages/kanban-board/taxi-boat-service-scenarios.scss";
import GroSummaryCard from "../GRO/User/GroSummaryCard";

const CREW_CHANGE_SERVICES = ["Crew Change"];
const MATERIAL_SERVICES   = ["Material Delivery", "Provision Delivery", "Garbage Collection"];
const IMMIGRATION_SERVICES = ["Immigration Clearance"];

const MOCK_CREW_ROWS = [
  { name: "Ahmed Al-Rashid",  rank: "Chief Officer", nationality: "Saudi",    passportNo: "P1234567", seamanBookNo: "SB-10021" },
  { name: "Vikram Singh",     rank: "2nd Engineer",  nationality: "Indian",   passportNo: "P2345678", seamanBookNo: "SB-10022" },
  { name: "Juan Dela Cruz",   rank: "AB Seaman",     nationality: "Filipino", passportNo: "P3456789", seamanBookNo: "SB-10023" },
  { name: "Omar Hassan",      rank: "Cook",          nationality: "Egyptian", passportNo: "P4567890", seamanBookNo: "SB-10024" },
];

function getBatchCrewRows(crewCount) {
  const n = Math.max(0, parseInt(crewCount, 10) || 0);
  if (n === 0) return [];
  return Array.from({ length: n }, (_, i) => ({ ...MOCK_CREW_ROWS[i % MOCK_CREW_ROWS.length] }));
}

const STANDARD_TIMESTAMPS = [
  { key: "castOff",           label: "Cast off Time",       icon: FiFlag,       animKey: "castOff"                          },
  { key: "boatAlongsideShip", label: "Boat Alongside Ship", icon: FiAnchor,     animKey: "boatAlongsideShip", showShip: true },
  { key: "boatCastOffShip",   label: "Boat Cast off Ship",  icon: FiNavigation, animKey: "boatCastOffShip",   showShip: true },
  { key: "backToJetty",       label: "Back to Jetty",       icon: FiHome,       animKey: "backToJetty"                      },
];

const BATCH_ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th"];

const makeTsState = (keys) =>
  keys.reduce((acc, key) => ({ ...acc, [key]: null }), {});

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

const RECENT_OPS_KEY = "tb-recent-operators";
const MAX_RECENT_OPS = 5;

const loadRecentOps = () => {
  try { return JSON.parse(localStorage.getItem(RECENT_OPS_KEY) || "[]"); }
  catch { return []; }
};

const saveRecentOp = (name) => {
  if (!name?.trim()) return;
  const trimmed = name.trim();
  const prev = loadRecentOps();
  const next = [trimmed, ...prev.filter((op) => op !== trimmed)].slice(0, MAX_RECENT_OPS);
  localStorage.setItem(RECENT_OPS_KEY, JSON.stringify(next));
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

const UNDO_REASONS = [
  "Wrong time captured",
  "Operator error",
  "Re-capture required",
  "System / technical error",
  "Other",
];

function ConfirmDialog({ label, onConfirm, onCancel }) {
  const [reason, setReason] = useState(null);
  const [otherText, setOtherText] = useState("");

  const canConfirm = reason !== null && (reason !== "Other" || otherText.trim().length > 0);
  const finalReason = reason === "Other" ? otherText.trim() : reason;

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
            onClick={() => canConfirm && onConfirm(finalReason)}
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

function TimestampStepper({ timestamps, tsState, onCapture, onComplete, jobCompleted, canFinish, onUndo, now, tsOps, shipName }) {
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
      {timestamps.map(({ key, label, icon: Icon, animKey, showShip }, i) => {
        const done = tsState[key] !== null;
        const prevKey = i > 0 ? timestamps[i - 1].key : null;
        const prevDone = i === 0 || tsState[prevKey] !== null;
        const isNext = !done && prevDone;
        const isLocked = !done && !isNext;
        const undoable = done && !!onUndo;

        const stepDuration = done && prevKey && tsState[prevKey]
          ? formatDuration(new Date(tsState[key]) - new Date(tsState[prevKey]))
          : null;

        const liveTimer = isNext && now && prevKey && tsState[prevKey]
          ? formatDuration(now - new Date(tsState[prevKey]))
          : null;

        return (
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
              <span className="tb-stepper-label">Job Completed</span>
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
  now:          PropTypes.instanceOf(Date),
  tsOps:        PropTypes.object,
  shipName:     PropTypes.string,
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
            <span className="tb-stepper-label">Job Completed</span>
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

function TimestampSummaryTable({ timestamps, tsState, jobCompletedAt, cobTime, onCaptureCob, stepsAllDone, stepBackLog }) {
  const anyDone = timestamps.some((t) => tsState[t.key] !== null);
  if (!anyDone) return null;

  return (
    <div className="tb-ts-summary">
      <span className="tb-ts-summary-title">Timestamps Summary</span>
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
                <td className="tb-ts-summary-num">{time ? "✓" : i + 1}</td>
                <td className="tb-ts-summary-step">{label}</td>
                <td className="tb-ts-summary-time">
                  {time ? formatDateTime(time) : <span className="tb-ts-summary-blank">—</span>}
                </td>
                <td className="tb-ts-summary-dur">{dur ?? "—"}</td>
              </tr>
            );
          })}

          {/* Job Completed row */}
          <tr className={["tb-ts-summary-row--job", jobCompletedAt ? "tb-ts-summary-row--done" : "tb-ts-summary-row--locked"].join(" ")}>
            <td className="tb-ts-summary-num">{jobCompletedAt ? "✓" : <FiCheckCircle size={11} />}</td>
            <td className="tb-ts-summary-step tb-ts-summary-job-label">Job Completed</td>
            <td className="tb-ts-summary-time">
              {jobCompletedAt
                ? formatDateTime(jobCompletedAt)
                : <span className="tb-ts-summary-blank">{stepsAllDone ? "Tap step 5 above" : "—"}</span>}
            </td>
            <td className="tb-ts-summary-dur">—</td>
          </tr>

          {/* COB Complete row */}
          <tr className={[
            "tb-ts-summary-row--cob",
            cobTime           ? "tb-ts-summary-row--done"   : "",
            !jobCompletedAt   ? "tb-ts-summary-row--locked" : "",
          ].filter(Boolean).join(" ")}>
            <td className="tb-ts-summary-num">{cobTime ? "✓" : <FiClock size={11} />}</td>
            <td className="tb-ts-summary-step tb-ts-summary-cob-label">COB Complete</td>
            <td className="tb-ts-summary-time">
              {cobTime ? (
                formatDateTime(cobTime)
              ) : jobCompletedAt ? (
                <button className="tb-cob-capture-btn" onClick={onCaptureCob}>
                  Tap to capture
                </button>
              ) : (
                <span className="tb-ts-summary-blank">Mark job complete first</span>
              )}
            </td>
            <td className="tb-ts-summary-dur">—</td>
          </tr>
          {/* Step Back Log rows */}
          {stepBackLog && stepBackLog.length > 0 && stepBackLog.map((entry, idx) => (
            <tr key={`sb-${idx}`} className="tb-ts-summary-row--stepback">
              <td className="tb-ts-summary-num"><FiArrowDown size={11} /></td>
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
};

const TAXI_FLEETS = [
  { id: "BARBOSSA",  label: "BARBOSSA",  tagline: "Zone A & B",    capacity: 12 },
  { id: "WAKANDA",   label: "WAKANDA",   tagline: "Zone C & D",    capacity: 10 },
  { id: "MARMOLADA", label: "MARMOLADA", tagline: "All zones",      capacity: 8  },
];

const parseToInputDate = (raw) => {
  if (!raw || raw === "—") return "";
  try {
    const d = new Date(raw);
    if (!isNaN(d)) return d.toISOString().split("T")[0];
  } catch {}
  return "";
};

function TaxiFleetAssignPanel({
  operatorName, operatorPhone,
  bookingDate, bookingTime,
  onDateChange, onTimeChange,
  selectedFleet, onSelectFleet,
  assigned, onAssign,
}) {
  return (
    <div className="tb-fleet-panel">
      <h3 className="tb-fleet-panel-title">Taxi Fleet Assignment</h3>

      <div className="tb-fleet-operator-row">
        <div className="tb-fleet-operator-field">
          <span className="tb-fleet-operator-label">Requested Operator</span>
          <span className="tb-fleet-operator-value">{operatorName || "—"}</span>
        </div>
        <div className="tb-fleet-operator-field">
          <span className="tb-fleet-operator-label">Phone Number</span>
          <span className="tb-fleet-operator-value tb-fleet-operator-phone">{operatorPhone || "—"}</span>
        </div>
      </div>

      <div className="tb-fleet-booking-row">
        <div className="tb-fleet-booking-field">
          <label className="tb-fleet-booking-label">Booking Date</label>
          <input
            type="date"
            className="tb-fleet-booking-input"
            value={bookingDate}
            onChange={(e) => onDateChange(e.target.value)}
            disabled={assigned}
          />
        </div>
        <div className="tb-fleet-booking-field">
          <label className="tb-fleet-booking-label">Booking Time</label>
          <input
            type="time"
            className="tb-fleet-booking-input"
            value={bookingTime}
            onChange={(e) => onTimeChange(e.target.value)}
            disabled={assigned}
          />
        </div>
      </div>

      <span className="tb-fleet-select-label">Select Fleet</span>
      <div className="tb-fleet-cards">
        {TAXI_FLEETS.map((fleet) => {
          const isSelected = selectedFleet === fleet.id;
          const isAssigned = assigned && isSelected;
          return (
            <button
              key={fleet.id}
              className={[
                "tb-fleet-card",
                isSelected ? "tb-fleet-card--selected" : "",
                isAssigned ? "tb-fleet-card--assigned" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => !assigned && onSelectFleet(fleet.id)}
              disabled={assigned}
            >
              <MdDirectionsBoat size={24} className="tb-fleet-card-icon" />
              <span className="tb-fleet-card-name">{fleet.label}</span>
              <span className="tb-fleet-card-tagline">{fleet.tagline}</span>
              <span className="tb-fleet-card-cap">Capacity: {fleet.capacity}</span>
              {isAssigned && <span className="tb-fleet-card-badge"><FiCheckCircle size={10} /> Assigned</span>}
            </button>
          );
        })}
      </div>

      {!assigned ? (
        <button
          className={["tb-fleet-assign-btn", !selectedFleet ? "tb-fleet-assign-btn--disabled" : ""].filter(Boolean).join(" ")}
          disabled={!selectedFleet}
          onClick={onAssign}
        >
          {selectedFleet ? `Assign to ${selectedFleet}` : "Select a fleet to assign"}
        </button>
      ) : (
        <div className="tb-fleet-assigned-banner">
          <FiCheckCircle size={15} />
          Task assigned to <strong>{selectedFleet}</strong>
          {bookingDate && <> · {bookingDate}</>}
          {bookingTime && <> at {bookingTime}</>}
        </div>
      )}
    </div>
  );
}

TaxiFleetAssignPanel.propTypes = {
  operatorName:  PropTypes.string,
  operatorPhone: PropTypes.string,
  bookingDate:   PropTypes.string.isRequired,
  bookingTime:   PropTypes.string.isRequired,
  onDateChange:  PropTypes.func.isRequired,
  onTimeChange:  PropTypes.func.isRequired,
  selectedFleet: PropTypes.string,
  onSelectFleet: PropTypes.func.isRequired,
  assigned:      PropTypes.bool.isRequired,
  onAssign:      PropTypes.func.isRequired,
};

function TaxiBoatCardView({ card }) {
  const serviceType = card?.typeOfService ?? "—";
  const assignedUser = card?.user ?? "—";
  const requestedOperator = card?.requestedOperator ?? "—";
  const vesselName = card?.vesselName ?? "—";
  const bookingDate = card?.bookingDate ?? "—";
  const location = card?.location ?? "—";
  const billingEntity = card?.name ?? "—";
  const isCrewChange     = CREW_CHANGE_SERVICES.includes(serviceType);
  const isMaterialService = MATERIAL_SERVICES.includes(serviceType);
  const isImmigration    = IMMIGRATION_SERVICES.includes(serviceType);

  const [dropTs, setDropTs] = useState(() =>
    makeTsState(STANDARD_TIMESTAMPS.map((t) => t.key))
  );
  const [pickupTs, setPickupTs] = useState(() =>
    makeTsState(STANDARD_TIMESTAMPS.map((t) => t.key))
  );
  const [activeTab, setActiveTab] = useState("drop");
  const [jobCompleted, setJobCompleted] = useState(false);
  const [jobCompletedAt, setJobCompletedAt] = useState(null);
  const [launchSlipFile, setLaunchSlipFile] = useState(null);
  const [dropCobTime, setDropCobTime] = useState(null);
  const [pickupCobTime, setPickupCobTime] = useState(null);
  const [dropStepBackLog, setDropStepBackLog] = useState([]);
  const [pickupStepBackLog, setPickupStepBackLog] = useState([]);
  const [undoPending, setUndoPending] = useState(null); // { label, resetter }

  // Operator name recorded with each timestamp
  const [operatorName, setOperatorName] = useState(() => card?.requestedOperator ?? "");
  const [dropTsOps, setDropTsOps] = useState(() => makeTsState(STANDARD_TIMESTAMPS.map(t => t.key)));
  const [pickupTsOps, setPickupTsOps] = useState(() => makeTsState(STANDARD_TIMESTAMPS.map(t => t.key)));

  // Taxi fleet assignment
  const [selectedFleet, setSelectedFleet] = useState(null);
  const [fleetAssigned, setFleetAssigned] = useState(false);
  const [bookingDateEdit, setBookingDateEdit] = useState(() => parseToInputDate(card?.bookingDate));
  const [bookingTimeEdit, setBookingTimeEdit] = useState("");

  // Live clock — ticks every second for the live waiting timer on pending steps
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Operator quick-select — recent names from localStorage
  const [recentOps, setRecentOps] = useState(loadRecentOps);
  const [opFocusedBatch, setOpFocusedBatch] = useState(null);
  const opBlurTimer = useRef(null);

  const handleOpBlur = useCallback((operator) => {
    opBlurTimer.current = setTimeout(() => {
      if (operator?.trim()) {
        saveRecentOp(operator);
        setRecentOps(loadRecentOps());
      }
      setOpFocusedBatch(null);
    }, 150);
  }, []);

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

  // Scenario B: Material / Provision / Garbage
  const [packingListFile, setPackingListFile] = useState(null);

  // Scenario C: unified batch state — each batch has its own crew count, operator, timestamps, and file
  const [activeBatchTab, setActiveBatchTab] = useState(0);
  const [batches, setBatches] = useState(() => {
    const initKeys = STANDARD_TIMESTAMPS.map((t) => t.key);
    return [
      { id: 1, crewCount: "10", operator: "", ts: makeTsState(initKeys), cobTime: null, completedAt: null, stepBackLog: [], file: null, completed: false },
      { id: 2, crewCount: "8",  operator: "", ts: makeTsState(initKeys), cobTime: null, completedAt: null, stepBackLog: [], file: null, completed: false },
      { id: 3, crewCount: "6",  operator: "", ts: makeTsState(initKeys), cobTime: null, completedAt: null, stepBackLog: [], file: null, completed: false },
      { id: 4, crewCount: "5",  operator: "", ts: makeTsState(initKeys), cobTime: null, completedAt: null, stepBackLog: [], file: null, completed: false },
    ];
  });

  const captureNow = useCallback((setter, key, opSetter, operator) => {
    setter((prev) => ({ ...prev, [key]: new Date().toISOString() }));
    if (opSetter) opSetter((prev) => ({ ...prev, [key]: operator || "—" }));
  }, []);

  const captureBatchTs = useCallback((batchIdx, key) => {
    setBatches((prev) =>
      prev.map((b, i) =>
        i === batchIdx
          ? { ...b, ts: { ...b.ts, [key]: new Date().toISOString() }, tsOps: { ...(b.tsOps ?? {}), [key]: b.operator || "—" } }
          : b
      )
    );
  }, []);

  const handleAddBatch = useCallback(() => {
    const initKeys = STANDARD_TIMESTAMPS.map((t) => t.key);
    setBatches((prev) => [
      ...prev,
      { id: prev.length + 1, crewCount: "", operator: "", ts: makeTsState(initKeys), cobTime: null, completedAt: null, stepBackLog: [], file: null, completed: false },
    ]);
    setActiveBatchTab(batches.length);
  }, [batches.length]);

  const allDone = (tsState, keys) => keys.every((k) => tsState[k] !== null);
  const isBatchDone = (batch) => STANDARD_TIMESTAMPS.every((t) => batch.ts[t.key] !== null);

  const tsKeys = STANDARD_TIMESTAMPS.map((t) => t.key);
  const canComplete = isImmigration
    ? batches.every((b) => b.completed)
    : allDone(dropTs, tsKeys) && allDone(pickupTs, tsKeys);

  return (
    <div className="tb-card-view">
      <div className="gro-summary-grid gro-summary-grid--six-col">
        <GroSummaryCard label="Assigned User"      value={assignedUser}       />
        <GroSummaryCard label="Requested Operator" value={requestedOperator}  />
        <GroSummaryCard label="Billing Entity"     value={billingEntity}      />
        <GroSummaryCard label="Vessel Name"        value={vesselName}         />
        <GroSummaryCard label="Location"           value={location}           />
        <GroSummaryCard label="Booking Date"       value={bookingDate}        />
      </div>

      <TaxiFleetAssignPanel
        operatorName={requestedOperator}
        operatorPhone={card?.requestedOperatorPhone ?? card?.operatorPhone ?? card?.phone ?? null}
        bookingDate={bookingDateEdit}
        bookingTime={bookingTimeEdit}
        onDateChange={setBookingDateEdit}
        onTimeChange={setBookingTimeEdit}
        selectedFleet={selectedFleet}
        onSelectFleet={setSelectedFleet}
        assigned={fleetAssigned}
        onAssign={() => setFleetAssigned(true)}
      />

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

      {/* Scenario C: Immigration Clearance — per-batch tabs */}
      {isImmigration && (
        <div className="tb-scenario-section">
          {/* Batch summary bar */}
          <div className="tb-batch-summary-bar">
            <span className="tb-batch-summary-stat">
              <strong>{batches.filter((b) => b.completed).length}</strong> / {batches.length} batches complete
            </span>
          </div>

          <div className="tb-batch-tab-strip">
            {batches.map((batch, i) => (
              <button
                key={batch.id}
                className={[
                  "tb-batch-tab",
                  activeBatchTab === i ? "tb-batch-tab--active" : "",
                  isBatchDone(batch) ? "tb-batch-tab--done" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => setActiveBatchTab(i)}
              >
                {isBatchDone(batch) && <FiCheckCircle size={12} />}
                Batch {BATCH_ORDINALS[i] ?? `${i + 1}th`}
              </button>
            ))}
          </div>

          {batches.map((batch, i) => {
            if (i !== activeBatchTab) return null;
            const done = isBatchDone(batch);
            const crewRows = getBatchCrewRows(batch.crewCount);
            return (
              <div key={batch.id} className="tb-batch-tab-content">
                {crewRows.length > 0 && (
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
                        {crewRows.map((row, ri) => (
                          <tr key={ri}>
                            <td>{ri + 1}</td>
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
                )}

                <TimestampStepper
                  timestamps={STANDARD_TIMESTAMPS}
                  tsState={batch.ts}
                  tsOps={batch.tsOps}
                  shipName={vesselName}
                  onCapture={(key) => captureBatchTs(i, key)}
                  onComplete={() => setBatches((prev) => prev.map((b, idx) => idx === i ? { ...b, completed: true, completedAt: new Date().toISOString() } : b))}
                  jobCompleted={batch.completed}
                  canFinish={isBatchDone(batch)}
                  now={now}
                  onUndo={(key, label) => setUndoPending({
                    label,
                    resetter: () => setBatches((prev) =>
                      prev.map((b, idx) =>
                        idx === i ? { ...b, ts: { ...b.ts, [key]: null }, completed: false } : b
                      )
                    ),
                    addToLog: (reason) => setBatches((prev) =>
                      prev.map((b, idx) =>
                        idx === i ? { ...b, stepBackLog: [...b.stepBackLog, { step: label, reason, time: new Date().toISOString() }] } : b
                      )
                    ),
                  })}
                />

                <TimestampSummaryTable
                  timestamps={STANDARD_TIMESTAMPS}
                  tsState={batch.ts}
                  jobCompletedAt={batch.completedAt}
                  cobTime={batch.cobTime}
                  stepsAllDone={isBatchDone(batch)}
                  stepBackLog={batch.stepBackLog}
                  onCaptureCob={() =>
                    setBatches((prev) =>
                      prev.map((b, idx) =>
                        idx === i ? { ...b, cobTime: new Date().toISOString() } : b
                      )
                    )
                  }
                />

                {batch.completed && (
                  <div className="tb-batch-actions">
                    <button className="tb-batch-print-btn">
                      <FiPrinter size={14} />
                      Print Launch Slip
                    </button>
                    <div>
                      <input
                        type="file"
                        id={`tb-batch-file-${batch.id}`}
                        className="tb-launch-slip-input"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) =>
                          setBatches((prev) =>
                            prev.map((b, idx) =>
                              idx === i ? { ...b, file: e.target.files?.[0] ?? null } : b
                            )
                          )
                        }
                      />
                      <label htmlFor={`tb-batch-file-${batch.id}`} className="tb-batch-upload-btn">
                        <FiUpload size={14} />
                        {batch.file ? batch.file.name : "Upload Launch Slip"}
                      </label>
                    </div>
                  </div>
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
      )}

      {!isImmigration && (
        <div className="tb-section">
          <h3 className="tb-section-title">Movement Timestamps</h3>
          <div className="tb-guide-name-row">
            <label className="tb-guide-name-label">
              <FiUser size={13} />
              Taxi Boat Guide
            </label>
            <input
              type="text"
              className="tb-guide-name-input"
              placeholder="Enter guide name..."
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
            />
          </div>
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
              <>
                <TimestampStepper
                  timestamps={STANDARD_TIMESTAMPS}
                  tsState={dropTs}
                  tsOps={dropTsOps}
                  shipName={vesselName}
                  onCapture={(key) => captureNow(setDropTs, key, setDropTsOps, operatorName)}
                  onComplete={() => { setJobCompleted(true); setJobCompletedAt(new Date().toISOString()); }}
                  jobCompleted={jobCompleted}
                  canFinish={allDone(dropTs, tsKeys)}
                  now={now}
                  onUndo={(key, label) => setUndoPending({
                    label,
                    resetter: () => { setDropTs((prev) => ({ ...prev, [key]: null })); setDropTsOps((prev) => ({ ...prev, [key]: null })); setJobCompleted(false); setJobCompletedAt(null); },
                    addToLog: (reason) => setDropStepBackLog((prev) => [...prev, { step: label, reason, time: new Date().toISOString() }]),
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
                />
              </>
            ) : (
              <>
                <TimestampStepper
                  timestamps={STANDARD_TIMESTAMPS}
                  tsState={pickupTs}
                  tsOps={pickupTsOps}
                  shipName={vesselName}
                  onCapture={(key) => captureNow(setPickupTs, key, setPickupTsOps, operatorName)}
                  onComplete={() => { setJobCompleted(true); setJobCompletedAt(new Date().toISOString()); }}
                  jobCompleted={jobCompleted}
                  canFinish={allDone(pickupTs, tsKeys)}
                  now={now}
                  onUndo={(key, label) => setUndoPending({
                    label,
                    resetter: () => { setPickupTs((prev) => ({ ...prev, [key]: null })); setPickupTsOps((prev) => ({ ...prev, [key]: null })); setJobCompleted(false); setJobCompletedAt(null); },
                    addToLog: (reason) => setPickupStepBackLog((prev) => [...prev, { step: label, reason, time: new Date().toISOString() }]),
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
                />
              </>
            )}
          </div>
          {jobCompleted && (
            <div className="tb-batch-actions">
              <button className="tb-batch-print-btn">
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
          )}
        </div>
      )}


      <div className="tb-card-footer-bar">
        <button className="tb-save-btn">Save</button>
      </div>

      {undoPending && (
        <ConfirmDialog
          label={undoPending.label}
          onConfirm={(reason) => { undoPending.resetter(); undoPending.addToLog?.(reason); setUndoPending(null); }}
          onCancel={() => setUndoPending(null)}
        />
      )}
    </div>
  );
}

TaxiBoatCardView.propTypes = {
  card: PropTypes.object,
};

export default TaxiBoatCardView;
