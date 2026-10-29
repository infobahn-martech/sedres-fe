import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import ReactQuill from "react-quill";
import DOMPurify from "dompurify";
import { FiEdit2, FiTrash2, FiFileText, FiClock, FiX, FiSend } from "react-icons/fi";
import "react-quill/dist/quill.snow.css";
import "../../../../../../design/scss/invoice.scss";
import "../../../../../../design/scss/notes.scss";
import callFileService from "../../../../../../services/callFileService";
import kanbanBoardService from "../../../../../../services/kanbanBoardService";
import { unwrapListResponse } from "../../../../../../shared/helpers/callFileFormOptions";
import { notify } from "../../../../../../components/Toaster";
import DeleteConfirmationModal from "../../../../../../components/DeleteConfirmationModal";

const QUILL_MODULES = {
    toolbar: [
        ["bold", "italic", "underline"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link"],
        ["clean"],
    ],
};

const QUILL_FORMATS = ["bold", "italic", "underline", "list", "bullet", "link"];

const MENTION_TRIGGER_REGEX = /@([^\s@]*)$/;

const isEmptyHtmlContent = (html) => {
    if (!html) return true;
    const text = html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
    return text.length === 0;
};

const getCardId = (card) => card?.id || card?.card_id || card?.call_id;

const AVATAR_COLORS = ["#00368C", "#0E7C7B", "#8552C6", "#C25E2E", "#2E7D32", "#B23B6B"];

const getAvatarColor = (name) => {
    const source = name || "?";
    let hash = 0;
    for (let i = 0; i < source.length; i += 1) {
        hash = source.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const getInitial = (name) => (name || "?").trim().charAt(0).toUpperCase() || "?";

const mapNoteFromResponse = (row) => ({
    id: row.note_id,
    userName: row.created_by_name ?? "",
    content: row.note_text,
    created_date: row.created_date ?? null,
    updated_date: row.updated_date ?? null,
});

const mapManagersFromResponse = (rows) =>
    (rows || []).map((row) => ({
        user_id: row.user_id,
        user_name: row.user_name ?? "",
        avatar: row.avatar ?? null,
    }));

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

function Notes({ card }) {
    const quillRef = useRef(null);
    const [noteText, setNoteText] = useState("");
    const [managers, setManagers] = useState([]);
    const [mentionOpen, setMentionOpen] = useState(false);
    const [mentionSearch, setMentionSearch] = useState("");
    const [, setSelectedMentionUserIds] = useState([]);
    const [isManagersLoading, setIsManagersLoading] = useState(false);
    const [notes, setNotes] = useState([]);
    const [isNotesLoading, setIsNotesLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedNote, setSelectedNote] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const cardId = getCardId(card);
    const hasNotes = notes.length > 0;

    const loadNotes = useCallback(async () => {
        if (!cardId) return;

        setIsNotesLoading(true);
        try {
            const { data } = await kanbanBoardService.getCardNotes(cardId);
            const rows = unwrapListResponse(data);
            setNotes(rows.map(mapNoteFromResponse));
        } catch {
            setNotes([]);
        } finally {
            setIsNotesLoading(false);
        }
    }, [cardId]);

    useEffect(() => {
        loadNotes();
    }, [loadNotes]);

    useEffect(() => {
        let cancelled = false;

        const loadManagers = async () => {
            setIsManagersLoading(true);
            try {
                const { data } = await callFileService.getAllManagers();
                const list = unwrapListResponse(data);
                if (!cancelled) {
                    setManagers(mapManagersFromResponse(list));
                }
            } catch {
                if (!cancelled) {
                    setManagers([]);
                }
            } finally {
                if (!cancelled) {
                    setIsManagersLoading(false);
                }
            }
        };

        loadManagers();

        return () => {
            cancelled = true;
        };
    }, []);

    const filteredManagers = useMemo(() => {
        const term = mentionSearch.trim().toLowerCase();
        if (!term) return managers;

        return managers.filter((manager) =>
            (manager.user_name || "").toLowerCase().includes(term)
        );
    }, [managers, mentionSearch]);

    const closeMentionDropdown = useCallback(() => {
        setMentionOpen(false);
        setMentionSearch("");
    }, []);

    const syncMentionState = useCallback(
        (editor) => {
            const context = getMentionContext(editor);
            if (context) {
                setMentionOpen(true);
                setMentionSearch(context.search);
                return;
            }
            closeMentionDropdown();
        },
        [closeMentionDropdown]
    );

    const handleNoteChange = useCallback(
        (html, _delta, _source, editor) => {
            setNoteText(html);
            syncMentionState(editor);
        },
        [syncMentionState]
    );

    const handleEditorBlur = useCallback(() => {
        closeMentionDropdown();
    }, [closeMentionDropdown]);

    const addMentionedUserId = useCallback((userId) => {
        setSelectedMentionUserIds((prev) => {
            if (prev.some((id) => String(id) === String(userId))) {
                return prev;
            }
            return [...prev, userId];
        });
    }, []);

    const handleSelectManager = useCallback(
        (manager) => {
            const editor = quillRef.current?.getEditor?.();
            if (!editor) return;

            const context = getMentionContext(editor);
            if (!context) return;

            const mentionText = `@${manager.user_name}`;
            editor.deleteText(context.startIndex, context.matchLength, "user");
            editor.insertText(context.startIndex, mentionText, "user");
            editor.setSelection(context.startIndex + mentionText.length, 0, "user");

            setNoteText(editor.root.innerHTML);
            addMentionedUserId(manager.user_id);
            closeMentionDropdown();
        },
        [addMentionedUserId, closeMentionDropdown]
    );

    const handleEditOpen = useCallback(
        (note) => {
            setEditingNoteId(note.id);
            setNoteText(note.content);
            closeMentionDropdown();
        },
        [closeMentionDropdown]
    );

    const handleEditCancel = useCallback(() => {
        setEditingNoteId(null);
        setNoteText("");
        setSelectedMentionUserIds([]);
        closeMentionDropdown();
    }, [closeMentionDropdown]);

    const handleSave = useCallback(async () => {
        if (isEmptyHtmlContent(noteText) || !cardId || isSaving) return;

        const isEditing = Boolean(editingNoteId);

        setIsSaving(true);
        try {
            const { data } = isEditing
                ? await kanbanBoardService.updateCardNote({
                      note_id: editingNoteId,
                      note_text: noteText,
                  })
                : await kanbanBoardService.addCardNote({
                      card_id: cardId,
                      note_text: noteText,
                  });
            await loadNotes();
            notify(
                data?.message || (isEditing ? "Note updated successfully." : "Note added successfully."),
                "success"
            );
            setEditingNoteId(null);
            setNoteText("");
            setSelectedMentionUserIds([]);
            closeMentionDropdown();
        } catch (error) {
            const msg =
                error?.response?.data?.message ||
                error?.response?.data?.error ||
                error?.message ||
                (editingNoteId ? "Failed to update note." : "Failed to add note.");
            notify(typeof msg === "string" ? msg : "Failed to save note.", "error");
        } finally {
            setIsSaving(false);
        }
    }, [noteText, cardId, isSaving, editingNoteId, closeMentionDropdown, loadNotes]);

    const handleDeleteOpen = useCallback((note) => {
        setSelectedNote(note);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteCancel = useCallback(() => {
        if (isDeleting) return;
        setShowDeleteModal(false);
        setSelectedNote(null);
    }, [isDeleting]);

    const handleDeleteConfirm = useCallback(async () => {
        if (!selectedNote) return;

        setIsDeleting(true);
        try {
            const { data } = await kanbanBoardService.deleteCardNote(selectedNote.id);
            await loadNotes();
            notify(data?.message || "Note deleted successfully.", "success");
            if (editingNoteId === selectedNote.id) {
                handleEditCancel();
            }
            setShowDeleteModal(false);
            setSelectedNote(null);
        } catch (error) {
            const msg =
                error?.response?.data?.message ||
                error?.response?.data?.error ||
                error?.message ||
                "Failed to delete note.";
            notify(typeof msg === "string" ? msg : "Failed to delete note.", "error");
        } finally {
            setIsDeleting(false);
        }
    }, [selectedNote, editingNoteId, handleEditCancel, loadNotes]);

    return (
        <div className="cardform-body cardform-body--feed-tab">
            <div className="notes-tab">
                <div className="notes-tab-layout">
                    <section className="notes-tab-editor" aria-label="Write a note">
                        <div className="notes-tab-panel">
                            <div className="notes-tab-editor-body">                   
                                {editingNoteId ? (
                                    <div className="notes-tab-editing-banner">
                                        <span className="notes-tab-editing-label">
                                            <FiEdit2 size={12} />
                                            Editing note
                                        </span>
                                        <button
                                            type="button"
                                            className="notes-tab-editing-cancel"
                                            onClick={handleEditCancel}
                                            disabled={isSaving}
                                            aria-label="Cancel editing"
                                        >
                                            <FiX size={13} />
                                        </button>
                                    </div>
                                ) : null}

                                <div className="notes-tab-mention-host">
                                    <div className="react-quill-wrapper notes-tab-quill">
                                        <ReactQuill
                                            ref={quillRef}
                                            theme="snow"
                                            value={noteText}
                                            onChange={handleNoteChange}
                                            onBlur={handleEditorBlur}
                                            modules={QUILL_MODULES}
                                            formats={QUILL_FORMATS}
                                            placeholder="Write a note..."
                                        />
                                    </div>

                                    {mentionOpen && (
                                        <div
                                            className="notes-tab-mention-dropdown"
                                            role="listbox"
                                            aria-label="Mention a user"
                                        >
                                            {isManagersLoading ? (
                                                <p className="notes-tab-mention-status">
                                                    Loading users...
                                                </p>
                                            ) : filteredManagers.length === 0 ? (
                                                <p className="notes-tab-mention-status">
                                                    No users found
                                                </p>
                                            ) : (
                                                filteredManagers.map((manager) => (
                                                    <button
                                                        key={manager.user_id}
                                                        type="button"
                                                        className="notes-tab-mention-option"
                                                        role="option"
                                                        onMouseDown={(event) =>
                                                            event.preventDefault()
                                                        }
                                                        onClick={() =>
                                                            handleSelectManager(manager)
                                                        }
                                                    >
                                                        <span className="notes-tab-mention-avatar">
                                                            {manager.avatar ? (
                                                                <img
                                                                    src={manager.avatar}
                                                                    alt=""
                                                                />
                                                            ) : (
                                                                <span className="notes-tab-mention-avatar-fallback">
                                                                    {getInitial(manager.user_name)}
                                                                </span>
                                                            )}
                                                        </span>
                                                        <span className="notes-tab-mention-name">
                                                            {manager.user_name}
                                                        </span>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="notes-tab-save-row">
                                    <button
                                        type="button"
                                        className="notes-tab-save-btn"
                                        onClick={handleSave}
                                        disabled={isSaving || isEmptyHtmlContent(noteText)}
                                    >
                                        <FiSend size={14} />
                                        {editingNoteId
                                            ? (isSaving ? "Updating..." : "Update")
                                            : (isSaving ? "Saving..." : "Save note")}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="notes-tab-list" aria-label="Notes">
                        <div className="notes-tab-panel">
                            <div className="notes-tab-list-header">
                                <p className="notes-tab-list-title">Notes</p>
                                {hasNotes ? (
                                    <span className="notes-tab-list-count">{notes.length}</span>
                                ) : null}
                            </div>
                            <div className="notes-tab-list-scroll">
                                {isNotesLoading ? (
                                    <div className="notes-tab-empty">
                                        <p>Loading notes...</p>
                                    </div>
                                ) : !hasNotes ? (
                                    <div className="notes-tab-empty">
                                        <FiFileText size={28} />
                                        <p>No notes added yet.</p>
                                    </div>
                                ) : (
                                    <ul className="notes-tab-list-items">
                                        {notes.map((note, index) => (
                                            <li
                                                className={`notes-tab-note-card${editingNoteId === note.id ? " notes-tab-note-card--editing" : ""}`}
                                                key={note.id ?? index}
                                            >
                                                <div
                                                    className="notes-tab-note-avatar"
                                                    style={{ background: getAvatarColor(note.userName) }}
                                                >
                                                    {getInitial(note.userName)}
                                                </div>
                                                <div className="notes-tab-note-content">
                                                    <div className="notes-tab-note-header">
                                                        {note.userName ? (
                                                            <p className="notes-tab-note-author">{note.userName}</p>
                                                        ) : <span />}
                                                        <div className="notes-tab-note-actions">
                                                            <button
                                                                type="button"
                                                                className="notes-tab-icon-btn"
                                                                onClick={() => handleEditOpen(note)}
                                                                aria-label="Edit note"
                                                                disabled={isSaving}
                                                            >
                                                                <FiEdit2 size={13} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="notes-tab-icon-btn notes-tab-icon-btn--danger"
                                                                onClick={() => handleDeleteOpen(note)}
                                                                aria-label="Delete note"
                                                                disabled={isSaving}
                                                            >
                                                                <FiTrash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div
                                                        className="notes-tab-note-body"
                                                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(note.content) }}
                                                    />
                                                    {note.updated_date || note.created_date ? (
                                                        <p className="notes-tab-note-time">
                                                            <FiClock size={11} />
                                                            {note.updated_date ?? note.created_date}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            <DeleteConfirmationModal
                show={showDeleteModal}
                onCancel={handleDeleteCancel}
                onConfirm={handleDeleteConfirm}
                isLoading={isDeleting}
                deleteText="Are you sure you want to delete this note?"
            />
        </div>
    );
}

Notes.propTypes = {
    card: PropTypes.object,
};

export default Notes;
