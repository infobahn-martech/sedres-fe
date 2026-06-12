import Gateway from '../gateway/gateway';

// Endpoints are placeholders - API not yet provided
const getCallTypes = ({ params } = {}) =>
    Gateway.get('/call-type/get_all', { params });
const addCallType = (data) => Gateway.post('/call-type/add', data);
const updateCallType = (data) => Gateway.post('/call-type/update', data);
const deleteCallType = (id) => Gateway.delete(`/call-type/delete/${id}`);

export default { getCallTypes, addCallType, updateCallType, deleteCallType };
