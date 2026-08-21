// src/routes/index.jsx

import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import PublicRoutes from "./PublicRoute";
import PrivateRoutes from "./PrivateRoute";
import RouteGuard from "./RouteGuard";
import PermissionRoute from "./PermissionRoute";
import { PERMISSION_MODULES, PERMISSION_SUBMODULES, PERMISSION_ACTIONS } from "../shared/constants/permissions";
import Layout from "../structure/Layout";
import DADeskBoard from "../pages/DADeskBoard";
import Dashboard from "../pages/Dashboard";
import Login from "../pages/Authentication";
import ForgetPassword from "../pages/ForgetPassword";
import ResetPassword from "../pages/ResetPassword";
import KanbanBoard from "../pages/KanbanBoard";
import KanbanAnalytics from "../pages/KanbanBoard/pages/AnalyticsPage";
import DAModule from "../pages/DAModule";
import Workspaces from "../pages/Workspaces";
import EditWorkflows from "../pages/EditWorkflows";
import Port from "../pages/Port";
import Role from "../pages/Role";
import Permission from "../pages/Permission";
import User from "../pages/User";
import VesselType from "../pages/VesselType";
import BillingEntity from "../pages/BillingEntity";
import Vessel from "../pages/Vessel";
import CustomerPricing from "../pages/CustomerPricing";
import CustomerPricingInfobhan from "../pages/CustomerPricingInfobhan";
import BargeType from "../pages/BargeType";
import CustomInspection from "../pages/CustomInspection";
import Crew from "../pages/Crew";
import ActivityLog from "../pages/ActivityLog";
import ReportManagement from "../pages/ReportManagement";
import Notification from "../pages/Notification";
import KPIDashboard from "../pages/KPIDashboard";
import AppointmentAcceptance from "../pages/AppointmentAcceptance";
import PreArrivalInformation from "../pages/PreArrivalInformation";
import Driver from "../pages/Driver";
import Vehicle from "../pages/Vehicle";
import CheckList from "../pages/CheckList";
import DriverVehicleMapping from "../pages/DriverVehicleMapping";
import Hotel from "../pages/Hotel";
import StatusManagement from "../pages/StatusManagement";
// import MaterialType from "../pages/MaterialType";
import PackingType from "../pages/PackingType";
import LogisticsWarehouse from "../pages/LogisticsWarehouse";
import OrderHistory from "../pages/OrderHistory";
import CustomFields from "../pages/CustomFields";
import JobStatusBE from "../pages/JobStatusBE";
import GroupEmailBE from "../pages/GroupEmailBE";
import BillingInstruction from "../pages/BillingInstruction";
import Captains from "../pages/Captains";
import Operators from "../pages/Operators";
import Location from "../pages/Location";
import ServiceProviders from "../pages/ServiceProviders";
import TransportParties from "../pages/TransportParties";
import WasteTypes from "../pages/WasteTypes";
import NotFound from "../pages/NotFound";
import Compact from "../pages/Compact";
import JubailOperations from "../pages/JubailOperations";
import RastanuraDammamOperations from "../pages/RastanuraDammamOperations";
import CoordinatorTransport from "../pages/CoordinatorTransport";
import RastanuraOperations from "../pages/RastanuraOperations";
import DriverBoard from "../pages/DriverBoard";
import TBCBoard from "../pages/TBCBoard";
import TBOBoard from "../pages/TBOBoard";
import MWPBoard from "../pages/MWPBoard";
import GROBoard from "../pages/GROBoard";
import HotelBoard from "../pages/HotelBoard";
import AdminBoard from "../pages/AdminBoard";
import LHServices from "../pages/LHServices";
import Fleet from "../pages/Fleet";
import CrewTemplate from "../pages/CrewTemplate";
import VendorPortalDashboard from "../pages/VendorPortal/Dashboard";
import VendorPortalInvoices from "../pages/VendorPortal/Invoices";
import VendorPortalOrders from "../pages/VendorPortal/Orders";
import MedicalDashboard from "../pages/MedicalPortal/Dashboard";
import MedicalPortalInvoices from "../pages/MedicalPortal/Invoices";
import TransportDashboard from "../pages/TransportPortal/Dashboard";
import TransportPortalInvoices from "../pages/TransportPortal/Invoices";
import InhouseDriverDashboard from "../pages/InhouseDriverPortal/Dashboard";
import InhouseDriverPortalInvoices from "../pages/InhouseDriverPortal/Invoices";
import HotelPortalDashboard from "../pages/HotelPortal/Dashboard";
import HotelPortalInvoices from "../pages/HotelPortal/Invoices";
import TransportCompany from "../pages/TransportCompany";
import Hospital from "../pages/Hospital";
import MedicalServices from "../pages/MedicalServices";
import ThirdPartyService from "../pages/ThirdPartyService";
import HospitalServices from "../pages/HospitalServices";
import MWPHistory from "../pages/MWPHistory";
import KPITasks from "../pages/KPITasks";
import KPIUsers from "../pages/KPIUsers";
import Coordinates from "../pages/Coordinates";
import CGPassTemplate from "../pages/CGPassTemplate";
import VesselRegistrationTemplate from "../pages/VesselRegistrationTemplate";
import { ROUTE_PATHS } from "./paths";
import TimeObjects from "../pages/TimeObject";
import StageTimeMappings from "../pages/StageTimeMapping";
import DocumentManagement from "../pages/DocumentManagement";
import DocumentChecklist from "../pages/DocumentChecklist";
import TaskManagement from "../pages/TaskManagement";
import TaskRoles from "../pages/TaskChecklist";
import TugType from "../pages/TugType";
import BusinessRules from "../pages/BusinessRules";
import CeoApproval from "../pages/CeoApproval";
const router = createBrowserRouter(
  [
    {
      element: <App />,
      errorElement: <NotFound />,

      children: [
        // Always available public pages
        { path: "/", element: <Login /> },
        { path: "/forget-password", element: <ForgetPassword /> },
        { path: "/users/reset_password_form", element: <ResetPassword /> },

        // Standalone KPI Dashboard (no layout, header, or sidebar)
        { path: "/kpi-dashboard", element: <KPIDashboard /> },
        { path: "/earning-history", element: <KPIDashboard /> },
        { path: "/tasks", element: <KPIDashboard /> },
        { path: "/team-leaderboard", element: <KPIDashboard /> },
        { path: "/level-management", element: <KPIDashboard /> },

        // PUBLIC ROUTES (only login, forgot password)
        {
          element: <PublicRoutes />,
          children: [
            { path: "/", element: <Login /> },
            { path: "/forget-password", element: <ForgetPassword /> },
            { path: "/reset-password", element: <ResetPassword /> },
          ],
        },

        // PRIVATE ROUTES (must be logged in)
        {
          element: <PrivateRoutes />,
          children: [
            {
              element: <Layout />,
              children: [
                // Dashboard - All roles
                { path: ROUTE_PATHS.DASHBOARD, element: <RouteGuard><Dashboard /></RouteGuard> },
                // Kanban Board - with dynamic ID support
                { path: "/kanban-board/centralized-da-desk", element: <RouteGuard><DADeskBoard /></RouteGuard> },
                { path: "/kanban-board/jubail-operations", element: <RouteGuard><JubailOperations /></RouteGuard> },
                { path: "/kanban-board/rastanura-dammam-operations", element: <RouteGuard><RastanuraDammamOperations /></RouteGuard> },
                { path: "/kanban-board/coordinator-transport", element: <RouteGuard><CoordinatorTransport /></RouteGuard> },
                { path: "/kanban-board/ras-tanura-operations", element: <RouteGuard><RastanuraOperations /></RouteGuard> },
                { path: "/kanban-board/driver", element: <RouteGuard><DriverBoard /></RouteGuard> },
                { path: "/kanban-board/taxi-boat-captain", element: <RouteGuard><TBCBoard /></RouteGuard> },
                { path: "/kanban-board/taxi-boat-operator", element: <RouteGuard><TBOBoard /></RouteGuard> },
                { path: "/kanban-board/mwp", element: <RouteGuard><MWPBoard /></RouteGuard> },
                { path: "/kanban-board/gro", element: <RouteGuard><GROBoard /></RouteGuard> },
                { path: "/kanban-board/hotel", element: <RouteGuard><HotelBoard /></RouteGuard> },
                { path: "/kanban-board/admin", element: <RouteGuard><AdminBoard /></RouteGuard> },
                { path: "/kanban-board/operator", element: <RouteGuard><KanbanBoard /></RouteGuard> },
                { path: "/compact", element: <RouteGuard><Compact /></RouteGuard> },
                // Kanban Board Analytics
                { path: "/kanban-board/:id/analytics", element: <RouteGuard><KanbanAnalytics /></RouteGuard> },
                { path: "/kanban-board/analytics", element: <RouteGuard><KanbanAnalytics /></RouteGuard> },
                { path: "/kanban-board/:boardId", element: <RouteGuard><KanbanBoard /></RouteGuard> },
                // DA Module
                { path: "/da-module", element: <RouteGuard><DAModule /></RouteGuard> },
                // Workspaces — fully migrated feature: the permission response is
                // authoritative here (permissionOnly), the legacy role table is not consulted.
                {
                  path: "/workspaces",
                  element: (
                    <PermissionRoute
                      moduleKey={PERMISSION_MODULES.KANBAN_WORKSPACE}
                      actionKey={PERMISSION_ACTIONS.VIEW_WORKSPACE}
                      permissionOnly
                    >
                      <Workspaces />
                    </PermissionRoute>
                  ),
                },
                {
                  path: "/workspaces/dashboard/:dashboardId",
                  element: (
                    <PermissionRoute
                      moduleKey={PERMISSION_MODULES.KANBAN_WORKSPACE}
                      actionKey={PERMISSION_ACTIONS.VIEW_WORKSPACE}
                      permissionOnly
                    >
                      <Workspaces />
                    </PermissionRoute>
                  ),
                },
                // Edit Workflow
                {
                  path: "/edit-workflow",
                  element: (
                    <PermissionRoute
                      moduleKey={PERMISSION_MODULES.KANBAN_WORKFLOW}
                      actionKey={PERMISSION_ACTIONS.VIEW_WORKFLOW}
                      permissionOnly
                    >
                      <EditWorkflows />
                    </PermissionRoute>
                  ),
                },
                // Role Management - Super Admin, Admin only
                { path: "/roles", element: <RouteGuard><Role /></RouteGuard> },
                {
                  path: "/permissions",
                  element: (
                    <PermissionRoute
                      moduleKey={PERMISSION_MODULES.USER_MANAGEMENT}
                      submoduleKey={PERMISSION_SUBMODULES.PERMISSIONS}
                      actionKey={PERMISSION_ACTIONS.VIEW}
                      permissionOnly
                    >
                      <Permission />
                    </PermissionRoute>
                  ),
                },
                // User Management
                {
                  path: "/users",
                  element: (
                    // Fully migrated feature: the permission response is authoritative
                    // here (permissionOnly), the legacy role table is not consulted.
                    <PermissionRoute
                      moduleKey={PERMISSION_MODULES.USER_MANAGEMENT}
                      submoduleKey={PERMISSION_SUBMODULES.USERS}
                      actionKey={PERMISSION_ACTIONS.VIEW}
                      permissionOnly
                    >
                      <User />
                    </PermissionRoute>
                  ),
                },
                // Port Management
                { path: "/port-management", element: <RouteGuard><Port /></RouteGuard> },
                // Vessel Types
                { path: "/vessel-types", element: <RouteGuard><VesselType /></RouteGuard> },
                // Barge Types
                { path: "/barge-types", element: <RouteGuard><BargeType /></RouteGuard> },
                { path: "/tug-type", element: <RouteGuard><TugType /></RouteGuard> },
                // Vessel Onboarding
                { path: "/vessel-onboarding", element: <RouteGuard><Vessel /></RouteGuard> },
                // Billing Entity
                {
                  path: "/billing-entity",
                  element: (
                    <PermissionRoute
                      moduleKey={PERMISSION_MODULES.ENTITY_MANAGEMENT}
                      submoduleKey={PERMISSION_SUBMODULES.BILLING_ENTITY}
                      actionKey={PERMISSION_ACTIONS.LIST}
                      permissionOnly
                    >
                      <BillingEntity />
                    </PermissionRoute>
                  ),
                },
                // Customer Pricing
                {
                  path: "/customer-pricing",
                  element: (
                    <PermissionRoute
                      moduleKey={PERMISSION_MODULES.ENTITY_MANAGEMENT}
                      submoduleKey={PERMISSION_SUBMODULES.CUSTOMER_PRICING}
                      actionKey={PERMISSION_ACTIONS.LIST}
                      permissionOnly
                    >
                      <CustomerPricing />
                    </PermissionRoute>
                  ),
                },
                // Customer Pricing Infobhan
                { path: "/customer-pricing-infobhan", element: <RouteGuard><CustomerPricingInfobhan /></RouteGuard> },
                // Custom Inspection
                { path: "/custom-inspection", element: <RouteGuard><CustomInspection /></RouteGuard> },
                // Crew Management
                {
                  path: "/crew-management",
                  element: (
                    <PermissionRoute
                      moduleKey={PERMISSION_MODULES.ENTITY_MANAGEMENT}
                      submoduleKey={PERMISSION_SUBMODULES.CREW_MANAGEMENT}
                      actionKey={PERMISSION_ACTIONS.LIST}
                      permissionOnly
                    >
                      <Crew />
                    </PermissionRoute>
                  ),
                },
                // Report Management
                { path: "/report-management", element: <RouteGuard><ReportManagement /></RouteGuard> },
                // Activity Log
                { path: "/activity-log", element: <RouteGuard><ActivityLog /></RouteGuard> },
                // Notification
                { path: "/notification", element: <RouteGuard><Notification /></RouteGuard> },
                // Appointment Acceptance
                { path: "/appointment-acceptance", element: <RouteGuard><AppointmentAcceptance /></RouteGuard> },
                // Pre Arrival Information
                { path: "/pre-arrival-information", element: <RouteGuard><PreArrivalInformation /></RouteGuard> },
                // Driver Management
                { path: "/driver-management", element: <RouteGuard><Driver /></RouteGuard> },
                // Vehicle Management
                { path: "/vehicle-management", element: <RouteGuard><Vehicle /></RouteGuard> },
                // Driver Vehicle Mapping
                { path: "/driver-vehicle-mapping", element: <RouteGuard><DriverVehicleMapping /></RouteGuard> },
                // Check List
                { path: "/check-list", element: <RouteGuard><CheckList /></RouteGuard> },
                // Hotel Management
                { path: "/hotel-management", element: <RouteGuard><Hotel /></RouteGuard> },
                // Material Type
                // { path: "/material-type", element: <RouteGuard><MaterialType /></RouteGuard> },
                // Packing Type
                { path: "/packing-type", element: <RouteGuard><PackingType /></RouteGuard> },
                // Logistics Warehouse
                { path: "/logistics-warehouse", element: <RouteGuard><LogisticsWarehouse /></RouteGuard> },
                // Order History
                { path: "/order-history", element: <RouteGuard><OrderHistory /></RouteGuard> },
                // Document Checklist
                { path: "/document-checklist", element: <RouteGuard><DocumentChecklist /></RouteGuard> },
                // Task Management
                { path: "/task-management", element: <RouteGuard><TaskManagement /></RouteGuard> },
                // Status Management
                { path: "/status-management", element: <RouteGuard><StatusManagement /></RouteGuard> },
                // Custom Fields
                { path: "/custom-fields", element: <RouteGuard><CustomFields /></RouteGuard> },
                // Crew Template
                { path: "/crew-template", element: <RouteGuard><CrewTemplate /></RouteGuard> },
                { path: "/cg-pass-template", element: <RouteGuard><CGPassTemplate /></RouteGuard> },
                { path: "/vessel-registration-template", element: <RouteGuard><VesselRegistrationTemplate /></RouteGuard> },
                // Job Status BE
                { path: "/job-status", element: <RouteGuard><JobStatusBE /></RouteGuard> },
                // Group Email BE
                {
                  path: "/group-email",
                  element: (
                    <PermissionRoute
                      moduleKey={PERMISSION_MODULES.ENTITY_MANAGEMENT}
                      submoduleKey={PERMISSION_SUBMODULES.GROUP_EMAIL}
                      actionKey={PERMISSION_ACTIONS.LIST}
                      permissionOnly
                    >
                      <GroupEmailBE />
                    </PermissionRoute>
                  ),
                },
                // Billing Instruction
                {
                  path: "/billing-instruction",
                  element: (
                    <PermissionRoute
                      moduleKey={PERMISSION_MODULES.ENTITY_MANAGEMENT}
                      submoduleKey={PERMISSION_SUBMODULES.BILLING_INSTRUCTION}
                      actionKey={PERMISSION_ACTIONS.LIST}
                      permissionOnly
                    >
                      <BillingInstruction />
                    </PermissionRoute>
                  ),
                },
                // Captains
                { path: "/captains", element: <RouteGuard><Captains /></RouteGuard> },
                // Fleet
                { path: "/fleet", element: <RouteGuard><Fleet /></RouteGuard> },
                // LH Services
                { path: "/lh-services", element: <RouteGuard><LHServices /></RouteGuard> },
                // Operators
                { path: ROUTE_PATHS.OPERATORS, element: <RouteGuard><Operators /></RouteGuard> },
                // Location
                { path: "/location", element: <RouteGuard><Location /></RouteGuard> },
                // Service Providers
                { path: "/service-providers", element: <RouteGuard><ServiceProviders /></RouteGuard> },
                // Transport Parties
                { path: "/transport-parties", element: <RouteGuard><TransportParties /></RouteGuard> },
                // Waste Types
                { path: "/waste-types", element: <RouteGuard><WasteTypes /></RouteGuard> },
                // Settings
                { path: "/settings", element: <RouteGuard><h1>Settings</h1></RouteGuard> },
                // Vendor Portal
                { path: "/vendor-portal/dashboard", element: <RouteGuard><VendorPortalDashboard /></RouteGuard> },
                { path: "/vendor-portal/invoices", element: <RouteGuard><VendorPortalInvoices /></RouteGuard> },
                { path: "/vendor-portal/orders", element: <RouteGuard><VendorPortalOrders /></RouteGuard> },
                // Medical Portal
                { path: "/medical-portal/dashboard", element: <RouteGuard><MedicalDashboard /></RouteGuard> },
                { path: "/medical-portal/invoices", element: <RouteGuard><MedicalPortalInvoices /></RouteGuard> },
                // Transport Company Portal
                { path: "/transport-portal/dashboard", element: <RouteGuard><TransportDashboard /></RouteGuard> },
                { path: "/transport-portal/invoices", element: <RouteGuard><TransportPortalInvoices /></RouteGuard> },
                // Inhouse Driver Portal
                { path: "/inhouse-driver/dashboard", element: <RouteGuard><InhouseDriverDashboard /></RouteGuard> },
                { path: "/inhouse-driver/invoices", element: <RouteGuard><InhouseDriverPortalInvoices /></RouteGuard> },
                // Hotel Portal
                { path: "/hotel-portal/dashboard", element: <RouteGuard><HotelPortalDashboard /></RouteGuard> },
                { path: "/hotel-portal/invoices", element: <RouteGuard><HotelPortalInvoices /></RouteGuard> },
                // Transport Company
                { path: "/transport-company", element: <RouteGuard><TransportCompany /></RouteGuard> },
                { path: "/hospital-management", element: <RouteGuard><Hospital /></RouteGuard> },
                { path: "/medical-services", element: <RouteGuard><MedicalServices /></RouteGuard> },
                { path: "/third-party-service", element: <RouteGuard><ThirdPartyService /></RouteGuard> },
                { path: "/hospital-services", element: <RouteGuard><HospitalServices /></RouteGuard> },
                {
                  path: ROUTE_PATHS.MWP_HISTORY,
                  element: (
                    <PermissionRoute
                      moduleKey={PERMISSION_MODULES.ENTITY_MANAGEMENT}
                      submoduleKey={PERMISSION_SUBMODULES.MWP_HISTORY}
                      actionKey={PERMISSION_ACTIONS.LIST}
                      permissionOnly
                    >
                      <MWPHistory />
                    </PermissionRoute>
                  ),
                },
                { path: "/kpi-tasks", element: <RouteGuard><KPITasks /></RouteGuard> },
                { path: "/kpi-users", element: <RouteGuard><KPIUsers /></RouteGuard> },
                { path: "/coordinates", element: <RouteGuard><Coordinates /></RouteGuard> },
                { path: "/time-objects", element: <RouteGuard><TimeObjects /></RouteGuard> },
                { path: "/stage-time-mappings", element: <RouteGuard><StageTimeMappings /></RouteGuard> },
                { path: "/document-management", element: <RouteGuard><DocumentManagement /></RouteGuard> },
                { path: "/document-checklist", element: <RouteGuard><DocumentChecklist /></RouteGuard> },
                { path: "/task-management", element: <RouteGuard><TaskManagement /></RouteGuard> },
                { path: "/task-roles", element: <RouteGuard><TaskRoles /></RouteGuard> },
                { path: "/business-rules", element: <RouteGuard><BusinessRules /></RouteGuard> },
                // CEO Export Approval email deep link
                { path: ROUTE_PATHS.CEO_APPROVAL, element: <RouteGuard><CeoApproval /></RouteGuard> },
              ],
            },
          ],
        },
      ],
    },
  ],
  {
    basename: import.meta.env.BASE_URL.replace(/\/$/, ""),
  }
);

export default router;
