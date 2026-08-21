import { useEffect } from 'react';
import usePermissions from './usePermissions';
import { PERMISSION_MODULES, PERMISSION_SUBMODULES, PERMISSION_ACTIONS } from '../constants/permissions';

export default function useKanbanAddCardFromSidebar({ setSelectedCard, setIsAddMode, setAddTargetWorkflowId }) {
  const { hasPermission } = usePermissions();

  useEffect(() => {
    const handleAddCard = (e) => {
      if (
        !hasPermission({
          moduleKey: PERMISSION_MODULES.KANBAN_CARD,
          submoduleKey: PERMISSION_SUBMODULES.ADD_CARD,
          actionKey: PERMISSION_ACTIONS.VIEW,
        })
      ) {
        return;
      }
      const d = e?.detail || {};
      const laneId = d.swimlaneId ?? d.swimlane_id ?? d.laneId ?? null;
      const laneName = d.swimlaneName ?? d.swimlane_name ?? null;
      const newCard = {
        id: `new-${Date.now()}`,
        title: '',
        color: '#2A00FF',
        ...(laneId != null && laneId !== ''
          ? { laneId, laneName, swimlane_id: laneId }
          : {}),
      };
      setSelectedCard(newCard);
      setIsAddMode(true);
      if (d.workflowId != null && d.workflowId !== '') {
        setAddTargetWorkflowId(d.workflowId);
      } else {
        setAddTargetWorkflowId(null);
      }
    };

    window.addEventListener('kanban:add-card', handleAddCard);
    return () => window.removeEventListener('kanban:add-card', handleAddCard);
  }, [setSelectedCard, setIsAddMode, setAddTargetWorkflowId, hasPermission]);
}
