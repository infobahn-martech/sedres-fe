import { useEffect, useMemo, useState } from 'react';
import CustomModal from './CustomModal';

// title / fieldLabel / accept / formatsHint / inputId default to the original invoice-upload
// wording so existing callers are unchanged; SalesOrderList's SO approval email upload passes
// its own. inputId must be unique per mounted instance (the drop zone clicks it by id).
function UploadInvoiceModal({
    show,
    closeModal,
    orderNo,
    contextLabel,
    onUploadComplete,
    title = 'Upload Invoice',
    fieldLabel = 'Attach invoices',
    accept = '.pdf,.jpg,.jpeg,.jpe',
    formatsHint = 'PDF, JPG, JPEG',
    inputId = 'upload-invoice-input',
}) {
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!show) return;
        setSelectedFiles([]);
        setIsUploading(false);
        setIsDragging(false);
        setError('');
    }, [show, orderNo]);

    const handleAddFiles = (filesLike) => {
        const files = Array.from(filesLike || []);
        if (!files.length) return;
        setSelectedFiles((prev) => [...prev, ...files]);
        setError('');
    };

    const handleRemoveIndex = (idx) => {
        setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
    };

    const renderSelected = useMemo(() => {
        if (!selectedFiles.length) return null;
        return (
            <div className="file-drop-zone__selected" style={{ justifyContent: 'flex-start' }}>
                {selectedFiles.slice(0, 3).map((f, idx) => (
                    <span key={`${f.name}-${idx}`} className="d-inline-flex align-items-center gap-2">
                        <span className="file-drop-zone__name">{f.name}</span>
                        <button
                            type="button"
                            className="file-drop-zone__clear"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveIndex(idx);
                            }}
                            aria-label={`Remove ${f.name}`}
                        >
                            Remove
                        </button>
                    </span>
                ))}
                {selectedFiles.length > 3 && (
                    <small className="text-muted" style={{ marginLeft: 8 }}>
                        +{selectedFiles.length - 3} more
                    </small>
                )}
            </div>
        );
    }, [selectedFiles]);

    const renderHeader = () => <h1 className="modal-title">{title}</h1>;

    const renderBody = () => (
        <div className="modal-body">
            <div className="lead-form">
                <div className="row">
                    <div className="col-md-12 mb-lg-3 mb-sm-0">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <label className="form-label mb-0">
                                {fieldLabel} <span className="text-danger">*</span>
                            </label>
                            <small className="text-muted">{contextLabel || `Order: ${orderNo}`}</small>
                        </div>

                        <div className="file-drop-zone-wrapper">
                            <div
                                className={`file-drop-zone ${isDragging ? 'file-drop-zone--active' : ''} ${error ? 'file-drop-zone--error' : ''}`}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsDragging(true);
                                }}
                                onDragLeave={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsDragging(false);
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsDragging(false);
                                    handleAddFiles(e.dataTransfer?.files);
                                }}
                                onClick={() => document.getElementById(inputId).click()}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        document.getElementById(inputId).click();
                                    }
                                }}
                            >
                                <input
                                    id={inputId}
                                    type="file"
                                    className="d-none"
                                    multiple
                                    accept={accept}
                                    onChange={(e) => handleAddFiles(e.target?.files)}
                                />

                                {selectedFiles.length ? (
                                    <>
                                        <span className="file-drop-zone__icon">✓</span>
                                        <span className="file-drop-zone__text">Files selected ({selectedFiles.length})</span>
                                        {renderSelected}
                                    </>
                                ) : (
                                    <>
                                        <span className="file-drop-zone__icon">📎</span>
                                        <span className="file-drop-zone__text">
                                            {isDragging ? 'Drop your files here' : 'Drag and drop your files here'}
                                        </span>
                                        <span className="file-drop-zone__hint">or click to browse</span>
                                        <span className="file-drop-zone__formats">{formatsHint}</span>
                                    </>
                                )}
                            </div>

                            {error && <span className="error text-danger d-block mt-1">{error}</span>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderFooter = () => (
        <div className="modal-footer">
            <button
                type="button"
                className="btn btn-outline"
                onClick={() => closeModal(null)}
                disabled={isUploading}
            >
                Close
            </button>
            <button
                type="button"
                className="btn btn-primary"
                disabled={isUploading}
                onClick={async () => {
                    if (!selectedFiles.length) {
                        setError('Please select at least one file');
                        return;
                    }

                    setIsUploading(true);
                    setError('');
                    try {
                        await onUploadComplete?.(selectedFiles);
                        closeModal(null);
                    } catch (err) {
                        setIsUploading(false);
                        setError(err?.response?.data?.message || err?.message || 'Upload failed. Please try again.');
                    }
                }}
            >
                {isUploading ? 'Uploading...' : 'Upload'}
            </button>
        </div>
    );

    return (
        <CustomModal
            className="invoice-modal-sm"
            dialgName="modal-dialog modal-dialog-centered modal-lg"
            show={show}
            closeModal={() => closeModal(null)}
            body={renderBody()}
            footer={renderFooter()}
            header={renderHeader()}
        />
    );
}

export default UploadInvoiceModal;
