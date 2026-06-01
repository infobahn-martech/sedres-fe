import Gateway from '../gateway/gateway';

const getAllLandingNotes = (params) => Gateway.get('/material_management/get_all_landing_notes', { params });
const getLandingNoteById = (id) => Gateway.get(`/material_management/get_landing_note_by_id/${id}`);
const updateLandingNote = (id, data) => Gateway.post(`/material_management/update_landing_note/${id}`, data);
const deleteLandingNote = (id) => Gateway.delete(`/material_management/delete_landing_note/${id}`);
const convertLandingNoteToDispatch = (data) => Gateway.post('/material_management/convert_landing_note_to_dispatch_note', data);

export default { getAllLandingNotes, getLandingNoteById, updateLandingNote, deleteLandingNote, convertLandingNoteToDispatch };
