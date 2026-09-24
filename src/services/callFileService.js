import Gateway from '../gateway/gateway';

const getAllOperators = () => Gateway.get('/call_file/get_all_operators');
const getAllManagers = () => Gateway.get('/call_file/get_all_managers');
const getEntityFields = (entityId) => Gateway.post(`/call_file/get_entity_fields/${entityId}`, { entity_id: entityId });
const createCallFile = (body) => Gateway.post('/call_file/create_call_file', body);
// Opening a card mounts several components (CardForm, General, Checklist, ...) that each
// request the same call's detail at once — share one in-flight request per callId.
const pendingCallDetailRequests = new Map();
const getCallDetail = (callId) => {
  const key = String(callId);
  if (pendingCallDetailRequests.has(key)) return pendingCallDetailRequests.get(key);
  const request = Gateway.get(`/call_file/get_call_detail/${callId}`).finally(() => {
    pendingCallDetailRequests.delete(key);
  });
  pendingCallDetailRequests.set(key, request);
  return request;
};
const allDetailByVesselId = (payload) => Gateway.post('/call_file/all_detail_by_vessel_id', payload);
const getAllDetailByVesselId = allDetailByVesselId;
const getAllTransportCoordinators = () => Gateway.get('/call_file/get_all_transport_coordinators');
const getRequestedServicesSummary = (callId) =>
  Gateway.get(`/call_file/get_requested_services_summary/${encodeURIComponent(String(callId))}`);
const uploadEmailAttachments = (formData) =>
  Gateway.post('/call_file/upload_email_attachments', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export default {
  getAllOperators,
  getAllManagers,
  getEntityFields,
  createCallFile,
  getCallDetail,
  allDetailByVesselId,
  getAllDetailByVesselId,
  getAllTransportCoordinators,
  uploadEmailAttachments,
  getRequestedServicesSummary,
};
