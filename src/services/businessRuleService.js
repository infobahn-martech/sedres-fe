import Gateway from '../gateway/gateway';

const getTriggerTypes = ({ params } = {}) =>
  Gateway.get('/business_rule/get_trigger_types', { params });

const getFields = ({ params } = {}) =>
  Gateway.get('/business_rule/get_fields', { params });

const getCustomFields = ({ params } = {}) =>
  Gateway.get('/business_rule/get_custom_fields', { params });

export default { getTriggerTypes, getFields, getCustomFields };
