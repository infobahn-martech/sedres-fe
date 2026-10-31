import Gateway from '../gateway/gateway';

const addVehicle = (data) => Gateway.post('transport/add_transport_vehicle', data);
const fetchVehicles = ({ params }) => Gateway.get('/transport/all_vehicle_types', { params });
const updateVehicle = (data) => Gateway.post(`/transport/update_vehicle_type`, data);
const deleteVehicle = (id) => Gateway.post(`/transport/delete_vehicle_type/${id}`);

const getAllTransportVehicles = () => Gateway.get('/transport/get_all_transport_vehicles');

const getDriversByVehicleType = (vehicle_type_id) =>
  Gateway.get(`/transport/all_drivers_by_vehicletype/${vehicle_type_id}`);

const getMaterialVehicles = () => Gateway.get('/transport/get_all_material_vehicles');

const getMaterialDrivers = () => Gateway.get('/transport/get_material_drivers');

export default {
  addVehicle,
  fetchVehicles,
  updateVehicle,
  deleteVehicle,
  getAllTransportVehicles,
  getDriversByVehicleType,
  getMaterialVehicles,
  getMaterialDrivers,
};
