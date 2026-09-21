import Gateway from '../gateway/gateway';

const getFieldTypes = () => Gateway.get('/form_template/field_types');

const saveCardTemplate = (payload) => Gateway.post('/form_template/save_card_template', payload);

export default {
  getFieldTypes,
  saveCardTemplate,
};
