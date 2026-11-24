import { getStoredRoleId } from './localStorage';
import { collectUserRoleIdCandidates, normalizeRoleId } from './groUserRoles';
import { isRestrictedBoardUser } from './restrictedBoardUser';
import { isVendorRole } from './vendorDashboardRoles';
import { ROLES } from '../constants/roles';

/**
 * Single source of truth for which icons the top navbar (structure/Header) shows.
 * Role ids come from shared/constants/roles.js.
 *
 *   Icon              | Who sees it
 *   ------------------|-------------------------------------------------------------
 *   Tools             | Everyone (moves into the kanban sidebar on board routes)
 *   Search bar        | Everyone except desk roles and vendor roles (see below)
 *   Master Module     | ONLY Port Manager (1), Port Operator (2), Super Admin (7)
 *   KPI Dashboard     | Everyone except vendor roles
 *   Theme toggle      | Everyone
 *   Help              | Everyone
 *   Notifications     | Everyone
 *   Settings          | ONLY Port Manager (1), Port Operator (2), Super Admin (7)
 *   Profile avatar    | Everyone
 *
 *   Desk roles (restrictedBoardUser.js): GRO User 4, CC Supervisor 5, GRO Supervisor 6,
 *     MWP Supervisor 8, CC User 9, MWP User 10, Transport Coordinator 19,
 *     Taxi Boat Operator 20, Taxi Boat Captain 21
 *   Vendor roles (vendorDashboardRoles.js): Inhouse Driver 15, Transport Company 16,
 *     Hotel 17, Hospital 18
 *
 *   Result per role:
 *     1, 2, 7                      -> every icon
 *     22, 23, 25, 26               -> everything except Master Module and Settings
 *     4, 5, 6, 8, 9, 10, 19, 20, 21 -> Tools, KPI, Theme, Help, Bell, Profile (no search)
 *     15, 16, 17, 18               -> Tools, Theme, Help, Bell, Profile (no search, no KPI)
 */

/** Roles that see the full navbar, including Master Module and Settings. */
export const NAVBAR_FULL_ACCESS_ROLE_IDS = new Set([
  ROLES.PORT_MANAGER,
  ROLES.PORT_OPERATOR,
  ROLES.SUPER_ADMIN,
]);

/** All role ids we can find for the user: profile fields first, then the cached profile. */
function getUserRoleIds(user) {
  const ids = collectUserRoleIdCandidates(user);
  const stored = normalizeRoleId(getStoredRoleId());
  if (stored) ids.push(stored);
  return ids;
}

/** True for Port Manager, Port Operator and Super Admin. */
export function hasFullNavbarAccess(user) {
  return getUserRoleIds(user).some((id) => NAVBAR_FULL_ACCESS_ROLE_IDS.has(String(id)));
}

function isVendorUser(user) {
  return getUserRoleIds(user).some((id) => isVendorRole(id));
}

/**
 * @param {object} params
 * @param {object|null|undefined} params.user - userProfile from the auth store
 * @param {string} params.pathname - current route path
 * @param {string|null} params.activePortal - portal key when inside a portal layout
 * @returns {Record<string, boolean>} which navbar items to render
 */
export function getNavbarAccess({ user, pathname = '', activePortal = null }) {
  const fullAccess = hasFullNavbarAccess(user);
  const restricted = isRestrictedBoardUser(user);
  const vendor = isVendorUser(user);
  const isKanbanBoardRoute = pathname.startsWith('/kanban-board/') || pathname === '/compact';

  return {
    showTools: Boolean(activePortal) || !isKanbanBoardRoute,
    showSearch: !restricted && !vendor,
    showMasterModule: fullAccess,
    showKpiDashboard: !vendor,
    showThemeToggle: true,
    showHelp: true,
    showNotifications: true,
    // Settings opens kanban settings, so it stays off inside portal layouts.
    showSettings: fullAccess && !activePortal,
    showProfile: true,
  };
}
