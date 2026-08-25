import { useState, useMemo } from 'react';
import CustomModal from '../../components/CustomModal';
import CustomTable from '../../components/customTable';
import { Tooltip } from 'react-tooltip';
import { FiX, FiChevronLeft, FiChevronRight, FiSearch } from 'react-icons/fi';
import '../../design/scss/common.scss';
import '../../design/scss/structure/header/DocumentsModal.scss';

// Dummy data for documents
const initialDocuments = [
  {
    _id: '1',
    cardId: 95,
    boardName: 'Board Name 1',
    workflowName: 'Cards workflow',
    laneName: 'Default Swimlane',
    columnName: 'Done',
  },
  {
    _id: '2',
    cardId: 99,
    boardName: 'Board Name 1',
    workflowName: 'Cards workflow',
    laneName: 'Default Swimlane',
    columnName: 'Done',
  },
  {
    _id: '3',
    cardId: 92,
    boardName: 'Board Name 2',
    workflowName: 'Tasks workflow',
    laneName: 'Default Swimlane',
    columnName: 'In Progress',
  },
  {
    _id: '4',
    cardId: 88,
    boardName: 'Board Name 1',
    workflowName: 'Cards workflow',
    laneName: 'Default Swimlane',
    columnName: 'Requested',
  },
  {
    _id: '5',
    cardId: 85,
    boardName: 'Board Name 3',
    workflowName: 'Projects workflow',
    laneName: 'Default Swimlane',
    columnName: 'Done',
  },
];

function DocumentsModal({ show, onClose }) {
  const [documents] = useState(initialDocuments);
  const [searchQuery, setSearchQuery] = useState('');

  const [params, setParams] = useState({
    page: 1,
    total: documents.length,
    limit: 10,
  });

  // Filter documents based on search query
  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) {
      return documents;
    }
    const query = searchQuery.toLowerCase();
    return documents.filter((doc) =>
      doc.cardId.toString().includes(query) ||
      doc.boardName.toLowerCase().includes(query) ||
      doc.workflowName.toLowerCase().includes(query) ||
      doc.laneName.toLowerCase().includes(query) ||
      doc.columnName.toLowerCase().includes(query)
    );
  }, [documents, searchQuery]);

  // Calculate paginated data
  const paginatedData = useMemo(() => {
    const startIndex = (params.page - 1) * params.limit;
    const endIndex = startIndex + params.limit;
    return filteredDocuments.slice(startIndex, endIndex);
  }, [filteredDocuments, params.page, params.limit]);

  const totalPages = Math.ceil(filteredDocuments.length / params.limit);

  // Reset to page 1 when search changes
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setParams({ ...params, page: 1 });
  };

  // Helper component for truncated text with tooltip
  const TruncatedCell = ({ text, maxLength = 30, tooltipId }) => {
    if (!text) return <span>-</span>;
    const isTruncated = text.length > maxLength;
    const displayText = isTruncated ? text.substring(0, maxLength) + '...' : text;

    return (
      <>
        <span
          data-tooltip-id={isTruncated ? tooltipId : undefined}
          data-tooltip-content={isTruncated ? text : undefined}
          className="truncated-cell-text"
        >
          {displayText}
        </span>
        {isTruncated && <Tooltip id={tooltipId} place="top" />}
      </>
    );
  };

  const cols = [
    {
      name: 'CARD ID',
      selector: 'cardId',
      tableClasses: 'table-striped',
      contentClass: 'table-content',
      sort: true,
      thclass: 'tb-head',
      width: '120',
      cell: (props) => {
        const tooltipId = `cardId-${props.row._id}`;
        return (
          <>
            <span
              className="truncated-cell-text clickable-link"
              data-tooltip-id={tooltipId}
              data-tooltip-content={props.row.cardId.toString()}
              onClick={() => {}}
              style={{ color: '#2563eb', cursor: 'pointer' }}
            >
              {props.row.cardId}
            </span>
            <Tooltip id={tooltipId} place="top" />
          </>
        );
      },
    },
    {
      name: 'BOARD NAME',
      selector: 'boardName',
      tableClasses: 'table-striped',
      sort: true,
      contentClass: 'table-content',
      thclass: 'tb-head',
      width: '200',
      cell: (props) => (
        <TruncatedCell text={props.row.boardName} maxLength={25} tooltipId={`boardName-${props.row._id}`} />
      ),
    },
    {
      name: 'WORKFLOW NAME',
      selector: 'workflowName',
      tableClasses: 'table-striped',
      sort: true,
      contentClass: 'table-content',
      thclass: 'tb-head',
      width: '200',
      cell: (props) => (
        <TruncatedCell text={props.row.workflowName} maxLength={25} tooltipId={`workflowName-${props.row._id}`} />
      ),
    },
    {
      name: 'LANE NAME',
      selector: 'laneName',
      tableClasses: 'table-striped',
      sort: true,
      contentClass: 'table-content',
      thclass: 'tb-head',
      width: '200',
      cell: (props) => (
        <TruncatedCell text={props.row.laneName} maxLength={25} tooltipId={`laneName-${props.row._id}`} />
      ),
    },
    {
      name: 'COLUMN NAME',
      selector: 'columnName',
      tableClasses: 'table-striped',
      sort: true,
      contentClass: 'table-content',
      thclass: 'tb-head',
      width: '150',
      cell: (props) => (
        <TruncatedCell text={props.row.columnName} maxLength={20} tooltipId={`columnName-${props.row._id}`} />
      ),
    },
  ];

  const renderBody = () => (
    <div className="documents-modal-body">
      {/* Search Section */}
      <div className="documents-search">
        <div className="search-group">
          <div className="search-input-wrapper">
            <FiSearch className="search-icon" />
            <input
              type="text"
              className="form-control search-input"
              placeholder="Search by Card ID, Board Name, Workflow Name, Lane Name, or Column Name..."
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="documents-table-wrapper">
        <CustomTable
          tableClasses="documents-table"
          count={filteredDocuments.length}
          columns={cols}
          data={paginatedData ?? []}
          pagination={{ currentPage: 1, limit: paginatedData.length }}
          onSorting={(sortBy) => {
            setParams({
              ...params,
              sortBy,
              sortOrder: params?.sortOrder === -1 ? 1 : -1,
              page: 1,
            });
          }}
        />
      </div>

      {/* Footer with Pagination */}
      <div className="documents-footer">
        <div className="footer-left">
          <span className="results-info">
            Showing {((params.page - 1) * params.limit) + 1} to {Math.min(params.page * params.limit, filteredDocuments.length)} of {filteredDocuments.length} entries
          </span>
        </div>
        <div className="footer-right">
          {/* Simple Pagination */}
          <div className="simple-pagination">
            <button
              className="pagination-btn prev-btn"
              onClick={() => setParams({ ...params, page: Math.max(1, params.page - 1) })}
              disabled={params.page === 1}
              aria-label="Previous page"
            >
              <FiChevronLeft />
            </button>
            <button className="pagination-btn page-number-btn active">
              {params.page}
            </button>
            <button
              className="pagination-btn next-btn"
              onClick={() => setParams({ ...params, page: Math.min(totalPages, params.page + 1) })}
              disabled={params.page >= totalPages || totalPages === 0}
              aria-label="Next page"
            >
              <FiChevronRight />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <CustomModal
      className="modal fade show documents-modal"
      dialgName="modal-dialog modal-dialog-centered modal-xl"
      createModal
      show={show}
      closeModal={onClose}
      header={
        <div className="modal-header">
          <h5 className="modal-title">Reports</h5>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <FiX size={20} />
          </button>
        </div>
      }
      body={renderBody()}
    />
  );
}

export default DocumentsModal;

