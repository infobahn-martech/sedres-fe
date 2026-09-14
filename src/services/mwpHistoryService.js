import Gateway from '../gateway/gateway';

const getAllMWPHistory = ({ params } = {}) =>
  Gateway.get('/vessel/all_mwp_documents', { params });

export default {
  getAllMWPHistory,
};
