import Gateway from '../gateway/gateway';

const getFieldTypes = () => Gateway.get('/form_template/field_types');

const getMasterLookups = () => Gateway.get('/form_template/master_lookups');

const getSystemBindings = () => Gateway.get('/form_template/system_bindings');

const getCallTypes = () => Gateway.get('/calltype');

const getTemplateList = (params) => Gateway.get('/form_template/list', { params });

const getAllTemplates = () => Gateway.get('/form_template/all_templates');

const getTemplateById = (templateId) => Gateway.get(`/form_template/${templateId}`);

const getTemplateFirstTab = (templateId) => Gateway.get(`/form_template/first_tab/${templateId}`);

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
