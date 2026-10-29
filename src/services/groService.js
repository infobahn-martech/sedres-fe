import Gateway from "../gateway/gateway";
import taskCardService from "./taskCardService";
import groArrivalService from "./groService/arrivalService";

export const getCallDetailById = (callId, cardId) => {
  const callSegment = encodeURIComponent(String(callId));
  const cardSegment = encodeURIComponent(String(cardId));
  return Gateway.get(`call_file/get_call_detail_by_id/${callSegment}/${cardSegment}`);
};

export const getDocumentsByTask = (taskId, callId) => {
  const taskSegment = encodeURIComponent(String(taskId));
  if (callId == null || String(callId).trim() === "") {
    return Gateway.get(`task_card/get_documents_by_task/${taskSegment}`);
  }
  const callSegment = encodeURIComponent(String(callId));
  return Gateway.get(`task_card/get_documents_by_task/${taskSegment}/${callSegment}`);
};

/** POST task_card/verify_docs — { call_id, task_id, card_id, documents: [{ document_id, status, remarks }] } */
export const verifyGroDocs = (payload) => Gateway.post("task_card/verify_docs", payload);

/** GET — pass templates for a port filtered by template_type ("CG Pass" | "Vessel Registration") */
export const getTemplatesByPort = (portId, templateType) =>
  Gateway.get(`pass_template/templates_by_port/${encodeURIComponent(String(portId))}`, {
    params: { template_type: templateType },
  });

export const saveArrivalDocument = groArrivalService.saveArrivalDocument;

export const getPassRequests = (callId) =>
  Gateway.get(`crew_pass/get_pass_requests/${encodeURIComponent(String(callId))}`);

export const uploadZawilPass = (formData) => Gateway.post("crew_pass/upload_zawil_pass", formData);

/** POST multipart FormData — zawil_document[] (Crew Change stage's AI-assisted Zawil Pass upload). */
export const uploadZawilPassAi = (formData) => Gateway.post("zawil/upload_zawil_pass_ai", formData);

export const uploadCgPass = (formData) => Gateway.post("crew_pass/upload_cg_pass", formData);

/** POST multipart FormData — cg_document[] (Crew Change stage's AI-assisted CG Pass upload). */
export const uploadCgPassAi = (formData) => Gateway.post("cg_pass/upload_cg_pass_ai", formData);

/** POST multipart FormData — { call_id, card_id, task_id, stage_id, file, upload_type, call_task_document_id } */
export const reuploadVesselRegDocument = (formData) =>
  Gateway.post("task_card/reupload_vessel_reg_document", formData);

/** POST time_object/get_stage_time_objects — { stage_id, port_id, call_type_id, call_id } */
export const getStageTimeObjects = (payload) =>
  Gateway.post("time_object/get_stage_time_objects", payload);

/** POST task_card/generate_vessel_reg_pdf — { call_id, card_id, role_id, task_id, file_name, html } */
export const generateVesselRegistrationPdf = (payload) =>
  Gateway.post("task_card/generate_vessel_reg_pdf", payload);

/** GET task_card/get_vessel_reg_pdf/{call_task_document_id} — generated Vessel Registration PDF info */
export const getVesselRegPdf = (callTaskDocumentId) =>
  Gateway.get(`task_card/get_vessel_reg_pdf/${encodeURIComponent(String(callTaskDocumentId))}`);

/** POST arrival/get_task_details — { call_id, card_id, task_id }: previously saved arrival popover values for a task. */
export const getTaskDetails = (payload) => Gateway.post("arrival/get_task_details", payload);

const groService = {
  getCallDetailById,
  getDocumentsByTask,
  verifyGroDocs,
  getTemplatesByPort,
  saveArrivalDocument,
  getPassRequests,
  uploadZawilPass,
  uploadZawilPassAi,
  uploadCgPass,
  uploadCgPassAi,
  reuploadVesselRegDocument,
  getStageTimeObjects,
  generateVesselRegistrationPdf,
  getVesselRegPdf,
  getTaskDetails,
  assignTask: taskCardService.assignTask,
  startTask: taskCardService.startTask,
};

export default groService;
