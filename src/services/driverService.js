import Gateway from '../gateway/gateway';

const getAllCountries = () => Gateway.get('/transport/all_country');
const getAllDrivers = (params) => Gateway.get('/transport/all_drivers', { params });
const addDriver = (data) => Gateway.post('/transport/add_transport_driver', data);
const updateDriver = (data) => Gateway.post('/transport/update_transport_driver', data);
const deleteDriver = (id) => Gateway.post(`/transport/delete_driver/${id}`);

export default {
    getAllCountries,
    getAllDrivers,
    addDriver,
    updateDriver,
    deleteDriver,
};
