import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import OnStationModal from '../Header/OnStationModal';
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

import useWindowSize from '../../shared/hooks/useWindowSize';
import {
  buildKanbanAddCardEventDetail,
  getSwimlaneOptionsFromWorkflow,
  resolveSidebarAddCardAction,
} from '../../shared/helpers/kanbanAddWorkflowSelection';

// 🆕 Kanban sidebar icons + tooltip
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import { FiPlus, FiInbox, FiFilter, FiPlusCircle, FiActivity, FiLayout, FiMail, FiSettings, FiEdit3, FiMapPin } from 'react-icons/fi';
import { useLayoutView } from '../../shared/context/LayoutViewContext';
import useWorkSpaceReducer from '../../store/WorkSpaceReducer';
import useAuthReducer from '../../store/AuthReducer';
import { useKanbanSidebarBridge } from '../../store/kanbanSidebarBridge';
import { ROUTE_PATHS } from '../../router/paths';
import {
  hasKanbanFullSidebar,
  isRestrictedBoardUser,
  RESTRICTED_BOARD_HOME_PATH,
} from '../../shared/helpers/restrictedBoardUser';

function SideNav({ isMobileMenuOpen, onCloseMobileMenu, isVendorPortal = false }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { width } = useWindowSize();
  const createDashboard = useWorkSpaceReducer((s) => s.createDashboard);

  const isKanbanBoard =
    pathname === '/kanban-board/operator' ||
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
  const userProfile = useAuthReducer((state) => state.userProfile);
  const userRoleId =
    userProfile?.role_id ||
    userProfile?.roleId ||
    userProfile?.role?.role_id ||
    userProfile?.user?.role_id ||
    userProfile?.data?.role_id;
  const isPortManagerRole = String(userRoleId) === '1';
  const restrictedNav = isRestrictedBoardUser(userProfile);
  const kanbanFullSidebar = hasKanbanFullSidebar(userProfile);

  const boardRouteMatchForEditWorkflow = pathname.match(/^\/kanban-board\/([^/]+)$/);
  const kanbanBoardIdForEditWorkflow = boardRouteMatchForEditWorkflow?.[1] ?? null;
  const showEditWorkflowSidebarIcon =
    Boolean(kanbanBoardIdForEditWorkflow) &&
    String(kanbanBoardIdForEditWorkflow).toLowerCase() !== 'operator';

  const kanbanBoardIcons = useMemo(() => {
    if (kanbanFullSidebar) {
      const icons = [{ id: 1, icon: FiPlus, label: 'Add' }];
      if (showEditWorkflowSidebarIcon) {
        icons.push({ id: 9, icon: FiEdit3, label: 'Edit Workflow' });
      }
      icons.push(
        { id: 10, icon: FiMapPin, label: 'On Station' },
        { id: 7, icon: FiMail, label: 'Outlook' },
        { id: 8, icon: FiSettings, label: 'Settings' }
      );
      return icons;
    }
    const icons = [];
    if (showEditWorkflowSidebarIcon) {
      icons.push({ id: 9, icon: FiEdit3, label: 'Edit Workflow' });
    }
    icons.push({ id: 7, icon: FiMail, label: 'Outlook' });
    return icons;
  }, [showEditWorkflowSidebarIcon, kanbanFullSidebar]);

  const restrictedKanbanStripIcons = useMemo(
    () => [
      { id: 4, icon: FiInbox, label: 'Workspaces' },
      { id: 6, icon: FiLayout, label: 'Kanban Board' },
    ],
    []
  );

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

  // Select icons based on route (restricted roles: only Workspaces + fixed board)
  const kanbanIcons = restrictedNav
    ? restrictedKanbanStripIcons
    : pathname === '/kanban-board/operator' || pathname.startsWith('/kanban-board/') || pathname === '/compact'
      ? kanbanBoardIcons
      : workspacesIcons;

  // 🆕 Active state only for Kanban sidebar
  const [activeKanbanIcon, setActiveKanbanIcon] = useState(2);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showBoardTeamsSubmenu, setShowBoardTeamsSubmenu] = useState(false);
  const [showSettingsSubmenu, setShowSettingsSubmenu] = useState(false);
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
  const [showOnStationModal, setShowOnStationModal] = useState(false);
  const [showSelectWorkflowModal, setShowSelectWorkflowModal] = useState(false);
  const [addModalStep, setAddModalStep] = useState('workflow');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null);
  const [selectedSwimlaneId, setSelectedSwimlaneId] = useState(null);
  const [addModalWorkflows, setAddModalWorkflows] = useState([]);
  const [swimlanePhaseWorkflow, setSwimlanePhaseWorkflow] = useState(null);

  const sidebarWorkflows = useKanbanSidebarBridge((s) => s.boardWorkflows);
  const pendingAddCardFromWorkflowRef = useRef(null);

  const swimlaneOptionsForModal = useMemo(
    () => getSwimlaneOptionsFromWorkflow(swimlanePhaseWorkflow),
    [swimlanePhaseWorkflow]
  );
  const workflowOptionsForModal = useMemo(() => {
    return (sidebarWorkflows || [])
      .filter((workflow) => workflow?.role_id === null)
      .map((workflow) => ({
        id: workflow?.workflow_id ?? workflow?.id,
        name: workflow?.workflow_name ?? workflow?.name ?? workflow?.title ?? 'Workflow',
        description: workflow?.description,
      }));
  }, [sidebarWorkflows]);

  const swimlaneContextDisplayName =
    swimlanePhaseWorkflow?.name ?? swimlanePhaseWorkflow?.title ?? '';

  const resetAddModalState = useCallback(() => {
    setAddModalStep('workflow');
    setAddModalWorkflows([]);
    setSwimlanePhaseWorkflow(null);
    setSelectedWorkflowId(null);
    setSelectedSwimlaneId(null);
  }, []);

  const closeSelectWorkflowModal = useCallback(() => {
    pendingAddCardFromWorkflowRef.current = null;
    setShowSelectWorkflowModal(false);
    resetAddModalState();
  }, [resetAddModalState]);

  const beginSidebarAddCard = useCallback(() => {
    const resolved = resolveSidebarAddCardAction(sidebarWorkflows);
    if (resolved.kind === 'dispatch') {
      window.dispatchEvent(new CustomEvent('kanban:add-card', { detail: resolved.detail }));
      return;
    }
    setAddModalWorkflows(resolved.workflowsForWorkflowStep ?? []);
    if (resolved.initialStep === 'swimlane') {
      setAddModalStep('swimlane');
      setSwimlanePhaseWorkflow(resolved.swimlaneContextWorkflow);
    } else {
      setAddModalStep('workflow');
      setSwimlanePhaseWorkflow(null);
    }
    setSelectedWorkflowId(null);
    setSelectedSwimlaneId(null);
    setShowSelectWorkflowModal(true);
  }, [sidebarWorkflows]);

  const handleAddModalContinue = useCallback(() => {
    if (addModalStep === 'workflow') {
      const w = addModalWorkflows.find(
        (x) => x.id === selectedWorkflowId || String(x.id) === String(selectedWorkflowId)
      );
      if (!w) return;
      const lanes = getSwimlaneOptionsFromWorkflow(w);
      if (lanes.length > 1) {
        setSwimlanePhaseWorkflow(w);
        setAddModalStep('swimlane');
        setSelectedSwimlaneId(null);
        return;
      }
      if (lanes.length === 1) {
        pendingAddCardFromWorkflowRef.current = buildKanbanAddCardEventDetail(w, lanes[0]);
      } else {
        pendingAddCardFromWorkflowRef.current = buildKanbanAddCardEventDetail(w, null);
      }
      setShowSelectWorkflowModal(false);
      setSelectedWorkflowId(null);
      return;
    }
    if (addModalStep === 'swimlane') {
      const wf = swimlanePhaseWorkflow;
      if (!wf) return;
      const lanes = getSwimlaneOptionsFromWorkflow(wf);
      const lane = lanes.find(
        (l) => l.id === selectedSwimlaneId || String(l.id) === String(selectedSwimlaneId)
      );
      if (!lane) return;
      pendingAddCardFromWorkflowRef.current = buildKanbanAddCardEventDetail(wf, lane);
      setShowSelectWorkflowModal(false);
      setSelectedSwimlaneId(null);
    }
  }, [
    addModalStep,
    addModalWorkflows,
    selectedWorkflowId,
    swimlanePhaseWorkflow,
    selectedSwimlaneId,
  ]);

  const handleSelectWorkflowModalExited = useCallback(() => {
    const d = pendingAddCardFromWorkflowRef.current;
    if (!d) {
      resetAddModalState();
      return;
    }
    pendingAddCardFromWorkflowRef.current = null;
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('kanban:add-card', { detail: d }));
    });
    resetAddModalState();
  }, [resetAddModalState]);

  const [expand, setExpand] = useState(false);

  // ✅ NEW: arranged sidebar order (as per your screenshot + recommended grouping)
  const menus = [
    {
      menu: 'Dashboard',
      isDefaultMenu: true,
      to: ROUTE_PATHS.DASHBOARD,
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
    {
      menu: 'Entity Management',
      isDefaultMenu: true,
      hasPermission: true,
      isOpen: false,
      subMenus: [
        { menu: 'Billing Entity', to: '/billing-entity', hasPermission: true },
        { menu: 'Group Email', to: '/group-email', hasPermission: true },
        { menu: 'Billing Instruction', to: '/billing-instruction', hasPermission: true },
        { menu: 'Customer Pricing', to: '/customer-pricing', hasPermission: true },
        { menu: 'Vessel Management', to: '/vessel-onboarding', hasPermission: true },
        { menu: 'Crew Management', to: '/crew-management', hasPermission: true },
        { menu: 'MWP History', to: "/mwp-history", hasPermission: true },
        // { menu: 'Job Status', to: '/job-status', hasPermission: true },
      ],
      icon: billingIcon, // Billing-specific icon
    },
    {
      menu: 'Operations Configuration',
      isDefaultMenu: true,
      hasPermission: true,
      isOpen: false,
      subMenus: [
        { menu: 'Report Templates', to: '/appointment-acceptance', hasPermission: true },
        // { menu: 'Pre-Arrival Information', to: '/pre-arrival-information', hasPermission: true },
        { menu: 'Crew Template', to: '/crew-template', hasPermission: true },
        { menu: 'Coordinates', to: '/coordinates', hasPermission: true },
        // { menu: 'Custom Fields', to: '/custom-fields', hasPermission: true },
      ],
      icon: configIcon, // Configuration-specific icon
    },
    {
      menu: 'Time Object Management',
      isDefaultMenu: true,
      icon: materialIcon, // Material-specific icon
      hasPermission: true,
      isOpen: false,
      subMenus: [
        { menu: 'Time Objects', to: '/time-objects', hasPermission: true },
        { menu: 'Stage Time Mappings', to: '/stage-time-mappings', hasPermission: true },
      ],
    },
    {
      menu: 'Checklist Management',
      isDefaultMenu: true,
      hasPermission: true,
      isOpen: false,
      subMenus: [
        { menu: 'Vessel Types', to: '/vessel-types', hasPermission: true },
        { menu: 'Barge Types', to: '/barge-types', hasPermission: true },
        { menu: 'Task Management', to: '/task-management', hasPermission: true },
        { menu: 'Task Roles', to: '/task-roles', hasPermission: true },
        { menu: 'Checklist', to: '/check-list', hasPermission: true },
      ],
      icon: workerIcon, // Two stylized human figures
    },
    {
      menu: 'Launch Hire Management',
      isDefaultMenu: true,
      hasPermission: true,
      isOpen: false,
      subMenus: [
        { menu: 'Operators', to: ROUTE_PATHS.OPERATORS, hasPermission: true },
        { menu: 'Fleet', to: '/fleet', hasPermission: true },
        { menu: 'Captains', to: '/captains', hasPermission: true },
        { menu: 'Services', to: '/lh-services', hasPermission: true },
        // { menu: 'Location', to: '/location', hasPermission: true },
      ],
      icon: workerIcon, // Two stylized human figures
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
      menu: 'Third Party Service',
      isDefaultMenu: true,
      to: '/third-party-service',
      icon: workerIcon, // Third Party Services-specific icon
      hasPermission: true,
    },
    {
      menu: 'Material Management',
      isDefaultMenu: true,
      icon: materialIcon, // Material-specific icon
      hasPermission: true,
      isOpen: false,
      subMenus: [
        // { menu: 'Material Types', to: '/material-type', hasPermission: true },
        { menu: 'Waste Types', to: '/waste-types', hasPermission: true },
        { menu: 'Packaging Types', to: '/packing-type', hasPermission: true },
        { menu: 'Logistics Warehouses', to: '/logistics-warehouse', hasPermission: true },
      ],
    },
    {
      menu: 'KPI Dashboard',
      isDefaultMenu: true,
      hasPermission: true,
      isOpen: false,
      subMenus: [
        { menu: 'Tasks', to: '/kpi-tasks', hasPermission: true },
        { menu: 'Dashboard', to: '/kpi-dashboard', hasPermission: true },
      ],
      icon: dashboardIcon, // Two stylized human figures
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

  const restrictedSidebarMenus = useMemo(
    () => [
      {
        menu: 'Workspaces',
        isDefaultMenu: true,
        to: '/workspaces',
        icon: dashboardIcon,
        hasPermission: true,
      },
      {
        menu: 'Kanban Board',
        isDefaultMenu: true,
        to: RESTRICTED_BOARD_HOME_PATH,
        icon: materialIcon,
        hasPermission: true,
      },
    ],
    []
  );

  const [menuState, setMenuState] = useState(menus);
  const effectiveMenuState = restrictedNav ? restrictedSidebarMenus : menuState;

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
    if (isKanbanBoard || isVendorPortal || restrictedNav) return;

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
  }, [pathname, width, isKanbanBoard, isVendorPortal, restrictedNav]);

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
    if (!isKanbanBoard) return;
    if (restrictedNav) {
      if (pathname === '/workspaces' || pathname.startsWith('/workspaces/')) {
        setActiveKanbanIcon(4);
      } else if (
        pathname === RESTRICTED_BOARD_HOME_PATH ||
        pathname.startsWith(`${RESTRICTED_BOARD_HOME_PATH}/`)
      ) {
        setActiveKanbanIcon(6);
      }
      return;
    }
    if (pathname === '/workspaces') {
      setActiveKanbanIcon(4);
    } else if (pathname.includes('/analytics')) {
      setActiveKanbanIcon(3);
    } else if (
      pathname === '/kanban-board/operator' ||
      pathname.startsWith('/kanban-board/') ||
      pathname === '/compact'
    ) {
      setActiveKanbanIcon(1);
    }
  }, [pathname, isKanbanBoard, restrictedNav]);

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
        <WorkspacesSideNavPanel
          isDarkMode={isDarkMode}
          onNewDashboard={() => setShowAddDashboardModal(true)}
          restrictedBoardUser={restrictedNav}
        />
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
    console.log('raw workflows:', sidebarWorkflows);
    console.log('modal workflows:', workflowOptionsForModal);

    const handleIconClick = (item) => {
      if (restrictedNav) {
        if (item.label === 'Workspaces') {
          navigate('/workspaces');
          setActiveKanbanIcon(item.id);
          return;
        }
        if (item.label === 'Kanban Board') {
          navigate(RESTRICTED_BOARD_HOME_PATH);
          setActiveKanbanIcon(item.id);
          return;
        }
      }

      if (item.label === 'Filter') {
        const newShowState = !showFilterPanel;
        closeSelectWorkflowModal();
        setShowFilterPanel(newShowState);
        setShowBoardTeamsSubmenu(false);
        setShowSettingsSubmenu(false);
        setShowCardManagementSubmenu(false);
        setShowOnStationModal(false);
        if (newShowState) setActiveKanbanIcon(item.id);
        return;
      }

      if (item.label === 'Analytics') {
        closeSelectWorkflowModal();
        // Extract board ID from pathname if available
        const boardIdMatch = pathname.match(/\/kanban-board\/operator\/(\d+)/);
        const boardId = boardIdMatch ? boardIdMatch[1] : '';
        navigate(`/kanban-board/${boardId ? `${boardId}/` : ''}analytics`);
        setActiveKanbanIcon(item.id);
        setShowFilterPanel(false);
        setShowBoardTeamsSubmenu(false);
        setShowSettingsSubmenu(false);
        setShowCardManagementSubmenu(false);
        setShowOnStationModal(false);
        return;
      }

      if (item.label === 'Board teams') {
        const newShowState = !showBoardTeamsSubmenu;
        closeSelectWorkflowModal();
        setShowBoardTeamsSubmenu(newShowState);
        setShowFilterPanel(false);
        setShowSettingsSubmenu(false);
        setShowBusinessRulesModal(false);
        setShowCardManagementSubmenu(false);
        setShowOnStationModal(false);
        if (newShowState) setActiveKanbanIcon(item.id);
        return;
      }

      if (item.label === 'Business rules') {
        closeSelectWorkflowModal();
        setShowBusinessRulesModal(true);
        setShowFilterPanel(false);
        setShowBoardTeamsSubmenu(false);
        setShowSettingsSubmenu(false);
        setShowCardManagementSubmenu(false);
        setActiveKanbanIcon(item.id);
        setShowOnStationModal(false);
        return;
      }

      if (item.label === 'Card management') {
        const newShowState = !showCardManagementSubmenu;
        closeSelectWorkflowModal();
        setShowCardManagementSubmenu(newShowState);
        setShowFilterPanel(false);
        setShowBoardTeamsSubmenu(false);
        setShowSettingsSubmenu(false);
        setShowBusinessRulesModal(false);
        setShowOnStationModal(false);
        setShowBlockersModal(false);
        setShowStickersModal(false);
        setShowTagsModal(false);
        setShowTypesModal(false);
        if (newShowState) setActiveKanbanIcon(item.id);
        return;
      }

      if (item.label === 'Settings') {
        const newShowState = !showSettingsSubmenu;
        closeSelectWorkflowModal();
        setShowSettingsSubmenu(newShowState);
        setShowFilterPanel(false);
        setShowBoardTeamsSubmenu(false);
        setShowBusinessRulesModal(false);
        setShowOnStationModal(false);
        if (!newShowState) {
          setShowCardManagementSubmenu(false);
          setShowBlockersModal(false);
          setShowStickersModal(false);
          setShowTagsModal(false);
          setShowTypesModal(false);
        }
        if (newShowState) setActiveKanbanIcon(item.id);
        return;
      }

      if (item.label === 'Edit Workflow') {
        closeSelectWorkflowModal();
        setShowFilterPanel(false);
        setShowBoardTeamsSubmenu(false);
        setShowSettingsSubmenu(false);
        setShowCardManagementSubmenu(false);
        setShowOnStationModal(false);
        navigate(`/edit-workflow?boardId=${kanbanBoardIdForEditWorkflow}`);
        setActiveKanbanIcon(item.id);
        return;
      }

      if (item.label === 'On Station') {
        closeSelectWorkflowModal();
        setShowFilterPanel(false);
        setShowBoardTeamsSubmenu(false);
        setShowSettingsSubmenu(false);
        setShowCardManagementSubmenu(false);
        setShowOnStationModal((prev) => !prev);
        setActiveKanbanIcon(item.id);
        return;
      }

      if (item.label === 'Outlook') {
        setShowSettingsSubmenu(false);
        setShowCardManagementSubmenu(false);
        setShowOnStationModal(false);
        // Open Outlook Classic desktop app (Windows protocol)
        const fallbackToOutlookWeb = setTimeout(() => {
          // Fallback to Outlook Web if desktop protocol is unavailable
          window.open('https://outlook.office.com/mail/', '_blank', 'noopener,noreferrer');
        }, 1200);

        window.location.href = 'ms-outlook://';

        // If protocol launch succeeds, page visibility usually changes; cancel web fallback
        setTimeout(() => {
          if (document.visibilityState === 'hidden') {
            clearTimeout(fallbackToOutlookWeb);
          }
        }, 300);
        return;
      }

      if (showFilterPanel) setShowFilterPanel(false);
      if (showBoardTeamsSubmenu) setShowBoardTeamsSubmenu(false);
      if (showSettingsSubmenu) setShowSettingsSubmenu(false);
      if (showCardManagementSubmenu) setShowCardManagementSubmenu(false);
      if (showOnStationModal) setShowOnStationModal(false);
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
        setShowSettingsSubmenu(false);
        setShowCardManagementSubmenu(false);
        setShowOnStationModal(false);
        setActiveKanbanIcon(item.id);
        return;
      }

      if (item.label === 'Workspaces') {
        navigate('/workspaces');
      } else if (pathname === '/workspaces' && item.label !== 'Workspaces') {
        navigate('/kanban-board/operator');
        window.dispatchEvent(new CustomEvent('kanban:hide-workspaces', { detail: { activeIcon: item.id } }));
      } else {
        window.dispatchEvent(new CustomEvent('kanban:hide-workspaces', { detail: { activeIcon: item.id } }));
      }
    };

    const handleSettingsBusinessRulesClick = () => {
      setShowSettingsSubmenu(false);
      setShowCardManagementSubmenu(false);
      setShowFilterPanel(false);
      setShowBoardTeamsSubmenu(false);
      setShowManagersModal(false);
      setShowDashboardsModal(false);
      setShowBlockersModal(false);
      setShowStickersModal(false);
      setShowTagsModal(false);
      setShowTypesModal(false);
      setShowOnStationModal(false);
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

    const handleSubmenuClickKanban = (item) => {
      setShowBoardTeamsSubmenu(false);
      setShowSettingsSubmenu(false);
      setShowOnStationModal(false);
      if (item.modal === 'managers') setShowManagersModal(true);
      else if (item.modal === 'dashboards') setShowDashboardsModal(true);
    };

    const handleCardManagementSubmenuClick = (item) => {
      setShowCardManagementSubmenu(false);
      setShowSettingsSubmenu(false);
      setShowOnStationModal(false);

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
        {isPortManagerRole && (
          <aside className={`kanban-sidebar ${isDarkMode ? 'kanban-sidebar-dark' : ''}`}>
            {kanbanIcons.map((item) => {
              const Icon = item.icon;
              const isActive =
                activeKanbanIcon === item.id ||
                (restrictedNav &&
                  item.label === 'Kanban Board' &&
                  (pathname === RESTRICTED_BOARD_HOME_PATH ||
                    pathname.startsWith(`${RESTRICTED_BOARD_HOME_PATH}/`))) ||
                (item.label === 'Filter' && showFilterPanel) ||
                (item.label === 'Analytics' && pathname.includes('/analytics')) ||
                (item.label === 'Board teams' && showBoardTeamsSubmenu) ||
                (item.label === 'Business rules' && showBusinessRulesModal) ||
                (item.label === 'Card management' && showCardManagementSubmenu) ||
                (item.label === 'Edit Workflow' && pathname.startsWith('/edit-workflow')) ||
                (item.label === 'On Station' && showOnStationModal) ||
                (item.label === 'Settings' && (showSettingsSubmenu || showCardManagementSubmenu)) ||
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

                  {item.label === 'Settings' && showSettingsSubmenu && (
                    <div className="kanban-sidebar-submenu">
                      <div
                        className="kanban-sidebar-submenu-item"
                        onClick={handleSettingsBusinessRulesClick}
                      >
                        Business rules
                      </div>
                      <div
                        className={`kanban-sidebar-submenu-item ${showCardManagementSubmenu ? 'submenu-open' : ''}`}
                        onClick={handleSettingsCardManagementRowClick}
                      >
                        Card management
                      </div>
                      {showCardManagementSubmenu && (
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
        )}

        <BoardFilterPanel show={showFilterPanel} onClose={() => setShowFilterPanel(false)} />
        <OnStationModal
          show={showOnStationModal}
          onClose={() => {
            setShowOnStationModal(false);
          }}
        />
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
          selectionMode={addModalStep === 'swimlane' ? 'swimlane' : 'workflow'}
          workflows={workflowOptionsForModal}
          swimlanes={addModalStep === 'swimlane' ? swimlaneOptionsForModal : []}
          workflowContextName={addModalStep === 'swimlane' ? swimlaneContextDisplayName : undefined}
          selectedWorkflowId={addModalStep === 'workflow' ? selectedWorkflowId : null}
          selectedSwimlaneId={addModalStep === 'swimlane' ? selectedSwimlaneId : null}
          onSelectWorkflowId={setSelectedWorkflowId}
          onSelectSwimlaneId={setSelectedSwimlaneId}
          onClose={closeSelectWorkflowModal}
          onContinue={handleAddModalContinue}
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
            {(isVendorPortal ? vendorMenus : effectiveMenuState)
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
      {!!showMyAccountsModal && (
        <MyAccountsModal show={showMyAccountsModal} onClose={() => setShowMyAccountsModal(false)} />
      )}
    </>
  );
}

export default SideNav;
