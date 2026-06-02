import { useState, useCallback, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { notify } from "../../../../../../components/Toaster";
import SearchableSelect, { deriveSearchPlaceholder } from "../../../../../../components/form/SearchableSelect";
import userService from "../../../../../../services/userService";
import { isGROSupervisorRole } from "../../../../../../helpers/groUserRoles";
import { PRE_ARRIVAL_GRO_ROLE_ID } from "../../../../CardFormTabs/tabs/operation/operationConstants";
import groService from "../../../../../../services/groService";
import GroSummaryCard, { GroSummaryFieldCard } from "./GroSummaryCard";
import InwardClearanceView, { DocumentActionConfirmModal, InwardClearanceToolbar } from "./InwardClearanceView";
import PassRequestsView from "./PassRequestsView";
import GroPassUploadPopoverForm from "./GroPassUploadPopoverForm";
import {
  GRO_MAIN_VIEWS,
  enrichGroDocWithRowKey,
  normalizeGroApiDocuments,
  parseDocumentsByTaskResponse,
  groApiErrorMessage,
  resolveGroCallId,
  resolveGroTaskId,
  resolveGroPortId,
  splitInwardDateTimeString,
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

const GROCardView = forwardRef(function GROCardView({ card, mode = "gro", userRoleId = null }, ref) {
  const isCustomClearance = mode === "custom";
  const hidePassTabs = mode === "gro" || isCustomClearance;
  const isGroSupervisorViewer =
    isGROSupervisorRole(userRoleId) || isGROSupervisorRole(Number(userRoleId));
  const showAssignedUserSelect = mode === "gro" && isGroSupervisorViewer;

  const inwardAnchorRef = useRef(null);
  const inwardFileInputRef = useRef(null);
  const [showInwardClearance, setShowInwardClearance] = useState(false);
  const [inwardFile, setInwardFile] = useState(null);
  const [inwardDateTime, setInwardDateTime] = useState("");
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmRemarks, setConfirmRemarks] = useState("");
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [callDetail, setCallDetail] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [isGroLoading, setIsGroLoading] = useState(false);
  const [isSavingInward, setIsSavingInward] = useState(false);
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
  const bulkPassUploadBtnRef = useRef(null);
  const bulkPassPopoverPortalRef = useRef(null);
  const bulkPassFileInputRef = useRef(null);

  const callId = resolveGroCallId(card);
  const taskId = useMemo(() => resolveGroTaskId(card), [card]);
  const groPortId = useMemo(() => resolveGroPortId(callDetail, card), [callDetail, card]);

  const applyTaskDocuments = useCallback((rawList) => {
    const normalized = normalizeGroApiDocuments(rawList);
    setDocuments(normalized.map((d, i) => enrichGroDocWithRowKey(d, i)));
  }, []);

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

  const resetInwardClearanceFields = () => {
    setInwardFile(null);
    setInwardDateTime("");
    if (inwardFileInputRef.current) {
      inwardFileInputRef.current.value = "";
    }
  };

  const inwardPickerParts = splitInwardDateTimeString(inwardDateTime);

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
      .getUsersByRole({ role_id: PRE_ARRIVAL_GRO_ROLE_ID, port_id: portId })
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
  }, [showAssignedUserSelect, groPortId]);

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
      const docsRes = await groService.getDocumentsByTask(taskId);
      applyTaskDocuments(parseDocumentsByTaskResponse(docsRes));
    } catch {
      setDocuments([]);
    }
  }, [taskId, applyTaskDocuments]);

  useEffect(() => {
    if (callId == null || callId === "") {
      notify("Unable to load GRO data: missing call id.", "error");
      setCallDetail(null);
      setDocuments([]);
      return undefined;
    }

    if (!taskId) {
      notify("Unable to load documents: missing task id.", "error");
      setDocuments([]);
    }

    let cancelled = false;
    const load = async () => {
      setIsGroLoading(true);
      try {
        const detailRes = await groService.getCallDetailById(callId);
        if (cancelled) return;
        const detail = detailRes?.data?.data ?? detailRes?.data ?? {};
        setCallDetail(detail);

        if (!taskId) {
          setDocuments([]);
          return;
        }

        const docsRes = await groService.getDocumentsByTask(taskId);
        if (cancelled) return;
        applyTaskDocuments(parseDocumentsByTaskResponse(docsRes));
      } catch (err) {
        if (cancelled) return;
        notify(groApiErrorMessage(err, "Failed to load GRO card data."), "error");
        setCallDetail(null);
        setDocuments([]);
      } finally {
        if (!cancelled) setIsGroLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [callId, taskId, applyTaskDocuments]);

  const handleInwardDateTimePickerChange = useCallback(({ date, time }) => {
    if (!date) {
      setInwardDateTime("");
      return;
    }
    const formattedTime = time ? String(time).slice(0, 5) : "00:00";
    setInwardDateTime(`${date} ${formattedTime}:00`);
  }, []);

  const handleInwardCancel = () => {
    setShowInwardClearance(false);
    resetInwardClearanceFields();
  };

  const handleInwardSubmit = async () => {
    if (callId == null || callId === "") {
      notify("Call id is missing.", "error");
      return;
    }
    if (!inwardFile) {
      notify("Please select a document.", "warn");
      return;
    }
    if (!String(inwardDateTime ?? "").trim()) {
      notify("Please select document date and time.", "warn");
      return;
    }
    const formData = new FormData();
    formData.append("call_id", callId);
    formData.append("document", inwardFile);
    formData.append("document_date", inwardDateTime);
    setIsSavingInward(true);
    try {
      await groService.saveArrivalDocument(formData);
      notify("Inward clearance saved successfully.", "success");
      setShowInwardClearance(false);
      resetInwardClearanceFields();
      await refreshGroDocuments();
      try {
        const detailRes = await groService.getCallDetailById(callId);
        setCallDetail(detailRes?.data?.data ?? detailRes?.data ?? {});
      } catch {
        /* optional refresh */
      }
    } catch (err) {
      notify(groApiErrorMessage(err, "Failed to save inward clearance."), "error");
    } finally {
      setIsSavingInward(false);
    }
  };

  const canVerifyDocument = useCallback(
    (doc) =>
      doc.document_id != null &&
      doc.call_task_document_id != null &&
      callId != null &&
      callId !== "",
    [callId]
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
    if (getGroDocumentVerifyStatus(doc) !== 1) return;
    setSelectedDocument(doc);
    setConfirmAction(action);
    setConfirmRemarks(action === "reject" ? (doc?.remarks ?? "") : "");
    setIsConfirmModalOpen(true);
  }, [isSubmittingAction]);

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
        document_id: Number(doc.document_id),
        call_task_document_id: Number(doc.call_task_document_id),
        status,
        remarks,
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
          card_id: card?.card_id || card?.id,
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
    [assignedUserId, card]
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
                aria-label={isCustomClearance ? "Documents and Bayan" : "Documents and inward clearance"}
              >
                {!hidePassTabs ? (
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
                  </>
                ) : null}
                <button
                  type="button"
                  role="tab"
                  aria-selected={groMainView === GRO_MAIN_VIEWS.inward}
                  className={`gro-pass-segment${groMainView === GRO_MAIN_VIEWS.inward ? " gro-pass-segment--active" : ""}`}
                  onClick={selectDocumentsTab}
                >
                  Documents
                </button>
              </div>
              {groMainView === GRO_MAIN_VIEWS.inward ? (
                <InwardClearanceToolbar
                  inwardAnchorRef={inwardAnchorRef}
                  inwardFileInputRef={inwardFileInputRef}
                  showInwardClearance={showInwardClearance}
                  onToggleInwardPopover={() => setShowInwardClearance(!showInwardClearance)}
                  inwardActionLabel={isCustomClearance ? "Bayan" : "Inward clearance"}
                  inwardPopoverTitle={isCustomClearance ? "Bayan" : "Inward Clearance"}
                  inwardFile={inwardFile}
                  onInwardFileChange={(e) => setInwardFile(e.target.files?.[0] ?? null)}
                  inwardPickerParts={inwardPickerParts}
                  onInwardDateTimeChange={handleInwardDateTimePickerChange}
                  onInwardCancel={handleInwardCancel}
                  onInwardSubmit={handleInwardSubmit}
                  isSavingInward={isSavingInward}
                  isGroLoadingDisabled={isGroLoading || isSavingInward || callId == null || callId === ""}
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

        {hidePassTabs || groMainView === GRO_MAIN_VIEWS.inward ? (
          <InwardClearanceView
            documents={documents}
            isGroLoading={isGroLoading}
            isSubmittingAction={isSubmittingAction}
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
};

GROCardView.displayName = "GROCardView";

export default GROCardView;
