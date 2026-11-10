import PropTypes from "prop-types";
import { useMemo, useState, useEffect } from "react";
import "@/design/scss/general.scss";
import "@/design/css/common/CardForm.css";
import kpiTasksService from "@/services/kpiTasksService";
import useCallTaskReducer from "@/store/CallTaskReducer";
import usePermissions from "@/shared/hooks/usePermissions";
import { PERMISSION_MODULES, PERMISSION_SUBMODULES, PERMISSION_ACTIONS } from "@/shared/constants/permissions";
import { useCallDetail } from "@/pages/KanbanBoard/CardFormTabs/shared/callDetailContext";
import { FiAlertCircle, FiFileText } from "react-icons/fi";
import TemplateFieldsView from "@/pages/KanbanBoard/CardFormTabs/shared/components/TemplateFieldsView";
import CardFormEmptyState from "@/pages/KanbanBoard/CardFormTabs/shared/components/CardFormEmptyState";
import {
  findTemplateTabByKey,
  resolveTemplateCallTypeLabel,
} from "@/pages/KanbanBoard/CardFormTabs/shared/utils/callDetailTemplate";
import OperationTasksPanel from "../operation/TaskTab";
import { mapTasksToSections } from "../operation/operationTasksMapper";
import DailyTaskTodo from "./DailyTaskTodo";
import GeneralViewLegacyDetails from "./GeneralViewLegacyDetails";
import GeneralViewSectionShimmer from "./GeneralViewShimmer";

// Read-only Appointment Details tab for an existing call: appointment summary, daily KPI tasks and operation tasks.
// The summary is bound to the call's custom template (data.template.tabs → appointment_details fields);
// calls without a template fall back to GeneralViewLegacyDetails.
function GeneralView({ card, formValues, handleChange }) {
  const { hasPermission } = usePermissions();
  const canViewGeneralInformation = hasPermission({
    moduleKey: PERMISSION_MODULES.KANBAN_CARD,
    submoduleKey: PERMISSION_SUBMODULES.APPOINTMENT_DETAILS,
    actionKey: PERMISSION_ACTIONS.GENERAL_INFORMATION,
  });
  const canViewDailyTasks = hasPermission({
    moduleKey: PERMISSION_MODULES.KANBAN_CARD,
    submoduleKey: PERMISSION_SUBMODULES.APPOINTMENT_DETAILS,
    actionKey: PERMISSION_ACTIONS.DAILY_TASKS,
  });
  const canViewOperationTasks = hasPermission({
    moduleKey: PERMISSION_MODULES.KANBAN_CARD,
    submoduleKey: PERMISSION_SUBMODULES.APPOINTMENT_DETAILS,
    actionKey: PERMISSION_ACTIONS.OPERATION_TASKS,
  });
  const accentColor = card?.color || "#2A00FF";

  const [operatorKpiTasks, setOperatorKpiTasks] = useState([]);
  const [operatorKpiLoading, setOperatorKpiLoading] = useState(false);
  const [operatorKpiError, setOperatorKpiError] = useState("");
  const callTasks = useCallTaskReducer((state) => state.callTasks);
  const isLoadingCallTasks = useCallTaskReducer((state) => state.isLoadingTasks);
  const callTasksError = useCallTaskReducer((state) => state.tasksErrorMessage);
  const getTasksByCall = useCallTaskReducer((state) => state.getTasksByCall);

  const currentCallId = useMemo(
    () => card?.call_id ?? formValues?.call_id ?? card?.callId ?? "",
    [card?.call_id, card?.callId, formValues?.call_id]
  );

  // Shared with the rest of the drawer (CardForm fetches it once per card).
  const {
    detail: callDetailData,
    loading: callDetailLoading,
    error: callDetailError,
  } = useCallDetail(currentCallId);

  const appointmentTemplateTab = useMemo(
    () => findTemplateTabByKey(callDetailData, "appointment_details"),
    [callDetailData]
  );
  const hasTemplate = Array.isArray(callDetailData?.template?.tabs);

  const mappedOperatorKpiTasks = useMemo(() => {
    const rows = Array.isArray(operatorKpiTasks) ? operatorKpiTasks : [];
    return rows.map((row) => ({
      id: String(row?.operator_kpi_id ?? row?.id ?? `${row?.task_name ?? "task"}-${row?.due_time ?? ""}`),
      text: row?.task_name ? String(row.task_name) : "Untitled task",
      startTime: row?.start_time ? String(row.start_time) : "",
      dueTime: row?.due_time ? String(row.due_time) : "",
      completedTime: row?.completed_time ? String(row.completed_time) : "",
      status: row?.status ? String(row.status) : "",
      statusColor: row?.status_color ? String(row.status_color) : "",
      delayText: row?.delay_text ? String(row.delay_text) : "",
    }));
  }, [operatorKpiTasks]);

  const mappedOperationTaskSections = useMemo(
    () => mapTasksToSections(callTasks),
    [callTasks]
  );

  useEffect(() => {
    void getTasksByCall({ callId: currentCallId });
  }, [currentCallId, getTasksByCall]);

  useEffect(() => {
    const cardIdRaw = card?.id ?? card?.card_id ?? formValues?.card_id;
    const cardId = cardIdRaw === undefined || cardIdRaw === null ? "" : String(cardIdRaw).trim();

    if (!cardId) {
      setOperatorKpiTasks([]);
      setOperatorKpiError("");
      setOperatorKpiLoading(false);
      return;
    }

    let cancelled = false;
    const loadOperatorKpi = async () => {
      setOperatorKpiLoading(true);
      setOperatorKpiError("");
      try {
        const { data } = await kpiTasksService.getOperatorKpi(cardId);
        const rows = Array.isArray(data?.data) ? data.data : [];
        if (!cancelled) {
          setOperatorKpiTasks(rows);
        }
      } catch {
        if (!cancelled) {
          setOperatorKpiTasks([]);
          setOperatorKpiError("Unable to load KPI tasks.");
        }
      } finally {
        if (!cancelled) {
          setOperatorKpiLoading(false);
        }
      }
    };

    void loadOperatorKpi();
    return () => {
      cancelled = true;
    };
  }, [card?.id, card?.card_id, formValues?.card_id]);

  const renderTaskColumns = (callTypeLabel) => (
    <>
      {canViewDailyTasks && (
        <div className="general-info-middle">
          <div className="general-info-tasks-card general-info-tasks-card--daily">
            <div className="daily-task-box-wrapper">
              <DailyTaskTodo
                tasks={mappedOperatorKpiTasks}
                accentColor={accentColor}
                isLoading={operatorKpiLoading}
                error={operatorKpiError}
              />
            </div>
          </div>
        </div>
      )}
      {canViewOperationTasks && (
        <div className="general-info-right">
          <div className="general-info-tasks-card general-info-tasks-card--operation">
            <OperationTasksPanel
              cardColor={accentColor}
              callType={callTypeLabel}
              isViewOnly
              embedded
              taskSections={mappedOperationTaskSections}
              isLoading={isLoadingCallTasks}
              error={callTasksError}
            />
          </div>
        </div>
      )}
    </>
  );

  const renderBody = () => {
    if (callDetailLoading && !callDetailData) return <GeneralViewSectionShimmer />;

    if (hasTemplate) {
      const callTypeLabel =
        resolveTemplateCallTypeLabel(callDetailData) ||
        String(formValues?.typeOfCall ?? "").trim();
      return (
        <div className="general-view-mode-wrapper">
          <div className="general-info-three-column general-info-view-with-tasks general-tab-form-layout">
            {canViewGeneralInformation && (
              <div className="general-info-left">
                <div className="general-view-form-scroll">
                  <div className="pre-arrival-form">
                    <div className="general-view-detail-boxes">
                      {appointmentTemplateTab?.fields.length ? (
                        <TemplateFieldsView
                          title={appointmentTemplateTab.label}
                          fields={appointmentTemplateTab.fields}
                          detail={callDetailData}
                        />
                      ) : (
                        <CardFormEmptyState
                          className="cf-empty-state--framed"
                          icon={FiFileText}
                          title="No appointment fields"
                          message="This call's template doesn't have any appointment fields configured yet."
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {renderTaskColumns(callTypeLabel)}
          </div>
        </div>
      );
    }

    if (callDetailData) {
      return (
        <GeneralViewLegacyDetails
          card={card}
          formValues={formValues}
          handleChange={handleChange}
          callDetailData={callDetailData}
          canViewGeneralInformation={canViewGeneralInformation}
          canViewOperationTasks={canViewOperationTasks}
          renderTaskColumns={renderTaskColumns}
        />
      );
    }

    // Call detail failed (or there is no call id): no appointment data to show, but the
    // task panels load independently and stay available.
    return (
      <div className="general-view-mode-wrapper">
        <div className="general-info-three-column general-info-view-with-tasks general-tab-form-layout">
          {canViewGeneralInformation && (
            <div className="general-info-left">
              <div className="general-view-form-scroll">
                {callDetailError ? (
                  <CardFormEmptyState
                    className="cf-empty-state--framed"
                    variant="error"
                    icon={FiAlertCircle}
                    title="Couldn't load appointment details"
                    message="Close and reopen the card to try again."
                  />
                ) : (
                  <CardFormEmptyState
                    className="cf-empty-state--framed"
                    icon={FiFileText}
                    title="No appointment details"
                    message="Appointment details for this call will appear here."
                  />
                )}
              </div>
            </div>
          )}
          {renderTaskColumns(String(formValues?.typeOfCall ?? "").trim())}
        </div>
      </div>
    );
  };

  return (
    <div className="cardform-body card-form-panel general-tab-body general-tab-body--view-mode">
      <div className="general-sections-wrapper">
        <div className="cf-section general-info-section">
          <div className="cf-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="cf-section-title">General Information</div>
          </div>
          <div className="cf-section-body">{renderBody()}</div>
        </div>
      </div>
    </div>
  );
}

GeneralView.propTypes = {
  card: PropTypes.object,
  formValues: PropTypes.object,
  handleChange: PropTypes.func,
};

export default GeneralView;
