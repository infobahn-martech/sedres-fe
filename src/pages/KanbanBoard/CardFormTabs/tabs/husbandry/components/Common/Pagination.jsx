import PropTypes from "prop-types";

const Pagination = ({ currentPage, totalItems, limit, onPageChange }) => {
  if (totalItems === 0) return null;

  const totalPages = Math.ceil(totalItems / limit);
  const start = (currentPage - 1) * limit + 1;
  const end = Math.min(currentPage * limit, totalItems);

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 4px 4px", fontSize: "13px", color: "#555" }}>
      <span>Showing {start} to {end} of {totalItems} entries</span>
      <div style={{ display: "flex", gap: "4px" }}>
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          style={{ padding: "4px 10px", border: "1px solid #dee2e6", borderRadius: "4px", background: currentPage === 1 ? "#f8f9fa" : "#fff", color: currentPage === 1 ? "#aaa" : "#00368c", cursor: currentPage === 1 ? "default" : "pointer" }}
        >
          &lt;
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            style={{ padding: "4px 10px", border: "1px solid #dee2e6", borderRadius: "4px", background: currentPage === p ? "#00368c" : "#fff", color: currentPage === p ? "#fff" : "#00368c", cursor: "pointer", fontWeight: currentPage === p ? 600 : 400 }}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          style={{ padding: "4px 10px", border: "1px solid #dee2e6", borderRadius: "4px", background: currentPage === totalPages ? "#f8f9fa" : "#fff", color: currentPage === totalPages ? "#aaa" : "#00368c", cursor: currentPage === totalPages ? "default" : "pointer" }}
        >
          &gt;
        </button>
      </div>
    </div>
  );
};

Pagination.propTypes = {
  currentPage: PropTypes.number.isRequired,
  totalItems: PropTypes.number.isRequired,
  limit: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
};

export default Pagination;
