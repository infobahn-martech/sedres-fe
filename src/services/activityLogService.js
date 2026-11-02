import Gateway from '../gateway/gateway';

const getActivityLogData = (config = {}) => {
  const { params } = config;
  const hasParams =
    params != null &&
    typeof params === 'object' &&
    !Array.isArray(params) &&
    Object.keys(params).length > 0;
  return Gateway.get('/activity_log/get_all_activity_logs', hasParams ? { params } : undefined);
};

export default {
  getActivityLogData,
};
