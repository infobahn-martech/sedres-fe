import { useState } from 'react';
import { FiMoreVertical, FiChevronLeft, FiPlus } from 'react-icons/fi';
import '../../design/scss/pages/compact/Compact.scss';

const ITEMS = [
  'Marine Port calls',
  'Crew Change / Material Supply',
  'L & T Marine and Crew workflow',
];

const MARINE_PORT_COLUMNS = [
  'Backlog',
  'Appointment Received',
  'Vessel Arrived/Cleared',
  'Vessel Sailed',
  'Ready To Finalize',
];

export default function Compact() {
  const [selectedBoard, setSelectedBoard] = useState(null);

  const handleItemClick = (label) => {
    if (label === 'Marine Port calls') {
      setSelectedBoard(label);
    }
  };

  const handleBack = () => {
    setSelectedBoard(null);
  };

  if (selectedBoard === 'Marine Port calls') {
    return (
      <div className="compact-page compact-board-view">
        <div className="compact-board-header">
          <button
            type="button"
            className="compact-board-back"
            onClick={handleBack}
            aria-label="Back to list"
          >
            <FiChevronLeft size={24} />
          </button>
          <h1 className="compact-board-title">{selectedBoard}</h1>
          <div className="compact-board-actions">
            <button type="button" className="compact-board-action-btn" aria-label="Add">
              <FiPlus size={20} />
            </button>
            <button type="button" className="compact-board-action-btn" aria-label="More options">
              <FiMoreVertical size={20} />
            </button>
          </div>
        </div>
        <div className="compact-board-content">
          <div className="compact-kanban-board">
            {MARINE_PORT_COLUMNS.map((title, index) => (
              <div key={index} className="compact-column">
                <div className="compact-column-header">
                  <div className="compact-column-header-left">
                    <h2 className="compact-column-title">{title}</h2>
                    <span className="compact-column-count">0</span>
                  </div>
                  <button type="button" className="compact-column-kebab" aria-label="Column options">
                    <FiMoreVertical size={16} />
                  </button>
                </div>
                <div className="card-list" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="compact-page">
      <div className="compact-list">
        {ITEMS.map((label, index) => (
          <div
            key={index}
            className={`compact-list-item ${label === 'Marine Port calls' ? 'compact-list-item-clickable' : ''}`}
            onClick={() => handleItemClick(label)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && label === 'Marine Port calls' && handleItemClick(label)}
            role={label === 'Marine Port calls' ? 'button' : undefined}
            tabIndex={label === 'Marine Port calls' ? 0 : undefined}
          >
            <span className="compact-list-item-text">{label}</span>
            <button
              type="button"
              className="compact-list-item-kebab"
              aria-label="More options"
              onClick={(e) => e.stopPropagation()}
            >
              <FiMoreVertical size={20} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
