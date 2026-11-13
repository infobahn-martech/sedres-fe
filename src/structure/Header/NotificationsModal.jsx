import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomModal from '../../components/CustomModal';
import {
  FiBell, FiBellOff, FiCheck, FiX, FiAlertCircle, FiPlusSquare, FiUserCheck, FiMessageSquare, FiRefreshCw,
} from 'react-icons/fi';
import notificationService from '../../services/notificationService';
import '../../design/scss/common.scss';
import '../../design/scss/structure/header/NotificationsModal.scss';

const PAGE_LIMIT = 20;
const PREVIEW_COUNT = 3;

const TYPE_ICONS = {
  NEW_CARD: FiPlusSquare,
  CARD_ASSIGNED: FiUserCheck,
  ASSIGNED: FiUserCheck,
  COMMENT: FiMessageSquare,
  STATUS_CHANGE: FiRefreshCw,
};

const getIcon = (n) => {
  if (String(n.priority).toUpperCase() === 'HIGH') return FiAlertCircle;
  return TYPE_ICONS[String(n.notification_type || '').toUpperCase()] || FiBell;
};

/** API dates are "YYYY-MM-DD HH:mm:ss" (server local time). */
const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatRelative = (date) => {
  if (!date) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return 'Just now';
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

const getGroupLabel = (date) => {
  if (!date) return 'Earlier';
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  if (date >= startOfToday) return 'Today';
  if (date >= startOfYesterday) return 'Yesterday';
  return 'Earlier';
};

/** Bold the actor name and any "quoted" text (e.g. card titles) in the message. */
const formatMessage = (message, actorName) => {
  if (!message) return null;
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = ['"[^"]+"'];
  if (actorName) patterns.unshift(escape(actorName));
  const regex = new RegExp(`(${patterns.join('|')})`, 'g');
  return message.split(regex).map((part, i) => {
    if (!part) return null;
    if (i % 2 === 1) {
      const text = part.startsWith('"') && part.endsWith('"') ? part.slice(1, -1) : part;
      return <strong key={i}>{text}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
};

function NotificationsModal({ show, onClose, onUnreadCountChange }) {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pagination, setPagination] = useState({ page: 1, total: 0, total_pages: 1 });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const updateUnread = useCallback((count) => {
    setUnreadCount(count);
    onUnreadCountChange?.(count);
  }, [onUnreadCountChange]);

  const fetchPage = useCallback(async (page) => {
    const res = await notificationService.getNotifications({ page, limit: PAGE_LIMIT });
    const body = res?.data || {};
    if (body.status && body.status !== 'success') throw new Error(body.message || 'Failed to load notifications');
    return {
      items: Array.isArray(body.data) ? body.data : [],
      unread: Number(body.unread_count) || 0,
      pagination: body.pagination || { page, total: 0, total_pages: 1 },
    };
  }, []);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPage(1);
      setNotifications(result.items);
      setPagination(result.pagination);
      updateUnread(result.unread);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [fetchPage, updateUnread]);

  useEffect(() => {
    if (show) {
      loadInitial();
    } else {
      setShowAll(false);
    }
  }, [show, loadInitial]);

  const hasMorePages = Number(pagination.page) < Number(pagination.total_pages);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const result = await fetchPage(Number(pagination.page) + 1);
      setNotifications((prev) => {
        const seen = new Set(prev.map((n) => n.notification_id));
        return [...prev, ...result.items.filter((n) => !seen.has(n.notification_id))];
      });
      setPagination(result.pagination);
      updateUnread(result.unread);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load notifications');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;
    const previous = notifications;
    const previousCount = unreadCount;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    updateUnread(0);
    try {
      await notificationService.markAllAsRead();
    } catch {
      setNotifications(previous);
      updateUnread(previousCount);
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!Number(notification.is_read)) {
      setNotifications((prev) => prev.map((n) => (
        n.notification_id === notification.notification_id ? { ...n, is_read: 1 } : n
      )));
      updateUnread(Math.max(0, unreadCount - 1));
      notificationService.markAsRead(notification.notification_id).catch(() => {});
    }

    const cardId = notification.card_id ?? (notification.reference_type === 'kanban_card' ? notification.reference_id : null);
    if (notification.board_id && cardId) {
      onClose?.();
      navigate(`/kanban-board/${notification.board_id}?card=${cardId}`);
    }
  };

  const displayedNotifications = showAll ? notifications : notifications.slice(0, PREVIEW_COUNT);

  const groupedNotifications = useMemo(() => {
    const order = ['Today', 'Yesterday', 'Earlier'];
    const groups = {};
    displayedNotifications.forEach((n) => {
      const label = getGroupLabel(parseDate(n.created_at));
      (groups[label] ||= []).push(n);
    });
    return order.filter((label) => groups[label]).map((label) => ({ label, items: groups[label] }));
  }, [displayedNotifications]);

  const totalCount = Number(pagination.total) || notifications.length;

  const renderHeader = () => (
    <div className="notifications-modal-header">
      <h2 className="notifications-title">Notifications</h2>
      <div className="notifications-header-actions">
        {notifications.length > 0 && (
          <button
            className="mark-all-read-btn"
            onClick={handleMarkAllAsRead}
            type="button"
            disabled={unreadCount === 0}
          >
            <FiCheck />
            Mark all as read
          </button>
        )}
        <button
          className="notifications-close-btn"
          onClick={onClose}
          aria-label="Close"
          type="button"
        >
          <FiX />
        </button>
      </div>
    </div>
  );

  const renderItem = (notification) => {
    const IconComponent = getIcon(notification);
    const isRead = Number(notification.is_read) === 1;
    return (
      <div
        key={notification.notification_id}
        className={`notification-item ${!isRead ? 'success-background' : 'read'}`}
        onClick={() => handleNotificationClick(notification)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') handleNotificationClick(notification); }}
        style={{ cursor: 'pointer' }}
      >
        <div className="notification-icon-wrapper">
          <IconComponent className="notification-icon" />
        </div>
        <div className="notification-content">
          <div className="notification-header">
            {!isRead && <span className="notification-dot"></span>}
            <h4 className="notification-title">{notification.title}</h4>
            <span className="notification-timestamp" title={notification.created_at}>
              {formatRelative(parseDate(notification.created_at))}
            </span>
          </div>
          <p className="notification-message">
            {formatMessage(notification.message, notification.created_by_name)}
          </p>
        </div>
      </div>
    );
  };

  const renderList = () => {
    if (loading) {
      return <p className="notification-message" style={{ textAlign: 'center', padding: '24px 0' }}>Loading notifications...</p>;
    }
    if (error) {
      return (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <p className="notification-message">{error}</p>
          <button className="view-all-notifications-btn" onClick={loadInitial} type="button">Retry</button>
        </div>
      );
    }
    if (notifications.length === 0) {
      return (
        <div className="notifications-empty-state">
          <div className="notifications-empty-icon">
            <FiBellOff />
          </div>
          <h3 className="notifications-empty-title">You&apos;re all caught up</h3>
          <p className="notifications-empty-text">
            No notifications yet. New card assignments and updates will show up here.
          </p>
          <button className="notifications-empty-refresh" onClick={loadInitial} type="button">
            <FiRefreshCw />
            Refresh
          </button>
        </div>
      );
    }
    return groupedNotifications.map((group) => (
      <div className="notifications-group" key={group.label}>
        <h3 className="notifications-group-title">{group.label}</h3>
        <div className="notifications-list">{group.items.map(renderItem)}</div>
      </div>
    ));
  };

  const renderFooter = () => {
    if (loading || error || notifications.length === 0) return null;
    if (showAll && hasMorePages) {
      return (
        <button className="view-all-notifications-btn" onClick={handleLoadMore} type="button" disabled={loadingMore}>
          {loadingMore ? 'Loading...' : 'Load more'}
        </button>
      );
    }
    if (totalCount <= PREVIEW_COUNT) return null;
    return (
      <button className="view-all-notifications-btn" onClick={() => setShowAll(!showAll)} type="button">
        {showAll ? 'Show less' : `View all notifications (${totalCount})`}
      </button>
    );
  };

  const footer = renderFooter();

  const renderBody = () => (
    <div className="notifications-modal-body">
      <div className="notifications-divider"></div>
      {renderList()}
      {footer && (
        <>
          <div className="notifications-divider"></div>
          <div className="notifications-footer-link">{footer}</div>
        </>
      )}
    </div>
  );

  return (
    <CustomModal
      className="modal fade show notifications-modal"
      dialgName="modal-dialog modal-dialog-centered"
      show={show}
      closeModal={onClose}
      header={renderHeader()}
      body={renderBody()}
    />
  );
}

export default NotificationsModal;
