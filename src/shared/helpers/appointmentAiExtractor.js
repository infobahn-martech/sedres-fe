import { getDocument } from "pdfjs-dist";
import { GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorker;

const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || "gemini-2.0-flash";

const APPOINTMENT_SCHEMA_TEMPLATE = {
  appointment_received_date: "",
  port: "",
  type_of_call: "",
  vessel_name: "",
  service_requestor_name: "",
  service_requestor_email: "",
};

const stripCodeFence = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  return raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
};

const safeJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

const parseRetryDelaySeconds = (errorPayload) => {
  const details = Array.isArray(errorPayload?.error?.details) ? errorPayload.error.details : [];
  const retryInfo = details.find((item) => {
    const type = String(item?.["@type"] ?? "");
    return type.includes("google.rpc.RetryInfo");
  });
  const retryDelayRaw = String(retryInfo?.retryDelay ?? "").trim();
  if (!retryDelayRaw) return null;

  const secondsMatch = retryDelayRaw.match(/^(\d+)(?:\.\d+)?s$/i);
  if (secondsMatch?.[1]) {
    return Number.parseInt(secondsMatch[1], 10);
  }
  return null;
};

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

export const extractAppointmentDetailsWithGemini = async (text) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("MISSING_GEMINI_API_KEY");
  }

  const prompt = `
You are an extraction engine.
Extract only from the provided document/email text and return ONLY valid JSON with no markdown.
Do not hallucinate values. If a field is not clearly available, return empty string.

Expected JSON format exactly:
{
  "appointment_received_date": "",
  "port": "",
  "type_of_call": "",
  "vessel_name": "",
  "service_requestor_name": "",
  "service_requestor_email": ""
}

Rules:
- appointment_received_date: use Email Metadata Date (Message Delivery Time, Client Submit Time, or Sent date) when available. Format as "YYYY-MM-DD HH:mm:ss". Do not use dates from the email body such as effective regulation dates or document dates. If no metadata date is available, return empty string.
- port: port/terminal/anchorage mentioned in text.
- type_of_call: service such as Inward Clearance, Export Clearance, OH Inspection, Crew Change, etc.
- vessel_name: exact vessel name.
- service_requestor_name: sender/requestor/contact person name.
- service_requestor_email: requestor email if available.
- Return JSON only.

Document text:
${text}
`.trim();

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    if (response.status === 404) {
      throw new Error("Gemini model not found or not supported. Please check VITE_GEMINI_MODEL.");
    }
    if (response.status === 429) {
      const retrySeconds = parseRetryDelaySeconds(errorPayload);
      const retrySuffix = retrySeconds ? ` Retry after ${retrySeconds} seconds.` : "";
      throw new Error(`Gemini quota exceeded. Please retry after some time or check billing/quota.${retrySuffix}`);
    }
    throw new Error(`GEMINI_API_ERROR_${response.status}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const parsed = safeJsonParse(stripCodeFence(rawText));

  return {
    ...APPOINTMENT_SCHEMA_TEMPLATE,
    ...(parsed && typeof parsed === "object" ? parsed : {}),
  };
};
