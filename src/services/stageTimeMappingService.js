import Gateway from "../gateway/gateway";

/** GET — { stage_id, stage_name }[] */
const getCallStages = () => Gateway.get("/time_object/get_call_stages");

/** GET — query: search, sort_by, page, limit → { data, pagination: { total, page, limit, total_pages } } */
const getTimeObjectsWithStage = ({ params }) =>
  Gateway.get("/time_object/get_time_objects_with_stage", { params });

/** POST — create / update / clear mappings for a stage+port+call_type */
const mapTimeObjectsToStage = (payload) =>
  Gateway.post("/time_object/map_time_objects_to_stage", payload);

/** POST/GET style endpoint for stage-specific time object list */
const getStageTimeObjects = (payload) =>
  Gateway.post("/time_object/get_stage_time_objects", payload);

export default {
  getCallStages,
  getTimeObjectsWithStage,
  mapTimeObjectsToStage,
  getStageTimeObjects,
};
