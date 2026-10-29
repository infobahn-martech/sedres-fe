import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import ReactQuill from "react-quill";
import DOMPurify from "dompurify";
import { FiEdit2, FiTrash2, FiCornerUpLeft, FiFile } from "react-icons/fi";
import "react-quill/dist/quill.snow.css";
import "../../../../../../design/scss/invoice.scss";
import "../../../../../../design/scss/comments.scss";
import kanbanBoardService from "../../../../../../services/kanbanBoardService";
import userService from "../../../../../../services/userService";
import { unwrapListResponse } from "../../../../../../shared/helpers/callFileFormOptions";
import { notify } from "../../../../../../components/Toaster";
import DeleteConfirmationModal from "../../../../../../components/DeleteConfirmationModal";
import useAuthReducer from "../../../../../../store/AuthReducer";

const QUILL_MODULES = {
    toolbar: [
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }, { background: [] }],
        [{ align: [] }],
        [{ list: "ordered" }, { list: "bullet" }],
        ["blockquote", "link", "image"],
        ["clean"],
    ],
};

const QUILL_FORMATS = [
    "bold",
    "italic",
    "underline",
    "strike",
    "color",
    "background",
    "align",
    "list",
    "bullet",
    "blockquote",
    "link",
    "image",
];

const MENTION_TRIGGER_REGEX = /@([^\s@]*)$/;

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_ATTACHMENT_EXTENSIONS = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"];

const getFileExtension = (file) => `.${(file.name.split(".").pop() || "").toLowerCase()}`;

const validateAttachmentFiles = (fileList) => {
    const files = Array.from(fileList || []);
    const valid = [];
    const errors = [];

    files.forEach((file) => {
        if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(getFileExtension(file))) {
            errors.push(`${file.name}: unsupported file type.`);
            return;
        }
        if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
            errors.push(`${file.name}: exceeds 10MB size limit.`);
            return;
        }
        valid.push(file);
    });

    return { valid, errors };
};

const stripHtmlContent = (html) => {
    if (!html) return "";
    return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
};

const isEmptyHtmlContent = (html) => stripHtmlContent(html).length === 0;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Comments store mentions as plain "@Name" text, not a distinct Quill blot, so
// highlighting them means matching against known user names after sanitizing —
// makes it visually obvious who a comment is replying to/mentioning.
const highlightMentions = (safeHtml, mentionableNames) => {
    if (!safeHtml || mentionableNames.length === 0) return safeHtml;

    const sortedNames = [...mentionableNames].sort((a, b) => b.length - a.length);
    const pattern = new RegExp(`@(${sortedNames.map(escapeRegExp).join("|")})`, "g");

    return safeHtml.replace(pattern, '<span class="comments-tab-mention-highlight">@$1</span>');
};

const getInitial = (name) => (name || "?").trim().charAt(0).toUpperCase() || "?";

const getCardId = (card) => card?.id || card?.card_id || card?.call_id;

const mapCommentFromResponse = (row) => ({
    id: row.comment_id,
    userId: row.user_id ?? null,
    userName: row.user_name ?? "",
    content: row.comment_text,
    mentions: row.mentions ?? [],
    attachment: row.attachment
        ? { name: row.attachment, url: row.attachment_url ?? null }
        : null,
    created_date: row.created_date ?? null,
});

// Backend stores one attachment per comment row, so a multi-file send creates
// several consecutive rows (same author/text). Group those back into a single
// display card so the UI reads as one message with multiple files attached.
const groupCommentsForDisplay = (commentsList) => {
    const groups = [];

    commentsList.forEach((comment) => {
        const last = groups[groups.length - 1];
        const belongsToLastGroup =
            last &&
            last.userName === (comment.userName || "") &&
            last.content === comment.content;

        if (belongsToLastGroup) {
            if (comment.attachment) last.attachments.push(comment.attachment);
            last.commentIds.push(comment.id);
        } else {
            groups.push({
                id: comment.id,
                userId: comment.userId,
                userName: comment.userName,
                content: comment.content,
                mentions: comment.mentions,
                created_date: comment.created_date,
                attachments: comment.attachment ? [comment.attachment] : [],
                commentIds: [comment.id],
            });
        }
    });

    return groups;
};

// A card is a "reply" when it @mentions the author of an earlier card — thread it
// as a nested child under the nearest preceding card from that author, so replies
// render indented under the message they're replying to instead of as flat, equal
// top-level cards.
const threadCommentsForDisplay = (groups) => {
    const parentIdById = new Map();

    groups.forEach((group, index) => {
        const mentionedUserIds = (group.mentions || []).map((mention) => String(mention.user_id));
        if (mentionedUserIds.length === 0) return;

        for (let j = index - 1; j >= 0; j -= 1) {
            if (group.userId != null && String(groups[j].userId) === String(group.userId)) continue;
            if (mentionedUserIds.includes(String(groups[j].userId))) {
                parentIdById.set(group.id, groups[j].id);
                break;
            }
        }
    });

    const findRootId = (id) => {
        let current = id;
        const seen = new Set();
        while (parentIdById.has(current) && !seen.has(current)) {
            seen.add(current);
            current = parentIdById.get(current);
        }
        return current;
    };

    const repliesByRootId = new Map();
    const roots = [];

    groups.forEach((group) => {
        if (!parentIdById.has(group.id)) {
            roots.push({ ...group, replies: [] });
        }
    });

    groups.forEach((group) => {
        if (!parentIdById.has(group.id)) return;
        const rootId = findRootId(group.id);
        if (!repliesByRootId.has(rootId)) repliesByRootId.set(rootId, []);
        repliesByRootId.get(rootId).push(group);
    });

    roots.forEach((root) => {
        root.replies = repliesByRootId.get(root.id) || [];
    });

    return roots;
};

const mapManagersFromResponse = (rows) =>
    (rows || []).map((row) => ({
        user_id: row.user_id,
        user_name: row.name ?? "",
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

function CommentCard({ group, isReply, expandAll, isSaving, mentionableNames, onReply, onEditOpen, onDeleteOpen }) {
    return (
        <li
            className={`comments-tab-comment-card${isReply ? " comments-tab-comment-card--reply" : ""}`}
        >
            <div className="comments-tab-comment-avatar">
                <span className="comments-tab-comment-avatar-fallback">
                    {getInitial(group.userName)}
                </span>
            </div>
            <div className="comments-tab-comment-content">
                <div className="comments-tab-comment-header">
                    <div className="comments-tab-comment-meta">
                        {group.userName ? (
                            <p className="comments-tab-comment-author">{group.userName}</p>
                        ) : <span />}
                        {group.created_date ? (
                            <p className="notes-tab-note-updated">{group.created_date}</p>
                        ) : null}
                    </div>
                    <div className="comments-tab-comment-actions">
                        <button
                            type="button"
                            className="subtasks-tab-edit-btn"
                            onClick={() => onReply(group)}
                            aria-label="Reply to comment"
                            disabled={isSaving}
                        >
                            <FiCornerUpLeft size={14} />
                        </button>
                        {group.commentIds.length === 1 && (
                            <button
                                type="button"
                                className="subtasks-tab-edit-btn"
                                onClick={() => onEditOpen(group)}
                                aria-label="Edit comment"
                                disabled={isSaving}
                            >
                                <FiEdit2 size={14} />
                            </button>
                        )}
                        <button
                            type="button"
                            className="subtasks-tab-edit-btn comments-tab-delete-btn"
                            onClick={() => onDeleteOpen(group)}
                            aria-label="Delete comment"
                            disabled={isSaving}
                        >
                            <FiTrash2 size={14} />
                        </button>
                    </div>
                </div>
                <div
                    className={`comments-tab-comment-bubble${expandAll ? "" : " comments-tab-comment-bubble--clamped"}`}
                    dangerouslySetInnerHTML={{
                        __html: highlightMentions(DOMPurify.sanitize(group.content), mentionableNames),
                    }}
                />
                {group.attachments.length > 0 && (
                    <div className="comments-tab-comment-attachments">
                        {group.attachments.map((attachment, attachmentIndex) =>
                            attachment.url ? (
                                <a
                                    key={`${attachment.name}_${attachmentIndex}`}
                                    className="subtasks-tab-task-doc comments-tab-attachment-row"
                                    href={attachment.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={attachment.name}
                                >
                                    <FiFile size={12} className="comments-tab-attachment-icon" />
                                    {attachment.name}
                                </a>
                            ) : (
                                <span
                                    key={`${attachment.name}_${attachmentIndex}`}
                                    className="subtasks-tab-task-doc comments-tab-attachment-row"
                                    title={attachment.name}
                                >
                                    <FiFile size={12} className="comments-tab-attachment-icon" />
                                    {attachment.name}
                                </span>
                            )
                        )}
                    </div>
                )}
            </div>
        </li>
    );
}

CommentCard.propTypes = {
    group: PropTypes.object.isRequired,
    isReply: PropTypes.bool,
    expandAll: PropTypes.bool,
    isSaving: PropTypes.bool,
    mentionableNames: PropTypes.array,
    onReply: PropTypes.func.isRequired,
    onEditOpen: PropTypes.func.isRequired,
    onDeleteOpen: PropTypes.func.isRequired,
};

function Comments({ card }) {
    const quillRef = useRef(null);
    const fileInputRef = useRef(null);
    const [commentText, setCommentText] = useState("");
    const [managers, setManagers] = useState([]);
    const [mentionOpen, setMentionOpen] = useState(false);
    const [mentionSearch, setMentionSearch] = useState("");
    const [selectedMentionUserIds, setSelectedMentionUserIds] = useState([]);
    const [isManagersLoading, setIsManagersLoading] = useState(false);
    const [attachmentFiles, setAttachmentFiles] = useState([]);
    const [isAttachmentDragging, setIsAttachmentDragging] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [comments, setComments] = useState([]);
    const [isCommentsLoading, setIsCommentsLoading] = useState(false);
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedComment, setSelectedComment] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [commentFilter] = useState("");
    const [expandAll] = useState(false);
    const [sendAsEmail, setSendAsEmail] = useState(false);
    const [emailFrom, setEmailFrom] = useState("");
    const [emailTo, setEmailTo] = useState("");

    const fromEmail = useAuthReducer((state) => state.profileData?.email);

    const cardId = getCardId(card);
    const hasComments = comments.length > 0;

    const mentionedNames = useMemo(
        () =>
            managers
                .filter((manager) =>
                    selectedMentionUserIds.some((id) => String(id) === String(manager.user_id))
                )
                .map((manager) => manager.user_name)
                .filter(Boolean),
        [managers, selectedMentionUserIds]
    );

    const mentionableNames = useMemo(
        () => managers.map((manager) => manager.user_name).filter(Boolean),
        [managers]
    );

    const filteredComments = useMemo(() => {
        const term = commentFilter.trim().toLowerCase();
        if (!term) return comments;

        return comments.filter(
            (comment) =>
                (comment.userName || "").toLowerCase().includes(term) ||
                stripHtmlContent(comment.content).toLowerCase().includes(term)
        );
    }, [comments, commentFilter]);

    const groupedComments = useMemo(
        () => groupCommentsForDisplay(filteredComments),
        [filteredComments]
    );

    const threadedComments = useMemo(
        () => threadCommentsForDisplay(groupedComments),
        [groupedComments]
    );

    const loadComments = useCallback(async () => {
        if (!cardId) return;

        setIsCommentsLoading(true);
        try {
            const { data } = await kanbanBoardService.getCardComments(cardId);
            const rows = unwrapListResponse(data);
            setComments(rows.map(mapCommentFromResponse));
        } catch {
            setComments([]);
        } finally {
            setIsCommentsLoading(false);
        }
    }, [cardId]);

    useEffect(() => {
        loadComments();
    }, [loadComments]);

    useEffect(() => {
        if (fromEmail && !emailFrom) setEmailFrom(fromEmail);
    }, [fromEmail, emailFrom]);

    useEffect(() => {
        if (mentionedNames.length > 0 && !emailTo) {
            setEmailTo(mentionedNames.join(", "));
        }
    }, [mentionedNames, emailTo]);

    useEffect(() => {
        let cancelled = false;

        const loadManagers = async () => {
            setIsManagersLoading(true);
            try {
                const { data } = await userService.getAllUsers();
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

    const handleCommentChange = useCallback(
        (html, _delta, _source, editor) => {
            setCommentText(html);
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

            setCommentText(editor.root.innerHTML);
            addMentionedUserId(manager.user_id);
            closeMentionDropdown();
        },
        [addMentionedUserId, closeMentionDropdown]
    );

    const handleReply = useCallback(
        (comment) => {
            const editor = quillRef.current?.getEditor?.();
            if (!editor || !comment.userName) return;

            editor.focus();
            const mentionText = `@${comment.userName} `;
            const insertIndex = Math.max(editor.getLength() - 1, 0);
            editor.insertText(insertIndex, mentionText, "user");
            editor.setSelection(insertIndex + mentionText.length, 0, "user");

            setCommentText(editor.root.innerHTML);
            const manager = managers.find((item) => item.user_name === comment.userName);
            if (manager) addMentionedUserId(manager.user_id);
            closeMentionDropdown();
        },
        [managers, addMentionedUserId, closeMentionDropdown]
    );

    const handleEditOpen = useCallback(
        (comment) => {
            setEditingCommentId(comment.id);
            setCommentText(comment.content);
            setSelectedMentionUserIds((comment.mentions || []).map((mention) => mention.user_id));
            setAttachmentFiles([]);
            closeMentionDropdown();
        },
        [closeMentionDropdown]
    );

    const handleEditCancel = useCallback(() => {
        setEditingCommentId(null);
        setCommentText("");
        setSelectedMentionUserIds([]);
        setAttachmentFiles([]);
        closeMentionDropdown();
    }, [closeMentionDropdown]);

    const buildCommentFormData = useCallback(
        ({ isEditing, attachment }) => {
            const formData = new FormData();
            if (isEditing) {
                formData.append("comment_id", String(editingCommentId));
            } else {
                formData.append("card_id", String(cardId));
            }
            formData.append("comment_text", commentText);
            formData.append("mentions", JSON.stringify(selectedMentionUserIds));
            formData.append("send_email", sendAsEmail ? "1" : "0");
            if (attachment) formData.append("attachment", attachment);
            return formData;
        },
        [cardId, commentText, editingCommentId, selectedMentionUserIds, sendAsEmail]
    );

    const handleSave = useCallback(async () => {
        if (isEmptyHtmlContent(commentText) || !cardId || isSaving) return;

        const isEditing = Boolean(editingCommentId);

        setIsSaving(true);
        try {
            if (isEditing) {
                // A comment can only carry one attachment on the backend, so editing
                // keeps just the first selected file even if more were picked.
                const { data } = await kanbanBoardService.updateCardComment(
                    buildCommentFormData({ isEditing: true, attachment: attachmentFiles[0] ?? null })
                );
                notify(data?.message || "Comment updated successfully.", "success");
            } else if (attachmentFiles.length > 1) {
                // No multi-attachment support on the backend, so multiple files become
                // one comment per file (same text/mentions), attached individually.
                const results = await Promise.allSettled(
                    attachmentFiles.map((file) =>
                        kanbanBoardService.addCardComment(buildCommentFormData({ isEditing: false, attachment: file }))
                    )
                );
                const failed = results.filter((result) => result.status === "rejected").length;
                if (failed > 0) {
                    notify(`${failed} of ${attachmentFiles.length} comments failed to add.`, "error");
                } else {
                    notify(`${attachmentFiles.length} comments added successfully.`, "success");
                }
            } else {
                const { data } = await kanbanBoardService.addCardComment(
                    buildCommentFormData({ isEditing: false, attachment: attachmentFiles[0] ?? null })
                );
                notify(data?.message || "Comment added successfully.", "success");
            }

            await loadComments();
            setEditingCommentId(null);
            setCommentText("");
            setSelectedMentionUserIds([]);
            setAttachmentFiles([]);
            closeMentionDropdown();
        } catch (error) {
            const msg =
                error?.response?.data?.message ||
                error?.response?.data?.error ||
                error?.message ||
                (editingCommentId ? "Failed to update comment." : "Failed to add comment.");
            notify(typeof msg === "string" ? msg : "Failed to save comment.", "error");
        } finally {
            setIsSaving(false);
        }
    }, [commentText, cardId, isSaving, attachmentFiles, editingCommentId, buildCommentFormData, closeMentionDropdown, loadComments]);

    const handleAttachFiles = useCallback((fileList) => {
        const { valid, errors } = validateAttachmentFiles(fileList);
        if (errors.length > 0) {
            notify(errors.join(" "), "error");
        }
        if (valid.length === 0) return;

        setAttachmentFiles((prev) => {
            const existingKeys = new Set(prev.map((file) => `${file.name}_${file.size}`));
            const additions = valid.filter((file) => !existingKeys.has(`${file.name}_${file.size}`));
            return [...prev, ...additions];
        });
    }, []);

    const handleRemoveAttachment = useCallback((index) => {
        setAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const handleDeleteOpen = useCallback((comment) => {
        setSelectedComment(comment);
        setShowDeleteModal(true);
    }, []);

    const handleDeleteCancel = useCallback(() => {
        if (isDeleting) return;
        setShowDeleteModal(false);
        setSelectedComment(null);
    }, [isDeleting]);

    const handleDeleteConfirm = useCallback(async () => {
        if (!selectedComment) return;

        const commentIds = selectedComment.commentIds || [selectedComment.id];

        setIsDeleting(true);
        try {
            const results = await Promise.allSettled(
                commentIds.map((id) => kanbanBoardService.deleteCardComment(id))
            );
            const failed = results.filter((result) => result.status === "rejected").length;
            await loadComments();
            if (failed > 0) {
                notify(`${failed} of ${commentIds.length} files failed to delete.`, "error");
            } else {
                notify("Comment deleted successfully.", "success");
            }
            if (commentIds.includes(editingCommentId)) {
                handleEditCancel();
            }
            setShowDeleteModal(false);
            setSelectedComment(null);
        } catch (error) {
            const msg =
                error?.response?.data?.message ||
                error?.response?.data?.error ||
                error?.message ||
                "Failed to delete comment.";
            notify(typeof msg === "string" ? msg : "Failed to delete comment.", "error");
        } finally {
            setIsDeleting(false);
        }
    }, [selectedComment, editingCommentId, handleEditCancel, loadComments]);

    return (
        <div className="cardform-body cardform-body--feed-tab">
            <div className="comments-tab">
                <div className="comments-tab-layout">
                    <section className="comments-tab-list" aria-label="Comments">
                        <div className="comments-tab-card comments-tab-card--list">
                            <div className="comments-tab-list-scroll">
                                {isCommentsLoading ? (
                                    <p className="comments-tab-empty">Loading comments...</p>
                                ) : !hasComments ? (
                                    <p className="comments-tab-empty">No comments added yet.</p>
                                ) : groupedComments.length === 0 ? (
                                    <p className="comments-tab-empty">No comments match your filter.</p>
                                ) : (
                                    <ul className="comments-tab-list-items">
                                        {threadedComments.map((root) => (
                                            <li className="comments-tab-comment-thread" key={root.id}>
                                                <ul className="comments-tab-list-items">
                                                    <CommentCard
                                                        group={root}
                                                        isReply={false}
                                                        expandAll={expandAll}
                                                        isSaving={isSaving}
                                                        mentionableNames={mentionableNames}
                                                        onReply={handleReply}
                                                        onEditOpen={handleEditOpen}
                                                        onDeleteOpen={handleDeleteOpen}
                                                    />
                                                    {root.replies.map((reply) => (
                                                        <CommentCard
                                                            key={reply.id}
                                                            group={reply}
                                                            isReply
                                                            expandAll={expandAll}
                                                            isSaving={isSaving}
                                                            mentionableNames={mentionableNames}
                                                            onReply={handleReply}
                                                            onEditOpen={handleEditOpen}
                                                            onDeleteOpen={handleDeleteOpen}
                                                        />
                                                    ))}
                                                </ul>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </section>

                    <section className="comments-tab-editor" aria-label="Write a comment">
                        <div className="comments-tab-card comments-tab-card--editor">
                            <div className="comments-tab-editor-body">
                                {sendAsEmail && (
                                    <div className="comments-tab-email-fields">
                                        <div className="comments-tab-email-field">
                                            <span className="comments-tab-email-label">From</span>
                                            <input
                                                type="email"
                                                className="comments-tab-email-value comments-tab-email-input"
                                                value={emailFrom}
                                                onChange={(event) => setEmailFrom(event.target.value)}
                                                placeholder="You"
                                            />
                                        </div>
                                        <div className="comments-tab-email-field">
                                            <span className="comments-tab-email-label">To</span>
                                            <input
                                                type="text"
                                                className="comments-tab-email-value comments-tab-email-input"
                                                value={emailTo}
                                                onChange={(event) => setEmailTo(event.target.value)}
                                                placeholder="Mention a user with @ to notify them"
                                            />
                                        </div>
                                    </div>
                                )}
                                <div className="comments-tab-mention-host">
                                    <div className="react-quill-wrapper comments-tab-quill">
                                        <ReactQuill
                                            ref={quillRef}
                                            theme="snow"
                                            value={commentText}
                                            onChange={handleCommentChange}
                                            onBlur={handleEditorBlur}
                                            modules={QUILL_MODULES}
                                            formats={QUILL_FORMATS}
                                            placeholder="Write a comment..."
                                        />
                                    </div>

                                    {mentionOpen && (
                                        <div
                                            className="comments-tab-mention-dropdown"
                                            role="listbox"
                                            aria-label="Mention a user"
                                        >
                                            {isManagersLoading ? (
                                                <p className="comments-tab-mention-status">
                                                    Loading users...
                                                </p>
                                            ) : filteredManagers.length === 0 ? (
                                                <p className="comments-tab-mention-status">
                                                    No users found
                                                </p>
                                            ) : (
                                                filteredManagers.map((manager) => (
                                                    <button
                                                        key={manager.user_id}
                                                        type="button"
                                                        className="comments-tab-mention-option"
                                                        role="option"
                                                        onMouseDown={(event) =>
                                                            event.preventDefault()
                                                        }
                                                        onClick={() =>
                                                            handleSelectManager(manager)
                                                        }
                                                    >
                                                        <span className="comments-tab-mention-avatar">
                                                            {manager.avatar ? (
                                                                <img
                                                                    src={manager.avatar}
                                                                    alt=""
                                                                />
                                                            ) : (
                                                                <span className="comments-tab-mention-avatar-fallback">
                                                                    {(manager.user_name || "?")
                                                                        .charAt(0)
                                                                        .toUpperCase()}
                                                                </span>
                                                            )}
                                                        </span>
                                                        <span className="comments-tab-mention-name">
                                                            {manager.user_name}
                                                        </span>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="comments-tab-upload-wrapper">
                                    <span className="comments-tab-upload-label">File</span>
                                    <div
                                        className={`document-upload-zone comments-tab-upload-zone${isAttachmentDragging ? " dragging" : ""}${isSaving ? " is-loading" : ""}`}
                                        onClick={() => !isSaving && fileInputRef.current?.click()}
                                        onDragEnter={(event) => {
                                            event.preventDefault();
                                            if (!isSaving) setIsAttachmentDragging(true);
                                        }}
                                        onDragOver={(event) => {
                                            event.preventDefault();
                                            if (!isSaving) setIsAttachmentDragging(true);
                                        }}
                                        onDragLeave={() => setIsAttachmentDragging(false)}
                                        onDrop={(event) => {
                                            event.preventDefault();
                                            setIsAttachmentDragging(false);
                                            if (!isSaving) handleAttachFiles(event.dataTransfer.files);
                                        }}
                                    >
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            multiple
                                            accept={ALLOWED_ATTACHMENT_EXTENSIONS.join(",")}
                                            className="file-input-hidden"
                                            onChange={(event) => {
                                                handleAttachFiles(event.target.files);
                                                event.target.value = "";
                                            }}
                                            disabled={isSaving}
                                        />
                                        <div className="upload-zone-content">
                                            <div className="upload-text-content">
                                                <p className="upload-main-text">
                                                    Drag and drop your files here, or{" "}
                                                    <span className="upload-link">click to browse</span>
                                                </p>
                                                <p className="upload-sub-text">
                                                    Supports: PDF, DOC, DOCX, JPG, PNG, GIF, WEBP, BMP (Max 10MB per file)
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {attachmentFiles.length > 0 && (
                                        <div className="comments-tab-doc-chip-list">
                                            {attachmentFiles.map((file, index) => (
                                                <div className="comments-tab-doc-chip" key={`${file.name}_${file.size}`}>
                                                    <span className="comments-tab-doc-name" title={file.name}>
                                                        {file.name}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="subtasks-tab-doc-remove"
                                                        onClick={() => handleRemoveAttachment(index)}
                                                        aria-label="Remove attachment"
                                                        disabled={isSaving}
                                                    >
                                                        &times;
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="comments-tab-action-row">
                                    <label className="comments-tab-send-email-toggle">
                                        <input
                                            type="checkbox"
                                            className="comments-tab-send-email-checkbox"
                                            checked={sendAsEmail}
                                            onChange={(event) => setSendAsEmail(event.target.checked)}
                                        />
                                        <span className="comments-tab-send-email-track">
                                            <span className="comments-tab-send-email-thumb" />
                                        </span>
                                        <span className="comments-tab-send-email-text">Send as email</span>
                                    </label>
                                    {editingCommentId && (
                                        <button
                                            type="button"
                                            className="comments-tab-cancel-btn"
                                            onClick={handleEditCancel}
                                            disabled={isSaving}
                                        >
                                            Cancel
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className="comments-tab-save-btn"
                                        onClick={handleSave}
                                        disabled={isSaving || isEmptyHtmlContent(commentText)}
                                    >
                                        {editingCommentId
                                            ? (isSaving ? "Updating..." : "Update")
                                            : (isSaving ? "Adding..." : "Add Comment")}
                                    </button>
                                </div>
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
                deleteText="Are you sure you want to delete this comment?"
            />
        </div>
    );
}

Comments.propTypes = {
    card: PropTypes.object,
};

export default Comments;
