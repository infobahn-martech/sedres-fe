import Gateway from '../gateway/gateway';

const getRoles = ({ params }) => Gateway.get('/roles', { params });
const createRole = (data) => Gateway.post('/roles/create', data);
const updateRole = (roleId, data) => Gateway.post(`/roles/update/${roleId}`, data);
const deleteRole = (roleId) => Gateway.delete(`/roles/${roleId}`);
const archiveUnarchiveRole = (roleId) => Gateway.post(`/permissions/archive_unarchive_role/${roleId}`);

export default {
    getRoles,
    createRole,
    updateRole,
    deleteRole,
    archiveUnarchiveRole,
};
