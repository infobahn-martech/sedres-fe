import PropTypes from "prop-types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SendReportButton } from "../../services/sendReportFullWidthView";
import callFileService from "../../../../../../services/callFileService";
import checklistService from "../../../../../../services/checklistService";
import { notify } from "../../../../../../components/Toaster";
import "../../../../../../design/scss/checklist.scss";
import ChecklistMultiSelect from "./checklistTab/ChecklistMultiSelect";
import ChecklistTypeBlock from "./checklistTab/ChecklistTypeBlock";
import ChecklistFooterActions from "./checklistTab/ChecklistFooterActions";
import ChecklistLoadingState from "./checklistTab/ChecklistLoadingState";
import ChecklistEmptyState from "./checklistTab/ChecklistEmptyState";
import { parseChecklistTypeListResponse } from "./checklistTab/checklistApi";
import { buildChecklistDataContext } from "./checklistTab/checklistContext";
import { getPrerequisiteStateFromContext } from "./checklistTab/checklistPrerequisites";
import {
  buildChecklistReportLines,
  collectItemIdsUnderSectionInBlocks,
  collectTreeSectionIds,
  extractCallChecklistRows,
  filterFilesExcludingRemovedBackend,
  flattenTreeItems,
  mapApiSectionsToTree,
  mapGetChecklistByIdResponse,
  mergeChecklistTypeOptions,
  mergeSavedChecklistsIntoTypeOptions,
  normalizeSavedChecklistLookup,
} from "./checklistTab/checklistMappers";

const toIdString = (v) => (v == null || String(v).trim() === "" ? null : String(v).trim());

const normalizeExpiryDateForUi = (value) => {
  const s = String(value ?? "").trim();
  if (!s || s === "0000-00-00" || s.startsWith("0000-00-00")) return "";
  return s;
};

const normalizeBackendFile = (file, fallbackKey) => {
  const fileName = file?.file_name ?? file?.name ?? file?.filename ?? "File";
  const fileUrl =
    file?.file_url ??
    file?.sample_file_url ??
    file?.requirement_file_url ??
    file?.url ??
    file?.link ??
    null;

  return {
    id: file?.file_id ?? file?.id ?? `api_${fallbackKey}`,
    file_id: file?.file_id ?? file?.id ?? null,
    name: fileName,
    fileName,
    size: file?.size ?? null,
    url: fileUrl,
    link: fileUrl,
    file_url: file?.file_url ?? fileUrl,
    sample_file_url: file?.sample_file_url ?? null,
    requirement_file_url: file?.requirement_file_url ?? null,
    fromApi: true,
    isNew: false,
    file: undefined,
  };
};

const createLocalChecklistFileEntry = (file, uniqueKey) => ({
  id: `local_${uniqueKey}_${file.name}`,
  name: file.name,
  fileName: file.name,
  url: null,
  link: null,
  file_url: null,
  file,
  fromApi: false,
  isNew: true,
});

/** Normalize mixed legacy rows (File instances or partial objects) into unified file entries. */
const normalizeUploadedFilesStateEntries = (entries, itemKeyPrefix) => {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry, idx) => {
      if (entry instanceof File) return createLocalChecklistFileEntry(entry, `${itemKeyPrefix}_${idx}`);
      if (!entry || typeof entry !== "object") return null;
      const file = entry.file instanceof File ? entry.file : null;
      const fromApi = entry.fromApi === true && !file;
      const name = entry.name || entry.fileName || file?.name || "File";
      return {
        ...entry,
        id: entry.id ?? `file_${itemKeyPrefix}_${idx}`,
        name,
        fileName: entry.fileName || name,
        url: entry.url ?? entry.link ?? entry.file_url ?? null,
        file: file || undefined,
        fromApi: file ? false : fromApi,
        isNew: Boolean(file),
      };
    })
    .filter(Boolean);
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

/** Drop local File rows that already appear on the server list (e.g. after save + refetch). */
const filterLocalsNotReflectedOnBackend = (localEntries, backendEntries) => {
  const backends = Array.isArray(backendEntries) ? backendEntries : [];
  return (Array.isArray(localEntries) ? localEntries : []).filter((entry) => {
    const pf = entry?.file instanceof File ? entry.file : null;
    if (!pf) return false;
    const normalizedPendingName = normalizeChecklistFilename(pf.name);
    const nameMatch = (b) => {
      const normalizedBackendName = getNormalizedChecklistFileName(b);
      return normalizedBackendName && normalizedBackendName === normalizedPendingName;
    };
    const duplicate = backends.some((b) => {
      if (b?.file instanceof File) return false;
      if (!nameMatch(b)) return false;
      const bs = b?.size != null ? Number(b.size) : null;
      const ps = pf.size != null ? Number(pf.size) : null;
      if (
        bs != null &&
        ps != null &&
        !Number.isNaN(bs) &&
        !Number.isNaN(ps)
      ) {
        return bs === ps;
      }
      return true;
    });
    return !duplicate;
  });
};

const fetchCallDetail = async (callId) => {
  if (!callId) return null;
  const { data } = await callFileService.getCallDetail(callId);
  return data?.data ?? data ?? null;
};

const fetchChecklistTypes = async ({ vessel_type_id, barge_type_id, calltype, port_id }) => {
  const isNoChecklistError = (error) => {
    const status = error?.response?.status;
    const message = String(
      error?.response?.data?.message
      ?? error?.response?.data?.error
      ?? error?.message
      ?? ""
    ).toLowerCase();
    return status === 404 || message.includes("no checklist found");
  };

  const parseSourceResult = (result) => {
    if (result.status === "fulfilled") {
      return {
        rows: parseChecklistTypeListResponse(result.value),
        failed: false,
        errorMessage: "",
      };
    }
    if (isNoChecklistError(result.reason)) {
      return { rows: [], failed: false, errorMessage: "" };
    }
    return {
      rows: [],
      failed: true,
      errorMessage: result.reason?.message || "Failed to load checklist types.",
    };
  };

  const vesselCall = vessel_type_id
    ? checklistService.getChecklistsByVesselType({ vessel_type_id, calltype, port_id })
    : Promise.resolve(null);
  const bargeCall = barge_type_id
    ? checklistService.getChecklistsByBargeType({ barge_type_id, calltype, port_id })
    : Promise.resolve(null);
  const portCall = calltype && port_id
    ? checklistService.getChecklistsByPortCall({ calltype, port_id })
    : Promise.resolve(null);

  const [vesselRes, bargeRes, portRes] = await Promise.allSettled([vesselCall, bargeCall, portCall]);
  const vesselParsed = parseSourceResult(vesselRes);
  const bargeParsed = parseSourceResult(bargeRes);
  const portParsed = parseSourceResult(portRes);
  const hasUsableData =
    vesselParsed.rows.length > 0 || bargeParsed.rows.length > 0 || portParsed.rows.length > 0;
  const hasFailures = vesselParsed.failed || bargeParsed.failed || portParsed.failed;

  return {
    vesselRows: vesselParsed.rows,
    bargeRows: bargeParsed.rows,
    portRows: portParsed.rows,
    hasUsableData,
    hasFailures,
    errorMessage: [vesselParsed.errorMessage, bargeParsed.errorMessage, portParsed.errorMessage]
      .filter(Boolean)
      .join(" | "),
  };
};

const fetchChecklistById = async (checklistTypeId) => {
  const { data } = await checklistService.getChecklistById(checklistTypeId);
  return data;
};

const fetchSavedCallChecklist = async (callId) => {
  if (!callId) return [];
  const { data } = await checklistService.getCallChecklist(callId);
  return extractCallChecklistRows(data);
};

const normalizeChecklistTypeOptions = (rowsBySource) =>
  mergeChecklistTypeOptions([rowsBySource.vesselRows, rowsBySource.bargeRows, rowsBySource.portRows]);

const normalizeChecklistDetailResponse = (checklistTypeId, payload) => {
  const { checklistDetails, sections } = mapGetChecklistByIdResponse(payload);
  const typeId = toIdString(checklistTypeId);
  const typeName = checklistDetails?.checklist_name || `Checklist ${typeId}`;
  const tree = mapApiSectionsToTree(sections, typeId, typeName);
  return { typeId, typeName, tree, checklistDetails };
};

const getChecklistItemIdFromUiItem = (item) => {
  const raw = String(item?.id ?? "");
  const marker = "_item_";
  const idx = raw.lastIndexOf(marker);
  if (idx < 0) return null;
  const extracted = raw.slice(idx + marker.length).trim();
  return extracted || null;
};

function Checklist({
  card,
  formValues,
  handleChange,
  onOpenReportPreview,
  cardColor: propCardColor,
  isViewOnly = false,
  isDAModule = false,
  cardDetail,
  callDetailLoading = false,
}) {
  const cardColor = propCardColor || card?.color || "#2A00FF";
  const currentCallId = useMemo(
    () => card?.call_id ?? formValues?.call_id ?? card?.callId ?? "",
    [card?.call_id, card?.callId, formValues?.call_id]
  );

  const [localCallDetail, setLocalCallDetail] = useState(null);
  const [callDetailLoad, setCallDetailLoad] = useState(false);
  const [callDetailError, setCallDetailError] = useState("");
  const [checklistTypeOptions, setChecklistTypeOptions] = useState([]);
  const [selectedChecklistTypeIds, setSelectedChecklistTypeIds] = useState([]);
  const [checklistBlocks, setChecklistBlocks] = useState([]);
  const [savedChecklistLookup, setSavedChecklistLookup] = useState({});
  const [savedChecklistTypeIds, setSavedChecklistTypeIds] = useState([]);
  const [itemsData, setItemsData] = useState({});
  const [openSections, setOpenSections] = useState({});
  const [openTypeGroups, setOpenTypeGroups] = useState({});
  const [typeLoading, setTypeLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savedLoading, setSavedLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [checklistError, setChecklistError] = useState("");
  const userChangedSelectionRef = useRef(false);

  useEffect(() => {
    if (cardDetail && typeof cardDetail === "object") {
      setLocalCallDetail(cardDetail);
      return;
    }
    if (!currentCallId) {
      setLocalCallDetail(null);
      return;
    }
    let cancelled = false;
    const loadCallDetail = async () => {
      setCallDetailLoad(true);
      setCallDetailError("");
      try {
        const detail = await fetchCallDetail(currentCallId);
        if (!cancelled) setLocalCallDetail(detail);
      } catch (error) {
        if (!cancelled) {
          setLocalCallDetail(null);
          setCallDetailError(error?.message || "Failed to load call detail.");
        }
      } finally {
        if (!cancelled) setCallDetailLoad(false);
      }
    };
    loadCallDetail();
    return () => {
      cancelled = true;
    };
  }, [cardDetail, currentCallId]);

  const effectiveCallDetailLoading = callDetailLoading || callDetailLoad;

  const dataContext = useMemo(
    () =>
      buildChecklistDataContext({
        card,
        cardDetail: cardDetail ?? localCallDetail,
        formValues,
        callDetailLoading: effectiveCallDetailLoading,
      }),
    [card, cardDetail, localCallDetail, formValues, effectiveCallDetailLoading]
  );

  const prerequisiteState = useMemo(() => getPrerequisiteStateFromContext(dataContext), [dataContext]);

  useEffect(() => {
    let cancelled = false;
    const loadSavedChecklist = async () => {
      if (!currentCallId) {
        setSavedChecklistLookup({});
        setSavedChecklistTypeIds([]);
        return;
      }
      setSavedLoading(true);
      try {
        const rows = await fetchSavedCallChecklist(currentCallId);
        if (cancelled) return;
        const normalized = normalizeSavedChecklistLookup(rows);
        setSavedChecklistLookup(normalized.lookup);
        setSavedChecklistTypeIds(normalized.typeIds);
        setChecklistTypeOptions((prev) => mergeSavedChecklistsIntoTypeOptions(prev, rows));
      } catch {
        if (!cancelled) {
          setSavedChecklistLookup({});
          setSavedChecklistTypeIds([]);
        }
      } finally {
        if (!cancelled) setSavedLoading(false);
      }
    };
    loadSavedChecklist();
    return () => {
      cancelled = true;
    };
  }, [currentCallId]);

  useEffect(() => {
    let cancelled = false;
    const loadChecklistTypes = async () => {
      if (!prerequisiteState.canLoadChecklists) {
        setChecklistTypeOptions([]);
        setSelectedChecklistTypeIds([]);
        setChecklistBlocks([]);
        setItemsData({});
        setOpenSections({});
        setOpenTypeGroups({});
        return;
      }
      setTypeLoading(true);
      setChecklistError("");
      try {
        const rowsBySource = await fetchChecklistTypes({
          vessel_type_id: dataContext.vesselTypeIdForApi,
          barge_type_id: dataContext.bargeTypeIdForApi,
          calltype: dataContext.calltypePayload,
          port_id: dataContext.portIdForApi,
        });
        if (cancelled) return;
        const options = normalizeChecklistTypeOptions(rowsBySource);
        setChecklistTypeOptions(options);
        setSelectedChecklistTypeIds((prev) => {
          const optionIds = options.map((o) => String(o.value));
          const optionIdSet = new Set(optionIds);
          if (userChangedSelectionRef.current) {
            return prev.filter((id) => optionIdSet.has(String(id))).map(String);
          }
          if (savedChecklistTypeIds.length > 0) {
            const fromSaved = savedChecklistTypeIds
              .filter((id) => optionIdSet.has(String(id)))
              .map(String);
            if (fromSaved.length) return fromSaved;
          }
          return optionIds;
        });
        if (!cancelled) {
          if (!rowsBySource.hasUsableData && rowsBySource.hasFailures) {
            setChecklistError(rowsBySource.errorMessage || "Failed to load checklist types.");
          } else {
            setChecklistError("");
          }
        }
      } catch (error) {
        if (!cancelled) {
          setChecklistTypeOptions([]);
          setSelectedChecklistTypeIds([]);
          setChecklistError(error?.message || "Failed to load checklist types.");
        }
      } finally {
        if (!cancelled) setTypeLoading(false);
      }
    };
    loadChecklistTypes();
    return () => {
      cancelled = true;
    };
  }, [dataContext, prerequisiteState.canLoadChecklists, savedChecklistTypeIds]);

  useEffect(() => {
    if (userChangedSelectionRef.current) return;
    if (!savedChecklistTypeIds.length || !checklistTypeOptions.length) return;
    const optionIdSet = new Set(checklistTypeOptions.map((o) => String(o.value)));
    const fromSaved = savedChecklistTypeIds
      .filter((id) => optionIdSet.has(String(id)))
      .map(String);
    if (!fromSaved.length) return;
    setSelectedChecklistTypeIds((prev) => {
      const prevKey = [...prev].map(String).sort().join(",");
      const nextKey = [...fromSaved].sort().join(",");
      return prevKey === nextKey ? prev : fromSaved;
    });
  }, [savedChecklistTypeIds, checklistTypeOptions]);

  useEffect(() => {
    let cancelled = false;
    const loadChecklistDetails = async () => {
      if (selectedChecklistTypeIds.length === 0) {
        setChecklistBlocks([]);
        setItemsData({});
        setOpenSections({});
        setOpenTypeGroups({});
        return;
      }
      setDetailLoading(true);
      setChecklistError("");
      try {
        const responses = await Promise.all(selectedChecklistTypeIds.map((id) => fetchChecklistById(id)));
        if (cancelled) return;
        const blocks = responses.map((payload, index) =>
          normalizeChecklistDetailResponse(selectedChecklistTypeIds[index], payload)
        );
        const allSectionIds = blocks.flatMap((b) => collectTreeSectionIds(b.tree));

        setChecklistBlocks(blocks);
        setOpenSections((prev) =>
          allSectionIds.reduce((acc, sectionId) => ({ ...acc, [sectionId]: prev[sectionId] ?? true }), {})
        );
        setOpenTypeGroups((prev) =>
          blocks.reduce((acc, b) => ({ ...acc, [b.typeId]: prev[b.typeId] ?? true }), {})
        );
        setItemsData((prev) => {
          const next = {};
          blocks.forEach((block) => {
            const blockTypeId = String(block.typeId);
            const blockItems = flattenTreeItems(block.tree);
            blockItems.forEach((item) => {
              const existing = prev[item.id] || {};
              const checklistItemId = getChecklistItemIdFromUiItem(item);
              const savedItem = checklistItemId ? savedChecklistLookup?.[blockTypeId]?.[checklistItemId] : null;
              const apiFiles = (item.uploadedFromApi || []).map((f, idx) =>
                normalizeBackendFile(f, `${item.id}_${idx}`)
              );
              const savedFiles = Array.isArray(savedItem?.apiUploadedFiles) ? savedItem.apiUploadedFiles : [];
              const removedKeys = Array.isArray(existing.removedFiles)
                ? [...new Set(existing.removedFiles.filter(Boolean))]
                : [];
              const baseBackendRaw = savedFiles.length ? savedFiles : apiFiles;
              const baseBackendFiles = filterFilesExcludingRemovedBackend(baseBackendRaw, removedKeys);
              const normalizedLegacy = normalizeUploadedFilesStateEntries(existing.uploadedFiles, item.id);
              const legacySingle =
                existing.uploadedFile instanceof File
                  ? [createLocalChecklistFileEntry(existing.uploadedFile, `${item.id}_legacy`)]
                  : [];
              const pendingLocals = [...legacySingle, ...normalizedLegacy].filter(
                (e) => e?.file instanceof File && e.fromApi !== true
              );
              const hasSavedItemBackendState = Array.isArray(savedItem?.apiUploadedFiles);
              const localsStillPending = hasSavedItemBackendState
                ? []
                : filterLocalsNotReflectedOnBackend(pendingLocals, baseBackendFiles);
              // Keep backend files first so they remain source-of-truth on duplicate names.
              const mergedFiles = dedupeChecklistFilesByNormalizedName([
                ...baseBackendFiles,
                ...localsStillPending,
              ]);

              next[item.id] = {
                checked: savedItem ? savedItem.checked === true : existing.checked === true,
                remarks: savedItem ? savedItem.remarks ?? "" : existing.remarks ?? "",
                expiryDate: savedItem
                  ? normalizeExpiryDateForUi(savedItem.expiryDate ?? "")
                  : normalizeExpiryDateForUi(existing.expiryDate ?? ""),
                apiUploadedFiles: mergedFiles,
                uploadedFiles: mergedFiles,
                // Session-only: hides backend files user removed; clearing requires backend delete API + refetch.
                removedFiles: removedKeys,
                requirement: item.requirement ?? null,
                description: item.description ?? "",
              };
            });
          });
          return next;
        });
      } catch (error) {
        if (!cancelled) {
          setChecklistBlocks([]);
          setItemsData({});
          setChecklistError(error?.message || "Failed to load checklist details.");
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    };
    loadChecklistDetails();
    return () => {
      cancelled = true;
    };
  }, [savedChecklistLookup, selectedChecklistTypeIds]);

  const handleChecklistTypeChange = (event) => {
    const next = Array.isArray(event?.target?.value) ? event.target.value.map(String) : [];
    userChangedSelectionRef.current = true;
    setSelectedChecklistTypeIds(next);
    if (handleChange) {
      handleChange("checklistType")({
        target: { name: "checklistType", value: next },
      });
    }
  };

  const handleItemChange = (id, nextData) => {
    setItemsData((prev) => ({ ...prev, [id]: { ...prev[id], ...nextData } }));
  };

  const handleSectionToggle = (sectionId) => {
    setOpenSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const handleSelectAll = (sectionId, checked) => {
    const itemIds = collectItemIdsUnderSectionInBlocks(checklistBlocks, sectionId);
    setItemsData((prev) => {
      const next = { ...prev };
      itemIds.forEach((itemId) => {
        next[itemId] = { ...(next[itemId] || {}), checked };
      });
      return next;
    });
  };

  const handleTypeGroupToggle = (typeId) => {
    setOpenTypeGroups((prev) => ({ ...prev, [typeId]: !prev[typeId] }));
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
          items.push({
            checklist_item_id: resolvedChecklistItemId,
            is_checked: d.checked === true ? 1 : 0,
            remarks: d.remarks || "",
            expiry_date: d.expiryDate || "",
          });
          // Only new local File blobs — never re-post backend file metadata.
          // TODO: Backend delete API needed to persist removals from `removedFiles`; session hide does not change GET.
          const fileFieldName = `files_${resolvedChecklistItemId}[]`;
          collectLocalFilesForSavePayload(d.uploadedFiles).forEach((file) => {
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
      try {
        const rows = await fetchSavedCallChecklist(currentCallId);
        const normalized = normalizeSavedChecklistLookup(rows);
        setSavedChecklistLookup(normalized.lookup);
        setSavedChecklistTypeIds(normalized.typeIds);
        setChecklistTypeOptions((prev) => mergeSavedChecklistsIntoTypeOptions(prev, rows));
        if (!userChangedSelectionRef.current && normalized.typeIds.length > 0) {
          const optionIdSet = new Set(checklistTypeOptions.map((o) => String(o.value)));
          const fromSaved = normalized.typeIds
            .filter((id) => optionIdSet.has(String(id)))
            .map(String);
          if (fromSaved.length) setSelectedChecklistTypeIds(fromSaved);
        }
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
  }, [buildChecklistSaveFormData, checklistBlocks, checklistTypeOptions, currentCallId]);

  const handleOpenChecklistReport = useCallback(() => {
    if (!onOpenReportPreview) return;
    const lines = ["Checklist report", ""];
    lines.push(...buildChecklistReportLines(checklistBlocks.map((b) => ({ typeName: b.typeName, tree: b.tree })), itemsData));
    onOpenReportPreview({
      tabName: "Check List",
      formSectionLabel: "image.png",
      getBody: () => lines.join("\n"),
      getAttachments: () => [],
    });
  }, [onOpenReportPreview, checklistBlocks, itemsData]);

  const isLoading = effectiveCallDetailLoading || typeLoading || detailLoading || savedLoading;
  const hasChecklistData = checklistBlocks.some((b) => (b.tree || []).length > 0);

  return (
    <>
      <div className="operation-content-header checklist-page-header">
        <h3 className="operation-content-title">Checklist Information</h3>
        <div className="checklist-header-right">
          <ChecklistMultiSelect
            className="checklist-header-type-select"
            value={selectedChecklistTypeIds}
            onChange={handleChecklistTypeChange}
            options={checklistTypeOptions}
            placeholder={checklistTypeOptions.length ? "Select checklist type..." : "No checklist types available"}
            cardColor={cardColor}
            disabled={isViewOnly || typeLoading || !prerequisiteState.canLoadChecklists}
          />
          {onOpenReportPreview && !isViewOnly ? (
            <SendReportButton onClick={handleOpenChecklistReport} cardColor={cardColor} tabName="Check List" />
          ) : null}
        </div>
      </div>

      <div className="checklist-tab-layout checklist-tab-layout--full">
        <div className="checklist-form checklist-form--compact">
          {isLoading ? <ChecklistLoadingState /> : null}
          {!isLoading && callDetailError ? (
            <ChecklistEmptyState title="Call detail error" message={callDetailError} variant="error" />
          ) : null}
          {!isLoading && !callDetailError && !prerequisiteState.canLoadChecklists ? (
            <ChecklistEmptyState
              title="Checklist prerequisites"
              message="Checklist types will load after call type, port, and vessel/barge are available."
              variant="prerequisite"
            />
          ) : null}
          {!isLoading && prerequisiteState.canLoadChecklists && checklistError ? (
            <ChecklistEmptyState title="Checklist loading failed" message={checklistError} variant="error" />
          ) : null}
          {!isLoading &&
            prerequisiteState.canLoadChecklists &&
            !checklistError &&
            selectedChecklistTypeIds.length === 0 ? (
            <ChecklistEmptyState
              title="No checklist selected"
              message="Select checklist type(s) to render checklist items."
              variant="noData"
            />
          ) : null}
          {!isLoading &&
            prerequisiteState.canLoadChecklists &&
            !checklistError &&
            selectedChecklistTypeIds.length > 0 &&
            !hasChecklistData ? (
            <ChecklistEmptyState
              title="No checklist details returned"
              message="Selected checklist type(s) returned empty detail."
              variant="noData"
            />
          ) : null}

          {!isLoading &&
            !checklistError &&
            hasChecklistData &&
            checklistBlocks.map((block) => (
              <div className="checklist-type-group cl-excel-type-group" key={block.typeId} style={{ "--card-color": cardColor }}>
                <ChecklistTypeBlock
                  typeTitle={block.typeName}
                  sectionTree={block.tree}
                  itemsData={itemsData}
                  onItemChange={handleItemChange}
                  openSections={openSections}
                  onSectionToggle={handleSectionToggle}
                  onSelectAll={handleSelectAll}
                  cardColor={cardColor}
                  isViewOnly={isViewOnly}
                  isDAModule={isDAModule}
                />
              </div>
            ))}

          {!isViewOnly ? (
            <div className="checklist-actions">
              <ChecklistFooterActions
                cardColor={cardColor}
                disabled={isLoading || saveLoading || selectedChecklistTypeIds.length === 0}
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
};

export default Checklist;
