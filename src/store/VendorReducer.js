import { create } from 'zustand';
import vendorService from '../services/vendorService';
import salesOrderService from '../services/salesOrderService';

const useVendorReducer = create((set) => ({
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
}));

export default useVendorReducer;
