import * as MsgReaderModule from "msgreader";
import { formatToApiDateTime } from "../../../../../../shared/helpers/appointmentAiExtractor";

const msgHeadersToText = (headers) => {
  if (!headers) return "";
  if (typeof headers === "string") return headers;
  if (Array.isArray(headers)) {
    return headers.map((part) => String(part ?? "")).join("\n");
  }
  if (typeof headers === "object") {
    return Object.entries(headers)
      .map(([key, val]) => `${key}: ${String(val ?? "")}`)
      .join("\n");
  }
  return String(headers);
};

const extractEmailDateFromHeaders = (headers = "") => {
  const headerText = msgHeadersToText(headers);
  if (!headerText) return "";

  const dateMatch = headerText.match(/^Date:\s*(.+)$/im);
  if (dateMatch?.[1]?.trim()) return dateMatch[1].trim();

  const sentMatch = headerText.match(/^Sent:\s*(.+)$/im);
  return sentMatch?.[1]?.trim() || "";
};

const resolveMsgEmailDate = (msg = {}) => {
  const headerDate = extractEmailDateFromHeaders(
    msg?.headers || msg?.transportMessageHeaders || msg?.messageHeaders || ""
  );

  const candidates = [
    msg?.messageDeliveryTime,
    msg?.clientSubmitTime,
    msg?.creationTime,
    headerDate,
  ];

  for (const candidate of candidates) {
    if (candidate instanceof Date && !Number.isNaN(candidate.getTime())) {
      return formatToApiDateTime(candidate);
    }
    const asString = String(candidate ?? "").trim();
    if (asString) return asString;
  }
  return "";
};

export const extractFirstEmailFromText = (value = "") => {
  const source = String(value || "");
  const normalized = source.replace(/mailto:/gi, " ");
  const match = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? String(match[0] || "").replace(/[>),;:\s]+$/g, "").trim() : "";
};

const parseSenderFromText = (senderRaw = "") => {
  const fromText = String(senderRaw || "").trim();
  if (!fromText) return { extractedName: "", extractedEmail: "" };

  const emailMatch = fromText.match(/<([^>]+)>/);
  const extractedEmail = emailMatch?.[1]?.trim() || "";

  const extractedName = fromText
    .replace(/<[^>]+>/g, "")
    .replace(/["']/g, "")
    .trim();

  return { extractedName, extractedEmail };
};

const extractFromHeaderFromMsg = (msg = {}) => {
  const headerText = msgHeadersToText(
    msg?.headers || msg?.transportMessageHeaders || msg?.messageHeaders || ""
  );
  if (!headerText) return "";
  const fromMatch = headerText.match(/^From:\s*(.+)$/im);
  return fromMatch?.[1]?.trim() || "";
};

export const parseMsgSenderDetails = (msg = {}) => {
  const fromHeader = extractFromHeaderFromMsg(msg);
  const senderCandidates = [msg?.senderName, msg?.from, fromHeader].filter((item) =>
    String(item ?? "").trim()
  );

  let extractedName = "";
  let extractedEmail = "";

  for (const candidate of senderCandidates) {
    const parsed = parseSenderFromText(candidate);
    if (parsed.extractedName && !extractedName) extractedName = parsed.extractedName;
    if (parsed.extractedEmail && !extractedEmail) extractedEmail = parsed.extractedEmail;
    if (extractedName && extractedEmail) break;
  }

  if (!extractedEmail) {
    const emailOnlyCandidates = [
      msg?.senderEmail,
      msg?.senderEmailAddress,
      msg?.senderSmtpAddress,
      msg?.fromEmail,
    ];
    for (const candidate of emailOnlyCandidates) {
      const email = extractFirstEmailFromText(candidate);
      if (email) {
        extractedEmail = email;
        break;
      }
    }
  }

  return { extractedName, extractedEmail };
};

const normalizeText = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const parseEmailDateToParts = (value = "") => {
  const clean = String(value).replace(/\s+/g, " ").trim();
  const d = new Date(clean);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const hasExplicitTime = /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?\b/i.test(clean);

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = hasExplicitTime ? String(d.getHours()).padStart(2, "0") : "";
  const min = hasExplicitTime ? String(d.getMinutes()).padStart(2, "0") : "";

  return {
    date: `${yyyy}-${mm}-${dd}`,
    time: hh && min ? `${hh}:${min}` : "",
  };
};

const parseOutlookHeaderDateTime = (value = "") => {
  const source = String(value || "").replace(/\s+/g, " ").trim();
  if (!source) return { date: "", time: "" };

  const normalized = source
    .replace(/^(?:Sent|Date)\s*:\s*/i, "")
    .replace(/^\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:day)?[\s,]+/i, "")
    .replace(/^at\s+/i, "")
    .trim();

  const slash12hMatch = normalized.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+|,\s*)(\d{1,2}):(\d{2})\s*(AM|PM)$/i
  );
  if (slash12hMatch) {
    const dd = Number(slash12hMatch[1]);
    const mm = Number(slash12hMatch[2]);
    const yyyy = Number(slash12hMatch[3]);
    const hour12 = Number(slash12hMatch[4]);
    const minute = Number(slash12hMatch[5]);
    const meridiem = String(slash12hMatch[6] || "").toUpperCase();

    if (!dd || !mm || !yyyy || !hour12 || minute > 59 || !["AM", "PM"].includes(meridiem)) {
      return { date: "", time: "" };
    }

    let hour24 = hour12 % 12;
    if (meridiem === "PM") hour24 += 12;

    return {
      date: `${String(yyyy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`,
      time: `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    };
  }

  const parsed = parseEmailDateToParts(normalized);
  if (parsed?.date) return parsed;
  return { date: "", time: "" };
};

export const resolveMsgReceivedDateTime = (msgData = {}, extractedText = "") => {
  const tryParseDateTime = (value) => {
    const source = String(value || "").trim();
    if (!source) return { date: "", time: "" };
    const parsedHeader = parseOutlookHeaderDateTime(source);
    if (parsedHeader?.date && parsedHeader?.time) return parsedHeader;
    const parsedGeneric = parseEmailDateToParts(source);
    if (parsedGeneric?.date && parsedGeneric?.time) return parsedGeneric;
    return { date: "", time: "" };
  };

  const metadataCandidates = [
    msgData?.sentDate,
    msgData?.messageDeliveryTime,
    msgData?.clientSubmitTime,
    msgData?.deliveryTime,
    msgData?.date,
    msgData?.creationTime,
    msgData?.lastModificationTime,
    msgData?.messageDate,
    msgData?.messageDateTime,
  ];

  for (const candidate of metadataCandidates) {
    const parsed = tryParseDateTime(candidate);
    if (parsed?.date) return parsed;
  }

  const rawHeaderSources = [
    msgData?.headers,
    msgData?.transportMessageHeaders,
    msgData?.messageHeaders,
  ]
    .filter((item) => item !== undefined && item !== null)
    .map((item) => {
      if (typeof item === "string") return item;
      if (Array.isArray(item)) return item.map((part) => String(part || "")).join("\n");
      if (typeof item === "object") {
        const keyValueText = Object.entries(item)
          .map(([key, val]) => `${key}: ${String(val ?? "")}`)
          .join("\n");
        return `${keyValueText}\n${JSON.stringify(item)}`;
      }
      return String(item);
    });

  const rawHeaderText = rawHeaderSources.join("\n");
  if (rawHeaderText) {
    const lineMatches = [...rawHeaderText.matchAll(/(?:^|\n)\s*(Date|Sent)\s*:\s*([^\n]+)/gi)];
    for (const match of lineMatches) {
      const parsed = tryParseDateTime(match?.[2] || "");
      if (parsed?.date) return parsed;
    }

    const inlinePatterns = [
      /\b(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM))\b/i,
      /\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[+-]\d{4})?)\b/i,
    ];
    for (const pattern of inlinePatterns) {
      const match = rawHeaderText.match(pattern);
      const parsed = tryParseDateTime(match?.[1] || "");
      if (parsed?.date) return parsed;
    }
  }

  const source = String(extractedText || "");
  const headerPatterns = [
    /(?:^|\n)\s*Sent:\s*([^\n]+)/i,
    /(?:^|\n)\s*Date:\s*([^\n]+)/i,
    /(?:^|\n)\s*(?:From|To|Cc):[^\n]*\b(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM))\b/i,
    /\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[+-]\d{4})?)\b/i,
  ];

  for (const pattern of headerPatterns) {
    const match = source.match(pattern);
    const headerValue = String(match?.[1] || "").trim();
    if (!headerValue) continue;
    const parsed = tryParseDateTime(headerValue);
    if (parsed?.date) return parsed;
  }

  return { date: "", time: "" };
};

export const extractEmailHeaderDetails = (text = "") => {
  const source = String(text || "");
  const extracted = {
    fromName: "",
    fromEmail: "",
    sentDateTime: "",
    portText: "",
    serviceText: "",
    fullText: source,
  };

  const fromMatch = source.match(/From:\s*([^\n<]+?)\s*<([^>]+)>/i);
  if (fromMatch) {
    extracted.fromName = fromMatch[1].trim();
    extracted.fromEmail = fromMatch[2].trim();
  } else {
    const fromLineMatch = source.match(/From:\s*([^\n]+)/i);
    if (fromLineMatch) extracted.fromName = fromLineMatch[1].replace(/\s*<\s*>$/, "").trim();
  }

  if (!extracted.fromName || !extracted.fromEmail) {
    const onWroteMatch = source.match(/On\s+.+?\s+at\s+\d{1,2}:\d{2}\s*[AP]M\s+(.+?)\s*<([^>]+)>\s*wrote:/i);
    if (onWroteMatch) {
      if (!extracted.fromName) extracted.fromName = String(onWroteMatch[1] || "").trim();
      if (!extracted.fromEmail) extracted.fromEmail = String(onWroteMatch[2] || "").trim();
    }
  }

  if (!extracted.fromEmail) {
    const email = extractFirstEmailFromText(source);
    if (email) extracted.fromEmail = email;
  }

  if (!extracted.fromName) {
    const nameEmailMatch = source.match(/([^\n<>]+?)\s*<\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\s*>/i);
    if (nameEmailMatch) {
      extracted.fromName = nameEmailMatch[1].replace(/^From:\s*/i, "").trim();
      extracted.fromEmail = nameEmailMatch[2].trim();
    }
  }

  const sentMatch = source.match(
    /Sent:\s*((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)?)/i
  );
  if (sentMatch) {
    extracted.sentDateTime = sentMatch[1].trim();
  } else {
    const onDateMatch = source.match(/On\s+([A-Za-z]{3,9},?\s+[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}\s+at\s+\d{1,2}:\d{2}\s*[AP]M)/i);
    if (onDateMatch) extracted.sentDateTime = onDateMatch[1].trim();
  }

  const portOfCallMatch = source.match(/Port\s*of\s*call\s*:\s*([^\n]+)/i);
  if (portOfCallMatch) {
    extracted.portText = portOfCallMatch[1].trim();
  }

  const activityMatch = source.match(/Activity\s*:\s*([^\n]+)/i);
  if (activityMatch) {
    extracted.serviceText = activityMatch[1].trim();
  }

  if (!extracted.portText && /rt\s*anchorage|rt\s*port|rastanura|ras\s*tanura/i.test(source)) {
    extracted.portText = "Ras Tanura";
  }

  if (!extracted.serviceText) {
    if (/inward\s*clearance|import/i.test(source)) {
      extracted.serviceText = "Import";
    } else if (/outward\s*clearance|export/i.test(source)) {
      extracted.serviceText = "Export";
    }
  }

  return extracted;
};

export const findMatchingOption = (options = [], extractedText = "") => {
  let target = normalizeText(extractedText);
  if (!target) return null;

  if (/(^rt$|rt port|rt anchorage|rastanura|ras tanura)/.test(target)) {
    target = "ras tanura";
  } else if (/(import|inward|inward clearance)/.test(target)) {
    target = "import";
  } else if (/(export|outward|export clearance|outward clearance)/.test(target)) {
    target = "export";
  }

  return (
    options.find((option) => {
      let label = normalizeText(option?.label);
      if (/(^rt$|rt port|rt anchorage|rastanura|ras tanura)/.test(label)) {
        label = "ras tanura";
      } else if (/(import|inward|inward clearance)/.test(label)) {
        label = "import";
      } else if (/(export|outward|export clearance|outward clearance)/.test(label)) {
        label = "export";
      }
      return label.includes(target) || target.includes(label);
    }) || null
  );
};

export const isMsgFile = (file) => file?.name?.toLowerCase()?.endsWith(".msg");

export const extractMsgAppointmentText = async (file) => {
  const buffer = await file.arrayBuffer();
  const uint8Array = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const MsgReaderConstructor =
    MsgReaderModule.default ||
    MsgReaderModule.MsgReader ||
    MsgReaderModule;

  if (typeof MsgReaderConstructor !== "function") {
    throw new Error("MSG reader constructor not found");
  }

  const msgReader = new MsgReaderConstructor(uint8Array);
  const msgInfo = msgReader.getFileData();

  const body = msgInfo.body || msgInfo.bodyHTML || "";
  const subject = msgInfo.subject || "";
  const { extractedName, extractedEmail } = parseMsgSenderDetails(msgInfo);
  const senderName = extractedName || msgInfo.senderName || msgInfo.from || "";
  const senderEmail =
    extractedEmail ||
    extractFirstEmailFromText(
      [
        msgInfo.senderEmail,
        msgInfo.senderEmailAddress,
        msgInfo.senderSmtpAddress,
        msgInfo.senderName,
        msgInfo.from,
        msgInfo.fromEmail,
      ]
        .filter(Boolean)
        .join(" ")
    ) ||
    msgInfo.senderEmail ||
    msgInfo.senderEmailAddress ||
    msgInfo.senderSmtpAddress ||
    msgInfo.fromEmail ||
    "";
  const messageDeliveryTime = msgInfo.messageDeliveryTime || "";
  const clientSubmitTime = msgInfo.clientSubmitTime || "";
  const emailDate = resolveMsgEmailDate(msgInfo);

  const extractedText = `
Email Metadata:
Sender Name: ${senderName}
Sender Email: ${senderEmail}
Subject: ${subject}
Date: ${emailDate}
Message Delivery Time: ${messageDeliveryTime}
Client Submit Time: ${clientSubmitTime}

Email Body:
${body}
`.trim();
  return {
    extractedText,
    msgData: msgInfo,
    metadata: {
      emailDate,
      senderName,
      senderEmail,
      serviceRequestorName: extractedName,
      serviceRequestorEmail: extractedEmail,
      subject,
    },
  };
};
