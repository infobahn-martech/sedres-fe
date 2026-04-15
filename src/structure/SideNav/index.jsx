import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import DefaultMenu from './components/DefaultMenu';
import BoardFilterPanel from './components/BoardFilterPanel';
import ManagersModal from './components/ManagersModal';
import DashboardsModal from './components/DashboardsModal';
import BusinessRulesModal from './components/BusinessRulesModal';
import BlockersModal from './components/BlockersModal';
import StickersModal from './components/StickersModal';
import TagsModal from './components/TagsModal';
import TypesModal from './components/TypesModal';
import AddDashboardModal from './components/AddDashboardModal';
import SelectWorkflowModal from './components/SelectWorkflowModal';
import WorkspacesSideNavPanel from './components/WorkspacesSideNavPanel';
import MyAccountsModal from '../Header/MyAccountsModal';
import '../../design/scss/common.scss';
import '../../design/scss/sidebar.scss';

// Existing icons
import dashboardIcon from '../../assets/images/icon-dashboard.svg';
import portIcon from '../../assets/images/icon-prospect.svg';
import workerIcon from '../../assets/images/icon-workers.svg';
import settingsIcon from '../../assets/images/icon-settings.svg';

// New menu-specific icons
import crewIcon from '../../assets/images/icon-crew.svg';
import inspectionIcon from '../../assets/images/icon-inspection.svg';
import hotelIcon from '../../assets/images/icon-hotel.svg';
import wasteIcon from '../../assets/images/icon-waste.svg';
import materialIcon from '../../assets/images/icon-material.svg';
import billingIcon from '../../assets/images/icon-billing.svg';
import usersIcon from '../../assets/images/icon-users.svg';
import configIcon from '../../assets/images/icon-config.svg';

import useWindowSize from '../../hooks/useWindowSize';

// 🆕 Kanban sidebar icons + tooltip
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import { FiPlus, FiInbox, FiFilter, FiPlusCircle, FiActivity } from 'react-icons/fi';
import { useLayoutView } from '../../context/LayoutViewContext';
import useWorkSpaceReducer from '../../store/WorkSpaceReducer';
import { useKanbanSidebarBridge } from '../../store/kanbanSidebarBridge';

function SideNav({ isMobileMenuOpen, onCloseMobileMenu, isVendorPortal = false }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { width } = useWindowSize();
  const createDashboard = useWorkSpaceReducer((s) => s.createDashboard);

  const isKanbanBoard =
    pathname === '/kanban-board' ||
    pathname.startsWith('/kanban-board/') ||
    pathname === '/workspaces' ||
    pathname.startsWith('/workspaces/dashboard') ||
    pathname === '/compact';

  const isWorkspacesShell = pathname === '/workspaces' || pathname.startsWith('/workspaces/dashboard');

  // Vendor Portal menu - simple direct links, no accordions
  const vendorMenus = [
    { menu: 'Dashboard', isDefaultMenu: true, to: '/vendor-portal/dashboard', icon: dashboardIcon, hasPermission: true },
    // { menu: 'Invoices Management', isDefaultMenu: true, to: '/vendor-portal/invoices', icon: billingIcon, hasPermission: true },
    { menu: 'Invoice Management', isDefaultMenu: true, to: '/vendor-portal/orders', icon: materialIcon, hasPermission: true },
  ];
  const isMobile = width <= 991;
  const { layoutView } = useLayoutView();
  const isDarkMode = layoutView === 'dark';

  // 🆕 Kanban icon config - different icons for /kanban-board vs /workspaces
  const kanbanBoardIcons = [
    { id: 1, icon: FiPlus, label: 'Add' },
    // { id: 2, icon: FiFilter, label: 'Filter' },
    // { id: 3, icon: FiActivity, label: 'Analytics' },
  ];

  const workspacesIcons = [
    { id: 4, icon: FiInbox, label: 'Workspaces' },
    { id: 5, icon: FiPlusCircle, label: 'Add new dashboard' },
  ];

  // Board teams submenu items
  const boardTeamsSubmenu = [
    { label: 'Managers', modal: 'managers' },
    { label: 'Dashboards', modal: 'dashboards' },
  ];

  // Card management submenu items
  const cardManagementSubmenu = [
    { label: 'Blockers', modal: 'blockers' },
    { label: 'Stickers', modal: 'stickers' },
    { label: 'Tags', modal: 'tags' },
    { label: 'Types', modal: 'types' },
  ];

  // Select icons based on route
  const kanbanIcons = pathname === '/kanban-board' || pathname.startsWith('/kanban-board/') || pathname === '/compact' ? kanbanBoardIcons : workspacesIcons;

  // 🆕 Active state only for Kanban sidebar
  const [activeKanbanIcon, setActiveKanbanIcon] = useState(2);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showBoardTeamsSubmenu, setShowBoardTeamsSubmenu] = useState(false);
  const [showCardManagementSubmenu, setShowCardManagementSubmenu] = useState(false);
  const [showManagersModal, setShowManagersModal] = useState(false);
  const [showDashboardsModal, setShowDashboardsModal] = useState(false);
  const [showBusinessRulesModal, setShowBusinessRulesModal] = useState(false);
  const [showBlockersModal, setShowBlockersModal] = useState(false);
  const [showStickersModal, setShowStickersModal] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [showTypesModal, setShowTypesModal] = useState(false);
  const [showAddDashboardModal, setShowAddDashboardModal] = useState(false);
  const [showMyAccountsModal, setShowMyAccountsModal] = useState(false);
  const [showSelectWorkflowModal, setShowSelectWorkflowModal] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null);

  const availableWorkflows = useKanbanSidebarBridge((s) => s.boardWorkflows);
  const pendingAddCardFromWorkflowRef = useRef(null);

  const closeSelectWorkflowModal = useCallback(() => {
    pendingAddCardFromWorkflowRef.current = null;
    setShowSelectWorkflowModal(false);
    setSelectedWorkflowId(null);
  }, []);

  const beginSidebarAddCard = useCallback(() => {
    const list = availableWorkflows;
    if (list.length === 0) {
      setSelectedWorkflowId(null);
      setShowSelectWorkflowModal(true);
      return;
    }
    if (list.length === 1) {
      const w = list[0];
      window.dispatchEvent(
        new CustomEvent('kanban:add-card', { detail: { workflowId: w.id, workflowName: w.name } })
      );
      return;
    }
    setSelectedWorkflowId(null);
    setShowSelectWorkflowModal(true);
  }, [availableWorkflows]);

  const handleSelectWorkflowContinue = useCallback(() => {
    const w = availableWorkflows.find(
      (x) => x.id === selectedWorkflowId || String(x.id) === String(selectedWorkflowId)
    );
    if (!w) return;
    pendingAddCardFromWorkflowRef.current = { workflowId: w.id, workflowName: w.name };
    setShowSelectWorkflowModal(false);
    setSelectedWorkflowId(null);
  }, [availableWorkflows, selectedWorkflowId]);

  const handleSelectWorkflowModalExited = useCallback(() => {
    const d = pendingAddCardFromWorkflowRef.current;
    if (!d) return;
    pendingAddCardFromWorkflowRef.current = null;
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('kanban:add-card', { detail: d }));
    });
  }, []);

  const [expand, setExpand] = useState(false);

  // ✅ NEW: arranged sidebar order (as per your screenshot + recommended grouping)
  const menus = [
    {
      menu: 'Dashboard',
      isDefaultMenu: true,
      to: '/dashboard',
      icon: dashboardIcon, // 2x2 grid icon
      hasPermission: true,
    },
    // ✅ Admin + Configuration
    {
      menu: 'User Management',
      isDefaultMenu: true,
      hasPermission: true,
      isOpen: false,
      subMenus: [
        // { menu: 'Roles', to: '/roles', hasPermission: true },
        { menu: 'Users', to: '/users', hasPermission: true },
        { menu: 'Permissions', to: '/permissions', hasPermission: true },
      ],
      icon: usersIcon, // User management-specific icon
    },
    // // ✅ Core Operations
    // {
    //   menu: 'Port Management',
    //   isDefaultMenu: true,
    //   to: '/port-management',
    //   icon: portIcon, // Single human figure with document/badge
    //   hasPermission: true,
    // },
    {
      menu: 'Crew Management',
      isDefaultMenu: true,
      to: '/crew-management',
      icon: crewIcon, // Crew-specific icon
      hasPermission: true,
    },
    {
      menu: 'MWP History',
      isDefaultMenu: true,
      to: '/mwp-history',
      icon: crewIcon, // Crew-specific icon
      hasPermission: true,
    },
    // {
    //   menu: 'Custom Management',
    //   isDefaultMenu: true,
    //   to: '/custom-inspection',
    //   icon: inspectionIcon, // Inspection-specific icon
    //   hasPermission: true,
    // },
    {
      menu: 'Launch Hire Management',
      isDefaultMenu: true,
      hasPermission: true,
      isOpen: false,
      subMenus: [
        { menu: 'Operators', to: '/operators', hasPermission: true },
        { menu: 'Fleet', to: '/fleet', hasPermission: true },
        { menu: 'Captains', to: '/captains', hasPermission: true },
        { menu: 'Services', to: '/lh-services', hasPermission: true },
        // { menu: 'Location', to: '/location', hasPermission: true },
      ],
      icon: workerIcon, // Two stylized human figures
    },
    {
      menu: 'Transport Management',
      isDefaultMenu: true,
      icon: settingsIcon, // Gear/cogwheel icon
      hasPermission: true,
      isOpen: false,
      subMenus: [
        { menu: 'Driver Management', to: '/driver-management', hasPermission: true },
        { menu: 'Vehicle Management', to: '/vehicle-management', hasPermission: true },
        { menu: 'Driver Vehicle Mapping', to: '/driver-vehicle-mapping', hasPermission: true },
        { menu: 'Transport Company', to: '/transport-company', hasPermission: true },

      ],
    },
    {
      menu: 'Hotel Management',
      isDefaultMenu: true,
      to: '/hotel-management',
      icon: hotelIcon, // Hotel-specific icon
      hasPermission: true,
    },
    {
      menu: 'Hospital Management',
      isDefaultMenu: true,
      icon: usersIcon, // Hospital-specific icon
      hasPermission: true,
      subMenus: [
        { menu: 'Hospitals', to: '/hospital-management', hasPermission: true },
        { menu: 'Medical Services', to: '/medical-services', hasPermission: true },
        { menu: 'Hospital Services', to: '/hospital-services', hasPermission: true },
      ],
    },
    // {
    //   menu: 'Third Party Management',
    //   isDefaultMenu: true,
    //   hasPermission: true,
    //   isOpen: false,
    //   subMenus: [
    //     { menu: 'Service Providers', to: '/service-providers', hasPermission: true },
    //     { menu: 'Transport Parties', to: '/transport-parties', hasPermission: true },
    //     { menu: 'Third Party Services', to: '/third-party-service', hasPermission: true },
    //   ],
    //   icon: workerIcon, // Two stylized human figures
    // },
    {
      menu: 'Third Party Management',
      isDefaultMenu: true,
      to: '/third-party-service',
      icon: workerIcon, // Third Party Services-specific icon
      hasPermission: true,
    },
    {
      menu: 'Waste Management',
      isDefaultMenu: true,
      hasPermission: true,
      isOpen: false,
      subMenus: [{ menu: 'Waste Types', to: '/waste-types', hasPermission: true }],
      icon: wasteIcon, // Waste-specific icon
    },
    // ✅ Materials & Logistics
    {
      menu: 'Material Management',
      isDefaultMenu: true,
      icon: materialIcon, // Material-specific icon
      hasPermission: true,
      isOpen: false,
      subMenus: [
        { menu: 'Material Types', to: '/material-type', hasPermission: true },
        { menu: 'Packing Types', to: '/packing-type', hasPermission: true },
        { menu: 'Logistics Warehouses', to: '/logistics-warehouse', hasPermission: true },
      ],
    },
    // ✅ Finance
    {
      menu: 'Entity Management',
      isDefaultMenu: true,
      hasPermission: true,
      isOpen: false,
      subMenus: [
        { menu: 'Vessel Management', to: '/vessel-onboarding', hasPermission: true },
        { menu: 'Group Email', to: '/group-email', hasPermission: true },
        { menu: 'Billing Entity', to: '/billing-entity', hasPermission: true },
        { menu: 'Billing Instruction', to: '/billing-instruction', hasPermission: true },
        // { menu: 'Job Status', to: '/job-status', hasPermission: true },
        { menu: 'Customer Pricing', to: '/customer-pricing', hasPermission: true },
      ],
      icon: billingIcon, // Billing-specific icon
    },
    {
      menu: 'Operations Configuration',
      isDefaultMenu: true,
      hasPermission: true,
      isOpen: false,
      subMenus: [
        { menu: 'Appointment Acceptance', to: '/appointment-acceptance', hasPermission: true },
        { menu: 'Pre-Arrival Information', to: '/pre-arrival-information', hasPermission: true },
        { menu: 'Crew Template', to: '/crew-template', hasPermission: true },
        // { menu: 'Custom Fields', to: '/custom-fields', hasPermission: true },
      ],
      icon: configIcon, // Configuration-specific icon
    },
    {
      menu: 'Checklist Management',
      isDefaultMenu: true,
      hasPermission: true,
      isOpen: false,
      subMenus: [
        { menu: 'Vessel Types', to: '/vessel-types', hasPermission: true },
        { menu: 'Barge Types', to: '/barge-types', hasPermission: true },
        { menu: 'Checklist', to: '/check-list', hasPermission: true },
      ],
      icon: workerIcon, // Two stylized human figures
    },
    {
      menu: 'KPI Management',
      isDefaultMenu: true,
      hasPermission: true,
      isOpen: false,
      subMenus: [
        { menu: 'Tasks', to: '/tasks', hasPermission: true },
        { menu: 'Dashboard', to: '/kpi-dashboard', hasPermission: true },
      ],
      icon: workerIcon, // Two stylized human figures
    },
    // ✅ Settings (last)
    {
      menu: 'Settings',
      isDefaultMenu: true,
      icon: settingsIcon,
      hasPermission: true,
      isOpen: false,
      subMenus: [
        { menu: 'My Accounts', to: '/my-accounts', hasPermission: true },
        { menu: 'Activity Log', to: '/activity-log', hasPermission: true },
        // { menu: 'Notification', to: '/notification', hasPermission: true },
        // { menu: 'Report Management', to: '/report-management', hasPermission: true },
        // { menu: 'Status Management', to: '/status-management', hasPermission: true },
      ],
    },
  ];

  const [menuState, setMenuState] = useState(menus);

  // Sync with Header's mobile menu state
  useEffect(() => {
    if (isMobileMenuOpen !== undefined) {
      setExpand(isMobileMenuOpen);
    }
  }, [isMobileMenuOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    if (isMobile && expand && onCloseMobileMenu) {
      setExpand(false);
      onCloseMobileMenu();
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close mobile menu when clicking outside
  useEffect(() => {
    if (isMobile && expand && onCloseMobileMenu) {
      const handleClickOutside = (e) => {
        const sidebar = document.querySelector('.sidebar');
        const headerToggle = document.querySelector('.mobile-menu-toggle');
        if (sidebar && !sidebar.contains(e.target) && !headerToggle?.contains(e.target)) {
          setExpand(false);
          onCloseMobileMenu();
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMobile, expand, onCloseMobileMenu]);

  useEffect(() => {
    // 🔒 Don’t touch normal menu behaviour when on Kanban sidebar
    if (isKanbanBoard || isVendorPortal) return;

    if (width > 991)
      setMenuState((prev) =>
        prev.map((e) => ({
          ...e,
          // Only open the menu whose submenu matches the current route, close all others
          isOpen: e?.subMenus && e.subMenus.some((eS) => eS?.to === pathname) ? true : false,
        }))
      );
    else {
      setMenuState((prev) => prev.map((e) => ({ ...e, isOpen: false })));
      setExpand(false);
    }
  }, [pathname, width, isKanbanBoard, isVendorPortal]);

  const toggleCollapse = (menu) => {
    setMenuState((prev) => {
      const clickedMenu = prev.find((e) => e.menu === menu);
      const willBeOpen = clickedMenu
        ? width < 991 && !expand
          ? true
          : !clickedMenu.isOpen
        : false;

      // Close all other menus when opening a menu
      return prev.map((e) => ({
        ...e,
        isOpen: e.menu === menu ? willBeOpen : false,
      }));
    });
    if (width < 991) {
      setExpand(!expand);
      if (onCloseMobileMenu && expand) {
        onCloseMobileMenu();
      }
    }
  };

  const handleSubmenuClickDefault = (subMenu) => {
    if (subMenu === 'My Accounts') {
      setShowMyAccountsModal(true);
      if (isMobile && expand && onCloseMobileMenu) {
        setExpand(false);
        onCloseMobileMenu();
      }
      return true;
    }
    return false;
  };

  const handleToggle = () => {
    const newExpand = !expand;
    setExpand(newExpand);
    if (onCloseMobileMenu) {
      if (!newExpand) onCloseMobileMenu();
    }
  };

  // Set active icon based on current route
  useEffect(() => {
    if (isKanbanBoard) {
      if (pathname === '/workspaces') {
        setActiveKanbanIcon(4);
      } else if (pathname.includes('/analytics')) {
        setActiveKanbanIcon(3);
      } else if (pathname === '/kanban-board' || pathname.startsWith('/kanban-board/') || pathname === '/compact') {
        setActiveKanbanIcon(1);
      }
    }
  }, [pathname, isKanbanBoard]);

  // Add/remove class to body when submenu is open
  useEffect(() => {
    if (showBoardTeamsSubmenu || showCardManagementSubmenu) {
      document.body.classList.add('board-teams-submenu-open');
    } else {
      document.body.classList.remove('board-teams-submenu-open');
    }
    return () => {
      document.body.classList.remove('board-teams-submenu-open');
    };
  }, [showBoardTeamsSubmenu, showCardManagementSubmenu]);

  // Close submenu when clicking outside (board teams)
  useEffect(() => {
    if (showBoardTeamsSubmenu) {
      const handleClickOutside = (event) => {
        const sidebar = document.querySelector('.kanban-sidebar');
        const submenu = document.querySelector('.kanban-sidebar-submenu');
        if (sidebar && !sidebar.contains(event.target) && submenu && !submenu.contains(event.target)) {
          setShowBoardTeamsSubmenu(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showBoardTeamsSubmenu]);

  // Close submenu when clicking outside (card management)
  useEffect(() => {
    if (showCardManagementSubmenu) {
      const handleClickOutside = (event) => {
        const sidebar = document.querySelector('.kanban-sidebar');
        const submenu = document.querySelector('.card-management-submenu');
        if (sidebar && !sidebar.contains(event.target) && submenu && !submenu.contains(event.target)) {
          setShowCardManagementSubmenu(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCardManagementSubmenu]);

  // 🆕 Special layout for /kanban-board and /workspaces (skip when in Vendor Portal)
  if (isKanbanBoard && !isVendorPortal && isWorkspacesShell) {
    return (
      <>
        <WorkspacesSideNavPanel isDarkMode={isDarkMode} onNewDashboard={() => setShowAddDashboardModal(true)} />
        <BoardFilterPanel show={showFilterPanel} onClose={() => setShowFilterPanel(false)} />
        <ManagersModal show={showManagersModal} onClose={() => setShowManagersModal(false)} />
        <DashboardsModal show={showDashboardsModal} onClose={() => setShowDashboardsModal(false)} />
        <BusinessRulesModal show={showBusinessRulesModal} onClose={() => setShowBusinessRulesModal(false)} />
        <BlockersModal show={showBlockersModal} onClose={() => setShowBlockersModal(false)} />
        <StickersModal show={showStickersModal} onClose={() => setShowStickersModal(false)} />
        <TagsModal show={showTagsModal} onClose={() => setShowTagsModal(false)} />
        <TypesModal show={showTypesModal} onClose={() => setShowTypesModal(false)} />
        <AddDashboardModal
          show={showAddDashboardModal}
          onClose={() => setShowAddDashboardModal(false)}
          onSave={(data) => {
            createDashboard({
              dashboard_name: data.name,
              cb: (newId) => {
                setShowAddDashboardModal(false);
                if (newId) navigate(`/workspaces/dashboard/${newId}`);
              },
            });
          }}
        />
      </>
    );
  }

  if (isKanbanBoard && !isVendorPortal) {
    const handleIconClick = (item) => {
      if (item.label === 'Filter') {
        const newShowState = !showFilterPanel;
        closeSelectWorkflowModal();
        setShowFilterPanel(newShowState);
        setShowBoardTeamsSubmenu(false);
        setShowCardManagementSubmenu(false);
        if (newShowState) setActiveKanbanIcon(item.id);
        return;
      }

      if (item.label === 'Analytics') {
        closeSelectWorkflowModal();
        // Extract board ID from pathname if available
        const boardIdMatch = pathname.match(/\/kanban-board\/(\d+)/);
        const boardId = boardIdMatch ? boardIdMatch[1] : '';
        navigate(`/kanban-board/${boardId ? `${boardId}/` : ''}analytics`);
        setActiveKanbanIcon(item.id);
        setShowFilterPanel(false);
        setShowBoardTeamsSubmenu(false);
        setShowCardManagementSubmenu(false);
        return;
      }

      if (item.label === 'Board teams') {
        const newShowState = !showBoardTeamsSubmenu;
        closeSelectWorkflowModal();
        setShowBoardTeamsSubmenu(newShowState);
        setShowFilterPanel(false);
        setShowBusinessRulesModal(false);
        setShowCardManagementSubmenu(false);
        if (newShowState) setActiveKanbanIcon(item.id);
        return;
      }

      if (item.label === 'Business rules') {
        closeSelectWorkflowModal();
        setShowBusinessRulesModal(true);
        setShowFilterPanel(false);
        setShowBoardTeamsSubmenu(false);
        setShowCardManagementSubmenu(false);
        setActiveKanbanIcon(item.id);
        return;
      }

      if (item.label === 'Card management') {
        const newShowState = !showCardManagementSubmenu;
        closeSelectWorkflowModal();
        setShowCardManagementSubmenu(newShowState);
        setShowFilterPanel(false);
        setShowBoardTeamsSubmenu(false);
        setShowBusinessRulesModal(false);
        setShowBlockersModal(false);
        setShowStickersModal(false);
        setShowTagsModal(false);
        setShowTypesModal(false);
        if (newShowState) setActiveKanbanIcon(item.id);
        return;
      }

      if (showFilterPanel) setShowFilterPanel(false);
      if (showBoardTeamsSubmenu) setShowBoardTeamsSubmenu(false);
      if (showCardManagementSubmenu) setShowCardManagementSubmenu(false);
      if (showBusinessRulesModal) setShowBusinessRulesModal(false);
      if (showBlockersModal) setShowBlockersModal(false);
      if (showStickersModal) setShowStickersModal(false);
      if (showTagsModal) setShowTagsModal(false);
      if (showTypesModal) setShowTypesModal(false);
      if (showAddDashboardModal) setShowAddDashboardModal(false);
      if (item.label !== 'Add') {
        closeSelectWorkflowModal();
      }

      setActiveKanbanIcon(item.id);

      if (item.label === 'Add') {
        beginSidebarAddCard();
      }

      if (item.label === 'Add new dashboard') {
        setShowAddDashboardModal(true);
        setShowFilterPanel(false);
        setShowBoardTeamsSubmenu(false);
        setShowCardManagementSubmenu(false);
        setActiveKanbanIcon(item.id);
        return;
      }

      if (item.label === 'Workspaces') {
        navigate('/workspaces');
      } else if (pathname === '/workspaces' && item.label !== 'Workspaces') {
        navigate('/kanban-board');
        window.dispatchEvent(new CustomEvent('kanban:hide-workspaces', { detail: { activeIcon: item.id } }));
      } else {
        window.dispatchEvent(new CustomEvent('kanban:hide-workspaces', { detail: { activeIcon: item.id } }));
      }
    };

    const handleSubmenuClickKanban = (item) => {
      setShowBoardTeamsSubmenu(false);
      if (item.modal === 'managers') setShowManagersModal(true);
      else if (item.modal === 'dashboards') setShowDashboardsModal(true);
    };

    const handleCardManagementSubmenuClick = (item) => {
      setShowCardManagementSubmenu(false);

      setShowFilterPanel(false);
      setShowBoardTeamsSubmenu(false);
      setShowBusinessRulesModal(false);

      setShowBlockersModal(false);
      setShowStickersModal(false);
      setShowTagsModal(false);
      setShowTypesModal(false);

      if (item.modal === 'blockers') setShowBlockersModal(true);
      if (item.modal === 'stickers') setShowStickersModal(true);
      if (item.modal === 'tags') setShowTagsModal(true);
      if (item.modal === 'types') setShowTypesModal(true);
    };

    return (
      <>
        <aside className={`kanban-sidebar ${isDarkMode ? 'kanban-sidebar-dark' : ''}`}>
          {kanbanIcons.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeKanbanIcon === item.id ||
              (item.label === 'Filter' && showFilterPanel) ||
              (item.label === 'Analytics' && pathname.includes('/analytics')) ||
              (item.label === 'Board teams' && showBoardTeamsSubmenu) ||
              (item.label === 'Business rules' && showBusinessRulesModal) ||
              (item.label === 'Card management' && showCardManagementSubmenu) ||
              (item.label === 'Add new dashboard' && showAddDashboardModal) ||
              (item.label === 'Add' && showSelectWorkflowModal);

            return (
              <div key={item.id} style={{ position: 'relative' }}>
                <div
                  className={`kanban-sidebar-icon ${isActive ? 'active' : ''}`}
                  onClick={() => handleIconClick(item)}
                  data-tooltip-id="sidebar-tooltip"
                  data-tooltip-content={item.label}
                >
                  <Icon size={22} />
                </div>

                {item.label === 'Board teams' && showBoardTeamsSubmenu && (
                  <div className="kanban-sidebar-submenu">
                    {boardTeamsSubmenu.map((subItem, index) => (
                      <div
                        key={index}
                        className="kanban-sidebar-submenu-item"
                        onClick={() => handleSubmenuClickKanban(subItem)}
                      >
                        {subItem.label}
                      </div>
                    ))}
                  </div>
                )}

                {item.label === 'Card management' && showCardManagementSubmenu && (
                  <div className="kanban-sidebar-submenu card-management-submenu">
                    {cardManagementSubmenu.map((subItem, index) => (
                      <div
                        key={index}
                        className="kanban-sidebar-submenu-item"
                        onClick={() => handleCardManagementSubmenuClick(subItem)}
                      >
                        {subItem.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <Tooltip
            id="sidebar-tooltip"
            place="right"
            style={{
              backgroundColor: '#333',
              color: '#fff',
              fontSize: '0.85rem',
              borderRadius: '6px',
              padding: '6px 10px',
              fontWeight: '500',
            }}
          />
        </aside>

        <BoardFilterPanel show={showFilterPanel} onClose={() => setShowFilterPanel(false)} />
        <ManagersModal show={showManagersModal} onClose={() => setShowManagersModal(false)} />
        <DashboardsModal show={showDashboardsModal} onClose={() => setShowDashboardsModal(false)} />
        <BusinessRulesModal show={showBusinessRulesModal} onClose={() => setShowBusinessRulesModal(false)} />
        <BlockersModal show={showBlockersModal} onClose={() => setShowBlockersModal(false)} />
        <StickersModal show={showStickersModal} onClose={() => setShowStickersModal(false)} />
        <TagsModal show={showTagsModal} onClose={() => setShowTagsModal(false)} />
        <TypesModal show={showTypesModal} onClose={() => setShowTypesModal(false)} />
        <AddDashboardModal
          show={showAddDashboardModal}
          onClose={() => setShowAddDashboardModal(false)}
          onSave={(data) => {
            createDashboard({
              dashboard_name: data.name,
              cb: (newId) => {
                setShowAddDashboardModal(false);
                if (newId) navigate(`/workspaces/dashboard/${newId}`);
              },
            });
          }}
        />
        <SelectWorkflowModal
          show={showSelectWorkflowModal}
          workflows={availableWorkflows}
          selectedWorkflowId={selectedWorkflowId}
          onSelectWorkflowId={setSelectedWorkflowId}
          onClose={closeSelectWorkflowModal}
          onContinue={handleSelectWorkflowContinue}
          onExited={handleSelectWorkflowModalExited}
        />
      </>
    );
  }

  // 🔵 Default sidebar (all other routes)
  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && expand && (
        <div
          className="sidebar-overlay"
          onClick={() => {
            setExpand(false);
            if (onCloseMobileMenu) onCloseMobileMenu();
          }}
        />
      )}

      <div className={`sidebar ${expand ? 'show' : ''} ${isMobile ? 'mobile' : ''}`}>
        <div className="st-wrp">
          <button
            type="button"
            onClick={handleToggle}
            className="sidebar-toggle"
            aria-label="Toggle sidebar"
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        <div className="menuWrp">
          <ul className="menu">
            {(isVendorPortal ? vendorMenus : menuState)
              .filter((e) => e.hasPermission === true)
              .map(({ menu, subMenus, to, isDefaultMenu, icon, isOpen }) => {
                if (!isDefaultMenu) return null;
                return (
                  <DefaultMenu
                    menu={menu}
                    subMenus={subMenus}
                    to={to}
                    key={menu}
                    icon={icon}
                    isOpen={isOpen}
                    toggleCollapse={toggleCollapse}
                    onSubmenuClick={handleSubmenuClickDefault}
                  />
                );
              })}
          </ul>
        </div>

        <div className="toggleDark" />
      </div>

      {/* My Accounts Modal */}
      <MyAccountsModal show={showMyAccountsModal} onClose={() => setShowMyAccountsModal(false)} />
    </>
  );
}

export default SideNav;
