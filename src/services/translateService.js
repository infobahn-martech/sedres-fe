import Gateway from "../gateway/gateway";

/** POST translate/to_arabic — { value } -> { value, translated_value } */
const translateToArabic = (value) => Gateway.post("translate/to_arabic", { value });

/** POST translate/to_english — { value } -> { value, translated_value } */
const translateToEnglish = (value) => Gateway.post("translate/to_english", { value });

export default {
  translateToArabic,
  translateToEnglish,
};
