import Gateway from '../gateway/gateway';

/** Transport and Material drivers share one form but have separate endpoints. */
const DRIVER_ENDPOINTS = {
    transport: {
        list: '/transport/transport_driver_list',
        detail: '/transport/transport_driver_detail',
        add: '/transport/add_transport_driver',
        update: '/transport/update_transport_driver',
    },
    material: {
        list: '/transport/material_driver_list',
        detail: '/transport/material_driver_detail',
        add: '/transport/add_material_driver',
        update: '/transport/update_material_driver',
    },
};

const endpoints = (type = 'transport') => DRIVER_ENDPOINTS[type] ?? DRIVER_ENDPOINTS.transport;

const getAllCountries = () => Gateway.get('/transport/all_country');
const getAllDrivers = (params, type) => Gateway.get(endpoints(type).list, { params });
const getDriverDetail = (id, type) => Gateway.get(`${endpoints(type).detail}/${id}`);
const addDriver = (data, type) => Gateway.post(endpoints(type).add, data);
const updateDriver = (data, type) => Gateway.post(endpoints(type).update, data);
const deleteDriver = (id) => Gateway.post(`/transport/delete_driver/${id}`);

export default {
    getAllCountries,
    getAllDrivers,
    getDriverDetail,
    addDriver,
    updateDriver,
    deleteDriver,
};
