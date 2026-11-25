const asText = (value) => (typeof value === "string" && value.trim() ? value.trim() : "");

/**
 * Message the backend sent with a response, for toasts.
 * Accepts either an axios response ({ data: { message } }) or an already-unwrapped body ({ message }).
 */
export const getApiMessage = (response, fallback = "") =>
  asText(response?.message) || asText(response?.data?.message) || fallback;

/** Message the backend sent with a failed request, falling back to the given text. */
export const getApiErrorMessage = (error, fallback = "") =>
  asText(error?.response?.data?.message) || fallback;
