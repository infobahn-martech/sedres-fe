import { useState, useCallback } from "react";
import PropTypes from "prop-types";
import { FiFlag, FiAnchor, FiNavigation, FiHome, FiArrowDown, FiArrowUp, FiClock, FiUpload, FiPlus, FiCheck, FiPrinter } from "react-icons/fi";
import { FaShip } from "react-icons/fa";
import { MdDirectionsBoat } from "react-icons/md";
import "../../../../../../design/scss/pages/kanban-board/taxi-boat-card.scss";
import "../../../../../../design/scss/pages/kanban-board/taxi-boat-service-scenarios.scss";

const CREW_CHANGE_SERVICES = ["Crew Change"];
const MATERIAL_SERVICES = ["Material Delivery", "Provision Delivery", "Garbage Collection"];
const IMMIGRATION_SERVICES = ["Immigration Clearance"];

const MOCK_CREW_ROWS = [
  { name: "Ahmed Al-Rashid", rank: "Chief Officer", nationality: "Saudi", passportNo: "P1234567", seamanBookNo: "SB-10021" },
  { name: "Vikram Singh", rank: "2nd Engineer", nationality: "Indian", passportNo: "P2345678", seamanBookNo: "SB-10022" },
  { name: "Juan Dela Cruz", rank: "AB Seaman", nationality: "Filipino", passportNo: "P3456789", seamanBookNo: "SB-10023" },
  { name: "Omar Hassan", rank: "Cook", nationality: "Egyptian", passportNo: "P4567890", seamanBookNo: "SB-10024" },
];

const STANDARD_TIMESTAMPS = [
  { key: "castOff", label: "Cast off Time", icon: FiFlag, animKey: "castOff" },
  { key: "boatAlongsideShip", label: "Boat Alongside Ship", icon: FiAnchor, animKey: "boatAlongsideShip" },
  { key: "boatCastOffShip", label: "Boat Cast off Ship", icon: FiNavigation, animKey: "boatCastOffShip" },
  { key: "backToJetty", label: "Back to Jetty", icon: FiHome, animKey: "backToJetty" },
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

function TimestampStepper({ timestamps, tsState, onCapture, permissionChecked, onPermission }) {
  const doneCount = timestamps.filter((t) => tsState[t.key] !== null).length;
  const totalSteps = timestamps.length;
  const allDone = doneCount === totalSteps;
  return (
    <div className={`tb-stepper-wrap tb-stepper-wrap--step-${doneCount} tb-stepper-wrap--steps-${totalSteps}`}>
      <div className={`tb-stepper-boat-wrap${allDone ? " tb-stepper-boat-wrap--arrived" : ""}`}>
        <MdDirectionsBoat size={20} className="tb-stepper-boat-icon" />
      </div>
      <div className="tb-stepper-row">
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
                  done ? "tb-stepper-item--done" : "",
                  isNext ? "tb-stepper-item--next" : "",
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
                      done ? "tb-stepper-pill--done" : "",
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
        {allDone && onPermission && (
          <div
            className={`tb-stepper-perm-step${permissionChecked ? " tb-stepper-perm-step--checked" : ""}`}
            onClick={() => !permissionChecked && onPermission()}
            role={!permissionChecked ? "button" : undefined}
            tabIndex={!permissionChecked ? 0 : -1}
            onKeyDown={(e) => { if (!permissionChecked && (e.key === "Enter" || e.key === " ")) onPermission(); }}
          >
            <div className="tb-stepper-perm-track">
              <div className="tb-stepper-perm-line" />
              <div className="tb-stepper-perm-dot">
                {permissionChecked && <FiCheck size={11} />}
              </div>
            </div>
            <div className="tb-stepper-perm-body">
              <div className="tb-stepper-perm-icon-box">
                <FiCheck size={18} />
              </div>
              <div className="tb-stepper-perm-content">
                <span className="tb-stepper-perm-label">Job Complete</span>
                <span className="tb-stepper-perm-pill">
                  {permissionChecked ? "Confirmed" : "Tap to confirm"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

TimestampStepper.propTypes = {
  timestamps: PropTypes.arrayOf(
    PropTypes.shape({ key: PropTypes.string, label: PropTypes.string, icon: PropTypes.elementType })
  ).isRequired,
  tsState: PropTypes.object.isRequired,
  onCapture: PropTypes.func.isRequired,
  permissionChecked: PropTypes.bool,
  onPermission: PropTypes.func,
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

  const isCrewChange = CREW_CHANGE_SERVICES.includes(serviceType);
  const isMaterialService = MATERIAL_SERVICES.includes(serviceType);
  const isImmigration = IMMIGRATION_SERVICES.includes(serviceType);

  const batchRows = Array.from({ length: batchCount }, (_, i) => [
    { key: `pickup${i + 1}`, label: `Pickup ${BATCH_ORDINALS[i] ?? `${i + 1}th`} Batch`, icon: FiArrowDown, animKey: "batchPickup" },
    { key: `drop${i + 1}`, label: `Drop ${BATCH_ORDINALS[i] ?? `${i + 1}th`} Batch`, icon: FiArrowUp, animKey: "batchDrop" },
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
  const [dropPermission, setDropPermission] = useState(false);
  const [pickupPermission, setPickupPermission] = useState(false);
  const [printingSlip, setPrintingSlip] = useState(false);

  // Scenario A: Crew Change
  const [signMode, setSignMode] = useState("sign-on");
  const [parsedCrewRows] = useState(() => {
    if (!Array.isArray(card?.crew) || card.crew.length === 0) return null;
    return card.crew.map((c) => ({
      name: c.crewName ?? "—",
      rank: c.rank ?? "—",
      nationality: c.nationality ?? "—",
      passportNo: c.passportNo ?? "—",
      seamanBookNo: c.seamanBookNo ?? "—",
    }));
  });
  const crewFromCard = Array.isArray(card?.crew) && card.crew.length > 0;

  // Scenario B: Material / Provision / Garbage
  const [packingListFile, setPackingListFile] = useState(null);

  // Scenario C: Immigration batch crew counts
  const [batchCounts, setBatchCounts] = useState([{ id: 1, value: "" }, { id: 2, value: "" }]);

  const captureNow = useCallback((setter, key) => {
    setter((prev) => ({ ...prev, [key]: new Date().toISOString() }));
  }, []);

  const handleAddBatch = useCallback(() => {
    setBatchCounts((prev) => [...prev, { id: prev.length + 1, value: "" }]);
  }, []);

  const handlePrintLaunchSlip = useCallback(() => {
    setPrintingSlip(true);
    setTimeout(() => {
      try {
        const now = new Date();
        const slipDate = now.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        const slipTime = now.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });

        const dropTimestamps = STANDARD_TIMESTAMPS.map((ts) => ({
          label: ts.label,
          time: dropTs[ts.key] ? formatDateTime(dropTs[ts.key]) : "—",
        }));
        const pickupTimestamps = STANDARD_TIMESTAMPS.map((ts) => ({
          label: ts.label,
          time: pickupTs[ts.key] ? formatDateTime(pickupTs[ts.key]) : "—",
        }));

        const batchRowsData = batchRows.map((br) => ({
          label: br.label,
          time: batchTs[br.key] ? formatDateTime(batchTs[br.key]) : "—",
        }));

        const crewRowsHtml = parsedCrewRows
          ? parsedCrewRows
              .map(
                (cr, i) =>
                  `<tr class="tb-print-row"><td class="tb-print-cell tb-print-cell--num">${i + 1}</td><td class="tb-print-cell">${cr.name}</td><td class="tb-print-cell">${cr.rank}</td><td class="tb-print-cell">${cr.nationality}</td><td class="tb-print-cell">${cr.passportNo}</td><td class="tb-print-cell">${cr.seamanBookNo}</td></tr>`
              )
              .join("")
          : "";

        const dropRowsHtml = dropTimestamps
          .map(
            (d) =>
              `<tr class="tb-print-row"><td class="tb-print-cell tb-print-cell--label">${d.label}</td><td class="tb-print-cell tb-print-cell--time">${d.time}</td></tr>`
          )
          .join("");
        const pickupRowsHtml = pickupTimestamps
          .map(
            (p) =>
              `<tr class="tb-print-row"><td class="tb-print-cell tb-print-cell--label">${p.label}</td><td class="tb-print-cell tb-print-cell--time">${p.time}</td></tr>`
          )
          .join("");

        const batchRowsHtml = batchRowsData
          .map(
            (br) =>
              `<tr class="tb-print-row"><td class="tb-print-cell tb-print-cell--label">${br.label}</td><td class="tb-print-cell tb-print-cell--time">${br.time}</td></tr>`
          )
          .join("");

        const batchCountRowsHtml =
          isImmigration && batchCounts.length
            ? batchCounts
                .map(
                  (bc, i) =>
                    `<tr class="tb-print-row"><td class="tb-print-cell tb-print-cell--label">Batch ${i + 1}</td><td class="tb-print-cell tb-print-cell--time">${bc.value || "—"} crew</td></tr>`
                )
                .join("")
            : "";

        const signModeLabel = signMode === "sign-on" ? "Sign On" : "Sign Off";

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Launch Slip — ${vesselName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f1f5f9;
      color: #0f172a;
      padding: 30px;
      -webkit-font-smoothing: antialiased;
    }
    .tb-print-wrap {
      max-width: 880px;
      margin: 0 auto;
    }
    .tb-print-container {
      background: #ffffff;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12), 0 4px 16px rgba(15, 23, 42, 0.06);
      overflow: hidden;
    }
    .tb-print-header {
      background: linear-gradient(135deg, #1e3a5f, #00368c 50%, #1e4d8c);
      padding: 28px 36px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 4px solid #f59e0b;
    }
    .tb-print-header-left h1 {
      font-size: 22px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.5px;
      line-height: 1.2;
    }
    .tb-print-header-left .tb-print-subtitle {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.75);
      font-weight: 400;
      margin-top: 4px;
    }
    .tb-print-header-right { text-align: right; }
    .tb-print-badge {
      display: inline-block;
      background: #f59e0b;
      color: #1e293b;
      font-size: 11px;
      font-weight: 700;
      padding: 5px 14px;
      border-radius: 20px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .tb-print-header-right .tb-print-date {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
      margin-top: 6px;
    }
    .tb-print-body { padding: 32px 36px; }
    .tb-print-info-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      margin-bottom: 28px;
    }
    .tb-print-info-item {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px 16px;
    }
    .tb-print-info-label {
      font-size: 10px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 4px;
    }
    .tb-print-info-value {
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
      line-height: 1.3;
    }
    .tb-print-section-title {
      font-size: 15px;
      font-weight: 700;
      color: #00368c;
      margin: 24px 0 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
    }
    .tb-print-table-wrap {
      overflow-x: auto;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
    }
    .tb-print-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .tb-print-table th {
      background: #f1f5f9;
      font-weight: 600;
      font-size: 11px;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 10px 14px;
      text-align: left;
      border-bottom: 2px solid #e2e8f0;
    }
    .tb-print-cell {
      padding: 10px 14px;
      border-bottom: 1px solid #f1f5f9;
    }
    .tb-print-row:last-child .tb-print-cell { border-bottom: none; }
    .tb-print-row:hover .tb-print-cell { background: #f8fafc; }
    .tb-print-cell--label { font-weight: 600; color: #1e293b; }
    .tb-print-cell--time { color: #475569; }
    .tb-print-cell--num { color: #94a3b8; font-weight: 500; }
    .tb-print-completed {
      margin-top: 28px;
      padding: 16px 20px;
      background: linear-gradient(135deg, #fefce8, #fef9c3);
      border: 1px solid #fde047;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .tb-print-completed-icon { font-size: 16px; }
    .tb-print-completed-text {
      font-size: 13px;
      font-weight: 600;
      color: #854d0e;
    }
    .tb-print-footer {
      background: #f8fafc;
      padding: 18px 36px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .tb-print-footer-note {
      font-size: 12px;
      color: #94a3b8;
    }
    .tb-print-stamp {
      font-size: 11px;
      font-weight: 600;
      color: #00368c;
      background: #e2e6ff;
      padding: 6px 16px;
      border-radius: 6px;
    }
    .tb-print-watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-25deg);
      font-size: 120px;
      font-weight: 900;
      color: rgba(0, 54, 140, 0.04);
      pointer-events: none;
      z-index: -1;
      white-space: nowrap;
      letter-spacing: 12px;
    }
    .tb-print-actions {
      text-align: center;
      margin-top: 20px;
    }
    .tb-print-actions .tb-print-action {
      background: #00368c;
      color: #ffffff;
      border: none;
      padding: 12px 32px;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      font-family: "Inter", sans-serif;
    }
    .tb-print-actions .tb-print-action:hover { opacity: 0.9; }
    .tb-print-actions .tb-print-action-close {
      background: #e2e8f0;
      color: #475569;
      border: none;
      padding: 12px 24px;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      margin-left: 10px;
      font-family: "Inter", sans-serif;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .tb-print-container { box-shadow: none; border-radius: 0; }
      .tb-print-watermark { display: block; }
      .tb-print-actions { display: none; }
    }
    @media (max-width: 700px) {
      .tb-print-info-grid { grid-template-columns: repeat(2, 1fr); }
      .tb-print-header { flex-direction: column; gap: 12px; text-align: center; }
      .tb-print-header-right { text-align: center; }
    }
  </style>
</head>
<body>
  <div class="tb-print-watermark">LAUNCH SLIP</div>
  <div class="tb-print-wrap">
    <div class="tb-print-container">
      <div class="tb-print-header">
        <div class="tb-print-header-left">
          <h1>Launch Slip</h1>
          <div class="tb-print-subtitle">Trip Completion & Service Record</div>
        </div>
        <div class="tb-print-header-right">
          <span class="tb-print-badge">${serviceType}</span>
          <div class="tb-print-date">Generated: ${slipDate} at ${slipTime}</div>
        </div>
      </div>
      <div class="tb-print-body">
        <div class="tb-print-info-grid">
          <div class="tb-print-info-item">
            <div class="tb-print-info-label">Vessel</div>
            <div class="tb-print-info-value">${vesselName}</div>
          </div>
          <div class="tb-print-info-item">
            <div class="tb-print-info-label">Billing Entity</div>
            <div class="tb-print-info-value">${billingEntity}</div>
          </div>
          <div class="tb-print-info-item">
            <div class="tb-print-info-label">Location</div>
            <div class="tb-print-info-value">${location}</div>
          </div>
          <div class="tb-print-info-item">
            <div class="tb-print-info-label">Service Type</div>
            <div class="tb-print-info-value">${serviceType}</div>
          </div>
          <div class="tb-print-info-item">
            <div class="tb-print-info-label">Assigned User</div>
            <div class="tb-print-info-value">${assignedUser}</div>
          </div>
          <div class="tb-print-info-item">
            <div class="tb-print-info-label">Booking Date</div>
            <div class="tb-print-info-value">${bookingDate}</div>
          </div>
        </div>

        ${isImmigration ? `
        <div class="tb-print-section-title">Crew Batches</div>
        <div class="tb-print-table-wrap">
          <table class="tb-print-table">
            <thead><tr><th>Batch</th><th>Crew Count</th></tr></thead>
            <tbody>${batchCountRowsHtml}</tbody>
          </table>
        </div>
        <div class="tb-print-section-title">Batch Tracking Timestamps</div>
        <div class="tb-print-table-wrap">
          <table class="tb-print-table">
            <thead><tr><th>Event</th><th>Time</th></tr></thead>
            <tbody>${batchRowsHtml}</tbody>
          </table>
        </div>
        ` : `
        <div class="tb-print-section-title">Drop-Off Timestamps</div>
        <div class="tb-print-table-wrap">
          <table class="tb-print-table">
            <thead><tr><th>Event</th><th>Time</th></tr></thead>
            <tbody>${dropRowsHtml}</tbody>
          </table>
        </div>
        <div class="tb-print-section-title">Pickup Timestamps</div>
        <div class="tb-print-table-wrap">
          <table class="tb-print-table">
            <thead><tr><th>Event</th><th>Time</th></tr></thead>
            <tbody>${pickupRowsHtml}</tbody>
          </table>
        </div>
        `}

        ${isCrewChange && crewRowsHtml ? `
        <div class="tb-print-section-title">Crew List (${signModeLabel})</div>
        <div class="tb-print-table-wrap">
          <table class="tb-print-table">
            <thead><tr><th>#</th><th>Name</th><th>Rank</th><th>Nationality</th><th>Passport No.</th><th>Seaman Book</th></tr></thead>
            <tbody>${crewRowsHtml}</tbody>
          </table>
        </div>
        ` : ""}

        ${isMaterialService && packingListFile ? `
        <div class="tb-print-section-title">Packing List</div>
        <div class="tb-print-file-info">
          <span class="tb-print-file-label">Attached File:</span>
          <span class="tb-print-file-value">${packingListFile.name}</span>
        </div>
        ` : ""}

        <div class="tb-print-completed">
          <span class="tb-print-completed-icon">&#10003;</span>
          <span class="tb-print-completed-text">Job Completed — All timestamps captured successfully.</span>
        </div>
      </div>
      <div class="tb-print-footer">
        <span class="tb-print-footer-note">This is a computer-generated document. No signature required.</span>
        <span class="tb-print-stamp">&#10003; VERIFIED</span>
      </div>
    </div>
    <div class="tb-print-actions">
      <button class="tb-print-action" onclick="window.print()">Print This Slip</button>
      <button class="tb-print-action-close" onclick="window.close()">Close</button>
    </div>
  </div>
</body>
</html>`;

        const printWindow = window.open("", "_blank", "noopener,noreferrer,width=960,height=720");
        if (!printWindow) {
          setPrintingSlip(false);
          return;
        }
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
      } finally {
        setPrintingSlip(false);
      }
    }, 600);
  }, [
    vesselName,
    billingEntity,
    location,
    serviceType,
    assignedUser,
    bookingDate,
    dropTs,
    pickupTs,
    batchTs,
    batchRows,
    isImmigration,
    isCrewChange,
    isMaterialService,
    parsedCrewRows,
    packingListFile,
    batchCounts,
    signMode,
  ]);

  const allDone = (tsState, keys) => keys.every((k) => tsState[k] !== null);

  const tsKeys = STANDARD_TIMESTAMPS.map((t) => t.key);
  const canComplete = isImmigration
    ? allDone(batchTs, batchRows.map((r) => r.key))
    : allDone(dropTs, tsKeys) && allDone(pickupTs, tsKeys) && dropPermission && pickupPermission;

  const completionDoneCount = isImmigration
    ? batchRows.filter((r) => batchTs[r.key] !== null).length
    : tsKeys.filter((k) => dropTs[k] !== null).length + tsKeys.filter((k) => pickupTs[k] !== null).length;
  const completionTotalCount = isImmigration ? batchRows.length : tsKeys.length * 2;

  return (
    <div className="tb-card-view">
      <div className="tb-info-grid-section">
        <div className="tb-info-grid">
          <InfoCard label="Assigned User" value={assignedUser} />
          <InfoCard label="Requested Operator" value={requestedOperator} />
          <InfoCard label="Billing Entity" value={billingEntity} />
          <InfoCard label="Vessel Name" value={vesselName} />
          <InfoCard label="Location" value={location} />
          <InfoCard label="Booking Date" value={bookingDate} />
        </div>
      </div>

      <div className="tb-card-body">

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

          {/* Launch Slip — generate & upload always active */}
          <div className="tb-launch-slip-section">
            <div className="tb-launch-slip-header-row">
              <div className="tb-launch-slip-icon">
                <FiPrinter size={16} />
              </div>
              <h4 className="tb-launch-slip-title">Launch Slip</h4>
            </div>
            <p className="tb-launch-slip-hint">Generate a printable record or upload a signed copy.</p>
            <div className="tb-launch-slip-actions-row">
              <button
                className="tb-print-slip-btn"
                onClick={handlePrintLaunchSlip}
                disabled={printingSlip}
              >
                {printingSlip ? (
                  <>
                    <span className="tb-print-slip-spinner" />
                    Generating...
                  </>
                ) : (
                  <>
                    <span className="tb-slip-btn-icon"><FiPrinter size={15} /></span>
                    Generate &amp; Print
                  </>
                )}
              </button>
              <div className="tb-launch-slip-upload">
                <input
                  type="file"
                  id="tb-launch-slip-input"
                  className="tb-launch-slip-input"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setLaunchSlipFile(e.target.files?.[0] ?? null)}
                />
                <label htmlFor="tb-launch-slip-input" className="tb-launch-slip-btn">
                  <span className="tb-slip-btn-icon"><FiUpload size={14} /></span>
                  {launchSlipFile ? "Change File" : "Upload Signed Slip"}
                </label>
                {launchSlipFile && (
                  <span className="tb-launch-slip-filename">{launchSlipFile.name}</span>
                )}
              </div>
            </div>
          </div>
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
                permissionChecked={dropPermission}
                onPermission={() => setDropPermission(true)}
              />
            ) : (
              <TimestampStepper
                timestamps={STANDARD_TIMESTAMPS}
                tsState={pickupTs}
                onCapture={(key) => captureNow(setPickupTs, key)}
                permissionChecked={pickupPermission}
                onPermission={() => setPickupPermission(true)}
              />
            )}
          </div>

          {/* Launch Slip — generate & upload always active */}
          <div className="tb-launch-slip-section">
            <div className="tb-launch-slip-header-row">
              <div className="tb-launch-slip-icon">
                <FiPrinter size={16} />
              </div>
              <h4 className="tb-launch-slip-title">Launch Slip</h4>
            </div>
            <p className="tb-launch-slip-hint">Generate a printable record or upload a signed copy.</p>
            <div className="tb-launch-slip-actions-row">
              <button
                className="tb-print-slip-btn"
                onClick={handlePrintLaunchSlip}
                disabled={printingSlip}
              >
                {printingSlip ? (
                  <>
                    <span className="tb-print-slip-spinner" />
                    Generating...
                  </>
                ) : (
                  <>
                    <span className="tb-slip-btn-icon"><FiPrinter size={15} /></span>
                    Generate &amp; Print
                  </>
                )}
              </button>
              <div className="tb-launch-slip-upload">
                <input
                  type="file"
                  id="tb-launch-slip-input"
                  className="tb-launch-slip-input"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setLaunchSlipFile(e.target.files?.[0] ?? null)}
                />
                <label htmlFor="tb-launch-slip-input" className="tb-launch-slip-btn">
                  <span className="tb-slip-btn-icon"><FiUpload size={14} /></span>
                  {launchSlipFile ? "Change File" : "Upload Signed Slip"}
                </label>
                {launchSlipFile && (
                  <span className="tb-launch-slip-filename">{launchSlipFile.name}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {jobCompleted ? (
        <div className="tb-job-chk-row tb-job-chk-row--checked">
          <span className="tb-job-chk-box"><FiCheck size={15} /></span>
          <div className="tb-job-chk-content">
            <span className="tb-job-chk-label">Job Completed</span>
          </div>
        </div>
      ) : canComplete ? (
        <button className="tb-job-chk-row tb-job-chk-row--active" onClick={() => setJobCompleted(true)}>
          <span className="tb-job-chk-box" />
          <div className="tb-job-chk-content">
            <span className="tb-job-chk-label">Mark Job as Completed</span>
            <span className="tb-job-chk-hint">Tap to confirm all work is done</span>
          </div>
        </button>
      ) : (
        <div className="tb-job-chk-row tb-job-chk-row--locked">
          <span className="tb-job-chk-box" />
          <div className="tb-job-chk-content">
            <div className="tb-job-chk-locked-row">
              <span className="tb-job-chk-label">Job Completed</span>
              <span className="tb-job-chk-count">{completionDoneCount}/{completionTotalCount}</span>
            </div>
            <span className="tb-job-chk-hint">Complete all timestamps to enable</span>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}

TaxiBoatCardView.propTypes = {
  card: PropTypes.object,
};

export default TaxiBoatCardView;
