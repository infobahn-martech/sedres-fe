import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Users } from "lucide-react";
import CommonSelect from "@/components/CommonSelect";
import { PREMIUM_SELECT_MODAL_Z_INDEX } from "@/components/form/PremiumSelect";
import crewCoordinatorService from "@/services/crewCoordinatorService";
import userService from "@/services/userService";
import useAlertReducer from "@/store/AlertReducer";
import useAuthReducer from "@/store/AuthReducer";
import { getFirstUserRoleId } from "@/shared/helpers/groUserRoles";
import { ROLES } from "@/shared/constants/roles";
import "@/design/scss/husbandry-crew-coordinators.scss";

// Visual styling lives in husbandry-crew-coordinators.scss (classNamePrefix based).
// Only the portal stacking is set inline so the menu sits above the card modal and
// is never clipped by the scrollable service list.
const SELECT_STYLES = {
  menuPortal: (base) => ({ ...base, zIndex: PREMIUM_SELECT_MODAL_Z_INDEX }),
};

/* users/get_users_by_role role listed as Crew Coordinator options. */
const CREW_COORDINATOR_ROLE_ID = Number(ROLES.CREW_COORDINATOR);

// Session cache so reopening the tab/card doesn't refetch the role's users; a failed
// request is dropped so the next mount retries.
let coordinatorUsersRequest = null;
const fetchCoordinatorUsers = () => {
  if (!coordinatorUsersRequest) {
    coordinatorUsersRequest = userService
      .getUsersByRole({ role_id: CREW_COORDINATOR_ROLE_ID })
      .then(({ data }) => (Array.isArray(data?.data) ? data.data : []))
      .catch((err) => {
        coordinatorUsersRequest = null;
        throw err;
      });
  }
  return coordinatorUsersRequest;
};

const toId = (v) => String(v);
const getErrorMessage = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

// Options come from users/get_users_by_role (role 25); the call's assigned coordinators
// (`assigned`) come from the parent's call_file/get_service_counts response — null while
// it is loading. Every change is saved straight away through
// crew_coordinator/assign_crew_coordinators (full replace).
const CrewCoordinatorsSelect = ({ callId, value = [], onChange, assigned = null }) => {
  const [coordinatorUsers, setCoordinatorUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const loading = Boolean(callId) && assigned === null;
  const [saving, setSaving] = useState(false);
  const saveSeq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setUsersLoading(true);
    fetchCoordinatorUsers()
      .then((list) => {
        if (!cancelled) setCoordinatorUsers(list);
      })
      .catch((err) => {
        if (!cancelled) {
          setCoordinatorUsers([]);
          useAlertReducer.getState().error(getErrorMessage(err, "Failed to load crew coordinator users"));
        }
      })
      .finally(() => {
        if (!cancelled) setUsersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync the selection whenever the parent delivers the call's assigned coordinators.
  useEffect(() => {
    if (!Array.isArray(assigned)) return;
    onChange(assigned.map((c) => toId(c.user_id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assigned]);

  // Users list plus any assigned coordinator missing from it, so the chip still has a label.
  const options = useMemo(() => {
    const byId = new Map();
    coordinatorUsers.forEach((u) => {
      if (u?.user_id == null) return;
      byId.set(toId(u.user_id), { value: toId(u.user_id), label: u.name ?? "" });
    });
    (assigned ?? []).forEach((c) => {
      const id = toId(c.user_id);
      if (!byId.has(id)) byId.set(id, { value: id, label: c.name ?? "" });
    });
    return Array.from(byId.values());
  }, [coordinatorUsers, assigned]);

  const normalizedValue = useMemo(() => value.map(toId), [value]);

  const handleChange = async (selected) => {
    const nextIds = (selected || []).map((opt) => toId(opt.value));
    const prevIds = normalizedValue;
    onChange(nextIds);
    if (!callId) return;

    const seq = ++saveSeq.current;
    setSaving(true);
    try {
      const { data } = await crewCoordinatorService.assignCrewCoordinators({
        call_id: Number(callId),
        user_ids: nextIds.map(Number),
      });
      if (data?.status && data.status !== "success") {
        throw new Error(data?.message || "Failed to assign crew coordinators");
      }
    } catch (err) {
      if (seq === saveSeq.current) {
        onChange(prevIds);
        useAlertReducer.getState().error(getErrorMessage(err, "Failed to assign crew coordinators"));
      }
    } finally {
      if (seq === saveSeq.current) setSaving(false);
    }
  };

  const isBusy = loading || usersLoading;

  return (
    <div className="crew-coordinators-field">
      <label className="crew-coordinators-label" htmlFor="crew-coordinators-select">
        <Users size={14} strokeWidth={2} aria-hidden="true" />
        <span>Crew Coordinators</span>
      </label>
      <CommonSelect
        inputId="crew-coordinators-select"
        isMulti
        isSearchable
        showIndicator
        options={options}
        value={normalizedValue}
        onChange={handleChange}
        placeholder={isBusy ? "Loading coordinators..." : "Select crew coordinators"}
        noOptionsMessage={isBusy ? "Loading..." : "No coordinators found"}
        isDisabled={!callId || loading}
        isLoading={isBusy || saving}
        className="crew-coordinators-select"
        classNamePrefix="crew-coord-select"
        maxheight={220}
        styles={SELECT_STYLES}
        aria-label="Crew Coordinators"
      />
    </div>
  );
};

// Only Port Manager (role_id 1) and Port Operator (role_id 2) see / manage Crew Coordinators.
// Gated in a wrapper so other roles don't mount the select (no users fetch either).
const CREW_COORDINATOR_EDITOR_ROLE_IDS = [ROLES.PORT_MANAGER, ROLES.PORT_OPERATOR];

const RoleGatedCrewCoordinatorsSelect = (props) => {
  const userProfile = useAuthReducer((state) => state.userProfile);
  const userRoleId = String(getFirstUserRoleId(userProfile) ?? "");
  if (!CREW_COORDINATOR_EDITOR_ROLE_IDS.includes(userRoleId)) return null;
  return <CrewCoordinatorsSelect {...props} />;
};

CrewCoordinatorsSelect.propTypes = {
  callId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  value: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string])),
  onChange: PropTypes.func.isRequired,
  assigned: PropTypes.arrayOf(
    PropTypes.shape({
      user_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      name: PropTypes.string,
    })
  ),
};

RoleGatedCrewCoordinatorsSelect.propTypes = CrewCoordinatorsSelect.propTypes;

export default RoleGatedCrewCoordinatorsSelect;
