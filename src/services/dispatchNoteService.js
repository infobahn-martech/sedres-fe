import Gateway from '../gateway/gateway';

const getAllDispatchNotes = (callId, params) => Gateway.get(`/material_management/get_all_dispatch_notes/${callId}`, { params });
const getDispatchNoteById = (id) => Gateway.get(`/material_management/get_dispatch_note_by_id/${id}`);
const updateDispatchNote = (id, data) => Gateway.post(`/material_management/update_dispatch_note/${id}`, data);
const deleteDispatchNote = (id) => Gateway.delete(`/material_management/delete_dispatch_note/${id}`);
const printDispatchNote = (id, params = {}) => Gateway.get(`/material_management/print_dispatch_note/${id}`, { responseType: 'blob', params });

export default { getAllDispatchNotes, getDispatchNoteById, updateDispatchNote, deleteDispatchNote, printDispatchNote };
