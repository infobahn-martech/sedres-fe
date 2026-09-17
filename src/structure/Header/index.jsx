import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import "../../design/scss/header.scss";
import {
  FiFolder,
  FiHelpCircle,
  FiBell,
  FiLayout,
  FiGrid,
  FiMoon,
  FiSun,
  FiBarChart2,
  FiShoppingBag,
  FiActivity,
  FiTruck,
  FiNavigation,
  FiSettings,
} from 'react-icons/fi';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';

import logo from '../../assets/images/SedresLogoWhite.png';
import { useBreakpoint } from '../../shared/hooks/useWindowSize';
import useAuthReducer from '../../store/AuthReducer';
import MyAccountsModal from './MyAccountsModal';
import ChangePasswordModal from './ChangePasswordModal';
import LogoutConfirmationModal from '../../components/LogoutConfirmationModal';
import NotificationsModal from './NotificationsModal';
import DocumentsModal from './DocumentsModal';
import AdvancedSearch from './AdvancedSearch';
import BusinessRulesModal from '../SideNav/components/BusinessRulesModal';
import BlockersModal from '../SideNav/components/BlockersModal';
import StickersModal from '../SideNav/components/StickersModal';
import TagsModal from '../SideNav/components/TagsModal';
import TypesModal from '../SideNav/components/TypesModal';
const CallTypeBuilderModal = lazy(() => import('../../pages/CallType/CallTypeBuilderModal'));
const CustomTemplateBuilderModal = lazy(() => import('../../pages/CustomTemplate/CustomTemplateBuilderModal'));
import { useLayoutView } from '../../shared/context/LayoutViewContext';
import { useThemeStore } from '../../shared/store/themeStore';
import NavTabButton from '../../components/NavTabButton';
import { isRestrictedBoardUser, isPortOperatorUser } from '../../shared/helpers/restrictedBoardUser';
import { isVendorRole, getRoleId } from '../../shared/helpers/vendorDashboardRoles';

function Header({ onMenuToggle, mobileMenuOpen: externalMobileMenuOpen, activePortal = null }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();
  const [internalMobileMenuOpen, setInternalMobileMenuOpen] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showMyAccountsModal, setShowMyAccountsModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showSettingsSubmenu, setShowSettingsSubmenu] = useState(false);
  const [showCardManagementSubmenu, setShowCardManagementSubmenu] = useState(false);
  const [showBusinessRulesModal, setShowBusinessRulesModal] = useState(false);
  const [showBlockersModal, setShowBlockersModal] = useState(false);
  const [showStickersModal, setShowStickersModal] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [showTypesModal, setShowTypesModal] = useState(false);
  const [showCallTypeBuilderModal, setShowCallTypeBuilderModal] = useState(false);
  const [showCustomTemplateModal, setShowCustomTemplateModal] = useState(false);
  const { layoutView } = useLayoutView();
  const isDark = useThemeStore((state) => state.isDark);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const [notificationCount] = useState(3); // Default count, can be updated with real data
  const dropdownRef = useRef(null);
  const settingsDropdownRef = useRef(null);
  const doLogout = useAuthReducer((state) => state.doLogout);
  const profileData = useAuthReducer((state) => state.profileData);
  const authData = useAuthReducer((state) => state.authData);
  const userProfile = useAuthReducer((state) => state.userProfile);
  const restrictedBoardUser = isRestrictedBoardUser(userProfile);
  const portOperatorUser = isPortOperatorUser(userProfile);
  const vendorDashboardUser = isVendorRole(getRoleId());
  const userRoleId =
    userProfile?.role_id ||
    userProfile?.roleId ||
    userProfile?.role?.role_id ||
    userProfile?.user?.role_id ||
    userProfile?.data?.role_id;
  const isPortManagerRole = String(userRoleId) === '1';
  const isPortSupervisorRole = String(userRoleId) === '23';
  const showKanbanSettingsIcon =
    !activePortal &&
    !restrictedBoardUser &&
    (isPortManagerRole || isPortSupervisorRole) &&
    (pathname === '/kanban-board/operator' || pathname.startsWith('/kanban-board/') || pathname === '/compact');

  const cardManagementSubmenu = [
    { label: 'Blockers', modal: 'blockers' },
    { label: 'Stickers', modal: 'stickers' },
    { label: 'Tags', modal: 'tags' },
    { label: 'Types', modal: 'types' },
    { label: 'Templates', modal: 'templates' },
    { label: 'Templates List', modal: 'templates list' },
    { label: 'Custom Templates', modal: 'custom templates' },
  ];

  const getLoggedInUser = () => {
    let parsedLocalProfile = {};

    try {
      const rawProfile = localStorage.getItem('userProfile');
      parsedLocalProfile = rawProfile ? JSON.parse(rawProfile) : {};
    } catch {
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

  // Close settings dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(event.target)) {
        setShowSettingsSubmenu(false);
        setShowCardManagementSubmenu(false);
      }
    };

    if (showSettingsSubmenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettingsSubmenu]);

  const handleSettingsBusinessRulesClick = () => {
    setShowSettingsSubmenu(false);
    setShowCardManagementSubmenu(false);
    setShowBusinessRulesModal(true);
  };

  const handleSettingsCardManagementRowClick = (e) => {
    e.stopPropagation();
    const next = !showCardManagementSubmenu;
    setShowCardManagementSubmenu(next);
    if (!next) {
      setShowBlockersModal(false);
      setShowStickersModal(false);
      setShowTagsModal(false);
      setShowTypesModal(false);
    }
  };

  const handleCardManagementSubmenuClick = (item) => {
    setShowCardManagementSubmenu(false);
    setShowSettingsSubmenu(false);

    setShowBlockersModal(false);
    setShowStickersModal(false);
    setShowTagsModal(false);
    setShowTypesModal(false);
    setShowCallTypeBuilderModal(false);
    setShowCustomTemplateModal(false);

    if (item.modal === 'blockers') setShowBlockersModal(true);
    if (item.modal === 'stickers') setShowStickersModal(true);
    if (item.modal === 'tags') setShowTagsModal(true);
    if (item.modal === 'types') setShowTypesModal(true);
    if (item.modal === 'templates') setShowCallTypeBuilderModal(true);
    if (item.modal === 'custom templates') setShowCustomTemplateModal(true);
  };

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
    <>
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

      </div>

      {!restrictedBoardUser && !vendorDashboardUser && <AdvancedSearch />}

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
                {/* <NavTabButton
                  className="icon-btn icon-btn-hide-mobile"
                  active={activePortal === 'vendor'}
                  locked={pathname === '/vendor-portal/dashboard'}
                  aria-label="Vendor Portal"
                  onClick={() => navigate('/vendor-portal/dashboard')}
                  data-tooltip-id="vendor-portal"
                >
                  <FiShoppingBag />
                </NavTabButton> */}
                {/* <Tooltip id="medical-portal" place="bottom" content="Medical" />
                <NavTabButton
                  className="icon-btn icon-btn-hide-mobile"
                  active={activePortal === 'medical'}
                  locked={pathname === '/medical-portal/dashboard'}
                  aria-label="Medical"
                  onClick={() => navigate('/medical-portal/dashboard')}
                  data-tooltip-id="medical-portal"
                >
                  <FiActivity />
                </NavTabButton> */}
                {/* <Tooltip id="transport-portal" place="bottom" content="Transport Company" />
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
                </NavTabButton> */}
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
        {/* <Tooltip id="theme-toggle" place="bottom" content={isDark ? 'Switch to light mode' : 'Switch to dark mode'} />
        <button
          type="button"
          className="icon-btn"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggleTheme}
          data-tooltip-id="theme-toggle"
        >
          {isDark ? <FiSun /> : <FiMoon />}
        </button> */}

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

        {showKanbanSettingsIcon && (
          <div className="settings-btn-wrapper" ref={settingsDropdownRef}>
            <Tooltip id="settings" place="bottom" content="Settings" />
            <button
              type="button"
              className={`icon-btn ${showSettingsSubmenu ? 'active' : ''}`}
              aria-label="Settings"
              onClick={() => setShowSettingsSubmenu((prev) => !prev)}
              data-tooltip-id="settings"
            >
              <FiSettings />
            </button>

            {showSettingsSubmenu && (
              <div className="settings-dropdown">
                <button
                  type="button"
                  className="settings-dropdown-item"
                  onClick={handleSettingsBusinessRulesClick}
                >
                  Business rules
                </button>
                <button
                  type="button"
                  className={`settings-dropdown-item settings-dropdown-item-with-submenu ${showCardManagementSubmenu ? 'submenu-open' : ''}`}
                  onClick={handleSettingsCardManagementRowClick}
                >
                  Card management
                </button>
                {showCardManagementSubmenu && (
                  <div className="settings-submenu">
                    {cardManagementSubmenu.map((subItem, index) => (
                      <button
                        type="button"
                        key={index}
                        className="settings-submenu-item"
                        onClick={() => handleCardManagementSubmenuClick(subItem)}
                      >
                        {subItem.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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

      {/* Settings: Business Rules Modal */}
      {!!showBusinessRulesModal && (
        <BusinessRulesModal show={showBusinessRulesModal} onClose={() => setShowBusinessRulesModal(false)} />
      )}

      {/* Settings: Card Management Modals */}
      {!!showBlockersModal && (
        <BlockersModal show={showBlockersModal} onClose={() => setShowBlockersModal(false)} />
      )}
      {!!showStickersModal && (
        <StickersModal show={showStickersModal} onClose={() => setShowStickersModal(false)} />
      )}
      {!!showTagsModal && (
        <TagsModal show={showTagsModal} onClose={() => setShowTagsModal(false)} />
      )}
      {!!showTypesModal && (
        <TypesModal show={showTypesModal} onClose={() => setShowTypesModal(false)} />
      )}
      {showCallTypeBuilderModal && (
        <Suspense fallback={null}>
          <CallTypeBuilderModal
            show={showCallTypeBuilderModal}
            onClose={() => setShowCallTypeBuilderModal(false)}
          />
        </Suspense>
      )}

      {showCustomTemplateModal && (
        <Suspense fallback={null}>
          <CustomTemplateBuilderModal
            show={showCustomTemplateModal}
            onClose={() => setShowCustomTemplateModal(false)}
          />
        </Suspense>
      )}

    </>
  );
}

export default Header;
