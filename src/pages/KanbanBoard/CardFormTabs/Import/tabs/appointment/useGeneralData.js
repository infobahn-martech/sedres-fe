import { useCallback, useEffect, useRef, useState } from "react";
import callFileService from "@/services/callFileService";
import portService from "@/services/portService";
import CommonService from "@/services/commonService";
import billingEntityService from "@/services/billingEntityService";
import vesselTypeService from "@/services/vesselTypeService";
import bargeTypeService from "@/services/bargeTypeService";
import tugTypeService from "@/services/tugTypeService";
import vesselService from "@/services/vesselService";
import checklistService from "@/services/checklistService";
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
} from "@/shared/helpers/callFileFormOptions";
import { normalizeEntityEmailOptions, normalizeEntityFields } from "./generalHelpers";

// Dropdown catalogues shared by the Add and View variants of the Appointment Details tab, loaded once on mount.
// Vessel/Tug/Barge Name all pull from the same full vessel catalogue (vessel/all_vessels),
// independent of Billing Entity / Vessel Type selections.
// `enabled: false` (template mode, where form_template/first_tab supplies every field and option)
// skips the catalogue requests; they load once, the first time the hook becomes enabled.
export const useGeneralMasterData = ({ enabled = true } = {}) => {
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
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!enabled || hasLoadedRef.current) return undefined;
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

    // Marked loaded only once both requests finish, so an abandoned run (unmount / disabled) retries later.
    Promise.all([loadMasterData(), loadAllVessels()]).then(() => {
      if (!cancelled) hasLoadedRef.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

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

// Short-lived cache for the small catalogues used by the read-only view, so reopening cards
// doesn't refetch the same lists every time.
const VIEW_LOOKUP_TTL_MS = 5 * 60 * 1000;
const viewLookupCache = new Map();
const cachedLookup = (key, loader) => {
  const hit = viewLookupCache.get(key);
  if (hit && Date.now() - hit.at < VIEW_LOOKUP_TTL_MS) return hit.promise;
  const promise = loader().catch((err) => {
    viewLookupCache.delete(key);
    throw err;
  });
  viewLookupCache.set(key, { at: Date.now(), promise });
  return promise;
};

const loadOptions = (key, request, mapFn) =>
  cachedLookup(key, async () => {
    const { data } = await request();
    return mapFn(unwrapListResponse(data));
  }).catch(() => []);

const loadBillingEntityOption = (entityId) =>
  cachedLookup(`billingEntity:${entityId}`, async () => {
    const { data } = await billingEntityService.getEntityDetailById(entityId);
    const raw = data?.data ?? data;
    const row = Array.isArray(raw) ? raw[0] : raw;
    if (!row) return [];
    return mapBillingEntitiesToOptions([{ ...row, entity_id: row.entity_id ?? entityId }]);
  }).catch(() => []);

const VIEW_LOOKUP_LOADERS = {
  operators: () => loadOptions("operators", callFileService.getAllOperators, mapOperatorsToOptions),
  managers: () => loadOptions("managers", callFileService.getAllManagers, mapOperatorsToOptions),
  ports: () => loadOptions("ports", () => portService.getPorts({ params: { limit: 1000 } }), mapPortsToOptions),
  callTypes: () => loadOptions("callTypes", CommonService.getCallTypes, mapCallTypesToOptions),
  vesselTypes: () =>
    loadOptions("vesselTypes", () => vesselTypeService.getVesselTypes({ params: { limit: 1000 } }), mapVesselTypesToOptions),
  bargeTypes: () =>
    loadOptions("bargeTypes", () => bargeTypeService.getBargeTypes({ params: { limit: 1000 } }), mapBargeTypesToOptions),
  tugTypes: () =>
    loadOptions("tugTypes", () => tugTypeService.getTugTypes({ params: { limit: 1000 } }), mapTugTypesToOptions),
  vessels: () => loadOptions("vessels", vesselService.getAllVessels, mapVesselsToOptions),
};

// Read-only variant of useGeneralMasterData: only loads the catalogues whose labels the view will
// actually display (`catalogues`), and resolves billing entities one-by-one instead of pulling the full list.
export const useGeneralViewLookups = ({ enabled, catalogues = [], billingEntityIds = [] }) => {
  const [lookups, setLookups] = useState({});
  const [loading, setLoading] = useState(false);
  const cataloguesKey = [...new Set(catalogues.filter((name) => VIEW_LOOKUP_LOADERS[name]))].sort().join(",");
  const entityKey = [...new Set(billingEntityIds.map((id) => String(id ?? "").trim()).filter(Boolean))].sort().join(",");

  useEffect(() => {
    if (!enabled) return undefined;
    const names = cataloguesKey ? cataloguesKey.split(",") : [];
    const entityIds = entityKey ? entityKey.split(",") : [];
    if (!names.length && !entityIds.length) {
      setLookups({});
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    Promise.all([
      Promise.all(names.map((name) => VIEW_LOOKUP_LOADERS[name]())),
      Promise.all(entityIds.map(loadBillingEntityOption)),
    ]).then(([catalogueResults, entityResults]) => {
      if (cancelled) return;
      const next = {};
      names.forEach((name, index) => {
        next[name] = catalogueResults[index];
      });
      next.billingEntities = entityResults.flat();
      setLookups(next);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, cataloguesKey, entityKey]);

  return {
    lookupsLoading: loading,
    operatorOptions: lookups.operators ?? [],
    ownerOptions: lookups.managers ?? [],
    portSelectOptions: lookups.ports ?? [],
    callTypeOptions: lookups.callTypes ?? [],
    billingEntitySelectOptions: lookups.billingEntities ?? [],
    vesselTypeSelectOptions: lookups.vesselTypes ?? [],
    bargeTypeSelectOptions: lookups.bargeTypes ?? [],
    tugTypeSelectOptions: lookups.tugTypes ?? [],
    allVesselOptions: lookups.vessels ?? [],
  };
};

// Checklist options depend only on Call Type + Port; refetch whenever either changes and let the
// caller clear its selections (onSelectionsReset) when a previous pair has been replaced.
export const useChecklistOptions = ({ callTypeId, portId, onSelectionsReset, enabled = true }) => {
  const [checklistOptions, setChecklistOptions] = useState([]);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const checklistRequestIdRef = useRef(0);
  const lastChecklistFetchKeyRef = useRef("");
  const onSelectionsResetRef = useRef(onSelectionsReset);
  onSelectionsResetRef.current = onSelectionsReset;

  useEffect(() => {
    if (!enabled || !callTypeId || !portId) {
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
  }, [enabled, callTypeId, portId]);

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
