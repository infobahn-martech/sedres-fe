import Gateway from '../gateway/gateway';

const getBillingEntities = ({ params }) => {
  const apiParams = {};
  if (params?.searchTerm) apiParams.search = params.searchTerm;
  if (params?.sortBy) apiParams.sort_by = params.sortBy;
  if (params?.sortOrder != null) apiParams.sort_order = params.sortOrder;
  if (params?.page) apiParams.page = params.page;
  if (params?.limit) apiParams.limit = params.limit;
  return Gateway.get('/billingentity', { params: apiParams });
};

const getCustomerPriceList = ({ params }) => {
  const apiParams = {};
  if (params?.searchTerm) apiParams.search = params.searchTerm;
  if (params?.sortBy) apiParams.sort_by = params.sortBy;
  if (params?.sortOrder != null) apiParams.sort_order = params.sortOrder;
  if (params?.page) apiParams.page = params.page;
  if (params?.limit) apiParams.limit = params.limit;
  return Gateway.get('/billingentity/get_customer_price_list', { params: apiParams });
};

const getAllEmailByEntity = (billingEntityId) =>
  Gateway.get(`/billingentity/getallemailbyentity/${billingEntityId}`);

const addBillingEntityEmail = (payload) =>
  Gateway.post('/billingentity/add_billing_entity_email', payload);

const getEntityDetailById = (entityId) =>
  Gateway.get(`/billingentity/entity_detail/${entityId}`);

const updateBillingEntityLogo = (formData) =>
  Gateway.post('/billingentity/update_billing_entity_logo', formData);

const updateBillingEntityDetail = (formData) =>
  Gateway.post('/billingentity/update_billing_entity_detail', formData);

export default {
  getBillingEntities,
  getCustomerPriceList,
  getAllEmailByEntity,
  addBillingEntityEmail,
  getEntityDetailById,
  updateBillingEntityLogo,
  updateBillingEntityDetail,
};
