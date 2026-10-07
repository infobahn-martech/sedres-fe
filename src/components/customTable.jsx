import React, { useEffect, useState, useMemo, Fragment } from 'react';
import PropTypes from 'prop-types';

import CustomLoader from './CustomLoader';
import NoTableData from './NoTableData';

import '../design/scss/table-common.scss';

import nextIcon from '../assets/images/right.svg';
import prevIcon from '../assets/images/left.svg';
import sortSvg from '../assets/images/sort.svg';

// --- UTILS ---

const calculateSlNo = (page, limit) => (page - 1) * limit + 1;

const getTotalPages = (count, limit) =>
  count && limit ? Math.ceil(count / limit) : 0;

const getNumbersToShow = (totalPages, currentPage) => {
  const pageNumbers = [];
  for (let i = 1; i <= totalPages; i += 1) {
    if (
      i === 1 ||
      i === totalPages ||
      Math.abs(currentPage - i) < 3 ||
      i === currentPage
    ) {
      pageNumbers.push(i);
    }
  }
  return pageNumbers;
};

const getPageStart = (currentPage, limit) =>
  currentPage === 1 ? 1 : limit * (currentPage - 1) + 1;

const getPageEnd = (currentPage, limit, count) => {
  const end = limit * currentPage;
  return end > count ? count : end;
};

const handleOnCellClick = (row, onView, notView) => {
  if (!notView && onView) {
    onView(row);
  }
};

// --- COMPONENT ---

function CustomTable({
  data,
  columns,
  pagination,
  onPageChange,
  count,
  isLoading,
  showLoader,
  onView,
  onSorting,
  Sl,
  expandable,
  getRowKey,
  isRowExpanded,
  onExpandToggle,
  renderExpandedRow,
}) {
  const { currentPage, limit } = pagination;

  const resolveRowKey = (row, idx) => getRowKey(row, idx);
  const headColSpan =
    columns.length + (Sl ? 1 : 0) + (expandable ? 1 : 0);

  // Local state for temporary count and serial number base
  const [tempCount, setTempCount] = useState(count || 0);
  const [slNo, setSlNo] = useState(1);

  // Update serial number if page changes
  useEffect(() => {
    setSlNo(calculateSlNo(currentPage, limit));
  }, [currentPage, limit]);

  // Sync count
  useEffect(() => {
    if (!isLoading) setTempCount(count || 0);
  }, [count, isLoading]);

  // Calculate total pages (memoized for efficiency)
  const totalPages = useMemo(() => getTotalPages(tempCount, limit), [
    tempCount,
    limit,
  ]);

  // Memoized page numbers for display
  const numbersToShow = useMemo(
    () => getNumbersToShow(totalPages, currentPage),
    [totalPages, currentPage]
  );

  // Pagination rendering
  const renderPagination = () => {
    if ((!data || !data.length) && !isLoading) return null;

    const pageStart = getPageStart(currentPage, limit);
    const pageEnd = isLoading ? ' ' : getPageEnd(currentPage, limit, tempCount);

    return (
      <div className="container-fluid paginations">
        <div className="row">
          <div className="pagination-iiner d-flex">
            {!!count && (
              <div className="result-txt">{`Showing ${pageStart} to ${pageEnd} of ${count} entries`}</div>
            )}
            <nav aria-label="Page navigation example">
              <ul className="pagination justify-content-center">
                {/* Previous Button */}
                <li
                  className={`page-item${currentPage === 1 ? ' disabled' : ''}`}
                  onClick={currentPage > 1 ? () => handlePrev() : undefined}
                >
                  <a
                    className="page-link"
                    href="#"
                    aria-label="Previous"
                    onClick={(e) => e.preventDefault()}
                  >
                    <img src={prevIcon} alt="" />
                  </a>
                </li>
                {/* Page Numbers */}
                {numbersToShow.map((num, idx) => {
                  const isFirstPage = idx === 0;
                  const gap =
                    !isFirstPage && num - numbersToShow[idx - 1] > 1
                      ? true
                      : false;
                  return (
                    <Fragment key={`pg${num}`}>
                      {gap && (
                        <li className="page-item disabled">
                          <a
                            href="#"
                            className="page-link cursor-pointer link-dots"
                            onClick={(e) => e.preventDefault()}
                          >
                            ...
                          </a>
                        </li>
                      )}
                      <li
                        className={`page-item${num === currentPage ? ' active' : ''}`}
                        onClick={
                          num === currentPage ? undefined : () => handlePage(num)
                        }
                      >
                        <a
                          href="#"
                          className="page-link"
                          onClick={(e) => e.preventDefault()}
                        >
                          {num}
                        </a>
                      </li>
                    </Fragment>
                  );
                })}
                {/* Next Button */}
                <li
                  className={`page-item${currentPage === totalPages ? ' disabled' : ''
                    }`}
                  onClick={
                    currentPage < totalPages ? () => handleNext() : undefined
                  }
                >
                  <a
                    href="#"
                    className="page-link"
                    aria-label="Next"
                    onClick={(e) => e.preventDefault()}
                  >
                    <img src={nextIcon} alt="" />
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
    );
  };

  // -- Pagination Handlers --
  const handlePrev = () => {
    if (currentPage <= 1) return;
    const newPage = currentPage - 1;
    setSlNo(calculateSlNo(newPage, limit));
    onPageChange?.(newPage);
  };

  const handleNext = () => {
    if (currentPage >= totalPages) return;
    const newPage = currentPage + 1;
    setSlNo(calculateSlNo(newPage, limit));
    onPageChange?.(newPage);
  };

  const handlePage = (pageNum) => {
    if (currentPage === pageNum) return;
    setSlNo(calculateSlNo(pageNum, limit));
    onPageChange?.(pageNum);
  };

  // ----------------------------

  return (
    <>
      <div className="container-fluid custom-table">
        <div className="row">
          <div className="table-wrapper table-responsive ">
            <table className="table table-striped">
              {(data && data.length > 0) || isLoading ? (
                <thead>
                  <tr>
                    {expandable && (
                      <th
                        width="44"
                        className="custom-table-expand-header"
                        scope="col"
                        aria-label="Expand row"
                      />
                    )}
                    {Sl && <th width="100">Sl.No</th>}
                    {columns.map(
                      ({ thclass, sort, selector, name, thProps, width }, colIdx) => (
                        <th
                          width={width}
                          scope="col"
                          key={`head-${colIdx}-${typeof name === 'string' ? name : selector}`}
                          {...thProps}
                        >
                          <div className={`${thclass} d-inline`}>{name}</div>
                          {sort && (
                            <span
                              type="button"
                              className="sort"
                              onClick={() => onSorting && onSorting(selector)}
                            >
                              <img src={sortSvg} alt="sort" />
                            </span>
                          )}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
              ) : null}

              {isLoading ? (
                <CustomLoader
                  columns={columns}
                  limit={limit}
                  Sl={Sl}
                  expandable={expandable}
                />
              ) : !data.length ? (
                <NoTableData columns={columns} colSpan={headColSpan} />
              ) : (
                !showLoader && (
                  <tbody>
                    {data.map((row, idx) => {
                      const rowKey = resolveRowKey(row, idx);
                      const expanded =
                        expandable &&
                        typeof isRowExpanded === 'function' &&
                        isRowExpanded(row, rowKey);
                      return (
                        <Fragment key={`row${rowKey}`}>
                          <tr>
                            {expandable && (
                              <td
                                className="custom-table-expand-cell"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className="btn btn-link btn-sm p-0 custom-table-expand-btn"
                                  aria-expanded={expanded}
                                  aria-label={
                                    expanded ? 'Collapse row' : 'Expand row'
                                  }
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onExpandToggle?.(row, rowKey);
                                  }}
                                >
                                  <span
                                    className={`custom-table-expand-chevron${expanded ? ' is-open' : ''
                                      }`}
                                  />
                                </button>
                              </td>
                            )}
                            {Sl && <td className="custom-table-sl">{idx + slNo}</td>}
                            {columns.map(
                              ({
                                selector,
                                cell,
                                colClassName = '',
                                contentClass = '',
                                notView,
                                ...rest
                              }) =>
                                cell ? (
                                  <td
                                    key={`cell${selector}`}
                                    onClick={() =>
                                      handleOnCellClick(row, onView, notView)
                                    }
                                  >
                                    <div className={contentClass}>
                                      {cell({ row, selector, ...rest })}
                                    </div>
                                  </td>
                                ) : (
                                  <td
                                    className={`${colClassName}${!notView && onView ? ' cursor-pointer' : ''
                                      }`}
                                    key={`cell${selector}`}
                                    onClick={() =>
                                      handleOnCellClick(row, onView, notView)
                                    }
                                  >
                                    {row[selector]}
                                  </td>
                                )
                            )}
                          </tr>
                          {expandable && expanded && renderExpandedRow ? (
                            <tr className="custom-table-expanded-row">
                              <td colSpan={headColSpan} className="p-0">
                                <div
                                  className="custom-table-expanded-inner"
                                  role="region"
                                  aria-label="Row details"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {renderExpandedRow(row, rowKey)}
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                )
              )}
            </table>
          </div>
        </div>
      </div>
      {renderPagination()}
    </>
  );
}

// --- PROP TYPES and DEFAULTS ---

CustomTable.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object),
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      thclass: PropTypes.string,
      sort: PropTypes.bool,
      selector: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
      name: PropTypes.oneOfType([PropTypes.string, PropTypes.node]).isRequired,
      thProps: PropTypes.object,
      width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      cell: PropTypes.func,
      colClassName: PropTypes.string,
      contentClass: PropTypes.string,
      notView: PropTypes.bool,
    })
  ),
  pagination: PropTypes.shape({
    currentPage: PropTypes.number,
    limit: PropTypes.number,
  }),
  onPageChange: PropTypes.func,
  count: PropTypes.number,
  isLoading: PropTypes.bool,
  showLoader: PropTypes.bool,
  onView: PropTypes.func,
  onSorting: PropTypes.func,
  Sl: PropTypes.bool,
  expandable: PropTypes.bool,
  getRowKey: PropTypes.func,
  isRowExpanded: PropTypes.func,
  onExpandToggle: PropTypes.func,
  renderExpandedRow: PropTypes.func,
};

CustomTable.defaultProps = {
  data: [],
  columns: [],
  pagination: { currentPage: 1, limit: 10 },
  onPageChange: () => { },
  count: 0,
  isLoading: false,
  showLoader: false,
  onView: undefined,
  onSorting: undefined,
  Sl: false,
  expandable: false,
  getRowKey: (row, idx) => row?.id ?? row?._id ?? row?.crew_id ?? idx,
  isRowExpanded: () => false,
  onExpandToggle: undefined,
  renderExpandedRow: undefined,
};

export default CustomTable;
