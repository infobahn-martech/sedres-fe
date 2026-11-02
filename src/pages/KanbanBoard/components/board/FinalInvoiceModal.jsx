import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiExternalLink,
  FiRotateCcw,
  FiX,
  FiZoomIn,
  FiZoomOut,
} from "react-icons/fi";
import CustomModal from "@/components/CustomModal";
import useFinalInvoiceStore, { getPageKey } from "@/store/finalInvoiceStore";
import { notify } from "@/components/Toaster";
import { downloadRemoteFile } from "@/shared/utils/utils";
import FinalInvoicePageCanvas from "./FinalInvoicePageCanvas";
import "@/design/scss/blockers-modal.scss";
import "@/design/scss/pages/kanban-board/seReviewMoveModal.scss";
import "@/design/scss/pages/kanban-board/finalInvoiceModal.scss";

GlobalWorkerOptions.workerSrc = pdfWorker;

const THUMBNAIL_SCALE = 0.3;
const THUMBNAIL_SIZE_MIN = 1;
const THUMBNAIL_SIZE_MAX = 3;
const THUMBNAIL_SIZE_DEFAULT = 2;
const BADGE_COLOR_COUNT = 4;

/* The badge names the kind of source: "invoice_390" is an INV, "package" a PKG. */
const SOURCE_BADGE_LABELS = { invoice: "INV", package: "PKG" };

const getBadgeLabel = (source) => {
  const kind = String(source).split("_")[0];
  return SOURCE_BADGE_LABELS[kind] ?? kind.toUpperCase();
};

const stripPdfExtension = (name) => String(name ?? "").replace(/\.pdf$/i, "");

// Opened from the Default DA workflow's "AR Invoice Issued" column "Arrange invoice pages" button for the
// one ticked card. A Thumbnail panel on the left lists every page of the card's documents, which the user
// drags into order (several at once with Shift/Ctrl-click) or moves to the removed tray; the page clicked
// there is shown large on the right. Save sends the order and the backend builds the final invoice PDF.
const FinalInvoiceModal = ({ onSaved }) => {
  const show = useFinalInvoiceStore((state) => state.showFinalInvoiceModal);
  const card = useFinalInvoiceStore((state) => state.selectedFinalInvoiceCard);
  const sources = useFinalInvoiceStore((state) => state.finalInvoiceSources);
  const pages = useFinalInvoiceStore((state) => state.finalInvoicePages);
  const removedPages = useFinalInvoiceStore((state) => state.removedFinalInvoicePages);
  const isLoading = useFinalInvoiceStore((state) => state.isLoadingFinalInvoicePages);
  const isSaving = useFinalInvoiceStore((state) => state.isSavingFinalInvoice);
  const onClose = useFinalInvoiceStore((state) => state.closeFinalInvoiceModal);
  const movePages = useFinalInvoiceStore((state) => state.movePages);
  const removePages = useFinalInvoiceStore((state) => state.removePages);
  const resetPages = useFinalInvoiceStore((state) => state.resetPages);
  const saveFinalInvoice = useFinalInvoiceStore((state) => state.saveFinalInvoice);

  const [pdfBySource, setPdfBySource] = useState({});
  const [isPdfLoadSettled, setIsPdfLoadSettled] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [highlightedSource, setHighlightedSource] = useState(null);
  const [viewKey, setViewKey] = useState(null);
  const [thumbnailSize, setThumbnailSize] = useState(THUMBNAIL_SIZE_DEFAULT);
  const [dropIndex, setDropIndex] = useState(null);
  const [moveToPosition, setMoveToPosition] = useState("");
  const dragKeysRef = useRef([]);
  const lastClickedKeyRef = useRef(null);

  useEffect(() => {
    if (!show) {
      setSelectedKeys([]);
      setHighlightedSource(null);
      setViewKey(null);
      setDropIndex(null);
      setMoveToPosition("");
    }
  }, [show]);

  /* Each source PDF is loaded once for the thumbnails and kept by its source key. A source that cannot be
     fetched (the file host sends no CORS header) shows its thumbnails through the browser's own PDF viewer
     instead (see renderThumbnail); the large page on the right is that viewer too. */
  useEffect(() => {
    setIsPdfLoadSettled(false);
    if (!sources.length) {
      setPdfBySource({});
      return undefined;
    }
    let isCancelled = false;
    const tasks = sources.map((source) => getDocument({ url: source.url }));
    Promise.allSettled(tasks.map((task) => task.promise)).then((results) => {
      if (isCancelled) return;
      setPdfBySource(
        Object.fromEntries(
          sources.map((source, index) => [source.source, results[index].value]).filter(([, pdf]) => pdf)
        )
      );
      setIsPdfLoadSettled(true);
    });
    return () => {
      isCancelled = true;
      tasks.forEach((task) => task.destroy());
    };
  }, [sources]);

  const sourceIndexByKey = Object.fromEntries(sources.map((source, index) => [source.source, index]));
  const invoiceNames = sources
    .filter((source) => getBadgeLabel(source.source) === SOURCE_BADGE_LABELS.invoice)
    .map((source) => stripPdfExtension(source.name));

  /* The page shown large: the last one clicked, or the first one until a page is clicked. */
  const viewIndex = Math.max(
    0,
    pages.findIndex((page) => getPageKey(page) === viewKey)
  );
  const viewPage = pages[viewIndex] ?? null;
  const viewSource = viewPage ? sources.find((source) => source.source === viewPage.source) : null;

  const handlePageClick = (event, page, index) => {
    const key = getPageKey(page);
    if (event.shiftKey && lastClickedKeyRef.current) {
      const lastIndex = pages.findIndex((item) => getPageKey(item) === lastClickedKeyRef.current);
      if (lastIndex >= 0) {
        const [from, to] = lastIndex < index ? [lastIndex, index] : [index, lastIndex];
        setSelectedKeys(pages.slice(from, to + 1).map(getPageKey));
        return;
      }
    }
    lastClickedKeyRef.current = key;
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
      return;
    }
    setSelectedKeys([key]);
    setViewKey(key);
  };

  const handleDragStart = (event, key) => {
    /* Dragging a selected page carries the whole selection; any other page drags alone. */
    dragKeysRef.current = selectedKeys.includes(key) ? selectedKeys : [key];
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", dragKeysRef.current.join(","));
  };

  const handleDragEnd = () => {
    dragKeysRef.current = [];
    setDropIndex(null);
  };

  const handleItemDragOver = (event, index) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    setDropIndex(event.clientY > rect.top + rect.height / 2 ? index + 1 : index);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    if (dragKeysRef.current.length && dropIndex != null) {
      movePages(dragKeysRef.current, dropIndex);
      setSelectedKeys(dragKeysRef.current);
    }
    handleDragEnd();
  };

  const stepSelected = (delta) => {
    if (!selectedKeys.length) return;
    const firstIndex = pages.findIndex((page) => selectedKeys.includes(getPageKey(page)));
    const target = Math.max(0, Math.min(firstIndex + delta, pages.length - selectedKeys.length));
    movePages(selectedKeys, target);
  };

  const handleMoveToPosition = () => {
    const position = Number(moveToPosition);
    if (!selectedKeys.length || !Number.isInteger(position) || position < 1) return;
    movePages(selectedKeys, Math.min(position - 1, pages.length));
    setMoveToPosition("");
  };

  const handleRemove = (keys) => {
    removePages(keys);
    setSelectedKeys((prev) => prev.filter((key) => !keys.includes(key)));
  };

  /* The saved PDF opens in a new tab by itself. The tab is opened here, inside the click, because a browser
     blocks a tab opened only after the (slow) save has finished; it is pointed at the PDF once saved. */
  const handleSave = async () => {
    if (isSaving || !pages.length) return;
    const pdfTab = window.open("", "_blank");
    const { errorMessage, result } = await saveFinalInvoice();
    if (errorMessage) {
      pdfTab?.close();
      notify(errorMessage, "error");
      return;
    }
    const pdfUrl = result?.document?.url;
    if (pdfTab && pdfUrl) pdfTab.location.href = pdfUrl;
    else if (pdfUrl) window.open(pdfUrl, "_blank");
    else pdfTab?.close();
    notify(`Invoice PDF saved (${result?.page_count} pages)`, "success");
    /* A PDF over the size limit also comes as a ZIP, with a warning saying why. */
    if (result?.zip?.url) {
      if (result.warnings?.[0]) notify(result.warnings[0], "warn");
      downloadRemoteFile({ url: result.zip.url, name: result.zip.name });
    }
    onSaved?.();
  };

  const stepView = (delta) => {
    const next = pages[viewIndex + delta];
    if (next) setViewKey(getPageKey(next));
  };

  const renderBadge = (page) => (
    <span
      className={`final-invoice__badge final-invoice__badge--${(sourceIndexByKey[page.source] ?? 0) % BADGE_COLOR_COUNT}`}
    >
      {getBadgeLabel(page.source)} p{page.page}
    </span>
  );

  const renderSources = () => (
    <>
      <h6 className="final-invoice__sidebar-title">Sources</h6>
      {sources.map((source, index) => (
        <div
          key={source.source}
          className={`final-invoice__source ${highlightedSource === source.source ? "final-invoice__source--active" : ""}`}
          onClick={() => setHighlightedSource((prev) => (prev === source.source ? null : source.source))}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => event.key === "Enter" && setHighlightedSource(source.source)}
        >
          <span className={`final-invoice__swatch final-invoice__badge--${index % BADGE_COLOR_COUNT}`} />
          <span className="final-invoice__source-text">
            <span className="final-invoice__source-name">{source.name}</span>
            <span className="final-invoice__source-meta">
              {source.page_count} {source.page_count === 1 ? "page" : "pages"}
            </span>
          </span>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="final-invoice__source-link"
            onClick={(event) => event.stopPropagation()}
            aria-label={`Open original ${source.name}`}
            title="Open original"
          >
            <FiExternalLink size={14} />
          </a>
        </div>
      ))}
    </>
  );

  /* pdf.js draws the thumbnail; for a source it could not load, a lazy embedded view of that page stands in
     (the frame ignores the pointer, so clicking and dragging still reach the thumbnail). */
  const renderThumbnail = (page) => {
    const pdf = pdfBySource[page.source];
    if (pdf) {
      return (
        <FinalInvoicePageCanvas
          pdf={pdf}
          pageNumber={page.page}
          scale={THUMBNAIL_SCALE}
          lazy
          className="final-invoice__thumb"
        />
      );
    }
    const source = sources.find((item) => item.source === page.source);
    return (
      <div className="final-invoice__thumb final-invoice__thumb-frame">
        {isPdfLoadSettled && source && (
          <iframe
            loading="lazy"
            src={`${source.url}#page=${page.page}&view=Fit&toolbar=0&navpanes=0&scrollbar=0`}
            title={`${source.name} page ${page.page}`}
            tabIndex={-1}
          />
        )}
      </div>
    );
  };

  const renderThumbnails = () => (
    <div
      className="final-invoice__thumbs"
      onDragOver={(event) => {
        event.preventDefault();
        if (event.target === event.currentTarget) setDropIndex(pages.length);
      }}
      onDrop={handleDrop}
    >
      {pages.map((page, index) => {
        const key = getPageKey(page);
        const isDimmed = highlightedSource && highlightedSource !== page.source;
        return (
          <div
            key={key}
            draggable={!isSaving}
            className={[
              "final-invoice__page",
              selectedKeys.includes(key) && "final-invoice__page--selected",
              index === viewIndex && "final-invoice__page--viewing",
              isDimmed && "final-invoice__page--dimmed",
              dropIndex === index && "final-invoice__page--drop-before",
              dropIndex === index + 1 && index === pages.length - 1 && "final-invoice__page--drop-after",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={(event) => handlePageClick(event, page, index)}
            onDragStart={(event) => handleDragStart(event, key)}
            onDragEnd={handleDragEnd}
            onDragOver={(event) => handleItemDragOver(event, index)}
          >
            {renderThumbnail(page)}
            <div className="final-invoice__page-foot">
              <span className="final-invoice__position">{index + 1}</span>
              {renderBadge(page)}
            </div>
            <button
              type="button"
              className="final-invoice__remove"
              onClick={(event) => {
                event.stopPropagation();
                handleRemove([key]);
              }}
              disabled={isSaving}
              aria-label={`Remove page ${index + 1}`}
            >
              <FiX size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );

  const renderRemoved = () => (
    <>
      <h6 className="final-invoice__sidebar-title">Removed ({removedPages.length})</h6>
      <div className="final-invoice__removed">
        {removedPages.map((page) => (
          <button
            key={getPageKey(page)}
            type="button"
            draggable
            className="final-invoice__removed-chip"
            onDragStart={(event) => handleDragStart(event, getPageKey(page))}
            onDragEnd={handleDragEnd}
            onClick={() => movePages([getPageKey(page)], pages.length)}
            title="Click to restore at the end, or drag it back into the list"
          >
            {renderBadge(page)}
            <FiRotateCcw size={12} aria-hidden />
          </button>
        ))}
      </div>
    </>
  );

  const renderSidebar = () => (
    <aside className="final-invoice__sidebar">
      <div className="final-invoice__thumb-head">
        <h6 className="final-invoice__sidebar-title">Thumbnail</h6>
        <div className="final-invoice__thumb-zoom">
          <FiZoomOut size={14} aria-hidden />
          <input
            type="range"
            min={THUMBNAIL_SIZE_MIN}
            max={THUMBNAIL_SIZE_MAX}
            value={thumbnailSize}
            onChange={(event) => setThumbnailSize(Number(event.target.value))}
            aria-label="Thumbnail size"
          />
          <FiZoomIn size={14} aria-hidden />
        </div>
      </div>
      <div className={`final-invoice__thumb-list final-invoice__thumb-list--size-${thumbnailSize}`}>
        {renderThumbnails()}
      </div>
      {renderRemoved()}
      {renderSources()}
    </aside>
  );

  const renderToolbar = () => (
    <div className="final-invoice__toolbar">
      <span className="final-invoice__total">Total: {pages.length} pages</span>
      <span className="final-invoice__selection">
        {selectedKeys.length ? `${selectedKeys.length} selected` : "Ctrl/Shift-click to select several pages"}
      </span>
      <button
        type="button"
        className="btn btn-outline"
        onClick={() => stepSelected(-1)}
        disabled={!selectedKeys.length || isSaving}
        aria-label="Move selected pages earlier"
      >
        <FiChevronLeft />
      </button>
      <button
        type="button"
        className="btn btn-outline"
        onClick={() => stepSelected(1)}
        disabled={!selectedKeys.length || isSaving}
        aria-label="Move selected pages later"
      >
        <FiChevronRight />
      </button>
      <input
        type="number"
        min={1}
        max={pages.length}
        className="form-control final-invoice__position-input"
        placeholder="Move to position"
        value={moveToPosition}
        onChange={(event) => setMoveToPosition(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && handleMoveToPosition()}
        disabled={!selectedKeys.length || isSaving}
      />
      <button
        type="button"
        className="btn btn-outline"
        onClick={handleMoveToPosition}
        disabled={!selectedKeys.length || !moveToPosition || isSaving}
      >
        Move
      </button>
      <button
        type="button"
        className="btn btn-outline"
        onClick={() => handleRemove(selectedKeys)}
        disabled={!selectedKeys.length || isSaving}
      >
        Remove selected
      </button>
      <div className="final-invoice__toolbar-end">
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
          <FiCheck className="me-2" />
          {isSaving ? "Saving..." : "Save PDF"}
        </button>
      </div>
    </div>
  );

  const renderViewer = () => {
    if (!viewPage || !viewSource) return <div className="final-invoice__state">No pages</div>;
    const viewerUrl = `${viewSource.url}#page=${viewPage.page}&view=FitH&pagemode=none&navpanes=0&toolbar=0`;
    return (
      <div className="final-invoice__viewer">
        <div className="final-invoice__viewer-bar">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => stepView(-1)}
            disabled={viewIndex === 0}
            aria-label="Previous page"
          >
            <FiChevronLeft />
          </button>
          <span className="final-invoice__viewer-title">
            Page {viewIndex + 1} of {pages.length} {renderBadge(viewPage)}
          </span>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => stepView(1)}
            disabled={viewIndex === pages.length - 1}
            aria-label="Next page"
          >
            <FiChevronRight />
          </button>
        </div>
        {/* The browser's own PDF viewer shows the source file at this page (its side panel and toolbar are off,
            the thumbnails are ours); it needs no CORS header. */}
        <iframe
          key={viewerUrl}
          src={viewerUrl}
          title={`${viewSource.name} page ${viewPage.page}`}
          className="final-invoice__viewer-frame"
        />
      </div>
    );
  };

  const renderBody = () => {
    if (isLoading) return <div className="final-invoice__state">Loading pages...</div>;
    return (
      <div className="final-invoice__editor">
        {renderSidebar()}
        <section className="final-invoice__main">
          {renderToolbar()}
          {renderViewer()}
        </section>
        {isSaving && (
          <div className="final-invoice__busy">
            <div className="spinner-border text-primary" role="status" aria-hidden />
            <p>Building invoice PDF...</p>
          </div>
        )}
      </div>
    );
  };

  const renderHeader = () => (
    <div className="blockers-modal-header">
      <div className="blockers-modal-header-text">
        <h5 className="blockers-modal-title">Arrange invoice pages</h5>
        <p className="blockers-modal-subtitle">
          {card ? `Call ${card.call_id} · Card ${card.card_id}` : ""}
          {invoiceNames.length ? ` · Invoice ${invoiceNames.join(", ")}` : ""}
        </p>
      </div>
      <button type="button" className="blockers-modal-close" onClick={onClose} disabled={isSaving} aria-label="Close">
        <FiX size={20} />
      </button>
    </div>
  );

  return (
    <CustomModal
        show={show}
        closeModal={onClose}
        className="blockers-modal se-review-move-modal final-invoice-modal"
        backdropClassName="blockers-modal-backdrop"
        createModal
        bodyClassname="blockers-modal-body"
        header={renderHeader()}
        body={renderBody()}
      />
  );
};

FinalInvoiceModal.propTypes = {
  onSaved: PropTypes.func,
};

export default FinalInvoiceModal;
