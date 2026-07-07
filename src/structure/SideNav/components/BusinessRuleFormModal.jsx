import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiPlus, FiChevronDown, FiChevronUp, FiTrash2, FiFilter, FiUsers, FiInfo } from 'react-icons/fi';
import { Modal } from 'react-bootstrap';
import PropTypes from 'prop-types';
import ReactQuill, { Quill } from 'react-quill';
import QuillTableBetter from 'quill-table-better';
import 'react-quill/dist/quill.snow.css';
import 'quill-table-better/dist/quill-table-better.css';
import BusinessRuleIcon from './BusinessRuleIcon';
import {
  THEN_ACTION_SECTIONS, CREATE_ACTION_OPTIONS, LINK_ACTION_OPTIONS, MOVE_ACTION_OPTIONS, NOTIFY_ACTION_OPTIONS, UPDATE_ACTION_OPTIONS,
  INVOKE_ACTION_OPTIONS, DUMMY_INVOKE_METHOD_OPTIONS, DUMMY_INVOKE_AUTH_OPTIONS, DUMMY_INVOKE_PAYLOAD_FIELDS, DUMMY_URL_FIELD_OPTIONS,
  DUMMY_REGULAR_FIELDS, DUMMY_TIME_UNITS, DUMMY_CUSTOM_FIELDS, DUMMY_BOARD_TITLE,
  DUMMY_BOARD_AREA_GROUPS, DUMMY_BOARD_HEADER_CELLS, DUMMY_BOARD_LEAF_COLUMNS, DUMMY_BOARD_SWIMLANES,
  DUMMY_NOTIFICATION_FROM_EMAIL, DUMMY_NOTIFICATION_FIELDS, DUMMY_NOTIFICATION_BODY_FIELDS, DUMMY_INTERNAL_USERS,
  DUMMY_NOTIFICATION_SUBJECT_PARTS, DUMMY_NOTIFICATION_BODY_DELTA_OPS,
} from './businessRulesData';
import useBusinessRuleReducer from '../../../store/BusinessRuleReducer';
import useWorkSpaceReducer from '../../../store/WorkSpaceReducer';
import useCommonReducer from '../../../store/CommonReducer';
import { pickForegroundOnSwimlaneBackground } from '../../../pages/EditWorkflows/workflow.utils';
import { getInitials } from '../../../shared/utils/utils';
import { PRIMARY_PRESET_COLORS, SECONDARY_PRESET_COLORS } from '../../../components/SedresColorPicker/sedresColorPickerConstants';

Quill.register({ 'modules/table-better': QuillTableBetter }, true);
QuillTableBetter.register();

// Custom inline format so the "field pill" tokens (e.g. Title, Author) in the
// notification body survive Quill's HTML sanitization instead of collapsing to
// plain text — Quill only preserves attributes tied to a registered format.
const QuillInlineBlot = Quill.import('blots/inline');
class NotificationPillBlot extends QuillInlineBlot {}
NotificationPillBlot.blotName = 'pill';
NotificationPillBlot.tagName = 'span';
NotificationPillBlot.className = 'notification-pill';
// Quill's Inline.compare() (used to decide DOM nesting order for overlapping
// formats) only recognizes names listed in Inline.order — an unlisted name makes
// the comparison always resolve as "don't wrap", so the pill format would never
// actually apply. Registering it here is required, not optional.
QuillInlineBlot.order.push('pill');
// Our tagName ('span') is identical to Quill's own generic Inline wrapper tag, so
// the inherited static formats() (which special-cases that tag to mean "no format,
// just a bare wrapper") reports empty formats for us too — Quill's optimizer then
// unwraps/removes the span right after creating it. Overriding formats() to always
// report true stops it from being treated as an empty wrapper.
NotificationPillBlot.formats = () => true;
Quill.register(NotificationPillBlot);
const QuillDelta = Quill.import('delta');

const DEFAULT_OWNER = { name: 'You', initials: 'YO' };

const PROPERTY_DOT_COLORS = [...PRIMARY_PRESET_COLORS, ...SECONDARY_PRESET_COLORS];

const getFieldLabel = (field) =>
  field.field_label ?? field.unit_label ?? field.field_name ?? field.custom_field_name ?? field.unit_name ?? '';

const getPropertyDotColor = (idx) => PROPERTY_DOT_COLORS[idx % PROPERTY_DOT_COLORS.length];

// Shared by every picker that scopes custom fields to a trigger type (card property
// match, refine update criteria, ...) so the trigger_type_id filtering logic lives in
// one place instead of being duplicated per modal.
function useCustomFieldsByTrigger({ show, triggerTypeId, boardId, showDisabled, search }) {
  const { customFields, isLoadingCustomFields, getCustomFields } = useBusinessRuleReducer((s) => s);

  useEffect(() => {
    if (!show) return;
    getCustomFields({ params: { board_id: boardId || undefined, trigger_type_id: triggerTypeId } });
  }, [show]);

  useEffect(() => {
    if (!show) return;
    getCustomFields({ params: { board_id: boardId || undefined, search: search || undefined, trigger_type_id: triggerTypeId } });
  }, [boardId, showDisabled, search, triggerTypeId]);

  return { customFields, isLoadingCustomFields };
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

function CardPropertyMatchModal({ show, onClose, onSelect, existingFieldLabels, triggerTypeId }) {
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
    show, triggerTypeId, boardId: selectedBoardId, showDisabled, search: debouncedSearch,
  });

  const { workspaces, listAllWorkspaces } = useWorkSpaceReducer((s) => s);
  const boards = (workspaces ?? []).flatMap((w) => w.boards ?? []);

  // Dev-only fallback so the modal can be visually tested without a live backend.
  const displayRegularFields = regularFields.length > 0 ? regularFields : (import.meta.env.DEV ? DUMMY_REGULAR_FIELDS : []);
  const displayTimeUnits = timeUnits.length > 0 ? timeUnits : (import.meta.env.DEV ? DUMMY_TIME_UNITS : []);
  const displayCustomFields = customFields.length > 0 ? customFields : (import.meta.env.DEV ? DUMMY_CUSTOM_FIELDS : []);

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
    if (!show) return;
    getTimeUnits({ params: { trigger_type_id: triggerTypeId, search: debouncedSearch || undefined } });
  }, [show, debouncedSearch, triggerTypeId]);

  const handleToggleRegularField = (field, key) => {
    setSelectedRegularFields((prev) =>
      prev.some((item) => item.key === key)
        ? prev.filter((item) => item.key !== key)
        : [...prev, { key, field }]
    );
  };

  const handleToggleTimeUnit = (field, key) => {
    setSelectedTimeUnits((prev) =>
      prev.some((item) => item.key === key)
        ? prev.filter((item) => item.key !== key)
        : [...prev, { key, field }]
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
                    <div className="business-rule-form-select-wrap br-property-board-select-wrap">
                      <select
                        className="business-rule-form-select"
                        value={selectedBoardId}
                        onChange={(e) => setSelectedBoardId(e.target.value)}
                      >
                        <option value="">All Boards</option>
                        {boards.map((b) => (
                          <option key={b.board_id} value={b.board_id}>{b.board_name}</option>
                        ))}
                      </select>
                      <FiChevronDown className="business-rule-form-select-icon" aria-hidden />
                    </div>
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

function CreateActionModal({ show, onClose, onSelect }) {
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [expandedRegularFields, setExpandedRegularFields] = useState(true);
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    if (!show) return;
    setSelectedKeys([]);
    setFilterText('');
  }, [show]);

  const filterQuery = filterText.trim().toLowerCase();
  const filteredOptions = filterQuery
    ? CREATE_ACTION_OPTIONS.filter((opt) => opt.label.toLowerCase().includes(filterQuery))
    : CREATE_ACTION_OPTIONS;

  const handleToggleOption = (key) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleAdd = () => {
    if (selectedKeys.length === 0) return;
    CREATE_ACTION_OPTIONS
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
                {filteredOptions.length === 0 ? (
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

  useEffect(() => {
    if (!show) return;
    setSelectedKeys([]);
    setFilterText('');
  }, [show]);

  const filterQuery = filterText.trim().toLowerCase();
  const filteredOptions = filterQuery
    ? LINK_ACTION_OPTIONS.filter((opt) => opt.label.toLowerCase().includes(filterQuery))
    : LINK_ACTION_OPTIONS;

  const handleToggleOption = (key) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleAdd = () => {
    if (selectedKeys.length === 0) return;
    LINK_ACTION_OPTIONS
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
                {filteredOptions.length === 0 ? (
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

  // The swimlanes and the column/header layout below are a fixed demo dataset (see
  // DUMMY_BOARD_* in businessRulesData.js) shown for every board regardless of its
  // real structure, per client-facing walkthrough requirements.
  const swimlanes = DUMMY_BOARD_SWIMLANES;
  const areaGroups = DUMMY_BOARD_AREA_GROUPS;
  const headerCells = DUMMY_BOARD_HEADER_CELLS;
  const leafColumns = DUMMY_BOARD_LEAF_COLUMNS;

  const handlePickCell = (swimlane, leafColumn) => {
    onSave({
      boardId,
      boardName: boards.find((b) => String(b.board_id) === String(boardId))?.board_name ?? '',
      swimlaneId: swimlane.id,
      swimlaneName: swimlane.name,
      stageId: leafColumn.id,
      stageName: leafColumn.name,
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

          {!boardId ? (
            <div className="br-property-picker-empty">Select a board to view its structure</div>
          ) : swimlanes.length === 0 ? (
            <div className="br-property-picker-empty">No lanes found for this board</div>
          ) : (
            <div className="board-minimap-grid">
              <div className="board-minimap-title-bar">{DUMMY_BOARD_TITLE}</div>

              <div className="board-minimap-area-row">
                {areaGroups.map((group, idx) => (
                  <div
                    key={`${group.area}-${idx}`}
                    className="board-minimap-area-cell"
                    style={{ flexGrow: group.span, backgroundColor: group.color }}
                  >
                    {group.area}
                  </div>
                ))}
              </div>

              <div className="board-minimap-header-grid">
                {headerCells.map((cell) => (
                  <div
                    key={cell.gridArea}
                    className={`board-minimap-header-cell board-minimap-header-cell--${cell.gridArea}`}
                  >
                    {cell.name}
                  </div>
                ))}
              </div>

              {swimlanes.map((swimlane) => (
                <div key={swimlane.id} className="board-minimap-lane-row">
                  <div
                    className="board-minimap-lane-label"
                    style={swimlane.colorCode
                      ? { backgroundColor: swimlane.colorCode, color: pickForegroundOnSwimlaneBackground(swimlane.colorCode) }
                      : undefined}
                  >
                    {swimlane.name}
                  </div>
                  <div className="board-minimap-lane-cells">
                    {leafColumns.map((leafColumn) => (
                      <button
                        type="button"
                        key={leafColumn.id}
                        className={`board-minimap-cell${leafColumn.accent ? ` board-minimap-cell--${leafColumn.accent}` : ''}`}
                        onClick={() => handlePickCell(swimlane, leafColumn)}
                        aria-label={`Move to ${swimlane.name}, ${leafColumn.name}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function RefineUpdateCriteriaModal({ show, onClose, onSelect, existingFieldLabels, triggerTypeId }) {
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
  const { workspaces, listAllWorkspaces } = useWorkSpaceReducer((s) => s);
  const boards = (workspaces ?? []).flatMap((w) => w.boards ?? []);

  const displayCustomFields = customFields.length > 0 ? customFields : (import.meta.env.DEV ? DUMMY_CUSTOM_FIELDS : []);

  const isFieldUsed = (field) =>
    (existingFieldLabels ?? []).includes(getFieldLabel(field).trim().toLowerCase());

  const filterQuery = filterText.trim().toLowerCase();
  const filteredRegularOptions = filterQuery
    ? UPDATE_ACTION_OPTIONS.filter((opt) => opt.label.toLowerCase().includes(filterQuery))
    : UPDATE_ACTION_OPTIONS;
  const filteredCustomFields = displayCustomFields;

  useEffect(() => {
    if (!show) return;
    setSelectedActions([]);
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
                {filteredRegularOptions.length === 0 ? (
                  <div className="br-property-picker-empty">No fields found</div>
                ) : (
                  filteredRegularOptions.map((option) => (
                    <PropertyPill
                      key={option.key}
                      pillKey={option.key}
                      label={option.label}
                      selected={selectedActions.some((item) => item.key === `action-${option.key}`)}
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
                    <div className="business-rule-form-select-wrap br-property-board-select-wrap">
                      <select
                        className="business-rule-form-select"
                        value={selectedBoardId}
                        onChange={(e) => setSelectedBoardId(e.target.value)}
                      >
                        <option value="">All Boards</option>
                        {boards.map((b) => (
                          <option key={b.board_id} value={b.board_id}>{b.board_name}</option>
                        ))}
                      </select>
                      <FiChevronDown className="business-rule-form-select-icon" aria-hidden />
                    </div>
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

function NotificationSettingsModal({ show, onClose, onSave, initialSettings }) {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subjectParts, setSubjectParts] = useState(DUMMY_NOTIFICATION_SUBJECT_PARTS);
  const [bodyContent, setBodyContent] = useState(() => new QuillDelta(DUMMY_NOTIFICATION_BODY_DELTA_OPS));
  const [openDropdown, setOpenDropdown] = useState(null);
  const quillRef = useRef(null);

  useEffect(() => {
    if (!show) return;
    setTo(initialSettings?.to ?? '');
    setCc(initialSettings?.cc ?? '');
    setSubjectParts(initialSettings?.subjectParts ?? DUMMY_NOTIFICATION_SUBJECT_PARTS);
    setBodyContent(initialSettings?.bodyContent ?? new QuillDelta(DUMMY_NOTIFICATION_BODY_DELTA_OPS));
    setOpenDropdown(null);
  }, [show, initialSettings]);

  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill || quill._pillMatcherAdded) return;
    quill.clipboard.addMatcher('span.notification-pill', (node) => new QuillDelta().insert(node.textContent, { pill: true }));
    quill._pillMatcherAdded = true;
  }, [show]);

  const appendToken = (setter, current, value) => {
    setter(current ? `${current}, ${value}` : value);
  };

  const handleAddSubjectField = (field) => {
    setSubjectParts((prev) => [...prev, { type: 'pill', value: field }]);
    setOpenDropdown(null);
  };

  const handleAddBodyField = (field) => {
    const quill = quillRef.current?.getEditor();
    setOpenDropdown(null);
    if (!quill) return;
    const index = quill.getSelection(true)?.index ?? quill.getLength();
    quill.insertText(index, field, { pill: true });
    quill.insertText(index + field.length, ' ', { pill: false });
    quill.setSelection(index + field.length + 1, 0);
  };

  const handleSave = () => {
    onSave({ to, cc, subjectParts, bodyContent });
    onClose();
  };

  const quillModules = useMemo(() => ({
    table: false,
    toolbar: [
      [{ size: ['small', false, 'large', 'huge'] }],
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

  return (
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
              <select className="business-rule-form-select" value={DUMMY_NOTIFICATION_FROM_EMAIL} disabled>
                <option value={DUMMY_NOTIFICATION_FROM_EMAIL}>{DUMMY_NOTIFICATION_FROM_EMAIL}</option>
              </select>
              <FiChevronDown className="business-rule-form-select-icon" aria-hidden />
            </div>
          </div>

          <div className="notification-field">
            <div className="notification-field-head">
              <label className="business-rule-form-label">To:</label>
              <div className="notification-field-actions">
                <div className="notification-dropdown-wrap">
                  <button
                    type="button"
                    className="notification-dropdown-trigger"
                    onClick={() => setOpenDropdown((v) => (v === 'to-users' ? null : 'to-users'))}
                  >
                    add internal users <FiChevronDown size={12} aria-hidden />
                  </button>
                  {openDropdown === 'to-users' && (
                    <div className="notification-dropdown-panel">
                      {DUMMY_INTERNAL_USERS.map((u) => (
                        <button type="button" key={u} onClick={() => { appendToken(setTo, to, u); setOpenDropdown(null); }}>{u}</button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="notification-dropdown-wrap">
                  <button
                    type="button"
                    className="notification-dropdown-trigger"
                    onClick={() => setOpenDropdown((v) => (v === 'to-fields' ? null : 'to-fields'))}
                  >
                    add custom fields <FiChevronDown size={12} aria-hidden />
                  </button>
                  {openDropdown === 'to-fields' && (
                    <div className="notification-dropdown-panel">
                      {DUMMY_CUSTOM_FIELDS.slice(0, 8).map((f) => (
                        <button type="button" key={f.custom_field_id} onClick={() => { appendToken(setTo, to, f.field_label); setOpenDropdown(null); }}>{f.field_label}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <input type="text" className="business-rule-form-input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>

          <div className="notification-field">
            <div className="notification-field-head">
              <label className="business-rule-form-label">Cc:</label>
              <div className="notification-field-actions">
                <div className="notification-dropdown-wrap">
                  <button
                    type="button"
                    className="notification-dropdown-trigger"
                    onClick={() => setOpenDropdown((v) => (v === 'cc-users' ? null : 'cc-users'))}
                  >
                    add internal users <FiChevronDown size={12} aria-hidden />
                  </button>
                  {openDropdown === 'cc-users' && (
                    <div className="notification-dropdown-panel">
                      {DUMMY_INTERNAL_USERS.map((u) => (
                        <button type="button" key={u} onClick={() => { appendToken(setCc, cc, u); setOpenDropdown(null); }}>{u}</button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="notification-dropdown-wrap">
                  <button
                    type="button"
                    className="notification-dropdown-trigger"
                    onClick={() => setOpenDropdown((v) => (v === 'cc-fields' ? null : 'cc-fields'))}
                  >
                    add custom fields <FiChevronDown size={12} aria-hidden />
                  </button>
                  {openDropdown === 'cc-fields' && (
                    <div className="notification-dropdown-panel">
                      {DUMMY_CUSTOM_FIELDS.slice(0, 8).map((f) => (
                        <button type="button" key={f.custom_field_id} onClick={() => { appendToken(setCc, cc, f.field_label); setOpenDropdown(null); }}>{f.field_label}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <input type="text" className="business-rule-form-input" value={cc} onChange={(e) => setCc(e.target.value)} />
          </div>

          <div className="notification-field">
            <div className="notification-field-head">
              <label className="business-rule-form-label">Subject:</label>
              <div className="notification-field-actions">
                <div className="notification-dropdown-wrap">
                  <button
                    type="button"
                    className="notification-dropdown-trigger"
                    onClick={() => setOpenDropdown((v) => (v === 'subject-fields' ? null : 'subject-fields'))}
                  >
                    add card fields <FiChevronDown size={12} aria-hidden />
                  </button>
                  {openDropdown === 'subject-fields' && (
                    <div className="notification-dropdown-panel">
                      {DUMMY_NOTIFICATION_FIELDS.map((f) => (
                        <button type="button" key={f} onClick={() => handleAddSubjectField(f)}>{f}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="notification-subject-box">
              {subjectParts.map((part, idx) => (
                part.type === 'pill' ? (
                  <span key={idx} className="notification-pill">{part.value}</span>
                ) : (
                  <span key={idx} className="notification-subject-text">{part.value}</span>
                )
              ))}
            </div>
          </div>

          <div className="notification-field">
            <div className="notification-field-head">
              <label className="business-rule-form-label">Body:</label>
              <div className="notification-field-actions">
                <div className="notification-dropdown-wrap">
                  <button
                    type="button"
                    className="notification-dropdown-trigger"
                    onClick={() => setOpenDropdown((v) => (v === 'body-fields' ? null : 'body-fields'))}
                  >
                    add card fields <FiChevronDown size={12} aria-hidden />
                  </button>
                  {openDropdown === 'body-fields' && (
                    <div className="notification-dropdown-panel">
                      {DUMMY_NOTIFICATION_BODY_FIELDS.map((f) => (
                        <button type="button" key={f} onClick={() => handleAddBodyField(f)}>{f}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="notification-quill-wrap">
              <ReactQuill ref={quillRef} theme="snow" modules={quillModules} value={bodyContent} onChange={setBodyContent} />
            </div>
          </div>
        </div>

        <footer className="card-property-match-modal-footer">
          <button type="button" className="br-property-add-btn" onClick={handleSave}>
            Save
          </button>
        </footer>
      </div>
    </Modal>
  );
}

function SelectFieldModal({ show, onClose, onSelect, fields }) {
  const [filterText, setFilterText] = useState('');
  const [expanded, setExpanded] = useState(true);
  const [selectedField, setSelectedField] = useState(null);

  useEffect(() => {
    if (!show) return;
    setFilterText('');
    setExpanded(true);
    setSelectedField(null);
  }, [show]);

  const filterQuery = filterText.trim().toLowerCase();
  const filteredFields = filterQuery
    ? fields.filter((f) => f.toLowerCase().includes(filterQuery))
    : fields;

  const handleApply = () => {
    if (!selectedField) return;
    onSelect(selectedField);
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
                      selected={selectedField === field}
                      onClick={() => setSelectedField(field)}
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
            disabled={!selectedField}
            onClick={handleApply}
          >
            Apply
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

function WebInvokeSettingsModal({ show, onClose, onSave, initialSettings }) {
  const [serviceName, setServiceName] = useState('');
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState(DUMMY_INVOKE_METHOD_OPTIONS[1]);
  const [authentication, setAuthentication] = useState(DUMMY_INVOKE_AUTH_OPTIONS[0]);
  const [sendParamsInBody, setSendParamsInBody] = useState(false);
  const [expandedHeaders, setExpandedHeaders] = useState(true);
  const [expandedParams, setExpandedParams] = useState(true);
  const [headers, setHeaders] = useState([]);
  const [params, setParams] = useState([]);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [showSelectFieldModal, setShowSelectFieldModal] = useState(false);

  useEffect(() => {
    if (!show) return;
    setServiceName(initialSettings?.serviceName ?? '');
    setUrl(initialSettings?.url ?? '');
    setMethod(initialSettings?.method ?? DUMMY_INVOKE_METHOD_OPTIONS[1]);
    setAuthentication(initialSettings?.authentication ?? DUMMY_INVOKE_AUTH_OPTIONS[0]);
    setSendParamsInBody(initialSettings?.sendParamsInBody ?? false);
    setHeaders(initialSettings?.headers ?? []);
    setParams(initialSettings?.params ?? []);
    setExpandedHeaders(true);
    setExpandedParams(true);
    setOpenDropdown(null);
    setShowSelectFieldModal(false);
  }, [show, initialSettings]);

  const makeRowId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const handleAddUrlField = (field) => {
    setUrl((prev) => `${prev}{${field}}`);
  };

  const handleAddHeader = () => {
    setHeaders((prev) => [...prev, { id: makeRowId(), key: '', value: '' }]);
  };
  const handleRemoveHeader = (id) => {
    setHeaders((prev) => prev.filter((h) => h.id !== id));
  };
  const handleHeaderChange = (id, field, value) => {
    setHeaders((prev) => prev.map((h) => (h.id === id ? { ...h, [field]: value } : h)));
  };

  const handleAddParam = () => {
    setParams((prev) => [...prev, { id: makeRowId(), key: '', value: '' }]);
  };
  const handleRemoveParam = (id) => {
    setParams((prev) => prev.filter((p) => p.id !== id));
  };
  const handleParamChange = (id, field, value) => {
    setParams((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };
  const handlePickParamValueField = (id, field) => {
    setParams((prev) => prev.map((p) => (p.id === id ? { ...p, value: field } : p)));
    setOpenDropdown(null);
  };

  const handleSave = () => {
    onSave({ serviceName, url, method, authentication, sendParamsInBody, headers, params });
    onClose();
  };

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
              onChange={(e) => setServiceName(e.target.value)}
            />
          </div>

          <div className="notification-field">
            <div className="notification-field-head">
              <label className="business-rule-form-label br-invoke-field-label">Url</label>
              <div className="notification-field-actions">
                <button
                  type="button"
                  className="notification-dropdown-trigger"
                  onClick={() => setShowSelectFieldModal(true)}
                >
                  add card fields <FiChevronDown size={12} aria-hidden />
                </button>
              </div>
            </div>
            <input
              type="text"
              className="business-rule-form-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <div className="br-invoke-two-col">
            <div className="notification-field">
              <label className="business-rule-form-label br-invoke-field-label">Method</label>
              <div className="business-rule-form-select-wrap">
                <select className="business-rule-form-select" value={method} onChange={(e) => setMethod(e.target.value)}>
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
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                <FiChevronDown className="business-rule-form-select-icon" aria-hidden />
              </div>
            </div>
          </div>

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
                {headers.length > 0 && (
                  <div className="br-invoke-kv-columns">
                    <span>Header</span>
                    <span>Value</span>
                  </div>
                )}
                <div className="br-invoke-kv-list">
                  {headers.map((h) => (
                    <div key={h.id} className="br-invoke-kv-row">
                      <input
                        type="text"
                        className="business-rule-form-input"
                        value={h.key}
                        onChange={(e) => handleHeaderChange(h.id, 'key', e.target.value)}
                      />
                      <input
                        type="text"
                        className="business-rule-form-input"
                        value={h.value}
                        onChange={(e) => handleHeaderChange(h.id, 'value', e.target.value)}
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
                <button type="button" className="business-rule-form-add-link" onClick={handleAddHeader}>
                  <FiPlus size={14} aria-hidden />
                  Add header
                </button>
              </>
            )}
          </div>

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
                <label className="business-rule-form-toggle br-invoke-body-toggle">
                  <input
                    type="checkbox"
                    checked={sendParamsInBody}
                    onChange={(e) => setSendParamsInBody(e.target.checked)}
                  />
                  <span className="business-rule-form-toggle-track" aria-hidden />
                  <span className="business-rule-form-toggle-label">Send the parameters in the body of the web service call</span>
                </label>

                {params.length > 0 && (
                  <div className="br-invoke-kv-columns">
                    <span>Key</span>
                    <span>Value</span>
                  </div>
                )}
                <div className="br-invoke-kv-list">
                  {params.map((p) => {
                    const isPillValue = DUMMY_INVOKE_PAYLOAD_FIELDS.includes(p.value);
                    return (
                      <div key={p.id} className="br-invoke-kv-row">
                        <input
                          type="text"
                          className="business-rule-form-input"
                          value={p.key}
                          onChange={(e) => handleParamChange(p.id, 'key', e.target.value)}
                        />
                        <div className="br-invoke-value-box">
                          {isPillValue ? (
                            <span className="notification-pill">{p.value}</span>
                          ) : (
                            <input
                              type="text"
                              className="br-invoke-value-input"
                              value={p.value}
                              onChange={(e) => handleParamChange(p.id, 'value', e.target.value)}
                            />
                          )}
                          <div className="notification-dropdown-wrap">
                            <button
                              type="button"
                              className="br-invoke-value-add-btn"
                              onClick={() => setOpenDropdown((v) => (v === `param-${p.id}` ? null : `param-${p.id}`))}
                              aria-label="Insert payload field"
                            >
                              <FiPlus size={14} aria-hidden />
                            </button>
                            {openDropdown === `param-${p.id}` && (
                              <div className="notification-dropdown-panel">
                                {DUMMY_INVOKE_PAYLOAD_FIELDS.map((f) => (
                                  <button type="button" key={f} onClick={() => handlePickParamValueField(p.id, f)}>{f}</button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="br-invoke-row-delete"
                          onClick={() => handleRemoveParam(p.id)}
                          aria-label="Remove param"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button type="button" className="business-rule-form-add-link" onClick={handleAddParam}>
                  <FiPlus size={14} aria-hidden />
                  Add param
                </button>
              </>
            )}
          </div>
        </div>

        <footer className="card-property-match-modal-footer br-invoke-modal-footer">
          <button type="button" className="br-invoke-test-btn">
            Test Settings
          </button>
          <button type="button" className="br-property-add-btn" onClick={handleSave}>
            Save Service
          </button>
        </footer>
      </div>
    </Modal>

    <SelectFieldModal
      show={showSelectFieldModal}
      onClose={() => setShowSelectFieldModal(false)}
      onSelect={handleAddUrlField}
      fields={DUMMY_URL_FIELD_OPTIONS}
    />
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
    sendParamsInBody: PropTypes.bool,
    headers: PropTypes.array,
    params: PropTypes.array,
  }),
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

function ShareWithModal({ show, onClose, permissions, onTogglePermission }) {
  const [filterText, setFilterText] = useState('');
  const { users, usersLoading, getUsers } = useCommonReducer((s) => s);

  useEffect(() => {
    if (!show) return;
    setFilterText('');
    if (users.length === 0 && !usersLoading) getUsers({ params: { limit: 200 } });
  }, [show]);

  const filterQuery = filterText.trim().toLowerCase();
  const filteredUsers = filterQuery
    ? users.filter((user) =>
        (user.name ?? '').toLowerCase().includes(filterQuery) || (user.username ?? '').toLowerCase().includes(filterQuery)
      )
    : users;

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
          <h2 className="card-property-match-modal-title">Shared with</h2>
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
          <div className="share-with-filter-row">
            <span className="share-with-filter-icon" aria-hidden>
              <FiFilter size={14} />
            </span>
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
                const perm = permissions[user.user_id] ?? { viewer: false, editor: false };
                return (
                  <div key={user.user_id} className="share-with-row">
                    <span className="share-with-name">{user.name}</span>
                    <span className="share-with-username">
                      <span className="share-with-avatar" aria-hidden>{getInitials(user.name)}</span>
                      {user.username}
                    </span>
                    <label className="business-rule-form-toggle share-with-toggle">
                      <input
                        type="checkbox"
                        checked={perm.viewer}
                        onChange={() => onTogglePermission(user.user_id, 'viewer')}
                      />
                      <span className="business-rule-form-toggle-track" aria-hidden />
                    </label>
                    <label className="business-rule-form-toggle share-with-toggle">
                      <input
                        type="checkbox"
                        checked={perm.editor}
                        onChange={() => onTogglePermission(user.user_id, 'editor')}
                      />
                      <span className="business-rule-form-toggle-track" aria-hidden />
                    </label>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

ShareWithModal.propTypes = {
  show: PropTypes.bool,
  onClose: PropTypes.func,
  permissions: PropTypes.object,
  onTogglePermission: PropTypes.func,
};

function BusinessRuleFormModal({ show, rule, boardName, onClose, onSave }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [owner, setOwner] = useState(DEFAULT_OWNER.name);
  const [isOwnerPickerOpen, setIsOwnerPickerOpen] = useState(false);
  const [ownerFilterText, setOwnerFilterText] = useState('');
  const ownerPickerTriggerRef = useRef(null);
  const ownerPickerPanelRef = useRef(null);
  const [sharePermissions, setSharePermissions] = useState({});
  const [showShareModal, setShowShareModal] = useState(false);
  const [disallowTriggerChain, setDisallowTriggerChain] = useState(false);
  const [conditions, setConditions] = useState([]);
  const [showPropertyPicker, setShowPropertyPicker] = useState(false);
  const [createActions, setCreateActions] = useState([]);
  const [showCreateActionPicker, setShowCreateActionPicker] = useState(false);
  const [linkActions, setLinkActions] = useState([]);
  const [showLinkActionPicker, setShowLinkActionPicker] = useState(false);
  const [moveActions, setMoveActions] = useState([]);
  const [showMoveDestinationPicker, setShowMoveDestinationPicker] = useState(false);
  const [activeMoveActionId, setActiveMoveActionId] = useState(null);
  const [updateActions, setUpdateActions] = useState([]);
  const [showUpdateActionPicker, setShowUpdateActionPicker] = useState(false);
  const [notifyActions, setNotifyActions] = useState([]);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [activeNotifyActionId, setActiveNotifyActionId] = useState(null);
  const [invokeActions, setInvokeActions] = useState([]);
  const [showWebInvokeSettings, setShowWebInvokeSettings] = useState(false);
  const [activeInvokeActionId, setActiveInvokeActionId] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [boardConditionRows, setBoardConditionRows] = useState([{ id: 'board-0', boardId: '' }]);
  const [openBoardConditionRowId, setOpenBoardConditionRowId] = useState(null);
  const [boardConditionFilterText, setBoardConditionFilterText] = useState('');
  const boardConditionTriggerRef = useRef(null);
  const boardConditionPanelRef = useRef(null);

  const { getTriggerConfig } = useBusinessRuleReducer((s) => s);
  const { users, usersLoading, getUsers } = useCommonReducer((s) => s);
  const { workspaces, listAllWorkspaces } = useWorkSpaceReducer((s) => s);

  useEffect(() => {
    if (!show || !rule) return;
    getTriggerConfig(rule.id);
    if (users.length === 0 && !usersLoading) getUsers({ params: { limit: 200 } });
    if (workspaces.length === 0) listAllWorkspaces();
    setBoardConditionRows([{ id: 'board-0', boardId: '' }]);
    setOpenBoardConditionRowId(null);
    setBoardConditionFilterText('');
    setName(rule.name ?? '');
    setDescription(rule.description ?? '');
    setTags('');
    setOwner(DEFAULT_OWNER.name);
    setIsOwnerPickerOpen(false);
    setOwnerFilterText('');
    setSharePermissions({});
    setShowShareModal(false);
    setDisallowTriggerChain(false);
    setConditions([]);
    setShowPropertyPicker(false);
    setCreateActions([]);
    setShowCreateActionPicker(false);
    setLinkActions([]);
    setShowLinkActionPicker(false);
    setMoveActions([]);
    setShowMoveDestinationPicker(false);
    setActiveMoveActionId(null);
    setUpdateActions([]);
    setShowUpdateActionPicker(false);
    setNotifyActions([]);
    setShowNotificationSettings(false);
    setActiveNotifyActionId(null);
    setInvokeActions([]);
    setShowWebInvokeSettings(false);
    setActiveInvokeActionId(null);
    setShowCancelConfirm(false);
  }, [show, rule]);

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
    if (openBoardConditionRowId == null) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (boardConditionPanelRef.current?.contains(t)) return;
      if (boardConditionTriggerRef.current?.contains(t)) return;
      setOpenBoardConditionRowId(null);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [openBoardConditionRowId]);

  if (!rule) return null;

  const handleSave = () => {
    onSave?.({
      triggerRuleId: rule.id,
      name: name.trim(),
      description: description.trim(),
      tags: tags.trim(),
      boardIds: boardConditionRows.map((row) => row.boardId || null),
      owner,
      sharePermissions,
      disallowTriggerChain,
      conditions,
      createActions,
      linkActions,
      moveActions,
      updateActions,
      notifyActions,
      invokeActions,
    });
    onClose();
  };

  const ownerUsers = [
    { user_id: null, name: DEFAULT_OWNER.name, username: null, email: null, role: null, port: null, phone: null },
    ...users.map((u) => ({
      user_id: u.user_id, name: u.name, username: u.username, email: u.email, role: u.role, port: u.port, phone: u.phone,
    })),
  ];
  const ownerFilterQuery = ownerFilterText.trim().toLowerCase();
  const filteredOwnerUsers = ownerFilterQuery
    ? ownerUsers.filter((u) => u.name.toLowerCase().includes(ownerFilterQuery))
    : ownerUsers;

  const handlePickOwner = (user) => {
    setOwner(user.name);
    setIsOwnerPickerOpen(false);
    setOwnerFilterText('');
  };

  const handleToggleSharePermission = (userId, type) => {
    setSharePermissions((prev) => {
      const current = prev[userId] ?? { viewer: false, editor: false };
      return { ...prev, [userId]: { ...current, [type]: !current[type] } };
    });
  };

  const sharedUserCount = Object.values(sharePermissions).filter((p) => p.viewer || p.editor).length;
  const shareWithLabel = sharedUserCount === 0 ? 'Just me' : `${sharedUserCount} ${sharedUserCount === 1 ? 'person' : 'people'}`;

  const handleOpenPropertyPicker = () => {
    setShowPropertyPicker(true);
  };

  const handleSelectProperty = (field, category) => {
    setConditions((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        fieldLabel: getFieldLabel(field),
        fieldKey: field.field_key ?? field.unit_key ?? String(field.regular_field_id ?? field.time_unit_id ?? field.custom_field_id ?? ''),
        category: category.category_key,
        value: '',
      },
    ]);
  };

  const handleRemoveCondition = (id) => {
    setConditions((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSelectCreateAction = (option) => {
    setCreateActions((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, key: option.key, label: option.label },
    ]);
  };

  const handleRemoveCreateAction = (id) => {
    setCreateActions((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSelectLinkAction = (option) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setLinkActions((prev) => [...prev, { id, key: option.key, label: option.label }]);
  };

  const handleRemoveLinkAction = (id) => {
    setLinkActions((prev) => prev.filter((a) => a.id !== id));
  };

  const handleAddMoveAction = () => {
    const option = MOVE_ACTION_OPTIONS[0];
    setMoveActions((prev) => [
      ...prev,
      {
        id: Date.now(), key: option.key, label: option.label,
        boardId: '', boardName: '', swimlaneId: '', swimlaneName: '', stageId: '', stageName: '',
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

  const handleSelectUpdateAction = (item, meta) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (meta.category_key === 'custom') {
      const rawLabel = getFieldLabel(item);
      setUpdateActions((prev) => [
        ...prev,
        { id, category: 'custom', key: `custom-${item.custom_field_id}`, label: `Set ${rawLabel}`, rawLabel, field: rawLabel },
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

  const handleAddNotifyAction = () => {
    const option = NOTIFY_ACTION_OPTIONS[0];
    setNotifyActions((prev) => [...prev, { id: Date.now(), key: option.key, label: option.label }]);
  };

  const handleRemoveNotifyAction = (id) => {
    setNotifyActions((prev) => prev.filter((a) => a.id !== id));
  };

  const handleOpenNotificationSettings = (id) => {
    setActiveNotifyActionId(id);
    setShowNotificationSettings(true);
  };

  const handleSaveNotificationSettings = (settings) => {
    setNotifyActions((prev) => prev.map((a) => (a.id === activeNotifyActionId ? { ...a, ...settings, configured: true } : a)));
  };

  const activeNotifyAction = notifyActions.find((a) => a.id === activeNotifyActionId);

  const handleAddInvokeAction = () => {
    const option = INVOKE_ACTION_OPTIONS[0];
    setInvokeActions((prev) => [...prev, { id: Date.now(), key: option.key, label: option.label }]);
  };

  const handleRemoveInvokeAction = (id) => {
    setInvokeActions((prev) => prev.filter((a) => a.id !== id));
  };

  const handleOpenWebInvokeSettings = (id) => {
    setActiveInvokeActionId(id);
    setShowWebInvokeSettings(true);
  };

  const handleSaveWebInvokeSettings = (settings) => {
    setInvokeActions((prev) => prev.map((a) => (a.id === activeInvokeActionId ? { ...a, ...settings, configured: true } : a)));
  };

  const activeInvokeAction = invokeActions.find((a) => a.id === activeInvokeActionId);

  const displayWorkspaces = workspaces ?? [];
  const conditionBoardFilterQuery = boardConditionFilterText.trim().toLowerCase();
  const filteredBoardConditionGroups = displayWorkspaces
    .map((w) => {
      const wsMatch = w.workspace_name.toLowerCase().includes(conditionBoardFilterQuery);
      const groupBoards = wsMatch
        ? (w.boards ?? [])
        : (w.boards ?? []).filter((b) => b.board_name.toLowerCase().includes(conditionBoardFilterQuery));
      return { workspace_id: w.workspace_id, workspace_name: w.workspace_name, boards: groupBoards };
    })
    .filter((g) => g.boards.length > 0);

  const allConditionBoards = displayWorkspaces.flatMap((w) => w.boards ?? []);

  const getBoardConditionLabel = (boardId) => {
    if (!boardId) return boardName?.trim() || 'Current board';
    return allConditionBoards.find((b) => String(b.board_id) === String(boardId))?.board_name ?? 'Current board';
  };

  const handlePickConditionBoard = (rowId, board) => {
    setBoardConditionRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, boardId: board?.board_id ?? '' } : row))
    );
    setOpenBoardConditionRowId(null);
    setBoardConditionFilterText('');
  };

  const handleAddBoardConditionRow = (rowId) => {
    setBoardConditionRows((prev) => {
      const idx = prev.findIndex((row) => row.id === rowId);
      if (idx === -1) return prev;
      const newRow = { id: `board-${Date.now()}`, boardId: prev[idx].boardId };
      const next = [...prev];
      next.splice(idx + 1, 0, newRow);
      return next;
    });
  };

  const handleRemoveBoardConditionRow = (rowId) => {
    setBoardConditionRows((prev) => prev.filter((row) => row.id !== rowId));
  };

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
              <input
                id="br-form-tags"
                type="text"
                className="business-rule-form-input business-rule-form-control"
                placeholder="Add tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
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
                    {owner === DEFAULT_OWNER.name ? DEFAULT_OWNER.initials : getInitials(owner)}
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
                                {user.name === DEFAULT_OWNER.name ? DEFAULT_OWNER.initials : getInitials(user.name)}
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
                <div className="business-rule-form-select-wrap business-rule-form-control">
                  <button
                    type="button"
                    id="br-form-share"
                    className="business-rule-form-select business-rule-form-share-trigger"
                    onClick={() => setShowShareModal(true)}
                  >
                    {shareWithLabel}
                  </button>
                  <FiChevronDown className="business-rule-form-select-icon" aria-hidden />
                </div>
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
              <div className="business-rule-form-column-card business-rule-form-column-card--when">
                <BusinessRuleIcon iconType={rule.icon} className="business-rule-form-when-icon" />
                <span className="business-rule-form-trigger-name">{rule.name}</span>
              </div>
            </div>

            <div className="business-rule-form-column">
              <h3 className="business-rule-form-column-title">AND</h3>
              <div className="business-rule-form-column-card">
                <p className="business-rule-form-filter-hint">the created card matches this filter</p>

                {boardConditionRows.length > 0 && (
                  <div className="business-rule-form-filter-row business-rule-form-filter-row--multi">
                    <span className="business-rule-form-condition-label">Board is</span>
                    {boardConditionRows.map((row) => {
                      const isOpen = openBoardConditionRowId === row.id;
                      return (
                        <div key={row.id} className="br-board-condition-value-row">
                          <div className="board-minimap-picker-wrap br-board-condition-wrap">
                            <button
                              type="button"
                              ref={isOpen ? boardConditionTriggerRef : undefined}
                              className="business-rule-form-condition-value"
                              onClick={() => {
                                setBoardConditionFilterText('');
                                setOpenBoardConditionRowId((prev) => (prev === row.id ? null : row.id));
                              }}
                              aria-haspopup="listbox"
                              aria-expanded={isOpen}
                            >
                              {getBoardConditionLabel(row.boardId)}
                              <FiChevronDown size={16} aria-hidden />
                            </button>

                            {isOpen && (
                              <div className="board-minimap-picker-panel br-board-condition-panel" ref={boardConditionPanelRef}>
                                <div className="board-minimap-picker-search">
                                  <FiFilter size={20} className="board-minimap-picker-search-icon" aria-hidden />
                                  <input
                                    type="text"
                                    placeholder="Filter"
                                    value={boardConditionFilterText}
                                    onChange={(e) => setBoardConditionFilterText(e.target.value)}
                                    autoFocus
                                  />
                                </div>

                                <div className="board-minimap-picker-scroll">
                                  {'current board'.includes(conditionBoardFilterQuery) && (
                                    <button
                                      type="button"
                                      className={`board-minimap-picker-tile br-board-condition-current${!row.boardId ? ' board-minimap-picker-tile--selected' : ''}`}
                                      onClick={() => handlePickConditionBoard(row.id, null)}
                                    >
                                      Current board
                                    </button>
                                  )}

                                  {filteredBoardConditionGroups.length === 0 ? (
                                    conditionBoardFilterQuery && (
                                      <div className="br-property-picker-empty">No matches</div>
                                    )
                                  ) : (
                                    filteredBoardConditionGroups.map((ws) => (
                                      <div key={ws.workspace_id} className="board-minimap-picker-group">
                                        <div className="board-minimap-picker-group-head">
                                          <FiUsers size={20} aria-hidden />
                                          <span>{ws.workspace_name}</span>
                                        </div>
                                        <div className="board-minimap-picker-grid">
                                          {ws.boards.map((board) => (
                                            <button
                                              key={board.board_id}
                                              type="button"
                                              className={`board-minimap-picker-tile${String(board.board_id) === String(row.boardId) ? ' board-minimap-picker-tile--selected' : ''}`}
                                              onClick={() => handlePickConditionBoard(row.id, board)}
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

                          <div className="business-rule-form-filter-row-actions">
                            <button
                              type="button"
                              className="business-rule-form-or-btn"
                              onClick={() => handleAddBoardConditionRow(row.id)}
                            >
                              OR
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

                {conditions.map((cond) => (
                  <div key={cond.id} className="business-rule-form-filter-row">
                    <div className="business-rule-form-filter-row-main">
                      <span className="business-rule-form-condition-label">{cond.fieldLabel}</span>
                      <input
                        type="text"
                        className="business-rule-form-condition-input"
                        placeholder="Enter value"
                        value={cond.value}
                        onChange={(e) => {
                          const val = e.target.value;
                          setConditions((prev) =>
                            prev.map((c) => c.id === cond.id ? { ...c, value: val } : c)
                          );
                        }}
                      />
                    </div>

                    <div className="business-rule-form-filter-row-actions">
                      <button type="button" className="business-rule-form-or-btn">OR</button>
                      <button
                        type="button"
                        className="business-rule-form-filter-row-delete"
                        onClick={() => handleRemoveCondition(cond.id)}
                        aria-label="Remove condition"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}

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
              </div>
            </div>

            <div className="business-rule-form-column business-rule-form-column--then">
              <h3 className="business-rule-form-column-title">THEN</h3>
              <div className="business-rule-form-then-stack">
                {THEN_ACTION_SECTIONS.map((section) => (
                  <div key={section.id} className="business-rule-form-action-section">
                    <h4 className="business-rule-form-action-title">{section.title}</h4>

                    {section.id === 'create' && createActions.map((action) => (
                      <div key={action.id} className="business-rule-form-action-chip">
                        <span className="business-rule-form-action-chip-label">{action.label}</span>
                        <button
                          type="button"
                          className="business-rule-form-condition-remove"
                          onClick={() => handleRemoveCreateAction(action.id)}
                          aria-label="Remove action"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    ))}

                    {section.id === 'link' && linkActions.map((action) => (
                      <div key={action.id} className="business-rule-form-action-chip">
                        <span className="business-rule-form-action-chip-label">{action.label}</span>
                        <button
                          type="button"
                          className="business-rule-form-condition-remove"
                          onClick={() => handleRemoveLinkAction(action.id)}
                          aria-label="Remove action"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    ))}

                    {section.id === 'update' && updateActions.map((action) => (
                      <div key={action.id} className="business-rule-form-action-chip">
                        <span className="business-rule-form-action-chip-label">
                          {action.field ? (
                            <>{action.field}: <span className="notification-pill">{action.field}</span></>
                          ) : action.label}
                        </span>
                        <button
                          type="button"
                          className="business-rule-form-condition-remove"
                          onClick={() => handleRemoveUpdateAction(action.id)}
                          aria-label="Remove action"
                        >
                          <FiTrash2 size={14} />
                        </button>
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
                          {action.stageName ? `${action.boardName} → ${action.swimlaneName} / ${action.stageName}` : 'Choose where to move'}
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
                          {action.configured ? 'Configured' : 'Not Set'}
                        </button>
                      </div>
                    ))}

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
                          {action.configured ? 'Configured' : 'Not Set'}
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      className="business-rule-form-add-action"
                      onClick={() => {
                        if (section.id === 'create') setShowCreateActionPicker(true);
                        if (section.id === 'link') setShowLinkActionPicker(true);
                        if (section.id === 'move') handleAddMoveAction();
                        if (section.id === 'update') setShowUpdateActionPicker(true);
                        if (section.id === 'notify') handleAddNotifyAction();
                        if (section.id === 'invoke') handleAddInvokeAction();
                      }}
                    >
                      <FiPlus size={14} aria-hidden />
                      Add new action
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <footer className="business-rule-form-modal-footer">
          <p className="business-rule-form-footer-note">
            <strong>Note:</strong> Due to their asynchronous nature, the business rules may sometimes run with a short delay. In rare cases it may take up to 30 minutes.
          </p>
          <button type="button" className="business-rule-form-save-btn" onClick={handleSave}>
            Save
          </button>
        </footer>
      </div>
    </Modal>

    <CardPropertyMatchModal
      show={showPropertyPicker}
      onClose={() => setShowPropertyPicker(false)}
      onSelect={handleSelectProperty}
      existingFieldLabels={['board', ...conditions.map((c) => c.fieldLabel.trim().toLowerCase())]}
      triggerTypeId={rule.id}
    />

    <CreateActionModal
      show={showCreateActionPicker}
      onClose={() => setShowCreateActionPicker(false)}
      onSelect={handleSelectCreateAction}
    />

    <LinkActionModal
      show={showLinkActionPicker}
      onClose={() => setShowLinkActionPicker(false)}
      onSelect={handleSelectLinkAction}
    />

    <BoardMinimapModal
      show={showMoveDestinationPicker}
      onClose={() => setShowMoveDestinationPicker(false)}
      onSave={handleSaveMoveDestination}
      initialBoardId={activeMoveAction?.boardId}
    />

    <RefineUpdateCriteriaModal
      show={showUpdateActionPicker}
      onClose={() => setShowUpdateActionPicker(false)}
      onSelect={handleSelectUpdateAction}
      existingFieldLabels={updateActions
        .filter((a) => a.category === 'custom')
        .map((a) => a.rawLabel.trim().toLowerCase())}
      triggerTypeId={rule.id}
    />

    <NotificationSettingsModal
      show={showNotificationSettings}
      onClose={() => setShowNotificationSettings(false)}
      onSave={handleSaveNotificationSettings}
      initialSettings={activeNotifyAction}
    />

    <WebInvokeSettingsModal
      show={showWebInvokeSettings}
      onClose={() => setShowWebInvokeSettings(false)}
      onSave={handleSaveWebInvokeSettings}
      initialSettings={activeInvokeAction}
    />

    <ShareWithModal
      show={showShareModal}
      onClose={() => setShowShareModal(false)}
      permissions={sharePermissions}
      onTogglePermission={handleToggleSharePermission}
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
};

CreateActionModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
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
  onClose: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
  triggerTypeId: PropTypes.number,
};

NotificationSettingsModal.propTypes = {
  show: PropTypes.bool.isRequired,
  initialSettings: PropTypes.shape({
    to: PropTypes.string,
    cc: PropTypes.string,
    subjectParts: PropTypes.array,
    bodyContent: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  }),
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

export default BusinessRuleFormModal;
