import Gateway from '../gateway/gateway';

const getSummaryTab = (callId) => Gateway.get(`/da/summary_tab/${callId}`);
const getOperationTab = (callId) => Gateway.get(`/da/operation_tab/${callId}`);
const saveOperationTab = (callId, formData) => Gateway.post(`/da/save_operation_tab/${callId}`, formData);
const getCardTab = (callId) => Gateway.get(`/da/card_tab/${callId}`);
const saveCardTab = (callId, formData) => Gateway.post(`/da/save_card_tab/${callId}`, formData);
const getAppointmentClearanceTab = (callId) => Gateway.get(`/da/appointment_clearance_tab/${callId}`);
const saveAppointmentClearanceTab = (callId, formData) =>
  Gateway.post(`/da/save_appointment_clearance_tab/${callId}`, formData);
const getRequiredDocuments = (callId) => Gateway.get(`/da/required_documents/${callId}`);
const getDocumentsTab = (callId) => Gateway.get(`/da/documents_tab/${callId}`);
const getLinksTab = (callId) => Gateway.get(`/da/links_tab/${callId}`);
const getTimeObjects = (callId) => Gateway.get(`/da/time_objects/${callId}`);
const getCardStage = (callId) => Gateway.get(`/da/card/${callId}`);
const getStatusTimeline = (callId) => Gateway.get(`/da/status_timeline/${callId}`);
/** @param {{ call_id: string|number, column_id: string|number }} payload */
const advanceStage = (payload) => Gateway.post('/da/advance_stage', payload);
/** @param {{ call_id: string|number, status_name: string, reached_date?: string }} payload */
const updateStatus = (payload) => Gateway.post('/da/update_status', payload);

export default {
  getSummaryTab,
  getOperationTab,
  saveOperationTab,
  getCardTab,
  saveCardTab,
  getAppointmentClearanceTab,
  saveAppointmentClearanceTab,
  getRequiredDocuments,
  getDocumentsTab,
  getLinksTab,
  getTimeObjects,
  getCardStage,
  advanceStage,
  getStatusTimeline,
  updateStatus,
};
