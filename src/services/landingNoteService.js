import Gateway from '../gateway/gateway';

const getAllLandingNotes = (params) => Gateway.get('/material_management/get_all_landing_notes', { params });
const getLandingNoteById = (id) => Gateway.get(`/material_management/get_landing_note_by_id/${id}`);
const saveLandingNote = (data) => Gateway.post('/material_management/save_landing_note', data);
const updateLandingNote = (id, data) => Gateway.post(`/material_management/update_landing_note/${id}`, data);
const deleteLandingNote = (id) => Gateway.delete(`/material_management/delete_landing_note/${id}`);
const convertLandingNoteToDispatch = (data) => Gateway.post('/material_management/convert_landing_to_dispatch', data);

export default { getAllLandingNotes, getLandingNoteById, saveLandingNote, updateLandingNote, deleteLandingNote, convertLandingNoteToDispatch };
