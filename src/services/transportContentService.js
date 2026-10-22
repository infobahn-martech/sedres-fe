import Gateway from "../gateway/gateway";

const createTransportRequest = (formData) =>
  Gateway.post("/transport/create_transport_request", formData);

const updateTransportRequestDetail = (formData) =>
  Gateway.post("/transport/update_transport_request_detail", formData);

const getTransportRequest = (callId) =>
  Gateway.get(`/transport/get_transport_request/${encodeURIComponent(String(callId))}`);

const getTransportRequestDetail = (transportRequestId) =>
  Gateway.get(
    `/transport/get_transport_request_detail/${encodeURIComponent(String(transportRequestId))}`
  );

const getTransportRequestCardDetail = (cardId) =>
  Gateway.get(`/transport/get_transport_request_card_detail/${encodeURIComponent(String(cardId))}`);

const getAllInvoiceBranches = () => Gateway.get("/transport/all_invoice_branches");

/**
 * Normalize transport requests from axios response.
 */
export const extractTransportRequestsFromEnvelope = (responseEnvelope) => {
  const envelope =
    responseEnvelope?.data?.data ?? responseEnvelope?.data ?? [];
  if (Array.isArray(envelope)) return envelope;
  if (Array.isArray(envelope?.data)) return envelope.data;
  if (envelope && typeof envelope === "object") return [envelope];
  return [];
};

/**
 * Flatten work-order transport requests (each with nested `crew[]`) into table rows.
 */
export const flattenTransportRequestRows = (workOrders) => {
  if (!Array.isArray(workOrders) || workOrders.length === 0) return [];

  const hasNestedCrew = workOrders.some((item) => Array.isArray(item?.crew));
  if (!hasNestedCrew) return workOrders;

  const rows = [];
  workOrders.forEach((wo) => {
    const woNumber = wo?.wo_number ?? wo?.woNumber ?? "";
    const transportRequestId = wo?.transport_request_id ?? wo?.id;
    const from =
      wo?.from_location ?? wo?.from ?? wo?.pickup_location ?? "";
    const to = wo?.to_location ?? wo?.to ?? wo?.drop_location ?? "";
    const requestedDate = wo?.pickup_datetime ?? wo?.requested_date ?? "";
    const crewList = Array.isArray(wo?.crew) ? wo.crew : [];

    if (crewList.length === 0) {
      rows.push({
        wo_number: woNumber,
        transport_request_id: transportRequestId,
        from,
        to,
        requested_date: requestedDate,
        status: wo?.status ?? "",
        request_type: wo?.request_type,
      });
      return;
    }

    crewList.forEach((crew) => {
      rows.push({
        ...crew,
        wo_number: woNumber || crew?.wo_number,
        transport_request_id: transportRequestId ?? crew?.transport_request_id,
        transport_crew_id: crew?.transport_crew_id ?? crew?.id,
        from,
        to,
        requested_date: requestedDate || crew?.requested_date,
        status: crew?.pickup_status ?? crew?.status ?? wo?.status,
        crew_name: crew?.crew_name ?? crew?.crewName,
        id:
          crew?.transport_crew_id ??
          `${transportRequestId}-${crew?.crew_change_id}`,
      });
    });
  });

  return rows;
};

export default {
  createTransportRequest,
  updateTransportRequestDetail,
  getTransportRequest,
  getTransportRequestDetail,
  getTransportRequestCardDetail,
  getAllInvoiceBranches,
};
