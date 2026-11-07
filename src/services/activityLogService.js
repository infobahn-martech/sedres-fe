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

// Per-card activity history (moves, etc.) for the card modal's "Activity Log" tab.
const getCardActivity = (cardId, params = {}) =>
  Gateway.get(`/activity_log/card_activity/${cardId}`, { params });

export default {
  getActivityLogData,
  getCardActivity,
};
