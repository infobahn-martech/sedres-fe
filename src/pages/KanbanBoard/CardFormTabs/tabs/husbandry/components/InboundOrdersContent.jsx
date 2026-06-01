import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import CustomModal from "../../../../../../components/CustomModal";
import DeleteConfirmationModal from "../../../../../../components/DeleteConfirmationModal";
import { FormField, FormInput, FormSelect, FormTextarea, ReactQuillEditor } from "./Husbandry.components";
import DateTimePickerField from "../../../components/DateTimePickerField";
import editIcon from "../../../../../../assets/images/edit.svg";
import deleteIcon from "../../../../../../assets/images/delete.svg";
import eyeIcon from "../../../../../../assets/images/eye.svg";
import logisticsWarehouseService from "../../../../../../services/logisticsWarehouseService";
import packingTypeService from "../../../../../../services/packingTypeService";
import useInboundOrderReducer from "../../../../../../store/InboundOrderReducer";
import useAlertReducer from "../../../../../../store/AlertReducer";
import inboundOrderService from "../../../../../../services/inboundOrderService";
import vehicleService from "../../../../../../services/vehicleService";
import driverService from "../../../../../../services/driverService";
import {
  splitApiDateTimeParts,
  buildApiDateTime,
  formatDisplayDateTime,
} from "../../../../../../helpers/dateTimeFieldUtils";
import MaterialTablePagination from "./MaterialTablePagination";

const extractListFromApi = (body) => {
  if (body == null) return [];
  if (Array.isArray(body)) return body;
  if (Array.isArray(body.data)) return body.data;
  return [];
};

const mergeOptionForValue = (options, value) => {
  if (value == null || value === "") return options;
  const s = String(value);
  if (options.some((o) => o.value === s)) return options;
  return [...options, { value: s, label: s }];
};

const toPositiveId = (value) => {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
};

// Generate dummy inbound orders data
const generateDummyInboundOrders = () => {
  const packageTypes = ["Box", "Pallet", "Crate", "Bag", "Container"];
  const descriptions = [
    "Spare parts for vessel maintenance",
    "Safety equipment and supplies",
    "Food and beverage items",
    "Technical equipment",
    "Cleaning supplies",
    "Medical supplies",
    "Office supplies",
    "Tools and hardware"
  ];

  const dummyOrders = [];
  for (let i = 1; i <= 10; i++) {
    const orderDate = new Date();
    orderDate.setDate(orderDate.getDate() - Math.floor(Math.random() * 30));

    dummyOrders.push({
      id: i,
      orderNo: `ORD-${String(i).padStart(5, '0')}`,
      date: orderDate.toISOString().split('T')[0],
      poDo: `PO-${String(i).padStart(4, '0')}`,
      quantity: Math.floor(Math.random() * 100) + 1,
      packageType: packageTypes[Math.floor(Math.random() * packageTypes.length)],
      description: descriptions[Math.floor(Math.random() * descriptions.length)],
    });
  }
  return dummyOrders;
};

// AttachmentsList Component (from Operation.jsx)
const AttachmentsList = ({ attachments = [], onAdd, onRemove, cardColor, isDragging, onDragEnter, onDragLeave, onDragOver, onDrop, fileInputRef, onFileInputChange }) => {
  return (
    <div className="document-upload-wrapper">
      <div
        className={`document-upload-zone ${isDragging ? "dragging" : ""}`}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{ "--card-color": cardColor || "#00368c" }}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="file-input-hidden"
          accept="*/*"
          multiple
          onChange={onFileInputChange}
        />
        <div className="upload-zone-content">
          <div className="upload-icon-wrapper"></div>
          <div className="upload-text-content">
            <p className="upload-main-text">
              Drag and drop your files here, or{" "}
              <span className="upload-link">click to browse</span>
            </p>
          </div>
        </div>
      </div>
      {attachments.length > 0 && (
        <div className="document-file-preview-list">
          {attachments.map((item, index) => (
            <div key={index} className="document-file-preview-item">
              <div className="document-file-preview-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="document-file-preview-info">
                <span className="document-file-preview-name">{item.name || item}</span>
                {item.size != null && (
                  <span className="document-file-preview-size">
                    {item.size < 1024 * 1024
                      ? `${(item.size / 1024).toFixed(1)} KB`
                      : `${(item.size / 1024 / 1024).toFixed(2)} MB`}
                  </span>
                )}
              </div>
              <button
                className="document-file-preview-remove"
                onClick={(e) => { e.stopPropagation(); onRemove(index); }}
                type="button"
                title="Remove file"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


const InboundOrdersContent = ({ formValues, handleChange, cardColor }) => {
  const {
    saveInboundOrder,
    updateInboundOrder,
    deleteInboundOrder,
    convertInboundToLandingNote,
    getAllInbound,
    getInboundById,
    clearInboundDetail,
    inboundOrders,
    inboundTotal,
    isLoadingList: isLoadingOrders,
    isLoadingView,
    isLoadingSave: isSubmitting,
    isBeingUpdated,
    isLoadingDelete,
    isBeingConverted,
    inboundDetail: viewingOrder,
  } = useInboundOrderReducer((state) => state);

  const [showModal, setShowModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [convertingOrder, setConvertingOrder] = useState(null);
  const [convertFormErrors, setConvertFormErrors] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingOrder, setDeletingOrder] = useState(null);
  const [expandedOrders, setExpandedOrders] = useState({ 1: true }); // First order expanded by default
  const [expandedConvertOrders, setExpandedConvertOrders] = useState({ 1: true });
  const [isDraggingDocuments, setIsDraggingDocuments] = useState(false);
  const documentsFileInputRef = useRef(null);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const dropdownButtonRefs = useRef({});
  const [inboundPage, setInboundPage] = useState(1);
  const [formErrors, setFormErrors] = useState({});
  const INBOUND_LIMIT = 10;

  // Form state - Basic Details
  const [formData, setFormData] = useState({
    date: "",
    time: "",
    warehouse: "",
    remarks: "",
    orders: [{
      id: 1,
      orderNo: "",
      poDo: "",
      quantity: "",
      packageType: "",
      description: "",
      transportation: false,
      typeOfVehicle: "",
      fromLocation: "",
      pickUpFrom: "",
      toLocation: "",
      driverName: "",
      slotNo: "",
      reason: "",
      dispatchDate: ""
    }], // Order Details array
  });

  // Form state for Convert to Landing modal
  const [convertFormData, setConvertFormData] = useState({
    date: "",
    time: "",
    warehouse: "",
    receivedFrom: "",
    location: "",
    signature: "",
    documents: [],
    remarks: "",
    orders: [{
      id: 1,
      orderNo: "",
      poDo: "",
      quantity: "",
      packageType: "",
      description: "",
      transportation: false,
      typeOfVehicle: "",
      fromLocation: "",
      pickUpFrom: "",
      toLocation: "",
      driverName: "",
      slotNo: "",
      reason: "",
      dispatchDate: ""
    }],
  });

  const [warehouseLocationOptions, setWarehouseLocationOptions] = useState([]);
  const [packageTypeOptions, setPackageTypeOptions] = useState([]);
  const [materialVehicleOptions, setMaterialVehicleOptions] = useState([]);
  const [materialDriverOptions, setMaterialDriverOptions] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const loadReferenceData = async () => {
      try {
        const [whRes, pkgRes, vehRes, drvRes] = await Promise.all([
          logisticsWarehouseService.getWarehouseLocations(),
          packingTypeService.getPackingTypes(),
          vehicleService.getAllTransportVehicles(),
          driverService.getAllDrivers(),
        ]);
        if (cancelled) return;
        const whRows = extractListFromApi(whRes?.data);
        setWarehouseLocationOptions(
          whRows
            .map((r) => ({
              value: String(r.location_id ?? ""),
              label: String(r.location ?? ""),
            }))
            .filter((o) => o.value && o.label)
        );
        const pkgRows = extractListFromApi(pkgRes?.data);
        setPackageTypeOptions(
          pkgRows
            .map((r) => ({
              value: String(r.package_type_id ?? ""),
              label: String(r.package_type ?? ""),
            }))
            .filter((o) => o.value && o.label)
        );
        const vehRows = extractListFromApi(vehRes?.data);
        setMaterialVehicleOptions(
          vehRows
            .map((r) => ({
              value: String(r.vehicle_type_id ?? ""),
              label: String(r.vehicle_name ?? ""),
            }))
            .filter((o) => o.value && o.label)
        );
        const drvRows = extractListFromApi(drvRes?.data);
        setMaterialDriverOptions(
          drvRows
            .map((r) => ({
              value: String(r.driver_id ?? ""),
              label: String(r.driver_name ?? ""),
            }))
            .filter((o) => o.value && o.label)
        );
      } catch (err) {
        console.error("Inbound orders reference data failed to load", err);
      }
    };
    loadReferenceData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);
    if (!callId) return;
    getAllInbound({ call_id: callId, page: inboundPage, limit: INBOUND_LIMIT });
  }, [formValues?.call_id, formValues?.callId, formValues?.card_call_id, inboundPage]);

  const populateFormFromOrder = (order) => {
    const apiItems = Array.isArray(order.items) ? order.items : [];
    const orderItems = apiItems.length > 0
      ? apiItems.map((item, idx) => ({
          id: idx + 1,
          inbound_item_id: item.inbound_item_id ? Number(item.inbound_item_id) : null,
          orderNo: item.order_no || "",
          poDo: item.po_no || "",
          quantity: item.quantity || "",
          packageType: String(item.package_type_id || ""),
          description: item.description || "",
          transportation: Number(item.transportation_required) === 1,
          transportation_id: item.transportation?.transportation_id ? Number(item.transportation.transportation_id) : null,
          typeOfVehicle: item.transportation ? String(item.transportation.vehicle_type_id || "") : "",
          fromLocation: item.transportation ? String(item.transportation.from_location_id || "") : "",
          pickUpFrom: item.transportation ? item.transportation.pickup_location || "" : "",
          toLocation: item.transportation ? String(item.transportation.to_location_id || "") : "",
          driverName: item.transportation ? String(item.transportation.driver_id || "") : "",
          slotNo: "",
          reason: "",
          dispatchDate: "",
        }))
      : [{
          id: 1,
          orderNo: "",
          poDo: "",
          quantity: "",
          packageType: "",
          description: "",
          transportation: false,
          typeOfVehicle: "",
          fromLocation: "",
          pickUpFrom: "",
          toLocation: "",
          driverName: "",
          slotNo: "",
          reason: "",
          dispatchDate: "",
        }];

    const { date: editDate, time: editTime } = splitApiDateTimeParts(
      order.inbound_date || order.date || "",
      order.inbound_time || order.time || ""
    );

    setFormData({
      date: editDate,
      time: editTime,
      warehouse: String(order.warehouse_id || order.warehouse || ""),
      remarks: order.remarks || "",
      orders: orderItems,
    });

    const expandedState = {};
    orderItems.forEach((item) => {
      expandedState[item.id] = true;
    });
    setExpandedOrders(expandedState);
  };

  const handleOpenModal = (order = null) => {
    if (order) {
      setEditingOrder(order);
      populateFormFromOrder(order);
      setShowModal(true);

      const inboundId = order.inbound_id ?? order.id;
      if (inboundId != null && inboundId !== "") {
        inboundOrderService
          .getInboundById(inboundId)
          .then(({ data }) => {
            const detail = data?.data;
            if (detail) {
              setEditingOrder(detail);
              populateFormFromOrder(detail);
            }
          })
          .catch(() => {});
      }
      return;
    }

    setEditingOrder(null);
    setFormData({
      date: "",
      time: "",
      warehouse: "",
      remarks: "",
      orders: [{
        id: 1,
        orderNo: "",
        poDo: "",
        quantity: "",
        packageType: "",
        description: "",
        transportation: false,
        typeOfVehicle: "",
        fromLocation: "",
        pickUpFrom: "",
        toLocation: "",
        driverName: "",
        slotNo: "",
        reason: "",
        dispatchDate: "",
      }],
    });
    setExpandedOrders({ 1: true });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingOrder(null);
    setFormErrors({});
    setFormData({
      date: "",
      time: "",
      warehouse: "",
      remarks: "",
      orders: [{
        id: 1,
        orderNo: "",
        poDo: "",
        quantity: "",
        packageType: "",
        description: "",
        transportation: false,
        typeOfVehicle: "",
        fromLocation: "",
        pickUpFrom: "",
        toLocation: "",
        driverName: "",
        slotNo: "",
        reason: "",
        dispatchDate: ""
      }],
    });
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleOrderChange = (orderId, field, value) => {
    setFormData((prev) => ({
      ...prev,
      orders: prev.orders.map((order) =>
        order.id === orderId ? { ...order, [field]: value } : order
      ),
    }));
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.date) errors.date = "Date is required";
    else if (!formData.time) errors.date = "Time is required";
    if (!formData.warehouse) errors.warehouse = "Warehouse is required";
    formData.orders.forEach((order, idx) => {
      if (!order.poDo) errors[`o${idx}_poDo`] = "PO/DO is required";
      if (!order.quantity) errors[`o${idx}_quantity`] = "Quantity is required";
      if (!order.packageType) errors[`o${idx}_packageType`] = "Package Type is required";
      if (order.transportation) {
        if (!order.typeOfVehicle) errors[`o${idx}_typeOfVehicle`] = "Vehicle type is required";
        if (!order.fromLocation) errors[`o${idx}_fromLocation`] = "From location is required";
        if (!order.toLocation) errors[`o${idx}_toLocation`] = "To location is required";
        if (!order.driverName) errors[`o${idx}_driverName`] = "Driver is required";
      }
    });
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddNewOrder = () => {
    const lastOrder = formData.orders[formData.orders.length - 1];
    if (lastOrder && (!lastOrder.poDo || !lastOrder.quantity || !lastOrder.packageType)) {
      const idx = formData.orders.length - 1;
      setFormErrors((prev) => ({
        ...prev,
        [`o${idx}_poDo`]: !lastOrder.poDo ? "PO/DO is required" : undefined,
        [`o${idx}_quantity`]: !lastOrder.quantity ? "Quantity is required" : undefined,
        [`o${idx}_packageType`]: !lastOrder.packageType ? "Package Type is required" : undefined,
      }));
      // Expand the last order so errors are visible
      setExpandedOrders((prev) => ({ ...prev, [lastOrder.id]: true }));
      return;
    }
    const newOrderId = formData.orders.length > 0 ? Math.max(...formData.orders.map((o) => o.id)) + 1 : 1;
    setFormData((prev) => ({
      ...prev,
      orders: [
        ...prev.orders,
        {
          id: newOrderId,
          orderNo: "",
          poDo: "",
          quantity: "",
          packageType: "",
          description: "",
          transportation: false,
          typeOfVehicle: "",
          fromLocation: "",
          pickUpFrom: "",
          toLocation: "",
          driverName: "",
          slotNo: "",
          reason: "",
          dispatchDate: ""
        },
      ],
    }));
    // Expand the new order by default
    setExpandedOrders((prev) => ({
      ...prev,
      [newOrderId]: true,
    }));
  };

  const handleRemoveOrder = (orderId) => {
    if (formData.orders.length > 1) {
      setFormData((prev) => ({
        ...prev,
        orders: prev.orders.filter((order) => order.id !== orderId),
      }));
      // Remove from expandedOrders if it exists
      setExpandedOrders((prev) => {
        const newExpanded = { ...prev };
        delete newExpanded[orderId];
        return newExpanded;
      });
    }
  };

  const toggleOrderExpand = (orderId) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);

    if (editingOrder?.inbound_id) {
      const updateItems = formData.orders.map((order) => {
        const item = {
          po_no: order.poDo || "",
          quantity: Number(order.quantity) || 0,
          package_type_id: Number(order.packageType) || 0,
          description: order.description || "",
          transportation_required: order.transportation ? 1 : 0,
        };
        if (order.inbound_item_id) item.inbound_item_id = Number(order.inbound_item_id);
        if (order.orderNo) item.order_no = order.orderNo;
        if (order.transportation) {
          const t = {
            vehicle_type_id: Number(order.typeOfVehicle) || 0,
            from_location_id: Number(order.fromLocation) || 0,
            pickup_location: order.pickUpFrom || "",
            to_location_id: Number(order.toLocation) || 0,
            driver_id: Number(order.driverName) || 0,
          };
          if (order.transportation_id) t.transportation_id = Number(order.transportation_id);
          item.transportation = t;
        } else {
          item.transportation = null;
        }
        return item;
      });

      const inboundId = Number(editingOrder.inbound_id);
      const updatePayload = {
        inbound_id: inboundId,
        call_id: callId,
        warehouse_id: Number(formData.warehouse) || 0,
        inbound_date: buildApiDateTime(formData.date, formData.time),
        remarks: formData.remarks || "",
        items: updateItems,
      };
      updateInboundOrder({
        inboundId: inboundId,
        data: updatePayload,
        cb: () => {
          handleCloseModal();
          getAllInbound({ call_id: callId, page: inboundPage, limit: INBOUND_LIMIT });
        },
      });
    } else {
      const createItems = formData.orders.map((order) => {
        const item = {
          po_no: order.poDo || "",
          quantity: Number(order.quantity) || 0,
          package_type_id: Number(order.packageType) || 0,
          description: order.description || "",
          transportation_required: order.transportation ? 1 : 0,
        };
        if (order.transportation) {
          item.transportation = {
            vehicle_type_id: Number(order.typeOfVehicle) || 0,
            from_location_id: Number(order.fromLocation) || 0,
            pickup_location: order.pickUpFrom || "",
            to_location_id: Number(order.toLocation) || 0,
            driver_id: Number(order.driverName) || 0,
          };
        } else {
          item.transportation = null;
        }
        return item;
      });

      const createPayload = {
        call_id: callId,
        warehouse_id: Number(formData.warehouse) || 0,
        remarks: formData.remarks || "",
        items: createItems,
      };

      saveInboundOrder({
        data: createPayload,
        cb: () => {
          handleCloseModal();
          getAllInbound({ call_id: callId, page: inboundPage, limit: INBOUND_LIMIT });
        },
      });
    }
  };

  const handleReset = () => {
    setFormData({
      date: "",
      time: "",
      warehouse: "",
      remarks: "",
      orders: [{
        id: 1,
        orderNo: "",
        poDo: "",
        quantity: "",
        packageType: "",
        description: "",
        transportation: false,
        typeOfVehicle: "",
        fromLocation: "",
        pickUpFrom: "",
        toLocation: "",
        driverName: "",
        slotNo: "",
        reason: "",
        dispatchDate: ""
      }],
    });
    setExpandedOrders({ 1: true });
  };

  const handleDelete = (order) => {
    handleCloseDropdown();
    setDeletingOrder(order);
    setShowDeleteModal(true);
  };

  const resolveInboundId = (order) => {
    const raw = order?.inbound_id ?? order?.id;
    if (raw == null || raw === "") return null;
    return raw;
  };

  const handleConfirmDelete = () => {
    if (!deletingOrder) return;
    const inboundId = resolveInboundId(deletingOrder);
    if (inboundId == null) return;

    const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);
    const pageAfterDelete =
      inboundOrders.length <= 1 && inboundPage > 1 ? inboundPage - 1 : inboundPage;

    deleteInboundOrder({
      inboundId,
      cb: () => {
        setShowDeleteModal(false);
        setDeletingOrder(null);
        if (pageAfterDelete !== inboundPage) {
          setInboundPage(pageAfterDelete);
        }
        getAllInbound({ call_id: callId, page: pageAfterDelete, limit: INBOUND_LIMIT });
      },
    });
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setDeletingOrder(null);
  };

  const handleViewOrder = (order) => {
    handleCloseDropdown();
    setShowViewModal(true);
    const inboundId = resolveInboundId(order);
    if (inboundId != null) {
      getInboundById({ inboundId });
    }
  };

  const handleCloseViewModal = () => {
    setShowViewModal(false);
    clearInboundDetail();
  };

  const handleToggleDropdown = (orderId, e) => {
    e.stopPropagation();
    if (openDropdownId === orderId) {
      setOpenDropdownId(null);
    } else {
      const button = e.currentTarget;
      const rect = button.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right
      });
      dropdownButtonRefs.current[orderId] = button;
      setOpenDropdownId(orderId);
    }
  };

  const handleCloseDropdown = () => {
    setOpenDropdownId(null);
  };

  // Close dropdown when clicking outside or scrolling
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is on the dropdown button or inside the portal dropdown menu
      const isDropdownButton = event.target.closest('.action-dropdown-wrapper');
      const isDropdownMenu = event.target.closest('[data-dropdown-menu]');

      if (!isDropdownButton && !isDropdownMenu) {
        setOpenDropdownId(null);
      }
    };

    const handleScroll = () => {
      setOpenDropdownId(null);
    };

    if (openDropdownId) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [openDropdownId]);

  const handlePrintOrder = (order) => {
    handleCloseDropdown();
    const printWindow = window.open('', '_blank');
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print - Inbound Order ${order.orderNo || ''}</title>
          <style>
            body {
              font-family: "Open Sans", sans-serif;
              padding: 20px;
              color: #333;
            }
            .print-header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #00368c;
              padding-bottom: 15px;
            }
            .print-header h1 {
              color: #00368c;
              margin: 0;
              font-size: 24px;
            }
            .print-section {
              margin-bottom: 25px;
            }
            .print-section-title {
              font-size: 18px;
              font-weight: bold;
              color: #00368c;
              margin-bottom: 15px;
              border-bottom: 1px solid #e2e2ea;
              padding-bottom: 8px;
            }
            .print-row {
              display: flex;
              margin-bottom: 12px;
            }
            .print-label {
              font-weight: 600;
              width: 200px;
              color: #666;
            }
            .print-value {
              flex: 1;
              color: #1a1a1a;
            }
            .print-footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e2e2ea;
              text-align: center;
              color: #666;
              font-size: 12px;
            }
            @media print {
              body { margin: 0; padding: 15px; }
              .print-footer { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h1>Inbound Order Details</h1>
          </div>
          
          <div class="print-section">
            <div class="print-section-title">Order Information</div>
            <div class="print-row">
              <div class="print-label">Order No:</div>
              <div class="print-value">${order.orderNo || "-"}</div>
            </div>
            <div class="print-row">
              <div class="print-label">Date:</div>
              <div class="print-value">${formatDate(order.date) || "-"}</div>
            </div>
            <div class="print-row">
              <div class="print-label">PO/DO:</div>
              <div class="print-value">${order.poDo || "-"}</div>
            </div>
            <div class="print-row">
              <div class="print-label">Quantity:</div>
              <div class="print-value">${order.quantity || "-"}</div>
            </div>
            <div class="print-row">
              <div class="print-label">Package Type:</div>
              <div class="print-value">${order.packageType || "-"}</div>
            </div>
            <div class="print-row">
              <div class="print-label">Description:</div>
              <div class="print-value">${order.description || "-"}</div>
            </div>
          </div>

          ${order.transportation ? `
          <div class="print-section">
            <div class="print-section-title">Transportation Details</div>
            <div class="print-row">
              <div class="print-label">Type of Vehicle:</div>
              <div class="print-value">${order.typeOfVehicle || "-"}</div>
            </div>
            <div class="print-row">
              <div class="print-label">From Location:</div>
              <div class="print-value">${order.fromLocation || "-"}</div>
            </div>
            <div class="print-row">
              <div class="print-label">Pick-Up From:</div>
              <div class="print-value">${order.pickUpFrom || "-"}</div>
            </div>
            <div class="print-row">
              <div class="print-label">To Location:</div>
              <div class="print-value">${order.toLocation || "-"}</div>
            </div>
            <div class="print-row">
              <div class="print-label">Driver Name:</div>
              <div class="print-value">${order.driverName || "-"}</div>
            </div>
            <div class="print-row">
              <div class="print-label">Slot No:</div>
              <div class="print-value">${order.slotNo || "-"}</div>
            </div>
            <div class="print-row">
              <div class="print-label">Reason:</div>
              <div class="print-value">${order.reason || "-"}</div>
            </div>
            <div class="print-row">
              <div class="print-label">Dispatch Date:</div>
              <div class="print-value">${order.dispatchDate ? formatDate(order.dispatchDate) : "-"}</div>
            </div>
          </div>
          ` : ''}

          <div class="print-footer">
            <p>Printed on ${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleConvertToLanding = (order) => {
    handleCloseDropdown();
    setConvertingOrder(order);
    const apiItems = Array.isArray(order.items) ? order.items : [];
    const convertOrders = apiItems.length > 0
      ? apiItems.map((item, idx) => ({
          id: idx + 1,
          inbound_item_id: item.inbound_item_id ? Number(item.inbound_item_id) : null,
          orderNo: item.order_no || "",
          poDo: item.po_no || "",
          quantity: item.quantity || "",
          packageType: String(item.package_type_id || ""),
          description: item.description || "",
          transportation: Number(item.transportation_required) === 1,
          transportation_id: item.transportation?.transportation_id ? Number(item.transportation.transportation_id) : null,
          typeOfVehicle: item.transportation ? String(item.transportation.vehicle_type_id || "") : "",
          fromLocation: item.transportation ? String(item.transportation.from_location_id || "") : "",
          pickUpFrom: item.transportation?.pickup_location || "",
          toLocation: item.transportation ? String(item.transportation.to_location_id || "") : "",
          driverName: item.transportation ? String(item.transportation.driver_id || "") : "",
          slotNo: "",
          reason: "",
          dispatchDate: "",
        }))
      : [{ id: 1, inbound_item_id: null, orderNo: "", poDo: "", quantity: "", packageType: "", description: "", transportation: false, typeOfVehicle: "", fromLocation: "", pickUpFrom: "", toLocation: "", driverName: "", slotNo: "", reason: "", dispatchDate: "" }];

    const exp = {};
    convertOrders.forEach((o) => { exp[o.id] = true; });

    setConvertFormData({
      date: "",
      time: "",
      warehouse: String(order.warehouse_id || order.warehouse || ""),
      receivedFrom: "",
      location: "",
      signature: "",
      documents: [],
      remarks: "",
      orders: convertOrders,
    });
    setExpandedConvertOrders(exp);
    setShowConvertModal(true);
  };

  const handleCloseConvertModal = () => {
    setShowConvertModal(false);
    setConvertingOrder(null);
    setConvertFormErrors({});
    setConvertFormData({
      date: "",
      time: "",
      warehouse: "",
      receivedFrom: "",
      location: "",
      signature: "",
      documents: [],
      remarks: "",
      orders: [{
        id: 1,
        orderNo: "",
        poDo: "",
        quantity: "",
        packageType: "",
        description: "",
        transportation: false,
        typeOfVehicle: "",
        fromLocation: "",
        pickUpFrom: "",
        toLocation: "",
        driverName: "",
        slotNo: "",
        reason: "",
        dispatchDate: ""
      }],
    });
  };

  const handleConvertFormChange = (field, value) => {
    setConvertFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleConvertOrderChange = (orderId, field, value) => {
    setConvertFormData((prev) => ({
      ...prev,
      orders: prev.orders.map((order) =>
        order.id === orderId ? { ...order, [field]: value } : order
      ),
    }));
  };

  const handleAddNewConvertOrder = () => {
    const newOrderId = convertFormData.orders.length > 0
      ? Math.max(...convertFormData.orders.map((o) => o.id)) + 1
      : 1;
    setConvertFormData((prev) => ({
      ...prev,
      orders: [
        ...prev.orders,
        {
          id: newOrderId,
          orderNo: "",
          poDo: "",
          quantity: "",
          packageType: "",
          description: "",
          transportation: false,
          typeOfVehicle: "",
          fromLocation: "",
          pickUpFrom: "",
          toLocation: "",
          driverName: "",
          slotNo: "",
          reason: "",
          dispatchDate: ""
        },
      ],
    }));
    setExpandedConvertOrders((prev) => ({
      ...prev,
      [newOrderId]: true,
    }));
  };

  const handleRemoveConvertOrder = (orderId) => {
    if (convertFormData.orders.length > 1) {
      setConvertFormData((prev) => ({
        ...prev,
        orders: prev.orders.filter((order) => order.id !== orderId),
      }));
      setExpandedConvertOrders((prev) => {
        const newExpanded = { ...prev };
        delete newExpanded[orderId];
        return newExpanded;
      });
    }
  };

  const toggleConvertOrderExpand = (orderId) => {
    setExpandedConvertOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  // Handle documents drag and drop
  const handleDocumentsDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingDocuments(true);
  };

  const handleDocumentsDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingDocuments(false);
  };

  const handleDocumentsDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDocumentsDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingDocuments(false);

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      const currentAttachments = convertFormData.documents || [];
      const newAttachments = files.map((file) => ({
        name: file.name,
        file: file,
        size: file.size,
        type: file.type,
      }));
      const updatedAttachments = [...currentAttachments, ...newAttachments];
      setConvertFormData((prev) => ({
        ...prev,
        documents: updatedAttachments,
      }));
    }
  };

  const handleDocumentsFileInputChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const currentAttachments = convertFormData.documents || [];
      const newAttachments = files.map((file) => ({
        name: file.name,
        file: file,
        size: file.size,
        type: file.type,
      }));
      const updatedAttachments = [...currentAttachments, ...newAttachments];
      setConvertFormData((prev) => ({
        ...prev,
        documents: updatedAttachments,
      }));
    }
    if (documentsFileInputRef.current) {
      documentsFileInputRef.current.value = "";
    }
  };

  const handleDocumentsRemove = (index) => {
    const currentAttachments = convertFormData.documents || [];
    const updatedAttachments = currentAttachments.filter((_, i) => i !== index);
    setConvertFormData((prev) => ({
      ...prev,
      documents: updatedAttachments,
    }));
  };

  const validateConvertForm = () => {
    const errors = {};
    if (!convertFormData.date) errors.date = "Date is required";
    else if (!convertFormData.time) errors.date = "Time is required";
    if (!convertFormData.receivedFrom) errors.receivedFrom = "Received From is required";
    if (!convertFormData.location) errors.location = "Location is required";
    if (!convertFormData.documents || convertFormData.documents.length === 0) errors.file = "File upload is required";
    setConvertFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleConvertSubmit = async (e) => {
    e.preventDefault();
    if (!validateConvertForm()) return;

    const inboundId = toPositiveId(convertingOrder?.inbound_id ?? convertingOrder?.id);
    const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);
    if (!inboundId || !callId) return;

    const items = convertFormData.orders.map((order) => {
      const item = {
        quantity: Number(order.quantity) || 0,
        slot_no_id: toPositiveId(order.slotNo) ?? 0,
        reason_id: toPositiveId(order.reason) ?? 0,
        dispatch_date: order.dispatchDate || "",
        transportation_required: order.transportation ? 1 : 0,
      };
      if (order.inbound_item_id) item.inbound_item_id = order.inbound_item_id;
      if (order.transportation) {
        item.transportation = {
          vehicle_type_id: toPositiveId(order.typeOfVehicle),
          from_location_id: toPositiveId(order.fromLocation),
          pickup_location: order.pickUpFrom || "",
          to_location_id: toPositiveId(order.toLocation),
          driver_id: toPositiveId(order.driverName),
        };
      } else {
        item.transportation = null;
      }
      return item;
    });

    const fd = new FormData();
    fd.append("inbound_id", inboundId);
    fd.append("call_id", callId);
    fd.append("warehouse_id", toPositiveId(convertFormData.warehouse));
    fd.append("landing_date", convertFormData.date + (convertFormData.time ? ` ${convertFormData.time}` : ""));
    fd.append("received_from", convertFormData.receivedFrom || "");
    fd.append("location", convertFormData.location || "");
    fd.append("signature", convertFormData.signature || "");
    fd.append("remarks", convertFormData.remarks || "");
    fd.append("items", JSON.stringify(items));
    if (convertFormData.documents?.length > 0) {
      fd.append("file", convertFormData.documents[0].file);
    }

    convertInboundToLandingNote({
      data: fd,
      cb: () => {
        handleCloseConvertModal();
        getAllInbound({ call_id: callId, page: inboundPage, limit: INBOUND_LIMIT });
      },
    });
  };


  const formatDate = (dateString, separateTime) => formatDisplayDateTime(dateString, separateTime);

  const slotNoOptions = [
    { value: "1", label: "Slot 1" },
    { value: "2", label: "Slot 2" },
    { value: "3", label: "Slot 3" },
    { value: "4", label: "Slot 4" },
    { value: "5", label: "Slot 5" },
  ];

  const reasonOptions = [
    { value: "Urgent", label: "Urgent" },
    { value: "Standard", label: "Standard" },
    { value: "Scheduled", label: "Scheduled" },
    { value: "Emergency", label: "Emergency" },
  ];

  const renderHeader = () => (
    <>
      <h1 className="modal-title">{editingOrder ? "Edit Inbound Order" : "Add Inbound Order"}</h1>
    </>
  );

  const renderBody = () => (
    <div className="modal-body">
      <div className="lead-form">
        <form id="inboundOrderForm" onSubmit={handleSubmit}>
          {/* Basic Details Section */}
          <div style={{ marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid #e2e2ea" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "14px", color: "#1a1a1a" }}>
              Basic Details
            </h3>
            <div className="row g-2 mb-2">
              <div className="col-md-6 mb-2">
                <FormField label="Date *">
                  <DateTimePickerField
                    dateValue={formData.date}
                    timeValue={formData.time}
                    onDateTimeChange={(nextValues) => {
                      setFormData((prev) => ({
                        ...prev,
                        date: nextValues.date,
                        time: nextValues.time,
                      }));
                      if (formErrors.date) setFormErrors((prev) => { const next = { ...prev }; delete next.date; return next; });
                    }}
                    dateFieldName="date"
                    timeFieldName="time"
                    placeholder="YYYY-MM-DD hh:mm"
                  />
                </FormField>
                {formErrors.date && <span style={{ color: "#dc3545", fontSize: "12px", display: "block", marginTop: "-12px", marginBottom: "4px" }}>{formErrors.date}</span>}
              </div>

              <div className="col-md-6 mb-2">
                <FormField label="Warehouse *">
                  <FormSelect
                    value={formData.warehouse}
                    onChange={(e) => {
                      handleFormChange("warehouse", e.target.value);
                      if (formErrors.warehouse) setFormErrors((prev) => { const e = { ...prev }; delete e.warehouse; return e; });
                    }}
                    options={mergeOptionForValue(warehouseLocationOptions, formData.warehouse)}
                    placeholder="Select warehouse"
                  />
                </FormField>
                {formErrors.warehouse && <span style={{ color: "#dc3545", fontSize: "12px", display: "block", marginTop: "-12px", marginBottom: "4px" }}>{formErrors.warehouse}</span>}
              </div>

              <div className="col-md-12 mb-2">
                <FormField label="Remarks">
                  <FormTextarea
                    value={formData.remarks}
                    onChange={(e) => handleFormChange("remarks", e.target.value)}
                    placeholder="Enter remarks..."
                    rows={3}
                  />
                </FormField>
              </div>
            </div>
          </div>

          {/* Order Details Section */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "600", margin: 0, color: "#1a1a1a" }}>
                Order Details
              </h3>
              <button
                type="button"
                onClick={handleAddNewOrder}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 20px",
                  backgroundColor: "#00368c",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  transition: "all 0.2s ease",
                  boxShadow: "0 2px 4px rgba(0, 54, 140, 0.2)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#002d6b";
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 54, 140, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#00368c";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 54, 140, 0.2)";
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Add New Order
              </button>
            </div>

            {formData.orders.map((order, index) => (
              <div
                key={order.id}
                style={{
                  marginBottom: "16px",
                  border: "1px solid #e2e2ea",
                  borderRadius: "8px",
                  backgroundColor: "#f8f9fa",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                  transition: "all 0.2s ease",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#00368c";
                  e.currentTarget.style.boxShadow = "0 2px 6px rgba(0, 54, 140, 0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e2e2ea";
                  e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.05)";
                }}
              >
                <div
                  onClick={() => toggleOrderExpand(order.id)}
                  style={{
                    padding: "12px 16px",
                    backgroundColor: "#f8f9fa",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    transition: "background-color 0.2s ease",
                    borderRadius: expandedOrders[order.id] ? "8px 8px 0 0" : "8px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#f0f1f5";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#f8f9fa";
                  }}
                >
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a" }}>
                    Order {index + 1}
                  </span>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                      type="button"
                      title="Add new order"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddNewOrder();
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "28px",
                        height: "28px",
                        backgroundColor: "#00368c",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        flexShrink: 0,
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#002d6b"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#00368c"; }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                        <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                    </button>
                    {formData.orders.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveOrder(order.id);
                        }}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#dc3545",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: "500",
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#c82333";
                          e.currentTarget.style.transform = "translateY(-1px)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#dc3545";
                          e.currentTarget.style.transform = "translateY(0)";
                        }}
                      >
                        Remove
                      </button>
                    )}
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{
                        transform: expandedOrders[order.id] ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.3s ease",
                        color: "#666",
                      }}
                    >
                      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                {expandedOrders[order.id] && (
                  <div style={{ padding: "16px", backgroundColor: "white", borderRadius: "0 0 8px 8px" }}>
                    <div className="row g-2 mb-1">
                      <div className="col-lg-4 col-md-6">
                        <FormField label="Order No">
                          <FormInput
                            type="text"
                            value={order.orderNo}
                            onChange={(e) => handleOrderChange(order.id, "orderNo", e.target.value)}
                            placeholder="Enter order number..."
                          />
                        </FormField>
                      </div>

                      <div className="col-lg-4 col-md-6">
                        <FormField label="PO/DO *">
                          <FormInput
                            type="text"
                            value={order.poDo}
                            onChange={(e) => {
                              handleOrderChange(order.id, "poDo", e.target.value);
                              if (formErrors[`o${index}_poDo`]) setFormErrors((prev) => { const e = { ...prev }; delete e[`o${index}_poDo`]; return e; });
                            }}
                            placeholder="Enter PO/DO number..."
                          />
                        </FormField>
                        {formErrors[`o${index}_poDo`] && <span style={{ color: "#dc3545", fontSize: "12px", display: "block", marginTop: "-12px", marginBottom: "4px" }}>{formErrors[`o${index}_poDo`]}</span>}
                      </div>

                      <div className="col-lg-4 col-md-6">
                        <FormField label="Quantity *">
                          <FormInput
                            type="number"
                            value={order.quantity}
                            onChange={(e) => {
                              handleOrderChange(order.id, "quantity", e.target.value);
                              if (formErrors[`o${index}_quantity`]) setFormErrors((prev) => { const e = { ...prev }; delete e[`o${index}_quantity`]; return e; });
                            }}
                            placeholder="Enter quantity..."
                          />
                        </FormField>
                        {formErrors[`o${index}_quantity`] && <span style={{ color: "#dc3545", fontSize: "12px", display: "block", marginTop: "-12px", marginBottom: "4px" }}>{formErrors[`o${index}_quantity`]}</span>}
                      </div>

                      <div className="col-lg-6 col-md-12">
                        <FormField label="Description">
                          <FormInput
                            type="text"
                            value={order.description}
                            onChange={(e) => handleOrderChange(order.id, "description", e.target.value)}
                            placeholder="Enter description..."
                          />
                        </FormField>
                      </div>

                      <div className="col-lg-6 col-md-12">
                        <FormField label="Package Type *">
                          <FormSelect
                            value={order.packageType}
                            onChange={(e) => {
                              handleOrderChange(order.id, "packageType", e.target.value);
                              if (formErrors[`o${index}_packageType`]) setFormErrors((prev) => { const e = { ...prev }; delete e[`o${index}_packageType`]; return e; });
                            }}
                            options={mergeOptionForValue(packageTypeOptions, order.packageType)}
                            placeholder="Select package type..."
                          />
                        </FormField>
                        {formErrors[`o${index}_packageType`] && <span style={{ color: "#dc3545", fontSize: "12px", display: "block", marginTop: "-12px", marginBottom: "4px" }}>{formErrors[`o${index}_packageType`]}</span>}
                      </div>
                    </div>

                    {/* Transportation Section */}
                    <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid #e2e2ea" }}>
                      <div style={{ marginBottom: "10px" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={order.transportation || false}
                            onChange={(e) => handleOrderChange(order.id, "transportation", e.target.checked)}
                            style={{ cursor: "pointer", width: "18px", height: "18px" }}
                          />
                          <span style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a" }}>Transportation</span>
                        </label>
                      </div>

                      {order.transportation && (
                        <div className="row g-2 mb-1">
                          <div className="col-lg-4 col-md-6">
                            <FormField label="Type of Vehicle *">
                              <FormSelect
                                value={order.typeOfVehicle}
                                onChange={(e) => {
                                  handleOrderChange(order.id, "typeOfVehicle", e.target.value);
                                  if (formErrors[`o${index}_typeOfVehicle`]) setFormErrors((prev) => { const e = { ...prev }; delete e[`o${index}_typeOfVehicle`]; return e; });
                                }}
                                options={mergeOptionForValue(materialVehicleOptions, order.typeOfVehicle)}
                                placeholder="Select type of vehicle..."
                              />
                            </FormField>
                            {formErrors[`o${index}_typeOfVehicle`] && <span style={{ color: "#dc3545", fontSize: "12px", display: "block", marginTop: "-12px", marginBottom: "4px" }}>{formErrors[`o${index}_typeOfVehicle`]}</span>}
                          </div>

                          <div className="col-lg-4 col-md-6">
                            <FormField label="From Location *">
                              <FormSelect
                                value={order.fromLocation}
                                onChange={(e) => {
                                  handleOrderChange(order.id, "fromLocation", e.target.value);
                                  if (formErrors[`o${index}_fromLocation`]) setFormErrors((prev) => { const e = { ...prev }; delete e[`o${index}_fromLocation`]; return e; });
                                }}
                                options={mergeOptionForValue(warehouseLocationOptions, order.fromLocation)}
                                placeholder="Select from location..."
                              />
                            </FormField>
                            {formErrors[`o${index}_fromLocation`] && <span style={{ color: "#dc3545", fontSize: "12px", display: "block", marginTop: "-12px", marginBottom: "4px" }}>{formErrors[`o${index}_fromLocation`]}</span>}
                          </div>

                          <div className="col-lg-4 col-md-6">
                            <FormField label="Pick-Up From">
                              <FormInput
                                type="text"
                                value={order.pickUpFrom}
                                onChange={(e) => handleOrderChange(order.id, "pickUpFrom", e.target.value)}
                                placeholder="Enter pick-up location..."
                              />
                            </FormField>
                          </div>

                          <div className="col-lg-4 col-md-6">
                            <FormField label="To Location *">
                              <FormSelect
                                value={order.toLocation}
                                onChange={(e) => {
                                  handleOrderChange(order.id, "toLocation", e.target.value);
                                  if (formErrors[`o${index}_toLocation`]) setFormErrors((prev) => { const e = { ...prev }; delete e[`o${index}_toLocation`]; return e; });
                                }}
                                options={mergeOptionForValue(warehouseLocationOptions, order.toLocation)}
                                placeholder="Select to location..."
                              />
                            </FormField>
                            {formErrors[`o${index}_toLocation`] && <span style={{ color: "#dc3545", fontSize: "12px", display: "block", marginTop: "-12px", marginBottom: "4px" }}>{formErrors[`o${index}_toLocation`]}</span>}
                          </div>

                          <div className="col-lg-4 col-md-6">
                            <FormField label="Driver Name *">
                              <FormSelect
                                value={order.driverName}
                                onChange={(e) => {
                                  handleOrderChange(order.id, "driverName", e.target.value);
                                  if (formErrors[`o${index}_driverName`]) setFormErrors((prev) => { const e = { ...prev }; delete e[`o${index}_driverName`]; return e; });
                                }}
                                options={mergeOptionForValue(materialDriverOptions, order.driverName)}
                                placeholder="Select driver name..."
                              />
                            </FormField>
                            {formErrors[`o${index}_driverName`] && <span style={{ color: "#dc3545", fontSize: "12px", display: "block", marginTop: "-12px", marginBottom: "4px" }}>{formErrors[`o${index}_driverName`]}</span>}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Plus button to add next order item without scrolling up */}
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "14px", paddingTop: "12px", borderTop: "1px solid #e2e2ea" }}>
                      <button
                        type="button"
                        onClick={handleAddNewOrder}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 14px",
                          backgroundColor: "#00368c",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "13px",
                          fontWeight: "500",
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        Add Order
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </form>
      </div>
    </div>
  );

  const renderFooter = () => (
    <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between", padding: "16px 24px" }}>
      <button
        type="button"
        onClick={handleReset}
        style={{
          padding: "10px 20px",
          backgroundColor: "#f5f5f5",
          color: "#333",
          border: "1px solid #e2e2ea",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: "500",
        }}
      >
        Reset
      </button>
      <div style={{ display: "flex", gap: "12px" }}>
        <button
          type="button"
          onClick={handleCloseModal}
          style={{
            padding: "10px 20px",
            backgroundColor: "#f5f5f5",
            color: "#333",
            border: "1px solid #e2e2ea",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "500",
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          form="inboundOrderForm"
          disabled={isSubmitting || isBeingUpdated}
          style={{
            padding: "10px 20px",
            backgroundColor: "#00368c",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: (isSubmitting || isBeingUpdated) ? "not-allowed" : "pointer",
            fontSize: "14px",
            fontWeight: "500",
            opacity: (isSubmitting || isBeingUpdated) ? 0.7 : 1,
          }}
        >
          {editingOrder ? (isBeingUpdated ? "Updating..." : "Update") : (isSubmitting ? "Saving..." : "Save")}
        </button>
      </div>
    </div>
  );

  // Convert to Landing Modal Render Functions
  const renderConvertHeader = () => (
    <>
      <h1 className="modal-title">Convert to Landing Note</h1>
    </>
  );

  const renderConvertBody = () => (
    <div className="modal-body">
      <div className="lead-form">
        <form id="convertToLandingForm" onSubmit={handleConvertSubmit}>
          {/* Basic Details Section */}
          <div style={{ marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid #e2e2ea" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "14px", color: "#1a1a1a" }}>
              Basic Details
            </h3>
            <div className="row g-2 mb-2">
              <div className="col-md-6 mb-2">
                <FormField label="Date *">
                  <DateTimePickerField
                    dateValue={convertFormData.date}
                    timeValue={convertFormData.time}
                    onDateTimeChange={(nextValues) => {
                      setConvertFormData((prev) => ({ ...prev, date: nextValues.date, time: nextValues.time }));
                      if (convertFormErrors.date) setConvertFormErrors((prev) => { const n = { ...prev }; delete n.date; return n; });
                    }}
                    dateFieldName="date"
                    timeFieldName="time"
                    placeholder="YYYY-MM-DD hh:mm"
                    hasError={!!convertFormErrors.date}
                  />
                </FormField>
                {convertFormErrors.date && <span style={{ color: "#dc3545", fontSize: "12px", display: "block", marginTop: "-12px", marginBottom: "4px" }}>{convertFormErrors.date}</span>}
              </div>

              <div className="col-md-6 mb-2">
                <FormField label="Warehouse">
                  <div className="cf-input" style={{ backgroundColor: "#f5f5f5", cursor: "not-allowed" }}>
                    <input
                      type="text"
                      value={warehouseLocationOptions.find(o => o.value === convertFormData.warehouse)?.label || convertFormData.warehouse || ""}
                      readOnly
                      style={{ background: "transparent", cursor: "not-allowed", color: "#555" }}
                    />
                  </div>
                </FormField>
              </div>
            </div>

            {/* Receipt Details Section */}
            <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #e2e2ea" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "14px", color: "#1a1a1a" }}>
                Receipt Details
              </h3>
              <div className="row g-2 mb-2">
                <div className="col-md-6 mb-2">
                  <FormField label="Received From *">
                    <FormInput
                      type="text"
                      value={convertFormData.receivedFrom}
                      onChange={(e) => {
                        handleConvertFormChange("receivedFrom", e.target.value);
                        if (convertFormErrors.receivedFrom) setConvertFormErrors((prev) => { const n = { ...prev }; delete n.receivedFrom; return n; });
                      }}
                      placeholder="Enter received from..."
                      className={convertFormErrors.receivedFrom ? "is-invalid" : ""}
                    />
                  </FormField>
                  {convertFormErrors.receivedFrom && <span style={{ color: "#dc3545", fontSize: "12px", display: "block", marginTop: "-12px", marginBottom: "4px" }}>{convertFormErrors.receivedFrom}</span>}
                </div>

                <div className="col-md-6 mb-2">
                  <FormField label="Location *">
                    <FormInput
                      type="text"
                      value={convertFormData.location}
                      onChange={(e) => {
                        handleConvertFormChange("location", e.target.value);
                        if (convertFormErrors.location) setConvertFormErrors((prev) => { const n = { ...prev }; delete n.location; return n; });
                      }}
                      placeholder="Enter location..."
                      className={convertFormErrors.location ? "is-invalid" : ""}
                    />
                  </FormField>
                  {convertFormErrors.location && <span style={{ color: "#dc3545", fontSize: "12px", display: "block", marginTop: "-12px", marginBottom: "4px" }}>{convertFormErrors.location}</span>}
                </div>

                <div className="col-md-6 mb-2">
                  <FormField label="Signature">
                    <FormInput
                      type="text"
                      value={convertFormData.signature}
                      onChange={(e) => handleConvertFormChange("signature", e.target.value)}
                      placeholder="Enter signature..."
                    />
                  </FormField>
                </div>
              </div>
            </div>
          </div>

          {/* Order Details Section */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "600", margin: 0, color: "#1a1a1a" }}>
                Order Details
              </h3>
              <button
                type="button"
                onClick={handleAddNewConvertOrder}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 20px",
                  backgroundColor: "#00368c",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  transition: "all 0.2s ease",
                  boxShadow: "0 2px 4px rgba(0, 54, 140, 0.2)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#002d6b";
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 54, 140, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#00368c";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 54, 140, 0.2)";
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Add New Order
              </button>
            </div>

            {convertFormData.orders.map((order, index) => (
              <div
                key={order.id}
                style={{
                  marginBottom: "16px",
                  border: "1px solid #e2e2ea",
                  borderRadius: "8px",
                  backgroundColor: "#f8f9fa",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                  transition: "all 0.2s ease",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#00368c";
                  e.currentTarget.style.boxShadow = "0 2px 6px rgba(0, 54, 140, 0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e2e2ea";
                  e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.05)";
                }}
              >
                <div
                  onClick={() => toggleConvertOrderExpand(order.id)}
                  style={{
                    padding: "12px 16px",
                    backgroundColor: "#f8f9fa",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    transition: "background-color 0.2s ease",
                    borderRadius: expandedConvertOrders[order.id] ? "8px 8px 0 0" : "8px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#f0f1f5";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#f8f9fa";
                  }}
                >
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a" }}>
                    Order {index + 1}
                  </span>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    {convertFormData.orders.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveConvertOrder(order.id);
                        }}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#dc3545",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: "500",
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#c82333";
                          e.currentTarget.style.transform = "translateY(-1px)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#dc3545";
                          e.currentTarget.style.transform = "translateY(0)";
                        }}
                      >
                        Remove
                      </button>
                    )}
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{
                        transform: expandedConvertOrders[order.id] ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.3s ease",
                        color: "#666",
                      }}
                    >
                      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                {expandedConvertOrders[order.id] && (
                  <div style={{ padding: "16px", backgroundColor: "white", borderRadius: "0 0 8px 8px" }}>

                    {/* Read-only inbound order details */}
                    <div style={{ backgroundColor: "#f8f9fa", borderRadius: "6px", padding: "12px", marginBottom: "14px" }}>
                      <p style={{ fontSize: "12px", color: "#888", margin: "0 0 8px 0", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>Inbound Order Details (Read-only)</p>
                      <div className="row g-2">
                        {order.orderNo && (
                          <div className="col-lg-4 col-md-6">
                            <FormField label="Order No">
                              <div className="cf-input" style={{ backgroundColor: "#ececec", cursor: "not-allowed" }}>
                                <input type="text" value={order.orderNo} readOnly style={{ background: "transparent", cursor: "not-allowed", color: "#555" }} />
                              </div>
                            </FormField>
                          </div>
                        )}
                        {order.poDo && (
                          <div className="col-lg-4 col-md-6">
                            <FormField label="PO/DO">
                              <div className="cf-input" style={{ backgroundColor: "#ececec", cursor: "not-allowed" }}>
                                <input type="text" value={order.poDo} readOnly style={{ background: "transparent", cursor: "not-allowed", color: "#555" }} />
                              </div>
                            </FormField>
                          </div>
                        )}
                        <div className="col-lg-4 col-md-6">
                          <FormField label="Quantity">
                            <div className="cf-input" style={{ backgroundColor: "#ececec", cursor: "not-allowed" }}>
                              <input type="text" value={order.quantity} readOnly style={{ background: "transparent", cursor: "not-allowed", color: "#555" }} />
                            </div>
                          </FormField>
                        </div>
                        {order.description && (
                          <div className="col-lg-6 col-md-12">
                            <FormField label="Description">
                              <div className="cf-input" style={{ backgroundColor: "#ececec", cursor: "not-allowed" }}>
                                <input type="text" value={order.description} readOnly style={{ background: "transparent", cursor: "not-allowed", color: "#555" }} />
                              </div>
                            </FormField>
                          </div>
                        )}
                        {order.packageType && (
                          <div className="col-lg-6 col-md-12">
                            <FormField label="Package Type">
                              <div className="cf-input" style={{ backgroundColor: "#ececec", cursor: "not-allowed" }}>
                                <input type="text" value={packageTypeOptions.find(o => o.value === order.packageType)?.label || order.packageType} readOnly style={{ background: "transparent", cursor: "not-allowed", color: "#555" }} />
                              </div>
                            </FormField>
                          </div>
                        )}
                        {order.transportation && (
                          <>
                            {order.typeOfVehicle && <div className="col-lg-4 col-md-6"><FormField label="Vehicle Type"><div className="cf-input" style={{ backgroundColor: "#ececec", cursor: "not-allowed" }}><input type="text" value={materialVehicleOptions.find(o => o.value === order.typeOfVehicle)?.label || order.typeOfVehicle} readOnly style={{ background: "transparent", cursor: "not-allowed", color: "#555" }} /></div></FormField></div>}
                            {order.fromLocation && <div className="col-lg-4 col-md-6"><FormField label="From Location"><div className="cf-input" style={{ backgroundColor: "#ececec", cursor: "not-allowed" }}><input type="text" value={warehouseLocationOptions.find(o => o.value === order.fromLocation)?.label || order.fromLocation} readOnly style={{ background: "transparent", cursor: "not-allowed", color: "#555" }} /></div></FormField></div>}
                            {order.pickUpFrom && <div className="col-lg-4 col-md-6"><FormField label="Pick-Up From"><div className="cf-input" style={{ backgroundColor: "#ececec", cursor: "not-allowed" }}><input type="text" value={order.pickUpFrom} readOnly style={{ background: "transparent", cursor: "not-allowed", color: "#555" }} /></div></FormField></div>}
                            {order.toLocation && <div className="col-lg-4 col-md-6"><FormField label="To Location"><div className="cf-input" style={{ backgroundColor: "#ececec", cursor: "not-allowed" }}><input type="text" value={warehouseLocationOptions.find(o => o.value === order.toLocation)?.label || order.toLocation} readOnly style={{ background: "transparent", cursor: "not-allowed", color: "#555" }} /></div></FormField></div>}
                            {order.driverName && <div className="col-lg-4 col-md-6"><FormField label="Driver"><div className="cf-input" style={{ backgroundColor: "#ececec", cursor: "not-allowed" }}><input type="text" value={materialDriverOptions.find(o => o.value === order.driverName)?.label || order.driverName} readOnly style={{ background: "transparent", cursor: "not-allowed", color: "#555" }} /></div></FormField></div>}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Editable landing note fields */}
                    <div className="row g-2 mb-1">
                      <div className="col-lg-4 col-md-6">
                        <FormField label="Slot No">
                          <FormSelect
                            value={order.slotNo}
                            onChange={(e) => handleConvertOrderChange(order.id, "slotNo", e.target.value)}
                            options={slotNoOptions}
                            placeholder="Select slot no..."
                          />
                        </FormField>
                      </div>

                      <div className="col-lg-4 col-md-6">
                        <FormField label="Reason">
                          <FormSelect
                            value={order.reason}
                            onChange={(e) => handleConvertOrderChange(order.id, "reason", e.target.value)}
                            options={reasonOptions}
                            placeholder="Select reason..."
                          />
                        </FormField>
                      </div>

                      <div className="col-lg-4 col-md-6">
                        <FormField label="Dispatch Date">
                          <DateTimePickerField
                            dateValue={order.dispatchDate || ""}
                            timeValue=""
                            onDateTimeChange={(nextValues) => {
                              handleConvertOrderChange(order.id, "dispatchDate", nextValues.date || "");
                            }}
                            dateFieldName={`co_${order.id}_dispatchDate`}
                            timeFieldName=""
                            placeholder="YYYY-MM-DD"
                          />
                        </FormField>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Documents & Remarks Section - Outside Order Details */}
          <div style={{ marginTop: "32px", paddingTop: "24px", borderTop: "2px solid #e2e2ea" }}>
            <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "20px", color: "#1a1a1a" }}>
              Documents & Remarks
            </h3>

            {/* Document Upload - Full Width */}
            <div className="mb-lg-3 mb-sm-0" style={{ marginBottom: "24px" }}>
              <FormField label="Document Upload *">
                <div style={{ marginTop: "8px" }}>
                  <AttachmentsList
                    attachments={convertFormData.documents || []}
                    onAdd={() => { }}
                    onRemove={handleDocumentsRemove}
                    cardColor={cardColor}
                    isDragging={isDraggingDocuments}
                    onDragEnter={handleDocumentsDragEnter}
                    onDragLeave={handleDocumentsDragLeave}
                    onDragOver={handleDocumentsDragOver}
                    onDrop={handleDocumentsDrop}
                    fileInputRef={documentsFileInputRef}
                    onFileInputChange={handleDocumentsFileInputChange}
                  />
                  {convertFormErrors.file && (
                    <span style={{ color: "#dc3545", fontSize: "12px", display: "block", marginTop: "4px" }}>
                      {convertFormErrors.file}
                    </span>
                  )}
                </div>
              </FormField>
            </div>

            {/* Remarks - Full Width, Below Document Upload */}
            <div className="mb-lg-3 mb-sm-0">
              <div className="card-description-wrapper">
                <FormField label="Remarks">
                  <ReactQuillEditor
                    value={convertFormData.remarks || ""}
                    onChange={(e) => handleConvertFormChange("remarks", e.target.value)}
                    placeholder="Enter remarks..."
                    name="remarks"
                  />
                </FormField>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  const renderConvertFooter = () => (
    <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "12px", padding: "16px 24px" }}>
      <button
        type="button"
        onClick={handleCloseConvertModal}
        style={{ padding: "10px 20px", backgroundColor: "#f5f5f5", color: "#333", border: "1px solid #e2e2ea", borderRadius: "6px", cursor: "pointer", fontSize: "14px", fontWeight: "500" }}
      >
        Cancel
      </button>
      <button
        type="submit"
        form="convertToLandingForm"
        disabled={isBeingConverted}
        style={{ padding: "10px 20px", backgroundColor: "#00368c", color: "white", border: "none", borderRadius: "6px", cursor: isBeingConverted ? "not-allowed" : "pointer", fontSize: "14px", fontWeight: "500", opacity: isBeingConverted ? 0.7 : 1 }}
      >
        {isBeingConverted ? "Converting..." : "Convert"}
      </button>
    </div>
  );

  // View Order Modal Render Functions
  const renderViewHeader = () => (
    <>
      <h1 className="modal-title">View Inbound Order Details</h1>
    </>
  );

  const renderViewBody = () => {
    if (isLoadingView) {
      return (
        <div className="modal-body">
          <div style={{ textAlign: "center", padding: "40px", color: "#666", fontSize: "15px" }}>Loading...</div>
        </div>
      );
    }

    if (!viewingOrder) return null;

    const items = Array.isArray(viewingOrder.items) ? viewingOrder.items : [];

    return (
      <div className="modal-body">
        <div className="view-vessel-container" style={{ padding: "20px" }}>
          {/* Inbound Header */}
          <div className="view-row" style={{ display: "flex", flexWrap: "wrap", gap: "20px", marginBottom: "20px" }}>
            <div className="view-item" style={{ flex: "1", minWidth: "200px" }}>
              <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>Inbound No</div>
              <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{viewingOrder.inbound_no || "-"}</div>
            </div>
            <div className="view-item" style={{ flex: "1", minWidth: "200px" }}>
              <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>Date</div>
              <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{formatDate(viewingOrder.inbound_date, viewingOrder.inbound_time || viewingOrder.time) || "-"}</div>
            </div>
          </div>

          {viewingOrder.remarks && (
            <div className="view-row" style={{ marginBottom: "20px" }}>
              <div className="view-item" style={{ width: "100%" }}>
                <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>Remarks</div>
                <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{viewingOrder.remarks}</div>
              </div>
            </div>
          )}

          {/* Items */}
          {items.length > 0 && (
            <div style={{ borderTop: "1px solid #e2e2ea", paddingTop: "20px", marginTop: "4px" }}>
              <h4 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px", color: "#1a1a1a" }}>Order Items</h4>
              {items.map((item, idx) => (
                <div key={item.inbound_item_id || idx} style={{ marginBottom: "24px", padding: "16px", backgroundColor: "#f9f9f9", borderRadius: "8px", border: "1px solid #e2e2ea" }}>
                  <div style={{ fontWeight: "600", color: "#00368c", marginBottom: "12px", fontSize: "14px" }}>
                    Item {idx + 1}{item.order_no ? ` — ${item.order_no}` : ""}
                  </div>
                  <div className="view-row" style={{ display: "flex", flexWrap: "wrap", gap: "20px", marginBottom: "12px" }}>
                    <div className="view-item" style={{ flex: "1", minWidth: "160px" }}>
                      <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "6px", fontSize: "13px" }}>PO/DO</div>
                      <div className="view-value" style={{ color: "#1a1a1a", fontSize: "14px" }}>{item.po_no || "-"}</div>
                    </div>
                    <div className="view-item" style={{ flex: "1", minWidth: "160px" }}>
                      <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "6px", fontSize: "13px" }}>Quantity</div>
                      <div className="view-value" style={{ color: "#1a1a1a", fontSize: "14px" }}>{item.quantity ?? "-"}</div>
                    </div>
                    <div className="view-item" style={{ flex: "1", minWidth: "160px" }}>
                      <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "6px", fontSize: "13px" }}>Package Type</div>
                      <div className="view-value" style={{ color: "#1a1a1a", fontSize: "14px" }}>
                        {item.package_type ||
                          packageTypeOptions.find((o) => o.value === String(item.package_type_id))?.label ||
                          "-"}
                      </div>
                    </div>
                  </div>
                  {item.description && (
                    <div className="view-row" style={{ marginBottom: "12px" }}>
                      <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "6px", fontSize: "13px" }}>Description</div>
                      <div className="view-value" style={{ color: "#1a1a1a", fontSize: "14px" }}>{item.description}</div>
                    </div>
                  )}
                  {item.transportation_required === 1 && item.transportation && (
                    <div style={{ borderTop: "1px dashed #ccc", paddingTop: "12px", marginTop: "8px" }}>
                      <div style={{ fontWeight: "600", color: "#555", marginBottom: "10px", fontSize: "13px" }}>Transportation</div>
                      <div className="view-row" style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
                        <div className="view-item" style={{ flex: "1", minWidth: "140px" }}>
                          <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "6px", fontSize: "13px" }}>Pick-Up From</div>
                          <div className="view-value" style={{ color: "#1a1a1a", fontSize: "14px" }}>{item.transportation.pickup_location || "-"}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderViewFooter = () => (
    <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "12px", padding: "16px 24px" }}>
      <button
        type="button"
        onClick={handleCloseViewModal}
        style={{
          padding: "10px 20px",
          backgroundColor: "#f5f5f5",
          color: "#333",
          border: "1px solid #e2e2ea",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: "500",
        }}
      >
        Close
      </button>
      {viewingOrder && (
        <button
          type="button"
          onClick={() => handlePrintOrder(viewingOrder)}
          style={{
            padding: "10px 20px",
            backgroundColor: "#00368c",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "500",
          }}
        >
          Print
        </button>
      )}
    </div>
  );

  return (
    <div className="cardform-left-full material-management-content-wrapper" style={{ "--card-color": cardColor }}>
      <div className="material-list-header">
        <h3 className="material-list-title">
          <span className="material-list-title-bar"></span>
          Inbound Orders
        </h3>
        <button
          type="button"
          className="material-add-btn"
          onClick={() => handleOpenModal()}
          style={{ backgroundColor: "#00368c" }}
        >
          + Add
        </button>
      </div>
      <div className="table-wrapper table-responsive material-table-container" style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 330px)", minHeight: 0 }}>
        <table className="table table-striped material-table inbound-table" style={{ "--card-color": "#e2e6ff", tableLayout: "fixed" }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 1, backgroundColor: "#fff" }}>
            <tr>
              <th>Order No</th>
              <th>Date</th>
              <th>PO/DO</th>
              <th>Quantity</th>
              <th>Package Type</th>
              <th>Description</th>
              <th style={{ paddingLeft: "28px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoadingOrders ? (
              <tr>
                <td colSpan="7" style={{ textAlign: "center", padding: "20px", color: "#666" }}>Loading...</td>
              </tr>
            ) : inboundOrders.length > 0 ? (
              inboundOrders.map((order) => {
                const firstItem = Array.isArray(order.items) ? order.items[0] : null;
                const rowKey = order.inbound_id ?? order.id ?? Math.random();
                const description = firstItem?.description || "";
                return (
                <tr key={rowKey}>
                  <td>
                    <div className="material-table-cell">{order.inbound_no || ""}</div>
                  </td>
                  <td>
                    <div className="material-table-cell">
                      {formatDate(order.inbound_date || order.date, order.inbound_time || order.time)}
                    </div>
                  </td>
                  <td>
                    <div className="material-table-cell">{firstItem?.po_no || ""}</div>
                  </td>
                  <td>
                    <div className="material-table-cell">{firstItem?.quantity ?? ""}</div>
                  </td>
                  <td>
                    <div className="material-table-cell">
                      {firstItem?.package_type ||
                        packageTypeOptions.find((o) => o.value === String(firstItem?.package_type_id))?.label ||
                        ""}
                    </div>
                  </td>
                  <td>
                    <div className="material-table-cell">
                      {description.length > 25 ? (
                        <>
                          <Tooltip
                            id={`description-tooltip-${rowKey}`}
                            place="right"
                            content={description}
                            className="material-table-tooltip"
                          />
                          <span
                            data-tooltip-id={`description-tooltip-${rowKey}`}
                            style={{ cursor: "help" }}
                          >
                            {description.substring(0, 25)}...
                          </span>
                        </>
                      ) : (
                        <span>{description}</span>
                      )}
                    </div>
                  </td>
                  <td style={{ position: "relative", overflow: "visible" }}>
                    <div className="material-table-cell" style={{ position: "relative", overflow: "visible", display: "flex", alignItems: "center", gap: "8px", justifyContent: "flex-start" }}>
                      <Tooltip id={`view-order-${rowKey}`} place="left" content="View" />
                      <button
                        type="button"
                        onClick={() => handleViewOrder(order)}
                        data-tooltip-id={`view-order-${rowKey}`}
                        style={{
                          padding: "6px 8px",
                          backgroundColor: "transparent",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#00368c",
                          transition: "background-color 0.2s"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#f0f0f0";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        <img src={eyeIcon} alt="view" style={{ width: "18px", height: "18px" }} />
                      </button>
                      <Tooltip id={`print-order-${rowKey}`} place="left" content="Print" />
                      <button
                        type="button"
                        onClick={() => handlePrintOrder(order)}
                        data-tooltip-id={`print-order-${rowKey}`}
                        style={{
                          padding: "6px 8px",
                          backgroundColor: "transparent",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#00368c",
                          transition: "background-color 0.2s"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#f0f0f0";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M6 9V2H18V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M6 18H4C2.89543 18 2 17.1046 2 16V11C2 9.89543 2.89543 9 4 9H20C21.1046 9 22 9.89543 22 11V16C22 17.1046 21.1046 18 20 18H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M18 14H6V22H18V14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M18 9H6V14H18V9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <Tooltip id={`convert-order-${rowKey}`} place="left" content=" Convert" />
                      <button
                        type="button"
                        onClick={() => handleConvertToLanding(order)}
                        data-tooltip-id={`convert-order-${rowKey}`}
                        style={{
                          padding: "6px 8px",
                          backgroundColor: "transparent",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#00368c",
                          transition: "background-color 0.2s"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#f0f0f0";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M2 18L4 16L6 18L8 16L10 18L12 16L14 18L16 16L18 18L20 16L22 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M2 10L12 4L22 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M12 4V18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <div className="action-dropdown-wrapper" style={{ position: "relative", display: "inline-block", zIndex: openDropdownId === rowKey ? 9999 : "auto" }}>
                        <Tooltip id={`more-actions-${rowKey}`} place="left" content="More actions" />
                        <button
                          type="button"
                          onClick={(e) => handleToggleDropdown(rowKey, e)}
                          data-tooltip-id={`more-actions-${rowKey}`}
                          style={{
                            padding: "6px 8px",
                            backgroundColor: "transparent",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#00368c"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#f0f0f0";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent";
                          }}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="6" r="1.5" fill="currentColor" />
                            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                            <circle cx="12" cy="18" r="1.5" fill="currentColor" />
                          </svg>
                        </button>
                        {openDropdownId === rowKey && createPortal(
                          <div
                            data-dropdown-menu
                            style={{
                              position: "fixed",
                              top: `${dropdownPosition.top}px`,
                              right: `${dropdownPosition.right}px`,
                              backgroundColor: "white",
                              border: "1px solid #e2e2ea",
                              borderRadius: "6px",
                              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                              zIndex: 99999,
                              minWidth: "180px",
                              padding: "4px 0"
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                handleCloseDropdown();
                                handleOpenModal(order);
                              }}
                              style={{
                                width: "100%",
                                padding: "10px 16px",
                                backgroundColor: "transparent",
                                border: "none",
                                textAlign: "left",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                fontSize: "14px",
                                color: "#1a1a1a",
                                transition: "background-color 0.2s"
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = "#f5f5f5";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "transparent";
                              }}
                            >
                              <img src={editIcon} alt="edit" style={{ width: "16px", height: "16px" }} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleDelete(order);
                              }}
                              style={{
                                width: "100%",
                                padding: "10px 16px",
                                backgroundColor: "transparent",
                                border: "none",
                                textAlign: "left",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                fontSize: "14px",
                                color: "#dc3545",
                                transition: "background-color 0.2s"
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = "#f5f5f5";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "transparent";
                              }}
                            >
                              <img src={deleteIcon} alt="delete" style={{ width: "16px", height: "16px" }} />
                              <span>Delete</span>
                            </button>
                          </div>,
                          document.body
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="7" style={{ textAlign: "center", padding: "20px" }}>
                  No inbound orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
        <MaterialTablePagination
          page={inboundPage}
          total={inboundTotal}
          limit={INBOUND_LIMIT}
          onPageChange={setInboundPage}
        />
      </div>

      <CustomModal
        className="material-management-modal inbound-orders-modal"
        show={showModal}
        closeModal={handleCloseModal}
        header={renderHeader()}
        body={renderBody()}
        footer={renderFooter()}
        dialgName="modal-dialog modal-dialog-centered"
      />

      <CustomModal
        className="material-management-modal inbound-orders-modal"
        show={showConvertModal}
        closeModal={handleCloseConvertModal}
        header={renderConvertHeader()}
        body={renderConvertBody()}
        footer={renderConvertFooter()}
        dialgName="modal-dialog modal-dialog-centered"
      />

      <CustomModal
        className="material-management-modal inbound-orders-modal"
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
        deleteText={`Are you sure you want to delete inbound order ${deletingOrder?.inbound_no || deletingOrder?.order_no || deletingOrder?.orderNo || `#${deletingOrder?.inbound_id ?? deletingOrder?.id ?? ""}`}?`}
        isLoading={isLoadingDelete}
      />
    </div>
  );
};

InboundOrdersContent.propTypes = {
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
  cardColor: PropTypes.string,
};

export default InboundOrdersContent;

