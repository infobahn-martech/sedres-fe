import Gateway from '../gateway/gateway';

const getTriggerTypes = ({ params } = {}) =>
  Gateway.get('/business_rule/get_trigger_types', { params });

const getFields = ({ params } = {}) =>
  Gateway.get('/business_rule/get_fields', { params });

const getTimeUnits = ({ params } = {}) =>
  Gateway.get('/business_rule/get_time_units', { params });

const getCustomFields = ({ params } = {}) =>
  Gateway.get('/business_rule/get_custom_fields', { params });

const getRegularFields = ({ params } = {}) =>
  Gateway.get('/business_rule/get_regular_fields', { params });

const getThenActionFields = (actionTypeId, { params } = {}) =>
  Gateway.get(`/business_rule/get_then_action_fields/${actionTypeId}`, { params });

const getBusinessRules = ({ params } = {}) =>
  Gateway.get('/business_rule/get_business_rule_list', { params });

const getBusinessRuleById = (businessRuleId) =>
  Gateway.get(`/business_rule/get_business_rule_by_id/${businessRuleId}`);

const getExecutionLogs = (businessRuleId, { params } = {}) =>
  Gateway.get(`/business_rule/get_execution_logs/${businessRuleId}`, { params });

// TODO: backend has no confirmed endpoint for this yet - path guessed as a sibling of
// get_execution_logs; update once backend is ready.
const getBusinessRuleHistory = (businessRuleId, { params } = {}) =>
  Gateway.get(`/business_rule/get_business_rule_history/${businessRuleId}`, { params });

// TODO: backend has no confirmed endpoint for this yet - path/payload below is a
// guess mirroring kanban_workflow/enable_disable_workflow; update once backend is ready.
const toggleBusinessRuleStatus = (businessRuleId) =>
  Gateway.post(`/business_rule/enable_disable_business_rule/${businessRuleId}`, { business_rule_id: businessRuleId });

const createBusinessRule = (payload) =>
  Gateway.post('/business_rule/create_business_rule', payload);

const getTriggerConfig = (triggerTypeId) =>
  Gateway.get(`/business_rule/get_trigger_config/${triggerTypeId}`);

const getBusinessRuleStats = () =>
  Gateway.get('/business_rule/get_business_rule_stats');

const getLinkCardPossibleActions = ({ params } = {}) =>
  Gateway.get('/business_rule/get_link_card_possible_actions', { params });

const getLinkCardPossibleActionOperators = ({ params } = {}) =>
  Gateway.get('/business_rule/get_link_card_possible_action_operators', { params });

const getFieldDetails = (fieldType, fieldId) =>
  Gateway.get(`/business_rule/get_field_details/${fieldType}/${fieldId}`);

const getNotificationSettings = (notificationId) =>
  Gateway.get(`/business_rule/get_notification_settings/${notificationId}`);

const saveNotificationSettings = (payload) =>
  Gateway.post('/business_rule/save_notification_settings', payload);

const updateNotificationSettings = (notificationId, payload) =>
  Gateway.post(`/business_rule/update_notification_settings/${notificationId}`, payload);

const deleteNotificationSettings = (notificationId) =>
  Gateway.delete(`/business_rule/delete_notification_settings/${notificationId}`);

const updateWebServiceSettings = (webServiceId, payload) =>
  Gateway.post(`/business_rule/update_web_service_settings/${webServiceId}`, payload);

const deleteWebServiceSettings = (webServiceId) =>
  Gateway.delete(`/business_rule/delete_web_service_settings/${webServiceId}`);

const saveWebServiceSettings = (payload) =>
  Gateway.post('/business_rule/save_web_service_settings', payload);

const getWebServiceSettings = (webServiceId) =>
  Gateway.get(`/business_rule/get_web_service_settings/${webServiceId}`);

const testWebServiceSettings = (payload) =>
  Gateway.post('/business_rule/test_web_service_settings', payload);

const saveCreateSubtaskSettings = (payload) =>
  Gateway.post('/business_rule/save_create_subtask_settings', payload);

const updateCreateSubtaskSettings = (createSubtaskId, payload) =>
  Gateway.post(`/business_rule/update_create_subtask_settings/${createSubtaskId}`, payload);

const deleteCreateSubtaskSettings = (createSubtaskId) =>
  Gateway.delete(`/business_rule/delete_create_subtask_settings/${createSubtaskId}`);

const getCreateSubtaskSettings = (createSubtaskId) =>
  Gateway.get(`/business_rule/get_create_subtask_settings/${createSubtaskId}`);

export default {
  getTriggerTypes, getFields, getTimeUnits, getCustomFields, getRegularFields, getThenActionFields, getBusinessRules, getBusinessRuleById, getExecutionLogs, getBusinessRuleHistory, toggleBusinessRuleStatus, createBusinessRule, getTriggerConfig,
  getBusinessRuleStats, getLinkCardPossibleActions, getLinkCardPossibleActionOperators, getFieldDetails,
  getNotificationSettings, saveNotificationSettings, updateNotificationSettings, deleteNotificationSettings, updateWebServiceSettings, deleteWebServiceSettings, saveWebServiceSettings, getWebServiceSettings, testWebServiceSettings,
  saveCreateSubtaskSettings, updateCreateSubtaskSettings, deleteCreateSubtaskSettings, getCreateSubtaskSettings,
};
