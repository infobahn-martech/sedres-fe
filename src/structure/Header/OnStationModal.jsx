import { useState, useMemo, useEffect, useCallback } from 'react';
import CustomModal from '../../components/CustomModal';
import { debounce } from 'lodash';
import { Tooltip } from 'react-tooltip';
import { FiX, FiSearch, FiFileText, FiDollarSign, FiList } from 'react-icons/fi';
import useOnStationReducer from '../../store/OnStationReducer';
import '../../design/scss/structure/header/OnStationModal.scss';

const getRowId = (row) => row?.call_id ?? row?._id;

// Helper component for truncated text with tooltip (falls back to "-" when empty)
const TruncatedCell = ({ text, maxLength = 30, tooltipId }) => {
    if (!text) return <span>-</span>;
    const isTruncated = text.length > maxLength;
    const displayText = isTruncated ? text.substring(0, maxLength) + '...' : text;

    return (
        <>
            <span
                data-tooltip-id={isTruncated ? tooltipId : undefined}
                data-tooltip-content={isTruncated ? text : undefined}
                className="on-station-truncated-text"
            >
                {displayText}
            </span>
            {isTruncated && <Tooltip id={tooltipId} place="top" />}
        </>
    );
};

// On Station enable/disable switch (pill toggle, row-wise loading state)
const OnStationSwitch = ({ isEnabled, loading, onChange, tooltipId }) => (
    <>
        <button
            type="button"
            role="switch"
            aria-checked={isEnabled}
            aria-label={isEnabled ? 'Disable On Station' : 'Enable On Station'}
            className={`on-station-pill-toggle${isEnabled ? ' on-station-pill-toggle--on' : ''}`}
            disabled={loading}
            onClick={loading ? undefined : onChange}
            data-tooltip-id={tooltipId}
            data-tooltip-content={loading ? 'Processing...' : isEnabled ? 'Enabled' : 'Disabled'}
        >
            <span className="on-station-pill-toggle__thumb" />
        </button>
        <Tooltip id={tooltipId} place="top" />
    </>
);

// Helper for Action buttons (icon-only with tooltip, row-wise loading spinner)
const ActionButton = ({ icon: Icon, disabled, loading, tooltip, onClick, tooltipId }) => {
    const isDisabled = disabled || loading;

    return (
        <>
            <button
                type="button"
                className={`on-station-action-btn${isDisabled ? ' on-station-action-btn--disabled' : ''}`}
                disabled={isDisabled}
                onClick={isDisabled ? undefined : onClick}
                data-tooltip-id={tooltipId}
                data-tooltip-content={loading ? 'Processing...' : tooltip}
                aria-label={tooltip}
            >
                {loading ? (
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                ) : (
                    <Icon size={16} />
                )}
            </button>
            <Tooltip id={tooltipId} place="top" />
        </>
    );
};

function OnStationModal({ show, onClose }) {
    const {
        list,
        total,
        isLoadingList,
        rowActionLoading,
        getOnStationList,
        toggleOnStation,
        createSalesOrder,
        convertToTaxInvoice,
        sendTaxInvoice,
    } = useOnStationReducer();

    const [searchInput, setSearchInput] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [params, setParams] = useState({
        page: 1,
        limit: 10,
        sortBy: '',
        sortOrder: -1,
    });

    const handleClose = useCallback(() => {
        onClose?.();
    }, [onClose]);

    // 500ms debounced search -> backend query
    const debouncedSetSearch = useMemo(
        () =>
            debounce((value) => {
                setParams((prev) => ({ ...prev, page: 1 }));
                setDebouncedSearch(value);
            }, 500),
        []
    );

    useEffect(() => () => debouncedSetSearch.cancel(), [debouncedSetSearch]);

    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearchInput(value);
        debouncedSetSearch(value);
    };

    // Fetch list on modal open and whenever page/limit/search change
    useEffect(() => {
        if (!show) return;
        getOnStationList({ page: params.page, limit: params.limit, search: debouncedSearch });
    }, [show, params.page, params.limit, debouncedSearch, getOnStationList]);

    const totalPages = Math.ceil(total / params.limit) || 0;
    const rows = list ?? [];

    return (
        <CustomModal
            show={show}
            closeModal={handleClose}
            className="on-station-modal"
            dialgName="on-station-modal-dialog"
            createModal={false}
            body={
                <div className="on-station-modal-content">
                    {/* Header */}
                    <div className="on-station-modal-header">
                        <div className="on-station-modal-header-text">
                            <h2 className="on-station-modal-title">On Station</h2>
                            <p className="on-station-modal-subtitle">Manage on-station vessels, sales orders and tax invoices</p>
                        </div>
                        <button
                            type="button"
                            className="on-station-modal-close"
                            onClick={handleClose}
                            aria-label="Close"
                        >
                            <FiX size={20} />
                        </button>
                    </div>

                    <div className="on-station-toolbar-section">
                        <div className="on-station-filter-bar">
                            <div className="on-station-filter-input-wrap">
                                <FiSearch size={16} className="on-station-filter-search-icon" />
                                <input
                                    type="text"
                                    className="on-station-filter-input"
                                    placeholder="Search by Card ID, Vessel Name, Client, Owner, Vessel Manager, Import/Export Date, Assigned..."
                                    value={searchInput}
                                    onChange={handleSearchChange}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Table Section */}
                    <div className="on-station-table-section">
                        <div className="on-station-table-wrapper">
                            <table className="on-station-table">
                                <thead>
                                    <tr>
                                        <th>Vessel Name</th>
                                        <th>Client</th>
                                        <th>Owner Name</th>
                                        <th>Vessel Manager</th>
                                        <th>Import Date</th>
                                        <th>Export Date</th>
                                        <th>On Station</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoadingList ? (
                                        <tr>
                                            <td colSpan="8" className="on-station-empty">Loading...</td>
                                        </tr>
                                    ) : rows.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="on-station-empty">No records found</td>
                                        </tr>
                                    ) : (
                                        rows.map((row) => {
                                            const rowId = getRowId(row);
                                            const isEnabled = Number(row.is_enabled) === 1;
                                            const onStationId = row.on_station_id ?? null;
                                            const salesOrderId = row.sales_order_id ?? null;
                                            const salesOrderNo = row.sales_order_no ?? null;
                                            const taxInvoiceId = row.tax_invoice_id ?? null;
                                            const taxInvoiceNo = row.tax_invoice_no ?? null;
                                            const taxInvoiceSent = Number(row.tax_invoice_sent) === 1;
                                            const loading = rowActionLoading[rowId] || {};

                                            // Button 1: Create Sales Order (only once On Station is enabled)
                                            const btn1Disabled = !isEnabled || !!salesOrderId;
                                            const btn1Tooltip = salesOrderId
                                                ? `Sales Order: ${salesOrderNo ?? salesOrderId}`
                                                : isEnabled
                                                    ? 'Create Sales Order'
                                                    : 'Enable On Station first';

                                            // Button 2: Convert to Tax Invoice
                                            const btn2Disabled = !salesOrderId || !!taxInvoiceId;
                                            const btn2Tooltip = taxInvoiceId
                                                ? `Tax Invoice: ${taxInvoiceNo ?? taxInvoiceId}`
                                                : salesOrderId
                                                    ? 'Convert to Tax Invoice'
                                                    : 'Create Sales Order first';

                                            // Button 3: Send Tax Invoice
                                            const btn3Disabled = !taxInvoiceId || taxInvoiceSent;
                                            const btn3Tooltip = taxInvoiceSent
                                                ? 'Tax Invoice Sent'
                                                : taxInvoiceId
                                                    ? 'Send Tax Invoice'
                                                    : 'Convert to Tax Invoice first';

                                            return (
                                                <tr key={rowId}>
                                                    <td>
                                                        <TruncatedCell text={row.vessel_name} tooltipId={`vessel-${rowId}`} />
                                                    </td>
                                                    <td>
                                                        <TruncatedCell text={row.billing_entity} tooltipId={`client-${rowId}`} />
                                                    </td>
                                                    <td>
                                                        <TruncatedCell text={row.vessel_owner} tooltipId={`owner-${rowId}`} />
                                                    </td>
                                                    <td>
                                                        <TruncatedCell text={row.vessel_manager} tooltipId={`manager-${rowId}`} />
                                                    </td>
                                                    <td>{row.import_custom_clearance_date ?? '-'}</td>
                                                    <td>{row.export_atd ?? '-'}</td>
                                                    <td>
                                                        <OnStationSwitch
                                                            isEnabled={isEnabled}
                                                            loading={!!loading.toggle}
                                                            tooltipId={`switch-${rowId}`}
                                                            onChange={() => toggleOnStation({ call_id: rowId, is_enabled: !isEnabled })}
                                                        />
                                                    </td>
                                                    <td>
                                                        <div className="on-station-actions-group">
                                                            <ActionButton
                                                                icon={FiFileText}
                                                                disabled={btn1Disabled}
                                                                loading={loading.createSalesOrder}
                                                                tooltip={btn1Tooltip}
                                                                tooltipId={`so-${rowId}`}
                                                                onClick={() => createSalesOrder({ call_id: rowId, on_station_id: onStationId })}
                                                            />
                                                            <ActionButton
                                                                icon={FiDollarSign}
                                                                disabled={btn2Disabled}
                                                                loading={loading.convertTaxInvoice}
                                                                tooltip={btn2Tooltip}
                                                                tooltipId={`inv-${rowId}`}
                                                                onClick={() => convertToTaxInvoice({ call_id: rowId, sales_order_id: salesOrderId })}
                                                            />
                                                            <ActionButton
                                                                icon={FiList}
                                                                disabled={btn3Disabled}
                                                                loading={loading.sendTaxInvoice}
                                                                tooltip={btn3Tooltip}
                                                                tooltipId={`sum-${rowId}`}
                                                                onClick={() => sendTaxInvoice({ call_id: rowId, tax_invoice_id: taxInvoiceId })}
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer with Pagination */}
                        <div className="on-station-pagination">
                            <span className="on-station-pagination-count">
                                {total === 0
                                    ? 'Showing 0 entries'
                                    : `Showing ${((params.page - 1) * params.limit) + 1} to ${Math.min(
                                        params.page * params.limit,
                                        total
                                    )} of ${total} entries`}
                            </span>
                            <div className="on-station-pagination-controls">
                                <button
                                    type="button"
                                    className="on-station-pagination-btn"
                                    onClick={() => setParams((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                                    disabled={params.page === 1}
                                >
                                    Previous
                                </button>
                                <span className="on-station-pagination-page">Page {params.page}</span>
                                <button
                                    type="button"
                                    className="on-station-pagination-btn"
                                    onClick={() => setParams((prev) => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}
                                    disabled={params.page >= totalPages || totalPages === 0}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            }
        />
    );
}

export default OnStationModal;
