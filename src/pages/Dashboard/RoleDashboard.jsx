import useAuthReducer from "../../store/AuthReducer";
import { collectUserRoleIdCandidates } from "../../shared/helpers/groUserRoles";
import Dashboard from "./index";
import TransportCoordinatorDashboard from "../TransportCoordinatorDashboard";
import InhouseDriverDashboard from "../InhouseDriverPortal/Dashboard";
import TransportCompanyDashboard from "../TransportPortal/Dashboard";

// role_id → dashboard rendered at /dashboard. Roles not listed get the master Dashboard.
const ROLE_DASHBOARDS = {
  "19": TransportCoordinatorDashboard, // Coordinator Transport
  "15": InhouseDriverDashboard, // Inhouse Driver
  "16": TransportCompanyDashboard, // Transport Company
};

const RoleDashboard = () => {
  const userProfile = useAuthReducer((state) => state.userProfile);
  const roleId = collectUserRoleIdCandidates(userProfile).find((id) => ROLE_DASHBOARDS[id]);
  const DashboardComponent = ROLE_DASHBOARDS[roleId] ?? Dashboard;
  return <DashboardComponent />;
};

export default RoleDashboard;
