import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProfileIconKPI from '../../../assets/images/ProfileIconKPI.png';
import useKPIDashboardReducer from '../../../store/KPIDashboard';
import '../../../design/scss/pages/kpi-dashboard/components/HeaderBar.scss';

const StarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="33" viewBox="0 0 36 33" fill="none">
    <path d="M17.5946 0L24.119 9.26262L35.1891 12.4377L28.1513 21.3374L28.4686 32.5623L17.5946 28.8L6.72058 32.5623L7.03788 21.3374L5.91278e-05 12.4377L11.0702 9.26262L17.5946 0Z" fill="#FFE100" />
  </svg>
);

const ChevronIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const HamburgerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const getProgressPercentage = (totalPoints, pointsToNextLevel) => {
  if (pointsToNextLevel == null || pointsToNextLevel <= 0) return 0;
  const earned = totalPoints ?? 0;
  const total = earned + pointsToNextLevel;
  return total > 0 ? Math.round((earned / total) * 100) : 0;
};

const HeaderBar = ({ breadcrumbs = null, title = 'KPI Dashboard', onMobileMenuToggle, onMyAccountClick, onLogoutClick }) => {
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  // Close the user menu on outside click or Escape
  useEffect(() => {
    if (!showUserMenu) return undefined;
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showUserMenu]);

  const handleUserMenuSelect = (callback) => {
    setShowUserMenu(false);
    if (callback) callback();
  };
  const dashboardData = useKPIDashboardReducer((state) => state.dashboardData);
  const { user, current_level, next_level, points_to_next_level, total_points } = dashboardData;
  const userName = user?.name ?? 'User';
  const avatarUrl = user?.avatar_url || ProfileIconKPI;
  const progressPercentage = getProgressPercentage(total_points, points_to_next_level);
  const showProgress = next_level != null && points_to_next_level != null;

  // Use breadcrumbs if provided, otherwise fall back to title
  const displayContent = breadcrumbs ? (
    <div className="kpi-header-bar__breadcrumb">
      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <span className="kpi-header-bar__breadcrumb-separator">
              <ChevronIcon />
            </span>
          )}
          {crumb.path ? (
            <button
              className="kpi-header-bar__breadcrumb-item kpi-header-bar__breadcrumb-item--link"
              onClick={() => navigate(crumb.path)}
            >
              {crumb.label}
            </button>
          ) : (
            <span className="kpi-header-bar__breadcrumb-item kpi-header-bar__breadcrumb-item--current">
              {crumb.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  ) : (
    <div className="kpi-header-bar__title">{title}</div>
  );

  return (
    <div className="kpi-header-bar">
      {onMobileMenuToggle && (
        <button
          className="kpi-header-bar__mobile-menu-toggle"
          onClick={onMobileMenuToggle}
          aria-label="Toggle menu"
        >
          <HamburgerIcon />
        </button>
      )}
      {displayContent}
      {showProgress && (
        <div className="kpi-header-bar__left">
          <div className="kpi-header-bar__progress-section">
            <span
              className="kpi-header-bar__progress-text"
              title={`Level ${next_level} in ${points_to_next_level} points`}
            >
              Level {next_level} in {points_to_next_level} points
            </span>
            <div className="kpi-header-bar__progress-bar">
              <div
                className="kpi-header-bar__progress-fill"
                style={{ width: `${progressPercentage}%` }}
              >
                <div className="kpi-header-bar__star">
                  <StarIcon />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="kpi-header-bar__user" ref={userMenuRef}>
        <button
          type="button"
          className="kpi-header-bar__right"
          aria-haspopup="menu"
          aria-expanded={showUserMenu}
          onClick={() => setShowUserMenu((open) => !open)}
        >
          <div className="kpi-header-bar__greeting">
            <div className="kpi-header-bar__greeting-text">
              Hello, <span className="kpi-header-bar__name">{userName}</span>
            </div>
            {current_level != null && (
              <div className="kpi-header-bar__level-text">Level {current_level}</div>
            )}
          </div>
          <div className="kpi-header-bar__profile">
            <img
              src={avatarUrl}
              alt="Profile"
              className="kpi-header-bar__profile-image"
            />
          </div>
        </button>
        {showUserMenu && (
          <div className="kpi-header-bar__menu" role="menu">
            <button
              type="button"
              role="menuitem"
              className="kpi-header-bar__menu-item"
              onClick={() => handleUserMenuSelect(onMyAccountClick)}
            >
              My Account
            </button>
            <button
              type="button"
              role="menuitem"
              className="kpi-header-bar__menu-item"
              onClick={() => handleUserMenuSelect(onLogoutClick)}
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HeaderBar;

