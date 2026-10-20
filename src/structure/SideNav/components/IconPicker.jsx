import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import DynamicIcon from './DynamicIcon';

/** Curated react-icons/fi + react-icons/lu exports (names must match package exports). */
const ICON_PICKER_OPTIONS = [
    { key: 'FiGrid', category: 'General', label: 'Grid' },
    { key: 'FiLayers', category: 'General', label: 'Layers' },
    { key: 'FiHome', category: 'General', label: 'Home' },
    { key: 'FiSearch', category: 'General', label: 'Search' },
    { key: 'FiSettings', category: 'Settings', label: 'Settings' },
    { key: 'FiTool', category: 'Settings', label: 'Tool' },
    { key: 'FiBell', category: 'Communication', label: 'Bell' },
    { key: 'FiMessageCircle', category: 'Communication', label: 'Message' },
    { key: 'FiMessageSquare', category: 'Communication', label: 'Message square' },
    { key: 'FiMail', category: 'Communication', label: 'Mail' },
    { key: 'FiPhone', category: 'Communication', label: 'Phone' },
    { key: 'FiSend', category: 'Communication', label: 'Send' },
    { key: 'FiMic', category: 'Communication', label: 'Mic' },
    { key: 'FiVideo', category: 'Communication', label: 'Video' },
    { key: 'FiCamera', category: 'Communication', label: 'Camera' },
    { key: 'FiWifi', category: 'Communication', label: 'WiFi' },
    { key: 'LuHeadphones', category: 'Communication', label: 'Headphones' },
    { key: 'LuMegaphone', category: 'Communication', label: 'Megaphone' },
    { key: 'FiUser', category: 'User', label: 'User' },
    { key: 'FiUsers', category: 'User', label: 'Users' },
    { key: 'FiBriefcase', category: 'User', label: 'Briefcase' },
    { key: 'FiFile', category: 'Document', label: 'File' },
    { key: 'FiFileText', category: 'Document', label: 'File text' },
    { key: 'FiFolder', category: 'Document', label: 'Folder' },
    { key: 'FiClipboard', category: 'Document', label: 'Clipboard' },
    { key: 'FiPaperclip', category: 'Document', label: 'Paperclip' },
    { key: 'LuBookOpen', category: 'Document', label: 'Book' },
    { key: 'LuClipboardList', category: 'Document', label: 'Checklist' },
    { key: 'FiCalendar', category: 'Calendar', label: 'Calendar' },
    { key: 'LuCalendarClock', category: 'Calendar', label: 'Calendar clock' },
    { key: 'LuHourglass', category: 'Calendar', label: 'Hourglass' },
    { key: 'FiGlobe', category: 'Location', label: 'Globe' },
    { key: 'LuMapPin', category: 'Location', label: 'Map pin' },
    { key: 'LuNavigation', category: 'Location', label: 'Navigation' },
    { key: 'FiAnchor', category: 'Maritime', label: 'Anchor' },
    { key: 'LuShip', category: 'Maritime', label: 'Ship' },
    { key: 'LuShipWheel', category: 'Maritime', label: 'Ship wheel' },
    { key: 'LuLifeBuoy', category: 'Maritime', label: 'Life buoy' },
    { key: 'LuWarehouse', category: 'Maritime', label: 'Warehouse' },
    { key: 'LuTowerControl', category: 'Maritime', label: 'Tower' },
    { key: 'LuPlane', category: 'Travel', label: 'Plane' },
    { key: 'LuTrainFront', category: 'Travel', label: 'Train' },
    { key: 'LuCar', category: 'Travel', label: 'Car' },
    { key: 'FiTruck', category: 'Travel', label: 'Truck' },
    { key: 'FiPackage', category: 'Travel', label: 'Package' },
    { key: 'FiLock', category: 'Security', label: 'Lock' },
    { key: 'FiUnlock', category: 'Security', label: 'Unlock' },
    { key: 'LuShield', category: 'Security', label: 'Shield' },
    { key: 'FiAlertTriangle', category: 'Warning', label: 'Warning' },
    { key: 'LuBug', category: 'Warning', label: 'Bug' },
    { key: 'FiHeart', category: 'General', label: 'Heart' },
    { key: 'FiStar', category: 'General', label: 'Star' },
    { key: 'LuSparkles', category: 'General', label: 'Sparkles' },
    { key: 'LuRocket', category: 'General', label: 'Rocket' },
    { key: 'FiCheck', category: 'Actions', label: 'Check' },
    { key: 'FiX', category: 'Actions', label: 'Close' },
    { key: 'FiPlus', category: 'Actions', label: 'Plus' },
    { key: 'FiUpload', category: 'Actions', label: 'Upload' },
    { key: 'FiDownload', category: 'Actions', label: 'Download' },
    { key: 'LuCloudUpload', category: 'Actions', label: 'Cloud upload' },
    { key: 'LuCloudDownload', category: 'Actions', label: 'Cloud download' },
    { key: 'LuUsb', category: 'Hardware', label: 'USB' },
    { key: 'LuCpu', category: 'Hardware', label: 'CPU' },
    { key: 'LuDatabase', category: 'Hardware', label: 'Database' },
    { key: 'LuServer', category: 'Hardware', label: 'Server' },
    { key: 'LuTerminal', category: 'Hardware', label: 'Terminal' },
    { key: 'LuCode', category: 'Hardware', label: 'Code' },
    { key: 'LuBuilding2', category: 'Business', label: 'Building' },
    { key: 'LuSun', category: 'General', label: 'Sun' },
    { key: 'LuMoon', category: 'General', label: 'Moon' },
];

const normalize = (s) => s.toLowerCase();

/**
 * Floating icon picker: filter input, scrollable grid, keyboard-accessible buttons.
 */
const IconPicker = ({ isOpen, selectedIconKey, onSelect }) => {
    const [filter, setFilter] = useState('');

    const filtered = useMemo(() => {
        const q = filter.trim();
        if (!q) return ICON_PICKER_OPTIONS;
        const n = normalize(q);
        return ICON_PICKER_OPTIONS.filter(
            (opt) =>
                normalize(opt.key).includes(n) ||
                normalize(opt.label).includes(n) ||
                normalize(opt.category).includes(n)
        );
    }, [filter]);

    if (!isOpen) return null;

    return (
        <div className="icon-picker-popup" role="dialog" aria-label="Choose icon">
            <input
                type="text"
                className="icon-picker-filter"
                placeholder="Filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                autoComplete="off"
                onMouseDown={(e) => e.stopPropagation()}
            />
            <div className="icon-picker-scroll">
                <div className="icon-picker-grid">
                    {filtered.map((opt) => {
                        const selected = selectedIconKey === opt.key;
                        const tooltip = `${opt.category} — ${opt.label}`;
                        return (
                            <button
                                key={opt.key}
                                type="button"
                                className={`icon-picker-item ${selected ? 'selected' : ''}`}
                                onClick={() => {
                                    onSelect(opt.key);
                                    setFilter('');
                                }}
                                title={tooltip}
                                aria-label={tooltip}
                                aria-pressed={selected}
                            >
                                <DynamicIcon iconKey={opt.key} size={20} />
                            </button>
                        );
                    })}
                </div>
                {filtered.length === 0 && (
                    <div className="icon-picker-empty">No icons match your filter.</div>
                )}
            </div>
        </div>
    );
};

IconPicker.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    selectedIconKey: PropTypes.string,
    onSelect: PropTypes.func.isRequired,
};

export default IconPicker;
