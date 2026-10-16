/**
 * Normalizes dashboard `background` from list/dashboard API responses.
 * Supports solid color and wallpaper image URLs.
 *
 * Color examples:
 *   { type: "color", value: "#6366f1" }
 *   { type: "color", color: "#6366f1" }
 *
 * Wallpaper examples:
 *   { type: "wallpaper", file_url: "https://...", file_name: "..." }
 *   { type: "wallpaper", value: "https://..." }
 *
 * Legacy:
 *   { type: "image", value: "https://..." }
 */

import DEFAULT_BOARD_WALLPAPER from '../../assets/images/kanban-board-default-bg.jpg';

const DEFAULT_CANVAS_COLOR = '#eef1f4';

/** Colour saved by "Remove background" (backend has no clear endpoint); rendered as the default wallpaper. */
export const REMOVED_BOARD_BACKGROUND_COLOR = '#fbfbf5';

/**
 * @param {unknown} background
 * @returns {{ type: 'color'; color: string } | { type: 'wallpaper'; url: string; fileName?: string } | null}
 */
export function normalizeDashboardBackground(background) {
  if (!background || typeof background !== 'object') return null;
  const rawType = background.type;
  const type = String(rawType ?? '').toLowerCase();

  if (type === 'color') {
    const color =
      background.value ?? background.color ?? background.hex ?? background.background_color ?? '';
    const c = String(color).trim();
    if (!c) return null;
    return { type: 'color', color: c.startsWith('#') ? c : `#${c}` };
  }

  if (type === 'wallpaper' || type === 'image') {
    const url = (
      background.file_url ??
      background.fileUrl ??
      background.url ??
      background.value ??
      ''
    ).trim();
    if (!url) return null;
    const fileName = background.file_name ?? background.fileName;
    return {
      type: 'wallpaper',
      url,
      ...(typeof fileName === 'string' && fileName ? { fileName } : {}),
    };
  }

  return null;
}

/**
 * Inline styles for the dashboard canvas (Workspaces page).
 * @param {unknown} background
 * @returns {Record<string, string | number>}
 */
export function getDashboardCanvasStyle(background) {
  const n = normalizeDashboardBackground(background);
  if (!n) {
    return { backgroundColor: DEFAULT_CANVAS_COLOR };
  }
  if (n.type === 'color') {
    return {
      backgroundColor: n.color,
      backgroundImage: 'none',
    };
  }
  const v = n.url.startsWith('url(') ? n.url : `url(${n.url})`;
  return {
    backgroundColor: DEFAULT_CANVAS_COLOR,
    backgroundImage: v,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };
}

function cleanBackgroundField(value) {
  const s = String(value ?? '').trim();
  if (!s || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return '';
  return s;
}

/**
 * Inline styles for the Kanban board page container (`.page-cont-wrp`) from
 * `kanban_board/get_full_board` response `background: { color, background_url }`.
 * `color` wins when present; falls back to `background_url` as a cover image, and to the
 * default board wallpaper when neither is set (or the background was removed).
 * @param {{ color?: string; background_url?: string } | null | undefined} background
 * @returns {Record<string, string>}
 */
export function getBoardPageBackgroundStyle(background) {
  const source = background && typeof background === 'object' ? background : {};

  const color = cleanBackgroundField(source.color);
  if (color && color.toLowerCase() !== REMOVED_BOARD_BACKGROUND_COLOR) {
    return { backgroundColor: color, backgroundImage: 'none' };
  }

  const url = cleanBackgroundField(source.background_url) || DEFAULT_BOARD_WALLPAPER;
  return {
    backgroundColor: 'transparent',
    backgroundImage: `url("${url}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };
}
