import Gateway from '../gateway/gateway';

const getPackingTypes = ({ params } = {}) =>
    Gateway.get('/material/get_all_packaging_type', { params });
const addPackingType = (data) => Gateway.post('/material/add_packaging_type', data);
const updatePackingType = (data) => Gateway.post('/material/update_packaging_type', data);
const deletePackingType = (id) => Gateway.delete(`/material/delete_packaging_type/${id}`);

export default { addPackingType, getPackingTypes, updatePackingType, deletePackingType };
