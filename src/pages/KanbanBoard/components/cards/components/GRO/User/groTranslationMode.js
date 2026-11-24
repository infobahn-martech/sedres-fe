import { useState, useCallback } from "react";

export const TRANSLATION_MODES = {
  AUTO: "auto",
  EN_TO_AR: "en-ar",
  AR_TO_EN: "ar-en",
  MANUAL: "manual",
};

export const TRANSLATION_MODE_OPTIONS = [
  {
    value: TRANSLATION_MODES.AUTO,
    label: "Both ways",
    hint: "Type in either column — AI fills the other one.",
  },
  {
    value: TRANSLATION_MODES.EN_TO_AR,
    label: "English → Arabic",
    from: "EN",
    to: "AR",
    hint: "Type in English — AI fills the Arabic column. Arabic edits are kept as typed.",
  },
  {
    value: TRANSLATION_MODES.AR_TO_EN,
    label: "Arabic → English",
    from: "AR",
    to: "EN",
    hint: "Type in Arabic — AI fills the English column. English edits are kept as typed.",
  },
  {
    value: TRANSLATION_MODES.MANUAL,
    label: "Manual",
    hint: "No AI translation — each column keeps exactly what you type.",
  },
];

const VALID_MODES = new Set(Object.values(TRANSLATION_MODES));

/** Which directions a mode translates. */
export const translationDirections = (mode) => ({
  enToAr: mode === TRANSLATION_MODES.AUTO || mode === TRANSLATION_MODES.EN_TO_AR,
  arToEn: mode === TRANSLATION_MODES.AUTO || mode === TRANSLATION_MODES.AR_TO_EN,
});

const readStoredMode = (storageKey, fallback) => {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return VALID_MODES.has(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
};

/** Translation mode remembered per browser for `storageKey`. */
export function useGroTranslationMode(storageKey, defaultMode = TRANSLATION_MODES.AUTO) {
  const [mode, setModeState] = useState(() => readStoredMode(storageKey, defaultMode));
  const setMode = useCallback(
    (next) => {
      if (!VALID_MODES.has(next)) return;
      setModeState(next);
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        // Storage unavailable — the choice still applies for this session.
      }
    },
    [storageKey]
  );
  return [mode, setMode];
}
