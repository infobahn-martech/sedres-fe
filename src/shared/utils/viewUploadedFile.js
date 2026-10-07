/* Shared by the review modals that let the user open a file the backend stored (SE Doc / Email in
   Review and Move, the invoice in Invoice Review). */
const FILE_LINK_PATTERN = /^(https?:\/\/|\/)|\.(pdf|msg|eml|xlsx?|png|jpe?g)(\?.*)?$/i;

/* A file link held directly (string) or inside a { url | file_url | path } object. */
const readFileLink = (value) => {
  const link = typeof value === "string" ? value : (value?.url ?? value?.file_url ?? value?.path);
  return typeof link === "string" && FILE_LINK_PATTERN.test(link.trim()) ? link.trim() : "";
};

/* An uploaded file's link: the first field of the sales order, its card, then the batch's se_review
   whose name matches `keyPattern` and whose value is a link. Arrays use their first entry. */
export const getUploadedFileUrl = (keyPattern, ...sources) => {
  for (const source of sources) {
    for (const [key, value] of Object.entries(source ?? {})) {
      if (!keyPattern.test(key)) continue;
      const link = readFileLink(Array.isArray(value) ? value[0] : value);
      if (link) return link;
    }
  }
  return "";
};

const VIEW_MIME_BY_EXTENSION = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};
const OFFICE_EXTENSIONS = ["xls", "xlsx", "doc", "docx"];
const OFFICE_VIEWER_URL = "https://view.officeapps.live.com/op/view.aspx?src=";

/* The backend may return a path (storage/...) instead of a full link; like the other file links in the
   app, it is read relative to the API address, never the app's own address. */
const resolveFileUrl = (url) => {
  if (/^https?:\/\//i.test(url)) return url;
  const base = (import.meta.env.VITE_API_ENDPOINT || "").replace(/\/+$/, "");
  return `${base}/${url.replace(/^\/+/, "")}`;
};

const PDF_SIGNATURE = "%PDF";

const getFileExtension = (url) => {
  const path = url.split(/[?#]/)[0];
  return path.includes(".") ? path.split(".").pop().toLowerCase() : "";
};

/* Downloads a file through a hidden frame, so no tab is opened and the board stays in place. */
const downloadWithoutTab = (url) => {
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.src = url;
  document.body.appendChild(frame);
  setTimeout(() => frame.remove(), 60000);
};

/* Shows an uploaded file in a new tab where the browser can display it: PDFs and images are re-served
   as a typed blob (shown even if the server marks the file as an attachment) and Office files use the
   Office viewer. Emails and any other type are downloaded instead. If the file cannot be read for a typed display (or is not a real PDF), the tab opens the plain link, which the browser shows inline when the server allows it. */
export const viewUploadedFile = async (fileLink, kind) => {
  const url = resolveFileUrl(fileLink);
  const extension = getFileExtension(url);
  const isOffice = OFFICE_EXTENSIONS.includes(extension);
  const mimeType = VIEW_MIME_BY_EXTENSION[extension];
  if (kind === "email" || (!isOffice && !mimeType)) {
    downloadWithoutTab(url);
    return;
  }
  const viewerTab = window.open("", "_blank");
  if (!viewerTab) return;
  if (isOffice) {
    viewerTab.location.href = `${OFFICE_VIEWER_URL}${encodeURIComponent(url)}`;
    return;
  }
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("File not available");
    const fileBlob = await response.blob();
    if (extension === "pdf" && (await fileBlob.slice(0, 4).text()) !== PDF_SIGNATURE) {
      throw new Error("Not a PDF");
    }
    const blob = new Blob([fileBlob], { type: mimeType });
    viewerTab.location.href = URL.createObjectURL(blob);
  } catch {
    viewerTab.location.href = url;
  }
};

const getBaseName = (name) => String(name ?? "").split(/[\\/]/).pop().trim().toLowerCase();

/* The just-uploaded File whose name matches the one the backend reports (ignoring case and any
   folder part). */
export const findUploadedFile = (files, fileName) => {
  const target = getBaseName(fileName);
  if (!target) return null;
  return (files ?? []).find((file) => getBaseName(file.name) === target) ?? null;
};

/* Opens a File picked in this browser session in a new tab (PDFs and images display; other types
   download). The blob link is released shortly after the tab has loaded it. */
export const viewLocalFile = (file) => {
  const mimeType = VIEW_MIME_BY_EXTENSION[getFileExtension(file.name)];
  const blobUrl = URL.createObjectURL(mimeType ? new Blob([file], { type: mimeType }) : file);
  if (mimeType) {
    window.open(blobUrl, "_blank");
  } else {
    downloadWithoutTab(blobUrl);
  }
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
};
