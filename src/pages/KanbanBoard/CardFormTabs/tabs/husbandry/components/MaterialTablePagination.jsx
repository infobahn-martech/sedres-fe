
import PropTypes from "prop-types";
import "../../../../../../../design/scss/table-common.scss";

const MaterialTablePagination = ({ page, total, limit, onPageChange }) => {
  const safePage = Number(page) || 1;
  const safeLimit = Math.max(Number(limit) || 1, 1);
  const safeTotal = Math.max(Number(total) || 0, 0);
  const totalPages = Math.max(Math.ceil(safeTotal / safeLimit), 1);
  const currentPage = Math.min(Math.max(safePage, 1), totalPages);
  const startItem = safeTotal === 0 ? 0 : (currentPage - 1) * safeLimit + 1;
  const endItem = Math.min(currentPage * safeLimit, safeTotal);

  const handlePageChange = (nextPage) => {
    const clampedPage = Math.min(Math.max(nextPage, 1), totalPages);
    if (clampedPage !== currentPage) {
      onPageChange(clampedPage);
    }
  };

  if (safeTotal <= safeLimit) {
    return null;
  }

  return (
    <div className="material-table-pagination">
      <span className="material-table-pagination__info">
        Showing {startItem}-{endItem} of {safeTotal}
      </span>
      <div className="material-table-pagination__controls">
        <button
          type="button"
          className="material-table-pagination__btn"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          Previous
        </button>
        <span className="material-table-pagination__page-text">
          Page {currentPage} of {totalPages}
        </span>
        <button
          type="button"
          className="material-table-pagination__btn"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
};

MaterialTablePagination.propTypes = {
  page: PropTypes.number,
  total: PropTypes.number,
  limit: PropTypes.number,
  onPageChange: PropTypes.func.isRequired,
};

MaterialTablePagination.defaultProps = {
  page: 1,
  total: 0,
  limit: 10,
};

export default MaterialTablePagination;
