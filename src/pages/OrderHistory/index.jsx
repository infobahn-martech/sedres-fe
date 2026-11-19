import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import CommonHeader from "../../components/CommonHeader";
import CustomTable from "../../components/customTable";
import useOrderHistoryListReducer from "../../store/OrderHistoryListReducer";
import "../../design/scss/order-history.scss";

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const FieldRow = ({ label, value }) => (
  <div className="order-history-field">
    <span className="order-history-field-label">{label}</span>
    <span className="order-history-field-value">
      {value !== null && value !== undefined && value !== "" ? value : "—"}
    </span>
  </div>
);

FieldRow.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

const getRowId = (row) => row?.inbound_id;

const OrderHistory = () => {
  const { inbounds, landingNotes, dispatchNotes, total, isLoadingList, getAllOrdersSummary } =
    useOrderHistoryListReducer((state) => state);

  const [expandedKeys, setExpandedKeys] = useState(() => new Set());
  const [params, setParams] = useState({
    page: 1,
    limit: 10,
    searchTerm: "",
  });

  const apiParams = useMemo(
    () => ({
      page: params.page,
      limit: params.limit,
      search: params.searchTerm || "",
    }),
    [params.page, params.limit, params.searchTerm]
  );

  useEffect(() => {
    getAllOrdersSummary(apiParams);
  }, [getAllOrdersSummary, apiParams]);

  const getRowKey = useCallback((row, idx) => getRowId(row) ?? idx, []);

  const isRowExpanded = useCallback(
    (_row, rowKey) => expandedKeys.has(rowKey),
    [expandedKeys]
  );

  const onExpandToggle = useCallback((_row, rowKey) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  }, []);

  const renderExpandedRow = useCallback(
    (row) => {
      const items = Array.isArray(row.items) ? row.items : [];
      const landingNote = landingNotes.find((ln) => ln.inbound_id === row.inbound_id);
      const dispatchNote = dispatchNotes.find((dn) => dn.inbound_id === row.inbound_id);

      return (
        <div className="order-history-panel">
          <div className="order-history-panel-title">Items</div>
          <div className="table-responsive order-history-table-wrap">
            <table className="table table-sm table-bordered order-history-chain-table mb-0">
              <thead>
                <tr>
                  <th>Order No</th>
                  <th>PO No</th>
                  <th>Description</th>
                  <th>Package Type</th>
                  <th>Quantity</th>
                  <th>Transportation</th>
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? (
                  items.map((item) => (
                    <tr key={item.inbound_item_id}>
                      <td>{item.order_no ?? "—"}</td>
                      <td>{item.po_no || "—"}</td>
                      <td>{item.description ?? "—"}</td>
                      <td>{item.package_type ?? "—"}</td>
                      <td>{item.quantity ?? "—"}</td>
                      <td>
                        {Number(item.transportation_required) === 1 && item.transportation
                          ? `${item.transportation.from_location_name ?? "—"} → ${item.transportation.to_location_name ?? "—"}`
                          : "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="note-empty-td">No items.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="order-history-sections">
            <div className="order-history-section">
              <div className="order-history-section-title">Landing Note</div>
              {landingNote ? (
                <div className="order-history-fields">
                  <FieldRow label="Document No" value={landingNote.landing_note_no} />
                  <FieldRow label="Date" value={formatDate(landingNote.landing_date)} />
                  <FieldRow label="Received From" value={landingNote.received_from} />
                  <FieldRow label="Status" value={landingNote.status} />
                </div>
              ) : (
                <p className="order-history-not-created">Not created yet.</p>
              )}
            </div>

            <div className="order-history-section">
              <div className="order-history-section-title">Dispatch Note</div>
              {dispatchNote ? (
                <div className="order-history-fields">
                  <FieldRow label="Document No" value={dispatchNote.dispatch_note_no} />
                  <FieldRow label="Date" value={formatDate(dispatchNote.dispatch_date)} />
                  <FieldRow label="Delivered To" value={dispatchNote.delivered_to} />
                  <FieldRow label="Status" value={dispatchNote.status} />
                </div>
              ) : (
                <p className="order-history-not-created">Not created yet.</p>
              )}
            </div>
          </div>
        </div>
      );
    },
    [landingNotes, dispatchNotes]
  );

  const cols = [
    {
      name: "Inbound No",
      selector: "inbound_no",
      tableClasses: "table-striped",
      contentClass: "table-content",
      thclass: "tb-head",
      width: "200",
    },
    {
      name: "Vessel",
      selector: "vessel_name",
      tableClasses: "table-striped",
      contentClass: "table-content",
      thclass: "tb-head",
      width: "200",
      cell: ({ row }) => <span>{row.vessel?.vessel_name ?? "—"}</span>,
    },
    {
      name: "Client",
      selector: "client_name",
      tableClasses: "table-striped",
      contentClass: "table-content",
      thclass: "tb-head",
      width: "200",
      cell: ({ row }) => <span>{row.client?.client_name ?? "—"}</span>,
    },
    {
      name: "Date",
      selector: "inbound_date",
      tableClasses: "table-striped",
      contentClass: "table-content",
      thclass: "tb-head",
      width: "150",
      cell: ({ row }) => <span>{formatDate(row.inbound_date)}</span>,
    },
    {
      name: "Status",
      selector: "status",
      tableClasses: "table-striped",
      contentClass: "table-content",
      thclass: "tb-head",
      width: "150",
    },
  ];

  return (
    <div className="page-body">
      <div className="prospect employee">
        <div className="container-fluid">
          <CommonHeader
            tableTitle="Order History"
            isAddEnabled={false}
            hideSearch={false}
            setSearch={(value) =>
              setParams((prev) => ({ ...prev, searchTerm: value, page: 1 }))
            }
            exportTitle="Export"
            exportLoader={false}
          />
        </div>

        <CustomTable
          Sl
          isLoading={isLoadingList}
          pagination={{ currentPage: params.page, limit: params.limit }}
          tableClasses="px-start"
          count={total}
          columns={cols}
          data={Array.isArray(inbounds) ? inbounds : []}
          expandable
          getRowKey={getRowKey}
          isRowExpanded={isRowExpanded}
          onExpandToggle={onExpandToggle}
          renderExpandedRow={renderExpandedRow}
          onPageChange={(currentPage) =>
            setParams((prev) => ({ ...prev, page: currentPage }))
          }
          setLimit={(newLimit) =>
            setParams((prev) => ({ ...prev, limit: newLimit, page: 1 }))
          }
        />
      </div>
    </div>
  );
};

export default OrderHistory;
