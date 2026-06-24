import { Draggable } from "@hello-pangea/dnd";
import { KANBAN_DND_DISABLED } from "../../../../../../shared/constants/kanbanConfig";
import PropTypes from "prop-types";
import { FaShip } from "react-icons/fa";
import "../../../../../../design/scss/pages/kanban-board/taxi-boat-small-card.scss";

const SERVICE_THEME = {
  "Crew Change":         { bg: "#dbeafe", color: "#1d4ed8", border: "#bfdbfe", bar: "#2666be" },
  "Immigration Clearance": { bg: "#ede9fe", color: "#6d28d9", border: "#ddd6fe", bar: "#7c3aed" },
  "Material Delivery":   { bg: "#dcfce7", color: "#15803d", border: "#bbf7d0", bar: "#16a34a" },
  "Provision Delivery":  { bg: "#dcfce7", color: "#15803d", border: "#bbf7d0", bar: "#16a34a" },
  "Garbage Collection":  { bg: "#dcfce7", color: "#15803d", border: "#bbf7d0", bar: "#16a34a" },
};

const DEFAULT_THEME = { bg: "#f1f5f9", color: "#475569", border: "#e2e8f0", bar: "#64748b" };

const STEP_COUNT = 4;

function StepDots({ completedSteps = 0 }) {
  const items = [];
  for (let i = 0; i < STEP_COUNT; i++) {
    const isDone   = i < completedSteps;
    const isActive = i === completedSteps && completedSteps < STEP_COUNT;

    items.push(
      <div
        key={`dot-${i}`}
        className={`tb-step-dot${isDone ? " tb-step-dot--done" : isActive ? " tb-step-dot--active" : ""}`}
      />
    );

    if (i < STEP_COUNT - 1) {
      items.push(
        <div key={`line-${i}`} className={`tb-step-line${isDone ? " tb-step-line--done" : ""}`} />
      );
    }
  }
  return <div className="tb-small-card-steps">{items}</div>;
}

StepDots.propTypes = { completedSteps: PropTypes.number };

export default function TaxiBoatSmallCard({ card, index, setSelectedCard }) {
  const serviceType   = card?.typeOfService ?? "";
  const theme         = SERVICE_THEME[serviceType] ?? DEFAULT_THEME;
  const vesselName    = card?.vesselName || card?.title || "—";
  const userName      = card?.user || "—";
  const bookingDate   = card?.bookingDate || "";
  const completedSteps = Math.min(STEP_COUNT, Math.floor(((card?.progress ?? 0) / 100) * STEP_COUNT));
  const initial       = userName.charAt(0).toUpperCase();

  return (
    <Draggable
      draggableId={card.id}
      index={index}
      isDragDisabled={KANBAN_DND_DISABLED}
    >
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="tb-small-card"
          style={{
            "--tb-card-color": theme.bar,
            "--tb-badge-bg": theme.bg,
            "--tb-badge-color": theme.color,
            "--tb-badge-border": theme.border,
            ...provided.draggableProps.style,
          }}
          onClick={() => setSelectedCard(card)}
        >
          <div className="tb-small-card-top">
            <span className="tb-small-card-badge">
              <FaShip size={10} />
              {serviceType || "Taxi Boat"}
            </span>
          </div>

          <div className="tb-small-card-vessel">{vesselName}</div>

          <StepDots completedSteps={completedSteps} />

          <div className="tb-small-card-meta">
            <div className="tb-small-card-user">
              <div className="tb-small-card-avatar" style={{ background: theme.bar }}>
                {initial}
              </div>
              <span className="tb-small-card-username">{userName}</span>
            </div>
            {bookingDate && <span className="tb-small-card-date">{bookingDate}</span>}
          </div>
        </div>
      )}
    </Draggable>
  );
}

TaxiBoatSmallCard.propTypes = {
  card: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  setSelectedCard: PropTypes.func.isRequired,
};
