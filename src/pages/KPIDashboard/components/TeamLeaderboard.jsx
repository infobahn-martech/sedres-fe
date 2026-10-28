import React, { useState, useMemo, useEffect } from 'react';
import { FiSearch, FiFilter, FiChevronDown, FiChevronUp, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import YellowColorIcon from '../../../assets/images/YellowColorIcon.png';
import BlueColorIcon from '../../../assets/images/BlueColorIcon.png';
import VoilentColorIcon from '../../../assets/images/VoilentColorIcon.png';
import GreenColorIcon from '../../../assets/images/GreenColorIcon.png';
import PurpleColorIcon from '../../../assets/images/PurpleColorIcon.png';
import '../../../design/scss/pages/kpi-dashboard/components/TeamLeaderboard.scss';
import PremiumSelect from '../../../components/form/PremiumSelect';
import useKPIDashboardReducer from '../../../store/KPIDashboard';

const fallbackIcons = [BlueColorIcon, GreenColorIcon, YellowColorIcon, PurpleColorIcon, VoilentColorIcon];

const getBadgeIcon = (member) => {
  if (member.badgeIconUrl) return member.badgeIconUrl;
  const levelIndex = member.levelId ? Number(member.levelId) : member.rank;
  return fallbackIcons[((levelIndex - 1) % fallbackIcons.length + fallbackIcons.length) % fallbackIcons.length];
};

const getLevelLabel = (member) => {
  if (member.levelName) return member.levelName;
  if (member.levelId) return `Level ${member.levelId}`;
  return 'Unranked';
};

const TeamLeaderboard = () => {
  const leaderboard = useKPIDashboardReducer((state) => state.leaderboard);
  const leaderboardPagination = useKPIDashboardReducer((state) => state.leaderboardPagination);
  const isLoadingLeaderboard = useKPIDashboardReducer((state) => state.isLoadingLeaderboard);
  const fetchLeaderboard = useKPIDashboardReducer((state) => state.fetchLeaderboard);

  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState('All');
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 10;

  useEffect(() => {
    fetchLeaderboard({
      page,
      limit,
      search: searchTerm || undefined,
      level_id: levelFilter,
    });
  }, [page, limit, searchTerm, levelFilter, fetchLeaderboard]);

  const levelOptions = useMemo(() => {
    const levels = new Set();
    leaderboard.forEach((member) => {
      if (member.levelId) levels.add(String(member.levelId));
    });
    return ['All', ...Array.from(levels).sort((a, b) => Number(a) - Number(b))];
  }, [leaderboard]);

  const filteredAndSortedMembers = useMemo(() => {
    let filtered = leaderboard.filter((member) => {
      const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesLevel =
        levelFilter === 'All' || String(member.levelId) === levelFilter;
      return matchesSearch && matchesLevel;
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
          case 'level':
            aValue = a.levelId ? Number(a.levelId) : 0;
            bValue = b.levelId ? Number(b.levelId) : 0;
            break;
          case 'points':
            aValue = a.points;
            bValue = b.points;
            break;
          case 'completion':
            aValue = a.completion;
            bValue = b.completion;
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
  }, [leaderboard, searchTerm, levelFilter, sortField, sortDirection]);

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

  const totalMembers = leaderboardPagination.total || 0;
  const totalPages = leaderboardPagination.total_pages || 1;
  const currentPage = leaderboardPagination.page || page;

  return (
    <div className="team-leaderboard">
      <div className="team-leaderboard__toolbar">
        <div className="team-leaderboard__header">
          <h2 className="team-leaderboard__title">Team Leaderboard</h2>
          <p className="team-leaderboard__subtitle">View and track your team&apos;s performance and achievements</p>
        </div>

        <div className="team-leaderboard__filters">
          <div className="team-leaderboard__search">
            <FiSearch className="team-leaderboard__search-icon" />
            <input
              type="text"
              placeholder="Search team members..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="team-leaderboard__search-input"
            />
          </div>

          <div className="team-leaderboard__filter-controls">
            <button
              type="button"
              className={`team-leaderboard__filter-toggle ${showFilters ? 'team-leaderboard__filter-toggle--active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <FiFilter />
              <span>Filters</span>
            </button>

            {showFilters && (
              <div className="team-leaderboard__filter-dropdown">
                <div className="team-leaderboard__filter-group">
                  <label className="team-leaderboard__filter-label">Level</label>
                  <PremiumSelect
                    value={levelFilter}
                    onChange={(e) => {
                      setLevelFilter(e.target.value);
                      setPage(1);
                    }}
                    options={levelOptions.map((option) => ({
                      value: option,
                      label: option === 'All' ? 'All Levels' : `Level ${option}`,
                    }))}
                    placeholder="Filter by level"
                    searchPlaceholder="Search level..."
                    className="team-leaderboard__filter-premium-select"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="team-leaderboard__table-wrapper">
        <table className="team-leaderboard-table">
          <thead>
            <tr>
              <th
                className="team-leaderboard-table__header team-leaderboard-table__header--sortable"
                onClick={() => handleSort('name')}
              >
                <div className="team-leaderboard-table__header-content">
                  Name
                  {getSortIcon('name')}
                </div>
              </th>
              <th
                className="team-leaderboard-table__header team-leaderboard-table__header--sortable"
                onClick={() => handleSort('level')}
              >
                <div className="team-leaderboard-table__header-content">
                  Level
                  {getSortIcon('level')}
                </div>
              </th>
              <th
                className="team-leaderboard-table__header team-leaderboard-table__header--sortable"
                onClick={() => handleSort('points')}
              >
                <div className="team-leaderboard-table__header-content">
                  Points
                  {getSortIcon('points')}
                </div>
              </th>
              <th
                className="team-leaderboard-table__header team-leaderboard-table__header--sortable"
                onClick={() => handleSort('completion')}
              >
                <div className="team-leaderboard-table__header-content">
                  Current Level Completion
                  {getSortIcon('completion')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoadingLeaderboard && filteredAndSortedMembers.length === 0 ? (
              <tr>
                <td colSpan="4" className="team-leaderboard-table__empty">
                  Loading team members...
                </td>
              </tr>
            ) : filteredAndSortedMembers.length === 0 ? (
              <tr>
                <td colSpan="4" className="team-leaderboard-table__empty">
                  No team members found
                </td>
              </tr>
            ) : (
              filteredAndSortedMembers.map((member) => (
                <tr key={member.id} className="team-leaderboard-table__row">
                  <td className="team-leaderboard-table__cell team-leaderboard-table__cell--name">
                    {member.name}
                  </td>
                  <td className="team-leaderboard-table__cell">
                    <div className="team-leaderboard-table__level-content">
                      <img
                        src={getBadgeIcon(member)}
                        alt={getLevelLabel(member)}
                        className="team-leaderboard-table__level-icon"
                      />
                      <span>{getLevelLabel(member)}</span>
                    </div>
                  </td>
                  <td className="team-leaderboard-table__cell">
                    {member.points.toLocaleString()} Points
                  </td>
                  <td className="team-leaderboard-table__cell">
                    <div className="team-leaderboard-table__completion">
                      <div className="team-leaderboard-table__progress-bar">
                        <div
                          className="team-leaderboard-table__progress-fill"
                          style={{ width: `${member.completion}%` }}
                        />
                      </div>
                      <span className="team-leaderboard-table__completion-text">{member.completion}%</span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="team-leaderboard__summary">
        <span className="team-leaderboard__summary-text">
          Showing {filteredAndSortedMembers.length} of {totalMembers} team members
        </span>
        {totalPages > 1 && (
          <div className="team-leaderboard__pagination">
            <button
              type="button"
              className="team-leaderboard__pagination-btn"
              disabled={currentPage <= 1 || isLoadingLeaderboard}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              aria-label="Previous page"
            >
              <FiChevronLeft />
            </button>
            <span className="team-leaderboard__pagination-text">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              className="team-leaderboard__pagination-btn"
              disabled={currentPage >= totalPages || isLoadingLeaderboard}
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

export default TeamLeaderboard;
