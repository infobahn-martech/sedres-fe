import { useState, useRef, useEffect, Fragment } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import CustomModal from "@/components/CustomModal";
import DeleteConfirmationModal from "@/components/DeleteConfirmationModal";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import GroupSettingsIcon from "@/assets/images/cv.png";
import {
  FormField,
  FormInput,
  FormSelect,
  ReactQuillEditor,
  FormSection,
  FormGroup,
  FieldRow,
  FieldError,
  CheckboxField,
  PremiumCardHeader,
} from "./Husbandry.components";
import {
  validateDocumentFiles,
  MAIN_TABS,
  SERVICE_ACCENT,
  MATERIAL_DOCUMENT_ACCEPT,
  MATERIAL_DOCUMENT_HELPER,
} from "./Husbandry.constants";
import ServiceAttachmentsList from "../../appointment/AttachmentsList";
import DateTimePickerField from "@/pages/KanbanBoard/CardFormTabs/shared/components/DateTimePickerField";
import LocationAutocomplete from "./LocationAutocomplete";
import MaterialTablePagination from "./MaterialTablePagination";
import editIcon from "@/assets/images/edit.svg";
import deleteIcon from "@/assets/images/delete.svg";
import eyeIcon from "@/assets/images/eye.svg";
import printIcon from "@/assets/images/print.svg";
import useDispatchNoteReducer from "@/store/DispatchNoteReducer";
import useAlertReducer from "@/store/AlertReducer";
import CardTabListLoading from "@/components/CardTabListLoading";
import logisticsWarehouseService from "@/services/logisticsWarehouseService";
import usePermissions from "@/shared/hooks/usePermissions";
import { PERMISSION_MODULES, PERMISSION_SUBMODULES, PERMISSION_ACTIONS } from "@/shared/constants/permissions";
import vehicleService from "@/services/vehicleService";
import inboundOrderService from "@/services/inboundOrderService";
import landingNoteService from "@/services/landingNoteService";
import { nextDayOf } from "@/shared/helpers/dateTimeFieldUtils";
import "@/design/scss/dispatch-note.scss";

const MATERIAL_ACCENT = SERVICE_ACCENT[MAIN_TABS.MATERIAL_MANAGEMENT];

const isTruthyFlag = (value) => value === true || Number(value) === 1 || String(value).toLowerCase() === "true";

const normalizeSlotValue = (value) => {
  if (value == null || value === "") return "";
  const raw = String(value).trim();
  if (/^slot\s+[1-6]$/i.test(raw)) return raw.replace(/^slot\s+/i, "Slot ");
  if (/^[1-6]$/.test(raw)) return `Slot ${raw}`;
  return raw;
};

const launchHireStatusTone = (status) => {
  const raw = String(status ?? "").trim().toLowerCase();
  if (raw === "completed" || raw === "done") return "done";
  if (raw === "cancelled" || raw === "rejected") return "cancelled";
  if (raw === "pending" || raw === "requested") return "pending";
  return "default";
};

const getTransportation = (item) => item?.transportation || item?.transport || null;

const getFileUrl = (filePath) => {
  const base = (import.meta.env.VITE_API_ENDPOINT || "").replace(/\/+$/, "");
  const path = (filePath || "").replace(/^\/+/, "");
  return `${base}/${path}`;
};

const isImageFile = (fileName) => /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName || "");

const mergeOptionForValue = (options, value) => {
  if (value == null || value === "") return options;
  const s = String(value);
  if (options.some((o) => o.value === s)) return options;
  return [...options, { value: s, label: s }];
};

const emptyEditItem = (id = 1) => ({
  id,
  landing_note_item_id: null,
  dispatch_note_item_id: null,
  quantity: "",
  maxQty: null,
  slot: "",
  reason: "",
  packing_required: false,
  packing_required_original: false,
  repacking_pallets: "",
  repacking_rolls: "",
  transportation_required: false,
  transportation_required_original: false,
  typeOfVehicle: "",
  fromLocation: "",
  pickUpFrom: "",
  toLocation: "",
  driverName: "",
  transportRemarks: "",
});

const DispatchNoteContent = ({ formValues, cardColor }) => {
  const { hasPermission } = usePermissions();
  // KANBAN_CARD > MATERIAL_MANAGEMENT per-action gates — absence of the
  // module/submodule/action in the permissions response means false (deny by
  // default).
  const canUpdateDispatchNote = hasPermission({
    moduleKey: PERMISSION_MODULES.KANBAN_CARD,
    submoduleKey: PERMISSION_SUBMODULES.MATERIAL_MANAGEMENT,
    actionKey: PERMISSION_ACTIONS.UPDATE_DISPATCH_NOTE,
  });
  const canDeleteDispatchNote = hasPermission({
    moduleKey: PERMISSION_MODULES.KANBAN_CARD,
    submoduleKey: PERMISSION_SUBMODULES.MATERIAL_MANAGEMENT,
    actionKey: PERMISSION_ACTIONS.DELETE_DISPATCH_NOTE,
  });
  const canPrintDispatchNote = hasPermission({
    moduleKey: PERMISSION_MODULES.KANBAN_CARD,
    submoduleKey: PERMISSION_SUBMODULES.MATERIAL_MANAGEMENT,
    actionKey: PERMISSION_ACTIONS.PRINT_DISPATCH_NOTE,
  });
  const {
    getAllDispatchNotes,
    getDispatchNotesTotal,
    getDispatchNoteById,
    updateDispatchNote,
    printDispatchNote,
    deleteDispatchNote,
    dispatchNotes,
    dispatchTotal,
    isLoadingList,
    isLoadingDetail,
    isLoadingUpdate,
    isLoadingDelete,
  } = useDispatchNoteReducer((state) => state);

  const [warehouseOptions, setWarehouseOptions] = useState([]);
  const [vehicleOptions, setVehicleOptions] = useState([]);
  const [driverOptions, setDriverOptions] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);

  const formBodyRef = useRef(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [notesList, setNotesList] = useState([]);
  const [editingNote, setEditingNote] = useState(null);
  const [viewingNote, setViewingNote] = useState(null);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const dropdownButtonRefs = useRef({});
  const [dispatchPage, setDispatchPage] = useState(1);
  const DISPATCH_LIMIT = 10;

  const [printingNoteId, setPrintingNoteId] = useState(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingNote, setDeletingNote] = useState(null);

  const [editFormErrors, setEditFormErrors] = useState({});
  const [editMinDate, setEditMinDate] = useState(undefined);
  const [editorKey, setEditorKey] = useState(0);
  const [expandedEditItems, setExpandedEditItems] = useState({ 1: true });
  const [editItems, setEditItems] = useState([emptyEditItem(1)]);
  const [editLaunchHire, setEditLaunchHire] = useState(null);
  const [isDraggingDocuments, setIsDraggingDocuments] = useState(false);
  const [removedDocumentIds, setRemovedDocumentIds] = useState([]);
  const documentsFileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    landing_note_id: "",
    warehouse_id: "",
    dispatch_date: "",
    dispatch_time: "",
    signature: "",
    delivery_location: "",
    delivered_to: "",
    remarks: "",
    documents: [],
  });

  const slotOptions = [
    { value: "Slot 1", label: "Slot 1" },
    { value: "Slot 2", label: "Slot 2" },
    { value: "Slot 3", label: "Slot 3" },
    { value: "Slot 4", label: "Slot 4" },
    { value: "Slot 5", label: "Slot 5" },
    { value: "Slot 6", label: "Slot 6" },
  ];

  const reasonOptions = [
    { value: "Scrap", label: "Scrap" },
    { value: "Wrong supply", label: "Wrong supply" },
    { value: "Safe storage", label: "Safe storage" },
    { value: "Service", label: "Service" },
    { value: "Transit", label: "Transit" },
  ];

  useEffect(() => {
    const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);
    if (callId) {
      getAllDispatchNotes({ call_id: callId, page: dispatchPage, limit: DISPATCH_LIMIT });
    }
  }, [formValues?.call_id, formValues?.callId, formValues?.card_call_id, dispatchPage]);

  useEffect(() => {
    if (Array.isArray(dispatchNotes)) {
      setNotesList(dispatchNotes.map((note) => {
        const firstItem = Array.isArray(note.items) && note.items.length > 0 ? note.items[0] : {};
        return {
          ...note,
          id: note.dispatch_note_id || note.id,
          orderNo: note.dispatch_note_no || note.orderNo || "",
          date: note.dispatch_date || note.date || "",
          poDo: firstItem.po_no || note.po_no || note.poDo || "",
          deliveryProof: note.document ? [note.document] : (note.documents || []),
          quantity: firstItem.quantity ?? note.quantity ?? "",
          packageType: firstItem.package_type || note.package_type || note.packageType || "",
          description: firstItem.description || note.description || "",
          items: note.items || [],
        };
      }));
    }
  }, [dispatchNotes]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [whRes, vehRes, drvRes, trLocRes] = await Promise.all([
          logisticsWarehouseService.getWarehouseLocations(),
          vehicleService.getMaterialVehicles(),
          vehicleService.getMaterialDrivers(),
          inboundOrderService.getMaterialTransportLocations(),
        ]);
        if (cancelled) return;
        const whRows = Array.isArray(whRes?.data) ? whRes.data : whRes?.data?.data ?? [];
        setWarehouseOptions(whRows.map((r) => ({ value: String(r.location_id ?? ""), label: String(r.location ?? "") })).filter((o) => o.value));
        const vehRows = Array.isArray(vehRes?.data) ? vehRes.data : vehRes?.data?.data ?? [];
        setVehicleOptions(vehRows.map((r) => ({ value: String(r.vehicle_type_id ?? ""), label: String(r.vehicle_name ?? "") })).filter((o) => o.value));
        const drvRows = Array.isArray(drvRes?.data) ? drvRes.data : drvRes?.data?.data ?? [];
        setDriverOptions(drvRows.map((r) => ({ value: String(r.driver_id ?? ""), label: String(r.driver_name ?? "") })).filter((o) => o.value));
        const trLocRows = Array.isArray(trLocRes?.data) ? trLocRes.data : trLocRes?.data?.data ?? [];
        setLocationOptions(trLocRows.map((r) => ({ value: String(r.location_id ?? ""), label: String(r.location ?? "") })).filter((o) => o.value));
      } catch {
        // reference data load failure is non-critical
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const resetForm = () => {
    setFormData({ landing_note_id: "", warehouse_id: "", dispatch_date: "", dispatch_time: "", signature: "", delivery_location: "", delivered_to: "", remarks: "", documents: [] });
    setEditItems([emptyEditItem(1)]);
    setEditLaunchHire(null);
    setExpandedEditItems({ 1: true });
    setEditFormErrors({});
    setRemovedDocumentIds([]);
  };

  // Loads a dispatch note into the left-hand edit card.
  const handleEditNote = (note) => {
    if (!note || !canUpdateDispatchNote) return;
    setEditingNote(note);
    resetForm();
    setEditMinDate(undefined);
    formBodyRef.current?.scrollTo?.({ top: 0, behavior: "smooth" });
    getDispatchNoteById({
      id: note.id || note.dispatch_note_id,
      cb: (detail) => {
        if (!detail) return;
        const [datePart, timePart] = (detail.dispatch_date || "").split(" ");
        setEditorKey((k) => k + 1);
        if (detail.landing_note_id) {
          landingNoteService.getLandingNoteById(detail.landing_note_id)
            .then(({ data }) => {
              const landingDetail = data?.data;
              const minDate = nextDayOf(landingDetail?.landing_date || landingDetail?.date);
              if (minDate) setEditMinDate(minDate);
            })
            .catch(() => {});
        }
        setFormData({
          landing_note_id: String(detail.landing_note_id || ""),
          warehouse_id: String(detail.warehouse_id || ""),
          dispatch_date: datePart || "",
          dispatch_time: timePart || "",
          signature: detail.signature || "",
          delivery_location: detail.delivery_location || "",
          delivered_to: detail.delivered_to || "",
          remarks: detail.remarks || "",
          documents: Array.isArray(detail.documents) ? detail.documents : [],
        });
        setEditLaunchHire(detail.launch_hire || null);
        const apiItems = Array.isArray(detail.items) ? detail.items : [];
        const mapped = apiItems.length > 0
          ? apiItems.map((item, idx) => {
              const transport = getTransportation(item);
              const hasTransportData = Boolean(transport && (
                transport.vehicle_type_id || transport.from_location_id ||
                transport.to_location_id || transport.driver_id || transport.pickup_location
              ));
              const remainingQtyRaw = item.remaining_qty;
              const hasRemainingQty = remainingQtyRaw !== undefined && remainingQtyRaw !== null && remainingQtyRaw !== "";
              const maxQty = hasRemainingQty ? Number(remainingQtyRaw) : (item.quantity ? Number(item.quantity) : null);
              return {
                id: idx + 1,
                landing_note_item_id: item.landing_note_item_id || null,
                dispatch_note_item_id: item.dispatch_note_item_id || null,
                quantity: String(item.quantity ?? ""),
                maxQty,
                slot: normalizeSlotValue(item.slot ?? item.slot_no ?? item.slot_no_id),
                reason: (item.reason || "").trim(),
                packing_required: isTruthyFlag(item.packing_required),
                packing_required_original: isTruthyFlag(item.packing_required),
                repacking_pallets: String(item.repacking_pallets ?? ""),
                repacking_rolls: String(item.repacking_rolls ?? ""),
                transportation_required: isTruthyFlag(item.transportation_required) || hasTransportData,
                transportation_required_original: isTruthyFlag(item.transportation_required) || hasTransportData,
                typeOfVehicle: transport ? String(transport.vehicle_type_id || "") : "",
                fromLocation: transport ? String(transport.from_location_id || "") : "",
                pickUpFrom: transport?.pickup_location || "",
                toLocation: transport ? String(transport.to_location_id || "") : "",
                driverName: transport ? String(transport.driver_id || "") : "",
                transportRemarks: transport?.remarks || "",
              };
            })
          : [emptyEditItem(1)];
        setEditItems(mapped);
        const expanded = {};
        mapped.forEach((item) => { expanded[item.id] = true; });
        setExpandedEditItems(expanded);
        setEditorKey((k) => k + 1);
      },
    });
  };

  // Exits edit mode and returns the card to its idle state.
  const resetEditForm = () => {
    setEditingNote(null);
    resetForm();
    setEditMinDate(undefined);
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setEditFormErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  };

  const handleEditItemChange = (itemId, field, value) => {
    setEditItems((prev) => prev.map((item) => item.id === itemId ? { ...item, [field]: value } : item));
  };

  const handleNonNegativeIntegerChange = (itemId, field, value) => {
    if (value === "" || /^\d+$/.test(value)) handleEditItemChange(itemId, field, value);
  };

  const toggleEditItemExpand = (itemId) => {
    setExpandedEditItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleDocumentsDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingDocuments(true); };
  const handleDocumentsDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingDocuments(false); };
  const handleDocumentsDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const addDocumentFiles = (files) => {
    const { validFiles, rejectedFiles } = validateDocumentFiles(files);
    if (rejectedFiles.length > 0) {
      const { error: showError } = useAlertReducer.getState();
      showError(rejectedFiles.map((f) => `"${f.name}" — ${f.reason}`).join("; "));
    }
    if (validFiles.length > 0) setFormData((prev) => ({ ...prev, documents: [...(prev.documents || []), ...validFiles.map((f) => ({ name: f.name, file: f, size: f.size }))] }));
  };
  const handleDocumentsDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setIsDraggingDocuments(false);
    addDocumentFiles(Array.from(e.dataTransfer.files || []));
  };
  const handleDocumentsFileInputChange = (e) => {
    addDocumentFiles(Array.from(e.target.files || []));
    if (documentsFileInputRef.current) documentsFileInputRef.current.value = "";
  };
  const handleDocumentsRemove = (index) => {
    setFormData((prev) => {
      const docs = prev.documents || [];
      const removed = docs[index];
      if (removed && !(removed.file instanceof File)) {
        const docId = removed.material_document_id ?? removed.document_id ?? removed.id;
        if (docId != null) setRemovedDocumentIds((ids) => [...ids, docId]);
      }
      return { ...prev, documents: docs.filter((_, i) => i !== index) };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canUpdateDispatchNote) return;
    if (!editingNote) return;

    const errors = {};
    if (!formData.dispatch_date) errors.dispatch_date = "Date is required";
    if (!formData.warehouse_id) errors.warehouse_id = "Warehouse is required";
    if (!formData.delivery_location) errors.delivery_location = "Delivery location is required";
    if (!formData.delivered_to) errors.delivered_to = "Delivered to is required";
    editItems.forEach((item, idx) => {
      if (!item.quantity) errors[`item${idx}_quantity`] = "Quantity is required";
      else if (item.maxQty != null && Number(item.quantity) > item.maxQty) errors[`item${idx}_quantity`] = `Quantity cannot exceed available quantity (${item.maxQty})`;
      if (item.transportation_required && !item.pickUpFrom) errors[`item${idx}_pickup`] = "Pick-up from is required";
    });
    if (Object.keys(errors).length > 0) { setEditFormErrors(errors); return; }

    const fd = new FormData();
    const dispatchNoteId = editingNote.id || editingNote.dispatch_note_id;
    const dispatchDate = formData.dispatch_date + (formData.dispatch_time ? ` ${formData.dispatch_time}` : "");
    if (formData.landing_note_id) fd.append("landing_note_id", formData.landing_note_id);
    fd.append("warehouse_id", formData.warehouse_id || "");
    fd.append("dispatch_date", dispatchDate);
    fd.append("signature", formData.signature || "");
    fd.append("delivery_location", formData.delivery_location || "");
    fd.append("delivered_to", formData.delivered_to || "");
    fd.append("remarks", (formData.remarks || "").replace(/<[^>]*>/g, "").trim());
    const newFiles = (formData.documents || []).filter((d) => d.file instanceof File);
    newFiles.forEach((d) => fd.append("file[]", d.file));
    removedDocumentIds.forEach((id) => fd.append("removed_document_ids[]", id));

    const items = editItems.map((item) => {
      const obj = {
        dispatch_note_item_id: item.dispatch_note_item_id || null,
        landing_note_item_id: item.landing_note_item_id || null,
        quantity: Number(item.quantity) || 0,
        slot: item.slot || "",
        reason: item.reason || "",
        packing_required: item.packing_required ? 1 : 0,
        repacking_pallets: item.packing_required ? (parseInt(item.repacking_pallets) || 0) : 0,
        repacking_rolls: item.packing_required ? (parseInt(item.repacking_rolls) || 0) : 0,
        transportation_required: item.transportation_required ? 1 : 0,
      };
      if (item.transportation_required) {
        obj.transportation = {
          vehicle_type_id: Number(item.typeOfVehicle) || 0,
          from_location_id: Number(item.fromLocation) || 0,
          pickup_location: item.pickUpFrom || "",
          to_location_id: Number(item.toLocation) || 0,
          driver_id: Number(item.driverName) || 0,
          remarks: item.transportRemarks || "",
        };
      }
      return obj;
    });
    fd.append("items", JSON.stringify(items));

    const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);
    updateDispatchNote({
      dispatchNoteId,
      data: fd,
      cb: () => {
        resetEditForm();
        if (callId) {
          getAllDispatchNotes({ call_id: callId, page: dispatchPage, limit: DISPATCH_LIMIT });
          getDispatchNotesTotal({ call_id: callId });
        }
      },
    });
  };

  const handleDelete = (note) => {
    if (!canDeleteDispatchNote) return;
    setDeletingNote(note);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    if (!deletingNote) return;
    const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);
    deleteDispatchNote({
      dispatchNoteId: deletingNote.id,
      cb: () => {
        setShowDeleteModal(false);
        // Drop out of edit mode if the note being edited was deleted.
        if (editingNote && editingNote.id === deletingNote.id) {
          resetEditForm();
        }
        setDeletingNote(null);
        if (callId) {
          getAllDispatchNotes({ call_id: callId, page: dispatchPage, limit: DISPATCH_LIMIT });
          getDispatchNotesTotal({ call_id: callId });
        }
      },
    });
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setDeletingNote(null);
  };

  const handleToggleDropdown = (noteId, e) => {
    e.stopPropagation();
    if (openDropdownId === noteId) {
      setOpenDropdownId(null);
    } else {
      const button = e.currentTarget;
      const rect = button.getBoundingClientRect();
      setDropdownPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
      dropdownButtonRefs.current[noteId] = button;
      setOpenDropdownId(noteId);
    }
  };

  const handleCloseDropdown = () => setOpenDropdownId(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.action-dropdown-wrapper') && !event.target.closest('[data-dropdown-menu]')) {
        setOpenDropdownId(null);
      }
    };
    const handleScroll = () => setOpenDropdownId(null);
    if (openDropdownId) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [openDropdownId]);

  const handleViewNote = (note) => {
    handleCloseDropdown();
    setViewingNote(note);
    setShowViewModal(true);
    getDispatchNoteById({
      id: note.id || note.dispatch_note_id,
      cb: (detail) => { if (detail) setViewingNote(detail); },
    });
  };

  const handleCloseViewModal = () => {
    setShowViewModal(false);
    setViewingNote(null);
  };

  const handlePrintNote = (note) => {
    if (!canPrintDispatchNote) return;
    handleCloseDropdown();
    const noteId = note.dispatch_note_id || note.id;
    if (printingNoteId) return;
    setPrintingNoteId(noteId);
    const doPrint = (landingNoteId) => {
      printDispatchNote({
        dispatchNoteId: noteId,
        landingNoteId,
        cb: (pdfUrl) => {
          setPrintingNoteId(null);
          if (pdfUrl) window.open(pdfUrl, '_blank');
        },
      });
    };
    if (note.landing_note_id) {
      doPrint(note.landing_note_id);
    } else {
      getDispatchNoteById({
        id: noteId,
        cb: (detail) => doPrint(detail?.landing_note_id || null),
      });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", { year: "numeric", month: "2-digit", day: "2-digit" });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(String(dateString).replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleString("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const renderLaunchHireStepIcon = (icon) => {
    switch (icon) {
      case "clock":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
            <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case "pin":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22s7-7.05 7-12a7 7 0 1 0-14 0c0 4.95 7 12 7 12Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
          </svg>
        );
      case "flag":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 21V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M5 4h13l-3 4 3 4H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case "note":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M9 12h6M9 16h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
      case "check":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case "cross":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case "hash":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case "calendar":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M8 3v4M16 3v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
      case "building":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 21V10l9-6 9 6v11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 21v-6h6v6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        );
      case "user":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
            <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
      case "signature":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 17c2-1 3-4 4-6 1.5-3 2.5-4 3.5-1 .6 1.7 1.5 1.8 2.5 0 1-1.8 2-1.8 3 0s2 2 4.5-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 20h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
      case "list":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case "package":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 8l-9-5-9 5 9 5 9-5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 8v8l9 5 9-5V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 13v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
      case "box":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 7h16v13H4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M4 7l3-4h10l3 4M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case "truck":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 8h11v8H2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M13 11h4l3 3v2h-7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="6" cy="18" r="1.8" stroke="currentColor" strokeWidth="2" />
            <circle cx="17" cy="18" r="1.8" stroke="currentColor" strokeWidth="2" />
          </svg>
        );
      case "target":
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="0.6" fill="currentColor" />
          </svg>
        );
      default:
        return null;
    }
  };

  const launchHireStatusIcon = (tone) => {
    if (tone === "done") return "check";
    if (tone === "cancelled") return "cross";
    if (tone === "pending") return "clock";
    return "flag";
  };

  const editingNoteLabel = editingNote?.dispatch_note_no || editingNote?.orderNo || "";

  // Left-hand edit card body (was the Edit modal body).
  const renderFormBody = () => (
        <form id="dispatchNoteForm" className="dispatch-note-edit-form material-note-card-form" onSubmit={handleSubmit}>

          <FormGroup icon="calendar" label="Basic Details" accent={MATERIAL_ACCENT}>
            <FieldRow>
              <FormField label="Dispatch Date *">
                <div className="transport-date-time-field">
                  <DateTimePickerField
                    dateValue={formData.dispatch_date}
                    timeValue={formData.dispatch_time}
                    onDateTimeChange={(v) => {
                      setFormData((p) => ({ ...p, dispatch_date: v.date, dispatch_time: v.time }));
                      setEditFormErrors((p) => { const n = { ...p }; delete n.dispatch_date; return n; });
                    }}
                    dateFieldName="dispatch_date"
                    timeFieldName="dispatch_time"
                    placeholder="Select date and time"
                    minDate={editMinDate}
                  />
                </div>
                <FieldError message={editFormErrors.dispatch_date} />
              </FormField>

              <FormField label="Warehouse *">
                <FormSelect
                  value={formData.warehouse_id}
                  onChange={(e) => handleFormChange("warehouse_id", e.target.value)}
                  options={mergeOptionForValue(warehouseOptions, formData.warehouse_id)}
                  placeholder="Select warehouse..."
                />
                <FieldError message={editFormErrors.warehouse_id} />
              </FormField>
            </FieldRow>

            <FieldRow>
              <FormField label="Delivery Location *">
                <FormInput
                  type="text"
                  value={formData.delivery_location}
                  onChange={(e) => handleFormChange("delivery_location", e.target.value)}
                  placeholder="Enter delivery location..."
                />
                <FieldError message={editFormErrors.delivery_location} />
              </FormField>

              <FormField label="Delivered To *">
                <FormInput
                  type="text"
                  value={formData.delivered_to}
                  onChange={(e) => handleFormChange("delivered_to", e.target.value)}
                  placeholder="Enter person name..."
                />
                <FieldError message={editFormErrors.delivered_to} />
              </FormField>
            </FieldRow>

            <FormField label="Signature">
              <FormInput
                type="text"
                value={formData.signature}
                onChange={(e) => handleFormChange("signature", e.target.value)}
                placeholder="Enter signature..."
              />
            </FormField>
          </FormGroup>

          {editLaunchHire && (
            <FormGroup icon="LAUNCH_HIRE" label="Launch Hire" accent={MATERIAL_ACCENT}>
              <div className="dispatch-launch-hire-card">
                <div className="dispatch-launch-hire-steps">
                  {(() => {
                    const isCompleted = launchHireStatusTone(editLaunchHire.status) === "done";
                    return [
                      { key: "booking", icon: "clock", label: "Booking Date/Time", value: formatDateTime(editLaunchHire.booking_datetime) || "-" },
                      { key: "location", icon: "pin", label: "Location", value: editLaunchHire.location || "-" },
                      { key: "status", icon: "flag", label: "Status", value: editLaunchHire.status || "-", tone: launchHireStatusTone(editLaunchHire.status) },
                      ...(editLaunchHire.remarks ? [{ key: "remarks", icon: "note", label: "Remarks", value: editLaunchHire.remarks }] : []),
                      {
                        key: "completed",
                        icon: "check",
                        label: "Completed",
                        value: isCompleted ? "Done" : "Pending",
                        tone: isCompleted ? "done" : undefined,
                        empty: !isCompleted,
                      },
                    ];
                  })().map((step, index) => (
                    <div
                      key={step.key}
                      className={`dispatch-launch-hire-step${step.empty ? " dispatch-launch-hire-step--empty" : ""}`}
                      style={{ "--stagger-index": index }}
                    >
                      <span className="dispatch-launch-hire-step-icon-wrap">
                        <span className={`dispatch-launch-hire-step-icon${step.tone ? ` dispatch-launch-hire-step-icon--${step.tone}` : ""}`}>
                          {renderLaunchHireStepIcon(step.icon)}
                        </span>
                        <span className="dispatch-launch-hire-step-num">{index + 1}</span>
                      </span>
                      <span className="dispatch-launch-hire-step-body">
                        <span className="dispatch-launch-hire-step-label">{step.label}</span>
                        <span className="dispatch-launch-hire-step-value">{step.value}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </FormGroup>
          )}

          <FormGroup icon="list" label="Items" accent={MATERIAL_ACCENT}>
            {isLoadingDetail ? (
              <CardTabListLoading message="Loading items..." cardColor={cardColor} />
            ) : (
              editItems.map((item, index) => (
                <div key={item.id} className="dispatch-edit-item-card material-item-card">
                  <div className="dispatch-edit-item-header" onClick={() => toggleEditItemExpand(item.id)}>
                    <span className="dispatch-edit-item-label">Item {index + 1}</span>
                    <svg
                      width="18" height="18" viewBox="0 0 24 24" fill="none"
                      className={`dispatch-edit-chevron${expandedEditItems[item.id] ? " expanded" : ""}`}
                    >
                      <path d="M6 9L12 15L18 9" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>

                  {expandedEditItems[item.id] && (
                    <div className="dispatch-edit-item-body">
                      <FieldRow>
                        <FormField label="Quantity *">
                          <FormInput
                            type="text"
                            inputMode="numeric"
                            value={item.quantity}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "" || /^\d+$/.test(val)) {
                                handleEditItemChange(item.id, "quantity", val);
                                setEditFormErrors((p) => { const n = { ...p }; delete n[`item${index}_quantity`]; return n; });
                              }
                            }}
                            placeholder="Enter quantity..."
                          />
                          {item.maxQty != null && (
                            <div className="material-field-hint">Max: {item.maxQty}</div>
                          )}
                          <FieldError message={editFormErrors[`item${index}_quantity`]} />
                        </FormField>

                        <FormField label="Slot">
                          <FormSelect
                            value={item.slot}
                            onChange={(e) => handleEditItemChange(item.id, "slot", e.target.value)}
                            options={mergeOptionForValue(slotOptions, item.slot)}
                            placeholder="Select slot..."
                            disabled
                          />
                        </FormField>
                      </FieldRow>

                      <FormField label="Reason">
                        <FormSelect
                          value={item.reason}
                          onChange={(e) => handleEditItemChange(item.id, "reason", e.target.value)}
                          options={mergeOptionForValue(reasonOptions, item.reason)}
                          placeholder="Select reason..."
                          disabled
                        />
                      </FormField>

                      <FormField>
                        <CheckboxField
                          label="Packing required"
                          checked={item.packing_required}
                          onChange={(e) => handleEditItemChange(item.id, "packing_required", e.target.checked)}
                        />
                      </FormField>

                      {item.packing_required && (
                        <div className="material-item-subfields">
                          <FieldRow>
                            <FormField label="Repacking Pallets">
                              <FormInput
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={item.repacking_pallets}
                                onChange={(e) => handleNonNegativeIntegerChange(item.id, "repacking_pallets", e.target.value)}
                                placeholder="0"
                              />
                            </FormField>
                            <FormField label="Repacking Rolls">
                              <FormInput
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={item.repacking_rolls}
                                onChange={(e) => handleNonNegativeIntegerChange(item.id, "repacking_rolls", e.target.value)}
                                placeholder="0"
                              />
                            </FormField>
                          </FieldRow>
                        </div>
                      )}

                      <FormField>
                        <CheckboxField
                          label="Transportation required"
                          checked={item.transportation_required}
                          onChange={(e) => handleEditItemChange(item.id, "transportation_required", e.target.checked)}
                        />
                      </FormField>

                      {item.transportation_required && (
                        <div className="material-item-subfields">
                          <FieldRow>
                            <FormField label="Vehicle Type">
                              <FormSelect
                                value={item.typeOfVehicle}
                                onChange={(e) => handleEditItemChange(item.id, "typeOfVehicle", e.target.value)}
                                options={mergeOptionForValue(vehicleOptions, item.typeOfVehicle)}
                                placeholder="Select vehicle..."
                              />
                            </FormField>
                            <FormField label="Driver">
                              <FormSelect
                                value={item.driverName}
                                onChange={(e) => handleEditItemChange(item.id, "driverName", e.target.value)}
                                options={mergeOptionForValue(driverOptions, item.driverName)}
                                placeholder="Select driver..."
                              />
                            </FormField>
                          </FieldRow>

                          <FieldRow>
                            <FormField label="From Location">
                              <FormSelect
                                value={item.fromLocation}
                                onChange={(e) => handleEditItemChange(item.id, "fromLocation", e.target.value)}
                                options={mergeOptionForValue(locationOptions, item.fromLocation)}
                                placeholder="Select from..."
                              />
                            </FormField>
                            <FormField label="To Location">
                              <FormSelect
                                value={item.toLocation}
                                onChange={(e) => handleEditItemChange(item.id, "toLocation", e.target.value)}
                                options={mergeOptionForValue(locationOptions, item.toLocation)}
                                placeholder="Select to..."
                              />
                            </FormField>
                          </FieldRow>

                          <FormField label="Pick-Up From *">
                            <LocationAutocomplete
                              value={item.pickUpFrom}
                              onChange={(e) => {
                                handleEditItemChange(item.id, "pickUpFrom", e.target.value);
                                setEditFormErrors((p) => { const n = { ...p }; delete n[`item${index}_pickup`]; return n; });
                              }}
                              placeholder="Enter pick-up location..."
                            />
                            <FieldError message={editFormErrors[`item${index}_pickup`]} />
                          </FormField>

                          <FormField label="Transport Remarks">
                            <FormInput
                              type="text"
                              value={item.transportRemarks}
                              onChange={(e) => handleEditItemChange(item.id, "transportRemarks", e.target.value)}
                              placeholder="Enter transport remarks..."
                            />
                          </FormField>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </FormGroup>

          <FormGroup icon="folder" label="Documents" accent={MATERIAL_ACCENT}>
            <FormField className="cf-field-full">
              <div className="transport-upload-box">
                <ServiceAttachmentsList
                  // Existing documents come back from the API with `file_name`; the shared list reads `name`.
                  attachments={(formData.documents || []).map((doc) => (doc?.name ? doc : { ...doc, name: doc?.file_name || "Document" }))}
                  onAdd={() => {}}
                  onRemove={handleDocumentsRemove}
                  cardColor={cardColor}
                  isDragging={isDraggingDocuments}
                  onDragEnter={handleDocumentsDragEnter}
                  onDragLeave={handleDocumentsDragLeave}
                  onDragOver={handleDocumentsDragOver}
                  onDrop={handleDocumentsDrop}
                  fileInputRef={documentsFileInputRef}
                  onFileInputChange={handleDocumentsFileInputChange}
                  accept={MATERIAL_DOCUMENT_ACCEPT}
                  helperText={MATERIAL_DOCUMENT_HELPER}
                />
              </div>
            </FormField>
          </FormGroup>

          <FormGroup icon="notebook" label="Remarks" accent={MATERIAL_ACCENT}>
            <div className="cgpass-remarks">
              <FormField>
                <ReactQuillEditor
                  key={editorKey}
                  value={formData.remarks || ""}
                  onChange={(e) => handleFormChange("remarks", e.target.value)}
                  placeholder="Enter remarks..."
                  name="remarks"
                />
              </FormField>
            </div>
          </FormGroup>

        </form>
  );

  // Left-hand edit card footer (was the modal footer).
  const renderFormFooter = () => (
    <div className="form-save-button-wrapper cgpass-save-footer material-note-save-footer">
      <span />
      <div className="material-note-footer-actions">
        <button type="button" className="material-note-ghost-action" onClick={resetEditForm}>
          Cancel
        </button>
        <button
          type="submit"
          form="dispatchNoteForm"
          className="form-save-button"
          disabled={isLoadingUpdate || isLoadingDetail || isLoadingDelete}
        >
          {isLoadingUpdate ? "Saving..." : "Update Note"}
        </button>
      </div>
    </div>
  );

  const renderViewHeader = () => (
    <h1 className="modal-title">View Dispatch Note Details</h1>
  );

  const renderViewBody = () => {
    if (!viewingNote) return null;

    if (isLoadingDetail) {
      return (
        <div className="modal-body">
          <CardTabListLoading message="Loading..." cardColor={cardColor} />
        </div>
      );
    }

    const viewItems = Array.isArray(viewingNote.items) ? viewingNote.items : [];
    const documents = Array.isArray(viewingNote.documents) ? viewingNote.documents : [];

    return (
      <div className="modal-body">
        <div className="lead-form">
          <div className="landing-view-basic-section mb-4">
            <h3 className="landing-view-section-title">
              <span className="landing-view-section-icon landing-view-section-icon--info">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 8h.01M11 12h1v5h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span>Basic Details</span>
            </h3>
            <div className="landing-view-info-grid">
              {[
                { key: "no", icon: "hash", label: "Dispatch Note No", value: viewingNote.dispatch_note_no || "-" },
                { key: "date", icon: "calendar", label: "Dispatch Date", value: formatDate(viewingNote.dispatch_date) || "-" },
                { key: "warehouse", icon: "building", label: "Warehouse", value: warehouseOptions.find((o) => o.value === String(viewingNote.warehouse_id))?.label || viewingNote.warehouse_id || "-" },
                { key: "delivery_location", icon: "pin", label: "Delivery Location", value: viewingNote.delivery_location || "-" },
                { key: "delivered_to", icon: "user", label: "Delivered To", value: viewingNote.delivered_to || "-" },
                ...(viewingNote.signature ? [{ key: "signature", icon: "signature", label: "Signature", value: viewingNote.signature }] : []),
              ].map((field, index) => (
                <div key={field.key} className="landing-view-info-card" style={{ "--stagger-index": index }}>
                  <span className="landing-view-info-icon">
                    {renderLaunchHireStepIcon(field.icon)}
                  </span>
                  <div className="landing-view-info-body">
                    <span className="landing-view-info-label">{field.label}</span>
                    <span className="landing-view-info-value">{field.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-12">
              <label className="landing-view-label">Documents</label>
              {documents.length > 0 ? (
                <div className="landing-doc-list">
                  {documents.map((doc, i) => {
                    const fileName = doc.file_name || doc.name || `File ${i + 1}`;
                    const fileUrl = getFileUrl(doc.file_path || doc.file_url || "");
                    const isImg = isImageFile(fileName);
                    return (
                      <div key={i} className="landing-doc-card">
                        {isImg ? (
                          <img src={fileUrl} alt={fileName} className="landing-doc-thumbnail" />
                        ) : (
                          <div className="landing-doc-icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#00368c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M14 2V8H20" stroke="#00368c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        )}
                        <div className="landing-doc-info">
                          <div className="landing-doc-name">{fileName}</div>
                          {doc.remarks && <div className="landing-doc-remarks">{doc.remarks}</div>}
                        </div>
                        <a href={fileUrl} target="_blank" rel="noreferrer" className="landing-doc-view-btn">View</a>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="landing-view-box">No files</div>
              )}
            </div>
            {viewingNote.remarks && (
              <div className="col-12">
                <label className="landing-view-label">Remarks</label>
                <div className="landing-view-box landing-view-box--textarea" dangerouslySetInnerHTML={{ __html: viewingNote.remarks }} />
              </div>
            )}
          </div>

          {viewingNote.launch_hire && (() => {
            const statusTone = launchHireStatusTone(viewingNote.launch_hire.status);
            return (
              <div className="dispatch-edit-section dispatch-launch-hire-section mb-4">
                <h3 className="dispatch-edit-section-title dispatch-launch-hire-title">
                  <span className="dispatch-launch-hire-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 15h18l-2 5H5l-2-5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M12 3v12M9 6l3-3 3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M2 15c2-2.5 4-3.5 10-3.5s8 1 10 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span>Launch Hire</span>
                </h3>
                <div className="dispatch-launch-hire-card">
                  <div className="dispatch-launch-hire-steps">
                    {[
                      { key: "booking", icon: "clock", label: "Booking Date/Time", value: formatDateTime(viewingNote.launch_hire.booking_datetime) || "-" },
                      { key: "location", icon: "pin", label: "Location", value: viewingNote.launch_hire.location || "-" },
                      { key: "status", icon: launchHireStatusIcon(statusTone), label: "Status", value: viewingNote.launch_hire.status || "-", tone: statusTone },
                      ...(viewingNote.launch_hire.remarks ? [{ key: "remarks", icon: "note", label: "Remarks", value: viewingNote.launch_hire.remarks }] : []),
                    ].map((step, index) => {
                      const isEmpty = step.value === "-";
                      return (
                        <div
                          key={step.key}
                          className={`dispatch-launch-hire-step${isEmpty ? " dispatch-launch-hire-step--empty" : ""}`}
                          style={{ "--stagger-index": index }}
                        >
                          <span className="dispatch-launch-hire-step-icon-wrap">
                            <span className={`dispatch-launch-hire-step-icon${step.tone ? ` dispatch-launch-hire-step-icon--${step.tone}` : ""}`}>
                              {renderLaunchHireStepIcon(step.icon)}
                            </span>
                            <span className="dispatch-launch-hire-step-num">{index + 1}</span>
                          </span>
                          <span className="dispatch-launch-hire-step-body">
                            <span className="dispatch-launch-hire-step-label">{step.label}</span>
                            <span className="dispatch-launch-hire-step-value">{step.value}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {viewItems.length > 0 && (
            <div className="landing-view-items-section">
              <h4 className="landing-view-section-title mb-3">
                <span className="landing-view-section-icon landing-view-section-icon--items">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 8l-9-5-9 5 9 5 9-5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 8v8l9 5 9-5V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12 13v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                <span>Items</span>
                <span className="landing-view-count-badge">{viewItems.length}</span>
              </h4>
              {viewItems.map((item, idx) => {
                const transport = getTransportation(item);
                const hasTransport = isTruthyFlag(item.transportation_required) || Boolean(transport);
                const hasPacking = isTruthyFlag(item.packing_required);
                return (
                  <div
                    key={item.dispatch_note_item_id || idx}
                    className="landing-view-item-card landing-view-item-card--animated"
                    style={{ "--stagger-index": idx }}
                  >
                    <div className="landing-view-item-title landing-view-item-title--iconic">
                      <span className="landing-view-item-icon">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M20.5 7.5L12 3 3.5 7.5 12 12l8.5-4.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M3.5 7.5v9L12 21l8.5-4.5v-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span>Item {idx + 1}{item.order_no ? ` — ${item.order_no}` : ""}</span>
                    </div>
                    <div className="landing-view-info-grid landing-view-info-grid--items mb-3">
                      {[
                        { key: "po_no", icon: "hash", label: "PO No", value: item.po_no || "-" },
                        { key: "quantity", icon: "list", label: "Quantity", value: item.quantity ?? "-" },
                        { key: "package_type", icon: "package", label: "Package Type", value: item.package_type || "-" },
                        { key: "description", icon: "note", label: "Description", value: item.description || "-" },
                      ].map((field, fieldIdx) => (
                        <div key={field.key} className="landing-view-info-card landing-view-info-card--items" style={{ "--stagger-index": fieldIdx }}>
                          <span className="landing-view-info-icon landing-view-info-icon--items">
                            {renderLaunchHireStepIcon(field.icon)}
                          </span>
                          <div className="landing-view-info-body">
                            <span className="landing-view-info-label">{field.label}</span>
                            <span className="landing-view-info-value">{field.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {(item.slot || item.slot_no || item.slot_no_id || item.reason) && (
                      <div className="landing-view-sub-section">
                        <div className="landing-view-sub-title landing-view-sub-title--iconic">
                          <span className="landing-view-section-icon landing-view-section-icon--dispatch landing-view-section-icon--sm">
                            {renderLaunchHireStepIcon("flag")}
                          </span>
                          <span>Dispatch Details</span>
                        </div>
                        <div className="row g-2">
                          {(item.slot || item.slot_no || item.slot_no_id) && (
                            <div className="col-md-6 col-6">
                              <label className="landing-view-label">Slot</label>
                              <div className="landing-view-box">{normalizeSlotValue(item.slot ?? item.slot_no ?? item.slot_no_id)}</div>
                            </div>
                          )}
                          {item.reason && (
                            <div className="col-md-6 col-6">
                              <label className="landing-view-label">Reason</label>
                              <div className="landing-view-box">{item.reason}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {hasPacking && (
                      <div className="landing-view-sub-section">
                        <div className="landing-view-sub-title landing-view-sub-title--iconic">
                          <span className="landing-view-section-icon landing-view-section-icon--packing landing-view-section-icon--sm">
                            {renderLaunchHireStepIcon("box")}
                          </span>
                          <span>Packing</span>
                        </div>
                        <div className="row g-2">
                          <div className="col-md-4 col-6">
                            <label className="landing-view-label">Repacking Pallets</label>
                            <div className="landing-view-box">{item.repacking_pallets ?? "-"}</div>
                          </div>
                          <div className="col-md-4 col-6">
                            <label className="landing-view-label">Repacking Rolls</label>
                            <div className="landing-view-box">{item.repacking_rolls ?? "-"}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {hasTransport && transport && (
                      <div className="landing-view-sub-section landing-view-sub-section--transport-card">
                        <div className="landing-view-sub-title landing-view-sub-title--iconic">
                          <span className="landing-view-section-icon landing-view-section-icon--transport landing-view-section-icon--sm">
                            {renderLaunchHireStepIcon("truck")}
                          </span>
                          <span>Transportation</span>
                        </div>
                        {(() => {
                          const driverStep = {
                            key: "driver", icon: "user", label: "Driver",
                            value: transport.driver_name ||
                              driverOptions.find((o) => o.value === String(transport.driver_id))?.label ||
                              "-",
                          };
                          const isDriverEmpty = driverStep.value === "-";
                          const routeSteps = [
                            {
                              key: "vehicle", icon: "truck", label: "Vehicle Type",
                              value: transport.vehicle_type_name ||
                                vehicleOptions.find((o) => o.value === String(transport.vehicle_type_id))?.label ||
                                "-",
                            },
                            {
                              key: "from", icon: "pin", label: "From Location",
                              value: transport.from_location_name ||
                                locationOptions.find((o) => o.value === String(transport.from_location_id))?.label ||
                                "-",
                            },
                            { key: "pickup", icon: "target", label: "Pick-Up From", value: transport.pickup_location || "-" },
                            {
                              key: "to", icon: "flag", label: "To Location",
                              value: transport.to_location_name ||
                                locationOptions.find((o) => o.value === String(transport.to_location_id))?.label ||
                                "-",
                            },
                          ];
                          return (
                            <>
                              <div className="landing-view-transport-driver-row">
                                <div className={`landing-view-transport-step${isDriverEmpty ? " landing-view-transport-step--empty" : ""}`}>
                                  <span className="landing-view-transport-step-icon-wrap">
                                    <span className="landing-view-transport-step-icon">
                                      {renderLaunchHireStepIcon(driverStep.icon)}
                                    </span>
                                  </span>
                                  <div className="landing-view-transport-step-body">
                                    <span className="landing-view-transport-step-label">{driverStep.label}</span>
                                    <span className="landing-view-transport-step-value">{driverStep.value}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="landing-view-transport-steps">
                                {routeSteps.map((step, stepIdx, steps) => {
                                  const isEmpty = step.value === "-";
                                  return (
                                    <Fragment key={step.key}>
                                      <div
                                        className={`landing-view-transport-step${isEmpty ? " landing-view-transport-step--empty" : ""}`}
                                        style={{ "--stagger-index": stepIdx }}
                                      >
                                        <span className="landing-view-transport-step-icon-wrap">
                                          <span className="landing-view-transport-step-icon">
                                            {renderLaunchHireStepIcon(step.icon)}
                                          </span>
                                          <span className="landing-view-transport-step-num">{stepIdx + 1}</span>
                                        </span>
                                        <div className="landing-view-transport-step-body">
                                          <span className="landing-view-transport-step-label">{step.label}</span>
                                          <span className="landing-view-transport-step-value">{step.value}</span>
                                        </div>
                                      </div>
                                      {stepIdx < steps.length - 1 && (
                                        <div className="landing-view-transport-track" aria-hidden="true" style={{ "--stagger-index": stepIdx }}>
                                          <span className="landing-view-transport-track-line" />
                                          <span className="landing-view-transport-track-truck">
                                            {renderLaunchHireStepIcon("truck")}
                                          </span>
                                        </div>
                                      )}
                                    </Fragment>
                                  );
                                })}
                              </div>
                            </>
                          );
                        })()}
                        {transport.remarks && (
                          <div className="row g-2 mt-2">
                            <div className="col-md-6 col-12">
                              <label className="landing-view-label">Remarks</label>
                              <div className="landing-view-box landing-view-box--textarea" dangerouslySetInnerHTML={{ __html: transport.remarks }} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderViewFooter = () => (
    <div className="modal-footer">
      <button type="button" className="btn btn-secondary" onClick={handleCloseViewModal}>
        Close
      </button>
      {viewingNote && canPrintDispatchNote && (
        <button
          type="button"
          className="btn btn-primary d-flex align-items-center gap-2"
          onClick={() => handlePrintNote(viewingNote)}
          disabled={!!printingNoteId}
        >
          {printingNoteId === (viewingNote?.dispatch_note_id || viewingNote?.id)
            ? <><span className="spinner-border spinner-border-sm" role="status" />Printing...</>
            : "Print"
          }
        </button>
      )}
    </div>
  );

  return (
    <div className="cardform-left-full" style={{ "--card-color": cardColor }}>
      <FormSection icon={GroupSettingsIcon} title="">
        <div className="pre-arrival-form material-notes-form">
          <div className={`general-info-two-column operation-section-form-layout crew-pass-premium-grid${canUpdateDispatchNote ? "" : " material-notes-grid--list-only"}`}>
            {canUpdateDispatchNote && (
              <div className="general-info-left crew-pass-premium-left">
                <div className={`crew-pass-request-details-card husb-accent-${MATERIAL_ACCENT}`}>
                  <PremiumCardHeader
                    icon={MAIN_TABS.MATERIAL_MANAGEMENT}
                    title={editingNote ? `Edit dispatch note${editingNoteLabel ? ` ${editingNoteLabel}` : ""}` : "Edit dispatch note"}
                    subtitle={editingNote ? "Update the dispatch details and save your changes" : "Select a dispatch note from the list to edit"}
                    headerClassName="crew-pass-request-details-card__header"
                    titleClassName="crew-pass-request-details-card__title"
                  />
                  {editingNote ? (
                    <>
                      <div
                        ref={formBodyRef}
                        className="crew-pass-request-details-card__body crew-pass-form-fields crew-pass-thin-scrollbar"
                      >
                        {renderFormBody()}
                      </div>
                      {renderFormFooter()}
                    </>
                  ) : (
                    <div className="crew-pass-requests-table-card__empty material-note-idle">
                      <span>No dispatch note selected</span>
                      <small>Dispatch notes are created by converting a landing note. Choose <b>Edit</b> from a row&apos;s menu to update one here.</small>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="general-info-right crew-pass-requests-sidebar">
              <div className={`crew-pass-requests-table-card husb-accent-${MATERIAL_ACCENT}`} role="region" aria-label="Dispatch notes">
                <PremiumCardHeader
                  icon="list"
                  title="Dispatch notes"
                  subtitle="All dispatch notes for this job"
                  count={dispatchTotal || undefined}
                  headerClassName="crew-pass-requests-table-card__header"
                  titleClassName="crew-pass-requests-table-card__title"
                />
                <div className="crew-pass-requests-table-card__body">
                  {isLoadingList ? (
                    <div className="crew-pass-requests-table-card__skeleton" aria-busy="true">
                      <Skeleton height={14} borderRadius={6} count={1} style={{ marginBottom: 12 }} />
                      <Skeleton height={36} borderRadius={6} count={6} />
                    </div>
                  ) : notesList.length === 0 ? (
                    <div className="crew-pass-requests-table-card__empty">No dispatch notes added yet</div>
                  ) : (
                    <div className="crew-pass-requests-table-scroll crew-pass-thin-scrollbar material-table-container">
                      <table className="crew-pass-requests-table material-notes-table dispatch-note-table">
                        <thead>
                          <tr>
                            <th>Order No</th>
                            <th>Date</th>
                            <th>PO/DO</th>
                            <th>Delivery Proof</th>
                            <th>Quantity</th>
                            <th>Package Type</th>
                            <th>Description</th>
                            <th className="dispatch-note-actions-th">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {notesList.map((note) => (
                              <tr
                                key={note.id}
                                className={editingNote?.id === note.id ? "material-notes-table__row--editing" : undefined}
                              >
                                <td><div className="material-table-cell">{note.orderNo || ""}</div></td>
                                <td><div className="material-table-cell">{formatDate(note.date)}</div></td>
                                <td><div className="material-table-cell">{note.poDo || ""}</div></td>
                                <td>
                                  <div className="material-table-cell">
                                    {note.deliveryProof && note.deliveryProof.length > 0 ? (
                                      <span className="dispatch-note-file-link">{note.deliveryProof.length} file(s)</span>
                                    ) : (
                                      <span className="dispatch-note-no-files">No files</span>
                                    )}
                                  </div>
                                </td>
                                <td><div className="material-table-cell">{note.quantity || ""}</div></td>
                                <td><div className="material-table-cell">{note.packageType || ""}</div></td>
                                <td>
                                  <div className="material-table-cell">
                                    {note.description && note.description.length > 13 ? (
                                      <>
                                        <Tooltip id={`description-tooltip-${note.id}`} place="right" content={note.description} className="material-table-tooltip" />
                                        <span data-tooltip-id={`description-tooltip-${note.id}`} className="dispatch-note-desc-tip">
                                          {note.description.substring(0, 13)}...
                                        </span>
                                      </>
                                    ) : (
                                      <span>{note.description || ""}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="dispatch-note-actions-td">
                                  <div className="material-table-cell dispatch-note-actions-cell">
                                    <Tooltip id={`view-note-${note.id}`} place="left" content="View" />
                                    <button
                                      type="button"
                                      onClick={() => handleViewNote(note)}
                                      data-tooltip-id={`view-note-${note.id}`}
                                      className="dispatch-note-action-btn"
                                    >
                                      <img src={eyeIcon} alt="view" className="dispatch-note-action-icon" />
                                    </button>
                                    {canPrintDispatchNote && (
                                      <>
                                        <Tooltip id={`print-note-${note.id}`} place="left" content="Print" />
                                        <button
                                          type="button"
                                          onClick={() => handlePrintNote(note)}
                                          data-tooltip-id={`print-note-${note.id}`}
                                          className="print-action-icon-wrap"
                                          disabled={printingNoteId === (note.dispatch_note_id || note.id)}
                                        >
                                          {printingNoteId === (note.dispatch_note_id || note.id) ? (
                                            <span className="spinner-border spinner-border-sm" role="status" />
                                          ) : (
                                            <img src={printIcon} alt="print" className="material-action-icon" />
                                          )}
                                        </button>
                                      </>
                                    )}
                                    <div className={`action-dropdown-wrapper${openDropdownId === note.id ? " action-dropdown-wrapper--open" : ""}`}>
                                      <Tooltip id={`more-actions-${note.id}`} place="right" content="More actions" />
                                      <button
                                        type="button"
                                        onClick={(e) => handleToggleDropdown(note.id, e)}
                                        data-tooltip-id={`more-actions-${note.id}`}
                                        className="dispatch-note-action-btn"
                                      >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                          <circle cx="12" cy="6" r="1.5" fill="currentColor" />
                                          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                                          <circle cx="12" cy="18" r="1.5" fill="currentColor" />
                                        </svg>
                                      </button>
                                      {openDropdownId === note.id && createPortal(
                                        <div
                                          data-dropdown-menu
                                          className="dispatch-note-dropdown-menu"
                                          style={{ top: `${dropdownPosition.top}px`, right: `${dropdownPosition.right}px` }}
                                        >
                                          {canUpdateDispatchNote && (
                                            <button
                                              type="button"
                                              onClick={() => { handleCloseDropdown(); handleEditNote(note); }}
                                              className="dispatch-note-dropdown-btn"
                                            >
                                              <img src={editIcon} alt="edit" className="dispatch-note-dropdown-icon" />
                                              <span>Edit</span>
                                            </button>
                                          )}
                                          {canDeleteDispatchNote && (
                                          <button
                                            type="button"
                                            onClick={() => { handleCloseDropdown(); handleDelete(note); }}
                                            className="dispatch-note-dropdown-btn dispatch-note-dropdown-btn--danger"
                                          >
                                            <img src={deleteIcon} alt="delete" className="dispatch-note-dropdown-icon" />
                                            <span>Delete</span>
                                          </button>
                                          )}
                                        </div>,
                                        document.body
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {!isLoadingList && notesList.length > 0 && (
                    <div className="crew-pass-requests-table-card__pagination">
                      <MaterialTablePagination
                        page={dispatchPage}
                        total={dispatchTotal}
                        limit={DISPATCH_LIMIT}
                        onPageChange={setDispatchPage}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </FormSection>

      <CustomModal
        className="material-management-modal"
        show={showViewModal}
        closeModal={handleCloseViewModal}
        header={renderViewHeader()}
        body={renderViewBody()}
        footer={renderViewFooter()}
        dialgName="modal-dialog modal-dialog-centered"
      />

      <DeleteConfirmationModal
        show={showDeleteModal}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        isLoading={isLoadingDelete}
        deleteText={`Are you sure you want to delete Order No: ${deletingNote?.dispatch_note_no || deletingNote?.id || ""}?`}
      />
    </div>
  );
};

DispatchNoteContent.propTypes = {
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
  cardColor: PropTypes.string,
};

export default DispatchNoteContent;
