// After a deploy, an already-open tab still references the previous build's
// hashed chunks, which no longer exist. Reloading picks up the new index.html
// and its current chunk names; the sessionStorage guard prevents a reload loop
// if the asset is genuinely missing.
const CHUNK_RELOAD_KEY = 'chunk-reload-at';
const CHUNK_RELOAD_WINDOW_MS = 10000;

const CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Unable to preload CSS/i,
  /Loading (CSS )?chunk .* failed/i,
  /is not a valid JavaScript MIME type/i,
];

export const isChunkLoadError = (error) => {
  if (!error) return false;
  if (error.name === 'ChunkLoadError') return true;
  const message = String(error.message ?? error);
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
};

// Returns true when a reload was triggered, false when one already happened
// recently (so the caller should surface the error instead).
export const reloadOnceForChunkError = () => {
  let lastReload = 0;
  try {
    lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
  } catch {
    // sessionStorage unavailable — fall through and reload anyway.
  }
  if (Date.now() - lastReload < CHUNK_RELOAD_WINDOW_MS) return false;
  try {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    // ignore
  }
  window.location.reload();
  return true;
};
