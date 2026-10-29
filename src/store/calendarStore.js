import { create } from "zustand";
import { persist } from "zustand/middleware";

// Header Calendar tool — events live in this browser only (no backend yet).
// Dates are "YYYY-MM-DD" and times "HH:mm" strings so they survive JSON and never shift timezone.
export const useCalendarStore = create(
  persist(
    (set) => ({
      events: [],
      addEvent: (event) => set((state) => ({ events: [...state.events, { ...event, id: Date.now() }] })),
      updateEvent: (id, changes) =>
        set((state) => ({ events: state.events.map((event) => (event.id === id ? { ...event, ...changes } : event)) })),
      deleteEvent: (id) => set((state) => ({ events: state.events.filter((event) => event.id !== id) })),
    }),
    { name: "sedres-calendar" }
  )
);
