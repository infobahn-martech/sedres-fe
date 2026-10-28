import React, { useEffect, useMemo, useState } from 'react';
import { FiSearch, FiPlus } from 'react-icons/fi';
import useLevelManagementReducer from '../../store/LevelManagementReducer';
import { LevelManagementModal } from './Modals/AddEditModal';
import { RenderEditAction } from './RenderCells';
import '../../design/scss/pages/kpi-dashboard/components/LevelManagement.scss';

const LevelManagement = () => {
  const { levels, getLevels, getLevel, isLoading } = useLevelManagementReducer((state) => state);

  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    getLevels();
  }, [getLevels]);

  const filteredLevels = useMemo(() => {
    if (!searchTerm.trim()) return levels;
    const term = searchTerm.toLowerCase();
    return levels.filter((level) =>
      level.level_name?.toLowerCase().includes(term)
    );
  }, [levels, searchTerm]);

  const maxScale = useMemo(() => {
    if (!levels.length) return 1;
    return Math.max(...levels.map((l) => Number(l.max_points) || 0), 1);
  }, [levels]);

  const getRangeStyle = (minPoints, maxPoints) => {
    const min = Number(minPoints) || 0;
    const max = Number(maxPoints) || 0;
    return {
      marginLeft: `${(min / maxScale) * 100}%`,
      width: `${((max - min) / maxScale) * 100}%`,
    };
  };

  const handleEditClick = (row) => {
    getLevel({
      levelId: row.level_id,
      cb: (levelData) => {
        if (levelData) setShowModal(levelData);
      },
    });
  };

  return (
    <div className="level-management">
      <div className="level-management__top">
        <div className="level-management__header">
          <h2 className="level-management__title">KPI Level Management</h2>
          <p className="level-management__subtitle">
            Manage KPI levels, points range and badge icons
          </p>
        </div>

        <div className="level-management__toolbar">
          <div className="level-management__search">
            <FiSearch className="level-management__search-icon" />
            <input
              type="text"
              placeholder="Search levels..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="level-management__search-input"
            />
          </div>

          <button
            type="button"
            className="level-management__add-btn"
            onClick={() => setShowModal(true)}
          >
            <FiPlus />
            <span>Add Level</span>
          </button>
        </div>
      </div>

      <div className="level-management__table-wrapper">
        {isLoading ? (
          <div className="level-management__loading">Loading KPI levels...</div>
        ) : (
          <table className="level-mgmt-table">
            <thead>
              <tr>
                <th className="level-mgmt-table__header">Badge</th>
                <th className="level-mgmt-table__header">Level Name</th>
                <th className="level-mgmt-table__header">Min Points</th>
                <th className="level-mgmt-table__header">Max Points</th>
                <th className="level-mgmt-table__header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLevels.length === 0 ? (
                <tr>
                  <td colSpan="5" className="level-mgmt-table__empty">
                    {searchTerm ? 'No levels match your search' : 'No KPI levels found'}
                  </td>
                </tr>
              ) : (
                filteredLevels.map((level) => (
                  <tr key={level.level_id} className="level-mgmt-table__row">
                    <td className="level-mgmt-table__cell">
                      <div className="level-mgmt-table__badge">
                        {level.badge_icon_url ? (
                          <img
                            src={level.badge_icon_url}
                            alt={level.level_name}
                            className="level-mgmt-table__badge-icon"
                          />
                        ) : (
                          <span className="level-mgmt-table__badge-placeholder">—</span>
                        )}
                      </div>
                    </td>
                    <td className="level-mgmt-table__cell level-mgmt-table__cell--name">
                      {level.level_name}
                    </td>
                    <td className="level-mgmt-table__cell">
                      <div className="level-mgmt-table__points">
                        <span className="level-mgmt-table__points-value">
                          {Number(level.min_points).toLocaleString()}
                        </span>
                        <div className="level-mgmt-table__range">
                          <div className="level-mgmt-table__progress-bar">
                            <div
                              className="level-mgmt-table__progress-fill"
                              style={getRangeStyle(level.min_points, level.max_points)}
                            />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="level-mgmt-table__cell">
                      <div className="level-mgmt-table__points">
                        <span className="level-mgmt-table__points-value">
                          {Number(level.max_points).toLocaleString()}
                        </span>
                        <span className="level-mgmt-table__range-text">
                          Range: {Number(level.min_points).toLocaleString()} – {Number(level.max_points).toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="level-mgmt-table__cell level-mgmt-table__cell--actions">
                      <RenderEditAction
                        row={level}
                        onEditClick={handleEditClick}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="level-management__summary">
        <span className="level-management__summary-text">
          Showing {filteredLevels.length} of {levels.length} levels
        </span>
      </div>

      {!!showModal && (
        <LevelManagementModal
          showModal={showModal}
          closeModal={() => setShowModal(false)}
          onSuccess={() => getLevels()}
        />
      )}
    </div>
  );
};

export default LevelManagement;
