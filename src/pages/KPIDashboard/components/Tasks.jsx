import React, { useState, useMemo, useEffect } from 'react';
import { FiSearch, FiFilter, FiChevronDown, FiChevronUp, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import '../../../design/scss/pages/kpi-dashboard/components/Tasks.scss';
import PremiumSelect from '../../../components/form/PremiumSelect';
import useAuthReducer from '../../../store/AuthReducer';
import useKPIDashboardReducer from '../../../store/KPIDashboard';
import { getItem } from '../../../shared/helpers/localStorage';

const statusOptions = ['All', 'Pending', 'In Progress', 'Completed'];

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const match = String(timeStr).match(/(\d+)h\s*(\d+)m/);
  if (!match) return 0;
  return Number.parseInt(match[1], 10) * 60 + Number.parseInt(match[2], 10);
};

const formatStatusLabel = (statusLabel) => {
  const normalized = (statusLabel || '').toLowerCase().replace(/_/g, ' ').trim();
  if (normalized === 'in progress' || normalized === 'inprogress' || normalized === 'started') return 'In Progress';
  if (normalized === 'completed' || normalized === 'done') return 'Completed';
  if (normalized === 'pending') return 'Pending';
  return statusLabel || 'Pending';
};

const getStatusClass = (statusLabel) => {
  const formattedStatus = formatStatusLabel(statusLabel);
  switch (formattedStatus) {
    case 'Completed':
      return 'tasks-table__status--completed';
    case 'In Progress':
      return 'tasks-table__status--in-progress';
    case 'Pending':
      return 'tasks-table__status--pending';
    default:
      return 'tasks-table__status--pending';
  }
};

const Tasks = () => {
  const userId = useAuthReducer((state) => state.authData?.userid) || getItem('userid');
  const taskHistory = useKPIDashboardReducer((state) => state.taskHistory);
  const taskHistoryPagination = useKPIDashboardReducer((state) => state.taskHistoryPagination);
  const isLoadingTaskHistory = useKPIDashboardReducer((state) => state.isLoadingTaskHistory);
  const fetchUserTaskHistory = useKPIDashboardReducer((state) => state.fetchUserTaskHistory);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 10;

  useEffect(() => {
    if (!userId) return;

    fetchUserTaskHistory(userId, {
      page,
      limit,
      search: searchTerm || undefined,
      status: statusFilter,
    });
  }, [userId, page, limit, searchTerm, statusFilter, fetchUserTaskHistory]);

  const filteredAndSortedTasks = useMemo(() => {
    let filtered = taskHistory.filter((task) => {
      const matchesSearch = task.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === 'All' || formatStatusLabel(task.status) === statusFilter;
      return matchesSearch && matchesStatus;
    });

    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let aValue;
        let bValue;

        switch (sortField) {
          case 'name':
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case 'estimatedTime':
            aValue = parseTimeToMinutes(a.estimatedTime);
            bValue = parseTimeToMinutes(b.estimatedTime);
            break;
          case 'timeSpent':
            aValue = parseTimeToMinutes(a.timeSpent);
            bValue = parseTimeToMinutes(b.timeSpent);
            break;
          case 'remainingTime':
            aValue = parseTimeToMinutes(a.remainingTime);
            bValue = parseTimeToMinutes(b.remainingTime);
            break;
          case 'status':
            aValue = formatStatusLabel(a.status);
            bValue = formatStatusLabel(b.status);
            break;
          case 'totalPoints':
            aValue = a.totalPoints;
            bValue = b.totalPoints;
            break;
          case 'earnedPoints':
            aValue = a.earnedPoints;
            bValue = b.earnedPoints;
            break;
          case 'balancePoints':
            aValue = a.balancePoints;
            bValue = b.balancePoints;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [taskHistory, searchTerm, statusFilter, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <FiChevronUp /> : <FiChevronDown />;
  };

  const formatPoints = (points) => (points || 0).toLocaleString('en-US');

  const totalTasks = taskHistoryPagination.total || 0;
  const totalPages = taskHistoryPagination.total_pages || 1;
  const currentPage = taskHistoryPagination.page || page;

  return (
    <div className="tasks">
      <div className="tasks__toolbar">
        <div className="tasks__header">
          <h2 className="tasks__title">Task Management</h2>
          <p className="tasks__subtitle">View, filter, and manage all your assigned tasks</p>
        </div>

        <div className="tasks__filters">
          <div className="tasks__search">
            <FiSearch className="tasks__search-icon" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="tasks__search-input"
            />
          </div>

          <div className="tasks__filter-controls">
            <button
              type="button"
              className={`tasks__filter-toggle ${showFilters ? 'tasks__filter-toggle--active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <FiFilter />
              <span>Filters</span>
            </button>

            {showFilters && (
              <div className="tasks__filter-dropdown">
                <div className="tasks__filter-group">
                  <label className="tasks__filter-label">Status</label>
                  <PremiumSelect
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    options={statusOptions.map((option) => ({ value: option, label: option }))}
                    placeholder="Filter by status"
                    searchPlaceholder="Search status..."
                    className="tasks__filter-premium-select"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="tasks__table-wrapper">
        <table className="tasks-table">
          <thead>
            <tr>
              <th
                className="tasks-table__header tasks-table__header--sortable"
                onClick={() => handleSort('name')}
              >
                <div className="tasks-table__header-content">
                  Name
                  {getSortIcon('name')}
                </div>
              </th>
              <th
                className="tasks-table__header tasks-table__header--sortable"
                onClick={() => handleSort('estimatedTime')}
              >
                <div className="tasks-table__header-content">
                  Estimated Time
                  {getSortIcon('estimatedTime')}
                </div>
              </th>
              <th
                className="tasks-table__header tasks-table__header--sortable"
                onClick={() => handleSort('timeSpent')}
              >
                <div className="tasks-table__header-content">
                  Time Spent
                  {getSortIcon('timeSpent')}
                </div>
              </th>
              <th
                className="tasks-table__header tasks-table__header--sortable"
                onClick={() => handleSort('remainingTime')}
              >
                <div className="tasks-table__header-content">
                  Remaining Time
                  {getSortIcon('remainingTime')}
                </div>
              </th>
              <th
                className="tasks-table__header tasks-table__header--sortable"
                onClick={() => handleSort('status')}
              >
                <div className="tasks-table__header-content">
                  Status
                  {getSortIcon('status')}
                </div>
              </th>
              <th
                className="tasks-table__header tasks-table__header--sortable"
                onClick={() => handleSort('totalPoints')}
              >
                <div className="tasks-table__header-content">
                  Total Points
                  {getSortIcon('totalPoints')}
                </div>
              </th>
              <th
                className="tasks-table__header tasks-table__header--sortable"
                onClick={() => handleSort('earnedPoints')}
              >
                <div className="tasks-table__header-content">
                  Earned Points
                  {getSortIcon('earnedPoints')}
                </div>
              </th>
              <th
                className="tasks-table__header tasks-table__header--sortable"
                onClick={() => handleSort('balancePoints')}
              >
                <div className="tasks-table__header-content">
                  Balance Points
                  {getSortIcon('balancePoints')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoadingTaskHistory && filteredAndSortedTasks.length === 0 ? (
              <tr>
                <td colSpan="8" className="tasks-table__empty">
                  Loading tasks...
                </td>
              </tr>
            ) : filteredAndSortedTasks.length === 0 ? (
              <tr>
                <td colSpan="8" className="tasks-table__empty">
                  No tasks found
                </td>
              </tr>
            ) : (
              filteredAndSortedTasks.map((task) => (
                <tr key={task.id} className="tasks-table__row">
                  <td className="tasks-table__cell tasks-table__cell--name">
                    {task.name}
                  </td>
                  <td className="tasks-table__cell">{task.estimatedTime}</td>
                  <td className="tasks-table__cell">{task.timeSpent}</td>
                  <td className="tasks-table__cell">{task.remainingTime}</td>
                  <td className="tasks-table__cell">
                    <span className={`tasks-table__status ${getStatusClass(task.status)}`}>
                      {formatStatusLabel(task.status)}
                    </span>
                  </td>
                  <td className="tasks-table__cell">{formatPoints(task.totalPoints)}</td>
                  <td className="tasks-table__cell">{formatPoints(task.earnedPoints)}</td>
                  <td className="tasks-table__cell">{formatPoints(task.balancePoints)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="tasks__summary">
        <span className="tasks__summary-text">
          Showing {filteredAndSortedTasks.length} of {totalTasks} tasks
        </span>
        {totalPages > 1 && (
          <div className="tasks__pagination">
            <button
              type="button"
              className="tasks__pagination-btn"
              disabled={currentPage <= 1 || isLoadingTaskHistory}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              aria-label="Previous page"
            >
              <FiChevronLeft />
            </button>
            <span className="tasks__pagination-text">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              className="tasks__pagination-btn"
              disabled={currentPage >= totalPages || isLoadingTaskHistory}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              aria-label="Next page"
            >
              <FiChevronRight />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Tasks;
