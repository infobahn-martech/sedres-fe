import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiX, FiChevronDown } from 'react-icons/fi';
import CustomModal from '../../components/CustomModal';
import useWorkSpaceReducer from '../../store/WorkSpaceReducer';
import useCommonReducer from '../../store/CommonReducer';
import kanbanBoardService from '../../services/kanbanBoardService';
import { mapFullBoardApiResponse } from '../../shared/helpers/kanbanBoardApiMapper';
import '../../design/scss/structure/header/AdvancedSearch.scss';

// Categories shown in the "Search in N places" dropdown. "Comments" has no
// search API yet, so it stays toggleable in local UI state only.
const EXTRA_SEARCH_PLACES = ['Subtasks', 'Comments', 'Docs'];
const INITIAL_EXTRA_PLACES = Object.fromEntries(EXTRA_SEARCH_PLACES.map((label) => [label, false]));

const AVATAR_PALETTE = ['#00368c', '#7c3aed', '#0f9d58', '#e8710a', '#c2185b', '#0891b2'];

function avatarColor(name) {
  const code = name ? name.trim().charCodeAt(0) || 0 : 0;
  return AVATAR_PALETTE[code % AVATAR_PALETTE.length];
}

function avatarLetter(name) {
  return (name || '?').trim().charAt(0).toUpperCase() || '?';
}

// Wraps the first match of `query` inside `text` with <mark>, case-insensitive.
function highlightMatch(text, query) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// Fetches search results per-board (there's no endpoint that searches across
// all boards at once) for whichever category is enabled, scoped to the
// selected Board/Owner/Status filters plus the current query text, and
// caches them by board id + filter + query combination so flipping filters
// back and forth doesn't re-fetch data already loaded for that exact query.
// The query itself is debounced (not sent to the API, which has no text
// param) so every distinct search term still re-fetches fresh data, without
// firing a request per keystroke. Returns the raw cache (so callers can
// depend on it, e.g. in a useMemo) plus a getter that hides the filter key.
const SEARCH_DEBOUNCE_MS = 300;

function useBoardSearchCache({ enabled, query, isOpen, workspaces, fetchBoard, boardId, ownerId, status }) {
  const [cache, setCache] = useState({});
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(new Set());
  const trimmedQuery = (query || '').trim().toLowerCase();
  const hasQuery = trimmedQuery.length > 0;
  const filterSuffix = `${ownerId || ''}::${status || ''}::${trimmedQuery}`;

  useEffect(() => {
    if (!isOpen || !enabled || !hasQuery) return undefined;

    const targetBoardIds = boardId
      ? [boardId]
      : (workspaces || []).flatMap((ws) => (ws.boards || []).map((board) => board.board_id));

    const missing = targetBoardIds.filter((id) => {
      const key = `${id}::${filterSuffix}`;
      return !(key in cache) && !inFlight.current.has(key);
    });
    if (missing.length === 0) return undefined;

    const timer = setTimeout(() => {
      missing.forEach((id) => inFlight.current.add(`${id}::${filterSuffix}`));
      setLoading(true);

      Promise.all(
        missing.map((id) =>
          fetchBoard(id, { owner_id: ownerId || undefined, status: status || undefined })
            .then((res) => ({ id, items: res?.data?.data || [] }))
            .catch(() => ({ id, items: [] }))
        )
      ).then((entries) => {
        setCache((prev) => {
          const next = { ...prev };
          entries.forEach(({ id, items }) => {
            next[`${id}::${filterSuffix}`] = items;
          });
          return next;
        });
        missing.forEach((id) => inFlight.current.delete(`${id}::${filterSuffix}`));
        setLoading(false);
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [isOpen, enabled, hasQuery, workspaces, cache, fetchBoard, boardId, ownerId, status, filterSuffix]);

  const getItems = (id) => cache[`${id}::${filterSuffix}`] || [];

  return [cache, getItems, loading];
}

function AdvancedSearch() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  // "Comments" has no search API yet, so it stays visual-only for now.
  const [searchCardDetails, setSearchCardDetails] = useState(false);
  const [extraPlaces, setExtraPlaces] = useState(INITIAL_EXTRA_PLACES);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  // Board/Owner/Status filter chips — scope the card/subtask/document search
  // to one board, one owner, and (board-specific) one workflow column.
  const [selectedBoardId, setSelectedBoardId] = useState(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [openChip, setOpenChip] = useState(null); // 'board' | 'owner' | 'status' | null
  const [chipSearch, setChipSearch] = useState('');
  const [boardColumnsCache, setBoardColumnsCache] = useState({});
  const [boardColumnsLoading, setBoardColumnsLoading] = useState(false);
  const inputRef = useRef(null);
  const filterMenuRef = useRef(null);
  const chipsRef = useRef(null);

  const workspaces = useWorkSpaceReducer((state) => state.workspaces);
  const workspacesFetched = useWorkSpaceReducer((state) => state.workspacesFetched);
  const isLoading = useWorkSpaceReducer((state) => state.isLoading);
  const listAllWorkspaces = useWorkSpaceReducer((state) => state.listAllWorkspaces);

  const allUsers = useCommonReducer((state) => state.allUsers);
  const allUsersLoading = useCommonReducer((state) => state.allUsersLoading);
  const getAllUsers = useCommonReducer((state) => state.getAllUsers);

  // Workspaces/boards are loaded lazily on first open so the header never
  // pays for this fetch on pages that never open the search.
  useEffect(() => {
    if (isOpen && !workspacesFetched) {
      listAllWorkspaces();
    }
  }, [isOpen, workspacesFetched, listAllWorkspaces]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Separate outside-click handler so the filter dropdown can close on its
  // own without collapsing the whole search modal.
  useEffect(() => {
    if (!filterMenuOpen) return undefined;
    const handleFilterClickOutside = (event) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) {
        setFilterMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleFilterClickOutside);
    return () => document.removeEventListener('mousedown', handleFilterClickOutside);
  }, [filterMenuOpen]);

  // Same pattern for the Board/Owner/Status chip dropdowns.
  useEffect(() => {
    if (!openChip) return undefined;
    const handleChipClickOutside = (event) => {
      if (chipsRef.current && !chipsRef.current.contains(event.target)) {
        setOpenChip(null);
      }
    };
    document.addEventListener('mousedown', handleChipClickOutside);
    return () => document.removeEventListener('mousedown', handleChipClickOutside);
  }, [openChip]);

  // Users list for the Owner/author chip — shared with the rest of the app,
  // fetched once on demand.
  useEffect(() => {
    if (openChip === 'owner' && allUsers.length === 0 && !allUsersLoading) {
      getAllUsers({});
    }
  }, [openChip, allUsers, allUsersLoading, getAllUsers]);

  // Status options are the selected board's own workflow columns, so they're
  // fetched per-board (and cleared whenever the board filter changes).
  useEffect(() => {
    if (openChip !== 'status' || !selectedBoardId || selectedBoardId in boardColumnsCache) return;
    setBoardColumnsLoading(true);
    kanbanBoardService
      .getFullBoard(selectedBoardId)
      .then((res) => {
        const workflows = mapFullBoardApiResponse(res?.data);
        const seen = new Set();
        const columns = [];
        workflows.forEach((wf) => {
          Object.values(wf.columns || {}).forEach((col) => {
            if (col?.title && !seen.has(col.title)) {
              seen.add(col.title);
              columns.push(col.title);
            }
          });
        });
        setBoardColumnsCache((prev) => ({ ...prev, [selectedBoardId]: columns }));
      })
      .catch(() => {
        setBoardColumnsCache((prev) => ({ ...prev, [selectedBoardId]: [] }));
      })
      .finally(() => setBoardColumnsLoading(false));
  }, [openChip, selectedBoardId, boardColumnsCache]);

  const allBoardOptions = useMemo(
    () =>
      (workspaces || []).flatMap((ws) =>
        (ws.boards || []).map((board) => ({
          board_id: board.board_id,
          board_name: board.board_name,
          workspace_name: ws.workspace_name,
        }))
      ),
    [workspaces]
  );
  const boardStatusOptions = boardColumnsCache[selectedBoardId] || [];
  const selectedBoardName = allBoardOptions.find(
    (b) => String(b.board_id) === String(selectedBoardId)
  )?.board_name;
  const selectedOwnerName = (allUsers || []).find(
    (u) => String(u.user_id) === String(selectedOwnerId)
  )?.name;

  const openChipMenu = (chip) => {
    setChipSearch('');
    setOpenChip((prev) => (prev === chip ? null : chip));
  };

  const selectBoardFilter = (boardId) => {
    setSelectedBoardId((prev) => (String(prev) === String(boardId) ? null : boardId));
    setSelectedStatus(null);
    setOpenChip(null);
  };

  const selectOwnerFilter = (userId) => {
    setSelectedOwnerId((prev) => (String(prev) === String(userId) ? null : userId));
    setOpenChip(null);
  };

  const selectStatusFilter = (statusValue) => {
    setSelectedStatus((prev) => (prev === statusValue ? null : statusValue));
    setOpenChip(null);
  };

  const hasQuery = query.trim().length > 0;

  // Card/subtask/document results are fetched per-board on demand, only for
  // whichever categories the user has switched on in the filter menu, and
  // scoped to the Board/Owner/Status chip filters.
  const [cardCache, getCardItems, cardsLoading] = useBoardSearchCache({
    enabled: searchCardDetails,
    query,
    isOpen,
    workspaces,
    fetchBoard: kanbanBoardService.searchCardDetails,
    boardId: selectedBoardId,
    ownerId: selectedOwnerId,
    status: selectedStatus,
  });
  const [subtaskCache, getSubtaskItems, subtasksLoading] = useBoardSearchCache({
    enabled: extraPlaces.Subtasks,
    query,
    isOpen,
    workspaces,
    fetchBoard: kanbanBoardService.searchSubtasks,
    boardId: selectedBoardId,
    ownerId: selectedOwnerId,
    status: selectedStatus,
  });
  const [documentCache, getDocumentItems, documentsLoading] = useBoardSearchCache({
    enabled: extraPlaces.Docs,
    query,
    isOpen,
    workspaces,
    fetchBoard: kanbanBoardService.searchDocuments,
    boardId: selectedBoardId,
    ownerId: selectedOwnerId,
  });

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return { workspaces: [], boards: [], cards: [], subtasks: [], documents: [] };

    const matchedWorkspaces = [];
    const matchedBoards = [];
    const matchedCards = [];
    const matchedSubtasks = [];
    const matchedDocuments = [];

    (workspaces || []).forEach((ws) => {
      if (ws.workspace_name?.toLowerCase().includes(trimmed)) {
        matchedWorkspaces.push(ws);
      }
      (ws.boards || []).forEach((board) => {
        // A selected Board filter scopes every result group (including the
        // Boards name-match group) down to that one board.
        if (selectedBoardId && String(board.board_id) !== String(selectedBoardId)) return;

        if (board.board_name?.toLowerCase().includes(trimmed)) {
          matchedBoards.push({ ...board, workspaceName: ws.workspace_name });
        }

        getCardItems(board.board_id).forEach((card) => {
          if (card.title?.toLowerCase().includes(trimmed)) {
            matchedCards.push({
              id: card.card_id,
              title: card.title,
              boardId: board.board_id,
              boardName: card.board_name || board.board_name,
              workspaceName: ws.workspace_name,
              stageName: card.stage_name,
              statusTitle: card.column_name,
            });
          }
        });

        getSubtaskItems(board.board_id).forEach((subtask) => {
          const haystack = `${subtask.description || ''} ${subtask.card_title || ''}`.toLowerCase();
          if (haystack.includes(trimmed)) {
            matchedSubtasks.push({
              id: subtask.subtask_id,
              description: subtask.description,
              cardTitle: subtask.card_title,
              boardId: board.board_id,
              boardName: subtask.board_name || board.board_name,
              workspaceName: ws.workspace_name,
              isCompleted: !!subtask.is_completed,
              assignedToName: subtask.assigned_to_name,
            });
          }
        });

        getDocumentItems(board.board_id).forEach((doc) => {
          const haystack = `${doc.document_name || ''} ${doc.file_name || ''} ${doc.card_title || ''}`.toLowerCase();
          if (haystack.includes(trimmed)) {
            matchedDocuments.push({
              id: doc.call_task_document_id,
              documentName: doc.document_name,
              cardTitle: doc.card_title,
              boardId: board.board_id,
              boardName: doc.board_name || board.board_name,
              workspaceName: ws.workspace_name,
              uploadedByName: doc.uploaded_by_name,
            });
          }
        });
      });
    });

    return {
      workspaces: matchedWorkspaces,
      boards: matchedBoards,
      cards: matchedCards,
      subtasks: matchedSubtasks,
      documents: matchedDocuments,
    };
  }, [workspaces, cardCache, subtaskCache, documentCache, selectedBoardId, query]);

  const visibleWorkspaces = results.workspaces;
  const visibleBoards = results.boards;
  const visibleCards = searchCardDetails ? results.cards : [];
  const visibleSubtasks = extraPlaces.Subtasks ? results.subtasks : [];
  const visibleDocuments = extraPlaces.Docs ? results.documents : [];
  const totalResults =
    visibleWorkspaces.length +
    visibleBoards.length +
    visibleCards.length +
    visibleSubtasks.length +
    visibleDocuments.length;
  const anyCategoryLoading = cardsLoading || subtasksLoading || documentsLoading;

  const placesCount =
    (searchCardDetails ? 1 : 0) + Object.values(extraPlaces).filter(Boolean).length;

  const toggleExtraPlace = (label) => {
    setExtraPlaces((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const handleClose = () => {
    setIsOpen(false);
    setQuery('');
    setSearchCardDetails(false);
    setExtraPlaces(INITIAL_EXTRA_PLACES);
    setFilterMenuOpen(false);
    setSelectedBoardId(null);
    setSelectedOwnerId(null);
    setSelectedStatus(null);
    setOpenChip(null);
  };

  const handleSelectWorkspace = () => {
    handleClose();
    navigate('/workspaces');
  };

  const handleSelectBoard = (board) => {
    handleClose();
    navigate(`/kanban-board/${board.board_id}`);
  };

  // KanbanBoardPage opens a ?card=<id> deep link once that board's workflows
  // have loaded. Subtasks/documents don't have an equivalent card-form tab
  // to jump to yet, so those still just open the owning board.
  const handleSelectCard = (card) => {
    handleClose();
    navigate(`/kanban-board/${card.boardId}?card=${card.id}`);
  };

  const handleSelectSubtask = (subtask) => {
    handleClose();
    navigate(`/kanban-board/${subtask.boardId}`);
  };

  const handleSelectDocument = (doc) => {
    handleClose();
    navigate(`/kanban-board/${doc.boardId}`);
  };

  return (
    <div className={`advanced-search ${isOpen ? 'open' : ''}`}>
      <div className="advanced-search-box" onClick={() => setIsOpen(true)}>
        <FiSearch className="search-icon" />
        <input
          type="text"
          placeholder="Search workspaces & boards..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          readOnly={isOpen}
        />
      </div>

      <CustomModal
        show={isOpen}
        closeModal={handleClose}
        className="advanced-search-modal"
        dialgName="advanced-search-modal-dialog"
        createModal={false}
        body={
          <div className="advanced-search-modal-content">
            <div className="advanced-search-modal-header">
              <h2 className="advanced-search-modal-title">Search</h2>
              <button
                type="button"
                className="advanced-search-modal-close"
                onClick={handleClose}
                aria-label="Close"
              >
                <FiX size={20} />
              </button>
            </div>

            <div className="advanced-search-bar">
              <div className="advanced-search-input-wrap">
                <FiSearch className="search-icon" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search workspaces, boards & cards..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button
                    type="button"
                    className="clear-btn"
                    aria-label="Clear search"
                    onClick={() => {
                      setQuery('');
                      inputRef.current?.focus();
                    }}
                  >
                    <FiX />
                  </button>
                )}
              </div>

              <div className="advanced-search-filter" ref={filterMenuRef}>
                <button
                  type="button"
                  className="filter-trigger"
                  onClick={() => setFilterMenuOpen((open) => !open)}
                >
                  <span>Search in {placesCount} places</span>
                  <FiChevronDown className={`chevron ${filterMenuOpen ? 'open' : ''}`} />
                </button>

                {filterMenuOpen && (
                  <div className="filter-menu">
                    <div className="filter-menu-item">
                      <span className="filter-menu-label">Card details</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={searchCardDetails}
                        aria-label="Toggle card detail results"
                        className={`toggle-switch ${searchCardDetails ? 'on' : ''}`}
                        onClick={() => setSearchCardDetails((v) => !v)}
                      >
                        <span className="toggle-knob" />
                      </button>
                    </div>
                    {EXTRA_SEARCH_PLACES.map((label) => (
                      <div className="filter-menu-item" key={label}>
                        <span className="filter-menu-label">{label}</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={extraPlaces[label]}
                          aria-label={`Toggle ${label.toLowerCase()} results`}
                          className={`toggle-switch ${extraPlaces[label] ? 'on' : ''}`}
                          onClick={() => toggleExtraPlace(label)}
                        >
                          <span className="toggle-knob" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {placesCount > 0 && (
              <div className="advanced-search-chips" ref={chipsRef}>
                <div className="search-chip-wrap">
                  <button
                    type="button"
                    className={`search-chip ${selectedBoardId ? 'search-chip--active' : ''}`}
                    onClick={() => openChipMenu('board')}
                  >
                    <span>{selectedBoardName || 'Board'}</span>
                    <FiChevronDown className="chip-chevron" />
                  </button>
                  {openChip === 'board' && (
                    <div className="chip-menu">
                      <input
                        type="text"
                        className="chip-menu-search"
                        placeholder="Search boards..."
                        value={chipSearch}
                        onChange={(e) => setChipSearch(e.target.value)}
                        autoFocus
                      />
                      <div className="chip-menu-list">
                        <button
                          type="button"
                          className={`chip-menu-option ${!selectedBoardId ? 'selected' : ''}`}
                          onClick={() => selectBoardFilter(null)}
                        >
                          All boards
                        </button>
                        {allBoardOptions
                          .filter((b) => (b.board_name || '').toLowerCase().includes(chipSearch.trim().toLowerCase()))
                          .map((b) => (
                            <button
                              type="button"
                              key={b.board_id}
                              className={`chip-menu-option ${String(selectedBoardId) === String(b.board_id) ? 'selected' : ''}`}
                              onClick={() => selectBoardFilter(b.board_id)}
                            >
                              {b.board_name}
                            </button>
                          ))}
                        {allBoardOptions.length === 0 && (
                          <div className="chip-menu-empty">No boards found</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="search-chip-wrap">
                  <button
                    type="button"
                    className={`search-chip ${selectedOwnerId ? 'search-chip--active' : ''}`}
                    onClick={() => openChipMenu('owner')}
                  >
                    <span>{selectedOwnerName || 'Owner/author'}</span>
                    <FiChevronDown className="chip-chevron" />
                  </button>
                  {openChip === 'owner' && (
                    <div className="chip-menu">
                      <input
                        type="text"
                        className="chip-menu-search"
                        placeholder="Search users..."
                        value={chipSearch}
                        onChange={(e) => setChipSearch(e.target.value)}
                        autoFocus
                      />
                      <div className="chip-menu-list">
                        <button
                          type="button"
                          className={`chip-menu-option ${!selectedOwnerId ? 'selected' : ''}`}
                          onClick={() => selectOwnerFilter(null)}
                        >
                          All owners
                        </button>
                        {(allUsers || [])
                          .filter((u) => (u.name || '').toLowerCase().includes(chipSearch.trim().toLowerCase()))
                          .map((u) => (
                            <button
                              type="button"
                              key={u.user_id}
                              className={`chip-menu-option ${String(selectedOwnerId) === String(u.user_id) ? 'selected' : ''}`}
                              onClick={() => selectOwnerFilter(u.user_id)}
                            >
                              {u.name}
                            </button>
                          ))}
                        {allUsersLoading && <div className="chip-menu-empty">Loading users…</div>}
                        {!allUsersLoading && (allUsers || []).length === 0 && (
                          <div className="chip-menu-empty">No users found</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="search-chip-wrap">
                  <button
                    type="button"
                    className={`search-chip ${selectedStatus ? 'search-chip--active' : ''}`}
                    onClick={() => selectedBoardId && openChipMenu('status')}
                    disabled={!selectedBoardId}
                    title={selectedBoardId ? undefined : 'Select a board first'}
                  >
                    <span>{selectedStatus || 'Status'}</span>
                    <FiChevronDown className="chip-chevron" />
                  </button>
                  {openChip === 'status' && selectedBoardId && (
                    <div className="chip-menu">
                      <div className="chip-menu-list">
                        <button
                          type="button"
                          className={`chip-menu-option ${!selectedStatus ? 'selected' : ''}`}
                          onClick={() => selectStatusFilter(null)}
                        >
                          All statuses
                        </button>
                        {boardStatusOptions.map((title) => (
                          <button
                            type="button"
                            key={title}
                            className={`chip-menu-option ${selectedStatus === title ? 'selected' : ''}`}
                            onClick={() => selectStatusFilter(title)}
                          >
                            {title}
                          </button>
                        ))}
                        {boardColumnsLoading && <div className="chip-menu-empty">Loading statuses…</div>}
                        {!boardColumnsLoading && boardStatusOptions.length === 0 && (
                          <div className="chip-menu-empty">No statuses found</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="advanced-search-results">
              {!hasQuery && (
                <div className="advanced-search-empty">Start typing to search workspaces, boards and card details</div>
              )}

              {hasQuery && isLoading && (
                <div className="advanced-search-empty">Searching…</div>
              )}

              {hasQuery && !isLoading && totalResults > 0 && (
                <div className="advanced-search-count">
                  Found {totalResults} result{totalResults === 1 ? '' : 's'} matching your search
                </div>
              )}

              {hasQuery && !isLoading && totalResults === 0 && !anyCategoryLoading && (
                <div className="advanced-search-empty">No results found for &quot;{query}&quot;</div>
              )}

              {hasQuery && !isLoading && visibleWorkspaces.length > 0 && (
                <div className="advanced-search-group">
                  <div className="advanced-search-group-label">Workspaces</div>
                  {visibleWorkspaces.map((ws) => (
                    <button
                      key={ws.workspace_id}
                      type="button"
                      className="advanced-search-item"
                      onClick={handleSelectWorkspace}
                    >
                      <span className="item-avatar" style={{ background: avatarColor(ws.workspace_name) }}>
                        {avatarLetter(ws.workspace_name)}
                      </span>
                      <span className="item-body">
                        <span className="item-name">{highlightMatch(ws.workspace_name, query)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {hasQuery && !isLoading && visibleBoards.length > 0 && (
                <div className="advanced-search-group">
                  <div className="advanced-search-group-label">Boards</div>
                  {visibleBoards.map((board) => (
                    <button
                      key={board.board_id}
                      type="button"
                      className="advanced-search-item"
                      onClick={() => handleSelectBoard(board)}
                    >
                      <span className="item-avatar" style={{ background: avatarColor(board.board_name) }}>
                        {avatarLetter(board.board_name)}
                      </span>
                      <span className="item-body">
                        <span className="item-name">{highlightMatch(board.board_name, query)}</span>
                        <span className="item-meta">{board.workspaceName}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {hasQuery && !isLoading && visibleCards.length > 0 && (
                <div className="advanced-search-group">
                  <div className="advanced-search-group-label">Card Details</div>
                  {visibleCards.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      className="advanced-search-item"
                      onClick={() => handleSelectCard(card)}
                    >
                      <span className="item-avatar" style={{ background: avatarColor(card.title) }}>
                        {avatarLetter(card.title)}
                      </span>
                      <span className="item-body">
                        <span className="item-name">{highlightMatch(card.title, query)}</span>
                        <span className="item-meta">
                          <span>
                            {[card.stageName, card.statusTitle].filter(Boolean).join(' / ')}
                          </span>
                          {card.id && <span className="item-meta-id">| #{card.id}</span>}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {hasQuery && !isLoading && searchCardDetails && cardsLoading && (
                <div className="advanced-search-empty">Loading card details…</div>
              )}

              {hasQuery && !isLoading && visibleSubtasks.length > 0 && (
                <div className="advanced-search-group">
                  <div className="advanced-search-group-label">Subtasks</div>
                  {visibleSubtasks.map((subtask) => (
                    <button
                      key={subtask.id}
                      type="button"
                      className="advanced-search-item"
                      onClick={() => handleSelectSubtask(subtask)}
                    >
                      <span className="item-avatar" style={{ background: avatarColor(subtask.description) }}>
                        {avatarLetter(subtask.description)}
                      </span>
                      <span className="item-body">
                        <span className="item-name">{highlightMatch(subtask.description || '', query)}</span>
                        <span className="item-meta">
                          <span>
                            {[subtask.cardTitle, subtask.boardName].filter(Boolean).join(' / ')}
                          </span>
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {hasQuery && !isLoading && extraPlaces.Subtasks && subtasksLoading && (
                <div className="advanced-search-empty">Loading subtasks…</div>
              )}

              {hasQuery && !isLoading && visibleDocuments.length > 0 && (
                <div className="advanced-search-group">
                  <div className="advanced-search-group-label">Docs</div>
                  {visibleDocuments.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      className="advanced-search-item"
                      onClick={() => handleSelectDocument(doc)}
                    >
                      <span className="item-avatar" style={{ background: avatarColor(doc.documentName) }}>
                        {avatarLetter(doc.documentName)}
                      </span>
                      <span className="item-body">
                        <span className="item-name">{highlightMatch(doc.documentName || '', query)}</span>
                        <span className="item-meta">
                          <span>
                            {[doc.cardTitle, doc.boardName].filter(Boolean).join(' / ')}
                          </span>
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {hasQuery && !isLoading && extraPlaces.Docs && documentsLoading && (
                <div className="advanced-search-empty">Loading documents…</div>
              )}
            </div>
          </div>
        }
      />
    </div>
  );
}

export default AdvancedSearch;
