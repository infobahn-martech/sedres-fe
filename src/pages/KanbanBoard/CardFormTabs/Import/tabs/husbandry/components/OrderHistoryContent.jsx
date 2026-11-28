import { useState, useEffect, Fragment } from "react";
import PropTypes from "prop-types";
import { FiPackage, FiAnchor, FiTruck, FiCheck, FiChevronDown, FiAlertCircle } from "react-icons/fi";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import GroupSettingsIcon from "@/assets/images/cv.png";
import { FormSection, PremiumCardHeader } from "./Husbandry.components";
import { MAIN_TABS, SERVICE_ACCENT } from "./Husbandry.constants";
import inboundOrderService from "@/services/inboundOrderService";
import orderHistoryService from "@/services/orderHistoryService";
import { splitApiDateTimeParts } from "@/shared/helpers/dateTimeFieldUtils";
import "@/design/scss/order-history.scss";

const MATERIAL_ACCENT = SERVICE_ACCENT[MAIN_TABS.MATERIAL_MANAGEMENT];
const CHAIN_ERROR = "__error__";

/** "28 Nov 2026" + weekday, or null when the API value isn't a real date. */
const dateParts = (raw) => {
  const { date } = splitApiDateTimeParts(raw || "", "");
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  return {
    date: dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    weekday: dt.toLocaleDateString("en-GB", { weekday: "long" }),
  };
};

const formatShortDate = (raw) => dateParts(raw)?.date || "—";

// Tone is cosmetic only — unknown statuses fall back to neutral.
const statusTone = (status) => {
  const raw = String(status ?? "").trim().toLowerCase();
  if (!raw) return "neutral";
  if (["completed", "dispatched", "done", "closed", "delivered"].includes(raw)) return "success";
  if (["landed", "received", "in progress", "in_progress"].includes(raw)) return "info";
  if (["pending", "draft"].includes(raw)) return "warning";
  if (["cancelled", "canceled", "rejected"].includes(raw)) return "danger";
  if (raw === "submitted") return "primary";
  return "neutral";
};

const splitOrderNo = (orderNo) => {
  const value = String(orderNo || "");
  const at = value.lastIndexOf("-");
  return at > 0 ? { prefix: value.slice(0, at + 1), tail: value.slice(at + 1) } : { prefix: "", tail: value };
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
    if (chainLoadingIds.has(inboundId)) return;
    setChainLoadingIds((prev) => new Set(prev).add(inboundId));
    try {
      const res = await orderHistoryService.getOrderHistory("inbound", inboundId);
      setChainCache((prev) => ({ ...prev, [inboundId]: res?.data?.data ?? null }));
    } catch {
      setChainCache((prev) => ({ ...prev, [inboundId]: CHAIN_ERROR }));
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

  const renderStage = (stage, idx, stages) => {
    const StageIcon = stage.icon;
    const fields = [
      { label: "Document no.", value: stage.documentNo },
      { label: "Date", value: stage.date },
      ...(stage.partyLabel ? [{ label: stage.partyLabel, value: stage.party }] : []),
      ...(stage.showQuantity ? [{ label: "Quantity", value: stage.quantity }] : []),
    ];
    return (
      <Fragment key={stage.key}>
        <li className={`oh-stage${stage.done ? " is-done" : " is-pending"}`}>
          <div className="oh-stage__head">
            <span className="oh-stage__icon" aria-hidden="true">
              {stage.done ? <FiCheck size={14} /> : <StageIcon size={14} />}
            </span>
            <span className="oh-stage__label">{stage.label}</span>
            <span className={`oh-stage__state${stage.done ? " is-done" : ""}`}>
              {stage.done ? "Created" : "Pending"}
            </span>
          </div>
          {stage.done ? (
            <dl className="oh-stage__fields">
              {fields.map(({ label, value }) => (
                <div className="oh-stage__field" key={label}>
                  <dt>{label}</dt>
                  <dd title={value != null && value !== "" ? String(value) : undefined}>
                    {value != null && value !== "" ? value : <span className="oh-muted">—</span>}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="oh-stage__empty">Not created yet</p>
          )}
        </li>
        {idx < stages.length - 1 && (
          <li
            className={`oh-stage-connector${stages[idx + 1].done ? " is-done" : ""}`}
            aria-hidden="true"
          />
        )}
      </Fragment>
    );
  };

  const renderChain = (order) => {
    const id = order.inbound_id;
    const chain = chainCache[id];

    if (chainLoadingIds.has(id) || chain === undefined) {
      return (
        <div className="oh-chain oh-chain--loading" aria-busy="true">
          <Skeleton height={112} borderRadius={10} count={1} />
          <Skeleton height={112} borderRadius={10} count={1} />
          <Skeleton height={112} borderRadius={10} count={1} />
        </div>
      );
    }

    if (chain === CHAIN_ERROR) {
      return (
        <div className="oh-chain-error" role="alert">
          <FiAlertCircle size={16} aria-hidden="true" />
          <span>Couldn&apos;t load the order chain.</span>
          <button type="button" onClick={() => fetchChain(id)}>
            Retry
          </button>
        </div>
      );
    }

    const landingNote = chain?.landing_note;
    const dispatchNote = chain?.dispatch_note;
    const stages = [
      {
        key: "inbound",
        label: "Inbound order",
        icon: FiPackage,
        done: true,
        documentNo: order.inbound_no,
        date: formatShortDate(order.inbound_date),
      },
      {
        key: "landing",
        label: "Landing note",
        icon: FiAnchor,
        done: !!landingNote,
        documentNo: landingNote?.document_no,
        date: formatShortDate(landingNote?.landing_date || landingNote?.date),
        partyLabel: "Received from",
        party: landingNote?.received_from,
        showQuantity: true,
        quantity: landingNote?.quantity,
      },
      {
        key: "dispatch",
        label: "Dispatch note",
        icon: FiTruck,
        done: !!dispatchNote,
        documentNo: dispatchNote?.document_no,
        date: formatShortDate(dispatchNote?.dispatch_date || dispatchNote?.date),
        partyLabel: "Delivered to",
        party: dispatchNote?.delivered_to,
        showQuantity: true,
        quantity: dispatchNote?.quantity,
      },
    ];

    return <ol className="oh-chain">{stages.map(renderStage)}</ol>;
  };

  return (
    <div className="cardform-left-full" style={{ "--card-color": cardColor }}>
      <FormSection icon={GroupSettingsIcon} title="">
        <div className="pre-arrival-form material-notes-form">
          <div className="general-info-two-column operation-section-form-layout crew-pass-premium-grid material-notes-grid--list-only">
            <div className="general-info-right crew-pass-requests-sidebar">
              <div
                className={`crew-pass-requests-table-card husb-accent-${MATERIAL_ACCENT} order-history-card`}
                role="region"
                aria-label="Order history"
              >
                <PremiumCardHeader
                  icon="list"
                  title="Order history"
                  subtitle="Inbound → landing → dispatch progress for every order on this job"
                  count={orders.length || undefined}
                  headerClassName="crew-pass-requests-table-card__header"
                  titleClassName="crew-pass-requests-table-card__title"
                />
                <div className="crew-pass-requests-table-card__body">
                  {isLoading ? (
                    <div className="crew-pass-requests-table-card__skeleton" aria-busy="true">
                      <Skeleton height={14} borderRadius={6} count={1} style={{ marginBottom: 12 }} />
                      <Skeleton height={48} borderRadius={6} count={5} />
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="crew-pass-requests-table-card__empty">No order history available</div>
                  ) : (
                    <div className="crew-pass-requests-table-scroll crew-pass-thin-scrollbar">
                      <table className="oh-table">
                        <colgroup>
                          <col />
                          <col className="oh-table__col-date" />
                          <col className="oh-table__col-status" />
                          <col className="oh-table__col-toggle" />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>Inbound order no.</th>
                            <th>Date</th>
                            <th>Status</th>
                            <th aria-label="Details" />
                          </tr>
                        </thead>
                        <tbody>
                          {orders.map((order) => {
                            const isExpanded = expandedIds.has(order.inbound_id);
                            const { prefix, tail } = splitOrderNo(order.inbound_no);
                            const when = dateParts(order.inbound_date);
                            const detailsId = `oh-chain-${order.inbound_id}`;
                            return (
                              <Fragment key={order.inbound_id}>
                                <tr
                                  className={`oh-row${isExpanded ? " is-open" : ""}`}
                                  onClick={() => toggleExpand(order)}
                                >
                                  <td>
                                    {order.inbound_no ? (
                                      <span className="oh-order-no" title={order.inbound_no}>
                                        {prefix && <span className="oh-order-no__prefix">{prefix}</span>}
                                        <span className="oh-order-no__tail">{tail}</span>
                                      </span>
                                    ) : (
                                      <span className="oh-muted">—</span>
                                    )}
                                  </td>
                                  <td>
                                    {when ? (
                                      <div className="oh-stack">
                                        <span className="oh-stack__primary">{when.date}</span>
                                        <span className="oh-stack__secondary">{when.weekday}</span>
                                      </div>
                                    ) : (
                                      <span className="oh-muted">—</span>
                                    )}
                                  </td>
                                  <td>
                                    {order.status ? (
                                      <span className={`oh-status oh-status--${statusTone(order.status)}`}>
                                        {order.status}
                                      </span>
                                    ) : (
                                      <span className="oh-muted">—</span>
                                    )}
                                  </td>
                                  <td className="oh-table__toggle-cell">
                                    <button
                                      type="button"
                                      className="oh-toggle"
                                      aria-expanded={isExpanded}
                                      aria-controls={detailsId}
                                      aria-label={isExpanded ? "Hide order chain" : "Show order chain"}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleExpand(order);
                                      }}
                                    >
                                      <FiChevronDown size={16} />
                                    </button>
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr className="oh-details-row" id={detailsId}>
                                    <td colSpan={4}>{renderChain(order)}</td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </FormSection>
    </div>
  );
};

OrderHistoryContent.propTypes = {
  formValues: PropTypes.object.isRequired,
  handleChange: PropTypes.func,
  cardColor: PropTypes.string,
};

export default OrderHistoryContent;
