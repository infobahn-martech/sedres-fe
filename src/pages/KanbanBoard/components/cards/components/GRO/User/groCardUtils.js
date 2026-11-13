// GRO Board card view helpers (no JSX)

export const GRO_MAIN_VIEWS = {
  inward: "inward",
  cg: "cg",
  zawil: "zawil",
};

export const GRO_ACTIVE_TABS = {
  documents: "documents",
  crewImmigration: "crewImmigration",
  vesselInwardRegistration: "vesselInwardRegistration",
  crewChange: "crewChange",
};

export const resolveGroCallId = (card) => {
  const raw = card?.call_id ?? card?.callId ?? card?.id;
  if (raw == null || raw === "") return null;
  return raw;
};

export const resolveGroCardId = (card) => {
  const raw = card?.card_id ?? card?.cardId ?? card?.id;
  if (raw == null || String(raw).trim() === "") return null;
  return raw;
};

/** Numeric port id for `users/get_users_by_role` (from call detail or kanban card). */
export const resolveGroPortId = (detail, card) => {
  const portObj = detail?.port && typeof detail.port === "object" ? detail.port : null;
  const cardPort = card?.port;
  const cardPortAsId =
    typeof cardPort === "number" ||
    (typeof cardPort === "string" && /^\d+$/.test(String(cardPort).trim()))
      ? cardPort
      : null;
  const candidates = [
    detail?.port_id,
    detail?.portId,
    portObj?.port_id,
    portObj?.id,
    card?.port_id,
    card?.portId,
    cardPortAsId,
  ];
  for (const value of candidates) {
    if (value === undefined || value === null) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return null;
};

export const enrichGroDocWithRowKey = (doc, index) => ({
  ...doc,
  __rowKey:
    doc.call_task_document_id != null
      ? `ctd-${doc.call_task_document_id}`
      : doc.document_id != null
        ? `did-${doc.document_id}-${index}`
        : `fb-${index}`,
});

/** Resolve task id for GET task_card/get_documents_by_task/{task_id}. */
export const resolveGroTaskId = (card, selectedTask = null) => {
  const candidates = [
    selectedTask?.task_id,
    selectedTask?.taskId,
    card?.taskId,
    card?.task_id,
    card?.raw?.task_id,
  ];
  for (const value of candidates) {
    if (value == null || String(value).trim() === "") continue;
    return String(value).trim();
  }
  return null;
};

/** Coerce API is_first_column to boolean (missing → false, i.e. show verify actions). */
export const parseIsFirstColumnFromPayload = (payload = {}) => {
  const raw = payload?.is_first_column;
  if (raw == null) return false;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw !== 0;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return false;
};

const parseTaskNameFromPayload = (payload = {}) => {
  const raw = payload?.task_name ?? payload?.taskName;
  if (raw == null) return "";
  const trimmed = String(raw).trim();
  return trimmed || "";
};

/** GET task_card/get_documents_by_task — documents + column flags from response.data.data */
export const parseDocumentsByTaskPayload = (res) => {
  const payload = res?.data?.data ?? res?.data ?? {};
  const docs = payload?.documents;
  return {
    documents: Array.isArray(docs) ? docs : [],
    isFirstColumn: parseIsFirstColumnFromPayload(payload),
    taskName: parseTaskNameFromPayload(payload),
  };
};

/**
 * `details` sends a stored file as a bare name (`immigration_doc: "x.pdf"`) plus a sibling
 * `<key>_url`. Merge each pair into `{ file_name, file_url }` so the saved-file display gets a real link.
 */
const mergeGroDetailFileUrls = (details = {}) => {
  const merged = { ...details };
  Object.keys(details).forEach((key) => {
    if (key.endsWith("_url")) return;
    const url = details[`${key}_url`];
    const value = details[key];
    if (typeof url === "string" && url.trim() && typeof value === "string" && value.trim()) {
      merged[key] = { file_name: value.trim(), file_url: url.trim() };
    }
  });
  return merged;
};

const asArray = (value) => (Array.isArray(value) ? value : []);

/**
 * GET call_file/get_call_detail_by_id/{call_id}/{card_id} — the task card's single bind API.
 * Response: data.{ call, vessel, task }. Returns everything the GRO card needs:
 * - detail: flat call + vessel + assigned user (header fields, port/call type ids)
 * - documents / isFirstColumn / taskName (was task_card/get_documents_by_task)
 * - taskDetails: saved stage fields + documents + saved time objects (was arrival/get_task_details)
 * - stageTimeObjects / stage11TimeObjects (was time_object/get_stage_time_objects)
 * - assignableUsers: [{ value, label }] (was users/get_users_by_role)
 */
export const parseGroCallDetailByIdPayload = (res) => {
  const payload = res?.data?.data ?? res?.data ?? {};
  const call = payload?.call ?? {};
  const vessel = payload?.vessel ?? {};
  const task = payload?.task ?? {};

  const detail = {
    ...call,
    ...vessel,
    assigned_user_id: task.assigned_user_id ?? null,
    assigned_user_name: task.assigned_user_name ?? null,
  };

  const sortByOrder = (rows) =>
    [...rows].sort((a, b) => Number(a?.sort_order ?? 0) - Number(b?.sort_order ?? 0));
  const stageTimeObjects = sortByOrder(asArray(task.stage_time_objects));
  const stage11TimeObjects = sortByOrder(asArray(task.stage_11_time_objects));
  const documents = asArray(task.documents);

  const taskDetails = {
    ...mergeGroDetailFileUrls(task.details ?? {}),
    documents,
    // Stage time objects carry their saved `time_object_value` inline.
    time_objects: [...asArray(call.time_objects), ...stageTimeObjects, ...stage11TimeObjects],
  };

  return {
    detail,
    hasTask: Boolean(payload?.task),
    taskName: parseTaskNameFromPayload(task),
    isFirstColumn: parseIsFirstColumnFromPayload(task),
    documents,
    taskDetails,
    stageTimeObjects,
    stage11TimeObjects,
    assignableUsers: parseGroUsersByRoleResponse({ data: asArray(task.assignable_users) }),
  };
};

/** Card-level task label before documents API resolves. */
export const buildSelectedTaskFromCard = (card) => {
  if (!card) return null;
  const task_name = [card?.task_name, card?.taskName, card?.raw?.task_name]
    .map((value) => (value != null ? String(value).trim() : ""))
    .find(Boolean);
  return task_name ? { task_name } : null;
};

/** Panel title for task document upload sections (API → selected task → fallback). */
export const resolveTaskDocumentsTitle = (
  taskDocumentsData,
  selectedTask,
  fallback = "Task Documents"
) => {
  const fromApi = String(taskDocumentsData?.task_name ?? "").trim();
  if (fromApi) return fromApi;
  const fromSelected = String(selectedTask?.task_name ?? selectedTask?.taskName ?? "").trim();
  if (fromSelected) return fromSelected;
  return fallback;
};

/** Normalize task document rows from get_documents_by_task for GRO document lists. */
export const normalizeGroApiDocuments = (apiDocuments) =>
  (apiDocuments || [])
    .filter((doc) => String(doc?.document_name ?? "").trim() !== "")
    .map((doc) => ({
      ...doc,
      is_uploaded: Boolean(doc.is_uploaded ?? (doc.file_url || doc.file_name)),
      file_name: doc.file_name || null,
      file_url: doc.file_url || null,
      status: Number(doc.status ?? 0),
      uploaded_by: doc.uploaded_by ?? doc.uploaded_by_user ?? null,
    }));

export const groApiErrorMessage = (err, fallback) =>
  err?.response?.data?.message ?? err?.response?.data?.error ?? err?.message ?? fallback;

/** Lowercase extension without dot, or "" if none (handles URLs and optional ?filename=). */
export const groExtractFileExtension = (hint) => {
  if (hint == null) return "";
  const trimmed = String(hint).trim();
  if (!trimmed) return "";
  const noHash = trimmed.split("#")[0];
  const qIdx = noHash.indexOf("?");
  const pathPart = qIdx >= 0 ? noHash.slice(0, qIdx) : noHash;
  const queryPart = qIdx >= 0 ? noHash.slice(qIdx + 1) : "";

  const segmentFromPath = (() => {
    const p = pathPart.trim();
    if (!p) return "";
    return p.includes("/") ? p.slice(p.lastIndexOf("/") + 1) : p;
  })();

  let candidate = segmentFromPath;
  if (!candidate.includes(".") && queryPart) {
    try {
      const params = new URLSearchParams(queryPart);
      for (const key of ["filename", "file_name", "name", "file", "originalname"]) {
        const v = params.get(key);
        if (v) {
          const decoded = decodeURIComponent(String(v).replace(/\+/g, " "));
          if (decoded.includes(".")) {
            candidate = decoded;
            break;
          }
        }
      }
    } catch {
      /* ignore malformed query */
    }
  }

  const dot = candidate.lastIndexOf(".");
  return dot >= 0 ? candidate.slice(dot + 1).toLowerCase() : "";
};

/** Map file extension to document list icon variant. */
export const groExtensionToIconKind = (ext) => {
  if (!ext) return "default";
  if (ext === "pdf") return "pdf";
  if (ext === "msg" || ext === "eml") return "mail";
  if (ext === "xls" || ext === "xlsx" || ext === "csv") return "excel";
  if (ext === "doc" || ext === "docx") return "word";
  if (ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp") return "image";
  return "default";
};

/**
 * Resolves icon kind from multiple hints (file name, URL, document fields). First known type wins.
 * @returns {"pdf"|"mail"|"excel"|"word"|"image"|"default"}
 */
export function getDocumentFileTypeIcon(...hints) {
  for (const h of hints) {
    if (h == null || h === "") continue;
    if (typeof h === "object" && !Array.isArray(h)) {
      const nested = getDocumentFileTypeIcon(
        h.file_name,
        h.file_url,
        h.document_copy,
        h.uploaded_file_name,
        h.fileName,
        h.filename,
        h.document_file_name
      );
      if (nested !== "default") return nested;
      continue;
    }
    const kind = groExtensionToIconKind(groExtractFileExtension(String(h)));
    if (kind !== "default") return kind;
  }
  return "default";
}

/** First non-empty extension found across the same hints as {@link getDocumentFileTypeIcon}. */
export function getGroDocumentResolvedExtension(...hints) {
  for (const h of hints) {
    if (h == null || h === "") continue;
    if (typeof h === "object" && !Array.isArray(h)) {
      const nested = getGroDocumentResolvedExtension(
        h.file_name,
        h.file_url,
        h.document_copy,
        h.uploaded_file_name,
        h.fileName,
        h.filename,
        h.document_file_name
      );
      if (nested) return nested;
      continue;
    }
    const ext = groExtractFileExtension(String(h));
    if (ext) return ext;
  }
  return "";
}

export const GRO_FILE_BADGE = {
  pdf: "PDF",
  excel: "XLS",
  word: "DOC",
  image: "IMG",
  mail: "",
  default: "",
};

export const firstNonEmptyGroDisplay = (...candidates) => {
  for (const c of candidates) {
    if (c === null || c === undefined) continue;
    const s = String(c).trim();
    if (s !== "") return s;
  }
  return "-";
};

/** Users list from POST /users/get_users_by_role */
export const parseGroUsersByRoleResponse = (res) => {
  const body = res?.data ?? res;
  const list = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
  return list
    .map((row) => {
      const id = row?.user_id ?? row?.id ?? row?.userid;
      if (id == null || String(id).trim() === "") return null;
      const label =
        row?.name ?? row?.user_name ?? row?.username ?? row?.full_name ?? `User ${id}`;
      return { value: String(id), label: String(label).trim() || `User ${id}` };
    })
    .filter(Boolean);
};

export const resolveGroRequestedOperatorDisplay = (detail) => {
  const requestedStr =
    typeof detail?.requested_operator === "string" ? detail.requested_operator.trim() : "";
  const assignedOperatorLabel =
    typeof detail?.assigned_operator === "string" && !/^\d+$/.test(String(detail.assigned_operator).trim())
      ? String(detail.assigned_operator).trim()
      : "";
  return firstNonEmptyGroDisplay(
    assignedOperatorLabel || null,
    detail?.assigned_operator_name,
    requestedStr || null,
    detail?.requested_operator_name,
    detail?.assigned_operator_id != null && detail.assigned_operator_id !== ""
      ? String(detail.assigned_operator_id)
      : "",
    detail?.requested_operator_id != null && detail.requested_operator_id !== ""
      ? String(detail.requested_operator_id)
      : ""
  );
};

export const resolveGroAssignedUserIdFromDetail = (detail) => {
  const raw = detail?.assigned_user_id ?? detail?.assigned_user;
  if (raw == null || String(raw).trim() === "") return "";
  return String(raw).trim();
};

export const resolveGroAssignedUserDisplayName = (detail, userId, userOptions = []) => {
  const fromDetail = firstNonEmptyGroDisplay(
    detail?.assigned_user_name,
    detail?.assigned_operator_name,
    typeof detail?.assigned_operator === "string" && !/^\d+$/.test(String(detail.assigned_operator).trim())
      ? detail.assigned_operator
      : ""
  );
  if (fromDetail !== "-") return fromDetail;
  const id = String(userId ?? "").trim();
  if (!id) return "-";
  const match = userOptions.find((o) => String(o.value) === id);
  return match?.label ?? id;
};

/** Title-case all-caps API labels (e.g. "CREW LIST"); leave mixed-case strings unchanged. */
export const formatGroDocumentDisplayName = (raw) => {
  if (raw == null) return "";
  const t = String(raw).trim();
  if (!t) return "";
  if (/[a-z]/.test(t)) return t;
  return t.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
};

/**
 * GRO custom document status (API): 0 = not uploaded, 1 = uploaded, 2 = verified, 3 = reupload, 4 = rejected.
 * Unknown values fall back to 0.
 */
export const getGroDocumentVerifyStatus = (doc) => {
  const raw = doc?.status;
  if (raw == null || raw === "") return 0;
  const n = Number(raw);
  if (Number.isNaN(n)) return 0;
  if (n >= 0 && n <= 4) return n;
  return 0;
};

export const groDocumentHasDownloadableUrl = (doc) => {
  const u = doc?.file_url;
  return u != null && String(u).trim() !== "";
};

export const parseGroPassRequestsResponse = (res) => {
  const data = res?.data?.data ?? res?.data ?? {};
  return {
    cg: Array.isArray(data.cg) ? data.cg : [],
    zawil: Array.isArray(data.zawil) ? data.zawil : [],
  };
};

/** Plain text for table cells; safe for strings that may contain HTML fragments. */
export const stripGroHtmlToPlainText = (value) => {
  if (value == null) return "";
  const s = String(value);
  if (s.trim() === "") return "";
  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(`<div>${s}</div>`, "text/html");
      const text = doc.body.textContent ?? "";
      return text.replace(/\s+/g, " ").trim();
    } catch {
      /* fall through */
    }
  }
  return s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
};

export const groPassCrewRowFields = (crew) => {
  let remarks = firstNonEmptyGroDisplay(crew.remarks, crew.remark, crew.note);
  if (remarks !== "-") {
    const plain = stripGroHtmlToPlainText(remarks);
    remarks = plain !== "" ? plain : "-";
  }
  return {
    crewName: firstNonEmptyGroDisplay(crew.crew_name, crew.name, crew.full_name, crew.crewName),
    passport: firstNonEmptyGroDisplay(
      crew.passport_no,
      crew.passport_number,
      crew.passport,
      crew.passportNo
    ),
    nationality: firstNonEmptyGroDisplay(crew.nationality, crew.nationality_name),
    rank: firstNonEmptyGroDisplay(crew.rank, crew.rank_name, crew.crew_rank),
    movementType: firstNonEmptyGroDisplay(crew.movement_type, crew.movement, crew.movementType),
    status: firstNonEmptyGroDisplay(crew.status, crew.pass_status, crew.request_status, crew.state),
    requestedDate: firstNonEmptyGroDisplay(
      crew.requested_date,
      crew.request_date,
      crew.created_at,
      crew.date_requested
    ),
    remarks,
    documentUrl:
      crew.document_url != null && String(crew.document_url).trim() !== ""
        ? String(crew.document_url).trim()
        : "",
  };
};

/** Numeric or string work order id for API payloads */
export const getGroWorkOrderId = (wo) => {
  if (!wo || typeof wo !== "object") return null;
  const raw = wo.wo_id ?? wo.id ?? wo.work_order_id;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isNaN(n) && String(raw).trim() === String(n)) return n;
  return raw;
};

/** Crew pass row id for Zawil single-row upload */
export const getGroCrewPassId = (crew) => {
  if (!crew || typeof crew !== "object") return null;
  const raw = crew.crew_pass_id ?? crew.crewPassId ?? crew.pass_id;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isNaN(n) && String(raw).trim() === String(n)) return n;
  return raw;
};

/** Stable id for a flattened crew row (checkbox / selection). */
export const groPassCrewRowId = (row) => {
  if (!row || row.kind !== "crew") return "";
  return `${row.woKey}-c-${row.crewIndex}`;
};

export const groPassUploadTargetId = (payload) => {
  if (!payload || payload.woKey == null || payload.crewIndex == null) return "";
  return `${payload.woKey}-c-${payload.crewIndex}`;
};

/** Flatten work orders to table rows (crew lines + empty-wo placeholders). */
export const flattenGroPassRows = (workOrders) => {
  const rows = [];
  if (!Array.isArray(workOrders) || workOrders.length === 0) return rows;
  workOrders.forEach((wo, woIdx) => {
    const woKey = String(wo?.wo_id ?? wo?.id ?? wo?.wo_number ?? `idx-${woIdx}`);
    const woNumber = firstNonEmptyGroDisplay(wo?.wo_number, wo?.woNumber, wo?.work_order_number);
    const woId = getGroWorkOrderId(wo);
    const crew = Array.isArray(wo?.crew) ? wo.crew : [];
    if (crew.length === 0) {
      rows.push({ kind: "empty-wo", woKey, woIdx, wo, woNumber, woId });
      return;
    }
    crew.forEach((c, idx) => {
      rows.push({
        kind: "crew",
        woKey,
        woIdx,
        wo,
        woNumber,
        woId,
        crew: c,
        crewIndex: idx,
        crewPassId: getGroCrewPassId(c),
      });
    });
  });
  return rows;
};

export const buildGroPassIssueDateString = (issuePickerParts) => {
  const { date, time } = issuePickerParts || {};
  if (!date) return "";
  const formattedTime = time ? String(time).slice(0, 5) : "00:00";
  return `${date} ${formattedTime}:00`;
};

/** Fixed CSS for portaled pass upload popover below an anchor (getBoundingClientRect). */
export const computeGroPassUploadPopoverPosition = (anchorRect) => {
  const margin = 16;
  const gap = 8;
  const defaultWidth = 380;
  if (anchorRect == null || typeof window === "undefined") {
    return {
      position: "fixed",
      top: "24px",
      left: "16px",
      width: "380px",
      maxWidth: "calc(100vw - 32px)",
      zIndex: 9999,
    };
  }
  const maxW = Math.min(defaultWidth, Math.max(280, window.innerWidth - 2 * margin));
  let left = anchorRect.left;
  const top = anchorRect.bottom + gap;
  if (left + maxW > window.innerWidth - margin) {
    left = anchorRect.right - maxW;
  }
  if (left < margin) left = margin;
  if (left + maxW > window.innerWidth - margin) {
    left = Math.max(margin, window.innerWidth - margin - maxW);
  }
  return {
    position: "fixed",
    top: `${top}px`,
    left: `${left}px`,
    width: `${maxW}px`,
    maxWidth: "calc(100vw - 32px)",
    zIndex: 9999,
  };
};

export const groPassStatusBadgeTone = (raw) => {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!s || s === "-") return "neutral";
  const n = Number(s);
  if (n === 1) return "success";
  if (n === 2) return "danger";
  if (/reject|denied|failed|fail|cancel/.test(s)) return "danger";
  if (/approv|accept|verified|complete|done|clear|issued|pass/.test(s)) return "success";
  if (/pend|wait|submitted|progress|open|draft|review/.test(s)) return "warning";
  return "neutral";
};

/** GRO task name → arrival stage id for time_object/get_stage_time_objects */
const GRO_TASK_STAGE_ID_BY_NAME = {
  "vessel inward registration": 6,
  "crew immigration": 7,
  "inward clearance": 8,
  "custom bayan": 9,
  bayan: 9,
  "applying mwp": 10,
  "outward clearance": 13,
  "mwp cancellation": 15,
};

export const resolveGroStageIdFromTaskName = (taskName) => {
  const normalized = String(taskName ?? "").trim().toLowerCase();
  if (!normalized) return null;
  const stageId = GRO_TASK_STAGE_ID_BY_NAME[normalized];
  return stageId != null ? stageId : null;
};

export const resolveGroTimeObjectFieldKey = (item) => {
  const fieldKey = String(item?.field_key ?? "").trim();
  if (fieldKey) return fieldKey;
  const id = item?.time_object_id;
  return id != null && String(id).trim() !== "" ? String(id).trim() : "";
};

export const parseGroStageTimeObjectsResponse = (res) => {
  const data = res?.data?.data ?? res?.data ?? res ?? {};
  const rows = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.time_objects)
      ? data.time_objects
      : Array.isArray(data)
        ? data
        : [];
  return [...rows].sort((a, b) => Number(a?.sort_order ?? 0) - Number(b?.sort_order ?? 0));
};

export const resolveGroTimeObjectValueKey = (item) => {
  const id = item?.time_object_id;
  return id != null && String(id).trim() !== "" ? String(id).trim() : resolveGroTimeObjectFieldKey(item);
};

/** Current date/time as { date: "YYYY-MM-DD", time: "HH:mm" }, for stamping a time-object field with "now". */
export const resolveGroNowDateTimeParts = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  };
};

const formatGroTimeObjectValue = (parts) => {
  const date = parts?.date != null ? String(parts.date).trim() : "";
  const time = parts?.time != null ? String(parts.time).trim() : "";
  if (!date) return "";
  const formattedTime = time ? String(time).slice(0, 5) : "00:00";
  return `${date} ${formattedTime}:00`;
};

/** arrival/save_arrival_document — [{ time_object_id, time_object_value }] */
export const buildGroArrivalTimeObjectsPayload = (timeObjects, timeObjectValues) =>
  (Array.isArray(timeObjects) ? timeObjects : [])
    .map((item) => {
      const timeObjectId = item?.time_object_id;
      if (timeObjectId == null || String(timeObjectId).trim() === "") return null;
      const valueKey = resolveGroTimeObjectValueKey(item);
      const parts = timeObjectValues?.[valueKey] ?? { date: "", time: "" };
      return {
        time_object_id: Number(timeObjectId),
        time_object_value: formatGroTimeObjectValue(parts),
      };
    })
    .filter(Boolean);

export const validateGroRequiredTimeObjects = (timeObjects, timeObjectValues) => {
  const errors = {};
  (Array.isArray(timeObjects) ? timeObjects : []).forEach((item) => {
    if (String(item?.is_required ?? "0") !== "1") return;
    const key = resolveGroTimeObjectValueKey(item);
    if (!key) return;
    const parts = timeObjectValues?.[key] ?? { date: "", time: "" };
    const date = String(parts.date ?? "").trim();
    const time = String(parts.time ?? "").trim();
    if (!date || !time) {
      const label = String(item?.time_object ?? "Field").trim() || "Field";
      errors[key] = `${label} is required.`;
    }
  });
  return errors;
};

/** Reverse of formatGroTimeObjectValue: "YYYY-MM-DD HH:MM:SS" (or with a "T") → { date, time }. */
const parseGroTimeObjectValue = (value) => {
  const match = String(value ?? "").trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  return match ? { date: match[1], time: match[2] } : null;
};

/**
 * arrival/get_task_details — maps its saved `time_objects` onto the current stage's time-object
 * field definitions, producing the same shape as timeObjectValues. The API groups saved entries by
 * stage (`[{ stage_id, items: [{ time_object_id, time_object_value }] }]`), so entries are flattened
 * before matching; a flat `[{ time_object_id, time_object_value }]` shape is also accepted.
 */
export const applyGroSavedTimeObjectValues = (timeObjectDefs, savedTimeObjects) => {
  const rawSaved = Array.isArray(savedTimeObjects) ? savedTimeObjects : [];
  const saved = rawSaved.flatMap((entry) => (Array.isArray(entry?.items) ? entry.items : [entry]));
  const values = {};
  (Array.isArray(timeObjectDefs) ? timeObjectDefs : []).forEach((item) => {
    const id = item?.time_object_id;
    if (id == null) return;
    const match = saved.find((s) => String(s?.time_object_id) === String(id));
    const parsed = parseGroTimeObjectValue(match?.time_object_value);
    if (parsed) values[resolveGroTimeObjectValueKey(item)] = parsed;
  });
  return values;
};
