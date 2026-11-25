import { create } from 'zustand';
import vendorService from '../services/vendorService';
import salesOrderService from '../services/salesOrderService';

const useVendorReducer = create((set, get) => ({
  isDashboardLoading: false,
  dashboardError: '',
  dashboardData: null,

  isOrdersLoading: false,
  ordersError: '',
  ordersData: [],

  // GET_VENDOR_DASHBOARD_REQUEST / SUCCESS / FAILURE
  getVendorDashboard: async () => {
    try {
      set({ isDashboardLoading: true, dashboardError: '' });
      const { data } = await vendorService.getVendorDashboard();
      set({
        dashboardData: data?.data ?? data ?? null,
        isDashboardLoading: false,
      });
    } catch (error) {
      set({
        dashboardError: error?.response?.data?.message ?? error.message,
        isDashboardLoading: false,
        dashboardData: null,
      });
    }
  },

  // GET_VENDOR_ORDERS_REQUEST / SUCCESS / FAILURE
  getVendorOrders: async () => {
    try {
      set({ isOrdersLoading: true, ordersError: '' });
      const { data } = await vendorService.getVendorOrders();
      set({
        ordersData: data?.data ?? [],
        isOrdersLoading: false,
      });
    } catch (error) {
      set({
        ordersError: error?.response?.data?.message ?? error.message,
        isOrdersLoading: false,
        ordersData: [],
      });
    }
  },

  isUpdatingOrderTrip: false,
  updateOrderTripError: '',

  // UPDATE_ORDER_TRIP_REQUEST / SUCCESS / FAILURE
  updateOrderTrip: async ({ transportRequestId, status, pickupDatetime, dropOffDatetime }) => {
    try {
      set({ isUpdatingOrderTrip: true, updateOrderTripError: '' });
      const { data } = await vendorService.updateTransportTrip({
        transport_request_id: transportRequestId,
        status,
        pickup_datetime: pickupDatetime,
        drop_offdatetime: dropOffDatetime,
      });
      const tripStatus = data?.trip_status ?? status;
      const pickup = data?.pickup_datetime ?? (pickupDatetime || undefined);
      const dropOff = data?.drop_offdatetime ?? (dropOffDatetime || undefined);
      const withTrip = (item) => ({
        ...item,
        trip_status: tripStatus,
        ...(pickup && { pickup_datetime: pickup }),
        ...(dropOff && { drop_offdatetime: dropOff }),
      });
      set({
        isUpdatingOrderTrip: false,
        ordersData: get().ordersData.map((order) => {
          if (order.transport_request_id === transportRequestId) return withTrip(order);
          // Older responses only carry the request id on each crew row.
          if (!(order.crew || []).some((c) => c.transport_request_id === transportRequestId)) return order;
          return {
            ...order,
            crew: order.crew.map((c) => (c.transport_request_id === transportRequestId ? withTrip(c) : c)),
          };
        }),
      });
    } catch (error) {
      set({
        updateOrderTripError: error?.response?.data?.message ?? error.message,
        isUpdatingOrderTrip: false,
      });
      throw error;
    }
  },

  isHotelDashboardLoading: false,
  hotelDashboardError: '',
  hotelDashboardData: null,

  isHotelOrdersLoading: false,
  hotelOrdersError: '',
  hotelOrdersData: [],

  // GET_HOTEL_DASHBOARD_REQUEST / SUCCESS / FAILURE
  getHotelDashboard: async () => {
    try {
      set({ isHotelDashboardLoading: true, hotelDashboardError: '' });
      const { data } = await vendorService.getHotelDashboard();
      set({
        hotelDashboardData: data?.data ?? data ?? null,
        isHotelDashboardLoading: false,
      });
    } catch (error) {
      set({
        hotelDashboardError: error?.response?.data?.message ?? error.message,
        isHotelDashboardLoading: false,
        hotelDashboardData: null,
      });
    }
  },

  // GET_HOTEL_ORDERS_REQUEST / SUCCESS / FAILURE
  getHotelOrders: async () => {
    try {
      set({ isHotelOrdersLoading: true, hotelOrdersError: '' });
      const { data } = await vendorService.getHotelOrders();
      set({
        hotelOrdersData: data?.data ?? [],
        isHotelOrdersLoading: false,
      });
    } catch (error) {
      set({
        hotelOrdersError: error?.response?.data?.message ?? error.message,
        isHotelOrdersLoading: false,
        hotelOrdersData: [],
      });
    }
  },

  isUploadingInvoice: false,
  uploadInvoiceError: '',

  // UPLOAD_INVOICE_REQUEST / SUCCESS / FAILURE
  uploadInvoice: async ({ purchaseOrderId, invoiceAmount, invoiceDate, files }) => {
    try {
      set({ isUploadingInvoice: true, uploadInvoiceError: '' });
      const formData = new FormData();
      formData.append('purchase_order_id', purchaseOrderId ?? '');
      formData.append('invoice_number', '');
      formData.append('invoice_amount', invoiceAmount ?? '');
      formData.append('invoice_date', invoiceDate ?? '');
      (files || []).forEach((file) => formData.append('file', file));
      await salesOrderService.uploadInvoice(formData);
      set({ isUploadingInvoice: false });
    } catch (error) {
      set({
        uploadInvoiceError: error?.response?.data?.message ?? error.message,
        isUploadingInvoice: false,
      });
      throw error;
    }
  },

  isUpdatingSalesOrderItemAmount: false,
  updateSalesOrderItemAmountError: '',

  // UPDATE_SALES_ORDER_ITEM_AMOUNT_REQUEST / SUCCESS / FAILURE
  updateSalesOrderItemAmount: async (payload) => {
    try {
      set({ isUpdatingSalesOrderItemAmount: true, updateSalesOrderItemAmountError: '' });
      const { data } = await salesOrderService.updateSalesOrderItemAmount(payload);
      set({ isUpdatingSalesOrderItemAmount: false });
      return data;
    } catch (error) {
      set({
        updateSalesOrderItemAmountError: error?.response?.data?.message ?? error.message,
        isUpdatingSalesOrderItemAmount: false,
      });
      throw error;
    }
  },

  isUpdatingSalesOrder: false,
  updateSalesOrderError: '',

  // UPDATE_SALES_ORDER_REQUEST / SUCCESS / FAILURE
  updateSalesOrder: async (payload) => {
    try {
      set({ isUpdatingSalesOrder: true, updateSalesOrderError: '' });
      const { data } = await salesOrderService.updateSalesOrder(payload);
      set({ isUpdatingSalesOrder: false });
      return data;
    } catch (error) {
      set({
        updateSalesOrderError: error?.response?.data?.message ?? error.message,
        isUpdatingSalesOrder: false,
      });
      throw error;
    }
  },
}));

export default useVendorReducer;
