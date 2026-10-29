import { getDocument } from "pdfjs-dist";
import { GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorker;

const pad2 = (n) => String(n).padStart(2, "0");

export const formatToApiDateTime = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:00`;
};

export const normalizeAppointmentDateTime = (value) => {
  if (value instanceof Date) {
    return formatToApiDateTime(value);
  }

  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const cleaned = raw
    .replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+/i, "")
    .replace(",", "")
    .trim();

  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(cleaned)) {
    const d = new Date(cleaned.replace(" ", "T"));
    return formatToApiDateTime(d);
  }

  const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (match) {
    const [, a, b, year, hour, minute, second, meridian] = match;
    const day = Number(a);
    const month = Number(b);
    let h = Number(hour);

    if (meridian) {
      const m = meridian.toUpperCase();
      if (m === "PM" && h < 12) h += 12;
      if (m === "AM" && h === 12) h = 0;
    }

    return `${year}-${pad2(month)}-${pad2(day)} ${pad2(h)}:${pad2(minute)}:${pad2(second || 0)}`;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : formatToApiDateTime(parsed);
};

const getMimeType = (file) => String(file?.type ?? "").toLowerCase();
const getFileExtension = (fileName = "") => {
  const parts = String(fileName).toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
};

const isPdfFile = (file) => getMimeType(file) === "application/pdf" || getFileExtension(file?.name) === "pdf";
const isTextLikeFile = (file) => {
  const mimeType = getMimeType(file);
  const extension = getFileExtension(file?.name);
  const allowedExtensions = new Set(["txt", "eml", "html", "htm", "csv"]);

  if (mimeType.startsWith("text/")) return true;
  if (mimeType === "message/rfc822") return true;
  return allowedExtensions.has(extension);
};

const extractTextFromPdf = async (file) => {
  const buffer = await file.arrayBuffer();
  const loadingTask = getDocument({ data: new Uint8Array(buffer) });
  const pdfDoc = await loadingTask.promise;
  const pages = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum += 1) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Reconstruct line breaks so downstream parsers can rely on line-anchored
    // patterns (e.g. "Sent:", "From:", "Port of call:"). pdf.js returns text as
    // positioned runs, so we group runs into lines by their vertical position
    // (transform[5]) and honour the hasEOL hint when present.
    const lines = [];
    let currentLine = [];
    let lastY = null;

    const flushLine = () => {
      const line = currentLine.join(" ").replace(/\s+/g, " ").trim();
      if (line) lines.push(line);
      currentLine = [];
    };

    textContent.items.forEach((item) => {
      const text = item?.str ? String(item.str) : "";
      const currentY = Array.isArray(item?.transform) ? item.transform[5] : null;
      const isNewLine =
        lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 1;

      if (isNewLine) flushLine();
      if (text) currentLine.push(text);
      if (currentY !== null) lastY = currentY;
      if (item?.hasEOL) {
        flushLine();
        lastY = null;
      }
    });
    flushLine();

    const pageText = lines.join("\n").trim();
    if (pageText) {
      pages.push(pageText);
    }
  }

  return pages.join("\n");
};

export const extractTextFromFile = async (file) => {
  if (!file) return "";
  if (isPdfFile(file)) {
    return extractTextFromPdf(file);
  }
  if (isTextLikeFile(file)) {
    return file.text();
  }
  throw new Error("UNSUPPORTED_FILE_FORMAT");
};
