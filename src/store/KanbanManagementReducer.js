import { create } from 'zustand';
import * as FiIcons from 'react-icons/fi';
import * as LuIcons from 'react-icons/lu';
import useAlertReducer from './AlertReducer';
import workSpaceService from '../services/workSpaceService';
import kanbanManagementService from '../services/kanbanManagementService';
import cardMangementService from '../services/cardMangementService';
import { normalizeHexColor } from '../components/SedresColorPicker/sedresColorPickerConstants';

/** Map `/kanban_workspace/list_all_workspace` rows → NewTagModal `workspaceBoardOptions` */
export function transformWorkspacesForTagBoardPicker(apiWorkspaces) {
  if (!Array.isArray(apiWorkspaces)) return [];
  return apiWorkspaces.map((ws) => ({
    workspace_id: ws.workspace_id ?? ws.id,
    workspace_name: String(ws.workspace_name ?? ws.name ?? 'Workspace'),
    boards: Array.isArray(ws.boards)
      ? ws.boards.map((b) => ({
          board_id: b.board_id ?? b.id,
          board_name: String(b.board_name ?? b.name ?? ''),
        }))
      : [],
  }));
}

/**
 * Map backend `icon_name` (e.g. "bug", "FiGrid") to a react-icons export name for DynamicIcon.
 */
export function mapBackendIconNameToIconKey(iconName) {
  const s = String(iconName ?? '').trim();
  if (!s) return 'FiLayers';
  if (FiIcons[s]) return s;
  if (LuIcons[s]) return s;
  const parts = s.split(/[-_\s]+/).filter(Boolean);
  if (parts.length === 0) return 'FiLayers';
  const pascal = parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('');
  const fi = `Fi${pascal}`;
  const lu = `Lu${pascal}`;
  if (FiIcons[fi]) return fi;
  if (LuIcons[lu]) return lu;
  return 'FiLayers';
}

export function normalizeKanbanCardTypeRowFromApi(t) {
  const boards = Array.isArray(t?.boards) ? t.boards : [];
  const rawIcon = t?.icon_name != null ? String(t.icon_name).trim() : '';
  const availability =
    t?.availability_level != null && t.availability_level !== ''
      ? String(t.availability_level)
      : '';
  return {
    id: String(t?.card_type_id ?? ''),
    card_type_id: t?.card_type_id,
    label: String(t?.type_name ?? ''),
    color_code: normalizeHexColor(t?.color_code || '#ffffff'),
    icon: mapBackendIconNameToIconKey(rawIcon),
    availabilityLevel: availability || 'Auto',
    boardsJoined: boards
      .map((b) => String(b?.board_name ?? '').trim())
      .filter(Boolean)
      .join(', '),
    boardsRaw: boards.map((b) => ({
      board_id: b?.board_id,
      board_name: String(b?.board_name ?? ''),
    })),
    status: t?.status,
  };
}

export function normalizeKanbanCardStickerRowFromApi(t) {
  const boards = Array.isArray(t?.boards) ? t.boards : [];
  const rawIcon = t?.icon_name != null ? String(t.icon_name).trim() : '';
  const availability =
    t?.availability_level != null && t.availability_level !== ''
      ? String(t.availability_level)
      : '';
  return {
    id: String(t?.sticker_id ?? ''),
    sticker_id: t?.sticker_id,
    label: String(t?.sticker_name ?? ''),
    color_code: normalizeHexColor(t?.color_code || '#ffffff'),
    icon: mapBackendIconNameToIconKey(rawIcon),
    availabilityLevel: availability || 'Auto',
    boardsJoined: boards
      .map((b) => String(b?.board_name ?? '').trim())
      .filter(Boolean)
      .join(', '),
    boardsRaw: boards.map((b) => ({
      board_id: b?.board_id,
      board_name: String(b?.board_name ?? ''),
    })),
    status: t?.status,
  };
}

export function normalizeKanbanCardBlockerRowFromApi(t) {
  const boards = Array.isArray(t?.boards) ? t.boards : [];
  const rawIcon = t?.icon_name != null ? String(t.icon_name).trim() : '';
  const availability =
    t?.availability_level != null && t.availability_level !== ''
      ? String(t.availability_level)
      : '';
  const blockerId = t?.blocker_id ?? t?.id;
  return {
    id: String(blockerId ?? ''),
    blocker_id: blockerId,
    label: String(t?.blocker_name ?? ''),
    color_code: normalizeHexColor(t?.color_code || '#ffffff'),
    icon: mapBackendIconNameToIconKey(rawIcon),
    availabilityLevel: availability || 'Auto',
    boardsJoined: boards
      .map((b) => String(b?.board_name ?? '').trim())
      .filter(Boolean)
      .join(', '),
    boardsRaw: boards.map((b) => ({
      board_id: b?.board_id,
      board_name: String(b?.board_name ?? ''),
    })),
    status: t?.status,
  };
}

/** Backend: `"0"` = disabled (show Enable only), `"1"` = active (full actions). */
export function isKanbanManagementRowDisabled(status) {
  return String(status ?? '') === '0';
}

export function normalizeKanbanTagRowFromApi(t) {
  const boards = Array.isArray(t?.boards) ? t.boards : [];
  return {
    id: String(t?.tag_id ?? ''),
    label: String(t?.label ?? ''),
    color_code: t?.color_code || '#ffffff',
    availabilityLevel:
      t?.availability_level != null && t.availability_level !== ''
        ? String(t.availability_level)
        : '',
    boardsJoined: boards
      .map((b) => String(b?.board_name ?? '').trim())
      .filter(Boolean)
      .join(', '),
    boardsRaw: boards.map((b) => ({
      board_id: b?.board_id,
      board_name: String(b?.board_name ?? ''),
    })),
    status: t?.status,
  };
}

const useKanbanManagementReducer = create((set, get) => ({
  tags: [],
  tagsLoading: false,
  tagsError: '',
  tagsPagination: {
    current_page: 1,
    last_page: 1,
    total: 0,
    per_page: 10,
  },
  workspaceBoardOptions: [],
  workspaceBoardsLoading: false,

  cardTypes: [],
  cardTypesLoading: false,
  cardTypesError: '',
  cardTypesPagination: {
    current_page: 1,
    last_page: 1,
    total: 0,
    per_page: 10,
  },

  cardStickers: [],
  cardStickersLoading: false,
  cardStickersError: '',
  cardStickersPagination: {
    current_page: 1,
    last_page: 1,
    total: 0,
    limit: 10,
  },

  cardBlockers: [],
  cardBlockersLoading: false,
  cardBlockersError: '',
  cardBlockersPagination: {
    current_page: 1,
    last_page: 1,
    total: 0,
    limit: 10,
  },

  /**
   * Load tags for Tags modal.
   * @param {{ search?: string, page?: number, per_page?: number, silentToastOnError?: boolean }} opts
   */
  fetchKanbanTags: async (opts = {}) => {
    const {
      search = '',
      page = 1,
      per_page = 10,
      silentToastOnError = false,
    } = opts;
    try {
      set({ tagsLoading: true, tagsError: '' });
      const { data } = await kanbanManagementService.getAllKanbanTags({
        search,
        page,
        limit: per_page,
      });
      const raw =
        data?.status === 'success' && Array.isArray(data.tags) ? data.tags : [];
      const responseMeta = data?.meta ?? data?.pagination ?? {};
      const resolvedPerPage =
        Number(responseMeta?.per_page ?? responseMeta?.limit) || Number(per_page) || 10;
      const resolvedCurrentPage =
        Number(responseMeta?.current_page ?? responseMeta?.page) || Number(page) || 1;
      const resolvedTotal =
        Number(responseMeta?.total) ||
        (raw.length < resolvedPerPage
          ? ((Math.max(resolvedCurrentPage, 1) - 1) * resolvedPerPage) + raw.length
          : (Math.max(resolvedCurrentPage, 1) * resolvedPerPage) + 1);
      const resolvedLastPage =
        Number(responseMeta?.last_page ?? responseMeta?.total_pages) ||
        (raw.length < resolvedPerPage ? resolvedCurrentPage : resolvedCurrentPage + 1);
      set({
        tags: raw.map(normalizeKanbanTagRowFromApi),
        tagsLoading: false,
        tagsError: '',
        tagsPagination: {
          current_page: resolvedCurrentPage,
          last_page: Math.max(resolvedLastPage, resolvedCurrentPage),
          total: resolvedTotal,
          per_page: resolvedPerPage,
        },
      });
    } catch (err) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        'Unable to load tags. Please try again.';
      set({ tags: [], tagsLoading: false, tagsError: msg });
      if (!silentToastOnError) {
        useAlertReducer.getState().error(msg);
      }
    }
  },

  /**
   * Load card types for Types modal.
   * @param {{ search?: string, page?: number, per_page?: number, silentToastOnError?: boolean }} opts
   */
  fetchKanbanCardTypes: async (opts = {}) => {
    const {
      search = '',
      page = 1,
      per_page = 10,
      silentToastOnError = false,
    } = opts;
    try {
      set({ cardTypesLoading: true, cardTypesError: '' });
      const { data } = await cardMangementService.getAllKanbanCardTypes({
        search,
        page,
        limit: per_page,
      });
      const raw =
        data?.status === 'success' && Array.isArray(data.card_types)
          ? data.card_types
          : [];
      const responseMeta = data?.meta ?? data?.pagination ?? {};
      const resolvedPerPage =
        Number(responseMeta?.per_page ?? responseMeta?.limit) || Number(per_page) || 10;
      const resolvedCurrentPage =
        Number(responseMeta?.current_page ?? responseMeta?.page) || Number(page) || 1;
      const resolvedTotal =
        Number(responseMeta?.total) ||
        (raw.length < resolvedPerPage
          ? ((Math.max(resolvedCurrentPage, 1) - 1) * resolvedPerPage) + raw.length
          : (Math.max(resolvedCurrentPage, 1) * resolvedPerPage) + 1);
      const resolvedLastPage =
        Number(responseMeta?.last_page ?? responseMeta?.total_pages) ||
        (raw.length < resolvedPerPage ? resolvedCurrentPage : resolvedCurrentPage + 1);
      set({
        cardTypes: raw.map(normalizeKanbanCardTypeRowFromApi),
        cardTypesLoading: false,
        cardTypesError: '',
        cardTypesPagination: {
          current_page: resolvedCurrentPage,
          last_page: Math.max(resolvedLastPage, resolvedCurrentPage),
          total: resolvedTotal,
          per_page: resolvedPerPage,
        },
      });
    } catch (err) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        'Unable to load types. Please try again.';
      set({ cardTypes: [], cardTypesLoading: false, cardTypesError: msg });
      if (!silentToastOnError) {
        useAlertReducer.getState().error(msg);
      }
    }
  },

  /**
   * Load card stickers for Stickers modal.
   * @param {{ search?: string, page?: number, limit?: number, silentToastOnError?: boolean }} opts
   */
  fetchKanbanCardStickers: async (opts = {}) => {
    const {
      search = '',
      page = 1,
      limit = 10,
      silentToastOnError = false,
    } = opts;
    try {
      set({ cardStickersLoading: true, cardStickersError: '' });
      const { data } = await cardMangementService.getAllKanbanCardStickers({
        search,
        page,
        limit,
      });
      const raw =
        data?.status === 'success' && Array.isArray(data.card_stickers)
          ? data.card_stickers
          : data?.status === 'success' && Array.isArray(data.stickers)
            ? data.stickers
            : data?.status === 'success' && Array.isArray(data.data)
              ? data.data
              : [];
      const responseMeta = data?.meta ?? data?.pagination ?? {};
      const resolvedLimit =
        Number(responseMeta?.limit) ||
        Number(responseMeta?.per_page) ||
        Number(limit) ||
        10;
      const resolvedCurrentPage =
        Number(responseMeta?.current_page ?? responseMeta?.page) || Number(page) || 1;
      const resolvedTotal =
        Number(responseMeta?.total) ||
        (raw.length < resolvedLimit
          ? ((Math.max(resolvedCurrentPage, 1) - 1) * resolvedLimit) + raw.length
          : Math.max(resolvedCurrentPage, 1) * resolvedLimit + 1);
      const resolvedLastPage =
        Number(responseMeta?.last_page ?? responseMeta?.total_pages) ||
        (raw.length < resolvedLimit ? resolvedCurrentPage : resolvedCurrentPage + 1);
      set({
        cardStickers: raw.map(normalizeKanbanCardStickerRowFromApi),
        cardStickersLoading: false,
        cardStickersError: '',
        cardStickersPagination: {
          current_page: resolvedCurrentPage,
          last_page: Math.max(resolvedLastPage, resolvedCurrentPage),
          total: resolvedTotal,
          limit: resolvedLimit,
        },
      });
    } catch (err) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        'Unable to load stickers. Please try again.';
      set({ cardStickers: [], cardStickersLoading: false, cardStickersError: msg });
      if (!silentToastOnError) {
        useAlertReducer.getState().error(msg);
      }
    }
  },

  /**
   * Load card blockers for Blockers modal.
   * @param {{ search?: string, page?: number, limit?: number, silentToastOnError?: boolean }} opts
   */
  fetchKanbanCardBlockers: async (opts = {}) => {
    const {
      search = '',
      page = 1,
      limit = 10,
      silentToastOnError = false,
    } = opts;
    try {
      set({ cardBlockersLoading: true, cardBlockersError: '' });
      const { data } = await cardMangementService.getAllKanbanCardBlockers({
        search,
        page,
        limit,
      });
      const raw =
        data?.status === 'success' && Array.isArray(data.card_blockers)
          ? data.card_blockers
          : data?.status === 'success' && Array.isArray(data.blockers)
            ? data.blockers
            : data?.status === 'success' && Array.isArray(data.kanban_card_blockers)
              ? data.kanban_card_blockers
              : data?.status === 'success' && Array.isArray(data.data)
                ? data.data
                : [];
      const responseMeta = data?.meta ?? data?.pagination ?? {};
      const resolvedLimit =
        Number(responseMeta?.limit) ||
        Number(responseMeta?.per_page) ||
        Number(limit) ||
        10;
      const resolvedCurrentPage =
        Number(responseMeta?.current_page ?? responseMeta?.page) || Number(page) || 1;
      const resolvedTotal =
        Number(responseMeta?.total) ||
        (raw.length < resolvedLimit
          ? ((Math.max(resolvedCurrentPage, 1) - 1) * resolvedLimit) + raw.length
          : Math.max(resolvedCurrentPage, 1) * resolvedLimit + 1);
      const resolvedLastPage =
        Number(responseMeta?.last_page ?? responseMeta?.total_pages) ||
        (raw.length < resolvedLimit ? resolvedCurrentPage : resolvedCurrentPage + 1);
      set({
        cardBlockers: raw.map(normalizeKanbanCardBlockerRowFromApi),
        cardBlockersLoading: false,
        cardBlockersError: '',
        cardBlockersPagination: {
          current_page: resolvedCurrentPage,
          last_page: Math.max(resolvedLastPage, resolvedCurrentPage),
          total: resolvedTotal,
          limit: resolvedLimit,
        },
      });
    } catch (err) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        'Unable to load blockers. Please try again.';
      set({ cardBlockers: [], cardBlockersLoading: false, cardBlockersError: msg });
      if (!silentToastOnError) {
        useAlertReducer.getState().error(msg);
      }
    }
  },

  fetchWorkspaceBoardPickerOptions: async () => {
    try {
      set({ workspaceBoardsLoading: true });
      const { data } = await workSpaceService.listAllWorkspaces();
      const list = data?.status === 'success' ? data.data ?? [] : [];
      set({
        workspaceBoardOptions: transformWorkspacesForTagBoardPicker(list),
        workspaceBoardsLoading: false,
      });
    } catch {
      set({ workspaceBoardOptions: [], workspaceBoardsLoading: false });
      useAlertReducer.getState().error('Unable to load workspaces and boards.');
    }
  },

  createKanbanTag: async (payload, fetchOpts = {}) => {
    try {
      const { data } = await kanbanManagementService.saveKanbanTag(payload);
      useAlertReducer.getState().success(data?.message ?? 'Tag saved');
      await get().fetchKanbanTags({ ...fetchOpts, silentToastOnError: true });
      return data;
    } catch (err) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        'Failed to save tag';
      useAlertReducer.getState().error(msg);
      throw err;
    }
  },

  updateKanbanTagRecord: async (tagId, payload, fetchOpts = {}) => {
    try {
      const { data } = await kanbanManagementService.updateKanbanTag(tagId, payload);
      useAlertReducer.getState().success(data?.message ?? 'Tag updated');
      await get().fetchKanbanTags({ ...fetchOpts, silentToastOnError: true });
      return data;
    } catch (err) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        'Failed to update tag';
      useAlertReducer.getState().error(msg);
      throw err;
    }
  },

  disableKanbanTagRecord: async (tagId, fetchOpts = {}) => {
    try {
      const { data } = await kanbanManagementService.disableKanbanTag(tagId);
      useAlertReducer.getState().success(data?.message ?? 'Tag disabled');
      await get().fetchKanbanTags({ ...fetchOpts, silentToastOnError: true });
      return data;
    } catch (err) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        'Failed to disable tag';
      useAlertReducer.getState().error(msg);
      throw err;
    }
  },

  enableKanbanTagRecord: async (tagId, fetchOpts = {}) => {
    try {
      const { data } = await kanbanManagementService.enableKanbanTag(tagId);
      useAlertReducer.getState().success(data?.message ?? 'Tag enabled');
      await get().fetchKanbanTags({ ...fetchOpts, silentToastOnError: true });
      return data;
    } catch (err) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        'Failed to enable tag';
      useAlertReducer.getState().error(msg);
      throw err;
    }
  },

  deleteKanbanTagRecord: async (tagId, fetchOpts = {}) => {
    try {
      const { data } = await kanbanManagementService.deleteKanbanTag(tagId);
      useAlertReducer.getState().success(data?.message ?? 'Tag deleted');
      await get().fetchKanbanTags({ ...fetchOpts, silentToastOnError: true });
      return data;
    } catch (err) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        'Failed to delete tag';
      useAlertReducer.getState().error(msg);
      throw err;
    }
  },

  createKanbanCardType: async (payload, fetchOpts = {}) => {
    try {
      const { data } = await cardMangementService.saveKanbanCardType(payload);
      useAlertReducer.getState().success(data?.message ?? 'Card type saved');
      await get().fetchKanbanCardTypes({ ...fetchOpts, silentToastOnError: true });
      return data;
    } catch (err) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        'Failed to save card type';
      useAlertReducer.getState().error(msg);
      throw err;
    }
  },

  updateKanbanCardTypeRecord: async (cardTypeId, payload, fetchOpts = {}) => {
    try {
      const { data } = await cardMangementService.updateKanbanCardType(cardTypeId, payload);
      useAlertReducer.getState().success(data?.message ?? 'Card type updated');
      await get().fetchKanbanCardTypes({ ...fetchOpts, silentToastOnError: true });
      return data;
    } catch (err) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        'Failed to update card type';
      useAlertReducer.getState().error(msg);
      throw err;
    }
  },

  disableKanbanCardTypeRecord: async (cardTypeId, fetchOpts = {}) => {
    try {
      const { data } = await cardMangementService.disableKanbanCardType(cardTypeId);
      useAlertReducer.getState().success(data?.message ?? 'Card type disabled');
      await get().fetchKanbanCardTypes({ ...fetchOpts, silentToastOnError: true });
      return data;
    } catch (err) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        'Failed to disable card type';
      useAlertReducer.getState().error(msg);
      throw err;
    }
  },

  enableKanbanCardTypeRecord: async (cardTypeId, fetchOpts = {}) => {
    try {
      const { data } = await cardMangementService.enableKanbanCardType(cardTypeId);
      useAlertReducer.getState().success(data?.message ?? 'Card type enabled');
      await get().fetchKanbanCardTypes({ ...fetchOpts, silentToastOnError: true });
      return data;
    } catch (err) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        'Failed to enable card type';
      useAlertReducer.getState().error(msg);
      throw err;
    }
  },

  deleteKanbanCardTypeRecord: async (cardTypeId, fetchOpts = {}) => {
    try {
      const { data } = await cardMangementService.deleteKanbanCardType(cardTypeId);
      useAlertReducer.getState().success(data?.message ?? 'Card type deleted');
      await get().fetchKanbanCardTypes({ ...fetchOpts, silentToastOnError: true });
      return data;
    } catch (err) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        'Failed to delete card type';
      useAlertReducer.getState().error(msg);
      throw err;
    }
  },

  createKanbanCardSticker: async (payload, fetchOpts = {}) => {
    try {
      const { data } = await cardMangementService.saveKanbanCardSticker(payload);
      useAlertReducer.getState().success(data?.message ?? 'Card sticker saved');
      await get().fetchKanbanCardStickers({ ...fetchOpts, silentToastOnError: true });
      return data;
    } catch (err) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        'Failed to save card sticker';
      useAlertReducer.getState().error(msg);
      throw err;
    }
  },

  updateKanbanCardStickerRecord: async (stickerId, payload, fetchOpts = {}) => {
    try {
      const { data } = await cardMangementService.updateKanbanCardSticker(stickerId, payload);
      useAlertReducer.getState().success(data?.message ?? 'Card sticker updated');
      await get().fetchKanbanCardStickers({ ...fetchOpts, silentToastOnError: true });
      return data;
    } catch (err) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        'Failed to update card sticker';
      useAlertReducer.getState().error(msg);
      throw err;
    }
  },

  disableKanbanCardStickerRecord: async (stickerId, fetchOpts = {}) => {
    try {
      const { data } = await cardMangementService.disableKanbanCardSticker(stickerId);
      useAlertReducer.getState().success(data?.message ?? 'Card sticker disabled');
      await get().fetchKanbanCardStickers({ ...fetchOpts, silentToastOnError: true });
      return data;
    } catch (err) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        'Failed to disable card sticker';
      useAlertReducer.getState().error(msg);
      throw err;
    }
  },

  /** Backend toggles enabled state via the same route as disable */
  enableKanbanCardStickerRecord: async (stickerId, fetchOpts = {}) => {
    try {
      const { data } = await cardMangementService.disableKanbanCardSticker(stickerId);
      useAlertReducer.getState().success(data?.message ?? 'Card sticker enabled');
      await get().fetchKanbanCardStickers({ ...fetchOpts, silentToastOnError: true });
      return data;
    } catch (err) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        'Failed to enable card sticker';
      useAlertReducer.getState().error(msg);
      throw err;
    }
  },

  deleteKanbanCardStickerRecord: async (stickerId, fetchOpts = {}) => {
    try {
      const { data } = await cardMangementService.deleteKanbanCardSticker(stickerId);
      useAlertReducer.getState().success(data?.message ?? 'Card sticker deleted');
      await get().fetchKanbanCardStickers({ ...fetchOpts, silentToastOnError: true });
      return data;
    } catch (err) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        'Failed to delete card sticker';
      useAlertReducer.getState().error(msg);
      throw err;
    }
  },

  createKanbanCardBlocker: async (payload, fetchOpts = {}) => {
    try {
      const { data } = await cardMangementService.saveKanbanCardBlocker(payload);
      useAlertReducer.getState().success(data?.message ?? 'Card blocker saved');
      await get().fetchKanbanCardBlockers({ ...fetchOpts, silentToastOnError: true });
      return data;
    } catch (err) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        'Failed to save card blocker';
      useAlertReducer.getState().error(msg);
      throw err;
    }
  },

  updateKanbanCardBlockerRecord: async (blockerId, payload, fetchOpts = {}) => {
    try {
      const { data } = await cardMangementService.updateKanbanCardBlocker(blockerId, payload);
      useAlertReducer.getState().success(data?.message ?? 'Card blocker updated');
      await get().fetchKanbanCardBlockers({ ...fetchOpts, silentToastOnError: true });
      return data;
    } catch (err) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        'Failed to update card blocker';
      useAlertReducer.getState().error(msg);
      throw err;
    }
  },

  disableKanbanCardBlockerRecord: async (blockerId, fetchOpts = {}) => {
    try {
      const { data } = await cardMangementService.disableKanbanCardBlocker(blockerId);
      useAlertReducer.getState().success(data?.message ?? 'Card blocker disabled');
      await get().fetchKanbanCardBlockers({ ...fetchOpts, silentToastOnError: true });
      return data;
    } catch (err) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        'Failed to disable card blocker';
      useAlertReducer.getState().error(msg);
      throw err;
    }
  },

  /** Backend toggles enabled state via the same route as disable */
  enableKanbanCardBlockerRecord: async (blockerId, fetchOpts = {}) => {
    try {
      const { data } = await cardMangementService.disableKanbanCardBlocker(blockerId);
      useAlertReducer.getState().success(data?.message ?? 'Card blocker enabled');
      await get().fetchKanbanCardBlockers({ ...fetchOpts, silentToastOnError: true });
      return data;
    } catch (err) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        'Failed to enable card blocker';
      useAlertReducer.getState().error(msg);
      throw err;
    }
  },

  deleteKanbanCardBlockerRecord: async (blockerId, fetchOpts = {}) => {
    try {
      const { data } = await cardMangementService.deleteKanbanCardBlocker(blockerId);
      useAlertReducer.getState().success(data?.message ?? 'Card blocker deleted');
      await get().fetchKanbanCardBlockers({ ...fetchOpts, silentToastOnError: true });
      return data;
    } catch (err) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        'Failed to delete card blocker';
      useAlertReducer.getState().error(msg);
      throw err;
    }
  },

  /** Reset tag picker workspace cache when leaving modal (optional UX cleanup) */
  clearKanbanManagementUiSlice: () =>
    set({
      tagsError: '',
      cardTypesError: '',
      cardStickersError: '',
      cardBlockersError: '',
      workspaceBoardOptions: [],
      workspaceBoardsLoading: false,
    }),
}));

export default useKanbanManagementReducer;
