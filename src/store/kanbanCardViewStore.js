import { create } from 'zustand';
import { getItem, setItem } from '../shared/helpers/localStorage';

/** Card density levels for the Kanban board (sidebar 1/2/3/4 pager). */
export const CARD_VIEW_LEVELS = [
  { level: 1, label: 'Detailed', ariaLabel: 'Detailed card view' },
  { level: 2, label: 'Standard', ariaLabel: 'Standard card view' },
  { level: 3, label: 'Compact', ariaLabel: 'Compact card view' },
  { level: 4, label: 'Minimal', ariaLabel: 'Minimal card view' },
];

export const DEFAULT_CARD_VIEW_LEVEL = 1;

const storageKey = (boardId) => `sedres:kanban:cardViewLevel:${boardId ?? 'default'}`;

const isValidLevel = (level) => CARD_VIEW_LEVELS.some((item) => item.level === level);

const readStoredLevel = (boardId) => {
  try {
    const stored = Number(getItem(storageKey(boardId)));
    return isValidLevel(stored) ? stored : DEFAULT_CARD_VIEW_LEVEL;
  } catch {
    return DEFAULT_CARD_VIEW_LEVEL;
  }
};

/**
 * Presentation-only preference: how much each Kanban card shows. Cards subscribe to `level`
 * directly, so switching re-renders only the cards (no board refetch, no column re-render).
 */
const useKanbanCardViewStore = create((set, get) => ({
  level: DEFAULT_CARD_VIEW_LEVEL,
  boardId: null,

  /** Restore the saved level when a board opens; `null` (board unmounted) resets to Detailed. */
  hydrateForBoard: (boardId) => {
    if (boardId == null) {
      set({ boardId: null, level: DEFAULT_CARD_VIEW_LEVEL });
      return;
    }
    set({ boardId, level: readStoredLevel(boardId) });
  },

  setLevel: (level) => {
    if (!isValidLevel(level) || level === get().level) return;
    set({ level });
    try {
      setItem(storageKey(get().boardId), String(level));
    } catch {
      /* storage unavailable (private mode / quota) — keep the in-memory level */
    }
  },
}));

export default useKanbanCardViewStore;
