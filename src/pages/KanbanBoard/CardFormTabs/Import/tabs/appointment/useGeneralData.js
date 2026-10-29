import { useCallback, useEffect, useRef, useState } from "react";
import callFileService from "../../../../../../services/callFileService";
import portService from "../../../../../../services/portService";
import CommonService from "../../../../../../services/commonService";
import billingEntityService from "../../../../../../services/billingEntityService";
import vesselTypeService from "../../../../../../services/vesselTypeService";
import bargeTypeService from "../../../../../../services/bargeTypeService";
import tugTypeService from "../../../../../../services/tugTypeService";
import vesselService from "../../../../../../services/vesselService";
import checklistService from "../../../../../../services/checklistService";
import {
  unwrapListResponse,
  mapOperatorsToOptions,
  mapPortsToOptions,
  mapCallTypesToOptions,
  mapBillingEntitiesToOptions,
  mapVesselTypesToOptions,
  mapBargeTypesToOptions,
  mapTugTypesToOptions,
  mapVesselsToOptions,
  mapChecklistsToOptions,
} from "../../../../../../shared/helpers/callFileFormOptions";
import { normalizeEntityEmailOptions, normalizeEntityFields } from "./generalHelpers";

// Dropdown catalogues shared by the Add and View variants of the Appointment Details tab, loaded once on mount.
// Vessel/Tug/Barge Name all pull from the same full vessel catalogue (vessel/all_vessels),
// independent of Billing Entity / Vessel Type selections.
export const useGeneralMasterData = () => {
  const [masterDataLoading, setMasterDataLoading] = useState(false);
  const [operatorOptions, setOperatorOptions] = useState([]);
  const [ownerOptions, setOwnerOptions] = useState([]);
  const [portSelectOptions, setPortSelectOptions] = useState([]);
  const [callTypeOptions, setCallTypeOptions] = useState([]);
  const [billingEntitySelectOptions, setBillingEntitySelectOptions] = useState([]);
  const [vesselTypeSelectOptions, setVesselTypeSelectOptions] = useState([]);
  const [bargeTypeSelectOptions, setBargeTypeSelectOptions] = useState([]);
  const [tugTypeSelectOptions, setTugTypeSelectOptions] = useState([]);
  const [allVesselOptions, setAllVesselOptions] = useState([]);
  const [allVesselsLoading, setAllVesselsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchRow = async (label, request, mapFn) => {
      try {
        const { data } = await request;
        const list = unwrapListResponse(data);
        return { label, options: mapFn(list) };
      } catch {
        return { label, options: [] };
      }
    };

    const loadMasterData = async () => {
      setMasterDataLoading(true);
      const results = await Promise.all([
        fetchRow("operators", callFileService.getAllOperators(), mapOperatorsToOptions),
        fetchRow("managers", callFileService.getAllManagers(), mapOperatorsToOptions),
        fetchRow("ports", portService.getPorts({ params: { limit: 1000 } }), mapPortsToOptions),
        fetchRow("callTypes", CommonService.getCallTypes(), mapCallTypesToOptions),
        fetchRow(
          "billingEntities",
          billingEntityService.getBillingEntities({ params: { page: 1, limit: 1000 } }),
          mapBillingEntitiesToOptions
        ),
        fetchRow("vesselTypes", vesselTypeService.getVesselTypes({ params: { limit: 1000 } }), mapVesselTypesToOptions),
        fetchRow("bargeTypes", bargeTypeService.getBargeTypes({ params: { limit: 1000 } }), mapBargeTypesToOptions),
        fetchRow("tugTypes", tugTypeService.getTugTypes({ params: { limit: 1000 } }), mapTugTypesToOptions),
      ]);

      if (cancelled) return;

      for (const { label, options } of results) {
        if (label === "operators") setOperatorOptions(options);
        if (label === "managers") setOwnerOptions(options);
        if (label === "ports") setPortSelectOptions(options);
        if (label === "callTypes") setCallTypeOptions(options);
        if (label === "billingEntities") setBillingEntitySelectOptions(options);
        if (label === "vesselTypes") setVesselTypeSelectOptions(options);
        if (label === "bargeTypes") setBargeTypeSelectOptions(options);
        if (label === "tugTypes") setTugTypeSelectOptions(options);
      }
      setMasterDataLoading(false);
    };

    const loadAllVessels = async () => {
      setAllVesselsLoading(true);
      try {
        const { data } = await vesselService.getAllVessels();
        if (cancelled) return;
        setAllVesselOptions(mapVesselsToOptions(unwrapListResponse(data)));
      } catch {
        if (!cancelled) setAllVesselOptions([]);
      } finally {
        if (!cancelled) setAllVesselsLoading(false);
      }
    };

    loadMasterData();
    void loadAllVessels();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    masterDataLoading,
    operatorOptions,
    ownerOptions,
    portSelectOptions,
    callTypeOptions,
    billingEntitySelectOptions,
    vesselTypeSelectOptions,
    bargeTypeSelectOptions,
    tugTypeSelectOptions,
    allVesselOptions,
    allVesselsLoading,
  };
};

// Checklist options depend only on Call Type + Port; refetch whenever either changes and let the
// caller clear its selections (onSelectionsReset) when a previous pair has been replaced.
export const useChecklistOptions = ({ callTypeId, portId, onSelectionsReset }) => {
  const [checklistOptions, setChecklistOptions] = useState([]);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const checklistRequestIdRef = useRef(0);
  const lastChecklistFetchKeyRef = useRef("");
  const onSelectionsResetRef = useRef(onSelectionsReset);
  onSelectionsResetRef.current = onSelectionsReset;

  useEffect(() => {
    if (!callTypeId || !portId) {
      checklistRequestIdRef.current += 1;
      lastChecklistFetchKeyRef.current = "";
      setChecklistOptions([]);
      setChecklistLoading(false);
      return;
    }

    const fetchKey = `${callTypeId}|${portId}`;
    if (lastChecklistFetchKeyRef.current === fetchKey) return;
    const isRefetch = Boolean(lastChecklistFetchKeyRef.current);
    lastChecklistFetchKeyRef.current = fetchKey;
    if (isRefetch) onSelectionsResetRef.current?.();

    const requestId = (checklistRequestIdRef.current += 1);
    setChecklistLoading(true);
    const loadChecklists = async () => {
      try {
        const { data } = await checklistService.getChecklistsByPortCall({
          calltype: callTypeId,
          port_id: portId,
        });
        if (checklistRequestIdRef.current !== requestId) return;
        setChecklistOptions(mapChecklistsToOptions(unwrapListResponse(data)));
      } catch {
        if (checklistRequestIdRef.current === requestId) setChecklistOptions([]);
      } finally {
        if (checklistRequestIdRef.current === requestId) setChecklistLoading(false);
      }
    };
    void loadChecklists();
  }, [callTypeId, portId]);

  return { checklistOptions, checklistLoading };
};

// Dynamic billing-entity fields (PO number, project, ...) configured per billing entity.
export const useEntityFields = () => {
  const [entityFields, setEntityFields] = useState([]);
  const [entityFieldValues, setEntityFieldValues] = useState({});
  const [entityFieldErrors, setEntityFieldErrors] = useState({});
  const [entityFieldsLoading, setEntityFieldsLoading] = useState(false);
  const [entityFieldsError, setEntityFieldsError] = useState("");

  const fetchEntityFields = useCallback(async (entityId, preservedValues = {}) => {
    const normalizedEntityId = entityId === undefined || entityId === null ? "" : String(entityId).trim();
    if (!normalizedEntityId) {
      setEntityFields([]);
      setEntityFieldValues({});
      setEntityFieldErrors({});
      setEntityFieldsLoading(false);
      setEntityFieldsError("");
      return;
    }

    setEntityFieldsLoading(true);
    setEntityFieldsError("");
    setEntityFieldErrors({});
    try {
      const { data } = await callFileService.getEntityFields(normalizedEntityId);
      const rows = unwrapListResponse(data);
      const normalizedFields = normalizeEntityFields(rows);

      setEntityFields(normalizedFields);
      setEntityFieldValues(() => {
        if (!normalizedFields.length) return {};
        const nextValues = {};
        normalizedFields.forEach((field) => {
          const previousValue = preservedValues?.[field.field_id];
          nextValues[field.field_id] = previousValue === undefined || previousValue === null ? "" : String(previousValue);
        });
        return nextValues;
      });
    } catch {
      setEntityFields([]);
      setEntityFieldValues({});
      setEntityFieldErrors({});
      setEntityFieldsError("Unable to load billing entity fields.");
    } finally {
      setEntityFieldsLoading(false);
    }
  }, []);

  return {
    entityFields,
    setEntityFields,
    entityFieldValues,
    setEntityFieldValues,
    entityFieldErrors,
    setEntityFieldErrors,
    entityFieldsLoading,
    entityFieldsError,
    setEntityFieldsError,
    fetchEntityFields,
  };
};

// Daily-report email options registered against a billing entity.
export const useBillingEntityEmails = () => {
  const [dailyReportEmailOptions, setDailyReportEmailOptions] = useState([]);
  const [dailyReportEmailLoading, setDailyReportEmailLoading] = useState(false);

  const fetchBillingEntityEmails = useCallback(async (entityId) => {
    const normalizedEntityId = entityId === undefined || entityId === null ? "" : String(entityId).trim();
    if (!normalizedEntityId) {
      setDailyReportEmailOptions([]);
      return [];
    }

    setDailyReportEmailLoading(true);
    try {
      const { data } = await billingEntityService.getAllEmailByEntity(normalizedEntityId);
      const opts = normalizeEntityEmailOptions(data);
      setDailyReportEmailOptions(opts);
      return opts;
    } catch {
      setDailyReportEmailOptions([]);
      return [];
    } finally {
      setDailyReportEmailLoading(false);
    }
  }, []);

  return {
    dailyReportEmailOptions,
    setDailyReportEmailOptions,
    dailyReportEmailLoading,
    fetchBillingEntityEmails,
  };
};
