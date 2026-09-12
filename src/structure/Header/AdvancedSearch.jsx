import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiX, FiChevronDown } from 'react-icons/fi';
import CustomModal from '../../components/CustomModal';
import useWorkSpaceReducer from '../../store/WorkSpaceReducer';
import kanbanBoardService from '../../services/kanbanBoardService';
import { mapFullBoardApiResponse } from '../../shared/helpers/kanbanBoardApiMapper';
import '../../design/scss/structure/header/AdvancedSearch.scss';

// Categories shown in the "Search in N places" dropdown that aren't backed by an
// API yet — toggleable in local UI state only, since there's nothing to filter
// against until subtasks/comments/docs search exists.
const EXTRA_SEARCH_PLACES = ['Subtasks', 'Comments', 'Docs'];
const INITIAL_EXTRA_PLACES = Object.fromEntries(EXTRA_SEARCH_PLACES.map((label) => [label, false]));
// Filter chips from the target design that need APIs (board/owner/status filtering)
// we don't have yet — shown as disabled placeholders per product decision.
const COMING_SOON_CHIPS = ['Board', 'Owner/author', 'Status', 'Active cards/docs'];

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

function AdvancedSearch() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Only "Card details" is wired to real data today; the rest of the design's
  // "Search in N places" list (subtasks/comments/docs) is visual-only for now.
  const [searchCardDetails, setSearchCardDetails] = useState(false);
  const [extraPlaces, setExtraPlaces] = useState(INITIAL_EXTRA_PLACES);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  // Card titles are fetched per-board on demand (there's no endpoint that
  // lists cards across all boards) and cached here so re-typing doesn't
  // re-fetch boards already loaded.
  const [cardCache, setCardCache] = useState({});
  const [cardsLoading, setCardsLoading] = useState(false);
  const cardFetchInFlight = useRef(new Set());
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

  const hasQuery = query.trim().length > 0;

  // Load card titles for any board not already cached, but only once the
  // user actually wants card results — avoids firing get_full_board for
  // every board on the page just because the modal is open.
  useEffect(() => {
    if (!isOpen || !searchCardDetails || !hasQuery) return;

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
            const cards = boardWorkflows.flatMap((wf) =>
              Object.values(wf.cards || {}).map((card) => ({
                ...card,
                statusTitle: wf.columns?.[card.columnId]?.title || '',
                statusColor: wf.columns?.[card.columnId]?.color || null,
              }))
            );
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
  }, [isOpen, searchCardDetails, hasQuery, workspaces, cardCache]);

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
              workflowName: card.workflow_name,
              statusTitle: card.statusTitle,
              statusColor: card.statusColor,
            });
          }
        });
      });
    });

    return { workspaces: matchedWorkspaces, boards: matchedBoards, cards: matchedCards };
  }, [workspaces, cardCache, query]);

  const visibleWorkspaces = results.workspaces;
  const visibleBoards = results.boards;
  const visibleCards = searchCardDetails ? results.cards : [];
  const totalResults = visibleWorkspaces.length + visibleBoards.length + visibleCards.length;

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

            <div className="advanced-search-chips">
              {COMING_SOON_CHIPS.map((label) => (
                <button
                  type="button"
                  key={label}
                  className={`search-chip ${label === 'Active cards/docs' ? 'search-chip--active' : ''}`}
                  disabled
                  title="Coming soon"
                >
                  <span>{label}</span>
                  <FiChevronDown className="chip-chevron" />
                </button>
              ))}
            </div>

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

              {hasQuery && !isLoading && totalResults === 0 && !cardsLoading && (
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
                          {card.statusColor && (
                            <span className="status-dot" style={{ background: card.statusColor }} />
                          )}
                          <span>
                            {[card.workflowName, card.statusTitle].filter(Boolean).join(' / ')}
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
            </div>
          </div>
        }
      />
    </div>
  );
}

export default AdvancedSearch;
