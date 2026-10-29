import { useEffect } from "react";
import PropTypes from "prop-types";
import KPIAnalytics from "./KPIAnalytics";
import "../../../../../../design/scss/operations.scss";

// Generate dummy KPI data
const generateDummyKPIs = () => {
  const categories = [
    "Appointment Acceptance",
    "Call file open",
    "Pre arrival report",
    "Arrival report",
    "Vessel inward formalities",
    "Daily report",
    "Outward clearance issue",
    "Outward clearance deliver",
    "Sailing Report"
  ];
  const performances = ["On Target", "Above Target", "Below Target", "Critical"];

  const dummyKPIs = [];
  for (let i = 1; i <= 15; i++) {
    dummyKPIs.push({
      id: i,
      name: `KPI_${String(100 + i).padStart(3, '0')}`,
      category: categories[Math.floor(Math.random() * categories.length)],
      performance: performances[Math.floor(Math.random() * performances.length)],
      value: Math.floor(Math.random() * 100),
      target: 75,
    });
  }
  return dummyKPIs;
};

function KPI({ card, formValues, handleChange }) {
  const cardColor = card?.color || "#2A00FF";
  const kpiData = formValues.kpiData || [];

  // Initialize with dummy data on mount if empty
  useEffect(() => {
    if (!formValues.kpiData || formValues.kpiData.length === 0) {
      const dummyData = generateDummyKPIs();
      const syntheticEvent = { target: { value: dummyData } };
      handleChange("kpiData")(syntheticEvent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const displayKpiData = kpiData.length > 0 ? kpiData : generateDummyKPIs();

  return (
    <div className="operation-wrapper" style={{ "--card-color": cardColor }}>
      <div className="operation-content-container">
        <div className="operation-right">
          <div className="cardform-left-full kpi-content-wrapper" style={{ "--card-color": cardColor }}>
            <KPIAnalytics kpiData={displayKpiData} cardColor={cardColor} />
          </div>
        </div>
      </div>
    </div>
  );
}

KPI.propTypes = {
  card: PropTypes.object,
  formValues: PropTypes.object,
  handleChange: PropTypes.func,
};

export default KPI;

