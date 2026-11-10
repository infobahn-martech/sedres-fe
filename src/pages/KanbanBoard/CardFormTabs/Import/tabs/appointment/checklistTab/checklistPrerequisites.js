/**
 * @param {object} ctx — output of buildChecklistDataContext
 */
export const getPrerequisiteStateFromContext = (ctx) => {
  if (ctx?.useChecklistMock) {
    return { ready: true, key: "ready", canLoadChecklists: true };
  }
  if (ctx?.callDetailLoading) {
    return { ready: false, key: "callDetailLoading", canLoadChecklists: false };
  }

  const hasCall = !isEmptyValue(ctx?.calltypePayload);
  const hasPort = !isEmptyValue(ctx?.portIdForApi);
  const hasVessel = !!ctx?.hasVessel;
  const hasBarge = !!ctx?.hasBarge;

  if (!hasCall) {
    return { ready: false, key: "calltype", canLoadChecklists: false };
  }
  if (!hasPort) {
    return { ready: false, key: "port", canLoadChecklists: false };
  }
  if (!hasVessel && !hasBarge) {
    return { ready: false, key: "vesselBarge", canLoadChecklists: false };
  }
  return { ready: true, key: "ready", canLoadChecklists: true };
};

function isEmptyValue(v) {
  if (v === undefined || v === null) return true;
  if (typeof v === "string" && v.trim() === "") return true;
  return false;
}

