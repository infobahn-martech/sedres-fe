import { useState, useEffect } from 'react';
import CustomModal from '../../components/CustomModal';
import { FiAnchor, FiDollarSign, FiClock, FiCheck, FiX, FiAlertCircle, FiCheckCircle, FiTruck, FiUsers, FiFileText, FiMapPin } from 'react-icons/fi';
import '../../design/scss/common.scss';
import '../../design/scss/structure/header/NotificationsModal.scss';

function NotificationsModal({ show, onClose }) {
  const [showAll, setShowAll] = useState(false);

  // Reset showAll when modal closes
  useEffect(() => {
    if (!show) {
      setShowAll(false);
    }
  }, [show]);


  const initialNotifications = [
    {
      id: 1,
      type: 'vessel',
      icon: FiAnchor,
      title: 'Vessel Arrival Notification',
      message: 'Vessel **MV Sedres Express** has **arrived** at **Dammam Port**. ETA was **08:30 AM**. Please proceed with clearance procedures.',
      timestamp: '2h ago',
      isRead: false,
      status: 'arrived',
      highlightedText: 'arrived',
      highlightedColor: '#65BD50',
      hasSuccessBackground: true
    },
    {
      id: 2,
      type: 'appointment',
      icon: FiClock,
      title: 'Appointment Received',
      message: 'New appointment received for vessel **MV Al Fajr** at **Al Jubail Commercial Sea Port**. Scheduled for **December 20, 2024 at 10:00 AM**.',
      timestamp: '3h ago',
      isRead: false,
      status: 'appointment',
      highlightedText: 'December 20, 2024 at 10:00 AM',
      highlightedColor: '#0263D1'
    },
    {
      id: 3,
      type: 'billing',
      icon: FiDollarSign,
      title: 'Payment Received',
      message: 'Payment of **$45,000** has been received from **Sedres Maritime Co.** for invoice **INV-2024-1245**. Payment processed **successfully**.',
      timestamp: '5h ago',
      isRead: false,
      status: 'payment',
      highlightedText: 'successfully',
      highlightedColor: '#65BD50',
      hasSuccessBackground: true
    },
    {
      id: 4,
      type: 'vessel',
      icon: FiCheckCircle,
      title: 'Vessel Cleared',
      message: 'Vessel **MV Global Star** has been **cleared** at **Ras Tanura Refinery**. All documentation is **complete**. Ready for departure.',
      timestamp: '6h ago',
      isRead: false,
      status: 'cleared',
      highlightedText: 'cleared',
      highlightedColor: '#65BD50'
    },
    {
      id: 5,
      type: 'crew',
      icon: FiUsers,
      title: 'Crew Assignment Update',
      message: 'Crew member **Ahmed Hassan** has been assigned to vessel **MV Sedres Express**. Assignment **confirmed** and notified.',
      timestamp: '8h ago',
      isRead: false,
      status: 'crew',
      highlightedText: 'confirmed',
      highlightedColor: '#65BD50'
    },
    {
      id: 6,
      type: 'inspection',
      icon: FiFileText,
      title: 'Custom Inspection Scheduled',
      message: 'Custom inspection for vessel **MV Al Khafji** at **Al Khafji Port** is scheduled for **December 19, 2024 at 2:00 PM**. Please ensure all documents are ready.',
      timestamp: '10h ago',
      isRead: false,
      status: 'inspection',
      highlightedText: 'December 19, 2024 at 2:00 PM',
      highlightedColor: '#EF934D'
    },
    {
      id: 7,
      type: 'transport',
      icon: FiTruck,
      title: 'Transport Request Approved',
      message: 'Transport request for **Material Type: Steel Beams** from **Dammam Port** to **Al Jubail** has been **approved**. Driver **Mohammed Ali** assigned.',
      timestamp: '12h ago',
      isRead: false,
      status: 'transport',
      highlightedText: 'approved',
      highlightedColor: '#65BD50'
    },
    {
      id: 8,
      type: 'vessel',
      icon: FiAlertCircle,
      title: 'Vessel Departure Alert',
      message: 'Vessel **MV As Safaniya** is scheduled to **depart** from **As Safaniya Port** on **December 18, 2024 at 6:00 PM**. Final checks required.',
      timestamp: '1d ago',
      isRead: false,
      status: 'departure',
      highlightedText: 'December 18, 2024 at 6:00 PM',
      highlightedColor: '#EF934D'
    },
    {
      id: 9,
      type: 'billing',
      icon: FiDollarSign,
      title: 'Invoice Generated',
      message: 'Invoice **INV-2024-1289** has been generated for **Al Fajr Shipping LLC** amounting to **$32,500**. Invoice sent to **billing@alfajrshipping.com**.',
      timestamp: '1d ago',
      isRead: false,
      status: 'invoice',
      highlightedText: 'INV-2024-1289',
      highlightedColor: '#0263D1'
    },
    {
      id: 10,
      type: 'port',
      icon: FiMapPin,
      title: 'Port Status Update',
      message: 'Port **Dammam Port** status has been updated to **Operational**. All services are **available** and ready for vessel operations.',
      timestamp: '2d ago',
      isRead: false,
      status: 'port',
      highlightedText: 'Operational',
      highlightedColor: '#65BD50'
    }
  ];

  const [notifications, setNotifications] = useState(initialNotifications);
  const displayedNotifications = showAll ? notifications : notifications.slice(0, 3);

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(notif => ({ ...notif, isRead: true })));
  };



  const renderHeader = () => (
    <div className="notifications-modal-header">
      <h2 className="notifications-title">Notifications</h2>
      <div className="notifications-header-actions">
        <button
          className="mark-all-read-btn"
          onClick={handleMarkAllAsRead}
          type="button"
        >
          <FiCheck />
          Mark all as read
        </button>
        <button
          className="notifications-close-btn"
          onClick={onClose}
          aria-label="Close"
          type="button"
        >
          <FiX />
        </button>

      </div>
    </div >
  );

  const formatMessage = (message, highlightedText, highlightedColor) => {
    // First, replace the highlighted text with a special marker
    const highlightedPattern = `**${highlightedText}**`;
    const parts = message.split(highlightedPattern);
    const elements = [];
    let keyCounter = 0;

    parts.forEach((part, index) => {
      if (part) {
        // Process bolded text in the part
        const boldRegex = /\*\*(.*?)\*\*/g;
        let lastIndex = 0;
        let match;

        while ((match = boldRegex.exec(part)) !== null) {
          // Add text before the match
          if (match.index > lastIndex) {
            elements.push(
              <span key={`text-${keyCounter++}`}>
                {part.substring(lastIndex, match.index)}
              </span>
            );
          }
          // Add bolded text
          elements.push(
            <strong key={`bold-${keyCounter++}`}>{match[1]}</strong>
          );
          lastIndex = match.index + match[0].length;
        }
        // Add remaining text after last match
        if (lastIndex < part.length) {
          elements.push(
            <span key={`text-${keyCounter++}`}>
              {part.substring(lastIndex)}
            </span>
          );
        }
      }
      // Add highlighted text between parts
      if (index < parts.length - 1) {
        elements.push(
          <strong key={`highlight-${keyCounter++}`} style={{ color: highlightedColor }}>
            {highlightedText}
          </strong>
        );
      }
    });

    return elements.length > 0 ? elements : message;
  };

  const renderBody = () => (
    <div className="notifications-modal-body">
      <div className="notifications-divider"></div>

      <div className="notifications-group">
        <h3 className="notifications-group-title">Today</h3>

        <div className="notifications-list">
          {displayedNotifications.map((notification) => {
            const IconComponent = notification.icon;
            return (
              <div
                key={notification.id}
                className={`notification-item ${notification.hasSuccessBackground ? 'success-background' : ''} ${notification.isRead ? 'read' : ''}`}
              >
                <div className="notification-icon-wrapper">
                  <IconComponent className="notification-icon" />
                </div>
                <div className="notification-content">
                  <div className="notification-header">
                    {!notification.isRead && <span className="notification-dot"></span>}
                    <h4 className="notification-title">{notification.title}</h4>
                    <span className="notification-timestamp">{notification.timestamp}</span>
                  </div>
                  <p className="notification-message">
                    {formatMessage(
                      notification.message,
                      notification.highlightedText,
                      notification.highlightedColor
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="notifications-divider"></div>

      <div className="notifications-footer-link">
        <button
          className="view-all-notifications-btn"
          onClick={() => setShowAll(!showAll)}
          type="button"
        >
          {showAll ? 'Show less' : `View all notifications (${notifications.length})`}
        </button>
      </div>
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

