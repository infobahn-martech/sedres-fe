import { useState, useCallback, useEffect, useRef, useMemo, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

import userService from "../../services/userService";
import taskCardService from "../../services/taskCardService";
import useAlertReducer from "../../store/AlertReducer";
import { useKanbanSidebarBridge } from "../../store/kanbanSidebarBridge";
import SearchableSelect, { deriveSearchPlaceholder } from "../../components/form/SearchableSelect";
import { Tag, Layers3, AlertTriangle, Sticker } from "lucide-react";
import ColorPickerIcon from "../../assets/images/ColorPicker.png";
import SedresColorPicker from "../../components/SedresColorPicker/SedresColorPicker";
import { normalizeHexColor } from "../../components/SedresColorPicker/sedresColorPickerConstants";
import { BOARD_META_PICKERS, unwrapListFromApi, CardMetaPickerPopover } from "../KanbanBoard/utils/cardMetaPickers";

import "../../design/scss/pages/kanban-board/cardForm.scss";
import "../../design/css/common/CardForm.css";
import "../../design/scss/pages/taskCard.scss";
import "../../design/scss/invoice.scss";
import DateTimePickerField from "../KanbanBoard/CardFormTabs/shared/components/DateTimePickerField";

const META_PICKER_WIDTH = 272;
// Matches $tc-green in taskCard.scss (the topbar's default background).
const TASK_CARD_TOPBAR_DEFAULT_HEX = "#2e7d32";
const META_PICKER_ICONS = {
    type: { Icon: Layers3, title: "Type" },
    tag: { Icon: Tag, title: "Tag" },
    blocker: { Icon: AlertTriangle, title: "Blocker" },
    sticker: { Icon: Sticker, title: "Sticker" },
};

const MENTION_TRIGGER_REGEX = /@([^\s@]*)$/;

const QUILL_MODULES = {
    toolbar: [
        ["bold", "italic", "underline", "strike"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["blockquote", "link"],
        ["clean"],
    ],
};

const QUILL_FORMATS = ["bold", "italic", "underline", "strike", "list", "bullet", "blockquote", "link"];

const stripHtmlContent = (html) => {
    if (!html) return "";
    return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
};

const isEmptyHtmlContent = (html) => stripHtmlContent(html).length === 0;

const getMentionContext = (editor) => {
    const selection = editor.getSelection();
    if (!selection) return null;

    const textBefore = editor.getText(0, selection.index);
    const match = textBefore.match(MENTION_TRIGGER_REGEX);
    if (!match) return null;

    return {
        search: match[1] || "",
        startIndex: selection.index - match[0].length,
        matchLength: match[0].length,
    };
};

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
    const quillRef = useRef(null);

    const [cardTitle, setCardTitle] = useState("");
    const [taskName, setTaskName] = useState("");
    const [assignUserId, setAssignUserId] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [dueTime, setDueTime] = useState("");
    const [taskNameError, setTaskNameError] = useState("");
    const [users, setUsers] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    const [mentionOpen, setMentionOpen] = useState(false);
    const [mentionSearch, setMentionSearch] = useState("");
    const [selectedMentionUserIds, setSelectedMentionUserIds] = useState([]);

    // Tag/Type/Blocker/Sticker pickers — board-scoped, same source as CardForm's
    // topbar pickers (see cardMetaPickers.jsx). Selections are kept locally here
    // (there's no card yet) and sent with the create payload once "Create Task" is
    // pressed; backend support for these fields on create_task_card isn't confirmed.
    const boardId = useKanbanSidebarBridge((s) => s.boardId);
    const [openPicker, setOpenPicker] = useState(null);
    const [metaPickerFloaterStyle, setMetaPickerFloaterStyle] = useState({});
    const [pickerLists, setPickerLists] = useState({ type: [], tag: [], blocker: [], sticker: [] });
    const [pickerLoading, setPickerLoading] = useState({ type: false, tag: false, blocker: false, sticker: false });
    const [selectedRows, setSelectedRows] = useState({ type: null, tag: null, blocker: null, sticker: null });
    const metaPickerTriggerRefs = useRef({ type: null, tag: null, blocker: null, sticker: null });
    const metaPickerFloaterWrapRef = useRef(null);
    const metaPickerFetchRef = useRef({ type: 0, tag: 0, blocker: 0, sticker: 0 });

    // Change header color — same SedresColorPicker floater CardForm's topbar uses.
    const [topbarColor, setTopbarColor] = useState(TASK_CARD_TOPBAR_DEFAULT_HEX);
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
    const [colorPickerFloaterStyle, setColorPickerFloaterStyle] = useState({});
    const colorPickerTriggerRef = useRef(null);
    const colorPickerFloaterWrapRef = useRef(null);

    const fetchPickerList = useCallback(async (pickerKey) => {
        const config = BOARD_META_PICKERS[pickerKey];
        if (!config) return;
        if (!boardId) {
            setPickerLists((prev) => ({ ...prev, [pickerKey]: [] }));
            return;
        }
        const fetchId = ++metaPickerFetchRef.current[pickerKey];
        setPickerLoading((prev) => ({ ...prev, [pickerKey]: true }));
        try {
            const res = await config.fetchByBoard(boardId);
            if (fetchId !== metaPickerFetchRef.current[pickerKey]) return;
            const body = res?.data;
            const list = unwrapListFromApi(body, config.listKeys).map(config.normalizeRow);
            setPickerLists((prev) => ({ ...prev, [pickerKey]: list }));
        } catch {
            if (fetchId !== metaPickerFetchRef.current[pickerKey]) return;
            setPickerLists((prev) => ({ ...prev, [pickerKey]: [] }));
        } finally {
            if (fetchId === metaPickerFetchRef.current[pickerKey]) {
                setPickerLoading((prev) => ({ ...prev, [pickerKey]: false }));
            }
        }
    }, [boardId]);

    const handleToggleMetaPicker = (pickerKey) => (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsColorPickerOpen(false);
        setOpenPicker((current) => {
            const next = current === pickerKey ? null : pickerKey;
            if (next) fetchPickerList(next);
            return next;
        });
    };

    const handleSelectMetaItem = (pickerKey, row) => {
        setSelectedRows((prev) => ({ ...prev, [pickerKey]: row }));
        setOpenPicker(null);
    };

    const handleRemoveMetaItem = (pickerKey) => {
        setSelectedRows((prev) => ({ ...prev, [pickerKey]: null }));
        setOpenPicker(null);
    };

    useLayoutEffect(() => {
        if (!openPicker) return;
        const anchor = metaPickerTriggerRefs.current[openPicker];
        if (!anchor) return;
        const r = anchor.getBoundingClientRect();
        const width = META_PICKER_WIDTH;
        const left = Math.max(16, Math.min(r.right - width, window.innerWidth - width - 16));
        const top = Math.min(r.bottom + 8, window.innerHeight - 16);
        setMetaPickerFloaterStyle({ position: "fixed", top, left, zIndex: 13040 });
    }, [openPicker]);

    const handleToggleColorPicker = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setOpenPicker(null);
        setIsColorPickerOpen((open) => !open);
    };

    const handleApplyTopbarColor = (hex) => {
        setTopbarColor(normalizeHexColor(hex, TASK_CARD_TOPBAR_DEFAULT_HEX));
        setIsColorPickerOpen(false);
    };

    const handleCancelTopbarColor = () => {
        setIsColorPickerOpen(false);
    };

    useLayoutEffect(() => {
        if (!isColorPickerOpen) return;
        const anchor = colorPickerTriggerRef.current;
        if (!anchor) return;
        const r = anchor.getBoundingClientRect();
        const width = 308;
        const left = Math.max(16, Math.min(r.right - width, window.innerWidth - width - 16));
        const top = Math.min(r.bottom + 8, window.innerHeight - 16);
        setColorPickerFloaterStyle({ position: "fixed", top, left, zIndex: 13040 });
    }, [isColorPickerOpen]);

    useEffect(() => {
        if (!openPicker && !isColorPickerOpen) return;
        const onMouseDown = (event) => {
            if (metaPickerFloaterWrapRef.current?.contains(event.target)) return;
            if (colorPickerFloaterWrapRef.current?.contains(event.target)) return;
            if (colorPickerTriggerRef.current?.contains(event.target)) return;
            for (const key of Object.keys(metaPickerTriggerRefs.current)) {
                if (metaPickerTriggerRefs.current[key]?.contains(event.target)) return;
            }
            setOpenPicker(null);
            setIsColorPickerOpen(false);
        };
        document.addEventListener("mousedown", onMouseDown);
        return () => document.removeEventListener("mousedown", onMouseDown);
    }, [openPicker, isColorPickerOpen]);

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
    }, []);

    const syncMentionState = useCallback((editor) => {
        const context = getMentionContext(editor);
        if (context) {
            setMentionOpen(true);
            setMentionSearch(context.search);
            return;
        }
        closeMentionDropdown();
    }, [closeMentionDropdown]);

    const handleTaskDescriptionChange = useCallback((html, _delta, _source, editor) => {
        setTaskName(html);
        if (!isEmptyHtmlContent(html)) setTaskNameError("");
        syncMentionState(editor);
    }, [syncMentionState]);

    const handleEditorBlur = useCallback(() => {
        closeMentionDropdown();
    }, [closeMentionDropdown]);

    const handleSelectMentionUser = useCallback((user) => {
        const editor = quillRef.current?.getEditor?.();
        if (!editor) return;

        const context = getMentionContext(editor);
        if (!context) return;

        const mentionText = `@${user.name} `;
        editor.deleteText(context.startIndex, context.matchLength, "user");
        editor.insertText(context.startIndex, mentionText, "user");
        editor.setSelection(context.startIndex + mentionText.length, 0, "user");

        setTaskName(editor.root.innerHTML);
        setSelectedMentionUserIds((prev) =>
            prev.some((id) => String(id) === String(user.user_id)) ? prev : [...prev, user.user_id]
        );
        closeMentionDropdown();
    }, [closeMentionDropdown]);

    const handleReset = useCallback(() => {
        setCardTitle("");
        setTaskName("");
        setAssignUserId("");
        setDueDate("");
        setDueTime("");
        setTaskNameError("");
        setSelectedMentionUserIds([]);
        setSelectedRows({ type: null, tag: null, blocker: null, sticker: null });
        setOpenPicker(null);
        setTopbarColor(TASK_CARD_TOPBAR_DEFAULT_HEX);
        setIsColorPickerOpen(false);
        closeMentionDropdown();
    }, [closeMentionDropdown]);

    const handleClose = useCallback(() => {
        handleReset();
        onClose();
    }, [handleReset, onClose]);

    const handleSave = useCallback(async () => {
        if (isEmptyHtmlContent(taskName)) {
            setTaskNameError("Task description is required");
            return;
        }
        setTaskNameError("");

        const assignedUser = users.find((u) => String(u.user_id) === String(assignUserId));
        const dueDateDisplay = dueDate ? (dueTime ? `${dueDate} ${dueTime}` : dueDate) : "";
        const dueDatePayload = dueDate ? (dueTime ? `${dueDate} ${dueTime}:00` : dueDate) : "";

        const { success, error } = useAlertReducer.getState();
        setIsSaving(true);
        try {
            const { data } = await taskCardService.createTaskCard({
                card_name: cardTitle || "Task Card",
                task_name: taskName,
                assigned_to: assignUserId,
                due_date: dueDatePayload,
                ...(selectedRows.type?.id ? { card_type_id: selectedRows.type.id } : {}),
                ...(selectedRows.tag?.id ? { card_tag_id: selectedRows.tag.id } : {}),
                ...(selectedRows.blocker?.id ? { card_blocker_id: selectedRows.blocker.id } : {}),
                ...(selectedRows.sticker?.id ? { card_sticker_id: selectedRows.sticker.id } : {}),
                ...(topbarColor !== TASK_CARD_TOPBAR_DEFAULT_HEX ? { card_color: topbarColor } : {}),
            });

            const newTask = {
                id: data?.card_id,
                cardTitle: cardTitle || "Task Card",
                taskName,
                assignUserId,
                assignedUserName: assignedUser?.name || "",
                dueDate: dueDateDisplay,
                mentionedUsers: selectedMentionUserIds,
                isSubTask: true,
            };

            success(data?.message || "Task card created successfully");
            window.dispatchEvent(new CustomEvent("subtask:card-created", { detail: newTask }));
            handleReset();
            onClose();
        } catch (err) {
            error(err?.response?.data?.message ?? "Could not create the task card. Please check your connection and try again.");
        } finally {
            setIsSaving(false);
        }
    }, [cardTitle, taskName, assignUserId, dueDate, dueTime, users, selectedMentionUserIds, selectedRows, topbarColor, handleReset, onClose]);

    const renderMetaButton = (pickerKey) => {
        const { Icon, title } = META_PICKER_ICONS[pickerKey];
        const selected = selectedRows[pickerKey];
        return (
            <button
                key={pickerKey}
                ref={(el) => { metaPickerTriggerRefs.current[pickerKey] = el; }}
                type="button"
                className="topbar-icon-btn"
                onClick={handleToggleMetaPicker(pickerKey)}
                title={selected ? `${title}: ${selected.name}` : title}
                aria-label={title}
                aria-expanded={openPicker === pickerKey}
                aria-haspopup="listbox"
            >
                <Icon size={20} aria-hidden />
                {selected && (
                    <span
                        className="topbar-icon-btn-selected-dot"
                        style={{ backgroundColor: selected.color_code }}
                        aria-hidden
                    />
                )}
            </button>
        );
    };

    const openPickerConfig = openPicker ? BOARD_META_PICKERS[openPicker] : null;

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
                        {renderMetaButton("tag")}
                        {renderMetaButton("type")}
                        {renderMetaButton("blocker")}
                        {renderMetaButton("sticker")}
                        <div className="topbar-color-picker-wrapper">
                            <button
                                ref={colorPickerTriggerRef}
                                type="button"
                                className="topbar-color-picker-label"
                                onClick={handleToggleColorPicker}
                                title="Change header color"
                                aria-label="Color Picker"
                                aria-expanded={isColorPickerOpen}
                            >
                                <img src={ColorPickerIcon} alt="Color Picker" className="topbar-color-picker-icon" />
                            </button>
                        </div>
                        <button type="button" className="cardform-close-btn" onClick={handleClose}>✕</button>
                    </div>
                </div>

                <div className="tc-body">
                    <div className="tc-card">
                        <div className="cf-section-header">
                            <div className="cf-section-icon">
                                <Layers3 size={15} aria-hidden />
                            </div>
                            <div className="cf-section-title">Create Task Card</div>
                        </div>

                        <div className="tc-card-body">
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

                            <div className="tc-field tc-field--grow">
                                <label className="tc-label" htmlFor="tc-task-name">
                                    Task Description <span className="text-danger">*</span>
                                </label>
                                <div className="comments-tab-mention-host">
                                    <div className="react-quill-wrapper comments-tab-quill">
                                        <ReactQuill
                                            ref={quillRef}
                                            theme="snow"
                                            value={taskName}
                                            onChange={handleTaskDescriptionChange}
                                            onBlur={handleEditorBlur}
                                            modules={QUILL_MODULES}
                                            formats={QUILL_FORMATS}
                                            placeholder="Enter task description... (type @ to mention)"
                                        />
                                    </div>

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

                            <div className="tc-save-row">
                                <button type="button" className="tc-cancel-btn" onClick={handleClose} disabled={isSaving}>Cancel</button>
                                <button type="button" className="tc-save-btn" onClick={handleSave} disabled={isSaving}>
                                    {isSaving ? "Creating..." : "Create Task"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {openPicker &&
                openPickerConfig &&
                createPortal(
                    <CardMetaPickerPopover
                        wrapRef={metaPickerFloaterWrapRef}
                        header={openPickerConfig.header}
                        floaterStyle={metaPickerFloaterStyle}
                        loading={pickerLoading[openPicker]}
                        items={pickerLists[openPicker] ?? []}
                        selectedId={selectedRows[openPicker]?.id ?? null}
                        emptyLabel={openPickerConfig.emptyLabel}
                        hasBoardId={Boolean(boardId)}
                        showRowIcon={openPickerConfig.showRowIcon !== false}
                        onSelect={(row) => handleSelectMetaItem(openPicker, row)}
                        hasSelection={Boolean(selectedRows[openPicker])}
                        removeLabel={`Remove ${openPickerConfig.emptyLabel.slice(0, -1)}`}
                        onRemove={() => handleRemoveMetaItem(openPicker)}
                    />,
                    document.body
                )}

            {isColorPickerOpen &&
                createPortal(
                    <div ref={colorPickerFloaterWrapRef} style={colorPickerFloaterStyle}>
                        <SedresColorPicker
                            ariaLabel="Pick task card header color"
                            initialHex={topbarColor}
                            className="kanban-dashboard-color-picker-popover--floating"
                            onApply={handleApplyTopbarColor}
                            onCancel={handleCancelTopbarColor}
                        />
                    </div>,
                    document.body
                )}
        </div>
    );
}

export default TaskCardModal;
