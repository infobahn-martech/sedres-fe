import { useState, useEffect } from 'react';
import { FiX, FiSearch } from 'react-icons/fi';
import CustomModal from '../../components/CustomModal';
import useWorkSpaceReducer from '../../store/WorkSpaceReducer';
import '../../design/scss/Workspaces.scss';

// Map API response (snake_case) to UI shape
// workspace_id: from API or fallback to archive_log_id if backend uses it for unarchive lookup
const mapArchiveLogItem = (row) => ({
  id: row.archive_log_id,
  board_id: row.board_id ?? row.boardId ?? row.archive_log_id,
  workspace_id: row.workspace_id ?? row.workspaceId ?? row.archive_log_id,
  workspace: row.workspace_name ?? '',
  board: row.board_name ?? '',
  archivedBy: row.archive_by ?? '',
  archivedByAvatar: (row.archive_by ?? '').charAt(0).toUpperCase() || '?',
  archivedAt: row.archived_at ?? '',
});

const ArchivedWorkspacesModal = ({ show, onClose }) => {
  const [filterValue, setFilterValue] = useState('');
  const {
    archiveLog,
    archiveLogLoading,
    fetchWorkspaceArchiveLog,
    unarchiveWorkspace,
    addEditLoader,
  } = useWorkSpaceReducer();

  const archivedItems = (archiveLog || []).map(mapArchiveLogItem);
  const filteredItems = archivedItems.filter(
    (item) =>
      item.workspace.toLowerCase().includes(filterValue.toLowerCase()) ||
      item.board.toLowerCase().includes(filterValue.toLowerCase())
  );
  useEffect(() => {
    if (show) fetchWorkspaceArchiveLog();
  }, [show, fetchWorkspaceArchiveLog]);

  const handleUnarchive = (id) => {
    if (id == null || id === '') return;
    unarchiveWorkspace({
      board_id: id,
      cb: () => { onClose(); fetchWorkspaceArchiveLog() },
    });
  };


  return (
    <CustomModal
      show={show}
      closeModal={onClose}
      className="archived-workspaces-modal"
      dialgName="archived-workspaces-modal-dialog"
      createModal={false}
      body={
        <div className="archived-workspaces-modal-content">
          {/* Header */}
          <div className="archived-workspaces-modal-header">
            <div className="archived-workspaces-modal-header-text">
              <h2 className="archived-workspaces-modal-title">Archived workspaces and boards</h2>
              <p className="archived-workspaces-modal-subtitle">Restore archived boards back to their workspace</p>
            </div>
            <button
              type="button"
              className="archived-workspaces-modal-close"
              onClick={onClose}
              aria-label="Close"
            >
              <FiX size={20} />
            </button>
          </div>

          <div className="archived-workspaces-toolbar-section">
            <div className="archived-workspaces-filter-bar">
              <div className="archived-workspaces-filter-input-wrap">
                <FiSearch size={16} className="archived-workspaces-filter-search-icon" />
                <input
                  type="text"
                  className="archived-workspaces-filter-input"
                  placeholder="Filter"
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Table Section */}
          <div className="archived-workspaces-table-section">
            <div className="archived-workspaces-table-wrapper">
              <table className="archived-workspaces-table">
                <thead>
                  <tr>
                    <th className="archived-workspaces-th-workspace">Workspace</th>
                    <th className="archived-workspaces-th-board">Board</th>
                    <th className="archived-workspaces-th-archived-by">Archived by</th>
                    <th className="archived-workspaces-th-archived-at">Archived at</th>
                    <th className="archived-workspaces-th-actions">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {archiveLogLoading ? (
                    <tr>
                      <td colSpan="5" className="archived-workspaces-empty">
                        Loading...
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="archived-workspaces-empty">
                        No archived items found
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => (
                      <tr key={item.id} className="archived-workspaces-row">
                        <td className="archived-workspaces-td-workspace">{item.workspace}</td>
                        <td className="archived-workspaces-td-board">
                          <span className="archived-workspaces-board-link">
                            {item.board}
                          </span>
                        </td>
                        <td className="archived-workspaces-td-archived-by">
                          <div className="archived-workspaces-user-info">
                            <div className="archived-workspaces-avatar">{item.archivedByAvatar}</div>
                            <span>{item.archivedBy}</span>
                          </div>
                        </td>
                        <td className="archived-workspaces-td-archived-at">{item.archivedAt}</td>
                        <td className="archived-workspaces-td-actions">
                          <div className="archived-workspaces-actions-group">
                            <button
                              type="button"
                              className="archived-workspaces-action-btn"
                              aria-label="Unarchive"
                              title="Unarchive"
                              disabled={addEditLoader}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleUnarchive(item.board_id);
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path
                                  d="M8 2V8M8 8L5 5M8 8L11 5M2 10V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V10"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="archived-workspaces-pagination">
              <span className="archived-workspaces-pagination-count">
                {filteredItems.length} item{filteredItems.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </div>
      }
    />
  );
};

export default ArchivedWorkspacesModal;

