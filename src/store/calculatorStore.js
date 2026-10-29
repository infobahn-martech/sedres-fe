import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX_HISTORY = 50;

// Header Calculator tool — history, memory and view preferences survive reloads.
export const useCalculatorStore = create(
  persist(
    (set) => ({
      history: [],
      memory: null,
      mode: "basic",
      angleUnit: "deg",
      activeTab: "calculator",
      addHistory: (entry) =>
        set((state) => ({ history: [{ ...entry, id: Date.now() }, ...state.history].slice(0, MAX_HISTORY) })),
      clearHistory: () => set({ history: [] }),
      setMemory: (memory) => set({ memory }),
      setMode: (mode) => set({ mode }),
      toggleAngleUnit: () => set((state) => ({ angleUnit: state.angleUnit === "deg" ? "rad" : "deg" })),
      setActiveTab: (activeTab) => set({ activeTab }),
    }),
    { name: "sedres-calculator" }
  )
);
