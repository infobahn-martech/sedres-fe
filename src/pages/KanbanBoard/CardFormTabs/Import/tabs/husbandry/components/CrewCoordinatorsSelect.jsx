import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Users } from "lucide-react";
import CommonSelect from "@/components/CommonSelect";
import { PREMIUM_SELECT_MODAL_Z_INDEX } from "@/components/form/PremiumSelect";
import crewCoordinatorService from "@/services/crewCoordinatorService";
import userService from "@/services/userService";
import useAlertReducer from "@/store/AlertReducer";
import "@/design/scss/husbandry-crew-coordinators.scss";

// Visual styling lives in husbandry-crew-coordinators.scss (classNamePrefix based).
// Only the portal stacking is set inline so the menu sits above the card modal and
// is never clipped by the scrollable service list.
const SELECT_STYLES = {
  menuPortal: (base) => ({ ...base, zIndex: PREMIUM_SELECT_MODAL_Z_INDEX }),
};

/* users/get_users_by_role role listed as Crew Coordinator options. */
const CREW_COORDINATOR_ROLE_ID = 25;

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

// Options come from users/get_users_by_role (role 25); the call's assigned coordinators come from
// crew_coordinator/get_crew_coordinators/{call_id}. Every change is saved straight
// away through crew_coordinator/assign_crew_coordinators (full replace).
const CrewCoordinatorsSelect = ({ callId, value = [], onChange }) => {
  const [coordinatorUsers, setCoordinatorUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const [assigned, setAssigned] = useState([]);
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    if (!callId) return undefined;
    let cancelled = false;
    setLoading(true);
    crewCoordinatorService
      .getCrewCoordinators(callId)
      .then(({ data }) => {
        if (cancelled) return;
        const list = Array.isArray(data?.data?.crew_coordinators) ? data.data.crew_coordinators : [];
        setAssigned(list);
        onChange(list.map((c) => toId(c.user_id)));
      })
      .catch((err) => {
        if (!cancelled) useAlertReducer.getState().error(getErrorMessage(err, "Failed to load crew coordinators"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId]);

  // Users list plus any assigned coordinator missing from it, so the chip still has a label.
  const options = useMemo(() => {
    const byId = new Map();
    coordinatorUsers.forEach((u) => {
      if (u?.user_id == null) return;
      byId.set(toId(u.user_id), { value: toId(u.user_id), label: u.name ?? "" });
    });
    assigned.forEach((c) => {
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

CrewCoordinatorsSelect.propTypes = {
  callId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  value: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string])),
  onChange: PropTypes.func.isRequired,
};

export default CrewCoordinatorsSelect;
