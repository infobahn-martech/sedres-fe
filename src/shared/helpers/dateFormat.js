// Display-only date formats used across the app (e.g. 28/12/2000).
// These only affect what the user sees — values sent to / read from the API
// keep their own formats (usually "YYYY-MM-DD" / "YYYY-MM-DD HH:mm:ss").

/** dayjs / moment tokens */
export const DISPLAY_DATE_FORMAT = "DD/MM/YYYY";
export const DISPLAY_DATETIME_FORMAT = "DD/MM/YYYY HH:mm";
export const DISPLAY_DATETIME_12H_FORMAT = "DD/MM/YYYY hh:mm a";

/** date-fns tokens */
export const DISPLAY_DATE_FORMAT_FNS = "dd/MM/yyyy";
export const DISPLAY_DATETIME_FORMAT_FNS = "dd/MM/yyyy HH:mm";

/** Intl / toLocale*String options that render as 28/12/2000 */
export const DISPLAY_DATE_LOCALE = "en-GB";
export const DISPLAY_DATE_OPTIONS = { day: "2-digit", month: "2-digit", year: "numeric" };
