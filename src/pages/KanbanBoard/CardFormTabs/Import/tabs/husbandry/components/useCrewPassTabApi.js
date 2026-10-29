import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { notify } from "../../../../../../../components/Toaster";
import {
  createPassRequest,
  extractPassRequestsFromEnvelope,
  getPassRequests,
} from "../../../../../../../services/cgAndZwailpassService";

export const resolvePassCallId = (formValues, card, routeParams) => {
  const raw =
    formValues?.call_id ??
    formValues?.callId ??
    card?.call_id ??
    card?.id ??
    card?.callId ??
    routeParams?.call_id;
  if (raw === undefined || raw === null) return "";
  return String(raw).trim();
};

export const resolvePassVesselId = (formValues, card, routeParams) => {
  const raw =
    formValues?.vessel_id ??
    formValues?.vesselId ??
    card?.vessel_id ??
    card?.vesselId ??
    routeParams?.vessel_id;
  if (raw === undefined || raw === null) return "";
  return String(raw).trim();
};

const pickBackendErrorMessage = (error) => {
  const data = error?.response?.data;
  if (typeof data === "string" && data.trim()) return data.trim();
  if (data?.message && typeof data.message === "string") return data.message;
  if (data?.error && typeof data.error === "string") return data.error;
  if (error?.message && typeof error.message === "string") return error.message;
  return "Something went wrong. Please try again.";
};

/**
 * Shared pass-request save + history fetch for CG Pass and Zawil Pass tabs.
 */
export function useCrewPassTabApi({
  passType,
  formValues,
  card,
  remarksField,
  documentsField,
  requestEmailFileField,
  crewField,
}) {
  const routeParams = useParams();
  const [saving, setSaving] = useState(false);
  const [passRequests, setPassRequests] = useState({ cg: [], zawil: [] });
  const [passRequestsLoading, setPassRequestsLoading] = useState(false);
  const callId = resolvePassCallId(formValues, card, routeParams);

  const fetchPassRequests = useCallback(async () => {
    if (!callId) {
      setPassRequests({ cg: [], zawil: [] });
      setPassRequestsLoading(false);
      return;
    }
    setPassRequestsLoading(true);
    try {
      const response = await getPassRequests(callId);
      const next = extractPassRequestsFromEnvelope(response);
      setPassRequests(next);
    } catch {
      setPassRequests({ cg: [], zawil: [] });
    } finally {
      setPassRequestsLoading(false);
    }
  }, [callId]);

  useEffect(() => {
    void fetchPassRequests();
  }, [fetchPassRequests, callId]);

  const handleSave = useCallback(async () => {
    const callId = resolvePassCallId(formValues, card, routeParams);
    if (!callId) {
      notify("Call ID is required before saving.", "error", "top-center");
      return;
    }

    let requestEmailFile = null;
    if (requestEmailFileField) {
      const attachments = Array.isArray(formValues?.[requestEmailFileField])
        ? formValues[requestEmailFileField]
        : [];
      requestEmailFile = attachments
        .map((a) => a?.file ?? a)
        .find((f) => f instanceof File);
      if (!requestEmailFile) {
        notify("Request email file is required.", "error", "top-center");
        return;
      }
    }

    const remarksRaw = formValues?.[remarksField];
    const remarks =
      remarksRaw === undefined || remarksRaw === null
        ? ""
        : String(remarksRaw);

    const documents = Array.isArray(formValues?.[documentsField])
      ? formValues[documentsField]
      : [];

    const formData = new FormData();
    formData.append("call_id", callId);
    if (requestEmailFileField && requestEmailFile) {
      formData.append("request_email", requestEmailFile);
    }
    formData.append("pass_type", passType);
    formData.append("remarks", remarks || "");

    if (crewField) {
      const crewIds = Array.isArray(formValues?.[crewField]) ? formValues[crewField] : [];
      formData.append("crew_change_ids", JSON.stringify(crewIds.map(Number)));
    }

    let docIndex = 0;
    documents.forEach((attachment) => {
      const file = attachment?.file ?? attachment;
      if (file instanceof File) {
        formData.append(`documents[${docIndex}]`, file);
        docIndex += 1;
      }
    });

    setSaving(true);
    try {
      await createPassRequest(formData);
      notify("Pass request saved successfully.", "success", "top-center");
      await fetchPassRequests();
    } catch (err) {
      notify(pickBackendErrorMessage(err), "error", "top-center");
    } finally {
      setSaving(false);
    }
  }, [
    card,
    crewField,
    documentsField,
    formValues,
    passType,
    remarksField,
    requestEmailFileField,
    routeParams,
    fetchPassRequests,
  ]);

  return {
    saving,
    handleSave,
    passRequests,
    passRequestsLoading,
    refetchPassRequests: fetchPassRequests,
    callId,
  };
}
