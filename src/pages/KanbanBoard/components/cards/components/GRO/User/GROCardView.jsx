import { useState, useCallback, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { notify } from "../../../../../../../components/Toaster";
import SearchableSelect, { deriveSearchPlaceholder } from "../../../../../../../components/form/SearchableSelect";
import userService from "../../../../../../../services/userService";
import {
  isGROSupervisorRole,
  isMWPSupervisorRole,
  isCustomClearanceSupervisorRole,
} from "../../../../../../../shared/helpers/groUserRoles";
import {
  PRE_ARRIVAL_GRO_ROLE_ID,
  PRE_ARRIVAL_CUSTOM_CLEARANCE_ROLE_ID,
  PRE_ARRIVAL_MWP_USER_ROLE_ID,
} from "../../../../../CardFormTabs/Import/tabs/operation/operationConstants";
import groService from "../../../../../../../services/groService";
import useGROReducer from "../../../../../../../store/GROReducer";
import GroSummaryCard, { GroSummaryFieldCard } from "./GroSummaryCard";
import InwardClearanceView, { DocumentActionConfirmModal, InwardClearanceToolbar } from "./InwardClearanceView";
import PassRequestsView from "./PassRequestsView";
import GroPassUploadPopoverForm from "./GroPassUploadPopoverForm";
import GroPopoverStageExtraFields from "./GroPopoverStageExtraFields";
import CrewImmigrationPanel from "./CrewImmigrationPanel";
import {
  createEmptyExtraStageFields,
  validateGroExtraStageFields,
  buildGroArrivalSaveFormData,
  groStageHasExtraFields,
  GRO_CREW_IMMIGRATION_STATUS,
  GRO_CUSTOM_INSPECTION_STATUS,
} from "./groStageExtraFields";
import {
  GRO_ACTIVE_TABS,
  GRO_MAIN_VIEWS,
  GRO_STATIC_CREW_IMMIGRATION_ROWS,
  enrichGroDocWithRowKey,
  normalizeGroApiDocuments,
  parseDocumentsByTaskPayload,
  buildSelectedTaskFromCard,
  resolveTaskDocumentsTitle,
  groApiErrorMessage,
  resolveGroCallId,
  resolveGroCardId,
  resolveGroTaskId,
  resolveGroPortId,
  resolveGroStageIdFromTaskName,
  resolveGroTimeObjectValueKey,
  parseGroStageTimeObjectsResponse,
  validateGroRequiredTimeObjects,
  parseGroPassRequestsResponse,
  firstNonEmptyGroDisplay,
  parseGroUsersByRoleResponse,
  resolveGroRequestedOperatorDisplay,
  resolveGroAssignedUserIdFromDetail,
  resolveGroAssignedUserDisplayName,
  getGroDocumentVerifyStatus,
  flattenGroPassRows,
  buildGroPassIssueDateString,
  computeGroPassUploadPopoverPosition,
  getGroCrewPassId,
  getGroWorkOrderId,
  groPassCrewRowId,
} from "./groCardUtils";

const EMPTY_WORK_ORDERS = [];
const CREW_IMMIGRATION_ROWS_PER_PAGE = 5;

const GROCardView = forwardRef(function GROCardView(
  { card, mode = "gro", userRoleId = null, selectedTask: selectedTaskProp = null },
  ref
) {
  const isCustomClearance = mode === "custom";
  const hidePassTabs = mode === "gro" || isCustomClearance;
  const isGroSupervisorViewer =
    isGROSupervisorRole(userRoleId) || isGROSupervisorRole(Number(userRoleId));
  const isMwpSupervisorViewer =
    isMWPSupervisorRole(userRoleId) || isMWPSupervisorRole(Number(userRoleId));
  const isCustomClearanceSupervisorViewer =
    isCustomClearanceSupervisorRole(userRoleId) ||
    isCustomClearanceSupervisorRole(Number(userRoleId));
  const showAssignedUserSelect =
    (mode === "gro" && (isGroSupervisorViewer || isMwpSupervisorViewer)) ||
    (isCustomClearance && isCustomClearanceSupervisorViewer);
  const assigneeRoleId = isCustomClearance
    ? PRE_ARRIVAL_CUSTOM_CLEARANCE_ROLE_ID
    : isMwpSupervisorViewer
      ? PRE_ARRIVAL_MWP_USER_ROLE_ID
      : PRE_ARRIVAL_GRO_ROLE_ID;

  const { saveArrivalDocument, isSavingArrivalDocument } = useGROReducer();

  const inwardAnchorRef = useRef(null);
  const extraStageFileInputRefs = useRef({});
  const [showInwardClearance, setShowInwardClearance] = useState(false);
  const [timeObjects, setTimeObjects] = useState([]);
  const [timeObjectsLoading, setTimeObjectsLoading] = useState(false);
  const [timeObjectValues, setTimeObjectValues] = useState({});
  const [timeObjectErrors, setTimeObjectErrors] = useState({});
  const [extraStageFields, setExtraStageFields] = useState(() => createEmptyExtraStageFields());
  const [extraStageFieldErrors, setExtraStageFieldErrors] = useState({});
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmRemarks, setConfirmRemarks] = useState("");
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [callDetail, setCallDetail] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [taskDocumentsData, setTaskDocumentsData] = useState(null);
  const [isFirstColumn, setIsFirstColumn] = useState(false);
  const [isGroLoading, setIsGroLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(GRO_ACTIVE_TABS.documents);
  const [groMainView, setGroMainView] = useState(GRO_MAIN_VIEWS.inward);
  const [passRequestsState, setPassRequestsState] = useState({
    callId: null,
    cg: undefined,
    zawil: undefined,
  });
  const [passRequestsLoading, setPassRequestsLoading] = useState(false);
  const [passRequestsError, setPassRequestsError] = useState(null);
  const [passSelectedRowIds, setPassSelectedRowIds] = useState(() => new Set());
  const [showPassBulkPopover, setShowPassBulkPopover] = useState(false);
  const [bulkPassForm, setBulkPassForm] = useState(() => ({
    passNo: "",
    issuePickerParts: { date: "", time: "" },
    file: null,
  }));
  const [bulkPassSubmitting, setBulkPassSubmitting] = useState(false);
  const [bulkPassFormError, setBulkPassFormError] = useState("");
  const [bulkPassPopoverRect, setBulkPassPopoverRect] = useState(null);
  const [assignedUserId, setAssignedUserId] = useState("");
  const [assignedUserError, setAssignedUserError] = useState("");
  const [groUserOptions, setGroUserOptions] = useState([]);
  const [groUsersLoading, setGroUsersLoading] = useState(false);
  const [isAssigningUser, setIsAssigningUser] = useState(false);
  const [crewImmigrationSelectedRowIds, setCrewImmigrationSelectedRowIds] = useState(() => new Set());
  const [crewImmigrationRows, setCrewImmigrationRows] = useState(() => GRO_STATIC_CREW_IMMIGRATION_ROWS);
  const [crewImmigrationPage, setCrewImmigrationPage] = useState(1);
  const [crewUploadAction, setCrewUploadAction] = useState({ variant: null, rowId: null });
  const bulkPassUploadBtnRef = useRef(null);
  const bulkPassPopoverPortalRef = useRef(null);
  const bulkPassFileInputRef = useRef(null);
  const crewImmigrationHeaderCheckboxRef = useRef(null);
  const crewImmigrationCgFileInputRef = useRef(null);
  const crewImmigrationZawilFileInputRef = useRef(null);

  const callId = resolveGroCallId(card);
  const cardId = resolveGroCardId(card);
  const taskId = useMemo(() => resolveGroTaskId(card), [card]);
  const groPortId = useMemo(() => resolveGroPortId(callDetail, card), [callDetail, card]);

  const applyTaskDocuments = useCallback((rawList) => {
    const normalized = normalizeGroApiDocuments(rawList);
    setDocuments(normalized.map((d, i) => enrichGroDocWithRowKey(d, i)));
  }, []);

  const applyDocumentsByTaskResponse = useCallback(
    (res) => {
      const { documents: rawList, isFirstColumn: firstColumn, taskName } = parseDocumentsByTaskPayload(res);
      setIsFirstColumn(firstColumn);
      setTaskDocumentsData(taskName ? { task_name: taskName } : null);
      applyTaskDocuments(rawList);
    },
    [applyTaskDocuments]
  );

  const selectedTask = useMemo(
    () => selectedTaskProp ?? buildSelectedTaskFromCard(card),
    [selectedTaskProp, card]
  );

  const taskPanelTitle = useMemo(
    () =>
      resolveTaskDocumentsTitle(
        taskDocumentsData,
        selectedTask,
        isCustomClearance ? "Bayan" : "Task Documents"
      ),
    [taskDocumentsData, selectedTask, isCustomClearance]
  );

  const inwardPanelLabel = isCustomClearance ? "Bayan" : taskPanelTitle;

  const groStageId = useMemo(
    () => resolveGroStageIdFromTaskName(taskPanelTitle),
    [taskPanelTitle]
  );

  const groCallTypeId = useMemo(() => {
    const raw = callDetail?.call_type_id;
    if (raw == null || String(raw).trim() === "") return null;
    const num = Number(raw);
    return Number.isFinite(num) && num > 0 ? num : null;
  }, [callDetail?.call_type_id]);

  const callTypeSummary = firstNonEmptyGroDisplay(
    callDetail?.call_type,
    callDetail?.call_type_name,
    card?.typeOfCall,
    callDetail?.call_type_id != null && callDetail.call_type_id !== "" ? String(callDetail.call_type_id) : ""
  );
  const billingEntitySummary = firstNonEmptyGroDisplay(callDetail?.billing_entity);
  let portFromDetail = "";
  if (typeof callDetail?.port === "string") {
    portFromDetail = callDetail.port;
  } else if (callDetail?.port && typeof callDetail.port === "object") {
    portFromDetail =
      [callDetail.port.label, callDetail.port.name]
        .map((x) => (x != null ? String(x).trim() : ""))
        .find(Boolean) || "";
  }
  const portSummary = firstNonEmptyGroDisplay(
    callDetail?.port_name,
    portFromDetail,
    callDetail?.port_id != null && callDetail.port_id !== "" ? String(callDetail.port_id) : ""
  );
  const vesselNameSummary = firstNonEmptyGroDisplay(callDetail?.vessel_name, card?.vesselName);
  const requestedOperatorSummary = resolveGroRequestedOperatorDisplay(callDetail);
  const assignedUserReadOnlySummary = resolveGroAssignedUserDisplayName(
    callDetail,
    assignedUserId || resolveGroAssignedUserIdFromDetail(callDetail),
    groUserOptions
  );
  const assignedUserSelectOptions = groUserOptions;

  const resetExtraStageFileInputs = useCallback(() => {
    Object.values(extraStageFileInputRefs.current).forEach((el) => {
      if (el) el.value = "";
    });
  }, []);

  const resetInwardClearanceFields = () => {
    setTimeObjectValues({});
    setTimeObjectErrors({});
    setExtraStageFields(createEmptyExtraStageFields());
    setExtraStageFieldErrors({});
    resetExtraStageFileInputs();
  };

  const handleTimeObjectChange = useCallback(
    (fieldKey) =>
      ({ date, time }) => {
        const normalizedDate = date || "";
        const normalizedTime = time != null && time !== "" ? String(time).slice(0, 5) : "";
        setTimeObjectValues((prev) => ({
          ...prev,
          [fieldKey]: { date: normalizedDate, time: normalizedTime },
        }));
        setTimeObjectErrors((prev) => {
          if (!prev?.[fieldKey]) return prev;
          if (!normalizedDate || !normalizedTime) return prev;
          const next = { ...prev };
          delete next[fieldKey];
          return next;
        });
      },
    []
  );

  const inwardTimeObjectFields = useMemo(
    () =>
      (Array.isArray(timeObjects) ? timeObjects : [])
        .map((item) => {
          const valueKey = resolveGroTimeObjectValueKey(item);
          if (!valueKey) return null;
          const label = String(item?.time_object ?? "").trim() || "Date & Time";
          const isRequired = String(item?.is_required ?? "0") === "1";
          const fieldValue = timeObjectValues?.[valueKey] ?? { date: "", time: "" };
          return {
            fieldKey: valueKey,
            label,
            isRequired,
            pickerParts: fieldValue,
            onDateTimeChange: handleTimeObjectChange(valueKey),
            error: timeObjectErrors?.[valueKey] ?? "",
          };
        })
        .filter(Boolean),
    [timeObjects, timeObjectValues, timeObjectErrors, handleTimeObjectChange]
  );

  const handleExtraStageFieldChange = useCallback((field, value) => {
    setExtraStageFields((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "crew_immigration_status" && value !== GRO_CREW_IMMIGRATION_STATUS.ON_HOLD) {
        next.on_hold_reason = "";
      }
      if (field === "custom_inspection_status" && value !== GRO_CUSTOM_INSPECTION_STATUS.FAILED) {
        next.failed_reason = "";
      }
      return next;
    });
    setExtraStageFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      if (field === "crew_immigration_status") delete next.on_hold_reason;
      if (field === "custom_inspection_status") delete next.failed_reason;
      return next;
    });
  }, []);

  const handleExtraStageFileChange = useCallback((field, file) => {
    setExtraStageFields((prev) => ({ ...prev, [field]: file }));
    setExtraStageFieldErrors((prev) => {
      if (!prev?.[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const extraStageFieldsContent = useMemo(
    () =>
      groStageHasExtraFields(groStageId) ? (
        <GroPopoverStageExtraFields
          stageId={groStageId}
          values={extraStageFields}
          errors={extraStageFieldErrors}
          onFieldChange={handleExtraStageFieldChange}
          onFileChange={handleExtraStageFileChange}
          fileInputRefs={extraStageFileInputRefs}
          disabled={isGroLoading || isSavingArrivalDocument}
        />
      ) : null,
    [
      groStageId,
      extraStageFields,
      extraStageFieldErrors,
      handleExtraStageFieldChange,
      handleExtraStageFileChange,
      isGroLoading,
      isSavingArrivalDocument,
    ]
  );

  useEffect(() => {
    setTimeObjects([]);
    setTimeObjectValues({});
    setTimeObjectErrors({});
    setExtraStageFields(createEmptyExtraStageFields());
    setExtraStageFieldErrors({});
    resetExtraStageFileInputs();

    const portId = Number(groPortId);
    if (groStageId == null || !Number.isFinite(portId) || portId <= 0 || groCallTypeId == null) {
      setTimeObjectsLoading(false);
      return undefined;
    }

    let cancelled = false;
    setTimeObjectsLoading(true);

    groService
      .getStageTimeObjects({
        stage_id: groStageId,
        port_id: portId,
        call_type_id: groCallTypeId,
      })
      .then((res) => {
        if (cancelled) return;
        setTimeObjects(parseGroStageTimeObjectsResponse(res));
      })
      .catch(() => {
        if (!cancelled) setTimeObjects([]);
      })
      .finally(() => {
        if (!cancelled) setTimeObjectsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [groStageId, groPortId, groCallTypeId, resetExtraStageFileInputs]);

  useEffect(() => {
    setPassRequestsState({ callId: null, cg: undefined, zawil: undefined });
    setPassRequestsError(null);
    setPassRequestsLoading(false);
  }, [callId]);

  useEffect(() => {
    if (!callDetail) return;
    setAssignedUserId(resolveGroAssignedUserIdFromDetail(callDetail));
    setAssignedUserError("");
  }, [callDetail]);

  useEffect(() => {
    if (!showAssignedUserSelect) {
      setGroUserOptions([]);
      setGroUsersLoading(false);
      return undefined;
    }
    const portId = Number(groPortId);
    if (!Number.isFinite(portId) || portId <= 0) {
      setGroUserOptions([]);
      setGroUsersLoading(false);
      return undefined;
    }
    let cancelled = false;
    setGroUsersLoading(true);
    userService
      .getUsersByRole({ role_id: assigneeRoleId, port_id: portId })
      .then((res) => {
        if (!cancelled) setGroUserOptions(parseGroUsersByRoleResponse(res));
      })
      .catch(() => {
        if (!cancelled) setGroUserOptions([]);
      })
      .finally(() => {
        if (!cancelled) setGroUsersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showAssignedUserSelect, groPortId, assigneeRoleId]);

  useImperativeHandle(
    ref,
    () => ({
      validate: () => {
        if (!showAssignedUserSelect) {
          setAssignedUserError("");
          return null;
        }
        if (!String(assignedUserId ?? "").trim()) {
          const message = "Assigned User is required.";
          setAssignedUserError(message);
          return message;
        }
        setAssignedUserError("");
        return null;
      },
    }),
    [showAssignedUserSelect, assignedUserId]
  );

  useEffect(() => {
    if (hidePassTabs) return;
    if (groMainView === GRO_MAIN_VIEWS.inward) return;
    if (callId == null || callId === "") {
      setPassRequestsError("Unable to load pass requests: missing call id.");
      return;
    }
    if (passRequestsState.callId === callId && passRequestsState.cg !== undefined) return;

    let cancelled = false;
    setPassRequestsLoading(true);
    setPassRequestsError(null);

    const run = async () => {
      try {
        const res = await groService.getPassRequests(callId);
        if (cancelled) return;
        const parsed = parseGroPassRequestsResponse(res);
        setPassRequestsState({
          callId,
          cg: parsed.cg,
          zawil: parsed.zawil,
        });
      } catch (err) {
        if (!cancelled) {
          setPassRequestsError(groApiErrorMessage(err, "Failed to load pass requests."));
          setPassRequestsState({
            callId,
            cg: [],
            zawil: [],
          });
        }
      } finally {
        if (!cancelled) setPassRequestsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [hidePassTabs, groMainView, callId, passRequestsState.callId, passRequestsState.cg]);

  const switchGroMainView = useCallback((next) => {
    setGroMainView(next);
    setShowPassBulkPopover(false);
    setBulkPassPopoverRect(null);
    if (next !== GRO_MAIN_VIEWS.inward) {
      setShowInwardClearance(false);
    }
  }, []);

  useEffect(() => {
    if (!hidePassTabs) return;
    if (groMainView === GRO_MAIN_VIEWS.cg || groMainView === GRO_MAIN_VIEWS.zawil) {
      switchGroMainView(GRO_MAIN_VIEWS.inward);
    }
  }, [hidePassTabs, groMainView, switchGroMainView]);

  const selectDocumentsTab = useCallback(() => {
    setGroMainView(GRO_MAIN_VIEWS.inward);
    setShowInwardClearance(false);
    setActiveTab(GRO_ACTIVE_TABS.documents);
  }, []);

  const selectCrewImmigrationTab = useCallback(() => {
    setShowInwardClearance(false);
    setActiveTab(GRO_ACTIVE_TABS.crewImmigration);
  }, []);

  const retryPassRequests = useCallback(() => {
    setPassRequestsState({ callId: null, cg: undefined, zawil: undefined });
    setPassRequestsError(null);
  }, []);

  const refreshPassRequests = useCallback(async () => {
    if (callId == null || callId === "") return;
    setPassRequestsLoading(true);
    setPassRequestsError(null);
    try {
      const res = await groService.getPassRequests(callId);
      const parsed = parseGroPassRequestsResponse(res);
      setPassRequestsState({ callId, cg: parsed.cg, zawil: parsed.zawil });
    } catch (err) {
      setPassRequestsError(groApiErrorMessage(err, "Failed to load pass requests."));
      setPassRequestsState({ callId, cg: [], zawil: [] });
    } finally {
      setPassRequestsLoading(false);
    }
  }, [callId]);

  const handlePassUploadSubmit = useCallback(
    async (payload) => {
      const list = Array.isArray(payload) ? payload : [payload];
      if (list.length === 0) return;
      try {
        const upload =
          groMainView === GRO_MAIN_VIEWS.cg
            ? groService.uploadCgPass
            : groMainView === GRO_MAIN_VIEWS.zawil
              ? groService.uploadZawilPass
              : null;
        if (!upload) {
          notify("Invalid pass tab.", "error");
          throw new Error("Invalid pass tab.");
        }
        await Promise.all(list.map((fd) => upload(fd)));
        notify(list.length > 1 ? "Passes uploaded successfully." : "Pass uploaded successfully.", "success");
        await refreshPassRequests();
      } catch (err) {
        notify(groApiErrorMessage(err, "Upload failed."), "error");
        throw err;
      }
    },
    [groMainView, refreshPassRequests]
  );

  const passTableForFlat =
    groMainView === GRO_MAIN_VIEWS.cg
      ? passRequestsState.cg
      : groMainView === GRO_MAIN_VIEWS.zawil
        ? passRequestsState.zawil
        : EMPTY_WORK_ORDERS;

  const flatPassRows = useMemo(
    () => flattenGroPassRows(Array.isArray(passTableForFlat) ? passTableForFlat : EMPTY_WORK_ORDERS),
    [passTableForFlat]
  );

  const passWorkOrdersForTable = Array.isArray(passTableForFlat) ? passTableForFlat : EMPTY_WORK_ORDERS;

  const crewImmigrationTotalRows = crewImmigrationRows.length;
  const crewImmigrationTotalPages = Math.max(
    1,
    Math.ceil(crewImmigrationTotalRows / CREW_IMMIGRATION_ROWS_PER_PAGE)
  );
  const crewImmigrationCurrentPage = Math.min(crewImmigrationPage, crewImmigrationTotalPages);
  const crewImmigrationStartIndex =
    (crewImmigrationCurrentPage - 1) * CREW_IMMIGRATION_ROWS_PER_PAGE;
  const crewImmigrationPageRows = useMemo(
    () =>
      crewImmigrationRows.slice(
        crewImmigrationStartIndex,
        crewImmigrationStartIndex + CREW_IMMIGRATION_ROWS_PER_PAGE
      ),
    [crewImmigrationRows, crewImmigrationStartIndex]
  );
  const crewImmigrationCurrentPageRowIds = useMemo(
    () => crewImmigrationPageRows.map((row) => String(row.id)),
    [crewImmigrationPageRows]
  );
  const crewImmigrationPageStartDisplay = crewImmigrationTotalRows === 0 ? 0 : crewImmigrationStartIndex + 1;
  const crewImmigrationPageEndDisplay = Math.min(
    crewImmigrationStartIndex + CREW_IMMIGRATION_ROWS_PER_PAGE,
    crewImmigrationTotalRows
  );
  const crewImmigrationPageNumbers = useMemo(
    () => Array.from({ length: crewImmigrationTotalPages }, (_, i) => i + 1),
    [crewImmigrationTotalPages]
  );
  const isAllCrewImmigrationSelected = useMemo(
    () =>
      crewImmigrationCurrentPageRowIds.length > 0 &&
      crewImmigrationCurrentPageRowIds.every((id) => crewImmigrationSelectedRowIds.has(id)),
    [crewImmigrationCurrentPageRowIds, crewImmigrationSelectedRowIds]
  );
  const isCrewImmigrationPartiallySelected = useMemo(
    () =>
      crewImmigrationCurrentPageRowIds.some((id) => crewImmigrationSelectedRowIds.has(id)) &&
      !isAllCrewImmigrationSelected,
    [crewImmigrationCurrentPageRowIds, crewImmigrationSelectedRowIds, isAllCrewImmigrationSelected]
  );

  useEffect(() => {
    if (!crewImmigrationHeaderCheckboxRef.current) return;
    crewImmigrationHeaderCheckboxRef.current.indeterminate = isCrewImmigrationPartiallySelected;
  }, [isCrewImmigrationPartiallySelected]);

  const resetBulkPassUploadForm = useCallback(() => {
    setBulkPassForm({ passNo: "", issuePickerParts: { date: "", time: "" }, file: null });
    setBulkPassFormError("");
    if (bulkPassFileInputRef.current) bulkPassFileInputRef.current.value = "";
  }, []);

  const clearPassRowSelection = useCallback(() => {
    setPassSelectedRowIds(new Set());
    setShowPassBulkPopover(false);
    setBulkPassPopoverRect(null);
    resetBulkPassUploadForm();
  }, [resetBulkPassUploadForm]);

  useEffect(() => {
    clearPassRowSelection();
  }, [groMainView, passTableForFlat, clearPassRowSelection]);

  useEffect(() => {
    if (activeTab !== GRO_ACTIVE_TABS.crewImmigration) {
      setCrewImmigrationSelectedRowIds(new Set());
      setCrewImmigrationPage(1);
    }
  }, [activeTab]);

  useEffect(() => {
    if (crewImmigrationPage > crewImmigrationTotalPages) {
      setCrewImmigrationPage(crewImmigrationTotalPages);
    }
  }, [crewImmigrationPage, crewImmigrationTotalPages]);

  const updateCrewPassStatus = useCallback((ids, variant, file) => {
    const idSet = new Set((Array.isArray(ids) ? ids : []).map((id) => String(id)));
    if (idSet.size === 0) return;
    const uploadedPayload = {
      fileName: String(file?.name ?? "").trim() || "uploaded-file",
      fileUrl: file ? URL.createObjectURL(file) : "",
      uploadedAt: Date.now(),
    };
    setCrewImmigrationRows((prev) =>
      prev.map((row) => {
        if (!idSet.has(String(row.id))) return row;
        if (variant === "cg") return { ...row, cgPass: uploadedPayload };
        return { ...row, zawilPass: uploadedPayload };
      })
    );
  }, []);

  const triggerCrewUploadInput = useCallback((variant, rowId = null) => {
    setCrewUploadAction({ variant, rowId });
    const inputRef =
      variant === "cg" ? crewImmigrationCgFileInputRef.current : crewImmigrationZawilFileInputRef.current;
    if (inputRef) {
      inputRef.value = "";
      inputRef.click();
    }
  }, []);

  const handleCrewFileInputChange = useCallback(
    (variant, event) => {
      const file = event?.target?.files?.[0];
      if (!file) return;
      if (crewUploadAction.rowId != null) {
        updateCrewPassStatus([crewUploadAction.rowId], variant, file);
        notify(
          `${variant === "cg" ? "CG Pass" : "Zawil Pass"} uploaded successfully for selected crew.`,
          "success"
        );
      } else {
        const selectedIds = Array.from(crewImmigrationSelectedRowIds);
        if (selectedIds.length === 0) {
          notify("Select at least one crew row.", "warn");
          return;
        }
        updateCrewPassStatus(selectedIds, variant, file);
        notify(
          `${variant === "cg" ? "CG Pass" : "Zawil Pass"} uploaded successfully for ${selectedIds.length} crew.`,
          "success"
        );
      }
      setCrewUploadAction({ variant: null, rowId: null });
    },
    [crewUploadAction.rowId, crewImmigrationSelectedRowIds, updateCrewPassStatus]
  );

  const handleBulkPassSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const passNo = String(bulkPassForm.passNo ?? "").trim();
      const issueDate = buildGroPassIssueDateString(bulkPassForm.issuePickerParts);
      const file = bulkPassForm.file;
      const parts = [];
      if (!passNo) parts.push("Pass no is required.");
      if (!issueDate) parts.push("Issue date and time is required.");
      if (!file) parts.push("Document copy is required.");
      if (parts.length > 0) {
        setBulkPassFormError(parts.join(" "));
        return;
      }
      setBulkPassFormError("");

      const targets = Array.from(passSelectedRowIds)
        .map((id) => flatPassRows.find((r) => r.kind === "crew" && groPassCrewRowId(r) === id))
        .filter(Boolean);

      if (targets.length === 0) {
        setBulkPassFormError("No rows selected.");
        return;
      }

      const passVariant = groMainView === GRO_MAIN_VIEWS.cg ? "cg" : "zawil";

      for (const row of targets) {
        const cp = row.crewPassId ?? getGroCrewPassId(row.crew);
        if (passVariant === "cg") {
          if (cp == null || cp === "") {
            setBulkPassFormError("Some selected rows are missing a crew pass id.");
            return;
          }
        } else {
          const woId = row.woId ?? getGroWorkOrderId(row.wo);
          if ((cp == null || cp === "") && (woId == null || woId === "")) {
            setBulkPassFormError("Some selected rows are missing crew pass or work order id.");
            return;
          }
        }
      }

      const forms = targets.map((row) => {
        const fd = new FormData();
        fd.append("pass_no", passNo);
        fd.append("issue_date", issueDate);
        fd.append("document_copy", file);
        const cp = row.crewPassId ?? getGroCrewPassId(row.crew);
        if (passVariant === "cg") {
          fd.append("crew_pass_id", String(cp));
        } else {
          const woId = row.woId ?? getGroWorkOrderId(row.wo);
          if (cp != null && cp !== "") fd.append("crew_pass_id", String(cp));
          else fd.append("wo_id", String(woId));
        }
        return fd;
      });

      setBulkPassSubmitting(true);
      try {
        await handlePassUploadSubmit(forms);
        setShowPassBulkPopover(false);
        setBulkPassPopoverRect(null);
        resetBulkPassUploadForm();
      } catch {
        /* toast in handlePassUploadSubmit */
      } finally {
        setBulkPassSubmitting(false);
      }
    },
    [
      bulkPassForm,
      flatPassRows,
      groMainView,
      handlePassUploadSubmit,
      passSelectedRowIds,
      resetBulkPassUploadForm,
    ]
  );

  const syncBulkPassPopoverRect = useCallback(() => {
    if (bulkPassUploadBtnRef.current) {
      setBulkPassPopoverRect(bulkPassUploadBtnRef.current.getBoundingClientRect());
    }
  }, []);

  useEffect(() => {
    if (!showPassBulkPopover) return undefined;
    syncBulkPassPopoverRect();
    const bump = () => syncBulkPassPopoverRect();
    window.addEventListener("scroll", bump, true);
    window.addEventListener("resize", bump);
    return () => {
      window.removeEventListener("scroll", bump, true);
      window.removeEventListener("resize", bump);
    };
  }, [showPassBulkPopover, syncBulkPassPopoverRect]);

  const refreshGroDocuments = useCallback(async () => {
    if (!taskId) return;
    try {
      const docsRes = await groService.getDocumentsByTask(taskId, callId);
      applyDocumentsByTaskResponse(docsRes);
    } catch {
      setIsFirstColumn(false);
      setTaskDocumentsData(null);
      setDocuments([]);
    }
  }, [taskId, callId, applyDocumentsByTaskResponse]);

  useEffect(() => {
    setTaskDocumentsData(null);
  }, [taskId, callId]);

  useEffect(() => {
    if (callId == null || callId === "") {
      notify("Unable to load GRO data: missing call id.", "error");
      setCallDetail(null);
      setTaskDocumentsData(null);
      setDocuments([]);
      return undefined;
    }

    if (cardId == null || cardId === "") {
      notify("Unable to load GRO data: missing card id.", "error");
      setCallDetail(null);
      setTaskDocumentsData(null);
      setDocuments([]);
      return undefined;
    }

    if (!taskId) {
      notify("Unable to load documents: missing task id.", "error");
      setTaskDocumentsData(null);
      setDocuments([]);
    }

    let cancelled = false;
    const load = async () => {
      setIsGroLoading(true);
      try {
        const detailRes = await groService.getCallDetailById(callId, cardId);
        if (cancelled) return;
        const detail = detailRes?.data?.data ?? detailRes?.data ?? {};
        setCallDetail(detail);

        if (!taskId) {
          setTaskDocumentsData(null);
          setDocuments([]);
          return;
        }

        const docsRes = await groService.getDocumentsByTask(taskId, callId);
        if (cancelled) return;
        applyDocumentsByTaskResponse(docsRes);
      } catch (err) {
        if (cancelled) return;
        notify(groApiErrorMessage(err, "Failed to load GRO card data."), "error");
        setCallDetail(null);
        setTaskDocumentsData(null);
        setDocuments([]);
      } finally {
        if (!cancelled) setIsGroLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [callId, cardId, taskId, applyDocumentsByTaskResponse]);

  const handleInwardCancel = () => {
    setShowInwardClearance(false);
    resetInwardClearanceFields();
  };

  const handleInwardSubmit = async () => {
    if (callId == null || callId === "") {
      notify("Call id is missing.", "error");
      return;
    }
    if (!taskId) {
      notify("Task id is missing.", "error");
      return;
    }

    const timeValidationErrors = validateGroRequiredTimeObjects(timeObjects, timeObjectValues);
    if (Object.keys(timeValidationErrors).length > 0) {
      setTimeObjectErrors(timeValidationErrors);
      notify("Please fill in all required time fields.", "warn");
      return;
    }
    setTimeObjectErrors({});

    if (groStageHasExtraFields(groStageId)) {
      const extraErrors = validateGroExtraStageFields(groStageId, extraStageFields);
      if (Object.keys(extraErrors).length > 0) {
        setExtraStageFieldErrors(extraErrors);
        notify("Please fill in all required fields.", "warn");
        return;
      }
      setExtraStageFieldErrors({});
    }

    const formData = buildGroArrivalSaveFormData({
      callId,
      taskId,
      timeObjects,
      timeObjectValues,
      stageId: groStageId,
      extraStageFields,
    });

    try {
      await saveArrivalDocument({ formData });
      notify("Arrival document saved successfully.", "success");
      setShowInwardClearance(false);
      resetInwardClearanceFields();
      await refreshGroDocuments();
      try {
        if (cardId != null && cardId !== "") {
          const detailRes = await groService.getCallDetailById(callId, cardId);
          setCallDetail(detailRes?.data?.data ?? detailRes?.data ?? {});
        }
      } catch {
        /* optional refresh */
      }
    } catch (err) {
      notify(groApiErrorMessage(err, "Failed to save arrival document."), "error");
    }
  };

  const canVerifyDocument = useCallback(
    (doc) =>
      doc.document_id != null &&
      callId != null &&
      callId !== "" &&
      taskId != null &&
      taskId !== "" &&
      cardId != null &&
      cardId !== "",
    [callId, taskId, cardId]
  );

  const closeConfirmModal = useCallback(() => {
    if (isSubmittingAction) return;
    setIsConfirmModalOpen(false);
    setSelectedDocument(null);
    setConfirmAction(null);
    setConfirmRemarks("");
  }, [isSubmittingAction]);

  const openConfirmModal = useCallback((doc, action) => {
    if (isSubmittingAction) return;
    if (isFirstColumn) return;
    if (getGroDocumentVerifyStatus(doc) !== 1) return;
    setSelectedDocument(doc);
    setConfirmAction(action);
    setConfirmRemarks(action === "reject" ? (doc?.remarks ?? "") : "");
    setIsConfirmModalOpen(true);
  }, [isSubmittingAction, isFirstColumn]);

  const handleApproveClick = useCallback(
    (doc) => openConfirmModal(doc, "approve"),
    [openConfirmModal]
  );

  const handleRejectClick = useCallback(
    (doc) => openConfirmModal(doc, "reject"),
    [openConfirmModal]
  );

  const handleConfirmAction = async () => {
    if (!selectedDocument || !confirmAction || isSubmittingAction) return;
    const doc = selectedDocument;
    if (!canVerifyDocument(doc)) {
      notify("This document cannot be updated (missing reference).", "error");
      return;
    }
    if (getGroDocumentVerifyStatus(doc) !== 1) {
      notify(
        confirmAction === "approve"
          ? "Only uploaded documents can be approved."
          : "Remarks can only be submitted while the document is pending verification.",
        "warn"
      );
      return;
    }
    if (confirmAction === "reject" && !String(confirmRemarks ?? "").trim()) {
      notify("Remarks are required to reject a document.", "warn");
      return;
    }
    const status = confirmAction === "approve" ? 2 : 4;
    const remarks = confirmAction === "approve" ? "" : String(confirmRemarks).trim();
    setIsSubmittingAction(true);
    try {
      await groService.verifyGroDocs({
        call_id: Number(callId),
        task_id: Number(taskId),
        card_id: Number(cardId),
        documents: [
          {
            document_id: Number(doc.document_id),
            status,
            remarks,
          },
        ],
      });
      await refreshGroDocuments();
      notify(confirmAction === "approve" ? "Document verified." : "Document rejected.", "success");
      setIsConfirmModalOpen(false);
      setSelectedDocument(null);
      setConfirmAction(null);
      setConfirmRemarks("");
    } catch (err) {
      notify(
        groApiErrorMessage(err, confirmAction === "approve" ? "Failed to verify document." : "Failed to update document."),
        "error"
      );
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleDocumentDownload = (doc) => {
    const url = doc?.file_url;
    if (!url || String(url).trim() === "") {
      notify("File not available.", "error");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const documentsSectionTitle = "Documents";

  const handleAssignedUserChange = useCallback(
    async (e) => {
      const nextUserId = e?.target?.value ?? "";
      const previousUserId = assignedUserId;

      if (!nextUserId) {
        setAssignedUserId("");
        setAssignedUserError("Assigned User is required.");
        return;
      }

      setAssignedUserId(nextUserId);
      setAssignedUserError("");
      setIsAssigningUser(true);

      try {
        await groService.assignTask({
          card_id: cardId,
          user_id: nextUserId,
        });

        notify("Assigned user updated successfully.", "success");
      } catch (err) {
        setAssignedUserId(previousUserId);
        notify(groApiErrorMessage(err, "Failed to assign user."), "error");
      } finally {
        setIsAssigningUser(false);
      }
    },
    [assignedUserId, cardId]
  );

  const bulkPassPopoverStyle =
    showPassBulkPopover && bulkPassPopoverRect != null
      ? computeGroPassUploadPopoverPosition(bulkPassPopoverRect)
      : null;

  const bulkPassPortal =
    showPassBulkPopover &&
      bulkPassPopoverStyle &&
      typeof document !== "undefined" &&
      document.body
      ? createPortal(
        <div
          ref={bulkPassPopoverPortalRef}
          className="gro-pass-upload-popover gro-pass-upload-popover--bulk"
          style={bulkPassPopoverStyle}
          role="presentation"
        >
          <GroPassUploadPopoverForm
            title={groMainView === GRO_MAIN_VIEWS.cg ? "Bulk Upload CG Pass" : "Bulk Upload Zawil Pass"}
            passNo={bulkPassForm.passNo}
            onPassNoChange={(e) => setBulkPassForm((prev) => ({ ...prev, passNo: e.target.value }))}
            issuePickerParts={bulkPassForm.issuePickerParts}
            onIssueDateTimeChange={({ date, time }) =>
              setBulkPassForm((prev) => ({
                ...prev,
                issuePickerParts: {
                  date: date || "",
                  time: time != null && time !== "" ? String(time).slice(0, 5) : "",
                },
              }))
            }
            fileInputRef={bulkPassFileInputRef}
            fileName={bulkPassForm.file?.name}
            onFileInputChange={(e) => setBulkPassForm((prev) => ({ ...prev, file: e.target.files?.[0] ?? null }))}
            onCancel={() => {
              setShowPassBulkPopover(false);
              setBulkPassPopoverRect(null);
              resetBulkPassUploadForm();
            }}
            onSubmit={handleBulkPassSubmit}
            submitting={bulkPassSubmitting}
            formLevelError={bulkPassFormError}
            hasIssueDateError={bulkPassFormError.includes("Issue date")}
            datetimePopperClassName="gro-pass-upload-datetime-popper"
          />
        </div>,
        document.body
      )
      : null;

  return (
    <div className="gro-card-view">
      <div className="gro-summary-grid gro-summary-grid--six-col">
        <GroSummaryCard label="Call Type" value={callTypeSummary} />
        <GroSummaryCard label="Billing Entity" value={billingEntitySummary} />
        <GroSummaryCard label="Port" value={portSummary} />
        <GroSummaryCard label="Vessel Name" value={vesselNameSummary} />
        <GroSummaryCard label="Requested Operator" value={requestedOperatorSummary} />
        {showAssignedUserSelect ? (
          <GroSummaryFieldCard label="Assigned User" error={assignedUserError}>
            <SearchableSelect
              value={assignedUserId}
              onChange={handleAssignedUserChange}
              options={assignedUserSelectOptions}
              placeholder={groUsersLoading ? "Loading…" : "Select user"}
              searchPlaceholder={deriveSearchPlaceholder("Select user")}
              disabled={groUsersLoading || isGroLoading || isAssigningUser}
              hasError={Boolean(assignedUserError)}
              className="gro-summary-searchable-select"
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              menuPosition="fixed"
            />
          </GroSummaryFieldCard>
        ) : mode === "gro" ? (
          <GroSummaryCard label="Assigned User" value={assignedUserReadOnlySummary} />
        ) : null}
      </div>

      <div className="gro-document-section">
        <div className="gro-document-header">
          <h3 className="gro-documents-heading">{documentsSectionTitle}</h3>
          <div className="gro-document-header-actions gro-document-header-actions--with-segments">
            <div className="gro-pass-segments-row">
              <div
                className="gro-pass-segments"
                role="tablist"
                aria-label={
                  isCustomClearance
                    ? "Documents and Bayan"
                    : `Documents and ${taskPanelTitle}`
                }
              >
                {hidePassTabs ? (
                  <>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === GRO_ACTIVE_TABS.documents}
                      className={`gro-pass-segment${activeTab === GRO_ACTIVE_TABS.documents ? " gro-pass-segment--active" : ""}`}
                      onClick={selectDocumentsTab}
                    >
                      Documents
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === GRO_ACTIVE_TABS.crewImmigration}
                      className={`gro-pass-segment${activeTab === GRO_ACTIVE_TABS.crewImmigration ? " gro-pass-segment--active" : ""}`}
                      onClick={selectCrewImmigrationTab}
                    >
                      Crew Immigration
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={groMainView === GRO_MAIN_VIEWS.cg}
                      className={`gro-pass-segment${groMainView === GRO_MAIN_VIEWS.cg ? " gro-pass-segment--active" : ""}`}
                      onClick={() => switchGroMainView(GRO_MAIN_VIEWS.cg)}
                    >
                      CG Pass
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={groMainView === GRO_MAIN_VIEWS.zawil}
                      className={`gro-pass-segment${groMainView === GRO_MAIN_VIEWS.zawil ? " gro-pass-segment--active" : ""}`}
                      onClick={() => switchGroMainView(GRO_MAIN_VIEWS.zawil)}
                    >
                      Zawil Pass
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={groMainView === GRO_MAIN_VIEWS.inward}
                      className={`gro-pass-segment${groMainView === GRO_MAIN_VIEWS.inward ? " gro-pass-segment--active" : ""}`}
                      onClick={selectDocumentsTab}
                    >
                      Documents
                    </button>
                  </>
                )}
              </div>
              {(hidePassTabs && activeTab === GRO_ACTIVE_TABS.documents) ||
                (!hidePassTabs && groMainView === GRO_MAIN_VIEWS.inward) ? (
                <InwardClearanceToolbar
                  inwardAnchorRef={inwardAnchorRef}
                  showMainFileUpload={false}
                  showInwardClearance={showInwardClearance}
                  onToggleInwardPopover={() => setShowInwardClearance(!showInwardClearance)}
                  inwardActionLabel={inwardPanelLabel}
                  inwardPopoverTitle={taskPanelTitle}
                  timeObjectFields={inwardTimeObjectFields}
                  timeObjectsLoading={timeObjectsLoading}
                  extraStageFieldsContent={extraStageFieldsContent}
                  onInwardCancel={handleInwardCancel}
                  onInwardSubmit={handleInwardSubmit}
                  isSavingInward={isSavingArrivalDocument}
                  isGroLoadingDisabled={
                    isGroLoading || isSavingArrivalDocument || callId == null || callId === "" || !taskId
                  }
                />
              ) : !hidePassTabs &&
                (groMainView === GRO_MAIN_VIEWS.cg || groMainView === GRO_MAIN_VIEWS.zawil) &&
                passSelectedRowIds.size > 0 ? (
                <div className="gro-inward-anchor gro-pass-bulk-upload-anchor">
                  <button
                    ref={bulkPassUploadBtnRef}
                    type="button"
                    className={`gro-pass-segment${showPassBulkPopover ? " gro-pass-segment--popover-open" : ""}`}
                    onClick={(e) => {
                      if (showPassBulkPopover) {
                        setShowPassBulkPopover(false);
                        setBulkPassPopoverRect(null);
                        resetBulkPassUploadForm();
                        return;
                      }
                      resetBulkPassUploadForm();
                      setBulkPassPopoverRect(e.currentTarget.getBoundingClientRect());
                      setShowPassBulkPopover(true);
                    }}
                  >
                    Bulk upload
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {hidePassTabs && activeTab === GRO_ACTIVE_TABS.crewImmigration ? (
          <CrewImmigrationPanel
            selectedRowIds={crewImmigrationSelectedRowIds}
            onBulkUploadCg={() => triggerCrewUploadInput("cg")}
            onBulkUploadZawil={() => triggerCrewUploadInput("zawil")}
            headerCheckboxRef={crewImmigrationHeaderCheckboxRef}
            isAllSelected={isAllCrewImmigrationSelected}
            onSelectAllChange={(checked) => {
              setCrewImmigrationSelectedRowIds((prev) => {
                const next = new Set(prev);
                if (checked) {
                  crewImmigrationCurrentPageRowIds.forEach((id) => next.add(id));
                } else {
                  crewImmigrationCurrentPageRowIds.forEach((id) => next.delete(id));
                }
                return next;
              });
            }}
            rows={crewImmigrationPageRows}
            onRowSelectionChange={(rowId, checked) => {
              setCrewImmigrationSelectedRowIds((prev) => {
                const next = new Set(prev);
                if (checked) next.add(rowId);
                else next.delete(rowId);
                return next;
              });
            }}
            pageStartDisplay={crewImmigrationPageStartDisplay}
            pageEndDisplay={crewImmigrationPageEndDisplay}
            totalRows={crewImmigrationTotalRows}
            currentPage={crewImmigrationCurrentPage}
            totalPages={crewImmigrationTotalPages}
            pageNumbers={crewImmigrationPageNumbers}
            onPrevPage={() => setCrewImmigrationPage((prev) => Math.max(1, prev - 1))}
            onPageChange={setCrewImmigrationPage}
            onNextPage={() =>
              setCrewImmigrationPage((prev) => Math.min(crewImmigrationTotalPages, prev + 1))
            }
            cgFileInputRef={crewImmigrationCgFileInputRef}
            zawilFileInputRef={crewImmigrationZawilFileInputRef}
            onCgFileChange={(e) => handleCrewFileInputChange("cg", e)}
            onZawilFileChange={(e) => handleCrewFileInputChange("zawil", e)}
            onRowUploadClick={triggerCrewUploadInput}
          />
        ) : hidePassTabs || groMainView === GRO_MAIN_VIEWS.inward ? (
          <InwardClearanceView
            documents={documents}
            isGroLoading={isGroLoading}
            isSubmittingAction={isSubmittingAction}
            showDocumentVerifyActions={!isFirstColumn}
            onApproveClick={handleApproveClick}
            onRejectClick={handleRejectClick}
            onDocumentDownload={handleDocumentDownload}
          />
        ) : (
          <PassRequestsView
            workOrders={passWorkOrdersForTable}
            loading={passRequestsLoading}
            errorMessage={
              groMainView !== GRO_MAIN_VIEWS.inward && passRequestsError
                ? passRequestsError
                : groMainView !== GRO_MAIN_VIEWS.inward && (callId == null || callId === "") && !passRequestsLoading
                  ? "Unable to load pass requests: missing call id."
                  : null
            }
            onRetry={retryPassRequests}
            passVariant={groMainView === GRO_MAIN_VIEWS.cg ? "cg" : "zawil"}
            onPassUploadSubmit={handlePassUploadSubmit}
            selectedRowIds={passSelectedRowIds}
            onRowSelectionToggle={(id) => {
              setPassSelectedRowIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
            }}
            onVisiblePageSelectionChange={(ids, checked) => {
              setPassSelectedRowIds((prev) => {
                const next = new Set(prev);
                if (checked) ids.forEach((rowId) => next.add(rowId));
                else ids.forEach((rowId) => next.delete(rowId));
                return next;
              });
            }}
          />
        )}
      </div>
      {bulkPassPortal}
      <DocumentActionConfirmModal
        isOpen={isConfirmModalOpen}
        confirmAction={confirmAction}
        documentName={selectedDocument?.document_name}
        confirmRemarks={confirmRemarks}
        isSubmitting={isSubmittingAction}
        onRemarksChange={(e) => setConfirmRemarks(e.target.value)}
        onCancel={closeConfirmModal}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
});

GROCardView.propTypes = {
  card: PropTypes.object,
  mode: PropTypes.oneOf(["gro", "custom"]),
  userRoleId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  selectedTask: PropTypes.shape({
    task_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    taskId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    task_name: PropTypes.string,
    taskName: PropTypes.string,
  }),
};

GROCardView.displayName = "GROCardView";

export default GROCardView;
