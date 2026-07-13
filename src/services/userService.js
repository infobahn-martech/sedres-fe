import Gateway from '../gateway/gateway';

const getUsers = ({ params }) => {
  // Map component params to API params
  const apiParams = {};

  if (params?.searchTerm) {
    apiParams.search = params.searchTerm;
  }

  if (params?.sortBy) {
    apiParams.sort_by = params.sortBy;
  }

  if (params?.page) {
    apiParams.page = params.page;
  }

  if (params?.limit) {
    apiParams.limit = params.limit;
  }

  return Gateway.get('/users', { params: apiParams });
};

const getNonVendorUsers = ({ params } = {}) => Gateway.get('/users/non_vendor_users', { params });

const createUser = (formData) => Gateway.post('/users/create', formData);

const updateUser = (userId, formData) => Gateway.post(`/users/update/${userId}`, formData);

const getUserPermissions = (userId) => Gateway.post(`/permissions/get_permissions_by_user/${userId}`, { user_id: userId });

const updateUserPermission = (payload) => Gateway.post('/permissions/update_user_permission', payload);
const getUsersByRole = (payload) => Gateway.post('/users/get_users_by_role', payload);

const activateUser = (user_id) => Gateway.post(`/users/togglestatus/${user_id}`);

const archiveUser = (user_id) =>
  Gateway.post(`/users/archive/${user_id}`, { user_id });

const unarchiveUser = (user_id) =>
  Gateway.post(`/users/unarchive_user/${user_id}`, { user_id });

export default {
  getUsers,
  getNonVendorUsers,
  createUser,
  updateUser,
  getUserPermissions,
  updateUserPermission,
  getUsersByRole,
  activateUser,
  archiveUser,
  unarchiveUser,
};