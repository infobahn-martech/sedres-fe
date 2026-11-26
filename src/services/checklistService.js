import Gateway from '../gateway/gateway';

const getChecklist = (params) => Gateway.get('/checklist', { params });
const getChecklistByType = (params) =>
  Gateway.get('checklist/get_checklist_by_type', { params });
/** GET checklist/get_checklist_by_id/{checklist_type_id} */
const getChecklistById = (checklist_type_id) =>
  Gateway.get(`checklist/get_checklist_by_id/${encodeURIComponent(String(checklist_type_id))}`);
/**
 * GET call_checklist/get_call_checklist/{call_id}
 * Rows: call_checklist_id, call_id, checklist_type_id, checklist_name,
 * sections[{ checklist_section_id, title, items[{ checklist_item_id, item_name,
 * is_checked, remarks, expiry_date, files[{ file_id, file_name, file_url }] }] }].
 */
const getCallChecklist = (call_id) =>
  Gateway.get(`call_checklist/get_call_checklist/${encodeURIComponent(String(call_id))}`);

/** POST checklist/checklist_by_vesseltype — body: { vessel_type_id, calltype, port_id } */
const getChecklistsByVesselType = (payload) =>
  Gateway.post('checklist/checklist_by_vesseltype', payload);

/** POST checklist/checklist_by_bargetype — body: { barge_type_id, calltype, port_id } */
const getChecklistsByBargeType = (payload) =>
  Gateway.post('checklist/checklist_by_bargetype', payload);

/** POST checklist/checklist_by_port_call — body: { calltype, port_id } */
const getChecklistsByPortCall = (payload) =>
  Gateway.post('checklist/checklist_by_port_call', payload);

/** DELETE checklist/delete/{checklist_type_id} */
const deleteChecklist = (checklist_type_id) =>
  Gateway.delete(
    `checklist/delete/${encodeURIComponent(String(checklist_type_id))}`
  );

/** POST checklist/createchecklist - data can be FormData (with files) or JSON */
const createChecklist = (data) => Gateway.post('checklist/createchecklist', data);

/** POST checklist/updatechecklist - data can be FormData (with files) or JSON; must include _id/checklist_id */
const updateChecklist = (data) => Gateway.post('checklist/updatechecklist', data);
/** POST call_checklist/save_call_checklist - data should be FormData */
const saveCallChecklist = (data) => Gateway.post('call_checklist/save_call_checklist', data);
/** POST call_checklist/reupload_checklist_file — FormData: call_id, checklist_item_id, file */
const reuploadChecklistFile = (data) =>
  Gateway.post('call_checklist/reupload_checklist_file', data);
/** POST call_checklist/generate_checklist_pdf — body: { call_id, checklist_type_id } */
const generateChecklistPdf = (payload) =>
  Gateway.post('call_checklist/generate_checklist_pdf', payload, { responseType: 'blob' });

export default {
    createChecklist,
    updateChecklist,
    getChecklist,
    getChecklistByType,
    getChecklistById,
    getCallChecklist,
    getChecklistsByVesselType,
    getChecklistsByBargeType,
    getChecklistsByPortCall,
    deleteChecklist,
    saveCallChecklist,
    generateChecklistPdf,
    reuploadChecklistFile,
};
