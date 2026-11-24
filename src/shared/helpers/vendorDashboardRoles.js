import { getStoredRoleId } from './localStorage';
import { ROLES } from '../constants/roles';

/**
 * Third-party portal roles that get a dashboard-only experience: their own
 * landing dashboard, a 2-item sidebar (Dashboard + Invoice Management), and a
 * navbar stripped down to Help/Notifications/Profile.
 */
export const VENDOR_ROLES = {
  INHOUSE_DRIVER: Number(ROLES.INHOUSE_DRIVER),
  TRANSPORT_COMPANY: Number(ROLES.TRANSPORT_COMPANY),
  HOTEL: Number(ROLES.HOTEL),
  HOSPITAL: Number(ROLES.HOSPITAL),
};

const VENDOR_DASHBOARD_CONFIG = {
  [VENDOR_ROLES.INHOUSE_DRIVER]: {
    portal: 'inhouse-driver',
    dashboardPath: '/inhouse-driver/dashboard',
    invoicesPath: '/inhouse-driver/invoices',
  },
  [VENDOR_ROLES.TRANSPORT_COMPANY]: {
    portal: 'transport',
    dashboardPath: '/transport-portal/dashboard',
    invoicesPath: '/transport-portal/invoices',
  },
  [VENDOR_ROLES.HOTEL]: {
    portal: 'hotel',
    dashboardPath: '/hotel-portal/dashboard',
    invoicesPath: '/hotel-portal/invoices',
  },
  [VENDOR_ROLES.HOSPITAL]: {
    portal: 'medical',
    dashboardPath: '/medical-portal/dashboard',
    invoicesPath: '/medical-portal/invoices',
  },
};

/** Safely reads the logged-in user's role_id from the cached profile as a Number, or null if absent/invalid. */
export function getRoleId() {
  const raw = getStoredRoleId();
  const parsed = Number(raw);
  return raw != null && raw !== '' && Number.isFinite(parsed) ? parsed : null;
}

export function isVendorRole(roleId) {
  const n = Number(roleId);
  return Object.values(VENDOR_ROLES).includes(n);
}

/** @returns {{portal: string, dashboardPath: string, invoicesPath: string} | null} */
export function getVendorDashboardByRole(roleId) {
  return VENDOR_DASHBOARD_CONFIG[Number(roleId)] || null;
}

export function isVendorRoleAllowedPath(roleId, pathname) {
  const config = getVendorDashboardByRole(roleId);
  if (!config) return false;
  return pathname === config.dashboardPath || pathname === config.invoicesPath;
}
