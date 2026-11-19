import Gateway from '../gateway/gateway';

/** GET /notifications/get_notifications → { status, unread_count, pagination, data[] } */
const getNotifications = ({ page = 1, limit = 20 } = {}) =>
  Gateway.get('/notifications/get_notifications', { params: { page, limit } });

/**
 * POST /notifications/update_read_status
 * body: { notification_ids: number[], is_read: 1 | 0 }
 */
const updateReadStatus = (notificationIds, isRead) =>
  Gateway.post('/notifications/update_read_status', {
    notification_ids: (Array.isArray(notificationIds) ? notificationIds : [notificationIds]).map(Number),
    is_read: isRead ? 1 : 0,
  });

const markAsRead = (notificationIds) => updateReadStatus(notificationIds, 1);
const markAsUnread = (notificationIds) => updateReadStatus(notificationIds, 0);

/** POST /notifications/mark_all_read */
const markAllAsRead = () => Gateway.post('/notifications/mark_all_read');

export default {
  getNotifications,
  updateReadStatus,
  markAsRead,
  markAsUnread,
  markAllAsRead,
};
