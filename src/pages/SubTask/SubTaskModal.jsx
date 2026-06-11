import { useState, useRef } from "react";
import { FiX } from "react-icons/fi";
import "../../design/css/common/CardForm.css";
import "../../design/scss/pages/kanban-board/cardForm.scss";
import "../../design/scss/invoice.scss";
import "./SubTaskModal.scss";

const TOPBAR_COLOR = "#2e7d32";

const DUMMY_USERS = [
    { user_id: 1, user_name: "Sarah Mitchell" },
    { user_id: 2, user_name: "James Chen" },
    { user_id: 3, user_name: "Elena Rodriguez" },
    { user_id: 4, user_name: "Omar Hassan" },
];

// Card preview — no logo, no company name, shows due date and 0%
function CardPreview({ cardTitle, taskName, dueDate }) {
    return (
        <div className="st-preview-wrap">
            <p className="st-preview-label">Card Preview</p>
            <div className="st-preview-card">
                <div className="st-preview-card-topbar" />
                <div className="st-preview-card-body">
                    <p className="st-preview-title">
                        {cardTitle || <span className="st-preview-placeholder">Card title will appear here...</span>}
                    </p>
                    {taskName && <p className="st-preview-subtitle">{taskName}</p>}
                    {dueDate && <p className="st-preview-due">{dueDate}</p>}
                    <div className="st-preview-footer">
                        <span className="st-preview-badge">Subtask</span>
                        <span className="st-preview-pct">0%</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// View mode — opened task card (readonly card name + task name, editable comments + upload)
function TaskCardDetailView({ task, onClose }) {
    const [comments, setComments] = useState("");
    const [files, setFiles] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const selected = Array.from(e.target.files || []);
        if (selected.length) setFiles((prev) => [...prev, ...selected]);
        e.target.value = "";
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const dropped = Array.from(e.dataTransfer.files || []);
        if (dropped.length) setFiles((prev) => [...prev, ...dropped]);
    };

    const removeFile = (index) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="cardform-overlay" style={{ zIndex: 1350 }}>
            <div className="cardform-panel add-mode">

                {/* Topbar — card name readonly */}
                <div className="cardform-topbar" style={{ backgroundColor: TOPBAR_COLOR }}>
                    <span className="cardform-topbar-title">{task.cardTitle || "Task Card"}</span>
                    <div className="cardform-topbar-right">
                        <button className="cardform-close-btn" onClick={onClose} type="button">✕</button>
                    </div>
                </div>

                <div className="cardform-body cardform-body--feed-tab">
                    <div className="subtasks-tab">
                        <div className="subtasks-tab-layout">
                            <section className="subtasks-tab-editor">
                                <div className="subtasks-tab-card subtasks-tab-card--editor">
                                    <div className="subtasks-tab-editor-body">

                                        {/* Task Name — readonly */}
                                        <div className="subtasks-tab-field">
                                            <label className="subtasks-tab-label">Task Name</label>
                                            <div className="st-readonly-field">{task.taskName || "—"}</div>
                                        </div>

                                        {/* Due Date — readonly */}
                                        <div className="subtasks-tab-field">
                                            <label className="subtasks-tab-label">Due Date</label>
                                            <div className="st-readonly-field">{task.dueDate || "—"}</div>
                                        </div>

                                        {/* Comments */}
                                        <div className="subtasks-tab-field">
                                            <label className="subtasks-tab-label" htmlFor="stv-comments">Comments</label>
                                            <textarea
                                                id="stv-comments"
                                                className="subtasks-tab-textarea"
                                                rows={3}
                                                placeholder="Add comments..."
                                                value={comments}
                                                onChange={(e) => setComments(e.target.value)}
                                            />
                                        </div>

                                        {/* Document Upload */}
                                        <div className="subtasks-tab-field">
                                            <label className="subtasks-tab-label">Document Upload</label>
                                            <div
                                                className={`st-upload-zone ${isDragging ? "st-upload-zone--drag" : ""}`}
                                                onClick={() => fileInputRef.current?.click()}
                                                onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
                                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                                onDragLeave={() => setIsDragging(false)}
                                                onDrop={handleDrop}
                                            >
                                                <span className="st-upload-text">
                                                    {files.length > 0
                                                        ? `${files.length} file${files.length > 1 ? "s" : ""} selected`
                                                        : <>Drag and drop your files here, or <span className="st-upload-browse">click to browse</span></>}
                                                </span>
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    multiple
                                                    className="d-none"
                                                    onChange={handleFileChange}
                                                />
                                            </div>
                                            {files.length > 0 && (
                                                <div className="st-file-chips">
                                                    {files.map((f, i) => (
                                                        <span key={i} className="st-file-chip">
                                                            {f.name}
                                                            <button type="button" className="st-upload-clear" onClick={() => removeFile(i)}>
                                                                <FiX size={12} />
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

// Creation modal
function SubTaskModal({ show, onClose }) {
    const [cardTitle, setCardTitle] = useState("");
    const [taskName, setTaskName] = useState("");
    const [assignUserId, setAssignUserId] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [taskNameError, setTaskNameError] = useState("");

    const handleReset = () => {
        setCardTitle("");
        setTaskName("");
        setAssignUserId("");
        setDueDate("");
        setTaskNameError("");
    };

    const handleClose = () => {
        handleReset();
        onClose();
    };

    const handleSave = () => {
        if (!taskName.trim()) {
            setTaskNameError("Task name is required");
            return;
        }
        setTaskNameError("");
        const assignedUser = DUMMY_USERS.find((u) => String(u.user_id) === String(assignUserId));
        const newTask = {
            id: Date.now(),
            cardTitle: cardTitle || "Task Card",
            taskName,
            assignUserId,
            assignedUserName: assignedUser?.user_name || "",
            dueDate,
        };
        window.dispatchEvent(new CustomEvent("subtask:card-created", { detail: newTask }));
        handleReset();
    };

    if (!show) return null;

    return (
        <div className="cardform-overlay" style={{ zIndex: 1350 }}>
            <div className="cardform-panel add-mode">

                {/* Topbar */}
                <div className="cardform-topbar" style={{ backgroundColor: TOPBAR_COLOR }}>
                    <div>
                        <input
                            type="text"
                            className="cardform-title-input"
                            placeholder="Enter card title"
                            value={cardTitle}
                            onChange={(e) => setCardTitle(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="cardform-topbar-right">
                        <button className="cardform-close-btn" onClick={handleClose} type="button">✕</button>
                    </div>
                </div>

                {/* Split body */}
                <div className="st-split-body">

                    {/* Left: form */}
                    <div className="cardform-body cardform-body--feed-tab st-form-side">
                        <div className="subtasks-tab">
                            <div className="subtasks-tab-layout">
                                <section className="subtasks-tab-editor" aria-label="New subtask">
                                    <div className="subtasks-tab-card subtasks-tab-card--editor">
                                        <div className="subtasks-tab-editor-body">

                                            {/* Task Name */}
                                            <div className="subtasks-tab-field">
                                                <label className="subtasks-tab-label" htmlFor="st-task-name">
                                                    Task Name <span className="text-danger">*</span>
                                                </label>
                                                <textarea
                                                    id="st-task-name"
                                                    className={`subtasks-tab-textarea ${taskNameError ? "is-invalid" : ""}`}
                                                    rows={3}
                                                    placeholder="Enter task title or description..."
                                                    value={taskName}
                                                    onChange={(e) => { setTaskName(e.target.value); setTaskNameError(""); }}
                                                />
                                                {taskNameError && (
                                                    <span className="text-danger st-field-error">{taskNameError}</span>
                                                )}
                                            </div>

                                            {/* Assign User + Due Date row */}
                                            <div className="subtasks-tab-field-row">
                                                <div className="subtasks-tab-field">
                                                    <label className="subtasks-tab-label" htmlFor="st-assign-user">Assign User</label>
                                                    <select
                                                        id="st-assign-user"
                                                        className="subtasks-tab-select"
                                                        value={assignUserId}
                                                        onChange={(e) => setAssignUserId(e.target.value)}
                                                    >
                                                        <option value="">Select user</option>
                                                        {DUMMY_USERS.map((u) => (
                                                            <option key={u.user_id} value={u.user_id}>{u.user_name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="subtasks-tab-field">
                                                    <label className="subtasks-tab-label" htmlFor="st-due-date">Due Date</label>
                                                    <input
                                                        id="st-due-date"
                                                        type="date"
                                                        className="subtasks-tab-date-input"
                                                        value={dueDate}
                                                        onChange={(e) => setDueDate(e.target.value)}
                                                    />
                                                </div>
                                            </div>

                                            <div className="st-inline-actions">
                                                <button type="button" className="st-inline-cancel" onClick={handleClose}>Cancel</button>
                                                <button type="button" className="st-inline-save" onClick={handleSave}>Create Task Card</button>
                                            </div>

                                        </div>
                                    </div>
                                </section>
                            </div>
                        </div>
                    </div>

                    {/* Right: live card preview */}
                    <div className="st-preview-side">
                        <CardPreview
                            cardTitle={cardTitle}
                            taskName={taskName}
                            dueDate={dueDate}
                        />
                    </div>

                </div>

            </div>
        </div>
    );
}

export default SubTaskModal;
