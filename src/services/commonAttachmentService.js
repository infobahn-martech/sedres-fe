import Gateway from '../gateway/gateway';

// Common attachments (port / call type scoped files such as Port Information PDFs).
// add / update are multipart: port_id, call_type_id, category, attachment_type, attachment (+ attachment_id on update).
const getAll = (params) => Gateway.get('/common_attachment/list', { params });
const create = (formData) => Gateway.post('/common_attachment/add', formData);
const update = (formData) => Gateway.post('/common_attachment/update', formData);

export default { getAll, create, update };
