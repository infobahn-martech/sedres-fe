import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import CustomModal from "../../../../../../components/CustomModal";
import { FormField, FormInput, FormSelect } from "./Husbandry.components";
import editIcon from "../../../../../../assets/images/edit.svg";
import deleteIcon from "../../../../../../assets/images/delete.svg";
import eyeIcon from "../../../../../../assets/images/eye.svg";
import logisticsWarehouseService from "../../../../../../services/logisticsWarehouseService";
import packingTypeService from "../../../../../../services/packingTypeService";
import vehicleService from "../../../../../../services/vehicleService";

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
    <div className="attachment-list-wrapper">
      <div className="attachment-upload-section">
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
            <div className="upload-icon-wrapper">
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ color: cardColor || "#00368c" }}
              >
                <path
                  d="M12 15V3M12 3L8 7M12 3L16 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 17L2 18C2 19.1046 2.89543 20 4 20L20 20C21.1046 20 22 19.1046 22 18L22 17"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M7 11L12 6L17 11"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="upload-text-content">
              <p className="upload-main-text">
                Drag and drop your files here, or{" "}
                <span className="upload-link">click to browse</span>
              </p>
              <p className="upload-sub-text">Supports all file formats</p>
            </div>
            {attachments.length > 0 && (
              <div className="upload-zone-files-list">
                {attachments.map((item, index) => (
                  <div key={index} className="upload-zone-file-item">
                    <span className="upload-zone-file-name">{item.name || item}</span>
                    <button
                      className="upload-zone-remove-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(index);
                      }}
                      type="button"
                      title="Remove file"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ReactQuillEditor Component (from Operation.jsx)
const ReactQuillEditor = ({ value, onChange, placeholder, name = "remarks", className = "" }) => {
  const quillRef = useRef(null);

  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ color: [] }, { background: [] }],
      ["link", "image"],
      ["clean"],
    ],
  };

  const formats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "list",
    "bullet",
    "color",
    "background",
    "link",
    "image",
  ];

  const handleChange = (content) => {
    const syntheticEvent = { target: { value: content, name: name } };
    onChange(syntheticEvent);
  };

  return (
    <div className={`react-quill-wrapper ${className}`}>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value || ""}
        onChange={handleChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder || "Enter remarks..."}
      />
    </div>
  );
};

const InboundOrdersContent = ({ formValues, handleChange, cardColor }) => {
  const [showModal, setShowModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [ordersList, setOrdersList] = useState([]);
  const [editingOrder, setEditingOrder] = useState(null);
  const [convertingOrder, setConvertingOrder] = useState(null);
  const [viewingOrder, setViewingOrder] = useState(null);
  const [expandedOrders, setExpandedOrders] = useState({ 1: true }); // First order expanded by default
  const [expandedConvertOrders, setExpandedConvertOrders] = useState({ 1: true });
  const [isDraggingDocuments, setIsDraggingDocuments] = useState(false);
  const documentsFileInputRef = useRef(null);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const dropdownButtonRefs = useRef({});
  const [inboundPage, setInboundPage] = useState(1);
  const INBOUND_LIMIT = 5;

  // Form state - Basic Details
  const [formData, setFormData] = useState({
    date: "",
    warehouse: "",
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
    warehouse: "",
    receivedFrom: "",
    location: "",
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
          vehicleService.getMaterialVehicles(),
          vehicleService.getMaterialDrivers(),
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

  // Initialize with dummy data on mount if empty
  useEffect(() => {
    const orders = formValues.inboundOrdersList || [];
    if (orders.length === 0) {
      const dummyData = generateDummyInboundOrders();
      const syntheticEvent = { target: { value: dummyData } };
      handleChange("inboundOrdersList")(syntheticEvent);
      setOrdersList(dummyData);
    } else {
      setOrdersList(orders);
    }
  }, [formValues.inboundOrdersList, handleChange]);

  // Update local list when formValues change
  useEffect(() => {
    if (formValues.inboundOrdersList) {
      setOrdersList(formValues.inboundOrdersList);
    }
  }, [formValues.inboundOrdersList]);

  const handleOpenModal = (order = null) => {
    if (order) {
      setEditingOrder(order);
      const orderItems = order.orders || [{
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
      }];
      setFormData({
        date: order.date || "",
        warehouse: order.warehouse || "",
        orders: orderItems,
      });
      // Set expanded state for all orders
      const expandedState = {};
      orderItems.forEach((item) => {
        expandedState[item.id] = true;
      });
      setExpandedOrders(expandedState);
    } else {
      setEditingOrder(null);
      setFormData({
        date: "",
        warehouse: "",
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
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingOrder(null);
    setFormData({
      date: "",
      warehouse: "",
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

  const handleAddNewOrder = () => {
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

  const handleSubmit = (e) => {
    e.preventDefault();

    // Create orders from formData.orders array
    const newOrders = formData.orders.map((order, index) => ({
      id: editingOrder
        ? editingOrder.id + index
        : ordersList.length > 0
          ? Math.max(...ordersList.map((m) => m.id)) + index + 1
          : index + 1,
      orderNo: order.orderNo || `ORD-${String(ordersList.length + index + 1).padStart(5, "0")}`,
      date: formData.date,
      warehouse: formData.warehouse,
      poDo: order.poDo,
      quantity: order.quantity,
      packageType: order.packageType,
      description: order.description,
      transportation: order.transportation || false,
      typeOfVehicle: order.typeOfVehicle || "",
      fromLocation: order.fromLocation || "",
      pickUpFrom: order.pickUpFrom || "",
      toLocation: order.toLocation || "",
      driverName: order.driverName || "",
      slotNo: order.slotNo || "",
      reason: order.reason || "",
      dispatchDate: order.dispatchDate || "",
    }));

    if (editingOrder) {
      // Update existing orders - replace all orders with same basic details
      const updatedList = ordersList.filter((order) => order.id !== editingOrder.id);
      const finalList = [...updatedList, ...newOrders];
      setOrdersList(finalList);

      // Update formValues
      const syntheticEvent = { target: { value: finalList } };
      handleChange("inboundOrdersList")(syntheticEvent);
    } else {
      // Create new orders
      const updatedList = [...ordersList, ...newOrders];
      setOrdersList(updatedList);

      // Update formValues
      const syntheticEvent = { target: { value: updatedList } };
      handleChange("inboundOrdersList")(syntheticEvent);
    }

    handleCloseModal();
  };

  const handleReset = () => {
    setFormData({
      date: "",
      warehouse: "",
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

  const handleDelete = (orderId) => {
    if (window.confirm("Are you sure you want to delete this order?")) {
      const updatedList = ordersList.filter(order => order.id !== orderId);
      setOrdersList(updatedList);

      // Update formValues
      const syntheticEvent = { target: { value: updatedList } };
      handleChange("inboundOrdersList")(syntheticEvent);
    }
  };

  const handleViewOrder = (order) => {
    handleCloseDropdown();
    setViewingOrder(order);
    setShowViewModal(true);
  };

  const handleCloseViewModal = () => {
    setShowViewModal(false);
    setViewingOrder(null);
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
    // Pre-fill form with order data
    setConvertFormData({
      date: order.date || "",
      warehouse: order.warehouse || "",
      receivedFrom: "",
      location: "",
      documents: [],
      remarks: "",
      orders: [{
        id: 1,
        orderNo: order.orderNo || "",
        poDo: order.poDo || "",
        quantity: order.quantity || "",
        packageType: order.packageType || "",
        description: order.description || "",
        transportation: order.transportation || false,
        typeOfVehicle: order.typeOfVehicle || "",
        fromLocation: order.fromLocation || "",
        pickUpFrom: order.pickUpFrom || "",
        toLocation: order.toLocation || "",
        driverName: order.driverName || "",
        slotNo: order.slotNo || "",
        reason: order.reason || "",
        dispatchDate: order.dispatchDate || ""
      }],
    });
    setExpandedConvertOrders({ 1: true });
    setShowConvertModal(true);
  };

  const handleCloseConvertModal = () => {
    setShowConvertModal(false);
    setConvertingOrder(null);
    setConvertFormData({
      date: "",
      warehouse: "",
      receivedFrom: "",
      location: "",
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

  const handleConvertSubmit = (e) => {
    e.preventDefault();
    console.log("Convert to Landing form submitted:", convertFormData);
    // Here you can implement the logic to save/convert the order to landing note
    handleCloseConvertModal();
  };


  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const slotNoOptions = [
    { value: "Slot 1", label: "Slot 1" },
    { value: "Slot 2", label: "Slot 2" },
    { value: "Slot 3", label: "Slot 3" },
    { value: "Slot 4", label: "Slot 4" },
    { value: "Slot 5", label: "Slot 5" },
  ];

  const reasonOptions = [
    { value: "Urgent", label: "Urgent" },
    { value: "Standard", label: "Standard" },
    { value: "Scheduled", label: "Scheduled" },
    { value: "Emergency", label: "Emergency" },
  ];

  const renderHeader = () => (
    <>
      <h1 className="modal-title">{editingOrder ? "Edit Inbound Order" : "Create Inbound Order"}</h1>
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
                <FormField label="Date">
                  <div className="cf-select cf-date-input">
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => handleFormChange("date", e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: "100%",
                        border: "none",
                        outline: "none",
                        background: "transparent",
                        fontSize: "14px",
                        color: "#1a1a1a",
                        fontFamily: "inherit",
                        padding: 0,
                        flex: 1,
                        cursor: "pointer",
                      }}
                    />
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{
                        flexShrink: 0,
                        marginLeft: "8px",
                        color: "#666",
                        pointerEvents: "none",
                        position: "relative",
                        zIndex: 1,
                      }}
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
                      <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                </FormField>
              </div>

              <div className="col-md-6 mb-2">
                <FormField label="Warehouse">
                  <FormSelect
                    value={formData.warehouse}
                    onChange={(e) => handleFormChange("warehouse", e.target.value)}
                    options={mergeOptionForValue(warehouseLocationOptions, formData.warehouse)}
                    placeholder="Select warehouse"
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
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
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
                        <FormField label="PO/DO">
                          <FormInput
                            type="text"
                            value={order.poDo}
                            onChange={(e) => handleOrderChange(order.id, "poDo", e.target.value)}
                            placeholder="Enter PO/DO number..."
                          />
                        </FormField>
                      </div>

                      <div className="col-lg-4 col-md-6">
                        <FormField label="Quantity">
                          <FormInput
                            type="number"
                            value={order.quantity}
                            onChange={(e) => handleOrderChange(order.id, "quantity", e.target.value)}
                            placeholder="Enter quantity..."
                          />
                        </FormField>
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
                        <FormField label="Package Type">
                          <FormSelect
                            value={order.packageType}
                            onChange={(e) => handleOrderChange(order.id, "packageType", e.target.value)}
                            options={mergeOptionForValue(packageTypeOptions, order.packageType)}
                            placeholder="Select package type..."
                          />
                        </FormField>
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
                            <FormField label="Type of Vehicle">
                              <FormSelect
                                value={order.typeOfVehicle}
                                onChange={(e) => handleOrderChange(order.id, "typeOfVehicle", e.target.value)}
                                options={mergeOptionForValue(materialVehicleOptions, order.typeOfVehicle)}
                                placeholder="Select type of vehicle..."
                              />
                            </FormField>
                          </div>

                          <div className="col-lg-4 col-md-6">
                            <FormField label="From Location">
                              <FormSelect
                                value={order.fromLocation}
                                onChange={(e) => handleOrderChange(order.id, "fromLocation", e.target.value)}
                                options={mergeOptionForValue(warehouseLocationOptions, order.fromLocation)}
                                placeholder="Select from location..."
                              />
                            </FormField>
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
                            <FormField label="To Location">
                              <FormSelect
                                value={order.toLocation}
                                onChange={(e) => handleOrderChange(order.id, "toLocation", e.target.value)}
                                options={mergeOptionForValue(warehouseLocationOptions, order.toLocation)}
                                placeholder="Select to location..."
                              />
                            </FormField>
                          </div>

                          <div className="col-lg-4 col-md-6">
                            <FormField label="Driver Name">
                              <FormSelect
                                value={order.driverName}
                                onChange={(e) => handleOrderChange(order.id, "driverName", e.target.value)}
                                options={mergeOptionForValue(materialDriverOptions, order.driverName)}
                                placeholder="Select driver name..."
                              />
                            </FormField>
                          </div>
                        </div>
                      )}
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
          Save
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
                <FormField label="Date">
                  <div className="cf-select cf-date-input">
                    <input
                      type="date"
                      value={convertFormData.date}
                      onChange={(e) => handleConvertFormChange("date", e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: "100%",
                        border: "none",
                        outline: "none",
                        background: "transparent",
                        fontSize: "14px",
                        color: "#1a1a1a",
                        fontFamily: "inherit",
                        padding: 0,
                        flex: 1,
                        cursor: "pointer",
                      }}
                    />
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{
                        flexShrink: 0,
                        marginLeft: "8px",
                        color: "#666",
                        pointerEvents: "none",
                        position: "relative",
                        zIndex: 1,
                      }}
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
                      <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                </FormField>
              </div>

              <div className="col-md-6 mb-2">
                <FormField label="Warehouse">
                  <FormSelect
                    value={convertFormData.warehouse}
                    onChange={(e) => handleConvertFormChange("warehouse", e.target.value)}
                    options={mergeOptionForValue(warehouseLocationOptions, convertFormData.warehouse)}
                    placeholder="Select warehouse"
                  />
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
                  <FormField label="Received From">
                    <FormInput
                      type="text"
                      value={convertFormData.receivedFrom}
                      onChange={(e) => handleConvertFormChange("receivedFrom", e.target.value)}
                      placeholder="Enter received from..."
                    />
                  </FormField>
                </div>

                <div className="col-md-6 mb-2">
                  <FormField label="Location">
                    <FormInput
                      type="text"
                      value={convertFormData.location}
                      onChange={(e) => handleConvertFormChange("location", e.target.value)}
                      placeholder="Enter location..."
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
                    <div className="row g-2 mb-1">
                      <div className="col-lg-4 col-md-6">
                        <FormField label="Order No">
                          <FormInput
                            type="text"
                            value={order.orderNo}
                            onChange={(e) => handleConvertOrderChange(order.id, "orderNo", e.target.value)}
                            placeholder="Enter order number..."
                          />
                        </FormField>
                      </div>

                      <div className="col-lg-4 col-md-6">
                        <FormField label="PO/DO">
                          <FormInput
                            type="text"
                            value={order.poDo}
                            onChange={(e) => handleConvertOrderChange(order.id, "poDo", e.target.value)}
                            placeholder="Enter PO/DO number..."
                          />
                        </FormField>
                      </div>

                      <div className="col-lg-4 col-md-6">
                        <FormField label="Quantity">
                          <FormInput
                            type="number"
                            value={order.quantity}
                            onChange={(e) => handleConvertOrderChange(order.id, "quantity", e.target.value)}
                            placeholder="Enter quantity..."
                          />
                        </FormField>
                      </div>

                      <div className="col-lg-6 col-md-12">
                        <FormField label="Description">
                          <FormInput
                            type="text"
                            value={order.description}
                            onChange={(e) => handleConvertOrderChange(order.id, "description", e.target.value)}
                            placeholder="Enter description..."
                          />
                        </FormField>
                      </div>

                      <div className="col-lg-6 col-md-12">
                        <FormField label="Package Type">
                          <FormSelect
                            value={order.packageType}
                            onChange={(e) => handleConvertOrderChange(order.id, "packageType", e.target.value)}
                            options={mergeOptionForValue(packageTypeOptions, order.packageType)}
                            placeholder="Select package type..."
                          />
                        </FormField>
                      </div>
                    </div>

                    {/* Transportation Section */}
                    <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid #e2e2ea" }}>
                      <div style={{ marginBottom: "10px" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={order.transportation || false}
                            onChange={(e) => handleConvertOrderChange(order.id, "transportation", e.target.checked)}
                            style={{ cursor: "pointer", width: "18px", height: "18px" }}
                          />
                          <span style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a" }}>Transportation</span>
                        </label>
                      </div>

                      {order.transportation && (
                        <div className="row g-2 mb-1">
                          <div className="col-lg-4 col-md-6">
                            <FormField label="Type of Vehicle">
                              <FormSelect
                                value={order.typeOfVehicle}
                                onChange={(e) => handleConvertOrderChange(order.id, "typeOfVehicle", e.target.value)}
                                options={mergeOptionForValue(materialVehicleOptions, order.typeOfVehicle)}
                                placeholder="Select type of vehicle..."
                              />
                            </FormField>
                          </div>

                          <div className="col-lg-4 col-md-6">
                            <FormField label="From Location">
                              <FormSelect
                                value={order.fromLocation}
                                onChange={(e) => handleConvertOrderChange(order.id, "fromLocation", e.target.value)}
                                options={mergeOptionForValue(warehouseLocationOptions, order.fromLocation)}
                                placeholder="Select from location..."
                              />
                            </FormField>
                          </div>

                          <div className="col-lg-4 col-md-6">
                            <FormField label="Pick-Up From">
                              <FormInput
                                type="text"
                                value={order.pickUpFrom}
                                onChange={(e) => handleConvertOrderChange(order.id, "pickUpFrom", e.target.value)}
                                placeholder="Enter pick-up location..."
                              />
                            </FormField>
                          </div>

                          <div className="col-lg-4 col-md-6">
                            <FormField label="To Location">
                              <FormSelect
                                value={order.toLocation}
                                onChange={(e) => handleConvertOrderChange(order.id, "toLocation", e.target.value)}
                                options={mergeOptionForValue(warehouseLocationOptions, order.toLocation)}
                                placeholder="Select to location..."
                              />
                            </FormField>
                          </div>

                          <div className="col-lg-4 col-md-6">
                            <FormField label="Driver Name">
                              <FormSelect
                                value={order.driverName}
                                onChange={(e) => handleConvertOrderChange(order.id, "driverName", e.target.value)}
                                options={mergeOptionForValue(materialDriverOptions, order.driverName)}
                                placeholder="Select driver name..."
                              />
                            </FormField>
                          </div>
                        </div>
                      )}

                      {/* Slot No, Reason, Dispatch Date - After Transportation */}
                      <div className="row g-2 mb-1" style={{ marginTop: "12px" }}>
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
                            <div className="cf-select cf-date-input">
                              <input
                                type="date"
                                value={order.dispatchDate}
                                onChange={(e) => handleConvertOrderChange(order.id, "dispatchDate", e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  width: "100%",
                                  border: "none",
                                  outline: "none",
                                  background: "transparent",
                                  fontSize: "14px",
                                  color: "#1a1a1a",
                                  fontFamily: "inherit",
                                  padding: 0,
                                  flex: 1,
                                  cursor: "pointer",
                                }}
                              />
                              <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                style={{
                                  flexShrink: 0,
                                  marginLeft: "8px",
                                  color: "#666",
                                  pointerEvents: "none",
                                  position: "relative",
                                  zIndex: 1,
                                }}
                              >
                                <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
                                <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              </svg>
                            </div>
                          </FormField>
                        </div>
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
              <FormField label="Document Upload">
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
        form="convertToLandingForm"
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
        Convert
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
    if (!viewingOrder) return null;

    const stripHtml = (html) => {
      if (!html) return "";
      const tmp = document.createElement("DIV");
      tmp.innerHTML = html;
      return tmp.textContent || tmp.innerText || "";
    };

    return (
      <div className="modal-body">
        <div className="view-vessel-container" style={{ padding: "20px" }}>
          {/* Order Information */}
          <div className="view-row" style={{ display: "flex", flexWrap: "wrap", gap: "20px", marginBottom: "20px" }}>
            <div className="view-item" style={{ flex: "1", minWidth: "200px" }}>
              <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>Order No</div>
              <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{viewingOrder.orderNo || "-"}</div>
            </div>
            <div className="view-item" style={{ flex: "1", minWidth: "200px" }}>
              <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>Date</div>
              <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{formatDate(viewingOrder.date) || "-"}</div>
            </div>
            <div className="view-item" style={{ flex: "1", minWidth: "200px" }}>
              <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>PO/DO</div>
              <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{viewingOrder.poDo || "-"}</div>
            </div>
          </div>

          <div className="view-row" style={{ display: "flex", flexWrap: "wrap", gap: "20px", marginBottom: "20px" }}>
            <div className="view-item" style={{ flex: "1", minWidth: "200px" }}>
              <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>Quantity</div>
              <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{viewingOrder.quantity || "-"}</div>
            </div>
            <div className="view-item" style={{ flex: "1", minWidth: "200px" }}>
              <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>Package Type</div>
              <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{viewingOrder.packageType || "-"}</div>
            </div>
          </div>

          <div className="view-row" style={{ marginBottom: "20px" }}>
            <div className="view-item" style={{ width: "100%" }}>
              <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>Description</div>
              <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{viewingOrder.description || "-"}</div>
            </div>
          </div>

          {/* Transportation Details */}
          {viewingOrder.transportation && (
            <>
              <div style={{ borderTop: "1px solid #e2e2ea", paddingTop: "20px", marginTop: "20px" }}>
                <h4 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px", color: "#1a1a1a" }}>Transportation Details</h4>
                <div className="view-row" style={{ display: "flex", flexWrap: "wrap", gap: "20px", marginBottom: "20px" }}>
                  <div className="view-item" style={{ flex: "1", minWidth: "200px" }}>
                    <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>Type of Vehicle</div>
                    <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{viewingOrder.typeOfVehicle || "-"}</div>
                  </div>
                  <div className="view-item" style={{ flex: "1", minWidth: "200px" }}>
                    <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>From Location</div>
                    <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{viewingOrder.fromLocation || "-"}</div>
                  </div>
                  <div className="view-item" style={{ flex: "1", minWidth: "200px" }}>
                    <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>Pick-Up From</div>
                    <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{viewingOrder.pickUpFrom || "-"}</div>
                  </div>
                </div>
                <div className="view-row" style={{ display: "flex", flexWrap: "wrap", gap: "20px", marginBottom: "20px" }}>
                  <div className="view-item" style={{ flex: "1", minWidth: "200px" }}>
                    <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>To Location</div>
                    <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{viewingOrder.toLocation || "-"}</div>
                  </div>
                  <div className="view-item" style={{ flex: "1", minWidth: "200px" }}>
                    <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>Driver Name</div>
                    <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{viewingOrder.driverName || "-"}</div>
                  </div>
                  <div className="view-item" style={{ flex: "1", minWidth: "200px" }}>
                    <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>Slot No</div>
                    <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{viewingOrder.slotNo || "-"}</div>
                  </div>
                </div>
                <div className="view-row" style={{ display: "flex", flexWrap: "wrap", gap: "20px", marginBottom: "20px" }}>
                  <div className="view-item" style={{ flex: "1", minWidth: "200px" }}>
                    <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>Reason</div>
                    <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{viewingOrder.reason || "-"}</div>
                  </div>
                  <div className="view-item" style={{ flex: "1", minWidth: "200px" }}>
                    <div className="view-label" style={{ fontWeight: "600", color: "#666", marginBottom: "8px", fontSize: "14px" }}>Dispatch Date</div>
                    <div className="view-value" style={{ color: "#1a1a1a", fontSize: "15px" }}>{viewingOrder.dispatchDate ? formatDate(viewingOrder.dispatchDate) : "-"}</div>
                  </div>
                </div>
              </div>
            </>
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
          onClick={handleOpenModal}
          style={{ backgroundColor: "#00368c" }}
        >
          + Add
        </button>
      </div>
      <div className="table-wrapper table-responsive material-table-container" style={{ overflow: "visible" }}>
        <table className="table table-striped material-table inbound-table" style={{ "--card-color": "#e2e6ff", overflow: "visible", tableLayout: "fixed" }}>
          <thead>
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
            {ordersList.length > 0 ? (
              ordersList.slice((inboundPage - 1) * INBOUND_LIMIT, inboundPage * INBOUND_LIMIT).map((order) => (
                <tr key={order.id}>
                  <td>
                    <div className="material-table-cell">{order.orderNo || ""}</div>
                  </td>
                  <td>
                    <div className="material-table-cell">
                      {formatDate(order.date)}
                    </div>
                  </td>
                  <td>
                    <div className="material-table-cell">{order.poDo || ""}</div>
                  </td>
                  <td>
                    <div className="material-table-cell">{order.quantity || ""}</div>
                  </td>
                  <td>
                    <div className="material-table-cell">{order.packageType || ""}</div>
                  </td>
                  <td>
                    <div className="material-table-cell">
                      {order.description && order.description.length > 25 ? (
                        <>
                          <Tooltip
                            id={`description-tooltip-${order.id}`}
                            place="right"
                            content={order.description}
                            className="material-table-tooltip"
                          />
                          <span
                            data-tooltip-id={`description-tooltip-${order.id}`}
                            style={{ cursor: "help" }}
                          >
                            {order.description.substring(0, 25)}...
                          </span>
                        </>
                      ) : (
                        <span>{order.description || ""}</span>
                      )}
                    </div>
                  </td>
                  <td style={{ position: "relative", overflow: "visible" }}>
                    <div className="material-table-cell" style={{ position: "relative", overflow: "visible", display: "flex", alignItems: "center", gap: "8px", justifyContent: "flex-start" }}>
                      <Tooltip id={`view-order-${order.id}`} place="left" content="View" />
                      <button
                        type="button"
                        onClick={() => handleViewOrder(order)}
                        data-tooltip-id={`view-order-${order.id}`}
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
                      <Tooltip id={`print-order-${order.id}`} place="left" content="Print" />
                      <button
                        type="button"
                        onClick={() => handlePrintOrder(order)}
                        data-tooltip-id={`print-order-${order.id}`}
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
                      <Tooltip id={`convert-order-${order.id}`} place="left" content=" Convert" />
                      <button
                        type="button"
                        onClick={() => handleConvertToLanding(order)}
                        data-tooltip-id={`convert-order-${order.id}`}
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
                      <div className="action-dropdown-wrapper" style={{ position: "relative", display: "inline-block", zIndex: openDropdownId === order.id ? 9999 : "auto" }}>
                        <Tooltip id={`more-actions-${order.id}`} place="left" content="More actions" />
                        <button
                          type="button"
                          onClick={(e) => handleToggleDropdown(order.id, e)}
                          data-tooltip-id={`more-actions-${order.id}`}
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
                        {openDropdownId === order.id && createPortal(
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
                                handleCloseDropdown();
                                handleDelete(order.id);
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
              ))
            ) : (
              <tr>
                <td colSpan="7" style={{ textAlign: "center", padding: "20px" }}>
                  No inbound orders added yet. Click "Add" to add a new order.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {ordersList.length > 0 && (() => {
          const totalPages = Math.ceil(ordersList.length / INBOUND_LIMIT);
          const start = (inboundPage - 1) * INBOUND_LIMIT + 1;
          const end = Math.min(inboundPage * INBOUND_LIMIT, ordersList.length);
          return (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 4px 4px", fontSize: "13px", color: "#555" }}>
              <span>Showing {start} to {end} of {ordersList.length} entries</span>
              <div style={{ display: "flex", gap: "4px" }}>
                <button onClick={() => setInboundPage(p => Math.max(1, p - 1))} disabled={inboundPage === 1} style={{ padding: "4px 10px", border: "1px solid #dee2e6", borderRadius: "4px", background: inboundPage === 1 ? "#f8f9fa" : "#fff", color: inboundPage === 1 ? "#aaa" : "#00368c", cursor: inboundPage === 1 ? "default" : "pointer" }}>&lt;</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setInboundPage(p)} style={{ padding: "4px 10px", border: "1px solid #dee2e6", borderRadius: "4px", background: inboundPage === p ? "#00368c" : "#fff", color: inboundPage === p ? "#fff" : "#00368c", cursor: "pointer", fontWeight: inboundPage === p ? 600 : 400 }}>{p}</button>
                ))}
                <button onClick={() => setInboundPage(p => Math.min(totalPages, p + 1))} disabled={inboundPage === totalPages} style={{ padding: "4px 10px", border: "1px solid #dee2e6", borderRadius: "4px", background: inboundPage === totalPages ? "#f8f9fa" : "#fff", color: inboundPage === totalPages ? "#aaa" : "#00368c", cursor: inboundPage === totalPages ? "default" : "pointer" }}>&gt;</button>
              </div>
            </div>
          );
        })()}
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
    </div>
  );
};

InboundOrdersContent.propTypes = {
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
  cardColor: PropTypes.string,
};

export default InboundOrdersContent;

