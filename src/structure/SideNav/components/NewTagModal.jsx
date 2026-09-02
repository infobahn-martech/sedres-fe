import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiPlus, FiFilter, FiUsers } from 'react-icons/fi';
import { Modal } from 'react-bootstrap';
import PropTypes from 'prop-types';
import SedresColorPicker from '../../../components/SedresColorPicker/SedresColorPicker';
import { normalizeHexColor } from '../../../components/SedresColorPicker/sedresColorPickerConstants';
import '../../../design/scss/new-blocker-modal.scss';

/** Values sent to kanban_management APIs */
export const TAG_AVAILABILITY_OPTIONS = ['On-demand', 'Auto', 'Global'];

export function normalizeTagAvailabilityLevel(value) {
  const raw = String(value ?? '').trim();
  if (TAG_AVAILABILITY_OPTIONS.includes(raw)) return raw;
  const compact = raw.replace(/\s+/g, '').toLowerCase();
  if (compact === 'ondemand' || compact === 'on-demand') return 'On-demand';
  if (compact === 'auto') return 'Auto';
  if (compact === 'global') return 'Global';
  return TAG_AVAILABILITY_OPTIONS[0];
}

const COLOR_PICKER_PORTAL_Z = 10800;
const BOARD_SELECTOR_PORTAL_Z = 10700;
const BOARD_SELECTOR_GAP = 4;
const BOARD_SELECTOR_MIN_HEIGHT = 200;

function computeBoardSelectorPlacement(rect) {
  const spaceBelow = window.innerHeight - rect.bottom - BOARD_SELECTOR_GAP;
  const spaceAbove = rect.top - BOARD_SELECTOR_GAP;
  const openUp = spaceBelow < BOARD_SELECTOR_MIN_HEIGHT && spaceAbove > spaceBelow;
  return {
    left: rect.left,
    width: rect.width,
    top: openUp ? undefined : rect.bottom + BOARD_SELECTOR_GAP,
    bottom: openUp ? window.innerHeight - rect.top + BOARD_SELECTOR_GAP : undefined,
    maxHeight: Math.max(BOARD_SELECTOR_MIN_HEIGHT, openUp ? spaceAbove : spaceBelow),
  };
}

function boardKey(id) {
  return String(id ?? '');
}

function sortSelectedBoards(selected, sourceWorkspaces) {
  const order = new Map();
  let i = 0;
  sourceWorkspaces.forEach((ws) => {
    ws.boards.forEach((b) => {
      order.set(boardKey(b.board_id), i++);
    });
  });
  return [...selected].sort(
    (a, b) =>
      (order.get(boardKey(a.board_id)) ?? 999) -
      (order.get(boardKey(b.board_id)) ?? 999)
  );
}

const NewTagModal = ({
  show,
  onClose,
  onSave,
  editingTag,
  workspaceBoardOptions,
  workspaceBoardsLoading,
}) => {
  const [selectedColor, setSelectedColor] = useState('#ffffff');
  const [label, setLabel] = useState('');
  const [availability, setAvailability] = useState(TAG_AVAILABILITY_OPTIONS[0]);
  const [selectedBoards, setSelectedBoards] = useState([]);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [colorPickerPlacement, setColorPickerPlacement] = useState({ top: 0, left: 0 });
  const [isBoardSelectorOpen, setIsBoardSelectorOpen] = useState(false);
  const [boardSelectorPlacement, setBoardSelectorPlacement] = useState({ top: 0, left: 0, width: 0, maxHeight: 320 });
  const [boardSearch, setBoardSearch] = useState('');
  const [saveSubmitting, setSaveSubmitting] = useState(false);

  const colorTriggerRef = useRef(null);
  const colorPickerPopoverRef = useRef(null);
  const boardSelectorRef = useRef(null);
  const boardsControlsRef = useRef(null);
  const addBoardBtnRef = useRef(null);

  const isEditMode = Boolean(editingTag?.tag_id != null && String(editingTag.tag_id) !== '');

  const resetCreateDefaults = useCallback(() => {
    setSelectedColor('#ffffff');
    setLabel('');
    setAvailability(TAG_AVAILABILITY_OPTIONS[0]);
    setSelectedBoards([]);
    setIsColorPickerOpen(false);
    setIsBoardSelectorOpen(false);
    setBoardSearch('');
    setSaveSubmitting(false);
  }, []);

  const filteredWorkspaceOptions = useMemo(() => {
    const q = boardSearch.trim().toLowerCase();
    if (!q) return workspaceBoardOptions;
    return workspaceBoardOptions
      .map((ws) => {
        const wsMatch = ws.workspace_name.toLowerCase().includes(q);
        const boards = wsMatch
          ? ws.boards
          : ws.boards.filter((b) => b.board_name.toLowerCase().includes(q));
        if (boards.length === 0) return null;
        return { ...ws, boards };
      })
      .filter(Boolean);
  }, [boardSearch, workspaceBoardOptions]);

  const selectedIds = useMemo(
    () => new Set(selectedBoards.map((b) => boardKey(b.board_id))),
    [selectedBoards]
  );

  const isWorkspaceFullySelected = useCallback(
    (ws) =>
      ws.boards.length > 0 &&
      ws.boards.every((b) => selectedIds.has(boardKey(b.board_id))),
    [selectedIds]
  );

  const toggleBoard = useCallback((board) => {
    const key = boardKey(board.board_id);
    setSelectedBoards((prev) => {
      const exists = prev.some((b) => boardKey(b.board_id) === key);
      if (exists) return prev.filter((b) => boardKey(b.board_id) !== key);
      return [
        ...prev,
        {
          board_id: board.board_id,
          board_name: board.board_name,
        },
      ];
    });
  }, []);

  const toggleWorkspaceAll = useCallback(
    (ws) => {
      const allOn = isWorkspaceFullySelected(ws);
      setSelectedBoards((prev) => {
        const ids = new Set(ws.boards.map((b) => boardKey(b.board_id)));
        if (allOn) return prev.filter((b) => !ids.has(boardKey(b.board_id)));
        const map = new Map(prev.map((b) => [boardKey(b.board_id), b]));
        ws.boards.forEach((b) =>
          map.set(boardKey(b.board_id), {
            board_id: b.board_id,
            board_name: b.board_name,
          })
        );
        return sortSelectedBoards(Array.from(map.values()), workspaceBoardOptions);
      });
    },
    [isWorkspaceFullySelected, workspaceBoardOptions]
  );

  const removeBoardChip = useCallback((boardId) => {
    const key = boardKey(boardId);
    setSelectedBoards((prev) =>
      prev.filter((b) => boardKey(b.board_id) !== key)
    );
  }, []);

  useEffect(() => {
    if (!show) {
      resetCreateDefaults();
      return;
    }
    if (isEditMode) {
      setSelectedColor(
        normalizeHexColor(editingTag.color_code ?? '#ffffff')
      );
      setLabel(editingTag.label ?? '');
      setAvailability(
        normalizeTagAvailabilityLevel(editingTag.availability_level)
      );
      const boards = Array.isArray(editingTag.boards)
        ? editingTag.boards.map((b) => ({
            board_id: b.board_id,
            board_name: String(b.board_name ?? ''),
          }))
        : [];
      setSelectedBoards(boards);
      setIsColorPickerOpen(false);
      setIsBoardSelectorOpen(false);
      setBoardSearch('');
      setSaveSubmitting(false);
    } else {
      resetCreateDefaults();
    }
  }, [show, isEditMode, editingTag, resetCreateDefaults]);

  const handleSave = async () => {
    const trimmed = label.trim();
    if (!trimmed || !TAG_AVAILABILITY_OPTIONS.includes(availability)) return;
    const board_ids = selectedBoards.map((b) => b.board_id);
    const color_code = normalizeHexColor(selectedColor);

    setSaveSubmitting(true);
    try {
      if (onSave) {
        await onSave(
          isEditMode
            ? {
                mode: 'edit',
                tag_id: String(editingTag.tag_id),
                label: trimmed,
                availability_level: availability,
                color_code,
                board_ids,
              }
            : {
                mode: 'create',
                label: trimmed,
                availability_level: availability,
                color_code,
                board_ids,
              }
        );
      }
      resetCreateDefaults();
      onClose();
    } catch {
      /* Parent showed toast; keep form open */
    } finally {
      setSaveSubmitting(false);
    }
  };

  const openColorPicker = () => {
    if (colorTriggerRef.current) {
      const r = colorTriggerRef.current.getBoundingClientRect();
      setColorPickerPlacement({ top: r.bottom + 8, left: r.left });
    }
    setIsColorPickerOpen(true);
  };

  const closeColorPicker = useCallback(() => {
    setIsColorPickerOpen(false);
  }, []);

  useEffect(() => {
    if (!isColorPickerOpen) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (colorTriggerRef.current?.contains(t)) return;
      if (colorPickerPopoverRef.current?.contains(t)) return;
      closeColorPicker();
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [isColorPickerOpen, closeColorPicker]);

  const toggleBoardSelector = () => {
    if (isBoardSelectorOpen) {
      setIsBoardSelectorOpen(false);
      return;
    }
    if (boardsControlsRef.current) {
      setBoardSelectorPlacement(
        computeBoardSelectorPlacement(boardsControlsRef.current.getBoundingClientRect())
      );
    }
    setIsBoardSelectorOpen(true);
  };

  useEffect(() => {
    if (!isBoardSelectorOpen) return undefined;
    const onDocMouseDown = (event) => {
      const t = event.target;
      if (boardSelectorRef.current?.contains(t)) return;
      if (addBoardBtnRef.current?.contains(t)) return;
      setIsBoardSelectorOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [isBoardSelectorOpen]);

  const sortedChips = useMemo(
    () => sortSelectedBoards(selectedBoards, workspaceBoardOptions),
    [selectedBoards, workspaceBoardOptions]
  );

  const previewHex = normalizeHexColor(selectedColor);

  const canSave =
    Boolean(label.trim()) &&
    TAG_AVAILABILITY_OPTIONS.includes(availability) &&
    !saveSubmitting;

  const modalTitle = isEditMode ? 'Edit Card Tag' : 'New Card Tag';

  const boardSelectorBody = () => {
    if (workspaceBoardsLoading) {
      return (
        <div className="new-blocker-board-selector-empty new-blocker-board-selector-loading">
          Loading boards…
        </div>
      );
    }
    if (!workspaceBoardOptions.length) {
      return (
        <div className="new-blocker-board-selector-empty">
          No boards available
        </div>
      );
    }
    if (filteredWorkspaceOptions.length === 0) {
      return <div className="new-blocker-board-selector-empty">No matches</div>;
    }
    return filteredWorkspaceOptions.map((ws) => (
      <div key={boardKey(ws.workspace_id)} className="new-blocker-workspace-group">
        <div className="new-blocker-workspace-head">
          <FiUsers size={18} aria-hidden />
          <span className="new-blocker-workspace-title">{ws.workspace_name}</span>
          <button
            type="button"
            className="new-blocker-workspace-select-all"
            onClick={() => toggleWorkspaceAll(ws)}
          >
            {isWorkspaceFullySelected(ws) ? 'Deselect all' : 'Select all'}
          </button>
        </div>
        <div className="new-blocker-board-tile-grid">
          {ws.boards.map((board) => (
            <button
              type="button"
              key={boardKey(board.board_id)}
              className={`new-blocker-board-tile${selectedIds.has(boardKey(board.board_id)) ? ' new-blocker-board-tile--selected' : ''}`}
              onClick={() => toggleBoard(board)}
              aria-pressed={selectedIds.has(boardKey(board.board_id))}
            >
              {board.board_name}
            </button>
          ))}
        </div>
      </div>
    ));
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      className="new-blocker-modal"
      centered
      size="md"
      dialogClassName="new-blocker-modal-dialog"
    >
      <Modal.Header className="new-blocker-modal-header">
        <Modal.Title className="new-blocker-modal-title">{modalTitle}</Modal.Title>
        <button type="button" className="new-blocker-modal-close" onClick={onClose} aria-label="Close">
          <FiX size={20} />
        </button>
      </Modal.Header>
      <Modal.Body className="new-blocker-modal-body">
        <div className="new-blocker-form">
          <div className="new-blocker-row-fields">
            <div className="new-blocker-field">
              <label className="new-blocker-label">Color</label>
              <div className="new-blocker-color-wrapper">
                <button
                  ref={colorTriggerRef}
                  type="button"
                  className="new-blocker-color-swatch"
                  style={{ backgroundColor: previewHex }}
                  onClick={() => (isColorPickerOpen ? closeColorPicker() : openColorPicker())}
                  aria-haspopup="dialog"
                  aria-expanded={isColorPickerOpen}
                  aria-label="Open color picker"
                />
              </div>
            </div>

            <div className="new-blocker-field-cluster">
              <div className="new-blocker-tag-fields-inline">
                <div className="new-blocker-field new-blocker-field-label-with-availability">
                  <label className="new-blocker-label" htmlFor="new-tag-label-input">
                    Label
                  </label>
                  <input
                    id="new-tag-label-input"
                    type="text"
                    className="new-blocker-input"
                    placeholder="Enter tag label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                </div>
                <div className="new-blocker-field new-blocker-field-availability">
                  <label className="new-blocker-label" htmlFor="new-tag-availability-select">
                    Availability
                  </label>
                  <select
                    id="new-tag-availability-select"
                    className="new-blocker-select"
                    value={availability}
                    onChange={(e) => setAvailability(e.target.value)}
                    aria-required
                  >
                    {TAG_AVAILABILITY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="new-blocker-field new-blocker-boards-field">
            <p className="new-blocker-boards-text">The tag is applied to the following boards</p>
            <div className="new-blocker-boards-controls" ref={boardsControlsRef}>
              <button
                ref={addBoardBtnRef}
                type="button"
                className="new-blocker-add-board-btn"
                aria-label="Choose boards"
                aria-expanded={isBoardSelectorOpen}
                onClick={toggleBoardSelector}
              >
                <FiPlus size={20} />
              </button>
            </div>

            {sortedChips.length > 0 && (
              <div className="new-blocker-boards-list">
                {sortedChips.map((b) => (
                  <span
                    key={boardKey(b.board_id)}
                    className="new-blocker-selected-board-chip"
                  >
                    <span className="new-blocker-selected-board-chip-text">{b.board_name}</span>
                    <button
                      type="button"
                      className="new-blocker-selected-board-chip-remove"
                      onClick={() => removeBoardChip(b.board_id)}
                      aria-label={`Remove ${b.board_name}`}
                    >
                      <FiX size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer className="new-blocker-modal-footer">
        <button
          type="button"
          className="new-blocker-save-btn"
          onClick={() => handleSave()}
          disabled={!canSave}
        >
          Save
        </button>
      </Modal.Footer>

      {isColorPickerOpen &&
        createPortal(
          <div
            className="new-blocker-color-picker-portal"
            style={{
              position: 'fixed',
              top: colorPickerPlacement.top,
              left: colorPickerPlacement.left,
              zIndex: COLOR_PICKER_PORTAL_Z,
            }}
          >
            <SedresColorPicker
              popoverRef={colorPickerPopoverRef}
              popoverId={isEditMode ? 'edit-tag-color-picker' : 'new-tag-color-picker'}
              initialHex={previewHex}
              onApply={(hex) => {
                setSelectedColor(normalizeHexColor(hex));
                setIsColorPickerOpen(false);
              }}
              onCancel={closeColorPicker}
              ariaLabel="Pick tag color"
              hexInputId={isEditMode ? 'editTagColorHex' : 'newTagColorHex'}
            />
          </div>,
          document.body
        )}

      {isBoardSelectorOpen &&
        createPortal(
          <div
            className="new-blocker-board-selector"
            ref={boardSelectorRef}
            style={{
              position: 'fixed',
              top: boardSelectorPlacement.top,
              bottom: boardSelectorPlacement.bottom,
              left: boardSelectorPlacement.left,
              width: boardSelectorPlacement.width,
              maxHeight: boardSelectorPlacement.maxHeight,
              overflowY: 'auto',
              zIndex: BOARD_SELECTOR_PORTAL_Z,
            }}
          >
            <div className="new-blocker-board-selector-header">
              <FiFilter size={16} className="new-blocker-board-selector-search-icon" aria-hidden />
              <input
                type="search"
                className="new-blocker-board-selector-search"
                placeholder="Filter"
                value={boardSearch}
                onChange={(e) => setBoardSearch(e.target.value)}
                aria-label="Filter workspaces and boards"
              />
            </div>
            <div className="new-blocker-board-selector-scroll">{boardSelectorBody()}</div>
          </div>,
          document.body
        )}
    </Modal>
  );
};

NewTagModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func,
  editingTag: PropTypes.shape({
    tag_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    label: PropTypes.string,
    availability_level: PropTypes.string,
    color_code: PropTypes.string,
    boards: PropTypes.arrayOf(
      PropTypes.shape({
        board_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        board_name: PropTypes.string,
      })
    ),
  }),
  workspaceBoardOptions: PropTypes.arrayOf(
    PropTypes.shape({
      workspace_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      workspace_name: PropTypes.string.isRequired,
      boards: PropTypes.arrayOf(
        PropTypes.shape({
          board_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
          board_name: PropTypes.string.isRequired,
        })
      ).isRequired,
    })
  ),
  workspaceBoardsLoading: PropTypes.bool,
};

NewTagModal.defaultProps = {
  onSave: undefined,
  editingTag: null,
  workspaceBoardOptions: [],
  workspaceBoardsLoading: false,
};

export default NewTagModal;
