/** Sedres desk roles: GRO User (4), CC User (9), MWP User (10), GRO Supervisor (6), MWP Supervisor (8), CC Supervisor (5). */

const DESK_START_TASK_ROLE_IDS = new Set([4, 5, 6, 8, 9, 10]);

export function normalizeRoleId(roleId) {
  if (roleId === undefined || roleId === null) return null;
  const s = String(roleId).trim();
  return s === "" ? null : s;
}

export function isGROUserRole(roleId) {
  return (
    roleId === "4" ||
    roleId === 4 ||
    roleId === "9" ||
    roleId === 9 ||
    roleId === "10" ||
    roleId === 10 ||
    roleId === "6" ||
    roleId === 6
  );
}

export function isMWPUserRole(roleId) {
  return roleId === "10" || roleId === 10;
}

export function isGROSupervisorRole(roleId) {
  return roleId === "6" || roleId === 6 || roleId === "8" || roleId === 8;
}

export function isMWPSupervisorRole(roleId) {
  return roleId === "8" || roleId === 8;
}

export function isCustomClearanceSupervisorRole(roleId) {
  return roleId === "5" || roleId === 5;
}

/** GRO/MWP Supervisor or Custom Clearance Supervisor — assign-user + verify actions when not first column. */
export function isDeskSupervisorRole(roleId) {
  return (
    isGROSupervisorRole(roleId) ||
    isGROSupervisorRole(Number(roleId)) ||
    isCustomClearanceSupervisorRole(roleId) ||
    isCustomClearanceSupervisorRole(Number(roleId))
  );
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

export function userHasGROUserRole(user) {
  for (const id of collectUserRoleIdCandidates(user)) {
    if (isGROUserRole(id) || isGROUserRole(Number(id))) return true;
  }
  return false;
}

export function userHasGROSupervisorRole(user) {
  for (const id of collectUserRoleIdCandidates(user)) {
    if (isGROSupervisorRole(id) || isGROSupervisorRole(Number(id))) return true;
  }
  return false;
}

export function userHasCustomClearanceSupervisorRole(user) {
  for (const id of collectUserRoleIdCandidates(user)) {
    if (isCustomClearanceSupervisorRole(id) || isCustomClearanceSupervisorRole(Number(id))) return true;
  }
  return false;
}

export function userHasDeskSupervisorRole(user) {
  for (const id of collectUserRoleIdCandidates(user)) {
    if (isDeskSupervisorRole(id)) return true;
  }
  return false;
}

/** Roles that call task_card/start_task when dragging a card from To Do → In Progress. */
export function isDeskStartTaskRole(roleId) {
  const n = Number(roleId);
  return Number.isFinite(n) && DESK_START_TASK_ROLE_IDS.has(n);
}

export function userHasDeskStartTaskRole(user) {
  for (const id of collectUserRoleIdCandidates(user)) {
    if (isDeskStartTaskRole(id)) return true;
  }
  return false;
}
