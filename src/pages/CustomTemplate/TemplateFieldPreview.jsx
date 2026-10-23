import { useId, useState } from "react";
import SearchableSelect from "../../components/form/SearchableSelect";
import DatePickerField from "../KanbanBoard/CardFormTabs/shared/components/DatePickerField";
import DateTimePickerField from "../KanbanBoard/CardFormTabs/shared/components/DateTimePickerField";
import { DocumentUpload, OwnerField } from "../KanbanBoard/CardFormTabs/Import/tabs/appointment/GeneralFormFields";

// A required checkbox group only needs one ticked option, not every checkbox.
export const isCheckboxGroupValid = (field, selected) => !field.required || selected.length > 0;

// Options are rendered by label; when the field carries option_values (live card form)
// they are what gets selected/submitted, otherwise the label doubles as the value.
const getOptionValue = (field, index, label) => field.optionValues?.[index] ?? label;

// Datetime values keep the "YYYY-MM-DDTHH:mm" shape the native datetime-local input produced,
// so the submitted payload is unchanged.
const splitDateTimeValue = (value) => {
    const [date = "", time = ""] = String(value ?? "").trim().split(/[T ]/);
    return { date, time: time.slice(0, 5) };
};
const joinDateTimeValue = ({ date, time }) => (date && time ? `${date}T${time}` : "");

// Multi-select checkbox group: each option toggles independently and the
// selection is kept as an array of option values. Controlled when onChange is given.
function CheckboxGroupPreview({ field, label, requiredMark, value, onChange, fieldClassName, errorNode }) {
    const [localSelected, setLocalSelected] = useState([]);
    const isControlled = typeof onChange === "function";
    const selected = isControlled ? (Array.isArray(value) ? value : []) : localSelected;
    const toggle = (optValue) => {
        const next = selected.includes(optValue)
            ? selected.filter((o) => o !== optValue)
            : [...selected, optValue];
        if (isControlled) onChange(next);
        else setLocalSelected(next);
    };
    return (
        <div className={`${fieldClassName} ct-preview-span-full`}>
            <label>{label}{requiredMark}</label>
            <div
                className="ct-preview-radio-mock"
                role="group"
                aria-required={field.required || undefined}
                aria-invalid={!isCheckboxGroupValid(field, selected) || undefined}
            >
                {field.options.map((opt, i) => {
                    const optValue = getOptionValue(field, i, opt);
                    return (
                        <label key={i} className="ct-preview-check-mock">
                            <input
                                type="checkbox"
                                checked={selected.includes(optValue)}
                                onChange={() => toggle(optValue)}
                            />
                            <span>{opt}</span>
                        </label>
                    );
                })}
            </div>
            {errorNode}
        </div>
    );
}

// Renders a template field the same way the live kanban card renders it
// (cf-field/cf-input, matching Call Type Builder's own live-preview fields)
// so the template preview is pixel-identical to the real card. Shared by the
// Custom Templates list preview, the Custom Template builder's live preview and,
// controlled via value/onChange, the Add Card form when a template is selected.
function TemplateFieldPreview({ field, value, onChange, error = "" }) {
    const radioName = useId();
    const label = field.label;
    const requiredMark = field.required && <span className="text-danger">*</span>;
    const isControlled = typeof onChange === "function";
    const fieldClassName = `cf-field${error ? " has-error" : ""}`;
    const inputClassName = `cf-input${error ? " is-invalid" : ""}`;
    const errorNode = error ? <div className="cf-field-error">{error}</div> : null;
    // Spread onto text-like inputs: binds value/onChange only in controlled mode.
    const textBinding = isControlled
        ? { value: value ?? "", onChange: (e) => onChange(e.target.value) }
        : {};

    switch (field.type) {
        case "textarea":
            return (
                <div className={`${fieldClassName} ct-preview-span-full`}>
                    <label>{label}{requiredMark}</label>
                    <textarea className="ct-preview-textarea-mock" rows={3} placeholder="Enter text..." {...textBinding} />
                    {errorNode}
                </div>
            );
        case "checkbox":
            // Older templates saved a checkbox as a single labelled box with no options.
            if (field.options?.length) {
                return (
                    <CheckboxGroupPreview
                        field={field}
                        label={label}
                        requiredMark={requiredMark}
                        value={value}
                        onChange={onChange}
                        fieldClassName={fieldClassName}
                        errorNode={errorNode}
                    />
                );
            }
            return (
                <div className={`${fieldClassName} ct-preview-span-full`}>
                    <label className="ct-preview-check-mock">
                        <input
                            type="checkbox"
                            {...(isControlled
                                ? { checked: value === "1", onChange: (e) => onChange(e.target.checked ? "1" : "0") }
                                : {})}
                        />
                        <span>{label}{requiredMark}</span>
                    </label>
                    {errorNode}
                </div>
            );
        case "radio": {
            const options = field.options?.length ? field.options : ["Option 1", "Option 2"];
            return (
                <div className={`${fieldClassName} ct-preview-span-full`}>
                    <label>{label}{requiredMark}</label>
                    <div className="ct-preview-radio-mock">
                        {options.map((opt, i) => {
                            const optValue = getOptionValue(field, i, opt);
                            return (
                                <label key={i} className="ct-preview-radio-option">
                                    <input
                                        type="radio"
                                        name={radioName}
                                        {...(isControlled
                                            ? { checked: value === optValue, onChange: () => onChange(optValue) }
                                            : {})}
                                    />
                                    <span>{opt}</span>
                                </label>
                            );
                        })}
                    </div>
                    {errorNode}
                </div>
            );
        }
        case "dropdown": {
            const usesMasterData = (field.optionsSource === "master" || field.optionsSource === "dependency") && field.masterModule;
            const placeholder = usesMasterData ? `Select ${label.trim().toLowerCase()}...` : "Select option...";
            if (isControlled && field.options?.length && field.hasAvatars) {
                return (
                    <OwnerField
                        label={field.required ? `${label} *` : label}
                        value={value ?? ""}
                        onChange={(e) => onChange(e.target.value)}
                        options={field.options.map((opt, i) => ({
                            value: String(getOptionValue(field, i, opt)),
                            label: opt,
                            avatar: field.optionAvatars?.[i] ?? undefined,
                        }))}
                        placeholder={placeholder}
                        error={error || undefined}
                    />
                );
            }
            if (isControlled && field.options?.length) {
                return (
                    <div className={fieldClassName}>
                        <label>{label}{requiredMark}</label>
                        <SearchableSelect
                            value={value ?? ""}
                            onChange={(e) => onChange(e.target.value)}
                            options={field.options.map((opt, i) => ({
                                value: String(getOptionValue(field, i, opt)),
                                label: opt,
                            }))}
                            placeholder={placeholder}
                            hasError={Boolean(error)}
                        />
                        {errorNode}
                    </div>
                );
            }
            return (
                <div className={fieldClassName}>
                    <label>{label}{requiredMark}</label>
                    <div className="cf-input ct-preview-select-input">
                        <input type="text" placeholder={placeholder} {...textBinding} />
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </div>
                    {errorNode}
                </div>
            );
        }
        case "file":
            if (isControlled) {
                return (
                    <div className={fieldClassName}>
                        <label>{label}{requiredMark}</label>
                        <DocumentUpload
                            attachments={value ? [value] : []}
                            onAdd={onChange}
                            onRemove={() => onChange(null)}
                            allowMultiple={false}
                            hasError={Boolean(error)}
                        />
                        {errorNode}
                    </div>
                );
            }
            return (
                <div className="cf-field">
                    <label>{label}{requiredMark}</label>
                    <div className="ct-preview-file-zone">Choose file...</div>
                </div>
            );
        case "date":
            return (
                <div className={fieldClassName}>
                    <label>{label}{requiredMark}</label>
                    <DatePickerField
                        dateValue={isControlled ? value ?? "" : ""}
                        onDateTimeChange={isControlled ? ({ date }) => onChange(date) : undefined}
                        hasError={Boolean(error)}
                    />
                    {errorNode}
                </div>
            );
        case "datetime": {
            const { date, time } = splitDateTimeValue(isControlled ? value : "");
            return (
                <div className={fieldClassName}>
                    <label>{label}{requiredMark}</label>
                    <DateTimePickerField
                        dateValue={date}
                        timeValue={time}
                        onDateTimeChange={isControlled ? (next) => onChange(joinDateTimeValue(next)) : undefined}
                        hasError={Boolean(error)}
                    />
                    {errorNode}
                </div>
            );
        }
        case "time":
            return (
                <div className={fieldClassName}>
                    <label>{label}{requiredMark}</label>
                    <div className={inputClassName}>
                        <input type="time" {...textBinding} />
                    </div>
                    {errorNode}
                </div>
            );
        default:
            return (
                <div className={fieldClassName}>
                    <label>{label}{requiredMark}</label>
                    <div className={inputClassName}>
                        <input
                            type={field.type === "number" ? "number" : field.type === "email" ? "email" : "text"}
                            placeholder={label}
                            {...textBinding}
                        />
                    </div>
                    {errorNode}
                </div>
            );
    }
}

export default TemplateFieldPreview;
