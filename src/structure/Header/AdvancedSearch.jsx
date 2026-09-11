import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiX, FiLayers, FiGrid, FiFileText, FiChevronDown } from 'react-icons/fi';
import useWorkSpaceReducer from '../../store/WorkSpaceReducer';
import kanbanBoardService from '../../services/kanbanBoardService';
import { mapFullBoardApiResponse } from '../../shared/helpers/kanbanBoardApiMapper';
import '../../design/scss/structure/header/AdvancedSearch.scss';

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

function AdvancedSearch() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ workspaces: true, boards: true, cards: true });
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  // Card titles are fetched per-board on demand (there's no endpoint that
  // lists cards across all boards) and cached here so re-typing doesn't
  // re-fetch boards already loaded.
  const [cardCache, setCardCache] = useState({});
  const [cardsLoading, setCardsLoading] = useState(false);
  const cardFetchInFlight = useRef(new Set());
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const filterMenuRef = useRef(null);

  const workspaces = useWorkSpaceReducer((state) => state.workspaces);
  const workspacesFetched = useWorkSpaceReducer((state) => state.workspacesFetched);
  const isLoading = useWorkSpaceReducer((state) => state.isLoading);
  const listAllWorkspaces = useWorkSpaceReducer((state) => state.listAllWorkspaces);

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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Separate outside-click handler so the filter dropdown can close on its
  // own without collapsing the whole search panel.
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

  const hasQuery = query.trim().length > 0;

  // Load card titles for any board not already cached, but only once the
  // user actually wants card results — avoids firing get_full_board for
  // every board on the page just because the panel is open.
  useEffect(() => {
    if (!isOpen || !filters.cards || !hasQuery) return;

    const allBoardIds = (workspaces || []).flatMap((ws) =>
      (ws.boards || []).map((board) => board.board_id)
    );
    const missing = allBoardIds.filter(
      (id) => !(id in cardCache) && !cardFetchInFlight.current.has(id)
    );
    if (missing.length === 0) return;

    missing.forEach((id) => cardFetchInFlight.current.add(id));
    setCardsLoading(true);

    Promise.all(
      missing.map((boardId) =>
        kanbanBoardService
          .getFullBoard(boardId)
          .then((res) => {
            const boardWorkflows = mapFullBoardApiResponse(res?.data);
            const cards = boardWorkflows.flatMap((wf) => Object.values(wf.cards || {}));
            return { boardId, cards };
          })
          .catch(() => ({ boardId, cards: [] }))
      )
    ).then((entries) => {
      setCardCache((prev) => {
        const next = { ...prev };
        entries.forEach(({ boardId, cards }) => {
          next[boardId] = cards;
        });
        return next;
      });
      missing.forEach((id) => cardFetchInFlight.current.delete(id));
      setCardsLoading(false);
    });
  }, [isOpen, filters.cards, hasQuery, workspaces, cardCache]);

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return { workspaces: [], boards: [], cards: [] };

    const matchedWorkspaces = [];
    const matchedBoards = [];
    const matchedCards = [];

    (workspaces || []).forEach((ws) => {
      if (ws.workspace_name?.toLowerCase().includes(trimmed)) {
        matchedWorkspaces.push(ws);
      }
      (ws.boards || []).forEach((board) => {
        if (board.board_name?.toLowerCase().includes(trimmed)) {
          matchedBoards.push({ ...board, workspaceName: ws.workspace_name });
        }
        (cardCache[board.board_id] || []).forEach((card) => {
          if (card.title?.toLowerCase().includes(trimmed)) {
            matchedCards.push({
              id: card.id,
              title: card.title,
              boardId: board.board_id,
              boardName: board.board_name,
              workspaceName: ws.workspace_name,
            });
          }
        });
      });
    });

    return { workspaces: matchedWorkspaces, boards: matchedBoards, cards: matchedCards };
  }, [workspaces, cardCache, query]);

  const visibleWorkspaces = filters.workspaces ? results.workspaces : [];
  const visibleBoards = filters.boards ? results.boards : [];
  const visibleCards = filters.cards ? results.cards : [];
  const hasVisibleResults =
    visibleWorkspaces.length > 0 || visibleBoards.length > 0 || visibleCards.length > 0;
  const noFilterSelected = !filters.workspaces && !filters.boards && !filters.cards;

  const activeFilterLabels = [
    filters.workspaces && 'Workspaces',
    filters.boards && 'Boards',
    filters.cards && 'Card Details',
  ].filter(Boolean);
  const filterLabel = activeFilterLabels.length > 0 ? activeFilterLabels.join(' & ') : 'nothing selected';

  const toggleFilter = (key) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleClose = () => {
    setIsOpen(false);
    setQuery('');
    setFilters({ workspaces: true, boards: true, cards: true });
    setFilterMenuOpen(false);
  };

  const handleSelectWorkspace = () => {
    handleClose();
    navigate('/workspaces');
  };

  const handleSelectBoard = (board) => {
    handleClose();
    navigate(`/kanban-board/${board.board_id}`);
  };

  // No route currently supports deep-linking straight to a card, so this
  // opens the card's board — same as a board result.
  const handleSelectCard = (card) => {
    handleClose();
    navigate(`/kanban-board/${card.boardId}`);
  };

  return (
    <div className={`advanced-search ${isOpen ? 'open' : ''}`} ref={wrapperRef}>
      <div className="advanced-search-box" onClick={() => setIsOpen(true)}>
        <FiSearch className="search-icon" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search workspaces & boards..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
        />
        {query && (
          <button
            type="button"
            className="clear-btn"
            aria-label="Clear search"
            onClick={(e) => {
              e.stopPropagation();
              setQuery('');
              inputRef.current?.focus();
            }}
          >
            <FiX />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="advanced-search-panel">
          <div className="advanced-search-filter" ref={filterMenuRef}>
            <button
              type="button"
              className="filter-trigger"
              onClick={() => setFilterMenuOpen((open) => !open)}
            >
              <span>Search in {filterLabel}</span>
              <FiChevronDown className={`chevron ${filterMenuOpen ? 'open' : ''}`} />
            </button>

            {filterMenuOpen && (
              <div className="filter-menu">
                <div className="filter-menu-item">
                  <span className="filter-menu-label">Workspaces</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={filters.workspaces}
                    aria-label="Toggle workspace results"
                    className={`toggle-switch ${filters.workspaces ? 'on' : ''}`}
                    onClick={() => toggleFilter('workspaces')}
                  >
                    <span className="toggle-knob" />
                  </button>
                </div>
                <div className="filter-menu-item">
                  <span className="filter-menu-label">Boards</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={filters.boards}
                    aria-label="Toggle board results"
                    className={`toggle-switch ${filters.boards ? 'on' : ''}`}
                    onClick={() => toggleFilter('boards')}
                  >
                    <span className="toggle-knob" />
                  </button>
                </div>
                <div className="filter-menu-item">
                  <span className="filter-menu-label">Card Details</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={filters.cards}
                    aria-label="Toggle card results"
                    className={`toggle-switch ${filters.cards ? 'on' : ''}`}
                    onClick={() => toggleFilter('cards')}
                  >
                    <span className="toggle-knob" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="advanced-search-results">
            {!hasQuery && (
              <div className="advanced-search-empty">Start typing to search workspaces, boards and card details</div>
            )}

            {hasQuery && isLoading && (
              <div className="advanced-search-empty">Searching…</div>
            )}

            {hasQuery && !isLoading && noFilterSelected && (
              <div className="advanced-search-empty">Select at least one category above to search</div>
            )}

            {hasQuery && !isLoading && !noFilterSelected && !hasVisibleResults && !cardsLoading && (
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
                    <FiLayers className="item-icon" />
                    <span className="item-name">{highlightMatch(ws.workspace_name, query)}</span>
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
                    <FiGrid className="item-icon" />
                    <span className="item-name">{highlightMatch(board.board_name, query)}</span>
                    <span className="item-meta">{board.workspaceName}</span>
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
                    <FiFileText className="item-icon" />
                    <span className="item-name">{highlightMatch(card.title, query)}</span>
                    <span className="item-meta">{card.boardName}</span>
                  </button>
                ))}
              </div>
            )}

            {hasQuery && !isLoading && filters.cards && cardsLoading && (
              <div className="advanced-search-empty">Loading card details…</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdvancedSearch;
