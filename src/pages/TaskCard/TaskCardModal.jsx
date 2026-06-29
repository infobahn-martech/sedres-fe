import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Tag, Layers3, AlertTriangle, Sticker } from "lucide-react";

import userService from "../../services/userService";
import SearchableSelect, { deriveSearchPlaceholder } from "../../components/form/SearchableSelect";
import ColorPickerIcon from "../../assets/images/ColorPicker.png";
import SedresColorPicker from "../../components/SedresColorPicker/SedresColorPicker";
import "../../design/css/common/CardForm.css";
import "../../design/scss/pages/taskCard.scss";
import "../../design/scss/invoice.scss";
import DateTimePickerField from "../KanbanBoard/CardFormTabs/shared/components/DateTimePickerField";

const MENTION_TRIGGER_REGEX = /@([^\s@]*)$/;

const UserOptionAvatar = ({ avatarUrl, label, className = "" }) => {
    const letter = label ? String(label).trim().charAt(0).toUpperCase() : "U";
    const src = avatarUrl ? String(avatarUrl).trim() : "";
    const [imgFailed, setImgFailed] = useState(false);
    if (src && !imgFailed) {
        return (
            <div className={`cf-owner-avatar cf-owner-avatar--img ${className}`.trim()}>
                <img src={src} alt="" onError={() => setImgFailed(true)} />
            </div>
        );
    }
    return <div className={`cf-owner-avatar ${className}`.trim()}>{letter}</div>;
};

function TaskCardModal({ show, onClose }) {
    const textareaRef = useRef(null);

    const [cardTitle, setCardTitle] = useState("");
    const [taskName, setTaskName] = useState("");
    const [assignUserId, setAssignUserId] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [dueTime, setDueTime] = useState("");
    const [taskNameError, setTaskNameError] = useState("");
    const [users, setUsers] = useState([]);

    const [mentionOpen, setMentionOpen] = useState(false);
    const [mentionSearch, setMentionSearch] = useState("");
    const [mentionStartIndex, setMentionStartIndex] = useState(null);
    const [selectedMentionUserIds, setSelectedMentionUserIds] = useState([]);

    const [topbarColor, setTopbarColor] = useState("#2e7d32");
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

    useEffect(() => {
        if (!show) return;
        userService.getUsers({ params: { limit: 200 } })
            .then(({ data }) => setUsers(data?.data || []))
            .catch(() => setUsers([]));
    }, [show]);

    const userOptions = users.map((u) => ({
        value: String(u.user_id),
        label: u.name,
        avatar: u.avatar_path || u.avatar || "",
    }));

    const filteredMentionUsers = useMemo(() => {
        const term = mentionSearch.trim().toLowerCase();
        if (!term) return users;
        return users.filter((u) => (u.name || "").toLowerCase().includes(term));
    }, [users, mentionSearch]);

    const closeMentionDropdown = useCallback(() => {
        setMentionOpen(false);
        setMentionSearch("");
        setMentionStartIndex(null);
    }, []);

    const handleTaskNameChange = useCallback((e) => {
        const val = e.target.value;
        setTaskName(val);
        if (val) setTaskNameError("");

        const cursor = e.target.selectionStart;
        const textBefore = val.slice(0, cursor);
        const match = textBefore.match(MENTION_TRIGGER_REGEX);
        if (match) {
            setMentionOpen(true);
            setMentionSearch(match[1] || "");
            setMentionStartIndex(cursor - match[0].length);
        } else {
            closeMentionDropdown();
        }
    }, [closeMentionDropdown]);

    const handleSelectMentionUser = useCallback((user) => {
        if (mentionStartIndex === null) return;
        const before = taskName.slice(0, mentionStartIndex);
        const after = taskName.slice(mentionStartIndex + 1 + mentionSearch.length);
        const inserted = `@${user.name} `;
        const newText = before + inserted + after;
        setTaskName(newText);
        setSelectedMentionUserIds((prev) =>
            prev.some((id) => String(id) === String(user.user_id)) ? prev : [...prev, user.user_id]
        );
        closeMentionDropdown();
        setTimeout(() => {
            const pos = before.length + inserted.length;
            textareaRef.current?.focus();
            textareaRef.current?.setSelectionRange(pos, pos);
        }, 0);
    }, [taskName, mentionSearch, mentionStartIndex, closeMentionDropdown]);

    const handleReset = useCallback(() => {
        setCardTitle("");
        setTaskName("");
        setAssignUserId("");
        setDueDate("");
        setDueTime("");
        setTaskNameError("");
        setSelectedMentionUserIds([]);
        closeMentionDropdown();
        setIsColorPickerOpen(false);
    }, [closeMentionDropdown]);

    const handleClose = useCallback(() => {
        handleReset();
        onClose();
    }, [handleReset, onClose]);

    const handleSave = useCallback(() => {
        if (!taskName.trim()) {
            setTaskNameError("Task description is required");
            return;
        }
        setTaskNameError("");

        const assignedUser = users.find((u) => String(u.user_id) === String(assignUserId));
        const dueDateDisplay = dueDate ? (dueTime ? `${dueDate} ${dueTime}` : dueDate) : "";
        const newTask = {
            id: Date.now(),
            cardTitle: cardTitle || "Task Card",
            taskName: taskName.trim(),
            assignUserId,
            assignedUserName: assignedUser?.name || "",
            dueDate: dueDateDisplay,
            mentionedUsers: selectedMentionUserIds,
            isSubTask: true,
        };

        window.dispatchEvent(new CustomEvent("subtask:card-created", { detail: newTask }));
        handleReset();
    }, [cardTitle, taskName, assignUserId, dueDate, dueTime, users, selectedMentionUserIds, handleReset]);

    if (!show) return null;

    return (
        <div className="cardform-overlay">
            <div className="cardform-panel add-mode">

                <div className="cardform-topbar tc-topbar" style={{ backgroundColor: topbarColor }}>
                    <input
                        type="text"
                        className="cardform-title-input"
                        placeholder="Enter card title"
                        value={cardTitle}
                        onChange={(e) => setCardTitle(e.target.value)}
                        autoFocus
                    />
                    <div className="cardform-topbar-right">
                        <button type="button" className="topbar-icon-btn" title="Tag" aria-label="Tag" disabled>
                            <Tag size={20} aria-hidden />
                        </button>
                        <button type="button" className="topbar-icon-btn" title="Type" aria-label="Type" disabled>
                            <Layers3 size={20} aria-hidden />
                        </button>
                        <button type="button" className="topbar-icon-btn" title="Blocker" aria-label="Blocker" disabled>
                            <AlertTriangle size={20} aria-hidden />
                        </button>
                        <button type="button" className="topbar-icon-btn" title="Sticker" aria-label="Sticker" disabled>
                            <Sticker size={20} aria-hidden />
                        </button>
                        <div className="topbar-color-picker-wrapper">
                            <button
                                type="button"
                                className="topbar-color-picker-label"
                                onClick={() => setIsColorPickerOpen((o) => !o)}
                                title="Change header color"
                                aria-label="Color Picker"
                                aria-expanded={isColorPickerOpen}
                            >
                                <img src={ColorPickerIcon} alt="Color Picker" className="topbar-color-picker-icon" />
                            </button>
                            {isColorPickerOpen && (
                                <div className="tc-color-picker-popover">
                                    <SedresColorPicker
                                        ariaLabel="Pick card header color"
                                        initialHex={topbarColor}
                                        className="kanban-dashboard-color-picker-popover--floating"
                                        onApply={(hex) => { setTopbarColor(hex); setIsColorPickerOpen(false); }}
                                        onCancel={() => setIsColorPickerOpen(false)}
                                    />
                                </div>
                            )}
                        </div>
                        <button type="button" className="cardform-close-btn" onClick={handleClose}>✕</button>
                    </div>
                </div>

                <div className="tc-body">
                    <h3 className="tc-form-title">Create Task Card</h3>

                    <div className="tc-field">
                        <label className="tc-label" htmlFor="tc-task-name">
                            Task Description <span className="text-danger">*</span>
                        </label>
                        <div className="comments-tab-mention-host">
                            <textarea
                                ref={textareaRef}
                                id="tc-task-name"
                                className={`tc-textarea${taskNameError ? " is-invalid" : ""}`}
                                rows={3}
                                placeholder="Enter task description... (type @ to mention)"
                                value={taskName}
                                onChange={handleTaskNameChange}
                                onBlur={() => setTimeout(closeMentionDropdown, 150)}
                            />

                            {mentionOpen && (
                                <div
                                    className="comments-tab-mention-dropdown"
                                    role="listbox"
                                    aria-label="Mention a user"
                                >
                                    {filteredMentionUsers.length === 0 ? (
                                        <p className="comments-tab-mention-status">No users found</p>
                                    ) : (
                                        filteredMentionUsers.map((user) => (
                                            <button
                                                key={user.user_id}
                                                type="button"
                                                className="comments-tab-mention-option"
                                                role="option"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => handleSelectMentionUser(user)}
                                            >
                                                <span className="comments-tab-mention-avatar">
                                                    {user.avatar_path || user.avatar ? (
                                                        <img src={user.avatar_path || user.avatar} alt="" />
                                                    ) : (
                                                        <span className="comments-tab-mention-avatar-fallback">
                                                            {(user.name || "?").charAt(0).toUpperCase()}
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="comments-tab-mention-name">{user.name}</span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                        {taskNameError && <span className="tc-field-error">{taskNameError}</span>}
                    </div>

                    <div className="tc-field-row">
                        <div className="tc-field">
                            <label className="tc-label">Assign User</label>
                            <SearchableSelect
                                className="cf-owner-searchable-select"
                                value={assignUserId === "" ? "" : String(assignUserId)}
                                onChange={(e) => setAssignUserId(e.target.value)}
                                options={userOptions}
                                placeholder="Select user"
                                searchPlaceholder={deriveSearchPlaceholder("Select user")}
                                renderOption={(option) => (
                                    <div className="cf-searchable-option-with-avatar tc-user-option">
                                        <UserOptionAvatar avatarUrl={option.avatar} label={option.label} className="cf-owner-avatar--sm tc-user-avatar" />
                                        <span className="tc-user-name">{option.label}</span>
                                    </div>
                                )}
                            />
                        </div>

                        <div className="tc-field">
                            <label className="tc-label">Due Date &amp; Time</label>
                            <DateTimePickerField
                                dateValue={dueDate}
                                timeValue={dueTime}
                                onDateChange={(e) => setDueDate(e.target.value)}
                                onTimeChange={(e) => setDueTime(e.target.value)}
                                dateFieldName="dueDate"
                                timeFieldName="dueTime"
                                placeholder="Select date and time"
                            />
                        </div>
                    </div>

                    <div className="tc-save-row">
                        <button type="button" className="tc-cancel-btn" onClick={handleClose}>Cancel</button>
                        <button type="button" className="tc-save-btn" onClick={handleSave}>Create Task</button>
                    </div>
                </div>

            </div>
        </div>
    );
}

export default TaskCardModal;
