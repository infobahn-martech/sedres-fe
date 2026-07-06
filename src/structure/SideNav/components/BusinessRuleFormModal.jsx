import { useEffect, useMemo, useRef, useState } from 'react';
import { FiX, FiPlus, FiChevronDown, FiChevronUp, FiTrash2, FiFilter, FiUsers } from 'react-icons/fi';
import { Modal } from 'react-bootstrap';
import PropTypes from 'prop-types';
import ReactQuill, { Quill } from 'react-quill';
import QuillTableBetter from 'quill-table-better';
import 'react-quill/dist/quill.snow.css';
import 'quill-table-better/dist/quill-table-better.css';
import BusinessRuleIcon from './BusinessRuleIcon';
import {
  THEN_ACTION_SECTIONS, CREATE_ACTION_OPTIONS, LINK_ACTION_OPTIONS, MOVE_ACTION_OPTIONS, NOTIFY_ACTION_OPTIONS, UPDATE_ACTION_OPTIONS,
  DUMMY_REGULAR_FIELDS, DUMMY_TIME_UNITS, DUMMY_CUSTOM_FIELDS, DUMMY_WORKSPACE_BOARDS, DUMMY_BOARD_TITLE,
  DUMMY_BOARD_AREA_GROUPS, DUMMY_BOARD_HEADER_CELLS, DUMMY_BOARD_LEAF_COLUMNS, DUMMY_BOARD_SWIMLANES,
  DUMMY_NOTIFICATION_FROM_EMAIL, DUMMY_NOTIFICATION_FIELDS, DUMMY_INTERNAL_USERS, DUMMY_SHARE_USERS,
  DUMMY_NOTIFICATION_SUBJECT_PARTS, DUMMY_NOTIFICATION_BODY_DELTA_OPS,
} from './businessRulesData';
import useBusinessRuleReducer from '../../../store/BusinessRuleReducer';
import useWorkSpaceReducer from '../../../store/WorkSpaceReducer';
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
Quill.register(NotificationPillBlot);
const QuillDelta = Quill.import('delta');

const DEFAULT_OWNER = { name: 'You', initials: 'YO' };
const OWNER_OPTIONS = [DEFAULT_OWNER.name, ...DUMMY_INTERNAL_USERS];

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
  const [selected, setSelected] = useState(null);
  const [selectedRegularFields, setSelectedRegularFields] = useState([]);
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
  // Demo dataset shown as-is for now regardless of the live backend's workspaces,
  // per client-facing walkthrough requirements.
  const boards = DUMMY_WORKSPACE_BOARDS.flatMap((w) => w.boards ?? []);

  // Dev-only fallback so the modal can be visually tested without a live backend.
  const displayRegularFields = regularFields.length > 0 ? regularFields : (import.meta.env.DEV ? DUMMY_REGULAR_FIELDS : []);
  const displayTimeUnits = timeUnits.length > 0 ? timeUnits : (import.meta.env.DEV ? DUMMY_TIME_UNITS : []);
  const displayCustomFields = customFields.length > 0 ? customFields : (import.meta.env.DEV ? DUMMY_CUSTOM_FIELDS : []);

  const isFieldUsed = (field) =>
    (existingFieldLabels ?? []).includes(getFieldLabel(field).trim().toLowerCase());

  const filteredCustomFields = displayCustomFields;

  useEffect(() => {
    if (!show) return;
    setSelected(null);
    setSelectedRegularFields([]);
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

  const handlePick = (type, field) => {
    const key = `${type}-${field.regular_field_id ?? field.time_unit_id ?? field.custom_field_id ?? getFieldLabel(field)}`;
    setSelected({ key, type, field });
  };

  const handleToggleRegularField = (field, key) => {
    setSelectedRegularFields((prev) =>
      prev.some((item) => item.key === key)
        ? prev.filter((item) => item.key !== key)
        : [...prev, { key, field }]
    );
  };

  const handleAdd = () => {
    if (selectedRegularFields.length === 0 && !selected) return;
    selectedRegularFields.forEach(({ field }) => onSelect(field, { category_key: 'regular' }));
    if (selected) onSelect(selected.field, { category_key: selected.type });
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
                        selected={selected?.key === key}
                        onClick={() => handlePick('time_unit', field)}
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
                          selected={selected?.key === key}
                          dotColor={getPropertyDotColor(idx)}
                          disabled={isFieldUsed(field)}
                          onClick={() => handlePick('custom', field)}
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
            disabled={selectedRegularFields.length === 0 && !selected}
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
  const [selectedKey, setSelectedKey] = useState(null);
  const [expandedActions, setExpandedActions] = useState(true);
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    if (!show) return;
    setSelectedKey(null);
    setFilterText('');
  }, [show]);

  const filterQuery = filterText.trim().toLowerCase();
  const filteredOptions = filterQuery
    ? LINK_ACTION_OPTIONS.filter((opt) => opt.label.toLowerCase().includes(filterQuery))
    : LINK_ACTION_OPTIONS;

  const handleAdd = () => {
    const option = LINK_ACTION_OPTIONS.find((opt) => opt.key === selectedKey);
    if (!option) return;
    onSelect(option);
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
                      selected={selectedKey === option.key}
                      onClick={() => setSelectedKey(option.key)}
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
            disabled={!selectedKey}
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
  // Demo dataset shown as-is for now regardless of the live backend's workspaces,
  // per client-facing walkthrough requirements.
  const displayWorkspaces = useMemo(() => DUMMY_WORKSPACE_BOARDS, []);
  const boards = (displayWorkspaces ?? []).flatMap((w) =>
    (w.boards ?? []).map((b) => ({ ...b, workspace_name: w.workspace_name }))
  );

  const boardFilterQuery = boardFilterText.trim().toLowerCase();
  const filteredWorkspaceGroups = (displayWorkspaces ?? [])
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
  // Demo dataset shown as-is for now regardless of the live backend's workspaces,
  // per client-facing walkthrough requirements.
  const boards = DUMMY_WORKSPACE_BOARDS.flatMap((w) => w.boards ?? []);

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

  const handleToggleAction = (option, key) => {
    setSelectedActions((prev) =>
      prev.some((item) => item.key === key)
        ? prev.filter((item) => item.key !== key)
        : [...prev, { key, item: option }]
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
    if (selectedActions.length === 0 && selectedCustomFields.length === 0) return;
    selectedActions.forEach(({ item }) => onSelect(item, { category_key: 'action' }));
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
                      selected={selectedActions.some((item) => item.key === option.key)}
                      onClick={() => handleToggleAction(option, option.key)}
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
            <label className="business-rule-form-label">Body:</label>
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

function ShareWithModal({ show, onClose, permissions, onTogglePermission }) {
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    if (!show) return;
    setFilterText('');
  }, [show]);

  const filterQuery = filterText.trim().toLowerCase();
  const filteredUsers = filterQuery
    ? DUMMY_SHARE_USERS.filter((user) =>
        user.name.toLowerCase().includes(filterQuery) || user.username.toLowerCase().includes(filterQuery)
      )
    : DUMMY_SHARE_USERS;

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
            {filteredUsers.length === 0 ? (
              <div className="br-property-picker-empty">No users found</div>
            ) : (
              filteredUsers.map((user) => {
                const perm = permissions[user.id] ?? { viewer: false, editor: false };
                return (
                  <div key={user.id} className="share-with-row">
                    <span className="share-with-name">{user.name}</span>
                    <span className="share-with-username">
                      <span className="share-with-avatar" aria-hidden>{getInitials(user.name)}</span>
                      {user.username}
                    </span>
                    <label className="business-rule-form-toggle share-with-toggle">
                      <input
                        type="checkbox"
                        checked={perm.viewer}
                        onChange={() => onTogglePermission(user.id, 'viewer')}
                      />
                      <span className="business-rule-form-toggle-track" aria-hidden />
                    </label>
                    <label className="business-rule-form-toggle share-with-toggle">
                      <input
                        type="checkbox"
                        checked={perm.editor}
                        onChange={() => onTogglePermission(user.id, 'editor')}
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
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const { getTriggerConfig } = useBusinessRuleReducer((s) => s);

  useEffect(() => {
    if (!show || !rule) return;
    getTriggerConfig(rule.id);
    setName(rule.name ?? '');
    setDescription(rule.description ?? '');
    setTags('');
    setOwner(DEFAULT_OWNER.name);
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
    setShowCancelConfirm(false);
  }, [show, rule]);

  if (!rule) return null;

  const handleSave = () => {
    onSave?.({
      triggerRuleId: rule.id,
      name: name.trim(),
      description: description.trim(),
      tags: tags.trim(),
      owner,
      sharePermissions,
      disallowTriggerChain,
      conditions,
      createActions,
      linkActions,
      moveActions,
      updateActions,
      notifyActions,
    });
    onClose();
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
    setLinkActions((prev) => [...prev, { id: Date.now(), key: option.key, label: option.label }]);
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

  const boardLabel = boardName?.trim() || 'Current board';

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
              <label htmlFor="br-form-name" className="business-rule-form-label">Name</label>
              <input
                id="br-form-name"
                type="text"
                className="business-rule-form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="business-rule-form-field">
              <label htmlFor="br-form-description" className="business-rule-form-label">Description</label>
              <textarea
                id="br-form-description"
                className="business-rule-form-textarea"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="business-rule-form-secondary-grid">
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

              <div className="business-rule-form-field">
                <label htmlFor="br-form-owner" className="business-rule-form-label">Owner</label>
                <div className="business-rule-form-select-wrap business-rule-form-select-wrap--owner business-rule-form-control">
                  <span className="business-rule-form-owner-avatar" aria-hidden>
                    {owner === DEFAULT_OWNER.name ? DEFAULT_OWNER.initials : getInitials(owner)}
                  </span>
                  <select
                    id="br-form-owner"
                    className="business-rule-form-select"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                  >
                    {OWNER_OPTIONS.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <FiChevronDown className="business-rule-form-select-icon" aria-hidden />
                </div>
              </div>

              <div className="business-rule-form-field">
                <label htmlFor="br-form-share" className="business-rule-form-label">Share with</label>
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

              <div className="business-rule-form-field business-rule-form-field--toggle">
                <span className="business-rule-form-label business-rule-form-label--spacer" aria-hidden="true">Tags</span>
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
              </div>
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
                <div className="business-rule-form-condition">
                  <span className="business-rule-form-condition-label">Board is</span>
                  <button type="button" className="business-rule-form-condition-value">
                    {boardLabel}
                    <FiChevronDown size={16} aria-hidden />
                  </button>
                </div>

                {conditions.map((cond) => (
                  <div key={cond.id} className="business-rule-form-condition">
                    <span className="business-rule-form-condition-label">{cond.fieldLabel}</span>
                    <div className="business-rule-form-condition-row">
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
                      <button
                        type="button"
                        className="business-rule-form-condition-remove"
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

                    <button
                      type="button"
                      className="business-rule-form-add-action"
                      onClick={() => {
                        if (section.id === 'create') setShowCreateActionPicker(true);
                        if (section.id === 'link') setShowLinkActionPicker(true);
                        if (section.id === 'move') handleAddMoveAction();
                        if (section.id === 'update') setShowUpdateActionPicker(true);
                        if (section.id === 'notify') handleAddNotifyAction();
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
