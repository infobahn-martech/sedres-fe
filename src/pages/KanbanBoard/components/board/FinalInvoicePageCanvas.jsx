import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";

// One page of a loaded pdf.js document drawn on a canvas. With `lazy` it is drawn only once it scrolls
// into view, so a package of dozens of scanned pages does not render all at once.
const FinalInvoicePageCanvas = ({ pdf, pageNumber, scale, lazy, className }) => {
  const canvasRef = useRef(null);
  const [isVisible, setIsVisible] = useState(!lazy);

  useEffect(() => {
    if (!lazy || isVisible) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setIsVisible(true);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [lazy, isVisible]);

  useEffect(() => {
    if (!pdf || !isVisible) return undefined;
    let renderTask;
    let isCancelled = false;
    pdf.getPage(pageNumber).then((page) => {
      if (isCancelled || !canvasRef.current) return;
      const viewport = page.getViewport({ scale });
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
  }, [pdf, pageNumber, scale, isVisible]);

  return <canvas ref={canvasRef} className={className} />;
};

FinalInvoicePageCanvas.propTypes = {
  pdf: PropTypes.object,
  pageNumber: PropTypes.number.isRequired,
  scale: PropTypes.number.isRequired,
  lazy: PropTypes.bool,
  className: PropTypes.string,
};

export default FinalInvoicePageCanvas;
