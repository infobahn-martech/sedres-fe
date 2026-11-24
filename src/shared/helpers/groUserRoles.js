import { ROLES, hasRole } from "../constants/roles";

/** Desk roles that call task_card/start_task when dragging a card from To Do → In Progress. */
const DESK_START_TASK_ROLE_IDS = [
  ROLES.GRO_USER,
  ROLES.CUSTOM_CLEARANCE_SUPERVISOR,
  ROLES.GRO_SUPERVISOR,
  ROLES.MWP_SUPERVISOR,
  ROLES.CUSTOM_CLEARANCE_USER,
  ROLES.MWP_USER,
  ROLES.TRANSPORT_COORDINATOR,
  ROLES.TAXI_BOAT_OPERATOR,
  ROLES.TAXI_BOAT_CAPTAIN,
];

export function normalizeRoleId(roleId) {
  if (roleId === undefined || roleId === null) return null;
  const s = String(roleId).trim();
  return s === "" ? null : s;
}

/** GRO User, Custom Clearance User, MWP User and GRO Supervisor. */
export function isGROUserRole(roleId) {
  return hasRole(
    roleId,
    ROLES.GRO_USER,
    ROLES.CUSTOM_CLEARANCE_USER,
    ROLES.MWP_USER,
    ROLES.GRO_SUPERVISOR
  );
}

/** GRO Supervisor and MWP Supervisor. */
export function isGROSupervisorRole(roleId) {
  return hasRole(roleId, ROLES.GRO_SUPERVISOR, ROLES.MWP_SUPERVISOR);
}

export function isMWPSupervisorRole(roleId) {
  return hasRole(roleId, ROLES.MWP_SUPERVISOR);
}

export function isCustomClearanceSupervisorRole(roleId) {
  return hasRole(roleId, ROLES.CUSTOM_CLEARANCE_SUPERVISOR);
}

/** Port-level oversight roles: Port Manager, CEO and DA Supervisor. They see the
 * supervisor-flavored GRO card view when opening a GRO Workflow card. */
export function isPortSupervisorRole(roleId) {
  return hasRole(roleId, ROLES.PORT_MANAGER, ROLES.CEO, ROLES.DA_SUPERVISOR);
}

export function collectUserRoleIdCandidates(user) {
  if (!user || typeof user !== "object") return [];
  const ids = [];
  const fromNested = normalizeRoleId(user.role?.role_id);
  if (fromNested) ids.push(fromNested);
  const flat = normalizeRoleId(user.role_id ?? user.roleId);
  if (flat) ids.push(flat);
  const fromUser = normalizeRoleId(user.user?.role_id);
  if (fromUser) ids.push(fromUser);
  const fromData = normalizeRoleId(user.data?.role_id);
  if (fromData) ids.push(fromData);
  return ids;
}

export function getFirstUserRoleId(user) {
  const candidates = collectUserRoleIdCandidates(user);
  return candidates.length > 0 ? candidates[0] : null;
}

/** Desk roles that call task_card/start_task when dragging a card from To Do → In Progress. */
export function isDeskStartTaskRole(roleId) {
  return hasRole(roleId, ...DESK_START_TASK_ROLE_IDS);
}

export function userHasDeskStartTaskRole(user) {
  for (const id of collectUserRoleIdCandidates(user)) {
    if (isDeskStartTaskRole(id)) return true;
  }
  return false;
}
