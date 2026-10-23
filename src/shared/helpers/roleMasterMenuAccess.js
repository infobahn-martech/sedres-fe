import { getItem } from './localStorage';
import { collectUserRoleIdCandidates, normalizeRoleId } from './groUserRoles';
import { ROUTE_PATHS } from '../../router/paths';

/**
 * Master Module access for roles that are otherwise limited (e.g. Sedres desk
 * roles in restrictedBoardUser.js). A role listed here gets the Master Module
 * header icon, sees ONLY these sidebar menus, and may open their routes.
 * Roles not listed keep their existing behaviour.
 *
 * Menu and submenu names must match the `menu` labels in structure/SideNav.
 * `true` shows the whole menu; an array shows only those submenus.
 */
export const ROLE_MASTER_MENUS = {
  // Coordinator Transport
  '19': {
    Dashboard: true,
    'Transport Management': true,
    Settings: ['My Accounts'],
  },
  // Inhouse Driver
  '15': {
    Dashboard: true,
    'Trip Management': true,
    Settings: ['My Accounts'],
  },
  // Transport Company
  '16': {
    Dashboard: true,
    'Order Management': true,
    'Invoice Management': true,
    Settings: ['My Accounts'],
  },
};

/** Menus that exist only for roles that list them above — hidden from every other role. */
const ROLE_ONLY_MASTER_MENUS = new Set(['Trip Management', 'Order Management', 'Invoice Management']);

/** Routes behind each master menu — keep in sync with the SideNav menu entries. */
const MASTER_MENU_PATHS = {
  Dashboard: [ROUTE_PATHS.DASHBOARD],
  'Transport Management': [
    '/driver-management',
    '/vehicle-management',
    '/driver-vehicle-mapping',
    '/transport-company',
  ],
  'Trip Management': ['/trip-management'],
  'Order Management': ['/order-management'],
  'Invoice Management': ['/invoice-management'],
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

/** True when the menu should render; roles without a config see every menu except role-only ones. */
export function isMasterMenuAllowed(user, menuName) {
  const allowedMenus = getAllowedMenus(user);
  if (!allowedMenus) return !ROLE_ONLY_MASTER_MENUS.has(menuName);
  return Boolean(allowedMenus[menuName]);
}

/** Submenus of `menuName` the role may see; unchanged when the role/menu isn't limited. */
export function filterMasterSubMenus(user, menuName, subMenus) {
  const allowedSubMenus = getAllowedMenus(user)?.[menuName];
  if (!Array.isArray(allowedSubMenus) || !subMenus) return subMenus;
  return subMenus.filter((subMenu) => allowedSubMenus.includes(subMenu.menu));
}

/** True when the path belongs to one of the role's configured master menus. */
export function isMasterMenuPathAllowed(user, pathname) {
  const allowedMenus = getAllowedMenus(user);
  if (!allowedMenus || !pathname) return false;
  return Object.keys(allowedMenus).some((menuName) =>
    (MASTER_MENU_PATHS[menuName] || []).some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    )
  );
}
