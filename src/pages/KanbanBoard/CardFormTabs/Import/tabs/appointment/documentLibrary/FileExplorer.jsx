import PropTypes from "prop-types";
import { useMemo } from "react";

const SORT_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "name", label: "Name" },
  { value: "date", label: "Date" },
];

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <circle cx="7" cy="7" r="4.75" stroke="currentColor" strokeWidth="1.4" />
    <path d="M10.5 10.5L13.5 13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const GridIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <rect x="2" y="2" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    <rect x="9.5" y="2" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    <rect x="2" y="9.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    <rect x="9.5" y="9.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);

const ListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M2 4H14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M2 8H14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M2 12H14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const FolderRowIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path
      d="M2.5 6C2.5 5.17157 3.17157 4.5 4 4.5H7.87868C8.27652 4.5 8.65803 4.65804 8.93934 4.93934L10.0607 6.06066C10.342 6.34197 10.7235 6.5 11.1213 6.5H16C16.8284 6.5 17.5 7.17157 17.5 8V14.5C17.5 15.3284 16.8284 16 16 16H4C3.17157 16 2.5 15.3284 2.5 14.5V6Z"
      fill="#DBEAFE"
      stroke="#3B82F6"
      strokeWidth="1.2"
    />
  </svg>
);

const FileTypeIcon = ({ type }) => {
  const label = type === "pdf" ? "PDF" : type === "doc" ? "DOC" : type === "xls" ? "XLS" : "FILE";
  const modifier =
    type === "pdf" ? "pdf" : type === "doc" ? "doc" : type === "xls" ? "xls" : "default";

  return (
    <div className={`doc-lib-file-icon doc-lib-file-icon--${modifier}`} aria-hidden>
      <span>{label}</span>
    </div>
  );
};

FileTypeIcon.propTypes = {
  type: PropTypes.string.isRequired,
};

const parseDocumentDate = (dateString) => {
  const parsed = Date.parse(dateString);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const FileExplorer = ({
  breadcrumb,
  childFolders,
  files,
  selectedDocumentId,
  searchQuery,
  sortBy,
  viewMode,
  onSearchChange,
  onSortChange,
  onViewModeChange,
  onSelectFolder,
  onSelectDocument,
}) => {
  const filteredFiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = query
      ? files.filter((file) => file.name.toLowerCase().includes(query))
      : [...files];

    if (sortBy === "name") {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "date") {
      result = [...result].sort(
        (a, b) => parseDocumentDate(b.date) - parseDocumentDate(a.date)
      );
    }

    return result;
  }, [files, searchQuery, sortBy]);

  const hasContent = childFolders.length > 0 || filteredFiles.length > 0;

  return (
    <div className="doc-lib-explorer">
      <div className="doc-lib-explorer-header">
        <nav className="doc-lib-breadcrumb" aria-label="Breadcrumb">
          {breadcrumb.map((segment, index) => (
            <span key={`${segment}-${index}`} className="doc-lib-breadcrumb-segment">
              {index > 0 && <span className="doc-lib-breadcrumb-separator" aria-hidden>&gt;</span>}
              <span
                className={
                  index === breadcrumb.length - 1
                    ? "doc-lib-breadcrumb-current"
                    : "doc-lib-breadcrumb-link"
                }
              >
                {segment}
              </span>
            </span>
          ))}
        </nav>

        <div className="doc-lib-explorer-toolbar">
          <div className="doc-lib-search">
            <span className="doc-lib-search-icon">
              <SearchIcon />
            </span>
            <input
              type="search"
              className="doc-lib-search-input"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              aria-label="Search documents"
            />
          </div>

          <div className="doc-lib-toolbar-actions">
            <label className="doc-lib-sort-label" htmlFor="doc-lib-sort">
              Sort
            </label>
            <select
              id="doc-lib-sort"
              className="doc-lib-sort-select"
              value={sortBy}
              onChange={(event) => onSortChange(event.target.value)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <div className="doc-lib-view-toggle" role="group" aria-label="View mode">
              <button
                type="button"
                className={`doc-lib-view-btn${viewMode === "list" ? " is-active" : ""}`}
                onClick={() => onViewModeChange("list")}
                aria-label="List view"
                aria-pressed={viewMode === "list"}
              >
                <ListIcon />
              </button>
              <button
                type="button"
                className={`doc-lib-view-btn${viewMode === "grid" ? " is-active" : ""}`}
                onClick={() => onViewModeChange("grid")}
                aria-label="Grid view"
                aria-pressed={viewMode === "grid"}
              >
                <GridIcon />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="doc-lib-explorer-body">
        {!hasContent ? (
          <div className="doc-lib-explorer-empty">
            <p>No documents found in this folder.</p>
          </div>
        ) : (
          <div className={`doc-lib-file-list doc-lib-file-list--${viewMode}`}>
            {childFolders.map((folder) => (
              <button
                key={folder.name}
                type="button"
                className="doc-lib-file-row doc-lib-file-row--folder"
                onClick={() => onSelectFolder(folder.name, folder.parentName)}
              >
                <span className="doc-lib-file-row-icon">
                  <FolderRowIcon />
                </span>
                <span className="doc-lib-file-row-main">
                  <span className="doc-lib-file-row-name">{folder.name}</span>
                  <span className="doc-lib-file-row-meta">Folder</span>
                </span>
              </button>
            ))}

            {filteredFiles.map((file) => {
              const isSelected = selectedDocumentId === file.id;

              return (
                <button
                  key={file.id}
                  type="button"
                  className={`doc-lib-file-row doc-lib-file-row--file${isSelected ? " is-selected" : ""}`}
                  onClick={() => onSelectDocument(file.id)}
                  aria-selected={isSelected}
                >
                  <span className="doc-lib-file-row-icon">
                    <FileTypeIcon type={file.type} />
                  </span>
                  <span className="doc-lib-file-row-main">
                    <span className="doc-lib-file-row-name" title={file.name}>
                      {file.name}
                    </span>
                    <span className="doc-lib-file-row-meta">
                      {file.size}
                      <span className="doc-lib-file-row-dot" aria-hidden>•</span>
                      {file.date}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

FileExplorer.propTypes = {
  breadcrumb: PropTypes.arrayOf(PropTypes.string).isRequired,
  childFolders: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      parentName: PropTypes.string,
    })
  ).isRequired,
  files: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      type: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      size: PropTypes.string.isRequired,
      date: PropTypes.string.isRequired,
    })
  ).isRequired,
  selectedDocumentId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  searchQuery: PropTypes.string.isRequired,
  sortBy: PropTypes.string.isRequired,
  viewMode: PropTypes.oneOf(["list", "grid"]).isRequired,
  onSearchChange: PropTypes.func.isRequired,
  onSortChange: PropTypes.func.isRequired,
  onViewModeChange: PropTypes.func.isRequired,
  onSelectFolder: PropTypes.func.isRequired,
  onSelectDocument: PropTypes.func.isRequired,
};

export default FileExplorer;
