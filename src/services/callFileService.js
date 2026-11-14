import Gateway from '../gateway/gateway';

const getAllOperators = () => Gateway.get('/call_file/get_all_operators');
const getAllManagers = () => Gateway.get('/call_file/get_all_managers');
const getEntityFields = (entityId) => Gateway.post(`/call_file/get_entity_fields/${entityId}`, { entity_id: entityId });
const createCallFile = (body) => Gateway.post('/call_file/create_call_file', body);
// Add Card with a custom template selected — the template's own field values replace the call file form.
const createCallFileNew = (formData) =>
  Gateway.post('/call_file/create_call_file_new', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
// Opening a card mounts several components (CardForm, General, Checklist, ...) that each
// request the same call's detail at once — share one in-flight request per callId.
const pendingCallDetailRequests = new Map();
// `params` (optional) are sent as query params, e.g. { saber, weather_forecast } so the backend
// renders the stage email templates for those values. Param requests are never shared.
const getCallDetail = (callId, params) => {
  if (params && Object.keys(params).length) {
    return Gateway.get(`/call_file/get_call_detail/${callId}`, { params });
  }
  const key = String(callId);
  if (pendingCallDetailRequests.has(key)) return pendingCallDetailRequests.get(key);
  const request = Gateway.get(`/call_file/get_call_detail/${callId}`).finally(() => {
    pendingCallDetailRequests.delete(key);
  });
  pendingCallDetailRequests.set(key, request);
  return request;
};
// Operation stage save (Pre Arrival / Arrival / Departure) for template-driven calls.
// multipart/form-data: call_id, tab_id (the stage subtab id), fields (JSON keyed by field_id),
// field_<field_id> (new File uploads) and, only when sending a report, report (JSON).
// No explicit Content-Type: the gateway drops it for FormData so the boundary is generated.
const saveStage = (formData) => Gateway.post('/call_file/save_stage', formData);
const allDetailByVesselId = (payload) => Gateway.post('/call_file/all_detail_by_vessel_id', payload);
const getAllDetailByVesselId = allDetailByVesselId;
const getAllTransportCoordinators = () => Gateway.get('/call_file/get_all_transport_coordinators');
const getRequestedServicesSummary = (callId) =>
  Gateway.get(`/call_file/get_requested_services_summary/${encodeURIComponent(String(callId))}`);
const getServiceCounts = (callId) =>
  Gateway.get(`/call_file/get_service_counts/${encodeURIComponent(String(callId))}`);
const getRequestsByService = (callId) =>
  Gateway.get(`/call_file/get_requests_by_service/${encodeURIComponent(String(callId))}`);
const getServiceHistory = (callId) =>
  Gateway.get(`/call_file/get_service_history/${encodeURIComponent(String(callId))}`);
const uploadEmailAttachments = (formData) =>
  Gateway.post('/call_file/upload_email_attachments', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export default {
  getAllOperators,
  getAllManagers,
  getEntityFields,
  createCallFile,
  createCallFileNew,
  getCallDetail,
  saveStage,
  allDetailByVesselId,
  getAllDetailByVesselId,
  getAllTransportCoordinators,
  uploadEmailAttachments,
  getRequestedServicesSummary,
  getServiceCounts,
  getRequestsByService,
  getServiceHistory,
};
