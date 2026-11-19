import Gateway from '../gateway/gateway';

const getFieldTypes = () => Gateway.get('/form_template/field_types');

const getMasterLookups = () => Gateway.get('/form_template/master_lookups');

// entity_id (billing entity) is optional — omitted when none is selected.
const getSystemBindings = (callTypeId, entityId) => {
  const params = { call_type_id: callTypeId };
  if (entityId !== undefined && entityId !== null && String(entityId).trim() !== '') {
    params.entity_id = entityId;
  }
  return Gateway.get('/form_template/system_bindings', { params });
};

const getCallTypes = () => Gateway.get('/calltype');

const getTemplateList = (params) => Gateway.get('/form_template/list', { params });

const getAllTemplates = () => Gateway.get('/form_template/all_templates');

const getTemplateById = (templateId) => Gateway.get(`/form_template/${templateId}`);

// With a payload (FormData carrying appointment_email_file / vessel_id / billing_entity_id / port_id /
// last_port / service_requestor_email / assigned_operator_id / captain_email and `time_objects` as a
// JSON string) the backend resolves field values for the selection; multipart is required for the email file.
const getTemplateFirstTab = (templateId, boardId, payload) => {
  const hasBoardId = boardId !== undefined && boardId !== null && String(boardId).trim() !== '';
  const url = hasBoardId
    ? `/form_template/first_tab/${templateId}/${boardId}`
    : `/form_template/first_tab/${templateId}`;
  return payload ? Gateway.post(url, payload) : Gateway.get(url);
};

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
