import PropTypes from "prop-types";
import { FiUploadCloud, FiFileText, FiCheckCircle } from "react-icons/fi";

function CrewImmigrationPassIcon({ passData, uploadLabel, viewLabel, onUpload, onView }) {
  const isUploaded = Boolean(passData);
  return (
    <button
      type="button"
      className={`gro-crew-immigration-icon-action${isUploaded ? " gro-crew-immigration-icon-action--uploaded" : ""}`}
      title={isUploaded ? viewLabel : uploadLabel}
      onClick={() => (isUploaded ? onView() : onUpload())}
    >
      {isUploaded ? (
        <span className="gro-crew-immigration-uploaded-icon-wrap">
          <FiFileText className="gro-crew-immigration-uploaded-file-icon" />
          <FiCheckCircle className="gro-crew-immigration-uploaded-check-icon" />
        </span>
      ) : (
        <FiUploadCloud className="gro-crew-immigration-pending-icon" />
      )}
    </button>
  );
}

CrewImmigrationPassIcon.propTypes = {
  passData: PropTypes.any,
  uploadLabel: PropTypes.string.isRequired,
  viewLabel: PropTypes.string.isRequired,
  onUpload: PropTypes.func.isRequired,
  onView: PropTypes.func.isRequired,
};

export default function CrewImmigrationPanel({
  selectedRowIds,
  onBulkUploadCg,
  onBulkUploadZawil,
  headerCheckboxRef,
  isAllSelected,
  onSelectAllChange,
  rows,
  onRowSelectionChange,
  pageStartDisplay,
  pageEndDisplay,
  totalRows,
  currentPage,
  totalPages,
  pageNumbers,
  onPrevPage,
  onPageChange,
  onNextPage,
  cgFileInputRef,
  zawilFileInputRef,
  onCgFileChange,
  onZawilFileChange,
  onRowUploadClick,
}) {
  return (
    <div className="gro-crew-immigration-panel">
      <div className="gro-crew-immigration-toolbar">
        <button
          type="button"
          className="gro-crew-immigration-bulk-btn"
          onClick={onBulkUploadCg}
          disabled={selectedRowIds.size === 0}
        >
          Bulk Upload CG Pass
        </button>
        <button
          type="button"
          className="gro-crew-immigration-bulk-btn"
          onClick={onBulkUploadZawil}
          disabled={selectedRowIds.size === 0}
        >
          Bulk Upload Zawil Pass
        </button>
      </div>
      <div className="gro-crew-immigration-table-wrap">
        <table className="gro-crew-immigration-table">
          <thead>
            <tr>
              <th className="gro-crew-immigration-th-checkbox">
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  className="gro-crew-immigration-checkbox"
                  checked={isAllSelected}
                  onChange={(e) => onSelectAllChange(e.target.checked)}
                />
              </th>
              <th>Crew Name</th>
              <th>Nationality</th>
              <th>Rank</th>
              <th>Movement Type</th>
              <th>Passport</th>
              <th>Iqama</th>
              <th>Visa</th>
              <th className="gro-crew-immigration-th-cg-pass">CG Pass</th>
              <th className="gro-crew-immigration-th-zawil-pass">Zawil Pass</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rowId = String(row.id);
              const isSelected = selectedRowIds.has(rowId);
              return (
                <tr key={rowId}>
                  <td className="gro-crew-immigration-td-checkbox">
                    <input
                      type="checkbox"
                      className="gro-crew-immigration-checkbox"
                      checked={isSelected}
                      onChange={(e) => onRowSelectionChange(rowId, e.target.checked)}
                    />
                  </td>
                  <td>{row.crewName}</td>
                  <td>{row.nationality}</td>
                  <td>{row.rank}</td>
                  <td>{row.movementType}</td>
                  <td>{row.passport}</td>
                  <td>{row.iqama}</td>
                  <td>{row.visa}</td>
                  <td className="gro-crew-immigration-cg-pass-cell">
                    <CrewImmigrationPassIcon
                      passData={row.cgPass}
                      uploadLabel="Upload CG Pass"
                      viewLabel="View Uploaded CG Pass"
                      onUpload={() => onRowUploadClick("cg", rowId)}
                      onView={() => {
                        if (row.cgPass?.fileUrl) {
                          window.open(row.cgPass.fileUrl, "_blank", "noopener,noreferrer");
                        }
                      }}
                    />
                  </td>
                  <td className="gro-crew-immigration-zawil-pass-cell">
                    <CrewImmigrationPassIcon
                      passData={row.zawilPass}
                      uploadLabel="Upload Zawil Pass"
                      viewLabel="View Uploaded Zawil Pass"
                      onUpload={() => onRowUploadClick("zawil", rowId)}
                      onView={() => {
                        if (row.zawilPass?.fileUrl) {
                          window.open(row.zawilPass.fileUrl, "_blank", "noopener,noreferrer");
                        }
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="gro-crew-immigration-pagination">
        <p className="gro-crew-immigration-pagination-text">
          {`Showing ${pageStartDisplay}-${pageEndDisplay} of ${totalRows}`}
        </p>
        <div className="gro-crew-immigration-pagination-controls">
          <button
            type="button"
            className="gro-crew-immigration-page-btn"
            onClick={onPrevPage}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          {pageNumbers.map((pageNo) => (
            <button
              key={pageNo}
              type="button"
              className={`gro-crew-immigration-page-btn${pageNo === currentPage ? " gro-crew-immigration-page-btn--active" : ""}`}
              onClick={() => onPageChange(pageNo)}
            >
              {pageNo}
            </button>
          ))}
          <button
            type="button"
            className="gro-crew-immigration-page-btn"
            onClick={onNextPage}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      </div>
      <input
        ref={cgFileInputRef}
        type="file"
        className="gro-crew-immigration-file-input"
        onChange={onCgFileChange}
      />
      <input
        ref={zawilFileInputRef}
        type="file"
        className="gro-crew-immigration-file-input"
        onChange={onZawilFileChange}
      />
    </div>
  );
}

CrewImmigrationPanel.propTypes = {
  selectedRowIds: PropTypes.instanceOf(Set).isRequired,
  onBulkUploadCg: PropTypes.func.isRequired,
  onBulkUploadZawil: PropTypes.func.isRequired,
  headerCheckboxRef: PropTypes.shape({ current: PropTypes.any }).isRequired,
  isAllSelected: PropTypes.bool.isRequired,
  onSelectAllChange: PropTypes.func.isRequired,
  rows: PropTypes.arrayOf(PropTypes.object).isRequired,
  onRowSelectionChange: PropTypes.func.isRequired,
  pageStartDisplay: PropTypes.number.isRequired,
  pageEndDisplay: PropTypes.number.isRequired,
  totalRows: PropTypes.number.isRequired,
  currentPage: PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  pageNumbers: PropTypes.arrayOf(PropTypes.number).isRequired,
  onPrevPage: PropTypes.func.isRequired,
  onPageChange: PropTypes.func.isRequired,
  onNextPage: PropTypes.func.isRequired,
  cgFileInputRef: PropTypes.shape({ current: PropTypes.any }).isRequired,
  zawilFileInputRef: PropTypes.shape({ current: PropTypes.any }).isRequired,
  onCgFileChange: PropTypes.func.isRequired,
  onZawilFileChange: PropTypes.func.isRequired,
  onRowUploadClick: PropTypes.func.isRequired,
};
