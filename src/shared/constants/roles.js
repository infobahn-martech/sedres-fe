/**
 * Single source of truth for user role ids (role.role_id from the API).
 * Use these names instead of raw numbers anywhere in the FE.
 */
export const ROLES = {
  PORT_MANAGER: '1',
  PORT_OPERATOR: '2',
  GRO_USER: '4',
  CUSTOM_CLEARANCE_SUPERVISOR: '5',
  GRO_SUPERVISOR: '6',
  SUPER_ADMIN: '7',
  MWP_SUPERVISOR: '8',
  CUSTOM_CLEARANCE_USER: '9',
  MWP_USER: '10',
  INHOUSE_DRIVER: '15',
  TRANSPORT_COMPANY: '16',
  HOTEL: '17',
  HOSPITAL: '18',
  TRANSPORT_COORDINATOR: '19',
  TAXI_BOAT_OPERATOR: '20',
  TAXI_BOAT_CAPTAIN: '21',
  DA_SUPERVISOR: '22',
  CEO: '23',
  CREW_COORDINATOR: '25',
  DA_COORDINATOR: '26',
};

/**
 * True when `roleId` (string or number, as the API may send either) matches any of `roleIds`.
 * @example hasRole(user.role_id, ROLES.PORT_MANAGER, ROLES.SUPER_ADMIN)
 */
export function hasRole(roleId, ...roleIds) {
  if (roleId === undefined || roleId === null) return false;
  const id = String(roleId).trim();
  return id !== '' && roleIds.includes(id);
}

/** Display names, keyed by role id. */
export const ROLE_NAMES = {
  [ROLES.PORT_MANAGER]: 'Port Manager',
  [ROLES.PORT_OPERATOR]: 'Port Operator',
  [ROLES.GRO_USER]: 'GRO User',
  [ROLES.CUSTOM_CLEARANCE_SUPERVISOR]: 'Custom Clearance Supervisor',
  [ROLES.GRO_SUPERVISOR]: 'GRO Supervisor',
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.MWP_SUPERVISOR]: 'MWP Supervisor',
  [ROLES.CUSTOM_CLEARANCE_USER]: 'Custom Clearance User',
  [ROLES.MWP_USER]: 'MWP User',
  [ROLES.INHOUSE_DRIVER]: 'Inhouse Driver',
  [ROLES.TRANSPORT_COMPANY]: 'Transport Company',
  [ROLES.HOTEL]: 'Hotel',
  [ROLES.HOSPITAL]: 'Hospital',
  [ROLES.TRANSPORT_COORDINATOR]: 'Transport Coordinator',
  [ROLES.TAXI_BOAT_OPERATOR]: 'Taxi Boat Operator',
  [ROLES.TAXI_BOAT_CAPTAIN]: 'Taxi Boat Captain',
  [ROLES.DA_SUPERVISOR]: 'DA Supervisor',
  [ROLES.CEO]: 'CEO',
  [ROLES.CREW_COORDINATOR]: 'Crew Coordinator',
  [ROLES.DA_COORDINATOR]: 'DA Coordinator',
};
