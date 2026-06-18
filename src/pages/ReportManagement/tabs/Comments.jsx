import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import "../../../design/scss/invoice.scss";
import callFileService from "../../../services/callFileService";
import { unwrapListResponse } from "../../../shared/helpers/callFileFormOptions";

/* ── Quill config ─────────────────────────────────────────────── */

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

/* ── Helpers ──────────────────────────────────────────────────── */

const isEmptyHtmlContent = (html) => {
  if (!html) return true;
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length === 0;
};

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

const formatTimestamp = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/* ── Component ────────────────────────────────────────────────── */

function ReportManagementComments() {
  const quillRef = useRef(null);

  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState([]);
  const [managers, setManagers] = useState([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [selectedMentionUserIds, setSelectedMentionUserIds] = useState([]);
  const [isManagersLoading, setIsManagersLoading] = useState(false);

  /* load managers for @mention */
  useEffect(() => {
    let cancelled = false;
    setIsManagersLoading(true);

    callFileService
      .getAllManagers()
      .then(({ data }) => {
        if (!cancelled) {
          setManagers(mapManagersFromResponse(unwrapListResponse(data)));
        }
      })
      .catch((err) => {
        console.error("[ReportManagementComments] failed to load managers", err);
        if (!cancelled) setManagers([]);
      })
      .finally(() => {
        if (!cancelled) setIsManagersLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const filteredManagers = useMemo(() => {
    const term = mentionSearch.trim().toLowerCase();
    if (!term) return managers;
    return managers.filter((m) =>
      (m.user_name || "").toLowerCase().includes(term)
    );
  }, [managers, mentionSearch]);

  /* mention helpers */
  const closeMentionDropdown = useCallback(() => {
    setMentionOpen(false);
    setMentionSearch("");
  }, []);

  const syncMentionState = useCallback(
    (editor) => {
      const ctx = getMentionContext(editor);
      if (ctx) {
        setMentionOpen(true);
        setMentionSearch(ctx.search);
      } else {
        closeMentionDropdown();
      }
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
    setSelectedMentionUserIds((prev) =>
      prev.some((id) => String(id) === String(userId)) ? prev : [...prev, userId]
    );
  }, []);

  const handleSelectManager = useCallback(
    (manager) => {
      const editor = quillRef.current?.getEditor?.();
      if (!editor) return;
      const ctx = getMentionContext(editor);
      if (!ctx) return;

      const mentionText = `@${manager.user_name}`;
      editor.deleteText(ctx.startIndex, ctx.matchLength, "user");
      editor.insertText(ctx.startIndex, mentionText, "user");
      editor.setSelection(ctx.startIndex + mentionText.length, 0, "user");

      setCommentText(editor.root.innerHTML);
      addMentionedUserId(manager.user_id);
      closeMentionDropdown();
    },
    [addMentionedUserId, closeMentionDropdown]
  );

  /* save — appends locally for now (API integration ready) */
  const handleSave = useCallback(() => {
    if (isEmptyHtmlContent(commentText)) return;

    const newComment = {
      id: Date.now(),
      content: commentText,
      mentionedUsers: selectedMentionUserIds,
      createdAt: new Date().toISOString(),
      author: "You",
      avatar: null,
    };

    setComments((prev) => [newComment, ...prev]);
    setCommentText("");
    setSelectedMentionUserIds([]);
    closeMentionDropdown();
  }, [commentText, selectedMentionUserIds, closeMentionDropdown]);

  return (
    <div className="rm-comments-wrapper comments-tab">
      <div className="comments-tab-layout">
        {/* ── Left: editor ── */}
        <section className="comments-tab-editor" aria-label="Write a comment">
          <div className="comments-tab-card comments-tab-card--editor">
            <div className="comments-tab-editor-body">
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
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSelectManager(manager)}
                        >
                          <span className="comments-tab-mention-avatar">
                            {manager.avatar ? (
                              <img src={manager.avatar} alt="" />
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

              <div className="comments-tab-save-row">
                <button
                  type="button"
                  className="comments-tab-save-btn"
                  onClick={handleSave}
                  disabled={isEmptyHtmlContent(commentText)}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Right: comment list ── */}
        <section className="comments-tab-list" aria-label="Comments">
          <div className="comments-tab-card comments-tab-card--list">
            <div className="comments-tab-list-scroll">
              {comments.length === 0 ? (
                <p className="comments-tab-empty">
                  No comments added yet.
                </p>
              ) : (
                <ul className="comments-tab-list-items">
                  {comments.map((comment) => (
                    <li
                      key={comment.id}
                      className="comments-tab-comment-card"
                    >
                      <div className="comments-tab-comment-avatar">
                        {comment.avatar ? (
                          <img
                            src={comment.avatar}
                            alt={comment.author}
                          />
                        ) : (
                          <span className="comments-tab-mention-avatar-fallback">
                            {(comment.author || "?")
                              .charAt(0)
                              .toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="comments-tab-comment-content">
                        <div className="comments-tab-comment-meta">
                          <span className="comments-tab-comment-author">
                            {comment.author}
                          </span>
                          {comment.createdAt && (
                            <span className="comments-tab-comment-time">
                              {formatTimestamp(comment.createdAt)}
                            </span>
                          )}
                        </div>
                        <div
                          className="comments-tab-comment-body"
                          dangerouslySetInnerHTML={{
                            __html: comment.content,
                          }}
                        />
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
  );
}

export default ReportManagementComments;
