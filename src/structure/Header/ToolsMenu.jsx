import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { FiAnchor, FiBookOpen, FiCalendar, FiCloud, FiHash, FiTool } from 'react-icons/fi';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import ToolModal from './ToolModal';

const CalculatorModal = lazy(() => import('./CalculatorModal'));
const DictionaryModal = lazy(() => import('./DictionaryModal'));
const WeatherModal = lazy(() => import('./WeatherModal'));
const CalendarModal = lazy(() => import('./CalendarModal'));

const MARINE_TRAFFIC_EMBED_URL =
  'https://www.marinetraffic.com/en/ais/embed/zoom:4/centery:25.0/centerx:-12.0/maptype:4/shownames:false/mmsi:0/shipid:0/fleet:/fleet_id:/vtypes:/showmenu:true/remember:false';

const TOOL_ITEMS = [
  { key: 'calculator', label: 'Calculator', icon: <FiHash /> },
  { key: 'dictionary', label: 'Dictionary', icon: <FiBookOpen /> },
  { key: 'weather', label: 'Weather', icon: <FiCloud /> },
  { key: 'calendar', label: 'Calendar', icon: <FiCalendar /> },
  { key: 'vessel', label: 'Vessel Tracking', icon: <FiAnchor /> },
];

/**
 * Tools trigger + menu. `variant="header"` renders the navbar icon + dropdown;
 * `variant="sidebar"` renders a kanban sidebar icon with a flyout.
 * The modals live in <ToolModals>, rendered by the host outside any menu that can unmount.
 */
function ToolsMenu({ variant = 'header', onSelect }) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  const isSidebar = variant === 'sidebar';

  useEffect(() => {
    if (!showMenu) return undefined;
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const toggleMenu = () => setShowMenu((prev) => !prev);

  const handleToolClick = (key) => {
    setShowMenu(false);
    onSelect(key);
  };

  if (isSidebar) {
    return (
      <div ref={menuRef} style={{ position: 'relative' }}>
        <div
          role="button"
          tabIndex={0}
          className={`kanban-sidebar-icon ${showMenu ? 'active' : ''}`}
          aria-label="Tools"
          aria-expanded={showMenu}
          onClick={toggleMenu}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleMenu();
            }
          }}
          data-tooltip-id="sidebar-tooltip"
          data-tooltip-content="Tools"
        >
          <FiTool size={22} />
        </div>

        {showMenu && (
          <div className="kanban-sidebar-submenu">
            {TOOL_ITEMS.map(({ key, label, icon }) => (
              <div
                key={key}
                role="button"
                tabIndex={0}
                className="kanban-sidebar-submenu-item kanban-sidebar-submenu-item--with-icon"
                onClick={() => handleToolClick(key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleToolClick(key);
                }}
              >
                <span className="kanban-sidebar-submenu-icon">{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Reuses the settings dropdown styles so both header menus look identical
  return (
    <div className="settings-btn-wrapper" ref={menuRef}>
      <Tooltip id="tools" place="bottom" content="Tools" />
      <button
        type="button"
        className={`icon-btn ${showMenu ? 'active' : ''}`}
        aria-label="Tools"
        aria-expanded={showMenu}
        onClick={toggleMenu}
        data-tooltip-id="tools"
      >
        <FiTool />
      </button>

      {showMenu && (
        <div className="settings-dropdown">
          <div className="settings-dropdown-title">Tools</div>
          {TOOL_ITEMS.map(({ key, label, icon }) => (
            <button
              type="button"
              key={key}
              className="settings-dropdown-item"
              onClick={() => handleToolClick(key)}
            >
              <span className="settings-item-icon">{icon}</span>
              <span className="settings-item-label">{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ToolModals({ activeTool, onClose }) {
  return (
    <>
      {/* Vessel Tracking — MarineTraffic blocks iframing its main site, so use its embed map */}
      <ToolModal
        show={activeTool === 'vessel'}
        onClose={onClose}
        title="Vessel Tracking"
        icon={<FiAnchor />}
        className="vessel-modal"
      >
        <iframe title="MarineTraffic Live Map" src={MARINE_TRAFFIC_EMBED_URL} className="vessel-tracking-frame" />
      </ToolModal>

      <Suspense fallback={null}>
        {activeTool === 'calculator' && <CalculatorModal show onClose={onClose} />}
        {activeTool === 'dictionary' && <DictionaryModal show onClose={onClose} />}
        {activeTool === 'weather' && <WeatherModal show onClose={onClose} />}
        {activeTool === 'calendar' && <CalendarModal show onClose={onClose} />}
      </Suspense>
    </>
  );
}

export default ToolsMenu;
