import Gateway from "../gateway/gateway";

const importCrewImmigration = (formData) =>
  Gateway.post("crew/import_crew_immigration", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

const getImmigrationCrewList = (payload) =>
  Gateway.post("crew/get_immigration_crew_list", payload);

const removeImmigrationCrewFile = (payload) =>
  Gateway.post("crew/remove_immigration_crew_file", payload);

export default {
  importCrewImmigration,
  getImmigrationCrewList,
  removeImmigrationCrewFile,
};
