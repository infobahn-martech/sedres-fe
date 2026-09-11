import { useEffect } from 'react';
import { useKanbanSidebarBridge } from '../../store/kanbanSidebarBridge';

/** Mirrors normalized workflow fields so SideNav can apply the same add-card rules as on /operator. */
export default function useSyncKanbanSidebarWorkflows(workflows, boardId) {
  const setBoardWorkflows = useKanbanSidebarBridge((s) => s.setBoardWorkflows);
  const setBoardId = useKanbanSidebarBridge((s) => s.setBoardId);

  useEffect(() => {
    setBoardId(boardId ?? null);
    return () => setBoardId(null);
  }, [boardId, setBoardId]);

  useEffect(() => {
    const list = (workflows || []).map((workflow) => ({
      id: workflow?.id,
      workflow_id: workflow?.workflow_id ?? workflow?.id,
      name: workflow?.title ?? workflow?.name ?? 'Workflow',
      workflow_name: workflow?.workflow_name ?? workflow?.title ?? workflow?.name ?? 'Workflow',
      title: workflow?.title ?? workflow?.name ?? 'Workflow',
      description: workflow?.description,
      role_id: workflow?.role_id ?? null,
      swimlaneOrder: workflow?.swimlaneOrder,
      swimlanes: workflow?.swimlanes,
      columnOrder: workflow?.columnOrder,
      columns: workflow?.columns,
    }));
    setBoardWorkflows(list);
    return () => setBoardWorkflows([]);
  }, [workflows, setBoardWorkflows]);
}
