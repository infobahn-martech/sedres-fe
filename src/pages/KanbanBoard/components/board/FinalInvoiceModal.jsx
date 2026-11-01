import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiExternalLink,
  FiMaximize2,
  FiRotateCcw,
  FiSave,
  FiX,
  FiZoomIn,
  FiZoomOut,
} from "react-icons/fi";
import CustomModal from "@/components/CustomModal";
import useFinalInvoiceStore, { getPageKey } from "@/store/finalInvoiceStore";
import { notify } from "@/components/Toaster";
import { downloadRemoteFile } from "@/shared/utils/utils";
import "@/design/scss/blockers-modal.scss";
import "@/design/scss/pages/kanban-board/seReviewMoveModal.scss";
import "@/design/scss/pages/kanban-board/finalInvoiceModal.scss";

GlobalWorkerOptions.workerSrc = pdfWorker;

const THUMBNAIL_SCALE = 0.25;
const PREVIEW_BASE_SCALE = 1.25;
const PREVIEW_MIN_ZOOM = 0.5;
const PREVIEW_MAX_ZOOM = 3;
const PREVIEW_ZOOM_STEP = 0.25;
const SOURCE_COLOR_COUNT = 6;
const INVOICE_SOURCE_PATTERN = /^invoice_/;
const PACKAGE_SOURCE = "package";
const DRAG_DATA_TYPE = "text/plain";
const DRAG_ORIGIN_GRID = "grid";
const DRAG_ORIGIN_REMOVED = "removed";

/* "INV p2" / "PKG p7": which source file a page came from and its original page number. */
const getPageBadge = (page) => {
  if (page.source === PACKAGE_SOURCE) return `PKG p${page.page}`;
  if (INVOICE_SOURCE_PATTERN.test(page.source)) return `INV p${page.page}`;
  return `${page.source} p${page.page}`;
};

// One page of a source PDF drawn on a canvas; it renders only once it scrolls into view.
const PageThumbnail = ({ pdf, pageNumber, isPdfLoading }) => {
  const canvasRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pdf || !isVisible) return undefined;
    let renderTask;
    let isCancelled = false;
    pdf.getPage(pageNumber).then((page) => {
      if (isCancelled || !canvasRef.current) return;
      const viewport = page.getViewport({ scale: THUMBNAIL_SCALE });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      renderTask = page.render({ canvasContext: canvas.getContext("2d"), viewport });
      renderTask.promise.catch(() => {});
    });
    return () => {
      isCancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber, isVisible]);

  return (
    <div className="final-invoice__thumb-wrap">
      <canvas ref={canvasRef} className="final-invoice__thumb" />
      {!pdf && (
        <span className="final-invoice__thumb-empty">{isPdfLoading ? "Loading..." : "No preview"}</span>
      )}
    </div>
  );
};

PageThumbnail.propTypes = {
  pdf: PropTypes.object,
  pageNumber: PropTypes.number.isRequired,
  isPdfLoading: PropTypes.bool,
};

// One page drawn large for the preview, at the chosen zoom.
const PreviewPage = ({ pdf, pageNumber, zoom }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!pdf) return undefined;
    let renderTask;
    let isCancelled = false;
    pdf.getPage(pageNumber).then((page) => {
      if (isCancelled || !canvasRef.current) return;
      const viewport = page.getViewport({ scale: PREVIEW_BASE_SCALE * zoom });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      renderTask = page.render({ canvasContext: canvas.getContext("2d"), viewport });
      renderTask.promise.catch(() => {});
    });
    return () => {
      isCancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber, zoom]);

  if (!pdf) return <span className="final-invoice__preview-empty">No preview</span>;
  return <canvas ref={canvasRef} className="final-invoice__preview-canvas" />;
};

PreviewPage.propTypes = {
  pdf: PropTypes.object,
  pageNumber: PropTypes.number.isRequired,
  zoom: PropTypes.number.isRequired,
};

// Opened from the Default DA workflow's "AR Invoice Issued" column "Arrange invoice pages" button for the
// one ticked card. The pages of the card's documents are dragged into order (or moved to the Removed tray);
// Save builds the final invoice and moves the card on, then the result popup offers the downloads.
const FinalInvoiceModal = ({ onSaved }) => {
  const show = useFinalInvoiceStore((state) => state.showFinalInvoiceModal);
  const card = useFinalInvoiceStore((state) => state.selectedFinalInvoiceCard);
  const sources = useFinalInvoiceStore((state) => state.finalInvoiceSources);
  const pages = useFinalInvoiceStore((state) => state.finalInvoicePages);
  const removedPages = useFinalInvoiceStore((state) => state.finalInvoiceRemovedPages);
  const saved = useFinalInvoiceStore((state) => state.savedFinalInvoice);
  const isLoading = useFinalInvoiceStore((state) => state.isLoadingFinalInvoicePages);
  const isSaving = useFinalInvoiceStore((state) => state.isSavingFinalInvoice);
  const onClose = useFinalInvoiceStore((state) => state.closeFinalInvoiceModal);
  const movePagesBefore = useFinalInvoiceStore((state) => state.movePagesBefore);
  const movePagesToPosition = useFinalInvoiceStore((state) => state.movePagesToPosition);
  const shiftPages = useFinalInvoiceStore((state) => state.shiftPages);
  const removePages = useFinalInvoiceStore((state) => state.removePages);
  const restorePages = useFinalInvoiceStore((state) => state.restorePages);
  const resetPages = useFinalInvoiceStore((state) => state.resetPages);
  const saveFinalInvoice = useFinalInvoiceStore((state) => state.saveFinalInvoice);

  const [pdfBySource, setPdfBySource] = useState({});
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [lastClickedKey, setLastClickedKey] = useState(null);
  const [highlightedSource, setHighlightedSource] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [previewIndex, setPreviewIndex] = useState(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [targetPosition, setTargetPosition] = useState("");
  const dragRef = useRef({ origin: null, keys: [] });

  const isEditorOpen = show && !saved;

  useEffect(() => {
    if (!sources.length) {
      setPdfBySource({});
      return undefined;
    }
    let isCancelled = false;
    setIsPdfLoading(true);
    const tasks = sources.map((source) => getDocument({ url: source.url }));
    /* A source that cannot be fetched (the file host sends no CORS header) only loses its thumbnails; the
       pages can still be arranged and saved. */
    Promise.allSettled(tasks.map((task) => task.promise)).then((results) => {
      if (isCancelled) return;
      setIsPdfLoading(false);
      setPdfBySource(
        Object.fromEntries(
          sources
            .map((source, index) => [source.source, results[index].value])
            .filter(([, pdf]) => pdf)
        )
      );
    });
    return () => {
      isCancelled = true;
      tasks.forEach((task) => task.destroy());
    };
  }, [sources]);

  useEffect(() => {
    if (!isEditorOpen) {
      setSelectedKeys([]);
      setLastClickedKey(null);
      setHighlightedSource(null);
      setPreviewIndex(null);
      setTargetPosition("");
    }
  }, [isEditorOpen]);

  useEffect(() => {
    const pageKeys = new Set(pages.map(getPageKey));
    setSelectedKeys((keys) => keys.filter((key) => pageKeys.has(key)));
  }, [pages]);

  useEffect(() => {
    if (previewIndex == null) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setPreviewIndex(null);
      if (event.key === "ArrowLeft") setPreviewIndex((index) => Math.max(0, index - 1));
      if (event.key === "ArrowRight") setPreviewIndex((index) => Math.min(pages.length - 1, index + 1));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewIndex, pages.length]);

  const sourceColorByKey = useMemo(
    () => Object.fromEntries(sources.map((source, index) => [source.source, index % SOURCE_COLOR_COUNT])),
    [sources]
  );

  const invoiceName = sources.find((source) => INVOICE_SOURCE_PATTERN.test(source.source))?.name;

  const selectedSet = new Set(selectedKeys);
  const hasSelection = selectedKeys.length > 0;

  const handlePageClick = (event, page, index) => {
    const key = getPageKey(page);
    if (event.shiftKey && lastClickedKey) {
      const anchorIndex = pages.findIndex((item) => getPageKey(item) === lastClickedKey);
      if (anchorIndex !== -1) {
        const [from, to] = anchorIndex < index ? [anchorIndex, index] : [index, anchorIndex];
        setSelectedKeys(pages.slice(from, to + 1).map(getPageKey));
        return;
      }
    }
    setLastClickedKey(key);
    if (event.ctrlKey || event.metaKey) {
      setSelectedKeys((keys) => (keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key]));
    } else {
      setSelectedKeys([key]);
    }
  };

  const handleSourceClick = (sourceKey) => {
    const isSame = highlightedSource === sourceKey;
    setHighlightedSource(isSame ? null : sourceKey);
    setSelectedKeys(isSame ? [] : pages.filter((page) => page.source === sourceKey).map(getPageKey));
  };

  const handleDragStart = (event, origin, page) => {
    const key = getPageKey(page);
    const keys = origin === DRAG_ORIGIN_GRID && selectedSet.has(key) ? selectedKeys : [key];
    if (origin === DRAG_ORIGIN_GRID && !selectedSet.has(key)) setSelectedKeys([key]);
    dragRef.current = { origin, keys };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(DRAG_DATA_TYPE, keys.join(","));
  };

  const handleDragEnd = () => {
    dragRef.current = { origin: null, keys: [] };
    setDropTarget(null);
  };

  const handleItemDragOver = (event, page) => {
    if (!dragRef.current.origin) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const isAfter = event.clientX > rect.left + rect.width / 2;
    setDropTarget({ key: getPageKey(page), isAfter });
  };

  const dropOnGrid = (beforeKey) => {
    const { origin, keys } = dragRef.current;
    if (origin === DRAG_ORIGIN_GRID) movePagesBefore(keys, beforeKey);
    if (origin === DRAG_ORIGIN_REMOVED) restorePages(keys, beforeKey);
    handleDragEnd();
  };

  const handleItemDrop = (event, page, index) => {
    event.preventDefault();
    event.stopPropagation();
    const isAfter = dropTarget?.key === getPageKey(page) && dropTarget.isAfter;
    dropOnGrid(isAfter ? (pages[index + 1] ? getPageKey(pages[index + 1]) : null) : getPageKey(page));
  };

  const handleGridDrop = (event) => {
    event.preventDefault();
    dropOnGrid(null);
  };

  const handleTrayDrop = (event) => {
    event.preventDefault();
    const { origin, keys } = dragRef.current;
    if (origin === DRAG_ORIGIN_GRID) removePages(keys);
    handleDragEnd();
  };

  const allowDrop = (event) => {
    if (dragRef.current.origin) event.preventDefault();
  };

  const handleMoveToPosition = () => {
    const position = Number(targetPosition);
    if (!hasSelection || !Number.isInteger(position) || position < 1) return;
    movePagesToPosition(selectedKeys, position);
  };

  const openPreview = (index) => {
    setPreviewZoom(1);
    setPreviewIndex(index);
  };

  const handleSave = async () => {
    if (isSaving || !pages.length) return;
    const { errorMessage, result } = await saveFinalInvoice();
    if (errorMessage) {
      notify(errorMessage, "error");
      return;
    }
    notify(`Invoice PDF saved (${result?.page_count ?? pages.length} pages)`, "success");
    onSaved?.();
  };

  const renderPageThumb = (page, index, origin) => {
    const key = getPageKey(page);
    const isGrid = origin === DRAG_ORIGIN_GRID;
    const isSelected = isGrid && selectedSet.has(key);
    const isHighlighted = isGrid && highlightedSource === page.source;
    const dropClass =
      isGrid && dropTarget?.key === key ? (dropTarget.isAfter ? "final-invoice__item--drop-after" : "final-invoice__item--drop-before") : "";
    return (
      <div
        key={key}
        className={`final-invoice__item ${isSelected ? "final-invoice__item--selected" : ""} ${
          isHighlighted ? "final-invoice__item--highlighted" : ""
        } ${dropClass}`}
        draggable={!isSaving}
        onDragStart={(event) => handleDragStart(event, origin, page)}
        onDragEnd={handleDragEnd}
        onDragOver={isGrid ? (event) => handleItemDragOver(event, page) : undefined}
        onDrop={isGrid ? (event) => handleItemDrop(event, page, index) : undefined}
        onClick={isGrid ? (event) => handlePageClick(event, page, index) : undefined}
        onDoubleClick={isGrid ? () => openPreview(index) : undefined}
      >
        <PageThumbnail pdf={pdfBySource[page.source]} pageNumber={page.page} isPdfLoading={isPdfLoading} />
        {isGrid && <span className="final-invoice__position">{index + 1}</span>}
        <span className={`final-invoice__badge final-invoice__badge--c${sourceColorByKey[page.source] ?? 0}`}>
          {getPageBadge(page)}
        </span>
        {isGrid ? (
          <span className="final-invoice__item-actions">
            <button
              type="button"
              className="final-invoice__icon-btn"
              onClick={(event) => {
                event.stopPropagation();
                openPreview(index);
              }}
              aria-label={`Preview page ${index + 1}`}
            >
              <FiMaximize2 size={14} />
            </button>
            <button
              type="button"
              className="final-invoice__icon-btn"
              onClick={(event) => {
                event.stopPropagation();
                removePages([key]);
              }}
              disabled={isSaving}
              aria-label={`Remove page ${index + 1}`}
            >
              <FiX size={14} />
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="final-invoice__restore"
            onClick={() => restorePages([key])}
            disabled={isSaving}
            aria-label={`Restore ${getPageBadge(page)}`}
          >
            <FiRotateCcw size={14} />
          </button>
        )}
      </div>
    );
  };

  const renderPreview = () => {
    if (previewIndex == null || !pages[previewIndex]) return null;
    const page = pages[previewIndex];
    return (
      <div className="final-invoice__preview">
        <div className="final-invoice__preview-bar">
          <span className={`final-invoice__badge final-invoice__badge--c${sourceColorByKey[page.source] ?? 0}`}>
            {getPageBadge(page)}
          </span>
          <span className="final-invoice__preview-title">
            Page {previewIndex + 1} of {pages.length}
          </span>
          <button
            type="button"
            className="final-invoice__icon-btn"
            onClick={() => setPreviewIndex((index) => Math.max(0, index - 1))}
            disabled={previewIndex === 0}
            aria-label="Previous page"
          >
            <FiChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="final-invoice__icon-btn"
            onClick={() => setPreviewIndex((index) => Math.min(pages.length - 1, index + 1))}
            disabled={previewIndex === pages.length - 1}
            aria-label="Next page"
          >
            <FiChevronRight size={18} />
          </button>
          <button
            type="button"
            className="final-invoice__icon-btn"
            onClick={() => setPreviewZoom((zoom) => Math.max(PREVIEW_MIN_ZOOM, zoom - PREVIEW_ZOOM_STEP))}
            disabled={previewZoom <= PREVIEW_MIN_ZOOM}
            aria-label="Zoom out"
          >
            <FiZoomOut size={18} />
          </button>
          <button
            type="button"
            className="final-invoice__icon-btn"
            onClick={() => setPreviewZoom((zoom) => Math.min(PREVIEW_MAX_ZOOM, zoom + PREVIEW_ZOOM_STEP))}
            disabled={previewZoom >= PREVIEW_MAX_ZOOM}
            aria-label="Zoom in"
          >
            <FiZoomIn size={18} />
          </button>
          <button type="button" className="final-invoice__icon-btn" onClick={() => setPreviewIndex(null)} aria-label="Close preview">
            <FiX size={18} />
          </button>
        </div>
        <div className="final-invoice__preview-body">
          <PreviewPage pdf={pdfBySource[page.source]} pageNumber={page.page} zoom={previewZoom} />
        </div>
      </div>
    );
  };

  const renderSourcesPanel = () => (
    <aside className="final-invoice__sidebar">
      <h6 className="final-invoice__sidebar-title">Sources</h6>
      {sources.map((source) => (
        <div
          key={source.source}
          className={`final-invoice__source ${highlightedSource === source.source ? "final-invoice__source--active" : ""}`}
        >
          <button type="button" className="final-invoice__source-main" onClick={() => handleSourceClick(source.source)}>
            <span className={`final-invoice__swatch final-invoice__badge--c${sourceColorByKey[source.source] ?? 0}`} />
            <span className="final-invoice__source-text">
              <span className="final-invoice__source-name">{source.name}</span>
              <span className="final-invoice__source-meta">
                {source.page_count} {source.page_count === 1 ? "page" : "pages"}
              </span>
            </span>
          </button>
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="final-invoice__source-open">
            <FiExternalLink size={13} /> Open original
          </a>
        </div>
      ))}
      <h6
        className="final-invoice__sidebar-title"
        onDragOver={allowDrop}
        onDrop={handleTrayDrop}
      >
        Removed ({removedPages.length})
      </h6>
      <div className="final-invoice__tray" onDragOver={allowDrop} onDrop={handleTrayDrop}>
        {removedPages.length === 0 && <span className="final-invoice__tray-empty">No removed pages</span>}
        {removedPages.map((page, index) => renderPageThumb(page, index, DRAG_ORIGIN_REMOVED))}
      </div>
    </aside>
  );

  const renderBody = () => {
    if (isLoading) {
      return (
        <div className="final-invoice__state">
          <div className="spinner-border" role="status" aria-label="Loading pages" />
          <p>Loading pages...</p>
        </div>
      );
    }
    return (
      <div className="final-invoice__layout">
        {renderSourcesPanel()}
        <section className="final-invoice__main">
          <div className="final-invoice__toolbar">
            <span className="final-invoice__total">Total: {pages.length} {pages.length === 1 ? "page" : "pages"}</span>
            <span className="final-invoice__toolbar-group">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => shiftPages(selectedKeys, -1)}
                disabled={!hasSelection || isSaving}
                aria-label="Move selected pages earlier"
              >
                <FiChevronLeft />
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => shiftPages(selectedKeys, 1)}
                disabled={!hasSelection || isSaving}
                aria-label="Move selected pages later"
              >
                <FiChevronRight />
              </button>
              <input
                type="number"
                min="1"
                max={pages.length}
                className="form-control final-invoice__position-input"
                placeholder="Position"
                value={targetPosition}
                onChange={(event) => setTargetPosition(event.target.value)}
                disabled={!hasSelection || isSaving}
              />
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleMoveToPosition}
                disabled={!hasSelection || !targetPosition || isSaving}
              >
                Move to position
              </button>
            </span>
            <span className="final-invoice__hint">Click to select, Ctrl/Shift-click for several, double-click to preview, drag to reorder</span>
            <span className="final-invoice__toolbar-group final-invoice__toolbar-actions">
            <button type="button" className="btn btn-outline" onClick={resetPages} disabled={isLoading || isSaving}>
              <FiRotateCcw className="me-2" />
              Reset
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={isLoading || isSaving || !pages.length || !card}
            >
              <FiSave className="me-2" />
              Save PDF
            </button>
            </span>
          </div>
          {pages.length === 0 ? (
            <div className="final-invoice__state" onDragOver={allowDrop} onDrop={handleGridDrop}>
              No pages
            </div>
          ) : (
            <div className="final-invoice__grid" onDragOver={allowDrop} onDrop={handleGridDrop}>
              {pages.map((page, index) => renderPageThumb(page, index, DRAG_ORIGIN_GRID))}
            </div>
          )}
        </section>
        {renderPreview()}
        {isSaving && (
          <div className="final-invoice__blocker" role="alert" aria-live="assertive">
            <div className="spinner-border" role="status" />
            <p>Building invoice PDF...</p>
          </div>
        )}
      </div>
    );
  };

  const renderHeader = () => (
    <div className="blockers-modal-header final-invoice__header">
      <div className="blockers-modal-header-text">
        <h5 className="blockers-modal-title">Arrange invoice pages</h5>
        <p className="blockers-modal-subtitle">
          {card ? `Call ${card.call_id} · Card ${card.card_id}` : ""}
          {invoiceName ? ` · Invoice ${invoiceName}` : ""}
        </p>
      </div>
      <div className="final-invoice__header-actions">
        <button type="button" className="blockers-modal-close" onClick={onClose} disabled={isSaving} aria-label="Close">
          <FiX size={20} />
        </button>
      </div>
    </div>
  );

  const renderSavedHeader = () => (
    <div className="blockers-modal-header">
      <div className="blockers-modal-header-text">
        <h5 className="blockers-modal-title">Invoice PDF saved ({saved?.page_count} pages)</h5>
        {saved?.moved?.column_name && (
          <p className="blockers-modal-subtitle">Card moved to {saved.moved.column_name}</p>
        )}
      </div>
      <button type="button" className="blockers-modal-close" onClick={onClose} aria-label="Close">
        <FiX size={20} />
      </button>
    </div>
  );

  const renderSavedBody = () => (
    <div className="final-invoice__state">
      <p className="final-invoice__saved-name">{saved?.document?.name}</p>
      {saved?.size_mb != null && <p className="final-invoice__saved-meta">{saved.size_mb} MB</p>}
      {saved?.zip && saved.warnings?.[0] && <p className="final-invoice__saved-meta">{saved.warnings[0]}</p>}
    </div>
  );

  const renderSavedFooter = () => (
    <div className="modal-footer se-review-move-footer">
      <button type="button" className="btn btn-outline" onClick={onClose}>
        Close
      </button>
      {saved?.document?.url && (
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => downloadRemoteFile({ url: saved.document.url, name: saved.document.name })}
        >
          <FiDownload className="me-2" />
          Download
        </button>
      )}
      {saved?.zip?.url && (
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => downloadRemoteFile({ url: saved.zip.url, name: saved.zip.name })}
        >
          <FiDownload className="me-2" />
          Download ZIP
        </button>
      )}
    </div>
  );

  return (
    <>
      <CustomModal
        show={isEditorOpen}
        closeModal={isSaving || previewIndex != null ? undefined : onClose}
        className="blockers-modal se-review-move-modal final-invoice-modal"
        backdropClassName="blockers-modal-backdrop"
        createModal
        disableCenter
        bodyClassname="blockers-modal-body final-invoice__modal-body"
        header={renderHeader()}
        body={renderBody()}
      />
      <CustomModal
        show={show && Boolean(saved)}
        closeModal={onClose}
        className="blockers-modal se-review-move-modal final-invoice-result-modal"
        backdropClassName="blockers-modal-backdrop"
        createModal
        bodyClassname="blockers-modal-body"
        header={renderSavedHeader()}
        body={renderSavedBody()}
        footer={renderSavedFooter()}
      />
    </>
  );
};

FinalInvoiceModal.propTypes = {
  onSaved: PropTypes.func,
};

export default FinalInvoiceModal;
