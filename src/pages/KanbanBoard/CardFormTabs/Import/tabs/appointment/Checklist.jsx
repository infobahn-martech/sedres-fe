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
import ChecklistFooterActions from "./checklistTab/ChecklistFooterActions";
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

const normalizeExpiryDateForUi = (value) => {
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
        checked: savedItem?.checked === true,
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
  const [saveLoading, setSaveLoading] = useState(false);

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
  useEffect(() => {
    if (userEditedRef.current) return;
    setItemsData(buildItemsDataFromCallChecklist(checklistBlocks, savedChecklistLookup));
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

  const handleItemChange = (id, nextData) => {
    userEditedRef.current = true;
    setItemsData((prev) => ({ ...prev, [id]: { ...prev[id], ...nextData } }));
  };

  const handleSectionToggle = (sectionId) => {
    setOpenSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const handleSelectAll = (sectionId, checked) => {
    userEditedRef.current = true;
    const itemIds = collectItemIdsUnderSectionInBlocks(checklistBlocks, sectionId);
    setItemsData((prev) => {
      const next = { ...prev };
      itemIds.forEach((itemId) => {
        next[itemId] = { ...(next[itemId] || {}), checked };
      });
      return next;
    });
  };

  const buildChecklistSaveFormData = useCallback(() => {
    const formData = new FormData();
    formData.append("call_id", String(currentCallId));

    const checklists = checklistBlocks.map((block) => {
      const items = [];
      block.tree.forEach((section) => {
        const sectionItems = flattenTreeItems([section]);
        sectionItems.forEach((item) => {
          const d = itemsData[item.id] || {};
          const checklistItemId = getChecklistItemIdFromUiItem(item);
          const resolvedChecklistItemId = checklistItemId || item.checklist_item_id || item.id;
          const newLocalFiles = collectLocalFilesForSavePayload(d.uploadedFiles);
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
    return formData;
  }, [currentCallId, checklistBlocks, itemsData]);

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

  const handleSaveConfirm = useCallback(async () => {
    if (!currentCallId) {
      notify("Call ID is missing. Please save general details first.", "error");
      return;
    }
    if (!checklistBlocks.length) {
      notify("No checklist data available to save.", "error");
      return;
    }

    setSaveLoading(true);
    try {
      await checklistService.saveCallChecklist(buildChecklistSaveFormData());
      notify("Checklist saved successfully.", "success");
      userEditedRef.current = false;
      baselineSnapshotRef.current = latestSnapshotRef.current;
      onDirtyChange?.(false);
      try {
        await reloadChecklistFromCallDetail();
      } catch {
        /* save succeeded; refresh is best-effort */
      }
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Failed to save checklist.";
      notify(typeof msg === "string" ? msg : "Failed to save checklist.", "error");
    } finally {
      setSaveLoading(false);
    }
  }, [buildChecklistSaveFormData, checklistBlocks, currentCallId, onDirtyChange, reloadChecklistFromCallDetail]);

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
  const isLoading = !callDetail && !refreshedRows && (callDetailLoading || callDetailLoad);
  const hasChecklistData = checklistBlocks.some((b) => (b.tree || []).length > 0);
  const showCallDetailError = !isLoading && !hasCardDetailProp && Boolean(callDetailError) && !callDetail;
  // Any empty / error state: the card stretches to fill the panel so its content sits centred.
  const isEmptyView = !isLoading && (showCallDetailError || !hasChecklistData);

  return (
    <>
      <div className="operation-content-header checklist-page-header">
        <h3 className="operation-content-title">Checklist Information</h3>
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

          {!isLoading && hasChecklistData ? (
            <ChecklistRejectedBanner
              pending={rejectedSummary.pending}
              replaced={rejectedSummary.replaced}
              onJump={scrollToChecklistItem}
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
                  openSections={openSections}
                  onSectionToggle={handleSectionToggle}
                  onSelectAll={handleSelectAll}
                  isViewOnly={isViewOnly}
                  isDAModule={isDAModule}
                />
              </div>
            ))}

          {!isViewOnly && !isLoading && hasChecklistData ? (
            <div className="checklist-actions">
              <ChecklistFooterActions
                disabled={saveLoading}
                loading={saveLoading}
                onSaveConfirm={handleSaveConfirm}
              />
            </div>
          ) : null}
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
