import Gateway from '../gateway/gateway';

const getSummaryTab = (callId) => Gateway.get(`/da/summary_tab/${callId}`);
const getCardTab = (callId) => Gateway.get(`/da/card_tab/${callId}`);
const saveCardTab = (callId, formData) => Gateway.post(`/da/save_card_tab/${callId}`, formData);
const getAppointmentClearanceTab = (callId) => Gateway.get(`/da/appointment_clearance_tab/${callId}`);
const saveAppointmentClearanceTab = (callId, formData) =>
  Gateway.post(`/da/save_appointment_clearance_tab/${callId}`, formData);
const getRequiredDocuments = (callId) => Gateway.get(`/da/required_documents/${callId}`);

export default {
  getSummaryTab,
  getCardTab,
  saveCardTab,
  getAppointmentClearanceTab,
  saveAppointmentClearanceTab,
  getRequiredDocuments,
};
