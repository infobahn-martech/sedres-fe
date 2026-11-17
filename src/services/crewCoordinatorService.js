import Gateway from '../gateway/gateway';

/** @returns {Promise<{ data: { status: string, data: { call_id: number, operator_card_id: number, crew_coordinators: Array<{ user_id: string, name: string, email: string, assigned_by: string, assigned_by_name: string, assigned_date: string }> } } }>} */
const getCrewCoordinators = (callId) =>
  Gateway.get(`/crew_coordinator/get_crew_coordinators/${encodeURIComponent(String(callId))}`);

/** Replaces the call's crew coordinators with `user_ids`. @param {{ call_id: number, user_ids: number[] }} payload */
const assignCrewCoordinators = (payload) => Gateway.post('/crew_coordinator/assign_crew_coordinators', payload);

export default {
  getCrewCoordinators,
  assignCrewCoordinators,
};
