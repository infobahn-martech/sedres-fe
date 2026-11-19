import { create } from 'zustand';
import driverPortalService from '../services/driverPortalService';

const useInhouseDriverReducer = create((set, get) => ({
  isTripStatsLoading: false,
  tripStatsError: '',
  tripStatsData: null,

  isRequestsLoading: false,
  requestsError: '',
  requestsData: [],

  // GET_DRIVER_TRIP_STATS_REQUEST / SUCCESS / FAILURE
  getDriverTripStats: async () => {
    try {
      set({ isTripStatsLoading: true, tripStatsError: '' });
      const { data } = await driverPortalService.getDriverTripStats();
      set({
        tripStatsData: data?.data ?? null,
        isTripStatsLoading: false,
      });
    } catch (error) {
      set({
        tripStatsError: error?.response?.data?.message ?? error.message,
        isTripStatsLoading: false,
        tripStatsData: null,
      });
    }
  },

  // GET_REQUESTS_BY_DRIVER_REQUEST / SUCCESS / FAILURE
  getRequestsByDriver: async () => {
    try {
      set({ isRequestsLoading: true, requestsError: '' });
      const { data } = await driverPortalService.getRequestsByDriver();
      set({
        requestsData: data?.data ?? [],
        isRequestsLoading: false,
      });
    } catch (error) {
      set({
        requestsError: error?.response?.data?.message ?? error.message,
        isRequestsLoading: false,
        requestsData: [],
      });
    }
  },

  isUpdatingTripStatus: false,
  updateTripStatusError: '',

  // UPDATE_TRIP_STATUS_REQUEST / SUCCESS / FAILURE
  updateTripStatus: async ({ transportRequestId, status, pickupDatetime, dropOffDatetime }) => {
    try {
      set({ isUpdatingTripStatus: true, updateTripStatusError: '' });
      const { data } = await driverPortalService.updateTripStatus({
        transport_request_id: transportRequestId,
        status,
        pickup_datetime: pickupDatetime,
        drop_offdatetime: dropOffDatetime,
      });
      set({
        isUpdatingTripStatus: false,
        requestsData: get().requestsData.map((req) =>
          req.transport_request_id === transportRequestId
            ? {
                ...req,
                status: data?.trip_status ?? status,
                pickup_datetime: data?.pickup_datetime ?? (pickupDatetime || req.pickup_datetime),
                drop_offdatetime: data?.drop_offdatetime ?? (dropOffDatetime || req.drop_offdatetime),
              }
            : req
        ),
      });
    } catch (error) {
      set({
        updateTripStatusError: error?.response?.data?.message ?? error.message,
        isUpdatingTripStatus: false,
      });
      throw error;
    }
  },
}));

export default useInhouseDriverReducer;
