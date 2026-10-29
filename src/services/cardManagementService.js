import Gateway from '../gateway/gateway';

/** GET — returns axios response; unwrap `response.data` in callers */
export const getAllKanbanCardTypes = (params = {}) =>
  Gateway.get('/kanban_management/get_all_kanban_card_types', { params });

export const saveKanbanCardType = (payload) =>
  Gateway.post('/kanban_management/save_kanban_card_type', payload);

export const updateKanbanCardType = (cardTypeId, payload) =>
  Gateway.post(
    `/kanban_management/update_kanban_card_type/${encodeURIComponent(String(cardTypeId))}`,
    payload
  );

export const disableKanbanCardType = (cardTypeId) =>
  Gateway.post(
    `/kanban_management/disable_kanban_card_type/${encodeURIComponent(String(cardTypeId))}`
  );

export const enableKanbanCardType = (cardTypeId) =>
  Gateway.post(
    `/kanban_management/disable_kanban_card_type/${encodeURIComponent(String(cardTypeId))}`
  );

/** Backend uses POST for delete (same pattern as tags) */
export const deleteKanbanCardType = (cardTypeId) =>
  Gateway.post(
    `/kanban_management/delete_kanban_card_type/${encodeURIComponent(String(cardTypeId))}`
  );

/** GET — query: `page`, `limit`, `search` */
export const getAllKanbanCardStickers = (params = {}) =>
  Gateway.get('/kanban_management/get_all_kanban_card_stickers', { params });

export const saveKanbanCardSticker = (payload) =>
  Gateway.post('/kanban_management/save_kanban_card_sticker', payload);

export const updateKanbanCardSticker = (stickerId, payload) =>
  Gateway.post(
    `/kanban_management/update_kanban_card_sticker/${encodeURIComponent(String(stickerId))}`,
    payload
  );

export const disableKanbanCardSticker = (stickerId) =>
  Gateway.post(
    `/kanban_management/disable_kanban_card_sticker/${encodeURIComponent(String(stickerId))}`
  );

/** Backend pattern matches tags / card types (POST delete) */
export const deleteKanbanCardSticker = (stickerId) =>
  Gateway.post(
    `/kanban_management/delete_kanban_card_sticker/${encodeURIComponent(String(stickerId))}`
  );

/** GET — query: `page`, `limit`, `search` */
export const getAllKanbanCardBlockers = (params = {}) =>
  Gateway.get('/kanban_management/get_all_kanban_card_blockers', { params });

export const saveKanbanCardBlocker = (payload) =>
  Gateway.post('/kanban_management/save_kanban_card_blocker', payload);

export const updateKanbanCardBlocker = (blockerId, payload) =>
  Gateway.post(
    `/kanban_management/update_kanban_card_blocker/${encodeURIComponent(String(blockerId))}`,
    payload
  );

export const disableKanbanCardBlocker = (blockerId) =>
  Gateway.post(
    `/kanban_management/disable_kanban_card_blocker/${encodeURIComponent(String(blockerId))}`
  );

export const deleteKanbanCardBlocker = (blockerId) =>
  Gateway.post(
    `/kanban_management/delete_kanban_card_blocker/${encodeURIComponent(String(blockerId))}`
  );

export default {
  getAllKanbanCardTypes,
  saveKanbanCardType,
  updateKanbanCardType,
  disableKanbanCardType,
  enableKanbanCardType,
  deleteKanbanCardType,
  getAllKanbanCardStickers,
  saveKanbanCardSticker,
  updateKanbanCardSticker,
  disableKanbanCardSticker,
  deleteKanbanCardSticker,
  getAllKanbanCardBlockers,
  saveKanbanCardBlocker,
  updateKanbanCardBlocker,
  disableKanbanCardBlocker,
  deleteKanbanCardBlocker,
};
