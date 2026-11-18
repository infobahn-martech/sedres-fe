import { useCallback, useState } from "react";
import { notify } from "@/components/Toaster";

export const REQUEST_EMAIL_REQUIRED_MESSAGE = "Request email is required. Please attach the request email.";
export const CREW_REQUIRED_MESSAGE = "Crew is required. Please add at least one crew member.";

const hasAttachedFile = (attachments) =>
  Array.isArray(attachments) && attachments.some((attachment) => (attachment?.file ?? attachment) instanceof File);

const hasSelectedCrew = (crew) => Array.isArray(crew) && crew.length > 0;

/**
 * Inline "Request Email" / "Crew" validation shared by every husbandry service form.
 * Messages appear only after a Save attempt, then update live from formValues
 * (so they disappear as soon as the field is filled in).
 */
export function useRequestEmailCrewValidation(formValues, { requestEmailField, crewField }) {
  const [showErrors, setShowErrors] = useState(false);

  const getErrors = useCallback(
    () => ({
      requestEmail: requestEmailField && !hasAttachedFile(formValues?.[requestEmailField]) ? REQUEST_EMAIL_REQUIRED_MESSAGE : "",
      crew: crewField && !hasSelectedCrew(formValues?.[crewField]) ? CREW_REQUIRED_MESSAGE : "",
    }),
    [formValues, requestEmailField, crewField]
  );

  const errors = showErrors ? getErrors() : { requestEmail: "", crew: "" };

  /** Call at the start of Save. Shows the inline messages and returns false when anything is missing. */
  const validate = useCallback(() => {
    setShowErrors(true);
    const current = getErrors();
    const isValid = !current.requestEmail && !current.crew;
    if (!isValid) {
      notify("Please fill in the required fields.", "error", "top-center");
      // The fields sit at the top of the form; bring the first flagged one into view once it renders.
      setTimeout(() => {
        document.querySelector(".husb-group.has-error")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    }
    return isValid;
  }, [getErrors]);

  /** Call after a successful save (the form is cleared, so don't flag the empty fields). */
  const resetValidation = useCallback(() => setShowErrors(false), []);

  return { errors, validate, resetValidation };
}

export default useRequestEmailCrewValidation;
