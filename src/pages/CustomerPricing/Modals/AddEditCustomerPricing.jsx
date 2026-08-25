import { useForm, Controller } from "react-hook-form";
import PremiumSelect from "../../../components/form/PremiumSelect";
import CustomModal from "../../../components/CustomModal";
import "../../../design/scss/prospect-modal.scss";
import "../../../design/scss/modal-designs.scss";
import "../../../design/scss/form-designs.scss";
import { PORT_OPTIONS } from "../../../shared/constants/ports";

// TODO: Replace with actual billing entities from API or constants
const BILLING_ENTITY_OPTIONS = [
    "Sedres Maritime Co.",
    "Al Fajr Shipping LLC",
    "Global Port Services",
    "Ocean Waves Logistics",
    "Blue Horizon Freight",
    "Desert Star Logistics",
    "PortLink Arabia",
    "CargoMax Trading",
];

// Common currency options
const CURRENCY_OPTIONS = ["USD", "SAR", "AED", "EUR", "GBP", "INR"];
const CUSTOMER_PRICING_PORT_OPTIONS = PORT_OPTIONS.map((p) => ({ value: p, label: p }));
const BILLING_ENTITY_SELECT_OPTIONS = BILLING_ENTITY_OPTIONS.map((e) => ({ value: e, label: e }));
const CURRENCY_SELECT_OPTIONS = CURRENCY_OPTIONS.map((c) => ({ value: c, label: c }));

export function AddEditCustomerPricing({ showModal, closeModal, onSuccess }) {
    const {
        register,
        control,
        handleSubmit,
        formState: { errors },
    } = useForm({
        defaultValues: showModal?._id
            ? {
                customerName: showModal?.customerName,
                port: showModal?.port || "",
                billingEntity: showModal?.billingEntity || "",
                currency: showModal?.currency || "",
            }
            : {},
    });

    const onSubmit = () => {
        onSuccess?.();
        closeModal();
    };

    const renderHeader = () => (
        <>
            <h1 className="modal-title">
                {showModal?._id ? "Edit Customer Pricing" : "Add Customer Pricing"}
            </h1>
        </>
    );

    const renderBody = () => (
        <div className="modal-body">
            <div className="lead-form">
                <form id="customerPricingForm" onSubmit={handleSubmit(onSubmit)}>

                    {/* ROW 1 — Customer Name + Port */}
                    <div className="permInputs row mb-lg-3">

                        {/* Customer Name */}
                        <div className="col-lg-6 col-sm-12 mb-3">
                            <div className="form-field">
                                <div className="form-floating desig-inp">
                                    <input
                                        className={`form-control ${errors.customerName ? "is-invalid" : ""}`}
                                        placeholder="Customer Name"
                                        {...register("customerName", { required: "Customer Name is required" })}
                                    />
                                    <label>Customer Name <span className="text-danger">*</span></label>
                                </div>
                                {errors.customerName && (
                                    <span className="field-error">{errors.customerName.message}</span>
                                )}
                            </div>
                        </div>

                        {/* Port */}
                        <div className="col-lg-6 col-sm-12 mb-3">
                            <div className="form-field">
                                <div className="phone-wrapper">
                                    <label className="phone-label">Port <span className="text-danger">*</span></label>
                                    <Controller
                                        name="port"
                                        control={control}
                                        rules={{ required: "Port is required" }}
                                        render={({ field }) => (
                                            <PremiumSelect
                                                value={field.value != null ? String(field.value) : ""}
                                                onChange={(e) => field.onChange(e.target.value)}
                                                options={CUSTOMER_PRICING_PORT_OPTIONS}
                                                placeholder="Select Port"
                                                searchPlaceholder="Search port..."
                                                hasError={Boolean(errors.port)}
                                            />
                                        )}
                                    />
                                </div>
                                {errors.port && (
                                    <span className="field-error">{errors.port.message}</span>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* ROW 2 — Billing Entity + Currency */}
                    <div className="permInputs row mb-lg-3">

                        {/* Billing Entity */}
                        <div className="col-lg-6 col-sm-12 mb-3">
                            <div className="form-field">
                                <div className="phone-wrapper">
                                    <label className="phone-label">Billing Entity <span className="text-danger">*</span></label>
                                    <Controller
                                        name="billingEntity"
                                        control={control}
                                        rules={{ required: "Billing Entity is required" }}
                                        render={({ field }) => (
                                            <PremiumSelect
                                                value={field.value != null ? String(field.value) : ""}
                                                onChange={(e) => field.onChange(e.target.value)}
                                                options={BILLING_ENTITY_SELECT_OPTIONS}
                                                placeholder="Select Billing Entity"
                                                searchPlaceholder="Search billing entity..."
                                                hasError={Boolean(errors.billingEntity)}
                                            />
                                        )}
                                    />
                                </div>
                                {errors.billingEntity && (
                                    <span className="field-error">{errors.billingEntity.message}</span>
                                )}
                            </div>
                        </div>

                        {/* Currency */}
                        <div className="col-lg-6 col-sm-12 mb-3">
                            <div className="form-field">
                                <div className="phone-wrapper">
                                    <label className="phone-label">Currency <span className="text-danger">*</span></label>
                                    <Controller
                                        name="currency"
                                        control={control}
                                        rules={{ required: "Currency is required" }}
                                        render={({ field }) => (
                                            <PremiumSelect
                                                value={field.value != null ? String(field.value) : ""}
                                                onChange={(e) => field.onChange(e.target.value)}
                                                options={CURRENCY_SELECT_OPTIONS}
                                                placeholder="Select Currency"
                                                searchPlaceholder="Search currency..."
                                                hasError={Boolean(errors.currency)}
                                            />
                                        )}
                                    />
                                </div>
                                {errors.currency && (
                                    <span className="field-error">{errors.currency.message}</span>
                                )}
                            </div>
                        </div>

                    </div>

                </form>

            </div>
        </div>
    );

    const renderFooter = () => (
        <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={closeModal}>
                Close
            </button>
            <button type="submit" form="customerPricingForm" className="btn btn-primary">
                Save
            </button>
        </div>
    );

    return (
        <CustomModal
            dialgName="modal-dialog modal-dialog-centered"
            show={!!showModal}
            closeModal={() => closeModal(null)}
            body={renderBody()}
            footer={renderFooter()}
            header={renderHeader()}
        />
    );
}
