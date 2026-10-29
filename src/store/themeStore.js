import { create } from "zustand";

const STORAGE_KEY = "sedres-theme";

function resolveInitialTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return "light";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export const useThemeStore = create((set, get) => ({
  theme: resolveInitialTheme(),
  isDark: resolveInitialTheme() === "dark",
  setTheme: (theme) => {
    localStorage.setItem(STORAGE_KEY, theme);
    applyTheme(theme);
    set({ theme, isDark: theme === "dark" });
  },
  toggleTheme: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    get().setTheme(next);
  },
}));

export function initTheme() {
  applyTheme(useThemeStore.getState().theme);
}
