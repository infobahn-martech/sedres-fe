import { Fragment, useState, useCallback, useRef, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import { FiSearch, FiChevronLeft, FiChevronRight, FiCheck, FiNavigation, FiEdit2, FiX, FiTrash2 } from "react-icons/fi";
import CrewListUploadBox from "../husbandry/components/CrewListUploadBox";
import CrewUploadDropzones from "../husbandry/components/CrewUploadDropzones";
import CrewUploadPreviewModal from "../husbandry/components/CrewUploadPreviewModal";
import LaunchHireInlineForm from "../husbandry/components/LaunchHireInlineForm";
import DatePickerField from "../../../shared/components/DatePickerField";
import useCrewReducer from "../../../../../../store/CrewReducer";
import useCrewImmigrationReducer from "../../../../../../store/CrewImmigrationReducer";
import useCommonReducer from "../../../../../../store/CommonReducer";
import useLaunchHireServiceReducer from "../../../../../../store/LaunchHireServiceReducer";
import callFileService from "../../../../../../services/callFileService";
import { buildApiDateTime } from "../../../../../../shared/helpers/dateTimeFieldUtils";
import { notify } from "../../../../../../components/Toaster";

const LISTING_PAGE_SIZE = 10;

const createUploadSteps = () => ({
  crewList: { status: "pending", files: [], progress: 0 },
  passport: { status: "pending", files: [], progress: 0 },
  iqama: { status: "pending", files: [], progress: 0 },
  visa: { status: "pending", files: [], progress: 0 },
});

const getCrewOptionId = (crew, index) =>
  String(crew?.crew_change_id ?? crew?.crew_id ?? crew?.id ?? index);

const hasDocumentUrl = (url) =>
  typeof url === "string" && url.trim() !== "" && url.trim().toLowerCase() !== "null";

// Fields editable inline from the Crew Listing table's Action column —
// mirrors EDITABLE_SUMMARY_FIELDS in CrewManagementDashboard.
const EDITABLE_LISTING_FIELDS = ["crewName", "dateOfBirth", "nationality", "rank"];

// crew/import_crew_immigration's response carries the imported crew count
// under one of a few likely field names — check them defensively rather
// than assuming one exact shape.
const extractImportedCrewCount = (result) => {
  const root = result?.data ?? result ?? {};
  const count = root?.count ?? root?.crew_count ?? root?.total ?? root?.imported_count ?? root?.total_crew;
  if (Number.isFinite(Number(count))) return Number(count);
  if (Array.isArray(root?.crew)) return root.crew.length;
  if (Array.isArray(root)) return root.length;
  return 0;
};

const FileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M13 2v7h7" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

// Read-only doc status icon — green preview icon when the document is
// available, blank cell when missing. Mirrors DocStatusIcon in
// CrewManagementDashboard so the Crew Listing table matches its look.
const DocStatusIcon = ({ available, label }) => {
  if (!available) {
    return <div className="crew-table-cell crew-table-cell--doc-action" aria-hidden="true" />;
  }
  return (
    <div className="crew-table-cell crew-table-cell--doc-action">
      <div className="crew-doc-cell__inner">
        <span className="crew-doc-btn crew-doc-btn--preview" aria-label={`${label} available`} title={`${label} available`}>
          <svg className="crew-doc-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8-11-8-11-8z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: "#00AA00" }} />
            <circle cx="12" cy="12" r="3" strokeWidth="2" style={{ stroke: "#00AA00" }} />
          </svg>
        </span>
      </div>
    </div>
  );
};

DocStatusIcon.propTypes = {
  available: PropTypes.bool,
  label: PropTypes.string.isRequired,
};

// One uploaded crew-list file's summary card — sourced directly from
// crew/get_immigration_crew_list's uploaded_crew_files, same visual language
// as CrewUploadedCard in CrewUploadedListsPanel (husbandry Crew Management).
// There's no per-file Preview/Replace here since crew/get_immigration_crew_list
// only accepts call_id — it can't scope to a single upload.
const UploadedCrewFileCard = ({ file }) => (
  <div className="crew-uploaded-card">
    <span className="crew-uploaded-card__icon" aria-hidden="true">
      <FileIcon />
    </span>
    <div className="crew-uploaded-card__details">
      <span className="crew-uploaded-card__title">Crew List</span>
      {file.crew_file_url ? (
        <a
          className="crew-uploaded-card__filename"
          href={file.crew_file_url}
          target="_blank"
          rel="noreferrer"
          title={file.crew_file}
        >
          {file.crew_file}
        </a>
      ) : (
        <div className="crew-uploaded-card__filename" title={file.crew_file}>{file.crew_file}</div>
      )}
      {file.uploaded_at && <div className="crew-uploaded-card__meta">Uploaded {file.uploaded_at}</div>}
      <span className="crew-uploaded-card__status crew-uploaded-card__status--success">Uploaded successfully</span>
    </div>
  </div>
);

UploadedCrewFileCard.propTypes = {
  file: PropTypes.shape({
    crew_excel_upload_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    crew_file: PropTypes.string,
    uploaded_at: PropTypes.string,
    crew_file_url: PropTypes.string,
  }).isRequired,
};

// Crew Immigration — crew document intake for the Operation section.
// There's no batch concept: the Crew List box can be used repeatedly to
// upload as many files as needed in one crew/import_crew_immigration call
// (which accepts {call_id, "files[]": [...]}) and then refreshing the
// combined list via crew/get_immigration_crew_list (which only accepts {call_id} —
// no pagination/search), so the Crew Listing table paginates/searches the
// full list in memory. Passport/iqama copies still reuse the existing Crew
// Management APIs via useCrewReducer.
const CrewImmigrationDashboard = ({ card, formValues, cardColor }) => {
  const uploadPassportCopies = useCrewReducer((state) => state.uploadPassportCopies);
  const uploadIqamaCopies = useCrewReducer((state) => state.uploadIqamaCopies);
  const uploadVisaCopies = useCrewReducer((state) => state.uploadVisaCopies);
  const updateCrewInfo = useCrewReducer((state) => state.updateCrewInfo);
  const deleteCrew = useCrewReducer((state) => state.deleteCrew);
  const importCrewImmigrationFile = useCrewImmigrationReducer((state) => state.importCrewImmigrationFile);
  const fetchCallCrewList = useCrewImmigrationReducer((state) => state.fetchCallCrewList);
  const uploadedCrewFiles = useCrewImmigrationReducer((state) => state.uploadedCrewFiles);
  const batchOptions = useCrewImmigrationReducer((state) => state.batchOptions);
  // Shared config for the passport/iqama/visa doc-copy upload actions —
  // both the top dropzones and the Crew Listing bulk actions use these.
  const docUploadConfig = {
    passport: { uploadAction: uploadPassportCopies, fileFieldName: "passports[]", label: "Passport" },
    iqama: { uploadAction: uploadIqamaCopies, fileFieldName: "iqamas[]", label: "Iqama" },
    visa: { uploadAction: uploadVisaCopies, fileFieldName: "visas[]", label: "Visa" },
  };
  const nationalities = useCommonReducer((state) => state.nationalities);
  const fetchAllNationalities = useCommonReducer((state) => state.fetchAllNationalities);
  const createCrewImmigrationBooking = useLaunchHireServiceReducer((state) => state.createCrewImmigrationBooking);

  const [uploadSteps, setUploadSteps] = useState(() => createUploadSteps());
  const [showCrewPreview, setShowCrewPreview] = useState(false);
  const [previewCrewRows, setPreviewCrewRows] = useState([]);

  const [listingSearch, setListingSearch] = useState("");
  const [debouncedListingSearch, setDebouncedListingSearch] = useState("");
  const [listingPage, setListingPage] = useState(1);
  const [listingCrewList, setListingCrewList] = useState([]);
  const [isListingLoading, setIsListingLoading] = useState(true);
  const [listingRefreshTick, setListingRefreshTick] = useState(0);
  const [listingSelectedIds, setListingSelectedIds] = useState([]);
  const [isUploadingPassports, setIsUploadingPassports] = useState(false);
  const [isUploadingIqamas, setIsUploadingIqamas] = useState(false);
  const [isUploadingVisas, setIsUploadingVisas] = useState(false);
  const listingPassportInputRef = useRef(null);
  const listingIqamaInputRef = useRef(null);
  const listingVisaInputRef = useRef(null);
  const [editingRowId, setEditingRowId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingRowId, setDeletingRowId] = useState(null);

  // "Request Launch Hire" inline panel — same pattern as CrewManagementDashboard.
  const [showLaunchHireForm, setShowLaunchHireForm] = useState(false);
  const [launchDate, setLaunchDate] = useState("");
  const [launchTime, setLaunchTime] = useState("");
  const [launchDateTimeError, setLaunchDateTimeError] = useState("");
  const [isSubmittingLaunchHire, setIsSubmittingLaunchHire] = useState(false);
  const [launchHireRequested, setLaunchHireRequested] = useState(false);
  const [launchHireEnabled, setLaunchHireEnabled] = useState(false);
  const [launchBatches, setLaunchBatches] = useState([]);
  const [launchLocation, setLaunchLocation] = useState("");

  const resolveCallAndVesselIds = useCallback(async () => {
    let resolvedCallId = Number(formValues?.call_id ?? formValues?.callId ?? card?.call_id ?? card?.callId);
    let resolvedVesselId = Number(formValues?.vessel_id ?? formValues?.vesselId ?? card?.vessel_id ?? card?.vesselId);

    if ((!resolvedCallId || !resolvedVesselId) && resolvedCallId) {
      try {
        const { data: callDetailResponse } = await callFileService.getCallDetail(resolvedCallId);
        const callDetailData =
          callDetailResponse?.data?.[0] || callDetailResponse?.data || callDetailResponse?.detail || callDetailResponse;
        if (!resolvedCallId) resolvedCallId = Number(callDetailData?.call_id ?? callDetailData?.id);
        if (!resolvedVesselId) resolvedVesselId = Number(callDetailData?.vessel_id);
      } catch {
        // resolvedCallId/resolvedVesselId stay unset — handled by callers
      }
    }

    return { resolvedCallId, resolvedVesselId };
  }, [formValues?.call_id, formValues?.callId, formValues?.vessel_id, formValues?.vesselId, card?.call_id, card?.callId, card?.vessel_id, card?.vesselId]);

  useEffect(() => {
    fetchAllNationalities();
  }, [fetchAllNationalities]);

  const nationalityOptions = useMemo(
    () =>
      (Array.isArray(nationalities) ? nationalities : []).map((item) => ({
        value: String(item.country_id),
        label: item.nationality,
      })),
    [nationalities]
  );

  // Fetches call detail to check the `launch_hire` flag — the "Request
  // Launch Hire" action only applies to calls the backend has flagged for it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { resolvedCallId } = await resolveCallAndVesselIds();
      if (cancelled || !resolvedCallId) return;
      try {
        const { data: callDetailResponse } = await callFileService.getCallDetail(resolvedCallId);
        const callDetailData =
          callDetailResponse?.data?.[0] || callDetailResponse?.data || callDetailResponse?.detail || callDetailResponse;
        if (!cancelled) setLaunchHireEnabled(Number(callDetailData?.launch_hire) === 1);
      } catch {
        // launchHireEnabled stays false — button remains hidden
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolveCallAndVesselIds]);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedListingSearch(listingSearch.trim()), 350);
    return () => clearTimeout(handle);
  }, [listingSearch]);

  useEffect(() => {
    setListingPage(1);
  }, [debouncedListingSearch]);

  // Also reconstructs upload state for a call reopened in a later session —
  // if any crew already exists for this call, mark the crew list step completed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { resolvedCallId } = await resolveCallAndVesselIds();
      if (cancelled || !resolvedCallId) return;
      setIsListingLoading(true);
      const list = await fetchCallCrewList({ payload: { call_id: resolvedCallId } });
      if (cancelled) return;
      const crewList = Array.isArray(list) ? list : [];
      setListingCrewList(crewList);
      setIsListingLoading(false);
      if (crewList.length > 0) {
        setUploadSteps((prev) =>
          prev.crewList.status === "completed"
            ? prev
            : { ...prev, crewList: { status: "completed", files: [{ name: "Crew List" }], progress: 100 } }
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolveCallAndVesselIds, fetchCallCrewList, listingRefreshTick]);

  // crew/get_immigration_crew_list has no server-side search or pagination
  // (call_id only), so both are done client-side over the full list.
  const filteredListingCrewList = useMemo(() => {
    const term = debouncedListingSearch.trim().toLowerCase();
    if (!term) return listingCrewList;
    return listingCrewList.filter((crew) => String(crew?.crew_name ?? "").toLowerCase().includes(term));
  }, [listingCrewList, debouncedListingSearch]);

  const totalListingPages = Math.max(1, Math.ceil(filteredListingCrewList.length / LISTING_PAGE_SIZE));
  const effectiveListingPage = Math.min(Math.max(listingPage, 1), totalListingPages);

  const pagedListingCrewList = useMemo(
    () => filteredListingCrewList.slice((effectiveListingPage - 1) * LISTING_PAGE_SIZE, effectiveListingPage * LISTING_PAGE_SIZE),
    [filteredListingCrewList, effectiveListingPage]
  );

  // Accepts one or more crew list files — crew/import_crew_immigration now
  // takes { call_id, "files[]": [...] }, so all files go up in a single
  // request/notification instead of one call per file.
  const handleCrewListFile = useCallback(
    async (fileList) => {
      const files = Array.isArray(fileList) ? fileList : Array.from(fileList || []);
      if (files.length === 0 || uploadSteps.crewList.status === "uploading") return;

      setUploadSteps((prev) => ({ ...prev, crewList: { ...prev.crewList, status: "uploading" } }));

      const { resolvedCallId } = await resolveCallAndVesselIds();
      if (!resolvedCallId) {
        setUploadSteps((prev) => ({ ...prev, crewList: { ...prev.crewList, status: "failed" } }));
        notify("Unable to upload: missing call information.", "error");
        return;
      }

      const formData = new FormData();
      formData.append("call_id", String(resolvedCallId));
      files.forEach((file) => formData.append("files[]", file));

      try {
        const importResult = await importCrewImmigrationFile({ formData });
        const totalCrewCount = extractImportedCrewCount(importResult);

        // Refetching also refreshes the store's uploadedCrewFiles/batchOptions from the API.
        setListingRefreshTick((tick) => tick + 1);

        setUploadSteps((prev) => ({
          ...prev,
          crewList: { status: "completed", files: files.map((f) => ({ name: f.name })), progress: 100 },
        }));
        notify(`Crew list uploaded — ${totalCrewCount} crew member(s) loaded.`, "success");
      } catch {
        setUploadSteps((prev) => ({ ...prev, crewList: { ...prev.crewList, status: "failed" } }));
        notify("Failed to upload crew list. Please try again.", "error");
      }
    },
    [uploadSteps, resolveCallAndVesselIds, importCrewImmigrationFile]
  );

  const handleDocCopyUpload = (kind) => async (fileList) => {
    if (uploadSteps.crewList.status !== "completed") return;
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    const { uploadAction, fileFieldName, label } = docUploadConfig[kind];

    setUploadSteps((prev) => ({ ...prev, [kind]: { ...prev[kind], status: "uploading" } }));

    const formData = new FormData();
    files.forEach((file) => formData.append(fileFieldName, file));

    try {
      await uploadAction({ formData });
      setUploadSteps((prev) => ({ ...prev, [kind]: { status: "completed", files, progress: 100 } }));
      setListingRefreshTick((tick) => tick + 1);
      notify(`${label} uploaded — ${files.length} file(s).`, "success");
    } catch {
      setUploadSteps((prev) => ({ ...prev, [kind]: { ...prev[kind], status: "failed" } }));
      notify(`Failed to upload ${label.toLowerCase()} copies. Please try again.`, "error");
    }
  };

  const handlePreviewCrew = async () => {
    setShowCrewPreview(true);
    const { resolvedCallId } = await resolveCallAndVesselIds();
    if (!resolvedCallId) {
      setPreviewCrewRows([]);
      return;
    }
    const list = await fetchCallCrewList({ payload: { call_id: resolvedCallId } });
    setPreviewCrewRows(
      Array.isArray(list)
        ? list.map((crew, index) => ({
            id: getCrewOptionId(crew, index),
            crewName: crew?.crew_name ?? "",
            nationality: crew?.nationality ?? "N/A",
            rank: crew?.rank ?? "",
          }))
        : []
    );
  };

  const handleClosePreview = () => {
    setShowCrewPreview(false);
    setPreviewCrewRows([]);
  };

  const listingRows = useMemo(
    () =>
      pagedListingCrewList.map((crew, index) => {
        const id = getCrewOptionId(crew, index);
        return {
          id,
          crewId: crew?.crew_id ?? crew?.crew_change_id ?? id,
          crewName: crew?.crew_name ?? "",
          dateOfBirth: crew?.date_of_birth ?? "",
          nationality: crew?.nationality ?? "N/A",
          rank: crew?.rank ?? "",
          passportOrIqama: hasDocumentUrl(crew?.passport_copy_url) || hasDocumentUrl(crew?.iqama_copy_url),
          visa: hasDocumentUrl(crew?.visa_copy_url),
          batchLabel: crew?.batchLabel || "Batch 1",
        };
      }),
    [pagedListingCrewList]
  );

  // Groups the current page's rows by batch so the table can show a
  // dynamic "Batch 1", "Batch 2"… header per batch instead of a flat list.
  const listingRowGroups = useMemo(() => {
    const groups = [];
    listingRows.forEach((row) => {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.label === row.batchLabel) {
        lastGroup.rows.push(row);
      } else {
        groups.push({ label: row.batchLabel, rows: [row] });
      }
    });
    return groups;
  }, [listingRows]);

  const handleListingRowToggle = (rowId) => {
    setListingSelectedIds((prev) => (prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId]));
  };

  const handleListingSelectAll = () => {
    setListingSelectedIds((prev) => (prev.length === listingRows.length ? [] : listingRows.map((row) => row.id)));
  };

  // Passport/Iqama/Visa bulk upload — real endpoints (crew/upload_passport_copies +
  // passports[], crew/upload_iqama_copies + iqamas[], crew/upload_visa_copies +
  // visas[]); refetches the listing afterwards so the doc icons reflect the real result.
  const listingBulkUploadSetters = {
    passport: setIsUploadingPassports,
    iqama: setIsUploadingIqamas,
    visa: setIsUploadingVisas,
  };

  const handleListingBulkCopyUpload = (kind) => async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;

    const setUploading = listingBulkUploadSetters[kind];
    const { uploadAction, fileFieldName, label } = docUploadConfig[kind];

    const formData = new FormData();
    files.forEach((file) => formData.append(fileFieldName, file));

    setUploading(true);
    try {
      await uploadAction({ formData });
      setListingRefreshTick((tick) => tick + 1);
      notify(`${label} uploaded — ${files.length} file(s).`, "success");
    } catch {
      notify(`Failed to upload ${label.toLowerCase()} copies. Please try again.`, "error");
    } finally {
      setUploading(false);
    }
  };

  const handleStartEdit = (row) => {
    setEditingRowId(row.id);
    const draft = Object.fromEntries(EDITABLE_LISTING_FIELDS.map((field) => [field, row[field]]));
    // The crew list only carries the nationality's display text, not its
    // country_id, so resolve the select's starting value by matching that
    // text against the fetched nationality options.
    const matchedNationality = nationalityOptions.find(
      (option) => option.label?.trim().toLowerCase() === String(row.nationality ?? "").trim().toLowerCase()
    );
    draft.nationality = matchedNationality?.value ?? "";
    setEditDraft(draft);
  };

  const handleCancelEdit = () => {
    setEditingRowId(null);
    setEditDraft(null);
  };

  const handleEditFieldChange = (field) => (e) => {
    const { value } = e.target;
    setEditDraft((prev) => ({ ...prev, [field]: value }));
  };

  // Persists inline Crew Listing edits via crew/update_crew, then refetches
  // crew/get_immigration_crew_list so the table reflects the saved values.
  const handleSaveEdit = async () => {
    if (!editingRowId || !editDraft) return;
    const row = listingRows.find((listingRow) => listingRow.id === editingRowId);
    const crewIdNum = Number(row?.crewId);
    if (!crewIdNum) {
      notify("Unable to save: missing crew id.", "error");
      return;
    }

    setIsSavingEdit(true);
    try {
      await updateCrewInfo({
        payload: {
          crew_id: crewIdNum,
          crew_name: editDraft.crewName,
          date_of_birth: editDraft.dateOfBirth,
          country_id: editDraft.nationality,
          rank: editDraft.rank,
        },
      });

      setListingRefreshTick((tick) => tick + 1);
      notify("Crew details updated.", "success");
      setEditingRowId(null);
      setEditDraft(null);
    } catch {
      // error already surfaced via notify in the store; keep editing state so the user can retry
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Deletes a crew member via crew/delete_crew/{crew_id}, then refetches the
  // listing so the removed crew member drops out of the table.
  const handleDeleteCrew = async (row) => {
    const crewIdNum = Number(row?.crewId);
    if (!crewIdNum) {
      notify("Unable to delete: missing crew id.", "error");
      return;
    }
    if (!window.confirm(`Remove ${row.crewName || "this crew member"} from the crew list?`)) return;

    setDeletingRowId(row.id);
    try {
      await deleteCrew({ crewId: crewIdNum });
      setListingSelectedIds((prev) => prev.filter((id) => id !== row.id));
      setListingRefreshTick((tick) => tick + 1);
      notify("Crew member removed.", "success");
    } catch {
      // error already surfaced via notify in the store
    } finally {
      setDeletingRowId(null);
    }
  };

  const handleCancelLaunchHire = () => {
    if (isSubmittingLaunchHire) return;
    setShowLaunchHireForm(false);
    setLaunchDate("");
    setLaunchTime("");
    setLaunchDateTimeError("");
    setLaunchBatches([]);
    setLaunchLocation("");
  };

  const handleLaunchHireButtonClick = () => {
    if (isSubmittingLaunchHire) return;
    if (showLaunchHireForm) {
      handleCancelLaunchHire();
    } else {
      setShowLaunchHireForm(true);
    }
  };

  const handleLaunchDateTimeChange = ({ date, time }) => {
    setLaunchDate(date);
    setLaunchTime(time);
    if (!date) return;
    const selected = new Date(`${date}T${time || "00:00"}`);
    if (!Number.isNaN(selected.getTime()) && selected.getTime() >= Date.now()) {
      setLaunchDateTimeError("");
    }
  };

  const handleSubmitLaunchHire = async () => {
    if (isSubmittingLaunchHire) return;
    if (launchBatches.length === 0) {
      setLaunchDateTimeError("Select at least one batch.");
      return;
    }
    if (!launchLocation) {
      setLaunchDateTimeError("Select a location.");
      return;
    }
    if (!launchDate) {
      setLaunchDateTimeError("Select a launch date and time.");
      return;
    }
    const selected = new Date(`${launchDate}T${launchTime || "00:00"}`);
    if (Number.isNaN(selected.getTime()) || selected.getTime() < Date.now()) {
      setLaunchDateTimeError("Launch date and time cannot be in the past.");
      return;
    }

    setIsSubmittingLaunchHire(true);
    try {
      const { resolvedCallId } = await resolveCallAndVesselIds();
      if (!resolvedCallId) {
        notify("Unable to submit: missing call information.", "error");
        return;
      }

      await createCrewImmigrationBooking({
        call_id: resolvedCallId,
        booking_datetime: buildApiDateTime(launchDate, launchTime),
        batches: launchBatches,
        location: launchLocation,
      });

      notify("Launch hire request submitted successfully.", "success");
      setShowLaunchHireForm(false);
      setLaunchDate("");
      setLaunchTime("");
      setLaunchDateTimeError("");
      setLaunchBatches([]);
      setLaunchLocation("");
      setLaunchHireRequested(true);
    } catch (err) {
      notify(err?.response?.data?.message ?? "Failed to submit launch hire request. Please try again.", "error");
    } finally {
      setIsSubmittingLaunchHire(false);
    }
  };

  const totalListingItems = filteredListingCrewList.length;
  const startListingItem = totalListingItems === 0 ? 0 : (effectiveListingPage - 1) * LISTING_PAGE_SIZE + 1;
  const endListingItem = totalListingItems === 0 ? 0 : Math.min(effectiveListingPage * LISTING_PAGE_SIZE, totalListingItems);

  const listingPaginationPages = useMemo(() => {
    const pages = [];
    const windowSize = 5;
    const start = Math.max(1, effectiveListingPage - 2);
    const end = Math.min(totalListingPages, start + windowSize - 1);
    const adjustedStart = Math.max(1, end - windowSize + 1);
    for (let i = adjustedStart; i <= end; i += 1) pages.push(i);
    return pages;
  }, [effectiveListingPage, totalListingPages]);

  const hasCallInfo = Boolean(formValues?.call_id ?? formValues?.callId ?? card?.call_id ?? card?.callId);

  return (
    <div className="husbandry-service-selection" style={{ "--card-color": cardColor }}>
      <div className="husbandry-service-selection-content">
        <div className="husbandry-service-hero">
          <div className="crew-mgmt-hero-row">
            <div className="crew-mgmt-hero-left">
              <div className="crew-mgmt-hero-text">
                <h2 className="husbandry-service-selection-title">Crew Immigration</h2>
              </div>

              <div className="crew-mgmt-hero-middle crew-immigration-batches">
                <div className="crew-mgmt-crewlist-block">
                  <CrewListUploadBox
                    movementType="crew-list"
                    movementTypeLabel="Crew List"
                    status={uploadSteps.crewList.status}
                    onSelectFile={handleCrewListFile}
                  />
                  <CrewUploadDropzones
                    steps={uploadSteps}
                    onSelectPassportFiles={handleDocCopyUpload("passport")}
                    onSelectIqamaFiles={handleDocCopyUpload("iqama")}
                    onSelectVisaFiles={handleDocCopyUpload("visa")}
                  />
                </div>
              </div>
            </div>

            <div className="crew-uploaded-lists-panel" style={{ "--card-color": cardColor }}>
              <div className="crew-uploaded-lists-panel__header">
                <span className="crew-mgmt-section-label">Uploaded Crew Lists</span>
                {uploadedCrewFiles.length > 0 && (
                  <button type="button" className="crew-uploaded-card__action" onClick={handlePreviewCrew}>
                    Preview
                  </button>
                )}
              </div>
              {uploadedCrewFiles.length === 0 ? (
                <div className="crew-uploaded-lists-panel__empty">
                  <span className="crew-uploaded-lists-panel__empty-title">No crew lists uploaded yet</span>
                  <span className="crew-uploaded-lists-panel__empty-subtitle">Upload a crew list to get started.</span>
                </div>
              ) : (
                <div className="crew-uploaded-lists-panel__stack crew-uploaded-lists-panel__stack--grid">
                  {uploadedCrewFiles.map((file) => (
                    <UploadedCrewFileCard key={file.crew_excel_upload_id ?? file.crew_file} file={file} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="crew-mgmt-summary-section">
          <div className="crew-listing-header">
            <div>
              <h2 className="crew-listing-title">Crew Listing</h2>
              <p className="crew-listing-subtitle">Crew documents uploaded so far.</p>
            </div>
            <div className="crew-summary-header-actions">
              {launchHireEnabled && (
                <div className="crew-launch-hire-trigger">
                  <button
                    type="button"
                    className="crew-header-btn crew-header-btn--launch-hire crew-header-btn--request-launch-hire"
                    disabled={!hasCallInfo}
                    aria-expanded={showLaunchHireForm}
                    title={!hasCallInfo ? "Call or vessel information is unavailable." : undefined}
                    onClick={handleLaunchHireButtonClick}
                  >
                    <FiNavigation size={14} aria-hidden="true" />
                    <span className="crew-header-btn__label">Request Launch Hire</span>
                  </button>
                  {launchHireRequested && (
                    <span className="crew-launch-hire-status-chip">
                      <FiCheck size={12} aria-hidden="true" />
                      Launch Hire Requested
                    </span>
                  )}
                </div>
              )}

              <div className="crew-summary-search">
                <FiSearch size={14} className="crew-summary-search__icon" />
                <input
                  type="text"
                  className="crew-summary-search__input"
                  placeholder="Search crew name"
                  value={listingSearch}
                  onChange={(e) => setListingSearch(e.target.value)}
                />
              </div>

              {listingSelectedIds.length > 0 && (
                <div className="crew-summary-bulk-actions">
                  <button
                    type="button"
                    className="crew-header-btn"
                    disabled={isUploadingPassports}
                    onClick={() => listingPassportInputRef.current?.click()}
                  >
                    <span className="crew-header-btn__label">
                      {isUploadingPassports ? "Uploading Passport…" : "Upload Passport"}
                    </span>
                  </button>
                  <input
                    ref={listingPassportInputRef}
                    type="file"
                    multiple
                    className="crew-doc-input"
                    onChange={handleListingBulkCopyUpload("passport")}
                  />
                  <button
                    type="button"
                    className="crew-header-btn"
                    disabled={isUploadingIqamas}
                    onClick={() => listingIqamaInputRef.current?.click()}
                  >
                    <span className="crew-header-btn__label">
                      {isUploadingIqamas ? "Uploading Iqama…" : "Upload Iqama"}
                    </span>
                  </button>
                  <input
                    ref={listingIqamaInputRef}
                    type="file"
                    multiple
                    className="crew-doc-input"
                    onChange={handleListingBulkCopyUpload("iqama")}
                  />
                  <button
                    type="button"
                    className="crew-header-btn"
                    disabled={isUploadingVisas}
                    onClick={() => listingVisaInputRef.current?.click()}
                  >
                    <span className="crew-header-btn__label">
                      {isUploadingVisas ? "Uploading Visa…" : "Upload Visa"}
                    </span>
                  </button>
                  <input
                    ref={listingVisaInputRef}
                    type="file"
                    multiple
                    className="crew-doc-input"
                    onChange={handleListingBulkCopyUpload("visa")}
                  />
                </div>
              )}
            </div>
          </div>

          <LaunchHireInlineForm
            open={showLaunchHireForm}
            cardColor={cardColor}
            dateValue={launchDate}
            timeValue={launchTime}
            error={launchDateTimeError}
            isSubmitting={isSubmittingLaunchHire}
            onDateTimeChange={handleLaunchDateTimeChange}
            onCancel={handleCancelLaunchHire}
            onSubmit={handleSubmitLaunchHire}
            selectValue={launchBatches}
            onSelectChange={setLaunchBatches}
            selectOptions={batchOptions}
            locationValue={launchLocation}
            onLocationChange={setLaunchLocation}
          />

          {isListingLoading && listingRows.length === 0 ? (
            <p className="crew-summary-empty">Loading crew…</p>
          ) : !isListingLoading && totalListingItems === 0 ? (
            <p className="crew-summary-empty">
              {debouncedListingSearch ? "No crew match your search." : "No crew uploaded yet. Upload a crew list to see it here."}
            </p>
          ) : (
            <div className="crew-table-wrapper">
              {listingRowGroups.length > 0 && (
                <div className="crew-batch-group-bar">{listingRowGroups[0].label}</div>
              )}
              <div className="table-wrapper table-responsive crew-table-container crew-table-scroll">
                <table className="table table-striped crew-table crew-immigration-listing-table" style={{ "--card-color": cardColor, tableLayout: "fixed", width: "100%" }}>
                  <thead>
                    <tr>
                      <th className="crew-checkbox-cell-header">
                        <input
                          className="crew-list-checkbox crew-list-checkbox--header"
                          type="checkbox"
                          checked={listingSelectedIds.length === listingRows.length && listingRows.length > 0}
                          onChange={handleListingSelectAll}
                        />
                      </th>
                      <th><span className="crew-th">Crew name</span></th>
                      <th><span className="crew-th">Date of birth</span></th>
                      <th><span className="crew-th">Nationality</span></th>
                      <th><span className="crew-th">Rank</span></th>
                      <th><span className="crew-th">Passport / Iqama</span></th>
                      <th><span className="crew-th">Visa</span></th>
                      <th><span className="crew-th">Action</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {listingRowGroups.map((group, groupIndex) => (
                      <Fragment key={group.label}>
                        {groupIndex > 0 && (
                          <tr className="crew-batch-group-row">
                            <td colSpan={8} className="crew-batch-group-row__label">{group.label}</td>
                          </tr>
                        )}
                        {group.rows.map((row) => {
                          const isEditing = editingRowId === row.id;
                          return (
                            <tr key={row.id} className={listingSelectedIds.includes(row.id) ? "crew-row-selected" : ""}>
                              <td className="crew-checkbox-cell">
                                <input
                                  className="crew-list-checkbox"
                                  type="checkbox"
                                  checked={listingSelectedIds.includes(row.id)}
                                  onChange={() => handleListingRowToggle(row.id)}
                                />
                              </td>
                              <td>
                                {isEditing ? (
                                  <input
                                    type="text"
                                    className="crew-edit-input"
                                    value={editDraft?.crewName ?? ""}
                                    onChange={handleEditFieldChange("crewName")}
                                  />
                                ) : (
                                  <div className="crew-table-cell crew-name-cell" title={row.crewName}>
                                    <span className="crew-name-info">
                                      <span className="crew-name-text">{row.crewName}</span>
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td>
                                {isEditing ? (
                                  <DatePickerField
                                    dateValue={editDraft?.dateOfBirth ?? ""}
                                    onDateChange={handleEditFieldChange("dateOfBirth")}
                                    dateFieldName="dateOfBirth"
                                    placeholder="Select DOB"
                                    maxDate={new Date()}
                                    className="crew-edit-date-field"
                                  />
                                ) : (
                                  <div className="crew-table-cell" title={row.dateOfBirth}>{row.dateOfBirth || "-"}</div>
                                )}
                              </td>
                              <td>
                                {isEditing ? (
                                  <select
                                    className="crew-edit-input crew-edit-select"
                                    value={editDraft?.nationality ?? ""}
                                    onChange={handleEditFieldChange("nationality")}
                                  >
                                    <option value="">Select nationality</option>
                                    {nationalityOptions.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <div className="crew-table-cell" title={row.nationality}>{row.nationality}</div>
                                )}
                              </td>
                              <td>
                                {isEditing ? (
                                  <input
                                    type="text"
                                    className="crew-edit-input"
                                    value={editDraft?.rank ?? ""}
                                    onChange={handleEditFieldChange("rank")}
                                  />
                                ) : (
                                  <div className="crew-table-cell" title={row.rank}>{row.rank}</div>
                                )}
                              </td>
                              <td><DocStatusIcon available={row.passportOrIqama} label="Passport / Iqama" /></td>
                              <td><DocStatusIcon available={row.visa} label="Visa" /></td>
                              <td>
                                <div className="crew-table-cell crew-action-cell">
                                  {isEditing ? (
                                    <>
                                      <button
                                        type="button"
                                        className="crew-action-btn crew-action-btn--save"
                                        aria-label="Save changes"
                                        title="Save"
                                        disabled={isSavingEdit}
                                        onClick={handleSaveEdit}
                                      >
                                        {isSavingEdit ? (
                                          <span className="crew-action-btn__spinner" aria-hidden="true" />
                                        ) : (
                                          <FiCheck size={14} />
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        className="crew-action-btn crew-action-btn--cancel"
                                        aria-label="Cancel editing"
                                        title="Cancel"
                                        disabled={isSavingEdit}
                                        onClick={handleCancelEdit}
                                      >
                                        <FiX size={14} />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        className="crew-action-btn crew-action-btn--edit"
                                        aria-label="Edit crew"
                                        title="Edit"
                                        disabled={deletingRowId === row.id}
                                        onClick={() => handleStartEdit(row)}
                                      >
                                        <FiEdit2 size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        className="crew-action-btn crew-action-btn--delete"
                                        aria-label="Delete crew"
                                        title="Delete"
                                        disabled={deletingRowId === row.id}
                                        onClick={() => handleDeleteCrew(row)}
                                      >
                                        {deletingRowId === row.id ? (
                                          <span className="crew-action-btn__spinner" aria-hidden="true" />
                                        ) : (
                                          <FiTrash2 size={14} />
                                        )}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="crew-pagination">
                <div className="crew-pagination-info">
                  Showing <strong>{startListingItem}–{endListingItem}</strong> of {totalListingItems} crew members
                  {isListingLoading ? " (refreshing…)" : ""}
                </div>
                <div className="crew-pagination-actions">
                  <button
                    type="button"
                    className="crew-pagination-btn crew-pagination-btn--icon"
                    aria-label="Previous page"
                    disabled={effectiveListingPage <= 1}
                    onClick={() => setListingPage((prev) => Math.max(1, prev - 1))}
                  >
                    <FiChevronLeft size={16} />
                  </button>
                  {listingPaginationPages.map((pageNum) => (
                    <button
                      key={pageNum}
                      type="button"
                      className={`crew-pagination-btn${pageNum === effectiveListingPage ? " active" : ""}`}
                      onClick={() => setListingPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="crew-pagination-btn crew-pagination-btn--icon"
                    aria-label="Next page"
                    disabled={effectiveListingPage >= totalListingPages}
                    onClick={() => setListingPage((prev) => Math.min(totalListingPages, prev + 1))}
                  >
                    <FiChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <CrewUploadPreviewModal
        show={showCrewPreview}
        movementTypeLabel="All"
        crewRows={previewCrewRows}
        cardColor={cardColor}
        onClose={handleClosePreview}
      />
    </div>
  );
};

CrewImmigrationDashboard.propTypes = {
  card: PropTypes.object,
  formValues: PropTypes.object.isRequired,
  cardColor: PropTypes.string,
};

export default CrewImmigrationDashboard;
