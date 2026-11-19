import Gateway from '../gateway/gateway';

const getCompanyId = () =>
  localStorage.getItem('vendor_id') ||
  localStorage.getItem('hotel_id') ||
  localStorage.getItem('company_id') ||
  localStorage.getItem('userid');

const getVendorDashboard = () =>
  Gateway.get(`transport/company_dashboard/${getCompanyId()}`);

const getVendorOrders = () =>
  Gateway.get(`transport/company_orders/${getCompanyId()}`);

const getHotelDashboard = () =>
  Gateway.get(`hotel/hotel_dashboard/${getCompanyId()}`);

const getHotelOrders = () =>
  Gateway.get(`hotel/hotel_orders/${getCompanyId()}`);

/**
 * @param {object} payload
 * @param {number|string} payload.hotel_request_id
 * @param {string} payload.checkin_datetime - "YYYY-MM-DD HH:mm:ss"
 * @param {string} payload.checkout_datetime - "YYYY-MM-DD HH:mm:ss"
 */
const updateHotelRequestDates = (payload) =>
  Gateway.post('hotel/update_hotel_request_dates', payload);

export default {
  getVendorDashboard,
  getVendorOrders,
  getHotelDashboard,
  getHotelOrders,
  updateHotelRequestDates,
};
