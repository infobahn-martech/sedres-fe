import { useCallback, useEffect, useState } from "react";
import { createCollapsedColumnsState } from "../utils/workflowHelpers";

const toExpandedState = (workflows) => {
  const state = {};
  workflows.forEach((workflow) => {
    state[workflow.id] = !workflow.isCollapsed;
  });
  return state;
};

export default function useWorkflowExpansion(workflows) {
  const [expandedWorkflows, setExpandedWorkflows] = useState(() =>
    toExpandedState(workflows)
  );
  const [collapsedColumns, setCollapsedColumns] = useState(() =>
    createCollapsedColumnsState(workflows)
  );

  useEffect(() => {
    setExpandedWorkflows((prev) => {
      const next = { ...prev };
      workflows.forEach((workflow) => {
        if (!(workflow.id in next)) {
          next[workflow.id] = !workflow.isCollapsed;
        }
      });
      return next;
    });

    setCollapsedColumns((prev) => {
      const next = { ...prev };
      workflows.forEach((workflow) => {
        if (!(workflow.id in next)) {
          next[workflow.id] = new Set();
        }
      });
      return next;
    });
  }, [workflows]);

  const toggleWorkflow = useCallback((workflowId) => {
    setExpandedWorkflows((prev) => ({
      ...prev,
      [workflowId]: !prev[workflowId],
    }));
  }, []);

  const expandWorkflow = useCallback((workflowId) => {
    setExpandedWorkflows((prev) => ({
      ...prev,
      [workflowId]: true,
    }));
  }, []);

  /* Accordion-style single-open: expand only the given workflow, collapsing every other one. */
  const expandOnlyWorkflow = useCallback(
    (workflowId) => {
      setExpandedWorkflows(() => {
        const next = {};
        workflows.forEach((workflow) => {
          next[workflow.id] = String(workflow.id) === String(workflowId);
        });
        return next;
      });
    },
    [workflows]
  );

  const collapseWorkflow = useCallback((workflowId) => {
    setExpandedWorkflows((prev) => ({
      ...prev,
      [workflowId]: false,
    }));
  }, []);

  const handleColumnHeaderClick = useCallback(
    (workflowId, columnId) => {
      setCollapsedColumns((prev) => {
        const currentSet = prev[workflowId] ?? new Set();
        const nextSet = new Set(currentSet);
        if (nextSet.has(columnId)) {
          nextSet.delete(columnId);
        } else {
          nextSet.add(columnId);
        }

        /* Collapsing every column would leave nothing to expand back into — snap back to
           the normal view instead of letting the whole board go narrow. */
        const totalColumns = workflows.find((w) => w.id === workflowId)?.columnOrder?.length ?? 0;
        if (totalColumns > 0 && nextSet.size >= totalColumns) {
          return { ...prev, [workflowId]: new Set() };
        }

        return { ...prev, [workflowId]: nextSet };
      });
    },
    [workflows]
  );

  return {
    expandedWorkflows,
    collapsedColumns,
    toggleWorkflow,
    expandWorkflow,
    expandOnlyWorkflow,
    collapseWorkflow,
    handleColumnHeaderClick,
  };
}
