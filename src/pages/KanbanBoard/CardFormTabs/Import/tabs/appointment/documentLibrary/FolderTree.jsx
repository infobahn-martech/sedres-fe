import PropTypes from "prop-types";
import { useMemo } from "react";

const FolderIcon = ({ open }) => (
  <svg
    className="doc-lib-folder-icon"
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    {open ? (
      <path
        d="M2.25 5.25C2.25 4.42157 2.92157 3.75 3.75 3.75H7.18934C7.55451 3.75 7.90536 3.89509 8.15901 4.15165L9.34099 5.33363C9.59464 5.58728 9.94549 5.73237 10.3107 5.73237H14.25C15.0784 5.73237 15.75 6.40394 15.75 7.23237V13.5C15.75 14.3284 15.0784 15 14.25 15H3.75C2.92157 15 2.25 14.3284 2.25 13.5V5.25Z"
        fill="#3B82F6"
        stroke="#2563EB"
        strokeWidth="1.2"
      />
    ) : (
      <path
        d="M2.25 5.25C2.25 4.42157 2.92157 3.75 3.75 3.75H7.18934C7.55451 3.75 7.90536 3.89509 8.15901 4.15165L9.34099 5.33363C9.59464 5.58728 9.94549 5.73237 10.3107 5.73237H14.25C15.0784 5.73237 15.75 6.40394 15.75 7.23237V13.5C15.75 14.3284 15.0784 15 14.25 15H3.75C2.92157 15 2.25 14.3284 2.25 13.5V5.25Z"
        fill="#EFF6FF"
        stroke="#93C5FD"
        strokeWidth="1.2"
      />
    )}
  </svg>
);

FolderIcon.propTypes = {
  open: PropTypes.bool,
};

const ChevronIcon = ({ expanded }) => (
  <svg
    className={`doc-lib-tree-chevron${expanded ? " is-expanded" : ""}`}
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    <path
      d="M5.25 3.5L8.75 7L5.25 10.5"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

ChevronIcon.propTypes = {
  expanded: PropTypes.bool.isRequired,
};

const countDocumentsInFolder = (folderName, documents, folderTree) => {
  const parent = folderTree.find((entry) => entry.name === folderName);
  if (parent) {
    const childNames = (parent.children || []).map((child) => child.name);
    return documents.filter((doc) => childNames.includes(doc.folder)).length;
  }
  return documents.filter((doc) => doc.folder === folderName).length;
};

const FolderTree = ({
  folderTree,
  documents,
  selectedFolder,
  expandedFolders,
  onToggleExpand,
  onSelectFolder,
}) => {
  const countsByFolder = useMemo(() => {
    const counts = {};
    folderTree.forEach((parent) => {
      counts[parent.name] = countDocumentsInFolder(parent.name, documents, folderTree);
      (parent.children || []).forEach((child) => {
        counts[child.name] = countDocumentsInFolder(child.name, documents, folderTree);
      });
    });
    return counts;
  }, [documents, folderTree]);

  return (
    <div className="doc-lib-tree">
      <div className="doc-lib-tree-header">
        <h3 className="doc-lib-tree-title">Folders</h3>
      </div>
      <div className="doc-lib-tree-scroll">
        <ul className="doc-lib-tree-list" role="tree">
          {folderTree.map((parent) => {
            const isParentExpanded = Boolean(expandedFolders[parent.name]);
            const isParentActive = selectedFolder === parent.name;

            return (
              <li key={parent.name} className="doc-lib-tree-node" role="none">
                <div className="doc-lib-tree-row doc-lib-tree-row--parent">
                  <button
                    type="button"
                    className="doc-lib-tree-expand-btn"
                    onClick={() => onToggleExpand(parent.name)}
                    aria-label={isParentExpanded ? `Collapse ${parent.name}` : `Expand ${parent.name}`}
                    aria-expanded={isParentExpanded}
                  >
                    <ChevronIcon expanded={isParentExpanded} />
                  </button>
                  <button
                    type="button"
                    className={`doc-lib-tree-folder-btn${isParentActive ? " is-active" : ""}`}
                    onClick={() => onSelectFolder(parent.name, null)}
                    role="treeitem"
                    aria-selected={isParentActive}
                  >
                    <FolderIcon open={isParentExpanded || isParentActive} />
                    <span className="doc-lib-tree-folder-name">{parent.name}</span>
                    <span className="doc-lib-tree-badge" aria-label={`${countsByFolder[parent.name]} documents`}>
                      {countsByFolder[parent.name]}
                    </span>
                  </button>
                </div>

                {isParentExpanded && (
                  <ul className="doc-lib-tree-children" role="group">
                    {(parent.children || []).map((child) => {
                      const isChildActive = selectedFolder === child.name;

                      return (
                        <li key={child.name} className="doc-lib-tree-node doc-lib-tree-node--child" role="none">
                          <button
                            type="button"
                            className={`doc-lib-tree-folder-btn doc-lib-tree-folder-btn--child${isChildActive ? " is-active" : ""}`}
                            onClick={() => onSelectFolder(child.name, parent.name)}
                            role="treeitem"
                            aria-selected={isChildActive}
                          >
                            <FolderIcon open={isChildActive} />
                            <span className="doc-lib-tree-folder-name">{child.name}</span>
                            <span className="doc-lib-tree-badge" aria-label={`${countsByFolder[child.name]} documents`}>
                              {countsByFolder[child.name]}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

FolderTree.propTypes = {
  folderTree: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      children: PropTypes.arrayOf(
        PropTypes.shape({
          name: PropTypes.string.isRequired,
        })
      ),
    })
  ).isRequired,
  documents: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      folder: PropTypes.string.isRequired,
    })
  ).isRequired,
  selectedFolder: PropTypes.string.isRequired,
  expandedFolders: PropTypes.object.isRequired,
  onToggleExpand: PropTypes.func.isRequired,
  onSelectFolder: PropTypes.func.isRequired,
};

export default FolderTree;
