import { useEffect, useState, useMemo } from "react";
import PropTypes from "prop-types";
import KPIAnalytics from "./KPIAnalytics";
import kpiTasksService from "../../../../../../services/kpiTasksService";
import "../../../../../../design/scss/operations.scss";

const KNOWN_CATEGORIES = [
  "Appointment Acceptance",
  "Call file open",
  "Pre arrival report",
  "Arrival report",
  "Vessel inward formalities",
  "Daily report",
  "Outward clearance issue",
  "Outward clearance deliver",
  "Sailing Report",
];

function deriveCategory(taskName) {
  const name = String(taskName ?? "").toLowerCase();
  const match = KNOWN_CATEGORIES.find(
    (c) => name.includes(c.toLowerCase()) || c.toLowerCase().includes(name)
  );
  return match ?? String(taskName ?? "Other");
}

function derivePerformance(row) {
  if (row?.delay_text) return "Critical";
  const status = String(row?.status ?? "").toLowerCase();
  if (status.includes("complet")) return "On Target";
  if (status.includes("above") || status.includes("ahead")) return "Above Target";
  return "Below Target";
}

function formatDuration(startIso, endIso) {
  if (!startIso || !endIso) return "";
  const diff = new Date(endIso) - new Date(startIso);
  if (isNaN(diff) || diff <= 0) return "";
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

function KPI({ card, formValues, handleChange }) {
  const cardColor = card?.color || "#2A00FF";
  const [operatorKpiTasks, setOperatorKpiTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const cardId = card?.id ?? card?.card_id ?? formValues?.card_id;

  useEffect(() => {
    if (!cardId) {
      setOperatorKpiTasks([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const { data } = await kpiTasksService.getOperatorKpi(String(cardId).trim());
        if (!cancelled) setOperatorKpiTasks(Array.isArray(data?.data) ? data.data : []);
      } catch (e) {
        if (!cancelled) setOperatorKpiTasks([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [cardId]);

  const kpiData = useMemo(
    () =>
      operatorKpiTasks.map((row, i) => ({
        id: row?.operator_kpi_id ?? row?.id ?? i,
        name: row?.task_name ?? "",
        category: row?.category ?? deriveCategory(row?.task_name),
        performance: derivePerformance(row),
        value: Number(row?.value ?? row?.earned_points ?? 0),
        target: Number(row?.target ?? row?.total_points ?? 75),
      })),
    [operatorKpiTasks]
  );

  const tasks = useMemo(
    () =>
      operatorKpiTasks.map((row, i) => ({
        id: row?.operator_kpi_id ?? row?.id ?? i,
        task: row?.task_name ?? "",
        estimatedDuration: formatDuration(row?.start_time, row?.due_time),
        elapsedTime: row?.completed_time
          ? formatDuration(row?.start_time, row?.completed_time)
          : formatDuration(row?.start_time, new Date().toISOString()),
        status: row?.status ?? "",
      })),
    [operatorKpiTasks]
  );

  return (
    <div className="operation-wrapper" style={{ "--card-color": cardColor }}>
      <div className="operation-content-container">
        <div className="operation-right">
          <div className="cardform-left-full kpi-content-wrapper" style={{ "--card-color": cardColor }}>
            <KPIAnalytics kpiData={kpiData} tasks={tasks} isLoading={isLoading} cardColor={cardColor} />
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
