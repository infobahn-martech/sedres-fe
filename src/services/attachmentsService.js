import Gateway from "../gateway/gateway";

/**
 * @param {string|number} callId
 */
const getAllAttachments = (callId) =>
  Gateway.post("attachments/get_all_attachments", { call_id: callId });

/**
 * @param {string|number} callId
 */
const getAllSupportingDocs = (callId) =>
  Gateway.get(`attachments/get_all_supporting_docs/${encodeURIComponent(String(callId))}`);

export default {
  getAllAttachments,
  getAllSupportingDocs,
};
