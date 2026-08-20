import Gateway from '../gateway/gateway';

const getSummaryTab = (callId) => Gateway.get(`/da/summary_tab/${callId}`);
const getDaDetails = (callId) => Gateway.get(`/da/da_details/${callId}`);
const saveDaDetails = (callId, payload) => Gateway.post(`/da/save_da_details/${callId}`, payload);
const saveOperationTab = (callId, formData) => Gateway.post(`/da/save_operation_tab/${callId}`, formData);
const getRequiredDocuments = (callId) => Gateway.get(`/da/required_documents/${callId}`);
const getLinksTab = (callId) => Gateway.get(`/da/links_tab/${callId}`);
const getDocumentsTab = (callId) => Gateway.get(`/da/documents_tab/${callId}`);
const saveDocumentsTab = (callId, formData) => Gateway.post(`/da/save_documents_tab/${callId}`, formData);
const deleteDocument = (documentId) => Gateway.post('/da/delete_document', { document_id: documentId });
const downloadSectionZip = (callId, documentName) =>
  Gateway.get(`/da/download_section_zip/${callId}`, {
    params: { document_name: documentName },
    responseType: 'blob',
  });
const getTimeObjects = (callId) => Gateway.get(`/da/time_objects/${callId}`);
const getCardStage = (callId) => Gateway.get(`/da/card/${callId}`);
const getStatusTimeline = (callId) => Gateway.get(`/da/status_timeline/${callId}`);
/** @param {{ call_id: string|number, column_id: string|number }} payload */
const advanceStage = (payload) => Gateway.post('/da/advance_stage', payload);
/** @param {{ call_id: string|number, status_name: string, reached_date?: string }} payload */
const updateStatus = (payload) => Gateway.post('/da/update_status', payload);

export default {
  getSummaryTab,
  getDaDetails,
  saveDaDetails,
  saveOperationTab,
  getRequiredDocuments,
  getLinksTab,
  getDocumentsTab,
  saveDocumentsTab,
  deleteDocument,
  downloadSectionZip,
  getTimeObjects,
  getCardStage,
  advanceStage,
  getStatusTimeline,
  updateStatus,
};
