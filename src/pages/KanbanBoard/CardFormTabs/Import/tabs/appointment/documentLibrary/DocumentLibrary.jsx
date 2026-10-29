import PropTypes from "prop-types";
import { useCallback, useEffect, useMemo, useState } from "react";
import FolderTree from "./FolderTree";
import FileExplorer from "./FileExplorer";
import DocumentPreview from "./DocumentPreview";
import {
  DOCUMENTS,
  FOLDER_TREE,
  transformAttachmentsResponse,
  resolveLibraryDefaults,
} from "./documentLibraryData";
import attachmentsService from "../../../../../../../services/attachmentsService";
import "../../../../../../../design/scss/documentLibrary.scss";

const buildFolderIndex = (folderTree) => {
  const index = new Map();
  folderTree.forEach((parent) => {
    const children = (parent.children || []).map((child) => ({
      name: child.name,
      label: child.label ?? child.name,
      parentName: parent.name,
    }));
    index.set(parent.name, {
      key: parent.name,
      label: parent.label ?? parent.name,
      parentKey: null,
      hasChildren: children.length > 0,
      children,
    });
    children.forEach((child) => {
      index.set(child.name, {
        key: child.name,
        label: child.label,
        parentKey: parent.name,
        hasChildren: false,
        children: [],
      });
    });
  });
  return index;
};

const resolveCallId = (formValues, card) =>
  formValues?.call_id ||
  formValues?.callId ||
  formValues?.card_call_id ||
  card?.call_id ||
  card?.callId ||
  null;

// onAttachDocument is only passed when this is opened as an attachment picker (see
// SoApprovalEmailModal's "From Document Library" option, via DocumentLibraryPickerModal) —
// the real Document Library tab never passes it, so DocumentPreview's "Attach" button only
// shows up in picker mode.
function DocumentLibrary({ card, formValues, onAttachDocument }) {
  const cardColor = card?.color || "#2A00FF";
  const callId = resolveCallId(formValues, card);

  const [folderTree, setFolderTree] = useState(() => (callId ? [] : FOLDER_TREE));
  const [documents, setDocuments] = useState(() => (callId ? [] : DOCUMENTS));
  const [isLoading, setIsLoading] = useState(Boolean(callId));
  const [error, setError] = useState(null);

  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [viewMode, setViewMode] = useState("list");
  const [expandedFolders, setExpandedFolders] = useState({});

  const applyLibraryData = useCallback((nextFolderTree, nextDocuments) => {
    setFolderTree(nextFolderTree);
    setDocuments(nextDocuments);

    const defaults = resolveLibraryDefaults(nextFolderTree, nextDocuments);
    setSelectedFolder(defaults.folder);
    setSelectedDocumentId(defaults.documentId);
    setSearchQuery("");
    setExpandedFolders(() => {
      const next = {};
      if (defaults.parentFolder) next[defaults.parentFolder] = true;
      else if (defaults.folder) next[defaults.folder] = true;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!callId) {
      applyLibraryData(FOLDER_TREE, DOCUMENTS);
      setIsLoading(false);
      setError(null);
      return undefined;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);

    attachmentsService
      .getAllAttachments(callId)
      .then((res) => {
        if (!isActive) return;
        const payload = res?.data?.data ?? res?.data ?? {};
        const { folderTree: nextTree, documents: nextDocs } =
          transformAttachmentsResponse(payload);
        applyLibraryData(nextTree, nextDocs);
      })
      .catch(() => {
        if (!isActive) return;
        setError("Unable to load documents. Please try again.");
        applyLibraryData([], []);
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [callId, applyLibraryData]);

  const folderIndex = useMemo(() => buildFolderIndex(folderTree), [folderTree]);
  const selectedNode = selectedFolder ? folderIndex.get(selectedFolder) : null;

  const selectedDocument = useMemo(
    () => documents.find((doc) => doc.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId]
  );

  const folderFiles = useMemo(() => {
    if (!selectedNode || selectedNode.hasChildren) return [];
    return documents.filter((doc) => doc.folder === selectedFolder);
  }, [documents, selectedFolder, selectedNode]);

  const childFolders = useMemo(
    () => (selectedNode?.hasChildren ? selectedNode.children : []),
    [selectedNode]
  );

  const breadcrumb = useMemo(() => {
    const segments = ["Document Library"];
    if (!selectedNode) return segments;
    if (selectedNode.parentKey) {
      const parent = folderIndex.get(selectedNode.parentKey);
      segments.push(parent?.label ?? selectedNode.parentKey, selectedNode.label);
    } else {
      segments.push(selectedNode.label);
    }
    return segments;
  }, [selectedNode, folderIndex]);

  const handleToggleExpand = useCallback((folderName) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderName]: !prev[folderName],
    }));
  }, []);

  const handleSelectFolder = useCallback(
    (folderName, parentName) => {
      setSelectedFolder(folderName);
      setSearchQuery("");

      if (parentName) {
        setExpandedFolders((prev) => ({ ...prev, [parentName]: true }));
      }

      const node = folderIndex.get(folderName);
      if (node?.hasChildren) {
        setSelectedDocumentId(null);
        return;
      }

      const folderDocuments = documents.filter((doc) => doc.folder === folderName);
      setSelectedDocumentId((prev) => {
        const currentStillValid = folderDocuments.some((doc) => doc.id === prev);
        return currentStillValid ? prev : folderDocuments[0]?.id ?? null;
      });
    },
    [folderIndex, documents]
  );

  const handleSelectDocument = useCallback((documentId) => {
    setSelectedDocumentId(documentId);
  }, []);

  const isEmpty = !isLoading && !error && folderTree.length === 0;

  return (
    <div className="cardform-body">
      <div
        className="cardform-left-full document-library-wrapper"
        style={{ "--card-color": cardColor }}
      >
        {isLoading ? (
          <div className="document-library document-library--message">
            <p>Loading documents…</p>
          </div>
        ) : error ? (
          <div className="document-library document-library--message">
            <p>{error}</p>
          </div>
        ) : isEmpty ? (
          <div className="document-library document-library--message">
            <p>No documents available for this call.</p>
          </div>
        ) : (
          <div className="document-library">
            <aside className="document-library__panel document-library__panel--tree">
              <FolderTree
                folderTree={folderTree}
                documents={documents}
                selectedFolder={selectedFolder}
                expandedFolders={expandedFolders}
                onToggleExpand={handleToggleExpand}
                onSelectFolder={handleSelectFolder}
              />
            </aside>

            <section className="document-library__panel document-library__panel--explorer">
              <FileExplorer
                breadcrumb={breadcrumb}
                childFolders={childFolders}
                files={folderFiles}
                selectedDocumentId={selectedDocumentId}
                searchQuery={searchQuery}
                sortBy={sortBy}
                viewMode={viewMode}
                onSearchChange={setSearchQuery}
                onSortChange={setSortBy}
                onViewModeChange={setViewMode}
                onSelectFolder={handleSelectFolder}
                onSelectDocument={handleSelectDocument}
              />
            </section>

            <aside className="document-library__panel document-library__panel--preview">
              <DocumentPreview document={selectedDocument} onAttach={onAttachDocument} />
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

DocumentLibrary.propTypes = {
  card: PropTypes.object,
  formValues: PropTypes.object,
  handleChange: PropTypes.func,
  onAttachDocument: PropTypes.func,
};

export default DocumentLibrary;
