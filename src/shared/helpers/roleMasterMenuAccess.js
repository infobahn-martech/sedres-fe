import { getItem } from './localStorage';
import { collectUserRoleIdCandidates, normalizeRoleId } from './groUserRoles';
import { ROUTE_PATHS } from '../../router/paths';

/**
 * Master Module access for roles that are otherwise limited (e.g. Sedres desk
 * roles in restrictedBoardUser.js). A role listed here gets the Master Module
 * header icon, sees ONLY these sidebar menus, and may open their routes.
 * Roles not listed keep their existing behaviour.
 *
 * Menu names must match the `menu` labels in structure/SideNav.
 */
export const ROLE_MASTER_MENUS = {
  '19': ['Dashboard', 'Transport Management'], // Coordinator Transport
};

/** Routes behind each master menu — keep in sync with the SideNav menu entries. */
const MASTER_MENU_PATHS = {
  Dashboard: [ROUTE_PATHS.DASHBOARD],
  'Transport Management': [
    '/driver-management',
    '/vehicle-management',
    '/driver-vehicle-mapping',
    '/transport-company',
  ],
};

function getAllowedMenus(user) {
  const candidates = collectUserRoleIdCandidates(user);
  const storedRole = normalizeRoleId(getItem('role_id'));
  if (storedRole) candidates.push(storedRole);

  const roleId = candidates.find((id) => ROLE_MASTER_MENUS[id]);
  return roleId ? ROLE_MASTER_MENUS[roleId] : null;
}

/** True when the user's role has a Master Module menu config. */
export function hasMasterModuleAccess(user) {
  return getAllowedMenus(user) !== null;
}

/** True when the menu should render; roles without a config see every menu. */
export function isMasterMenuAllowed(user, menuName) {
  const allowedMenus = getAllowedMenus(user);
  return !allowedMenus || allowedMenus.includes(menuName);
}

/** True when the path belongs to one of the role's configured master menus. */
export function isMasterMenuPathAllowed(user, pathname) {
  const allowedMenus = getAllowedMenus(user);
  if (!allowedMenus || !pathname) return false;
  return allowedMenus.some((menuName) =>
    (MASTER_MENU_PATHS[menuName] || []).some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    )
  );
}
