import JSZip from "jszip";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const APPOINTMENT_EMAIL_ALLOWED_EXTENSIONS = ["pdf", "zip"];
const APPOINTMENT_EMAIL_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "multipart/x-zip",
  "application/octet-stream",
];

const normalizeString = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const normalizeWhitespace = (value) => normalizeString(value).replace(/\s+/g, " ");

export const normalizePdfText = (rawText) => {
  const text = normalizeString(rawText)
    .replace(/\r/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
  return text;
};

const extractExtension = (fileName = "") =>
  fileName.includes(".") ? fileName.split(".").pop().toLowerCase() : "";

export const isAppointmentEmailFileValid = (file) => {
  if (!file || !file.name) return false;
  const extension = extractExtension(file.name);

  if (!APPOINTMENT_EMAIL_ALLOWED_EXTENSIONS.includes(extension)) {
    return false;
  }

  if (!file.type) return true;
  return APPOINTMENT_EMAIL_ALLOWED_MIME_TYPES.includes(file.type);
};

export const getAppointmentEmailValidationMessage = (fileName = "Selected file") =>
  `${fileName} is not supported. Please upload PDF or ZIP files only.`;

export const extractEmails = (text) => {
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return Array.from(new Set(matches.map((email) => email.trim())));
};

const FIELD_KEYS = [
  "appointmentReceivedDate",
  "appointmentReceivedTime",
  "port",
  "typeOfCall",
  "vesselName",
  "vesselOwner",
  "vesselPrincipal",
  "vesselManager",
  "serviceRequestorName",
  "dailyReportEmail",
  "billingInstructions",
  "cardDescription",
];

const LOOKAHEAD_LABELS = [
  "from",
  "sent",
  "wysłane",
  "to",
  "cc",
  "subject",
  "vessel name",
  "vessel owner",
  "vessel principal",
  "vessel manager",
  "activity",
  "port of call",
];

const toFlatText = (text) => normalizeWhitespace(text.replace(/\n/g, " "));

const createResult = () => ({
  values: {
    appointmentReceivedDate: "",
    appointmentReceivedTime: "",
    port: "",
    typeOfCall: "",
    vesselName: "",
    vesselOwner: "",
    vesselPrincipal: "",
    vesselManager: "",
    serviceRequestorName: "",
    dailyReportEmail: [],
    billingInstructions: "",
    cardDescription: "",
  },
  confidence: {},
});

const setField = (result, field, value, score = 1) => {
  if (!FIELD_KEYS.includes(field)) return;
  if (field === "dailyReportEmail") {
    const emails = Array.isArray(value) ? value : [];
    const merged = Array.from(
      new Set([...(Array.isArray(result.values.dailyReportEmail) ? result.values.dailyReportEmail : []), ...emails])
    );
    result.values.dailyReportEmail = merged;
    result.confidence[field] = Math.max(result.confidence[field] || 0, score);
    return;
  }

  const normalizedValue = normalizeString(value);
  if (!normalizedValue) return;
  const currentScore = result.confidence[field] || 0;
  if (!result.values[field] || score > currentScore) {
    result.values[field] = normalizedValue;
    result.confidence[field] = score;
  }
};

const sanitizeExtractedValue = (value) => {
  if (!value) return "";
  let cleaned = normalizeWhitespace(value);
  const stopRegex = new RegExp(`\\b(?:${LOOKAHEAD_LABELS.join("|")})\\s*:`, "i");
  const stopMatch = cleaned.match(stopRegex);
  if (stopMatch) {
    cleaned = cleaned.slice(0, stopMatch.index).trim();
  }
  return cleaned.replace(/[;,\-:]+$/, "").trim();
};

export const extractLabeledValue = (text, labels = []) => {
  const multilineSource = text;
  const flatSource = toFlatText(text);

  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const lineRegex = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*:\\s*([^\\n]+)`, "i");
    const lineMatch = multilineSource.match(lineRegex);
    if (lineMatch && lineMatch[1]) {
      return sanitizeExtractedValue(lineMatch[1]);
    }

    const flatRegex = new RegExp(
      `\\b${escaped}\\s*:\\s*([\\s\\S]*?)(?=\\b(?:${LOOKAHEAD_LABELS.join("|")})\\s*:|$)`,
      "i"
    );
    const flatMatch = flatSource.match(flatRegex);
    if (flatMatch && flatMatch[1]) {
      return sanitizeExtractedValue(flatMatch[1]);
    }
  }
  return "";
};

const MONTHS = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const toTwoDigits = (num) => String(num).padStart(2, "0");

const normalizeDayMonthYear = (day, month, year) => {
  const d = Number(day);
  const y = Number(year);
  const monthKey = normalizeString(month).toLowerCase();
  const m = MONTHS[monthKey];
  if (!d || !m || !y) return "";
  return `${y}-${toTwoDigits(m)}-${toTwoDigits(d)}`;
};

const convertTo24Hour = (hourText, minuteText = "00", meridiem = "") => {
  let hour = Number(hourText);
  const minute = Number(minuteText);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return "";

  const normalizedMeridiem = normalizeString(meridiem).toUpperCase();
  if (normalizedMeridiem === "PM" && hour < 12) hour += 12;
  if (normalizedMeridiem === "AM" && hour === 12) hour = 0;

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";
  return `${toTwoDigits(hour)}:${toTwoDigits(minute)}`;
};

export const normalizeDateTimeToInputValues = (value) => {
  const raw = normalizeWhitespace(value);
  if (!raw) {
    return { appointmentReceivedDate: "", appointmentReceivedTime: "", found: false };
  }

  const monthPattern = raw.match(
    /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?\b/i
  );
  if (monthPattern) {
    const [, month, day, year, hour, minute, meridiem] = monthPattern;
    const appointmentReceivedDate = normalizeDayMonthYear(day, month, year);
    const appointmentReceivedTime = convertTo24Hour(hour, minute, meridiem);
    if (appointmentReceivedDate && appointmentReceivedTime) {
      return { appointmentReceivedDate, appointmentReceivedTime, found: true };
    }
  }

  const dayFirstPattern = raw.match(
    /\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?\b/i
  );
  if (dayFirstPattern) {
    const [, day, month, year, hour, minute, meridiem] = dayFirstPattern;
    const appointmentReceivedDate = `${year}-${toTwoDigits(month)}-${toTwoDigits(day)}`;
    const appointmentReceivedTime = convertTo24Hour(hour, minute, meridiem);
    if (appointmentReceivedTime) {
      return { appointmentReceivedDate, appointmentReceivedTime, found: true };
    }
  }

  const isoPattern = raw.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b.*?\b(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?\b/i);
  if (isoPattern) {
    const [, year, month, day, hour, minute, meridiem] = isoPattern;
    const appointmentReceivedDate = `${year}-${toTwoDigits(month)}-${toTwoDigits(day)}`;
    const appointmentReceivedTime = convertTo24Hour(hour, minute, meridiem);
    if (appointmentReceivedTime) {
      return { appointmentReceivedDate, appointmentReceivedTime, found: true };
    }
  }

  const fallbackDateMatch = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  const fallbackTimeMatch = raw.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)?\b/i);
  return {
    appointmentReceivedDate: fallbackDateMatch
      ? `${fallbackDateMatch[1]}-${fallbackDateMatch[2]}-${fallbackDateMatch[3]}`
      : "",
    appointmentReceivedTime: fallbackTimeMatch
      ? convertTo24Hour(fallbackTimeMatch[1], fallbackTimeMatch[2], fallbackTimeMatch[3])
      : "",
    found: Boolean(fallbackDateMatch || fallbackTimeMatch),
  };
};

export const extractAppointmentReceived = (text) => {
  const sentRaw = extractLabeledValue(text, ["Sent", "Wysłane"]);
  if (sentRaw) {
    return normalizeDateTimeToInputValues(sentRaw);
  }

  const flatText = toFlatText(text);
  const looseSentMatch = flatText.match(
    /\b(?:Sent|Wysłane)\s*:\s*([\s\S]*?)(?=\b(?:To|Cc|Subject|From|Vessel Name|Port of call|Activity)\s*:|$)/i
  );
  if (looseSentMatch && looseSentMatch[1]) {
    return normalizeDateTimeToInputValues(looseSentMatch[1]);
  }

  return { appointmentReceivedDate: "", appointmentReceivedTime: "", found: false };
};

export const extractTypeOfCall = (text) => {
  const exactActivity = extractLabeledValue(text, ["Activity", "Type of call", "Type of Call / Service"]);
  if (exactActivity) return exactActivity;

  const lower = text.toLowerCase();
  if (/\bexport\b|\boutward\b/.test(lower)) return "Export";
  if (lower.includes("import") || lower.includes("inward")) return "Import";
  return "";
};

export const extractPort = (text) => {
  const exactPort = extractLabeledValue(text, ["Port of call", "Port"]);
  if (exactPort) return exactPort;

  const flat = toFlatText(text);
  const fromPortMatch = flat.match(/\bfrom\s+([A-Z][A-Za-z\s-]{2,40})\b/i);
  if (fromPortMatch && fromPortMatch[1]) return sanitizeExtractedValue(fromPortMatch[1]);

  const anchorageMatch = flat.match(/\bat\s+([A-Z]{1,5}\s+anchorage)\b/i);
  if (anchorageMatch && anchorageMatch[1]) return sanitizeExtractedValue(anchorageMatch[1]);

  return "";
};

export const extractVesselName = (text) => {
  const exactName = extractLabeledValue(text, ["Vessel Name"]);
  if (exactName) return exactName;

  const flat = toFlatText(text);
  const ourGoodVessel = flat.match(/\bour\s+good\s+vessel\s+([A-Z0-9][A-Z0-9\s\-./]{2,})\b/i);
  if (ourGoodVessel && ourGoodVessel[1]) return sanitizeExtractedValue(ourGoodVessel[1]);

  const vesselPattern = flat.match(/\bVessel\s+([A-Z0-9][A-Z0-9\s\-./]{2,})\b/i);
  if (vesselPattern && vesselPattern[1]) return sanitizeExtractedValue(vesselPattern[1]);

  const uppercaseLine = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /(?:HORIZON|BARGE|QUEST|EXPRESS|DB|NO\.)/i.test(line) && /^[A-Z0-9][A-Z0-9\s\-./]{4,}$/.test(line));

  return normalizeWhitespace(uppercaseLine || "");
};

const extractBillingInstructions = (text) => {
  const labeled = extractLabeledValue(text, ["Billing Instructions", "Instruction", "Notes", "Remarks"]);
  if (labeled) return labeled;

  const lines = text
    .split("\n")
    .map((line) => normalizeWhitespace(line).replace(/^-+/, ""))
    .filter(Boolean)
    .filter((line) => /(please|kindly|arrange|ensure|request|required|documentation|notification)/i.test(line));

  return lines.slice(0, 2).join(" ");
};

export const buildCardDescription = (text) => {
  const subject = extractLabeledValue(text, ["Subject"]);
  const lines = text
    .split("\n")
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .filter((line) => !/^(from|to|cc|sent|wysłane|subject)\s*:/i.test(line));
  const snippet = lines.slice(0, 3).join(" ");
  return normalizeWhitespace([subject, snippet].filter(Boolean).join(" - ")).slice(0, 500);
};

const parseSingleText = (text) => {
  const normalizedText = normalizePdfText(text);
  const result = createResult();

  const sent = extractAppointmentReceived(normalizedText);
  if (sent.appointmentReceivedDate) setField(result, "appointmentReceivedDate", sent.appointmentReceivedDate, 5);
  if (sent.appointmentReceivedTime) setField(result, "appointmentReceivedTime", sent.appointmentReceivedTime, 5);

  setField(result, "serviceRequestorName", extractLabeledValue(normalizedText, ["From", "Sender", "Service Requestor"]), 5);
  setField(result, "port", extractPort(normalizedText), extractLabeledValue(normalizedText, ["Port of call", "Port"]) ? 5 : 2);
  setField(result, "typeOfCall", extractTypeOfCall(normalizedText), extractLabeledValue(normalizedText, ["Activity", "Type of call", "Type of Call / Service"]) ? 5 : 2);
  setField(result, "vesselName", extractVesselName(normalizedText), extractLabeledValue(normalizedText, ["Vessel Name"]) ? 5 : 2);
  setField(result, "vesselOwner", extractLabeledValue(normalizedText, ["Vessel Owner"]), 5);
  setField(result, "vesselPrincipal", extractLabeledValue(normalizedText, ["Vessel Principal"]), 5);
  setField(result, "vesselManager", extractLabeledValue(normalizedText, ["Vessel Manager"]), 5);
  setField(result, "billingInstructions", extractBillingInstructions(normalizedText), extractLabeledValue(normalizedText, ["Billing Instructions", "Instruction", "Notes", "Remarks"]) ? 5 : 2);
  setField(result, "cardDescription", buildCardDescription(normalizedText), extractLabeledValue(normalizedText, ["Subject"]) ? 5 : 2);
  setField(result, "dailyReportEmail", extractEmails(normalizedText), 5);

  return result;
};

export const mergeParsedResults = (results = []) => {
  const merged = createResult();
  results.forEach((result) => {
    FIELD_KEYS.forEach((field) => {
      const score = result?.confidence?.[field] || 0;
      const value = result?.values?.[field];
      setField(merged, field, value, score);
    });
  });
  return merged.values;
};

const extractPdfTextFromArrayBuffer = async (arrayBuffer) => {
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDocument = await loadingTask.promise;
  const pageTexts = [];

  for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum += 1) {
    const page = await pdfDocument.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => normalizeString(item?.str))
      .filter(Boolean)
      .join(" ");
    pageTexts.push(pageText);
  }

  return pageTexts.join("\n").trim();
};

const parsePdfFile = async (file) => {
  const buffer = await file.arrayBuffer();
  const text = await extractPdfTextFromArrayBuffer(buffer);
  return { text, source: file.name };
};

const parseZipFile = async (file) => {
  const zipBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(zipBuffer);
  const pdfEntries = Object.values(zip.files).filter(
    (entry) => !entry.dir && extractExtension(entry.name) === "pdf"
  );

  const extracted = [];
  for (const entry of pdfEntries) {
    const entryBuffer = await entry.async("arraybuffer");
    const text = await extractPdfTextFromArrayBuffer(entryBuffer);
    extracted.push({ text, source: entry.name });
  }
  return extracted;
};

export const mapAppointmentEmailResponseToFormValues = (parsedData) => {
  const source = parsedData ?? {};
  return {
    appointmentReceivedDate: normalizeString(source.appointmentReceivedDate),
    appointmentReceivedTime: normalizeString(source.appointmentReceivedTime),
    port: normalizeString(source.port),
    typeOfCall: normalizeString(source.typeOfCall),
    vesselName: normalizeString(source.vesselName),
    vesselOwner: normalizeString(source.vesselOwner),
    vesselPrincipal: normalizeString(source.vesselPrincipal),
    vesselManager: normalizeString(source.vesselManager),
    serviceRequestorName: normalizeString(source.serviceRequestorName),
    dailyReportEmail: Array.isArray(source.dailyReportEmail)
      ? source.dailyReportEmail.map((email) => normalizeString(email)).filter(Boolean)
      : [],
    billingInstructions: normalizeString(source.billingInstructions),
    cardDescription: normalizeString(source.cardDescription),
  };
};

export const parseAppointmentEmailFile = async (file) => {
  if (!isAppointmentEmailFileValid(file)) {
    throw new Error(getAppointmentEmailValidationMessage(file?.name));
  }

  const extension = extractExtension(file.name);
  let parsedFiles = [];

  if (extension === "pdf") {
    parsedFiles = [await parsePdfFile(file)];
  } else if (extension === "zip") {
    parsedFiles = await parseZipFile(file);
    if (parsedFiles.length === 0) {
      throw new Error("No PDF files were found inside the ZIP.");
    }
  }

  const warnings = [];
  const parsedTextResults = [];
  parsedFiles.forEach(({ text, source }) => {
    if (!normalizePdfText(text)) {
      return;
    }
    parsedTextResults.push(parseSingleText(text));
  });

  const mergedParsed = mergeParsedResults(parsedTextResults);
  const hasUsefulData = FIELD_KEYS.some((field) => {
    if (field === "dailyReportEmail") return Array.isArray(mergedParsed.dailyReportEmail) && mergedParsed.dailyReportEmail.length > 0;
    return Boolean(normalizeString(mergedParsed[field]));
  });

  if (!hasUsefulData) {
    warnings.push("Text could not be extracted from this file. Please fill details manually.");
  }

  return {
    mappedValues: mapAppointmentEmailResponseToFormValues(mergedParsed),
    warnings,
  };
};

export const applyParsedValues = ({
  mappedValues,
  handleChange,
  existingDailyReportEmail = [],
}) => {
  if (!mappedValues || !handleChange) return;

  Object.entries(mappedValues).forEach(([fieldName, value]) => {
    if (fieldName === "dailyReportEmail") return;
    if (!normalizeString(value)) return;

    handleChange(fieldName)({
      target: { value, name: fieldName },
    });
  });

  const parsedEmails = Array.isArray(mappedValues.dailyReportEmail)
    ? mappedValues.dailyReportEmail
    : [];

  if (parsedEmails.length > 0) {
    const mergedEmails = Array.from(
      new Set([...(Array.isArray(existingDailyReportEmail) ? existingDailyReportEmail : []), ...parsedEmails])
    );
    handleChange("dailyReportEmail")({
      target: { value: mergedEmails, name: "dailyReportEmail" },
    });
  }
};

export const applyAppointmentEmailAutofill = applyParsedValues;
