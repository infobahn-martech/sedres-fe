import Gateway from '../gateway/gateway';

/** GET /notifications/get_notifications → { status, unread_count, pagination, data[] } */
const getNotifications = ({ page = 1, limit = 20 } = {}) =>
  Gateway.get('/notifications/get_notifications', { params: { page, limit } });

// NOTE: endpoint names below are assumed — align with the backend if they differ.
const markAsRead = (notificationId) =>
  Gateway.post(`/notifications/mark_as_read/${notificationId}`, { notification_id: notificationId });

const markAllAsRead = () => Gateway.post('/notifications/mark_all_as_read');

export default {
  getNotifications,
  markAsRead,
  markAllAsRead,
};
