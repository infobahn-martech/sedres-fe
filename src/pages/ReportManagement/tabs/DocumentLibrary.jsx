import { useCallback, useMemo, useState } from "react";
import FolderTree from "../../KanbanBoard/CardFormTabs/Import/tabs/appointment/documentLibrary/FolderTree";
import FileExplorer from "../../KanbanBoard/CardFormTabs/Import/tabs/appointment/documentLibrary/FileExplorer";
import DocumentPreview from "../../KanbanBoard/CardFormTabs/Import/tabs/appointment/documentLibrary/DocumentPreview";
import {
  DOCUMENTS,
  FOLDER_TREE,
  DEFAULT_DOCUMENT_ID,
  DEFAULT_FOLDER,
  DEFAULT_PARENT_FOLDER,
} from "../../KanbanBoard/CardFormTabs/Import/tabs/appointment/documentLibrary/documentLibraryData";
import "../../../design/scss/documentLibrary.scss";

/* ── Helpers (same logic as DocumentLibrary.jsx) ─────────────── */

const findParentForFolder = (folderName) => {
  const parentEntry = FOLDER_TREE.find((entry) => entry.name === folderName);
  if (parentEntry) return null;
  const parent = FOLDER_TREE.find((entry) =>
    (entry.children || []).some((child) => child.name === folderName)
  );
  return parent?.name ?? null;
};

const isParentFolder = (folderName) =>
  FOLDER_TREE.some((entry) => entry.name === folderName);

const getChildFolders = (folderName) => {
  const parentEntry = FOLDER_TREE.find((entry) => entry.name === folderName);
  if (!parentEntry) return [];
  return (parentEntry.children || []).map((child) => ({
    name: child.name,
    parentName: parentEntry.name,
  }));
};

/* ── Component ───────────────────────────────────────────────── */

function ReportManagementDocumentLibrary() {
  const [selectedFolder, setSelectedFolder] = useState(DEFAULT_FOLDER);
  const [selectedParentFolder, setSelectedParentFolder] = useState(DEFAULT_PARENT_FOLDER);
  const [selectedDocumentId, setSelectedDocumentId] = useState(DEFAULT_DOCUMENT_ID);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [viewMode, setViewMode] = useState("list");
  const [expandedFolders, setExpandedFolders] = useState(() => ({
    [DEFAULT_PARENT_FOLDER]: true,
  }));

  const selectedDocument = useMemo(
    () => DOCUMENTS.find((doc) => doc.id === selectedDocumentId) ?? null,
    [selectedDocumentId]
  );

  const folderFiles = useMemo(() => {
    if (isParentFolder(selectedFolder)) return [];
    return DOCUMENTS.filter((doc) => doc.folder === selectedFolder);
  }, [selectedFolder]);

  const childFolders = useMemo(() => getChildFolders(selectedFolder), [selectedFolder]);

  const breadcrumb = useMemo(() => {
    const segments = ["Document Library"];
    if (isParentFolder(selectedFolder)) {
      segments.push(selectedFolder);
    } else if (selectedParentFolder) {
      segments.push(selectedParentFolder, selectedFolder);
    } else {
      const parent = findParentForFolder(selectedFolder);
      if (parent) {
        segments.push(parent, selectedFolder);
      } else {
        segments.push(selectedFolder);
      }
    }
    return segments;
  }, [selectedFolder, selectedParentFolder]);

  const handleToggleExpand = useCallback((folderName) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderName]: !prev[folderName],
    }));
  }, []);

  const handleSelectFolder = useCallback(
    (folderName, parentName) => {
      setSelectedFolder(folderName);
      setSelectedParentFolder(parentName);
      setSearchQuery("");

      if (parentName) {
        setExpandedFolders((prev) => ({ ...prev, [parentName]: true }));
      }

      if (isParentFolder(folderName)) {
        setSelectedDocumentId(null);
        return;
      }

      const folderDocuments = DOCUMENTS.filter((doc) => doc.folder === folderName);
      const currentStillValid = folderDocuments.some((doc) => doc.id === selectedDocumentId);
      if (!currentStillValid) {
        setSelectedDocumentId(folderDocuments[0]?.id ?? null);
      }
    },
    [selectedDocumentId]
  );

  const handleSelectDocument = useCallback((documentId) => {
    setSelectedDocumentId(documentId);
  }, []);

  return (
    <div className="document-library-wrapper">
      <div className="document-library">
        <aside className="document-library__panel document-library__panel--tree">
          <FolderTree
            folderTree={FOLDER_TREE}
            documents={DOCUMENTS}
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
          <DocumentPreview document={selectedDocument} />
        </aside>
      </div>
    </div>
  );
}

export default ReportManagementDocumentLibrary;
