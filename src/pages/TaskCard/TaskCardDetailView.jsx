import { useState, useRef } from "react";
import { FiX } from "react-icons/fi";
import "./TaskCard.scss";

function TaskCardDetailView({ card, onClose }) {
    const [comments, setComments] = useState("");
    const [files, setFiles] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

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
        <div className="cardform-body cardform-body--feed-tab">
            <div className="subtasks-tab">
                <div className="subtasks-tab-layout">
                    <section className="subtasks-tab-editor">
                        <div className="subtasks-tab-card subtasks-tab-card--editor">
                            <div className="subtasks-tab-editor-body">

                                <div className="subtasks-tab-field-row">
                                    <div className="subtasks-tab-field">
                                        <label className="subtasks-tab-label">Task Name</label>
                                        <div className="st-readonly-field">{card?.taskName || card?.title || "—"}</div>
                                    </div>
                                    <div className="subtasks-tab-field st-due-date-field">
                                        <label className="subtasks-tab-label">Due Date</label>
                                        <div className="st-readonly-field">{card?.dueDate || "—"}</div>
                                    </div>
                                </div>

                                <div className="subtasks-tab-field">
                                    <label className="subtasks-tab-label" htmlFor="stv-cf-comments">Comments</label>
                                    <textarea
                                        id="stv-cf-comments"
                                        className="subtasks-tab-textarea"
                                        rows={4}
                                        placeholder="Add comments..."
                                        value={comments}
                                        onChange={(e) => setComments(e.target.value)}
                                    />
                                </div>

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
                                            onChange={(e) => {
                                                const selected = Array.from(e.target.files || []);
                                                if (selected.length) setFiles((prev) => [...prev, ...selected]);
                                                e.target.value = "";
                                            }}
                                        />
                                    </div>
                                    {files.length > 0 && (
                                        <div className="st-file-chips">
                                            {files.map((f, i) => (
                                                <span key={i} className="st-file-chip">
                                                    {f.name}
                                                    <button type="button" className="st-upload-clear" onClick={() => removeFile(i)}>
                                                        <FiX size={10} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="st-inline-actions">
                                    <button type="button" className="st-inline-save" onClick={onClose}>Submit</button>
                                </div>

                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

export default TaskCardDetailView;
