import useAuthReducer from "../../store/AuthReducer";
import { collectUserRoleIdCandidates } from "../../shared/helpers/groUserRoles";
import Dashboard from "./index";
import TransportCoordinatorDashboard from "../TransportCoordinatorDashboard";

// role_id → dashboard rendered at /dashboard. Roles not listed get the master Dashboard.
const ROLE_DASHBOARDS = {
  "19": TransportCoordinatorDashboard, // Coordinator Transport
};

const RoleDashboard = () => {
  const userProfile = useAuthReducer((state) => state.userProfile);
  const roleId = collectUserRoleIdCandidates(userProfile).find((id) => ROLE_DASHBOARDS[id]);
  const DashboardComponent = ROLE_DASHBOARDS[roleId] ?? Dashboard;
  return <DashboardComponent />;
};

export default RoleDashboard;
