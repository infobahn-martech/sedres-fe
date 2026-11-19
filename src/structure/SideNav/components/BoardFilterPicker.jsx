import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { FiChevronDown, FiFilter, FiUsers } from 'react-icons/fi';

// Anchored, workspace-grouped board picker used everywhere a "board is ..." filter
// appears (custom field board filter, "Board is" rule condition, ...) — matches the
// Board Minimap picker's design instead of a plain <select>, which doesn't scale once
// a workspace has more than a handful of boards.
function BoardFilterPicker({ workspaces, value, onChange, wrapClassName, triggerClassName, triggerIconSize, panelClassName, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const boards = workspaces.flatMap((w) => w.boards ?? []);
  const selectedBoard = boards.find((b) => String(b.board_id) === String(value));

  const filterQuery = filterText.trim().toLowerCase();
  const filteredGroups = workspaces
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

BoardFilterPicker.propTypes = {
  workspaces: PropTypes.array.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  wrapClassName: PropTypes.string,
  triggerClassName: PropTypes.string,
  triggerIconSize: PropTypes.number,
  panelClassName: PropTypes.string,
  placeholder: PropTypes.string,
};

export default BoardFilterPicker;
