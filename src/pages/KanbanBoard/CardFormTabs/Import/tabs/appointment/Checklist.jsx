import PropTypes from "prop-types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useCallDetail,
  useSharedCallDetail,
} from "@/pages/KanbanBoard/CardFormTabs/shared/callDetailContext";
import checklistService from "@/services/checklistService";
import callFileService from "@/services/callFileService";
import { notify } from "@/components/Toaster";
import "@/design/scss/checklist.scss";
import ChecklistTypeBlock from "./checklistTab/ChecklistTypeBlock";
import ChecklistLoadingState from "./checklistTab/ChecklistLoadingState";
import ChecklistEmptyState from "./checklistTab/ChecklistEmptyState";
import ChecklistRejectedBanner from "./checklistTab/ChecklistRejectedBanner";
import {
  collectItemIdsUnderSectionInBlocks,
  collectTreeSectionIds,
  flattenTreeItems,
  extractCallDetailChecklistRows,
  isChecklistReviewRejected,
  mapCallDetailChecklist,
} from "./checklistTab/checklistMappers";

const AUTOSAVE_STATUS_LABEL = {
  saving: "Saving…",
  saved: "All changes saved",
  error: "Couldn't save changes",
};

const normalizeExpiryDateForUi =(value) => {
  const s = String(value ?? "").trim();
  if (!s || s === "0000-00-00" || s.startsWith("0000-00-00")) return "";
  return s;
};

const collectLocalFilesForSavePayload = (uploadedFilesList) => {
  const list = Array.isArray(uploadedFilesList) ? uploadedFilesList : [];
  return list
    .map((entry) => {
      if (entry instanceof File) return entry;
      return entry?.file instanceof File ? entry.file : null;
    })
    .filter((f) => f instanceof File);
};

const collectExistingFileIdsForSavePayload = (uploadedFilesList) => {
  const list = Array.isArray(uploadedFilesList) ? uploadedFilesList : [];
  return list
    .filter((entry) => entry?.fromApi === true && !(entry?.file instanceof File))
    .map((entry) => entry?.file_id ?? entry?.id)
    .filter((id) => id != null && String(id).trim() !== "" && !String(id).startsWith("api_"))
    .map(String);
};

const normalizeChecklistFilename = (value) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

const getNormalizedChecklistFileName = (entry) => {
  if (!entry) return "";
  const rawName =
    entry instanceof File
      ? entry.name
      : entry?.name ?? entry?.fileName ?? entry?.file?.name ?? "";
  return normalizeChecklistFilename(rawName);
};

const dedupeChecklistFilesByNormalizedName = (entries) => {
  const list = Array.isArray(entries) ? entries : [];
  const seen = new Set();
  const out = [];

  list.forEach((entry) => {
    const normalizedName = getNormalizedChecklistFileName(entry);
    const dedupeKey =
      normalizedName ||
      String(
        entry?.id ??
        (entry?.file instanceof File
          ? `${entry.file.name}_${entry.file.size ?? ""}_${entry.file.lastModified ?? ""}`
          : "")
      );
    if (!dedupeKey || seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    out.push(entry);
  });

  return out;
};


// Comparable view of the user-editable checklist state, used for unsaved-change detection.
const serializeItemsDataForDirtyCheck = (itemsData) =>
  JSON.stringify(
    Object.keys(itemsData || {})
      .sort()
      .map((id) => {
        const item = itemsData[id] || {};
        return [
          id,
          item.checked === true,
          item.remarks ?? "",
          item.expiryDate ?? "",
          (item.uploadedFiles || []).map((f) => f?.id ?? f?.name ?? f?.file?.name ?? ""),
        ];
      })
  );

const getChecklistItemIdFromUiItem = (item) => {
  const raw = String(item?.id ?? "");
  const marker = "_item_";
  const idx = raw.lastIndexOf(marker);
  if (idx < 0) return null;
  const extracted = raw.slice(idx + marker.length).trim();
  return extracted || null;
};

/** itemsData for every item of the blocks, from the call's saved values (lookup[typeId][itemId]). */
const buildItemsDataFromCallChecklist = (blocks, lookup) => {
  const next = {};
  blocks.forEach((block) => {
    const blockTypeId = String(block.typeId);
    flattenTreeItems(block.tree).forEach((item) => {
      const checklistItemId = getChecklistItemIdFromUiItem(item);
      const savedItem = checklistItemId ? lookup?.[blockTypeId]?.[checklistItemId] : null;
      const backendFiles = dedupeChecklistFilesByNormalizedName(
        Array.isArray(savedItem?.apiUploadedFiles) ? savedItem.apiUploadedFiles : []
      );
      next[item.id] = {
        // Document Req. items are done only while a document is uploaded.
        checked: item.requireInfoOnlyFromApi
          ? backendFiles.length > 0
          : savedItem?.checked === true,
        remarks: savedItem?.remarks ?? "",
        expiryDate: normalizeExpiryDateForUi(savedItem?.expiryDate ?? ""),
        apiUploadedFiles: backendFiles,
        uploadedFiles: backendFiles,
        // Session-only: hides backend files the user removed; clearing requires backend delete API + refetch.
        removedFiles: [],
        requirement: item.requirement ?? null,
        description: item.description ?? "",
        // Verify / reject state set from a task card (task_documents; read-only here).
        review: savedItem?.review ?? null,
      };
    });
  });
  return next;
};

function Checklist({
  card,
  formValues,
  isViewOnly = false,
  isDAModule = false,
  cardDetail,
  callDetailLoading = false,
  onDirtyChange,
}) {
  const currentCallId = useMemo(
    () => card?.call_id ?? formValues?.call_id ?? card?.callId ?? "",
    [card?.call_id, card?.callId, formValues?.call_id]
  );

  // GET call_file/get_call_detail/{callId}: the drawer's shared copy (no extra request inside
  // CardForm) — its `checklist[]` carries the selected checklist types, their sections/items
  // and this call's saved values in one payload.
  const hasCardDetailProp = Boolean(cardDetail && typeof cardDetail === "object");
  const {
    detail: localCallDetail,
    loading: callDetailLoad,
    error: callDetailError,
  } = useCallDetail(currentCallId, { enabled: !hasCardDetailProp });
  // CardForm's shared copy (when rendered inside the drawer): refreshing it updates every tab.
  const refetchSharedCallDetail = useSharedCallDetail(currentCallId)?.refetch;

  // Checklist rows re-read after a save (when the parent's call detail can't be refreshed here).
  const [refreshedRows, setRefreshedRows] = useState(null);
  const [itemsData, setItemsData] = useState({});
  const [openSections, setOpenSections] = useState({});
  // Auto-save state: "idle" | "saving" | "saved" | "error".
  const [saveStatus, setSaveStatus] = useState("idle");
  const savingRef = useRef(false);
  const queuedSaveRef = useRef(false);
  const latestItemsDataRef = useRef(itemsData);
  latestItemsDataRef.current = itemsData;
  // itemsData as last sent by an auto-save: the refresh that follows keeps any item edited since.
  const mergeBaseRef = useRef(null);

  const callDetail = hasCardDetailProp ? cardDetail : localCallDetail;
  const checklistRows = useMemo(
    () => refreshedRows ?? extractCallDetailChecklistRows(callDetail),
    [refreshedRows, callDetail]
  );
  // A newer call detail from the parent supersedes rows we re-read ourselves.
  useEffect(() => {
    setRefreshedRows(null);
  }, [callDetail]);

  const { blocks: checklistBlocks, lookup: savedChecklistLookup } = useMemo(
    () => mapCallDetailChecklist(checklistRows),
    [checklistRows]
  );

  // Baseline = last loaded/saved state; it follows itemsData until the user edits,
  // then edits are compared against it so reverting an edit clears the dirty flag.
  const userEditedRef = useRef(false);
  const baselineSnapshotRef = useRef("");
  const latestSnapshotRef = useRef("");

  // New call: drop the previous call's rows/edits so they never leak into this one.
  useEffect(() => {
    userEditedRef.current = false;
    setRefreshedRows(null);
    setItemsData({});
    setOpenSections({});
  }, [currentCallId]);

  // (Re)build form state from the call detail. A background refresh of the shared call detail
  // (e.g. another tab saved) must not wipe unsaved checklist edits, so it is skipped while dirty.
  // After an auto-save, items untouched since that save take the server's copy (uploaded
  // files get their real ids) while items edited since keep the user's values.
  useEffect(() => {
    const fresh = buildItemsDataFromCallChecklist(checklistBlocks, savedChecklistLookup);
    if (userEditedRef.current) {
      const base = mergeBaseRef.current;
      if (!base) return;
      mergeBaseRef.current = null;
      baselineSnapshotRef.current = serializeItemsDataForDirtyCheck(fresh);
      setItemsData((prev) => {
        const next = { ...fresh };
        Object.keys(prev).forEach((id) => {
          if (prev[id] !== base[id] && id in fresh) next[id] = prev[id];
        });
        return next;
      });
    } else {
      mergeBaseRef.current = null;
      setItemsData(fresh);
    }
    const allSectionIds = checklistBlocks.flatMap((b) => collectTreeSectionIds(b.tree));
    setOpenSections((prev) =>
      allSectionIds.reduce((acc, sectionId) => ({ ...acc, [sectionId]: prev[sectionId] ?? true }), {})
    );
  }, [checklistBlocks, savedChecklistLookup]);

  useEffect(() => {
    const snapshot = serializeItemsDataForDirtyCheck(itemsData);
    latestSnapshotRef.current = snapshot;
    if (!userEditedRef.current) {
      baselineSnapshotRef.current = snapshot;
      return;
    }
    onDirtyChange?.(snapshot !== baselineSnapshotRef.current);
  }, [itemsData, onDirtyChange]);

  // Auto-save: a change asks for a save; the effect below runs it once the new itemsData
  // has rendered, so the request always carries the latest state.
  const saveRequestedRef = useRef(false);
  const requestSave = () => {
    if (!isViewOnly) saveRequestedRef.current = true;
  };

  const handleItemChange = (id, nextData, options) => {
    userEditedRef.current = true;
    if (options?.save !== false) requestSave();
    setItemsData((prev) => ({ ...prev, [id]: { ...prev[id], ...nextData } }));
  };

  const handleSectionToggle = (sectionId) => {
    setOpenSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const handleSelectAll = (sectionId, checked) => {
    userEditedRef.current = true;
    // Document Req. items follow their upload, so "select all" leaves them alone.
    const documentRequiredIds = new Set(
      checklistBlocks
        .flatMap((b) => flattenTreeItems(b.tree))
        .filter((it) => it.requireInfoOnlyFromApi)
        .map((it) => it.id)
    );
    const itemIds = collectItemIdsUnderSectionInBlocks(checklistBlocks, sectionId).filter(
      (itemId) => !documentRequiredIds.has(itemId)
    );
    requestSave();
    setItemsData((prev) => {
      const next = { ...prev };
      itemIds.forEach((itemId) => {
        next[itemId] = { ...(next[itemId] || {}), checked };
      });
      return next;
    });
  };

  // Local files already sent by an earlier auto-save: never upload them twice while the
  // refreshed call detail (which replaces them with the server's copies) is still on its way.
  const uploadedLocalFilesRef = useRef(new WeakSet());

  const buildChecklistSaveFormData = useCallback((itemsData) => {
    const formData = new FormData();
    formData.append("call_id", String(currentCallId));
    const sentFiles = [];

    const checklists = checklistBlocks.map((block) => {
      const items = [];
      block.tree.forEach((section) => {
        const sectionItems = flattenTreeItems([section]);
        sectionItems.forEach((item) => {
          const d = itemsData[item.id] || {};
          const checklistItemId = getChecklistItemIdFromUiItem(item);
          const resolvedChecklistItemId = checklistItemId || item.checklist_item_id || item.id;
          const newLocalFiles = collectLocalFilesForSavePayload(d.uploadedFiles).filter(
            (file) => !uploadedLocalFilesRef.current.has(file)
          );
          // A new file on a rejected item is a re-upload: the backend should reset the task
          // document to "uploaded" (status 1) so the task card can verify it again.
          const isReupload = isChecklistReviewRejected(d.review?.status) && newLocalFiles.length > 0;
          items.push({
            checklist_item_id: resolvedChecklistItemId,
            is_checked: d.checked === true ? 1 : 0,
            remarks: d.remarks || "",
            expiry_date: d.expiryDate || "",
            ...(isReupload ? { is_reupload: 1 } : {}),
          });
          // Only new local File blobs — never re-post backend file metadata.
          // TODO: Backend delete API needed to persist removals from `removedFiles`; session hide does not change GET.
          const fileFieldName = `files_${resolvedChecklistItemId}[]`;
          newLocalFiles.forEach((file) => {
            formData.append(fileFieldName, file);
            sentFiles.push(file);
          });
          const existingFileFieldName = `existing_file_ids_${resolvedChecklistItemId}[]`;
          collectExistingFileIdsForSavePayload(d.uploadedFiles).forEach((fileId) => {
            formData.append(existingFileFieldName, fileId);
          });
        });
      });
      return {
        checklist_type_id: String(block.typeId),
        items,
      };
    });

    formData.append("checklists", JSON.stringify(checklists));
    return { formData, sentFiles };
  }, [currentCallId, checklistBlocks]);

  /** Re-read the call detail after a save so files, ticks and review states come from the server. */
  const reloadChecklistFromCallDetail = useCallback(async () => {
    if (!currentCallId) return;
    if (typeof refetchSharedCallDetail === "function") {
      await refetchSharedCallDetail();
      return;
    }
    const { data } = await callFileService.getCallDetail(currentCallId);
    setRefreshedRows(extractCallDetailChecklistRows(data?.data));
  }, [currentCallId, refetchSharedCallDetail]);

  // Opening the Check List sub-tab always re-reads GET call_file/get_call_detail/{callId}, so the
  // checklist renders from fresh server data rather than the copy loaded when the card opened.
  // (callFileService shares an identical in-flight request, so this never doubles up.)
  const [openFetchLoading, setOpenFetchLoading] = useState(false);
  const reloadOnOpenRef = useRef(reloadChecklistFromCallDetail);
  reloadOnOpenRef.current = reloadChecklistFromCallDetail;
  useEffect(() => {
    if (!currentCallId) return undefined;
    let cancelled = false;
    setOpenFetchLoading(true);
    reloadOnOpenRef
      .current()
      .catch(() => {
        /* the existing call detail (if any) stays on screen */
      })
      .finally(() => {
        if (!cancelled) setOpenFetchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentCallId]);

  // Saves the latest checklist state. Saves never overlap: a change made while one is in
  // flight is queued and sent right after it. Nothing is sent when nothing changed since
  // the last save (e.g. blurring an untouched remarks field).
  const runAutoSave = useCallback(async () => {
    if (!currentCallId) {
      notify("Call ID is missing. Please save general details first.", "error");
      return;
    }
    if (!checklistBlocks.length) return;
    if (savingRef.current) {
      queuedSaveRef.current = true;
      return;
    }

    savingRef.current = true;
    let lastSent = null;
    try {
      do {
        queuedSaveRef.current = false;
        const snapshot = latestSnapshotRef.current;
        if (snapshot !== baselineSnapshotRef.current) {
          const data = latestItemsDataRef.current;
          setSaveStatus("saving");
          const { formData, sentFiles } = buildChecklistSaveFormData(data);
          await checklistService.saveCallChecklist(formData);
          sentFiles.forEach((file) => uploadedLocalFilesRef.current.add(file));
          baselineSnapshotRef.current = snapshot;
          lastSent = data;
        }
      } while (queuedSaveRef.current);
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Failed to save checklist.";
      notify(typeof msg === "string" ? msg : "Failed to save checklist.", "error");
      setSaveStatus("error");
      return;
    } finally {
      savingRef.current = false;
    }
    if (!lastSent) return;

    setSaveStatus("saved");
    // Edits made after the last save (e.g. remarks still being typed) survive the refresh.
    mergeBaseRef.current = lastSent;
    if (latestItemsDataRef.current === lastSent) {
      userEditedRef.current = false;
      onDirtyChange?.(false);
    }
    try {
      await reloadChecklistFromCallDetail();
    } catch {
      /* save succeeded; refresh is best-effort */
    }
  }, [buildChecklistSaveFormData, checklistBlocks, currentCallId, onDirtyChange, reloadChecklistFromCallDetail]);

  useEffect(() => {
    if (!saveRequestedRef.current) return;
    saveRequestedRef.current = false;
    runAutoSave();
  }, [itemsData, runAutoSave]);

  // Re-upload of a rejected document goes straight to its own endpoint (not the checklist save),
  // then the call detail is re-read so the row shows the new file and review state.
  const handleItemReupload = useCallback(
    async (item, file) => {
      if (!currentCallId) {
        notify("Call ID is missing. Please save general details first.", "error");
        return false;
      }
      const checklistItemId =
        getChecklistItemIdFromUiItem(item) || item?.checklist_item_id || item?.id;
      const formData = new FormData();
      formData.append("call_id", String(currentCallId));
      formData.append("checklist_item_id", String(checklistItemId));
      formData.append("file", file);
      try {
        const res = await checklistService.reuploadChecklistFile(formData);
        notify(res?.data?.message || "Document re-uploaded.", "success");
      } catch (error) {
        const msg =
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          "Failed to re-upload document.";
        notify(typeof msg === "string" ? msg : "Failed to re-upload document.", "error");
        return false;
      }
      try {
        await reloadChecklistFromCallDetail();
      } catch {
        /* upload succeeded; refresh is best-effort */
      }
      return true;
    },
    [currentCallId, reloadChecklistFromCallDetail]
  );

  // Items a task card rejected (or asked to re-upload) that still have no replacement file.
  const rejectedSummary = useMemo(() => {
    const list = [];
    checklistBlocks.forEach((block) => {
      flattenTreeItems(block.tree).forEach((item) => {
        const d = itemsData[item.id];
        if (!isChecklistReviewRejected(d?.review?.status)) return;
        const hasReplacement = collectLocalFilesForSavePayload(d.uploadedFiles).length > 0;
        list.push({ id: item.id, title: item.title, hasReplacement });
      });
    });
    return {
      pending: list.filter((r) => !r.hasReplacement),
      replaced: list.filter((r) => r.hasReplacement),
    };
  }, [checklistBlocks, itemsData]);

  const scrollToChecklistItem = useCallback((itemId) => {
    const row = document.querySelector(`[data-cl-item-id="${CSS.escape(itemId)}"]`);
    if (!row) return;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    row.classList.remove("cl-item-row--flash");
    // Restart the flash animation so repeated clicks still draw the eye.
    void row.offsetWidth;
    row.classList.add("cl-item-row--flash");
  }, []);

  // Only the first load shows the spinner; a background refresh keeps the current checklist.
  // Opening the sub-tab also shows it until the fresh get_call_detail response arrives.
  const isLoading =
    openFetchLoading || (!callDetail && !refreshedRows && (callDetailLoading || callDetailLoad));
  const hasChecklistData = checklistBlocks.some((b) => (b.tree || []).length > 0);
  const showCallDetailError = !isLoading && !hasCardDetailProp && Boolean(callDetailError) && !callDetail;
  // Any empty / error state: the card stretches to fill the panel so its content sits centred.
  const isEmptyView = !isLoading && (showCallDetailError || !hasChecklistData);

  return (
    <>
      <div className="operation-content-header checklist-page-header">
        <h3 className="operation-content-title">Checklist Information</h3>
        {!isViewOnly && saveStatus !== "idle" ? (
          <span
            className={`checklist-autosave-status checklist-autosave-status--${saveStatus}`}
            role="status"
            aria-live="polite"
          >
            {AUTOSAVE_STATUS_LABEL[saveStatus]}
          </span>
        ) : null}
        {!isLoading && hasChecklistData ? (
          <ChecklistRejectedBanner
            pending={rejectedSummary.pending}
            replaced={rejectedSummary.replaced}
            onJump={scrollToChecklistItem}
          />
        ) : null}
      </div>

      <div
        className={`checklist-tab-layout checklist-tab-layout--full checklist-tab-layout--pinned-actions${isEmptyView ? " checklist-tab-layout--empty" : ""}`}
      >
        <div className={`checklist-form checklist-form--compact${isEmptyView ? " checklist-form--empty" : ""}`}>
          {isLoading ? <ChecklistLoadingState /> : null}
          {showCallDetailError ? (
            <ChecklistEmptyState title="Call detail error" message={callDetailError} variant="error" />
          ) : null}
          {!isLoading && !showCallDetailError && checklistBlocks.length === 0 ? (
            <ChecklistEmptyState
              title="No checklist selected"
              message="Select one or more checklist types in Appointment Details to see their items here."
              variant="noData"
            />
          ) : null}
          {!isLoading && !showCallDetailError && checklistBlocks.length > 0 && !hasChecklistData ? (
            <ChecklistEmptyState
              title="No checklist items"
              message="The selected checklist types don't have any items configured yet."
              variant="noData"
            />
          ) : null}

          {!isLoading &&
            hasChecklistData &&
            checklistBlocks.map((block) => (
              <div className="checklist-type-group cl-excel-type-group" key={block.typeId}>
                <ChecklistTypeBlock
                  typeTitle={block.typeName}
                  typeId={block.typeId}
                  callId={currentCallId}
                  sectionTree={block.tree}
                  itemsData={itemsData}
                  onItemChange={handleItemChange}
                  onItemReupload={handleItemReupload}
                  openSections={openSections}
                  onSectionToggle={handleSectionToggle}
                  onSelectAll={handleSelectAll}
                  isViewOnly={isViewOnly}
                  isDAModule={isDAModule}
                />
              </div>
            ))}
        </div>
      </div>
    </>
  );
}

Checklist.propTypes = {
  card: PropTypes.object,
  formValues: PropTypes.object,
  handleChange: PropTypes.func,
  onOpenReportPreview: PropTypes.func,
  cardColor: PropTypes.string,
  isViewOnly: PropTypes.bool,
  isDAModule: PropTypes.bool,
  cardDetail: PropTypes.object,
  callDetailLoading: PropTypes.bool,
  onDirtyChange: PropTypes.func,
};

export default Checklist;
