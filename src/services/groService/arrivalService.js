import Gateway from "../../gateway/gateway";

/** POST arrival/save_arrival_document — GRO task popover save */
export const saveArrivalDocument = (formData) =>
  Gateway.post("arrival/save_arrival_document", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

const groArrivalService = {
  saveArrivalDocument,
};

export default groArrivalService;
