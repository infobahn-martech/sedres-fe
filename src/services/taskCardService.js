import Gateway from "../gateway/gateway";

const assignTask = (payload) => Gateway.post("task_card/assign_task", payload);

const startTask = (cardId, taskId) =>
  Gateway.get(
    `task_card/start_task/${encodeURIComponent(String(cardId))}/${encodeURIComponent(String(taskId ?? ""))}`
  );

/**
 * @param {{ card_name: string, task_name: string, assigned_to: string|number, due_date: string,
 *   card_type_id?: string, card_tag_id?: string, card_blocker_id?: string, card_sticker_id?: string }} payload
 * card_type_id/card_tag_id/card_blocker_id/card_sticker_id mirror the field names
 * `create_call_file` accepts (see createCallFilePayload.js) — sent best-effort since
 * backend support for these fields on create_task_card isn't confirmed yet.
 */
const createTaskCard = (payload) => Gateway.post("kanban_card/create_task_card", payload);

/** @param {{ card_id: string|number, comment_text: string, mentioned_user_id?: string|number|null, parent_comment_id?: string|number|null }} payload */
const addComment = (payload) => Gateway.post("kanban_card/add_comment", payload);

const getComments = (cardId) =>
  Gateway.get(`kanban_card/get_comments/${encodeURIComponent(String(cardId))}`);

const deleteComment = (commentId) =>
  Gateway.post(`kanban_card/delete_comment/${encodeURIComponent(String(commentId))}`);

/** POST multipart FormData — { card_id, documents[] } */
const uploadCardDocuments = (formData) => Gateway.post("task_card/upload_card_documents", formData);

const getCardDocuments = (cardId) =>
  Gateway.get(`kanban_card/get_card_documents/${encodeURIComponent(String(cardId))}`);

const taskCardService = {
  assignTask,
  startTask,
  createTaskCard,
  addComment,
  getComments,
  deleteComment,
  uploadCardDocuments,
  getCardDocuments,
};

export default taskCardService;
