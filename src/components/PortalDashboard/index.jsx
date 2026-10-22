import { Fragment, useState } from 'react';
import { FiChevronRight } from 'react-icons/fi';
import '../../design/scss/pages/dashboard/dashboard-content.scss';
import '../../design/scss/vendor-portal.scss';

const STATUS_CLASS_MAP = {
    'pending': 'status-pending',
    'approved': 'status-approved',
    'rejected': 'status-rejected',
    'paid': 'status-paid',
    'completed': 'status-completed',
    'in progress': 'status-pending',
    'assigned': 'status-approved',
    'cancelled': 'status-rejected',
    'open': 'status-open',
    'closed': 'status-closed',
};

function PortalDashboard({
    title,
    subtitle,
    summaryCards,
    statusTitle,
    statusCards,
    quickActions,
    tableTitle,
    tableHeaderAction,
    tableColumns,
    tableRows,
    isTableLoading = false,
    emptyMessage = 'No records found',
    expandable = false,
    rowKey,
    renderExpandedRow,
}) {
    const [expandedRowId, setExpandedRowId] = useState(null);

    const getStatusClass = (status) =>
        STATUS_CLASS_MAP[(status || '').toLowerCase()] || '';

    const getRowKey = (row, index) => (rowKey ? rowKey(row) : index);

    const toggleRow = (key) => {
        setExpandedRowId((prev) => (prev === key ? null : key));
    };

    const colSpan = tableColumns.length + (expandable ? 1 : 0);

    return (
        <div className="dashboard-container portal-dashboard">
            <div className="dashboard-header">
                <h2 className="dashboard-title">{title}</h2>
                <p className="dashboard-subtitle">{subtitle}</p>
            </div>

            <div className="stats-grid">
                {summaryCards.map((card, i) => (
                    <div key={i} className="stat-card">
                        <div className="stat-card-content">
                            <div className="stat-icon" style={{ color: card.color }}>
                                {card.icon}
                            </div>
                            <div className="stat-info">
                                <p className="stat-title">{card.title}</p>
                                <h3 className="stat-value">{card.value}</h3>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {!!statusCards?.length && (
                <div className="vendor-dashboard-section">
                    <h3 className="vendor-section-title">{statusTitle}</h3>
                    <div className="vendor-invoice-status-cards">
                        {statusCards.map((card, i) => (
                            <div key={i} className={`vendor-status-card ${card.statusClass}`}>
                                <p className="vendor-status-label">{card.label}</p>
                                <p className="vendor-status-value">{card.value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!!quickActions?.length && (
                <div className="vendor-dashboard-section">
                    <h3 className="vendor-section-title">Quick Actions</h3>
                    <div className="vendor-quick-actions">
                        {quickActions.map((action, i) => (
                            <button
                                key={i}
                                type="button"
                                className="vendor-quick-action-btn"
                                onClick={action.onClick}
                            >
                                {action.icon} {action.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="vendor-dashboard-section">
                <div className="vendor-section-header">
                    <h3 className="vendor-section-title">{tableTitle}</h3>
                    {tableHeaderAction}
                </div>
                <div className="vendor-table-wrapper">
                    <div className="vendor-table-scroll">
                        <table className="vendor-table">
                            <thead>
                                <tr>
                                    {expandable && (
                                        <th className="vendor-table__expand-col" aria-label="Expand row" />
                                    )}
                                    {tableColumns.map((col, i) => (
                                        <th key={i}>{col.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {isTableLoading ? (
                                    <tr>
                                        <td colSpan={colSpan} className="vendor-table__state">
                                            Loading...
                                        </td>
                                    </tr>
                                ) : !tableRows.length ? (
                                    <tr>
                                        <td colSpan={colSpan} className="vendor-table__state">
                                            {emptyMessage}
                                        </td>
                                    </tr>
                                ) : (
                                    tableRows.map((row, rowIdx) => {
                                        const key = getRowKey(row, rowIdx);
                                        const isExpanded = expandable && expandedRowId === key;

                                        return (
                                            <Fragment key={key}>
                                                <tr
                                                    className={expandable ? 'vendor-table__row--expandable' : ''}
                                                    onClick={expandable ? () => toggleRow(key) : undefined}
                                                >
                                                    {expandable && (
                                                        <td
                                                            className="vendor-table__expand-col"
                                                            aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                                                        >
                                                            <FiChevronRight
                                                                className={`vendor-table__expand-icon ${isExpanded ? 'is-open' : ''}`}
                                                            />
                                                        </td>
                                                    )}
                                                    {tableColumns.map((col, colIdx) => (
                                                        <td key={colIdx}>
                                                            {col.render ? (
                                                                col.render(row)
                                                            ) : col.isStatus ? (
                                                                <span className={`vendor-status-badge ${getStatusClass(row[col.key])}`}>
                                                                    {row[col.key]}
                                                                </span>
                                                            ) : (
                                                                row[col.key]
                                                            )}
                                                        </td>
                                                    ))}
                                                </tr>

                                                {isExpanded && (
                                                    <tr className="vendor-table__expanded-row">
                                                        <td colSpan={colSpan}>
                                                            <div
                                                                className="vendor-table__expanded-content"
                                                                onClick={(e) => e.stopPropagation()}
                                                                role="presentation"
                                                            >
                                                                {renderExpandedRow?.(row)}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PortalDashboard;
