import { useState, useMemo, useCallback, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import salesOrderService from "../../../../../../services/salesOrderService";
import kanbanBoardService from "../../../../../../services/kanbanBoardService";
import callFileService from "../../../../../../services/callFileService";
import daService from "../../../../../../services/daService";
import { mapSalesOrderResponse } from "../../../../../../shared/helpers/mapSalesOrderResponse";
import { useLocation } from "react-router-dom";
import PropTypes from "prop-types";
import { Tag, Layers3, AlertTriangle, Sticker, Pencil, Check, X } from "lucide-react";
import { notify } from "../../../../../../components/Toaster";
import "../../../../../../design/scss/pages/kanban-board/cardForm.scss";
import "../../../../../../design/scss/general.scss";
import ColorPickerIcon from "../../../../../../assets/images/ColorPicker.png";
import SedresColorPicker from "../../../../../../components/SedresColorPicker/SedresColorPicker";
import { normalizeHexColor } from "../../../../../../components/SedresColorPicker/sedresColorPickerConstants";
import PriorityIcon from "../../../../../../assets/images/Priority.png";
import { getItem } from "../../../../../../shared/helpers/localStorage";
import {
  isGROSupervisorRole,
  isCustomClearanceSupervisorRole,
  getFirstUserRoleId,
} from "../../../../../../shared/helpers/groUserRoles";
import useAuthReducer from "../../../../../../store/AuthReducer";
import { useDaLocalReachedDates } from "../../../../../../shared/store/daStore";

// Import Tab Components
import { General, Operation, Husbandry, DocumentLibrary, Invoice, SalesOrder, Reports, KPI, Comments, Subtasks, Notes, DA } from "../../../../CardFormTabs/Import";
import { Approval } from "../../../../CardFormTabs/Export";
import { DEFAULT_PRE_ARRIVAL_DOCUMENT_HANDLING } from "../../../../CardFormTabs/Import/tabs/operation/preArrivalDocumentHandling";
import { isExportCall } from "../../../../CardFormTabs/shared/utils/callTypes";
import NavTabButton from "../../../../../../components/NavTabButton";
import GROCardView from "../GRO/User/GROCardView";
import CoordinatorTransportCardView from "../CoordinatorTransport/CoordinatorTransportCardView";
import CustomCardView from "../Custom/User/CustomCardView";
import MWPCardView from "../MWP/User/MWPCardView";
import TaxiBoatCardView from "../TaxiBoat/TaxiBoatCardView";
import DynamicIcon from "../../../../../../structure/SideNav/components/DynamicIcon";
import { mapBackendIconNameToIconKey } from "../../../../../../store/KanbanManagementReducer";
import { TaskCardDetailView } from "../../../../../../pages/TaskCard";

// Constants - All tabs
const ALL_TOP_TABS = [
  "Appointment Details",
  "Operation",
  "Husbandry",
  "Sales Order",
  "Reports",
  "Document Library",
  "Comments",
  "Subtasks",
  "Notes",
];

const ALL_ENABLED_TABS = ["Appointment Details", "Operation", "Husbandry", "Sales Order", "Reports", "Document Library", "Comments", "Subtasks", "Notes"];

// "DA" tab is only appended for cardVariant === "da" cards (e.g. MV Atlantic Star),
// not the shared ALL_TOP_TABS used by every other default-tab-bar card.
const DA_ONLY_TAB = "DA";

const EXPORT_ONLY_TABS = ["Export Approval"];

const withExportTabs = (tabs) => {
  const next = [...tabs];
  const appointmentIndex = next.indexOf("Appointment Details");
  if (appointmentIndex >= 0) {
    next.splice(appointmentIndex + 1, 0, ...EXPORT_ONLY_TABS);
  } else {
    next.push(...EXPORT_ONLY_TABS);
  }
  return next;
};

// Constants - Simplified tabs for kanban-board/{id} routes
const SIMPLIFIED_TOP_TABS = [
  "General",
  "Sales Order",
  "Invoice",
];

const SIMPLIFIED_ENABLED_TABS = ["General", "Invoice", "Sales Order"];

// Constants - DA module tabs (includes Operation and Husbandry)
const DA_TOP_TABS = [
  "General",
  "Operation",
  "Husbandry",
  "Sales Order",
  "Reports",
  "KPI",
  "Invoice",
  "Comments",
  "Subtasks",
  "Notes",
];

const DA_ENABLED_TABS = ["General", "Operation", "Husbandry", "Sales Order", "Reports", "KPI", "Invoice", "Comments", "Subtasks", "Notes"];

const DEFAULT_ACCENT_COLOR = "#2A00FF";
const ADD_CARD_TOPBAR_DEFAULT_HEX = "#2e7d32";
/** GRO / custom pass task card modal — default header until user picks another in SedresColorPicker. */
const GRO_TASK_HEADER_DEFAULT_HEX = "#10b981";

/** Map header CSS color (hex or rgb/rgba) to normalized hex for SedresColorPicker. */
const appearanceColorToPickerHex = (value, fallbackHex = ADD_CARD_TOPBAR_DEFAULT_HEX) => {
  if (value === undefined || value === null) return fallbackHex;
  const s = String(value).trim();
  if (!s) return fallbackHex;
  if (s.startsWith("#")) {
    return normalizeHexColor(s);
  }
  const rgbMatch = s.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (!rgbMatch) return fallbackHex;
  const clampByte = (n) => Math.min(255, Math.max(0, parseInt(String(n), 10) || 0));
  const hexByte = (n) => clampByte(n).toString(16).padStart(2, "0");
  const hex = `#${hexByte(rgbMatch[1])}${hexByte(rgbMatch[2])}${hexByte(rgbMatch[3])}`;
  return normalizeHexColor(hex);
};
const TOTAL_STEPS = 6;

const STEP_LABELS = [
  "Appointment Received",
  "Enroute",
  "Vessel Arrived",
  "Vessel Cleared",
  "Vessel Sailed / Awaiting Documents",
  "Ready to Finalize",
];

// Mapping between column titles and step labels (used for both directions)
const COLUMN_TO_STEP_MAP = {
  "Appointment Received": { stepNumber: 1, stepLabel: "Appointment Received" },
  "Enroute": { stepNumber: 2, stepLabel: "Enroute" },
  "Vessel Arrived": { stepNumber: 3, stepLabel: "Vessel Arrived" },
  "Vessel Cleared": { stepNumber: 4, stepLabel: "Vessel Cleared" },
  "Vessel Sailed": { stepNumber: 5, stepLabel: "Vessel Sailed / Awaiting Documents" },
  "Ready to Fianalize": { stepNumber: 6, stepLabel: "Ready to Finalize" }, // Note: typo in data.js
};

// Helper: get step labels from columns + columnOrder (e.g. from DAdata columnTitles).
// When columnOrder is provided, step labels = column titles in that order; else use STEP_LABELS.
const getStepLabelsFromColumns = (columns, columnOrder) => {
  if (!columnOrder || !columns || !Array.isArray(columnOrder)) return null;
  const labels = columnOrder.map((colId) => columns[colId]?.title).filter(Boolean);
  return labels.length > 0 ? labels : null;
};

// Trimmed + case-insensitive compare — sticker names and column titles are entered
// independently by admins, so "Ops completed" vs "Ops Completed " shouldn't fail to match.
const normalizeLabelForMatch = (value) => String(value ?? "").trim().toLowerCase();

// Helper function to map step label to column ID (column.id for moveCardToColumn)
const getColumnIdFromStepLabel = (stepLabel, columns, columnOrder) => {
  if (!columns) return null;
  const normalizedLabel = normalizeLabelForMatch(stepLabel);

  // When columnOrder is provided (e.g. from DAdata), resolve by title in order
  if (columnOrder && Array.isArray(columnOrder)) {
    const colId = columnOrder.find((id) => normalizeLabelForMatch(columns[id]?.title) === normalizedLabel);
    return colId ? columns[colId]?.id ?? colId : null;
  }

  // Fallback: legacy step-to-title map
  const stepToColumnMap = {
    "Appointment Received": "Appointment Received",
    "Enroute": "Enroute",
    "Vessel Arrived": "Vessel Arrived",
    "Vessel Cleared": "Vessel Cleared",
    "Vessel Sailed / Awaiting Documents": "Vessel Sailed",
    "Ready to Finalize": "Ready to Fianalize", // Note: typo in data.js
  };
  const columnTitle = stepToColumnMap[stepLabel];
  if (!columnTitle) return null;
  for (const colId in columns) {
    if (columns[colId].title === columnTitle) {
      return columns[colId]?.id ?? colId;
    }
  }
  return null;
};

// Sticker click means "this stage is done" — resolves to the column *after* the one
// matching the sticker's name in columnOrder, not the matching column itself (that's
// what getColumnIdFromStepLabel is for, used by the footer stepper's jump-to-step clicks).
const getNextColumnIdAfterStepLabel = (stepLabel, columns, columnOrder) => {
  if (!columns || !columnOrder || !Array.isArray(columnOrder)) return null;
  const normalizedLabel = normalizeLabelForMatch(stepLabel);
  const matchedIndex = columnOrder.findIndex((id) => normalizeLabelForMatch(columns[id]?.title) === normalizedLabel);
  if (matchedIndex === -1 || matchedIndex + 1 >= columnOrder.length) return null;
  const nextColId = columnOrder[matchedIndex + 1];
  return columns[nextColId]?.id ?? nextColId ?? null;
};

// "YYYY-MM-DD HH:mm:ss" — same format api/da endpoints already send/expect elsewhere
// (see formatApiDateTime/combineApiDateTime in DA.jsx).
const formatNowForApi = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

// Helper function to get step number from column title
const getStepNumberFromColumnTitle = (columnTitle, columns, columnOrder) => {
  if (columnOrder && columns && Array.isArray(columnOrder)) {
    const idx = columnOrder.findIndex((colId) => columns[colId]?.title === columnTitle);
    return idx >= 0 ? idx + 1 : null;
  }
  const mapping = COLUMN_TO_STEP_MAP[columnTitle];
  return mapping ? mapping.stepNumber : null;
};

// Helper function to get step number from column (resolves parent for sub-columns)
const getStepNumberFromColumnId = (columnId, columns, columnOrder) => {
  if (!columns || !columnId) return null;
  const colKey = Object.keys(columns).find((k) => columns[k]?.id === columnId);
  if (!colKey) return null;
  const col = columns[colKey];
  const keyForOrder = col.parentColumnId
    ? Object.keys(columns).find((k) => columns[k]?.id === col.parentColumnId) || colKey
    : colKey;
  if (columnOrder && Array.isArray(columnOrder)) {
    const idx = columnOrder.indexOf(keyForOrder);
    return idx >= 0 ? idx + 1 : null;
  }
  const colForTitle = keyForOrder !== colKey ? columns[keyForOrder] : col;
  return getStepNumberFromColumnTitle(colForTitle?.title, columns, columnOrder);
};

const TYPE_PICKER_WIDTH = 272;

const contrastIconFg = (bg) => {
  if (!bg || typeof bg !== "string") return "#1a1a1a";
  let r;
  let g;
  let b;
  const trimmed = bg.trim();
  if (trimmed.startsWith("#")) {
    const h = trimmed.slice(1);
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    if (full.length < 6) return "#1a1a1a";
    r = parseInt(full.slice(0, 2), 16);
    g = parseInt(full.slice(2, 4), 16);
    b = parseInt(full.slice(4, 6), 16);
  } else {
    const m = trimmed.match(/\d+/g);
    if (!m || m.length < 3) return "#1a1a1a";
    r = Number(m[0]);
    g = Number(m[1]);
    b = Number(m[2]);
  }
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#1a1a1a" : "#ffffff";
};

const resolveCardTypeIdFromCard = (card) => {
  const raw =
    card?.card_type_id ?? card?.cardTypeId ?? card?.raw?.card_type_id ?? card?.raw?.cardTypeId;
  return raw != null && String(raw).trim() !== "" ? String(raw).trim() : null;
};

const resolveCardTagIdFromCard = (card) => {
  const raw =
    card?.card_tag_id ??
    card?.cardTagId ??
    card?.tag_id ??
    card?.tagId ??
    card?.raw?.card_tag_id ??
    card?.raw?.tag_id;
  return raw != null && String(raw).trim() !== "" ? String(raw).trim() : null;
};

const resolveCardBlockerIdFromCard = (card) => {
  const raw =
    card?.card_blocker_id ??
    card?.cardBlockerId ??
    card?.blocker_id ??
    card?.raw?.card_blocker_id ??
    card?.raw?.cardBlockerId ??
    card?.raw?.blocker_id;
  return raw != null && String(raw).trim() !== "" ? String(raw).trim() : null;
};

const resolveCardStickerIdFromCard = (card) => {
  const raw =
    card?.card_sticker_id ??
    card?.cardStickerId ??
    card?.sticker_id ??
    card?.raw?.card_sticker_id ??
    card?.raw?.cardStickerId ??
    card?.raw?.sticker_id;
  return raw != null && String(raw).trim() !== "" ? String(raw).trim() : null;
};

const unwrapListFromApi = (data, arrayKeys) => {
  if (Array.isArray(data)) return data;
  for (const key of arrayKeys) {
    if (data?.status === "success" && Array.isArray(data[key])) return data[key];
    if (Array.isArray(data?.[key])) return data[key];
  }
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

// Foreign keys that must never be mistaken for a picker row's own id.
const META_ROW_ID_EXCLUDE = new Set([
  "board_id",
  "card_id",
  "kanban_card_id",
  "created_by",
  "updated_by",
  "user_id",
  "owner_id",
  "workflow_id",
]);

const normalizeMetaPickerRow = (row, { idFields, nameField, defaultName }) => {
  const fields = Array.isArray(idFields) ? idFields : [idFields];
  let idRaw = fields.map((f) => row?.[f]).find((v) => v != null && String(v).trim() !== "");
  // Fallback: some board endpoints return the row id under an unexpected key
  // (e.g. `kanban_card_blocker_id`). Pick the first *_id field that isn't a
  // known foreign key so selecting the row still resolves an id.
  if ((idRaw == null || String(idRaw).trim() === "") && row && typeof row === "object") {
    const fallbackKey = Object.keys(row).find(
      (k) =>
        /_id$/i.test(k) &&
        !META_ROW_ID_EXCLUDE.has(k.toLowerCase()) &&
        row[k] != null &&
        String(row[k]).trim() !== ""
    );
    if (fallbackKey) idRaw = row[fallbackKey];
  }
  const hex = normalizeHexColor(row?.color_code || "#64748b");
  const rawIcon = row?.icon_name ?? row?.icon;
  const iconTrimmed = rawIcon != null ? String(rawIcon).trim() : "";
  return {
    id: idRaw != null ? String(idRaw).trim() : "",
    name: String(row?.[nameField] ?? row?.label ?? "").trim() || defaultName,
    color_code: hex,
    iconKey: iconTrimmed ? mapBackendIconNameToIconKey(iconTrimmed) : null,
  };
};

const normalizeBoardCardTypeRow = (row) =>
  normalizeMetaPickerRow(row, {
    idFields: ["card_type_id", "type_id"],
    nameField: "type_name",
    defaultName: "Unnamed type",
  });

const normalizeBoardCardTagRow = (row) =>
  normalizeMetaPickerRow(row, {
    idFields: ["tag_id", "card_tag_id"],
    nameField: "tag_name",
    defaultName: "Unnamed tag",
  });

const normalizeBoardCardBlockerRow = (row) =>
  normalizeMetaPickerRow(row, {
    idFields: ["card_blocker_id", "blocker_id", "id"],
    nameField: "blocker_name",
    defaultName: "Unnamed blocker",
  });

const normalizeBoardCardStickerRow = (row) =>
  normalizeMetaPickerRow(row, {
    idFields: ["card_sticker_id", "sticker_id", "id"],
    nameField: "sticker_name",
    defaultName: "Unnamed sticker",
  });

const mergeSelectionMeta = (prev, fromCard) => {
  if (!fromCard && !prev) return {};
  if (!fromCard) return prev || {};
  if (!prev) return fromCard;
  return {
    name: fromCard.name ?? prev.name,
    color_code: fromCard.color_code ?? prev.color_code,
    iconKey: fromCard.iconKey ?? prev.iconKey,
  };
};

const toDynamicIconKey = (raw) => {
  if (raw == null || String(raw).trim() === "") return null;
  return mapBackendIconNameToIconKey(String(raw).trim());
};

const resolveTopbarMetaFromCard = (card) => {
  const raw = card?.raw;
  return {
    type: {
      iconKey: toDynamicIconKey(
        card?.type_icon_name ?? raw?.type_icon_name ?? raw?.icon_name
      ),
      color_code:
        card?.type_color_code != null && String(card.type_color_code).trim() !== ""
          ? normalizeHexColor(card.type_color_code)
          : raw?.type_color_code != null && String(raw.type_color_code).trim() !== ""
            ? normalizeHexColor(raw.type_color_code)
            : raw?.color_code != null && String(raw.color_code).trim() !== ""
              ? normalizeHexColor(raw.color_code)
              : null,
      name: card?.type_name ?? raw?.type_name,
    },
    tag: {
      name: card?.tag_name ?? raw?.tag_name,
    },
    blocker: {
      iconKey: toDynamicIconKey(
        card?.blocker_icon_name ?? raw?.blocker_icon_name ?? raw?.icon_name
      ),
      color_code:
        card?.blocker_color_code != null && String(card.blocker_color_code).trim() !== ""
          ? normalizeHexColor(card.blocker_color_code)
          : raw?.blocker_color_code != null && String(raw.blocker_color_code).trim() !== ""
            ? normalizeHexColor(raw.blocker_color_code)
            : raw?.color_code != null && String(raw.color_code).trim() !== ""
              ? normalizeHexColor(raw.color_code)
              : null,
      name: card?.blocker_name ?? raw?.blocker_name,
    },
    sticker: {
      iconKey: toDynamicIconKey(
        card?.sticker_icon_name ?? raw?.sticker_icon_name ?? raw?.icon_name
      ),
      color_code:
        card?.sticker_color_code != null && String(card.sticker_color_code).trim() !== ""
          ? normalizeHexColor(card.sticker_color_code)
          : raw?.sticker_color_code != null && String(raw.sticker_color_code).trim() !== ""
            ? normalizeHexColor(raw.sticker_color_code)
            : raw?.color_code != null && String(raw.color_code).trim() !== ""
              ? normalizeHexColor(raw.color_code)
              : null,
      name: card?.sticker_name ?? raw?.sticker_name,
    },
  };
};

const selectionMetaFromPickerRow = (pickerKey, row) => {
  if (pickerKey === "tag") {
    return { name: row.name };
  }
  return {
    iconKey: row.iconKey,
    color_code: row.color_code,
    name: row.name,
  };
};

const BOARD_META_PICKERS = {
  type: {
    header: "Card type",
    emptyLabel: "types",
    showRowIcon: true,
    showTopbarDynamicIcon: true,
    resolveSelectedId: resolveCardTypeIdFromCard,
    listKeys: ["card_types"],
    normalizeRow: normalizeBoardCardTypeRow,
    fetchByBoard: (boardId) => kanbanBoardService.getCardTypesByBoard(boardId),
    updateCard: (cardId, itemId) =>
      kanbanBoardService.updateCardType({ card_id: cardId, card_type_id: itemId }),
    buildMeta: (row) => ({
      type_name: row.name,
      color_code: row.color_code,
      icon_name: row.iconKey,
    }),
    manageType: "card_type",
    loadError: "Could not load card types.",
    updateError: "Could not update card type.",
    successMsg: "Card type updated.",
    removeError: "Could not remove card type.",
    removeSuccessMsg: "Card type removed.",
  },
  tag: {
    header: "Card tag",
    emptyLabel: "tags",
    showRowIcon: false,
    showTopbarDynamicIcon: false,
    resolveSelectedId: resolveCardTagIdFromCard,
    listKeys: ["card_tags", "tags"],
    normalizeRow: normalizeBoardCardTagRow,
    fetchByBoard: (boardId) => kanbanBoardService.getCardTagsByBoard(boardId),
    updateCard: (cardId, itemId) =>
      kanbanBoardService.updateCardTag({ card_id: cardId, card_tag_id: itemId }),
    manageType: "card_tag",
    buildMeta: (row) => ({
      name: row.name,
      color_code: row.color_code,
      icon_name: row.iconKey,
    }),
    loadError: "Could not load card tags.",
    updateError: "Could not update card tag.",
    successMsg: "Card tag updated.",
    removeError: "Could not remove card tag.",
    removeSuccessMsg: "Card tag removed.",
  },
  blocker: {
    header: "Card blocker",
    emptyLabel: "blockers",
    showRowIcon: true,
    showTopbarDynamicIcon: true,
    resolveSelectedId: resolveCardBlockerIdFromCard,
    listKeys: ["card_blockers", "blockers", "kanban_card_blockers"],
    normalizeRow: normalizeBoardCardBlockerRow,
    fetchByBoard: (boardId) => kanbanBoardService.getCardBlockersByBoard(boardId),
    updateCard: (cardId, itemId) =>
      kanbanBoardService.updateCardBlocker({ card_id: cardId, card_blocker_id: itemId }),
    buildMeta: (row) => ({
      name: row.name,
      color_code: row.color_code,
      icon_name: row.iconKey,
    }),
    manageType: "card_blocker",
    loadError: "Could not load card blockers.",
    updateError: "Could not update card blocker.",
    successMsg: "Card blocker updated.",
    removeError: "Could not remove card blocker.",
    removeSuccessMsg: "Card blocker removed.",
  },
  sticker: {
    header: "Card sticker",
    emptyLabel: "stickers",
    showRowIcon: true,
    showTopbarDynamicIcon: true,
    resolveSelectedId: resolveCardStickerIdFromCard,
    listKeys: ["card_stickers", "stickers"],
    normalizeRow: normalizeBoardCardStickerRow,
    fetchByBoard: (boardId) => kanbanBoardService.getCardStickersByBoard(boardId),
    updateCard: (cardId, itemId) =>
      kanbanBoardService.updateCardSticker({ card_id: cardId, card_sticker_id: itemId }),
    buildMeta: (row) => ({
      name: row.name,
      color_code: row.color_code,
      icon_name: row.iconKey,
    }),
    manageType: "card_sticker",
    loadError: "Could not load card stickers.",
    updateError: "Could not update card sticker.",
    successMsg: "Card sticker updated.",
    removeError: "Could not remove card sticker.",
    removeSuccessMsg: "Card sticker removed.",
  },
};

const CardMetaPickerSwatch = ({ colorCode, iconKey }) => {
  const fg = contrastIconFg(colorCode);
  return (
    <span className="cardform-type-picker-row-icon" style={{ backgroundColor: colorCode }} aria-hidden>
      <DynamicIcon iconKey={iconKey} size={14} color={fg} />
    </span>
  );
};

CardMetaPickerSwatch.propTypes = {
  colorCode: PropTypes.string.isRequired,
  iconKey: PropTypes.string,
};

const CardMetaPickerPopover = ({
  header,
  floaterStyle,
  wrapRef,
  loading,
  items,
  selectedId,
  saving,
  emptyLabel,
  hasBoardId,
  showRowIcon = true,
  onSelect,
  hasSelection = false,
  removeLabel,
  onRemove,
}) => (
  <div
    ref={wrapRef}
    className="cardform-type-picker-popover"
    style={floaterStyle}
    role="listbox"
    aria-label={header}
  >
    <div className="cardform-type-picker-header">{header}</div>
    {hasSelection && (
      <button
        type="button"
        className="cardform-type-picker-remove-btn"
        onClick={onRemove}
        disabled={saving}
      >
        <X size={14} aria-hidden />
        <span>{removeLabel}</span>
      </button>
    )}
    {loading ? (
      <div className="cardform-type-picker-status">Loading…</div>
    ) : items.length === 0 ? (
      <div className="cardform-type-picker-status">
        {hasBoardId ? `No ${emptyLabel} available for this board.` : "Board id is missing."}
      </div>
    ) : (
      <ul className="cardform-type-picker-list">
        {items.map((row) => {
          const isSelected = selectedId === row.id;
          return (
            <li key={row.id || row.name}>
              <button
                type="button"
                className={`cardform-type-picker-row${isSelected ? " cardform-type-picker-row--selected" : ""}${!showRowIcon ? " cardform-type-picker-row--text-only" : ""}`}
                onClick={() => onSelect(row)}
                disabled={saving}
                role="option"
                aria-selected={isSelected}
              >
                {showRowIcon ? (
                  <CardMetaPickerSwatch colorCode={row.color_code} iconKey={row.iconKey} />
                ) : null}
                <span className="cardform-type-picker-row-label">{row.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    )}
  </div>
);

CardMetaPickerPopover.propTypes = {
  header: PropTypes.string.isRequired,
  floaterStyle: PropTypes.object.isRequired,
  wrapRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
  ]),
  loading: PropTypes.bool,
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
  selectedId: PropTypes.string,
  saving: PropTypes.bool,
  emptyLabel: PropTypes.string.isRequired,
  hasBoardId: PropTypes.bool,
  showRowIcon: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
  hasSelection: PropTypes.bool,
  removeLabel: PropTypes.string,
  onRemove: PropTypes.func,
};

// Sub-components
const TopBar = ({
  card,
  topbarColor,
  onClose,
  closeLoading = false,
  isAddMode = false,
  onColorChange,
  onTitleCommit,
  titleSaving = false,
  formValues,
  handleChange,
  boardId,
  onCardTypeChange,
  onCardTagChange,
  onCardBlockerChange,
  onCardStickerChange,
}) => {
  const effectiveCard = useMemo(
    () => (isAddMode ? { ...card, ...formValues } : card),
    [isAddMode, card, formValues]
  );

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [pickerFloaterStyle, setPickerFloaterStyle] = useState({});
  const [openPicker, setOpenPicker] = useState(null);
  const [metaPickerFloaterStyle, setMetaPickerFloaterStyle] = useState({});
  const [pickerLists, setPickerLists] = useState({ type: [], tag: [], blocker: [], sticker: [] });
  const [pickerLoading, setPickerLoading] = useState({
    type: false,
    tag: false,
    blocker: false,
    sticker: false,
  });
  const [metaSaving, setMetaSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => ({
    type: resolveCardTypeIdFromCard(effectiveCard),
    tag: resolveCardTagIdFromCard(effectiveCard),
    blocker: resolveCardBlockerIdFromCard(effectiveCard),
    sticker: resolveCardStickerIdFromCard(effectiveCard),
  }));
  const [selectedMeta, setSelectedMeta] = useState(() => resolveTopbarMetaFromCard(effectiveCard));
  const colorPickerTriggerRef = useRef(null);
  const pickerFloaterWrapRef = useRef(null);
  const metaPickerTriggerRefs = useRef({ type: null, tag: null, blocker: null, sticker: null });
  const metaPickerFloaterWrapRef = useRef(null);
  const metaPickerFetchRef = useRef({ type: 0, tag: 0, blocker: 0, sticker: 0 });
  const skipTitleCommitRef = useRef(false);
  const titleInputRef = useRef(null);

  const cardId = card?.code || card?.id || "";
  const cardTitle = card?.title || "";

  const metaPickerOnChange = useMemo(
    () => ({
      type: onCardTypeChange,
      tag: onCardTagChange,
      blocker: onCardBlockerChange,
      sticker: onCardStickerChange,
    }),
    [onCardTypeChange, onCardTagChange, onCardBlockerChange, onCardStickerChange]
  );

  const resolvedBoardId = useMemo(() => {
    if (boardId != null && String(boardId).trim() !== "") {
      return String(boardId).trim();
    }
    const fromCard =
      card?.board_id ?? card?.boardId ?? card?.raw?.board_id ?? card?.raw?.boardId;
    return fromCard != null && String(fromCard).trim() !== "" ? String(fromCard).trim() : null;
  }, [boardId, card]);

  useEffect(() => {
    const source = effectiveCard;
    setSelectedIds({
      type: resolveCardTypeIdFromCard(source),
      tag: resolveCardTagIdFromCard(source),
      blocker: resolveCardBlockerIdFromCard(source),
      sticker: resolveCardStickerIdFromCard(source),
    });
    setSelectedMeta((prev) => {
      const fromCard = resolveTopbarMetaFromCard(source);
      return {
        type: mergeSelectionMeta(prev?.type, fromCard.type),
        tag: { name: fromCard.tag?.name ?? prev?.tag?.name },
        blocker: mergeSelectionMeta(prev?.blocker, fromCard.blocker),
        sticker: mergeSelectionMeta(prev?.sticker, fromCard.sticker),
      };
    });
  }, [
    effectiveCard,
    isAddMode,
    formValues?.card_type_id,
    formValues?.type_name,
    formValues?.type_color_code,
    formValues?.type_icon_name,
    formValues?.card_tag_id,
    formValues?.tag_name,
    formValues?.card_blocker_id,
    formValues?.blocker_name,
    formValues?.blocker_color_code,
    formValues?.blocker_icon_name,
    formValues?.card_sticker_id,
    formValues?.sticker_name,
    formValues?.sticker_color_code,
    formValues?.sticker_icon_name,
  ]);

  useEffect(() => {
    setSelectedMeta((prev) => {
      let next = prev;
      let changed = false;
      for (const pickerKey of ["type", "blocker", "sticker"]) {
        const id = selectedIds[pickerKey];
        if (!id) continue;
        const row = pickerLists[pickerKey]?.find((r) => r.id === id);
        if (!row) continue;
        const rowMeta = selectionMetaFromPickerRow(pickerKey, row);
        if (
          rowMeta.iconKey !== prev[pickerKey]?.iconKey ||
          rowMeta.color_code !== prev[pickerKey]?.color_code ||
          rowMeta.name !== prev[pickerKey]?.name
        ) {
          next = { ...next, [pickerKey]: rowMeta };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [pickerLists, selectedIds]);

  const fetchPickerList = useCallback(
    async (pickerKey) => {
      const config = BOARD_META_PICKERS[pickerKey];
      if (!config) return;
      if (!resolvedBoardId) {
        setPickerLists((prev) => ({ ...prev, [pickerKey]: [] }));
        return;
      }
      const fetchId = ++metaPickerFetchRef.current[pickerKey];
      setPickerLoading((prev) => ({ ...prev, [pickerKey]: true }));
      try {
        const res = await config.fetchByBoard(resolvedBoardId);
        if (fetchId !== metaPickerFetchRef.current[pickerKey]) return;
        const body = res?.data;
        if (body && typeof body === "object" && body.status === "error") {
          const msg =
            typeof body.message === "string" && body.message.trim()
              ? body.message
              : config.loadError;
          throw new Error(msg);
        }
        const list = unwrapListFromApi(body, config.listKeys).map(config.normalizeRow);
        setPickerLists((prev) => ({ ...prev, [pickerKey]: list }));
      } catch (err) {
        if (fetchId !== metaPickerFetchRef.current[pickerKey]) return;
        setPickerLists((prev) => ({ ...prev, [pickerKey]: [] }));
        const msg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          config.loadError;
        notify(typeof msg === "string" ? msg : config.loadError, "error");
      } finally {
        if (fetchId === metaPickerFetchRef.current[pickerKey]) {
          setPickerLoading((prev) => ({ ...prev, [pickerKey]: false }));
        }
      }
    },
    [resolvedBoardId]
  );

  useLayoutEffect(() => {
    if (!isEditingTitle) return;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [isEditingTitle]);

  useLayoutEffect(() => {
    if (!isColorPickerOpen) return;
    const anchor = colorPickerTriggerRef.current;
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const width = 308;
    const left = Math.max(16, Math.min(r.right - width, window.innerWidth - width - 16));
    const top = Math.min(r.bottom + 8, window.innerHeight - 16);
    setPickerFloaterStyle({
      position: "fixed",
      top,
      left,
      zIndex: 13040,
    });
  }, [isColorPickerOpen]);

  useLayoutEffect(() => {
    if (!openPicker) return;
    const anchor = metaPickerTriggerRefs.current[openPicker];
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const width = TYPE_PICKER_WIDTH;
    const left = Math.max(16, Math.min(r.right - width, window.innerWidth - width - 16));
    const top = Math.min(r.bottom + 8, window.innerHeight - 16);
    setMetaPickerFloaterStyle({
      position: "fixed",
      top,
      left,
      zIndex: 13040,
    });
  }, [openPicker]);

  useEffect(() => {
    if (!isColorPickerOpen && !openPicker) return;
    const onMouseDown = (event) => {
      if (colorPickerTriggerRef.current?.contains(event.target)) return;
      if (pickerFloaterWrapRef.current?.contains(event.target)) return;
      if (metaPickerFloaterWrapRef.current?.contains(event.target)) return;
      for (const key of Object.keys(metaPickerTriggerRefs.current)) {
        if (metaPickerTriggerRefs.current[key]?.contains(event.target)) return;
      }
      setIsColorPickerOpen(false);
      setOpenPicker(null);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isColorPickerOpen, openPicker]);

  const handleToggleColorPicker = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenPicker(null);
    setIsColorPickerOpen((open) => !open);
  };

  const handleToggleMetaPicker = (pickerKey) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsColorPickerOpen(false);
    setOpenPicker((current) => {
      const next = current === pickerKey ? null : pickerKey;
      if (next) {
        fetchPickerList(next);
      }
      return next;
    });
  };

  const handleSelectMetaItem = async (pickerKey, row) => {
    if (metaSaving) return;
    const config = BOARD_META_PICKERS[pickerKey];
    if (!config || !row?.id) return;

    const itemIdStr = String(row.id).trim();
    if (selectedIds[pickerKey] === itemIdStr) {
      setOpenPicker(null);
      return;
    }

    const meta = config.buildMeta(row);
    const rowMeta = selectionMetaFromPickerRow(pickerKey, row);

    if (isAddMode) {
      setSelectedIds((prev) => ({ ...prev, [pickerKey]: itemIdStr }));
      setSelectedMeta((prev) => ({ ...prev, [pickerKey]: rowMeta }));
      metaPickerOnChange[pickerKey]?.(itemIdStr, meta);
      setOpenPicker(null);
      return;
    }

    const cardIdRaw = card?.id ?? card?.card_id;
    if (cardIdRaw == null || String(cardIdRaw).trim() === "") {
      notify(`Cannot update card ${config.emptyLabel.slice(0, -1)}: missing card id.`, "error");
      return;
    }

    const cardIdStr = String(cardIdRaw).trim();
    setMetaSaving(true);
    try {
      const res = await config.updateCard(cardIdStr, itemIdStr);
      const body = res?.data;
      if (body && typeof body === "object" && body.status === "error") {
        const msg =
          typeof body.message === "string" && body.message.trim()
            ? body.message
            : config.updateError;
        throw new Error(msg);
      }

      setSelectedIds((prev) => ({ ...prev, [pickerKey]: itemIdStr }));
      setSelectedMeta((prev) => ({
        ...prev,
        [pickerKey]: rowMeta,
      }));
      metaPickerOnChange[pickerKey]?.(itemIdStr, meta);
      notify(config.successMsg, "success");
      setOpenPicker(null);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        config.updateError;
      notify(typeof msg === "string" ? msg : config.updateError, "error");
    } finally {
      setMetaSaving(false);
    }
  };

  const handleRemoveMetaItem = async (pickerKey) => {
    if (metaSaving) return;
    const config = BOARD_META_PICKERS[pickerKey];
    if (!config || !selectedIds[pickerKey]) return;

    if (isAddMode) {
      setSelectedIds((prev) => ({ ...prev, [pickerKey]: null }));
      setSelectedMeta((prev) => ({ ...prev, [pickerKey]: {} }));
      metaPickerOnChange[pickerKey]?.(null, {});
      setOpenPicker(null);
      return;
    }

    const cardIdRaw = card?.id ?? card?.card_id;
    if (cardIdRaw == null || String(cardIdRaw).trim() === "") {
      notify(`Cannot remove card ${config.emptyLabel.slice(0, -1)}: missing card id.`, "error");
      return;
    }

    const cardIdStr = String(cardIdRaw).trim();
    setMetaSaving(true);
    try {
      const res = await kanbanBoardService.removeCardManagementItem({
        card_id: cardIdStr,
        manage_type: config.manageType,
      });
      const body = res?.data;
      if (body && typeof body === "object" && body.status === "error") {
        const msg =
          typeof body.message === "string" && body.message.trim()
            ? body.message
            : config.removeError;
        throw new Error(msg);
      }

      setSelectedIds((prev) => ({ ...prev, [pickerKey]: null }));
      setSelectedMeta((prev) => ({ ...prev, [pickerKey]: {} }));
      metaPickerOnChange[pickerKey]?.(null, {});
      notify(config.removeSuccessMsg, "success");
      setOpenPicker(null);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        config.removeError;
      notify(typeof msg === "string" ? msg : config.removeError, "error");
    } finally {
      setMetaSaving(false);
    }
  };

  const handleTitleChange = (e) => {
    if (handleChange) {
      handleChange("cardTitle")(e);
    }
  };

  const handleStartEditTitle = () => {
    setIsEditingTitle(true);
  };

  const commitTitleEdit = (rawValue) => {
    setIsEditingTitle(false);
    onTitleCommit?.(rawValue ?? formValues?.cardTitle ?? cardTitle);
  };

  const handleTitleBlur = (e) => {
    if (skipTitleCommitRef.current) {
      skipTitleCommitRef.current = false;
      setIsEditingTitle(false);
      return;
    }
    commitTitleEdit(e.target.value);
  };

  const handleTitleSaveClick = (e) => {
    e.preventDefault();
    commitTitleEdit();
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.target.blur();
    } else if (e.key === "Escape") {
      skipTitleCommitRef.current = true;
      if (handleChange) {
        handleChange("cardTitle")(cardTitle);
      }
      e.target.blur();
    }
  };

  const handleApplySedresColor = (hex) => {
    const next = normalizeHexColor(hex);
    if (onColorChange) {
      onColorChange(next);
    }
    setIsColorPickerOpen(false);
  };

  const handleCancelSedresColor = () => {
    setIsColorPickerOpen(false);
  };

  const TOPBAR_ICON_SIZE = 20;
  const openPickerConfig = openPicker ? BOARD_META_PICKERS[openPicker] : null;

  const renderMetaPickerButton = (pickerKey, DefaultIcon, title) => {
    const config = BOARD_META_PICKERS[pickerKey];
    const meta = selectedMeta[pickerKey];
    const hasSelection = Boolean(selectedIds[pickerKey]);
    const useDynamicTopbarIcon =
      config?.showTopbarDynamicIcon && hasSelection && meta?.iconKey;
    const dynamicSwatchColor = meta?.color_code || "#64748b";

    const buttonLabel = hasSelection && meta?.name ? `${title}: ${meta.name}` : title;

    return (
      <button
        key={pickerKey}
        ref={(el) => {
          metaPickerTriggerRefs.current[pickerKey] = el;
        }}
        type="button"
        className={`topbar-icon-btn${useDynamicTopbarIcon ? " topbar-icon-btn--dynamic" : ""}`}
        onClick={handleToggleMetaPicker(pickerKey)}
        title={buttonLabel}
        aria-label={buttonLabel}
        aria-expanded={openPicker === pickerKey}
        aria-haspopup="listbox"
      >
        {useDynamicTopbarIcon ? (
          <span
            className="topbar-icon-btn-dynamic-swatch"
            style={{ backgroundColor: dynamicSwatchColor }}
            aria-hidden
          >
            <DynamicIcon
              iconKey={meta.iconKey}
              size={18}
              color={contrastIconFg(dynamicSwatchColor)}
            />
          </span>
        ) : (
          <DefaultIcon size={TOPBAR_ICON_SIZE} aria-hidden />
        )}
      </button>
    );
  };

  return (
    <div className="cardform-topbar" style={{ backgroundColor: topbarColor }}>
      <div>
        {!isAddMode && <span className="cardform-id">ID : {cardId}</span>}
        {isAddMode ? (
          <input
            type="text"
            className="cardform-title-input"
            placeholder="Enter card title"
            value={formValues?.cardTitle || ""}
            onChange={handleTitleChange}
            autoFocus
          />
        ) : isEditingTitle ? (
          <div className="cardform-title-edit-wrap">
            <input
              ref={titleInputRef}
              type="text"
              className="cardform-title-input cardform-title-input--view"
              placeholder="Enter card title"
              value={formValues?.cardTitle ?? cardTitle}
              onChange={handleTitleChange}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              disabled={titleSaving}
              aria-label="Card title"
            />
            <button
              type="button"
              className="cardform-title-save-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleTitleSaveClick}
              disabled={titleSaving}
              aria-label="Save title"
              title="Save title"
            >
              <Check size={16} />
            </button>
          </div>
        ) : (
          <div className="cardform-title-display">
            <span className="cardform-title">{cardTitle || "Untitled"}</span>
            <button
              type="button"
              className="cardform-title-edit-btn"
              onClick={handleStartEditTitle}
              aria-label="Edit title"
              title="Edit title"
            >
              <Pencil size={14} />
            </button>
          </div>
        )}
      </div>
      <div className="cardform-topbar-right">
        {renderMetaPickerButton("tag", Tag, "Tag")}
        {renderMetaPickerButton("type", Layers3, "Type")}
        {openPicker &&
          openPickerConfig &&
          typeof document !== "undefined" &&
          createPortal(
            <CardMetaPickerPopover
              header={openPickerConfig.header}
              floaterStyle={metaPickerFloaterStyle}
              wrapRef={metaPickerFloaterWrapRef}
              loading={pickerLoading[openPicker]}
              items={pickerLists[openPicker] ?? []}
              selectedId={selectedIds[openPicker]}
              saving={metaSaving}
              emptyLabel={openPickerConfig.emptyLabel}
              hasBoardId={Boolean(resolvedBoardId)}
              showRowIcon={openPickerConfig.showRowIcon !== false}
              onSelect={(row) => handleSelectMetaItem(openPicker, row)}
              hasSelection={Boolean(selectedIds[openPicker])}
              removeLabel={`Remove ${openPickerConfig.emptyLabel.slice(0, -1)}`}
              onRemove={() => handleRemoveMetaItem(openPicker)}
            />,
            document.body
          )}
        {renderMetaPickerButton("blocker", AlertTriangle, "Blocker")}
        {renderMetaPickerButton("sticker", Sticker, "Sticker")}
        <div className="topbar-color-picker-wrapper">
          <button
            ref={colorPickerTriggerRef}
            type="button"
            className="topbar-color-picker-label"
            onClick={handleToggleColorPicker}
            title="Change header color"
            aria-label="Color Picker"
            aria-expanded={isColorPickerOpen}
          >
            <img src={ColorPickerIcon} alt="Color Picker" className="topbar-color-picker-icon" />
          </button>
          {isColorPickerOpen &&
            typeof document !== "undefined" &&
            createPortal(
              <div ref={pickerFloaterWrapRef} style={pickerFloaterStyle}>
                <SedresColorPicker
                  ariaLabel="Pick card header color"
                  initialHex={appearanceColorToPickerHex(topbarColor)}
                  className="kanban-dashboard-color-picker-popover--floating"
                  onApply={handleApplySedresColor}
                  onCancel={handleCancelSedresColor}
                />
              </div>,
              document.body
            )}
        </div>
        <button
          className={`cardform-close-btn${closeLoading ? " cardform-close-btn--loading" : ""}`}
          onClick={onClose}
          type="button"
          aria-label="Close"
          disabled={closeLoading}
          aria-busy={closeLoading}
        >
          {closeLoading ? (
            <span
              className="spinner-border spinner-border-sm cardform-close-btn__spinner"
              role="status"
              aria-hidden="true"
            />
          ) : (
            "✕"
          )}
        </button>
      </div>
    </div>
  );
};

TopBar.propTypes = {
  card: PropTypes.object,
  topbarColor: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  closeLoading: PropTypes.bool,
  isAddMode: PropTypes.bool,
  onColorChange: PropTypes.func,
  onTitleCommit: PropTypes.func,
  titleSaving: PropTypes.bool,
  formValues: PropTypes.object,
  handleChange: PropTypes.func,
  boardId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onCardTypeChange: PropTypes.func,
  onCardTagChange: PropTypes.func,
  onCardBlockerChange: PropTypes.func,
  onCardStickerChange: PropTypes.func,
};

const TopTabs = ({ tabs, activeTab, onTabChange, enabledTabs }) => {
  return (
    <div className="cardform-tabs">
      {tabs.map((tab) => {
        const isEnabled = enabledTabs.includes(tab);
        return (
          <NavTabButton
            key={tab}
            className={`tab ${!isEnabled ? "disabled" : ""} ${tab === "Sales Order" ? "tab-has-status" : ""}`}
            active={tab === activeTab}
            locked={isEnabled && tab === activeTab}
            onClick={() => onTabChange(tab)}
            disabled={!isEnabled}
          >
            {tab}
            {tab === "Sales Order" && (
              <span
                className="tab-status-dot"
                style={{ backgroundColor: "#e02020" }}
              />
            )}
          </NavTabButton>
        );
      })}
    </div>
  );
};

TopTabs.propTypes = {
  tabs: PropTypes.arrayOf(PropTypes.string).isRequired,
  activeTab: PropTypes.string.isRequired,
  onTabChange: PropTypes.func.isRequired,
  enabledTabs: PropTypes.arrayOf(PropTypes.string).isRequired,
};


const StepsProgress = ({ totalSteps = TOTAL_STEPS, activeStep = 2, completedSteps = 1, accentColor = DEFAULT_ACCENT_COLOR, stepLabels = STEP_LABELS, onStepClick, currentStep }) => {
  // Use green colors for all progress bars (ignoring accentColor)
  const GREEN_COMPLETED = "#2e7d32"; // Dark green for completed/active steps
  const GREEN_INACTIVE = "#8bc48a"; // Light green for inactive steps

  // Use currentStep as the actual current step (from card's column), fallback to activeStep
  const actualCurrentStep = currentStep !== null && currentStep !== undefined ? currentStep : activeStep;

  return (
    <div className="cardform-steps-wrapper">
      {Array.from({ length: totalSteps }, (_, index) => {
        const stepNumber = index + 1;
        const isCompleted = stepNumber <= completedSteps;
        const isCurrentStep = stepNumber === actualCurrentStep;
        // Treat current step as completed for styling
        const isStepCompletedOrCurrent = isCompleted || isCurrentStep;
        const stepClass = isStepCompletedOrCurrent ? "completed" : "";

        // Check if next step is also completed or current (for line styling)
        const nextStepNumber = stepNumber + 1;
        const isNextStepCompleted = nextStepNumber <= completedSteps;
        const isNextStepCurrent = nextStepNumber === actualCurrentStep;
        const isNextStepCompletedOrCurrent = isNextStepCompleted || isNextStepCurrent;
        const lineClass = isStepCompletedOrCurrent && isNextStepCompletedOrCurrent ? "completed-line" : "";

        // Determine if this step is clickable (any step, other than the current step itself)
        const isClickable = onStepClick && currentStep !== null && stepNumber !== currentStep;
        const isDisabled = false;

        // Always use green colors
        const circleStyle = isStepCompletedOrCurrent
          ? {
            background: GREEN_COMPLETED,
            color: "#ffffff",
            borderColor: GREEN_COMPLETED,
          }
          : {
            borderColor: GREEN_INACTIVE,
            color: GREEN_INACTIVE,
          };

        const lineStyle = isStepCompletedOrCurrent && isNextStepCompletedOrCurrent
          ? { background: GREEN_COMPLETED }
          : { background: GREEN_INACTIVE };

        const labelStyle = isStepCompletedOrCurrent
          ? { color: GREEN_COMPLETED }
          : { color: GREEN_INACTIVE };

        const stepLabel = stepLabels[index] || `Step ${stepNumber}`;
        const handleStepClick = () => {
          if (onStepClick && isClickable) {
            onStepClick(stepLabel, stepNumber);
          }
        };

        return (
          <div
            key={stepNumber}
            className={`step-item ${stepClass} ${isClickable ? 'clickable' : ''} ${isDisabled ? 'disabled' : ''}`}
            onClick={handleStepClick}
            style={isClickable ? { cursor: 'pointer' } : isDisabled ? { cursor: 'not-allowed', opacity: 0.5 } : {}}
          >
            <div className="step-content">
              <div className="step-circle" style={circleStyle}>
                {stepNumber}
              </div>
              {index < totalSteps - 1 && (
                <span className={`step-line ${lineClass}`} style={lineStyle}></span>
              )}
            </div>
            <div className="step-label" style={labelStyle}>
              {stepLabel}
            </div>
          </div>
        );
      })}
    </div>
  );
};

StepsProgress.propTypes = {
  totalSteps: PropTypes.number,
  activeStep: PropTypes.number,
  completedSteps: PropTypes.number,
  accentColor: PropTypes.string,
  stepLabels: PropTypes.arrayOf(PropTypes.string),
  onStepClick: PropTypes.func,
  currentStep: PropTypes.number,
};

const CardFormFooter = ({ accentColor, onUpdate, activeStep = 2, completedSteps = 1, activeTab, onStepClick, currentStep, isSimplifiedMode = false, isDriverMode = false, isGROMode = false, stepLabels = STEP_LABELS, totalSteps = TOTAL_STEPS }) => {
  const hideStepsForTab =
    activeTab === "Appointment Details" ||
    activeTab === "Export Approval";
  const showSteps =
    isGROMode ||
    isDriverMode ||
    (!isSimplifiedMode && !hideStepsForTab) ||
    (isSimplifiedMode && activeTab !== "General");
  return (
    <div className="cardform-footer">
      {showSteps && (
        <StepsProgress
          totalSteps={totalSteps}
          activeStep={activeStep}
          completedSteps={completedSteps}
          accentColor={accentColor}
          stepLabels={stepLabels}
          onStepClick={onStepClick}
          currentStep={currentStep}
        />
      )}
    </div>
  );
};

CardFormFooter.propTypes = {
  accentColor: PropTypes.string.isRequired,
  onUpdate: PropTypes.func.isRequired,
  activeStep: PropTypes.number,
  completedSteps: PropTypes.number,
  activeTab: PropTypes.string,
  onStepClick: PropTypes.func,
  currentStep: PropTypes.number,
  isSimplifiedMode: PropTypes.bool,
  isDriverMode: PropTypes.bool,
  isGROMode: PropTypes.bool,
  stepLabels: PropTypes.arrayOf(PropTypes.string),
  totalSteps: PropTypes.number,
};

// Stable random index (0 or 1) from row id for Status label
const getStatusIndex = (row) => {
  const id = String(row?.id ?? row?.crewName ?? Math.random());
  const hash = id.split("").reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0);
  return Math.abs(hash) % 2;
};

// Dummy PickUp/DropOff values corresponding to status (Pickup vs Drop off)
const DUMMY_PICKUP = [
  { date: "15 Jul 2026", time: "09:00", location: "Port Terminal A" },
  { date: "14 Jul 2026", time: "08:30", location: "Airport Arrival Hall" },
  { date: "16 Jul 2026", time: "10:15", location: "Marina Bay Pier" },
];
const DUMMY_DROPOFF = [
  { date: "15 Jul 2026", time: "14:30", location: "Vessel MV Indian Ocean" },
  { date: "14 Jul 2026", time: "16:00", location: "Port Terminal B" },
  { date: "16 Jul 2026", time: "11:45", location: "Harbor Gate 2" },
];
const getDummyPickup = (row) => {
  const id = String(row?.id ?? row?.crewName ?? "");
  const i = Math.abs(id.split("").reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0)) % DUMMY_PICKUP.length;
  return DUMMY_PICKUP[i];
};
const getDummyDropoff = (row) => {
  const id = String(row?.id ?? row?.crewName ?? "");
  const i = Math.abs(id.split("").reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0)) % DUMMY_DROPOFF.length;
  return DUMMY_DROPOFF[i];
};

// Dummy Check In / Check Out date and time for Hotel (corresponding to CheckIn vs CheckOut status)
const DUMMY_CHECK_IN = [
  { date: "14 Jul 2026", time: "14:00" },
  { date: "15 Jul 2026", time: "15:30" },
  { date: "16 Jul 2026", time: "10:00" },
];
const DUMMY_CHECK_OUT = [
  { date: "17 Jul 2026", time: "11:00" },
  { date: "18 Jul 2026", time: "09:30" },
  { date: "19 Jul 2026", time: "12:00" },
];
const getDummyCheckIn = (row) => {
  const id = String(row?.id ?? row?.crewName ?? "");
  const i = Math.abs(id.split("").reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0)) % DUMMY_CHECK_IN.length;
  return DUMMY_CHECK_IN[i];
};
const getDummyCheckOut = (row) => {
  const id = String(row?.id ?? row?.crewName ?? "");
  const i = Math.abs(id.split("").reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0)) % DUMMY_CHECK_OUT.length;
  return DUMMY_CHECK_OUT[i];
};

// Driver Board card view: 4 counters + crew table
// variant: "driver" => Status = Pickup (green) / Drop off (orange) | "hotel" => Status = CheckIn (green) / CheckOut (orange)
const DriverCardView = ({ card, variant = "driver" }) => {
  const owner = card?.user ?? "—";
  const callType = card?.typeOfCall ?? "—";
  const vesselName = card?.vesselName ?? "—";
  const vesselType = card?.vesselType ?? "—";
  const crew = Array.isArray(card?.crew) ? card.crew : [];

  const isHotel = variant === "hotel";
  const statusOptions = isHotel ? ["CheckIn", "CheckOut"] : ["Pickup", "Drop off"];

  const CounterCard = ({ label, value }) => (
    <div className="driver-card-counter">
      <div className="driver-card-counter-label">{label}</div>
      <div className="driver-card-counter-value">{value}</div>
    </div>
  );

  const StatusBadge = ({ row }) => {
    const index = getStatusIndex(row);
    const label = statusOptions[index];
    const isGreen = index === 0;
    return (
      <span
        className={`driver-crew-status-btn driver-crew-status-badge ${isGreen ? "status-green-border" : "status-orange-border"}`}
        title={label}
      >
        {label}
      </span>
    );
  };

  return (
    <div className="driver-card-view">
      <div className="driver-card-counters">
        <CounterCard label="Billing Entity" value={owner} />
        <CounterCard label="CALL TYPE" value={callType} />
        <CounterCard label="VESSEL NAME" value={vesselName} />
        <CounterCard label="VESSEL TYPE" value={vesselType} />
      </div>
      <div className="driver-crew-table-wrap">
        <table className="driver-crew-table">
          <thead>
            <tr>
              <th>Crew Name</th>
              <th>Nationality</th>
              <th>Passport No</th>
              {isHotel ? (
                <>
                  <th>Check In Date and Time</th>
                  <th>Check Out Date and Time</th>
                </>
              ) : (
                <>
                  <th>PickUp Date, Time and Location</th>
                  <th>DropOff Date, Time and Location</th>
                </>
              )}
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {crew.length === 0 ? (
              <tr>
                <td colSpan={6} className="driver-crew-empty">No crew data</td>
              </tr>
            ) : (
              crew.map((row) => {
                const statusIndex = getStatusIndex(row);
                const isFirstStatus = statusIndex === 0; // Pickup / CheckIn
                if (isHotel) {
                  const checkInData = row.checkInDate || row.checkInTime
                    ? { date: row.checkInDate, time: row.checkInTime }
                    : (isFirstStatus ? getDummyCheckIn(row) : getDummyCheckIn(row));
                  const checkOutData = row.checkOutDate || row.checkOutTime
                    ? { date: row.checkOutDate, time: row.checkOutTime }
                    : (!isFirstStatus ? getDummyCheckOut(row) : null);
                  return (
                    <tr key={row.id || row.crewName + row.passportNo}>
                      <td>{row.crewName ?? "—"}</td>
                      <td>{row.nationality ?? "—"}</td>
                      <td>{row.passportNo ?? "—"}</td>
                      <td className="driver-crew-datetime-loc">
                        {checkInData ? (
                          <>
                            {checkInData.date && <span>{checkInData.date}</span>}
                            {checkInData.time && <span>{checkInData.time}</span>}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="driver-crew-datetime-loc">
                        {checkOutData ? (
                          <>
                            {checkOutData.date && <span>{checkOutData.date}</span>}
                            {checkOutData.time && <span>{checkOutData.time}</span>}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <StatusBadge row={row} />
                      </td>
                    </tr>
                  );
                }
                const pickupData = row.pickupDate || row.pickupTime || row.pickupLocation
                  ? { date: row.pickupDate, time: row.pickupTime, location: row.pickupLocation }
                  : getDummyPickup(row);
                const dropoffData = row.dropoffDate || row.dropoffTime || row.dropoffLocation
                  ? { date: row.dropoffDate, time: row.dropoffTime, location: row.dropoffLocation }
                  : (!isFirstStatus ? getDummyDropoff(row) : null);
                return (
                  <tr key={row.id || row.crewName + row.passportNo}>
                    <td>{row.crewName ?? "—"}</td>
                    <td>{row.nationality ?? "—"}</td>
                    <td>{row.passportNo ?? "—"}</td>
                    <td className="driver-crew-datetime-loc">
                      {pickupData ? (
                        <>
                          {pickupData.date && <span>{pickupData.date}</span>}
                          {pickupData.time && <span>{pickupData.time}</span>}
                          {pickupData.location && <span>{pickupData.location}</span>}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="driver-crew-datetime-loc">
                      {dropoffData ? (
                        <>
                          {dropoffData.date && <span>{dropoffData.date}</span>}
                          {dropoffData.time && <span>{dropoffData.time}</span>}
                          {dropoffData.location && <span>{dropoffData.location}</span>}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <StatusBadge row={row} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

DriverCardView.propTypes = {
  card: PropTypes.object,
  variant: PropTypes.oneOf(["driver", "hotel"]),
};


// Tab Content Renderer
const renderTabContent = (
  activeTab,
  card,
  formValues,
  handleChange,
  ownerInitial,
  isAddMode = false,
  isSimplifiedMode = false,
  isDAModule = false,
  addModeSave = {},
  salesOrderApiLoading = false,
  salesOrderApiError = null,
  onExportApprovalWorkflowActionCompleted,
  daStatusRefreshToken,
  onAdvanceDaStage,
  isAdvancingDaStage
) => {
  const commonProps = {
    card,
    formValues,
    handleChange,
    isAddMode,
    isSimplifiedMode,
    isDAModule,
    onSave: addModeSave.onSave,
    isSavingGeneral: addModeSave.isSavingGeneral,
    hasSubmitted: addModeSave.hasSubmitted,
    setHasSubmitted: addModeSave.setHasSubmitted,
    setIsSavingGeneral: addModeSave.setIsSavingGeneral,
    salesOrderApiLoading,
    salesOrderApiError,
    daStatusRefreshToken,
    onAdvanceDaStage,
    isAdvancingDaStage,
  };

  if (isDAModule) {
    // DA mode - General, Operation, Husbandry, Sales Order, Reports, KPI, Invoice
    switch (activeTab) {
      case "General":
        return <General {...commonProps} />;
      case "Operation":
        return <Operation {...commonProps} ownerInitial={ownerInitial} />;
      case "Husbandry":
        return <Husbandry {...commonProps} />;
      case "Sales Order":
        return <SalesOrder {...commonProps} />;
      case "Invoice":
        return <Invoice {...commonProps} />;
      case "Reports":
        return <Reports {...commonProps} />;
      case "KPI":
        return <KPI {...commonProps} />;
      case "Comments":
        return <Comments {...commonProps} />;
      case "Subtasks":
        return <Subtasks {...commonProps} />;
      case "Notes":
        return <Notes {...commonProps} />;
      default:
        return <General {...commonProps} />;
    }
  } else if (isSimplifiedMode) {
    // Simplified mode - General, Invoice, and Sales Order
    switch (activeTab) {
      case "General":
        return <General {...commonProps} />;
      case "Invoice":
        return <Invoice {...commonProps} />;
      case "Sales Order":
        return <SalesOrder {...commonProps} />;
      case "Comments":
        return <Comments {...commonProps} />;
      case "Subtasks":
        return <Subtasks {...commonProps} />;
      case "Notes":
        return <Notes {...commonProps} />;
      default:
        return <General {...commonProps} />;
    }
  } else {
    // Full mode - all tabs
    switch (activeTab) {
      case "Appointment Details":
        return <General {...commonProps} />;
      case "Export Approval":
        return <Approval {...commonProps} onWorkflowActionCompleted={onExportApprovalWorkflowActionCompleted} />;
      case "Operation":
        return <Operation {...commonProps} ownerInitial={ownerInitial} />;
      case "Husbandry":
        return <Husbandry {...commonProps} />;
      case "Document Library":
        return <DocumentLibrary {...commonProps} />;
      case "Sales Order":
        return <SalesOrder {...commonProps} />;
      case "Reports":
        return <Reports {...commonProps} />;
      case "KPI":
        return <KPI {...commonProps} />;
      case "Comments":
        return <Comments {...commonProps} />;
      case "Subtasks":
        return <Subtasks {...commonProps} />;
      case "Notes":
        return <Notes {...commonProps} />;
      case "DA":
        return <DA {...commonProps} />;
      default:
        return <General {...commonProps} />;
    }
  }
};

// Main Component
function CardForm({
  show,
  close,
  card,
  moveCardToColumn,
  columns,
  columnOrder,
  currentColumn,
  isAddMode = false,
  variant = "default",
  boardId,
  onBoardRefresh,
  patchCardColor,
  patchCardTitle,
  patchCardType,
  patchCardBlocker,
  patchCardSticker,
  patchCardTag,
}) {
  const userProfile = useAuthReducer((state) => state.userProfile);
  const userRoleId = getFirstUserRoleId(userProfile);
  // DA (22) shares the GRO Supervisor view for GRO-workflow cards, but on their own
  // Centralized DA Desk board (board_id "3") they should get the normal DA card view
  // (tab bar + "DA" tab) instead of the generic GRO fallback view.
  const isDAUser = String(userRoleId ?? "") === "22";
  const isDABoardCard = String(boardId ?? "") === "3";
  const effectiveVariant = (() => {
    if (
      (isGROSupervisorRole(userRoleId) || isGROSupervisorRole(Number(userRoleId))) &&
      !(isDAUser && isDABoardCard)
    ) {
      return "gro";
    }
    if (
      isCustomClearanceSupervisorRole(userRoleId) ||
      isCustomClearanceSupervisorRole(Number(userRoleId))
    ) {
      return "custom";
    }
    // Taxi Boat Captain (role 21) always works through the taxi-boat card UI,
    // regardless of which workflow the card itself belongs to — same reasoning
    // as the GRO/Custom Clearance Supervisor overrides above.
    if (String(userRoleId ?? "") === "21") {
      return "taxi-boat";
    }
    return variant;
  })();

  const location = useLocation();
  // Coordinator Transport view — three independent signals, any of which should
  // trigger it, since the same card can be reached through different paths:
  //  1) the dedicated board route (pages/CoordinatorTransport hardcodes variant="gro"
  //     and doesn't set workflow_role_id per-card);
  //  2) the viewer's own role is 19;
  //  3) the card's own workflow_role_id is 19 (kept for forward-compat, though the
  //     live get_full_board payload shows these cards actually live inside the GRO
  //     Workflow (role_id 6), not a dedicated role-19 workflow);
  //  4) the card's task_name is "Transport Request" — the actual signal: these are
  //     GRO-workflow task cards that GROCardView doesn't special-case, so they fall
  //     through to its generic Documents panel. An Operator opening one of these via
  //     the generic /kanban-board/:boardId board hits this path.
  const isCoordinatorTransportBoard = location.pathname === "/kanban-board/coordinator-transport";
  const cardTaskName = String(card?.task_name ?? card?.taskName ?? "").trim().toLowerCase();
  const isCoordinatorTransport =
    isCoordinatorTransportBoard ||
    String(userRoleId ?? "") === "19" ||
    String(card?.workflow_role_id ?? "") === "19" ||
    cardTaskName === "transport request";
  const isDriverVariant = effectiveVariant === "driver";
  const isHotelVariant = effectiveVariant === "hotel";
  const isMWPVariant = effectiveVariant === "mwp";
  const isGROVariant = effectiveVariant === "gro";
  const isCustomVariant = effectiveVariant === "custom";
  const isTaxiBoatVariant = effectiveVariant === "taxi-boat";
  const isDAVariant = effectiveVariant === "da";
  // kanban_board/get_full_board/{id} echoes board_id per workflow (data.js mapBoardWorkflowFromApi);
  // boardId here is the same id this board was fetched with, so board_id "3" identifies the
  // real Centralized DA Desk board — this replaces the old static/demo DA workflow injection.
  const isDABoard = String(boardId ?? "") === "3";
  const isGROStyleView = isGROVariant || isCustomVariant;
  const isDriverStyleView = isDriverVariant || isHotelVariant;
  const isSubTaskCard = card?.isSubTask === true;

  // Step labels from columns + columnOrder (e.g. DAdata columnTitles); fallback to STEP_LABELS
  const { stepLabels, totalSteps } = useMemo(() => {
    const fromColumns = getStepLabelsFromColumns(columns, columnOrder);
    if (fromColumns) {
      return { stepLabels: fromColumns, totalSteps: fromColumns.length };
    }
    return { stepLabels: STEP_LABELS, totalSteps: TOTAL_STEPS };
  }, [columns, columnOrder]);

  const isSimplifiedMode = false;

  // Enable DA mode only for explicit DA routes, not generic /kanban-board/:boardId.
  const isDAModule = /^\/kanban-board\/(centralized-da-desk|jubail-operations|rastanura-dammam-operations|coordinator-transport|ras-tanura-operations)$/.test(location.pathname);


  const defaultTab = isDAModule ? "General" : (isSimplifiedMode ? "General" : "Appointment Details");

  const [activeTopTab, setActiveTopTab] = useState(defaultTab);

  // Header color: add mode defaults to ADD_CARD_TOPBAR_DEFAULT_HEX; else mirrors card.color (or GRO default).
  // In add mode, the color picker also updates formValues.cardColor so create_call_file sends card_color.
  const [topbarColor, setTopbarColor] = useState(() => {
    if (isAddMode) {
      return ADD_CARD_TOPBAR_DEFAULT_HEX;
    }
    if (isGROStyleView) {
      return GRO_TASK_HEADER_DEFAULT_HEX;
    }
    return card?.color || DEFAULT_ACCENT_COLOR;
  });

  const initialFormValues = useMemo(
    () => ({
      cardTitle: card?.title || "",
      cardColor: isAddMode
        ? ADD_CARD_TOPBAR_DEFAULT_HEX
        : card?.color || DEFAULT_ACCENT_COLOR,
      owner: isAddMode
        ? String(getItem("userid") ?? "")
        : String(card?.owner_user_id ?? card?.owner ?? ""),
      // FLEEyt (for simplified mode)
      type: card?.type || "Type",
      // Service Information (ids for API payloads)
      call_type_id: String(card?.call_type_id ?? card?.typeOfCall ?? card?.raw?.call_type_id ?? ""),
      typeOfCall: String(card?.call_type_id ?? card?.typeOfCall ?? ""),
      mainBillingEntity: String(card?.main_billing_entity_id ?? card?.mainBillingEntity ?? ""),
      // Appointment Details
      appointmentReceivedDate: card?.appointmentReceivedDate || "",
      appointmentReceivedTime: card?.appointmentReceivedTime || "",
      appointmentAcceptanceDate: card?.appointmentAcceptanceDate || "",
      // Vessel Information
      port: String(card?.port_id ?? card?.port ?? ""),
      // "tug" preselected in add mode; in view/edit mode an empty value lets the
      // value resolve from the fetched call detail (appointment_type) instead.
      appointmentType: (() => {
        const raw = card?.appointmentType;
        if (Array.isArray(raw) && raw.length) {
          if (raw.includes("tug_and_barge")) return "tug_and_barge";
          if (raw.includes("tug")) return "tug";
        }
        if (typeof raw === "string" && raw.trim()) return raw.trim();
        return isAddMode ? "tug" : "";
      })(),
      vesselType: String(card?.vessel_type_id ?? card?.vesselType ?? ""),
      vesselName: card?.vesselName || "",
      vesselOwner: card?.vesselOwner || "",
      vesselPrincipal: card?.vesselPrincipal || "",
      vesselManager: card?.vesselManager || "",
      // Tug and Barge — Tug sub-section (reuses standard vessel_* API keys)
      tugType: String(card?.tug_type_id ?? card?.tugType ?? ""),
      tugVesselName: card?.tugVesselName || "",
      tugOwner: card?.tugOwner || "",
      tugPrincipal: card?.tugPrincipal || "",
      tugManager: card?.tugManager || "",
      // Tug and Barge — Barge sub-section (barge_vessel_* API keys)
      bargeType: String(card?.barge_type_id ?? card?.bargeType ?? ""),
      bargeVesselName: card?.bargeVesselName || "",
      bargeOwner: card?.bargeOwner || "",
      bargePrincipal: card?.bargePrincipal || "",
      bargeManager: card?.bargeManager || "",
      otherBillingEntity: String(card?.other_billing_entity_id ?? card?.otherBillingEntity ?? ""),
      assignedOperator: String(card?.assigned_operator_id ?? card?.assignedOperator ?? ""),
      serviceRequestorName: card?.serviceRequestorName || "",
      serviceRequestorEmail: card?.serviceRequestorEmail || "",
      dailyReportEmail: card?.dailyReportEmail || "",
      billingInstructionEmails: Array.isArray(card?.billingInstructionEmails) ? card.billingInstructionEmails : [],
      billingInstructions: card?.billingInstructions || "",
      // Pre-Arrival Information
      expectedArrivalDate: card?.expectedArrivalDate || "",
      expectedArrivalTime: card?.expectedArrivalTime || "",
      customsInspectionDate: card?.customsInspectionDate || "",
      customsInspectionTime: card?.customsInspectionTime || "",
      immigrationClearanceDate: card?.immigrationClearanceDate || "",
      immigrationClearanceTime: card?.immigrationClearanceTime || "",
      inwardClearanceDate: card?.inwardClearanceDate || "",
      inwardClearanceTime: card?.inwardClearanceTime || "",
      preArrivalDocumentHandling: (() => {
        const base = JSON.parse(JSON.stringify(DEFAULT_PRE_ARRIVAL_DOCUMENT_HANDLING));
        const c = card?.preArrivalDocumentHandling;
        if (!c || typeof c !== "object") return base;
        const normalizeRows = (rows, fallbackRows) =>
          Array.isArray(rows) && rows.length
            ? rows.map((row) => ({
              ...row,
              files: Array.isArray(row?.files)
                ? row.files
                : row?.file
                  ? [row.file]
                  : [],
            }))
            : fallbackRows;
        return {
          selectedProcesses: { ...base.selectedProcesses, ...c.selectedProcesses },
          documents: {
            gro: normalizeRows(c.documents?.gro, base.documents.gro),
            customClearance: normalizeRows(c.documents?.customClearance, base.documents.customClearance),
          },
        };
      })(),
      // Legacy fields (keeping for backward compatibility)
      lastPort: card?.lastPort ?? card?.last_port ?? "",
      etaDate: card?.etaDate || "",
      etaTime: card?.etaTime || "",
      customsStart: card?.customsStart || "",
      clearanceCompletion: card?.clearanceCompletion || "",
      lastMovedDate: card?.lastMovedDate || "",
      lastMovedTime: card?.lastMovedTime || "",
      // Attachments and Links
      attachments: card?.attachments || [],
      departureAttachments: card?.departureAttachments || [],
      departureReportAttachments: card?.departureReportAttachments || [],
      preArrivalAdditionalTimeObjects: Array.isArray(card?.preArrivalAdditionalTimeObjects)
        ? card.preArrivalAdditionalTimeObjects
        : [],
      arrivalAdditionalTimeObjects: Array.isArray(card?.arrivalAdditionalTimeObjects)
        ? card.arrivalAdditionalTimeObjects
        : [],
      departureAdditionalTimeObjects: Array.isArray(card?.departureAdditionalTimeObjects)
        ? card.departureAdditionalTimeObjects
        : [],
      links: card?.links || [],
      // Remarks (for simplified mode)
      remarks: card?.remarks || "",
      // MWP RENEWAL specific fields
      taxInvoice: card?.taxInvoice || "",
      invoiceAmount: card?.invoiceAmount || "",
      sapSalesOrderNo: card?.sapSalesOrderNo || "",
      issueDate: card?.issueDate || "",
      expiryDate: card?.expiryDate || "",
      // MWP RENEWAL documents
      appointmentEmailDocuments: card?.appointmentEmailDocuments || [],
      mwpCopyDocuments: card?.mwpCopyDocuments || [],
      supportingDocuments: card?.supportingDocuments || [],
      fdaDispatchProofDocuments: card?.fdaDispatchProofDocuments || [],
      copyOfSalesOrderDocuments: card?.copyOfSalesOrderDocuments || [],
      // Sales Order (API: sales_order/get_so_items_by_call/{call_id})
      call_id: String(card?.call_id ?? card?.callId ?? ""),
      salesOrderList: Array.isArray(card?.salesOrderList) ? card.salesOrderList : [],
      billingEntity: card?.billingEntity || "",
      email: card?.email || "",
      branch: card?.branch || "",
      srtNumber: card?.srtNumber || "",
      lineItemTotal: card?.lineItemTotal ?? 0,
      soStatus: card?.soStatus || "",
      salesOrderId: card?.salesOrderId || "",
      soCustomerCode: card?.soCustomerCode || "",
      soCustomerName: card?.soCustomerName || card?.name || "",
      soContactPerson: card?.soContactPerson || card?.user || "",
      soBpCurrency: card?.soBpCurrency || "",
      soEuroRate: card?.soEuroRate || "",
      soPoNo: card?.soPoNo || "",
      soPort: card?.soPort || card?.port || "",
      soSoNo: card?.soSoNo || "",
      soPostingDate: card?.soPostingDate || "",
      soDeliveryDate: card?.soDeliveryDate || "",
      soDocumentDate: card?.soDocumentDate || "",
      soShipName: card?.soShipName || card?.vesselName || "",
      soProjectName: card?.soProjectName || "",
      soOwner: card?.soOwner || "",
      soSubtotal: card?.soSubtotal ?? "",
      soTotalDiscount: card?.soTotalDiscount ?? "",
      soDiscountPercentage: card?.soDiscountPercentage ?? "",
      soTotalTax: card?.soTotalTax ?? "",
      soGrandTotal: card?.soGrandTotal ?? "",
      soRemarks: card?.soRemarks || "",
    }),
    [card, isAddMode]
  );

  const cardFormSyncKey = useMemo(
    () => `${isAddMode ? "add" : "view"}:${card?.id ?? card?.card_id ?? ""}`,
    [isAddMode, card?.id, card?.card_id]
  );

  const [formValues, setFormValues] = useState(initialFormValues);
  const initialFormValuesRef = useRef(initialFormValues);
  initialFormValuesRef.current = initialFormValues;

  useEffect(() => {
    setFormValues(initialFormValuesRef.current);
  }, [cardFormSyncKey]);

  const [callDetailSnapshot, setCallDetailSnapshot] = useState(null);

  useEffect(() => {
    if (!show || isAddMode) {
      setCallDetailSnapshot(null);
      return undefined;
    }

    const callIdRaw = card?.call_id ?? card?.callId;
    const callId = callIdRaw != null ? String(callIdRaw).trim() : "";
    if (!callId) {
      setCallDetailSnapshot(null);
      return undefined;
    }

    let cancelled = false;

    const loadCallDetail = async () => {
      try {
        const { data } = await callFileService.getCallDetail(callId);
        if (!cancelled) {
          setCallDetailSnapshot(data?.data ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          setCallDetailSnapshot(null);
        }
      }
    };

    loadCallDetail();

    return () => {
      cancelled = true;
    };
  }, [show, isAddMode, card?.call_id, card?.callId, cardFormSyncKey]);

  // callDetailSnapshot only loads once per modal-open (effect above) — it has
  // no reason to refetch on its own while the same card stays open. The
  // Export Approval tab's export_approval_status lives on this same snapshot
  // and gates the "Operation" tab (see isExportApprovalCompleted below), so
  // without this, approving/proceeding/holding inside that tab would leave
  // the Operation tab lock stale until the modal is closed and reopened.
  const refetchCallDetailSnapshot = useCallback(async () => {
    if (isAddMode) return;
    const callIdRaw = card?.call_id ?? card?.callId;
    const callId = callIdRaw != null ? String(callIdRaw).trim() : "";
    if (!callId) return;
    try {
      const { data } = await callFileService.getCallDetail(callId);
      setCallDetailSnapshot(data?.data ?? null);
    } catch {
      // Keep whatever snapshot is already displayed rather than blanking it
      // out on a transient refetch failure.
    }
  }, [isAddMode, card?.call_id, card?.callId]);

  useEffect(() => {
    if (isAddMode || !callDetailSnapshot?.call_type_id) return;
    const callTypeId = String(callDetailSnapshot.call_type_id).trim();
    if (!callTypeId) return;

    setFormValues((prev) => {
      const current = String(prev.call_type_id ?? prev.typeOfCall ?? "").trim();
      if (current === callTypeId) return prev;
      return { ...prev, call_type_id: callTypeId, typeOfCall: callTypeId };
    });
  }, [isAddMode, callDetailSnapshot]);

  const showExportTabs = isExportCall(card, formValues, callDetailSnapshot);

  // Flatten card management metadata (card_type / card_tag / card_blocker / card_sticker)
  // from get_call_detail into the flat field names the TopBar resolvers expect.
  const cardMetaFromSnapshot = useMemo(() => {
    const snap = callDetailSnapshot;
    if (!snap || typeof snap !== "object") return null;
    const meta = {};

    const ct = snap.card_type;
    if (ct && typeof ct === "object") {
      if (ct.card_type_id != null) meta.card_type_id = ct.card_type_id;
      if (ct.type_name != null) meta.type_name = ct.type_name;
      if (ct.color_code != null) meta.type_color_code = ct.color_code;
      if (ct.icon_name != null) meta.type_icon_name = ct.icon_name;
    }

    const tg = snap.card_tag;
    if (tg && typeof tg === "object") {
      const tagId = tg.tag_id ?? tg.card_tag_id;
      if (tagId != null) {
        meta.card_tag_id = tagId;
        meta.tag_id = tagId;
      }
      if (tg.tag_name != null) meta.tag_name = tg.tag_name;
    }

    const bl = snap.card_blocker;
    if (bl && typeof bl === "object") {
      const blockerId = bl.card_blocker_id ?? bl.blocker_id;
      if (blockerId != null) {
        meta.card_blocker_id = blockerId;
        meta.blocker_id = blockerId;
      }
      if (bl.blocker_name != null) meta.blocker_name = bl.blocker_name;
      if (bl.color_code != null) meta.blocker_color_code = bl.color_code;
      if (bl.icon_name != null) meta.blocker_icon_name = bl.icon_name;
    }

    const st = snap.card_sticker;
    if (st && typeof st === "object") {
      const stickerId = st.card_sticker_id ?? st.sticker_id;
      if (stickerId != null) {
        meta.card_sticker_id = stickerId;
        meta.sticker_id = stickerId;
      }
      if (st.sticker_name != null) meta.sticker_name = st.sticker_name;
      if (st.color_code != null) meta.sticker_color_code = st.color_code;
      if (st.icon_name != null) meta.sticker_icon_name = st.icon_name;
    }

    return Object.keys(meta).length ? meta : null;
  }, [callDetailSnapshot]);

  // Card passed to the TopBar: card management metadata from the call detail
  // seeds the selection, while live card values (e.g. after a picker edit) win.
  const topbarCard = useMemo(() => {
    if (!cardMetaFromSnapshot) return card;
    return { ...cardMetaFromSnapshot, ...card };
  }, [card, cardMetaFromSnapshot]);

  // Husbandry Call (call_type_id === "4") has no Operation stage.
  const isHusbandryCall = String(formValues.call_type_id ?? "") === "4";

  // For export calls, the "Operation" tab stays visible but disabled until
  // export approval has fully completed (backend sets export_approval_status
  // to 1 on get_call_detail once approved).
  const isExportApprovalCompleted =
    String(callDetailSnapshot?.export_approval_status ?? "") === "1";
  const lockOperationForExport = showExportTabs && !isExportApprovalCompleted;

  const TOP_TABS = useMemo(() => {
    const base = isDAModule ? DA_TOP_TABS : (isSimplifiedMode ? SIMPLIFIED_TOP_TABS : ALL_TOP_TABS);
    const withDAOnly = (isDAVariant || isDABoard) && !isDAModule && !isSimplifiedMode ? [...base, DA_ONLY_TAB] : base;
    const withExport = showExportTabs && !isDAModule && !isSimplifiedMode
      ? withExportTabs(withDAOnly)
      : withDAOnly;
    return isHusbandryCall ? withExport.filter((tab) => tab !== "Operation") : withExport;
  }, [isDAModule, isSimplifiedMode, isDAVariant, isDABoard, showExportTabs, isHusbandryCall]);

  const ENABLED_TABS = useMemo(() => {
    const base = isDAModule ? DA_ENABLED_TABS : (isSimplifiedMode ? SIMPLIFIED_ENABLED_TABS : ALL_ENABLED_TABS);
    const withDAOnly = (isDAVariant || isDABoard) && !isDAModule && !isSimplifiedMode ? [...base, DA_ONLY_TAB] : base;
    const withExport = showExportTabs && !isDAModule && !isSimplifiedMode
      ? withExportTabs(withDAOnly)
      : withDAOnly;
    const withHusbandry = isHusbandryCall ? withExport.filter((tab) => tab !== "Operation") : withExport;
    return lockOperationForExport ? withHusbandry.filter((tab) => tab !== "Operation") : withHusbandry;
  }, [isDAModule, isSimplifiedMode, isDAVariant, isDABoard, showExportTabs, isHusbandryCall, lockOperationForExport]);

  useEffect(() => {
    setActiveTopTab(defaultTab);
  }, [isSimplifiedMode, defaultTab]);

  useEffect(() => {
    if (!showExportTabs && activeTopTab === "Approval") {
      setActiveTopTab(defaultTab);
    }
  }, [showExportTabs, activeTopTab, defaultTab]);

  useEffect(() => {
    if (lockOperationForExport && activeTopTab === "Operation") {
      setActiveTopTab(defaultTab);
    }
  }, [lockOperationForExport, activeTopTab, defaultTab]);

  useEffect(() => {
    if (isHusbandryCall && activeTopTab === "Operation") {
      setActiveTopTab(defaultTab);
    }
  }, [isHusbandryCall, activeTopTab, defaultTab]);

  const handleChange = useCallback(
    (field) => (e) => {
      // Handle both regular input events and React Quill synthetic events
      // React Quill passes synthetic events with e.target.value
      const value = e?.target?.value !== undefined ? e.target.value : e;
      setFormValues((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const [salesOrderApiLoading, setSalesOrderApiLoading] = useState(false);
  const [salesOrderApiError, setSalesOrderApiError] = useState(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isTitleSaving, setIsTitleSaving] = useState(false);
  const isClosingRef = useRef(false);
  const lastSalesOrderFetchKeyRef = useRef(null);

  useEffect(() => {
    if (!show) {
      lastSalesOrderFetchKeyRef.current = null;
      return;
    }
    if (activeTopTab !== "Sales Order") return;

    const callIdRaw = card?.call_id ?? card?.callId;
    const callId = callIdRaw === undefined || callIdRaw === null ? "" : String(callIdRaw).trim();
    if (!callId) {
      setSalesOrderApiError("No call identifier available for this card.");
      setSalesOrderApiLoading(false);
      return;
    }

    const key = `${card?.id ?? ""}:${callId}`;
    if (lastSalesOrderFetchKeyRef.current === key) return;

    let cancelled = false;
    setSalesOrderApiLoading(true);
    setSalesOrderApiError(null);

    salesOrderService
      .getSoItemsByCall(callId)
      .then((response) => {
        if (cancelled) return;
        const body = response?.data;
        if (body?.status !== "success" || !body?.data) {
          setSalesOrderApiError(
            typeof body?.message === "string" && body.message.trim()
              ? body.message
              : "Unable to load sales order data."
          );
          setFormValues((prev) => ({
            ...prev,
            salesOrderList: [],
          }));
          return;
        }
        lastSalesOrderFetchKeyRef.current = key;
        const mapped = mapSalesOrderResponse(body.data);
        setFormValues((prev) => ({ ...prev, ...mapped }));
      })
      .catch((err) => {
        if (cancelled) return;
        const msg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Failed to load sales order.";
        setSalesOrderApiError(typeof msg === "string" ? msg : "Failed to load sales order.");
        setFormValues((prev) => ({
          ...prev,
          salesOrderList: [],
        }));
      })
      .finally(() => {
        if (!cancelled) setSalesOrderApiLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [show, activeTopTab, card?.call_id, card?.callId, card?.id]);

  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const groCardViewRef = useRef(null);

  useEffect(() => {
    if (show && isAddMode) setHasSubmitted(false);
  }, [show, isAddMode]);

  // Lock background scroll while the modal is open so the board behind it can't
  // be scrolled out from under the fixed overlay.
  useEffect(() => {
    if (!show) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [show]);

  const handleCallFileCreatedSuccess = useCallback(
    async () => {
      notify("Call file created successfully.", "success");
      await onBoardRefresh?.();
      close();
    },
    [close, onBoardRefresh]
  );

  useEffect(() => {
    if (!show) {
      isClosingRef.current = false;
      setIsClosing(false);
    }
  }, [show]);

  const validateGroCardBeforeAction = useCallback(() => {
    if (!isGROVariant || isCustomVariant) return true;
    const message = groCardViewRef.current?.validate?.();
    if (message) {
      notify(message, "warn");
      return false;
    }
    return true;
  }, [isGROVariant, isCustomVariant]);

  const handleUpdate = useCallback(() => {
    if (!validateGroCardBeforeAction()) return;
    // TODO: Add API call to update card
    // NOTE: topbarColor is visual only - never save it to card.color
    // card.color must remain fixed and unchanged
    close();
  }, [close, validateGroCardBeforeAction]);

  const addModeSaveProps = useMemo(
    () =>
      isAddMode
        ? {
          onSave: handleCallFileCreatedSuccess,
          isSavingGeneral,
          hasSubmitted,
          setHasSubmitted,
          setIsSavingGeneral,
        }
        : {
          onSave: undefined,
          isSavingGeneral: false,
          hasSubmitted: false,
          setHasSubmitted: () => { },
          setIsSavingGeneral: () => { },
        },
    [isAddMode, handleCallFileCreatedSuccess, isSavingGeneral, hasSubmitted]
  );

  const handleTopTabChange = useCallback((tab) => {
    setActiveTopTab(tab);
  }, []);

  // api/da/card/{call_id} — DA's own source of truth for the card's current stage
  // (column_name), used below to drive the footer step indicator for DA cards instead
  // of relying solely on the generic board's local column state.
  const [daCardStage, setDaCardStage] = useState(null);
  const [isAdvancingStage, setIsAdvancingStage] = useState(false);
  const isDaCardContext = isDAVariant || isDABoard;
  // Local fallback for reached_date since api/da/update_status doesn't persist it yet
  // (backend gap) — see useDaLocalReachedDates and handleDaTimelineStepClick below.
  const setDaLocalReachedDate = useDaLocalReachedDates((s) => s.setReachedDate);
  // Bumped whenever api/da/advance_stage succeeds (footer stepper or the header sticker
  // picker) so DA.jsx's Summary-tab Status Timeline (a separate fetch of
  // api/da/status_timeline/{call_id}) refetches immediately instead of only on next open.
  const [daStatusRefreshToken, setDaStatusRefreshToken] = useState(0);

  useEffect(() => {
    if (!show || isAddMode || !isDaCardContext) {
      setDaCardStage(null);
      return undefined;
    }
    const callIdRaw = card?.call_id ?? card?.callId;
    const callId = callIdRaw != null ? String(callIdRaw).trim() : "";
    if (!callId) {
      setDaCardStage(null);
      return undefined;
    }

    let cancelled = false;
    daService.getCardStage(callId)
      .then(({ data }) => {
        if (!cancelled) setDaCardStage(data?.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setDaCardStage(null);
      });
    return () => { cancelled = true; };
  }, [show, isAddMode, isDaCardContext, card?.call_id, card?.callId, cardFormSyncKey, daStatusRefreshToken]);

  // DA cards: api/da/card/{call_id}'s current stage carries its own sticker
  // (current_sticker_id / sticker_name) — whenever the Status Timeline round marker or the
  // footer stepper moves the DA to a new stage, daCardStage refetches (see effect above) and
  // this mirrors that stage's sticker onto the header's "Card sticker" picker too, instead of
  // it staying stuck on whatever sticker was last picked manually. color_code/icon_name aren't
  // confirmed on this endpoint, so those fall back to the card's current values rather than
  // being blanked if the backend doesn't send them.
  useEffect(() => {
    if (!isDaCardContext || !daCardStage) return;
    const stickerIdRaw = daCardStage.current_sticker_id ?? daCardStage.sticker_id;
    if (stickerIdRaw == null || String(stickerIdRaw).trim() === "") return;
    const nextId = String(stickerIdRaw).trim();
    const existingId = resolveCardStickerIdFromCard(card);
    if (existingId != null && String(existingId).trim() === nextId) return;
    const cardIdRaw = card?.id ?? card?.card_id;
    if (cardIdRaw == null || String(cardIdRaw).trim() === "") return;
    patchCardSticker?.(String(cardIdRaw).trim(), nextId, {
      name: daCardStage.sticker_name ?? card?.sticker_name,
      color_code: daCardStage.sticker_color_code ?? card?.sticker_color_code,
      icon_name: daCardStage.sticker_icon_name ?? card?.sticker_icon_name,
    });
  }, [isDaCardContext, daCardStage, card, patchCardSticker]);

  const handleClose = useCallback(async () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setIsClosing(true);
    try {
      if (onBoardRefresh) {
        await onBoardRefresh();
      } else {
        await kanbanBoardService.getFullBoard(boardId ?? 1);
      }
    } catch (e) {
    } finally {
      // Backend gap: api/da/advance_stage doesn't yet persist the board's own column, so the
      // refetch above can put a DA card back in its pre-move column. DA's own stage source
      // (daCardStage, from api/da/card/{call_id}) is accurate — use it to correct the
      // just-refetched board position for the card we were viewing before closing.
      if (isDaCardContext && daCardStage?.column_name && card?.id && moveCardToColumn) {
        const targetColumnId = getColumnIdFromStepLabel(daCardStage.column_name, columns, columnOrder);
        if (targetColumnId) moveCardToColumn(card.id, targetColumnId);
      }
      close();
      isClosingRef.current = false;
      setIsClosing(false);
    }
  }, [close, onBoardRefresh, boardId, isDaCardContext, daCardStage, card?.id, moveCardToColumn, columns, columnOrder]);

  // Calculate current step from current column (supports sub-columns when columnOrder from DAdata).
  // For DA cards, prefer the stage reported by api/da/card/{call_id} (column_name) when it
  // matches one of this board's step labels; falls back to the local column lookup otherwise.
  const currentStep = useMemo(() => {
    if (isDaCardContext && daCardStage?.column_name) {
      const stepFromApi = getStepNumberFromColumnTitle(daCardStage.column_name, columns, columnOrder);
      if (stepFromApi) return stepFromApi;
    }
    if (!currentColumn) return null;
    return getStepNumberFromColumnId(currentColumn.id, columns, columnOrder);
  }, [isDaCardContext, daCardStage, currentColumn, columns, columnOrder]);

  const handleStepClick = useCallback((stepLabel, stepNumber) => {
    if (!card?.id) return;
    if (!validateGroCardBeforeAction()) return;

    // Allow jumping to any step directly; only block clicking the current step itself
    if (currentStep !== null && stepNumber === currentStep) {
      return;
    }

    const targetColumnId = getColumnIdFromStepLabel(stepLabel, columns, columnOrder);
    if (!targetColumnId) return;

    // DA cards persist via api/da/advance_stage; other boards still move locally only
    // (no generic "move card" endpoint exists elsewhere in the app today).
    if (isDaCardContext) {
      const callIdRaw = card?.call_id ?? card?.callId;
      const callId = callIdRaw != null ? String(callIdRaw).trim() : "";
      if (!callId || isAdvancingStage) return;

      setIsAdvancingStage(true);
      daService.advanceStage({ call_id: callId, column_id: targetColumnId })
        .then(({ data }) => {
          if (data?.status && data?.current_stage) {
            setDaCardStage((prev) => ({ ...prev, ...data.current_stage }));
            setDaStatusRefreshToken((t) => t + 1);
            if (moveCardToColumn) moveCardToColumn(card.id, targetColumnId);
          } else {
            notify(data?.message || "Failed to move card to that stage.", "error");
          }
        })
        .catch((err) => {
          notify(err?.response?.data?.message || "Failed to move card to that stage.", "error");
        })
        .finally(() => setIsAdvancingStage(false));
      return;
    }

    if (moveCardToColumn) moveCardToColumn(card.id, targetColumnId);
  }, [moveCardToColumn, card?.id, card?.call_id, card?.callId, columns, columnOrder, currentStep, isDaCardContext, isAdvancingStage, validateGroCardBeforeAction]);

  // Non-GRO: topbar tracks card.color when it changes (visual only).
  useEffect(() => {
    if (!show || isAddMode || isGROStyleView) return;
    if (card?.color) {
      setTopbarColor(card.color);
    }
  }, [show, card?.id, card?.color, isAddMode, isGROStyleView]);

  // GRO / custom clearance task card: default emerald header when opening or switching cards.
  useEffect(() => {
    if (!show || isAddMode || !isGROStyleView) return;
    setTopbarColor(GRO_TASK_HEADER_DEFAULT_HEX);
  }, [show, card?.id, isAddMode, isGROStyleView]);

  // Everything else uses card's unique color
  const accentColor = useMemo(() => card?.color || DEFAULT_ACCENT_COLOR, [card?.color]);

  // Topbar color: add mode → formValues.cardColor (create_call_file). View → POST kanban_card/update_card_color when onBoardRefresh is set, then patch board state (no full refetch).
  const handleTopbarCardTypeChange = useCallback(
    (cardTypeId, meta) => {
      if (isAddMode) {
        setFormValues((prev) => ({
          ...prev,
          card_type_id: cardTypeId,
          type_name: meta.type_name,
          type_color_code: meta.color_code,
          type_icon_name: meta.icon_name,
        }));
        return;
      }
      const cardIdRaw = card?.id ?? card?.card_id;
      if (cardIdRaw == null || String(cardIdRaw).trim() === "") return;
      patchCardType?.(String(cardIdRaw).trim(), cardTypeId, meta);
    },
    [isAddMode, card?.id, card?.card_id, patchCardType]
  );

  const handleTopbarCardTagChange = useCallback(
    (tagId, meta) => {
      if (isAddMode) {
        setFormValues((prev) => ({
          ...prev,
          card_tag_id: tagId,
          tag_id: tagId,
          tag_name: meta.name,
        }));
        return;
      }
      const cardIdRaw = card?.id ?? card?.card_id;
      if (cardIdRaw == null || String(cardIdRaw).trim() === "") return;
      patchCardTag?.(String(cardIdRaw).trim(), tagId, meta);
    },
    [isAddMode, card?.id, card?.card_id, patchCardTag]
  );

  const handleTopbarCardBlockerChange = useCallback(
    (blockerId, meta) => {
      if (isAddMode) {
        setFormValues((prev) => ({
          ...prev,
          card_blocker_id: blockerId,
          blocker_id: blockerId,
          blocker_name: meta.name,
          blocker_color_code: meta.color_code,
          blocker_icon_name: meta.icon_name,
        }));
        return;
      }
      const cardIdRaw = card?.id ?? card?.card_id;
      if (cardIdRaw == null || String(cardIdRaw).trim() === "") return;
      patchCardBlocker?.(String(cardIdRaw).trim(), blockerId, meta);
    },
    [isAddMode, card?.id, card?.card_id, patchCardBlocker]
  );

  const handleTopbarCardStickerChange = useCallback(
    (stickerId, meta) => {
      if (isAddMode) {
        setFormValues((prev) => ({
          ...prev,
          card_sticker_id: stickerId,
          sticker_id: stickerId,
          sticker_name: meta.name,
          sticker_color_code: meta.color_code,
          sticker_icon_name: meta.icon_name,
        }));
        return;
      }
      const cardIdRaw = card?.id ?? card?.card_id;
      if (cardIdRaw == null || String(cardIdRaw).trim() === "") return;
      patchCardSticker?.(String(cardIdRaw).trim(), stickerId, meta);

      // DA cards: a sticker's name matches a board column/status name (e.g. "Ops
      // completed") — picking that sticker means "this stage is done", so it advances
      // the DA to the *next* column in sequence (not to the matching column itself,
      // that's the footer stepper's jump-to-step behavior) via the same
      // api/da/advance_stage call, and bumps the token that makes the Summary tab's
      // Status Timeline refetch immediately.
      if (isDaCardContext) {
        setDaStatusRefreshToken((t) => t + 1);
        const callIdRaw = card?.call_id ?? card?.callId;
        const callId = callIdRaw != null ? String(callIdRaw).trim() : "";
        const targetColumnId = getNextColumnIdAfterStepLabel(meta?.name, columns, columnOrder);
        if (!callId || !targetColumnId || isAdvancingStage) return;

        setIsAdvancingStage(true);
        daService.advanceStage({ call_id: callId, column_id: targetColumnId })
          .then(({ data }) => {
            if (data?.status && data?.current_stage) {
              setDaCardStage((prev) => ({ ...prev, ...data.current_stage }));
              setDaStatusRefreshToken((t) => t + 1);
              if (moveCardToColumn) moveCardToColumn(card.id, targetColumnId);
            } else {
              notify(data?.message || "Failed to move card to that stage.", "error");
            }
          })
          .catch((err) => {
            notify(err?.response?.data?.message || "Failed to move card to that stage.", "error");
          })
          .finally(() => setIsAdvancingStage(false));
      }
    },
    [isAddMode, card?.id, card?.card_id, card?.call_id, card?.callId, patchCardSticker, isDaCardContext, columns, columnOrder, isAdvancingStage, moveCardToColumn]
  );

  // DA Summary tab's Status Timeline: clicking the "current" step's round marker moves the
  // DA forward to the NEXT step (see nextStep in StatusTimelineSection, DA.jsx — sending the
  // current step's own label is a no-op since it's already that status). api/da/status_timeline
  // is a separate, more granular list than the board's own columns (e.g. "To be sent for SRF"
  // has no matching column), so this always calls api/da/update_status with { call_id,
  // status_name, reached_date } — reached_date is the client's current date/time, stamping
  // when the step was actually marked complete (the timeline row's own display of this value
  // comes straight back from this same field, see reached_date in mapStatusTimelineResponse).
  // When statusName *also* matches one of the board's columns (e.g. "Ops completed"), it
  // additionally calls api/da/advance_stage — same direct-match lookup the footer stepper's
  // jump-to-step uses (see handleStepClick above) — so the card's board column and header
  // sticker (mirrored from daCardStage, see the effect above) move in step with the timeline
  // instead of only the timeline updating.
  const handleDaTimelineStepClick = useCallback(
    (statusName) => {
      if (!isDaCardContext || isAdvancingStage) return;
      const callIdRaw = card?.call_id ?? card?.callId;
      const callId = callIdRaw != null ? String(callIdRaw).trim() : "";
      if (!callId || !statusName) return;

      const reachedDate = formatNowForApi();
      setIsAdvancingStage(true);
      daService.updateStatus({ call_id: callId, status_name: statusName, reached_date: reachedDate })
        .then(({ data }) => {
          if (data && typeof data === "object" && data.status === "error") {
            notify(data?.message || "Failed to move card to that stage.", "error");
            return;
          }
          // Backend doesn't persist reached_date yet — remember it locally so the
          // timeline can still show a completion date/time until that's fixed.
          setDaLocalReachedDate(callId, statusName, reachedDate);
          setDaStatusRefreshToken((t) => t + 1);

          const targetColumnId = getColumnIdFromStepLabel(statusName, columns, columnOrder);
          if (!targetColumnId) return undefined;

          return daService.advanceStage({ call_id: callId, column_id: targetColumnId })
            .then(({ data: advanceData }) => {
              if (advanceData?.status && advanceData?.current_stage) {
                setDaCardStage((prev) => ({ ...prev, ...advanceData.current_stage }));
                setDaStatusRefreshToken((t) => t + 1);
                if (moveCardToColumn) moveCardToColumn(card.id, targetColumnId);

                // Backend gap: advance_stage's current_stage only carries sticker info
                // going forward — reverting (the timeline's "done" round) moves the
                // board column fine but comes back with no current_sticker_id/sticker_id,
                // so the daCardStage mirror effect above has nothing to patch the header
                // "Card sticker" with. Fall back to matching a board sticker by name
                // against the target status label ourselves (same name-match convention
                // handleTopbarCardStickerChange already relies on for forward moves).
                const stageStickerId = advanceData.current_stage.current_sticker_id ?? advanceData.current_stage.sticker_id;
                const cardIdRaw = card?.id ?? card?.card_id;
                if ((stageStickerId == null || String(stageStickerId).trim() === "") && boardId && cardIdRaw != null) {
                  kanbanBoardService.getCardStickersByBoard(boardId)
                    .then(({ data: stickerBody }) => {
                      const list = unwrapListFromApi(stickerBody, ["card_stickers", "stickers"]).map(normalizeBoardCardStickerRow);
                      const match = list.find((s) => normalizeLabelForMatch(s.name) === normalizeLabelForMatch(statusName));
                      if (match?.id) {
                        patchCardSticker?.(String(cardIdRaw).trim(), match.id, {
                          name: match.name,
                          color_code: match.color_code,
                          icon_name: match.iconKey,
                        });
                      }
                    })
                    .catch(() => {});
                }
              }
            });
        })
        .catch((err) => {
          notify(err?.response?.data?.message || "Failed to move card to that stage.", "error");
        })
        .finally(() => setIsAdvancingStage(false));
    },
    [isDaCardContext, card, isAdvancingStage, columns, columnOrder, moveCardToColumn, setDaLocalReachedDate, boardId, patchCardSticker]
  );

  const handleTopbarColorChange = useCallback(
    (newColor) => {
      const normalized = normalizeHexColor(newColor, DEFAULT_ACCENT_COLOR);

      setTopbarColor(normalized);
      if (isAddMode) {
        setFormValues((prev) => ({ ...prev, cardColor: normalized }));
        return;
      }

      if (isGROStyleView) {
        return;
      }

      const cardIdRaw = card?.id ?? card?.card_id;
      if (cardIdRaw == null || String(cardIdRaw).trim() === "") {
        notify("Cannot save card color: missing card id.", "error");
        setTopbarColor(card?.color || DEFAULT_ACCENT_COLOR);
        return;
      }

      const id = String(cardIdRaw).trim();
      const applyLocal = () => patchCardColor?.(id, normalized);

      if (!onBoardRefresh) {
        applyLocal();
        return;
      }

      kanbanBoardService
        .updateCardColor({
          card_id: id,
          card_color: normalized,
        })
        .then((res) => {
          const body = res?.data;
          if (body && typeof body === "object" && body.status === "error") {
            const msg =
              typeof body.message === "string" && body.message.trim()
                ? body.message
                : "Could not update card color.";
            throw new Error(msg);
          }
          applyLocal();
        })
        .catch((err) => {
          setTopbarColor(card?.color || DEFAULT_ACCENT_COLOR);
          const msg =
            err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            "Could not update card color.";
          notify(typeof msg === "string" ? msg : "Could not update card color.", "error");
        });
    },
    [
      isAddMode,
      isGROStyleView,
      card?.id,
      card?.card_id,
      card?.color,
      onBoardRefresh,
      patchCardColor,
    ]
  );

  const handleTopbarTitleCommit = useCallback(
    (newTitle) => {
      if (isAddMode) return;

      const trimmed = String(newTitle ?? "").trim();
      const previousTitle = card?.title || "";

      if (!trimmed) {
        notify("Card title cannot be empty.", "error");
        setFormValues((prev) => ({ ...prev, cardTitle: previousTitle }));
        return;
      }
      if (trimmed === previousTitle.trim()) {
        setFormValues((prev) => ({ ...prev, cardTitle: trimmed }));
        return;
      }

      const cardIdRaw = card?.id ?? card?.card_id;
      if (cardIdRaw == null || String(cardIdRaw).trim() === "") {
        notify("Cannot save card title: missing card id.", "error");
        setFormValues((prev) => ({ ...prev, cardTitle: previousTitle }));
        return;
      }

      const id = String(cardIdRaw).trim();
      setIsTitleSaving(true);
      kanbanBoardService
        .updateCardTitle({ card_id: id, title: trimmed })
        .then((res) => {
          const body = res?.data;
          if (body && typeof body === "object" && body.status === "error") {
            const msg =
              typeof body.message === "string" && body.message.trim()
                ? body.message
                : "Could not update card title.";
            throw new Error(msg);
          }
          patchCardTitle?.(id, trimmed);
          setFormValues((prev) => ({ ...prev, cardTitle: trimmed }));
          notify("Card title updated.", "success");
        })
        .catch((err) => {
          setFormValues((prev) => ({ ...prev, cardTitle: previousTitle }));
          const msg =
            err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            "Could not update card title.";
          notify(typeof msg === "string" ? msg : "Could not update card title.", "error");
        })
        .finally(() => setIsTitleSaving(false));
    },
    [isAddMode, card?.id, card?.card_id, card?.title, patchCardTitle]
  );

  const ownerInitial = useMemo(
    () => formValues.owner?.[0]?.toUpperCase() || "N",
    [formValues.owner]
  );

  if (!show) return null;

  return (
    <div className="cardform-overlay">
      <div className={`cardform-panel ${isAddMode ? 'add-mode' : ''}`}>
        <TopBar
          card={topbarCard}
          topbarColor={topbarColor}
          onClose={handleClose}
          closeLoading={isClosing}
          isAddMode={isAddMode}
          isSubTaskCard={isSubTaskCard}
          onColorChange={handleTopbarColorChange}
          onTitleCommit={handleTopbarTitleCommit}
          titleSaving={isTitleSaving}
          formValues={formValues}
          handleChange={handleChange}
          boardId={boardId}
          onCardTypeChange={handleTopbarCardTypeChange}
          onCardTagChange={handleTopbarCardTagChange}
          onCardBlockerChange={handleTopbarCardBlockerChange}
          onCardStickerChange={handleTopbarCardStickerChange}
        />
        {isSubTaskCard ? (
          <TaskCardDetailView card={card} onClose={handleClose} />
        ) : isTaxiBoatVariant ? (
          <TaxiBoatCardView card={card} userRoleId={userRoleId} />
        ) : isDriverStyleView ? (
          <DriverCardView card={card} variant={effectiveVariant} />
        ) : isMWPVariant ? (
          <MWPCardView card={card} />
        ) : isGROStyleView ? (
          isCustomVariant ? (
            <CustomCardView ref={groCardViewRef} card={card} userRoleId={userRoleId} />
          ) : isCoordinatorTransport ? (
            <CoordinatorTransportCardView cardData={card} cardColor={topbarColor} />
          ) : (
            <GROCardView ref={groCardViewRef} card={card} mode="gro" userRoleId={userRoleId} />
          )
        ) : (
          <>
            {!isAddMode && !isMWPVariant && !isGROStyleView && (
              <TopTabs
                tabs={TOP_TABS}
                activeTab={activeTopTab}
                onTabChange={handleTopTabChange}
                enabledTabs={ENABLED_TABS}
              />
            )}
            {!isMWPVariant &&
              !isGROStyleView &&
              renderTabContent(
                activeTopTab,
                card,
                formValues,
                handleChange,
                ownerInitial,
                isAddMode,
                isSimplifiedMode,
                isDAModule,
                addModeSaveProps,
                salesOrderApiLoading,
                salesOrderApiError,
                refetchCallDetailSnapshot,
                daStatusRefreshToken,
                handleDaTimelineStepClick,
                isAdvancingStage
              )}
          </>
        )}
        {!isAddMode && !isMWPVariant && !isSubTaskCard && (
          <CardFormFooter
            accentColor={accentColor}
            onUpdate={handleUpdate}
            activeStep={currentStep || 1}
            completedSteps={currentStep && currentStep > 1 ? currentStep - 1 : 0}
            activeTab={activeTopTab}
            onStepClick={handleStepClick}
            currentStep={currentStep}
            isSimplifiedMode={isSimplifiedMode}
            isDriverMode={isDriverStyleView}
            isGROMode={isGROStyleView}
            stepLabels={stepLabels}
            totalSteps={totalSteps}
          />
        )}
      </div>
    </div>
  );
}

CardForm.propTypes = {
  show: PropTypes.bool.isRequired,
  close: PropTypes.func.isRequired,
  card: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    code: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    title: PropTypes.string,
    user: PropTypes.string,
    color: PropTypes.string,
    appointmentReceivedDate: PropTypes.string,
    appointmentAcceptanceDate: PropTypes.string,
    lastPort: PropTypes.string,
    etaDate: PropTypes.string,
    etaTime: PropTypes.string,
    customsStart: PropTypes.string,
    clearanceCompletion: PropTypes.string,
    lastMovedDate: PropTypes.string,
    lastMovedTime: PropTypes.string,
  }),
  moveCardToColumn: PropTypes.func,
  columns: PropTypes.object,
  columnOrder: PropTypes.arrayOf(PropTypes.string),
  currentColumn: PropTypes.shape({
    id: PropTypes.string,
    title: PropTypes.string,
    color: PropTypes.string,
    cardIds: PropTypes.array,
  }),
  isAddMode: PropTypes.bool,
  variant: PropTypes.oneOf(["default", "driver", "hotel", "mwp", "gro", "custom", "taxi-boat"]),
  boardId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onBoardRefresh: PropTypes.func,
  patchCardColor: PropTypes.func,
  patchCardTitle: PropTypes.func,
  patchCardType: PropTypes.func,
  patchCardBlocker: PropTypes.func,
  patchCardSticker: PropTypes.func,
  patchCardTag: PropTypes.func,
};

export default CardForm;
