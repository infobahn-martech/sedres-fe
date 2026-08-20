import PropTypes from "prop-types";
import SalesOrderList from "./SalesOrderList";

function SalesOrder({
  card,
  formValues,
  handleChange,
  isSimplifiedMode = false,
  isDAModule = false,
  isDaCardContext = false,
  salesOrderApiLoading = false,
  salesOrderApiError = null,
  refreshSalesOrder,
}) {
  const cardColor = "#e2e6ff";

  return (
    <div className="operation-wrapper" style={{ "--card-color": cardColor }}>
      <div className="operation-content-container">
        <div className="operation-right">
          <SalesOrderList
            card={card}
            formValues={formValues}
            handleChange={handleChange}
            cardColor={cardColor}
            readOnly={isSimplifiedMode}
            showPOStatus={isDAModule}
            isDAModule={isDAModule}
            isDaCardContext={isDaCardContext}
            isLoadingSalesOrder={salesOrderApiLoading}
            salesOrderError={salesOrderApiError}
            refreshSalesOrder={refreshSalesOrder}
          />
        </div>
      </div>
    </div>
  );
}

SalesOrder.propTypes = {
  card: PropTypes.object,
  formValues: PropTypes.object,
  handleChange: PropTypes.func,
  isSimplifiedMode: PropTypes.bool,
  isDAModule: PropTypes.bool,
  isDaCardContext: PropTypes.bool,
  salesOrderApiLoading: PropTypes.bool,
  salesOrderApiError: PropTypes.oneOfType([PropTypes.string, PropTypes.oneOf([null])]),
  refreshSalesOrder: PropTypes.func,
};

export default SalesOrder;

