import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Modal } from 'react-bootstrap';
import Form from 'react-bootstrap/Form';
import { FiInfo, FiPlus, FiFilter } from 'react-icons/fi';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import '../../design/scss/pages/workspaces/DashboardAddItemsModal.scss';

function DashboardAddItemsModal({
  show,
  onClose,
  title,
  columnLabel,
  rows = [],
  loading = false,
  fetchError = null,
  onRetry = null,
  searchText,
  onSearchChange,
  filterChipActive,
  onFilterChipRemove,
  onFilterToolbarClick,
  pendingToggleId = null,
  onToggle,
  onAddClick,
  addButtonLabel,
}) {
  const displayedRows = useMemo(() => {
    let r = Array.isArray(rows) ? [...rows] : [];
    if (filterChipActive) {
      r = r.filter((row) => !row.addedToDashboard);
    }
    const q = searchText.trim().toLowerCase();
    if (q) {
      r = r.filter((row) => String(row.name ?? '').toLowerCase().includes(q));
    }
    return r;
  }, [rows, filterChipActive, searchText]);

  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
      scrollable
      keyboard
      backdrop
      className="dashboard-add-items-modal"
      backdropClassName="dashboard-add-items-modal-backdrop"
      dialogClassName="dashboard-add-items-modal-dialog"
      contentClassName="dashboard-add-items-modal-content"
    >
      <div className="dashboard-add-items-modal-inner">
        <div className="dashboard-add-items-modal-header">
          <h2 className="dashboard-add-items-modal-title" id="dashboard-add-items-modal-title">
            {title}
          </h2>
          <button
            type="button"
            className="dashboard-add-items-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M15 5L5 15M5 5L15 15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="dashboard-add-items-toolbar">
          <button
            type="button"
            className="dashboard-add-items-icon-btn"
            aria-label="Filter options"
            title="Filter"
            onClick={onFilterToolbarClick}
          >
            <FiFilter size={18} strokeWidth={2} />
          </button>

          <div className="dashboard-add-items-search-wrap">
            {filterChipActive && (
              <span className="dashboard-add-items-chip">
                <span className="dashboard-add-items-chip-label">Not added to dashboard</span>
                <button
                  type="button"
                  className="dashboard-add-items-chip-remove"
                  onClick={onFilterChipRemove}
                  aria-label="Remove filter"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M9 3L3 9M3 3L9 9"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </span>
            )}
            <input
              type="search"
              className="dashboard-add-items-search-input"
              placeholder="Filter"
              value={searchText}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Filter list"
            />
          </div>

          {onAddClick && (
            <button
              type="button"
              className="dashboard-add-items-icon-btn"
              onClick={onAddClick}
              aria-label={addButtonLabel}
              title={addButtonLabel}
            >
              <FiPlus size={20} strokeWidth={2} />
            </button>
          )}
        </div>

        <div className="dashboard-add-items-table-wrap">
          <div className="dashboard-add-items-table-head">
            <span className="dashboard-add-items-th dashboard-add-items-th--name">{columnLabel}</span>
            <span className="dashboard-add-items-th dashboard-add-items-th--added">
              Added to dashboard
              <span
                className="dashboard-add-items-info"
                title="When enabled, the item is included on this dashboard."
              >
                <FiInfo size={14} aria-hidden />
              </span>
            </span>
          </div>

          {loading && (
            <ul className="dashboard-add-items-skeleton-list" aria-hidden>
              {[1, 2, 3, 4, 5].map((k) => (
                <li key={k} className="dashboard-add-items-row dashboard-add-items-row--skeleton">
                  <Skeleton height={18} borderRadius={6} />
                  <Skeleton width={44} height={24} borderRadius={12} />
                </li>
              ))}
            </ul>
          )}

          {!loading && fetchError && (
            <div className="dashboard-add-items-empty dashboard-add-items-empty--error">
              <p>{fetchError}</p>
              {onRetry && (
                <button type="button" className="dashboard-add-items-retry" onClick={onRetry}>
                  Try again
                </button>
              )}
            </div>
          )}

          {!loading && !fetchError && displayedRows.length === 0 && (
            <div className="dashboard-add-items-empty">
              <p>No items found</p>
              <p className="dashboard-add-items-empty-hint">
                {searchText.trim() || filterChipActive
                  ? 'Try clearing filters or adjusting your search.'
                  : 'There is nothing to show here yet.'}
              </p>
            </div>
          )}

          {!loading && !fetchError && displayedRows.length > 0 && (
            <ul className="dashboard-add-items-list" role="list">
              {displayedRows.map((row) => {
                const idKey = String(row.id);
                const busy = pendingToggleId === idKey;
                return (
                  <li key={idKey} className="dashboard-add-items-row">
                    <span className="dashboard-add-items-cell dashboard-add-items-cell--name">{row.name}</span>
                    <span className="dashboard-add-items-cell dashboard-add-items-cell--toggle">
                      <Form.Check
                        type="switch"
                        id={`dashboard-add-item-${columnLabel}-${idKey}`}
                        checked={row.addedToDashboard}
                        disabled={busy}
                        onChange={(e) => onToggle(row.id, e.target.checked)}
                        aria-label={`${row.addedToDashboard ? 'Remove' : 'Add'} ${row.name}`}
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

DashboardAddItemsModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  columnLabel: PropTypes.string.isRequired,
  rows: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      name: PropTypes.string.isRequired,
      addedToDashboard: PropTypes.bool.isRequired,
    })
  ),
  loading: PropTypes.bool,
  fetchError: PropTypes.string,
  onRetry: PropTypes.func,
  searchText: PropTypes.string.isRequired,
  onSearchChange: PropTypes.func.isRequired,
  filterChipActive: PropTypes.bool.isRequired,
  onFilterChipRemove: PropTypes.func.isRequired,
  onFilterToolbarClick: PropTypes.func.isRequired,
  pendingToggleId: PropTypes.string,
  onToggle: PropTypes.func.isRequired,
  onAddClick: PropTypes.func,
  addButtonLabel: PropTypes.string,
};

export default DashboardAddItemsModal;
