import { useState, useCallback, useEffect, useRef } from "react";
import { useTaxiBoatStore } from "../../../../../../shared/store/taxiBoatStore";
import { useCTPendingCards } from "../../../../../../shared/store/ctStore";
import useAlertReducer from "../../../../../../store/AlertReducer";
import groService from "../../../../../../services/groService";
import launchHireService from "../../../../../../services/launchHireService";
import DateTimePickerField from "../../../../CardFormTabs/shared/components/DateTimePickerField";
import { formatGroDocumentDisplayName } from "../GRO/User/groCardUtils";
import PropTypes from "prop-types";
import { FiFlag, FiAnchor, FiNavigation, FiHome, FiArrowDown, FiArrowUp, FiClock, FiUpload, FiPlus, FiCheckCircle, FiPrinter, FiUser } from "react-icons/fi";
import { FaShip } from "react-icons/fa";
import { MdDirectionsBoat } from "react-icons/md";
import "../../../../../../design/scss/pages/kanban-board/taxi-boat-card.scss";
import "../../../../../../design/scss/pages/kanban-board/taxi-boat-service-scenarios.scss";
import GroSummaryCard, { GroSummaryFieldCard } from "../GRO/User/GroSummaryCard";

const CREW_CHANGE_SERVICES = ["Crew Change"];
const MATERIAL_SERVICES   = ["Material Delivery", "Provision Delivery", "Garbage Collection"];
const IMMIGRATION_SERVICES = ["Immigration Clearance"];

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
      batchLabel: b?.batch ? formatGroDocumentDisplayName(b.batch) : null,
      crewCount: String(crew.length),
      crew,
      operator: "",
      ts: makeTsState(initKeys),
      tsOps: makeTsState(initKeys),
      cobTime: null,
      completedAt: null,
      stepBackLog: [],
      file: null,
      completed: false,
    };
  });
}

const STANDARD_TIMESTAMPS = [
  { key: "castOff",           label: "Cast off Time",       icon: FiFlag,       animKey: "castOff"                          },
  { key: "boatAlongsideShip", label: "Boat Alongside Ship", icon: FiAnchor,     animKey: "boatAlongsideShip", showShip: true },
  { key: "boatCastOffShip",   label: "Boat Cast off Ship",  icon: FiNavigation, animKey: "boatCastOffShip",   showShip: true },
  { key: "backToJetty",       label: "Back to Jetty",       icon: FiHome,       animKey: "backToJetty"                      },
];

const BATCH_ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th"];
const CREW_PAGE_SIZE = 10;

const isBatchDone = (batch) => STANDARD_TIMESTAMPS.every((t) => batch.ts[t.key] !== null);

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
      <span className="da-tsanim da-tsanim--castoff">
        <span className="da-tsanim-rope" />
        <FaShip size={16} className="da-tsanim-ship" />
      </span>
    );
  }
  if (animKey === "boatAlongsideShip") {
    return (
      <span className="da-tsanim da-tsanim--alongside">
        <FaShip size={20} className="da-tsanim-vessel" />
        <FaShip size={11} className="da-tsanim-boat" />
      </span>
    );
  }
  if (animKey === "boatCastOffShip") {
    return (
      <span className="da-tsanim da-tsanim--castoff-ship">
        <FaShip size={20} className="da-tsanim-vessel" />
        <FaShip size={11} className="da-tsanim-boat" />
      </span>
    );
  }
  if (animKey === "backToJetty") {
    return (
      <span className="da-tsanim da-tsanim--back-jetty">
        <FiAnchor size={15} className="da-tsanim-anchor" />
        <FaShip size={15} className="da-tsanim-ship" />
      </span>
    );
  }
  if (animKey === "batchPickup") {
    return (
      <span className="da-tsanim da-tsanim--batch-pickup">
        <FaShip size={14} className="da-tsanim-vessel" />
        <span className="da-tsanim-crew-dot" />
      </span>
    );
  }
  if (animKey === "batchDrop") {
    return (
      <span className="da-tsanim da-tsanim--batch-drop">
        <FaShip size={14} className="da-tsanim-vessel" />
        <span className="da-tsanim-crew-dot" />
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
      className={`da-ts-card${isChecked ? " da-ts-card--done" : ""}`}
      onClick={() => !isChecked && onCheck()}
      role="button"
      tabIndex={isChecked ? -1 : 0}
      onKeyDown={(e) => { if (!isChecked && (e.key === "Enter" || e.key === " ")) onCheck(); }}
    >
      <div className="da-ts-card-icon-box">
        {animKey ? <TimestampAnimIcon animKey={animKey} /> : <Icon size={20} />}
      </div>
      <div className="da-ts-card-title">{label}</div>
      <div className={`da-ts-card-pill${isChecked ? " da-ts-card-pill--captured" : ""}`}>
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
    <div className="da-ts-grid">
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
    <div className="da-confirm-overlay" onClick={onCancel}>
      <div className="da-confirm-box" onClick={(e) => e.stopPropagation()}>
        <p className="da-confirm-msg">
          Are you sure you want to undo <strong>{label}</strong>?
          Selecting <em>Yes</em> will clear this timestamp and you will need to tap again to capture the current time.
        </p>

        <div className="da-confirm-reason-section">
          <span className="da-confirm-reason-label">Reason for going back</span>
          <div className="da-confirm-reason-chips">
            {UNDO_REASONS.map((r) => (
              <button
                key={r}
                className={`da-confirm-reason-chip${reason === r ? " da-confirm-reason-chip--active" : ""}`}
                onClick={() => { setReason(r); if (r !== "Other") setOtherText(""); }}
              >
                {r}
              </button>
            ))}
          </div>
          {reason === "Other" && (
            <input
              type="text"
              className="da-confirm-reason-input"
              placeholder="Please specify the reason..."
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              autoFocus
            />
          )}
        </div>

        <div className="da-confirm-btns">
          <button
            className={`da-confirm-btn da-confirm-btn--yes${!canConfirm ? " da-confirm-btn--disabled" : ""}`}
            disabled={!canConfirm}
            onClick={() => canConfirm && onConfirm(finalReason)}
          >
            Yes, Go Back
          </button>
          <button className="da-confirm-btn da-confirm-btn--no" onClick={onCancel}>Cancel</button>
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

function TimestampStepper({ timestamps, tsState, onCapture, onComplete, jobCompleted, canFinish, onUndo, now, tsOps, shipName, intermediateTrip }) {
  const doneCount = timestamps.filter((t) => tsState[t.key] !== null).length;
  const totalSteps = timestamps.length;
  const allTimestampsDone = doneCount === totalSteps;
  const finalStepReady = canFinish !== undefined ? canFinish : allTimestampsDone;
  const totalWithFinal = totalSteps + (onComplete ? 1 : 0);
  const isArrived = onComplete ? jobCompleted : allTimestampsDone;

  return (
    <div className={`da-stepper-wrap da-stepper-wrap--step-${doneCount} da-stepper-wrap--steps-${totalWithFinal}`}>
      <div className={`da-stepper-boat-wrap${isArrived ? " da-stepper-boat-wrap--arrived" : ""}`}>
        <MdDirectionsBoat size={20} className="da-stepper-boat-icon" />
      </div>
      <ol className="da-stepper">
      {timestamps.flatMap(({ key, label, icon: Icon, animKey, showShip }, i) => {
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

        const mainItem = (
          <li
            key={key}
            className={[
              "da-stepper-item",
              done     ? "da-stepper-item--done"     : "",
              undoable ? "da-stepper-item--undoable" : "",
              isNext   ? "da-stepper-item--next"     : "",
              isLocked ? "da-stepper-item--locked"   : "",
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
            <div className="da-stepper-track">
              <div className="da-stepper-dot">{done ? "✓" : i + 1}</div>
              <div className="da-stepper-line" />
            </div>
            <div className="da-stepper-body">
              <div className="da-stepper-icon-box">
                {animKey ? <TimestampAnimIcon animKey={animKey} /> : <Icon size={20} />}
              </div>
              <div className="da-stepper-content">
                <span className="da-stepper-label">
                  {label}
                  {showShip && shipName && shipName !== "—" && (
                    <span className="da-stepper-ship-name"><FaShip size={8} />{shipName}</span>
                  )}
                </span>
                <span className={[
                  "da-stepper-pill",
                  done   ? "da-stepper-pill--done" : "",
                  isNext ? "da-stepper-pill--next" : "",
                ].filter(Boolean).join(" ")}>
                  {done ? formatDateTime(tsState[key]) : isNext ? "Tap to capture" : "—"}
                </span>
                {stepDuration && (
                  <span className="da-step-duration">{stepDuration}</span>
                )}
                {liveTimer && (
                  <span className="da-step-live-timer">
                    <FiClock size={9} />
                    {liveTimer}
                  </span>
                )}
                {done && tsOps?.[key] && (
                  <span className="da-stepper-operator-name">
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
            <li key="intermediate-trip" className="da-stepper-item da-stepper-item--intermediate">
              <div className="da-stepper-track">
                <div className="da-stepper-dot da-stepper-dot--trip"><FiArrowUp size={9} /></div>
                <div className="da-stepper-line" />
              </div>
              <div className="da-stepper-body">
                <div className="da-stepper-icon-box da-stepper-icon-box--trip">
                  <FiNavigation size={18} />
                </div>
                <div className="da-stepper-content">
                  <span className="da-stepper-label da-stepper-label--trip">Intermediate Trip</span>
                  {intermediateTrip.purpose && <span className="da-trip-split-purpose">{intermediateTrip.purpose}</span>}
                  {intermediateTrip.destShip && <span className="da-trip-split-dest"><FaShip size={9} />{intermediateTrip.destShip}</span>}
                  {intermediateTrip.billingEntity && <span className="da-trip-split-billing">{intermediateTrip.billingEntity}</span>}
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
            "da-stepper-item",
            jobCompleted                          ? "da-stepper-item--done"   : "",
            finalStepReady && !jobCompleted       ? "da-stepper-item--next"   : "",
            !finalStepReady && !jobCompleted      ? "da-stepper-item--locked" : "",
          ].filter(Boolean).join(" ")}
          onClick={() => finalStepReady && !jobCompleted && onComplete()}
          role={finalStepReady && !jobCompleted ? "button" : undefined}
          tabIndex={finalStepReady && !jobCompleted ? 0 : -1}
          onKeyDown={(e) => {
            if (finalStepReady && !jobCompleted && (e.key === "Enter" || e.key === " ")) onComplete();
          }}
        >
          <div className="da-stepper-track">
            <div className="da-stepper-dot">{jobCompleted ? "✓" : totalSteps + 1}</div>
          </div>
          <div className="da-stepper-body">
            <div className="da-stepper-icon-box">
              <FiCheckCircle size={20} />
            </div>
            <div className="da-stepper-content">
              <span className="da-stepper-label">Trip Completed</span>
              <span className={[
                "da-stepper-pill",
                jobCompleted                    ? "da-stepper-pill--done" : "",
                finalStepReady && !jobCompleted ? "da-stepper-pill--next" : "",
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
          <div className="da-voyage-duration-bar">
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
    destShip:      PropTypes.string,
    billingEntity: PropTypes.string,
  }),
};

function InfoCard({ label, value }) {
  return (
    <div className="da-info-card">
      <span className="da-info-label">{label}</span>
      <span className="da-info-value">{value || "—"}</span>
    </div>
  );
}

InfoCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
};

function FinalStep({ canComplete, isDone, onComplete }) {
  return (
    <ol className="da-stepper">
      <li
        className={[
          "da-stepper-item",
          isDone                    ? "da-stepper-item--done"   : "",
          canComplete && !isDone    ? "da-stepper-item--next"   : "",
          !canComplete && !isDone   ? "da-stepper-item--locked" : "",
        ].filter(Boolean).join(" ")}
        onClick={() => canComplete && !isDone && onComplete()}
        role={canComplete && !isDone ? "button" : undefined}
        tabIndex={canComplete && !isDone ? 0 : -1}
        onKeyDown={(e) => {
          if (canComplete && !isDone && (e.key === "Enter" || e.key === " ")) onComplete();
        }}
      >
        <div className="da-stepper-track">
          <div className="da-stepper-dot">✓</div>
        </div>
        <div className="da-stepper-body">
          <div className="da-stepper-icon-box">
            <FiCheckCircle size={20} />
          </div>
          <div className="da-stepper-content">
            <span className="da-stepper-label">Trip Completed</span>
            <span className={[
              "da-stepper-pill",
              isDone                 ? "da-stepper-pill--done" : "",
              canComplete && !isDone ? "da-stepper-pill--next" : "",
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
    <div className="da-ts-summary">
      <span className="da-ts-summary-title">Timestamps Summary</span>
      <table className="da-ts-summary-table">
        <thead>
          <tr>
            <th className="da-ts-summary-th-num">#</th>
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
              <tr key={key} className={time ? "da-ts-summary-row--done" : ""}>
                <td className="da-ts-summary-num">{time ? "✓" : i + 1}</td>
                <td className="da-ts-summary-step">{label}</td>
                <td className="da-ts-summary-time">
                  {time ? formatDateTime(time) : <span className="da-ts-summary-blank">—</span>}
                </td>
                <td className="da-ts-summary-dur">{dur ?? "—"}</td>
              </tr>
            );
          })}

          {/* Trip Completed row */}
          <tr className={["da-ts-summary-row--job", jobCompletedAt ? "da-ts-summary-row--done" : "da-ts-summary-row--locked"].join(" ")}>
            <td className="da-ts-summary-num">{jobCompletedAt ? "✓" : <FiCheckCircle size={11} />}</td>
            <td className="da-ts-summary-step da-ts-summary-job-label">Trip Completed</td>
            <td className="da-ts-summary-time">
              {jobCompletedAt
                ? formatDateTime(jobCompletedAt)
                : <span className="da-ts-summary-blank">{stepsAllDone ? "Tap step 5 above" : "—"}</span>}
            </td>
            <td className="da-ts-summary-dur">—</td>
          </tr>

          {/* COB Complete row */}
          <tr className={[
            "da-ts-summary-row--cob",
            cobTime           ? "da-ts-summary-row--done"   : "",
            !jobCompletedAt   ? "da-ts-summary-row--locked" : "",
          ].filter(Boolean).join(" ")}>
            <td className="da-ts-summary-num">{cobTime ? "✓" : <FiClock size={11} />}</td>
            <td className="da-ts-summary-step da-ts-summary-cob-label">COB Complete</td>
            <td className="da-ts-summary-time">
              {cobTime ? (
                formatDateTime(cobTime)
              ) : jobCompletedAt ? (
                <button className="da-cob-capture-btn" onClick={onCaptureCob}>
                  Tap to capture
                </button>
              ) : (
                <span className="da-ts-summary-blank">Mark job complete first</span>
              )}
            </td>
            <td className="da-ts-summary-dur">—</td>
          </tr>
          {/* Step Back Log rows */}
          {stepBackLog && stepBackLog.length > 0 && stepBackLog.map((entry, idx) => (
            <tr key={`sb-${idx}`} className="da-ts-summary-row--stepback">
              <td className="da-ts-summary-num"><FiArrowDown size={11} /></td>
              <td className="da-ts-summary-step da-ts-summary-stepback-label">
                Step Back — {entry.step}
              </td>
              <td className="da-ts-summary-time">{formatDateTime(entry.time)}</td>
              <td className="da-ts-summary-dur da-ts-summary-stepback-reason">{entry.reason}</td>
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

const parseToInputDate = (raw) => {
  if (!raw || raw === "—") return "";
  try {
    const d = new Date(raw);
    if (!isNaN(d)) return d.toISOString().split("T")[0];
  } catch {}
  return "";
};

function CrewListBatchwisePanel({
  batches, setBatches, activeBatchTab, setActiveBatchTab,
  opFocusedBatch, setOpFocusedBatch, recentOps, handleOpBlur, handleOpChipClick,
  captureBatchTs, setUndoPending, vesselName, now, printLaunchSlip, bookingId,
}) {
  const [crewPage, setCrewPage] = useState(1);
  const [uploadingBatchId, setUploadingBatchId] = useState(null);
  const activeBatchId = batches[activeBatchTab]?.id;
  const notifySuccess = useAlertReducer((s) => s.success);
  const notifyError = useAlertReducer((s) => s.error);

  useEffect(() => {
    setCrewPage(1);
  }, [activeBatchId]);

  const handleUploadLaunchSlip = useCallback(async (batchIdx, batchIdVal, file) => {
    setBatches((prev) => prev.map((b, idx) => (idx === batchIdx ? { ...b, file } : b)));
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
            ? { ...b, file, fileUrl: data?.file_url ?? null, fileName: data?.launch_hire_slip ?? file.name }
            : b
        )
      );
      notifySuccess(data?.message ?? "Launch hire slip uploaded successfully");
    } catch (err) {
      notifyError(err?.response?.data?.message ?? err.message ?? "Failed to upload launch hire slip");
    } finally {
      setUploadingBatchId(null);
    }
  }, [bookingId, setBatches, notifySuccess, notifyError]);

  const activeBatch = batches[activeBatchTab];

  return (
    <div className="da-scenario-section">
      <h3 className="da-section-title">Crew List — Batchwise</h3>
      <div className="da-batch-header-row">
        <div className="da-batch-tab-strip">
          {batches.map((batch, i) => (
            <button
              key={batch.id}
              className={[
                "da-batch-tab",
                activeBatchTab === i ? "da-batch-tab--active" : "",
                isBatchDone(batch) ? "da-batch-tab--done" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => setActiveBatchTab(i)}
            >
              {isBatchDone(batch) && <FiCheckCircle size={12} />}
              {batch.batchLabel ?? `Batch ${BATCH_ORDINALS[i] ?? `${i + 1}th`}`}
            </button>
          ))}
        </div>

        {activeBatch?.completed && (
          <div className="da-batch-actions">
            <button
              className="da-batch-print-btn"
              onClick={() => printLaunchSlip(activeBatch.ts, `Immigration Batch ${BATCH_ORDINALS[activeBatchTab] ?? activeBatchTab + 1}`, activeBatch.operator, activeBatch.completedAt)}
            >
              <FiPrinter size={14} />
              Print Launch Slip
            </button>
            <div>
              <input
                type="file"
                id={`da-batch-file-${activeBatch.id}`}
                className="da-launch-slip-input"
                accept=".pdf,.jpg,.jpeg,.png"
                disabled={uploadingBatchId === activeBatch.id}
                onChange={(e) => handleUploadLaunchSlip(activeBatchTab, activeBatch.id, e.target.files?.[0] ?? null)}
              />
              <label htmlFor={`da-batch-file-${activeBatch.id}`} className="tb-batch-upload-btn">
                <FiUpload size={14} />
                {uploadingBatchId === activeBatch.id
                  ? "Uploading…"
                  : activeBatch.file ? activeBatch.file.name : "Upload Launch Slip"}
              </label>
            </div>
          </div>
        )}
      </div>

      {batches.map((batch, i) => {
        if (i !== activeBatchTab) return null;
        const done = isBatchDone(batch);
        const crewRows = batch.crew && batch.crew.length > 0 ? batch.crew : getBatchCrewRows(batch.crewCount);
        const totalCrewPages = Math.max(1, Math.ceil(crewRows.length / CREW_PAGE_SIZE));
        const crewPageSafe = Math.min(crewPage, totalCrewPages);
        const pagedCrewRows = crewRows.slice(
          (crewPageSafe - 1) * CREW_PAGE_SIZE,
          crewPageSafe * CREW_PAGE_SIZE
        );
        return (
          <div key={batch.id} className="tb-batch-tab-content">
            {crewRows.length > 0 && (
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
  setUndoPending:   PropTypes.func.isRequired,
  vesselName:       PropTypes.string,
  now:              PropTypes.instanceOf(Date),
  printLaunchSlip:  PropTypes.func.isRequired,
  bookingId:        PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

const TAXI_BOAT_OPERATOR_ROLE_ID = "20";
const TAXI_BOAT_CAPTAIN_ROLE_ID = "21";

function DACardView({ card, userRoleId = null }) {
  const serviceType = card?.typeOfService ?? "—";
  const isCrewChange     = CREW_CHANGE_SERVICES.includes(serviceType);
  const isMaterialService = MATERIAL_SERVICES.includes(serviceType);
  const isImmigration    = IMMIGRATION_SERVICES.includes(serviceType);
  const isDAOperator = String(userRoleId ?? "") === TAXI_BOAT_OPERATOR_ROLE_ID;
  const isDACaptain  = String(userRoleId ?? "") === TAXI_BOAT_CAPTAIN_ROLE_ID;

  // Open Call — call_file/get_call_detail_by_id/{call_id}/{card_id}
  const callId = card?.call_id ?? card?.callId ?? card?.id ?? null;
  const cardId = card?.card_id ?? card?.cardId ?? card?.id ?? null;
  const [callDetail, setCallDetail] = useState(null);

  useEffect(() => {
    if (callId == null || cardId == null) return undefined;
    let cancelled = false;
    groService.getCallDetailById(callId, cardId)
      .then((res) => {
        if (!cancelled) setCallDetail(res?.data?.data ?? res?.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setCallDetail(null);
      });
    return () => { cancelled = true; };
  }, [callId, cardId]);

  const assignedUser = callDetail?.assigned_user_name ?? card?.user ?? "—";
  const requestedOperator = callDetail?.assigned_operator ?? card?.requestedOperator ?? "—";
  const vesselName = callDetail?.vessel_name ?? card?.vesselName ?? "—";
  const bookingDate = card?.bookingDate ?? "—";
  const location = callDetail?.port ?? card?.location ?? "—";
  const billingEntity = callDetail?.billing_entity ?? card?.name ?? "—";

  const bookingId = callDetail?.launch_hire_booking_id
    ?? card?.booking_id ?? card?.raw?.booking_id ?? card?.raw?.launch_hire_booking_id
    ?? card?.raw?.crew_immigration_booking_id ?? card?.callId ?? card?.id ?? null;

  const [assignedUserEdit, setAssignedUserEdit] = useState(() => card?.user ?? "");
  const [locationEdit, setLocationEdit] = useState(() => card?.location ?? "");

  useEffect(() => {
    if (!callDetail) return;
    setAssignedUserEdit(callDetail?.assigned_user_name ?? card?.user ?? "");
    setLocationEdit(callDetail?.port ?? card?.location ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callDetail]);

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

  // Intermediate trip form
  const addPendingCard = useCTPendingCards((state) => state.addPendingCard);
  const [addTripOpen, setAddTripOpen] = useState(false);
  const [addTripBillingEntity, setAddTripBillingEntity] = useState("");
  const [addTripPurpose, setAddTripPurpose] = useState("");
  const [addTripDestShip, setAddTripDestShip] = useState("");
  const [tripAdded, setTripAdded] = useState(false);

  const [bookingDateEdit, setBookingDateEdit] = useState(() => parseToInputDate(card?.bookingDate));
  const [bookingTimeEdit, setBookingTimeEdit] = useState("");

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
  
    // Scenario B: Material / Provision / Garbage
    const [packingListFile, setPackingListFile] = useState(null);
    const parsedPackingRows = packingListFile ? MOCK_PACKING_LIST_ROWS : null;
  
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
  
    // Crew List — Batchwise is shown for Immigration Clearance and as the Captain/Operator
    // default view; load real batches from the booking wherever it's shown.
    const showsBatchwisePanel = !isCrewChange && !isMaterialService;
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
  
    const handleAddTrip = useCallback(() => {
      if (!addTripPurpose.trim()) return;
      addPendingCard({
        id: `ct-extra-${Date.now()}`,
        typeOfService: addTripPurpose.trim(),
        name: addTripBillingEntity.trim() || billingEntity,
        vesselName: addTripDestShip.trim() || vesselName,
        progress: 0,
        timeLeft: "",
      });
      setTripAdded(true);
      setAddTripOpen(false);
    }, [addTripPurpose, addTripBillingEntity, addTripDestShip, billingEntity, vesselName, addPendingCard]);
  
    const allDone = (tsState, keys) => keys.every((k) => tsState[k] !== null);
  
    const tsKeys = STANDARD_TIMESTAMPS.map((t) => t.key);
    const canComplete = isImmigration
      ? batches.every((b) => b.completed)
      : allDone(dropTs, tsKeys) && allDone(pickupTs, tsKeys);
  
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
  
    return (
      <div className="tb-card-view">
        <div className={`gro-summary-grid${isDAOperator ? "" : " gro-summary-grid--six-col"}`}>
          {!isDAOperator && (
            <GroSummaryCard label="Requested Operator" value={requestedOperator} />
          )}
          <GroSummaryCard label="Billing Entity" value={billingEntity} />
          <GroSummaryCard label="Vessel Name"    value={vesselName}    />
          {isDAOperator ? (
            <GroSummaryFieldCard label="Location">
              <input
                type="text"
                className="tb-summary-input"
                value={locationEdit}
                onChange={(e) => setLocationEdit(e.target.value)}
              />
            </GroSummaryFieldCard>
          ) : (
            <GroSummaryCard label="Location" value={location} />
          )}
          {isDAOperator ? (
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
          {isDAOperator ? (
            <GroSummaryFieldCard label="Assigned Captian">
              <input
                type="text"
                className="tb-summary-input"
                value={assignedUserEdit}
                onChange={(e) => setAssignedUserEdit(e.target.value)}
              />
            </GroSummaryFieldCard>
          ) : (
            <GroSummaryCard label="Assigned Captian" value={assignedUser} />
          )}
        </div>
  
        {isDACaptain && (
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
            setUndoPending={setUndoPending}
            vesselName={vesselName}
            now={now}
            printLaunchSlip={printLaunchSlip}
            bookingId={bookingId}
          />
        )}
  
        {/* Scenario B: Material / Provision / Garbage Collection */}
        {isMaterialService && (
          <div className="da-scenario-section">
            <h3 className="da-section-title">Packing List</h3>
            <div className="da-excel-upload-row">
              <input
                type="file"
                id="da-packing-list-input"
                className="da-excel-upload-input"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setPackingListFile(e.target.files?.[0] ?? null)}
              />
              <label htmlFor="da-packing-list-input" className="da-excel-upload-btn">
                <FiUpload size={15} />
                {packingListFile ? "Replace File" : "Upload Packing List"}
              </label>
              {packingListFile && (
                <span className="da-excel-upload-filename">{packingListFile.name}</span>
              )}
            </div>
            {parsedPackingRows && (
              <>
                <span className="da-ai-parse-status">
                  AI parsed — {parsedPackingRows.length} items found
                </span>
                <div className="da-crew-table-wrapper">
                  <table className="da-crew-table">
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
  
        {/* Scenario C: Immigration Clearance — per-batch tabs (Captain already sees this above, in place of Fleet Assignment) */}
        {isImmigration && !isDACaptain && (
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
            setUndoPending={setUndoPending}
            vesselName={vesselName}
            now={now}
            printLaunchSlip={printLaunchSlip}
            bookingId={bookingId}
          />
        )}
  
        {!isImmigration && !isCrewChange && isDAOperator && (
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
            setUndoPending={setUndoPending}
            vesselName={vesselName}
            now={now}
            printLaunchSlip={printLaunchSlip}
            bookingId={bookingId}
          />
        )}
  
        {!isImmigration && !isCrewChange && !isDAOperator && (
          <div className="da-section">
            <h3 className="da-section-title">Movement Timestamps</h3>
            <div className="da-tabs">
              <div className="da-tabs-group">
                <button
                  className={`da-tab${activeTab === "pickup" ? " da-tab--active" : ""}`}
                  onClick={() => setActiveTab("pickup")}
                >
                  <span
                    key={`pickup-${activeTab}`}
                    className={`da-tab-vessel-wrap${activeTab === "pickup" ? " da-tab-vessel-wrap--pickup-firing" : ""}`}
                  >
                    <FaShip size={12} />
                    <span className="da-tab-cargo-dot" />
                  </span>
                  Pickup
                </button>
                <button
                  className={`da-tab${activeTab === "drop" ? " da-tab--active" : ""}`}
                  onClick={() => setActiveTab("drop")}
                >
                  <span
                    key={`drop-${activeTab}`}
                    className={`da-tab-vessel-wrap${activeTab === "drop" ? " da-tab-vessel-wrap--drop-firing" : ""}`}
                  >
                    <FaShip size={12} />
                    <span className="da-tab-cargo-dot" />
                  </span>
                  Drop
                </button>
              </div>
  
              {tripAdded ? (
                <span className="da-add-trip-done tb-add-trip-done--compact">
                  <FiCheckCircle size={13} />Trip Added
                </span>
              ) : (activeTab === "drop" ? dropTs.boatCastOffShip : pickupTs.boatCastOffShip) && (
                <div className="da-add-trip-anchor">
                  <button
                    className="da-add-trip-btn"
                    onClick={() => {
                      setAddTripBillingEntity(billingEntity !== "—" ? billingEntity : "");
                      setAddTripDestShip(vesselName !== "—" ? vesselName : "");
                      setAddTripOpen((open) => !open);
                    }}
                  >
                    <FiPlus size={13} />Add Intermediate Trip
                  </button>
                  {addTripOpen && (
                    <div className="da-add-trip-popover">
                      <span className="da-add-trip-form-title">Intermediate Trip Details</span>
                      <div className="da-add-trip-fields">
                        <div className="da-add-trip-field">
                          <label className="da-add-trip-label">Billing Entity</label>
                          <input className="da-add-trip-input" type="text" placeholder="Billing entity..." value={addTripBillingEntity} onChange={(e) => setAddTripBillingEntity(e.target.value)} />
                        </div>
                        <div className="da-add-trip-field">
                          <label className="da-add-trip-label">Purpose <span className="da-add-trip-required">*</span></label>
                          <input className="da-add-trip-input" type="text" placeholder="e.g. Material Delivery, Crew Change..." value={addTripPurpose} onChange={(e) => setAddTripPurpose(e.target.value)} />
                        </div>
                        <div className="da-add-trip-field">
                          <label className="da-add-trip-label">Destination Ship</label>
                          <input className="da-add-trip-input" type="text" placeholder="Vessel name..." value={addTripDestShip} onChange={(e) => setAddTripDestShip(e.target.value)} />
                        </div>
                      </div>
                      <div className="da-add-trip-btns">
                        <button className="da-add-trip-submit" onClick={handleAddTrip} disabled={!addTripPurpose.trim()}>Add to Board</button>
                        <button className="da-add-trip-cancel" onClick={() => setAddTripOpen(false)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div key={activeTab} className={`da-ts-panel tb-ts-panel--${activeTab}`}>
              {activeTab === "drop" ? (
                <>
                  <TimestampStepper
                    timestamps={STANDARD_TIMESTAMPS}
                    tsState={dropTs}
                    tsOps={dropTsOps}
                    shipName={vesselName}
                    intermediateTrip={tripAdded ? { purpose: addTripPurpose, destShip: addTripDestShip, billingEntity: addTripBillingEntity } : undefined}
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
                    intermediateTrip={tripAdded ? { purpose: addTripPurpose, destShip: addTripDestShip, billingEntity: addTripBillingEntity } : undefined}
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
              <div className="da-batch-actions">
                <button className="da-batch-print-btn" onClick={() => printLaunchSlip(activeTab === "drop" ? dropTs : pickupTs, activeTab === "drop" ? "Drop Trip" : "Pickup Trip", operatorName, jobCompletedAt)}>
                  <FiPrinter size={14} />
                  Print Launch Slip
                </button>
                <div>
                  <input
                    type="file"
                    id="da-launch-slip-file"
                    className="da-launch-slip-input"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setLaunchSlipFile(e.target.files?.[0] ?? null)}
                  />
                  <label htmlFor="da-launch-slip-file" className="da-batch-upload-btn">
                    <FiUpload size={14} />
                    {launchSlipFile ? launchSlipFile.name : "Upload Launch Slip"}
                  </label>
                </div>
              </div>
            )}
          </div>
        )}
  
  
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
  
  DACardView.propTypes = {
    card: PropTypes.object,
    userRoleId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  };
  
  export default DACardView;
  