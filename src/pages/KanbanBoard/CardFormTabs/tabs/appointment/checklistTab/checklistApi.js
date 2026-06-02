import { extractChecklistTypeRows } from "./checklistMappers";

/**
 * Normalize axios response for checklist_by_vesseltype / checklist_by_bargetype / checklist_by_port_call.
 * Response body `data` may be an array, a single row object, or the body may be a bare array/row.
 */
export const parseChecklistTypeListResponse = (axiosResponse) => {
  if (!axiosResponse) return [];

  const body = axiosResponse?.data ?? axiosResponse;
  if (body == null) return [];

  // Defensive: some failed axios calls expose { response: { data } } shape.
  const nestedBody = body?.response?.data;
  if (nestedBody != null) {
    return extractChecklistTypeRows(nestedBody);
  }

  return extractChecklistTypeRows(body);
};
