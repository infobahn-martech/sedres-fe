import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiPlus, FiChevronDown, FiChevronUp, FiTrash2, FiFilter, FiUsers, FiInfo, FiCalendar } from 'react-icons/fi';
import { Modal } from 'react-bootstrap';
import PropTypes from 'prop-types';
import ReactQuill, { Quill } from 'react-quill-new';
import QuillTableBetter from 'quill-table-better';
import 'react-quill-new/dist/quill.snow.css';
import 'quill-table-better/dist/quill-table-better.css';
import {
  THEN_ACTION_SECTIONS, ACTION_GROUP_TYPE_TO_SECTION_ID, CREATE_ACTION_OPTIONS, RELATIONAL_CREATE_ACTION_LABELS, COPY_CARD_DETAIL_REGULAR_FIELDS, DUMMY_CREATE_ACTION_TEMPLATES, LINK_ACTION_OPTIONS, LINK_REMOVE_OTHERS_OPTIONS, MOVE_ACTION_OPTIONS, CONVERT_SUBTASK_ACTION_OPTIONS, NOTIFY_ACTION_OPTIONS, UPDATE_ACTION_OPTIONS,
  INVOKE_ACTION_OPTIONS, DUMMY_INVOKE_METHOD_OPTIONS, DUMMY_INVOKE_AUTH_OPTIONS, INVOKE_METHODS_WITH_BODY, DUMMY_URL_FIELD_OPTIONS,
  DUMMY_REGULAR_FIELDS, DUMMY_TIME_UNITS, DUMMY_CUSTOM_FIELDS,
  DUMMY_WORKSPACE_BOARDS,
  DUMMY_NOTIFICATION_FROM_EMAIL, DUMMY_INTERNAL_USERS,
  DUMMY_NOTIFICATION_SUBJECT_PARTS, DUMMY_NOTIFICATION_BODY_DELTA_OPS, INTERNAL_USER_ROLE_OPTIONS,
  DUMMY_LINK_ACTION_OPERATORS, DUMMY_FIELD_OPERATORS,
} from './businessRulesData';
import { buildBoardMinimapWorkflows } from './boardMinimap.utils';
import { buildCreateBusinessRulePayload, getUnconfiguredActionLabels } from './buildBusinessRulePayload';
import useBusinessRuleReducer from '../../../store/BusinessRuleReducer';
import useWorkSpaceReducer from '../../../store/WorkSpaceReducer';
import useCommonReducer from '../../../store/CommonReducer';
import useAuthReducer from '../../../store/AuthReducer';
import useWorkFlowReducer from '../../../store/WorkFlowReducer';
import { pickForegroundOnSwimlaneBackground } from '../../../pages/EditWorkflows/workflow.utils';
import { getInitials, stripHtmlTags } from '../../../shared/utils/utils';
import DatePickerField from '../../../pages/KanbanBoard/CardFormTabs/shared/components/DatePickerField';
import SedresColorPicker from '../../../components/SedresColorPicker/SedresColorPicker';
import { PRIMARY_PRESET_COLORS, SECONDARY_PRESET_COLORS, normalizeHexColor } from '../../../components/SedresColorPicker/sedresColorPickerConstants';
import toastSuccessIcon from '../../../assets/images/toast-success.svg';

Quill.register({ 'modules/table-better': QuillTableBetter }, true);
QuillTableBetter.register();

// The backend has no timezone catalog for the "Execute at" recurring-schedule action —
// the runtime's own IANA database is the only source, so it's read once at module load.
const TIMEZONE_LIST = (() => {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return ['UTC', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Kolkata', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Shanghai', 'Australia/Sydney'];
  }
})();

// Same gap for the WHEN-side recurrence frequency: get_regular_fields returns nothing for
// this trigger type, so "Every day/hour/minute/second" is built from the one shared
// time-unit list (days/hours/minutes/seconds) that get_then_action_fields already returns.
const RECURRENCE_UNIT_SINGULAR_LABEL = {
  days: 'day',
  hours: 'hour',
  minutes: 'minute',
  seconds: 'second',
};

// "Update card details" actions that reference actual users rather than a free-text
// value get a user picker (avatar + name, multi-select via AND) instead of the plain
// text input every other field uses. Keyed against UPDATE_ACTION_OPTIONS' dev-fallback
// keys — the live backend's own field_key for these may differ, best-effort until confirmed.
const USER_REFERENCE_UPDATE_KEYS = ['add_co_owners', 'remove_co_owners', 'add_watcher'];

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
Quill.register(NotificationPillBlot);
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
  const [hoveredLeafColumnId, setHoveredLeafColumnId] = useState(null);
  const [hoveredSwimlaneId, setHoveredSwimlaneId] = useState(null);

  const boardPickerTriggerRef = useRef(null);
  const boardPickerPanelRef = useRef(null);

  const { workspaces, listAllWorkspaces } = useWorkSpaceReducer((s) => s);
  const displayWorkspaces = useMemo(() => workspaces ?? [], [workspaces]);
  const boards = displayWorkspaces.flatMap((w) =>
    (w.boards ?? []).map((b) => ({ ...b, workspace_name: w.workspace_name }))
  );

  const boardFilterQuery = boardFilterText.trim().toLowerCase();
  const filteredWorkspaceGroups = displayWorkspaces
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
    if (workspaces.length === 0) listAllWorkspaces();
  }, [show]);

  useEffect(() => {
    if (!show || boardId || initialBoardId) return;
    const firstBoard = displayWorkspaces[0]?.boards?.[0];
    if (firstBoard) setBoardId(firstBoard.board_id);
  }, [show, boardId, initialBoardId, displayWorkspaces]);

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

  const handlePickCell = (swimlane, leafColumn) => {
    onSave({
      boardId,
      boardName: selectedBoard?.board_name ?? '',
      swimlaneId: swimlane.id,
      swimlaneName: swimlane.name,
      stageId: leafColumn.id,
      stageName: leafColumn.name,
    });
    onClose();
  };

  // Column header pick: matches this stage in any swimlane (row left blank).
  const handlePickColumn = (leafColumn) => {
    onSave({
      boardId,
      boardName: selectedBoard?.board_name ?? '',
      swimlaneId: '',
      swimlaneName: '',
      stageId: leafColumn.id,
      stageName: leafColumn.name,
    });
    onClose();
  };

  // Row header pick: matches any stage within this swimlane (column left blank).
  const handlePickRow = (swimlane) => {
    onSave({
      boardId,
      boardName: selectedBoard?.board_name ?? '',
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
                        onClick={() => handlePickColumn(column)}
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
                        onClick={() => handlePickRow(swimlane)}
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
                            onClick={() => handlePickCell(swimlane, column)}
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

// Follow-up step after picking a destination for a relational "Create card" action
// (Create child/parent/predecessor/relative/successor) — lets the user pick which of the
// originator (triggering) card's fields to carry over onto the new card.
function CopyCardDetailsModal({ show, onClose, onContinue, triggerTypeId, boardId }) {
  const [selectedRegular, setSelectedRegular] = useState([]);
  const [selectedCustom, setSelectedCustom] = useState([]);
  const [expandedRegularFields, setExpandedRegularFields] = useState(true);
  const [expandedCustomFields, setExpandedCustomFields] = useState(true);

  const { customFields, isLoadingCustomFields } = useCustomFieldsByTrigger({
    show, triggerTypeId, boardId, showDisabled: false, search: '',
  });
  // Dev-only fallback so the modal can be visually tested without a live backend.
  const displayCustomFields = customFields.length > 0 ? customFields : (import.meta.env.DEV ? DUMMY_CUSTOM_FIELDS : []);

  useEffect(() => {
    if (!show) return;
    setSelectedRegular([]);
    setSelectedCustom([]);
  }, [show]);

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
  const [selectedNames, setSelectedNames] = useState([]);

  const { users, usersLoading, getUsers } = useCommonReducer((s) => s);

  useEffect(() => {
    if (!show) return;
    setFilterText('');
    setExpanded(true);
    setSelectedNames([]);
    if (users.length === 0 && !usersLoading) getUsers({ params: { limit: 200 } });
  }, [show]);

  const realUserNames = users.map((u) => u.name).filter(Boolean);
  const displayUserNames = realUserNames.length > 0 ? realUserNames : (import.meta.env.DEV ? DUMMY_INTERNAL_USERS : []);
  const allOptions = [...INTERNAL_USER_ROLE_OPTIONS, ...displayUserNames];

  const filterQuery = filterText.trim().toLowerCase();
  const filteredOptions = filterQuery
    ? allOptions.filter((name) => name.toLowerCase().includes(filterQuery))
    : allOptions;

  const handleToggle = (name) => {
    setSelectedNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleApply = () => {
    if (selectedNames.length === 0) return;
    // Role options (Self, Owner, Watchers, ...) have no backing user record, so they
    // carry id: null and are dropped when the caller builds an id list for the API.
    const items = selectedNames.map((name) => ({
      label: name,
      id: users.find((u) => u.name === name)?.user_id ?? null,
    }));
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
                  filteredOptions.map((name) => (
                    <UserPill
                      key={name}
                      pillKey={name}
                      label={name}
                      selected={selectedNames.includes(name)}
                      onClick={() => handleToggle(name)}
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
            disabled={selectedNames.length === 0}
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

  // Tokens keep their backend id (not just the display label) so a resave of
  // untouched to/cc tokens still sends valid to_users/to_custom_fields ids.
  const resolveUserTokens = (userIds) => userIds
    .map((userId) => (users ?? []).find((u) => String(u.user_id) === String(userId)))
    .filter(Boolean)
    .map((u) => ({ label: u.name, id: u.user_id, type: 'user' }));

  const resolveCustomFieldTokens = (fieldIds) => fieldIds.map((fieldId) => {
    const details = fieldDetailsByKey[`custom-${fieldId}`];
    return {
      label: (details && getFieldLabel(details)) || String(fieldId),
      id: fieldId,
      type: 'field',
    };
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

  const isDuplicateRecipientLabel = (el, label) => Array.from(el.querySelectorAll('.notification-user-pill'))
    .some((pillEl) => pillEl.dataset.label === label);

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

    const seedTo = fetchedSettings
      ? [...resolveUserTokens(toUserIds), ...resolveCustomFieldTokens(toCustomFieldIds), ...resolveEmailTokens(toEmails)]
      : (initialSettings?.to ?? []);
    const seedCc = fetchedSettings
      ? [...resolveUserTokens(ccUserIds), ...resolveCustomFieldTokens(ccCustomFieldIds), ...resolveEmailTokens(ccEmails)]
      : (initialSettings?.cc ?? []);

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

  // Custom-field pills seeded above before get_field_details resolves render with the
  // raw field id as a placeholder (see resolveCustomFieldTokens). The seeding effect
  // deliberately doesn't re-run when fieldDetailsByKey updates (that would wipe anything
  // typed/clicked in since), so once the label resolves, patch just those specific pills
  // in place instead of re-seeding the whole box.
  useEffect(() => {
    if (!show) return;
    [toBoxRef.current, ccBoxRef.current].forEach((boxEl) => {
      if (!boxEl) return;
      boxEl.querySelectorAll('.notification-user-pill--field').forEach((pillEl) => {
        const fieldId = pillEl.dataset.tokenId;
        if (!fieldId) return;
        const details = fieldDetailsByKey[`custom-${fieldId}`];
        const resolvedLabel = details && getFieldLabel(details);
        if (!resolvedLabel || resolvedLabel === pillEl.dataset.label) return;
        pillEl.dataset.label = resolvedLabel;
        pillEl.textContent = resolvedLabel;
      });
    });
  }, [show, fieldDetailsByKey]);

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

  // A previously-saved subject comes back as a plain string with each card-field token
  // written as "{Field Label}" (see handleAddSubjectField, which wraps every inserted
  // pill in literal "{"/"}" text nodes) — split it back into pill/text parts so those
  // tokens render as pills again instead of literal curly-brace text.
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

  // Inserts pill(s) at the current caret position inside the target contentEditable box
  // (falling back to appending at the end if the selection isn't inside it) — same
  // insert-at-selection approach as handleAddSubjectField below.
  const insertRecipientPills = (boxEl, items, type) => {
    if (!boxEl) return;
    const selection = window.getSelection();
    items.forEach((item) => {
      if (isDuplicateRecipientLabel(boxEl, item.label)) return;
      const pill = buildRecipientPill(item.label, type, item.id ?? null);
      const existingRange = selection?.rangeCount > 0 && boxEl.contains(selection.getRangeAt(0).commonAncestorContainer)
        ? selection.getRangeAt(0)
        : null;
      if (existingRange) {
        existingRange.deleteContents();
        existingRange.insertNode(pill);
        const spaceNode = document.createTextNode(' ');
        pill.after(spaceNode);
        const newRange = document.createRange();
        newRange.setStartAfter(spaceNode);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
      } else {
        boxEl.appendChild(pill);
        boxEl.appendChild(document.createTextNode(' '));
      }
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

    if (isDuplicateRecipientLabel(boxEl, trimmed)) {
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
    return Array.from(el.childNodes).reduce((acc, node) => {
      if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('notification-user-pill')) {
        const rawId = node.dataset.tokenId;
        const id = rawId ? (Number.isNaN(Number(rawId)) ? rawId : Number(rawId)) : null;
        acc.push({ label: node.dataset.label ?? node.textContent, id, type: node.dataset.tokenType });
      } else if (node.nodeType === Node.TEXT_NODE) {
        const trimmed = node.textContent.trim().replace(/,+$/, '').trim();
        if (trimmed && NOTIFICATION_EMAIL_REGEX.test(trimmed) && !acc.some((t) => t.label === trimmed)) {
          acc.push({ label: trimmed, id: null, type: 'email' });
        }
      }
      return acc;
    }, []);
  };

  // ReactQuill's onChange is wired directly to setBodyContent, so bodyContent is an HTML
  // string once the user has typed anything; it's only ever the initial Delta before that.
  const bodyContentToText = (content) => {
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
        cb: (data) => {
          onSave({ from: fromEmail, to: toTokens, cc: ccTokens, subjectParts, bodyContent, notificationId: data?.notification_id ?? null });
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

  // Mirrors handleAddSubjectField's cursor-based insert so a card field lands
  // exactly where the caret is, instead of always being appended at the end.
  const handleInsertUrlField = (field) => {
    const el = urlBoxRef.current;
    if (!el) return;
    const span = buildUrlFieldPill(field);

    const selection = window.getSelection();
    const existingRange = selection?.rangeCount > 0 && el.contains(selection.getRangeAt(0).commonAncestorContainer)
      ? selection.getRangeAt(0)
      : null;
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
    if (!removeBtn) return;
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
      headers: supportsBody
        ? headers.filter((h) => !isBlankHeaderRow(h)).map((h) => ({ key: h.key, value: h.value }))
        : [],
      params: params
        .filter((p) => !isBlankParamRow(p))
        .map((p) => ({ key: p.key, value: p.fields.length > 0 ? joinUrlFields('', p.fields) : p.value })),
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
        const message = stripHtmlTags(data?.message);
        const errorDetail = ok ? '' : extractTestErrorDetail(result.response_body);
        setTestResult({
          ok,
          statusCode,
          durationMs: result.duration_ms ?? null,
          responseBody: result.response_body ?? '',
          message: errorDetail && errorDetail !== message ? `${message} ${errorDetail}`.trim() : message,
        });
      },
      onError: (err) => {
        setTestResult({
          ok: false,
          statusCode: null,
          durationMs: null,
          responseBody: '',
          message: stripHtmlTags(err?.response?.data?.message ?? err.message) || 'Test request failed.',
        });
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
              onPaste={handleUrlPaste}
              onInput={() => setSaveError('')}
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

function BusinessRuleFormModal({ show, rule, boardName, onClose, onSave, isSaving }) {
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
  const [openCreateTemplateRowId, setOpenCreateTemplateRowId] = useState(null);
  const [createTemplateFilterText, setCreateTemplateFilterText] = useState('');
  const createTemplateTriggerRef = useRef(null);
  const createTemplatePanelRef = useRef(null);
  const [showCreateDetailsPicker, setShowCreateDetailsPicker] = useState(false);
  const [activeCreateActionId, setActiveCreateActionId] = useState(null);
  const [showCopyCardDetailsPicker, setShowCopyCardDetailsPicker] = useState(false);
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
  // have no schedule options from get_regular_fields/get_then_action_fields beyond the
  // generic days/hours/minutes/seconds time units — there's no day-of-week or timezone
  // catalog on the backend yet, so the frequency and timezone lists below are built
  // client-side from that one shared time-unit list plus the runtime's own IANA database.
  const [recurrenceUnit, setRecurrenceUnit] = useState('days');
  const [showRecurrenceUnitPicker, setShowRecurrenceUnitPicker] = useState(false);
  const recurrenceUnitTriggerRef = useRef(null);
  const recurrenceUnitPanelRef = useRef(null);
  const [executeAtTime, setExecuteAtTime] = useState('00:00');
  const [executeAtTimezone, setExecuteAtTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  });
  const [showTimezonePicker, setShowTimezonePicker] = useState(false);
  const [timezoneFilterText, setTimezoneFilterText] = useState('');
  const timezoneTriggerRef = useRef(null);
  const timezonePanelRef = useRef(null);

  const {
    getTriggerConfig, triggerConfig, isLoadingTriggerConfig, getFieldDetails, fieldDetailsByKey, isLoadingFieldDetails,
    linkCardActionOperators, isLoadingLinkCardActionOperators, getLinkCardPossibleActionOperators,
    getNotificationSettings, notificationSettings, isLoadingNotificationSettings, resetNotificationSettings,
    deleteNotificationSettings,
    getWebServiceSettings, webServiceSettings, isLoadingWebServiceSettings, resetWebServiceSettings,
    timeUnits, getTimeUnits,
    deleteWebServiceSettings,
    deleteCreateSubtaskSettings,
    getCreateSubtaskSettings, createSubtaskSettings, isLoadingCreateSubtaskSettings, resetCreateSubtaskSettings,
  } = useBusinessRuleReducer((s) => s);
  const { users, usersLoading, getUsers } = useCommonReducer((s) => s);
  const { workspaces, listAllWorkspaces } = useWorkSpaceReducer((s) => s);
  const userProfile = useAuthReducer((s) => s.userProfile);
  const loggedInUserId = userProfile?.user_id ?? userProfile?.userid ?? null;
  const loggedInUserName = userProfile?.name || userProfile?.username || 'You';

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
  const thenActionSections = sortedTriggerActions.length > 0
    ? sortedTriggerActions
      .map((action) => ({ id: ACTION_GROUP_TYPE_TO_SECTION_ID[action.group_type], title: action.action_name }))
      .filter((section) => section.id)
    : (import.meta.env.DEV ? THEN_ACTION_SECTIONS : []);

  // Each THEN action section fetches its own regular/custom/time-unit field catalog
  // from get_then_action_fields, keyed by this trigger's action_type_id for that
  // group_type (get_trigger_config's actions[] carries one per group_type).
  const createActionTypeId = sortedTriggerActions.find((a) => a.group_type === 'create_cards')?.action_type_id;
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

  const copyValuesActionTypeId = sortedTriggerActions.find((a) => a.group_type === 'copy_values_to_parent')?.action_type_id;

  useEffect(() => {
    if (!show || !rule) return;
    getTriggerConfig(rule.id);
    if (users.length === 0 && !usersLoading) getUsers({ params: { limit: 200 } });
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
    setRecurrenceUnit('days');
    setShowRecurrenceUnitPicker(false);
    setExecuteAtTime('00:00');
    setShowTimezonePicker(false);
    setTimezoneFilterText('');
    if (timeUnits.length === 0) getTimeUnits();
  }, [show, rule, loggedInUserName, loggedInUserId]);

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
    if (!showRecurrenceUnitPicker) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (recurrenceUnitPanelRef.current?.contains(t)) return;
      if (recurrenceUnitTriggerRef.current?.contains(t)) return;
      setShowRecurrenceUnitPicker(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [showRecurrenceUnitPicker]);

  useEffect(() => {
    if (!showTimezonePicker) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (timezonePanelRef.current?.contains(t)) return;
      if (timezoneTriggerRef.current?.contains(t)) return;
      setShowTimezonePicker(false);
      setTimezoneFilterText('');
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [showTimezonePicker]);

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
    if (openCreateTemplateRowId == null) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (createTemplatePanelRef.current?.contains(t)) return;
      if (createTemplateTriggerRef.current?.contains(t)) return;
      setOpenCreateTemplateRowId(null);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [openCreateTemplateRowId]);

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
    if (actions.some((a) => a.group_type === 'copy_values_to_parent')) {
      setCopyValuesActions((prev) => (prev.length === 0
        ? [{ id: Date.now(), fields: [], filterProperties: [] }]
        : prev));
    }
  }, [show, triggerConfig]);

  // Default each condition's operator to the first option (usually "is") as soon as its
  // field details load, so the row reads "Label is" instead of a blank "Select operator".
  useEffect(() => {
    setConditions((prev) => {
      let changed = false;
      const next = prev.map((cond) => {
        if (cond.operatorId) return cond;
        const detailsKey = cond.fieldType && cond.fieldId != null ? `${cond.fieldType}-${cond.fieldId}` : null;
        const operators = detailsKey ? fieldDetailsByKey[detailsKey]?.operators : null;
        if (!operators || operators.length === 0) return cond;
        changed = true;
        return { ...cond, operatorId: operators[0].field_operator_id };
      });
      return changed ? next : prev;
    });
  }, [fieldDetailsByKey]);

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
    };

    const unconfigured = getUnconfiguredActionLabels(formState);
    if (unconfigured.length > 0) {
      setSaveError(`Finish configuring these actions before saving: ${unconfigured.join(', ')}.`);
      return;
    }
    setSaveError('');

    const payload = buildCreateBusinessRulePayload(formState, { loggedInUserId, triggerConfig, fieldDetailsByKey });
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
    setCreateActions([]);
  };

  const handleToggleCreateTemplatePicker = (id) => {
    setCreateTemplateFilterText('');
    setOpenCreateTemplateRowId((prev) => (prev === id ? null : id));
  };

  const handleSelectCreateTemplate = (id, templateName) => {
    setCreateActions((prev) => prev.map((a) => (a.id === id ? { ...a, templateName } : a)));
    setOpenCreateTemplateRowId(null);
  };

  const handleOpenCreateDetails = (id) => {
    setActiveCreateActionId(id);
    setShowCreateDetailsPicker(true);
  };

  const handleSaveCreateDetails = (destination) => {
    setCreateActions((prev) => prev.map((a) => (a.id === activeCreateActionId ? { ...a, ...destination } : a)));
    // Relational create variants (child/parent/...) create a card linked to the card that
    // triggered the rule, so once a destination is picked they get one more step: choosing
    // which of that originator card's fields to carry over onto the new card.
    const action = createActions.find((a) => a.id === activeCreateActionId);
    if (action && RELATIONAL_CREATE_ACTION_LABELS.includes(action.label?.trim().toLowerCase())) {
      setShowCopyCardDetailsPicker(true);
    }
  };

  const handleContinueCopyCardDetails = (fields) => {
    setCreateActions((prev) => prev.map((a) => (a.id === activeCreateActionId ? { ...a, copyFields: fields } : a)));
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

  const createTemplateFilterQuery = createTemplateFilterText.trim().toLowerCase();
  const filteredCreateTemplates = createTemplateFilterQuery
    ? DUMMY_CREATE_ACTION_TEMPLATES.filter((name) => name.toLowerCase().includes(createTemplateFilterQuery))
    : DUMMY_CREATE_ACTION_TEMPLATES;

  const handleAddMoveAction = () => {
    const option = MOVE_ACTION_OPTIONS[0];
    setMoveActions((prev) => [
      ...prev,
      {
        id: Date.now(), key: option.key, label: option.label,
        boardId: '', boardName: '', swimlaneId: '', swimlaneName: '', stageId: '', stageName: '',
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
        boardId: '', boardName: '', swimlaneId: '', swimlaneName: '', stageId: '', stageName: '',
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
      setUpdateActions((prev) => [
        ...prev,
        {
          id, category: 'action', key: item.key, label: item.label, field: item.field,
          values: [{ id: `${id}-0`, userId: '', userName: '' }],
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

  const handleAddNotifyAction = () => {
    const option = NOTIFY_ACTION_OPTIONS[0];
    setNotifyActions((prev) => [...prev, { id: Date.now(), key: option.key, label: option.label }]);
  };

  const handleRemoveNotifyAction = (id) => {
    // Only a notify action that was actually saved on the backend (has a
    // notification_id) needs the delete call — one still unconfigured/unsaved
    // has nothing to remove server-side.
    const action = notifyActions.find((a) => a.id === id);
    console.log('[DEBUG] handleRemoveNotifyAction', { id, action, notifyActions });
    if (action?.notification_id) {
      deleteNotificationSettings(action.notification_id, {
        cb: () => setNotifyActions((prev) => prev.filter((a) => a.id !== id)),
      });
    } else {
      setNotifyActions((prev) => prev.filter((a) => a.id !== id));
    }
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
    setCreateActions((prev) => prev.map((a) => (a.id === activeCreateSubtaskActionId ? { ...a, ...settings, configured: true } : a)));
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

  const handleCloseAttempt = () => {
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
          <h2 className="business-rule-form-modal-title">Add business rule</h2>
          <button
            type="button"
            className="business-rule-form-modal-close"
            onClick={handleCloseAttempt}
            aria-label="Close"
          >
            <FiX size={20} />
          </button>
        </header>

        <div className="business-rule-form-modal-body">
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

          <section className="business-rule-form-flow" aria-label="Rule builder">
            <div className="business-rule-form-column">
              <h3 className="business-rule-form-column-title">WHEN</h3>
              <p className="business-rule-form-trigger-name business-rule-form-trigger-name--plain">{whenTriggerName}</p>

              {triggerConfig?.when_type === 'regular_fields' ? (
                <div className="business-rule-form-column-card business-rule-form-when-fields">
                  <div className="board-minimap-picker-wrap">
                    <button
                      type="button"
                      ref={showRecurrenceUnitPicker ? recurrenceUnitTriggerRef : undefined}
                      className="business-rule-form-when-fields-pill"
                      onClick={() => setShowRecurrenceUnitPicker((prev) => !prev)}
                      aria-haspopup="listbox"
                      aria-expanded={showRecurrenceUnitPicker}
                    >
                      Every {RECURRENCE_UNIT_SINGULAR_LABEL[recurrenceUnit] || recurrenceUnit}
                    </button>

                    {showRecurrenceUnitPicker && (
                      <div className="board-minimap-picker-panel" ref={recurrenceUnitPanelRef}>
                        <div className="board-minimap-picker-scroll">
                          {(timeUnits.length > 0 ? timeUnits : DUMMY_TIME_UNITS).map((unit) => (
                            <button
                              type="button"
                              key={unit.time_unit_id ?? unit.unit_key}
                              className="br-create-template-option"
                              onClick={() => { setRecurrenceUnit(unit.unit_key); setShowRecurrenceUnitPicker(false); }}
                            >
                              Every {RECURRENCE_UNIT_SINGULAR_LABEL[unit.unit_key] || unit.unit_label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
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
                            ? `${row.boardName} → ${row.swimlaneName || 'Any lane'} / ${row.stageName || 'Any stage'}`
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
                  <div key={section.id} className="business-rule-form-action-section">
                    <h4 className="business-rule-form-action-title">{section.title}</h4>

                    {section.id === 'create' && createActions.length > 0 && (
                      <div className="br-create-action-list">
                        {createActions.map((action) => {
                          // Matched by label rather than key: the DEV fallback's key is the
                          // literal string 'subtask', but a live get_then_action_fields
                          // response keys this same "Create subtask" regular field by its
                          // own field_key (e.g. a backend id), which isn't 'subtask'.
                          const hasCustomProperties = action.label?.trim().toLowerCase() !== 'create subtask';
                          const isTemplatePickerOpen = openCreateTemplateRowId === action.id;
                          const titleText = action.templateName
                            ? `${action.label} - ${action.templateName}`
                            : `${action.label}${hasCustomProperties ? ' with custom properties' : ''}`;
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

                              {hasCustomProperties ? (
                                <div className="board-minimap-picker-wrap br-create-template-wrap">
                                  <button
                                    type="button"
                                    ref={isTemplatePickerOpen ? createTemplateTriggerRef : undefined}
                                    className="br-create-action-title br-create-action-title--trigger"
                                    onClick={() => handleToggleCreateTemplatePicker(action.id)}
                                    aria-haspopup="listbox"
                                    aria-expanded={isTemplatePickerOpen}
                                  >
                                    {titleText}
                                    <FiChevronDown size={14} aria-hidden />
                                  </button>

                                  {isTemplatePickerOpen && (
                                    <div className="board-minimap-picker-panel br-create-template-panel" ref={createTemplatePanelRef}>
                                      <div className="board-minimap-picker-search">
                                        <FiFilter size={16} className="board-minimap-picker-search-icon" aria-hidden />
                                        <input
                                          type="text"
                                          placeholder="Filter"
                                          value={createTemplateFilterText}
                                          onChange={(e) => setCreateTemplateFilterText(e.target.value)}
                                          autoFocus
                                        />
                                      </div>
                                      <div className="board-minimap-picker-scroll br-create-template-scroll">
                                        <button
                                          type="button"
                                          className="br-create-template-option br-create-template-option--default"
                                          onClick={() => handleSelectCreateTemplate(action.id, null)}
                                        >
                                          with custom properties
                                        </button>
                                        <div className="br-create-template-section-label">Templates</div>
                                        {filteredCreateTemplates.length === 0 ? (
                                          <div className="br-property-picker-empty">No matches</div>
                                        ) : (
                                          filteredCreateTemplates.map((name) => (
                                            <button
                                              type="button"
                                              key={name}
                                              className="br-create-template-option"
                                              onClick={() => handleSelectCreateTemplate(action.id, name)}
                                            >
                                              {name}
                                            </button>
                                          ))
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <h5 className="br-create-action-title">{titleText}</h5>
                              )}

                              {hasCustomProperties ? (
                                <button
                                  type="button"
                                  className="br-create-action-link br-create-action-link--btn"
                                  onClick={() => handleOpenCreateDetails(action.id)}
                                >
                                  {action.boardName
                                    ? `${action.boardName} → ${action.swimlaneName || 'Any lane'} / ${action.stageName || 'Any stage'}`
                                    : 'Configure details'}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="br-create-action-link br-create-action-link--btn"
                                  onClick={() => handleOpenCreateSubtaskSettings(action.id)}
                                >
                                  {action.configured ? (action.description?.trim() || 'Configured') : 'Not Set'}
                                </button>
                              )}
                            </div>
                          );
                        })}

                        <div className="br-link-footer-actions">
                          <button
                            type="button"
                            className="business-rule-form-add-link"
                            onClick={() => setShowCreateActionPicker(true)}
                          >
                            <FiPlus size={14} aria-hidden />
                            Add new action
                          </button>
                          <button
                            type="button"
                            className="business-rule-form-add-link"
                            onClick={handleClearCreateActions}
                          >
                            Clear all
                          </button>
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
                          <button
                            type="button"
                            className="business-rule-form-add-link"
                            onClick={handleClearLinkActions}
                          >
                            Clear all
                          </button>
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
                      return (
                        <div key={action.id} className="business-rule-form-action-chip">
                          <span className="business-rule-form-action-chip-label">
                            {action.label}
                          </span>
                          <input
                            type="text"
                            className="br-update-action-value-input"
                            placeholder="New value"
                            value={action.value ?? ''}
                            onChange={(e) => handleChangeUpdateActionValue(action.id, e.target.value)}
                          />
                          <button
                            type="button"
                            className="business-rule-form-condition-remove"
                            onClick={() => handleRemoveUpdateAction(action.id)}
                            aria-label="Remove action"
                          >
                            <FiTrash2 size={14} />
                          </button>
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
                          <p className="business-rule-form-when-fields-header">if parent card matches this filter</p>
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
                            ? `${action.boardName} → ${action.swimlaneName || 'Any lane'} / ${action.stageName || 'Any stage'}`
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
                            ? `${action.boardName} → ${action.swimlaneName || 'Any lane'} / ${action.stageName || 'Any stage'}`
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
                        <div className="board-minimap-picker-wrap">
                          <input
                            type="time"
                            aria-label="Execute at time"
                            className="business-rule-form-condition-input"
                            value={executeAtTime}
                            onChange={(e) => setExecuteAtTime(e.target.value)}
                          />
                        </div>

                        <div className="board-minimap-picker-wrap">
                          <button
                            type="button"
                            ref={showTimezonePicker ? timezoneTriggerRef : undefined}
                            className="business-rule-form-action-detail-link"
                            onClick={() => setShowTimezonePicker((prev) => !prev)}
                            aria-haspopup="listbox"
                            aria-expanded={showTimezonePicker}
                          >
                            {executeAtTimezone}
                            <FiChevronDown size={14} aria-hidden />
                          </button>

                          {showTimezonePicker && (
                            <div className="board-minimap-picker-panel" ref={timezonePanelRef}>
                              <div className="board-minimap-picker-search">
                                <FiFilter size={16} className="board-minimap-picker-search-icon" aria-hidden />
                                <input
                                  type="text"
                                  placeholder="Filter"
                                  value={timezoneFilterText}
                                  onChange={(e) => setTimezoneFilterText(e.target.value)}
                                  autoFocus
                                />
                              </div>
                              <div className="board-minimap-picker-scroll">
                                {TIMEZONE_LIST
                                  .filter((tz) => tz.toLowerCase().includes(timezoneFilterText.trim().toLowerCase()))
                                  .slice(0, 200)
                                  .map((tz) => (
                                    <button
                                      type="button"
                                      key={tz}
                                      className="br-create-template-option"
                                      onClick={() => { setExecuteAtTimezone(tz); setShowTimezonePicker(false); setTimezoneFilterText(''); }}
                                    >
                                      {tz}
                                    </button>
                                  ))}
                              </div>
                            </div>
                          )}
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

                    {section.id !== 'execute' && !(section.id === 'link' && linkActions.length > 0) && !(section.id === 'create' && createActions.length > 0) && (
                      <button
                        type="button"
                        className="business-rule-form-add-action"
                        onClick={() => {
                          if (section.id === 'create') setShowCreateActionPicker(true);
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
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <footer className="business-rule-form-modal-footer">
          {saveError && <p className="text-danger mb-2">{saveError}</p>}
          <p className="business-rule-form-footer-note">
            <strong>Note:</strong> Due to their asynchronous nature, the business rules may sometimes run with a short delay. In rare cases it may take up to 30 minutes.
          </p>
          <button type="button" className="business-rule-form-save-btn" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </footer>
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

    <CopyCardDetailsModal
      show={showCopyCardDetailsPicker}
      onClose={() => setShowCopyCardDetailsPicker(false)}
      onContinue={handleContinueCopyCardDetails}
      triggerTypeId={rule.id}
      boardId={activeCreateAction?.boardId}
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
};

export default BusinessRuleFormModal;
