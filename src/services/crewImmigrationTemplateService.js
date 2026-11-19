import Gateway from '../gateway/gateway';

// Same pass_template endpoints as Vessel Registration, scoped to the "Crew Immigration" template type.
export const CREW_IMMIGRATION_TEMPLATE_TYPE = 'Crew Immigration';

const getAll = (params) =>
  Gateway.get(`/pass_template/templates_by_type/${encodeURIComponent(CREW_IMMIGRATION_TEMPLATE_TYPE)}`, { params });
const getById = (id) => Gateway.get(`/pass_template/template_by_id/${id}`);
const create = (data) => Gateway.post('/pass_template/add_template', data);
const update = ({ template_id, ...data }) => Gateway.post(`/pass_template/update_template/${template_id}`, data);
const remove = (id) => Gateway.post(`/pass_template/delete_template/${id}`);

export default { getAll, getById, create, update, remove };
