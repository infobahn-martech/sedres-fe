import { useState, useEffect } from 'react';
import { FiX, FiSearch } from 'react-icons/fi';
import CustomModal from '../../components/CustomModal';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import UnarchiveConfirmIcon from '../../assets/images/unarchive.svg';
import useWorkSpaceReducer from '../../store/WorkSpaceReducer';
import '../../design/scss/Workspaces.scss';

const PAGE_LIMIT = 10;

// Backend has used several keys for the archiving user; some return a nested user object
const resolveArchivedBy = (row) => {
  const raw =
    row.archived_by_name ??
    row.archive_by_name ??
    row.archived_by_user ??
    row.archived_by ??
    row.archive_by ??
    row.user_name ??
    row.user ??
    '';
  if (raw && typeof raw === 'object') {
    return raw.name ?? raw.user_name ?? raw.full_name ?? raw.username ?? raw.email ?? '';
  }
  return raw == null ? '' : String(raw);
};

// Map API response (snake_case) to UI shape
// workspace_id: from API or fallback to archive_log_id if backend uses it for unarchive lookup
const mapArchiveLogItem = (row) => {
  const archivedBy = resolveArchivedBy(row);
  return {
    id: row.archive_log_id,
    board_id: row.board_id ?? row.boardId ?? row.archive_log_id,
    workspace_id: row.workspace_id ?? row.workspaceId ?? row.archive_log_id,
    workspace: row.workspace_name ?? '',
    board: row.board_name ?? '',
    archivedBy,
    archivedByAvatar: archivedBy.trim().charAt(0).toUpperCase() || '?',
    archivedAt: row.archived_at ?? '',
  };
};

const ArchivedWorkspacesModal = ({ show, onClose }) => {
  const [filterValue, setFilterValue] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showUnarchiveModal, setShowUnarchiveModal] = useState(false);
  const [selectedItemForUnarchive, setSelectedItemForUnarchive] = useState(null);
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
  const totalItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_LIMIT));
  const safePage = Math.min(currentPage, totalPages);
  const pageItems = filteredItems.slice((safePage - 1) * PAGE_LIMIT, safePage * PAGE_LIMIT);

  useEffect(() => {
    if (show) {
      setFilterValue('');
      setCurrentPage(1);
      fetchWorkspaceArchiveLog();
    }
  }, [show, fetchWorkspaceArchiveLog]);

  const handleFilterChange = (e) => {
    setFilterValue(e.target.value);
    setCurrentPage(1);
  };

  const handlePage = (pageNum) => {
    if (pageNum < 1 || pageNum > totalPages || pageNum === safePage) return;
    setCurrentPage(pageNum);
  };

  const handleUnarchive = (item) => {
    if (item?.board_id == null || item.board_id === '') return;
    setSelectedItemForUnarchive(item);
    setShowUnarchiveModal(true);
  };

  const handleCancelUnarchive = () => {
    setShowUnarchiveModal(false);
    setSelectedItemForUnarchive(null);
  };

  const handleConfirmUnarchive = () => {
    if (!selectedItemForUnarchive) return;
    unarchiveWorkspace({
      board_id: selectedItemForUnarchive.board_id,
      cb: () => {
        handleCancelUnarchive();
        onClose();
        fetchWorkspaceArchiveLog();
      },
    });
  };


  return (
    <>
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
                  onChange={handleFilterChange}
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
                    pageItems.map((item) => (
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
                                handleUnarchive(item);
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
                {`${totalItems} item${totalItems === 1 ? '' : 's'}`}
              </span>
              <div className="archived-workspaces-pagination-controls">
                <button
                  type="button"
                  className="archived-workspaces-pagination-btn"
                  onClick={() => handlePage(safePage - 1)}
                  disabled={safePage <= 1 || archiveLogLoading}
                >
                  Previous
                </button>
                <span className="archived-workspaces-pagination-page">Page {safePage}</span>
                <button
                  type="button"
                  className="archived-workspaces-pagination-btn"
                  onClick={() => handlePage(safePage + 1)}
                  disabled={safePage >= totalPages || archiveLogLoading}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    />

    {showUnarchiveModal && (
      <DeleteConfirmationModal
        show={showUnarchiveModal}
        onCancel={handleCancelUnarchive}
        onConfirm={handleConfirmUnarchive}
        deleteText={`Are you sure you want to unarchive "${selectedItemForUnarchive?.board || 'this board'}"?`}
        isLoading={addEditLoader}
        showIcon
        icon={UnarchiveConfirmIcon}
        className="archived-workspaces-confirm-modal"
        backdropClassName="archived-workspaces-confirm-modal-backdrop"
      />
    )}
    </>
  );
};

export default ArchivedWorkspacesModal;

