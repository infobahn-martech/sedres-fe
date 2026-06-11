import { useState, useMemo, useCallback, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import salesOrderService from "../../../../../../services/salesOrderService";
import kanbanBoardService from "../../../../../../services/kanbanBoardService";
import { mapSalesOrderResponse } from "../../../../../../shared/helpers/mapSalesOrderResponse";
import { useLocation } from "react-router-dom";
import PropTypes from "prop-types";
import { Tag, Layers3, AlertTriangle, Sticker, X as LucideX } from "lucide-react";
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

// Import Tab Components
import { General, Operation, Husbandry, DocumentLibrary, Invoice, SalesOrder, Reports, KPI, Comments, Subtasks, Notes } from "../../../../CardFormTabs";
import { DEFAULT_PRE_ARRIVAL_DOCUMENT_HANDLING } from "../../../../CardFormTabs/tabs/operation/preArrivalDocumentHandling";
import NavTabButton from "../../../../../../components/NavTabButton";
import GROCardView from "../GRO/User/GROCardView";
import CustomCardView from "../Custom/User/CustomCardView";
import MWPCardView from "../MWP/User/MWPCardView";
import DynamicIcon from "../../../../../../structure/SideNav/components/DynamicIcon";
import { mapBackendIconNameToIconKey } from "../../../../../../store/KanbanManagementReducer";

// Simplified view for SubTask cards (isSubTask === true)
function SubTaskCardView({ card, onClose }) {
  const [comments, setComments] = useState("");
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files || []);
    if (dropped.length) setFiles((prev) => [...prev, ...dropped]);
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="cardform-body cardform-body--feed-tab">
      <div className="subtasks-tab">
        <div className="subtasks-tab-layout">
          <section className="subtasks-tab-editor">
            <div className="subtasks-tab-card subtasks-tab-card--editor">
              <div className="subtasks-tab-editor-body">

                <div className="subtasks-tab-field-row">
                  <div className="subtasks-tab-field">
                    <label className="subtasks-tab-label">Task Name</label>
                    <div className="st-readonly-field">{card?.taskName || card?.title || "—"}</div>
                  </div>
                  <div className="subtasks-tab-field st-due-date-field">
                    <label className="subtasks-tab-label">Due Date</label>
                    <div className="st-readonly-field">{card?.dueDate || "—"}</div>
                  </div>
                </div>

                <div className="subtasks-tab-field">
                  <label className="subtasks-tab-label" htmlFor="stv-cf-comments">Comments</label>
                  <textarea
                    id="stv-cf-comments"
                    className="subtasks-tab-textarea"
                    rows={4}
                    placeholder="Add comments..."
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                  />
                </div>

                <div className="subtasks-tab-field">
                  <label className="subtasks-tab-label">Document Upload</label>
                  <div
                    className={`st-upload-zone ${isDragging ? "st-upload-zone--drag" : ""}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                  >
                    <span className="st-upload-text">
                      {files.length > 0
                        ? `${files.length} file${files.length > 1 ? "s" : ""} selected`
                        : <>Drag and drop your files here, or <span className="st-upload-browse">click to browse</span></>}
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="d-none"
                      onChange={(e) => {
                        const selected = Array.from(e.target.files || []);
                        if (selected.length) setFiles((prev) => [...prev, ...selected]);
                        e.target.value = "";
                      }}
                    />
                  </div>
                  {files.length > 0 && (
                    <div className="st-file-chips">
                      {files.map((f, i) => (
                        <span key={i} className="st-file-chip">
                          {f.name}
                          <button type="button" className="st-upload-clear" onClick={() => removeFile(i)}>
                            <LucideX size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="st-inline-actions">
                  <button type="button" className="st-inline-save" onClick={onClose}>Submit</button>
                </div>

              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// Constants - All tabs
const ALL_TOP_TABS = [
  "Appointment Details",
  "Operation",
  "Husbandry",
  "Sales Order",
  "Reports",
  "KPI",
  "Document Library",
  "Comments",
  "Subtasks",
  "Notes",
];

const ALL_ENABLED_TABS = ["Appointment Details", "Operation", "Husbandry", "Sales Order", "Reports", "KPI", "Document Library", "Comments", "Subtasks", "Notes"];

// Constants - Simplified tabs for kanban-board/{id} routes
const SIMPLIFIED_TOP_TABS = [
  "General",
  "Sales Order",
  "Invoice",
  "Comments",
  "Subtasks",
  "Notes",
];

const SIMPLIFIED_ENABLED_TABS = ["General", "Invoice", "Sales Order", "Comments", "Subtasks", "Notes"];

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

// Helper function to map step label to column ID (column.id for moveCardToColumn)
const getColumnIdFromStepLabel = (stepLabel, columns, columnOrder) => {
  if (!columns) return null;

  // When columnOrder is provided (e.g. from DAdata), resolve by title in order
  if (columnOrder && Array.isArray(columnOrder)) {
    const colId = columnOrder.find((id) => columns[id]?.title === stepLabel);
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

const normalizeMetaPickerRow = (row, { idFields, nameField, defaultName }) => {
  const fields = Array.isArray(idFields) ? idFields : [idFields];
  const idRaw = fields.map((f) => row?.[f]).find((v) => v != null && String(v).trim() !== "");
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
    loadError: "Could not load card types.",
    updateError: "Could not update card type.",
    successMsg: "Card type updated.",
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
    buildMeta: (row) => ({
      name: row.name,
      color_code: row.color_code,
      icon_name: row.iconKey,
    }),
    loadError: "Could not load card tags.",
    updateError: "Could not update card tag.",
    successMsg: "Card tag updated.",
  },
  blocker: {
    header: "Card blocker",
    emptyLabel: "blockers",
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
    loadError: "Could not load card blockers.",
    updateError: "Could not update card blocker.",
    successMsg: "Card blocker updated.",
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
    loadError: "Could not load card stickers.",
    updateError: "Could not update card sticker.",
    successMsg: "Card sticker updated.",
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
}) => (
  <div
    ref={wrapRef}
    className="cardform-type-picker-popover"
    style={floaterStyle}
    role="listbox"
    aria-label={header}
  >
    <div className="cardform-type-picker-header">{header}</div>
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
};

// Sub-components
const TopBar = ({
  card,
  topbarColor,
  onClose,
  isAddMode = false,
  isSubTaskCard = false,
  onColorChange,
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

  const handleTitleChange = (e) => {
    if (handleChange) {
      handleChange("cardTitle")(e);
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
        {!isAddMode && !isSubTaskCard && <span className="cardform-id">ID : {cardId}</span>}
        {isAddMode ? (
          <input
            type="text"
            className="cardform-title-input"
            placeholder="Enter card title"
            value={formValues?.cardTitle || ""}
            onChange={handleTitleChange}
            autoFocus
          />
        ) : (
          <span className="cardform-title">{cardTitle}</span>
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
        <button className="cardform-close-btn" onClick={onClose} type="button" aria-label="Close">
          ✕
        </button>
      </div>
    </div>
  );
};

TopBar.propTypes = {
  card: PropTypes.object,
  topbarColor: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  isAddMode: PropTypes.bool,
  onColorChange: PropTypes.func,
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
            className={`tab ${!isEnabled ? "disabled" : ""}`}
            active={tab === activeTab}
            locked={isEnabled && tab === activeTab}
            onClick={() => onTabChange(tab)}
            disabled={!isEnabled}
          >
            {tab}
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

        // Determine if this step is clickable (only adjacent steps, not the current step itself)
        const isAdjacent = currentStep !== null && Math.abs(stepNumber - currentStep) === 1;
        const isClickable = onStepClick && currentStep !== null && isAdjacent && stepNumber !== currentStep;
        const isDisabled = onStepClick && currentStep !== null && !isAdjacent && stepNumber !== currentStep;

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
  const showSteps = isGROMode || isDriverMode || (!isSimplifiedMode && activeTab !== "Appointment Details") || (isSimplifiedMode && activeTab !== "General");
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
  salesOrderApiError = null
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
  patchCardType,
  patchCardBlocker,
  patchCardSticker,
  patchCardTag,
}) {
  const userProfile = useAuthReducer((state) => state.userProfile);
  const userRoleId = getFirstUserRoleId(userProfile);
  const effectiveVariant = (() => {
    if (isGROSupervisorRole(userRoleId) || isGROSupervisorRole(Number(userRoleId))) {
      return "gro";
    }
    if (
      isCustomClearanceSupervisorRole(userRoleId) ||
      isCustomClearanceSupervisorRole(Number(userRoleId))
    ) {
      return "custom";
    }
    return variant;
  })();

  const location = useLocation();
  const isDriverVariant = effectiveVariant === "driver";
  const isHotelVariant = effectiveVariant === "hotel";
  const isMWPVariant = effectiveVariant === "mwp";
  const isGROVariant = effectiveVariant === "gro";
  const isCustomVariant = effectiveVariant === "custom";
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


  const TOP_TABS = isDAModule ? DA_TOP_TABS : (isSimplifiedMode ? SIMPLIFIED_TOP_TABS : ALL_TOP_TABS);
  const ENABLED_TABS = isDAModule ? DA_ENABLED_TABS : (isSimplifiedMode ? SIMPLIFIED_ENABLED_TABS : ALL_ENABLED_TABS);
  const defaultTab = isDAModule ? "General" : (isSimplifiedMode ? "General" : "Appointment Details");

  const [activeTopTab, setActiveTopTab] = useState(defaultTab)
  const [activeGroExtraTab, setActiveGroExtraTab] = useState("Comments");

  // Reset active tab when mode changes
  useEffect(() => {
    setActiveTopTab(defaultTab);
  }, [isSimplifiedMode, defaultTab]);

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
      typeOfCall: String(card?.call_type_id ?? card?.typeOfCall ?? ""),
      mainBillingEntity: String(card?.main_billing_entity_id ?? card?.mainBillingEntity ?? ""),
      // Appointment Details
      appointmentReceivedDate: card?.appointmentReceivedDate || "",
      appointmentReceivedTime: card?.appointmentReceivedTime || "",
      appointmentAcceptanceDate: card?.appointmentAcceptanceDate || "",
      // Vessel Information
      port: String(card?.port_id ?? card?.port ?? ""),
      vesselType: String(card?.vessel_type_id ?? card?.vesselType ?? ""),
      bargeType: String(card?.barge_type_id ?? card?.bargeType ?? ""),
      vesselName: card?.vesselName || "",
      vesselOwner: card?.vesselOwner || "",
      vesselPrincipal: card?.vesselPrincipal || "",
      vesselManager: card?.vesselManager || "",
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

  const handleCallFileCreatedSuccess = useCallback(
    async () => {
      notify("Call file created successfully.", "success");
      await onBoardRefresh?.();
      close();
    },
    [close, onBoardRefresh]
  );

  const handleClose = useCallback(async () => {
    try {
      if (onBoardRefresh) {
        await onBoardRefresh();
      } else {
        await kanbanBoardService.getFullBoard(boardId ?? 1);
      }
    } catch (e) {
      if (typeof console !== "undefined" && console.error) {
        console.error("[CardForm] getFullBoard on close failed:", e?.message ?? e);
      }
    }
    close();
  }, [close, onBoardRefresh, boardId]);

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

  // Calculate current step from current column (supports sub-columns when columnOrder from DAdata)
  const currentStep = useMemo(() => {
    if (!currentColumn) return null;
    return getStepNumberFromColumnId(currentColumn.id, columns, columnOrder);
  }, [currentColumn, columns, columnOrder]);

  const handleStepClick = useCallback((stepLabel, stepNumber) => {
    if (!moveCardToColumn || !card?.id) return;
    if (!validateGroCardBeforeAction()) return;

    // Step-by-step validation: only allow moving to adjacent steps (forward or backward by 1)
    if (currentStep !== null) {
      const stepDifference = Math.abs(stepNumber - currentStep);
      if (stepDifference !== 1 || stepNumber === currentStep) {
        // Not an adjacent step or trying to click current step, don't allow the move
        return;
      }
    }

    const targetColumnId = getColumnIdFromStepLabel(stepLabel, columns, columnOrder);
    if (targetColumnId) {
      moveCardToColumn(card.id, targetColumnId);
    }
  }, [moveCardToColumn, card?.id, columns, columnOrder, currentStep, validateGroCardBeforeAction]);

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
    },
    [isAddMode, card?.id, card?.card_id, patchCardSticker]
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

  const ownerInitial = useMemo(
    () => formValues.owner?.[0]?.toUpperCase() || "N",
    [formValues.owner]
  );

  if (!show) return null;

  return (
    <div className="cardform-overlay">
      <div className={`cardform-panel ${isAddMode ? 'add-mode' : ''}`}>
        <TopBar
          card={card}
          topbarColor={topbarColor}
          onClose={handleClose}
          isAddMode={isAddMode}
          isSubTaskCard={isSubTaskCard}
          onColorChange={handleTopbarColorChange}
          formValues={formValues}
          handleChange={handleChange}
          boardId={boardId}
          onCardTypeChange={handleTopbarCardTypeChange}
          onCardTagChange={handleTopbarCardTagChange}
          onCardBlockerChange={handleTopbarCardBlockerChange}
          onCardStickerChange={handleTopbarCardStickerChange}
        />
        {isSubTaskCard ? (
          <SubTaskCardView card={card} onClose={handleClose} />
        ) : isDriverStyleView ? (
          <DriverCardView card={card} variant={effectiveVariant} />
        ) : isMWPVariant ? (
          <MWPCardView card={card} />
        ) : isGROStyleView ? (
          <>
            {isCustomVariant ? (
              <CustomCardView ref={groCardViewRef} card={card} userRoleId={userRoleId} />
            ) : (
              <GROCardView ref={groCardViewRef} card={card} mode="gro" userRoleId={userRoleId} />
            )}
            <div className="cardform-tabs">
              {["Comments", "Subtasks", "Notes"].map((tab) => (
                <NavTabButton
                  key={tab}
                  className="tab"
                  active={activeGroExtraTab === tab}
                  locked={activeGroExtraTab === tab}
                  onClick={() => setActiveGroExtraTab(tab)}
                >
                  {tab}
                </NavTabButton>
              ))}
            </div>
            {renderTabContent(
              activeGroExtraTab,
              card,
              formValues,
              handleChange,
              ownerInitial,
              false,
              false,
              false,
              addModeSaveProps,
              salesOrderApiLoading,
              salesOrderApiError
            )}
          </>
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
                salesOrderApiError
              )}
          </>
        )}
        {!isAddMode && !isMWPVariant && (
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
  variant: PropTypes.oneOf(["default", "driver", "hotel", "mwp", "gro", "custom"]),
  boardId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onBoardRefresh: PropTypes.func,
  patchCardColor: PropTypes.func,
  patchCardType: PropTypes.func,
  patchCardBlocker: PropTypes.func,
  patchCardSticker: PropTypes.func,
  patchCardTag: PropTypes.func,
};

export default CardForm;
