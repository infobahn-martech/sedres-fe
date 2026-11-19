/**
 * Helpers that turn a service's request list (one item per request, crew nested in `crew[]`)
 * into the groups CrewPassRequestsTable renders as cards.
 */

export const isBlankValue = (value) => value === undefined || value === null || String(value).trim() === "";

/** "18 Nov 2026" (or "18 Nov 2026, 10:30" with time) from an API date / datetime string. */
export const formatCardDate = (value, { withTime = false } = {}) => {
  if (isBlankValue(value)) return "";
  const raw = String(value).trim();
  const parsed = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return raw;
  const hasTime = withTime && /\d{2}:\d{2}/.test(raw);
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(hasTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  });
};

const pickRequestDocument = (request) =>
  request?.request_email_url || request?.request_email || request?.document_url || request?.documentUrl || "";

/**
 * @param {Array} requests  raw API list
 * @param {Object} options
 * @param {(request) => any} options.getId         request id (card key)
 * @param {(crew, request) => any} [options.getCrewStatus]  per-crew status (shown only when it differs from the request's)
 * @param {(request) => Object} [options.getDetails] extra fields copied onto the group for titles/facts
 */
export const buildRequestCardGroups = (requests, { getId, getCrewStatus, getDetails }) =>
  (Array.isArray(requests) ? requests : []).map((request, index) => {
    const id = getId(request) ?? `request-${index}`;
    // Legacy flat payloads have no crew[]: the request row itself is the single crew entry.
    const crewSource = Array.isArray(request?.crew) ? request.crew : [request];
    return {
      woId: id,
      woNumber: "",
      woStatus: request?.status,
      requestDocumentUrl: pickRequestDocument(request),
      ...(getDetails ? getDetails(request) : {}),
      crew: crewSource.map((member, crewIndex) => ({
        ...member,
        id: member?.crew_change_id ?? member?.id ?? `${id}-${crewIndex}`,
        crew_name: member?.crew_name ?? member?.crewName,
        status: getCrewStatus ? getCrewStatus(member, request) : member?.status,
      })),
    };
  });

/** Second line under a crew name: rank, or a muted placeholder. */
export const crewRankMeta = (row) =>
  isBlankValue(row?.rank) ? <span className="cpr-muted">Rank not provided</span> : row.rank;
