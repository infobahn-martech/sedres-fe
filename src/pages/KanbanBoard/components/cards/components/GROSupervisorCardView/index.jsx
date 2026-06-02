import { useState, useCallback, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import userService from "../../../../../../services/userService";
import groService from "../../../../../../services/groService";
import { PRE_ARRIVAL_GRO_ROLE_ID } from "../../../../CardFormTabs/tabs/operation/operationConstants";
import {
  getGroSupervisorTasksForCard,
  createEmptyTaskAssignment,
} from "./groSupervisorStaticTasks";
import {
  mapGroSupervisorDocuments,
  parseDocumentsByTaskResponse,
  resolveGroSupervisorTaskId,
} from "./groSupervisorDocuments";
import GROSupervisorTabs from "./GROSupervisorTabs";
import GROSupervisorAssignTask from "./GROSupervisorAssignTask";
import GROSupervisorDocumentLibrary from "./GROSupervisorDocumentLibrary";

const SUPERVISOR_TABS = {
  assign: "assign",
  documents: "documents",
};

const parseUsersByRoleResponse = (res) => {
  const body = res?.data ?? res;
  const list = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
  return list
    .map((row) => {
      const id = row?.user_id ?? row?.id ?? row?.userid;
      if (id == null || String(id).trim() === "") return null;
      const label =
        row?.name ??
        row?.user_name ??
        row?.username ??
        row?.full_name ??
        `User ${id}`;
      return { value: String(id), label: String(label).trim() || `User ${id}` };
    })
    .filter(Boolean);
};

function GROSupervisorCardView({ card }) {
  const tasks = useMemo(() => getGroSupervisorTasksForCard(card), [card]);
  const taskId = useMemo(() => resolveGroSupervisorTaskId(card), [card]);

  const [activeTab, setActiveTab] = useState(SUPERVISOR_TABS.assign);
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsLoadError, setDocumentsLoadError] = useState(null);
  const [assignments, setAssignments] = useState(() => {
    const initial = {};
    getGroSupervisorTasksForCard(card).forEach((t) => {
      initial[t.id] = createEmptyTaskAssignment();
    });
    return initial;
  });
  const [userOptions, setUserOptions] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => {
    setAssignments((prev) => {
      const next = { ...prev };
      tasks.forEach((t) => {
        if (!next[t.id]) next[t.id] = createEmptyTaskAssignment();
      });
      return next;
    });
  }, [tasks]);

  useEffect(() => {
    let cancelled = false;
    setUsersLoading(true);
    userService
      .getUsersByRole({ role_id: PRE_ARRIVAL_GRO_ROLE_ID })
      .then((res) => {
        if (cancelled) return;
        setUserOptions(parseUsersByRoleResponse(res));
      })
      .catch(() => {
        if (!cancelled) setUserOptions([]);
      })
      .finally(() => {
        if (!cancelled) setUsersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAssignmentChange = useCallback((taskId, patch) => {
    setAssignments((prev) => ({
      ...prev,
      [taskId]: { ...(prev[taskId] ?? createEmptyTaskAssignment()), ...patch },
    }));
  }, []);

  useEffect(() => {
    if (activeTab !== SUPERVISOR_TABS.documents) return undefined;

    if (!taskId) {
      setDocuments([]);
      setDocumentsLoadError("Unable to load documents: missing task id.");
      setDocumentsLoading(false);
      return undefined;
    }

    let cancelled = false;
    setDocumentsLoading(true);
    setDocumentsLoadError(null);

    groService
      .getDocumentsByTask(taskId)
      .then((res) => {
        if (cancelled) return;
        const apiDocuments = parseDocumentsByTaskResponse(res);
        setDocuments(mapGroSupervisorDocuments(apiDocuments));
      })
      .catch(() => {
        if (cancelled) return;
        setDocuments([]);
        setDocumentsLoadError("Failed to load documents.");
      })
      .finally(() => {
        if (!cancelled) setDocumentsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, taskId]);

  return (
    <div className="gro-card-view gro-supervisor-card-view">
      <div className="gro-supervisor-layout">
        <GROSupervisorTabs activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="gro-supervisor-right">
          {activeTab === SUPERVISOR_TABS.assign ? (
            <GROSupervisorAssignTask
              tasks={tasks}
              assignments={assignments}
              onAssignmentChange={handleAssignmentChange}
              userOptions={userOptions}
              usersLoading={usersLoading}
            />
          ) : (
            <GROSupervisorDocumentLibrary
              documents={documents}
              hideHeading
              isLoading={documentsLoading}
              emptyMessage={documentsLoadError}
            />
          )}
        </div>
      </div>
    </div>
  );
}

GROSupervisorCardView.propTypes = {
  card: PropTypes.object,
};

export default GROSupervisorCardView;
