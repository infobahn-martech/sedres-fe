import Gateway from '../gateway/gateway';

const addDriverVehicleMappingData = (data) => Gateway.post('/transport/add_driver_to_vehicle', data);
/** `vehicle_purpose` per module; unknown/omitted type falls back to the unfiltered list. */
const VEHICLE_PURPOSE = { transport: 'crew_transport', material: 'material' };

const getDriverVehicleMappingData = ({ params, type }) =>
  Gateway.get('/transport/get_all_driver_vehicles', {
    params: VEHICLE_PURPOSE[type] ? { ...params, vehicle_purpose: VEHICLE_PURPOSE[type] } : params,
  });
const updateDriverVehicleMappingData = (data) => Gateway.post('/transport/update_driver_to_vehicle', data);
const deleteDriverVehicleMappingData = (id) => Gateway.delete(`/transport/delete_driver_vehicle/${id}`);

export default { addDriverVehicleMappingData, getDriverVehicleMappingData, updateDriverVehicleMappingData, deleteDriverVehicleMappingData };
