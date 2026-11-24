import { getItem } from './localStorage';
import { ROLES } from '../constants/roles';
import {
  collectUserRoleIdCandidates,
  isGROUserRole,
  normalizeRoleId,
} from './groUserRoles';

/** Sedres desk roles: limited to workspaces and kanban boards.
 * DA Supervisor (22) is not here; it gets unrestricted route access in rolePermissions.js. */
export const SEDRES_RESTRICTED_ROLE_IDS = new Set([
  ROLES.GRO_USER,
  ROLES.CUSTOM_CLEARANCE_SUPERVISOR,
  ROLES.GRO_SUPERVISOR,
  ROLES.MWP_SUPERVISOR,
  ROLES.CUSTOM_CLEARANCE_USER,
  ROLES.MWP_USER,
  ROLES.TRANSPORT_COORDINATOR,
  ROLES.TAXI_BOAT_OPERATOR,
  ROLES.TAXI_BOAT_CAPTAIN,
]);

function isSedresRestrictedBoardRoleId(roleId) {
  const normalized = normalizeRoleId(roleId);
  if (!normalized) return false;
  if (isGROUserRole(normalized) || isGROUserRole(Number(normalized))) return true;
  return SEDRES_RESTRICTED_ROLE_IDS.has(normalized);
}

export const PORT_OPERATOR_ROLE_ID = ROLES.PORT_OPERATOR;

/** Port Manager — full Kanban sidebar (Add, On Station, Edit Workflow, Outlook, Settings) */
export const KANBAN_FULL_SIDEBAR_ROLE_ID = ROLES.PORT_MANAGER;

/** DA Supervisor — same full Kanban sidebar as Port Manager */
export const DA_ROLE_ID = ROLES.DA_SUPERVISOR;

/** Fallback landing path for restricted users when a route isn't allowed — not a specific board. */
export const RESTRICTED_USER_FALLBACK_PATH = '/workspaces';

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
