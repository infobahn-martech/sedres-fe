import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { FiEdit2, FiPlus, FiCheck, FiClock, FiPaperclip, FiCheckSquare, FiEye, FiTrash2 } from "react-icons/fi";
import SearchableSelect, { deriveSearchPlaceholder } from "../../../../../../components/form/SearchableSelect";
import DateTimePickerField from "../../../shared/components/DateTimePickerField";
import useCommonReducer from "../../../../../../store/CommonReducer";
import { notify } from "../../../../../../components/Toaster";
import kanbanBoardService from "../../../../../../services/kanbanBoardService";
import { DOCUMENT_UPLOAD_ALLOWED_EXTENSIONS, DOCUMENT_UPLOAD_MAX_SIZE, validateDocumentFiles } from "../husbandry/components/Husbandry.constants";
import "../../../../../../design/scss/invoice.scss";
import "../../../../../../design/css/common/CardForm.css";
import "../../../../../../design/scss/subtasks.scss";

const STATUS_OPTIONS = [
    { value: "0", label: "Pending" },
    { value: "1", label: "Completed" },
];

const mapUserToOption = (user) => ({
    value: String(user.user_id),
    label: user.name ?? "",
    avatar: user.avatar_path || user.avatar || null,
});

const buildDueDateString = (dateStr, timeStr) => {
    if (!dateStr) return null;
    const time = timeStr ? `${timeStr}:00` : "00:00:00";
    return `${dateStr} ${time}`;
};

const parseDueDateParts = (dueDateStr) => {
    if (!dueDateStr) return { date: "", time: "" };
    const [date, timeFull = ""] = dueDateStr.split(" ");
    const time = timeFull.slice(0, 5);
    return { date, time };
};

const normalizeSubtask = (item) => {
    const { date, time } = parseDueDateParts(item.due_date);
    return {
        id: String(item.subtask_id),
        title: item.description ?? "",
        assignee: item.assigned_to
            ? { user_id: String(item.assigned_to), user_name: item.assigned_to_name ?? "" }
            : null,
        dueDate: date || null,
        dueTime: time || null,
        document: item.document
            ? { name: item.document, url: item.document_url ?? null }
            : null,
        completed: String(item.is_completed) === "1",
    };
};

const UserOptionAvatar = ({ avatarUrl, label, className = "" }) => {
    const letterSource = label != null ? String(label).trim() : "";
    const displayLetter = letterSource ? letterSource.charAt(0).toUpperCase() : "U";
    const src = avatarUrl != null && String(avatarUrl).trim();
    const [imgFailed, setImgFailed] = useState(false);

    if (src && !imgFailed) {
        return (
            <div className={`cf-owner-avatar cf-owner-avatar--img ${className}`.trim()}>
                <img src={src} alt="" onError={() => setImgFailed(true)} />
            </div>
        );
    }
    return <div className={`cf-owner-avatar ${className}`.trim()}>{displayLetter}</div>;
};

UserOptionAvatar.propTypes = {
    avatarUrl: PropTypes.string,
    label: PropTypes.string,
    className: PropTypes.string,
};

const formatDueDateTime = (dateStr, timeStr) => {
    if (!dateStr) return "";
    const timepart = timeStr || "00:00";
    const parsed = new Date(`${dateStr}T${timepart}:00`);
    if (Number.isNaN(parsed.getTime())) return dateStr;
    const datePart = parsed.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
    return timeStr ? `${datePart} ${timepart}` : datePart;
};

const getInitials = (name) => (name || "?").charAt(0).toUpperCase();

const AVATAR_COLORS = ["#00368C", "#0E7C7B", "#8552C6", "#C25E2E", "#2E7D32", "#B23B6B"];

const getAvatarColor = (name) => {
    const source = name || "?";
    let hash = 0;
    for (let i = 0; i < source.length; i += 1) {
        hash = source.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const DOCUMENT_ACCEPT = DOCUMENT_UPLOAD_ALLOWED_EXTENSIONS.join(",");
const DOCUMENT_TYPE_LABELS = Array.from(
    new Set(
        DOCUMENT_UPLOAD_ALLOWED_EXTENSIONS.map((ext) => {
            const label = ext.replace(".", "").toUpperCase();
            return label === "JPEG" ? "JPG" : label;
        })
    )
);
const DOCUMENT_HINT = `Supports ${DOCUMENT_TYPE_LABELS.join(", ")} (max ${DOCUMENT_UPLOAD_MAX_SIZE / (1024 * 1024)}MB)`;

const isTaskOverdue = (task) => {
    if (task.completed || !task.dueDate) return false;
    const due = new Date(`${task.dueDate}T${task.dueTime || "23:59"}:00`);
    if (Number.isNaN(due.getTime())) return false;
    return due.getTime() < Date.now();
};

function Subtasks({ card }) {
    const [tasks, setTasks] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editDescription, setEditDescription] = useState("");
    const [editAssignedTo, setEditAssignedTo] = useState("");
    const [editDueDate, setEditDueDate] = useState("");
    const [editDueTime, setEditDueTime] = useState("");
    const [editDocumentFile, setEditDocumentFile] = useState(null);
    const [editDocumentRemoved, setEditDocumentRemoved] = useState(false);
    const [editCompleted, setEditCompleted] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [togglingId, setTogglingId] = useState(null);
    const [title, setTitle] = useState("");
    const [assignUserId, setAssignUserId] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [dueTime, setDueTime] = useState("");
    const [documentFile, setDocumentFile] = useState(null);

    const allUsers = useCommonReducer((state) => state.allUsers);
    const usersLoading = useCommonReducer((state) => state.allUsersLoading);
    const getAllUsers = useCommonReducer((state) => state.getAllUsers);

    const cardId = card?.id || card?.card_id || card?.call_id;

    const userOptions = useMemo(
        () => (Array.isArray(allUsers) ? allUsers.map(mapUserToOption) : []),
        [allUsers]
    );

    const selectedAssigneeAvatar = useMemo(() => {
        const user = allUsers.find((u) => String(u.user_id) === String(assignUserId));
        return user ? (user.avatar_path || user.avatar || null) : null;
    }, [allUsers, assignUserId]);

    const selectedAssigneeName = useMemo(() => {
        const user = allUsers.find((u) => String(u.user_id) === String(assignUserId));
        return user?.name ?? "";
    }, [allUsers, assignUserId]);

    useEffect(() => {
        if (allUsers.length > 0 || usersLoading) return;
        getAllUsers();
    }, [allUsers.length, usersLoading, getAllUsers]);

    const loadSubtasks = useCallback(async () => {
        if (!cardId) return;
        setIsLoading(true);
        try {
            const res = await kanbanBoardService.getSubtasks(cardId);
            const list = res?.data?.data ?? res?.data ?? [];
            setTasks(Array.isArray(list) ? list.map(normalizeSubtask) : []);
        } catch {
            notify("Failed to load subtasks.", "error");
        } finally {
            setIsLoading(false);
        }
    }, [cardId]);

    useEffect(() => {
        loadSubtasks();
    }, [loadSubtasks]);

    const hasTasks = tasks.length > 0;

    const resetForm = useCallback(() => {
        setTitle("");
        setAssignUserId("");
        setDueDate("");
        setDueTime("");
        setDocumentFile(null);
    }, []);

    const handleDocumentChange = useCallback((event) => {
        const file = event.target.files?.[0] || null;
        event.target.value = "";
        if (!file) return;
        const { validFiles, rejectedFiles } = validateDocumentFiles([file]);
        if (rejectedFiles.length > 0) {
            notify(`"${rejectedFiles[0].name}" — ${rejectedFiles[0].reason}`, "error");
            return;
        }
        setDocumentFile(validFiles[0]);
    }, []);

    const handleEditDocumentChange = useCallback((event) => {
        const file = event.target.files?.[0] || null;
        event.target.value = "";
        if (!file) return;
        const { validFiles, rejectedFiles } = validateDocumentFiles([file]);
        if (rejectedFiles.length > 0) {
            notify(`"${rejectedFiles[0].name}" — ${rejectedFiles[0].reason}`, "error");
            return;
        }
        setEditDocumentFile(validFiles[0]);
    }, []);

    const handleRemoveDocument = useCallback(() => {
        setDocumentFile(null);
    }, []);

    const handleSave = useCallback(async () => {
        const trimmedTitle = title.trim();
        if (!trimmedTitle || !assignUserId || !dueDate || !cardId) return;

        const formData = new FormData();
        formData.append("card_id", String(cardId));
        formData.append("description", trimmedTitle);
        if (assignUserId) formData.append("assigned_to", String(assignUserId));
        const dueDateStr = buildDueDateString(dueDate, dueTime);
        if (dueDateStr) formData.append("due_date", dueDateStr);
        if (documentFile) formData.append("document", documentFile);

        setIsSaving(true);
        try {
            await kanbanBoardService.createSubtask(formData);
            notify("Task saved successfully.", "success");
            resetForm();
            await loadSubtasks();
        } catch {
            notify("Failed to save task.", "error");
        } finally {
            setIsSaving(false);
        }
    }, [title, assignUserId, dueDate, dueTime, documentFile, cardId, resetForm, loadSubtasks]);

    const handleEditOpen = useCallback((task) => {
        setEditingId(task.id);
        setEditDescription(task.title);
        setEditAssignedTo(task.assignee?.user_id ?? "");
        setEditDueDate(task.dueDate ?? "");
        setEditDueTime(task.dueTime ?? "");
        setEditDocumentFile(null);
        setEditDocumentRemoved(false);
        setEditCompleted(task.completed);
    }, []);

    const handleEditCancel = useCallback(() => {
        setEditingId(null);
        setEditDescription("");
        setEditAssignedTo("");
        setEditDueDate("");
        setEditDueTime("");
        setEditDocumentFile(null);
        setEditDocumentRemoved(false);
        setEditCompleted(false);
    }, []);

    const handleUpdate = useCallback(async (taskId) => {
        const trimmed = editDescription.trim();
        if (!trimmed || !editAssignedTo || !editDueDate) return;
        setIsUpdating(true);
        try {
            const formData = new FormData();
            formData.append("subtask_id", String(taskId));
            formData.append("description", trimmed);
            if (editAssignedTo) formData.append("assigned_to", String(editAssignedTo));
            const dueDateStr = buildDueDateString(editDueDate, editDueTime);
            if (dueDateStr) formData.append("due_date", dueDateStr);
            if (editDocumentFile) formData.append("document", editDocumentFile);
            else if (editDocumentRemoved) formData.append("document", "");
            formData.append("is_completed", editCompleted ? "1" : "0");
            await kanbanBoardService.updateSubtask(formData);
            notify("Task updated successfully.", "success");
            handleEditCancel();
            await loadSubtasks();
        } catch {
            notify("Failed to update task.", "error");
        } finally {
            setIsUpdating(false);
        }
    }, [editDescription, editAssignedTo, editDueDate, editDueTime, editDocumentFile, editDocumentRemoved, editCompleted, handleEditCancel, loadSubtasks]);

    const handleToggleComplete = useCallback(async (task) => {
        const nextCompleted = !task.completed;
        setTogglingId(task.id);
        try {
            const formData = new FormData();
            formData.append("subtask_id", String(task.id));
            formData.append("is_completed", nextCompleted ? "1" : "0");
            await kanbanBoardService.updateSubtask(formData);
            setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: nextCompleted } : t)));
        } catch {
            notify("Failed to update task status.", "error");
        } finally {
            setTogglingId(null);
        }
    }, []);

    return (
        <div className="cardform-body cardform-body--feed-tab">
            <div className="task-tab">
                <div className="task-tab-layout">
                    <section className="task-tab-editor" aria-label="Add a task">
                        <div className="task-tab-panel">
                            <div className="task-tab-editor-body">
                                <h3 className="task-tab-form-title">Add Task</h3>

                                <div className="task-tab-field-row">
                                    <div className="task-tab-field">
                                        <label className="task-tab-label" htmlFor="subtask-assignee">
                                            Assign User <span className="task-tab-required">*</span>
                                        </label>
                                        <div className="task-tab-assignee-row">
                                            <UserOptionAvatar
                                                avatarUrl={selectedAssigneeAvatar}
                                                label={selectedAssigneeName}
                                                className="task-tab-assignee-avatar"
                                            />
                                            <SearchableSelect
                                                className="cf-owner-searchable-select"
                                                value={assignUserId === "" ? "" : String(assignUserId)}
                                                onChange={(event) => setAssignUserId(event.target.value)}
                                                options={userOptions}
                                                placeholder={usersLoading ? "Loading users..." : "Select user"}
                                                searchPlaceholder={deriveSearchPlaceholder("Select user")}
                                                disabled={usersLoading || isSaving}
                                                renderOption={(option) => (
                                                    <div className="cf-searchable-option-with-avatar">
                                                        <UserOptionAvatar
                                                            avatarUrl={option.avatar}
                                                            label={option.label}
                                                            className="cf-owner-avatar--sm"
                                                        />
                                                        <span>{option.label}</span>
                                                    </div>
                                                )}
                                            />
                                        </div>
                                    </div>

                                    <div className="task-tab-field">
                                        <label className="task-tab-label" htmlFor="subtask-due-date">
                                            Due Date &amp; Time <span className="task-tab-required">*</span>
                                        </label>
                                        <DateTimePickerField
                                            dateValue={dueDate}
                                            timeValue={dueTime}
                                            onDateTimeChange={({ date, time }) => {
                                                setDueDate(date);
                                                setDueTime(time);
                                            }}
                                            dateFieldName="subtask-due-date"
                                            timeFieldName="subtask-due-time"
                                            placeholder="YYYY-MM-DD HH:mm"
                                            disabled={isSaving}
                                        />
                                    </div>

                                    <div className="task-tab-field">
                                        <label className="task-tab-label" htmlFor="subtask-document">
                                            Document
                                        </label>
                                        {documentFile ? (
                                            <div className="task-tab-doc-chip">
                                                <span className="task-tab-doc-name" title={documentFile.name}>
                                                    {documentFile.name}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="task-tab-doc-remove"
                                                    onClick={handleRemoveDocument}
                                                    aria-label="Remove document"
                                                    disabled={isSaving}
                                                >
                                                    &times;
                                                </button>
                                            </div>
                                        ) : (
                                            <label className="task-tab-doc-upload" htmlFor="subtask-document">
                                                <FiPaperclip size={13} />
                                                <span>Upload document</span>
                                                <input
                                                    id="subtask-document"
                                                    type="file"
                                                    accept={DOCUMENT_ACCEPT}
                                                    className="task-tab-doc-input"
                                                    onChange={handleDocumentChange}
                                                    disabled={isSaving}
                                                />
                                            </label>
                                        )}
                                        <span className="task-tab-doc-hint">{DOCUMENT_HINT}</span>
                                    </div>
                                </div>

                                <div className="task-tab-field">
                                    <label className="task-tab-label" htmlFor="subtask-title">
                                        Task title / description <span className="task-tab-required">*</span>
                                    </label>
                                    <textarea
                                        id="subtask-title"
                                        className="task-tab-textarea"
                                        rows={4}
                                        placeholder="Enter task title or description..."
                                        value={title}
                                        onChange={(event) => setTitle(event.target.value)}
                                        disabled={isSaving}
                                    />
                                </div>

                                <div className="task-tab-save-row">
                                    <button
                                        type="button"
                                        className="task-tab-save-btn"
                                        onClick={handleSave}
                                        disabled={!title.trim() || !assignUserId || !dueDate || isSaving}
                                    >
                                        <FiPlus size={14} />
                                        {isSaving ? "Saving..." : "Add Task"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="task-tab-list" aria-label="Subtasks">
                        <div className="task-tab-panel">
                            <div className="task-tab-list-header">
                                <p className="task-tab-list-title">Tasks</p>
                                {hasTasks ? <span className="task-tab-list-count">{tasks.length}</span> : null}
                            </div>
                            <div className="task-tab-list-scroll">
                                {isLoading ? (
                                    <div className="task-tab-empty">
                                        <p>Loading tasks...</p>
                                    </div>
                                ) : !hasTasks ? (
                                    <div className="task-tab-empty">
                                        <FiCheckSquare size={28} />
                                        <p>No tasks added yet.</p>
                                    </div>
                                ) : (
                                    <ul className="task-tab-list-items">
                                        {tasks.map((task) => {
                                            const assigneeName = task.assignee?.user_name || "Unassigned";
                                            const isEditing = editingId === task.id;
                                            const overdue = isTaskOverdue(task);

                                            return (
                                                <li
                                                    className={`task-tab-task-card${task.completed ? " task-tab-task-card--completed" : ""}${isEditing ? " task-tab-task-card--editing" : ""}`}
                                                    key={task.id}
                                                >
                                                    {isEditing ? (
                                                        <div className="task-tab-edit-form">
                                                            <div className="task-tab-field">
                                                                <label className="task-tab-label">Description <span className="task-tab-required">*</span></label>
                                                                <textarea
                                                                    className="task-tab-textarea"
                                                                    rows={3}
                                                                    value={editDescription}
                                                                    onChange={(e) => setEditDescription(e.target.value)}
                                                                    disabled={isUpdating}
                                                                />
                                                            </div>
                                                            <div className="task-tab-field-row task-tab-field-row--pair">
                                                                <div className="task-tab-field">
                                                                    <label className="task-tab-label">Assign User <span className="task-tab-required">*</span></label>
                                                                    <SearchableSelect
                                                                        className="cf-owner-searchable-select"
                                                                        value={editAssignedTo === "" ? "" : String(editAssignedTo)}
                                                                        onChange={(e) => setEditAssignedTo(e.target.value)}
                                                                        options={userOptions}
                                                                        placeholder={usersLoading ? "Loading..." : "Select user"}
                                                                        searchPlaceholder={deriveSearchPlaceholder("Select user")}
                                                                        disabled={usersLoading || isUpdating}
                                                                        renderOption={(option) => (
                                                                            <div className="cf-searchable-option-with-avatar">
                                                                                <UserOptionAvatar avatarUrl={option.avatar} label={option.label} className="cf-owner-avatar--sm" />
                                                                                <span>{option.label}</span>
                                                                            </div>
                                                                        )}
                                                                    />
                                                                </div>
                                                                <div className="task-tab-field">
                                                                    <label className="task-tab-label">Due Date &amp; Time <span className="task-tab-required">*</span></label>
                                                                    <DateTimePickerField
                                                                        dateValue={editDueDate}
                                                                        timeValue={editDueTime}
                                                                        onDateTimeChange={({ date, time }) => {
                                                                            setEditDueDate(date);
                                                                            setEditDueTime(time);
                                                                        }}
                                                                        disabled={isUpdating}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="task-tab-field-row task-tab-field-row--pair">
                                                                <div className="task-tab-field">
                                                                    <label className="task-tab-label">Document</label>
                                                                    {editDocumentFile ? (
                                                                        <div className="task-tab-doc-chip">
                                                                            <span className="task-tab-doc-name" title={editDocumentFile.name}>{editDocumentFile.name}</span>
                                                                            <button type="button" className="task-tab-doc-remove" onClick={() => setEditDocumentFile(null)} disabled={isUpdating}>&times;</button>
                                                                        </div>
                                                                    ) : task.document && !editDocumentRemoved ? (
                                                                        <div className="task-tab-doc-chip">
                                                                            <span className="task-tab-doc-name" title={task.document.name}>{task.document.name}</span>
                                                                            {task.document.url && (
                                                                                <a
                                                                                    className="task-tab-doc-view"
                                                                                    href={task.document.url}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    title="View document"
                                                                                    aria-label="View document"
                                                                                >
                                                                                    <FiEye size={12} />
                                                                                </a>
                                                                            )}
                                                                            <button
                                                                                type="button"
                                                                                className="task-tab-doc-remove"
                                                                                onClick={() => setEditDocumentRemoved(true)}
                                                                                disabled={isUpdating}
                                                                                title="Delete document"
                                                                                aria-label="Delete document"
                                                                            >
                                                                                <FiTrash2 size={12} />
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <label className="task-tab-doc-upload">
                                                                            <FiPaperclip size={13} />
                                                                            <span>Upload document</span>
                                                                            <input type="file" accept={DOCUMENT_ACCEPT} className="task-tab-doc-input" disabled={isUpdating} onChange={handleEditDocumentChange} />
                                                                        </label>
                                                                    )}
                                                                    <span className="task-tab-doc-hint">{DOCUMENT_HINT}</span>
                                                                </div>
                                                                <div className="task-tab-field">
                                                                    <label className="task-tab-label">Status</label>
                                                                    <SearchableSelect
                                                                        className="cf-owner-searchable-select"
                                                                        value={editCompleted ? "1" : "0"}
                                                                        onChange={(e) => setEditCompleted(e.target.value === "1")}
                                                                        options={STATUS_OPTIONS}
                                                                        placeholder="Select status"
                                                                        disabled={isUpdating}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="task-tab-edit-actions">
                                                                <button type="button" className="task-tab-save-btn" onClick={() => handleUpdate(task.id)} disabled={!editDescription.trim() || !editAssignedTo || !editDueDate || isUpdating}>
                                                                    <FiCheck size={14} />
                                                                    {isUpdating ? "Saving..." : "Update"}
                                                                </button>
                                                                <button type="button" className="task-tab-cancel-btn" onClick={handleEditCancel} disabled={isUpdating}>
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="task-tab-task-header">
                                                                <p className="task-tab-task-title">{task.title}</p>
                                                                <div className="task-tab-task-actions">
                                                                    <button
                                                                        type="button"
                                                                        className={`task-tab-status-badge task-tab-status-badge--${task.completed ? "completed" : "pending"}`}
                                                                        onClick={() => handleToggleComplete(task)}
                                                                        disabled={togglingId === task.id}
                                                                        aria-label={task.completed ? "Mark as pending" : "Mark as completed"}
                                                                        title={task.completed ? "Mark as pending" : "Mark as completed"}
                                                                    >
                                                                        {task.completed ? <FiCheck size={10} /> : <FiClock size={10} />}
                                                                        {togglingId === task.id ? "Updating..." : task.completed ? "Completed" : "Pending"}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="task-tab-icon-btn"
                                                                        onClick={() => handleEditOpen(task)}
                                                                        aria-label="Edit task"
                                                                    >
                                                                        <FiEdit2 size={13} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div className="task-tab-task-meta">
                                                                <span
                                                                    className="task-tab-task-avatar"
                                                                    style={{ background: getAvatarColor(assigneeName) }}
                                                                >
                                                                    {getInitials(assigneeName)}
                                                                </span>
                                                                <span className="task-tab-task-assignee">{assigneeName}</span>
                                                                {task.dueDate && (
                                                                    <span className={`task-tab-task-due${overdue ? " task-tab-task-due--overdue" : ""}`}>
                                                                        <FiClock size={11} />
                                                                        Due {formatDueDateTime(task.dueDate, task.dueTime)}
                                                                    </span>
                                                                )}
                                                                {task.document && (
                                                                    task.document.url ? (
                                                                        <a className="task-tab-task-doc" href={task.document.url} target="_blank" rel="noopener noreferrer" title={task.document.name}>
                                                                            <FiPaperclip size={11} />
                                                                            {task.document.name}
                                                                        </a>
                                                                    ) : (
                                                                        <span className="task-tab-task-doc" title={task.document.name}>
                                                                            <FiPaperclip size={11} />
                                                                            {task.document.name}
                                                                        </span>
                                                                    )
                                                                )}
                                                            </div>
                                                        </>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

Subtasks.propTypes = {
    card: PropTypes.object,
};

export default Subtasks;
