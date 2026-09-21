import Gateway from '../gateway/gateway';

const getFieldTypes = () => Gateway.get('/form_template/field_types');

const getCallTypes = () => Gateway.get('/calltype');

const getTemplateList = (params) => Gateway.get('/form_template/list', { params });

const getTemplateById = (templateId) => Gateway.get(`/form_template/${templateId}`);

const saveCardTemplate = (payload) => Gateway.post('/form_template/save_card_template', payload);

export default {
  getFieldTypes,
  getCallTypes,
  getTemplateList,
  getTemplateById,
  saveCardTemplate,
};
