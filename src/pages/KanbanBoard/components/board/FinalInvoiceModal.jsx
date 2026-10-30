import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { FiCheck, FiDownload, FiMenu, FiX } from "react-icons/fi";
import CustomModal from "@/components/CustomModal";
import useFinalInvoiceStore from "@/store/finalInvoiceStore";
import { notify } from "@/components/Toaster";
import { downloadRemoteFile } from "@/shared/utils/utils";
import "@/design/scss/blockers-modal.scss";
import "@/design/scss/pages/kanban-board/seReviewMoveModal.scss";
import "@/design/scss/pages/kanban-board/finalInvoiceModal.scss";

GlobalWorkerOptions.workerSrc = pdfWorker;

const THUMBNAIL_WIDTH_PX = 120;

const getPageKey = (page) => `${page.source}:${page.page}`;

// One page of a source PDF drawn on a canvas.
const PageThumbnail = ({ pdf, pageNumber }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!pdf) return undefined;
    let renderTask;
    let isCancelled = false;
    pdf.getPage(pageNumber).then((page) => {
      if (isCancelled || !canvasRef.current) return;
      const baseViewport = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: THUMBNAIL_WIDTH_PX / baseViewport.width });
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
  }, [pdf, pageNumber]);

  return <canvas ref={canvasRef} className="final-invoice__thumb" />;
};

PageThumbnail.propTypes = {
  pdf: PropTypes.object,
  pageNumber: PropTypes.number.isRequired,
};

// Opened from the Default DA workflow's "AR Invoice Issued" column "Check Invoice" button for the one
// ticked card. The pages of the invoice PDF are dragged into order (or removed); Save builds the final
// invoice and moves the card on, then Download PDF (and Download ZIP when there is one) appear.
const FinalInvoiceModal = ({ onSaved }) => {
  const show = useFinalInvoiceStore((state) => state.showFinalInvoiceModal);
  const card = useFinalInvoiceStore((state) => state.selectedFinalInvoiceCard);
  const sources = useFinalInvoiceStore((state) => state.finalInvoiceSources);
  const pages = useFinalInvoiceStore((state) => state.finalInvoicePages);
  const saved = useFinalInvoiceStore((state) => state.savedFinalInvoice);
  const isLoading = useFinalInvoiceStore((state) => state.isLoadingFinalInvoicePages);
  const isSaving = useFinalInvoiceStore((state) => state.isSavingFinalInvoice);
  const onClose = useFinalInvoiceStore((state) => state.closeFinalInvoiceModal);
  const movePage = useFinalInvoiceStore((state) => state.movePage);
  const removePage = useFinalInvoiceStore((state) => state.removePage);
  const saveFinalInvoice = useFinalInvoiceStore((state) => state.saveFinalInvoice);

  const [pdfBySource, setPdfBySource] = useState({});

  useEffect(() => {
    if (!sources.length) {
      setPdfBySource({});
      return undefined;
    }
    let isCancelled = false;
    const tasks = sources.map((source) => getDocument({ url: source.url }));
    /* A source that cannot be fetched (the file host sends no CORS header) only loses its thumbnails; the
       pages can still be arranged and saved. */
    Promise.allSettled(tasks.map((task) => task.promise)).then((results) => {
      if (isCancelled) return;
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

  const sourceNameByKey = Object.fromEntries(sources.map((source) => [source.source, source.name]));

  const handleDragEnd = ({ source, destination }) => {
    if (!destination || destination.index === source.index) return;
    movePage(source.index, destination.index);
  };

  const handleSave = async () => {
    if (isSaving || !pages.length) return;
    const { errorMessage, result } = await saveFinalInvoice();
    if (errorMessage) {
      notify(errorMessage, "error");
      return;
    }
    notify("Final invoice saved", "success");
    if (result?.moved?.column_name) {
      notify(`Card moved to ${result.moved.column_name}`, "success");
    }
    onSaved?.();
  };

  const renderBody = () => {
    if (isLoading) return <div className="final-invoice__state">Loading pages...</div>;
    if (saved) {
      return (
        <div className="final-invoice__state">
          <p className="final-invoice__saved-name">{saved.document?.name}</p>
          <p className="final-invoice__saved-meta">
            {saved.page_count} {saved.page_count === 1 ? "page" : "pages"}
            {saved.size_mb != null ? ` · ${saved.size_mb} MB` : ""}
          </p>
          {saved.warnings?.map((warning) => (
            <p key={warning} className="final-invoice__saved-meta">
              {warning}
            </p>
          ))}
        </div>
      );
    }
    if (!pages.length) return <div className="final-invoice__state">No pages</div>;
    return (
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="final-invoice-pages">
          {(dropProvided) => (
            <div ref={dropProvided.innerRef} {...dropProvided.droppableProps} className="final-invoice__list">
              {pages.map((page, index) => (
                <Draggable key={getPageKey(page)} draggableId={getPageKey(page)} index={index} isDragDisabled={isSaving}>
                  {(dragProvided, snapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      className={`final-invoice__item ${snapshot.isDragging ? "final-invoice__item--dragging" : ""}`}
                    >
                      <span className="final-invoice__handle" {...dragProvided.dragHandleProps} aria-label="Drag to move">
                        <FiMenu size={18} />
                      </span>
                      <span className="final-invoice__position">{index + 1}</span>
                      <PageThumbnail pdf={pdfBySource[page.source]} pageNumber={page.page} />
                      <span className="final-invoice__label">
                        {sourceNameByKey[page.source] || page.source}
                        <span className="final-invoice__label-page">Page {page.page}</span>
                      </span>
                      <button
                        type="button"
                        className="final-invoice__remove"
                        onClick={() => removePage(index)}
                        disabled={isSaving}
                        aria-label={`Remove page ${index + 1}`}
                      >
                        <FiX size={16} />
                      </button>
                    </div>
                  )}
                </Draggable>
              ))}
              {dropProvided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    );
  };

  const renderHeader = () => (
    <div className="blockers-modal-header">
      <div className="blockers-modal-header-text">
        <h5 className="blockers-modal-title">Check Invoice</h5>
        <p className="blockers-modal-subtitle">
          {saved ? "Final invoice saved" : "Drag the pages into the order they should appear in the final invoice"}
        </p>
      </div>
      <button type="button" className="blockers-modal-close" onClick={onClose} disabled={isSaving} aria-label="Close">
        <FiX size={20} />
      </button>
    </div>
  );

  const renderFooter = () => (
    <div className="modal-footer se-review-move-footer">
      <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSaving}>
        Close
      </button>
      {saved ? (
        <>
          {saved.document?.url && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => downloadRemoteFile({ url: saved.document.url, name: saved.document.name })}
            >
              <FiDownload className="me-2" />
              Download PDF
            </button>
          )}
          {saved.zip?.url && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => downloadRemoteFile({ url: saved.zip.url, name: saved.zip.name })}
            >
              <FiDownload className="me-2" />
              Download ZIP
            </button>
          )}
        </>
      ) : (
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={isLoading || isSaving || !pages.length || !card}
        >
          <FiCheck className="me-2" />
          {isSaving ? "Saving..." : "Save"}
        </button>
      )}
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
      footer={renderFooter()}
    />
  );
};

FinalInvoiceModal.propTypes = {
  onSaved: PropTypes.func,
};

export default FinalInvoiceModal;
