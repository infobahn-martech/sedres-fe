import Gateway from '../gateway/gateway';

const saveInboundOrder = (data) => Gateway.post('/material_management/save_inbound', data);
const getAllInbound = (callId, params) => Gateway.get(`/material_management/get_all_inbound/${callId}`, { params });
const getInboundById = (inboundId) => Gateway.get(`/material_management/get_inbound_by_id/${inboundId}`);
const updateInboundOrder = (inboundId, data) => Gateway.post(`/material_management/update_inbound/${inboundId}`, data);
const deleteInboundOrder = (inboundId) =>
  Gateway.delete(`/material_management/delete_inbound/${inboundId}`);
const getMaterialTransportLocations = () => Gateway.get('/material/get_materialtransport_locations');
const convertInboundToLandingNote = (data) => Gateway.post('/material_management/convert_inbound_to_landing_note', data);
const printInboundOrder = (inboundId) => Gateway.get(`/material_management/print_inbound/${inboundId}`, { responseType: 'blob' });
const getAllInboundSummary = (callId) => Gateway.get(`/material_management/get_all_inbound_summary/${callId}`);

export default { saveInboundOrder, getAllInbound, getInboundById, updateInboundOrder, deleteInboundOrder, getMaterialTransportLocations, convertInboundToLandingNote, printInboundOrder, getAllInboundSummary };
