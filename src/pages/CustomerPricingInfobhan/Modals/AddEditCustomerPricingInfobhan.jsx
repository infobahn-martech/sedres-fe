import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import searchIcon from "../../../assets/images/search-normal.svg";
import PremiumSelect from "../../../components/form/PremiumSelect";
import CustomModal from "../../../components/CustomModal";
import useCustomerPricingInfobhanReducer from "../../../store/CustomerPricingInfobhanReducer";
import useBillingEntityReducer from "../../../store/BillingEntityReducer";
import usePortReducer from "../../../store/PortReducer";
import "../../../design/scss/prospect-modal.scss";
import "../../../design/scss/modal-designs.scss";
import "../../../design/scss/form-designs.scss";
import "../../../design/scss/customer-pricing-infobhan-modal.scss";

export function AddEditCustomerPricingInfobhan({ showModal, closeModal, onSuccess }) {
    const {
        serviceCodes,
        isLoadingServiceCodes,
        getAllServiceCodes,
        isSaving,
        savePricing,
        isUpdating,
        updatePricing,
    } = useCustomerPricingInfobhanReducer((state) => state);

    const {
        billingEntities,
        isLoading: billingLoading,
        getBillingEntities,
    } = useBillingEntityReducer((state) => state);

    const { ports, getPorts, isLoading: isLoadingPorts } = usePortReducer((s) => s);

    const isEdit = !!(showModal && typeof showModal === "object" && showModal.tariff_id != null);
    const isSubmitting = isEdit ? isUpdating : isSaving;

    useEffect(() => {
        getAllServiceCodes();
        getBillingEntities({ params: { page: 1, limit: 1000 } });
        getPorts({ params: { limit: 1000 } });
    }, []);

    const {
        register,
        control,
        handleSubmit,
        formState: { errors },
    } = useForm({
        defaultValues: isEdit
            ? {
                service_code_id: showModal.service_code_id != null ? String(showModal.service_code_id) : "",
                port_id: showModal.port_id != null ? String(showModal.port_id) : "",
                item_code: showModal.item_code ?? "",
                item_name: showModal.item_name ?? "",
                default_price: showModal.default_price != null ? String(showModal.default_price) : "",
                entities: [],
            }
            : {
                service_code_id: "",
                port_id: "",
                item_code: "",
                item_name: "",
                default_price: "",
                entities: [],
            },
    });

    const { fields, replace } = useFieldArray({
        control,
        name: "entities",
    });

    const [clientSearch, setClientSearch] = useState("");

    const visibleEntityRows = fields
        .map((field, index) => ({ field, index }))
        .filter(({ field }) => {
            const term = clientSearch.trim().toLowerCase();
            if (!term) return true;
            return (
                (field.billing_entity ?? "").toLowerCase().includes(term) ||
                (field.customer_code ?? "").toLowerCase().includes(term)
            );
        });

    const clientTariffMap = useMemo(() => {
        const map = new Map();
        const rawEntities = showModal?.entities ?? showModal?.client_tariffs ?? [];
        rawEntities.forEach((ct) => {
            const key = ct.entity_id ?? ct.billing_entity_id;
            if (key != null) map.set(String(key), ct);
        });
        return map;
    }, [showModal]);

    const hasInitializedEntities = useRef(false);
    useEffect(() => {
        if (hasInitializedEntities.current) return;
        if (!billingEntities || billingEntities.length === 0) return;
        replace(
            billingEntities.map((be) => {
                const matchedTariff = clientTariffMap.get(String(be.entity_id));
                const matchedPrice = matchedTariff?.custom_price ?? matchedTariff?.price;
                const matchedDefaultLineItem =
                    matchedTariff?.default_line_item === 1 ||
                    matchedTariff?.default_line_item === "1" ||
                    matchedTariff?.default_line_item === true;
                return {
                    entity_id: be.entity_id,
                    billing_entity: be.billing_entity,
                    customer_code: be.customer_code,
                    custom_price: matchedPrice != null ? String(matchedPrice) : "",
                    default_line_item: matchedDefaultLineItem,
                    client_tariff_id: matchedTariff?.client_tariff_id ?? null,
                };
            })
        );
        hasInitializedEntities.current = true;
    }, [billingEntities, replace, clientTariffMap]);

    const serviceCodeOptions = (serviceCodes ?? []).map((s) => {
        const id = s.id ?? s.service_code_id;
        return {
            value: id != null ? String(id) : "",
            label: `${s.service_code ?? ""} - ${s.service_name ?? ""}`,
        };
    });

    const portOptions = (ports ?? []).map((p) => ({
        value: String(p.port_id ?? ""),
        label: String(p.port_name ?? p.port ?? p.port_id ?? ""),
    }));

    const onSubmit = (data) => {
        if (isEdit) {
            const payload = {
                tariff_id: Number(showModal.tariff_id),
                port_id: Number(data.port_id),
                default_price: Number(data.default_price),
                item_name: data.item_name.trim(),
                entities: (data.entities ?? []).map((e) => ({
                    entity_id: Number(e.entity_id),
                    custom_price:
                        e.custom_price === "" || e.custom_price == null
                            ? null
                            : Number(e.custom_price),
                })),
            };
            updatePricing({
                payload,
                cb: () => {
                    closeModal(null);
                    onSuccess?.();
                },
            });
            return;
        }

        const payload = {
            service_code_id: Number(data.service_code_id),
            port_id: Number(data.port_id),
            item_code: data.item_code.trim(),
            item_name: data.item_name.trim(),
            default_price: Number(data.default_price),
            entities: (data.entities ?? []).map((e) => ({
                entity_id: Number(e.entity_id),
                custom_price:
                    e.custom_price === "" || e.custom_price == null
                        ? null
                        : Number(e.custom_price),
                default_line_item: e.default_line_item ? 1 : 0,
            })),
        };
        savePricing({
            payload,
            cb: () => {
                closeModal(null);
                onSuccess?.();
            },
        });
    };

    const renderHeader = () => (
        <>
            <h1 className="modal-title">{isEdit ? "Edit Customer Pricing" : "Add Customer Pricing"}</h1>
            <p className="cpi-modal-subtitle">Configure service pricing and client-specific rates</p>
        </>
    );

    const renderBody = () => (
        <div className="modal-body">
            <div className="lead-form">
                <form id="customerPricingInfobhanForm" onSubmit={handleSubmit(onSubmit)}>

                    {/* Service Details */}
                    <div className="cpi-section cpi-section--service-details">
                        <div className="cpi-section-header">
                            <h6 className="cpi-section-title">Service Details</h6>
                        </div>
                        <div className="cf-field-grid-2">

                            <div className="cpi-field">
                                <div className="form-field">
                                    <div className="phone-wrapper">
                                        <label className="phone-label">
                                            Service Code <span className="text-danger">*</span>
                                        </label>
                                        <Controller
                                            name="service_code_id"
                                            control={control}
                                            rules={{ required: "Service Code is required" }}
                                            render={({ field }) => (
                                                <PremiumSelect
                                                    value={field.value != null ? String(field.value) : ""}
                                                    onChange={(e) => field.onChange(e.target.value)}
                                                    options={serviceCodeOptions}
                                                    placeholder={
                                                        isLoadingServiceCodes ? "Loading..." : "Select Service Code"
                                                    }
                                                    searchPlaceholder="Search service code..."
                                                    hasError={Boolean(errors.service_code_id)}
                                                    disabled={isEdit}
                                                />
                                            )}
                                        />
                                    </div>
                                    {errors.service_code_id && (
                                        <span className="field-error">
                                            {errors.service_code_id.message}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="cpi-field">
                                <div className="form-field">
                                    <div className="phone-wrapper">
                                        <label className="phone-label">
                                            Port <span className="text-danger">*</span>
                                        </label>
                                        <Controller
                                            name="port_id"
                                            control={control}
                                            rules={{ required: "Port is required" }}
                                            render={({ field }) => (
                                                <PremiumSelect
                                                    value={field.value != null ? String(field.value) : ""}
                                                    onChange={(e) => field.onChange(e.target.value)}
                                                    options={portOptions}
                                                    placeholder={isLoadingPorts ? "Loading..." : "Select Port"}
                                                    searchPlaceholder="Search port..."
                                                    hasError={Boolean(errors.port_id)}
                                                />
                                            )}
                                        />
                                    </div>
                                    {errors.port_id && (
                                        <span className="field-error">{errors.port_id.message}</span>
                                    )}
                                </div>
                            </div>

                            <div className="cpi-field">
                                <div className="form-field">
                                    <div className="form-floating desig-inp">
                                        <input
                                            className="form-control"
                                            placeholder="Item Code"
                                            disabled={isEdit}
                                            {...register("item_code", { required: "Item Code is required" })}
                                        />
                                        <label>Item Code <span className="text-danger">*</span></label>
                                    </div>
                                    {errors.item_code && (
                                        <span className="field-error">{errors.item_code.message}</span>
                                    )}
                                </div>
                            </div>

                            <div className="cpi-field">
                                <div className="form-field">
                                    <div className="form-floating desig-inp">
                                        <input
                                            className="form-control"
                                            placeholder="Item Name"
                                            {...register("item_name", { required: "Item Name is required" })}
                                        />
                                        <label>Item Name <span className="text-danger">*</span></label>
                                    </div>
                                    {errors.item_name && (
                                        <span className="field-error">{errors.item_name.message}</span>
                                    )}
                                </div>
                            </div>

                            <div className="cpi-field">
                                <div className="form-field">
                                    <div className="form-floating desig-inp">
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-control"
                                            placeholder="Default Price"
                                            {...register("default_price", {
                                                required: "Default Price is required",
                                                validate: (v) =>
                                                    (v !== "" && !isNaN(Number(v))) || "Default Price must be numeric",
                                            })}
                                        />
                                        <label>Default Price <span className="text-danger">*</span></label>
                                    </div>
                                    {errors.default_price && (
                                        <span className="field-error">{errors.default_price.message}</span>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Client Price */}
                    <div className="cpi-section cpi-section--table">
                        <div className="cpi-section-header cpi-section-header--with-search">
                            <div>
                                <h6 className="cpi-section-title">Client Price</h6>
                                <p className="cpi-section-helper">Set custom pricing per billing entity</p>
                            </div>
                            <div className="cpi-client-search search-group">
                                <div className="input-group">
                                    <span className="input-group-text">
                                        <img src={searchIcon} alt="search" />
                                    </span>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Search..."
                                        autoComplete="off"
                                        value={clientSearch}
                                        onChange={(e) => setClientSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                        {billingLoading ? (
                            <div className="cpi-loading-state">Loading billing entities...</div>
                        ) : fields.length === 0 ? (
                            <div className="cpi-empty-state">No billing entities found</div>
                        ) : (
                            <div className="cpi-table-wrapper">
                                <table className="cpi-client-table">
                                    <thead>
                                        <tr>
                                            <th className="cpi-th-entity">Billing Entity</th>
                                            <th className="cpi-th-price">Custom Price</th>
                                            <th className="cpi-th-checkbox">Default Line Item</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleEntityRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={3} className="cpi-empty-state cpi-empty-state--row">
                                                    No matching billing entities
                                                </td>
                                            </tr>
                                        ) : (
                                            visibleEntityRows.map(({ field, index }) => (
                                                <tr key={field.id}>
                                                    <td className="cpi-td-entity">
                                                        <div className="cpi-entity-name">{field.billing_entity}</div>
                                                        <span className="cpi-badge">{field.customer_code}</span>
                                                    </td>
                                                    <td className="cpi-td-price">
                                                        <input
                                                            type="hidden"
                                                            {...register(`entities.${index}.entity_id`)}
                                                        />
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            className={`form-control form-control-sm cpi-price-input ${errors.entities?.[index]?.custom_price ? "is-invalid" : ""
                                                                }`}
                                                            {...register(`entities.${index}.custom_price`, {
                                                                validate: (v) =>
                                                                    v === "" ||
                                                                    v == null ||
                                                                    !isNaN(Number(v)) ||
                                                                    "Must be numeric",
                                                            })}
                                                        />
                                                        {errors.entities?.[index]?.custom_price && (
                                                            <span className="error text-danger d-block">
                                                                {errors.entities[index].custom_price.message}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="cpi-td-checkbox">
                                                        <input
                                                            type="checkbox"
                                                            className="form-check-input"
                                                            {...register(`entities.${index}.default_line_item`)}
                                                        />
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                </form>

            </div>
        </div>
    );

    const renderFooter = () => (
        <div className="modal-footer">
            <button
                type="button"
                className="btn btn-outline cpi-btn-outline"
                onClick={closeModal}
                disabled={isSubmitting}
            >
                Close
            </button>
            <button
                type="submit"
                form="customerPricingInfobhanForm"
                className="btn btn-primary cpi-btn-primary"
                disabled={isSubmitting}
            >
                {isEdit
                    ? (isSubmitting ? "Updating..." : "Update")
                    : (isSubmitting ? "Saving..." : "Save")}
            </button>
        </div>
    );

    return (
        <CustomModal
            className="customer-pricing-infobhan-modal"
            dialgName="modal-dialog modal-dialog-centered modal-lg"
            show={!!showModal}
            closeModal={() => closeModal(null)}
            body={renderBody()}
            footer={renderFooter()}
            header={renderHeader()}
        />
    );
}
