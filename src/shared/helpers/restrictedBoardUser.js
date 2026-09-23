import { getItem } from './localStorage';
import {
  collectUserRoleIdCandidates,
  isGROUserRole,
  normalizeRoleId,
} from './groUserRoles';

/** Sedres desk roles — limited board/workspace access (includes Taxi Boat Operator 20, Taxi Boat Captain 21).
 * DA (22) removed per explicit user confirmation — DA now gets the same
 * unrestricted workspaces/header access as role 1 (Port Manager). Route access
 * to kanban boards is instead covered via hasUnrestrictedRouteAccess in
 * rolePermissions.js, so removing DA here doesn't break board navigation. */
export const SEDRES_RESTRICTED_ROLE_IDS = new Set(['4', '5', '6', '8', '9', '10', '19', '20', '21']);

function isSedresRestrictedBoardRoleId(roleId) {
  const normalized = normalizeRoleId(roleId);
  if (!normalized) return false;
  if (isGROUserRole(normalized) || isGROUserRole(Number(normalized))) return true;
  return SEDRES_RESTRICTED_ROLE_IDS.has(normalized);
}

/** Port Operator — hide Master Module / Vendor shortcuts in header */
export const PORT_OPERATOR_ROLE_ID = '2';

/** Port Manager — full Kanban sidebar (Add, On Station, Edit Workflow, Outlook, Settings) */
export const KANBAN_FULL_SIDEBAR_ROLE_ID = '1';

/** DA — granted the same full Kanban sidebar as Port Manager, per explicit user confirmation */
export const DA_ROLE_ID = '22';

/** Fallback landing path for restricted users when a route isn't allowed — not a specific board. */
export const RESTRICTED_USER_FALLBACK_PATH = '/workspaces';

function toRoleIdString(value) {
  return normalizeRoleId(value);
}

function collectRoleIdCandidatesFromUser(user) {
  return collectUserRoleIdCandidates(user);
}

/**
 * @param {object|null|undefined} user — e.g. Redux/Zustand userProfile or API `data`
 * @returns {boolean}
 */
export function isRestrictedBoardUser(user) {
  for (const id of collectRoleIdCandidatesFromUser(user)) {
    if (isSedresRestrictedBoardRoleId(id)) return true;
  }

  try {
    const raw = getItem('userProfile');
    if (raw) {
      const parsed = JSON.parse(raw);
      for (const id of collectRoleIdCandidatesFromUser(parsed)) {
        if (isSedresRestrictedBoardRoleId(id)) return true;
      }
    }
  } catch {
    // ignore invalid cached profile JSON
  }

  const storedRole = toRoleIdString(getItem('role_id'));
  if (storedRole && isSedresRestrictedBoardRoleId(storedRole)) return true;

  return false;
}

/**
 * @param {object|null|undefined} user — e.g. Redux/Zustand userProfile or merged profile
 * @returns {boolean}
 */
export function isPortOperatorUser(user) {
  for (const id of collectRoleIdCandidatesFromUser(user)) {
    if (id === PORT_OPERATOR_ROLE_ID) return true;
  }

  try {
    const raw = getItem('userProfile');
    if (raw) {
      const parsed = JSON.parse(raw);
      for (const id of collectRoleIdCandidatesFromUser(parsed)) {
        if (id === PORT_OPERATOR_ROLE_ID) return true;
      }
    }
  } catch {
    // ignore invalid cached profile JSON
  }

  const storedRole = toRoleIdString(getItem('role_id'));
  if (storedRole === PORT_OPERATOR_ROLE_ID) return true;

  return false;
}

/**
 * @param {object|null|undefined} user — e.g. Redux/Zustand userProfile or merged profile
 * @returns {boolean}
 */
export function hasKanbanFullSidebar(user) {
  for (const id of collectRoleIdCandidatesFromUser(user)) {
    if (id === KANBAN_FULL_SIDEBAR_ROLE_ID || id === DA_ROLE_ID) return true;
  }

  try {
    const raw = getItem('userProfile');
    if (raw) {
      const parsed = JSON.parse(raw);
      for (const id of collectRoleIdCandidatesFromUser(parsed)) {
        if (id === KANBAN_FULL_SIDEBAR_ROLE_ID || id === DA_ROLE_ID) return true;
      }
    }
  } catch {
    // ignore invalid cached profile JSON
  }

  const storedRole = toRoleIdString(getItem('role_id'));
  if (storedRole === KANBAN_FULL_SIDEBAR_ROLE_ID || storedRole === DA_ROLE_ID) return true;

  return false;
}

/**
 * Paths allowed for restricted roles (HashRouter pathnames without hash).
 */
export function isRestrictedUserAllowedPath(pathname) {
  if (!pathname || typeof pathname !== 'string') return false;
  if (pathname === '/workspaces' || pathname.startsWith('/workspaces/')) return true;
  if (pathname.startsWith('/kanban-board/')) return true;
  return false;
}
