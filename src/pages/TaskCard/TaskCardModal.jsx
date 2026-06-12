import { useState, useCallback, useEffect } from "react";

import userService from "../../services/userService";
import SearchableSelect, { deriveSearchPlaceholder } from "../../components/form/SearchableSelect";
import "../../design/css/common/CardForm.css";
import "../../design/css/components/CardItem.css";
import "../../design/scss/pages/taskCard.scss";
import DateTimePickerField from "../KanbanBoard/CardFormTabs/shared/components/DateTimePickerField";

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
    const [cardTitle, setCardTitle] = useState("");
    const [taskName, setTaskName] = useState("");
    const [assignUserId, setAssignUserId] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [dueTime, setDueTime] = useState("");
    const [taskNameError, setTaskNameError] = useState("");
    const [users, setUsers] = useState([]);

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

    const assignedUser = users.find((u) => String(u.user_id) === String(assignUserId));

    const handleReset = useCallback(() => {
        setCardTitle("");
        setTaskName("");
        setAssignUserId("");
        setDueDate("");
        setDueTime("");
        setTaskNameError("");
    }, []);

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

        const dueDateDisplay = dueDate ? (dueTime ? `${dueDate} ${dueTime}` : dueDate) : "";
        const newTask = {
            id: Date.now(),
            cardTitle: cardTitle || "Task Card",
            taskName: taskName.trim(),
            assignUserId,
            assignedUserName: assignedUser?.name || "",
            dueDate: dueDateDisplay,
            isSubTask: true,
        };

        window.dispatchEvent(new CustomEvent("subtask:card-created", { detail: newTask }));
        handleReset();
    }, [cardTitle, taskName, assignUserId, dueDate, dueTime, assignedUser, handleReset]);

    if (!show) return null;

    const dueDateDisplay = dueDate ? (dueTime ? `${dueDate} ${dueTime}` : dueDate) : "";

    return (
        <div className="cardform-overlay">
            <div className="cardform-panel add-mode">

                <div className="cardform-topbar tc-topbar">
                    <input
                        type="text"
                        className="cardform-title-input"
                        placeholder="Enter card title"
                        value={cardTitle}
                        onChange={(e) => setCardTitle(e.target.value)}
                        autoFocus
                    />
                    <div className="cardform-topbar-right">
                        <button type="button" className="cardform-close-btn" onClick={handleClose}>✕</button>
                    </div>
                </div>

                <div className="tc-layout">

                    {/* Form side */}
                    <div className="tc-form-side">
                        <div className="tc-body">
                            <h3 className="tc-form-title">Create Task Card</h3>

                            <div className="tc-field">
                                <label className="tc-label" htmlFor="tc-task-name">
                                    Task Description <span className="text-danger">*</span>
                                </label>
                                <textarea
                                    id="tc-task-name"
                                    className={`tc-textarea${taskNameError ? " is-invalid" : ""}`}
                                    rows={3}
                                    placeholder="Enter task description..."
                                    value={taskName}
                                    onChange={(e) => { setTaskName(e.target.value); setTaskNameError(""); }}
                                />
                                {taskNameError && <span className="tc-field-error">{taskNameError}</span>}
                            </div>

                            <div className="tc-field-row">
                                <div className="tc-field">
                                    <label className="tc-label">Assign User</label>
                                    <SearchableSelect
                                        value={assignUserId === "" ? "" : String(assignUserId)}
                                        onChange={(val) => setAssignUserId(val)}
                                        options={userOptions}
                                        placeholder="Select user"
                                        searchPlaceholder={deriveSearchPlaceholder("Select user")}
                                        renderOption={(option) => (
                                            <div className="cf-searchable-option-with-avatar">
                                                <UserOptionAvatar avatarUrl={option.avatar} label={option.label} className="cf-owner-avatar--sm" />
                                                <span>{option.label}</span>
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

                    {/* Preview side */}
                    <div className="tc-preview-side">
                        <p className="tc-preview-label">Preview</p>
                        <p className="tc-preview-subtitle">How this card will appear on the board</p>

                        <div className="kanban-card tc-preview-card">
                            <div className="card-api-title-row">
                                <h3 className="card-title card-api-title-text tc-preview-title">
                                    {cardTitle || "Task Card"}
                                </h3>
                                {assignedUser && (
                                    <span className="card-api-user-avatar">
                                        {assignedUser.name.charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>

                            {taskName ? (
                                <p className="card-api-task-name tc-preview-task">{taskName}</p>
                            ) : (
                                <p className="tc-preview-empty">Task description will appear here...</p>
                            )}

                            {assignedUser && (
                                <p className="card-api-secondary">{assignedUser.name}</p>
                            )}

                            <div className="card-api-summary-row">
                                <div className="card-api-summary-left">
                                    <span className="card-api-timeline">
                                        {dueDateDisplay || "No due date"}
                                    </span>
                                </div>
                                <div className="card-api-summary-right">
                                    <span className="tc-preview-badge">Task</span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
}

export default TaskCardModal;
