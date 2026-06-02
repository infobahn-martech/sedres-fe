import {
  normalizeGroApiDocuments,
  parseDocumentsByTaskResponse,
  resolveGroTaskId,
} from "../GROCardView/groCardUtils";

export const resolveGroSupervisorTaskId = resolveGroTaskId;

export { parseDocumentsByTaskResponse };

/** Map API documents to GROSupervisorDocumentLibrary row shape. */
export const mapGroSupervisorDocuments = (apiDocuments) =>
  normalizeGroApiDocuments(apiDocuments).map((doc, index) => ({
    ...doc,
    __rowKey: `${doc.document_id}-${doc.call_task_document_id || index}`,
  }));
