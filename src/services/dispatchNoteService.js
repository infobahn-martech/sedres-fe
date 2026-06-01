import Gateway from '../gateway/gateway';

const getAllDispatchNotes = (params) =>
  Gateway.get('/material_management/get_all_dispatch_notes', { params });

const getDispatchNoteById = (id) =>
  Gateway.get(`/material_management/get_dispatch_note_by_id/${id}`);

const updateDispatchNote = (id, data) =>
  Gateway.post(`/material_management/update_dispatch_note/${id}`, data);

const deleteDispatchNote = (id) =>
  Gateway.delete(`/material_management/delete_dispatch_note/${id}`);

export default { getAllDispatchNotes, getDispatchNoteById, updateDispatchNote, deleteDispatchNote };
