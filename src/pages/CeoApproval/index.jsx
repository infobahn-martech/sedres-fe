import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CardForm from "../KanbanBoard/components/cards/CardForm";
import callFileService from "../../services/callFileService";
import kanbanBoardService from "../../services/kanbanBoardService";
import workSpaceService from "../../services/workSpaceService";
import { mapFullBoardApiResponse } from "../../shared/helpers/kanbanBoardApiMapper";
import { ROUTE_PATHS } from "../../router/paths";

// Landing page for the CEO email-approval deep link (/approval/ceo/:callId/:cardId).
// Reuses the existing CardForm — no duplicate UI, no modification to /kanban-board/:id flow.
//
// Resolution strategy to get the real card title + color (matching what the
// Manager and Credit Controller see on the board):
//
//   Phase 1 — fast path:
//     GET kanban_card/get_card/:cardId
//     If the backend supports this endpoint, returns { card_name, card_color, board_id }
//     directly and we're done in one call.
//
//   Phase 2 — fallback (if Phase 1 fails / endpoint not yet implemented):
//     GET call_file/get_call_detail/:callId  → kanban_card_id (= cardId), call_type_id
//     GET kanban_workspace/list_all_workspace → all board_ids
//     GET kanban_board/get_full_board/:boardId for each board (in parallel, capped)
//     Find the board that contains the card → extract card_name, card_color
//
//   call_type_id is always fetched (Phase 1 OR get_call_detail in Phase 2) so
//   CardForm's showExportTabs is true on first render, avoiding the async flash.

async function resolveCardData(callId, cardId) {
  const result = {
    callTypeId: null,
    cardTitle: null,
    cardColor: null,
    boardId: null,
  };

  // Always fetch call_type_id via get_call_detail — needed so CardForm shows
  // the Export Approval tab on first render.
  const callDetailPromise = callFileService
    .getCallDetail(callId)
    .then(({ data }) => {
      const d = data?.data ?? {};
      if (d.call_type_id != null) result.callTypeId = String(d.call_type_id).trim();
      // Backend already has the card id here — if it ever adds board_id,
      // card_name, card_color to this response we pick them up automatically.
      if (d.board_id != null && String(d.board_id).trim())
        result.boardId = String(d.board_id).trim();
      if (d.card_name != null && String(d.card_name).trim())
        result.cardTitle = String(d.card_name).trim();
      if (d.card_color != null && String(d.card_color).trim())
        result.cardColor = String(d.card_color).trim();
    })
    .catch(() => { });

  // Phase 1 — single card endpoint (fast, if backend supports it)
  const cardByIdPromise = kanbanBoardService
    .getCardById(cardId)
    .then(({ data }) => {
      const c = data?.data ?? data ?? {};
      if (c.card_name != null && String(c.card_name).trim())
        result.cardTitle = String(c.card_name).trim();
      if (c.card_color != null && String(c.card_color).trim())
        result.cardColor = String(c.card_color).trim();
      if (c.board_id != null && String(c.board_id).trim())
        result.boardId = String(c.board_id).trim();
    })
    .catch(() => null); // will be null if endpoint doesn't exist yet

  // Run both in parallel; wait for both before deciding if Phase 2 is needed
  const [, cardByIdResult] = await Promise.allSettled([callDetailPromise, cardByIdPromise]);
  const phase1Succeeded = cardByIdResult.status === "fulfilled" && cardByIdResult.value !== null;

  // If Phase 1 gave us title+color, we're done
  if (phase1Succeeded && result.cardTitle) return result;

  // Phase 2 — workspace iteration fallback
  // Get all board IDs from the workspace list, then fetch each board in
  // parallel and find the one that contains our card.
  try {
    const { data: wsData } = await workSpaceService.listAllWorkspaces();
    const workspaces = wsData?.status === "success" ? wsData.data ?? [] : [];
    const boardIds = workspaces
      .flatMap((w) => (Array.isArray(w.boards) ? w.boards : []))
      .map((b) => b.board_id)
      .filter(Boolean)
      .map(String);

    if (!boardIds.length) return result;

    const cardIdStr = String(cardId);
    const boardResults = await Promise.allSettled(
      boardIds.map((bid) =>
        kanbanBoardService.getFullBoard(bid).then((res) => ({
          boardId: bid,
          workflows: mapFullBoardApiResponse(res?.data),
        }))
      )
    );

    for (const r of boardResults) {
      if (r.status !== "fulfilled") continue;
      const { boardId: bid, workflows } = r.value;
      for (const wf of workflows) {
        const card = wf.cards?.[cardIdStr];
        if (card) {
          if (card.title) result.cardTitle = card.title;
          if (card.color) result.cardColor = card.color;
          result.boardId = bid;
          return result;
        }
      }
    }
  } catch {
    // Degrade gracefully — CardForm still works with just call_id
  }

  return result;
}

function CeoApproval() {
  const { callId, cardId } = useParams();
  const navigate = useNavigate();

  // null = still resolving (show spinner); object = ready (may be partial if fetches failed)
  const [resolvedData, setResolvedData] = useState(null);

  useEffect(() => {
    setResolvedData(null); // reset → spinner while fetching

    if (!callId) {
      setResolvedData({});
      return undefined;
    }

    let cancelled = false;
    const idToFetch = cardId ?? callId;

    resolveCardData(callId, idToFetch).then((res) => {
      if (cancelled) return;
      setResolvedData(res);
    });

    return () => { cancelled = true; };
  }, [callId, cardId]);

  const card = useMemo(() => {
    if (!resolvedData) return null;
    const id = cardId ?? callId;
    const stub = { id, card_id: id, call_id: callId };
    const { callTypeId, cardTitle, cardColor, boardId } = resolvedData;
    if (callTypeId) { stub.call_type_id = callTypeId; stub.typeOfCall = callTypeId; }
    if (cardTitle) { stub.title = cardTitle; }
    if (cardColor) { stub.color = cardColor; }
    if (boardId) { stub.board_id = boardId; }
    return stub;
  }, [callId, cardId, resolvedData]);

  // Hold rendering until all card data is resolved — prevents the "Untitled / blue" flash
  if (!card) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <CardForm
      show
      close={() => navigate(ROUTE_PATHS.DASHBOARD)}
      card={card}
      boardId={resolvedData?.boardId ?? null}
      initialTab="Export Approval"
    />
  );
}

export default CeoApproval;
