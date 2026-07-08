import { useState, useEffect, useRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import "../../design/scss/header.scss";
import {
  FiFolder,
  FiHelpCircle,
  FiBell,
  FiLayout,
  FiGrid,
  FiMenu,
  FiSquare,
  FiLayers,
  FiMoon,
  FiBarChart2,
  FiShoppingBag,
  FiActivity,
  FiTruck,
  FiNavigation,
} from 'react-icons/fi';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';

import logo from '../../assets/images/SedresLogoWhite.png';
import useWindowSize from '../../shared/hooks/useWindowSize';
import useAuthReducer from '../../store/AuthReducer';
import MyAccountsModal from './MyAccountsModal';
import ChangePasswordModal from './ChangePasswordModal';
import LogoutConfirmationModal from '../../components/LogoutConfirmationModal';
import NotificationsModal from './NotificationsModal';
import DocumentsModal from './DocumentsModal';
import { useLayoutView } from '../../shared/context/LayoutViewContext';
import NavTabButton from '../../components/NavTabButton';
import { isRestrictedBoardUser, isPortOperatorUser } from '../../shared/helpers/restrictedBoardUser';
import { isVendorRole, getRoleId } from '../../shared/helpers/vendorDashboardRoles';

function Header({ onMenuToggle, mobileMenuOpen: externalMobileMenuOpen, activePortal = null }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { width } = useWindowSize();
  const [internalMobileMenuOpen, setInternalMobileMenuOpen] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showMyAccountsModal, setShowMyAccountsModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { layoutView, setLayoutView } = useLayoutView();
  const [notificationCount, setNotificationCount] = useState(3); // Default count, can be updated with real data
  const dropdownRef = useRef(null);
  const isMobile = width <= 991;
  const doLogout = useAuthReducer((state) => state.doLogout);
  const profileData = useAuthReducer((state) => state.profileData);
  const authData = useAuthReducer((state) => state.authData);
  const userProfile = useAuthReducer((state) => state.userProfile);
  const restrictedBoardUser = isRestrictedBoardUser(userProfile);
  const portOperatorUser = isPortOperatorUser(userProfile);
  const vendorDashboardUser = isVendorRole(getRoleId());

  const getLoggedInUser = () => {
    let parsedLocalProfile = {};

    try {
      const rawProfile = localStorage.getItem('userProfile');
      parsedLocalProfile = rawProfile ? JSON.parse(rawProfile) : {};
    } catch (error) {
      parsedLocalProfile = {};
    }

    const localStorageFallback = {
      name: localStorage.getItem('userName') || '',
      email: localStorage.getItem('userEmail') || '',
      userid: localStorage.getItem('userid') || '',
    };

    return {
      ...localStorageFallback,
      ...(parsedLocalProfile || {}),
      ...(authData || {}),
      ...(profileData || {}),
      ...(userProfile || {}),
    };
  };

  const resolvedUser = getLoggedInUser();
  const resolvedUserName = resolvedUser?.name || resolvedUser?.firstName || '';

  const getUserInitial = () => {
    const name = resolvedUser?.name || resolvedUser?.firstName || '';

    if (name) {
      return name.charAt(0).toUpperCase();
    }

    const email = resolvedUser?.email || '';
    if (email) {
      return email.charAt(0).toUpperCase();
    }

    return 'U';
  };

  const getUserAvatar = () => {
    return (
      resolvedUser?.image ||
      resolvedUser?.avatar ||
      resolvedUser?.profile_image ||
      resolvedUser?.profilePhoto ||
      resolvedUser?.photo_url ||
      ''
    );
  };
  const resolvedAvatar = getUserAvatar();
  const resolvedInitial = getUserInitial();

  // Use external state if provided, otherwise use internal state
  const mobileMenuOpen = externalMobileMenuOpen !== undefined
    ? externalMobileMenuOpen
    : internalMobileMenuOpen;
  const handleMenuToggle = () => {
    const newState = !mobileMenuOpen;
    if (externalMobileMenuOpen === undefined) {
      setInternalMobileMenuOpen(newState);
    }
    if (onMenuToggle) {
      onMenuToggle(newState);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowUserDropdown(false);
      }
    };

    if (showUserDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserDropdown]);

  const handleUserCircleClick = () => {
    setShowUserDropdown(!showUserDropdown);
  };

  const handleMyAccountsClick = () => {
    setShowUserDropdown(false);
    setShowMyAccountsModal(true);
  };

  const handleChangePasswordClick = () => {
    setShowUserDropdown(false);
    setShowChangePasswordModal(true);
  };

  const handleLogoutClick = () => {
    setShowUserDropdown(false);
    setShowLogoutModal(true);
  };

  const handleLogoutConfirm = () => {
    setShowLogoutModal(false);
    doLogout();
    navigate('/');
  };

  const handleHelpClick = () => {
    window.open("https://sedres.com/contact-us", "_blank", "noopener,noreferrer");
  };

  // Apply dark mode to body for header/sidebar/scroll styling
  useEffect(() => {
    if (layoutView === 'dark') {
      document.body.classList.add('app-dark-mode');
    } else {
      document.body.classList.remove('app-dark-mode');
    }
    return () => document.body.classList.remove('app-dark-mode');
  }, [layoutView]);

  useEffect(() => {
    setImageError(false);
  }, [resolvedAvatar]);

  return (
    <div className={`sedres-header ${layoutView === 'dark' ? 'sedres-header-dark' : ''}`}>

      {/* LEFT — LOGO + NAV LINKS */}
      <div className="left-section">
        {/* Mobile Menu Toggle Button */}
        {isMobile && !restrictedBoardUser && (
          <>
            <Tooltip id="mobile-menu-toggle" place="bottom" content="Toggle menu" />
            <button
              className={`mobile-menu-toggle ${mobileMenuOpen ? 'active' : ''}`}
              onClick={handleMenuToggle}
              aria-label="Toggle menu"
              data-tooltip-id="mobile-menu-toggle"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </>
        )}

        <img
          src={logo}
          alt="Sedres Logo"
          className="sedres-logo"
          onClick={() => navigate('/workspaces')}
          style={{ cursor: 'pointer' }}
        />

        {!restrictedBoardUser && (pathname === '/kanban-board/operator' || pathname === '/compact') && (
          <div className="top-links">
            <div className="layout-view-toggle">
              {/* <span className="layout-view-label">Layout View:</span> */}
              <div className="layout-view-switch">
                <NavTabButton
                  className="layout-view-option"
                  active={layoutView === 'classic'}
                  onClick={() => { setLayoutView('classic'); pathname === '/compact' && navigate('/kanban-board/operator'); }}
                  aria-pressed={layoutView === 'classic'}
                >
                  <FiMenu className="layout-view-icon" aria-hidden />
                  Classic
                </NavTabButton>
                <NavTabButton
                  className="layout-view-option"
                  active={layoutView === 'modern'}
                  onClick={() => { setLayoutView('modern'); pathname === '/compact' && navigate('/kanban-board/operator'); }}
                  aria-pressed={layoutView === 'modern'}
                >
                  <FiGrid className="layout-view-icon" aria-hidden />
                  Modern
                </NavTabButton>
                <NavTabButton
                  className="layout-view-option"
                  active={layoutView === 'normal'}
                  onClick={() => { setLayoutView('normal'); pathname === '/compact' && navigate('/kanban-board/operator'); }}
                  aria-pressed={layoutView === 'normal'}
                >
                  <FiSquare className="layout-view-icon" aria-hidden />
                  Normal
                </NavTabButton>
                {/* <button
                  type="button"
                  className={`layout-view-option ${pathname === '/compact' ? 'active' : ''}`}
                  onClick={() => navigate('/compact')}
                  aria-pressed={pathname === '/compact'}
                >
                  <FiLayers className="layout-view-icon" aria-hidden />
                  Compact
                </button> */}
                <NavTabButton
                  className="layout-view-option"
                  active={layoutView === 'dark'}
                  onClick={() => { setLayoutView('dark'); pathname === '/compact' && navigate('/kanban-board/operator'); }}
                  aria-pressed={layoutView === 'dark'}
                >
                  <FiMoon className="layout-view-icon" aria-hidden />
                  Dark
                </NavTabButton>
              </div>
            </div>
          </div>
        )}


      </div>

      {/* RIGHT — User + Icons (GRO / Custom Clearance / vendor-dashboard roles skip module shortcuts; still show help, alerts, profile) */}
      <div className="right-section">
        {!restrictedBoardUser && !vendorDashboardUser && (
          <>
            {!portOperatorUser && (
              <>
                <Tooltip id="master-module" place="bottom" content="Master Module" />
                <NavTabButton
                  className="icon-btn icon-btn-hide-mobile"
                  active={!activePortal}
                  locked={pathname === '/dashboard'}
                  aria-label="Master Module"
                  onClick={() => navigate('/dashboard')}
                  data-tooltip-id="master-module"
                >
                  <FiLayout />
                </NavTabButton>
                <Tooltip id="vendor-portal" place="bottom" content="Vendor Portal" />
                <NavTabButton
                  className="icon-btn icon-btn-hide-mobile"
                  active={activePortal === 'vendor'}
                  locked={pathname === '/vendor-portal/dashboard'}
                  aria-label="Vendor Portal"
                  onClick={() => navigate('/vendor-portal/dashboard')}
                  data-tooltip-id="vendor-portal"
                >
                  <FiShoppingBag />
                </NavTabButton>
                <Tooltip id="medical-portal" place="bottom" content="Medical" />
                <NavTabButton
                  className="icon-btn icon-btn-hide-mobile"
                  active={activePortal === 'medical'}
                  locked={pathname === '/medical-portal/dashboard'}
                  aria-label="Medical"
                  onClick={() => navigate('/medical-portal/dashboard')}
                  data-tooltip-id="medical-portal"
                >
                  <FiActivity />
                </NavTabButton>
                <Tooltip id="transport-portal" place="bottom" content="Transport Company" />
                <NavTabButton
                  className="icon-btn icon-btn-hide-mobile"
                  active={activePortal === 'transport'}
                  locked={pathname === '/transport-portal/dashboard'}
                  aria-label="Transport Company"
                  onClick={() => navigate('/transport-portal/dashboard')}
                  data-tooltip-id="transport-portal"
                >
                  <FiTruck />
                </NavTabButton>
                <Tooltip id="inhouse-driver-portal" place="bottom" content="Inhouse Driver" />
                <NavTabButton
                  className="icon-btn icon-btn-hide-mobile"
                  active={activePortal === 'inhouse-driver'}
                  locked={pathname === '/inhouse-driver/dashboard'}
                  aria-label="Inhouse Driver"
                  onClick={() => navigate('/inhouse-driver/dashboard')}
                  data-tooltip-id="inhouse-driver-portal"
                >
                  <FiNavigation />
                </NavTabButton>
              </>
            )}
            {/* <Tooltip id="board" place="bottom" content="Board" />
            <NavTabButton
              className="icon-btn icon-btn-hide-mobile"
              active={pathname === '/kanban-board/operator'}
              aria-label="Board"
              onClick={handleKanbanBoardClick}
              disabled={kanbanBoardLoading}
              data-tooltip-id="board"
            >
              <FiGrid />
            </NavTabButton> */}
            <Tooltip id="kpi-dashboard" place="bottom" content="KPI Dashboard" />
            <NavTabButton
              className="icon-btn icon-btn-hide-mobile"
              active={pathname === '/kpi-dashboard'}
              aria-label="KPI Dashboard"
              onClick={() => navigate('/kpi-dashboard')}
              data-tooltip-id="kpi-dashboard"
            >
              <FiBarChart2 />
            </NavTabButton>
            {/* <Tooltip id="documents" place="bottom" content="Documents" />
            <button
              className={`icon-btn icon-btn-hide-mobile ${showDocumentsModal ? 'active' : ''}`}
              aria-label="Documents"
              onClick={() => setShowDocumentsModal(true)}
              data-tooltip-id="documents"
            >
              <FiFolder />
            </button> */}
          </>
        )}
        <Tooltip id="help" place="bottom" content="Help" />
        <button
          className="icon-btn icon-btn-hide-mobile"
          aria-label="Help"
          onClick={handleHelpClick}
          data-tooltip-id="help"
        >
          <FiHelpCircle />
        </button>

        <div className="notification-btn-wrapper">
          <Tooltip id="notifications" place="bottom" content="Notifications" />
          <button
            className={`icon-btn ${showNotificationsModal ? 'active' : ''}`}
            aria-label="Notifications"
            onClick={() => setShowNotificationsModal(true)}
            data-tooltip-id="notifications"
          >
            <FiBell />
          </button>
          {notificationCount > 0 && (
            <span className="notification-badge">{notificationCount > 99 ? '99+' : notificationCount}</span>
          )}
        </div>
        <Tooltip id="user-profile" place="bottom" content="User Profile" />
        <div className="user-circle-wrapper" ref={dropdownRef}>
          <div
            className={`user-circle ${showUserDropdown ? 'active' : ''}`}
            onClick={handleUserCircleClick}
            data-tooltip-id="user-profile"
          >
            {resolvedAvatar && !imageError ? (
              <img
                src={resolvedAvatar}
                alt={resolvedUserName || 'User'}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  objectFit: 'cover'
                }}
                onError={() => setImageError(true)}
              />
            ) : (
              <span className="user-letter">{resolvedInitial}</span>
            )}
          </div>

          {showUserDropdown && (
            <div className="user-dropdown">
              <button
                className="dropdown-item"
                onClick={handleMyAccountsClick}
              >
                My Account
              </button>
              <button
                className="dropdown-item"
                onClick={handleChangePasswordClick}
              >
                Change Password
              </button>
              <button
                className="dropdown-item"
                onClick={handleLogoutClick}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* My Accounts Modal */}
      {!!showMyAccountsModal && (
        <MyAccountsModal
          show={showMyAccountsModal}
          onClose={() => setShowMyAccountsModal(false)}
        />
      )}

      {/* Change Password Modal */}
      {!!showChangePasswordModal && (
        <ChangePasswordModal
          show={showChangePasswordModal}
          onClose={() => setShowChangePasswordModal(false)}
        />
      )}

      {/* Logout Confirmation Modal */}
      {!!showLogoutModal && (
        <LogoutConfirmationModal
          show={showLogoutModal}
          onCancel={() => setShowLogoutModal(false)}
          onConfirm={handleLogoutConfirm}
          logoutText="Are you sure you want to logout?"
        />
      )}

      {/* Notifications Modal */}
      {!!showNotificationsModal && (
        <NotificationsModal
          show={showNotificationsModal}
          onClose={() => setShowNotificationsModal(false)}
        />
      )}

      {/* Documents Modal */}
      {!!showDocumentsModal && <DocumentsModal
        show={showDocumentsModal}
        onClose={() => setShowDocumentsModal(false)}
      />}

    </div>
  );
}

export default Header;
