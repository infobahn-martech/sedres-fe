import Gateway from '../gateway/gateway';

/** Replaces the call's crew coordinators with `user_ids`. @param {{ call_id: number, user_ids: number[] }} payload */
const assignCrewCoordinators = (payload) => Gateway.post('/crew_coordinator/assign_crew_coordinators', payload);

export default {
  assignCrewCoordinators,
};
