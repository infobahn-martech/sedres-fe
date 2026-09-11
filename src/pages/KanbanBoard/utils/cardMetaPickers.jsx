/* eslint-disable react-refresh/only-export-components */
import PropTypes from "prop-types";
import kanbanBoardService from "../../../services/kanbanBoardService";
import { normalizeHexColor } from "../../../components/SedresColorPicker/sedresColorPickerConstants";
import { mapBackendIconNameToIconKey } from "../../../store/KanbanManagementReducer";
import DynamicIcon from "../../../structure/SideNav/components/DynamicIcon";

// Shared with CardForm.jsx's board-scoped type/tag/blocker/sticker picker (kept as a
// separate copy there — this module exists so add-only flows like TaskCardModal can
// reuse the same board-scoped fetch/normalize logic and popover UI without pulling in
// the rest of CardForm's edit-mode machinery).

export const unwrapListFromApi = (data, arrayKeys) => {
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

export const normalizeMetaPickerRow = (row, { idFields, nameField, defaultName }) => {
  const fields = Array.isArray(idFields) ? idFields : [idFields];
  let idRaw = fields.map((f) => row?.[f]).find((v) => v != null && String(v).trim() !== "");
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

export const contrastIconFg = (bg) => {
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

export const BOARD_META_PICKERS = {
  type: {
    header: "Card type",
    emptyLabel: "types",
    showRowIcon: true,
    listKeys: ["card_types"],
    normalizeRow: (row) =>
      normalizeMetaPickerRow(row, {
        idFields: ["card_type_id", "type_id"],
        nameField: "type_name",
        defaultName: "Unnamed type",
      }),
    fetchByBoard: (boardId) => kanbanBoardService.getCardTypesByBoard(boardId),
    buildMeta: (row) => ({
      type_name: row.name,
      color_code: row.color_code,
      icon_name: row.iconKey,
    }),
    loadError: "Could not load card types.",
  },
  tag: {
    header: "Card tag",
    emptyLabel: "tags",
    showRowIcon: false,
    listKeys: ["card_tags", "tags"],
    normalizeRow: (row) =>
      normalizeMetaPickerRow(row, {
        idFields: ["tag_id", "card_tag_id"],
        nameField: "tag_name",
        defaultName: "Unnamed tag",
      }),
    fetchByBoard: (boardId) => kanbanBoardService.getCardTagsByBoard(boardId),
    buildMeta: (row) => ({
      name: row.name,
      color_code: row.color_code,
      icon_name: row.iconKey,
    }),
    loadError: "Could not load card tags.",
  },
  blocker: {
    header: "Card blocker",
    emptyLabel: "blockers",
    showRowIcon: true,
    listKeys: ["card_blockers", "blockers", "kanban_card_blockers"],
    normalizeRow: (row) =>
      normalizeMetaPickerRow(row, {
        idFields: ["card_blocker_id", "blocker_id", "id"],
        nameField: "blocker_name",
        defaultName: "Unnamed blocker",
      }),
    fetchByBoard: (boardId) => kanbanBoardService.getCardBlockersByBoard(boardId),
    buildMeta: (row) => ({
      name: row.name,
      color_code: row.color_code,
      icon_name: row.iconKey,
    }),
    loadError: "Could not load card blockers.",
  },
  sticker: {
    header: "Card sticker",
    emptyLabel: "stickers",
    showRowIcon: true,
    listKeys: ["card_stickers", "stickers"],
    normalizeRow: (row) =>
      normalizeMetaPickerRow(row, {
        idFields: ["card_sticker_id", "sticker_id", "id"],
        nameField: "sticker_name",
        defaultName: "Unnamed sticker",
      }),
    fetchByBoard: (boardId) => kanbanBoardService.getCardStickersByBoard(boardId),
    buildMeta: (row) => ({
      name: row.name,
      color_code: row.color_code,
      icon_name: row.iconKey,
    }),
    loadError: "Could not load card stickers.",
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

export const CardMetaPickerPopover = ({
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
