import Gateway from "../gateway/gateway";
import taskCardService from "./groService/taskCardService";
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

export const saveArrivalDocument = groArrivalService.saveArrivalDocument;

export const getPassRequests = (callId) =>
  Gateway.get(`crew_pass/get_pass_requests/${encodeURIComponent(String(callId))}`);

export const uploadZawilPass = (formData) => Gateway.post("crew_pass/upload_zawil_pass", formData);

export const uploadCgPass = (formData) => Gateway.post("crew_pass/upload_cg_pass", formData);

/** POST time_object/get_stage_time_objects — { stage_id, port_id, call_type_id } */
export const getStageTimeObjects = (payload) =>
  Gateway.post("time_object/get_stage_time_objects", payload);

const groService = {
  getCallDetailById,
  getDocumentsByTask,
  verifyGroDocs,
  saveArrivalDocument,
  getPassRequests,
  uploadZawilPass,
  uploadCgPass,
  getStageTimeObjects,
  assignTask: taskCardService.assignTask,
  startTask: taskCardService.startTask,
};

export default groService;
