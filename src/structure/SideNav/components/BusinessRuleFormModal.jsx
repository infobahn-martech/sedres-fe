import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiPlus, FiChevronDown, FiChevronUp, FiTrash2, FiFilter, FiUsers, FiInfo, FiCalendar, FiDownload, FiMaximize2, FiShare2, FiCheck, FiFile } from 'react-icons/fi';
import { LuTriangle } from 'react-icons/lu';
import { Modal } from 'react-bootstrap';
import PropTypes from 'prop-types';
import ReactQuill, { Quill } from 'react-quill-new';
import QuillTableBetter from 'quill-table-better';
import 'react-quill-new/dist/quill.snow.css';
import 'quill-table-better/dist/quill-table-better.css';
import {
  THEN_ACTION_SECTIONS, ACTION_GROUP_TYPE_TO_SECTION_ID, CREATE_ACTION_OPTIONS, COPY_CARD_DETAIL_REGULAR_FIELDS, SIZE_OPTIONS, DUMMY_CREATE_ACTION_TEMPLATES, LINK_ACTION_OPTIONS, LINK_REMOVE_OTHERS_OPTIONS, MOVE_ACTION_OPTIONS, CONVERT_SUBTASK_ACTION_OPTIONS, NOTIFY_ACTION_OPTIONS, UPDATE_ACTION_OPTIONS, STICKER_ACTION_FREQUENCY_OPTIONS,
  LIST_UPDATE_MODE_OPTIONS, DEADLINE_MODE_OPTIONS, WHEN_DEADLINE_COMPARISON_OPTIONS, WEEKDAY_OPTIONS, PRIORITY_OPTIONS, CREATE_CARD_SIZE_OPTIONS, classifyCustomFieldUiKind,
  INVOKE_ACTION_OPTIONS, DUMMY_INVOKE_METHOD_OPTIONS, DUMMY_INVOKE_AUTH_OPTIONS, INVOKE_METHODS_WITH_BODY, DUMMY_URL_FIELD_OPTIONS,
  DUMMY_REGULAR_FIELDS, DUMMY_TIME_UNITS, DUMMY_CUSTOM_FIELDS,
  DUMMY_WORKSPACE_BOARDS,
  DUMMY_NOTIFICATION_FROM_EMAIL, DUMMY_INTERNAL_USERS,
  DUMMY_NOTIFICATION_SUBJECT_PARTS, DUMMY_NOTIFICATION_BODY_DELTA_OPS, INTERNAL_USER_ROLE_OPTIONS,
  DUMMY_LINK_ACTION_OPERATORS, DUMMY_FIELD_OPERATORS,
  TRIGGER_CODE_TO_ICON, RELATIONAL_CREATE_ACTION_ORIGIN_LABELS,
} from './businessRulesData';
import { buildBoardMinimapWorkflows } from './boardMinimap.utils';
import { buildCreateBusinessRulePayload, buildUpdateBusinessRulePayload, getUnconfiguredActionLabels, isCreateSubtaskAction, getRelationTypeFromLabel } from './buildBusinessRulePayload';
import ThenGroupRawSummary from './ThenGroupRawSummary';
import DateTimePickerField from '../../../pages/KanbanBoard/CardFormTabs/shared/components/DateTimePickerField';
import DynamicIcon from './DynamicIcon';
import useBusinessRuleReducer from '../../../store/BusinessRuleReducer';
import useWorkSpaceReducer from '../../../store/WorkSpaceReducer';
import useCommonReducer from '../../../store/CommonReducer';
import useKanbanManagementReducer, { isKanbanManagementRowDisabled } from '../../../store/KanbanManagementReducer';
import useAuthReducer from '../../../store/AuthReducer';
import useWorkFlowReducer from '../../../store/WorkFlowReducer';
import workflowService from '../../../services/workflowService';
import { pickForegroundOnSwimlaneBackground } from '../../../pages/EditWorkflows/workflow.utils';
import { getInitials, stripHtmlTags } from '../../../shared/utils/utils';
import DatePickerField from '../../../pages/KanbanBoard/CardFormTabs/shared/components/DatePickerField';
import SedresColorPicker from '../../../components/SedresColorPicker/SedresColorPicker';
import { PRIMARY_PRESET_COLORS, SECONDARY_PRESET_COLORS, normalizeHexColor } from '../../../components/SedresColorPicker/sedresColorPickerConstants';
import toastSuccessIcon from '../../../assets/images/toast-success.svg';

Quill.register({ 'modules/table-better': QuillTableBetter }, true);
QuillTableBetter.register();

// The "Execute at" recurring-schedule action has exactly one section, one dropdown: the
// clock time. There's no backend timezone catalog and no per-rule timezone picker — this
// app's own business runs out of Dubai, so the timezone half of the card is a fixed label.
const EXECUTE_AT_TIMEZONE = 'Asia/Dubai';

// Same gap on the "Execute at" clock time itself — there's no backend list to page
// through, so the picker offers the same on-the-hour options a native time input's
// browser-drawn dropdown would, just styled to match the rest of the picker panels.
const TIME_LIST = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

// Same gap for the WHEN-side recurrence schedule: get_regular_fields returns nothing for
// this trigger type, so the repeat-pattern list is the reference product's own fixed set
// (alphabetical, matching how it's ordered there) instead of a live catalog.
const RECURRENCE_SCHEDULE_OPTIONS = [
  { key: 'advanced_schedule', label: 'Advanced schedule' },
  { key: 'every_day', label: 'Every day' },
  { key: 'every_month', label: 'Every month' },
  { key: 'every_week', label: 'Every week' },
  { key: 'every_workday', label: 'Every workday' },
  { key: 'predefined_interval', label: 'Predefined interval' },
];

// "Update card details" actions that reference actual users rather than a free-text
// value get a user picker (avatar + name, multi-select via AND) instead of the plain
// text input every other field uses. Keyed against UPDATE_ACTION_OPTIONS' dev-fallback
// keys — the live backend's own field_key for these may differ, best-effort until confirmed.
const USER_REFERENCE_UPDATE_KEYS = ['add_co_owners', 'remove_co_owners', 'add_watcher'];

// Same idea as USER_REFERENCE_UPDATE_KEYS, but for the sticker-list update actions —
// picks from the board-management sticker catalog (useKanbanManagementReducer's
// cardStickers) instead of a free-text value.
const STICKER_UPDATE_KEYS = ['add_stickers', 'remove_stickers'];

// Same idea again, for the single-value blocker picker — picks from the board-management
// blocker catalog (useKanbanManagementReducer's cardBlockers).
const BLOCKER_UPDATE_KEYS = ['set_blocker'];

// Same idea again, for the single-value type picker — picks from the board-management
// type catalog (useKanbanManagementReducer's cardTypes).
const TYPE_UPDATE_KEYS = ['set_type'];

// Same idea again, for the single-value owner picker — picks from the same `users` list
// USER_REFERENCE_UPDATE_KEYS already uses, just single-select instead of a repeatable list.
const OWNER_UPDATE_KEYS = ['set_owner'];

// Action keys whose header shows a small "mode" dropdown next to the label (append/replace
// for list fields, relative/absolute for the deadline) — resolved to its option list via
// updateActionModeOptions() below.
const LIST_MODE_UPDATE_KEYS = ['set_milestones', 'set_tags'];
const DEADLINE_UPDATE_KEYS = ['set_deadline'];

// Contrast-aware icon color for a sticker/blocker color swatch — copied from
// StickersModal's identical helper (that file duplicates it too, alongside
// Tags/Types/Blockers modals, rather than sharing one, so this keeps the same
// local-helper convention).
const colorIconSwatchFg = (bg) => {
  if (!bg || typeof bg !== 'string') return '#1a1a1a';
  let r; let g; let b;
  const trimmed = bg.trim();
  if (trimmed.startsWith('#')) {
    const h = trimmed.slice(1);
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    if (full.length < 6) return '#1a1a1a';
    r = parseInt(full.slice(0, 2), 16);
    g = parseInt(full.slice(2, 4), 16);
    b = parseInt(full.slice(4, 6), 16);
  } else {
    const m = trimmed.match(/\d+/g);
    if (!m || m.length < 3) return '#1a1a1a';
    [r, g, b] = m.map(Number);
  }
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#1a1a1a' : '#ffffff';
};

// Turns a saved notification subject string (free text with `{Token}` card-field
// placeholders) into the pill/text part list the THEN-column notify card and the
// notification settings modal's subject box both render. Module-level (not just the
// modal's own copy) so the THEN-column list preview can parse a freshly-fetched
// subject without opening the settings modal first.
const parseSubjectString = (text) => {
  const parts = [];
  const tokenRegex = /\{([^{}]+)\}/g;
  let lastIndex = 0;
  let match = tokenRegex.exec(text);
  while (match) {
    if (match.index > lastIndex) parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    parts.push({ type: 'text', value: '{' }, { type: 'pill', value: match[1] }, { type: 'text', value: '}' });
    lastIndex = match.index + match[0].length;
    match = tokenRegex.exec(text);
  }
  if (lastIndex < text.length) parts.push({ type: 'text', value: text.slice(lastIndex) });
  return parts;
};

// Formats a saved "YYYY-MM-DD HH:MM:00" subtask deadline into a short display label for
// the THEN-column "Create subtask" preview chip (e.g. "20 Jul 2026, 14:00").
const formatDeadlineDisplay = (deadline) => {
  const [datePart, timePart] = String(deadline ?? '').split(' ');
  if (!datePart) return '';
  const date = new Date(`${datePart}T${(timePart || '00:00:00').slice(0, 8)}`);
  if (Number.isNaN(date.getTime())) return datePart;
  const dateLabel = date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  const timeLabel = (timePart ?? '').slice(0, 5);
  return timeLabel && timeLabel !== '00:00' ? `${dateLabel}, ${timeLabel}` : dateLabel;
};

// Shared by the sticker picker (Add/Remove stickers), the blocker picker (Set blocker),
// the type picker (Set type), and the tags picker (Set tags) — all are a color-coded
// catalog item, though only stickers/blockers/types carry an icon (tags are color-only,
// matching TagsModal's own swatch), so iconKey is optional.
const ColorIconSwatch = ({ colorCode, iconKey }) => {
  const hex = normalizeHexColor(colorCode || '#ffffff');
  return (
    <span className="br-color-icon-swatch" style={{ backgroundColor: hex }} aria-hidden>
      {iconKey && <DynamicIcon iconKey={iconKey} size={14} color={colorIconSwatchFg(hex)} />}
    </span>
  );
};

// Custom embed (not inline format) for the "field pill" tokens (e.g. Title, Author) in
// the notification body. An inline format only styles editable text — the characters
// inside are still individually selectable/deletable, so a user could edit "Card URL"
// down to "Card U". An embed is atomic: Quill treats it as a single indivisible unit for
// selection, arrow-key navigation, and backspace/delete, matching how Quill's own
// image/mention-style plugins make chips non-editable.
const QuillEmbedBlot = Quill.import('blots/embed');
class NotificationPillBlot extends QuillEmbedBlot {
  // No remove button — this is an atomic embed, so Quill's own backspace/delete
  // handling already removes it as a whole unit; the value is kept in a data
  // attribute (not just textContent) so it can be read back reliably.
  static create(value) {
    const node = super.create();
    node.setAttribute('contenteditable', 'false');
    node.dataset.fieldValue = value;
    node.appendChild(document.createTextNode(value));

    return node;
  }

  static value(node) {
    return node.dataset.fieldValue ?? node.textContent;
  }
}
NotificationPillBlot.blotName = 'pill';
NotificationPillBlot.tagName = 'span';
NotificationPillBlot.className = 'notification-pill';
Quill.register(NotificationPillBlot, true);
const QuillDelta = Quill.import('delta');

const PROPERTY_DOT_COLORS = [...PRIMARY_PRESET_COLORS, ...SECONDARY_PRESET_COLORS];

const getFieldLabel = (field) =>
  field.field_label ?? field.unit_label ?? field.field_name ?? field.custom_field_name ?? field.unit_name ?? '';

const getPropertyDotColor = (idx) => PROPERTY_DOT_COLORS[idx % PROPERTY_DOT_COLORS.length];

// Any operator whose label reads as a negation ("is not", "does not contain", "not in", ...)
// — matched generically on the word "not" so operators added later (backend-driven, not
// hardcoded here) are still caught without needing a code change.
const isNegativeOperatorLabel = (label) => /\bnot\b/.test((label || '').trim().toLowerCase());

const TOOLBAR_MORE_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>';

// Keeps the Quill toolbar on a single row: instead of the browser's default
// inline-wrap (which pushes overflowing controls onto a second line), controls
// that no longer fit are moved into a "more" (⋮) dropdown appended to the end
// of the toolbar. Operates on the live DOM nodes Quill already bound its click
// handlers to, so moving them (rather than cloning) keeps every control working.
function attachToolbarOverflow(toolbar) {
  const originalGroups = Array.from(toolbar.children);
  if (originalGroups.length === 0) return () => {};

  const moreWrap = document.createElement('span');
  moreWrap.className = 'ql-toolbar-more';

  const moreBtn = document.createElement('button');
  moreBtn.type = 'button';
  moreBtn.className = 'ql-toolbar-more-trigger';
  moreBtn.setAttribute('aria-label', 'More formatting options');
  moreBtn.innerHTML = TOOLBAR_MORE_ICON_SVG;

  const moreMenu = document.createElement('div');
  moreMenu.className = 'ql-toolbar-more-menu';
  moreMenu.hidden = true;

  moreWrap.appendChild(moreBtn);
  moreWrap.appendChild(moreMenu);
  toolbar.appendChild(moreWrap);

  const closeMenu = () => { moreMenu.hidden = true; };
  const toggleMenu = (e) => {
    e.stopPropagation();
    moreMenu.hidden = !moreMenu.hidden;
  };
  moreBtn.addEventListener('click', toggleMenu);

  const onDocMouseDown = (e) => {
    if (moreWrap.contains(e.target)) return;
    closeMenu();
  };
  document.addEventListener('mousedown', onDocMouseDown);

  const sync = () => {
    // Reset: every original group back on the toolbar, in order, before the "more" trigger.
    originalGroups.forEach((group) => toolbar.insertBefore(group, moreWrap));
    moreMenu.replaceChildren();

    const overflowed = [];
    while (toolbar.scrollWidth > toolbar.clientWidth) {
      const lastGroup = moreWrap.previousElementSibling;
      if (!lastGroup || lastGroup === originalGroups[0]) break;
      overflowed.push(lastGroup);
      moreMenu.insertBefore(lastGroup, moreMenu.firstChild);
    }

    moreWrap.style.display = overflowed.length > 0 ? '' : 'none';
    if (overflowed.length === 0) closeMenu();
  };

  const resizeObserver = new ResizeObserver(sync);
  resizeObserver.observe(toolbar);
  sync();

  return () => {
    resizeObserver.disconnect();
    document.removeEventListener('mousedown', onDocMouseDown);
    moreBtn.removeEventListener('click', toggleMenu);
    originalGroups.forEach((group) => toolbar.insertBefore(group, moreWrap));
    moreWrap.remove();
  };
}

// Shared by every picker that scopes custom fields to a trigger type (card property
// match, refine update criteria, ...) so the trigger_type_id filtering logic lives in
// one place instead of being duplicated per modal.
function useCustomFieldsByTrigger({ show, triggerTypeId, boardId, showDisabled, search }) {
  const { customFields, isLoadingCustomFields, getCustomFields } = useBusinessRuleReducer((s) => s);

  // A single effect (instead of a separate "on open" + "on filter change" pair) so
  // toggling the board/disabled/search filters right after opening can't race an
  // in-flight initial fetch and have a stale, unfiltered response win.
  useEffect(() => {
    if (!show) return;
    getCustomFields({ params: { board_ids: boardId || undefined, show_disabled: showDisabled ? 1 : undefined, search: search || undefined, trigger_type_id: triggerTypeId } });
  }, [show, boardId, showDisabled, search, triggerTypeId]);

  // Some backend responses include a per-field `disabled` flag and return
  // enabled+disabled together for show_disabled=1 (needs narrowing here); others
  // scope the response to disabled-only server-side and never send that flag at all.
  // Only narrow when the flag is actually present, so we don't zero out an already
  // correctly-scoped response.
  const hasDisabledFlag = customFields.some((field) => Object.prototype.hasOwnProperty.call(field, 'disabled'));
  const scopedCustomFields = showDisabled && hasDisabledFlag
    ? customFields.filter((field) => Number(field.disabled) === 1)
    : customFields;

  return { customFields: scopedCustomFields, isLoadingCustomFields };
}

// Anchored, workspace-grouped board picker used everywhere a "board is ..." filter
// appears (custom field board filter, "Board is" rule condition, ...) — matches the
// Board Minimap picker's design instead of a plain <select>, which doesn't scale once
// a workspace has more than a handful of boards.
function BoardFilterPicker({ workspaces, value, onChange, wrapClassName, triggerClassName, triggerIconSize, panelClassName, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  // Sample groups appended after the real workspaces so the picker has enough
  // content to test scrolling/layout even with a sparsely-populated backend.
  const displayWorkspaces = [...workspaces, ...DUMMY_WORKSPACE_BOARDS];
  const boards = displayWorkspaces.flatMap((w) => w.boards ?? []);
  const selectedBoard = boards.find((b) => String(b.board_id) === String(value));

  const filterQuery = filterText.trim().toLowerCase();
  const filteredGroups = displayWorkspaces
    .map((w) => {
      const wsMatch = w.workspace_name.toLowerCase().includes(filterQuery);
      const groupBoards = wsMatch
        ? (w.boards ?? [])
        : (w.boards ?? []).filter((b) => b.board_name.toLowerCase().includes(filterQuery));
      return { workspace_id: w.workspace_id, workspace_name: w.workspace_name, boards: groupBoards };
    })
    .filter((g) => g.boards.length > 0);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (panelRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [isOpen]);

  const handlePick = (board) => {
    onChange(board.board_id);
    setIsOpen(false);
    setFilterText('');
  };

  return (
    <div className={`board-minimap-picker-wrap ${wrapClassName || 'br-property-board-picker-wrap'}`}>
      <button
        type="button"
        ref={triggerRef}
        className={triggerClassName || 'board-minimap-board-trigger br-property-board-trigger'}
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{selectedBoard ? selectedBoard.board_name : (placeholder || 'All Boards')}</span>
        <FiChevronDown size={triggerIconSize} aria-hidden />
      </button>

      {isOpen && (
        <div className={`board-minimap-picker-panel ${panelClassName || 'br-property-board-picker-panel'}`} ref={panelRef}>
          <div className="board-minimap-picker-search">
            <FiFilter size={20} className="board-minimap-picker-search-icon" aria-hidden />
            <input
              type="text"
              placeholder="Filter"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              autoFocus
            />
          </div>

          <div className="board-minimap-picker-scroll">
            {filteredGroups.length === 0 ? (
              <div className="br-property-picker-empty">No matches</div>
            ) : (
              filteredGroups.map((ws) => (
                <div key={ws.workspace_id} className="board-minimap-picker-group">
                  <div className="board-minimap-picker-group-head">
                    <FiUsers size={20} aria-hidden />
                    <span>{ws.workspace_name}</span>
                  </div>
                  <div className="board-minimap-picker-grid">
                    {ws.boards.map((board) => (
                      <button
                        type="button"
                        key={`${ws.workspace_id}-${board.board_id}`}
                        className={`board-minimap-picker-tile${String(board.board_id) === String(value) ? ' board-minimap-picker-tile--selected' : ''}`}
                        onClick={() => handlePick(board)}
                      >
                        {board.board_name}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Rendered via portal to document.body so the tooltip can escape the scrollable
// owner list's overflow clipping instead of being cut off mid-content.
function OwnerInfoTooltip({ user }) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, placement: 'top' });
  const triggerRef = useRef(null);

  const updatePosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 8;
    const placeAbove = r.top > 160;
    setCoords({
      top: placeAbove ? r.top - gap : r.bottom + gap,
      left: r.left + r.width / 2,
      placement: placeAbove ? 'top' : 'bottom',
    });
  };

  const handleShow = () => {
    updatePosition();
    setIsVisible(true);
  };
  const handleHide = () => setIsVisible(false);

  return (
    <span
      ref={triggerRef}
      className="br-owner-picker-info"
      tabIndex={0}
      onMouseEnter={handleShow}
      onMouseLeave={handleHide}
      onFocus={handleShow}
      onBlur={handleHide}
    >
      <FiInfo size={14} aria-hidden />
      {isVisible && createPortal(
        <span
          className={`br-owner-picker-tooltip br-owner-picker-tooltip--${coords.placement}`}
          role="tooltip"
          style={{ top: coords.top, left: coords.left }}
        >
          <span className="br-owner-picker-tooltip-line"><strong>Full name:</strong> {user.name}</span>
          {user.email && (
            <span className="br-owner-picker-tooltip-line"><strong>Email:</strong> {user.email}</span>
          )}
          {user.role && (
            <span className="br-owner-picker-tooltip-line"><strong>Role:</strong> {user.role}</span>
          )}
          {(user.port || user.phone) && (
            <>
              <span className="br-owner-picker-tooltip-divider">User attributes</span>
              {user.port && (
                <span className="br-owner-picker-tooltip-line"><strong>Port:</strong> {user.port}</span>
              )}
              {user.phone && (
                <span className="br-owner-picker-tooltip-line"><strong>Phone:</strong> {user.phone}</span>
              )}
            </>
          )}
        </span>,
        document.body
      )}
    </span>
  );
}

function PropertyPill({ pillKey, label, selected, dotColor, disabled, onClick }) {
  return (
    <button
      type="button"
      key={pillKey}
      className={`br-property-pill${selected ? ' br-property-pill--selected' : ''}${disabled ? ' br-property-pill--disabled' : ''}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      {dotColor && <span className="br-property-pill-dot" style={{ backgroundColor: dotColor }} aria-hidden />}
      {label}
    </button>
  );
}

function CardPropertyMatchModal({ show, onClose, onSelect, existingFieldLabels, triggerTypeId, showTimeUnit = true, showCustomFields = true }) {
  const [selectedRegularFields, setSelectedRegularFields] = useState([]);
  const [selectedTimeUnits, setSelectedTimeUnits] = useState([]);
  const [selectedCustomFields, setSelectedCustomFields] = useState([]);
  const [expandedRegularFields, setExpandedRegularFields] = useState(true);
  const [expandedTimeUnit, setExpandedTimeUnit] = useState(true);
  const [expandedCustomFields, setExpandedCustomFields] = useState(true);
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [showDisabled, setShowDisabled] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const {
    regularFields, isLoadingRegularFields, getRegularFields,
    timeUnits, isLoadingTimeUnits, getTimeUnits,
  } = useBusinessRuleReducer((s) => s);

  const { customFields, isLoadingCustomFields } = useCustomFieldsByTrigger({
    show: show && showCustomFields, triggerTypeId, boardId: selectedBoardId, showDisabled, search: debouncedSearch,
  });

  const { workspaces, listAllWorkspaces } = useWorkSpaceReducer((s) => s);

  // Dev-only fallback so the modal can be visually tested without a live backend.
  const displayRegularFields = regularFields.length > 0 ? regularFields : DUMMY_REGULAR_FIELDS;
  const displayTimeUnits = timeUnits.length > 0 ? timeUnits : DUMMY_TIME_UNITS;
  // Only fall back to dummy data in the untouched/no-filter state — once a board,
  // the disabled toggle, or a search term narrows the results, an empty response is a
  // real answer (e.g. "no disabled fields on this board") and must be shown as empty,
  // not masked by an unrelated generic dummy list.
  const isCustomFieldsUnfiltered = !selectedBoardId && !showDisabled && !debouncedSearch;
  const displayCustomFields = customFields.length > 0
    ? customFields
    : (isCustomFieldsUnfiltered ? DUMMY_CUSTOM_FIELDS : []);

  const isFieldUsed = (field) =>
    (existingFieldLabels ?? []).includes(getFieldLabel(field).trim().toLowerCase());

  const filteredCustomFields = displayCustomFields;

  useEffect(() => {
    if (!show) return;
    setSelectedRegularFields([]);
    setSelectedTimeUnits([]);
    setSelectedCustomFields([]);
    setFilterText('');
    setDebouncedSearch('');
    if (workspaces.length === 0) listAllWorkspaces();
  }, [show]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(filterText.trim());
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [filterText]);

  useEffect(() => {
    if (!show) return;
    getRegularFields({ params: { trigger_type_id: triggerTypeId, search: debouncedSearch || undefined } });
  }, [show, debouncedSearch, triggerTypeId]);

  useEffect(() => {
    if (!show || !showTimeUnit) return;
    getTimeUnits({ params: { trigger_type_id: triggerTypeId, search: debouncedSearch || undefined } });
  }, [show, showTimeUnit, debouncedSearch, triggerTypeId]);

  const handleToggleRegularField = (field, key) => {
    setSelectedRegularFields((prev) =>
      prev.some((item) => item.key === key)
        ? prev.filter((item) => item.key !== key)
        : [...prev, { key, field }]
    );
  };

  // Time unit only ever allows a single selection, unlike regular/custom fields —
  // picking one replaces whatever was picked before instead of adding to it.
  const handleToggleTimeUnit = (field, key) => {
    setSelectedTimeUnits((prev) =>
      prev.some((item) => item.key === key) ? [] : [{ key, field }]
    );
  };

  const handleToggleCustomField = (field, key) => {
    setSelectedCustomFields((prev) =>
      prev.some((item) => item.key === key)
        ? prev.filter((item) => item.key !== key)
        : [...prev, { key, field }]
    );
  };

  const handleAdd = () => {
    if (selectedRegularFields.length === 0 && selectedTimeUnits.length === 0 && selectedCustomFields.length === 0) return;
    selectedRegularFields.forEach(({ field }) => onSelect(field, { category_key: 'regular' }));
    selectedTimeUnits.forEach(({ field }) => onSelect(field, { category_key: 'time_unit' }));
    selectedCustomFields.forEach(({ field }) => onSelect(field, { category_key: 'custom' }));
    onClose();
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      className="card-property-match-modal"
      dialogClassName="card-property-match-modal-dialog"
      backdropClassName="card-property-match-modal-backdrop"
      centered
      scrollable
    >
      <div className="card-property-match-modal-shell">
        <header className="card-property-match-modal-header">
          <h2 className="card-property-match-modal-title">Card property match</h2>
          <button
            type="button"
            className="business-rule-form-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <FiX size={20} />
          </button>
        </header>

        <div className="card-property-match-modal-body">
          <input
            type="text"
            className="br-property-filter-input"
            placeholder="Filter"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            autoFocus
          />

          <div className="br-property-section">
            <button
              type="button"
              className="br-property-section-toggle"
              onClick={() => setExpandedRegularFields((v) => !v)}
            >
              <span className="br-property-section-toggle-icon">
                {expandedRegularFields ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
              </span>
              Regular fields
            </button>
            {expandedRegularFields && (
              <div className="br-property-pill-grid">
                {isLoadingRegularFields ? (
                  <div className="br-property-picker-empty">Loading...</div>
                ) : displayRegularFields.length === 0 ? (
                  <div className="br-property-picker-empty">No fields found</div>
                ) : (
                  displayRegularFields.map((field, idx) => {
                    const key = `regular-${field.regular_field_id ?? idx}`;
                    return (
                      <PropertyPill
                        key={key}
                        pillKey={key}
                        label={getFieldLabel(field)}
                        selected={selectedRegularFields.some((item) => item.key === key)}
                        disabled={isFieldUsed(field)}
                        onClick={() => handleToggleRegularField(field, key)}
                      />
                    );
                  })
                )}
              </div>
            )}
          </div>

          {showTimeUnit && (
            <div className="br-property-section">
              <button
                type="button"
                className="br-property-section-toggle"
                onClick={() => setExpandedTimeUnit((v) => !v)}
              >
                <span className="br-property-section-toggle-icon">
                  {expandedTimeUnit ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                </span>
                Time unit
              </button>
              {expandedTimeUnit && (
                <div className="br-property-pill-grid">
                  {isLoadingTimeUnits ? (
                    <div className="br-property-picker-empty">Loading...</div>
                  ) : displayTimeUnits.length === 0 ? (
                    <div className="br-property-picker-empty">No fields found</div>
                  ) : (
                    displayTimeUnits.map((field, idx) => {
                      const key = `time_unit-${field.time_unit_id ?? idx}`;
                      return (
                        <PropertyPill
                          key={key}
                          pillKey={key}
                          label={getFieldLabel(field)}
                          selected={selectedTimeUnits.some((item) => item.key === key)}
                          onClick={() => handleToggleTimeUnit(field, key)}
                        />
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {showCustomFields && (
            <div className="br-property-section">
              <button
                type="button"
                className="br-property-section-toggle"
                onClick={() => setExpandedCustomFields((v) => !v)}
              >
                <span className="br-property-section-toggle-icon">
                  {expandedCustomFields ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                </span>
                Custom fields
              </button>
              {expandedCustomFields && (
                <>
                  <div className="br-property-board-filter">
                    <span className="br-property-board-filter-label">Show fields from board:</span>
                    <div className="br-property-board-filter-row">
                      <BoardFilterPicker
                        workspaces={workspaces ?? []}
                        value={selectedBoardId}
                        onChange={setSelectedBoardId}
                      />
                      <button
                        type="button"
                        className="br-property-board-clear-btn"
                        onClick={() => setSelectedBoardId('')}
                        aria-label="Reset board filter"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <label className="business-rule-form-toggle br-property-disabled-toggle">
                    <input
                      type="checkbox"
                      checked={showDisabled}
                      onChange={(e) => setShowDisabled(e.target.checked)}
                    />
                    <span className="business-rule-form-toggle-track" aria-hidden />
                    <span className="business-rule-form-toggle-label">Show disabled custom fields</span>
                  </label>

                  <div className="br-property-pill-grid">
                    {isLoadingCustomFields ? (
                      <div className="br-property-picker-empty">Loading...</div>
                    ) : filteredCustomFields.length === 0 ? (
                      <div className="br-property-picker-empty">No custom fields found</div>
                    ) : (
                      filteredCustomFields.map((field, idx) => {
                        const key = `custom-${field.custom_field_id ?? idx}`;
                        return (
                          <PropertyPill
                            key={key}
                            pillKey={key}
                            label={getFieldLabel(field)}
                            selected={selectedCustomFields.some((item) => item.key === key)}
                            dotColor={getPropertyDotColor(idx)}
                            disabled={isFieldUsed(field)}
                            onClick={() => handleToggleCustomField(field, key)}
                          />
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <footer className="card-property-match-modal-footer">
          <button
            type="button"
            className="br-property-add-btn"
            disabled={selectedRegularFields.length === 0 && selectedTimeUnits.length === 0 && selectedCustomFields.length === 0}
            onClick={handleAdd}
          >
            Add
          </button>
        </footer>
      </div>
    </Modal>
  );
}

function CreateActionModal({ show, onClose, onSelect, actionTypeId }) {
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [expandedRegularFields, setExpandedRegularFields] = useState(true);
  const [filterText, setFilterText] = useState('');

  const { thenActionRegularFields, isLoadingThenActionFields, getThenActionFields } = useBusinessRuleReducer((s) => s);

  useEffect(() => {
    if (!show) return;
    setSelectedKeys([]);
    setFilterText('');
    if (actionTypeId) getThenActionFields(actionTypeId);
  }, [show, actionTypeId]);

  const mappedOptions = thenActionRegularFields.map((field) => ({ key: field.field_key, label: field.field_label }));
  // Dev-only fallback so the modal can be visually tested without a live backend.
  const createActionOptions = mappedOptions.length > 0 ? mappedOptions : (import.meta.env.DEV ? CREATE_ACTION_OPTIONS : []);

  const filterQuery = filterText.trim().toLowerCase();
  const filteredOptions = filterQuery
    ? createActionOptions.filter((opt) => opt.label.toLowerCase().includes(filterQuery))
    : createActionOptions;

  const handleToggleOption = (key) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleAdd = () => {
    if (selectedKeys.length === 0) return;
    createActionOptions
      .filter((opt) => selectedKeys.includes(opt.key))
      .forEach((option) => onSelect(option));
    onClose();
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      className="card-property-match-modal"
      dialogClassName="card-property-match-modal-dialog"
      backdropClassName="card-property-match-modal-backdrop"
      centered
      scrollable
    >
      <div className="card-property-match-modal-shell">
        <header className="card-property-match-modal-header">
          <h2 className="card-property-match-modal-title">Create Card or Subtask</h2>
          <button
            type="button"
            className="business-rule-form-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <FiX size={20} />
          </button>
        </header>

        <div className="card-property-match-modal-body">
          <input
            type="text"
            className="br-property-filter-input"
            placeholder="Filter"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            autoFocus
          />

          <div className="br-property-section">
            <button
              type="button"
              className="br-property-section-toggle"
              onClick={() => setExpandedRegularFields((v) => !v)}
            >
              <span className="br-property-section-toggle-icon">
                {expandedRegularFields ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
              </span>
              Regular fields
            </button>
            {expandedRegularFields && (
              <div className="br-property-pill-grid">
                {isLoadingThenActionFields ? (
                  <div className="br-property-picker-empty">Loading...</div>
                ) : filteredOptions.length === 0 ? (
                  <div className="br-property-picker-empty">No fields found</div>
                ) : (
                  filteredOptions.map((option) => (
                    <PropertyPill
                      key={option.key}
                      pillKey={option.key}
                      label={option.label}
                      selected={selectedKeys.includes(option.key)}
                      onClick={() => handleToggleOption(option.key)}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <footer className="card-property-match-modal-footer">
          <button
            type="button"
            className="br-property-add-btn"
            disabled={selectedKeys.length === 0}
            onClick={handleAdd}
          >
            Add
          </button>
        </footer>
      </div>
    </Modal>
  );
}

// Single-select "Select a field" modal for the WHEN column's recurrence schedule pill —
// same shell/pill-grid pattern as CreateActionModal above, but a fixed option list (see
// RECURRENCE_SCHEDULE_OPTIONS) instead of a live field catalog, and one selection
// confirmed via "Change" instead of a multi-select "Add".
function RecurrenceScheduleModal({ show, onClose, value, onSelect }) {
  const [pendingKey, setPendingKey] = useState(value);
  const [expandedRegularFields, setExpandedRegularFields] = useState(true);
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    if (!show) return;
    setPendingKey(value);
    setFilterText('');
  }, [show, value]);

  const filterQuery = filterText.trim().toLowerCase();
  const filteredOptions = filterQuery
    ? RECURRENCE_SCHEDULE_OPTIONS.filter((option) => option.label.toLowerCase().includes(filterQuery))
    : RECURRENCE_SCHEDULE_OPTIONS;

  const handleChange = () => {
    onSelect(pendingKey);
    onClose();
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      className="card-property-match-modal"
      dialogClassName="card-property-match-modal-dialog"
      backdropClassName="card-property-match-modal-backdrop"
      centered
      scrollable
    >
      <div className="card-property-match-modal-shell">
        <header className="card-property-match-modal-header">
          <h2 className="card-property-match-modal-title">Select a field</h2>
          <button
            type="button"
            className="business-rule-form-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <FiX size={20} />
          </button>
        </header>

        <div className="card-property-match-modal-body">
          <input
            type="text"
            className="br-property-filter-input"
            placeholder="Filter"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            autoFocus
          />

          <div className="br-property-section">
            <button
              type="button"
              className="br-property-section-toggle"
              onClick={() => setExpandedRegularFields((v) => !v)}
            >
              <span className="br-property-section-toggle-icon">
                {expandedRegularFields ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
              </span>
              Regular fields
            </button>
            {expandedRegularFields && (
              <div className="br-property-pill-grid">
                {filteredOptions.length === 0 ? (
                  <div className="br-property-picker-empty">No fields found</div>
                ) : (
                  filteredOptions.map((option) => (
                    <PropertyPill
                      key={option.key}
                      pillKey={option.key}
                      label={option.label}
                      selected={pendingKey === option.key}
                      onClick={() => setPendingKey(option.key)}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <footer className="card-property-match-modal-footer">
          <button type="button" className="br-property-add-btn" onClick={handleChange}>
            Change
          </button>
        </footer>
      </div>
    </Modal>
  );
}

function LinkActionModal({ show, onClose, onSelect }) {
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [expandedActions, setExpandedActions] = useState(true);
  const [filterText, setFilterText] = useState('');

  const { linkCardActions, isLoadingLinkCardActions, getLinkCardPossibleActions } = useBusinessRuleReducer((s) => s);

  useEffect(() => {
    if (!show) return;
    setSelectedKeys([]);
    setFilterText('');
    getLinkCardPossibleActions();
  }, [show]);

  const mappedActions = linkCardActions.map((action) => ({
    key: action.relation_key,
    label: action.relation_label,
  }));

  // Dev-only fallback so the modal can be visually tested without a live backend.
  const linkActionOptions = mappedActions.length > 0 ? mappedActions : (import.meta.env.DEV ? LINK_ACTION_OPTIONS : []);

  const filterQuery = filterText.trim().toLowerCase();
  const filteredOptions = filterQuery
    ? linkActionOptions.filter((opt) => opt.label.toLowerCase().includes(filterQuery))
    : linkActionOptions;

  const handleToggleOption = (key) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleAdd = () => {
    if (selectedKeys.length === 0) return;
    linkActionOptions
      .filter((opt) => selectedKeys.includes(opt.key))
      .forEach((option) => onSelect(option));
    onClose();
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      className="card-property-match-modal"
      dialogClassName="card-property-match-modal-dialog"
      backdropClassName="card-property-match-modal-backdrop"
      centered
      scrollable
    >
      <div className="card-property-match-modal-shell">
        <header className="card-property-match-modal-header">
          <h2 className="card-property-match-modal-title">Add new action</h2>
          <button
            type="button"
            className="business-rule-form-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <FiX size={20} />
          </button>
        </header>

        <div className="card-property-match-modal-body">
          <input
            type="text"
            className="br-property-filter-input"
            placeholder="Filter"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            autoFocus
          />

          <div className="br-property-section">
            <button
              type="button"
              className="br-property-section-toggle"
              onClick={() => setExpandedActions((v) => !v)}
            >
              <span className="br-property-section-toggle-icon">
                {expandedActions ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
              </span>
              Possible actions
            </button>
            {expandedActions && (
              <div className="br-property-pill-grid">
                {isLoadingLinkCardActions ? (
                  <div className="br-property-picker-empty">Loading...</div>
                ) : filteredOptions.length === 0 ? (
                  <div className="br-property-picker-empty">No fields found</div>
                ) : (
                  filteredOptions.map((option) => (
                    <PropertyPill
                      key={option.key}
                      pillKey={option.key}
                      label={option.label}
                      selected={selectedKeys.includes(option.key)}
                      onClick={() => handleToggleOption(option.key)}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <footer className="card-property-match-modal-footer">
          <button
            type="button"
            className="br-property-add-btn"
            disabled={selectedKeys.length === 0}
            onClick={handleAdd}
          >
            Add
          </button>
        </footer>
      </div>
    </Modal>
  );
}

function BoardMinimapModal({ show, onClose, onSave, initialBoardId }) {
  const [boardId, setBoardId] = useState('');
  const [isBoardPickerOpen, setIsBoardPickerOpen] = useState(false);
  const [boardFilterText, setBoardFilterText] = useState('');
  const [workspaceFilterId, setWorkspaceFilterId] = useState('');
  const [hoveredLeafColumnId, setHoveredLeafColumnId] = useState(null);
  const [hoveredSwimlaneId, setHoveredSwimlaneId] = useState(null);

  const boardPickerTriggerRef = useRef(null);
  const boardPickerPanelRef = useRef(null);

  const { workspaces, listAllWorkspaces } = useWorkSpaceReducer((s) => s);
  const displayWorkspaces = useMemo(() => workspaces ?? [], [workspaces]);
  const boards = useMemo(
    () => displayWorkspaces.flatMap((w) => (w.boards ?? []).map((b) => ({ ...b, workspace_name: w.workspace_name }))),
    [displayWorkspaces]
  );

  const boardFilterQuery = boardFilterText.trim().toLowerCase();
  const filteredWorkspaceGroups = displayWorkspaces
    .filter((w) => !workspaceFilterId || String(w.workspace_id) === String(workspaceFilterId))
    .map((w) => {
      const wsMatch = w.workspace_name.toLowerCase().includes(boardFilterQuery);
      const groupBoards = wsMatch
        ? (w.boards ?? [])
        : (w.boards ?? []).filter((b) => b.board_name.toLowerCase().includes(boardFilterQuery));
      return { workspace_id: w.workspace_id, workspace_name: w.workspace_name, boards: groupBoards };
    })
    .filter((g) => g.boards.length > 0);

  const selectedBoard = boards.find((b) => String(b.board_id) === String(boardId));

  const handlePickBoard = (board) => {
    setBoardId(board.board_id);
    setIsBoardPickerOpen(false);
    setBoardFilterText('');
  };

  useEffect(() => {
    if (!show) return;
    setBoardId(initialBoardId ?? '');
    setIsBoardPickerOpen(false);
    setBoardFilterText('');
    setWorkspaceFilterId('');
    if (workspaces.length === 0) listAllWorkspaces();
  }, [show]);

  useEffect(() => {
    if (!show || boardId || initialBoardId) return;
    // Falls back to the first board across ALL workspaces, not displayWorkspaces[0] —
    // that index-0 lookup silently no-ops (leaving the trigger stuck on "Select a
    // board") whenever the first workspace in the raw API order happens to have no
    // boards, even though a later workspace (e.g. the first one the dropdown actually
    // shows, since it filters out empty groups) does.
    const firstBoard = boards[0];
    if (firstBoard) setBoardId(firstBoard.board_id);
  }, [show, boardId, initialBoardId, boards]);

  useEffect(() => {
    if (!isBoardPickerOpen) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (boardPickerPanelRef.current?.contains(t)) return;
      if (boardPickerTriggerRef.current?.contains(t)) return;
      setIsBoardPickerOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [isBoardPickerOpen]);

  const { boardStructure, isLoadingBoardStructure, getBoardStructure } = useWorkFlowReducer((s) => s);

  useEffect(() => {
    if (!show || !boardId) return;
    getBoardStructure({ boardId });
  }, [show, boardId]);

  // One block per active workflow on the board — each with its own stage segments
  // (colored, from `stages`), the flattened leaf columns under them, and its own
  // swimlane rows. Workflows can have entirely different stages, so they're never
  // merged into a single shared header.
  const minimapWorkflows = useMemo(
    () => (boardId ? buildBoardMinimapWorkflows(boardStructure) : []),
    [boardId, boardStructure]
  );

  const handlePickCell = (workflow, swimlane, leafColumn) => {
    onSave({
      boardId,
      boardName: selectedBoard?.board_name ?? '',
      workspaceName: selectedBoard?.workspace_name ?? '',
      workflowId: workflow.id,
      workflowName: workflow.name,
      swimlaneId: swimlane.id,
      swimlaneName: swimlane.name,
      stageId: leafColumn.id,
      stageName: leafColumn.name,
    });
    onClose();
  };

  // Column header pick: matches this stage in any swimlane (row left blank).
  const handlePickColumn = (workflow, leafColumn) => {
    onSave({
      boardId,
      boardName: selectedBoard?.board_name ?? '',
      workspaceName: selectedBoard?.workspace_name ?? '',
      workflowId: workflow.id,
      workflowName: workflow.name,
      swimlaneId: '',
      swimlaneName: '',
      stageId: leafColumn.id,
      stageName: leafColumn.name,
    });
    onClose();
  };

  // Row header pick: matches any stage within this swimlane (column left blank).
  const handlePickRow = (workflow, swimlane) => {
    onSave({
      boardId,
      boardName: selectedBoard?.board_name ?? '',
      workspaceName: selectedBoard?.workspace_name ?? '',
      workflowId: workflow.id,
      workflowName: workflow.name,
      swimlaneId: swimlane.id,
      swimlaneName: swimlane.name,
      stageId: '',
      stageName: '',
    });
    onClose();
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      className="card-property-match-modal board-minimap-modal"
      dialogClassName="card-property-match-modal-dialog board-minimap-modal-dialog"
      backdropClassName="card-property-match-modal-backdrop"
      centered
      scrollable
    >
      <div className="card-property-match-modal-shell">
        <header className="card-property-match-modal-header">
          <h2 className="card-property-match-modal-title">Board Minimap</h2>
          <button
            type="button"
            className="business-rule-form-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <FiX size={20} />
          </button>
        </header>

        <div className="card-property-match-modal-body board-minimap-body">
          <div className="board-minimap-picker-wrap">
            <button
              type="button"
              ref={boardPickerTriggerRef}
              className="board-minimap-board-trigger"
              onClick={() => setIsBoardPickerOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={isBoardPickerOpen}
            >
              <span>
                {selectedBoard ? `${selectedBoard.workspace_name} / ${selectedBoard.board_name}` : 'Select a board'}
              </span>
              <FiChevronDown aria-hidden />
            </button>

            {isBoardPickerOpen && (
              <div className="board-minimap-picker-panel" ref={boardPickerPanelRef}>
                <select
                  className="business-rule-form-select board-minimap-picker-workspace-select"
                  value={workspaceFilterId}
                  onChange={(e) => setWorkspaceFilterId(e.target.value)}
                >
                  <option value="">All workspaces</option>
                  {displayWorkspaces.map((w) => (
                    <option key={w.workspace_id} value={w.workspace_id}>{w.workspace_name}</option>
                  ))}
                </select>

                <div className="board-minimap-picker-search">
                  <FiFilter size={20} className="board-minimap-picker-search-icon" aria-hidden />
                  <input
                    type="text"
                    placeholder="Filter"
                    value={boardFilterText}
                    onChange={(e) => setBoardFilterText(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="board-minimap-picker-scroll">
                  {filteredWorkspaceGroups.length === 0 ? (
                    <div className="br-property-picker-empty">No matches</div>
                  ) : (
                    filteredWorkspaceGroups.map((ws) => (
                      <div key={ws.workspace_id} className="board-minimap-picker-group">
                        <div className="board-minimap-picker-group-head">
                          <FiUsers size={20} aria-hidden />
                          <span>{ws.workspace_name}</span>
                        </div>
                        <div className="board-minimap-picker-grid">
                          {ws.boards.map((board) => (
                            <button
                              type="button"
                              key={board.board_id}
                              className={`board-minimap-picker-tile${String(board.board_id) === String(boardId) ? ' board-minimap-picker-tile--selected' : ''}`}
                              onClick={() => handlePickBoard(board)}
                            >
                              <span className="board-minimap-picker-tile-name">{board.board_name}</span>
                              <span className="board-minimap-picker-tile-count">{(board.total_cards ?? 0).toLocaleString()}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {!boardId ? (
            <div className="br-property-picker-empty">Select a board to view its structure</div>
          ) : isLoadingBoardStructure ? (
            <div className="br-property-picker-empty">Loading board structure…</div>
          ) : minimapWorkflows.length === 0 ? (
            <div className="br-property-picker-empty">No active workflow found for this board</div>
          ) : (
            <div className="board-minimap-workflows">
              {minimapWorkflows.map((workflow) => (
                <div key={workflow.id} className="board-minimap-grid">
                  <div className="board-minimap-title-bar">{workflow.name}</div>

                  <div className="board-minimap-area-row">
                    {workflow.stageSegments.map((segment) => (
                      <div
                        key={`${workflow.id}-${segment.id}`}
                        className="board-minimap-area-cell"
                        style={{ flexGrow: segment.columns.length, backgroundColor: segment.color }}
                        title={segment.name}
                      >
                        {segment.name}
                      </div>
                    ))}
                  </div>

                  <div className="board-minimap-header-grid">
                    {workflow.leafColumns.map((column) => (
                      <div
                        key={`${workflow.id}-${column.id}`}
                        className="board-minimap-header-cell"
                        role="button"
                        tabIndex={0}
                        onMouseEnter={() => setHoveredLeafColumnId(column.id)}
                        onMouseLeave={() => setHoveredLeafColumnId(null)}
                        onClick={() => handlePickColumn(workflow, column)}
                      >
                        {column.name}
                      </div>
                    ))}
                  </div>

                  {workflow.swimlanes.map((swimlane) => (
                    <div key={`${workflow.id}-${swimlane.id}`} className="board-minimap-lane-row">
                      <div
                        className="board-minimap-lane-label"
                        style={swimlane.colorCode
                          ? { backgroundColor: swimlane.colorCode, color: pickForegroundOnSwimlaneBackground(swimlane.colorCode) }
                          : undefined}
                        role="button"
                        tabIndex={0}
                        onMouseEnter={() => setHoveredSwimlaneId(swimlane.id)}
                        onMouseLeave={() => setHoveredSwimlaneId(null)}
                        onClick={() => handlePickRow(workflow, swimlane)}
                      >
                        {swimlane.name}
                      </div>
                      <div className="board-minimap-lane-cells">
                        {workflow.leafColumns.map((column) => (
                          <button
                            type="button"
                            key={`${workflow.id}-${swimlane.id}-${column.id}`}
                            className={`board-minimap-cell${hoveredLeafColumnId === column.id ? ' board-minimap-cell--col-active' : ''}${hoveredSwimlaneId === swimlane.id ? ' board-minimap-cell--row-active' : ''}`}
                            onMouseEnter={() => setHoveredLeafColumnId(column.id)}
                            onMouseLeave={() => setHoveredLeafColumnId(null)}
                            onClick={() => handlePickCell(workflow, swimlane, column)}
                            aria-label={`Move to ${workflow.name}, ${swimlane.name}, ${column.name}`}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function RefineUpdateCriteriaModal({ show, onClose, onSelect, existingFieldLabels, existingActionKeys, triggerTypeId, actionTypeId }) {
  const [selectedActions, setSelectedActions] = useState([]);
  const [selectedCustomFields, setSelectedCustomFields] = useState([]);
  const [expandedRegularFields, setExpandedRegularFields] = useState(true);
  const [expandedCustomFields, setExpandedCustomFields] = useState(true);
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [showDisabled, setShowDisabled] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const { customFields, isLoadingCustomFields } = useCustomFieldsByTrigger({
    show, triggerTypeId, boardId: selectedBoardId, showDisabled, search: debouncedSearch,
  });
  const { thenActionRegularFields, isLoadingThenActionFields, getThenActionFields } = useBusinessRuleReducer((s) => s);
  const { workspaces, listAllWorkspaces } = useWorkSpaceReducer((s) => s);

  // Only fall back to dummy data in the untouched/no-filter state — once a board,
  // the disabled toggle, or a search term narrows the results, an empty response is a
  // real answer (e.g. "no disabled fields on this board") and must be shown as empty,
  // not masked by an unrelated generic dummy list.
  const isCustomFieldsUnfiltered = !selectedBoardId && !showDisabled && !debouncedSearch;
  const displayCustomFields = customFields.length > 0
    ? customFields
    : (isCustomFieldsUnfiltered ? DUMMY_CUSTOM_FIELDS : []);

  const isFieldUsed = (field) =>
    (existingFieldLabels ?? []).includes(getFieldLabel(field).trim().toLowerCase());

  const mappedRegularOptions = thenActionRegularFields.map((field) => ({ key: field.field_key, label: field.field_label, field: field.field_label }));
  // Dev-only fallback so the modal can be visually tested without a live backend.
  const updateActionOptions = mappedRegularOptions.length > 0 ? mappedRegularOptions : (import.meta.env.DEV ? UPDATE_ACTION_OPTIONS : []);

  const filterQuery = filterText.trim().toLowerCase();
  const filteredRegularOptions = filterQuery
    ? updateActionOptions.filter((opt) => opt.label.toLowerCase().includes(filterQuery))
    : updateActionOptions;
  const filteredCustomFields = displayCustomFields;

  useEffect(() => {
    if (!show) return;
    if (actionTypeId) getThenActionFields(actionTypeId);
    setSelectedActions([]);
    setSelectedCustomFields([]);
    setFilterText('');
    setDebouncedSearch('');
    if (workspaces.length === 0) listAllWorkspaces();
  }, [show, actionTypeId]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(filterText.trim());
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [filterText]);

  const handlePickAction = (option) => {
    const key = `action-${option.key}`;
    setSelectedActions((prev) =>
      prev.some((item) => item.key === key)
        ? prev.filter((item) => item.key !== key)
        : [...prev, { key, item: option }]
    );
  };

  const handlePickCustom = (field, idx) => {
    const key = `custom-${field.custom_field_id ?? idx}`;
    setSelectedCustomFields((prev) =>
      prev.some((item) => item.key === key)
        ? prev.filter((item) => item.key !== key)
        : [...prev, { key, item: field }]
    );
  };

  const handleAdd = () => {
    if (selectedActions.length === 0 && selectedCustomFields.length === 0) return;
    selectedActions.forEach(({ item }) => onSelect(item, { category_key: 'action' }));
    selectedCustomFields.forEach(({ item }) => onSelect(item, { category_key: 'custom' }));
    onClose();
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      className="card-property-match-modal"
      dialogClassName="card-property-match-modal-dialog"
      backdropClassName="card-property-match-modal-backdrop"
      centered
      scrollable
    >
      <div className="card-property-match-modal-shell">
        <header className="card-property-match-modal-header">
          <h2 className="card-property-match-modal-title">Refine Update Criteria</h2>
          <button
            type="button"
            className="business-rule-form-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <FiX size={20} />
          </button>
        </header>

        <div className="card-property-match-modal-body">
          <input
            type="text"
            className="br-property-filter-input"
            placeholder="Filter"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            autoFocus
          />

          <div className="br-property-section">
            <button
              type="button"
              className="br-property-section-toggle"
              onClick={() => setExpandedRegularFields((v) => !v)}
            >
              <span className="br-property-section-toggle-icon">
                {expandedRegularFields ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
              </span>
              Regular fields
            </button>
            {expandedRegularFields && (
              <div className="br-property-pill-grid">
                {isLoadingThenActionFields ? (
                  <div className="br-property-picker-empty">Loading...</div>
                ) : filteredRegularOptions.length === 0 ? (
                  <div className="br-property-picker-empty">No fields found</div>
                ) : (
                  filteredRegularOptions.map((option) => (
                    <PropertyPill
                      key={option.key}
                      pillKey={option.key}
                      label={option.label}
                      selected={selectedActions.some((item) => item.key === `action-${option.key}`)}
                      disabled={(existingActionKeys ?? []).includes(option.key)}
                      onClick={() => handlePickAction(option)}
                    />
                  ))
                )}
              </div>
            )}
          </div>

          <div className="br-property-section">
            <button
              type="button"
              className="br-property-section-toggle"
              onClick={() => setExpandedCustomFields((v) => !v)}
            >
              <span className="br-property-section-toggle-icon">
                {expandedCustomFields ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
              </span>
              Custom fields
            </button>
            {expandedCustomFields && (
              <>
                <div className="br-property-board-filter">
                  <span className="br-property-board-filter-label">Show fields from board:</span>
                  <div className="br-property-board-filter-row">
                    <BoardFilterPicker
                      workspaces={workspaces ?? []}
                      value={selectedBoardId}
                      onChange={setSelectedBoardId}
                    />
                    <button
                      type="button"
                      className="br-property-board-clear-btn"
                      onClick={() => setSelectedBoardId('')}
                      aria-label="Reset board filter"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </div>

                <label className="business-rule-form-toggle br-property-disabled-toggle">
                  <input
                    type="checkbox"
                    checked={showDisabled}
                    onChange={(e) => setShowDisabled(e.target.checked)}
                  />
                  <span className="business-rule-form-toggle-track" aria-hidden />
                  <span className="business-rule-form-toggle-label">Show disabled custom fields</span>
                </label>

                <div className="br-property-pill-grid">
                  {isLoadingCustomFields ? (
                    <div className="br-property-picker-empty">Loading...</div>
                  ) : filteredCustomFields.length === 0 ? (
                    <div className="br-property-picker-empty">No custom fields found</div>
                  ) : (
                    filteredCustomFields.map((field, idx) => {
                      const key = `custom-${field.custom_field_id ?? idx}`;
                      return (
                        <PropertyPill
                          key={key}
                          pillKey={key}
                          label={getFieldLabel(field)}
                          selected={selectedCustomFields.some((item) => item.key === key)}
                          dotColor={getPropertyDotColor(idx)}
                          disabled={isFieldUsed(field)}
                          onClick={() => handlePickCustom(field, idx)}
                        />
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <footer className="card-property-match-modal-footer">
          <button
            type="button"
            className="br-property-add-btn"
            disabled={selectedActions.length === 0 && selectedCustomFields.length === 0}
            onClick={handleAdd}
          >
            Add
          </button>
        </footer>
      </div>
    </Modal>
  );
}

// Template picker for a create action's title row ("Create child with custom properties",
// etc.) — was previously an anchored dropdown panel; converted to a centered Modal to match
// every other picker in this THEN card (board minimap, Copy Card Details, Card details).
function CreateTemplatePickerModal({ show, onClose, onSelect }) {
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    if (!show) return;
    setFilterText('');
  }, [show]);

  const filterQuery = filterText.trim().toLowerCase();
  const filteredTemplates = filterQuery
    ? DUMMY_CREATE_ACTION_TEMPLATES.filter((name) => name.toLowerCase().includes(filterQuery))
    : DUMMY_CREATE_ACTION_TEMPLATES;

  return (
    <Modal
      show={show}
      onHide={onClose}
      className="card-property-match-modal"
      dialogClassName="card-property-match-modal-dialog"
      backdropClassName="card-property-match-modal-backdrop"
      centered
      scrollable
    >
      <div className="card-property-match-modal-shell">
        <header className="card-property-match-modal-header">
          <h2 className="card-property-match-modal-title">Create Card Template</h2>
          <button
            type="button"
            className="business-rule-form-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <FiX size={20} />
          </button>
        </header>

        <div className="card-property-match-modal-body">
          <div className="board-minimap-picker-search">
            <FiFilter size={16} className="board-minimap-picker-search-icon" aria-hidden />
            <input
              type="text"
              placeholder="Filter"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              autoFocus
            />
          </div>
          <div className="br-create-template-scroll">
            <button
              type="button"
              className="br-create-template-option br-create-template-option--default"
              onClick={() => onSelect(null)}
            >
              with custom properties
            </button>
            <div className="br-create-template-section-label">Templates</div>
            {filteredTemplates.length === 0 ? (
              <div className="br-property-picker-empty">No matches</div>
            ) : (
              filteredTemplates.map((name) => (
                <button
                  type="button"
                  key={name}
                  className="br-create-template-option"
                  onClick={() => onSelect(name)}
                >
                  {name}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

CreateTemplatePickerModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
};

// Follow-up step after picking a destination for a relational "Create card" action
// (Create child/parent/predecessor/relative/successor) — lets the user pick which of the
// originator (triggering) card's fields to carry over onto the new card.
function CopyCardDetailsModal({ show, onClose, onContinue, triggerTypeId, boardId, initialFields }) {
  const [selectedRegular, setSelectedRegular] = useState([]);
  const [selectedCustom, setSelectedCustom] = useState([]);
  const [expandedRegularFields, setExpandedRegularFields] = useState(true);
  const [expandedCustomFields, setExpandedCustomFields] = useState(true);

  const { customFields, isLoadingCustomFields } = useCustomFieldsByTrigger({
    show, triggerTypeId, boardId, showDisabled: false, search: '',
  });
  // Dev-only fallback so the modal can be visually tested without a live backend.
  const displayCustomFields = customFields.length > 0 ? customFields : (import.meta.env.DEV ? DUMMY_CUSTOM_FIELDS : []);

  // Reopening this modal on an already-configured create action (e.g. clicking the "title
  // will be copied..." summary) should show what was picked last time, not a blank slate.
  useEffect(() => {
    if (!show) return;
    setSelectedRegular(initialFields?.regularFields ?? []);
    setSelectedCustom(initialFields?.customFields ?? []);
  }, [show, initialFields]);

  const toggleRegular = (key) => {
    setSelectedRegular((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const toggleCustom = (key) => {
    setSelectedCustom((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleContinue = () => {
    onContinue({ regularFields: selectedRegular, customFields: selectedCustom });
    onClose();
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      className="card-property-match-modal"
      dialogClassName="card-property-match-modal-dialog"
      backdropClassName="card-property-match-modal-backdrop"
      centered
      scrollable
    >
      <div className="card-property-match-modal-shell">
        <header className="card-property-match-modal-header">
          <h2 className="card-property-match-modal-title">Copy Card Details</h2>
          <button
            type="button"
            className="business-rule-form-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <FiX size={20} />
          </button>
        </header>

        <div className="card-property-match-modal-body">
          <p className="br-copy-card-details-subtitle">Select the fields that you want to copy from the originator</p>

          <div className="br-property-section">
            <button
              type="button"
              className="br-property-section-toggle"
              onClick={() => setExpandedRegularFields((v) => !v)}
            >
              <span className="br-property-section-toggle-icon">
                {expandedRegularFields ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
              </span>
              Regular fields
            </button>
            {expandedRegularFields && (
              <>
                <div className="br-property-select-all-row">
                  <button
                    type="button"
                    className="business-rule-form-add-link"
                    onClick={() => setSelectedRegular(COPY_CARD_DETAIL_REGULAR_FIELDS.map((f) => f.key))}
                  >
                    Select all
                  </button>
                  /
                  <button
                    type="button"
                    className="business-rule-form-add-link"
                    onClick={() => setSelectedRegular([])}
                  >
                    Deselect all
                  </button>
                </div>
                <div className="br-property-pill-grid">
                  {COPY_CARD_DETAIL_REGULAR_FIELDS.map((field) => (
                    <PropertyPill
                      key={field.key}
                      pillKey={field.key}
                      label={field.label}
                      selected={selectedRegular.includes(field.key)}
                      onClick={() => toggleRegular(field.key)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="br-property-section">
            <button
              type="button"
              className="br-property-section-toggle"
              onClick={() => setExpandedCustomFields((v) => !v)}
            >
              <span className="br-property-section-toggle-icon">
                {expandedCustomFields ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
              </span>
              Custom fields
            </button>
            {expandedCustomFields && (
              <>
                <div className="br-property-select-all-row">
                  <button
                    type="button"
                    className="business-rule-form-add-link"
                    onClick={() => setSelectedCustom(displayCustomFields.map((f, idx) => f.custom_field_id ?? idx))}
                  >
                    Select all
                  </button>
                  /
                  <button
                    type="button"
                    className="business-rule-form-add-link"
                    onClick={() => setSelectedCustom([])}
                  >
                    Deselect all
                  </button>
                </div>
                <div className="br-property-pill-grid">
                  {isLoadingCustomFields ? (
                    <div className="br-property-picker-empty">Loading...</div>
                  ) : displayCustomFields.length === 0 ? (
                    <div className="br-property-picker-empty">No custom fields found</div>
                  ) : (
                    displayCustomFields.map((field, idx) => {
                      const key = field.custom_field_id ?? idx;
                      return (
                        <PropertyPill
                          key={key}
                          pillKey={key}
                          label={getFieldLabel(field)}
                          selected={selectedCustom.includes(key)}
                          onClick={() => toggleCustom(key)}
                        />
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <footer className="card-property-match-modal-footer">
          <button type="button" className="br-property-add-btn" onClick={handleContinue}>
            Continue
          </button>
        </footer>
      </div>
    </Modal>
  );
}

// Card-fields panel layout for CreateCardFieldsModal below: owner/co-owner render as an
// avatar-prefixed pill, size/priority/type/color render as a select-styled box (chevron,
// no live options source yet), and this pairing/order keeps Owner+Co-owners and
// Deadline+Size on the same row (matching the reference card UI) regardless of the fixed
// COPY_CARD_DETAIL_REGULAR_FIELDS declaration order.
const CARD_FIELD_DISPLAY_ORDER = [
  'owner', 'co_owners', 'deadline', 'size', 'tags', 'custom_card_id',
  'priority', 'color', 'type', 'stickers', 'milestones', 'parent_links',
];
const FULL_WIDTH_FIELD_KEYS = ['tags', 'custom_card_id', 'priority', 'color', 'type', 'stickers', 'milestones', 'parent_links'];
const SELECT_LIKE_FIELD_KEYS = ['priority', 'type', 'color'];
// Shown by default (matches the real card modal) when the action hasn't been through
// Copy Card Details with a regular-field selection yet — still addable/removable from here.
const DEFAULT_CARD_FIELD_KEYS = ['owner', 'co_owners', 'deadline', 'size', 'tags', 'custom_card_id'];
// title/description have their own dedicated inputs above the panel, subtasks/attachments
// have their own dedicated sections, and "all custom fields" isn't a single value — none
// of these belong in the addable "Card fields" panel list.
const NON_CARD_FIELD_PANEL_KEYS = ['title', 'description', 'subtasks', 'attachments', 'all_custom_fields'];

// Read-only preview of the card a "Create card" (or relational create) THEN-action will
// produce — opened right after Copy Card Details so the rule author can set default values
// for the regular/custom fields they just chose to carry. Nothing here creates a real card;
// "Save details" just stores these as the create-action's field defaults (see
// handleSaveCreateCardFields), same non-persisted pattern as CopyCardDetailsModal. Board/
// workflow/swimlane/stage are read-only here — they come from the earlier board-minimap step.
function CreateCardFieldsModal({ show, onClose, onSave, action, triggerTypeId }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fieldValues, setFieldValues] = useState({});
  const [customFieldValues, setCustomFieldValues] = useState({});
  const [expandedSubtasks, setExpandedSubtasks] = useState(true);
  const [expandedDocs, setExpandedDocs] = useState(true);
  const [subtasks, setSubtasks] = useState([]);
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [cardFieldKeys, setCardFieldKeys] = useState([]);
  const [customFieldKeys, setCustomFieldKeys] = useState([]);
  const [expandedCustomFields, setExpandedCustomFields] = useState(true);
  const [showAddFieldPicker, setShowAddFieldPicker] = useState(false);
  const addFieldTriggerRef = useRef(null);
  const addFieldPanelRef = useRef(null);
  const quillRef = useRef(null);
  const quillWrapRef = useRef(null);

  const { boardStructure, getBoardStructure } = useWorkFlowReducer((s) => s);
  const { customFields } = useCustomFieldsByTrigger({
    show, triggerTypeId, boardId: action?.boardId, showDisabled: false, search: '',
  });
  // Dev-only fallback so the modal can be visually tested without a live backend.
  const displayCustomFields = customFields.length > 0 ? customFields : (import.meta.env.DEV ? DUMMY_CUSTOM_FIELDS : []);

  const { users, usersLoading, getUsers } = useCommonReducer((s) => s);

  useEffect(() => {
    if (!show) return;
    if (users.length === 0 && !usersLoading) getUsers({ params: { limit: 200 } });
  }, [show, users.length, usersLoading, getUsers]);

  useEffect(() => {
    if (!show || !action?.boardId) return;
    getBoardStructure({ boardId: action.boardId });
  }, [show, action?.boardId]);

  useEffect(() => {
    if (!show) return;
    setTitle(action?.title ?? '');
    setDescription(action?.description ?? '');
    setFieldValues(action?.fieldValues ?? {});
    setCustomFieldValues(action?.customFieldValues ?? {});
    setSubtasks(action?.subtasks ?? []);
    setSubtaskDraft('');
    setExpandedSubtasks(true);
    setExpandedDocs(true);
    // DEFAULT_CARD_FIELD_KEYS always shows (matches the real card modal) and can't be
    // removed from here (no "x" on those rows) — merged with whatever else was picked in
    // Copy Card Details, plus anything added/removed on a previous visit to this modal
    // (action.cardFieldKeys), rather than either of those replacing the defaults outright.
    const copyFieldsKeys = (action?.copyFields?.regularFields ?? []).filter((k) => !NON_CARD_FIELD_PANEL_KEYS.includes(k));
    const baseKeys = action?.cardFieldKeys ?? copyFieldsKeys;
    setCardFieldKeys(Array.from(new Set([...DEFAULT_CARD_FIELD_KEYS, ...baseKeys])));
    // Custom fields shown here start with whatever was picked in Copy Card Details, plus
    // anything added/removed on a previous visit to this modal (action.customFieldKeys).
    setCustomFieldKeys(action?.customFieldKeys ?? (action?.copyFields?.customFields ?? []));
    setShowAddFieldPicker(false);
  }, [show, action]);

  useEffect(() => {
    if (!showAddFieldPicker) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (addFieldPanelRef.current?.contains(t)) return;
      if (addFieldTriggerRef.current?.contains(t)) return;
      setShowAddFieldPicker(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [showAddFieldPicker]);

  // Same rich-text toolbar/config as the notification body editor above — reused as-is
  // for consistency rather than hand-rolling a second Quill setup.
  const quillModules = useMemo(() => ({
    table: false,
    toolbar: [
      [{ font: [] }, { size: ['small', false, 'large', 'huge'] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ color: [] }, { background: [] }],
      [{ align: [] }],
      ['link'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['image', 'table-better'],
      ['clean'],
    ],
    'table-better': {
      language: 'en_US',
      menus: ['column', 'row', 'merge', 'table', 'cell', 'wrap', 'delete'],
      toolbarTable: true,
    },
    keyboard: { bindings: QuillTableBetter.keyboardBindings },
  }), []);

  useLayoutEffect(() => {
    if (!show) return undefined;
    const toolbar = quillWrapRef.current?.querySelector('.ql-toolbar');
    if (!toolbar) return undefined;
    return attachToolbarOverflow(toolbar);
  }, [show]);

  const minimapWorkflows = useMemo(
    () => (action?.boardId ? buildBoardMinimapWorkflows(boardStructure) : []),
    [action?.boardId, boardStructure]
  );
  const activeWorkflow = minimapWorkflows.find((wf) => String(wf.id) === String(action?.workflowId));
  const leafColumns = activeWorkflow?.leafColumns ?? [];
  const activeStageIndex = leafColumns.findIndex((col) => String(col.id) === String(action?.stageId));

  const cardFieldRows = COPY_CARD_DETAIL_REGULAR_FIELDS
    .filter((f) => cardFieldKeys.includes(f.key))
    .sort((a, b) => {
      const ai = CARD_FIELD_DISPLAY_ORDER.indexOf(a.key);
      const bi = CARD_FIELD_DISPLAY_ORDER.indexOf(b.key);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  const addableFields = COPY_CARD_DETAIL_REGULAR_FIELDS.filter(
    (f) => !NON_CARD_FIELD_PANEL_KEYS.includes(f.key) && !cardFieldKeys.includes(f.key)
  );
  const customFieldRows = displayCustomFields.filter((f, idx) => customFieldKeys.includes(f.custom_field_id ?? idx));
  const addableCustomFields = displayCustomFields.filter((f, idx) => !customFieldKeys.includes(f.custom_field_id ?? idx));

  const handleFieldValueChange = (key, value) => setFieldValues((prev) => ({ ...prev, [key]: value }));
  const handleCustomFieldValueChange = (key, value) => setCustomFieldValues((prev) => ({ ...prev, [key]: value }));

  // The "+" on the Card fields panel offers both regular fields (land in the Card fields
  // grid) and custom fields (land under Custom fields, bumping its count) from one picker.
  const handleAddCardField = (key) => {
    setCardFieldKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setShowAddFieldPicker(false);
  };

  const handleAddCustomField = (key) => {
    setCustomFieldKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setShowAddFieldPicker(false);
  };

  const handleRemoveCustomField = (key) => {
    setCustomFieldKeys((prev) => prev.filter((k) => k !== key));
    setCustomFieldValues((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleRemoveCardField = (key) => {
    setCardFieldKeys((prev) => prev.filter((k) => k !== key));
    setFieldValues((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleAddSubtaskDraft = () => {
    const trimmed = subtaskDraft.trim();
    if (!trimmed) return;
    setSubtasks((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title: trimmed }]);
    setSubtaskDraft('');
  };

  const handleSubtaskDraftKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleAddSubtaskDraft();
    }
  };

  const handleRemoveSubtask = (id) => {
    setSubtasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSave = () => {
    onSave({ title, description, fieldValues, customFieldValues, cardFieldKeys, customFieldKeys, subtasks });
    onClose();
  };

  const renderFieldControl = (field) => {
    if (field.key === 'owner' || field.key === 'co_owners') {
      const value = fieldValues[field.key] ?? '';
      const selectedUser = users.find((u) => String(u.user_id) === String(value));
      const badgeLetter = (selectedUser?.name ?? '').trim().charAt(0).toUpperCase() || 'N';
      return (
        <div className="br-card-preview-avatar-field">
          <span className="br-card-preview-avatar-badge" aria-hidden>{badgeLetter}</span>
          <select
            className="br-card-preview-avatar-select"
            value={value}
            onChange={(e) => handleFieldValueChange(field.key, e.target.value)}
            disabled={usersLoading}
          >
            <option value="">{usersLoading ? 'Loading...' : 'None'}</option>
            {users.map((u) => (
              <option key={u.user_id} value={u.user_id}>{u.name}</option>
            ))}
          </select>
          <FiChevronDown size={14} className="br-card-preview-avatar-chevron" aria-hidden />
        </div>
      );
    }
    if (field.key === 'deadline') {
      const [deadlineDate = '', deadlineTime = ''] = (fieldValues.deadline ?? '').split(' ');
      return (
        <DateTimePickerField
          dateValue={deadlineDate}
          timeValue={deadlineTime}
          onDateTimeChange={({ date, time }) => {
            handleFieldValueChange('deadline', date ? `${date}${time ? ` ${time}` : ''}` : '');
          }}
          dateFieldName="br-card-preview-deadline-date"
          timeFieldName="br-card-preview-deadline-time"
          placeholder="Select date and time"
        />
      );
    }
    if (field.key === 'size') {
      return (
        <div className="br-card-preview-select-field">
          <select
            className="business-rule-form-input"
            value={fieldValues.size ?? ''}
            onChange={(e) => handleFieldValueChange('size', e.target.value)}
          >
            {SIZE_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
          <FiChevronDown size={14} className="br-card-preview-select-chevron" aria-hidden />
        </div>
      );
    }
    if (SELECT_LIKE_FIELD_KEYS.includes(field.key)) {
      return (
        <div className="br-card-preview-select-field">
          <input
            type="text"
            className="business-rule-form-input"
            placeholder="Not Set"
            value={fieldValues[field.key] ?? ''}
            onChange={(e) => handleFieldValueChange(field.key, e.target.value)}
          />
          <FiChevronDown size={14} className="br-card-preview-select-chevron" aria-hidden />
        </div>
      );
    }
    return (
      <input
        type="text"
        className="business-rule-form-input"
        value={fieldValues[field.key] ?? ''}
        onChange={(e) => handleFieldValueChange(field.key, e.target.value)}
      />
    );
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      className="card-property-match-modal br-card-preview-modal"
      dialogClassName="card-property-match-modal-dialog br-card-preview-modal-dialog"
      backdropClassName="card-property-match-modal-backdrop"
      centered
      scrollable
    >
      <div className="card-property-match-modal-shell br-card-preview-shell">
        <header className="br-card-preview-header-bar">
          <input
            type="text"
            className="br-card-preview-title-input"
            placeholder="Enter card title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button type="button" className="br-card-preview-close-btn" onClick={onClose} aria-label="Close">
            <FiX size={18} />
          </button>
        </header>

        <div className="card-property-match-modal-body br-card-preview-body">
          <div className="br-card-preview-main">
            <div className="br-card-preview-quill-wrap" ref={quillWrapRef}>
              <ReactQuill
                ref={quillRef}
                theme="snow"
                modules={quillModules}
                value={description}
                onChange={setDescription}
                placeholder="Enter card description"
              />
            </div>

          </div>

          <aside className="br-card-preview-sidebar">
              {(cardFieldRows.length > 0 || addableFields.length > 0 || addableCustomFields.length > 0) && (
                <div className="br-card-preview-fields-panel">
                  <div className="br-card-preview-section-bar br-card-preview-section-bar--static br-card-preview-fields-header-wrap">
                    <span className="br-card-preview-section-bar-badge">
                      <FiChevronUp size={14} />
                    </span>
                    <span className="br-card-preview-section-bar-label">Card fields</span>
                    {(addableFields.length > 0 || addableCustomFields.length > 0) && (
                      <button
                        type="button"
                        ref={addFieldTriggerRef}
                        className="br-card-preview-add-field-btn"
                        onClick={() => setShowAddFieldPicker((v) => !v)}
                        aria-haspopup="listbox"
                        aria-expanded={showAddFieldPicker}
                        aria-label="Add card field"
                      >
                        <FiPlus size={14} />
                      </button>
                    )}
                    {showAddFieldPicker && (
                      <div className="br-card-preview-add-field-panel" ref={addFieldPanelRef}>
                        {addableFields.map((f) => (
                          <button
                            type="button"
                            key={f.key}
                            className="br-card-preview-add-field-option"
                            onClick={() => handleAddCardField(f.key)}
                          >
                            {f.label}
                          </button>
                        ))}
                        {addableCustomFields.length > 0 && (
                          <>
                            <div className="br-card-preview-add-field-group-label">Custom fields</div>
                            {addableCustomFields.map((f, idx) => {
                              const key = f.custom_field_id ?? idx;
                              return (
                                <button
                                  type="button"
                                  key={key}
                                  className="br-card-preview-add-field-option"
                                  onClick={() => handleAddCustomField(key)}
                                >
                                  {getFieldLabel(f)}
                                </button>
                              );
                            })}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {cardFieldRows.length > 0 && (
                    <div className="br-card-preview-fields-grid">
                      {cardFieldRows.map((field) => (
                        <div
                          key={field.key}
                          className={`br-card-preview-field-row${FULL_WIDTH_FIELD_KEYS.includes(field.key) ? ' br-card-preview-field-row--full' : ''}`}
                        >
                          <div className="br-card-preview-field-row-head">
                            <label>{field.label}</label>
                            {!DEFAULT_CARD_FIELD_KEYS.includes(field.key) && (
                              <button
                                type="button"
                                className="br-card-preview-field-remove"
                                onClick={() => handleRemoveCardField(field.key)}
                                aria-label={`Remove ${field.label}`}
                              >
                                <FiX size={12} />
                              </button>
                            )}
                          </div>
                          {renderFieldControl(field)}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="br-card-preview-custom-fields-divider">
                    <button
                      type="button"
                      className="br-card-preview-custom-fields-toggle"
                      onClick={() => setExpandedCustomFields((v) => !v)}
                      aria-expanded={expandedCustomFields}
                    >
                      {`Custom fields (${customFieldRows.length})`}
                      {expandedCustomFields ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
                    </button>
                  </div>

                  {expandedCustomFields && (
                    <>
                      <p className="br-card-preview-custom-fields-note">
                        Custom fields here that match ones already selected to be copied from the originator card
                        (in Copy Card Details) will be ignored during card creation. If &quot;All custom fields&quot;
                        was selected there, every custom field value set here will be ignored.
                      </p>

                      {customFieldRows.length > 0 && (
                        <div className="br-card-preview-fields-grid">
                          {customFieldRows.map((field, idx) => {
                            const key = field.custom_field_id ?? idx;
                            return (
                              <div key={key} className="br-card-preview-field-row br-card-preview-field-row--full">
                                <div className="br-card-preview-field-row-head">
                                  <label>{getFieldLabel(field)}</label>
                                  <button
                                    type="button"
                                    className="br-card-preview-field-remove"
                                    onClick={() => handleRemoveCustomField(key)}
                                    aria-label={`Remove ${getFieldLabel(field)}`}
                                  >
                                    <FiX size={12} />
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  className="business-rule-form-input"
                                  value={customFieldValues[key] ?? ''}
                                  onChange={(e) => handleCustomFieldValueChange(key, e.target.value)}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="br-card-preview-fields-panel">
                <button
                  type="button"
                  className="br-card-preview-section-bar"
                  onClick={() => setExpandedSubtasks((v) => !v)}
                >
                  <span className="br-card-preview-section-bar-badge">
                    {expandedSubtasks ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                  </span>
                  <span className="br-card-preview-section-bar-label">Subtasks</span>
                </button>
                {expandedSubtasks && (
                  <div className="br-card-preview-subtasks">
                    {subtasks.length > 0 && (
                      <ul className="br-card-preview-subtask-list">
                        {subtasks.map((task) => (
                          <li key={task.id} className="br-card-preview-subtask-item">
                            <span className="br-card-preview-subtask-item-title">{task.title}</span>
                            <button
                              type="button"
                              className="br-card-preview-field-remove"
                              onClick={() => handleRemoveSubtask(task.id)}
                              aria-label={`Remove ${task.title}`}
                            >
                              <FiX size={12} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <textarea
                      className="br-card-preview-subtask-input"
                      placeholder="Press ctrl/cmd + enter to create new subtask"
                      value={subtaskDraft}
                      onChange={(e) => setSubtaskDraft(e.target.value)}
                      onKeyDown={handleSubtaskDraftKeyDown}
                    />
                  </div>
                )}
              </div>

              <div className="br-card-preview-fields-panel">
                <button
                  type="button"
                  className="br-card-preview-section-bar"
                  onClick={() => setExpandedDocs((v) => !v)}
                >
                  <span className="br-card-preview-section-bar-badge">
                    {expandedDocs ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                  </span>
                  <span className="br-card-preview-section-bar-label">Docs</span>
                  <span className="br-card-preview-section-bar-right" aria-hidden>
                    <FiFile size={14} />
                  </span>
                  <span className="br-card-preview-section-bar-right" aria-hidden>
                    <FiPlus size={14} />
                  </span>
                </button>
                {expandedDocs && (
                  <div className="br-card-preview-placeholder">Add docs from the + button</div>
                )}
              </div>
            </aside>
        </div>

        <footer className="card-property-match-modal-footer br-card-preview-footer">
          <div className="br-card-preview-breadcrumb">
            Board <span>{action?.boardName || 'Not set'}</span>
            {action?.workflowName && <>{' '}/ Workflow <span>{action.workflowName}</span></>}
            {action?.swimlaneName && <>{' '}/ Swimlane <span>{action.swimlaneName}</span></>}
          </div>

          <div className="br-card-preview-footer-row">
            {leafColumns.length > 0 && (
              <div className="br-card-preview-stepper">
                {leafColumns.map((col, idx) => {
                  const segment = activeWorkflow.stageSegments.find((seg) => seg.columns.some((c) => c.id === col.id));
                  const stepColor = segment?.color || '#d1d5db';
                  const isDone = activeStageIndex >= 0 && idx < activeStageIndex;
                  const isActive = idx === activeStageIndex;
                  return (
                    <div
                      key={col.id}
                      className={`br-card-preview-step${isDone ? ' br-card-preview-step--done' : ''}${isActive ? ' br-card-preview-step--active' : ''}`}
                      title={col.name}
                    >
                      <span
                        className="br-card-preview-step-dot"
                        style={isActive ? { borderColor: stepColor, backgroundColor: stepColor } : (isDone ? undefined : { borderColor: stepColor })}
                      >
                        {isDone ? <FiCheck size={11} /> : null}
                      </span>
                      <span className="br-card-preview-step-label">{col.name}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <button type="button" className="br-property-add-btn br-card-preview-save-btn" onClick={handleSave}>
              Save details
            </button>
          </div>
        </footer>
      </div>
    </Modal>
  );
}

function UserPill({ pillKey, label, selected, onClick }) {
  return (
    <button
      type="button"
      key={pillKey}
      className={`br-property-pill br-user-pill${selected ? ' br-property-pill--selected' : ''}`}
      onClick={onClick}
    >
      <span className="br-user-pill-avatar" aria-hidden>{label.charAt(0).toUpperCase()}</span>
      {label}
    </button>
  );
}

function InternalUsersPickerModal({ show, onClose, onApply }) {
  const [filterText, setFilterText] = useState('');
  const [expanded, setExpanded] = useState(true);
  const [selectedKeys, setSelectedKeys] = useState([]);

  const { users, usersLoading, getUsers } = useCommonReducer((s) => s);

  useEffect(() => {
    if (!show) return;
    setFilterText('');
    setExpanded(true);
    setSelectedKeys([]);
    if (users.length === 0 && !usersLoading) getUsers({ params: { limit: 200 } });
  }, [show]);

  // Options are keyed by user_id (role options by their own label, which is always
  // unique) rather than by display name — two different users can share the same
  // name, and a name-keyed list collapses them into one selectable entry, silently
  // dropping whichever one the user picked second.
  const realUserOptions = users
    .filter((u) => u.name)
    .map((u) => ({ key: `user-${u.user_id}`, label: u.name, id: u.user_id }));
  const displayUserOptions = realUserOptions.length > 0
    ? realUserOptions
    : (import.meta.env.DEV ? DUMMY_INTERNAL_USERS.map((name, idx) => ({ key: `dummy-${idx}`, label: name, id: null })) : []);
  const roleOptions = INTERNAL_USER_ROLE_OPTIONS.map((label) => ({ key: `role-${label}`, label, id: null }));
  const allOptions = [...roleOptions, ...displayUserOptions];

  const filterQuery = filterText.trim().toLowerCase();
  const filteredOptions = filterQuery
    ? allOptions.filter((option) => option.label.toLowerCase().includes(filterQuery))
    : allOptions;

  const handleToggle = (key) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleApply = () => {
    if (selectedKeys.length === 0) return;
    // Role options (Self, Owner, Watchers, ...) have no backing user record, so they
    // carry id: null and are dropped when the caller builds an id list for the API.
    const items = allOptions
      .filter((option) => selectedKeys.includes(option.key))
      .map((option) => ({ label: option.label, id: option.id }));
    onApply(items);
    onClose();
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      className="card-property-match-modal internal-users-picker-modal"
      dialogClassName="card-property-match-modal-dialog internal-users-picker-modal-dialog"
      backdropClassName="card-property-match-modal-backdrop"
      centered
      scrollable
    >
      <div className="card-property-match-modal-shell br-floating-close-shell">
        <button
          type="button"
          className="br-floating-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          <FiX size={16} />
        </button>

        <header className="card-property-match-modal-header br-floating-close-header">
          <h2 className="card-property-match-modal-title">Select Internal Users</h2>
        </header>

        <div className="card-property-match-modal-body">
          <input
            type="text"
            className="br-property-filter-input"
            placeholder="John or john@doe.com"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            autoFocus
          />

          <div className="br-property-section">
            <button
              type="button"
              className="br-property-section-toggle"
              onClick={() => setExpanded((v) => !v)}
            >
              <span className="br-property-section-toggle-icon">
                {expanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
              </span>
              Users
            </button>
            {expanded && (
              <div className="br-property-pill-grid">
                {usersLoading ? (
                  <div className="br-property-picker-empty">Loading...</div>
                ) : filteredOptions.length === 0 ? (
                  <div className="br-property-picker-empty">No users found</div>
                ) : (
                  filteredOptions.map((option) => (
                    <UserPill
                      key={option.key}
                      pillKey={option.key}
                      label={option.label}
                      selected={selectedKeys.includes(option.key)}
                      onClick={() => handleToggle(option.key)}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <footer className="card-property-match-modal-footer">
          <button
            type="button"
            className="br-property-add-btn"
            disabled={selectedKeys.length === 0}
            onClick={handleApply}
          >
            Apply
          </button>
        </footer>
      </div>
    </Modal>
  );
}

InternalUsersPickerModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onApply: PropTypes.func.isRequired,
};

function CustomFieldPickerModal({ show, onClose, onApply, triggerTypeId }) {
  const [expanded, setExpanded] = useState(true);
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [showDisabled, setShowDisabled] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedFieldKeys, setSelectedFieldKeys] = useState([]);

  const { customFields, isLoadingCustomFields } = useCustomFieldsByTrigger({
    show, triggerTypeId, boardId: selectedBoardId, showDisabled, search: debouncedSearch,
  });
  const { workspaces, listAllWorkspaces } = useWorkSpaceReducer((s) => s);

  // Only fall back to dummy data in the untouched/no-filter state — once a board,
  // the disabled toggle, or a search term narrows the results, an empty response is a
  // real answer (e.g. "no disabled fields on this board") and must be shown as empty,
  // not masked by an unrelated generic dummy list.
  const isCustomFieldsUnfiltered = !selectedBoardId && !showDisabled && !debouncedSearch;
  const displayCustomFields = customFields.length > 0
    ? customFields
    : (isCustomFieldsUnfiltered ? DUMMY_CUSTOM_FIELDS : []);

  useEffect(() => {
    if (!show) return;
    setExpanded(true);
    setSelectedBoardId('');
    setShowDisabled(false);
    setFilterText('');
    setDebouncedSearch('');
    setSelectedFieldKeys([]);
    if (workspaces.length === 0) listAllWorkspaces();
  }, [show]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(filterText.trim());
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [filterText]);

  const handleToggleField = (key) => {
    setSelectedFieldKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleApply = () => {
    const items = selectedFieldKeys
      .map((key) => displayCustomFields.find((f, idx) => `custom-${f.custom_field_id ?? idx}` === key))
      .filter(Boolean)
      .map((field) => ({ label: getFieldLabel(field), id: field.custom_field_id ?? null }));
    if (items.length === 0) return;
    onApply(items);
    onClose();
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      className="card-property-match-modal"
      dialogClassName="card-property-match-modal-dialog"
      backdropClassName="card-property-match-modal-backdrop"
      centered
      scrollable
    >
      <div className="card-property-match-modal-shell br-floating-close-shell">
        <button
          type="button"
          className="br-floating-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          <FiX size={16} />
        </button>

        <header className="card-property-match-modal-header br-floating-close-header">
          <h2 className="card-property-match-modal-title">Select a field</h2>
        </header>

        <div className="card-property-match-modal-body">
          <input
            type="text"
            className="br-property-filter-input"
            placeholder="Filter"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            autoFocus
          />

          <div className="br-property-section">
            <button
              type="button"
              className="br-property-section-toggle"
              onClick={() => setExpanded((v) => !v)}
            >
              <span className="br-property-section-toggle-icon">
                {expanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
              </span>
              Custom fields
            </button>
            {expanded && (
              <>
                <div className="br-property-board-filter">
                  <span className="br-property-board-filter-label">Show fields from board:</span>
                  <div className="br-property-board-filter-row">
                    <BoardFilterPicker
                      workspaces={workspaces ?? []}
                      value={selectedBoardId}
                      onChange={setSelectedBoardId}
                    />
                    <button
                      type="button"
                      className="br-property-board-clear-btn"
                      onClick={() => setSelectedBoardId('')}
                      aria-label="Reset board filter"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </div>

                <label className="business-rule-form-toggle br-property-disabled-toggle">
                  <input
                    type="checkbox"
                    checked={showDisabled}
                    onChange={(e) => setShowDisabled(e.target.checked)}
                  />
                  <span className="business-rule-form-toggle-track" aria-hidden />
                  <span className="business-rule-form-toggle-label">Show disabled custom fields</span>
                </label>

                <div className="br-property-pill-grid">
                  {isLoadingCustomFields ? (
                    <div className="br-property-picker-empty">Loading...</div>
                  ) : displayCustomFields.length === 0 ? (
                    <div className="br-property-picker-empty">No custom fields found</div>
                  ) : (
                    displayCustomFields.map((field, idx) => {
                      const key = `custom-${field.custom_field_id ?? idx}`;
                      return (
                        <PropertyPill
                          key={key}
                          pillKey={key}
                          label={getFieldLabel(field)}
                          selected={selectedFieldKeys.includes(key)}
                          dotColor={getPropertyDotColor(idx)}
                          onClick={() => handleToggleField(key)}
                        />
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <footer className="card-property-match-modal-footer">
          <button
            type="button"
            className="br-property-add-btn"
            disabled={selectedFieldKeys.length === 0}
            onClick={handleApply}
          >
            Apply
          </button>
        </footer>
      </div>
    </Modal>
  );
}

CustomFieldPickerModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onApply: PropTypes.func.isRequired,
  triggerTypeId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

// Single-select "Select a field" picker covering Regular fields, Time unit and
// Custom fields together, used by the notification Subject/Body "add card
// fields" triggers so any card field (not just a fixed shortlist) can be
// inserted as a pill.
// actionTypeId puts this in "then action" mode: all three sections (regular/time
// unit/custom fields) come from the one get_then_action_fields/{action_type_id}
// response instead of the trigger-scoped get_regular_fields/get_time_units plus a
// separate board-filterable custom-fields lookup. Used for then-action contexts
// (e.g. "Invoke web service") where the available fields are scoped to that action,
// not to the rule's trigger.
function CardFieldPickerModal({ show, onClose, onApply, triggerTypeId, actionTypeId, allowedRegularFieldLabels }) {
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [expandedRegularFields, setExpandedRegularFields] = useState(true);
  const [expandedTimeUnit, setExpandedTimeUnit] = useState(true);
  const [expandedCustomFields, setExpandedCustomFields] = useState(true);
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [showDisabled, setShowDisabled] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [includeLoggedTimeSubtasks, setIncludeLoggedTimeSubtasks] = useState(false);

  const isActionMode = actionTypeId != null;
  // Url tokens can only carry simple id-like values, so its trigger passes a fixed
  // label whitelist (Card ID/Custom card ID/Internal card id) and neither Time unit
  // nor Custom fields apply there — unlike Params, which accepts any card field.
  const isRestricted = allowedRegularFieldLabels != null;

  const {
    regularFields, isLoadingRegularFields, getRegularFields,
    timeUnits, isLoadingTimeUnits, getTimeUnits,
    thenActionRegularFields, thenActionCustomFields, thenActionTimeUnits,
    isLoadingThenActionFields, getThenActionFields,
  } = useBusinessRuleReducer((s) => s);

  const { customFields, isLoadingCustomFields } = useCustomFieldsByTrigger({
    show: show && !isActionMode && !isRestricted, triggerTypeId, boardId: selectedBoardId, showDisabled, search: debouncedSearch,
  });

  const { workspaces, listAllWorkspaces } = useWorkSpaceReducer((s) => s);

  // get_then_action_fields has no search param, so action mode filters client-side
  // (same as CreateActionModal/RefineUpdateCriteriaModal do for their own regular options).
  const filterQuery = filterText.trim().toLowerCase();
  const applyClientFilter = (list) => filterQuery
    ? list.filter((field) => getFieldLabel(field).toLowerCase().includes(filterQuery))
    : list;

  // Card ID/Custom card ID/Internal card id are fixed system fields, not board data —
  // rendered directly from the whitelist instead of depending on get_regular_fields
  // actually including them for this trigger.
  const restrictedRegularFields = isRestricted
    ? allowedRegularFieldLabels.map((label, idx) => ({ regular_field_id: `url-${idx}`, field_label: label, field_key: label }))
    : null;

  const displayRegularFields = isRestricted
    ? applyClientFilter(restrictedRegularFields)
    : (isActionMode
      ? applyClientFilter(thenActionRegularFields)
      : (regularFields.length > 0 ? regularFields : DUMMY_REGULAR_FIELDS));
  const displayTimeUnits = isActionMode
    ? applyClientFilter(thenActionTimeUnits)
    : (timeUnits.length > 0 ? timeUnits : DUMMY_TIME_UNITS);
  // Only fall back to dummy data in the untouched/no-filter state — once a board,
  // the disabled toggle, or a search term narrows the results, an empty response is a
  // real answer (e.g. "no disabled fields on this board") and must be shown as empty,
  // not masked by an unrelated generic dummy list.
  const isCustomFieldsUnfiltered = !selectedBoardId && !showDisabled && !debouncedSearch;
  const displayCustomFields = isActionMode
    ? applyClientFilter(thenActionCustomFields)
    : (customFields.length > 0 ? customFields : (isCustomFieldsUnfiltered ? DUMMY_CUSTOM_FIELDS : []));

  const regularFieldsLoading = isRestricted ? false : (isActionMode ? isLoadingThenActionFields : isLoadingRegularFields);
  const timeUnitsLoading = isActionMode ? isLoadingThenActionFields : isLoadingTimeUnits;
  const customFieldsLoading = isActionMode ? isLoadingThenActionFields : isLoadingCustomFields;

  useEffect(() => {
    if (!show) return;
    setSelectedKeys([]);
    setFilterText('');
    setDebouncedSearch('');
    setSelectedBoardId('');
    setShowDisabled(false);
    setIncludeLoggedTimeSubtasks(false);
    if (!isActionMode && workspaces.length === 0) listAllWorkspaces();
  }, [show]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(filterText.trim());
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [filterText]);

  useEffect(() => {
    if (!show || !isActionMode) return;
    getThenActionFields(actionTypeId);
  }, [show, isActionMode, actionTypeId]);

  useEffect(() => {
    if (!show || isActionMode || isRestricted) return;
    getRegularFields({ params: { trigger_type_id: triggerTypeId, search: debouncedSearch || undefined } });
  }, [show, isActionMode, isRestricted, debouncedSearch, triggerTypeId]);

  useEffect(() => {
    if (!show || isActionMode || isRestricted) return;
    getTimeUnits({ params: { trigger_type_id: triggerTypeId, search: debouncedSearch || undefined } });
  }, [show, isActionMode, isRestricted, debouncedSearch, triggerTypeId]);

  const handleToggleKey = (key) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleToggleTimeUnitKey = (key) => {
    setSelectedKeys((prev) => {
      const withoutTimeUnits = prev.filter((k) => !k.startsWith('time_unit-'));
      return prev.includes(key) ? withoutTimeUnits : [...withoutTimeUnits, key];
    });
  };

  const findLabelForKey = (key) => {
    if (key.startsWith('regular-')) {
      const field = displayRegularFields.find((f, idx) => `regular-${f.regular_field_id ?? idx}` === key);
      if (!field) return null;
      const label = getFieldLabel(field);
      return label.toLowerCase() === 'logged time' && includeLoggedTimeSubtasks
        ? `${label} (include subtasks)`
        : label;
    }
    if (key.startsWith('time_unit-')) {
      const field = displayTimeUnits.find((f, idx) => `time_unit-${f.time_unit_id ?? idx}` === key);
      return field ? getFieldLabel(field) : null;
    }
    const field = displayCustomFields.find((f, idx) => `custom-${f.custom_field_id ?? idx}` === key);
    return field ? getFieldLabel(field) : null;
  };

  const handleApply = () => {
    const labels = selectedKeys.map(findLabelForKey).filter(Boolean);
    if (labels.length === 0) return;
    onApply(labels);
    onClose();
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      className="card-property-match-modal"
      dialogClassName="card-property-match-modal-dialog"
      backdropClassName="card-property-match-modal-backdrop"
      centered
      scrollable
    >
      <div className="card-property-match-modal-shell br-floating-close-shell">
        <button
          type="button"
          className="br-floating-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          <FiX size={16} />
        </button>

        <header className="card-property-match-modal-header br-floating-close-header">
          <h2 className="card-property-match-modal-title">Select a field</h2>
        </header>

        <div className="card-property-match-modal-body">
          <input
            type="text"
            className="br-property-filter-input"
            placeholder="Filter"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            autoFocus
          />

          <div className="br-property-section">
            <button
              type="button"
              className="br-property-section-toggle"
              onClick={() => setExpandedRegularFields((v) => !v)}
            >
              <span className="br-property-section-toggle-icon">
                {expandedRegularFields ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
              </span>
              Regular fields
            </button>
            {expandedRegularFields && (
              <div className="br-property-pill-grid">
                {regularFieldsLoading ? (
                  <div className="br-property-picker-empty">Loading...</div>
                ) : displayRegularFields.length === 0 ? (
                  <div className="br-property-picker-empty">No fields found</div>
                ) : (
                  displayRegularFields.map((field, idx) => {
                    const key = `regular-${field.regular_field_id ?? idx}`;
                    const label = getFieldLabel(field);
                    const isLoggedTime = label.toLowerCase() === 'logged time';
                    return (
                      <Fragment key={key}>
                        <PropertyPill
                          pillKey={key}
                          label={label}
                          selected={selectedKeys.includes(key)}
                          onClick={() => handleToggleKey(key)}
                        />
                        {isLoggedTime && (
                          <label className="br-link-checkbox-row br-property-inline-checkbox">
                            <input
                              type="checkbox"
                              checked={includeLoggedTimeSubtasks}
                              onChange={(e) => setIncludeLoggedTimeSubtasks(e.target.checked)}
                            />
                            include subtasks
                          </label>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {!isRestricted && (
            <>
              <div className="br-property-section">
                <button
                  type="button"
                  className="br-property-section-toggle"
                  onClick={() => setExpandedTimeUnit((v) => !v)}
                >
                  <span className="br-property-section-toggle-icon">
                    {expandedTimeUnit ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                  </span>
                  Time unit
                </button>
                {expandedTimeUnit && (
                  <div className="br-property-pill-grid">
                    {timeUnitsLoading ? (
                      <div className="br-property-picker-empty">Loading...</div>
                    ) : displayTimeUnits.length === 0 ? (
                      <div className="br-property-picker-empty">No fields found</div>
                    ) : (
                      displayTimeUnits.map((field, idx) => {
                        const key = `time_unit-${field.time_unit_id ?? idx}`;
                        return (
                          <PropertyPill
                            key={key}
                            pillKey={key}
                            label={getFieldLabel(field)}
                            selected={selectedKeys.includes(key)}
                            onClick={() => handleToggleTimeUnitKey(key)}
                          />
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              <div className="br-property-section">
                <button
                  type="button"
                  className="br-property-section-toggle"
                  onClick={() => setExpandedCustomFields((v) => !v)}
                >
                  <span className="br-property-section-toggle-icon">
                    {expandedCustomFields ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                  </span>
                  Custom fields
                </button>
                {expandedCustomFields && (
                  <>
                    {!isActionMode && (
                      <>
                        <div className="br-property-board-filter">
                          <span className="br-property-board-filter-label">Show fields from board:</span>
                          <div className="br-property-board-filter-row">
                            <BoardFilterPicker
                              workspaces={workspaces ?? []}
                              value={selectedBoardId}
                              onChange={setSelectedBoardId}
                            />
                            <button
                              type="button"
                              className="br-property-board-clear-btn"
                              onClick={() => setSelectedBoardId('')}
                              aria-label="Reset board filter"
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </div>
                        </div>

                        <label className="business-rule-form-toggle br-property-disabled-toggle">
                          <input
                            type="checkbox"
                            checked={showDisabled}
                            onChange={(e) => setShowDisabled(e.target.checked)}
                          />
                          <span className="business-rule-form-toggle-track" aria-hidden />
                          <span className="business-rule-form-toggle-label">Show disabled custom fields</span>
                        </label>
                      </>
                    )}

                    <div className="br-property-pill-grid">
                      {customFieldsLoading ? (
                        <div className="br-property-picker-empty">Loading...</div>
                      ) : displayCustomFields.length === 0 ? (
                        <div className="br-property-picker-empty">No custom fields found</div>
                      ) : (
                        displayCustomFields.map((field, idx) => {
                          const key = `custom-${field.custom_field_id ?? idx}`;
                          return (
                            <PropertyPill
                              key={key}
                              pillKey={key}
                              label={getFieldLabel(field)}
                              selected={selectedKeys.includes(key)}
                              dotColor={getPropertyDotColor(idx)}
                              onClick={() => handleToggleKey(key)}
                            />
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <footer className="card-property-match-modal-footer">
          <button
            type="button"
            className="br-property-add-btn"
            disabled={selectedKeys.length === 0}
            onClick={handleApply}
          >
            Apply
          </button>
        </footer>
      </div>
    </Modal>
  );
}

CardFieldPickerModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onApply: PropTypes.func.isRequired,
  triggerTypeId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  actionTypeId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  allowedRegularFieldLabels: PropTypes.arrayOf(PropTypes.string),
};

const NOTIFICATION_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function NotificationSettingsModal({
  show, onClose, onSave, initialSettings, triggerTypeId,
  fetchedSettings, isLoadingSettings, users, getFieldDetails, fieldDetailsByKey,
  getRecipientCustomFields, recipientCustomFields,
}) {
  const [from, setFrom] = useState('');
  const [toRecipientError, setToRecipientError] = useState(false);
  const [ccRecipientError, setCcRecipientError] = useState(false);
  const [bodyContent, setBodyContent] = useState(() => new QuillDelta(DUMMY_NOTIFICATION_BODY_DELTA_OPS));
  const [showInternalUsersModal, setShowInternalUsersModal] = useState(false);
  const [internalUsersTarget, setInternalUsersTarget] = useState(null);
  const [showCustomFieldModal, setShowCustomFieldModal] = useState(false);
  const [customFieldTarget, setCustomFieldTarget] = useState(null);
  const [showCardFieldModal, setShowCardFieldModal] = useState(false);
  const [cardFieldTarget, setCardFieldTarget] = useState(null);
  const quillRef = useRef(null);
  const quillWrapRef = useRef(null);
  const subjectBoxRef = useRef(null);
  const toBoxRef = useRef(null);
  const ccBoxRef = useRef(null);

  const { saveNotificationSettings, updateNotificationSettings, isSavingNotificationSettings } = useBusinessRuleReducer((s) => s);
  const { workspaces, listAllWorkspaces } = useWorkSpaceReducer((s) => s);

  // get_custom_fields comes back empty when called unscoped (see the DUMMY_CUSTOM_FIELDS
  // fallback in CustomFieldPickerModal, needed for the exact same reason) — it only ever
  // returns real data when filtered by board_ids. A saved recipient custom field can belong
  // to any board, not just whichever one was selected in the picker at add-time and never
  // persisted back, so every known board id has to be sent to have a chance of covering it.
  useEffect(() => {
    if (!show) return;
    if (workspaces.length === 0) listAllWorkspaces();
  }, [show]);
  const allBoardIds = workspaces.flatMap((w) => (w.boards ?? []).map((b) => b.board_id));

  // A previously-saved notify action carries a backend notification_id: its To/Cc/Subject/Body
  // come from get_notification_settings (user + custom-field ids) instead of the plain
  // label tokens used while building the rule locally.
  const toUserIds = fetchedSettings?.to_users ?? [];
  const toCustomFieldIds = fetchedSettings?.to_custom_fields ?? [];
  const toEmails = fetchedSettings?.to_emails ?? [];
  const ccUserIds = fetchedSettings?.cc_users ?? [];
  const ccCustomFieldIds = fetchedSettings?.cc_custom_fields ?? [];
  const ccEmails = fetchedSettings?.cc_emails ?? [];

  useEffect(() => {
    if (!show || !fetchedSettings) return;
    [...toCustomFieldIds, ...ccCustomFieldIds].forEach((fieldId) => {
      if (fieldId == null) return;
      if (fieldDetailsByKey[`custom-${fieldId}`] !== undefined) return;
      getFieldDetails('custom', fieldId);
    });
  }, [show, fetchedSettings]);

  // get_field_details/custom/{id} (above) only ever returns operator/config info, never a
  // display label — it's used everywhere else purely for a condition row's operator
  // dropdown, and getFieldLabel(details) on its response reliably comes back empty, which
  // is why a saved custom-field recipient pill was stuck showing the raw numeric id forever
  // instead of its name. The custom-fields list (same endpoint the "add custom fields"
  // picker uses, which does return real labels) is the reliable source instead — but only
  // once board_ids is sent (see allBoardIds above), so wait for workspaces to load first.
  useEffect(() => {
    if (!show || !fetchedSettings) return;
    if (toCustomFieldIds.length === 0 && ccCustomFieldIds.length === 0) return;
    if (allBoardIds.length === 0) return;
    getRecipientCustomFields({ params: { trigger_type_id: triggerTypeId, board_ids: allBoardIds } });
  }, [show, fetchedSettings, allBoardIds.length]);

  const recipientCustomFieldById = new Map(
    (recipientCustomFields ?? []).map((field) => [String(field.custom_field_id), field])
  );

  // Tokens keep their backend id (not just the display label) so a resave of
  // untouched to/cc tokens still sends valid to_users/to_custom_fields ids.
  //
  // `users` is the non-vendor user list (get_non_vendor_users) — a saved to_users/cc_users
  // id can reference a user outside that list (vendor, deactivated, paginated out, ...), in
  // which case .find() below finds nothing. That must still render as a pill (falling back
  // to a placeholder label, same as resolveCustomFieldTokens does for an unresolved field)
  // rather than being silently dropped — dropping it is what made saved CC recipients
  // disappear on reopen even though the backend still had them.
  const resolveUserTokens = (userIds) => userIds.map((userId) => {
    const user = (users ?? []).find((u) => String(u.user_id) === String(userId));
    return { label: user ? user.name : `User #${userId}`, id: userId, type: 'user' };
  });

  const resolveCustomFieldTokens = (fieldIds) => fieldIds.map((fieldId) => {
    const listField = recipientCustomFieldById.get(String(fieldId));
    const details = fieldDetailsByKey[`custom-${fieldId}`];
    // Placeholder while recipientCustomFields/get_field_details are still in flight (first
    // open of an action with saved custom-field recipients) — never the raw numeric id,
    // which reads like broken/leaked data to the user. Patched in place once resolved.
    const label = (listField && getFieldLabel(listField)) || (details && getFieldLabel(details)) || '…';
    return { label, id: fieldId, type: 'field' };
  });

  // Populated from the same non-vendor users list the To/Cc pickers use, so "From"
  // becomes a real dropdown instead of the single fixed address it showed before.
  const realFromOptions = (users ?? [])
    .filter((u) => u.email)
    .map((u) => ({ value: u.email, label: u.name ? `${u.name} (${u.email})` : u.email }));
  const fromOptions = realFromOptions.length > 0
    ? realFromOptions
    : [{ value: DUMMY_NOTIFICATION_FROM_EMAIL, label: DUMMY_NOTIFICATION_FROM_EMAIL }];

  const resolveEmailTokens = (emails) => emails.map((email) => ({ label: email, id: null, type: 'email' }));

  useEffect(() => {
    if (!show) return;
    if (fetchedSettings) {
      setFrom(fetchedSettings.from_email ?? '');
      setBodyContent(fetchedSettings.body || new QuillDelta(DUMMY_NOTIFICATION_BODY_DELTA_OPS));
    } else {
      setFrom(initialSettings?.from ?? '');
      setBodyContent(initialSettings?.bodyContent ?? new QuillDelta(DUMMY_NOTIFICATION_BODY_DELTA_OPS));
    }
    setToRecipientError(false);
    setCcRecipientError(false);
    setShowInternalUsersModal(false);
    setInternalUsersTarget(null);
    setShowCustomFieldModal(false);
    setCustomFieldTarget(null);
    setShowCardFieldModal(false);
    setCardFieldTarget(null);
  }, [show, initialSettings, fetchedSettings]);

  // A recipient pill is a non-editable atomic node inside the contentEditable To/Cc box,
  // carrying its backend id/type as data attributes so parseRecipientTokens can read them
  // back out at save time. No remove button — it's removed the same way any other atomic
  // contentEditable=false node is, via Backspace/Delete.
  const buildRecipientPill = (label, type, id) => {
    const span = document.createElement('span');
    span.className = `notification-user-pill notification-user-pill--${type}`;
    span.contentEditable = 'false';
    span.dataset.tokenType = type;
    span.dataset.tokenId = id != null ? String(id) : '';
    span.dataset.label = label;
    span.appendChild(document.createTextNode(label));

    return span;
  };

  // Identity is the backend id (type + id), not the display label: two different
  // internal users (or two different custom fields) can share the exact same label
  // (e.g. a generic shared account name like "GRO user" used by more than one
  // record) — matching by label alone would treat the second, distinct one as a
  // duplicate and silently refuse to add it. Only typed emails (id: null) have no
  // backend id to key on, so those still fall back to matching by label/address.
  const isDuplicateRecipientToken = (el, { label, type, id }) => Array.from(el.querySelectorAll('.notification-user-pill'))
    .some((pillEl) => (id != null
      ? pillEl.dataset.tokenType === type && pillEl.dataset.tokenId === String(id)
      : pillEl.dataset.label === label));

  // To/Cc are contentEditable boxes (same pattern as Subject below) so the browser's own
  // caret placement handles "click anywhere to type" natively — no custom position tracking,
  // and nothing shifts until the user actually types. Seeded once per open, same as Subject.
  //
  // Deliberately NOT depending on fieldDetailsByKey/users: getFieldDetails (above) resolves
  // custom-field labels asynchronously after the modal opens, and each resolution hands back
  // a new fieldDetailsByKey reference. Reseeding on that would call replaceChildren() again
  // moments after the box first renders — wiping out anything already typed/clicked into,
  // which is exactly what made typing look completely broken.
  useLayoutEffect(() => {
    if (!show) return;
    const toEl = toBoxRef.current;
    const ccEl = ccBoxRef.current;
    if (!toEl || !ccEl) return;
    toEl.replaceChildren();
    ccEl.replaceChildren();

    // initialSettings.to/cc (set by handleSaveNotificationSettings right after a save, from
    // parseRecipientTokens reading the box that was just on screen) already carries correct
    // labels for every token, custom fields included — unlike fetchedSettings, which only
    // carries raw ids that still need an async label lookup. Re-resolving from fetchedSettings
    // whenever it's present (the old behavior) clobbered those already-correct pills with '…'
    // placeholders on every reopen right after a save, and only ever got patched back if/when
    // that lookup resolved — this is why a saved custom-field recipient looked stuck on
    // reopen. initialSettings.to is only undefined the very first time a notify action's
    // settings are opened (never saved this session yet), which is the one case that still
    // needs the id-based fetchedSettings resolution below.
    const seedTo = initialSettings?.to !== undefined
      ? initialSettings.to
      : (fetchedSettings
        ? [...resolveUserTokens(toUserIds), ...resolveCustomFieldTokens(toCustomFieldIds), ...resolveEmailTokens(toEmails)]
        : []);
    const seedCc = initialSettings?.cc !== undefined
      ? initialSettings.cc
      : (fetchedSettings
        ? [...resolveUserTokens(ccUserIds), ...resolveCustomFieldTokens(ccCustomFieldIds), ...resolveEmailTokens(ccEmails)]
        : []);

    // A trailing space (real text node) after every pill gives the browser a valid
    // caret anchor next to it — back-to-back pills with nothing but CSS gap between
    // them leave no landing spot for a click, which is what made typing near/between
    // existing pills seem completely dead.
    seedTo.forEach((token) => {
      toEl.appendChild(buildRecipientPill(token.label, token.type, token.id));
      toEl.appendChild(document.createTextNode(' '));
    });
    seedCc.forEach((token) => {
      ccEl.appendChild(buildRecipientPill(token.label, token.type, token.id));
      ccEl.appendChild(document.createTextNode(' '));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, initialSettings, fetchedSettings]);

  // Custom-field pills seeded above before recipientCustomFields/get_field_details resolve
  // render with the raw field id as a placeholder (see resolveCustomFieldTokens). The
  // seeding effect deliberately doesn't re-run when those update (that would wipe anything
  // typed/clicked in since), so once a label resolves, patch just those specific pills in
  // place instead of re-seeding the whole box.
  useEffect(() => {
    if (!show) return;
    [toBoxRef.current, ccBoxRef.current].forEach((boxEl) => {
      if (!boxEl) return;
      boxEl.querySelectorAll('.notification-user-pill--field').forEach((pillEl) => {
        const fieldId = pillEl.dataset.tokenId;
        if (!fieldId) return;
        const listField = recipientCustomFieldById.get(fieldId);
        const details = fieldDetailsByKey[`custom-${fieldId}`];
        const resolvedLabel = (listField && getFieldLabel(listField)) || (details && getFieldLabel(details));
        if (!resolvedLabel || resolvedLabel === pillEl.dataset.label) return;
        pillEl.dataset.label = resolvedLabel;
        pillEl.textContent = resolvedLabel;
      });
    });
  }, [show, fieldDetailsByKey, recipientCustomFields]);

  // Same idea for user pills: seeded above with a "User #<id>" placeholder when the
  // non-vendor users list hadn't loaded yet at seed time (see resolveUserTokens) — once
  // it does, patch those specific pills to the real name in place.
  useEffect(() => {
    if (!show) return;
    [toBoxRef.current, ccBoxRef.current].forEach((boxEl) => {
      if (!boxEl) return;
      boxEl.querySelectorAll('.notification-user-pill--user').forEach((pillEl) => {
        const userId = pillEl.dataset.tokenId;
        if (!userId) return;
        const user = (users ?? []).find((u) => String(u.user_id) === String(userId));
        if (!user || user.name === pillEl.dataset.label) return;
        pillEl.dataset.label = user.name;
        pillEl.textContent = user.name;
      });
    });
  }, [show, users]);

  // Mirrors buildRecipientPill: a non-editable field pill, with the value kept in a
  // data attribute (not just textContent) so parseSubjectParts can read it back. No
  // remove button — removed via Backspace/Delete like any other atomic node.
  const buildSubjectFieldPill = (value) => {
    const span = document.createElement('span');
    span.className = 'notification-pill';
    span.contentEditable = 'false';
    span.dataset.fieldValue = value;
    span.appendChild(document.createTextNode(value));

    return span;
  };

  // Subject is a contentEditable box (free-typed text interleaved with non-editable
  // "card field" pills) rather than a controlled input, so its DOM only needs seeding
  // once per open — re-rendering it from React state on every keystroke would fight the
  // browser's own cursor position.
  useLayoutEffect(() => {
    if (!show) return;
    const el = subjectBoxRef.current;
    if (!el) return;
    el.replaceChildren();
    const subjectParts = fetchedSettings
      ? parseSubjectString(fetchedSettings.subject ?? '')
      : (initialSettings?.subjectParts ?? DUMMY_NOTIFICATION_SUBJECT_PARTS);
    subjectParts.forEach((part) => {
      if (part.type === 'pill') {
        el.appendChild(buildSubjectFieldPill(part.value));
      } else {
        el.appendChild(document.createTextNode(part.value));
      }
    });
  }, [show, initialSettings, fetchedSettings]);

  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill || quill._pillMatcherAdded) return;
    quill.clipboard.addMatcher('span.notification-pill', (node) => new QuillDelta().insert({ pill: node.dataset.fieldValue ?? node.textContent }));
    quill._pillMatcherAdded = true;
  }, [show]);

  // Always appends at the end of the box — never at the caret position. Inserting into
  // an arbitrary caret risked landing inside/around an existing pill (contentEditable=false
  // "island" nested in the editable box triggers several browser caret quirks: selecting
  // the box's entire content, or trapping the caret inside the pill's own DOM node), which
  // could silently wipe or orphan existing pills. Appending is always a plain, direct-child
  // insert with no such risk.
  const insertRecipientPills = (boxEl, items, type) => {
    if (!boxEl) return;
    items.forEach((item) => {
      if (isDuplicateRecipientToken(boxEl, { label: item.label, type, id: item.id ?? null })) return;
      const pill = buildRecipientPill(item.label, type, item.id ?? null);
      boxEl.appendChild(pill);
      boxEl.appendChild(document.createTextNode(' '));
    });
    boxEl.focus();
  };

  // Enter/comma turns the plain text the user just typed (since the last pill or the
  // start of the box) into an email pill in place, mirroring handleAddSubjectField's
  // Selection API usage but replacing text instead of inserting at an empty point.
  const commitTypedRecipient = (boxEl, setError) => {
    if (!boxEl) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    if (!boxEl.contains(node) || node.nodeType !== Node.TEXT_NODE) return;

    const offset = range.startOffset;
    const fullText = node.textContent;
    const before = fullText.slice(0, offset);
    const after = fullText.slice(offset);
    const trimmed = before.trim().replace(/,+$/, '').trim();
    if (!trimmed) return;

    if (isDuplicateRecipientToken(boxEl, { label: trimmed, type: 'email', id: null })) {
      node.textContent = after;
      setError(false);
      return;
    }
    if (!NOTIFICATION_EMAIL_REGEX.test(trimmed)) {
      setError(true);
      return;
    }

    const pill = buildRecipientPill(trimmed, 'email', null);
    const parent = node.parentNode;
    parent.insertBefore(pill, node);
    const spaceNode = document.createTextNode(' ');
    parent.insertBefore(spaceNode, node);
    if (after === '') {
      node.remove();
    } else {
      node.textContent = after;
    }
    const newRange = document.createRange();
    newRange.setStartAfter(spaceNode);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);
    setError(false);
  };

  const handleRecipientKeyDown = (boxRef, setError) => (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitTypedRecipient(boxRef.current, setError);
    }
  };

  const handleOpenInternalUsersModal = (target) => {
    setInternalUsersTarget(target);
    setShowInternalUsersModal(true);
  };

  const handleApplyInternalUsers = (items) => {
    insertRecipientPills((internalUsersTarget === 'cc' ? ccBoxRef : toBoxRef).current, items, 'user');
    setInternalUsersTarget(null);
  };

  const handleOpenCustomFieldModal = (target) => {
    setCustomFieldTarget(target);
    setShowCustomFieldModal(true);
  };

  const handleApplyCustomField = (items) => {
    insertRecipientPills((customFieldTarget === 'cc' ? ccBoxRef : toBoxRef).current, items, 'field');
    setCustomFieldTarget(null);
  };

  // Mirrors handleAddBodyField's cursor-based insert, but the subject box is a plain
  // contentEditable div (not Quill), so the caret is managed via the Selection API.
  // Wrapped in literal "{"/"}" text nodes to match the placeholder-token look every
  // other card field pill in the subject uses (see DUMMY_NOTIFICATION_SUBJECT_PARTS).
  const handleAddSubjectField = (field) => {
    const el = subjectBoxRef.current;
    if (!el) return;
    const openBrace = document.createTextNode('{');
    const span = buildSubjectFieldPill(field);
    const closeBrace = document.createTextNode('}');

    const selection = window.getSelection();
    const existingRange = selection?.rangeCount > 0 && el.contains(selection.getRangeAt(0).commonAncestorContainer)
      ? selection.getRangeAt(0)
      : null;
    if (existingRange) {
      existingRange.deleteContents();
      const fragment = document.createDocumentFragment();
      fragment.append(openBrace, span, closeBrace);
      existingRange.insertNode(fragment);
    } else {
      el.appendChild(openBrace);
      el.appendChild(span);
      el.appendChild(closeBrace);
    }

    el.focus();
    const newRange = document.createRange();
    newRange.setStartAfter(closeBrace);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);
  };

  const handleAddBodyField = (field) => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const index = quill.getSelection(true)?.index ?? quill.getLength();
    // Embeds always occupy exactly one Delta position, unlike the field's text length.
    quill.insertEmbed(index, 'pill', field);
    quill.insertText(index + 1, ' ');
    quill.setSelection(index + 2, 0);
  };

  const handleOpenCardFieldModal = (target) => {
    setCardFieldTarget(target);
    setShowCardFieldModal(true);
  };

  const handleApplyCardField = (fieldLabels) => {
    fieldLabels.forEach((label) => {
      if (cardFieldTarget === 'body') {
        handleAddBodyField(label);
      } else {
        handleAddSubjectField(label);
      }
    });
    setCardFieldTarget(null);
  };

  // Subject isn't tracked in React state (see the layout effect above), so it's read
  // straight off the contentEditable DOM at save time. Reads the field value from
  // data-field-value rather than textContent, since the pill also carries a "×"
  // remove button whose own text would otherwise leak in.
  const parseSubjectParts = (el) => {
    if (!el) return [];
    return Array.from(el.childNodes).reduce((acc, node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent) acc.push({ type: 'text', value: node.textContent });
      } else if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('notification-pill')) {
        acc.push({ type: 'pill', value: node.dataset.fieldValue ?? node.textContent });
      }
      return acc;
    }, []);
  };

  // Pill tokens are rendered inline as their label text — there's no template/placeholder
  // syntax defined for the notification subject or body, so what's shown in the editor is
  // exactly what gets sent.
  const subjectPartsToText = (parts) => parts.map((part) => part.value).join('');

  // To/Cc aren't tracked in React state either (see the layout effect above) — read
  // straight off their contentEditable DOM at save time. Any left-over plain text (typed
  // but never confirmed with Enter/comma) is opportunistically picked up here too, so it
  // isn't silently lost just because Save was clicked instead.
  const parseRecipientTokens = (el) => {
    if (!el) return [];
    const acc = [];
    // querySelectorAll (not just direct childNodes): inserting a pill next to an
    // existing contentEditable=false pill can land the caret *inside* that existing
    // pill's own DOM node (a browser caret-trap quirk around non-editable islands —
    // see the getSemanticHTML() comment on bodyContentToText for the same issue in
    // Quill). A pill nested that way is still a real selected recipient and must not
    // be silently dropped from the save payload just because it isn't a direct child.
    el.querySelectorAll('.notification-user-pill').forEach((node) => {
      const rawId = node.dataset.tokenId;
      const id = rawId ? (Number.isNaN(Number(rawId)) ? rawId : Number(rawId)) : null;
      acc.push({ label: node.dataset.label ?? node.textContent, id, type: node.dataset.tokenType });
    });
    Array.from(el.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const trimmed = node.textContent.trim().replace(/,+$/, '').trim();
        if (trimmed && NOTIFICATION_EMAIL_REGEX.test(trimmed) && !acc.some((t) => t.label === trimmed)) {
          acc.push({ label: trimmed, id: null, type: 'email' });
        }
      }
    });
    return acc;
  };

  // ReactQuill's onChange is wired directly to setBodyContent, so bodyContent is an HTML
  // string once the user has typed anything; it's only ever the initial Delta before that.
  // That onChange string is Quill's live root.innerHTML, which — for contenteditable=false
  // embeds like the pill blot — can include the browser's own caret-trap artifacts (an
  // extra nested span and stray zero-width characters Blink inserts so the cursor has
  // somewhere to land next to a non-editable node). Prefer quill.getSemanticHTML() at save
  // time instead: it re-serializes straight from each blot's own create(), producing the
  // same clean markup the pill blot actually defines, with no browser-DOM noise baked in.
  const bodyContentToText = (content) => {
    const quill = quillRef.current?.getEditor();
    if (quill) return quill.getSemanticHTML();
    if (typeof content === 'string') return content;
    if (content?.ops) {
      return content.ops
        .map((op) => (typeof op.insert === 'string' ? op.insert : (op.insert?.pill ?? '')))
        .join('');
    }
    return '';
  };

  const handleSave = () => {
    const subjectParts = parseSubjectParts(subjectBoxRef.current);
    const fromEmail = from || fromOptions[0].value;
    const toTokens = parseRecipientTokens(toBoxRef.current);
    const ccTokens = parseRecipientTokens(ccBoxRef.current);
    const payload = {
      from_email: fromEmail,
      to_users: toTokens.filter((t) => t.type === 'user' && t.id != null).map((t) => t.id),
      to_custom_fields: toTokens.filter((t) => t.type === 'field' && t.id != null).map((t) => t.id),
      to_emails: toTokens.filter((t) => t.type === 'email').map((t) => t.label),
      cc_users: ccTokens.filter((t) => t.type === 'user' && t.id != null).map((t) => t.id),
      cc_custom_fields: ccTokens.filter((t) => t.type === 'field' && t.id != null).map((t) => t.id),
      cc_emails: ccTokens.filter((t) => t.type === 'email').map((t) => t.label),
      subject: subjectPartsToText(subjectParts),
      body: bodyContentToText(bodyContent),
    };

    // A notify action that already has a notification_id (fetchedSettings was loaded
    // for it in handleOpenNotificationSettings) was previously saved on the backend, so
    // resaving it must update that record instead of creating a duplicate one.
    const existingNotificationId = initialSettings?.notification_id;
    if (existingNotificationId) {
      updateNotificationSettings(existingNotificationId, payload, {
        cb: () => {
          onSave({ from: fromEmail, to: toTokens, cc: ccTokens, subjectParts, bodyContent, notificationId: existingNotificationId });
          onClose();
        },
      });
    } else {
      saveNotificationSettings(payload, {
        // The create response's id has shown up both flat ({ notification_id }, matching
        // the web-service/create-subtask siblings) and nested under data.data (matching
        // get_notification_settings' own shape) depending on backend build — check both so
        // a mismatch here doesn't silently drop the id and break every later GET/update/delete
        // for this action (symptom: reopening shows blank fields, "Remove" doesn't call the API).
        cb: (data) => {
          const notificationId = data?.notification_id ?? data?.data?.notification_id ?? null;
          onSave({ from: fromEmail, to: toTokens, cc: ccTokens, subjectParts, bodyContent, notificationId });
          onClose();
        },
      });
    }
  };

  // Subject is a single-line field: block Enter from inserting a paragraph break, and
  // strip formatting from pasted content so the box only ever holds text + pill nodes
  // (anything else would be silently dropped by parseSubjectParts anyway).
  const handleSubjectKeyDown = (e) => {
    if (e.key === 'Enter') e.preventDefault();
  };

  const handleSubjectPaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  const quillModules = useMemo(() => ({
    table: false,
    toolbar: [
      [{ font: [] }, { size: ['small', false, 'large', 'huge'] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ color: [] }, { background: [] }],
      [{ align: [] }],
      ['link'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['image', 'table-better'],
      ['clean'],
    ],
    'table-better': {
      language: 'en_US',
      menus: ['column', 'row', 'merge', 'table', 'cell', 'wrap', 'delete'],
      toolbarTable: true,
    },
    keyboard: { bindings: QuillTableBetter.keyboardBindings },
  }), []);

  useLayoutEffect(() => {
    if (!show) return undefined;
    const toolbar = quillWrapRef.current?.querySelector('.ql-toolbar');
    if (!toolbar) return undefined;
    return attachToolbarOverflow(toolbar);
  }, [show]);

  return (
    <>
    <Modal
      show={show}
      onHide={onClose}
      className="card-property-match-modal notification-settings-modal"
      dialogClassName="card-property-match-modal-dialog notification-settings-modal-dialog"
      backdropClassName="card-property-match-modal-backdrop"
      centered
      scrollable
    >
      <div className="card-property-match-modal-shell">
        <header className="card-property-match-modal-header">
          <h2 className="card-property-match-modal-title">Notification Message Settings</h2>
          <button
            type="button"
            className="business-rule-form-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <FiX size={20} />
          </button>
        </header>

        <div className="card-property-match-modal-body notification-settings-body">
          <div className="notification-field">
            <label className="business-rule-form-label">From:</label>
            <div className="business-rule-form-select-wrap">
              <select
                className="business-rule-form-select"
                value={from || fromOptions[0].value}
                onChange={(e) => setFrom(e.target.value)}
              >
                {fromOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <FiChevronDown className="business-rule-form-select-icon" aria-hidden />
            </div>
          </div>

          <div className="notification-field">
            <div className="notification-field-head">
              <label className="business-rule-form-label">To:</label>
              <div className="notification-field-actions">
                <button
                  type="button"
                  className="notification-dropdown-trigger"
                  onClick={() => handleOpenInternalUsersModal('to')}
                >
                  add internal users <FiChevronDown size={12} aria-hidden />
                </button>
                <button
                  type="button"
                  className="notification-dropdown-trigger"
                  onClick={() => handleOpenCustomFieldModal('to')}
                >
                  add custom fields <FiChevronDown size={12} aria-hidden />
                </button>
              </div>
            </div>
            <div
              ref={toBoxRef}
              className={`notification-subject-box notification-subject-box--editable${toRecipientError ? ' notification-subject-box--invalid' : ''}`}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="false"
              aria-label="To recipients"
              data-placeholder="Type an email and press Enter"
              onInput={() => setToRecipientError(false)}
              onKeyDown={handleRecipientKeyDown(toBoxRef, setToRecipientError)}
            />
            {toRecipientError && <p className="notification-field-error">Enter a valid email address.</p>}
          </div>

          <div className="notification-field">
            <div className="notification-field-head">
              <label className="business-rule-form-label">Cc:</label>
              <div className="notification-field-actions">
                <button
                  type="button"
                  className="notification-dropdown-trigger"
                  onClick={() => handleOpenInternalUsersModal('cc')}
                >
                  add internal users <FiChevronDown size={12} aria-hidden />
                </button>
                <button
                  type="button"
                  className="notification-dropdown-trigger"
                  onClick={() => handleOpenCustomFieldModal('cc')}
                >
                  add custom fields <FiChevronDown size={12} aria-hidden />
                </button>
              </div>
            </div>
            <div
              ref={ccBoxRef}
              className={`notification-subject-box notification-subject-box--editable${ccRecipientError ? ' notification-subject-box--invalid' : ''}`}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="false"
              aria-label="Cc recipients"
              data-placeholder="Type an email and press Enter"
              onInput={() => setCcRecipientError(false)}
              onKeyDown={handleRecipientKeyDown(ccBoxRef, setCcRecipientError)}
            />
            {ccRecipientError && <p className="notification-field-error">Enter a valid email address.</p>}
          </div>

          <div className="notification-field">
            <div className="notification-field-head">
              <label className="business-rule-form-label">Subject:</label>
              <div className="notification-field-actions">
                <button
                  type="button"
                  className="notification-dropdown-trigger"
                  onClick={() => handleOpenCardFieldModal('subject')}
                >
                  add card fields <FiChevronDown size={12} aria-hidden />
                </button>
              </div>
            </div>
            <div
              ref={subjectBoxRef}
              className="notification-subject-box notification-subject-box--editable"
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="false"
              aria-label="Notification subject"
              onKeyDown={handleSubjectKeyDown}
              onPaste={handleSubjectPaste}
            />
          </div>

          <div className="notification-field">
            <div className="notification-field-head">
              <label className="business-rule-form-label">Body:</label>
            </div>
            <div className="notification-quill-wrap" ref={quillWrapRef}>
              <ReactQuill ref={quillRef} theme="snow" modules={quillModules} value={bodyContent} onChange={setBodyContent} />
            </div>
          </div>
        </div>

        <footer className="card-property-match-modal-footer">
          <button type="button" className="br-property-add-btn" onClick={handleSave} disabled={isLoadingSettings || isSavingNotificationSettings}>
            {isSavingNotificationSettings ? 'Saving...' : (isLoadingSettings ? 'Loading...' : (initialSettings?.notification_id ? 'Update' : 'Save'))}
          </button>
        </footer>
      </div>
    </Modal>

    <InternalUsersPickerModal
      show={showInternalUsersModal}
      onClose={() => setShowInternalUsersModal(false)}
      onApply={handleApplyInternalUsers}
    />

    <CustomFieldPickerModal
      show={showCustomFieldModal}
      onClose={() => setShowCustomFieldModal(false)}
      onApply={handleApplyCustomField}
      triggerTypeId={triggerTypeId}
    />

    <CardFieldPickerModal
      show={showCardFieldModal}
      onClose={() => setShowCardFieldModal(false)}
      onApply={handleApplyCardField}
      triggerTypeId={triggerTypeId}
    />
    </>
  );
}

function SelectFieldModal({ show, onClose, onSelect, fields }) {
  const [filterText, setFilterText] = useState('');
  const [expanded, setExpanded] = useState(true);
  const [selectedFields, setSelectedFields] = useState([]);

  useEffect(() => {
    if (!show) return;
    setFilterText('');
    setExpanded(true);
    setSelectedFields([]);
  }, [show]);

  const filterQuery = filterText.trim().toLowerCase();
  const filteredFields = filterQuery
    ? fields.filter((f) => f.toLowerCase().includes(filterQuery))
    : fields;

  const toggleField = (field) => {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  };

  const handleApply = () => {
    if (selectedFields.length === 0) return;
    onSelect(selectedFields);
    onClose();
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      className="card-property-match-modal"
      dialogClassName="card-property-match-modal-dialog"
      backdropClassName="card-property-match-modal-backdrop"
      centered
      scrollable
    >
      <div className="card-property-match-modal-shell br-floating-close-shell">
        <button
          type="button"
          className="br-floating-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          <FiX size={16} />
        </button>

        <header className="card-property-match-modal-header br-floating-close-header">
          <h2 className="card-property-match-modal-title">Select fields</h2>
        </header>

        <div className="card-property-match-modal-body">
          <input
            type="text"
            className="br-property-filter-input"
            placeholder="Filter"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            autoFocus
          />

          <div className="br-property-section">
            <button
              type="button"
              className="br-property-section-toggle"
              onClick={() => setExpanded((v) => !v)}
            >
              <span className="br-property-section-toggle-icon">
                {expanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
              </span>
              Regular fields
            </button>
            {expanded && (
              <div className="br-property-pill-grid">
                {filteredFields.length === 0 ? (
                  <div className="br-property-picker-empty">No fields found</div>
                ) : (
                  filteredFields.map((field) => (
                    <PropertyPill
                      key={field}
                      pillKey={field}
                      label={field}
                      selected={selectedFields.includes(field)}
                      onClick={() => toggleField(field)}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <footer className="card-property-match-modal-footer">
          <button
            type="button"
            className="br-property-add-btn"
            disabled={selectedFields.length === 0}
            onClick={handleApply}
          >
            Apply{selectedFields.length > 0 ? ` (${selectedFields.length})` : ''}
          </button>
        </footer>
      </div>
    </Modal>
  );
}

SelectFieldModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
  fields: PropTypes.arrayOf(PropTypes.string).isRequired,
};

const makeInvokeRowId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// The service invoke rows always keep one blank trailing row so the user can
// start typing directly into it, instead of clicking a separate "Add" link.
const isBlankHeaderRow = (row) => !row.key.trim() && !row.value.trim();
const isBlankParamRow = (row) => !row.key.trim() && !row.value.trim() && row.fields.length === 0;

const withTrailingBlankHeader = (list) =>
  (list.length === 0 || !isBlankHeaderRow(list[list.length - 1]))
    ? [...list, { id: makeInvokeRowId(), key: '', value: '' }]
    : list;

const withTrailingBlankParam = (list) =>
  (list.length === 0 || !isBlankParamRow(list[list.length - 1]))
    ? [...list, { id: makeInvokeRowId(), key: '', value: '', fields: [] }]
    : list;

// POST/PUT/PATCH/DELETE requests automatically carry a default parameter with
// the triggering card's information; GET requests have no body to carry it in.
const DEFAULT_PAYLOAD_KEY = 'kanbanize_payload';
const DEFAULT_PAYLOAD_FIELD = 'Kanbanize Payload';
const isDefaultPayloadRow = (row) => row.key === DEFAULT_PAYLOAD_KEY && row.fields.length === 1 && row.fields[0] === DEFAULT_PAYLOAD_FIELD;

const withDefaultPayloadRow = (list, supportsBody) => {
  const hasDefault = list.some(isDefaultPayloadRow);
  if (supportsBody && !hasDefault) {
    return [{ id: makeInvokeRowId(), key: DEFAULT_PAYLOAD_KEY, value: '', fields: [DEFAULT_PAYLOAD_FIELD] }, ...list];
  }
  if (!supportsBody && hasDefault) {
    return list.filter((row) => !isDefaultPayloadRow(row));
  }
  return list;
};

// The default payload row is only auto-seeded the first time an invoke action
// is configured. Once the action has been saved at least once (its params were
// persisted, e.g. the user deliberately deleted the default row), that choice
// is respected instead of silently re-adding the row on every reopen/re-save.
const buildInitialInvokeParams = (initialParams, supportsBody, hasSavedParams) =>
  withTrailingBlankParam(
    hasSavedParams ? (initialParams ?? []) : withDefaultPayloadRow(initialParams ?? [], supportsBody)
  );

// Card fields inserted into the Url are stored inline as "{Field Name}" tokens in the
// saved url string (so the shape stays a plain string on the wire), but edited as an
// ordered mix of free text and non-editable pill nodes in a contentEditable box — like
// the notification Subject field — so text can be typed before, after, or in between
// existing field pills instead of pills always trailing at the end.
const URL_FIELD_TOKEN_RE = /\{([^}]+)\}/g;
const parseUrlTokenString = (rawUrl) => {
  const str = rawUrl ?? '';
  const parts = [];
  let lastIndex = 0;
  let match;
  URL_FIELD_TOKEN_RE.lastIndex = 0;
  while ((match = URL_FIELD_TOKEN_RE.exec(str))) {
    if (match.index > lastIndex) parts.push({ type: 'text', value: str.slice(lastIndex, match.index) });
    parts.push({ type: 'pill', value: match[1] });
    lastIndex = URL_FIELD_TOKEN_RE.lastIndex;
  }
  if (lastIndex < str.length) parts.push({ type: 'text', value: str.slice(lastIndex) });
  return parts;
};
const urlPartsToString = (parts) => parts.map((part) => (part.type === 'pill' ? `{${part.value}}` : part.value)).join('');
// Mirrors NotificationSettingsModal's parseSubjectParts, scoped to the Url box.
// Reads the field value from data-field-value rather than textContent, since the
// pill also carries a "×" remove button whose own text would otherwise leak in.
const parseUrlBoxParts = (el) => {
  if (!el) return [];
  return Array.from(el.childNodes).reduce((acc, node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent) acc.push({ type: 'text', value: node.textContent });
    } else if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('notification-pill')) {
      acc.push({ type: 'pill', value: node.dataset.fieldValue ?? node.textContent });
    }
    return acc;
  }, []);
};

// Mirrors buildRecipientPill/buildSubjectFieldPill: a non-editable field pill with
// its own "×" remove button, so a selected field can be deleted in one click instead
// of relying on contentEditable backspace. The value is kept in a data attribute
// (not just textContent) so parseUrlBoxParts can read it back without the "×".
const buildUrlFieldPill = (value) => {
  const span = document.createElement('span');
  span.className = 'notification-pill br-invoke-value-pill';
  span.contentEditable = 'false';
  span.dataset.fieldValue = value;
  span.appendChild(document.createTextNode(value));

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'br-invoke-value-pill-remove';
  removeBtn.setAttribute('aria-label', `Remove ${value}`);
  removeBtn.textContent = '×';
  span.appendChild(removeBtn);

  return span;
};

// The Params value box keeps its simpler "either a plain value or a set of field
// pills" model (unlike the Url box above) — this join is only used to serialize a
// param row's field pills into the same inline "{Field Name}" token shape the Url
// box and the backend both expect.
const joinUrlFields = (base, fields) => base + fields.map((f) => `{${f}}`).join('');

// get_web_service_settings returns headers/params ordered by display_order with
// their own header_id/param_id — remapped here to the row shape the form state
// (and makeInvokeRowId-generated local rows) both use.
const sortByDisplayOrder = (list) => [...list].sort((a, b) => Number(a.display_order ?? 0) - Number(b.display_order ?? 0));
const mapFetchedHeaders = (headers) => sortByDisplayOrder(headers ?? [])
  .map((h) => ({ id: h.header_id, key: h.header_key ?? '', value: h.header_value ?? '' }));
const mapFetchedParams = (params) => sortByDisplayOrder(params ?? [])
  .map((p) => ({ id: p.param_id, key: p.param_key ?? '', value: p.param_value ?? '', fields: [] }));

// The invoked service's raw response_body is often a JSON error payload or an HTML
// error page rather than a plain string, so a generic "Request failed with status
// 405." message alone doesn't tell the user why. This pulls out the most useful bit
// (a nested message/error/detail field, or the stripped/truncated body as a fallback)
// to show alongside the generic message.
const MAX_TEST_ERROR_DETAIL_LENGTH = 300;
const extractTestErrorDetail = (responseBody) => {
  const raw = String(responseBody ?? '').trim();
  if (!raw) return '';

  let detail = raw;
  try {
    const parsed = JSON.parse(raw);
    detail = parsed?.message ?? parsed?.error ?? parsed?.error_description ?? parsed?.detail ?? JSON.stringify(parsed);
  } catch {
    detail = stripHtmlTags(raw);
  }

  return detail.length > MAX_TEST_ERROR_DETAIL_LENGTH
    ? `${detail.slice(0, MAX_TEST_ERROR_DETAIL_LENGTH)}…`
    : detail;
};

// data.message on a failed test is the backend's raw exception text (e.g. a Guzzle
// "Client error: `GET ...` resulted in a `401 UNAUTHORIZED` response" dump) — not
// something a non-technical user configuring a business rule can act on. Status code
// is the one reliably structured signal we get back, so it drives a plain-language
// message instead; the invoked service's own response detail (if any and reasonably
// short) is shown alongside it as the actionable specifics.
const TEST_ERROR_STATUS_MESSAGES = {
  400: 'The request was invalid. Please check the URL, headers, and parameters.',
  401: 'Authentication failed. Please check the username/password or API key.',
  403: 'Access denied. The service rejected this request.',
  404: 'The service URL could not be found. Please check the URL.',
  405: 'The service does not support this request method.',
  408: 'The request timed out. Please try again.',
  429: 'Too many requests were sent. Please try again later.',
  500: 'The service encountered an internal error.',
  502: 'The service is temporarily unreachable.',
  503: 'The service is currently unavailable. Please try again later.',
  504: 'The service took too long to respond.',
};
const getFriendlyTestErrorMessage = (statusCode) =>
  TEST_ERROR_STATUS_MESSAGES[statusCode]
  ?? (statusCode ? `The service returned an error (status ${statusCode}).` : 'The request could not be completed. Please check your service settings.');

function WebInvokeSettingsModal({ show, onClose, onSave, initialSettings, fetchedSettings, isLoadingSettings, triggerTypeId }) {
  const [serviceName, setServiceName] = useState('');
  const [method, setMethod] = useState(DUMMY_INVOKE_METHOD_OPTIONS[1]);
  const [authentication, setAuthentication] = useState(DUMMY_INVOKE_AUTH_OPTIONS[0]);
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authKeyHeaderName, setAuthKeyHeaderName] = useState('');
  const [authKeyHeaderValue, setAuthKeyHeaderValue] = useState('');
  const [sendParamsInBody, setSendParamsInBody] = useState(false);
  const [expandedHeaders, setExpandedHeaders] = useState(true);
  const [expandedParams, setExpandedParams] = useState(true);
  const [headers, setHeaders] = useState([]);
  const [params, setParams] = useState([]);
  const [fieldPickerTarget, setFieldPickerTarget] = useState(null);
  const [paramPendingRemoveId, setParamPendingRemoveId] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [saveError, setSaveError] = useState('');
  const urlBoxRef = useRef(null);
  // Clicking "add card fields" moves focus to that button before its onClick even
  // fires, which collapses/loses the Url box's caret — so by the time
  // handleInsertUrlField runs (after the picker modal closes), window.getSelection()
  // no longer points into the box and the field falls back to being appended at the
  // end instead of landing where the user was typing. Continuously mirroring the
  // live caret position into this ref (while the box still has focus) gives
  // handleInsertUrlField something valid to fall back to.
  const urlCaretRangeRef = useRef(null);

  const { saveWebServiceSettings, updateWebServiceSettings, testWebServiceSettings, isSavingWebServiceSettings, isUpdatingWebServiceSettings, isTestingWebServiceSettings } = useBusinessRuleReducer((s) => s);

  useEffect(() => {
    if (!show) return;
    if (fetchedSettings) {
      const fetchedMethod = fetchedSettings.method ?? DUMMY_INVOKE_METHOD_OPTIONS[1];
      const supportsBody = INVOKE_METHODS_WITH_BODY.includes(fetchedMethod);
      setServiceName(fetchedSettings.service_name ?? '');
      setMethod(fetchedMethod);
      setAuthentication(fetchedSettings.authentication ?? DUMMY_INVOKE_AUTH_OPTIONS[0]);
      setAuthUsername(fetchedSettings.auth_username ?? '');
      setAuthPassword(fetchedSettings.auth_password ?? '');
      setAuthKeyHeaderName(fetchedSettings.auth_key_header_name ?? '');
      setAuthKeyHeaderValue(fetchedSettings.auth_key_header_value ?? '');
      setSendParamsInBody(supportsBody ? Boolean(Number(fetchedSettings.send_params_in_body ?? 0)) : false);
      setHeaders(withTrailingBlankHeader(mapFetchedHeaders(fetchedSettings.headers)));
      setParams(buildInitialInvokeParams(mapFetchedParams(fetchedSettings.params), supportsBody, true));
    } else {
      const initialMethod = initialSettings?.method ?? DUMMY_INVOKE_METHOD_OPTIONS[1];
      const supportsBody = INVOKE_METHODS_WITH_BODY.includes(initialMethod);
      setServiceName(initialSettings?.serviceName ?? '');
      setMethod(initialMethod);
      setAuthentication(initialSettings?.authentication ?? DUMMY_INVOKE_AUTH_OPTIONS[0]);
      setAuthUsername(initialSettings?.authUsername ?? '');
      setAuthPassword(initialSettings?.authPassword ?? '');
      setAuthKeyHeaderName(initialSettings?.authKeyHeaderName ?? '');
      setAuthKeyHeaderValue(initialSettings?.authKeyHeaderValue ?? '');
      setSendParamsInBody(supportsBody ? (initialSettings?.sendParamsInBody ?? false) : false);
      setHeaders(withTrailingBlankHeader(initialSettings?.headers ?? []));
      setParams(buildInitialInvokeParams(initialSettings?.params, supportsBody, initialSettings?.params !== undefined));
    }
    setExpandedHeaders(true);
    setExpandedParams(true);
    setFieldPickerTarget(null);
    setParamPendingRemoveId(null);
    setTestResult(null);
    setSaveError('');
  }, [show, initialSettings, fetchedSettings]);

  // Seeds the Url contentEditable box once per open, same as the Subject box in
  // NotificationSettingsModal — plain text + pill nodes are set up directly on the
  // DOM here rather than driven by React state on every keystroke.
  useLayoutEffect(() => {
    if (!show) return;
    const el = urlBoxRef.current;
    if (!el) return;
    el.replaceChildren();
    parseUrlTokenString(fetchedSettings ? fetchedSettings.url : initialSettings?.url).forEach((part) => {
      if (part.type === 'pill') {
        el.appendChild(buildUrlFieldPill(part.value));
      } else {
        el.appendChild(document.createTextNode(part.value));
      }
    });
  }, [show, initialSettings, fetchedSettings]);

  const handleMethodChange = (newMethod) => {
    const supportsBody = INVOKE_METHODS_WITH_BODY.includes(newMethod);
    setMethod(newMethod);
    setAuthentication('NONE');
    if (!supportsBody) setSendParamsInBody(false);
    setParams((prev) => withTrailingBlankParam(withDefaultPayloadRow(prev, supportsBody)));
  };

  // Mirrors the live selection into urlCaretRangeRef whenever the box still has
  // the caret, so it survives the focus jump to the "add card fields" button.
  const captureUrlCaretRange = () => {
    const el = urlBoxRef.current;
    const selection = window.getSelection();
    if (el && selection?.rangeCount > 0 && el.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      urlCaretRangeRef.current = selection.getRangeAt(0).cloneRange();
    }
  };

  // Mirrors handleAddSubjectField's cursor-based insert so a card field lands
  // exactly where the caret is, instead of always being appended at the end.
  // Falls back to the last captured caret position (urlCaretRangeRef) when the
  // live selection no longer points into the box — which is the normal case here,
  // since clicking "add card fields" focuses that button (collapsing/losing the
  // box's selection) before the picker modal even opens.
  const handleInsertUrlField = (field) => {
    const el = urlBoxRef.current;
    if (!el) return;
    const span = buildUrlFieldPill(field);

    const selection = window.getSelection();
    const liveRange = selection?.rangeCount > 0 && el.contains(selection.getRangeAt(0).commonAncestorContainer)
      ? selection.getRangeAt(0)
      : null;
    const savedRange = !liveRange && urlCaretRangeRef.current && el.contains(urlCaretRangeRef.current.commonAncestorContainer)
      ? urlCaretRangeRef.current
      : null;
    const existingRange = liveRange ?? savedRange;
    if (existingRange) {
      existingRange.deleteContents();
      existingRange.insertNode(span);
    } else {
      el.appendChild(span);
    }

    el.focus();
    const newRange = document.createRange();
    newRange.setStartAfter(span);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);
    urlCaretRangeRef.current = newRange.cloneRange();
  };

  // Url is a single-line field: block Enter from inserting a line break, and strip
  // formatting from pasted content so the box only ever holds text + pill nodes.
  const handleUrlKeyDown = (e) => {
    if (e.key === 'Enter') e.preventDefault();
  };

  // Clicking a pill's "×" removes just that pill, leaving native contentEditable
  // caret placement for clicks anywhere else.
  const handleUrlBoxClick = (e) => {
    const removeBtn = e.target.closest('.br-invoke-value-pill-remove');
    if (!removeBtn) {
      captureUrlCaretRange();
      return;
    }
    e.preventDefault();
    removeBtn.closest('.br-invoke-value-pill')?.remove();
  };

  const handleUrlPaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  // Only re-seed a blank row when the list would otherwise be completely
  // empty (so there's still something to click into) — deleting the blank
  // trailing row while another row remains above it should actually remove
  // it, not get silently replaced by an identical one.
  const handleRemoveHeader = (id) => {
    setHeaders((prev) => {
      const next = prev.filter((h) => h.id !== id);
      return next.length === 0 ? withTrailingBlankHeader(next) : next;
    });
  };
  const handleHeaderChange = (id, field, value) => {
    setHeaders((prev) => withTrailingBlankHeader(prev.map((h) => (h.id === id ? { ...h, [field]: value } : h))));
  };
  // Clicking into the last row's Header/Value box opens the next blank row
  // immediately, rather than waiting for the user to type a character first.
  const handleHeaderFocus = (id) => {
    setHeaders((prev) =>
      prev[prev.length - 1]?.id === id
        ? [...prev, { id: makeInvokeRowId(), key: '', value: '' }]
        : prev
    );
  };

  // Only re-seed a blank row when the list would otherwise be completely
  // empty (so there's still something to click into) — deleting the blank
  // trailing row while another row remains above it should actually remove
  // it, not get silently replaced by an identical one.
  const handleRemoveParam = (id) => {
    setParams((prev) => {
      const next = prev.filter((p) => p.id !== id);
      return next.length === 0 ? withTrailingBlankParam(next) : next;
    });
  };
  const handleConfirmRemoveParam = () => {
    handleRemoveParam(paramPendingRemoveId);
    setParamPendingRemoveId(null);
  };
  const handleCancelRemoveParam = () => setParamPendingRemoveId(null);
  const handleParamChange = (id, field, value) => {
    setParams((prev) => withTrailingBlankParam(prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))));
  };
  // Clicking into the last row's Key/Value box opens the next blank row
  // immediately, rather than waiting for the user to type a character first.
  const handleParamFocus = (id) => {
    setParams((prev) =>
      prev[prev.length - 1]?.id === id
        ? [...prev, { id: makeInvokeRowId(), key: '', value: '', fields: [] }]
        : prev
    );
  };
  const handleAddParamFields = (paramId, fields) => {
    setParams((prev) =>
      withTrailingBlankParam(
        prev.map((p) => (p.id === paramId ? { ...p, fields: Array.from(new Set([...p.fields, ...fields])) } : p))
      )
    );
  };
  const handleRemoveParamField = (paramId, field) => {
    setParams((prev) =>
      withTrailingBlankParam(
        prev.map((p) => (p.id === paramId ? { ...p, fields: p.fields.filter((f) => f !== field) } : p))
      )
    );
  };

  const handleApplyFieldPicker = (fields) => {
    if (fieldPickerTarget === 'url') {
      fields.forEach((field) => handleInsertUrlField(field));
    } else if (fieldPickerTarget?.paramId != null) {
      handleAddParamFields(fieldPickerTarget.paramId, fields);
    }
  };

  const buildWebServicePayload = () => {
    const urlValue = urlPartsToString(parseUrlBoxParts(urlBoxRef.current));
    const supportsBody = INVOKE_METHODS_WITH_BODY.includes(method);
    const payload = {
      service_name: serviceName,
      url: urlValue,
      method,
      authentication,
      send_params_in_body: sendParamsInBody ? 1 : 0,
      // Confirmed against a real get_web_service_settings response: params come back as
      // param_key/param_value (e.g. { param_key: "asd", param_value: "sd" }), not the
      // generic key/value this was sending — that mismatch is what made the backend 422
      // the save. headers follows the same xxx_key/xxx_value naming convention used
      // throughout this app (property_key/property_value, field_key/field_value), though
      // unconfirmed since a headers example wasn't available (empty in the response).
      headers: supportsBody
        ? headers.filter((h) => !isBlankHeaderRow(h)).map((h) => ({ header_key: h.key, header_value: h.value }))
        : [],
      params: params
        .filter((p) => !isBlankParamRow(p))
        .map((p) => ({ param_key: p.key, param_value: p.fields.length > 0 ? joinUrlFields('', p.fields) : p.value })),
    };
    if (authentication === 'BASIC') {
      payload.auth_username = authUsername;
      payload.auth_password = authPassword;
    } else if (authentication === 'API_KEY') {
      payload.auth_key_header_name = authKeyHeaderName;
      payload.auth_key_header_value = authKeyHeaderValue;
    }
    return { payload, urlValue };
  };

  // Shared by Test Settings and Save Service so both block on the same required
  // fields instead of letting an empty Name/Url reach the backend first.
  const validateRequiredFields = (urlValue) => {
    if (!serviceName.trim()) {
      setSaveError('The service name cannot be empty.');
      return false;
    }
    if (!urlValue.trim()) {
      setSaveError('The service url cannot be empty.');
      return false;
    }
    setSaveError('');
    return true;
  };

  const handleTestSettings = () => {
    const { payload, urlValue } = buildWebServicePayload();
    if (!validateRequiredFields(urlValue)) return;

    setTestResult(null);
    testWebServiceSettings(payload, {
      cb: (data) => {
        const result = data?.data ?? {};
        const statusCode = result.status_code ?? null;
        const ok = data?.status !== 'error' && (statusCode == null || statusCode < 400);
        let message;
        if (ok) {
          message = stripHtmlTags(data?.message);
        } else {
          const friendlyMessage = getFriendlyTestErrorMessage(statusCode);
          const errorDetail = extractTestErrorDetail(result.response_body);
          message = errorDetail && errorDetail !== friendlyMessage ? `${friendlyMessage} ${errorDetail}`.trim() : friendlyMessage;
        }
        setTestResult({
          ok,
          statusCode,
          durationMs: result.duration_ms ?? null,
          responseBody: result.response_body ?? '',
          message,
        });
      },
      onError: (err) => {
        setSaveError(stripHtmlTags(err?.response?.data?.message ?? err.message) || 'Test request failed.');
      },
    });
  };

  const handleSave = () => {
    const { payload, urlValue } = buildWebServicePayload();
    if (!validateRequiredFields(urlValue)) return;

    const existingWebServiceId = initialSettings?.webServiceId;
    const saveOrUpdate = existingWebServiceId
      ? (p, opts) => updateWebServiceSettings(existingWebServiceId, p, opts)
      : (p, opts) => saveWebServiceSettings(p, opts);

    saveOrUpdate(payload, {
      cb: (data) => {
        onSave({
          serviceName, url: urlValue, method, authentication,
          authUsername, authPassword, authKeyHeaderName, authKeyHeaderValue,
          sendParamsInBody, headers, params, webServiceId: data?.web_service_id ?? existingWebServiceId ?? null,
        });
        onClose();
      },
    });
  };

  const supportsBody = INVOKE_METHODS_WITH_BODY.includes(method);

  return (
    <>
    <Modal
      show={show}
      onHide={onClose}
      className="card-property-match-modal notification-settings-modal"
      dialogClassName="card-property-match-modal-dialog notification-settings-modal-dialog"
      backdropClassName="card-property-match-modal-backdrop"
      centered
      scrollable
    >
      <div className="card-property-match-modal-shell br-invoke-modal-shell">
        <button
          type="button"
          className="br-floating-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          <FiX size={16} />
        </button>

        <header className="card-property-match-modal-header br-floating-close-header">
          <h2 className="card-property-match-modal-title">Service Invoke Settings</h2>
        </header>

        <div className="card-property-match-modal-body notification-settings-body">
          <div className="notification-field">
            <label className="business-rule-form-label br-invoke-field-label">Name</label>
            <input
              type="text"
              className="business-rule-form-input"
              placeholder="Enter name"
              value={serviceName}
              onChange={(e) => {
                setServiceName(e.target.value);
                setSaveError('');
              }}
            />
          </div>

          <div className="notification-field">
            <div className="notification-field-head">
              <label className="business-rule-form-label br-invoke-field-label">Url</label>
              <div className="notification-field-actions">
                <button
                  type="button"
                  className="notification-dropdown-trigger"
                  onClick={() => setFieldPickerTarget('url')}
                >
                  add card fields <FiChevronDown size={12} aria-hidden />
                </button>
              </div>
            </div>
            <div
              ref={urlBoxRef}
              className="br-invoke-value-box br-invoke-value-box--editable"
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="false"
              aria-label="Service url"
              onClick={handleUrlBoxClick}
              onKeyDown={handleUrlKeyDown}
              onKeyUp={captureUrlCaretRange}
              onPaste={handleUrlPaste}
              onInput={() => { setSaveError(''); captureUrlCaretRange(); }}
            />
          </div>

          <div className="br-invoke-two-col">
            <div className="notification-field">
              <label className="business-rule-form-label br-invoke-field-label">Method</label>
              <div className="business-rule-form-select-wrap">
                <select className="business-rule-form-select" value={method} onChange={(e) => handleMethodChange(e.target.value)}>
                  {DUMMY_INVOKE_METHOD_OPTIONS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <FiChevronDown className="business-rule-form-select-icon" aria-hidden />
              </div>
            </div>

            <div className="notification-field">
              <label className="business-rule-form-label br-invoke-field-label">Authentication</label>
              <div className="business-rule-form-select-wrap">
                <select className="business-rule-form-select" value={authentication} onChange={(e) => setAuthentication(e.target.value)}>
                  {DUMMY_INVOKE_AUTH_OPTIONS.map((a) => (
                    <option key={a} value={a}>{a.replace('_', ' ')}</option>
                  ))}
                </select>
                <FiChevronDown className="business-rule-form-select-icon" aria-hidden />
              </div>
            </div>
          </div>

          {authentication === 'BASIC' && (
            <div className="br-invoke-two-col">
              <div className="notification-field">
                <label className="business-rule-form-label br-invoke-field-label">Username</label>
                <input
                  type="text"
                  className="business-rule-form-input"
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                />
              </div>
              <div className="notification-field">
                <label className="business-rule-form-label br-invoke-field-label">Password</label>
                <input
                  type="password"
                  className="business-rule-form-input"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                />
              </div>
            </div>
          )}

          {authentication === 'API_KEY' && (
            <div className="br-invoke-two-col">
              <div className="notification-field">
                <label className="business-rule-form-label br-invoke-field-label">API KEY header name</label>
                <input
                  type="text"
                  className="business-rule-form-input"
                  placeholder="Enter header name"
                  value={authKeyHeaderName}
                  onChange={(e) => setAuthKeyHeaderName(e.target.value)}
                />
              </div>
              <div className="notification-field">
                <label className="business-rule-form-label br-invoke-field-label">API KEY header value</label>
                <input
                  type="text"
                  className="business-rule-form-input"
                  placeholder="Enter header value"
                  value={authKeyHeaderValue}
                  onChange={(e) => setAuthKeyHeaderValue(e.target.value)}
                />
              </div>
            </div>
          )}

          {supportsBody && (
            <div className="br-property-section">
              <button
                type="button"
                className="br-property-section-toggle"
                onClick={() => setExpandedHeaders((v) => !v)}
              >
                <span className="br-property-section-toggle-icon">
                  {expandedHeaders ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                </span>
                Headers
              </button>
              {expandedHeaders && (
                <>
                  <div className="br-invoke-kv-columns">
                    <span>Header</span>
                    <span>Value</span>
                  </div>
                  <div className="br-invoke-kv-list">
                    {headers.map((h) => (
                      <div key={h.id} className="br-invoke-kv-row">
                        <input
                          type="text"
                          className="business-rule-form-input"
                          value={h.key}
                          onChange={(e) => handleHeaderChange(h.id, 'key', e.target.value)}
                          onFocus={() => handleHeaderFocus(h.id)}
                        />
                        <input
                          type="text"
                          className="business-rule-form-input"
                          value={h.value}
                          onChange={(e) => handleHeaderChange(h.id, 'value', e.target.value)}
                          onFocus={() => handleHeaderFocus(h.id)}
                        />
                        <button
                          type="button"
                          className="br-invoke-row-delete"
                          onClick={() => handleRemoveHeader(h.id)}
                          aria-label="Remove header"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="br-property-section">
            <button
              type="button"
              className="br-property-section-toggle"
              onClick={() => setExpandedParams((v) => !v)}
            >
              <span className="br-property-section-toggle-icon">
                {expandedParams ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
              </span>
              Parameters
            </button>
            {expandedParams && (
              <>
                <label className="br-link-checkbox-row br-invoke-body-checkbox">
                  <input
                    type="checkbox"
                    checked={sendParamsInBody}
                    onChange={(e) => setSendParamsInBody(e.target.checked)}
                  />
                  Send the parameters in the body of the web service call
                </label>

                <div className="br-invoke-kv-columns">
                  <span>Key</span>
                  <span>Value</span>
                </div>
                <div className="br-invoke-kv-list">
                  {params.map((p) => (
                    <div key={p.id} className="br-invoke-kv-row">
                      <input
                        type="text"
                        className="business-rule-form-input"
                        value={p.key}
                        onChange={(e) => handleParamChange(p.id, 'key', e.target.value)}
                        onFocus={() => handleParamFocus(p.id)}
                      />
                      <div className="br-invoke-value-box">
                        {p.fields.length > 0 ? (
                          <div className="br-invoke-value-pills">
                            {p.fields.map((f) => (
                              <span key={f} className="notification-pill br-invoke-value-pill">
                                {f}
                                <button
                                  type="button"
                                  className="br-invoke-value-pill-remove"
                                  onClick={() => handleRemoveParamField(p.id, f)}
                                  aria-label={`Remove ${f}`}
                                >
                                  <FiX size={10} />
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <input
                            type="text"
                            className="br-invoke-value-input"
                            value={p.value}
                            onChange={(e) => handleParamChange(p.id, 'value', e.target.value)}
                            onFocus={() => handleParamFocus(p.id)}
                          />
                        )}
                        <button
                          type="button"
                          className="br-invoke-value-add-btn"
                          onClick={() => {
                            setParamPendingRemoveId(null);
                            setFieldPickerTarget({ paramId: p.id });
                          }}
                          aria-label="Insert card fields"
                        >
                          <FiPlus size={14} aria-hidden />
                        </button>
                      </div>
                      <button
                        type="button"
                        className="br-invoke-row-delete"
                        onClick={() => (isBlankParamRow(p) ? handleRemoveParam(p.id) : setParamPendingRemoveId(p.id))}
                        aria-label="Remove param"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <footer className="card-property-match-modal-footer br-invoke-modal-footer">
          {saveError && <p className="br-invoke-save-error">{saveError}</p>}
          <div className="br-invoke-modal-footer-actions">
            <button
              type="button"
              className="br-invoke-test-btn"
              onClick={handleTestSettings}
              disabled={isTestingWebServiceSettings}
            >
              {isTestingWebServiceSettings ? 'Testing...' : 'Test Settings'}
            </button>
            <button type="button" className="br-property-add-btn" onClick={handleSave} disabled={isLoadingSettings || isSavingWebServiceSettings || isUpdatingWebServiceSettings}>
              {isSavingWebServiceSettings || isUpdatingWebServiceSettings ? 'Saving...' : (isLoadingSettings ? 'Loading...' : (initialSettings?.webServiceId ? 'Update Service' : 'Save Service'))}
            </button>
          </div>
        </footer>
      </div>
    </Modal>

    <CardFieldPickerModal
      show={fieldPickerTarget != null}
      onClose={() => setFieldPickerTarget(null)}
      onApply={handleApplyFieldPicker}
      triggerTypeId={triggerTypeId}
      allowedRegularFieldLabels={fieldPickerTarget === 'url' ? DUMMY_URL_FIELD_OPTIONS : undefined}
    />

    <Modal
      show={paramPendingRemoveId != null && fieldPickerTarget == null}
      onHide={handleCancelRemoveParam}
      className="br-cancel-confirm-modal"
      dialogClassName="br-cancel-confirm-dialog"
      backdropClassName="br-cancel-confirm-backdrop"
      backdrop="static"
    >
      <div className="br-cancel-confirm-content">
        <button type="button" className="br-cancel-confirm-close-btn" onClick={handleCancelRemoveParam}>
          <FiX size={16} />
        </button>
        <p className="br-cancel-confirm-text">Are you sure you want to remove this parameter?</p>
        <div className="br-cancel-confirm-actions">
          <button type="button" className="br-cancel-confirm-btn br-cancel-confirm-btn--no" onClick={handleCancelRemoveParam}>
            No
          </button>
          <button type="button" className="br-cancel-confirm-btn br-cancel-confirm-btn--yes" onClick={handleConfirmRemoveParam}>
            Yes
          </button>
        </div>
      </div>
    </Modal>

    {testResult != null && createPortal(
      <div
        className="br-invoke-test-result-overlay"
        onClick={() => setTestResult(null)}
      />,
      document.body
    )}
    <Modal
      show={testResult != null}
      onHide={() => setTestResult(null)}
      className="br-invoke-test-result-modal"
      dialogClassName="br-invoke-test-result-dialog"
      backdrop={false}
      centered
    >
      <div className="br-invoke-test-result-content">
        <button
          type="button"
          className="br-invoke-test-result-close-btn"
          onClick={() => setTestResult(null)}
          aria-label="Close"
        >
          <FiX size={16} />
        </button>
        <h3 className="br-invoke-test-result-title">Service Invoke Test Result</h3>
        {testResult?.ok ? (
          <div className="br-invoke-test-result-success">
            <img src={toastSuccessIcon} alt="Success" className="br-invoke-test-result-image" />
          </div>
        ) : (
          <p className="br-invoke-test-result-message br-invoke-test-result-message--error">
            {testResult?.message || 'Test request failed.'}
          </p>
        )}
      </div>
    </Modal>
    </>
  );
}

WebInvokeSettingsModal.propTypes = {
  show: PropTypes.bool.isRequired,
  initialSettings: PropTypes.shape({
    serviceName: PropTypes.string,
    url: PropTypes.string,
    method: PropTypes.string,
    authentication: PropTypes.string,
    authUsername: PropTypes.string,
    authPassword: PropTypes.string,
    authKeyHeaderName: PropTypes.string,
    authKeyHeaderValue: PropTypes.string,
    sendParamsInBody: PropTypes.bool,
    headers: PropTypes.array,
    params: PropTypes.array,
    webServiceId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }),
  fetchedSettings: PropTypes.shape({
    web_service_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    then_action_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    service_name: PropTypes.string,
    url: PropTypes.string,
    method: PropTypes.string,
    authentication: PropTypes.string,
    auth_username: PropTypes.string,
    auth_password: PropTypes.string,
    auth_key_header_name: PropTypes.string,
    auth_key_header_value: PropTypes.string,
    send_params_in_body: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    headers: PropTypes.array,
    params: PropTypes.array,
  }),
  isLoadingSettings: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  triggerTypeId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

function CreateSubtaskSettingsModal({ show, onClose, onSave, initialSettings, fetchedSettings, isLoadingSettings, users }) {
  const [ownerUserId, setOwnerUserId] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('00:00');
  const [description, setDescription] = useState('');
  const [isOwnerPickerOpen, setIsOwnerPickerOpen] = useState(false);
  const [ownerFilterText, setOwnerFilterText] = useState('');
  const [ownerPanelCoords, setOwnerPanelCoords] = useState({ top: 0, left: 0, width: 0, placement: 'bottom' });
  const ownerPickerTriggerRef = useRef(null);
  const ownerPickerPanelRef = useRef(null);

  const { saveCreateSubtaskSettings, updateCreateSubtaskSettings, isSavingCreateSubtaskSettings } = useBusinessRuleReducer((s) => s);

  useEffect(() => {
    if (!show) return;
    const source = fetchedSettings
      ? { ownerUserId: fetchedSettings.owner_user_id, deadline: fetchedSettings.deadline, description: fetchedSettings.description }
      : initialSettings;
    setOwnerUserId(source?.ownerUserId ?? '');
    const [datePart, timePart] = String(source?.deadline ?? '').split(' ');
    setDeadlineDate(datePart ?? '');
    setDeadlineTime((timePart ?? '00:00').slice(0, 5));
    setDescription(source?.description ?? '');
    setIsOwnerPickerOpen(false);
    setOwnerFilterText('');
  }, [show, initialSettings, fetchedSettings]);

  // The picker panel is portaled to document.body (see below) so it isn't clipped by
  // the modal's own overflow/scroll box or trapped behind the modal's stacking context —
  // its position is computed from the trigger's live viewport rect instead of CSS
  // anchoring, and flips above the trigger when there isn't room below.
  const updateOwnerPanelPosition = () => {
    const el = ownerPickerTriggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 6;
    const estimatedPanelHeight = 320;
    const spaceBelow = window.innerHeight - r.bottom;
    const placeAbove = spaceBelow < estimatedPanelHeight && r.top > spaceBelow;
    setOwnerPanelCoords({
      top: placeAbove ? r.top - gap : r.bottom + gap,
      left: r.left,
      width: Math.max(r.width, 260),
      placement: placeAbove ? 'top' : 'bottom',
    });
  };

  const handleToggleOwnerPicker = () => {
    setIsOwnerPickerOpen((prev) => {
      const next = !prev;
      if (next) updateOwnerPanelPosition();
      return next;
    });
  };

  useEffect(() => {
    if (!isOwnerPickerOpen) return undefined;
    const onDocMouseDown = (e) => {
      const t = e.target;
      if (ownerPickerPanelRef.current?.contains(t)) return;
      if (ownerPickerTriggerRef.current?.contains(t)) return;
      setIsOwnerPickerOpen(false);
    };
    const onReposition = () => updateOwnerPanelPosition();
    document.addEventListener('mousedown', onDocMouseDown);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [isOwnerPickerOpen]);

  const selectedOwnerUser = (users ?? []).find((u) => String(u.user_id) === String(ownerUserId));
  const ownerName = selectedOwnerUser?.name || 'None';
  const ownerFilterQuery = ownerFilterText.trim().toLowerCase();
  const filteredOwnerUsers = ownerFilterQuery
    ? (users ?? []).filter((u) => u.name?.toLowerCase().includes(ownerFilterQuery))
    : (users ?? []);

  const handlePickOwner = (user) => {
    setOwnerUserId(user?.user_id ?? '');
    setIsOwnerPickerOpen(false);
  };

  const handleSave = () => {
    const deadline = deadlineDate ? `${deadlineDate} ${deadlineTime || '00:00'}:00` : '';
    const payload = {
      ...(ownerUserId ? { owner_user_id: ownerUserId } : {}),
      ...(deadline ? { deadline } : {}),
      description,
    };
    // A create-subtask action that already has a createSubtaskId (fetchedSettings was
    // loaded for it in handleOpenCreateSubtaskSettings) was previously saved on the
    // backend, so resaving it must update that record instead of creating a duplicate one.
    const existingCreateSubtaskId = initialSettings?.createSubtaskId;
    if (existingCreateSubtaskId) {
      updateCreateSubtaskSettings(existingCreateSubtaskId, payload, {
        cb: () => {
          onSave({ ownerUserId, deadline, description, createSubtaskId: existingCreateSubtaskId });
          onClose();
        },
      });
    } else {
      saveCreateSubtaskSettings(payload, {
        cb: (data) => {
          onSave({
            ownerUserId,
            deadline,
            description,
            createSubtaskId: data?.create_subtask_id ?? null,
          });
          onClose();
        },
      });
    }
  };

  const renderDeadlineTrigger = ({ disabled, onOpen, displayValue }) => (
    <button
      type="button"
      className="br-subtask-deadline-trigger"
      onClick={onOpen}
      disabled={disabled}
    >
      <FiCalendar size={14} aria-hidden />
      {displayValue || 'Not Set'}
    </button>
  );

  return (
    <Modal
      show={show}
      onHide={onClose}
      className="card-property-match-modal br-subtask-settings-modal"
      dialogClassName="card-property-match-modal-dialog br-subtask-settings-modal-dialog"
      backdropClassName="card-property-match-modal-backdrop"
      centered
      scrollable
      enforceFocus={false}
    >
      <div className="card-property-match-modal-shell br-invoke-modal-shell">
        <button
          type="button"
          className="br-floating-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          <FiX size={16} />
        </button>

        <header className="card-property-match-modal-header br-floating-close-header">
          <h2 className="card-property-match-modal-title">Create Subtask</h2>
        </header>

        <div className="card-property-match-modal-body notification-settings-body">
          <div className="br-invoke-two-col">
            <div className="business-rule-form-field">
              <label className="business-rule-form-label">Owner</label>
              <button
                type="button"
                ref={ownerPickerTriggerRef}
                className="business-rule-form-select-wrap business-rule-form-select-wrap--owner business-rule-form-control br-owner-picker-trigger"
                onClick={handleToggleOwnerPicker}
                aria-haspopup="listbox"
                aria-expanded={isOwnerPickerOpen}
              >
                <span className="business-rule-form-owner-avatar" aria-hidden>
                  {getInitials(ownerName)}
                </span>
                <span className="br-owner-picker-trigger-name">{ownerName}</span>
                <FiChevronDown className="business-rule-form-select-icon" aria-hidden />
              </button>

              {isOwnerPickerOpen && createPortal(
                <div
                  className={`br-owner-picker-panel br-owner-picker-panel--floating br-owner-picker-panel--${ownerPanelCoords.placement}`}
                  ref={ownerPickerPanelRef}
                  style={{ top: ownerPanelCoords.top, left: ownerPanelCoords.left, width: ownerPanelCoords.width }}
                >
                  <div className="br-owner-picker-search">
                    <FiFilter size={14} className="br-owner-picker-search-icon" aria-hidden />
                    <input
                      type="text"
                      placeholder="Filter"
                      value={ownerFilterText}
                      onChange={(e) => setOwnerFilterText(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="br-owner-picker-list">
                    <div className="br-owner-picker-row">
                      <button
                        type="button"
                        className={`br-owner-picker-row-btn${!ownerUserId ? ' br-owner-picker-row-btn--selected' : ''}`}
                        onClick={() => handlePickOwner(null)}
                      >
                        <span className="business-rule-form-owner-avatar" aria-hidden>{getInitials('None')}</span>
                        <span className="br-owner-picker-row-name">None</span>
                      </button>
                    </div>
                    {filteredOwnerUsers.length === 0 ? (
                      <div className="br-property-picker-empty">No matches</div>
                    ) : (
                      filteredOwnerUsers.map((user) => (
                        <div key={user.user_id} className="br-owner-picker-row">
                          <button
                            type="button"
                            className={`br-owner-picker-row-btn${String(ownerUserId) === String(user.user_id) ? ' br-owner-picker-row-btn--selected' : ''}`}
                            onClick={() => handlePickOwner(user)}
                          >
                            <span className="business-rule-form-owner-avatar" aria-hidden>{getInitials(user.name)}</span>
                            <span className="br-owner-picker-row-name">{user.name}</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>,
                document.body
              )}
            </div>

            <div className="notification-field">
              <label className="business-rule-form-label">Deadline</label>
              <DatePickerField
                dateValue={deadlineDate}
                onDateChange={(e) => setDeadlineDate(e.target.value)}
                popperClassName="br-subtask-deadline-popper"
                renderTrigger={renderDeadlineTrigger}
              />
            </div>
          </div>

          <div className="notification-field">
            <label className="business-rule-form-label">Description</label>
            <textarea
              className="business-rule-form-textarea br-subtask-description-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <footer className="card-property-match-modal-footer">
          <button
            type="button"
            className="br-property-add-btn"
            onClick={handleSave}
            disabled={isLoadingSettings || isSavingCreateSubtaskSettings}
          >
            {isSavingCreateSubtaskSettings ? 'Saving...' : (isLoadingSettings ? 'Loading...' : (initialSettings?.createSubtaskId ? 'Update' : 'Save'))}
          </button>
        </footer>
      </div>
    </Modal>
  );
}

CreateSubtaskSettingsModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  initialSettings: PropTypes.shape({
    ownerUserId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    deadline: PropTypes.string,
    description: PropTypes.string,
    createSubtaskId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }),
  fetchedSettings: PropTypes.shape({
    create_subtask_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    then_action_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    owner_user_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    deadline: PropTypes.string,
    description: PropTypes.string,
  }),
  isLoadingSettings: PropTypes.bool,
  users: PropTypes.array,
};

// Single-user "Owner"/"Co-owners" picker — same floating, portaled panel behavior as
// CreateSubtaskSettingsModal's own Owner picker above, generalized so CreateCardDetailsModal
// can use it twice (Owner, Co-owners) without duplicating the positioning/outside-click logic.
function UserPickerField({ label, users, valueUserId, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, placement: 'bottom' });
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const updatePosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 6;
    const estimatedPanelHeight = 320;
    const spaceBelow = window.innerHeight - r.bottom;
    const placeAbove = spaceBelow < estimatedPanelHeight && r.top > spaceBelow;
    setCoords({
      top: placeAbove ? r.top - gap : r.bottom + gap,
      left: r.left,
      width: Math.max(r.width, 260),
      placement: placeAbove ? 'top' : 'bottom',
    });
  };

  const handleToggle = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) updatePosition();
      return next;
    });
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const onDocMouseDown = (e) => {
      const t = e.target;
      if (panelRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setIsOpen(false);
    };
    const onReposition = () => updatePosition();
    document.addEventListener('mousedown', onDocMouseDown);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [isOpen]);

  const selectedUser = (users ?? []).find((u) => String(u.user_id) === String(valueUserId));
  const name = selectedUser?.name || 'None';
  const query = filterText.trim().toLowerCase();
  const filteredUsers = query ? (users ?? []).filter((u) => u.name?.toLowerCase().includes(query)) : (users ?? []);

  const handlePick = (user) => {
    onChange(user?.user_id ?? '');
    setIsOpen(false);
  };

  return (
    <div className="business-rule-form-field">
      <label className="business-rule-form-label">{label}</label>
      <button
        type="button"
        ref={triggerRef}
        className="business-rule-form-select-wrap business-rule-form-select-wrap--owner business-rule-form-control br-owner-picker-trigger"
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="business-rule-form-owner-avatar" aria-hidden>{getInitials(name)}</span>
        <span className="br-owner-picker-trigger-name">{name}</span>
        <FiChevronDown className="business-rule-form-select-icon" aria-hidden />
      </button>

      {isOpen && createPortal(
        <div
          className={`br-owner-picker-panel br-owner-picker-panel--floating br-owner-picker-panel--${coords.placement}`}
          ref={panelRef}
          style={{ top: coords.top, left: coords.left, width: coords.width }}
        >
          <div className="br-owner-picker-search">
            <FiFilter size={14} className="br-owner-picker-search-icon" aria-hidden />
            <input type="text" placeholder="Filter" value={filterText} onChange={(e) => setFilterText(e.target.value)} autoFocus />
          </div>
          <div className="br-owner-picker-list">
            <div className="br-owner-picker-row">
              <button
                type="button"
                className={`br-owner-picker-row-btn${!valueUserId ? ' br-owner-picker-row-btn--selected' : ''}`}
                onClick={() => handlePick(null)}
              >
                <span className="business-rule-form-owner-avatar" aria-hidden>{getInitials('None')}</span>
                <span className="br-owner-picker-row-name">None</span>
              </button>
            </div>
            {filteredUsers.length === 0 ? (
              <div className="br-property-picker-empty">No matches</div>
            ) : (
              filteredUsers.map((user) => (
                <div key={user.user_id} className="br-owner-picker-row">
                  <button
                    type="button"
                    className={`br-owner-picker-row-btn${String(valueUserId) === String(user.user_id) ? ' br-owner-picker-row-btn--selected' : ''}`}
                    onClick={() => handlePick(user)}
                  >
                    <span className="business-rule-form-owner-avatar" aria-hidden>{getInitials(user.name)}</span>
                    <span className="br-owner-picker-row-name">{user.name}</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

UserPickerField.propTypes = {
  label: PropTypes.string.isRequired,
  users: PropTypes.array,
  valueUserId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
};

// Multi-select "Tags" field — same input-styled trigger + floating filterable panel as
// UserPickerField, but toggles multiple kanban-board tags (board's own tag catalog, not the
// rule's own free-text metadata tags at business-rule-form-tags-input elsewhere in this file).
function TagPickerField({ label, tags, valueTagIds, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, placement: 'bottom' });
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const updatePosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 6;
    const estimatedPanelHeight = 320;
    const spaceBelow = window.innerHeight - r.bottom;
    const placeAbove = spaceBelow < estimatedPanelHeight && r.top > spaceBelow;
    setCoords({
      top: placeAbove ? r.top - gap : r.bottom + gap,
      left: r.left,
      width: Math.max(r.width, 260),
      placement: placeAbove ? 'top' : 'bottom',
    });
  };

  const handleToggle = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) updatePosition();
      return next;
    });
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const onDocMouseDown = (e) => {
      const t = e.target;
      if (panelRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setIsOpen(false);
    };
    const onReposition = () => updatePosition();
    document.addEventListener('mousedown', onDocMouseDown);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [isOpen]);

  const activeTags = (tags ?? []).filter((t) => !isKanbanManagementRowDisabled(t.status));
  const query = filterText.trim().toLowerCase();
  const filteredTags = query ? activeTags.filter((t) => t.label?.toLowerCase().includes(query)) : activeTags;
  const selectedTags = activeTags.filter((t) => (valueTagIds ?? []).includes(t.id));

  const handleToggleTag = (tagId) => {
    onChange((valueTagIds ?? []).includes(tagId) ? valueTagIds.filter((id) => id !== tagId) : [...(valueTagIds ?? []), tagId]);
  };

  const handleRemoveTag = (tagId, e) => {
    e.stopPropagation();
    onChange((valueTagIds ?? []).filter((id) => id !== tagId));
  };

  return (
    <div className="business-rule-form-field">
      <label className="business-rule-form-label">{label}</label>
      <button
        type="button"
        ref={triggerRef}
        className="business-rule-form-input business-rule-form-control business-rule-form-tags-input br-tag-picker-trigger"
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {selectedTags.length === 0 ? (
          <span className="br-tag-picker-placeholder">Select tags</span>
        ) : (
          selectedTags.map((t) => (
            <span key={t.id} className="business-rule-form-tag-pill">
              {t.color_code && <span className="br-property-pill-dot" style={{ backgroundColor: t.color_code }} aria-hidden />}
              {t.label}
              <button type="button" onClick={(e) => handleRemoveTag(t.id, e)} aria-label={`Remove tag ${t.label}`}>
                <FiX size={12} />
              </button>
            </span>
          ))
        )}
      </button>

      {isOpen && createPortal(
        <div
          className={`br-owner-picker-panel br-owner-picker-panel--floating br-owner-picker-panel--${coords.placement}`}
          ref={panelRef}
          style={{ top: coords.top, left: coords.left, width: coords.width }}
        >
          <div className="br-owner-picker-search">
            <FiFilter size={14} className="br-owner-picker-search-icon" aria-hidden />
            <input type="text" placeholder="Filter" value={filterText} onChange={(e) => setFilterText(e.target.value)} autoFocus />
          </div>
          <div className="br-owner-picker-list">
            {filteredTags.length === 0 ? (
              <div className="br-property-picker-empty">No tags found</div>
            ) : (
              filteredTags.map((t) => (
                <div key={t.id} className="br-owner-picker-row">
                  <button
                    type="button"
                    className={`br-owner-picker-row-btn${(valueTagIds ?? []).includes(t.id) ? ' br-owner-picker-row-btn--selected' : ''}`}
                    onClick={() => handleToggleTag(t.id)}
                  >
                    <span className="br-property-pill-dot" style={{ backgroundColor: t.color_code || '#9ca3af' }} aria-hidden />
                    <span className="br-owner-picker-row-name">{t.label}</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

TagPickerField.propTypes = {
  label: PropTypes.string.isRequired,
  tags: PropTypes.array,
  valueTagIds: PropTypes.array,
  onChange: PropTypes.func.isRequired,
};

// Regular-field labels CreateCardDetailsModal owns on the action's fieldValues list — used
// to tell "fields this modal manages" apart from any leftover entries saved before the
// freeform "Set card fields" picker was removed, so saving from this modal never silently
// drops an unrelated chip that got in that other way.
const CREATE_CARD_FIXED_FIELD_LABELS = ['Owner', 'Co-owners', 'Deadline', 'Size', 'Tags', 'Custom card ID'];

// "Configure details" on a create-card action (see hasCustomProperties in the THEN column)
// opens this instead of going straight from the Board Minimap destination pick to done —
// title/description plus Owner/Deadline/Tags/... field values, presented as the fixed panel
// the reference product itself uses, with the board's own custom fields and a simple
// subtask-title list alongside it.
function CreateCardDetailsModal({ show, onClose, onSave, action, users, kanbanTags, triggerTypeId }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [coOwnerUserId, setCoOwnerUserId] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [size, setSize] = useState('');
  const [tagIds, setTagIds] = useState([]);
  const [customCardId, setCustomCardId] = useState('');
  const [customFieldValues, setCustomFieldValues] = useState({});
  const [subtaskTitles, setSubtaskTitles] = useState([]);
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [isCustomFieldsExpanded, setIsCustomFieldsExpanded] = useState(false);
  const [isSubtasksExpanded, setIsSubtasksExpanded] = useState(true);

  const boardId = action?.boardId;

  const { customFields, isLoadingCustomFields } = useCustomFieldsByTrigger({
    show, triggerTypeId, boardId, showDisabled: false, search: '',
  });
  // Dev-only fallback so the panel can be visually tested without a live backend, same as
  // CopyCardDetailsModal's own displayCustomFields above.
  const displayCustomFields = customFields.length > 0 ? customFields : (import.meta.env.DEV ? DUMMY_CUSTOM_FIELDS : []);

  const { boardStructure, getBoardStructure } = useWorkFlowReducer((s) => s);
  useEffect(() => {
    if (!show || !boardId) return;
    getBoardStructure({ boardId });
  }, [show, boardId]);

  // Same transform the Board Minimap itself uses, so the footer's stage strip reflects the
  // actual picked workflow's real stage segments/colors instead of a re-invented palette.
  const minimapWorkflows = useMemo(
    () => (boardId ? buildBoardMinimapWorkflows(boardStructure) : []),
    [boardId, boardStructure]
  );
  const activeWorkflow = minimapWorkflows.find((w) => String(w.id) === String(action?.workflowId));
  const stageDots = activeWorkflow
    ? activeWorkflow.stageSegments.flatMap((segment) => segment.columns.map((col) => ({ ...col, color: segment.color })))
    : [];

  useEffect(() => {
    if (!show) return;
    const fv = action?.fieldValues ?? [];
    const findOne = (label) => fv.find((f) => f.field === label);
    setTitle(action?.cardTitle ?? '');
    setDescription(action?.cardDescription ?? '');
    setOwnerUserId(findOne('Owner')?.refId ?? '');
    setCoOwnerUserId(findOne('Co-owners')?.refId ?? '');
    setDeadlineDate(findOne('Deadline')?.value ?? '');
    setSize(findOne('Size')?.value ?? '');
    setTagIds(findOne('Tags')?.tagIds ?? []);
    setCustomCardId(findOne('Custom card ID')?.value ?? '');
    setSubtaskTitles(action?.subtaskTitles ?? []);
    setSubtaskDraft('');
    setIsCustomFieldsExpanded(false);
  }, [show, action?.id]);

  // Separate effect: the board's custom-field catalog only resolves after boardId's fetch
  // completes, which can land after the effect above already ran on open.
  useEffect(() => {
    if (!show || displayCustomFields.length === 0) return;
    const fv = action?.fieldValues ?? [];
    const next = {};
    displayCustomFields.forEach((f) => {
      const match = fv.find((x) => x.field === f.field_label);
      if (match) next[f.field_label] = match.value ?? '';
    });
    setCustomFieldValues((prev) => ({ ...next, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, displayCustomFields.length, action?.id]);

  const handleAddSubtaskDraft = () => {
    if (!subtaskDraft.trim()) return;
    setSubtaskTitles((prev) => [...prev, subtaskDraft.trim()]);
    setSubtaskDraft('');
  };

  const handleSubtaskDraftKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleAddSubtaskDraft();
    }
  };

  const handleRemoveSubtask = (idx) => {
    setSubtaskTitles((prev) => prev.filter((_, i) => i !== idx));
  };

  const renderDeadlineTrigger = ({ disabled, onOpen, displayValue }) => (
    <button type="button" className="br-subtask-deadline-trigger" onClick={onOpen} disabled={disabled}>
      <FiCalendar size={14} aria-hidden />
      {displayValue || 'Not Set'}
    </button>
  );

  const handleSave = () => {
    const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ownerUser = (users ?? []).find((u) => String(u.user_id) === String(ownerUserId));
    const coOwnerUser = (users ?? []).find((u) => String(u.user_id) === String(coOwnerUserId));

    const built = [
      ownerUserId ? { id: makeId(), type: 'user', field: 'Owner', label: 'Owner', refId: ownerUserId, refName: ownerUser?.name ?? '' } : null,
      coOwnerUserId ? { id: makeId(), type: 'user', field: 'Co-owners', label: 'Co-owners', refId: coOwnerUserId, refName: coOwnerUser?.name ?? '' } : null,
      deadlineDate ? { id: makeId(), type: 'date', field: 'Deadline', label: 'Deadline', value: deadlineDate } : null,
      size ? { id: makeId(), type: 'text', field: 'Size', label: 'Size', value: size } : null,
      tagIds.length > 0 ? { id: makeId(), type: 'tags', field: 'Tags', label: 'Tags', tagIds } : null,
      customCardId ? { id: makeId(), type: 'text', field: 'Custom card ID', label: 'Custom card ID', value: customCardId } : null,
      ...displayCustomFields
        .filter((f) => (customFieldValues[f.field_label] ?? '').trim() !== '')
        .map((f) => ({
          id: makeId(),
          type: classifyCustomFieldUiKind(f.field_label) === 'date' ? 'date' : 'text',
          field: f.field_label,
          label: `Set ${f.field_label}`,
          value: customFieldValues[f.field_label],
        })),
    ].filter(Boolean);

    const managedLabels = new Set([...CREATE_CARD_FIXED_FIELD_LABELS, ...displayCustomFields.map((f) => f.field_label)]);
    const untouchedExisting = (action?.fieldValues ?? []).filter((fv) => !managedLabels.has(fv.field));

    onSave({
      cardTitle: title,
      cardDescription: description,
      fieldValues: [...untouchedExisting, ...built],
      subtaskTitles,
    });
    onClose();
  };

  const destinationLabel = action?.boardName
    ? `${action.workspaceName ? `${action.workspaceName} / ` : ''}${action.boardName}`
    : null;

  return (
    <Modal
      show={show}
      onHide={onClose}
      className="card-property-match-modal br-create-card-details-modal"
      dialogClassName="card-property-match-modal-dialog br-create-card-details-modal-dialog"
      backdropClassName="card-property-match-modal-backdrop"
      centered
      scrollable
    >
      <div className="card-property-match-modal-shell br-ccd-shell">
        <header className="card-property-match-modal-header">
          <h2 className="card-property-match-modal-title">Create Card Details</h2>
          <button type="button" className="business-rule-form-modal-close" onClick={onClose} aria-label="Close">
            <FiX size={20} />
          </button>
        </header>

        <div className="br-ccd-titlebar">
          <input
            type="text"
            className="br-ccd-title-input"
            placeholder="Enter card title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="card-property-match-modal-body br-ccd-body">
          <div className="br-ccd-desc-col">
            <textarea
              className="br-ccd-desc-textarea"
              placeholder="Enter card description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="br-ccd-fields-col">
            <div className="br-ccd-fields-head">Card fields</div>

            <div className="br-ccd-grid2">
              <UserPickerField label="Owner" users={users} valueUserId={ownerUserId} onChange={setOwnerUserId} />
              <UserPickerField label="Co-owners" users={users} valueUserId={coOwnerUserId} onChange={setCoOwnerUserId} />
            </div>

            <div className="br-ccd-grid2">
              <div className="business-rule-form-field">
                <label className="business-rule-form-label">Deadline</label>
                <DatePickerField
                  dateValue={deadlineDate}
                  onDateChange={(e) => setDeadlineDate(e.target.value)}
                  popperClassName="br-subtask-deadline-popper"
                  renderTrigger={renderDeadlineTrigger}
                />
              </div>
              <div className="business-rule-form-field">
                <label className="business-rule-form-label">Size</label>
                <div className="business-rule-form-select-wrap">
                  <select className="business-rule-form-select" value={size} onChange={(e) => setSize(e.target.value)}>
                    <option value="">Not Set</option>
                    {CREATE_CARD_SIZE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <TagPickerField label="Tags" tags={kanbanTags} valueTagIds={tagIds} onChange={setTagIds} />

            <div className="business-rule-form-field">
              <label className="business-rule-form-label">Custom card ID</label>
              <input
                type="text"
                className="business-rule-form-input"
                value={customCardId}
                onChange={(e) => setCustomCardId(e.target.value)}
              />
            </div>

            <div className="br-ccd-subsection">
              <div className="br-ccd-divider">
                <button
                  type="button"
                  className="br-ccd-divider-pill"
                  onClick={() => setIsCustomFieldsExpanded((v) => !v)}
                  aria-expanded={isCustomFieldsExpanded}
                >
                  Custom fields
                  {isCustomFieldsExpanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                </button>
                <div className="br-ccd-divider-icons">
                  <span className="br-ccd-divider-icon-btn" aria-hidden><FiMaximize2 size={13} /></span>
                  <span className="br-ccd-divider-icon-btn" aria-hidden><FiShare2 size={13} /></span>
                </div>
              </div>
              {isCustomFieldsExpanded && (
                <div className="br-ccd-custom-fields-list">
                  {isLoadingCustomFields ? (
                    <div className="br-property-picker-empty">Loading...</div>
                  ) : displayCustomFields.length === 0 ? (
                    <div className="br-property-picker-empty">No custom fields found</div>
                  ) : (
                    displayCustomFields.map((field, idx) => {
                      const key = field.custom_field_id ?? idx;
                      const kind = classifyCustomFieldUiKind(field.field_label);
                      return (
                        <div key={key} className="business-rule-form-field br-ccd-custom-field-row">
                          <label className="business-rule-form-label">{field.field_label}</label>
                          {kind === 'none' ? (
                            <div className="br-property-picker-empty">Not settable from this panel</div>
                          ) : (
                            <input
                              type={kind === 'date' ? 'date' : 'text'}
                              className="business-rule-form-input"
                              value={customFieldValues[field.field_label] ?? ''}
                              onChange={(e) => setCustomFieldValues((prev) => ({ ...prev, [field.field_label]: e.target.value }))}
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div className="br-property-section br-ccd-subsection">
              <button
                type="button"
                className="br-property-section-toggle"
                onClick={() => setIsSubtasksExpanded((v) => !v)}
              >
                <span className="br-property-section-toggle-icon">
                  {isSubtasksExpanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                </span>
                Subtasks
              </button>
              {isSubtasksExpanded && (
                <div className="br-ccd-subtasks">
                  {subtaskTitles.length > 0 && (
                    <ul className="br-ccd-subtask-list">
                      {subtaskTitles.map((st, idx) => (
                        <li key={`${st}-${idx}`} className="br-ccd-subtask-row">
                          <span>{st}</span>
                          <button type="button" onClick={() => handleRemoveSubtask(idx)} aria-label="Remove subtask">
                            <FiX size={12} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <input
                    type="text"
                    className="br-ccd-subtask-input"
                    placeholder="Press ctrl/cmd + enter to create new subtask"
                    value={subtaskDraft}
                    onChange={(e) => setSubtaskDraft(e.target.value)}
                    onKeyDown={handleSubtaskDraftKeyDown}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className="br-ccd-footer">
          <div className="br-ccd-crumb">
            {destinationLabel ? (
              <>
                Board <span className="br-ccd-crumb-value">{destinationLabel}</span>
                {action?.workflowName && (<><span className="br-ccd-crumb-sep">/</span>Workflow <span className="br-ccd-crumb-value">{action.workflowName}</span></>)}
                {action?.swimlaneName && (<><span className="br-ccd-crumb-sep">/</span>Swimlane <span className="br-ccd-crumb-value">{action.swimlaneName}</span></>)}
              </>
            ) : 'No destination picked yet'}
          </div>

          <div className="br-ccd-stagerow">
            {stageDots.length > 0 && (
              <div className="br-ccd-stages">
                {stageDots.map((dot) => {
                  const isCurrent = String(dot.id) === String(action?.stageId);
                  return (
                    <span key={dot.id} className={`br-ccd-dot${isCurrent ? ' br-ccd-dot--current' : ''}`} style={{ '--dot-color': dot.color }}>
                      {isCurrent && <span className="br-ccd-dot-label">{dot.name}</span>}
                    </span>
                  );
                })}
              </div>
            )}
            <button type="button" className="br-ccd-save-btn" onClick={handleSave}>
              Save details
            </button>
          </div>
        </footer>
      </div>
    </Modal>
  );
}

CreateCardDetailsModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  action: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    boardId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    boardName: PropTypes.string,
    workspaceName: PropTypes.string,
    workflowId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    workflowName: PropTypes.string,
    stageId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    swimlaneName: PropTypes.string,
    cardTitle: PropTypes.string,
    cardDescription: PropTypes.string,
    fieldValues: PropTypes.array,
    subtaskTitles: PropTypes.array,
  }),
  users: PropTypes.array,
  kanbanTags: PropTypes.array,
  triggerTypeId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

function ShareWithModal({ show, onClose, permissions, onSave }) {
  const [filterText, setFilterText] = useState('');
  const [draftPermissions, setDraftPermissions] = useState(permissions);
  const [isSharedFilterActive, setIsSharedFilterActive] = useState(false);
  const { users, usersLoading, getUsers } = useCommonReducer((s) => s);

  useEffect(() => {
    if (!show) return;
    setFilterText('');
    setDraftPermissions(permissions);
    setIsSharedFilterActive(Object.values(permissions).some((p) => p.viewer || p.editor));
    if (users.length === 0 && !usersLoading) getUsers({ params: { limit: 200 } });
  }, [show]);

  const handleToggleDraftPermission = (userId, type) => {
    setDraftPermissions((prev) => {
      const current = prev[userId] ?? { viewer: false, editor: false };
      if (type === 'viewer') {
        if (current.editor) return prev;
        return { ...prev, [userId]: { ...current, viewer: !current.viewer } };
      }
      const nextEditor = !current.editor;
      return {
        ...prev,
        [userId]: { viewer: nextEditor ? true : current.viewer, editor: nextEditor },
      };
    });
  };

  const handleClearSharedFilter = () => setIsSharedFilterActive(false);

  const handleCancel = () => {
    setDraftPermissions(permissions);
    onClose();
  };

  const handleSave = () => {
    onSave?.(draftPermissions);
    onClose();
  };

  const filterQuery = filterText.trim().toLowerCase();
  const baseUsers = isSharedFilterActive
    ? users.filter((user) => {
        const perm = draftPermissions[user.user_id];
        return perm && (perm.viewer || perm.editor);
      })
    : users;
  const filteredUsers = filterQuery
    ? baseUsers.filter((user) =>
        (user.name ?? '').toLowerCase().includes(filterQuery) || (user.username ?? '').toLowerCase().includes(filterQuery)
      )
    : baseUsers;

  return (
    <Modal
      show={show}
      onHide={handleCancel}
      className="card-property-match-modal"
      dialogClassName="card-property-match-modal-dialog"
      backdropClassName="card-property-match-modal-backdrop"
      centered
      scrollable
    >
      <div className="card-property-match-modal-shell">
        <header className="card-property-match-modal-header">
          <h2 className="card-property-match-modal-title">Shared with</h2>
          <button
            type="button"
            className="business-rule-form-modal-close"
            onClick={handleCancel}
            aria-label="Close"
          >
            <FiX size={20} />
          </button>
        </header>

        <div className="card-property-match-modal-body">
          <div className="share-with-filter-row">
            <span className="share-with-filter-icon" aria-hidden>
              <FiFilter size={14} />
            </span>
            {isSharedFilterActive && (
              <span className="share-with-filter-chip">
                Shared with
                <button
                  type="button"
                  className="share-with-filter-chip-remove"
                  onClick={handleClearSharedFilter}
                  aria-label="Clear shared with filter"
                >
                  <FiX size={12} />
                </button>
              </span>
            )}
            <input
              type="text"
              className="share-with-filter-input"
              placeholder="Filter"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              autoFocus
            />
          </div>

          <div className="share-with-table">
            <div className="share-with-table-head">
              <span>Name</span>
              <span>Username</span>
              <span>Viewer</span>
              <span>Editor</span>
            </div>
            {usersLoading ? (
              <div className="br-property-picker-empty">Loading...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="br-property-picker-empty">No users found</div>
            ) : (
              filteredUsers.map((user) => {
                const perm = draftPermissions[user.user_id] ?? { viewer: false, editor: false };
                return (
                  <div key={user.user_id} className="share-with-row">
                    <span className="share-with-name">{user.name}</span>
                    <span className="share-with-username">
                      <span className="share-with-avatar" aria-hidden>{getInitials(user.name)}</span>
                      {user.username}
                    </span>
                    <label className={`business-rule-form-toggle share-with-toggle${perm.editor ? ' business-rule-form-toggle--disabled' : ''}`}>
                      <input
                        type="checkbox"
                        checked={perm.viewer}
                        disabled={perm.editor}
                        onChange={() => handleToggleDraftPermission(user.user_id, 'viewer')}
                      />
                      <span className="business-rule-form-toggle-track" aria-hidden />
                    </label>
                    <label className="business-rule-form-toggle share-with-toggle">
                      <input
                        type="checkbox"
                        checked={perm.editor}
                        onChange={() => handleToggleDraftPermission(user.user_id, 'editor')}
                      />
                      <span className="business-rule-form-toggle-track" aria-hidden />
                    </label>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <footer className="card-property-match-modal-footer share-with-modal-footer">
          <button type="button" className="share-with-cancel-btn" onClick={handleCancel}>
            Cancel
          </button>
          <button type="button" className="br-property-add-btn" onClick={handleSave}>
            Save
          </button>
        </footer>
      </div>
    </Modal>
  );
}

ShareWithModal.propTypes = {
  show: PropTypes.bool,
  onClose: PropTypes.func,
  permissions: PropTypes.object,
  onSave: PropTypes.func,
};

function BusinessRuleFormModal({ show, rule: ruleProp, businessRuleId, boardName, onClose, onSave, isSaving, isCopyMode }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [owner, setOwner] = useState('');
  const [ownerUserId, setOwnerUserId] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [isOwnerPickerOpen, setIsOwnerPickerOpen] = useState(false);
  const [ownerFilterText, setOwnerFilterText] = useState('');
  const ownerPickerTriggerRef = useRef(null);
  const ownerPickerPanelRef = useRef(null);
  const [sharePermissions, setSharePermissions] = useState({});
  const [showShareModal, setShowShareModal] = useState(false);
  const [disallowTriggerChain, setDisallowTriggerChain] = useState(false);
  const [conditions, setConditions] = useState([]);
  const [showPropertyPicker, setShowPropertyPicker] = useState(false);
  const editingConditionIdRef = useRef(null);
  const [whenFields, setWhenFields] = useState([]);
  const [showWhenFieldPicker, setShowWhenFieldPicker] = useState(false);
  const [createActions, setCreateActions] = useState([]);
  const [showCreateActionPicker, setShowCreateActionPicker] = useState(false);
  const [showCreateTemplatePicker, setShowCreateTemplatePicker] = useState(false);
  const [showCreateDetailsPicker, setShowCreateDetailsPicker] = useState(false);
  const [showCreateCardDetailsModal, setShowCreateCardDetailsModal] = useState(false);
  const [activeCreateActionId, setActiveCreateActionId] = useState(null);
  const [showCopyCardDetailsPicker, setShowCopyCardDetailsPicker] = useState(false);
  const [showCreateCardFieldsModal, setShowCreateCardFieldsModal] = useState(false);
  const [linkActions, setLinkActions] = useState([]);
  const [showLinkActionPicker, setShowLinkActionPicker] = useState(false);
  const editingLinkActionIdRef = useRef(null);
  const [openLinkOperatorRowId, setOpenLinkOperatorRowId] = useState(null);
  const [linkOperatorFilterText, setLinkOperatorFilterText] = useState('');
  const linkOperatorTriggerRef = useRef(null);
  const linkOperatorPanelRef = useRef(null);
  const [removeOtherLinksByType, setRemoveOtherLinksByType] = useState({});
  // User-picker dropdown for "people list" update actions (Add/Remove co-owners,
  // Add watcher) — one shared open-row id + filter text, mirroring the link-operator
  // per-row dropdown pattern above.
  const [openUpdateUserRowId, setOpenUpdateUserRowId] = useState(null);
  const [updateUserFilterText, setUpdateUserFilterText] = useState('');
  const updateUserTriggerRef = useRef(null);
  const updateUserPanelRef = useRef(null);
  // Same pattern as the update-user picker above, for the sticker-list update actions
  // (Add/Remove stickers).
  const [openUpdateStickerRowId, setOpenUpdateStickerRowId] = useState(null);
  const [updateStickerFilterText, setUpdateStickerFilterText] = useState('');
  const updateStickerTriggerRef = useRef(null);
  const updateStickerPanelRef = useRef(null);
  // "once ⌄ / every time" frequency dropdown next to the sticker action label — one
  // shared open-action id + filter text, mirroring the link-operator dropdown pattern.
  const [openUpdateFrequencyActionId, setOpenUpdateFrequencyActionId] = useState(null);
  const [updateFrequencyFilterText, setUpdateFrequencyFilterText] = useState('');
  const updateFrequencyTriggerRef = useRef(null);
  const updateFrequencyPanelRef = useRef(null);
  // Single-value blocker picker for the "Set blocker" update action — one shared
  // open-action id + filter text, same pattern as the frequency dropdown above (no
  // per-row AND/trash since set_blocker only ever holds one value).
  const [openUpdateBlockerActionId, setOpenUpdateBlockerActionId] = useState(null);
  const [updateBlockerFilterText, setUpdateBlockerFilterText] = useState('');
  const updateBlockerTriggerRef = useRef(null);
  const updateBlockerPanelRef = useRef(null);
  // Single-value color picker for the "Set color" update action — reuses the same
  // SedresColorPicker popover already wired up for condition color values below,
  // with its own open-action id so the two never fight over one piece of state.
  const [openUpdateColorActionId, setOpenUpdateColorActionId] = useState(null);
  const updateColorTriggerRef = useRef(null);
  const updateColorPanelRef = useRef(null);
  // Single-value type picker for the "Set type" update action — mirrors the blocker
  // picker above, sourced from cardTypes instead of cardBlockers.
  const [openUpdateTypeActionId, setOpenUpdateTypeActionId] = useState(null);
  const [updateTypeFilterText, setUpdateTypeFilterText] = useState('');
  const updateTypeTriggerRef = useRef(null);
  const updateTypePanelRef = useRef(null);
  // Single-value owner picker for the "Set owner" update action — same shape as the
  // type/blocker pickers but against the `users` list (avatar initials instead of a
  // color+icon swatch).
  const [openUpdateOwnerActionId, setOpenUpdateOwnerActionId] = useState(null);
  const [updateOwnerFilterText, setUpdateOwnerFilterText] = useState('');
  const updateOwnerTriggerRef = useRef(null);
  const updateOwnerPanelRef = useRef(null);
  // Single-value priority picker for the "Set priority" update action — same shape as
  // the type/blocker pickers but against the static PRIORITY_OPTIONS enum (no fetch).
  const [openUpdatePriorityActionId, setOpenUpdatePriorityActionId] = useState(null);
  const [updatePriorityFilterText, setUpdatePriorityFilterText] = useState('');
  const updatePriorityTriggerRef = useRef(null);
  const updatePriorityPanelRef = useRef(null);
  // Shared "mode" dropdown for the actions whose header carries a small two-option
  // picker next to the label (append/replace for Set milestones/Set tags, relative/
  // absolute for Set deadline) — one shared open-action id, mirroring the frequency
  // dropdown pattern but resolving its option list per action.key at render time.
  const [openUpdateModeActionId, setOpenUpdateModeActionId] = useState(null);
  const [updateModeFilterText, setUpdateModeFilterText] = useState('');
  const updateModeTriggerRef = useRef(null);
  const updateModePanelRef = useRef(null);
  // Multi-select tag picker for the "Set tags" update action's value row.
  const [openUpdateTagsActionId, setOpenUpdateTagsActionId] = useState(null);
  const [updateTagsFilterText, setUpdateTagsFilterText] = useState('');
  const updateTagsTriggerRef = useRef(null);
  const updateTagsPanelRef = useRef(null);
  // Multi-select weekday picker for the "Set deadline" action's Non-working days row.
  const [openUpdateNonWorkingActionId, setOpenUpdateNonWorkingActionId] = useState(null);
  const [updateNonWorkingFilterText, setUpdateNonWorkingFilterText] = useState('');
  const updateNonWorkingTriggerRef = useRef(null);
  const updateNonWorkingPanelRef = useRef(null);
  const [moveActions, setMoveActions] = useState([]);
  const [showMoveDestinationPicker, setShowMoveDestinationPicker] = useState(false);
  const [activeMoveActionId, setActiveMoveActionId] = useState(null);
  const [convertSubtaskActions, setConvertSubtaskActions] = useState([]);
  const [showConvertDestinationPicker, setShowConvertDestinationPicker] = useState(false);
  const [activeConvertActionId, setActiveConvertActionId] = useState(null);
  // "Update the parent/child card details" — its own repeatable action list (see
  // ACTION_GROUP_TYPE_TO_SECTION_ID's update_parent_card/update_child_card comment).
  // Each instance carries its own fields-to-update chips plus its own nested
  // "if parent/child card matches this filter" property chips.
  const [updateRelatedActions, setUpdateRelatedActions] = useState([]);
  const [showUpdateRelatedFieldPicker, setShowUpdateRelatedFieldPicker] = useState(false);
  const [activeUpdateRelatedActionId, setActiveUpdateRelatedActionId] = useState(null);
  // "Copy the values of these fields from the child into the parent" — a third
  // repeatable action list alongside update_related/move on cross-card triggers;
  // same shape as update_related: field-to-copy chips plus its own nested
  // "if parent card matches this filter" property chips.
  const [copyValuesActions, setCopyValuesActions] = useState([]);
  const [showCopyValuesFieldPicker, setShowCopyValuesFieldPicker] = useState(false);
  const [activeCopyValuesActionId, setActiveCopyValuesActionId] = useState(null);
  // Shared by both the move and update-related sections' nested "if parent/child card
  // matches this filter" property picker — only one such picker can be open at a time,
  // so a single { section, actionId } target is enough to route the picked field back
  // to the right action's filterProperties array.
  const [showRelatedFilterPicker, setShowRelatedFilterPicker] = useState(false);
  const [activeRelatedFilterTarget, setActiveRelatedFilterTarget] = useState(null);
  const [updateActions, setUpdateActions] = useState([]);
  const [showUpdateActionPicker, setShowUpdateActionPicker] = useState(false);
  const [notifyActions, setNotifyActions] = useState([]);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [activeNotifyActionId, setActiveNotifyActionId] = useState(null);
  const [invokeActions, setInvokeActions] = useState([]);
  const [showWebInvokeSettings, setShowWebInvokeSettings] = useState(false);
  const [activeInvokeActionId, setActiveInvokeActionId] = useState(null);
  // "Create subtask" is one of the options inside the generic "Create Card or Subtask"
  // picker (CREATE_ACTION_OPTIONS' 'subtask' key) — its Owner/Deadline/Description
  // settings live on that same createActions entry, not a separate action list.
  const [showCreateSubtaskSettings, setShowCreateSubtaskSettings] = useState(false);
  const [activeCreateSubtaskActionId, setActiveCreateSubtaskActionId] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  // Edit mode only: THEN groups whose saved data has no reliable inverse mapping back into
  // the editable chip UI (update_parent_card/update_child_card, copy_values_to_parent,
  // execute_at, and create-subtask create actions) — rendered as a read-only key/value
  // dump instead, keyed by the THEN section id they'd otherwise belong to.
  const [rawSummaryBySectionId, setRawSummaryBySectionId] = useState({});
  const [boardConditionRows, setBoardConditionRows] = useState([{ id: 'board-0', boardId: '', joinWord: 'OR' }]);
  // The first-board auto-fill effect below must only ever apply once per modal-open
  // session — otherwise a late-resolving (or re-fetched) workspaces list can silently
  // refill the board condition after the user has explicitly cleared it via the row's
  // own delete button, since that resets boardId back to '' and looks identical to the
  // untouched initial state the effect is meant to default.
  const boardConditionDefaultAppliedRef = useRef(false);
  // "Position" (board + swimlane/stage) is a second default condition some triggers carry
  // alongside "Board" — get_field_details/regular/6 only returns operators (is/is not), not
  // an actual list of positions, so this reuses the board-minimap destination picker (the
  // same one "Move the card" uses) as the value picker instead of a plain dropdown.
  const [positionConditionRows, setPositionConditionRows] = useState([
    { id: 'position-0', boardId: '', boardName: '', swimlaneId: '', swimlaneName: '', stageId: '', stageName: '', joinWord: 'OR' },
  ]);
  const [showPositionDestinationPicker, setShowPositionDestinationPicker] = useState(false);
  const [activePositionRowId, setActivePositionRowId] = useState(null);
  const [openColorConditionId, setOpenColorConditionId] = useState(null);
  const colorConditionTriggerRef = useRef(null);
  const colorConditionPanelRef = useRef(null);
  const [openConditionOperatorId, setOpenConditionOperatorId] = useState(null);
  const [conditionOperatorFilterText, setConditionOperatorFilterText] = useState('');
  const conditionOperatorTriggerRef = useRef(null);
  const conditionOperatorPanelRef = useRef(null);

  // Recurring-schedule triggers (when_type "regular_fields", e.g. "Recurring create cards")
  // pick their repeat pattern from this fixed set (matches the reference product — no
  // backend catalog for this yet, get_regular_fields returns nothing for this trigger).
  const [recurrenceSchedule, setRecurrenceSchedule] = useState('every_day');
  const [showRecurrenceUnitPicker, setShowRecurrenceUnitPicker] = useState(false);
  const [executeAtTime, setExecuteAtTime] = useState('00:00');
  const [showExecuteTimePicker, setShowExecuteTimePicker] = useState(false);
  const [executeTimeFilterText, setExecuteTimeFilterText] = useState('');
  const executeTimeTriggerRef = useRef(null);
  const executeTimePanelRef = useRef(null);

  // Deadline-based triggers (when_type 'deadline', e.g. "Time-based rule", trigger_type_id 9)
  // — "Deadline is in/was more than [N] day(s)". No backend catalog for the comparison word
  // or a when-side property shape yet, so the comparison list is a fixed local set and the
  // day count is a plain number, both best-effort until confirmed against a real save payload.
  const [whenDeadlineComparison, setWhenDeadlineComparison] = useState(WHEN_DEADLINE_COMPARISON_OPTIONS[0].key);
  const [whenDeadlineDays, setWhenDeadlineDays] = useState(0);
  const [showWhenDeadlineComparisonPicker, setShowWhenDeadlineComparisonPicker] = useState(false);
  const [whenDeadlineComparisonFilterText, setWhenDeadlineComparisonFilterText] = useState('');
  const whenDeadlineComparisonTriggerRef = useRef(null);
  const whenDeadlineComparisonPanelRef = useRef(null);

  const {
    getTriggerConfig, triggerConfig, isLoadingTriggerConfig, getFieldDetails, fieldDetailsByKey, isLoadingFieldDetails,
    linkCardActionOperators, isLoadingLinkCardActionOperators, getLinkCardPossibleActionOperators,
    getNotificationSettings, notificationSettings, isLoadingNotificationSettings, resetNotificationSettings,
    getNotificationSettingsPreview,
    getRecipientCustomFields, recipientCustomFields,
    deleteNotificationSettings,
    getWebServiceSettings, webServiceSettings, isLoadingWebServiceSettings, resetWebServiceSettings,
    getWebServiceSettingsPreview,
    timeUnits, getTimeUnits,
    deleteWebServiceSettings,
    deleteCreateSubtaskSettings,
    getCreateSubtaskSettings, createSubtaskSettings, isLoadingCreateSubtaskSettings, resetCreateSubtaskSettings,
    getCreateSubtaskSettingsPreview,
    getBusinessRuleById, businessRuleDetails, isLoadingBusinessRuleDetails, resetBusinessRuleDetails,
    regularFields, getRegularFields,
    getExecutionLogs, executionLogs, isLoadingExecutionLogs, resetExecutionLogs,
    exportExecutionLogsFile, isLoadingExportExecutionLogs,
    getBusinessRuleHistory, businessRuleHistory, isLoadingBusinessRuleHistory, resetBusinessRuleHistory,
  } = useBusinessRuleReducer((s) => s);
  const { users, usersLoading, getUsers } = useCommonReducer((s) => s);
  const { workspaces, listAllWorkspaces } = useWorkSpaceReducer((s) => s);
  const {
    cardStickers, cardStickersLoading, fetchKanbanCardStickers,
    cardBlockers, cardBlockersLoading, fetchKanbanCardBlockers,
    cardTypes, cardTypesLoading, fetchKanbanCardTypes,
    tags: kanbanTags, tagsLoading: kanbanTagsLoading, fetchKanbanTags,
  } = useKanbanManagementReducer((s) => s);
  const userProfile = useAuthReducer((s) => s.userProfile);
  const loggedInUserId = userProfile?.user_id ?? userProfile?.userid ?? null;
  const loggedInUserName = userProfile?.name || userProfile?.username || 'You';

  // Edit mode (businessRuleId set) sources `rule` from the fetched business rule's own
  // trigger info instead of the create-flow's trigger-picker prop, so every existing
  // `rule.id`/`rule.name` usage below (getTriggerConfig, header text, field-picker
  // triggerTypeId props) keeps working unchanged regardless of which mode is active.
  const isEditMode = Boolean(businessRuleId);
  const businessRuleDetailsReady = isEditMode
    && businessRuleDetails
    && String(businessRuleDetails.business_rule_id) === String(businessRuleId);
  // Memoized so its object identity only changes when the underlying data actually
  // does — several existing effects key their dependency array on `rule` itself (not
  // `rule?.id`), so a fresh object literal every render here would re-fire them every
  // render too (infinite update loop).
  const rule = useMemo(() => {
    if (!isEditMode) return ruleProp;
    if (!businessRuleDetailsReady) return null;
    return {
      id: Number(businessRuleDetails.trigger_type_id),
      name: businessRuleDetails.trigger_name,
      icon: TRIGGER_CODE_TO_ICON[businessRuleDetails.trigger_code],
      description: '',
    };
  }, [
    isEditMode, businessRuleDetailsReady, ruleProp,
    businessRuleDetails?.trigger_type_id, businessRuleDetails?.trigger_name, businessRuleDetails?.trigger_code,
  ]);
  const isEditDataLoading = isEditMode && (isLoadingBusinessRuleDetails || !businessRuleDetailsReady);
  const [activeTab, setActiveTab] = useState('details');

  // Execution logs tab — defaults to the trailing 7 days, matching the reference UI.
  const toDateInputValue = (date) => date.toISOString().slice(0, 10);
  const [logsFromDate, setLogsFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toDateInputValue(d);
  });
  const [logsFromTime, setLogsFromTime] = useState('00:00');
  const [logsToDate, setLogsToDate] = useState(() => toDateInputValue(new Date()));
  const [logsToTime, setLogsToTime] = useState('23:59');
  const [logsSearch, setLogsSearch] = useState('');
  const [debouncedLogsSearch, setDebouncedLogsSearch] = useState('');

  // History tab
  const [historySearch, setHistorySearch] = useState('');
  const [debouncedHistorySearch, setDebouncedHistorySearch] = useState('');

  // Edit mode needs the full regular/custom field catalog up front to resolve a saved
  // condition's/when-field's regular_field_id or custom_field_id back into a display
  // label — the create flow never needs this at the top level since CardPropertyMatchModal
  // (below) fetches its own copy lazily, scoped to whichever picker the user has open.
  const { customFields: editModeCustomFields } = useCustomFieldsByTrigger({
    show: show && isEditMode, triggerTypeId: rule?.id, boardId: null, showDisabled: true, search: '',
  });

  useEffect(() => {
    if (!show || !isEditMode) return;
    getBusinessRuleById(businessRuleId);
  }, [show, isEditMode, businessRuleId]);

  useEffect(() => {
    if (!show || !isEditMode || !rule?.id) return;
    getRegularFields({ params: { trigger_type_id: rule.id } });
  }, [show, isEditMode, rule?.id]);

  useEffect(() => {
    if (!show) resetBusinessRuleDetails();
  }, [show]);

  useEffect(() => {
    if (show) setActiveTab('details');
  }, [show, businessRuleId]);

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedLogsSearch(logsSearch.trim()), 400);
    return () => clearTimeout(timeoutId);
  }, [logsSearch]);

  useEffect(() => {
    if (!show || !isEditMode || activeTab !== 'logs' || !businessRuleId) return;
    getExecutionLogs(businessRuleId, {
      params: {
        search: debouncedLogsSearch || undefined,
        from: logsFromDate ? `${logsFromDate}` : undefined,
        to: logsToDate ? `${logsToDate}` : undefined,
      },
    });
  }, [show, isEditMode, activeTab, businessRuleId, debouncedLogsSearch, logsFromDate, logsToDate]);

  useEffect(() => {
    if (!show) resetExecutionLogs();
  }, [show]);

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedHistorySearch(historySearch.trim()), 400);
    return () => clearTimeout(timeoutId);
  }, [historySearch]);

  useEffect(() => {
    if (!show || !isEditMode || activeTab !== 'history' || !businessRuleId) return;
    getBusinessRuleHistory(businessRuleId, { params: { search: debouncedHistorySearch || undefined } });
  }, [show, isEditMode, activeTab, businessRuleId, debouncedHistorySearch]);

  useEffect(() => {
    if (!show) resetBusinessRuleHistory();
  }, [show]);

  // The WHEN card is seeded from the picker's already-fetched trigger (get_trigger_types),
  // but once get_trigger_config resolves for this trigger_type_id, its trigger_name is the
  // fresher, authoritative value — same source of truth as the AND/THEN columns below.
  const whenTriggerName = triggerConfig?.trigger_name || rule?.name;

  // Drives the AND section from the selected trigger type's own config instead of
  // always showing the "Card is created" (trigger_type_id 1) layout.
  const andHeaderText = triggerConfig?.and_header || 'the created card matches this filter';
  const hasBoardDefaultCondition = (triggerConfig?.default_conditions ?? [])
    .some((c) => String(c.field_label ?? '').trim().toLowerCase() === 'board');
  const hasPositionDefaultCondition = (triggerConfig?.default_conditions ?? [])
    .some((c) => String(c.field_label ?? '').trim().toLowerCase() === 'position');

  // Drives the THEN column from the selected trigger type's own action catalog
  // (get_trigger_config's `actions`, ordered by display_order) instead of always
  // showing every action section for every trigger type.
  const triggerActions = triggerConfig?.actions ?? [];
  const sortedTriggerActions = [...triggerActions].sort(
    (a, b) => Number(a.display_order ?? 0) - Number(b.display_order ?? 0)
  );
  // group_types with no mapped section id still render (as a generic, read-only
  // section) instead of silently vanishing — a backend action seeded with a
  // group_type this form doesn't know how to build a picker for yet is a signal
  // to add it to ACTION_GROUP_TYPE_TO_SECTION_ID, not something the user should
  // see fewer actions than the API actually returned.
  const thenActionSections = sortedTriggerActions.length > 0
    ? sortedTriggerActions.map((action) => {
      const mappedId = ACTION_GROUP_TYPE_TO_SECTION_ID[action.group_type];
      return mappedId
        ? { id: mappedId, title: action.action_name }
        : { id: 'generic', key: `generic-${action.action_type_id}`, title: action.action_name, action };
    })
    : (import.meta.env.DEV ? THEN_ACTION_SECTIONS : []);

  // Each THEN action section fetches its own regular/custom/time-unit field catalog
  // from get_then_action_fields, keyed by this trigger's action_type_id for that
  // group_type (get_trigger_config's actions[] carries one per group_type).
  const createActionMeta = sortedTriggerActions.find((a) => a.group_type === 'create_cards' || a.group_type === 'create_card_recurring');
  const createActionTypeId = createActionMeta?.action_type_id;
  // A recurring/scheduled trigger has no originating card, so the relational create
  // variants (child/parent/predecessor/relative/successor) in CREATE_ACTION_OPTIONS
  // don't apply — only a plain "Create card" ever makes sense here. Skip the type
  // picker entirely and go straight to "Add new action" → the board/destination picker.
  const isRecurringCreateAction = createActionMeta?.group_type === 'create_card_recurring';
  const updateActionTypeId = sortedTriggerActions.find((a) => a.group_type === 'update_card')?.action_type_id;

  // Resolved once per trigger: which cross-card direction (if any) this trigger's own
  // move/update-related action applies to, so the nested filter block can read
  // "if parent card matches this filter" vs "if child card matches this filter" — and
  // be skipped entirely for the plain same-card move_card case (neither flag set).
  const moveRelatedActionMeta = sortedTriggerActions.find((a) =>
    a.group_type === 'move_parent_card' || a.group_type === 'move_child_card'
  );
  const moveRelatedFilterLabel = moveRelatedActionMeta?.has_parent_filter === '1'
    ? 'parent'
    : moveRelatedActionMeta?.has_child_filter === '1' ? 'child' : null;

  const updateRelatedActionMeta = sortedTriggerActions.find((a) =>
    a.group_type === 'update_parent_card' || a.group_type === 'update_child_card'
  );
  const updateRelatedActionTypeId = updateRelatedActionMeta?.action_type_id;
  const updateRelatedFilterLabel = updateRelatedActionMeta?.has_parent_filter === '1'
    ? 'parent'
    : updateRelatedActionMeta?.has_child_filter === '1' ? 'child' : null;

  const copyValuesActionMeta = sortedTriggerActions.find((a) =>
    a.group_type === 'copy_values_to_parent' || a.group_type === 'copy_values_to_child'
  );
  const copyValuesActionTypeId = copyValuesActionMeta?.action_type_id;
  const copyValuesFilterLabel = copyValuesActionMeta?.has_child_filter === '1'
    ? 'child'
    : copyValuesActionMeta?.has_parent_filter === '1' ? 'parent' : 'parent';

  useEffect(() => {
    if (!show || !rule) return;
    getTriggerConfig(rule.id);
    if (users.length === 0 && !usersLoading) getUsers({ params: { limit: 200 } });
    if (cardStickers.length === 0 && !cardStickersLoading) fetchKanbanCardStickers({ limit: 200 });
    if (cardBlockers.length === 0 && !cardBlockersLoading) fetchKanbanCardBlockers({ limit: 200 });
    if (cardTypes.length === 0 && !cardTypesLoading) fetchKanbanCardTypes({ per_page: 200 });
    if (kanbanTags.length === 0 && !kanbanTagsLoading) fetchKanbanTags({ per_page: 200 });
    if (workspaces.length === 0) listAllWorkspaces();
    setBoardConditionRows([{ id: 'board-0', boardId: '', joinWord: 'OR' }]);
    boardConditionDefaultAppliedRef.current = false;
    setPositionConditionRows([{ id: 'position-0', boardId: '', boardName: '', swimlaneId: '', swimlaneName: '', stageId: '', stageName: '', joinWord: 'OR' }]);
    setShowPositionDestinationPicker(false);
    setActivePositionRowId(null);
    setName(rule.name ?? '');
    setDescription(rule.description ?? '');
    setTags([]);
    setTagInput('');
    setOwner(loggedInUserName);
    setOwnerUserId(loggedInUserId);
    setIsOwnerPickerOpen(false);
    setOwnerFilterText('');
    setSharePermissions({});
    setShowShareModal(false);
    setDisallowTriggerChain(false);
    setSaveError('');
    setConditions([]);
    setShowPropertyPicker(false);
    setWhenFields([]);
    setShowWhenFieldPicker(false);
    setCreateActions([]);
    setShowCreateActionPicker(false);
    setShowCopyCardDetailsPicker(false);
    setLinkActions([]);
    setShowLinkActionPicker(false);
    editingLinkActionIdRef.current = null;
    setOpenLinkOperatorRowId(null);
    setLinkOperatorFilterText('');
    setRemoveOtherLinksByType({});
    setMoveActions([]);
    setShowMoveDestinationPicker(false);
    setActiveMoveActionId(null);
    setConvertSubtaskActions([]);
    setShowConvertDestinationPicker(false);
    setActiveConvertActionId(null);
    setUpdateRelatedActions([]);
    setShowUpdateRelatedFieldPicker(false);
    setActiveUpdateRelatedActionId(null);
    setCopyValuesActions([]);
    setShowCopyValuesFieldPicker(false);
    setActiveCopyValuesActionId(null);
    setShowRelatedFilterPicker(false);
    setActiveRelatedFilterTarget(null);
    setUpdateActions([]);
    setShowUpdateActionPicker(false);
    setNotifyActions([]);
    setShowNotificationSettings(false);
    resetNotificationSettings();
    setActiveNotifyActionId(null);
    setInvokeActions([]);
    setShowWebInvokeSettings(false);
    resetWebServiceSettings();
    setActiveInvokeActionId(null);
    setShowCreateSubtaskSettings(false);
    resetCreateSubtaskSettings();
    setActiveCreateSubtaskActionId(null);
    setShowCancelConfirm(false);
    setRawSummaryBySectionId({});
    setRecurrenceSchedule('every_day');
    setShowRecurrenceUnitPicker(false);
    setExecuteAtTime('00:00');
    if (timeUnits.length === 0) getTimeUnits();
  }, [show, rule, loggedInUserName, loggedInUserId]);

  // Overwrites the blank defaults the reset effect above just seeded, once the fetched
  // rule's data is ready — runs after that effect within the same commit (both are keyed
  // off `rule`/`businessRuleDetailsReady` flipping together), so there's nothing to see
  // in between.
  useEffect(() => {
    if (!isEditMode || !businessRuleDetailsReady) return;
    const details = businessRuleDetails;
    setName(details.rule_name ?? '');
    setDescription(details.description ?? '');
    const tagsText = Array.isArray(details.tags) ? details.tags.join(', ') : (details.tags ?? '');
    setTags(tagsText.split(',').map((t) => t.trim()).filter(Boolean));
    setOwnerUserId(details.owner_user_id ?? null);
    const ownerMatch = [{ user_id: loggedInUserId, name: loggedInUserName }, ...users].find(
      (u) => String(u.user_id) === String(details.owner_user_id)
    );
    setOwner(ownerMatch?.name ?? '');
    setDisallowTriggerChain(String(details.disallow_rule_action_trigger) === '1');
    const nextSharePermissions = {};
    (details.shared_users ?? []).forEach((su) => {
      const userId = su?.user_id ?? su?.id;
      if (userId == null) return;
      nextSharePermissions[userId] = {
        viewer: su?.permission_type !== 'edit',
        editor: su?.permission_type === 'edit',
      };
    });
    setSharePermissions(nextSharePermissions);
  }, [isEditMode, businessRuleDetailsReady, businessRuleDetails, users, loggedInUserId, loggedInUserName]);

  // Resolves a saved condition's/when-field's regular_field_id or custom_field_id back into
  // a display label, using the same field lists CardPropertyMatchModal would otherwise fetch
  // lazily when a user opens it interactively.
  const resolveEditFieldLabel = (fieldType, fieldId) => {
    if (fieldId == null) return '';
    if (fieldType === 'custom') {
      const match = editModeCustomFields.find((f) => String(f.custom_field_id) === String(fieldId));
      return match ? getFieldLabel(match) : `Custom field #${fieldId}`;
    }
    const match = regularFields.find((f) => String(f.regular_field_id) === String(fieldId));
    return match ? getFieldLabel(match) : `Field #${fieldId}`;
  };

  useEffect(() => {
    if (!isEditMode || !businessRuleDetailsReady) return;
    const realWhenFields = (businessRuleDetails.when_fields ?? [])
      .filter((wf) => wf.regular_field_id != null || wf.custom_field_id != null)
      .sort((a, b) => Number(a.display_order ?? 0) - Number(b.display_order ?? 0))
      .map((wf) => {
        const fieldType = wf.regular_field_id != null ? 'regular' : 'custom';
        const fieldId = wf.regular_field_id ?? wf.custom_field_id;
        return {
          id: `when-${wf.when_id}`,
          fieldLabel: resolveEditFieldLabel(fieldType, fieldId),
          category: fieldType,
          fieldType,
          fieldId,
        };
      });
    setWhenFields(realWhenFields);
  }, [isEditMode, businessRuleDetailsReady, businessRuleDetails, regularFields, editModeCustomFields]);

  // Board/position restriction rows carry no field id of their own in the saved rule's flat
  // conditions[] list — best-effort split against this trigger's own default_conditions
  // catalog by field_label, the exact inverse of buildConditions()'s equally best-effort
  // forward mapping in buildBusinessRulePayload.js.
  useEffect(() => {
    if (!isEditMode || !businessRuleDetailsReady) return;
    const rawConditions = businessRuleDetails.conditions ?? [];
    const defaultConditionFor = (label) =>
      (triggerConfig?.default_conditions ?? []).find((c) => String(c.field_label ?? '').trim().toLowerCase() === label);
    const boardDefault = defaultConditionFor('board');
    const positionDefault = defaultConditionFor('position');

    const boardRows = [];
    const positionRows = [];
    const plainConditions = [];

    rawConditions
      .slice()
      .sort((a, b) => Number(a.display_order ?? 0) - Number(b.display_order ?? 0))
      .forEach((cond) => {
        const conditionFieldId = boardDefault?.regular_field_id ?? boardDefault?.field_id;
        if (boardDefault && cond.regular_field_id != null && String(cond.regular_field_id) === String(conditionFieldId)) {
          boardRows.push({ id: `board-${cond.condition_id}`, boardId: cond.input_value ?? '', joinWord: cond.connector || 'OR' });
          return;
        }
        const positionFieldId = positionDefault?.regular_field_id ?? positionDefault?.field_id;
        if (positionDefault && cond.regular_field_id != null && String(cond.regular_field_id) === String(positionFieldId)) {
          const [boardId = '', swimlaneId = '', stageId = ''] = String(cond.input_value ?? '').split(':');
          positionRows.push({
            id: `position-${cond.condition_id}`, boardId, boardName: '', swimlaneId, swimlaneName: '', stageId, stageName: '',
            joinWord: cond.connector || 'OR',
          });
          return;
        }
        plainConditions.push(cond);
      });

    if (boardRows.length > 0) setBoardConditionRows(boardRows);
    if (positionRows.length > 0) setPositionConditionRows(positionRows);

    // Group the flat per-value-row list into one box per distinct field, each with its own
    // values[] — the inverse of how the create-side payload flattens boxes back into rows.
    const boxesByField = new Map();
    plainConditions.forEach((cond) => {
      const fieldType = cond.regular_field_id != null ? 'regular' : cond.custom_field_id != null ? 'custom' : null;
      const fieldId = cond.regular_field_id ?? cond.custom_field_id ?? null;
      if (!fieldType || fieldId == null) return; // time-unit / unresolvable conditions — best-effort skip
      const key = `${fieldType}-${fieldId}`;
      if (!boxesByField.has(key)) {
        const fieldLabel = resolveEditFieldLabel(fieldType, fieldId);
        const isRegularColorField = fieldType === 'regular' && fieldLabel.trim().toLowerCase() === 'color';
        boxesByField.set(key, {
          id: `cond-${cond.condition_id}`,
          fieldLabel,
          fieldKey: key,
          category: fieldType,
          fieldType,
          fieldId,
          valueType: isRegularColorField ? 'color' : null,
          operatorId: '',
          desiredOperatorLabel: cond.operator || '',
          values: [],
        });
      }
      boxesByField.get(key).values.push({
        id: `cond-val-${cond.condition_id}`,
        value: cond.input_value ?? '',
        joinWord: cond.connector || 'OR',
      });
    });
    const nextConditions = Array.from(boxesByField.values());
    setConditions(nextConditions);
    // Guarded — this effect re-runs as regularFields/editModeCustomFields resolve
    // progressively, and re-fetching a field's details it already has (or is already
    // fetching) on every pass just re-triggers a store update that re-renders this
    // whole component (useBusinessRuleReducer selects the whole store), which then
    // recomputes this effect's other deps and churns.
    nextConditions.forEach((box) => {
      const key = `${box.fieldType}-${box.fieldId}`;
      if (fieldDetailsByKey[key] !== undefined || isLoadingFieldDetails[key]) return;
      getFieldDetails(box.fieldType, box.fieldId);
    });
  }, [isEditMode, businessRuleDetailsReady, businessRuleDetails, triggerConfig, regularFields, editModeCustomFields]);

  // Routes each saved then_groups[] entry into whichever of the 9 THEN action arrays it
  // belongs to (via ACTION_GROUP_TYPE_TO_SECTION_ID, the same map the live THEN column
  // already uses to decide which sections to render), inverting each buildThenActions()
  // sub-case in buildBusinessRulePayload.js. Waits on triggerConfig too, since routing
  // depends on that map already being meaningful for this rule's trigger type.
  useEffect(() => {
    if (!isEditMode || !businessRuleDetailsReady || !triggerConfig) return;
    const groups = (businessRuleDetails.then_groups ?? [])
      .slice()
      .sort((a, b) => Number(a.display_order ?? 0) - Number(b.display_order ?? 0));

    const nextCreateActions = [];
    const nextUpdateActions = [];
    const nextLinkActions = [];
    const nextRemoveOtherLinksByType = {};
    const nextMoveActions = [];
    const nextConvertActions = [];
    const nextNotifyActions = [];
    const nextInvokeActions = [];
    const nextRawSummaryBySectionId = {};

    const pushRaw = (sectionId, group) => {
      const key = sectionId ?? group.group_type;
      if (!nextRawSummaryBySectionId[key]) nextRawSummaryBySectionId[key] = [];
      nextRawSummaryBySectionId[key].push(group);
    };

    const propVal = (action, key) => (action.properties ?? []).find((p) => p.property_key === key)?.property_value ?? null;

    const resolveBoardName = (boardId) => {
      if (boardId == null || boardId === '') return '';
      const match = (workspaces ?? []).flatMap((w) => w.boards ?? []).find((b) => String(b.board_id) === String(boardId));
      return match ? match.board_name : `Board #${boardId}`;
    };

    const resolveWorkspaceName = (boardId) => {
      if (boardId == null || boardId === '') return '';
      const owner = (workspaces ?? []).find((w) => (w.boards ?? []).some((b) => String(b.board_id) === String(boardId)));
      return owner?.workspace_name ?? '';
    };

    groups.forEach((group) => {
      const sectionId = ACTION_GROUP_TYPE_TO_SECTION_ID[group.group_type];
      const actions = group.actions ?? [];

      if (sectionId === 'create') {
        actions.forEach((action) => {
          // A subtask create-action has no board/column/title (it's created under the
          // current card, not a new board location) — just relation_type: 'subtask' plus a
          // create_subtask_id referencing its owner/deadline/description record, saved
          // separately via saveCreateSubtaskSettings. Restore it into the same editable chip
          // shape handleSaveCreateSubtaskSettings produces for a live save, so the
          // owner/deadline link shows the real saved settings instead of a dead-end raw dump.
          const relationType = propVal(action, 'relation_type');
          const restoredCreateSubtaskId = action.create_subtask_id ?? propVal(action, 'create_subtask_id');
          if (relationType === 'subtask' || restoredCreateSubtaskId != null) {
            nextCreateActions.push({
              id: `create-${action.then_action_id}`,
              key: 'subtask',
              label: 'Create subtask',
              createSubtaskId: restoredCreateSubtaskId,
              configured: restoredCreateSubtaskId != null,
            });
            return;
          }
          const copyRegular = propVal(action, 'copy_regular_fields');
          const copyCustom = propVal(action, 'copy_custom_fields');
          const createBoardId = propVal(action, 'target_board_id') ?? '';
          nextCreateActions.push({
            id: `create-${action.then_action_id}`,
            key: relationType ?? 'card',
            label: relationType ? `Create ${relationType}` : 'Create card',
            boardId: createBoardId,
            // Same board→workspace/board-name resolve the move/convert branch below already
            // does — without it, the "Configure details" link never picks up the saved
            // destination text and permanently reads as unconfigured after a reload.
            boardName: resolveBoardName(createBoardId),
            workspaceName: resolveWorkspaceName(createBoardId),
            workflowId: propVal(action, 'target_workflow_id') ?? '',
            workflowName: '',
            swimlaneId: propVal(action, 'target_swimlane_id') ?? '',
            swimlaneName: '',
            stageId: propVal(action, 'target_column_id') ?? '',
            stageName: '',
            templateName: propVal(action, 'card_title') ?? '',
            // Feeds the THEN-column Title-status line (green box's typed title) — same
            // saved value as templateName above, restored into both since a saved
            // card_title can't be told apart as "typed" vs "picked from a template".
            title: propVal(action, 'card_title') ?? '',
            copyFields: (copyRegular || copyCustom) ? {
              regularFields: copyRegular ? copyRegular.split(',').map((s) => s.trim()).filter(Boolean) : [],
              customFields: copyCustom ? copyCustom.split(',').map((s) => s.trim()).filter(Boolean) : [],
            } : undefined,
          });
        });
        return;
      }

      if (sectionId === 'update') {
        actions.forEach((action) => {
          const fieldKey = propVal(action, 'field_key');
          const fieldValue = propVal(action, 'field_value');
          // Exact match first; falls back to a substring check either direction (e.g. a
          // live field_key of "Card Color" or "card_color" wouldn't equal 'Color' outright)
          // — same fragile-label problem as the create-action relation-type matching
          // elsewhere in this file, which is why "Set color" restored as a plain "Set Set
          // color to" text input instead of the real color-swatch UI below.
          const normalizedFieldKey = String(fieldKey ?? '').trim().toLowerCase();
          const matchedOption = UPDATE_ACTION_OPTIONS.find((opt) => opt.field.toLowerCase() === normalizedFieldKey)
            ?? UPDATE_ACTION_OPTIONS.find((opt) => {
              const optField = opt.field.toLowerCase();
              return normalizedFieldKey.includes(optField) || optField.includes(normalizedFieldKey);
            });
          const isUserRef = matchedOption && USER_REFERENCE_UPDATE_KEYS.includes(matchedOption.key);
          const isStickerRef = matchedOption && STICKER_UPDATE_KEYS.includes(matchedOption.key);
          const isListModeRef = matchedOption && LIST_MODE_UPDATE_KEYS.includes(matchedOption.key);
          const isDeadlineRef = matchedOption && DEADLINE_UPDATE_KEYS.includes(matchedOption.key);
          nextUpdateActions.push({
            id: `update-${action.then_action_id}`,
            category: matchedOption ? 'action' : 'custom',
            key: matchedOption?.key ?? `custom-${fieldKey}`,
            label: matchedOption?.label ?? `Set ${fieldKey ?? ''}`,
            field: fieldKey ?? '',
            rawLabel: fieldKey ?? '',
            ...(isUserRef
              ? {
                values: String(fieldValue ?? '').split(',').map((v) => v.trim()).filter(Boolean).map((userId) => ({
                  id: `${action.then_action_id}-${userId}`,
                  userId,
                  userName: users.find((u) => String(u.user_id) === String(userId))?.name ?? `User #${userId}`,
                })),
              }
              : isStickerRef
                ? {
                  ...(matchedOption.key === 'add_stickers'
                    ? { frequency: propVal(action, 'frequency') || STICKER_ACTION_FREQUENCY_OPTIONS[0].key }
                    : {}),
                  values: String(fieldValue ?? '').split(',').map((v) => v.trim()).filter(Boolean).map((stickerId) => {
                    const sticker = cardStickers.find((s) => String(s.sticker_id) === String(stickerId));
                    return {
                      id: `${action.then_action_id}-${stickerId}`,
                      stickerId,
                      stickerName: sticker?.label ?? `Sticker #${stickerId}`,
                      stickerColor: sticker?.color_code ?? '',
                      stickerIcon: sticker?.icon ?? '',
                    };
                  }),
                }
                : isListModeRef
                  ? {
                    mode: propVal(action, 'list_mode') || LIST_UPDATE_MODE_OPTIONS[0].key,
                    ...(matchedOption.key === 'set_tags'
                      ? {
                        tagIds: String(fieldValue ?? '').split(',').map((v) => v.trim()).filter(Boolean),
                      }
                      : { value: fieldValue ?? '' }),
                  }
                  : isDeadlineRef
                    ? {
                      mode: propVal(action, 'deadline_mode') || DEADLINE_MODE_OPTIONS[0].key,
                      deadlineDays: propVal(action, 'deadline_days') || 0,
                      deadlineDate: propVal(action, 'deadline_date') || '',
                      nonWorkingDays: String(propVal(action, 'non_working_days') ?? '').split(',').map((v) => v.trim()).filter(Boolean),
                    }
                    : { value: fieldValue ?? '' }),
          });
        });
        return;
      }

      if (sectionId === 'link') {
        actions.forEach((action) => {
          (action.link_card ?? [])
            .slice()
            .sort((a, b) => Number(a.display_order ?? 0) - Number(b.display_order ?? 0))
            .forEach((row) => {
              let target = nextLinkActions.find((a) => a.key === row.relation_type && a.operatorKey === row.operator_key);
              if (!target) {
                const optionMeta = LINK_ACTION_OPTIONS.find((o) => o.key === row.relation_type);
                target = {
                  id: `link-${row.link_card_id}`,
                  key: row.relation_type,
                  label: optionMeta?.label ?? `Link as ${row.relation_type}`,
                  operatorKey: row.operator_key,
                  operatorLabel: row.operator_key,
                  values: [],
                };
                nextLinkActions.push(target);
              }
              target.values.push({ id: `link-val-${row.link_card_id}`, value: row.input_value ?? '' });
              if (String(row.remove_other) === '1') nextRemoveOtherLinksByType[row.relation_type] = true;
            });
        });
        return;
      }

      if (sectionId === 'move' || sectionId === 'convert') {
        const targetArray = sectionId === 'move' ? nextMoveActions : nextConvertActions;
        actions.forEach((action) => {
          const boardId = propVal(action, 'target_board_id');
          targetArray.push({
            id: `${sectionId}-${action.then_action_id}`,
            key: sectionId === 'move' ? 'move_to' : 'convert_to',
            label: sectionId === 'move' ? 'Move card to' : 'Convert subtasks to',
            boardId: boardId ?? '',
            boardName: resolveBoardName(boardId),
            workspaceName: resolveWorkspaceName(boardId),
            workflowId: propVal(action, 'target_workflow_id') ?? '',
            workflowName: '',
            swimlaneId: propVal(action, 'target_swimlane_id') ?? '',
            swimlaneName: '',
            stageId: propVal(action, 'target_column_id') ?? '',
            stageName: '',
            filterProperties: [],
          });
        });
        return;
      }

      if (sectionId === 'notify') {
        actions.forEach((action) => {
          nextNotifyActions.push({
            id: `notify-${action.then_action_id}`, key: 'send_notification', label: 'Send notification',
            notification_id: action.notification_id ?? null,
            // Without this, a saved notify action always reads "Not Set" on reopen —
            // `configured` only ever got set by handleSaveNotificationSettings (live
            // edits), never by this restore-from-API path.
            configured: action.notification_id != null,
          });
        });
        return;
      }

      if (sectionId === 'invoke') {
        actions.forEach((action) => {
          nextInvokeActions.push({
            id: `invoke-${action.then_action_id}`, key: 'invoke_web_service', label: 'Invoke web service',
            webServiceId: action.web_service_id ?? null,
            // Same restore gap as notify actions above — configured only got set on
            // live save, so a saved invoke action always read "Not Set" on reopen.
            configured: action.web_service_id != null,
          });
        });
        return;
      }

      // update_related / copy_values / execute_at / anything else — no reliable forward
      // mapping exists to invert (per confirmed scope), so it's always shown as a raw
      // read-only summary rather than forced into editable-looking fields.
      pushRaw(sectionId, group);
    });

    setCreateActions(nextCreateActions);
    setUpdateActions(nextUpdateActions);
    setLinkActions(nextLinkActions);
    setRemoveOtherLinksByType(nextRemoveOtherLinksByType);
    setMoveActions(nextMoveActions);
    setConvertSubtaskActions(nextConvertActions);
    setNotifyActions(nextNotifyActions);
    setInvokeActions(nextInvokeActions);
    setRawSummaryBySectionId(nextRawSummaryBySectionId);

    // workflowName/swimlaneName/stageName can't be resolved from `workspaces` (board list
    // only, no stage/swimlane layout) the way boardName is above — each referenced board's
    // actual structure has to be fetched. Without this, a saved move/convert/create
    // destination permanently reads as "Any stage / Any lane" (workflow name blank too)
    // on reopen, even though a real stage/swimlane was picked, until the user reopens the
    // Board Minimap picker and re-saves it.
    const destinationActions = [...nextCreateActions, ...nextMoveActions, ...nextConvertActions]
      .filter((a) => a.boardId && (a.workflowId || a.stageId || a.swimlaneId));
    const boardIdsToResolve = [...new Set(destinationActions.map((a) => String(a.boardId)))];
    if (boardIdsToResolve.length > 0) {
      Promise.all(boardIdsToResolve.map((id) => workflowService.getWorkflowByBoard(id)
        .then(({ data }) => {
          const source = data?.status === 'success' ? data?.data : data;
          const list = Array.isArray(source) ? source : source ? [source] : [];
          return [id, buildBoardMinimapWorkflows(list)];
        })
        .catch(() => [id, []])))
        .then((entries) => {
          const minimapByBoardId = new Map(entries);
          const resolveNames = (action) => {
            const workflows = minimapByBoardId.get(String(action.boardId));
            const workflow = workflows?.find((wf) => String(wf.id) === String(action.workflowId));
            if (!workflow) return action;
            return {
              ...action,
              workflowName: workflow.name ?? action.workflowName,
              stageName: workflow.leafColumns.find((c) => String(c.id) === String(action.stageId))?.name ?? action.stageName,
              swimlaneName: workflow.swimlanes.find((s) => String(s.id) === String(action.swimlaneId))?.name ?? action.swimlaneName,
            };
          };
          setCreateActions((prev) => prev.map(resolveNames));
          setMoveActions((prev) => prev.map(resolveNames));
          setConvertSubtaskActions((prev) => prev.map(resolveNames));
        });
    }
  }, [isEditMode, businessRuleDetailsReady, businessRuleDetails, triggerConfig, workspaces, users, cardStickers]);

  // The THEN-column notify card shows the actual saved subject (as pills) instead of a
  // generic "Configured" label — needs each restored notify action's subject fetched up
  // front rather than waiting for the user to open its settings modal. Uses the read-only
  // preview fetch (not getNotificationSettings/notificationSettings) so this doesn't race
  // or clobber whichever notify action the settings modal itself has open.
  useEffect(() => {
    if (!isEditMode) return;
    notifyActions
      .filter((a) => a.notification_id && a.subjectParts === undefined)
      .forEach((action) => {
        getNotificationSettingsPreview(action.notification_id).then((settings) => {
          // Always resolve to at least [] (never leave subjectParts undefined) so a
          // failed fetch doesn't get retried on every subsequent notifyActions change —
          // it just falls back to the generic "Configured" label instead.
          const subjectParts = settings ? parseSubjectString(settings.subject ?? '') : [];
          setNotifyActions((prev) => prev.map((a) => (a.id === action.id ? { ...a, subjectParts } : a)));
        });
      });
  }, [isEditMode, notifyActions]);

  // Same restore-preview treatment as notify actions above — the THEN-column "Create
  // subtask" card shows the actual saved owner/deadline/description instead of a generic
  // "Configured" label, fetched up front via the read-only preview call.
  useEffect(() => {
    if (!isEditMode) return;
    createActions
      .filter((a) => isCreateSubtaskAction(a) && a.createSubtaskId && a.previewLoaded === undefined)
      .forEach((action) => {
        getCreateSubtaskSettingsPreview(action.createSubtaskId).then((settings) => {
          setCreateActions((prev) => prev.map((a) => (a.id === action.id ? {
            ...a,
            previewLoaded: true,
            ownerUserId: settings?.owner_user_id ?? '',
            deadline: settings?.deadline ?? '',
            description: settings?.description ?? '',
          } : a)));
        });
      });
  }, [isEditMode, createActions]);

  // Same restore-preview treatment as notify/create-subtask above — the THEN-column
  // "Invoke web service" card shows the actual saved service name instead of a generic
  // "Configured" label, fetched up front via the read-only preview call.
  useEffect(() => {
    if (!isEditMode) return;
    invokeActions
      .filter((a) => a.webServiceId && a.serviceName === undefined)
      .forEach((action) => {
        getWebServiceSettingsPreview(action.webServiceId).then((settings) => {
          setInvokeActions((prev) => prev.map((a) => (a.id === action.id ? { ...a, serviceName: settings?.service_name ?? '' } : a)));
        });
      });
  }, [isEditMode, invokeActions]);

  useEffect(() => {
    if (!isOwnerPickerOpen) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (ownerPickerPanelRef.current?.contains(t)) return;
      if (ownerPickerTriggerRef.current?.contains(t)) return;
      setIsOwnerPickerOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [isOwnerPickerOpen]);

  useEffect(() => {
    if (openColorConditionId == null) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (colorConditionPanelRef.current?.contains(t)) return;
      if (colorConditionTriggerRef.current?.contains(t)) return;
      setOpenColorConditionId(null);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [openColorConditionId]);

  useEffect(() => {
    if (openConditionOperatorId == null) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (conditionOperatorPanelRef.current?.contains(t)) return;
      if (conditionOperatorTriggerRef.current?.contains(t)) return;
      setOpenConditionOperatorId(null);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [openConditionOperatorId]);

  useEffect(() => {
    if (!showWhenDeadlineComparisonPicker) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (whenDeadlineComparisonPanelRef.current?.contains(t)) return;
      if (whenDeadlineComparisonTriggerRef.current?.contains(t)) return;
      setShowWhenDeadlineComparisonPicker(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [showWhenDeadlineComparisonPicker]);

  useEffect(() => {
    if (!showExecuteTimePicker) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (executeTimePanelRef.current?.contains(t)) return;
      if (executeTimeTriggerRef.current?.contains(t)) return;
      setShowExecuteTimePicker(false);
      setExecuteTimeFilterText('');
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [showExecuteTimePicker]);

  useEffect(() => {
    if (openLinkOperatorRowId == null) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (linkOperatorPanelRef.current?.contains(t)) return;
      if (linkOperatorTriggerRef.current?.contains(t)) return;
      setOpenLinkOperatorRowId(null);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [openLinkOperatorRowId]);

  useEffect(() => {
    if (openUpdateUserRowId == null) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (updateUserPanelRef.current?.contains(t)) return;
      if (updateUserTriggerRef.current?.contains(t)) return;
      setOpenUpdateUserRowId(null);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [openUpdateUserRowId]);

  useEffect(() => {
    if (openUpdateStickerRowId == null) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (updateStickerPanelRef.current?.contains(t)) return;
      if (updateStickerTriggerRef.current?.contains(t)) return;
      setOpenUpdateStickerRowId(null);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [openUpdateStickerRowId]);

  useEffect(() => {
    if (openUpdateFrequencyActionId == null) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (updateFrequencyPanelRef.current?.contains(t)) return;
      if (updateFrequencyTriggerRef.current?.contains(t)) return;
      setOpenUpdateFrequencyActionId(null);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [openUpdateFrequencyActionId]);

  useEffect(() => {
    if (openUpdateBlockerActionId == null) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (updateBlockerPanelRef.current?.contains(t)) return;
      if (updateBlockerTriggerRef.current?.contains(t)) return;
      setOpenUpdateBlockerActionId(null);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [openUpdateBlockerActionId]);

  useEffect(() => {
    if (openUpdateColorActionId == null) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (updateColorPanelRef.current?.contains(t)) return;
      if (updateColorTriggerRef.current?.contains(t)) return;
      setOpenUpdateColorActionId(null);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [openUpdateColorActionId]);

  useEffect(() => {
    if (openUpdateTypeActionId == null) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (updateTypePanelRef.current?.contains(t)) return;
      if (updateTypeTriggerRef.current?.contains(t)) return;
      setOpenUpdateTypeActionId(null);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [openUpdateTypeActionId]);

  useEffect(() => {
    if (openUpdateOwnerActionId == null) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (updateOwnerPanelRef.current?.contains(t)) return;
      if (updateOwnerTriggerRef.current?.contains(t)) return;
      setOpenUpdateOwnerActionId(null);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [openUpdateOwnerActionId]);

  useEffect(() => {
    if (openUpdatePriorityActionId == null) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (updatePriorityPanelRef.current?.contains(t)) return;
      if (updatePriorityTriggerRef.current?.contains(t)) return;
      setOpenUpdatePriorityActionId(null);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [openUpdatePriorityActionId]);

  useEffect(() => {
    if (openUpdateModeActionId == null) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (updateModePanelRef.current?.contains(t)) return;
      if (updateModeTriggerRef.current?.contains(t)) return;
      setOpenUpdateModeActionId(null);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [openUpdateModeActionId]);

  useEffect(() => {
    if (openUpdateTagsActionId == null) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (updateTagsPanelRef.current?.contains(t)) return;
      if (updateTagsTriggerRef.current?.contains(t)) return;
      setOpenUpdateTagsActionId(null);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [openUpdateTagsActionId]);

  useEffect(() => {
    if (openUpdateNonWorkingActionId == null) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (updateNonWorkingPanelRef.current?.contains(t)) return;
      if (updateNonWorkingTriggerRef.current?.contains(t)) return;
      setOpenUpdateNonWorkingActionId(null);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [openUpdateNonWorkingActionId]);

  useEffect(() => {
    if (!show || boardConditionDefaultAppliedRef.current) return;
    const firstBoard = (workspaces ?? []).flatMap((w) => w.boards ?? [])[0];
    if (!firstBoard) return;
    boardConditionDefaultAppliedRef.current = true;
    setBoardConditionRows((prev) =>
      prev.length === 1 && !prev[0].boardId ? [{ ...prev[0], boardId: firstBoard.board_id }] : prev
    );
  }, [show, workspaces]);

  // update_parent_card/update_child_card and move_parent_card/move_child_card aren't
  // optional, many-instance actions the way create/link/notify/invoke are — a trigger
  // that carries one of these only ever carries exactly one, and it's the whole point
  // of the trigger (e.g. "Child card is moved" exists to update/move the parent). So
  // unlike those optional sections, this one instance is auto-created as soon as the
  // trigger config loads, instead of waiting for an explicit "Add new action" click.
  useEffect(() => {
    if (!show || !triggerConfig) return;
    const actions = triggerConfig.actions ?? [];
    if (actions.some((a) => a.group_type === 'update_parent_card' || a.group_type === 'update_child_card')) {
      setUpdateRelatedActions((prev) => (prev.length === 0
        ? [{ id: Date.now(), fields: [], filterProperties: [] }]
        : prev));
    }
    if (actions.some((a) => a.group_type === 'move_parent_card' || a.group_type === 'move_child_card')) {
      const option = MOVE_ACTION_OPTIONS[0];
      setMoveActions((prev) => (prev.length === 0
        ? [{
          id: Date.now(), key: option.key, label: option.label,
          boardId: '', boardName: '', swimlaneId: '', swimlaneName: '', stageId: '', stageName: '',
          filterProperties: [],
        }]
        : prev));
    }
    if (actions.some((a) => a.group_type === 'copy_values_to_parent' || a.group_type === 'copy_values_to_child')) {
      setCopyValuesActions((prev) => (prev.length === 0
        ? [{ id: Date.now(), fields: [], filterProperties: [] }]
        : prev));
    }
    // "Recurring create cards" always shows one "Create card" row open by default
    // (per product requirement) instead of requiring an "Add new action" click first —
    // a recurring/scheduled trigger has no originator card, so the only option is ever
    // a plain "Create card" (see isRecurringCreateAction below).
    if (actions.some((a) => a.group_type === 'create_card_recurring')) {
      setCreateActions((prev) => (prev.length === 0
        ? [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, key: 'card', label: 'Create card' }]
        : prev));
    }
  }, [show, triggerConfig]);

  // Default each condition's operator to the first option (usually "is") as soon as its
  // field details load, so the row reads "Label is" instead of a blank "Select operator".
  // A prefilled (edit-mode) condition carries its own `desiredOperatorLabel` — the operator
  // label the saved rule actually used — so it's matched by label instead of defaulting to
  // the first option, once this trigger's own operator list for that field has loaded.
  // Also re-runs when `conditions` itself changes (e.g. edit-mode restoring boxes for a
  // field whose details were already cached from an earlier picker interaction) — keying
  // this only on fieldDetailsByKey meant a restored box whose field details were already
  // cached never got its operatorId resolved, since nothing would ever fire the effect
  // again for it. Safe against loops: once every condition already has an operatorId,
  // `changed` stays false and the updater returns the same `prev` reference, which bails
  // out of the state update.
  useEffect(() => {
    setConditions((prev) => {
      let changed = false;
      const next = prev.map((cond) => {
        if (cond.operatorId) return cond;
        const detailsKey = cond.fieldType && cond.fieldId != null ? `${cond.fieldType}-${cond.fieldId}` : null;
        const operators = detailsKey ? fieldDetailsByKey[detailsKey]?.operators : null;
        if (!operators || operators.length === 0) return cond;
        changed = true;
        const desiredMatch = cond.desiredOperatorLabel
          ? operators.find((op) => (op.operator_label || '').trim().toLowerCase() === cond.desiredOperatorLabel.trim().toLowerCase())
          : null;
        return { ...cond, operatorId: (desiredMatch ?? operators[0]).field_operator_id };
      });
      return changed ? next : prev;
    });
  }, [fieldDetailsByKey, conditions]);

  if (isEditMode && show && isEditDataLoading) {
    return (
      <Modal
        show={show}
        onHide={onClose}
        className="business-rule-form-modal"
        dialogClassName="business-rule-form-modal-dialog"
        backdropClassName="business-rule-form-modal-backdrop"
        centered={false}
        backdrop="static"
      >
        <div className="business-rule-form-modal-shell">
          <header className="business-rule-form-modal-header">
            <h2 className="business-rule-form-modal-title">{isCopyMode ? 'Copy Business Rule' : 'Edit Business Rule'}</h2>
            <button type="button" className="business-rule-form-modal-close" onClick={onClose} aria-label="Close">
              <FiX size={20} />
            </button>
          </header>
          <div className="business-rule-form-modal-body business-rule-form-loading-body">
            <div className="spinner-border spinner-border-sm" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  if (!rule) return null;

  const handleSave = () => {
    const formState = {
      triggerRuleId: rule.id,
      name: name.trim(),
      description: description.trim(),
      tags,
      ownerUserId,
      sharePermissions,
      disallowTriggerChain,
      whenFields,
      boardConditionRows,
      positionConditionRows,
      conditions,
      createActions,
      linkActions,
      removeOtherLinksByType,
      moveActions,
      convertSubtaskActions,
      updateActions,
      updateRelatedActions,
      copyValuesActions,
      notifyActions,
      invokeActions,
      // Then-groups the routing effect couldn't invert into editable state (create-subtask,
      // update_parent/child_card, copy_values_to_*, execute_at) — passed through as-is by
      // buildThenActions' raw fallback so an edit save doesn't wipe them from the rule.
      rawThenActionGroups: Object.values(rawSummaryBySectionId).flat(),
    };

    const unconfigured = getUnconfiguredActionLabels(formState);
    if (unconfigured.length > 0) {
      setSaveError(`Finish configuring these actions before saving: ${unconfigured.join(', ')}.`);
      return;
    }
    setSaveError('');

    const payload = isEditMode
      ? buildUpdateBusinessRulePayload(formState, {
        loggedInUserId,
        triggerConfig,
        fieldDetailsByKey,
        // Preserve the rule's current enabled state — this form has no enable/disable
        // input of its own (that lives in the table row switch), so update must not
        // silently flip it.
        isEnabled: Number(businessRuleDetails?.is_enabled ?? businessRuleDetails?.status ?? 0) === 1,
      })
      : buildCreateBusinessRulePayload(formState, { loggedInUserId, triggerConfig, fieldDetailsByKey });
    onSave?.(payload);
  };

  const otherOwnerUsers = users.filter((u) => String(u.user_id) !== String(loggedInUserId));
  const ownerUsers = [
    {
      user_id: loggedInUserId, name: loggedInUserName, username: userProfile?.username ?? null,
      email: userProfile?.email ?? null, role: userProfile?.role ?? null, port: userProfile?.port ?? null, phone: userProfile?.phone ?? null,
    },
    ...otherOwnerUsers.map((u) => ({
      user_id: u.user_id, name: u.name, username: u.username, email: u.email, role: u.role, port: u.port, phone: u.phone,
    })),
  ];
  const ownerFilterQuery = ownerFilterText.trim().toLowerCase();
  const filteredOwnerUsers = ownerFilterQuery
    ? ownerUsers.filter((u) => u.name.toLowerCase().includes(ownerFilterQuery))
    : ownerUsers;

  const handlePickOwner = (user) => {
    setOwner(user.name);
    setOwnerUserId(user.user_id);
    setIsOwnerPickerOpen(false);
    setOwnerFilterText('');
  };

  const handleSaveSharePermissions = (nextPermissions) => {
    setSharePermissions(nextPermissions);
  };

  const sharedUsers = users.filter((u) => {
    const perm = sharePermissions[u.user_id];
    return perm && (perm.viewer || perm.editor);
  });

  const handleAddTag = () => {
    const value = tagInput.trim();
    if (!value) return;
    setTags((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setTagInput('');
  };

  const handleTagInputKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  };

  const handleRemoveTag = (idx) => {
    setTags((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleOpenPropertyPicker = () => {
    editingConditionIdRef.current = null;
    setShowPropertyPicker(true);
  };

  const handleOpenPropertyPickerForRow = (id) => {
    editingConditionIdRef.current = id;
    setShowPropertyPicker(true);
  };

  const handleSelectProperty = (field, category) => {
    const fieldType = category.category_key === 'custom' ? 'custom' : category.category_key === 'regular' ? 'regular' : null;
    const fieldId = field.regular_field_id ?? field.custom_field_id ?? null;
    const isRegularColorField = category.category_key === 'regular' && getFieldLabel(field).trim().toLowerCase() === 'color';
    const fieldProps = {
      fieldLabel: getFieldLabel(field),
      fieldKey: field.field_key ?? field.unit_key ?? String(field.regular_field_id ?? field.time_unit_id ?? field.custom_field_id ?? ''),
      category: category.category_key,
      fieldType,
      fieldId,
      valueType: category.category_key === 'custom' ? (field.field_type ?? null) : (isRegularColorField ? 'color' : null),
      operatorId: '',
    };
    // A blank value row for the newly picked field — re-picking a field for an
    // existing box resets its values too, since a stale value from the old field
    // type (e.g. a hex color) wouldn't make sense under the new one.
    const blankValues = [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, value: '', joinWord: 'OR' }];

    const editingId = editingConditionIdRef.current;
    if (editingId) {
      editingConditionIdRef.current = null;
      setConditions((prev) => prev.map((c) => (c.id === editingId ? { ...c, ...fieldProps, values: blankValues } : c)));
    } else {
      setConditions((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ...fieldProps, values: blankValues }]);
    }

    if (fieldType && fieldId != null) {
      getFieldDetails(fieldType, fieldId);
    }
  };

  // Removes an entire property box (all of its value rows).
  const handleRemoveCondition = (id) => {
    setConditions((prev) => prev.filter((c) => c.id !== id));
  };

  // Clears every AND-column addition (Position is / custom property boxes, and any
  // extra "Board is" rows) back to their untouched default state, same as the
  // Create/Link "Clear all" footers. The remaining single "Board is" row keeps its
  // selected board — clearing it here would drop the board, which users don't expect
  // from this button.
  const handleClearAndConditions = () => {
    setBoardConditionRows((prev) => (prev.length > 1 ? [prev[0]] : prev));
    setPositionConditionRows([
      { id: 'position-0', boardId: '', boardName: '', swimlaneId: '', swimlaneName: '', stageId: '', stageName: '', joinWord: 'OR' },
    ]);
    setConditions([]);
  };

  // "When fields" (shown only for trigger types where get_trigger_config reports
  // has_when_fields === '1', e.g. "Card is updated") record which field(s) must
  // change for the rule to fire — no operator/value, just the field itself.
  const handleOpenWhenFieldPicker = () => setShowWhenFieldPicker(true);

  const handleSelectWhenField = (field, category) => {
    const fieldType = category.category_key === 'custom' ? 'custom' : category.category_key === 'regular' ? 'regular' : null;
    const fieldId = field.regular_field_id ?? field.custom_field_id ?? null;
    setWhenFields((prev) => [...prev, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fieldLabel: getFieldLabel(field),
      category: category.category_key,
      fieldType,
      fieldId,
    }]);
  };

  const handleRemoveWhenField = (id) => {
    setWhenFields((prev) => prev.filter((f) => f.id !== id));
  };

  // Removes a single value row from a box; removes the whole box once its last
  // value row is gone instead of leaving an empty, header-only box behind.
  const handleRemoveConditionValue = (boxId, valueId) => {
    setConditions((prev) =>
      prev
        .map((c) => (c.id === boxId ? { ...c, values: c.values.filter((v) => v.id !== valueId) } : c))
        .filter((c) => c.id !== boxId || c.values.length > 0)
    );
  };

  // Clicking a value row's join-word pill duplicates that value (same value) directly
  // below it, inside the same box — it does not flip the pill's own AND/OR value.
  // Time unit fields never allow multiple values per box, so this is a no-op for them.
  const handleToggleConditionJoinWord = (boxId, valueId) => {
    setConditions((prev) =>
      prev.map((c) => {
        if (c.id !== boxId || c.category === 'time_unit') return c;
        const rowIndex = c.values.findIndex((v) => v.id === valueId);
        if (rowIndex === -1) return c;
        const newValue = { ...c.values[rowIndex], id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
        const nextValues = [...c.values];
        nextValues.splice(rowIndex + 1, 0, newValue);
        return { ...c, values: nextValues };
      })
    );
  };

  const handleApplyConditionColor = (boxId, valueId, hex) => {
    const normalized = normalizeHexColor(hex);
    setConditions((prev) =>
      prev.map((c) =>
        c.id === boxId
          ? { ...c, values: c.values.map((v) => (v.id === valueId ? { ...v, value: normalized } : v)) }
          : c
      )
    );
    setOpenColorConditionId(null);
  };

  const handleToggleConditionOperator = (id) => {
    setConditionOperatorFilterText('');
    setOpenConditionOperatorId((prev) => (prev === id ? null : id));
  };

  const handleSelectConditionOperator = (id, operator) => {
    // Negative operators ("is not", "does not contain", ...) imply AND across values
    // ("is not X AND is not Y"); any other operator implies OR ("is X OR Y") —
    // switching back from a negative operator must revert the join word, not just
    // leave whatever it was set to before.
    const isNegation = isNegativeOperatorLabel(operator.operator_label);
    setConditions((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, operatorId: operator.field_operator_id, values: c.values.map((v) => ({ ...v, joinWord: isNegation ? 'AND' : 'OR' })) }
          : c
      )
    );
    setOpenConditionOperatorId(null);
  };

  const handleSelectCreateAction = (option) => {
    setCreateActions((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, key: option.key, label: option.label },
    ]);
  };

  const handleRemoveCreateAction = (id) => {
    // Only a "Create subtask" action that was actually saved on the backend
    // (has a createSubtaskId) needs the delete call — one still unconfigured/
    // unsaved, or a different create-action type, has nothing to remove server-side.
    const action = createActions.find((a) => a.id === id);
    if (action?.createSubtaskId) {
      deleteCreateSubtaskSettings(action.createSubtaskId, {
        cb: () => setCreateActions((prev) => prev.filter((a) => a.id !== id)),
      });
    } else {
      setCreateActions((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const handleClearCreateActions = () => {
    // Same rule as handleRemoveCreateAction: only "Create subtask" entries saved on
    // the backend (createSubtaskId) need a delete call before they can be cleared.
    const actionsToDelete = createActions.filter((a) => a.createSubtaskId);
    setCreateActions((prev) => prev.filter((a) => a.createSubtaskId));
    actionsToDelete.forEach((action) => {
      deleteCreateSubtaskSettings(action.createSubtaskId, {
        cb: () => setCreateActions((prev) => prev.filter((a) => a.id !== action.id)),
      });
    });
  };

  const handleOpenCreateTemplatePicker = (id) => {
    setActiveCreateActionId(id);
    setShowCreateTemplatePicker(true);
  };

  const handleSelectCreateTemplate = (templateName) => {
    setCreateActions((prev) => prev.map((a) => (a.id === activeCreateActionId ? { ...a, templateName } : a)));
    setShowCreateTemplatePicker(false);
  };

  const handleOpenCreateDetails = (id) => {
    setActiveCreateActionId(id);
    const action = createActions.find((a) => a.id === id);
    const isRelational = getRelationTypeFromLabel(action?.label) != null;
    // A destination already picked (boardId set) on a plain "Create card" action means the
    // button now shows that destination instead of "Configure details" — re-clicking it goes
    // straight to editing the card details rather than re-picking the board from scratch.
    // Relational creates (child/parent/...) have no CreateCardDetailsModal step, so they
    // always go back through the Board Minimap.
    if (action?.boardId && !isRelational) {
      setShowCreateCardDetailsModal(true);
    } else {
      setShowCreateDetailsPicker(true);
    }
  };

  // The "title will be copied..." summary (shown once Title is in copyFields) re-opens
  // Copy Card Details directly instead of the board minimap — the destination is already
  // set, so re-picking the board isn't what clicking this line means to the user.
  const handleOpenCopyCardDetails = (id) => {
    setActiveCreateActionId(id);
    setShowCopyCardDetailsPicker(true);
  };

  // Once a destination is set and Title isn't being copied from the originator, the THEN
  // summary shows the literal title typed in the "green box" (CreateCardFieldsModal) —
  // clicking it reopens that modal directly rather than routing back through the board
  // minimap / Copy Card Details steps that already happened.
  const handleOpenCreateCardFieldsModal = (id) => {
    setActiveCreateActionId(id);
    setShowCreateCardFieldsModal(true);
  };

  // Recurring-schedule triggers only ever create a plain card (no originator to
  // relate a child/parent/... to), so "Add new action" skips the create-type picker
  // and goes straight to a "Create card" row. The board/destination picker (board
  // minimap) only opens when the user clicks that row's "Configure details" link.
  const handleAddRecurringCreateAction = () => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setCreateActions((prev) => [...prev, { id, key: 'card', label: 'Create card' }]);
  };

  const handleSaveCreateDetails = (destination) => {
    setCreateActions((prev) => prev.map((a) => (a.id === activeCreateActionId ? { ...a, ...destination } : a)));
    // Every create-action variant (plain "Create card" included) creates a card linked to
    // the card that triggered the rule, so once a destination is picked they all get one
    // more step: choosing which of that originator card's fields to carry over.
    setShowCopyCardDetailsPicker(true);
  };

  const handleContinueCopyCardDetails = (fields) => {
    setCreateActions((prev) => prev.map((a) => (a.id === activeCreateActionId ? { ...a, copyFields: fields } : a)));
    // Once the rule author has picked which fields to carry, let them also set the actual
    // default values for those fields on the card that will be created.
    setShowCreateCardFieldsModal(true);
  };

  const handleSaveCreateCardFields = (values) => {
    setCreateActions((prev) => prev.map((a) => (a.id === activeCreateActionId ? { ...a, ...values } : a)));
  };

  const handleSaveCreateCardDetails = (details) => {
    setCreateActions((prev) => prev.map((a) => (a.id === activeCreateActionId ? { ...a, ...details } : a)));
  };

  const activeCreateAction = createActions.find((a) => a.id === activeCreateActionId);

  const handleSelectLinkAction = (option) => {
    const editingId = editingLinkActionIdRef.current;
    if (editingId) {
      editingLinkActionIdRef.current = null;
      setLinkActions((prev) => prev.map((a) => (a.id === editingId ? { ...a, key: option.key, label: option.label } : a)));
      return;
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setLinkActions((prev) => [
      ...prev,
      {
        id, key: option.key, label: option.label, operatorKey: '', operatorLabel: 'to card with id',
        values: [{ id: `${id}-0`, value: '' }],
      },
    ]);
  };

  const handleOpenLinkActionPickerForRow = (id) => {
    editingLinkActionIdRef.current = id;
    setShowLinkActionPicker(true);
  };

  const handleRemoveLinkAction = (id) => {
    setLinkActions((prev) => prev.filter((a) => a.id !== id));
    setOpenLinkOperatorRowId((prev) => (prev === id ? null : prev));
  };

  const handleClearLinkActions = () => {
    setLinkActions([]);
    setOpenLinkOperatorRowId(null);
  };

  const handleToggleLinkOperator = (id) => {
    setLinkOperatorFilterText('');
    setOpenLinkOperatorRowId((prev) => (prev === id ? null : id));
    if (linkCardActionOperators.length === 0) getLinkCardPossibleActionOperators();
  };

  const handleSelectLinkOperator = (id, operator) => {
    setLinkActions((prev) => prev.map((a) => (a.id === id
      ? {
        ...a,
        operatorKey: operator.operator_key,
        operatorLabel: operator.operator_label,
        isDynamic: operator.is_dynamic === '1' || operator.is_dynamic === 1,
      }
      : a)));
    setOpenLinkOperatorRowId(null);
  };

  const handleChangeLinkActionValue = (id, rowId, value) => {
    setLinkActions((prev) => prev.map((a) => (a.id === id
      ? { ...a, values: a.values.map((row) => (row.id === rowId ? { ...row, value } : row)) }
      : a)));
  };

  const handleAddLinkActionValueRow = (id) => {
    setLinkActions((prev) => prev.map((a) => (a.id === id
      ? { ...a, values: [...a.values, { id: `${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, value: '' }] }
      : a)));
  };

  const handleRemoveLinkActionValueRow = (id, rowId) => {
    setLinkActions((prev) => prev.map((a) => {
      if (a.id !== id) return a;
      if (a.values.length <= 1) return { ...a, values: [{ id: rowId, value: '' }] };
      return { ...a, values: a.values.filter((row) => row.id !== rowId) };
    }));
  };

  // Dev-only fallback so the operator dropdown can be visually tested without a live backend.
  const rawLinkOperatorOptions = linkCardActionOperators.length > 0
    ? linkCardActionOperators
    : (import.meta.env.DEV ? DUMMY_LINK_ACTION_OPERATORS : []);
  // get_link_card_possible_action_operators has been observed returning entries with
  // distinct operator_id/operator_key but identical operator_label (e.g. two separate
  // "to card with id" rows) — dedupe by the visible label itself, since that's what
  // actually reads as a repeat to the user, not by the (differing) backend id/key.
  const linkOperatorOptions = Array.from(
    new Map(rawLinkOperatorOptions.map((op) => [(op.operator_label || '').trim().toLowerCase(), op])).values()
  );
  const linkOperatorFilterQuery = linkOperatorFilterText.trim().toLowerCase();
  const filteredLinkOperators = linkOperatorFilterQuery
    ? linkOperatorOptions.filter((op) => op.operator_label.toLowerCase().includes(linkOperatorFilterQuery))
    : linkOperatorOptions;

  const updateFrequencyFilterQuery = updateFrequencyFilterText.trim().toLowerCase();
  const filteredUpdateFrequencyOptions = updateFrequencyFilterQuery
    ? STICKER_ACTION_FREQUENCY_OPTIONS.filter((f) => f.label.toLowerCase().includes(updateFrequencyFilterQuery))
    : STICKER_ACTION_FREQUENCY_OPTIONS;

  const updateBlockerFilterQuery = updateBlockerFilterText.trim().toLowerCase();
  const enabledUpdateBlockers = cardBlockers.filter((b) => !isKanbanManagementRowDisabled(b.status));
  const filteredUpdateBlockers = updateBlockerFilterQuery
    ? enabledUpdateBlockers.filter((b) => b.label.toLowerCase().includes(updateBlockerFilterQuery))
    : enabledUpdateBlockers;

  const updateTypeFilterQuery = updateTypeFilterText.trim().toLowerCase();
  const enabledUpdateTypes = cardTypes.filter((t) => !isKanbanManagementRowDisabled(t.status));
  const filteredUpdateTypes = updateTypeFilterQuery
    ? enabledUpdateTypes.filter((t) => t.label.toLowerCase().includes(updateTypeFilterQuery))
    : enabledUpdateTypes;

  const updateOwnerFilterQuery = updateOwnerFilterText.trim().toLowerCase();
  const filteredUpdateOwners = updateOwnerFilterQuery
    ? users.filter((u) => u.name.toLowerCase().includes(updateOwnerFilterQuery))
    : users;

  const updatePriorityFilterQuery = updatePriorityFilterText.trim().toLowerCase();
  const filteredUpdatePriorities = updatePriorityFilterQuery
    ? PRIORITY_OPTIONS.filter((p) => p.label.toLowerCase().includes(updatePriorityFilterQuery))
    : PRIORITY_OPTIONS;

  // Resolves which two-option list the shared "mode" dropdown shows, per action key —
  // append/replace for list fields, relative/absolute for the deadline.
  const getUpdateModeOptions = (actionKey) => (
    DEADLINE_UPDATE_KEYS.includes(actionKey) ? DEADLINE_MODE_OPTIONS : LIST_UPDATE_MODE_OPTIONS
  );
  const updateModeFilterQuery = updateModeFilterText.trim().toLowerCase();

  const updateTagsFilterQuery = updateTagsFilterText.trim().toLowerCase();
  const enabledUpdateTags = kanbanTags.filter((t) => !isKanbanManagementRowDisabled(t.status));
  const filteredUpdateTags = updateTagsFilterQuery
    ? enabledUpdateTags.filter((t) => t.label.toLowerCase().includes(updateTagsFilterQuery))
    : enabledUpdateTags;

  const handleAddMoveAction = () => {
    const option = MOVE_ACTION_OPTIONS[0];
    setMoveActions((prev) => [
      ...prev,
      {
        id: Date.now(), key: option.key, label: option.label,
        boardId: '', boardName: '', workflowId: '', workflowName: '',
        swimlaneId: '', swimlaneName: '', stageId: '', stageName: '',
        filterProperties: [],
      },
    ]);
  };

  const handleRemoveMoveAction = (id) => {
    setMoveActions((prev) => prev.filter((a) => a.id !== id));
  };

  const handleOpenMoveDestination = (id) => {
    setActiveMoveActionId(id);
    setShowMoveDestinationPicker(true);
  };

  const handleSaveMoveDestination = (destination) => {
    setMoveActions((prev) => prev.map((a) => (a.id === activeMoveActionId ? { ...a, ...destination } : a)));
  };

  const activeMoveAction = moveActions.find((a) => a.id === activeMoveActionId);

  const handleAddConvertAction = () => {
    const option = CONVERT_SUBTASK_ACTION_OPTIONS[0];
    setConvertSubtaskActions((prev) => [
      ...prev,
      {
        id: Date.now(), key: option.key, label: option.label,
        boardId: '', boardName: '', workflowId: '', workflowName: '',
        swimlaneId: '', swimlaneName: '', stageId: '', stageName: '',
      },
    ]);
  };

  const handleRemoveConvertAction = (id) => {
    setConvertSubtaskActions((prev) => prev.filter((a) => a.id !== id));
  };

  const handleOpenConvertDestination = (id) => {
    setActiveConvertActionId(id);
    setShowConvertDestinationPicker(true);
  };

  const handleSaveConvertDestination = (destination) => {
    setConvertSubtaskActions((prev) => prev.map((a) => (a.id === activeConvertActionId ? { ...a, ...destination } : a)));
  };

  const activeConvertAction = convertSubtaskActions.find((a) => a.id === activeConvertActionId);

  const handleAddUpdateRelatedAction = () => {
    setUpdateRelatedActions((prev) => [...prev, { id: Date.now(), fields: [], filterProperties: [] }]);
  };

  const handleRemoveUpdateRelatedAction = (id) => {
    setUpdateRelatedActions((prev) => prev.filter((a) => a.id !== id));
  };

  const handleOpenUpdateRelatedFieldPicker = (id) => {
    setActiveUpdateRelatedActionId(id);
    setShowUpdateRelatedFieldPicker(true);
  };

  const handleSelectUpdateRelatedField = (item, meta) => {
    const fieldId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const label = meta.category_key === 'custom' ? getFieldLabel(item) : (item.label ?? getFieldLabel(item));
    setUpdateRelatedActions((prev) => prev.map((a) => (a.id === activeUpdateRelatedActionId
      ? { ...a, fields: [...a.fields, { id: fieldId, fieldLabel: label }] }
      : a)));
  };

  const handleRemoveUpdateRelatedField = (actionId, fieldId) => {
    setUpdateRelatedActions((prev) => prev.map((a) => (a.id === actionId
      ? { ...a, fields: a.fields.filter((f) => f.id !== fieldId) }
      : a)));
  };

  const activeUpdateRelatedAction = updateRelatedActions.find((a) => a.id === activeUpdateRelatedActionId);
  const updateRelatedExistingFieldLabels = (activeUpdateRelatedAction?.fields ?? [])
    .map((f) => f.fieldLabel.trim().toLowerCase());

  const handleAddCopyValuesAction = () => {
    setCopyValuesActions((prev) => [...prev, { id: Date.now(), fields: [], filterProperties: [] }]);
  };

  const handleRemoveCopyValuesAction = (id) => {
    setCopyValuesActions((prev) => prev.filter((a) => a.id !== id));
  };

  const handleOpenCopyValuesFieldPicker = (id) => {
    setActiveCopyValuesActionId(id);
    setShowCopyValuesFieldPicker(true);
  };

  const handleSelectCopyValuesField = (item, meta) => {
    const fieldId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const label = meta.category_key === 'custom' ? getFieldLabel(item) : (item.label ?? getFieldLabel(item));
    setCopyValuesActions((prev) => prev.map((a) => (a.id === activeCopyValuesActionId
      ? { ...a, fields: [...a.fields, { id: fieldId, fieldLabel: label }] }
      : a)));
  };

  const handleRemoveCopyValuesField = (actionId, fieldId) => {
    setCopyValuesActions((prev) => prev.map((a) => (a.id === actionId
      ? { ...a, fields: a.fields.filter((f) => f.id !== fieldId) }
      : a)));
  };

  const activeCopyValuesAction = copyValuesActions.find((a) => a.id === activeCopyValuesActionId);
  const copyValuesExistingFieldLabels = (activeCopyValuesAction?.fields ?? [])
    .map((f) => f.fieldLabel.trim().toLowerCase());

  const handleOpenRelatedFilterPicker = (section, actionId) => {
    setActiveRelatedFilterTarget({ section, actionId });
    setShowRelatedFilterPicker(true);
  };

  const handleAddRelatedFilterProperty = (field) => {
    if (!activeRelatedFilterTarget) return;
    const { section, actionId } = activeRelatedFilterTarget;
    const propId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const prop = { id: propId, fieldLabel: getFieldLabel(field) };
    if (section === 'move') {
      setMoveActions((prev) => prev.map((a) => (a.id === actionId
        ? { ...a, filterProperties: [...(a.filterProperties ?? []), prop] }
        : a)));
    } else if (section === 'update_related') {
      setUpdateRelatedActions((prev) => prev.map((a) => (a.id === actionId
        ? { ...a, filterProperties: [...(a.filterProperties ?? []), prop] }
        : a)));
    } else if (section === 'copy_values') {
      setCopyValuesActions((prev) => prev.map((a) => (a.id === actionId
        ? { ...a, filterProperties: [...(a.filterProperties ?? []), prop] }
        : a)));
    }
  };

  const handleRemoveRelatedFilterProperty = (section, actionId, propId) => {
    if (section === 'move') {
      setMoveActions((prev) => prev.map((a) => (a.id === actionId
        ? { ...a, filterProperties: (a.filterProperties ?? []).filter((p) => p.id !== propId) }
        : a)));
    } else if (section === 'update_related') {
      setUpdateRelatedActions((prev) => prev.map((a) => (a.id === actionId
        ? { ...a, filterProperties: (a.filterProperties ?? []).filter((p) => p.id !== propId) }
        : a)));
    } else if (section === 'copy_values') {
      setCopyValuesActions((prev) => prev.map((a) => (a.id === actionId
        ? { ...a, filterProperties: (a.filterProperties ?? []).filter((p) => p.id !== propId) }
        : a)));
    }
  };

  const activeRelatedFilterAction = activeRelatedFilterTarget?.section === 'move'
    ? moveActions.find((a) => a.id === activeRelatedFilterTarget.actionId)
    : activeRelatedFilterTarget?.section === 'update_related'
      ? updateRelatedActions.find((a) => a.id === activeRelatedFilterTarget.actionId)
      : activeRelatedFilterTarget?.section === 'copy_values'
        ? copyValuesActions.find((a) => a.id === activeRelatedFilterTarget.actionId)
        : null;
  const activeRelatedFilterExistingLabels = (activeRelatedFilterAction?.filterProperties ?? [])
    .map((p) => p.fieldLabel.trim().toLowerCase());

  const handleSelectUpdateAction = (item, meta) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (meta.category_key === 'custom') {
      const rawLabel = getFieldLabel(item);
      setUpdateActions((prev) => [
        ...prev,
        { id, category: 'custom', key: `custom-${item.custom_field_id}`, label: `Set ${rawLabel}`, rawLabel, field: rawLabel },
      ]);
    } else if (USER_REFERENCE_UPDATE_KEYS.includes(item.key)) {
      setUpdateActions((prev) => {
        // Add co-owners defaults its first row to whatever "Set owner" already
        // picked in this same THEN list, since a co-owner is most often the
        // current owner — user can still change/clear the row afterwards.
        let defaultUserId = '';
        let defaultUserName = '';
        if (item.key === 'add_co_owners') {
          const ownerAction = prev.find((a) => a.key === 'set_owner' && a.value);
          const ownerUser = ownerAction && users.find((u) => String(u.user_id) === String(ownerAction.value));
          if (ownerUser) {
            defaultUserId = ownerUser.user_id;
            defaultUserName = ownerUser.name;
          }
        }
        return [
          ...prev,
          {
            id, category: 'action', key: item.key, label: item.label, field: item.field,
            values: [{ id: `${id}-0`, userId: defaultUserId, userName: defaultUserName }],
          },
        ];
      });
    } else if (STICKER_UPDATE_KEYS.includes(item.key)) {
      setUpdateActions((prev) => [
        ...prev,
        {
          id, category: 'action', key: item.key, label: item.label, field: item.field,
          ...(item.key === 'add_stickers' ? { frequency: STICKER_ACTION_FREQUENCY_OPTIONS[0].key } : {}),
          values: [{ id: `${id}-0`, stickerId: '', stickerName: '', stickerColor: '', stickerIcon: '' }],
        },
      ]);
    } else if (LIST_MODE_UPDATE_KEYS.includes(item.key)) {
      setUpdateActions((prev) => [
        ...prev,
        {
          id, category: 'action', key: item.key, label: item.label, field: item.field,
          mode: LIST_UPDATE_MODE_OPTIONS[0].key,
          ...(item.key === 'set_tags' ? { tagIds: [] } : {}),
        },
      ]);
    } else if (DEADLINE_UPDATE_KEYS.includes(item.key)) {
      setUpdateActions((prev) => [
        ...prev,
        {
          id, category: 'action', key: item.key, label: item.label, field: item.field,
          mode: DEADLINE_MODE_OPTIONS[0].key, deadlineDays: 0, deadlineDate: '', nonWorkingDays: [],
        },
      ]);
    } else {
      setUpdateActions((prev) => [
        ...prev,
        { id, category: 'action', key: item.key, label: item.label, field: item.field },
      ]);
    }
  };

  const handleRemoveUpdateAction = (id) => {
    setUpdateActions((prev) => prev.filter((a) => a.id !== id));
  };

  const handleClearUpdateActions = () => {
    setUpdateActions([]);
  };

  const handleChangeUpdateActionValue = (id, value) => {
    setUpdateActions((prev) => prev.map((a) => (a.id === id ? { ...a, value } : a)));
  };

  const handleAddUpdateActionUserRow = (actionId) => {
    setUpdateActions((prev) => prev.map((a) => (a.id === actionId
      ? { ...a, values: [...(a.values ?? []), { id: `${actionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, userId: '', userName: '' }] }
      : a)));
  };

  const handleRemoveUpdateActionUserRow = (actionId, rowId) => {
    setUpdateActions((prev) => prev.map((a) => (a.id === actionId
      ? { ...a, values: (a.values ?? []).filter((v) => v.id !== rowId) }
      : a)));
  };

  const handlePickUpdateActionUser = (actionId, rowId, user) => {
    setUpdateActions((prev) => prev.map((a) => (a.id === actionId
      ? { ...a, values: (a.values ?? []).map((v) => (v.id === rowId ? { ...v, userId: user.user_id, userName: user.name } : v)) }
      : a)));
    setOpenUpdateUserRowId(null);
    setUpdateUserFilterText('');
  };

  const handleAddUpdateActionStickerRow = (actionId) => {
    setUpdateActions((prev) => prev.map((a) => (a.id === actionId
      ? { ...a, values: [...(a.values ?? []), { id: `${actionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, stickerId: '', stickerName: '', stickerColor: '', stickerIcon: '' }] }
      : a)));
  };

  const handleRemoveUpdateActionStickerRow = (actionId, rowId) => {
    setUpdateActions((prev) => prev.map((a) => (a.id === actionId
      ? { ...a, values: (a.values ?? []).filter((v) => v.id !== rowId) }
      : a)));
  };

  const handlePickUpdateActionSticker = (actionId, rowId, sticker) => {
    setUpdateActions((prev) => prev.map((a) => (a.id === actionId
      ? {
        ...a,
        values: (a.values ?? []).map((v) => (v.id === rowId
          ? { ...v, stickerId: sticker.sticker_id, stickerName: sticker.label, stickerColor: sticker.color_code, stickerIcon: sticker.icon }
          : v)),
      }
      : a)));
    setOpenUpdateStickerRowId(null);
    setUpdateStickerFilterText('');
  };

  const handleToggleUpdateFrequency = (actionId) => {
    setUpdateFrequencyFilterText('');
    setOpenUpdateFrequencyActionId((prev) => (prev === actionId ? null : actionId));
  };

  const handleSelectUpdateFrequency = (actionId, freq) => {
    setUpdateActions((prev) => prev.map((a) => (a.id === actionId ? { ...a, frequency: freq.key } : a)));
    setOpenUpdateFrequencyActionId(null);
    setUpdateFrequencyFilterText('');
  };

  const handleSelectUpdateBlocker = (actionId, blocker) => {
    handleChangeUpdateActionValue(actionId, blocker.blocker_id ?? '');
    setOpenUpdateBlockerActionId(null);
    setUpdateBlockerFilterText('');
  };

  const handleApplyUpdateActionColor = (actionId, hex) => {
    handleChangeUpdateActionValue(actionId, normalizeHexColor(hex));
    setOpenUpdateColorActionId(null);
  };

  const handleSelectUpdateType = (actionId, type) => {
    handleChangeUpdateActionValue(actionId, type.card_type_id ?? '');
    setOpenUpdateTypeActionId(null);
    setUpdateTypeFilterText('');
  };

  const handleSelectUpdateOwner = (actionId, user) => {
    handleChangeUpdateActionValue(actionId, user.user_id ?? '');
    setOpenUpdateOwnerActionId(null);
    setUpdateOwnerFilterText('');
  };

  const handleSelectUpdatePriority = (actionId, priority) => {
    handleChangeUpdateActionValue(actionId, priority.key ?? '');
    setOpenUpdatePriorityActionId(null);
    setUpdatePriorityFilterText('');
  };

  const handleToggleUpdateMode = (actionId) => {
    setUpdateModeFilterText('');
    setOpenUpdateModeActionId((prev) => (prev === actionId ? null : actionId));
  };

  const handleSelectUpdateMode = (actionId, option) => {
    setUpdateActions((prev) => prev.map((a) => (a.id === actionId ? { ...a, mode: option.key } : a)));
    setOpenUpdateModeActionId(null);
    setUpdateModeFilterText('');
  };

  // Generic setter for the extra fields the deadline action carries (deadlineDays,
  // deadlineDate) that don't fit the single action.value/action.values shape the other
  // update actions use.
  const handleSetUpdateActionField = (actionId, field, value) => {
    setUpdateActions((prev) => prev.map((a) => (a.id === actionId ? { ...a, [field]: value } : a)));
  };

  const handleToggleUpdateTagSelection = (actionId, tag) => {
    setUpdateActions((prev) => prev.map((a) => {
      if (a.id !== actionId) return a;
      const current = a.tagIds ?? [];
      const isSelected = current.some((id) => String(id) === String(tag.id));
      return {
        ...a,
        tagIds: isSelected ? current.filter((id) => String(id) !== String(tag.id)) : [...current, tag.id],
      };
    }));
  };

  const handleToggleUpdateNonWorkingDay = (actionId, day) => {
    setUpdateActions((prev) => prev.map((a) => {
      if (a.id !== actionId) return a;
      const current = a.nonWorkingDays ?? [];
      const isSelected = current.includes(day.key);
      return {
        ...a,
        nonWorkingDays: isSelected ? current.filter((k) => k !== day.key) : [...current, day.key],
      };
    }));
  };

  const handleAddNotifyAction = () => {
    const option = NOTIFY_ACTION_OPTIONS[0];
    setNotifyActions((prev) => [...prev, { id: Date.now(), key: option.key, label: option.label }]);
  };

  const handleRemoveNotifyAction = (id) => {
    // Only a notify action that was actually saved on the backend (has a
    // notification_id) needs the delete call — one still unconfigured/unsaved
    // has nothing to remove server-side.
    const action = notifyActions.find((a) => a.id === id);
    if (action?.notification_id) {
      deleteNotificationSettings(action.notification_id, {
        cb: () => setNotifyActions((prev) => prev.filter((a) => a.id !== id)),
      });
    } else {
      setNotifyActions((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const handleClearNotifyActions = () => {
    // Same rule as handleRemoveNotifyAction: only entries saved on the backend
    // (notification_id) need a delete call before they can be cleared.
    const actionsToDelete = notifyActions.filter((a) => a.notification_id);
    setNotifyActions((prev) => prev.filter((a) => a.notification_id));
    actionsToDelete.forEach((action) => {
      deleteNotificationSettings(action.notification_id, {
        cb: () => setNotifyActions((prev) => prev.filter((a) => a.id !== action.id)),
      });
    });
  };

  const handleOpenNotificationSettings = (id) => {
    setActiveNotifyActionId(id);
    setShowNotificationSettings(true);
    const action = notifyActions.find((a) => a.id === id);
    if (action?.notification_id) {
      getNotificationSettings(action.notification_id);
    } else {
      resetNotificationSettings();
    }
  };

  const handleSaveNotificationSettings = ({ notificationId, ...settings }) => {
    setNotifyActions((prev) => prev.map((a) => (a.id === activeNotifyActionId
      ? { ...a, ...settings, notification_id: notificationId ?? a.notification_id, configured: true }
      : a)));
  };

  const activeNotifyAction = notifyActions.find((a) => a.id === activeNotifyActionId);

  const handleAddInvokeAction = () => {
    const option = INVOKE_ACTION_OPTIONS[0];
    setInvokeActions((prev) => [...prev, { id: Date.now(), key: option.key, label: option.label }]);
  };

  const handleRemoveInvokeAction = (id) => {
    // Only an invoke action that was actually saved on the backend (has a
    // web_service_id) needs the delete call — one still unconfigured/unsaved
    // has nothing to remove server-side.
    const action = invokeActions.find((a) => a.id === id);
    if (action?.webServiceId) {
      deleteWebServiceSettings(action.webServiceId, {
        cb: () => setInvokeActions((prev) => prev.filter((a) => a.id !== id)),
      });
    } else {
      setInvokeActions((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const handleClearInvokeActions = () => {
    // Same rule as handleRemoveInvokeAction: only entries saved on the backend
    // (webServiceId) need a delete call before they can be cleared.
    const actionsToDelete = invokeActions.filter((a) => a.webServiceId);
    setInvokeActions((prev) => prev.filter((a) => a.webServiceId));
    actionsToDelete.forEach((action) => {
      deleteWebServiceSettings(action.webServiceId, {
        cb: () => setInvokeActions((prev) => prev.filter((a) => a.id !== action.id)),
      });
    });
  };

  const handleOpenWebInvokeSettings = (id) => {
    setActiveInvokeActionId(id);
    setShowWebInvokeSettings(true);
    const action = invokeActions.find((a) => a.id === id);
    if (action?.webServiceId) {
      getWebServiceSettings(action.webServiceId);
    } else {
      resetWebServiceSettings();
    }
  };

  const handleSaveWebInvokeSettings = (settings) => {
    setInvokeActions((prev) => prev.map((a) => (a.id === activeInvokeActionId ? { ...a, ...settings, configured: true } : a)));
  };

  const activeInvokeAction = invokeActions.find((a) => a.id === activeInvokeActionId);

  // The "Create subtask" create-action (createActions entry with key 'subtask')
  // has no destination to configure like the other create actions — instead its
  // "Not Set" link opens this Owner/Deadline/Description settings modal.
  const handleOpenCreateSubtaskSettings = (id) => {
    setActiveCreateSubtaskActionId(id);
    setShowCreateSubtaskSettings(true);
    const action = createActions.find((a) => a.id === id);
    if (action?.createSubtaskId) {
      getCreateSubtaskSettings(action.createSubtaskId);
    } else {
      resetCreateSubtaskSettings();
    }
  };

  const handleSaveCreateSubtaskSettings = (settings) => {
    setCreateActions((prev) => prev.map((a) => (a.id === activeCreateSubtaskActionId ? { ...a, ...settings, configured: true, previewLoaded: true } : a)));
  };

  const activeCreateSubtaskAction = createActions.find((a) => a.id === activeCreateSubtaskActionId);

  const handlePickConditionBoard = (rowId, board) => {
    setBoardConditionRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, boardId: board?.board_id ?? '' } : row))
    );
  };

  const handleRemoveBoardConditionRow = (rowId) => {
    setBoardConditionRows((prev) => {
      if (prev.length <= 1) {
        // Guards against the first-board auto-fill effect reinstating a board after
        // this explicit clear once its workspaces fetch resolves.
        boardConditionDefaultAppliedRef.current = true;
        return [{ id: 'board-0', boardId: '', joinWord: 'OR' }];
      }
      return prev.filter((row) => row.id !== rowId);
    });
  };

  const handleToggleBoardConditionJoinWord = (rowId) => {
    setBoardConditionRows((prev) => {
      // There's no other way to add a second "Board is" row today, so clicking a
      // row's join-word pill duplicates that row (same board) directly below it —
      // it does not flip the pill's own AND/OR value.
      const rowIndex = prev.findIndex((row) => row.id === rowId);
      if (rowIndex === -1) return prev;
      const newRow = { ...prev[rowIndex], id: `board-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
      const next = [...prev];
      next.splice(rowIndex + 1, 0, newRow);
      return next;
    });
  };

  const handleOpenPositionDestination = (rowId) => {
    setActivePositionRowId(rowId);
    setShowPositionDestinationPicker(true);
  };

  const handleSavePositionDestination = (destination) => {
    setPositionConditionRows((prev) => prev.map((row) => (row.id === activePositionRowId ? { ...row, ...destination } : row)));
  };

  const handleRemovePositionConditionRow = (rowId) => {
    setPositionConditionRows((prev) => {
      if (prev.length <= 1) {
        return [{ id: 'position-0', boardId: '', boardName: '', swimlaneId: '', swimlaneName: '', stageId: '', stageName: '', joinWord: 'OR' }];
      }
      return prev.filter((row) => row.id !== rowId);
    });
  };

  const handleTogglePositionConditionJoinWord = (rowId) => {
    setPositionConditionRows((prev) => {
      const rowIndex = prev.findIndex((row) => row.id === rowId);
      if (rowIndex === -1) return prev;
      const newRow = { ...prev[rowIndex], id: `position-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
      const next = [...prev];
      next.splice(rowIndex + 1, 0, newRow);
      return next;
    });
  };

  const activePositionRow = positionConditionRows.find((row) => row.id === activePositionRowId);

  // "Clear all" only makes sense to show once the user has actually added something
  // beyond the trigger's untouched defaults — an extra "Board is" row, a configured
  // "Position is" row, or a custom property box.
  const hasAndAdditions =
    conditions.length > 0 ||
    boardConditionRows.length > 1 ||
    positionConditionRows.length > 1 ||
    positionConditionRows.some((row) => row.boardId);

  const handleCloseAttempt = () => {
    if (isEditMode) {
      onClose();
      return;
    }
    setShowCancelConfirm(true);
  };

  const handleConfirmClose = () => {
    setShowCancelConfirm(false);
    onClose();
  };

  const handleCancelClose = () => {
    setShowCancelConfirm(false);
  };

  // "Remove all other X links" only makes sense for a link type the user has actually
  // added — showing all five regardless of selection is what the earlier version did.
  const activeLinkRemoveOptions = LINK_REMOVE_OTHERS_OPTIONS.filter((opt) =>
    linkActions.some((a) => a.key === opt.key)
  );

  return (
    <>
    <Modal
      show={show}
      onHide={handleCloseAttempt}
      className="business-rule-form-modal"
      dialogClassName="business-rule-form-modal-dialog"
      backdropClassName="business-rule-form-modal-backdrop"
      centered={false}
      backdrop="static"
      scrollable
    >
      <div className="business-rule-form-modal-shell">
        <header className="business-rule-form-modal-header">
          <h2 className="business-rule-form-modal-title">
            {isCopyMode ? 'Copy Business Rule' : (isEditMode ? 'Edit Business Rule' : 'Add business rule')}
          </h2>
          <button
            type="button"
            className="business-rule-form-modal-close"
            onClick={handleCloseAttempt}
            aria-label="Close"
          >
            <FiX size={20} />
          </button>
        </header>

        {isEditMode && !isCopyMode && (
          <nav className="business-rule-form-tabs">
            {[
              { id: 'details', label: 'Details' },
              { id: 'logs', label: 'Execution logs' },
              { id: 'history', label: 'History' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`business-rule-form-tab${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}

        <div className={`business-rule-form-modal-body${isEditMode && !isCopyMode && activeTab !== 'details' ? ' business-rule-form-tab-hidden' : ''}`}>
          <section className="business-rule-form-meta">
            <div className="business-rule-form-field">
              <label htmlFor="br-form-name" className="business-rule-form-label business-rule-form-label--hint">Name</label>
              <input
                id="br-form-name"
                type="text"
                className="business-rule-form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="business-rule-form-field">
              <label htmlFor="br-form-description" className="business-rule-form-label business-rule-form-label--hint">Description</label>
              <textarea
                id="br-form-description"
                className="business-rule-form-textarea"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="business-rule-form-field">
              <label htmlFor="br-form-tags" className="business-rule-form-label">Tags</label>
              <div className="business-rule-form-input business-rule-form-control business-rule-form-tags-input">
                {tags.map((tag, idx) => (
                  <span key={`${tag}-${idx}`} className="business-rule-form-tag-pill">
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(idx)}
                      aria-label={`Remove tag ${tag}`}
                    >
                      <FiX size={12} />
                    </button>
                  </span>
                ))}
                <input
                  id="br-form-tags"
                  type="text"
                  className="business-rule-form-tags-input-field"
                  placeholder={tags.length === 0 ? 'Add tags' : ''}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  onBlur={handleAddTag}
                />
              </div>
            </div>

            <div className="business-rule-form-secondary-grid">
              <div className="business-rule-form-field br-owner-picker-wrap">
                <label htmlFor="br-form-owner" className="business-rule-form-label business-rule-form-label--hint">Owner</label>
                <button
                  type="button"
                  id="br-form-owner"
                  ref={ownerPickerTriggerRef}
                  className="business-rule-form-select-wrap business-rule-form-select-wrap--owner business-rule-form-control br-owner-picker-trigger"
                  onClick={() => setIsOwnerPickerOpen((v) => !v)}
                  aria-haspopup="listbox"
                  aria-expanded={isOwnerPickerOpen}
                >
                  <span className="business-rule-form-owner-avatar" aria-hidden>
                    {getInitials(owner)}
                  </span>
                  <span className="br-owner-picker-trigger-name">{owner}</span>
                  <FiChevronDown className="business-rule-form-select-icon" aria-hidden />
                </button>

                {isOwnerPickerOpen && (
                  <div className="br-owner-picker-panel" ref={ownerPickerPanelRef}>
                    <div className="br-owner-picker-search">
                      <FiFilter size={14} className="br-owner-picker-search-icon" aria-hidden />
                      <input
                        type="text"
                        placeholder="Filter"
                        value={ownerFilterText}
                        onChange={(e) => setOwnerFilterText(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="br-owner-picker-list">
                      {usersLoading ? (
                        <div className="br-property-picker-empty">Loading...</div>
                      ) : filteredOwnerUsers.length === 0 ? (
                        <div className="br-property-picker-empty">No matches</div>
                      ) : (
                        filteredOwnerUsers.map((user) => (
                          <div key={user.user_id ?? user.name} className="br-owner-picker-row">
                            <button
                              type="button"
                              className={`br-owner-picker-row-btn${owner === user.name ? ' br-owner-picker-row-btn--selected' : ''}`}
                              onClick={() => handlePickOwner(user)}
                            >
                              <span className="business-rule-form-owner-avatar" aria-hidden>
                                {getInitials(user.name)}
                              </span>
                              <span className="br-owner-picker-row-name">{user.name}</span>
                            </button>
                            <OwnerInfoTooltip user={user} />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="business-rule-form-field">
                <label htmlFor="br-form-share" className="business-rule-form-label business-rule-form-label--hint">Share with</label>
                <button
                  type="button"
                  id="br-form-share"
                  className="business-rule-form-select-wrap business-rule-form-control business-rule-form-share-trigger"
                  onClick={() => setShowShareModal(true)}
                >
                  {sharedUsers.length === 0 ? (
                    <span className="business-rule-form-share-placeholder">Add people</span>
                  ) : (
                    <span className="business-rule-form-share-pills">
                      {sharedUsers.map((u) => (
                        <span key={u.user_id} className="business-rule-form-share-pill">
                          <span className="business-rule-form-share-pill-avatar" aria-hidden>{getInitials(u.name)}</span>
                          {u.name}
                        </span>
                      ))}
                    </span>
                  )}
                  <FiChevronDown className="business-rule-form-select-icon" aria-hidden />
                </button>
              </div>
            </div>

            <div className="business-rule-form-toggle-box business-rule-form-control">
              <label className="business-rule-form-toggle">
                <input
                  type="checkbox"
                  checked={disallowTriggerChain}
                  onChange={(e) => setDisallowTriggerChain(e.target.checked)}
                />
                <span className="business-rule-form-toggle-track" aria-hidden />
                <span className="business-rule-form-toggle-label">
                  Disallow business rule actions to trigger this rule
                </span>
              </label>
            </div>
          </section>

          <section
            className="business-rule-form-flow"
            aria-label="Rule builder"
          >
            <div className="business-rule-form-column">
              <h3 className="business-rule-form-column-title">WHEN</h3>
              <p className="business-rule-form-trigger-name business-rule-form-trigger-name--plain">{whenTriggerName}</p>

              {triggerConfig?.when_type === 'regular_fields' ? (
                <div className="business-rule-form-column-card business-rule-form-when-fields">
                  <button
                    type="button"
                    className="business-rule-form-when-fields-pill"
                    onClick={() => setShowRecurrenceUnitPicker(true)}
                  >
                    {RECURRENCE_SCHEDULE_OPTIONS.find((o) => o.key === recurrenceSchedule)?.label ?? 'Every day'}
                  </button>
                </div>
              ) : triggerConfig?.when_type === 'deadline' ? (
                <div className="business-rule-form-column-card business-rule-form-when-fields business-rule-form-when-deadline">
                  <div className="business-rule-form-when-deadline-label-row business-rule-form-condition-operator-group">
                    <span className="business-rule-form-condition-label">Deadline</span>
                    <div className="board-minimap-picker-wrap br-condition-operator-wrap">
                      <button
                        type="button"
                        ref={showWhenDeadlineComparisonPicker ? whenDeadlineComparisonTriggerRef : undefined}
                        className="br-condition-operator-trigger"
                        onClick={() => setShowWhenDeadlineComparisonPicker((prev) => !prev)}
                        aria-haspopup="listbox"
                        aria-expanded={showWhenDeadlineComparisonPicker}
                      >
                        {WHEN_DEADLINE_COMPARISON_OPTIONS.find((o) => o.key === whenDeadlineComparison)?.label
                          ?? WHEN_DEADLINE_COMPARISON_OPTIONS[0].label}
                        <FiChevronDown size={14} aria-hidden />
                      </button>

                      {showWhenDeadlineComparisonPicker && (
                        <div className="board-minimap-picker-panel br-condition-operator-panel" ref={whenDeadlineComparisonPanelRef}>
                          <div className="board-minimap-picker-search">
                            <FiFilter size={16} className="board-minimap-picker-search-icon" aria-hidden />
                            <input
                              type="text"
                              placeholder="Filter"
                              value={whenDeadlineComparisonFilterText}
                              onChange={(e) => setWhenDeadlineComparisonFilterText(e.target.value)}
                              autoFocus
                            />
                          </div>
                          <div className="board-minimap-picker-scroll">
                            {WHEN_DEADLINE_COMPARISON_OPTIONS
                              .filter((opt) => opt.label.toLowerCase().includes(whenDeadlineComparisonFilterText.trim().toLowerCase()))
                              .map((opt) => (
                                <button
                                  type="button"
                                  key={opt.key}
                                  className="br-condition-operator-option"
                                  onClick={() => {
                                    setWhenDeadlineComparison(opt.key);
                                    setShowWhenDeadlineComparisonPicker(false);
                                  }}
                                >
                                  {opt.label}
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="business-rule-form-when-deadline-input-row">
                    <input
                      type="number"
                      min="0"
                      className="business-rule-form-when-deadline-input"
                      value={whenDeadlineDays}
                      onChange={(e) => setWhenDeadlineDays(e.target.value)}
                    />
                    <span className="business-rule-form-when-deadline-suffix">
                      {whenDeadlineComparison === 'was_more_than' ? 'day(s) ago' : 'day(s)'}
                    </span>
                  </div>
                </div>
              ) : triggerConfig?.has_when_fields === '1' && (
                <div className="business-rule-form-column-card business-rule-form-when-fields">
                  <p className="business-rule-form-when-fields-header">The following card fields are changed</p>

                  {whenFields.length === 0 ? (
                    <button
                      type="button"
                      className="business-rule-form-when-fields-pill"
                      onClick={handleOpenWhenFieldPicker}
                    >
                      Any change
                    </button>
                  ) : (
                    whenFields.map((field) => (
                      <div key={field.id} className="business-rule-form-when-fields-pill business-rule-form-when-field-chip">
                        <button
                          type="button"
                          className="business-rule-form-when-fields-chip-label"
                          onClick={handleOpenWhenFieldPicker}
                        >
                          {field.fieldLabel}
                        </button>
                        <button
                          type="button"
                          className="business-rule-form-condition-remove"
                          onClick={() => handleRemoveWhenField(field.id)}
                          aria-label="Remove field"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}

                  <button
                    type="button"
                    className="business-rule-form-add-link"
                    onClick={handleOpenWhenFieldPicker}
                  >
                    <FiPlus size={14} aria-hidden />
                    Add new field
                  </button>
                </div>
              )}
            </div>

            <div className="business-rule-form-column">
              <h3 className="business-rule-form-column-title">AND</h3>
              <div className="business-rule-form-column-card">
                <p className="business-rule-form-filter-hint">{andHeaderText}</p>

                {hasBoardDefaultCondition && boardConditionRows.length > 0 && (
                  <div className="business-rule-form-filter-row business-rule-form-filter-row--multi">
                    <span className="business-rule-form-condition-label">Board is</span>
                    {boardConditionRows.map((row) => {
                      return (
                        <div key={row.id} className="br-board-condition-value-row">
                          <BoardFilterPicker
                            workspaces={workspaces ?? []}
                            value={row.boardId}
                            onChange={(boardId) => handlePickConditionBoard(row.id, { board_id: boardId })}
                            wrapClassName="br-board-condition-wrap"
                            triggerClassName="business-rule-form-condition-value"
                            triggerIconSize={16}
                            panelClassName="br-board-condition-panel"
                            placeholder={boardName?.trim() || 'Select board'}
                          />

                          <div className="business-rule-form-filter-row-actions">
                            <button
                              type="button"
                              className="business-rule-form-or-btn"
                              onClick={() => handleToggleBoardConditionJoinWord(row.id)}
                            >
                              {row.joinWord || 'OR'}
                            </button>
                            <button
                              type="button"
                              className="business-rule-form-filter-row-delete"
                              onClick={() => handleRemoveBoardConditionRow(row.id)}
                              aria-label="Remove filter"
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {hasPositionDefaultCondition && positionConditionRows.length > 0 && (
                  <div className="business-rule-form-filter-row business-rule-form-filter-row--multi">
                    <span className="business-rule-form-condition-label">Position is</span>
                    {positionConditionRows.map((row) => (
                      <div key={row.id} className="br-board-condition-value-row">
                        <button
                          type="button"
                          className="business-rule-form-condition-value"
                          onClick={() => handleOpenPositionDestination(row.id)}
                        >
                          {row.boardName
                            ? `${row.workspaceName ? `${row.workspaceName} / ` : ''}${row.boardName}${row.workflowName ? ` (${row.workflowName})` : ''} → ${row.stageName || 'Any stage'} / ${row.swimlaneName || 'Any lane'}`
                            : 'Not Set'}
                          <FiChevronDown size={16} aria-hidden />
                        </button>

                        <div className="business-rule-form-filter-row-actions">
                          <button
                            type="button"
                            className="business-rule-form-or-btn"
                            onClick={() => handleTogglePositionConditionJoinWord(row.id)}
                          >
                            {row.joinWord || 'OR'}
                          </button>
                          <button
                            type="button"
                            className="business-rule-form-filter-row-delete"
                            onClick={() => handleRemovePositionConditionRow(row.id)}
                            aria-label="Remove filter"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {conditions.map((cond) => {
                  const detailsKey = cond.fieldType && cond.fieldId != null ? `${cond.fieldType}-${cond.fieldId}` : null;
                  const details = detailsKey ? fieldDetailsByKey[detailsKey] : null;
                  const detailsLoading = detailsKey ? Boolean(isLoadingFieldDetails[detailsKey]) : false;
                  const rawOperators = details?.operators ?? [];
                  // Dev-only fallback so the operator dropdown can be visually tested for every
                  // field (regular or custom) without a live get_field_details backend response.
                  // Shown immediately (not gated on detailsLoading) since a real request that
                  // never resolves would otherwise leave the dropdown permanently hidden.
                  const operators = rawOperators.length > 0
                    ? rawOperators
                    : (import.meta.env.DEV ? DUMMY_FIELD_OPERATORS : []);
                  const showOperator = operators.length > 0 && details?.has_operator !== '0';
                  const showValueInput = !details || details?.has_input_value !== '0';
                  const isOperatorOpen = openConditionOperatorId === cond.id;
                  const selectedOperator = operators.find((op) => op.field_operator_id === cond.operatorId);
                  const operatorFilterQuery = conditionOperatorFilterText.trim().toLowerCase();
                  const filteredConditionOperators = operatorFilterQuery
                    ? operators.filter((op) => op.operator_label.toLowerCase().includes(operatorFilterQuery))
                    : operators;

                  return (
                    <div key={cond.id} className="business-rule-form-filter-row business-rule-form-filter-row--multi">
                      <button
                        type="button"
                        className="business-rule-form-filter-row-close"
                        onClick={() => handleRemoveCondition(cond.id)}
                        aria-label="Remove condition"
                      >
                        <FiX size={14} />
                      </button>

                      <div className="business-rule-form-condition-operator-group">
                        <button
                          type="button"
                          className="business-rule-form-condition-label business-rule-form-condition-label-btn"
                          onClick={() => handleOpenPropertyPickerForRow(cond.id)}
                        >
                          {cond.fieldLabel || 'Select property'}
                        </button>
                        {showOperator && (
                          <div className="board-minimap-picker-wrap br-condition-operator-wrap">
                            <button
                              type="button"
                              ref={isOperatorOpen ? conditionOperatorTriggerRef : undefined}
                              className="br-condition-operator-trigger"
                              onClick={() => handleToggleConditionOperator(cond.id)}
                              aria-haspopup="listbox"
                              aria-expanded={isOperatorOpen}
                            >
                              {selectedOperator?.operator_label || 'Select operator'}
                              <FiChevronDown size={14} aria-hidden />
                            </button>

                            {isOperatorOpen && (
                              <div className="board-minimap-picker-panel br-condition-operator-panel" ref={conditionOperatorPanelRef}>
                                <div className="board-minimap-picker-search">
                                  <FiFilter size={16} className="board-minimap-picker-search-icon" aria-hidden />
                                  <input
                                    type="text"
                                    placeholder="Filter"
                                    value={conditionOperatorFilterText}
                                    onChange={(e) => setConditionOperatorFilterText(e.target.value)}
                                    autoFocus
                                  />
                                </div>
                                <div className="board-minimap-picker-scroll">
                                  {filteredConditionOperators.length === 0 ? (
                                    <div className="br-property-picker-empty">No matches</div>
                                  ) : (
                                    filteredConditionOperators.map((op) => (
                                      <button
                                        type="button"
                                        key={op.field_operator_id}
                                        className="br-condition-operator-option"
                                        onClick={() => handleSelectConditionOperator(cond.id, op)}
                                      >
                                        {op.operator_label}
                                      </button>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {detailsLoading && <span className="business-rule-form-condition-loading">Loading...</span>}

                      {cond.values.map((v) => (
                        <div key={v.id} className="br-board-condition-value-row">
                          {showValueInput && (
                            cond.valueType === 'color' ? (
                              <div className="board-minimap-picker-wrap br-color-condition-wrap">
                                <button
                                  type="button"
                                  ref={openColorConditionId === v.id ? colorConditionTriggerRef : undefined}
                                  className="br-color-condition-trigger"
                                  onClick={() => setOpenColorConditionId((prev) => (prev === v.id ? null : v.id))}
                                  aria-haspopup="dialog"
                                  aria-expanded={openColorConditionId === v.id}
                                >
                                  <span
                                    className="br-color-condition-swatch"
                                    style={{ backgroundColor: v.value ? normalizeHexColor(v.value) : '#e5e7eb' }}
                                    aria-hidden
                                  />
                                  <span className="br-color-condition-hex">
                                    {v.value ? normalizeHexColor(v.value) : 'Select color'}
                                  </span>
                                  <FiChevronDown size={14} aria-hidden />
                                </button>

                                {openColorConditionId === v.id && (
                                  <div className="board-minimap-picker-panel br-color-condition-panel">
                                    <SedresColorPicker
                                      popoverRef={colorConditionPanelRef}
                                      initialHex={v.value || undefined}
                                      onApply={(hex) => handleApplyConditionColor(cond.id, v.id, hex)}
                                      onCancel={() => setOpenColorConditionId(null)}
                                      ariaLabel={`Pick ${cond.fieldLabel} color`}
                                    />
                                  </div>
                                )}
                              </div>
                            ) : (
                              <input
                                type="text"
                                className="business-rule-form-condition-input"
                                placeholder="Enter value"
                                value={v.value}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setConditions((prev) =>
                                    prev.map((c) =>
                                      c.id === cond.id
                                        ? { ...c, values: c.values.map((item) => (item.id === v.id ? { ...item, value: val } : item)) }
                                        : c
                                    )
                                  );
                                }}
                              />
                            )
                          )}

                          <div className="business-rule-form-filter-row-actions">
                            {cond.category !== 'time_unit' && (
                              <button
                                type="button"
                                className="business-rule-form-or-btn"
                                onClick={() => handleToggleConditionJoinWord(cond.id, v.id)}
                              >
                                {v.joinWord || 'OR'}
                              </button>
                            )}
                            <button
                              type="button"
                              className="business-rule-form-filter-row-delete"
                              onClick={() => handleRemoveConditionValue(cond.id, v.id)}
                              aria-label="Remove value"
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}

                {(hasBoardDefaultCondition || hasPositionDefaultCondition) && (
                  <div className="br-add-property-wrap">
                    <button
                      type="button"
                      className="business-rule-form-add-link"
                      onClick={handleOpenPropertyPicker}
                    >
                      <FiPlus size={14} aria-hidden />
                      Add new property
                    </button>
                    {hasAndAdditions && (
                      <button
                        type="button"
                        className="business-rule-form-add-link"
                        onClick={handleClearAndConditions}
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="business-rule-form-column business-rule-form-column--then">
              <h3 className="business-rule-form-column-title">THEN</h3>
              <div className="business-rule-form-then-stack">
                {isLoadingTriggerConfig && thenActionSections.length === 0 && (
                  <div className="br-property-picker-empty">Loading...</div>
                )}
                {thenActionSections.map((section) => (
                  <div key={section.key || section.id} className="business-rule-form-action-section">
                    <h4 className="business-rule-form-action-title">{section.title}</h4>

                    {section.id === 'generic' && (
                      <p className="business-rule-form-footer-note">
                        This action type ({section.action?.group_type}) isn't supported in this form yet —
                        it can't be configured or saved from here. Add it to ACTION_GROUP_TYPE_TO_SECTION_ID
                        (and build its picker) to enable it.
                      </p>
                    )}

                    {section.id === 'create' && createActions.length > 0 && (
                      <div className="br-create-action-list">
                        {createActions.map((action) => {
                          const isSubtaskAction = isCreateSubtaskAction(action);
                          // A subtask has no destination to configure (it's created under
                          // the current card, not a new board location) — no template
                          // picker, no "Configure details" board link, no custom
                          // card-field-values list, just the owner/deadline/description link.
                          const showFieldValues = !isSubtaskAction;
                          const titleText = action.templateName
                            ? `${action.label} - ${action.templateName}`
                            : `${action.label}${showFieldValues ? ' with custom properties' : ''}`;
                          return (
                            <div key={action.id} className="br-create-action-card">
                              <button
                                type="button"
                                className="business-rule-form-action-detail-close"
                                onClick={() => handleRemoveCreateAction(action.id)}
                                aria-label="Remove action"
                              >
                                <FiX size={14} />
                              </button>

                              {isSubtaskAction ? (
                                <h5 className="br-create-action-title">{action.label}</h5>
                              ) : (
                                <button
                                  type="button"
                                  className="br-create-action-title br-create-action-title--trigger"
                                  onClick={() => handleOpenCreateTemplatePicker(action.id)}
                                >
                                  {titleText}
                                  <FiChevronDown size={14} aria-hidden />
                                </button>
                              )}

                              {!isSubtaskAction && (() => {
                                const isTitleCopied = action.copyFields?.regularFields?.includes('title');
                                // Plain "Create card" has no relation, so the originator stays
                                // "the card that triggered the rule" — relational variants
                                // (child/parent/relative) describe it from the new card's point
                                // of view instead (e.g. a "child" card's originator is "the
                                // parent card"). action.key is tried first (the real saved
                                // relation_type once an action has been restored) — it falls
                                // back to the label keyword match for an action just picked this
                                // session, whose key is still the backend's opaque field_key.
                                const originLabel = RELATIONAL_CREATE_ACTION_ORIGIN_LABELS[action.key]
                                  ?? RELATIONAL_CREATE_ACTION_ORIGIN_LABELS[getRelationTypeFromLabel(action.label)]
                                  ?? 'the card that triggered the rule';
                                // Board destination isn't picked yet — still route through the
                                // board minimap first, same as before.
                                if (!action.boardName) {
                                  return (
                                    <button
                                      type="button"
                                      className="br-create-action-link br-create-action-link--btn"
                                      onClick={() => handleOpenCreateDetails(action.id)}
                                    >
                                      Configure details
                                    </button>
                                  );
                                }
                                // Destination is set — the summary now reports Title status
                                // instead of the board path (visible in the green box modal's
                                // own board/workflow/swimlane footer once reopened).
                                return (
                                  <button
                                    type="button"
                                    className="br-create-action-link br-create-action-link--btn"
                                    onClick={() => (isTitleCopied
                                      ? handleOpenCopyCardDetails(action.id)
                                      : handleOpenCreateCardFieldsModal(action.id))}
                                  >
                                    {isTitleCopied
                                      ? `The title will be copied from ${originLabel}`
                                      : (action.title?.trim() || 'Title is not set')}
                                  </button>
                                );
                              })()}

                              {isSubtaskAction && (
                                <button
                                  type="button"
                                  className="br-create-action-link br-create-action-link--btn"
                                  onClick={() => handleOpenCreateSubtaskSettings(action.id)}
                                >
                                  {action.configured ? (
                                    action.previewLoaded ? (
                                      (action.ownerUserId || action.deadline || action.description?.trim()) ? (
                                        <span className="br-subtask-preview-row">
                                          {action.ownerUserId && (
                                            <span className="br-subtask-preview-pill">
                                              <FiUsers size={12} aria-hidden />
                                              {users.find((u) => String(u.user_id) === String(action.ownerUserId))?.name ?? 'Unknown user'}
                                            </span>
                                          )}
                                          {action.deadline && (
                                            <span className="br-subtask-preview-pill">
                                              <FiCalendar size={12} aria-hidden />
                                              {formatDeadlineDisplay(action.deadline)}
                                            </span>
                                          )}
                                          {action.description?.trim() && (
                                            <span className="br-subtask-preview-pill br-subtask-preview-pill--desc">
                                              <FiInfo size={12} aria-hidden />
                                              {action.description.trim()}
                                            </span>
                                          )}
                                        </span>
                                      ) : 'Configured'
                                    ) : 'Loading...'
                                  ) : 'Not Set'}
                                </button>
                              )}

                            </div>
                          );
                        })}

                        <div className="br-link-footer-actions">
                          <button
                            type="button"
                            className="business-rule-form-add-link"
                            onClick={() => (isRecurringCreateAction ? handleAddRecurringCreateAction() : setShowCreateActionPicker(true))}
                          >
                            <FiPlus size={14} aria-hidden />
                            Add new action
                          </button>
                          {createActions.length > 1 && (
                            <button
                              type="button"
                              className="business-rule-form-add-link"
                              onClick={handleClearCreateActions}
                            >
                              Clear all
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {section.id === 'link' && linkActions.length > 0 && (
                      <div className="br-link-card-list">
                        {linkActions.map((action) => {
                          const isOperatorOpen = openLinkOperatorRowId === action.id;
                          return (
                            <div key={action.id} className="br-link-card">
                              <button
                                type="button"
                                className="business-rule-form-action-detail-close"
                                onClick={() => handleRemoveLinkAction(action.id)}
                                aria-label="Remove action"
                              >
                                <FiX size={14} />
                              </button>

                              <div className="br-link-card-header">
                                <button
                                  type="button"
                                  className="br-link-card-as-label"
                                  onClick={() => handleOpenLinkActionPickerForRow(action.id)}
                                >
                                  {action.label}
                                </button>
                                <div className="board-minimap-picker-wrap br-link-operator-wrap">
                                  <button
                                    type="button"
                                    ref={isOperatorOpen ? linkOperatorTriggerRef : undefined}
                                    className="br-link-operator-trigger"
                                    onClick={() => handleToggleLinkOperator(action.id)}
                                    aria-haspopup="listbox"
                                    aria-expanded={isOperatorOpen}
                                  >
                                    {action.operatorLabel || 'to card with id'}
                                    <FiChevronDown size={14} aria-hidden />
                                  </button>

                                  {isOperatorOpen && (
                                    <div className="board-minimap-picker-panel br-link-operator-panel" ref={linkOperatorPanelRef}>
                                      <div className="board-minimap-picker-search br-link-operator-search">
                                        <FiFilter size={16} className="board-minimap-picker-search-icon" aria-hidden />
                                        <input
                                          type="text"
                                          placeholder="Filter"
                                          value={linkOperatorFilterText}
                                          onChange={(e) => setLinkOperatorFilterText(e.target.value)}
                                          autoFocus
                                        />
                                      </div>
                                      <div className="board-minimap-picker-scroll br-link-operator-scroll">
                                        {isLoadingLinkCardActionOperators ? (
                                          <div className="br-property-picker-empty">Loading...</div>
                                        ) : filteredLinkOperators.length === 0 ? (
                                          <div className="br-property-picker-empty">No matches</div>
                                        ) : (
                                          filteredLinkOperators.map((op) => (
                                            <button
                                              type="button"
                                              key={op.operator_id}
                                              className="br-link-operator-option"
                                              onClick={() => handleSelectLinkOperator(action.id, op)}
                                            >
                                              {op.operator_label}
                                            </button>
                                          ))
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {action.values.map((row) => (
                                <div key={row.id} className="br-link-card-value-row">
                                  <input
                                    type="text"
                                    className="br-link-card-value-input"
                                    placeholder="Enter card id"
                                    value={row.value ?? ''}
                                    onChange={(e) => handleChangeLinkActionValue(action.id, row.id, e.target.value)}
                                  />
                                  <div className="business-rule-form-filter-row-actions">
                                    <button
                                      type="button"
                                      className="business-rule-form-or-btn"
                                      onClick={() => handleAddLinkActionValueRow(action.id)}
                                    >
                                      AND
                                    </button>
                                    <button
                                      type="button"
                                      className="business-rule-form-filter-row-delete"
                                      onClick={() => handleRemoveLinkActionValueRow(action.id, row.id)}
                                      aria-label="Remove row"
                                    >
                                      <FiTrash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })}

                        {activeLinkRemoveOptions.length > 0 && (
                          <div className="br-link-remove-others-box">
                            {activeLinkRemoveOptions.map((opt) => (
                              <label key={opt.key} className="br-link-checkbox-row">
                                <input
                                  type="checkbox"
                                  checked={Boolean(removeOtherLinksByType[opt.key])}
                                  onChange={(e) =>
                                    setRemoveOtherLinksByType((prev) => ({ ...prev, [opt.key]: e.target.checked }))
                                  }
                                />
                                {opt.label}
                              </label>
                            ))}
                          </div>
                        )}

                        <div className="br-link-footer-actions">
                          <button
                            type="button"
                            className="business-rule-form-add-link"
                            onClick={() => { editingLinkActionIdRef.current = null; setShowLinkActionPicker(true); }}
                          >
                            <FiPlus size={14} aria-hidden />
                            Add new action
                          </button>
                          {linkActions.length > 1 && (
                            <button
                              type="button"
                              className="business-rule-form-add-link"
                              onClick={handleClearLinkActions}
                            >
                              Clear all
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {section.id === 'update' && updateActions.map((action) => {
                      if (USER_REFERENCE_UPDATE_KEYS.includes(action.key)) {
                        return (
                          <div key={action.id} className="br-link-card">
                            <button
                              type="button"
                              className="business-rule-form-action-detail-close"
                              onClick={() => handleRemoveUpdateAction(action.id)}
                              aria-label="Remove action"
                            >
                              <FiX size={14} />
                            </button>
                            <span className="business-rule-form-action-chip-label">{action.label}</span>

                            {(action.values ?? []).map((row) => {
                              const rowKey = `${action.id}-${row.id}`;
                              const isRowOpen = openUpdateUserRowId === rowKey;
                              const userFilterQuery = updateUserFilterText.trim().toLowerCase();
                              const filteredUpdateUsers = userFilterQuery
                                ? users.filter((u) => u.name.toLowerCase().includes(userFilterQuery))
                                : users;
                              return (
                                <div key={row.id} className="br-link-card-value-row">
                                  <div className="board-minimap-picker-wrap br-update-user-wrap">
                                    <button
                                      type="button"
                                      ref={isRowOpen ? updateUserTriggerRef : undefined}
                                      className="br-update-user-trigger"
                                      onClick={() => {
                                        setOpenUpdateUserRowId((prev) => (prev === rowKey ? null : rowKey));
                                        setUpdateUserFilterText('');
                                      }}
                                      aria-haspopup="listbox"
                                      aria-expanded={isRowOpen}
                                    >
                                      {row.userName ? (
                                        <span className="business-rule-form-owner-avatar" aria-hidden>
                                          {getInitials(row.userName)}
                                        </span>
                                      ) : (
                                        <FiUsers size={16} className="br-update-user-placeholder-icon" aria-hidden />
                                      )}
                                      <span className="br-owner-picker-trigger-name">{row.userName || 'Select user'}</span>
                                      <FiChevronDown className="business-rule-form-select-icon" aria-hidden />
                                    </button>

                                    {isRowOpen && (
                                      <div className="br-owner-picker-panel" ref={updateUserPanelRef}>
                                        <div className="br-owner-picker-search">
                                          <FiFilter size={14} className="br-owner-picker-search-icon" aria-hidden />
                                          <input
                                            type="text"
                                            placeholder="Filter"
                                            value={updateUserFilterText}
                                            onChange={(e) => setUpdateUserFilterText(e.target.value)}
                                            autoFocus
                                          />
                                        </div>
                                        <div className="br-owner-picker-list">
                                          {usersLoading ? (
                                            <div className="br-property-picker-empty">Loading...</div>
                                          ) : filteredUpdateUsers.length === 0 ? (
                                            <div className="br-property-picker-empty">No matches</div>
                                          ) : (
                                            filteredUpdateUsers.map((u) => (
                                              <div key={u.user_id} className="br-owner-picker-row">
                                                <button
                                                  type="button"
                                                  className={`br-owner-picker-row-btn${row.userId === u.user_id ? ' br-owner-picker-row-btn--selected' : ''}`}
                                                  onClick={() => handlePickUpdateActionUser(action.id, row.id, u)}
                                                >
                                                  <span className="business-rule-form-owner-avatar" aria-hidden>
                                                    {getInitials(u.name)}
                                                  </span>
                                                  <span className="br-owner-picker-row-name">{u.name}</span>
                                                </button>
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <div className="business-rule-form-filter-row-actions">
                                    <button
                                      type="button"
                                      className="business-rule-form-or-btn"
                                      onClick={() => handleAddUpdateActionUserRow(action.id)}
                                    >
                                      AND
                                    </button>
                                    <button
                                      type="button"
                                      className="business-rule-form-filter-row-delete"
                                      onClick={() => handleRemoveUpdateActionUserRow(action.id, row.id)}
                                      aria-label="Remove row"
                                    >
                                      <FiTrash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      }
                      if (STICKER_UPDATE_KEYS.includes(action.key)) {
                        return (
                          <div key={action.id} className="br-link-card">
                            <button
                              type="button"
                              className="business-rule-form-action-detail-close"
                              onClick={() => handleRemoveUpdateAction(action.id)}
                              aria-label="Remove action"
                            >
                              <FiX size={14} />
                            </button>
                            <div className="br-link-card-header">
                              <span className="br-sticker-action-label">{action.label}</span>
                              {action.key === 'add_stickers' && (
                                <div className="board-minimap-picker-wrap br-link-operator-wrap">
                                  <button
                                    type="button"
                                    ref={openUpdateFrequencyActionId === action.id ? updateFrequencyTriggerRef : undefined}
                                    className="br-link-operator-trigger"
                                    onClick={() => handleToggleUpdateFrequency(action.id)}
                                    aria-haspopup="listbox"
                                    aria-expanded={openUpdateFrequencyActionId === action.id}
                                  >
                                    {STICKER_ACTION_FREQUENCY_OPTIONS.find((f) => f.key === action.frequency)?.label
                                      ?? STICKER_ACTION_FREQUENCY_OPTIONS[0].label}
                                    <FiChevronDown size={14} aria-hidden />
                                  </button>

                                  {openUpdateFrequencyActionId === action.id && (
                                    <div className="board-minimap-picker-panel br-link-operator-panel" ref={updateFrequencyPanelRef}>
                                      <div className="board-minimap-picker-search br-link-operator-search">
                                        <FiFilter size={16} className="board-minimap-picker-search-icon" aria-hidden />
                                        <input
                                          type="text"
                                          placeholder="Filter"
                                          value={updateFrequencyFilterText}
                                          onChange={(e) => setUpdateFrequencyFilterText(e.target.value)}
                                          autoFocus
                                        />
                                      </div>
                                      <div className="board-minimap-picker-scroll br-link-operator-scroll">
                                        {filteredUpdateFrequencyOptions.length === 0 ? (
                                          <div className="br-property-picker-empty">No matches</div>
                                        ) : (
                                          filteredUpdateFrequencyOptions.map((freq) => (
                                            <button
                                              type="button"
                                              key={freq.key}
                                              className="br-link-operator-option"
                                              onClick={() => handleSelectUpdateFrequency(action.id, freq)}
                                            >
                                              {freq.label}
                                            </button>
                                          ))
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {(action.values ?? []).map((row) => {
                              const rowKey = `${action.id}-${row.id}`;
                              const isRowOpen = openUpdateStickerRowId === rowKey;
                              const stickerFilterQuery = updateStickerFilterText.trim().toLowerCase();
                              const enabledStickers = cardStickers.filter((s) => !isKanbanManagementRowDisabled(s.status));
                              const filteredUpdateStickers = stickerFilterQuery
                                ? enabledStickers.filter((s) => s.label.toLowerCase().includes(stickerFilterQuery))
                                : enabledStickers;
                              return (
                                <div key={row.id} className="br-link-card-value-row">
                                  <div className="board-minimap-picker-wrap br-update-user-wrap">
                                    <button
                                      type="button"
                                      ref={isRowOpen ? updateStickerTriggerRef : undefined}
                                      className="br-update-user-trigger"
                                      onClick={() => {
                                        setOpenUpdateStickerRowId((prev) => (prev === rowKey ? null : rowKey));
                                        setUpdateStickerFilterText('');
                                      }}
                                      aria-haspopup="listbox"
                                      aria-expanded={isRowOpen}
                                    >
                                      {row.stickerName ? (
                                        <ColorIconSwatch colorCode={row.stickerColor} iconKey={row.stickerIcon} />
                                      ) : (
                                        <FiInfo size={16} className="br-update-user-placeholder-icon" aria-hidden />
                                      )}
                                      <span className="br-owner-picker-trigger-name">{row.stickerName || 'Not Set'}</span>
                                      <FiChevronDown className="business-rule-form-select-icon" aria-hidden />
                                    </button>

                                    {isRowOpen && (
                                      <div className="br-owner-picker-panel" ref={updateStickerPanelRef}>
                                        <div className="br-owner-picker-search">
                                          <FiFilter size={14} className="br-owner-picker-search-icon" aria-hidden />
                                          <input
                                            type="text"
                                            placeholder="Filter"
                                            value={updateStickerFilterText}
                                            onChange={(e) => setUpdateStickerFilterText(e.target.value)}
                                            autoFocus
                                          />
                                        </div>
                                        <div className="br-owner-picker-list">
                                          <div className="br-owner-picker-row">
                                            <button
                                              type="button"
                                              className={`br-owner-picker-row-btn${row.stickerId ? '' : ' br-owner-picker-row-btn--selected'}`}
                                              onClick={() => handlePickUpdateActionSticker(action.id, row.id, { sticker_id: '', label: '', color_code: '', icon: '' })}
                                            >
                                              Not Set
                                            </button>
                                          </div>
                                          {cardStickersLoading ? (
                                            <div className="br-property-picker-empty">Loading...</div>
                                          ) : filteredUpdateStickers.length === 0 ? (
                                            <div className="br-property-picker-empty">No matches</div>
                                          ) : (
                                            filteredUpdateStickers.map((s) => (
                                              <div key={s.id} className="br-owner-picker-row">
                                                <button
                                                  type="button"
                                                  className={`br-owner-picker-row-btn${String(row.stickerId) === String(s.sticker_id) ? ' br-owner-picker-row-btn--selected' : ''}`}
                                                  onClick={() => handlePickUpdateActionSticker(action.id, row.id, s)}
                                                >
                                                  <ColorIconSwatch colorCode={s.color_code} iconKey={s.icon} />
                                                  <span className="br-owner-picker-row-name">{s.label}</span>
                                                </button>
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <div className="business-rule-form-filter-row-actions">
                                    <button
                                      type="button"
                                      className="business-rule-form-or-btn"
                                      onClick={() => handleAddUpdateActionStickerRow(action.id)}
                                    >
                                      AND
                                    </button>
                                    <button
                                      type="button"
                                      className="business-rule-form-filter-row-delete"
                                      onClick={() => handleRemoveUpdateActionStickerRow(action.id, row.id)}
                                      aria-label="Remove row"
                                    >
                                      <FiTrash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      }
                      if (BLOCKER_UPDATE_KEYS.includes(action.key)) {
                        const selectedBlocker = cardBlockers.find((b) => String(b.blocker_id) === String(action.value));
                        const isBlockerOpen = openUpdateBlockerActionId === action.id;
                        return (
                          <div key={action.id} className="br-link-card">
                            <button
                              type="button"
                              className="business-rule-form-action-detail-close"
                              onClick={() => handleRemoveUpdateAction(action.id)}
                              aria-label="Remove action"
                            >
                              <FiX size={14} />
                            </button>
                            <span className="br-sticker-action-label">{action.label} to</span>
                            <div className="board-minimap-picker-wrap br-update-user-wrap">
                              <button
                                type="button"
                                ref={isBlockerOpen ? updateBlockerTriggerRef : undefined}
                                className="br-update-user-trigger"
                                onClick={() => {
                                  setOpenUpdateBlockerActionId((prev) => (prev === action.id ? null : action.id));
                                  setUpdateBlockerFilterText('');
                                }}
                                aria-haspopup="listbox"
                                aria-expanded={isBlockerOpen}
                              >
                                {selectedBlocker ? (
                                  <ColorIconSwatch colorCode={selectedBlocker.color_code} iconKey={selectedBlocker.icon} />
                                ) : (
                                  <FiInfo size={16} className="br-update-user-placeholder-icon" aria-hidden />
                                )}
                                <span className="br-owner-picker-trigger-name">{selectedBlocker?.label || 'Not Set'}</span>
                                <FiChevronDown className="business-rule-form-select-icon" aria-hidden />
                              </button>

                              {isBlockerOpen && (
                                <div className="br-owner-picker-panel" ref={updateBlockerPanelRef}>
                                  <div className="br-owner-picker-search">
                                    <FiFilter size={14} className="br-owner-picker-search-icon" aria-hidden />
                                    <input
                                      type="text"
                                      placeholder="Filter"
                                      value={updateBlockerFilterText}
                                      onChange={(e) => setUpdateBlockerFilterText(e.target.value)}
                                      autoFocus
                                    />
                                  </div>
                                  <div className="br-owner-picker-list">
                                    <div className="br-owner-picker-row">
                                      <button
                                        type="button"
                                        className={`br-owner-picker-row-btn${action.value ? '' : ' br-owner-picker-row-btn--selected'}`}
                                        onClick={() => handleSelectUpdateBlocker(action.id, { blocker_id: '' })}
                                      >
                                        Not Set
                                      </button>
                                    </div>
                                    {cardBlockersLoading ? (
                                      <div className="br-property-picker-empty">Loading...</div>
                                    ) : filteredUpdateBlockers.length === 0 ? (
                                      <div className="br-property-picker-empty">No matches</div>
                                    ) : (
                                      filteredUpdateBlockers.map((b) => (
                                        <div key={b.id} className="br-owner-picker-row">
                                          <button
                                            type="button"
                                            className={`br-owner-picker-row-btn${String(action.value) === String(b.blocker_id) ? ' br-owner-picker-row-btn--selected' : ''}`}
                                            onClick={() => handleSelectUpdateBlocker(action.id, b)}
                                          >
                                            <ColorIconSwatch colorCode={b.color_code} iconKey={b.icon} />
                                            <span className="br-owner-picker-row-name">{b.label}</span>
                                          </button>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      if (action.key === 'set_color') {
                        const isColorOpen = openUpdateColorActionId === action.id;
                        return (
                          <div key={action.id} className="br-link-card">
                            <button
                              type="button"
                              className="business-rule-form-action-detail-close"
                              onClick={() => handleRemoveUpdateAction(action.id)}
                              aria-label="Remove action"
                            >
                              <FiX size={14} />
                            </button>
                            <span className="br-sticker-action-label">{action.label} to</span>
                            <div className="board-minimap-picker-wrap br-color-condition-wrap">
                              <button
                                type="button"
                                ref={isColorOpen ? updateColorTriggerRef : undefined}
                                className="br-color-condition-trigger"
                                onClick={() => setOpenUpdateColorActionId((prev) => (prev === action.id ? null : action.id))}
                                aria-haspopup="dialog"
                                aria-expanded={isColorOpen}
                              >
                                <span
                                  className="br-color-condition-swatch"
                                  style={{ backgroundColor: action.value ? normalizeHexColor(action.value) : '#e5e7eb' }}
                                  aria-hidden
                                />
                                <span className="br-color-condition-hex">
                                  {action.value ? normalizeHexColor(action.value) : 'Select color'}
                                </span>
                                <FiChevronDown size={14} aria-hidden />
                              </button>

                              {isColorOpen && (
                                <div className="board-minimap-picker-panel br-color-condition-panel">
                                  <SedresColorPicker
                                    popoverRef={updateColorPanelRef}
                                    initialHex={action.value || undefined}
                                    onApply={(hex) => handleApplyUpdateActionColor(action.id, hex)}
                                    onCancel={() => setOpenUpdateColorActionId(null)}
                                    ariaLabel={`Pick ${action.label} color`}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      if (TYPE_UPDATE_KEYS.includes(action.key)) {
                        const selectedType = cardTypes.find((t) => String(t.card_type_id) === String(action.value));
                        const isTypeOpen = openUpdateTypeActionId === action.id;
                        return (
                          <div key={action.id} className="br-link-card">
                            <button
                              type="button"
                              className="business-rule-form-action-detail-close"
                              onClick={() => handleRemoveUpdateAction(action.id)}
                              aria-label="Remove action"
                            >
                              <FiX size={14} />
                            </button>
                            <span className="br-sticker-action-label">{action.label} to</span>
                            <div className="board-minimap-picker-wrap br-update-user-wrap">
                              <button
                                type="button"
                                ref={isTypeOpen ? updateTypeTriggerRef : undefined}
                                className="br-update-user-trigger"
                                onClick={() => {
                                  setOpenUpdateTypeActionId((prev) => (prev === action.id ? null : action.id));
                                  setUpdateTypeFilterText('');
                                }}
                                aria-haspopup="listbox"
                                aria-expanded={isTypeOpen}
                              >
                                {selectedType ? (
                                  <ColorIconSwatch colorCode={selectedType.color_code} iconKey={selectedType.icon} />
                                ) : (
                                  <FiInfo size={16} className="br-update-user-placeholder-icon" aria-hidden />
                                )}
                                <span className="br-owner-picker-trigger-name">{selectedType?.label || 'Not Set'}</span>
                                <FiChevronDown className="business-rule-form-select-icon" aria-hidden />
                              </button>

                              {isTypeOpen && (
                                <div className="br-owner-picker-panel" ref={updateTypePanelRef}>
                                  <div className="br-owner-picker-search">
                                    <FiFilter size={14} className="br-owner-picker-search-icon" aria-hidden />
                                    <input
                                      type="text"
                                      placeholder="Filter"
                                      value={updateTypeFilterText}
                                      onChange={(e) => setUpdateTypeFilterText(e.target.value)}
                                      autoFocus
                                    />
                                  </div>
                                  <div className="br-owner-picker-list">
                                    <div className="br-owner-picker-row">
                                      <button
                                        type="button"
                                        className={`br-owner-picker-row-btn${action.value ? '' : ' br-owner-picker-row-btn--selected'}`}
                                        onClick={() => handleSelectUpdateType(action.id, { card_type_id: '' })}
                                      >
                                        Not Set
                                      </button>
                                    </div>
                                    {cardTypesLoading ? (
                                      <div className="br-property-picker-empty">Loading...</div>
                                    ) : filteredUpdateTypes.length === 0 ? (
                                      <div className="br-property-picker-empty">No matches</div>
                                    ) : (
                                      filteredUpdateTypes.map((t) => (
                                        <div key={t.id} className="br-owner-picker-row">
                                          <button
                                            type="button"
                                            className={`br-owner-picker-row-btn${String(action.value) === String(t.card_type_id) ? ' br-owner-picker-row-btn--selected' : ''}`}
                                            onClick={() => handleSelectUpdateType(action.id, t)}
                                          >
                                            <ColorIconSwatch colorCode={t.color_code} iconKey={t.icon} />
                                            <span className="br-owner-picker-row-name">{t.label}</span>
                                          </button>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      if (OWNER_UPDATE_KEYS.includes(action.key)) {
                        const selectedOwner = users.find((u) => String(u.user_id) === String(action.value));
                        const isOwnerOpen = openUpdateOwnerActionId === action.id;
                        return (
                          <div key={action.id} className="br-link-card">
                            <button
                              type="button"
                              className="business-rule-form-action-detail-close"
                              onClick={() => handleRemoveUpdateAction(action.id)}
                              aria-label="Remove action"
                            >
                              <FiX size={14} />
                            </button>
                            <span className="br-sticker-action-label">{action.label} to</span>
                            <div className="board-minimap-picker-wrap br-update-user-wrap">
                              <button
                                type="button"
                                ref={isOwnerOpen ? updateOwnerTriggerRef : undefined}
                                className="br-update-user-trigger"
                                onClick={() => {
                                  setOpenUpdateOwnerActionId((prev) => (prev === action.id ? null : action.id));
                                  setUpdateOwnerFilterText('');
                                }}
                                aria-haspopup="listbox"
                                aria-expanded={isOwnerOpen}
                              >
                                {selectedOwner ? (
                                  <span className="business-rule-form-owner-avatar" aria-hidden>
                                    {getInitials(selectedOwner.name)}
                                  </span>
                                ) : (
                                  <span className="business-rule-form-owner-avatar" aria-hidden>
                                    {getInitials('None')}
                                  </span>
                                )}
                                <span className="br-owner-picker-trigger-name">{selectedOwner?.name || 'None'}</span>
                                <FiChevronDown className="business-rule-form-select-icon" aria-hidden />
                              </button>

                              {isOwnerOpen && (
                                <div className="br-owner-picker-panel" ref={updateOwnerPanelRef}>
                                  <div className="br-owner-picker-search">
                                    <FiFilter size={14} className="br-owner-picker-search-icon" aria-hidden />
                                    <input
                                      type="text"
                                      placeholder="Filter"
                                      value={updateOwnerFilterText}
                                      onChange={(e) => setUpdateOwnerFilterText(e.target.value)}
                                      autoFocus
                                    />
                                  </div>
                                  <div className="br-owner-picker-list">
                                    <div className="br-owner-picker-row">
                                      <button
                                        type="button"
                                        className={`br-owner-picker-row-btn${action.value ? '' : ' br-owner-picker-row-btn--selected'}`}
                                        onClick={() => handleSelectUpdateOwner(action.id, { user_id: '' })}
                                      >
                                        <span className="business-rule-form-owner-avatar" aria-hidden>
                                          {getInitials('None')}
                                        </span>
                                        <span className="br-owner-picker-row-name">None</span>
                                      </button>
                                    </div>
                                    {usersLoading ? (
                                      <div className="br-property-picker-empty">Loading...</div>
                                    ) : filteredUpdateOwners.length === 0 ? (
                                      <div className="br-property-picker-empty">No matches</div>
                                    ) : (
                                      filteredUpdateOwners.map((u) => (
                                        <div key={u.user_id} className="br-owner-picker-row">
                                          <button
                                            type="button"
                                            className={`br-owner-picker-row-btn${String(action.value) === String(u.user_id) ? ' br-owner-picker-row-btn--selected' : ''}`}
                                            onClick={() => handleSelectUpdateOwner(action.id, u)}
                                          >
                                            <span className="business-rule-form-owner-avatar" aria-hidden>
                                              {getInitials(u.name)}
                                            </span>
                                            <span className="br-owner-picker-row-name">{u.name}</span>
                                          </button>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      if (action.key === 'set_priority') {
                        const selectedPriority = PRIORITY_OPTIONS.find((p) => p.key === action.value);
                        const isPriorityOpen = openUpdatePriorityActionId === action.id;
                        return (
                          <div key={action.id} className="br-link-card">
                            <button
                              type="button"
                              className="business-rule-form-action-detail-close"
                              onClick={() => handleRemoveUpdateAction(action.id)}
                              aria-label="Remove action"
                            >
                              <FiX size={14} />
                            </button>
                            <span className="br-sticker-action-label">{action.label} to</span>
                            <div className="board-minimap-picker-wrap br-update-user-wrap">
                              <button
                                type="button"
                                ref={isPriorityOpen ? updatePriorityTriggerRef : undefined}
                                className="br-update-user-trigger"
                                onClick={() => {
                                  setOpenUpdatePriorityActionId((prev) => (prev === action.id ? null : action.id));
                                  setUpdatePriorityFilterText('');
                                }}
                                aria-haspopup="listbox"
                                aria-expanded={isPriorityOpen}
                              >
                                {selectedPriority ? (
                                  <LuTriangle
                                    size={14}
                                    color={selectedPriority.color}
                                    className={`br-priority-icon${selectedPriority.key === 'low' ? ' br-priority-icon--low' : ''}`}
                                    aria-hidden
                                  />
                                ) : (
                                  <FiInfo size={16} className="br-update-user-placeholder-icon" aria-hidden />
                                )}
                                <span className="br-owner-picker-trigger-name">{selectedPriority?.label || 'Not Set'}</span>
                                <FiChevronDown className="business-rule-form-select-icon" aria-hidden />
                              </button>

                              {isPriorityOpen && (
                                <div className="br-owner-picker-panel" ref={updatePriorityPanelRef}>
                                  <div className="br-owner-picker-search">
                                    <FiFilter size={14} className="br-owner-picker-search-icon" aria-hidden />
                                    <input
                                      type="text"
                                      placeholder="Filter"
                                      value={updatePriorityFilterText}
                                      onChange={(e) => setUpdatePriorityFilterText(e.target.value)}
                                      autoFocus
                                    />
                                  </div>
                                  <div className="br-owner-picker-list">
                                    {filteredUpdatePriorities.length === 0 ? (
                                      <div className="br-property-picker-empty">No matches</div>
                                    ) : (
                                      filteredUpdatePriorities.map((p) => (
                                        <div key={p.key} className="br-owner-picker-row">
                                          <button
                                            type="button"
                                            className={`br-owner-picker-row-btn${action.value === p.key ? ' br-owner-picker-row-btn--selected' : ''}`}
                                            onClick={() => handleSelectUpdatePriority(action.id, p)}
                                          >
                                            <LuTriangle
                                              size={14}
                                              color={p.color}
                                              className={`br-priority-icon${p.key === 'low' ? ' br-priority-icon--low' : ''}`}
                                              aria-hidden
                                            />
                                            <span className="br-owner-picker-row-name">{p.label}</span>
                                          </button>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      if (LIST_MODE_UPDATE_KEYS.includes(action.key)) {
                        const modeOptions = getUpdateModeOptions(action.key);
                        const isModeOpen = openUpdateModeActionId === action.id;
                        const filteredModeOptions = updateModeFilterQuery
                          ? modeOptions.filter((m) => m.label.toLowerCase().includes(updateModeFilterQuery))
                          : modeOptions;
                        const currentModeLabel = modeOptions.find((m) => m.key === action.mode)?.label ?? modeOptions[0].label;

                        const modeHeader = (
                          <div className="br-link-card-header">
                            <span className="br-sticker-action-label">{action.label}</span>
                            <div className="board-minimap-picker-wrap br-link-operator-wrap">
                              <button
                                type="button"
                                ref={isModeOpen ? updateModeTriggerRef : undefined}
                                className="br-link-operator-trigger"
                                onClick={() => handleToggleUpdateMode(action.id)}
                                aria-haspopup="listbox"
                                aria-expanded={isModeOpen}
                              >
                                {currentModeLabel}
                                <FiChevronDown size={14} aria-hidden />
                              </button>

                              {isModeOpen && (
                                <div className="board-minimap-picker-panel br-link-operator-panel" ref={updateModePanelRef}>
                                  <div className="board-minimap-picker-search br-link-operator-search">
                                    <FiFilter size={16} className="board-minimap-picker-search-icon" aria-hidden />
                                    <input
                                      type="text"
                                      placeholder="Filter"
                                      value={updateModeFilterText}
                                      onChange={(e) => setUpdateModeFilterText(e.target.value)}
                                      autoFocus
                                    />
                                  </div>
                                  <div className="board-minimap-picker-scroll br-link-operator-scroll">
                                    {filteredModeOptions.length === 0 ? (
                                      <div className="br-property-picker-empty">No matches</div>
                                    ) : (
                                      filteredModeOptions.map((opt) => (
                                        <button
                                          type="button"
                                          key={opt.key}
                                          className="br-link-operator-option"
                                          onClick={() => handleSelectUpdateMode(action.id, opt)}
                                        >
                                          {opt.label}
                                        </button>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );

                        if (action.key === 'set_tags') {
                          const isTagsOpen = openUpdateTagsActionId === action.id;
                          const selectedTagLabels = (action.tagIds ?? [])
                            .map((id) => kanbanTags.find((t) => String(t.id) === String(id))?.label)
                            .filter(Boolean);
                          return (
                            <div key={action.id} className="br-link-card">
                              <button
                                type="button"
                                className="business-rule-form-action-detail-close"
                                onClick={() => handleRemoveUpdateAction(action.id)}
                                aria-label="Remove action"
                              >
                                <FiX size={14} />
                              </button>
                              {modeHeader}
                              <div className="board-minimap-picker-wrap br-update-user-wrap">
                                <div
                                  role="button"
                                  tabIndex={0}
                                  ref={isTagsOpen ? updateTagsTriggerRef : undefined}
                                  className="business-rule-form-input business-rule-form-control business-rule-form-tags-input br-nonworking-trigger"
                                  onClick={() => {
                                    setOpenUpdateTagsActionId((prev) => (prev === action.id ? null : action.id));
                                    setUpdateTagsFilterText('');
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      setOpenUpdateTagsActionId((prev) => (prev === action.id ? null : action.id));
                                      setUpdateTagsFilterText('');
                                    }
                                  }}
                                  aria-haspopup="listbox"
                                  aria-expanded={isTagsOpen}
                                >
                                  {selectedTagLabels.length === 0 ? (
                                    <span className="br-nonworking-placeholder">Not Set</span>
                                  ) : (
                                    (action.tagIds ?? []).map((tagId) => {
                                      const tag = kanbanTags.find((t) => String(t.id) === String(tagId));
                                      if (!tag) return null;
                                      return (
                                        <span key={tagId} className="business-rule-form-tag-pill">
                                          {tag.label}
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleToggleUpdateTagSelection(action.id, tag);
                                            }}
                                            aria-label={`Remove ${tag.label}`}
                                          >
                                            <FiX size={12} />
                                          </button>
                                        </span>
                                      );
                                    })
                                  )}
                                  <FiChevronDown className="br-nonworking-trigger-chevron" size={14} aria-hidden />
                                </div>

                                {isTagsOpen && (
                                  <div className="br-owner-picker-panel" ref={updateTagsPanelRef}>
                                    <div className="br-owner-picker-search">
                                      <FiFilter size={14} className="br-owner-picker-search-icon" aria-hidden />
                                      <input
                                        type="text"
                                        placeholder="Filter"
                                        value={updateTagsFilterText}
                                        onChange={(e) => setUpdateTagsFilterText(e.target.value)}
                                        autoFocus
                                      />
                                    </div>
                                    <div className="br-owner-picker-list">
                                      {kanbanTagsLoading ? (
                                        <div className="br-property-picker-empty">Loading...</div>
                                      ) : filteredUpdateTags.length === 0 ? (
                                        <div className="br-property-picker-empty">No matches</div>
                                      ) : (
                                        filteredUpdateTags.map((t) => (
                                          <div key={t.id} className="br-owner-picker-row">
                                            <button
                                              type="button"
                                              className={`br-owner-picker-row-btn${(action.tagIds ?? []).some((id) => String(id) === String(t.id)) ? ' br-owner-picker-row-btn--selected' : ''}`}
                                              onClick={() => handleToggleUpdateTagSelection(action.id, t)}
                                            >
                                              <ColorIconSwatch colorCode={t.color_code} />
                                              <span className="br-owner-picker-row-name">{t.label}</span>
                                            </button>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                    <div className="br-tags-picker-footer">
                                      <button
                                        type="button"
                                        className="br-tags-picker-save"
                                        onClick={() => setOpenUpdateTagsActionId(null)}
                                      >
                                        Save
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }

                        // set_milestones — no confirmed milestones catalog/endpoint exists yet
                        // (unlike stickers/blockers/types/tags), so its value stays the plain
                        // text fallback until one is.
                        return (
                          <div key={action.id} className="br-link-card">
                            <button
                              type="button"
                              className="business-rule-form-action-detail-close"
                              onClick={() => handleRemoveUpdateAction(action.id)}
                              aria-label="Remove action"
                            >
                              <FiX size={14} />
                            </button>
                            {modeHeader}
                            <input
                              type="text"
                              className="br-update-action-value-input"
                              placeholder="New value"
                              value={action.value ?? ''}
                              onChange={(e) => handleChangeUpdateActionValue(action.id, e.target.value)}
                            />
                          </div>
                        );
                      }
                      if (DEADLINE_UPDATE_KEYS.includes(action.key)) {
                        const modeOptions = DEADLINE_MODE_OPTIONS;
                        const isModeOpen = openUpdateModeActionId === action.id;
                        const filteredModeOptions = updateModeFilterQuery
                          ? modeOptions.filter((m) => m.label.toLowerCase().includes(updateModeFilterQuery))
                          : modeOptions;
                        const currentMode = action.mode || modeOptions[0].key;
                        const currentModeLabel = modeOptions.find((m) => m.key === currentMode)?.label ?? modeOptions[0].label;
                        const isNonWorkingOpen = openUpdateNonWorkingActionId === action.id;
                        const nonWorkingDayKeys = action.nonWorkingDays ?? [];
                        const nonWorkingFilterQuery = updateNonWorkingFilterText.trim().toLowerCase();
                        const nonWorkingFilteredOptions = nonWorkingFilterQuery
                          ? WEEKDAY_OPTIONS.filter((d) => d.label.toLowerCase().includes(nonWorkingFilterQuery))
                          : WEEKDAY_OPTIONS;
                        const recentlySelectedDays = nonWorkingFilteredOptions.filter((d) => nonWorkingDayKeys.includes(d.key));
                        const otherDays = nonWorkingFilteredOptions.filter((d) => !nonWorkingDayKeys.includes(d.key));
                        return (
                          <div key={action.id} className="br-link-card">
                            <button
                              type="button"
                              className="business-rule-form-action-detail-close"
                              onClick={() => handleRemoveUpdateAction(action.id)}
                              aria-label="Remove action"
                            >
                              <FiX size={14} />
                            </button>
                            <div className="br-link-card-header">
                              <span className="br-sticker-action-label">{action.label}</span>
                              <div className="board-minimap-picker-wrap br-link-operator-wrap">
                                <button
                                  type="button"
                                  ref={isModeOpen ? updateModeTriggerRef : undefined}
                                  className="br-link-operator-trigger"
                                  onClick={() => handleToggleUpdateMode(action.id)}
                                  aria-haspopup="listbox"
                                  aria-expanded={isModeOpen}
                                >
                                  {currentModeLabel}
                                  <FiChevronDown size={14} aria-hidden />
                                </button>

                                {isModeOpen && (
                                  <div className="board-minimap-picker-panel br-link-operator-panel" ref={updateModePanelRef}>
                                    <div className="board-minimap-picker-search br-link-operator-search">
                                      <FiFilter size={16} className="board-minimap-picker-search-icon" aria-hidden />
                                      <input
                                        type="text"
                                        placeholder="Filter"
                                        value={updateModeFilterText}
                                        onChange={(e) => setUpdateModeFilterText(e.target.value)}
                                        autoFocus
                                      />
                                    </div>
                                    <div className="board-minimap-picker-scroll br-link-operator-scroll">
                                      {filteredModeOptions.length === 0 ? (
                                        <div className="br-property-picker-empty">No matches</div>
                                      ) : (
                                        filteredModeOptions.map((opt) => (
                                          <button
                                            type="button"
                                            key={opt.key}
                                            className="br-link-operator-option"
                                            onClick={() => handleSelectUpdateMode(action.id, opt)}
                                          >
                                            {opt.label}
                                          </button>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {currentMode === 'relative' ? (
                              <div className="br-deadline-relative-row">
                                <input
                                  type="number"
                                  className="br-deadline-days-input"
                                  value={action.deadlineDays ?? 0}
                                  onChange={(e) => handleSetUpdateActionField(action.id, 'deadlineDays', e.target.value)}
                                />
                                <span className="br-deadline-days-label">days in the future</span>
                              </div>
                            ) : (
                              <DatePickerField
                                dateValue={action.deadlineDate || ''}
                                onDateChange={(v) => handleSetUpdateActionField(action.id, 'deadlineDate', v)}
                                placeholder="Select date"
                              />
                            )}

                            <div className="br-deadline-nonworking">
                              <span className="br-deadline-nonworking-label">
                                Non-working days
                                <FiInfo size={13} aria-hidden />
                              </span>
                              <div className="board-minimap-picker-wrap br-update-user-wrap">
                                <div
                                  role="button"
                                  tabIndex={0}
                                  ref={isNonWorkingOpen ? updateNonWorkingTriggerRef : undefined}
                                  className="business-rule-form-input business-rule-form-control business-rule-form-tags-input br-nonworking-trigger"
                                  onClick={() => {
                                    setOpenUpdateNonWorkingActionId((prev) => (prev === action.id ? null : action.id));
                                    setUpdateNonWorkingFilterText('');
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      setOpenUpdateNonWorkingActionId((prev) => (prev === action.id ? null : action.id));
                                      setUpdateNonWorkingFilterText('');
                                    }
                                  }}
                                  aria-haspopup="listbox"
                                  aria-expanded={isNonWorkingOpen}
                                >
                                  {nonWorkingDayKeys.length === 0 ? (
                                    <span className="br-nonworking-placeholder">Not Set</span>
                                  ) : (
                                    WEEKDAY_OPTIONS.filter((d) => nonWorkingDayKeys.includes(d.key)).map((day) => (
                                      <span key={day.key} className="business-rule-form-tag-pill">
                                        {day.label}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleUpdateNonWorkingDay(action.id, day);
                                          }}
                                          aria-label={`Remove ${day.label}`}
                                        >
                                          <FiX size={12} />
                                        </button>
                                      </span>
                                    ))
                                  )}
                                </div>

                                {isNonWorkingOpen && (
                                  <div className="br-owner-picker-panel" ref={updateNonWorkingPanelRef}>
                                    <div className="br-owner-picker-search">
                                      <FiFilter size={14} className="br-owner-picker-search-icon" aria-hidden />
                                      <input
                                        type="text"
                                        placeholder="Filter"
                                        value={updateNonWorkingFilterText}
                                        onChange={(e) => setUpdateNonWorkingFilterText(e.target.value)}
                                        autoFocus
                                      />
                                    </div>
                                    <div className="br-owner-picker-list">
                                      {recentlySelectedDays.length > 0 && (
                                        <>
                                          <div className="br-nonworking-section-title">Recently selected</div>
                                          {recentlySelectedDays.map((day) => (
                                            <label key={day.key} className="br-nonworking-toggle-row">
                                              <span className="br-toggle-switch">
                                                <input
                                                  type="checkbox"
                                                  checked
                                                  onChange={() => handleToggleUpdateNonWorkingDay(action.id, day)}
                                                />
                                                <span className="br-toggle-slider" />
                                              </span>
                                              {day.label}
                                            </label>
                                          ))}
                                        </>
                                      )}
                                      {otherDays.length > 0 && (
                                        <>
                                          <div className="br-nonworking-section-title">Other</div>
                                          {otherDays.map((day) => (
                                            <label key={day.key} className="br-nonworking-toggle-row">
                                              <span className="br-toggle-switch">
                                                <input
                                                  type="checkbox"
                                                  checked={false}
                                                  onChange={() => handleToggleUpdateNonWorkingDay(action.id, day)}
                                                />
                                                <span className="br-toggle-slider" />
                                              </span>
                                              {day.label}
                                            </label>
                                          ))}
                                        </>
                                      )}
                                      {recentlySelectedDays.length === 0 && otherDays.length === 0 && (
                                        <div className="br-property-picker-empty">No matches</div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }
                      // Custom fields carry no confirmed field_type, so which value UI they get
                      // is guessed from the field's own label (classifyCustomFieldUiKind) —
                      // best-effort, see the comment on that function.
                      const customFieldKind = action.category === 'custom' ? classifyCustomFieldUiKind(action.rawLabel) : null;
                      if (customFieldKind === 'date') {
                        const customNonWorkingDayKeys = action.nonWorkingDays ?? [];
                        const isCustomNonWorkingOpen = openUpdateNonWorkingActionId === action.id;
                        const customNonWorkingFilterQuery = updateNonWorkingFilterText.trim().toLowerCase();
                        const customNonWorkingFilteredOptions = customNonWorkingFilterQuery
                          ? WEEKDAY_OPTIONS.filter((d) => d.label.toLowerCase().includes(customNonWorkingFilterQuery))
                          : WEEKDAY_OPTIONS;
                        const customRecentlySelectedDays = customNonWorkingFilteredOptions.filter((d) => customNonWorkingDayKeys.includes(d.key));
                        const customOtherDays = customNonWorkingFilteredOptions.filter((d) => !customNonWorkingDayKeys.includes(d.key));
                        return (
                          <div key={action.id} className="br-link-card">
                            <button
                              type="button"
                              className="business-rule-form-action-detail-close"
                              onClick={() => handleRemoveUpdateAction(action.id)}
                              aria-label="Remove action"
                            >
                              <FiX size={14} />
                            </button>
                            <span className="br-sticker-action-label">{action.label} to</span>
                            <div className="br-deadline-relative-row">
                              <input
                                type="number"
                                className="br-deadline-days-input"
                                value={action.deadlineDays ?? 0}
                                onChange={(e) => handleSetUpdateActionField(action.id, 'deadlineDays', e.target.value)}
                              />
                              <span className="br-deadline-days-label">days in the future</span>
                            </div>
                            <div className="br-deadline-nonworking">
                              <span className="br-deadline-nonworking-label">
                                Non-working days
                                <FiInfo size={13} aria-hidden />
                              </span>
                              <div className="board-minimap-picker-wrap br-update-user-wrap">
                                <div
                                  role="button"
                                  tabIndex={0}
                                  ref={isCustomNonWorkingOpen ? updateNonWorkingTriggerRef : undefined}
                                  className="business-rule-form-input business-rule-form-control business-rule-form-tags-input br-nonworking-trigger"
                                  onClick={() => {
                                    setOpenUpdateNonWorkingActionId((prev) => (prev === action.id ? null : action.id));
                                    setUpdateNonWorkingFilterText('');
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      setOpenUpdateNonWorkingActionId((prev) => (prev === action.id ? null : action.id));
                                      setUpdateNonWorkingFilterText('');
                                    }
                                  }}
                                  aria-haspopup="listbox"
                                  aria-expanded={isCustomNonWorkingOpen}
                                >
                                  {customNonWorkingDayKeys.length === 0 ? (
                                    <span className="br-nonworking-placeholder">Not Set</span>
                                  ) : (
                                    WEEKDAY_OPTIONS.filter((d) => customNonWorkingDayKeys.includes(d.key)).map((day) => (
                                      <span key={day.key} className="business-rule-form-tag-pill">
                                        {day.label}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleUpdateNonWorkingDay(action.id, day);
                                          }}
                                          aria-label={`Remove ${day.label}`}
                                        >
                                          <FiX size={12} />
                                        </button>
                                      </span>
                                    ))
                                  )}
                                </div>

                                {isCustomNonWorkingOpen && (
                                  <div className="br-owner-picker-panel" ref={updateNonWorkingPanelRef}>
                                    <div className="br-owner-picker-search">
                                      <FiFilter size={14} className="br-owner-picker-search-icon" aria-hidden />
                                      <input
                                        type="text"
                                        placeholder="Filter"
                                        value={updateNonWorkingFilterText}
                                        onChange={(e) => setUpdateNonWorkingFilterText(e.target.value)}
                                        autoFocus
                                      />
                                    </div>
                                    <div className="br-owner-picker-list">
                                      {customRecentlySelectedDays.length > 0 && (
                                        <>
                                          <div className="br-nonworking-section-title">Recently selected</div>
                                          {customRecentlySelectedDays.map((day) => (
                                            <label key={day.key} className="br-nonworking-toggle-row">
                                              <span className="br-toggle-switch">
                                                <input
                                                  type="checkbox"
                                                  checked
                                                  onChange={() => handleToggleUpdateNonWorkingDay(action.id, day)}
                                                />
                                                <span className="br-toggle-slider" />
                                              </span>
                                              {day.label}
                                            </label>
                                          ))}
                                        </>
                                      )}
                                      {customOtherDays.length > 0 && (
                                        <>
                                          <div className="br-nonworking-section-title">Other</div>
                                          {customOtherDays.map((day) => (
                                            <label key={day.key} className="br-nonworking-toggle-row">
                                              <span className="br-toggle-switch">
                                                <input
                                                  type="checkbox"
                                                  checked={false}
                                                  onChange={() => handleToggleUpdateNonWorkingDay(action.id, day)}
                                                />
                                                <span className="br-toggle-slider" />
                                              </span>
                                              {day.label}
                                            </label>
                                          ))}
                                        </>
                                      )}
                                      {customRecentlySelectedDays.length === 0 && customOtherDays.length === 0 && (
                                        <div className="br-property-picker-empty">No matches</div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }
                      if (customFieldKind === 'card') {
                        return (
                          <div key={action.id} className="br-link-card">
                            <button
                              type="button"
                              className="business-rule-form-action-detail-close"
                              onClick={() => handleRemoveUpdateAction(action.id)}
                              aria-label="Remove action"
                            >
                              <FiX size={14} />
                            </button>
                            <span className="br-sticker-action-label">{action.label}</span>
                            <input
                              type="text"
                              className="br-update-user-trigger br-card-picker-input"
                              placeholder="Pick a card"
                              value={action.value ?? ''}
                              onChange={(e) => handleChangeUpdateActionValue(action.id, e.target.value)}
                            />
                          </div>
                        );
                      }
                      // Plain scalar "Set X to [value]" fields (title, description, size, and
                      // most custom fields) with no dedicated picker — same vertical card as
                      // every other special-cased action above, just a plain text value.
                      // customFieldKind === 'none' custom fields (best-effort guessed as
                      // file/document-like) get no value control at all, same as unblock_card.
                      const isSetPhrase = action.category === 'custom' || action.key.startsWith('set_');
                      const hasValueControl = action.key !== 'unblock_card' && customFieldKind !== 'none';
                      return (
                        <div key={action.id} className="br-link-card">
                          <button
                            type="button"
                            className="business-rule-form-action-detail-close"
                            onClick={() => handleRemoveUpdateAction(action.id)}
                            aria-label="Remove action"
                          >
                            <FiX size={14} />
                          </button>
                          <span className="br-sticker-action-label">{isSetPhrase ? `${action.label} to` : action.label}</span>
                          {hasValueControl && (
                            <input
                              type="text"
                              className="br-update-action-value-input"
                              placeholder="New value"
                              value={action.value ?? ''}
                              onChange={(e) => handleChangeUpdateActionValue(action.id, e.target.value)}
                            />
                          )}
                        </div>
                      );
                    })}

                    {section.id === 'update_related' && updateRelatedActions.map((action) => (
                      <div key={action.id} className="business-rule-form-action-detail-card">
                        <button
                          type="button"
                          className="business-rule-form-action-detail-close"
                          onClick={() => handleRemoveUpdateRelatedAction(action.id)}
                          aria-label="Remove action"
                        >
                          <FiX size={14} />
                        </button>

                        {action.fields.map((f) => (
                          <div key={f.id} className="business-rule-form-action-chip">
                            <span className="business-rule-form-action-chip-label">{f.fieldLabel}</span>
                            <button
                              type="button"
                              className="business-rule-form-condition-remove"
                              onClick={() => handleRemoveUpdateRelatedField(action.id, f.id)}
                              aria-label="Remove field"
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="business-rule-form-add-link"
                          onClick={() => handleOpenUpdateRelatedFieldPicker(action.id)}
                        >
                          <FiPlus size={14} aria-hidden />
                          Add new action
                        </button>

                        {updateRelatedFilterLabel && (
                          <div>
                            <p className="business-rule-form-when-fields-header">if {updateRelatedFilterLabel} card matches this filter</p>
                            {(action.filterProperties ?? []).map((prop) => (
                              <div key={prop.id} className="business-rule-form-action-chip">
                                <span className="business-rule-form-action-chip-label">{prop.fieldLabel}</span>
                                <button
                                  type="button"
                                  className="business-rule-form-condition-remove"
                                  onClick={() => handleRemoveRelatedFilterProperty('update_related', action.id, prop.id)}
                                  aria-label="Remove property"
                                >
                                  <FiTrash2 size={14} />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              className="business-rule-form-add-link"
                              onClick={() => handleOpenRelatedFilterPicker('update_related', action.id)}
                            >
                              <FiPlus size={14} aria-hidden />
                              Add new property
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                    {section.id === 'copy_values' && copyValuesActions.map((action) => (
                      <div key={action.id} className="business-rule-form-action-detail-card">
                        <button
                          type="button"
                          className="business-rule-form-action-detail-close"
                          onClick={() => handleRemoveCopyValuesAction(action.id)}
                          aria-label="Remove action"
                        >
                          <FiX size={14} />
                        </button>

                        {action.fields.map((f) => (
                          <div key={f.id} className="business-rule-form-action-chip">
                            <span className="business-rule-form-action-chip-label">{f.fieldLabel}</span>
                            <button
                              type="button"
                              className="business-rule-form-condition-remove"
                              onClick={() => handleRemoveCopyValuesField(action.id, f.id)}
                              aria-label="Remove field"
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="business-rule-form-add-link"
                          onClick={() => handleOpenCopyValuesFieldPicker(action.id)}
                        >
                          <FiPlus size={14} aria-hidden />
                          Add new field
                        </button>

                        <div>
                          <p className="business-rule-form-when-fields-header">if {copyValuesFilterLabel} card matches this filter</p>
                          {(action.filterProperties ?? []).map((prop) => (
                            <div key={prop.id} className="business-rule-form-action-chip">
                              <span className="business-rule-form-action-chip-label">{prop.fieldLabel}</span>
                              <button
                                type="button"
                                className="business-rule-form-condition-remove"
                                onClick={() => handleRemoveRelatedFilterProperty('copy_values', action.id, prop.id)}
                                aria-label="Remove property"
                              >
                                <FiTrash2 size={14} />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            className="business-rule-form-add-link"
                            onClick={() => handleOpenRelatedFilterPicker('copy_values', action.id)}
                          >
                            <FiPlus size={14} aria-hidden />
                            Add new property
                          </button>
                        </div>
                      </div>
                    ))}

                    {section.id === 'move' && moveActions.map((action) => (
                      <div key={action.id} className="business-rule-form-action-detail-card">
                        <button
                          type="button"
                          className="business-rule-form-action-detail-close"
                          onClick={() => handleRemoveMoveAction(action.id)}
                          aria-label="Remove action"
                        >
                          <FiX size={14} />
                        </button>
                        <h5 className="business-rule-form-action-detail-title">{action.label}</h5>
                        <button
                          type="button"
                          className="business-rule-form-action-detail-link"
                          onClick={() => handleOpenMoveDestination(action.id)}
                        >
                          {action.boardName
                            ? `${action.workspaceName ? `${action.workspaceName} / ` : ''}${action.boardName}${action.workflowName ? ` (${action.workflowName})` : ''} → ${action.stageName || 'Any stage'} / ${action.swimlaneName || 'Any lane'}`
                            : 'Choose where to move'}
                        </button>

                        {moveRelatedFilterLabel && (
                          <div>
                            <p className="business-rule-form-when-fields-header">if {moveRelatedFilterLabel} card matches this filter</p>
                            {(action.filterProperties ?? []).map((prop) => (
                              <div key={prop.id} className="business-rule-form-action-chip">
                                <span className="business-rule-form-action-chip-label">{prop.fieldLabel}</span>
                                <button
                                  type="button"
                                  className="business-rule-form-condition-remove"
                                  onClick={() => handleRemoveRelatedFilterProperty('move', action.id, prop.id)}
                                  aria-label="Remove property"
                                >
                                  <FiTrash2 size={14} />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              className="business-rule-form-add-link"
                              onClick={() => handleOpenRelatedFilterPicker('move', action.id)}
                            >
                              <FiPlus size={14} aria-hidden />
                              Add new property
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                    {section.id === 'convert' && convertSubtaskActions.map((action) => (
                      <div key={action.id} className="business-rule-form-action-detail-card">
                        <button
                          type="button"
                          className="business-rule-form-action-detail-close"
                          onClick={() => handleRemoveConvertAction(action.id)}
                          aria-label="Remove action"
                        >
                          <FiX size={14} />
                        </button>
                        <h5 className="business-rule-form-action-detail-title">{action.label}</h5>
                        <button
                          type="button"
                          className="business-rule-form-action-detail-link"
                          onClick={() => handleOpenConvertDestination(action.id)}
                        >
                          {action.boardName
                            ? `${action.workspaceName ? `${action.workspaceName} / ` : ''}${action.boardName}${action.workflowName ? ` (${action.workflowName})` : ''} → ${action.stageName || 'Any stage'} / ${action.swimlaneName || 'Any lane'}`
                            : 'Choose where to move'}
                        </button>
                      </div>
                    ))}

                    {section.id === 'notify' && notifyActions.map((action) => (
                      <div key={action.id} className="business-rule-form-action-detail-card">
                        <button
                          type="button"
                          className="business-rule-form-action-detail-close"
                          onClick={() => handleRemoveNotifyAction(action.id)}
                          aria-label="Remove action"
                        >
                          <FiX size={14} />
                        </button>
                        <h5 className="business-rule-form-action-detail-title">{action.label}</h5>
                        <button
                          type="button"
                          className="business-rule-form-action-detail-link"
                          onClick={() => handleOpenNotificationSettings(action.id)}
                        >
                          {action.configured && action.subjectParts?.length > 0 ? (
                            action.subjectParts.map((part, idx) => (
                              part.type === 'pill'
                                ? <span key={idx} className="notification-pill">{part.value}</span>
                                : <span key={idx}>{part.value}</span>
                            ))
                          ) : (
                            action.configured ? 'Configured' : 'Not Set'
                          )}
                        </button>
                      </div>
                    ))}

                    {section.id === 'execute' && (
                      <div className="business-rule-form-action-detail-card">
                        <label className="business-rule-form-label">Execute at</label>

                        <div className="br-execute-at-row">
                          <div className="board-minimap-picker-wrap">
                            <button
                              type="button"
                              ref={showExecuteTimePicker ? executeTimeTriggerRef : undefined}
                              aria-label="Execute at time"
                              className="business-rule-form-action-detail-link"
                              onClick={() => setShowExecuteTimePicker((prev) => !prev)}
                              aria-haspopup="listbox"
                              aria-expanded={showExecuteTimePicker}
                            >
                              {executeAtTime} ({EXECUTE_AT_TIMEZONE})
                              <FiChevronDown size={14} aria-hidden />
                            </button>

                            {showExecuteTimePicker && (
                              <div className="board-minimap-picker-panel br-timezone-panel" ref={executeTimePanelRef}>
                                <button
                                  type="button"
                                  className="br-timezone-panel-close"
                                  onClick={() => { setShowExecuteTimePicker(false); setExecuteTimeFilterText(''); }}
                                  aria-label="Close"
                                >
                                  <FiX size={14} />
                                </button>
                                <div className="board-minimap-picker-search">
                                  <FiFilter size={16} className="board-minimap-picker-search-icon" aria-hidden />
                                  <input
                                    type="text"
                                    placeholder="Filter"
                                    value={executeTimeFilterText}
                                    onChange={(e) => setExecuteTimeFilterText(e.target.value)}
                                    autoFocus
                                  />
                                </div>
                                <div className="board-minimap-picker-scroll">
                                  {TIME_LIST
                                    .filter((time) => time.includes(executeTimeFilterText.trim()))
                                    .map((time) => (
                                      <button
                                        type="button"
                                        key={time}
                                        className="br-create-template-option"
                                        onClick={() => { setExecuteAtTime(time); setShowExecuteTimePicker(false); setExecuteTimeFilterText(''); }}
                                      >
                                        <span className="br-timezone-option-label">{time}</span>
                                      </button>
                                    ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {section.id === 'invoke' && invokeActions.map((action) => (
                      <div key={action.id} className="business-rule-form-action-detail-card">
                        <button
                          type="button"
                          className="business-rule-form-action-detail-close"
                          onClick={() => handleRemoveInvokeAction(action.id)}
                          aria-label="Remove action"
                        >
                          <FiX size={14} />
                        </button>
                        <h5 className="business-rule-form-action-detail-title">{action.label}</h5>
                        <button
                          type="button"
                          className="business-rule-form-action-detail-link"
                          onClick={() => handleOpenWebInvokeSettings(action.id)}
                        >
                          {action.configured ? (action.serviceName?.trim() || 'Configured') : 'Not Set'}
                        </button>
                      </div>
                    ))}

                    {isEditMode && (rawSummaryBySectionId[section.id] ?? []).map((group) => (
                      <ThenGroupRawSummary key={group.then_group_id ?? group.group_type} group={group} />
                    ))}

                    {section.id !== 'execute' && section.id !== 'generic' && !(section.id === 'link' && linkActions.length > 0) && !(section.id === 'create' && createActions.length > 0) && !(section.id === 'move' && moveActions.length > 0) && (
                      <div className="br-link-footer-actions">
                        <button
                          type="button"
                          className="business-rule-form-add-action"
                          onClick={() => {
                            if (section.id === 'create') {
                              if (isRecurringCreateAction) handleAddRecurringCreateAction();
                              else setShowCreateActionPicker(true);
                            }
                            if (section.id === 'link') setShowLinkActionPicker(true);
                            if (section.id === 'move') handleAddMoveAction();
                            if (section.id === 'convert') handleAddConvertAction();
                            if (section.id === 'update') setShowUpdateActionPicker(true);
                            if (section.id === 'update_related') handleAddUpdateRelatedAction();
                            if (section.id === 'copy_values') handleAddCopyValuesAction();
                            if (section.id === 'notify') handleAddNotifyAction();
                            if (section.id === 'invoke') handleAddInvokeAction();
                          }}
                        >
                          <FiPlus size={14} aria-hidden />
                          {section.id === 'move' ? 'Add new move action'
                            : section.id === 'update_related' ? 'Add new update action'
                              : section.id === 'copy_values' ? 'Add new copy values action'
                                : 'Add new action'}
                        </button>

                        {section.id === 'update' && updateActions.length > 1 && (
                          <button
                            type="button"
                            className="business-rule-form-add-link"
                            onClick={handleClearUpdateActions}
                          >
                            Clear all
                          </button>
                        )}

                        {section.id === 'notify' && notifyActions.length > 1 && (
                          <button
                            type="button"
                            className="business-rule-form-add-link"
                            onClick={handleClearNotifyActions}
                          >
                            Clear all
                          </button>
                        )}

                        {section.id === 'invoke' && invokeActions.length > 1 && (
                          <button
                            type="button"
                            className="business-rule-form-add-link"
                            onClick={handleClearInvokeActions}
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {isEditMode && Object.entries(rawSummaryBySectionId)
                  .filter(([sectionId]) => !thenActionSections.some((s) => s.id === sectionId))
                  .flatMap(([, groups]) => groups)
                  .map((group) => (
                    <div key={group.then_group_id ?? group.group_type} className="business-rule-form-action-section">
                      <ThenGroupRawSummary group={group} />
                    </div>
                  ))}
              </div>
            </div>
          </section>
        </div>

        {isEditMode && activeTab === 'logs' && (() => {
          // get_execution_logs has a confirmed endpoint/params (search, from, to) but no
          // documented response field names yet — best-effort fallback across a few
          // likely keys per column, same convention as the rest of this file's
          // unconfirmed-shape handling.
          const normalizeLogRow = (row, idx) => ({
            key: row.execution_log_id ?? row.id ?? idx,
            ruleName: row.business_rule_name ?? row.rule_name ?? name,
            ruleId: row.business_rule_id ?? businessRuleId,
            cardId: row.card_id ?? row.executed_on_card_id ?? row.executed_card_id ?? '-',
            executedAt: row.executed_at ?? row.execution_time ?? row.executed_at_local ?? row.created_at ?? '-',
          });
          const logRows = (executionLogs ?? []).map(normalizeLogRow);

          // Extension inferred from the response's real content-type since the
          // export endpoint's file format isn't documented/confirmed yet.
          const EXPORT_CONTENT_TYPE_EXTENSIONS = {
            'application/pdf': 'pdf',
            'text/csv': 'csv',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
            'application/vnd.ms-excel': 'xls',
          };

          const handleExportLogs = () => {
            if (isLoadingExportExecutionLogs) return;
            exportExecutionLogsFile(businessRuleId, {
              params: {
                from: logsFromDate ? `${logsFromDate}` : undefined,
                to: logsToDate ? `${logsToDate}` : undefined,
              },
              cb: (fileUrl, contentType) => {
                if (!fileUrl) return;
                const ext = EXPORT_CONTENT_TYPE_EXTENSIONS[contentType?.split(';')[0]?.trim()] ?? 'pdf';
                const link = document.createElement('a');
                link.href = fileUrl;
                link.download = `business-rule-${businessRuleId}-execution-logs.${ext}`;
                link.click();
                URL.revokeObjectURL(fileUrl);
              },
            });
          };

          return (
            <div className="business-rule-form-tab-panel">
              <div className="business-rule-form-tab-filters">
                <div className="business-rule-form-tab-date-group">
                  <label className="business-rule-form-label business-rule-form-label--hint">From</label>
                  <div className="business-rule-form-tab-date-inputs">
                    <input
                      type="date"
                      className="business-rule-form-input"
                      value={logsFromDate}
                      onChange={(e) => setLogsFromDate(e.target.value)}
                    />
                    <input
                      type="time"
                      className="business-rule-form-input"
                      value={logsFromTime}
                      onChange={(e) => setLogsFromTime(e.target.value)}
                    />
                  </div>
                </div>
                <div className="business-rule-form-tab-date-group">
                  <label className="business-rule-form-label business-rule-form-label--hint">To</label>
                  <div className="business-rule-form-tab-date-inputs">
                    <input
                      type="date"
                      className="business-rule-form-input"
                      value={logsToDate}
                      onChange={(e) => setLogsToDate(e.target.value)}
                    />
                    <input
                      type="time"
                      className="business-rule-form-input"
                      value={logsToTime}
                      onChange={(e) => setLogsToTime(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="business-rule-form-tab-export-btn"
                  onClick={handleExportLogs}
                  disabled={isLoadingExportExecutionLogs}
                >
                  <FiDownload size={14} aria-hidden />
                  {isLoadingExportExecutionLogs ? 'Exporting...' : 'Export'}
                </button>
              </div>

              <input
                type="text"
                className="business-rule-form-input business-rule-form-tab-search"
                placeholder="Filter"
                value={logsSearch}
                onChange={(e) => setLogsSearch(e.target.value)}
              />

              <div className="business-rule-form-tab-table-wrap">
                <table className="business-rule-form-tab-table">
                  <thead>
                    <tr>
                      <th>Business Rule Name</th>
                      <th>Business Rule ID</th>
                      <th>Executed on Card ID</th>
                      <th>Executed at (Asia/Dubai)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingExecutionLogs ? (
                      <tr><td colSpan={4} className="business-rule-form-tab-table-state">Loading...</td></tr>
                    ) : logRows.length === 0 ? (
                      <tr><td colSpan={4} className="business-rule-form-tab-table-state">No items</td></tr>
                    ) : (
                      logRows.map((row) => (
                        <tr key={row.key}>
                          <td>{row.ruleName}</td>
                          <td>{row.ruleId}</td>
                          <td>{row.cardId}</td>
                          <td>{row.executedAt}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {isEditMode && activeTab === 'history' && (() => {
          // Confirmed endpoint: business_rule/get_history/{id} (param: search), response
          // rows are { event_type, details, author, created_at }. No row id in the
          // response, so key falls back to index.
          const normalizeHistoryRow = (row, idx) => ({
            key: row.history_id ?? row.id ?? idx,
            eventType: row.event_type ?? '-',
            details: row.details ?? '-',
            author: row.author ?? '-',
            time: row.created_at ?? '-',
          });
          const historyRows = (businessRuleHistory ?? []).map(normalizeHistoryRow);

          return (
            <div className="business-rule-form-tab-panel">
              <input
                type="text"
                className="business-rule-form-input business-rule-form-tab-search"
                placeholder="Filter"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />

              <div className="business-rule-form-tab-table-wrap">
                <table className="business-rule-form-tab-table">
                  <thead>
                    <tr>
                      <th>Event Type</th>
                      <th>Details</th>
                      <th>Author</th>
                      <th>Time (Asia/Dubai)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingBusinessRuleHistory ? (
                      <tr><td colSpan={4} className="business-rule-form-tab-table-state">Loading...</td></tr>
                    ) : historyRows.length === 0 ? (
                      <tr><td colSpan={4} className="business-rule-form-tab-table-state">No items</td></tr>
                    ) : (
                      historyRows.map((row) => (
                        <tr key={row.key}>
                          <td>{row.eventType}</td>
                          <td>{row.details}</td>
                          <td>{row.author}</td>
                          <td>{row.time}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {(!isEditMode || activeTab === 'details') && (
          <footer className="business-rule-form-modal-footer">
            {saveError && <p className="text-danger mb-2">{saveError}</p>}
            <p className="business-rule-form-footer-note">
              <strong>Note:</strong> Due to their asynchronous nature, the business rules may sometimes run with a short delay. In rare cases it may take up to 30 minutes.
            </p>
            <button
              type="button"
              className="business-rule-form-save-btn"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </footer>
        )}
      </div>
    </Modal>

    <CardPropertyMatchModal
      show={showPropertyPicker}
      onClose={() => { setShowPropertyPicker(false); editingConditionIdRef.current = null; }}
      onSelect={handleSelectProperty}
      existingFieldLabels={[
        'board',
        ...conditions
          .filter((c) => c.id !== editingConditionIdRef.current)
          .map((c) => c.fieldLabel.trim().toLowerCase()),
      ]}
      triggerTypeId={rule.id}
    />

    <CardPropertyMatchModal
      show={showWhenFieldPicker}
      onClose={() => setShowWhenFieldPicker(false)}
      onSelect={handleSelectWhenField}
      existingFieldLabels={whenFields.map((f) => f.fieldLabel.trim().toLowerCase())}
      triggerTypeId={rule.id}
      showTimeUnit={false}
    />

    <CreateActionModal
      show={showCreateActionPicker}
      onClose={() => setShowCreateActionPicker(false)}
      onSelect={handleSelectCreateAction}
      actionTypeId={createActionTypeId}
    />

    <RecurrenceScheduleModal
      show={showRecurrenceUnitPicker}
      onClose={() => setShowRecurrenceUnitPicker(false)}
      value={recurrenceSchedule}
      onSelect={setRecurrenceSchedule}
    />

    <LinkActionModal
      show={showLinkActionPicker}
      onClose={() => { setShowLinkActionPicker(false); editingLinkActionIdRef.current = null; }}
      onSelect={handleSelectLinkAction}
    />

    <BoardMinimapModal
      show={showMoveDestinationPicker}
      onClose={() => setShowMoveDestinationPicker(false)}
      onSave={handleSaveMoveDestination}
      initialBoardId={activeMoveAction?.boardId}
    />

    <BoardMinimapModal
      show={showConvertDestinationPicker}
      onClose={() => setShowConvertDestinationPicker(false)}
      onSave={handleSaveConvertDestination}
      initialBoardId={activeConvertAction?.boardId}
    />

    <BoardMinimapModal
      show={showPositionDestinationPicker}
      onClose={() => setShowPositionDestinationPicker(false)}
      onSave={handleSavePositionDestination}
      initialBoardId={activePositionRow?.boardId}
    />

    <BoardMinimapModal
      show={showCreateDetailsPicker}
      onClose={() => setShowCreateDetailsPicker(false)}
      onSave={handleSaveCreateDetails}
      initialBoardId={activeCreateAction?.boardId}
    />

    <CreateTemplatePickerModal
      show={showCreateTemplatePicker}
      onClose={() => setShowCreateTemplatePicker(false)}
      onSelect={handleSelectCreateTemplate}
    />

    <CopyCardDetailsModal
      show={showCopyCardDetailsPicker}
      onClose={() => setShowCopyCardDetailsPicker(false)}
      onContinue={handleContinueCopyCardDetails}
      triggerTypeId={rule.id}
      boardId={activeCreateAction?.boardId}
      initialFields={activeCreateAction?.copyFields}
    />

    <CreateCardFieldsModal
      show={showCreateCardFieldsModal}
      onClose={() => setShowCreateCardFieldsModal(false)}
      onSave={handleSaveCreateCardFields}
      action={activeCreateAction}
      triggerTypeId={rule.id}
    />

    <CreateCardDetailsModal
      show={showCreateCardDetailsModal}
      onClose={() => setShowCreateCardDetailsModal(false)}
      onSave={handleSaveCreateCardDetails}
      action={activeCreateAction}
      users={users}
      kanbanTags={kanbanTags}
      triggerTypeId={rule.id}
    />

    <RefineUpdateCriteriaModal
      show={showUpdateActionPicker}
      onClose={() => setShowUpdateActionPicker(false)}
      onSelect={handleSelectUpdateAction}
      existingFieldLabels={updateActions
        .filter((a) => a.category === 'custom')
        .map((a) => a.rawLabel.trim().toLowerCase())}
      existingActionKeys={updateActions
        .filter((a) => a.category === 'action')
        .map((a) => a.key)}
      triggerTypeId={rule.id}
      actionTypeId={updateActionTypeId}
    />

    <RefineUpdateCriteriaModal
      show={showUpdateRelatedFieldPicker}
      onClose={() => setShowUpdateRelatedFieldPicker(false)}
      onSelect={handleSelectUpdateRelatedField}
      existingFieldLabels={updateRelatedExistingFieldLabels}
      triggerTypeId={rule.id}
      actionTypeId={updateRelatedActionTypeId}
    />

    <RefineUpdateCriteriaModal
      show={showCopyValuesFieldPicker}
      onClose={() => setShowCopyValuesFieldPicker(false)}
      onSelect={handleSelectCopyValuesField}
      existingFieldLabels={copyValuesExistingFieldLabels}
      triggerTypeId={rule.id}
      actionTypeId={copyValuesActionTypeId}
    />

    <CardPropertyMatchModal
      show={showRelatedFilterPicker}
      onClose={() => setShowRelatedFilterPicker(false)}
      onSelect={handleAddRelatedFilterProperty}
      existingFieldLabels={activeRelatedFilterExistingLabels}
      triggerTypeId={rule.id}
    />

    <NotificationSettingsModal
      show={showNotificationSettings}
      onClose={() => setShowNotificationSettings(false)}
      onSave={handleSaveNotificationSettings}
      initialSettings={activeNotifyAction}
      triggerTypeId={rule.id}
      fetchedSettings={notificationSettings}
      isLoadingSettings={isLoadingNotificationSettings}
      users={users}
      getFieldDetails={getFieldDetails}
      fieldDetailsByKey={fieldDetailsByKey}
      getRecipientCustomFields={getRecipientCustomFields}
      recipientCustomFields={recipientCustomFields}
    />

    <WebInvokeSettingsModal
      show={showWebInvokeSettings}
      onClose={() => setShowWebInvokeSettings(false)}
      onSave={handleSaveWebInvokeSettings}
      initialSettings={activeInvokeAction}
      fetchedSettings={webServiceSettings}
      isLoadingSettings={isLoadingWebServiceSettings}
      triggerTypeId={rule.id}
    />

    <CreateSubtaskSettingsModal
      show={showCreateSubtaskSettings}
      onClose={() => setShowCreateSubtaskSettings(false)}
      onSave={handleSaveCreateSubtaskSettings}
      initialSettings={activeCreateSubtaskAction}
      fetchedSettings={createSubtaskSettings}
      isLoadingSettings={isLoadingCreateSubtaskSettings}
      users={users}
    />

    <ShareWithModal
      show={showShareModal}
      onClose={() => setShowShareModal(false)}
      permissions={sharePermissions}
      onSave={handleSaveSharePermissions}
    />

    <Modal
      show={showCancelConfirm}
      onHide={handleCancelClose}
      className="br-cancel-confirm-modal"
      dialogClassName="br-cancel-confirm-dialog"
      backdropClassName="br-cancel-confirm-backdrop"
      backdrop="static"
    >
      <div className="br-cancel-confirm-content">
        <button type="button" className="br-cancel-confirm-close-btn" onClick={handleCancelClose}>
          <FiX size={16} />
        </button>
        <p className="br-cancel-confirm-text">Are you sure you want to cancel creating a new business rule?</p>
        <div className="br-cancel-confirm-actions">
          <button type="button" className="br-cancel-confirm-btn br-cancel-confirm-btn--no" onClick={handleCancelClose}>
            No
          </button>
          <button type="button" className="br-cancel-confirm-btn br-cancel-confirm-btn--yes" onClick={handleConfirmClose}>
            Yes
          </button>
        </div>
      </div>
    </Modal>
    </>
  );
}

BusinessRuleFormModal.propTypes = {
  show: PropTypes.bool.isRequired,
  rule: PropTypes.shape({
    id: PropTypes.number,
    name: PropTypes.string,
    icon: PropTypes.string,
    description: PropTypes.string,
  }),
  boardName: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func,
  isSaving: PropTypes.bool,
  isCopyMode: PropTypes.bool,
};

PropertyPill.propTypes = {
  pillKey: PropTypes.string.isRequired,
  label: PropTypes.string,
  selected: PropTypes.bool,
  dotColor: PropTypes.string,
  disabled: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
};

CardPropertyMatchModal.propTypes = {
  show: PropTypes.bool.isRequired,
  existingFieldLabels: PropTypes.arrayOf(PropTypes.string),
  onClose: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
  triggerTypeId: PropTypes.number,
  showTimeUnit: PropTypes.bool,
  showCustomFields: PropTypes.bool,
};

CreateActionModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
  actionTypeId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

LinkActionModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
};

BoardMinimapModal.propTypes = {
  show: PropTypes.bool.isRequired,
  initialBoardId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

RefineUpdateCriteriaModal.propTypes = {
  show: PropTypes.bool.isRequired,
  existingFieldLabels: PropTypes.arrayOf(PropTypes.string),
  existingActionKeys: PropTypes.arrayOf(PropTypes.string),
  onClose: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
  triggerTypeId: PropTypes.number,
  actionTypeId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

CopyCardDetailsModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onContinue: PropTypes.func.isRequired,
  triggerTypeId: PropTypes.number,
  boardId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  initialFields: PropTypes.shape({
    regularFields: PropTypes.arrayOf(PropTypes.string),
    customFields: PropTypes.arrayOf(PropTypes.string),
  }),
};

CreateCardFieldsModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  action: PropTypes.shape({
    boardId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    boardName: PropTypes.string,
    workflowId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    workflowName: PropTypes.string,
    swimlaneName: PropTypes.string,
    stageId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    title: PropTypes.string,
    description: PropTypes.string,
    fieldValues: PropTypes.object,
    customFieldValues: PropTypes.object,
    cardFieldKeys: PropTypes.arrayOf(PropTypes.string),
    customFieldKeys: PropTypes.array,
    subtasks: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, title: PropTypes.string })),
    copyFields: PropTypes.shape({
      regularFields: PropTypes.arrayOf(PropTypes.string),
      customFields: PropTypes.array,
    }),
  }),
  triggerTypeId: PropTypes.number,
};

NotificationSettingsModal.propTypes = {
  show: PropTypes.bool.isRequired,
  initialSettings: PropTypes.shape({
    from: PropTypes.string,
    to: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.string, id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), type: PropTypes.oneOf(['user', 'field', 'email']) })),
    cc: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.string, id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), type: PropTypes.oneOf(['user', 'field', 'email']) })),
    subjectParts: PropTypes.array,
    bodyContent: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
    notificationId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }),
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  triggerTypeId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  fetchedSettings: PropTypes.shape({
    from_email: PropTypes.string,
    to_users: PropTypes.array,
    to_custom_fields: PropTypes.array,
    to_emails: PropTypes.array,
    cc_users: PropTypes.array,
    cc_custom_fields: PropTypes.array,
    cc_emails: PropTypes.array,
    subject: PropTypes.string,
    body: PropTypes.string,
  }),
  isLoadingSettings: PropTypes.bool,
  users: PropTypes.array,
  getFieldDetails: PropTypes.func,
  fieldDetailsByKey: PropTypes.object,
  getRecipientCustomFields: PropTypes.func,
  recipientCustomFields: PropTypes.array,
};

export default BusinessRuleFormModal;
