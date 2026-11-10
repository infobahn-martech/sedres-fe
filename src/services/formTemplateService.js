import Gateway from '../gateway/gateway';

const getFieldTypes = () => Gateway.get('/form_template/field_types');

const getMasterLookups = () => Gateway.get('/form_template/master_lookups');

const getSystemBindings = (callTypeId) =>
  Gateway.get('/form_template/system_bindings', { params: { call_type_id: callTypeId } });

const getCallTypes = () => Gateway.get('/calltype');

const getTemplateList = (params) => Gateway.get('/form_template/list', { params });

const getAllTemplates = () => Gateway.get('/form_template/all_templates');

const getTemplateById = (templateId) => Gateway.get(`/form_template/${templateId}`);

// With a payload (FormData carrying appointment_email_file / vessel_id / billing_entity_id / port_id /
// last_port / service_requestor_email / assigned_operator_id and `time_objects` as a JSON string) the
// backend resolves field values for the selection; multipart is required for the email file.
const getTemplateFirstTab = (templateId, payload) =>
  payload
    ? Gateway.post(`/form_template/first_tab/${templateId}`, payload)
    : Gateway.get(`/form_template/first_tab/${templateId}`);

const saveCardTemplate = (payload) => Gateway.post('/form_template/save_card_template', payload);

const deleteTemplate = (templateId) => Gateway.delete(`/form_template/delete/${templateId}`);

export default {
  getFieldTypes,
  getMasterLookups,
  getSystemBindings,
  getCallTypes,
  getTemplateList,
  getAllTemplates,
  getTemplateById,
  getTemplateFirstTab,
  saveCardTemplate,
  deleteTemplate,
};
