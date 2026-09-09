import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import '../../design/scss/dashboard.scss';
import { Outlet } from 'react-router';
import SideNav from '../SideNav/index';
import Header from '../Header';
import { LayoutViewProvider, useLayoutView } from '../../shared/context/LayoutViewContext';
import useAuthReducer from '../../store/AuthReducer';

function Layout() {
  const { pathname } = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const userProfile = useAuthReducer((state) => state.userProfile);
  const userRoleId =
    userProfile?.role_id ||
    userProfile?.roleId ||
    userProfile?.role?.role_id ||
    userProfile?.user?.role_id ||
    userProfile?.data?.role_id;
  const isPortManagerRole = String(userRoleId) === '1';
  const isPortSupervisorRole = String(userRoleId) === '23';
  const hideSidebar = pathname === '/edit-workflow' || pathname === '/da-module';
  const isKanbanBoard =
    pathname === '/kanban-board/operator' ||
    pathname.startsWith('/kanban-board/') ||
    pathname === '/compact' ||
    pathname === '/workspaces' ||
    pathname.startsWith('/workspaces/dashboard');
  const isKanbanIconSidebarRoute =
    pathname === '/kanban-board/operator' ||
    pathname.startsWith('/kanban-board/') ||
    pathname === '/compact';
  const kanbanFullWidth = isKanbanIconSidebarRoute && !isPortManagerRole && !isPortSupervisorRole;
  const isVendorPortal = pathname.startsWith('/vendor-portal');
  const isMedicalPortal = pathname.startsWith('/medical-portal');
  const isTransportPortal = pathname.startsWith('/transport-portal');
  const isInhouseDriverPortal = pathname.startsWith('/inhouse-driver');
  const isHotelPortal = pathname.startsWith('/hotel-portal');

  const activePortal = isVendorPortal ? 'vendor'
    : isMedicalPortal ? 'medical'
    : isTransportPortal ? 'transport'
    : isInhouseDriverPortal ? 'inhouse-driver'
    : isHotelPortal ? 'hotel'
    : null;

  const handleMenuToggle = (isOpen) => {
    setMobileMenuOpen(isOpen);
  };

  const handleCloseMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <LayoutViewProvider>
      <LayoutContent
        isKanbanBoard={isKanbanBoard}
        kanbanFullWidth={kanbanFullWidth}
        hideSidebar={hideSidebar}
        mobileMenuOpen={mobileMenuOpen}
        activePortal={activePortal}
        handleMenuToggle={handleMenuToggle}
        handleCloseMobileMenu={handleCloseMobileMenu}
      />
    </LayoutViewProvider>
  );
}

function LayoutContent({
  isKanbanBoard,
  kanbanFullWidth,
  hideSidebar,
  mobileMenuOpen,
  activePortal,
  handleMenuToggle,
  handleCloseMobileMenu,
}) {
  const { pageBackground } = useLayoutView();

  return (
    <div
      className={`main-layout ${isKanbanBoard ? 'kanban-board-layout' : ''} ${kanbanFullWidth ? 'kanban-full-width' : ''}`}
    >
      <Header
        onMenuToggle={handleMenuToggle}
        mobileMenuOpen={mobileMenuOpen}
        activePortal={activePortal}
      />

      <div
        className={`dashboard-wrp ${hideSidebar ? 'no-sidebar' : ''} ${kanbanFullWidth ? 'kanban-full-width' : ''}`}
      >
        {!hideSidebar && (
          <SideNav
            isMobileMenuOpen={mobileMenuOpen}
            onCloseMobileMenu={handleCloseMobileMenu}
            activePortal={activePortal}
          />
        )}

        <div
          className={`page-cont-wrp ${hideSidebar ? 'full-width' : ''} ${kanbanFullWidth ? 'kanban-full-width' : ''}`}
          style={pageBackground ?? undefined}
        >
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default Layout;
