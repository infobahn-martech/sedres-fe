// src/routes/index.jsx

import { createHashRouter } from "react-router-dom";
import App from "../App";
import PublicRoutes from "./PublicRoute";
import PrivateRoutes from "./PrivateRoute";
import RouteGuard from "./RouteGuard";
import Layout from "../structure/Layout";
import DADeskBoard from "../pages/DADeskBoard";
import Dashboard from "../pages/Dashboard";
import Login from "../pages/Authentication";
import ForgetPassword from "../pages/ForgetPassword";
import ResetPassword from "../pages/ResetPassword";
import KanbanBoard from "../pages/KanbanBoard";
import BoardRouter from "../pages/KanbanBoard/components/board/BoardRouter";
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
import TransportCompany from "../pages/TransportCompany";
import Hospital from "../pages/Hospital";
import MedicalServices from "../pages/MedicalServices";
import ThirdPartyService from "../pages/ThirdPartyService";
import HospitalServices from "../pages/HospitalServices";
import MWPHistory from "../pages/MWPHistory";
import KPITasks from "../pages/KPITasks";
import KPIUsers from "../pages/KPIUsers";
import Coordinates from "../pages/Coordinates";
import { ROUTE_PATHS } from "./paths";
import TimeObjects from "../pages/TimeObject";
import StageTimeMappings from "../pages/StageTimeMapping";
import DocumentManagement from "../pages/DocumentManagement";
import DocumentChecklist from "../pages/DocumentChecklist";
import TaskManagement from "../pages/TaskManagement";
import TaskRoles from "../pages/TaskChecklist";
// 🔥 Set true to bypass auth temporarily
const TEST_MODE = false;

const router = createHashRouter([
  {
    element: <App />,
    errorElement: <NotFound />,

    children: [
      // Always available public pages
      { path: "/", element: <Login /> },
      { path: "/forget-password", element: <ForgetPassword /> },

      // Standalone KPI Dashboard (no layout, header, or sidebar)
      { path: "/kpi-dashboard", element: <KPIDashboard /> },
      { path: "/earning-history", element: <KPIDashboard /> },
      { path: "/tasks", element: <KPIDashboard /> },
      { path: "/team-leaderboard", element: <KPIDashboard /> },

      // If TEST MODE, bypass all auth guards
      ...(TEST_MODE
        ? [
          {
            element: <Layout />,
            children: [
              { path: ROUTE_PATHS.DASHBOARD, element: <Dashboard /> },
              { path: "/roles", element: <Role /> },
              { path: "/permissions", element: <Permission /> },
              { path: "/users", element: <User /> },
              { path: "/customer-pricing", element: <CustomerPricing /> },
              { path: "/kanban-board/operator", element: <KanbanBoard /> },
              { path: "/kanban-board/:id/analytics", element: <KanbanAnalytics /> },
              { path: "/kanban-board/analytics", element: <KanbanAnalytics /> },
              { path: "/kanban-board/:boardId", element: <KanbanBoard /> },
              { path: "/da-module", element: <DAModule /> },
              { path: "/workspaces", element: <Workspaces /> },
              { path: "/workspaces/dashboard/:dashboardId", element: <Workspaces /> },
              { path: "/edit-workflow", element: <EditWorkflows /> },
              { path: "/port-management", element: <Port /> },
              { path: "/vessel-types", element: <VesselType /> },
              { path: "/barge-types", element: <BargeType /> },
              { path: "/vessel-onboarding", element: <Vessel /> },
              { path: "/billing-entity", element: <BillingEntity /> },
              { path: "/custom-inspection", element: <CustomInspection /> },
              { path: "/crew-management", element: <Crew /> },
              { path: "/report-management", element: <ReportManagement /> },
              { path: "/activity-log", element: <ActivityLog /> },
              { path: "/notification", element: <Notification /> },
              { path: "/appointment-acceptance", element: <AppointmentAcceptance /> },
              { path: "/pre-arrival-information", element: <PreArrivalInformation /> },
              { path: "/driver-management", element: <Driver /> },
              { path: "/vehicle-management", element: <Vehicle /> },
              { path: "/driver-vehicle-mapping", element: <DriverVehicleMapping /> },
              { path: "/check-list", element: <CheckList /> },
              { path: "/hotel-management", element: <Hotel /> },
              // { path: "/material-type", element: <MaterialType /> },
              { path: "/packing-type", element: <PackingType /> },
              { path: "/logistics-warehouse", element: <LogisticsWarehouse /> },
              { path: "/document-checklist", element: <DocumentChecklist /> },
              { path: "/status-management", element: <StatusManagement /> },
              { path: "/custom-fields", element: <CustomFields /> },
              { path: "/job-status", element: <JobStatusBE /> },
              { path: "/group-email", element: <GroupEmailBE /> },
              { path: "/billing-instruction", element: <BillingInstruction /> },
              { path: "/captains", element: <Captains /> },
              { path: ROUTE_PATHS.OPERATORS, element: <Operators /> },
              { path: "/location", element: <Location /> },
              { path: "/service-providers", element: <ServiceProviders /> },
              { path: "/transport-parties", element: <TransportParties /> },
              { path: "/waste-types", element: <WasteTypes /> },
              { path: "/settings", element: <h1>Settings</h1> },
              { path: "/vendor-portal/dashboard", element: <VendorPortalDashboard /> },
              { path: "/vendor-portal/invoices", element: <VendorPortalInvoices /> },
              { path: "/vendor-portal/orders", element: <VendorPortalOrders /> },
              { path: "/transport-company", element: <TransportCompany /> },
              { path: "/kpi-tasks", element: <KPITasks /> },
              { path: "/kpi-users", element: <KPIUsers /> },
            ],
          },
        ]
        : [
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
                  // Workspaces
                  { path: "/workspaces", element: <RouteGuard><Workspaces /></RouteGuard> },
                  {
                    path: "/workspaces/dashboard/:dashboardId",
                    element: (
                      <RouteGuard>
                        <Workspaces />
                      </RouteGuard>
                    ),
                  },
                  // Edit Workflow
                  { path: "/edit-workflow", element: <RouteGuard><EditWorkflows /></RouteGuard> },
                  // Role Management - Super Admin, Admin only
                  { path: "/roles", element: <RouteGuard><Role /></RouteGuard> },
                  { path: "/permissions", element: <RouteGuard><Permission /></RouteGuard> },
                  // User Management
                  { path: "/users", element: <RouteGuard><User /></RouteGuard> },
                  // Port Management
                  { path: "/port-management", element: <RouteGuard><Port /></RouteGuard> },
                  // Vessel Types
                  { path: "/vessel-types", element: <RouteGuard><VesselType /></RouteGuard> },
                  // Barge Types
                  { path: "/barge-types", element: <RouteGuard><BargeType /></RouteGuard> },
                  // Vessel Onboarding
                  { path: "/vessel-onboarding", element: <RouteGuard><Vessel /></RouteGuard> },
                  // Billing Entity
                  { path: "/billing-entity", element: <RouteGuard><BillingEntity /></RouteGuard> },
                  // Customer Pricing
                  { path: "/customer-pricing", element: <RouteGuard><CustomerPricing /></RouteGuard> },
                  // Custom Inspection
                  { path: "/custom-inspection", element: <RouteGuard><CustomInspection /></RouteGuard> },
                  // Crew Management
                  { path: "/crew-management", element: <RouteGuard><Crew /></RouteGuard> },
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
                  // Job Status BE
                  { path: "/job-status", element: <RouteGuard><JobStatusBE /></RouteGuard> },
                  // Group Email BE
                  { path: "/group-email", element: <RouteGuard><GroupEmailBE /></RouteGuard> },
                  // Billing Instruction
                  { path: "/billing-instruction", element: <RouteGuard><BillingInstruction /></RouteGuard> },
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
                  // Transport Company
                  { path: "/transport-company", element: <RouteGuard><TransportCompany /></RouteGuard> },
                  { path: "/hospital-management", element: <RouteGuard><Hospital /></RouteGuard> },
                  { path: "/medical-services", element: <RouteGuard><MedicalServices /></RouteGuard> },
                  { path: "/third-party-service", element: <RouteGuard><ThirdPartyService /></RouteGuard> },
                  { path: "/transport-company", element: <RouteGuard><TransportCompany /></RouteGuard> },
                  { path: "/hospital-services", element: <RouteGuard><HospitalServices /></RouteGuard> },
                  { path: ROUTE_PATHS.MWP_HISTORY, element: <RouteGuard><MWPHistory /></RouteGuard> },
                  { path: "/kpi-tasks", element: <RouteGuard><KPITasks /></RouteGuard> },
                  { path: "/kpi-users", element: <RouteGuard><KPIUsers /></RouteGuard> },
                  { path: "/coordinates", element: <RouteGuard><Coordinates /></RouteGuard> },
                  { path: "/time-objects", element: <RouteGuard><TimeObjects /></RouteGuard> },
                  { path: "/stage-time-mappings", element: <RouteGuard><StageTimeMappings /></RouteGuard> },
                  { path: "/document-management", element: <RouteGuard><DocumentManagement /></RouteGuard> },
                  { path: "/document-checklist", element: <RouteGuard><DocumentChecklist /></RouteGuard> },
                  { path: "/task-management", element: <RouteGuard><TaskManagement /></RouteGuard> },
                  { path: "/task-roles", element: <RouteGuard><TaskRoles /></RouteGuard> },
                ],
              },
            ],
          },
        ]),
    ],
  },
]);

export default router;
