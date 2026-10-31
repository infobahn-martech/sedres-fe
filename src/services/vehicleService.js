import Gateway from '../gateway/gateway';

/** Transport and Material vehicle types share one form but have separate add/update endpoints. */
const VEHICLE_ENDPOINTS = {
  transport: {
    add: 'transport/add_transport_vehicle',
    update: 'transport/update_transport_vehicle',
    list: 'transport/transport_vehicle_list',
    purpose: 'crew_transport',
  },
  material: {
    add: 'transport/add_material_vehicle',
    update: 'transport/update_material_vehicle',
    list: 'transport/material_vehicle_list',
    purpose: 'material',
  },
};

const endpoints = (type = 'transport') => VEHICLE_ENDPOINTS[type] ?? VEHICLE_ENDPOINTS.transport;

const addVehicle = (data, type) => Gateway.post(endpoints(type).add, data);
/** Paginated list for the Vehicle Management tables. */
const fetchVehicles = ({ params, type }) => Gateway.get(endpoints(type).list, { params });
/** Unpaginated vehicle types for dropdowns, filtered by purpose. */
const fetchVehicleTypes = ({ type }) =>
  Gateway.get('/transport/all_vehicle_types', { params: { vehicle_purpose: endpoints(type).purpose } });
const updateVehicle = (data, type) => Gateway.post(endpoints(type).update, data);
const deleteVehicle = (id) => Gateway.post(`/transport/delete_vehicle_type/${id}`);

const getAllTransportVehicles = () => Gateway.get('/transport/get_all_transport_vehicles');

const getDriversByVehicleType = (vehicle_type_id) =>
  Gateway.get(`/transport/all_drivers_by_vehicletype/${vehicle_type_id}`);

const getMaterialVehicles = () => Gateway.get('/transport/get_all_material_vehicles');

const getMaterialDrivers = () => Gateway.get('/transport/get_material_drivers');

export default {
  addVehicle,
  fetchVehicles,
  fetchVehicleTypes,
  updateVehicle,
  deleteVehicle,
  getAllTransportVehicles,
  getDriversByVehicleType,
  getMaterialVehicles,
  getMaterialDrivers,
};
