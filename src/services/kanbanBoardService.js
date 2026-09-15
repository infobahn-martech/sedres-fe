import Gateway from '../gateway/gateway';

/**
 * Full board payload for the Kanban UI: one entry per workflow.
 * Response shape: { data: WorkflowFromApi[] } (axios wraps in .data)
 */
const getFullBoard = (boardId) =>
  Gateway.get(`/kanban_board/get_full_board/${boardId}`);

/**
 * Fetch a single card's header data (card_name, card_color, board_id, call_id).
 * Used by the CEO email deep link to populate the CardForm header with the
 * real title and color without loading the entire board.
 * Response shape: { data: { card_id, card_name, card_color, board_id, call_id, ... } }
 */
const getCardById = (cardId) =>
  Gateway.get(`/kanban_card/get_card/${encodeURIComponent(String(cardId))}`);

/** @param {{ card_id: string|number, to_column_id: string|number }} payload */
const moveCard = (payload) =>
  Gateway.post('/kanban_card/move_card', payload);


/** @param {{ card_id: string|number, card_color: string }} payload */
const updateCardColor = (payload) =>
  Gateway.post('/kanban_card/update_card_color', payload);

/** @param {{ card_id: string|number, title: string }} payload */
const updateCardTitle = (payload) =>
  Gateway.post('/kanban_card/update_card_title', payload);

const getCardTypesByBoard = (boardId) =>
  Gateway.get(`/kanban_card/card_types_by_board/${encodeURIComponent(String(boardId))}`);

/** @param {{ card_id: string|number, card_type_id: string|number }} payload */
const updateCardType = (payload) =>
  Gateway.post('/kanban_card/update_card_type', payload);

const getCardBlockersByBoard = (boardId) =>
  Gateway.get(
    `/kanban_card/get_card_blockers_by_board/${encodeURIComponent(String(boardId))}`
  );

/** @param {{ card_id: string|number, card_blocker_id: string|number }} payload */
const updateCardBlocker = (payload) =>
  Gateway.post('/kanban_card/update_card_blocker', payload);

const getCardStickersByBoard = (boardId) =>
  Gateway.get(
    `/kanban_card/get_card_stickers_by_board/${encodeURIComponent(String(boardId))}`
  );

/** @param {{ card_id: string|number, card_sticker_id: string|number }} payload */
const updateCardSticker = (payload) =>
  Gateway.post('/kanban_card/update_card_sticker', payload);

const getCardTagsByBoard = (boardId) =>
  Gateway.get(`/kanban_card/get_card_tags_by_board/${encodeURIComponent(String(boardId))}`);

/** @param {{ card_id: string|number, card_tag_id: string|number }} payload */
const updateCardTag = (payload) =>
  Gateway.post('/kanban_card/update_card_tag', payload);

/** @param {{ card_id: string|number, manage_type: 'card_type'|'card_tag'|'card_blocker'|'card_sticker' }} payload */
const removeCardManagementItem = (payload) =>
  Gateway.post('/kanban_card/remove_card_management_item', payload);

/** GET — subtasks for a card; response: { data: [{ subtask_id, description, assigned_to, assigned_to_name, is_completed, due_date, document, document_url }] } */
const getSubtasks = (cardId) =>
  Gateway.get(`/kanban_card/get_subtasks/${encodeURIComponent(String(cardId))}`);

/** POST multipart FormData — { card_id, description, assigned_to, due_date, document? } */
const createSubtask = (formData) =>
  Gateway.post('/kanban_card/create_subtask', formData);

/** POST multipart FormData — { subtask_id, description, assigned_to, due_date, document? } */
const updateSubtask = (formData) =>
  Gateway.post('/kanban_card/update_subtask', formData);

/** POST — { subtask_id, is_completed: 0|1 } */
const completeSubtask = (subtaskId, isCompleted) =>
  Gateway.post('/kanban_card/complete_subtask', { subtask_id: subtaskId, is_completed: isCompleted });

/** POST multipart FormData — { card_id, comment_text, mentions (JSON array of user ids), send_email: 0|1, attachment? } */
const addCardComment = (formData) =>
  Gateway.post('/kanban_card/add_card_comment', formData);

/** GET — comments for a card; response: { data: [{ comment_id, user_id, user_name, comment_text, mentions, attachment, attachment_url, created_date, updated_date }] } */
const getCardComments = (cardId) =>
  Gateway.get(`/kanban_card/get_card_comments/${encodeURIComponent(String(cardId))}`);

/** POST multipart FormData — { comment_id, comment_text, mentions (JSON array of user ids), send_email: 0|1, attachment? } */
const updateCardComment = (formData) =>
  Gateway.post('/kanban_card/update_card_comment', formData);

const deleteCardComment = (commentId) =>
  Gateway.post(`/kanban_card/delete_card_comment/${encodeURIComponent(String(commentId))}`);

/** POST — { card_id, note_text }; response: { data: { note_id, card_id, note_text, created_by, created_date } } */
const addCardNote = (payload) =>
  Gateway.post('/kanban_card/add_card_note', payload);

/** GET — notes for a card; response: { data: [{ note_id, card_id, note_text, created_by, created_by_name, created_date, updated_by, updated_date }] } */
const getCardNotes = (cardId) =>
  Gateway.get(`/kanban_card/get_card_notes/${encodeURIComponent(String(cardId))}`);

/** POST — { note_id, note_text }; response: { data: { note_text, updated_by, updated_date } } */
const updateCardNote = (payload) =>
  Gateway.post('/kanban_card/update_card_note', payload);

const deleteCardNote = (noteId) =>
  Gateway.post(`/kanban_card/delete_card_note/${encodeURIComponent(String(noteId))}`);

/** GET — advanced search: cards for a board; response: { data: [{ card_id, title, description, board_id, board_name, column_id, column_name, stage_id, stage_name, owner_id, owner_name, assigned_to, assigned_to_name, call_id, vessel_id, vessel_name, created_date }] } */
const searchCardDetails = (boardId, params = {}) =>
  Gateway.get('/kanban_search/card_details', { params: { board_id: boardId, ...params } });

/** GET — advanced search: subtasks for a board; response: { data: [{ subtask_id, description, is_completed, due_date, completed_date, card_id, card_title, board_id, board_name, assigned_to, assigned_to_name, created_date }] } */
const searchSubtasks = (boardId, params = {}) =>
  Gateway.get('/kanban_search/subtasks', { params: { board_id: boardId, ...params } });

/** GET — advanced search: documents for a board; response: { data: [{ call_task_document_id, document_name, file_name, uploaded_at, card_id, card_title, board_id, board_name, uploaded_by, uploaded_by_name }] } */
const searchDocuments = (boardId, params = {}) =>
  Gateway.get('/kanban_search/documents', { params: { board_id: boardId, ...params } });

export default {
  getFullBoard,
  getCardById,
  moveCard,
  updateCardColor,
  updateCardTitle,
  getCardTypesByBoard,
  updateCardType,
  getCardBlockersByBoard,
  updateCardBlocker,
  getCardStickersByBoard,
  updateCardSticker,
  getCardTagsByBoard,
  updateCardTag,
  removeCardManagementItem,
  getSubtasks,
  createSubtask,
  updateSubtask,
  completeSubtask,
  addCardComment,
  getCardComments,
  updateCardComment,
  deleteCardComment,
  addCardNote,
  getCardNotes,
  updateCardNote,
  deleteCardNote,
  searchCardDetails,
  searchSubtasks,
  searchDocuments,
};
