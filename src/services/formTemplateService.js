import Gateway from '../gateway/gateway';

const getFieldTypes = () => Gateway.get('/form_template/field_types');

const getMasterLookups = () => Gateway.get('/form_template/master_lookups');

const getSystemBindings = () => Gateway.get('/form_template/system_bindings');

const getCallTypes = () => Gateway.get('/calltype');

const getTemplateList = (params) => Gateway.get('/form_template/list', { params });

const getAllTemplates = () => Gateway.get('/form_template/all_templates');

const getTemplateById = (templateId) => Gateway.get(`/form_template/${templateId}`);

// With a payload (FormData carrying appointment_email_file / vessel_id / billing_entity_id) the
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
