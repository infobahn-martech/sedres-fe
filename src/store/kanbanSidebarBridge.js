import { create } from 'zustand';

/** Synced from the active Kanban board so the sidebar can list workflows before opening Add. */
export const useKanbanSidebarBridge = create((set) => ({
  boardWorkflows: [],
  setBoardWorkflows: (list) => set({ boardWorkflows: Array.isArray(list) ? list : [] }),
  boardId: null,
  setBoardId: (boardId) => set({ boardId: boardId ?? null }),
}));
