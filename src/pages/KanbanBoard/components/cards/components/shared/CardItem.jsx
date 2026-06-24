import { Draggable } from "@hello-pangea/dnd";
import { KANBAN_DND_DISABLED } from "../../../../../../shared/constants/kanbanConfig";
import PropTypes from "prop-types";
import { Tooltip } from "react-tooltip";
import "../../../../../../design/css/components/CardItem.css";
// Company logos
import saudimarcapLogo from "../../../../../../assets/images/saudimarcap.png";
import saipemLogo from "../../../../../../assets/images/saipem.png";
import lamprellLogo from "../../../../../../assets/images/lamprell.png";
import gulfmarineLogo from "../../../../../../assets/images/gulfmarine.png";
import { FiFileText, FiDownload, FiLoader, FiMoreHorizontal, FiTrendingUp } from "react-icons/fi";
import { resolveIconComponentStrict } from "../../../../../../structure/SideNav/components/DynamicIcon";
import {
  hasText,
  isValidProgress,
  isValidImage,
  getApiCardDisplayTitle,
  getApiCardTaskName,
  getUsernameInitial,
} from "../../../../utils/cardDisplayHelpers";

/** Top-left badge: dynamic Fi/Lu icon from API `cardTypeIcon` (e.g. LuRocket). */
function ApiCardTypeIcon({ card }) {
  const IconComponent = resolveIconComponentStrict(card.cardTypeIcon);

  if (!IconComponent) return null;

  return (
    <div
      className="card-type-icon-badge"
      title={card.cardTypeName}
      style={{
        backgroundColor: card.cardTypeColor || "#2563eb",
      }}
    >
      <IconComponent size={12} />
    </div>
  );
}

ApiCardTypeIcon.propTypes = {
  card: PropTypes.shape({
    cardTypeIcon: PropTypes.string,
    cardTypeColor: PropTypes.string,
    cardTypeName: PropTypes.string,
  }).isRequired,
};

/** Circular KPI used in API card summary row (classic + compact). */
function ApiCardCircularKpi({ progress }) {
  const pct = Math.min(100, Math.max(0, Number(progress)));
  return (
    <div className="card-api-kpi">
      <div className="circular-progress">
        <svg className="progress-svg" viewBox="0 0 26 26" aria-hidden>
          <circle className="bg" cx="13" cy="13" r="11.5" />
          <circle
            className="progress"
            cx="13"
            cy="13"
            r="11.5"
            style={{
              stroke: "#0d9488",
              strokeDashoffset: `calc(72 - (72 * ${pct}) / 100)`,
            }}
          />
        </svg>
        <div className="progress-text">{Math.round(pct)}%</div>
      </div>
    </div>
  );
}

// Status colors
const STATUS_COLORS = {
  done: "#28a745", // Green - Completed
  inProgress: "#ffc107", // Yellow - In Progress
  rejected: "#dc3545", // Red - Pending/Rejected
  pending: "#6c757d" // Gray (default)
};

// Icon components
const CarIcon = ({ size = 20, color = "#666" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color }}>
    <path d="M5 17H4C3.46957 17 2.96086 16.7893 2.58579 16.4142C2.21071 16.0391 2 15.5304 2 15V11C2 10.4696 2.21071 9.96086 2.58579 9.58579C2.96086 9.21071 3.46957 9 4 9H5M5 17H19M5 17V19C5 19.5304 4.78929 20.0391 4.41421 20.4142C4.03914 20.7893 3.53043 21 3 21C2.46957 21 1.96086 20.7893 1.58579 20.4142C1.21071 20.0391 1 19.5304 1 19V17M19 17H20C20.5304 17 21.0391 16.7893 21.4142 16.4142C21.7893 16.0391 22 15.5304 22 15V11C22 10.4696 21.7893 9.96086 21.4142 9.58579C21.0391 9.21071 20.5304 9 20 9H19M19 17V19C19 19.5304 19.2107 20.0391 19.5858 20.4142C19.9609 20.7893 20.4696 21 21 21C21.5304 21 22.0391 20.7893 22.4142 20.4142C22.7893 20.0391 23 19.5304 23 19V17M5 9L7 5H17L19 9M5 9H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const HotelIcon = ({ size = 20, color = "#666" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color }}>
    <path d="M3 21H21M5 21V7L12 3L19 7V21M5 21H9M19 21H15M9 21V13H15V21M9 21H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const MedicalIcon = ({ size = 20, color = "#666" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color }}>
    <path d="M12 8V16M8 12H16M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);


const MaterialManagementIcon = ({ size = 20, color = "#666" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color }}>
    <path d="M20 7H4C2.89543 7 2 7.89543 2 9V19C2 20.1046 2.89543 21 4 21H20C21.1046 21 22 20.1046 22 19V9C22 7.89543 21.1046 7 20 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M16 21V5C16 4.46957 15.7893 3.96086 15.4142 3.58579C15.0391 3.21071 14.5304 3 14 3H10C9.46957 3 8.96086 3.21071 8.58579 3.58579C8.21071 3.96086 8 4.46957 8 5V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const WasteDisposalIcon = ({ size = 20, color = "#666" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color }}>
    <path d="M3 6H5H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M10 11V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 11V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LaunchHireIcon = ({ size = 20, color = "#666" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color }}>
    <path d="M3 18H21L20 14H4L3 18ZM3 18L2 19H22L21 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M6 14L7 8H17L18 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M12 8V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M12 3L14 5H10L12 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

// Footer-1 status icons (from 1st image: priority, subtasks, deadline, watchers)
const PriorityTriangleIcon = ({ size = 16, color = "#666" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color }}>
    <path d="M12 5L4 19H20L12 5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const SubtasksIcon = ({ size = 16, color = "#666" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color }}>
    <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

const ClockIcon = ({ size = 16, color = "#666" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color }}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M12 7V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const EyeIcon = ({ size = 16, color = "#666" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color }}>
    <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

const LinkCardIcon = ({ size = 16, color = "#666" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color }}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const EtaIcon = ({ size = 16, color = "#666" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color }}>
    <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M16 2V6M8 2V6M3 10H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
  </svg>
);

// Company logo mapping by name (case-insensitive)
const companyLogoMap = {
  "gulf marine": gulfmarineLogo,
  "gulfmarine": gulfmarineLogo,
  "saudi marcap": saudimarcapLogo,
  "saudimarcap": saudimarcapLogo,
  "snamprogetti": saipemLogo, // Using Saipem logo as Snamprogetti is a subsidiary of Saipem
  "saipem": saipemLogo,
  "lamprell": lamprellLogo,
};

const getRandomEta = (cardId) => {
  if (!cardId) return "2025-11-24 16:48";

  let h = 0;
  for (let i = 0; i < cardId.length; i++) {
    h = (h << 5) - h + cardId.charCodeAt(i);
    h |= 0;
  }

  const daysToAdd = Math.abs(h % 30) + 1;      // 1–30 days
  const hoursToAdd = Math.abs((h >> 8) % 24);  // 0–23 hours
  const minutesToAdd = Math.abs((h >> 16) % 60); // 0–59 minutes

  const date = new Date();
  date.setDate(date.getDate() + daysToAdd);
  date.setHours(date.getHours() + hoursToAdd);
  date.setMinutes(date.getMinutes() + minutesToAdd);

  const pad = (n) => n.toString().padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// Function to get company icon based on card name
const getCompanyIcon = (cardId, cardName, entityLogo) => {
  if (entityLogo) {
    return { type: "image", src: entityLogo };
  }

  // Match by company name
  if (cardName) {
    const normalizedName = cardName.toLowerCase().trim();
    const logo = companyLogoMap[normalizedName];
    if (logo) {
      return { type: "image", src: logo };
    }
  }

  // Default fallback - return null or a placeholder if no match
  return null;
};

// Status icon component
const StatusIcon = ({ status = "pending", IconComponent, size = 20 }) => {
  const color = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return <IconComponent size={size} color={color} />;
};

function ApiCardTaskLine({ card }) {
  const taskName = getApiCardTaskName(card);
  if (!hasText(taskName)) return null;
  return (
    <p className="card-api-task-name" title={taskName}>
      {taskName}
    </p>
  );
}

/** API-driven board cards: only fields from backend, no mock footer / extra icon rows. */
function ApiKanbanCardShrunk({ card, setSelectedCard }) {
  const displayTitle = getApiCardDisplayTitle(card);
  const usernameInitial = getUsernameInitial(card.user);
  const hasTimeline = hasText(card.timeLeft);
  const hasProgress = isValidProgress(card.progress);
  const showSummaryRow = hasTimeline || hasProgress;

  return (
    <div className="card-content-compact card-content-compact--api">
      <div className="card-api-title-row card-api-title-row--compact">
        <div
          className="card-title-compact card-title-compact--api card-api-title-text"
          onClick={() => setSelectedCard(card)}
          title={displayTitle || undefined}
        >
          {displayTitle}
        </div>
        {usernameInitial ? (
          <span className="card-api-user-avatar" title={hasText(card.user) ? String(card.user).trim() : undefined} aria-hidden>
            {usernameInitial}
          </span>
        ) : null}
      </div>
      <ApiCardTaskLine card={card} />
      {showSummaryRow ? (
        <div className="card-api-summary-row card-api-summary-row--compact">
          <div className="card-api-summary-left">
            {hasTimeline ? <span className="card-api-timeline">{card.timeLeft}</span> : null}
          </div>
          <div className="card-api-summary-right">
            {hasProgress ? <ApiCardCircularKpi progress={card.progress} /> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ApiKanbanCardFull({
  card,
  setSelectedCard,
  isModernLayout,
  isClassicLayout,
}) {
  const displayTitle = getApiCardDisplayTitle(card);
  const secondary = hasText(card.billingEntity)
    ? card.billingEntity
    : hasText(card.name)
      ? card.name
      : "";
  const showLogo = isValidImage(card.entityLogo);
  const usernameInitial = getUsernameInitial(card.user);
  const hasTimeline = hasText(card.timeLeft);
  const hasProgress = isValidProgress(card.progress);
  const showSummaryRow = hasTimeline || hasProgress;

  const showHeaderRow = isModernLayout || showLogo;

  return (
    <>
      {showHeaderRow && (
        <div
          className={`card-api-header ${isModernLayout ? "card-api-header--modern" : ""}`}
        >
          {isModernLayout ? (
            <>
              {showLogo && (
                <img
                  src={card.entityLogo}
                  alt=""
                  className="card-api-logo"
                  loading="lazy"
                />
              )}
              <button
                type="button"
                className="card-action-menu-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCard(card);
                }}
                aria-label="Actions"
              >
                <FiMoreHorizontal size={18} />
              </button>
            </>
          ) : (
            showLogo && (
              <img
                src={card.entityLogo}
                alt=""
                className="card-api-logo"
                loading="lazy"
              />
            )
          )}
        </div>
      )}

      <div className="card-title-row card-title-row--api">
        <div className="card-api-title-row">
          <h3
            className={`card-title card-title--api card-api-title-text ${isModernLayout ? "card-title-modern" : ""}`}
            onClick={() => setSelectedCard(card)}
            title={displayTitle || undefined}
          >
            {displayTitle}
          </h3>
          {usernameInitial ? (
            <span
              className="card-api-user-avatar"
              title={hasText(card.user) ? String(card.user).trim() : undefined}
              aria-hidden
            >
              {usernameInitial}
            </span>
          ) : null}
        </div>
        <ApiCardTaskLine card={card} />
        {hasText(secondary) ? (
          <p className="card-api-secondary" title={secondary}>
            {secondary}
          </p>
        ) : null}
      </div>

      {showSummaryRow ? (
        <div className="card-api-summary-row">
          <div className="card-api-summary-left">
            {hasTimeline ? <span className="card-api-timeline">{card.timeLeft}</span> : null}
          </div>
          <div className="card-api-summary-right">
            {hasProgress ? <ApiCardCircularKpi progress={card.progress} /> : null}
          </div>
        </div>
      ) : null}

      {isClassicLayout && hasText(card.port) && (
        <div className="card-mini-tags card-mini-tags--api">
          <span className="card-mini-tag card-mini-tag-port" title="Port">
            {card.port}
          </span>
        </div>
      )}
    </>
  );
}

function CardItem({
  card,
  index,
  setSelectedCard,
  isShrunk = false,
  hideExtraDetails = false,
  isClassicLayout = false,
  isModernLayout = false,
  isDarkMode = false,
  columnTitle = "",
  fixedDimensions = null,
}) {
  const isApiCard = card.cardSource === "api";
  const cardColor = card.color || "#2A00FF";
  const invoiceAmount = card.invoiceAmount != null ? Number(card.invoiceAmount) : null;
  const highlightInvoice = !!card.highlightInvoice; // 1st card (DA board): show invoice trend icon, no border pulse
  const formatInvoiceAmount = (val) =>
    new Intl.NumberFormat("en-SA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val) + " SAR";

  // Helper function to truncate text
  const TruncatedText = ({ text, maxLength = 20 }) => {
    if (!text) return null;
    const isTruncated = text.length > maxLength;
    const displayText = isTruncated ? text.substring(0, maxLength) + "..." : text;
    return <span>{displayText}</span>;
  };

  const fixedBoardSizeStyle =
    fixedDimensions != null
      ? (() => {
        const w = fixedDimensions.width;
        const base = {
          width: w,
          minWidth: w,
          maxWidth: w,
          boxSizing: "border-box",
        };
        if (fixedDimensions.height != null) {
          return {
            ...base,
            height: fixedDimensions.height,
            minHeight: fixedDimensions.height,
            maxHeight: fixedDimensions.height,
            overflow: "hidden",
          };
        }
        return base;
      })()
      : null;

  /** Matches icon blocks below — hide separator + row when nothing would render after KPI/footer. */
  const ed = card.extraDetailsShowIcons;
  const hasExtraDetailsIcons =
    (card.transport != null && card.transport !== "") ||
    (Array.isArray(ed) && ed.includes("hotel")) ||
    (Array.isArray(ed) && ed.includes("medical")) ||
    (Array.isArray(ed) && ed.includes("material")) ||
    (Array.isArray(ed) && ed.includes("waste")) ||
    (Array.isArray(ed) && ed.includes("launch"));

  return (
    <Draggable draggableId={card.id} index={index} isDragDisabled={KANBAN_DND_DISABLED}>
      {(provided, snapshot) => (
        <div
          className={`kanban-card ${isApiCard ? "kanban-card--api" : ""} ${snapshot.isDragging ? "dragging" : ""} ${card.priority ? "priority-blink" : ""} ${isShrunk ? "card-shrunk" : ""} ${isClassicLayout ? "kanban-card-classic" : ""} ${isModernLayout ? "kanban-card-modern" : ""} ${isDarkMode ? "kanban-card-dark" : ""} ${fixedBoardSizeStyle ? "kanban-card--fixed-board" : ""}`}
          ref={provided.innerRef}
          {...(KANBAN_DND_DISABLED ? {} : provided.draggableProps)}
          {...(KANBAN_DND_DISABLED ? {} : provided.dragHandleProps)}
          style={{
            ...fixedBoardSizeStyle,
            ...(KANBAN_DND_DISABLED ? {} : provided.draggableProps.style),
            "--card-color": cardColor,
          }}
        >
          {isApiCard && card.cardTypeIcon && (
            <ApiCardTypeIcon card={card} />
          )}
          {isApiCard ? (
            isShrunk ? (
              <ApiKanbanCardShrunk card={card} setSelectedCard={setSelectedCard} />
            ) : (
              <ApiKanbanCardFull
                card={card}
                setSelectedCard={setSelectedCard}
                isModernLayout={isModernLayout}
                isClassicLayout={isClassicLayout}
              />
            )
          ) : isShrunk ? (
            // Compact view for shrunk columns - Enhanced UI
            <>
              {/* Compact Content Container */}
              <div className="card-content-compact">
                {/* Icon with colored accent */}
                <div className="card-icon-wrapper-compact">
                  <div
                    className="card-header-icon-compact"
                    style={{ backgroundColor: cardColor }}
                  >
                    {card.iconType === "inprogress" && <FiLoader size={14} color="white" />}
                    {card.iconType === "download" && <FiDownload size={14} color="white" />}
                    {card.iconType === "document" && <FiFileText size={14} color="white" />}
                  </div>
                  {/* Colored accent line */}
                  <div
                    className="card-accent-line-compact"
                    style={{ backgroundColor: cardColor }}
                  />
                </div>

                {/* Title with better styling */}
                <div
                  className="card-title-compact"
                  onClick={() => setSelectedCard(card)}
                >
                  {(card.vesselName || card.cardName || card.title) && ((card.vesselName || card.cardName || card.title).length > 12 ? (card.vesselName || card.cardName || card.title).substring(0, 12) + "..." : (card.vesselName || card.cardName || card.title))}
                </div>
              </div>
            </>
          ) : (
            // Full view for normal/expanded columns (legacy / static mock cards)
            <>
              {/* Header */}
              <div className="card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                {!isModernLayout && (
                  <div
                    className="card-header-icon"
                    style={{ backgroundColor: cardColor }}
                  >
                    {card.iconType === "inprogress" && <FiLoader size={14} color="white" />}
                    {card.iconType === "download" && <FiDownload size={14} color="white" />}
                    {card.iconType === "document" && <FiFileText size={14} color="white" />}
                  </div>
                )}
                {!isModernLayout && card.name && (() => {
                  const tooltipId = `card-name-${card.id}`;
                  const companyIcon = getCompanyIcon(card.id, card.name, card.entityLogo);

                  if (!companyIcon) return null;

                  return (
                    <>
                      <div
                        data-tooltip-id={tooltipId}
                        data-tooltip-content={card.name}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          marginLeft: "auto",
                        }}
                      >
                        {companyIcon.type === "image" && (
                          <img
                            src={companyIcon.src}
                            alt={card.name}
                            style={{
                              width: "26px",
                              height: "26px",
                              padding: "4px",
                              objectFit: "contain",
                            }}
                          />
                        )}
                      </div>
                      <Tooltip id={tooltipId} place="top" className="card-name-tooltip" offset={5} />
                    </>
                  );
                })()}
                {isModernLayout && (
                  <button
                    type="button"
                    className="card-action-menu-btn"
                    onClick={(e) => { e.stopPropagation(); setSelectedCard(card); }}
                    aria-label="Actions"
                  >
                    <FiMoreHorizontal size={18} />
                  </button>
                )}
              </div>

              {/* Title */}
              <div className="card-title-row" style={{ position: "relative" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3
                    className={`card-title ${isModernLayout ? "card-title-modern" : ""}`}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedCard(card)}
                  >
                    {card.cardVariant === "taxi-boat" && card.typeOfService
                      ? card.typeOfService
                      : (card.vesselName || card.cardName || card.title)}
                  </h3>
                  {card.cardVariant === "taxi-boat" && card.vesselName && (
                    <div className="card-tb-vessel">{card.vesselName}</div>
                  )}
                  {isClassicLayout && (
                    <div className="card-mini-tags">
                      {card.port && (
                        <span className="card-mini-tag card-mini-tag-port" title="Port">{card.port}</span>
                      )}
                      {(card.priorityLevel || card.priority) && (
                        <span
                          className={`card-mini-tag card-mini-tag-priority ${String(card.priorityLevel || (card.priority ? 'H' : 'M')).toLowerCase() === 'l' ? 'low' :
                            String(card.priorityLevel || '').toLowerCase() === 'm' ? 'medium' : ''
                            }`}
                          title="Priority"
                        >
                          {card.priorityLevel || (card.priority ? 'H' : 'M')}
                        </span>
                      )}
                      {card.name && (
                        <span className="card-mini-tag card-mini-tag-client" title="Client">{card.name.charAt(0)}</span>
                      )}
                    </div>
                  )}
                </div>
                {card.user && (
                  <div
                    className="card-avatar"
                    data-initial={card.user[0]?.toUpperCase() || ""}
                    style={{ "--card-color": cardColor }}
                  />
                )}
              </div>

              {/* Footer-1: deadline, link; ETA only in Enroute column – hidden in Modern or when hideExtraDetails (e.g. GRO); at least one icon always shown */}
              {!isModernLayout && !hideExtraDetails && (() => {
                const hasDeadline = card.footerShowIcons?.includes("deadline");
                const hasLink = card.footerShowIcons?.includes("link");
                const isEnroute = (columnTitle || "").toLowerCase() === "enroute";
                const hasAny = hasDeadline || hasLink || isEnroute;
                if (!hasAny) return null;
                return (
                  <div className="card-footer footer-1" style={{ display: "flex", gap: "10px", alignItems: "center", justifyContent: "flex-start", flexWrap: "wrap" }}>
                    {hasDeadline && (
                      <span className="footer-1-item" title="Deadline" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <ClockIcon size={16} color="#666" />
                        <span>{card.footerDeadline ?? "21d"}</span>
                      </span>
                    )}
                    {hasLink && (
                      <span className="footer-1-item" title="Link card" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <LinkCardIcon size={16} color="#666" />
                        <span>{card.footerLinkCount ?? 0}</span>
                      </span>
                    )}
                    {isEnroute && (
                      <span className="footer-1-item" title="ETA" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <EtaIcon size={16} color="#666" />
                        <span>{card.footerEta ?? getRandomEta(card.id)}</span>
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* Invoice Amount */}
              {invoiceAmount != null && !isShrunk && (
                <div className="card-invoice-amount">
                  <span className="card-invoice-label">Invoice Amount</span>{" "}
                  <span className="card-invoice-amount-value">
                    {formatInvoiceAmount(invoiceAmount)}
                    {highlightInvoice && (
                      <span
                        className="card-invoice-trend"
                        title="Notable invoice amount"
                        role="img"
                        aria-label="Notable invoice amount"
                      >
                        <FiTrendingUp size={14} strokeWidth={2.5} aria-hidden />
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* Footer: time left + progress */}
              <div className={`card-footer ${isModernLayout ? "card-footer-modern" : ""}`}>
                <span className="card-time-left">{card?.timeLeft}</span>
                {isModernLayout ? (
                  <div className="footer-progress-horizontal">
                    <div className="progress-bar-horizontal">
                      <div
                        className="progress-fill-horizontal"
                        style={{
                          width: `${card.progress || 0}%`,
                          backgroundColor: "var(--card-color, #0d9488)",
                        }}
                      />
                    </div>
                    <span className="progress-text-horizontal">{card.progress || 0}%</span>
                  </div>
                ) : (
                  <div className="footer-progress">
                    <div className="circular-progress">
                      <svg className="progress-svg">
                        <circle className="bg" cx="13" cy="13" r="11.5" />
                        <circle
                          className="progress"
                          cx="13"
                          cy="13"
                          r="11.5"
                          style={{
                            stroke: "#0d9488",
                            strokeDashoffset: `calc(72 - (72 * ${card.progress || 0}) / 100)`,
                          }}
                        />
                      </svg>
                      <div className="progress-text">{card.progress || 0}%</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Separator only when extra-details row has content (avoids orphan line + empty padding). */}
              {!hideExtraDetails && !isModernLayout && hasExtraDetailsIcons && (
                <div className="card-eta-footer-separator" aria-hidden="true" />
              )}

              {/* Extra Details Section — same visibility as separator */}
              {!hideExtraDetails && !isModernLayout && hasExtraDetailsIcons && (
                <div className="card-extra-details" style={{ display: "flex", gap: "12px", alignItems: "center", justifyContent: "flex-start", padding: "8px 0" }}>
                  {/* Render transport only when BE/card payload provides it; otherwise hide */}
                  {card.transport != null && card.transport !== "" && (
                    <>
                      <div
                        data-tooltip-id={`transport-${card.id}`}
                        data-tooltip-content="Transport"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <CarIcon
                          size={18}
                          color={card.transport === "done" ? STATUS_COLORS.done : STATUS_COLORS.rejected}
                        />
                      </div>
                      <Tooltip id={`transport-${card.id}`} place="top" />
                    </>
                  )}

                  {card.extraDetailsShowIcons?.includes("hotel") && (
                    <>
                      <div
                        data-tooltip-id={`hotel-${card.id}`}
                        data-tooltip-content="Hotel"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <HotelIcon
                          size={18}
                          color={card.hotel === "done" ? STATUS_COLORS.done : STATUS_COLORS.rejected}
                        />
                      </div>
                      <Tooltip id={`hotel-${card.id}`} place="top" />
                    </>
                  )}

                  {Array.isArray(card.extraDetailsShowIcons) && card.extraDetailsShowIcons.includes("medical") && (
                    <>
                      <div
                        data-tooltip-id={`medical-${card.id}`}
                        data-tooltip-content="Medical"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <MedicalIcon
                          size={18}
                          color={card.medicalService === "done" ? STATUS_COLORS.done : STATUS_COLORS.rejected}
                        />
                      </div>
                      <Tooltip id={`medical-${card.id}`} place="top" />
                    </>
                  )}

                  {Array.isArray(card.extraDetailsShowIcons) && card.extraDetailsShowIcons.includes("material") && (
                    <>
                      <div
                        data-tooltip-id={`material-${card.id}`}
                        data-tooltip-content="Material Management"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <MaterialManagementIcon
                          size={18}
                          color={card.materialManagement === "done" ? STATUS_COLORS.done : STATUS_COLORS.rejected}
                        />
                      </div>
                      <Tooltip id={`material-${card.id}`} place="top" />
                    </>
                  )}

                  {Array.isArray(card.extraDetailsShowIcons) && card.extraDetailsShowIcons.includes("waste") && (
                    <>
                      <div
                        data-tooltip-id={`waste-${card.id}`}
                        data-tooltip-content="Waste Disposal"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <WasteDisposalIcon
                          size={18}
                          color={card.wasteDisposal === "done" ? STATUS_COLORS.done : STATUS_COLORS.rejected}
                        />
                      </div>
                      <Tooltip id={`waste-${card.id}`} place="top" />
                    </>
                  )}

                  {Array.isArray(card.extraDetailsShowIcons) && card.extraDetailsShowIcons.includes("launch") && (
                    <>
                      <div
                        data-tooltip-id={`launch-${card.id}`}
                        data-tooltip-content="Launch Hire"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <LaunchHireIcon
                          size={18}
                          color={card.launchHire === "done" ? STATUS_COLORS.done : STATUS_COLORS.rejected}
                        />
                      </div>
                      <Tooltip id={`launch-${card.id}`} place="top" />
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Draggable>
  );
}

CardItem.propTypes = {
  card: PropTypes.shape({
    id: PropTypes.string.isRequired,
    cardSource: PropTypes.oneOf(["api", "static"]),
    cardTypeIcon: PropTypes.string,
    cardTypeColor: PropTypes.string,
    cardTypeName: PropTypes.string,
    title: PropTypes.string,
    cardName: PropTypes.string,
    name: PropTypes.string,
    user: PropTypes.string,
    entityLogo: PropTypes.string,
    color: PropTypes.string,
    iconType: PropTypes.string,
    timeLeft: PropTypes.string,
    progress: PropTypes.number,
    priority: PropTypes.bool,
    vesselName: PropTypes.string,
    taskName: PropTypes.string,
    taskId: PropTypes.string,
    transport: PropTypes.string,
    transportCount: PropTypes.number,
    hotel: PropTypes.string,
    hotelCount: PropTypes.number,
    medicalService: PropTypes.string,
    medicalServiceCount: PropTypes.number,
    onStation: PropTypes.string,
    onStationCount: PropTypes.number,
    materialManagement: PropTypes.string,
    materialManagementCount: PropTypes.number,
    wasteDisposal: PropTypes.string,
    wasteDisposalCount: PropTypes.number,
    launchHire: PropTypes.string,
    launchHireCount: PropTypes.number,
    footerShowIcons: PropTypes.arrayOf(PropTypes.string),
    footerSubtasks: PropTypes.number,
    footerDeadline: PropTypes.string,
    footerWatchers: PropTypes.number,
    footerLinkCount: PropTypes.number,
    footerEta: PropTypes.string,
    extraDetailsShowIcons: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  index: PropTypes.number.isRequired,
  setSelectedCard: PropTypes.func.isRequired,
  isShrunk: PropTypes.bool,
  hideExtraDetails: PropTypes.bool,
  isClassicLayout: PropTypes.bool,
  isModernLayout: PropTypes.bool,
  isDarkMode: PropTypes.bool,
  columnTitle: PropTypes.string,
  fixedDimensions: PropTypes.shape({
    width: PropTypes.number.isRequired,
    height: PropTypes.number,
  }),
};

export default CardItem;
