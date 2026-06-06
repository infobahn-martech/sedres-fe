import Gateway from '../gateway/gateway';

const getAllLandingNotes = (callId, params) => Gateway.get(`/material_management/get_all_landing_notes/${callId}`, { params });
const getLandingNoteById = (id) => Gateway.get(`/material_management/get_landing_note_by_id/${id}`);
const saveLandingNote = (data) => Gateway.post('/material_management/save_landing_note', data);
const updateLandingNote = (id, data) => Gateway.post(`/material_management/update_landing_note/${id}`, data);
const deleteLandingNote = (id) => Gateway.delete(`/material_management/delete_landing_note/${id}`);
const convertLandingNoteToDispatch = (data) => Gateway.post('/material_management/convert_landing_note_to_dispatch_note', data);
const printLandingNote = (landingNoteId, inboundId) => Gateway.get(`/material_management/print_landing_note/${landingNoteId}`, { responseType: 'blob', params: { inbound_id: inboundId } });

export default { getAllLandingNotes, getLandingNoteById, saveLandingNote, updateLandingNote, deleteLandingNote, convertLandingNoteToDispatch, printLandingNote };
