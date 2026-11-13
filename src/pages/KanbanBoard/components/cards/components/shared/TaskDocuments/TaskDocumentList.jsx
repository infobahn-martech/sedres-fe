import PropTypes from "prop-types";
import { FiFileText } from "react-icons/fi";
import { GroDocumentRowsSkeleton } from "../../GRO/User/GroCardViewSkeleton";

function TaskDocumentList({
  isLoading = false,
  loadingMessage = "Loading documents…",
  isEmpty = false,
  emptyMessage = null,
  emptyHint = "Uploaded documents for this task will show up here.",
  listClassName = "",
  children,
}) {
  return (
    <div
      className={`gro-document-list ${
        !isLoading && isEmpty && emptyMessage ? "gro-document-list--empty" : ""
      } ${listClassName}`
        .replace(/\s+/g, " ")
        .trim()}
    >
      {isLoading ? (
        <div role="status" aria-live="polite">
          <span className="visually-hidden">{loadingMessage}</span>
          <GroDocumentRowsSkeleton rows={3} />
        </div>
      ) : null}
      {!isLoading && isEmpty && emptyMessage ? (
        <div className="gro-document-empty" role="status">
          <div className="gro-document-empty-art" aria-hidden="true">
            <span className="gro-document-empty-halo" />
            <span className="gro-document-empty-sheet gro-document-empty-sheet--back" />
            <span className="gro-document-empty-sheet gro-document-empty-sheet--front">
              <FiFileText size={26} />
            </span>
            <span className="gro-document-empty-dot gro-document-empty-dot--a" />
            <span className="gro-document-empty-dot gro-document-empty-dot--b" />
            <span className="gro-document-empty-dot gro-document-empty-dot--c" />
          </div>
          <p className="gro-document-empty-title">{emptyMessage}</p>
          {emptyHint ? <p className="gro-document-empty-hint">{emptyHint}</p> : null}
        </div>
      ) : null}
      {!isLoading && !isEmpty ? children : null}
    </div>
  );
}

TaskDocumentList.propTypes = {
  isLoading: PropTypes.bool,
  loadingMessage: PropTypes.string,
  isEmpty: PropTypes.bool,
  emptyMessage: PropTypes.string,
  emptyHint: PropTypes.string,
  listClassName: PropTypes.string,
  children: PropTypes.node,
};

export default TaskDocumentList;
