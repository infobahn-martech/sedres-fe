import { DEFAULT_PRE_ARRIVAL_DOCUMENT_HANDLING } from "./preArrivalDocumentHandling";
import {
  getEventFieldKeyPrefix,
  mapApiSaberStatusToFormValue,
  mapApiWeatherForecastToFormValue,
  PRE_ARRIVAL_CUSTOM_CLEARANCE_ROLE_ID,
  PRE_ARRIVAL_GRO_ROLE_ID,
  SABER_APPLIED_BY_SEDRES,
} from "./operationConstants";

export function parseApiDateTimeParts(raw) {
  if (raw == null || raw === "") return { date: "", time: "" };
  const s = String(raw).trim().replace("T", " ");
  const [datePart, timePart = ""] = s.split(/\s+/);
  const date = datePart && datePart.length >= 10 ? datePart.slice(0, 10) : datePart || "";
  const time = timePart && timePart.length >= 5 ? timePart.slice(0, 5) : "";
  return { date, time };
}

function roleIdToPreArrivalProcessKey(roleId) {
  const n = Number(roleId);
  if (n === PRE_ARRIVAL_GRO_ROLE_ID) return "gro";
  if (n === PRE_ARRIVAL_CUSTOM_CLEARANCE_ROLE_ID) return "customClearance";
  return null;
}

function resolveChecklistDocumentId(doc) {
  const id = doc?.checklist_item_id ?? doc?.checklistItemId ?? doc?.document_id ?? doc?.documentId;
  if (id == null || String(id).trim() === "") return null;
  return id;
}

function resolveChecklistDocumentName(doc) {
  return (
    doc?.item_name ||
    doc?.itemName ||
    doc?.document_name ||
    doc?.documentName ||
    "Document"
  );
}

function documentCandidateScore(row) {
  const status = Number(row?.status);
  let score = 0;
  if (status === 2) score = 50;
  else if (status === 1) score = 40;
  else if (status === 3) score = 30;
  else if (status === 4) score = 20;
  if (String(row?.file_url || "").trim()) score += 10;
  return score;
}

function mergeDocumentCandidate(existing, candidate) {
  return documentCandidateScore(candidate) > documentCandidateScore(existing) ? candidate : existing;
}

/** Flatten role → tasks → checklist documents from `get_prearrival_detail.task_documents`. */
export function collectChecklistDocumentsForRole(entry) {
  const role_id = entry?.role_id ?? entry?.roleId ?? null;
  const tasks = Array.isArray(entry?.tasks) ? entry.tasks : [];
  const itemById = new Map();

  for (const task of tasks) {
    const taskDocs = Array.isArray(task?.documents) ? task.documents : [];
    const taskMeta = {
      status: task?.status ?? null,
      remarks: task?.remarks ?? null,
      file_name: task?.file_name || task?.fileName || null,
      file_url: task?.file_url || task?.fileUrl || task?.url || "",
      call_task_document_id: task?.call_task_document_id ?? task?.callTaskDocumentId ?? null,
      task_id: task?.task_id ?? task?.taskId ?? null,
      task_name: task?.task_name || task?.taskName || null,
    };

    for (const doc of taskDocs) {
      const checklistItemId = resolveChecklistDocumentId(doc);
      if (checklistItemId == null) continue;

      const idStr = String(checklistItemId);
      const candidate = {
        role_id,
        document_id: checklistItemId,
        checklist_item_id: checklistItemId,
        document_name: resolveChecklistDocumentName(doc),
        file_name: doc?.file_name || doc?.fileName || taskMeta.file_name,
        file_url: doc?.file_url || doc?.fileUrl || doc?.url || taskMeta.file_url,
        status: doc?.status ?? taskMeta.status ?? null,
        remarks: doc?.remarks ?? taskMeta.remarks ?? null,
        call_task_document_id:
          doc?.call_task_document_id ?? doc?.callTaskDocumentId ?? taskMeta.call_task_document_id,
        task_id: taskMeta.task_id,
        task_name: taskMeta.task_name,
      };

      const existing = itemById.get(idStr);
      itemById.set(idStr, existing ? mergeDocumentCandidate(existing, candidate) : candidate);
    }
  }

  return Array.from(itemById.values());
}

/** Nested `task_documents` groups (role + documents[] / tasks[]) or legacy flat rows. */
export function normalizeTaskDocumentFlatItems(taskDocuments) {
  const list = Array.isArray(taskDocuments) ? taskDocuments : [];
  const out = [];
  for (const entry of list) {
    if (Array.isArray(entry?.tasks) && entry.tasks.length) {
      out.push(...collectChecklistDocumentsForRole(entry));
      continue;
    }
    if (Array.isArray(entry?.documents) && entry.documents.length) {
      for (const d of entry.documents) {
        const documentId = resolveChecklistDocumentId(d);
        if (documentId == null) continue;
        out.push({
          role_id: entry.role_id,
          document_id: documentId,
          checklist_item_id: documentId,
          call_task_document_id: d.call_task_document_id ?? d.callTaskDocumentId ?? null,
          document_name: resolveChecklistDocumentName(d),
          file_name: d.file_name || d.fileName || null,
          file_url: d.file_url || d.fileUrl || d.url || "",
          status: d.status ?? null,
          remarks: d.remarks ?? null,
        });
      }
      continue;
    }
    if (entry?.document_id == null && resolveChecklistDocumentId(entry) == null) continue;
    const documentId = entry.document_id ?? entry.documentId ?? resolveChecklistDocumentId(entry);
    out.push({
      role_id: entry.role_id,
      document_id: documentId,
      checklist_item_id: documentId,
      call_task_document_id: entry.call_task_document_id ?? entry.callTaskDocumentId ?? null,
      document_name: resolveChecklistDocumentName(entry),
      file_name: entry.file_name || entry.fileName || null,
      file_url: entry.file_url || entry.fileUrl || entry.url || "",
      status: entry.status ?? null,
      remarks: entry.remarks ?? null,
    });
  }
  return out;
}

export function findTaskDocumentGroupByRole(taskDocuments, roleId) {
  const arr = Array.isArray(taskDocuments) ? taskDocuments : [];
  if (roleId === PRE_ARRIVAL_GRO_ROLE_ID) {
    return arr.find(
      (e) =>
        Number(e?.role_id) === PRE_ARRIVAL_GRO_ROLE_ID ||
        /gro/i.test(String(e?.role || e?.role_name || "").trim())
    );
  }
  if (roleId === PRE_ARRIVAL_CUSTOM_CLEARANCE_ROLE_ID) {
    return arr.find(
      (e) =>
        Number(e?.role_id) === PRE_ARRIVAL_CUSTOM_CLEARANCE_ROLE_ID ||
        /custom\s*clearance/i.test(String(e?.role || "").trim())
    );
  }
  return arr.find((e) => Number(e?.role_id) === roleId);
}

const stageFileKey = (f) => `${f?.stage_document_id ?? ""}:${f?.name ?? ""}:${f?.url ?? ""}`;

function mapStageDocumentsFromApi(stageDocuments = []) {
  return (stageDocuments || [])
    .map((sd) => {
      const raw = sd?.attachment ?? sd?.url ?? sd?.file_url;
      if (raw == null || String(raw).trim() === "") return null;
      if (typeof raw !== "string") return null;
      const trimmed = raw.trim();
      let name = trimmed;
      if (/^https?:\/\//i.test(trimmed)) {
        try {
          const seg = trimmed.split("/").pop() || trimmed;
          name = seg.includes("?") ? seg.split("?")[0] : seg;
        } catch {
          name = trimmed;
        }
      }
      return {
        name,
        url: /^https?:\/\//i.test(trimmed) ? trimmed : undefined,
        stage_document_id: sd?.stage_document_id ?? sd?.stageDocumentId,
      };
    })
    .filter(Boolean);
}

function mergeStageFiles(existingStageFiles = [], stageFromApi = []) {
  const dhStageFiles = Array.isArray(existingStageFiles) ? [...existingStageFiles] : [];
  const existingStageKeys = new Set(dhStageFiles.map(stageFileKey));
  for (const f of stageFromApi) {
    const k = stageFileKey(f);
    if (!existingStageKeys.has(k)) {
      dhStageFiles.push(f);
      existingStageKeys.add(k);
    }
  }
  return dhStageFiles;
}

function findCurrentDocumentRow(currentGroups, roleId, documentId) {
  const idStr = String(documentId);
  const roleIdNum = Number(roleId);
  const group = (Array.isArray(currentGroups) ? currentGroups : []).find(
    (g) =>
      (!Number.isNaN(roleIdNum) && Number(g?.role_id) === roleIdNum) ||
      (g?.items || []).some((r) => String(r?.id) === idStr)
  );
  return (group?.items || []).find((r) => String(r?.id) === idStr) || null;
}

function mapTaskDocumentRow(apiDoc, existingRow = null) {
  const documentId =
    apiDoc?.document_id ??
    apiDoc?.documentId ??
    apiDoc?.checklist_item_id ??
    apiDoc?.checklistItemId;
  if (documentId == null || String(documentId).trim() === "") return null;

  const idStr = String(documentId);
  const documentName = String(
    apiDoc?.document_name ||
      apiDoc?.documentName ||
      apiDoc?.item_name ||
      apiDoc?.itemName ||
      existingRow?.document_name ||
      existingRow?.name ||
      "Document"
  ).trim();
  const fileUrl = String(apiDoc?.file_url || apiDoc?.fileUrl || apiDoc?.url || "").trim();
  const fileName = apiDoc?.file_name || apiDoc?.fileName || existingRow?.file_name || null;

  const files = [];
  if (fileUrl) {
    files.push({ name: fileName || documentName || "uploaded-file", url: fileUrl });
  }
  for (const f of Array.isArray(existingRow?.files) ? existingRow.files : []) {
    if (f?.file instanceof File) {
      const dup = files.some(
        (existing) =>
          existing.name === f.name &&
          (f.url ? existing.url === f.url : !(existing.file instanceof File))
      );
      if (!dup) files.push(f);
    }
  }

  return {
    id: idStr,
    document_id: documentId,
    checklist_item_id: apiDoc?.checklist_item_id ?? apiDoc?.checklistItemId ?? documentId,
    document_name: documentName,
    name: documentName,
    is_required: Boolean(apiDoc?.is_required ?? apiDoc?.required ?? existingRow?.is_required),
    status: apiDoc?.status ?? existingRow?.status ?? null,
    remarks: apiDoc?.remarks ?? existingRow?.remarks ?? null,
    call_task_document_id:
      apiDoc?.call_task_document_id ?? apiDoc?.callTaskDocumentId ?? existingRow?.call_task_document_id ?? null,
    task_id: apiDoc?.task_id ?? apiDoc?.taskId ?? existingRow?.task_id ?? null,
    task_name: apiDoc?.task_name ?? apiDoc?.taskName ?? existingRow?.task_name ?? null,
    file_url: fileUrl || existingRow?.file_url || null,
    file_name: fileName,
    files,
  };
}

function syncDocumentsFromRoleGroups(roleGroups) {
  const documents = { gro: [], customClearance: [] };
  for (const group of Array.isArray(roleGroups) ? roleGroups : []) {
    const processKey = roleIdToPreArrivalProcessKey(Number(group?.role_id));
    if (processKey) {
      documents[processKey] = group.items || [];
      continue;
    }
    const roleLabel = String(group?.role_name || "").trim().toLowerCase();
    if (/gro/.test(roleLabel)) documents.gro = group.items || [];
    else if (/custom\s*clearance/.test(roleLabel)) documents.customClearance = group.items || [];
  }
  return documents;
}

/**
 * Builds Pre-Arrival document handling UI state from `get_prearrival_detail` only
 * (`task_documents` + `stage_documents`).
 */
export function buildDocumentHandlingFromPreArrivalDetail(
  taskDocuments = [],
  stageDocuments = [],
  currentHandling = null
) {
  const base =
    currentHandling && typeof currentHandling === "object"
      ? currentHandling
      : { ...DEFAULT_PRE_ARRIVAL_DOCUMENT_HANDLING };

  const currentGroups = Array.isArray(base?.roleGroups) ? base.roleGroups : [];
  const roleGroups = [];
  const list = Array.isArray(taskDocuments) ? taskDocuments : [];

  for (const entry of list) {
    const role_id = entry.role_id ?? entry.roleId ?? null;
    const role_name = String(entry.role || entry.role_name || entry.roleName || "Documents").trim();

    if (Array.isArray(entry?.tasks) && entry.tasks.length) {
      const collected = collectChecklistDocumentsForRole(entry);
      const items = collected
        .map((doc) =>
          mapTaskDocumentRow(
            doc,
            findCurrentDocumentRow(currentGroups, role_id, doc?.document_id ?? doc?.checklist_item_id)
          )
        )
        .filter(Boolean);
      if (items.length) {
        roleGroups.push({ role_id, role_name, items });
      }
      continue;
    }

    if (!Array.isArray(entry?.documents) || !entry.documents.length) continue;

    const items = entry.documents
      .map((doc) =>
        mapTaskDocumentRow(
          doc,
          findCurrentDocumentRow(
            currentGroups,
            role_id,
            doc?.document_id ?? doc?.documentId ?? doc?.checklist_item_id ?? doc?.checklistItemId
          )
        )
      )
      .filter(Boolean);

    if (!items.length) continue;

    roleGroups.push({
      role_id,
      role_name,
      items,
    });
  }

  if (!roleGroups.length) {
    const flatItems = normalizeTaskDocumentFlatItems(taskDocuments);
    const byRoleId = new Map();
    for (const item of flatItems) {
      const roleId = item.role_id;
      if (roleId == null) continue;
      if (!byRoleId.has(roleId)) byRoleId.set(roleId, []);
      byRoleId.get(roleId).push(item);
    }

    for (const [roleId, items] of byRoleId) {
      const groupMeta = findTaskDocumentGroupByRole(list, Number(roleId));
      const role_name = String(groupMeta?.role || groupMeta?.role_name || "Documents").trim();
      const mappedItems = items.map((item) => {
        const existing = findCurrentDocumentRow(currentGroups, roleId, item.document_id);
        return mapTaskDocumentRow(item, existing);
      }).filter(Boolean);
      if (mappedItems.length) {
        roleGroups.push({ role_id: roleId, role_name, items: mappedItems });
      }
    }
  }

  const selectedProcesses = {
    gro: false,
    customClearance: false,
  };
  for (const group of roleGroups) {
    const roleId = Number(group?.role_id);
    if (roleId === PRE_ARRIVAL_GRO_ROLE_ID || /gro/i.test(String(group?.role_name || ""))) {
      selectedProcesses.gro = true;
    }
    if (
      roleId === PRE_ARRIVAL_CUSTOM_CLEARANCE_ROLE_ID ||
      /custom\s*clearance/i.test(String(group?.role_name || ""))
    ) {
      selectedProcesses.customClearance = true;
    }
  }

  const documents = syncDocumentsFromRoleGroups(roleGroups);
  const stageFiles = mergeStageFiles(
    base?.stageFiles,
    mapStageDocumentsFromApi(stageDocuments)
  );

  return {
    selectedProcesses,
    roleGroups,
    documents: {
      gro: documents.gro,
      customClearance: documents.customClearance,
    },
    stageFiles,
  };
}

/**
 * Merges `task_documents` (by `role_id` → GRO vs Custom) and `stage_documents` into document handling.
 * GRO = role_id 4, Custom clearance = role_id 5 (same as user pickers in Pre Arrival).
 * @deprecated Prefer {@link buildDocumentHandlingFromPreArrivalDetail} for list-only-from-detail flows.
 */
export function mergePreArrivalDetailDocuments(currentHandling, taskDocuments = [], stageDocuments = []) {
  if (!currentHandling || typeof currentHandling !== "object" || !currentHandling.documents) {
    return currentHandling;
  }
  const dh = JSON.parse(JSON.stringify(currentHandling));
  if (!Array.isArray(dh.stageFiles)) dh.stageFiles = [];

  dh.stageFiles = mergeStageFiles(dh.stageFiles, mapStageDocumentsFromApi(stageDocuments));

  const taskRoles = new Set(
    (taskDocuments || []).map((t) => Number(t?.role_id)).filter((n) => !Number.isNaN(n))
  );
  if (!dh.selectedProcesses) dh.selectedProcesses = { gro: false, customClearance: false };
  if (taskRoles.has(PRE_ARRIVAL_GRO_ROLE_ID)) dh.selectedProcesses.gro = true;
  if (taskRoles.has(PRE_ARRIVAL_CUSTOM_CLEARANCE_ROLE_ID)) dh.selectedProcesses.customClearance = true;

  const pushFile = (row, entry) => {
    if (!row || !entry?.name) return;
    const files = row.files || [];
    const dup = files.some(
      (f) =>
        f.name === entry.name &&
        (entry.url ? f.url === entry.url : !(f.file instanceof File))
    );
    if (!dup) row.files = [...files, entry];
  };

  const flatItems = normalizeTaskDocumentFlatItems(taskDocuments);
  const buildRowsForProcess = (processKey) => {
    const items = flatItems.filter((t) => roleIdToPreArrivalProcessKey(t?.role_id) === processKey);
    if (!items.length) return null;
    const idOrder = [];
    const seen = new Set();
    for (const t of items) {
      const idStr = String(t.document_id);
      if (!seen.has(idStr)) {
        seen.add(idStr);
        idOrder.push(idStr);
      }
    }
    const existing = dh.documents[processKey] || [];
    return idOrder.map((idStr) => {
      const first = items.find((x) => String(x.document_id) === idStr);
      const prev = existing.find((r) => String(r.id) === idStr);
      const documentName = String(
        first?.document_name || prev?.document_name || prev?.name || "Document"
      );
      const uploadedFileName = first?.file_name || prev?.file_name || null;
      const row = {
        id: idStr,
        document_name: documentName,
        name: documentName,
        is_required: Boolean(prev?.is_required),
        status: first?.status ?? prev?.status ?? null,
        remarks: first?.remarks ?? prev?.remarks ?? null,
        call_task_document_id: first?.call_task_document_id ?? prev?.call_task_document_id ?? null,
        document_id: first?.document_id ?? prev?.document_id ?? null,
        file_url: first?.file_url ?? prev?.file_url ?? null,
        file_name: uploadedFileName,
        files: Array.isArray(prev?.files) ? [...prev.files] : [],
      };
      for (const t of items) {
        if (String(t.document_id) !== idStr) continue;
        const fn = t.file_name || uploadedFileName || `uploaded-file`;
        const u = String(t.file_url || "").trim();
        if (u) pushFile(row, { name: fn, url: u });
      }
      return row;
    });
  };

  const mergeBuiltIntoTemplate = (processKey, builtRows) => {
    if (!builtRows?.length) return;
    const templateRows = dh.documents[processKey] || [];
    if (!templateRows.length) {
      dh.documents[processKey] = builtRows;
      return;
    }

    const merged = templateRows.map((templateRow) => {
      const templateId = String(templateRow?.id ?? "");
      const built = builtRows.find(
        (row) =>
          String(row?.id) === templateId ||
          (templateRow?.checklist_item_id != null &&
            Number(row?.document_id ?? row?.checklist_item_id) ===
              Number(templateRow.checklist_item_id))
      );
      if (!built) return templateRow;
      return {
        ...templateRow,
        status: built.status ?? templateRow.status,
        remarks: built.remarks ?? templateRow.remarks,
        call_task_document_id: built.call_task_document_id ?? templateRow.call_task_document_id,
        document_id: built.document_id ?? templateRow.document_id,
        file_url: built.file_url ?? templateRow.file_url,
        file_name: built.file_name ?? templateRow.file_name,
        files:
          Array.isArray(built.files) && built.files.length ? built.files : templateRow.files,
      };
    });

    for (const builtRow of builtRows) {
      const exists = merged.some(
        (row) =>
          String(row?.id) === String(builtRow?.id) ||
          (builtRow?.document_id != null &&
            String(row?.document_id ?? row?.id) === String(builtRow.document_id))
      );
      if (!exists) merged.push(builtRow);
    }

    dh.documents[processKey] = merged;
  };

  const groBuilt = buildRowsForProcess("gro");
  if (groBuilt?.length) {
    mergeBuiltIntoTemplate("gro", groBuilt);
    dh.selectedProcesses.gro = true;
  }

  const ccBuilt = buildRowsForProcess("customClearance");
  if (ccBuilt?.length) {
    mergeBuiltIntoTemplate("customClearance", ccBuilt);
    dh.selectedProcesses.customClearance = true;
  }

  if (Array.isArray(dh.roleGroups) && dh.roleGroups.length) {
    for (const group of dh.roleGroups) {
      const roleId = Number(group?.role_id);
      if (Number.isNaN(roleId)) continue;
      const items = flatItems.filter((t) => Number(t?.role_id) === roleId);
      if (!items.length) continue;

      const idOrder = [];
      const seen = new Set();
      for (const t of items) {
        const idStr = String(t.document_id);
        if (!seen.has(idStr)) {
          seen.add(idStr);
          idOrder.push(idStr);
        }
      }

      const builtRows = idOrder.map((idStr) => {
        const first = items.find((x) => String(x.document_id) === idStr);
        const existing = (group.items || []).find((r) => String(r.id) === idStr);
        const documentName = String(
          first?.document_name || existing?.document_name || existing?.name || "Document"
        );
        const uploadedFileName = first?.file_name || existing?.file_name || null;
        const row = {
          id: idStr,
          document_name: documentName,
          name: documentName,
          is_required: Boolean(existing?.is_required),
          status: first?.status ?? existing?.status ?? null,
          remarks: first?.remarks ?? existing?.remarks ?? null,
          call_task_document_id: first?.call_task_document_id ?? existing?.call_task_document_id ?? null,
          document_id: first?.document_id ?? existing?.document_id ?? null,
          file_url: first?.file_url ?? existing?.file_url ?? null,
          file_name: uploadedFileName,
          files: Array.isArray(existing?.files) ? [...existing.files] : [],
        };
        for (const t of items) {
          if (String(t.document_id) !== idStr) continue;
          const fn = t.file_name || uploadedFileName || "uploaded-file";
          const u = String(t.file_url || "").trim();
          if (u) pushFile(row, { name: fn, url: u });
        }
        return row;
      });

      const templateRows = group.items || [];
      if (!templateRows.length) {
        group.items = builtRows;
      } else {
        const merged = templateRows.map((templateRow) => {
          const templateId = String(templateRow?.id ?? "");
          const built = builtRows.find(
            (row) =>
              String(row?.id) === templateId ||
              (templateRow?.checklist_item_id != null &&
                Number(row?.document_id ?? row?.checklist_item_id) ===
                  Number(templateRow.checklist_item_id))
          );
          if (!built) return templateRow;
          return {
            ...templateRow,
            status: built.status ?? templateRow.status,
            remarks: built.remarks ?? templateRow.remarks,
            call_task_document_id: built.call_task_document_id ?? templateRow.call_task_document_id,
            document_id: built.document_id ?? templateRow.document_id,
            file_url: built.file_url ?? templateRow.file_url,
            file_name: built.file_name ?? templateRow.file_name,
            files:
              Array.isArray(built.files) && built.files.length ? built.files : templateRow.files,
          };
        });
        for (const builtRow of builtRows) {
          const exists = merged.some(
            (row) =>
              String(row?.id) === String(builtRow?.id) ||
              (builtRow?.document_id != null &&
                String(row?.document_id ?? row?.id) === String(builtRow.document_id))
          );
          if (!exists) merged.push(builtRow);
        }
        group.items = merged;
      }

      if (taskRoles.has(roleId)) {
        const roleLabel = String(group?.role_name || "").trim();
        if (/gro/i.test(roleLabel)) dh.selectedProcesses.gro = true;
        if (/custom\s*clearance/i.test(roleLabel)) dh.selectedProcesses.customClearance = true;
      }
    }
  }

  return dh;
}

/**
 * Applies `pre_arrival/get_prearrival_detail` payload into Operation / CardForm fields.
 * Document handling rows are built separately via `buildDocumentHandlingFromPreArrivalDetail`.
 * @returns {{ appliedAnyTime: boolean, coordinatesId: string|null }}
 */
export function applyPreArrivalGetDetailToForm({
  responseBody,
  eventFields,
  handleChange,
  currentForm,
}) {
  const root = responseBody?.data ?? responseBody ?? {};
  const pre = root.prearrival ?? root.preArrival;
  const timeObjects = root.time_objects ?? root.timeObjects ?? [];
  const taskDocuments = root.task_documents ?? root.taskDocuments ?? [];

  const groAssign = findTaskDocumentGroupByRole(taskDocuments, PRE_ARRIVAL_GRO_ROLE_ID);
  const ccAssign = findTaskDocumentGroupByRole(taskDocuments, PRE_ARRIVAL_CUSTOM_CLEARANCE_ROLE_ID);
  if (groAssign?.user_id != null) {
    handleChange("assignedGro")({ target: { value: String(groAssign.user_id) } });
  }
  if (ccAssign?.user_id != null) {
    handleChange("assignedCustom")({ target: { value: String(ccAssign.user_id) } });
  }

  let appliedAnyTime = false;
  let coordinatesId = null;
  let saberFormFromApi = "";

  if (pre && typeof pre === "object") {
    saberFormFromApi = mapApiSaberStatusToFormValue(pre.saber_status);
    if (saberFormFromApi) handleChange("saberUtStatus")({ target: { value: saberFormFromApi } });

    const weatherForm = mapApiWeatherForecastToFormValue(pre.weather_forecast);
    if (weatherForm) {
      handleChange("weatherForecast")({ target: { value: weatherForm } });
      handleChange("preArrivalTimeObjectsNeedRecheck")({
        target: { value: weatherForm === "Bad weather" },
      });
    }

    if (pre.remarks != null && String(pre.remarks).trim() !== "") {
      handleChange("remarks")({ target: { value: String(pre.remarks) } });
    }

    if (pre.coordinates_id != null && String(pre.coordinates_id).trim() !== "") {
      coordinatesId = String(pre.coordinates_id).trim();
      handleChange("preArrivalCoordinatesId")({ target: { value: coordinatesId } });
    }
  }

  const saberDocAttachments = [];
  if (pre && typeof pre === "object") {
    const saberRaw = pre.saber_doc;
    if (saberRaw != null && saberRaw !== "") {
      const list = Array.isArray(saberRaw)
        ? saberRaw
        : String(saberRaw)
            .split(/[\s,;]+/)
            .map((s) => s.trim())
            .filter(Boolean);
      const parsed = list
        .map((item, i) => {
          if (typeof item === "string") {
            return item ? { name: `SABER document ${i + 1}`, url: item } : null;
          }
          const url = item?.url || item?.attachment || item?.path;
          const name = item?.file_name || item?.name || `SABER document ${i + 1}`;
          return url ? { name: String(name), url: String(url) } : null;
        })
        .filter(Boolean);
      if (parsed.length && saberFormFromApi === SABER_APPLIED_BY_SEDRES) {
        saberDocAttachments.push(...parsed);
      }
    }
  }

  if (saberDocAttachments.length) {
    const existing = currentForm?.saberUtDocumentsAttachments || [];
    const merged = [...existing];
    for (const a of saberDocAttachments) {
      if (!merged.some((m) => m.name === a.name && m.url === a.url)) merged.push(a);
    }
    handleChange("saberUtDocumentsAttachments")({ target: { value: merged } });
  }

  const fields = Array.isArray(eventFields) ? eventFields : [];
  for (const to of timeObjects) {
    const rawValue = to?.time_object_value ?? to?.value;
    if (rawValue == null || String(rawValue).trim() === "") continue;

    const { date, time } = parseApiDateTimeParts(rawValue);
    if (!date || !time) continue;

    const toId = to?.time_object_id ?? to?.timeObjectId;
    const toName = to?.time_object ?? to?.event_name ?? "";

    let keyPrefix = "";
    const matched = fields.find((field) => {
      const fid = field?.time_object_id ?? field?.event_type_id ?? field?.id;
      if (toId != null && fid != null && Number(fid) === Number(toId)) return true;
      return (
        String(field?.event_name || "").trim().toLowerCase() === String(toName).trim().toLowerCase()
      );
    });
    if (matched?.keyPrefix) keyPrefix = matched.keyPrefix;
    else if (toName) keyPrefix = getEventFieldKeyPrefix(toName);
    if (!keyPrefix) continue;

    handleChange(`${keyPrefix}Date`)({ target: { value: date } });
    handleChange(`${keyPrefix}Time`)({ target: { value: time } });
    appliedAnyTime = true;
  }

  if (appliedAnyTime) {
    handleChange("preArrivalEtaAutofillDisabled")({ target: { value: true } });
  }

  return { appliedAnyTime, coordinatesId };
}
