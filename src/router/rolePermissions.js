// Role-based route permissions. Role ids: shared/constants/roles.js.
//
// Only Port Manager, Port Operator, Super Admin, DA Supervisor, CEO, Crew Coordinator
// and DA Coordinator reach this table. Desk roles (4, 5, 6, 8, 9, 10, 19, 20, 21) and
// vendor roles (15, 16, 17, 18) are routed earlier in RouteGuard.jsx.
import { ROUTE_PATHS } from "./paths";
import { ROLES } from "../shared/constants/roles";

/** Roles that may open every route, skipping the table below. */
const UNRESTRICTED_ROUTE_ROLE_IDS = new Set([
  ROLES.PORT_MANAGER,
  ROLES.SUPER_ADMIN,
  ROLES.DA_SUPERVISOR,
]);

const hasUnrestrictedRouteAccess = (userRoleId) =>
  UNRESTRICTED_ROUTE_ROLE_IDS.has(String(userRoleId));

// Routes and the roles allowed on them. A route missing from this table is open to everyone.
export const routePermissions = {
  [ROUTE_PATHS.DASHBOARD]: [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/kanban-board": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/kanban-board/operator": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/compact": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/workspaces": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/edit-workflow": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/roles": [ROLES.PORT_OPERATOR],
  "/permissions": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/users": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/port-management": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/vessel-types": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/barge-types": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/vessel-onboarding": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/billing-entity": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/customer-pricing": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/customer-pricing-infobhan": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/custom-inspection": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/crew-management": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/report-management": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/activity-log": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/notification": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/appointment-acceptance": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/pre-arrival-information": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/driver-management": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/vehicle-management": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/driver-vehicle-mapping": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/time-objects": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/stage-time-mappings": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/check-list": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/hotel-management": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/material-type": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/packing-type": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/logistics-warehouse": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/order-history": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/document-checklist": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/status-management": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/custom-fields": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/job-status": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/group-email": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/billing-instruction": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/captains": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/fleet": [ROLES.PORT_OPERATOR, ROLES.CEO],
  [ROUTE_PATHS.OPERATORS]: [ROLES.PORT_OPERATOR, ROLES.CEO],
  [ROUTE_PATHS.MWP_HISTORY]: [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/lh-services": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/transport-company": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/hospital-management": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/medical-services": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/hospital-services": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/third-party-service": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/crew-template": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/kpi-dashboard": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/kpi-tasks": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/kpi-users": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/da-module": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/vendor-portal/dashboard": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/vendor-portal/invoices": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/vendor-portal/orders": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/location": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/service-providers": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/transport-parties": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/waste-types": [ROLES.PORT_OPERATOR, ROLES.CEO],
  "/settings": [ROLES.PORT_OPERATOR, ROLES.CEO],
  // CEO email-approval deep link — CEO-only. Without this entry, hasRouteAccess's
  // "unlisted route = allow" fallback let any logged-in user reach the Approve
  // action by navigating to the URL directly.
  "/approval/ceo": [ROLES.CEO],
  // Vendor-role master pages — granted via roleMasterMenuAccess, not this table.
  "/trip-management": [],
  "/order-management": [],
  "/invoice-management": [],
};

// Helper function to check if a role has access to a route
export const hasRouteAccess = (userRoleId, routePath) => {
  if (hasUnrestrictedRouteAccess(userRoleId)) {
    return true;
  }

  // First, try exact match
  let allowedRoles = routePermissions[routePath];

  // If no exact match, check if routePath starts with any base route
  // This handles dynamic routes like /kanban-board/123 or /kanban-board/123/analytics
  if (!allowedRoles) {
    // Find matching base route by checking if routePath starts with any route in routePermissions
    const matchingRoute = Object.keys(routePermissions).find(baseRoute => {
      // Match exact route or route with trailing path segments
      // e.g., /kanban-board matches /kanban-board/123 or /kanban-board/123/analytics
      return routePath === baseRoute || routePath.startsWith(baseRoute + '/');
    });

    if (matchingRoute) {
      allowedRoles = routePermissions[matchingRoute];
    }
  }

  if (!allowedRoles) {
    return true; // Do not block valid app routes that are missing from config
  }

  return allowedRoles.includes(userRoleId);
};

