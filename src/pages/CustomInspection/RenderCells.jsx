import { useState, useRef, useEffect } from 'react';
import { Tooltip } from 'react-tooltip';
import moment from 'moment';

import eye from '../../assets/images/eye.svg';

export const RenderAction = ({ row, onViewClick }) => {
  return (
    <>
      <Tooltip id="view" place="top" content="View" />
      <div className="actions">
        <span
          data-tooltip-id="view"
          type="button"
          className="view"
          onClick={(e) => {
            e.stopPropagation();
            onViewClick && onViewClick(row);
          }}
        >
          <img src={eye} alt="view" />
        </span>
      </div>
    </>
  );
};

export const DateFormat = ({ row, selector }) => {
  const formattedDate = moment(row[selector]).format('DD/MM/YYYY hh:mm a');
  return formattedDate;
};

export const EditableStatus = ({ row, onStatusChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0, openUpward: false });
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const status = row?.status?.toLowerCase();
  
  const statusOptions = [
    { value: 'commenced', label: 'Commenced' },
    { value: 'passed', label: 'Passed' },
    { value: 'failed', label: 'Failed' },
  ];

  const statusConfig = {
    commenced: { label: 'Commenced', className: 'status-commenced' },
    passed: { label: 'Passed', className: 'status-passed' },
    failed: { label: 'Failed', className: 'status-failed' },
  };

  const config = statusConfig[status] || { label: status, className: 'status-default' };

  const calculateDropdownPosition = () => {
    if (buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const spaceBelow = viewportHeight - buttonRect.bottom;
      const spaceAbove = buttonRect.top;
      const estimatedMenuHeight = 120; // Approximate height of 3 items + padding
      const menuWidth = buttonRect.width;
      
      // Determine if should open upward
      const shouldOpenUpward = spaceBelow < estimatedMenuHeight && spaceAbove > estimatedMenuHeight;
      
      // Calculate position
      let top, left;
      if (shouldOpenUpward) {
        top = buttonRect.top - estimatedMenuHeight - 4;
      } else {
        top = buttonRect.bottom + 4;
      }
      
      left = buttonRect.left;
      
      // Ensure menu doesn't go off screen horizontally
      if (left + menuWidth > viewportWidth) {
        left = viewportWidth - menuWidth - 10;
      }
      if (left < 10) {
        left = 10;
      }
      
      setMenuPosition({
        top,
        left,
        width: menuWidth,
        openUpward: shouldOpenUpward
      });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedInsideButton = buttonRef.current && buttonRef.current.contains(event.target);
      const clickedInsideMenu = menuRef.current && menuRef.current.contains(event.target);
      
      if (!clickedInsideButton && !clickedInsideMenu) {
        setIsOpen(false);
      }
    };

    const handleScroll = () => {
      if (isOpen) {
        calculateDropdownPosition();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', calculateDropdownPosition);
      // Calculate position after opening
      setTimeout(() => {
        calculateDropdownPosition();
      }, 0);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', calculateDropdownPosition);
    };
  }, [isOpen]);

  const handleToggle = (e) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleSelect = (e, optionValue) => {
    e.stopPropagation();
    if (onStatusChange && optionValue !== status) {
      onStatusChange(row, optionValue);
    }
    setIsOpen(false);
  };

  return (
    <>
      <div 
        className={`status-dropdown-wrapper ${isOpen ? 'open' : ''}`}
        ref={dropdownRef}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={buttonRef}
          type="button"
          className={`status-dropdown-button ${config.className} ${isOpen ? 'active' : ''}`}
          onClick={handleToggle}
        >
          <span className="status-label">{config.label}</span>
          <svg 
            className={`status-arrow ${isOpen ? 'open' : ''}`}
            width="12" 
            height="12" 
            viewBox="0 0 12 12" 
            fill="none"
          >
            <path 
              d="M3 4.5L6 7.5L9 4.5" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      
      {isOpen && (
        <div 
          ref={menuRef}
          className={`status-dropdown-menu ${menuPosition.openUpward ? 'open-upward' : ''}`}
          style={{
            position: 'fixed',
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
            width: `${menuPosition.width}px`,
            zIndex: 10000
          }}
        >
          {statusOptions.map((option) => {
            const optionConfig = statusConfig[option.value] || { label: option.label, className: 'status-default' };
            const isSelected = option.value === status;
            
            return (
              <button
                key={option.value}
                type="button"
                className={`status-dropdown-item ${optionConfig.className} ${isSelected ? 'selected' : ''}`}
                onClick={(e) => handleSelect(e, option.value)}
              >
                <span className="status-item-label">{option.label}</span>
                {isSelected && (
                  <svg 
                    className="status-check-icon"
                    width="14" 
                    height="14" 
                    viewBox="0 0 14 14" 
                    fill="none"
                  >
                    <path 
                      d="M11.6667 3.5L5.25 9.91667L2.33334 7" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
};

export const RenderStatus = ({ row }) => {
  const status = row?.status?.toLowerCase();
  const statusConfig = {
    commenced: { label: 'Commenced', className: 'status-commenced' },
    passed: { label: 'Passed', className: 'status-passed' },
    failed: { label: 'Failed', className: 'status-failed' },
  };

  const config = statusConfig[status] || { label: status, className: 'status-default' };

  return (
    <span className={`status-badge ${config.className}`}>
      {config.label}
    </span>
  );
};

