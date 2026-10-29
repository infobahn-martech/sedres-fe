import { useState, useEffect, Fragment } from "react";
import PropTypes from "prop-types";
import { FiPackage, FiAnchor, FiTruck, FiCheck } from "react-icons/fi";
import CardTabListLoading from "../../../../../../../components/CardTabListLoading";
import inboundOrderService from "../../../../../../../services/inboundOrderService";
import orderHistoryService from "../../../../../../../services/orderHistoryService";
import "../../../../../../../design/scss/order-history.scss";

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const OrderHistoryContent = ({ formValues, cardColor }) => {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [chainLoadingIds, setChainLoadingIds] = useState(() => new Set());
  const [chainCache, setChainCache] = useState({});

  const callId = Number(formValues?.call_id || formValues?.callId || formValues?.card_call_id || 0);

  useEffect(() => {
    if (!callId) return;
    setIsLoading(true);
    inboundOrderService
      .getAllInboundSummary(callId)
      .then((res) => {
        setOrders(res?.data?.data ?? []);
      })
      .catch(() => setOrders([]))
      .finally(() => setIsLoading(false));
  }, [callId]);

  const fetchChain = async (inboundId) => {
    setChainLoadingIds((prev) => new Set(prev).add(inboundId));
    try {
      const res = await orderHistoryService.getOrderHistory("inbound", inboundId);
      setChainCache((prev) => ({ ...prev, [inboundId]: res?.data?.data ?? null }));
    } catch {
      setChainCache((prev) => ({ ...prev, [inboundId]: null }));
    } finally {
      setChainLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(inboundId);
        return next;
      });
    }
  };

  const toggleExpand = (order) => {
    const id = order.inbound_id;
    const isExpanding = !expandedIds.has(id);

    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

    if (isExpanding && chainCache[id] === undefined) {
      fetchChain(id);
    }
  };

  const renderChainSections = (order) => {
    const id = order.inbound_id;
    if (chainLoadingIds.has(id)) {
      return <CardTabListLoading message="Loading details..." cardColor={cardColor} />;
    }

    const chain = chainCache[id];
    const landingNote = chain?.landing_note;
    const dispatchNote = chain?.dispatch_note;
    const entries = [
      {
        key: "landing",
        type: "Landing Note",
        documentNo: landingNote?.document_no,
        date: formatDate(landingNote?.landing_date || landingNote?.date),
        party: landingNote?.received_from,
        quantity: landingNote?.quantity,
        created: !!landingNote,
      },
      {
        key: "dispatch",
        type: "Dispatch Note",
        documentNo: dispatchNote?.document_no,
        date: formatDate(dispatchNote?.dispatch_date || dispatchNote?.date),
        party: dispatchNote?.delivered_to,
        quantity: dispatchNote?.quantity,
        created: !!dispatchNote,
      },
    ];

    const steps = [
      {
        key: "inbound",
        label: "Inbound Order",
        icon: FiPackage,
        done: true,
        documentNo: order.inbound_no,
        date: formatDate(order.inbound_date),
      },
      {
        key: "landing",
        label: "Landing Note",
        icon: FiAnchor,
        done: !!landingNote,
        documentNo: landingNote?.document_no,
        date: formatDate(landingNote?.landing_date || landingNote?.date),
        party: landingNote?.received_from,
      },
      {
        key: "dispatch",
        label: "Dispatch Note",
        icon: FiTruck,
        done: !!dispatchNote,
        documentNo: dispatchNote?.document_no,
        date: formatDate(dispatchNote?.dispatch_date || dispatchNote?.date),
        party: dispatchNote?.delivered_to,
      },
    ];

    return (
      <div className="order-history-panel">
        <div className="order-history-panel-title">Order chain</div>
        <div className="table-responsive order-history-table-wrap">
          <table className="table table-sm table-bordered order-history-chain-table mb-0">
            <thead>
              <tr>
                <th>Type</th>
                <th>Document No</th>
                <th>Date</th>
                <th>Party</th>
                <th>Quantity</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.key}>
                  <td>{entry.type}</td>
                  <td>{entry.created ? entry.documentNo ?? "—" : "Not created yet"}</td>
                  <td>{entry.created ? entry.date : "—"}</td>
                  <td>{entry.created ? entry.party ?? "—" : "—"}</td>
                  <td>{entry.created ? entry.quantity ?? "—" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="order-history-timeline order-history-timeline--sm">
          {steps.map((step, idx) => {
            const StepIcon = step.icon;
            return (
              <Fragment key={step.key}>
                <div className={`order-history-step${step.done ? " is-done" : " is-pending"}`}>
                  <div className="order-history-step-icon">
                    {step.done ? <FiCheck /> : <StepIcon />}
                  </div>
                  <div className="order-history-step-body">
                    <div className="order-history-step-label">{step.label}</div>
                    {step.done ? (
                      <>
                        <div className="order-history-step-doc">{step.documentNo ?? "—"}</div>
                        <div className="order-history-step-date">{step.date}</div>
                        {step.party ? <div className="order-history-step-party">{step.party}</div> : null}
                      </>
                    ) : (
                      <div className="order-history-step-empty">Not created yet</div>
                    )}
                  </div>
                </div>
                {idx < steps.length - 1 ? (
                  <div className={`order-history-step-connector${steps[idx + 1].done ? " is-done" : ""}`} />
                ) : null}
              </Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="cardform-left-full material-management-content-wrapper" style={{ "--card-color": cardColor }}>
      <div className="material-list-header">
        <h3 className="material-list-title">
          <span className="material-list-title-bar"></span>
          Order History
        </h3>
      </div>
      <div className="table-wrapper table-responsive material-table-container note-table-container">
        <div className="note-table-scroll">
          {isLoading ? (
            <CardTabListLoading message="Loading orders..." cardColor={cardColor} />
          ) : (
            <table className="table table-striped material-table inbound-table note-table">
              <thead className="note-thead">
                <tr>
                  <th width="44" className="custom-table-expand-header" aria-label="Expand row" />
                  <th>Inbound Order No</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.length > 0 ? (
                  orders.map((order) => {
                    const isExpanded = expandedIds.has(order.inbound_id);
                    return (
                      <Fragment key={order.inbound_id}>
                        <tr className="order-history-row">
                          <td className="custom-table-expand-cell">
                            <button
                              type="button"
                              className="order-history-expand-toggle"
                              aria-expanded={isExpanded}
                              aria-label={isExpanded ? "Collapse row" : "Expand row"}
                              onClick={() => toggleExpand(order)}
                            >
                              <span className={`custom-table-expand-chevron${isExpanded ? " is-open" : ""}`} />
                            </button>
                          </td>
                          <td>
                            <div className="material-table-cell">{order.inbound_no || "—"}</div>
                          </td>
                          <td>
                            <div className="material-table-cell">{formatDate(order.inbound_date)}</div>
                          </td>
                          <td>
                            <div className="material-table-cell">{order.status || "—"}</div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="custom-table-expanded-row">
                            <td colSpan={4} className="p-0">
                              <div className="custom-table-expanded-inner">
                                {renderChainSections(order)}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="4" className="note-empty-td">
                      No order history available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

OrderHistoryContent.propTypes = {
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func,
  cardColor: PropTypes.string,
};

export default OrderHistoryContent;
